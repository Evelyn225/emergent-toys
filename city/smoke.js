// ===== smoke and vapour that hangs in the air. Every drag you breathe out leaves a few puffs in front of you, a lit
// cigarette sends up the odd wisp, and the vape's cloud is a lot more (mango-coloured). Outside they drift off on the
// wind and are gone in a few seconds; indoors they hang about for half a minute, so a room you keep smoking in gets
// hazy. Walk into a cloud and it fogs your view. (The close-up wisps on the screen, goods-ui.js, are as they were.)
const haze = []; // { at: placeKey, kind: 'smoke' | 'vape' | 'steam' | 'engine' | 'soot', x, y, z, r, vx, vy, s (world units a metre), life 1..0, fade, seed }
let hazeLastTip = 0, hazeDue = 0, hazeWisp = 0;
const HAZE_WIND = [0.035, 0.012]; // outside, in cells a second (a light breeze)
// breathe out (amount 0..3: a wisp, a drag, a big vape cloud) in front of you
function hazeExhale(amount, kind) {
  const at = placeKey();
  if (at === null) return;
  const s = mode === 'room' ? 1 : 0.1, n = Math.max(1, Math.round(2 + amount * 4));
  for (let k = 0; k < n; k++) {
    const sp = (Math.random() - 0.5) * (0.5 + amount * 0.3), d = (0.7 + Math.random() * 0.5 + amount * 0.35) * s, r = (0.14 + amount * 0.1 + Math.random() * 0.08) * s;
    haze.push({ at, kind, s, x: px + Math.cos(a + sp) * d, y: py + Math.sin(a + sp) * d, z: (1.45 + Math.random() * 0.3) * s,
      r, rMax: r * (kind === 'vape' ? 2.5 : 2) + (kind === 'vape' ? 0.22 : 0.15) * s, vx: Math.cos(a + sp) * (0.3 + amount * 0.25) * s, vy: Math.sin(a + sp) * (0.3 + amount * 0.25) * s,
      life: 1, fade: mode === 'room' ? 1 / 25 : kind === 'vape' ? 1 / 12 : 1 / 6, seed: Math.random() * 100 }); // (a vape cloud hangs about a while, even outside)
  }
  while (haze.length > 90) haze.shift();
}
function stepHaze(dt) {
  if (cigTip > hazeLastTip + 0.5) hazeDue = 0.8; // a drag (or lighting up): breathe it out in a moment
  hazeLastTip = cigTip;
  if (hazeDue > 0 && (hazeDue -= dt) <= 0) hazeExhale(0.45, 'smoke');
  if (fx.smoke > 0 && onFootMode() && (hazeWisp -= dt) <= 0) { hazeWisp = 1.4 + Math.random() * 1.2; hazeExhale(-0.3, 'smoke'); } // off the end of it
  for (let k = haze.length - 1; k >= 0; k--) {
    const p = haze[k], out = p.at === '';
    p.x += (p.vx + (out ? HAZE_WIND[0] : 0)) * dt; p.y += (p.vy + (out ? HAZE_WIND[1] : 0)) * dt;
    p.vx *= 1 - Math.min(1, dt * 1.2); p.vy *= 1 - Math.min(1, dt * 1.2); // the breath slows; then it's just the air moving it
    p.z += (p.vz ?? 0.08 * p.s) * dt; p.r += (p.rMax - p.r) * Math.min(1, dt * (out ? 0.6 : 0.3)); // rising, spreading out to a limit
    if ((p.life -= p.fade * dt) <= 0) haze.splice(k, 1);
  }
}
// ---- smoke off things burning out in the world: lit campfires, Fern House's stove after dark, and the cloud a firework
// leaves hanging where it burst (lit up by the next). Only where you could see it, and never so much it crowds out the rest
const FERN_CHIMNEY = [541.25, 245.1, 0.76]; // (its top: islands-content.js)
let worldSmokeT = 0, fwLight = { col: WHITE, t: -99 };
function worldPuff(x, y, z, r, rMax, kind, life, vz) {
  haze.push({ at: '', kind, s: 0.1, x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, z, r, rMax, vx: 0, vy: 0, vz, life: 1, fade: 1 / life, seed: Math.random() * 100 });
  while (haze.length > 140) haze.shift();
}
function stepWorldSmoke(dt) {
  if (mode === 'room' || (worldSmokeT -= dt) > 0) return;
  worldSmokeT = 0.5;
  const seen = (x, y) => Math.hypot(rel(x - px), rel(y - py)) < vis;
  for (const o of FIRES) if (fireLit(o) && seen(o.x, o.y)) worldPuff(o.x, o.y, (o.z ?? terrainHeight(o.x, o.y)) + 0.16, 0.03, 0.16, 'smoke', 7, 0.07);
  const [cx, cy, cz] = FERN_CHIMNEY;
  if (night > 0.2 && seen(cx, cy)) worldPuff(cx, cy, terrainHeight(cx, cy) + cz, 0.025, 0.14, 'smoke', 8, 0.05);
}
function fireworkSmoke(s) { // (called at the burst: events.js)
  fwLight = { col: s.col, t: T };
  let mine = 0;
  for (let k = haze.length - 1; k >= 0; k--) if (haze[k].kind === 'fwsmoke' && ++mine >= 24) haze.splice(k, 1); // (the oldest go first)
  worldPuff(s.x, s.y, s.h, 1, 2.6, 'fwsmoke', 14, 0.02);
}
// drawn last in the scene (after the walls and the people), see-through: a soft core, wisps round its edge, the
// world showing between them. Behind a wall, hidden.
function drawHaze() {
  if (!haze.length) return;
  const room_ = mode === 'room', at = room_ ? placeKey() : ''; // (outdoors, from a car or a boat too)
  let inside = 0, insideKind = 'smoke';
  for (const p of haze) {
    if (p.at !== at) continue;
    const rx_ = room_ ? p.x - px : rel(p.x - px), ry_ = room_ ? p.y - py : rel(p.y - py), depth = dx * rx_ + dy * ry_;
    const near = Math.hypot(rx_, ry_, p.z - eye) / p.r;
    if (near < 1 && p.life * (1 - near) > inside && p.kind !== 'engine' && p.kind !== 'soot' && p.kind !== 'fwsmoke') { inside = p.life * (1 - near); insideKind = p.kind; } // (a car's smoke drifts past you, it doesn't swallow the view)
    if (depth < 0.05 * p.s * 10 || depth > vis) continue;
    const sc = projX / depth, cx = cols / 2 + (-dy * rx_ + dx * ry_) * sc, rw = p.r * sc, cy = hor - (p.z - eye) * projY / depth, rh = p.r * projY / depth * 0.75;
    const c0 = Math.max(0, Math.floor(cx - rw)), c1 = Math.min(cols, Math.ceil(cx + rw)), r0 = Math.max(0, Math.floor(cy - rh)), r1 = Math.min(rows, Math.ceil(cy + rh));
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      if (depth >= ZB[i]) continue;
      const nx = (c + 0.5 - cx) / rw, ny = (r + 0.5 - cy) / rh, d = Math.hypot(nx, ny);
      if (d >= 1) continue;
      const dens = (1 - d * d) * (0.3 + 0.8 * noise(nx * 2.6 + p.seed, ny * 2.6 - T * 0.25, 991)) * Math.min(1, p.life * 1.6) * (p.kind === 'vape' ? 1.15 : 0.85); // (holds together most of its life, thins out at the end)
      if (dens < 0.22 || dens < 0.4 && hash(c, r, 993) > 0.6) continue; // thin: the world shows through
      hazeCell(i, dens, p.kind);
    }
  }
  if (inside > 0.12) for (let i = 0; i < CH.length; i++) { // in the thick of it: the whole view clouds over
    const dens = inside * (0.3 + 0.7 * noise((i % cols) * 0.15, (i / cols | 0) * 0.3 - T * 0.3, 992));
    if (dens > 0.3 && hash(i, 7, 994) > 0.35) hazeCell(i, dens * 0.6, insideKind);
  }
}
function hazeCell(i, dens, kind) {
  if (kind === 'soot') { // a burning car's: thick and black
    set(i, dens > 0.6 ? '%' : dens > 0.4 ? '~' : ':', C(GRAY, 2 + dens * 3)); if (dens > 0.45) BG[i] = C(GRAY, 0.3 + dens * 0.8); FOGS[i] = 0; return;
  }
  if (kind === 'fwsmoke') { // a firework's: faint against the night, lit up in the colour of each burst after it
    const flash = Math.exp(-(T - fwLight.t) * 2.5), col = flash > 0.15 ? fwLight.col : GRAY;
    set(i, dens > 0.6 ? '%' : dens > 0.4 ? '~' : ':', C(col, (1.2 + dens * 2.5) * (0.5 + flash * 2))); if (dens > 0.55) BG[i] = C(col, dens * (0.25 + flash * 1.2)); FOGS[i] = 0; return;
  }
  const vape = kind === 'vape', lit = Math.max(vape ? 0.7 : 0.35, amb) * (kind === 'steam' ? 1.25 : 1); // (steam: whiter; a vape cloud's thick and pale, even at night)
  set(i, dens > 0.7 ? '%' : dens > 0.5 ? '~' : dens > 0.33 ? ':' : '.', C(vape ? (dens > 0.55 ? YEL : WARM) : dens > 0.55 ? WHITE : GRAY, (5 + dens * 9) * lit));
  if (dens > (vape ? 0.5 : 0.7)) BG[i] = vape ? C(WARM, (1.2 + dens * 2.2) * lit) : C(GRAY, (0.8 + dens * 1.2) * lit); // (only the thick middle hides what's behind)
  FOGS[i] = 0;
}
