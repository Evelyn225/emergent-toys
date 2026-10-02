'use strict';
// ASCII City in a real browser: the bundle loads, every mode renders without throwing, and the canvas isn't blank.
// The node suite (test/city-world.test.cjs) covers the simulation; this covers the DOM half the vm can't run.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const PAGE = pathToFileURL(path.join(__dirname, '..', '..', 'ascii-city.html')).href;

test('every mode renders without errors', async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyX'); // starts the audio engine, so every scene below runs it too
    assert.ok(await page.evaluate(() => !!actx), 'audio started on a key press');
    const scenes = {
      street: "mode = 'walk'; px = 9 * 8 + 1; py = 10 * 8 + 4; tod = 21",
      fog: "weather = 'fog'; fogAmt = 1; tod = 12",
      rain: "weather = 'rain'; fogAmt = 0; rain = 1; wet = 1",
      shore: "weather = 'clear'; rain = 0; wet = 0; px = 8 * 8 + 1; py = SHORE_S * 8 + 2.4; a = Math.PI / 2",
      bridge: 'px = BRIDGE_X[0] * 8 + 1; py = SHORE_S * 8 + 20; a = Math.PI / 2',
      underEl: 'px = EL_STATIONS[0].x; py = EL_Y + 1.88; a = 0; pitch = 0.3',
      platform: 'elUp({ s: EL_STATIONS[0], tr: 1 })',
      riding: "const t = elTrains(T)[0]; ride = { tr: t.tr, k: t.k, off: 0 }; mode = 'el'",
      siren: "mode = 'walk'; plat = ride = null; px = 9 * 8 + 1; py = 10 * 8 + 4; spawnEmergency()",
      talk: "const p = people.find(p => !p.hidden); talkTo(p)",
      taxi: "me = cars.find(c => c.kind === 'taxi'); me.rider = true; me.fare = 0; mode = 'taxi'; setDest(5)",
      room: "leaveCar(); enterRoom('bar', { word: 'BAR', neon: MAG, ret: [px, py, a] }, [6, 6, -Math.PI / 2])",
      roof: "leaveRoom(); mode = 'roof'; roofH = 5; px = 2 * 8 + 3.5; py = 2 * 8 + 3.5",
      cafe: "mode = 'walk'; enterRoom('cafe', { word: 'CAFE', neon: MAG, ret: [px, py, a] }, [5, 6.3, -Math.PI / 2])",
      books: "enterRoom('books', { word: 'BOOKS', neon: GREEN, ret: [px, py, a] }, [4.5, 5, -Math.PI / 2])",
      noodle: "enterRoom('noodle', { word: 'RAMEN', neon: RED, ret: [px, py, a] }, [6, 5, -Math.PI / 2])",
      garage: "enterRoom('garage', { word: 'TIRES', neon: RED, ret: [px, py, a] }, [10.5, 8, -2.4])",
      tea: "enterRoom('tea', { word: 'MAHJONG', neon: RED, ret: [px, py, a] }, [6, 7.5, -Math.PI / 2])",
      station: "enterRoom('station', { st: 0, word: stations[0].name, t0: T - 12, ret: [px, py, a] }, [11, 4.8, 0])",
    };
    for (const [name, js] of Object.entries(scenes)) {
      await page.evaluate(js);
      await page.waitForTimeout(250);
      // some text actually reached the canvas
      const lit = await page.evaluate(() => {
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
        return n;
      });
      assert.ok(lit > 50, `${name}: canvas looks blank`);
      assert.deepStrictEqual(errors, [], `${name}: ${errors.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
});

test('a night at the hotel: pay, sleep, wake at 7 in a room to a clear morning', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    const early = await page.evaluate(() => {
      enterRoom('hotel', { word: 'HOTEL', neon: MAG, ret: [px, py, a], line: 'Welcome!' }, [3.2, 3.2, -Math.PI / 2]);
      tod = 14; bookRoom(); return [money, msgText];
    });
    assert.deepStrictEqual(early, [100, '"Sorry, check-in begins at 6pm."']);
    await page.evaluate(() => { tod = 21; weather = 'rain'; rain = 1; bookRoom(); });
    await page.waitForTimeout(3600);
    const r = await page.evaluate(() => ({ money, kind: room.kind, hour: Math.floor(tod), weather, rain, sleeping: !!sleep }));
    assert.deepStrictEqual(r, { money: 60, kind: 'hotelroom', hour: 7, weather: 'clear', rain: 0, sleeping: true });
    await page.waitForTimeout(2000);
    assert.strictEqual(await page.evaluate(() => [!!sleep, fade].join()), 'false,0', 'awake, and the screen faded back in');
    assert.strictEqual(await page.evaluate(() => { leaveRoom(); return room.kind; }), 'hotel', 'the room door leads back to the lobby');
    assert.deepStrictEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('the pause menu stops the game and keeps its settings', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), true);
    const t0 = await page.evaluate(() => T);
    await page.waitForTimeout(400);
    assert.strictEqual(await page.evaluate(() => T), t0, 'time stands still');
    await page.click('#pause [data-detail="low"]');
    assert.strictEqual(await page.evaluate(() => FS), 15);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.evaluate(() => paused), false);
    await page.reload(); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => [settings.detail, FS].join()), 'low,15', 'remembered after a reload');
  } finally {
    await browser.close();
  }
});
