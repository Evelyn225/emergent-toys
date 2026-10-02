// ---- shops
const WORDS = ['HOTEL','BAR','PIZZA','24/7','CAFE','RAMEN','PAWN','DELI','LIQUOR','BOOKS','ARCADE','NOODLES',
  'LAUNDRY','BARBER','PHARMACY','TATTOO','SUSHI','TACOS','FLORIST','RECORDS','GYM','DINER','BANK','VIDEO',
  'PHONES','KEBAB','DONUTS','THAI','CINEMA','MOTEL','KARAOKE','DUMPLINGS','PET SHOP','HARDWARE','COFFEE','PHO','SPORTS','SKATE','STORAGE'];
const PRODUCE = ['GROCERY','MARKET','FRUIT','BAKERY','BODEGA'];
// each district leans on its own shop names; the rest come from WORDS
const DIST_WORDS = {
  chinatown: ['DUMPLINGS','NOODLES','TEA HOUSE','HERBS','KARAOKE','BAKERY','DIM SUM','JADE','RAMEN','PHO','MAHJONG'],
  downtown: ['BANK','CAFE','HOTEL','COFFEE','SUSHI','GYM','PHARMACY','PHONES','DELI','BAR','SPORTS'],
  industrial: ['AUTO REPAIR','STORAGE','TIRES','HARDWARE','DINER','BAR','WELDING','24/7'],
  brownstones: ['CAFE','BOOKS','FLORIST','BAKERY','LAUNDRY','BARBER','PIZZA','RECORDS','DELI','BAR','PET SHOP','SKATE'],
};
const GLYPHS = { BOOKS: '|][|', RECORDS: '()O', VIDEO: '[]', LIQUOR: 'il!', BAR: 'il!Y', PHARMACY: '+=o', PHONES: '[]#',
  HARDWARE: 'T7/', FLORIST: '*@&', 'PET SHOP': '~>o', ARCADE: '[]#', TATTOO: '*%', LAUNDRY: 'O@', HERBS: '%&*', JADE: 'o@*',
  'TEA HOUSE': 'oc]', TIRES: 'O0o', 'AUTO REPAIR': 'T7/', SPORTS: 'oO@', SKATE: '=_o' };
const LINES = ['Welcome to {}!', 'Looking for anything special?', 'Cash only, sorry.', 'Nice weather, huh?', 'Take your time.'];
// opening hours [open, close) in game hours; close < open wraps past midnight; [0, 24] never closes
const HOURS = { BAR: [16, 3], KARAOKE: [19, 4], ARCADE: [11, 2], CINEMA: [12, 1], '24/7': [0, 24], HOTEL: [0, 24], MOTEL: [0, 24],
  CAFE: [6, 18], COFFEE: [6, 18], DONUTS: [5, 15], BAKERY: [6, 16], DINER: [6, 23], PIZZA: [11, 2], KEBAB: [11, 4], DELI: [7, 22],
  BANK: [9, 17], PHARMACY: [8, 22], GYM: [5, 23], LIQUOR: [10, 23], 'DIM SUM': [8, 15], 'TEA HOUSE': [9, 21], MAHJONG: [14, 2],
  NOODLES: [11, 1], RAMEN: [11, 1], DUMPLINGS: [10, 23], PHO: [9, 22], LAUNDRY: [7, 22], BODEGA: [0, 24], STORAGE: [0, 24] };
const hoursOf = word => HOURS[word] || [9, 20];
const openAt = (sh, t) => { // is this shop open at game hour t?
  if (sh.kind === SHOP_APTS) return true;
  if (sh.kind === SHOP_SHUT) return false;
  const [o, c] = sh.hours;
  return c - o >= 24 || (o < c ? t >= o && t < c : t >= o || t < c);
};
// storefront kinds: lit display, closed shutter, neon interior, produce stand out front, apartment lobby door
const SHOP_LIT = 0, SHOP_SHUT = 1, SHOP_NEON = 2, SHOP_PRODUCE = 3, SHOP_APTS = 4;
function shopOf(seed, dist) {
  let kind = (seed * 7919 | 0) % 4;
  const apts = dist === 'brownstones' ? 0.75 : dist === 'industrial' ? 0.15 : 0.5;
  if (kind === SHOP_SHUT && fract(seed * 331) < apts) kind = SHOP_APTS;
  if (dist === 'brownstones' && kind !== SHOP_APTS && fract(seed * 77) < 0.5) kind = SHOP_APTS; // mostly front doors
  const local = DIST_WORDS[dist], words = kind === SHOP_PRODUCE ? PRODUCE : local && fract(seed * 13) < 0.7 ? local : WORDS;
  const word = kind === SHOP_APTS ? 'No.' + (100 + (seed * 900 | 0)) : words[(seed * 104729 | 0) % words.length];
  return { kind, word, neon: kind === SHOP_APTS ? WHITE : dist === 'chinatown' ? pickBy(seed, [RED, YEL, RED, GREEN]) : NEON[(seed * 1000 | 0) % 4],
           signed: seed > 0.25 || kind === SHOP_APTS, glyphs: GLYPHS[word] || 'o#=@', hours: hoursOf(word) };
}
const pickBy = (seed, a) => a[(seed * 4813 | 0) % a.length];

// ---- the world: an N x N tile of cells (1 cell ~ 10m) that repeats forever.
// NB x NB blocks of 8x8 cells. Each block's first two columns are the street on its west side and its first two
// rows the street on its north side; the 6x6 inside holds buildings, a park, a plaza...
// The city is a coastal strip: block rows 1..SHORE_S-1 are town, SHORE_N and SHORE_S are waterfront, and the rows
// between SHORE_S and the wrap are open sea, wider than the draw distance, so from either shore the city ends at water.
// Two bridges cross it. Streets are segments between intersections and some are left out, so blocks can merge
// into superblocks (the big park, industrial yards); every intersection keeps 0 or at least 2 streets, so there
// are no dead ends.
const SHORE_N = 0, SHORE_S = 25, BRIDGE_X = [9, 22];
const EL_ROW = 13; // the elevated train runs above H(., EL_ROW), all the way round
const relB = v => mod(v + NB / 2, NB) - NB / 2; // nearest copy, in blocks
const bi = (bx, by) => (by & (NB - 1)) * NB + (bx & (NB - 1));
const idx = (x, y) => (y & (N - 1)) * N + (x & (N - 1));

// districts: small neighbourhoods (~5 blocks across, a few minutes' walk) from a jittered grid of seeds, nearest seed
// wins (wrapping east-west), with wobbly borders. Downtown sits round the middle of town, industry along the shores,
// the rest a mix.
const DISTRICTS = ['downtown', 'midtown', 'chinatown', 'industrial', 'brownstones'];
const DIST_SEEDS = [];
for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++)
  DIST_SEEDS.push([(i + 0.2 + hash(i, j, 61) * 0.6) * NB / 6, SHORE_N + 1 + (j + 0.2 + hash(i, j, 62) * 0.6) * (SHORE_S - SHORE_N - 1) / 5, '']);
// a neighbourhood is never the same kind as one next door, so walking a few blocks always takes you somewhere new
for (const seed of DIST_SEEDS) {
  const [sx, sy] = seed, r = hash(sx * 7 | 0, sy * 7 | 0, 63);
  const centre = Math.hypot(relB(sx - NB / 2), sy - (SHORE_S + SHORE_N) / 2), shore = sy < SHORE_N + 4 || sy > SHORE_S - 4;
  if (centre < 4.5) { seed[2] = 'downtown'; continue; }
  const next = DIST_SEEDS.filter(o => o !== seed && o[2] && Math.hypot(relB(o[0] - sx), o[1] - sy) < 7.5).map(o => o[2]);
  const weights = { midtown: 3, brownstones: 3, industrial: shore ? 5 : 0.7, chinatown: DIST_SEEDS.filter(o => o[2] === 'chinatown').length < 2 ? 2 : 0 };
  const opts = Object.keys(weights).filter(t => weights[t] && !next.includes(t)), pool = opts.length ? opts : Object.keys(weights).filter(t => weights[t]);
  let x = r * pool.reduce((t, k) => t + weights[k], 0), k = 0;
  while ((x -= weights[pool[k]]) > 0) k++;
  seed[2] = pool[k];
}
const DIST = new Array(NB * NB);
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  if (by === SHORE_N || by === SHORE_S) { DIST[bi(bx, by)] = 'waterfront'; continue; }
  if (by > SHORE_S) { DIST[bi(bx, by)] = 'sea'; continue; }
  let best = '', bd = Infinity;
  for (const [sx, sy, d] of DIST_SEEDS) {
    const dd = Math.hypot(relB(bx - sx), by - sy) + noise(bx * 0.9, by * 0.9, 77) * 1.6;
    if (dd < bd) { bd = dd; best = d; }
  }
  DIST[bi(bx, by)] = best;
}
const districtOf = (bx, by) => DIST[bi(bx, by)];
const districtAt = (wx, wy) => districtOf(Math.floor(wx / 8), Math.floor(wy / 8));

// block kinds: '' = buildings; open kinds: park, plaza, landmark, construction, yard, waterfront, sea
const KIND = new Array(NB * NB).fill('');
// superblocks: [x0, y0, x1, y1, kind] - the streets inside are removed
const SUPER = [[10, 3, 12, 4, 'park'], [3, 21, 4, 22, 'yard'], [28, 22, 29, 23, 'yard'], [15, 14, 16, 14, 'plaza']];
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  const d = DIST[bi(bx, by)], h = hash(bx, by, 7);
  KIND[bi(bx, by)] = d === 'waterfront' ? 'waterfront' : d === 'sea' ? 'sea'
    : d === 'industrial' ? (h < 0.14 ? 'yard' : h < 0.19 ? 'construction' : '')
    : d === 'brownstones' ? (h < 0.07 ? 'park' : h < 0.1 ? 'plaza' : '')
    : d === 'chinatown' ? (h < 0.08 ? 'plaza' : h < 0.1 ? 'park' : '')
    : (h < 0.03 ? 'park' : h < 0.07 ? 'landmark' : h < 0.1 ? 'construction' : h < 0.14 ? 'plaza' : '');
}
for (const [x0, y0, x1, y1, k] of SUPER) for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) KIND[bi(bx, by)] = k;
const blockKind = (bx, by) => KIND[bi(bx, by)];

// street segments. H(bx, by): the street along the north side of block (bx, by), between intersections (bx, by) and
// (bx+1, by). V(bx, by): the street along its west side, between intersections (bx, by) and (bx, by+1).
const HSEG = new Uint8Array(NB * NB), VSEG = new Uint8Array(NB * NB);
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  HSEG[bi(bx, by)] = by > SHORE_N && by <= SHORE_S ? 1 : 0; // the shore roads are H(., SHORE_N+1) and H(., SHORE_S)
  VSEG[bi(bx, by)] = by > SHORE_N && by < SHORE_S ? 1 : 0; // nothing crosses the waterfront promenades...
  if (BRIDGE_X.includes(bx) && !(by > SHORE_N && by < SHORE_S)) VSEG[bi(bx, by)] = 1; // ...but the bridges
}
for (const [x0, y0, x1, y1] of SUPER) {
  for (let by = y0 + 1; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) HSEG[bi(bx, by)] = 0;
  for (let by = y0; by <= y1; by++) for (let bx = x0 + 1; bx <= x1; bx++) VSEG[bi(bx, by)] = 0;
}
const hseg = (bx, by) => HSEG[bi(bx, by)], vseg = (bx, by) => VSEG[bi(bx, by)];
// streets leaving intersection (bx, by) heading (dx, dy)
const exitOK = (bx, by, dx, dy) => dx > 0 ? hseg(bx, by) : dx < 0 ? hseg(bx - 1, by) : dy > 0 ? vseg(bx, by) : vseg(bx, by - 1);
const degree = (bx, by) => hseg(bx, by) + hseg(bx - 1, by) + vseg(bx, by) + vseg(bx, by - 1);
const onBridge = (bx, by) => BRIDGE_X.includes(bx & (NB - 1)) && (by & (NB - 1)) >= SHORE_S;
// A city that grew rather than one laid out with a ruler: the avenues (every 6th street each way, the shore roads,
// the el street, the bridges) run straight through, but side streets come and go. The old districts have the
// staggered T-junctions of streets that never lined up; industry swallows streets into yards; midtown loses the odd
// one; downtown is mostly planned. A street only goes if no intersection is left a dead end and every street can
// still reach every other.
const AVENUE_V = bx => bx % 6 === 0 || BRIDGE_X.includes(bx), AVENUE_H = by => by % 6 === 4 || by === EL_ROW || by === SHORE_N + 1 || by === SHORE_S;
const LOSE = { brownstones: 0.12, chinatown: 0.15, industrial: 0.3, midtown: 0.1, downtown: 0.03 }; // chance a side street goes
const STAGGER = { brownstones: 0.8, chinatown: 0.8 };                                              // and of the old-town stagger
function connected() { // can every intersection with streets reach every other?
  const seen = new Uint8Array(NB * NB), stack = [];
  let total = 0, start = -1;
  for (let k = 0; k < NB * NB; k++) if (degree(k % NB, k / NB | 0)) { total++; if (start < 0) start = k; }
  stack.push(start); seen[start] = 1; let n = 1;
  while (stack.length) {
    const k = stack.pop(), bx = k % NB, by = k / NB | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (exitOK(bx, by, dx, dy)) {
      const m = bi(bx + dx, by + dy); if (!seen[m]) { seen[m] = 1; n++; stack.push(m); }
    }
  }
  return n === total;
}
const removed = []; // [bx, by, 'h' | 'v'] streets that went (they become lanes, see below)
for (let by = SHORE_N + 1; by < SHORE_S; by++) for (let bx = 0; bx < NB; bx++) for (const o of ['v', 'h']) {
  const k = bi(bx, by), arr = o === 'v' ? VSEG : HSEG;
  if (!arr[k] || (o === 'v' ? AVENUE_V(bx) : AVENUE_H(by))) continue;
  const d = DIST[k], stagger = o === 'v' && ((bx + by) & 1) && hash(bx, by, 64) < (STAGGER[d] || 0);
  if (!stagger && hash(bx, by, o === 'v' ? 65 : 66) >= (LOSE[d] || 0)) continue;
  arr[k] = 0;
  const ends = o === 'v' ? [[bx, by], [bx, by + 1]] : [[bx, by], [bx + 1, by]];
  if (ends.some(([x, y]) => degree(x, y) === 1) || !connected()) arr[k] = 1; else removed.push([bx, by, o]);
}

function streetProblems() { // for the tests: every intersection has no streets or at least two, all connected
  const bad = [];
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) if (degree(bx, by) === 1) bad.push([bx, by]);
  if (!connected()) bad.push('disconnected');
  return bad;
}

// ROAD: what kind of street a cell is. 0 not a street, 1 north-south street, 2 east-west street, 3 intersection
const ROAD = new Uint8Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const lx = x & 7, ly = y & 7, bx = x >> 3, by = y >> 3;
  ROAD[y * N + x] = lx < 2 && ly < 2 ? (degree(bx, by) ? 3 : 0) : lx < 2 ? (vseg(bx, by) ? 1 : 0) : ly < 2 ? (hseg(bx, by) ? 2 : 0) : 0;
}

// the coast: a wavy shoreline inside each waterfront row (periodic, so it meets itself across the wrap)
const TAU = Math.PI * 2;
const wave = (x, k) => 0.8 * Math.sin(TAU * x / N * 3 + k) + 0.5 * Math.sin(TAU * x / N * 11 + 2 * k) + 0.3 * Math.sin(TAU * x / N * 23 + 3 * k);
const shoreS = x => SHORE_S * 8 + 4.6 + wave(x, 1); // land is north of this line in the south waterfront
const shoreN = x => SHORE_N * 8 + 3.4 + wave(x, 4); // and south of this one in the north waterfront
// piers: walkable decks out over the water [x0, y0, x1, y1]; wider docks along the industrial shore
const PIERS = [];
for (let bx = 0; bx < NB; bx++) {
  if (BRIDGE_X.includes(bx)) continue;
  const dock = districtOf(bx, SHORE_S - 1) === 'industrial';
  if (dock && hash(bx, 4, 43) < 0.5) PIERS.push([bx * 8 + 3.6, SHORE_S * 8 + 3, bx * 8 + 6.4, SHORE_S * 8 + 11]);
  else if (hash(bx, 5, 43) < 0.35) PIERS.push([bx * 8 + 4.6, SHORE_S * 8 + 3, bx * 8 + 5.4, SHORE_S * 8 + 13]);
  if (hash(bx, 6, 43) < 0.25) PIERS.push([bx * 8 + 4.6, N + SHORE_N * 8 - 9, bx * 8 + 5.4, N + SHORE_N * 8 + 5]);
}
const onPier = (x, y) => PIERS.some(([x0, y0, x1, y1]) => mod(x - x0, N) < x1 - x0 && mod(y - y0, N) < y1 - y0);
const seaAt = (wx, wy) => { const y = mod(wy, N); return y > shoreS(wx) || y < shoreN(wx); };
// open water you can't walk or drive on (park ponds are separate, see inPond)
const isWater = (wx, wy) => seaAt(wx, wy) && !(ROAD[idx(Math.floor(wx), Math.floor(wy))]) && !onPier(wx, wy);

// ---- buildings: N x N cell heights (1 = 10m), facade style, per-lot seed and shop
// STY 0 office, 1 glass, 2 brick, 7 tenement, 8 warehouse, 9 brownstone, 10 chinatown shophouse;
// 3-6 are landmarks and construction (clock tower, cathedral, video-screen tower, steel frame)
const map = new Float32Array(N * N), STY = new Uint8Array(N * N), SEED = new Float32Array(N * N), SHOP = new Array(N * N);
const LANDMARK_TYPES = ['clock', 'cathedral', 'screens', 'radio'], landmarkOf = new Map();
for (let by = 0, n = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++)
  if (blockKind(bx, by) === 'landmark') landmarkOf.set(bi(bx, by), LANDMARK_TYPES[n++ % 4]);
function setCells(bx, by, x0, y0, x1, y1, h, sty) { // block-local cell rectangle [x0..x1] x [y0..y1]
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = idx(bx * 8 + x, by * 8 + y); map[i] = h; STY[i] = sty; }
}
// how a district cuts its 6x6 block into lots: lot index for block-local cell (x, y) in 2..7
const LOTS = {
  grid: (x, y) => ((y - 2) / 3 | 0) * 2 + ((x - 2) / 3 | 0),           // 2x2 lots of 3x3
  rows: (x, y) => ((y - 2) / 3 | 0) * 3 + ((x - 2) / 2 | 0),           // 3x2 narrow row houses, 2 wide
  whole: () => 0,                                                    // one big building
  halves: (x, y) => (y - 2) / 3 | 0,                                 // two long sheds
};
// per district: lot layout (by block hash), height (by lot hash) and facade style
const BUILD = {
  downtown: { lots: h => h < 0.25 ? LOTS.whole : LOTS.grid, height: (h, w) => 5 + Math.floor(h ** 1.4 * (w ? 13 : 10)), sty: s => s < 0.55 ? 1 : 0 },
  midtown: { lots: () => LOTS.grid, height: h => 1 + Math.floor(h ** 2 * 8), sty: s => [0, 1, 2, 7][s * 4 | 0] },
  chinatown: { lots: () => LOTS.rows, height: h => 2 + Math.floor(h * 3.5), sty: s => s < 0.75 ? 10 : 7 },
  industrial: { lots: h => h < 0.5 ? LOTS.whole : LOTS.halves, height: h => 1 + Math.round(h * 2) / 2, sty: s => s < 0.85 ? 8 : 2 },
  brownstones: { lots: () => LOTS.rows, height: h => 1.3 + Math.round(h * 5) / 10, sty: s => s < 0.8 ? 9 : 2 },
};
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
  const kind = blockKind(bx, by), lm = landmarkOf.get(bi(bx, by));
  if (lm === 'clock') setCells(bx, by, 4, 4, 5, 5, 12, 3);
  if (lm === 'cathedral') { setCells(bx, by, 3, 4, 6, 7, 3, 4); setCells(bx, by, 3, 3, 3, 3, 8, 4); setCells(bx, by, 6, 3, 6, 3, 8, 4); }
  if (lm === 'screens') setCells(bx, by, 3, 3, 6, 6, 6, 5);
  if (kind === 'construction') setCells(bx, by, 2, 2, 4, 4, 3 + (hash(bx, by, 96) * 3 | 0), 6);
  if (kind) continue;
  const dist = DIST[bi(bx, by)], B = BUILD[dist], layout = B.lots(hash(bx, by, 31)), lotShop = [];
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) {
    const li = layout(x, y), k = bi(bx, by) * 8 + li, i = idx(bx * 8 + x, by * 8 + y);
    map[i] = B.height(hash(k, 1, 3), layout === LOTS.whole);
    STY[i] = B.sty(hash(k, 11, 3));
    SEED[i] = hash(k, 5, 3);
    SHOP[i] = lotShop[li] || (lotShop[li] = shopOf(SEED[i], dist));
  }
}

// A street that went between two built-up blocks doesn't leave a 20m gap: the buildings on one side grow into half
// of it, leaving a 10m lane between them (walkable, unlit, no traffic).
function copyCell(from, to) { map[to] = map[from]; STY[to] = STY[from]; SEED[to] = SEED[from]; SHOP[to] = SHOP[from]; }
for (const [bx, by, o] of removed) {
  if (o === 'v' && !blockKind(bx - 1, by) && !blockKind(bx, by))
    for (let y = by * 8 + 2; y < by * 8 + 8; y++) { const from = idx(bx * 8 - 1, y); if (map[from]) copyCell(from, idx(bx * 8, y)); }
  if (o === 'h' && !blockKind(bx, by - 1) && !blockKind(bx, by))
    for (let x = bx * 8 + 2; x < bx * 8 + 8; x++) { const from = idx(x, by * 8 - 1); if (map[from]) copyCell(from, idx(x, by * 8)); }
}
for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { // a crossing nothing uses any more: its corner fills in too
  const from = idx(bx * 8 - 1, by * 8 - 1);
  if (!degree(bx, by) && map[from] && !blockKind(bx - 1, by - 1) && map[idx(bx * 8, by * 8 + 2)] !== undefined) copyCell(from, idx(bx * 8, by * 8));
}

// ---- street names, for talk, directions and the HUD
const ord = n => n + ((n % 100 / 10 | 0) === 1 ? 'TH' : [, 'ST', 'ND', 'RD'][n % 10] || 'TH');
const ST_NAMES = ['', 'BAYSIDE DR', 'KING ST', 'CANAL ST', 'MERCER ST', '5TH ST', 'GRAND ST', 'MOTT ST', 'HOUSTON ST', '9TH ST',
  'BLEECKER ST', 'SPRING ST', '12TH ST', 'BROOME ST', '14TH ST', 'WATER ST', 'PEARL ST', '17TH ST', 'HUDSON ST', 'BANK ST',
  '20TH ST', 'FRONT ST', 'DOCK ST', '23RD ST', 'HARBOR ST', 'WATERFRONT DR'];
const AVE_NAMES = Array.from({ length: NB }, (_, bx) => bx === 16 ? 'BROADWAY' : ord(bx < 16 ? bx + 1 : bx) + ' AVE');
const BRIDGE_NAMES = { 9: 'IRON BRIDGE', 22: 'HARBOR BRIDGE' };
function streetName(wx, wy) { // '' when not on a street
  const x = Math.floor(wx), y = Math.floor(wy), r = ROAD[idx(x, y)], bx = (x >> 3) & (NB - 1), by = (y >> 3) & (NB - 1);
  const ave = onBridge(bx, by) ? BRIDGE_NAMES[bx] : AVE_NAMES[bx];
  if (r !== 3) return r === 1 ? ave : r === 2 ? ST_NAMES[by] : '';
  const h = hseg(bx, by) || hseg(bx - 1, by), v = vseg(bx, by) || vseg(bx, by - 1);
  return h && v ? ST_NAMES[by] + ' & ' + ave : h ? ST_NAMES[by] : ave;
}
