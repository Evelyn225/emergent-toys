// ===== on your feet: Space jumps, C held crouches, C by a bench or a seat sits you down (C again, or walk, to get
// up). On the skateboard Space pops an ollie, and what you're holding as you pop makes it a trick: A kickflip,
// D heelflip, S pop shuvit, A+S 360 flip, D+S varial heelflip. The board under you is a little 3D model in front of
// the camera (like a held weapon), so it really flips and spins.
const GRAV = 9.8, JUMP_V = 3.4, POP_V = 3.3, SIT_H = 0.55, CROUCH_H = 0.7, BOARD_H = 0.1; // metres
// [name, flips (+ kick, - heel), body turns of the board]
const TRICKS = { A: ['kickflip', 1, 0], D: ['heelflip', -1, 0], S: ['pop shuvit', 0, 0.5], AS: ['360 flip', 1, 1], DS: ['varial heelflip', -1, 0.5] };
const onFootMode = () => mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
const skatingNow = () => fx.skating && mode === 'walk';

function jump() {
  if (body.z > 0 || body.vz > 0) return;
  if (body.seat) return standUp();
  if (skatingNow()) {
    const key = (K.KeyA ? 'A' : K.KeyD ? 'D' : '') + (K.KeyS ? 'S' : ''), [name, flip, turn] = TRICKS[key] || ['ollie', 0, 0];
    body.vz = POP_V; body.trick = { name, flip, turn, t: 0, air: 2 * POP_V / GRAV };
  } else body.vz = JUMP_V;
  if (actx) sfxUse(skatingNow() ? 'board' : 'kick');
}
// a seat within reach: a bench (indoors or out) or a cinema seat. {x, y, fx, fy}: where you sit and which way you face
function nearSeat() {
  if (mode === 'room') {
    let best = null, bd = 1.1;
    for (const s of room.props) {
      const r = s.seatRow, sx = r ? clamp(px, r.x0, r.x1) : s.x, sy = r ? r.y : s.y;
      if (!s.bench && !r) continue;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bd) { bd = d; best = { x: sx, y: sy, fx: r ? r.fx : s.fx, fy: r ? r.fy : s.fy }; }
    }
    return best;
  }
  if (mode !== 'walk' || fx.skating) return null;
  let best = null, bd = 0.15;
  for (const b of benchesB[bi(Math.floor(px / 8), Math.floor(py / 8))]) { const d = Math.hypot(rel(b.x - px), rel(b.y - py)); if (d < bd) { bd = d; best = b; } }
  return best;
}
function sitDown() {
  const s = nearSeat();
  if (!s) return false;
  body.seat = { ...s, from: [px, py] }; px = s.x; py = s.y; a = Math.atan2(s.fy, s.fx); pitch = 0;
  say('You sit down.', 1.5);
  return true;
}
function standUp() { // back where you sat down from (it was walkable)
  [px, py] = body.seat.from; body.seat = null;
}
// every frame: gravity, the crouch easing in and out, a trick's progress, landing
function stepBody(dt) {
  if (!onFootMode() || sleep) { body.z = body.vz = 0; body.trick = null; body.seat = null; return; }
  body.crouch += clamp((K.KeyC && !body.seat ? 1 : 0) - body.crouch, -dt * 6, dt * 6);
  if (body.z > 0 || body.vz > 0) {
    body.vz -= GRAV * dt; body.z += body.vz * dt;
    if (body.trick) body.trick.t += dt;
    if (body.z <= 0) { // landed
      body.z = body.vz = 0;
      if (body.trick) { if (body.trick.name !== 'ollie') say(body.trick.name.toUpperCase() + '!', 1.5); body.trick = null; if (actx) sfxUse('board'); }
    }
  }
}
// how far your eyes are off standing height (metres): up in a jump, down crouching or sitting, up a little on the board
const eyeLift = () => onFootMode() ? body.z + (skatingNow() ? BOARD_H : 0) - (body.seat ? SIT_H : body.crouch * CROUCH_H) : 0;
const footSlow = () => body.crouch > 0.5 ? 0.45 : 1;

// ---- the board under your feet, in camera space: x right, y down, z ahead (metres), drawn into the character grid
// point by point with its own depth test. Grip tape on top, a coloured graphic underneath, trucks and wheels.
const BOARD_L = 0.4, BOARD_W = 0.105, BOARD_T = 0.025;
const boardZ = new Float32Array(1 << 14);
function drawBoard3D() {
  const tr = body.trick, p = tr ? clamp(tr.t / tr.air, 0, 1) : 0, e = p * p * (3 - 2 * p); // eased through the air
  const roll = tr ? e * tr.flip * Math.PI * 2 : 0, yaw = tr ? e * tr.turn * Math.PI * 2 : 0;
  const nose = tr ? Math.sin(Math.min(1, p * 4) * Math.PI) * 0.35 : 0; // the pop: nose up for an instant
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, bob = moving ? Math.sin(T * 9) * 0.004 : 0;
  const cy = 0.5 - body.z * 0.45 - (tr ? Math.sin(p * Math.PI) * 0.12 : 0) + bob, cz = 1.15; // the board lifts with you (and a bit more)
  const sr = Math.sin(roll), cr = Math.cos(roll), sw = Math.sin(yaw), cw_ = Math.cos(yaw), sp = Math.sin(nose), cp = Math.cos(nose);
  const pX = cols / 2 / Math.tan(FOV / 2), pY = pX * cw / FS, ox = cols / 2, oy = rows / 2;
  const n = cols * rows; if (boardZ.length < n) return; boardZ.fill(1e9, 0, n);
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
