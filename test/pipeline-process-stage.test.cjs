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
