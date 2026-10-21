// ---- gas stations (world.js has where they are and how a forecourt's laid out; gas-render.js draws them). The canopy,
// islands, pumps and price sign are solids, the islands solid to cars as well as people. Now and then a car going past
// pulls in (going west along the main street, into one of the two nearer lanes; going north up the side street, into
// one of the two further ones), stops with its filler cap by a pump while the driver fills up, then waits for a gap
// and pulls out onto the main street. Off its lane it follows a path of its own (c.pit), and stepTraffic leaves it to
// stepPit till it's back in the traffic. You never need gas yourself.

// the solids, measured from the forecourt's corner (x0, y0)
function gasSolid(st, x, y, alongX, hl, hw, z0, z1, kind, extra) {
  const o = { x: worldCoord(st.x0 + x), y: worldCoord(st.y0 + y), c: alongX ? 1 : 0, s: alongX ? 0 : 1, hl, hw, z0, z1, kind, k: st.k, st, ...extra };
  solids.push(o); solidsB[bi(Math.floor(o.x / 8), Math.floor(o.y / 8))].push(o);
  return o;
}
// and the driveways across the pavement: lamps and trees there step aside (streetscape.js)
const GAS_CLEAR = [];
for (const st of GAS_STATIONS) {
  gasSolid(st, 1.5, 0.95, true, 1.05, 0.88, 0.43, 0.51, 'gascanopy');
  for (const [k, iy] of GAS.islands.entries()) {
    gasSolid(st, GAS.pumpX, iy, true, (GAS.ix1 - GAS.ix0) / 2, 0.06, 0, 0.025, 'gasisle');
    gasSolid(st, GAS.pumpX, iy, true, 0.06, 0.045, 0, 0.2, 'gaspump', { isle: k });
    for (const x of [GAS.ix0 + 0.035, GAS.ix1 - 0.035]) gasSolid(st, x, iy, true, 0.022, 0.022, 0, 0.43, 'gaspost');
  }
  gasSolid(st, 0.12, 0.2, false, 0.015, 0.015, 0, 0.33, 'gaspost'); // the price sign on its pole, by the way out
  gasSolid(st, 0.12, 0.2, false, 0.17, 0.02, 0.33, 0.66, 'gassign');
  gasSolid(st, 2.45, 1.91, true, 0.13, 0.05, 0, 0.09, 'gasice'); // the ice chest by the shop door
  for (const [x, y, hl, hw] of [[0.2, -0.16, 0.5, 0.16], [2.6, -0.16, 0.42, 0.16], [3.16, 1.35, 0.16, 0.65]])
    GAS_CLEAR.push({ x: worldCoord(st.x0 + x), y: worldCoord(st.y0 + y), c: 1, s: 0, hl, hw, z0: 0, z1: 0.02 }); // (flat: no shelter from the snow)
}
// is a car's body (as carBodyClear's) clear of the islands (and the sign's pole)?
function gasCarClear(x, y, hx, hy, hl, hw) {
  if (GAS_CELL[idx(Math.floor(x), Math.floor(y))] !== 1) return true;
  const st = gasStationAt(x, y), lx = rel(x - st.x0), ly = rel(y - st.y0), ax = Math.abs(hx), ay = Math.abs(hy);
  const hit = (bx, by, bl, bw) => { // a box along x at (bx, by), half bl by bw: separating axes
    const qx = bx - lx, qy = by - ly;
    return Math.abs(qx * hx + qy * hy) < hl + bl * ax + bw * ay && Math.abs(-qx * hy + qy * hx) < hw + bl * ay + bw * ax &&
      Math.abs(qx) < bl + hl * ax + hw * ay && Math.abs(qy) < bw + hl * ay + hw * ax;
  };
  return !GAS.islands.some(iy => hit(GAS.pumpX, iy, (GAS.ix1 - GAS.ix0) / 2, 0.06)) && !hit(0.12, 0.2, 0.015, 0.015);
}

// ---- pulling in. Where cars think about it: going west, along the main street from the far side of the junction
// (cells x0+3..x0+6 of the lane's row); going north, the side street alongside (x0+3, y0+1..y0+4)
const GAS_CHANCE = 0.4, GAS_ZONE = new Array(N * N);
for (const st of GAS_STATIONS) {
  for (let x = 3; x <= 6; x++) GAS_ZONE[idx(st.x0 + x, st.y0 - 1)] = st;
  for (let y = 1; y <= 4; y++) GAS_ZONE[idx(st.x0 + 3, st.y0 + y)] = st;
}
const gasLaneFree = (st, l) => !cars.some(o => o.pit && o.pit.st === st && o.pit.lane === l && !o.player && !o.parked) &&
  !cars.some(o => (o.parked || o.player) && Math.abs(rel(o.ex - st.x0 - 1.5)) < 1.8 && Math.abs(rel(o.ey - st.y0 - GAS.lanes[l])) < 0.35); // (nor anything left in it)
// a car in the zone (st, or null just out of it): decide whether to fill up; once it has, slow for the turn (c.gas, see
// stepTraffic) and turn in at the right spot, if there's a lane free by then
function gasConsider(c, st) {
  if (c.gas && c.gas.st !== st) c.gas = null; // (turned off, or went by)
  if (!st) return;
  const lx = rel(c.x - st.x0), ly = rel(c.y - st.y0), west = c.hx === -1, north = c.hy === -1;
  if (!c.gas) {
    if (c.gasSeen === st && T - c.gasSeenT < 90) return; // (made its mind up about this one already)
    c.gasSeen = st; c.gasSeenT = T;
    if (c.kind !== 'car' || c.ev || c.patrol || c.pursuit || c.dest || c.rush || c.hail || Math.abs(c.off) > 0.01 || Math.random() > GAS_CHANCE) return;
    if (west && lx > 4.9 && c.nh[0] === -1 || north && ly > 2.6) c.gas = { st, from: west ? 'h' : 'v' };
    else return;
  }
  const g = c.gas;
  if (g.from === 'h' ? !west : !north) { c.gas = null; return; }
  const lane = l => [GAS.slotX, GAS.lanes[l], -1, 0];
  if (g.from === 'h' && lx <= 3.4) { // round the corner and straight in
    const l = [0, 1].find(l => gasLaneFree(st, l));
    c.gas = null;
    if (l !== undefined) startPit(c, st, l, [[lx, ly, -1, 0], [2.35, GAS.lanes[l], -1, 0], lane(l)]);
  } else if (g.from === 'v') for (const l of [2, 1]) { // a right turn off the side street, into the far lane if it's free
    if (g[l] || ly > GAS.lanes[l] + 0.72) continue;
    g[l] = true;
    if (gasLaneFree(st, l)) return startPit(c, st, l, [[lx, ly, 0, -1], [2.9, GAS.lanes[l], -1, 0], lane(l)]);
    if (l === 1) c.gas = null;
  }
}
// a path through poses [x, y, hx, hy] (forecourt coordinates): a cubic between each pair, its handles along their
// headings, sampled every couple of centimetres. hold: how far along it a car leaving waits for a gap
function gasPath(poses) {
  const pts = [[poses[0][0], poses[0][1]]], len = [0];
  for (let k = 1; k < poses.length; k++) {
    const [ax, ay, ahx, ahy] = poses[k - 1], [bx, by, bhx, bhy] = poses[k], h = Math.hypot(bx - ax, by - ay) * 0.4;
    const c1x = ax + ahx * h, c1y = ay + ahy * h, c2x = bx - bhx * h, c2y = by - bhy * h, n = Math.max(2, Math.ceil(h / 0.008));
    for (let j = 1; j <= n; j++) {
      const t = j / n, u = 1 - t, x = u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx, y = u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * by;
      const [qx, qy] = pts[pts.length - 1];
      len.push(len[len.length - 1] + Math.hypot(x - qx, y - qy)); pts.push([x, y]);
    }
  }
  const k = pts.findIndex(p => p[1] < 0.27); // (the front bumper about to cross the pavement)
  return { pts, len, total: len[len.length - 1], i: 0, hold: k < 0 ? Infinity : len[k] };
}
// the way out of lane l: on past the island, round to the right, across the pavement, left into the main street
function gasExitPoses(l) {
  const y = GAS.lanes[l], poses = [[GAS.slotX, y, -1, 0], [0.85, y, -1, 0]];
  if (y - 0.47 > 0.05) poses.push([0.38, y - 0.47, 0, -1]);
  poses.push([0.38, -0.05, 0, -1], [-0.17, -0.6, -1, 0], [-0.45, -0.6, -1, 0]);
  return poses;
}
function startPit(c, st, lane, poses) {
  c.pit = { st, lane, stage: 'in', path: gasPath(poses), s: 0, stuck: 0 };
  c.v = Math.min(c.v, 0.8); c.off = 0; c.offV = 0; c.pass = null; c.laneYaw = null; c.gas = null; c.travelA = null;
}
function placeOnPath(c) {
  const p = c.pit, P = p.path;
  while (P.i < P.len.length - 2 && P.len[P.i + 1] < p.s) P.i++;
  const a = P.pts[P.i], b = P.pts[P.i + 1], seg = P.len[P.i + 1] - P.len[P.i] || 1, f = clamp((p.s - P.len[P.i]) / seg, 0, 1);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  c.x = worldCoord(p.st.x0 + a[0] + (b[0] - a[0]) * f); c.y = worldCoord(p.st.y0 + a[1] + (b[1] - a[1]) * f);
  c.hx = (b[0] - a[0]) / d; c.hy = (b[1] - a[1]) / d; c.ex = c.x; c.ey = c.y; c.off = 0;
}
// how far c can go along its heading before it's up against something: a car (whichever way it's facing), somebody on
// foot, you. Two of them waiting on each other: the older goes
function pitRoom(c) {
  let room_ = Infinity;
  const see = (x, y, band, gap) => {
    const rx = rel(x - c.x), ry = rel(y - c.y), al = rx * c.hx + ry * c.hy;
    return al > 0 && al < 1.6 && Math.abs(rx * c.hy - ry * c.hx) < band ? al - gap : Infinity;
  };
  c.pitBlk = null;
  for (const o of c.near) {
    if (o === c || (o.pitBlk === c || o.blk === c) && c.v < 0.05 && o.v < 0.05 && c.id < o.id) continue;
    const x = Math.abs(c.hx * o.hy - c.hy * o.hx), g = see(o.ex, o.ey, 0.2 + 0.2 * x, 0.52 - 0.15 * x);
    if (g < room_) { room_ = g; c.pitBlk = o; }
  }
  for (const m of nearby(pplGrid, c.ex, c.ey, nearPeople)) if (!m.hidden) room_ = Math.min(room_, see(m.x, m.y, 0.15, 0.3));
  if (mode === 'walk') room_ = Math.min(room_, see(px, py, 0.17, 0.32));
  return room_;
}
// clear to pull out? Nothing at the way out, nothing coming along the main street for a good few cells, nobody on the
// pavement where it crosses
function gasClear(c) {
  const st = c.pit.st, mx = st.x0 - 0.45, my = st.y0 - 0.6, wx = st.x0 + 0.2, wy = st.y0 - 0.15;
  for (const o of cars) if (o !== c && Math.abs(rel(o.ey - my)) < 0.35 && rel(o.ex - mx) > -0.7 && rel(o.ex - mx) < 3.8) return false;
  for (const m of nearby(pplGrid, wx, wy, nearPeople)) if (!m.hidden && Math.abs(rel(m.x - wx)) < 0.45 && Math.abs(rel(m.y - wy)) < 0.25) return false;
  return !(mode === 'walk' && Math.abs(rel(px - wx)) < 0.45 && Math.abs(rel(py - wy)) < 0.25);
}
const PIT_V = 0.4, PIT_ACC = 0.8, PIT_BRAKE = 0.9;
const gasFilling = c => !!c.pit && c.pit.stage === 'fill' && !c.player && !c.parked;
function stepPit(c, dt) {
  const p = c.pit;
  c.ex = c.x; c.ey = c.y;
  if(p.dead){c.v=0;c.brake=true;if(p.hidden){c.parked=true;c.pit=null;}return;}
  if (p.stage === 'fill') { // the driver's out at the pump
    c.v = 0; c.brake = true;
    if (T > p.until) { p.stage = 'out'; p.path = gasPath(gasExitPoses(p.lane)); p.s = 0; p.go = false; }
    return;
  }
  const P = p.path;
  let vt = PIT_V;
  if (p.stage === 'in') vt = Math.min(vt, Math.max(0.03, Math.sqrt(2 * 0.6 * Math.max(0, P.total - p.s)))); // (creeping the last bit)
  else if (!p.go) { // waiting at the pavement for a gap
    if (p.s >= P.hold - 0.01) { if (gasClear(c)) p.go = true; else vt = 0; }
    else vt = Math.min(vt, Math.max(0.03, Math.sqrt(2 * 0.8 * Math.max(0, P.hold - p.s))));
  } else vt = 0.7; // (and away, smartly)
  vt = Math.min(vt, Math.max(0, (pitRoom(c) - 0.05) * 2.5));
  c.brake = vt < c.v;
  c.v = Math.max(0, c.v + clamp(vt - c.v, -PIT_BRAKE * dt, PIT_ACC * dt));
  p.s = Math.min(P.total, p.s + c.v * dt);
  placeOnPath(c);
  // stuck a long while (something left in the way): give up and get back on the road somehow, if you're not looking
  p.stuck = c.v < 0.02 && !(p.stage === 'out' && !p.go && p.s >= P.hold - 0.01) ? p.stuck + dt : 0;
  if (p.stuck > 40 && Math.hypot(rel(c.x - px), rel(c.y - py)) > 8) return gasRejoin(c);
  if (p.s < P.total - 1e-4) return;
  if (p.stage === 'in') { p.stage = 'fill'; c.v = 0; p.t0 = T; p.until = T + 8 + Math.random() * 10; }
  else gasRejoin(c);
}
function gasRejoin(c) { // back in the westbound lane of the main street, just past the way out
  const st = c.pit.st;
  c.x = worldCoord(st.x0 - 0.45); c.y = worldCoord(st.y0 - 0.6); c.hx = -1; c.hy = 0; c.ex = c.x; c.ey = c.y;
  c.pit = null; c.pitBlk = null; c.off = 0; c.offV = 0; c.pass = null; c.laneYaw = null; c.travelA = null;
  plan(c);
}
// which island a car in each lane fills up from, and which face of that island's pump looks at it (rayBox's: 3 the
// pump's south face, 4 its north)
const GAS_FILL = [[0, 4], [0, 3], [1, 3]];
