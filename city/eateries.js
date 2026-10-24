// ===== places to eat, each a room of its own (ROOM_FOR, by the sign over the door), built from a kit: tables with
// chairs round them, booths, counters with stools (everything you could sit on, you can: C), menu boards. Each
// place then has the thing that makes it what it is: the pizza oven, the burger joint's booths and shake machine, the
// taqueria's spit and its paper flags, the sushi conveyor, the ice cream dipping case, the bakery's bread racks.
// Rooms are in metres; y runs from the back wall (0) to the door.

// ---- the kit
// a 13-wide room with its bathroom in the back right corner (walls down x 9, the doorway at (11, 3)): the grid, the wc
// and the fittings in it
const backWc = (w, h) => boxRoom(w, h, { [`${w - 4},1`]: 'W', [`${w - 4},2`]: 'W', [`${w - 4},3`]: 'W', [`${w - 3},3`]: 'W' });
const wcAt = w => ({ x0: w - 3, y0: 1, x1: w - 1, y1: 3, sign: [w - 3, 3, w - 2.5] });
const wcFittings = w => [...toilet(w - 2.4, 1.4, -1, porcelain), washbasin(w - 1.45, 1.3, 0, 1)];
// a table top on a pedestal, hl x hw, h high; shade paints the top (and the edge)
const eatTable = (x,y,hl,hw,shade,h=.76) => [FURNITURE_EAT_TABLE(x,y,hl,hw,shade,h)];
// a table for two (along x: chairs at either end) or four (and either side), the chairs facing it, maybe people in them
function dining(x, y, { n = 2, hl = 0.4, hw = 0.4, top, chairCol = BRICK, busy = 0.4, h = 0.76, chair = homeChair, meal = 'rice' } = {}) {
  const p = eatTable(x, y, hl, hw, top || solid(BRICK, { top: '=' }), h);
  const spots = [[x - hl - 0.42, y, 1, 0], [x + hl + 0.42, y, -1, 0], ...(n > 2 ? [[x, y - hw - 0.42, 0, 1], [x, y + hw + 0.42, 0, -1]] : [])];
  for (const [cx, cy, fx, fy] of spots) {
    const parts=chair(cx,cy,fx,fy,chairCol),height=parts.find(p=>p.seat)?.h??.48;
    p.push(...parts);
    if (chance(busy)) {
      p.push({ ...sitting(cx, cy, shirt(), height), face: [fx, fy] });
      p.push(KITCHEN_SETTING(x-fx*(hl-.15),y-fy*(hw-.15),h,{fx,fy,meal}));
    }
  }
  return p;
}
// a booth along x: a table between two benches with tall backs, facing each other across it (fy of the +y bench: -1)
function booth(x, y, hl, col, { top, busy = 0.45, depth = 0.55, meal = 'rice' } = {}) {
  const p = eatTable(x, y, hl, 0.38, top || solid(GRAY, { top: '=' }));
  for (const e of [-1, 1]) {
    const by = y + e * (0.38 + depth / 2 + 0.05);
    p.push(...FURNITURE_BOOTH_SEAT(x,by,hl,depth,-e,col));
    for (const sx of [x - hl * 0.45, x + hl * 0.45]) { // (the one by the wall still in reach: you slide in)
      p.push(SEAT(sx, by, 0, -e,.46));
      if (chance(busy)) {
        p.push({ ...sitting(sx, by, shirt(), 0.46), face: [0, -e] });
        p.push(KITCHEN_SETTING(sx,y+e*.21,.76,{fx:0,fy:-e,meal}));
      }
    }
  }
  return p;
}
// stools along a counter (at y, from x0 to x1, every step), people on some, facing (fx, fy)
function stools(x0, x1, y, step, col, fx, fy, busy = 0.4, seatZ = 0.62) {
  const p = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) { p.push({ ...STOOL(x, y, col, seatZ), fx, fy }); if (chance(busy)) p.push({ ...sitting(x, y, shirt(), seatZ), face: [fx, fy] }); }
  return p;
}
// and down a side (at x, from y0 to y1), facing fx
function stoolsY(x, y0, y1, step, col, fx, busy = 0.4, seatZ = 0.62) {
  const p = [];
  for (let y = y0; y <= y1 + 1e-6; y += step) { p.push({ ...STOOL(x, y, col, seatZ), fx, fy: 0 }); if (chance(busy)) p.push({ ...sitting(x, y, shirt(), seatZ), face: [fx, 0] }); }
  return p;
}
// a plain bench without a back, facing (fx, fy), hl either side of (x, y): room for two
function plainBench(x, y, hl, fx, fy, col = BRICK, busy = 0.35) {
  const ax=-fy,ay=fx,p=[FURNITURE_BENCH(x,y,hl,fx,fy,col)];
  for (const e of [-1, 1]) {
    const sx = x + ax * e * hl * 0.5, sy = y + ay * e * hl * 0.5;
    p.push(SEAT(sx, sy, fx, fy)); if (chance(busy)) p.push({ ...sitting(sx, sy, shirt(), 0.45), face: [fx, fy] });
  }
  return p;
}
// a moulded plastic chair on steel legs, facing (fx, fy)
const shellChair = (x,y,fx,fy,col) => FURNITURE_SHELL_CHAIR(x,y,fx,fy,col);
// a crate (beer, fruit), h high; slatted
const crateShade = col => (i, t, L) => { BG[i] = C(col, (2 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? (fract(HIT.u * 5) < 0.2 ? '=' : ' ') : fract(HIT.w * 6) < 0.25 ? '=' : ' ', C(GRAY, L * 0.6)), true; };
// the menu, from what they sell: 'NAME PRICE' a line (worked out once a visit)
const menuLines = () => room.board || (room.board = stockFor(room.kind, room.word).map(id => `${ITEMS[id].name.toUpperCase()} ${ITEMS[id].price}`));
// the shop window, from inside, on the front wall: dark glass (the street's lights in it after dark), mullions, a sill
function frontWindow(i, u, uStep, z, d, my, L, z0 = 0.95, z1 = 2.35) {
  if (my !== room.H - 1 || z < z0 || z > z1) return false;
  const x = -u; // (on the front wall u runs the other way)
  if (z < z0 + 0.06 || z > z1 - 0.05 || fract(x / 1.5) < 0.04) { BG[i] = C(GRAY, 2.2 + L * 0.2); return set(i, ' ', 0), true; }
  const glow = hash(Math.floor(x * 3), Math.floor(z * 4), 103);
  BG[i] = C(BLUE, 0.5 + day * 1.8); return set(i, night > 0.5 && glow > 0.9 ? 'o' : fract((x + z) * 2.5) < 0.04 ? '/' : ' ', C(glow > 0.95 ? YEL : WHITE, 9)), true;
}
// a menu board on a wall, centred at u0, its lines from z0 down: true if it painted this cell
function menuBoard(i, u, uStep, z, d, u0, z0, lines, hw, bg, col, title, titleCol) {
  const h = lines.length * 0.24 + (title ? 0.34 : 0) + 0.12, z1 = z0 + 0.12 + (title ? 0.34 : 0);
  if (Math.abs(u - u0) > hw || z > z1 || z < z1 - h) return false;
  if (Math.abs(u - u0) > hw - 0.04 || z > z1 - 0.04 || z < z1 - h + 0.04) { BG[i] = C(GRAY, 2.5); return set(i, ' ', 0), true; } // its frame
  BG[i] = bg;
  if (title && wallText(i, u, uStep, z, d, title, u0, z1 - 0.2, 0.17, 0.26, titleCol, bg)) return true;
  for (const [k, line] of lines.entries()) if (wallText(i, u, uStep, z, d, line, u0, z0 - k * 0.24, 0.13, 0.2, col, bg)) return true;
  return set(i, ' ', 0), true;
}
// a red and white checked tablecloth, hanging a little over the edge
const checkCloth = (i, t, L) => { BG[i] = (Math.floor(HIT.u * 6) + Math.floor(HIT.v * 6)) & 1 ? C(RED, 3 + L * 0.3) : C(WHITE, 4 + L * 0.3); return set(i, ' ', 0), true; };

// ---- the pizzeria (PIZZA): the wood-fired oven glowing in the corner, pies under the heat lamps on the counter,
// tables in checked cloths, a chalkboard menu, the tricolour round the walls
const pizzaOven = (x,y) => KITCHEN_PIZZA_OVEN(x,y);
function pizzaWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.75, 1.95, room.menu, 1.2, C(GRAY, 0.8), C(WHITE, 14), 'MENU', C(YEL, 14))) return true;
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 4.6, 2.62, 0.3, 0.42, C(RED, 15), C(GRAY, 0.6))) return true; // in red neon
  if (z > 0.98 && z < 1.16) { const k = Math.floor((z - 0.98) / 0.06); BG[i] = C([RED, WHITE, GREEN][k] ?? GREEN, k === 1 ? 6 : 3.5); return set(i, ' ', 0), true; } // the tricolour, all round
  if (z < 0.98) { BG[i] = C(WHITE, 2.6 + L * 0.1); return set(i, fract(u * 6.5) < 0.06 || fract(z * 13) < 0.08 ? '+' : ' ', C(GRAY, L * 0.3)), true; } // white tiles
  const fu = fract(u / 2.2), fz = z - 1.45; // framed photos: the old country, the family, a football team
  if (!backWall(my) && fu > 0.3 && fu < 0.7 && fz > 0 && fz < 0.6) {
    if (fu < 0.33 || fu > 0.67 || fz < 0.04 || fz > 0.56) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
    const h = hash(Math.floor(u / 2.2), mx + my, 88); BG[i] = C(h < 0.5 ? STONE : BLUE, 1.6 + fz * 2); return set(i, hash(Math.floor(u * 20), Math.floor(z * 20), 89) > 0.8 ? '.' : ' ', C(GRAY, 3)), true;
  }
  BG[i] = C(YEL, 2.4 + L * 0.12); return set(i, ' ', 0), true; // warm plaster
}
ROOM_DEFS.pizzeria = { grid: backWc(13, 9), wc: wcAt(13), light: 0.95, floor: 'cotto', ceil: 'pendant', sign: false, wall: pizzaWall, keeper: [6.6, 1.75],
  props: r => [pizzaOven(1.95, 1.85),
    KITCHEN_FOOD_CASE(6.6,2.45,2,.38,1.05,'pizza'), { ...standing(6.6, 1.75, WHITE), face: [0, 1] },
    ...[4.9, 6.6, 8.3].map(x => hung(x, 2.45, 2.0, (vx, vy, z) => drum(vx, vy, 0.12, z - 0.12, z, (i, t, L) => { BG[i] = C(HIT.face === 6 ? YEL : RED, HIT.face === 6 ? 13 : 4); return set(i, ' ', 0), true; }))), // the heat lamps
    KITCHEN_SERVICE_COUNTER(8.3,1.4,.55,.35,.9,GRAY,GRAY), // the prep counter at the back, a sack of flour on it
    BX(8.05, 1.4, 0.2, 0.15, 0.9, 1.25, (i, t, L) => { BG[i] = C(WHITE, 4); return set(i, HIT.face <= 4 && Math.abs(HIT.w - 1.08) < 0.04 ? '~' : ' ', C(GRAY, 3)), true; }),
    ...dining(2.4, 5.0, { top: checkCloth, meal: 'pizza', busy: 0.45 }), ...dining(10.2, 5.0, { top: checkCloth, meal: 'pizza', busy: 0.45 }),
    ...dining(2.4, 7.3, { top: checkCloth, meal: 'pizza', busy: 0.35 }), ...dining(10.2, 7.3, { top: checkCloth, meal: 'pizza', busy: 0.35 }),
    POT_PLANT(1.45, 3.3, 1.3), ...wcFittings(13)] };

// ---- the burger joint (BURGERS): red booths down both walls, a chrome counter with stools, the shake machine and the
// soda fountain behind it, lit menu boards with the burgers on them, the griddle glowing through the pass, neon
const shakeMachine = (x, y) => KITCHEN_SHAKE_MACHINE(x,y);
const sodaFountain = (x, y) => KITCHEN_SODA_FOUNTAIN(x,y);
const BURGER_COUNTER_Y=2.6; // leave a walkable staff aisle beside the supported machines
function burgerWall(i, u, uStep, z, d, mx, my, L) {
  const M = 5.7; // (over the counter, clear of the bathroom)
  if (backWall(my)) {
    if (z > 2.55 && wallText(i, u, uStep, z, d, room.word, M, 2.75, 0.3, 0.38, C(YEL, 15), C(RED, 2))) return true; // neon, red behind it
    if (z > 1.75 && z < 2.5 && Math.abs(u - M) < 3.3) { // the lit menu boards: a burger drawn on each, the prices under
      const k = Math.floor((u - M + 3.3) / 2.2), cu = u - (M - 3.3 + k * 2.2 + 1.1);
      if (Math.abs(cu) > 1.02 || z < 1.8 || z > 2.45) { BG[i] = C(GRAY, 0.6); return set(i, ' ', 0), true; }
      BG[i] = C(WHITE, 6);
      if (wallText(i, u, uStep, z, d, room.menu[k] || '', M - 3.3 + k * 2.2 + 1.1, 1.92, 0.12, 0.16, C(RED, 6), C(WHITE, 6))) return true;
      const bz = z - 2.22, r = Math.hypot(cu / 1.6, bz); // the picture: bun, patty, cheese, lettuce, bun
      if (r < 0.18) { const layer = bz > 0.06 ? [ORANGE, 8] : bz > 0.02 ? [GREEN, 6] : bz > -0.02 ? [YEL, 11] : bz > -0.07 ? [BRICK, 3] : [ORANGE, 8]; BG[i] = C(...layer); return set(i, bz > 0.1 && fract(cu * 20) < 0.2 ? '.' : ' ', C(WHITE, 13)), true; }
      return set(i, ' ', 0), true;
    }
    if (z > 1.0 && z < 1.65 && Math.abs(u - M) < 2.2) { const g = noise(u * 6, z * 6 - T * 2, 90); BG[i] = C(ORANGE, 2 + g * 3); return set(i, g > 0.6 ? '~' : '.', C(YEL, 9)), true; } // the pass, the griddle hot behind it
  }
  if (z < 1.0) { BG[i] = (Math.floor(u * 4) + Math.floor(z * 4)) & 1 ? C(WHITE, 4 + L * 0.2) : C(RED, 3 + L * 0.2); return set(i, ' ', 0), true; } // red and white tiles
  if (z < 1.08) { BG[i] = C(GRAY, 4); return set(i, '=', C(WHITE, 13)), true; } // a chrome strip
  BG[i] = C(CYAN, 1.6 + L * 0.12); return set(i, fract(u / 1.6) < 0.02 ? '|' : ' ', C(WHITE, 4)), true; // mint walls
}
ROOM_DEFS.burgerjoint = { grid: backWc(13, 10), wc: wcAt(13), light: 1.05, floor: 'checker', ceil: 'strip', sign: false, neon: true, wall: burgerWall, keeper: [5.9, 1.6],
  props: r => [KITCHEN_SERVICE_COUNTER(6,BURGER_COUNTER_Y,2.8,.32,1.05,RED,WHITE),
    { ...standing(5.9, 1.6, RED), face: [0, 1] }, shakeMachine(4.0, 1.45), sodaFountain(7.9, 1.45),
    ...stools(3.6, 8.6, BURGER_COUNTER_Y+.7, 1.0, RED, 0, -1, 0.35),
    ...[3.6, 5.85, 8.0].flatMap(y => booth(1.65, y, 0.55, RED, { busy: 0.4, meal: 'burger' })), ...booth(11.35, 8.0, 0.55, RED, { busy: 0.4, meal: 'burger' }), // down both walls
    JUKEBOX(11.55, 5.9, -1, 0), ...wcFittings(13)] };

// ---- the taqueria (TACOS): the spit of al pastor turning by the grill, the salsa bar, a cooler of bright sodas,
// paper flags strung across the ceiling, painted walls with a tiled skirt, picnic tables and a ledge with stools
const PICADO = [RED, YEL, GREEN, MAG, CYAN, ORANGE, BLUE];
const papelPicado = (y, x0, x1, z) => ROOM_MODEL((x0 + x1) / 2, y, (vx, vy) => {
  const hl = (x1 - x0) / 2;
  rod(vx - hl, vy, z, vx + hl, vy, z, 0.004, GRAY, 0.8);
  for (let x = -hl + 0.15; x < hl; x += 0.32) {
    const sag = (1 - (x / hl) ** 2) * 0.12, k = Math.floor((x + hl) / 0.32);
    drawBox(boxAt(vx + x, vy, 1, 0, 0.13, 0.004, z - sag - 0.3, z - sag), (i, t, L) => {
      if (fract(HIT.u * 18) < 0.3 && fract(HIT.w * 18) < 0.3) return false; // (cut-outs: they're lace, you see through)
      BG[i] = C(PICADO[k % PICADO.length], 7 + L * 0.2); return set(i, ' ', 0), true; });
  }
});
const trompo = (x,y) => KITCHEN_SPIT(x,y,'pastor');
function tacoWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.7, 2.1, room.menu, 1.25, C(GRAY, 0.6), C(YEL, 15), 'TACOS', C(MAG, 15))) return true;
  if (z < 0.95) { const k = (Math.floor(u * 5) + Math.floor(z * 5)) & 1, mot = Math.abs(fract(u * 5) - 0.5) + Math.abs(fract(z * 5) - 0.5) < 0.22; BG[i] = C(k ? BLUE : WHITE, k ? 4 : 5.5); return set(i, mot ? '+' : ' ', C(k ? WHITE : BLUE, 10)), true; } // talavera tiles
  const band = Math.floor(u / 2.4 + my * 0.5 + mx * 0.5) % 3;
  BG[i] = C([CYAN, MAG, YEL][(band + 3) % 3], ([CYAN, MAG, YEL][(band + 3) % 3] === YEL ? 6 : 4) + L * 0.15); // painted walls, each stretch its own colour
  return set(i, z > 2.7 && fract(u * 3) < 0.3 ? 'v' : ' ', C(WHITE, 10)), true; // a scallop round the top
}
ROOM_FLOORS.saltillo = (i, f, wx, wy, r, x, L) => { // big square terracotta tiles, each fired a little different, grout between
  const tx = Math.floor(wx / 0.5), ty = Math.floor(wy / 0.5), g = fract(wx / 0.5) < 0.06 || fract(wy / 0.5) < 0.06;
  BG[i] = g ? C(STONE, 0.8 + f * 1.5) : C(BRICK, 1.2 + f * 2.6 + hash(tx, ty, 99) * 0.5); return set(i, g ? ' ' : hash(Math.floor(wx * 8), Math.floor(wy * 8), 100) > 0.94 ? '.' : ' ', C(ORANGE, L * 0.5));
};
ROOM_DEFS.taqueria = { grid: backWc(13, 9), wc: wcAt(13), light: 1.0, floor: 'saltillo', ceil: 'strip', sign: false, wall: tacoWall, keeper: [5.2, 1.55],
  props: r => [KITCHEN_SERVICE_COUNTER(5.5,2.6,2.7,.32,1,BLUE,GRAY,true),
    { ...standing(5.2, 1.55, ORANGE), face: [0, 1] }, trompo(2.9, 1.4), standing(3.6, 1.4, WHITE),
    KITCHEN_FLATTOP(7.6,1.4),
    KITCHEN_SALSA_BAR(),
    BX(11.6, 7.4, 0.35, 0.5, 0, 1.9, (i, t, L) => { if (HIT.face !== 1 && HIT.face !== 2) { BG[i] = C(GRAY, 2); return set(i, ' ', 0), true; } BG[i] = C(CYAN, 1.2); return set(i, fract(HIT.w * 3) < 0.12 ? '=' : fract(HIT.v * 8) < 0.5 ? 'i' : ' ', C(PICADO[Math.floor(HIT.v * 8 + 8) % 7], 13)), true; }), // the cooler faces into the room and stays inside the wall
    ...dining(3.0, 5.0, { n: 4, hl: 0.55, hw: 0.4, top: solid(ORANGE, { top: '=' }), chairCol: BLUE, busy: 0.4 }), ...dining(7.2, 5.0, { n: 4, hl: 0.55, hw: 0.4, top: solid(GREEN, { top: '=' }), chairCol: RED, busy: 0.35 }),
    BX(1.25, 7.4, 0.2, 1.2, 1.0, 1.06, solid(BRICK, { top: '=' }), 0, 1), ...[6.6, 7.4, 8.2].flatMap(y => { const q = [STOOL(1.75, y, YEL, 0.7)]; if (chance(0.35)) q.push({ ...sitting(1.75, y, shirt(), 0.7), face: [-1, 0] }); return q; }), // the ledge along the wall
    papelPicado(3.4, 1, 12, 2.7), papelPicado(5.6, 1, 12, 2.75), papelPicado(7.6, 1, 12, 2.7), ...wcFittings(13)] };

// ---- the sushi bar (SUSHI): a conveyor belt round an island counter, plates going round on it, the chefs inside,
// stools all round; pale wood walls, a noren over the kitchen door, paper lanterns, the fish on its board
const SUSHI_LOOP = { x0: 3.0, x1: 9.0, y0: 2.6, y1: 4.9 }; // the belt's path (its middle line), round the island
const SUSHI_WORK = (()=>{
  const y=(SUSHI_LOOP.y0+SUSHI_LOOP.y1)/2,half=.35,edge=.25;
  return {y,half,edge,north:(SUSHI_LOOP.y0+edge+y-half)/2,south:(y+half+SUSHI_LOOP.y1-edge)/2};
})();
function sushiAt(s) { // a point s metres round the belt: [x, y]
  const { x0, x1, y0, y1 } = SUSHI_LOOP, w = x1 - x0, h = y1 - y0, P = 2 * (w + h);
  s = mod(s, P);
  if (s < w) return [x0 + s, y0]; s -= w;
  if (s < h) return [x1, y0 + s]; s -= h;
  if (s < w) return [x1 - s, y1]; s -= w;
  return [x0, y1 - s];
}
const sushiBelt = () => ROOM_MODEL((SUSHI_LOOP.x0 + SUSHI_LOOP.x1) / 2, (SUSHI_LOOP.y0 + SUSHI_LOOP.y1) / 2, (vx, vy) => {
  const { x0, x1, y0, y1 } = SUSHI_LOOP, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, P = 2 * (x1 - x0 + y1 - y0);
  for (let k = 0; k < 22; k++) {
    const [x, y] = sushiAt(k * P / 22 + T * 0.18), px_ = vx + x - cx, py_ = vy + y - cy;
    if (hash(k, 3, 94) < 0.18) continue; // (an empty gap: somebody took it)
    kitchenSushi(px_,py_,.95,k);
  }
});
function sushiCounterShade(i, t, L) { // pale wood, the steel belt round its top edge
  if (HIT.face === 5) { BG[i] = C(GRAY, 2.6 + L * 0.2); return set(i, fract(HIT.u * 10 + HIT.v * 10 - T * 2) < 0.15 ? '-' : ' ', C(WHITE, 6)), true; }
  BG[i] = C(STONE, (2.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, fract(HIT.w * 7) < 0.1 ? '-' : ' ', C(BRICK, L * 0.5)), true;
}
function sushiWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && Math.abs(u - 6.0) < 0.8 && z < 2.1) { // the noren, over the kitchen door: three panels, a wave on them
    if (z > 1.35) { BG[i] = C(BLUE, 3 + L * 0.2); return set(i, Math.abs(fract(u * 1.9) - 0.5) < 0.04 ? ' ' : z > 1.6 && z < 1.8 && Math.abs(fract(u * 4 + z * 2) - 0.5) < 0.15 ? '~' : ' ', C(WHITE, 13)), true; }
    BG[i] = C(GRAY, 0.6); return set(i, ' ', 0), true; // (the dark doorway below)
  }
  if (backWall(my) && z > 2.2 && wallText(i, u, uStep, z, d, room.word, 3.2, 2.5, 0.3, 0.4, C(RED, 13), C(STONE, 4))) return true; // on a painted board
  if (backWall(my) && z > 1.6 && z < 2.3 && Math.abs(u - 8.7) < 1.0) { // the fish, carved on its board
    const fu = (u - 8.7) / 0.9, fz = (z - 1.95) / 0.3, body = fu * fu + fz * fz * 2.2 < 0.5, tail = fu < -0.6 && Math.abs(fz) < (-fu - 0.6) * 2;
    BG[i] = body || tail ? C(GRAY, 3 + L * 0.2) : C(BRICK, 2); return set(i, body && fract(fu * 6) < 0.3 ? ')' : ' ', C(WHITE, 9)), true;
  }
  if (z < 0.9) { BG[i] = C(BRICK, 1.6 + L * 0.2); return set(i, fract(u * 5) < 0.06 ? '|' : ' ', C(GRAY, 2)), true; } // dark wood below
  BG[i] = C(STONE, 3.2 + L * 0.15); return set(i, fract(u / 0.9) < 0.03 || fract(z / 0.9) < 0.03 ? '|' : ' ', C(BRICK, 5)), true; // pale panels, framed in wood
}
// long boards, staggered: pale cypress (the sushi bar) or honey oak (the bakery)
const planks = (col, lv) => (i, f, wx, wy, r, x, L) => {
  const row = Math.floor(wy * 4), seam = fract(wx / 1.4 + row * 0.37) < 0.02;
  BG[i] = C(col, lv * (0.4 + f) + hash(Math.floor(wx / 1.4 + row * 0.37), row, 101) * 0.4); return set(i, fract(wy * 4) < 0.08 ? '-' : seam ? '|' : ' ', C(BRICK, L * 0.4));
};
Object.assign(ROOM_FLOORS, { hinoki: planks(STONE, 3.2), oak: planks(ORANGE, 2.2) });
// little hexagonal terracotta tiles (the pizzeria's): offset rows, each a shade of its own
ROOM_FLOORS.cotto = (i, f, wx, wy, r, x, L) => {
  const row = Math.floor(wy / 0.26), cx = wx / 0.3 + (row & 1) * 0.5, cu = fract(cx) - 0.5, cv = fract(wy / 0.26) - 0.5, edge = Math.abs(cu) > 0.44 || Math.abs(cv) > 0.42 && Math.abs(cu) > 0.1;
  BG[i] = edge ? C(STONE, 0.9 + f * 1.6) : C(BRICK, 1.3 + f * 2.6 + hash(Math.floor(cx), row, 102) * 0.6); return set(i, ' ', 0);
};
ROOM_DEFS.sushibar = { grid: backWc(14, 9), wc: wcAt(14), light: 0.9, floor: 'hinoki', ceil: 'lantern', sign: false, wall: sushiWall, keeper: [6.0, SUSHI_WORK.south],
  props: r => {
    const { x0, x1, y0, y1 } = SUSHI_LOOP,edge=SUSHI_WORK.edge,p = [
      BX((x0 + x1) / 2, y0, (x1 - x0) / 2 + edge, edge, 0, 0.95, sushiCounterShade), BX((x0 + x1) / 2, y1, (x1 - x0) / 2 + edge, edge, 0, 0.95, sushiCounterShade),
      BX(x0, (y0 + y1) / 2, edge, (y1 - y0) / 2 - edge, 0, 0.95, sushiCounterShade), BX(x1, (y0 + y1) / 2, edge, (y1 - y0) / 2 - edge, 0, 0.95, sushiCounterShade), // the island, round its belt
      BX(6.0, SUSHI_WORK.y, 2.6, SUSHI_WORK.half, 0, 0.85, solid(GRAY, { top: '=' })), sushiBelt(), // the chefs' bench inside it
      { ...standing(6.0, SUSHI_WORK.south, WHITE), face: [0, 1] }, { ...standing(4.2, SUSHI_WORK.north, WHITE), face: [0, -1] }, ...wcFittings(14)];
    for (let x = x0; x <= x1 + 1e-6; x += 1.0) for (const [y, fy] of [[y0 - 0.55, 1], [y1 + 0.55, -1]]) { p.push(STOOL(x, y, RED, 0.62)); if (chance(0.4)) p.push({ ...sitting(x, y, shirt(), 0.62), face: [0, fy] }); }
    for (const [x, fx] of [[x0 - 0.55, 1], [x1 + 0.55, -1]]) { p.push(STOOL(x, (y0 + y1) / 2, RED, 0.62)); if (chance(0.4)) p.push({ ...sitting(x, (y0 + y1) / 2, shirt(), 0.62), face: [fx, 0] }); }
    for (const x of [2.2, 4.6, 9.4, 11.6]) p.push(hung(x, 6.2, 2.4, (vx, vy, z) => drum(vx, vy, 0.15, z - 0.36, z, (i, t, L) => { BG[i] = C(RED, 6 + 3 * Math.max(night, 0.3)); return set(i, fract(HIT.w * 6) < 0.2 ? '-' : ' ', C(GRAY, 2)), true; }))); // paper lanterns
    p.push(...dining(2.2, 7.4, { hl: 0.35, top: solid(BRICK, { top: '=' }), busy: 0.3 }), ...dining(11.2, 7.4, { hl: 0.35, top: solid(BRICK, { top: '=' }), busy: 0.3 }), ...dining(11.6, 5.0, { hl: 0.35, top: solid(BRICK, { top: '=' }), busy: 0.3 }));
    return p;
  } };

// ---- the ice cream parlour (ICE CREAM): the dipping case of tubs in every colour, cones racked on the wall, pastel
// stripes, little marble tables with wire chairs, a big neon cone
const ICE = [[MAG, 9], [WHITE, 12], [GREEN, 9], [BRICK, 4], [YEL, 12], [ORANGE, 9], [CYAN, 10], [RED, 8]];
const wireChair = (x, y, fx, fy, col) => { // a parlour chair: a round seat, a heart-shaped wire back
  const seat = { ...ROOM_MODEL(x, y, (vx, vy) => {
    drum(vx, vy, 0.2, 0.44, 0.48, (i, t, L) => { BG[i] = C(col, 4 + L * 0.3); return set(i, ' ', 0), true; });
    for (const [ex, ey] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rod(vx + ex * 0.14, vy + ey * 0.14, 0, vx + ex * 0.12, vy + ey * 0.12, 0.44, 0.008, WHITE, 1.4);
    const bx = vx - fx * 0.2, by = vy - fy * 0.2;
    for (let k = 0; k < 10; k++) { const t0 = k / 10 * Math.PI * 2, t1 = (k + 1) / 10 * Math.PI * 2, r = 0.16; rod(bx - fy * Math.cos(t0) * r, by + fx * Math.cos(t0) * r, 0.75 + Math.sin(t0) * r, bx - fy * Math.cos(t1) * r, by + fx * Math.cos(t1) * r, 0.75 + Math.sin(t1) * r, 0.008, WHITE, 1.4); }
  }, [0.2, 0.2, 0.48]), seat: true, fx, fy, h: 0.48 };
  return [seat];
};
function iceWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z > 2.0 && Math.abs(u - 2.0) < 0.6) { // the neon cone
    const cu = u - 2.0, cz = z - 2.0, cone = cz < 0.5 && Math.abs(cu) < cz * 0.35, scoop = Math.hypot(cu, cz - 0.62) < 0.2;
    BG[i] = scoop ? C(MAG, 10) : cone ? C(ORANGE, 9) : C(GRAY, 1); return set(i, cone && fract(cz * 8 + cu * 8) < 0.2 ? 'x' : ' ', C(BRICK, 6)), true;
  }
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.6, 2.0, ['1 SCOOP 3', '2 SCOOPS 5', 'SHAKE 5', 'SUNDAE 7'], 1.2, C(WHITE, 8), C(MAG, 8), room.word, C(CYAN, 7))) return true;
  if (backWall(my) && z > 1.3 && z < 1.8 && Math.abs(u - 4.2) < 0.9) { BG[i] = C(WHITE, 6); return set(i, fract(u * 6) < 0.5 && fract(z * 6) < 0.5 ? 'V' : ' ', C(ORANGE, 9)), true; } // cones, racked
  if (z < 0.95) { BG[i] = C(WHITE, 5 + L * 0.2); return set(i, fract(u * 4) < 0.05 ? '|' : ' ', C(MAG, 6)), true; } // white panelling
  const st = Math.floor(u * 3) % 3; BG[i] = C([MAG, WHITE, GREEN][(st + 3) % 3], [7, 9, 7][(st + 3) % 3] + L * 0.2); return set(i, ' ', 0), true; // candy stripes
}
ROOM_FLOORS.pastel = (i, f, wx, wy, r, x, L) => { BG[i] = (Math.floor(wx * 2) + Math.floor(wy * 2)) & 1 ? C(MAG, 5 + f * 3) : C(WHITE, 6 + f * 4); return set(i, ' ', 0); };
ROOM_DEFS.icecream = { grid: boxRoom(11, 8), light: 1.1, floor: 'pastel', ceil: 'pendant', sign: false, neon: true, wall: iceWall, keeper: [5.5, 1.5],
  props: r => [KITCHEN_FOOD_CASE(5.5,2.3,2.6,.42,1.1,'icecream',WHITE), { ...standing(5.5, 1.5, MAG), face: [0, 1] },
    ...[[2.0, 4.6], [5.5, 5.4], [9.0, 4.6]].flatMap(([x, y]) => dining(x, y, { hl: 0.32, hw: 0.32, top: solid(WHITE, { top: ' ', bright: 2 }), busy: 0.4, chair: wireChair, chairCol: MAG, h: 0.74 })),
    POT_PLANT(10.2, 6.9, 1.2)] };

// ---- the bakery (BAKERY): baskets of loaves on wooden racks behind the counter, the glass case of cakes and pastries,
// the deck oven glowing, flour sacks stacked, a table by the door
function bakeryWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z > 2.5 && wallText(i, u, uStep, z, d, room.word, room.W / 2, 2.7, 0.24, 0.3, C(BRICK, 4), C(YEL, 9))) return true;
  if (z < 0.95) { BG[i] = C(BRICK, 1.8 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(WARM, 4)), true; }
  BG[i] = C(YEL, 6 + L * 0.15); return set(i, ' ', 0), true; // cream walls
}
ROOM_DEFS.bakery = { grid: boxRoom(11, 8), light: 1.0, floor: 'oak', ceil: 'pendant', sign: false, wall: bakeryWall, keeper: [5.0, 1.55],
  props: r => [KITCHEN_FOOD_CASE(5,2.35,2.2,.4,1.1,'bakery'), { ...standing(5.0, 1.55, WHITE), face: [0, 1] },
    KITCHEN_DECK_OVEN(9.18,1.5),KITCHEN_BREAD_RACK(4.5,1.14,3.1),
    ...[[1.4, 1.5], [1.4, 2.2], [1.6, 1.85]].map(([x, y], k) => BX(x, y, 0.3, 0.22, k > 1 ? 0.35 : 0, k > 1 ? 0.7 : 0.35, (i, t, L) => { BG[i] = C(WHITE, 4.5 + L * 0.2); return set(i, (HIT.face === 3 || HIT.face === 1) && Math.abs(HIT.w - (k > 1 ? 0.52 : 0.18)) < 0.04 ? '-' : ' ', C(BLUE, 6)), true; })), // flour sacks
    ...dining(2.2, 5.6, { hl: 0.35, meal: 'coffee', top: solid(BRICK, { top: '=' }), busy: 0.35 }), ...dining(8.6, 5.6, { hl: 0.35, meal: 'coffee', top: solid(BRICK, { top: '=' }), busy: 0.35 })] };

Object.assign(ROOM_FOR, { PIZZA: 'pizzeria', BURGERS: 'burgerjoint', TACOS: 'taqueria', SUSHI: 'sushibar', 'ICE CREAM': 'icecream', BAKERY: 'bakery' });
