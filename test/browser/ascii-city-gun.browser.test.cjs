'use strict';
// The revolver (gun.js, gun-ui.js), in the real page: bought under the pawnbroker's counter after nine, in your hand
// with the crosshair over the middle of the screen, Q firing (the flash, the streak, the body), R reloading; the
// fortune teller's word to somebody with a name for themselves; and no fine for a killing.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;

test('the pawnbroker after nine, the gun in your hand, Q and R, the fortune teller, and no fine for a killing', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof pullTrigger === 'function' && Number.isFinite(eye));
    await page.evaluate(() => localStorage.clear());
    // the pawn shop: nothing under the counter at noon; after nine, the revolver and the rounds
    const shop = await page.evaluate(() => {
      paused = true; clearWanted(); sleep = null; money = 5000; clearInventory(); tod = 12;
      const noon = stockFor('pawn', 'PAWN').includes('revolver');
      tod = 22; openShop('PAWN', stockFor('pawn', 'PAWN'));
      const rows = [...document.querySelectorAll('#shop [data-buy]')].map(b => b.dataset.buy);
      shopBuy('revolver'); shopBuy('ammo'); closeShop();
      return { noon, rows, inv: inv.map(it => it.id), line: msgText };
    });
    assert.equal(shop.noon, false);
    assert.deepEqual(shop.rows.slice(-2), ['revolver', 'ammo']);
    assert.deepEqual(shop.inv, ['revolver', 'ammo']);
    // out on the sidewalk outside a shop, the gun in hand: R loads it (and doesn't tip your head back), Q fires
    const out = await page.evaluate(() => {
      const door = doors.find(d => d.use === 'shop' && d.dist === 'midtown');
      mode = 'walk'; room = null; px = door.x; py = door.y; a = door.ny ? 0 : Math.PI / 2; pitch = 0; held = 0;
      for (const p of people) { p.hidden = true; p.x = mod(px + 40, N); }
      for (const c of footCops) c.x = mod(px + 120, N);
      const who = people[0]; Object.assign(who, { x: mod(px + Math.cos(a) * 0.6, N), y: mod(py + Math.sin(a) * 0.6, N), hidden: false, path: [], talk: 99, wait: 0 }); // (stopped, talking to somebody)
      paused = false; return true;
    });
    assert.ok(out);
    await page.keyboard.down('KeyR'); await page.waitForTimeout(100); await page.keyboard.up('KeyR');
    const loading = await page.evaluate(() => ({ reload: gun.reload > 0, pitch }));
    assert.ok(loading.reload, 'R reloads');
    assert.equal(loading.pitch, 0, 'and doesn\'t look up');
    await page.waitForFunction(() => gun.reload === 0 && inv[0].uses === 6, null, { timeout: 5000 });
    await page.keyboard.press('KeyQ');
    const shot = await page.evaluate(() => ({ what: gun.shots.at(-1).what, dead: !!people[0].dead, left: inv[0].uses, wanted: wanted.fired }));
    assert.deepEqual(shot, { what: 'person', dead: true, left: 5, wanted: true });
    await page.waitForTimeout(150);
    const drawn = await page.evaluate(() => { paused = true; render(0); return { hand: handDrawn && handDrawn.id, crosshair: aimLook.t >= 0 }; });
    assert.deepEqual(drawn, { hand: 'revolver', crosshair: true });
    // the fortune teller, to somebody known for it: the pawn shop after nine (once a day)
    const told = await page.evaluate(() => { noto.level = NOTO_KNOWN + 5; clearInventory(); const first = tellFortune(), again = tellFortune(); return { first, again }; });
    assert.match(told.first, /pawnbroker.*under the counter.*After nine/s);
    assert.doesNotMatch(told.again, /pawnbroker/);
    // busted for a killing: no fine on offer
    const busted = await page.evaluate(() => { money = 5000; addWanted('murder', px, py, true); openBusted(); const fine = document.querySelector('#busted [data-fine]').disabled; bustedChoice('jail'); return { fine, room: room && room.kind }; });
    assert.deepEqual(busted, { fine: true, room: 'jail' });
    await page.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
