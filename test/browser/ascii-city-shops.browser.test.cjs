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
  CAFE: 'cafe', RAMEN: 'noodle', 'TEA HOUSE': 'tea', KARAOKE: 'karaoke', HOTEL: 'hotel', BAR: 'bar', DINER: 'diner', GAS: 'gas',
  PIZZA: 'pizzeria', BURGERS: 'burgerjoint', TACOS: 'taqueria', SUSHI: 'sushibar', 'ICE CREAM': 'icecream', BAKERY: 'bakery',
  CHICKEN: 'chickenshop', KEBAB: 'kebabshop', BENTO: 'bento', TAKOYAKI: 'takoyaki', YAKITORI: 'yakitori', DONUTS: 'donutshop', JUICE: 'juicebar', BAGELS: 'bagelshop',
  THAI: 'thai', PHO: 'pho', DUMPLINGS: 'dumplings', 'DIM SUM': 'dimsum', KISSATEN: 'kissaten', IZAKAYA: 'izakaya', MAHJONG: 'mahjong',
  BODEGA: 'bodega', MARKET: 'markethall', FRUIT: 'fruitshop', MOTEL: 'motel', WELDING: 'welding', TIRES: 'tireshop', TAILOR: 'tailor', ANTIQUES: 'antiques',
  DRUGSTORE: 'drugstore', DELICATESSEN: 'delicatessen', GACHA: 'gacha', COFFEE: 'roastery', NOODLES: 'noodlehouse' };
const JUST_CHAT = ['PHONES', 'WELDING', 'TIRES']; // (a clerk with nothing you can carry off)
const WITH_WC = ['DELI', 'TOBACCO', 'CAFE', 'RAMEN', 'TEA HOUSE', 'KARAOKE', 'HOTEL', 'BAR', 'DINER', 'GAS', 'PIZZA', 'BURGERS', 'TACOS', 'SUSHI', 'THAI', 'PHO', 'DUMPLINGS', 'DIM SUM', 'KISSATEN', 'IZAKAYA', 'MAHJONG', 'COFFEE', 'NOODLES'];

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
      // every seat is one you can get to: some floor you reached is in reach of it (nearSeat's 1.1m)
      const unseatable = room.props.filter(o => o.seat || o.bench).filter(o => {
        for (let y = Math.max(0, Math.floor((o.y - 1) * S)); y <= Math.min(H - 1, Math.ceil((o.y + 1) * S)); y++)
          for (let x = Math.max(0, Math.floor((o.x - 1) * S)); x <= Math.min(W - 1, Math.ceil((o.x + 1) * S)); x++)
            if (seen[y * W + x] === 2 && Math.hypot(x / S - o.x, y / S - o.y) < 1.05) return false;
        return true;
      }).map(o => `${o.x.toFixed(1)},${o.y.toFixed(1)}`);
      let shop = null;
      if (clerk) { [px, py] = clerk; shop = nearKeeper() && stockFor(room.kind, room.word).length; }
      // draw it from the door, looking round, from the counter, and from the bathroom
      const t0 = performance.now(), spots = [spawn, clerk || spawn, ...wc ? [wc] : []];
      for (const [x, y] of spots) for (let d = 0; d < 4; d++) { px = x; py = y; a = -Math.PI / 2 + d * Math.PI / 2; pitch = 0; render(0); }
      out[word] = { kind: room.kind, open, clerk: !!clerk, door, shop, wc: !!wc, hasWc: !!room.def.wc, keeper: !!k, rent: !!room.def.rent, pockets, unseatable, ms: (performance.now() - t0) / (spots.length * 4) };
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
      assert.deepEqual(s.unseatable, [], `${word}: every seat in it is one you can walk up to`);
      assert.ok(s.ms < 250, `${word} draws in ${s.ms.toFixed(0)}ms a frame`);
      if (!s.keeper || s.rent) continue; // (karaoke's nobody's counter; the hotel's and the motel's desks are for rooms)
      assert.ok(s.clerk, `${word}: you can walk up to the clerk`);
      if (JUST_CHAT.includes(word)) assert.equal(s.shop, 0, `${word}: nothing you can carry off, the clerk just chats`);
      else assert.ok(s.shop > 0, `${word}: and they'll sell you something`);
    }
    for (const word of WITH_WC) assert.ok(r[word].hasWc && r[word].wc, `${word}: a bathroom, and you can get in and use the toilet`);
    assert.ok(new Set(Object.values(r).map(s => s.kind)).size >= 23, 'all those different rooms behind the signs');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('anywhere somebody is sitting there is a seat, and every empty seat takes you (C): stools, chairs, booths, sofas, bunks', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; tod = 21; const lonely = [], refused = [], kinds = {};
      for (const kind of Object.keys(ROOM_DEFS)) {
        const def = ROOM_DEFS[kind]; if (def.home || kind === 'train' || kind === 'hotelSuite') continue;
        for (let k = 0; k < 3; k++) {
          mode = 'walk'; room = null; body.seat = null;
          enterRoom(kind, { word: kind.toUpperCase(), neon: RED, cell: [10, 10], ret: [41, 73, 0], st: 0, line: '' }, [2, 2, 0]);
          const seats = room.props.filter(s => s.seat || s.bench || s.seatRow);
          for (const o of room.props.filter(o => o.fig && /^sit/.test(typeof o.pose === 'string' ? o.pose : '')))
            if (!seats.some(s => s.seatRow ? Math.abs(o.y - s.seatRow.y) < 0.5 && o.x > s.seatRow.x0 - 0.6 && o.x < s.seatRow.x1 + 0.6 : Math.hypot(o.x - s.x, o.y - s.y) < 0.6)) lonely.push(`${kind} ${o.x.toFixed(1)},${o.y.toFixed(1)}`);
          for (const s of seats.filter(s => s.seat)) {
            if (room.props.some(o => o.fig && /^sit/.test(typeof o.pose === 'string' ? o.pose : '') && Math.hypot(o.x - s.x, o.y - s.y) < 0.4)) continue; // (taken)
            px = s.x + 0.05; py = s.y; body.seat = null;
            kinds[kind] = (kinds[kind] || 0) + 1;
            if (!sitDown() || Math.hypot(px - s.x, py - s.y) > 0.3 || s.fx != null && Math.abs(Math.atan2(Math.sin(a - Math.atan2(s.fy, s.fx)), Math.cos(a - Math.atan2(s.fy, s.fx)))) > 0.01) refused.push(`${kind} ${s.x.toFixed(1)},${s.y.toFixed(1)}`);
            else standUp();
          }
        }
      }
      mode = 'walk'; room = null; body.seat = null;
      return { lonely, refused, kinds };
    });
    assert.deepEqual(r.lonely, [], 'nobody sitting on thin air');
    assert.deepEqual(r.refused, [], 'and you sit where they would, facing the way they do');
    for (const kind of ['burgerjoint', 'pizzeria', 'sushibar', 'tattoo', 'karaoke', 'cafe', 'tea', 'jail', 'pachinko', 'stripclub', 'hospital'])
      assert.ok(r.kinds[kind] > 0, `${kind}: somewhere free to sit`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the mahjong parlour: a seat at any of its tables gets you into a hand', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; mode = 'walk'; room = null;
      enterRoom(ROOM_FOR.MAHJONG, { word: 'MAHJONG', neon: RED, ret: [px, py, a], line: '' }, [7.5, 8.4, -Math.PI / 2]);
      const tables = room.props.filter(s => s.mj), out = [room.kind, tables.length];
      for (const t of tables) { px = t.cx + 0.95; py = t.cy + 0.6; out.push(!!nearMahjong()); }
      mode = 'walk'; room = null;
      return out;
    });
    assert.deepEqual(r, ['mahjong', 5, true, true, true, true, true]);
  } finally { await browser.close(); }
});

test('gacha: turn a handle, pay, and a capsule toy rolls out; the motel books you a room and you come back down to its office', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; mode = 'walk'; room = null; money = 10; clearInventory();
      enterRoom(ROOM_FOR.GACHA, { word: 'GACHA', neon: MAG, ret: [px, py, a], line: '' }, [5, 6.4, -Math.PI / 2]);
      const m = room.props.find(s => s.gacha); px = m.cx; py = m.cy;
      const prompt = promptText(), used = useShotengai(), toy = inv[0] && inv[0].id;
      const out = { kind: room.kind, machines: room.props.filter(s => s.gacha).length, prompt, used, toy, money };
      mode = 'walk'; room = null; money = 100; tod = 20;
      enterRoom(ROOM_FOR.MOTEL, { word: 'MOTEL', neon: RED, ret: [41, 73, 0], line: '' }, [5, 6.4, -Math.PI / 2]);
      px = 3.0; py = 3.1; out.motel = [room.kind, promptText()];
      bookRoom(); out.booked = [money, !!sleep];
      for (let k = 0; k < 400 && sleep; k++) stepSleep(0.05);
      out.upstairs = room.kind; leaveRoom(); out.back = [room.kind, free(px, py)];
      mode = 'walk'; room = null; sleep = null;
      return out;
    });
    assert.equal(r.kind, 'gacha');
    assert.ok(r.machines > 20, 'walls of machines');
    assert.match(r.prompt, /turn the handle/);
    assert.ok(r.used && ['yoyo', 'duck', 'dinotoy', 'luckycoin', 'redstring', 'candy'].includes(r.toy), `a toy: ${r.toy}`);
    assert.equal(r.money, 8, 'two dollars a go');
    assert.equal(r.motel[0], 'motel'); assert.match(r.motel[1], /book a room/);
    assert.deepEqual(r.booked, [80, true], 'twenty a night at the motel');
    assert.equal(r.upstairs, 'hotelroom');
    assert.deepEqual(r.back, ['motel', true], 'and back down to the office, on clear floor');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the backrooms: a doorframe seam down an industrial back lane; walk into it and you are through, every bit of it reachable, and back out the same way', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof enterRoom === 'function' && Number.isFinite(eye));
    const r = await page.evaluate(() => {
      paused = true; tod = 14; mode = 'walk'; room = null;
      const s = BACKROOMS_SEAM, out = { seam: !!s };
      out.lane = [districtAt(s.x - 1, s.y), map[idx(s.x - 1, s.cy)], map[idx(s.x, s.cy)] > 0];
      px = s.x - 0.3; py = s.y; a = 0; render(0); out.prompt = promptText(); // (nothing to give it away)
      px = s.x - 0.3; py = s.y + 0.25; for (let k = 0; k < 30; k++) move(0.03, 0); out.beside = [mode, room && room.kind]; // (a step to one side: just wall)
      px = s.x - 0.3; py = s.y; for (let k = 0; k < 30 && mode === 'walk'; k++) move(0.03, 0);
      out.inside = [mode, room && room.kind, room && room.W, room && room.H, free(px, py)];
      // the whole place, flooded from where you come in on a 10cm grid: every room you could stand in, you can get to
      const S = 10, W = room.W * S, H = room.H * S, seen = new Uint8Array(W * H), q = [[Math.round(px * S), Math.round(py * S)]];
      let door = false, reached = 0, open = 0;
      while (q.length) {
        const [x, y] = q.pop();
        if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
        seen[y * W + x] = 1;
        if (!free(x / S, y / S)) continue;
        seen[y * W + x] = 2; reached++;
        if (roomAt(x / S, y / S + 0.45) === 'D') door = true;
        q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      for (let y = 0; y < room.H; y++) for (let x = 0; x < room.W; x++) if (roomAt(x, y) === '.') { open++; if (!seen[(y * S + 5) * W + x * S + 5] || seen[(y * S + 5) * W + x * S + 5] !== 2) out.cut = (out.cut || 0) + 1; }
      out.flood = { door, open, cut: out.cut || 0 };
      const t0 = performance.now(); for (let k = 0; k < 8; k++) { a = k * Math.PI / 4; render(0); } out.ms = (performance.now() - t0) / 8;
      [px, py, a] = [2.5, room.H - 1.6, Math.PI / 2]; for (let k = 0; k < 40 && mode === 'room'; k++) move(0, 0.03);
      out.back = [mode, Math.floor(px) === s.x - 1, Math.abs(rel(py - s.y)) < 0.1, Math.cos(a) < -0.9]; // (in the lane, turned round, facing away from the wall)
      return out;
    });
    assert.ok(r.seam, 'there is a seam somewhere');
    assert.deepEqual(r.lane, ['industrial', 0, true], 'in a back lane in the industrial district, on a building wall');
    assert.equal(r.prompt, '', 'looking at it tells you nothing');
    assert.deepEqual(r.beside, ['walk', null], 'beside it, the wall is just a wall');
    assert.deepEqual(r.inside, ['room', 'backrooms', 73, 73, true], 'through it: the backrooms, on clear floor');
    assert.ok(r.flood.open > 3000, `a big place (${r.flood.open} m2 of floor)`);
    assert.equal(r.flood.cut, 0, 'no room in it you can not get to');
    assert.ok(r.flood.door, 'and the way back is reachable');
    assert.ok(r.ms < 250, `draws in ${r.ms.toFixed(0)}ms`);
    assert.deepEqual(r.back, ['walk', true, true, true]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
