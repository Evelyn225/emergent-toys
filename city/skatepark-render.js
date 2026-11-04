// ===== the skatepark drawn (skatepark.js builds it): steel flat bars on posts, granite ledges with steel coping, a
// concrete manual pad, and the park's smooth concrete with its saw-cut joints. Fine detail fades with distance
const SK_STEEL = (L, top) => C(GRAY, (top ? 4.2 : 2.6) + L * .35);
// a flat bar: the round bar along the top, square posts 30 cm in from each end, nothing in between
SOLID_SHADE.skaterail = o => (i, t, L) => {
  const w = HIT.w, bar = w > o.z1 - .005, post = Math.abs(Math.abs(HIT.u) - (o.hl - .03)) < .004;
  if (!bar && !post) return false; // (see-through under the bar)
  BG[i] = SK_STEEL(L, bar && HIT.face === 5); return set(i, ' ', 0), true;
};
// granite: a speckled pale grey block, darker low down where boards scuff it; steel coping along the top edges
SOLID_SHADE.skateledge = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .006 : o.z1 - HIT.w < .006;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const fine = coveDetail(t, .05), fleck = hash(Math.floor((o.x + HIT.u) * 160), Math.floor(HIT.w * 160 + HIT.v * 160), 2101) * fine;
  const scuff = !top && HIT.w < o.z1 * .45 ? .5 : 0;
  BG[i] = C(o.material === 'wood' ? BRICK : STONE, (top ? 4.2 : 3.2 - scuff) * shadeFace(f) + L * .25 + (fleck - .5) * .8); return set(i, ' ', 0), true;
};
// the manual pad: poured concrete, steel angle on its long edges, a joint across the middle
SOLID_SHADE.manualpad = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .005 : o.z1 - HIT.w < .005;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const joint = top ? coveGroove(HIT.u, o.hl, .004, t / projX) : 0;
  BG[i] = C(GRAY, (top ? 4.4 : 3) * shadeFace(f) * (1 - joint * .5) + L * .25); return set(i, ' ', 0), true;
};
// a ramp, ray-cast as the convex solid it is: the box's sides and floor, cut by its slopes (a kicker: one rising to the
// lip at +u; a funbox: up, a flat deck, down). Faces 7 and 8: the slopes up and down
function rayRamp(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y, lu = qx * b.c + qy * b.s, lv = -qx * b.s + qy * b.c, du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let tmin = -Infinity, tmax = Infinity, face = 0;
  const cut = (nu, nv, nz, d, f) => { // keep n.p <= d
    const den = nu * du + nv * dv + nz * rz, dist = d - (nu * lu + nv * lv + nz * oz);
    if (Math.abs(den) < 1e-12) return dist >= 0;
    const t = dist / den;
    if (den < 0) { if (t > tmin) { tmin = t; face = f; } } else if (t < tmax) tmax = t;
    return tmin <= tmax;
  };
  const kick = b.ramp === 'kicker', k = kick ? b.z1 / (2 * b.hl) : b.z1 / b.run;
  if (!cut(1, 0, 0, b.hl, 1) || !cut(-1, 0, 0, b.hl, 2) || !cut(0, 1, 0, b.hw, 3) || !cut(0, -1, 0, b.hw, 4) || !cut(0, 0, -1, -b.z0, 6) || !cut(0, 0, 1, b.z1, 5)) return -1;
  if (!cut(-k, 0, 1, k * b.hl, 7)) return -1; // z <= k (u + hl)
  if (!kick && !cut(k, 0, 1, k * b.hl, 8)) return -1; // z <= k (hl - u)
  if (tmin < 0.01) return -1;
  HIT.face = face; HIT.u = lu + du * tmin; HIT.v = lv + dv * tmin; HIT.w = oz + rz * tmin;
  return tmin;
}
// ramps: smooth grey concrete, the slopes catching the light, steel coping along a funbox's deck edges and a kicker's lip
SOLID_SHADE.skateramp = o => (i, t, L) => {
  const f = HIT.face, slope = f === 7 || f === 8, top = f === 5 || slope, h = rampHeight(o, HIT.u);
  const coping = top && (o.ramp === 'kicker' ? HIT.u > o.hl - .01 : f === 5 && o.hw - Math.abs(HIT.v) < .006) || !top && Math.abs(HIT.w - h) < .004 && (f === 3 || f === 4) && (o.ramp !== 'kicker' || HIT.u > o.hl - .01);
  if (coping) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  BG[i] = C(GRAY, (slope ? (f === 7 ? 4.6 : 3.6) : top ? 4.3 : 2.8 * shadeFace(f)) + L * .25); return set(i, ' ', 0), true;
};
// the park's concrete (floorBaseCell): smooth, pale, saw-cut every 3 m, a few dark scuffs and wax marks
function skateparkFloor(wx, wy, r, x, d) {
  const foot = d / projY, joint = Math.max(coveGroove(wx, .3, .004, foot), coveGroove(wy, .3, .004, foot));
  const scuff = noise(wx * 9, wy * 9, 2102) > .78 ? .8 : 1;
  return [' ', GRAY, (2.3 - joint * .7) * scuff];
}
