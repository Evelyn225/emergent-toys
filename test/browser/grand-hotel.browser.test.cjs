'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PAGE = pathToFileURL(path.join(__dirname, '..', '..', 'ascii-city.html')).href;

test('Grand Hotel: suite, patrols, distraction, theft, escape alarm and save', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.evaluate(() => { paused = true; });

    assert.deepEqual(await page.evaluate(() => {
      enterRoom('grandhotel', { word: 'GRAND HOTEL', neon: YEL, cell: [53, 63], ret: [53, 64.2, -Math.PI / 2] }, [6.5, 3.4, -Math.PI / 2]);
      money = 1000; tod = 14; interact();
      const early = [money, !!sleep];
      tod = 21; interact();
      stepSleep(1.6);
      const booked = [money, room.kind, room.suite, room.W, room.H, tod];
      sleep = null; fade = 0; leaveRoom();
      return [early, booked, room.kind, room.ret];
    }), [[1000, false], [750, 'hotelroom', true, 9, 7, 7], 'grandhotel', [53, 64.2, -Math.PI / 2]]);

    assert.deepEqual(await page.evaluate(() => {
      px = HOTEL_HEIST_DOOR[0]; py = 2.1; tod = 22; interact();
      const closed = room.kind;
      tod = 23; interact();
      for (const p of room.props) if (p.tick) p.tick(p);
      const cover = lineClear(8, 4, 10, 4);
      px = 12; py = 13.8; interact();
      const guards = room.props.filter(p => p.guard);
      guards.forEach(g => g.tick(g));
      const before = guards.map(g => [g.x, g.y]);
      T += 5; guards.forEach(g => g.tick(g));
      const still = guards.every((g, i) => Math.hypot(g.x - before[i][0], g.y - before[i][1]) < 0.001);
      const firstDeadline = room.distractedUntil;
      interact();
      return [closed, room.kind, cover, guards.length, still, room.distractedUntil === firstDeadline, room.trolleyUsed, crimePrompt().includes('cheese')];
    }), ['grandhotel', 'grandhotelheist', false, 2, true, true, true, true]);

    assert.deepEqual(await page.evaluate(() => {
      px = HOTEL_PAINTING[0]; py = HOTEL_PAINTING[1]; interact();
      const started = !!game && game.onDone !== undefined;
      game.onDone(false); game = null;
      const deadline = hotelAlarm.deadline;
      T += 2; interact(); game.onDone(true); game = null;
      const unchanged = hotelAlarm.deadline === deadline;
      const carried = inv.some(it => it.id === 'hotelmasterpiece');
      leaveRoom(); const lobby = room.kind;
      leaveRoom(); const outside = mode;
      T = deadline + 0.1; stepGrandHotel();
      return [started, unchanged, carried, grandHotelStolen, lobby, outside, wanted.stars > 0, hotelAlarm === null];
    }), [true, true, true, true, 'grandhotel', 'walk', true, true]);

    assert.deepEqual(await page.evaluate(() => {
      saveGame();
      grandHotelStolen = false; inv.length = 0; loadGame();
      const recovered = inv.some(it => it.id === 'hotelmasterpiece');
      const gallery = makeRoom('grandhotelheist', { burgled: true });
      return [grandHotelStolen, recovered, gallery.props.some(p => p.hotelPainting)];
    }), [true, true, false]);

    // Exercise the real room wall adapter while police search, rather than a headless fixture.
    await page.evaluate(() => {
      enterRoom('grandhotel', { word: 'GRAND HOTEL', ret: [53, 64.2, 0] }, [7, 7.2, -Math.PI / 2]);
      wanted.lastX = 53; wanted.lastY = 64.2; wanted.seen = true;
      stepCrime(0.05); env(0); render(0);
    });
    assert.ok(await page.evaluate(() => roomCops.length > 0));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
