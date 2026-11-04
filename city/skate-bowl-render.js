// A swept polyline is a series of conical frusta, planes and cylinders. Test
// all of them, including the 6 cm coping ring, keeping the nearest valid root.
function rayBowlProfile(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, z = oz - b.z0, p = b.profile;
  const Axy = rx * rx + ry * ry, Bxy = 2 * (x * rx + y * ry), Cxy = x * x + y * y;
  let nearest = Infinity, face = 0, normal = [0, 0, 1];
  const roots = (a, bb, c) => {
    if (Math.abs(a) < 1e-12) return Math.abs(bb) < 1e-12 ? [] : [-c / bb];
    const disc = bb * bb - 4 * a * c;
    if (disc < 0) return [];
    const d = Math.sqrt(disc); return [(-bb - d) / (2 * a), (-bb + d) / (2 * a)];
  };
  const segment = (ra, za, rb, zb, f) => {
    const vertical = Math.abs(rb - ra) < 1e-10, k = vertical ? 0 : (zb - za) / (rb - ra), intercept = za - k * ra;
    const candidates = vertical ? roots(Axy, Bxy, Cxy - ra * ra) : Math.abs(k) < 1e-12
      ? Math.abs(rz) < 1e-12 ? [] : [(za - z) / rz]
      : roots(rz * rz - k * k * Axy, 2 * rz * (z - intercept) - k * k * Bxy, (z - intercept) ** 2 - k * k * Cxy);
    for (const t of candidates) {
      if (t <= .01 || t >= nearest) continue;
      const xx = x + rx * t, yy = y + ry * t, zz = z + rz * t, radius = Math.hypot(xx, yy);
      if (vertical ? zz < Math.min(za, zb) - 1e-8 || zz > Math.max(za, zb) + 1e-8
        : radius < Math.min(ra, rb) - 1e-8 || radius > Math.max(ra, rb) + 1e-8 || Math.abs(zz - k * radius - intercept) > 1e-7) continue;
      nearest = t; face = f;
      const scale = vertical ? 1 : Math.hypot(k, 1), rr = radius || 1;
      normal = vertical ? [-(xx / rr), -(yy / rr), 0] : [-xx / rr * k / scale, -yy / rr * k / scale, 1 / scale];
    }
  };
  const points = p.radialPoints;
  for (let i = 1; i < points.length; i++) segment(...points[i - 1], ...points[i], 7);
  segment(p.tip + p.deck, 0, p.tip + p.deck, p.height, 1);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, bb = (i + 1) / 8 * Math.PI * 2;
    segment(p.tip + .003 * Math.cos(a), p.height + .003 * Math.sin(a), p.tip + .003 * Math.cos(bb), p.height + .003 * Math.sin(bb), 9);
  }
  if (!Number.isFinite(nearest)) return -1;
  const xx = x + rx * nearest, yy = y + ry * nearest, radius = Math.hypot(xx, yy);
  HIT.face = face; HIT.u = radius; HIT.v = Math.atan2(yy, xx) * radius; HIT.w = oz + rz * nearest;
  if (face === 7 && radius < p.tip) {
    const at = skateProfilePoint(p, skateProfileU(p, radius));
    normal = [-xx / (radius || 1) * at.tz, -yy / (radius || 1) * at.tz, at.tx];
  }
  [HIT.nx, HIT.ny, HIT.nz] = normal;
  return nearest;
}
