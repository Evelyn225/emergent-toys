// static props are bucketed by block, so a frame only visits the ones within draw distance (see forNear)
function bucketed(items) {
  const b = Array.from({ length: NB * NB }, () => []);
  for (const it of items) b[bi(Math.floor(it.x / 8), Math.floor(it.y / 8))].push(it);
  return b;
}
// visit a point on every street segment: `s` along it (block-local 2..8), `o` across it (0..2, 0 = north / west side).
// fn(x, y, ax, ay, bx, by, 'h' | 'v'): ax/ay points from that side toward the middle of the street
function alongStreets(s, o, fn) {
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    if (hseg(bx, by)) fn(bx * 8 + s, by * 8 + o, 0, o < 1 ? 1 : -1, bx, by, 'h');
    if (vseg(bx, by)) fn(bx * 8 + o, by * 8 + s, o < 1 ? 1 : -1, 0, bx, by, 'v');
  }
}

// lamps stand at the curb edge of the sidewalk (sidewalk is 0..0.3), two per block side, a curved arm
// reaching REACH out over the street. {x, y, ax, ay}: ax/ay = the arm's direction
const CURB = 0.25, REACH = 0.24, HEAD = CURB + REACH, LAMP_AT = [3.5, 6.5];
const lamps = [];
for (const s of LAMP_AT) for (const o of [CURB, 2 - CURB]) alongStreets(s, o, (x, y, ax, ay) => lamps.push({ x, y, ax, ay }));
// the footbridge out to the lighthouse: a lamp every 30m, alternating sides, reaching over the deck
const FB_LAMP = 3;
for (let y = FOOTBRIDGE.y0 + 1.5, k = 0; y < FOOTBRIDGE.y1; y += FB_LAMP, k++) { const s = k & 1 ? 1 : -1; lamps.push({ x: FOOTBRIDGE.x + s * FOOTBRIDGE.hw, y, ax: -s, ay: 0 }); }
const lampsB = bucketed(lamps);
// is (x, y) up against a lamp post (grown by pad)? They're solid: you walk round them
function lampAt(x, y, pad) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const l of lampsB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)])
    if (Math.abs(rel(x - l.x)) < 0.028 + pad && Math.abs(rel(y - l.y)) < 0.028 + pad) return true;
  return false;
}
// light pool on the ground, under the lamp heads of whichever streets exist here
function glow(wx, wy) {
  const bx = Math.floor(wx / 8), by = Math.floor(wy / 8), lx = wx - bx * 8, ly = wy - by * 8;
  const ay = Math.min(Math.abs(ly - LAMP_AT[0]), Math.abs(ly - LAMP_AT[1])), ax = Math.min(Math.abs(lx - LAMP_AT[0]), Math.abs(lx - LAMP_AT[1]));
  let d = Infinity;
  if (vseg(bx, by)) d = Math.min(d, Math.hypot(Math.min(Math.abs(lx - HEAD), Math.abs(lx - 2 + HEAD)), ay));
  if (vseg(bx + 1, by)) d = Math.min(d, Math.hypot(8 + HEAD - lx, ay));
  if (hseg(bx, by)) d = Math.min(d, Math.hypot(Math.min(Math.abs(ly - HEAD), Math.abs(ly - 2 + HEAD)), ax));
  if (hseg(bx, by + 1)) d = Math.min(d, Math.hypot(8 + HEAD - ly, ax));
  return Math.max(0, 1 - d / 0.55);
}

// parks: grass, a cross of dirt paths through each block (block-local centre 5), a pond, trees, benches.
// A superblock park also grows over the streets it swallowed.
const POND = [3.5, 3.5, 0.85]; // block-local x, y, base radius
// a lumpy, slightly oval pond outline (different per park); `pad` grows it, for shores and keeping trees out
function inPond(lx, ly, bx, by, pad = 0) {
  const ex = (lx - POND[0]) / 1.15, ey = ly - POND[1], ang = Math.atan2(ey, ex);
  const edge = POND[2] * (0.75 + 0.55 * noise(Math.cos(ang) * 1.4 + bx * 3.1, Math.sin(ang) * 1.4 + by * 2.3, 13));
  return Math.hypot(ex, ey) < edge + pad;
}
// relative to block center, and the way each faces: toward the path through the middle
const BENCH = [[0.35, -2, -1, 0], [0.35, 2, -1, 0], [-2, 0.35, 0, -1], [2, -0.35, 0, 1]];
const trees = [], benches = [], parks = [];
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  const kind = blockKind(bx, by), dist = districtOf(bx, by);
  if (kind === 'park') {
    parks.push([bx, by]);
    for (let k = 0; k < 50; k++) {
      const x = 0.3 + hash(bx, by, k * 2) * 7.4, y = 0.3 + hash(bx, by, k * 2 + 1) * 7.4;
      if (ROAD[idx(bx * 8 + x, by * 8 + y)] || x < 2 && !blockKind(bx - 1, by) || y < 2 && !blockKind(bx, by - 1)) continue;
      if (Math.abs(x - 5) < 0.5 || Math.abs(y - 5) < 0.5 || inPond(x, y, bx, by, 0.4)) continue;
      trees.push({ x: bx * 8 + x, y: by * 8 + y, s: 1 });
    }
    for (const [x, y, fx, fy] of BENCH) benches.push({ x: bx * 8 + 5 + x, y: by * 8 + 5 + y, fx, fy });
  }
  if (kind === 'waterfront') for (let k = 0; k < 4; k++) { // promenade: trees and benches facing the water
    const x = bx * 8 + 1 + k * 2, south = by === SHORE_S, y = south ? by * 8 + 2.35 : by * 8 + 7.6;
    if (onBridge(bx, by) && k === 0 || south && Math.abs(x - FOOTBRIDGE.x) < 1.5) continue; // (keep the way onto the footbridge clear)
    if (k & 1) benches.push({ x, y, fx: 0, fy: south ? 1 : -1 }); else trees.push({ x, y, s: 0.8 }); // facing the water
  }
}
// street trees down the brownstone blocks, between the lamps
// (the north / west sidewalk borders the block on the far side of the street, the other one block (bx, by))
alongStreets(5, CURB, (x, y, ax, ay, bx, by, o) => {
  if (districtOf(o === 'h' ? bx : bx - 1, o === 'h' ? by - 1 : by) === 'brownstones') trees.push({ x, y, s: 0.75 });
});
alongStreets(5, 2 - CURB, (x, y, ax, ay, bx, by) => { if (districtOf(bx, by) === 'brownstones') trees.push({ x, y, s: 0.75 }); });
// the island: benches looking out to sea either side of the lighthouse
benches.push({ x: ISLE.x - 2.2, y: ISLE.y + 0.8, fx: -1, fy: 0 }, { x: ISLE.x + 2.6, y: ISLE.y - 0.6, fx: 1, fy: 0 });
// the Botanical Gardens: trees wherever there's lawn to spare, benches along the paths facing across them
const gx2w = (gx, gy) => [GARDEN.x0 + gx, GARDEN.y0 + gy];
const GARDEN_PENS = [{ gx0: 16, gy0: 0.5, gx1: 21.4, gy1: 2.7, kind: 'bear' }, { gx0: 5.2, gy0: 10.6, gx1: 7.8, gy1: 12.8, kind: 'tortoise' }];
const GARDEN_BEDS = [[4.5, 5.6, 1.4, 0.45], [12.5, 1.2, 2.2, 0.5], [18.4, 4.7, 1.2, 0.4], [14.5, 13.3, 2.4, 0.35], [1.0, 4.0, 0.45, 1.6], [9.6, 5.4, 0.6, 0.6], [1.4, 12.6, 0.8, 0.5]];
const GARDEN_SHED = { gx: 21, gy: 12.9 };
const inPen = (gx, gy, pad = 0) => GARDEN_PENS.find(p => gx > p.gx0 - pad && gx < p.gx1 + pad && gy > p.gy0 - pad && gy < p.gy1 + pad) || null;
const inBed = (gx, gy) => GARDEN_BEDS.findIndex(([x, y, rx, ry]) => Math.hypot((gx - x) / rx, (gy - y) / ry) < 1);
const gardenBuilt = (gx, gy, pad) => GLASSHOUSES.some(g => gx > g.gx0 - pad && gx < g.gx1 + 1 + pad && gy > g.gy0 - pad && gy < g.gy1 + 1 + pad);
for (let k = 0; k < 280; k++) {
  const gx = 0.6 + hash(k, 1, 801) * (GARDEN.w - 1.2), gy = 0.6 + hash(k, 2, 801) * (GARDEN.h - 1.2);
  if (gardenPathDist(gx, gy) < 0.55 || gardenLakeEdge(gx, gy) > -0.5 || inPen(gx, gy, 0.4) || inBed(gx, gy) >= 0 || gardenBuilt(gx, gy, 0.5) || GLASSHOUSES.some(g => Math.hypot(gx - g.door[0], gy - g.door[1]) < 1.6) || Math.hypot(gx - GARDEN_SHED.gx, gy - GARDEN_SHED.gy) < 1) continue;
  const [x, y] = gx2w(gx, gy); trees.push({ x, y, s: 0.8 + hash(k, 3, 801) * 0.6 });
}
for (const pl of GARDEN_PATHS) for (let k = 1; k < pl.length; k += 2) { // a bench beside every other bend, facing the path
  const [ax, ay] = pl[k - 1], [bx, by] = pl[k], mx = (ax + bx) / 2, my = (ay + by) / 2, l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
  const gx = mx + nx * 0.4, gy = my + ny * 0.4;
  if (gardenLakeEdge(gx, gy) > -0.2 || inPen(gx, gy, 0.2) || gardenBuilt(gx, gy, 0.2)) continue;
  const [x, y] = gx2w(gx, gy); benches.push({ x, y, fx: -nx, fy: -ny });
}
// what kind each tree is: leafy round ones, pines, birches, poplars, and blossom (mostly in Chinatown, the Shotengai and
// the Gardens). Weights per kind for where it stands
const TREE_MIX = { street: { oak: 6, birch: 3, blossom: 1 }, waterfront: { pine: 1, poplar: 1 }, park: { oak: 9, pine: 4, birch: 4, poplar: 2, blossom: 1 },
  eastern: { oak: 3, blossom: 4, pine: 2, birch: 1 }, gardens: { oak: 4, pine: 3, birch: 3, poplar: 2, blossom: 3 } };
for (const t of trees) {
  const bx = Math.floor(t.x / 8), by = Math.floor(t.y / 8), d = districtOf(bx, by), r = hash(Math.floor(t.x * 13), Math.floor(t.y * 13), 811);
  const mix = inGardens(t.x, t.y) ? TREE_MIX.gardens : blockKind(bx, by) === 'waterfront' ? TREE_MIX.waterfront : t.s === 0.75 ? TREE_MIX.street : d === 'chinatown' || d === 'shotengai' ? TREE_MIX.eastern : TREE_MIX.park;
  const tot = Object.values(mix).reduce((a, b) => a + b, 0);
  let w = r * tot; t.kind = Object.keys(mix).find(k => (w -= mix[k]) < 0) || 'oak';
  t.seed = hash(Math.floor(t.x * 7), Math.floor(t.y * 7), 812);
}
const treesB = bucketed(trees), benchesB = bucketed(benches);

// boats out on the sea, each on a route: a racetrack loop (out along one lane, a U-turn, back along the lane beside
// it) on a stretch of open water clear of the bridges, the footbridge, the island and the piers. The road bridges span
// the whole strait at deck level, so they split the bay into basins no boat leaves. Sailboats tack round a short loop
// of their own; tugs and ferries run the length of theirs.
const BOAT_R = 0.6, BOAT_HL = { sail: 0.3, tug: 0.35, ferry: 0.8 }; // U-turn radius (legs 2R apart); half lengths
function blockedOn(y0, y1) { // x intervals [a, b] that the band y0..y1 of sea is closed across
  const out = BRIDGE_X.map(bx => [bx * 8 - 0.4, bx * 8 + 2.4]);
  if (y1 > FOOTBRIDGE.y0 && y0 < FOOTBRIDGE.y1) out.push([FOOTBRIDGE.x - 0.6, FOOTBRIDGE.x + 0.6]);
  const ir = ISLE.r * 1.35 + 0.6; // past the widest the coast goes, and its surf
  if (y1 > ISLE.y - ir && y0 < ISLE.y + ir) out.push([ISLE.x - ir, ISLE.x + ir]);
  for (const [x0, py0, x1, py1] of PIERS) if (y1 > py0 - 0.4 && y0 < py1 + 0.4) out.push([x0 - 0.4, x1 + 0.4]);
  return out;
}
function freeSpan(x, y0, y1) { // the open stretch [a, b] of that band (b > a, may run past N) that x is in, or null
  const o = BRIDGE_X[0] * 8 - 0.4; // measure from a bridge: it closes every band, so nothing wraps round past it
  const bl = blockedOn(y0, y1).map(([a, b]) => [mod(a - o, N), mod(a - o, N) + b - a]).sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const [a, b] of bl) { const m = merged[merged.length - 1]; if (m && a <= m[1]) m[1] = Math.max(m[1], b); else merged.push([a, b]); }
  const t = mod(x - o, N);
  for (let k = 0; k < merged.length; k++) {
    const a = merged[k][1], b = k + 1 < merged.length ? merged[k + 1][0] : N;
    if (t >= a && t < b) return [a + o, b + o];
  }
  return null;
}
// where boat b is at time t: x, y and which way it's heading along x (+1 east, -1 west, between on the turns)
function boatAt(b, t) {
  const R_ = BOAT_R, Ls = b.b - b.a, P = 2 * Ls + 2 * Math.PI * R_, s = mod(b.ph * P + t * b.sp, P);
  if (s < Ls) return { x: b.a + s, y: b.y, dir: 1 };
  if (s < Ls + Math.PI * R_) { const th = (s - Ls) / R_; return { x: b.b + Math.sin(th) * R_, y: b.y + R_ - Math.cos(th) * R_, dir: Math.cos(th) }; }
  if (s < 2 * Ls + Math.PI * R_) return { x: b.b - (s - Ls - Math.PI * R_), y: b.y + 2 * R_, dir: -1 };
  const th = (s - 2 * Ls - Math.PI * R_) / R_;
  return { x: b.a - Math.sin(th) * R_, y: b.y + R_ + Math.cos(th) * R_, dir: -Math.cos(th) };
}
const boats = [];
for (let k = 0; k < 28; k++) {
  const kind = ['sail', 'sail', 'tug', 'ferry'][k & 3], hl = BOAT_HL[kind];
  for (let tries = 0; tries < 30; tries++) {
    const y = SHORE_S * 8 + 9 + hash(k, 1 + tries * 7, 92) * (N - SHORE_S * 8 - 16 - 2 * BOAT_R), x = hash(k, 2 + tries * 7, 92) * N;
    const span = freeSpan(x, y - 0.3, y + 2 * BOAT_R + 0.3);
    if (!span) continue;
    let a = span[0] + hl + BOAT_R, b = span[1] - hl - BOAT_R; // the straight legs: the turns and the hull stay inside
    if (b - a < 3) continue;
    if (kind === 'sail') { const L = Math.min(b - a, 4 + hash(k, 5, 92) * 8), c = a + hash(k, 6, 92) * (b - a - L); a = c; b = c + L; }
    boats.push({ kind, a, b, y, sp: (kind === 'sail' ? 0.06 : 0.12) * (0.7 + hash(k, 3, 92) * 0.6), ph: hash(k, 4, 92) });
    break;
  }
}

// landmark, construction-site and industrial props. Fences and shipping containers are real boxes (solids): drawn
// with drawBox and solid to walk or drive into. {x, y, c, s: long axis, hl, hw, z0, z1, kind, k: a per-thing seed}
const extras = [], cranes = [], stacks = [], solids = [], radios = [], potties = [];
const solidBox = (x, y, alongX, hl, hw, z0, z1, kind, k) => solids.push({ x, y, c: alongX ? 1 : 0, s: alongX ? 0 : 1, hl, hw, z0, z1, kind, k });
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  const X = bx * 8, Y = by * 8, lm = landmarkOf.get(bi(bx, by)), kind = blockKind(bx, by);
  if (lm === 'cathedral') for (const x of [3.5, 6.5])
    extras.push({ spire: true, x: X + x, y: Y + 3.5, z: 8, w: 0.9, h: 3, art: ART.spire, col: (c, row, L) => C(c === '+' ? YEL : GRAY, c === '+' ? Math.max(L, night * 15) : L) });
  if (lm === 'radio') radios.push({ x: X + 5, y: Y + 5 });
  if (kind === 'construction') {
    cranes.push({ x: X + 7, y: Y + 6.2, H: 7 + hash(bx, by, 98) * 2, slew: hash(bx, by, 99) * 6.28 });
    // the hoarding round the site: three panels a side, open at the corners
    for (const s of [3.5, 5, 6.5]) for (const [x, y, ax] of [[s, 2.1, 1], [s, 7.9, 1], [2.1, s, 0], [7.9, s, 0]])
      solidBox(X + x, Y + y, ax, 0.7, 0.012, 0, 0.22, 'hoarding', bx * 7 + by);
    // a portapotty or two inside the fence, doors facing the site (west: the box's -u end, face 2)
    for (let k = 0, n = hash(bx, by, 95) < 0.5 ? 2 : 1; k < n; k++) { solidBox(X + 7.3, Y + 2.95 + k * 0.15, true, 0.06, 0.065, 0, 0.23, 'potty', bx * 13 + by + k); potties.push(solids[solids.length - 1]); }
  }
  if (kind === 'yard') { // container stacks on a loose grid (so they never overlap), a chain-link fence with gates
    for (let k = 0; k < 6; k++) {
      if (hash(bx, by, k * 3 + 43) < 0.2) continue; // an empty bay
      const col = k & 1, row = k >> 1, x = X + 3.2 + col * 2.6 + (hash(bx, by, k * 3 + 40) - 0.5) * 0.4, y = Y + 3 + row * 1.9 + (hash(bx, by, k * 3 + 41) - 0.5) * 0.3;
      const n = 1 + (hash(bx, by, k * 3 + 42) * 3 | 0), alongX = hash(bx, by, k * 3 + 44) > 0.25;
      for (let lv = 0; lv < n; lv++) solidBox(x, y, alongX, 0.6, 0.125, lv * 0.26, lv * 0.26 + 0.25, 'container', bx * 31 + by * 7 + k * 3 + lv);
    }
    for (const s of [3.5, 6.5]) for (const [x, y, ax] of [[s, 2.1, 1], [s, 7.9, 1], [2.1, s, 0], [7.9, s, 0]])
      solidBox(X + x, Y + y, ax, 1.2, 0.01, 0, 0.2, 'chain', 0);
  }
  if (districtOf(bx, by) === 'industrial' && !kind && hash(bx, by, 51) < 0.45) { // a smokestack on the warehouse roof
    const x = X + 3 + hash(bx, by, 52) * 4, y = Y + 3 + hash(bx, by, 53) * 4;
    stacks.push({ x, y, z: map[idx(x, y)], H: 3 + hash(bx, by, 54) * 3 });
  }
}
// subway: stations with a sidewalk entrance on a block's north side, spread out across town. The stairwell is a
// hole in the sidewalk SUBWAY_HOLE (half length along the street, half width) round the entrance point
const SUBWAY_HOLE = [0.14, 0.065];
const stations = [], STATION_AT = new Map(); // block -> its station
{
  const cand = [];
  for (let by = 1; by < SHORE_S; by++) for (let bx = 0; bx < NB; bx++)
    if (!blockKind(bx, by) && hseg(bx, by) && by !== EL_ROW) cand.push([hash(bx, by, 71), bx, by]);
  cand.sort((p, q) => p[0] - q[0]);
  for (const [, bx, by] of cand) {
    if (stations.length >= 20) break;
    if (stations.some(s => Math.hypot(relB(s.bx - bx), s.by - by) < 5)) continue;
    let name = ST_NAMES[by];
    if (stations.some(s => s.name === name)) name = AVE_NAMES[bx].replace(' AVE', '') + ' AVE';
    stations.push({ name, bx, by, x: bx * 8 + 5, y: by * 8 + 1.84 });
    STATION_AT.set(bi(bx, by), stations[stations.length - 1]);
  }
}

// the Chinatown night market: three stalls along the sidewalk of one Chinatown street (the plain block nearest the
// middle of Chinatown, off the el's street, with no subway steps in the way), facing the road, red lanterns strung
// above. Open 8pm to 2am; by day they're tarped over. at = where you stand to be served
const nightMarketOpen = t => t >= 20 || t < 2;
const NIGHT_MARKET = (() => {
  const seed = DIST_SEEDS.find(s => s[2] === 'chinatown'); let best = null, bd = Infinity;
  for (let by = 1; by < SHORE_S; by++) for (let bx = 0; bx < NB; bx++) {
    if (districtOf(bx, by) !== 'chinatown' || blockKind(bx, by) || !hseg(bx, by) || by === EL_ROW || by === EL_ROW + 1 || STATION_AT.has(bi(bx, by))) continue;
    const d = Math.hypot(relB(bx - seed[0]), by - seed[1]);
    if (d < bd) { bd = d; best = { bx, by }; }
  }
  return best;
})();
// each stall: a waist-high counter with the goods laid out on it, two poles, a striped canopy above with the sign on
// its front, and (after dark) someone behind the counter to sell to you
const STALLS = NIGHT_MARKET ? [['STREET FOOD', 3.0, RED], ['CHARMS', 5.0, MAG], ['CURIOS', 7.0, ORANGE]].map(([word, dx, canopy], k) => {
  const x = NIGHT_MARKET.bx * 8 + dx, y = NIGHT_MARKET.by * 8 + 1.78;
  solidBox(x, y + 0.02, true, 0.78, 0.15, 0.21, 0.26, 'stallroof', k); Object.assign(solids[solids.length - 1], { word, canopy, fs: -1 });
  for (const s of [-1, 1]) solidBox(x + s * 0.72, y - 0.08, true, 0.012, 0.012, 0, 0.21, 'stallpole', k);
  solidBox(x, y, true, 0.7, 0.09, 0, 0.1, 'stall', k);
  const shirt = [WHITE, RED, BLUE][k];
  extras.push({ x: x + 0.15 - k * 0.12, y: y + 0.14, z: 0, w: 0.06, h: 0.18, art: ART.walkB, when: () => nightMarketOpen(tod), // the stallholder
    col: (c, row, L) => C(row < 2 ? SKIN : row === 2 ? shirt : GRAY, Math.max(L, 6)) });
  return Object.assign(solids[solids.length - 1], { word, canopy, fs: -1, at: [x, y - 0.3] });
}) : [];
if (NIGHT_MARKET) for (let x = NIGHT_MARKET.bx * 8 + 2.4; x < NIGHT_MARKET.bx * 8 + 7.8; x += 0.45) // the lanterns, on a string along the street
  extras.push({ x, y: NIGHT_MARKET.by * 8 + 1.45, z: 0.3, w: 0.045, h: 0.07, art: ['-|-', '(@)', ' v '], lantern: true,
    col: (c, row, L) => row === 0 ? C(GRAY, L * 0.7) : C(c === '@' ? YEL : RED, Math.max(L, (night > 0.3 ? 1 : 0.4) * (c === '@' ? 15 : 12))) });
// the Sunset Pier: booths down both sides (two games, a prize stall, a food stall), facing in across the
// boardwalk; strings of bulbs on posts along the edges; people milling about and queueing for the wheel.
// side -1: the west edge, facing east. at = where you stand to be served (in front of the counter)
const BOOTHS = [['RING TOSS', -1, 2.3, { game: 'ringtoss' }], ['HIGH STRIKER', -1, 3.6, { game: 'strength' }],
                ['PRIZES', 1, 2.3, { prizes: true }], ['FAIR FOOD', 1, 3.6, { stock: true }], ['DUCK POND', -1, 4.9, { game: 'ducks' }], ['DARTS', 1, 4.9, { game: 'darts' }]].map(([word, side, dy, what], k) => {
  const x = side < 0 ? FAIR.x0 + 0.27 : FAIR.x1 - 0.27, y = FAIR.y0 + dy;
  solidBox(x, y, false, 0.5, 0.22, 0, 0.34, 'booth', k);
  const o = solids[solids.length - 1];
  return Object.assign(o, { word, side, fs: side < 0 ? -1 : 1, at: [x - side * 0.42, y], awning: [RED, BLUE, MAG, GREEN, YEL, CYAN][k], ...what });
});
for (let y = FAIR.y0 + 1; y < FAIR.y1 - 0.5; y += 1.5) for (const x of [FAIR.x0 + 0.06, FAIR.x1 - 0.06])
  extras.push({ x, y, z: 0, w: 0.05, h: 0.4, art: ['(*)', ' | ', ' | ', ' | ', ' | '], col: (c, row, L) => row ? C(GRAY, L) :
    C([YEL, RED, CYAN, MAG][(Math.floor(T * 2) + Math.round(y)) & 3], Math.max(L, night * 15)) });
const fairFolk = [];
for (let k = 0; k < 14; k++) { // somewhere on the boardwalk clear of everything, or in the wheel's queue
  const queue = k < 3, x = queue ? WHEEL_BOARD.x - 0.15 + k * 0.12 : FAIR.x0 + 0.9 + hash(k, 1, 57) * (FAIR.x1 - FAIR.x0 - 1.8);
  const y = queue ? WHEEL_BOARD.y - 0.12 - k * 0.1 : FAIR.y0 + 0.8 + hash(k, 2, 57) * (WHEEL.y - FAIR.y0 - 1.6);
  if (!queue && fairBlocked(x, y, 0.15)) continue;
  const shirt = [RED, BLUE, GREEN, YEL, MAG, WHITE][k % 6], pants = [BLUE, GRAY, BRICK][k % 3];
  fairFolk.push({ x, y });
  extras.push({ x, y, z: 0, w: 0.06, h: 0.18, art: ART.walkB, col: (c, row, L) => C(row < 2 ? SKIN : row === 2 ? shirt : pants, L) });
}
// the aquarium's sign over its doors: a big neon fish, lit after dark
extras.push({ x: AQUARIUM.doorU, y: AQUARIUM.by * 8 + 8.03, z: 0.41, w: 0.3, h: 0.13, art: pad(['    _.--._', "><(( o  ))>", "    `--'"]),
  col: (c, row, L) => C(c === 'o' ? WHITE : c === '>' || c === '<' ? ORANGE : CYAN, Math.max(L, night * 15 * (fract(T * 0.4) < 0.96 ? 1 : 0.4))) });
// the Shotengai: banners hanging from the arcade roof across the street, bicycles parked along the shopfronts
const BANNER_WORDS = ['SALE', 'WELCOME', 'OPEN', 'FESTIVAL', 'LUCKY', 'NEW', 'RAMEN', 'KARAOKE', 'SMILE'];
for (const s of [3.5, 6.5]) alongStreets(s, 1, (x, y, ax, ay, bx, by, o) => {
  if (districtOf(bx, by) !== 'shotengai' && districtOf(o === 'h' ? bx : bx - 1, o === 'h' ? by - 1 : by) !== 'shotengai') return;
  const w = BANNER_WORDS[hash(bx * 7 + s, by, 701) * BANNER_WORDS.length | 0], col = NEON[hash(bx, by * 3 + s, 702) * 4 | 0];
  extras.push({ x, y, z: 0.42, w: 0.045 * (w.length + 4), h: 0.1, art: pad(['.' + '-'.repeat(w.length + 4) + '.', '|  ' + w + '  |', "'" + '-'.repeat(w.length + 4) + "'", ' |' + ' '.repeat(w.length + 2) + '| ']),
    col: (c, row, L) => row === 1 && /[A-Z]/.test(c) ? C(WHITE, Math.max(L, 10)) : row === 3 ? C(GRAY, L) : C(col, Math.max(L, night * 12)) });
});
for (const s of [2.6, 3.4, 5.6, 7.2]) for (const off of [0.16, 1.84]) alongStreets(s, off, (x, y, ax, ay, bx, by, o) => {
  if (districtOf(bx, by) !== 'shotengai' || hash(bx * 13 + s * 7, by * 5 + off, 703) > 0.35 || !map[idx(x - ax * 0.25, y - ay * 0.25)] && !map[idx(x + ax * 0.25, y + ay * 0.25)]) return;
  const col = [RED, BLUE, GREEN, WHITE, YEL][hash(bx, by + s, 704) * 5 | 0];
  extras.push({ x, y, z: 0, w: 0.07, h: 0.06, art: pad(['   __o', ' _ \<,_', '(_)/ (_)']), col: (c, row, L) => row === 2 ? C(GRAY, L) : C(col, L) });
});
// the Gardens' railings (gaps for the gates), the pens' fences, lamp posts along the paths, the gardeners' shed
for (const [gate, along, len] of [['h', 0.1, GARDEN.w], ['h', GARDEN.h - 0.1, GARDEN.w], ['v', 0.1, GARDEN.h], ['v', GARDEN.w - 0.1, GARDEN.h]])
  for (let s = 0; s < len; s += 1) {
    const mid = s + 0.5, gx = gate === 'h' ? mid : along, gy = gate === 'h' ? along : mid;
    if (GARDEN_GATES.some(([x, y]) => Math.abs(gx - x) < 0.8 && Math.abs(gy - y) < 0.8)) continue;
    const [x, y] = gx2w(gx, gy); solidBox(x, y, gate === 'h', 0.5, 0.01, 0, 0.2, 'railing', 0);
  }
for (const p of GARDEN_PENS) for (const [ax, ay, bx, by] of [[p.gx0, p.gy0, p.gx1, p.gy0], [p.gx0, p.gy1, p.gx1, p.gy1], [p.gx0, p.gy0, p.gx0, p.gy1], [p.gx1, p.gy0, p.gx1, p.gy1]]) {
  const alongX = ay === by, len = alongX ? bx - ax : by - ay;
  for (let s = 0; s < len - 0.01; s += 1) { const l = Math.min(1, len - s), [x, y] = gx2w(alongX ? ax + s + l / 2 : ax, alongX ? ay : ay + s + l / 2); solidBox(x, y, alongX, l / 2, 0.01, 0, 0.12, 'railing', 1); }
}
for (const pl of GARDEN_PATHS) for (let k = 1; k < pl.length; k++) if (k % 2 === 0) {
  const [gx, gy] = pl[k]; if (gardenLakeEdge(gx + 0.3, gy + 0.3) > -0.1) continue;
  const [x, y] = gx2w(gx + 0.28, gy + 0.28);
  extras.push({ x, y, z: 0, w: 0.04, h: 0.36, art: [' (O) ', '  |  ', '  |  ', '  |  ', '  |  ', ' _|_ '], col: (c, row, L) => c === 'O' ? C(YEL, Math.max(L, lampsOn * 15)) : C(GRAY, L) });
}
{ const [x, y] = gx2w(GARDEN_SHED.gx, GARDEN_SHED.gy); solidBox(x, y, true, 0.35, 0.25, 0, 0.3, 'shed', 2); }
// dockside cranes on the industrial piers
for (const [x0, y0, x1, y1] of PIERS.filter(p => !p.marina)) if (x1 - x0 > 2 && x0 !== FAIR.x0 && hash(x0, y0, 55) < 0.7) cranes.push({ x: (x0 + x1) / 2, y: y0 + 4, H: 5 + hash(x0, 1, 55) * 2, slew: hash(x0, 2, 55) * 6.28 });
// the marina office: a clapboard hut at the foot of the jetty, its sign facing the road; bollards down the fingers
solidBox(MARINA.office.x, MARINA.office.y, true, 0.55, 0.3, 0, 0.3, 'marina', 0);
for (const fy of MARINA.fingers) for (const s of [-1, 1]) for (const ox of [-3.1, -1.2, 1.2, 3.1]) solidBox(MARINA.x + ox, fy + s * 0.12, true, 0.025, 0.025, 0, 0.04, 'bollard', 0);
const extrasB = bucketed(extras), solidsB = bucketed(solids);
// is (x, y) inside one of the solids (grown by pad)? only the ones standing on the ground count
function solidAt(x, y, pad) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of solidsB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)]) {
    if (o.z0 > 0) continue;
    const qx = rel(x - o.x), qy = rel(y - o.y);
    if (Math.abs(qx * o.c + qy * o.s) < o.hl + pad && Math.abs(-qx * o.s + qy * o.c) < o.hw + pad) return true;
  }
  return false;
}

// chinatown: strings of lanterns across its streets, two per block side. {x, y, ax, ay}: across-street direction
// strung wall to wall, so only where there's a building on both sides of the street to tie it to
const LANTERN_SPAN = 0.95, lanterns = [];
for (const s of [3, 6]) alongStreets(s, 1, (x, y, ax, ay, bx, by, o) => {
  const lanternDist = d => d === 'chinatown' || d === 'shotengai';
  const side = o === 'h' ? lanternDist(districtOf(bx, by)) || lanternDist(districtOf(bx, by - 1))
                         : lanternDist(districtOf(bx, by)) || lanternDist(districtOf(bx - 1, by));
  ax = Math.abs(ax); ay = Math.abs(ay);
  const walls = map[idx(x - ax * 1.2, y - ay * 1.2)] > 0 && map[idx(x + ax * 1.2, y + ay * 1.2)] > 0;
  if (side && walls) lanterns.push({ x, y, ax, ay });
});
const lanternsB = bucketed(lanterns);

// suspension bridges: two towers each, cables sagging between them, lit up at night like a necklace
const BRIDGE_Y0 = SHORE_S * 8 + 2, BRIDGE_LEN = N - BRIDGE_Y0 + SHORE_N * 8 + 8; // shore road to shore road, over the wrap
const TOWERS = [0.2, 0.8].map(f => BRIDGE_Y0 + BRIDGE_LEN * f), TOWER_H = 7, DECK_EDGE = [0.05, 1.95];
const bridgeBits = []; // cable points and suspenders: {x, y, z, kind}
const cableZ = t => { // cable height along the bridge, t = 0..1
  const [a, b] = [0.2, 0.8];
  if (t < a) return 0.3 + (TOWER_H - 0.3) * t / a;
  if (t > b) return 0.3 + (TOWER_H - 0.3) * (1 - t) / (1 - b);
  const m = (t - a) / (b - a); return TOWER_H - (TOWER_H - 0.9) * 4 * m * (1 - m);
};
for (const bx of BRIDGE_X) for (const e of DECK_EDGE) for (let s = 0; s < BRIDGE_LEN; s += 0.5) {
  const t = s / BRIDGE_LEN, z = cableZ(t), x = bx * 8 + e, y = mod(BRIDGE_Y0 + s, N);
  bridgeBits.push({ x, y, z, kind: 'cable' });
  if ((s * 2 | 0) % 4 === 0 && z > 0.5) bridgeBits.push({ x, y, z: 0.05, h: z - 0.05, kind: 'hanger' });
}
const bridgeB = bucketed(bridgeBits);
const towers = BRIDGE_X.flatMap(bx => TOWERS.map(y => ({ x: bx * 8 + 1, y: mod(y, N) })));

// street food: a rare cart at the curb, a few kinds. Two art frames each so the steam/umbrella shimmer.
const VENDOR_TYPES = [
  { name: 'HOT DOGS', item: 'a hot dog', price: 3, color: RED, w: 0.32, art: [
    ['  ~  ~', ' .-~~~~-.', '/HOT DOGS\\', "'---||---'", ' [=====]|', ' |o o o||', " '-O---O'"],
    [' ~  ~', ' .-~~~~-.', '/HOT DOGS\\', "'---||---'", ' [=====]|', ' |o o o||', " '-O---O'"]] },
  { name: 'TACOS', item: 'two tacos', price: 5, color: ORANGE, w: 0.5, art: [
    ['   ~   ~', ' ___________', '|  TACOS  |\\', '|[##] [##]| |', '|_________|_|', ' (O)     (O)'],
    ['  ~   ~', ' ___________', '|  TACOS  |\\', '|[##] [##]| |', '|_________|_|', ' (O)     (O)']] },
  { name: 'ICE CREAM', item: 'a double scoop', price: 4, color: MAG, w: 0.3, art: [
    ['  .-~~-.', ' / ICE  \\', "'---||---'", ' |*@*@*|', ' |_____|', '  O   O'],
    ['  .-~~-.', ' /CREAM \\', "'---||---'", ' |@*@*@|', ' |_____|', '  O   O']] },
  { name: 'COFFEE', item: 'a coffee', price: 2, color: BRICK, w: 0.26, art: [
    ['   ~', '  ______', ' |COFFEE|', ' |[] ~~ |', ' |______|', '  O    O'],
    ['    ~', '  ______', ' |COFFEE|', ' |[] ~~ |', ' |______|', '  O    O']] },
  { name: 'NOODLES', item: 'a bowl of noodles', price: 6, color: YEL, w: 0.4, art: [
    ['  ~  ~  ~', ' /\\/\\/\\/\\/\\', '| NOODLES  |', '|~~  ##  ~~|', '|__________|'],
    ['   ~  ~  ~', ' /\\/\\/\\/\\/\\', '| NOODLES  |', '|~~  ##  ~~|', '|__________|']] },
].map(v => ({ ...v, art: v.art.map(pad) }));
const vendors = [];
// on a sidewalk between the lamps, clear of the subway entrances; o/x offset = toward the building behind the cart
alongStreets(4.4, 1.78, (x, y, ax, ay, bx, by, o) => {
  if (hash(bx, by, o === 'h' ? 200 : 202) < 0.03 && !blockKind(bx, by) && districtOf(bx, by) !== 'industrial')
    vendors.push({ x, y, ox: o === 'v' ? 0.12 : 0, oy: o === 'h' ? 0.12 : 0, type: VENDOR_TYPES[vendors.length % VENDOR_TYPES.length], shirt: pick([RED, BLUE, GREEN, WHITE]) });
});
// and a cotton candy cart at the foot of the Sunset Pier
const CANDY_CART = { name: 'COTTON CANDY', item: 'a cotton candy', price: 3, color: MAG, w: 0.3, art: [
  ['  @@@@  ', ' @@@@@@ ', "'COTTON'", ' |CANDY|', ' |_____|', '  O   O'], ['  @@@@@ ', ' @@@@@@ ', "'COTTON'", ' |CANDY|', ' |_____|', '  O   O']].map(pad) };
vendors.push({ x: FAIR.cx + 1.1, y: FAIR.y0 + 0.9, ox: 0.12, oy: 0, type: CANDY_CART, shirt: WHITE });

// vending machines: on the sidewalk against a building, at the edge of a frontage (beside a shopfront, not across it),
// clear of subway entrances, facing the street. {x, y, kind, c, s: the box's axis along the street, fs: which side of it (+-1) is the front}
const VENDING = { DRINKS: { title: 'DRINK MACHINE', stock: ['soda', 'water', 'energy'] },
                  SNACKS: { title: 'SNACK MACHINE', stock: ['chips', 'candy'] },
                  CIGARETTES: { title: 'CIGARETTE MACHINE', stock: ['cigarettes'] } };
const VM_HL = 0.045, VM_HW = 0.035, VM_H = 0.19, machines = [];
for (const s of [2.12, 4.88, 6.12]) for (const o of [VM_HW + 0.005, 2 - VM_HW - 0.005]) alongStreets(s, o, (x, y, ax, ay, bx, by, ori) => {
  const r = hash(bx * 3 + s, by * 5 + o, ori === 'h' ? 210 : 211);
  if (r > ({ industrial: 0.03, shotengai: 0.3 }[districtOf(bx, by)] || 0.07)) return; // (the Shotengai: one on every corner)
  const wall = idx(x - ax * 0.1, y - ay * 0.1); // the cell behind it
  if (!map[wall] || stations.some(t => Math.hypot(rel(t.x - x), t.y - y) < 0.7)) return;
  const c = Math.abs(ay), sn = Math.abs(ax);
  machines.push({ x, y, kind: Object.keys(VENDING)[Math.floor(r / 0.07 * 3 + s) % 3], c, s: sn, fs: Math.sign(-sn * ax + c * ay) });
});
const machinesB = bucketed(machines);
const machineAt = (x, y, pad) => machinesB[bi(Math.floor(x / 8), Math.floor(y / 8))].some(m =>
  Math.abs((x - m.x) * m.c + (y - m.y) * m.s) < VM_HL + pad && Math.abs(-(x - m.x) * m.s + (y - m.y) * m.c) < VM_HW + pad);

// rooftop clutter: one item on some lots, placed inside the lot so it sits on the roof
const roofs = [];
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  if (blockKind(bx, by)) continue;
  const dist = districtOf(bx, by);
  for (let ly = 0; ly < 2; ly++) for (let lx = 0; lx < 2; lx++) {
    const lot = [bx * 2 + lx, by * 2 + ly], r = hash(...lot, 13);
    const x = bx * 8 + 2 + lx * 3 + 0.6 + hash(...lot, 14) * 1.8, y = by * 8 + 2 + ly * 3 + 0.6 + hash(...lot, 15) * 1.8, h = map[idx(x, y)];
    if (dist === 'industrial' || dist === 'brownstones' && r > 0.3) continue;
    if (h >= 5 && r < 0.5) roofs.push({ x, y, z: h, w: 0.1, h: 1, art: ART.antenna, kind: 'antenna' });
    else if (r < 0.35) roofs.push({ x, y, z: h, w: 0.3, h: 0.4, art: ART.tank, kind: 'tank' });
    else if (r < 0.55) {
      const art = billboard(ADS[hash(...lot, 16) * ADS.length | 0]);
      roofs.push({ x, y, z: h, w: art[0].length * 0.06, h: 0.35, art, kind: 'board', neon: NEON[hash(...lot, 17) * 4 | 0] });
    }
  }
}
const roofsB = bucketed(roofs);
