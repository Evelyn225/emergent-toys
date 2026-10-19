// ===== fishing, drawn (fishing.js has the rules): the bait and tackle hut and what's piled round it, the rod in your
// hand (winding back, whipping forward, bending when something's on, the reel spinning as you wind in), the line out to
// the bobber, the bobber riding the swell, rings spreading round it, the fish coming in under the water, the strike,
// and whatever you've caught swinging off the end of the line.

// ---- the hut and its clutter (solids: props.js)
const hutWall = (i, f, L, k = 1) => { BG[i] = C(CYAN, (1 + L * 0.24) * shadeFace(f) * k); };
SOLID_SHADE.fishhut = o => (i, t, L) => {
  const f = HIT.face, w = HIT.w, u = HIT.u, v = HIT.v, glow = Math.max(night, overcast * 0.6), open = hutOpen();
  if (f === 5 || f === 6) { BG[i] = C(BRICK, 1); return set(i, ' ', 0), true; }
  const along = f >= 3 ? u : v, half = f >= 3 ? o.hl : o.hw;
  const board = hash(Math.floor(w * 30), Math.floor(along * 5 + f * 7), 1601), worn = board > 0.85; // board by board, some weathered paler
  hutWall(i, f, L, worn ? 1.25 : 0.88 + board * 0.18);
  if (half - Math.abs(along) < 0.014) { BG[i] = C(WHITE, (1.4 + L * 0.4) * shadeFace(f)); return set(i, '|', C(GRAY, L * 0.6)), true; } // corner boards
  const clap = () => set(i, fract(w * 30) < 0.2 ? '_' : ' ', C(worn ? WHITE : BLUE, L * 0.75));
  if (f === 4) { // the front, on the promenade: the hatch with him behind it, its flap propped up over it, the door, a life ring
    const hu = u - FISH_HUT.hatch;
    if (Math.abs(hu) < 0.11 && w > 0.205 && w < 0.228 && open) { BG[i] = C(fract(u * 18) < 0.5 ? RED : WHITE, 1.4 + L * 0.4); return set(i, '=', C(GRAY, L * 0.5)), true; } // the flap
    if (Math.abs(hu) < 0.1 && w > 0.095 && w < 0.205) {
      if (!open) { BG[i] = C(BRICK, 1.2 + L * 0.28); return set(i, Math.abs(hu) < 0.008 && Math.abs(w - 0.15) < 0.01 ? 'o' : fract(u * 30) < 0.15 ? '|' : ' ', C(Math.abs(hu) < 0.008 ? YEL : BRICK, L * 0.8)), true; } // shuttered
      if (w < 0.108) { BG[i] = C(BRICK, 1.4 + L * 0.3); return set(i, '=', C(WARM, L * 0.9)), true; } // the counter
      if (ZB[i] >= 0 && ZB[i] < t + 2 * o.hw) { BG[i] = BG_UNSET; return false; } // him, inside
      BG[i] = C(GRAY, 0.5 + glow * 1.5); // in the dark behind him: lures hanging off a rail, tins of bait on a shelf
      const lure = w > 0.17 && fract(u * 28) < 0.3;
      return set(i, lure ? 'jJ?'[Math.floor(u * 28) & 1 ? 1 : 0] : w < 0.13 && fract(u * 16) < 0.5 ? 'o' : ' ', C(lure ? [YEL, RED, GREEN][Math.abs(Math.floor(u * 28)) % 3] : WARM, Math.max(5, L * 0.6 + glow * 6))), true;
    }
    if (u > 0.17 && u < 0.3 && w < 0.21) { // the door: tarred planks, a porthole window, the latch
      BG[i] = C(BRICK, 1.1 + L * 0.25);
      if (u < 0.182 || u > 0.288 || w > 0.198) return set(i, '|', C(WHITE, L * 0.7)), true;
      if (Math.hypot((u - 0.235) * 1.6, w - 0.16) < 0.026) { BG[i] = glow > 0.3 && open ? C(WARM, 2 + glow * 4) : C(CYAN, 0.8 + L * 0.12); return set(i, ' ', 0), true; }
      if (Math.abs(u - 0.195) < 0.008 && Math.abs(w - 0.1) < 0.01) return set(i, 'o', C(YEL, Math.max(L, 9))), true;
      return set(i, fract(u * 60) < 0.18 ? '|' : ' ', C(BRICK, L * 0.6)), true;
    }
    const rd = Math.hypot((u + 0.3) * 1.15, w - 0.15); // the life ring, red and white quarters
    if (Math.abs(rd - 0.03) < 0.012) { const q = Math.floor((Math.atan2(w - 0.15, u + 0.3) + TAU) / (TAU / 8)) & 1; BG[i] = C(q ? RED : WHITE, 1.5 + L * 0.4); return set(i, 'O', C(q ? WHITE : RED, L)), true; }
    if (Math.abs(u - 0.37) < 0.016 && Math.abs(w - 0.19) < 0.013 || Math.abs(u - 0.36) < 0.016 && Math.abs(w - 0.15) < 0.013) { BG[i] = C(w > 0.17 ? ORANGE : RED, 1.5 + L * 0.4); return set(i, '@', C(WHITE, L * 0.9)), true; } // floats on a string
    if (Math.abs(u - 0.365) < 0.004 && w > 0.13 && w < 0.24) return set(i, '|', C(WARM, L * 0.7)), true;
    return clap(), true;
  }
  if (f === 3) { // the back, to the sea: a net hung over it in a swag, cork floats along its rope, two big buoys
    const top = 0.24, bottom = 0.075 + 0.1 * (1 - (u / 0.38) ** 2), r = Math.hypot(Math.abs(u) - 0.25, (w - 0.08) * 1.1);
    if (r < 0.03) { BG[i] = C(fract(w * 55) < 0.5 ? RED : WHITE, 1.5 + L * 0.4); return set(i, '@', C(GRAY, L * 0.5)), true; }
    if (Math.abs(u) < 0.38 && Math.abs(w - top) < 0.008) return set(i, fract(u * 16) < 0.3 ? 'o' : '-', C(fract(u * 16) < 0.3 ? ORANGE : WARM, Math.max(L, 8))), true;
    if (Math.abs(u) < 0.38 && w < top && w > bottom) {
      const m1 = fract((u + w) * 42), m2 = fract((u - w) * 42);
      if (m1 < 0.2 || m2 < 0.2) return set(i, m1 < 0.2 && m2 < 0.2 ? 'x' : m1 < 0.2 ? '/' : '\\', C(GREEN, Math.max(L * 0.9, 6))), true;
    }
    return clap(), true;
  }
  // the ends: a window each (lit at night when he's in), oars racked on the west end, rods leaning on the east
  if (Math.abs(v) < 0.08 && Math.abs(w - 0.15) < 0.045) {
    if (Math.abs(v) > 0.07 || Math.abs(w - 0.15) > 0.037 || Math.abs(v) < 0.005) return set(i, '+', C(WHITE, L * 0.9)), true;
    BG[i] = glow > 0.3 && open ? C(WARM, 2 + glow * 5) : C(CYAN, 0.8 + L * 0.12);
    return set(i, glow > 0.3 ? ' ' : hash(Math.floor(v * 50), Math.floor(w * 60), 1603) > 0.9 ? '/' : ' ', C(WHITE, 12)), true;
  }
  if (f === 2 && w > 0.215 && w < 0.24 && Math.abs(v) < 0.24) return set(i, Math.abs(v) > 0.2 ? '#' : '=', C(BRICK, Math.max(L, 7))), true; // an oar on two hooks
  if (f === 1) for (const [v0, lean, col] of [[0.14, 0.32, YEL], [0.19, 0.22, BLUE]]) if (Math.abs(v - v0 + w * lean) < 0.006 && w < 0.27) return set(i, '/', C(col, Math.max(L, 8))), true;
  return clap(), true;
};
// the roof: corrugated tin, gone rusty in places; the gables boarded
SOLID_SHADE.hutroof = o => (i, t, L) => {
  const f = HIT.face, u = HIT.u, rust = noise(u * 7, o.k * 1.7 + HIT.v * 3, 1605) > 0.6;
  if (f === 1 || f === 2) { hutWall(i, f, L); return set(i, o.k === 4 ? '^' : '-', C(WHITE, L * 0.6)), true; }
  BG[i] = C(rust ? BRICK : RED, (f === 5 ? 1.3 : 1) + L * 0.26);
  if (f === 6) return set(i, ' ', 0), true;
  return set(i, f === 5 ? (o.k === 4 ? '=' : '_') : fract(u * 40) < 0.35 ? '|' : ' ', C(rust ? ORANGE : RED, L * 0.75)), true;
};
// the sign along the ridge, readable from the road and the sea: BAIT & TACKLE between two painted fish
const HUT_WORD = 'BAIT & TACKLE';
SOLID_SHADE.hutsign = o => (i, t, L) => {
  const f = HIT.face, w = HIT.w, z0 = o.z0, z1 = o.z1, edge = Math.min(o.hl - Math.abs(HIT.u), z1 - w, w - z0) < 0.009, glow = Math.max(night, overcast * 0.6);
  BG[i] = edge ? C(BLUE, 1.5 + L * 0.3) : C(WHITE, 1.6 + L * 0.42 + glow * 2);
  if (f !== 3 && f !== 4 || edge) return set(i, ' ', 0), true;
  const vx = rel(o.x - px), vy = rel(o.y - py), n = HUT_WORD.length + 2, h = z1 - z0 - 0.02;
  const ch = signLine(HUT_WORD, faceQ(HIT.u, o.hl) * n - 1, (z1 - 0.01 - w) / h, i, (z0 + z1) / 2, midDepth(vx, vy), t, 2 * o.hl / n, h, farDepth(vx, vy, o.hl), ...faceDir(1, 0));
  return set(i, ch ?? ' ', C(ch === '&' ? RED : BLUE, 14)), true;
};
// a net hung out to dry between two posts: see-through mesh, sagging in scallops from its rope, cork floats along the top
SOLID_SHADE.netrack = o => (i, t, L) => {
  const f = HIT.face, u = HIT.u, w = HIT.w;
  if (Math.abs(u) > o.hl - 0.012 || f === 1 || f === 2) { BG[i] = C(BRICK, 1.1 + L * 0.25); return set(i, '|', C(WARM, L * 0.8)), true; } // the posts
  if (w > 0.232 || f === 5) return set(i, fract(u * 14) < 0.28 ? 'o' : '-', C(fract(u * 14) < 0.28 ? ORANGE : WARM, Math.max(L, 8))), true;
  const s = fract((u + o.hl) / (2 * o.hl) * 3), bottom = 0.03 + 0.07 * (1 - 4 * s * (1 - s)); // (lower in the middle of each span)
  if (w < bottom) return false;
  const m1 = fract((u + w) * 40), m2 = fract((u - w) * 40);
  if (m1 < 0.2 || m2 < 0.2) return set(i, m1 < 0.2 && m2 < 0.2 ? 'x' : m1 < 0.2 ? '/' : '\\', C(GREEN, Math.max(L * 0.9, 6))), true;
  return hash(Math.floor(u * 70), Math.floor(w * 70), 1607) > 0.985 ? (set(i, '~', C(GREEN, L)), true) : false; // (a strand of weed caught in it)
};
// lobster pots: wooden slats over a dark netted inside, rope mesh at the ends
SOLID_SHADE.lobsterpot = o => (i, t, L) => {
  const f = HIT.face, u = HIT.u, w = HIT.w - o.z0;
  if (f === 1 || f === 2) { BG[i] = C(GRAY, 0.7); return set(i, fract((HIT.v + w) * 60) < 0.25 || fract((HIT.v - w) * 60) < 0.25 ? 'x' : ' ', C(GREEN, L * 0.8)), true; }
  if (f === 5) { BG[i] = C(WARM, 1.2 + L * 0.3); return set(i, fract(u * 22) < 0.3 ? ' ' : '=', C(BRICK, L * 0.8)), true; }
  if (fract(u * 22) < 0.42) { BG[i] = C(GRAY, 0.6); return set(i, w > 0.02 && w < 0.06 && fract(u * 44) < 0.3 ? 'x' : ' ', C(GREEN, L * 0.5)), true; } // between the slats
  BG[i] = C(WARM, (1.1 + L * 0.28) * shadeFace(f));
  return set(i, w < 0.008 || w > 0.067 ? '=' : '|', C(BRICK, L * 0.8)), true;
};
// a barrel at the corner: staves and iron hoops, rainwater in the top
SOLID_SHADE.barrel = o => (i, t, L) => {
  const f = HIT.face, w = HIT.w;
  if (f === 5) { BG[i] = C(BLUE, 1 + L * 0.2); return set(i, '~', C(CYAN, L * 0.6)), true; }
  BG[i] = C(BRICK, (1.1 + L * 0.28) * shadeFace(f));
  return set(i, Math.abs(w - 0.02) < 0.006 || Math.abs(w - 0.07) < 0.006 ? '=' : fract((f >= 3 ? HIT.u : HIT.v) * 50) < 0.2 ? '|' : ' ', C(Math.abs(w - 0.02) < 0.006 || Math.abs(w - 0.07) < 0.006 ? GRAY : BRICK, L * 0.8)), true;
};

// ---- the rod in your hand: where it points (radians off upright, toward the middle of the screen) and how much it
// bends, eased toward what you're doing; worked out once a frame, before the world's drawn, so the line in the world and
// the rod over it meet at the tip
const rodView = { ang: 0.62, bend: 0, spin: 0, t: 0, swing: 0, swingV: 0 };
function rodTarget() {
  const f = fishing, sway = Math.sin(T * 1.3) * 0.02;
  if (!f) return [0.62 + sway, 0, 6];
  const windAng = 0.62 - (f.power || 0) * 1.05;
  switch (f.st) {
    case 'wind': return [windAng + (f.power >= 1 ? Math.sin(T * 40) * 0.012 : 0), 0.04, 10];
    case 'fly': return f.t < 0.12 ? [1.15, -0.12, 40] : [0.74, 0.02, 6]; // whipped forward, then back up to watch it go
    case 'wait': case 'land': return [0.74 + sway * 0.5, 0.04, 5];
    case 'lure': return [0.74 + (f.t > f.dur * 0.55 ? Math.sin(T * 28) * 0.018 : 0), 0.07, 12]; // a twitch or two as it noses the bait
    case 'bite': return [0.86 + Math.sin(T * 34) * 0.04, 0.32, 20]; // yanked down
    case 'reel': return f.catch ? [0.45 + Math.sin(T * 17) * 0.03, 0.32 + Math.min(0.3, (f.catch.kg || 0.5) * 0.025), 10] : [0.5, 0.08, 10];
    case 'landed': return [0.32, 0.18 + Math.min(0.2, (f.catch.kg || 0.5) * 0.02), 8];
  }
  return [0.62, 0, 6];
}
function stepRodView() {
  const dt = clamp(T - rodView.t, 0, 0.05); rodView.t = T;
  const [ang, bend, rate] = rodTarget(), k = Math.min(1, dt * rate);
  const was = rodView.ang;
  rodView.ang += (ang - rodView.ang) * k; rodView.bend += (bend - rodView.bend) * k;
  if (fishing && fishing.st === 'reel' || fishing && fishing.st === 'wind') rodView.spin += dt * (fishing.st === 'reel' ? 22 : 0);
  // whatever hangs off the tip swings: pushed by the rod moving, pulled back down
  rodView.swingV += (-rodView.swing * 30 - rodView.swingV * 3 + (rodView.ang - was) / Math.max(dt, 1e-3) * 2.5) * dt;
  rodView.swing = clamp(rodView.swing + rodView.swingV * dt, -1.2, 1.2);
}
// the rod on screen, in pixels: grip, length, and the point at s (0 at the grip, 1 the tip; under 0 the butt)
function rodGeom() {
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, u = Math.max(14, cv.height / 36), hsz = Math.round(u * 1.15);
  const bob = moving ? Math.sin(T * 9) * u * 0.35 : Math.sin(T * 1.5) * u * 0.08;
  const cx = Math.round(cv.width * 0.84), hy = Math.round(cv.height - 5.6 * hsz + bob), grip = hy + 1.1 * hsz;
  const Lr = Math.min(cv.height * 0.62, cv.width * 0.5), sa = Math.sin(rodView.ang), ca = Math.cos(rodView.ang);
  const at = s => ({ x: cx - sa * s * Lr, y: grip - ca * s * Lr + rodView.bend * Lr * 0.42 * s * s });
  return { u, hsz, cx, hy, grip, Lr, at, tip: at(1) };
}
// screen (pixels) at depth D, back into the world: relative to you
function unproject(sx, sy, D) {
  const c = sx / cw, r = sy / FS, lat = (c - cols / 2) * D / projX;
  return { x: dx * D - dy * lat, y: dy * D + dx * lat, z: eye + (hor - r) * D / projY };
}
const fishProj = (X, Y, Z) => { const depth = dx * X + dy * Y; return depth < 0.008 ? null : { c: cols / 2 + (-dy * X + dx * Y) * projX / depth, r: hor - (Z - eye) * projY / depth, depth }; };
function fishPut(c, r, depth, ch, col, bg) {
  c = Math.floor(c); r = Math.floor(r);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
  const i = r * cols + c;
  if (ZB[i] >= 0 && ZB[i] < depth * 0.985) return false; // something's in front of it
  set(i, ch, col); if (bg !== undefined) BG[i] = bg; FL[i] = 0; FOGS[i] = 0;
  return true;
}
// a run of characters between two projected points, each following the slope, hidden where something's in front
function fishSeg(p0, p1, col) {
  const dc = p1.c - p0.c, dr = p1.r - p0.r, n = Math.min(300, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr))) + 1);
  const ch = Math.abs(dr) > Math.abs(dc) * 2 ? '|' : Math.abs(dc) > Math.abs(dr) * 2 ? '-' : (dc > 0) === (dr > 0) ? '\\' : '/';
  for (let k = 0; k <= n; k++) { const f = k / n; fishPut(p0.c + dc * f, p0.r + dr * f, p0.depth + (p1.depth - p0.depth) * f, ch, col); }
}

// ---- out in the world, after the sprites: the line, the bobber, the rings, the fish coming in, the spray
function drawFishing() {
  if (mode !== 'walk') return;
  for (const p of fishFx) { const q = fishProj(rel(p.x - px), rel(p.y - py), p.z); if (q) fishPut(q.c, q.r, q.depth, p.vz > 0 ? '\'' : '.', C(WHITE, 8 + p.life * 6)); }
  const f = fishing;
  if (!heldRod()) return;
  stepRodView();
  if (!f || f.st === 'wind' || f.st === 'landed') return; // (the line's short, off the tip: drawn with the rod)
  const lit = Math.max(0.5, amb), bx = rel(f.x - px), by = rel(f.y - py);
  const onWater = f.st === 'wait' || f.st === 'lure' || f.st === 'bite';
  let bz = f.z;
  if (f.st === 'wait') bz = 0.003 + Math.sin(T * 2.4) * 0.002;
  if (f.st === 'lure') bz = 0.003 + (f.t > f.dur * 0.6 ? Math.max(-0.002, Math.sin(T * 26)) * 0.003 : Math.sin(T * 2.4) * 0.002);
  if (f.st === 'bite') bz = -0.01;
  // rings spreading over the water: when it lands, when something takes it, and a slow one as it rides the swell
  if (onWater) {
    const rings = [[T - (f.ring ?? -9), 1.4, 1], [fract(T / 2.6) * 2.6, 2.6, 0.45]];
    for (const [age, life, k] of rings) if (age < life) fishRing(bx, by, 0.012 + age * 0.13, (1 - age / life) * k, lit);
  }
  // the fish, coming in: a swirl and a trail of bubbles through the water toward the bobber
  if (f.st === 'lure') {
    for (let j = 0; j < 7; j++) {
      const q = clamp(f.t / f.dur - j * 0.05, 0, 1), dist = 0.55 * (1 - q) ** 1.1;
      const fxp = bx + Math.cos(f.from) * dist, fyp = by + Math.sin(f.from) * dist, p = fishProj(fxp, fyp, 0.001 + j * 0.0015 * (j & 1));
      if (p) fishPut(p.c, p.r, p.depth, j === 0 ? '~' : j & 1 ? 'o' : '.', C(j === 0 ? WHITE : CYAN, (j === 0 ? 14 : 12 - j) * lit));
    }
  }
  // the line: off the rod tip, sagging in the slack (lying on the water near the bobber), taut when something's on
  const G = rodGeom(), tip = unproject(G.tip.x, G.tip.y, 0.06);
  const sag = f.st === 'bite' || f.st === 'reel' && f.catch ? 0.004 : f.st === 'fly' ? 0.01 : f.st === 'reel' ? 0.012 : 0.012 + Math.hypot(bx, by) * 0.012;
  let prev = null;
  const lineCol = C(WHITE, (night > 0.5 ? 7 : 10) * lit);
  for (let k = 0; k <= 36; k++) {
    const s = (k / 36) ** 1.7, z = Math.max(0.0015, tip.z + (bz + 0.008 - tip.z) * s - sag * 4 * s * (1 - s));
    const p = fishProj(tip.x + (bx - tip.x) * s, tip.y + (by - tip.y) * s, z);
    if (p && prev) fishSeg(prev, p, lineCol);
    prev = p;
  }
  // the bobber: red over white, a little stick on top. Pulled under, just a swirl where it went
  const p = fishProj(bx, by, bz + 0.004);
  if (!p) return;
  if (f.st === 'bite') { fishPut(p.c, p.r, p.depth, '@', C(WHITE, 15 * lit)); return; }
  const rc = 0.007 * projX / p.depth, rr = 0.007 * projY / p.depth;
  if (rc < 0.9) { fishPut(p.c, p.r, p.depth, 'o', C(RED, 15), C(WHITE, 1.5)); }
  else {
    for (let r = Math.floor(p.r - rr); r <= p.r + rr; r++) for (let c = Math.floor(p.c - rc); c <= p.c + rc; c++) {
      const ex = (c + 0.5 - p.c) / rc, ey = (r + 0.5 - p.r) / rr;
      if (ex * ex + ey * ey <= 1) { const b = dSphere(ex, ey, 1); fishPut(c, r, p.depth, dFill(b), C(ey < 0 ? RED : WHITE, 6 + b * 9)); }
    }
    fishPut(p.c, p.r - rr - 0.5, p.depth, '|', C(RED, 12)); // (its stick)
  }
  if (f.st === 'reel' && f.catch && f.z > 0.004) { // up out of the water on the end of the line, wriggling
    const d = ITEMS[f.catch.id], q = fishProj(bx, by, Math.max(0.001, f.z - 0.02));
    if (q) {
      const word = d.kind === 'fish' || d.kind === 'wish' ? (Math.sin(T * 18) > 0 ? '<o)))><' : '<o)))>-') : d.kind === 'junk' ? '[#]' : '(*)';
      const n = clamp(Math.round(0.05 * projX / q.depth), 1, word.length), w0 = word.slice(0, n);
      fishSeg(p, q, lineCol);
      for (let k = 0; k < w0.length; k++) fishPut(q.c - w0.length / 2 + k, q.r, q.depth * 0.99, w0[k], C(d.col ?? (d.kind === 'junk' ? GRAY : YEL), 14));
    }
  }
}
function fishRing(bx, by, R, k, lit) {
  const p = fishProj(bx, by, 0);
  if (!p) return;
  const n = clamp(Math.round(R * projX / p.depth * 5), 8, 64);
  for (let j = 0; j < n; j++) {
    const an = j / n * TAU, q = fishProj(bx + Math.cos(an) * R, by + Math.sin(an) * R, 0.0005);
    if (q) fishPut(q.c, q.r, q.depth, Math.abs(Math.sin(an + Math.atan2(dy, dx))) > 0.7 ? '-' : '~', C(WHITE, (5 + k * 9) * lit));
  }
}

// ---- over the frame: the rod itself, the reel on it, and the bobber (or your catch) hanging off the tip
function drawFishingRod(it) {
  const G = rodGeom(), s = Math.round(G.u * 0.85), carbon = it.id === 'carbonrod';
  g.font = s + 'px monospace';
  const w = g.measureText('M').width;
  g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)';
  const put = (ch, x, y, col) => { g.strokeText(ch, x - w / 2, y - s / 2); g.fillStyle = PAL[col]; g.fillText(ch, x - w / 2, y - s / 2); };
  const slopeCh = (a_, b_) => { const dxs = (b_.x - a_.x) / w, dys = (b_.y - a_.y) / s; return Math.abs(dys) > Math.abs(dxs) * 2 ? '|' : Math.abs(dxs) > Math.abs(dys) * 2 ? '-' : dxs * dys < 0 ? '/' : '\\'; };
  const n = Math.ceil(G.Lr * 1.12 / (Math.min(w, s) * 0.8)), guides = [0.34, 0.52, 0.67, 0.8, 0.91];
  for (let k = 0; k <= n; k++) { // butt (cork, in your fist), the reel seat, the blank, thinner and lighter toward the tip
    const sv = -0.12 + 1.12 * k / n, p = G.at(sv), q = G.at(sv + 0.02);
    const cork = sv < 0.15, seat = sv >= 0.15 && sv < 0.2, wrap = guides.some(gs => Math.abs(sv - gs) < 0.012);
    const col = cork ? C(WARM, 13) : seat ? C(GRAY, 12) : wrap ? C(carbon ? BLUE : RED, 13) : carbon ? C(GRAY, 9 + sv * 3) : C(WHITE, 12 + sv * 3);
    put(cork ? '#' : seat ? '=' : slopeCh(p, q), p.x, p.y, col);
    if (cork || seat || sv < 0.42) { const o = G.at(sv); if (!cork && !seat) { put(slopeCh(p, q), o.x + w * 0.5 * Math.cos(rodView.ang), o.y + w * 0.5 * Math.sin(rodView.ang), col); continue; } put(cork ? '#' : '=', o.x + w * 0.55 * Math.cos(rodView.ang), o.y + w * 0.55 * Math.sin(rodView.ang), cork ? C(BRICK, 12) : C(GRAY, 9)); } // (thicker down there)
  }
  g.font = Math.round(s * 0.7) + 'px monospace';
  for (const gs of guides) { const p = G.at(gs); put('o', p.x + Math.cos(rodView.ang) * w * 0.45, p.y + Math.sin(rodView.ang) * w * 0.45, C(GRAY, 13)); } // the guides, under the blank
  g.font = s + 'px monospace';
  put('.', G.tip.x, G.tip.y, C(carbon ? BLUE : RED, 15));
  // the reel, hanging under the rod above your fist on its foot: the spool with the line wound on, and the handle going
  // round (a knob on an arm) as you wind in
  const R = G.at(0.19), ca = Math.cos(rodView.ang), sa = Math.sin(rodView.ang), rx = R.x + ca * w * 2.2, ry = R.y + sa * w * 2.2, ph = rodView.spin;
  put('|', R.x + ca * w * 0.9, R.y + sa * w * 0.9, C(GRAY, 12)); // the foot
  const spool = carbon ? BLUE : GREEN, turning = fishing && fishing.st === 'reel';
  put('(', rx - w, ry, C(GRAY, 13)); put(turning && fract(ph) < 0.5 ? '=' : '#', rx, ry, C(spool, 13)); put(')', rx + w, ry, C(GRAY, 13));
  put('_', rx, ry - s * 0.75, C(GRAY, 12)); put('-', rx, ry + s * 0.55, C(GRAY, 12));
  const hx = rx + w * 1.4 + Math.cos(ph) * w * 0.9, hy = ry + Math.sin(ph) * s * 0.7; // the handle
  put(Math.abs(Math.sin(ph)) > 0.7 ? '|' : Math.cos(ph) * Math.sin(ph) > 0 ? '\\' : '/', (rx + w * 1.4 + hx) / 2, (ry + hy) / 2, C(GRAY, 12));
  put('o', hx, hy, C(WHITE, 15));
  // what hangs off the tip: the bobber, when the line's in; your catch, when you've just landed it
  const f = fishing, sw = rodView.swing + (f && f.st === 'wind' ? f.power * 0.9 : 0);
  if (!f || f.st === 'wind' || f.st === 'landed') {
    const len = (f && f.st === 'landed' ? 2 : 2.6) * s, ex = G.tip.x + Math.sin(sw) * len, ey = G.tip.y + Math.cos(sw) * len;
    charLine(G.tip.x, G.tip.y, ex, ey, w, s, PAL[C(WHITE, 11)]);
    g.lineJoin = 'round'; g.lineWidth = Math.max(2, s * 0.14); g.strokeStyle = 'rgba(0,0,0,0.8)';
    if (f && f.st === 'landed') drawCatchHanging(f.catch, ex, ey);
    else { put('o', ex, ey, C(RED, 15)); put('o', ex, ey + s * 0.6, C(WHITE, 15)); }
  }
  if (f && f.st === 'wind') { const k = Math.round(f.power * 10); msgText = `Casting [${'#'.repeat(k)}${'-'.repeat(10 - k)}]${k >= 10 ? ' (as far as it goes)' : ''}`; msgT = 0.3; }
  g.font = FS + 'px monospace';
}
// the catch on the end of the line: its picture, top centre at (x, y), flapping if it's a fish
function drawCatchHanging(c, x, y) {
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 0.72);
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, [art, col] = (DENSE[c.id] || droppedArt)({ id: c.id, uses: 0, kg: c.kg, hang: true }, 1), aw = Math.max(...art.map(l => l.length));
  artText(art, x - aw * w / 2, y, s, col);
}

// ---- what you catch, in your hand: fish sculpted side on (head left), the rest as little pictures
const FLAPPING = it => it.hang || fishing && fishing.st === 'landed';
function denseFish(it) {
  const d = ITEMS[it.id], col = d.col, eel = d.eel || d.long, flap = FLAPPING(it) ? Math.sin(T * 14) : Math.sin(T * 1.3) * 0.2;
  const W = eel ? 36 : 30, H = eel ? 8 : 12, rx = eel ? 9.4 : 6.2, ry = eel ? 1.9 : d.flat ? 3.9 : 3.3, cx0 = eel ? -1 : -1.3, koi = it.id === 'goldkoi';
  return sculpt(W, H, (x, y) => {
    y -= flap * Math.max(0, x - cx0) / (rx + 3) * 1.3; // (the tail end swings)
    const tailX = cx0 + rx * 0.84;
    if (x > tailX) { // the tail, forked
      const tx = x - tailX, spread = Math.min(tx * 1.1 + 0.5, eel ? 1.4 : 3.3), len = eel ? 1.8 : koi ? 4.2 : 3.4;
      if (tx < len && Math.abs(y) < spread && !(!eel && tx > len * 0.5 && Math.abs(y) < (tx - len * 0.5) * 1.2)) return [koi ? '~' : Math.abs(y) > spread - 0.6 ? (y < 0 ? '/' : '\\') : '=', C(col, koi ? 12 + Math.sin(T * 3 + y) * 3 : 9)];
    }
    const e = dEll(x, y, cx0, 0, rx, ry);
    if (e >= 1) {
      const fx = x - cx0 - 0.4, fin = 1 - Math.abs(fx) / 2.6;
      if (!eel && y < 0 && fin > 0 && y > -ry - (koi ? 2 : 1.4) * fin) return [y < -ry - 0.5 ? '^' : '|', C(col, koi ? 13 : 8)]; // the dorsal fin
      if (d.whiskers && y > -0.2 && x < cx0 - rx + 1.2 && x > cx0 - rx - 2.6 && Math.abs(y - (cx0 - rx + 1.2 - x) * 0.7) < 0.45) return ['\\', C(GRAY, 12)];
      if (d.ugly && y > -0.5 && y < ry * 0.6 && x < cx0 - rx + 0.6 && x > cx0 - rx - 0.9) return [fract(y * 2) < 0.5 ? 'v' : '^', C(WHITE, 14)]; // teeth
      return null;
    }
    const nx = (x - cx0) / rx, ny = y / ry, b = dSphere(nx, ny, 1);
    if (Math.hypot(x - (cx0 - rx * 0.64), y + ry * 0.25) < 0.55) return ['o', C(WHITE, 15)]; // the eye
    if (x < cx0 - rx * 0.86 && Math.abs(y - ry * 0.15) < 0.45) return ['<', C(GRAY, 11)]; // the mouth
    if (Math.abs(x - (cx0 - rx * 0.42)) < 0.3 && Math.abs(ny) < 0.7) return [')', C(col, 6)]; // the gill
    if (koi && fract(x * 0.35 - T * 0.9 + y * 0.25) < 0.08) return ['*', C(WHITE, 15)]; // the shimmer, running along it
    if (d.stripes && ny < 0.1 && fract(x * 0.55 + Math.sin(y * 1.8) * 0.4) < 0.28) return ['~', C(col === BLUE ? GRAY : BRICK, 6 + b * 4)];
    if (d.spots && hash(Math.floor(x * 2), Math.floor(y * 2), 1611) > 0.8) return ['.', C(BRICK, 5)];
    if (ny > 0.35 && !d.ugly && !koi) return [dFill(b), C(WHITE, 5 + b * 9)]; // the belly, paler
    return [b > 0.9 ? '@' : dFill(b), C(koi ? (fract(x * 0.3 + y * 0.1) < 0.5 ? YEL : ORANGE) : col, 5 + b * 10)];
  });
}
for (const id in ITEMS) if ((ITEMS[id].kind === 'fish' || ITEMS[id].kind === 'wish') && !ITEMS[id].crab && !ITEMS[id].squid) DENSE[id] = denseFish;
// on the ground (and in hand, for the ones without a sculpture)
for (const id in ITEMS) if ((ITEMS[id].kind === 'fish' || ITEMS[id].kind === 'wish') && !DROPPED_ART[id]) {
  const col = ITEMS[id].col; DROPPED_ART[id] = () => [['  <o)))><'], c => c === 'o' ? C(WHITE, 15) : C(col, 13)];
}
Object.assign(DROPPED_ART, {
  rod: () => [['#####======---------------------.'], c => c === '#' ? C(WARM, 13) : c === '.' ? C(RED, 15) : C(WHITE, 13)],
  carbonrod: () => [['#####======---------------------.'], c => c === '#' ? C(WARM, 13) : c === '.' ? C(BLUE, 15) : C(GRAY, 12)],
  crab: () => [[' (\\/)   (\\/)', '  \\_ o o _/', '   (_____)', '   /|/ \\|\\'], c => c === 'o' ? C(WHITE, 15) : C(RED, 14)],
  squid: () => [['    /\\', '   /  \\', '  | oo |', '   \\  /', '   ||||', '   ))(('], (c, r) => c === 'o' ? C(WHITE, 15) : C(MAG, 13 - (r > 3 ? 2 : 0))],
  oldboot: () => [['   ___', '  |   |', '  |   |__', '  |      \\_', '  |________)'], (c, r) => r === 4 ? C(GRAY, 11) : C(BRICK, 13)],
  tincan: () => [[' _____', '|=====|', '|BEANS|', '|=====|', "'-----'"], (c, r) => r === 2 && /[A-Z]/.test(c) ? C(WHITE, 14) : r === 2 ? C(ORANGE, 12) : C(GRAY, 12)],
  seaweed: () => [['  ) ( )', ' ( ) (', '  ) ( )', ' (_)_('], () => C(GREEN, 12)],
  plasticbag: () => [['  /\\ /\\', ' (  V  )', ' |     |', ' |THANK|', '  \\___/'], (c, r) => r === 3 && /[A-Z]/.test(c) ? C(RED, 13) : C(WHITE, 13)],
  tyre: () => [['  .-""-.', ' / .--. \\', '| |    | |', ' \\ `--` /', "  `-..-'"], () => C(GRAY, 9)],
  trafficcone: () => [['   /\\', '  /==\\', ' /    \\', '/======\\', '[______]'], c => c === '=' ? C(WHITE, 14) : C(ORANGE, 14)],
  flipflop: () => [['  .--.', ' / /\\ \\', '| (  ) |', ' \\    /', "  `--'"], c => '()'.includes(c) ? C(MAG, 14) : C(CYAN, 13)],
  trolleywheel: () => [['  _[]_', ' / __ \\', '| (  ) |', ' \\_--_/'], (c, r) => r === 0 ? C(GRAY, 13) : C(GRAY, 9)],
  soggybook: () => [['  _______', ' /~~~~~~/|', '/______/ |', '|SOGGY | /', '|______|/'], (c, r) => c === '~' ? C(CYAN, 11) : /[A-Z]/.test(c) ? C(WHITE, 12) : C(BRICK, 12)],
  bottlemsg: () => [['   [=]', '   | |', '  /   \\', ' | ~~~ |', ' | ~~~ |', ' |_____|'], (c, r) => c === '~' ? C(WHITE, 14) : r === 0 ? C(BRICK, 12) : C(GREEN, 11)],
  oldcoin: () => [['  .---.', ' / (K) \\', '|  ~~~  |', ' \\     /', "  `---'"], (c, r) => c === 'K' ? C(WHITE, 15) : C(GRAY, 12)],
  goldring: () => [['   .<>.', '  /    \\', ' |      |', '  \\    /', "   `--'"], c => c === '<' || c === '>' ? C(CYAN, 15) : C(YEL, 14)],
  pearl: () => [['   .--.', '  ( o  )', "   `--'"], c => c === 'o' ? C(WHITE, 15) : C(WARM, 14)],
  compass: () => [['  .-N-.', ' /  |  \\', '|W  *  E|', ' \\  |  /', "  `-S-'"], c => c === '*' || c === '|' ? C(RED, 14) : /[NSEW]/.test(c) ? C(WHITE, 14) : C(YEL, 12)],
  divewatch: () => [['  [===]', ' .-----.', '| 12:00 |', " `-----'", '  [===]'], (c, r) => r === 2 && /[0-9:]/.test(c) ? C(CYAN, 15) : C(GRAY, 12)],
  wishcoins: () => [['  (o)(o)', ' (o)(o)(o)', '  (o)(o)'], c => c === 'o' ? C(YEL, 15) : C(GRAY, 12)],
  pocketknife: () => [['  ___________', ' (__o___=====>'], (c, r) => r === 1 && c === '=' || c === '>' ? C(GRAY, 13) : c === 'o' ? C(YEL, 14) : C(RED, 13)],
});
// a rod in the hand: the rod, not a picture of one (drawHeldBig asks)
const heldIsRod = it => !!ITEMS[it.id].rod;

// ---- sounds, a prompt, and the hut's counter
function stepFishingUI() {
  while (fishSfx.length) {
    const s = fishSfx.shift();
    if (!actx) continue;
    const at = actx.currentTime;
    if (s === 'whoosh') { burst(at, 0.25, [filt('bandpass', 1800, 2)], 0.12); burst(at + 0.05, 0.3, [filt('bandpass', 900, 2)], 0.06); }
    if (s === 'plop') { tone(at, 220, 0.12, 0.12); burst(at, 0.12, [filt('lowpass', 900)], 0.12); }
    if (s === 'splash') { burst(at, 0.35, [filt('bandpass', 1200, 0.8)], 0.22); tone(at, 140, 0.15, 0.1); }
    if (s === 'reel') for (let k = 0; k < 8; k++) tone(at + k * 0.045, 2400, 0.02, 0.04, 'square');
    if (s === 'land') { burst(at, 0.2, [filt('bandpass', 700, 1)], 0.15); tone(at + 0.05, 330, 0.1, 0.06); }
  }
  if (actx && fishing && fishing.st === 'reel' && fract(T * 22) < 0.12 && T - (stepFishingUI.tick ?? 0) > 0.04) { stepFishingUI.tick = T; tone(actx.currentTime, 2600, 0.015, 0.025, 'square'); } // the reel's ratchet
}
function fishPrompt() {
  const f = fishing;
  if (!f) return heldRod() && mode === 'walk' ? 'Q (hold): wind up, let go to cast' : '';
  return { wind: 'let go of Q to cast', fly: '', wait: 'Waiting for a bite...   Q: reel in', lure: 'Something\'s nosing at it... wait for it', bite: 'Q: STRIKE!', reel: 'Reeling in...', land: 'Q: reel in', landed: '' }[f.st] ?? '';
}
function useHut() {
  if (!hutOpen()) return say('Shuttered. A card in the hatch: BACK AT 5AM. FISH DON\'T WAIT AND NEITHER DO WE.', 3);
  return openShop('BAIT & TACKLE', ['rod', 'carbonrod']);
}
