'use strict';
// ASCII City's world, traffic, routines and el, run headless in a vm (see test/helpers/load-city.cjs).
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();
const j = expr => JSON.parse(ev(`JSON.stringify(${expr})`));

test('street network: no dead ends, and every way into an intersection has a way out', () => {
  assert.deepStrictEqual(j('streetProblems()'), []);
  const stuck = j(`(() => {
    const bad = [];
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!exitOK(bx, by, -dx, -dy)) continue; // no street coming in from that side
      const outs = [[dx, dy], [dy, -dx], [-dy, dx]].filter(([x, y]) => exitOK(bx, by, x, y));
      if (!outs.length) bad.push([bx, by, dx, dy]);
    }
    return bad;
  })()`);
  assert.deepStrictEqual(stuck, []);
});

test('the sea is wider than the draw distance except where the bridges cross it', () => {
  const r = j(`(() => {
    let run = 0, best = 0;
    for (let y = 0; y < N * 2; y++) { if (seaAt(5.5, y + 0.5)) best = Math.max(best, ++run); else run = 0; }
    const bridgeDry = BRIDGE_X.every(bx => { for (let y = SHORE_S * 8; y < N + 8; y++) if (isWater(bx * 8 + 1, y + 0.5)) return false; return true; });
    return { best, bridgeDry };
  })()`);
  assert.ok(r.best > ev('MAXD'), `open water run ${r.best} should exceed the draw distance`);
  assert.ok(r.bridgeDry, 'bridge decks are not water');
});

test('districts all exist, and look different', () => {
  const r = j(`(() => {
    const n = {}, h = {}, cells = {};
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { const d = districtOf(bx, by); n[d] = (n[d] || 0) + 1; }
    for (let i = 0; i < N * N; i++) if (map[i] && STY[i] > 6 || map[i] && STY[i] < 3) {
      const d = districtAt(i % N + 0.5, Math.floor(i / N) + 0.5); h[d] = (h[d] || 0) + map[i]; cells[d] = (cells[d] || 0) + 1;
    }
    const avg = {}; for (const d in h) avg[d] = h[d] / cells[d];
    return { n, avg };
  })()`);
  for (const d of ['downtown', 'midtown', 'chinatown', 'industrial', 'brownstones']) assert.ok(r.n[d] >= 20, `${d}: ${r.n[d]} blocks`);
  assert.ok(r.avg.downtown > r.avg.midtown && r.avg.midtown > r.avg.industrial, JSON.stringify(r.avg));
});

test('cars start on streets, and the whole city drives for a minute without a crash', () => {
  assert.strictEqual(j('cars.filter(c => !ROAD[idx(Math.floor(c.x), Math.floor(c.y))]).length'), 0);
  const r = j('selfTest(3000)');
  assert.strictEqual(r.crashes, 0);
  assert.ok(r.turns > 100, 'cars turn');
  assert.ok(r.worst < 30, `longest stop ${r.worst}s`);
});

test('emergency vehicles come through without a crash', () => {
  const runs = [0, 1, 2, 3].map(n => j(`(() => {
    px = 9 * 8 + 1 + ${n} * 40; py = 10 * 8 + 4; mode = 'walk';
    const e = spawnEmergency(), start = [e.x, e.y]; let pulled = 0, crashes = 0;
    for (let k = 0; k < 1500 && cars.includes(e); k++) {
      stepTraffic(0.02, T += 0.02);
      pulled = Math.max(pulled, cars.filter(c => !c.ev && c.off > 0.25).length);
      fillGrid(carGrid, cars, 'ex', 'ey');
      for (const c of cars) for (const o of nearby(carGrid, c.ex, c.ey, []))
        if (o.id > c.id && Math.hypot(rel(c.ex - o.ex), rel(c.ey - o.ey)) < 0.3) crashes++;
    }
    return { kind: e.kind, moved: Math.hypot(rel(e.x - start[0]), rel(e.y - start[1])), pulled, crashes };
  })()`));
  for (const r of runs) {
    assert.ok(['amb', 'fire', 'police'].includes(r.kind));
    assert.ok(r.moved > 5, `it drove ${r.moved} cells`);
    assert.strictEqual(r.crashes, 0);
  }
});

test('a car with a siren coming up behind pulls over, lets it by, and carries on', () => {
  const r = j(`(() => {
    for (let tries = 0; tries < 100; tries++) {
      px = 9 * 8 + 1 + tries * 16; py = 10 * 8 + 4; mode = 'walk';
      const e = spawnEmergency();
      if (!e) continue;
      const x = e.x + e.hx * 2, y = e.y + e.hy * 2;
      if (e.left < 6 || cars.some(o => o !== e && Math.hypot(rel(o.x - x), rel(o.y - y)) < 1.5)) { cars.splice(cars.indexOf(e), 1); continue; }
      const c = addCar({ x, y, hx: e.hx, hy: e.hy, body: RED });
      let pulled = 0, passed = false, crashes = 0;
      for (let k = 0; k < 1500; k++) {
        stepTraffic(0.02, T += 0.02);
        pulled = Math.max(pulled, c.off);
        if (!passed && rel(e.x - c.x) * c.hx + rel(e.y - c.y) * c.hy > 1) passed = true;
        if (Math.hypot(rel(c.ex - e.ex), rel(c.ey - e.ey)) < 0.3) crashes++;
      }
      return { pulled, passed, crashes, backInLane: Math.abs(c.off) < 0.05 };
    }
    return null;
  })()`);
  assert.ok(r, 'set up a car in front of an emergency vehicle');
  assert.ok(r.pulled > 0.25, `pulled over ${r.pulled}`);
  assert.ok(r.passed, 'the emergency vehicle got past');
  assert.strictEqual(r.crashes, 0);
  assert.ok(r.backInLane, 'and the car pulled back out');
});

test('shops keep hours', () => {
  const r = j(`[openAt({ kind: SHOP_LIT, hours: hoursOf('BAR') }, 1), openAt({ kind: SHOP_LIT, hours: hoursOf('BAR') }, 12),
               openAt({ kind: SHOP_LIT, hours: hoursOf('CAFE') }, 20), openAt({ kind: SHOP_LIT, hours: hoursOf('24/7') }, 4),
               openAt({ kind: SHOP_APTS, hours: [9, 17] }, 3)]`);
  assert.deepStrictEqual(r, [true, false, false, true, true]);
});

test('routines: everyone is in by 4am, at work mid-morning, and the owls are out at night', () => {
  const share = (t, act, role) => j(`(() => { const ps = people.filter(p => !${JSON.stringify(role)} || p.role === ${JSON.stringify(role)});
    return ps.filter(p => activity(p, ${t}) === ${JSON.stringify(act)}).length / ps.length; })()`);
  assert.ok(share(4, 'home') > 0.85, 'home at 4am');
  assert.ok(share(11, 'work', 'worker') > 0.95, 'at work at 11');
  assert.ok(share(23.5, 'bar', 'owl') > 0.95, 'owls in the bars at 23:30');
  assert.ok(share(13, 'home') < 0.2, 'few at home at 1pm');
});

test('streets are busy in the evening and empty out by 4am', () => {
  const r = j(`(() => {
    px = 8 * 8 + 1; py = 11 * 8 + 4; mode = 'walk'; tod = 16;
    const out = () => people.filter(p => !p.hidden && Math.hypot(rel(p.x - px), rel(p.y - py)) < 40).length;
    const run = hours => { for (let k = 0; k < hours * 400; k++) { tod = mod(tod + 0.0025, 24); stepPeople(0.05, T += 0.05); } };
    run(4); const evening = out();
    run(8); const night = out();
    return { evening, night };
  })()`);
  assert.ok(r.night * 3 < r.evening, JSON.stringify(r));
});

test('pedestrians find their way to a door two blocks off', () => {
  const r = j(`(() => {
    let ok = 0, worst = 0;
    for (let n = 0; n < 100; n++) {
      const p = people[n]; p.hidden = false; p.inside = null; p.loiter = false; snapToCorner(p); p.legs = 0; p.act = 'wander';
      const g = nearestDoor(p.x + 14, p.y + 9, d => d.use === 'shop', 2);
      if (!g) { ok++; continue; }
      p.goal = g;
      for (let k = 0; k < 20000 && !p.inside; k++) {
        const w = p.path[0];
        if (!w) { planPerson(p, T); continue; }
        const ex = rel(w.x - p.x), ey = rel(w.y - p.y), dist = Math.hypot(ex, ey);
        if (dist <= 0.2) { p.x = mod(w.x, N); p.y = mod(w.y, N); p.path.shift(); if (w.enter) p.inside = w.enter; }
        else { p.x = mod(p.x + ex / dist * 0.2, N); p.y = mod(p.y + ey / dist * 0.2, N); }
      }
      if (p.inside === g) ok++;
      worst = Math.max(worst, p.legs);
    }
    return { ok, worst };
  })()`);
  assert.strictEqual(r.ok, 100);
  assert.ok(r.worst < 30, `took ${r.worst} legs`);
});

test('pedestrians stay on walkable ground and some reach their doors', () => {
  const r = j(`(() => {
    let entered = 0;
    for (let k = 0; k < 2000; k++) { stepPeople(0.05, T += 0.05, true); }
    for (const p of people) if (p.inside) entered++;
    const bad = people.filter(p => !p.hidden && !p.follow && (map[idx(Math.floor(p.x), Math.floor(p.y))] || isWater(p.x, p.y)));
    return { entered, bad: bad.length, sample: bad.slice(0, 3).map(p => [p.x, p.y]) };
  })()`);
  assert.strictEqual(r.bad, 0, JSON.stringify(r.sample));
  assert.ok(r.entered > 100, `${r.entered} people indoors`);
});

test('el trains: stop inside the stations, move smoothly, never share track space', () => {
  const r = j(`(() => {
    let jump = 0, overlap = 0, offStation = 0;
    for (let t = 0; t < EL_CYCLE; t += 0.25) {
      const now = elTrains(t), later = elTrains(t + 0.25);
      now.forEach((a, i) => { jump = Math.max(jump, Math.abs(rel(later[i].x - a.x)));
        if (a.stopped && Math.abs(rel(a.x - EL_STATIONS[a.station].x)) > 0.01) offStation++; });
      for (const a of now) for (const b of now) if (a !== b && a.tr === b.tr && Math.abs(rel(a.x - b.x)) < EL_CARS * EL_CAR_LEN) overlap++;
    }
    return { jump, overlap, offStation };
  })()`);
  assert.ok(r.jump < 2, `train moved ${r.jump} cells in a quarter second`);
  assert.strictEqual(r.overlap, 0);
  assert.strictEqual(r.offStation, 0);
});

test('talk: directions and lines', () => {
  assert.strictEqual(ev('directions(0, 0, 0, -16)'), '2 blocks north');
  assert.strictEqual(ev('directions(0, 0, 8, 8)'), '1 block south-east');
  for (let k = 0; k < 50; k++) assert.strictEqual(typeof ev('talkLine(pick(people))'), 'string');
  const t = j('(() => { const p = people.find(p => !p.hidden); tod = 14; for (let k = 0; k < 20 && !task; k++) startTask(p); return task && task.kind; })()');
  assert.ok(['escort', 'fetch', 'dog'].includes(t));
});
