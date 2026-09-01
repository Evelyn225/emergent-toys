// ── Filesystem persistence ────────────────────────────────────────
const DRIVE_STATE_KEY = 'sleepOS-drive-state';
// Pre-phase-2. Read exactly once, by createDriveStateDefaults(true), and only
// when DRIVE_STATE_KEY is absent - so for any profile that has booted since,
// it can never be read again. It was also being rewritten on every defrag pass,
// a mirror with no reader, which is the same shape as the blob mirrors tasks 9e
// and 9f deleted. The write is gone; the read stays one more release so a
// returning visitor keeps their "Last defrag" time.
const LEGACY_DEFRAG_KEY = 'sleepOS-defrag-time';

function _serDir(d) {
  const out = { dirs: [...d.dirs], files: {}, subdirs: {} };
  d.files.forEach((v, k) => { out.files[k] = v; });
  if (d.subdirs) d.subdirs.forEach((v, k) => { out.subdirs[k] = _serDir(v); });
  return out;
}

function _desDir(o) {
  const d = { dirs: new Set(o.dirs || []), files: new Map(), blobs: new Map(), subdirs: new Map() };
  Object.entries(o.files || {}).forEach(([k, v]) => d.files.set(k, v));
  Object.entries(o.subdirs || {}).forEach(([k, v]) => d.subdirs.set(k, _desDir(v)));
  return d;
}

// Read at module top level, during bundle evaluation. This is only safe
// because the manifest loads os/vfs.js before os/fs-core.js before this file,
// and os/fs-core.js installs the seed tree synchronously with
// vfsSetTree(vfsSeedTree()) for exactly this reason. Do not reorder them.
const SEEDED_DOCS_DATA = _serDir(vfsGetTree().subdirs.get('DOCS'));

// Mutates the tree directly and deliberately queues no op. Unlike the legacy
// call sites this is not a persistence bug: vfsBootMount runs this from a
// constant on every boot, so its effect is regenerated rather than restored,
// and there is nothing here that needs a commit to survive. If a later real
// write is the first thing to ever target DOCS, the backend's inoForDir
// (os/storage-idb.js) creates the directory on demand rather than requiring
// a prior mkdir op to have reserved its ino - so skipping a commit here
// leaves nothing dangling for that write to find missing.
function refreshSeededDocs() {
  const root = vfsGetTree();
  root.dirs.add('DOCS');
  let docs = root.subdirs.get('DOCS');
  if (!docs) {
    docs = _desDir(SEEDED_DOCS_DATA);
    root.subdirs.set('DOCS', docs);
    return;
  }
  docs.dirs = docs.dirs || new Set();
  docs.files = docs.files || new Map();
  docs.blobs = docs.blobs || new Map();
  docs.subdirs = docs.subdirs || new Map();
  Object.entries(SEEDED_DOCS_DATA.files || {}).forEach(([name, value]) => {
    // Two kinds of thing, two policies. Reference text is regenerated every
    // boot, so a mangled README self-heals - that is what the note above this
    // function has always meant. A seeded program is fill-if-absent: the demo
    // scripts exist to be edited, and overwriting them would have destroyed
    // every edit at the next reload with no message. Delete one and it comes
    // back fresh.
    //
    // The extension list is `.exe` AND `.script`, because "program" here means
    // a runnable seed file, not one particular suffix. REACTOR.script is one:
    // README.txt tells the player to "RUN DOCS\REACTOR.script to play a
    // terminal game", and it is authored in the same script language as
    // HELLO.exe and RUNAWAY.exe. While this matched `.exe` alone it healed
    // like reference text, so a player who edited the one seed program they
    // were pointed at lost the edit on the next reload with no message -
    // exactly the outcome the paragraph above calls fatal, reached because
    // the predicate encoded "program" as an extension rather than as a kind.
    //
    // Deliberately a bare regex, not programIsSpawnableExe (os/programs.js),
    // even though the two agree for every name that can reach this loop
    // today (it only ever iterates SEEDED_DOCS_DATA.files' own keys - the
    // demo README/HELLO.exe/RUNAWAY.exe seed set - none of which is one of
    // the eight system binary names, so programIsSpawnableExe's extra
    // "and it's not a system binary" clause never fires here). The two
    // predicates answer different questions: programIsSpawnableExe asks
    // whether a root-level name is launchable, keyed off PROGRAM_LAUNCHERS;
    // this asks whether a DOCS seed entry is fill-if-absent or heal-every-
    // boot, and has nothing to do with what's launchable. Swapping in the
    // canonical predicate would couple this file's persistence policy to
    // os/programs.js's launcher table, so a future PROGRAM_LAUNCHERS entry
    // that happened to collide with a seed demo script's name would flip
    // that script from fill-if-absent to silently overwritten every boot,
    // discarding a player's edits - a change nobody editing os/programs.js
    // would have reason to expect. Keeping this predicate local avoids that
    // action-at-a-distance.
    if (/\.(exe|script)$/i.test(name) && docs.files.has(name)) return;
    docs.files.set(name, value);
  });
  Object.entries(SEEDED_DOCS_DATA.subdirs || {}).forEach(([name, value]) => {
    docs.dirs.add(name);
    docs.subdirs.set(name, _desDir(value));
  });
}

// The eight system binaries (SYSTEM_BINARY_SOURCES, os/fs-core.js), restored
// on every boot for a user whose root already had content. vfsBootMount's
// seed callback above only runs `if (!root.dirs.size && !root.files.size)` -
// a completely empty root - so it never fires for anyone who has booted
// sleepOS before, meaning phase 6's seeding alone dropped all eight binaries
// out of DIR for every returning user the moment they next loaded the OS.
//
// This HEALS rather than fill-if-absent, the same policy refreshSeededDocs
// already applies to README.txt and the rest of DOCS: whatever a player did
// to the content, this restores it to SYSTEM_BINARY_SOURCES on the next boot.
// That is deliberately NOT the DOCS-vs-programs distinction it looks like at
// first glance - "docs heal, programs do not" was about the demo .exe/.script
// files a player is meant to author and have survive (HELLO.exe and friends,
// PROGRAM_LAUNCHERS has no entry for those, so programIsSystemBinary is
// false and this function never touches them). A system binary is not one of
// those: its NOTEPAD view is read-only by design, so there is no legitimate
// edit for this function to protect, only corruption to repair - a write
// that reached one at all had to go around a guard (apps/notepad.js's
// writeAndSync, apps/terminal.js's writePipelineOutput) that exists
// specifically to stop that. Healing here is the backstop for whatever gets
// through anyway.
//
// Unlike refreshSeededDocs, the heal below goes through vfsWriteFile rather
// than poking tree.files directly, so a repair queues a real commit op and
// the binary ends up occupying actual disk blocks - SYSMON's disk meter and
// DEFRAG's map both read the backend's block counts, not the tree, so a
// binary that only exists in memory reports as zero bytes used. The
// content comparison still runs first, and only a mismatch reaches
// vfsWriteFile, so a normal boot where all eight already match queues
// nothing at all - same cost as before. If the write itself throws (ENOSPC
// via _vfsAssertRoom in os/vfs.js is the realistic case, on a full disk),
// the catch below falls back to the old in-memory tree.files.set so the
// binary is still correct for this session - the phase 6 guarantee that a
// corrupted binary always heals must survive a full disk, it just will not
// stick across a reload - and reports the failure through reportVfsError,
// the same channel every other late VFS failure in this file uses.
//
// This does NOT cover a genuinely fresh install: vfsMount's `seed` callback
// (below, in vfsBootMount) fills the eight binaries into the tree BEFORE
// this function ever runs, so on that specific boot the comparison above
// finds every one already matching and correctly writes nothing - correct
// by this function's own contract, but the content was never committed
// either, since `seed` mutates the tree directly with no queued op. That
// case is handled by seedFreshRootTree, which the `seed` callback calls
// instead of mutating root.files itself.
async function refreshSeededSystemBinaries() {
  const tree = vfsGetTree();
  for (const name of Object.keys(SYSTEM_BINARY_SOURCES)) {
    const want = SYSTEM_BINARY_SOURCES[name];
    if (tree.files.get(name) === want) continue;
    try {
      await vfsWriteFile(name, want, '');
    } catch (err) {
      tree.files.set(name, want);
      reportVfsError(err);
    }
  }
}

// Populates a genuinely empty root - vfsMount's `seed` option, wired up in
// vfsBootMount below, calls this only `if (!root.dirs.size &&
// !root.files.size)`. Everything except the eight root-level system
// binaries is mutated directly with no queued op, same as refreshSeededDocs
// and for the same reason: DESKTOP and the DOCS subtree are meant to stay
// uncommitted, regenerated from vfsSeedTree() on every boot rather than
// restored from the backend.
//
// The eight binaries are different, and NOT for the reason refreshSeededDocs'
// own comment gives about them (read-only, healed rather than authored) -
// that reasoning covers WHY they heal, not why this function exists at all.
// This exists because `seed` runs before the backend is attached (vfsMount
// assigns _vfsBackend only after `seed` returns) and mutates `root` - the
// exact same live tree refreshSeededSystemBinaries reads from - directly.
// So on THIS boot only, refreshSeededSystemBinaries's own compare-before-write
// finds every binary already matching what it just wrote here and correctly
// queues nothing, leaving the content real in the tree but backed by zero
// committed blocks: SYSMON's disk meter and DEFRAG's map read the backend's
// allocation, not the tree, so they showed 0.00% used and an empty map on a
// filesystem DIR already listed as full of files.
//
// vfsQueueDirectWrite (os/vfs.js) is the fix: the same escape hatch
// os/daemon.js uses for its own direct-tree-mutation-with-no-op problem.
// Passing null as the "previous value" bypasses its own unchanged-content
// skip, which exists to stop a normal re-set of identical content from
// queuing a redundant op - here the previous value is not identical, it is
// altogether absent from anything committed, and null is how that gets said.
function seedFreshRootTree(root) {
  const seeded = vfsSeedTree();
  seeded.dirs.forEach(d => root.dirs.add(d));
  seeded.subdirs.forEach((v, k) => root.subdirs.set(k, v));
  seeded.files.forEach((v, k) => {
    root.files.set(k, v);
    vfsQueueDirectWrite('', k, null);
  });
}

function refreshSeededWallpaperLibrary() {
  const dir = ensureFsDir(SYSTEM_WALLPAPER_DIR);
  SEEDED_WALLPAPERS.forEach(item => {
    const { fileName } = fsSplitPath(item.path);
    if (!fileName) return;
    dir.blobs.set(fileName, {
      url: item.assetUrl,
      kind: 'image',
      size: 0,
      mime: item.mime,
      seeded: true,
    });
  });
}

function refreshSeededHomeMedia() {
  SEEDED_HOME_MEDIA.forEach(item => {
    const { dirName, fileName } = fsSplitPath(item.path);
    if (!fileName) return;
    const dir = ensureFsDir(dirName);
    dir.blobs.set(fileName, {
      url: item.assetUrl,
      kind: item.kind || inferBlobKindFromName(fileName),
      size: item.size || 0,
      mime: item.mime,
      author: item.author || '',
      seeded: true,
    });
  });
}

function saveFS() { return vfsFlush(); }

function createDriveStateDefaults(fromLegacy) {
  const legacyTs = fromLegacy ? parseInt(localStorage.getItem(LEGACY_DEFRAG_KEY) || '0', 10) || 0 : 0;
  return {
    lastDefragTs: legacyTs,
    changeCount: 0,
    lastMutationTs: 0,
  };
}

function normalizeDriveState(saved) {
  const next = Object.assign(createDriveStateDefaults(false), saved || {});
  next.lastDefragTs = Math.max(0, Math.trunc(Number(next.lastDefragTs) || 0));
  next.changeCount = Math.max(0, Math.trunc(Number(next.changeCount) || 0));
  next.lastMutationTs = Math.max(0, Math.trunc(Number(next.lastMutationTs) || 0));
  return next;
}

function loadDriveState() {
  try {
    const raw = localStorage.getItem(DRIVE_STATE_KEY);
    if (raw) return normalizeDriveState(JSON.parse(raw));
  } catch (e) {}
  return createDriveStateDefaults(true);
}

function saveDriveState() {
  try { localStorage.setItem(DRIVE_STATE_KEY, JSON.stringify(defragState)); } catch (e) {}
}

let defragState = loadDriveState();

// Fragmentation used to be a number nudged by hand-tuned deltas on every
// write, clamped to 0.02-0.92, and persisted to localStorage. Nothing measured
// anything: DEFRAG.exe animated against a fiction and the deltas existed only
// to make the fiction drift.
//
// It is now computed from the real allocation map: the number of extra block
// runs beyond the one run per file that is unavoidable, over the most extra
// runs those same blocks could have had. It is cached because reading it walks
// every inode and SYSMON asks often; fsRefreshFragmentation() is what
// recomputes.
var fsFragmentationLevel = 0;

function getDriveFragmentationLevel() {
  return fsFragmentationLevel;
}

function getDriveOptimizationPercent() {
  return Math.round((1 - getDriveFragmentationLevel()) * 100);
}

// Recompute from the allocation map. Only the IndexedDB backend has one; on
// the localStorage fallback there are no blocks to measure, so the honest
// answer is 0 rather than an invented number.
async function fsRefreshFragmentation() {
  if (fsGetActiveBackendKind() !== 'idb') { fsFragmentationLevel = 0; return 0; }
  try {
    const backend = vfsGetBackend();
    const inodes = backend && backend._readInodes ? await backend._readInodes() : [];
    fsFragmentationLevel = fsComputeFragmentation(inodes);
  } catch (e) {
    // Leave the last known value rather than reporting a drop that did not
    // happen. A transient read failure is not a defragmentation.
  }
  return fsFragmentationLevel;
}

// Walks a compaction plan, one transaction per move, deferring commits for the
// duration. This is what DEFRAG.exe drives.
//
// Never throws. DEFRAG is a UI with no useful way to handle an exception
// mid-animation, and an unhandled one would leave the defer flag set, which
// silently stops the filesystem persisting for the rest of the session. Every
// outcome comes back as a value, the same rule fsMigrateFromLocalStorage
// follows.
//
// The plan is deliberately not persisted. The target layout is a pure function
// of the current disk, so an interrupted run needs no saved state: the next
// run replans from wherever this one got to. Stop, crash recovery and resume
// are therefore one mechanism instead of three.
async function fsRunCompaction(options) {
  options = options || {};
  const result = {
    ran: false, reason: 'not-idb', moved: 0, total: 0,
    stopped: false, fragBefore: getDriveFragmentationLevel(), fragAfter: getDriveFragmentationLevel(),
  };
  if (fsGetActiveBackendKind() !== 'idb') return result;

  const backend = vfsGetBackend();
  if (!backend || typeof backend._moveBlock !== 'function') return result;

  vfsSetDefragActive(true);
  try {
    const entries = await backend._readInodeEntries();
    let plan;
    try {
      plan = fsPlanCompaction(entries, backend._superblock);
    } catch (err) {
      result.ran = true;
      result.reason = err && err.code === 'ENOSPC' ? 'no-space' : 'failed';
      return result;
    }

    result.ran = true;
    result.total = plan.length;
    if (!plan.length) { result.reason = 'nothing-to-do'; return result; }
    result.reason = 'ok';

    for (const move of plan) {
      if (options.shouldStop && options.shouldStop()) { result.stopped = true; break; }
      try {
        await backend._moveBlock(move);
      } catch (err) {
        // One failed move ends the run. The disk is still consistent - the
        // transaction rolled back - and the next run replans from here.
        result.reason = 'failed';
        break;
      }
      result.moved++;
      if (options.onProgress) options.onProgress(move, result.moved, result.total);
    }
    return result;
  } catch (err) {
    // `ran` means "the flag was set and work was attempted", which is true by
    // the time we are here - this catch is downstream of vfsSetDefragActive(true).
    // Leaving it false would make a real failure look like the early declines
    // above, where nothing was attempted at all.
    result.ran = true;
    result.reason = 'failed';
    return result;
  } finally {
    vfsSetDefragActive(false);
    defragState.lastDefragTs = Date.now();
    saveDriveState();
    result.fragAfter = await fsRefreshFragmentation();
    void vfsFlush();
  }
}

// Which backend actually mounted. SYSMON reports it, and Task 7's
// fragmentation reads the real bitmap only when it is 'idb'.
var fsActiveBackendKind = 'local';
function fsGetActiveBackendKind() { return fsActiveBackendKind; }

// Pick the filesystem backend, and migrate on the first boot that finds one.
//
// IndexedDB is not guaranteed: private browsing, disabled storage, and a
// database that simply refuses to open are all real. None of them may stop the
// desktop appearing, so every failure path here ends at the localStorage
// backend the OS shipped with. A visitor in that state keeps a working, if
// smaller, filesystem and loses nothing.
async function fsChooseBackend() {
  if (!fsIdbAvailable()) return { backend: createLocalStorageBackend(), kind: 'local' };
  try {
    const backend = createIdbBackend();
    // Force the connection open now rather than on the first write, so a
    // refusal is caught here where there is still a fallback to take.
    // (estimate() never touches the database - it only calls
    // navigator.storage.estimate() and swallows every error - so it cannot do
    // this on its own. _store() is what actually opens the connection via
    // ensure(), and is what can throw here.)
    await backend._store();
    const result = await fsMigrateFromLocalStorage(backend);
    if (result.reason === 'failed') {
      // Boot from localStorage exactly as before and try again next time.
      //
      // Migration's abort path tries to destroy the database, but it can fail
      // to - another tab holding a connection blocks the delete, and it fails
      // fast rather than hanging (result.databaseDeleted records which
      // happened). Deliberately not branching on that here: the import runs as
      // ONE transaction, so a failed import commits no content at all, and
      // whatever database survives holds nothing but the superblock ensure()
      // wrote when it opened. `migrated` stays false either way, so the next
      // boot re-imports over it and converges. The delete is defensive
      // cleanup, not a correctness requirement - which is exactly why a
      // blocked one is safe to ignore.
      return { backend: createLocalStorageBackend(), kind: 'local' };
    }
    return { backend, kind: 'idb' };
  } catch (e) {
    return { backend: createLocalStorageBackend(), kind: 'local' };
  }
}

// Async boot entry point. Called from the BIOS sequence before startDesktop.
async function vfsBootMount() {
  const chosen = await fsChooseBackend();
  fsActiveBackendKind = chosen.kind;
  await vfsMount(chosen.backend, {
    onChange: () => {
      document.dispatchEvent(new CustomEvent('fs-changed'));
    },
    // Recompute here, not from onChange. onChange fires the instant an op is
    // queued - up to 400ms before the debounced vfsFlush() actually commits
    // it - and fsRefreshFragmentation() reads backend._readInodes(), which
    // only ever sees durably committed IndexedDB state. Computing from
    // onChange reads that state before the write which triggered the
    // recompute has landed, so the cached number is stale by one commit and
    // nothing corrects it until an unrelated later write or a reload happens
    // to come along. onCommit fires only once the commit that produced `ops`
    // has actually landed, so the read is of the state it just produced.
    // Deliberately not awaited: vfsFlush never awaits onCommit, and a
    // rejected promise here must not surface as an unhandled rejection.
    onCommit: () => {
      void fsRefreshFragmentation();
    },
    onError: err => { reportVfsError(err); },
    seed: root => {
      if (!root.dirs.size && !root.files.size) {
        seedFreshRootTree(root);
      }
    },
  });
  refreshSeededDocs();
  await refreshSeededSystemBinaries();
  refreshSeededWallpaperLibrary();
  refreshSeededHomeMedia();
  ensureFsDir(RECYCLE_STORAGE_DIR);
  // vfsSeedTree() (os/fs-core.js) adds DESKTOP to the tree it builds, but
  // seedFreshRootTree only ever installs that tree `if (!root.dirs.size &&
  // !root.files.size)` - a genuinely empty root - and even then does so with
  // no queued op, on purpose (see seedFreshRootTree's own comment: DESKTOP is
  // "meant to stay uncommitted, regenerated ... on every boot rather than
  // restored from the backend"). Nothing was doing that regeneration: any
  // profile that had already booted before DESKTOP existed, or any returning
  // user whose mount restored a persisted tree in place of the seed, loads a
  // root with no DESKTOP at all and no way to get one back - vfsWriteFile
  // into it throws ENOENT forever after. Same shape as the RECYCLE_STORAGE_DIR
  // heal one line up, and the fix is the same: ensureFsDir is idempotent and
  // queues a real commit only the first time it actually creates the dir, so
  // this costs nothing for a user who already has DESKTOP and permanently
  // fixes anyone who does not - not just the .url shortcut writer, but every
  // future write into DESKTOP (uploads, New Folder, wallpaper drops).
  ensureFsDir('DESKTOP');
  void loadBlobsFromBlocks();
  // The load-time syncDaemonStory ran against the seed tree, which the mount
  // then replaced. Re-run it against the real tree so the story files and the
  // registry pointers agree. Same shape as the ensureFsDir call above.
  syncDaemonStory({ silent: true });
  await fsRefreshFragmentation();
}

// A late commit failure has no call stack to propagate into, so it surfaces
// here, on screen. Silently swallowing it is what phase 2 exists to stop.
function reportVfsError(err) {
  const code = (err && err.code) || '';
  let msg;
  if (code === 'ENOSPC') {
    msg = 'Disk full. Recent changes were not saved.';
  } else if (code === 'EACCES') {
    // Storage disabled or blocked by private-browsing settings. Telling this
    // user to free up space would be useless advice, which is why the
    // localStorage backend separates this from ENOSPC.
    msg = 'Storage is unavailable. sleepOS cannot save in this browser session.';
  } else {
    msg = 'Filesystem error: ' + ((err && err.message) || 'unknown');
  }
  if (typeof showOsToast === 'function') showOsToast(msg);
  else console.warn('sleepOS:', msg);
}

// Start the commit as the page goes away, rather than waiting out the rest of
// the 400ms debounce. IndexedDB cannot be written synchronously at all, so
// there is nothing to do from beforeunload on that path; visibilitychange is
// the earlier signal, and it fires while the page is still alive and
// scriptable, which beforeunload does not reliably do on mobile.
//
// This buys the commit more time. It does not make it durable: vfsFlush is
// async and the page can still be killed mid-commit, so this narrows the
// window rather than closing it.
//
// Deliberately not gated on backend kind - committing early is right for
// both. Firing on ordinary tab switches and minimises costs nothing either:
// vfsFlush early-returns when no ops are pending, and when ops ARE pending
// the commit was going to happen within 400ms regardless.
// Set once a factory reset has started. It is cleared again only on the one
// path that gives up before erasing anything (a delete blocked by another tab);
// past that point the only way out of the state is the reload at the end of it.
//
// Both save-on-the-way-out handlers below have to honour it, and for the same
// reason: a reset ends in location.replace, which fires visibilitychange and
// then beforeunload AFTER the database has been deleted and localStorage
// emptied. Without this, fsFlushOnHidden commits the in-memory tree straight
// back into a freshly recreated database and fsSnapshotOnUnload writes the
// localStorage copy back out, and the "fresh install" boots into exactly the
// filesystem it was asked to destroy.
var osFactoryResetInProgress = false;
function fsBeginFactoryReset() { osFactoryResetInProgress = true; }

function fsFlushOnHidden() {
  if (osFactoryResetInProgress) return;
  if (document.visibilityState !== 'hidden') return;
  void vfsFlush();
}
document.addEventListener('visibilitychange', fsFlushOnHidden);

// The localStorage backend's last-ditch save. beforeunload cannot await, and a
// pending commit sits behind a 400ms debounce, so `void vfsFlush()` here would
// silently drop up to 400ms of the user's work on close. localStorage.setItem
// is synchronous and does land, so write the snapshot directly. This
// deliberately reaches past the backend interface: it is the only place that
// does, and it is correct only for the backend whose storage this actually is.
//
// Hence the backend-kind gate. Under IndexedDB this write is not merely
// useless, it is destructive: LOCAL_FS_KEY (os/storage-local.js) and
// FS_MIGRATE_SOURCE_KEY (os/fs-migrate.js) are the same string, 'sleepOS-fs'.
// Migration leaves that key in place for one release on purpose, as the
// recovery path if the database is ever lost - `migrated` lives in the IDB
// superblock, not in localStorage, so the next boot really does re-import from
// it. Writing here would overwrite that frozen pre-migration snapshot on every
// tab close with a vfsSerializeTree copy, which is text-only and therefore has
// every image and sound stripped out - and it would still not save the pending
// IndexedDB writes. fsFlushOnHidden above is what covers those instead.
function fsSnapshotOnUnload() {
  if (osFactoryResetInProgress) return;
  if (fsGetActiveBackendKind() !== 'local') return;
  // vfsIsMounted() is the load-bearing half of this guard. vfsMount publishes
  // _vfsBackend only after _vfsRoot holds real data, so this is what stops us
  // serializing the seed tree over a returning visitor's filesystem if they
  // close the tab during the BIOS sequence.
  if (!vfsIsMounted() || !vfsHasPendingWrites()) return;
  try {
    localStorage.setItem(LOCAL_FS_KEY, JSON.stringify(vfsSerializeTree()));
  } catch (e) { /* unload is too late to report anything useful */ }
}
window.addEventListener('beforeunload', fsSnapshotOnUnload);

function normalizeRecycleEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id || '').trim();
  const name = String(entry.name || '').trim();
  const storedDir = fsNormalizeDir(entry.storedDir || '');
  if (!id || !name || !storedDir) return null;
  return {
    id,
    name,
    kind: String(entry.kind || 'file').toLowerCase(),
    originalDir: fsNormalizeDir(entry.originalDir || ''),
    storedDir,
    deletedAt: Number(entry.deletedAt) || Date.now(),
  };
}

function loadRecycleBin() {
  try {
    return (JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]') || [])
      .map(normalizeRecycleEntry)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function saveRecycleBin() {
  try { localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(recycleBinEntries)); } catch (e) {}
}

function recycleEntryOriginalPath(entry) {
  if (!entry) return '';
  return entry.originalDir ? entry.originalDir + '\\' + entry.name : entry.name;
}

function recycleEntryStoredPath(entry) {
  if (!entry) return '';
  return entry.storedDir ? entry.storedDir + '\\' + entry.name : entry.name;
}

let recycleBinEntries = loadRecycleBin();
ensureFsDir(RECYCLE_STORAGE_DIR);
