// ===== the rest of the shops that used to share a room with another sign, each its own now: the bodega (with its cat),
// the market hall, the fruit shop, the motel office, the welder's, the tyre shop, the tailor, the antiques shop, the
// shotengai drugstore and its gacha machines (turn a handle: a capsule toy), the delicatessen. Everywhere to sit takes
// you (C). Built from eateries.js's kit. Rooms are in metres; y runs from the back wall (0) to the door.

// ---- the bodega (BODEGA): the counter by the door behind its plexiglass, the cat asleep on it, cigarettes and lotto
// behind; the deli case and the grill at the back, two narrow aisles, the cooler, a crate to sit on
const shopCat = (x, y, z) => figProp(x, y, KITTEN_LOOK, { z, h: 0.3 / KITTEN_LOOK.scale(0), pose: () => fract(T / 7) < 0.05 ? 'f1' : 'f0', face: [0, 1], chat: false, still: true, light: 8 }); // (it lives here: still there after closing)
function bodegaWall(i, u, uStep, z, d, mx, my, L) {
  if (my === room.H - 1 && z > 1.3 && z < 2.1 && hash(Math.floor(u / 0.5), Math.floor(z / 0.4), 131) > 0.55) { // flyers taped up in the window
    BG[i] = C([YEL, RED, WHITE, GREEN][hash(Math.floor(u / 0.5), 1, 132) * 4 | 0], 6); return set(i, fract(z * 8) < 0.3 ? '=' : ' ', C(GRAY, 3)), true; }
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (rightWall(mx) && z > 1.1 && z < 2.2 && u > 5.3 && u < 7.5) { // behind the till: the cigarettes in their racks, the lotto
    if (z > 1.95) { BG[i] = C(YEL, 6); return wallText(i, u, uStep, z, d, 'LOTTO', 6.4, 2.07, 0.12, 0.14, C(RED, 6), C(YEL, 6)) || set(i, ' ', 0), true; }
    const ry = (z - 1.1) / 0.21; BG[i] = fract(ry) < 0.15 ? C(GRAY, 2) : C([RED, WHITE, BLUE, GREEN, YEL][hash(Math.floor(u / 0.16) + Math.floor(ry) * 17, 2, 133) * 5 | 0], 5); return set(i, fract(u / 0.16) < 0.12 ? '|' : ' ', C(GRAY, 2)), true;
  }
  if (backWall(my) && z > 2.2 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.5, 0.28, 0.34, C(RED, 14), C(YEL, 7))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 5.0, 1.95, room.board3 || (room.board3 = menuLines().slice(0, 3)), 1.2, C(GRAY, 1), C(WHITE, 14))) return true;
  if (z < 0.9) { BG[i] = C(GRAY, 1.6 + L * 0.2); return set(i, ' ', 0), true; }
  BG[i] = C(YEL, 4.5 + L * 0.15); return set(i, ' ', 0), true;
}
ROOM_DEFS.bodega = { grid: ['##########', '#........#', '#........#', '#.SS.SS..#', '#.SS.SS..#', '#........#', '#........#', '#........#', '####DD####'],
  light: 1.0, floor: 'lino', ceil: 'strip', sign: false, glyphs: '%#o=]', wall: bodegaWall, keeper: [8.4, 6.4],
  props: r => [SHOP_COUNTER(7.55, 6.4, 1.0, 0.28, 1.05, 0, 1, BRICK), PLEXI_SCREEN(7.3, 6.4, 1.0, 1.05, 0.9, 0, 1), // the counter, the plexiglass
    { ...standing(8.4, 6.4, r.neon), face: [-1, 0] }, shopCat(7.6, 7.05, 1.05),
    KITCHEN_FOOD_CASE(5.0, 2.0, 2.0, 0.32, 1.15, 'deli', GRAY), { ...standing(4.4, 1.4, WHITE), face: [0, 1] }, KITCHEN_FLATTOP(6.6, 1.33, 0.6, 0.32, 'burger'),
    sodaCooler(1.38, 6.2, 1.0, 0.36, 1, 0), KITCHEN_BEER_CRATE(3.1, 7.55, { levels: 4, open: true, hl: 0.32, hw: 0.25, col: RED }), // crates of soda, stacked, the top one open
    KITCHEN_BEER_CRATE(1.5, 2.3, { hl: 0.2, hw: 0.17, h: 0.4, col: BLUE }), SEAT(1.5, 2.3, 1, 0, 0.4), ...(chance(0.5) ? [{ ...sitting(1.5, 2.3, shirt(), 0.4), face: [1, 0] }] : [])] }; // a milk crate to sit on, and the old man who does

// ---- the market hall (MARKET): stalls under striped awnings round the walls (fish on ice, fruit and veg, the butcher,
// cheese, flowers, bread), a coffee stand with stools, benches back to back down the middle
// a stall along (ca, sa), its customers on (sa, ca) and its stallholder behind: built in market-hall.js
const stall = (x, y, hl, kind, col, vendor, ca = 1, sa = 0) => [...MARKET_STALL(x, y, hl, kind, col, sa, ca),
  ...(vendor ? [{ ...standing(x - sa * 0.6, y - ca * 0.6, vendor), face: [sa, ca] }] : [])];
function marketWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z > 2.4 && z < 3.0 && Math.abs(u - room.W / 2) < 2.4) { BG[i] = C(GREEN, 2); return wallText(i, u, uStep, z, d, room.word + ' HALL', room.W / 2, 2.7, 0.3, 0.36, C(WHITE, 14), C(GREEN, 2)) || set(i, ' ', 0), true; }
  if (!backWall(my) && my !== room.H - 1 && z > 2.3 && Math.abs(fract(Math.abs(u) / 3) - 0.5) < 0.18) { // tall arched windows, high up
    const wu = (fract(Math.abs(u) / 3) - 0.5) * 3, arch = z < 3.0 + Math.sqrt(Math.max(0, 0.29 - wu * wu)) * 0.6;
    if (arch) { BG[i] = C(BLUE, 1 + day * 3); return set(i, Math.abs(wu) < 0.03 || fract(z * 2) < 0.05 ? '|' : ' ', C(GRAY, 5)), true; }
  }
  if (Math.abs(fract(Math.abs(u) / 3) - 0.5) > 0.47) { BG[i] = C(GREEN, 2.2 + L * 0.2); return set(i, fract(z * 4) < 0.1 ? '=' : '|', C(GREEN, L)), true; } // iron columns, painted green
  if (z < 1.2) { BG[i] = C(BRICK, 1.5 + L * 0.2); return set(i, fract(z / 0.15) < 0.12 ? '-' : fract(u / 0.3 + (Math.floor(z / 0.15) & 1) * 0.5) < 0.06 ? '|' : ' ', C(STONE, L * 0.5)), true; } // brick
  BG[i] = C(STONE, 3.2 + L * 0.15); return set(i, ' ', 0), true;
}
ROOM_DEFS.markethall = { grid: boxRoom(16, 12), light: 1.0, height: 3.8, floor: 'concrete', ceil: 'strip', sign: false, wall: marketWall, keeper: [8.0, 1.4],
  props: r => [...stall(3.5, 2.0, 1.4, 0, BLUE, WHITE), ...stall(8.0, 2.0, 1.6, 1, GREEN, r.neon), ...stall(12.5, 2.0, 1.4, 3, YEL, BRICK), // fish, the greengrocer, cheese
    ...stall(2.0, 5.5, 1.2, 2, RED, WHITE, 0, 1), ...stall(2.0, 8.6, 1.2, 4, MAG, shirt(), 0, 1), ...stall(14.0, 8.6, 1.2, 5, ORANGE, shirt(), 0, -1), // the butcher, flowers, bread
    SHOP_COUNTER(14.0, 5.0, 1.0, 0.35, 1.0, 0, 1, BRICK), KITCHEN_ESPRESSO(14.0, 4.6), { ...standing(14.7, 5.0, BRICK), face: [-1, 0] }, // the coffee stand
    ...stoolsY(13.25, 4.3, 5.7, 0.7, GRAY, 1, 0.4),
    ...plainBench(8.0, 6.3, 1.1, 0, -1, BRICK, 0.4), ...plainBench(8.0, 6.75, 1.1, 0, 1, BRICK, 0.4),
    ...[[5.6, 9.2], [10.4, 9.2]].map(([x, y]) => KITCHEN_BEER_CRATE(x, y, { levels: 2, hl: 0.32, hw: 0.25, h: 0.275, col: BRICK }))] }; // crates, stacked

// ---- the fruit shop (FRUIT): tiered stands heaped with fruit down both walls, melons on the table in the middle,
// bananas hung up behind the counter, the scale; a bench by the window
// (the tiered stands are the grocer's, turned to face the room; the melon table is built: market-hall.js)
const bananas = x => hung(x, 1.3, 1.9, (vx, vy, z) => { for (let k = 0; k < 5; k++) rod(vx - 0.1 + k * 0.05, vy, z - 0.05, vx - 0.16 + k * 0.08, vy + 0.06, z - 0.35, 0.025, YEL, 1.6); });
function fruitWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.2 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.48, 0.3, 0.36, C(GREEN, 14), C(WHITE, 7))) return true;
  if (z < 1.0) { BG[i] = C(GREEN, 2.2 + L * 0.2); return set(i, fract(u * 4) < 0.05 ? '|' : ' ', C(WHITE, 4)), true; }
  BG[i] = C(WHITE, 5.5 + L * 0.2); return set(i, hash(Math.floor(u * 2), Math.floor(z * 2), 136) > 0.93 ? '@' : ' ', C(ORANGE, 9)), true;
}
ROOM_DEFS.fruitshop = { grid: boxRoom(10, 8), light: 1.1, floor: 'oak', ceil: 'pendant', sign: false, wall: fruitWall, keeper: [5.0, 1.4],
  props: r => [...counterBox(5.0, 1.8, 1.3), { ...standing(5.0, 1.4, GREEN), face: [0, 1] }, ROOM_MODEL(4.2, 1.8, (vx, vy) => { drum(vx, vy, 0.12, 1.05, 1.12, CHROME); rod(vx, vy, 1.12, vx, vy, 1.3, 0.02, GRAY, 1.2); drum(vx, vy, 0.09, 1.3, 1.42, (i, t, L) => { BG[i] = C(WHITE, 6); return set(i, HIT.face === 4 ? '/' : ' ', C(RED, 8)), true; }); }), // the scale
    bananas(3.6), bananas(6.4),
    PRODUCE_STAND(1.55, 3.9, 1.6, 21, 1, 0), PRODUCE_STAND(8.45, 3.9, 1.6, 24, -1, 0),
    MELON_TABLE(5.0, 4.3, 0.75, 0.45, 0.7), // melons and pineapples on the table
    ...plainBench(2.4, 6.65, 0.8, 0, -1, BRICK, 0.35)] };

// ---- the motel office (MOTEL): the desk with its bell, the room keys on their hooks, the ice machine, the soda machine,
// a sagging couch and the TV that's always on, VACANCY in the window; the back stairs go up to the roof
function motelWall(i, u, uStep, z, d, mx, my, L) {
  if (my === room.H - 1 && z > 1.75 && z < 2.15 && wallText(i, u, uStep, z, d, 'VACANCY', -2.6, 1.95, 0.2, 0.28, C(RED, fract(T * 0.5) < 0.9 ? 15 : 5), C(BLUE, 0.6))) return true; // (the tube stutters)
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 1.25 && z < 2.0 && u > 1.8 && u < 4.2) { // the keys, a hook for every room, a tag on each
    const ku = fract((u - 1.8) / 0.3), kz = fract((z - 1.25) / 0.375), k = Math.floor((u - 1.8) / 0.3) + Math.floor((z - 1.25) / 0.375) * 8;
    BG[i] = C(BRICK, 2.6); if (hash(k, 3, 137) < 0.25) return set(i, ku > 0.4 && ku < 0.6 && kz > 0.7 ? '.' : ' ', C(GRAY, 6)), true; // (that room's taken)
    return set(i, ku > 0.35 && ku < 0.65 ? (kz > 0.6 ? 'o' : kz > 0.3 ? '|' : '#') : ' ', C(kz > 0.3 ? YEL : [RED, BLUE, GREEN][k % 3], 11)), true;
  }
  if (rightWall(mx) && z > 1.45 && z < 2.15 && Math.abs(u - 6.0) < 0.55) { // the TV: something flickering
    if (Math.abs(u - 6.0) > 0.5 || z < 1.5 || z > 2.1) { BG[i] = C(GRAY, 0.8); return set(i, ' ', 0), true; }
    const n = hash(Math.floor(u * 9), Math.floor(z * 9), Math.floor(T * 1.5)); BG[i] = C([BLUE, CYAN, GREEN, WHITE][n * 4 | 0], 3 + n * 4); return set(i, ' ', 0), true;
  }
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 3.0, 2.5, 0.26, 0.3, C(RED, 13), C(YEL, 5))) return true;
  if (z < 1.0) { BG[i] = C(BRICK, 1.5 + L * 0.2); return set(i, fract(u * 4) < 0.05 ? '|' : ' ', C(WARM, 3)), true; } // wood-look panelling
  BG[i] = C(YEL, 3.6 + L * 0.15); return set(i, fract(u / 0.25) < 0.04 ? ':' : ' ', C(ORANGE, 4)), true; // stripy wallpaper
}
const motelStairs = (i, u, uStep, z, d, mx, my, L) => { // the back door out to the iron stairs
  if (Math.abs(u - 8.0) < 0.5 && z < 2.1) { BG[i] = C(GRAY, 2.6 + L * 0.2); return set(i, Math.abs(z - 1.0) < 0.04 && u > 7.7 ? '=' : Math.abs(u - 8.0) > 0.46 ? '|' : ' ', C(WHITE, 8)), true; }
  if (z > 2.2 && z < 2.5 && Math.abs(u - 8.0) < 0.6) { BG[i] = C(GREEN, 4); return wallText(i, u, uStep, z, d, 'ROOF ^', 8.0, 2.35, 0.16, 0.22, C(WHITE, 15), C(GREEN, 4)) || set(i, ' ', 0), true; }
  return motelWall(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.motel = { grid: boxRoom(10, 8, { '7,0': 'E', '8,0': 'E' }), light: 0.85, floor: 'lino', ceil: 'strip', sign: false, wall: motelWall, keeper: [3.0, 1.7],
  ex: 8.0, exReach: 1.0, liftWall: motelStairs, upPrompt: 'E: the back stairs up to the roof', upSay: 'Out the back door and up the iron stairs past the room doors, onto the roof.',
  rent: true, rentBack: [5.5, 3.6, Math.PI / 2],
  props: r => [SHOP_COUNTER(3.0, 2.4, 1.3, 0.32, 1.1, 1, 0, BRICK), { ...standing(3.0, 1.7, r.neon), face: [0, 1] },
    ROOM_MODEL(3.6, 2.35, (vx, vy) => { drum(vx, vy, 0.05, 1.1, 1.13, solid(GRAY)); dot(vx, vy, 1.15, 0.035, (i, t, L) => { BG[i] = C(YEL, 8); return set(i, ' ', 0), true; }); }), // the bell
    ICE_MACHINE(6.1, 1.4, 0, 1), // the ice machine
    sodaCooler(8.6, 3.0, 0.45, 0.35, -1, 0), BROCHURE_RACK(8.86, 4.4, 0.4, -1, 0), // brochures
    ...couch(1.5, 6.0, 0.9, 1, 0, BRICK), ...(chance(0.4) ? [{ ...sitting(1.55, 6.5, shirt(), 0.42), face: [1, 0] }] : []), TEA_TABLE(3.0, 6.0, 0.3, 0.4, 0.45), // the couch, the coffee table
    POT_PLANT(8.5, 6.8, 1.3)] };

// ---- the welder's (WELDING): somebody at the bench in a shower of sparks, gas bottles chained to the wall, a rack of
// steel stock, a gate half made leaning up; the boss's desk and an old car seat to sit in
const sparks = (x, y, z) => ROOM_MODEL(x, y, (vx, vy) => {
  const f = Math.floor(T * 14); if (hash(f, 1, 138) < 0.2) return; // (between beads)
  dot(vx, vy, z, 0.05, (i, t, L) => { BG[i] = C(WHITE, 15); return set(i, '*', C(CYAN, 15)), true; });
  for (let k = 0; k < 7; k++) { const a = hash(f, k, 139) * 6.28, r = hash(f, k, 140) * 0.4; dot(vx + Math.cos(a) * r, vy + Math.sin(a) * r, z + hash(k, f, 141) * 0.25 - r * 0.6, 0.012, (i, t, L) => (set(i, '.', C(YEL, 15)), true)); }
});
const gasBottle = (x, y, col) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, 0.12, 0, 1.35, (i, t, L) => { BG[i] = C(col, (2.4 + L * 0.3) * drumLit(0.12)); return set(i, Math.abs(HIT.w - 1.1) < 0.03 ? '-' : ' ', C(WHITE, 6)), true; });
  drum(vx, vy, 0.05, 1.35, 1.48, solid(GRAY));
}, [0.12, 0.12, 1.48]);
const carSeat = (x, y, fx, fy) => [{ ...BX(x, y, 0.27, 0.27, 0.2, 0.5, solid(GRAY, { top: '=', bright: 0.9 })), seat: true, x, y, fx, fy, h: 0.5 }, BX(x - fx * 0.25, y - fy * 0.25, 0.27, 0.07, 0.5, 1.2, solid(GRAY, { bright: 0.9 }), fy, -fx)];
function weldWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z > 2.2 && wallText(i, u, uStep, z, d, room.word, 6.0, 2.48, 0.3, 0.36, C(ORANGE, 14), C(GRAY, 1))) return true;
  if (backWall(my) && z > 1.5 && z < 2.0 && Math.abs(u - 9.0) < 1.0) { BG[i] = C(YEL, 7); return wallText(i, u, uStep, z, d, 'SAFETY FIRST', 9.0, 1.75, 0.13, 0.2, C(GRAY, 1), C(YEL, 7)) || set(i, fract((u + z) * 4) < 0.5 ? '/' : ' ', C(GRAY, 1)), true; }
  const scorch = Math.max(0, 1 - Math.hypot(u - 4.0, (z - 1.1) * 1.5) / 1.6);
  BG[i] = C(GRAY, (2 + L * 0.2) * (1 - scorch * 0.6)); return set(i, fract(u * 3) < 0.15 ? '|' : ' ', C(GRAY, 4 * (1 - scorch * 0.5))), true; // corrugated steel, scorched by the bench
}
const WELDING_STOCK = (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.15); return set(i, fract(HIT.w * 5) < 0.3 ? '=' : ' ', C(GRAY, 9)), true; };
ROOM_DEFS.welding = { grid: boxRoom(12, 9), light: 0.8, floor: 'concrete', ceil: 'strip', sign: false, wall: weldWall, keeper: [9.4, 6.3],
  props: r => [WORKBENCH(4.0, 2.4, 1.0, 0.45, 0.85), { ...figProp(4.0, 1.6, figAnyone(GRAY, { top: 'jacket', bot: 'pants' }), { pose: 'stand', face: [0, 1], chat: false }) }, sparks(4.1, 2.35, 0.95), // the bench, the welder, the sparks
    gasBottle(1.4, 1.35, GREEN), gasBottle(1.75, 1.35, RED), STOOL(2.6, 2.6, GRAY, 0.62),
    STEEL_RACK(10.7, 3.6, 2.0, -1, 0), // the rack of steel
    GATE_FRAME(1.015, 5.6, 1.2, 1.6, 0, 1), // a gate, half made
    WORKBENCH(7.2, 1.4, 0.6, 0.3, 0.9), VICE_AND_GRINDER(7.1, 1.4, 0.9), // the vice, the grinder
    SMALL_DESK(9.4, 7.0, 0.6, 0.35, 0.75, 0, 1, BRICK), { ...standing(9.4, 6.3, ORANGE), face: [0, -1] }, ...carSeat(7.6, 7.2, 1, 0)] };

// ---- the tyre shop (TIRES): tyres stacked up everywhere, the changer and the balancer, the counter with its screen, a
// row of chairs and the coffee machine for waiting
const tyreStack = (x, y, n) => ROOM_MODEL(x, y, (vx, vy) => {
  for (let k = 0; k < n; k++) drum(vx, vy, 0.32, k * 0.22, k * 0.22 + 0.21, (i, t, L) => { BG[i] = C(GRAY, (0.6 + L * 0.12) * drumLit(0.32)); return set(i, HIT.face === 5 ? (Math.hypot(HIT.u, HIT.v) < 0.18 ? ' ' : 'o') : fract(Math.atan2(HIT.v, HIT.u) * 4) < 0.3 ? '=' : '#', C(GRAY, 4)), true; });
}, [0.32, 0.32, n * 0.22]);
function tyreWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.25 && wallText(i, u, uStep, z, d, room.word, 7.5, 2.5, 0.3, 0.36, C(YEL, 15), C(GRAY, 0.6))) return true;
  if (backWall(my) && z > 1.1 && z < 2.1 && Math.abs(u - 7.5) < 2.3) { BG[i] = C(GRAY, 0.8); return set(i, Math.abs(fract(u * 2.5) - 0.5) < 0.12 && fract(z * 4 + Math.floor(u * 2.5) * 0.5) < 0.5 ? '#' : ' ', C(GRAY, 4)), true; } // the tread patterns, a poster of them
  if (z < 1.0) { BG[i] = C(YEL, 4 + L * 0.2); return set(i, fract((u + z) * 3) < 0.5 ? '/' : ' ', C(GRAY, 1)), true; } // hazard stripes
  BG[i] = C(GRAY, 2.6 + L * 0.15); return set(i, fract(z / 0.3) < 0.08 ? '-' : fract(u / 0.6 + (Math.floor(z / 0.3) & 1) * 0.5) < 0.04 ? '|' : ' ', C(GRAY, 4)), true; // blocks
}
ROOM_DEFS.tireshop = { grid: boxRoom(12, 9), light: 0.95, floor: 'concrete', ceil: 'strip', sign: false, wall: tyreWall, keeper: [9.5, 7.3],
  props: r => [...[1.5, 2.2, 2.9, 3.6].map((x, k) => tyreStack(x, 1.4, 4 + (k & 1) * 2)), ...[2.3, 3.0, 3.7].map((y, k) => tyreStack(1.4, y + 0.6, 3 + k)),
    ROOM_MODEL(6.4, 2.6, (vx, vy) => { drawBox(boxAt(vx, vy, 1, 0, 0.35, 0.3, 0, 0.8), solid(RED, { panel: 0.3 })); drum(vx, vy, 0.3, 0.8, 0.85, solid(GRAY, { top: '+' })); rod(vx + 0.3, vy - 0.2, 0.8, vx + 0.3, vy - 0.2, 1.6, 0.03, GRAY, 1.2); rod(vx + 0.3, vy - 0.2, 1.6, vx, vy, 1.3, 0.025, GRAY, 1.2); }, [0.35, 0.3, 0.85]), // the changer
    ROOM_MODEL(9.0, 2.6, (vx, vy) => { drawBox(boxAt(vx, vy, 1, 0, 0.35, 0.3, 0, 0.9), solid(BLUE, { panel: 0.3 })); rod(vx - 0.35, vy, 1.0, vx - 0.6, vy, 1.0, 0.03, GRAY, 1.2); drawBox(boxAt(vx - 0.68, vy, 1, 0, 0.1, 0.32, 0.68, 1.32), (i, t, L) => { BG[i] = C(GRAY, 0.8); return set(i, HIT.face <= 2 ? (Math.hypot(HIT.v, HIT.w - 1.0) < 0.15 ? 'O' : '#') : '=', C(GRAY, 6)), true; }); }, [0.7, 0.35, 1.32]), // the balancer, a wheel on it
    SHOP_COUNTER(9.5, 6.6, 1.0, 0.3, 1.05, -1, 0, GRAY), DESK_MONITOR(9.2, 6.6, 1.05, 0, 1), { ...standing(9.5, 7.3, BLUE), face: [0, -1] },
    ...[5.4, 6.1, 6.8].flatMap(y => { const q = shellChair(1.5, y, 1, 0, BLUE); if (chance(0.35)) q.push({ ...sitting(1.5, y, shirt(), 0.47), face: [1, 0] }); return q; }), COFFEE_VENDING(1.35, 7.6, 1, 0)] }; // the coffee machine

// ---- the tailor (TAILOR): the cutting table with a pattern chalked out, two sewing machines going, dress forms, bolts of
// cloth up the wall, the fitting mirror; an armchair to wait in
// a sewing machine on its own table, its user on (fx, fy): built (shop-fittings.js)
const sewingMachine = (x, y, fx, fy) => [ROOM_MODEL(x, y, (vx, vy) => drawFurnitureTable(vx, vy, Math.abs(fy) * 0.45 + Math.abs(fx) * 0.3, Math.abs(fx) * 0.45 + Math.abs(fy) * 0.3, 0.75), [Math.abs(fy) * 0.45 + Math.abs(fx) * 0.3, Math.abs(fx) * 0.45 + Math.abs(fy) * 0.3, 0.75]),
  SEWING_MACHINE(x, y, 0.75, -fy, fx)];
function tailorWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 0.9 && z < 2.3 && u > 3.0 && u < 8.0) { // bolts of cloth, end on, on their shelves
    const sz = (z - 0.9) / 0.35, bz = fract(sz), bu = fract(u / 0.3), k = Math.floor(u / 0.3) + Math.floor(sz) * 23;
    if (bz < 0.1) { BG[i] = C(BRICK, 2); return set(i, '=', C(WARM, L)), true; }
    const r = Math.hypot(bu - 0.5, (bz - 0.55) * 1.1); BG[i] = r < 0.42 ? C([BLUE, GRAY, BRICK, GREEN, RED, WHITE, YEL][hash(k, 1, 142) * 7 | 0], 3 + L * 0.2) : C(BRICK, 1); return set(i, r < 0.1 ? 'o' : r < 0.42 && fract(r * 12) < 0.3 ? '@' : ' ', C(GRAY, 6)), true;
  }
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 5.5, 2.58, 0.26, 0.3, C(YEL, 12), C(BRICK, 1.5))) return true;
  if (z < 0.95) { BG[i] = C(BRICK, 1.4 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(WARM, 3)), true; }
  BG[i] = C(STONE, 3.8 + L * 0.15); return set(i, fract(u / 0.12) < 0.08 ? ':' : ' ', C(GRAY, 4)), true; // pinstripe
}
ROOM_DEFS.tailor = { grid: boxRoom(11, 8), light: 0.95, floor: 'oak', ceil: 'pendant', sign: false, wall: tailorWall, keeper: [5.5, 2.9],
  props: r => [CUTTING_TABLE(5.5, 3.6, 1.3, 0.55, 0.9), { ...standing(5.5, 2.9, r.neon), face: [0, 1] },
    ...sewingMachine(1.5, 2.4, 1, 0), ...homeChair(2.3, 2.4, -1, 0, BRICK), { ...sitting(2.3, 2.4, shirt(), 0.48), face: [-1, 0], chat: false },
    ...sewingMachine(1.5, 4.4, 1, 0), ...homeChair(2.3, 4.4, -1, 0, BRICK), ...(chance(0.6) ? [{ ...sitting(2.3, 4.4, shirt(), 0.48), face: [-1, 0] }] : []),
    mannequin(8.6, 2.0, 'jacket', 'pants', GRAY), mannequin(9.5, 2.8, 'dress', 'skirt', RED), mannequin(8.4, 3.6, 'jacket', 'pants', BLUE),
    FITTING_MIRROR(9.7, 6.2, 0.6, 2.0, -1, 0), // the fitting mirror
    CURTAIN_DRAWN(9.0, 5.45, 0.65, 0.05, 2.1, RED, 1, 0, 1), // the curtain, drawn back
    ...armchair(2.0, 6.4, 1, 0, GREEN)] };

// ---- antiques (ANTIQUES): the grandfather clock ticking, a gramophone, chandeliers, glass cabinets of trinkets, two
// armchairs facing each other over a little table, gilt-framed landscapes, old suitcases piled up
const grandfatherClock = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, 0.25, 0.2, 0, 2.1), (i, t, L) => {
    BG[i] = C(BRICK, (1.6 + L * 0.3) * shadeFace(HIT.face)); if (HIT.face !== 3) return set(i, ' ', 0), true;
    const r = Math.hypot(HIT.u, HIT.w - 1.75);
    if (r < 0.17) { const ang = Math.atan2(HIT.u, HIT.w - 1.75), hand = (h, l) => Math.abs(mod(ang - h + Math.PI, Math.PI * 2) - Math.PI) < 0.15 && r < l; BG[i] = C(WHITE, 7); return set(i, hand(tod / 12 * Math.PI * 2, 0.09) || hand(fract(tod) * Math.PI * 2, 0.14) ? '#' : r > 0.15 ? '.' : ' ', C(BRICK, 2)), true; } // the face
    if (HIT.w > 0.5 && HIT.w < 1.5 && Math.abs(HIT.u) < 0.14) { const pu = Math.sin(T * Math.PI) * 0.08 * (1.5 - HIT.w); BG[i] = C(CYAN, 1); return set(i, Math.abs(HIT.u - pu) < 0.02 || HIT.w < 0.7 && Math.hypot(HIT.u - pu * 1.2, HIT.w - 0.62) < 0.06 ? '@' : ' ', C(YEL, 10)), true; } // the pendulum behind its glass
    return set(i, ' ', 0), true;
  });
}, [0.25, 0.2, 2.1]);
const gramophone = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, 0.3, 0.3, 0, 0.75), solid(BRICK, { top: '=' }));
  drawBox(boxAt(vx, vy, 1, 0, 0.18, 0.18, 0.75, 0.9), solid(BRICK));
  drum(vx, vy, 0.15, 0.9, 0.92, (i, t, L) => { BG[i] = C(GRAY, 0.6); return set(i, fract(Math.hypot(HIT.u, HIT.v) * 30 - T) < 0.2 ? 'o' : ' ', C(GRAY, 5)), true; }); // the record, turning
  rod(vx + 0.1, vy, 0.92, vx + 0.1, vy - 0.1, 1.15, 0.015, YEL, 1.4);
  for (let k = 0; k < 6; k++) drum(vx + 0.1, vy - 0.12 - k * 0.04, 0.04 + k * k * 0.012, 1.15 + k * 0.06, 1.21 + k * 0.06, (i, t, L) => { BG[i] = C(YEL, 5 + L * 0.3); return set(i, HIT.face === 5 ? ' ' : '|', C(ORANGE, 8)), true; }); // the horn, flaring
}, [0.3, 0.3, 1.5]);
const chandelier = (x, y) => hung(x, y, 2.5, (vx, vy, z) => { drum(vx, vy, 0.04, z - 0.4, z, solid(YEL)); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; dot(vx + Math.cos(a) * 0.3, vy + Math.sin(a) * 0.3, z - 0.35, 0.03, (i, t, L) => { BG[i] = C(YEL, 12); return set(i, '*', C(WHITE, 15)), true; }); rod(vx, vy, z - 0.3, vx + Math.cos(a) * 0.3, vy + Math.sin(a) * 0.3, z - 0.35, 0.01, YEL, 1.4); } });
function antiqueWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L, 1.0, 2.2)) return true;
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 6.0, 2.55, 0.26, 0.3, C(YEL, 12), C(GREEN, 1.4))) return true;
  if (my !== room.H - 1 && z > 1.3 && z < 2.2 && fract(Math.abs(u) / 2.6) > 0.25 && fract(Math.abs(u) / 2.6) < 0.75) { // landscapes in gilt frames
    const fu = fract(Math.abs(u) / 2.6), k = Math.floor(Math.abs(u) / 2.6) + mx * 3 + my * 7;
    if (fu < 0.29 || fu > 0.71 || z < 1.36 || z > 2.14) { BG[i] = C(YEL, 4.5); return set(i, fract((fu + z) * 20) < 0.3 ? '=' : ' ', C(ORANGE, 8)), true; }
    const hz = 1.7 + Math.sin(fu * 9 + k) * 0.08; BG[i] = z > hz ? C(BLUE, 3 + (z - hz) * 4) : C([GREEN, BRICK, YEL][k % 3], 2 + L * 0.1); return set(i, z > hz && hash(Math.floor(fu * 30), Math.floor(z * 20), k) > 0.93 ? '~' : ' ', C(WHITE, 9)), true;
  }
  if (z < 0.95) { BG[i] = C(BRICK, 1.3 + L * 0.2); return set(i, fract(u * 2) < 0.05 ? '|' : ' ', C(WARM, 3)), true; }
  BG[i] = C(GREEN, 1.4 + L * 0.15); return set(i, hash(Math.floor(u * 4), Math.floor(z * 4), 143) > 0.9 ? '*' : ' ', C(YEL, 4)), true; // old green damask
}
ROOM_DEFS.antiques = { grid: boxRoom(12, 9), light: 0.7, floor: 'boards', ceil: 'pendant', sign: false, wall: antiqueWall, keeper: [9.6, 1.6],
  props: r => [...counterBox(9.6, 2.3, 1.1), { ...standing(9.6, 1.6, GRAY), face: [0, 1] }, grandfatherClock(1.45, 1.35), gramophone(6.4, 1.45),
    ...glassCase(3.6, 1.6, 1.2, 0.35, 1.2, caseGoods('trinkets', [YEL, WHITE, CYAN, MAG], true, 7), BRICK), ...glassCase(10.6, 5.4, 1.0, 0.35, 1.2, caseGoods('trinkets', [YEL, WHITE, GREEN], true, 9), BRICK, 0, 1),
    ...armchair(4.4, 6.6, 1, 0, GREEN), ...armchair(7.2, 6.6, -1, 0, RED), TEA_TABLE(5.8, 6.6, 0.3, 0.3, 0.55), // two armchairs over a little table
    ...(chance(0.4) ? [{ ...sitting(7.2, 6.6, shirt(), 0.42), face: [-1, 0] }] : []),
    SUITCASE_PILE([[1.5, 6.2, 0, 0.4, BRICK], [1.5, 6.2, 0.4, 0.75, ORANGE]]), SUITCASE_PILE([[1.55, 7.3, 0, 0.3, GREEN]]), // old suitcases piled up
    chandelier(4.0, 4.0), chandelier(8.0, 4.0)] };

// ---- the drugstore (DRUGSTORE): bright as day, aisles of everything in loud packets, signs hung over them, the
// pharmacist's counter at the back and a bench to wait on
ROOM_FLOORS.gloss = (i, f, wx, wy, r, x, L) => { BG[i] = C(WHITE, 2.4 + f * 4); return set(i, fract(wx / 0.6) < 0.03 || fract(wy / 0.6) < 0.03 ? '+' : ' ', C(GRAY, L * 0.5)); }; // shiny white tiles
const popSign = (x, y, col) => hung(x, y, 2.4, (vx, vy, z) => drawBox(boxAt(vx, vy, 1, 0, 0.35, 0.01, z - 0.35, z), (i, t, L) => { BG[i] = C(col, 8); return set(i, HIT.w > z - 0.15 ? '!' : fract(HIT.u * 9) < 0.4 ? '%' : ' ', C(RED, 12)), true; }));
function drugWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L, 1.0, 2.2)) return true;
  if (backWall(my) && z > 2.2 && z < 2.8 && Math.abs(u - room.W / 2) < 3) { BG[i] = C(RED, 5); return wallText(i, u, uStep, z, d, room.word, room.W / 2, 2.5, 0.3, 0.36, C(YEL, 15), C(RED, 5)) || set(i, ' ', 0), true; }
  if (z > 2.0 && z < 2.2) { BG[i] = C(YEL, 8); return set(i, fract(u * 2) < 0.5 ? '%' : ' ', C(RED, 10)), true; } // price banners all round
  BG[i] = C(WHITE, 6 + L * 0.2); return set(i, ' ', 0), true;
}
ROOM_DEFS.drugstore = { grid: ['############', '#..........#', '#..........#', '#.SSS..SSS.#', '#..........#', '#.SSS..SSS.#', '#..........#', '#..........#', '#####DD#####'],
  light: 1.2, floor: 'gloss', ceil: 'strip', sign: false, shelves: { kind: 'pharmacy' }, neon: true, glyphs: '[]+%=o', wall: drugWall, keeper: [6.0, 1.4],
  props: r => [...counterBox(6.0, 1.85, 1.6), { ...standing(6.0, 1.4, WHITE), face: [0, 1] }, popSign(3.5, 4.0, YEL), popSign(8.5, 4.0, YEL), popSign(3.5, 6.0, MAG), popSign(8.5, 6.0, CYAN),
    ...plainBench(10.6, 2.2, 0.7, -1, 0, BLUE, 0.35), ...shoppers([[4.6, 4.4, 0, -1], [9.1, 6.5, -1, 0]], 0.5)] };

// ---- the delicatessen (DELICATESSEN): hams and salamis hung over the marble counter, the salads and olives under the
// glass, wheels of cheese stacked up, jars and wine up the wall, the slicer; a ledge in the window with stools
const hangingMeat = (x, ham) => hung(x, 2.4, 2.25, (vx, vy, z) => { if (ham) dot(vx, vy, z - 0.25, 0.13, (i, t, L) => { BG[i] = C(BRICK, 3 + L * 0.3); return set(i, ' ', 0), true; }); else drum(vx, vy, 0.04, z - 0.45, z, (i, t, L) => { BG[i] = C(BRICK, 2.4 + L * 0.3); return set(i, hash(Math.floor(HIT.w * 30), Math.floor(Math.atan2(HIT.v, HIT.u) * 3), 145) > 0.7 ? '.' : ' ', C(WHITE, 9)), true; }); });
function delicatessenWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 1.15 && z < 2.25 && u > 1.5 && u < 9.5) { // jars and bottles of wine on the shelves
    const sz = (z - 1.15) / 0.55, bz = fract(sz), cu = fract(u / 0.22), k = Math.floor(u / 0.22) + Math.floor(sz) * 41;
    if (bz < 0.08) { BG[i] = C(BRICK, 2); return set(i, '=', C(WARM, L)), true; }
    const wine = hash(k, 1, 146) < 0.45, on = wine ? Math.abs(cu - 0.5) < (bz > 0.65 ? 0.08 : 0.25) && bz < 0.95 : Math.abs(cu - 0.5) < 0.32 && bz < 0.6;
    BG[i] = on ? (wine ? C(GREEN, 1.6) : C([RED, ORANGE, YEL, GREEN][k & 3], 5)) : C(BRICK, 1); return set(i, on && bz > 0.25 && bz < 0.45 ? '=' : ' ', C(WHITE, 8)), true;
  }
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 5.5, 2.6, 0.22, 0.28, C(YEL, 12), C(GREEN, 1.3))) return true;
  if (z < 1.0) { BG[i] = C(WHITE, 4 + L * 0.2); return set(i, fract(z / 0.15) < 0.12 ? '-' : ' ', C(GRAY, 3)), true; }
  BG[i] = C(GREEN, 1.3 + L * 0.12); return set(i, ' ', 0), true;
}
ROOM_DEFS.delicatessen = { grid: boxRoom(11, 8), light: 0.95, floor: 'checker', ceil: 'tin', sign: false, wall: delicatessenWall, keeper: [5.5, 1.7],
  props: r => [KITCHEN_FOOD_CASE(5.5, 2.4, 2.4, 0.34, 1.15, 'deli', WHITE), { ...standing(5.5, 1.7, WHITE), face: [0, 1] },
    ...[3.6, 4.2, 4.8, 5.4, 6.0, 6.6, 7.2].map((x, k) => hangingMeat(x, k % 3 === 1)),
    SHOP_COUNTER(8.6, 1.35, 0.5, 0.3, 0.9, 1, 0, GRAY), MEAT_SLICER(8.6, 1.35, 0.9, 0, 1), // the slicer
    ROOM_MODEL(9.7, 2.6, (vx, vy) => { for (let k = 0; k < 4; k++) drum(vx, vy, 0.28 - k * 0.03, k * 0.16, k * 0.16 + 0.15, (i, t, L) => { BG[i] = C(YEL, (5 + L * 0.3) * drumLit(0.28)); return set(i, HIT.face === 5 ? ' ' : '=', C(ORANGE, 8)), true; }); }, [0.28, 0.28, 0.64]), // cheeses, stacked
    KITCHEN_WALL_LEDGE(2.4, 6.78, 1.35, 0.17, 1.04, 0, -1), ...stools(1.7, 3.2, 6.3, 0.75, GREEN, 0, 1, 0.35),
    ...dining(8.6, 5.4, { hl: 0.32, hw: 0.32, chair: homeChair, chairCol: BRICK, top: solid(WHITE, { top: '=' }), busy: 0.35 })] };

// ---- gacha (GACHA): walls of capsule-toy machines, two high, a toy in every capsule; a change machine; turn a handle
// (E) and see what you get. Nobody minds the place: no counter.
const GACHA_PRICE = 2, GACHA_TOYS = ['yoyo', 'duck', 'dinotoy', 'luckycoin', 'redstring', 'candy'];
const gachaMachine = (x, y, fx, fy, k) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  for (const [z0, kk] of [[0, k], [0.9, k + 17]]) drawBox(boxAt(vx, vy, -fy, fx, 0.24, 0.22, z0, z0 + 0.88), (i, t, L) => { // two machines, one on the other
    const f = HIT.face, front = f === 3 || f === 4, w = HIT.w - z0, a = HIT.u; // (the long sides: the one against the wall never shows)
    BG[i] = C([MAG, CYAN, YEL, GREEN, RED, BLUE][kk % 6], (2.6 + L * 0.3) * shadeFace(f));
    if (!front) return set(i, ' ', 0), true;
    if (w > 0.45 && w < 0.84 && Math.abs(a) < 0.2) { BG[i] = C(CYAN, 1); const c = hash(Math.floor(a * 18), Math.floor(w * 16), kk); return set(i, c > 0.45 ? 'O' : ' ', C(ITEM_COL[c * 13 % ITEM_COL.length | 0], 13)), true; } // the capsules behind the window
    if (Math.hypot(a, w - 0.3) < 0.06) return set(i, '@', C(WHITE, 14)), true; // the handle
    if (w > 0.05 && w < 0.16 && Math.abs(a) < 0.08) { BG[i] = C(GRAY, 0.6); return set(i, ' ', 0), true; } // the hatch
    return set(i, w > 0.36 && w < 0.42 ? '$' : ' ', C(WHITE, 10)), true;
  });
}, [0.24, 0.24, 1.78]), gacha: true, cx: x + fx * 0.6, cy: y + fy * 0.6 });
const nearGacha = () => mode === 'room' && room.props.find(s => s.gacha && Math.hypot(px - s.cx, py - s.cy) < 0.5) || null;
function turnGacha() {
  if (!pay(GACHA_PRICE)) return say(`It's ${fmt$(GACHA_PRICE)} a go.`);
  const id = pick(GACHA_TOYS);
  if (carryItem({ id, uses: ITEMS[id].uses || 0 }) < 0) { earn(GACHA_PRICE); return say('Your bag\'s full. You put the coins back in your pocket.'); }
  say(`Clunk. A capsule rolls out: a ${ITEMS[id].name}!`, 3);
}
function gachaWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.2 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.48, 0.3, 0.36, C(MAG, 15), C(WHITE, 7))) return true;
  if (z > 1.95) { const k = Math.floor(Math.abs(u) / 0.9), cu = fract(Math.abs(u) / 0.9) - 0.5, r = Math.hypot(cu, (z - 2.35) * 1.4); // the characters, painted round the top
    if (r < 0.3) { BG[i] = C([MAG, CYAN, YEL, GREEN][k & 3], 8); return set(i, Math.abs(Math.abs(cu) - 0.1) < 0.04 && Math.abs(z - 2.4) < 0.05 ? 'o' : ' ', C(GRAY, 1)), true; } }
  BG[i] = C(WHITE, 6 + L * 0.2); return set(i, ' ', 0), true;
}
ROOM_DEFS.gacha = { grid: boxRoom(10, 8), light: 1.15, floor: 'kids', ceil: 'strip', sign: false, wall: gachaWall,
  props: r => {
    const p = [];
    let k = 0;
    for (let x = 1.5; x <= 8.6; x += 0.55) p.push(gachaMachine(x, 1.3, 0, 1, k++)); // along the back
    for (let y = 2.4; y <= 5.4; y += 0.55) p.push(gachaMachine(1.3, y, 1, 0, k++), gachaMachine(8.7, y, -1, 0, k++)); // down the sides
    for (let x = 3.9; x <= 6.2; x += 0.55) p.push(gachaMachine(x, 3.75, 0, -1, k++), gachaMachine(x, 4.25, 0, 1, k++)); // back to back in the middle
    p.push(CHANGE_MACHINE(2.0, 6.75, 0, -1)); // the change machine
    p.push(...plainBench(7.4, 6.7, 0.7, 0, -1, MAG, 0.3));
    for (const [x, y] of [[3.0, 2.6], [6.8, 5.2]]) if (chance(0.6)) p.push({ ...figProp(x, y, figAnyone(shirt(), { kid: chance(0.5), bot: 'shorts' }), { h: 1.4 }), face: [0, -1] });
    return p;
  } };

Object.assign(ROOM_FOR, { BODEGA: 'bodega', MARKET: 'markethall', FRUIT: 'fruitshop', MOTEL: 'motel', WELDING: 'welding', TIRES: 'tireshop', TAILOR: 'tailor', ANTIQUES: 'antiques',
  DRUGSTORE: 'drugstore', DELICATESSEN: 'delicatessen', GACHA: 'gacha' });
