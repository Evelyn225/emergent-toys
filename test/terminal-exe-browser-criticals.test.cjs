'use strict';
// Regression coverage for two Criticals task 12's browser verification found,
// both invisible to the rest of the suite because every existing exe test
// happened to pass the real-cased filename straight through.
//
// B1: `HELLO.exe | grep GREET > out.txt` failed with "Piping not supported
// for command: HELLO.EXE". getCommandParts (apps/terminal.js) lowercases
// every pipeline stage's command before terminalIsExecutableStage ever sees
// it, and the VFS `files` Map is keyed by the real, case-preserved filename
// with a case-sensitive lookup - so a stat on the lowercased command alone
// could never find HELLO.exe. Explorer's double-click never hit this because
// it hands over the exact filename from its own listing, never a lowercased
// command - which is exactly why every double-click test kept passing while
// the master spec's headline command failed.
//
// B2: bare `HELLO.exe` printed "Starting HELLO.exe..." and then nothing,
// ever - `spawn HELLO.exe` printed the pid and all four lines. Bare-name
// execution goes through launchTerminalTarget -> program.open() ->
// programSpawnOrAlert, which passed no onStdout/onStderr sinks to
// kernelSpawn, so a real process's output only ever reached kernelExit's
// post-exit buffer with nothing to print it.
//
// Both functions under test are extracted verbatim out of their
// openTerminal() closure with extractFunctionSource - the same trick
// test/protected-system-binaries.test.cjs uses for
// terminalProtectedWriteError/writePipelineOutput - so these tests drive the
// REAL, unmodified terminal code rather than a reimplementation that could
// silently drift from it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { makeOsContext, loadOsSources, extractFunctionSource } = require('./helpers/load-os.cjs');

const TERMINAL_SRC = fs.readFileSync(path.join(__dirname, '..', 'apps', 'terminal.js'), 'utf8');

function programsWithFiles(ctx, files) {
  ctx.vfsSetTree({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() });
  const tree = ctx.vfsGetTree();
  Object.entries(files || {}).forEach(([name, text]) => tree.files.set(name, text));
  return ctx;
}

// ── B1: terminalIsExecutableStage must resolve a lowercased command ────────

function stageCtx(files) {
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    // terminalIsExecutableStage's only other free variable besides the
    // loaded programs.js functions - the terminal process's own PATH.
    shellVars: { PATH: 'C:\\sleepOS' },
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
  ctx.__evalSource(extractFunctionSource(TERMINAL_SRC, 'terminalIsExecutableStage'), 'terminal-slice-stage');
  return programsWithFiles(ctx, files);
}

test('B1: a pipe stage lowercased by getCommandParts still resolves a real-cased .exe', () => {
  const ctx = stageCtx({ 'HELLO.exe': 'PRINT hi' });
  // 'hello.exe' - exactly what getCommandParts.cmd would be for a stage
  // typed as HELLO.exe, Hello.exe, or hello.EXE. Against the pre-fix
  // implementation (a bare vfsStatSync('hello.exe', dir)) this returns null,
  // because the VFS map only has the key 'HELLO.exe'.
  const hit = ctx.terminalIsExecutableStage('hello.exe', '');
  assert.ok(hit, 'a lowercased command must still resolve the real-cased file');
  assert.strictEqual(hit.program.name, 'HELLO.exe', 'must hand back the REAL filename, not the lowercased one');
  assert.strictEqual(hit.dir, '', 'must hand back the directory the file actually lives in');
});

test('B1: a lowercased pipe stage also resolves via PATH, the same way a bare command does', () => {
  const ctx = stageCtx({});
  ctx.shellVars.PATH = 'C:\\sleepOS;C:\\sleepOS\\DOCS';
  ctx.vfsGetTree().dirs.add('DOCS');
  const docs = { dirs: new Set(), files: new Map([['RUNAWAY.exe', ':l\nGOTO l']]), blobs: new Map(), subdirs: new Map() };
  ctx.vfsGetTree().subdirs.set('DOCS', docs);
  const hit = ctx.terminalIsExecutableStage('runaway.exe', '');
  assert.ok(hit, 'PATH should be searched exactly as launchTerminalTarget searches it');
  assert.strictEqual(hit.program.name, 'RUNAWAY.exe');
  assert.strictEqual(hit.dir, 'DOCS');
});

test('B1: a system binary is still excluded, case and all - it is not a pipe-spawnable stage', () => {
  const ctx = stageCtx({ 'CALC.exe': 'binary bytes here' });
  assert.strictEqual(ctx.terminalIsExecutableStage('calc.exe', ''), null);
  assert.strictEqual(ctx.terminalIsExecutableStage('CALC.exe', ''), null);
});

test('B1: a non-.exe name is never a pipe stage', () => {
  const ctx = stageCtx({ 'notes.txt': 'hello' });
  assert.strictEqual(ctx.terminalIsExecutableStage('notes.txt', ''), null);
});

test('B1: an unresolvable .exe name yields no stage', () => {
  const ctx = stageCtx({});
  assert.strictEqual(ctx.terminalIsExecutableStage('nosuch.exe', ''), null);
});

// ── B2: bare-name execution must bind kernelSpawn's sinks to the terminal ──

function launchCtx(files, kernelSpawnImpl) {
  const printed = [];
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    KERNEL_PID: 1,
    cwd: '',
    shellVars: { PATH: 'C:\\sleepOS' },
    resolveShellText: t => String(t == null ? '' : t),
    print: (text) => printed.push(text),
    // Same shape as CMDS.spawn/pipelineSpawnStage's driver: runs the
    // callback inline rather than actually deferring, so the test does not
    // need fake timers.
    procSetTimeout: (winId, fn) => fn(),
    kernelSpawn: kernelSpawnImpl,
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
  ctx.__evalSource(extractFunctionSource(TERMINAL_SRC, 'launchTerminalTarget'), 'terminal-slice-launch');
  programsWithFiles(ctx, files);
  return { ctx, printed };
}

test('B2: bare-name execution wires real onStdout/onStderr sinks to kernelSpawn, not none', () => {
  let capturedOpts = null;
  const { ctx } = launchCtx({ 'HELLO.exe': 'PRINT hi' }, (name, argv, opts) => {
    capturedOpts = opts;
    return Promise.resolve(2003);
  });
  const ok = ctx.launchTerminalTarget('HELLO.exe');
  assert.strictEqual(ok, true);
  assert.ok(capturedOpts, 'kernelSpawn was never called');
  assert.strictEqual(typeof capturedOpts.onStdout, 'function', 'no onStdout sink reached kernelSpawn - this is exactly what left B2 silent');
  assert.strictEqual(typeof capturedOpts.onStderr, 'function', 'no onStderr sink reached kernelSpawn');
});

test('B2: a line pushed through the sink kernelSpawn was given actually reaches the terminal print, not just an unused callback', () => {
  let capturedOpts = null;
  const { ctx, printed } = launchCtx({ 'HELLO.exe': 'PRINT hi' }, (name, argv, opts) => {
    capturedOpts = opts;
    return Promise.resolve(2003);
  });
  ctx.launchTerminalTarget('HELLO.exe');
  // Simulate the worker's stdout arriving, the way a real kernelSpawn would
  // drive it - this is the step "kernelSpawn was called" alone cannot prove:
  // a sink object can be passed through and still go nowhere if it isn't
  // the terminal's own print.
  capturedOpts.onStdout('GREET: hello, operator');
  capturedOpts.onStderr('NOTE: DOCS\\README.txt is present');
  assert.ok(printed.includes('GREET: hello, operator'), 'stdout line never reached the terminal print sink');
  assert.ok(printed.includes('NOTE: DOCS\\README.txt is present'), 'stderr line never reached the terminal print sink');
});

test('B2: a built-in program is unaffected - it still opens with just {cwd}, sinks or not', () => {
  const opens = [];
  const ctx = makeOsContext({
    ROOT_SYSTEM_FILE_META: [{ name: 'CALC.exe' }],
    PROJECTS: [],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
    cwd: '',
    shellVars: { PATH: 'C:\\sleepOS' },
    resolveShellText: t => String(t == null ? '' : t),
    print: () => {},
    procSetTimeout: (winId, fn) => fn(),
    openCalculator: () => opens.push('calc-opened'),
  });
  loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
  ctx.__evalSource(extractFunctionSource(TERMINAL_SRC, 'launchTerminalTarget'), 'terminal-slice-launch');
  programsWithFiles(ctx, {});
  const ok = ctx.launchTerminalTarget('CALC.exe');
  assert.strictEqual(ok, true);
  assert.deepStrictEqual(opens, ['calc-opened'], 'a built-in must still launch with the ctx.sinks addition present but ignored');
});
