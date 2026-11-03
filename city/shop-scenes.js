// What you see through the window of the shops that aren't shops of goods (pass 13 follow-up): a restaurant shows its
// dining room and kitchen, a café its tables and espresso machine, a bar its back bar, a market its produce, a
// laundromat its machines, a barber's its chairs, a bank its counter, a gym its weights. Everything is colour, at its
// own depth behind the glass (glassSlopes / boxBehind, as the shop windows), so it slides as you walk past.
// City units: 1 = 10 m; h is height above the shop's floor.
const SHOP_SCENES = {
  //            floor         wall          tables     back        lamps
  sushi:    { floor: 'wood',  wall: [STONE, 1.8], tables: 'stools',  back: 'sushi',    lamps: 'pendant', counter: [WARM, 3.2] },
  noodle:   { floor: 'tile',  wall: [BRICK, 1.5], tables: 'two',  back: 'noodle',   lamps: 'lantern', counter: [WARM, 2.6] },
  pizza:    { floor: 'check', wall: [BRICK, 1.8], tables: 'cloth', back: 'oven',    lamps: 'pendant', counter: [STONE, 3] },
  diner:    { floor: 'check', wall: [WHITE, 2.2], tables: 'booth', back: 'diner',   lamps: 'tube',    counter: [RED, 3] },
  cafe:     { floor: 'wood',  wall: [STONE, 2],   tables: 'cafe',  back: 'espresso', lamps: 'pendant', counter: [WARM, 2.8] },
  bar:      { floor: 'wood',  wall: [BRICK, 1.1], tables: 'stools',  back: 'bar',      lamps: 'pendant', counter: [WARM, 2.2] },
  laundry:  { floor: 'tile',  wall: [CYAN, 2.2],  tables: 'fold',  back: 'washers',  lamps: 'tube' },
  barber:   { floor: 'check', wall: [WHITE, 2.4], tables: 'none',  back: 'barber',   lamps: 'tube' },
  bank:     { floor: 'stone', wall: [STONE, 2.6], tables: 'none',  back: 'bank',     lamps: 'pendant', counter: [STONE, 3.4] },
  gym:      { floor: 'mat',   wall: [GRAY, 2.4],  tables: 'none',  back: 'gym',      lamps: 'tube' },
  market:   { floor: 'tile',  wall: [WHITE, 2.2], tables: 'none',  back: 'market',   lamps: 'tube', front: 'crates' },
  garage:   { floor: 'stone', wall: [GRAY, 1.8],  tables: 'lift',  back: 'tools',    lamps: 'tube' },
  storage:  { floor: 'stone', wall: [GRAY, 1.2],  tables: 'none',  back: 'racking',  lamps: 'tube' },
};
const SHOP_SCENE_FOR = {
  SUSHI: 'sushi', 'DIM SUM': 'noodle', RAMEN: 'noodle', NOODLES: 'noodle', PHO: 'noodle', THAI: 'noodle', DUMPLINGS: 'noodle', IZAKAYA: 'noodle',
  YAKITORI: 'noodle', TAKOYAKI: 'noodle', BENTO: 'noodle', 'TEA HOUSE': 'noodle', TACOS: 'diner', PIZZA: 'pizza',
  DINER: 'diner', BURGERS: 'diner', CHICKEN: 'diner', KEBAB: 'diner', CAFE: 'cafe', COFFEE: 'cafe', KISSATEN: 'cafe', JUICE: 'cafe',
  BAR: 'bar', KARAOKE: 'bar', MAHJONG: 'bar', LAUNDRY: 'laundry', BARBER: 'barber', BANK: 'bank', EXCHANGE: 'bank', GYM: 'gym',
  GROCERY: 'market', MARKET: 'market', FRUIT: 'market', BODEGA: 'market',
  'AUTO REPAIR': 'garage', TIRES: 'garage', WELDING: 'garage', CARS: 'garage', STORAGE: 'storage',
};
let sceneOverride = null; // (an open warehouse door with no shop room of its own: its racking, industrial-facades.js)
const shopSceneFor = sh => SHOP_SCENES[SHOP_SCENE_FOR[sh.word]] || sceneOverride;
const SCENE = { dep: .34, tableQ: .09, table2Q: .19, counterQ: .24, spacing: .13 };
const SHIRTS = [RED, BLUE, GREEN, WHITE, YEL, MAG, CYAN, GRAY, ORANGE];

// a person seated at a table or stool, seen from the street: head and shoulders over the table top. du across from
// their middle, h above the floor. Returns a colour or -1
function sceneDiner(du, h, seed, k, back, L, glow) {
  const shirt = SHIRTS[(hash(seed, k, 1601) * SHIRTS.length) | 0], hair = hash(seed, k, 1602) > .5 ? BLACK : BRICK;
  if (Math.hypot(du, h - .118) < .012) return back || h > .124 ? C(hair, hair === BLACK ? 0 : 1.5 + glow * .3) : C(SKIN, 2.4 + glow * .6 + (du < 0 ? .5 : 0)); // the head (from behind: the hair)
  if (h > .068 && h < .107 && Math.abs(du) < .016 + (h < .095 ? .004 : 0)) return C(shirt, (1.8 + glow * .5) * (du < 0 ? 1.15 : .9)); // the shoulders and body
  return -1;
}
// the floor, as far as it's seen past the tables
function sceneFloor(st, bu, bq, glow) {
  if (st.floor === 'check') return C((Math.floor(bu * 40) + Math.floor(bq * 40)) & 1 ? WHITE : BLACK, ((Math.floor(bu * 40) + Math.floor(bq * 40)) & 1) ? 2 + glow * .6 : 0);
  if (st.floor === 'wood') return C(WARM, 1.4 + glow * .5 - (fract(bu * 30) < .1 ? .5 : 0));
  if (st.floor === 'stone') return C(STONE, 2 + glow * .5 - (fract(bu * 10) < .04 || fract(bq * 10) < .04 ? .6 : 0));
  if (st.floor === 'mat') return C(GRAY, .8 + glow * .2);
  return C(GRAY, 1.6 + glow * .5 - (fract(bu * 25) < .08 || fract(bq * 25) < .08 ? .5 : 0)); // tiles
}
// the back wall, with what stands against it (bu along it, h up it, k the bay)
function sceneBack(st, bu, h, seed, glow, lit, L) {
  const [wc, wl] = st.wall, wall = C(wc, wl * (.5 + glow * .3) + .3), ctr = st.counter, ctrTop = .1;
  const k = Math.floor(bu / .1), fu = fract(bu / .1) - .5;
  switch (st.back) {
    case 'sushi': { // a wooden counter, the glass case of fish on it, the chef in white behind, a noren over the kitchen door
      if (h < ctrTop) return C(ctr[0], ctr[1] * (.5 + glow * .3) - (h > ctrTop - .006 ? -.8 : 0));
      if (h < ctrTop + .022) { const fish = Math.abs(fract(bu * 30) - .5) < .3 && h < ctrTop + .012; return fish ? C([RED, ORANGE, WHITE, ORANGE][Math.floor(bu * 30) & 3], 4 + glow) : C(CYAN, 1.8 + glow * .8 + (h > ctrTop + .018 ? 1 : 0)); } // the case: slices of fish on ice under the glass
      if (hash(seed, k, 1610) > .45) { const c = sceneDiner(fu * .1, h - .03, seed, k + 50, false, L, glow); if (c >= 0) return (c >> 4) === SKIN ? c : C(WHITE, 4 + glow); } // the chef, all in white
      if (h > .17 && h < .23 && Math.abs(fract(bu * 4) - .5) < .2) return C(BLUE, 2 + glow * .5 - (fract(bu * 40) < .1 ? .6 : 0)); // the noren, split in strips
      return wall;
    }
    case 'noodle': { // the counter, steam off the pots, menu boards on the wall, red lanterns
      if (h < ctrTop) return C(ctr[0], ctr[1] * (.5 + glow * .3) + (h > ctrTop - .006 ? .8 : 0));
      if (h < .16 && Math.abs(fu) < .25 && noise(bu * 40, h * 30 - T * .8, seed) > .55 - (.16 - h) * 3) return C(WHITE, 3 + glow); // steam
      if (h > .2 && h < .245 && Math.abs(fu) < .32) return fract((h - .2) * 140) < .25 ? C(BLACK, 0) : C(WHITE, 3.5 + glow); // menu boards, lines of print
      return wall;
    }
    case 'oven': { // a domed wood-fired oven glowing in a tiled wall, the counter before it
      const ou = fract(bu / .3) - .5, arch = Math.hypot(ou * .3 / .05, (h - .11) / .05);
      if (h < ctrTop * .9 && Math.abs(ou) > .25) return C(ctr[0], ctr[1] * (.5 + glow * .3));
      if (arch < 1 && h > .1) return C(noise(bu * 30, h * 30 - T, seed) > .5 ? YEL : ORANGE, 8 + noise(bu * 20, T * 2, seed) * 5); // the fire
      if (arch < 1.4) return C(BRICK, 2.4 + glow * .5); // the dome's mouth
      return C(WHITE, 2 + glow * .5 - (fract(bu * 50) < .1 || fract(h * 50) < .1 ? .5 : 0)); // white tiles
    }
    case 'diner': { // a counter with red stools, a pie case, the kitchen pass behind, a menu board
      if (h < .055 && Math.abs(fu) < .14) return C(RED, 3 + glow * .6 + (h > .049 ? 1 : 0)); // a stool
      if (h < ctrTop) return h > ctrTop - .008 ? C(STONE, 4 + glow) : C(ctr[0], ctr[1] * (.5 + glow * .3) - (fract(bu * 60) < .2 ? .5 : 0));
      if (h < ctrTop + .03 && Math.abs(fu) < .3 && (k & 1)) return C(CYAN, 2 + glow) ; // a pie case
      if (h > .19 && h < .24) return fract((h - .19) * 120) < .25 ? C(BLACK, 0) : C(YEL, 5 + glow); // the menu board
      if (h > .13 && h < .17) return C(GRAY, 3 + glow); // the steel pass
      return wall;
    }
    case 'espresso': { // a counter, the espresso machine's chrome on it, a pastry case, a chalkboard menu
      if (h < ctrTop) return C(ctr[0], ctr[1] * (.5 + glow * .3) + (h > ctrTop - .006 ? .8 : 0));
      if (h < ctrTop + .045 && Math.abs(fract(bu / .4) - .3) < .08) return C(GRAY, 4 + glow * 1.5 + (fract(bu / .4) < .3 ? 1 : 0)); // the machine, lit down one side
      if (h < ctrTop + .03 && Math.abs(fract(bu / .4) - .7) < .1) return h < ctrTop + .018 && fract(bu * 60) < .6 ? C([BRICK, YEL, WARM][Math.floor(bu * 60) % 3], 4 + glow) : C(CYAN, 2 + glow); // pastries in a case
      if (h > .18 && h < .24 && Math.abs(fu) < .4) return fract((h - .18) * 160) < .2 && Math.abs(fu) < .32 ? C(WHITE, 4) : C(GREEN, .8); // the chalkboard
      return wall;
    }
    case 'bar': { // the back bar: shelves of lit bottles in front of a mirror, the bar itself, stools
      if (h < .05 && Math.abs(fu) < .12) return C(GRAY, 1.6 + glow * .3); // a stool
      if (h < ctrTop) return C(ctr[0], ctr[1] * (.5 + glow * .3) + (h > ctrTop - .006 ? .8 : 0));
      const shelf = fract((h - .12) / .04);
      if (h > .12 && h < .24) { if (shelf < .12) return C(WARM, 3 + glow); const b = hash(Math.floor(bu * 70), Math.floor((h - .12) / .04), seed + 1611); if (b > .35 && Math.abs(fract(bu * 70) - .5) < .3 && shelf < .75) return C([GREEN, YEL, BRICK, CYAN, WHITE][(b * 50) % 5 | 0], 3 + glow * 2 + (fract(bu * 70) < .4 ? 1 : 0)); return C(CYAN, .8 + glow * .5); } // bottles lit from below, the mirror behind
      return wall;
    }
    case 'washers': { // a row of front-loading machines, round glass doors, the wash going round in them
      if (h < .1) { const mu = fract(bu / .07) - .5, d = Math.hypot(mu * .07, h - .05) / .022; if (d < 1) return d > .8 ? C(GRAY, 4 + glow) : C(hash(seed, Math.floor(bu / .07), 1612) > .4 ? (noise(bu * 80 + T * 3, h * 80, seed) > .5 ? BLUE : WHITE) : GRAY, d < .8 && hash(seed, Math.floor(bu / .07), 1612) > .4 ? 3 + glow : 1.4); return C(WHITE, 3.5 + glow - (Math.abs(mu) > .46 ? 1 : 0)); }
      if (h > .1 && h < .2 && hash(seed, Math.floor(bu / .07), 1613) > .5) { const mu = fract(bu / .07) - .5, d = Math.hypot(mu * .07, h - .15) / .02; if (d < 1) return d > .8 ? C(GRAY, 4 + glow) : C(GRAY, 1.2); if (Math.abs(mu) < .48) return C(WHITE, 3 + glow); } // dryers stacked above
      return wall;
    }
    case 'barber': { // mirrors along the wall, a shelf of bottles under them
      if (h > .1 && h < .21 && Math.abs(fu) < .4) return C(CYAN, 2.5 + glow + (fract(bu * 4 + h * 6) < .1 ? 2 : 0)); // the mirror, a streak of light across it
      if (h > .09 && h < .1) return C(WHITE, 4 + glow);
      return wall;
    }
    case 'bank': { // a marble counter with glass screens over it, a clock on the wall
      if (h < ctrTop) return C(ctr[0], ctr[1] * (.5 + glow * .3) + (noise(bu * 30, h * 30, seed) > .62 ? .8 : 0) + (h > ctrTop - .006 ? 1 : 0));
      if (h < .17 && Math.abs(fu) < .44) return C(CYAN, 1.6 + glow + (h > .16 ? 1 : 0)); // the glass
      if (Math.hypot(bu - Math.round(bu / .5) * .5, h - .21) < .018) return C(WHITE, 5 + glow); // the clock
      return C(STONE, 2.2 + glow * .5 + (noise(bu * 12, h * 12, seed) > .6 ? .6 : 0)); // marble
    }
    case 'gym': { // racks of weights, a treadmill, mirrors
      if (h < .09 && Math.abs(fu) < .4) { const plate = Math.hypot(fract(bu * 25) - .5, (h - .03) * 25) < .4; return plate ? C(BLACK, 0) : C(GRAY, 2.4 + glow); }
      if (h > .1 && h < .22) return C(CYAN, 2 + glow + (fract(bu * 3) < .05 ? -1 : 0)); // the mirrors
      return wall;
    }
    case 'tools': { // a red tool chest, pegboard of tools, tyres racked high
      if (h < .1 && Math.abs(fu) < .3) return C(RED, 3 + glow * .5 - (fract(h * 40) < .15 ? .8 : 0) + (fu < 0 ? .4 : 0)); // the tool chest's drawers
      if (h > .12 && h < .2 && Math.abs(fu) < .4) return hash(Math.floor(bu * 60), Math.floor(h * 60), seed + 1640) > .7 ? C(GRAY, 4 + glow) : C(WARM, 2 + glow * .4); // a pegboard, tools hung on it
      if (h > .21 && h < .27) { const t = Math.hypot(fract(bu * 18) - .5, (h - .24) * 18) ; if (t < .45) return t > .22 ? C(BLACK, 0) : C(GRAY, 2); } // tyres on the rack
      return wall;
    }
    case 'racking': { // pallet racking: orange uprights, blue beams, wrapped loads, a forklift's mast
      const up = fract(bu / .27) < .04, beam = fract(h / .1) < .08;
      if (up) return C(ORANGE, 3 + glow * .5);
      if (beam) return C(BLUE, 2.5 + glow * .4);
      const load = hash(Math.floor(bu / .09), Math.floor(h / .1), seed + 1641);
      if (load > .35 && fract(h / .1) < .8) return C(load > .7 ? WARM : load > .5 ? WHITE : BRICK, 1.8 + glow * .5 + (fract(h / .1) > .7 ? .5 : 0)); // pallets of boxes, shrink-wrapped
      return C(GRAY, .6 + glow * .1);
    }
    case 'market': { // shelves of goods to the ceiling, a fridge glowing at the end
      const sz2 = h * 40, shelf = fract(sz2) < .12, item = hash(Math.floor(bu * 90), Math.floor(sz2), seed + 1614);
      if (hash(seed, Math.floor(bu / .3), 1615) > .7) return C(CYAN, 2.5 + glow + (shelf ? 1 : 0)); // a drinks fridge
      return shelf ? C(GRAY, 2 + glow * .5) : item > .3 ? C(ITEM_COL[(item * 97) & 7], 2 + glow * .8) : C(WHITE, 1.5 + glow * .4);
    }
  }
  return wall;
}
// tables, chairs and people in the dining room (pu along, h up, q the layer's depth): a colour or -1
function sceneTables(st, pu, h, q, seed, glow, lit, L, open) {
  const sp = SCENE.spacing, k = Math.floor((pu + q * 7) / sp), du = (pu + q * 7) - (k + .5) * sp, layer = q > .15 ? 1 : 0, kk = k * 2 + layer;
  const busy = open ? (lit ? .7 : .45) : 0;
  switch (st.tables) {
    case 'stools': // people on stools at the counter, their backs to the street
      if (!layer) return -1;
      if (hash(seed, kk, 1624) < busy) { const c = sceneDiner(du, h - .012, seed, kk, true, L, glow); if (c >= 0) return c; }
      if (h < .065 && Math.abs(du) < (h > .058 ? .014 : .003)) return C(GRAY, 2 + glow * .5 + (h > .062 ? .8 : 0)); // the stool
      return -1;
    case 'cloth': case 'two': case 'cafe': case 'booth': {
      const tw = st.tables === 'cafe' ? .022 : .034, top = st.tables === 'cafe' ? .075 : .074;
      if (st.tables === 'booth' && h < .11 && Math.abs(Math.abs(du) - .05) < .008) return C(RED, 2.6 + glow * .6 + (h > .103 ? .8 : 0) + (du < 0 ? .3 : 0)); // the booth's backs
      for (const s of [-1, 1]) if (hash(seed, kk * 2 + (s > 0 ? 1 : 0), 1620) < busy) { const c = sceneDiner(du - s * (tw + .012), h, seed, kk * 2 + (s > 0), false, L, glow); if (c >= 0) return c; }
      if (h > top - .005 && h < top && Math.abs(du) < tw) return st.tables === 'cloth' ? C(WHITE, 3.5 + glow) : C(WARM, 2.4 + glow * .6); // the top (a white cloth, or wood)
      if (h > top && h < top + .012 && Math.abs(du) < .004 && lit) return C(YEL, 12); // a candle
      if (h > top && h < top + .006 && Math.abs(du - .01) < .004) return C(WHITE, 4 + glow); // a cup or a glass
      if (h < top - .005 && (Math.abs(du) < .003 || st.tables !== 'cafe' && Math.abs(Math.abs(du) - tw + .004) < .003)) return C(GRAY, 1.2 + glow * .3); // its leg(s)
      if (st.tables !== 'booth' && h < .09 && Math.abs(Math.abs(du) - tw - .016) < .003 && h > .045) return C(WARM, 1.6 + glow * .3); // a chair's back
      return -1;
    }
    case 'lift': // a car up on the two-post lift, a mechanic under it
      if (layer) return -1;
      if (Math.abs(Math.abs(du) - .055) < .005 && h < .2) return C(YEL, 4 + glow); // the lift's posts
      if (h > .12 && h < .17 && Math.abs(du) < .05) { const wheel = h < .135 && Math.abs(Math.abs(du) - .033) < .01; return wheel ? C(BLACK, 0) : C(SHIRTS[(hash(seed, k, 1642) * SHIRTS.length) | 0], 3 + glow * .6 + (h > .16 ? .8 : 0)); } // the car, its wheels hanging
      if (h > .1 && h < .12 && Math.abs(du) < .045) return C(GRAY, 1.2); // its underside
      { const c = sceneDiner(du + .02, h - .03, seed, k + 90, false, L, glow); if (c >= 0 && h > .06) return (c >> 4) === SKIN ? c : C(BLUE, 2.4 + glow * .4); } // a mechanic in overalls, looking up
      return -1;
    case 'fold': // a folding table, a basket of laundry on it
      if (layer) return -1;
      if (h > .07 && h < .075 && Math.abs(du) < .05) return C(WHITE, 3 + glow);
      if (h > .075 && h < .09 && Math.abs(du - .02) < .015) return C(hash(seed, k, 1621) > .5 ? BLUE : MAG, 2.5 + glow);
      if (h < .07 && Math.abs(Math.abs(du) - .045) < .003) return C(GRAY, 1.6);
      return -1;
  }
  if (st.back === 'barber' && !layer) { // a barber's chair, a customer in a cape
    if (h < .02 && Math.abs(du) < .015) return C(GRAY, 3 + glow);
    if (h < .065 && Math.abs(du) < .022) return C(RED, 2.6 + glow * .6 + (du < 0 ? .4 : 0));
    if (hash(seed, k, 1622) < busy) { if (Math.hypot(du, h - .11) < .012) return C(hash(seed, k, 1623) > .5 ? BLACK : BRICK, 1); if (h > .06 && h < .1 && Math.abs(du) < .024 * (1.1 - (h - .06) * 6)) return C(WHITE, 3.5 + glow); }
  }
  if (st.back === 'gym' && !layer && h < .1) { // a bench, a barbell on its rack
    if (h > .04 && h < .05 && Math.abs(du) < .03) return C(BLACK, 0);
    if (Math.abs(h - .085) < .003 && Math.abs(du) < .05) return C(GRAY, 4 + glow);
    if (Math.abs(Math.abs(du) - .045) < .006 && Math.abs(h - .085) < .015) return C(BLACK, 0);
  }
  return -1;
}
// the window: a scene, or false for a shop of goods (shop-windows.js carries on as before)
function shopSceneWindow(i, u, z, u0, u1, z0, z1, sh, open, L, seed) {
  const st = shopSceneFor(sh);
  if (!st) return false;
  const lit = open && (night > .3 || overcast > .6), glow = lit ? 3 + night * 2 : open ? 2.4 + day * .8 : .5, base = z0 - .05, [su, sz] = glassSlopes(u, z); // (the floor half a metre below the sill)
  set(i, ' ', 0);
  if (st.front === 'crates' && z < z0 + .03) { // the market's window: crates of fruit stepped up behind the glass
    const q = .03, pu = u + su * q, pz = z + sz * q, cr = Math.floor(pu / .05), kind = GROCER_PRODUCE_KINDS[(hash(seed, cr, 1630) * GROCER_PRODUCE_KINDS.length) | 0], f = GROCER_PRODUCE[kind];
    const h = pz - z0, top = .02 + (cr & 1) * .008;
    if (h < top - .01) { BG[i] = C(WARM, 2.2 + glow * .4 - (fract(h * 200) < .3 ? .6 : 0)); return true; } // the crate's slats
    if (h < top) { const fr = Math.hypot(fract(pu * 300) - .5, fract(h * 300) - .5) < .45; BG[i] = C(f && f.col != null ? f.col : ORANGE, (fr ? 4 : 2.6) + glow * .6); return true; } // the fruit heaped in it
  }
  const b = boxBehind(u, z, u0 - SCENE.dep, u1 + SCENE.dep, base, z1 + .02, SCENE.dep);
  for (const q of [SCENE.tableQ, SCENE.table2Q]) { // the room: the near tables, then the next row
    if (b.q <= q) break;
    const pu = u + su * q, h = z + sz * q - base;
    if (h < 0) break;
    const c = sceneTables(st, pu, h, q, seed, glow, lit, L, open);
    if (c >= 0) { BG[i] = q > .15 ? C(c >> 4, (c & 15) * .85) : c; return true; }
  }
  const h = b.z - base;
  if (b.s === 'floor') { BG[i] = sceneFloor(st, b.u, b.q, glow); return true; }
  if (b.s === 'ceil') { // the lights hanging over it all
    const lamp = st.lamps === 'lantern' ? Math.hypot(fract(b.u / .12) - .5, (b.q - .2) / .06) < .3 : st.lamps === 'tube' ? Math.abs(fract(b.q / .1) - .5) < .12 : Math.hypot(fract(b.u / .13) - .5, fract(b.q / .13) - .5) < .2;
    BG[i] = lamp && open ? C(st.lamps === 'lantern' ? RED : st.lamps === 'tube' ? WHITE : WARM, st.lamps === 'lantern' ? 8 + glow : 9 + glow) : C(GRAY, .8 + glow * .2); return true;
  }
  if (b.s === 'side') { BG[i] = C(st.wall[0], st.wall[1] * (.4 + glow * .25)); return true; }
  if (st.lamps === 'lantern' && h > .24 && h < .28 && Math.hypot(fract(b.u / .12) - .5, (h - .26) / .02 * .12) < .4) { BG[i] = C(RED, (open ? 7 : 3) + glow); return true; } // red lanterns along the back
  BG[i] = sceneBack(st, b.u, h, seed, glow, lit, L);
  return true;
}
