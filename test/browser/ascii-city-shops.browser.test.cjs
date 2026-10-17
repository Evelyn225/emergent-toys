'use strict';
// The specialist shops (city/shops.js), every one in the real page: the sign takes you to its own interior, you come in
// on clear floor, you can walk from the door to the clerk (and buy something) and back out, and the room draws from all
// round without an error or a crawl.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;
const SHOPS = { GROCERY: 'grocer', MARKET: 'grocer', FRUIT: 'grocer', DELI: 'deli', DELICATESSEN: 'deli', HARDWARE: 'hardware', SKATE: 'skate',
  SPORTS: 'sports', TOYS: 'toys', THRIFT: 'thrift', ANTIQUES: 'thrift', TAILOR: 'thrift', PHARMACY: 'pharmacy', DRUGSTORE: 'pharmacy',
  TOBACCO: 'tobacco', VIDEO: 'video', HERBS: 'herbs', PHONES: 'phones', PAWN: 'pawn', LIQUOR: 'liquor', JEWELER: 'jeweler', '24/7': 'store', BODEGA: 'store' };

test('every specialist shop: its own room, a clear way from the door to the clerk and back, and it draws', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(shops => {
      paused = true; tod = 14; mode = 'walk'; room = null;
      const out = {};
      for (const word of Object.keys(shops)) {
        mode = 'walk'; room = null;
        const kind = ROOM_FOR[word] || 'store';
        enterRoom(kind, { word, neon: CYAN, ret: [px, py, a], line: '' }, [0, 0, -Math.PI / 2]);
        [px, py] = room.def.spawn || [room.W / 2, room.H - 1.6];
        const spawn = [px, py], k = room.def.keeper, open = free(px, py);
        // flood the floor from where you come in, a 10cm grid: can you get within reach of the clerk, and to the door?
        const S = 10, W = room.W * S, H = room.H * S, seen = new Uint8Array(W * H), q = [[Math.round(px * S), Math.round(py * S)]];
        let clerk = null, door = false;
        while (q.length) {
          const [x, y] = q.pop();
          if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
          seen[y * W + x] = 1;
          const wx = x / S, wy = y / S;
          if (roomAt(wx, wy + 0.45) === 'D') door = true; // (a step from the way out)
          if (!free(wx, wy)) continue;
          if (!clerk && Math.hypot(wx - k[0], wy - k[1]) < 1.9) clerk = [wx, wy];
          q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        let shop = null;
        if (clerk) { [px, py] = clerk; shop = nearKeeper() && stockFor(room.kind, room.word).length; }
        // draw it from the door, looking round, and from the counter
        const t0 = performance.now();
        for (const [x, y] of [spawn, clerk || spawn]) for (let d = 0; d < 4; d++) { px = x; py = y; a = -Math.PI / 2 + d * Math.PI / 2; pitch = 0; render(0); }
        out[word] = { kind: room.kind, open, clerk: !!clerk, door, shop, ms: (performance.now() - t0) / 8, props: room.props.length };
      }
      mode = 'walk'; room = null;
      return out;
    }, SHOPS);
    for (const [word, kind] of Object.entries(SHOPS)) {
      const s = r[word];
      assert.equal(s.kind, kind, `${word} opens on its own room`);
      assert.ok(s.open, `${word}: you come in on clear floor`);
      assert.ok(s.clerk, `${word}: you can walk up to the clerk`);
      if (word === 'PHONES') assert.equal(s.shop, 0, 'the phone shop has nothing you can carry off: the clerk just chats');
      else assert.ok(s.shop > 0, `${word}: and they'll sell you something`);
      assert.ok(s.door, `${word}: and you can get back out`);
      assert.ok(s.ms < 250, `${word} draws in ${s.ms.toFixed(0)}ms a frame`);
    }
    assert.ok(new Set(Object.values(r).map(s => s.kind)).size >= 16, 'sixteen different rooms behind those signs');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
