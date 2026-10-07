'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function withPage(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof toggleFreecam === 'function' && Number.isFinite(eye));
    await page.evaluate(() => { paused = true; });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('freecam toggle flies through geometry along mouse look without moving or saving the player', () => withPage(async page => {
  await page.keyboard.press('F2');
  await page.click('#dev [data-tab="camera"]');
  const toggle = page.getByRole('switch', { name: 'Freecam: off' });
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  await toggle.click();
  assert.ok(await page.evaluate(() => !!freecam && !devOpen() && !paused));
  const result = await page.evaluate(() => {
    paused = true;
    const snapshot = () => JSON.stringify({ pose: [px, py, a, pitch, mode, roofH], body, needs, T, tod, money,
      car: [cars[0].x, cars[0].y, cars[0].v], person: [people[0].x, people[0].y] });
    const before = snapshot(), raf = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    try {
      const building = ARCH_BUILDINGS.find(b => b.region === 'midtown');
      freecam.x = building.x0 + .5; freecam.y = building.y0 + .5;
      freecam.z = .17; freecam.yaw = 0; freecam.pitch = 0;
      const insideSolid = map[idx(Math.floor(freecam.x), Math.floor(freecam.y))] > freecam.z;
      const fly = (yaw, pitch_, keys) => {
        for (const k in K) K[k] = 0;
        freecam.yaw = yaw; freecam.pitch = pitch_;
        moveMouseBy(0, -100); // the real mouse input raises the view
        const start = { ...freecam };
        Object.assign(K, keys); paused = false;
        for (let n = 0; n < 12; n++) loop(t0 + 1000 / 60);
        paused = true;
        for (const k in K) K[k] = 0;
        return { x: rel(freecam.x - start.x), y: rel(freecam.y - start.y), z: freecam.z - start.z };
      };
      const forward = fly(0, .3, { KeyW: 1 });
      const turned = fly(Math.PI / 2, .3, { KeyW: 1 });
      const backward = fly(0, .3, { KeyS: 1 });
      const strafe = fly(0, .3, { KeyD: 1 });
      const lookingDown = fly(0, -.7, { KeyW: 1 });
      const faster = fly(0, .3, { KeyW: 1, ShiftLeft: 1 });
      const up = fly(0, .3, { KeyE: 1 });
      const diagonal = fly(0, .3, { KeyW: 1, KeyD: 1 });
      saveGame();
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      return { before, after: snapshot(), insideSolid, forward, turned, backward, strafe, lookingDown, faster, up, diagonal,
        savedPlayer: saved.at.x === px && saved.at.y === py, savedFreecam: Object.hasOwn(saved, 'freecam') };
    } finally { paused = true; window.requestAnimationFrame = raf; }
  });
  assert.equal(result.before, result.after, 'movement, world simulation and player state stay frozen');
  assert.ok(result.insideSolid && result.forward.x > 0, 'the camera moves even inside a solid building');
  assert.ok(result.forward.z > .02 && Math.abs(result.forward.y) < 1e-6, 'W follows upward mouse look');
  assert.ok(result.turned.y > .02 && Math.abs(result.turned.x) < 1e-6);
  assert.ok(result.backward.x < 0 && result.backward.z < 0, 'S follows the reverse viewing direction');
  assert.ok(result.lookingDown.x > 0 && result.lookingDown.z < 0);
  assert.ok(result.strafe.y > 0 && Math.abs(result.strafe.z) < 1e-6);
  assert.ok(result.up.z > 0 && Math.hypot(result.up.x, result.up.y) < 1e-6);
  const speed = v => Math.hypot(v.x, v.y, v.z);
  assert.ok(Math.abs(speed(result.faster) / speed(result.forward) - 5) < 1e-6);
  assert.ok(Math.abs(speed(result.diagonal) - speed(result.forward)) < 1e-6, 'diagonal movement is normalized');
  assert.ok(result.savedPlayer && !result.savedFreecam);
  await page.keyboard.press('F2');
  const enabled = page.getByRole('switch', { name: 'Freecam: on' });
  assert.equal(await enabled.getAttribute('aria-checked'), 'true');
  await enabled.click();
  assert.ok(await page.evaluate(() => !freecam && !devOpen() && !paused));
}));

test('freecam preserves interiors, roofs and vehicles while rendering from above and below', () => withPage(async page => {
  const results = await page.evaluate(() => {
    const scenes = [
      ['interior', () => enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2])],
      ['subway', () => enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0])],
      ['roof', () => { room = null; me = null; mode = 'roof'; roofH = 6; }],
      ['car', () => { mode = 'drive'; me = cars.find(c => c.kind === 'taxi'); me.v = 1; px = me.x; py = me.y; chaseOn = true; }],
      ['boat', () => { me = null; room = null; mode = 'sea'; sea = fleet[0]; px = sea.x; py = sea.y; chaseOn = true; }]
    ];
    return scenes.map(([scene, init]) => {
      freecam = null; init(); render(0); toggleFreecam();
      const originalRoom = room, originalCar = me, originalBoat = sea;
      const before = JSON.stringify([px, py, a, pitch, mode, roofH, body, me?.v, sea?.v]);
      freecam.z += mode === 'room' ? 3 : 5;
      renderFreecam();
      freecam.z = -.2; renderFreecam();
      const after = JSON.stringify([px, py, a, pitch, mode, roofH, body, me?.v, sea?.v]);
      toggleFreecam();
      return { scene, unchanged: before === after && room === originalRoom && me === originalCar && sea === originalBoat };
    });
  });
  for (const r of results) assert.ok(r.unchanged, JSON.stringify(r));
}));

test('freecam movement keys leave held items, jumping and interactions alone', () => withPage(async page => {
  const before = await page.evaluate(() => {
    const id = Object.keys(ITEMS).find(id => ITEMS[id].kind === 'drink');
    inv.length = 0; inv.push({ id, uses: 3 }); held = 0;
    toggleFreecam(); paused = false;
    return JSON.stringify([inv, held, body, needs, mode, px, py]);
  });
  for (const key of ['KeyQ', 'KeyE', 'Space', 'KeyC', 'KeyX', 'KeyI', 'KeyP', 'KeyV']) await page.keyboard.press(key);
  assert.equal(await page.evaluate(() => JSON.stringify([inv, held, body, needs, mode, px, py])), before);
  assert.ok(await page.evaluate(() => !panelOpen() && !pee && !!freecam && !paused));
}));
