'use strict';
// ---- the island landings (WORLD_QUALITY item 43). Stepping off the boat at Fern Island, Cabin Cove, Juniper Isle or
// Crescent Sands was a dock, flat ground and a path. Each landing now has the things a landing collects: a lamp on a
// post, a bench, boulders and planting at the edge of the path, a crate and a drum left from the last delivery, and
// something of its own: kayaks on a rack at Fern, lobster pots and buoys at Cabin Cove, a private gate at Juniper, a
// striped windbreak and a lifebuoy at Crescent Sands. Built once with the other island details (island-sights.js),
// from the same models, and kept clear of the path and the water.

const LANDING_PATH_CLEAR = .32; // how far everything stands off the path's centre line (cells)
function landingPathDistance(id, x, y) {
  let best = Infinity;
  for (const path of id === 'fern' ? FERN_TRAILS : ISLAND_PATHS[id] || []) for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1], [bx, by] = path[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
// a frame round one island's landing: along = up the path, side = to its left (+) or right (-)
function landingFrame(island) {
  const paths = island.id === 'fern' ? FERN_TRAILS : ISLAND_PATHS[island.id], [lx, ly] = island.landing;
  const next = paths[0].find(p => near(p[0], p[1], lx, ly) > .5) || [island.x, island.y], l = near(next[0], next[1], lx, ly);
  const fx = (next[0] - lx) / l, fy = (next[1] - ly) / l;
  return { id: island.id, at: (along, side) => [lx + fx * along - fy * side, ly + fy * along + fx * side], angle: Math.atan2(fy, fx) };
}
// somewhere to stand a thing: on dry land, off the path, clear of the cabins and the dock
function landingKitSpot(F, along, side, pad = .15) {
  const [x, y] = F.at(along, side);
  if (seaAt(x, y) || onPier(x, y) || map[idx(x, y)]) return null;
  if (landingPathDistance(F.id, x, y) < LANDING_PATH_CLEAR + pad) return null;
  if (ISLAND_CABINS.some(c => x > c.x0 - .3 && x < c.x1 + .3 && y > c.y0 - .3 && y < c.y1 + .5)) return null;
  return [x, y];
}

// something to bump into, without drawing it: collision is checked on axis-aligned boxes, so a turned one is boxed round
function landingObstacle(x, y, hl, hw, z0, z1, angle = 0) {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  ISLAND_OBSTACLES.push({ x, y, hl: c * hl + s * hw, hw: s * hl + c * hw, z0, z1, kind: 'trim', c: 1, s: 0 });
}

function landingLamp(x, y) { // a timber post, an arm, a lantern that lights after dark
  const z = terrainHeight(x, y);
  islandGroundModel(x, y, .012, .012, .33, 'timber', true);
  islandDetail(x + .03, y, .035, .006, z + .31, z + .32, 'timber');
  islandDetail(x + .06, y, .016, .016, z + .27, z + .31, 'lamp');
  islandDetail(x + .06, y, .022, .022, z + .31, z + .318, 'metal');
}
function landingBench(x, y, angle) { // a slatted seat on two legs, a back board, facing the path
  const c = Math.cos(angle), s = Math.sin(angle), z = terrainHeight(x, y);
  for (const e of [-1, 1]) islandDetail(x + c * e * .14, y + s * e * .14, .012, .045, z - .01, z + .045, 'timber', angle);
  Object.assign(islandDetail(x, y, .17, .05, z + .045, z + .056, 'timber', angle), { bench: true });
  islandDetail(x + s * .05, y - c * .05, .17, .008, z + .06, z + .1, 'timber', angle);
  landingObstacle(x, y, .17, .055, z - .01, z + .056, angle);
}
function landingCrates(x, y, angle) { // two crates, one on the other, and a drum beside them
  const z = terrainHeight(x, y), c = Math.cos(angle), s = Math.sin(angle);
  islandGroundModel(x, y, .055, .045, .09, 'timber', true);
  islandDetail(x + c * .01, y + s * .01, .045, .04, z + .09, z + .165, 'timber', angle + .2);
  const dx = x - s * .13, dy = y + c * .13, dz = terrainHeight(dx, dy);
  Object.assign(islandDetail(dx, dy, .04, .04, dz - .01, dz + .1, 'metal'), { base: BLUE });
}
function landingBoulders(F, along, side, seed) { // a cluster of three, settled into the ground
  for (let k = 0; k < 3; k++) {
    const spot = landingKitSpot(F, along + (k - 1) * .22, side + (k & 1 ? .14 : -.06), .1);
    if (spot) islandStone(spot[0], spot[1], .09 + hash(k, seed, 1971) * .1, hash(seed, k, 1972));
  }
}
function landingPlanting(F, kind, seed) { // planting both sides of the first stretch of path, denser than along the trail
  for (let k = 0; k < 14; k++) {
    const along = .3 + k * .22, side = (k & 1 ? 1 : -1) * (.5 + hash(k, seed, 1973) * .5);
    const spot = landingKitSpot(F, along, side, 0);
    if (spot) islandCover(spot[0], spot[1], kind === 'mixed' ? (hash(k, seed, 1974) > .5 ? 'flower' : 'fern') : kind, hash(seed, k, 1975), .14 + hash(k, 2, seed) * .1);
  }
}

// Fern: two kayaks on a rack
function landingKayaks(x, y, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), z = terrainHeight(x, y);
  for (const e of [-1, 1]) { islandDetail(x + c * e * .2, y + s * e * .2, .012, .07, z - .01, z + .17, 'timber', angle); islandDetail(x + c * e * .2, y + s * e * .2, .012, .075, z + .095, z + .105, 'timber', angle); }
  landingObstacle(x, y, .26, .08, z - .01, z + .17, angle);
  for (const [v, h, col] of [[-.035, .105, RED], [.035, .17, YEL]]) Object.assign(islandDetail(x - s * v, y + c * v, .3, .028, z + h, z + h + .028, 'canvas', angle), { base: col });
}
// Cabin Cove: lobster pots stacked by the path, buoys heaped beside them
function landingPots(x, y, angle) {
  const z = terrainHeight(x, y), c = Math.cos(angle), s = Math.sin(angle);
  for (const [u, v, l] of [[-.08, 0, 0], [.08, 0, 0], [0, 0, 1], [0, .12, 0]]) {
    const px_ = x + c * u - s * v, py_ = y + s * u + c * v;
    Object.assign(islandDetail(px_, py_, .065, .045, z + l * .07, z + l * .07 + .07, 'net', angle), { base: BRICK });
  }
  landingObstacle(x, y, .16, .12, z - .01, z + .14, angle);
  for (let k = 0; k < 5; k++) { const bx = x - s * (.25 + k * .045) + c * (hash(k, 1, 1976) - .5) * .12, by = y + c * (.25 + k * .045) + s * (hash(k, 1, 1976) - .5) * .12, bz = terrainHeight(bx, by);
    Object.assign(islandDetail(bx, by, .022, .022, bz, bz + .04 + (k === 2 ? .03 : 0), 'canvas'), { base: [RED, WARM, WHITE, RED, YEL][k] }); }
}
// Juniper: a gateway at the head of the path, stone pillars with lanterns on them, the gate standing open, PRIVATE on it
function landingGate(F) {
  const [gx, gy] = F.at(1.1, 0), angle = F.angle + Math.PI / 2, c = Math.cos(angle), s = Math.sin(angle);
  for (const e of [-1, 1]) {
    const x = gx + c * e * .3, y = gy + s * e * .3, z = terrainHeight(x, y);
    ISLAND_OBSTACLES.push(Object.assign(islandDetail(x, y, .045, .045, z - .02, z + .2, 'trim'), { base: STONE }));
    islandDetail(x, y, .055, .055, z + .2, z + .215, 'trim');
    islandDetail(x, y, .015, .015, z + .215, z + .25, 'lamp');
  }
  const z = terrainHeight(gx, gy);
  const fx = Math.cos(F.angle), fy = Math.sin(F.angle); // the two leaves stand open, swung in off the path from their pillars
  for (const e of [-1, 1]) { const gate = islandDetail(gx + c * e * .23 + fx * .13, gy + s * e * .23 + fy * .13, .12, .006, z + .02, z + .13, 'timber', F.angle); if (e < 0) Object.assign(gate, { word: 'PRIVATE', labelZ: z + .07, labelH: .022, ink: BLACK }); }
  islandWaymark(...F.at(1.25, .5), 'HOUSE: PRIVATE', .4);
  for (const e of [-1, 1]) for (let k = 0; k < 4; k++) { const spot = landingKitSpot(F, 1.0 + k * .12, e * (.42 + (k & 1) * .06), -.2); if (spot) islandCover(spot[0], spot[1], 'flower', hash(k, e, 1977), .13); }
}
// Crescent Sands: a striped windbreak on its poles, a lifebuoy on a post
function landingWindbreak(x, y, angle) {
  const z = terrainHeight(x, y), c = Math.cos(angle), s = Math.sin(angle);
  for (let k = 0; k < 4; k++) islandDetail(x + c * (k - 1.5) * .16, y + s * (k - 1.5) * .16, .006, .006, z - .02, z + .17, 'timber');
  for (let k = 0; k < 3; k++) { const cloth = islandDetail(x + c * (k - 1) * .16, y + s * (k - 1) * .16, .08, .004, z + .02, z + .15, 'cloth', angle); cloth.seed = k; cloth.base = [BLUE, WHITE, BLUE][k]; }
}
function landingLifebuoy(x, y) {
  const z = terrainHeight(x, y);
  islandGroundModel(x, y, .012, .012, .24, 'timber', true);
  Object.assign(islandDetail(x + .015, y, .006, .05, z + .14, z + .23, 'canvas'), { base: RED });
  Object.assign(islandDetail(x + .016, y, .006, .02, z + .17, z + .2, 'canvas'), { base: WHITE });
}

function buildIslandLandings() {
  for (const island of WILD_ISLANDS) {
    if (!['fern', 'cabin', 'wood', 'sand'].includes(island.id)) continue;
    const F = landingFrame(island), seed = island.x;
    const put = (along, side, fn) => { const spot = landingKitSpot(F, along, side); if (spot) fn(...spot); return spot; };
    put(.35, .55, landingLamp);
    put(.95, -.62, (x, y) => landingBench(x, y, F.angle));
    put(.55, .85, (x, y) => landingCrates(x, y, F.angle));
    landingBoulders(F, 1.9, -1.0, seed);
    landingPlanting(F, island.id === 'sand' ? 'rush' : island.id === 'cabin' ? 'fern' : 'mixed', seed);
    if (island.id === 'fern') put(1.5, .95, (x, y) => landingKayaks(x, y, F.angle));
    if (island.id === 'cabin') put(1.45, .85, (x, y) => landingPots(x, y, F.angle));
    if (island.id === 'wood') landingGate(F);
    if (island.id === 'sand') { put(1.6, .95, (x, y) => landingWindbreak(x, y, F.angle)); put(.4, -.55, landingLifebuoy); }
  }
}
// built with the rest of the island's details, before they're bucketed for drawing
const LANDING_BASE_SIGHTS = buildIslandSights;
buildIslandSights = function () { LANDING_BASE_SIGHTS(); buildIslandLandings(); };
