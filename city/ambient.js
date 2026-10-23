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
let steamT = 0;
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
// A pigeon, built like the other animals (figures.js): a plump body, small head on a sheened neck, two dark bars on
// each folded wing, a dark-tipped tail, pink feet. Frames: 0 head up, 1 pecking, 2 wings up, 3 wings down.
ANIMAL_BODIES.pigeon = frame => {
  const R = AR, fly = frame >= 2, peck = frame === 1;
  const head = peck ? [0, 3.4, 1.5] : [0, 2.5, 6.1], neckTop = peck ? [0, 2.9, 2.2] : [0, 2.1, 5.6];
  const parts = [figEll([0, -0.3, 3.7], AN_I, [2.1, 3.3, 2.1], h => h.l[1] > 0.55 && h.l[2] < 0.2 ? R.PALE : R.BODY), // (a paler breast)
    figCap([0, 1.6, 4.4], neckTop, 1.15, () => R.MARK), figEll(head, AN_I, [1.05, 1.2, 1.05], () => R.HEAD),
    figCap(fAdd(head, [0, 1, -0.15]), fAdd(head, [0, 1.95, -0.5]), 0.28, () => R.BEAK), figEll(fAdd(head, [0, 1.05, 0.15]), AN_I, [0.32, 0.25, 0.22], () => R.PALE),
    figEll([0, -3.9, 3.4], AN_I, [1.15, 1.9, 0.38], h => h.l[1] < -0.55 ? R.PUPIL : R.WING)]; // the tail, its dark band
  for (const side of [-1, 1]) {
    if (!fly) {
      parts.push(figEll([side * 1.75, -0.8, 4.1], AN_I, [0.85, 2.8, 1.25], h => Math.abs(h.l[1] + 0.15) < 0.09 || Math.abs(h.l[1] + 0.45) < 0.09 ? R.PUPIL : R.WING)); // folded, two bars
      parts.push(figCap([side * 0.7, 0, 1.9], [side * 0.7, 0.4, 0.15], 0.28, () => R.LEG, false));
    } else {
      const tipZ = frame === 2 ? 8.5 : 0.8, midZ = frame === 2 ? 6.8 : 2.4;
      parts.push(figCap([side * 1.6, 0, 4.4], [side * 5.5, -0.6, midZ], 0.9, () => R.WING), figCap([side * 5.5, -0.6, midZ], [side * 9, -1.4, tipZ], 0.5, () => R.PUPIL));
    }
  }
  return { parts, decals: animalEyes(head, 1.05, 2) };
};
// three plumages a city flock mixes: the usual slate blue-grey, a dark chequer, a pale one
const PIGEON_LOOKS = [
  animalLook('pigeon', { body: [GRAY, 7], head: [GRAY, 6], wing: [GRAY, 9], mark: [GREEN, 6], pupil: [GRAY, 2], beak: [GRAY, 3], pale: [GRAY, 10], leg: [MAG, 6] }),
  animalLook('pigeon', { body: [GRAY, 4], head: [GRAY, 3], wing: [GRAY, 5], mark: [MAG, 5], pupil: [GRAY, 1], beak: [GRAY, 2], pale: [GRAY, 7], leg: [MAG, 6] }),
  animalLook('pigeon', { body: [WHITE, 12], head: [WHITE, 11], wing: [WHITE, 13], mark: [GREEN, 9], pupil: [BRICK, 7], beak: [GRAY, 4], pale: [WHITE, 14], leg: [MAG, 7] })];
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
    const ang = Math.random() * Math.PI * 2, dist = 1.3 + Math.random() * 2.5, x = worldCoord(px + Math.cos(ang) * dist), y = worldCoord(py + Math.sin(ang) * dist);
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
    b.hd ??= b.dir < 0 ? Math.PI : 0; // (which way it's facing)
    let frame;
    if (f.scared) { frame = fract(T * 7 + b.ph) < 0.5 ? 2 : 3; b.hd = Math.atan2(b.fy, b.fx); } // flying off the way it's going
    else { // pecking, looking about, shuffling a step forward and turning now and then
      const t = fract(T * 0.35 + b.ph * 0.1);
      frame = t < 0.55 && fract(T * 2.5 + b.ph) < 0.5 ? 1 : 0;
      if (t > 0.9) { b.dx += Math.cos(b.hd) * 0.004 / 60; b.dy += Math.sin(b.hd) * 0.004 / 60; }
      const cycle = Math.floor(T * 0.35 + b.ph * 0.1);
      if (t > 0.97 && b.turned !== cycle) { b.turned = cycle; b.hd += (hash(cycle, Math.floor(b.ph * 100), 2381) - 0.5) * 1.4; } // (up to 40 degrees, once a cycle)
    }
    if (!inView(vx, vy, 0.05)) continue;
    drawAnimal(vx, vy, terrainHeight(f.x + b.dx, f.y + b.dy) + (b.z || 0), 0.09, Math.cos(b.hd), Math.sin(b.hd), PIGEON_LOOKS[Math.floor(b.ph * 7) % 7 < 5 ? 0 : Math.floor(b.ph * 7) % 7 - 4], frame);
  }
}
