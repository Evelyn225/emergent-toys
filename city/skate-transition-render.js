// Non-convex profile ray: test every extruded segment and keep the nearest.
// Box culling in drawBox bounds this work to the ramp's projected rectangle.
function rayProfile(ox, oy, oz, rx, ry, rz, b) {
  const p = b.profile, qx = ox - b.x, qy = oy - b.y;
  const u = qx * b.c + qy * b.s, v = -qx * b.s + qy * b.c, z = oz - b.z0;
  const du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let nearest = Infinity, face = 0, nx = 0, nz = 1;
  const take = (t, f, xnormal, znormal) => {
    if (t > .01 && t < nearest && Math.abs(v + dv * t) <= b.hw + 1e-9) { nearest = t; face = f; nx = xnormal; nz = znormal; }
  };
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1], c = p.points[i], ex = c[0] - a[0], ez = c[1] - a[1];
    const det = du * ez - rz * ex;
    if (Math.abs(det) < 1e-12) continue;
    const t = ((a[0] - u) * ez - (a[1] - z) * ex) / det;
    const s = ((a[0] - u) * rz - (a[1] - z) * du) / det;
    if (s < 0 || s > 1) continue;
    const len = Math.hypot(ex, ez);
    take(t, 7, -ez / len, ex / len);
  }
  // Coping tubes, 6 cm diameter, extruded along the width.
  const denom = du * du + rz * rz;
  if (denom > 1e-12) for (const side of [-1, 1]) {
    const x = u - side * p.tip, zz = z - p.height, mid = x * du + zz * rz;
    const disc = mid * mid - denom * (x * x + zz * zz - .003 * .003);
    if (disc < 0) continue;
    const t = (-mid - Math.sqrt(disc)) / denom;
    take(t, 9, (x + du * t) / .003, (zz + rz * t) / .003);
  }
  // Closed extrusion ends and backs. A side hit must be under the profile,
  // rather than the empty space above the bowl of the ramp.
  if (Math.abs(dv) > 1e-12) for (const side of [-1, 1]) {
    const t = (side * b.hw - v) / dv, x = u + du * t, zz = z + rz * t;
    if (Math.abs(x) > p.tip + p.deck || zz < 0 || zz > skateProfileHeight({ profile: p, z0: 0 }, x)) continue;
    if (t > .01 && t < nearest) { nearest = t; face = side > 0 ? 3 : 4; nx = 0; nz = 0; }
  }
  if (Math.abs(du) > 1e-12) for (const side of [-1, 1]) {
    const t = (side * (p.tip + p.deck) - u) / du, zz = z + rz * t;
    if (zz >= 0 && zz <= p.height) take(t, side > 0 ? 1 : 2, side, 0);
  }
  if (!Number.isFinite(nearest)) return -1;
  HIT.face = face; HIT.u = u + du * nearest; HIT.v = v + dv * nearest; HIT.w = oz + rz * nearest;
  if (face === 7 && nz > .01 && Math.abs(HIT.u) < p.tip) {
    const at = skateProfilePoint(p, skateProfileU(p, HIT.u)); nx = -at.tz; nz = at.tx;
  }
  HIT.nx = b.c * nx; HIT.ny = b.s * nx; HIT.nz = nz;
  return nearest;
}
SOLID_SHADE.skateprofile = o => (i, t, L) => {
  if (HIT.face === 9) { BG[i] = SK_STEEL(L, true); return set(i, ' ', 0), true; }
  const curved = HIT.face === 7, light = curved ? .45 + .55 * Math.max(0, HIT.nz) : .5, foot = t / projY;
  const seam = !o.bowl && curved ? coveGroove(HIT.v, .3, .001, t / projX) : 0;
  let wear = 0, ch = ' ';
  if (curved) { // the transition: rubber streaks up and down it, thickest across the middle where the lines go; at the top a band
    // polished by trucks just under the coping, and on the flat deck a strip of diamond-plate steel along the edge
    const [wx, wy] = skWorld(o, HIT.u, HIT.v), mid = 1 - Math.abs(HIT.v) / o.hw, p = o.profile, height = HIT.w - o.z0;
    wear = skWheelMarks(wx, wy, o.c, o.s, .35 + mid * .65, foot) * 1.1 - (p && height > p.height - .03 && Math.abs(HIT.u) <= p.tip ? .35 : 0);
    if (p && Math.abs(HIT.u) > p.tip && Math.abs(HIT.u) < p.tip + .025) { // (the deck plate)
      const diamond = foot < .004 && Math.abs(fract((HIT.u + HIT.v) * 120) - .5) < .12 && Math.abs(fract((HIT.u - HIT.v) * 120) - .5) < .12;
      BG[i] = C(GRAY, 2.6 + L * .3 + (diamond ? .8 : 0)); return set(i, ' ', 0), true;
    }
  } else if (!o.bowl && (HIT.face === 3 || HIT.face === 4)) { // its side walls: rust down from the coping, and some carry a tag
    const p = o.profile, h = p ? skateProfileHeight({ profile: p, z0: 0 }, HIT.u) : 0;
    if (p && skSideTag({ ...o, hl: p.tip + p.deck }, i, HIT.face, HIT.u, HIT.w - o.z0, h, t, L)) return true;
    const drip = hash(Math.floor(HIT.u * 160 + o.x * 7), 2, 2119);
    if (p && drip > .86 && h - (HIT.w - o.z0) < .012 + drip * .03) { BG[i] = C(BRICK, 2.1 + L * .2); return set(i, ' ', 0), true; } // (thin runs of rust from under the coping)
  }
  BG[i] = C(GRAY, (3.5 + L * .32) * light * (1 - seam * .18) - wear * 2);
  return set(i, ch, 0), true;
};
