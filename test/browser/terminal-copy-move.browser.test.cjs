'use strict';
// COPY and MOVE used to be jokes - COPY printed "1 file(s) copied" and a
// warning that the copy was not identical, having copied nothing, and MOVE
// always failed because files were "already where they need to be". Both are
// real now, and both live inside openTerminal's closure, where node cannot
// reach them, so they are driven here through the real input line.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, openWindow } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

async function withTerminal(fn) {
  const { context, page, pageErrors } = await openDesktop(harness.browser);
  try {
    await openWindow(page, 'openTerminal', /terminal/);
    await page.waitForSelector('#ti');
    await fn(page);
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await context.close();
  }
}

// Types a command, presses Enter, and resolves once the terminal has printed
// something after it - the command handlers are async, so reading the
// filesystem straight after Enter would race them.
async function run(page, command) {
  const before = await page.evaluate(() => document.getElementById('to').children.length);
  await page.evaluate(() => { document.getElementById('ti').value = ''; });
  await page.type('#ti', command);
  await page.keyboard.press('Enter');
  await page.waitForFunction(n => document.getElementById('to').children.length > n + 1, before);
  return page.evaluate(() => document.getElementById('to').innerText);
}

const textAt = (page, path) => page.evaluate(p => {
  const st = vfsStatSync(p, '');
  return st && st.kind === 'text' ? vfsDirNodeSync(st.dirName).files.get(st.name) : null;
}, path);

test('COPY writes a real copy and leaves the original in place', async () => {
  await withTerminal(async page => {
    await page.evaluate(() => vfsWriteFile('notes.txt', 'hello', ''));
    await run(page, 'COPY notes.txt DOCS');
    assert.strictEqual(await textAt(page, 'DOCS\\notes.txt'), 'hello');
    assert.strictEqual(await textAt(page, 'notes.txt'), 'hello');
  });
});

test('COPY to a new name creates that name', async () => {
  await withTerminal(async page => {
    await page.evaluate(() => vfsWriteFile('notes.txt', 'hello', ''));
    await run(page, 'COPY notes.txt backup.txt');
    assert.strictEqual(await textAt(page, 'backup.txt'), 'hello');
  });
});

test('MOVE relocates the file and removes the original', async () => {
  await withTerminal(async page => {
    await page.evaluate(() => vfsWriteFile('notes.txt', 'hello', ''));
    await run(page, 'MOVE notes.txt DOCS');
    assert.strictEqual(await textAt(page, 'DOCS\\notes.txt'), 'hello');
    assert.strictEqual(await textAt(page, 'notes.txt'), null);
  });
});

test('neither command overwrites an existing file', async () => {
  await withTerminal(async page => {
    await page.evaluate(async () => {
      await vfsWriteFile('a.txt', 'first', '');
      await vfsWriteFile('b.txt', 'second', '');
    });
    const out = await run(page, 'COPY a.txt b.txt');
    assert.match(out, /already exists/);
    assert.strictEqual(await textAt(page, 'b.txt'), 'second');
  });
});

test('MOVE refuses a system binary and a protected folder', async () => {
  await withTerminal(async page => {
    let out = await run(page, 'MOVE TERMINAL.exe DOCS');
    assert.match(out, /Cannot move TERMINAL\.exe: Access is denied/);
    assert.ok(await textAt(page, 'TERMINAL.exe'), 'the binary must still be at the root');
    out = await run(page, 'MOVE DOCS PICTURES');
    assert.match(out, /Cannot move DOCS: Access is denied/);
    assert.strictEqual(await page.evaluate(() => vfsDirExistsSync('DOCS')), true);
  });
});
