// ===== interiors (1 unit = 1m) =====
// Grid: '#' wall 3m, 'S' shelf island 2.2m, 'D' way out, 'E' elevator to the roof, '.' floor.
// Every room type reuses the same renderer; a type supplies its grid, lighting, floor/ceiling style, wall art and props.
function boxRoom(w, h, extra = {}, door = true) { // walls all round, double door in the middle of the near wall
  const rows_ = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) s += extra[x + ',' + y] ||
      (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? (door && y === h - 1 && (x === (w >> 1) - 1 || x === w >> 1) ? 'D' : '#') : '.');
    rows_.push(s);
  }
  return rows_;
}
// A subway station, 4.5m high. The platform (x 9..36, y 7..11) has the track (y 12..13) running on into a tunnel at
// either end and pillars down the middle. Behind its back wall (row 6) a 3m-wide stairwell (x 10..12) climbs away
// from the platform, set into the rock, up to the street (the 'D' at the top, row 0).
const STATION_W = 46, STATION_H = 4.5, STATION_STAIRS = { x0: 10, x1: 13, y0: 1, y1: 7, rise: 2.6 };
const ST_TRACK = 12; // the first track row; the platform edge is just before it
const STATION_GRID = Array.from({ length: 15 }, (_, y) => Array.from({ length: STATION_W }, (_, x) => {
  const well = x >= 10 && x <= 12;
  if (x === 0 || x === STATION_W - 1 || y === 14) return '#';
  if (y === 0) return well ? 'D' : '#';
  if (y <= 6) return well ? '.' : '#'; // the stairwell, through the back wall
  if (y >= ST_TRACK) return '.'; // the track, platform to tunnels
  return x >= 9 && x <= 36 ? ([13, 18, 23, 28, 33].includes(x) && y === 9 ? '#' : '.') : '#';
}).join(''));
// how high the stairs have lifted you at (x, y)
const stairRise = (x, y) => { const s = room && room.def.stairs; return s && x >= s.x0 && x < s.x1 && y < s.y1 ? s.rise * clamp((s.y1 - y) / (s.y1 - s.y0), 0, 1) : 0; };
// the steps themselves, as boxes, each a little higher toward the top; walkable (the stairs lift you, see stairRise)
const stairSteps = s => Array.from({ length: 10 }, (_, k) => {
  const dy = (s.y1 - s.y0) / 10, top = (k + 1) * s.rise / 10;
  return { ...BX((s.x0 + s.x1) / 2, s.y1 - (k + 0.5) * dy, (s.x1 - s.x0) / 2, dy / 2, 0, top, (i, t, L) => { // wall to wall
    // treads (yellow nosing at the front edge) and risers
    BG[i] = C(GRAY, (1 + L * 0.3) * shadeFace(HIT.face));
    if (HIT.face === 5) return set(i, HIT.v > dy / 2 - 0.06 ? '=' : ' ', C(YEL, L * 0.8)), true;
    return set(i, HIT.w > top - 0.03 ? '_' : ' ', C(GRAY, L * 0.6)), true; // a plain riser with a lip
  }, 1, 0), walk: true }; // long axis across the stairwell (x): wall to wall, dy deep
});
const MENUS = { RAMEN: 0, NOODLES: 0, PHO: 6, DUMPLINGS: 0, THAI: 7, SUSHI: 9, TACOS: 1, PIZZA: 2, CAFE: 3, COFFEE: 3, DONUTS: 3, KEBAB: 4, BURGERS: 5, CHICKEN: 8 };
const MENU_ITEMS = [['RAMEN 9', 'GYOZA 5', 'MISO 3', 'TEA 2'], ['TACO 3', 'BURRITO 7', 'NACHOS 5', 'SODA 2'],
                    ['SLICE 3', 'WHOLE 18', 'KNOTS 4', 'SODA 2'], ['LATTE 4', 'DONUT 2', 'BAGEL 3', 'TEA 2'],
                    ['KEBAB 8', 'FALAFEL 6', 'FRIES 3', 'AYRAN 2'], ['BURGER 6', 'FRIES 3', 'SHAKE 4', 'PIE 3'],
                    ['PHO 11', 'BANH MI 7', 'ROLLS 5', 'TEA 2'], ['PAD THAI 11', 'CURRY 12', 'MANGO 6', 'THAI TEA 4'],
                    ['CHICKEN 9', 'WINGS 7', 'FRIES 3', 'SODA 2'], ['NIGIRI 12', 'MAKI 8', 'MISO 3', 'TEA 2']];
const ROOM_FOR = { BAR: 'bar', KARAOKE: 'karaoke', DINER: 'diner', ARCADE: 'arcade', LAUNDRY: 'laundry',
                   CINEMA: 'cinema', HOTEL: 'hotel', MOTEL: 'hotel', GYM: 'gym', BARBER: 'barber', TATTOO: 'barber',
                   BANK: 'bank', 'PET SHOP': 'petshop', FLORIST: 'florist' };
const LYRICS = ['SWEET CAROLINE', 'BAH BAH BAH', 'SO GOOD SO GOOD SO GOOD', 'SWEET CAROLINE']; // what the karaoke bar's playing (audio/ascii-city/karaoke.mp3)
for (const w in MENUS) ROOM_FOR[w] = 'diner';
for (const w of ['CAFE', 'COFFEE', 'DONUTS', 'BAKERY', 'JUICE', 'ICE CREAM', 'BAGELS']) ROOM_FOR[w] = 'cafe';
for (const w of ['BOOKS', 'RECORDS']) ROOM_FOR[w] = 'books';
for (const w of ['RAMEN', 'NOODLES', 'PHO', 'DUMPLINGS', 'DIM SUM', 'SUSHI']) ROOM_FOR[w] = 'noodle';
for (const w of ['AUTO REPAIR', 'TIRES', 'WELDING']) ROOM_FOR[w] = 'garage';
for (const w of ['TEA HOUSE', 'MAHJONG']) ROOM_FOR[w] = 'tea';
ROOM_FOR.HOSPITAL = 'hospital';
ROOM_FOR.CARS = 'showroom'; ROOM_FOR.REALTY = 'realty';
ROOM_FOR.STORAGE = 'storage';

// a room's bathroom (def.wc): its own little room off the floor, 'W' walls round it with a doorway, white tiles inside.
// sign: the wall cell the WC sign goes on (mx, my) and where along it
const inWc = (x, y, w = room && room.def.wc) => !!w && x >= w.x0 && x < w.x1 && y >= w.y0 && y < w.y1;
const roomAt = (x, y) => x < 0 || y < 0 || x >= room.W || y >= room.H ? '#' : room.grid[y][x];
// props
const SP = (x, y, w, h, art, col, z = 0) => ({ x, y, w, h, art, col, z });
const standing = (x, y, shirt) => SP(x, y, 0.55, 1.75, ART.keeper, (c, row, L) => C(row < 3 ? SKIN : row < 6 ? shirt : GRAY, L));
const sitting = (x, y, shirt, z = 0.45, back = false) =>
  SP(x, y, 0.55, 1.2, back ? ART.sitterBack : ART.sitter, (c, row, L) => C(row < 3 ? (back && row ? BRICK : SKIN) : shirt, L), z);
const wood = (c, row, L) => C(c === '$' ? GREEN : BRICK, L);
const shirt = () => pick([RED, BLUE, GREEN, MAG, ORANGE, WHITE, YEL, CYAN]);
const chance = p => Math.random() < p;
// how full the bars are: near empty in the afternoon, packed late at night
const barCrowd = () => { const h = mod(tod - 16, 24); return h < 12 ? 0.15 + 0.8 * Math.min(1, h / 7) : 0.1; };

// ---- furniture as real boxes (see drawBox), in metres. BX(x, y, half length, half width, z0, z1, shade, cos, sin):
// the long side runs along (cos, sin). Benches are their own kind ({ bench }), drawn by drawBench.
const BX = (x, y, hl, hw, z0, z1, shade, ca = 1, sa = 0) => ({ box: { x, y, c: ca, s: sa, hl, hw, z0, z1 }, shade });
const BENCHP = (x, y, fx, fy) => ({ bench: true, x, y, fx, fy });
// a solid shade: base colour, panel lines every `panel` metres on the sides, a trim at the top, `top` char on top
const solid = (base, { panel = 0, top = ' ', trim = 0, bright = 1 } = {}) => (i, t, L) => {
  const f = HIT.face;
  BG[i] = C(base, (1 + L * 0.35 * bright) * shadeFace(f));
  if (f === 5) return set(i, top, C(base, L * 0.9)), true;
  if (trim && HIT.w > trim) return set(i, '=', C(base, L)), true;
  const along = f <= 2 ? HIT.v : HIT.u;
  return set(i, panel && Math.abs(fract(along / panel) - 0.5) < 0.06 ? '|' : ' ', C(base, L * 0.6)), true;
};
const counterBox = (x, y, half, z1 = 1.05) => [BX(x, y, half, 0.3, 0, z1, solid(BRICK, { panel: 0.6, trim: z1 - 0.06, top: '=' })),
  BX(x - half * 0.6, y, 0.18, 0.15, z1, z1 + 0.25, (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.2); return set(i, HIT.face === 1 || HIT.face === 4 ? '$' : '#', C(GREEN, L)), true; })]; // and the till
// a wire laundry cart on castors, heaped with somebody's washing (each garment its own colour, and it stays that colour:
// the old sprite picked a new one every frame, so the heap strobed)
const laundryCart = (x, y) => {
  const seed = Math.random() * 100;
  return [BX(x, y, 0.36, 0.26, 0.12, 0.7, (i, t, L) => { // the wire basket: see-through between the wires
    const f = HIT.face, a_ = f <= 2 ? HIT.v : HIT.u;
    if (f === 5 || f === 6) return false;
    if (HIT.w > 0.66 || HIT.w < 0.16 || Math.abs(fract(a_ * 8) - 0.5) > 0.4) return set(i, HIT.w > 0.66 ? '=' : '|', C(GRAY, L * 1.1)), true;
    return Math.abs(fract(HIT.w * 10) - 0.5) > 0.42 ? (set(i, '-', C(GRAY, L * 0.8)), true) : false;
  }), BX(x, y, 0.33, 0.23, 0.14, 0.78, (i, t, L) => { // the washing, piled up above the rim
    if (HIT.face === 6) return false;
    const k = hash(Math.floor((HIT.u + HIT.v) * 6), Math.floor(HIT.w * 9 + (HIT.u - HIT.v) * 3), Math.floor(seed));
    if (HIT.w > 0.72 && hash(Math.floor(HIT.u * 9), Math.floor(HIT.v * 9), 7) > 0.6) return false; // a lumpy top
    BG[i] = C(ITEM_COL[k * 8 | 0], (1.2 + L * 0.3) * shadeFace(HIT.face)); return set(i, k > 0.85 ? '~' : ' ', C(WHITE, L * 0.6)), true;
  }), ...[-1, 1].flatMap(sx => [-1, 1].map(sy => BX(x + sx * 0.3, y + sy * 0.2, 0.03, 0.03, 0, 0.12, (i, t, L) => (set(i, 'o', C(GRAY, L)), true))))];
};
const tableBox = (x, y, hl = 0.6, hw = 0.4) => [BX(x, y, hl, hw, 0.72, 0.78, solid(BRICK, { top: '=' })), BX(x, y, 0.06, 0.06, 0, 0.72, solid(GRAY))];
const inBox = (b, x, y, pad) => { const qx = x - b.x, qy = y - b.y; return Math.abs(qx * b.c + qy * b.s) < b.hl + pad && Math.abs(-qx * b.s + qy * b.c) < b.hw + pad; };


// ---- new interiors' walls
function hotelRoomWall(i, u, uStep, z, d, mx, my, L) { // a window onto the city, its sky following the time of day
  if (my !== 0 || Math.abs(u - room.W / 2) > 1.6 || z < 0.9 || z > 2.3) return false;
  const du = u - room.W / 2;
  if (Math.abs(du) > 1.45 || z < 0.97 || z > 2.23 || Math.abs(du) < 0.04) { set(i, Math.abs(du) > 1.45 ? '|' : '=', C(GRAY, L)); BG[i] = C(WARM, 2); return true; } // frame
  viewOut(i, u, z, 14, 18); return true; // six floors up, across the avenue
}
function storageWall(i, u, uStep, z, d, mx, my, L) { // roll-up locker doors, a bay every 1.2m, numbered
  if (z > 2.45) { set(i, (Math.floor(u * 4) + Math.floor(z * 4)) % 6 ? ' ' : '.', C(GRAY, L * 0.4)); return true; }
  const bay = fract(u / 1.2);
  if (bay < 0.05 || bay > 0.95 || z < 0.05) { set(i, '|', C(GRAY, L)); BG[i] = C(GRAY, 1); return true; }
  if (z > 2.1) { // the unit number plate
    const n = String(100 + (hash(Math.floor(u / 1.2), mx * 31 + my, 5) * 800 | 0));
    if (wallText(i, u, uStep, z, d, n, Math.floor(u / 1.2) * 1.2 + 0.6, 2.25, 0.12, 0.18, C(WHITE, 13), C(GRAY, 2))) return true;
    set(i, ' ', 0); BG[i] = C(GRAY, 2); return true;
  }
  BG[i] = C(ORANGE, 2 + L * 0.15);
  set(i, z < 0.18 && Math.abs(bay - 0.5) < 0.08 ? '_' : fract(z * 12) < 0.5 ? '=' : '-', C(ORANGE, L * 0.9)); return true;
}
function cafeWall(i, u, uStep, z, d, mx, my, L) { // a chalkboard menu behind the counter, warm brick elsewhere
  if (my === 0 && Math.abs(u - room.W / 2) < 2 && z > 1.4 && z < 2.5) {
    BG[i] = C(GRAY, 1);
    for (const [k, item] of ['ESPRESSO 3', 'LATTE 4', 'CROISSANT 3', 'COOKIE 2'].entries())
      if (wallText(i, u, uStep, z, d, item, room.W / 2, 2.3 - k * 0.25, 0.15, 0.2, C(WHITE, 13), C(GRAY, 1))) return true;
    set(i, ' ', 0); return true;
  }
  if (z < 2.6) { set(i, fract(u * 4 + (Math.floor(z * 8) & 1) * 0.5) < 0.12 ? '|' : '_', C(BRICK, L * 0.7)); BG[i] = C(BRICK, 1); return true; }
  return false;
}
function booksWall(i, u, uStep, z, d, mx, my, L) { // floor-to-ceiling shelves of coloured spines (records: sleeves)
  if (z > 2.6 || (my === room.H - 1)) return false;
  if (fract(z / 0.42) < 0.12) { set(i, '=', C(BRICK, L)); return true; }
  const k = hash(Math.floor(u * 14), Math.floor(z / 0.42), mx * 7 + my), rec = room.word === 'RECORDS';
  set(i, rec ? (fract(u * 3) < 0.1 ? '|' : 'O') : k > 0.15 ? '|' : ' ', C(ITEM_COL[k * 80 & 7], L * (rec ? 0.8 : 1))); BG[i] = C(BRICK, 1); return true;
}
function noodleWall(i, u, uStep, z, d, mx, my, L) { // the open kitchen: steam rising off the pots, red walls hung with signs
  if (my === 0 && z < 2.4) {
    if (z < 1.0) { set(i, fract(u * 2) < 0.1 ? '|' : '#', C(GRAY, L * 0.6)); return true; }
    if (z < 1.2) { set(i, Math.abs(fract(u / 1.5) - 0.5) < 0.2 ? 'U' : '_', C(GRAY, L)); return true; } // pots on the range
    const s = noise(u * 3, z * 4 - T * 1.5, 41);
    set(i, s > 0.62 && z < 2 ? '~' : ' ', C(WHITE, 6 + s * 6)); BG[i] = C(RED, 1); return true;
  }
  if (z > 1.4 && z < 2.2 && fract(u / 2) < 0.3) { // hanging signs
    BG[i] = C(RED, 3); set(i, fract(z * 6) < 0.3 ? '-' : ' ', C(YEL, 12)); return true;
  }
  set(i, ' ', 0); BG[i] = C(RED, 1 + L * 0.08); return true;
}
function garageWall(i, u, uStep, z, d, mx, my, L) { // pegboard of tools, roll-up door at the back
  if (my === 0 && z < 2.7 && Math.abs(u - room.W / 2) < 3) { set(i, fract(z * 16) < 0.5 ? '=' : '-', C(GRAY, L * 0.7)); return true; }
  if (z > 0.9 && z < 2.1) {
    const k = hash(Math.floor(u * 3), Math.floor(z * 3), 77);
    set(i, k > 0.7 ? 'T7/F'[k * 40 & 3] : (Math.floor(u * 8) + Math.floor(z * 8)) & 1 ? '.' : ' ', C(k > 0.7 ? RED : BRICK, L)); BG[i] = C(BRICK, 1); return true;
  }
  set(i, (Math.floor(u * 4) + Math.floor(z * 4)) % 5 ? ' ' : '.', C(GRAY, L * 0.5)); return true;
}
function teaWall(i, u, uStep, z, d, mx, my, L) { // red and gold, with long hanging scrolls
  if (z > 0.8 && z < 2.4 && Math.abs(fract(u / 2.5) - 0.5) < 0.12) {
    BG[i] = C(WHITE, 3); set(i, Math.abs(fract(u / 2.5) - 0.5) < 0.04 && fract(z * 5) < 0.5 ? '#' : ' ', C(GRAY, 2)); return true;
  }
  if (Math.abs(z - 2.5) < 0.05) { set(i, '=', C(YEL, Math.max(L, 10))); return true; }
  set(i, ' ', 0); BG[i] = C(RED, 1 + L * 0.1); return true;
}
// a few more room kinds' worth of props
const cabinet = (x, y, k, body) => BX(x, y, 0.35, 0.4, 0, 1.8, (i, t, L) => { // an arcade machine, screen on the front
  const f = HIT.face, w = HIT.w;
  BG[i] = C(body, (1 + L * 0.3) * shadeFace(f));
  if (f === 1 && w > 1.05 && w < 1.5 && Math.abs(HIT.v) < 0.27) { BG[i] = C(NEON[k], 2); return set(i, '*@#+o~%'[hash(Math.floor(HIT.v * 12), Math.floor(w * 10), (T * 6 | 0) + k) * 7 | 0], C(NEON[(k + 1) & 3], 15)), true; }
  if (f === 1 && w > 1.6) return set(i, '=', C(NEON[k], 15)), true; // the marquee
  if (f === 1 && w > 0.85 && w < 0.98) return set(i, 'o', C(RED, 13)), true; // buttons
  return set(i, ' ', 0), true;
}, 0, 1);


const ROOM_DEFS = {
  store: { grid: ['##########', '#........#', '#.SS..SS.#', '#........#', '#.SS..SS.#', '#........#', '#........#', '####DD####'],
    light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, posters: true, keeper: [5, 1.05],
    props: r => [...counterBox(5, 1.7, 1.6), standing(5, 1.05, r.neon)] },
  bar: { grid: boxRoom(12, 8, { '1,4': 'W', '3,4': 'W', '3,5': 'W', '3,6': 'W' }), wc: { x0: 1, y0: 5, x1: 3, y1: 7, sign: [1, 4, 1.5] }, light: 0.6, floor: 'wood', ceil: 'pendant', shelves: true, sign: true, neon: true, glyphs: 'il!Y', keeper: [6, 1.1],
    props: r => {
      const p = [...counterBox(6, 1.8, 4, 1.1), standing(6, 1.1, r.neon),
                 SP(10.6, 5.5, 0.9, 1.5, ART.jukebox, (c, row, L) => C(NEON[(row + (T * 2 | 0)) & 3], 14)), ...toilet(1.6, 6.4, 1, porcelain)];
      for (let x = 3; x <= 9; x += 1.5) { p.push(SP(x, 2.65, 0.4, 0.75, ART.stool, wood)); if (chance(barCrowd())) p.push(sitting(x, 2.7, shirt(), 0.45, true)); }
      return p;
    } },
  diner: { grid: boxRoom(12, 8, { '1,3': 'W', '2,3': 'W', '3,3': 'W', '3,1': 'W' }), wc: { x0: 1, y0: 1, x1: 3, y1: 3, sign: [3, 1, 1.5] }, light: 1, floor: 'tile', ceil: 'strip', sign: false, keeper: [6, 1.1], wall: dinerWall,
    props: r => {
      const p = [...counterBox(6, 1.75, 2), standing(6, 1.1, WHITE), ...toilet(1.6, 1.4, -1, porcelain)];
      for (const [x, y] of [[2.6, 4.2], [9.4, 4.2], [2.6, 6.2], [9.4, 6.2]]) {
        p.push(...tableBox(x, y));
        for (const s of [-0.95, 0.95]) { p.push(SP(x + s, y, 0.4, 0.75, ART.stool, wood)); if (chance(0.4)) p.push(sitting(x + s, y - 0.02, shirt())); }
      }
      return p;
    } },
  // the arcade: two rows of cabinets (each plays one of ARCADE_GAMES, see minigame-ui.js), and a prize counter by
  // the door where the clerk swaps tickets for prizes. Somebody's playing some of the machines.
  arcade: { grid: boxRoom(12, 9), light: 0.5, floor: 'carpet', ceil: 'dark', sign: true, wall: arcadeWall, keeper: [10.2, 6.15],
    props: r => {
      const p = [...counterBox(10.2, 6.8, 0.85), standing(10.2, 6.15, MAG)];
      let n = 0;
      for (const [xs, y] of [[[2, 3.5, 5, 6.5, 8, 9.5], 2.2], [[2.2, 3.7, 8.3, 9.8], 5.2]]) for (const x of xs) { // an aisle in from the door
        const k = n % 4, body = [MAG, BLUE, RED, GREEN][(n * 3 + 1) % 4], busy = chance(0.3);
        p.push({ ...cabinet(x, y, k, body), game: ARCADE_GAMES[n++ % ARCADE_GAMES.length], cx: x, cy: y, busy });
        if (busy) p.push(standing(x, y + 0.7, shirt()));
      }
      return p;
    } },
  laundry: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', sign: true, wall: laundryWall,
    props: r => [BENCHP(2.8, 3.6, 0, -1), ...laundryCart(7.6, 4.6),
      BX(6.2, 3.3, 0.9, 0.35, 0, 0.85, solid(WHITE, { top: '_', panel: 0.4 })), // the folding table
      ...(tod > 7 && tod < 23 || chance(0.3) ? [sitting(2.8, 3.58, shirt(), 0.45)] : [])] }, // (somebody waiting on a load, mostly in the day)
  cinema: { grid: boxRoom(14, 12), light: 0.3, floor: 'carpet', ceil: 'dark', wall: cinemaWall,
    props: r => {
      const p = [];
      for (const y of [5, 6.5, 8, 9.5]) for (const cx of [4.2, 9.8]) { // two blocks of seats, an aisle up the middle from the door
        p.push({ ...BX(cx, y, 1.75, 0.25, 0, 0.45, solid(RED, { top: "=", bright: 2 })), seatRow: { x0: cx - 1.5, x1: cx + 1.5, y, fx: 0, fy: -1 } }, BX(cx, y + 0.3, 1.75, 0.06, 0.45, 1.0, solid(RED, { panel: 0.6, bright: 2 })));
        if (chance(0.7)) p.push(sitting(cx - 1.4 + Math.random() * 2.8, y + 0.05, shirt(), 0.35, true));
      }
      return p;
    } },
  hotel: { grid: boxRoom(12, 8, { '5,0': 'E', '6,0': 'E' }), light: 0.9, floor: 'wood', ceil: 'pendant', sign: true, signAt: 2.6, wall: hotelWall,
    keeper: [3.2, 2.0], ex: 6,
    props: r => [BX(3.2, 2.6, 1.3, 0.35, 0, 1.1, solid(BRICK, { panel: 0.5, trim: 1.04, top: '=' })), standing(3.2, 2.0, r.neon), SP(1.4, 1.4, 0.7, 1.3, ART.plant, plantCol),
                 SP(10.6, 1.4, 0.7, 1.3, ART.plant, plantCol), SP(10.6, 6, 0.7, 1.3, ART.plant, plantCol), standing(8, 4, shirt())] },
  apts: { grid: boxRoom(8, 7, { '3,0': 'E', '4,0': 'E' }), light: 0.7, floor: 'tile', ceil: 'pendant', wall: aptsWall, ex: 4,
    props: r => [SP(6.6, 5.4, 0.7, 1.3, ART.plant, plantCol), ...(chance(0.6) ? [standing(2.2, 4.4, shirt())] : [])] },
  gym: { grid: boxRoom(12, 9), light: 1, floor: 'rubber', ceil: 'strip', sign: true, wall: gymWall,
    props: r => {
      const p = [SP(3, 6.5, 1.8, 1, ART.rack, (c, row, L) => C(c === 'O' ? GRAY : BRICK, L * 1.3)), SP(9, 6.5, 1.8, 1, ART.rack, (c, row, L) => C(c === 'O' ? GRAY : BRICK, L * 1.3))];
      for (const x of [2.5, 5, 7.5, 9.5]) {
        p.push(SP(x, 2.6, 0.9, 1.3, ART.treadmill, (c, row, L) => C(GRAY, L * 1.2)));
        if (chance(0.7)) { const k = Math.random() * 2, s = shirt(); // running in place
          p.push(SP(x, 2.55, 0.5, 1.75, () => (T * 7 + k | 0) % 2 ? ART.walkA : ART.walkB, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? s : GRAY, L), 0.2)); }
      }
      return p;
    } },
  barber: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', sign: true, wall: barberWall, keeper: [3.6, 1.9],
    props: r => {
      const p = [standing(3.6, 1.9, WHITE),
                 SP(1.2, 5.5, 0.25, 1.6, ART.barberPole, (c, row, L) => c === '/' ? C([RED, WHITE, BLUE][(row + (T * 3 | 0)) % 3], 14) : C(GRAY, L))];
      for (const x of [2.5, 5, 7.5]) {
        p.push(SP(x, 1.8, 0.7, 1.2, ART.barberChair, (c, row, L) => C(row < 3 ? RED : GRAY, L)));
        if (chance(0.6)) p.push(sitting(x, 1.85, shirt(), 0.45, true));
      }
      return p;
    } },
  // the hospital's emergency waiting room: a triage desk with a nurse, rows of seats with people waiting, two
  // curtained bays with beds along the right-hand wall, EMERGENCY over everything. (The nurse is where healing would
  // go, if you could get hurt.)
  hospital: { grid: boxRoom(14, 10), light: 1, floor: 'tile', ceil: 'strip', wall: hospitalWall, keeper: [6, 1.9],
    props: r => {
      const p = [...counterBox(6, 2.6, 2, 1.1), standing(6, 1.9, CYAN), standing(4.7, 1.6, WHITE)]; // the nurse, a doctor behind
      for (const [x, y] of [[3, 5.6], [8.4, 5.6], [3, 7.2], [8.4, 7.2]]) { // the waiting room seats, facing the desk
        p.push(BENCHP(x, y, 0, -1));
        if (chance(0.55)) p.push(sitting(x - 0.4, y + 0.02, shirt()));
        if (chance(0.4)) p.push(sitting(x + 0.45, y + 0.02, shirt()));
      }
      for (const y of [2.2, 4.4]) { // the bays: a bed with white sheets and a pillow, a curtain either side
        p.push(BX(11.6, y, 0.95, 0.42, 0.45, 0.62, (i, t, L) => { const f = HIT.face; BG[i] = C(WHITE, (2 + L * 0.3) * shadeFace(f));
          return set(i, f === 5 ? (HIT.u > 0.6 ? '@' : '~') : f === 1 || f === 2 ? '#' : '_', C(f === 5 ? WHITE : GRAY, L)), true; }));
        p.push(BX(11.6, y, 0.85, 0.32, 0, 0.45, solid(GRAY, { panel: 0.4 })));
        for (const cy of [y - 0.95, y + 0.95]) p.push(BX(12.35, cy, 0.5, 0.02, 0.2, 1.95, (i, t, L) => { // a curtain, drawn back to the wall
          BG[i] = C(CYAN, 1.5 + L * 0.12); return set(i, HIT.w > 1.86 ? 'o' : fract(HIT.u * 5) < 0.5 ? '|' : ' ', C(CYAN, L * 0.7)), true; }));
      }
      if (chance(0.6)) p.push(sitting(11.3, 4.4, shirt(), 0.62)); // someone waiting to be seen
      p.push(BX(1.5, 8.4, 0.3, 0.3, 0, 1.4, solid(BLUE, { top: 'o', trim: 1.35 }))); // a water cooler by the door
      return p;
    } },
  bank: { grid: boxRoom(14, 9), light: 1, floor: 'marble', ceil: 'pendant', sign: true, wall: bankWall, keeper: [7, 1.5],
    props: r => [BX(7, 2.4, 4.5, 0.35, 0, 1.1, solid(WHITE, { panel: 1.5, trim: 1.04, top: '=' })),
                 BX(7, 2.3, 4.5, 0.03, 1.1, 1.95, (i, t, L) => { BG[i] = C(CYAN, 1); return set(i, Math.abs(fract(HIT.u / 1.5) - 0.5) > 0.47 ? '|' : ' ', C(GRAY, L)), true; }), // the glass
                 standing(3.5, 1.5, BLUE), standing(7, 1.5, BLUE), standing(10.5, 1.5, BLUE), standing(12.3, 6, GRAY)] },
  karaoke: { grid: boxRoom(12, 9), light: 0.45, floor: 'carpet', ceil: 'disco', wall: karaokeWall,
    props: r => {
      const p = [BX(6, 2.3, 2, 0.6, 0, 0.3, solid(BRICK, { top: '=', bright: 2 })),
                 SP(6, 2.25, 0.6, 1.75, ART.singer, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? r.neon : GRAY, 14), 0.3),
                 SP(3.5, 2.3, 0.6, 0.9, ART.speaker, (c, row, L) => C(GRAY, L * 2)), SP(8.5, 2.3, 0.6, 0.9, ART.speaker, (c, row, L) => C(GRAY, L * 2))];
      for (let k = 0; k < 6; k++) if (chance(barCrowd())) p.push(sitting(2.5 + Math.random() * 7, 4.5 + Math.random() * 2.5, shirt(), 0.35, true));
      return p;
    } },
  petshop: { grid: boxRoom(10, 8), light: 0.8, floor: 'tile', ceil: 'strip', sign: true, wall: petWall, keeper: [5, 1.05],
    props: r => [...counterBox(5, 1.7, 1.6), standing(5, 1.05, r.neon),
                 SP(2.2, 4, 0.8, 0.8, ART.cage, (c, row, L) => C(c === 'o' ? YEL : GRAY, L)), SP(7.8, 4, 0.8, 0.8, ART.cage, (c, row, L) => C(c === 'o' ? YEL : GRAY, L)),
                 SP(4.2, 5.3, 0.6, 0.6, ART.dog, (c, row, L) => C(BRICK, L * 1.3))] },
  florist: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, glyphs: '*@&%', wall: floristWall, keeper: [5, 1.05],
    props: r => {
      const p = [...counterBox(5, 1.7, 1.6), standing(5, 1.05, r.neon)];
      for (let k = 0; k < 7; k++) {
        const x = 1.5 + Math.random() * 7, y = 2.8 + Math.random() * 2.6, bloom = ITEM_COL[k & 7];
        p.push(chance(0.5) ? SP(x, y, 0.7, 1.3, ART.plant, plantCol) : SP(x, y, 0.6, 0.8, ART.bouquet, (c, row, L) => C(row === 0 ? bloom : row === 1 ? GREEN : BRICK, L * 1.3)));
      }
      return p;
    } },
  station: { grid: STATION_GRID, light: 1, floor: 'station', ceil: 'strip', wall: stationWall, block: (x, y) => y > ST_TRACK - 0.8, stairs: STATION_STAIRS, height: STATION_H,
    props: r => {
      const p = [...stairSteps(STATION_STAIRS)];
      for (const x of [15.5, 20.5, 25.5, 30.5]) p.push(BENCHP(x, 7.5, 0, 1)); // against the back wall
      for (let k = 0; k < 4; k++) p.push(standing(14 + Math.random() * 20, 9 + Math.random() * 1.6, shirt()));
      return p;
    } },
  train: { grid: boxRoom(22, 5, {}, false), light: 1, floor: 'train', ceil: 'strip', wall: trainWall,
    props: r => {
      const p = [];
      for (const x of [3, 8, 13, 18]) for (const y of [1.3, 3.7]) {
        p.push({ ...BX(x, y, 1.8, 0.25, 0, 0.45, solid(BLUE, { top: '=' })), seatRow: { x0: x - 1.55, x1: x + 1.55, y, fx: 0, fy: y < 2 ? 1 : -1 } }, BX(x, y < 2 ? y - 0.28 : y + 0.28, 1.8, 0.05, 0.45, 0.95, solid(BLUE, { panel: 0.9 })));
        if (chance(0.35)) p.push(sitting(x - 1 + Math.random() * 2, y + (y < 2 ? 0.03 : -0.03), shirt(), 0.3));
      }
      for (const x of [5.5, 10.5, 15.5]) p.push(SP(x, 2.5, 0.1, 3, ART.pole, (c, row, L) => C(WHITE, L)));
      return p;
    } },
  cafe: { grid: boxRoom(10, 8), light: 0.9, floor: 'wood', ceil: 'pendant', sign: false, wall: cafeWall, keeper: [5, 1.05],
    props: r => {
      const p = [...counterBox(4.6, 1.7, 1.4), standing(4.6, 1.05, r.neon),
        BX(3.7, 1.65, 0.28, 0.2, 1.05, 1.5, solid(GRAY, { top: 'o', trim: 1.42 })), // the espresso machine
        BX(7.2, 1.7, 0.7, 0.3, 0, 1.05, (i, t, L) => { // the pastry case
          const f = HIT.face; BG[i] = f === 5 ? C(GRAY, 2) : C(CYAN, 1 + L * 0.1);
          if ((f === 4 || f === 3) && HIT.w > 0.3 && HIT.w < 0.95) return set(i, fract(HIT.w * 4) < 0.4 ? '@o*o'[hash(Math.floor(HIT.u * 8), Math.floor(HIT.w * 4), 9) * 4 | 0] : '_', C(fract(HIT.w * 4) < 0.4 ? ORANGE : GRAY, 13)), true;
          return set(i, f === 5 ? '=' : ' ', C(GRAY, L)), true;
        })];
      for (const [x, y] of [[2.2, 4.4], [5, 3.4], [7.8, 4.4], [2.2, 6.4], [7.8, 6.4]]) { // a clear way in down the middle
        p.push(...tableBox(x, y, 0.4, 0.4));
        if (chance(0.55)) p.push(sitting(x + 0.6, y + 0.02, shirt()));
        if (chance(0.3)) p.push(sitting(x - 0.6, y + 0.02, shirt()));
      }
      return p;
    } },
  books: { grid: ['##########', '#........#', '#.SS..SS.#', '#.SS..SS.#', '#........#', '#........#', '####DD####'],
    light: 0.8, floor: 'wood', ceil: 'pendant', shelves: true, sign: true, glyphs: '|]|[', wall: booksWall, keeper: [7.8, 4.6],
    props: r => [...counterBox(7.8, 5.1, 0.9), standing(7.8, 4.6, r.neon),
      BX(2.2, 5, 0.4, 0.4, 0, 0.45, solid(RED, { top: '=' })), BX(2.2, 4.62, 0.4, 0.06, 0.45, 1.0, solid(RED)), // a reading chair
      ...(chance(0.5) ? [standing(4.5, 4.3, shirt())] : [])] },
  noodle: { grid: boxRoom(12, 7), light: 0.75, floor: 'tile', ceil: 'lantern', sign: true, wall: noodleWall, keeper: [6, 1.0],
    props: r => {
      const p = [BX(6, 2.0, 4.6, 0.3, 0, 1.0, solid(BRICK, { panel: 0.75, trim: 0.95, top: '=' })), standing(6, 1.0, WHITE), standing(3.5, 1.0, WHITE)];
      for (let x = 2; x <= 10; x += 1.35) { p.push(SP(x, 2.65, 0.4, 0.75, ART.stool, wood)); if (chance(0.5)) p.push(sitting(x, 2.7, shirt(), 0.45, true)); }
      return p;
    } },
  garage: { grid: boxRoom(14, 10), light: 0.85, floor: 'concrete', ceil: 'strip', sign: true, wall: garageWall, keeper: [6.5, 6.4],
    props: r => [
      BX(4.3, 4, 0.15, 0.15, 0, 1.25, solid(YEL)), BX(8.7, 4, 0.15, 0.15, 0, 1.25, solid(YEL)), // the lift's posts
      BX(6.5, 4, 2.1, 0.9, 1.25, 1.9, solid(r.neon === RED ? BLUE : RED, { panel: 1.4 })), // a car up on it
      BX(6.3, 4, 1.1, 0.8, 1.9, 2.4, (i, t, L) => { BG[i] = HIT.face === 5 ? C(GRAY, 3) : C(CYAN, 1 + L * 0.1); return set(i, ' ', 0), true; }),
      BX(11.8, 2.2, 0.35, 0.35, 0, 1.2, (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, 'O', C(GRAY, L * 0.8)), true; }), // stacked tyres
      BX(2.2, 8.2, 1.2, 0.35, 0, 0.9, solid(GRAY, { top: '=', panel: 0.6 })), // the workbench
      standing(6.5, 6.4, BLUE)] },
  tea: { grid: boxRoom(12, 9), light: 0.7, floor: 'wood', ceil: 'lantern', sign: true, wall: teaWall, keeper: [6, 1.1],
    props: r => {
      const p = [...counterBox(6, 1.7, 1.4), standing(6, 1.1, RED)];
      for (const [x, y] of [[3, 4], [9, 4], [3, 6.8], [9, 6.8]]) {
        p.push({ mj: true, cx: x, cy: y, ...BX(x, y, 0.45, 0.45, 0.7, 0.76, (i, t, L) => { // a mahjong table: green felt, tiles on top
          const f = HIT.face; BG[i] = f === 5 ? C(GREEN, 2) : C(BRICK, 1 + L * 0.2);
          return set(i, f === 5 && Math.abs(Math.abs(HIT.u) - 0.32) < 0.06 || f === 5 && Math.abs(Math.abs(HIT.v) - 0.32) < 0.06 ? '#' : ' ', C(WHITE, 13)), true;
        }) }, BX(x, y, 0.08, 0.08, 0, 0.7, solid(BRICK)));
        for (const [ox, oy] of [[-0.75, 0], [0.75, 0], [0, 0.75], [0, -0.75]]) if (chance(0.6)) p.push(sitting(x + ox, y + oy, shirt(), 0.45, oy < 0));
      }
      return p;
    } },
  // self storage: corridors of orange roll-up doors ('L', 2.6m locker blocks), an attendant by the door
  storage: { grid: ['##############', '#............#', '#.LL.LL.LL.L.#', '#.LL.LL.LL.L.#', '#............#', '#.LL.LL.LL.L.#',
                    '#.LL.LL.LL.L.#', '#............#', '#............#', '######DD######'],
    light: 0.85, floor: 'concrete', ceil: 'strip', sign: true, wall: storageWall, keeper: [11.5, 7.15],
    props: r => [BX(11.5, 7.75, 1.1, 0.3, 0, 1.05, solid(GRAY, { panel: 0.5, trim: 0.99, top: '=' })), standing(11.5, 7.15, ORANGE)] },
  // the cell block (jail.js): your cell in a row of three, real bars across its front, a corridor with a guard
  // pacing it, three more cells across the way. You only ever stand in yours (the guard lets you out)
  jail: { grid: JAIL_GRID, light: 0.95, floor: 'jail', ceil: 'jail', wall: jailWall, block: jailBlock, props: jailProps },
  // the lighthouse: whitewashed stone, little deep-set windows on the sea, the keeper at his desk, and a spiral
  // staircase winding up through the middle to the lamp room
  lighthouse: { grid: boxRoom(8, 8), light: 0.55, floor: 'concrete', ceil: 'dark', wall: lighthouseWall, keeper: [6.2, 2.2],
    props: r => [
      BX(6.2, 1.5, 0.8, 0.35, 0, 0.8, solid(BRICK, { panel: 0.5, top: '=' })), // the desk, the logbook open on it
      BX(6.0, 1.45, 0.22, 0.15, 0.8, 0.84, (i, t, L) => { BG[i] = C(WHITE, 3 + L * 0.2); return set(i, HIT.face === 5 ? '~' : '-', C(GRAY, L * 0.7)), true; }),
      standing(6.2, 2.2, BLUE),
      BX(4, 3.6, 0.09, 0.09, 0, 2.6, solid(GRAY, { panel: 0.3 })), // the newel post
      ...Array.from({ length: 12 }, (_, k) => { // the steps, a quarter turn every three
        const th = k / 12 * Math.PI * 2, c = Math.cos(th), s_ = Math.sin(th);
        return BX(4 + c * 0.55, 3.6 + s_ * 0.55, 0.45, 0.16, k * 0.2, k * 0.2 + 0.06, solid(GRAY, { top: '=' }), c, s_);
      }),
      SP(1.4, 1.4, 0.6, 0.5, ['  ___ ', ' (@@@)', '(@@@@@)'], (c, row, L) => C(WARM, L)), // a coil of rope
    ] },
  // the lamp room: glass all round, the sea and the sky outside, the great lens turning in the middle
  // inside a portapotty on a building site: blue plastic, a vent of daylight, a steel bowl, somebody's number
  potty: { grid: boxRoom(4, 4), light: 0.55, floor: 'rubber', ceil: 'dark', wall: pottyWall, height: 2.3,
    props: r => [...toilet(2, 1.45, -1),
      BX(2.85, 1.6, 0.07, 0.07, 0.75, 0.9, (i, t, L) => { BG[i] = C(WHITE, 3 + L * 0.3); return set(i, HIT.face === 5 ? '@' : ')', C(GRAY, L)), true; })] }, // the paper (one sad roll)
  lamproom: { grid: boxRoom(6, 6, {}, false), light: 0.45, floor: 'concrete', ceil: 'dark', wall: lampRoomWall,
    props: r => [
      BX(3, 3, 0.35, 0.35, 0, 0.9, solid(GRAY, { panel: 0.4, top: '=' })), // the pedestal
      BX(3, 3, 0.5, 0.5, 0.9, 1.9, (i, t, L) => { // the lens: rings of glass, blazing on the side the beam's on
        const f = HIT.face, side = f === 1 ? 0 : f === 2 ? Math.PI : f === 3 ? -Math.PI / 2 : Math.PI / 2;
        const on = beamLit() ? Math.max(0, Math.cos(beamAng() - side)) ** 3 : 0;
        BG[i] = C(YEL, 3 + on * 12);
        return set(i, f >= 5 ? '@' : Math.abs(fract(HIT.w * 6) - 0.5) < 0.15 ? '=' : '(', C(on > 0.5 ? WHITE : YEL, 8 + on * 7)), true;
      }),
    ] },
  // a car lot's showroom: polished floor, three cars on display, the salesman at his desk
  showroom: { grid: boxRoom(12, 9), light: 1, floor: 'marble', ceil: 'strip', sign: true, signAt: 2.6, keeper: [9.6, 2.2],
    props: r => [BX(9.6, 1.5, 1.0, 0.35, 0, 0.8, solid(GRAY, { panel: 0.4, top: '=' })), standing(9.6, 2.2, BLUE),
      ...[[2.5, 3.5, GREEN], [5.6, 5.4, BLUE], [2.6, 7.0, RED]].flatMap(([x, y, col]) => showCar(x, y, col))] },
  // an estate agent's: listings in the window, a desk
  realty: { grid: boxRoom(9, 7), light: 0.9, floor: 'carpet', ceil: 'pendant', sign: true, signAt: 2.6, wall: realtyWall, keeper: [4.5, 2.0],
    props: r => [BX(4.5, 1.4, 1.2, 0.35, 0, 0.8, solid(BRICK, { panel: 0.5, top: '=' })), standing(4.5, 2.0, GREEN),
      SP(1.3, 1.3, 0.6, 1.2, ART.plant, plantCol), BENCHP(7.2, 4.6, -1, 0)] },
  // home: a bed, a closet, a sofa facing the telly, a window on the city. A studio, or a loft twice the size
  home: homeDef(7, 6), loft: homeDef(11, 8),
  hotelroom: { grid: boxRoom(6, 5), light: 0.65, floor: 'wood', ceil: 'pendant', wall: hotelRoomWall,
    props: r => [
      BX(1.85, 2.15, 1.0, 0.75, 0, 0.55, (i, t, L) => { // the bed: white sheets, a red blanket over the foot
        const f = HIT.face, blanket = HIT.u > -0.1;
        BG[i] = C(blanket ? RED : WHITE, (blanket ? 2 : 3) + L * 0.25 * shadeFace(f));
        return set(i, f === 5 && !blanket ? '~' : f === 5 ? ' ' : '-', C(blanket ? RED : GRAY, L * 0.6)), true;
      }, 0, 1),
      BX(1.85, 1.1, 0.8, 0.05, 0, 1.15, solid(BRICK, { panel: 0.4 })), // headboard
      BX(3.25, 1.3, 0.25, 0.22, 0, 0.55, solid(BRICK, { top: '=' })), // nightstand
      BX(3.25, 1.3, 0.08, 0.08, 0.55, 0.85, (i, t, L) => { BG[i] = C(WARM, 8); return set(i, '#', C(YEL, 15)), true; })] }, // and its lamp
};
const plantCol = (c, row, L) => C(row === 3 ? BRICK : GREEN, L);

function makeRoom(kind, extra = {}) {
  const def = ROOM_DEFS[kind], r = { neon: MAG, word: '', ...extra, kind, def, grid: def.grid, W: def.grid[0].length, H: def.grid.length };
  r.menu = MENU_ITEMS[MENUS[r.word] ?? 5];
  r.props = def.props(r);
  return r;
}

// subway trains: arrive (6s), stand with doors open (12s), leave (6s), then the tunnel is empty until the next one
const TRAIN_CYCLE = 45;
function trainX(r) {
  const p = mod(T - r.t0, TRAIN_CYCLE);
  if (p < 6) return -22 + 45 * (1 - (1 - p / 6) ** 2);
  if (p < 18) return 23;
  if (p < 24) return 23 + 60 * ((p - 18) / 6) ** 2;
  return null;
}
const trainStopped = r => { const p = mod(T - r.t0, TRAIN_CYCLE); return p >= 6 && p < 18; };

// a subway car from outside: silver, an orange stripe, lit windows, doors that open while it stands at the platform
const trainShade = (open, k) => (i, t, L) => {
  const f = HIT.face, u = HIT.u, w = HIT.w;
  BG[i] = C(GRAY, (3 + L * 0.5) * shadeFace(f));
  if (f === 5 || f === 6) return set(i, f === 5 ? '=' : ' ', C(GRAY, L)), true;
  if (f <= 2) { // the ends: a cab window and headlights on the leading car
    if (w > 1.8 && w < 2.8 && Math.abs(HIT.v) < 1) { BG[i] = C(CYAN, 2); return set(i, ' ', 0), true; }
    return set(i, (k === 1 && f === 1 || k === -1 && f === 2) && w < 1.1 && Math.abs(Math.abs(HIT.v) - 0.9) < 0.15 ? 'O' : ' ', C(WHITE, 15)), true;
  }
  const door = [-2.6, 0, 2.6].find(dp => Math.abs(u - dp) < 0.6);
  if (door !== undefined && w < 2.6) {
    if (open) { BG[i] = C(WARM, 2); return set(i, (Math.floor(u * 4) + Math.floor(w * 4)) % 5 ? ' ' : '.', C(WARM, 9)), true; }
    return set(i, Math.abs(u - door) < 0.04 ? '|' : ' ', C(GRAY, L * 0.4)), true;
  }
  if (w > 1.0 && w < 1.2) return set(i, '=', C(ORANGE, Math.max(L, 11))), true;
  if (w > 1.55 && w < 2.45 && Math.abs(fract(u / 1.3) - 0.5) < 0.38) { BG[i] = C(CYAN, 2 + L * 0.1); return set(i, hash(Math.floor(u * 3), k, 5) > 0.8 ? 'o' : ' ', C(SKIN, 9)), true; }
  return set(i, ' ', 0), true;
};

function dinerWall(i, u, uStep, z, d, mx, my, L) {
  if (my !== 0) return false;
  if (z > 1.0 && z < 1.6 && Math.abs(u - room.W / 2) < 1.8) { // kitchen pass-through, with a hot glow
    set(i, hash(Math.floor(u * 8), Math.floor(z * 8 + T * 3), 5) > 0.8 ? '~' : '.', C(ORANGE, 10)); BG[i] = C(ORANGE, 2); return true;
  }
  if (wallText(i, u, uStep, z, d, room.word, room.W / 2, 2.5, 0.35, 0.3, C(room.neon, 15))) return true;
  for (const [u0, s] of [[2.6, 0], [room.W - 2.6, 1]]) if (Math.abs(u - u0) < 1.3 && z > 1.45 && z < 2.35) { // menu boards
    BG[i] = C(GRAY, 1);
    if (wallText(i, u, uStep, z, d, room.menu[s * 2], u0, 2.1, 0.17, 0.25, C(WHITE, 14), C(GRAY, 1))) return true;
    if (wallText(i, u, uStep, z, d, room.menu[s * 2 + 1], u0, 1.7, 0.17, 0.25, C(WHITE, 14), C(GRAY, 1))) return true;
    set(i, ' ', 0); return true;
  }
  return false;
}
function arcadeWall(i, u, uStep, z, d, mx, my, L) { // dark walls with a neon zigzag
  const zig = Math.abs(fract(u * 0.8) - 0.5) * 0.6 + 1.5;
  if (Math.abs(z - zig) < 0.05) { set(i, '~', C(NEON[Math.floor(u) & 3], 15)); return true; }
  set(i, (Math.floor(u * 5) + Math.floor(z * 5)) % 7 ? ' ' : '.', C(MAG, 3)); return true;
}
function laundryWall(i, u, uStep, z, d, mx, my, L) { // a row of washing machines with spinning drums (yours, if it's in one)
  if (my === 0 && z >= 1.9) return wallText(i, u, uStep, z, d, 'OPEN 24 HOURS', room.W / 2, 2.05, 0.22, 0.25, C(CYAN, fract(T * 0.7) < 0.93 ? 15 : 6)); // (the tube flickers)
  if (z >= 1.9 || !(my === 0 || mx === 0 || mx === room.W - 1)) return false;
  const n = Math.floor(u / 0.75), fu = fract(u / 0.75), du = (fu - 0.5) * 0.75, dz = z - 0.85, rr = Math.hypot(du, dz);
  const mine = my === 0 && myLaundromat() && wash.n === n, done = mine && T >= wash.done;
  if (fu < 0.05 || z < 0.1) { set(i, '|', C(GRAY, L)); return true; }
  if (mine && z > 1.25 && z < 1.4 && Math.abs(du) < 0.2) { set(i, done ? (fract(T * 2) < 0.5 ? '*' : ' ') : ':', C(done ? GREEN : YEL, 15)); return true; } // its little light
  if (rr < 0.2 && done) { set(i, '~', C(WHITE, 14)); return true; } // still, and clean
  if (rr < 0.2) { const ang = mod(Math.atan2(dz, du) + T * (mine ? 12 : 6) * (n & 1 ? 1 : -1), 6.283); set(i, '@o.'[ang / 2.1 | 0], C(mine ? WHITE : ITEM_COL[n & 7], mine ? 15 : L)); return true; }
  if (rr < 0.26) { set(i, 'O', C(GRAY, L * 1.2)); return true; }
  if (z > 1.55) { set(i, fract(u * 4) < 0.3 ? 'o' : '=', C(CYAN, L)); return true; }
  set(i, '#', C(WHITE, L * 0.5)); return true;
}
function cinemaWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0 && z > 0.7 && z < 2.7 && Math.abs(u - room.W / 2) < 5.2) { // the movie
    const v = noise(u * 0.9 + T * 0.6, z * 2.2 - T * 0.3, 101) * 0.7 + noise(u * 3 - T, z * 6, 102) * 0.3, hue = [CYAN, ORANGE, MAG, GREEN][Math.floor(T / 8) & 3];
    set(i, ' .:-=+*#'[v * 8 | 0], C(hue, 6 + v * 9)); BG[i] = C(hue, 1 + v * 3); return true;
  }
  set(i, fract(u * 3) < 0.3 ? '|' : ' ', C(RED, L * 0.8)); BG[i] = C(RED, 1); return true; // curtains
}
function hotelWall(i, u, uStep, z, d, mx, my, L) {
  if (z < 1.1) { set(i, fract(u * 2) < 0.06 ? '|' : '=', C(BRICK, L)); return true; }
  if (z < 1.15) { set(i, '-', C(YEL, L)); return true; }
  set(i, (Math.floor(u * 4) + Math.floor(z * 4)) & 1 ? '%' : ' ', C(WARM, L * 0.35)); return true;
}
function aptsWall(i, u, uStep, z, d, mx, my, L) { // mailboxes on the left wall
  if (mx !== 0 || z < 0.9 || z > 1.8) return false;
  set(i, fract(u / 0.3) < 0.12 || fract(z / 0.25) < 0.15 ? '+' : '#', C(GRAY, L * (fract(u / 0.3) < 0.12 ? 1 : 0.6))); return true;
}
function gymWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0) return wallText(i, u, uStep, z, d, 'NO PAIN NO GAIN', room.W / 2, 1.6, 0.3, 0.3, C(ORANGE, 15));
  if (z > 0.3 && z < 2.2) { // mirrors down the side walls
    if (fract(u / 1.5) < 0.04) { set(i, '|', C(GRAY, L)); return true; }
    set(i, (Math.floor(u * 6) + Math.floor(z * 6)) % 5 ? ' ' : '/', C(CYAN, L * 0.5)); BG[i] = C(CYAN, 1); return true;
  }
  return false;
}
function barberWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0 && z > 0.9 && z < 2.0) { // a mirror behind each chair
    if (fract(u / 2.5) < 0.05 || z < 0.95 || z > 1.95) { set(i, '=', C(GRAY, L)); return true; }
    set(i, fract(u * 3 + z) < 0.08 ? '/' : ' ', C(CYAN, L * 0.6)); BG[i] = C(CYAN, 1); return true;
  }
  if (room.word === 'TATTOO' && my !== 0 && z > 0.9 && z < 2.4) { // flash art sheets covering the walls
    if (fract(u * 3) < 0.08 || fract(z * 3) < 0.08) { set(i, '+', C(GRAY, L * 0.5)); return true; }
    const h = hash(Math.floor(u * 3), Math.floor(z * 3), 31) * 0.999;
    set(i, '*@%&#'[h * 5 | 0], C(ITEM_COL[h * 80 & 7], L)); return true;
  }
  return false;
}
// hospital walls: pale green tile with a handrail and a green guide stripe, EMERGENCY in red over the desk, a big
// red cross beside it, and STAFF ONLY swing doors (round windows) in the back corner
function hospitalWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0) {
    if (wallText(i, u, uStep, z, d, 'EMERGENCY', 6, 2.55, 0.28, 0.32, C(RED, 15))) return true;
    const cu = u - 12.55, cz = z - 2.45;
    if (Math.abs(cu) < 0.35 && Math.abs(cz) < 0.35 && (Math.abs(cu) < 0.11 || Math.abs(cz) < 0.11)) { BG[i] = C(RED, 9); return set(i, ' ', 0), true; }
    if (u > 1.1 && u < 3.1 && z > 2.05 && z < 2.35) { // STAFF ONLY over the swing doors
      BG[i] = C(BLUE, 4); return wallText(i, u, uStep, z, d, 'STAFF ONLY', 2.1, 2.2, 0.17, 0.2, C(WHITE, 15)) || (set(i, ' ', 0), true);
    }
    if (u > 1.2 && u < 3 && z < 2.02) { // the swing doors, a round window in each
      const fu = (u - 1.2) / 1.8, win = Math.hypot((fract(fu * 2) - 0.5) * 1.8, (z - 1.5) / 0.22) < 0.5;
      if (Math.abs(fu - 0.5) < 0.02) return set(i, '|', C(GRAY, L)), true;
      if (win) { BG[i] = C(CYAN, 3); return set(i, ' ', 0), true; }
      BG[i] = C(GRAY, 4); return set(i, fract(u * 4) < 0.1 ? '|' : ' ', C(GRAY, L * 0.7)), true;
    }
  }
  BG[i] = C(GREEN, 2 + L * 0.08);
  if (Math.abs(z - 0.95) < 0.04) return set(i, '=', C(GRAY, L * 1.1)), true; // the handrail
  if (Math.abs(z - 0.55) < 0.05) { BG[i] = C(GREEN, 5); return set(i, ' ', 0), true; } // the guide stripe
  return set(i, fract(u * 3.3) < 0.06 || fract(z * 3.3) < 0.06 ? '+' : ' ', C(GREEN, L * 0.35)), true; // tiles
}
function lighthouseWall(i, u, uStep, z, d, mx, my, L) {
  if (my !== room.H - 1 && Math.abs(fract(u / 3) - 0.5) < 0.1 && z > 1.3 && z < 1.9) { // a deep-set window: sea below, sky above
    const [su, sz] = glassSlopes(u, z); // the horizon's at your eye, wherever you stand; the sea, 30m down
    if (sz < 0) { const q = (-30 - z) / sz, n = noise((u + su * q) * 0.2 + T * 0.3, q * 0.2, 887); BG[i] = C(BLUE, 2 + day * 3); return set(i, n > 0.6 ? '~' : n > 0.45 ? '-' : ' ', C(CYAN, 6 + day * 6)), true; }
    BG[i] = day > 0.3 ? C(day > 0.6 ? CYAN : BLUE, 2 + day * 6) : dusk > 0.3 ? C(ORANGE, 4) : C(BLUE, 1);
    return set(i, night > 0.5 && hash(Math.floor(Math.atan(su) * 120), Math.floor(sz * 120), 888) > 0.95 ? '.' : ' ', C(WHITE, 12)), true;
  }
  BG[i] = C(WHITE, 2 + L * 0.15); // whitewashed stone in courses
  const row = Math.floor(z * 3), joint = fract(z * 3) < 0.08 || fract(u * 1.5 + (row & 1) * 0.5) < 0.04;
  return set(i, joint ? (fract(z * 3) < 0.08 ? '_' : '|') : ' ', C(GRAY, L * 0.6)), true;
}
function lampRoomWall(i, u, uStep, z, d, mx, my, L) {
  if (z < 0.9 || z > 2.5) { BG[i] = C(GRAY, 2 + L * 0.15); return set(i, z < 0.9 && fract(z * 4) < 0.15 ? '=' : ' ', C(GRAY, L)), true; } // ironwork below and above the glass
  if (fract(u * 1.2) < 0.05) { BG[i] = C(GRAY, 2); return set(i, '|', C(GRAY, L)), true; } // the mullions
  if (z < 1.45) { BG[i] = C(BLUE, 1 + day * 3); return set(i, hash(Math.floor(u * 6 + T * 0.5), Math.floor(z * 20), 3) > 0.8 ? '~' : ' ', C(CYAN, 5 + day * 6)), true; } // the sea, far below
  BG[i] = C(day > 0.5 ? CYAN : BLUE, day > 0.5 ? 3 + day * 3 : 1);
  return set(i, night > 0.5 && hash(Math.floor(u * 9), Math.floor(z * 15), 4) > 0.93 ? '.' : ' ', C(WHITE, 12)), true; // the sky, stars at night
}
// a car on display: body, glass, wheels (metres)
function showCar(x, y, col) {
  return [BX(x, y, 1.0, 0.45, 0.15, 0.75, (i, t, L) => { BG[i] = C(col, (3 + L * 0.5) * shadeFace(HIT.face)); return set(i, HIT.face >= 5 ? ' ' : HIT.w < 0.3 ? '_' : ' ', C(GRAY, L * 0.6)), true; }),
    BX(x - 0.1, y, 0.55, 0.4, 0.75, 1.15, (i, t, L) => { BG[i] = HIT.face >= 5 ? C(col, 3 + L * 0.4) : C(CYAN, 1 + L * 0.15); return set(i, ' ', 0), true; }),
    ...[-0.65, 0.65].map(u => BX(x + u, y, 0.18, 0.47, 0, 0.32, (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, '@', C(GRAY, L * 0.7)), true; }))];
}
function realtyWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0 && z > 1.0 && z < 1.9 && fract(u / 1.6) < 0.7) { // listings pinned up: a little house, a price
    const fu = fract(u / 1.6) / 0.7, fz = (z - 1.0) / 0.9;
    BG[i] = C(WHITE, 4 + L * 0.2);
    if (fz > 0.45 && fz < 0.85 && Math.abs(fu - 0.5) < 0.3 - (fz - 0.45)) return set(i, '^', C(BRICK, 12)), true; // the roof
    if (fz > 0.15 && fz <= 0.45 && Math.abs(fu - 0.5) < 0.22) return set(i, Math.abs(fu - 0.5) < 0.05 ? '|' : '#', C(GRAY, 9)), true;
    return set(i, fz < 0.12 && fract(fu * 6) < 0.6 ? '$' : ' ', C(GREEN, 12)), true;
  }
  BG[i] = C(WARM, 2 + L * 0.15); return set(i, fract(u * 2) < 0.04 ? '|' : ' ', C(WARM, L * 0.5)), true;
}
function homeDef(w, h) {
  const big = w > 8, bed = [1.6, 1.6], closet = [w - 1.5, 1.2], sofa = [w / 2, h - 2.4], tv = [w / 2, 1.0];
  return { grid: boxRoom(w, h), light: 0.75, floor: 'wood', ceil: 'pendant', wall: homeWall, spots: { bed, closet, tv },
    props: r => [
      BX(bed[0], bed[1] + 0.2, 1.0, 0.8, 0, 0.55, (i, t, L) => { const f = HIT.face, blanket = HIT.v > -0.2; BG[i] = C(blanket ? BLUE : WHITE, (blanket ? 2 : 3) + L * 0.25 * shadeFace(f)); return set(i, f === 5 && !blanket ? '~' : ' ', C(GRAY, L * 0.6)), true; }),
      BX(closet[0], closet[1] - 0.6, 0.8, 0.3, 0, 2.1, solid(BRICK, { panel: 0.5 })),
      BX(tv[0], tv[1] - 0.3, 0.7, 0.12, 0.6, 1.3, (i, t, L) => { // the telly: static, or a show on
        if (HIT.face !== 4 && HIT.face !== 3) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
        if (!r.tv) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
        BG[i] = C(NEON[(T * 0.7 | 0) & 3], 3 + hash(Math.floor(HIT.u * 20), Math.floor(HIT.w * 20), T * 4 | 0) * 6); return set(i, ' ', 0), true;
      }),
      BX(tv[0], tv[1] - 0.3, 0.8, 0.25, 0, 0.6, solid(BRICK, { top: '=' })), // the stand
      ...toilet(1.3, h - 1.6, 1, porcelain), // (an open-plan bathroom)
      BENCHP(sofa[0], sofa[1], 0, -1), ...(big ? [SP(w - 1.3, h - 1.3, 0.6, 1.2, ART.plant, plantCol), BENCHP(sofa[0] - 2.4, sofa[1], 0, -1)] : []),
    ] };
}
const POTTY_SCRAWL = ['FOR A GOOD', 'TIME CALL', '555-0142', '', 'DAVE WAS', 'HERE'];
function pottyWall(i, u, uStep, z, d, mx, my, L) {
  BG[i] = C(BLUE, 1.6 + L * 0.3);
  if (z > 2.05) return set(i, fract(u * 10) < 0.5 ? '=' : ' ', C(WHITE, 10)), true; // the vent: daylight through the slats
  if (mx === 0 && z > 0.95 && z < 1.75) { // the scrawl on the left wall, in marker (the sign font, small)
    const LH = 0.13, CWID = 0.08, dz = (1.75 - z) / LH, row = Math.floor(dz), pos = (2.75 - Math.abs(u)) / CWID, ci = Math.floor(pos);
    const ch = (POTTY_SCRAWL[row] || '')[ci];
    if (ch && ch !== ' ' && glyphOn(ch, Math.floor((pos - ci) * 4), Math.floor((dz - row) * 6))) return set(i, '#', C(GRAY, 4 + L * 0.6)), true;
  }
  return set(i, fract(u * 6) < 0.12 ? '|' : ' ', C(BLUE, L * 0.8)), true; // ribs
}
function homeWall(i, u, uStep, z, d, mx, my, L) {
  if (mx === 0 && z > 1.0 && z < 2.1 && Math.abs(fract(u / 3) - 0.5) < 0.2) { // a window on the city: lit windows across the street at night
    const fw = fract(u / 3);
    if (Math.abs(fw - 0.5) > 0.19 || z < 1.04 || z > 2.06 || Math.abs(fw - 0.5) < 0.01) { BG[i] = C(WARM, 2); return set(i, Math.abs(fw - 0.5) > 0.19 ? '|' : '=', C(WHITE, L)), true; } // the frame
    return viewOut(i, u, z, 12, 4), true; // across the street from the first floor
  }
  BG[i] = C(WARM, 2 + L * 0.2); // wallpaper with a little pattern
  return set(i, (Math.floor(u * 4) + Math.floor(z * 4)) % 3 ? ' ' : '.', C(BRICK, L * 0.5)), true;
}
function bankWall(i, u, uStep, z, d, mx, my, L) {
  if (mx === room.W - 1 && z < 2.6) { // the vault door on the right-hand wall
    const du = u - room.H / 2, dz = z - 1.3, rr = Math.hypot(du, dz);
    if (rr < 1.1) {
      BG[i] = C(GRAY, 3);
      if (rr > 1.0) { set(i, 'O', C(GRAY, 15)); return true; }
      if (rr < 0.2) { set(i, '@', C(YEL, 14)); return true; }
      const spoke = Math.abs(fract(Math.atan2(dz, du) / (Math.PI / 4)) - 0.5) > 0.42 && rr < 0.85;
      set(i, spoke ? '=' : '#', C(GRAY, spoke ? 14 : L * 0.7)); return true;
    }
  }
  if (my === 0) return false; // back wall: the sign
  set(i, noise(u * 2, z * 2, 7) > 0.62 ? '~' : ' ', C(GRAY, L * 0.6)); BG[i] = C(WHITE, 3); return true; // marble
}
function karaokeWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0 && z > 1.1 && z < 2.7 && Math.abs(u - room.W / 2) < 3) { // lyrics screen: the sung part lights up
    BG[i] = C(BLUE, 2);
    const line = LYRICS[Math.floor(T / 5) % LYRICS.length], sung = fract(T / 5) * 1.3 * line.length;
    const q = (u - room.W / 2) / 0.28 + line.length / 2, p = Math.floor(q);
    if (Math.abs(z - 1.9) < 0.15 && p >= 0 && p < line.length) {
      const on = (uStep >= 0.28 || oneCell((fract(q) - 0.5) * 0.28, uStep)) && oneCell(z - 1.9, d / projY);
      set(i, on ? line[p] : ' ', C(p < sung ? MAG : WHITE, 15)); return true;
    }
    set(i, ' ', 0); return true;
  }
  set(i, (Math.floor(u * 4) + Math.floor(z * 4)) % 9 ? ' ' : '*', C(NEON[(Math.floor(u) + (T * 2 | 0)) & 3], 8)); return true; // glitter
}
function petWall(i, u, uStep, z, d, mx, my, L) { // walls of fish tanks
  if (z < 0.78) { set(i, '#', C(BRICK, L * 0.6)); return true; }
  if (z > 1.92) return false;
  if (z < 0.82 || z > 1.88 || fract(u / 1.6) < 0.03) { set(i, '=', C(GRAY, L)); return true; }
  BG[i] = C(BLUE, 3);
  const lane = Math.floor(z * 7), dir = lane & 1 ? 1 : -1, s = fract(u * 0.7 - T * 0.25 * dir + hash(lane, mx + my, 3));
  if (s < 0.09) { set(i, (dir > 0 ? '><>' : '<><')[s / 0.03 | 0], C([ORANGE, YEL, RED, CYAN][lane & 3], 15)); return true; }
  if (hash(Math.floor(u * 10), Math.floor(z * 10 - T * 2), 5) > 0.97) { set(i, 'o', C(WHITE, 8)); return true; } // bubbles
  set(i, ' ', 0); return true;
}
function floristWall(i, u, uStep, z, d, mx, my, L) { // vines and blooms on the side walls
  if (my === 0 || z > 2.3) return false;
  const h = hash(Math.floor(u * 5), Math.floor(z * 5), 17);
  set(i, h > 0.85 ? '*' : h > 0.5 ? '~' : ' ', C(h > 0.85 ? ITEM_COL[h * 100 & 7] : GREEN, L)); return true;
}
function stationWall(i, u, uStep, z, d, mx, my, L) {
  if (mx < 9 || mx > 36) {
    if (mx === 0 || mx === room.W - 1) { BG[i] = NONE; set(i, Math.abs(z - 1.5) < 0.12 && Math.abs(fract(u) - 0.5) < 0.12 ? 'o' : ' ', C(RED, 14)); return true; }
    const lamp = Math.abs(fract(u / 5) - 0.5) < 0.04 && Math.abs(z - 2.3) < 0.08;
    set(i, lamp ? 'o' : Math.abs(z - 1.8) < 0.03 ? '=' : (Math.floor(u * 3) + Math.floor(z * 3)) % 7 ? ' ' : '.', lamp ? C(WARM, 13) : C(GRAY, L * 0.25));
    BG[i] = C(GRAY, 0); return true;
  }
  const far = my === room.H - 1; // the tunnel wall across the tracks
  const u0 = Math.floor((u - 2) / 8) * 8 + 6;
  if (z > 1.55 && z < 1.95 && (my === ST_TRACK - 6 || far)) { // name band, repeated along the platform
    if (wallText(i, u, uStep, z, d, room.word, u0, 1.75, 0.25, 0.35, C(WHITE, 15), C(GREEN, 4))) return true;
    set(i, ' ', 0); BG[i] = C(GREEN, 4); return true;
  }
  if (far) {
    if (z > 2.25 && z < 2.4 && fract(u / 4) < 0.05) { set(i, 'o', C(WARM, 15)); return true; }
    set(i, hash(Math.floor(u * 4), Math.floor(z * 4), 7) > 0.85 ? ':' : '.', C(GRAY, L * 0.3)); BG[i] = C(GRAY, 1); return true;
  }
  const grout = fract(u / 0.3) < 0.1 || fract(z / 0.3) < 0.1; // white tiles everywhere else
  set(i, grout ? '+' : ' ', C(GRAY, L * 0.5)); BG[i] = C(WHITE, 4 * L / 14); return true;
}
function trainWall(i, u, uStep, z, d, mx, my, L) {
  if (my !== 0 && my !== room.H - 1) return false;
  if (z > 1.05 && z < 1.95) { // windows: tunnel lights streaking past
    if (fract(u / 1.8) < 0.06) { set(i, '|', C(GRAY, L)); return true; }
    const s = fract(u * 1.2 + room.track * 4), s2 = fract(u * 0.5 + room.track * 1.5 + 0.3); // near and far tunnel lights
    set(i, s < 0.06 ? '=' : s2 < 0.04 ? '-' : ' ', C(YEL, s < 0.06 ? 13 : 7)); BG[i] = C(GRAY, 1); return true;
  }
  if (z > 2.05 && z < 2.4) { // ads above the windows
    const k = Math.floor(u / 6), ad = ADS[mod(k, ADS.length)];
    if (wallText(i, u, uStep, z, d, ad, k * 6 + 3, 2.22, 0.15, 0.3, C(NEON[mod(k, 4)], 14))) return true;
    set(i, '-', C(GRAY, L * 0.5)); return true;
  }
  return false;
}

function roomWall(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const R = room, D = R.def, c = roomAt(mx, my), L = fog * (side ? 10 : 14) * D.light;
  BG[i] = NONE;
  if (c === 'D' && R.kind !== 'cathedral') { // the way out: glass doors, or stairs up from the subway
    if (R.kind === 'station') {
      if (z > 1.6 + STATION_STAIRS.rise) return wallText(i, u, uStep, z, d, 'EXIT', 11.5, 1.8 + STATION_STAIRS.rise, 0.25, 0.3, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
      set(i, ' ', 0); BG[i] = C(day > 0.3 ? WHITE : WARM, 3 + day * 7); return; // daylight (or streetlight) from the top
    }
    if (z > 2.3) return set(i, '=', C(GRAY, L));
    return fract(u) < 0.08 ? set(i, '|', C(GRAY, L)) : set(i, ':', C(day > 0.3 ? CYAN : WARM, 6 + day * 6));
  }
  if (c === 'E') { // elevator
    if (z > 2.25) return wallText(i, u, uStep, z, d, 'ROOF ^', D.ex, 2.5, 0.18, 0.3, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
    BG[i] = C(GRAY, 2);
    return set(i, Math.abs(u - D.ex) < 0.04 ? '|' : ':', C(GRAY, L * 1.2));
  }
  if (TANKS[c]) return tankCell(i, u, uStep, z, d, side, mx, my, L, c, wc);
  if (c === 'W' && D.wc) { // the bathroom's wall seen from outside: a plain wall, the WC sign by the doorway
    const [sx, sy, su] = D.wc.sign; // (u runs whichever way reads left to right, so it's negative from some sides)
    if (mx === sx && my === sy && wallText(i, u, uStep, z, d, 'WC', Math.sign(u) * su, 1.95, 0.22, 0.3, C(CYAN, 15), C(BLUE, 3))) return;
    if (z < 0.9) return set(i, '#', C(BRICK, L * 0.6));
    if (z < 0.95) return set(i, '=', C(GRAY, L));
    return set(i, '.', C(GRAY, L * 0.3));
  }
  if (D.sign && my === 0 && wallText(i, u, uStep, z, d, R.word, D.signAt ?? R.W / 2, 2.45, 0.4, 0.3, C(R.neon, 15))) return;
  if (D.wall && D.wall(i, u, uStep, z, d, mx, my, L)) return;
  if (c === 'S' || D.shelves && my === 0 && z < 2) { // shelves: islands, and along the back wall
    if (z < 0.15) return set(i, '_', C(GRAY, L * 0.6));
    if (fract(z / 0.45) < 0.14) return set(i, '=', C(WHITE, L * 0.7));
    const glyphs = D.glyphs || R.glyphs || 'o#=@';
    const hh = hash(Math.floor(u * 7), Math.floor(z / 0.45), mx * 31 + my), fu = fract(u * 7), fz = fract(z / 0.45);
    if (hh < 0.2 || fu < 0.2 || fu > 0.8 || fz > 0.7) return set(i, ' ', 0); // gaps between products
    return set(i, glyphs[hh * 97 % glyphs.length | 0], C(ITEM_COL[hh * 13 % ITEM_COL.length | 0], D.neon ? 14 : L));
  }
  if (D.neon && z > 2.75 && z < 2.85) return set(i, '=', C(R.neon, 15));
  if (z < 0.9) return set(i, '#', C(BRICK, L * 0.6)); // wainscot
  if (z < 0.95) return set(i, '=', C(GRAY, L));
  if (D.posters && hash(Math.floor(u / 1.2), Math.floor(z), mx + my * 10) > 0.8 && fract(u / 1.2) > 0.15 && fract(u / 1.2) < 0.85 && fract(z) > 0.2 && fract(z) < 0.8)
    return set(i, '%', C(ITEM_COL[hash(Math.floor(u / 1.2), 5) * 8 | 0], L));
  set(i, '.', C(GRAY, L * 0.3));
}
function roomFloor(i, r, x, rx, ry) {
  const d = eye * projY / (r - hor + 0.5), wx = px + rx * d, wy = py + ry * d, f = Math.max(0, 1 - d / 30), L = f * 7 * room.def.light;
  ZB[i] = d; FL[i] = 1;
  if (room.def.wc && inWc(wx, wy)) { BG[i] = C(WHITE, 1 + L * 0.2); return set(i, fract(wx * 3) < 0.1 || fract(wy * 3) < 0.1 ? '+' : ' ', C(GRAY, L)); } // bathroom tiles
  switch (room.def.floor) {
    case 'wood': return set(i, fract(wy * 3) < 0.12 ? '=' : (r + x) & 1 ? '.' : ' ', C(BRICK, L * 1.3));
    case 'carpet': { const h = hash(Math.floor(wx * 3), Math.floor(wy * 3), 77); return set(i, h > 0.85 ? '*' : h > 0.7 ? '+' : h > 0.55 ? '.' : ' ', C(NEON[h * 40 & 3], L * 2.5)); }
    case 'train': return set(i, fract(wx * 4) < 0.2 ? '|' : ' ', C(GRAY, L));
    case 'rubber': return set(i, (r * 7 + x * 3) % 11 ? ' ' : '.', C(GRAY, L));
    case 'concrete': { const h = hash(Math.floor(wx * 2), Math.floor(wy * 2), 37); return set(i, h > 0.9 ? '%' : (r + x) % 4 ? ' ' : '.', C(h > 0.9 ? BRICK : GRAY, L * (h > 0.9 ? 0.6 : 1))); }
    case 'aqua': return aquaFloor(i, f, wx, wy);
    case 'cathedral': return cathedralFloor(i, f, wx, wy);
    case 'jail': return jailFloor(i, f, wx, wy);
    case 'conservatory': return conservatoryFloor(i, f, wx, wy);
    case 'jade': return jadeFloor(i, f, wx, wy);
    case 'casino': return casinoFloor(i, f, wx, wy);
    case 'museum': return museumFloor(i, f, wx, wy);
    case 'aviary': return aviaryFloor(i, f, wx, wy);
    case 'marble': BG[i] = (Math.floor(wx) + Math.floor(wy)) & 1 ? C(WHITE, 2 + f * 3) : C(GRAY, 1); return set(i, ' ', 0);
    case 'station':
      if (wy > ST_TRACK - 0.7) { // track bed: rails, sleepers, gravel
        if (Math.abs(wy - ST_TRACK - 0.3) < 0.05 || Math.abs(wy - ST_TRACK - 1.5) < 0.05) return set(i, '=', C(GRAY, L * 1.8));
        if (wy > ST_TRACK + 0.3 && wy < ST_TRACK + 1.5 && fract(wx / 0.6) < 0.25) return set(i, '#', C(BRICK, L));
        return set(i, (r + x) % 3 ? ' ' : '.', C(GRAY, L * 0.5));
      }
      if (wy > ST_TRACK - 1) return set(i, '=', C(YEL, L * 2)); // mind the gap
    // fall through: platform tiles
    default: {
      const edge = fract(wx) < 0.06 || fract(wy) < 0.06;
      set(i, edge ? '+' : (Math.floor(wx) + Math.floor(wy)) & 1 ? '.' : ' ', C(edge ? GRAY : WHITE, L));
    }
  }
}
function roomCeil(i, r, x, rx, ry) {
  const d = ((room.def.height || 3) - eye) * projY / (hor - r - 0.5), wx = px + rx * d, wy = py + ry * d;
  ZB[i] = d; FL[i] = 0;
  const st = room.def.ceil;
  if (st === 'pendant') { // warm hanging lamps on a 2m grid
    const on = Math.hypot(fract(wx / 2) - 0.5, fract(wy / 2) - 0.5) < 0.07;
    return set(i, on ? 'o' : (r + x) % 4 ? ' ' : '.', on ? C(WARM, 15) : C(BRICK, 2));
  }
  if (st === 'lantern') { // red paper lanterns on a 1.5m grid
    const on = Math.hypot(fract(wx / 1.5) - 0.5, fract(wy / 1.5) - 0.5) < 0.12;
    if (on) BG[i] = C(RED, 6);
    return set(i, on ? 'O' : (r + x) % 5 ? ' ' : '.', on ? C(YEL, 15) : C(RED, 2));
  }
  if (st === 'disco') { // spots of coloured light sweeping across the ceiling
    const on = hash(Math.floor(wx * 3), Math.floor(wy * 3), 9) > 0.88;
    return set(i, on ? '*' : ' ', C(NEON[(Math.floor(wx * 3 + wy * 2 + T * 3)) & 3], 15));
  }
  if (st === 'aqua') return aquaCeil(i, r, x, wx, wy);
  if (st === 'cathedral') return cathedralCeil(i, wx, wy);
  if (st === 'jail') return jailCeil(i, wx, wy);
  if (st === 'glass') return glassCeil(i, wx, wy);
  if (st === 'chandelier') return casinoCeil(i, wx, wy);
  if (st === 'dark') return set(i, hash(Math.floor(wx * 2), Math.floor(wy * 2), 9) > 0.93 ? '.' : ' ', C(MAG, 4));
  const strip = fract(wx / 2.5) < 0.18 && wy > 0.6 && wy < room.H - 0.6 && !(room.kind === 'station' && (wx < 9 || wx > 37)); // fluorescent tubes (not down the tunnels)
  set(i, strip ? '=' : (r + x) % 3 ? ' ' : '.', strip ? C(WHITE, 15) : C(GRAY, 3));
}
function roomSprites() {
  for (const s of room.props) {
    if (s.tick) s.tick(s); // (someone walking about)
    if (s.box) { drawBox({ ...s.box, x: s.box.x - px, y: s.box.y - py }, s.shade); continue; }
    if (s.bench) { drawBench(s.x - px, s.y - py, s.fx, s.fy, 0.1); continue; }
    if (s.vm) { drawVending(s.vm, s.x - px, s.y - py, 10); continue; } // a vending machine, life size
    drawArt(s.x - px, s.y - py, s.z, s.w, s.h, typeof s.art === 'function' ? s.art() : s.art, s.col);
  }
  const at = placeKey();
  for (const d of dropped) if (d.at === at) drawDropped(d, d.x - px, d.y - py, 0.07); // things you put down in here
  if (room.kind === 'station') {
    const tx = trainX(room);
    if (tx !== null) for (const k of [-1, 0, 1]) drawBox(boxAt(tx + k * 8.6 - px, ST_TRACK + 0.9 - py, 1, 0, 4.1, 1.4, 0.35, 3.3), trainShade(trainStopped(room), k));
  }
}
const ROOMW = { cell: (x, y) => { const c = roomAt(x, y); return c === '.' ? 0 : c === 'S' ? 2.2 : c === 'L' ? 2.6 : c === 'G' ? 4 : room.def.height || 3; },
                wall: roomWall, floor: roomFloor, sky: roomCeil, sprites: roomSprites };
