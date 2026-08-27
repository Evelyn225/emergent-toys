'use strict';
// A spawned worker as a pipeline stage. This is the master spec's unifying
// feature - "a real Worker process in the middle of a pipe" - and the reason
// os/stream.js's makePushStream exists: a worker's output arrives on a
// callback, not from a loop the pipeline controls.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function terminalCtx() {
  const ctx = makeOsContext({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
    kernelMetricsFor: () => ({ cpu: null, mem: null, memUnit: null }),
  });
  return loadOsSources(ctx, ['os/stream.js', 'os/process-view.js', 'apps/terminal.js']);
}

// A fake kernel: spawn hands back sinks the test drives by hand, and wait
// resolves when the test says the process exited.
function makeFakeKernel() {
  let sinks = null;
  let finish = null;
  const waited = new Promise(resolve => { finish = resolve; });
  return {
    captured: () => sinks,
    exit: code => finish(code),
    deps: {
      spawn: async (path, argv, s) => { sinks = s; return 4242; },
      wait: async () => waited,
    },
  };
}

test('a process stage yields a line as the process emits it, before exit', async () => {
  const ctx = terminalCtx();
  const kernel = makeFakeKernel();
  const stage = await ctx.pipelineSpawnStage(['RUNAWAY.exe'], kernel.deps);
  assert.strictEqual(stage.pid, 4242);
  const iter = stage.stream[Symbol.asyncIterator]();
  const pending = iter.next();
  kernel.captured().onStdout('tick 1');
  const first = await pending;
  assert.strictEqual(first.done, false);
  assert.strictEqual(first.value, 'tick 1');
  kernel.exit(0);
});

test('the stream ends when the process exits', async () => {
  const ctx = terminalCtx();
  const kernel = makeFakeKernel();
  const stage = await ctx.pipelineSpawnStage(['HELLO.exe'], kernel.deps);
  kernel.captured().onStdout('a');
  kernel.captured().onStdout('b');
  kernel.exit(0);
  const seen = [];
  for await (const line of stage.stream) seen.push(line);
  assert.deepStrictEqual(seen, ['a', 'b']);
});

test('stderr joins the same stream so a downstream GREP can see errors', async () => {
  const ctx = terminalCtx();
  const kernel = makeFakeKernel();
  const stage = await ctx.pipelineSpawnStage(['BAD.exe'], kernel.deps);
  kernel.captured().onStdout('ok');
  kernel.captured().onStderr('ERROR: nope');
  kernel.exit(1);
  const seen = [];
  for await (const line of stage.stream) seen.push(line);
  assert.deepStrictEqual(seen, ['ok', 'ERROR: nope']);
});

test('argv after the program name is passed through to spawn', async () => {
  const ctx = terminalCtx();
  let seenArgv = null;
  const stage = await ctx.pipelineSpawnStage(['HELLO.exe', 'one', 'two'], {
    spawn: async (path, argv) => { seenArgv = [...argv]; return 7; },
    wait: async () => 0,
  });
  assert.strictEqual(stage.pid, 7);
  assert.deepStrictEqual(seenArgv, ['one', 'two']);
});

test('a spawn failure surfaces rather than producing a silent empty stage', async () => {
  const ctx = terminalCtx();
  await assert.rejects(
    () => ctx.pipelineSpawnStage(['MISSING.exe'], {
      spawn: async () => { const e = new Error('script not found: MISSING.exe'); e.code = 'ENOENT'; throw e; },
      wait: async () => 0,
    }),
    /script not found/,
  );
});

// Fix round 1: Ctrl+C did not kill a live process pipeline stage. The
// terminal's print loop (`for await (const line of stream) print(line)`) sits
// suspended inside makePushStream's internal `await new Promise(...)`, and
// nothing woke that promise on abort - so the pipeline's `finally` (the one
// that SIGKILLs every pid it spawned) could never run while the process was
// still alive. These tests pin down the fix: makePushStream now takes an
// optional AbortSignal and fails itself when that signal aborts, which is
// exactly what lets a suspended consumer - and the finally above it - unblock.

test('makePushStream() with no signal behaves exactly as before', async () => {
  const ctx = terminalCtx();
  const push = ctx.makePushStream();
  const iter = push[Symbol.asyncIterator]();
  const pending = iter.next();
  push.push('line');
  const first = await pending;
  assert.strictEqual(first.done, false);
  assert.strictEqual(first.value, 'line');
  push.close();
  const last = await iter.next();
  assert.strictEqual(last.done, true);
});

test('a push stream created with an already-aborted signal fails rather than hanging', async () => {
  const ctx = terminalCtx();
  const ac = new AbortController();
  ac.abort(new Error('nope'));
  const push = ctx.makePushStream(ac.signal);
  const seen = [];
  await assert.rejects(async () => {
    for await (const line of push) seen.push(line);
  }, /nope/);
  assert.deepStrictEqual(seen, []);
});

// This is the regression test for the deadlock itself: a consumer suspended
// mid-iteration, with the producer still alive, must be woken by the abort
// rather than waiting for the producer to ever push or close.
test('a push stream aborted mid-iteration throws out of the for-await instead of hanging', async () => {
  const ctx = terminalCtx();
  const ac = new AbortController();
  const push = ctx.makePushStream(ac.signal);
  const iter = push[Symbol.asyncIterator]();
  const pending = iter.next(); // suspends: nothing pushed, nothing closed
  ac.abort(new Error('interrupted'));
  await assert.rejects(() => pending, /interrupted/);
});

// The scenario the whole fix is for: a live process stage being drained by a
// loop like the terminal's print loop, aborted mid-read. Before the fix this
// hung forever; now the consuming loop's own `finally` proves it unblocked -
// which is the same shape as the pipeline's finally that SIGKILLs the pid.
test('an aborted live process stage unblocks a suspended consumer so its finally runs', async () => {
  const ctx = terminalCtx();
  const kernel = makeFakeKernel();
  const ac = new AbortController();
  const stage = await ctx.pipelineSpawnStage(['RUNAWAY.exe'], Object.assign({}, kernel.deps, { signal: ac.signal }));
  let finallyRan = false;
  const consuming = (async () => {
    try {
      for await (const line of stage.stream) { /* RUNAWAY.exe never emits before the abort */ }
    } finally {
      finallyRan = true;
    }
  })();
  ac.abort(new Error('^C'));
  await assert.rejects(consuming, /\^C/);
  assert.strictEqual(finallyRan, true);
  kernel.exit(0); // let the still-pending wait() settle so nothing leaks past the test
});

test('the abort listener is removed once the stream closes normally, so it does not leak', async () => {
  const ctx = terminalCtx();
  const { getEventListeners } = require('node:events');
  const ac = new AbortController();
  const push = ctx.makePushStream(ac.signal);
  assert.strictEqual(getEventListeners(ac.signal, 'abort').length, 1);
  push.close();
  assert.strictEqual(getEventListeners(ac.signal, 'abort').length, 0);
});

test('the abort listener is removed once the stream fails, so it does not leak', async () => {
  const ctx = terminalCtx();
  const { getEventListeners } = require('node:events');
  const ac = new AbortController();
  const push = ctx.makePushStream(ac.signal);
  push.fail(new Error('boom'));
  assert.strictEqual(getEventListeners(ac.signal, 'abort').length, 0);
});
