// ===== peeing. P lets it go wherever you're standing: a stream arcs out in front of you (your eyes go down to it),
// and a yellow puddle spreads where it lands, then dries up over a few minutes (quicker in the rain, slower indoors).
// How long you go is down to the bladder (needs.js), which nothing on screen shows: drink enough and you get a hint,
// ignore it long enough and you don't get a say in it. P again cuts it off.
let pee = null; // { left: seconds of stream, t, at, accident, pitch0, auto }
const peeDrops = []; // { at, s, x, y, z, vx, vy, vz, t0 }: the stream, in flight, oldest first
const puddles = []; // { at, s, x, y, z, area, life, seed }: area in square metres
let peeHint = 0, peeBurst = 0, peeLook = null; // which hint you've had; how long you've been bursting; easing your eyes back up
const PEE_DRY = 240, PEE_LOOK = -0.8; // seconds for a puddle to dry outside; where your eyes go while you're at it
const PEE_RATE = 60, PEE_DROP = 0.0022; // drops a second, and the puddle each one makes (m²): a full bladder's ~1.3m²
const peeScale = () => mode === 'room' ? 1 : 0.1; // world units a metre
// how high the ground is at (x, y), and whether something's standing up out of it there (a wall: the stream stops)
function peeGround(x, y) {
  if (mode === 'room') { const h = ROOMW.cell(Math.floor(x), Math.floor(y)); return h ? { wall: h } : { z: stairRise(x, y) }; }
  const h = map[idx(Math.floor(x), Math.floor(y))] || 0;
  return h > (mode === 'roof' ? roofH + 1e-6 : 0) ? { wall: h } : { z: h }; // (off a roof's edge it falls to whatever's below)
}

function startPee(accident) {
  if (pee) { if (!pee.accident) { peeLookBack(); pee = null; say('You stop.', 1.2); } return; }
  const at = placeKey();
  if (at === null || !onFootMode()) return accident ? null : say('Not here.');
  if (body.seat && !accident) return say('Stand up first.');
  if (needs.bladder < 8 && !accident) return say('You don\'t need to go.', 1.5);
  pee = { left: 1.5 + needs.bladder / 100 * 11, t: 0, at, accident: !!accident, pitch0: pitch, auto: true };
  peeLook = null; peeHint = 0; peeBurst = 0;
  if (accident) say('You couldn\'t hold it any longer. Everyone pretends not to notice.', 4);
  else say(needs.bladder > 80 ? 'Ahh. That\'s better.' : 'You relieve yourself.', 2);
}
// done (or cut off): your eyes come back up to where they were, unless you've looked somewhere yourself
function peeLookBack() { if (pee && pee.auto) peeLook = { to: pee.pitch0, t: 0.7 }; }
const peeLookOff = () => { if (pee) pee.auto = false; peeLook = null; }; // (you moved the view yourself)

function stepPee(dt) {
  // the hints, and what happens if you ignore them
  if (!pee && onFootMode() && !game && !sleep) {
    if (needs.bladder >= 75 && peeHint < 1) { peeHint = 1; say('You need to pee. (P)', 3); }
    if (needs.bladder >= 97 && peeHint < 2) { peeHint = 2; say('You\'re bursting. Find somewhere, quick. (P)', 3); }
    if (needs.bladder >= 100 && (peeBurst += dt) > 45) startPee(true);
  }
  if (needs.bladder < 70) peeHint = 0;
  if (pee) {
    if (!onFootMode() || placeKey() !== pee.at || sleep || game) { pee = null; peeLook = null; }
    else {
      pee.t += dt; pee.left -= dt;
      needs.bladder = Math.max(0, needs.bladder - dt * 100 / 12.5);
      if (pee.auto && pee.t < 1.2) pitch += (PEE_LOOK - pitch) * Math.min(1, dt * 5);
      if (K.KeyR || K.KeyF) pee.auto = false;
      const flow = Math.min(1, 0.35 + pee.t * 1.6) * Math.min(1, Math.max(0, pee.left) / 1.4); // starts up, dribbles out
      for (let n = Math.round(PEE_RATE * dt + Math.random() * 0.5); n > 0; n--) peeSpray(flow);
      if (pee.left <= 0) { peeLookBack(); pee = null; }
    }
  }
  if (peeLook) { pitch += (peeLook.to - pitch) * Math.min(1, dt * 5); if ((peeLook.t -= dt) <= 0) peeLook = null; }
  // the stream in the air
  for (let k = peeDrops.length - 1; k >= 0; k--) {
    const p = peeDrops[k], ox = p.x, oy = p.y;
    p.vz -= 9.8 * p.s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (T - p.t0 > 3) { peeDrops.splice(k, 1); continue; }
    if (p.at !== (placeKey() ?? '-')) continue; // (left behind somewhere: frozen till it times out)
    const g = peeGround(p.x, p.y);
    if (g.wall && p.z < g.wall) { // splashes against a wall and runs down to its foot
      const g0 = peeGround(ox, oy);
      peeLand(p, ox, oy, g0.z ?? p.z); peeDrops.splice(k, 1);
    } else if (!g.wall && p.z <= g.z) { peeLand(p, p.x, p.y, g.z); peeDrops.splice(k, 1); }
  }
  // puddles drying
  for (let k = puddles.length - 1; k >= 0; k--) {
    const q = puddles[k];
    if ((q.life -= dt / PEE_DRY * (q.at === '' ? 1 + wet * 3 : 0.5)) <= 0) puddles.splice(k, 1);
  }
}
// one drop, out in front of you at about hip height
function peeSpray(flow) {
  const s = peeScale(), acc = pee.accident;
  const wob = Math.sin(T * 6) * 0.05 + Math.sin(T * 1.7) * 0.09, ang = a + wob;
  const fwd = acc ? 0.05 : 0.25, sp = acc ? 0.15 : 0.6 + flow * 2.4, up = acc ? 0 : 0.4 + flow * 0.7;
  const x = px + Math.cos(a) * fwd * s, y = py + Math.sin(a) * fwd * s;
  peeDrops.push({ at: pee.at, s, x, y, z: eye - (acc ? 0.95 : 0.8) * s, vx: Math.cos(ang) * sp * s, vy: Math.sin(ang) * sp * s,
    vz: (up + (Math.random() - 0.5) * 0.15) * s, t0: T });
  while (peeDrops.length > 400) peeDrops.shift();
}
// where a drop comes down: onto a puddle that's already there (it spreads), or the start of a new one
function peeLand(p, x, y, z) {
  const room_ = p.at !== '';
  if (p.splash) return;
  if (Math.random() < 0.35) { // a splash: a droplet or two bouncing off
    const ang = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 0.5) * p.s;
    peeDrops.push({ at: p.at, s: p.s, x, y, z: z + 0.01 * p.s, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vz: (0.8 + Math.random() * 0.8) * p.s, t0: T, splash: true });
  }
  if (!room_) { x = mod(x, N); y = mod(y, N); }
  let best = null, bd = Infinity;
  for (const q of puddles) {
    if (q.at !== p.at || Math.abs(q.z - z) > 0.05 * p.s) continue;
    const d = Math.hypot(room_ ? x - q.x : rel(x - q.x), room_ ? y - q.y : rel(y - q.y)) / p.s, rr = Math.sqrt(q.area / Math.PI);
    if (d < rr + 0.12 && d < bd) { best = q; bd = d; }
  }
  if (best) { // spreads, creeping a little toward where it's landing
    const w = PEE_DROP / (best.area + PEE_DROP);
    best.x += (room_ ? x - best.x : rel(x - best.x)) * w; best.y += (room_ ? y - best.y : rel(y - best.y)) * w;
    best.area = Math.min(best.area + PEE_DROP, 2.5); best.life = 1;
  } else {
    puddles.push({ at: p.at, s: p.s, x, y, z, area: PEE_DROP * 4, life: 1, seed: Math.random() * 100 });
    while (puddles.length > 40) puddles.shift();
  }
}

// the puddles, drawn on the ground before the sprites (so anyone standing in one stands in front of it)
function drawPuddles() {
  const at = placeKey();
  if (at === null || !puddles.length) return;
  const room_ = mode === 'room', lit = Math.max(0.45, amb);
  for (const q of puddles) {
    if (q.at !== at) continue;
    const rx_ = room_ ? q.x - px : rel(q.x - px), ry_ = room_ ? q.y - py : rel(q.y - py);
    const R = Math.sqrt(q.area / Math.PI) * q.s * (0.35 + 0.65 * Math.sqrt(q.life)), k = (eye - q.z) * projY;
    if (k <= 0 || Math.hypot(rx_, ry_) - R > vis) continue;
    let c0 = cols, c1 = -1, r0 = rows, r1 = -1, behind = 0;
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const X = rx_ + su * R, Y = ry_ + sv * R, depth = dx * X + dy * Y;
      if (depth < 0.01 * q.s) { behind++; continue; }
      const col = cols / 2 + (-dy * X + dx * Y) * projX / depth, row = hor + k / depth;
      c0 = Math.min(c0, col); c1 = Math.max(c1, col); r0 = Math.min(r0, row); r1 = Math.max(r1, row);
    }
    if (behind === 4) continue;
    if (behind) { c0 = 0; c1 = cols; r1 = rows; r0 = Math.min(r0, rows); }
    c0 = Math.max(0, Math.floor(c0)); c1 = Math.min(cols, Math.ceil(c1) + 1);
    r0 = Math.max(0, Math.floor(r0), Math.ceil(hor)); r1 = Math.min(rows, Math.ceil(r1) + 1);
    for (let c = c0; c < c1; c++) {
      const cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
      for (let r = r0; r < r1; r++) {
        const i = r * cols + c, d = k / (r - hor + 0.5);
        if (d <= 0 || ZB[i] >= 0 && ZB[i] < d * 0.97) continue; // something's standing in front of it
        const ex = (rx * d - rx_) / R, ey = (ry * d - ry_) / R, e = Math.hypot(ex, ey) + (noise(ex * 1.7 + q.seed, ey * 1.7, 995) - 0.5) * 0.5;
        if (e >= 1) continue;
        const fresh = q.life, L = Math.max(0, 1 - d / vis) * lit * (7 + fresh * 6);
        const shine = noise(ex * 3 + T * 0.4, ey * 3 + q.seed, 996);
        set(i, e > 0.8 ? '.' : shine > 0.62 ? '~' : shine > 0.45 ? '-' : ' ', C(YEL, L * (e > 0.8 ? 0.8 : 1.2)));
        BG[i] = C(YEL, (1 + fresh * 1.6) * lit * (1 - e * 0.4)); FL[i] = 0;
      }
    }
  }
}
// the stream, over everything: each drop joined to the one just after it while it's still coming, so it reads as one arc
function drawStream() {
  const at = placeKey();
  if (at === null || !peeDrops.length) return;
  const room_ = mode === 'room', lit = Math.max(0.45, amb);
  let prev = null;
  for (const p of peeDrops) {
    if (p.at !== at) { prev = null; continue; }
    const rx_ = room_ ? p.x - px : rel(p.x - px), ry_ = room_ ? p.y - py : rel(p.y - py), depth = dx * rx_ + dy * ry_;
    const cur = depth > 0.02 * p.s ? { c: cols / 2 + (-dy * rx_ + dx * ry_) * projX / depth, r: hor - (p.z - eye) * projY / depth, depth, t0: p.t0 } : null;
    if (p.splash) { if (cur) peeDot(cur.c, cur.r, cur.depth, p.vz > 0 ? '\'' : '.', lit); continue; }
    if (cur && prev && cur.t0 - prev.t0 < 0.06) peeLine(prev, cur, lit);
    else if (cur) peeDot(cur.c, cur.r, cur.depth, '.', lit);
    prev = cur;
  }
}
function peeDot(c, r, depth, ch, lit) {
  c = Math.floor(c); r = Math.floor(r);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  const i = r * cols + c;
  if (ZB[i] >= 0 && depth >= ZB[i]) return;
  set(i, ch, C(YEL, Math.max(6, (1 - depth / vis) * 15) * lit)); FOGS[i] = 0;
}
function peeLine(p0, p1, lit) {
  const dc = p1.c - p0.c, dr = p1.r - p0.r, n = Math.min(80, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr))));
  if (n > 79 && (Math.max(p0.r, p1.r) < 0 || Math.min(p0.r, p1.r) > rows)) return; // (way off screen)
  const ch = Math.abs(dr) > Math.abs(dc) * 2 ? '|' : Math.abs(dc) > Math.abs(dr) * 2 ? '-' : (dc > 0) === (dr > 0) ? '\\' : '/';
  for (let k = 0; k <= n; k++) { const f = n ? k / n : 0; peeDot(p0.c + dc * f, p0.r + dr * f, p0.depth + (p1.depth - p0.depth) * f, ch, lit); }
}
