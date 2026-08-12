// One table of everything sleepOS can launch, and the resolver that finds an
// entry by name. This replaces three lists that had to be edited together and
// silently disagreed when they were not: `launchers` in apps/terminal.js, `SYS`
// in os/desktop-model.js, and the launcher half of ROOT_SYSTEM_FILE_META.
//
// Every `open` is an arrow rather than a direct function reference. The
// launchers it names (openNotepad, openDaemon, openVoid) are declared in files
// that come LATER in tools/split-manifest.json, and while a hoisted function
// declaration is safe to call later, it is not safe to reference while this
// file is still evaluating. Same reason PROJECTS and ROOT_SYSTEM_FILE_META are
// read inside function bodies: they are `const` in files that load after this
// one, and touching them at evaluation time would throw on boot.
//
// PHASE 6 SEAM: when executables become real VFS files (master spec phase 6),
// programsInDir gains a vfsListSync pass yielding entries whose `open` spawns
// the script. Nothing else here changes - programResolve, programPathDirs and
// all four terminal commands work against whatever programsInDir returns. That
// is why `open` is a closure rather than a name: a spawned .exe and a built-in
// window have to sit in the same table.

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

function programsInDir(dir) {
  const key = String(dir || '').toUpperCase();
  if (key === '') {
    const names = ROOT_SYSTEM_FILE_META.map(meta => meta.name)
      .concat(programStoryRootNames())
      .concat(['WELCOME.README', 'FILES']);
    return names.map(name => programEntry(name, '')).filter(Boolean);
  }
  if (key === 'PROJECTS') return PROJECTS.map(programProjectEntry);
  return [];
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
