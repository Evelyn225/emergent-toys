'use strict';
// The specialist shops (city/shops.js) and the rooms with bathrooms, every one in the real page: the sign takes you to
// its own interior, you come in on clear floor, you can walk from the door to the clerk (and buy something), into every
// back room and up to the toilet, and back out; and the room draws from all round without an error or a crawl.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;
const SHOPS = { GROCERY: 'grocer', MARKET: 'grocer', FRUIT: 'grocer', DELI: 'deli', DELICATESSEN: 'deli', HARDWARE: 'hardware', SKATE: 'skate',
  SPORTS: 'sports', TOYS: 'toys', THRIFT: 'thrift', ANTIQUES: 'thrift', TAILOR: 'thrift', PHARMACY: 'pharmacy', DRUGSTORE: 'pharmacy',
  TOBACCO: 'tobacco', VIDEO: 'video', RECORDS: 'records', TATTOO: 'tattoo', HERBS: 'herbs', PHONES: 'phones', PAWN: 'pawn', LIQUOR: 'liquor', JEWELER: 'jeweler', '24/7': 'store', BODEGA: 'store',
  CAFE: 'cafe', RAMEN: 'noodle', 'TEA HOUSE': 'tea', KARAOKE: 'karaoke', HOTEL: 'hotel', BAR: 'bar', DINER: 'diner', GAS: 'gas' };
const WITH_WC = ['DELI', 'TOBACCO', 'CAFE', 'RAMEN', 'TEA HOUSE', 'KARAOKE', 'HOTEL', 'BAR', 'DINER', 'GAS'];

// walk every room: flood its floor from the door on a 10cm grid, and see what you can reach
async function walkRooms(page) {
  return page.evaluate(shops => {
    paused = true; tod = 14; mode = 'walk'; room = null;
    const out = {};
    for (const word of Object.keys(shops)) {
      mode = 'walk'; room = null;
      const kind = ROOM_FOR[word] || 'store';
      enterRoom(kind, { word, neon: CYAN, ret: [px, py, a], line: '' }, [0, 0, -Math.PI / 2]);
      [px, py] = room.def.spawn || [room.W / 2, room.H - 1.6];
      const spawn = [px, py], k = room.def.keeper, open = free(px, py);
      const S = 10, W = room.W * S, H = room.H * S, seen = new Uint8Array(W * H), q = [[Math.round(px * S), Math.round(py * S)]];
      let clerk = null, door = false, wc = null;
      while (q.length) {
        const [x, y] = q.pop();
        if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
        seen[y * W + x] = 2;
        const wx = x / S, wy = y / S;
        if (roomAt(wx, wy + 0.45) === 'D') door = true; // (a step from the way out)
        if (!free(wx, wy)) { seen[y * W + x] = 1; continue; }
        if (k && !clerk && Math.hypot(wx - k[0], wy - k[1]) < 1.9) clerk = [wx, wy];
        if (!wc && inWc(wx, wy)) { [px, py] = [wx, wy]; if (looNear()) wc = [wx, wy]; }
        q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      // every bit of floor you could stand on is somewhere you can get to: no room sealed off, no pocket behind the furniture
      // (a cell with a good few clear spots in it counts; it must have one you reached)
      const pockets = [];
      for (let cy = 0; cy < room.H; cy++) for (let cx = 0; cx < room.W; cx++) {
        if (roomAt(cx, cy) !== '.') continue;
        let clear = 0, reached = 0;
        for (let sy = 1; sy < S; sy += 2) for (let sx = 1; sx < S; sx += 2) {
          const x = cx * S + sx, y = cy * S + sy;
          if (free(x / S, y / S)) { clear++; if (seen[y * W + x] === 2) reached++; }
        }
        if (clear >= 6 && !reached) pockets.push(`${cx},${cy}`);
      }
      let shop = null;
      if (clerk) { [px, py] = clerk; shop = nearKeeper() && stockFor(room.kind, room.word).length; }
      // draw it from the door, looking round, from the counter, and from the bathroom
      const t0 = performance.now(), spots = [spawn, clerk || spawn, ...wc ? [wc] : []];
      for (const [x, y] of spots) for (let d = 0; d < 4; d++) { px = x; py = y; a = -Math.PI / 2 + d * Math.PI / 2; pitch = 0; render(0); }
      out[word] = { kind: room.kind, open, clerk: !!clerk, door, shop, wc: !!wc, hasWc: !!room.def.wc, keeper: !!k, pockets, ms: (performance.now() - t0) / (spots.length * 4) };
    }
    mode = 'walk'; room = null;
    return out;
  }, SHOPS);
}

test('every shop and the rooms with bathrooms: its own room, all of it reachable from the door, the clerk, the toilet, and it draws', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await walkRooms(page);
    for (const [word, kind] of Object.entries(SHOPS)) {
      const s = r[word];
      assert.equal(s.kind, kind, `${word} opens on its own room`);
      assert.ok(s.open, `${word}: you come in on clear floor`);
      assert.deepEqual(s.pockets, [], `${word}: no floor you can't get to`);
      assert.ok(s.door, `${word}: and you can get back out`);
      assert.ok(s.ms < 250, `${word} draws in ${s.ms.toFixed(0)}ms a frame`);
      if (!s.keeper || kind === 'hotel') continue; // (karaoke's nobody's counter; the hotel's desk is for rooms upstairs)
      assert.ok(s.clerk, `${word}: you can walk up to the clerk`);
      if (word === 'PHONES') assert.equal(s.shop, 0, 'the phone shop has nothing you can carry off: the clerk just chats');
      else assert.ok(s.shop > 0, `${word}: and they'll sell you something`);
    }
    for (const word of WITH_WC) assert.ok(r[word].hasWc && r[word].wc, `${word}: a bathroom, and you can get in and use the toilet`);
    assert.ok(new Set(Object.values(r).map(s => s.kind)).size >= 23, 'all those different rooms behind the signs');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
