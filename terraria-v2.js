window.__TERRARIA_V2__ = true;
window.__TERRARIA_ACTIVE_VERSION__ = 'v2';
document.documentElement.dataset.terrariaEngine = 'v2';
console.info('[terraria] loaded v2');

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const TILE = 16;
const WORLD_W = 420;
const WORLD_H = 170;
const WORLD_PX = WORLD_W * TILE;
const DAY_LENGTH_MS = 180000;
const TARGET_DT = 1000 / 60;
const TAU = Math.PI * 2;

const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const DSTONE = 4;
const COPPER = 5;
const IRON = 6;
const WOOD = 7;
const TREE = 8;

const WATER_MAX = 1;
const WATER_RENDER_EPS = 0.04;
const WATER_SIDE_FLOW = 0.35;
const WATER_STEPS_PER_FRAME = 2;
const WATER_MOVE_THRESHOLD = 0.003;
const WATER_SPEED_MULT = 0.72;
const WATER_GRAVITY_MULT = 0.24;
const WATER_MAX_FALL = 3.6;
const WATER_SWIM_ACCEL = 0.78;
const PLAYER_WET_THRESHOLD = 0.25;
const PLAYER_SUBMERGED_THRESHOLD = 0.999;
const PLAYER_MAX_AIR = 60 * 6;
const DROWN_DAMAGE_FRAMES = 45;

const BIOME_FOREST = 0;
const BIOME_MEADOW = 1;
const BIOME_ROCKY = 2;

const blockDefs = {
  [AIR]: { name: 'Empty', solid: false, mine: 0 },
  [GRASS]: { name: 'Grass', solid: true, mine: 10 },
  [DIRT]: { name: 'Dirt', solid: true, mine: 18 },
  [STONE]: { name: 'Stone', solid: true, mine: 34 },
  [DSTONE]: { name: 'Deep Stone', solid: true, mine: 54 },
  [COPPER]: { name: 'Copper Ore', solid: true, mine: 44 },
  [IRON]: { name: 'Iron Ore', solid: true, mine: 56 },
  [WOOD]: { name: 'Wood', solid: true, mine: 16 },
  [TREE]: { name: 'Tree', solid: false, mine: 16, drops: WOOD },
};

const biomeNames = {
  [BIOME_FOREST]: 'Forest',
  [BIOME_MEADOW]: 'Meadow',
  [BIOME_ROCKY]: 'Rocky Hills',
};

const biomeGrassTints = {
  [BIOME_FOREST]: '#67bf45',
  [BIOME_MEADOW]: '#8ad860',
  [BIOME_ROCKY]: '#78ad46',
};

const world = new Uint8Array(WORLD_W * WORLD_H);
const water = new Float32Array(WORLD_W * WORLD_H);
const surfaceYs = new Int16Array(WORLD_W);
const biomes = new Uint8Array(WORLD_W);
const treeCanopies = [];
const tileTextures = {};
const wallTextures = {};
const stars = [];
const clouds = [];
const mountainLayers = [];
const cam = { x: 0, y: 0 };

let lastTime = 0;
let dayClockMs = DAY_LENGTH_MS * 0.22;
let waterFlowParity = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash(n) {
  return Math.abs((Math.sin(n * 127.1 + 311.7) * 43758.5453123) % 1);
}

function hash2(x, y, seed = 0) {
  return hash(x * 374761 + y * 668265 + seed * 69069);
}

function smoothNoise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function octaveNoise(x, octaves, persistence) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    value += smoothNoise(x * frequency) * amplitude;
    total += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return value / total;
}

function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mixColor(a, b, t, alpha = 1) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const rgb = ra.map((value, i) => Math.round(value + (rb[i] - value) * t));
  return alpha === 1
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function alphaColor(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function shiftColor(hex, delta) {
  const [r, g, b] = hexToRgb(hex);
  const amount = Math.round(255 * delta);
  return `rgb(${clamp(r + amount, 0, 255)},${clamp(g + amount, 0, 255)},${clamp(b + amount, 0, 255)})`;
}

function makeCanvas(size = TILE) {
  const texture = document.createElement('canvas');
  texture.width = size;
  texture.height = size;
  const g = texture.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { texture, g };
}

function pixel(g, x, y, color, w = 1, h = 1) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

function isSolid(type) {
  return !!blockDefs[type]?.solid;
}

function hasBlock(type) {
  return type !== AIR;
}

function getBlock(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return STONE;
  return world[x + y * WORLD_W];
}

function setBlock(x, y, type) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  world[x + y * WORLD_W] = type;
}

function waterIndex(x, y) {
  return x + y * WORLD_W;
}

function getWater(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return 0;
  return water[waterIndex(x, y)];
}

function setWater(x, y, amount) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  water[waterIndex(x, y)] = clamp(amount, 0, WATER_MAX);
}

function isWaterCell(x, y, threshold = WATER_RENDER_EPS) {
  return getWater(x, y) > threshold;
}

function canWaterOccupy(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  return !isSolid(getBlock(x, y));
}

function isMineable(type) {
  return (blockDefs[type]?.mine || 0) > 0;
}

function getDropType(type) {
  return blockDefs[type]?.drops || type;
}

function breakTreeFrom(x, y) {
  let broken = 0;
  for (let treeY = y; treeY >= 0 && getBlock(x, treeY) === TREE; treeY--) {
    setBlock(x, treeY, AIR);
    broken++;
  }
  return broken;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
}

function chooseBiome(previous) {
  let biome = Math.floor(Math.random() * 3);
  if (biome === previous) {
    biome = (biome + 1 + Math.floor(Math.random() * 2)) % 3;
  }
  return biome;
}

function generateBiomeBands() {
  let x = 0;
  let previous = BIOME_FOREST;
  while (x < WORLD_W) {
    const span = 58 + Math.floor(Math.random() * 78);
    const biome = chooseBiome(previous);
    for (let i = x; i < Math.min(WORLD_W, x + span); i++) biomes[i] = biome;
    previous = biome;
    x += span;
  }

  const center = Math.floor(WORLD_W / 2);
  for (let i = 0; i < 24; i++) {
    biomes[i] = BIOME_FOREST;
    biomes[WORLD_W - 1 - i] = BIOME_ROCKY;
  }
  for (let xPos = center - 18; xPos <= center + 18; xPos++) {
    biomes[clamp(xPos, 0, WORLD_W - 1)] = BIOME_MEADOW;
  }
}

function groundHeightAt(x) {
  const biome = biomes[x];
  const primary = octaveNoise((x + 320) / 68, 4, 0.53);
  const detail = octaveNoise((x + 900) / 15, 2, 0.38);
  const ridge = biome === BIOME_ROCKY ? octaveNoise((x + 70) / 9, 2, 0.42) * 5 : 0;
  const biomeOffset = biome === BIOME_ROCKY ? 5 : biome === BIOME_MEADOW ? -2 : 0;
  return Math.floor(44 + primary * 20 + detail * 4 + ridge + biomeOffset);
}

function digAirWorm(startX, startY, length, radius, angle, depthGuard = 4) {
  let wx = startX;
  let wy = startY;
  for (let i = 0; i < length; i++) {
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const bx = Math.round(wx + dx);
        const by = Math.round(wy + dy);
        if (bx < 1 || bx >= WORLD_W - 1 || by < 1 || by >= WORLD_H - 2) continue;
        if (by >= surfaceYs[clamp(bx, 0, WORLD_W - 1)] + depthGuard) setBlock(bx, by, AIR);
      }
    }
    angle += (Math.random() - 0.5) * 0.48;
    wx += Math.cos(angle) * 1.45;
    wy += Math.sin(angle) * 0.72;
    radius = clamp(radius + (Math.random() - 0.5) * 0.18, 1.1, 4.25);
    if (wx < 2 || wx > WORLD_W - 3 || wy < 5 || wy > WORLD_H - 5) break;
  }
}

function paintOreVein(type, startX, startY, length, radius, angle) {
  let wx = startX;
  let wy = startY;
  for (let i = 0; i < length; i++) {
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const bx = Math.round(wx + dx);
        const by = Math.round(wy + dy);
        if (bx < 1 || bx >= WORLD_W - 1 || by < 1 || by >= WORLD_H - 2) continue;
        const current = getBlock(bx, by);
        if ((current === STONE || current === DSTONE || current === DIRT) && by >= surfaceYs[bx] + 7) {
          setBlock(bx, by, type);
        }
      }
    }
    angle += (Math.random() - 0.5) * 0.8;
    wx += Math.cos(angle) * 1.18;
    wy += Math.sin(angle) * 0.85;
    radius = clamp(radius + (Math.random() - 0.5) * 0.14, 1, 3.3);
    if (wx < 2 || wx > WORLD_W - 3 || wy < 7 || wy > WORLD_H - 6) break;
  }
}

function spawnOres() {
  for (let i = 0; i < 56; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 8 + Math.floor(Math.random() * 42);
    paintOreVein(COPPER, x, y, 18 + Math.floor(Math.random() * 16), 1.25 + Math.random() * 0.8, Math.random() * TAU);
  }
  for (let i = 0; i < 34; i++) {
    const x = 4 + Math.floor(Math.random() * (WORLD_W - 8));
    const y = surfaceYs[x] + 30 + Math.floor(Math.random() * 55);
    paintOreVein(IRON, x, y, 18 + Math.floor(Math.random() * 18), 1.2 + Math.random() * 0.9, Math.random() * TAU);
  }
}

function columnHasSurfaceWater(x) {
  const tileX = clamp(x, 0, WORLD_W - 1);
  const surface = surfaceYs[tileX];
  for (let y = Math.max(0, surface - 8); y <= Math.min(WORLD_H - 1, surface); y++) {
    if (isWaterCell(tileX, y)) return true;
  }
  return false;
}

function carvePondColumn(x, floorY, waterline) {
  const tileX = clamp(x, 0, WORLD_W - 1);
  const oldSurface = surfaceYs[tileX];
  const clampedFloor = clamp(Math.max(oldSurface, floorY), 3, WORLD_H - 6);

  for (let y = oldSurface; y < clampedFloor; y++) setBlock(tileX, y, AIR);

  const topType = clampedFloor > waterline ? DIRT : GRASS;
  setBlock(tileX, clampedFloor, topType);
  for (let y = clampedFloor + 1; y < Math.min(WORLD_H, clampedFloor + 4); y++) {
    const current = getBlock(tileX, y);
    if (current === AIR || current === GRASS) setBlock(tileX, y, DIRT);
  }

  for (let y = waterline; y < clampedFloor; y++) setWater(tileX, y, WATER_MAX);
  surfaceYs[tileX] = clampedFloor;
}

function trySpawnSurfacePond(seedX, widthBias = 0) {
  let centerX = clamp(seedX, 14, WORLD_W - 15);
  for (let x = Math.max(8, centerX - 6); x <= Math.min(WORLD_W - 9, centerX + 6); x++) {
    if (surfaceYs[x] > surfaceYs[centerX]) centerX = x;
  }

  const width = 5 + widthBias + Math.floor(hash(centerX * 17) * 3);
  const left = centerX - width;
  const right = centerX + width;
  if (left < 5 || right > WORLD_W - 6) return false;

  const biome = biomes[centerX];
  if (biome === BIOME_ROCKY && hash(centerX * 31) > 0.35) return false;

  for (let x = left - 2; x <= right + 2; x++) {
    if (columnHasSurfaceWater(x)) return false;
  }

  const centerY = surfaceYs[centerX];
  const waterline = Math.max(surfaceYs[left], surfaceYs[right]) + 1;
  const baseDepth = biome === BIOME_MEADOW ? 4 : biome === BIOME_FOREST ? 5 : 3;
  const targetDepth = baseDepth + Math.floor(hash(centerX * 47) * 2);

  let filled = 0;

  for (let x = left; x <= right; x++) {
    const offset = Math.abs(x - centerX);
    const edgeT = offset / width;
    const bowl = Math.max(0, 1 - edgeT * edgeT);
    const floorDepth = Math.max(0, Math.round(bowl * targetDepth) - (edgeT > 0.82 ? 1 : 0));
    const targetFloor = waterline + floorDepth;
    carvePondColumn(x, targetFloor, waterline);

    for (let y = waterline; y < surfaceYs[x]; y++) {
      if (isWaterCell(x, y)) filled++;
    }
  }

  return filled > 24 && surfaceYs[centerX] >= waterline + 2 && centerY <= surfaceYs[centerX];
}

function spawnWaterPools() {
  water.fill(0);
  let ponds = 0;
  const bands = 7;

  for (let band = 0; band < bands; band++) {
    const minX = 18 + Math.floor((WORLD_W - 36) * band / bands);
    const maxX = 18 + Math.floor((WORLD_W - 36) * (band + 1) / bands);
    let created = false;

    for (let attempt = 0; attempt < 7 && !created; attempt++) {
      const seed = minX + Math.floor(Math.random() * Math.max(1, maxX - minX));
      created = trySpawnSurfacePond(seed, attempt > 3 ? 1 : 0);
    }

    if (created) ponds++;
  }

  for (let i = 0; i < 48 && ponds < 8; i++) {
    const seed = 16 + Math.floor(Math.random() * (WORLD_W - 32));
    if (trySpawnSurfacePond(seed, i > 24 ? 1 : 0)) ponds++;
  }
}

function plantTrees() {
  treeCanopies.length = 0;
  const center = Math.floor(WORLD_W / 2);
  for (let x = 6; x < WORLD_W - 6; x++) {
    if (Math.abs(x - center) < 14) continue;
    if (getBlock(x, surfaceYs[x]) !== GRASS) continue;
    if (Math.abs(surfaceYs[x] - surfaceYs[x - 1]) > 1 || Math.abs(surfaceYs[x] - surfaceYs[x + 1]) > 1) continue;
    if (columnHasSurfaceWater(x - 1) || columnHasSurfaceWater(x) || columnHasSurfaceWater(x + 1)) continue;

    const biome = biomes[x];
    const chance = biome === BIOME_FOREST ? 0.12 : biome === BIOME_MEADOW ? 0.07 : 0.018;
    if (Math.random() > chance) continue;

    const trunkHeight = biome === BIOME_FOREST ? 5 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 3);
    for (let y = surfaceYs[x] - 1; y >= surfaceYs[x] - trunkHeight; y--) setBlock(x, y, TREE);

    treeCanopies.push({
      x,
      trunkTopY: surfaceYs[x] - trunkHeight,
      trunkBaseY: surfaceYs[x],
      radius: biome === BIOME_FOREST ? 2 + Math.floor(Math.random() * 2) : 2,
      biome,
    });

    x += 4 + Math.floor(Math.random() * 6);
  }
}

function buildMountainLayer(base, amplitude, scaleX, seed, parallax, dayColor, nightColor) {
  const profile = new Float32Array(WORLD_W);
  for (let x = 0; x < WORLD_W; x++) {
    const broad = octaveNoise((x + seed) / scaleX, 4, 0.54);
    const detail = octaveNoise((x + seed * 3) / 14, 2, 0.4);
    profile[x] = base + broad * amplitude + detail * amplitude * 0.16;
  }
  return { profile, parallax, dayColor, nightColor };
}

function buildSkyDecor() {
  stars.length = 0;
  clouds.length = 0;
  mountainLayers.length = 0;

  for (let i = 0; i < 110; i++) {
    stars.push({ u: Math.random(), v: Math.random() * 0.58, size: Math.random() > 0.87 ? 2 : 1, twinkle: Math.random() * TAU });
  }
  for (let i = 0; i < 14; i++) {
    clouds.push({ x: Math.random() * WORLD_PX, y: 26 + Math.random() * 160, w: 68 + Math.random() * 90, h: 20 + Math.random() * 30, speed: 0.3 + Math.random() * 0.7 });
  }

  mountainLayers.push(buildMountainLayer(0.48, 0.13, 74, 180, 0.18, '#7da0bd', '#273147'));
  mountainLayers.push(buildMountainLayer(0.56, 0.16, 50, 520, 0.28, '#627c98', '#20293d'));
  mountainLayers.push(buildMountainLayer(0.66, 0.14, 32, 870, 0.42, '#44596d', '#172031'));
}

function createWallTexture(base, dark, light, seed) {
  const { texture, g } = makeCanvas();
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, seed);
      if (n > 0.86) pixel(g, x, y, light);
      else if (n < 0.16) pixel(g, x, y, dark);
    }
  }
  return texture;
}

function createGrassTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#8d5b25';
  g.fillRect(0, 0, TILE, TILE);

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 11);
      if (n > 0.84) pixel(g, x, y, '#a86d31');
      else if (n < 0.14) pixel(g, x, y, '#6e4319');
    }
  }

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < TILE; x++) {
      const light = y < 2 ? '#7dd650' : '#5fae35';
      pixel(g, x, y, hash2(x, y, 12) > 0.84 ? '#9cec71' : light);
    }
  }
  for (let x = 0; x < TILE; x += 2) pixel(g, x, 4, '#437b25');
  for (let x = 1; x < TILE; x += 4) pixel(g, x, 0, '#b0f77d');

  return texture;
}

function createDirtTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#85521f';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 20);
      if (n > 0.86) pixel(g, x, y, '#a46b32');
      else if (n < 0.16) pixel(g, x, y, '#653c15');
      else if (n > 0.62 && hash2(x, y, 21) > 0.74) pixel(g, x, y, '#745425');
    }
  }
  return texture;
}

function createStoneTexture(base, light, dark, seed) {
  const { texture, g } = makeCanvas();
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, seed);
      if (n > 0.86) pixel(g, x, y, light);
      else if (n < 0.14) pixel(g, x, y, dark);
      else if (n > 0.46 && n < 0.52) pixel(g, x, y, shiftColor(base, -0.03));
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(hash(seed + i * 7) * 12);
    const y = 2 + Math.floor(hash(seed + i * 11) * 10);
    pixel(g, x, y, dark, 1, 2);
    pixel(g, x + 1, y + 1, dark);
  }
  return texture;
}

function createOreTexture(base, light, dark, nuggetA, nuggetB, seed) {
  const texture = createStoneTexture(base, light, dark, seed);
  const g = texture.getContext('2d');
  for (let y = 2; y < TILE - 2; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      const n = hash2(x, y, seed + 90);
      if (n > 0.91) {
        pixel(g, x, y, nuggetA);
        if (hash2(x, y, seed + 91) > 0.55) pixel(g, x + 1, y, nuggetB);
        if (hash2(x, y, seed + 92) > 0.6) pixel(g, x, y + 1, shiftColor(nuggetA, -0.15));
      }
    }
  }
  return texture;
}

function createWoodTexture() {
  const { texture, g } = makeCanvas();
  g.fillStyle = '#8f622e';
  g.fillRect(0, 0, TILE, TILE);
  for (let x = 0; x < TILE; x++) {
    const stripe = x % 4 === 0 ? '#6c451f' : x % 4 === 2 ? '#aa773b' : null;
    if (stripe) pixel(g, x, 0, stripe, 1, TILE);
  }
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash2(x, y, 70);
      if (n > 0.88) pixel(g, x, y, '#bb8748');
      else if (n < 0.12) pixel(g, x, y, '#5a3818');
    }
  }
  return texture;
}

function buildTextures() {
  tileTextures[GRASS] = createGrassTexture();
  tileTextures[DIRT] = createDirtTexture();
  tileTextures[STONE] = createStoneTexture('#7d7f88', '#9ea3ad', '#5e616a', 30);
  tileTextures[DSTONE] = createStoneTexture('#55525f', '#6d6b78', '#393744', 40);
  tileTextures[COPPER] = createOreTexture('#777981', '#989da6', '#5d6068', '#d28b4b', '#e9ac68', 50);
  tileTextures[IRON] = createOreTexture('#696d77', '#8b929e', '#484d56', '#c0c4cc', '#eff3f9', 60);
  tileTextures[WOOD] = createWoodTexture();
  tileTextures[TREE] = tileTextures[WOOD];
  wallTextures.shallow = createWallTexture('#59402e', '#402c1f', '#6a4e3a', 81);
  wallTextures.deep = createWallTexture('#342822', '#211813', '#473732', 82);
}

function generateWorld() {
  world.fill(0);
  water.fill(0);
  generateBiomeBands();

  for (let x = 0; x < WORLD_W; x++) {
    const surface = groundHeightAt(x);
    const dirtDepth = biomes[x] === BIOME_ROCKY ? 3 : 5 + Math.floor(hash(x * 13) * 3);
    surfaceYs[x] = surface;
    for (let y = 0; y < WORLD_H; y++) {
      if (y < surface) setBlock(x, y, AIR);
      else if (y === surface) setBlock(x, y, GRASS);
      else if (y < surface + dirtDepth) setBlock(x, y, DIRT);
      else if (y < surface + 60) setBlock(x, y, STONE);
      else setBlock(x, y, DSTONE);
    }
  }

  for (let i = 0; i < 10; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    digAirWorm(x, surfaceYs[x], 70 + Math.floor(Math.random() * 50), 1.1 + Math.random() * 0.9, Math.PI / 2 + (Math.random() - 0.5) * 0.55, 0);
  }
  for (let i = 0; i < 24; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    const y = surfaceYs[x] + 12 + Math.floor(Math.random() * 55);
    digAirWorm(x, y, 105 + Math.floor(Math.random() * 85), 1.45 + Math.random() * 1.2, Math.random() * TAU, 5);
  }
  for (let i = 0; i < 10; i++) {
    const x = 6 + Math.floor(Math.random() * (WORLD_W - 12));
    const y = surfaceYs[x] + 58 + Math.floor(Math.random() * 28);
    digAirWorm(x, y, 90 + Math.floor(Math.random() * 65), 2.3 + Math.random() * 1.4, Math.random() * TAU, 8);
  }

  spawnOres();
  spawnWaterPools();
  settleWater(120);
  plantTrees();
}

function findSpawnY() {
  const center = Math.floor(WORLD_W / 2);
  for (let y = 0; y < WORLD_H; y++) {
    const type = getBlock(center, y);
    if (isSolid(type)) return y * TILE - 44;
  }
  return 10 * TILE;
}

resize();
window.addEventListener('resize', resize);
generateWorld();
buildSkyDecor();
buildTextures();

const player = {
  x: WORLD_PX / 2 - 16,
  y: findSpawnY(),
  w: 22,
  h: 44,
  vy: 0,
  onGround: false,
  blockedX: false,
  facing: 1,
  animState: 'stand',
  animFrame: 0,
  animTick: 0,
  air: PLAYER_MAX_AIR,
  maxAir: PLAYER_MAX_AIR,
  inWater: false,
  fullySubmerged: false,
  drownTick: 0,
  jumpLatch: false,
  jumpAnimRestart: false,
  waterExitFrames: 0,
  health: 5,
  maxHealth: 5,
};

cam.x = WORLD_PX / 2 - canvas.width / 2;
cam.y = 48 * TILE - canvas.height / 2;

const GRAVITY = 0.52;
const MAX_FALL = TILE - 1;
const JUMP_VEL = -11.4;
const WATER_EXIT_JUMP_VEL = JUMP_VEL * Math.SQRT1_2;
const WALK_SPEED = 2.45;
const RUN_SPEED = 4.85;

const spritesheet = new Image();
spritesheet.src = 'images/platformer_sprites_pixelized_0.png';

const FRAME_SIZE = 64;
const SHEET_COLS = 8;

const ANIM = {
  stand: { row: 8, colStart: 0 },
  walk: { row: 4, colStart: 0 },
  run: null,
  jump: { row: 5, colStart: 2 },
  mine: { row: 1, colStart: 4 },
};

function collidesWithWorld(px, py, pw, ph) {
  const left = Math.floor(px / TILE);
  const right = Math.floor((px + pw - 1) / TILE);
  const top = Math.floor(py / TILE);
  const bottom = Math.floor((py + ph - 1) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(getBlock(tx, ty))) return true;
    }
  }
  return false;
}

function checkOnGround(px, py, pw, ph) {
  const feetTile = Math.floor((py + ph) / TILE);
  const left = Math.floor(px / TILE);
  const right = Math.floor((px + pw - 1) / TILE);
  for (let tx = left; tx <= right; tx++) {
    if (isSolid(getBlock(tx, feetTile))) return true;
  }
  return false;
}

function simulateWaterStep() {
  waterFlowParity ^= 1;

  for (let y = WORLD_H - 1; y >= 0; y--) {
    const leftToRight = ((y + waterFlowParity) & 1) === 0;
    const startX = leftToRight ? 0 : WORLD_W - 1;
    const endX = leftToRight ? WORLD_W : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const idx = waterIndex(x, y);
      if (isSolid(getBlock(x, y))) {
        water[idx] = 0;
        continue;
      }

      let amount = water[idx];
      if (amount <= WATER_MOVE_THRESHOLD) {
        if (amount > 0) water[idx] = 0;
        continue;
      }

      if (canWaterOccupy(x, y + 1)) {
        const belowIdx = waterIndex(x, y + 1);
        const capacity = WATER_MAX - water[belowIdx];
        if (capacity > WATER_MOVE_THRESHOLD) {
          const flow = Math.min(amount, capacity);
          water[idx] -= flow;
          water[belowIdx] += flow;
          amount -= flow;
        }
      }

      if (amount <= WATER_MOVE_THRESHOLD) {
        water[idx] = 0;
        continue;
      }

      const belowSupported = !canWaterOccupy(x, y + 1) || getWater(x, y + 1) >= WATER_MAX - WATER_MOVE_THRESHOLD;
      if (!belowSupported) continue;

      const dirs = ((x + y + waterFlowParity) & 1) === 0 ? [-1, 1] : [1, -1];
      for (const dir of dirs) {
        const nx = x + dir;
        if (!canWaterOccupy(nx, y)) continue;

        const neighborIdx = waterIndex(nx, y);
        const neighborAmount = water[neighborIdx];
        const desired = (amount + neighborAmount) * 0.5;
        let flow = amount - desired;
        if (flow <= WATER_MOVE_THRESHOLD) continue;

        flow = Math.min(flow, WATER_SIDE_FLOW, amount);
        water[idx] -= flow;
        water[neighborIdx] += flow;
        amount -= flow;

        if (amount <= WATER_MOVE_THRESHOLD) break;
      }

      if (water[idx] <= WATER_MOVE_THRESHOLD) water[idx] = 0;
    }
  }
}

function settleWater(iterations) {
  for (let i = 0; i < iterations; i++) simulateWaterStep();
}

function isPointInWater(px, py) {
  const tileX = Math.floor(px / TILE);
  const tileY = Math.floor(py / TILE);
  const amount = getWater(tileX, tileY);
  if (amount <= WATER_RENDER_EPS) return false;
  const fillTop = tileY * TILE + TILE * (1 - clamp(amount, 0, WATER_MAX));
  return py >= fillTop;
}

function sampleWaterCoverage(px, py, pw, ph) {
  const sampleXs = [px + 3, px + pw * 0.5, px + pw - 3];
  const sampleYs = [py + 4, py + ph * 0.45, py + ph - 4];
  let wet = 0;
  let total = 0;

  for (const sampleY of sampleYs) {
    for (const sampleX of sampleXs) {
      total++;
      if (isPointInWater(sampleX, sampleY)) wet++;
    }
  }

  return total > 0 ? wet / total : 0;
}

const keys = {};
window.addEventListener('keydown', event => {
  if (event.code === 'Tab') {
    event.preventDefault();
    if (!event.repeat) toggleInventory();
    return;
  }
  keys[event.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }
});
window.addEventListener('keyup', event => {
  keys[event.code] = false;
});

const mouse = { x: 0, y: 0, down: false, rightDown: false };
function syncMouseFromEvent(event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
}

const HOTBAR_SIZE = 8;
const BACKPACK_COLS = 8;
const BACKPACK_ROWS = 3;
const BACKPACK_SIZE = BACKPACK_COLS * BACKPACK_ROWS;
const STACK_LIMIT = 999;

function createStack(type = AIR, count = 0) {
  return { type, count };
}

function isEmptyStack(stack) {
  return !stack || stack.type === AIR || stack.count <= 0;
}

function setStack(slot, stack) {
  if (!slot) return;
  slot.type = stack?.type ?? AIR;
  slot.count = stack?.count ?? 0;
  if (slot.type === AIR || slot.count <= 0) {
    slot.type = AIR;
    slot.count = 0;
  }
}

function cloneStack(stack) {
  return createStack(stack?.type ?? AIR, stack?.count ?? 0);
}

const inventory = {
  hotbar: Array.from({ length: HOTBAR_SIZE }, () => createStack()),
  backpack: Array.from({ length: BACKPACK_SIZE }, () => createStack()),
  selected: 0,
  open: false,
};

const dragState = {
  active: false,
  sourceArea: null,
  sourceIndex: -1,
  item: createStack(),
};

inventory.hotbar[0] = { type: DIRT, count: 48 };
inventory.hotbar[1] = { type: STONE, count: 24 };
inventory.hotbar[2] = { type: WOOD, count: 18 };
inventory.hotbar[3] = { type: COPPER, count: 8 };

function getInventoryArray(area) {
  if (area === 'hotbar') return inventory.hotbar;
  if (area === 'backpack') return inventory.backpack;
  return null;
}

function getInventorySlot(area, index) {
  const slots = getInventoryArray(area);
  return slots && index >= 0 && index < slots.length ? slots[index] : null;
}

function getInventorySlotGroups() {
  return [inventory.hotbar, inventory.backpack];
}

function clearDragState() {
  dragState.active = false;
  dragState.sourceArea = null;
  dragState.sourceIndex = -1;
  dragState.item = createStack();
}

function returnDraggedStack() {
  if (!dragState.active || isEmptyStack(dragState.item)) {
    clearDragState();
    return;
  }
  const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
  if (sourceSlot) setStack(sourceSlot, dragState.item);
  else addToInventory(dragState.item.type, dragState.item.count);
  clearDragState();
}

function toggleInventory(forceOpen = !inventory.open) {
  const nextOpen = !!forceOpen;
  if (inventory.open === nextOpen) return;
  if (!nextOpen && dragState.active) returnDraggedStack();
  inventory.open = nextOpen;
}

function dropDraggedStack(area, index) {
  if (!dragState.active) return;

  const targetSlot = getInventorySlot(area, index);
  if (!targetSlot) {
    returnDraggedStack();
    return;
  }

  if (area === 'hotbar') inventory.selected = index;

  if (area === dragState.sourceArea && index === dragState.sourceIndex) {
    setStack(targetSlot, dragState.item);
    clearDragState();
    return;
  }

  if (isEmptyStack(targetSlot)) {
    setStack(targetSlot, dragState.item);
    clearDragState();
    return;
  }

  if (targetSlot.type === dragState.item.type && targetSlot.count < STACK_LIMIT) {
    const transfer = Math.min(STACK_LIMIT - targetSlot.count, dragState.item.count);
    targetSlot.count += transfer;
    dragState.item.count -= transfer;
    if (dragState.item.count <= 0) {
      clearDragState();
      return;
    }
    const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
    if (sourceSlot) setStack(sourceSlot, dragState.item);
    clearDragState();
    return;
  }

  const sourceSlot = getInventorySlot(dragState.sourceArea, dragState.sourceIndex);
  const swapped = cloneStack(targetSlot);
  setStack(targetSlot, dragState.item);
  if (sourceSlot) setStack(sourceSlot, swapped);
  clearDragState();
}

function handleInventoryPrimaryDown() {
  const slotRef = getUiSlotAt(mouse.x, mouse.y);
  if (!slotRef) return;
  if (slotRef.area === 'hotbar') inventory.selected = slotRef.index;
  if (!inventory.open || dragState.active) return;

  const slot = getInventorySlot(slotRef.area, slotRef.index);
  if (isEmptyStack(slot)) return;

  dragState.active = true;
  dragState.sourceArea = slotRef.area;
  dragState.sourceIndex = slotRef.index;
  dragState.item = cloneStack(slot);
  setStack(slot, createStack());
}

window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
  mouse.down = false;
  mouse.rightDown = false;
  returnDraggedStack();
});

canvas.addEventListener('mousemove', event => {
  syncMouseFromEvent(event);
});
canvas.addEventListener('mousedown', event => {
  syncMouseFromEvent(event);
  if (event.button === 0) {
    mouse.down = true;
    handleInventoryPrimaryDown();
  }
  if (event.button === 2) mouse.rightDown = true;
});
window.addEventListener('mouseup', event => {
  syncMouseFromEvent(event);
  if (event.button === 0) {
    if (dragState.active) {
      const slotRef = getUiSlotAt(mouse.x, mouse.y);
      if (slotRef) dropDraggedStack(slotRef.area, slotRef.index);
      else returnDraggedStack();
    }
    mouse.down = false;
  }
  if (event.button === 2) mouse.rightDown = false;
});
canvas.addEventListener('mouseleave', () => {
  mouse.down = false;
  mouse.rightDown = false;
});
canvas.addEventListener('contextmenu', event => event.preventDefault());

function addToInventory(type, amount = 1) {
  if (type === AIR || amount <= 0) return false;
  let remaining = amount;

  for (const slots of getInventorySlotGroups()) {
    for (const slot of slots) {
      if (slot.type !== type || slot.count <= 0 || slot.count >= STACK_LIMIT) continue;
      const transfer = Math.min(STACK_LIMIT - slot.count, remaining);
      slot.count += transfer;
      remaining -= transfer;
      if (remaining <= 0) return true;
    }
  }

  for (const slots of getInventorySlotGroups()) {
    for (const slot of slots) {
      if (!isEmptyStack(slot)) continue;
      const transfer = Math.min(STACK_LIMIT, remaining);
      setStack(slot, createStack(type, transfer));
      remaining -= transfer;
      if (remaining <= 0) return true;
    }
  }

  return remaining <= 0;
}

const MINE_RADIUS_PX = 6 * TILE;
const mining = { bx: -1, by: -1, progress: 0, active: false };

canvas.addEventListener('wheel', event => {
  event.preventDefault();
  inventory.selected = mod(inventory.selected + (event.deltaY > 0 ? 1 : -1), inventory.hotbar.length);
}, { passive: false });

window.addEventListener('keydown', event => {
  const value = parseInt(event.key, 10);
  if (value >= 1 && value <= inventory.hotbar.length) inventory.selected = value - 1;
});

function getMineFrames(type) {
  return blockDefs[type]?.mine || 60;
}

function isPointInRect(px, py, x, y, w, h) {
  return px >= x && px < x + w && py >= y && py < y + h;
}

function getInventoryMetrics() {
  const compact = canvas.width < 520;
  const slotW = compact ? 34 : canvas.width < 720 ? 40 : 48;
  const slotH = slotW;
  const gap = compact ? 5 : 7;
  const hotbarW = HOTBAR_SIZE * slotW + (HOTBAR_SIZE - 1) * gap;
  const hotbarX = Math.floor((canvas.width - hotbarW) / 2);
  const hotbarY = Math.floor(canvas.height - slotH - 18);
  const headerH = compact ? 26 : 28;
  const panelPad = compact ? 12 : 14;
  const gridW = BACKPACK_COLS * slotW + (BACKPACK_COLS - 1) * gap;
  const gridH = BACKPACK_ROWS * slotH + (BACKPACK_ROWS - 1) * gap;
  const backpackW = gridW + panelPad * 2;
  const backpackH = gridH + headerH + panelPad;
  const backpackX = Math.floor((canvas.width - backpackW) / 2);
  const backpackY = hotbarY - backpackH - 14;
  return {
    slotW,
    slotH,
    gap,
    iconSize: Math.floor(slotW * 0.52),
    iconOffsetX: Math.floor((slotW - Math.floor(slotW * 0.52)) / 2),
    iconOffsetY: Math.floor((slotH - Math.floor(slotW * 0.52)) / 2) - 2,
    hotbar: { x: hotbarX, y: hotbarY, w: hotbarW, h: slotH },
    backpack: {
      x: backpackX,
      y: backpackY,
      w: backpackW,
      h: backpackH,
      headerH,
      gridX: backpackX + panelPad,
      gridY: backpackY + headerH,
    },
  };
}

function getSlotRect(area, index, metrics = getInventoryMetrics()) {
  if (area === 'hotbar') {
    if (index < 0 || index >= inventory.hotbar.length) return null;
    return {
      x: Math.floor(metrics.hotbar.x + index * (metrics.slotW + metrics.gap)),
      y: metrics.hotbar.y,
      w: metrics.slotW,
      h: metrics.slotH,
    };
  }

  if (area === 'backpack') {
    if (index < 0 || index >= inventory.backpack.length) return null;
    const col = index % BACKPACK_COLS;
    const row = Math.floor(index / BACKPACK_COLS);
    return {
      x: Math.floor(metrics.backpack.gridX + col * (metrics.slotW + metrics.gap)),
      y: Math.floor(metrics.backpack.gridY + row * (metrics.slotH + metrics.gap)),
      w: metrics.slotW,
      h: metrics.slotH,
    };
  }

  return null;
}

function getUiSlotAt(x, y) {
  const metrics = getInventoryMetrics();

  if (inventory.open) {
    for (let i = 0; i < inventory.backpack.length; i++) {
      const rect = getSlotRect('backpack', i, metrics);
      if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
        return { area: 'backpack', index: i };
      }
    }
  }

  for (let i = 0; i < inventory.hotbar.length; i++) {
    const rect = getSlotRect('hotbar', i, metrics);
    if (rect && isPointInRect(x, y, rect.x, rect.y, rect.w, rect.h)) {
      return { area: 'hotbar', index: i };
    }
  }

  return null;
}

function isPointerOverInventoryUi(x = mouse.x, y = mouse.y) {
  const metrics = getInventoryMetrics();
  if (inventory.open && isPointInRect(x, y, metrics.backpack.x, metrics.backpack.y, metrics.backpack.w, metrics.backpack.h)) {
    return true;
  }
  return isPointInRect(x, y, metrics.hotbar.x, metrics.hotbar.y, metrics.hotbar.w, metrics.hotbar.h);
}

function updateMining(scale = 1) {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  const blockType = getBlock(wx, wy);
  const canMine = mouse.down && !dragState.active && !isPointerOverInventoryUi() &&
                  dist <= MINE_RADIUS_PX && isMineable(blockType);

  if (!canMine) {
    mining.active = false;
    if (!mouse.down || wx !== mining.bx || wy !== mining.by) {
      mining.bx = -1;
      mining.by = -1;
      mining.progress = 0;
    }
    return;
  }

  if (wx !== mining.bx || wy !== mining.by) {
    mining.bx = wx;
    mining.by = wy;
    mining.progress = 0;
  }

  player.facing = wx * TILE + TILE / 2 >= pcx ? 1 : -1;
  mining.active = true;
  mining.progress += scale;

  if (mining.progress >= getMineFrames(blockType)) {
    const drops = blockType === TREE ? breakTreeFrom(wx, wy) : 1;
    if (blockType !== TREE) setBlock(wx, wy, AIR);
    addToInventory(getDropType(blockType), drops);
    mining.bx = -1;
    mining.by = -1;
    mining.progress = 0;
    mining.active = false;
  }
}

let lastPlaceFrame = -1;
function updatePlacement(frame) {
  if (!mouse.rightDown || frame === lastPlaceFrame || dragState.active || isPointerOverInventoryUi()) return;
  lastPlaceFrame = frame;

  const slot = inventory.hotbar[inventory.selected];
  if (!slot || slot.type === AIR || slot.count <= 0) return;

  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);
  if (getBlock(wx, wy) !== AIR) return;
  if (getWater(wx, wy) > WATER_RENDER_EPS) return;

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  if (dist > MINE_RADIUS_PX) return;

  const adjacent = isSolid(getBlock(wx - 1, wy)) || isSolid(getBlock(wx + 1, wy)) ||
                   isSolid(getBlock(wx, wy - 1)) || isSolid(getBlock(wx, wy + 1));
  if (!adjacent) return;

  const blockLeft = wx * TILE;
  const blockTop = wy * TILE;
  const overlaps = blockLeft + TILE > player.x && blockLeft < player.x + player.w &&
                   blockTop + TILE > player.y && blockTop < player.y + player.h;
  if (overlaps) return;

  setBlock(wx, wy, slot.type);
  slot.count--;
  if (slot.count <= 0) {
    slot.count = 0;
    slot.type = AIR;
  }
}

function updatePlayer(scale = 1) {
  player.jumpAnimRestart = false;
  const waterCoverageStart = sampleWaterCoverage(player.x, player.y, player.w, player.h);
  player.waterExitFrames = Math.max(0, player.waterExitFrames - scale);
  const rawInWaterStart = waterCoverageStart > PLAYER_WET_THRESHOLD;
  const inWaterStart = rawInWaterStart && player.waterExitFrames <= 0;
  const jumpHeld = !!(keys['Space'] || keys['KeyW'] || keys['ArrowUp']);
  const jumpPressed = jumpHeld && !player.jumpLatch;
  const centerX = player.x + player.w * 0.5;
  const headInWater = isPointInWater(centerX, player.y + 6);
  const justAboveHeadInWater = isPointInWater(centerX, player.y - 2);
  const nearSurface = headInWater && !justAboveHeadInWater;
  const canWaterLaunch = rawInWaterStart && jumpPressed && (!headInWater || nearSurface || waterCoverageStart < 0.65);
  const canWaterExitStep = (rawInWaterStart || player.inWater || nearSurface || player.waterExitFrames > 0) && (jumpHeld || player.vy < -1);
  const speedBase = keys['ShiftLeft'] || keys['ShiftRight'] ? RUN_SPEED : WALK_SPEED;
  const speed = speedBase * (inWaterStart ? WATER_SPEED_MULT : 1);
  let moveX = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) {
    moveX = -speed * scale;
    player.facing = -1;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    moveX = speed * scale;
    player.facing = 1;
  }

  player.x += moveX;
  if (collidesWithWorld(player.x, player.y, player.w, player.h)) {
    let steppedUp = false;
    if (moveX !== 0) {
      const stepHeights = [];
      if (player.onGround) stepHeights.push(TILE);
      if (canWaterExitStep) stepHeights.push(TILE, TILE * 2);

      for (const stepHeight of stepHeights) {
        if (!collidesWithWorld(player.x, player.y - stepHeight, player.w, player.h)) {
          player.y -= stepHeight;
          steppedUp = true;
          break;
        }
      }
    }

    if (steppedUp) {
      player.blockedX = false;
    } else {
      player.x -= moveX;
      player.blockedX = moveX !== 0;
    }
  } else {
    player.blockedX = false;
  }

  const supportedInWater = inWaterStart && !jumpHeld && player.vy >= 0 &&
    checkOnGround(player.x, player.y, player.w, player.h);

  if (supportedInWater) {
    player.vy = 0;
  } else {
    if (inWaterStart) player.vy *= Math.pow(0.88, scale);

    const gravity = inWaterStart ? GRAVITY * WATER_GRAVITY_MULT : GRAVITY;
    const maxFall = inWaterStart ? WATER_MAX_FALL : MAX_FALL;
    player.vy = Math.min(player.vy + gravity * scale, maxFall);

    if (canWaterLaunch) {
      player.vy = WATER_EXIT_JUMP_VEL;
      player.inWater = false;
      player.waterExitFrames = 12;
      player.jumpAnimRestart = true;
    } else if (inWaterStart && jumpHeld) {
      player.vy = Math.max(player.vy - WATER_SWIM_ACCEL * scale, -4.4);
    }
  }

  player.y += player.vy;
  if (collidesWithWorld(player.x, player.y, player.w, player.h)) {
    if (player.vy > 0) {
      player.y = Math.floor((player.y + player.h) / TILE) * TILE - player.h;
      player.vy = 0;
    } else {
      player.y = Math.ceil(player.y / TILE) * TILE;
      player.vy = 0;
    }
  }

  player.onGround = checkOnGround(player.x, player.y, player.w, player.h);
  if (!rawInWaterStart && jumpHeld && player.onGround) {
    player.vy = JUMP_VEL;
    player.onGround = false;
    player.jumpAnimRestart = true;
  }

  player.x = clamp(player.x, 0, WORLD_PX - player.w);
  player.y = clamp(player.y, 0, WORLD_H * TILE - player.h);

  const waterCoverageEnd = sampleWaterCoverage(player.x, player.y, player.w, player.h);
  const rawInWaterEnd = waterCoverageEnd > PLAYER_WET_THRESHOLD;
  player.inWater = rawInWaterEnd && player.waterExitFrames <= 0;
  player.fullySubmerged = waterCoverageEnd >= PLAYER_SUBMERGED_THRESHOLD && player.waterExitFrames <= 0;

  if (player.fullySubmerged) {
    player.air = Math.max(0, player.air - scale);
    if (player.air <= 0) {
      player.drownTick += scale;
      if (player.drownTick >= DROWN_DAMAGE_FRAMES) {
        player.drownTick = 0;
        player.health = Math.max(0, player.health - 1);
      }
    }
  } else {
    const airRecovery = player.inWater ? 1.6 : 4.5;
    player.air = Math.min(player.maxAir, player.air + airRecovery * scale);
    player.drownTick = 0;
  }

  player.jumpLatch = jumpHeld;
}

function updateCamera(scale = 1) {
  const targetX = player.x + player.w / 2 - canvas.width / 2;
  const targetY = player.y + player.h / 2 - canvas.height * 0.4;
  cam.x += (targetX - cam.x) * 0.1 * scale;
  cam.y += (targetY - cam.y) * 0.1 * scale;
  cam.x = clamp(cam.x, 0, Math.max(0, WORLD_PX - canvas.width));
  cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H * TILE - canvas.height));
}

function updateAnimation(scale = 1) {
  let newState = 'stand';
  const moving = (keys['KeyA'] || keys['KeyD'] || keys['ArrowLeft'] || keys['ArrowRight']) && !player.blockedX;
  const running = keys['ShiftLeft'] || keys['ShiftRight'];

  if (!player.onGround) newState = 'jump';
  else if (mining.active) newState = 'mine';
  else if (moving && running) newState = 'run';
  else if (moving) newState = 'walk';

  if (newState !== player.animState || (newState === 'jump' && player.jumpAnimRestart)) {
    player.animState = newState;
    player.animFrame = 0;
    player.animTick = 0;
  }

  const fps = { stand: 4, walk: 10, run: 12, jump: 8, mine: 10 }[newState] || 4;
  const frameCount = { stand: 1, walk: 8, run: 8, jump: 6, mine: 4 }[newState] || 1;
  const ticksPerFrame = Math.round(60 / fps);

  player.animTick += scale;
  if (player.animTick >= ticksPerFrame) {
    player.animTick = 0;
    if (newState === 'jump') player.animFrame = Math.min(player.animFrame + 1, frameCount - 1);
    else player.animFrame = (player.animFrame + 1) % frameCount;
  }
}

function updateWorld(dt) {
  dayClockMs = mod(dayClockMs + dt, DAY_LENGTH_MS);
  const steps = clamp(Math.round(dt / TARGET_DT) * WATER_STEPS_PER_FRAME, 1, 4);
  for (let i = 0; i < steps; i++) simulateWaterStep();
}

function daylightFactor() {
  return clamp((Math.sin(dayClockMs / DAY_LENGTH_MS * TAU - Math.PI / 2) + 1) / 2, 0, 1);
}

function drawStars(daylight) {
  const alpha = Math.pow(1 - daylight, 1.6);
  if (alpha <= 0.01) return;

  ctx.save();
  for (const star of stars) {
    const twinkle = 0.6 + 0.4 * Math.sin(dayClockMs * 0.002 + star.twinkle);
    ctx.fillStyle = `rgba(255,255,255,${(alpha * twinkle).toFixed(3)})`;
    const x = Math.floor(star.u * canvas.width);
    const y = Math.floor(star.v * canvas.height);
    ctx.fillRect(x, y, star.size, star.size);
    if (star.size > 1) {
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillRect(x - 1, y + 1, 1, 1);
    }
  }
  ctx.restore();
}

function drawSunAndMoon(daylight) {
  const phase = dayClockMs / DAY_LENGTH_MS;
  const sunX = canvas.width * phase;
  const sunY = canvas.height * (0.82 - Math.sin(phase * Math.PI) * 0.56);
  const moonPhase = mod(phase + 0.5, 1);
  const moonX = canvas.width * moonPhase;
  const moonY = canvas.height * (0.82 - Math.sin(moonPhase * Math.PI) * 0.56);

  ctx.save();
  if (daylight > 0.08) {
    ctx.fillStyle = alphaColor('#fff6c2', 0.18 + daylight * 0.16);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 38, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mixColor('#ffd55f', '#fff4c0', daylight);
    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, TAU);
    ctx.fill();
  }
  if (daylight < 0.92) {
    const moonAlpha = Math.pow(1 - daylight, 1.1);
    ctx.fillStyle = alphaColor('#d9e7ff', 0.2 * moonAlpha);
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = alphaColor('#f4f8ff', 0.9 * moonAlpha);
    ctx.beginPath();
    ctx.arc(moonX, moonY, 14, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawCloudShape(x, y, w, h, daylight) {
  const shadow = mixColor('#9cb3cf', '#d9ecff', daylight, 0.4 + daylight * 0.22);
  const body = mixColor('#d7e6f6', '#ffffff', daylight, 0.55 + daylight * 0.22);
  ctx.fillStyle = shadow;
  ctx.fillRect(Math.floor(x + 8), Math.floor(y + h * 0.6), Math.floor(w * 0.75), Math.floor(h * 0.34));
  ctx.fillStyle = body;
  ctx.fillRect(Math.floor(x), Math.floor(y + h * 0.35), Math.floor(w * 0.52), Math.floor(h * 0.38));
  ctx.fillRect(Math.floor(x + w * 0.24), Math.floor(y), Math.floor(w * 0.38), Math.floor(h * 0.5));
  ctx.fillRect(Math.floor(x + w * 0.48), Math.floor(y + h * 0.16), Math.floor(w * 0.36), Math.floor(h * 0.42));
}

function drawClouds(daylight) {
  ctx.save();
  for (const cloud of clouds) {
    const offsetX = mod(cloud.x + dayClockMs * 0.012 * cloud.speed, WORLD_PX + 220) - 110;
    const x = offsetX - cam.x * 0.22;
    const y = cloud.y + Math.sin(dayClockMs * 0.001 + cloud.speed) * 2;
    drawCloudShape(x, y, cloud.w, cloud.h, daylight);
  }
  ctx.restore();
}

function drawMountains(daylight) {
  ctx.save();
  for (const layer of mountainLayers) {
    ctx.beginPath();
    ctx.moveTo(-20, canvas.height);
    for (let x = 0; x < WORLD_W; x += 2) {
      const screenX = x * TILE - cam.x * layer.parallax;
      const screenY = canvas.height * layer.profile[x];
      ctx.lineTo(screenX, screenY);
    }
    ctx.lineTo(WORLD_PX - cam.x * layer.parallax + 20, canvas.height);
    ctx.closePath();
    ctx.fillStyle = mixColor(layer.nightColor, layer.dayColor, daylight);
    ctx.fill();
  }
  ctx.restore();
}

function drawSky() {
  const daylight = daylightFactor();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, mixColor('#08111d', '#69b7f5', daylight));
  gradient.addColorStop(0.72, mixColor('#20344d', '#dff1ff', daylight));
  gradient.addColorStop(1, mixColor('#2a3044', '#f3d79c', daylight * 0.7));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(daylight);
  drawSunAndMoon(daylight);
  drawMountains(daylight);
  drawClouds(daylight);

  const nightOverlay = ((1 - daylight) * 0.12).toFixed(3);
  ctx.fillStyle = `rgba(0,0,0,${nightOverlay})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCaveWall(tileX, tileY, screenX, screenY) {
  const depth = tileY - surfaceYs[tileX];
  const wall = depth > 34 ? wallTextures.deep : wallTextures.shallow;
  ctx.drawImage(wall, screenX, screenY);
  const darkness = clamp((depth - 6) / 72, 0, 0.46);
  ctx.fillStyle = `rgba(5,8,16,${darkness})`;
  ctx.fillRect(screenX, screenY, TILE, TILE);
}

function drawBlockTile(type, tileX, tileY, screenX, screenY) {
  ctx.drawImage(tileTextures[type], screenX, screenY);

  if (type === GRASS) {
    ctx.fillStyle = alphaColor(biomeGrassTints[biomes[tileX]], 0.18);
    ctx.fillRect(screenX, screenY, TILE, 5);
  }
  if (!hasBlock(getBlock(tileX, tileY - 1))) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(screenX, screenY, TILE, 2);
  }
  if (!hasBlock(getBlock(tileX - 1, tileY))) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(screenX, screenY, 1, TILE);
  }
  if (!hasBlock(getBlock(tileX + 1, tileY))) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(screenX + TILE - 2, screenY, 2, TILE);
  }
  if (!hasBlock(getBlock(tileX, tileY + 1))) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(screenX, screenY + TILE - 2, TILE, 2);
  }
}

function drawWorld() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const startX = Math.max(0, Math.floor(camX / TILE) - 1);
  const endX = Math.min(WORLD_W, Math.ceil((camX + canvas.width) / TILE) + 1);
  const startY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endY = Math.min(WORLD_H, Math.ceil((camY + canvas.height) / TILE) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const type = getBlock(x, y);
      const sx = (x * TILE - camX) | 0;
      const sy = (y * TILE - camY) | 0;
      if (type === AIR) {
        if (y > surfaceYs[x]) drawCaveWall(x, y, sx, sy);
        continue;
      }
      drawBlockTile(type, x, y, sx, sy);
    }
  }
}

function drawWater() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const startX = Math.max(0, Math.floor(camX / TILE) - 1);
  const endX = Math.min(WORLD_W, Math.ceil((camX + canvas.width) / TILE) + 1);
  const startY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endY = Math.min(WORLD_H, Math.ceil((camY + canvas.height) / TILE) + 1);

  ctx.save();
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const amount = getWater(x, y);
      if (amount <= WATER_RENDER_EPS) continue;
      const aboveAmount = getWater(x, y - 1);
      const belowAmount = getWater(x, y + 1);
      const isSurface = aboveAmount <= WATER_RENDER_EPS;
      const hasFloorEdge = belowAmount <= WATER_RENDER_EPS;

      const sx = (x * TILE - camX) | 0;
      const sy = (y * TILE - camY) | 0;
      const fillHeight = Math.max(2, Math.min(TILE, Math.round(clamp(amount, 0, WATER_MAX) * TILE)));
      const top = sy + TILE - fillHeight;
      const shimmer = 0.16 + ((Math.sin(dayClockMs * 0.008 + x * 0.75 + y * 0.2) + 1) * 0.5) * 0.12;

      ctx.fillStyle = 'rgba(33,108,206,0.64)';
      ctx.fillRect(sx, top, TILE, fillHeight);
      if (isSurface) {
        ctx.fillStyle = `rgba(178,233,255,${shimmer.toFixed(3)})`;
        ctx.fillRect(sx, top, TILE, Math.min(2, fillHeight));
      }
      if (hasFloorEdge) {
        ctx.fillStyle = 'rgba(7,36,97,0.18)';
        ctx.fillRect(sx, sy + TILE - 1, TILE, 1);
      }
    }
  }
  ctx.restore();
}

function drawLeafBlob(x, y, w, h, palette) {
  ctx.fillStyle = palette.base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = palette.light;
  ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, Math.floor(h * 0.28)));
  ctx.fillStyle = palette.dark;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function drawTreeCanopies() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);

  for (const tree of treeCanopies) {
    if (getBlock(tree.x, tree.trunkTopY) !== TREE) continue;
    const palette = tree.biome === BIOME_MEADOW
      ? { base: '#77c64d', light: '#99ea6c', dark: '#467b2c' }
      : tree.biome === BIOME_ROCKY
        ? { base: '#6aab45', light: '#8fcb64', dark: '#3f6f28' }
        : { base: '#63b440', light: '#8cde65', dark: '#3e6f27' };

    const topX = tree.x * TILE - camX + TILE / 2;
    const topY = tree.trunkTopY * TILE - camY;
    const size = tree.radius * 8;
    const blobs = [
      { x: topX - size - 8, y: topY - size * 0.2, w: size + 8, h: size * 0.8 },
      { x: topX - size * 0.35, y: topY - size - 4, w: size + 10, h: size * 0.9 },
      { x: topX + size * 0.15, y: topY - size * 0.4, w: size, h: size * 0.78 },
      { x: topX - size * 0.7, y: topY + 1, w: size + 18, h: size * 0.58 },
    ];

    for (const blob of blobs) {
      drawLeafBlob(Math.floor(blob.x), Math.floor(blob.y), Math.floor(blob.w), Math.floor(blob.h), palette);
    }
  }
}

function drawPlayer() {
  if (!spritesheet.complete || spritesheet.naturalWidth === 0) {
    ctx.fillStyle = 'rgba(255,200,0,0.9)';
    ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.h);
    return;
  }

  let srcX;
  let srcY;
  if (player.animState === 'run') {
    const globalFrame = player.animFrame + 4;
    srcX = (globalFrame % SHEET_COLS) * FRAME_SIZE;
    srcY = Math.floor(globalFrame / SHEET_COLS) * FRAME_SIZE;
  } else {
    const anim = ANIM[player.animState];
    if (!anim) return;
    srcX = (anim.colStart + player.animFrame) * FRAME_SIZE;
    srcY = anim.row * FRAME_SIZE;
  }

  const drawSize = player.h;
  const screenX = player.x - cam.x + (player.w - drawSize) / 2;
  const screenY = player.y - cam.y;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (player.facing === -1) {
    ctx.translate(screenX + drawSize / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spritesheet, srcX, srcY, FRAME_SIZE, FRAME_SIZE, -drawSize / 2, screenY, drawSize, drawSize);
  } else {
    ctx.drawImage(spritesheet, srcX, srcY, FRAME_SIZE, FRAME_SIZE, screenX, screenY, drawSize, drawSize);
  }
  ctx.restore();
}

function drawMining() {
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const wx = Math.floor((mouse.x + camX) / TILE);
  const wy = Math.floor((mouse.y + camY) / TILE);
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx * TILE + TILE / 2 - pcx, wy * TILE + TILE / 2 - pcy);
  const target = getBlock(wx, wy);
  const inRange = dist <= MINE_RADIUS_PX && isMineable(target);

  if (inRange) {
    const sx = (wx * TILE - camX) | 0;
    const sy = (wy * TILE - camY) | 0;
    const pulse = 0.45 + Math.sin(dayClockMs * 0.01) * 0.15;
    ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
  }

  if (mining.bx >= 0) {
    const sx = (mining.bx * TILE - camX) | 0;
    const sy = (mining.by * TILE - camY) | 0;
    const type = getBlock(mining.bx, mining.by);
    const progress = type === AIR ? 1 : clamp(mining.progress / getMineFrames(type), 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${(progress * 0.58).toFixed(2)})`;
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(sx, sy + TILE + 2, TILE, 4);
    ctx.fillStyle = mixColor('#ff6545', '#7cff7a', progress);
    ctx.fillRect(sx, sy + TILE + 2, Math.round(TILE * progress), 4);
  }
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,11,18,0.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function drawText(text, x, y, color = '#ffffff', font = '14px Minecraft, monospace', align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

const HEART_PATTERN = [
  '01100110',
  '11111111',
  '11111111',
  '01111110',
  '00111100',
  '00011000',
];

function drawHeart(x, y, size, filled) {
  const pixelSize = Math.max(1, Math.floor(size / HEART_PATTERN[0].length));
  for (let row = 0; row < HEART_PATTERN.length; row++) {
    for (let col = 0; col < HEART_PATTERN[row].length; col++) {
      if (HEART_PATTERN[row][col] !== '1') continue;
      ctx.fillStyle = filled ? '#ff5757' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
      if (filled && row < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, 1);
      }
    }
  }
}

function getDepthLabel(depth) {
  if (depth < 6) return 'Surface';
  if (depth < 28) return 'Underground';
  return 'Caverns';
}

function drawStatusHud() {
  const tileX = clamp(Math.floor((player.x + player.w / 2) / TILE), 0, WORLD_W - 1);
  const depth = Math.max(0, Math.floor(player.y / TILE - surfaceYs[tileX]));
  const stage = getDepthLabel(depth);
  const showAir = player.inWater || player.air < player.maxAir;

  for (let i = 0; i < player.maxHealth; i++) {
    drawHeart(18 + i * 22, 18, 16, i < player.health);
  }

  drawPanel(16, 48, 202, showAir ? 98 : 68);
  drawText(`Biome: ${biomeNames[biomes[tileX]]}`, 28, 70, '#ffffff', '14px Minecraft, monospace');
  drawText(`Depth: ${stage} +${depth}`, 28, 90, '#d9e6ff', '14px Minecraft, monospace');
  drawText('LMB mine   RMB place', 28, 110, '#8fb4d9', '12px Minecraft, monospace');

  if (showAir) {
    const airRatio = clamp(player.air / player.maxAir, 0, 1);
    drawText(`Air ${Math.ceil(airRatio * 100)}%`, 28, 130, '#b8ebff', '12px Minecraft, monospace');
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(28, 136, 160, 10);
    ctx.fillStyle = mixColor('#ff7a69', '#74d5ff', airRatio);
    ctx.fillRect(28, 136, Math.round(160 * airRatio), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(28.5, 136.5, 159, 9);
  }
}

function getInventoryIconLayout(slotW, slotH) {
  const iconSize = slotW >= 40 ? TILE * 2 : TILE;
  return {
    size: iconSize,
    x: Math.floor((slotW - iconSize) / 2),
    y: Math.floor((slotH - iconSize) / 2),
  };
}

function drawInventorySlot(stack, x, y, slotW, slotH, options = {}) {
  const selected = !!options.selected;
  const hotkey = options.hotkey || '';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = selected ? 'rgba(46,57,82,0.92)' : 'rgba(10,12,18,0.72)';
  ctx.fillRect(x, y, slotW, slotH);
  if (selected) {
    ctx.fillStyle = 'rgba(255,213,94,0.08)';
    ctx.fillRect(x + 2, y + 2, slotW - 4, slotH - 4);
  }
  ctx.strokeStyle = selected ? '#ffef9c' : 'rgba(255,255,255,0.16)';
  ctx.strokeRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);
  if (selected) {
    ctx.strokeStyle = 'rgba(255,213,94,0.5)';
    ctx.strokeRect(x + 1.5, y + 1.5, slotW - 3, slotH - 3);
  }

  if (!isEmptyStack(stack)) {
    const icon = getInventoryIconLayout(slotW, slotH);
    ctx.drawImage(tileTextures[stack.type], x + icon.x, y + icon.y, icon.size, icon.size);
  }

  if (hotkey) {
    drawText(hotkey, x + 5, y + 13, 'rgba(255,255,255,0.7)', '10px Minecraft, monospace');
  }
  if (stack.count > 0) {
    drawText(String(stack.count), x + slotW - 6, y + slotH - 7, '#ffffff', '12px Minecraft, monospace', 'right');
  }
  ctx.restore();
}

function drawBackpack() {
  if (!inventory.open) return;

  const metrics = getInventoryMetrics();
  const panel = metrics.backpack;

  ctx.save();
  ctx.fillStyle = 'rgba(4,7,12,0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPanel(panel.x, panel.y, panel.w, panel.h);
  ctx.fillStyle = 'rgba(93,132,176,0.16)';
  ctx.fillRect(panel.x + 2, panel.y + 2, panel.w - 4, panel.headerH - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(panel.x + 12, panel.y + panel.headerH - 0.5);
  ctx.lineTo(panel.x + panel.w - 12, panel.y + panel.headerH - 0.5);
  ctx.stroke();
  drawText('BACKPACK', panel.x + 14, panel.y + 18, '#f5f1d0', '13px Minecraft, monospace');
  drawText('TAB', panel.x + panel.w - 14, panel.y + 18, '#8fb4d9', '11px Minecraft, monospace', 'right');

  for (let i = 0; i < inventory.backpack.length; i++) {
    const rect = getSlotRect('backpack', i, metrics);
    const slot = inventory.backpack[i];
    drawInventorySlot(slot, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function drawHotbar() {
  const metrics = getInventoryMetrics();
  const selected = inventory.hotbar[inventory.selected];

  for (let i = 0; i < inventory.hotbar.length; i++) {
    const rect = getSlotRect('hotbar', i, metrics);
    const slot = inventory.hotbar[i];
    drawInventorySlot(slot, rect.x, rect.y, rect.w, rect.h, {
      selected: i === inventory.selected,
      hotkey: String(i + 1),
    });
  }

  if (selected && selected.type !== AIR) {
    const label = blockDefs[selected.type]?.name || 'Block';
    drawText(label.toUpperCase(), Math.floor(canvas.width / 2), metrics.hotbar.y - 10, '#f5f1d0', '14px Minecraft, monospace', 'center');
  }
}

function drawDraggedStack() {
  if (!dragState.active || isEmptyStack(dragState.item)) return;
  const metrics = getInventoryMetrics();
  const x = Math.floor(mouse.x - metrics.slotW * 0.35);
  const y = Math.floor(mouse.y - metrics.slotH * 0.4);
  drawInventorySlot(dragState.item, x, y, metrics.slotW, metrics.slotH, { selected: true });
}

function loop(ts) {
  const dt = ts ? Math.min(ts - lastTime, TARGET_DT * 3) : TARGET_DT;
  lastTime = ts || 0;
  const scale = dt / TARGET_DT;

  updateWorld(dt);
  updatePlayer(scale);
  updateMining(scale);
  updatePlacement(lastTime);
  updateAnimation(scale);
  updateCamera(scale);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawWorld();
  drawWater();
  drawTreeCanopies();
  drawPlayer();
  if (player.fullySubmerged) {
    ctx.fillStyle = 'rgba(24,72,138,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawMining();
  drawBackpack();
  drawStatusHud();
  drawHotbar();
  drawDraggedStack();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
