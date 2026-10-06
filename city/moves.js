// ===== on your feet: Space jumps, C held crouches, C by a bench or a seat sits you down (C again, or walk, to get
// up). On the skateboard Space pops an ollie, and what you're holding as you pop makes it a trick: A kickflip,
// D heelflip, S pop shuvit, A+S 360 flip, D+S varial heelflip. Or, without touching where you're going, flick for it:
// hold the right mouse button and flick (left kickflip, right heelflip, back shuvit, back-left 360 flip, back-right
// varial heelflip, forward-left hardflip, forward-right inward heelflip, or straight forward ollie) and let go to pop;
// on a phone, swipe off the Ollie button the same
// way. The board under you is a little 3D model in front of the camera (like a held weapon), so it really flips and spins.
// Bunny hopping: jump again the moment you land (press Space just before or just after you touch down) and each hop
// carries you a bit faster; turn the way you're strafing while you're in the air (A + mouse left, D + mouse right)
// and it builds quicker. Stay on the ground and the speed's gone in a moment.
const HOP_GAIN = 0.06, HOP_STRAFE = 0.12, HOP_MAX = 1.9, HOP_BUF = 0.14, HOP_GRACE = 0.1; // speed x per hop, x more for a good strafe, cap, s early
const GRAV = 9.8, JUMP_V = 3.4, POP_V = 3.3, SIT_H = 0.55, CROUCH_H = 0.7, BOARD_H = 0.1; // metres
// [name, flips (+ kick, - heel), body turns of the board]
const TRICKS = { A: ['kickflip', 1, 0], D: ['heelflip', -1, 0], S: ['pop shuvit', 0, 0.5], AS: ['360 flip', 1, 1], DS: ['varial heelflip', -1, 0.5],
  WA: ['hardflip', 1, 0.5], WD: ['inward heelflip', -1, -0.5] };
const onFootMode = () => mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
const skatingNow = () => fx.skating && mode === 'walk';
const wheelsRolling = () => fx.skating && !body.z && !body.vz && !!(K.KeyW || K.KeyS || K.KeyA || K.KeyD); // (the roar: on the ground, going somewhere)

// a flick (screen pixels: x right, y down) to the trick it calls for: the nearest of the eight directions
const FLICK_DIRS = [['A', -1, 0], ['D', 1, 0], ['S', 0, 1], ['AS', -0.71, 0.71], ['DS', 0.71, 0.71],
  ['WA', -0.71, -0.71], ['WD', 0.71, -0.71], ['', 0, -1]];
function flickTrick(dx, dy, min = 20) {
  const d = Math.hypot(dx, dy);
  if (d < min) return '';
  let best = '', bd = -Infinity;
  for (const [k, fx_, fy_] of FLICK_DIRS) { const dot = (dx * fx_ + dy * fy_) / d; if (dot > bd) { bd = dot; best = k; } }
  return best;
}
const trickName = key => (TRICKS[key] || ['ollie'])[0];

function jump(trick) { // trick: a TRICKS key from a flick; otherwise it's read off A / D / S
  if (body.z > 0 || body.vz > 0) { body.buf = T; return; } // (in the air: it'll go off when you land, see stepBody)
  if (body.seat) return standUp();
  body.buf = -9;
  if (skatingNow()) {
    const key = trick ?? (K.KeyA ? 'A' : K.KeyD ? 'D' : '') + (K.KeyS ? 'S' : ''), [name, flip, turn] = TRICKS[key] || ['ollie', 0, 0];
    body.vz = POP_V; body.trick = { name, flip, turn, t: 0, air: 2 * POP_V / GRAV };
  } else {
    if (T - (body.landedAt ?? -9) <= HOP_GRACE && Math.hypot(body.mx || 0, body.my || 0) > 0.05)
      body.hop = Math.min(HOP_MAX, (body.hop || 1) + HOP_GAIN + Math.min(HOP_STRAFE, (body.landingSwirl || 0) * 0.15));
    body.landedAt = -9; body.vz = JUMP_V;
  }
  if (actx) sfxUse(skatingNow() ? 'ollie' : 'kick');
}
// a seat within reach: a bench (indoors or out) or a cinema seat. {x, y, fx, fy}: where you sit and which way you face
function nearSeat() {
  if (mode === 'room') {
    let best = null, bd = 1.1;
    for (const s of room.props) {
      const r = s.seatRow, sy = r ? r.y : s.y;
      if (!s.bench && !s.seat && !r) continue;
      const sx = r ? freeOnRow(r) : s.x;
      if (sx == null) continue; // (a full bench)
      const d = Math.hypot((r ? clamp(px, r.x0, r.x1) : sx) - px, sy - py); // (how near the bench is: a step along it to a free spot doesn't count)
      if (d < bd) { bd = d; best = { x: sx, y: sy, fx: r ? r.fx : s.fx, fy: r ? r.fy : s.fy }; }
    }
    return best;
  }
  if (mode !== 'walk' || fx.skating) return null;
  let best = null, bd = 0.15;
  for (const b of benchesB[bi(Math.floor(px / 8), Math.floor(py / 8))]) { const d = Math.hypot(rel(b.x - px), rel(b.y - py)); if (d < bd) { bd = d; best = b; } }
  if (!best && gardenLawn(px, py)) best = { x: px, y: py, fx: Math.cos(a), fy: Math.sin(a), grass: true }; // down on the grass, facing where you were
  return best;
}
// where along a row of seats (a bench on the subway, the cinema's) you'd sit: nearest you, but not in somebody's lap
function freeOnRow(r) {
  const took = room.props.filter(o => (o.art === ART.sitter || o.art === ART.sitterBack) && Math.abs(o.y - r.y) < 0.3 && o.x > r.x0 - 0.6 && o.x < r.x1 + 0.6).map(o => o.x);
  const ok = x => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && took.every(t => Math.abs(t - x) >= 0.55 - 1e-6);
  const want = clamp(px, r.x0, r.x1);
  if (ok(want)) return want;
  const opts = took.flatMap(t => [t - 0.55, t + 0.55]).filter(ok);
  return opts.length ? opts.reduce((m, x) => Math.abs(x - want) < Math.abs(m - want) ? x : m) : null;
}
function sitDown() {
  const s = nearSeat();
  if (!s) return false;
  body.seat = { ...s, from: [px, py] }; px = s.x; py = s.y; a = Math.atan2(s.fy, s.fx); pitch = s.grass ? -0.4 : 0; // (on the grass: looking down at the picnic)
  say(s.grass ? 'You sit down on the grass.' : 'You sit down.', 1.5);
  return true;
}
function standUp() { // back where you sat down from (it was walkable)
  [px, py] = body.seat.from; body.seat = null;
}
// every frame: gravity, the crouch easing in and out, a trick's progress, landing (and how hard: see needs.js), a hop
function stepBody(dt) {
  const ground = mode === 'walk' ? architectureGroundHeight(px, py) : 0;
  if (body.groundMode === mode && (body.z > 0 || body.vz > 0)) body.z += ((body.ground || 0) - ground) * 10;
  body.ground = ground; body.groundMode = mode;
  const da = mod(a - (body.lastA ?? a) + Math.PI, Math.PI * 2) - Math.PI, moved = Math.hypot(rel(px - (body.lx ?? px)), rel(py - (body.ly ?? py))) > 1e-4;
  body.lastA = a; body.lx = px; body.ly = py;
  if (!onFootMode() || sleep) { body.z = body.vz = body.peak = 0; body.trick = null; body.seat = null; body.hop = 1; body.buf = body.landedAt = -9; return; }
  body.crouch += clamp((K.KeyC && !body.seat ? 1 : 0) - body.crouch, -dt * 6, dt * 6);
  if (body.z > 0 || body.vz > 0) {
    body.vz -= GRAV * dt; body.z += body.vz * dt; body.peak = Math.max(body.peak || 0, body.z);
    if (body.trick) body.trick.t += dt;
    const s = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
    if (s && Math.sign(da) === s) body.swirl = (body.swirl || 0) + Math.abs(da); // air strafing: turning into it
    if (body.z <= 0) { // landed
      const fell = body.peak, tricked = !!body.trick; body.z = body.vz = body.peak = 0;
      if (body.trick) { if (body.trick.name !== 'ollie') say(body.trick.name.toUpperCase() + '!', 1.5); body.trick = null; if (actx) sfxUse('ollie-land'); }
      if (!tricked && !skatingNow() && !body.seat && fell < 1.5 && (T - (body.buf ?? -9) < HOP_BUF)) { // straight back up: a hop
        if (moved) body.hop = Math.min(HOP_MAX, (body.hop || 1) + HOP_GAIN + Math.min(HOP_STRAFE, (body.swirl || 0) * 0.15));
        body.swirl = 0; body.buf = -9; body.vz = JUMP_V;
        if (actx) sfxUse('kick');
        return;
      }
      body.landedAt = !tricked && fell < 1.5 ? T : -9;
      body.landingSwirl = body.swirl || 0; body.swirl = 0;
      const dmg = fallHurt(fell);
      if (dmg > 0) {
        if (actx) playClip('ground-impact', 0.32);
        if (hurt(dmg)) passOut(`You fell ${Math.round(fell)} metres. Somebody called an ambulance. You're lucky to be alive.`);
        else say(fell > 15 ? 'You hit the ground hard. Something in your ankle goes crunch.' : 'Oof. You land hard.', 3);
      }
    }
  } else if (T - (body.landedAt ?? -9) > HOP_GRACE) body.hop = Math.max(1, (body.hop || 1) - dt * 4); // on the ground: the speed bleeds off
}

// ---- roofs: no invisible walls. Step across onto the roof next door if it's about level (a storey up or down,
// near enough), walk off any edge and fall (a long way down hurts), and jump the gap to one close by (an ordinary jump:
// a street's too far, unless you come at it hopping). A wall you're not above stops you, and you
// slide down it. The stairs are only on the roof you came up; any other roof has a fire escape down to the street.
const ROOF_STEP = 0.35; // cells: 3.5m
let roofLot = null; // the cells of the roof you came up onto (where the stairs down are)
function roofCells(mx, my) { // the flat roof round (mx, my): its cells, all the same height
  const h = map[idx(mx, my)], out = new Set([idx(mx, my)]), todo = [[mx, my]];
  while (todo.length && out.size < 80) {
    const [x, y] = todo.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = idx(x + dx, y + dy); if (!out.has(k) && map[k] === h) { out.add(k); todo.push([x + dx, y + dy]); } }
  }
  return out;
}
const roofHeightAt = (x, y) => Math.max(map[idx(Math.floor(x), Math.floor(y))], museumRoofHeight(x, y), belleRoofHeight(x, y), architectureRoofHeight(x, y), landmarkRoofHeight(x, y), pavilionRoofHeight(x, y), homeBalconyHeight(x, y));
const roofFixed = () => !!room && room.kind === 'cathedral'; // (the bell tower: just the one way down)
function roofFree(x, y) { // can you be at (x, y) on the roofs? Anywhere whose top isn't above your feet (and a step)
  if (homeBalconyActive()) return homeBalconyFree(x,y);
  const h = roofHeightAt(x, y);
  if (roofFixed()) return h === roofH && !landmarkTowerBlocked(x,y,roofH);
  return h <= roofH + ROOF_STEP + body.z / 10;
}
const overRoof = (x, y) => { const h = roofHeightAt(x, y); return h > 0 && body.z > 0 && h * 10 <= body.z; }; // in the air, above a building
// your feet moved `dz` metres relative to the ground under them (a step down is +, onto something higher is -)
function shiftFeet(dz) { body.z = Math.max(1e-3, body.z + dz); body.peak = (body.peak || 0) + Math.min(0, dz); } // (it lands next frame, counting the fall right)
function stepRoof() { // onto another roof, off them altogether, or (falling past one) down onto it
  if (mode === 'walk' && overRoof(px, py)) { // came down on a roof
    const h = roofHeightAt(px, py);
    mode = 'roof'; roofH = h; shiftFeet(-h * 10); notePoliceRoofEntry(px, py); room = null; roofLot = new Set(); return;
  }
  if (mode !== 'roof' || roofFixed()) return;
  const h = roofHeightAt(px, py);
  if (h === roofH) return;
  if (h > 0) {
    const followingSlope = (museumRoofHeight(px, py) > 0 || belleRoofHeight(px, py) > 0 || architectureRoofHeight(px, py) > 0 || landmarkRoofHeight(px, py) > 0 || pavilionRoofHeight(px, py) > 0) && !body.z && Math.abs(roofH - h) <= ROOF_STEP;
    if (!followingSlope) shiftFeet((roofH - h) * 10);
    roofH = h; return;
  }
  shiftFeet(roofH * 10); mode = 'walk'; room = null; roofH = 0; roofLot = null; // down to the street
}
const onRoofLot = () => !roofLot || roofLot.has(idx(Math.floor(px), Math.floor(py)));
// any other roof: the fire escape, down the side of the building to the nearest bit of sidewalk
function fireEscape() {
  const start = [Math.floor(px), Math.floor(py)], seen = new Set([idx(...start)]), todo = [start];
  for (let n = 0; n < todo.length && n < 600; n++) {
    const [x, y] = todo[n];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = idx(nx, ny);
      if (seen.has(k)) continue; seen.add(k);
      if (map[k]) { todo.push([nx, ny]); continue; } // still building: keep looking
      if (isWater(nx + 0.5, ny + 0.5)) continue;
      const spots = [[nx + 0.5 - dx * 0.35, ny + 0.5 - dy * 0.35], [nx + 0.5, ny + 0.5]]; // (close in against the wall, if there's room)
      const m0 = mode, z0 = body.z; mode = 'walk'; body.z = 0; // (asked as if already down there)
      const at = spots.find(([sx, sy]) => free(sx, sy));
      mode = m0; body.z = z0;
      if (!at) continue;
      mode = 'walk'; room = null; roofH = 0; roofLot = null; body.z = body.vz = body.peak = 0;
      [px, py] = at; a = Math.atan2(dy, dx); // facing away from the building
      return true;
    }
  }
  return false;
}
// standing at the edge facing a drop bigger than a step: how far it is (metres), or 0
function edgeDrop() {
  if (mode !== 'roof' || roofFixed()) return 0;
  const h = roofHeightAt(px + Math.cos(a) * 0.45, py + Math.sin(a) * 0.45);
  return h < roofH - ROOF_STEP ? Math.round((roofH - h) * 10) : 0;
}
// how far your eyes are off standing height (metres): up in a jump, down crouching or sitting, up a little on the board
const eyeLift = () => onFootMode() ? body.z + (skatingNow() ? BOARD_H : 0) - (body.seat ? SIT_H : body.crouch * CROUCH_H) : 0;
const footSlow = () => body.crouch > 0.5 ? 0.45 : 1;

// ---- the board under your feet, in camera space: x right, y down, z ahead (metres), drawn into the character grid
// point by point with its own depth test. Grip tape on top, a coloured graphic underneath, trucks and wheels.
const BOARD_L = 0.4, BOARD_W = 0.105, BOARD_T = 0.025;
let boardZ = new Float32Array(1 << 14); // (grows to fit the screen)
function drawBoard3D() {
  const tr = body.trick, p = tr ? clamp(tr.t / tr.air, 0, 1) : 0, e = p * p * (3 - 2 * p); // eased through the air
  const roll = tr ? e * tr.flip * Math.PI * 2 : 0, yaw = tr ? e * tr.turn * Math.PI * 2 : 0;
  const nose = tr ? Math.sin(Math.min(1, p * 4) * Math.PI) * 0.35 : 0; // the pop: nose up for an instant
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, bob = moving ? Math.sin(T * 9) * 0.004 : 0;
  const cy = eye * 10 - BOARD_H - body.z - (tr ? Math.sin(p * Math.PI) * 0.12 : 0) + bob; // Ground height uses the same camera projection as the street.
  const cz = 1.7;
  const sr = Math.sin(roll), cr = Math.cos(roll), sw = Math.sin(yaw), cw_ = Math.cos(yaw), sp = Math.sin(nose), cp = Math.cos(nose);
  const pX = projX, pY = projY;
  const ox = cols / 2, oy = hor; // anchored to the horizon: looking up carries it out of view
  const n = cols * rows; if (boardZ.length < n) boardZ = new Float32Array(n); boardZ.fill(1e9, 0, n);
  // a point on the board (u along, v across, h up) to the screen
  const plot = (u, v, h, ch, col, bg) => {
    let y1 = v * cr - h * sr, h1 = v * sr + h * cr; // the flip, round the long axis
    let u1 = u * cw_ - y1 * sw, v1 = u * sw + y1 * cw_; // the shuvit, round the vertical
    const u2 = u1 * cp - h1 * sp, h2 = u1 * sp + h1 * cp; // the pop
    const X = v1, Y = cy - h2, Z = cz + u2;
    if (Z < 0.2) return;
    const c = Math.round(ox + X / Z * pX), r = Math.round(oy + Y / Z * pY);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const i = r * cols + c;
    if (Z >= boardZ[i]) return;
    boardZ[i] = Z; set(i, ch, col); BG[i] = bg; FOGS[i] = FOGB[i] = 0;
  };
  const step = 0.012;
  for (let u = -BOARD_L; u <= BOARD_L; u += step) for (let v = -BOARD_W; v <= BOARD_W; v += step / 2) {
    const end = Math.abs(u) > BOARD_L - 0.06, w = end ? Math.sqrt(Math.max(0, 1 - ((Math.abs(u) - BOARD_L + 0.06) / 0.06) ** 2)) * BOARD_W : BOARD_W; // rounded nose and tail
    if (Math.abs(v) > w) continue;
    const edge = Math.abs(v) > w - 0.012;
    plot(u, v, BOARD_T / 2, edge ? '=' : ':', edge ? C(BRICK, 13) : C(GRAY, 7), edge ? C(BRICK, 4) : C(GRAY, 0)); // grip tape
    const stripe = Math.floor((u + BOARD_L) * 6) & 1;
    plot(u, v, -BOARD_T / 2, edge ? '=' : '#', edge ? C(BRICK, 13) : C(stripe ? RED : YEL, 14), C(stripe ? RED : YEL, 5)); // the graphic underneath
  }
  for (const tu of [-0.27, 0.27]) { // trucks and wheels
    for (let v = -0.09; v <= 0.09; v += 0.01) plot(tu, v, -BOARD_T / 2 - 0.03, '-', C(GRAY, 12), C(GRAY, 3));
    for (const wv of [-0.1, 0.1]) for (let dh = 0; dh < 0.05; dh += 0.01) plot(tu, wv, -BOARD_T / 2 - 0.035 - dh, 'O', C(WHITE, 15), C(GRAY, 4));
  }
}
