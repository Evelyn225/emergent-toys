'use strict';
// isVisibleSystemPath (os/daemon.js) used to split its path with NO
// fallbackDir, while two callers - deleteVirtualPath (os/daemon.js) and the
// terminal's OPEN command (apps/terminal.js) - split that SAME path WITH a
// fallbackDir one or two lines earlier. From cwd DOCS, `DEL TERMINAL.exe`
// means DOCS\TERMINAL.exe (an ordinary player-authored file, now that
// phase 6 lets people write .exe scripts), but the guard split the bare
// name with no fallback, decided it was the root system binary, and denied
// the delete - over-blocking. The terminal's `OPEN TERMINAL.exe` had the
// identical mismatch: it would launch the SYSTEM binary instead of opening
// DOCS\TERMINAL.exe.
//
// The fix gives isVisibleSystemPath an OPTIONAL third `fallbackDir`
// parameter, passed through to fsSplitPath. Omitted, it behaves exactly as
// before - which is what the two callers with no cwd to give
// (_kernelUiIsSystemPath in os/kernel.js, and the interpreter's fs adapter
// isSystemPath in os/script/interp.js) still do, and must keep doing: they
// are "is this a root system path" QUERIES with no operation attached, and
// under-blocking there (letting a player delete or shadow a real system
// binary) would be far worse than the over-blocking bug this fixes. This
// file never touches either of those call sites; it only exercises the two
// that now pass fallbackDir through.
//
// isVisibleSystemPath, getRootSystemFiles, isVisibleRootSystemFile and
// deleteVirtualPath are extracted verbatim out of os/daemon.js with
// extractFunctionSource - the same trick test/protected-system-binaries.
// test.cjs uses for terminalProtectedWriteError/writePipelineOutput - so
// this drives the REAL, unmodified guard and delete logic, not a
// reimplementation that could silently drift from it. os/daemon.js cannot
// be loaded whole in this harness (see test/daemon-corruption.test.cjs's
// header comment - it drags in the whole story and the DOM it renders
// into), so extraction is the only way to reach it under test.
//
// The terminal's OPEN command is an anonymous arrow function assigned to an
// object property (`open: (args) => {...}`), which extractFunctionSource's
// `function name(` regex cannot match. extractOpenCmdSource below does the
// same brace-matching extraction for that one shape, local to this file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

const DAEMON_SRC = fs.readFileSync(path.join(__dirname, '..', 'os', 'daemon.js'), 'utf8');
const TERMINAL_SRC = fs.readFileSync(path.join(__dirname, '..', 'apps', 'terminal.js'), 'utf8');

const ROOT_SYSTEM_FILE_META = [
  { name: 'TERMINAL.exe' },
  { name: 'CALC.exe' },
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

// Same brace-matching approach as extractFunctionSource, but for a
// `key: (params) => { ... }` object-literal method instead of a `function
// name(...)` declaration - the only shape CMDS.open is written in.
function extractOpenCmdSource(src) {
  const marker = /\bopen\s*:\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/;
  const match = marker.exec(src);
  assert.notStrictEqual(match, null, 'open: (...) => {...} not found in apps/terminal.js');
  const braceStart = src.indexOf('{', match.index);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert.notStrictEqual(end, -1, 'never found the closing brace for CMDS.open');
  const body = src.slice(braceStart, end);
  return 'function terminalOpenCmd(' + match[1] + ') ' + body;
}

// ── isVisibleSystemPath, in isolation ───────────────────────────────────

function guardCtx(overrides) {
  const ctx = makeOsContext(Object.assign({
    ROOT_SYSTEM_FILE_META,
    daemonStory: { endingReached: false },
  }, overrides));
  loadOsSources(ctx, ['os/vfs.js']);
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'getRootSystemFiles'), 'daemon-slice-getRootSystemFiles');
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'isVisibleRootSystemFile'), 'daemon-slice-isVisibleRootSystemFile');
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'isVisibleSystemPath'), 'daemon-slice-isVisibleSystemPath');
  // fsSplitPath (os/fs-core.js) is a one-line wrapper around vfsSplitPath -
  // real behavior, without dragging in the rest of os/fs-core.js.
  ctx.__evalSource('globalThis.fsSplitPath = vfsSplitPath;');
  return ctx;
}

test('isVisibleSystemPath with no third argument behaves exactly as before (root-only)', () => {
  const ctx = guardCtx();
  assert.strictEqual(ctx.isVisibleSystemPath('TERMINAL.exe', { includeExplorer: true }), true,
    'a bare name with no fallbackDir must still resolve to the root binary');
  assert.strictEqual(ctx.isVisibleSystemPath('DOCS\\TERMINAL.exe', { includeExplorer: true }), false,
    'an explicit subdirectory path must still be unaffected');
});

test('a bare name resolves against the passed fallbackDir, not root', () => {
  const ctx = guardCtx();
  assert.strictEqual(ctx.isVisibleSystemPath('TERMINAL.exe', { includeExplorer: true }, 'DOCS'), false,
    'TERMINAL.exe with fallbackDir DOCS is DOCS\\TERMINAL.exe, not the root binary');
});

test('a bare name at the true root is still blocked with an explicit empty fallbackDir', () => {
  const ctx = guardCtx();
  assert.strictEqual(ctx.isVisibleSystemPath('TERMINAL.exe', { includeExplorer: true }, ''), true);
});

test('an explicit DOCS\\TERMINAL.exe is allowed regardless of fallbackDir', () => {
  const ctx = guardCtx();
  assert.strictEqual(ctx.isVisibleSystemPath('DOCS\\TERMINAL.exe', { includeExplorer: true }, 'SYS'), false,
    'the path is already fully qualified - a fallbackDir must not override it');
});

test('C:\\sleepOS\\TERMINAL.exe is still denied', () => {
  const ctx = guardCtx();
  assert.strictEqual(ctx.isVisibleSystemPath('C:\\sleepOS\\TERMINAL.exe', { includeExplorer: true }), true);
  // vfsSplitPath's drive-prefix strip (os/vfs.js) turns a fully-qualified
  // `C:\sleepOS\...` path into a bare name before it ever reaches dirName
  // resolution - a pre-existing quirk, unrelated to and unchanged by this
  // fix - so it still picks up an explicit fallbackDir the same way a truly
  // bare name does. That is not a new mismatch: deleteVirtualPath's own
  // top-of-function fsSplitPath call resolves the SAME path the SAME way,
  // so the guard and the operation still agree. With no fallbackDir (the
  // realistic case for a fully-qualified path, e.g. typed from the root),
  // it stays blocked.
  assert.strictEqual(ctx.isVisibleSystemPath('C:\\sleepOS\\TERMINAL.exe', { includeExplorer: true }, ''), true);
});

test('the story pseudo-files stay protected at the root, with or without a fallbackDir', () => {
  const ctx = guardCtx({ daemonStory: { endingReached: false } });
  for (const name of ['void.tmp', 'daemon.core', '?????.exe']) {
    assert.strictEqual(ctx.isVisibleSystemPath(name, {}), true, name + ' (no fallbackDir)');
    assert.strictEqual(ctx.isVisibleSystemPath(name, {}, 'DOCS'), false,
      name + ' inside DOCS is a different, legitimate file');
  }
});

// ── deleteVirtualPath, the real DEL guard ───────────────────────────────

function deleteCtx(overrides) {
  const calls = { recycle: [], sync: 0 };
  const ctx = guardCtx(Object.assign({
    ROOT_PROTECTED_DIRS,
    STORY_FILE_PATHS,
    recycleVirtualPath: async (p, dir) => {
      calls.recycle.push([p, dir]);
      return { ok: true, deleted: true, details: ['Deleted: ' + p] };
    },
    syncDaemonStory: () => { calls.sync++; },
  }, overrides));
  ctx.__evalSource(extractFunctionSource(DAEMON_SRC, 'deleteVirtualPath'), 'daemon-slice-deleteVirtualPath');
  return { ctx, calls };
}

test('DEL TERMINAL.exe from cwd DOCS is allowed - it means DOCS\\TERMINAL.exe', async () => {
  const { ctx, calls } = deleteCtx();
  const result = await ctx.deleteVirtualPath('TERMINAL.exe', 'DOCS');
  assert.strictEqual(result.ok, true, 'expected the delete to proceed, got: ' + JSON.stringify(result));
  assert.deepStrictEqual(calls.recycle, [['TERMINAL.exe', 'DOCS']],
    'recycleVirtualPath must be called with the same path/fallbackDir the guard checked');
});

test('DEL TERMINAL.exe from the root is still denied', async () => {
  const { ctx, calls } = deleteCtx();
  const result = await ctx.deleteVirtualPath('TERMINAL.exe', '');
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /Access is denied/);
  assert.deepStrictEqual(calls.recycle, [], 'the guard must have refused before reaching recycleVirtualPath');
});

test('an explicit DOCS\\TERMINAL.exe is allowed', async () => {
  const { ctx, calls } = deleteCtx();
  const result = await ctx.deleteVirtualPath('DOCS\\TERMINAL.exe', '');
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(calls.recycle, [['DOCS\\TERMINAL.exe', '']]);
});

test('an explicit C:\\sleepOS\\TERMINAL.exe is still denied', async () => {
  const { ctx, calls } = deleteCtx();
  // '' (root), not 'DOCS': see the comment on the isVisibleSystemPath
  // version of this test above - a fully-qualified path picking up an
  // explicit fallbackDir is a pre-existing vfsSplitPath quirk unrelated to
  // this fix, and the guard and deleteVirtualPath's own resolution still
  // agree about it either way.
  const result = await ctx.deleteVirtualPath('C:\\sleepOS\\TERMINAL.exe', '');
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /Access is denied/);
  assert.deepStrictEqual(calls.recycle, []);
});

test('the story pseudo-files are still protected at the true root', async () => {
  const { ctx, calls } = deleteCtx({ daemonStory: { endingReached: false } });
  const daemonCore = await ctx.deleteVirtualPath('daemon.core', '');
  assert.strictEqual(daemonCore.ok, false);
  assert.match(daemonCore.message, /Access denied/);

  const launcher = await ctx.deleteVirtualPath('?????.exe', '');
  assert.strictEqual(launcher.ok, false);
  assert.match(launcher.message, /refuses deletion/);

  assert.deepStrictEqual(calls.recycle, []);
});

// void.tmp, daemon.core and ?????.exe are STORY PSEUDO-FILES: they are not
// real VFS entries anywhere, even at root (getTerminalRootSystemEntries
// fabricates them for DIR; they have no backing vfsStatSync result). The
// only thing that makes deleteVirtualPath treat a target as one of them is
// its upperPath matching the bare name with an EMPTY dirName - exactly the
// same root-only scoping isVisibleSystemPath now applies. A bare
// "daemon.core" typed from cwd DOCS resolves, like DOCS\TERMINAL.exe, to a
// different path (DOCS\daemon.core) - which is not a protected pseudo-file,
// it is whatever ordinary file (if any) the player put there - so it must
// fall through the pseudo-file branches into the same guard/delete path an
// ordinary file takes, not be silently treated as the protected root file.
test('a bare pseudo-file name from cwd DOCS is scoped to DOCS, same as TERMINAL.exe', async () => {
  const { ctx, calls } = deleteCtx({ daemonStory: { endingReached: false } });
  const daemonCore = await ctx.deleteVirtualPath('daemon.core', 'DOCS');
  assert.notStrictEqual(daemonCore.message, 'Access denied.',
    'must not be treated as the root daemon.core pseudo-file');
  const launcher = await ctx.deleteVirtualPath('?????.exe', 'DOCS');
  assert.notStrictEqual(launcher.message, 'The launcher refuses deletion.',
    'must not be treated as the root ?????.exe pseudo-file');
  assert.deepStrictEqual(calls.recycle, [['daemon.core', 'DOCS'], ['?????.exe', 'DOCS']],
    'both must reach the ordinary delete path with the same path/fallbackDir the guard checked');
});

// ── the terminal's OPEN command ──────────────────────────────────────────

function openCtx(overrides) {
  const calls = { openSystemFile: [], openNotepad: [], openMediaFile: [], print: [] };
  const ctx = guardCtx(Object.assign({
    cwd: '',
    print: (line) => calls.print.push(line),
    // The real procSetTimeout schedules through the kernel's process timer;
    // firing the callback synchronously here just removes an unrelated
    // async indirection from what this test needs to observe.
    procSetTimeout: (procName, fn) => fn(),
    openSystemFile: (name) => { calls.openSystemFile.push(name); },
    openMediaFile: (raw, cwd) => { calls.openMediaFile.push([raw, cwd]); },
    openNotepad: (raw, cwd) => { calls.openNotepad.push([raw, cwd]); },
  }, overrides));
  ctx.__evalSource(extractOpenCmdSource(TERMINAL_SRC), 'terminal-slice-open');
  return { ctx, calls };
}

function docsTreeWithTerminalExe() {
  return {
    dirs: new Set(['DOCS']),
    files: new Map(),
    blobs: new Map(),
    subdirs: new Map([
      ['DOCS', {
        dirs: new Set(),
        files: new Map([['TERMINAL.exe', 'echo hi']]),
        blobs: new Map(),
        subdirs: new Map(),
      }],
    ]),
  };
}

test('OPEN TERMINAL.exe from cwd DOCS opens DOCS\\TERMINAL.exe, not the system binary', () => {
  const { ctx, calls } = openCtx({ cwd: 'DOCS' });
  ctx.vfsSetTree(docsTreeWithTerminalExe());
  ctx.terminalOpenCmd('TERMINAL.exe');
  assert.deepStrictEqual(calls.openSystemFile, [],
    'the system launcher must not fire for a player-authored DOCS\\TERMINAL.exe');
  assert.deepStrictEqual(calls.openNotepad, [['TERMINAL.exe', 'DOCS']]);
});

test('OPEN TERMINAL.exe from the root still launches the system binary', () => {
  const { ctx, calls } = openCtx({ cwd: '' });
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  ctx.terminalOpenCmd('TERMINAL.exe');
  assert.deepStrictEqual(calls.openSystemFile, ['TERMINAL.exe']);
  assert.deepStrictEqual(calls.openNotepad, []);
});
