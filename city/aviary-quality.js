// The aviary: its painted mesh, grass, pond and sprite trees, built properly.
// The walls are steel posts and rails with fine mesh between, the planting and
// sky behind it seen darker through the mesh. Fine mesh is never resolved, so
// it is an average, and posts and rails filter with distance. The trees are
// tapered trunks with limbs into a crown of leaf clumps, lit by their own
// normals, with a leafy mottle that settles to plain colour far off.
const AVIARY_POST = { pitch: 2, width: .1 }, AVIARY_RAIL = { pitch: 1.75, width: .08 }, AVIARY_KERB = .4;
const AVIARY_POND = { x: 7, y: 6, rx: 2, ry: 1.2, rim: .16 };
// [x, y, scale]: the sprite trees' old spots, so routes and the birds' loops are unchanged
const AVIARY_TREES = [[3, 3, 1.2], [10.5, 3.5, 1.4], [4, 8.5, 1], [11, 8, 1.1]].map(([x, y, s], k) => aviaryTreeShape(x, y, s, k));
function aviaryTreeShape(x, y, s, k) {
  const trunk = { r0: .11 * s, r1: .06 * s, h: 2.1 * s }, crown = 2.1 * s + .55 * s, clumps = [], limbs = [];
  const n = 7, spread = .75 * s;
  for (let j = 0; j < n; j++) {
    const ang = j / n * Math.PI * 2 + hash(k, j, 871) * .7, out = j === n - 1 ? 0 : spread * (.65 + hash(k, j, 872) * .35);
    const cx = x + Math.cos(ang) * out, cy = y + Math.sin(ang) * out, cz = crown + (j === n - 1 ? .45 * s : (hash(k, j, 873) - .5) * .5 * s);
    clumps.push({ x: cx, y: cy, z: cz, r: (j === n - 1 ? .62 : .5 + hash(k, j, 874) * .16) * s });
    if (j < n - 1 && j % 2 === 0) limbs.push({ ax: x, ay: y, az: trunk.h * .78, bx: x + (cx - x) * .7, by: y + (cy - y) * .7, bz: cz - .1 * s, r: .035 * s });
  }
  return { x, y, s, k, trunk, clumps, limbs, top: Math.max(...clumps.map(c => c.z + c.r)) };
}
// A vertical tapered trunk: radius r0 at the floor narrowing to r1 at h.
function aviaryTrunkRay(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, k = (b.r0 - b.r1) / b.h, a0 = b.r0 - k * oz, b0 = -k * rz;
  const A = rx * rx + ry * ry - b0 * b0, B = x * rx + y * ry - a0 * b0, D0 = x * x + y * y - a0 * a0, D = B * B - A * D0;
  if (D < 0 || Math.abs(A) < 1e-12) return -1;
  const q = Math.sqrt(D);
  for (const t of [(-B - q) / A, (-B + q) / A].sort((p, q2) => p - q2)) {
    if (t < .01) continue;
    const z = oz + rz * t;
    if (z < 0 || z > b.h || a0 + b0 * t <= 0) continue;
    const hx = x + rx * t, hy = y + ry * t, rad = Math.hypot(hx, hy) || 1, len = Math.hypot(1, k);
    HIT.face = 0; HIT.u = Math.atan2(hy, hx); HIT.w = z; HIT.nx = hx / rad / len; HIT.ny = hy / rad / len; HIT.nz = k / len;
    return t;
  }
  return -1;
}
function aviaryBark(i, t, L) {
  const ridge = coveDetail(t, .4) * Math.sin(HIT.u * 9 + Math.sin(HIT.w * 3) * .6) * .45;
  BG[i] = C(BRICK, (1 + L * .22) * coveLight(HIT.nx || 0, HIT.ny || 0, HIT.nz || 0) + ridge);
  return set(i, ' ', 0), true;
}
function aviaryLimb(i, t, L) { BG[i] = C(BRICK, .9 + L * .18); return set(i, ' ', 0), true; }
// leaf clumps: lighter on top and toward the light, mottled up close in world space
function aviaryLeaves(seed) {
  return (i, t, L) => {
    const nx = HIT.u, ny = HIT.v, nz = HIT.w, b = AVIARY_VIEW.clump, wx = b.wx + nx * b.r, wy = b.wy + ny * b.r, wz = b.wz + nz * b.r;
    const fine = coveDetail(t, .5), mottle = fine ? (noise(wx * 6 + seed, wy * 6 + wz * 4, 875) - .5) * 2.2 * fine : 0;
    BG[i] = C(GREEN, Math.max(1, (1.4 + L * .36) * (.4 + .8 * coveLight(nx, ny, nz)) + mottle));
    return set(i, ' ', 0), true;
  };
}
const AVIARY_VIEW = { clump: null };
function drawAviaryTree(tree, vx, vy) {
  const dx0 = vx - tree.x, dy0 = vy - tree.y; // (model space to view space)
  drawBox({ x: vx, y: vy, c: 1, s: 0, hl: tree.trunk.r0 + .01, hw: tree.trunk.r0 + .01, z0: 0, z1: tree.trunk.h, ...tree.trunk, aviaryTrunk: true }, aviaryBark, aviaryTrunkRay);
  for (const l of tree.limbs) drawRod(l.ax + dx0, l.ay + dy0, l.az, l.bx + dx0, l.by + dy0, l.bz, l.r, aviaryLimb);
  tree.clumps.forEach((c, j) => {
    drawBox({ x: c.x + dx0, y: c.y + dy0, c: 1, s: 0, hl: c.r, hw: c.r, z0: c.z - c.r, z1: c.z + c.r, aviaryClump: true }, (i, t, L) => {
      AVIARY_VIEW.clump = { wx: c.x, wy: c.y, wz: c.z, r: c.r }; return tree.leaves(i, t, L);
    }, raySphere);
  });
}
const AVIARY_TREE = tree => {
  tree.leaves = aviaryLeaves(tree.k * 13.7);
  return { ...ROOM_MODEL(tree.x, tree.y, (vx, vy) => drawAviaryTree(tree, vx, vy), [tree.trunk.r0 + .04, tree.trunk.r0 + .04, tree.trunk.h]), radius: 1.6 * tree.s, aviaryTree: tree };
};
// the sky by the time of day, as the old painters had it
const aviarySky = (k = 1) => day > 0.3 ? C(CYAN, (2 + day * 4) * k) : dusk > 0.3 ? C(ORANGE, 3 * k) : C(BLUE, 1 * k);
function aviaryWallFinish(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), fp = Math.max(uStep, d / projY);
  if (z < AVIARY_KERB) { BG[i] = C(GRAY, 1.6 + L * .14 - 3 * coveGroove(u, 2, .006, fp)); return set(i, ' ', 0), true; } // a concrete kerb the mesh stands on
  // planting outside, thinning toward the roof, seen dim and cool through the mesh (the posts and rails are built: AVIARY_FRAME)
  const leaf = noise(u * 1.3, z * 1.3, 851) > 0.48 - 0.3 * (1 - z / 7), fine = clamp(1 - fp / .25, 0, 1);
  if (leaf) BG[i] = C(GREEN, .7 + L * .04 + (noise(u * 5, z * 5, 876) - .5) * .8 * fine);
  else BG[i] = aviarySky(.75);
  return set(i, ' ', 0), true;
}
// The mesh's steel: a post every 2 m round the walls and rails along them, standing on the kerb and meeting the roof
// rail, and roof ribs over the room. Built, so they keep their width at any distance.
function aviarySteel(i, t, L) { BG[i] = C(GRAY, 1.1 + L * .17); return set(i, ' ', 0), true; }
// each bar drawn as a rod down its long axis: rods keep at least a cell's width, so far bars stay continuous lines
function aviaryBar(b, shade) {
  const hz = (b.z1 - b.z0) / 2, zc = (b.z0 + b.z1) / 2, x = b.x - px, y = b.y - py;
  if (hz >= b.hl && hz >= b.hw) { const r = Math.max(b.hl, b.hw); return drawRod(x, y, b.z0 + r, x, y, b.z1 - r, r, shade); }
  // long rails in short lengths, so each rod's screen bounds stay tight
  const alongX = b.hl >= b.hw, half = alongX ? b.hl : b.hw, r = Math.max(alongX ? b.hw : b.hl, hz), n = Math.max(1, Math.ceil(half / 1.2));
  for (let k = 0; k < n; k++) {
    const s0 = -half + 2 * half * k / n, s1 = -half + 2 * half * (k + 1) / n;
    if (alongX) drawRod(x + s0, y, zc, x + s1, y, zc, r, shade); else drawRod(x, y + s0, zc, x, y + s1, zc, r, shade);
  }
}
function AVIARY_FRAME(W, H, h) {
  const boxes = [], post = AVIARY_POST.width / 2, rail = AVIARY_RAIL.width / 2;
  const walls = [[1, 1, 1, H - 1], [W - 1, 1, W - 1, H - 1], [1, 1, W - 1, 1], [1, H - 1, W - 1, H - 1]];
  for (const [x0, y0, x1, y1] of walls) {
    const along = x0 === x1 ? 'y' : 'x', len = along === 'y' ? y1 - y0 : x1 - x0, nx = x0 === x1 ? (x0 === 1 ? 1 : -1) : 0, ny = nx ? 0 : (y0 === 1 ? 1 : -1);
    const at = (s, off) => along === 'y' ? [x0 + nx * off, y0 + s] : [x0 + s, y0 + ny * off];
    for (let s = 0; s <= len + 1e-6; s += AVIARY_POST.pitch) { const [x, y] = at(s, post); boxes.push(boxAt(x, y, 1, 0, post, post, AVIARY_KERB, h)); }
    for (let z = AVIARY_KERB + AVIARY_RAIL.pitch; z < h + 1e-6; z += AVIARY_RAIL.pitch) {
      const [x, y] = at(len / 2, rail), zz = Math.min(z, h - rail);
      boxes.push(boxAt(x, y, 1, 0, along === 'x' ? len / 2 : rail, along === 'y' ? len / 2 : rail, zz - rail, zz + rail));
    }
    const [x, y] = at(len / 2, rail); boxes.push(boxAt(x, y, 1, 0, along === 'x' ? len / 2 : rail, along === 'y' ? len / 2 : rail, h - 2 * rail, h)); // the roof rail
  }
  for (let x = 1 + AVIARY_POST.pitch; x < W - 1; x += AVIARY_POST.pitch) boxes.push(boxAt(x, H / 2, 1, 0, .07, H / 2 - 1, h - .18, h));
  for (let y = 1 + AVIARY_POST.pitch; y < H - 1; y += AVIARY_POST.pitch) boxes.push(boxAt(W / 2, y, 1, 0, W / 2 - 1, .07, h - .18, h));
  return { x: W / 2, y: H / 2, radius: Math.hypot(W, H), walk: true, aviaryFrame: { boxes }, draw: () => { for (const b of boxes) aviaryBar(b, aviarySteel); } };
}
ROOM_CEILS.aviaryMesh = (i, r, x, wx, wy) => {
  const h = room.def.height || 7, fp = homeBalconyPavingFootprint((h - eye) * projY / Math.max(.5, hor - r - .5), h - eye);
  BG[i] = aviarySky(.75 - .1 * clamp(fp / .2, 0, 1)); return set(i, ' ', 0);
};
function aviaryGround(i, wx, wy, f, fp) {
  const p = AVIARY_POND, e = 1 - Math.hypot((wx - p.x) / p.rx, (wy - p.y) / p.ry), fine = clamp(1 - fp / .2, 0, 1);
  if (e > 0) { // the pond: dark water, slow ripples that calm with distance
    const ripple = (noise(wx * 3 + T * .3, wy * 3, 852) - .5) * 1.6 * fine;
    BG[i] = C(BLUE, 1 + f * 2 + ripple); FL[i] = 3; return set(i, ' ', 0);
  }
  if (e > -p.rim / Math.min(p.rx, p.ry)) { BG[i] = C(GRAY, 1.2 + f * 1.4 + (noise(wx * 7, wy * 7, 849) - .5) * 1.2 * fine); return set(i, ' ', 0); } // a ring of flat stones
  if (Math.abs(wx - 7) < 0.5 && wy > 7.2) { BG[i] = C(WARM, 1.6 + f * 2 + (hash(Math.floor(wx * 30), Math.floor(wy * 30), 877) - .5) * 1.2 * fine); return set(i, ' ', 0); } // the gravel path in
  BG[i] = C(GREEN, .9 + f * 1.8 + (noise(wx * 4, wy * 4, 878) - .5) * 1.4 * fine + (noise(wx * .7, wy * .7, 879) - .5) * .8);
  return set(i, ' ', 0);
}
ROOM_FLOORS.aviaryGrass = (i, f, wx, wy, r) => aviaryGround(i, wx, wy, f, homeBalconyPavingFootprint(eye * projY / (r - hor + .5), eye));
{
  const props = ROOM_DEFS.aviary.props, def = ROOM_DEFS.aviary;
  def.props = r => [...props(r).filter(o => !(o.art === ART.tree)), ...AVIARY_TREES.map(AVIARY_TREE), AVIARY_FRAME(r.W, r.H, r.def.height || 7)];
  def.wall = aviaryWallFinish;
  def.footstepFloor = def.floor;
  def.floor = 'aviaryGrass';
  def.ceil = 'aviaryMesh';
}
