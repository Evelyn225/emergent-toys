'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

// A backend that records exactly what the VFS hands it. This is the first
// thing in the repo to consume `ops`; the localStorage backend has always
// ignored them, so a missing op type or a descriptor with a missing field
// would have gone unnoticed until the IndexedDB backend silently failed to
// persist something.
function recordingBackend(opts) {
  opts = opts || {};
  const commits = [];
  return {
    needsSnapshot: opts.needsSnapshot,
    commits,
    async load() { return null; },
    async commit(payload) {
      const entries = {};
      for (const op of payload.ops) {
        // readEntry is async - see the note on blobs in os/vfs.js.
        entries[op.op + ':' + op.dirName + '/' + op.name] =
          payload.readEntry ? plain(await payload.readEntry(op.dirName, op.name)) : undefined;
      }
      commits.push({ ops: plain(payload.ops), hadSnapshot: payload.snapshot !== undefined, entries });
    },
    async estimate() { return { usage: 0, quota: Infinity }; },
  };
}

async function mounted(backend) {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js']);
  await ctx.vfsMount(backend, {});
  return ctx;
}

test('a backend that wants no snapshot is not given one', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'hello');
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits.length, 1);
  assert.strictEqual(backend.commits[0].hadSnapshot, false,
    'serializing the whole tree for a backend that ignores it is pure waste');
});

test('a backend that wants a snapshot still gets one, unchanged', async () => {
  const backend = recordingBackend({ needsSnapshot: true });
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'hello');
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits[0].hadSnapshot, true);
});

test('a backend that declares nothing gets a snapshot, so old backends keep working', async () => {
  const backend = recordingBackend({});
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'hello');
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits[0].hadSnapshot, true);
});

test('readEntry hands the backend the current content of a written file', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'the bytes');
  await ctx.vfsFlush();
  const entry = backend.commits[0].entries['write:/A.txt'];
  assert.strictEqual(entry.kind, 'file');
  assert.strictEqual(entry.text, 'the bytes');
});

test('readEntry returns null for a path the op deleted', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'x');
  await ctx.vfsFlush();
  await ctx.vfsUnlink('A.txt');
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits[1].entries['unlink:/A.txt'], null);
});

test('every mutation emits an op, and each carries what a backend needs', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsMkdir('SUB');
  await ctx.vfsWriteFile('A.txt', 'a');
  await ctx.vfsWriteBlob('P.png', { kind: 'image', size: 3, url: 'blob:x' });
  await ctx.vfsFlush();

  const ops = backend.commits[0].ops;
  const kinds = ops.map(o => o.op);
  assert.ok(kinds.includes('mkdir'), 'mkdir must emit an op');
  assert.ok(kinds.includes('write'), 'write must emit an op');
  assert.ok(kinds.includes('writeBlob'), 'writeBlob must emit an op');
  ops.forEach(op => {
    assert.ok(typeof op.dirName === 'string', op.op + ' op is missing dirName');
    assert.ok(typeof op.name === 'string' && op.name, op.op + ' op is missing name');
  });
});

test('rename and move emit ops carrying the destination', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsMkdir('SUB');
  await ctx.vfsWriteFile('A.txt', 'a');
  await ctx.vfsFlush();

  await ctx.vfsRename('', 'A.txt', 'B.txt');
  await ctx.vfsFlush();
  const ren = backend.commits[1].ops.find(o => o.op === 'rename');
  assert.strictEqual(ren.name, 'A.txt');
  assert.strictEqual(ren.newName, 'B.txt');

  await ctx.vfsMove('', 'B.txt', 'SUB', 'B.txt');
  await ctx.vfsFlush();
  const mv = backend.commits[2].ops.find(o => o.op === 'move');
  assert.strictEqual(mv.dstDirName, 'SUB');
  assert.strictEqual(mv.newName, 'B.txt');
});
