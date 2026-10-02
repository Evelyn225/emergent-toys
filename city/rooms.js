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
const STATION_GRID = boxRoom(30, 9, { '1,0': 'D', '2,0': 'D', '5,3': '#', '10,3': '#', '15,3': '#', '20,3': '#', '25,3': '#' }, false);
const MENUS = { RAMEN: 0, NOODLES: 0, PHO: 0, DUMPLINGS: 0, THAI: 0, SUSHI: 0, TACOS: 1, PIZZA: 2, CAFE: 3, COFFEE: 3, DONUTS: 3, KEBAB: 4 };
const MENU_ITEMS = [['RAMEN 9', 'GYOZA 5', 'MISO 3', 'TEA 2'], ['TACO 3', 'BURRITO 7', 'NACHOS 5', 'SODA 2'],
                    ['SLICE 3', 'WHOLE 18', 'KNOTS 4', 'SODA 2'], ['LATTE 4', 'DONUT 2', 'BAGEL 3', 'TEA 2'],
                    ['KEBAB 8', 'FALAFEL 6', 'FRIES 3', 'AYRAN 2'], ['BURGER 6', 'FRIES 3', 'SHAKE 4', 'PIE 3']];
const ROOM_FOR = { BAR: 'bar', KARAOKE: 'karaoke', DINER: 'diner', ARCADE: 'arcade', VIDEO: 'arcade', LAUNDRY: 'laundry',
                   CINEMA: 'cinema', HOTEL: 'hotel', MOTEL: 'hotel', GYM: 'gym', BARBER: 'barber', TATTOO: 'barber',
                   BANK: 'bank', 'PET SHOP': 'petshop', FLORIST: 'florist' };
const LYRICS = ['OH BABY BABY', 'I WILL SURVIVE', 'DONT STOP BELIEVING', 'SWEET CAROLINE', 'LIVIN ON A PRAYER', 'TAKE ON ME'];
for (const w in MENUS) ROOM_FOR[w] = 'diner';

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

const ROOM_DEFS = {
  store: { grid: ['##########', '#........#', '#.SS..SS.#', '#........#', '#.SS..SS.#', '#........#', '#........#', '####DD####'],
    light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, posters: true, keeper: [5, 1.05],
    props: r => [SP(5, 1.7, 3.2, 1.05, ART.counter, wood), standing(5, 1.05, r.neon)] },
  bar: { grid: boxRoom(12, 8), light: 0.6, floor: 'wood', ceil: 'pendant', shelves: true, sign: true, neon: true, glyphs: 'il!Y', keeper: [6, 1.1],
    props: r => {
      const p = [SP(6, 1.8, 8, 1.1, ART.barTop, wood), standing(6, 1.1, r.neon),
                 SP(10.6, 5.5, 0.9, 1.5, ART.jukebox, (c, row, L) => C(NEON[(row + (T * 2 | 0)) & 3], 14))];
      for (let x = 3; x <= 9; x += 1.5) { p.push(SP(x, 2.65, 0.4, 0.75, ART.stool, wood)); if (chance(barCrowd())) p.push(sitting(x, 2.7, shirt(), 0.45, true)); }
      return p;
    } },
  diner: { grid: boxRoom(12, 8), light: 1, floor: 'tile', ceil: 'strip', sign: false, keeper: [6, 1.1], wall: dinerWall,
    props: r => {
      const p = [SP(6, 1.75, 4, 1.05, ART.counter, wood), standing(6, 1.1, WHITE)];
      for (const [x, y] of [[2.6, 4.2], [9.4, 4.2], [2.6, 6.2], [9.4, 6.2]]) {
        p.push(SP(x, y, 1.4, 0.8, ART.table, wood));
        for (const s of [-0.95, 0.95]) { p.push(SP(x + s, y, 0.4, 0.75, ART.stool, wood)); if (chance(0.4)) p.push(sitting(x + s, y - 0.02, shirt())); }
      }
      return p;
    } },
  arcade: { grid: boxRoom(12, 9), light: 0.5, floor: 'carpet', ceil: 'dark', sign: true, wall: arcadeWall,
    props: r => {
      const p = [];
      for (const [xs, y] of [[[2, 3.5, 5, 6.5, 8, 9.5], 2.2], [[3.5, 5, 7, 8.5], 5.2]]) for (const x of xs) {
        const k = Math.random() * 4 | 0, body = pick([MAG, BLUE, RED, GREEN]);
        p.push(SP(x, y, 0.8, 1.8, () => ART.cab[(T * 6 + k | 0) & 3], (c, row, L) => row === 2 || row === 3 ? C(NEON[(row + k) & 3], 15) : C(body, L * 1.5)));
        if (chance(0.35)) p.push(standing(x, y + 0.7, shirt()));
      }
      return p;
    } },
  laundry: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', sign: true, wall: laundryWall,
    props: r => [SP(5, 3.6, 2, 0.5, ART.bench, wood), sitting(5, 3.58, shirt(), 0.3), SP(7.6, 4.6, 0.7, 0.8, ART.cart, (c, row, L) => C(row === 1 ? pick(ITEM_COL) : GRAY, L))] },
  cinema: { grid: boxRoom(14, 12), light: 0.3, floor: 'carpet', ceil: 'dark', wall: cinemaWall,
    props: r => {
      const p = [];
      for (const y of [5, 6.5, 8, 9.5]) {
        p.push(SP(7, y, 9, 0.9, ART.seats, (c, row, L) => C(RED, L * 2)));
        for (let k = 0; k < 2; k++) if (chance(0.7)) p.push(sitting(3 + Math.random() * 8, y + 0.05, shirt(), 0.35, true));
      }
      return p;
    } },
  hotel: { grid: boxRoom(12, 8, { '5,0': 'E', '6,0': 'E' }), light: 0.9, floor: 'wood', ceil: 'pendant', sign: true, signAt: 2.6, wall: hotelWall,
    keeper: [3.2, 2.0], ex: 6,
    props: r => [SP(3.2, 2.6, 2.6, 1.1, ART.desk, wood), standing(3.2, 2.0, r.neon), SP(1.4, 1.4, 0.7, 1.3, ART.plant, plantCol),
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
  bank: { grid: boxRoom(14, 9), light: 1, floor: 'marble', ceil: 'pendant', sign: true, wall: bankWall, keeper: [7, 1.5],
    props: r => [SP(7, 2.4, 9, 1.8, ART.bankCounter, (c, row, L) => C(row < 3 ? GRAY : BRICK, L * 1.2)),
                 standing(3.5, 1.5, BLUE), standing(7, 1.5, BLUE), standing(10.5, 1.5, BLUE), standing(12.3, 6, GRAY)] },
  karaoke: { grid: boxRoom(12, 9), light: 0.45, floor: 'carpet', ceil: 'disco', wall: karaokeWall,
    props: r => {
      const p = [SP(6, 2.3, 4, 0.3, ART.stage, (c, row, L) => C(BRICK, L * 2)),
                 SP(6, 2.25, 0.6, 1.75, ART.singer, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? r.neon : GRAY, 14), 0.3),
                 SP(3.5, 2.3, 0.6, 0.9, ART.speaker, (c, row, L) => C(GRAY, L * 2)), SP(8.5, 2.3, 0.6, 0.9, ART.speaker, (c, row, L) => C(GRAY, L * 2))];
      for (let k = 0; k < 6; k++) if (chance(barCrowd())) p.push(sitting(2.5 + Math.random() * 7, 4.5 + Math.random() * 2.5, shirt(), 0.35, true));
      return p;
    } },
  petshop: { grid: boxRoom(10, 8), light: 0.8, floor: 'tile', ceil: 'strip', sign: true, wall: petWall, keeper: [5, 1.05],
    props: r => [SP(5, 1.7, 3.2, 1.05, ART.counter, wood), standing(5, 1.05, r.neon),
                 SP(2.2, 4, 0.8, 0.8, ART.cage, (c, row, L) => C(c === 'o' ? YEL : GRAY, L)), SP(7.8, 4, 0.8, 0.8, ART.cage, (c, row, L) => C(c === 'o' ? YEL : GRAY, L)),
                 SP(4.2, 5.3, 0.6, 0.6, ART.dog, (c, row, L) => C(BRICK, L * 1.3))] },
  florist: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, glyphs: '*@&%', wall: floristWall, keeper: [5, 1.05],
    props: r => {
      const p = [SP(5, 1.7, 3.2, 1.05, ART.counter, wood), standing(5, 1.05, r.neon)];
      for (let k = 0; k < 7; k++) {
        const x = 1.5 + Math.random() * 7, y = 2.8 + Math.random() * 2.6, bloom = ITEM_COL[k & 7];
        p.push(chance(0.5) ? SP(x, y, 0.7, 1.3, ART.plant, plantCol) : SP(x, y, 0.6, 0.8, ART.bouquet, (c, row, L) => C(row === 0 ? bloom : row === 1 ? GREEN : BRICK, L * 1.3)));
      }
      return p;
    } },
  station: { grid: STATION_GRID, light: 1, floor: 'station', ceil: 'strip', wall: stationWall, block: (x, y) => y > 5.2,
    props: r => {
      const p = [];
      for (const x of [7.5, 12.5, 17.5, 22.5]) p.push(SP(x, 1.5, 1.6, 0.5, ART.bench, wood));
      for (let k = 0; k < 4; k++) p.push(standing(3 + Math.random() * 24, 3 + Math.random() * 1.6, shirt()));
      return p;
    } },
  train: { grid: boxRoom(22, 5, {}, false), light: 1, floor: 'train', ceil: 'strip', wall: trainWall,
    props: r => {
      const p = [];
      for (const x of [3, 8, 13, 18]) for (const y of [1.3, 3.7]) {
        p.push(SP(x, y, 3.6, 0.55, ART.longSeat, (c, row, L) => C(row === 1 ? BLUE : GRAY, L)));
        if (chance(0.35)) p.push(sitting(x - 1 + Math.random() * 2, y + (y < 2 ? 0.03 : -0.03), shirt(), 0.3));
      }
      for (const x of [5.5, 10.5, 15.5]) p.push(SP(x, 2.5, 0.1, 3, ART.pole, (c, row, L) => C(WHITE, L)));
      return p;
    } },
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
  if (p < 6) return -30 + 45 * (1 - (1 - p / 6) ** 2);
  if (p < 18) return 15;
  if (p < 24) return 15 + 60 * ((p - 18) / 6) ** 2;
  return null;
}
const trainStopped = r => { const p = mod(T - r.t0, TRAIN_CYCLE); return p >= 6 && p < 18; };

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
function laundryWall(i, u, uStep, z, d, mx, my, L) { // a row of washing machines with spinning drums
  if (z >= 1.9 || !(my === 0 || mx === 0 || mx === room.W - 1)) return false;
  const n = Math.floor(u / 0.75), fu = fract(u / 0.75), du = (fu - 0.5) * 0.75, dz = z - 0.85, rr = Math.hypot(du, dz);
  if (fu < 0.05 || z < 0.1) { set(i, '|', C(GRAY, L)); return true; }
  if (rr < 0.2) { const ang = mod(Math.atan2(dz, du) + T * 6 * (n & 1 ? 1 : -1), 6.283); set(i, '@o.'[ang / 2.1 | 0], C(ITEM_COL[n & 7], L)); return true; }
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
  const far = my === room.H - 1; // the tunnel wall across the tracks
  const u0 = Math.floor((u - 2) / 8) * 8 + 6;
  if (z > 1.55 && z < 1.95 && (my === 0 || far)) { // name band, repeated along the platform
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

function roomWall(i, u, uStep, z, h, d, side, mx, my, fog) {
  const R = room, D = R.def, c = roomAt(mx, my), L = fog * (side ? 10 : 14) * D.light;
  BG[i] = NONE;
  if (c === 'D') { // the way out: glass doors, or stairs up from the subway
    if (R.kind === 'station') {
      if (z > 2.3) return wallText(i, u, uStep, z, d, 'EXIT', 2, 2.55, 0.25, 0.4, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
      set(i, fract(z / 0.25) < 0.2 ? '_' : ' ', C(GRAY, L)); BG[i] = C(GRAY, 1 + (z * 2 | 0)); return;
    }
    if (z > 2.3) return set(i, '=', C(GRAY, L));
    return fract(u) < 0.08 ? set(i, '|', C(GRAY, L)) : set(i, ':', C(day > 0.3 ? CYAN : WARM, 6 + day * 6));
  }
  if (c === 'E') { // elevator
    if (z > 2.25) return wallText(i, u, uStep, z, d, 'ROOF ^', D.ex, 2.5, 0.18, 0.3, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
    BG[i] = C(GRAY, 2);
    return set(i, Math.abs(u - D.ex) < 0.04 ? '|' : ':', C(GRAY, L * 1.2));
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
  switch (room.def.floor) {
    case 'wood': return set(i, fract(wy * 3) < 0.12 ? '=' : (r + x) & 1 ? '.' : ' ', C(BRICK, L * 1.3));
    case 'carpet': { const h = hash(Math.floor(wx * 3), Math.floor(wy * 3), 77); return set(i, h > 0.85 ? '*' : h > 0.7 ? '+' : h > 0.55 ? '.' : ' ', C(NEON[h * 40 & 3], L * 2.5)); }
    case 'train': return set(i, fract(wx * 4) < 0.2 ? '|' : ' ', C(GRAY, L));
    case 'rubber': return set(i, (r * 7 + x * 3) % 11 ? ' ' : '.', C(GRAY, L));
    case 'marble': BG[i] = (Math.floor(wx) + Math.floor(wy)) & 1 ? C(WHITE, 2 + f * 3) : C(GRAY, 1); return set(i, ' ', 0);
    case 'station':
      if (wy > 5.3) { // track bed: rails, sleepers, gravel
        if (Math.abs(wy - 6.3) < 0.05 || Math.abs(wy - 7.5) < 0.05) return set(i, '=', C(GRAY, L * 1.8));
        if (wy > 6.3 && wy < 7.5 && fract(wx / 0.6) < 0.25) return set(i, '#', C(BRICK, L));
        return set(i, (r + x) % 3 ? ' ' : '.', C(GRAY, L * 0.5));
      }
      if (wy > 5.0) return set(i, '=', C(YEL, L * 2)); // mind the gap
    // fall through: platform tiles
    default: {
      const edge = fract(wx) < 0.06 || fract(wy) < 0.06;
      set(i, edge ? '+' : (Math.floor(wx) + Math.floor(wy)) & 1 ? '.' : ' ', C(edge ? GRAY : WHITE, L));
    }
  }
}
function roomCeil(i, r, x, rx, ry) {
  const d = (3 - eye) * projY / (hor - r - 0.5), wx = px + rx * d, wy = py + ry * d;
  ZB[i] = d; FL[i] = 0;
  const st = room.def.ceil;
  if (st === 'pendant') { // warm hanging lamps on a 2m grid
    const on = Math.hypot(fract(wx / 2) - 0.5, fract(wy / 2) - 0.5) < 0.07;
    return set(i, on ? 'o' : (r + x) % 4 ? ' ' : '.', on ? C(WARM, 15) : C(BRICK, 2));
  }
  if (st === 'disco') { // spots of coloured light sweeping across the ceiling
    const on = hash(Math.floor(wx * 3), Math.floor(wy * 3), 9) > 0.88;
    return set(i, on ? '*' : ' ', C(NEON[(Math.floor(wx * 3 + wy * 2 + T * 3)) & 3], 15));
  }
  if (st === 'dark') return set(i, hash(Math.floor(wx * 2), Math.floor(wy * 2), 9) > 0.93 ? '.' : ' ', C(MAG, 4));
  const strip = fract(wx / 2.5) < 0.18 && wy > 0.6 && wy < room.H - 0.6; // fluorescent tubes
  set(i, strip ? '=' : (r + x) % 3 ? ' ' : '.', strip ? C(WHITE, 15) : C(GRAY, 3));
}
function roomSprites() {
  for (const s of room.props) drawArt(s.x - px, s.y - py, s.z, s.w, s.h, typeof s.art === 'function' ? s.art() : s.art, s.col);
  if (room.kind === 'station') {
    const tx = trainX(room);
    if (tx !== null) drawArt(tx - px, 6.9 - py, 0, 26, 3, ART.train, (c, row, L) =>
      c === '#' ? C(CYAN, 14) : c === '=' ? C(ORANGE, Math.max(L, 10)) : c === 'O' ? C(GRAY, 6) : C(WHITE, Math.max(L, 9)));
  }
}
const ROOMW = { cell: (x, y) => { const c = roomAt(x, y); return c === '.' ? 0 : c === 'S' ? 2.2 : 3; },
                wall: roomWall, floor: roomFloor, sky: roomCeil, sprites: roomSprites };

