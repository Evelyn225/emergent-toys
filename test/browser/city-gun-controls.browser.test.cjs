'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');

const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => {
  browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch();
});
test.after(async () => { await browser?.close(); });

async function withGun(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => {
      inv.length = 0; inv.push({ id: 'revolver', uses: 6 }, { id: 'ammo', uses: 24 }); held = 0;
      mode = 'walk'; paused = false; px = 41.5; py = 73.5; a = pitch = 0; room = null; me = null;
      people.forEach(p => p.hidden = true); cars.length = footCops.length = 0;
      env(0); render(0);
    });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('the capture click is harmless; left click then uses the item like Q, with independent hold state', () => withGun(async page => {
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => mouseCaptured());
  assert.equal(await page.evaluate(() => heldGun().uses), 6);
  await page.mouse.down();
  assert.deepEqual(await page.evaluate(() => [heldGun().uses, usingHeldItem(), gun.shots.length]), [5, true, 1]);
  await page.keyboard.down('KeyQ');
  await page.mouse.up();
  assert.equal(await page.evaluate(() => usingHeldItem()), true, 'Q remains held after releasing the mouse');
  await page.keyboard.up('KeyQ');
  assert.equal(await page.evaluate(() => usingHeldItem()), false);
  await page.evaluate(() => { T += .4; stepGun(.4); });
  await page.keyboard.press('KeyQ');
  assert.equal(await page.evaluate(() => heldGun().uses), 4);
  await page.evaluate(() => {
    inv.push({ id: 'pocketwatch', uses: 0 }); held = inv.length - 1;
  });
  await page.mouse.down();
  assert.equal(await page.evaluate(() => hurrying()), true, 'held item actions also stay active on the mouse');
  await page.mouse.up();
  assert.equal(await page.evaluate(() => hurrying()), false);
}));

test('right click smoothly zooms the gun and world, releases cleanly, and never changes the saved FOV', () => withGun(async page => {
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => mouseCaptured());
  const before = await page.evaluate(() => ({ tf, FOV, setting: settings.fov, x: gunGeom().cx }));
  await page.mouse.down({ button: 'right' });
  const aiming = await page.evaluate(() => {
    stepGun(.35); render(0);
    return { aim: gun.aim, tf, FOV, setting: settings.fov, x: gunGeom().cx };
  });
  assert.ok(aiming.aim > .95 && aiming.tf < before.tf * .9);
  assert.ok(aiming.x < before.x, 'the gun settles inward as you aim');
  assert.equal(aiming.FOV, before.FOV); assert.equal(aiming.setting, before.setting);
  await page.mouse.up({ button: 'right' });
  assert.ok(await page.evaluate(() => { stepGun(.4); return gun.aim < .01 && !gun.aimHeld; }));
  await page.mouse.down({ button: 'right' });
  await page.evaluate(() => openInventory());
  assert.equal(await page.evaluate(() => !!(gun.aimHeld || K.MouseUse)), false, 'menus release held mouse actions');
  const rounds = await page.evaluate(() => heldGun().uses);
  await page.mouse.click(10, 10);
  assert.equal(await page.evaluate(() => heldGun().uses), rounds, 'clicking a menu cannot fire');
}));

test('the grip is culled against the hand pixels during recoil and reload', () => withGun(async page => {
  const stages = await page.evaluate(() => {
    const clip = g.clip, text = g.fillText, hand = drawHand;
    let clips = 0, glyphs = 0, hands = 0;
    g.clip = function (...args) { clips++; return clip.apply(this, args); };
    g.fillText = function (...args) { glyphs++; return text.apply(this, args); };
    drawHand = function (...args) { hands++; return hand(...args); };
    try {
      return [0, .2, .8, 1.4].map(reload => {
        gun.reload = reload; gun.kick = reload ? 0 : .8;
        clips = glyphs = hands = 0; drawHeldBig();
        return { clips, glyphs, hands, drawn: handDrawn.id };
      });
    } finally { g.clip = clip; g.fillText = text; drawHand = hand; }
  });
  for (const stage of stages) {
    assert.equal(stage.clips, 1); assert.equal(stage.hands, 1);
    assert.ok(stage.glyphs > 100); assert.equal(stage.drawn, 'revolver');
  }
}));
