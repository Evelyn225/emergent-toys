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

async function mounted(backend, options) {
  const ctx = loadOsSources(makeOsContext(), ['os/vfs.js']);
  await ctx.vfsMount(backend, options || {});
  return ctx;
}

// A backend that only ever reports what it has durably applied - `commit()`
// doesn't touch `durable` until every op in the batch has been read via
// `readEntry` and folded in, so a read through `_read` before `commit()`
// resolves would see nothing. This is what lets a test tell "fired when the
// op was queued" apart from "fired after the commit actually landed": the
// two only differ once something reads back through the backend, not just by
// counting calls.
function commitTrackingBackend() {
  const durable = new Map();
  return {
    needsSnapshot: false,
    async load() { return null; },
    async commit(payload) {
      for (const op of payload.ops) {
        if (op.op === 'write') {
          const entry = await payload.readEntry(op.dirName, op.name);
          durable.set(op.name, entry ? entry.text : undefined);
        } else if (op.op === 'unlink') {
          durable.delete(op.name);
        }
      }
    },
    async estimate() { return { usage: 0, quota: Infinity }; },
    _read(name) { return durable.get(name); },
  };
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

// ── Task 3.5: the two direct-tree mutators in os/daemon.js ───────

test('a direct mkdir queues an op carrying its path', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  ctx.vfsQueueDirectMkdir('', 'DOCS');
  await ctx.vfsFlush();
  const op = backend.commits[0].ops.find(o => o.op === 'mkdir');
  assert.ok(op, 'a direct mkdir must emit a real mkdir op, not a pathless marker');
  assert.strictEqual(op.dirName, '');
  assert.strictEqual(op.name, 'DOCS');
});

test('a direct write queues an op a backend can resolve to content', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  // Mutate the tree directly, exactly as os/daemon.js ensureStoryTextFile does.
  ctx.vfsGetTree().files.set('NOTICE.txt', 'the story text');
  ctx.vfsQueueDirectWrite('', 'NOTICE.txt', null);
  await ctx.vfsFlush();
  const entry = backend.commits[0].entries['write:/NOTICE.txt'];
  assert.ok(entry, 'a direct write must emit an op readEntry can resolve');
  assert.strictEqual(entry.kind, 'file');
  assert.strictEqual(entry.text, 'the story text');
});

test('a direct write of unchanged content queues nothing', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  ctx.vfsGetTree().files.set('SAME.txt', 'identical');
  ctx.vfsQueueDirectWrite('', 'SAME.txt', 'identical');
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits.length, 0,
    'story beats re-set identical content constantly; queuing a commit each time is write amplification');
});

test('no op the VFS emits is missing a path', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend);
  await ctx.vfsMkdir('SUB');
  await ctx.vfsWriteFile('A.txt', 'a');
  ctx.vfsQueueDirectMkdir('', 'DIRECT');
  ctx.vfsGetTree().files.set('D.txt', 'd');
  ctx.vfsQueueDirectWrite('', 'D.txt', null);
  await ctx.vfsFlush();
  backend.commits[0].ops.forEach(op => {
    assert.ok(typeof op.dirName === 'string',
      op.op + ' op has no dirName - an ops-only backend cannot act on it');
    assert.ok(typeof op.name === 'string' && op.name,
      op.op + ' op has no name - an ops-only backend cannot act on it');
  });
});

// ── onCommit: a post-commit signal, distinct from onChange's queue-time one ──
//
// os/fs-persist.js recomputes drive fragmentation from `backend._readInodes()`,
// which only ever sees durably committed state. Wiring that recompute to
// onChange - which fires the instant an op is queued, 400ms before the
// debounced vfsFlush() actually commits it - reads state from before the
// write it's reacting to has landed. onCommit exists to give a caller a hook
// that actually fires after commit.

test('onCommit fires after a commit actually lands, and a backend read inside it observes the committed write', async () => {
  const backend = commitTrackingBackend();
  let observedDuringCommit;
  const ctx = await mounted(backend, {
    onCommit: () => { observedDuringCommit = backend._read('A.txt'); },
  });
  await ctx.vfsWriteFile('A.txt', 'the committed value');
  await ctx.vfsFlush();
  assert.strictEqual(observedDuringCommit, 'the committed value',
    'onCommit must fire only after the write has actually landed in the backend');
});

test('onChange still fires at queue time, before any commit', async () => {
  const backend = commitTrackingBackend();
  const changeEvents = [];
  const ctx = await mounted(backend, {
    onChange: op => changeEvents.push({ op, readBack: backend._read('A.txt') }),
  });
  await ctx.vfsWriteFile('A.txt', 'queued but not yet committed');
  assert.strictEqual(changeEvents.length, 1, 'onChange must fire when the op is queued, not on a later flush');
  assert.strictEqual(changeEvents[0].readBack, undefined,
    'the backend must not have this write yet - onChange really did fire before the commit');
  await ctx.vfsFlush();
});

test('a commit that fails does not fire onCommit', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  backend.commit = async () => { throw new Error('boom'); };
  let fired = false;
  const errors = [];
  const ctx = await mounted(backend, {
    onCommit: () => { fired = true; },
    onError: err => errors.push(err),
  });
  await ctx.vfsWriteFile('A.txt', 'x');
  await ctx.vfsFlush();
  assert.strictEqual(fired, false, 'a failed commit must not fire onCommit');
  assert.strictEqual(errors.length, 1, 'the failure must still reach onError');
});

test('a throwing onCommit does not break vfsFlush or the commit it followed', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend, {
    onCommit: () => { throw new Error('onCommit blew up'); },
  });
  await ctx.vfsWriteFile('A.txt', 'x');
  await assert.doesNotReject(() => ctx.vfsFlush());
  assert.strictEqual(backend.commits.length, 1, 'the commit itself must still have landed');
});

test('a rejecting onCommit does not surface as an unhandled rejection', async () => {
  const backend = recordingBackend({ needsSnapshot: false });
  const ctx = await mounted(backend, {
    onCommit: () => Promise.reject(new Error('onCommit rejected')),
  });
  let unhandled = null;
  const onUnhandledRejection = err => { unhandled = err; };
  process.on('unhandledRejection', onUnhandledRejection);
  try {
    await ctx.vfsWriteFile('A.txt', 'x');
    await ctx.vfsFlush();
    // Give a same-tick-scheduled unhandled rejection a chance to surface
    // before the test ends and the listener is torn down.
    await new Promise(r => setImmediate(r));
  } finally {
    process.off('unhandledRejection', onUnhandledRejection);
  }
  assert.strictEqual(unhandled, null, 'a rejecting onCommit must not produce an unhandled rejection');
});

test('a flush during compaction defers instead of committing', async () => {
  const backend = recordingBackend();
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'first', '');
  ctx.vfsSetDefragActive(true);
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits.length, 0, 'a commit landed while compaction was running');
  assert.strictEqual(ctx.vfsHasPendingWrites(), true, 'the op was dropped rather than deferred');
});

test('the deferred write commits once compaction is over', async () => {
  const backend = recordingBackend();
  const ctx = await mounted(backend);
  await ctx.vfsWriteFile('A.txt', 'first', '');
  ctx.vfsSetDefragActive(true);
  await ctx.vfsFlush();
  ctx.vfsSetDefragActive(false);
  await ctx.vfsFlush();
  assert.strictEqual(backend.commits.length, 1);
  assert.strictEqual(ctx.vfsHasPendingWrites(), false);
});
