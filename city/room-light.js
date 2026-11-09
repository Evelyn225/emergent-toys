// ===== light that falls where the lamps are, indoors. A room is otherwise lit evenly; here each screen cell, from its
// depth, finds where it is in the room and is brightened under and near the room's own lights (pendants, paper
// lanterns, spot tracks, the chandeliers) and darkened away from them, so a bar or an izakaya at night has warm pools
// under its lamps and dim corners between. The lights themselves keep their colour. With the switch off there are no
// pools, just the dim room. Homes light themselves (home-lighting-quality.js) and are left alone.
//
// Tired tubes: in the subway station, the storage rooms, and the laundromat late at night, about one tube in six is
// failing (it stutters off now and then) and a few are dead. They count as lights here too, so the floor and walls
// under a failing tube darken with it.

// a tube by its id (any number for the tube) is lit right now: the switch, then whether it's failing
function tubeLit(id) {
  if (!ceilLit()) return false;
  id = Math.round(id * 100); // (ids are sums worked out in more than one order: a hair apart is the same tube)
  if (!room || !tubesTired()) return true;
  const k = room.flakyTube === id ? 0.1 : hash(id, 1, 3401); // (each tired room has one failing for sure)
  if (k < 0.04) return false; // dead
  if (k > 0.2) return true;
  // failing: bursts of stuttering every few seconds, steady between
  return hash(id, Math.floor(T * 0.6 + k * 40), 3402) > 0.3 || hash(id, Math.floor(T * 14), 3403) > 0.45;
}
const tubesTired = () => room.kind === 'station' || room.kind === 'storage' || room.kind === 'laundry' && (tod >= 22 || tod < 5);

// the room's lights: { x, y, z, i (strength), on() }, worked out once per room (they don't move)
function roomLightSources(r = room) {
  if (r.lightSources) return r.lightSources;
  if (r === room) { prepareInteriorBattens(); prepareInteriorHanging(); } // (the fittings are built the first time they're drawn)
  const S = [], top = r.def.height || 3, all = () => ceilLit();
  for (const p of r.props) {
    if (p.ceilingPendant) S.push({ x: p.x, y: p.y, z: top - 0.55, i: 1, on: all });
    else if (p.paperLantern) { const q = p.paperLantern; S.push({ x: p.x, y: p.y, z: q.base + q.height / 2, i: 0.9, on: all }); }
    else if (p.ceilingTrack) for (const sx of p.ceilingTrack.spots) S.push({ x: sx, y: p.y, z: top - 0.3, i: 0.7, on: all });
    else if ((p.ceilingBatten || p.laundryCeilingLight || p.storageCeilingLight) && tubesTired()) { // (only where tubes tire: elsewhere a room of tubes is evenly lit)
      const b = p.ceilingBatten || p.laundryCeilingLight || p.storageCeilingLight, n = b.modules, L = b.length;
      for (let k = 0; k < n; k++) { const y = p.y - L / 2 + L / n * (k + 0.5), id = p.x * 31 + y; S.push({ x: p.x, y, z: top - 0.1, i: 0.8, tube: id, on: () => tubeLit(id) }); }
    }
  }
  if (r.def.ceil === 'chandelier') for (let y = 2; y < r.H; y += 4) for (let x = 2; x < r.W; x += 4) S.push({ x, y, z: top - 0.4, i: 1.1, on: all });
  if (r.kind === 'station') for (let x = 10; x < 37; x += 2.5) for (let y = 1.25; y < r.H; y += 2.5) { const id = Math.round(x / 2.5) * 97 + Math.floor(y / 2.5); S.push({ x, y, z: top - 0.1, i: 0.7, tube: id, on: () => tubeLit(id) }); }
  const tubes = S.filter(s => s.tube != null);
  if (tubes.length) r.flakyTube = Math.round(tubes[Math.floor(hash(r.W, r.H, 3404) * tubes.length)].tube * 100);
  return r.lightSources = S;
}

// after the room's walls, floor, ceiling and things are drawn, before the haze (render.js)
function roomPools() {
  if (!settings.roomPools || !room || homeRecord(room)) return;
  const S = roomLightSources();
  if (!S.length) return;
  const lit = S.filter(s => s.on()), base = 0.38, reach2 = 1.35 * 1.35; // (how dim far from any lamp; a pool's size, metres)
  for (let i = 0, n = cols * rows; i < n; i++) {
    const t = ZB[i];
    if (!(t > 0 && t < 40)) continue;
    const c = i % cols, r = i / cols | 0, cx = 2 * (c + 0.5) / cols - 1;
    const x = px + (dx - dy * tf * cx) * t, y = py + (dy + dx * tf * cx) * t, z = eye + (hor - r - 0.5) * t / projY;
    let e = base;
    for (const s of lit) { const ex = x - s.x, ey = y - s.y, ez = (z - s.z) * 0.8, q = 1 + (ex * ex + ey * ey + ez * ez) / reach2; e += s.i * 0.75 / (q * q); } // (falls off fast: a pool, not a wash)
    const k = Math.min(1.3, e);
    if (Math.abs(k - 1) < 0.04) continue;
    const bg = BG[i];
    if (bg !== NONE && !roomPoolLamp(bg)) BG[i] = roomPoolShade(bg, k);
    const col = COL[i];
    if (CH[i] && CH[i] !== ' ' && !roomPoolLamp(col)) COL[i] = roomPoolShade(col, k);
  }
}
// a colour k times as bright, in its own base (WET's top shade would be NONE: it stops one short)
const roomPoolShade = (c, k) => (c & 0xf0) | Math.max(0, Math.min(c >> 4 === WET ? 14 : 15, Math.round((c & 15) * k)));
// a lamp's own glass or bulb: left as it is
const roomPoolLamp = k => (k & 15) >= 12 && (k >> 4 === WHITE || k >> 4 === WARM || k >> 4 === YEL);

// ---- the glow of a television that's on: a cool, shifting light on whatever's in front of it, falling off with
// distance. Faint with the room's lights on; with them off, it's most of the light there is. (Homes too.)
function tvSources(r = room) {
  const out = [];
  for (const p of r.props) {
    const t = p.television || p.motelTV;
    if (!t) continue;
    const scale = t.scale || 1, angle = p.television ? (t.angle || 0) : Math.PI / 2, lift = t.lift || 0;
    // the screen: 1.13 up (scaled), facing out along the TV's own v axis (home-television.js)
    out.push({ x: p.x - Math.sin(angle) * 0.063 * scale, y: p.y + Math.cos(angle) * 0.063 * scale, z: 1.13 * scale + lift,
      nx: -Math.sin(angle), ny: Math.cos(angle), half: 0.68 * scale });
  }
  return out;
}
function tvGlow() {
  if (!room || !room.tv) return;
  const S = tvSources();
  if (!S.length) return;
  const dark = roomLightsOn(room) ? 0.3 : 1;
  // the picture's brightness and colour wander, with a cut now and then
  const cut = Math.floor(T * 0.45), pulse = 0.62 + 0.25 * Math.sin(T * 2.3 + cut) + 0.13 * Math.sin(T * 7.1);
  const tint = hash(cut, 7, 3411) < 0.35 ? CYAN : BLUE, R2 = 3.2 * 3.2;
  for (let i = 0, n = cols * rows; i < n; i++) {
    const t = ZB[i];
    if (!(t > 0 && t < 30)) continue;
    const c = i % cols, row = i / cols | 0, cx = 2 * (c + 0.5) / cols - 1;
    const x = px + (dx - dy * tf * cx) * t, y = py + (dy + dx * tf * cx) * t, z = eye + (hor - row - 0.5) * t / projY;
    if (x < -0.05 || y < -0.05 || x > room.W + 0.05 || y > room.H + 0.05) continue; // (only in the room: not the view out of its window)
    let g = 0;
    for (const s of S) {
      const ex = x - s.x, ey = y - s.y, ez = z - s.z, front = ex * s.nx + ey * s.ny;
      if (front < 0.06) continue; // (behind or level with the screen: the screen itself, its back, the wall it's on)
      const d2 = ex * ex + ey * ey + ez * ez;
      g += (front / Math.sqrt(d2)) / (1 + d2 / R2);
    }
    if (g < 0.04) continue;
    const a = Math.min(0.8, g * 1.4 * pulse * dark);
    if (BG[i] !== NONE) BG[i] = hazeTint(BG[i], C(tint, 5 + 8 * a), a * 0.85);
  }
}
