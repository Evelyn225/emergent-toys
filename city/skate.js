// ===== the skateboard, played the way the old skateboarding games played it: you see your skater from behind, the
// camera trailing a little above, and the board handles like something you drive. W kicks (each push adds speed, up to
// what pushing can give; Shift pushes harder), S drags a foot to slow you, A and D carve. Space crouches to load an
// ollie and pops it as you let go (held longer, higher). Hold an arrow as you pop, or tap one in the air, for a flip
// trick: left kickflip, right heelflip, down pop shuvit, down-left 360 flip, down-right varial heelflip, up-left
// hardflip, up-right inward heelflip (or flick for one with the right mouse button). In the air A and D spin you:
// come down rolling straight, or backwards (and ride away switch), and it counts; come down sideways, or mid-flip, or
// hit a wall going fast, and you bail. Pop again soon after landing and the tricks chain into a combo, worth its points
// times how many; a bail loses it. The mouse looks round (the camera swings back behind you); V: your own eyes.
// Units: cells (10m), seconds, radians, as everywhere outdoors.
const SK_PUSH = 0.75, SK_TOP = 0.9, SK_RUN_TOP = 1.2, SK_ROLL = 0.05, SK_BRAKE = 1.3, SK_SPIN = 7.5, SK_LAND = 0.6, SK_CHARGE = 0.6;
const SK_STILL = 0.12; // (slower than this, a messy landing is only a hop: nothing to fall off)
const SK_CAM_BACK = 0.42, SK_CAM_UP = 0.17, SK_CAM_SIDE = 0.35, SK_COMBO_GAP = 0.9, SK_BAIL_T = 1.3;
// v: speed; dir: the way you're rolling (in the air, the way you left the ground: a spins, dir doesn't); spin: how
// far round you've turned since the pop; stance: which side you face (+1 right of where you're going, regular);
// kick: the push in progress (0..1), charge: when Space went down (-1: it isn't), combo: { names, pts, t }
const SK = { v: 0, dir: 0, spin: 0, stance: 1, steer: 0, kick: 0, kicking: false, charge: -1, popT: -9, bail: 0, bailAt: null,
  trickKeyT: -1, look: 0, lookT: -9, camYaw: null, camZ: null, camBack: 0, camSide: 1, lastT: -9, combo: null, score: 0, best: 0 };
let skateView = null; // while the frame's drawn from behind you: { x, y, a } (where you really are) and the camera's eye
const skateCamOn = () => skatingNow() && third && !freecam;
const skateAir = () => body.z > 0 || body.vz > 0;
// the arrows held down, as a TRICKS key (moves.js)
function arrowTrick() {
  const l = K.ArrowLeft, r = K.ArrowRight;
  if (K.ArrowUp) return l ? 'WA' : r ? 'WD' : '';
  return (l ? 'A' : r ? 'D' : '') + (K.ArrowDown ? 'S' : '');
}
const SK_POINTS = { ollie: 50, kickflip: 100, heelflip: 100, 'pop shuvit': 100, '360 flip': 300, 'varial heelflip': 250, hardflip: 250, 'inward heelflip': 250 };

// every frame on the board, in place of walking
function stepSkate(dt) {
  if (T - SK.lastT > 0.25) { // just stepped on: rolling off at whatever pace you were walking
    Object.assign(SK, { v: Math.min(SK_TOP, Math.hypot(body.mx || 0, body.my || 0)), dir: a, spin: 0, stance: 1, kick: 0, charge: -1, bail: 0, bailAt: null, combo: null, look: 0, camYaw: null, camZ: null });
    if (third) pitch = -0.12;
  }
  SK.lastT = T;
  if (SK.bail > 0) { // picking yourself up
    SK.bail -= dt; SK.v = 0; body.mx = body.my = 0;
    if (SK.bail <= 0) { SK.bailAt = null; a = SK.dir; }
    return;
  }
  const air = skateAir(), f = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0), s = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
  SK.steer = s; SK.kicking = false;
  if (SK.charge >= 0 && !K.Space) SK.charge = -1; // (let go somewhere it couldn't pop: the menu, say)
  if (air) { a += s * SK_SPIN * dt; SK.spin += s * SK_SPIN * dt; } // spinning: the way you're going stays put
  else {
    const top = (K.ShiftLeft || K.ShiftRight ? SK_RUN_TOP : SK_TOP) * (fx.caffeine > 0 ? 1.1 : 1);
    if (f > 0 && SK.charge < 0 && (SK.v < top - 0.01 || SK.kick > 0)) { // a push: a foot down, kicking along
      SK.kicking = true; SK.kick += dt / 0.7;
      if (SK.kick >= 1) SK.kick = 0;
      if (SK.kick > 0.15 && SK.kick < 0.6) SK.v = Math.min(top, SK.v + SK_PUSH * 2.2 * dt);
    } else SK.kick = 0;
    SK.v = Math.max(0, SK.v - (f < 0 ? SK_BRAKE : SK_ROLL + SK.v * 0.05) * dt);
    a += s * (2.6 - 1.3 * Math.min(1, SK.v / SK_TOP)) * dt; // carving: tighter slow, wider fast
    SK.dir = a;
  }
  // arrows tapped in the air: a flip trick, once the rest of the chord's had a moment to come down
  if (SK.trickKeyT >= 0 && T - SK.trickKeyT > 0.07) {
    SK.trickKeyT = -1;
    if (air && !body.trick) { const [name, flip, turn] = TRICKS[arrowTrick()] || ['ollie', 0, 0]; if (name !== 'ollie') body.trick = { name, flip, turn, t: 0, air: 0.45 }; }
  }
  const want = SK.v * dt, x0 = px, y0 = py;
  move(Math.cos(SK.dir) * want, Math.sin(SK.dir) * want);
  const mx = rel(px - x0), my = rel(py - y0), got = Math.hypot(mx, my);
  if (dt > 0) { body.mx = mx / dt; body.my = my / dt; }
  if (want > 1e-6 && got < want * 0.98) { // something in the way: scrape along it, or stop dead
    const lost = SK.v * (1 - got / want);
    SK.v *= got / want;
    if (got > 1e-6) { SK.dir = Math.atan2(my, mx); if (!air) a = SK.dir; }
    if (lost > 0.45) return skateBail('BAIL! Straight into it.');
  }
  if (SK.combo && !air && T - SK.combo.t > SK_COMBO_GAP) bankCombo();
}
// Space on the board: down crouches, up pops (or a tap off the touch button, or a flick: straight away)
function skateSpace(down) {
  if (SK.bail > 0 || skateAir()) { if (!down) SK.charge = -1; return; }
  if (down) { if (SK.charge < 0) SK.charge = T; return; }
  if (SK.charge >= 0) skatePop();
}
function skatePop(trick) {
  if (SK.bail > 0 || skateAir()) return;
  const load = SK.charge >= 0 ? clamp((T - SK.charge) / SK_CHARGE, 0, 1) : 0, key = trick ?? arrowTrick(), [name, flip, turn] = TRICKS[key] || ['ollie', 0, 0];
  SK.charge = -1; SK.dir = a; SK.spin = 0; SK.popT = T; SK.trickKeyT = -1;
  body.vz = POP_V * (1 + 0.35 * load); body.trick = { name, flip, turn, t: 0, air: 2 * body.vz / GRAV };
  if (actx) sfxUse('ollie');
}
function skateArrow() { if (skateAir() && !body.trick && SK.trickKeyT < 0) SK.trickKeyT = T; }
// back on the ground (stepBody): rolling away clean, or not
function skateLand() {
  if (SK.bail > 0) return; // (already down: hit a wall on the way up)
  const tr = body.trick, d = mod(a - SK.dir + Math.PI, Math.PI * 2) - Math.PI, st0 = SK.stance;
  const flubbed = tr && tr.t < tr.air * 0.8, sideways = Math.abs(d) > SK_LAND && Math.PI - Math.abs(d) > SK_LAND;
  if ((flubbed || sideways) && SK.v < SK_STILL) { SK.dir = a; SK.spin = 0; return; } // (standing still: you just come down where you are, facing however you ended up)
  if (flubbed) return skateBail('BAIL! Your feet never found the board.');
  if (sideways) return skateBail('BAIL! You came down sideways.');
  if (Math.abs(d) > Math.PI / 2) SK.stance = -SK.stance; // backwards: riding away switch
  a = SK.dir;
  const deg = Math.round(Math.abs(SK.spin) / Math.PI) * 180, name = tr ? tr.name : 'ollie';
  const side = deg ? (Math.sign(SK.spin) === -st0 ? 'FS ' : 'BS ') + deg : ''; // frontside: turning chest first
  const label = (side + (name !== 'ollie' || !side ? ' ' + name : '')).trim().toUpperCase();
  const pts = Math.round((SK_POINTS[name] || 50) + deg / 180 * 150 + Math.max(0, T - SK.popT) * 60);
  const c = SK.combo ||= { names: [], pts: 0, t: T };
  c.names.push(label); c.pts += pts; c.t = T;
  say(c.names.length > 1 ? `${c.names.join(' + ')}  ${c.pts} x ${c.names.length}` : `${label}!  ${pts}`, 2);
  SK.spin = 0;
}
function bankCombo() {
  const c = SK.combo, total = c.pts * c.names.length;
  SK.combo = null; SK.score += total; SK.best = Math.max(SK.best, total);
  if (c.names.length > 1) say(`${c.names.length}-TRICK COMBO!  ${total}`, 2);
}
function skateBail(msg) {
  SK.bail = SK_BAIL_T; SK.bailAt = [px, py, SK.dir, a]; SK.v = 0; SK.spin = 0; SK.combo = null; SK.charge = -1; body.trick = null;
  say(msg, 2);
  if (actx) playClip('ground-impact', 0.25);
}

// ---- the camera: behind you, a little above and round to the side you face, swinging after you (not while you spin).
// A wall in the way: first it gives up the side, then it comes in closer, and lower, to keep you in the picture.
// Returns [x, y, yaw, eye]
// (on a narrow screen, a phone held upright, it comes in closer: the view's as wide as ever, so you'd be a speck)
const skateCamBack = () => SK_CAM_BACK * clamp(cv.width / cv.height / 1.6, 0.4, 1);
function skateClear(yaw) { // how far back from you the camera can go that way
  const bx = Math.cos(yaw), by = Math.sin(yaw), most = skateCamBack();
  let back = 0;
  for (let step = 0.02; step <= most + 1e-9; step += 0.02) {
    const x = px - bx * step, y = py - by * step;
    if ([-0.03, 0.03].some(ox => [-0.03, 0.03].some(oy => map[idx(Math.floor(x + ox), Math.floor(y + oy))] > 0.28 || architectureBlocked(x + ox, y + oy) || landmarkBlocked(x + ox, y + oy)))) break;
    back = step;
  }
  return back;
}
function skateCam(dt) {
  const fresh = SK.camYaw == null, air = skateAir(), ease = k => fresh ? 1 : 1 - Math.exp(-k * dt);
  if (T - SK.lookT > 1) SK.look *= 1 - Math.min(1, dt * 2.5);
  const base = (SK.bail > 0 ? SK.bailAt[2] : air ? SK.dir : a) + SK.look, side = base - SK.stance * SK_CAM_SIDE;
  SK.camSide = (fresh ? 1 : SK.camSide ?? 1) + ((skateClear(side) > skateCamBack() * 0.9 ? 1 : 0) - (SK.camSide ?? 1)) * ease(3);
  const target = base - SK.stance * SK_CAM_SIDE * SK.camSide;
  if (fresh) SK.camYaw = target;
  SK.camYaw += (mod(target - SK.camYaw + Math.PI, 2 * Math.PI) - Math.PI) * ease(4);
  const room_ = skateClear(SK.camYaw); // (in at once, back out gently)
  SK.camBack = fresh || room_ < SK.camBack ? room_ : SK.camBack + (room_ - SK.camBack) * ease(2);
  const want = walkGround(px, py) + 0.12 + (SK_CAM_UP - 0.12) * Math.min(1, SK.camBack / SK_CAM_BACK) + body.z / 10 * 0.6;
  SK.camZ = fresh || SK.camZ == null ? want : SK.camZ + (want - SK.camZ) * ease(6);
  return [worldCoord(px - Math.cos(SK.camYaw) * SK.camBack), worldCoord(py - Math.sin(SK.camYaw) * SK.camBack), SK.camYaw, SK.camZ];
}

// ---- you and the board, drawn into the city (citySprites) while the camera's behind you
// the board, a bit bigger than life (as the old games drew it: real size, it's lost under a grown-up seen from behind).
// k: how much bigger. The deck: half length, width, thickness; its middle this high; the kicktails; trucks this far
// along from the middle; your height on it
const SB_K = 1.55, SB = { k: SB_K, hl: 0.04 * SB_K, hw: 0.0105 * SB_K, ht: 0.0012 * SB_K, up: 0.0085 * SB_K, tail: 0.006 * SB_K, truck: 0.027 * SB_K, rider: 0.165 };
let skaterLookMemo = null, skaterLookKey = '';
// the ink each tattoo is done in (the newest one shows): the rest is blackwork
const TATTOO_INK = { tattoo_swallow: [BLUE, 6], tattoo_anchor: [BLUE, 5], tattoo_rose: [RED, 7], tattoo_dagger: [RED, 6], tattoo_panther: [GRAY, 2], tattoo_koi: [ORANGE, 9] };
// whoever you are: a beanie, short hair under it, a long-sleeved tee, jeans and white sneakers. Got some ink? Then
// a short-sleeved tee, to show it off: the more hours you've sat for, the more of your arms it covers
function skaterLook() {
  const key = tattoos.join(',');
  if (skaterLookMemo && key === skaterLookKey) return skaterLookMemo;
  const hours = tattoos.reduce((s, id) => s + ITEMS[id].hours, 0);
  skaterLookKey = key;
  return skaterLookMemo = figLook({ hair: 'short', hat: 'beanie', top: hours ? 'tee' : 'long', bot: 'pants', bw: 1, ink: hours ? Math.round(clamp(hours / 10, 0.2, 1) * 10) / 10 : 0,
    col: { hair: [BRICK, 4], skin: [SKIN, 11], hat: [ORANGE, 11], hatD: [ORANGE, 7], top: [GREEN, 7], bot: [BLUE, 5], shoe: [WHITE, 13], belt: [GRAY, 2],
           ink: hours ? TATTOO_INK[tattoos[tattoos.length - 1]] : undefined } });
}
function drawSkateBoard(vx, vy, z, yaw, nose, roll) {
  const F = craftFrame(yaw, nose, roll), o = [vx, vy, z + SB.up + Math.abs(Math.sin(roll)) * SB.hw * 0.9]; // (on its edge mid-flip it stands taller)
  const deck = (i, t, L) => {
    if (HIT.face === 5) { // black grip tape, the maple showing round its edge (so it reads on dark asphalt)
      if (Math.abs(HIT.v) > SB.hw * 0.7) { BG[i] = C(YEL, 3 + L * 0.45); return set(i, '=', C(BRICK, L)), true; }
      BG[i] = C(GRAY, 0.3 + L * 0.05); return set(i, fract(HIT.u * 300) < 0.5 ? ':' : '.', C(GRAY, L * 0.3)), true;
    }
    if (HIT.face === 6) { const stripe = Math.floor((HIT.u / SB.hl + 1) * 3) & 1; BG[i] = C(stripe ? RED : YEL, 2.5 + L * 0.6); return set(i, ' ', 0), true; } // its graphic
    BG[i] = C(YEL, 3 + L * 0.45); return set(i, '=', C(BRICK, L)), true; // the ply
  };
  const box = (Fr, c, ef, er, eu, shade) => drawOBox(c[0], c[1], c[2], [Fr.f, Fr.r, Fr.u], [ef, er, eu], shade);
  box(F, o, SB.hl, SB.hw, SB.ht, deck);
  for (const e of [1, -1]) { // the kicktails, turned up at each end
    const Ft = craftFrame(yaw, nose + e * 0.45, roll), end = at(o, F, e * SB.hl, 0, 0);
    box(Ft, at(end, Ft, e * SB.tail * 0.9, 0, 0), SB.tail, SB.hw * 0.85, SB.ht, deck);
  }
  const metal = (i, t, L) => { BG[i] = C(GRAY, 2 + L * 0.5); return set(i, '-', C(WHITE, L * 0.7)), true; };
  const wheel = (i, t, L) => { BG[i] = C(WHITE, 5 + L * 0.7); return set(i, 'o', C(GRAY, L * 0.4)), true; };
  for (const e of [1, -1]) {
    const k = SB.k;
    box(F, at(o, F, e * SB.truck, 0, -SB.ht - 0.0015 * k), 0.0035 * k, 0.0085 * k, 0.0015 * k, metal); // the trucks
    for (const sd of [1, -1]) box(F, at(o, F, e * SB.truck, sd * 0.0095 * k, -SB.ht - 0.0045 * k), 0.0028 * k, 0.0016 * k, 0.0028 * k, wheel);
  }
}
// ---- you, in true perspective. Anyone else is a cut-out stood at one depth and seen as if from eye level: fine for
// passers-by, but from behind and above, on a board, its feet don't land where they stand (the front foot belongs
// further off, higher up the screen, over the front truck), and from a little to the side you'd seem to stand on the
// end of the deck. So each pixel of your sprite goes where its bit of you really is: the sprite for this angle (one
// of SK_VIEWS round you) remembers how near each pixel's surface is, toward whoever's looking.
const SK_VIEWS = 32;
function skaterSprite(look, key, view) {
  const id = look.shape + '|' + key + '|sk' + view;
  let s = figCache.get(id);
  if (!s) {
    const bid = look.shape + '|' + key;
    let fb = figCache.get(bid);
    if (!fb) figCache.set(bid, fb = figBody(look, key));
    const near = new Float32Array(FIG_W * FIG_H);
    figCache.set(id, s = { role: figRasterAt(fb, view / SK_VIEWS * Math.PI * 2, near), near });
  }
  return s;
}
// as drawFigure: (rx, ry) from the camera, standing on z0, h tall, facing (fx, fy), a figPose key, least brightness
function drawSkaterFigure(rx, ry, z0, h, fx, fy, look, key, light = 5) {
  const d0 = Math.hypot(rx, ry) || 1, vx = -rx / d0, vy = -ry / d0;
  const view = mod(Math.round(Math.atan2(vx * -fy + vy * fx, vx * fx + vy * fy) / (Math.PI * 2) * SK_VIEWS), SK_VIEWS);
  const { role, near } = skaterSprite(look, key, view), th = view / SK_VIEWS * Math.PI * 2, unit = h / FIG_TALL;
  // the sprite's two directions in the world: across it (left to right as drawn), and toward the viewer
  const toW = (bx, by) => [-fy * bx + fx * by, fx * bx + fy * by]; // (body frame: x their right, y ahead)
  const [ax, ay] = toW(-Math.cos(th), Math.sin(th)), [nx, ny] = toW(Math.sin(th), Math.cos(th));
  for (let r = 0; r < FIG_H; r++) for (let c = 0; c < FIG_W; c++) {
    const k = role[r * FIG_W + c];
    if (!k) continue;
    const u = c - (FIG_W - 1) / 2, n = near[r * FIG_W + c], X = rx + (ax * u + nx * n) * unit, Y = ry + (ay * u + ny * n) * unit, Z = z0 + (FIG_H - r - 0.5) * unit;
    const depth = dx * X + dy * Y;
    if (depth < 0.05 || depth > vis) continue;
    const col = cols / 2 + (-dy * X + dx * Y) * projX / depth, row = hor - (Z - eye) * projY / depth;
    const hu = unit * projX / depth * 0.55, hz = unit * projY / depth * 0.55; // (half a pixel and a touch more: no gaps)
    let c0 = Math.ceil(col - hu - 0.5), c1 = Math.floor(col + hu - 0.5), r0 = Math.ceil(row - hz - 0.5), r1 = Math.floor(row + hz - 0.5);
    if (c1 < c0) c0 = c1 = Math.floor(col); // (smaller than a cell: the cell it's in)
    if (r1 < r0) r0 = r1 = Math.floor(row);
    const ro = hu < 0.5 || hz < 0.5 ? FIG_COARSE[k] || k : k, L = (1 - depth / vis) * 15 * amb, lit = clamp(0.32 + Math.max(light, L) / 15 * 0.78, 0.32, 1);
    for (let rr = Math.max(0, r0); rr <= Math.min(rows - 1, r1); rr++) for (let cc = Math.max(0, c0); cc <= Math.min(cols - 1, c1); cc++) {
      const i = rr * cols + cc;
      if (depth >= ZB[i]) continue;
      BG[i] = C(look.base[ro], look.lvl[ro] * lit); set(i, ' ', 0); ZB[i] = ZBG[i] = depth; FL[i] = 0;
    }
  }
}
// your shadow on the ground, under the board: how high you are, in the air
function drawSkateShadow(vx, vy, g, yaw, up) {
  const k = 1 / (1 + up * 8), F = craftFrame(yaw, 0, 0), ru = (SB.hl + 0.006) * k, rv = SB.hw * 1.6 * k;
  drawOBox(vx, vy, g + 0.0004, [F.f, F.r, F.u], [ru, rv, 0.0003], (i, t, L) => {
    if ((HIT.u / ru) ** 2 + (HIT.v / rv) ** 2 > 1) return false;
    BG[i] = C(GRAY, 0.55); return set(i, ' ', 0), true;
  });
}
function drawSkater() {
  if (!skateView) return;
  const tr = body.trick, p = tr ? clamp(tr.t / tr.air, 0, 1) : 0, e = p * p * (3 - 2 * p), look = skaterLook();
  if (SK.bailAt) { // sprawled where you came off, the board upside down a little way on
    const [bx, by, dir, ang] = SK.bailAt, g = walkGround(bx, by), [vx, vy] = R(bx, by);
    drawSkateBoard(...R(bx + Math.cos(dir) * 0.08, by + Math.sin(dir) * 0.08), g - SB.up + SB.ht, ang + 0.6, 0, Math.PI);
    return drawSkaterFigure(vx, vy, g, SB.rider, Math.cos(dir), Math.sin(dir), look, 'sprawl');
  }
  const { x, y } = skateView, [vx, vy] = R(x, y), g = walkGround(x, y), z = g + body.z / 10;
  drawSkateShadow(vx, vy, g, skateView.a, body.z / 10);
  const roll = tr ? e * tr.flip * Math.PI * 2 : 0, yaw = skateView.a + (tr ? e * tr.turn * Math.PI * 2 : 0), nose = tr ? Math.sin(Math.min(1, p * 4) * Math.PI) * 0.35 : 0;
  drawSkateBoard(vx, vy, z, yaw, nose, roll);
  const air = skateAir(), pushing = SK.kicking && !air, ang = skateView.a + (pushing ? 0 : SK.stance * Math.PI / 2);
  const pose = air || SK.charge >= 0 ? 'crouch' : pushing ? 'push' + (Math.floor(SK.kick * 8) & 7) : 'ride' + (1 + SK.steer * SK.stance);
  const feet = z + SB.up + SB.ht + (tr && (tr.flip || tr.turn) ? Math.sin(p * Math.PI) * 0.02 : 0); // (up off the deck while it flips under you)
  drawSkaterFigure(vx, vy, feet, SB.rider, Math.cos(ang), Math.sin(ang), look, pose);
}
