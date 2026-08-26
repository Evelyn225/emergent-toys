'use strict';
// The property the phase turns on: a downstream stage sees a line before its
// upstream has finished. Every test here uses a producer that is never
// closed, so a buffered implementation hangs rather than quietly passing.
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

function getCommandParts(segment) {
  const trimmed = String(segment || '').trim();
  if (!trimmed) return { cmd: '', args: '' };
  const sp = trimmed.search(/\s/);
  return sp === -1
    ? { cmd: trimmed.toLowerCase(), args: '' }
    : { cmd: trimmed.slice(0, sp).toLowerCase(), args: trimmed.slice(sp + 1).trim() };
}

test('a grep stage emits a match before its upstream closes', async () => {
  const ctx = terminalCtx();
  const push = ctx.makePushStream();
  const out = await ctx.runPipelineStages(['forever', 'grep tick'], {
    getCommandParts,
    runStage: async (cmd, args, stdin) => {
      if (cmd === 'forever') return push;
      if (cmd === 'grep') return ctx.streamGrep(ctx.streamNormalize(stdin), new RegExp(args, 'i'));
      return null;
    },
    onNotepadSink: async () => {},
  });
  const iter = out.stream[Symbol.asyncIterator]();
  const pending = iter.next();
  push.push('noise');
  push.push('tick 1');
  const first = await pending;
  assert.strictEqual(first.value, 'tick 1', 'the match must arrive while the producer is still open');
  // The producer is deliberately left open. Closing it here only keeps the
  // test from holding a pending promise past the assertion.
  push.close();
});

test('a bounded array stage still works unchanged through the shim', async () => {
  const ctx = terminalCtx();
  const out = await ctx.runPipelineStages(['echo hello'], {
    getCommandParts,
    runStage: async (cmd, args) => (cmd === 'echo' ? [args] : null),
    onNotepadSink: async () => {},
  });
  assert.deepStrictEqual([...(await ctx.streamCollect(out.stream))], ['hello']);
});

test('a stage receives a source, not an array, as stdin', async () => {
  const ctx = terminalCtx();
  let seenType = 'never ran';
  await ctx.runPipelineStages(['echo a', 'inspect'], {
    getCommandParts,
    runStage: async (cmd, args, stdin) => {
      if (cmd === 'echo') return [args];
      seenType = Array.isArray(stdin) ? 'array' : (stdin && typeof stdin[Symbol.asyncIterator] === 'function' ? 'source' : 'other');
      return [];
    },
    onNotepadSink: async () => {},
  });
  assert.strictEqual(seenType, 'source');
});

test('the first stage receives null stdin', async () => {
  const ctx = terminalCtx();
  let seen = 'never ran';
  await ctx.runPipelineStages(['echo a'], {
    getCommandParts,
    runStage: async (cmd, args, stdin) => { seen = stdin; return [args]; },
    onNotepadSink: async () => {},
  });
  assert.strictEqual(seen, null);
});

test('an empty-array stage is not mistaken for an unsupported command', async () => {
  const ctx = terminalCtx();
  const out = await ctx.runPipelineStages(['quiet'], {
    getCommandParts,
    runStage: async () => [],
    onNotepadSink: async () => {},
  });
  assert.deepStrictEqual([...(await ctx.streamCollect(out.stream))], []);
});
