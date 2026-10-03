// ---- shops
const WORDS = ['HOTEL','BAR','PIZZA','24/7','CAFE','RAMEN','PAWN','DELI','LIQUOR','BOOKS','ARCADE','NOODLES',
  'LAUNDRY','BARBER','PHARMACY','TATTOO','SUSHI','TACOS','FLORIST','RECORDS','GYM','DINER','BANK','VIDEO',
  'PHONES','KEBAB','DONUTS','THAI','CINEMA','MOTEL','KARAOKE','DUMPLINGS','PET SHOP','HARDWARE','COFFEE','PHO','SPORTS','SKATE','STORAGE',
  'BURGERS','CHICKEN','JUICE','ICE CREAM','TOYS','THRIFT','TOBACCO','CARS','REALTY'];
const PRODUCE = ['GROCERY','MARKET','FRUIT','BAKERY','BODEGA'];
// each district leans on its own shop names; the rest come from WORDS
const DIST_WORDS = {
  chinatown: ['DUMPLINGS','NOODLES','TEA HOUSE','HERBS','KARAOKE','BAKERY','DIM SUM','JADE','RAMEN','PHO','MAHJONG'],
  downtown: ['BANK','CAFE','HOTEL','COFFEE','SUSHI','GYM','PHARMACY','PHONES','DELI','BAR','SPORTS','JUICE','BURGERS','REALTY','CARS'],
  industrial: ['AUTO REPAIR','STORAGE','TIRES','HARDWARE','DINER','BAR','WELDING','24/7','CHICKEN','TOBACCO','CARS'],
  brownstones: ['CAFE','BOOKS','FLORIST','BAKERY','LAUNDRY','BARBER','PIZZA','RECORDS','DELI','BAR','PET SHOP','SKATE','BAGELS','THRIFT','ICE CREAM','TOYS','REALTY'],
  shotengai: ['PACHINKO','CRANE GAME','IZAKAYA','YAKITORI','TAKOYAKI','RAMEN','SUSHI','BENTO','KARAOKE','CAPSULE','MANGA','RECORDS','DRUGSTORE','ARCADE','KISSATEN','24/7','GACHA','HARDWARE'],
};
const GLYPHS = { BOOKS: '|][|', RECORDS: '()O', VIDEO: '[]', LIQUOR: 'il!', BAR: 'il!Y', PHARMACY: '+=o', PHONES: '[]#',
  HARDWARE: 'T7/', FLORIST: '*@&', 'PET SHOP': '~>o', ARCADE: '[]#', TATTOO: '*%', LAUNDRY: 'O@', HERBS: '%&*', JADE: 'o@*',
  'TEA HOUSE': 'oc]', TIRES: 'O0o', 'AUTO REPAIR': 'T7/', SPORTS: 'oO@', SKATE: '=_o', TOYS: 'o*@&', THRIFT: '|]&', TOBACCO: 'i=', MANGA: '|][|', DRUGSTORE: '+=o', GACHA: 'oO@' };
const LINES = ['Welcome to {}!', 'Looking for anything special?', 'Cash only, sorry.', 'Nice weather, huh?', 'Take your time.'];
// opening hours [open, close) in game hours; close < open wraps past midnight; [0, 24] never closes
const HOURS = { CASINO: [10, 6], BAR: [16, 3], KARAOKE: [19, 4], ARCADE: [11, 2], CINEMA: [12, 1], '24/7': [0, 24], HOTEL: [0, 24], MOTEL: [0, 24],
  CAFE: [6, 18], COFFEE: [6, 18], DONUTS: [5, 15], BAKERY: [6, 16], DINER: [6, 23], PIZZA: [11, 2], KEBAB: [11, 4], DELI: [7, 22],
  CARS: [9, 19], REALTY: [9, 18], BURGERS: [11, 1], CHICKEN: [11, 2], JUICE: [7, 18], 'ICE CREAM': [12, 22], BAGELS: [6, 14], TOYS: [10, 19], THRIFT: [10, 18], TOBACCO: [8, 22],
  BANK: [9, 17], PHARMACY: [8, 22], GYM: [5, 23], LIQUOR: [10, 23], 'DIM SUM': [8, 15], 'TEA HOUSE': [9, 21], MAHJONG: [14, 2],
  NOODLES: [11, 1], RAMEN: [11, 1], DUMPLINGS: [10, 23], PHO: [9, 22], LAUNDRY: [0, 24], BODEGA: [0, 24], STORAGE: [0, 24], AQUARIUM: [9, 21],
  PACHINKO: [10, 23], 'CRANE GAME': [10, 2], IZAKAYA: [17, 3], YAKITORI: [17, 2], TAKOYAKI: [11, 23], BENTO: [7, 21], CAPSULE: [0, 24], MANGA: [10, 23], DRUGSTORE: [9, 23], KISSATEN: [7, 20], GACHA: [10, 22] };
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
  if (kind === SHOP_SHUT && fract(seed * 53) < 0.5) kind = SHOP_LIT; // (not so many boarded-up shops)
  if (dist === 'brownstones' && kind !== SHOP_APTS && fract(seed * 77) < 0.5) kind = SHOP_APTS; // mostly front doors
  if (dist === 'shotengai' && kind !== SHOP_PRODUCE && fract(seed * 57) < 0.8) kind = fract(seed * 91) < 0.4 ? SHOP_NEON : SHOP_LIT; // shops, shops, shops
  const local = DIST_WORDS[dist], words = kind === SHOP_PRODUCE ? PRODUCE : local && fract(seed * 13) < 0.7 ? local : WORDS;
  const word = kind === SHOP_APTS ? 'No.' + (100 + (seed * 900 | 0)) : words[(seed * 104729 | 0) % words.length];
  return { kind, word, neon: kind === SHOP_APTS ? WHITE : dist === 'chinatown' ? pickBy(seed, [RED, YEL, RED, GREEN]) : NEON[(seed * 1000 | 0) % 4],
           glyphs: GLYPHS[word] || 'o#=@', hours: hoursOf(word) };
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
const DISTRICTS = ['downtown', 'midtown', 'chinatown', 'industrial', 'brownstones', 'shotengai'];
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
// the Shotengai: the midtown neighbourhood nearest the south side of downtown becomes covered shopping streets
{
  let best = null, bd = Infinity;
  for (const s of DIST_SEEDS) if (s[2] === 'midtown') { const d = Math.hypot(relB(s[0] - NB / 2), s[1] - (SHORE_S + SHORE_N) / 2 - 5); if (d < bd) { bd = d; best = s; } }
  best[2] = 'shotengai';
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
const SUPER = [[10, 3, 12, 4, 'park'], [3, 21, 4, 22, 'yard'], [28, 22, 29, 23, 'yard'], [15, 14, 16, 14, 'plaza'], [7, 10, 9, 11, 'gardens']];
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
const LOSE = { brownstones: 0.12, chinatown: 0.15, industrial: 0.3, midtown: 0.1, downtown: 0.03, shotengai: 0.06 }; // chance a side street goes
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
// lighthouse island: a small rocky island out in the bay off the foot of Broadway, its lighthouse on the far side,
// reached by a long footbridge from the waterfront promenade. The coast wobbles (isleR), so it isn't a circle.
const ISLE_BX = 16, ISLE = { x: ISLE_BX * 8 + 5, y: SHORE_S * 8 + 33, r: 5 };
const LIGHTHOUSE = { x: ISLE.x + 1.2, y: ISLE.y + 2.2, r: 0.26 };
const FOOTBRIDGE = { x: ISLE.x, hw: 0.16, y0: SHORE_S * 8 + 2.6, y1: ISLE.y - 2.5 }; // a deck 3m wide, running south
const isleR = th => ISLE.r * (1 + 0.16 * Math.sin(3 * th + 1) + 0.08 * Math.sin(5 * th + 2) + 0.05 * Math.sin(9 * th));
function isleEdge(x, y) { // how far inside the island's coast (x, y) is, in cells; negative out at sea
  const ex = rel(x - ISLE.x), ey = rel(y - ISLE.y);
  if (Math.abs(ex) > ISLE.r * 1.5 || Math.abs(ey) > ISLE.r * 1.5) return -ISLE.r;
  return isleR(Math.atan2(ey, ex)) - Math.hypot(ex, ey);
}
const onIsland = (x, y) => isleEdge(x, y) > 0;
const onFootbridge = (x, y) => Math.abs(rel(x - FOOTBRIDGE.x)) < FOOTBRIDGE.hw && mod(y, N) > FOOTBRIDGE.y0 && mod(y, N) < FOOTBRIDGE.y1;
// the Sunset Pier: a wide boardwalk out into the bay off the first stretch of shore east of the island that isn't
// docks or a bridge. Game booths and a prize stall down its sides, a carousel in the middle, the Ferris wheel out at
// the end (its wheel stands across the pier, east-west, so you see it face on from the promenade).
const FAIR_BX = (() => { for (let bx = ISLE_BX + 3; ; bx++) if (!BRIDGE_X.includes(bx) && districtOf(bx, SHORE_S - 1) !== 'industrial') return bx; })();
const FAIR = { x0: FAIR_BX * 8 + 2.2, x1: FAIR_BX * 8 + 7.8, y0: SHORE_S * 8 + 3, y1: SHORE_S * 8 + 17 };
FAIR.cx = (FAIR.x0 + FAIR.x1) / 2;
const WHEEL = { x: FAIR.cx, y: FAIR.y1 - 2.6, R: 1.9, hub: 2.2, n: 12, rev: 60 }; // 19m radius, 42m to the top, once round a minute
const CAROUSEL = { x: FAIR.cx, y: FAIR.y0 + 4.6, r: 0.55, rev: 9 };
const WHEEL_BOARD = { x: WHEEL.x, y: WHEEL.y - 0.55 }; // where you queue: the platform in front of the bottom car
// where the wheel's car k is (angle round the hub, 0 = level with it on the east side), at time t
const wheelAngle = (k, t) => TAU * (t / WHEEL.rev + k / WHEEL.n) - Math.PI / 2;
// the carousel's drum and the wheel's legs are in the way; the booths are solids (props.js)
const fairBlocked = (x, y, pad = 0) => Math.hypot(rel(x - CAROUSEL.x), rel(y - CAROUSEL.y)) < CAROUSEL.r + pad ||
  Math.abs(rel(x - WHEEL.x)) < 0.35 + pad && Math.abs(rel(y - WHEEL.y)) < 0.35 + pad;
// piers: walkable decks out over the water [x0, y0, x1, y1]; wider docks along the industrial shore
const PIERS = [[FAIR.x0, FAIR.y0, FAIR.x1, FAIR.y1]];
for (let bx = 0; bx < NB; bx++) {
  if (BRIDGE_X.includes(bx) || bx === ISLE_BX) continue;
  const dock = districtOf(bx, SHORE_S - 1) === 'industrial';
  if (dock && hash(bx, 4, 43) < 0.5) PIERS.push([bx * 8 + 3.6, SHORE_S * 8 + 3, bx * 8 + 6.4, SHORE_S * 8 + 11]);
  else if (hash(bx, 5, 43) < 0.35 && bx !== FAIR_BX) PIERS.push([bx * 8 + 4.6, SHORE_S * 8 + 3, bx * 8 + 5.4, SHORE_S * 8 + 13]);
  if (hash(bx, 6, 43) < 0.25) PIERS.push([bx * 8 + 4.6, N + SHORE_N * 8 - 9, bx * 8 + 5.4, N + SHORE_N * 8 + 5]);
}
const onPier = (x, y) => PIERS.some(([x0, y0, x1, y1]) => mod(x - x0, N) < x1 - x0 && mod(y - y0, N) < y1 - y0) || onFootbridge(x, y);
const seaAt = (wx, wy) => { const y = mod(wy, N); return (y > shoreS(wx) || y < shoreN(wx)) && !onIsland(wx, wy); };
// ---- the Botanical Gardens: a walled garden over three blocks by two (the streets inside it are gone). In garden
// coordinates gx, gy (cells from its north-west inside corner): a lake to the east with a jetty for the swan boats,
// the glass conservatory to the north-west, the aviary to the south-west, enclosures, winding gravel paths between.
const GARDEN = { x0: 7 * 8 + 2, y0: 10 * 8 + 2, w: 22, h: 14 };
const gardenLocal = (x, y) => [mod(x, N) - GARDEN.x0, mod(y, N) - GARDEN.y0];
const inGardens = (x, y) => { const [gx, gy] = gardenLocal(x, y); return gx >= 0 && gy >= 0 && gx < GARDEN.w && gy < GARDEN.h; };
const LAKE = { x: 15, y: 8.2, rx: 4.6, ry: 3.4 };
function gardenLakeEdge(gx, gy) { // how far inside the lake's shore (gx, gy) is (cells, roughly); negative on land
  const ex = (gx - LAKE.x) / LAKE.rx, ey = (gy - LAKE.y) / LAKE.ry, ang = Math.atan2(ey, ex);
  const r = 1 + 0.12 * Math.sin(3 * ang + 1) + 0.07 * Math.sin(5 * ang + 2);
  return (r - Math.hypot(ex, ey)) * Math.min(LAKE.rx, LAKE.ry);
}
const JETTY = { gx0: 9.3, gx1: 11.6, gy: 8.2, hw: 0.18 }; // a wooden jetty out from the west shore
const onJetty = (gx, gy) => gx > JETTY.gx0 && gx < JETTY.gx1 && Math.abs(gy - JETTY.gy) < JETTY.hw;
const gardenLake = (x, y) => { if (!inGardens(x, y)) return false; const [gx, gy] = gardenLocal(x, y); return gardenLakeEdge(gx, gy) > 0 && !onJetty(gx, gy); };
// the paths: gravel, 2.5m wide, winding between the four gates and round the lake (garden coordinates)
const GARDEN_PATHS = [
  [[11, 0], [10.4, 2.2], [8.2, 4.4], [7.6, 6.6], [8.4, 8.2], [10, 8.2]],                 // north gate, past the conservatory, to the jetty
  [[0, 7], [2.6, 6.8], [5.2, 7.6], [7.6, 6.6]],                                          // the west gate
  [[11, 14], [10.4, 12.2], [8.6, 10.6], [8.4, 8.2]],                                     // the south gate
  [[22, 7], [20.6, 6.4], [20.4, 3.6], [17.2, 3.4], [13.2, 3.6], [10.4, 2.2]],           // the east gate, round the top of the lake
  [[20.6, 6.4], [21, 9.6], [19.6, 12.4], [15.4, 12.8], [11.6, 12.6], [10.4, 12.2]],     // and round the bottom
  [[4.2, 4.6], [5.2, 7.6], [4.6, 8.6]],                                                  // the conservatory door to the aviary door
];
function gardenPathDist(gx, gy) {
  let best = Infinity;
  for (const pl of GARDEN_PATHS) for (let k = 1; k < pl.length; k++) {
    const [ax, ay] = pl[k - 1], [bx, by] = pl[k], vx = bx - ax, vy = by - ay, t = clamp(((gx - ax) * vx + (gy - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    best = Math.min(best, Math.hypot(gx - ax - vx * t, gy - ay - vy * t));
  }
  return best;
}
const GARDEN_GATES = [[11, 0, 'h'], [11, 14, 'h'], [0, 7, 'v'], [22, 7, 'v']]; // gx, gy of each gate's middle, and which way the railing runs
const gardensOpen = t => t >= 8 && t < 20;
// the two glass houses: cells of the map, with a shop each for their doors (STY 18 the conservatory, 19 the aviary)
const GLASSHOUSES = [{ word: 'CONSERVATORY', gx0: 2, gy0: 1, gx1: 6, gy1: 3, h: 1.1, dome: 1.6, sty: 18, fee: 5, door: [4.5, 4] },
                     { word: 'AVIARY', gx0: 2, gy0: 9, gx1: 4, gy1: 11, h: 0.9, dome: 1.2, sty: 19, fee: 0, door: [3.5, 9] }];
// open water you can't walk or drive on (park ponds are separate, see inPond)
const isWater = (wx, wy) => seaAt(wx, wy) && !(ROAD[idx(Math.floor(wx), Math.floor(wy))]) && !onPier(wx, wy) || gardenLake(wx, wy);

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
  downtown: { lots: h => h < 0.25 ? LOTS.whole : LOTS.grid, height: (h, w) => 5 + Math.floor(h ** 1.4 * (w ? 13 : 10)), sty: s => s < 0.45 ? 1 : s < 0.8 ? 0 : 14 },
  midtown: { lots: () => LOTS.grid, height: h => 1 + Math.floor(h ** 2 * 8), sty: s => [0, 1, 2, 7, 14, 15, 16, 2][s * 8 | 0] },
  chinatown: { lots: () => LOTS.rows, height: h => 2 + Math.floor(h * 3.5), sty: s => s < 0.75 ? 10 : 7 },
  industrial: { lots: h => h < 0.5 ? LOTS.whole : LOTS.halves, height: h => 1 + Math.round(h * 2) / 2, sty: s => s < 0.75 ? 8 : s < 0.9 ? 15 : 2 },
  brownstones: { lots: () => LOTS.rows, height: h => 1.3 + Math.round(h * 5) / 10, sty: s => s < 0.75 ? 9 : s < 0.9 ? 16 : 2 },
  shotengai: { lots: () => LOTS.rows, height: h => 1.6 + Math.round(h * 6) / 4, sty: () => 17 }, // narrow, 16-30m, every one with signs
};
// the Shotengai's streets have a roof over them (city-render.js draws it, from underneath)
const ARCADE_Z = 0.62; // 6m up
const arcadeAt = (x, y) => ROAD[idx(Math.floor(x), Math.floor(y))] > 0 && districtAt(x, y) === 'shotengai';
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

// ---- emergency services: police stations, fire stations and hospitals, where the emergency vehicles live (see
// stepEmergency). Each takes the lot on the north-west corner of a built-up block, fronting the street along the
// block's north side, its vehicle parked at the kerb out front: x, y = that parking spot (lane = the lane beside it).
// They're their own buildings, not the district's: STY 11 police (grey stone, 4-5 floors), 12 fire station (red
// brick, 2-3 floors, a hose tower at the back), 13 hospital (a white tower with a helipad, sh.pad = its middle).
const SERVICE_BUILD = { police: { sty: 11, h: 1.5 }, fire: { sty: 12, h: 1.05 }, amb: { sty: 13, h: 3.6 } };
const BASE_KINDS = { police: { word: 'POLICE', neon: BLUE, n: 4, title: 'Police station' },
                     fire: { word: 'FIRE DEPT', neon: RED, n: 3, title: 'Fire station' },
                     amb: { word: 'HOSPITAL', neon: WHITE, n: 3, title: 'Hospital' } };
const SERVICES = [];
{
  const cand = [];
  for (let by = SHORE_N + 2; by < SHORE_S - 1; by++) for (let bx = 0; bx < NB; bx++)
    if (!blockKind(bx, by) && hseg(bx, by) && by !== EL_ROW && SHOP[idx(bx * 8 + 3, by * 8 + 2)]) cand.push([hash(bx, by, 81), bx, by]);
  cand.sort((p, q) => p[0] - q[0]);
  const gap = (b, bx, by) => Math.hypot(relB(b.bx - bx), b.by - by);
  for (const kind in BASE_KINDS) {
    const K_ = BASE_KINDS[kind];
    for (const [, bx, by] of cand) {
      if (SERVICES.filter(b => b.kind === kind).length >= K_.n) break;
      if (SERVICES.some(b => gap(b, bx, by) < (b.kind === kind ? 8 : 3))) continue;
      const sh = SHOP[idx(bx * 8 + 3, by * 8 + 2)]; // the lot's shop, shared by all its cells (lanes included)
      const lot = [];
      for (let y = by * 8; y < by * 8 + 8; y++) for (let x = bx * 8; x < bx * 8 + 8; x++) if (SHOP[idx(x, y)] === sh) lot.push([x, y]);
      if (kind !== 'amb' && lot.length > 12) continue; // a whole block is too big for a police or fire station
      Object.assign(sh, { kind: SHOP_LIT, word: K_.word, neon: K_.neon, base: kind, hours: [0, 24] });
      const B_ = SERVICE_BUILD[kind];
      for (const [x, y] of lot) { map[idx(x, y)] = B_.h; STY[idx(x, y)] = B_.sty; }
      if (kind === 'fire') { // the hose tower, at the back corner of the lot
        const [tx, ty] = lot.reduce((b, c) => c[1] - c[0] * 0.1 > b[1] - b[0] * 0.1 ? c : b);
        map[idx(tx, ty)] = 2.1;
      }
      if (kind === 'amb') sh.pad = [lot.reduce((s, c) => s + c[0], 0) / lot.length + 0.5, lot.reduce((s, c) => s + c[1], 0) / lot.length + 0.5];
      SERVICES.push({ kind, bx, by, x: bx * 8 + 3.4, y: by * 8 + 1.74, lane: by * 8 + 1.4, out: false });
    }
  }
}

// ---- the aquarium: the south half of the block across the shore road from the Sunset Pier, one building, its
// front on the promenade (aquarium.js has the inside, and the fish in its windows)
const AQUARIUM = { bx: FAIR_BX, by: SHORE_S - 1, x0: FAIR_BX * 8 + 2, x1: FAIR_BX * 8 + 8, doorU: FAIR_BX * 8 + 5 };
{
  const sh = AQUARIUM.sh = { kind: SHOP_LIT, word: 'AQUARIUM', neon: CYAN, glyphs: 'o#=@', hours: hoursOf('AQUARIUM'), aqua: true };
  for (let y = 5; y <= 7; y++) for (let x = 2; x <= 7; x++) { const i = idx(AQUARIUM.bx * 8 + x, AQUARIUM.by * 8 + y); map[i] = 1.8; STY[i] = 2; SHOP[i] = sh; }
}

// ---- the casino: downtown, on the block just south of the plaza, its doors facing the plaza across the street (casino.js
// has its front and its inside)
const CASINO = { bx: 15, by: 15 };
{
  const sh = CASINO.sh = { kind: SHOP_NEON, word: 'CASINO', neon: YEL, glyphs: '7$o*', hours: hoursOf('CASINO'), casino: true };
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 7; x++) { const i = idx(CASINO.bx * 8 + x, CASINO.by * 8 + y); map[i] = 2.6; STY[i] = 20; SHOP[i] = sh; SEED[i] = 0.5; }
}

// the glass houses go up in the Gardens
for (const gh of GLASSHOUSES) {
  const sh = gh.sh = { kind: SHOP_LIT, word: gh.word, neon: GREEN, glyphs: '%*@', hours: [9, 19], fee: gh.fee, glass: gh.sty };
  for (let gy = gh.gy0; gy <= gh.gy1; gy++) for (let gx = gh.gx0; gx <= gh.gx1; gx++) {
    const i = idx(GARDEN.x0 + gx, GARDEN.y0 + gy), mid = gx > gh.gx0 && gx < gh.gx1 && gy > gh.gy0 && gy < gh.gy1;
    map[i] = mid || gh.gx1 - gh.gx0 === 2 && gx === gh.gx0 + 1 && gy === gh.gy0 + 1 ? gh.dome : gh.h; STY[i] = gh.sty; SHOP[i] = sh; SEED[i] = 0.5;
  }
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
