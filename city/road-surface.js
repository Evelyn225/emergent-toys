// Roads and pavements as surfaces (pass 16). City units: 1 = 10 m. The street
// used to be a '.' dither on every other cell with ',' pavements, '=' crossings
// and dashes; now it is colour. Asphalt has a faint, filtered grain; pavements
// are 60 cm slabs whose joints thin out with distance; a kerb line runs along
// the pavement edge; the centre dashes and zebra stripes are paint that settles
// to a tint once a cell is wider than a stripe, so they don't break up far off.
// Returns [base, level] for the cell's background, or null to leave the cell to
// the old painter (bridges: pass 17).
const ROAD_SURFACE = { kerb: .3, kerbW: .016, slab: .06, joint: .0035, centreW: .06, dash: .5, stripe: .25 };
// a stripe or line's coverage of a cell: dist from its middle, w its width, fp the cell's footprint
const roadLine = (dist, w, fp) => clamp((w / 2 - dist) / Math.max(fp, 1e-4) + .5, 0, 1) * Math.min(1, w / Math.max(fp, w));
// the share of a repeating band (period p, filled for `fill` of it) a cell covers, filtered to its average far off
function roadBands(u, p, fill, fp) {
  const f = fract(u / p), cov = clamp((fill * p / 2 - Math.min(f, 1 - f) * p) / Math.max(fp, 1e-4) + .5, 0, 1), far = clamp(fp / (p * .5), 0, 1);
  return cov * (1 - far) + fill * far;
}
const roadDark = () => .4 + .6 * day;
function roadSurface(wx, wy, road, lx, ly, bx, by, d, L) {
  const S = ROAD_SURFACE, fp = homeBalconyPavingFootprint(d, eye);
  L *= roadDark(); // (darker at night, so the lamps' pools show)
  const asphalt = (shade = 0) => [GRAY, L * (.3 + shade)];
  const pavement = () => { // slabs in a running bond, joints filtered
    const j = Math.max(coveGroove(wx, S.slab, S.joint, fp), coveGroove(wy + (Math.floor(wx / S.slab) & 1) * S.slab / 2, S.slab, S.joint, fp));
    return [GRAY, L * (.44 - j * .18)];
  };
  if (road === 3) { // intersection: crosswalks across the streets that come in, plain pavement at the corners where none does
    const n = ly < 0.3 ? vseg(bx, by - 1) : ly > 1.7 ? vseg(bx, by) : -1, w = lx < 0.3 ? hseg(bx - 1, by) : lx > 1.7 ? hseg(bx, by) : -1;
    if (n === 0 || w === 0) return pavement();
    if (n === 1 || w === 1) { const z = roadBands(n === 1 ? lx : ly, S.stripe, .5, fp); return z > .5 ? [WHITE, L * (.25 + .4 * z)] : asphalt(z * .25); }
    return asphalt();
  }
  if (road === 1 && onBridge(bx, by)) return null;
  const e = road === 1 ? lx : ly, along = road === 1 ? wy : wx, edge = Math.min(e, 2 - e);
  if (edge < S.kerb - S.kerbW / 2) return pavement();
  if (roadLine(Math.abs(edge - S.kerb + S.kerbW / 2), S.kerbW, fp) > .5 || edge < S.kerb) return [GRAY, L * .62]; // the kerbstones
  // the centre line: dashes up close, a faint continuous tint where a cell spans several of them
  const centre = roadLine(Math.abs(e - 1), S.centreW, fp) * roadBands(along + S.dash / 4, S.dash, .5, fp);
  if (centre > .5) return [YEL, L * .55];
  return asphalt(centre * .2);
}
// plazas and the waterfront: 5 m flagged paving, its joints filtered
function plazaSurface(wx, wy, lx, ly, d, L) {
  L *= roadDark();
  const fp = homeBalconyPavingFootprint(d, eye), j = Math.max(coveGroove(lx, .5, .03, fp), coveGroove(ly, .5, .03, fp));
  return [GRAY, L * (.4 - j * .15)];
}
