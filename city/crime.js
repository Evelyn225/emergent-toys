// ---- crime and the police. Pure (no DOM), so the node tests can run it; crime-ui.js draws it and asks what you do
// when they catch you.
//
// A crime only counts if somebody sees it. A cop who sees it (in their line of sight, within COP_SIGHT) puts you
// straight on the wanted list; a passer-by who sees it calls it in a few seconds later, and then only if there's a
// police unit within DISPATCH_R to send. Wanted is 1-3 stars: more stars, more units after you. They chase where
// they last saw you; stay out of every cop's sight for ESCAPE_T seconds and they give up. Caught: a fine, or jail.
//
// Police: patrol cars cruising in the traffic (cars with patrol: true; in pursuit they run lights and siren and steer
// for you), and officers on foot walking beats round the police stations (footCops), who chase you on foot.
const COP_SIGHT = 13, CIV_SIGHT = 8, DISPATCH_R = 45, REPORT_DELAY = 5;
const ESCAPE_T = [0, 25, 40, 60];            // seconds out of sight to lose them, by stars
const UNITS = [0, 2, 3, 5];                  // patrol cars after you, by stars
const FINE = [0, 50, 150, 300];              // what they'll take instead of a cell
const CRIMES = { steal: { stars: 1, name: 'car theft' }, hit: { stars: 2, name: 'hitting someone with a car' },
                 crash: { stars: 1, name: 'reckless driving' }, redlight: { stars: 1, name: 'running a red light' },
                 pickpocket: { stars: 1, name: 'pickpocketing' }, shoplift: { stars: 1, name: 'shoplifting' },
                 burglary: { stars: 2, name: 'breaking and entering' }, graffiti: { stars: 1, name: 'vandalism' },
                 alarm: { stars: 2, name: 'burglary' }, bankjob: { stars: 3, name: 'robbing a bank' },
                 boattheft: { stars: 1, name: 'boat theft' }, urination: { stars: 1, name: 'public urination' }, heist: { stars: 3, name: 'the museum heist' } };
const wanted = { stars: 0, lastX: 0, lastY: 0, seen: false, hideT: 0, bustT: 0, busted: false, crime: '' };
const reports = []; // a passer-by on the phone: { t (when it comes in), x, y, kind }
const jammed = new Map(); // shop -> T until its lock can be tried again
const roomCops = []; // officers who got a reliable lead that you entered the current building
const roofCops = [];
let roofLead = null;
let searchedRoom = null;

// can you see (bx, by) from (ax, ay)? Nothing built in the way (cells taller than eye height block it)
function lineOfSight(ax, ay, bx, by) {
  const dx = rel(bx - ax), dy = rel(by - ay), n = Math.ceil(Math.hypot(dx, dy) * 3);
  for (let k = 1; k < n; k++) if (map[idx(Math.floor(ax + dx * k / n), Math.floor(ay + dy * k / n))] > 0.15) return false;
  return true;
}
const near = (ax, ay, bx, by) => Math.hypot(rel(ax - bx), rel(ay - by));
// where the police think you are: out on the street, or (indoors) the door you went in by
const crimePos = () => mode === 'room' && room && room.ret ? [room.ret[0], room.ret[1]] : [px, py];

// ---- the police on foot: three on the beat round each police station, corner to corner along the sidewalks. A
// corner is an intersection (ix, iy) and which of its four corners (qx, qy).
const footCops = [];
// Faster than a diagonal sprint, including coffee; airborne momentum and skate tricks remain the player's tools.
const COP_FOOT_SPEED = 1.5, COP_ROOM_SPEED = 4.6;
const cornerXY = c => [c.ix * 8 + (c.qx ? 1.88 : 0.12), c.iy * 8 + (c.qy ? 1.88 : 0.12)];
function stepCorner(c, dir) { // the corner one step along the sidewalk in dir (0 E, 1 S, 2 W, 3 N), or null if there's no sidewalk
  let { ix, iy, qx, qy } = c;
  if (dir === 0) { if (!qx) qx = 1; else { if (!hseg(ix, iy)) return null; ix++; qx = 0; } }
  else if (dir === 2) { if (qx) qx = 0; else { if (!hseg(ix - 1, iy)) return null; ix--; qx = 1; } }
  else if (dir === 1) { if (!qy) qy = 1; else { if (!vseg(ix, iy)) return null; iy++; qy = 0; } }
  else { if (qy) qy = 0; else { if (!vseg(ix, iy - 1)) return null; iy--; qy = 1; } }
  return degree(ix & (NB - 1), iy & (NB - 1)) ? { ix, iy, qx, qy } : null;
}
for (const b of SERVICES) if (b.kind === 'police') for (let k = 0; k < 3; k++) {
  const corner = { ix: b.bx + (k === 1 ? 1 : 0), iy: b.by, qx: k & 1, qy: 1 };
  const [x, y] = cornerXY(corner);
  footCops.push({ x, y, corner, dir: k % 2 ? 2 : 0, goal: null, chase: false, ph: Math.random() * 9, base: b });
}
function patrolStep(c, dt) { // walk to the next corner; there, carry on or turn (never straight back)
  if (!c.goal) {
    const opts = [0, 1, 2, 3].filter(d => d !== (c.dir + 2) % 4).map(d => [d, stepCorner(c.corner, d)]).filter(o => o[1]);
    const [d, next] = opts.length ? pick(opts) : [(c.dir + 2) % 4, stepCorner(c.corner, (c.dir + 2) % 4)];
    if (!next) return;
    c.dir = d; c.goal = next;
  }
  const [gx, gy] = cornerXY(c.goal), dx = rel(gx - c.x), dy = rel(gy - c.y), d = Math.hypot(dx, dy), s = 0.42 * dt;
  if (d <= s) { c.x = mod(gx, N); c.y = mod(gy, N); c.corner = c.goal; c.goal = null; }
  else { c.x = mod(c.x + dx / d * s, N); c.y = mod(c.y + dy / d * s, N); c.ph += dt * 4; }
}
function chaseStep(c, tx, ty, dt) { // run straight for (tx, ty), sliding along walls (just out of the car: a sprint)
  const dx = rel(tx - c.x), dy = rel(ty - c.y), d = Math.hypot(dx, dy) || 1, s = Math.min(d, (c.burst > T ? COP_FOOT_SPEED * 1.1 : COP_FOOT_SPEED) * dt);
  const nx = c.x + dx / d * s, ny = c.y + dy / d * s;
  if (!map[idx(Math.floor(nx), Math.floor(c.y))]) c.x = mod(nx, N);
  if (!map[idx(Math.floor(c.x), Math.floor(ny))]) c.y = mod(ny, N);
  c.ph += dt * 7;
}
const roomOpen = (x, y) => x >= 0 && y >= 0 && x < room.W && y < room.H && ROOMW.cell(Math.floor(x), Math.floor(y)) === 0 && !(room.def.block && room.def.block(x, y)) &&
  !room.props.some(p => p.box && !p.walk && p.box.z0 < 1.2 && inBox(p.box, x, y, 0.2) || p.bench && Math.hypot(x - p.x, y - p.y) < 0.5);
function nearestRoomCell(x, y) {
  let best = null, bd = Infinity;
  for (let cy = 0; cy < room.H; cy++) for (let cx = 0; cx < room.W; cx++) if (roomOpen(cx + 0.5, cy + 0.5)) {
    const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
    if (d < bd) { best = [cx, cy]; bd = d; }
  }
  return best;
}
function roomPath(fromX, fromY, toX, toY) {
  const start = nearestRoomCell(fromX, fromY), end = nearestRoomCell(toX, toY);
  if (!start || !end) return [];
  const key = (x, y) => y * room.W + x, first = key(...start), last = key(...end), prev = new Int32Array(room.W * room.H).fill(-1), queue = [first];
  prev[first] = first;
  for (let h = 0; h < queue.length && prev[last] < 0; h++) {
    const id = queue[h], x = id % room.W, y = id / room.W | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= room.W || ny >= room.H || prev[nk] >= 0 || !roomOpen(nx + 0.5, ny + 0.5)) continue;
      prev[nk] = id; queue.push(nk);
    }
  }
  if (prev[last] < 0) return [];
  const path = [];
  for (let id = last; id !== first; id = prev[id]) path.push([id % room.W + 0.5, (id / room.W | 0) + 0.5]);
  return path.reverse();
}
function roomWalkLine(x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 6);
  for (let k = 1; k <= steps; k++) if (!roomOpen(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps)) return false;
  return true;
}
function roomDoorCell() {
  if (!room.grid) return null;
  let best = null, bd = Infinity;
  const door = room.grid.some(row => row.includes('D')) ? 'D' : 'E';
  for (let y = 0; y < room.H; y++) for (let x = 0; x < room.W; x++) if (room.grid[y][x] === door) {
    for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (roomOpen(x + ox + 0.5, y + oy + 0.5)) {
      const d = Math.hypot(x + ox + 0.5 - px, y + oy + 0.5 - py);
      if (d < bd) { bd = d; best = [x + ox + 0.5, y + oy + 0.5]; }
    }
  }
  if (best) return best;
  return nearestRoomCell(px, py)?.map(v => v + 0.5) || null;
}
function roomPoliceSees(c) {
  const tx = px, ty = py, targetZ = body.seat ? 0.95 : Math.max(0.42, 1.55 - (body.crouch || 0) * 1.12);
  const vx = tx - c.x, vy = ty - c.y, n = Math.ceil(Math.hypot(vx, vy) * 8);
  if (n > 80) return false;
  for (let k = 1; k < n; k++) {
    const t = k / n, x = c.x + vx * t, y = c.y + vy * t, z = 1.55 + (targetZ - 1.55) * t;
    const cell = room.grid[Math.floor(y)]?.[Math.floor(x)];
    if (ROOMW.cell(Math.floor(x), Math.floor(y)) > 0 && cell !== 'D' && cell !== 'E') return false;
    for (const p of room.props) if (p.box) {
      const b = p.box, qx = x - b.x, qy = y - b.y, along = qx * b.c + qy * b.s, across = -qx * b.s + qy * b.c;
      if (Math.abs(along) < b.hl && Math.abs(across) < b.hw && z > b.z0 && z < b.z1) return false;
    }
  }
  return true;
}
function roomSearchLead(dt) {
  if (mode !== 'room') { roomCops.length = 0; searchedRoom = null; return false; }
  if (!wanted.stars) { roomCops.length = 0; searchedRoom = null; return false; }
  if (searchedRoom !== room) {
    searchedRoom = room; roomCops.length = 0;
    const ret = room.ret;
    if (!ret) return false;
    const policeSawDoor = copSees(ret[0], ret[1]);
    const witnessSawDoor = people.some(p => !p.hidden && near(p.x, p.y, ret[0], ret[1]) < 4 && lineOfSight(p.x, p.y, ret[0], ret[1]));
    const lastSeenAtDoor = near(wanted.lastX, wanted.lastY, ret[0], ret[1]) < 0.9;
    if (wanted.seen || policeSawDoor || witnessSawDoor || lastSeenAtDoor) {
      if (witnessSawDoor || policeSawDoor) { wanted.lastX = ret[0]; wanted.lastY = ret[1]; callUnits(); }
      const door = roomDoorCell();
      if (door) {
        wanted.roomX = px; wanted.roomY = py;
        for (let i = 0; i < Math.min(2, Math.max(1, wanted.stars)); i++)
          roomCops.push({ x: door[0], y: door[1], targetX: wanted.roomX, targetY: wanted.roomY, path: [], pathT: 0, searchT: 0, searchI: 0, sees: false });
      }
    }
  }
  let anySees = false;
  for (const c of roomCops) {
    c.sees = Math.hypot(c.x - px, c.y - py) < 9 && roomPoliceSees(c);
    if (c.sees) { anySees = true; wanted.roomX = px; wanted.roomY = py; c.targetX = px; c.targetY = py; c.searchI = 0; }
    else if (Math.hypot(c.x - c.targetX, c.y - c.targetY) < 0.28) {
      c.searchT += dt;
      if (c.searchT > 0.8) {
        c.searchT = 0;
        const cells = [];
        for (let y = 0; y < room.H; y++) for (let x = 0; x < room.W; x++) if (roomOpen(x + 0.5, y + 0.5) && Math.hypot(x + 0.5 - wanted.roomX, y + 0.5 - wanted.roomY) < 5)
          cells.push([x + 0.5, y + 0.5]);
        cells.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
        if (cells.length) { const g = cells[c.searchI++ % cells.length]; c.targetX = g[0]; c.targetY = g[1]; }
      }
    }
    if ((c.pathT -= dt) <= 0) {
      c.pathT = c.sees ? 0.18 : 0.45;
      c.direct = c.sees && roomWalkLine(c.x, c.y, c.targetX, c.targetY);
      c.path = c.direct ? [] : roomPath(c.x, c.y, c.targetX, c.targetY);
    }
    let [gx, gy] = c.direct ? [c.targetX, c.targetY] : c.path[0] || [c.targetX, c.targetY], vx = gx - c.x, vy = gy - c.y, d = Math.hypot(vx, vy), step = (c.sees ? COP_ROOM_SPEED : 2.1) * dt;
    if (d < step + 0.04) { c.x = gx; c.y = gy; if (c.path.length) c.path.shift(); }
    else if (d > 1e-5) {
      const nx = c.x + vx / d * step, ny = c.y + vy / d * step;
      if (roomOpen(nx, c.y)) c.x = nx;
      if (roomOpen(c.x, ny)) c.y = ny;
    }
  }
  return anySees;
}
const policeRoofHeight = (x, y) => typeof roofHeightAt === 'function' ? roofHeightAt(x, y) : Math.max(map[idx(Math.floor(x), Math.floor(y))], belleRoofHeight(x, y), architectureRoofHeight(x, y), landmarkRoofHeight(x, y), pavilionRoofHeight(x, y), homeBalconyHeight(x, y));
function notePoliceRoofEntry(x, y, ret = null) {
  if (!wanted.stars || !(wanted.seen || roomCops.length || ret && near(wanted.lastX, wanted.lastY, ret[0], ret[1]) < 1)) return;
  roofLead = { x, y, ret, targetX: x, targetY: y, arriveAt: T + (roomCops.length ? 1.2 : 3), count: Math.min(2, Math.max(1, wanted.stars)), arrived: false };
}
function roofPoliceSees(c) {
  const vx = rel(px - c.x), vy = rel(py - c.y), d = Math.hypot(vx, vy);
  if (d > COP_SIGHT) return false;
  const z0 = policeRoofHeight(c.x, c.y) + 0.16, z1 = policeRoofHeight(px, py) + 0.15 + body.z / 10, n = Math.ceil(d * 8);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (policeRoofHeight(c.x + vx * t, c.y + vy * t) > z0 + (z1 - z0) * t) return false;
  }
  return true;
}
function policeRoofPath(x0, y0, x1, y1) {
  const first = idx(Math.floor(x0), Math.floor(y0)), last = idx(Math.floor(x1), Math.floor(y1)), prev = new Map([[first, first]]), queue = [first];
  for (let k = 0; k < queue.length && k < 1600 && !prev.has(last); k++) {
    const cell = queue[k], x = cell % N, y = Math.floor(cell / N), height = policeRoofHeight(x + 0.5, y + 0.5);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = idx(x + ox, y + oy), nx = next % N + 0.5, ny = Math.floor(next / N) + 0.5, nh = policeRoofHeight(nx, ny);
      if (prev.has(next) || !nh || Math.abs(nh - height) > 0.35 || near(nx, ny, x0, y0) > 24) continue;
      prev.set(next, cell); queue.push(next);
    }
  }
  if (!prev.has(last)) return [];
  const path = [[x1, y1]];
  for (let cell = last; cell !== first; cell = prev.get(cell)) path.push([cell % N + 0.5, Math.floor(cell / N) + 0.5]);
  return path.reverse();
}
function roofSearchLead(dt) {
  if (mode !== 'roof' || !wanted.stars) { roofCops.length = 0; roofLead = null; return false; }
  if (!roofLead) return false;
  if (!roofLead.arrived && T >= roofLead.arriveAt) {
    roofLead.arrived = true;
    for (let k = 0; k < roofLead.count; k++) roofCops.push({ x: roofLead.x, y: roofLead.y, targetX: roofLead.targetX, targetY: roofLead.targetY, path: [], pathT: 0, ph: k });
  }
  let seen = false;
  for (const c of roofCops) {
    c.sees = roofPoliceSees(c);
    if (c.sees) { seen = true; c.targetX = px; c.targetY = py; }
    if ((c.pathT -= dt) <= 0) { c.pathT = 0.25; c.path = policeRoofPath(c.x, c.y, c.targetX, c.targetY); }
    const target = c.path[0];
    if (!target) continue;
    const vx = rel(target[0] - c.x), vy = rel(target[1] - c.y), d = Math.hypot(vx, vy), step = Math.min(d, (c.sees ? COP_FOOT_SPEED : 0.7) * dt);
    if (d < 0.025) { c.path.shift(); continue; }
    const nx = mod(c.x + vx / d * step, N), ny = mod(c.y + vy / d * step, N), height = policeRoofHeight(c.x, c.y), nh = policeRoofHeight(nx, ny);
    if (nh > 0 && Math.abs(nh - height) <= 0.35) { c.x = nx; c.y = ny; c.ph += dt * 7; }
    if (d <= step) c.path.shift();
  }
  return seen;
}
function drawRoofPolice() {
  for (const c of roofCops) {
    const z = policeRoofHeight(c.x, c.y);
    drawArt(...R(c.x, c.y), z, 0.06, 0.18, (c.ph | 0) % 2 ? ART.walkA : ART.walkB, (ch, row, L) => C(row === 1 ? SKIN : BLUE, Math.max(L, 7)));
    if (c.sees && fract(T * 3) < 0.5) drawArt(...R(c.x, c.y), z + 0.2, 0.03, 0.05, ['!'], () => C(RED, 15));
  }
}
function drawRoomPolice() {
  for (const c of roomCops) {
    drawArt(c.x - px, c.y - py, 0, 0.38, 1.5, (c.pathT > 0.2 && c.path.length ? ART.walkA : ART.keeper),
      (ch, row, L) => C(row < 3 ? SKIN : BLUE, row < 3 ? L : Math.max(L, 10)));
    if (c.sees && fract(T * 3) < 0.55) drawArt(c.x - px, c.y - py, 1.65, 0.1, 0.12, ['!'], () => C(RED, 15));
  }
}
function backToBeat(c) { // the chase is off: pick up the beat from the nearest corner
  const ix = Math.round((c.x - 1) / 8), iy = Math.round((c.y - 1) / 8);
  c.corner = { ix, iy, qx: mod(c.x, 8) > 1 ? 1 : 0, qy: mod(c.y, 8) > 1 ? 1 : 0 }; c.goal = c.corner; c.chase = false;
}

// ---- the patrol cars: a couple of dozen of the city's cars are police, cruising like the rest
const PATROLS = 24;
for (let n = 0; n < PATROLS; n++) {
  const c = cars.find(o => !o.patrol && !o.ev && o.body !== TAXI && Math.random() < 0.1);
  if (c) Object.assign(c, { kind: 'police', body: BLUE, patrol: true });
}

// ---- a crime, here and now: who saw it, and what follows
// returns 'cop' (wanted now), 'reported' (somebody will call it in), or '' (nobody saw)
// can any cop, in a car or on foot, see (x, y)?
const copSees = (x, y) => cars.some(c => c.patrol && !c.player && near(c.x, c.y, x, y) < COP_SIGHT && lineOfSight(c.x, c.y, x, y))
  || footCops.some(c => near(c.x, c.y, x, y) < COP_SIGHT && lineOfSight(c.x, c.y, x, y));
function crime(kind, x = crimePos()[0], y = crimePos()[1]) {
  const copSees_ = copSees(x, y);
  if (copSees_) { addWanted(kind, x, y, true); return 'cop'; }
  const civSees = people.some(p => !p.hidden && near(p.x, p.y, x, y) < CIV_SIGHT && lineOfSight(p.x, p.y, x, y)) || kind === 'steal' || kind === 'shoplift' || kind === 'boattheft';
  if (civSees) { reports.push({ t: T + REPORT_DELAY, x, y, kind }); return 'reported'; } // (a carjacked driver, a clerk, or a boat's owner always calls it in)
  return '';
}
// a red light only counts with a cop right there
function redLightCrime(x, y) {
  const cop = cars.some(c => c.patrol && !c.player && near(c.x, c.y, x, y) < 2.5) || footCops.some(c => near(c.x, c.y, x, y) < 2.5);
  if (cop) addWanted('redlight', x, y, true);
  return cop;
}
function addWanted(kind, x, y, seen) {
  wanted.stars = Math.min(3, Math.max(wanted.stars, 0) + CRIMES[kind].stars);
  wanted.crime = CRIMES[kind].name; wanted.lastX = x; wanted.lastY = y; wanted.hideT = 0; wanted.seen = seen;
  callUnits();
}
// enough patrol cars on the case for the stars: the nearest free ones first, then more from a few blocks off
function callUnits() {
  const on = cars.filter(c => c.pursuit).length, need = UNITS[wanted.stars] - on;
  const free = cars.filter(c => c.patrol && !c.pursuit && !c.player).sort((a_, b) => near(a_.x, a_.y, wanted.lastX, wanted.lastY) - near(b.x, b.y, wanted.lastX, wanted.lastY));
  for (let k = 0; k < need; k++) {
    let c = free[k];
    if (!c || near(c.x, c.y, wanted.lastX, wanted.lastY) > DISPATCH_R) { // nobody close: one drives in
      const p = randomLane(30, wanted.lastX, wanted.lastY);
      c = addCar({ ...p, kind: 'police', body: BLUE, patrol: true, extra: true });
    }
    Object.assign(c, { pursuit: true, returning: false, state: 'out', home: false, born: T, waitingCrew: false, merging: null, cruise: 2.5, dest: [wanted.lastX, wanted.lastY] });
  }
}
function clearWanted() {
  wanted.stars = 0; wanted.seen = false; wanted.hideT = 0; wanted.bustT = 0; wanted.busted = false;
  const units = cars.filter(c => c.pursuit);
  const closestCar = (x, y) => units.reduce((best, c) => !best || near(c.x, c.y, x, y) < near(best.x, best.y, x, y) ? c : best, null);
  const exit = searchedRoom?.ret || room?.ret;
  for (const c of roomCops) {
    c.returning = true; c.returnCar = closestCar(...(exit || crimePos())); c.exitWorld = exit;
    c.returnDoor = mode === 'room' && room.grid ? roomDoorCell() : null; c.sees = false; c.pathT = 0;
  }
  for (const c of roofCops) {
    c.returning = true; c.returnCar = closestCar(c.x, c.y); c.exitWorld = roofLead?.ret;
    c.returnDoor = roofLead ? [roofLead.x, roofLead.y] : [c.x, c.y]; c.sees = false; c.pathT = 0;
  }
  searchedRoom = null; roofLead = null;
  for (const c of units) {
    c.pursuit = false; c.returning = true; c.waitingCrew = true; c.v = 0; c.cruise = 1.3; c.state = 'back'; c.arrived = false;
    c.base ||= SERVICES.filter(b => b.kind === 'police').reduce((best, b) => !best || near(b.x, b.y, c.x, c.y) < near(best.x, best.y, c.x, c.y) ? b : best, null);
    c.dest = c.base ? [c.base.x, c.base.lane] : null; c.dropped = false; c.drops = 0;
    if (c.base) c.base.out = true;
  }
  for (const c of footCops) if (c.chase) {
    if (c.car && cars.includes(c.car)) { c.chase = false; c.returnCar = c.car; c.returnPathT = 0; }
    else backToBeat(c);
  }
  reports.length = 0;
}
function policeExitToStreet(c) {
  const car = c.returnCar;
  if (!car) return;
  const at = c.exitWorld || [car.x, car.y];
  footCops.push({ x: at[0], y: at[1], car, returnCar: car, chase: false, extra: true, ph: 0, returnPathT: 0 });
}
function policeReturnLane(c) {
  const lane = laneNear(c.x, c.y);
  if (ROAD[idx(Math.floor(lane.x), Math.floor(lane.y))] && !map[idx(Math.floor(lane.x), Math.floor(lane.y))]) return lane;
  let best = lane, distance = Infinity;
  // A cruiser can have followed you into the Gardens, where the usual block lanes do not exist.
  for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) {
    const cell = idx(Math.floor(c.x) + x, Math.floor(c.y) + y);
    if (ROAD[cell] !== 1 && ROAD[cell] !== 2 || map[cell]) continue;
    const candidate = laneNear(cell % N + 0.5, Math.floor(cell / N) + 0.5), d = near(c.x, c.y, candidate.x, candidate.y);
    if (d < distance) { distance = d; best = candidate; }
  }
  return best;
}
function stepReturningPolice(dt) {
  for (const [agents, indoors] of [[roomCops, true], [roofCops, false]]) for (let k = agents.length - 1; k >= 0; k--) {
    const c = agents[k];
    if (!c.returning) continue;
    const inPlace = indoors ? mode === 'room' : mode === 'roof', door = c.returnDoor;
    if (!inPlace || !door) { policeExitToStreet(c); agents.splice(k, 1); continue; }
    if ((c.pathT -= dt) <= 0) { c.pathT = 0.5; c.path = indoors ? roomPath(c.x, c.y, ...door) : policeRoofPath(c.x, c.y, ...door); }
    const goal = c.path[0] || door, vx = indoors ? goal[0] - c.x : rel(goal[0] - c.x), vy = indoors ? goal[1] - c.y : rel(goal[1] - c.y), d = Math.hypot(vx, vy), step = Math.min(d, (indoors ? 1.6 : 0.5) * dt);
    if (d > 1e-5) {
      const nx = mod(c.x + vx / d * step, N), ny = mod(c.y + vy / d * step, N);
      const open = indoors ? roomOpen(nx, ny) : policeRoofHeight(nx, ny) > 0 && Math.abs(policeRoofHeight(nx, ny) - policeRoofHeight(c.x, c.y)) <= 0.35;
      if (open) { c.x = nx; c.y = ny; }
    }
    if (d <= step) c.path.shift();
    if (Math.hypot(c.x - door[0], c.y - door[1]) < (indoors ? 0.18 : 0.06)) { policeExitToStreet(c); agents.splice(k, 1); }
  }
  for (let k = footCops.length - 1; k >= 0; k--) {
    const c = footCops[k], car = c.returnCar;
    if (!car) continue;
    if (!cars.includes(car)) { c.returnCar = null; backToBeat(c); continue; }
    if (near(c.x, c.y, car.x, car.y) < 0.2) { footCops.splice(k, 1); continue; }
    if ((c.returnPathT -= dt) <= 0) { c.returnPathT = 0.7; c.returnPath = pursuitRoute(c, car.x, car.y); }
    const goal = c.returnPath?.[0] || [car.x, car.y], d = near(c.x, c.y, ...goal), vx = rel(goal[0] - c.x), vy = rel(goal[1] - c.y), step = Math.min(d, 0.5 * dt);
    if (d > 1e-5) {
      const nx = mod(c.x + vx / d * step, N), ny = mod(c.y + vy / d * step, N);
      if (!map[idx(Math.floor(nx), Math.floor(ny))]) { c.x = nx; c.y = ny; c.ph += dt * 4; }
    }
    if (d <= step && c.returnPath?.length) c.returnPath.shift();
  }
  const [wx, wy] = crimePos();
  for (const c of cars.slice()) if (c.returning && !c.pursuit) {
    const crew = [...footCops, ...roomCops, ...roofCops].some(p => p.returnCar === c);
    if (c.waitingCrew && !crew) {
      c.waitingCrew = false; c.merging = policeReturnLane(c); c.pursuitDrive = false; c.routeT = 0;
    }
    if (!c.waitingCrew && (c.arrived || c.home || near(c.x, c.y, wx, wy) > SIM_R * 0.9)) {
      c.returning = false;
      if (c.base) c.base.out = false;
      endCall(c);
    }
  }
}
// is a cop near enough a police unit to be sent to (x, y)?
const policeNear = (x, y) => cars.some(c => c.patrol && near(c.x, c.y, x, y) < DISPATCH_R) || footCops.some(c => near(c.x, c.y, x, y) < DISPATCH_R);

// ---- every frame
function stepCrime(dt) {
  for (let k = reports.length - 1; k >= 0; k--) { // calls coming in
    const r = reports[k];
    if (T < r.t) continue;
    reports.splice(k, 1);
    if (policeNear(r.x, r.y)) addWanted(r.kind, r.x, r.y, false); // they come to where it happened
  }
  stepReturningPolice(dt);
  for (const c of footCops) if (!c.chase && !c.returnCar) patrolStep(c, dt);
  // a cab you've paid to step on it, seen by a cop: pulled over, and the driver's arrested
  if (mode === 'taxi' && me && me.rush && Math.abs(me.v) > 1.5 && copSees(me.x, me.y)) return 'cab';
  if (!wanted.stars) return;
  const roomSeen = roomSearchLead(dt);
  const roofSeen = roofSearchLead(dt);
  const [wx, wy] = crimePos(), inside = mode === 'room', onRoof = mode === 'roof';
  const sees = c => !inside && !onRoof && near(c.x, c.y, wx, wy) < COP_SIGHT && lineOfSight(c.x, c.y, wx, wy);
  wanted.seen = inside ? roomSeen : onRoof ? roofSeen : cars.some(c => c.pursuit && sees(c)) || footCops.some(sees);
  if (wanted.seen) { if (!inside) { wanted.lastX = wx; wanted.lastY = wy; } wanted.hideT = 0; wanted.tipT = 0; }
  else if ((wanted.hideT += dt) > ESCAPE_T[wanted.stars]) { clearWanted(); return 'lost'; }
  else if (!inside && wanted.hideT < ESCAPE_T[wanted.stars] * 0.75 && (wanted.tipT = (wanted.tipT || 0) - dt) <= 0) { // a tip on the radio: roughly where you are
    wanted.tipT = 4; wanted.lastX = mod(wx + (Math.random() - 0.5) * 3, N); wanted.lastY = mod(wy + (Math.random() - 0.5) * 3, N);
  }
  for (const c of cars) if (c.pursuit) c.dest = [wanted.lastX, wanted.lastY]; // steering for you, or where you were
  const onFoot = mode === 'walk';
  for (const c of footCops) { // officers within a few blocks join the chase on foot
    if (!c.chase && near(c.x, c.y, wanted.lastX, wanted.lastY) < 20) { c.chase = true; c.returnCar = null; }
    if (c.chase) chaseStep(c, wanted.lastX, wanted.lastY, dt);
  }
  // pulls up, an officer jumps out and sprints for you; outrun him and the car comes round again for another go
  if (onFoot || inside) for (const c of cars) if (c.pursuit && (!c.dropped || T - c.dropT > 8 && (c.drops || 0) < 3) && near(c.x, c.y, wx, wy) < 1.4) {
    c.dropped = true; c.dropT = T; c.drops = (c.drops || 0) + 1;
    footCops.push({ x: c.x, y: c.y, car: c, corner: null, dir: 0, goal: null, chase: true, ph: 0, extra: true, burst: T + 5 });
  }
  // in a car with a cruiser on your bumper: told to pull over, and if you don't, a PIT manoeuvre spins you out
  let told = false;
  if (mode === 'drive' && me) {
    const tail = cars.some(c => c.pursuit && c !== me && near(c.x, c.y, me.x, me.y) < 1.3);
    wanted.tailT = tail ? (wanted.tailT || 0) + dt : Math.max(0, (wanted.tailT || 0) - dt * 0.5);
    if (tail && T > (wanted.toldT || 0)) { wanted.toldT = T + 8; told = true; }
    if (wanted.tailT > 4 && Math.abs(me.v) > 0.5) { wanted.tailT = 0; me.spunT = T + 2.5; return 'pit'; }
  }
  // caught: a hand on your shoulder, or boxed in and stopped
  const grabbed = onFoot && footCops.some(c => c.chase && near(c.x, c.y, px, py) < 0.22)
    || inside && roomCops.some(c => c.sees && Math.hypot(c.x - px, c.y - py) < 0.32)
    || onRoof && body.z < 1 && roofCops.some(c => c.sees && near(c.x, c.y, px, py) < 0.22);
  const boxed = me && Math.abs(me.v) < 0.3 && (cars.some(c => c.pursuit && c !== me && near(c.x, c.y, me.x, me.y) < 1.4) || footCops.some(c => c.chase && near(c.x, c.y, me.x, me.y) < 0.5));
  wanted.bustT = boxed ? wanted.bustT + dt : 0;
  if (grabbed || wanted.bustT > 2.5) { wanted.busted = true; return 'busted'; }
  return told ? 'pullover' : wanted.seen ? 'seen' : 'hiding';
}
// after the chase, extra units go home (out of sight) and officers who jumped out of cars walk off
function tidyPolice() {
  const [wx, wy] = crimePos();
  for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.extra && !c.pursuit && !c.returning && near(c.x, c.y, wx, wy) > 30) cars.splice(k, 1); }
  for (let k = footCops.length - 1; k >= 0; k--) { const c = footCops[k]; if (c.extra && !c.chase && !c.returnCar && near(c.x, c.y, wx, wy) > 25) footCops.splice(k, 1); }
}
// what being caught costs. Paying it settles everything, and the car goes back
const fineFor = stars => FINE[stars];
function payFine() {
  const f = fineFor(wanted.stars);
  if (!pay(f)) return false;
  clearWanted(); return true;
}
// jail: everything you're carrying is taken (not your money) and locked in evidence, and you do your time. Break out
// via the evidence locker and you get it back (see the jailbreak game); serve your time and it's gone
const JAIL_T = 60;
const seized = [];
function goToJail() {
  seized.length = 0; seized.push(...inv);
  clearInventory(); fx.skating = false; fx.boombox = false;
  clearWanted();
}
