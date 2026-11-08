'use strict';
// ---- the ivy up the Belle Époque buildings (WORLD_QUALITY item 46). Three woody stems climb from the corner, wandering
// and thinning as they go, each with its own height; round them a mat of separate leaves, each lit from above with its
// own tone and a little shadow under it on the stone. The leaves are fresh in spring, deep green in summer, red, orange
// and gold in autumn, and in winter mostly gone, the stems showing. Far off, where a leaf is smaller than a cell, the
// leaves merge into clumps, and then into the share of the wall they cover, instead of speckling.

const IVY_LEAF = .03; // the leaf grid (cells): a leaf about 30cm across, as a mature ivy's are with their clusters
// where stem k is across the wall at height z, and how high it gets
function ivyStem(b, k, z) {
  const s = b.seed * 8 + k * 2.1, root = .2 + k * .09;
  return root + Math.sin(z * (2.6 + k * .7) + s) * (.1 + k * .03) + z * (.11 - k * .035);
}
const ivyTop = (b, k, h) => Math.min(h - .25, 2.5) * (.62 + .38 * fract(b.seed * (17 + k * 13)));
// the nearest stem's distance (across the wall) at height z, and how far up that stem is (0 at the root, 1 at its tip)
function ivyNearest(b, along, z, h) {
  let best = 9, up = 1;
  for (let k = 0; k < 3; k++) {
    const top = ivyTop(b, k, h);
    if (z > top) continue;
    const d = Math.abs(along - ivyStem(b, k, z));
    if (d < best) { best = d; up = z / top; }
  }
  return [best, up];
}
// the leaf colour this season: [base, level] for one leaf, from its hash; null where winter has stripped it
function ivyLeaf(q) {
  const sn = seasonIdx();
  if (sn === 0) return [GREEN, 1.7 + q * .9]; // fresh: light, a few still yellowish at the tips
  if (sn === 1) return [GREEN, 1.1 + q * .6]; // deep summer green
  if (sn === 2) return [[RED, ORANGE, BRICK, YEL, RED][Math.floor(q * 5)], 1.6 + q * .8]; // autumn
  return q > .85 ? [BRICK, 1 + q * .4] : null; // winter: a few dry leaves hang on
}
function belleIvy(i, along, z, h, b, L, fp) {
  const [dist, up] = ivyNearest(b, along, z, h);
  const reach = .1 * (1 - up * .5) + .025; // the mat is widest low down, thinning to the tips
  if (dist > reach + .06) return false;
  const stemW = .011 - up * .005, winter = seasonIdx() === 3;
  // the leaf grid: a leaf each cell up close; further off, clumps of them, so it keeps its texture instead of speckling
  let G = IVY_LEAF, lvl = 0;
  while (fp > G * .55 && G < .2) { G *= 2; lvl++; }
  if (G >= .2) { // so far off a clump is under a cell: the share of the wall it covers, in the season's colour
    const cover = clamp(1 - dist / reach, 0, 1) * (winter ? .2 : .8);
    if (cover < .35) return false;
    const col = ivyLeaf(hash(Math.floor(along * 6), Math.floor(z * 6), 943)) || [BRICK, 1.1];
    BG[i] = C(col[0], col[1] * .85 + L * .12); return set(i, ' ', 0), true;
  }
  const gu = Math.floor(along / G), gz = Math.floor(z / G);
  const leafAt = (cu, cz) => { // the leaf (or clump) in a grid cell, if there is one: its centre, tone, colour
    const q = hash(cu + lvl * 7919, cz, Math.floor(b.seed * 997)), cx = (cu + .5 + (hash(cz, cu, 941 + lvl) - .5) * .5) * G, cy = (cz + .5 + (hash(cu, cz, 942 + lvl) - .5) * .5) * G;
    const [dd] = ivyNearest(b, cx, cy, h);
    if (dd > reach || q < .25 + dd / reach * .6) return null; // (patchier toward the edge of the mat)
    const col = ivyLeaf(q);
    return col && { cx, cy, q, col };
  };
  for (const [cu, cz] of [[gu, gz], [gu - 1, gz], [gu + 1, gz], [gu, gz - 1], [gu, gz + 1]]) {
    const lf = leafAt(cu, cz);
    if (!lf) continue;
    const du = (along - lf.cx) / (G * .62), dz = (z - lf.cy) / (G * .5), r = du * du + dz * dz;
    if (r > 1) continue;
    const lit = .75 + (dz + .4) * .35 - du * .1; // lit from above and the left: the upper face of each leaf brighter
    BG[i] = C(lf.col[0], lf.col[1] * lit + L * .14 - (r > .8 ? .4 : 0)); // (its edge a touch darker)
    return set(i, ' ', 0), true;
  }
  if (dist < Math.max(stemW, fp * .5)) { BG[i] = C(BRICK, (winter ? 1.2 : .9) + L * .12); return set(i, ' ', 0), true; } // the woody stem
  const above = leafAt(gu, gz + 1); // the leaf just above, its shadow on the stone below it
  if (above && z < above.cy - G * .35 && Math.abs(along - above.cx) < G * .5) { BG[i] = C(GRAY, 1.5 + L * .15); return set(i, ' ', 0), true; }
  return false;
}
