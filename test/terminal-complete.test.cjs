'use strict';
// Tab completion for the terminal input line.
//
// buildTerminalCompletion is top-level rather than nested inside openTerminal
// for the same reason runPipelineStages and buildPsRows are: node cannot
// reach into that closure, and completion is pure once its dependencies are
// injected. Everything stateful about Tab - which candidate the cycle is
// currently showing - lives in the keydown handler, NOT here, so this file
// can enumerate behaviour without a DOM or a real VFS.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function terminalCtx() {
  return loadOsSources(makeOsContext({}), ['apps/terminal.js']);
}

// A fake filesystem shaped like vfsListSync's output: root holds DOCS plus a
// couple of files, DOCS holds two more. Deliberately mixed-case names, since
// preserving the canonical casing on insert is one of the things under test.
const TREE = {
  '': [
    { name: 'DOCS', type: 'dir' },
    { name: 'README.txt', type: 'file' },
    { name: 'NOTES.txt', type: 'file' },
    { name: 'NOTEPAD.exe', type: 'file' },
  ],
  DOCS: [
    { name: 'SCRIPTING.txt', type: 'file' },
    { name: 'SCRATCH.txt', type: 'file' },
  ],
};

function makeDeps(overrides) {
  return Object.assign({
    cwd: '',
    commandNames: () => ['cat', 'cd', 'grep', 'notepad', 'where', 'who', 'whoami', 'run'],
    programNames: dir => (dir === '' ? ['NOTEPAD.exe', 'TERMINAL.exe'] : []),
    pathDirs: () => [''],
    listDir: dir => TREE[dir] || [],
    dirExists: dir => Object.prototype.hasOwnProperty.call(TREE, dir),
    normalizeDir: name => String(name || '')
      .trim()
      .replace(/^C:\\sleepOS(?:\\|$)/i, '')
      .replace(/\//g, '\\')
      .replace(/^\\+|\\+$/g, '')
      .toUpperCase(),
  }, overrides || {});
}

// Applies a completion result the way the keydown handler does, so the tests
// assert on the resulting line rather than on span arithmetic.
function apply(line, result, index) {
  return line.slice(0, result.start) + result.matches[index || 0] + line.slice(result.end);
}

test('a unique command prefix completes and appends a space', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('gre', 3, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['grep ']);
  assert.strictEqual(apply('gre', r), 'grep ');
});

test('an ambiguous command prefix returns every match, sorted', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('wh', 2, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['where ', 'who ', 'whoami ']);
});

test('programs join builtins at command position, deduped by name', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('note', 4, makeDeps());
  // 'notepad' (builtin) and 'NOTEPAD.exe' (program) are different names and
  // both stay; the program is not listed twice despite being in both the cwd
  // and the single PATH entry.
  assert.deepStrictEqual(plain(r.matches), ['notepad ', 'NOTEPAD.exe ']);
});

test('no candidate returns null so the keypress can fall through', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.buildTerminalCompletion('zzz', 3, makeDeps()), null);
});

test('an empty command position completes nothing', () => {
  const ctx = terminalCtx();
  // cmd.exe would list the whole directory here. Offering ~60 builtins for a
  // bare Tab is noise, so this is deliberately inert.
  assert.strictEqual(ctx.buildTerminalCompletion('', 0, makeDeps()), null);
});

test('argument position completes filenames from the cwd', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cat RE', 6, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['README.txt ']);
  assert.strictEqual(apply('cat RE', r), 'cat README.txt ');
});

test('matching is case-insensitive but inserts the canonical casing', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cat readme', 10, makeDeps());
  assert.strictEqual(apply('cat readme', r), 'cat README.txt ');
});

test('a directory completes with a trailing separator, not a space', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cd DO', 5, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['DOCS\\']);
});

test('CD offers directories only', () => {
  const ctx = terminalCtx();
  // 'NOTES.txt' and 'NOTEPAD.exe' both match the prefix but neither is a
  // directory, so CD must return nothing rather than offer a dead path.
  assert.strictEqual(ctx.buildTerminalCompletion('cd NOTE', 7, makeDeps()), null);
});

test('a path-qualified argument keeps the typed directory text verbatim', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cat DOCS\\SCR', 12, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['DOCS\\SCRATCH.txt ', 'DOCS\\SCRIPTING.txt ']);
  // Index 1 is what a second Tab press lands on, so this also pins the cycle
  // order the keydown handler walks.
  assert.strictEqual(apply('cat DOCS\\SCR', r, 1), 'cat DOCS\\SCRIPTING.txt ');
});

test('a forward slash the user typed survives completion', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cat DOCS/SCRIPT', 15, makeDeps());
  assert.strictEqual(apply('cat DOCS/SCRIPT', r), 'cat DOCS/SCRIPTING.txt ');
});

test('the cwd is respected for a bare argument prefix', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('cat SCRAT', 9, makeDeps({ cwd: 'DOCS' }));
  assert.deepStrictEqual(plain(r.matches), ['SCRATCH.txt ']);
});

test('the token after a pipe is a command position again', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('dir | gre', 9, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['grep ']);
});

test('an argument after a pipe still completes files', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('dir | grep x READ', 17, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['README.txt ']);
});

test('only the token under the caret is replaced', () => {
  const ctx = terminalCtx();
  const line = 'cat RE > out.txt';
  const r = ctx.buildTerminalCompletion(line, 6, makeDeps());
  assert.strictEqual(r.start, 4);
  assert.strictEqual(r.end, 6);
  assert.strictEqual(apply(line, r), 'cat README.txt  > out.txt');
});

test('a redirect target completes as a filename, not a command', () => {
  const ctx = terminalCtx();
  const r = ctx.buildTerminalCompletion('dir > READ', 10, makeDeps());
  assert.deepStrictEqual(plain(r.matches), ['README.txt ']);
});

test('an unknown directory in the prefix yields nothing', () => {
  const ctx = terminalCtx();
  assert.strictEqual(ctx.buildTerminalCompletion('cat NOPE\\x', 10, makeDeps()), null);
});
