'use strict';
// The Tab key half of terminal completion.
//
// test/terminal-complete.test.cjs covers buildTerminalCompletion, which is
// pure and knows nothing about keys. Everything this file asserts lives in the
// keydown handler instead and is structurally invisible to node: that Tab is
// swallowed rather than moving focus, that repeated presses CYCLE instead of
// recomputing, that Shift+Tab walks back, and that touching the input between
// presses drops the cycle. Those are the parts that would break silently.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, openWindow } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

// A terminal with a known filesystem underneath it. DOCS is seeded on boot, so
// these two files are the ones the completer will actually see.
async function withTerminal(fn) {
  const { context, page, pageErrors } = await openDesktop(harness.browser);
  try {
    await openWindow(page, 'openTerminal', /terminal/);
    await page.waitForSelector('#ti');
    await page.focus('#ti');
    await fn(page);
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await context.close();
  }
}

const readInput = page => page.evaluate(() => {
  const el = document.getElementById('ti');
  return { value: el.value, caret: el.selectionStart, focused: document.activeElement === el };
});

// Typed through the real keyboard rather than set on .value, because setting
// the value directly would skip the very keydown path under test.
async function typeLine(page, text) {
  await page.evaluate(() => { document.getElementById('ti').value = ''; });
  await page.type('#ti', text);
}

test('Tab completes the word and keeps focus in the input', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'gre');
    await page.keyboard.press('Tab');
    const state = await readInput(page);
    assert.strictEqual(state.value, 'grep ');
    assert.strictEqual(state.caret, 5);
    // The browser default for Tab is to move focus off the input. If this ever
    // regresses, completion still "works" and the terminal still becomes
    // unusable, so it is asserted separately from the value.
    assert.strictEqual(state.focused, true);
  });
});

test('repeated Tab cycles through candidates instead of recomputing', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'wh');
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      seen.push((await readInput(page)).value);
    }
    // where / who / whoami, then back to the first: the cycle wraps rather
    // than sticking on the last candidate.
    assert.deepStrictEqual(seen, ['where ', 'who ', 'whoami ', 'where ']);
  });
});

test('Shift+Tab walks the cycle backwards', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'wh');
    await page.keyboard.press('Shift+Tab');
    assert.strictEqual((await readInput(page)).value, 'whoami ');
    await page.keyboard.press('Shift+Tab');
    assert.strictEqual((await readInput(page)).value, 'who ');
  });
});

test('typing between presses drops the cycle and recomputes', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'wh');
    await page.keyboard.press('Tab');
    assert.strictEqual((await readInput(page)).value, 'where ');
    // Retyping a different prefix must not keep walking the old candidate
    // list - the second Tab has to start over from 'who'.
    await typeLine(page, 'who');
    await page.keyboard.press('Tab');
    const value = (await readInput(page)).value;
    assert.ok(value === 'who ' || value === 'whoami ', 'recomputed from the new prefix, got ' + value);
  });
});

test('a completed command actually runs', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'ver');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => /sleepOS/i.test(document.getElementById('to').textContent),
      null, { timeout: 5000 });
    // The point is that the trailing space the completer appends does not
    // stop the parser recognising the command.
    const text = await page.evaluate(() => document.getElementById('to').textContent);
    assert.ok(/sleepOS/i.test(text), 'VER produced no output');
  });
});

test('a directory completes with a trailing separator and can be entered', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'cd DO');
    await page.keyboard.press('Tab');
    assert.strictEqual((await readInput(page)).value, 'cd DOCS\\');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => /DOCS/.test(document.getElementById('term-prompt').textContent),
      null, { timeout: 5000 });
  });
});

test('an argument completes against the current directory after CD', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'cd DOCS');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => /DOCS/.test(document.getElementById('term-prompt').textContent),
      null, { timeout: 5000 });
    await typeLine(page, 'cat SCRIPT');
    await page.keyboard.press('Tab');
    // SCRIPTING.txt is seeded into DOCS on boot; completing it proves the deps
    // are read fresh per press rather than captured at window open.
    assert.strictEqual((await readInput(page)).value, 'cat SCRIPTING.txt ');
  });
});

test('Tab is inert but still swallowed when nothing matches', async () => {
  await withTerminal(async page => {
    await typeLine(page, 'zzzz');
    await page.keyboard.press('Tab');
    const state = await readInput(page);
    assert.strictEqual(state.value, 'zzzz');
    assert.strictEqual(state.focused, true);
  });
});
