'use strict';
// Characterisation tests for the pipeline driver, written BEFORE phase 6
// converts it to streams. Every assertion here describes behaviour that
// already shipped, so Task 3's conversion is correct exactly when this file
// still passes unchanged. Do not edit these expectations to make a later
// task green - that would delete the only safety net over the terminal's
// hottest path.
//
// runPipelineStages is top-level rather than nested inside openTerminal for
// the same reason buildPsRows is: node cannot reach into that closure, and a
// pipeline is pure enough to test without a DOM once its dependencies are
// injected.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources, plain } = require('./helpers/load-os.cjs');

function terminalCtx() {
  const ctx = makeOsContext({
    wins: {},
    kernelListProcesses: () => [],
    getBuiltInProcesses: () => [],
    kernelMetricsFor: () => ({ cpu: null, mem: null, memUnit: null }),
  });
  // os/stream.js is loaded even though this task's driver still passes
  // arrays: streamCollect works on a plain array too (for await accepts a
  // sync iterable), which is precisely why these assertions survive Task 3's
  // conversion without being edited.
  return loadOsSources(ctx, ['os/stream.js', 'os/process-view.js', 'apps/terminal.js']);
}

// The real getCommandParts, duplicated rather than reached for: it lives
// inside openTerminal's closure, and the driver takes it as a dependency
// precisely so this test does not have to.
function getCommandParts(segment) {
  const trimmed = String(segment || '').trim();
  if (!trimmed) return { cmd: '', args: '' };
  const sp = trimmed.search(/\s/);
  return sp === -1
    ? { cmd: trimmed.toLowerCase(), args: '' }
    : { cmd: trimmed.slice(0, sp).toLowerCase(), args: trimmed.slice(sp + 1).trim() };
}

// A stage table standing in for runPipeStage. Returns arrays, which is what
// the shipped implementation returns today.
function makeRunStage(table) {
  return async (cmd, args, stdin) => {
    if (!Object.prototype.hasOwnProperty.call(table, cmd)) return null;
    return table[cmd](args, stdin);
  };
}

test('a single producer stage yields its lines', async () => {
  const ctx = terminalCtx();
  const out = await ctx.runPipelineStages(['echo hi'], {
    getCommandParts,
    runStage: makeRunStage({ echo: args => [args] }),
    onNotepadSink: async () => {},
  });
  assert.deepStrictEqual(plain(await ctx.streamCollect(out.stream)), ['hi']);
  assert.strictEqual(out.consumedBySink, false);
});

test('a two-stage pipeline feeds the first stage output into the second', async () => {
  const ctx = terminalCtx();
  const out = await ctx.runPipelineStages(['dir', 'grep a'], {
    getCommandParts,
    runStage: makeRunStage({
      dir: () => ['alpha', 'beta'],
      grep: async (args, stdin) => {
        const lines = await ctx.streamCollect(ctx.streamNormalize(stdin));
        return [...lines].filter(l => l.includes(args));
      },
    }),
    onNotepadSink: async () => {},
  });
  assert.deepStrictEqual(plain(await ctx.streamCollect(out.stream)), ['alpha', 'beta'].filter(l => l.includes('a')));
});

test('three stages chain in order', async () => {
  const ctx = terminalCtx();
  const out = await ctx.runPipelineStages(['echo x', 'up', 'twice'], {
    getCommandParts,
    runStage: makeRunStage({
      echo: args => [args],
      up: async (args, stdin) => (await ctx.streamCollect(ctx.streamNormalize(stdin))).map(l => l.toUpperCase()),
      twice: async (args, stdin) => {
        const lines = await ctx.streamCollect(ctx.streamNormalize(stdin));
        return [...lines, ...lines];
      },
    }),
    onNotepadSink: async () => {},
  });
  assert.deepStrictEqual(plain(await ctx.streamCollect(out.stream)), ['X', 'X']);
});

test('an unknown command reports which command was not pipeable', async () => {
  const ctx = terminalCtx();
  await assert.rejects(
    () => ctx.runPipelineStages(['echo x', 'frobnicate'], {
      getCommandParts,
      runStage: makeRunStage({ echo: args => [args] }),
      onNotepadSink: async () => {},
    }),
    /Piping not supported for command: FROBNICATE/,
  );
});

test('an empty stage is an invalid pipeline', async () => {
  const ctx = terminalCtx();
  await assert.rejects(
    () => ctx.runPipelineStages(['echo x', '   '], {
      getCommandParts,
      runStage: makeRunStage({ echo: args => [args] }),
      onNotepadSink: async () => {},
    }),
    /Invalid command pipeline\./,
  );
});

test('a final notepad stage consumes the pipeline and stops it', async () => {
  const ctx = terminalCtx();
  let sank = null;
  const out = await ctx.runPipelineStages(['echo hi', 'notepad out.txt'], {
    getCommandParts,
    runStage: makeRunStage({ echo: args => [args] }),
    onNotepadSink: async (args, stream) => {
      sank = { args, lines: [...(await ctx.streamCollect(stream))] };
    },
  });
  assert.strictEqual(out.consumedBySink, true);
  assert.deepStrictEqual(sank, { args: 'out.txt', lines: ['hi'] });
});

test('notepad.exe is the same sink as notepad', async () => {
  const ctx = terminalCtx();
  let called = false;
  const out = await ctx.runPipelineStages(['echo hi', 'notepad.exe'], {
    getCommandParts,
    runStage: makeRunStage({ echo: args => [args] }),
    onNotepadSink: async () => { called = true; },
  });
  assert.strictEqual(called, true);
  assert.strictEqual(out.consumedBySink, true);
});

test('notepad in a non-final position is not a sink and must be a real stage', async () => {
  const ctx = terminalCtx();
  await assert.rejects(
    () => ctx.runPipelineStages(['notepad', 'echo x'], {
      getCommandParts,
      runStage: makeRunStage({ echo: args => [args] }),
      onNotepadSink: async () => { throw new Error('sink must not run mid-pipeline'); },
    }),
    /Piping not supported for command: NOTEPAD/,
  );
});
