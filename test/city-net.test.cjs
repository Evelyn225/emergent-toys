'use strict';
// ASCII City: multiplayer's pure part (city/net-core.js) and the clock guards it puts in state.js. Checking what
// arrives from other players, smoothing them between updates (across the world's wrap, never through a wall), the
// rules that stand in for a server, chat text, and the clock: only its keeper's weather, watch and lightning count.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const j = (ev, expr) => JSON.parse(ev(`JSON.stringify(${expr})`));
const tick = extra => JSON.stringify({ t: 1, x: 10, y: 20, z: 0, a: 0, mode: 'walk', rk: 'out', pose: 'walk', held: '', stars: 0, ...extra });

test('updates from other players: the expected shape or nothing', () => {
  const { ev } = loadCity();
  assert.deepStrictEqual(j(ev, `netCheckTick(${tick()})`), { t: 1, x: 10, y: 20, z: 0, a: 0, mode: 'walk', rk: 'out', pose: 'walk', held: '', stars: 0 });
  assert.strictEqual(ev(`netCheckTick(${tick({ x: 'NaN' })})`), null, 'not a number');
  assert.strictEqual(ev(`netCheckTick(${tick({ mode: 'godmode' })})`), null, 'an unknown mode');
  assert.strictEqual(ev(`netCheckTick(${tick({ rk: 'x'.repeat(200) })})`), null, 'an oversized room key');
  assert.strictEqual(ev(`netCheckTick(null)`), null);
  assert.strictEqual(ev(`netCheckTick(${tick({ pose: '<script>' })}).pose`), 'stand', 'an unknown pose falls back to standing');
  assert.strictEqual(ev(`netCheckTick(${tick({ stars: 99 })}).stars`), 5);
  assert.deepStrictEqual(j(ev, `netCheckTick(${tick({ mode: 'drive', veh: { kind: 'car', body: 2, v: 1.5, brake: 1 } })}).veh`),
    { id: '', kind: 'car', body: 2, v: 1.5, brake: true, dmg: 0, patrol: false, ev: false }); // (a taxi you're riding in has no id: only cars you drive are shared)
  assert.strictEqual(ev(`netCheckHello({ name: 'a\\u0000b\\u202e  c', ver: 'x', look: { hat: 99, top: 1, bot: 0 } }).name`), 'ab c', 'control and direction characters stripped');
  assert.deepStrictEqual(j(ev, `netCheckHello({ name: 'a', ver: 'x', look: { hat: 99, top: 1, bot: 0 } }).look`), { hat: 0, top: 1, bot: 0 }, 'a bad colour: the default outfit');
  assert.strictEqual(ev(`netCheckClock({ tod: 30, dayNum: 3, weather: 'rain', seasonShift: 5 }).tod`), 6);
  assert.strictEqual(ev(`netCheckClock({ tod: 3, dayNum: 3, weather: 'lava' })`), null);
});

test('chat text: cleaned, capped, wrapped for a bubble', () => {
  const { ev } = loadCity();
  assert.strictEqual(ev(`netClean('  hi\\n\\tthere  ', 120)`), 'hi there');
  assert.strictEqual(ev(`netClean('x'.repeat(300), NET_CHAT_MAX).length`), 120);
  assert.strictEqual(ev(`netClean(42, 10)`), '');
  assert.deepStrictEqual(j(ev, `netWrap('the quick brown fox jumps over the lazy dog', 12)`), ['the quick', 'brown fox', 'jumps ove...'], 'the last line cut to fit, with ...');
  assert.deepStrictEqual(j(ev, `netWrap('${'a'.repeat(30)}', 12)`), ['aaaaaaaaaaaa', 'aaaaaaaaaaaa', 'aaaaaa']);
  assert.deepStrictEqual(j(ev, `netWrap('short')`), ['short']);
  assert.strictEqual(ev(`netCode(' Harbour Lights!! ')`), 'harbourlights');
});

test('smoothing: between updates, across the wrap, held at the newest, and never sliding through a door', () => {
  const { ev } = loadCity();
  ev(`var P = { snaps: [] }; var S = (t, x, y, extra = {}) => netPushSnap(P, { t, x, y, z: 0, a: 0, mode: 'walk', rk: 'out', pose: 'walk', ...extra }, t + 100);`);
  ev(`S(0, 10, 10); S(0.1, 10.1, 10); S(0.2, 10.2, 10);`);
  assert.ok(Math.abs(ev(`netSample(P, 100.15 + NET_DELAY).x`) - 10.15) < 1e-9, 'halfway between the 2nd and 3rd');
  assert.strictEqual(ev(`netSample(P, 105).x`), 10.2, 'past the newest: held there');
  assert.strictEqual(ev(`(S(0.1, 99, 99), P.snaps.length)`), 3, 'an old update arriving late is dropped');
  ev(`P = { snaps: [] }; S(0, N - 0.05, 5); S(0.1, 0.05, 5);`);
  const x = ev(`netSample(P, 100.05 + NET_DELAY).x`);
  assert.ok(x < 1e-6 || x > ev('N') - 1e-6, 'across the edge of the world: through the seam, not back across the city (' + x + ')');
  ev(`P = { snaps: [] }; S(0, 10, 10); S(0.1, 2, 3, { mode: 'room', rk: 'shop:10.0,10.0' });`);
  assert.strictEqual(ev(`netSample(P, 100.04 + NET_DELAY).x`), 10, 'through a door: still outside until halfway...');
  assert.strictEqual(ev(`netSample(P, 100.07 + NET_DELAY).rk`), 'shop:10.0,10.0', '...then inside, no sliding');
  ev(`P = { snaps: [] }; S(0, 10, 10); S(0.1, 60, 10);`);
  assert.strictEqual(ev(`netSample(P, 100.04 + NET_DELAY).x`), 10, 'a taxi ride across town: a jump, not a slide');
  assert.ok(Math.abs(ev(`netLerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5)`)) - Math.PI < 1e-9, 'turning the short way round');
});

test('rules instead of a server: who keeps the clock, the room key, the rate limit, the build fingerprint', () => {
  const { ev } = loadCity();
  assert.strictEqual(ev(`netClockOwnerOf('b', ['c', 'd'])`), true);
  assert.strictEqual(ev(`netClockOwnerOf('b', ['c', 'a'])`), false);
  assert.strictEqual(ev(`netRoomKey('walk', null)`), 'out');
  assert.strictEqual(ev(`netRoomKey('room', { kind: 'pawn', ret: [10.04, 20.96, 1] })`), 'pawn:10.0,21.0');
  ev(`var B = {};`);
  assert.deepStrictEqual(j(ev, `[0, 0, 0, 0].map(() => netAllow(B, 5, 1, 3))`), [true, true, true, false], 'three at once, then wait');
  assert.strictEqual(ev(`netAllow(B, 6.1, 1, 3)`), true, 'a second later: one more');
  assert.strictEqual(ev('netBuildId()'), ev('netBuildId()'));
  assert.match(ev('netBuildId()'), /^4-[0-9a-z]+$/);
  const look = j(ev, `netLookFor('Ann')`);
  assert.deepStrictEqual(j(ev, `netLookFor('Ann')`), look, 'the same name, the same colours, on every machine');
});

test('the shared clock: someone else keeps it, so your weather, watch and lightning don\'t move it', () => {
  const { ev } = loadCity();
  ev(`net.on = true; net.peers.set('zz', {}); net.clockOwner = false; NET_FEATURES.clock = false;`);
  assert.strictEqual(ev('netFollowsClock()'), false, 'with the shared clock switched off, your clock is your own');
  const offId = ev('netBuildId()');
  ev(`NET_FEATURES.clock = true;`);
  assert.notStrictEqual(ev('netBuildId()'), offId, 'players with different features switched on don\'t mix');
  ev(`mode = 'walk'; tod = 10; weather = 'clear'; wTimer = 1; weatherDue = 0; storm = 1;
      clearInventory(); carryItem({ id: 'pocketwatch', uses: 0 }); held = 0; K.KeyQ = 1; bolt = null;`);
  assert.strictEqual(ev('netFollowsClock()'), true);
  ev(`for (let k = 0; k < 600; k++) env(0.05);`); // 30 s, the watch held out
  assert.strictEqual(ev('weather'), 'clear', 'no weather change of your own');
  assert.strictEqual(ev('bolt'), null, 'no lightning of your own (the keeper\'s comes over the wire)');
  assert.ok(Math.abs(ev('tod') - 11.5) < 0.01, 'and the watch didn\'t hurry it: ' + ev('tod'));
  ev(`net.clockOwner = true; wTimer = 1; K.KeyQ = 0;`);
  ev(`for (let k = 0; k < 600; k++) env(0.05);`);
  assert.notStrictEqual(ev('wTimer'), 1, 'keeping it yourself: the weather timer runs again');
  ev(`net.on = false; net.peers.clear();`);
  assert.strictEqual(ev('netShared()'), false);
});

test('shared cars: ids, the parked list, and the traffic leaving another player\'s car alone', () => {
  const { ev } = loadCity();
  assert.strictEqual(ev(`netCarId('abc123:4')`), 'abc123:4');
  assert.strictEqual(ev(`netCarId('abc 123:4')`), '', 'no spaces');
  assert.strictEqual(ev(`netCarId('x'.repeat(50) + ':1')`), '', 'too long');
  assert.strictEqual(ev(`netCarId(7)`), '');
  const parked = j(ev, `netCheckParked([{ id: 'p:1', kind: 'car', body: 2, x: N + 1, y: 3, a: 0, locked: 1 }, { id: 'bad', kind: 'car', body: 2, x: 1, y: 1, a: 0 }, { id: 'p:2', kind: 'car', body: 2, x: 'NaN', y: 1, a: 0 }])`);
  assert.strictEqual(parked.length, 1, 'only the good one');
  assert.strictEqual(parked[0].x, 1, 'wrapped into the world');
  assert.strictEqual(parked[0].locked, true);
  assert.strictEqual(ev(`netCheckParked(Array.from({ length: 40 }, (_, k) => ({ id: 'p:' + k, kind: 'car', body: 1, x: 1, y: 1, a: 0 }))).length`), ev('NET_PARKED_MAX'));
  assert.strictEqual(ev(`netCheckTick(${tick({ mode: 'drive', veh: { id: 'p:9', kind: 'car', body: 2 } })}).veh.id`), 'p:9');
  assert.strictEqual(ev(`playerCar({ remote: true })`), true);
  assert.strictEqual(ev(`playerCar({ player: true })`), true);
  assert.strictEqual(ev(`playerCar({})`), false);
  // a stand-in for another player's car, out in the traffic: never driven, never towed or sent back into the lanes
  ev(`var R_ = cars.find(c => c.kind === 'car' && !c.patrol && !c.ev); R_.remote = true; R_.parked = false; R_.v = 1; var rx = R_.x, ry = R_.y;
      for (let k = 0; k < 40; k++) stepTraffic(0.05, T += 0.05);`);
  assert.deepStrictEqual(j(ev, '[R_.x, R_.y]'), j(ev, '[rx, ry]'), 'the traffic doesn\'t drive it');
  ev(`R_.parked = true; px = mod(R_.x + 100, N); for (let k = 0; k < 5; k++) stepTraffic(0.05, T += 0.05);`);
  assert.strictEqual(ev('cars.includes(R_) && R_.parked'), true, 'nor tidy it away when you\'re far off');
});

test('spray paint from other players: only well-formed dots, rounded the same way as a save', () => {
  const { ev } = loadCity();
  const good = '[5, 2, 10.123456, 0.2, 0.01, 3, 42]';
  assert.strictEqual(ev(`netCheckDots([${good}], 9).length`), 1);
  for (const bad of ['[5, 4, 1, 0.2, 0.01, 3, 42]', '[-1, 0, 1, 0.2, 0.01, 3, 42]', '[5, 0, 1, 0.2, 0.9, 3, 42]', '[5, 0, 1, 0.2, 0.01, 9, 42]', '[5, 0, 1, -1, 0.01, 3, 42]', '[5, 0, "x", 0.2, 0.01, 3, 42]', '[5, 0, 1, 0.2]'])
    assert.strictEqual(ev(`netCheckDots([${bad}], 9).length`), 0, bad);
  assert.strictEqual(ev(`netCheckDots(Array.from({ length: 3000 }, () => ${good}), 9).length`), ev('NET_PAINT_MSG'), 'capped per message');
  assert.strictEqual(ev(`netDotKey(${good})`), ev(`netDotKey(netDotOut(${good}))`), 'a dot and its sent (rounded) form are the same dot');
});
