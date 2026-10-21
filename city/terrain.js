// Low polygon ground, independent of building heights. One cell is ten metres.
// Renderer, walking and aircraft collision all use these same triangles.
const TERRAIN_SCALE = 2, TERRAIN_STEP = 1 / TERRAIN_SCALE;
let TERRAIN_N = N * TERRAIN_SCALE;
const TERRAIN_GRADE = .28;
let terrainHeights = new Float32Array(TERRAIN_N * TERRAIN_N);
let terrainCells = new Uint8Array(N * N);
// Only cells with relief need planes. Index four half-cell patches per raised
// cell into packed data, built once with the height field (no per-frame allocation).
let terrainPatchIndex = new Uint32Array(terrainCells.length);
// Per patch: height, two slope pairs, two lighting values, and a relief flag.
let terrainPatchData = new Float64Array(0);
function terrainPatch(gx, gy) {
  const base = terrainPatchIndex[idx(Math.floor(gx / 2), Math.floor(gy / 2))];
  return base ? base - 1 + ((gy & 1) * 2 + (gx & 1)) * 8 : -1;
}
function buildTerrainPlanes() {
  terrainPatchIndex = new Uint32Array(terrainCells.length);
  let cells = 0;
  for (const raised of terrainCells) if (raised) cells++;
  terrainPatchData = new Float64Array(cells * 4 * 8);
  let at = 0;
  for (let k = 0; k < terrainCells.length; k++) {
    if (!terrainCells[k]) continue;
    terrainPatchIndex[k] = at + 1;
    const x = k % N * 2, y = Math.floor(k / N) * 2;
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
      const gx = x + ox, gy = y + oy;
      const a = terrainVertex(gx, gy), b = terrainVertex(gx + 1, gy);
      const c = terrainVertex(gx, gy + 1), d = terrainVertex(gx + 1, gy + 1);
      const sx0 = (b - a) * TERRAIN_SCALE, sy0 = (d - b) * TERRAIN_SCALE;
      const sx1 = (d - c) * TERRAIN_SCALE, sy1 = (c - a) * TERRAIN_SCALE;
      terrainPatchData[at++] = a;
      terrainPatchData[at++] = sx0; terrainPatchData[at++] = sy0;
      terrainPatchData[at++] = sx1; terrainPatchData[at++] = sy1;
      terrainPatchData[at++] = clamp((.85 - sx0 * .9 + sy0 * .6) / Math.sqrt(1 + sx0 * sx0 + sy0 * sy0), .5, 1.2);
      terrainPatchData[at++] = clamp((.85 - sx1 * .9 + sy1 * .6) / Math.sqrt(1 + sx1 * sx1 + sy1 * sy1), .5, 1.2);
      terrainPatchData[at++] = Math.max(a, b, c, d) > .00001 ? 1 : 0;
    }
  }
}
const terrainIndex = (x, y) => worldReady ? (x >= 0 && y >= 0 && x < TERRAIN_N && y < TERRAIN_N ? y * TERRAIN_N + x : TERRAIN_N * TERRAIN_N) : mod(y, TERRAIN_N) * TERRAIN_N + mod(x, TERRAIN_N);
const terrainVertex = (x, y) => terrainHeights[terrainIndex(x, y)];
const terrainEase = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function coastalGround(x, y) {
  if (worldReady) {
    let depth = -Infinity;
    for (const island of CITY_ISLANDS) depth = Math.max(depth, cityIslandEdge(x, y, island));
    return { depth, beach: Math.sin(x * .035 + y * .017) > -.25 };
  }
  const south = y > (SHORE_S + SHORE_N) * 4;
  const depth = south ? shoreS(x) - y : y - shoreN(x);
  const beach = hash(Math.floor(x / 8), south ? 1 : 2, 47) < .35;
  return { depth, beach };
}

// Leave a broad, level approach between the footbridge and the lighthouse.
function lighthousePathDistance(x, y) {
  const ax = FOOTBRIDGE.x, ay = FOOTBRIDGE.y1, bx = LIGHTHOUSE.x, by = LIGHTHOUSE.y;
  const ux = bx - ax, uy = by - ay, t = clamp((rel(x - ax) * ux + rel(y - ay) * uy) / (ux * ux + uy * uy), 0, 1);
  return Math.hypot(rel(x - ax) - ux * t, rel(y - ay) - uy * t);
}

function naturalTerrainHeight(x, y) {
  if (onAirport(x, y) || onCauseway(x, y) || onFootbridge(x, y)) return 0;
  if (onIsland(x, y)) {
    const edge = isleEdge(x, y), ex = rel(x - ISLE.x), ey = rel(y - ISLE.y);
    const ridge = .36 + .1 * Math.sin(ex * .7 + ey * .35);
    const path = terrainEase((lighthousePathDistance(x, y) - .35) / 1.5);
    const foundation = terrainEase((Math.hypot(rel(x - LIGHTHOUSE.x), rel(y - LIGHTHOUSE.y)) - .7) / 1.4);
    return ridge * terrainEase((edge - .7) / 2.8) * path * foundation;
  }
  const wild = wildIslandAt(x,y);
  if (wild) return wildGroundHeight(x,y,wild);
  const { depth, beach } = coastalGround(x, y);
  if (depth < .6 || depth > 4.5 || seaAt(x, y)) return 0;
  const shore = terrainEase((depth - .6) / (beach ? 1.5 : 1));
  const inland = terrainEase((4.5 - depth) / 2);
  const relief = beach ? .12 : .23;
  return relief * shore * inland * (.8 + .2 * Math.sin(x * .23 + y * .31));
}

// Pads are level under existing furniture, piers and buildings. Feather their edges
// into the surrounding ground; trees can grow directly from a slope instead.
function buildTerrain() {
  terrainHeights.fill(0); terrainCells.fill(0);
  const reserve = new Float32Array(terrainHeights.length).fill(1);
  function pad(x, y, hl, hw, c = 1, s = 0) {
    const feather = 1.1, margin = .75, r = Math.hypot(hl, hw) + feather + margin;
    if (!worldReady && y - r > (SHORE_N + 1) * 8 && y + r < SHORE_S * 8) return;
    for (let gy = Math.floor((y - r) * TERRAIN_SCALE); gy <= (y + r) * TERRAIN_SCALE; gy++) {
      for (let gx = Math.floor((x - r) * TERRAIN_SCALE); gx <= (x + r) * TERRAIN_SCALE; gx++) {
        const qx = rel(gx * TERRAIN_STEP - x), qy = rel(gy * TERRAIN_STEP - y);
        const distance = Math.hypot(Math.max(0, Math.abs(qx * c + qy * s) - hl), Math.max(0, Math.abs(-qx * s + qy * c) - hw));
        const k = terrainIndex(gx, gy);
        reserve[k] = Math.min(reserve[k], terrainEase((distance - margin) / feather));
      }
    }
  }
  for (const o of solids) if (o.z0 <= 0) pad(o.x, o.y, o.hl, o.hw, o.c, o.s);
  for (const o of [...benches, ...lamps, ...extras, ...ANGLERS]) pad(o.x, o.y, .15, .15);
  for (const [x0, y0, x1, y1] of PIERS) pad((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2);
  const active = [];
  for (let gy = 0; gy < Math.min(TERRAIN_N, 512*TERRAIN_SCALE); gy++) for (let gx = 0; gx < Math.min(TERRAIN_N, (worldReady ? CITY_LAYOUT.chartWidth : N)*TERRAIN_SCALE); gx++) {
    const x = gx * TERRAIN_STEP, y = gy * TERRAIN_STEP;
    if (!worldReady && y > (SHORE_N + 1) * 8 && y < SHORE_S * 8) continue;
    if (worldReady && x >= CITY_COAST_SIZE && !wildIslandAt(x,y,1)) continue;
    const raw = naturalTerrainHeight(x, y) * reserve[gy * TERRAIN_N + gx];
    if (raw <= 0) continue;
    // Keep the whole road/building cell flat, including its boundary vertices.
    let clear = true;
    for (const oy of [-.01, .01]) for (const ox of [-.01, .01]) {
      const k = idx(Math.floor(x + ox), Math.floor(y + oy));
      if (ROAD[k] || map[k]) clear = false;
    }
    if (clear) {
      const k = gy * TERRAIN_N + gx;
      terrainHeights[k] = raw; active.push(k);
    }
  }
  // Bound both components of each triangle's gradient, including flattened pads.
  // This caps the steepest diagonal slope as well as the grid directions.
  const rise = TERRAIN_GRADE * TERRAIN_STEP / Math.SQRT2;
  for (let sweep = 0; sweep < 4; sweep++) {
    const backwards = sweep & 1;
    for (let n = 0; n < active.length; n++) {
      const k = active[backwards ? active.length - 1 - n : n], x = k % TERRAIN_N, y = Math.floor(k / TERRAIN_N);
      terrainHeights[k] = Math.min(terrainHeights[k], rise + Math.min(terrainVertex(x - 1, y), terrainVertex(x + 1, y), terrainVertex(x, y - 1), terrainVertex(x, y + 1)));
    }
  }
  for (const k of active) {
    const gx = k % TERRAIN_N, gy = Math.floor(k / TERRAIN_N);
    if (terrainHeights[k] > 0) {
      for (const oy of [-1, 0]) for (const ox of [-1, 0]) terrainCells[idx(Math.floor((gx + ox) * TERRAIN_STEP), Math.floor((gy + oy) * TERRAIN_STEP))] = 1;
    }
  }
  buildTerrainPlanes();
}

function terrainHeight(x, y) {
  if (!terrainCells[idx(Math.floor(x), Math.floor(y))]) return 0;
  const gx = Math.floor(x * TERRAIN_SCALE), gy = Math.floor(y * TERRAIN_SCALE);
  const u = x * TERRAIN_SCALE - gx, v = y * TERRAIN_SCALE - gy;
  const a = terrainVertex(gx, gy), b = terrainVertex(gx + 1, gy), c = terrainVertex(gx, gy + 1), d = terrainVertex(gx + 1, gy + 1);
  return u >= v ? a + (b - a) * u + (d - b) * v : a + (d - c) * u + (c - a) * v;
}

function outdoorGroundHeight(x, y) {
  return Math.max(roadGroundHeight(x, y), architectureGroundHeight(x, y), elStairGround(x, y));
}

buildTerrain();
