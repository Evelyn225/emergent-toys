// One table of everything sleepOS can launch, and the resolver that finds an
// entry by name. This replaces the three lists the original spec inventoried
// that had to be edited together and silently disagreed when they were not:
// `launchers` in apps/terminal.js, `SYS` in os/desktop-model.js, and the
// launcher half of ROOT_SYSTEM_FILE_META.
//
// It does NOT replace every hand-maintained name -> launcher map in the
// codebase - two more are still live, and adding an entry here today is
// invisible to both of them:
//   - os/run-dialog.js's RUN_MAP (the Run... dialog)
//   - os/script/interp.js's scriptOpenSystemProgram map (reached by a
//     .script file's START/OPEN, and by a spawned worker's ui.openSystem
//     syscall)
// A PROGRAM_LAUNCHERS entry with no matching RUN_MAP/scriptOpenSystemProgram
// entry launches fine from the desktop and the terminal's own START, but Run...
// reports "Cannot find program" and a script's START/OPEN falls through to
// openSystemFile instead of running it. Folding those two in is known
// follow-up work, not done here.
//
// Every `open` is an arrow rather than a direct function reference. The
// launchers it names (openNotepad, openDaemon, openVoid) are declared in files
// that come LATER in tools/split-manifest.json, and while a hoisted function
// declaration is safe to call later, it is not safe to reference while this
// file is still evaluating.
//
// PROJECTS and ROOT_SYSTEM_FILE_META are read inside function bodies too, but
// not for the same reason as each other, and not for the reason once claimed
// here. Per tools/split-manifest.json, os/desktop-model.js (PROJECTS) is
// manifest position 6 and this file, os/programs.js, is position 7 - PROJECTS
// loads BEFORE PROGRAM_LAUNCHERS, not after, so referencing it at evaluation
// time would already be safe. It is read lazily inside programProjectEntry
// anyway, purely so every registry-consuming function shares the same
// lazy-read shape. ROOT_SYSTEM_FILE_META is the one where lazy reading is
// load-bearing: it is `const` in os/daemon.js, manifest position 13, which
// genuinely loads after this file, so touching it at evaluation time (rather
// than inside programsInDir, which only runs once the OS is up) would throw
// on boot.
//
// PHASE 6 SEAM: when executables become real VFS files (master spec phase 6),
// programsInDir gains a vfsListSync pass yielding entries whose `open` spawns
// the script. programResolve, programPathDirs and all four terminal commands
// work against whatever programsInDir returns, so none of them need touching.
// That is why `open` is a closure rather than a name: a spawned .exe and a
// built-in window have to sit in the same table.
//
// ONE CONSUMER IS NOT COVERED BY THAT SENTENCE. openSystemFile
// (os/desktop-model.js) also reads programsInDir(''). The vfsListSync pass
// above already filters VFS entries to `kind === 'text' && /\.exe$/i` before
// they ever reach programsInDir, so that call site cannot actually be handed
// a non-executable entry today. It still filters with programIsExecutableEntry
// below, same as this file's own consumers do, purely as defence in depth:
// its failure mode is silent (Explorer's double-click ignores the return
// value, so a bad `true` would just quietly do nothing useful; the
// terminal's OPEN would report success for a file it did not open), and a
// future entry source added to programsInDir that skips its own
// executability filter would make this guard load-bearing again.

// Keyed by uppercase name. ROOT_SYSTEM_FILE_META stays the source of which
// programs exist at the root and of their DIR display metadata; this is the
// source of what launching one DOES.
const PROGRAM_LAUNCHERS = {
  'TERMINAL.EXE': {
    lines: ['Starting TERMINAL.exe...'],
    open: () => openTerminal(),
    // Printed instead of launching when the TERMINAL is the thing resolving
    // it. Data rather than a branch in the terminal, so the one table still
    // describes the whole behaviour of every program.
    selfLines: ['TERMINAL.exe is already running.', 'You are inside it.'],
  },
  'NOTEPAD.EXE':  { lines: ['Opening Notepad...'],        open: ctx => openNotepad(undefined, ctx.cwd) },
  'EXPLORER.EXE': { lines: ['Opening File Explorer...'],  open: ctx => openExplorer(ctx.cwd || '') },
  'SYSMON.EXE':   { lines: ['Starting SYSMON.exe...'],    open: () => openSysmon() },
  'BROWSER.EXE':  { lines: ['Starting BROWSER.exe...'],   open: () => openBrowser() },
  'DEFRAG.EXE':   { lines: ['Starting DEFRAG.exe...'],    open: () => openDefrag() },
  'CALC.EXE':     { lines: ['Starting CALC.exe...'],      open: () => openCalculator() },
  'REGEDIT.EXE':  { lines: ['Starting REGEDIT.exe...'],   open: () => openRegedit() },
  'VOID.TMP':     { lines: ['Opening void.tmp...'],       open: () => openVoid() },
  '?????.EXE':    { lines: ['Executing ?????.exe...'],    open: () => openUnknown(), aliases: ['?????'] },
  'DAEMON.CORE':  {
    lines: ['Opening daemon.core...'],
    open: () => openDaemon(),
    // The daemon gets a longer beat before its window appears. This was the
    // only entry in the old `launchers` map with a delay of its own and it is
    // a deliberate story beat, not a rounding error.
    delay: 320,
  },
  'WELCOME.README': { lines: ['Opening WELCOME.README...'], open: () => openWelcome(), aliases: ['welcome'] },
  // Launchable but deliberately not in ROOT_SYSTEM_FILE_META, so DIR does not
  // list them. Both were reachable from the old `launchers`/`SYS` maps and
  // stay reachable; neither has ever been a file.
  //
  // FILES specifically is programsInDir('')'s thirteenth root entry - it is
  // appended alongside WELCOME.README in the '' branch below even though it
  // has no ROOT_SYSTEM_FILE_META row and DIR never lists it, preserving what
  // the old `launchers.files` entry did. That means `WHERE files` resolves
  // and prints a C:\sleepOS\FILES path that does not exist as a file; this
  // is the same launchable-but-not-a-file behaviour as WELCOME.README's
  // aliasing, just undeclared until now.
  'FILES': { lines: ['Opening Files...'], open: () => openFiles() },
};

// Story files exist at the root without being in ROOT_SYSTEM_FILE_META, and
// their visibility depends on story state, so the list is rebuilt per call
// rather than captured. Same reason isSystemPath is a live syscall instead of
// a spawn-time snapshot.
function programStoryRootNames() {
  const names = [];
  if (!daemonStory.endingReached) names.push('void.tmp');
  names.push('daemon.core', '?????.exe');
  return names;
}

function programEntry(name, dir) {
  const spec = PROGRAM_LAUNCHERS[String(name).toUpperCase()];
  if (!spec) return null;
  return {
    name,
    dir,
    lines: spec.lines || [],
    delay: spec.delay === undefined ? 300 : spec.delay,
    open: spec.open,
    aliases: spec.aliases || [],
    selfLines: spec.selfLines || null,
  };
}

function programProjectEntry(project) {
  return {
    name: project.name,
    dir: 'PROJECTS',
    lines: ['Launching ' + project.name + '...', 'Opening in new tab.'],
    delay: 400,
    open: () => window.open(project.file, '_blank'),
    // The four forms findTerminalProject accepted before this module existed.
    // Dropping any of them would break START commands players already type.
    aliases: [
      project.file,
      project.file.replace(/\.html$/i, ''),
      project.name.replace(/ /g, '-'),
    ],
    selfLines: null,
  };
}

// The discriminator the whole .exe path turns on. A system binary is
// precisely one whose launch opens a built-in window, and PROGRAM_LAUNCHERS
// is the table that records exactly that - so this is the definition, not a
// heuristic standing in for one.
//
// Declared with `function` on purpose: the vm test harness only exposes
// function declarations, and PROGRAM_LAUNCHERS is a const. Callers outside
// this file (apps/notepad.js, apps/terminal.js) go through here rather than
// reaching for the table.
function programIsSystemBinary(name) {
  const key = String(name || '').trim().toUpperCase();
  if (!key) return false;
  if (PROGRAM_LAUNCHERS[key]) return true;
  if (PROGRAM_LAUNCHERS[key + '.EXE']) return true;
  return Object.keys(PROGRAM_LAUNCHERS).some(k => {
    const spec = PROGRAM_LAUNCHERS[k];
    return (spec.aliases || []).some(a => String(a).toUpperCase() === key);
  });
}

// An entry is executable when it can actually be launched. Used by
// os/desktop-model.js's openSystemFile, which previously treated everything
// programsInDir returned as GUI-launchable - see the hazard note above.
function programIsExecutableEntry(entry) {
  return !!(entry && typeof entry.open === 'function');
}

// A double-click (Explorer's openItem, the desktop's
// openDesktopShortcutTarget) spawns a `.exe` instead of opening it in
// Notepad, UNLESS it is one of the eight system binaries - those still route
// to Notepad, which sends them on to the decompiler view via
// notepadRouteFor. Both call sites need the exact same test, so it lives
// here once rather than as two inline copies that could drift.
//
// Declared with `function` for the same reason as programIsSystemBinary
// above: the vm test harness only exposes function declarations.
function programIsSpawnableExe(name) {
  return /\.exe$/i.test(String(name || '')) && !programIsSystemBinary(name);
}

// Every real launch of a user .exe - the terminal running one off
// programsInDir (below), Explorer's double-click, the desktop's shortcut
// target - goes through this, so a failed spawn always surfaces the same
// way instead of three near-identical copies of the same .catch drifting
// apart. `dir` is the SEARCH directory for kernelSpawn's bare-filename
// lookup, always wherever the file actually lives (never a caller's cwd if
// that differs - see the callers below for why that distinction matters).
//
// The caller discards this promise (`void programSpawnOrAlert(...)`),
// which is exactly why the .catch has to live in here: without it, a file
// that vanished between listing and launch - deleted, renamed, recycled -
// would throw ENOENT as a silent unhandled rejection. Double-click and
// nothing happens, no error, no explanation.
//
// `sinks` (optional) is {onStdout, onStderr} - kernelSpawn's own contract,
// passed straight through. Explorer's double-click and the desktop's
// shortcut target have no window for a spawned process's output to land in,
// so both omit it and get kernelExit's ordinary post-exit buffering; the
// terminal is the one caller with somewhere for stdout to go, and supplies
// it (see programVfsEntry.open below and launchTerminalTarget in
// apps/terminal.js). Never invent a sink here for the GUI callers - a fake
// sink would silently swallow output nobody is displaying, indistinguishable
// from stdout actually reaching a window.
function programSpawnOrAlert(name, dir, sinks) {
  return kernelSpawn(name, [], Object.assign({ cwd: dir, parentPid: KERNEL_PID }, sinks))
    .catch(err => {
      // osAlert is os/ui-chrome.js:230, the established convention for this
      // exact failure class - os/run-dialog.js:62 uses it for "Cannot Find
      // Program". It is a standalone modal, so it needs no process or
      // stderr sink. This file is manifest position 10 and ui-chrome.js is
      // 24, but the bundle is one hoisted scope and every caller of this
      // function only runs long after boot, so the reference resolves.
      //
      // The typeof guard is for the node test harness, where a context may
      // load os/programs.js without os/ui-chrome.js.
      const detail = (err && err.message) || String(err);
      if (typeof osAlert === 'function') {
        osAlert('Cannot run:\n"' + name + '"\n\n' + detail, 'Cannot Run Program', 'icon:error');
      } else {
        console.error('sleepOS: failed to spawn ' + name + ' - ' + detail);
      }
    });
}

// A .exe text file in the VFS, presented the same way a built-in is. `open`
// spawns it, which is why the seam comment insists `open` be a closure.
function programVfsEntry(stat) {
  return {
    name: stat.name,
    dir: stat.dirName,
    lines: ['Starting ' + stat.name + '...'],
    delay: 300,
    // stat.dirName, never the caller's cwd - see programSpawnOrAlert. The
    // caller here is apps/terminal.js's procSetTimeout, which is why this
    // needed the .catch in the first place before it moved into the shared
    // helper.
    //
    // `ctx` is the same object every PROGRAM_LAUNCHERS `open` receives
    // (`{ cwd, sinks }` - see launchTerminalTarget in apps/terminal.js); a
    // built-in's own `open` just ignores `ctx.sinks` since it has no
    // subprocess stdout to bind. `ctx` itself can be omitted entirely (every
    // GUI double-click calls `.open()` with no argument at all), hence the
    // guard rather than destructuring it directly.
    open: (ctx) => programSpawnOrAlert(stat.name, stat.dirName, ctx && ctx.sinks),
    aliases: [],
  };
}

// Executables in `dir` that are not already built-ins. The built-in wins on a
// name collision: a user file called CALC.exe must not shadow the real
// calculator, and appearing twice would be worse than either.
function programVfsExecutables(dir, taken) {
  if (typeof vfsListSync !== 'function') return [];
  return vfsListSync(dir)
    .filter(e => e.kind === 'text' && /\.exe$/i.test(e.name))
    .filter(e => !taken.has(e.name.toUpperCase()))
    .map(programVfsEntry);
}

function programsInDir(dir) {
  const key = String(dir || '').toUpperCase();
  if (key === 'PROJECTS') return PROJECTS.map(programProjectEntry);
  let builtIns = [];
  if (key === '') {
    const names = ROOT_SYSTEM_FILE_META.map(meta => meta.name)
      .concat(programStoryRootNames())
      .concat(['WELCOME.README', 'FILES']);
    builtIns = names.map(name => programEntry(name, '')).filter(Boolean);
  }
  // Matches on literal name only, not on aliases - a VFS file named
  // WELCOME.exe would not collide with the WELCOME.README entry's 'welcome'
  // alias here. Currently unexploitable: WELCOME.README loses on collision
  // anyway because built-ins are concatenated first, and ?????.exe is both
  // the literal name and the alias, never divergent. Worth another look only
  // if a future built-in's alias itself ends in .exe.
  const taken = new Set(builtIns.map(e => e.name.toUpperCase()));
  return builtIns.concat(programVfsExecutables(key, taken));
}

// Delegates to vfsNormalizeDir rather than parsing paths itself: its prefix
// regex is anchored /^C:\\sleepOS(?:\\|$)/i, so it already maps 'C:\sleepOS'
// to '' and 'C:\sleepOS\PROJECTS' to 'PROJECTS', and reusing it means PATH
// cannot drift from how every other path in the VFS is read.
//
// Empties are dropped BEFORE normalizing, and that ordering is load-bearing:
// vfsNormalizeDir('') returns '', which IS the root, so a trailing semicolon
// in `SET PATH=C:\sleepOS\DOCS;` would splice the root back onto PATH and
// leave every root program resolvable from everywhere - the feature looking
// broken in exactly the case someone is testing it.
function programPathDirs(pathValue) {
  const seen = new Set();
  const dirs = [];
  String(pathValue == null ? '' : pathValue).split(';').forEach(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const dir = vfsNormalizeDir(trimmed);
    if (seen.has(dir)) return;
    seen.add(dir);
    dirs.push(dir);
  });
  return dirs;
}

function programMatches(entry, key) {
  if (entry.name.toLowerCase() === key) return true;
  if (entry.name.toLowerCase() === key + '.exe') return true;
  return entry.aliases.some(alias => String(alias).toLowerCase() === key);
}

function programFindIn(dir, key) {
  return programsInDir(dir).find(entry => programMatches(entry, key)) || null;
}

// cmd.exe order: the current directory first, then PATH. Not a fidelity
// flourish - it is what keeps a cleared PATH from putting daemon.core and
// ?????.exe permanently out of reach in a persisted filesystem, since both
// live at the root and the root is where a player stands.
function programResolve(name, cwd, pathValue) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const cwdDir = vfsNormalizeDir(cwd || '');
  const inCwd = programFindIn(cwdDir, key);
  if (inCwd) return { program: inCwd, dir: cwdDir, via: 'cwd' };
  const dirs = programPathDirs(pathValue);
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i] === cwdDir) continue; // already searched
    const hit = programFindIn(dirs[i], key);
    if (hit) return { program: hit, dir: dirs[i], via: 'path' };
  }
  return null;
}

// PATH-ignoring lookup. Its only caller is the terminal's failure path, which
// turns a miss into "X exists in C:\sleepOS, which is not on PATH." Without
// that line a player who breaks PATH concludes the OS is broken rather than
// that they broke it, which is why programResolve returns null instead of
// throwing: the caller needs a second look to explain the first.
function programFindAnywhere(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const dirs = ['', 'PROJECTS'];
  for (let i = 0; i < dirs.length; i++) {
    const hit = programFindIn(dirs[i], key);
    if (hit) return { program: hit, dir: dirs[i] };
  }
  return null;
}

function programDisplayDir(dir) {
  const key = vfsNormalizeDir(dir || '');
  return key ? 'C:\\sleepOS\\' + key : 'C:\\sleepOS';
}
