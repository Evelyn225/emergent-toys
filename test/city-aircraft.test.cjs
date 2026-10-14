'use strict';
// The airport (world.js), the airliners' comings and goings and the flight model (aircraft.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

// fly `c` (an expression that makes the aircraft) with `inp` (an object, or (c, t) => object) for up to `secs`,
// stopping at the first landing, crash or ditching; returns the events and where it ended up
function fly(ev, make, inp, secs) {
  return JSON.parse(ev(`(() => { const c = ${make}; c.state = 'flown'; const inp = ${inp}, evs = [];
    for (let t = 0; t < ${secs}; t += 1 / 60) {
      const e = flyStep(c, typeof inp === 'function' ? inp(c, t) : inp, 1 / 60);
      for (const k of e) evs.push({ k, t, x: c.x, z: c.z });
      if (e.some(k => ['land', 'hard', 'crash', 'ditch'].includes(k))) break;
    }
    aircraft.splice(aircraft.indexOf(c), 1);
    return JSON.stringify({ evs, x: c.x, y: c.y, z: c.z, v: c.v, dmg: c.dmg, fire: c.fireT != null }); })()`));
}
const kinds = r => r.evs.map(e => e.k);

test('the airport is an island in the bay, joined to the shore by the causeway', () => {
  const { ev } = loadCity();
  assert.equal(ev('seaAt(RUNWAY.x0 + 5, RUNWAY.y)'), false, 'the runway is dry land');
  assert.equal(ev('seaAt(40, AIRPORT.y1 + 4)'), true, 'water past its far side');
  assert.equal(ev('onRunway((RUNWAY.x0 + RUNWAY.x1) / 2, RUNWAY.y)'), true);
  for (let y = ev('CAUSEWAY.y0') + 0.5; y < ev('AIRPORT.y0') + 2; y += 0.5)
    assert.ok(ev(`onPier(CAUSEWAY.x, ${y}) || onAirport(CAUSEWAY.x, ${y})`), `the causeway carries you across at y ${y}`);
  assert.ok(ev('airportBlocked(40, AIRPORT.y0 + 3.4, 0)'), 'the terminal is solid');
  assert.ok(ev('airportHeight(TOWER.x, TOWER.y)') > 3, 'the control tower stands tall');
});

test('airliners come and go all day without getting stuck', () => {
  const { ev } = loadCity();
  const r = JSON.parse(ev(`(() => { const seen = { dep: 0, arr: 0 }; let worst = 0;
    for (let t = 0; t < 4 * 3600; t += 0.1) {
      const before = aircraft.filter(a => a.type === 'airliner').length;
      stepAirTraffic(0.1);
      const after = aircraft.filter(a => a.type === 'airliner');
      if (after.length < before) seen.dep++;
      if (after.length > before) seen.arr++;
      const m = after.find(a => a.state !== 'parked'); if (m) worst = Math.max(worst, (m.busyT = (m.busyT || 0) + 0.1));
    }
    return JSON.stringify({ ...seen, worst, gates: aircraft.filter(a => a.type === 'airliner' && a.state === 'parked').map(a => a.gate) }); })()`));
  assert.ok(r.dep >= 10 && r.arr >= 10, `${r.dep} departures and ${r.arr} arrivals in four hours`);
  assert.ok(r.worst < 240, `no movement takes more than four minutes (longest ${r.worst.toFixed(0)}s)`);
  assert.equal(new Set(r.gates).size, r.gates.length, 'never two at one gate');
});

test('the tower holds the airliners while something is sitting on the runway', () => {
  const { ev } = loadCity();
  ev(`airNext = 0; addAircraft('prop', RUNWAY.x0 + 10, RUNWAY.y, 0)`);
  ev('for (let t = 0; t < 60; t += 0.1) stepAirTraffic(0.1)');
  assert.equal(ev(`aircraft.filter(a => a.type === 'airliner' && a.state !== 'parked').length`), 0);
});

test('a light plane takes off from the runway at full power, and climbs away', () => {
  const { ev } = loadCity();
  const r = fly(ev, `addAircraft('prop', RUNWAY.x0 + 1, RUNWAY.y, 0, { ground: true })`,
    `(c, t) => ({ throttle: 1, pitch: c.v > PLANE_TYPES.prop.vr ? 0.6 : 0, turn: 0, lift: 0 })`, 15);
  const off = r.evs.find(e => e.k === 'takeoff');
  assert.ok(off, 'it lifts off');
  assert.ok(off.x < ev('RUNWAY.x1') - 20, `with most of the runway to spare (off at x ${off.x.toFixed(1)})`);
  assert.ok(r.z > 4, `and climbs (${(r.z * 10).toFixed(0)}m after 15s)`);
  assert.deepEqual(kinds(r).filter(k => k !== 'takeoff'), []);
});

test('short of lift-off speed, pulling back does nothing', () => {
  const { ev } = loadCity();
  const r = fly(ev, `addAircraft('prop', RUNWAY.x0 + 1, RUNWAY.y, 0, { ground: true })`, `{ throttle: 1, pitch: 1, turn: 0, lift: 0 }`, 2);
  assert.deepEqual(kinds(r), []);
  assert.equal(r.z, 0);
});

test('throttle back on the approach and it settles onto the runway; cut it and the landing is heavy, not fatal', () => {
  const { ev } = loadCity();
  const approach = thr => fly(ev, `addAircraft('prop', RUNWAY.x1 - 4, RUNWAY.y, Math.PI, { z: 3, v: 2.8, throttle: ${thr} })`, `{ throttle: 0, pitch: 0, turn: 0, lift: 0 }`, 40);
  const soft = approach(0.35);
  assert.ok(kinds(soft).includes('land'), `a gentle landing: ${kinds(soft)}`);
  assert.ok(ev(`onRunway(${soft.x}, ${soft.y})`), 'on the runway');
  assert.equal(soft.dmg, 0);
  const dead = approach(0);
  assert.ok(kinds(dead).includes('hard'), `power off from 30m: ${kinds(dead)}`);
  assert.ok(dead.dmg > 0 && !dead.fire);
});

test('flying it into the ground, or into a building, is a crash and a fire', () => {
  const { ev } = loadCity();
  const dive = fly(ev, `addAircraft('prop', 100, 100, 0, { z: 8, v: 5, throttle: 1 })`, `{ throttle: 0, pitch: -1, turn: 0, lift: 0 }`, 30);
  assert.ok(kinds(dive).includes('crash'));
  assert.ok(dive.fire, 'it catches fire');
  // low and level at a tall building
  const tall = JSON.parse(ev(`(() => { for (let y = 8; y < 200; y += 8) for (let x = 0; x < 256; x += 0.5) if (policeRoofHeight(x, y + 3) > 2) return JSON.stringify([x, y + 3, policeRoofHeight(x, y + 3)]); })()`));
  const wall = fly(ev, `addAircraft('heli', ${tall[0] - 3}, ${tall[1]}, 0, { z: 1, rotor: 1 })`, `{ throttle: 1, pitch: 0, turn: 0, lift: 0 }`, 10);
  assert.ok(kinds(wall).includes('crash'), `into the side of it: ${kinds(wall)}`);
});

test('a helicopter spins up, climbs, hovers, and sets down on its pad', () => {
  const { ev } = loadCity();
  const r = JSON.parse(ev(`(() => { const c = addAircraft('heli', HELIPADS[0].x + 3, HELIPADS[0].y, 0, { ground: true }); c.state = 'flown';
    const at = {}, evs = [];
    for (let t = 0; t < 40; t += 1 / 60) {
      const lift = t < 9 ? 1 : t < 14 ? 0 : -1;
      evs.push(...flyStep(c, { throttle: 0, pitch: 0, turn: 0, lift }, 1 / 60));
      if (t > 1 && t < 1.02) at.early = c.z;
      if (t > 13.9 && t < 13.92) at.hoverA = c.z;
      if (t > 11 && t < 11.02) at.hoverB = c.z;
      if (c.ground && t > 14) break;
    }
    return JSON.stringify({ ...at, evs, z: c.z, dmg: c.dmg }); })()`));
  assert.equal(r.early, 0, 'not off the ground till the rotor is up to speed');
  assert.ok(r.hoverB > 5, `it climbs (${(r.hoverB * 10).toFixed(0)}m)`);
  assert.ok(Math.abs(r.hoverA - r.hoverB) < 0.3, 'with the collective centred it holds its height');
  assert.deepEqual(r.evs, ['takeoff', 'land'], 'holding F all the way down is a gentle landing');
  assert.equal(r.dmg, 0);
});

test('come down over the bay and it ditches', () => {
  const { ev } = loadCity();
  const r = fly(ev, `addAircraft('heli', 40, AIRPORT.y1 + 6, 0, { z: 2, rotor: 1 })`, `{ throttle: 0, pitch: 0, turn: 0, lift: -1 }`, 20);
  assert.deepEqual(kinds(r), ['ditch']);
});

test('too slow and the plane stalls: the nose drops and it picks up speed again', () => {
  const { ev } = loadCity();
  const r = JSON.parse(ev(`(() => { const c = addAircraft('prop', 100, 100, 0, { z: 15, v: 1.6, throttle: 0.6 }); c.state = 'flown'; const evs = []; let minPitch = 0;
    for (let t = 0; t < 8; t += 1 / 60) { evs.push(...flyStep(c, { throttle: 0, pitch: 0, turn: 0, lift: 0 }, 1 / 60)); minPitch = Math.min(minPitch, c.pitch); }
    return JSON.stringify({ evs, v: c.v, minPitch, stalled: c.stalled }); })()`));
  assert.ok(r.evs.includes('stall'));
  assert.ok(r.minPitch < -0.1, 'the nose drops');
  assert.ok(!r.stalled && r.v > ev('stallSpeed(PLANE_TYPES.prop)'), 'and it flies out of it');
});

test('a burning aircraft goes up after a few seconds, like a car', () => {
  const { ev } = loadCity();
  ev(`addAircraft('prop', 30, 30, 0, { tag: 'burn' }); damageCraft(aircraft.find(a => a.tag === 'burn'), 200)`);
  let boom = [];
  for (let k = 0; k < 20 && !boom.length; k++) boom = JSON.parse(ev('JSON.stringify(stepAircraftFires(0.5).map(a => a.tag))'));
  assert.deepEqual(boom, ['burn']);
  assert.ok(ev(`aircraft.find(a => a.tag === 'burn').wrecked`));
});

test('one you stole and left lying about goes back to its stand once you are well away; yours stays put', () => {
  const { ev } = loadCity();
  ev(`var mine = aircraft.find(a => a.type === 'prop'), took = aircraft.find(a => a.type === 'heli');
    mine.owned = true; mine.forSale = false; mine.x = 120; mine.y = 100;
    took.stolen = true; took.x = 122; took.y = 100; took.dmg = 30`);
  assert.equal(ev('stepFleet(121, 101, null).length'), 0, 'not while you are standing by them');
  assert.deepEqual(JSON.parse(ev('JSON.stringify(stepFleet(200, 30, null).map(a => a.type))')), ['heli']);
  assert.equal(ev('took.x === took.home.x && took.y === took.home.y && took.dmg === 0 && !took.stolen'), true);
  assert.equal(ev('mine.x'), 120, 'yours is where you left it');
});

test('your aircraft, wrecked or sunk, is replaced on its stand', () => {
  const { ev } = loadCity();
  ev(`var mine = aircraft.find(a => a.type === 'jet'); mine.owned = true; mine.x = 120; mine.y = 100; damageCraft(mine, 500); stepAircraftFires(10)`);
  assert.equal(ev('mine.wrecked'), true);
  assert.deepEqual(JSON.parse(ev('JSON.stringify(stepFleet(200, 30, null).map(a => a.type))')), ['jet']);
  assert.equal(ev('!mine.wrecked && mine.fireT === undefined && mine.dmg === 0 && mine.owned'), true);
});

test('owned aircraft are saved and loaded where you parked them; one in the air comes back on its stand', () => {
  const { ev } = loadCity();
  ev(`var pa = aircraft.find(c => c.type === 'prop'), pb = aircraft.find(c => c.type === 'heli');
    pa.owned = pb.owned = true; pa.x = 130.5; pa.y = 60.5; pa.yaw = 1; pa.dmg = 20;
    pb.x = 90; pb.y = 90; pb.z = 6; pb.state = 'flown'; pb.ground = false`);
  const saved = ev('JSON.stringify(savedPlanes())');
  const fresh = loadCity().ev;
  fresh(`loadPlanes(${saved})`);
  const got = JSON.parse(fresh(`JSON.stringify(aircraft.filter(a => a.owned).map(a => [a.type, a.x, a.y, a.dmg, a.forSale, a.x === a.home.x]))`));
  assert.deepEqual(got.find(g => g[0] === 'prop').slice(0, 5), ['prop', 130.5, 60.5, 20, false]);
  assert.equal(got.find(g => g[0] === 'heli')[5], true, 'the helicopter was in the air: it is back on its pad');
});

test('stealing an aircraft is two stars', () => {
  const { ev } = loadCity();
  ev(`addWanted('planetheft', 40, 220, true)`);
  assert.equal(ev('wanted.stars'), 2);
  assert.equal(ev('wanted.crime'), 'aircraft theft');
});
