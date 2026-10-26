// Shop windows with depth: behind the glass, a display bay 70 cm deep with its floor raised as a plinth, the shop's
// goods standing on it at their own depth (so they slide against the back as you walk past), and the lit shop beyond.
// Shared by every facade family's shop windows up close (SHOP_WINDOW.near); further off they stay flat glass.
// u0..u1: the pane in the wall's u; z0..z1: its glass.
const SHOP_WINDOW = { near: 3.5, dep: .07, plinth: .035, goods: .45, spacing: .085 };
const SHOP_DISPLAYS = { // what a shop puts in its window: [shape, height, half width]
  food: ['loaf', .03, .028], clothes: ['mannequin', .17, .022], books: ['stack', .05, .026], screens: ['screen', .06, .03],
  bottles: ['bottle', .07, .01], flowers: ['bunch', .08, .024], goods: ['box', .05, .025],
};
const SHOP_DISPLAY_FOR = {
  BAKERY: 'food', BAGELS: 'food', DONUTS: 'food', CAKES: 'food', DELI: 'food', DELICATESSEN: 'food', BURGERS: 'food', DINER: 'food', PIZZA: 'food',
  CAFE: 'food', COFFEE: 'food', KISSATEN: 'food', 'ICE CREAM': 'food', DUMPLINGS: 'food', BENTO: 'food', CHICKEN: 'food', KEBAB: 'food',
  THRIFT: 'clothes', BOUTIQUE: 'clothes', TAILOR: 'clothes', SHOES: 'clothes', BARBER: 'clothes', JEWELER: 'clothes',
  BOOKS: 'books', MANGA: 'books', VIDEO: 'screens', RECORDS: 'screens', ARCADE: 'screens', PHONES: 'screens',
  LIQUOR: 'bottles', BAR: 'bottles', JUICE: 'bottles', DRUGSTORE: 'bottles', FLORIST: 'flowers', HERBS: 'flowers',
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
  return true; // a stack, a screen, a box
}
function shopWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed) {
  const w = SHOP_WINDOW, base = z0 + w.plinth, [su, sz] = glassSlopes(u, z), lit = open && (night > .3 || overcast > .6);
  if (z < base) { BG[i] = C(sh.neon, .8 + L * .05); return set(i, ' ', 0), true; } // the plinth's front, in its own shadow behind the glass
  const b = boxBehind(u, z, u0, u1, base, z1, w.dep), qg = w.dep * w.goods, n = Math.max(1, Math.round((u1 - u0) / w.spacing)), step = (u1 - u0) / n;
  if (b.q > qg) { // the goods, standing on the plinth, before the back
    const pu = u + su * qg, pz = z + sz * qg, [shape, ht, hw] = shopDisplay(sh);
    const k = clamp(Math.floor((pu - u0) / step), 0, n - 1), du = pu - (u0 + (k + .5) * step), tall = ht * (.75 + hash(seed, k, 1490) * .5);
    if (pz >= base && pz < z1 && shopGoodsCell(shape, du, pz - base, tall, hw)) {
      const col = shape === 'screen' ? CYAN : shape === 'mannequin' ? WHITE : ITEM_COL[(hash(seed, k, 1491) * 8) | 0];
      if (shape === 'screen') { BG[i] = C(BLUE, 4 + Math.sin(T * 5 + k) * 2 + (lit ? 3 : 0)); return set(i, Math.abs(du) > hw - .004 || pz - base < .004 ? '|' : ' ', C(GRAY, 3)), true; }
      if (shape === 'stack') { BG[i] = C(ITEM_COL[(Math.floor((pz - base) * 120) + k) & 7], 2.4 + L * .15); return set(i, fract((pz - base) * 120) < .2 ? '_' : ' ', C(GRAY, 2)), true; }
      BG[i] = C(col, (shape === 'mannequin' ? 3.2 : 2.4) + L * .18 + (lit ? 1.5 : 0)); return set(i, ' ', 0), true;
    }
  }
  if (b.s === 'floor') { BG[i] = C(sh.neon, 1.6 + L * .12 + (lit ? 1 : 0)); return set(i, ' ', 0), true; } // the plinth's cloth
  if (b.s === 'side') { BG[i] = C(GRAY, 1.2 + L * .1); return set(i, ' ', 0), true; }
  if (b.s === 'ceil') { const spot = lit && Math.abs(fract((b.u - u0) / step) - .5) < .12; BG[i] = spot ? C(YEL, 12) : C(GRAY, .8); return set(i, ' ', 0), true; } // spotlights
  // the back: the shop beyond, its shelves and its light
  const shelf = fract((b.z - base) * 40) < .12;
  BG[i] = C(WARM, (lit ? 2.2 + night * 2.5 : open ? 1.4 + day : .6) + (shelf ? .5 : 0));
  return set(i, shelf ? '=' : ' ', C(BRICK, L * .4)), true;
}
