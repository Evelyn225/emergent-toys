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
// A subway station, with 3m of headroom above the upper stair landing. The platform (x 9..36, y 7..11) has the track (y 12..13) running on into a tunnel at
// either end and pillars down the middle. Behind its back wall (row 6) a 3m-wide stairwell (x 10..12) climbs away
// from the platform, set into the rock, up to the street (the 'D' at the top, row 0).
const STATION_W = 46, STATION_STAIRS = { x0: 10, x1: 13, y0: 1, y1: 7, rise: 2.6 };
const STATION_H = STATION_STAIRS.rise + 3;
const STATION_EXIT_H = 0.3, STATION_EXIT_Z = STATION_H - STATION_EXIT_H / 2 - 0.06;
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
                   CINEMA: 'cinema', HOTEL: 'hotel', GYM: 'gym', BARBER: 'barber',
                   BANK: 'bank', 'PET SHOP': 'petshop', FLORIST: 'florist' };
const LYRICS = ['SWEET CAROLINE', 'BAH BAH BAH', 'SO GOOD SO GOOD SO GOOD', 'SWEET CAROLINE']; // what the karaoke bar's playing (audio/ascii-city/karaoke.mp3)
for (const w in MENUS) ROOM_FOR[w] = 'diner';
ROOM_FOR.CAFE = 'cafe'; // (COFFEE has the roastery: dining.js)
ROOM_FOR.BOOKS = 'books'; // (the record shop has its own: shops.js)
ROOM_FOR.RAMEN = 'noodle'; // (NOODLES has the noodle house: dining.js)
ROOM_FOR['AUTO REPAIR'] = 'garage';
ROOM_FOR['TEA HOUSE'] = 'tea';
ROOM_FOR.HOSPITAL = 'hospital';
ROOM_FOR.CARS = 'showroom'; ROOM_FOR.REALTY = 'realty';
ROOM_FOR.STORAGE = 'storage';

// a room's bathroom (def.wc): its own little room off the floor, 'W' walls round it with a doorway, white tiles inside.
// sign: the wall cell the WC sign goes on (mx, my) and where along it
const inWc = (x, y, w = room && room.def.wc) => !!w && x >= w.x0 && x < w.x1 && y >= w.y0 && y < w.y1;
// is this face of wall cell (mx, my) (side: 0 an x-face, 1 a y-face) one that faces into the bathroom? Then it's tiled,
// from wherever you see it (through the doorway too), and the face on the other side of the same wall isn't
const wcFaceInside = (mx, my, side, w = room.def.wc) => !!w && (side ? inWc(mx + 0.5, my + (py < my ? -0.5 : 1.5), w) : inWc(mx + (px < mx ? -0.5 : 1.5), my + 0.5, w));
// a washbasin on its pedestal, its back to the wall behind (-fx, -fy), a mirror over it
const washbasin = (x,y,fx,fy) => BATHROOM_SINK(x,y,fx,fy);
// A hollow oval enamel bath, with supported shell and a fitted tap.
const BATHTUB = (x,y) => BATHROOM_TUB(x,y);
// a bathroom wall from inside: white tiles to shoulder height (thin grout lines), a trim, painted plaster above
function wcWall(i, u, z, L) {
  if (z > 1.3) { BG[i] = C(WHITE, 1.7 + L * 0.1); return set(i, ' ', 0); }
  if (z > 1.22) { BG[i] = C(BLUE, 2.5 + L * 0.15); return set(i, '=', C(WHITE, L * 0.5)); }
  BG[i] = C(WHITE, 2.6 + L * 0.12);
  const gu = fract(u * 4) < 0.05, gz = fract(z * 4) < 0.05;
  return set(i, z < 0.1 ? '_' : gu && gz ? '+' : gz ? '-' : gu ? '|' : ' ', C(GRAY, L * 0.3));
}
function roomAt(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  return room?.grid[y]?.[x] ?? '#'; // Cell centres and out-of-bounds search rays are safe.
}
// floors and ceilings beyond the ones roomFloor and roomCeil know, by name: (i, f, wx, wy, r, x, L) and (i, r, x, wx, wy)
// (shops.js has the specialist shops')
const ROOM_FLOORS = {}, ROOM_CEILS = {};
// props
const SP = (x, y, w, h, art, col, z = 0) => ({ x, y, w, h, art, col, z });
// people (figures.js): standing about looking at you, or sitting (back: facing -y, the bar or the stage or the screen)
const standing = (x, y, shirt) => figProp(x, y, figAnyone(shirt));
const sitting = (x, y, shirt, z = 0.45, back = false) => figProp(x, y, figAnyone(shirt), { pose: 'sit', seatZ: z, face: back ? [0, -1] : null });
const wood = (c, row, L) => C(c === '$' ? GREEN : BRICK, L);
const shirt = () => pick([RED, BLUE, GREEN, MAG, ORANGE, WHITE, YEL, CYAN]);
const chance = p => Math.random() < p;
// how full the bars are: near empty in the afternoon, packed late at night
const barCrowd = () => { const h = mod(tod - 16, 24); return h < 12 ? 0.15 + 0.8 * Math.min(1, h / 7) : 0.1; };

// ---- furniture as real boxes (see drawBox), in metres. BX(x, y, half length, half width, z0, z1, shade, cos, sin):
// the long side runs along (cos, sin). Benches are their own kind ({ bench }), drawn by drawBench.
const BX = (x, y, hl, hw, z0, z1, shade, ca = 1, sa = 0) => ({ box: { x, y, c: ca, s: sa, hl, hw, z0, z1 }, shade });
const BENCHP = (x,y,fx,fy) => ({...FURNITURE_BENCH(x,y,.75,fx,fy,BRICK,true),bench:true,fx,fy,h:.45});
// somewhere you can sit (C), on whatever's drawn there: facing (fx, fy) (none: whichever way you were), the seat h high
const SEAT = (x, y, fx, fy, h = 0.45) => ({ seat: true, x, y, fx, fy, h });
// a sofa facing (fx, fy), hl long either side of (x, y): the cushions, the back, an arm at each end, three places on it
const couch = (x, y, hl, fx, fy, col = BRICK) => {
  const ax=-fy,ay=fx,at=(u,v)=>[x+ax*u+fx*v,y+ay*u+fy*v];
  return [ROOM_MODEL(x,y,(vx,vy)=>drawFurnitureSofa(vx,vy,hl,fx,fy,col),[Math.abs(ax)*hl+Math.abs(fx)*.4,Math.abs(ay)*hl+Math.abs(fy)*.4,.94]),
  ...[-.55,0,.55].map(k=>{const [sx,sy]=at(k*hl,.06);return SEAT(sx,sy,fx,fy,.48);})];
};
// a round pouffe, h high, to perch on facing (fx, fy)
const POUF = (x,y,col,fx,fy,h=.4) => FURNITURE_POUF(x,y,col,fx,fy,h);
// people in some of the seats among props p, facing the way each seat does: each one taken with chance odds
const fillSeats = (p, odds) => { for (const s of p.slice()) if (s.seat && s.fx != null && chance(odds)) p.push({ ...sitting(s.x, s.y, shirt(), s.h ?? 0.45), face: [s.fx, s.fy] }); return p; };
// ---- room furniture in 3D (metres). Each is a prop { x, y, draw(vx, vy) } drawn from where you are.
// foot: [half length, half width, height] of what blocks you, as furniture boxes do (none: you walk over or through it).
// far: a plain shade for that box, for when it's seen from outside at the city's scale (a balcony's plant from the street)
const ROOM_MODEL = (x, y, draw, foot, far) => ({ x, y, draw, ...(foot && { box: { x, y, c: 1, s: 0, hl: foot[0], hw: foot[1], z0: 0, z1: foot[2] } }), ...(far && { far }) });
const drum = (vx, vy, r, z0, z1, shade) => drawBox(boxAt(vx, vy, 1, 0, r, r, z0, z1), shade, rayCopperDrum);
const drumLit = r => 0.55 + 0.45 * Math.max(0, (-HIT.u * 0.55 + HIT.v * 0.35) / r); // (lit from over your left shoulder, as everything is)
const CHROME = (i, t, L) => { BG[i] = C(GRAY, 3 + L * 0.5); return set(i, ' ', 0), true; };
// a potted plant: a terracotta pot with a rim, and a bush of leaves round a stem (h: how tall, seed: its shape)
const POT_PLANT = (x, y, h = 1.3, seed = x * 7 + y, solid = true) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, 0.16, 0, 0.3, (i, t, L) => { if (HIT.face === 5) { BG[i] = C(BRICK, 0.8); return set(i, '.', C(BRICK, L * 0.5)), true; } BG[i] = C(ORANGE, (1.6 + L * 0.3) * drumLit(0.16)); return set(i, ' ', 0), true; });
  drum(vx, vy, 0.185, 0.27, 0.33, (i, t, L) => { if (HIT.face === 5) return false; BG[i] = C(ORANGE, (2.1 + L * 0.35) * drumLit(0.185)); return set(i, '=', C(BRICK, L * 0.7)), true; });
  rod(vx, vy, 0.3, vx, vy, h * 0.7, 0.012, BRICK, 0.8);
  for (let k = 0; k < 7; k++) {
    const a = hash(seed, k, 4401) * Math.PI * 2, rr = 0.13 + hash(seed, k, 4403) * 0.07, r = Math.min(rr * 0.8, 0.05 + hash(seed, k, 4402) * 0.1), z = 0.5 + (h - 0.65) * (k + 0.5) / 7, tone = 0.75 + hash(seed, k, 4404) * 0.5; // (each clump touching the stem, the bush within 0.3m of it)
    dot(vx + Math.cos(a) * r, vy + Math.sin(a) * r, z, rr, (i, t, L) => { BG[i] = C(GREEN, (1.4 + L * 0.3) * tone); return set(i, k & 1 ? '%' : '&', C(GREEN, L * 0.55 * tone)), true; });
  }
}, solid && [0.19, 0.19, h], (i, t, L) => { BG[i] = HIT.w < 0.3 ? C(ORANGE, 2 + L * 0.3) : C(GREEN, 1.5 + L * 0.3); return set(i, HIT.w < 0.3 ? ' ' : '&', C(GREEN, L * 0.6)), true; });
// a bar stool: a padded seat on a chrome post, a ring for your feet, a round base. seatZ: the top of the cushion
const STOOL = (x,y,col=RED,seatZ=.62) => FURNITURE_STOOL(x,y,col,seatZ);
// the jukebox, facing (fx, fy): a rounded top in slices, neon tubes up its front cycling colour, the record turning in
// its lit window, a speaker grille below, wood sides with a chrome edge
const JUKEBOX = (x, y, fx, fy) => ROOM_MODEL(x, y, (vx, vy) => {
  const hw = 0.45, hl = 0.25, top = 1.15, ax = -fy, ay = fx;
  const front = (i, t, L, w, v) => {
    const neon = k => C(NEON[(k + Math.floor(T * 2)) & 3], 13);
    if (w > 0.72) { const d = Math.hypot(v, w - 0.95); BG[i] = C(CYAN, 2 + 2 * (d < 0.15)); return set(i, d < 0.15 ? (Math.abs(fract(Math.atan2(w - 0.95, v) / Math.PI + T) - 0.5) < 0.1 ? '-' : '@') : ':', C(WHITE, 13)), true; } // the record, turning
    if (Math.abs(Math.abs(v) - 0.3) < 0.04) { BG[i] = neon(v > 0 ? 1 : 3); return set(i, '|', C(WHITE, 15)), true; } // the neon tubes
    if (w > 0.4) { BG[i] = C(GRAY, 1.5); return set(i, fract(v * 12) < 0.4 ? 'o' : ' ', C(YEL, 12)), true; } // the buttons
    BG[i] = C(BRICK, 1.2 + L * 0.2); return set(i, '#', C(GRAY, L * 0.7)), true; // the grille
  };
  drawBox(boxAt(vx, vy, fx, fy, hl, hw, 0, top), (i, t, L) => {
    if (HIT.face === 1) return front(i, t, L, HIT.w, HIT.v);
    if (Math.abs(Math.abs(HIT.v) - hw) < 0.03 || HIT.face >= 5) { BG[i] = C(GRAY, 3 + L * 0.3); return set(i, ' ', 0), true; }
    BG[i] = C(BRICK, (1.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, '|', C(BRICK, L * 0.6)), true;
  });
  const ARCH = 24; // the arched top, in enough slices that its outline reads as a curve
  for (let k = 0; k < ARCH; k++) {
    const vm = -hw + (k + 0.5) * 2 * hw / ARCH, zt = top + Math.sqrt(Math.max(0, hw * hw - vm * vm)) * 0.7;
    drawBox(boxAt(vx + ax * vm, vy + ay * vm, fx, fy, hl, hw / ARCH, top, zt), (i, t, L) => {
      if (HIT.face === 1) { BG[i] = C(NEON[(Math.floor(k / 3) + Math.floor(T * 3)) & 3], 9 + L * 0.2); return set(i, '*', C(WHITE, 15)), true; }
      BG[i] = C(BRICK, (1.8 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true;
    });
  }
}, [Math.abs(fx) * 0.25 + Math.abs(fy) * 0.45, Math.abs(fx) * 0.45 + Math.abs(fy) * 0.25, 1.45]);
// a treadmill, the runner facing (0, -1): the deck and its moving belt, uprights up to the console, handrails
const TREADMILL = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 0, 1, 0.8, 0.36, 0, 0.18), (i, t, L) => {
    if (HIT.face === 5) { const belt = Math.abs(HIT.v) < 0.27; BG[i] = C(GRAY, belt ? 0.8 : 2.5); return set(i, belt && fract((HIT.u + T * 2.5) * 5) < 0.12 ? '-' : ' ', C(GRAY, L * 0.6)), true; }
    BG[i] = C(GRAY, (1.8 + L * 0.3) * shadeFace(HIT.face)); return set(i, '_', C(GRAY, L * 0.5)), true;
  });
  for (const e of [-1, 1]) {
    rod(vx + e * 0.32, vy - 0.65, 0.15, vx + e * 0.3, vy - 0.82, 1.15, 0.02, GRAY, 1.2);
    rod(vx + e * 0.3, vy - 0.78, 1.0, vx + e * 0.32, vy - 0.35, 0.95, 0.015, GRAY, 1.2);
  }
  drawBox(boxAt(vx, vy - 0.85, 0, 1, 0.08, 0.36, 1.05, 1.28), (i, t, L) => {
    if (HIT.face === 1) { BG[i] = C(CYAN, 2.5); return set(i, fract(HIT.v * 10 + T) < 0.3 ? '#' : ':', C(WHITE, 12)), true; }
    BG[i] = C(GRAY, (1.5 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true;
  });
}, [0.36, 0.9, 1.28]);
// a dumbbell rack against the wall: a frame of two shelves, a row of dumbbells on each, the heavy ones at the end
const WEIGHT_RACK = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  for (const e of [-1, 1]) rod(vx + e * 0.88, vy, 0, vx + e * 0.88, vy, 0.95, 0.025, GRAY, 1.1);
  for (const z of [0.35, 0.75]) for (const d of [-0.12, 0.12]) rod(vx - 0.88, vy + d, z, vx + 0.88, vy + d, z, 0.015, GRAY, 1.1);
  for (const z of [0.35, 0.75]) for (let k = 0; k < 7; k++) {
    const x0 = vx - 0.72 + k * 0.24, r = 0.045 + k * 0.006 + (z > 0.5 ? 0 : 0.012), col = k & 1 ? GRAY : BRICK;
    rod(x0, vy - 0.12, z + r, x0, vy + 0.12, z + r, 0.012, GRAY, 1.2);
    for (const e of [-1, 1]) drawRod(x0, vy + e * 0.07, z + r, x0, vy + e * 0.11, z + r, r, (i, t, L) => { BG[i] = C(col, 1.2 + L * 0.3); return set(i, 'O', C(GRAY, L * 0.5)), true; });
  }
}, [0.9, 0.2, 0.95]);
// a barber's pole: a glass drum with red, white and blue spiralling up it, chrome caps, a bracket to the wall
const BARBER_POLE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // (on the west wall, x = 1)
  drum(vx, vy, 0.08, 0.5, 1.45, (i, t, L) => {
    const k = mod(Math.floor((Math.atan2(HIT.v, HIT.u) / (Math.PI * 2) + HIT.w * 3 - T * 0.8) * 3), 3);
    BG[i] = C([RED, WHITE, BLUE][k], (k === 1 ? 6 : 3) * drumLit(0.08) + L * 0.2); return set(i, ' ', 0), true;
  });
  for (const z of [0.44, 1.51]) drum(vx, vy, 0.1, z - 0.06, z, CHROME);
  dot(vx, vy, 1.56, 0.07, CHROME);
  rod(vx, vy, 1.0, vx - (x - 1), vy, 1.0, 0.015, GRAY, 1.2); // its bracket, back to the wall
}, [0.12, 0.12, 1.6]);
// a barber's chair, facing (0, -1): chrome base and column, a red padded seat and back, a headrest, arms, a footrest
const BARBER_CHAIR = (x, y) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  const red = (i, t, L) => { BG[i] = C(RED, (2 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? ' ' : fract(HIT.w * 14) < 0.15 ? '-' : ' ', C(RED, L * 0.5)), true; };
  drum(vx, vy, 0.25, 0, 0.05, CHROME);
  drum(vx, vy, 0.07, 0.05, 0.3, CHROME);
  drawBox(boxAt(vx, vy, 1, 0, 0.26, 0.25, 0.3, 0.45), red);
  drawBox(boxAt(vx, vy + 0.27, 1, 0, 0.26, 0.06, 0.4, 1.05), red);
  drawBox(boxAt(vx, vy + 0.28, 1, 0, 0.12, 0.06, 1.1, 1.25), red);
  rod(vx, vy + 0.28, 1.05, vx, vy + 0.28, 1.1, 0.015, GRAY, 1.2);
  for (const e of [-1, 1]) { drawBox(boxAt(vx + e * 0.3, vy - 0.02, 1, 0, 0.04, 0.24, 0.58, 0.63), CHROME); rod(vx + e * 0.3, vy - 0.18, 0.45, vx + e * 0.3, vy - 0.18, 0.58, 0.012, GRAY, 1.2); }
  drawBox(boxAt(vx, vy - 0.42, 1, 0, 0.18, 0.06, 0.13, 0.17), CHROME);
  for (const e of [-1, 1]) rod(vx + e * 0.12, vy - 0.42, 0.15, vx + e * 0.12, vy - 0.2, 0.32, 0.012, GRAY, 1.2);
}, [0.34, 0.3, 1.25]), seat: true, fx: 0, fy: -1, h: 0.45 });
// a PA speaker on the floor, facing (0, 1): a black cabinet, the woofer and tweeter on its front in rings
const SPEAKER = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, 0.28, 0.2, 0, 0.9), (i, t, L) => {
    BG[i] = C(GRAY, (0.8 + L * 0.15) * shadeFace(HIT.face));
    if (HIT.face !== 3) return set(i, ' ', 0), true;
    for (const [w, r] of [[0.3, 0.17], [0.7, 0.07]]) { const d = Math.hypot(HIT.u, HIT.w - w); if (d < r) { BG[i] = C(GRAY, d > r * 0.8 ? 2.5 : d < r * 0.25 ? 2 : 0.4); return set(i, d > r * 0.8 ? 'o' : ' ', C(GRAY, L)), true; } }
    return set(i, ' ', 0), true;
  });
}, [0.28, 0.2, 0.9]);
// a bouquet in a glass vase: stems fanning up, a flower head on each in the bloom's colour
const BOUQUET = (x, y, bloom) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, 0.09, 0, 0.32, (i, t, L) => { BG[i] = C(CYAN, (1.6 + L * 0.3) * drumLit(0.09)); return set(i, HIT.face === 5 ? '~' : ':', C(WHITE, L * 0.6)), true; });
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + x, r = 0.05 + (k % 3) * 0.035, z = 0.48 + (k % 3) * 0.06, tx = vx + Math.cos(a) * r, ty = vy + Math.sin(a) * r;
    rod(vx, vy, 0.28, tx, ty, z, 0.004, GREEN, 0.9);
    dot(tx, ty, z + 0.02, 0.035, (i, t, L) => { BG[i] = C(k === 3 ? YEL : bloom, 3 + L * 0.4); return set(i, '*', C(WHITE, L * 0.6)), true; });
  }
});
// a grab pole, floor to ceiling
const GRAB_POLE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => rod(vx, vy, 0, vx, vy, room.def.height || 3, 0.02, WHITE, 1.1), [0.03, 0.03, 3]); // (floor to ceiling)
// a coil of rope lying flat on the floor, a sailor's coil: one rope spiralling in from its outer end, each turn lying
// against the last, its loose end trailing off into the room. One surface from one distance function (the spiral and
// the tail together), traced per cell, so the turns never overlap and it's lit and twisted continuously along its length.
const COIL = { r: 0.026, R0: 0.3, turns: 4.3 }, COIL_B = 2 * COIL.r; // (b: how far in each turn steps: one rope's width)
const COIL_TAIL = [[COIL.R0, 0], [COIL.R0 + 0.1, 0.18], [COIL.R0 + 0.04, 0.34], [COIL.R0 + 0.1, 0.46]];
function coilDist(x, y, z) { // distance to the rope's surface, and where along it: [d, along, round]
  const rho = Math.hypot(x, y), th = mod(Math.atan2(y, x), Math.PI * 2) / (Math.PI * 2), zc = z - COIL.r;
  let best = Infinity, along = 0, round = 0;
  const k0 = Math.round((COIL.R0 - rho) / COIL_B - th);
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    const sp = clamp(th + k, 0, COIL.turns), rs = COIL.R0 - COIL_B * sp, a = sp * Math.PI * 2;
    const d = Math.hypot(x - rs * Math.cos(a), y - rs * Math.sin(a), zc) - COIL.r;
    if (d < best) { best = d; along = sp * Math.PI * 2 * (COIL.R0 - COIL_B * sp / 2); round = Math.atan2(zc, rho - rs); }
  }
  for (let k = 1; k < COIL_TAIL.length; k++) { // the loose end
    const [ax, ay] = COIL_TAIL[k - 1], [bx, by] = COIL_TAIL[k], ex = bx - ax, ey = by - ay, q = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey), 0, 1);
    const cx = ax + ex * q, cy = ay + ey * q, d = Math.hypot(x - cx, y - cy, zc) - COIL.r;
    if (d < best) { best = d; along = -(k - 1 + q) * 0.2; round = Math.atan2(zc, (x - cx) * -ey + (y - cy) * ex); }
  }
  return [best, along, round];
}
function rayCoil(ox, oy, oz, rx, ry, rz, b) { // sphere-traced through its bounding box; HIT.u, v, w: the point, local
  const qx = ox - b.x, qy = oy - b.y, n = Math.hypot(rx, ry, rz);
  let t0 = 0.01, t1 = Infinity;
  for (const [o, d, lo, hi] of [[qx, rx, -b.hl, b.hl], [qy, ry, -b.hw, b.hw], [oz, rz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return -1; continue; }
    const a = (lo - o) / d, c = (hi - o) / d; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
  }
  if (t0 > t1) return -1;
  for (let t = t0, k = 0; k < 64 && t <= t1; k++) {
    const x = qx + rx * t, y = qy + ry * t, z = oz + rz * t, [d] = coilDist(x, y, z);
    if (d < Math.max(0.0008, 0.35 * t / projX)) { HIT.u = x; HIT.v = y; HIT.w = z; HIT.face = 0; return t; } // (half a cell thick at least, far off)
    t += Math.max(d, 0.0005) / n;
  }
  return -1;
}
const ROPE_COIL = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox({ x: vx + 0.03, y: vy + 0.08, c: 1, s: 0, hl: COIL.R0 + COIL.r + 0.12, hw: COIL.R0 + COIL.r + 0.26, z0: 0, z1: 2 * COIL.r + 0.002 }, (i, t, L) => {
    const lx = HIT.u + 0.03, ly = HIT.v + 0.08, z = HIT.w, e = 0.002, [, along, round] = coilDist(lx, ly, z);
    const gx = coilDist(lx + e, ly, z)[0] - coilDist(lx - e, ly, z)[0], gy = coilDist(lx, ly + e, z)[0] - coilDist(lx, ly - e, z)[0], gz = coilDist(lx, ly, z + e)[0] - coilDist(lx, ly, z - e)[0];
    const gn = Math.hypot(gx, gy, gz) || 1, light = 0.18 + 0.82 * Math.max(0, (-gx * 0.35 + gy * 0.25 + gz * 0.9) / gn / 1.0); // (the tops of the turns catch the light, the grooves between them don't)
    const ridge = Math.max(0, Math.sin(round)), strand = fract(along / (COIL.r * 3) + round / Math.PI) < 0.3; // each turn a ridge, dark down its sides; the twist, faint
    BG[i] = C(WARM, (0.6 + 4 * ridge * ridge) * (0.7 + 0.3 * light) * (strand ? 0.88 : 1) + L * 0.08);
    return set(i, ' ', 0), true;
  }, rayCoil);
});
// a pet shop's cage on its stand: wire bars all round you can see through, a tray at the bottom, a little one inside
// (look, pose: its figure and pose key; h: its height, as built at scale 1)
const CAGE_BARS = (i, t, L) => {
  const f = HIT.face, edge = f >= 5 || fract((f <= 2 ? HIT.v : HIT.u) * 22) < 0.18 || HIT.w > 1.17 || HIT.w < 0.76;
  if (!edge) return false;
  BG[i] = C(GRAY, (2.5 + L * 0.35) * shadeFace(f)); return set(i, f >= 5 ? '#' : HIT.w < 0.76 ? '=' : '|', C(WHITE, L * 0.8)), true;
};
const petCage = (x, y, look, pose, h) => [BX(x, y, 0.42, 0.32, 0, 0.7, solid(BRICK, { top: '=', trim: 0.68 })), BX(x, y, 0.38, 0.28, 0.7, 1.2, CAGE_BARS),
  figProp(x, y, look, { z: 0.72, h: h / look.scale(+pose().slice(1)), pose, face: [0, 0], chat: false, light: 8 })];
// a solid shade: base colour, panel lines every `panel` metres on the sides, a trim at the top, `top` char on top
const solid = (base, { panel = 0, top = ' ', trim = 0, bright = 1 } = {}) => (i, t, L) => {
  const f = HIT.face;
  BG[i] = C(base, (1 + L * 0.35 * bright) * shadeFace(f));
  if (f === 5) return set(i, top, C(base, L * 0.9)), true;
  if (trim && HIT.w > trim) return set(i, '=', C(base, L)), true;
  const along = f <= 2 ? HIT.v : HIT.u;
  return set(i, panel && Math.abs(fract(along / panel) - 0.5) < 0.06 ? '|' : ' ', C(base, L * 0.6)), true;
};
const counterBox = (x,y,half,z1=1.05) => [FURNITURE_COUNTER(x,y,half,z1),FURNITURE_REGISTER(x-half*.6,y,z1)];
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
    const lumpy = HIT.w > 0.72 && hash(Math.floor(HIT.u * 9), Math.floor(HIT.v * 9), 7) > 0.6;
    BG[i] = C(ITEM_COL[k * 8 | 0], (lumpy ? 1.5 : 1.2) + L * 0.3 * shadeFace(HIT.face));
    return set(i, lumpy ? (k > 0.55 ? '~' : '_') : k > 0.85 ? '~' : ' ', C(WHITE, L * 0.6)), true;
  }), ...[-1, 1].flatMap(sx => [-1, 1].map(sy => BX(x + sx * 0.3, y + sy * 0.2, 0.03, 0.03, 0, 0.12, (i, t, L) => (set(i, 'o', C(GRAY, L)), true))))];
};
const tableBox = (x, y, hl = 0.6, hw = 0.4) => [ROOM_MODEL(x,y,(vx,vy)=>drawFurnitureTable(vx,vy,hl,hw),[hl,hw,.78])];
const inBox = (b, x, y, pad) => { const qx = x - b.x, qy = y - b.y; return Math.abs(qx * b.c + qy * b.s) < b.hl + pad && Math.abs(-qx * b.s + qy * b.c) < b.hw + pad; };


// ---- new interiors' walls
function hotelRoomWall(i, u, uStep, z, d, mx, my, L) { // a window onto the city, its sky following the time of day
  const width = room.suite ? 2.65 : 1.6;
  if (my !== 0 || Math.abs(u - room.W / 2) > width || z < 0.9 || z > 2.3) return false;
  const du = u - room.W / 2;
  if (Math.abs(du) > width - 0.15 || z < 0.97 || z > 2.23 || Math.abs(du) < 0.04) { set(i, Math.abs(du) > width - 0.15 ? '|' : '=', C(GRAY, L)); BG[i] = C(WARM, 2); return true; } // frame
  if(room.exterior)homeView(i,u,z,'north');else viewOut(i,u,z,room.suite?22:14,18);return true; // six floors up, across the avenue
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
  const board = room.def.keeper[0];
  if (my === 0 && Math.abs(u - board) < 2 && z > 1.4 && z < 2.5) {
    BG[i] = C(GRAY, 1);
    for (const [k, item] of ['ESPRESSO 3', 'LATTE 4', 'CROISSANT 3', 'COOKIE 2'].entries())
      if (wallText(i, u, uStep, z, d, item, board, 2.3 - k * 0.25, 0.15, 0.2, C(WHITE, 13), C(GRAY, 1))) return true;
    set(i, ' ', 0); return true;
  }
  if (z < 2.6) { set(i, fract(u * 4 + (Math.floor(z * 8) & 1) * 0.5) < 0.12 ? '|' : '_', C(BRICK, L * 0.7)); BG[i] = C(BRICK, 1); return true; }
  return false;
}
function booksWall(i, u, uStep, z, d, mx, my, L) { // floor-to-ceiling shelves of coloured spines
  if (z > 2.6 || (my === room.H - 1)) return false;
  if (fract(z / 0.42) < 0.12) { set(i, '=', C(BRICK, L)); return true; }
  const k = hash(Math.floor(u * 14), Math.floor(z / 0.42), mx * 7 + my);
  set(i, k > 0.15 ? '|' : ' ', C(ITEM_COL[k * 80 & 7], L)); BG[i] = C(BRICK, 1); return true;
}
function noodleWall(i, u, uStep, z, d, mx, my, L) { // the open kitchen: steam rising off the pots, red walls hung with signs
  if (my === 0 && mx < 11 && z < 2.4) {
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


const homeLayout = r => r.def.home;
const ROOM_DEFS = {
  store: { grid: ['##########', '#........#', '#.SS..SS.#', '#........#', '#.SS..SS.#', '#........#', '#........#', '####DD####'],
    light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, posters: true, keeper: [5, 1.4],
    props: r => [...counterBox(5, 1.7, 1.6), standing(5, 1.4, r.neon)] },
  bar: { grid: boxRoom(12, 8, { '1,4': 'W', '3,4': 'W', '3,5': 'W', '3,6': 'W' }), wc: { x0: 1, y0: 5, x1: 3, y1: 7, sign: [1, 4, 1.5] }, light: 0.6, floor: 'wood', ceil: 'pendant', shelves: true, sign: true, neon: true, glyphs: 'il!Y', keeper: [6, 1.4],
    props: r => {
      const p = [...counterBox(6, 1.8, 4, 1.1), standing(6, 1.4, r.neon),
                 JUKEBOX(10.55, 5.5, -1, 0), ...toilet(1.6, 6.4, 1, porcelain)];
      for (let x = 3; x <= 9; x += 1.5) { p.push(STOOL(x, 2.65, RED)); if (chance(barCrowd())) p.push(sitting(x, 2.7, shirt(), 0.6, true)); }
      return p;
    } },
  diner: { grid: boxRoom(12, 8, { '1,3': 'W', '2,3': 'W', '3,3': 'W', '3,1': 'W' }), wc: { x0: 1, y0: 1, x1: 3, y1: 3, sign: [3, 1, 1.5] }, light: 1, floor: 'tile', ceil: 'strip', sign: false, keeper: [6, 1.4], wall: dinerWall,
    props: r => {
      const p = [...counterBox(6, 1.75, 2), standing(6, 1.4, WHITE), ...toilet(1.6, 1.4, -1, porcelain)];
      for (const [x, y] of [[2.6, 4.2], [9.4, 4.2], [2.6, 6.2], [9.4, 6.2]]) {
        p.push(...tableBox(x, y));
        for (const s of [-0.95, 0.95]) { p.push(STOOL(x + s, y, RED)); if (chance(0.4)) p.push({ ...sitting(x + s, y - 0.02, shirt(), 0.6), face: [-Math.sign(s), 0] }); } // (on a stool, at the table)
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
        if (chance(0.7)) p.push(sitting(cx - 1.4 + Math.random() * 2.8, y + 0.05, shirt(), 0.45, true));
      }
      return p;
    } },
  // the hotel lobby: the desk, the lift up to the roof, the restrooms off to one side
  hotel: { rent: true, grid: ['#####EE#######', '#.........W..#', '#.........W..#', '#.........W..#', '#.........WW.#', '#............#', '#............#', '######DD######'],
    wc: { x0: 11, y0: 1, x1: 13, y1: 4, sign: [11, 4, 11.5] }, light: 0.9, floor: 'wood', ceil: 'pendant', sign: true, signAt: 2.6, wall: hotelWall,
    keeper: [3.2, 2.0], ex: 6,
    props: r => [BX(3.2, 2.6, 1.3, 0.35, 0, 1.1, solid(BRICK, { panel: 0.5, trim: 1.04, top: '=' })), standing(3.2, 2.0, r.neon), POT_PLANT(1.4, 1.4),
                 POT_PLANT(9.4, 1.4), POT_PLANT(12.3, 6.2, 1.4), standing(8, 4, shirt()), ...toilet(11.6, 1.4, -1, porcelain), washbasin(12.55, 1.3, 0, 1)] },
  apts: { grid: boxRoom(8, 7, { '3,0': 'E', '4,0': 'E' }), light: 0.7, floor: 'tile', ceil: 'pendant', wall: aptsWall, ex: 4,
    props: r => [POT_PLANT(6.6, 5.4), ...(chance(0.6) ? [standing(2.2, 4.4, shirt())] : [])] },
  // the gym: treadmills along the back, the ring in the far corner (gym.js) with whoever's next on the card warming up
  // in it, the weights by the door, and the trainer at the front desk
  gym: { grid: boxRoom(16, 11), light: 1, floor: 'rubber', ceil: 'strip', sign: true, wall: gymWall, keeper: [3, 7.3],
    props: r => {
      const foe = nextBoxer(), fx = GYM_RING.x + 1.1, fy = GYM_RING.y - 1.1;
      const p = [WEIGHT_RACK(10.6, 9.6), WEIGHT_RACK(12.9, 9.6), BOXING_RING(GYM_RING.x, GYM_RING.y),
        BX(3, 7.95, 1.1, 0.3, 0, 1.05, solid(GRAY, { panel: 0.5, trim: 1.04, top: '=' })), // the front desk
        figProp(3, 7.3, figAnyone(RED, { top: 'tee', bot: 'pants' }), { face: [0, 1] }), // the trainer
        figProp(fx, fy, figAnyone(foe.trunks[0], { top: 'tank', bot: 'shorts' }), { z: GYM_RING.top, face: [-1, 1], chat: false, // the next fighter, in their corner
          pose: () => (Math.floor(T * 3) & 1) ? 'run1' : 'run5' })]; // (bouncing on their toes)
      for (const x of [2, 4, 6, 8]) {
        p.push(TREADMILL(x, 2.75));
        if (chance(0.7)) { const k = Math.random() * 2, s = shirt(); // running in place
          p.push(figProp(x, 2.55, figAnyone(s, { top: pick(['tee', 'tank']), bot: 'shorts' }), { z: 0.2, face: [0, -1], chat: false, pose: () => 'run' + (Math.floor(T * 9 + k * 4) & 7) })); }
      }
      return p;
    } },
  barber: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', sign: true, wall: barberWall, keeper: [3.6, 1.9],
    props: r => {
      const p = [standing(3.6, 1.9, WHITE),
                 BARBER_POLE(1.3, 5.5)];
      for (const x of [2.5, 5, 7.5]) {
        p.push(BARBER_CHAIR(x, 1.8));
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
        if (chance(0.55)) p.push(sitting(x - 0.4, y + 0.02, shirt(), 0.45, true));
        if (chance(0.4)) p.push(sitting(x + 0.45, y + 0.02, shirt(), 0.45, true));
      }
      for (const y of [2.2, 4.4]) { // the bays: a bed with white sheets and a pillow, a curtain either side
        p.push(BX(11.6, y, 0.95, 0.42, 0.45, 0.62, (i, t, L) => { const f = HIT.face; BG[i] = C(WHITE, (2 + L * 0.3) * shadeFace(f));
          return set(i, f === 5 ? (HIT.u > 0.6 ? '@' : '~') : f === 1 || f === 2 ? '#' : '_', C(f === 5 ? WHITE : GRAY, L)), true; }));
        p.push(BX(11.6, y, 0.85, 0.32, 0, 0.45, solid(GRAY, { panel: 0.4 })));
        for (const cy of [y - 0.95, y + 0.95]) p.push(BX(12.35, cy, 0.5, 0.02, 0.2, 1.95, (i, t, L) => { // a curtain, drawn back to the wall
          BG[i] = C(CYAN, 1.5 + L * 0.12); return set(i, HIT.w > 1.86 ? 'o' : fract(HIT.u * 5) < 0.5 ? '|' : ' ', C(CYAN, L * 0.7)), true; }));
      }
      p.push(SEAT(11.3, 2.2, -1, 0, 0.62), SEAT(11.3, 4.4, -1, 0, 0.62)); // (on the edge of a bed)
      if (chance(0.6)) p.push({ ...sitting(11.3, 4.4, shirt(), 0.62), face: [-1, 0] }); // someone waiting to be seen
      p.push(BX(1.5, 8.4, 0.3, 0.3, 0, 1.4, solid(BLUE, { top: 'o', trim: 1.35 }))); // a water cooler by the door
      return p;
    } },
  bank: { grid: boxRoom(14, 9), light: 1, floor: 'marble', ceil: 'pendant', sign: true, wall: bankWall, keeper: [7, 1.5],
    props: r => [BX(7, 2.4, 4.5, 0.35, 0, 1.1, solid(WHITE, { panel: 1.5, trim: 1.04, top: '=' })),
                 BX(7, 2.3, 4.5, 0.03, 1.1, 1.95, (i, t, L) => { BG[i] = C(CYAN, 1); return set(i, Math.abs(fract(HIT.u / 1.5) - 0.5) > 0.47 ? '|' : ' ', C(GRAY, L)), true; }), // the glass
                 standing(3.5, 1.5, BLUE), standing(7, 1.5, BLUE), standing(10.5, 1.5, BLUE), standing(12.3, 6, GRAY)] },
  // karaoke: the stage and its screen, the crowd on the floor, the toilets in the back corner
  karaoke: { grid: ['##############', '#.........W..#', '#.........W..#', '#.........WW.#', '#............#', '#............#', '#............#', '#............#', '######DD######'],
    wc: { x0: 11, y0: 1, x1: 13, y1: 3, sign: [11, 3, 11.5] }, light: 0.45, floor: 'carpet', ceil: 'disco', wall: karaokeWall,
    props: r => {
      const p = [BX(6, 2.3, 2, 0.6, 0, 0.3, solid(BRICK, { top: '=', bright: 2 })), ...toilet(11.6, 1.4, -1, porcelain), washbasin(12.55, 1.3, 0, 1),
                 figProp(6, 2.25, figAnyone(r.neon, { mic: true, top: pick(['dress', 'tee', 'jacket']) }), { z: 0.3, face: [0, 1], pose: 'sing', chat: false, light: 14 }), // giving it everything, to the room
                 SPEAKER(3.5, 2.3), SPEAKER(8.5, 2.3)];
      const seats = [...couch(3.2, 6.3, 1.1, 0, -1, MAG), ...couch(10.0, 6.3, 1.1, 0, -1, MAG), ...[3.0, 4.6, 7.4, 9.0].map(x => POUF(x, 4.4, r.neon, 0, -1))];
      p.push(...fillSeats(seats, barCrowd()));
      return p;
    } },
  petshop: { grid: boxRoom(10, 8), light: 0.8, floor: 'tile', ceil: 'strip', sign: true, wall: petWall, keeper: [5, 1.4],
    props: r => [...counterBox(5, 1.7, 1.6), standing(5, 1.4, r.neon),
                 ...petCage(2.2, 4, KITTEN_LOOK, () => fract(T / 6 + 0.4) < 0.04 ? 'f1' : 'f0', 0.5), ...petCage(7.8, 4, dogLook(WARM), () => 'f' + (5 + ((T * 4) & 1)), 0.5),
                 figProp(4.2, 5.3, dogLook(BRICK), { h: 1.22 / 2, pose: () => 'f' + (5 + ((T * 2) & 1)), face: [0, 0], chat: false, light: 6 })] }, // a kitten, a puppy, and the shop dog
  florist: { grid: boxRoom(10, 7), light: 1, floor: 'tile', ceil: 'strip', shelves: true, sign: true, glyphs: '*@&%', wall: floristWall, keeper: [5, 1.4],
    props: r => {
      const p = [...counterBox(5, 1.7, 1.6), standing(5, 1.4, r.neon)];
      for (let k = 0; k < 7; k++) {
        const x = 1.5 + Math.random() * 7, y = 2.8 + Math.random() * 2.6, bloom = ITEM_COL[k & 7];
        p.push(chance(0.5) ? POT_PLANT(x, y, 0.9 + Math.random() * 0.6, x * 7 + y, false) : BOUQUET(x, y, bloom)); // (scattered at random: they don't block, so they can't wall off the counter)
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
        if (chance(0.35)) p.push({ ...sitting(x - 1 + Math.random() * 2, y + (y < 2 ? 0.03 : -0.03), shirt(), 0.45), face: [0, y < 2 ? 1 : -1] });
      }
      for (const x of [5.5, 10.5, 15.5]) p.push(GRAB_POLE(x, 2.5));
      return p;
    } },
  // the cafe: the counter and its pastry case, five tables, and the toilet through the door in the back corner
  cafe: { grid: ['#############', '#........W..#', '#........W..#', '#........WW.#', '#...........#', '#...........#', '#...........#', '#####DD######'],
    wc: { x0: 10, y0: 1, x1: 12, y1: 3, sign: [10, 3, 10.5] }, light: 0.9, floor: 'wood', ceil: 'pendant', sign: false, wall: cafeWall, keeper: [4.6, 1.4],
    props: r => {
      const p = [...counterBox(4.6, 1.7, 1.4), standing(4.6, 1.4, r.neon), ...toilet(10.6, 1.4, -1, porcelain), washbasin(11.55, 1.3, 0, 1), POT_PLANT(11.4, 6.2, 1.4),
        BX(3.7, 1.65, 0.28, 0.2, 1.05, 1.5, solid(GRAY, { top: 'o', trim: 1.42 })), // the espresso machine
        BX(7.2, 1.7, 0.7, 0.3, 0, 1.05, (i, t, L) => { // the pastry case
          const f = HIT.face; BG[i] = f === 5 ? C(GRAY, 2) : C(CYAN, 1 + L * 0.1);
          if ((f === 4 || f === 3) && HIT.w > 0.3 && HIT.w < 0.95) return set(i, fract(HIT.w * 4) < 0.4 ? '@o*o'[hash(Math.floor(HIT.u * 8), Math.floor(HIT.w * 4), 9) * 4 | 0] : '_', C(fract(HIT.w * 4) < 0.4 ? ORANGE : GRAY, 13)), true;
          return set(i, f === 5 ? '=' : ' ', C(GRAY, L)), true;
        })];
      for (const [x, y] of [[2.2, 4.4], [5, 3.4], [7.8, 4.4], [2.2, 6.4], [7.8, 6.4]]) { // a clear way in down the middle
        p.push(...tableBox(x, y, 0.4, 0.4), ...homeChair(x + 0.7, y, -1, 0, BRICK), ...homeChair(x - 0.7, y, 1, 0, BRICK));
        if (chance(0.55)) p.push({ ...sitting(x + 0.7, y, shirt(), 0.48), face: [-1, 0] }); // (facing their table)
        if (chance(0.3)) p.push({ ...sitting(x - 0.7, y, shirt(), 0.48), face: [1, 0] });
      }
      return p;
    } },
  books: { grid: ['##########', '#........#', '#.SS..SS.#', '#.SS..SS.#', '#........#', '#........#', '####DD####'],
    light: 0.8, floor: 'wood', ceil: 'pendant', shelves: true, sign: true, glyphs: '|]|[', wall: booksWall, keeper: [7.8, 4.6],
    props: r => [...counterBox(7.8, 5.1, 0.9), standing(7.8, 4.6, r.neon),
      BX(2.2, 5, 0.4, 0.4, 0, 0.45, solid(RED, { top: '=' })), BX(2.2, 4.62, 0.4, 0.06, 0.45, 1.0, solid(RED)), SEAT(2.2, 5.05, 0, 1), // a reading chair
      ...(chance(0.5) ? [standing(4.5, 4.3, shirt())] : [])] },
  // the noodle bar: one long counter in front of the open kitchen, stools along it, a narrow WC past its far end
  noodle: { grid: ['###############', '#..........W..#', '#..........W..#', '#..........W..#', '#..........W..#', '#.............#', '######DD#######'],
    wc: { x0: 12, y0: 1, x1: 14, y1: 5, sign: [11, 4, 4.5] }, light: 0.75, floor: 'tile', ceil: 'lantern', sign: true, signAt: 6, wall: noodleWall, keeper: [6, 1.4],
    props: r => {
      const p = [BX(6, 2.0, 4.6, 0.3, 0, 1.0, solid(BRICK, { panel: 0.75, trim: 0.95, top: '=' })), standing(6, 1.4, WHITE), standing(3.5, 1.4, WHITE),
        ...toilet(12.6, 1.4, -1, porcelain), washbasin(13.68, 3.3, -1, 0)];
      for (let x = 2; x <= 10; x += 1.35) { p.push(STOOL(x, 2.65, BRICK)); if (chance(0.5)) p.push(sitting(x, 2.7, shirt(), 0.6, true)); }
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
  // the tea house: mahjong at four tables, tea from the counter, the toilet in the back corner
  tea: { grid: ['##############', '#.........W..#', '#.........W..#', '#.........WW.#', '#............#', '#............#', '#............#', '#............#', '######DD######'],
    wc: { x0: 11, y0: 1, x1: 13, y1: 3, sign: [11, 3, 11.5] }, light: 0.7, floor: 'wood', ceil: 'lantern', sign: true, signAt: 6, wall: teaWall, keeper: [6, 1.4],
    props: r => {
      const p = [...counterBox(6, 1.7, 1.4), standing(6, 1.4, RED), ...toilet(11.6, 1.4, -1, porcelain), washbasin(12.55, 1.3, 0, 1), POT_PLANT(12.3, 7.2, 1.5)];
      for (const [x, y] of [[3, 4], [9, 4], [3, 6.8], [9, 6.8]]) {
        p.push({ mj: true, cx: x, cy: y, ...BX(x, y, 0.45, 0.45, 0.7, 0.76, (i, t, L) => { // a mahjong table: green felt, tiles on top
          const f = HIT.face; BG[i] = f === 5 ? C(GREEN, 2) : C(BRICK, 1 + L * 0.2);
          return set(i, f === 5 && Math.abs(Math.abs(HIT.u) - 0.32) < 0.06 || f === 5 && Math.abs(Math.abs(HIT.v) - 0.32) < 0.06 ? '#' : ' ', C(WHITE, 13)), true;
        }) }, BX(x, y, 0.08, 0.08, 0, 0.7, solid(BRICK)));
        for (const [ox, oy] of [[-0.75, 0], [0.75, 0], [0, 0.75], [0, -0.75]]) { // (round the table)
          p.push(...homeChair(x + ox, y + oy, -ox / 0.75, -oy / 0.75, BRICK));
          if (chance(0.6)) p.push({ ...sitting(x + ox, y + oy, shirt(), 0.48), face: [-ox / 0.75, -oy / 0.75] });
        }
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
      ROPE_COIL(1.4, 1.4), // a coil of rope
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
      POT_PLANT(1.3, 1.3, 1.2), BENCHP(7.2, 4.6, -1, 0)] },
  home: homeDef(...HOME_ROOM_SIZE.home_studio, 0), loft: homeDef(...HOME_ROOM_SIZE.home_loft, 1), bellehome: homeDef(...HOME_ROOM_SIZE.home_belle, 2),
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
  const def = kind==='hotelroom'?(extra.suite?ROOM_DEFS.hotelSuite:extra.lobby?.word==='MOTEL'?ROOM_DEFS.motelRoom:ROOM_DEFS.hotelroom):ROOM_DEFS[kind], r = { neon: MAG, word: '', ...extra, kind, def, grid: def.grid, W: def.grid[0].length, H: def.grid.length };
  r.menu = MENU_ITEMS[MENUS[r.word] ?? 5];
  r.props = def.props(r);
  if(def.wc){
    const frames=bathroomSurrounds(r);r.props.push(...frames);
    r.bathroomDoors=frames.map((frame,index)=>BATHROOM_POCKET_DOOR(r,frame.bathroomOpening,index));
    r.props.push(...r.bathroomDoors);
  }
  if (def.home) r.props.push(...workshopProps(r),...furnishingProps(r));
  if(def.home||['hotelroom','lighthouse','lamproom'].includes(kind)){
    const host=r.lobby||r;r.exterior=homeExterior({...r,cell:host.cell,ret:host.ret});
    if(kind==='lighthouse'||kind==='lamproom')r.exterior={x0:LIGHTHOUSE.x-LIGHTHOUSE.r,x1:LIGHTHOUSE.x+LIGHTHOUSE.r,y0:LIGHTHOUSE.y-LIGHTHOUSE.r,y1:LIGHTHOUSE.y+LIGHTHOUSE.r,up:kind==='lamproom'?2.8:0,faces:{}};
    if(kind==='hotelroom'&&!r.suite&&r.lobby?.word==='MOTEL')r.exterior.up=.02;
  }
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
    if(room.exterior){homeView(i,u,z,mx===0?'west':mx===room.W-1?'east':'north');return true;}
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
  if(room.exterior&&z>.95&&z<2.45&&fract(u*1.2)>.05){homeView(i,u,z,mx===0?'west':mx===room.W-1?'east':my===0?'north':'south');return true;}
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
const HOME_SHELF_CAPACITY = 4;
function homeRecord(r = room) {
  if (!r || !r.cell || !['home', 'loft', 'bellehome', 'islandhome'].includes(r.kind)) return null;
  const cell = idx(Math.floor(r.cell[0]), Math.floor(r.cell[1]));
  return owned.homes.find(h => h.cell === cell || SHOP[cell] && SHOP[h.cell] === SHOP[cell]) || null;
}
function homePlan(w, h, tier) {
  const extra = {}, inside = tier === 2 ? 19 : w - 1;
  const wall = (x0, y0, x1, y1, c = '#') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) extra[x + ',' + y] = c;
  };
  const home = tier === 0
    ? { bed: [2.6, 2.3], closet: [5.1, 2], sofa: [2.9, 6.2], tv: [2.9, 4.4], shelf: [1.18, 4.4], fridge: [8.45, 5.6], pet: [1.4, 7.2], dining: [5.5, 5.8] }
    : { bed: [3.4, 3.4], closet: [7.4, 2], sofa: [2.7, tier === 2 ? 13.6 : 11.8], tv: [2.7, tier === 2 ? 9.63 : 8.63], shelf: [10.18, tier === 2 ? 5.3 : 4.8], fridge: [inside - 0.65, h - 3.3], pet: [2, h - 2.3], dining: [13, tier === 2 ? 13 : 10.7] };
  const wc = tier === 0 ? { x0: 7, y0: 1, x1: 9, y1: 4, sign: [6, 3, 3.5] }
    : { x0: 15, y0: 1, x1: inside, y1: 5, sign: [14, 4, 4.5] };
  wall(wc.x0 - 1, 1, wc.x0 - 1, wc.y1, 'W');
  if (wc.x1 < inside) wall(wc.x1, 1, wc.x1, wc.y1, 'W');
  wall(wc.x0 - 1, wc.y1, wc.x1 - 1, wc.y1, 'W');
  wall(wc.x0, wc.y1, tier ? wc.x0 + 1 : wc.x0, wc.y1, '.');
  if (tier) { // bedroom and study/library, with wide doorways into the living room
    const divideY = tier === 2 ? 8 : 7;
    wall(9, 1, 9, divideY);
    wall(1, divideY, inside - 1, divideY);
    wall(5, divideY, 6, divideY, '.');
    wall(12, divideY, 13, divideY, '.');
  }
  let balcony = null;
  if (tier === 2) {
    balcony = { x0: 20, x1: 25, y0: 3, y1: 17 };
    wall(19, 1, 25, h - 2); // solid end wings round a recessed, open balcony
    wall(20, 3, 24, 16, '.');
    wall(25, 3, 25, 16, 'B');
    wall(20, 2, 25, 2, 'B'); wall(20, 17, 25, 17, 'B');
    wall(19, 11, 19, 13, '.'); // French doors, reachable from the salon
  }
  const entryX = tier === 2 ? 9 : w / 2;
  wall(entryX - 1, h - 1, entryX, h - 1, 'D');
  const windows = [{ face: 'west', center: 2.5, half: 1 }, { face: 'west', center: tier ? 5.4 : 6.3, half: tier ? 1 : 1.25 }];
  if (tier) windows.push({ face: 'west', center: tier === 2 ? 12.7 : 11, half: 2.3 }, { face: 'north', center: 4.2, half: 2 }, { face: 'north', center: 11.8, half: 1.8 });
  const lamps = tier ? [[4.5, 4], [11.6, 3.8], [5, tier === 2 ? 12 : 11], [13, tier === 2 ? 13 : 10.7], [17, 2.8], [entryX, h - 2.6], [3.5, h - 4], [inside - 3, h - 4]]
    : [[3.2, 2.2], [3.2, 6.3], home.dining, [8, 2.3], [3.5, h - 4], [w - 3, h - 4]];
  return { home, wc, balcony, windows, lamps, tier, shelfAxis: [0,1], bedBounds: [home.bed[0],home.bed[1]+.2,tier?1.25:1,.85], grid: boxRoom(w, h, extra, false), entry: [entryX, h - 1.6, -Math.PI / 2] };
}
// Upholstered seating and separate dining chairs, with real legs and backs.
function homeChair(x, y, fx, fy, col = BRICK) {
  return [{...ROOM_MODEL(x,y,(vx,vy)=>drawFurnitureChair(vx,vy,fx,fy,col),[.31,.31,1.12]),seat:true,fx,fy,h:.5}];
}
// the kitchen counter with the hob set in it: four rings on top (red while something's on: cooking-ui.js), the knobs
// along the front edge and the oven door under them with its window; worktop either side
const stoveShade = (tier, half) => { const counter = solid(tier === 2 ? WHITE : BRICK, { panel: 0.6, top: '=' }); return (i, t, L) => {
  const f = HIT.face, u = HIT.u, w = HIT.w, hob = Math.abs(u) < half, on = typeof cookingOn !== 'undefined' && cookingOn() === 'stove';
  if (!hob || f !== 5 && f !== 3) return counter(i, t, L);
  if (f === 5) {
    BG[i] = C(GRAY, 0.7 + L * 0.08);
    const ring = Math.min(...[-1, 1].flatMap(a => [-1, 1].map(b => Math.hypot(u - a * half / 2, HIT.v - b * 0.15))));
    if (Math.abs(ring - 0.08) < 0.03) return set(i, 'O', on ? C(RED, 11 + Math.sin(T * 6) * 3) : C(GRAY, L * 0.8)), true;
    return set(i, ' ', 0), true;
  }
  BG[i] = C(tier === 2 ? WHITE : GRAY, (1.1 + L * 0.22)); // the front
  if (w > 0.84) return set(i, Math.abs(fract(u / half * 2 + 0.5) - 0.5) < 0.12 ? 'o' : ' ', C(GRAY, L)), true; // the knobs
  if (w > 0.72) return set(i, '-', C(GRAY, Math.max(L, 8))), true; // the door's handle
  if (Math.abs(u) < half - 0.08 && w > 0.22 && w < 0.62) { BG[i] = on ? C(ORANGE, 2 + Math.sin(T * 3)) : C(GRAY, 0.5); return set(i, ' ', 0), true; } // its window
  return set(i, Math.abs(Math.abs(u) - half + 0.02) < 0.02 ? '|' : ' ', C(GRAY, L * 0.7)), true;
}; };
function homeDef(w, h, tier) {
  const plan = homePlan(w, h, tier), { bed, closet, sofa, tv, shelf, fridge, pet, dining } = plan.home;
  const fridgeShade = (i, t, L) => {
    const f = HIT.face;
    BG[i] = C(f === 3 || f === 4 ? WHITE : GRAY, (2 + L * 0.3) * shadeFace(f));
    if (f === 5) return set(i, '_', C(GRAY, L)), true;
    if ((f === 3 || f === 4) && HIT.w > 0.5 && HIT.w < 1.45 && Math.abs(HIT.u - 0.28) < 0.05) return set(i, '|', C(GRAY, L)), true;
    if ((f === 3 || f === 4) && Math.abs(HIT.w - 0.85) < 0.04) return set(i, '=', C(GRAY, L)), true;
    return set(i, ' ', 0), true;
  };
  return { ...plan, light: tier === 2 ? 0.9 : 0.8, height: tier ? 3.6 : 3, floor: 'home', ceil: 'home', wall: homeWall,
    spots: { bed, closet, tv, shelf: [shelf[0] + 1.1, shelf[1]], fridge: [fridge[0] - 1.1, fridge[1]], pet, stove: [fridge[0] - 1.1, fridge[1] + (tier ? -2.5 : 1.7)], workshop: [2.7, h - 2.6] },
    props: r => [
      ...FURNITURE_BED(bed[0],bed[1]+.2,.85,tier?1.25:1,tier===2?GREEN:BLUE,-Math.PI/2),
      FURNITURE_STORAGE(closet[0],closet[1]-.6,.8,.3,2.1),
      FURNITURE_STORAGE(1.45,h-2.6,.5,.4,1.1,-Math.PI/2),
      TELEVISION(tv[0],tv[1]-.3,r),
      FURNITURE_STORAGE(tv[0],tv[1]-.3,.8,.25,.61),
      FURNITURE_STORAGE(shelf[0],shelf[1],.75,.18,1.05,-Math.PI/2,true),
      BX(fridge[0], fridge[1], 0.4, 0.38, 0, 1.65, fridgeShade),
      ...toilet(plan.wc.x1 - (tier ? 1.4 : .8), 1.42, -1, porcelain),
      washbasin(plan.wc.x0 + 0.4, 1.35, 0, 1),
      ...(tier ? [BATHTUB(plan.wc.x1 - .43, 3.4)] : []),
      ...couch(sofa[0],sofa[1],tier?1.55:.95,0,-1,tier===2?GREEN:BLUE),
      ...tableBox(dining[0], dining[1], tier ? 1.25 : 0.6, 0.5),
      ...[-1, 1].flatMap(s => homeChair(dining[0], dining[1] + s * 1.05, 0, -s, tier === 2 ? GREEN : BRICK)),
      ...(tier ? [-1, 1].flatMap(s => homeChair(dining[0] + s * 0.75, dining[1] + 1.05, 0, -1, tier === 2 ? GREEN : BRICK)) : []),
      BX(fridge[0], fridge[1] + (tier ? -2.5 : 1.7), tier ? 1.55 : 0.55, 0.33, 0, 0.94, stoveShade(tier, tier ? 0.55 : 0.5), 0, 1), // the kitchen counter, the hob and oven in it (cooking.js)
      ...(tier ? [...tableBox(12.6, 2.9, 1.1, 0.45), ...homeChair(12.6, 4, 0, -1), FURNITURE_STORAGE(10.9,1.4,.7,.18,2.4,0,true),
        ...tableBox(sofa[0], sofa[1] - 1.6, 0.85, 0.4), POT_PLANT(1.6, 8.9, 1.5)] : []),
      ...(plan.balcony ? [...tableBox(22.3, 6, 0.65, 0.5), ...homeChair(22.3, 7.2, 0, -1, WHITE), ...homeChair(22.3, 4.8, 0, 1, WHITE),
        POT_PLANT(23.6, 14.8, 1.6), POT_PLANT(21, 9, 1.5)] : []),
      ...plan.lamps.map(([x,y],k)=>HOME_PENDANT(x,y,tier?3.6:3,r,k)),
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
function homeExterior(r) {
  const [cx, cy] = r.cell || r.ret || [px, py], sh = SHOP[idx(Math.floor(cx), Math.floor(cy))];
  let x0 = Math.floor(cx), x1 = x0 + 1, y0 = Math.floor(cy), y1 = y0 + 1;
  if (sh) for (let y = Math.floor(cy) - 7; y <= Math.floor(cy) + 7; y++) for (let x = Math.floor(cx) - 7; x <= Math.floor(cx) + 7; x++) {
    if (SHOP[idx(x, y)] !== sh) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
  }
  const up = Math.min(Math.max(0.3, map[idx(Math.floor(cx), Math.floor(cy))] - 0.4), r.def.tier === 2 ? 2 : r.def.tier ? 1.2 : 0.5);
  const open = { west: 0, east: 0, north: 0, south: 0 };
  for (let y = y0; y < y1; y++) { open.west += map[idx(x0 - 1, y)] < up; open.east += map[idx(x1, y)] < up; }
  for (let x = x0; x < x1; x++) { open.north += map[idx(x, y0 - 1)] < up; open.south += map[idx(x, y1)] < up; }
  return { x0, x1, y0, y1, up, faces: { west: open.west >= open.east ? 'west' : 'east', north: open.north >= open.south ? 'north' : 'south' } };
}
// Carry each window ray into the actual neighbourhood. Geometry, horizon and parallax stay fixed as you move.
function homeView(i, u, z, face) {
  const e = room.exterior, outside = e.faces[face] || face, flip = outside === face ? 1 : -1;
  const along = Math.abs(u), slope = WH.sl * flip, vz = (z - eye) / WH.dn;
  face = outside;
  const west = face === 'west', north = face === 'north', east = face === 'east';
  const x = west ? e.x0 - 0.01 : east ? e.x1 + 0.01 : (e.x0 + e.x1) / 2 + (along - room.W / 2) * flip / 10;
  const y = north ? e.y0 - 0.01 : face === 'south' ? e.y1 + 0.01 : (e.y0 + e.y1) / 2 + (along - room.H / 2) * flip / 10;
  homeCityView(i, x, y, e.up + z / 10, west ? -1 : east ? 1 : slope, north ? -1 : face === 'south' ? 1 : slope, vz);
}
function homeOutdoorRay(i, rx, ry) {
  if (rx === undefined) { const q = 2 * (i % cols + 0.5) / cols - 1; rx = dx - dy * tf * q; ry = dy + dx * tf * q; }
  const vz = (hor - Math.floor(i / cols) - 0.5) / projY, b = room.def.balcony, e = room.exterior;
  const at = px < b.x0 - 1 && rx > 0 ? (b.x0 - 1 - px) / rx : 0;
  return homeCityView(i, e.x1 + (px + rx * at - b.x0 + 1) / 10, (e.y0 + e.y1) / 2 + (py + ry * at - room.H / 2) / 10, e.up + (eye + vz * at) / 10, rx, ry, vz);
}
function homeCityView(i, x, y, z, vx, vy, vz) {
  let mx = Math.floor(x), my = Math.floor(y), t = 0, side = false;
  const sx = vx < 0 ? -1 : 1, sy = vy < 0 ? -1 : 1, stepx = Math.abs(1 / vx), stepy = Math.abs(1 / vy);
  let tx = (vx < 0 ? x - mx : mx + 1 - x) * stepx, ty = (vy < 0 ? y - my : my + 1 - y) * stepy;
  const ground = vz < -1e-6 ? -z / vz : Infinity;
  for (let k = 0; k < 80 && t < 32; k++) {
    const next = Math.min(tx, ty), cell = idx(mx, my), height = map[cell], hz = z + vz * t;
    const roof = height && vz < 0 ? (height - z) / vz : Infinity;
    if (height && (hz > 0 && hz < height || roof >= t && roof < next)) {
      const top = hz >= height, depth = top ? roof : t, wx = x + vx * depth, wy = y + vy * depth;
      const stone = STY[cell] === 24 || STY[cell] === 25, base = stone ? STONE : FACADE_BG[STY[cell]] ?? BRICK;
      const light = (0.25 + day * 0.75) * (side ? 0.8 : 1) * Math.max(0.35, 1 - depth / 40), along = side ? wx : wy;
      const bay = fract(along * 2), floor = fract((z + vz * depth) * 2.5);
      BG[i] = C(top && stone ? GREEN : base, 1 + light * 4);
      if (!top && bay > 0.27 && bay < 0.73 && floor > 0.22 && floor < 0.8) {
        const lit = hash(Math.floor(along * 2), Math.floor((z + vz * depth) * 2.5), sk0(SEED[cell])) > 0.4 + day * 0.5;
        BG[i] = lit ? C(WARM, 3 + night * 4) : C(CYAN, 1 + day * 2);
        return set(i, lit ? ' ' : ':', C(CYAN, light * 7));
      }
      return set(i, top ? fract(wx * 6 + wy * 4) < 0.08 ? '/' : ' ' : floor < 0.1 ? '=' : ' ', C(stone ? WHITE : base, light * 9));
    }
    if (ground < next) {
      const wx = x + vx * ground, wy = y + vy * ground, road = ROAD[idx(Math.floor(wx), Math.floor(wy))];
      if(seaAt(wx,wy)&&!onPier(wx,wy)) {
        BG[i]=C(BLUE,1+day*3);
        return set(i,noise(wx*2+T*.2,wy*2,91)>.6?'~':' ',C(CYAN,3+day*6));
      }
      BG[i] = C(road ? GRAY : GREEN, 1 + day * 2);
      return set(i, road && Math.abs(fract(road === 1 ? wx : wy) - 0.5) < 0.04 ? '-' : ' ', C(YEL, day * 8));
    }
    if (tx < ty) { t = tx; tx += stepx; mx += sx; side = false; } else { t = ty; ty += stepy; my += sy; side = true; }
  }
  BG[i] = C(day > 0.25 ? BLUE : GRAY, day > 0.25 ? 2 + day * 4 : 0);
  return set(i, day < 0.2 && hash(Math.floor(Math.atan2(vy, vx) * 100), Math.floor(vz * 100), 889) > 0.985 ? '.' : ' ', C(WHITE, 12));
}
function homeWall(i, u, uStep, z, d, mx, my, L) {
  const def = room.def, face = mx === 0 ? 'west' : my === 0 ? 'north' : mx === room.W - 1 ? 'east' : my===room.H-1?'south':null, along = Math.abs(u);
  if (roomAt(mx, my) === 'B') { // the balcony's iron rail: open air between slim, curved balusters
    if (z > 1.03 || z < 0.14 || Math.abs(fract(along * 4) - 0.5) < 0.06 || Math.abs(fract(along * 2) - 0.5) < 0.025 + Math.sin(z * Math.PI) * 0.09) {
      BG[i] = C(GRAY, 1); return set(i, z > 1.03 ? '=' : '|', C(GRAY, L)), true;
    }
    homeOutdoorRay(i); return true;
  }
  for (const win of def.windows) if (face === win.face && Math.abs(along - win.center) < win.half && z > (win.bottom??.85) && z < (win.top??(def.tier ? 2.95 : 2.5))) {
    const du = Math.abs(along - win.center), bottom=win.bottom??.85,top=win.top??(def.tier ? 2.95 : 2.5);
    if (du > win.half - 0.09 || z < bottom+.1 || z > top - 0.1 || du < 0.035 || Math.abs(z - 2.12) < 0.035) {
      BG[i] = C(def.tier === 2 ? WHITE : BRICK, 2 + L * 0.25); return set(i, du < 0.035 || du > win.half - 0.09 ? '|' : '=', C(WHITE, L)), true;
    }
    if(room.kind==='islandhome'){const marks=COVE_VIEW.marks.get(face)||[];if(!COVE_VIEW.marks.has(face))COVE_VIEW.marks.set(face,marks);marks.push([i,d]);BG[i]=C(CYAN,4);set(i,' ',0);}
    else homeView(i, u, z, face); return true;
  }
  BG[i] = C(def.tier === 2 ? STONE : WHITE, 3 + L * 0.38);
  if (z < 0.12 || z > (def.height || 3) - 0.16 || def.tier === 2 && Math.abs(z - 0.9) < 0.045) return set(i, '=', C(def.tier === 2 ? YEL : WHITE, L)), true;
  return set(i, def.tier === 2 && z < 0.9 && Math.abs(fract(along / 0.8) - 0.5) > 0.46 ? '|' : ' ', C(BRICK, L * 0.6)), true;
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
const KARAOKE_STAGE = 6; // (the stage's middle, and the screen's over it)
function karaokeWall(i, u, uStep, z, d, mx, my, L) {
  if (my === 0 && z > 1.1 && z < 2.7 && Math.abs(u - KARAOKE_STAGE) < 3) { // lyrics screen: the sung part lights up
    BG[i] = C(BLUE, 2);
    const line = LYRICS[Math.floor(T / 5) % LYRICS.length], sung = fract(T / 5) * 1.3 * line.length;
    const q = (u - KARAOKE_STAGE) / 0.28 + line.length / 2, p = Math.floor(q);
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
  if (s < 0.14) { // one of the aquarium's little species, 20 cm long (s runs 0.7 to the metre), swimming along its lane
    const f = FISH[['tiny', 'clown', 'tang', 'tiny'][lane & 3]], q = s / 0.14;
    const fish = f.shape(dir > 0 ? q : 1 - q, (fract(z * 7) - 0.5) / 7 / (0.2 * f.h / f.len), T + lane, lane >> 2);
    if (fish) { BG[i] = C(fish[0], clamp(L * fish[1] * 0.9, 1, 15)); set(i, ' ', 0); return true; }
  }
  const bx = fract(u * 10) - 0.5, bz = fract(z * 10 - T * 2) - 0.5; // bubbles: a little disc in one 10 cm square in thirty
  if (bx * bx + bz * bz < 0.05 && hash(Math.floor(u * 10), Math.floor(z * 10 - T * 2), 5) > 0.97) BG[i] = C(WHITE, 9);
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
  if (c === 'D' && R.kind !== 'cathedral' && !D.doorWall) { // the way out: glass doors, or stairs up from the subway
    if (R.kind === 'station') {
      // The doorway reaches the sign's lower edge; keep the complete sign 6cm below the ceiling.
      if (z > STATION_EXIT_Z - STATION_EXIT_H / 2 - 0.04) return wallText(i, u, uStep, z, d, 'EXIT', 11.5, STATION_EXIT_Z, 0.25, STATION_EXIT_H, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
      set(i, ' ', 0); BG[i] = C(day > 0.3 ? WHITE : WARM, 3 + day * 7); return; // daylight (or streetlight) from the top
    }
    if (z > 2.3) return set(i, '=', C(GRAY, L));
    return fract(u) < 0.08 ? set(i, '|', C(GRAY, L)) : set(i, ':', C(day > 0.3 ? CYAN : WARM, 6 + day * 6));
  }
  if (c === 'E') { // elevator (or whatever this building has instead: lobbies.js)
    if (D.liftWall) return D.liftWall(i, u, uStep, z, d, mx, my, L);
    if (z > 2.25) return wallText(i, u, uStep, z, d, 'ROOF ^', D.ex, 2.5, 0.18, 0.3, C(GREEN, 15)) || set(i, '=', C(GRAY, L));
    BG[i] = C(GRAY, 2);
    return set(i, Math.abs(u - D.ex) < 0.04 ? '|' : ':', C(GRAY, L * 1.2));
  }
  if (TANKS[c]) return tankCell(i, u, uStep, z, d, side, mx, my, L, c, wc);
  if (!D.home && wcFaceInside(mx, my, side)) return wcWall(i, u, z, L); // in the bathroom
  if (c === 'W' && D.wc) { // the bathroom's wall seen from outside: the room's own walls (or a plain one), the WC sign by the doorway
    const [sx, sy, su] = D.wc.sign; // (u runs whichever way reads left to right, so it's negative from some sides)
    if (mx === sx && my === sy && wallText(i, u, uStep, z, d, 'WC', Math.sign(u) * su, 1.95, 0.22, 0.3, C(CYAN, 15), C(BLUE, 3))) return;
    if (D.home) {
      BG[i] = C(WHITE, 3 + L * 0.3);
      return set(i, wcFaceInside(mx, my, side) && (fract(u * 3) < 0.08 || fract(z * 3) < 0.08) ? '+' : z < 0.12 ? '=' : ' ', C(GRAY, L * 0.6));
    }
    if (D.wall && D.wall(i, u, uStep, z, d, mx, my, L)) return;
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
  if (room.def.balcony && (wx < 0 || wy < 0 || wx >= room.W || wy >= room.H)) { FL[i] = 0; return homeOutdoorRay(i, rx, ry); }
  if (room.def.wc && inWc(wx, wy)) { if(ROOM_FLOORS[room.def.bathFloor])return ROOM_FLOORS[room.def.bathFloor](i,f,wx,wy,r,x,L);const k = (Math.floor(wx * 5) + Math.floor(wy * 5)) & 1; BG[i] = k ? C(WHITE, 1.3 + L * 0.2) : C(GRAY, 0.5 + L * 0.06); return set(i, ' ', 0); }
  if (ROOM_FLOORS[room.def.floor]) return ROOM_FLOORS[room.def.floor](i, f, wx, wy, r, x, L);
  switch (room.def.floor) {
    case 'home': {
      const b = room.def.balcony, sofa = room.def.home.sofa;
      if (b && wx >= b.x0 && wy >= b.y0 && wy < b.y1) {
        BG[i] = C(WHITE, 2 + f * 2); return set(i, fract(wx * 2) < 0.04 || fract(wy * 2) < 0.04 ? '+' : ' ', C(GRAY, L));
      }
      if (room.def.tier && Math.abs(wx - sofa[0]) < 2.3 && wy > sofa[1] - 2.5 && wy < sofa[1] + 0.9) {
        const border = Math.abs(wx - sofa[0]) > 2.1 || wy < sofa[1] - 2.3 || wy > sofa[1] + 0.7;
        BG[i] = C(room.def.tier === 2 ? GREEN : BLUE, 1 + f * 2);
        return set(i, border ? '=' : (Math.floor(wx * 5) + Math.floor(wy * 5)) % 7 ? ' ' : '+', C(WARM, L));
      }
      const herring = room.def.tier === 2, u = herring ? wx + wy : wx, v = herring ? wx - wy : wy;
      BG[i] = C(BRICK, 1 + f * 2 + (Math.floor(v * 3) & 1));
      return set(i, fract(v * 3) < 0.07 ? herring ? '/' : '=' : fract(u / 1.5 + (Math.floor(v * 3) & 1) * 0.5) < 0.025 ? '|' : ' ', C(WARM, L));
    }
    case 'wood': return set(i, fract(wy * 3) < 0.12 ? '=' : (r + x) & 1 ? '.' : ' ', C(BRICK, L * 1.3));
    case 'royal': {
      const border = Math.abs(wx - 4.5) > 3 || Math.abs(wy - 3.5) > 2;
      const motif = Math.abs(fract(wx / 0.7) - 0.5) + Math.abs(fract(wy / 0.7) - 0.5) < 0.13;
      BG[i] = C(BRICK, 1 + f);
      return set(i, border ? '=' : motif ? '+' : ' ', C(YEL, L * (border ? 1.3 : 0.7)));
    }
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
// ---- ceiling lights, laid out to fit the room: each fitting hangs whole over the floor (or a shelf, or anything else
// the ceiling shows over), a hand's width clear of the walls, never over a doorway, and they're spread evenly over each
// part of the room its walls divide it into (the shop, the back room, the toilet), not a pattern tiled from the corner
// that the walls cut through. spec: { s: spacing, r: radius } round fittings; { s, w, strip: true } tubes running along
// y; { s, r, track: true } tracks along x every s with a spot every r. Cached on the room as a mask, CEIL_RES a metre:
// 1 a fitting (lit), 2 a track
const CEIL_RES = 20, CEIL_GAP = 0.2;
function ceilMask(key, spec) {
  const R = room;
  if (R.ceilMasks?.[key]) return R.ceilMasks[key];
  const W = R.W, H = R.H, top = (R.def.height || 3) - 0.05, RW = W * CEIL_RES, mask = new Uint8Array(RW * H * CEIL_RES);
  const under = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ROOMW.cell(x, y) < top;
  // doorways: a run of one to three cells through a wall a cell thick (the far side of the wall's ends open)
  const door = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!under(x, y)) continue;
    let a = x, b = x;
    while (under(a - 1, y)) a--; while (under(b + 1, y)) b++;
    if (b - a < 3 && (under(a - 1, y - 1) || under(b + 1, y - 1)) && (under(a - 1, y + 1) || under(b + 1, y + 1))) door[y * W + x] = 1;
    a = y; b = y;
    while (under(x, a - 1)) a--; while (under(x, b + 1)) b++;
    if (b - a < 3 && (under(x - 1, a - 1) || under(x - 1, b + 1)) && (under(x + 1, a - 1) || under(x + 1, b + 1))) door[y * W + x] = 1;
  }
  // the parts of the room: what's left joined up once the doorways are taken out
  const part = new Int16Array(W * H).fill(-1), parts = [];
  for (let k = 0; k < W * H; k++) {
    if (part[k] >= 0 || door[k] || !under(k % W, k / W | 0)) continue;
    const box = [W, H, 0, 0], q = [k]; part[k] = parts.length;
    while (q.length) {
      const c = q.pop(), x = c % W, y = c / W | 0;
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x + 1); box[3] = Math.max(box[3], y + 1);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && part[n] < 0 && !door[n] && under(nx, ny)) { part[n] = parts.length; q.push(n); }
      }
    }
    parts.push(box);
  }
  const tall = R.props.filter(p => p.box && !p.walk && p.box.z1 >= top).map(p => p.box); // (lintels and the like, up to the ceiling)
  const fits = (id, x0, y0, x1, y1) => { // is all of [x0, x1] x [y0, y1], and a gap round it, over this part of the room?
    for (let y = Math.floor(y0 - CEIL_GAP); y <= Math.floor(y1 + CEIL_GAP); y++) for (let x = Math.floor(x0 - CEIL_GAP); x <= Math.floor(x1 + CEIL_GAP); x++)
      if (x < 0 || y < 0 || x >= W || y >= H || part[y * W + x] !== id) return false;
    return !tall.some(b => inBox(b, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + 0.1));
  };
  const paint = (x0, y0, x1, y1, v, round) => {
    for (let py = Math.max(0, Math.floor(y0 * CEIL_RES)); py < Math.min(H * CEIL_RES, Math.ceil(y1 * CEIL_RES)); py++)
      for (let qx = Math.max(0, Math.floor(x0 * CEIL_RES)); qx < Math.min(RW, Math.ceil(x1 * CEIL_RES)); qx++) {
        const u = (qx + 0.5) / CEIL_RES, w = (py + 0.5) / CEIL_RES;
        if (!round || Math.hypot(u - (x0 + x1) / 2, w - (y0 + y1) / 2) < (x1 - x0) / 2) mask[py * RW + qx] = v; // (a spot over its track)
      }
  };
  const even = (a, b, s) => { const n = Math.max(1, Math.round((b - a) / s)), d = (b - a) / n; return Array.from({ length: n }, (_, k) => a + (k + 0.5) * d); };
  parts.forEach(([x0, y0, x1, y1], id) => {
    if (spec.strip) for (const cx of even(x0, x1, spec.s)) { // tubes along y, broken where they'd run into a wall
      if (spec.keep && !spec.keep(cx)) continue;
      let ya = -1;
      for (let y = y0; y <= y1; y++) {
        const ok = y < y1 && fits(id, cx - spec.w / 2, y + 0.5, cx + spec.w / 2, y + 0.5);
        if (ok && ya < 0) ya = y;
        if (!ok && ya >= 0) { if (y - ya >= 1) paint(cx - spec.w / 2, ya + 0.3, cx + spec.w / 2, y - 0.3, 1); ya = -1; }
      }
    } else if (spec.track) for (const cy of even(y0, y1, spec.s)) { // a track along x, spots spaced along it
      let xa = -1;
      for (let x = x0; x <= x1; x++) {
        const ok = x < x1 && fits(id, x + 0.5, cy - 0.04, x + 0.5, cy + 0.04);
        if (ok && xa < 0) xa = x;
        if (!ok && xa >= 0) {
          if (x - xa >= 1) { paint(xa + 0.3, cy - 0.04, x - 0.3, cy + 0.04, 2); for (const sx of even(xa + 0.3, x - 0.3, spec.r)) paint(sx - 0.1, cy - 0.1, sx + 0.1, cy + 0.1, 1, true); }
          xa = -1;
        }
      }
    } else for (const cy of even(y0, y1, spec.s)) for (const cx of even(x0, x1, spec.s)) // round fittings on an even grid
      if (fits(id, cx - spec.r, cy - spec.r, cx + spec.r, cy + spec.r)) paint(cx - spec.r, cy - spec.r, cx + spec.r, cy + spec.r, 1, true);
  });
  (R.ceilMasks ||= {})[key] = mask;
  return mask;
}
const ceilAt = (key, spec, wx, wy) => {
  if (wx < 0 || wy < 0 || wx >= room.W || wy >= room.H) return 0;
  return ceilMask(key, spec)[Math.floor(wy * CEIL_RES) * room.W * CEIL_RES + Math.floor(wx * CEIL_RES)];
};
const CEIL_PENDANT = { s: 2, r: 0.14 }, CEIL_LANTERN = { s: 1.6, r: 0.18 }, CEIL_STRIP = { s: 2.5, w: 0.4, strip: true },
  CEIL_STATION = { s: 2.5, w: 0.4, strip: true, keep: x => x > 9 && x < 37 }; // (not down the tunnels)
function roomCeil(i, r, x, rx, ry) {
  const d = ((room.def.height || 3) - eye) * projY / (hor - r - 0.5), wx = px + rx * d, wy = py + ry * d;
  ZB[i] = d; FL[i] = 0;
  const st = room.def.ceil;
  if (ROOM_CEILS[st]) return ROOM_CEILS[st](i, r, x, wx, wy);
  if (st === 'home') {
    const b = room.def.balcony;
    if (b && (wx < 0 || wy < 0 || wx >= room.W || wy >= room.H || wx >= b.x0 - 1 && wy >= b.y0 && wy < b.y1)) return homeOutdoorRay(i, rx, ry);
    BG[i] = C(WHITE,2+3*room.def.light/(room.homeBaseLight||room.def.light));
    return set(i,' ',0); // Light comes from the fitted pendant model below.
  }
  if (st === 'pendant') { // warm hanging lamps, about 2m apart
    const on = ceilAt('pendant', CEIL_PENDANT, wx, wy) === 1;
    return set(i, on ? 'o' : (r + x) % 4 ? ' ' : '.', on ? C(WARM, 15) : C(BRICK, 2));
  }
  if (st === 'lantern') { // red paper lanterns, about 1.6m apart
    const on = ceilAt('lantern', CEIL_LANTERN, wx, wy) === 1;
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
  const strip = room.kind === 'station' ? ceilAt('station', CEIL_STATION, wx, wy) === 1 : ceilAt('strip', CEIL_STRIP, wx, wy) === 1; // fluorescent tubes
  set(i, strip ? '=' : (r + x) % 3 ? ' ' : '.', strip ? C(WHITE, 15) : C(GRAY, 3));
}
function roomSprites() {
  for (const s of room.props) {
    if (s.tick && !s.dead) s.tick(s); // (someone walking about)
    if (s.draw) { if (inView(s.x - px, s.y - py, s.radius??1)) s.draw(s.x - px, s.y - py, s); continue; } // a piece of furniture that draws itself (room models; its box, if any, only blocks)
    if (s.box) { drawBox({ ...s.box, x: s.box.x - px, y: s.box.y - py }, s.shade); continue; }
    if (s.bench) { drawBench(s.x - px, s.y - py, s.fx, s.fy, 0.1); continue; }
    if (s.vm) { drawVending(s.vm, s.x - px, s.y - py, 10); continue; } // a vending machine, life size
    if (s.fig) { drawFigProp(s, s.x - px, s.y - py); continue; } // somebody
    if (s.art) drawArt(s.x - px, s.y - py, s.z, s.w, s.h, typeof s.art === 'function' ? s.art() : s.art, s.col); // (a seat marker draws nothing: what it's on does)
  }
  const at = placeKey();
  for (const d of dropped) if (d.at === at) drawDropped(d, d.x - px, d.y - py, 1); // things you put down in here
  const home = homeRecord(room);
  if (home) {
    drawWorkshopPreview();
    const { shelf, pet } = homeLayout(room);
    for (const [k, it] of (home.decor || []).entries()) {
      const offset = (k - ((home.decor.length - 1) / 2)) * 0.3, axis = room.def.shelfAxis || [1,0];
      drawDropped({ ...it, displayZ: 1.07 }, shelf[0] + axis[0]*offset - px, shelf[1] + axis[1]*offset - py, 1);
    }
    const pets = home.pets || (home.pet ? [home.pet] : []);
    // the pets: sat by their spot, turning to watch you when you're close, else gazing out into the room
    const watch = (x, y) => Math.hypot(x - px, y - py) < 2.5 ? [0, 0] : [1, 0.4];
    if (pets.includes('petcat')) { const x = pet[0] - 0.12, y = pet[1]; drawAnimal(x - px, y - py, 0, 0.75, ...watch(x, y), CAT_LOOK, fract(T / 5) < 0.05 ? 1 : 0, { light: 6 }); }
    if (pets.includes('petdog')) { const x = pet[0] + 0.5, y = pet[1]; drawAnimal(x - px, y - py, 0, 1.22, ...watch(x, y), dogLook(BRICK), 5 + ((T * (Math.hypot(x - px, y - py) < 2.5 ? 6 : 1.5)) & 1), { light: 6 }); }
  }
  if (room.kind === 'station') {
    const tx = trainX(room);
    if (tx !== null) for (const k of [-1, 0, 1]) drawBox(boxAt(tx + k * 8.6 - px, ST_TRACK + 0.9 - py, 1, 0, 4.1, 1.4, 0.35, 3.3), trainShade(trainStopped(room), k));
  }
  drawRoomPolice();
}
const ROOMW = { cell: (x, y) => {
                  if (room.def.balcony && (x < 0 || y < 0 || x >= room.W || y >= room.H)) return 0;
                  const c = roomAt(x, y); return c === '.' ? 0 : c === 'B' ? 1.1 : c === 'S' ? 2.2 : c === 'L' ? 2.6 : c === 'G' ? 4 : room.def.height || 3;
                },
                wall: roomWall, floor: roomFloor, sky: roomCeil, sprites: roomSprites };
