// ===== little things in the air, outdoors: moths round the streetlamps on warm nights, rain hitting the ground (and
// rings spreading in the puddles), drips off awnings, eaves and the el once the rain stops, autumn leaves coming down
// off the trees and lying a while, and sparks off the night market's grill and lit campfires. Each is one character in
// one cell (a speck), depth-tested against the scene and fogged like it. Cold breath is a kind of haze (smoke.js).
//
// Rain and drips find where to land from the frame itself: a cell whose surface faces up (the cell above it is
// farther away) is ground, a car roof, a step; one that faces down (the cell below it is farther) is the underside
// of an awning, a balcony, the el's deck. Its depth gives the world point, which the particle then keeps.
const PARTS = []; // { kind, x, y, z, vx, vy, vz, age, life, ground, seed, base }
const PARTS_MAX = 420;
function partAdd(p) { if (PARTS.length >= PARTS_MAX) PARTS.shift(); PARTS.push(p); }

// one character at a world point, if nothing nearer covers that cell. slack < 1 lets a speck lying on a surface win
// against that surface (as drawArt does for the ground); ahead (world units) lets one right beside something win
// against it (a moth against its own lamp). Returns the cell, or -1.
function speck(x, y, z, ch, col, slack = 1, ahead = 0) {
  const vx = rel(x - px), vy = rel(y - py), depth = dx * vx + dy * vy;
  if (depth < 0.03 || depth > vis) return -1;
  const sc = projX / depth, c = Math.floor(cols / 2 + (-dy * vx + dx * vy) * sc), r = Math.floor(hor - (z - eye) * projY / depth);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return -1;
  const i = r * cols + c;
  if (depth * slack - ahead >= ZB[i]) return -1;
  set(i, ch, col); ZB[i] = Math.min(ZB[i], depth); NOGLOW[i] = 0;
  return i;
}
// the world point a screen cell shows, from its depth (as the renderer cast it)
function cellPoint(i) {
  const c = i % cols, r = i / cols | 0, t = ZB[i], cx = 2 * (c + 0.5) / cols - 1;
  return [px + (dx - dy * tf * cx) * t, py + (dy + dx * tf * cx) * t, eye + (hor - r - 0.5) * t / projY];
}
// under a roof of its own: the Shotengai's arcade, the el's deck
const partSheltered = (x, y, z) => (typeof arcadeAt === 'function' && z < ARCADE_Z && arcadeAt(x, y))
  || (z < EL_BOT && Math.abs(rel(y - (EL_Y0 + EL_Y1) / 2)) < EL_HALF);

// ---- moths: a few round each lamp near you, after dark, in spring and summer, not in rain or snow. Worked out from
// the time alone (no state): each loops its lamp at its own speed and wobble. Black: seen only as specks against the
// lit glass and its glow, as moths are at night. They draw over their own lamp (it's no further than their orbit).
function drawMoths() {
  const s = season();
  if (lampsOn < 0.3 || rain > 0.08 || snow > 0.02 || (s !== 'spring' && s !== 'summer')) return;
  forNear(lampsB, l => {
    if (districtAt(l.x, l.y) === 'belle') return;
    const hx = l.x + l.ax * REACH, hy = l.y + l.ay * REACH, hz = (l.top ?? LAMP_TOP) - 0.075; // (the lantern's glass, hanging under the arm)
    if (Math.hypot(rel(hx - px), rel(hy - py)) > 2.5 || !inView(rel(hx - px), rel(hy - py), 0.1)) return;
    const n = 6 + (hash(Math.floor(l.x * 10), Math.floor(l.y * 10), 3301) * 5 | 0);
    for (let k = 0; k < n; k++) {
      const a = hash(Math.floor(l.x * 10) + k * 17, Math.floor(l.y * 10), 3302), b = hash(Math.floor(l.x * 10), Math.floor(l.y * 10) + k * 23, 3303);
      const t = T * (2.2 + a * 2.4) * (b > 0.5 ? 1 : -1) + a * 40, r = 0.035 + b * 0.04; // (out round the lantern, not hidden behind it)
      const x = hx + Math.cos(t) * r + Math.sin(t * 2.7 + b * 9) * 0.005, y = hy + Math.sin(t) * r * 0.85 + Math.cos(t * 3.1 + a * 7) * 0.005;
      const z = hz + Math.sin(t * 1.6 + b * 11) * 0.03 + Math.sin(T * 9 + a * 50) * 0.003;
      speck(x, y, z, Math.sin(T * 26 + a * 90) > 0 ? 'v' : '^', C(BLACK, 0), 1, 0.12); // (wings flapping)
    }
  });
}

// ---- rain: splashes where drops land near you, rings in the puddles
function spawnRain(dt) {
  if (rain < 0.05 || mode === 'room') return;
  let n = rain * 70 * dt; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const c = Math.random() * cols | 0, r = hor + 1 + (Math.random() * (rows - hor - 1) | 0);
    if (r <= 0 || r >= rows) continue;
    const i = r * cols + c, t = ZB[i];
    if (!(t > 0.05 && t < 3.5) || !(ZB[i - cols] > t * 1.02)) continue; // (near, and facing up)
    const [x, y, z] = cellPoint(i);
    if (z > eye || partSheltered(x, y, z)) continue;
    const ring = FL[i] === 2;
    partAdd({ kind: ring ? 'ring' : 'splash', x, y, z, vx: 0, vy: 0, vz: 0, age: 0, life: ring ? 0.5 : 0.16 + Math.random() * 0.06, seed: Math.random() });
  }
}
// ---- drips off undersides once the rain has stopped and things are still wet
function spawnDrips(dt) {
  if (wet < 0.15 || rain > 0.05 || mode === 'room') return;
  let n = (wet - 0.1) * 9 * dt; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const c = Math.random() * cols | 0, r = Math.random() * Math.max(1, hor) | 0;
    if (r < 0 || r >= rows - 1) continue;
    const i = r * cols + c, t = ZB[i];
    if (!(t > 0.05 && t < 3) || !(ZB[i + cols] > t * 1.02)) continue; // (near, and facing down)
    const [x, y, z] = cellPoint(i);
    if (z < eye + 0.01) continue;
    partAdd({ kind: 'drip', x, y, z: z - 0.004, vx: 0, vy: 0, vz: 0, age: 0, life: 4, ground: Math.max(0, terrainHeight(x, y)), seed: Math.random() });
  }
}
// ---- autumn leaves off the broadleaf trees near you
let leafT = 0;
function spawnLeaves(dt) {
  if (season() !== 'autumn' || mode === 'room' || (leafT -= dt) > 0) return;
  leafT = 0.25;
  const breeze = 1 + rain * 1.5 + (storm || 0) * 2;
  forNear(treesB, tr => {
    if (tr.kind === 'pine') return;
    const vx = rel(tr.x - px), vy = rel(tr.y - py);
    if (vx * vx + vy * vy > 25 || Math.random() > 0.12 * breeze) return;
    const [hw, h] = TREE_SIZE[tr.kind] || [0.25, 0.6], s = tr.s || 1, g = terrainHeight(tr.x, tr.y);
    partAdd({ kind: 'leaf', x: tr.x + (Math.random() - 0.5) * hw * s * 1.3, y: tr.y + (Math.random() - 0.5) * hw * s * 1.3, z: g + (0.3 + Math.random() * 0.25) * h * s,
      vx: 0, vy: 0, vz: -(0.035 + Math.random() * 0.02), age: 0, life: 30 + Math.random() * 20, ground: g, seed: Math.random(),
      base: [ORANGE, YEL, BRICK, RED, ORANGE][Math.random() * 5 | 0] });
  });
}
// ---- sparks off the night market's grill (when it's open) and lit campfires
let sparkPuffT = 0;
function spawnSparks(dt) {
  if (mode === 'room') return;
  const near = (x, y, r) => Math.hypot(rel(x - px), rel(y - py)) < r;
  const fling = (x, y, z, rate, spread) => {
    let n = rate * dt; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) partAdd({ kind: 'spark', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, z,
      vx: (Math.random() - 0.5) * 0.03, vy: (Math.random() - 0.5) * 0.03, vz: 0.07 + Math.random() * 0.07, age: 0, life: 0.5 + Math.random() * 0.7, seed: Math.random() });
  };
  const puff = (sparkPuffT -= dt) <= 0;
  if (puff) sparkPuffT = 0.8;
  if (nightMarketOpen(tod)) for (const o of STALLS) if (o.word === 'STREET FOOD' && near(o.x, o.y, 6)) {
    fling(o.x, o.y + 0.03, 0.11, 12, 0.12);
    if (puff) worldPuff(o.x, o.y + 0.03, 0.13, 0.02, 0.07, 'smoke', 2.5, 0.05); // (a bit of smoke off it)
  }
  for (const o of FIRES) if (fireLit(o) && near(o.x, o.y, 6)) fling(o.x, o.y, (o.z ?? terrainHeight(o.x, o.y)) + 0.06, 5, 0.05);
}

// ---- cold breath: you and the people near you, in winter and on cold nights (spring and autumn after dark).
// Faint puffs that go in a second or two (smoke.js draws the 'breath' kind thin and see-through).
let breathT = 1, breathPeopleT = 0;
const coldAir = () => { const s = season(); return s === 'winter' || (s !== 'summer' && night > 0.6); };
function stepBreath(dt) {
  if (!coldAir()) return;
  if (mode === 'walk' && (breathT -= dt) <= 0) { breathT = 2.8 + Math.random() * 1.2; hazeExhale(-0.6, 'breath'); }
  if ((breathPeopleT -= dt) > 0 || mode === 'room') return;
  breathPeopleT = 0.4;
  for (const p of people) {
    if (p.hidden || Math.random() > 0.12) continue;
    const vx = rel(p.x - px), vy = rel(p.y - py);
    if (vx * vx + vy * vy > 9 || !inView(vx, vy, 0.1)) continue;
    const to = p.path?.[0], ang = to ? Math.atan2(to[1] - p.y, to[0] - p.x) : hash(Math.floor(p.ph * 100), 1, 3321) * TAU; // (out in front of their face)
    worldPuff(p.x + Math.cos(ang) * 0.02, p.y + Math.sin(ang) * 0.02, terrainHeight(p.x, p.y) + 0.16, 0.006, 0.026, 'breath', 1.6, 0.012);
  }
}

function stepParticles(dt) {
  if (mode === 'room') { PARTS.length = 0; return; }
  spawnLeaves(dt); spawnSparks(dt); stepBreath(dt);
  const fall = 0.98; // (gravity, in cells a second squared: a cell is 10 m)
  for (let k = PARTS.length - 1; k >= 0; k--) {
    const p = PARTS[k];
    p.age += dt;
    if (p.kind === 'drip') {
      p.vz -= fall * dt; p.z += p.vz * dt;
      if (p.z <= p.ground) { p.kind = 'splash'; p.z = p.ground; p.age = 0; p.life = 0.14; p.vz = 0; }
    } else if (p.kind === 'leaf') {
      if (p.z > p.ground) { // tumbling down on the breeze
        const sway = Math.sin(p.age * 2.4 + p.seed * 20);
        p.x += (HAZE_WIND[0] * 1.5 + Math.cos(p.seed * 30) * 0.01 * sway) * dt; p.y += (HAZE_WIND[1] * 1.5 + Math.sin(p.seed * 30) * 0.01 * sway) * dt;
        p.z = Math.max(p.ground, p.z + p.vz * (0.7 + 0.3 * Math.abs(sway)) * dt);
      }
    } else if (p.kind === 'spark') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz *= 1 - Math.min(1, dt * 0.8);
    }
    if (p.age >= p.life) PARTS.splice(k, 1);
  }
}

// in the scene, after the reflections and before the fog (render.js): new splashes and drips from this frame's
// surfaces, then every speck
function drawParticles(dt) {
  if (mode === 'room') return;
  spawnRain(dt); spawnDrips(dt);
  drawMoths();
  const lit = Math.max(0.35, amb);
  for (const p of PARTS) {
    const f = p.age / p.life;
    if (p.kind === 'splash') speck(p.x, p.y, p.z + 0.004, f < 0.4 ? "'" : f < 0.75 ? '.' : ',', C(WHITE, (5 + day * 5) * (1 - f * 0.5)), 0.97);
    else if (p.kind === 'ring') speck(p.x, p.y, p.z + 0.002, f < 0.25 ? '.' : f < 0.6 ? 'o' : 'O', C(WET, Math.min(14, (8 + day * 4) * (1 - f * 0.6))), 0.97);
    else if (p.kind === 'drip') speck(p.x, p.y, p.z, "'", C(WHITE, 8 + day * 4));
    else if (p.kind === 'leaf') {
      const down = p.z <= p.ground, gone = Math.max(0, (p.age - (p.life - 4)) / 4); // (lying a while, then gone)
      if (gone > 0 && hash(Math.floor(p.seed * 1e4), Math.floor(p.age * 3), 3311) < gone) continue;
      speck(p.x, p.y, p.z + (down ? 0.003 : 0), down ? (p.seed > 0.5 ? ',' : '.') : '`,~\''[Math.floor(p.age * 5 + p.seed * 4) & 3], C(p.base, (4 + 8 * lit) * (down ? 0.75 : 1)), down ? 0.97 : 1);
    } else if (p.kind === 'spark') speck(p.x, p.y, p.z, f < 0.5 ? "'" : '.', C(f < 0.4 ? YEL : ORANGE, 14 - f * 6));
  }
}
