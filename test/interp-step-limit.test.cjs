'use strict';
// Phase 6 uncaps worker scripts so RUNAWAY.exe can genuinely run away, and
// keeps the cap on the main thread because nothing can preempt it there.
// kernelExit calls worker.terminate() unconditionally (os/kernel.js:188), so
// an uncapped worker is always killable - that, not optimism, is what makes
// removing the ceiling safe.
const test = require('node:test');
const assert = require('node:assert');
const { makeOsContext, loadOsSources } = require('./helpers/load-os.cjs');

function interpCtx() {
  const ctx = makeOsContext({
    fsNormalizeDir: d => String(d || ''),
    performance: { now: () => 0 },
  });
  return loadOsSources(ctx, ['os/park.js', 'os/script/interp.js']);
}

// 12000 iterations: comfortably past SCRIPT_MAX_STEPS (10000) and small
// enough to finish fast. Each pass costs several instructions, so the step
// count is well above the cap either way. The trailing EXIT 0 matters: the
// loop's last executed instruction on a normal completion is the failing IF
// (I finally reaches 12000), which by itself leaves status 1 - EXIT 0 is
// what makes an uncapped run report success rather than "loop condition
// went false".
const LOOP = [
  'SET I 0',
  ':loop',
  'INC I',
  'IF $I < 12000 GOTO loop',
  'EXIT 0',
].join('\n');

test('the default cap still stops a runaway on the main thread', async () => {
  const ctx = interpCtx();
  const printed = [];
  const code = await ctx.execScript(LOOP, line => printed.push(String(line)), {});
  assert.notStrictEqual(code, 0, 'a script past the cap must not report success');
  assert.ok(
    printed.some(l => /Instruction limit exceeded/i.test(l)),
    'the cap must say why it stopped, not fail silently: ' + JSON.stringify(printed),
  );
});

test('maxSteps Infinity lets the same script run to completion', async () => {
  const ctx = interpCtx();
  const printed = [];
  const code = await ctx.execScript(LOOP, line => printed.push(String(line)), { maxSteps: Infinity });
  assert.strictEqual(code, 0, 'an uncapped run must finish normally: ' + JSON.stringify(printed));
  assert.ok(
    !printed.some(l => /Instruction limit exceeded/i.test(l)),
    'an uncapped run must not report a limit it does not have',
  );
});

test('an explicit low maxSteps overrides the default in the other direction', async () => {
  const ctx = interpCtx();
  const printed = [];
  const code = await ctx.execScript(LOOP, line => printed.push(String(line)), { maxSteps: 50 });
  assert.notStrictEqual(code, 0);
  assert.ok(printed.some(l => /Instruction limit exceeded/i.test(l)));
});
