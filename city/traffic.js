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
// World units are 10m: 72km/h, 4.5m/s² acceleration and 9m/s² braking.
const COP_CAR_SPEED = 2, COP_CAR_ACCEL = 0.45, COP_CAR_BRAKE = 0.9;
const CAR_FOOTPRINTS = { car: [0.24, 0.11], amb: [0.25, 0.1], fire: [0.37, 0.1] };
function carFootprint(c) {
  return CAR_FOOTPRINTS[c.kind] || CAR_FOOTPRINTS.car;
}
// Minimum separating translation between two rotated bodies, with toroidal world coordinates.
function carContact(c, o, x = c.ex, y = c.ey, hx = c.hx, hy = c.hy) {
  const rx = rel(o.ex - x), ry = rel(o.ey - y);
  if (Math.abs(rx) > 0.95 || Math.abs(ry) > 0.95) return null;
  const [hl, hw] = carFootprint(c), [ol, ow] = carFootprint(o);
  if (rx * rx + ry * ry > (hl + hw + ol + ow) ** 2) return null;
  let depth = Infinity, nx = 0, ny = 0;
  for (const [ax, ay] of [[hx, hy], [-hy, hx], [o.hx, o.hy], [-o.hy, o.hx]]) {
    const span = hl * Math.abs(ax * hx + ay * hy) + hw * Math.abs(-ax * hy + ay * hx)
      + ol * Math.abs(ax * o.hx + ay * o.hy) + ow * Math.abs(-ax * o.hy + ay * o.hx);
    const along = rx * ax + ry * ay, overlap = span - Math.abs(along);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; const sign = along < 0 ? -1 : 1; nx = ax * sign; ny = ay * sign; }
  }
  return { depth, nx, ny };
}
function resolveCruiserContact(c, o, hit) {
  const { nx, ny } = hit, depth = hit.depth + 0.0001;
  const movingPlayer = o === me && mode === 'drive', share = movingPlayer ? depth / 2 : 0;
  const ox = mod(o.x + nx * share, N), oy = mod(o.y + ny * share, N);
  const canPush = share && carBodyClear(ox, oy, o.hx, o.hy, ...carFootprint(o)) && !isWater(ox, oy);
  const back = canPush ? depth - share : depth, cx = mod(c.x - nx * back, N), cy = mod(c.y - ny * back, N);
  if (!carBodyClear(cx, cy, c.hx, c.hy, ...carFootprint(c)) || isWater(cx, cy)) return false;
  c.x = cx; c.y = cy;
  if (canPush) { o.x = ox; o.y = oy; o.ex = ox; o.ey = oy; px = ox; py = oy; }
  const ca = c.travelA ?? Math.atan2(c.hy, c.hx), oa = o.travelA ?? Math.atan2(o.hy, o.hx);
  const closing = (Math.cos(ca) * c.v - Math.cos(oa) * o.v) * nx + (Math.sin(ca) * c.v - Math.sin(oa) * o.v) * ny;
  if (closing > 0) {
    // Impact requires actual body contact; following someone's bumper alone cannot spin them out.
    const rear = rel(c.x - o.x) * o.hx + rel(c.y - o.y) * o.hy;
    if (c.pursuit && movingPlayer && closing > 0.35 && Math.abs(o.v) > 0.7 && rear < -0.06 && Math.abs(nx * o.hy - ny * o.hx) > 0.5) {
      o.spunT = T + 2.5; wanted.pitPending = true;
    }
    c.v *= 0.15;
    if (movingPlayer) o.v *= 0.65;
  }
  c.ex = c.x; c.ey = c.y; c.routeT = 0;
  return true;
}
// The full rotated footprint, including the rear bumper. Separating axes keep even a sideways drift out of walls.
function carBodyClear(x, y, hx, hy, hl = 0.24, hw = 0.11) {
  const ex = Math.abs(hx) * hl + Math.abs(hy) * hw, ey = Math.abs(hy) * hl + Math.abs(hx) * hw;
  const diagonal = 0.5 * (Math.abs(hx) + Math.abs(hy));
  for (let my = Math.floor(y - ey); my <= Math.floor(y + ey); my++) for (let mx = Math.floor(x - ex); mx <= Math.floor(x + ex); mx++) {
    if (!map[idx(mx, my)]) continue;
    const qx = mx + 0.5 - x, qy = my + 0.5 - y;
    if (Math.abs(qx) < ex + 0.5 && Math.abs(qy) < ey + 0.5 && Math.abs(qx * hx + qy * hy) < hl + diagonal && Math.abs(-qx * hy + qy * hx) < hw + diagonal) return false;
  }
  return architectureCarClear(x, y, hx, hy, hl, hw) && landmarkCarClear(x, y, hx, hy, hl, hw);
}
// A short local route around buildings for a cruiser in close pursuit. The wider street network still handles
// dispatch from far away; nearby cruisers can leave their lane, reverse and intercept rather than circling a block.
function pursuitRoute(c, tx, ty) {
  const first = idx(Math.floor(c.x), Math.floor(c.y)), last = idx(Math.floor(tx), Math.floor(ty)), prev = new Map([[first, first]]), queue = [first];
  const blocked = new Set(cars.filter(o => o !== c && o !== me && o.parked && near(c.x, c.y, o.ex, o.ey) < 24).map(o => idx(Math.floor(o.ex), Math.floor(o.ey))));
  if (me && me !== c && me.parked) blocked.add(idx(Math.floor(me.ex), Math.floor(me.ey)));
  let best = first, bestDist = Infinity;
  for (let k = 0; k < queue.length && k < 1800; k++) {
    const cell = queue[k], x = cell % N, y = Math.floor(cell / N), dist = Math.hypot(rel(x + 0.5 - tx), rel(y + 0.5 - ty));
    if (dist < bestDist) { bestDist = dist; best = cell; }
    if (cell === last) break;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = idx(x + ox, y + oy), nx = next % N + 0.5, ny = Math.floor(next / N) + 0.5;
      if (prev.has(next) || map[next] || blocked.has(next) || Math.hypot(rel(nx - c.x), rel(ny - c.y)) > 24 || isWater(nx, ny)) continue;
      prev.set(next, cell); queue.push(next);
    }
  }
  const path = [];
  for (let cell = best; cell !== first; cell = prev.get(cell)) path.push([cell % N + 0.5, Math.floor(cell / N) + 0.5]);
  if (best === last && !map[last]) path.unshift([tx, ty]);
  return path.reverse();
}
function steerCruiser(c, tx, ty, speed, dt, arrive = true) {
  const vx = rel(tx - c.x), vy = rel(ty - c.y), distance = Math.hypot(vx, vy), oldAngle = Math.atan2(c.hy, c.hx);
  const traction = roadTraction(c.x, c.y), braking = COP_CAR_BRAKE * (0.55 + traction * 0.45);
  if (distance < 0.025 && arrive) { c.v = 0; c.brake = true; return; }
  const wantedAngle = Math.atan2(vy, vx), turn = mod(wantedAngle - oldAngle + Math.PI, TAU) - Math.PI;
  // Brake before reversing direction or arriving. Slow turns align the tyres instead of orbiting the goal.
  const turnRate = c.v < 0.3 ? 3.2 : 1.8;
  const angle = oldAngle + clamp(turn, -turnRate * dt, turnRate * dt);
  let targetSpeed = Math.min(speed, COP_CAR_SPEED);
  if (arrive) targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * braking * Math.max(0, distance - 0.02)));
  targetSpeed *= Math.max(0, Math.cos(turn));
  c.brake = targetSpeed < c.v;
  c.v += clamp(targetSpeed - c.v, -braking * dt, COP_CAR_ACCEL * (0.75 + traction * 0.25) * dt);
  c.travelA ??= oldAngle;
  const slip = mod(angle - c.travelA + Math.PI, TAU) - Math.PI;
  c.travelA += slip * (1 - Math.exp(-dt * 12 * traction));
  if (c.v < 0.3) c.travelA = angle;
  const step = Math.min(distance, c.v * dt), samples = Math.max(1, Math.ceil(step / 0.035), Math.ceil(Math.abs(angle - oldAngle) / 0.06));
  const sx = Math.cos(c.travelA) * step / samples, sy = Math.sin(c.travelA) * step / samples;
  for (let k = 1; k <= samples; k++) {
    const ha = oldAngle + (angle - oldAngle) * k / samples, nhx = Math.cos(ha), nhy = Math.sin(ha), nx = mod(c.x + sx, N), ny = mod(c.y + sy, N);
    if (!carBodyClear(nx, ny, nhx, nhy, ...carFootprint(c)) || isWater(nx, ny)) { c.v = 0; c.travelA = oldAngle; c.routeT = 0; break; }
    const other = (c.near || cars).find(o => o !== c && carContact(c, o, nx, ny, nhx, nhy));
    if (other) {
      const hit = carContact(c, other, nx, ny, nhx, nhy);
      const before = [c.x, c.y, c.hx, c.hy];
      c.x = nx; c.y = ny; c.hx = nhx; c.hy = nhy;
      if (!resolveCruiserContact(c, other, hit)) { [c.x, c.y, c.hx, c.hy] = before; c.v = 0; c.routeT = 0; }
      break;
    }
    c.x = nx; c.y = ny; c.hx = nhx; c.hy = nhy;
  }
  c.off = 0; c.ex = c.x; c.ey = c.y;
}
function cruiserLineClear(c, tx, ty) {
  if (!lineOfSight(c.x, c.y, tx, ty)) return false;
  const vx = rel(tx - c.x), vy = rel(ty - c.y), distance = Math.hypot(vx, vy);
  if (distance < 0.02) return true;
  const hx = vx / distance, hy = vy / distance, steps = Math.ceil(distance / 0.15);
  const parked = cars.filter(o => o !== c && o.parked && near(c.x, c.y, o.ex, o.ey) < distance + 0.6);
  for (let k = 0; k <= steps; k++) {
    const x = c.x + vx * k / steps, y = c.y + vy * k / steps;
    if (!carBodyClear(x, y, hx, hy) || isWater(x, y)) return false;
    if (parked.some(o => carContact(c, o, x, y, hx, hy))) return false;
  }
  return true;
}
function stepPursuitCar(c, dt) {
  c.pursuitDrive = true;
  let [tx, ty] = c.dest, distance = Math.hypot(rel(tx - c.x), rel(ty - c.y));
  const driving = mode === 'drive' && me;
  if (wanted.seen && driving) { const lead = Math.min(0.6, distance / 6), heading = me.travelA ?? Math.atan2(me.hy, me.hx); tx += Math.cos(heading) * me.v * lead; ty += Math.sin(heading) * me.v * lead; }
  const direct = cruiserLineClear(c, tx, ty);
  if (!direct && (c.routeT = (c.routeT || 0) - dt) <= 0) { c.routeT = 0.6; c.route = pursuitRoute(c, tx, ty); }
  let goal = direct ? [tx, ty] : c.route?.[0];
  if (!goal) { c.v = 0; return; }
  if (!direct && c.route.length > 1 && Math.hypot(rel(goal[0] - c.x), rel(goal[1] - c.y)) < 0.18) { c.route.shift(); goal = c.route[0]; }
  const stopForOfficer = mode !== 'drive' && distance < 1.05;
  const stoppedDriver = driving && wanted.seen && Math.abs(me.v) < 0.1 && near(c.x, c.y, me.x, me.y) < 0.52;
  steerCruiser(c, goal[0], goal[1], stopForOfficer || stoppedDriver ? 0 : COP_CAR_SPEED, dt, direct || c.route.length <= 1);
}
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
  c.ex = c.x; c.ey = c.y; c.laneYaw = null; c.offV = 0; c.pass = null; plan(c);
}

// Routing keeps cardinal headings; the body and passenger camera follow the actual steering.
function carYaw(c) {
  return c.kind === 'taxi' && !c.player && !c.parked && c.laneYaw != null ? c.laneYaw : Math.atan2(c.hy, c.hx);
}
function taxiLaneTarget(c, line) {
  const along = o => rel(o.ex - c.x) * c.hx + rel(o.ey - c.y) * c.hy;
  if (c.pass && (c.pass.hx !== c.hx || c.pass.hy !== c.hy || !cars.includes(c.pass.car) || along(c.pass.car) < -3.2)) c.pass = null;
  if (!c.pass && c.left > 2 && ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3) {
    let obstacle = null, distance = 3.2;
    for (const o of c.near) {
      if (o === c || !(o.parked || c.rush && o.hx === c.hx && o.hy === c.hy && o.v < c.cruise * 1.6)) continue;
      const al = along(o), across = Math.abs(rel(o.ex - c.x) * c.hy - rel(o.ey - c.y) * c.hx);
      const mergeRoom = o.parked ? 0.6 : 3.2;
      if (across < 0.24 && al > 0.5 && al < distance && line > al + mergeRoom && c.left > al + mergeRoom) { obstacle = o; distance = al; }
    }
    if (obstacle) {
      const offset = c.rush && !obstacle.parked ? -0.8 : -0.38;
      const ox = c.x + c.hy * offset, oy = c.y - c.hx * offset;
      const occupied = cars.some(o => {
        if (o === c || o === obstacle) return false;
        const rx = rel(o.ex - ox), ry = rel(o.ey - oy), al = rx * c.hx + ry * c.hy;
        const closing = c.cruise * (c.rush ? 1.8 : 1) - (o.hx * c.hx + o.hy * c.hy) * o.v;
        return Math.abs(rx * c.hy - ry * c.hx) < 0.3 && al > -1 && al < Math.max(6, closing * 4);
      });
      if (!occupied) c.pass = { car: obstacle, offset, hx: c.hx, hy: c.hy };
    }
  }
  if (!c.pass) return 0;
  // Ease out over 22m, hold beside the obstacle, and merge only after the rear bumper clears it.
  const al = along(c.pass.car);
  let u = 1;
  if (al > 1) u = (3.2 - al) / 2.2;
  else if (al < -1) u = (al + 3.2) / 2.2;
  u = clamp(u, 0, 1);
  return c.pass.offset * u * u * (3 - 2 * u);
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
const code = c => !c.returning && c.state !== 'back' && (c.state === 'out' || !!c.pursuit);
const lightsOn_ = c => !c.returning && c.state !== 'back' && (code(c) || c.state === 'scene');
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
    if (!c.ev || c.pursuit || c.returning || c.waitingCrew) continue; // crime.js owns the crew and return trip during a pursuit
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

// on foot, a car left at the kerb (yours, or one somebody abandoned) and the emergency vehicles waiting outside their
// stations are solid: walk round them. (Traffic that's moving, or only stopped at the lights, you dodge yourself)
function parkedCarAt(x, y, pad) {
  const inCar = (cx, cy, hx, hy, kind) => {
    const [hl, hw] = VEHICLES[kind] || VEHICLES.car, qx = rel(x - cx), qy = rel(y - cy);
    return Math.abs(qx * hx + qy * hy) < hl + pad && Math.abs(-qx * hy + qy * hx) < hw + pad;
  };
  for (const c of cars) if (c.parked && !c.player && Math.abs(rel(c.ex - x)) < 0.6 && Math.abs(rel(c.ey - y)) < 0.6 && inCar(c.ex, c.ey, c.hx, c.hy, c.kind)) return true;
  for (const b of SERVICES) if (!b.out && Math.abs(rel(b.x - x)) < 0.6 && Math.abs(rel(b.y - y)) < 0.6 && inCar(b.x, b.y, -1, 0, b.kind)) return true;
  return false;
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
  const band = (c, o) => code(c) || code(o) ? 0.3 : c.kind === 'taxi' && (c.pass || c.off < -0.01) ? 0.26 : 0.12;
  const carGap = (c, o) => ahead(c, o.ex, o.ey, band(c, o) + 0.25 * cross(c, o)) - (0.55 - 0.13 * cross(c, o));
  const evs = cars.filter(code), live = c => !c.player && !c.parked && (everywhere || c.ev || c.pursuit || simulated(c.x, c.y));
  for (const c of cars) {
    c.blk = null; let best = Infinity;
    if (!live(c)) continue;
    for (const o of nearby(carGrid, c.ex, c.ey, c.near || (c.near = []))) if (o !== c) { const g = carGap(c, o); if (g < best) { best = g; c.blk = o; } }
  }
  for (const c of cars) {
    if (!live(c)) continue; // driven by you, or too far away to matter
    if (c.waitingCrew) { c.v = 0; c.brake = true; c.ex = c.x; c.ey = c.y; continue; }
    if (c.pursuit && c.dest && (c.pursuitDrive || Math.hypot(rel(c.dest[0] - c.x), rel(c.dest[1] - c.y)) < 18)) { stepPursuitCar(c, dt); continue; }
    if (c.merging) {
      const l = c.merging;
      const canMerge = near(l.x, l.y, c.x, c.y) < 0.08 && carBodyClear(l.x, l.y, l.hx, l.hy)
        && !c.near.some(o => o !== c && carContact(c, o, l.x, l.y, l.hx, l.hy));
      if (!canMerge) {
        let goal = [l.x, l.y];
        const direct = cruiserLineClear(c, l.x, l.y);
        if (!direct) {
          if ((c.routeT = (c.routeT || 0) - dt) <= 0) { c.routeT = 0.6; c.route = pursuitRoute(c, l.x, l.y); }
          goal = c.route?.[0];
          if (goal && c.route.length > 1 && Math.hypot(rel(goal[0] - c.x), rel(goal[1] - c.y)) < 0.18) { c.route.shift(); goal = c.route[0]; }
        }
        if (goal) steerCruiser(c, goal[0], goal[1], 1.2, dt, direct || c.route.length <= 1); else c.v = 0;
        continue;
      }
      c.x = l.x; c.y = l.y; c.ex = c.x; c.ey = c.y; c.hx = l.hx; c.hy = l.hy; c.merging = null; c.travelA = null; plan(c);
    }
    let room_ = Infinity;
    // both stopped, each waiting on the other: lower id goes
    const stuck = o => o.blk === c && c.blk === o && c.v < 0.05 && o.v < 0.05 && c.id < o.id;
    for (const o of c.near) if (o !== c && !stuck(o)) room_ = Math.min(room_, carGap(c, o));
    if (mode === 'walk') room_ = Math.min(room_, ahead(c, px, py, 0.2) - 0.4);
    for (const m of nearby(pplGrid, c.ex, c.ey, nearPeople)) if (!m.hidden) room_ = Math.min(room_, ahead(c, m.x, m.y, 0.12) - 0.35);
    if (c.pursuit) room_ = Infinity; // dispatch and pursuit do not queue behind ordinary traffic or pedestrians

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
    if (!c.pursuit && c.left < 0.6 && (c.nh[0] !== c.hx || c.nh[1] !== c.hy)) {
      const lx = c.x + c.hx * c.left + c.nh[0] * 0.3, ly = c.y + c.hy * c.left + c.nh[1] * 0.3;
      if (c.near.some(o => o !== c && Math.hypot(rel(o.ex - lx), rel(o.ey - ly)) < 0.45)) room_ = Math.min(room_, c.left - 0.05);
    }
    // left turn: yield to oncoming traffic that's moving and near
    if (!c.pursuit && c.left < 2 && c.nh[0] === -c.hy && c.nh[1] === c.hx &&
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
    const taxi = c.kind === 'taxi';
    // a parked car sitting in our lane (you leave yours wherever you get out): swing out round it, then back in
    const passing = !taxi && !code(c) && c.near.some(o => {
      if (o === c || !o.parked) return false;
      const rx = rel(o.ex - c.x), ry = rel(o.ey - c.y), al = rx * c.hx + ry * c.hy;
      return Math.abs(rx * c.hy - ry * c.hx) < 0.24 && al > -0.6 && al < 1.6;
    });
    // a cab you've paid to step on it: out into the oncoming lane round anything slower in front, if nothing's coming
    // and there's no junction to get through first; back in once past
    let overtake = false;
    if (!taxi && c.rush && !code(c) && c.left > 1 && line > 1.2 && ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3) {
      const slow = c.near.some(o => {
        if (o === c || o.hx !== c.hx || o.hy !== c.hy || o.off < -0.3) return false;
        const rx = rel(o.ex - c.x), ry = rel(o.ey - c.y), al = rx * c.hx + ry * c.hy;
        return Math.abs(rx * c.hy - ry * c.hx) < 0.3 && al > -0.7 && al < 1.8 && o.v < c.cruise * 1.6;
      });
      const ox = c.x - c.hy * 0.8, oy = c.y + c.hx * 0.8; // the middle of the oncoming lane, beside us
      const look = c.off < -0.4 ? 1.6 : 5; // pulling out: the whole block clear. Already out: only a car right on us aborts it
      const coming = slow && cars.some(o => {
        if (o === c || o.hx === c.hx && o.hy === c.hy && o.off > -0.3) return false;
        const rx = rel(o.ex - ox), ry = rel(o.ey - oy), al = rx * c.hx + ry * c.hy;
        return Math.abs(rx * c.hy - ry * c.hx) < 0.45 && al > -0.6 && al < look;
      });
      overtake = slow && !coming;
    }
    if (taxi && pull) c.pass = null;
    let offTarget = 0;
    if (code(c)) offTarget = -0.2;
    else if (pull || c.state === 'scene') offTarget = 0.32; // at the scene: pulled in to the kerb
    else if (taxi) offTarget = taxiLaneTarget(c, line);
    else if (overtake) offTarget = -0.8;
    else if (passing) offTarget = -0.34;
    const oldX = c.ex, oldY = c.ey;
    const sway = c.rush ? 1.6 : 0.6; // (a rushing cab swings out and back smartly)
    if (taxi) {
      const lateralSpeed = Math.min(0.4, c.v * 0.3 + 0.08), error = offTarget - c.off;
      const desired = clamp(error * 3, -lateralSpeed, lateralSpeed);
      c.offV = (c.offV || 0) + clamp(desired - (c.offV || 0), -0.6 * dt, 0.6 * dt);
      const shift = c.offV * dt;
      if (shift * error >= 0 && Math.abs(shift) >= Math.abs(error)) { c.off = offTarget; c.offV = 0; }
      else c.off += shift;
    } else c.off += clamp(offTarget - c.off, -sway * dt, sway * dt);
    if (pull || !taxi && Math.abs(c.off - offTarget) > 0.02 && !code(c) && !c.rush) room_ = Math.min(room_, pull ? 0 : 0.2); // stopped, or easing back out
    if (c.state === 'scene' || c.waitingCrew) room_ = 0;
    // taxi business: pull up for a hail, wait for a destination, stop on arrival
    if (c.hail) { const d = Math.hypot(rel(px - c.x), rel(py - c.y)); if (d < 1) room_ = 0; if (d > 6) c.hail = false; }
    if (c.rider && !c.dest || c.stopT > T) room_ = 0; // (a cab whose driver's been arrested sits there a while)
    // pulled up next to you to let an officer out; after that it keeps rolling alongside instead of stopping and starting
    if (c.pursuit && mode === 'walk' && (!c.dropped || T - c.dropT < 0.8) && Math.hypot(rel(px - c.x), rel(py - c.y)) < 1.2) room_ = 0;
    if (c.dest && !c.pursuit && Math.hypot(rel(c.dest[0] - c.x), rel(c.dest[1] - c.y)) < (c.ev ? 1 : 1.2)) { // (1: the far lane of the street counts)
      if (c.ev) { if (ROAD[idx(Math.floor(c.x), Math.floor(c.y))] !== 3) evArrive(c); } // not in the middle of a junction
      else { room_ = 0; c.arrived = true; }
    }

    const target = Math.min(Math.max(0, room_ * 2.5), c.cruise * (c.rush ? 1.8 : 1));
    c.brake = target < c.v;
    c.v = Math.min(target, c.v + (c.kind === 'police' ? COP_CAR_ACCEL : code(c) || c.rush ? 1.4 : 0.8) * dt);
    const d = c.v * dt, step = Math.min(d, c.left);
    if (vert) c.y = mod(c.y + dir * step, N); else c.x = mod(c.x + dir * step, N);
    c.left -= step;
    if (c.rider) c.fare += step;
    if (c.left <= 0) { [c.hx, c.hy] = c.nh; plan(c); }
    c.ex = mod(c.x + c.hy * c.off, N); c.ey = mod(c.y - c.hx * c.off, N);
    if (taxi) {
      const vx = rel(c.ex - oldX), vy = rel(c.ey - oldY);
      const yaw = Math.hypot(vx, vy) > 1e-5 ? Math.atan2(vy, vx) : Math.atan2(c.hy, c.hx);
      c.laneYaw ??= Math.atan2(c.hy, c.hx);
      c.laneYaw += (mod(yaw - c.laneYaw + Math.PI, 2 * Math.PI) - Math.PI) * (1 - Math.exp(-12 * dt));
    }
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
