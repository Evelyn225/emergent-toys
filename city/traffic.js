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
// snap a car onto the nearest lane in the direction it points and hand it back to the AI
function toLane(c) {
  const vert = Math.abs(c.hy) > Math.abs(c.hx), dir = Math.sign(vert ? c.hy : c.hx) || 1;
  if (vert) { c.x = mod(Math.round((c.x - 1) / 8) * 8 + 1 + 0.4 * dir, N); c.hx = 0; c.hy = dir; }
  else { c.y = mod(Math.round((c.y - 1) / 8) * 8 + 1 - 0.4 * dir, N); c.hx = dir; c.hy = 0; }
  c.ex = c.x; c.ey = c.y; plan(c);
}
// a random lane position on an existing street segment: anywhere, or (near) in the blocks within `near` cells of (x, y)
function randomLane(near = 0, x = 0, y = 0) {
  for (;;) {
    const bx = near ? Math.floor((x + (Math.random() * 2 - 1) * near) / 8) & (NB - 1) : Math.random() * NB | 0;
    const by = near ? Math.floor((y + (Math.random() * 2 - 1) * near) / 8) & (NB - 1) : Math.random() * NB | 0;
    const vert = Math.random() < 0.5, dir = pick([-1, 1]);
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

// ---- emergency vehicles: now and then an ambulance, fire engine or police car is called out to somewhere in the
// neighbourhood round you. It leaves from the nearest station or hospital of its kind (or, if there's none near,
// comes in from a few blocks off), lights and siren going, ignoring red lights; cars ahead of it pull over and cross
// traffic waits. At the scene it pulls in to the kerb, lights still turning, for a while; then it drives back to
// base like any other car and parks out front again.
// state: 'out' (on a call) -> 'scene' -> 'back'. ev marks the vehicle; code(c) = running lights and siren.
const EV_BODY = { amb: WHITE, fire: RED, police: BLUE };
const RETURN_CODE = false; // real crews drive back quietly; true runs lights and siren home too
const code = c => c.state === 'out' || RETURN_CODE && c.state === 'back' || c.pursuit; // (a patrol car chasing you, too)
const lightsOn_ = c => code(c) || c.state === 'scene'; // the light bar turning
const BASE_R = 50; // a station further away than this (500m) doesn't send the call; one comes in from off-screen
let evTimer = 45;
const nearestBase = (kind, free) => SERVICES.filter(b => b.kind === kind && (!free || !b.out))
  .reduce((best, b) => { const d = Math.hypot(rel(b.x - px), rel(b.y - py)); return d < best[1] ? [b, d] : best; }, [null, Infinity]);
function spawnEmergency(kind = pick(['amb', 'amb', 'fire', 'police'])) {
  let scene = null; // somewhere on a street a few blocks from you, so you'll see it go by or pull up
  for (let tries = 0; tries < 200 && !scene; tries++) {
    const p = randomLane(12, px, py), d = Math.hypot(rel(p.x - px), rel(p.y - py));
    if (d > 3 && d < 10) scene = [p.x, p.y];
  }
  if (!scene) return null;
  const [base, bd] = nearestBase(kind, true), props = { kind, body: EV_BODY[kind], ev: true, state: 'out', cruise: 2.1, dest: scene, born: T };
  if (base && bd < BASE_R) { // out of the station, westbound from the kerb
    base.out = true;
    return addCar({ ...props, x: base.x, y: base.lane, hx: -1, hy: 0, base });
  }
  for (let tries = 0; tries < 200; tries++) { // no station near: it comes in from a few blocks away
    const p = randomLane(32, px, py), d = Math.hypot(rel(p.x - px), rel(p.y - py));
    if (d < 16 || d > 30 || cars.some(o => Math.hypot(rel(o.x - p.x), rel(o.y - p.y)) < 1.2)) continue;
    return addCar({ ...props, ...p, base: nearestBase(kind, false)[0] });
  }
  return null;
}
// the call's progress: at the scene, waiting there, heading home, home
function evArrive(c) {
  if (c.state === 'out') { c.state = 'scene'; c.until = T + 20 + Math.random() * 25; c.dest = null; return; }
  if (c.state === 'back') c.home = true; // (taken off the road in stepEmergency, not mid-loop)
}
function endCall(c) { // parked at its station again (or just gone, if it came from off-screen)
  const k = cars.indexOf(c);
  if (k >= 0) cars.splice(k, 1);
  if (c.base) c.base.out = false;
}
function stepEmergency(dt) {
  for (const c of cars.slice()) {
    if (!c.ev) continue;
    if (c.home) { endCall(c); continue; }
    const far = Math.hypot(rel(c.x - px), rel(c.y - py));
    if (c.state === 'scene' && T > c.until) { c.state = 'back'; c.cruise = 1.3; c.dest = c.base ? [c.base.x, c.base.lane] : null; c.born = T; }
    // out of the neighbourhood that's simulated, it can't get anywhere (the traffic there is frozen): it's home
    if (far > SIM_R * 0.8 && (c.state === 'back' || T - c.born > 90)) endCall(c);
    else if (c.state === 'back' && !c.base && far > 30) endCall(c);
  }
  if (!cars.some(c => c.ev && c.state === 'out') && cars.filter(c => c.ev).length < 3 && (evTimer -= dt) < 0) {
    spawnEmergency(); evTimer = 60 + Math.random() * 90;
  }
}

// ponytail: pairwise deadlocks are broken by id; a 3+ car loop in one intersection could still lock (rare at this density)
function stepTraffic(dt, t, everywhere = false) {
  stepPeople(dt, t, everywhere);
  for (const c of cars) if (c.parked && !c.owned && Math.hypot(rel(c.x - px), rel(c.y - py)) > 45) { c.parked = c.mine = false; c.v = 0; toLane(c); } // left behind: back into the traffic
  stepEmergency(dt);
  fillGrid(carGrid, cars, 'ex', 'ey'); fillGrid(pplGrid, people, 'x', 'y');
  // a car crossing our path sideways is long (0.45), one in line with us is narrow (0.2). Around an emergency vehicle
  // (which runs off-centre) the band is wider: it waits for the car in front to get properly out of the way, and
  // cars coming up behind it see it even though it isn't square in their lane
  const cross = (c, o) => Math.abs(c.hx * o.hy - c.hy * o.hx);
  const band = (c, o) => code(c) || code(o) ? 0.3 : 0.12;
  const carGap = (c, o) => ahead(c, o.ex, o.ey, band(c, o) + 0.25 * cross(c, o)) - (0.55 - 0.13 * cross(c, o));
  const evs = cars.filter(code), live = c => !c.player && !c.parked && (everywhere || c.ev || c.pursuit || simulated(c.x, c.y));
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
    if (line < 3 && !code(c) && !c.rush) {
      const s = light(nx, ny, vert, t);
      // an emergency vehicle about to cross in front: hold back as if the light were red
      const siren = evs.some(e => e.nodeX === nx && e.nodeY === ny && (e.hx === 0) !== vert);
      if (s === 'R' || s === 'Y' && line > 0.5 || siren) room_ = Math.min(room_, line - 0.25);
    }
    if (code(c)) { c.nodeX = nx; c.nodeY = ny; }
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
    // pull in only where the kerb is free: not mid-junction, and not on top of a car that's already pulled in there
    const kerbTaken = c.off < 0.1 && c.near.some(o => o !== c && o.off > 0.1 && o.hx === c.hx && o.hy === c.hy &&
      Math.abs(rel(o.x - c.x) * c.hx + rel(o.y - c.y) * c.hy) < 0.55 && Math.abs(rel(o.x - c.x) * c.hy - rel(o.y - c.y) * c.hx) < 0.3);
    const pull = !code(c) && c.state !== 'scene' && c.left > 1 && line > 1 && ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3 && !kerbTaken && evs.some(behind);
    const offTarget = code(c) ? -0.2 : pull || c.state === 'scene' ? 0.32 : 0; // at the scene: pulled in to the kerb
    c.off += clamp(offTarget - c.off, -0.6 * dt, 0.6 * dt);
    if (pull || Math.abs(c.off - offTarget) > 0.02 && !code(c)) room_ = Math.min(room_, pull ? 0 : 0.2); // stopped, or easing back out
    if (c.state === 'scene') room_ = 0;
    // taxi business: pull up for a hail, wait for a destination, stop on arrival
    if (c.hail) { const d = Math.hypot(rel(px - c.x), rel(py - c.y)); if (d < 1) room_ = 0; if (d > 6) c.hail = false; }
    if (c.rider && !c.dest || c.stopT > T) room_ = 0; // (a cab whose driver's been arrested sits there a while)
    if (c.pursuit && mode === 'walk' && Math.hypot(rel(px - c.x), rel(py - c.y)) < 1.2) room_ = 0; // pulled up next to you
    if (c.dest && !c.pursuit && Math.hypot(rel(c.dest[0] - c.x), rel(c.dest[1] - c.y)) < (c.ev ? 1 : 1.2)) { // (1: the far lane of the street counts)
      if (c.ev) { if (ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3) evArrive(c); } // not in the middle of a junction
      else { room_ = 0; c.arrived = true; }
    }

    const target = Math.min(Math.max(0, room_ * 2.5), c.cruise * (c.rush ? 1.8 : 1));
    c.brake = target < c.v;
    c.v = Math.min(target, c.v + (code(c) || c.rush ? 1.4 : 0.8) * dt);
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
