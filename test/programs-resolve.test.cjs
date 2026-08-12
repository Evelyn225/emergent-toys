'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// Every deepStrictEqual below wraps its vm-side value in plain(). Arrays and
// objects built inside the vm context carry THAT realm's prototypes, and
// deepStrictEqual compares prototypes, so comparing one against a plain host
// literal fails on the prototype before it ever looks at the contents. See the
// note above plain() in test/helpers/load-os.cjs.

// os/vfs.js is loaded for real rather than stubbed: programPathDirs delegates
// to vfsNormalizeDir on purpose, and a stub would let the two readings of a
// path drift, which is the exact bug the delegation exists to prevent.
function programs(overrides) {
  const ctx = makeOsContext(Object.assign({
    ROOT_SYSTEM_FILE_META: [
      { name: 'TERMINAL.exe', size: '4,096', date: '11/13/2024  10:31' },
      { name: 'NOTEPAD.exe', size: '4,096', date: '11/13/2024  10:31' },
      { name: 'CALC.exe', size: '4,096', date: '11/13/2024  10:31' },
    ],
    // `emoji` is carried by the real PROJECTS entries but is never read by
    // os/programs.js, so these are placeholders rather than the real glyphs.
    PROJECTS: [
      { name: 'sand playground', emoji: 'x', file: 'evenet.fun/Sands.html' },
      { name: 'fireworks', emoji: 'x', file: 'fireworks.html' },
    ],
    RECYCLE_BIN_NAME: 'Recycle Bin',
    daemonStory: { endingReached: false, stage: 0 },
  }, overrides || {}));
  return loadOsSources(ctx, ['os/vfs.js', 'os/programs.js']);
}

const DEFAULT_PATH = 'C:\\sleepOS;C:\\sleepOS\\PROJECTS;[redacted]';

test('the current directory is searched before PATH', () => {
  const ctx = programs();
  // PATH lists PROJECTS first, but cwd is the root, so the root wins.
  const hit = ctx.programResolve('CALC.exe', '', 'C:\\sleepOS\\PROJECTS;C:\\sleepOS');
  assert.strictEqual(hit.via, 'cwd');
  assert.strictEqual(hit.dir, '');
  assert.strictEqual(hit.program.name, 'CALC.exe');
});

test('a root program still resolves from the root with PATH emptied', () => {
  const ctx = programs();
  const hit = ctx.programResolve('?????.exe', '', '');
  assert.ok(hit, 'story programs must stay reachable from their own directory');
  assert.strictEqual(hit.via, 'cwd');
});

test('a root program does not resolve from elsewhere once PATH drops the root', () => {
  const ctx = programs();
  assert.ok(ctx.programResolve('NOTEPAD.exe', 'DOCS', DEFAULT_PATH), 'default PATH lists the root');
  assert.strictEqual(ctx.programResolve('NOTEPAD.exe', 'DOCS', 'C:\\sleepOS\\PROJECTS'), null);
});

test('.exe is appended when the literal name does not match, case-insensitively', () => {
  const ctx = programs();
  assert.strictEqual(ctx.programResolve('notepad', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
  assert.strictEqual(ctx.programResolve('NoTePaD.ExE', '', DEFAULT_PATH).program.name, 'NOTEPAD.exe');
});

test('PATH order decides which directory wins when cwd holds neither', () => {
  const ctx = programs();
  const hit = ctx.programResolve('fireworks', 'DOCS', DEFAULT_PATH);
  assert.strictEqual(hit.via, 'path');
  assert.strictEqual(hit.dir, 'PROJECTS');
});

test('unreal PATH entries are kept and resolve nothing', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programPathDirs(DEFAULT_PATH)), ['', 'PROJECTS', '[REDACTED]']);
  assert.strictEqual(ctx.programsInDir('[REDACTED]').length, 0);
});

test('an empty PATH segment does not silently splice in the root', () => {
  const ctx = programs();
  // vfsNormalizeDir('') is the root directory, so a trailing semicolon would
  // otherwise leave every root program resolvable from DOCS and make a
  // deliberately narrowed PATH look like it had no effect at all.
  assert.deepStrictEqual(plain(ctx.programPathDirs('C:\\sleepOS\\DOCS;')), ['DOCS']);
  assert.deepStrictEqual(plain(ctx.programPathDirs(';;')), []);
  assert.strictEqual(ctx.programResolve('NOTEPAD.exe', 'DOCS', 'C:\\sleepOS\\DOCS;'), null);
});

test('a duplicated PATH entry is searched once', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programPathDirs('C:\\sleepOS;C:\\sleepOS\\;C:\\sleepOS')), ['']);
});

test('projects resolve by name, hyphenated name, file, and file minus .html', () => {
  const ctx = programs();
  const forms = ['sand playground', 'sand-playground', 'evenet.fun/Sands.html', 'evenet.fun/Sands'];
  forms.forEach(form => {
    const hit = ctx.programResolve(form, 'PROJECTS', DEFAULT_PATH);
    assert.ok(hit, 'expected ' + form + ' to resolve');
    assert.strictEqual(hit.program.name, 'sand playground');
  });
});

test('void.tmp leaves the root set once the ending is reached', () => {
  const before = programs();
  assert.ok(before.programResolve('void.tmp', '', DEFAULT_PATH));
  const after = programs({ daemonStory: { endingReached: true, stage: 9 } });
  assert.strictEqual(after.programResolve('void.tmp', '', DEFAULT_PATH), null);
  assert.ok(after.programResolve('daemon.core', '', DEFAULT_PATH), 'daemon.core survives the ending');
});

test('programFindAnywhere ignores PATH so the terminal can explain a miss', () => {
  const ctx = programs();
  const found = ctx.programFindAnywhere('CALC.exe');
  assert.strictEqual(found.dir, '');
  assert.strictEqual(ctx.programDisplayDir(found.dir), 'C:\\sleepOS');
  assert.strictEqual(ctx.programDisplayDir('PROJECTS'), 'C:\\sleepOS\\PROJECTS');
  assert.strictEqual(ctx.programFindAnywhere('NOSUCH.exe'), null);
});

test('an unknown directory has no programs', () => {
  const ctx = programs();
  assert.deepStrictEqual(plain(ctx.programsInDir('DOCS')), []);
});
