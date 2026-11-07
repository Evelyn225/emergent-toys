'use strict';
// ---- a second pass over the shops and lobbies that still felt thin: the phone shop, the pawnbroker, the off-licence,
// the jeweller, and the hotel and motel lobbies (WORLD_QUALITY item 41). Added on top of what each room already had,
// tagged sparseAdded (and the people sparseExtra) like workshop-dressing.js.

// a rug: a border and a field, a pattern of diamonds in it up close
const SPARSE_RUG = (x, y, hl, hw, field, border) => SPARSE_FLAT(x, y, hl, hw, (i, t, L) => {
  const eu = hl - Math.abs(HIT.u), ev = hw - Math.abs(HIT.v), edge = Math.min(eu, ev);
  if (edge < .1) { BG[i] = C(border, 1.6 + L * .15); return set(i, ' ', 0), true; }
  const dia = t < 6 && Math.abs(fract(HIT.u * 2.5) - .5) + Math.abs(fract(HIT.v * 2.5) - .5) < .16;
  BG[i] = C(field, (dia ? 2.2 : 1.3) + L * .12); return set(i, ' ', 0), true;
});

// ---- the phone shop: a wall of phones in their cradles, all lit; an accessories spinner; a poster of the new one
const SPARSE_SPINNER = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, .25, 0, .04, SPARSE_FILL(GRAY, 1));
  rod(vx, vy, 0, vx, vy, 1.7, .02, GRAY, 1.5);
  const turn = T * .3;
  for (let k = 0; k < 4; k++) {
    const a = turn + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    for (let j = 0; j < 4; j++) drawBox(boxAt(vx + c * .16, vy + s * .16, -s, c, .12, .015, .45 + j * .3, .7 + j * .3), (i, t, L) => {
      const col = [CYAN, MAG, YEL, GREEN, RED, BLUE][(k * 4 + j) % 6]; BG[i] = C(col, 2.6 + L * .3); return set(i, Math.abs(HIT.w - (.66 + j * .3)) < .02 ? '-' : ' ', C(WHITE, 8)), true;
    });
  }
}, [.28, .28, 1.75]);
const SPARSE_PHONES_PROPS = ROOM_DEFS.phones.props, SPARSE_PHONES_WALL = ROOM_DEFS.phones.wall;
ROOM_DEFS.phones.wall = (i, u, uStep, z, d, mx, my, L) => {
  const v = -u;
  if (mx === 0 && v > 1.4 && v < 4.6 && z > 1.0 && z < 2.0) { // the phone wall: a white panel, phones on it in rows, their screens on
    const cu = (v - 1.4) / .4, cz = (z - 1.0) / .33, eu = fract(cu), ez = fract(cz), k = hash(Math.floor(cu), Math.floor(cz), 702);
    const phone = Math.abs(eu - .5) < .22 && Math.abs(ez - .5) < .38, screen = Math.abs(eu - .5) < .17 && Math.abs(ez - .52) < .3;
    BG[i] = screen ? C([CYAN, BLUE, MAG, GREEN][k * 4 | 0], 5 + Math.sin(T * 1.5 + k * 9) * .8) : phone ? C(GRAY, 1) : C(WHITE, 5 + L * .2); return set(i, ' ', 0), true;
  }
  if (mx === room.W - 1 && u > 2.2 && u < 4.2 && z > 1.0 && z < 2.3) { // the poster: the new one, floating in blue
    const fu = u - 3.2, fz = z - 1.65, body = Math.abs(fu) < .22 && Math.abs(fz) < .45, glass = Math.abs(fu) < .18 && Math.abs(fz) < .4;
    if (wallText(i, u, uStep, z, d, 'THE NEW ONE', 3.2, 1.12, .12, .1, C(WHITE, 15), C(BLUE, 1.2))) return true;
    BG[i] = glass ? C(CYAN, 3 + fz * 2) : body ? C(GRAY, 2) : C(BLUE, 1.2 + (z - 1) * .4); return set(i, ' ', 0), true;
  }
  return SPARSE_PHONES_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.phones.props = r => [...SPARSE_PHONES_PROPS(r), ...sparseExtra([SPARSE_SPINNER(10.4, 4.4), SPARSE_RUG(6, 4.1, 3.2, .9, GRAY, BLUE)])];

// ---- the pawnbroker: a drum kit, an amp, and a shelf of boxed games and films by the door
const SPARSE_DRUM_KIT = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawRod(vx, vy - .15, .3, vx, vy + .15, .3, .28, (i, t, L) => { BG[i] = C(RED, 2 + L * .3); return set(i, ' ', 0), true; }); // the bass drum, on its side
  dot(vx, vy - .17, .3, .2, (i, t, L) => { BG[i] = C(WHITE, 6 + L * .3); return set(i, ' ', 0), true; });
  for (const [u, v, z, r] of [[-.45, -.2, .62, .17], [.42, -.15, .58, .2], [-.15, -.3, .8, .12], [.15, -.3, .82, .12]]) {
    drum(vx + u, vy + v, r, z, z + .16, (i, t, L) => { BG[i] = HIT.face === 5 ? C(WHITE, 5) : C(RED, (2 + L * .3) * drumLit(r)); return set(i, ' ', 0), true; });
    rod(vx + u, vy + v, 0, vx + u, vy + v, z, .012, GRAY, 1.4);
  }
  for (const [u, v, z] of [[-.6, .1, 1.15], [.6, .1, 1.25]]) { rod(vx + u, vy + v, 0, vx + u, vy + v, z, .01, GRAY, 1.4); drum(vx + u, vy + v, .22, z, z + .01, (i, t, L) => { BG[i] = C(YEL, 5 + L * .4); return set(i, ' ', 0), true; }); } // the cymbals
}, [.65, .4, 1.2]);
const SPARSE_AMP = (x, y, fy) => ROOM_MODEL(x, y, (vx, vy) => drawBox(boxAt(vx, vy, 1, 0, .3, .17, 0, .65), (i, t, L) => {
  const f = HIT.face; BG[i] = C(GRAY, .6 + L * .15); set(i, ' ', 0);
  if ((fy > 0 ? f === 4 : f === 3) && HIT.w < .52) BG[i] = C(BRICK, .9 + ((Math.abs(fract(HIT.u * 20) - .5) < .15) ? .3 : 0)); // the cloth
  if ((fy > 0 ? f === 4 : f === 3) && HIT.w > .56 && Math.abs(HIT.u) < .25) { BG[i] = C(YEL, 4); if (Math.abs(fract(HIT.u * 12) - .5) < .2) set(i, 'o', C(GRAY, 1)); }
  return true;
}), [.3, .17, .65]);
const SPARSE_PAWN_PROPS = ROOM_DEFS.pawn.props;
ROOM_DEFS.pawn.props = r => [...SPARSE_PAWN_PROPS(r), ...sparseExtra([SPARSE_DRUM_KIT(8.6, 7.3), SPARSE_AMP(7.4, 7.6, -1), SPARSE_PARCEL_SHELF(1.3, 7.2, .5, 0, 1)])];

// ---- the off-licence: a stacked display of wine cases by the door with a SALE card
const SPARSE_CASE_STACK = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  const box = (u, v, z, col) => drawBox(boxAt(vx + u, vy + v, 1, 0, .22, .16, z, z + .3), (i, t, L) => { BG[i] = C(col, (2.2 + L * .25) * shadeFace(HIT.face) + (HIT.face === 5 ? .4 : 0)); return set(i, HIT.face === 4 && Math.abs(HIT.w - z - .15) < .03 && Math.abs(HIT.u) < .12 ? '~' : ' ', C(RED, 6)), true; });
  for (const [u, v] of [[-.23, -.17], [.23, -.17], [-.23, .17], [.23, .17]]) box(u, v, 0, BRICK);
  for (const [u, v] of [[0, -.17], [0, .17]]) box(u, v, .3, YEL);
  box(0, 0, .6, BRICK);
  drawBox(boxAt(vx, vy + .35, 1, 0, .22, .01, .55, .85), (i, t, L) => { BG[i] = C(WHITE, 10); return wallTextFlat(i, HIT.u, HIT.w - .76, 'SALE', .36) ? (COL[i] = C(RED, 12), true) : (set(i, ' ', 0), true); });
}, [.46, .34, .9]);
const SPARSE_LIQUOR_PROPS = ROOM_DEFS.liquor.props;
ROOM_DEFS.liquor.props = r => [...SPARSE_LIQUOR_PROPS(r), ...sparseExtra([SPARSE_CASE_STACK(4.4, 5.9)])];

// ---- the jeweller: a long-case clock ticking in the corner, flowers on a stand
const SPARSE_LONGCASE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .24, .18, 0, 2.05), (i, t, L) => {
    const f = HIT.face, w = HIT.w; BG[i] = C(BRICK, (1.4 + L * .25) * shadeFace(f)); set(i, ' ', 0);
    if (f === 4 && w > 1.55 && w < 1.95) { const r = Math.hypot(HIT.u, w - 1.75); if (r < .17) { const ang = Math.atan2(w - 1.75, HIT.u), mn = Math.PI / 2 - fract(tod) * TAU, hr = Math.PI / 2 - (tod % 12) / 12 * TAU; const hand = (r < .1 && Math.abs(Math.sin(ang - hr)) < .12 && Math.cos(ang - hr) > 0) || (r < .15 && Math.abs(Math.sin(ang - mn)) < .09 && Math.cos(ang - mn) > 0); BG[i] = hand ? C(GRAY, 1) : r > .15 ? C(YEL, 6) : C(WHITE, 9); } }
    if (f === 4 && w > .5 && w < 1.4 && Math.abs(HIT.u) < .12) { const sw = Math.sin(T * Math.PI) * .07; BG[i] = C(BRICK, .7); if (Math.hypot(HIT.u - sw, w - .7) < .06) BG[i] = C(YEL, 8); else if (Math.abs(HIT.u - sw * (w - .7) / -.7 - sw) < .01 && w > .7) BG[i] = C(YEL, 5); } // the pendulum, swinging behind the glass
    return true;
  });
  drawBox(boxAt(vx, vy, 1, 0, .27, .2, 2.05, 2.15), SPARSE_FILL(BRICK, 1.2));
}, [.27, .2, 2.15]);
const SPARSE_FLOWERS = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, .18, 0, .9, (i, t, L) => { BG[i] = C(WHITE, (3.5 + L * .3) * drumLit(.18)); return set(i, ' ', 0), true; });
  drum(vx, vy, .08, .9, 1.15, (i, t, L) => { BG[i] = C(CYAN, 2.5 + L * .3); return set(i, ' ', 0), true; });
  for (let k = 0; k < 9; k++) { const a = k * 2.4, r = .06 + (k % 3) * .06, fx = vx + Math.cos(a) * r, fy = vy + Math.sin(a) * r, fz = 1.35 + (k % 4) * .07;
    rod(vx, vy, 1.1, fx, fy, fz, .006, GREEN, 1); dot(fx, fy, fz, .05, (i, t, L) => { BG[i] = C([RED, WHITE, MAG][k % 3], 5 + L * .4); return set(i, ' ', 0), true; }); }
}, [.2, .2, 1.4]);
const SPARSE_JEWEL_PROPS = ROOM_DEFS.jeweler.props;
ROOM_DEFS.jeweler.props = r => [...SPARSE_JEWEL_PROPS(r), ...sparseExtra([SPARSE_LONGCASE(1.45, 1.35), SPARSE_FLOWERS(8.4, 1.4), SPARSE_RUG(5, 4.2, 1.6, .7, RED, YEL)])];

// ---- the hotel lobby: a seating group on a rug, a luggage trolley by the lift, the clocks of other cities over the
// way up
const SPARSE_LUGGAGE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .45, .28, .1, .14), (i, t, L) => { BG[i] = HIT.face === 5 ? C(RED, 2.2) : C(YEL, 5 + L * .3); return set(i, ' ', 0), true; });
  for (const e of [-1, 1]) for (const g of [-1, 1]) drum(vx + e * .38, vy + g * .22, .05, 0, .1, SPARSE_FILL(GRAY, .4));
  for (const e of [-1, 1]) { rod(vx + e * .42, vy - .25, .14, vx + e * .42, vy - .25, 1.8, .018, YEL, 2); rod(vx + e * .42, vy + .25, .14, vx + e * .42, vy + .25, 1.8, .018, YEL, 2); }
  for (const e of [-1, 1]) rod(vx + e * .42, vy - .25, 1.8, vx + e * .42, vy + .25, 1.8, .018, YEL, 2);
  rod(vx - .42, vy, 1.8, vx + .42, vy, 1.8, .018, YEL, 2); // the hanging rail
  drawBox(boxAt(vx - .12, vy, 1, 0, .25, .18, .14, .75), SPARSE_FILL(BLUE, 1.1)); // a suitcase
  drawBox(boxAt(vx + .22, vy + .02, 1, 0, .16, .13, .14, .5), SPARSE_FILL(BRICK, 1.1)); // a smaller one
  drawBox(boxAt(vx + .3, vy, 1, 0, .02, .2, .9, 1.75), SPARSE_FILL(GRAY, .6)); // a suit in its bag
}, [.47, .3, 1.85]);
const SPARSE_HOTEL_PROPS = ROOM_DEFS.hotel.props, SPARSE_HOTEL_WALL = ROOM_DEFS.hotel.wall;
const SPARSE_CITIES = [['TOKYO', 9], ['LONDON', -6], ['NEW YORK', -11]];
ROOM_DEFS.hotel.wall = (i, u, uStep, z, d, mx, my, L) => {
  if (my === 0 && u > 7.3 && u < 9.9 && z > 1.75 && z < 2.45) {
    for (const [k, [name, off]] of SPARSE_CITIES.entries()) {
      const cu = 7.8 + k * .8, r = Math.hypot(u - cu, z - 2.2);
      if (r < .2) { const h = ((tod + off) % 12 + 12) % 12, ang = Math.atan2(z - 2.2, u - cu), hr = Math.PI / 2 - h / 12 * TAU, mn = Math.PI / 2 - fract(tod) * TAU; const hand = (r < .11 && Math.abs(Math.sin(ang - hr)) < .12 && Math.cos(ang - hr) > 0) || (r < .16 && Math.abs(Math.sin(ang - mn)) < .09 && Math.cos(ang - mn) > 0); BG[i] = r > .17 ? C(YEL, 6) : hand ? C(GRAY, 1) : C(WHITE, 10); return set(i, ' ', 0), true; }
      if (Math.abs(u - cu) < .38 && z < 1.98 && wallText(i, u, uStep, z, d, name, cu, 1.88, .06, .08, C(YEL, 12))) return true;
    }
  }
  return SPARSE_HOTEL_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.hotel.props = r => [...SPARSE_HOTEL_PROPS(r), ...sparseExtra(fillSeats([
  SPARSE_RUG(3.0, 6.0, 1.75, .85, RED, YEL), ...couch(3.0, 6.55, .9, 0, -1, BLUE), ...armchair(4.45, 5.75, -1, 0, BLUE), ...tableBox(3.0, 5.7, .5, .3),
  SPARSE_LUGGAGE(8.6, 2.0),
], .35))];

// ---- the motel office: a rug where the chairs are
const SPARSE_ICE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .32, .3, 0, 1.3), (i, t, L) => {
    const f = HIT.face; BG[i] = C(WHITE, (3.4 + L * .3) * shadeFace(f)); set(i, ' ', 0);
    if (f === 1 && HIT.w > .9 && HIT.w < 1.15) return wallTextFlat(i, -HIT.v, HIT.w - 1.02, 'ICE', .4) ? (COL[i] = C(BLUE, 8), true) : true;
    if (f === 1 && HIT.w > .35 && HIT.w < .75 && Math.abs(HIT.v) < .22) BG[i] = C(GRAY, 1.6 + (fract(HIT.w * 10) < .15 ? .6 : 0)); // the bin door
    return true;
  });
}, [.32, .3, 1.3]);
const SPARSE_MOTEL_PROPS = ROOM_DEFS.motel.props;
ROOM_DEFS.motel.props = r => [...SPARSE_MOTEL_PROPS(r), ...sparseExtra([SPARSE_RUG(2.3, 6, 1.2, .8, BRICK, ORANGE)])];
