'use strict';
// Gas stations (city/gas.js): corner forecourts with a shop at the back, and the cars that pull in to fill up.
const test = require('node:test');
const assert = require('node:assert');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();
const j = expr => JSON.parse(ev(`JSON.stringify(${expr})`));

test('a few gas stations, each a corner forecourt open to both streets with its shop along the back, open all night', () => {
  const r = j(`GAS_STATIONS.map(st => {
    const cells = [], shop = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const i = idx(st.x0 + x, st.y0 + y); (y < 2 ? cells : shop).push(y < 2 ? map[i] : SHOP[i] && SHOP[i].word); }
    return { open: cells.every(h => h === 0), shop: shop.every(w => w === 'GAS'), hours: hoursOf('GAS'), streets: !!hseg(st.bx, st.by) && !!vseg(st.bx + 1, st.by),
             stock: stockFor('gas', 'GAS').length };
  })`);
  assert.ok(r.length >= 4, `${r.length} stations`);
  for (const s of r) assert.deepStrictEqual(s, { open: true, shop: true, hours: [0, 24], streets: true, stock: 8 });
});

test("nothing stands in a forecourt's driveways: no lamp, tree or subway steps where the cars cross the pavement", () => {
  const r = j(`(() => {
    const bad = [];
    for (const st of GAS_STATIONS) for (const [x, y, hl, hw] of [[0.2, -0.16, 0.5, 0.16], [2.6, -0.16, 0.42, 0.16], [3.16, 1.35, 0.16, 0.65]]) {
      const inside = o => Math.abs(rel(o.x - st.x0 - x)) < hl && Math.abs(rel(o.y - st.y0 - y)) < hw;
      for (const [what, list] of [['lamp', lamps], ['tree', trees], ['station', stations]]) for (const o of list) if (inside(o)) bad.push([st.k, what]);
    }
    return bad;
  })()`);
  assert.deepStrictEqual(r, []);
});

test('the ways in and out of every lane are clear of the buildings, the islands and the sign', () => {
  const r = j(`(() => {
    const bad = [];
    for (const st of GAS_STATIONS) {
      const paths = [];
      for (const l of [0, 1]) paths.push(['in from the main street, lane ' + l, [[3.35, -0.6, -1, 0], [2.35, GAS.lanes[l], -1, 0], [GAS.slotX, GAS.lanes[l], -1, 0]]]);
      for (const l of [1, 2]) paths.push(['in from the side street, lane ' + l, [[3.6, GAS.lanes[l] + 0.72, 0, -1], [2.9, GAS.lanes[l], -1, 0], [GAS.slotX, GAS.lanes[l], -1, 0]]]);
      for (const l of [0, 1, 2]) paths.push(['out of lane ' + l, gasExitPoses(l)]);
      for (const [name, poses] of paths) {
        const P = gasPath(poses);
        for (let k = 1; k < P.pts.length; k++) {
          const [ax, ay] = P.pts[k - 1], [bx, by] = P.pts[k], d = Math.hypot(bx - ax, by - ay) || 1;
          if (!carBodyClear(mod(st.x0 + bx, N), mod(st.y0 + by, N), (bx - ax) / d, (by - ay) / d)) { bad.push(st.brand + ': ' + name); break; }
        }
      }
    }
    return bad;
  })()`);
  assert.deepStrictEqual(r, []);
});

test('a car pulls in, stops at the pump, fills up, waits for a gap and pulls back out into the westbound lane', () => {
  const { ev: e } = loadCity(2);
  const r = JSON.parse(e(`JSON.stringify((() => {
    const st = GAS_STATIONS[0]; px = st.x0 + 1.5; py = st.y0 - 4; mode = 'drive';
    const far = cars.filter(c => !c.ev && !c.patrol && c.kind === 'car' && Math.hypot(rel(c.x - st.x0), rel(c.y - st.y0)) > 30).slice(0, 3);
    const starts = [[0, 3.35, -0.6, -1, 0], [1, 3.6, GAS.lanes[1] + 0.72, 0, -1], [2, 3.6, GAS.lanes[2] + 0.72, 0, -1]];
    far.forEach((c, k) => {
      const [l, x, y, hx, hy] = starts[k];
      Object.assign(c, { x: mod(st.x0 + x, N), y: mod(st.y0 + y, N), hx, hy, v: 0.6, off: 0 }); c.ex = c.x; c.ey = c.y;
      startPit(c, st, l, [[x, y, hx, hy], [hy ? 2.9 : 2.35, GAS.lanes[l], -1, 0], [GAS.slotX, GAS.lanes[l], -1, 0]]);
    });
    const seen = far.map(() => ({})), back = far.map(() => false), worst = { overlap: 0 };
    for (let n = 0; n < 90 * 20 && far.some(c => c.pit); n++) {
      T += 0.05; stepTraffic(0.05, T);
      far.forEach((c, k) => {
        if (c.pit) { seen[k][c.pit.stage] = true; if (c.pit.stage === 'fill') seen[k].at = [+(rel(c.x - st.x0) - GAS.slotX).toFixed(3), +(rel(c.y - st.y0) - GAS.lanes[c.pit.lane]).toFixed(3)]; }
        else if (seen[k].out && !back[k]) back[k] = c.hx === -1 && c.hy === 0 && Math.abs(rel(c.y - st.y0 + 0.6)) < 1e-6 && Math.abs(rel(c.x - st.x0)) < 1; // (just out)
        for (const o of c.near || []) if (o !== c && Math.hypot(rel(o.ex - c.ex), rel(o.ey - c.ey)) < 0.3) worst.overlap++;
      });
    }
    return { seen, back, overlap: worst.overlap };
  })())`));
  for (const s of r.seen) assert.deepStrictEqual(s, { in: true, fill: true, out: true, at: [0, 0] });
  assert.deepStrictEqual(r.back, [true, true, true], 'all three back on the main street, heading west in its lane');
  assert.strictEqual(r.overlap, 0, 'never on top of another car');
});

test('left to themselves, passing cars do pull in now and then, and none of them gets stuck there', () => {
  const r = j(`(() => {
    mode = 'drive';
    const ids = new Set(), done = new Set(); let stuck = 0;
    for (let n = 0; n < 150 * 20; n++) { // (the whole city, not just round you)
      T += 0.05; stepTraffic(0.05, T, true);
      for (const c of cars) if (c.pit) { ids.add(c.id); if (c.pit.stuck > 20) stuck++; } else if (ids.has(c.id)) done.add(c.id);
    }
    return { pulledIn: ids.size, left: done.size, stuck };
  })()`);
  assert.ok(r.pulledIn >= 3 && r.left >= 2, JSON.stringify(r));
  assert.strictEqual(r.stuck, 0);
});
