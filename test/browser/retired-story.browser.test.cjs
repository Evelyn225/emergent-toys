'use strict';
// sleepOS used to carry a containment story that wrote its own files into
// DOCS, SYS and CACHE and kept its progress in localStorage. Every profile
// that booted while it existed has SYS\anchor.seed persisted, because the
// story wrote it on first boot. purgeRetiredStoryFiles (os/fs-persist.js)
// removes that residue once, on the next boot - and only that residue.
//
// This is a persistence claim, so it can only be tested across a real reload
// of the same browser context: node's vm harness has no IndexedDB to persist
// into and no boot to run the purge from.
const test = require('node:test');
const assert = require('node:assert');
const { startHarness, openDesktop, rebootDesktop } = require('./helpers/os-page.cjs');

let harness;
test.before(async () => { harness = await startHarness(); });
test.after(async () => { if (harness) await harness.stop(); });

const RETIRED = ['SYS\\anchor.seed', 'SYS\\quarantine.sig', 'DOCS\\NOTICE_13.txt', 'CACHE\\mirror.dat'];

const present = (page, paths) => page.evaluate(ps => ps.filter(p => vfsStatSync(p, '')), paths);

test('a pre-removal profile loses the story files and key on the next boot, and keeps its own files', async () => {
  const { context, page, pageErrors } = await openDesktop(harness.browser);
  try {
    // Recreate what a profile from before the removal has on disk.
    await page.evaluate(async retired => {
      ensureFsDir('SYS');
      ensureFsDir('CACHE');
      for (const p of retired) await vfsWriteFile(p, 'left over from the story', '');
      await vfsWriteFile('SYS\\keep.txt', 'mine', '');
      await vfsFlush();
      localStorage.setItem('sleepOS-daemon-story', '{"stage":4,"openedDaemon":true}');
    }, RETIRED);
    assert.deepStrictEqual(await present(page, RETIRED), RETIRED, 'sanity: the residue was written');

    await rebootDesktop(page);
    await page.waitForFunction(ps => ps.every(p => !vfsStatSync(p, '')), RETIRED, { timeout: 10000 });
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('sleepOS-daemon-story')), null);
    assert.ok(await page.evaluate(() => vfsStatSync('SYS\\keep.txt', '')), 'a player file beside them must survive');

    // The unlinks are committed, not just applied to the in-memory tree: a
    // second boot must not find them restored from the backend.
    await page.evaluate(() => vfsFlush());
    await rebootDesktop(page);
    assert.deepStrictEqual(await present(page, RETIRED), []);
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await context.close();
  }
});

test('nothing on a fresh desktop is left over from the story', async () => {
  const { context, page, pageErrors } = await openDesktop(harness.browser);
  try {
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('#icons-layer .di-name')].map(n => n.textContent.trim().toLowerCase()));
    for (const gone of ['daemon.core', 'void.tmp', '?????.exe']) {
      assert.ok(!names.includes(gone), gone + ' is still on the desktop: ' + names.join(', '));
    }
    assert.strictEqual(await page.evaluate(() => typeof daemonStory), 'undefined');
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await context.close();
  }
});
