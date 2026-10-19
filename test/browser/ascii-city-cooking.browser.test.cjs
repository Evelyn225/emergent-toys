'use strict';
// Cooking (cooking.js, cooking-ui.js), in the real page: a home's stove, the panel of what you can make (butter from the
// fridge), the pan played through, the dish in your bag and eaten; a beach grill's prompt; and it's all kept.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;

test('at the stove at home: E for the panel, 1 cooks, the pan played, a dish in your bag; the grills outside; kept', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof openCooking === 'function' && Number.isFinite(eye));
    await page.evaluate(() => localStorage.clear());
    const at = await page.evaluate(() => {
      paused = true; clearWanted(); sleep = null; mode = 'walk'; room = null; px = 41; py = 73; money = 20000;
      buy('home_studio'); const h = owned.homes[0], def = ROOM_DEFS.home;
      enterRoom('home', { cell: [h.cell % N, Math.floor(h.cell / N)], ret: [41, 73, 0] }, def.entry);
      [px, py] = def.spots.stove; a = 0;
      clearInventory(); carryItem({ id: 'mackerel', uses: 0, kg: 0.9 }); h.fridge.push({ id: 'butter', uses: 0 });
      const prompt = promptText(); interact();
      return { prompt, open: panelOpen(), first: document.querySelector('#cooking [data-cook]').textContent };
    });
    assert.equal(at.prompt, 'E: cook');
    assert.ok(at.open);
    assert.match(at.first, /pan-fried fish/);
    await page.keyboard.press('Digit1');
    const playing = await page.evaluate(() => ({ id: game && game.g.id, kind: game && game.kind, panel: panelOpen() }));
    assert.deepEqual(playing, { id: 'cook', kind: 'cook', panel: false });
    const done = await page.evaluate(() => { // play it through: the heat mid-band, every move on time
      const [lo, hi] = HOW.pan.band;
      for (let t = 0; t < 60 && !game.g.over; t += 1 / 30) { const s = game.g.state(), m = s.moves.find(m => m.state === 'now'); game.g.step(1 / 30, { act: s.heat < (lo + hi) / 2 ? 1 : 0, upP: m && m.t > 0.25 ? 1 : 0 }); }
      stepGame(1 / 30); return { result: game.g.result, inv: inv.map(it => it.id), fridge: owned.homes[0].fridge.length, line: msgText };
    });
    assert.deepEqual(done.inv, ['panfish']);
    assert.equal(done.result, 'perfect');
    assert.equal(done.fridge, 0, 'the butter came out of the fridge');
    assert.match(done.line, /^Perfect\. Pan-fried mackerel/);
    await page.keyboard.press('Space'); // (the results card)
    const eaten = await page.evaluate(() => { const was = needs.food = 30; held = 0; useHeldItem(); return { game, more: needs.food > was, fed: fx.fed > 0 }; });
    assert.deepEqual(eaten, { game: null, more: true, fed: true });
    // out on the beach: a grill
    const grill = await page.evaluate(() => { leaveRoom(); const o = GRILLS.find(g => g.on === 'grill'); mode = 'walk'; px = o.x - 0.2; py = o.y; a = 0; return promptText(); });
    assert.equal(grill, 'E: cook on the grill');
    // kept: how a dish turned out, and the fish in it
    await page.evaluate(() => { clearInventory(); carryItem({ id: 'panfish', uses: 2, q: 'perfect', of: 'seabass' }); carryItem({ id: 'eggs', uses: 0 }); saveGame(); });
    await page.reload();
    await page.waitForFunction(() => typeof inv !== 'undefined' && Number.isFinite(eye));
    assert.deepEqual(await page.evaluate(() => inv), [{ id: 'panfish', uses: 2, q: 'perfect', of: 'seabass' }, { id: 'eggs', uses: 0 }]);
    await page.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
