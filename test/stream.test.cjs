'use strict';
// os/stream.js is the pure core of phase 6's pipeline work: async-iterable
// line sources with no DOM and no terminal state, so the streaming semantics
// can be pinned down in node before apps/terminal.js depends on them. Same
// split os/park.js and os/instrument.js used in phase 5b.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function streamCtx() {
  return loadOsSources(makeOsContext({}), ['os/stream.js']);
}

// Drains a vm-realm async iterable into a host array. Lines are primitive
// strings, so no plain() round-trip is needed here.
async function drain(source) {
  const out = [];
  for await (const line of source) out.push(line);
  return out;
}

test('streamFromLines yields every line in order', async () => {
  const ctx = streamCtx();
  assert.deepStrictEqual(await drain(ctx.streamFromLines(['a', 'b', 'c'])), ['a', 'b', 'c']);
});

test('streamFromLines on an empty array yields nothing', async () => {
  const ctx = streamCtx();
  assert.deepStrictEqual(await drain(ctx.streamFromLines([])), []);
});

test('streamGrep keeps only matching lines', async () => {
  const ctx = streamCtx();
  const src = ctx.streamFromLines(['alpha', 'beta', 'ALPHABET']);
  assert.deepStrictEqual(await drain(ctx.streamGrep(src, /alpha/i)), ['alpha', 'ALPHABET']);
});

test('streamCollect returns every line as an array', async () => {
  const ctx = streamCtx();
  const lines = await ctx.streamCollect(ctx.streamFromLines(['x', 'y']));
  assert.deepStrictEqual([...lines], ['x', 'y']);
});

test('streamNormalize passes null through, wraps arrays, leaves sources alone', async () => {
  const ctx = streamCtx();
  assert.strictEqual(ctx.streamNormalize(null), null);
  assert.strictEqual(ctx.streamNormalize(undefined), null);
  assert.deepStrictEqual(await drain(ctx.streamNormalize(['q'])), ['q']);
  const src = ctx.streamFromLines(['z']);
  assert.strictEqual(ctx.streamNormalize(src), src);
});

// This is the property the whole phase turns on: a consumer must see a line
// before the producer has finished. If this passes with a buffered
// implementation it proves nothing, so the producer is deliberately never
// closed - a buffered implementation would hang here rather than fail.
test('a push stream delivers a line before it is closed', async () => {
  const ctx = streamCtx();
  const push = ctx.makePushStream();
  const iter = push[Symbol.asyncIterator]();
  const pending = iter.next();
  push.push('early');
  const first = await pending;
  assert.strictEqual(first.done, false);
  assert.strictEqual(first.value, 'early');
});

test('a push stream ends when closed and drains what it still holds', async () => {
  const ctx = streamCtx();
  const push = ctx.makePushStream();
  push.push('one');
  push.push('two');
  push.close();
  assert.deepStrictEqual(await drain(push), ['one', 'two']);
});

test('a push stream that fails drains its buffered lines first, then throws', async () => {
  const ctx = streamCtx();
  const push = ctx.makePushStream();
  push.push('kept');
  push.fail(new Error('boom'));
  const seen = [];
  await assert.rejects(async () => {
    for await (const line of push) seen.push(line);
  }, /boom/);
  assert.deepStrictEqual(seen, ['kept'], 'lines already produced are not discarded by a later failure');
});

test('pushing after close is ignored rather than resurrecting the stream', async () => {
  const ctx = streamCtx();
  const push = ctx.makePushStream();
  push.push('a');
  push.close();
  push.push('b');
  assert.deepStrictEqual(await drain(push), ['a']);
});
