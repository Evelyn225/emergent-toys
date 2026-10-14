// ===== the police helicopter on screen (crime.js flies it, at 5 stars): a navy body with a white band and a glass
// nose, a tail boom and fin, skids, the rotor a blur of a disc with its two blades going round, a red light blinking
// under the tail; and its searchlight, a beam slanting down to a pool of light on the street (or the roof it's on).
// The rotor thuds, louder the nearer it is.
function drawChopper() {
  if (!heli) return;
  const vx = rel(heli.x - px), vy = rel(heli.y - py), z = heli.z, hx = Math.cos(heli.h), hy = Math.sin(heli.h), sx = -hy, sy = hx;
  if (Math.hypot(vx, vy) > vis + 4) return;
  const lx = rel(heli.sx - px), ly = rel(heli.sy - py), ground = map[idx(Math.floor(heli.sx), Math.floor(heli.sy))] || 0;
  const strength = 0.35 + 0.65 * Math.max(night, overcast * 0.6); // (much plainer by night)
  // the pool of light: brightest in the middle, fading to its edge
  drawBox(boxAt(lx, ly, 1, 0, SPOT_R, SPOT_R, ground + 0.0003, ground + 0.0008), (i, t, L) => {
    const r = Math.hypot(HIT.u, HIT.v) / SPOT_R, k = (1 - r * r) * strength;
    BG[i] = C(WHITE, 3 + k * 9); set(i, k > 0.55 ? ' ' : '.', C(YEL, 6 + k * 8)); FOGS[i] = 0; return true;
  }, rayCopperDrum);
  // the beam: specks of light down the line from the helicopter's belly to the pool, in front of whatever's behind
  const bx = vx + hx * 0.12, by = vy + hy * 0.12, bz = z - 0.1;
  for (let k = 1; k < 48; k++) {
    const f = k / 48, x = bx + (lx - bx) * f, y = by + (ly - by) * f, wz = bz + (ground - bz) * f, depth = dx * x + dy * y;
    if (depth < 0.2 || depth > vis) continue;
    const c = Math.floor(cols / 2 + (-dy * x + dx * y) * projX / depth), r = Math.floor(hor - (wz - eye) * projY / depth);
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    const i = r * cols + c;
    if (depth >= ZB[i] || hash(c, r, Math.floor(T * 12)) > 0.75) continue;
    set(i, ':', C(WHITE, 5 + strength * 9)); FOGS[i] = 0;
  }
  // the machine itself
  const navy = (i, t, L) => {
    const band = Math.abs(HIT.w - (z - 0.015)) < 0.012; // a white band down each side
    BG[i] = band ? C(WHITE, 4 + L * 0.4) : C(BLUE, (1 + L * 0.25) * shadeFace(HIT.face));
    return set(i, band && HIT.face > 2 && HIT.face < 5 ? '=' : ' ', C(GRAY, 3)), true;
  };
  const glass = (i, t, L) => { BG[i] = C(CYAN, 1.5 + L * 0.2); return set(i, ' ', 0), true; };
  drawBox(boxAt(vx, vy, hx, hy, 0.19, 0.075, z - 0.08, z + 0.05), navy); // the cabin
  dot(vx + hx * 0.18, vy + hy * 0.18, z - 0.02, 0.07, glass); // the glass nose
  rod(vx - hx * 0.17, vy - hy * 0.17, z, vx - hx * 0.7, vy - hy * 0.7, z + 0.04, 0.022, BLUE, 1); // the tail boom
  drawBox(boxAt(vx - hx * 0.7, vy - hy * 0.7, hx, hy, 0.05, 0.008, z, z + 0.14), navy); // the fin
  for (const e of [-1, 1]) { // skids on two struts each
    rod(vx + sx * e * 0.08 + hx * 0.2, vy + sy * e * 0.08 + hy * 0.2, z - 0.15, vx + sx * e * 0.08 - hx * 0.18, vy + sy * e * 0.08 - hy * 0.18, z - 0.15, 0.008, GRAY, 1.1);
    for (const f of [-0.1, 0.1]) rod(vx + sx * e * 0.05 + hx * f, vy + sy * e * 0.05 + hy * f, z - 0.08, vx + sx * e * 0.08 + hx * f, vy + sy * e * 0.08 + hy * f, z - 0.15, 0.006, GRAY, 1.1);
  }
  rod(vx, vy, z + 0.05, vx, vy, z + 0.1, 0.012, GRAY, 1); // the mast
  drawBox(boxAt(vx, vy, 1, 0, 0.55, 0.55, z + 0.1, z + 0.106), (i, t, L) => { // the rotor: two blades round and round, a blur between
    const ang = Math.atan2(HIT.v, HIT.u), blade = Math.abs(fract(ang / Math.PI - T * 4.3) - 0.5) > 0.46;
    if (!blade && hash(i, Math.floor(T * 30), 7) > 0.22) return false; // (see-through)
    return set(i, blade ? '=' : '-', C(GRAY, L * (blade ? 0.8 : 0.4))), true;
  }, rayCopperDrum);
  if (fract(T * 1.2) < 0.25) dot(vx - hx * 0.6, vy - hy * 0.6, z - 0.01, 0.025, (i, t, L) => { BG[i] = C(RED, 12); return set(i, '*', C(WHITE, 15)), true; }); // the beacon
}
// the rotor's thud-thud-thud: one low pulse every tenth of a second or so, louder close by, panned to its side
let chopperBeat = 0;
function stepChopperSound(dt) {
  if (!heli || !actx || paused || (chopperBeat -= dt) > 0) return;
  chopperBeat = 0.105;
  const vx = rel(heli.x - px), vy = rel(heli.y - py), d = Math.hypot(vx, vy, heli.z), loud = clamp(1 - d / 40, 0, 1);
  if (loud <= 0) return;
  const pan = clamp((-dy * vx + dx * vy) / Math.max(1, d), -1, 1), at = actx.currentTime;
  tone(at, 48 + Math.random() * 6, 0.08, 0.05 * loud * loud, 'sawtooth', pan);
  tone(at, 95, 0.03, 0.025 * loud, 'square', pan);
}
