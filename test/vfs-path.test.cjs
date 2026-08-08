'use strict';
const test = require('node:test');
const assert = require('node:assert');
// `plain` round-trips a value through JSON to give it host prototypes.
// Anything a vm-loaded source returns carries the vm realm's prototypes, and
// assert.deepStrictEqual compares prototypes, so a structural comparison
// against a plain literal fails without it. Use it on every VFS return value.
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function mkNode(init) {
  return Object.assign({ dirs: new Set(), files: new Map(), blobs: new Map(), subdirs: new Map() }, init || {});
}

function ctxWithTree() {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  const docs = mkNode({
    dirs: new Set(['SUB']),
    files: new Map([['README.txt', 'hello world']]),
    subdirs: new Map([['SUB', mkNode({ files: new Map([['deep.txt', 'deep']]) })]]),
  });
  const root = mkNode({
    dirs: new Set(['DOCS']),
    files: new Map([['root.txt', 'r']]),
    blobs: new Map([['pic.png', { url: 'blob:1', kind: 'image', size: 1234, mime: 'image/png' }]]),
    subdirs: new Map([['DOCS', docs]]),
  });
  ctx.vfsSetTree(root);
  return ctx;
}

test('vfsNormalizeDir strips the drive prefix, separators, and case', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsNormalizeDir('C:\\sleepOS\\docs'), 'DOCS');
  assert.strictEqual(ctx.vfsNormalizeDir('/docs/sub/'), 'DOCS\\SUB');
  assert.strictEqual(ctx.vfsNormalizeDir('  \\DOCS\\  '), 'DOCS');
  assert.strictEqual(ctx.vfsNormalizeDir(''), '');
  assert.strictEqual(ctx.vfsNormalizeDir(null), '');
  assert.strictEqual(ctx.vfsNormalizeDir(0), '');
  assert.strictEqual(ctx.vfsNormalizeDir(undefined), '');
});

test('vfsSplitPath separates directory from filename with a fallback', () => {
  const ctx = ctxWithTree();
  assert.deepStrictEqual(plain(ctx.vfsSplitPath('a.txt', 'DOCS')), { dirName: 'DOCS', fileName: 'a.txt' });
  assert.deepStrictEqual(plain(ctx.vfsSplitPath('DOCS\\a.txt', '')), { dirName: 'DOCS', fileName: 'a.txt' });
  assert.deepStrictEqual(plain(ctx.vfsSplitPath('C:\\sleepOS\\DOCS\\SUB\\a.txt', '')), { dirName: 'DOCS\\SUB', fileName: 'a.txt' });
  assert.deepStrictEqual(plain(ctx.vfsSplitPath('', 'DOCS')), { dirName: 'DOCS', fileName: '' });
});

test('vfsSplitPath preserves filename case but uppercases the directory', () => {
  const ctx = ctxWithTree();
  assert.deepStrictEqual(plain(ctx.vfsSplitPath('docs\\MyFile.TXT', '')), { dirName: 'DOCS', fileName: 'MyFile.TXT' });
});

test('vfsDirExistsSync finds nested dirs and rejects missing ones', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsDirExistsSync(''), true);
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS'), true);
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS\\SUB'), true);
  assert.strictEqual(ctx.vfsDirExistsSync('NOPE'), false);
  assert.strictEqual(ctx.vfsDirExistsSync('DOCS\\NOPE'), false);
});

test('vfsStatSync describes a text file without returning its content', () => {
  const ctx = ctxWithTree();
  const st = ctx.vfsStatSync('DOCS\\README.txt', '');
  assert.strictEqual(st.type, 'file');
  assert.strictEqual(st.kind, 'text');
  assert.strictEqual(st.name, 'README.txt');
  assert.strictEqual(st.dirName, 'DOCS');
  assert.strictEqual(st.size, 'hello world'.length);
  assert.strictEqual('value' in st, false, 'stat must not carry text content');
});

test('vfsStatSync returns the blob record so media can read url and mime', () => {
  const ctx = ctxWithTree();
  const st = ctx.vfsStatSync('pic.png', '');
  assert.strictEqual(st.kind, 'blob');
  assert.strictEqual(st.blob.url, 'blob:1');
  assert.strictEqual(st.blob.mime, 'image/png');
  assert.strictEqual(st.size, 1234);
});

test('vfsStatSync identifies directories', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsStatSync('DOCS', '').type, 'dir');
  assert.strictEqual(ctx.vfsStatSync('DOCS', '').kind, 'dir');
});

test('vfsStatSync returns null for missing paths and missing parents', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsStatSync('nope.txt', ''), null);
  assert.strictEqual(ctx.vfsStatSync('NOPE\\nope.txt', ''), null);
  assert.strictEqual(ctx.vfsStatSync('', ''), null);
});

test('vfsExistsSync covers files, blobs, and dirs', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsExistsSync('root.txt', ''), true);
  assert.strictEqual(ctx.vfsExistsSync('pic.png', ''), true);
  assert.strictEqual(ctx.vfsExistsSync('DOCS', ''), true);
  assert.strictEqual(ctx.vfsExistsSync('nope', ''), false);
});

test('vfsListSync returns dirs, then files, then blobs', () => {
  const ctx = ctxWithTree();
  const entries = plain(ctx.vfsListSync(''));
  assert.deepStrictEqual(entries.map(e => e.name), ['DOCS', 'root.txt', 'pic.png']);
  assert.deepStrictEqual(entries.map(e => e.kind), ['dir', 'text', 'blob']);
});

test('vfsListSync returns an empty array for a missing dir', () => {
  const ctx = ctxWithTree();
  assert.deepStrictEqual(plain(ctx.vfsListSync('NOPE')), []);
});

test('the drive prefix strip requires a separator or end of string', () => {
  const ctx = ctxWithTree();
  assert.strictEqual(ctx.vfsNormalizeDir('C:\\sleepOS\\DOCS'), 'DOCS');
  assert.strictEqual(ctx.vfsNormalizeDir('C:\\sleepOS'), '');
  // Only a prefix of a longer name: must NOT be stripped.
  assert.strictEqual(ctx.vfsNormalizeDir('C:\\sleepOSother\\x'), 'C:\\SLEEPOSOTHER\\X');
  assert.deepStrictEqual(
    plain(ctx.vfsSplitPath('C:\\sleepOSother\\x.txt', '')),
    { dirName: 'C:\\SLEEPOSOTHER', fileName: 'x.txt' }
  );
});

// fsNormalizeDir and fsSplitPath survive as one-line delegations rather than
// deletions: 47 call sites still use them. This pins that they really are
// delegations, so the drive-prefix fix cannot regress in one copy only.
test('the fs-core path helpers delegate to the VFS versions', () => {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js', 'os/storage-mem.js']);
  ctx.__evalSource('function increaseDriveFragmentation() {}');
  loadOsSources(ctx, ['os/fs-core.js']);
  assert.strictEqual(ctx.fsNormalizeDir('C:\\sleepOSother\\x'), 'C:\\SLEEPOSOTHER\\X');
  assert.strictEqual(ctx.fsNormalizeDir('/docs/sub/'), 'DOCS\\SUB');
  assert.deepStrictEqual(
    plain(ctx.fsSplitPath('docs\\MyFile.TXT', '')),
    { dirName: 'DOCS', fileName: 'MyFile.TXT' }
  );
});
