'use strict';
// ASCII City: the audio mix (what should be audible where and when) and money. Pure, run in a vm.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();
const j = expr => JSON.parse(ev(`JSON.stringify(${expr})`));
const base = "{ mode: 'walk', room: null, day: 1, night: 0, rain: 0, fog: 0, tod: 13, roofH: 0, district: 'midtown', barCrowd: 0, seaDist: 99, onBridge: false, elNear: 0, speed: 0 }";
const mix = over => j(`audioMix({ ...${base}, ...${over} })`);

test('day and night: the city bed gives way to the night bed', () => {
  const day = mix('{}'), night = mix('{ day: 0, night: 1, tod: 23.5 }');
  assert.ok(day.city > night.city, 'more traffic by day');
  assert.ok(night.night > 0.3 && day.night === 0, 'night ambience only at night');
  assert.ok(day.crowd > night.crowd, 'crowds by day');
  // halfway through dusk both are partly in: a crossfade, not a switch
  const dusk = mix('{ day: 0.5, night: 0.5, tod: 19 }');
  assert.ok(dusk.city > night.city && dusk.city < day.city && dusk.night > 0 && dusk.night < night.night);
});

test('indoors: the street drops right down and the room takes over', () => {
  const bar = mix("{ mode: 'room', room: { kind: 'bar', word: 'BAR' }, barCrowd: 0.9, tod: 23 }");
  const out = mix('{}');
  assert.ok(bar.city < out.city * 0.2);
  assert.ok(bar.restaurant > 0.8 && bar.bossa > 0);
  assert.strictEqual(bar.crowd, 0);
  const emptyBar = mix("{ mode: 'room', room: { kind: 'bar', word: 'BAR' }, barCrowd: 0.1 }");
  assert.ok(emptyBar.restaurant < bar.restaurant, 'quiet bar in the afternoon');
  const cafe = mix("{ mode: 'room', room: { kind: 'store', word: 'CAFE' } }");
  assert.ok(cafe.bossa > 0.5 && cafe.coffee === 0, 'cafes play bossa');
  assert.ok(mix("{ mode: 'room', room: { kind: 'station', word: 'X' } }").tunnel > 0.5);
  // music: cafes, bars and shops only - never outside, in lobbies, the bank, the gym or the subway
  const music = m => m.bossa + m.coffee;
  for (const over of ['{}', "{ day: 0, night: 1, tod: 23 }", "{ mode: 'roof', roofH: 5 }", "{ mode: 'el' }", "{ mode: 'drive', speed: 2 }"]) assert.strictEqual(music(mix(over)), 0, over);
  for (const kind of ['apts', 'bank', 'gym', 'station', 'train', 'cinema']) assert.strictEqual(music(mix(`{ mode: 'room', room: { kind: '${kind}', word: 'No.101' } }`)), 0, kind);
  for (const kind of ['bar', 'diner', 'store', 'barber', 'florist', 'hotel']) assert.ok(music(mix(`{ mode: 'room', room: { kind: '${kind}', word: 'SHOP' } }`)) > 0, kind);
});

test('weather, the sea, height, the el and the car', () => {
  assert.strictEqual(mix('{ rain: 1 }').rain, 1);
  assert.ok(mix('{ seaDist: 1 }').waves > 0.8 && mix('{ seaDist: 40 }').waves === 0);
  const roof = mix("{ mode: 'roof', roofH: 8 }"), street = mix('{}');
  assert.ok(roof.city < street.city && roof.wind > street.wind, 'up on a roof: quieter street, more wind');
  assert.ok(mix("{ mode: 'el' }").rumble > 0.5);
  assert.ok(mix("{ mode: 'drive', speed: 2.5 }").engine > mix("{ mode: 'drive', speed: 0 }").engine);
  for (const k of Object.values(mix('{ rain: 1, seaDist: 0, mode: "roof", roofH: 20, fog: 1, onBridge: true }'))) assert.ok(k >= 0 && k <= 1);
});

test('footstep surfaces', () => {
  const r = j(`(() => {
    const pier = PIERS[0], park = parks[0], bridgeY = SHORE_S * 8 + 20;
    return {
      pier: surfaceAt('walk', null, (pier[0] + pier[2]) / 2, pier[3] - 0.5),
      street: surfaceAt('walk', null, 9 * 8 + 1, 10 * 8 + 4),
      bridge: surfaceAt('walk', null, BRIDGE_X[0] * 8 + 1, bridgeY),
      park: surfaceAt('walk', null, park[0] * 8 + 6.5, park[1] * 8 + 6.5),
      platform: surfaceAt('elplat', null, 0, 0),
    };
  })()`);
  assert.deepStrictEqual(r, { pier: 'wood', street: 'stone', bridge: 'metal', park: 'grass', platform: 'metal' });
});

test('money: start with $100, pay only what you have, earn from favours', () => {
  assert.strictEqual(ev('money'), 100);
  assert.strictEqual(ev('pay(2.9)'), true);
  assert.strictEqual(ev('money'), 97.1);
  assert.strictEqual(ev('pay(500)'), false);
  assert.strictEqual(ev('money'), 97.1, 'a refused payment takes nothing');
  ev('earn(12)');
  assert.strictEqual(ev('money'), 109.1);
  assert.strictEqual(ev('taxiFare(0)'), 3);
  assert.ok(ev('taxiFare(100)') > 20 && ev('taxiFare(100)') < 40, 'across town is a real expense but not ruinous');
  // a favour done pays out
  const r = j(`(() => {
    const before = money, p = people.find(q => !q.hidden);
    task = { kind: 'escort', who: p, to: { x: px, y: py, name: 'PIZZA' } };
    stepTask(0.02);
    return { gained: money - before, task };
  })()`);
  assert.ok(r.gained >= 5 && r.gained <= 15, `escort paid ${r.gained}`);
  assert.strictEqual(r.task, null);
});

test('hotels: check-in from 6pm, a night is $40 (motels $20)', () => {
  assert.deepStrictEqual(j('[17.9, 18, 23, 2, 5.5, 12].map(checkInOpen)'), [false, true, true, true, false, false]);
  assert.strictEqual(ev("ROOM_RATE('HOTEL')"), 40);
  assert.strictEqual(ev("ROOM_RATE('MOTEL')"), 20);
});

test('ray vs box: which face, how far, and misses', () => {
  const b = "{ x: 5, y: 0, c: 1, s: 0, hl: 1, hw: 1, z0: 0, z1: 1 }";
  assert.strictEqual(ev(`rayBox(0, 0, 0.5, 1, 0, 0, ${b})`), 4);
  assert.strictEqual(ev('HIT.face'), 2, 'the back face, coming from behind');
  assert.strictEqual(ev(`rayBox(0, 3, 0.5, 1, 0, 0, ${b})`), -1, 'misses to the side');
  assert.ok(Math.abs(ev(`rayBox(5, 0, 3, 0, 0.001, -1, ${b})`) - 2) < 1e-6);
  assert.strictEqual(ev('HIT.face'), 5, 'looking straight down: the top');
  assert.strictEqual(ev(`rayBox(5, 0, 0.5, 1, 0, 0, ${b})`), -1, 'inside it: not drawn');
  // turned 90 degrees: its long side now faces along y
  assert.ok(Math.abs(ev(`rayBox(0, 0, 0.5, 1, 0, 0, { x: 5, y: 0, c: 0, s: 1, hl: 2, hw: 0.5, z0: 0, z1: 1 })`) - 4.5) < 1e-9);
});

test('settings have defaults without storage', () => {
  assert.strictEqual(ev('settings.detail'), 'medium');
  assert.strictEqual(ev('settings.fov'), 90);
});
