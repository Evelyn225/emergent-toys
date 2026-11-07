// Shop windows with depth: behind the glass, a display bay 70 cm deep with its floor raised as a plinth, the shop's
// goods standing on it at their own depth (so they slide against the back as you walk past), and the lit shop beyond.
// Shared by every facade family's shop windows up close (SHOP_WINDOW.near); further off they stay flat glass.
// u0..u1: the pane in the wall's u; z0..z1: its glass.
const SHOP_WINDOW = { get near() { return 3.5 * lodScale(); }, dep: .07, plinth: .035, goods: .45, spacing: .085 };
const SHOP_DISPLAYS = { // what a shop puts in its window: [shape, height, half width]
  food: ['loaf', .03, .028], clothes: ['mannequin', .17, .022], books: ['stack', .05, .026], screens: ['screen', .06, .03],
  bottles: ['bottle', .07, .01], flowers: ['bunch', .08, .024], goods: ['box', .05, .025],
  pets: ['tank', .05, .034], toys: ['bear', .07, .026], pawn: ['guitar', .11, .02], tobacco: ['jar', .045, .016],
  realty: ['card', .07, .024], posters: ['poster', .12, .026], jewels: ['bust', .07, .016], sports: ['jersey', .08, .026],
  skate: ['deck', .1, .011], tyres: ['tyre', .07, .035], paint: ['can', .035, .016], gas: ['cylinder', .1, .012],
  cars: ['car', .06, .04], lobby: ['lobby', 0, 0],
};
const SHOP_DISPLAY_FOR = {
  BAKERY: 'food', BAGELS: 'food', DONUTS: 'food', CAKES: 'food', DELI: 'food', DELICATESSEN: 'food', BURGERS: 'food', DINER: 'food', PIZZA: 'food',
  CAFE: 'food', COFFEE: 'food', KISSATEN: 'food', 'ICE CREAM': 'food', DUMPLINGS: 'food', BENTO: 'food', CHICKEN: 'food', KEBAB: 'food',
  THRIFT: 'clothes', BOUTIQUE: 'clothes', TAILOR: 'clothes', SHOES: 'clothes', BARBER: 'clothes', JEWELER: 'clothes',
  BOOKS: 'books', MANGA: 'books', VIDEO: 'screens', RECORDS: 'screens', ARCADE: 'screens', PHONES: 'screens',
  LIQUOR: 'bottles', BAR: 'bottles', JUICE: 'bottles', DRUGSTORE: 'bottles', FLORIST: 'flowers', HERBS: 'flowers',
  'PET SHOP': 'pets', TOYS: 'toys', GACHA: 'toys', 'CRANE GAME': 'toys', PAWN: 'pawn', TOBACCO: 'tobacco', REALTY: 'realty',
  CINEMA: 'posters', TATTOO: 'posters', JEWELER: 'jewels', JADE: 'jewels', ANTIQUES: 'jewels', SPORTS: 'sports', SKATE: 'skate',
  TIRES: 'tyres', 'AUTO REPAIR': 'tyres', HARDWARE: 'paint', WELDING: 'gas', CARS: 'cars', PHARMACY: 'bottles',
  HOTEL: 'lobby', MOTEL: 'lobby', BANK: 'lobby', CAPSULE: 'lobby', GYM: 'lobby', STORAGE: 'lobby', LAUNDRY: 'lobby',
};
const shopDisplay = sh => SHOP_DISPLAYS[SHOP_DISPLAY_FOR[sh.word] || 'goods'];
// does a point on the goods' plane fall on one of them? (du from the item's middle, h up from the plinth)
function shopGoodsCell(shape, du, h, ht, hw) {
  const a = Math.abs(du);
  if (h < 0 || h > ht || a > hw) return false;
  if (shape === 'loaf') return a < hw * Math.sqrt(1 - (h / ht) ** 2); // a round top
  if (shape === 'mannequin') return h > ht * .86 ? Math.hypot(du, h - ht * .93) < ht * .07 : h > ht * .45 ? a < hw * (h > ht * .8 ? .45 : 1) : a < hw * .25; // head, body, stand
  if (shape === 'bottle') return h > ht * .6 ? a < hw * .4 : true;
  if (shape === 'bunch') return h > ht * .45 ? Math.hypot(du / hw, (h - ht * .72) / (ht * .28)) < 1 : a < hw * .3; // the flowers on their stems
  if (shape === 'bear') return h > ht * .58 ? Math.hypot(du, h - ht * .78) < hw * .62 || h > ht * .9 && Math.abs(a - hw * .5) < hw * .2 : Math.hypot(du / hw, (h - ht * .3) / (ht * .3)) < 1; // head and ears, a round body
  if (shape === 'guitar') return h < ht * .45 ? Math.hypot(du / hw, (h - ht * .2) / (ht * .2)) < 1 || Math.hypot(du / (hw * .8), (h - ht * .4) / (ht * .1)) < 1 : a < hw * .16 || h > ht * .9 && a < hw * .3; // body, neck, head
  if (shape === 'jar') return h > ht * .88 ? a < hw * .75 : a < hw * Math.min(1, .7 + Math.sin(h / ht * Math.PI) * .4); // a lidded glass jar
  if (shape === 'card') return h > ht * .3 ? true : a < hw * .08; // a listing card on its stand
  if (shape === 'bust') return h > ht * .45 ? Math.hypot(du / (hw * .65), (h - ht * .72) / (ht * .26)) < 1 : a < hw * (.25 + h / ht); // a velvet neck on its stand
  if (shape === 'jersey') return h > ht * .7 ? a < hw && (h < ht * .92 || a > hw * .3) : a < hw * .7; // sleeves and the body, the neck cut out
  if (shape === 'deck') return h > ht - hw ? Math.hypot(du, h - (ht - hw)) < hw : h < hw ? Math.hypot(du, h - hw) < hw : true; // a board stood on its tail
  if (shape === 'tyre') return Math.hypot(du / hw, (h - ht / 2) / (ht / 2)) < 1; // stood on its tread
  if (shape === 'can') return true;
  if (shape === 'cylinder') return h > ht - hw ? Math.hypot(du, h - (ht - hw)) < hw || a < hw * .3 && h < ht + .006 : true; // a bottle with its valve
  if (shape === 'car') return h < ht * .55 ? a < hw && (h > ht * .12 || Math.abs(a - hw * .62) > hw * .2) : a < hw * .6 - (h - ht * .55) / ht * hw * .5; // the body over its wheels, the cabin on top
  return true; // a stack, a screen, a box
}
// the colour of a display item at du across it, h up it (0..1 of its height): each kind painted as it is
function shopGoodsColour(shape, du, h, hw, k, seed, L, lit, round) {
  const a = Math.abs(du), g = (2.4 + L * .18 + (lit ? 1.5 : 0)) * round, pick = (arr, j = 0) => arr[(hash(seed, k + j * 31, 1493) * arr.length) | 0];
  switch (shape) {
    case 'tank': { // water, fish drifting, the gravel and the lid
      if (h > .92) return C(GRAY, 1.6 + L * .1);
      if (h < .15) return C(pick([YEL, BRICK, STONE]), g * .9);
      const fish = Math.abs(fract(du / hw * .5 + T * .15 * (k & 1 ? 1 : -1) + hash(seed, k, 1494)) - .5) < .06 && Math.abs(h - .35 - hash(seed, k, 1495) * .4) < .07;
      return fish ? C(pick([ORANGE, YEL, RED]), 12) : C(CYAN, g * 1.2 + (fract(h * 9 + T * .5 + du * 40) < .08 ? 2 : 0));
    }
    case 'bear': return C(h > .9 && a > hw * .3 ? BRICK : pick([BRICK, YEL, MAG, WHITE]), g * (h > .66 && h < .74 && a < hw * .12 ? .4 : 1)); // (its nose)
    case 'guitar': return h < .45 && Math.hypot(du, (h - .3) * hw * 4) < hw * .22 ? C(GRAY, .6) : C(h > .45 ? BRICK : pick([ORANGE, RED, YEL, BRICK]), g); // (the sound hole)
    case 'jar': return h > .88 ? C(GRAY, g * .8) : h < .55 ? C(BRICK, g * .7) : C(WARM, g * 1.1); // the leaf low in it, the glass above
    case 'card': return h < .3 ? C(GRAY, 1.6) : h > .55 && a < hw * .6 ? (h > .82 && a < hw * (1 - (h - .82) * 3) * .6 ? C(RED, g) : C(pick([STONE, BRICK, WHITE]), g)) : C(WHITE, g * 1.4); // a photo of the house, the details under it
    case 'poster': return h > .82 ? C(WHITE, g * 1.3) : C(fract(h * 3 + hash(seed, k, 1496)) < .5 ? pick([MAG, RED, BLUE]) : pick([YEL, CYAN, ORANGE], 1), g * 1.2); // a title band over the picture
    case 'bust': { const chain = h > .42 && h < .62 && Math.abs(Math.abs(du) - hw * .45 * (1 - (h - .42) * 2)) < hw * .18, glint = chain && fract(du * 300 + h * 90 + T * .7) < .35; return glint ? C(pick([YEL, WHITE, GREEN]), 14) : chain ? C(YEL, g * 1.3) : C(MAG, g * .95); } // black velvet, a gold chain round its neck catching the light
    case 'jersey': return h > .5 && h < .62 ? C(WHITE, g * 1.3) : C(pick([RED, BLUE, GREEN, YEL]), g); // a band across the chest
    case 'deck': return C(fract(h * 4 + hash(seed, k, 1497)) < .5 ? pick([RED, MAG, CYAN]) : pick([YEL, WHITE, GREEN], 1), g * 1.1); // the graphic
    case 'tyre': { const r = Math.hypot(du / hw, (h - .5) * 2); return r < .45 ? C(GRAY, g * 1.2) : C(GRAY, (fract(Math.atan2(h - .5, du) * 3) < .5 ? .7 : .9) + L * .05); } // the hub, the tread
    case 'can': return h > .85 ? C(GRAY, g * 1.1) : h > .25 && h < .7 ? C(pick([RED, BLUE, YEL, GREEN, WHITE]), g * 1.2) : C(GRAY, g * .9); // the label's colour
    case 'cylinder': return h > .85 ? C(GRAY, g) : C(pick([GREEN, RED, BLUE, GRAY]), g * (a > hw * .7 ? .7 : 1));
    case 'car': return h < .12 ? C(GRAY, .6) : h > .55 ? C(CYAN, g * .9) : C(pick([RED, BLUE, WHITE, YEL]), g * 1.2); // tyres, glass, paint
  }
  return null;
}
function shopWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed) {
  shopWindowBehind(i, u, z, u0, u1, z0, z1, sh, open, L, seed);
  // the glass in front of it all: a soft streak or two of reflected sky, the same as on the shop's other panes
  const diag = (u - u0) * .8 + z, f = fract(diag * 2.2 + seed * .37), streak = Math.max(0, 1 - Math.abs(f - .3) / .07) * .7 + Math.max(0, 1 - Math.abs(f - .42) / .025) * .5;
  if (streak > .05) BG[i] = C(BG[i] >> 4, (BG[i] & 15) + streak * (1.2 + day));
  return true;
}
// a hotel's, a bank's, a gym's window: no goods in it, the lit lobby beyond: carpet, a warm wall with framed pictures
// along it and a potted plant now and then
function shopLobbyWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed, lit) {
  const b = boxBehind(u, z, u0, u1, z0, z1, SHOP_WINDOW.dep * 2.2), glow = lit ? 2.6 + night * 2.5 : open ? 1.8 + day : .6;
  if (b.s === 'floor') { BG[i] = C(sh.neon === WHITE ? BRICK : sh.neon, glow * .55 + (fract(b.u * 60 + b.q * 60) < .1 ? .3 : 0)); return; } // the carpet
  if (b.s === 'ceil') { BG[i] = lit && Math.abs(fract((b.u - u0) * 8) - .5) < .08 ? C(YEL, 12) : C(WARM, glow * .5); return; }
  if (b.s === 'side') { BG[i] = C(WARM, glow * .7); return; }
  const fu = b.u - u0, fz = (b.z - z0) / (z1 - z0), bay = Math.floor(fu / .07), cu = fract(fu / .07) - .5;
  if (hash(seed, bay, 1498) > .55 && fz < .45 && Math.abs(cu) < .3) { BG[i] = fz < .15 ? C(BRICK, glow * .8) : C(GREEN, glow * (.7 + hash(Math.floor(fu * 200), Math.floor(fz * 30), 1499) * .4)); return; } // a pot and its plant
  if (fz > .5 && fz < .8 && Math.abs(cu) < .22) { BG[i] = Math.abs(cu) > .18 || fz < .53 || fz > .77 ? C(YEL, glow * .9) : C(ITEM_COL[(hash(seed, bay, 1500) * 8) | 0], glow * .9); return; } // a framed picture
  BG[i] = C(WARM, glow * (.95 - fz * .2) + (fz < .05 ? -.4 : 0)); // the wall, a skirting board
}
function shopWindowBehind(i, u, z, u0, u1, z0, z1, sh, open, L, seed) {
  if (shopSceneWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed)) return; // a restaurant, café, bar, market...: its room (shop-scenes.js)
  const w = SHOP_WINDOW, base = z0 + w.plinth, [su, sz] = glassSlopes(u, z), lit = open && (night > .3 || overcast > .6);
  set(i, ' ', 0);
  if (shopDisplay(sh)[0] === 'lobby') return shopLobbyWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed, lit);
  if (z < base) { BG[i] = C(sh.neon, .8 + L * .05 + (base - z < .004 ? .6 : 0)); return; } // the plinth's front, in its own shadow behind the glass, its lip catching the light
  const b = boxBehind(u, z, u0, u1, base, z1, w.dep), qg = w.dep * w.goods, n = Math.max(1, Math.round((u1 - u0) / w.spacing)), step = (u1 - u0) / n;
  if (b.q > qg) { // the goods, standing on the plinth, before the back
    const pu = u + su * qg, pz = z + sz * qg, [shape, ht, hw] = shopDisplay(sh);
    const k = clamp(Math.floor((pu - u0) / step), 0, n - 1), du = pu - (u0 + (k + .5) * step), tall = ht * (.75 + hash(seed, k, 1490) * .5);
    if (pz >= base && pz < z1 && shopGoodsCell(shape, du, pz - base, tall, hw)) {
      const h = (pz - base) / tall, col = shape === 'mannequin' ? WHITE : ITEM_COL[(hash(seed, k, 1491) * 8) | 0];
      const round = 1 + .32 * clamp(-du / hw, -1, 1) + .18 * (h - .5); // lit from the upper left, as everything here is
      if (shape === 'screen') { const edge = Math.abs(du) > hw - .004 || pz - base < .004; BG[i] = edge ? C(GRAY, 1.4) : C(BLUE, 4 + Math.sin(T * 5 + k) * 2 + (lit ? 3 : 0) + h); return; } // a screen in its bezel
      if (shape === 'stack') { const book = Math.floor((pz - base) * 120) + k; BG[i] = C(ITEM_COL[book & 7], (2.4 + L * .15) * (fract((pz - base) * 120) < .2 ? .75 : 1) * round); return; } // books, their page edges in shadow
      const painted = shopGoodsColour(shape, du, h, hw, k, seed, L, lit, round); if (painted != null) { BG[i] = painted; return; }
      BG[i] = C(col, ((shape === 'mannequin' ? 3.2 : 2.4) + L * .18 + (lit ? 1.5 : 0)) * round); return;
    }
  }
  if (b.s === 'floor') { BG[i] = C(sh.neon, 1.6 + L * .12 + (lit ? 1 : 0)); return; } // the plinth's cloth
  if (b.s === 'side') { BG[i] = C(GRAY, 1.2 + L * .1); return; }
  if (b.s === 'ceil') { const spot = lit && Math.abs(fract((b.u - u0) / step) - .5) < .12; BG[i] = spot ? C(YEL, 12) : C(GRAY, .8); return; } // spotlights
  // the back: the shop beyond, shelves of its goods in its light
  const sz2 = (b.z - base) * 40, shelf = fract(sz2) < .12, item = hash(Math.floor((b.u - u0) * 90), Math.floor(sz2), seed + 1492);
  const glow = lit ? 2.2 + night * 2.5 : open ? 1.4 + day : .6;
  BG[i] = shelf ? C(BRICK, glow * .7 + .4) : item > .45 && fract(sz2) > .3 ? C(ITEM_COL[(item * 97) & 7], glow * .85 + .3) : C(WARM, glow);
}
