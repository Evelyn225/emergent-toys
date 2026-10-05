// ===== little things on the street: manhole covers in the road (some with steam pouring out, as from a city's steam
// pipes), and now and then a flock of pigeons pecking about on a sidewalk, in a park or a plaza, that bursts up and
// flies off when you get close.

// ---- manholes: one in a lane now and then (deterministic, so they're always in the same places). [x, y, steams]
// of the one in the road cell at (wx, wy), or null. Not on the bridges.
function manholeAt(wx, wy) {
  const road = ROAD[idx(Math.floor(wx), Math.floor(wy))];
  if (road !== 1 && road !== 2) return null;
  const bx = Math.floor(wx / 8), by = Math.floor(wy / 8);
  if (road === 1 && onBridge(bx, by)) return null;
  const e = road === 1 ? mod(wx, 8) : mod(wy, 8), lane = e < 1 ? 0.65 : 1.35, seg = Math.floor(road === 1 ? wy : wx);
  const h = hash(seg, Math.floor((road === 1 ? bx : by) * 2 + (e < 1 ? 0 : 1)), road === 1 ? 1201 : 1203);
  if (h > 0.045) return null;
  const across = (road === 1 ? bx : by) * 8 + lane;
  return road === 1 ? [across, seg + 0.5, h < 0.028] : [seg + 0.5, across, h < 0.028];
}
// the cover, drawn into the road: an iron disc with a grid cast in it and a rim (0.06 cells, 60cm, across)
function manholeCell(wx, wy, L) {
  const m = manholeAt(wx, wy);
  if (!m) return null;
  const dx = rel(wx - m[0]), dy = rel(wy - m[1]), r = Math.hypot(dx, dy);
  if (r > 0.03) return null;
  if (r > 0.025) return ['O', C(GRAY, L * 1.1), C(GRAY, 1)];
  const grid = Math.abs(fract(dx * 120) - 0.5) < 0.18 || Math.abs(fract(dy * 120) - 0.5) < 0.18;
  return [grid ? '#' : '+', C(GRAY, L * (grid ? 0.9 : 0.6)), C(GRAY, 1 + L * 0.06)];
}
// steam from the ones near you: puffs into the haze (smoke.js), rising fast, thinning as they go
let steamT = 1.5; // wait for the opening scene to settle before emitting nearby manhole steam
function stepSteam(dt) {
  if (mode !== 'walk' && mode !== 'drive' && mode !== 'taxi' || (steamT -= dt) > 0) return;
  steamT = 0.22;
  const seen = new Set();
  for (let y = Math.floor(py - 3); y <= py + 3; y++) for (let x = Math.floor(px - 3); x <= px + 3; x++) {
    const m = manholeAt(x + 0.5, y + 0.5);
    if (!m || !m[2]) continue;
    const key = Math.round(m[0] * 10) + ',' + Math.round(m[1] * 10);
    if (seen.has(key)) continue;
    seen.add(key);
    haze.push({ at: '', kind: 'steam', s: 0.1, x: m[0] + (Math.random() - 0.5) * 0.02, y: m[1] + (Math.random() - 0.5) * 0.02, z: 0.01, r: 0.035, rMax: 0.12, vx: 0, vy: 0, vz: 0.05,
      life: 1.15, fade: 1 / 3.5, seed: Math.random() * 100 });
  }
  while (haze.length > 120) haze.shift();
}

// ---- pigeons: a flock of 5 to 9, by day, out of the rain, somewhere you could walk. They peck and shuffle about;
// get within a few metres and they all take off at once, away from you, wings going, up and gone
const flocks = []; // { x, y, birds: [{ dx, dy, ph, dir, fx, fy, fz }], scared: 0 (or the time they went up) }
let flockT = 0;
const PIGEON = { peck: pad([' _ ', '(o>', ' "']), look: pad([' _ ', '(o>', '/ \\']), up: ['\\v/'], down: ['/^\\'] };
const pigeonSpot = (x, y) => { // somewhere a pigeon would be: open ground or a sidewalk, not out in the traffic
  if (map[idx(Math.floor(x), Math.floor(y))] || isWater(x, y) || !free(x, y) || inGardens(x, y)) return false;
  const road = ROAD[idx(Math.floor(x), Math.floor(y))];
  if (!road) return true;
  if (road === 3) return false;
  const e = road === 1 ? mod(x, 8) : mod(y, 8);
  return e < 0.28 || e > 1.72;
};
function stepPigeons(dt) {
  for (let k = flocks.length - 1; k >= 0; k--) { // the ones you've scared, flying off; ones you've left far behind
    const f = flocks[k], d = Math.hypot(rel(f.x - px), rel(f.y - py));
    if (!f.scared && mode === 'walk' && d < 0.3) {
      f.scared = T;
      for (const b of f.birds) { const ax = rel(f.x + b.dx - px), ay = rel(f.y + b.dy - py), n = Math.hypot(ax, ay) || 1, sp = 0.18 + Math.random() * 0.12;
        b.fx = ax / n * sp + (Math.random() - 0.5) * 0.12; b.fy = ay / n * sp + (Math.random() - 0.5) * 0.12; b.fz = 0.06 + Math.random() * 0.05; b.z = 0; }
      if (actx) burst(actx.currentTime, 0.6, [filt('bandpass', 1500, 0.7)], 0.1); // a clatter of wings
    }
    if (f.scared) for (const b of f.birds) { b.dx += b.fx * dt; b.dy += b.fy * dt; b.z += b.fz * dt; b.fz += 0.02 * dt; }
    if (f.scared && T - f.scared > 5 || d > 7) flocks.splice(k, 1);
  }
  if ((flockT -= dt) > 0 || mode !== 'walk') return;
  flockT = 6;
  if (flocks.length >= 2 || tod < 6.5 || tod > 19.5 || rain > 0.3 || Math.random() > 0.3) return; // (rare)
  for (let tries = 0; tries < 20; tries++) {
    const ang = Math.random() * Math.PI * 2, dist = 1.3 + Math.random() * 2.5, x = mod(px + Math.cos(ang) * dist, N), y = mod(py + Math.sin(ang) * dist, N);
    if (!pigeonSpot(x, y)) continue;
    const n = 5 + (Math.random() * 5 | 0), birds = [];
    for (let k = 0; k < n; k++) { const bx = (Math.random() - 0.5) * 0.12, by = (Math.random() - 0.5) * 0.12; if (pigeonSpot(x + bx, y + by)) birds.push({ dx: bx, dy: by, ph: Math.random() * 9, dir: Math.random() < 0.5 ? 1 : -1, z: 0 }); }
    if (birds.length >= 3) { flocks.push({ x, y, birds, scared: 0 }); return; }
  }
}
function drawPigeons() {
  for (const f of flocks) for (const b of f.birds) {
    const vx = rel(f.x + b.dx - px), vy = rel(f.y + b.dy - py);
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    let art;
    if (f.scared) art = fract(T * 7 + b.ph) < 0.5 ? PIGEON.up : PIGEON.down;
    else { // pecking, looking about, shuffling a step now and then
      const t = fract(T * 0.35 + b.ph * 0.1);
      art = t < 0.55 ? (fract(T * 2.5 + b.ph) < 0.5 ? PIGEON.peck : PIGEON.look) : PIGEON.look;
      if (t > 0.9) b.dx += b.dir * 0.004 * (1 / 60);
    }
    if (!f.scared && b.dir < 0) art = art.map(l => [...l].reverse().join('').replace(/>/g, '<'));
    drawArt(vx, vy, b.z || 0, f.scared ? 0.022 : 0.03, f.scared ? 0.007 : 0.028, art, (c, row, L) => c === '>' || c === '<' ? C(ORANGE, Math.max(L, 6)) : row === 1 && c === 'o' ? C(WHITE, Math.max(L, 8)) : C(GRAY, Math.max(L, 6)));
  }
}
