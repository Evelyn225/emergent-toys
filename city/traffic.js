// ---- traffic lights, at intersections where three or four streets meet (corners and the bridges just flow).
// 16s cycle: vertical green 0-6, yellow 6-7, all red 7-8, horizontal green 8-14, yellow, all red.
// Intersections are addressed by their base cell (x, y multiples of 8).
const CYCLE = 16, HALF = CYCLE / 2, GREEN_T = HALF - 2;
const signalled = (x, y) => degree(x >> 3, y >> 3) >= 3;
const phase = (x, y, t) => mod(t + hash(mod(x, N), mod(y, N), 9) * CYCLE, CYCLE);
const light = (x, y, vert, t) => {
  if (!signalled(x, y)) return 'G';
  const p = phase(x, y, t) - (vert ? 0 : HALF); return p >= 0 && p < GREEN_T ? 'G' : p >= GREEN_T && p < GREEN_T + 1 ? 'Y' : 'R';
};
// pedestrians walking parallel to an axis may start crossing during the first 3s of its green (cars wait for stragglers)
const walkSig = (x, y, vert, t) => { if (!signalled(x, y)) return true; const p = phase(x, y, t) - (vert ? 0 : HALF); return p >= 0 && p < 3; };
// signal poles on the right-hand corner facing each street that comes in: {x, y, vert, bx, by} (bx/by = base cell)
const lights = [];
for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) {
  if (degree(i, j) < 3) continue;
  const bx = i * 8, by = j * 8;
  if (vseg(i, j - 1)) lights.push({ x: bx + 2 - CURB, y: by - 0.25, vert: true, bx, by });
  if (vseg(i, j)) lights.push({ x: bx + CURB, y: by + 2.25, vert: true, bx, by });
  if (hseg(i - 1, j)) lights.push({ x: bx - 0.25, y: by + CURB, vert: false, bx, by });
  if (hseg(i, j)) lights.push({ x: bx + 2.25, y: by + 2 - CURB, vert: false, bx, by });
}
const lightsB = bucketed(lights);

// ---- cars. Lanes: right-hand traffic, lane = street base + 1 +/- 0.4. A car can sit `off` to the right of its lane
// (pulling over for a siren; emergency vehicles run a little left of theirs); ex/ey is where it really is.
// Choose straight/right/left for the next intersection among the streets that exist there (taxis with a fare and
// emergency vehicles steer toward c.dest). B = the intersection's base coordinate along our heading,
// `left` = distance to where we turn (or, going straight, where we leave it).
function plan(c) {
  const vert = c.hx === 0, along = vert ? c.y : c.x, dir = c.hx + c.hy, m = mod(along, 8);
  c.B = dir > 0 ? along - m + 8 : m >= 2 ? along - m : along - m - 8;
  const ix = (vert ? Math.floor(c.x / 8) : c.B / 8), iy = (vert ? c.B / 8 : Math.floor(c.y / 8)); // the intersection, in blocks
  let opts = [[c.hx, c.hy], [c.hy, -c.hx], [-c.hy, c.hx]].filter(o => exitOK(ix, iy, o[0], o[1])); // straight, right, left
  if (!opts.length) opts = [[c.hx, c.hy]]; // can't happen on a checked street network (see streetProblems)
  if (c.dest) { // score each choice from the intersection itself, not from where we are now
    const ex = rel(c.dest[0] - (vert ? c.x : c.B + 1)), ey = rel(c.dest[1] - (vert ? c.B + 1 : c.y));
    c.nh = opts.reduce((b, o) => o[0] * ex + o[1] * ey > b[0] * ex + b[1] * ey ? o : b);
  } else {
    const w = opts.map(o => o[0] === c.hx && o[1] === c.hy ? 3 : 1), r = Math.random() * w.reduce((s, v) => s + v);
    let k = 0, acc = w[0]; while (acc < r) acc += w[++k];
    c.nh = opts[k];
  }
  const straight = c.nh[0] === c.hx && c.nh[1] === c.hy;
  const P = straight ? (dir > 0 ? c.B + 2 : c.B)
          : vert ? c.B + 1 - 0.4 * c.nh[0] : c.B + 1 + 0.4 * c.nh[1]; // the new lane's coordinate
  c.left = mod((P - along) * dir, N);
}

const BODIES = [RED, BLUE, WHITE, TAXI, TAXI, GREEN, GRAY];
let carId = 0;
function addCar(props) {
  const c = { id: carId++, v: 0, brake: false, off: 0, cruise: 1 + Math.random() * 0.5, kind: 'car', ...props };
  if (c.body === TAXI && c.kind === 'car') c.kind = 'taxi';
  c.ex = c.x; c.ey = c.y; plan(c); cars.push(c);
  return c;
}
// a random lane position on an existing street segment
function randomLane() {
  for (;;) {
    const bx = Math.random() * NB | 0, by = Math.random() * NB | 0, vert = Math.random() < 0.5, dir = pick([-1, 1]);
    if (!(vert ? vseg(bx, by) : hseg(bx, by))) continue;
    const along = (vert ? by : bx) * 8 + 2.5 + Math.random() * 4.5, lane = (vert ? bx : by) * 8 + 1 + (vert ? 0.4 : -0.4) * dir;
    return { x: vert ? lane : along, y: vert ? along : lane, hx: vert ? 0 : dir, hy: vert ? dir : 0 };
  }
}
const cars = [];
while (cars.length < 420) {
  const p = randomLane();
  if (cars.some(o => Math.hypot(rel(o.x - p.x), rel(o.y - p.y)) < 1)) continue;
  addCar({ ...p, body: pick(BODIES) });
}

// distance ahead of car c to point (x,y) if it's inside c's path (half-width `band`), else Infinity
function ahead(c, x, y, band) {
  const rx = rel(x - c.ex), ry = rel(y - c.ey), al = rx * c.hx + ry * c.hy;
  return al > 0 && al < 2 && Math.abs(rx * c.hy - ry * c.hx) < band ? al : Infinity;
}

// spatial buckets of 2x2 cells, so each car only checks what's around it (ahead() never looks past 2 cells)
const GN = N / 2, carGrid = Array.from({ length: GN * GN }, () => []), pplGrid = Array.from({ length: GN * GN }, () => []);
const bucketOf = (x, y) => Math.floor(mod(y, N) / 2) * GN + Math.floor(mod(x, N) / 2);
function fillGrid(grid, items, xk, yk) { // empties only the buckets it filled last time
  const used = grid.used || (grid.used = []);
  for (const k of used) grid[k].length = 0;
  used.length = 0;
  for (const o of items) { const k = bucketOf(o[xk], o[yk]); if (!grid[k].length) used.push(k); grid[k].push(o); }
}
function nearby(grid, x, y, out) { // everything in the 3x3 buckets round (x, y)
  out.length = 0;
  const gx = Math.floor(mod(x, N) / 2), gy = Math.floor(mod(y, N) / 2);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of grid[((gy + j) & (GN - 1)) * GN + ((gx + i) & (GN - 1))]) out.push(o);
  return out;
}
const nearPeople = [];
// only the neighbourhood round you is simulated; everything further away waits, unseen, where it is
const SIM_R = 56, simulated = (x, y) => Math.abs(rel(x - px)) < SIM_R && Math.abs(rel(y - py)) < SIM_R;

// ---- emergency vehicles: now and then an ambulance, fire engine or police car tears through the neighbourhood
// round you, lights going, ignoring red lights. Cars ahead of it in its lane pull over; cross traffic waits.
const EV_BODY = { amb: WHITE, fire: RED, police: BLUE };
let evTimer = 45;
function spawnEmergency() {
  for (let tries = 0; tries < 200; tries++) {
    const p = randomLane(), d = Math.hypot(rel(p.x - px), rel(p.y - py));
    if (d < 16 || d > 30 || cars.some(o => Math.hypot(rel(o.x - p.x), rel(o.y - p.y)) < 1.2)) continue;
    const kind = pick(['amb', 'amb', 'fire', 'police']);
    // head for a street just past you, so it comes by
    const dest = [mod(px + rel(px - p.x) * 0.8, N), mod(py + rel(py - p.y) * 0.8, N)];
    return addCar({ ...p, kind, body: EV_BODY[kind], ev: true, cruise: 2.1, dest, born: T });
  }
  return null;
}
function stepEmergency(dt) {
  for (let k = cars.length - 1; k >= 0; k--) { // done: off they go, out of sight
    const c = cars[k];
    if (c.ev && T - c.born > 40 && Math.hypot(rel(c.x - px), rel(c.y - py)) > 30) cars.splice(k, 1);
  }
  if (!cars.some(c => c.ev) && (evTimer -= dt) < 0) { spawnEmergency(); evTimer = 60 + Math.random() * 90; }
}

// ponytail: pairwise deadlocks are broken by id; a 3+ car loop in one intersection could still lock (rare at this density)
function stepTraffic(dt, t, everywhere = false) {
  stepPeople(dt, t, everywhere);
  stepEmergency(dt);
  fillGrid(carGrid, cars, 'ex', 'ey'); fillGrid(pplGrid, people, 'x', 'y');
  // a car crossing our path sideways is long (0.45), one in line with us is narrow (0.2). Around an emergency vehicle
  // (which runs off-centre) the band is wider: it waits for the car in front to get properly out of the way, and
  // cars coming up behind it see it even though it isn't square in their lane
  const cross = (c, o) => Math.abs(c.hx * o.hy - c.hy * o.hx);
  // (and nobody but the emergency vehicle squeezes past a car that has pulled over)
  const band = (c, o) => c.ev || o.ev ? 0.3 : o.off > 0.1 ? 0.45 : 0.12;
  const carGap = (c, o) => ahead(c, o.ex, o.ey, band(c, o) + 0.25 * cross(c, o)) - (0.55 - 0.13 * cross(c, o));
  const evs = cars.filter(c => c.ev), live = c => !c.player && (everywhere || c.ev || simulated(c.x, c.y));
  for (const c of cars) {
    c.blk = null; let best = Infinity;
    if (!live(c)) continue;
    for (const o of nearby(carGrid, c.ex, c.ey, c.near || (c.near = []))) if (o !== c) { const g = carGap(c, o); if (g < best) { best = g; c.blk = o; } }
  }
  for (const c of cars) {
    if (!live(c)) continue; // driven by you, or too far away to matter
    let room_ = Infinity;
    // both stopped, each waiting on the other: lower id goes
    const stuck = o => o.blk === c && c.blk === o && c.v < 0.05 && o.v < 0.05 && c.id < o.id;
    for (const o of c.near) if (o !== c && !stuck(o)) room_ = Math.min(room_, carGap(c, o));
    if (mode === 'walk') room_ = Math.min(room_, ahead(c, px, py, 0.2) - 0.4);
    for (const m of nearby(pplGrid, c.ex, c.ey, nearPeople)) if (!m.hidden) room_ = Math.min(room_, ahead(c, m.x, m.y, 0.12) - 0.35);

    const vert = c.hx === 0, along = vert ? c.y : c.x, dir = c.hx + c.hy;
    const line = mod(((dir > 0 ? c.B : c.B + 2) - along) * dir, N);
    const nx = vert ? c.x - mod(c.x, 8) : c.B, ny = vert ? c.B : c.y - mod(c.y, 8); // the next intersection
    if (line < 3 && !c.ev) {
      const s = light(nx, ny, vert, t);
      // an emergency vehicle about to cross in front: hold back as if the light were red
      const siren = evs.some(e => e.nodeX === nx && e.nodeY === ny && (e.hx === 0) !== vert);
      if (s === 'R' || s === 'Y' && line > 0.5 || siren) room_ = Math.min(room_, line - 0.25);
    }
    if (c.ev) { c.nodeX = nx; c.nodeY = ny; }
    // don't turn into a lane if a car is sitting right where we'd land
    if (c.left < 0.6 && (c.nh[0] !== c.hx || c.nh[1] !== c.hy)) {
      const lx = c.x + c.hx * c.left + c.nh[0] * 0.3, ly = c.y + c.hy * c.left + c.nh[1] * 0.3;
      if (c.near.some(o => o !== c && Math.hypot(rel(o.ex - lx), rel(o.ey - ly)) < 0.45)) room_ = Math.min(room_, c.left - 0.05);
    }
    // left turn: yield to oncoming traffic that's moving and near
    if (c.left < 2 && c.nh[0] === -c.hy && c.nh[1] === c.hx &&
        cars.some(o => o.v > 0.1 && o.hx === -c.hx && o.hy === -c.hy && ahead(c, o.ex, o.ey, 1.2) < 2.5))
      room_ = Math.min(room_, c.left - 0.6);
    // a siren coming up behind in our lane: pull over to the right and stop until it's gone by
    const behind = e => { // e is in our lane, up to 5 cells back
      const rx = rel(c.x - e.x), ry = rel(c.y - e.y), al = rx * c.hx + ry * c.hy;
      return e.hx === c.hx && e.hy === c.hy && Math.abs(rx * c.hy - ry * c.hx) < 0.3 && al > 0 && al < 5;
    };
    const pull = !c.ev && c.left > 1 && line > 1 && ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3 && evs.some(behind); // not mid-junction
    const offTarget = c.ev ? -0.2 : pull ? 0.32 : 0;
    c.off += clamp(offTarget - c.off, -0.6 * dt, 0.6 * dt);
    if (pull || Math.abs(c.off - offTarget) > 0.02 && !c.ev) room_ = Math.min(room_, pull ? 0 : 0.2); // stopped, or easing back out
    // taxi business: pull up for a hail, wait for a destination, stop on arrival
    if (c.hail) { const d = Math.hypot(rel(px - c.x), rel(py - c.y)); if (d < 1) room_ = 0; if (d > 6) c.hail = false; }
    if (c.rider && !c.dest) room_ = 0;
    if (c.dest && Math.hypot(rel(c.dest[0] - c.x), rel(c.dest[1] - c.y)) < 1.2) {
      if (c.ev) c.dest = null; else { room_ = 0; c.arrived = true; }
    }

    const target = Math.min(Math.max(0, room_ * 2.5), c.cruise);
    c.brake = target < c.v;
    c.v = Math.min(target, c.v + (c.ev ? 1.4 : 0.8) * dt);
    const d = c.v * dt, step = Math.min(d, c.left);
    if (vert) c.y = mod(c.y + dir * step, N); else c.x = mod(c.x + dir * step, N);
    c.left -= step;
    if (c.rider) c.fare += step;
    if (c.left <= 0) { [c.hx, c.hy] = c.nh; plan(c); }
    c.ex = mod(c.x + c.hy * c.off, N); c.ey = mod(c.y - c.hx * c.off, N);
  }
}

// run selfTest() in the console: 3 simulated minutes of the whole city, reports collisions / stuck cars
function selfTest(steps = 9000) {
  let crashes = 0, turns = 0, worst = 0;
  const still = new Map();
  for (let k = 0; k < steps; k++) {
    const before = cars.map(c => c.hx + ',' + c.hy);
    stepTraffic(0.02, T += 0.02, true);
    cars.forEach((c, i) => {
      if (before[i] !== c.hx + ',' + c.hy) turns++;
      const s = c.v < 0.01 ? (still.get(c) || 0) + 0.02 : 0; still.set(c, s); worst = Math.max(worst, s);
    });
    fillGrid(carGrid, cars, 'ex', 'ey');
    for (const c of cars) for (const o of nearby(carGrid, c.ex, c.ey, nearPeople))
      if (o.id > c.id && Math.hypot(rel(c.ex - o.ex), rel(c.ey - o.ey)) < 0.3) crashes++;
  }
  console.log(`selftest: crash-frames=${crashes} turns=${turns} longest stop=${worst.toFixed(1)}s`);
  return { crashes, turns, worst };
}
