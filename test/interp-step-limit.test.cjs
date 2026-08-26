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

// The `run <script>` instruction spawns a nested script through a SECOND
// execScript call (os/script/interp.js:542). It reads maxSteps off `state`
// because execScriptInstruction is a separate top-level function that cannot
// see execScript's local. Without that, a worker script's nested RUN would
// silently re-cap at 10000 - the exact bug this task removes, and invisible
// to every other test here.
const NESTED_CHILD = [
  'SET J 0',
  ':c',
  'INC J',
  'IF $J < 12000 GOTO c',
  'EXIT 0',
].join('\n');

function nestedFs() {
  return {
    stat: async (name) => (name === 'child.script'
      ? { name: 'child.script', dirName: '', kind: 'text' }
      : null),
    readFile: async () => NESTED_CHILD,
    notifyChanged: async () => {},
  };
}

test('a nested RUN inherits an uncapped parent\'s ceiling', async () => {
  const ctx = interpCtx();
  const printed = [];
  const code = await ctx.execScript('RUN child.script', line => printed.push(String(line)), {
    fs: nestedFs(),
    maxSteps: Infinity,
  });
  assert.strictEqual(code, 0, 'nested child must not re-cap: ' + JSON.stringify(printed));
  assert.ok(
    !printed.some(l => /Instruction limit exceeded/i.test(l)),
    'nested child hit a limit its parent does not have: ' + JSON.stringify(printed),
  );
});

test('a nested RUN inherits a capped parent\'s ceiling too', async () => {
  const ctx = interpCtx();
  const printed = [];
  const code = await ctx.execScript('RUN child.script', line => printed.push(String(line)), {
    fs: nestedFs(),
  });
  assert.notStrictEqual(code, 0);
  assert.ok(
    printed.some(l => /Instruction limit exceeded/i.test(l)),
    'a capped parent must still cap its child: ' + JSON.stringify(printed),
  );
});
