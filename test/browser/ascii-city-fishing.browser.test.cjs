'use strict';
// Fishing (fishing.js, fishing-render.js), in the real page and with the real keys: buy a rod at the bait hut's hatch,
// hold Q to wind up and let go to cast, watch the bobber, strike when it goes under, and sell the catch back at the hut.
// The rod's drawn in your hand and the line and bobber out on the water; it's all kept across a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;

test('buy a rod at the hut, cast with Q, strike on the bite, land it, sell it back; the rod and line are drawn', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepFishing === 'function' && Number.isFinite(eye));
    await page.evaluate(() => localStorage.clear());
    // at the hatch: E opens the hut's counter, 1 buys the rod
    const shop = await page.evaluate(() => {
      paused = true; clearWanted(); sleep = null; mode = 'walk'; room = null; tod = 11; weather = 'clear'; rain = 0; clearInventory(); money = 100;
      px = FISH_HUT.x + FISH_HUT.hatch; py = FISH_HUT.y - FISH_HUT.hw - 0.2; a = Math.PI / 2; body.z = body.vz = 0; body.seat = null;
      const prompt = promptText(); interact();
      return { prompt, open: panelOpen(), title: shopCtx && shopCtx.title };
    });
    assert.match(shop.prompt, /^E: bait & tackle/);
    assert.deepEqual([shop.open, shop.title], [true, 'BAIT & TACKLE']);
    await page.keyboard.press('Digit1'); await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [heldItem() && heldItem().id, money]), ['rod', 65]);
    // out to the sea wall west of the hut, facing the bay: hold Q, let go
    await page.evaluate(() => { px = FISH_HUT.x - 3; py = shoreS(px) - 0.25; a = Math.PI / 2; pitch = 0; paused = false; });
    await page.keyboard.down('KeyQ');
    await page.waitForFunction(() => fishing && fishing.st === 'wind' && fishing.power > 0.4);
    await page.keyboard.up('KeyQ');
    await page.waitForFunction(() => fishing && fishing.st === 'wait', null, { timeout: 10000 });
    const out = await page.evaluate(() => {
      paused = true; render(0);
      const G = rodGeom(), shot = handDrawn;
      const bob = fishProj(rel(fishing.x - px), rel(fishing.y - py), 0.005);
      return { water: fishing.water, dist: Math.hypot(rel(fishing.x - px), rel(fishing.y - py)), hand: shot && shot.id, tipOnScreen: G.tip.x > 0 && G.tip.x < cv.width && G.tip.y > 0 && G.tip.y < cv.height,
        bobber: bob && CH[Math.floor(bob.r) * cols + Math.floor(bob.c)], prompt: promptText() };
    });
    assert.equal(out.water, 'sea');
    assert.ok(out.dist > 0.5, `a decent cast: ${out.dist}`);
    assert.equal(out.hand, 'rod');
    assert.ok(out.tipOnScreen);
    assert.match(out.bobber, /[o@#%*=+]/, 'the bobber, out on the water');
    assert.match(out.prompt, /Waiting for a bite/);
    // hurry the fish along: it comes in, takes it, and Q strikes
    await page.evaluate(() => { fishing.next = 0; ITEMS.rod.rod.window = 6; paused = false; }); // (a long window: CI's slow)
    await page.waitForFunction(() => fishing && fishing.st === 'bite', null, { timeout: 10000 });
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => fishing && fishing.st === 'landed', null, { timeout: 10000 });
    const caught = await page.evaluate(() => { paused = true; return { it: inv[1], line: msgText, held: heldItem().id }; });
    assert.ok(caught.it, 'something in the bag');
    assert.equal(caught.held, 'rod');
    // back to the hatch: shift+2 sells (or bins) it
    const sold = await page.evaluate(() => {
      fishing = null; px = FISH_HUT.x + FISH_HUT.hatch; py = FISH_HUT.y - FISH_HUT.hw - 0.2; a = Math.PI / 2; interact();
      return { money, rows: [...document.querySelectorAll('#shop [data-sell]')].map(b => b.textContent) };
    });
    assert.ok(sold.rows.length === 2 && /rod/.test(sold.rows[0]), sold.rows.join(' | '));
    await page.keyboard.down('Shift'); await page.keyboard.press('Digit2'); await page.keyboard.up('Shift');
    const after = await page.evaluate(() => ({ money, n: inv.length, panel: panelOpen() }));
    assert.equal(after.n, 1, 'gone from the bag');
    assert.ok(after.money >= sold.money);
    await page.keyboard.press('Escape');
    // kept: a fish's weight, and your best
    await page.evaluate(() => { clearInventory(); carryItem({ id: 'rod', uses: 0 }); carryItem({ id: 'carp', uses: 0, kg: 4.2 }, false); fishLog.caught = 3; fishLog.best = { id: 'carp', kg: 4.2 }; saveGame(); });
    await page.reload();
    await page.waitForFunction(() => typeof fishLog !== 'undefined' && Number.isFinite(eye));
    const back = await page.evaluate(() => ({ carp: inv.find(it => it.id === 'carp'), log: fishLog }));
    assert.deepEqual(back, { carp: { id: 'carp', uses: 0, kg: 4.2 }, log: { caught: 3, best: { id: 'carp', kg: 4.2 } } });
    await page.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
