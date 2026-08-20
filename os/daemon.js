// Daemon story state and sync
const DAEMON_STORY_KEY = 'sleepOS-daemon-story';
const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'SYSMON.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'BROWSER.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'DEFRAG.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
  { name: 'REGEDIT.exe', size: '8,192', date: '11/13/2024  10:31' },
  { name: 'EXPLORER.exe', size: '8,192', date: '11/13/2024  10:31' },
];
const ROOT_PROTECTED_DIRS = new Set(['DOCS', 'PROJECTS', 'SYS', 'CACHE', 'DESKTOP']);
const STORY_FILE_PATHS = {
  notice: 'DOCS\\NOTICE_13.txt',
  incident: 'DOCS\\INCIDENT_A.txt',
  lostContact: 'DOCS\\LOST_CONTACT.txt',
  lastOperator: 'DOCS\\LAST_OPERATOR.txt',
  mirrorProtocol: 'DOCS\\MIRROR_PROTOCOL.txt',
  watchPid: 'SYS\\watch.pid',
  anchorSeed: 'SYS\\anchor.seed',
  quarantineSig: 'SYS\\quarantine.sig',
  mirrorDat: 'CACHE\\mirror.dat',
};
const BUILTIN_PROCESS_SEED = [
  { pid: 4, name: 'System', cpu: 0.1, mem: 0.5, protected: true },
  { pid: 52, name: 'csrss.exe', cpu: 0.1, mem: 1.2, protected: true },
  { pid: 116, name: 'services.exe', cpu: 0.2, mem: 2.1, protected: true },
  { pid: 124, name: 'lsass.exe', cpu: 0.3, mem: 3.4, protected: true },
  { pid: 280, name: 'svchost.exe', cpu: 0.5, mem: 4.8, protected: true },
  { pid: 312, name: 'svchost.exe', cpu: 0.1, mem: 2.3, protected: true },
  { pid: 440, name: 'dream_kernel.exe', cpu: 1.2, mem: 8.5, protected: true },
  { pid: 666, name: 'daemon.core', cpu: 2.1, mem: 12.3, protected: true },
  { pid: 999, name: 'void_monitor.exe', cpu: 0.4, mem: 5.2, protected: true },
];
const VOID_ACTION_ORDER = ['observe', 'measure', 'listen', 'trace', 'sample', 'stabilize', 'pulse'];
const VOID_ACTION_LABELS = {
  observe: 'Observe',
  measure: 'Measure',
  listen: 'Listen',
  trace: 'Trace',
  sample: 'Sample',
  stabilize: 'Stabilize',
  pulse: 'Pulse',
};

function normalizeVoidActions(actions) {
  const seen = new Set(
    (Array.isArray(actions) ? actions : [])
      .map(action => String(action || '').toLowerCase())
      .filter(action => Object.prototype.hasOwnProperty.call(VOID_ACTION_LABELS, action))
  );
  return VOID_ACTION_ORDER.filter(action => seen.has(action));
}

function createDaemonStoryDefaults() {
  return {
    version: 1,
    stage: 0,
    openedDaemon: false,
    falseContainmentSeen: false,
    killedSoulDaemon: false,
    respawnDisabledKill: false,
    daemonStopped: false,
    wrongVictory: false,
    anchorDeleted: false,
    voidObserved: false,
    voidActions: [],
    mirrorInspected: false,
    protocolInspected: false,
    mirrorLockRestored: false,
    quarantineSigned: false,
    endingReached: false,
    lastEventText: 'none',
  };
}

function daemonNormalizeStory(story) {
  if (!story) return;
  if (story.openedDaemon) story.stage = Math.max(story.stage, 1);
  if (story.falseContainmentSeen) story.stage = Math.max(story.stage, 2);
  if (story.respawnDisabledKill) story.stage = Math.max(story.stage, 3);
  if (story.daemonStopped || story.wrongVictory) story.stage = Math.max(story.stage, 4);
  if (story.anchorDeleted) story.stage = Math.max(story.stage, 5);
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
    story.mirrorLockRestored = true;
  }
  if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected)) story.stage = Math.max(story.stage, 6);
  if (story.mirrorLockRestored || story.quarantineSigned) story.stage = Math.max(story.stage, 7);
  if (story.endingReached) story.stage = Math.max(story.stage, 8);
}

function normalizeDaemonStory(saved) {
  const next = Object.assign(createDaemonStoryDefaults(), saved || {});
  next.stage = Math.max(0, Math.min(8, Math.trunc(Number(next.stage) || 0)));
  [
    'openedDaemon',
    'falseContainmentSeen',
    'killedSoulDaemon',
    'respawnDisabledKill',
    'daemonStopped',
    'wrongVictory',
    'anchorDeleted',
    'voidObserved',
    'mirrorInspected',
    'protocolInspected',
    'mirrorLockRestored',
    'quarantineSigned',
    'endingReached',
  ].forEach(key => { next[key] = !!next[key]; });
  next.voidActions = normalizeVoidActions(next.voidActions);
  next.lastEventText = String(next.lastEventText || 'none');
  daemonNormalizeStory(next);
  if (next.stage >= 6 && !next.voidActions.length) next.voidActions = ['trace'];
  return next;
}

function loadDaemonStory() {
  try {
    return normalizeDaemonStory(JSON.parse(localStorage.getItem(DAEMON_STORY_KEY) || 'null'));
  } catch (e) {
    return createDaemonStoryDefaults();
  }
}

function saveDaemonStory() {
  try { localStorage.setItem(DAEMON_STORY_KEY, JSON.stringify(daemonStory)); } catch (e) {}
}

let daemonStory = loadDaemonStory();
let daemonVoidFeed = '';
let daemonVoidFeedMode = '';
let daemonPulseTimer = null;

function daemonStageLabel(stage) {
  if (stage >= 8) return 'Contained';
  if (stage >= 7) return 'Seal Ready';
  if (stage >= 6) return 'Observed';
  if (stage >= 5) return 'Contact';
  if (stage >= 4) return 'Containment Lost';
  if (stage >= 1) return 'Observed';
  return 'Dormant';
}

function getVoidActions(story) {
  return normalizeVoidActions((story || daemonStory)?.voidActions);
}

function isVoidProfiled(story) {
  const target = story || daemonStory;
  if (!target) return false;
  if (target.stage >= 6 || target.quarantineSigned || target.endingReached) return true;
  return getVoidActions(target).some(action => action !== 'observe');
}

function getVoidProfileLabel(story) {
  const target = story || daemonStory;
  const analyticalCount = getVoidActions(target).filter(action => action !== 'observe').length;
  if (target?.endingReached) return 'sealed';
  if (target?.quarantineSigned) return 'bound';
  if (analyticalCount >= 3) return 'deep';
  if (analyticalCount >= 1) return 'active';
  if (getVoidActions(target).length) return 'surface';
  return 'none';
}

function getVoidObjectiveLine(story) {
  const target = story || daemonStory;
  if (!target) return 'No stable directive.';
  if (target.endingReached) return 'Containment complete. Archive only.';
  if (target.stage < 4) return 'The relay is still taking the load. Watch the file.';
  if (!target.anchorDeleted) {
    return target.daemonStopped
      ? 'Lower MIRROR_LOCK and remove SYS\\anchor.seed when you are ready to expose the channel.'
      : 'Silence the relay before you trust what the file looks like.';
  }
  if (!isVoidProfiled(target)) return 'Use Measure, Listen, Trace, Sample, or Pulse here to profile the breach.';
  if (!(target.mirrorInspected || target.protocolInspected)) return 'Compare this file with CACHE\\mirror.dat or DOCS\\MIRROR_PROTOCOL.txt.';
  if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) return 'Restore MIRROR_LOCK before containment can hold.';
  if (!target.quarantineSigned) return 'Run ?????.exe to write SYS\\quarantine.sig.';
  return 'Delete void.tmp. The seal is ready.';
}

function getContainmentTelemetry() {
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const respawnLockActive = Number(getContainmentValue('RESPAWN_LOCK')) === 1;
  const voidPressureBase = Math.max(0, Math.min(99, parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.VOID_PRESSURE_BASE?.value) || 12));
  const pressureBase = daemonStory.endingReached
    ? 0
    : daemonStory.quarantineSigned
      ? 18
      : daemonStory.stage >= 7
        ? 24
        : daemonStory.stage >= 5
          ? 79
          : daemonStory.stage >= 4
            ? 46
            : daemonStory.stage >= 2
              ? 23
              : 12;
  const pressure = daemonStory.endingReached ? 0 : Math.min(99, pressureBase + Math.max(0, voidPressureBase - 12));
  const lattice = daemonStory.endingReached
    ? 100
    : mirrorLockActive
      ? daemonStory.quarantineSigned
        ? 92
        : daemonStory.stage >= 7
          ? 76
          : daemonStory.stage >= 5
            ? 61
            : daemonStory.stage >= 4
              ? 74
              : 96
      : daemonStory.stage >= 5
        ? 21
        : daemonStory.stage >= 4
          ? 38
          : 57;
  const signalDepth = daemonStory.endingReached
    ? 0
    : daemonStory.stage >= 7
      ? 88
      : daemonStory.stage >= 5
        ? 73
        : daemonStory.stage >= 4
          ? 51
          : daemonStory.stage >= 2
            ? 26
          : 11;
  const bias = daemonStory.endingReached ? 'sealed' : mirrorLockActive ? 'deflected' : 'user-facing';
  const deleteAuthorized = !daemonStory.endingReached && daemonStory.quarantineSigned && mirrorLockActive;
  const sealReady = !daemonStory.endingReached && !daemonStory.quarantineSigned && daemonStory.anchorDeleted && daemonStory.voidObserved && isVoidProfiled(daemonStory) && (daemonStory.mirrorInspected || daemonStory.protocolInspected) && mirrorLockActive;
  let rating = { code: 'CT-0', label: 'STABLE', color: '#004b61' };
  if (daemonStory.endingReached) rating = { code: 'CT-8', label: 'SEALED', color: '#0a7a2a' };
  else if (deleteAuthorized) rating = { code: 'CT-7', label: 'DELETE AUTHORIZED', color: '#0a5a9c' };
  else if (sealReady) rating = { code: 'CT-6', label: 'SEAL READY', color: '#005f73' };
  else if (daemonStory.anchorDeleted && !mirrorLockActive) rating = { code: 'CT-5', label: 'OPEN BREACH', color: '#8a0036' };
  else if (daemonStory.anchorDeleted) rating = { code: 'CT-4', label: 'CHANNEL EXPOSED', color: '#7a2e00' };
  else if (daemonStory.daemonStopped) rating = { code: 'CT-3', label: 'UNMONITORED', color: '#8a1a00' };
  else if (daemonStory.falseContainmentSeen) rating = { code: 'CT-2', label: 'STRAINED', color: '#8a5a00' };
  else if (daemonStory.openedDaemon) rating = { code: 'CT-1', label: 'OBSERVED', color: '#003f7a' };
  return {
    mirrorLockActive,
    respawnLockActive,
    pressure,
    lattice,
    signalDepth,
    bias,
    sealReady,
    deleteAuthorized,
    rating,
  };
}

function getContainmentChecklist() {
  return [
    { label: 'RESPAWN_LOCK cleared', done: Number(getContainmentValue('RESPAWN_LOCK')) === 0 },
    { label: 'PID 512 offline', done: daemonStory.daemonStopped },
    { label: 'void channel observed', done: daemonStory.voidObserved },
    { label: 'void channel profiled', done: isVoidProfiled(daemonStory) },
    { label: 'mirror evidence inspected', done: daemonStory.mirrorInspected || daemonStory.protocolInspected },
    { label: 'anchor released', done: daemonStory.anchorDeleted },
    { label: 'MIRROR_LOCK restored', done: daemonStory.anchorDeleted && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
    { label: 'quarantine signature present', done: daemonStory.quarantineSigned },
    { label: 'final delete authorized', done: !daemonStory.endingReached && daemonStory.quarantineSigned && Number(getContainmentValue('MIRROR_LOCK')) === 1 },
  ];
}

function daemonStoryChanged(before) {
  try {
    return JSON.stringify(before) !== JSON.stringify(daemonStory);
  } catch (e) {
    return true;
  }
}

// Synchronous because module-level callers depend on it during bundle
// evaluation (os/fs-persist.js seeds the wallpaper library and the recycle
// store this way). It mutates the live tree directly and lets the VFS commit
// on its own schedule.
function ensureFsDir(path) {
  const parts = vfsNormalizeDir(path).split('\\').filter(Boolean);
  let node = vfsGetTree();
  let parentPath = '';
  parts.forEach(part => {
    if (!node.dirs.has(part)) {
      node.dirs.add(part);
      // One op per directory actually created, carrying its own parent. A
      // single marker for the whole walk could not tell a backend which of
      // DOCS, DOCS\SYS, DOCS\SYS\CACHE were new.
      vfsQueueDirectMkdir(parentPath, part);
    }
    if (!node.subdirs) node.subdirs = new Map();
    // Materializing a node for a name that is already in `dirs` is not a
    // filesystem change - it is the same lazy fill vfsDirNodeSync does, and it
    // queues nothing there either.
    if (!node.subdirs.has(part)) node.subdirs.set(part, vfsMakeNode());
    node = node.subdirs.get(part);
    parentPath = parentPath ? parentPath + '\\' + part : part;
  });
  return node;
}

// The VFS handles the block-layer cleanup, the object-URL revoke and the
// commit. What it does not know about is the wallpaper binding, so that
// stays here.
async function removeFsPath(path, options) {
  options = options || {};
  const st = vfsStatSync(path);
  if (!st) return false;
  if (st.kind === 'blob' && st.blob?.kind === 'image') handleWallpaperFileDelete(st.dirName, st.name);
  // Resolve from the stat rather than re-splitting `path`, so the unlink cannot
  // land anywhere other than the entry the stat found.
  return await vfsUnlink(st.name, st.dirName, options);
}

function isRecycleBinItemName(name) {
  return String(name || '').trim().toUpperCase() === RECYCLE_BIN_NAME;
}

// `storage` is the physical shape ('text' | 'blob' | 'dir'); `kind` is what the
// UI labels the item with, which for a blob is its media kind. The node itself
// is deliberately not returned any more - every consumer now works through the
// VFS by path.
function getFsItemState(path, fallbackDir) {
  const st = vfsStatSync(path, fallbackDir);
  if (!st) return null;
  if (st.kind === 'text') return { dirName: st.dirName, entryName: st.name, kind: 'file', storage: 'text' };
  if (st.kind === 'blob') {
    return { dirName: st.dirName, entryName: st.name, kind: st.blob?.kind || 'binary', storage: 'blob', blob: st.blob };
  }
  return { dirName: st.dirName, entryName: st.name, kind: 'dir', storage: 'dir' };
}

function makeUniqueFsName(dirName, desiredName, kind, suffixToken) {
  const exists = name => vfsExistsSync(name, dirName);
  if (!exists(desiredName)) return desiredName;
  const token = String(suffixToken || 'copy');
  if (kind === 'dir') {
    const base = String(desiredName || 'NEW_FOLDER').toUpperCase();
    let candidate = base + '_' + token.toUpperCase();
    let i = 2;
    while (exists(candidate)) candidate = base + '_' + token.toUpperCase() + i++;
    return candidate;
  }
  const dot = String(desiredName).lastIndexOf('.');
  const base = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const ext = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = base + '_' + token + ext;
  let i = 2;
  while (exists(candidate)) candidate = base + '_' + token + i++ + ext;
  return candidate;
}

async function moveFsItemByPath(path, fallbackDir, dstDirPath, options) {
  options = options || {};
  const item = getFsItemState(path, fallbackDir);
  const dstDirName = vfsNormalizeDir(dstDirPath);
  if (!item || !vfsDirExistsSync(dstDirName)) return null;
  if (item.storage === 'dir') {
    const srcPath = blobRelativePath(item.dirName, item.entryName);
    if (dstDirName === srcPath || dstDirName.startsWith(srcPath + '\\')) return null;
  }
  let nextName = String(options.newName || item.entryName || '').trim();
  if (!nextName) return null;
  if (item.storage === 'dir') nextName = nextName.toUpperCase();
  const sameParent = dstDirName === vfsNormalizeDir(item.dirName);
  const sameName = nextName === item.entryName;
  if (sameParent && sameName) return { kind: item.kind, name: nextName, dirName: dstDirName };
  if (options.makeUnique) nextName = makeUniqueFsName(dstDirName, nextName, item.storage === 'dir' ? 'dir' : 'file', options.suffixToken || 'copy');
  else if (vfsExistsSync(nextName, dstDirName)) return null;

  let moved;
  try {
    moved = await vfsMove(item.dirName, item.entryName, dstDirName, nextName);
  } catch (err) {
    // The guards above already cover EEXIST, ENOENT and the self-nesting
    // EINVAL, so this is unreachable in practice. It stays because callers
    // (Explorer's "Move failed.", the Recycle Bin) are written against a
    // null-on-failure contract, and a raw VfsError escaping into a drop
    // handler would take the whole gesture down instead.
    return null;
  }
  if (!moved) return null;
  // vfsMove already updates the block layer through its own queued op - the
  // bytes live there now, keyed by dirent, not by a separate path-keyed
  // mirror this caller used to have to keep in step by hand.
  return { kind: item.kind, name: moved, dirName: dstDirName };
}

function handleWallpaperTreeDelete(path) {
  const removedPath = normalizeWallpaperPath(path);
  const savedPath = normalizeWallpaperPath(localStorage.getItem(WP_KEY));
  const registryPath = normalizeWallpaperPath(getWallpaperRegistryValue());
  if (
    (currentWallpaper && currentWallpaper.startsWith(removedPath + '\\')) ||
    (savedPath && savedPath.startsWith(removedPath + '\\')) ||
    (registryPath && registryPath.startsWith(removedPath + '\\'))
  ) {
    applyWallpaper(DEFAULT_WALLPAPER_PATH);
  }
}

// vfsUnlink drops a directory's name and subtree - including the block layer
// underneath every blob in it - but revokes only the single object URL it was
// handed, which is not enough for a folder: emptying the Recycle Bin on a
// folder of images would leak one object URL per image. This is the
// permanent-delete half; a move into the Recycle Bin deliberately does not
// run it.
function purgeFsDirNode(dirPath) {
  vfsWalkBlobs(dirPath, (base, name, blob) => {
    if (blob?.kind === 'image') handleWallpaperFileDelete(base, name);
    if (blob?.url && !blob.seeded) URL.revokeObjectURL(blob.url);
  });
}

async function purgeFsPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  if (!item) return false;
  // Rebuild the path from the resolved entry rather than passing `path`
  // through: removeFsPath re-splits with no fallback directory, so a bare name
  // plus a fallbackDir would otherwise be looked up at the root.
  if (item.storage !== 'dir') return await removeFsPath(blobRelativePath(item.dirName, item.entryName));
  purgeFsDirNode(blobRelativePath(item.dirName, item.entryName));
  return await vfsUnlink(item.entryName, item.dirName);
}

async function recycleVirtualPath(path, fallbackDir) {
  const item = getFsItemState(path, fallbackDir);
  const fileLabel = vfsSplitPath(path, fallbackDir).fileName || path;
  if (!item) return { ok: false, message: 'File not found: ' + fileLabel };
  const sourcePath = blobRelativePath(item.dirName, item.entryName);
  if (vfsNormalizeDir(sourcePath).startsWith(vfsNormalizeDir(RECYCLE_STORAGE_DIR))) {
    return { ok: false, message: 'Item is already in the Recycle Bin.' };
  }

  const id = 'RB_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const storedDir = RECYCLE_STORAGE_DIR + '\\' + id;
  ensureFsDir(storedDir);

  if (item.storage === 'blob' && item.blob?.kind === 'image') handleWallpaperFileDelete(item.dirName, item.entryName);
  if (item.storage === 'dir') handleWallpaperTreeDelete(sourcePath);

  const moved = await moveFsItemByPath(path, fallbackDir, storedDir, { newName: item.entryName });
  if (!moved) {
    await removeFsPath(storedDir);
    return { ok: false, message: 'Could not move ' + fileLabel + ' to the Recycle Bin.' };
  }

  recycleBinEntries.unshift({
    id,
    name: moved.name,
    kind: item.kind,
    originalDir: item.dirName,
    storedDir,
    deletedAt: Date.now(),
  });
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true, recycled: true, details: ['Moved to Recycle Bin: ' + fileLabel] };
}

async function restoreRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  ensureFsDir(entry.originalDir);
  const moved = await moveFsItemByPath(entry.name, entry.storedDir, entry.originalDir, {
    newName: entry.name,
    makeUnique: true,
    suffixToken: 'restored',
  });
  if (!moved) return { ok: false, message: 'Could not restore ' + entry.name + '.' };
  await removeFsPath(entry.storedDir);
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, restored: true, name: moved.name, dirName: entry.originalDir };
}

async function purgeRecycleEntry(entry) {
  entry = normalizeRecycleEntry(entry);
  if (!entry) return { ok: false, message: 'Recycle entry is missing.' };
  await purgeFsPath(recycleEntryStoredPath(entry), entry.storedDir);
  await removeFsPath(entry.storedDir);
  recycleBinEntries = recycleBinEntries.filter(item => item.id !== entry.id);
  saveRecycleBin();
  document.dispatchEvent(new CustomEvent('fs-changed'));
  return { ok: true, deleted: true };
}

// Sequential rather than Promise.all: each purge rewrites recycleBinEntries,
// so overlapping them would race on that array.
async function emptyRecycleBin() {
  for (const entry of recycleBinEntries.slice()) await purgeRecycleEntry(entry);
}

function confirmEmptyRecycleBin(onDone) {
  if (!recycleBinEntries.length) {
    if (typeof onDone === 'function') onDone(false);
    return;
  }
  osConfirm('Permanently delete all items in the Recycle Bin?', 'Empty Recycle Bin', async ok => {
    if (!ok) {
      if (typeof onDone === 'function') onDone(false);
      return;
    }
    // onDone re-renders the view, so it has to wait for the purge to finish or
    // it draws the bin still holding everything it just deleted.
    await emptyRecycleBin();
    if (typeof onDone === 'function') onDone(true);
  }, 'icon:recycle-full');
}

function promptCreateFolderAt(dirPath, onDone) {
  // The callback may be async: osPrompt closes its window before invoking it
  // and ignores the return value, so nothing is left on screen waiting.
  osPrompt('Folder name:', '', 'New Folder', async name => {
    const finish = result => { if (typeof onDone === 'function') onDone(result); };
    if (!name) return finish(null);
    let created;
    try {
      created = await vfsMkdir(name, dirPath);
    } catch (err) {
      // fsCreateDir returned null here and the dialog simply closed in silence.
      // vfsMkdir throws instead, so `created?.created` would stop being a
      // failure check at all - the error has to be caught, and a failure the
      // user asked for is worth saying out loud. ENOENT is reachable (the
      // target folder can be deleted while the dialog is open) and so is
      // EINVAL (a name that is nothing but separators).
      osAlert(
        err.code === 'ENOENT'
          ? 'That folder no longer exists:\nC:\\sleepOS\\' + vfsNormalizeDir(dirPath)
          : err.message,
        'New Folder', 'icon:error'
      );
      return finish(null);
    }
    // No hand-rolled 'fs-changed' dispatch: vfsMkdir queues its own op and
    // _vfsQueue fires the change callback synchronously, so the event is
    // already out by the time this resolves. onDone (Explorer's render()) runs
    // after the directory exists, not before.
    if (!created.created) return finish(null);
    finish(created);
  }, 'icon:folder');
}

function ensureStoryTextFile(path, value) {
  const { dirName, fileName } = fsSplitPath(path);
  const dir = ensureFsDir(dirName);
  const prev = dir.files.has(fileName) ? dir.files.get(fileName) : null;
  dir.files.set(fileName, value);
  vfsQueueDirectWrite(dirName, fileName, prev);
}

function daemonNoticeContent() {
  return [
    '== NOTICE 13 ==',
    '',
    'If soul_daemon.exe is terminated while RESPAWN_LOCK remains active,',
    'the watch layer will simply seed a replacement.',
    '',
    'Killing the process does not remove what it is holding back.',
    '',
    'Required path:',
    '  HKEY_SLEEPBOX_MACHINE\\Containment\\RESPAWN_LOCK',
    '',
    'Only proceed if you mean to test containment.',
  ].join('\n');
}

function daemonIncidentContent() {
  return [
    '== INCIDENT A ==',
    '',
    'Termination succeeded.',
    'Symptoms worsened immediately.',
    '',
    'The daemon was holding something back. It is no longer holding it.',
    '',
    'Read DOCS\\LOST_CONTACT.txt.',
  ].join('\n');
}

function daemonLostContactContent() {
  return [
    '== LOST CONTACT ==',
    '',
    'The operator who left this note killed the daemon.',
    'They thought that would be the end of it.',
    '',
    'It was not.',
    '',
    'The anchor file - SYS\\anchor.seed - was keeping the mirror',
    'pointed away from the user. When the daemon went quiet,',
    'the anchor was still holding.',
    '',
    'If you are reading this after killing it:',
    '  - The anchor may still be in place. Check SYS\\anchor.seed.',
    '  - Do not delete it without understanding what it does.',
    '  - Read SYS\\anchor.seed before you touch it.',
    '',
    'When the anchor is removed, contact begins.',
    'Have a plan before you do that.',
  ].join('\n');
}

function daemonLastOperatorContent() {
  const lines = ['== LAST OPERATOR ==', ''];

  if (daemonStory.daemonStopped && !daemonStory.anchorDeleted) {
    // Killed daemon first, anchor still present
    lines.push(
      'If you killed it and the room went quiet, you did what I did.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor file keeps the mirror pointed away from the user.',
      'The current anchor is SYS\\anchor.seed.',
      'Lower MIRROR_LOCK and delete it when you are ready to inspect the breach.',
      '',
      'If you intend to seal the breach again, restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  } else if (daemonStory.anchorDeleted && !daemonStory.daemonStopped) {
    // Deleted anchor first, daemon still running
    lines.push(
      'You removed the anchor before the daemon relay went offline.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The anchor is gone. The channel is open.',
      'The daemon is still running - it can no longer deflect what is coming through.',
      '',
      'Inspect void.tmp. Read MIRROR_PROTOCOL.txt.',
      'If you intend to seal the breach, restore MIRROR_LOCK before running the quarantine launcher.',
    );
  } else {
    // Both done, or generic fallback
    lines.push(
      'The daemon is offline. The anchor is gone.',
      '',
      'daemon.core was holding the channel shut.',
      '',
      'The channel is open. Inspect void.tmp.',
      'Read DOCS\\MIRROR_PROTOCOL.txt.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
    );
  }

  return lines.join('\n');
}

function daemonMirrorProtocolContent() {
  const lines = [
    '== MIRROR PROTOCOL ==',
    '',
    'Status:',
    `  MIRROR_LOCK   = ${Number(getContainmentValue('MIRROR_LOCK')) ? 1 : 0}`,
    `  RESPAWN_LOCK  = ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `  QUARANTINE    = ${daemonStory.quarantineSigned ? 'SIGNED' : 'UNSIGNED'}`,
    '',
    'Procedure:',
    daemonStory.daemonStopped
      ? '  1. daemon relay is offline - respawn risk is low if RESPAWN_LOCK=0'
      : '  1. daemon is still running - it cannot deflect void.tmp anymore',
    Number(getContainmentValue('MIRROR_LOCK')) === 0
      ? '  2. MIRROR_LOCK is 0 - the breach is open, inspect freely'
      : '  2. MIRROR_LOCK is restored - lattice is deflecting again',
    '  3. profile void.tmp directly - Measure, Listen, Trace, Sample, or Pulse',
    '  4. compare CACHE\\mirror.dat with void.tmp - see NOTE below',
    '  5. restore MIRROR_LOCK before launching ?????.exe',
    '  6. delete void.tmp only after SYS\\quarantine.sig is signed',
    '',
    'NOTE - mirror.dat vs void.tmp:',
    '  CACHE\\mirror.dat  : written by daemon.core, clean, internal',
    '  void.tmp          : external origin, should not exist here',
    '',
    '  void.tmp came through the channel the anchor was suppressing.',
    '  It did not originate here.',
    '',
    '  DO NOT open void.tmp from an uncontrolled state.',
    '  Quarantine and delete it - do not try to read it as data.',
  ];
  if (daemonStory.stage >= 5) {
    lines.push('', 'Note from daemon.core:', '  I was keeping the channel off-axis so it could not reach you.');
  }
  return lines.join('\n');
}

function daemonMirrorDatContent() {
  return [
    'mirror.dat',
    '',
    '[reflection offset] 0.17',
    '[signal age]        before current boot',
    '[voice match]       negative',
    '[source]            internal - daemon-managed lattice reflection',
    '[anomaly]           none',
    '',
    'This file is a stable read. The lattice reflection is clean.',
    'daemon.core wrote this as part of normal mirror management.',
    '',
    'Compare with void.tmp. They are not the same kind of file.',
  ].join('\n');
}

function daemonAnchorSeedContent() {
  return [
    'anchor.seed',
    '',
    'anchor-class: mirror-lattice',
    'deletion-policy: requires MIRROR_LOCK=0',
    'owner: HKEY_SLEEPBOX_MACHINE\\Containment',
    '',
    'Removing this file widens the channel.',
  ].join('\n');
}

function daemonWatchPidContent() {
  return [
    'watch.pid',
    '',
    'pid=512',
    'name=soul_daemon.exe',
    'policy=restart_on_exit',
    `respawn_lock=${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    '',
    'This is the watch layer. It restarts pid 512. It is not pid 512.',
  ].join('\n');
}

function daemonQuarantineSigContent() {
  return [
    'quarantine.sig',
    '',
    `launcher=${getExeDisplayName()}`,
    'state=armed',
    'target=void.tmp',
    'mirror_lock=1',
    'seal_phrase=CONTAINMENT_COMPLETE',
  ].join('\n');
}

function daemonQuarantinePendingContent() {
  return [
    'quarantine.sig',
    '',
    'launcher=?????.exe',
    'state=unsigned',
    'target=void.tmp',
    '',
    'This signature file exists but has not been written.',
    'Run ?????.exe after the mirror lattice is restored to sign it.',
    'A valid signature is required before void.tmp can be deleted.',
  ].join('\n');
}

function buildDaemonCoreRawContent() {
  const telemetry = getContainmentTelemetry();
  const mirrorLockActive = Number(getContainmentValue('MIRROR_LOCK')) === 1;
  const liveStatus = daemonStory.endingReached
    ? 'Contained'
    : daemonStory.stage >= 7 && !mirrorLockActive
      ? 'Seal Interrupted'
      : daemonStageLabel(daemonStory.stage);
  const lines = [
    'daemon.core',
    '',
    `[stage] ${daemonStory.stage} / ${daemonStageLabel(daemonStory.stage)}`,
    `[status] ${liveStatus}`,
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[owner] SYSTEM\\???`,
    `[mirror_lock] ${mirrorLockActive ? 1 : 0}`,
    `[respawn_lock] ${Number(getContainmentValue('RESPAWN_LOCK')) ? 1 : 0}`,
    `[void_pressure] ${telemetry.pressure}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    `[temporal_drift] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.TEMPORAL_DRIFT?.value ?? '+/-2.3yr'}`,
    `[observer_count] ${registryData['HKEY_SLEEPBOX_MACHINE']?.['VOID']?.OBSERVER_COUNT?.value ?? '[classified]'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push(
      'CONTAINMENT COMPLETE.',
      'The breach is closed.',
      'I will stay archived here in case it opens again.',
    );
  } else if (daemonStory.anchorDeleted) {
    lines.push(
      'You removed the anchor.',
      'I was keeping the mirror off your face.',
      '',
      'Restore MIRROR_LOCK before you run the quarantine launcher.',
      'Delete void.tmp only after the signature exists.',
    );
  } else if (daemonStory.daemonStopped) {
    lines.push(
      'The latch is open.',
      'Killing the process did not delete anything.',
      'Open void.tmp.',
    );
  } else if (daemonStory.falseContainmentSeen) {
    lines.push(
      'You tested the watch layer.',
      'It answered you with another process.',
      '',
      'If you want silence, clear RESPAWN_LOCK first.',
    );
  } else if (daemonStory.openedDaemon) {
    lines.push(
      'This file is what is holding it shut.',
      '',
      'NOTICE_13 has been copied into DOCS.',
    );
  } else {
    lines.push(
      'metadata unreadable',
      'modified: always',
      'access: observe only',
    );
  }
  return lines.join('\n');
}

function buildVoidProbeNotes() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const notes = [];
  if (daemonStory.stage >= 4) {
    notes.push(`offset 0x0008: reported size = 0 bytes / observed depth = ${telemetry.signalDepth}`);
    notes.push(`offset 0x0012: origin classification = external / aperture bias = ${telemetry.bias}`);
  }
  if (daemonStory.daemonStopped) notes.push('offset 0x0021: PID 512 silence increased readability');
  if (daemonStory.anchorDeleted) notes.push('offset 0x0034: anchor.seed removal exposed the user-facing side');
  if (actions.includes('observe')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0100: surface is the breach itself, not daemon.core residue'
        : 'offset 0x0100: active window edges repeat on the inside of the file'
    );
  }
  if (actions.includes('measure')) {
    notes.push(`offset 0x0118: locality check failed / disk distance behaves like ${telemetry.signalDepth} units of depth`);
    notes.push('offset 0x0124: zero-byte report is false on contact');
  }
  if (actions.includes('listen')) {
    notes.push('offset 0x0140: room-tone match positive / human voice match negative');
    notes.push('offset 0x014e: response is pressure change, no linguistic content');
  }
  if (actions.includes('trace')) {
    notes.push(
      daemonStory.stage >= 5
        ? 'offset 0x0180: return path = user-facing aperture <- mirror offset <- unresolved source'
        : 'offset 0x0180: return path = monitor gap <- reflected surface'
    );
    if (daemonStory.anchorDeleted) notes.push('offset 0x018f: no anchor remains to push the angle away from the user');
  }
  if (actions.includes('sample')) {
    notes.push('offset 0x01c0: daemon-authored signature = false');
    notes.push('offset 0x01d2: CACHE\\mirror.dat mismatch confirmed');
  }
  if (actions.includes('stabilize')) {
    notes.push(
      telemetry.mirrorLockActive
        ? 'offset 0x0210: MIRROR_LOCK bends the read angle but does not internalize the object'
        : 'offset 0x0210: stabilization failed / aperture remains user-facing'
    );
  }
  if (actions.includes('pulse')) {
    notes.push(
      daemonStory.quarantineSigned
        ? 'offset 0x0240: quarantine signature binds to target id = void.tmp'
        : 'offset 0x0240: echo returns before current boot'
    );
  }
  if ((daemonStory.mirrorInspected || daemonStory.protocolInspected) && daemonStory.stage >= 5) {
    notes.push('cross-check: mirror.dat clean, internal, daemon-managed / void.tmp foreign, external, non-local');
  }
  return notes;
}

function buildVoidTmpRawContent() {
  const telemetry = getContainmentTelemetry();
  const actions = getVoidActions();
  const lines = [
    'void.tmp',
    '',
    `[containment] ${telemetry.rating.code} / ${telemetry.rating.label}`,
    `[pressure] ${telemetry.pressure}`,
    `[mirror_lock] ${telemetry.mirrorLockActive ? 1 : 0}`,
    `[signature] ${daemonStory.quarantineSigned ? 'present' : 'missing'}`,
    `[lattice_stability] ${telemetry.lattice}`,
    `[signal_depth] ${telemetry.signalDepth}`,
    `[aperture_bias] ${telemetry.bias}`,
    '[origin] external / unresolved',
    `[probe_record] ${actions.length}/${VOID_ACTION_ORDER.length}`,
    `[profile] ${getVoidProfileLabel()}`,
    `[probes] ${actions.length ? actions.map(action => VOID_ACTION_LABELS[action]).join(', ') : 'none recorded'}`,
    '',
  ];
  if (daemonStory.endingReached) {
    lines.push('No active signal remains.', '', 'Archive note:', '  The breach surface is gone. The record remains.');
  } else if (daemonStory.stage >= 5) {
    lines.push(
      'The aperture is open.',
      'Something is pressing against the reflected side of the file.',
    );
  } else if (daemonStory.stage >= 4) {
    lines.push(
      'Pressure rose when PID 512 stayed dead.',
      'The monitor was keeping this file quiet, not keeping it alive.',
    );
  } else {
    lines.push(
      '[content redacted]',
      'The file is present but does not yet answer.',
    );
  }
  if (!daemonStory.endingReached && daemonStory.stage >= 4) {
    const notes = buildVoidProbeNotes();
    if (notes.length) {
      lines.push('', 'Recovered fragments:');
      notes.forEach(note => lines.push('  ' + note));
    }
    lines.push('', 'Containment path:', '  ' + getVoidObjectiveLine());
    if (!isVoidProfiled()) lines.push('  Direct probes make the file more legible.');
  }
  return lines.join('\n');
}

function getContainmentValue(name) {
  return registryData['HKEY_SLEEPBOX_MACHINE']['Containment'][name].value;
}

function getDaemonRegistryNode() {
  return registryData['HKEY_CURRENT_USER']['SOFTWARE\\sleepOS\\Daemon'];
}

function getRootSystemFiles(options) {
  const opts = options || {};
  const names = ROOT_SYSTEM_FILE_META.map(entry => entry.name);
  const explorerIndex = names.indexOf('EXPLORER.exe');
  if (opts.includeExplorer === false && explorerIndex !== -1) names.splice(explorerIndex, 1);
  if (!daemonStory.endingReached) names.push('void.tmp');
  names.push('daemon.core', '?????.exe');
  return names;
}

function isVisibleRootSystemFile(name, options) {
  const target = String(name || '').toUpperCase();
  return getRootSystemFiles(options).some(item => item.toUpperCase() === target);
}

function isVisibleSystemPath(path, options) {
  const { dirName, fileName } = fsSplitPath(path);
  return !dirName && isVisibleRootSystemFile(fileName, options);
}

function getTerminalRootSystemEntries(options) {
  const opts = options || {};
  const entries = ROOT_SYSTEM_FILE_META
    .filter(entry => opts.includeExplorer !== false || entry.name !== 'EXPLORER.exe')
    .map(entry => ({ ...entry }));
  if (!daemonStory.endingReached) entries.push({ name: 'void.tmp', size: '0', date: '11/13/2024  03:17' });
  entries.push({ name: 'daemon.core', size: '??', date: '11/13/2024  ??:??' });
  entries.push({ name: '?????.exe', size: '??', date: '11/13/2024  ??:??' });
  return entries;
}

function getBuiltInProcesses() {
  const base = BUILTIN_PROCESS_SEED.map(proc => ({ ...proc }));
  if (!daemonStory.daemonStopped && !daemonStory.endingReached) {
    base.push({
      pid: 512,
      name: daemonStory.stage >= 1 ? 'soul_daemon.exe' : 'soul_svc.exe',
      cpu: daemonStory.stage >= 4 ? 11.8 : 7.4,
      mem: daemonStory.stage >= 4 ? 36.9 : 31.2,
      protected: daemonStory.stage < 1,
    });
  }
  if (daemonStory.stage >= 4 && !daemonStory.endingReached) {
    base.push({ pid: 1008, name: 'mirror_watch.exe', cpu: 2.7, mem: 9.4, protected: true });
  }
  if (daemonStory.stage >= 5 && !daemonStory.endingReached) {
    base.push({ pid: 1333, name: 'signal_window.exe', cpu: 1.5, mem: 4.2, protected: true });
  }
  // DAEMON_COUNT registry key: extra phantom processes when count > 7
  const daemonCount = parseInt(registryData['HKEY_SLEEPBOX_MACHINE']?.['SOUL\\Metrics']?.DAEMON_COUNT?.value) || 7;
  for (let i = 8; i <= Math.min(daemonCount, 20); i++) {
    base.push({ pid: 500 + i * 13, name: 'soul_svc_' + String(i).padStart(2, '0') + '.exe', cpu: 0.1 + (i % 3) * 0.4, mem: 2.1 + (i % 5) * 1.2, protected: true });
  }
  return base.sort((a, b) => a.pid - b.pid);
}

function findBuiltInProcess(pid) {
  return getBuiltInProcesses().find(proc => proc.pid === pid) || null;
}

function syncDaemonStoryRegistry() {
  const daemonReg = getDaemonRegistryNode();
  daemonReg.STATUS.value = daemonStageLabel(daemonStory.stage);
  daemonReg.LAST_EVENT.value = daemonStory.lastEventText || 'none';
  daemonReg.OBSERVED.value = daemonStory.openedDaemon ? 1 : 0;
  registryData['HKEY_SLEEPBOX_MACHINE']['Containment'].ANCHOR_FILE.value = 'SYS\\anchor.seed';
  saveRegistry();
}

// Stays synchronous, and every removeFsPath below is deliberately floated.
// syncDaemonStory calls this from updateDaemonStory, which runs from dozens of
// story beats and from boot, none of which can await; and the tree mutation
// inside vfsUnlink is itself synchronous, so the file is gone from the tree by
// the time the promise is handed back. Only the commit is deferred, and that
// was already debounced before this migration.
function syncDaemonStoryFiles() {
  ensureFsDir('DOCS');
  ensureFsDir('SYS');
  ensureFsDir('CACHE');
  if (daemonStory.openedDaemon) ensureStoryTextFile(STORY_FILE_PATHS.notice, daemonNoticeContent());
  else void removeFsPath(STORY_FILE_PATHS.notice);
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.incident, daemonIncidentContent());
  else void removeFsPath(STORY_FILE_PATHS.incident);
  if (daemonStory.daemonStopped) ensureStoryTextFile(STORY_FILE_PATHS.lostContact, daemonLostContactContent());
  else void removeFsPath(STORY_FILE_PATHS.lostContact);
  if (daemonStory.stage >= 4) {
    ensureStoryTextFile(STORY_FILE_PATHS.lastOperator, daemonLastOperatorContent());
    if (!daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.mirrorDat, daemonMirrorDatContent());
  } else {
    void removeFsPath(STORY_FILE_PATHS.lastOperator);
    void removeFsPath(STORY_FILE_PATHS.mirrorDat);
  }
  if (daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.mirrorProtocol, daemonMirrorProtocolContent());
  else void removeFsPath(STORY_FILE_PATHS.mirrorProtocol);
  if (!daemonStory.anchorDeleted) ensureStoryTextFile(STORY_FILE_PATHS.anchorSeed, daemonAnchorSeedContent());
  else void removeFsPath(STORY_FILE_PATHS.anchorSeed);
  if (daemonStory.falseContainmentSeen && !daemonStory.daemonStopped && !daemonStory.endingReached) ensureStoryTextFile(STORY_FILE_PATHS.watchPid, daemonWatchPidContent());
  else void removeFsPath(STORY_FILE_PATHS.watchPid);
  if (daemonStory.quarantineSigned) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantineSigContent());
  else if (daemonStory.stage >= 4) ensureStoryTextFile(STORY_FILE_PATHS.quarantineSig, daemonQuarantinePendingContent());
  else void removeFsPath(STORY_FILE_PATHS.quarantineSig);
  if (daemonStory.endingReached) {
    void removeFsPath(STORY_FILE_PATHS.mirrorDat);
    void removeFsPath(STORY_FILE_PATHS.watchPid);
  }
}

function refreshDaemonStoryViews() {
  document.dispatchEvent(new CustomEvent('fs-changed'));
  applyDaemonVisualState();
  applyDaemonWindowState();
  if (typeof renderDaemonPanel === 'function' && document.getElementById('wb-daemon')) renderDaemonPanel();
  if (typeof renderVoid === 'function' && document.getElementById('wb-void')) renderVoid();
  // Reveal quarantine.exe name on desktop icon when signed
  const exeIconLabel = document.querySelector('[data-icon-key="?????.exe"] .di-name');
  if (exeIconLabel) exeIconLabel.textContent = iconLabel(getExeDisplayName());
}

function getDaemonVisualStage() {
  if (daemonStory.endingReached) return 0;
  if (daemonStory.stage >= 7) return 7;
  if (daemonStory.stage >= 5) return 5;
  if (daemonStory.stage >= 4) return 4;
  return 0;
}

// The daemon's own corruption dial, in [0,1]. Derived from the story stage,
// not stored - there is nothing here that a reload could not recompute, and a
// persisted copy would be one more field able to disagree with the stage.
//
// These two visual consumers used to read getDriveFragmentationLevel(). That
// worked only because the old fragmentation number was fake and idled near
// 0.68 - it was a mood dial wearing a disk metric's name. Phase 4 made
// fragmentation a real measurement, and a real filesystem on a fresh install
// scores near 0, which would have driven the visual level to 0 and stopped the
// glitches appearing at all for most players. No test would have caught it.
//
// So the story owns its own number now. The stage mapping reproduces the
// visual levels the old fake value produced at each stage: stage 4 crosses the
// old 0.22 threshold, stage 5 crosses 0.42, and stage 7 crosses 0.62.
function getDaemonCorruption() {
  if (daemonStory.endingReached) return 0;
  const stage = getDaemonVisualStage();
  if (stage >= 7) return 0.72;
  if (stage >= 5) return 0.5;
  if (stage >= 4) return 0.3;
  return 0.05;
}

function getDriveFragmentationVisualLevel() {
  if (daemonStory.endingReached) return 0;
  const visualStage = getDaemonVisualStage();
  if (visualStage < 4) return 0;
  const fragLevel = getDaemonCorruption();
  if (fragLevel < 0.22) return 0;
  if (visualStage >= 7 && fragLevel >= 0.62) return 3;
  if (visualStage >= 5 && fragLevel >= 0.42) return 2;
  return 1;
}

function scheduleDaemonPulse() {
  clearTimeout(daemonPulseTimer);
  daemonPulseTimer = null;
  const visualStage = getDaemonVisualStage();
  if (!visualStage) return;
  const fragLevel = getDaemonCorruption();
  const fragFactor = Math.max(0, Math.min(1, (fragLevel - 0.02) / 0.9));
  const delayScale = 1.7 - fragFactor * 0.7;
  const baseMinDelay = visualStage >= 7 ? 3800 : visualStage >= 5 ? 6200 : 9800;
  const baseMaxDelay = visualStage >= 7 ? 7200 : visualStage >= 5 ? 10800 : 14800;
  const minDelay = Math.round(baseMinDelay * delayScale);
  const maxDelay = Math.round(baseMaxDelay * delayScale);
  const pulseIntensity = Math.max(1, Math.round(visualStage * (0.55 + fragFactor * 0.45)));
  const nextDelay = minDelay + Math.random() * (maxDelay - minDelay);
  daemonPulseTimer = setTimeout(() => {
    triggerGlitch({ intensity: pulseIntensity, subtle: true });
    scheduleDaemonPulse();
  }, nextDelay);
}

function applyDaemonVisualState() {
  const body = document.body;
  if (!body) return;
  body.classList.remove('daemon-visual-4', 'daemon-visual-5', 'daemon-visual-7', 'frag-visual-1', 'frag-visual-2', 'frag-visual-3');
  const visualStage = getDaemonVisualStage();
  const fragVisualLevel = getDriveFragmentationVisualLevel();
  if (visualStage) body.classList.add(`daemon-visual-${visualStage}`);
  if (fragVisualLevel) body.classList.add(`frag-visual-${fragVisualLevel}`);
  scheduleDaemonPulse();
}

function applyDaemonWindowState() {
  const daemonWin = wins['daemon']?.el;
  const voidWin = wins['void']?.el;
  if (daemonWin) daemonWin.classList.add('daemon-surface');
  if (voidWin) voidWin.classList.add('void-surface');
}

function pulseDaemonWindows(intensity, options) {
  const subtle = !!options?.subtle;
  ['daemon', 'void'].forEach(id => {
    const el = wins[id]?.el;
    if (!el) return;
    const x = subtle
      ? (Math.random() < 0.5 ? -0.75 : 0.75)
      : intensity >= 7
        ? (Math.random() < 0.5 ? -2 : 2)
        : (Math.random() < 0.5 ? -1 : 1);
    const y = subtle
      ? 0
      : intensity >= 7
        ? (Math.random() < 0.5 ? -1 : 1)
        : 0;
    el.style.setProperty('--pulse-x', x + 'px');
    el.style.setProperty('--pulse-y', y + 'px');
    el.classList.add('window-afterimage');
    setTimeout(() => {
      const current = wins[id]?.el;
      if (!current || current !== el) return;
      el.classList.remove('window-afterimage');
      el.style.removeProperty('--pulse-x');
      el.style.removeProperty('--pulse-y');
    }, subtle ? 150 : intensity >= 7 ? 260 : 180);
  });
}

function syncDaemonStory(options) {
  const opts = options || {};
  daemonNormalizeStory(daemonStory);
  saveDaemonStory();
  syncDaemonStoryRegistry();
  syncDaemonStoryFiles();
  if (!opts.silent) refreshDaemonStoryViews();
}

function updateDaemonStory(mutator, options) {
  const before = normalizeDaemonStory(daemonStory);
  mutator(daemonStory);
  daemonNormalizeStory(daemonStory);
  if (!daemonStoryChanged(before) && !options?.forceSync) return false;
  syncDaemonStory(options);
  if (options?.glitch) triggerGlitch();
  if (options?.notice) {
    const info = typeof options.notice === 'string'
      ? { message: options.notice, title: 'Containment Notice', icon: 'icon:daemon' }
      : options.notice;
    osAlert(info.message, info.title || 'Containment Notice', info.icon || 'icon:daemon');
  }
  return true;
}

function daemonActivate(trigger) {
  return updateDaemonStory(story => {
    if (!story.openedDaemon) {
      story.openedDaemon = true;
      story.lastEventText = 'daemon.core observed';
    } else if (trigger === 'raw' && story.lastEventText === 'none') {
      story.lastEventText = 'daemon.core observed';
    }
  }, { forceSync: true });
}

function daemonRecordInvestigation(kind) {
  return updateDaemonStory(story => {
    if (kind === 'void') story.voidObserved = true;
    if (kind === 'mirror') story.mirrorInspected = true;
    if (kind === 'protocol') story.protocolInspected = true;
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  });
}

function daemonRecordVoidAction(mode) {
  return updateDaemonStory(story => {
    story.voidObserved = true;
    story.voidActions = normalizeVoidActions([...(Array.isArray(story.voidActions) ? story.voidActions : []), mode]);
    if (mode === 'observe') {
      if (story.lastEventText === 'none') story.lastEventText = 'void surface observed';
    } else if (story.stage < 6 || story.lastEventText === 'none') {
      story.lastEventText = `void probe recorded: ${mode}`;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && Number(getContainmentValue('MIRROR_LOCK')) === 1) {
      story.mirrorLockRestored = true;
      story.lastEventText = 'mirror lattice restored';
      return;
    }
    if (story.anchorDeleted && story.voidObserved && isVoidProfiled(story) && (story.mirrorInspected || story.protocolInspected) && story.stage < 6) {
      story.lastEventText = 'void channel profiled';
    }
  }, { forceSync: true });
}

function getVoidMeasureEntries(telemetry) {
  return [
    ['Containment', `${telemetry.rating.code} / ${telemetry.rating.label}`],
    ['Void Pressure', String(telemetry.pressure)],
    ['Lattice Stability', String(telemetry.lattice)],
    ['Signal Depth', String(telemetry.signalDepth)],
    ['Aperture Bias', telemetry.bias],
    ['Disk Locality', 'negative'],
  ];
}

function renderVoidReadout(out, content, telemetry) {
  if (!out) return;
  if (daemonVoidFeedMode === 'measure') {
    const cards = getVoidMeasureEntries(telemetry).map(([label, value]) => `
      <div style="border:1px solid #123512;background:#061006;padding:6px;min-width:0;">
        <div style="color:#8db98d;text-transform:uppercase;font-size:9px;letter-spacing:0.03em;margin-bottom:3px;">${escHtml(label)}</div>
        <div style="color:#b8efb8;font-size:11px;line-height:1.35;word-break:break-word;">${escHtml(value)}</div>
      </div>
    `).join('');
    out.style.whiteSpace = 'normal';
    out.style.padding = '8px';
    out.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;align-content:start;">${cards}</div>`;
    return;
  }
  out.style.whiteSpace = 'pre-wrap';
  out.style.padding = '10px';
  out.textContent = content;
}

function canDeleteAnchorSeed() {
  return Number(getContainmentValue('MIRROR_LOCK')) === 0;
}

function canAttemptDeleteItem(path, fallbackDir, meta) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  if (upperPath === 'VOID.TMP') return true;
  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) return false;
  if (meta?.sysfile) return false;
  return true;
}

async function deleteVirtualPath(path, fallbackDir) {
  const { dirName, fileName } = fsSplitPath(path, fallbackDir);
  const upperPath = ((dirName ? dirName + '\\' : '') + fileName).toUpperCase();
  const fileLabel = fileName || path;
  if (!fileName) return { ok: false, message: 'Usage: DEL <file>' };

  if (upperPath === 'VOID.TMP') {
    if (daemonStory.endingReached) return { ok: false, message: 'File not found: void.tmp' };
    if (!daemonStory.quarantineSigned) {
      return {
        ok: false,
        message: 'void.tmp refuses to go quietly.',
        details: ['A quarantine signature is required before deletion will hold.'],
      };
    }
    if (Number(getContainmentValue('MIRROR_LOCK')) !== 1) {
      return {
        ok: false,
        message: 'void.tmp remains unstable.',
        details: ['Restore HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 1 before the final delete.'],
      };
    }
    updateDaemonStory(story => {
      story.endingReached = true;
      story.lastEventText = 'containment complete';
    });
    if (wins['void']) closeWin('void');
    if (typeof setupIcons === 'function') setupIcons();
    setTimeout(playContainmentEndingReboot, 140);
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: void.tmp', 'SYS\\quarantine.sig holds.', 'Containment complete.'],
    };
  }

  if (upperPath === 'DAEMON.CORE') {
    return {
      ok: false,
      message: 'Access denied.',
      details: ['daemon.core is not removable.', 'It remains in archive even when it is no longer active.'],
    };
  }

  if (upperPath === '?????.EXE') {
    return {
      ok: false,
      message: 'The launcher refuses deletion.',
      details: ['If you need it quiet, leave it unopened.'],
    };
  }

  if (!dirName && ROOT_PROTECTED_DIRS.has(String(fileName || '').toUpperCase())) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['Core directories are protected.'],
    };
  }

  if (upperPath === STORY_FILE_PATHS.anchorSeed.toUpperCase()) {
    if (!canDeleteAnchorSeed()) {
      return {
        ok: false,
        message: 'anchor.seed will not release.',
        details: ['Lower HKEY_SLEEPBOX_MACHINE\\Containment\\MIRROR_LOCK to 0 first.'],
      };
    }
    // Must be awaited. `if (!promise)` is always false, which would kill this
    // not-found branch outright and fire the story beat below unconditionally.
    if (!await removeFsPath(STORY_FILE_PATHS.anchorSeed)) {
      return { ok: false, message: 'File not found: ' + fileLabel };
    }
    updateDaemonStory(story => {
      story.anchorDeleted = true;
      story.lastEventText = 'anchor released';
      daemonVoidFeed = 'The aperture widens. Something on the reflected side notices the room.';
      daemonVoidFeedMode = '';
    }, {
      glitch: true,
      notice: {
        title: 'Anchor Lost',
        icon: 'icon:void',
        message: 'The mirror anchor is gone.\n\nKeep daemon.core and void.tmp isolated from your active work while you inspect the breach.',
      },
    });
    return {
      ok: true,
      deleted: true,
      details: ['Deleted: anchor.seed', 'Mirror anchor released.', 'The channel is no longer deflected.'],
    };
  }

  if (isVisibleSystemPath(path, { includeExplorer: true })) {
    return {
      ok: false,
      message: `Cannot delete ${fileLabel}: Access is denied.`,
      details: ['System files are protected.'],
    };
  }

  const deleted = await recycleVirtualPath(path, fallbackDir);
  if (!deleted.ok) return deleted;
  syncDaemonStory({ silent: false });
  return deleted;
}

// Testing helper: prime the endgame state, then run the real final delete.
async function forceDeleteVoidTmp() {
  if (daemonStory.endingReached) {
    return { ok: false, message: 'void.tmp is no longer present.' };
  }
  const containment = registryData['HKEY_SLEEPBOX_MACHINE']?.['Containment'];
  if (containment?.MIRROR_LOCK) containment.MIRROR_LOCK.value = 1;
  saveRegistry();
  updateDaemonStory(story => {
    story.openedDaemon = true;
    story.falseContainmentSeen = true;
    story.daemonStopped = true;
    story.anchorDeleted = true;
    story.voidObserved = true;
    story.voidActions = VOID_ACTION_ORDER.slice();
    story.mirrorInspected = true;
    story.protocolInspected = true;
    story.mirrorLockRestored = true;
    story.quarantineSigned = true;
    story.lastEventText = 'debug skip armed';
  }, { forceSync: true });
  return await deleteVirtualPath('void.tmp');
}
window.forceDeleteVoidTmp = forceDeleteVoidTmp;

function killSoulDaemonProcess() {
  if (daemonStory.stage < 1) {
    return {
      ok: false,
      message: 'ERROR: Access is denied. (PID 512)',
      details: ['soul_svc.exe is still registered as a protected service.'],
    };
  }
  if (daemonStory.daemonStopped || daemonStory.endingReached) {
    return { ok: false, message: 'ERROR: The process with PID 512 was not found.' };
  }
  if (Number(getContainmentValue('RESPAWN_LOCK')) !== 0) {
    updateDaemonStory(story => {
      story.killedSoulDaemon = true;
      story.falseContainmentSeen = true;
      story.lastEventText = 'respawn loop observed';
    }, { glitch: true });
    return {
      ok: false,
      respawned: true,
      message: 'soul_daemon.exe terminated.',
      details: [
        'watch.pid restored the process before the table settled.',
        'RESPAWN_LOCK is still active.',
      ],
    };
  }
  updateDaemonStory(story => {
    story.killedSoulDaemon = true;
    story.falseContainmentSeen = true;
    story.respawnDisabledKill = true;
    story.daemonStopped = true;
    story.wrongVictory = true;
    story.lastEventText = 'daemon relay offline';
    daemonVoidFeed = 'The monitor goes missing. The pressure does not.';
    daemonVoidFeedMode = '';
  }, {
    glitch: true,
    notice: {
      title: 'Monitor Link Lost',
      icon: 'icon:warning',
      message: 'PID 512 stayed dead.\n\nvoid.tmp and CACHE\\mirror.dat should now be treated as active evidence.',
    },
  });
  return {
    ok: true,
    stopped: true,
    message: 'SUCCESS: soul_daemon.exe terminated.',
    details: [
      'The process does not respawn.',
      'Void pressure begins to climb in its absence.',
    ],
  };
}

syncDaemonStory({ silent: true });

