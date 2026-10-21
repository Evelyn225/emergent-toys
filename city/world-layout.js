// Source-space content is generated once. These transforms preserve each group's
// local geometry while placing it on a finite chart. Ocean travel has its own bounds.
const CITY_LAYOUT = {
  id: 'archipelago-v3', width: 1024, height: 1024, chartWidth: 864, chartHeight: 512, cut: 72,
  cityX: 128, northY: 96, southY: 144,
  airportX: 128, airportY: -160,
};
// Move whole outer neighborhoods into headlands. Every boundary clears existing
// lots and authored groups; the downtown, courier and railway geometry stays put.
const CITY_EDGE_NEIGHBORHOODS = [
  { id: 'north-west', x0: 0, y0: 8, x1: 48, y1: 32, dx: -48, dy: 24 },
  { id: 'north-east', x0: 192, y0: 8, x1: 256, y1: 32, dx: 64, dy: 24 },
  { id: 'north-cove', x0: 0, y0: 56, x1: 48, y1: 72, dx: -48, dy: -40 },
  { id: 'south-west', x0: 0, y0: 72, x1: 48, y1: 104, dx: -48, dy: 40 },
  { id: 'south-east', x0: 240, y0: 72, x1: 256, y1: 104, dx: 16, dy: 40 },
  { id: 'south-beach', x0: 0, y0: 168, x1: 48, y1: 200, dx: -48, dy: -24 },
  { id: 'south-harbor', x0: 192, y0: 176, x1: 256, y1: 200, dx: 64, dy: -32 },
];
function cityNeighborhoodOffset(x, y) {
  // Coastal furniture and pier ends belong to their nearest waterfront block.
  const coastY = clamp(y, 8, 199.999);
  return CITY_EDGE_NEIGHBORHOODS.find(p => x >= p.x0 && x < p.x1 && coastY >= p.y0 && coastY < p.y1);
}
function citySourcePoint(x, y, kind = 'city') {
  if (kind === 'airport') return [x + CITY_LAYOUT.airportX, y + CITY_LAYOUT.airportY];
  // Northern fishing piers were stored across the original y=256 seam.
  if (y >= 246) y -= CITY_SOURCE_N;
  const offset = cityNeighborhoodOffset(x, y);
  // The western headland joins two former waterfront strips. Its promenade and
  // northern piers move to the outer shore rather than through the joined blocks.
  const coastShift = y < 8 && offset?.id === 'north-west' ? -16 : 0;
  return [x + CITY_LAYOUT.cityX + (offset?.dx || 0),
    y + (y < CITY_LAYOUT.cut ? CITY_LAYOUT.northY : CITY_LAYOUT.southY) + (offset?.dy || 0) + coastShift];
}
function cityPreviousPoint(x, y) {
  if (y < 84) return [x, y]; // The northern airfield is already in its final position.
  const north = y < 192, sourceY = y - (north ? CITY_LAYOUT.northY : CITY_LAYOUT.southY);
  if (north && sourceY > 72) return [x, y];
  if (!north && (sourceY < 72 || sourceY > 216)) return [x, y];
  const offset = cityNeighborhoodOffset(x - CITY_LAYOUT.cityX, sourceY);
  const coastShift = sourceY < 8 && offset?.id === 'north-west' ? -16 : 0;
  return [x + (offset?.dx || 0), y + (offset?.dy || 0) + coastShift];
}
function cityWorldSourcePoint(x, y) {
  const sx = x - CITY_LAYOUT.cityX, sy = y - (y < 192 ? CITY_LAYOUT.northY : CITY_LAYOUT.southY);
  if (sx >= -48 && sx < 0 && y < 112) return [sx + 48, sy - 8];
  const p = CITY_EDGE_NEIGHBORHOODS.find(p => sx >= p.x0 + p.dx && sx < p.x1 + p.dx && sy >= p.y0 + p.dy && sy < p.y1 + p.dy);
  return [sx - (p?.dx || 0), sy - (p?.dy || 0)];
}
function citySourceCell(cell, blocks = false) {
  const stride = blocks ? CITY_SOURCE_NB : CITY_SOURCE_N, scale = blocks ? 8 : 1;
  const [x,y] = citySourcePoint(cell % stride * scale, Math.floor(cell / stride) * scale);
  return Math.floor(y / scale) * (CITY_LAYOUT.width / scale) + Math.floor(x / scale);
}
const CITY_ISLANDS = [
  { id: 'north-city', x0: 128, x1: 384, y0: 99, y1: 168, north: true },
  { id: 'south-city', x0: 128, x1: 384, y0: 216, y1: 349, north: false },
];
let cityBlockMask = null;
const CITY_COAST_SIZE = 512;
const CITY_COAST_FIELDS = [];
function cityBlockAt(x, y) {
  if (x < 0 || y < 0 || x >= CITY_LAYOUT.width || y >= CITY_LAYOUT.height) return false;
  return !!cityBlockMask?.[Math.floor(y / 8) * (CITY_LAYOUT.width / 8) + Math.floor(x / 8)];
}
function buildCityCoasts() {
  const width = CITY_COAST_SIZE, count = width * CITY_COAST_SIZE;
  // Signed distance to the occupied block silhouette, cached once. The 8-neighbor
  // sweeps round the stepped streets into beaches/coves without per-pixel searches.
  for (const island of CITY_ISLANDS) {
    const land = new Float32Array(count), water = new Float32Array(count);
    for (let y = 0; y < CITY_COAST_SIZE; y++) for (let x = 0; x < width; x++) {
      const k = y * width + x, inside = cityBlockAt(x, y) && (y < 192) === island.north;
      land[k] = inside ? 0 : 10000;
      water[k] = inside ? 10000 : 0;
    }
    function sweep(field, backwards) {
      const step = backwards ? -1 : 1, end = backwards ? -1 : count;
      for (let k = backwards ? count - 1 : 0; k !== end; k += step) {
        const x = k % width, y = Math.floor(k / width);
        let d = field[k];
        if (x - step >= 0 && x - step < width) d = Math.min(d, field[k - step] + 1);
        if (y - step >= 0 && y - step < CITY_COAST_SIZE) {
          d = Math.min(d, field[k - step * width] + 1);
          if (x > 0) d = Math.min(d, field[k - step * width - 1] + Math.SQRT2);
          if (x + 1 < width) d = Math.min(d, field[k - step * width + 1] + Math.SQRT2);
        }
        field[k] = d;
      }
    }
    for (const field of [land, water]) {
      sweep(field, false);
      sweep(field, true);
    }
    const landings = [...PIERS, [FOOTBRIDGE.x - .5, FOOTBRIDGE.y0, FOOTBRIDGE.x + .5, FOOTBRIDGE.y0 + 3]];
    for (let k = 0; k < count; k++) {
      const distance = water[k] > 0 ? water[k] - .5 : .5 - land[k];
      const x = k % width + .5, y = Math.floor(k / width) + .5;
      let buffer = 11 + 5 * Math.sin(x * .033 + y * .025) + 3 * Math.sin(y * .079 - x * .051);
      // Preserve the shipping channel and existing pier/marina approaches.
      if (island.north ? y > 160 : y < 224) buffer = 6 + 3 * Math.sin(x * .052 + (island.north ? 0 : 2)) + .7 * Math.sin(x * .14);
      // Keep both sides of the marina fingers open for departing hulls. Its
      // landside pier still overlaps the waterfront by more than two cells.
      if (!island.north && Math.abs(x - MARINA.x) < 11 && y > 344) buffer = Math.min(buffer, 4.5);
      if (distance > -24 && distance < 24) for (const [x0, y0, x1, y1] of landings) {
        const d = Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, y0 - y, y - y1));
        buffer = Math.min(buffer, 6 + d * .7);
      }
      land[k] = distance + buffer;
    }
    CITY_COAST_FIELDS[island.north ? 0 : 1] = land;
  }
}
function cityIslandEdge(x, y, island) {
  const field = CITY_COAST_FIELDS[island.north ? 0 : 1];
  if (field) {
    const gx = Math.floor(x - .5), gy = Math.floor(y - .5), w = CITY_COAST_SIZE;
    if (gx < 0 || gy < 0 || gx + 1 >= w || gy + 1 >= CITY_COAST_SIZE) return -1000;
    const u = x - .5 - gx, v = y - .5 - gy, k = gy * w + gx;
    const top = field[k] * (1 - u) + field[k + 1] * u;
    const bottom = field[k + w] * (1 - u) + field[k + w + 1] * u;
    return top * (1 - v) + bottom * v;
  }
  const side = 16 + 6 * Math.sin(y * .07) + 4 * Math.sin(y * .19 + 1);
  const north = island.north ? island.y0 + wave(x - CITY_LAYOUT.cityX, 4) - 3 - 3 * Math.sin(x * .055) : island.y0 - 8 - 4 * Math.sin(x * .04);
  const south = island.north ? island.y1 + 8 + 4 * Math.sin(x * .07 + 1) : shoreS(x);
  // Natural buffers grow outside retained blocks; no occupied lots are removed.
  const end = Math.min(y - north, south - y);
  const corner = Math.max(0, 8 - Math.min(Math.abs(y - north), Math.abs(south - y))) * .45;
  return Math.min(x - (island.x0 - side + corner), island.x1 + side - corner - x, end);
}
function archipelagoEdge(x, y) {
  let edge = Math.max(isleEdge(x, y), airportEdge(x, y));
  for (const island of CITY_ISLANDS) edge = Math.max(edge, cityIslandEdge(x, y, island));
  if (worldReady && x >= 465) for (const island of WILD_ISLANDS) edge = Math.max(edge, wildIslandEdge(x,y,island));
  return edge;
}
function naturalCoastAt(x, y) {
  if (!worldReady) return false;
  if (cityBlockMask) return !cityBlockAt(x, y) && CITY_ISLANDS.some(island => cityIslandEdge(x, y, island) > 0);
  const outsideBlocks = x < 128 || x >= 384 || y < shoreN(x) || y >= 168 && y < 216;
  return outsideBlocks && CITY_ISLANDS.some(island => cityIslandEdge(x, y, island) > 0);
}
