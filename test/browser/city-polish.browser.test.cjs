'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox, devices } = require('playwright');

const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => { browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch(); });
test.after(async () => { await browser?.close(); });
async function withCity(mobile, fn) {
  const page = await browser.newPage(mobile
    ? { hasTouch: true, userAgent: devices['iPhone 13'].userAgent, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
    : { viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => { paused = false; mode = 'walk'; room = me = null; T = 10; tod = 12; env(0); render(0); });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('cooked meals and catches remain identifiable in bag, storage, shop and hotbar', () => withCity(false, async page => {
  const result = await page.evaluate(() => {
    clearInventory();
    for (const item of [{ id: 'panfish', uses: 3, q: 'perfect', of: 'seabass' }, { id: 'panfish', uses: 1, q: 'burnt', of: 'mackerel' }, { id: 'tuna', uses: 0, kg: 30 }]) carryItem(item, false);
    openInventory(); const bag = [...invEl.querySelectorAll('[data-slot]')].map(b => b.textContent); closeInventory();
    openStorage(); const storage = [...storeEl.querySelectorAll('[data-store]')].map(b => b.textContent); hidePanel(storeEl);
    openShop('BAIT & TACKLE', ['rod']); const shop = [...shopEl.querySelectorAll('[data-sell]')].map(b => b.textContent); closeShop();
    const text = g.fillText, hot = [];
    g.fillText = function (s, ...args) { hot.push(s); return text.call(this, s, ...args); };
    try { hotbar(); } finally { g.fillText = text; }
    return { bag, storage, shop, hot };
  });
  for (const labels of Object.values(result)) {
    const text = labels.join(' ');
    assert.match(text, /perfect pan-fried sea bass/);
    assert.match(text, /burnt pan-fried mackerel/);
    assert.match(text, /30kg bluefin tuna/);
  }
}));

test('the phone map keeps every control on screen and Close returns to Pause', () => withCity(true, async page => {
  for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { if (!paused) openPause(); openBigMap(); bigMapDraw(); });
    await page.evaluate(() => document.fonts.ready);
    const controls = await page.evaluate(() => [...bigMapEl.querySelectorAll('.bar button,.bar input')].map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el };
    }));
    for (const c of controls) { assert.ok(c.left >= 0 && c.right <= width && c.width > 30); assert.ok(c.hit); }
    await page.locator('#bigmap [data-map="close"]').click();
    assert.deepEqual(await page.evaluate(() => ({ map: bigMapOpen(), pause: pauseEl.style.display, home: homeEl.style.display })), { map: false, pause: 'flex', home: 'block' });
    assert.equal(page.url(), PAGE);
  }
}));

test('long quick slots and effects wrap within phone bounds and leave the interaction prompt clear', () => withCity(true, async page => {
  await page.evaluate(() => {
    clearInventory();
    for (const id of ['hotelmasterpiece', 'strayfish', 'skewers', 'pocketwatch', 'snowglobe', 'chickencurry', 'carbonrod', 'petcat']) carryItem({ id, uses: ITEMS[id].uses || 0 }, false);
    inv[2] = { id: 'panfish', uses: 3, q: 'perfect', of: 'seabass' };
    held = 0; fx.caffeine = fx.fresh = fx.fed = 30; fx.booze = .8; fx.boombox = true;
    const grill = GRILLS.find(o => o.on === 'grill'); px = grill.x - .2; py = grill.y;
  });
  for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const r = await page.evaluate(() => {
      resize(); g.font = FS + 'px monospace'; g.textBaseline = 'top';
      const text = g.fillText, cells = [], prompts = [];
      let collectingHotbar = true;
      g.fillText = function (s, x, y, ...args) {
        const entry = { s, x, y, right: x + g.measureText(s).width, bottom: y + parseFloat(g.font) };
        if (collectingHotbar) cells.push(entry);
        else if (g.fillStyle === '#ffff88') prompts.push(entry);
        return text.call(this, s, x, y, ...args);
      };
      try {
        const top = hotbar(); collectingHotbar = false; showTouch(); hud();
        return { cells, prompts, top, maxX: cv.width - TOUCH_PAD_W - 6 };
      } finally { g.fillText = text; }
    });
    assert.ok(r.cells.length > 8);
    for (const c of r.cells) assert.ok(c.x >= 6 && c.right <= r.maxX && c.y >= 0 && c.bottom < height, JSON.stringify(c));
    assert.ok(r.prompts.length > 0);
    for (const p of r.prompts) assert.ok(p.bottom + 4 < r.top, `${p.s} overlaps hotbar at ${width}x${height}`);
  }
}));

test('shop shortcuts stop at nine while later stock remains clickable', () => withCity(false, async page => {
  const r = await page.evaluate(() => {
    clearInventory(); money = 1000; openShop('GROCERY', STOCK_WORD.GROCERY);
    return { hint: shopEl.querySelector('.hint').textContent, shortcuts: [...shopEl.querySelectorAll('[data-buy] .k')].map(el => el.textContent), tenth: shopCtx.stock[9] };
  });
  assert.ok(r.shortcuts.length > 9);
  assert.deepEqual(r.shortcuts.slice(0, 9), ['1','2','3','4','5','6','7','8','9']);
  assert.ok(r.shortcuts.slice(9).every(s => s === ''));
  assert.match(r.hint, /1-9 buy.*click any item/);
  await page.locator(`[data-buy="${r.tenth}"]`).click();
  assert.deepEqual(await page.evaluate(() => inv.map(it => it.id)), [r.tenth]);
}));

test('FOV bar follows the full slider range and Start over disarms on Resume', () => withCity(false, async page => {
  await page.evaluate(() => openPause());
  const bars = [];
  for (const value of [50, 100, 110, 120]) {
    await page.locator('[data-set="fov"]').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    bars.push(await page.locator('[data-bar="fov"]').innerHTML());
  }
  assert.equal(new Set(bars).size, 4);
  assert.ok(await page.evaluate(() => Math.abs(FOV - 120 * Math.PI / 180) < .001));
  await page.locator('[data-act="newgame"]').click();
  assert.match(await page.locator('[data-act="newgame"]').textContent(), /Click again/);
  await page.locator('[data-act="resume"]').click();
  await page.evaluate(() => openPause());
  assert.equal(await page.locator('[data-act="newgame"]').textContent(), 'Start over');
  assert.equal(await page.locator('[data-act="newgame"]').getAttribute('data-sure'), null);
}));

test('touch cooking provides Heat, Add and the recipe action; buttons heat and complete real moves', () => withCity(true, async page => {
  const completed = { up: 0, down: 0 };
  for (const [recipe, verb] of [['omelette','Flip'], ['risotto','Stir'], ['roastchicken','Turn']]) {
    await page.evaluate(id => { startGame('cook', 'cook', '', { recipe: id }); game.onDone = () => {}; showTouch(); drawGame(); }, recipe);
    assert.deepEqual(await page.locator('#touch .pad button').allTextContents(), ['Off heat', 'Add', verb, 'Heat (hold)']);
    const heat = page.locator('#touch .pad [data-key="Space"]');
    const before = await page.evaluate(() => game.g.state().heat);
    await heat.dispatchEvent('touchstart');
    const after = await page.evaluate(() => { stepGame(.2); return game.g.state().heat; });
    await heat.dispatchEvent('touchend');
    assert.ok(after > before);
    // Advance to the actual timed moves, then use the same touch buttons as the player.
    for (let n = 0; n < 20; n++) {
      const key = await page.evaluate(() => {
        for (let t = 0; t < 90 && !game.g.over; t += .05) {
          const s = game.g.state(), m = s.moves.find(m => m.state === 'now');
          if (m) return m.key;
          game.g.step(.05, { act: s.heat < .6 });
        }
        return null;
      });
      if (!key) break;
      const button = page.locator(`#touch .pad [data-key="${key === 'up' ? 'ArrowUp' : 'ArrowDown'}"]`);
      await button.dispatchEvent('touchstart');
      const done = await page.evaluate(() => { const m = game.g.state().moves.find(m => m.state === 'now'); stepGame(.01); return m.state; });
      await button.dispatchEvent('touchend');
      assert.equal(done, 'done');
      completed[key]++;
    }
    const help = await page.evaluate(() => gameText(game.g.status(), game.g));
    assert.match(help, /HOLD HEAT/);
    assert.ok(!/SPACE|UP|DOWN/.test(help));
    const cue = await page.evaluate(() => gameText('FLIP IT!  [UP]   ADD CHEESE!  [DOWN]', game.g));
    assert.ok(!/\[UP\]|\[DOWN\]/.test(cue));
  }
  assert.ok(completed.up > 0 && completed.down > 0, 'both cooking action buttons must complete timed moves');
}));
