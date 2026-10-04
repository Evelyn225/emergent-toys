'use strict';
// ASCII City's marina and boats (city/boats.js): the slips, renting, buying, stealing, and sailing about.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();
const j = expr => JSON.parse(ev(`JSON.stringify(${expr})`));
// stand on the finger pier beside boat k, facing it
const besideBoat = k => ev(`(() => { const b = fleet[${k}], s = SLOTS[b.slot], fy = MARINA.fingers[Math.floor(b.slot / 4)];
  mode = 'walk'; sea = null; px = s.x; py = fy; a = Math.atan2(s.y - fy, 0); return nearBoat() === b; })()`);

test('every slip is open water, clear of the jetty and of the other boats, and reachable from the jetty', () => {
  const r = j(`fleet.map((b, k) => ({ k, clear: waterClear(b, b.x, b.y, b.hx, b.hy), dock: dryLand(b.x, MARINA.fingers[Math.floor(b.slot / 4)]) }))`);
  for (const s of r) assert.ok(s.clear && s.dock, `slip ${s.k}: ${JSON.stringify(s)}`);
  for (let k = 0; k < r.length; k++) assert.ok(besideBoat(k), `can't get at boat ${k} from the jetty`);
  // the jetty runs unbroken from the promenade to its end
  assert.ok(j(`(() => { for (let y = MARINA.y0 + 0.1; y < MARINA.end - 0.1; y += 0.1) if (!dryLand(MARINA.x, y)) return false; return true; })()`));
});

test('the bay is still full of boats going round, and none of their routes cross the marina', () => {
  assert.ok(j('boats.length') >= 20);
  const hits = j(`(() => { const out = []; for (const b of boats) for (let t = 0; t < 400; t += 0.5) { const p = boatAt(b, t); if (inMarina(p.x, p.y)) { out.push(b.kind); break; } } return out; })()`);
  assert.deepStrictEqual(hits, []);
});

test('renting: pay by the trip, take her out, and she goes back to her slip when you step off', () => {
  ev('tod = 12; money = 500');
  const k = j("fleet.findIndex(b => b.deal === 'rent' && b.kind === 'speedboat')");
  assert.ok(besideBoat(k));
  assert.match(ev('marinaPrompt()'), /E: rent the speedboat/);
  ev('useMarina()');
  assert.deepStrictEqual(j(`[mode, money, sea === fleet[${k}], sea.hired]`), ['sea', 470, true, true]);
  for (let s = 0; s < 40; s++) ev("K.KeyW = true; stepSea(0.05)"); // out of the slip
  ev('K.KeyW = false; for (let s = 0; s < 200; s++) stepSea(0.05)'); // coast to a stop
  const out = j(`[sea.x, SLOTS[${k}].x]`);
  assert.ok(Math.abs(out[0] - out[1]) > 0.3, 'she moved');
  ev(`sea.v = 0.6; useMarina()`); // too fast to step off
  assert.strictEqual(ev('mode'), 'sea');
  ev(`sea.v = 0; sea.x = MARINA.x - 0.9; sea.y = SLOTS[${k}].y; useMarina()`); // back alongside the finger pier, stopped: step off
  assert.strictEqual(ev('mode'), 'walk');
  assert.deepStrictEqual(j(`[fleet[${k}].x, fleet[${k}].y, fleet[${k}].hired]`), [j(`SLOTS[${k}].x`), j(`SLOTS[${k}].y`), false]);
});

test('the marina shuts at night: no renting or buying, but you can still hotwire one', () => {
  ev('tod = 23; money = 5000; clearWanted(); reports.length = 0');
  const k = j("fleet.findIndex(b => b.deal === 'rent')");
  besideBoat(k);
  ev('useMarina()');
  assert.deepStrictEqual(j('[mode, money]'), ['walk', 5000]);
  assert.match(ev('marinaPrompt()'), /L: hotwire/);
  assert.ok(ev('stealBoat()'));
  assert.deepStrictEqual(j(`[mode, fleet[${k}].deal, money]`), ['sea', 'stolen', 5000]);
  assert.ok(j('wanted.stars > 0 || reports.some(r => r.kind === "boattheft")'), 'somebody saw, or the owner reports it');
  ev('sea.v = 0; useMarina()'); // straight back off again: still yours to take, no charge
  besideBoat(k);
  assert.match(ev('marinaPrompt()'), /E: take the/);
  ev('clearWanted(); reports.length = 0; tod = 12');
});

test('buying: yours to keep, saved, and the marina has one fewer for sale when you load', () => {
  ev('tod = 12; money = 10000');
  const k = j("fleet.findIndex(b => b.deal === 'sale' && b.kind === 'sailboat')");
  besideBoat(k);
  assert.match(ev('marinaPrompt()'), /E: buy the sailboat/);
  ev('useMarina()');
  assert.deepStrictEqual(j(`[fleet[${k}].deal, money, mode]`), ['mine', 7000, 'walk']);
  const saved = j('savedBoats()');
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].kind, 'sailboat');
  // a fresh visit: load the save, and the slip it came from is empty
  const fresh = loadCity().ev;
  const before = JSON.parse(fresh('JSON.stringify(fleet.filter(b => b.deal === "sale").length)'));
  fresh(`loadBoats(${JSON.stringify(saved)})`);
  assert.deepStrictEqual(JSON.parse(fresh('JSON.stringify([fleet.filter(b => b.deal === "sale").length, fleet.filter(b => b.deal === "mine").length])')), [before - 1, 1]);
});

test('sailing: the jetty, the shore and the bridges stop you; open water does not', () => {
  ev("tod = 12; money = 500; mode = 'walk'");
  const k = j("fleet.findIndex(b => b.kind === 'speedboat' && b.deal === 'private')");
  ev(`boardBoat(fleet[${k}])`);
  // point her at the jetty and floor it: she never ends up over the planks
  ev('a = 0; sea.hx = 1; sea.hy = 0; sea.x = MARINA.x - 1; sea.y = MARINA.fingers[0] + 1.5');
  for (let s = 0; s < 120; s++) ev('K.KeyW = true; stepSea(0.05)');
  ev('K.KeyW = false');
  assert.ok(j('hullPoints(sea, sea.x, sea.y, sea.hx, sea.hy).every(([x, y]) => navigable(x, y))'));
  assert.ok(j('sea.x < MARINA.x'), 'stopped short of the jetty');
  // out in the open bay she makes way
  ev('sea.x = MARINA.x; sea.y = SHORE_S * 8 + 20; a = Math.PI / 2; sea.hx = 0; sea.hy = 1; sea.v = 0');
  for (let s = 0; s < 40; s++) ev('K.KeyW = true; stepSea(0.05)');
  ev('K.KeyW = false');
  assert.ok(j('sea.y > SHORE_S * 8 + 20.5'));
  // a bridge is too low to get under
  ev('sea.x = BRIDGE_X[0] * 8 - 1.2; sea.y = SHORE_S * 8 + 20; a = 0; sea.hx = 1; sea.hy = 0; sea.v = 0');
  for (let s = 0; s < 100; s++) ev('K.KeyW = true; stepSea(0.05)');
  ev('K.KeyW = false');
  assert.ok(j('sea.x < BRIDGE_X[0] * 8'));
  ev('sea.v = 0; mode = "walk"; sea = null');
});
