// ===== the little places you mostly get something to go from, each a room of its own now (they used to borrow the
// diner's and the cafe's): fried chicken, the kebab shop, the shotengai's bento, takoyaki and yakitori counters,
// donuts, the juice bar, bagels. A counter and the thing they cook at, the menu over it, a few places to sit
// (all of them sittable: C). Built from eateries.js's kit. Rooms are in metres; y runs from the back wall (0).

// ---- fried chicken (CHICKEN): the fryers bubbling, drumsticks heaped under the heat lamps, red and white stripes,
// plastic chairs, a ledge under the window with stools
const fryer = (x,y) => KITCHEN_FRYER(x,y);
function chickenWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.45 && wallText(i, u, uStep, z, d, room.word, 5.5, 2.7, 0.32, 0.4, C(RED, 15), C(WHITE, 7))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 6.4, 2.0, menuLines(), 1.45, C(RED, 2.5), C(WHITE, 15))) return true;
  if (z < 1.0) { BG[i] = C(WHITE, 4 + L * 0.2); return set(i, fract(u * 5) < 0.05 || fract(z * 5) < 0.05 ? '+' : ' ', C(GRAY, 3)), true; } // white tiles
  if (z < 1.12) { BG[i] = C(RED, 4); return set(i, ' ', 0), true; }
  BG[i] = fract(u / 0.6) < 0.5 ? C(RED, 3 + L * 0.2) : C(WHITE, 5 + L * 0.2); return set(i, ' ', 0), true; // the stripes
}
const heatLamp = (x, y, z) => hung(x, y, z, (vx, vy, z_) => drum(vx, vy, 0.1, z_ - 0.1, z_, (i, t, L) => { BG[i] = C(HIT.face === 6 ? ORANGE : RED, HIT.face === 6 ? 12 : 4); return set(i, ' ', 0), true; }));
ROOM_DEFS.chickenshop = { grid: boxRoom(11, 8), light: 1.1, floor: 'checker', ceil: 'strip', sign: false, wall: chickenWall, keeper: [5.6, 1.6],
  props: r => [KITCHEN_FOOD_CASE(3.5,2.3,1.05,.3,1.35,'chicken',RED), KITCHEN_SERVICE_COUNTER(6.5,2.3,1.5,.3,1.05,RED,GRAY), // the warmer, the counter
    { ...standing(5.6, 1.6, RED), face: [0, 1] }, fryer(8.3, 1.4), heatLamp(3.0, 2.3, 1.75), heatLamp(4.0, 2.3, 1.75),
    ...dining(2.6, 4.6, { hl: 0.35, chair: shellChair, chairCol: RED, top: solid(WHITE, { top: '=' }) }), ...dining(8.3, 4.6, { hl: 0.35, chair: shellChair, chairCol: YEL, top: solid(WHITE, { top: '=' }) }),
    KITCHEN_WALL_LEDGE(2.4,6.83,1.35,.17,1.04,0,-1,GRAY), KITCHEN_WALL_LEDGE(8.6,6.83,1.35,.17,1.04,0,-1,GRAY), // the ledges under the window
    ...stools(1.6, 3.4, 6.3, 0.9, RED, 0, 1, 0.3), ...stools(7.8, 9.6, 6.3, 0.9, RED, 0, 1, 0.3)] };

// ---- the kebab shop (KEBAB): the doner turning in front of its burners, the salads in their trays under the glass,
// lit photos of everything over the counter, mirror tiles, a ledge down the side for eating standing up (or not)
const doner = (x,y) => KITCHEN_SPIT(x,y);
// a row of lit photos over a counter, centred on u0: each dish, its picture and its price (from what they sell)
function photoMenu(i, u, uStep, z, d, u0, z0, bg) {
  const lines = menuLines(), n = lines.length, w = 1.4;
  if (z < z0 || z > z0 + 0.75 || Math.abs(u - u0) > n * w / 2) return false;
  const k = Math.floor((u - u0 + n * w / 2) / w), cx = u0 - n * w / 2 + k * w + w / 2, cu = u - cx;
  if (Math.abs(cu) > w / 2 - 0.04 || z < z0 + 0.04 || z > z0 + 0.71) { BG[i] = bg; return set(i, ' ', 0), true; }
  BG[i] = C(WHITE, 7);
  if (wallText(i, u, uStep, z, d, lines[k], cx, z0 + 0.14, 0.09, 0.13, C(RED, 6), C(WHITE, 7))) return true;
  if (Math.hypot(cu / 1.5, z - z0 - 0.47) < 0.16) { BG[i] = C([ORANGE, YEL, BRICK, GREEN][k & 3], 7); return set(i, fract(cu * 12) < 0.3 ? '=' : ' ', C(GREEN, 9)), true; } // the photo
  return set(i, ' ', 0), true;
}
function kebabWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.45 && wallText(i, u, uStep, z, d, room.word, 5.6, 2.7, 0.32, 0.4, C(GREEN, 15), C(GRAY, 0.5))) return true; // green neon
  if (backWall(my) && photoMenu(i, u, uStep, z, d, 5.6, 1.62, C(GRAY, 0.5))) return true;
  if (z < 1.2) { BG[i] = C(WHITE, 4.2 + L * 0.2); return set(i, fract(u * 4) < 0.05 || fract(z * 4) < 0.05 ? '+' : ' ', C(GRAY, 3)), true; }
  BG[i] = C(GREEN, 1.6 + L * 0.15); return set(i, fract(u / 0.3) < 0.04 || fract(z / 0.3) < 0.04 ? '+' : fract((u + z) * 2) < 0.05 ? '/' : ' ', C(WHITE, 5)), true; // mirror tiles
}
const sodaCooler = (x, y, hl, hw, ca = 1, sa = 0) => BX(x, y, hl, hw, 0, 1.95, (i, t, L) => { // a glass-fronted fridge of bright cans and bottles
  const front = ca ? HIT.face === 3 : HIT.face === 1 || HIT.face === 2;
  if (!front) { BG[i] = C(GRAY, 2 + L * 0.2); return set(i, ' ', 0), true; }
  const a = ca ? HIT.u : HIT.v; BG[i] = C(CYAN, 1.2);
  return set(i, fract(HIT.w * 3) < 0.12 ? '=' : fract(a * 8) < 0.5 ? 'i' : ' ', C([RED, GREEN, ORANGE, WHITE, YEL, CYAN, MAG][Math.floor(a * 8 + 8 + HIT.w * 3) % 7], 13)), true;
}, ca, sa);
ROOM_DEFS.kebabshop = { grid: boxRoom(11, 8), light: 1.0, floor: 'lino', ceil: 'strip', sign: false, wall: kebabWall, keeper: [5.6, 1.6],
  props: r => [doner(2.4, 1.45), { ...standing(3.2, 1.4, WHITE), face: [-1, 0] }, // the spit, somebody carving it
    KITCHEN_FOOD_CASE(5.6,2.35,1.7,.32,1.15,'salad',GRAY), { ...standing(5.6, 1.6, WHITE), face: [0, 1] }, sodaCooler(9.2, 1.45, 0.6, 0.38),
    KITCHEN_WALL_LEDGE(9.8,4.9,1.3,.2,1.04,-1,0,GRAY), ...stoolsY(9.15, 3.9, 5.9, 1.0, GREEN, 1, 0.35), // the ledge down the side
    ...dining(2.4, 4.4, { hl: 0.35, chair: homeChair, chairCol: BRICK, top: solid(WHITE, { top: '=' }), busy: 0.35 }), ...dining(2.4, 6.2, { hl: 0.35, chair: homeChair, chairCol: BRICK, top: solid(WHITE, { top: '=' }), busy: 0.3 })] };

// ---- the bento shop (BENTO): a chilled case of boxed lunches, the rice cooker steaming, pale wood, a noren over the
// kitchen door; a ledge and a bench to eat at
function noren(i, u, z, u0, hw, col, z0 = 1.35, z1 = 2.1) { // a split curtain over a doorway (the dark of it below)
  if (Math.abs(u - u0) > hw || z > z1) return false;
  if (z > z0) { BG[i] = C(col, 3.2); return set(i, Math.abs(fract((u - u0 + hw) / (hw * 2 / 3)) - 0.5) > 0.47 ? ' ' : z > z0 + 0.25 && z < z0 + 0.45 && Math.abs(fract(u * 4 + z * 2) - 0.5) < 0.15 ? '~' : ' ', C(WHITE, 13)), true; }
  BG[i] = C(GRAY, 0.6); return set(i, ' ', 0), true;
}
function bentoWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && noren(i, u, z, 2.0, 0.6, BLUE)) return true;
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 4.6, 2.55, 0.28, 0.34, C(RED, 13), C(WHITE, 6))) return true;
  if (backWall(my) && z > 1.55 && z < 2.15 && u > 3.3 && u < 7.6) { // photo cards of every box, pinned in a row
    const cu = fract((u - 3.3) / 0.62), k = Math.floor((u - 3.3) / 0.62);
    if (cu < 0.1 || cu > 0.9 || z < 1.6 || z > 2.1) { BG[i] = C(STONE, 3.4 + L * 0.15); return set(i, ' ', 0), true; }
    BG[i] = z > 1.72 ? C([ORANGE, GREEN, YEL, RED, WHITE, MAG, ORANGE][k % 7], 6) : C(WHITE, 8); return set(i, z < 1.72 && fract(cu * 6) < 0.4 ? '-' : ' ', C(GRAY, 3)), true;
  }
  if (z < 0.9) { BG[i] = C(BRICK, 1.8 + L * 0.2); return set(i, fract(u * 5) < 0.06 ? '|' : ' ', C(GRAY, 2)), true; }
  BG[i] = C(STONE, 3.4 + L * 0.15); return set(i, fract(u / 0.9) < 0.03 ? '|' : ' ', C(BRICK, 5)), true; // pale wood
}
ROOM_DEFS.bento = { grid: boxRoom(9, 7), light: 1.0, floor: 'hinoki', ceil: 'strip', sign: false, wall: bentoWall, keeper: [4.6, 1.5],
  props: r => [KITCHEN_FOOD_CASE(4.6,2.2,2,.35,1.05,'bento',STONE), { ...standing(4.6, 1.5, WHITE), face: [0, 1] },
    KITCHEN_SERVICE_COUNTER(7.3,1.4,.55,.32,.9,GRAY,GRAY), KITCHEN_RICE_COOKER(7.3,1.4),
    KITCHEN_WALL_LEDGE(1.2,4.4,.9,.2,1.04,1,0), ...stoolsY(1.75, 3.9, 4.9, 1.0, BRICK, -1, 0.35), // the ledge on the left
    ...plainBench(7.6, 4.4, 0.75, -1, 0, BRICK)] };

// ---- takoyaki (TAKOYAKI): the iron plate of little round wells, a ball turning in each, the octopus painted on the
// wall; a bench to wait on
const takoGriddle = (x,y) => KITCHEN_TAKO_GRIDDLE(x,y);
function takoWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 1.25 && z < 2.75 && Math.abs(u - 2.2) < 0.9) { // the octopus: a round red head, two eyes, its legs waving
    const cu = u - 2.2, cz = z - 2.25, head = Math.hypot(cu, cz * 1.15) < 0.42, eye = Math.hypot(Math.abs(cu) - 0.15, cz + 0.02) < 0.07;
    const leg = cz < -0.25 && cz > -0.95 && Math.abs(fract((cu + Math.sin(cz * 7 + T * 2) * 0.06) / 0.18) - 0.5) < 0.22 && Math.abs(cu) < 0.55 + cz * 0.2;
    BG[i] = head || leg ? C(RED, eye ? 1 : 6) : C(WHITE, 6); return set(i, eye ? 'o' : head && cz > 0.25 && fract(cu * 9) < 0.2 ? '.' : ' ', C(WHITE, 15)), true;
  }
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 5.6, 2.5, 0.25, 0.32, C(RED, 14), C(WHITE, 6))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 5.6, 1.95, menuLines(), 1.1, C(BRICK, 1.5), C(YEL, 14))) return true;
  if (z < 1.0) { BG[i] = C(BRICK, 2 + L * 0.2); return set(i, fract(u * 4) < 0.06 ? '|' : ' ', C(GRAY, 2)), true; }
  BG[i] = C(WHITE, 5.5 + L * 0.2); return set(i, z > 2.8 && fract(u * 3) < 0.4 ? '~' : ' ', C(RED, 8)), true; // white, a red wave round the top
}
ROOM_DEFS.takoyaki = { grid: boxRoom(9, 7), light: 1.05, floor: 'lino', ceil: 'strip', sign: false, wall: takoWall, keeper: [4.5, 1.6],
  props: r => [takoGriddle(4.5, 2.4), { ...standing(4.5, 1.6, ORANGE), face: [0, 1] }, sodaCooler(7.45, 1.45, 0.45, 0.35),
    ...plainBench(1.45, 4.4, 0.75, 1, 0, BRICK, 0.4), KITCHEN_WALL_LEDGE(7.8,4.4,.8,.2,1.04,-1,0), ...stoolsY(7.25, 4.0, 4.8, 0.8, RED, 1, 0.35)] };

// ---- yakitori (YAKITORI): the charcoal trough with its skewers across it, a long counter and stools all along it, red
// lanterns, wooden menu tags on the wall, beer crates (turned over, they're seats)
const yakiGrill = (x,y,hl) => KITCHEN_YAKITORI(x,y,hl);
const akachochin = (x, y) => hung(x, y, 2.35, (vx, vy, z) => drum(vx, vy, 0.17, z - 0.45, z, (i, t, L) => { // a red paper lantern, lit
  BG[i] = C(RED, 6 + 3 * Math.max(night, 0.3)); return set(i, fract(HIT.w * 7) < 0.18 ? '-' : HIT.face === 4 && Math.abs(HIT.w - z + 0.22) < 0.08 ? '#' : ' ', C(GRAY, 2)), true; }));
function yakiWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.25 && z < 2.75 && Math.abs(u - room.W / 2) < 1.6) { BG[i] = C(BRICK, 2.5); return wallText(i, u, uStep, z, d, room.word, room.W / 2, 2.5, 0.3, 0.36, C(WHITE, 13), C(BRICK, 2.5)) || set(i, ' ', 0), true; } // on a board
  if (backWall(my) && z > 1.3 && z < 2.15 && Math.abs(u - room.W / 2) > 1.2 && Math.abs(u - room.W / 2) < 4.4) { // the menu tags, hung in a row: each a dish, brushed on
    const tu = fract(u / 0.3), k = Math.floor(u / 0.3);
    if (tu < 0.18 || tu > 0.82 || z < 1.36 + hash(k, 1, 112) * 0.08) { BG[i] = C(BRICK, 1.4 + L * 0.15); return set(i, ' ', 0), true; }
    BG[i] = C(YEL, 6); return set(i, fract(z * 9 + hash(k, 2, 113)) < 0.45 ? '=' : ' ', C(GRAY, 2)), true;
  }
  if (!backWall(my) && z > 1.3 && z < 2.3 && fract(Math.abs(u) / 3.1) > 0.4 && fract(Math.abs(u) / 3.1) < 0.7) { // beer posters: a gold glass on red
    const pu = fract(Math.abs(u) / 3.1), glass = Math.abs(pu - 0.55) < 0.06 && z > 1.5 && z < 2.0;
    BG[i] = glass ? C(z > 1.9 ? WHITE : YEL, z > 1.9 ? 10 : 9) : C(RED, 4); return set(i, glass && fract(z * 12) < 0.2 ? 'o' : ' ', C(YEL, 13)), true;
  }
  BG[i] = C(BRICK, 1.5 + L * 0.15 - Math.max(0, z - 2) * 0.4); return set(i, fract(u * 2.5) < 0.05 ? '|' : ' ', C(GRAY, 2)), true; // dark wood, smoked darker up top
}
ROOM_DEFS.yakitori = { grid: boxRoom(11, 7), light: 0.75, floor: 'oak', ceil: 'lantern', sign: false, wall: yakiWall, keeper: [5.5, 1.45],
  props: r => [KITCHEN_SERVICE_COUNTER(5.5,2.75,3.6,.28,1,BRICK,BRICK), yakiGrill(5.5, 1.95, 1.6), // the counter, the grill behind it
    { ...standing(5.5, 1.45, WHITE), face: [0, 1] }, { ...standing(3.2, 1.4, WHITE), face: [1, 0] },
    ...stools(2.3, 8.7, 3.45, 0.9, BRICK, 0, -1, 0.45), akachochin(2.4, 4.5), akachochin(8.6, 4.5),
    BX(9.55, 1.35, 0.3, 0.22, 0, 0.9, crateShade(YEL)), BX(9.55, 1.35, 0.3, 0.22, 0.9, 1.25, crateShade(YEL)), // crates of empties
    BX(8.6, 5.2, 0.3, 0.25, 0, 0.6, crateShade(YEL)), // and three turned over: a table and somewhere to sit either side
    ...[[7.95, 1], [9.25, -1]].flatMap(([x, fx]) => [BX(x, 5.2, 0.2, 0.17, 0, 0.38, crateShade(YEL)), SEAT(x, 5.2, fx, 0, 0.4), ...(chance(0.35) ? [{ ...sitting(x, 5.2, shirt(), 0.4), face: [fx, 0] }] : [])])] };

// ---- donuts (DONUTS): trays of rings behind the glass (glazed, pink, chocolate, sprinkles), a giant one in neon, a
// coffee machine; a ledge under the window, two little tables
function donutWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 1.4 && z < 2.7 && Math.abs(u - 2.1) < 0.7) { // the big one, in neon: a pink ring, sprinkles
    const r = Math.hypot(u - 2.1, z - 2.05);
    if (r < 0.6 && r > 0.22) { BG[i] = C(MAG, 9 + Math.sin(T * 3) * 2); return set(i, hash(Math.floor(u * 14), Math.floor(z * 14), 115) > 0.75 ? '\'' : ' ', C([YEL, CYAN, WHITE][Math.floor(u * 14) % 3], 15)), true; }
  }
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.6, 0.3, 0.36, C(MAG, 15), C(BRICK, 2))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.4, 2.0, menuLines(), 1.0, C(BRICK, 1.6), C(WHITE, 14))) return true;
  if (z < 1.0) { BG[i] = C(BRICK, 2 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(WARM, 4)), true; } // a chocolate wainscot
  BG[i] = C(MAG, 6 + L * 0.2); return set(i, hash(Math.floor(u * 6), Math.floor(z * 6), 116) > 0.9 ? '\'' : ' ', C([YEL, CYAN, WHITE][Math.floor(u * 6 + z * 6) % 3], 11)), true; // pink, sprinkled
}
ROOM_DEFS.donutshop = { grid: boxRoom(10, 7), light: 1.1, floor: 'pastel', ceil: 'pendant', sign: false, neon: true, wall: donutWall, keeper: [5.0, 1.55],
  props: r => [KITCHEN_FOOD_CASE(5,2.3,1.9,.35,1.15,'donuts',MAG), { ...standing(5.0, 1.55, MAG), face: [0, 1] },
    FURNITURE_COUNTER(7.9,1.35,.6,1), KITCHEN_ESPRESSO(7.7,1.35),
    ...dining(2.2, 4.0, { hl: 0.3, hw: 0.3, chair: shellChair, chairCol: MAG, top: solid(WHITE, { top: '=' }), busy: 0.35 }), ...dining(7.8, 4.0, { hl: 0.3, hw: 0.3, chair: shellChair, chairCol: CYAN, top: solid(WHITE, { top: '=' }), busy: 0.35 }),
    KITCHEN_WALL_LEDGE(2.4,5.83,1.35,.17,1.04,0,-1), KITCHEN_WALL_LEDGE(7.6,5.83,1.35,.17,1.04,0,-1),
    ...stools(1.6, 3.4, 5.3, 0.9, MAG, 0, 1, 0.3), ...stools(6.8, 8.6, 5.3, 0.9, MAG, 0, 1, 0.3)] };

// ---- the juice bar (JUICE): crates of fruit along the wall, three blenders whirring on the counter, a wall painted
// with oranges; stools at the side, a bench in the window
const blender = (x,y,col) => KITCHEN_BLENDER(x,y,col);
function juiceWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.6, 0.3, 0.36, C(GREEN, 15), C(YEL, 8))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 5.0, 2.0, menuLines(), 1.2, C(GREEN, 2), C(WHITE, 15))) return true;
  if (z > 1.1) { // painted oranges, halved, every so often
    const cu = fract(Math.abs(u) / 1.7) - 0.5, cz = z - 1.75 - (Math.floor(Math.abs(u) / 1.7) & 1) * 0.5, r = Math.hypot(cu * 1.7, cz);
    if (r < 0.28) { BG[i] = C(r > 0.24 ? WHITE : ORANGE, r > 0.24 ? 9 : 9); return set(i, r < 0.22 && Math.abs(Math.sin(Math.atan2(cz, cu) * 4)) < 0.15 ? '-' : ' ', C(WHITE, 12)), true; }
  }
  if (z < 1.0) { BG[i] = C(GREEN, 3 + L * 0.2); return set(i, fract(u * 4) < 0.05 ? '|' : ' ', C(WHITE, 4)), true; }
  BG[i] = C(YEL, 7 + L * 0.2); return set(i, ' ', 0), true;
}
ROOM_DEFS.juicebar = { grid: boxRoom(10, 7), light: 1.15, floor: 'hinoki', ceil: 'pendant', sign: false, wall: juiceWall, keeper: [5.0, 1.55],
  props: r => [KITCHEN_SERVICE_COUNTER(5,2.3,2,.3,1,GREEN), { ...standing(5.0, 1.55, GREEN), face: [0, 1] },
    blender(4.2, 2.25, ORANGE), blender(5.0, 2.25, MAG), blender(5.8, 2.25, GREEN),
    KITCHEN_PRODUCE_CRATE(1.45,1.5,'orange'), KITCHEN_PRODUCE_CRATE(1.45,2.15,'lime'), KITCHEN_PRODUCE_CRATE(8.55,1.5,'banana'), KITCHEN_PRODUCE_CRATE(8.55,2.15,'apple'),
    KITCHEN_WALL_LEDGE(8.8,4.3,.9,.2,1.04,-1,0), ...stoolsY(8.25, 3.8, 4.8, 1.0, GREEN, 1, 0.35),
    ...plainBench(2.3, 5.5, 0.8, 0, -1, BRICK, 0.4), ...plainBench(1.45, 3.7, 0.7, 1, 0, BRICK, 0.3)] };

// ---- bagels (BAGELS): baskets of bagels on the wall behind the counter, the kettle boiling them, tubs of cream cheese
// under the glass; subway tiles, deep green, two tables and a ledge
function bagelWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.4 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.62, 0.3, 0.34, C(YEL, 14), C(GREEN, 1.4))) return true;
  if (z < 1.35) { BG[i] = C(WHITE, 4.6 + L * 0.2); return set(i, fract(z / 0.15) < 0.12 ? '-' : fract(u / 0.3 + (Math.floor(z / 0.15) & 1) * 0.5) < 0.06 ? '|' : ' ', C(GRAY, 3)), true; } // subway tiles
  BG[i] = C(GREEN, 1.3 + L * 0.12); return set(i, ' ', 0), true;
}
ROOM_DEFS.bagelshop = { grid: boxRoom(10, 7), light: 1.0, floor: 'checker', ceil: 'tin', sign: false, wall: bagelWall, keeper: [5.0, 1.55],
  props: r => [KITCHEN_BAGEL_RACK(), KITCHEN_FOOD_CASE(5,2.3,1.9,.33,1.15,'schmear',GREEN), { ...standing(5.0, 1.55, WHITE), face: [0, 1] },
    KITCHEN_POT_STOVE(8.2,1.4,true),
    ...dining(2.2, 4.1, { hl: 0.35, chair: homeChair, chairCol: GREEN, top: solid(BRICK, { top: '=' }), busy: 0.35 }),
    KITCHEN_WALL_LEDGE(8.8,4.4,.9,.2,1.04,-1,0), ...stoolsY(8.25, 3.9, 4.9, 1.0, GREEN, 1, 0.35),
    ...plainBench(2.4, 5.55, 0.8, 0, -1, GREEN, 0.3)] };

Object.assign(ROOM_FOR, { CHICKEN: 'chickenshop', KEBAB: 'kebabshop', BENTO: 'bento', TAKOYAKI: 'takoyaki', YAKITORI: 'yakitori', DONUTS: 'donutshop', JUICE: 'juicebar', BAGELS: 'bagelshop' });
