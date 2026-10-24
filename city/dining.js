// ===== the sit-down places that used to borrow the diner's, the noodle bar's, the cafe's, the bar's and the tea house's
// rooms, each its own now: Thai, pho, dumplings, the dim sum hall, the kissaten, the izakaya, the mahjong parlour.
// Built from eateries.js's kit; every chair, stool, booth and cushion takes you (C). The bigger ones keep a bathroom
// (backWc). Rooms are in metres; y runs from the back wall (0) to the door.

// a round table on its pedestal, n chairs round it facing in, people in some; a lazy susan in the middle if asked
function roundTable(x, y, r, n, { cloth = WHITE, chairCol = RED, busy = 0.4, chair = homeChair, susan = false, h = 0.76, a0 = 0, meal = 'dumplings' } = {}) {
  const p = [FURNITURE_ROUND_TABLE(x,y,r,h,cloth,susan)];
  for (let k = 0; k < n; k++) {
    const a = a0 + k / n * Math.PI * 2, cx = x + Math.cos(a) * (r + 0.38), cy = y + Math.sin(a) * (r + 0.38), fx = -Math.cos(a), fy = -Math.sin(a);
    const parts=chair(cx,cy,fx,fy,chairCol),height=parts.find(p=>p.seat)?.h??.46;
    p.push(...parts);
    if (chance(busy)) {
      p.push({ ...sitting(cx, cy, shirt(), height), face: [fx, fy] });
      p.push(KITCHEN_SETTING(x-fx*(r-.15),y-fy*(r-.15),h,{fx,fy,meal}));
    }
  }
  return p;
}
// a low plastic stool (pho, dumplings): no back, sit facing (fx, fy)
const lowStool = (x,y,fx,fy,col) => [FURNITURE_STOOL(x,y,col,.42,true,fx,fy)];

// ---- Thai (THAI): teak and deep red, gold elephants along the walls, the spirit house up in its corner with marigolds,
// woks flaring through the pass, orchids
const spiritHouse = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  const gold = (i, t, L) => { BG[i] = C(YEL, (4 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face <= 4 && fract(HIT.w * 20) < 0.2 ? '=' : ' ', C(ORANGE, 8)), true; };
  drawBox(boxAt(vx, vy, 1, 0, 0.06, 0.06, 0, 1.35), solid(WHITE)); // the post
  drawBox(boxAt(vx, vy, 1, 0, 0.28, 0.22, 1.35, 1.4), gold); // the platform
  drawBox(boxAt(vx, vy, 1, 0, 0.18, 0.14, 1.4, 1.62), gold); // the little house
  for (const [hl, z] of [[0.24, 1.62], [0.17, 1.7], [0.1, 1.78]]) drawBox(boxAt(vx, vy, 1, 0, hl, hl * 0.8, z, z + 0.08), (i, t, L) => { BG[i] = C(RED, 4 + L * 0.3); return set(i, HIT.face === 5 ? ' ' : '^', C(YEL, 10)), true; }); // its roofs, tiered
  rod(vx, vy, 1.86, vx, vy, 1.98, 0.01, YEL, 1.6); // the finial
  for (let k = 0; k < 7; k++) dot(vx - 0.27 + k * 0.09, vy + 0.23, 1.38 - Math.sin(k / 6 * Math.PI) * 0.05, 0.025, (i, t, L) => { BG[i] = C(ORANGE, 9); return set(i, '*', C(YEL, 13)), true; }); // marigolds
}, [0.28, 0.22, 1.98]);
function thaiWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 1.05 && z < 1.6 && u > 3.6 && u < 6.4) { const g = noise(u * 6, z * 6 - T * 3, 120); BG[i] = C(ORANGE, 2 + g * 4); return set(i, g > 0.65 ? '^' : '.', C(YEL, 10)), true; } // the pass, woks flaring behind it
  if (backWall(my) && z > 2.25 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.5, 0.3, 0.34, C(YEL, 14), C(RED, 2))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.7, 2.05, menuLines(), 1.15, C(RED, 1.4), C(YEL, 14))) return true;
  if (!backWall(my) && z > 1.35 && z < 2.25) { // gold elephants, trunks up, one after another
    const eu = fract(Math.abs(u) / 2.4) * 2.4 - 1.2, ez = z - 1.8;
    const body = (eu / 0.42) ** 2 + (ez / 0.24) ** 2 < 1, head = Math.hypot(eu - 0.42, ez - 0.1) < 0.15, trunk = eu > 0.5 && eu < 0.6 && ez > 0.05 && ez < 0.38, legs = ez < -0.12 && ez > -0.42 && Math.abs(Math.abs(eu) - 0.24) < 0.06;
    if (body || head || trunk || legs) { BG[i] = C(YEL, 6 + L * 0.2); return set(i, body && fract(eu * 6) < 0.15 ? '~' : ' ', C(ORANGE, 9)), true; }
  }
  if (z < 0.95) { BG[i] = C(BRICK, 1.5 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(WARM, 3)), true; } // teak
  if (z < 1.08 || z > 2.6) { BG[i] = C(YEL, 4); return set(i, fract(u * 8) < 0.5 ? '^' : 'v', C(BRICK, 6)), true; } // gold bands, a pattern pressed in
  BG[i] = C(RED, 2 + L * 0.15); return set(i, ' ', 0), true;
}
const teak = solid(BRICK, { top: '=', bright: 1.2 });
ROOM_DEFS.thai = { grid: backWc(13, 9), wc: wcAt(13), light: 0.8, floor: 'oak', ceil: 'pendant', sign: false, wall: thaiWall, keeper: [5.0, 1.6],
  props: r => [...counterBox(5.0, 2.3, 1.4), { ...standing(5.0, 1.6, RED), face: [0, 1] }, spiritHouse(1.5, 1.45), POT_PLANT(8.4, 1.4, 1.2), POT_PLANT(11.5, 6.0, 1.1),
    ...dining(2.6, 4.9, { top: teak, chairCol: BRICK }), ...dining(6.0, 4.9, { top: teak, chairCol: BRICK, busy: 0.35 }), ...dining(9.8, 4.9, { top: teak, chairCol: BRICK }),
    ...dining(2.6, 7.2, { top: teak, chairCol: BRICK, busy: 0.3 }), ...dining(9.8, 7.2, { top: teak, chairCol: BRICK, busy: 0.3 }), ...wcFittings(13)] };

// ---- pho (PHO): the stockpots simmering, steel tables with their caddies of sauces, low plastic stools in every colour,
// green tiles, photos of the bowls over the counter, a fan going round
const stockPot = (x,y) => KITCHEN_POT_STOVE(x,y);
function phoWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.45 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.68, 0.32, 0.36, C(RED, 15), C(YEL, 7))) return true;
  if (backWall(my) && photoMenu(i, u, uStep, z, d, 5.0, 1.6, C(GREEN, 1.5))) return true;
  if (!backWall(my) && z > 1.7 && z < 2.5 && Math.abs(fract(Math.abs(u) / 4.0) - 0.5) < 0.12) { // a wall fan, turning
    const fu = (fract(Math.abs(u) / 4.0) - 0.5) * 4.0, fz = z - 2.1, r = Math.hypot(fu, fz);
    if (r < 0.3) { const blade = fract(Math.atan2(fz, fu) / Math.PI * 1.5 + T * 4) < 0.35; BG[i] = C(r < 0.05 ? GRAY : blade ? CYAN : WHITE, r < 0.05 ? 2 : blade ? 5 : 5.5); return set(i, r > 0.27 || fract(r * 20) < 0.15 ? '+' : ' ', C(GRAY, 4)), true; }
  }
  if (z < 1.2) { BG[i] = C(GREEN, 2.6 + L * 0.2); return set(i, fract(u * 5) < 0.05 || fract(z * 5) < 0.05 ? '+' : ' ', C(WHITE, 5)), true; } // green tiles
  BG[i] = C(WHITE, 5 + L * 0.2); return set(i, ' ', 0), true;
}
const steelTop = solid(GRAY, { bright: 1.6 });
ROOM_DEFS.pho = { grid: backWc(13, 9), wc: wcAt(13), light: 1.05, floor: 'lino', ceil: 'strip', sign: false, wall: phoWall, keeper: [5.0, 1.6],
  props: r => [KITCHEN_SERVICE_COUNTER(5,2.4,2.2,.3,1,GRAY,GRAY), { ...standing(5.0, 1.6, WHITE), face: [0, 1] },
    stockPot(1.45, 1.45), stockPot(2.25, 1.45), { ...standing(2.0, 2.2, WHITE), face: [0, -1] },
    ...dining(2.8, 4.5, { n: 4, hl: 0.5, hw: 0.4, top: steelTop, meal: 'soup', chair: lowStool, chairCol: RED, busy: 0.4 }), ...dining(9.4, 4.5, { n: 4, hl: 0.5, hw: 0.4, top: steelTop, meal: 'soup', chair: lowStool, chairCol: BLUE, busy: 0.4 }),
    ...dining(2.8, 6.6, { n: 4, hl: 0.5, hw: 0.4, top: steelTop, meal: 'soup', chair: lowStool, chairCol: GREEN, busy: 0.35 }), ...dining(9.4, 6.6, { n: 4, hl: 0.5, hw: 0.4, top: steelTop, meal: 'soup', chair: lowStool, chairCol: YEL, busy: 0.35 }),
    ...wcFittings(13)] };

// ---- dumplings (DUMPLINGS): the cooks folding them at a floury table behind the counter, bamboo steamers stacked up and
// steaming, round tables with low stools, paper menus pinned up, round red lanterns
const steamers = (x,y,n) => KITCHEN_STEAMER_STACK(x,y,n);
function dumplingWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 5.0, 2.55, 0.3, 0.34, C(YEL, 14), C(RED, 2.4))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 7.6, 2.05, menuLines(), 0.95, C(WHITE, 7), C(RED, 6))) return true; // a paper menu, pinned up
  if (!backWall(my) && z > 1.4 && z < 2.2 && fract(Math.abs(u) / 2.2) > 0.4 && fract(Math.abs(u) / 2.2) < 0.62) { // and more, by the tables
    const fu = fract(Math.abs(u) / 2.2); BG[i] = C(WHITE, 7); return set(i, fu > 0.43 && fu < 0.59 && fract(z * 9) < 0.35 ? '-' : ' ', C(RED, 6)), true;
  }
  if (z < 1.0) { BG[i] = C(RED, 2.2 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(BRICK, 4)), true; }
  BG[i] = C(YEL, 5.5 + L * 0.15); return set(i, ' ', 0), true; // cream
}
const roundLantern = (x, y) => hung(x, y, 2.3, (vx, vy, z) => { drum(vx, vy, 0.22, z - 0.35, z, (i, t, L) => { BG[i] = C(RED, 6 + 3 * Math.max(night, 0.3)); return set(i, fract(HIT.w * 6) < 0.2 ? '-' : ' ', C(YEL, 10)), true; }); rod(vx, vy, z - 0.35, vx, vy, z - 0.6, 0.02, YEL, 1.4); }); // a tassel under it
ROOM_DEFS.dumplings = { grid: backWc(13, 9), wc: wcAt(13), light: 0.95, floor: 'tile', ceil: 'strip', sign: false, wall: dumplingWall, keeper: [6.6, 1.7],
  props: r => [KITCHEN_SERVICE_COUNTER(5,2.55,2.4,.3,1,RED), KITCHEN_PREP(4.2,1.45,1.2,.35,.85),
    { ...standing(3.6, 2.05, WHITE), face: [0, -1] }, { ...standing(4.8, 2.05, WHITE), face: [0, -1] }, { ...standing(6.6, 1.7, RED), face: [0, 1] }, // two folding, one serving
    steamers(6.3, 2.55, 4), steamers(6.75, 2.55, 3), steamers(7.15, 2.55, 5),
    ...roundTable(2.5, 4.6, 0.45, 4, { chair: lowStool, chairCol: RED, busy: 0.45, a0: Math.PI / 4 }), ...roundTable(9.5, 4.6, 0.45, 4, { chair: lowStool, chairCol: BLUE, busy: 0.4, a0: Math.PI / 4 }),
    ...roundTable(2.5, 6.9, 0.45, 4, { chair: lowStool, chairCol: GREEN, busy: 0.35, a0: Math.PI / 4 }), ...roundTable(9.5, 6.9, 0.45, 4, { chair: lowStool, chairCol: RED, busy: 0.35, a0: Math.PI / 4 }),
    roundLantern(4.0, 5.6), roundLantern(8.0, 5.6), ...wcFittings(13)] };

// ---- dim sum (DIM SUM): the banquet hall: round tables in white cloths with lazy susans, six chairs apiece, a trolley
// of steamers going round, the gold dragon and phoenix on the red wall, a fish tank by the door
const DIMSUM_LOOP = (t, k) => [7.4 + 1.7 * Math.cos(t * 0.15 + k * Math.PI), 6.3 + 1.0 * Math.sin(t * 0.15 + k * Math.PI)];
const trolley = k => KITCHEN_DIMSUM_CART(k); // mobile decoration has no invisible walking barrier
// whoever's pushing it, a step behind, facing the way they're going
const trolleyServer = (k, col) => ({ ...standing(7.4, 6.3, col), tick: s => { const t = T - 2.2, a = t * 0.15 + k * Math.PI; [s.x, s.y] = DIMSUM_LOOP(t, k); s.face = [-Math.sin(a) * 1.7, Math.cos(a)]; } });
function dragonWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.5 && wallText(i, u, uStep, z, d, room.word, 7.4, 2.72, 0.32, 0.34, C(YEL, 15), C(RED, 2.6))) return true;
  if (backWall(my) && z > 1.3 && z < 2.45 && (Math.abs(u - 3.6) < 2.2 || Math.abs(u - 10.0) < 1.0)) { // the dragon (a coil of gold scales, its head up) and the phoenix
    if (u < 7) {
      const c = Math.sin((u - 1.4) * 2.6) * 0.32 + 1.85, on = Math.abs(z - c) < 0.1, head = Math.hypot(u - 5.6, z - 2.25) < 0.15;
      if (on || head) { BG[i] = C(YEL, 7 + L * 0.2); return set(i, head && Math.hypot(u - 5.65, z - 2.3) < 0.04 ? 'o' : fract(u * 10) < 0.4 ? ')' : ' ', C(ORANGE, 10)), true; }
    } else {
      const pu = u - 10.0, pz = z - 1.85, wing = Math.abs(pz - Math.abs(pu) * 0.6) < 0.06 && Math.abs(pu) < 0.8, body = Math.hypot(pu, pz) < 0.14, tail = Math.abs(pu) < 0.05 + (1.85 - z) * 0.3 && pz < 0 && pz > -0.5;
      if (wing || body || tail) { BG[i] = C(wing ? ORANGE : YEL, 7 + L * 0.2); return set(i, tail && fract(z * 10) < 0.3 ? '~' : ' ', C(RED, 9)), true; }
    }
  }
  if (z < 0.9) { BG[i] = C(BRICK, 1.6 + L * 0.2); return set(i, fract(u * 2) < 0.04 ? '|' : ' ', C(YEL, 3)), true; }
  if (z < 0.98 || z > 2.85) { BG[i] = C(YEL, 4.5); return set(i, fract(u * 6) < 0.5 ? '=' : '+', C(BRICK, 6)), true; } // gold trim
  BG[i] = C(RED, 2.4 + L * 0.15); return set(i, ' ', 0), true;
}
const fishTank = (x, y, hl) => [BX(x, y, hl, 0.28, 0, 0.8, solid(GRAY, { panel: 0.4 }), 0, 1), BX(x, y, hl, 0.28, 0.8, 1.6, (i, t, L) => { // the lobsters and the groupers, waiting
  BG[i] = C(BLUE, 1.6 + (HIT.w - 0.8) * 1.5);
  const a = HIT.face <= 2 ? HIT.v : HIT.u, f = Math.floor(HIT.w * 6), sx = fract(a * 0.8 + T * 0.1 * (f & 1 ? 1 : -1) + hash(f, 1, 124));
  if (sx < 0.06 && f > 0 && f < 9) return set(i, f & 1 ? '>' : '<', C(f % 3 ? ORANGE : RED, 13)), true;
  return set(i, hash(Math.floor(a * 20), Math.floor(HIT.w * 20 - T * 2), 125) > 0.94 ? 'o' : ' ', C(CYAN, 9)), true; // bubbles
}, 0, 1)];
ROOM_FLOORS.banquet = (i, f, wx, wy, r, x, L) => { // the hall's carpet: deep red, a gold medallion repeating
  const mu = fract(wx / 1.2) - 0.5, mv = fract(wy / 1.2) - 0.5, m = Math.abs(Math.hypot(mu, mv) - 0.3) < 0.035 || Math.abs(mu) + Math.abs(mv) < 0.08;
  BG[i] = C(m ? YEL : RED, m ? 1.2 + f * 2.4 : 0.8 + f * 1.8); return set(i, m ? ' ' : (r + x) % 4 ? ' ' : '.', C(BRICK, L));
};
ROOM_DEFS.dimsum = { grid: backWc(15, 11), wc: wcAt(15), light: 0.95, height: 3.2, floor: 'banquet', ceil: 'pendant', sign: false, wall: dragonWall, keeper: [7.4, 1.6],
  props: r => [...counterBox(7.4, 2.3, 1.2), { ...standing(7.4, 1.6, RED), face: [0, 1] },
    ...roundTable(3.2, 4.6, 0.6, 6, { susan: true, chairCol: RED, busy: 0.5 }), ...roundTable(11.6, 5.2, 0.6, 6, { susan: true, chairCol: RED, busy: 0.5 }),
    ...roundTable(3.2, 8.0, 0.6, 6, { susan: true, chairCol: RED, busy: 0.4 }), ...roundTable(11.6, 8.0, 0.6, 6, { susan: true, chairCol: RED, busy: 0.4 }),
    trolley(0), trolleyServer(0, WHITE), trolley(1), trolleyServer(1, RED),
    ...fishTank(1.3, 6.3, 0.7), roundLantern(5.4, 3.4), roundLantern(9.4, 3.4), roundLantern(7.4, 8.6), ...wcFittings(15)] };

// ---- the kissaten (KISSATEN): an old coffee house: dark wood, red velvet booths, the siphons bubbling on the bar, a wall
// of cups behind it, stained-glass lamps low over the tables
const siphon = (x, y) => KITCHEN_SIPHON(x,y);
const tiffany = (x, y) => hung(x, y, 1.95, (vx, vy, z) => drum(vx, vy, 0.24, z - 0.18, z, (i, t, L) => { // a lamp of coloured glass, lit
  const seg = Math.floor((Math.atan2(HIT.v, HIT.u) / Math.PI + 1) * 4); BG[i] = C([RED, YEL, GREEN, ORANGE][seg & 3], 6 + 2 * Math.max(night, 0.4)); return set(i, fract(HIT.w * 10) < 0.2 ? '-' : ' ', C(BRICK, 4)), true; }));
function kissatenWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L, 1.0, 2.2)) return true;
  if (backWall(my) && z > 2.4 && z < 2.75 && Math.abs(u - 4.6) < 1.5) { BG[i] = C(YEL, 4.5); return wallText(i, u, uStep, z, d, room.word, 4.6, 2.57, 0.24, 0.26, C(BRICK, 3), C(YEL, 4.5)) || set(i, ' ', 0), true; } // on a brass plate
  if (!backWall(my) && z > 1.9 && z < 2.4 && Math.abs(fract(Math.abs(u) / 3.5) - 0.5) < 0.08) { // a clock
    const cu = (fract(Math.abs(u) / 3.5) - 0.5) * 3.5, cz = z - 2.15, r = Math.hypot(cu, cz), ang = Math.atan2(cu, cz);
    if (r < 0.22) { BG[i] = C(WHITE, 7); const hrs = tod / 12 * Math.PI * 2, mins = fract(tod) * Math.PI * 2, hand = (h, l) => Math.abs(mod(ang - h + Math.PI, Math.PI * 2) - Math.PI) < 0.12 && r < l; return set(i, hand(hrs, 0.12) || hand(mins, 0.19) ? '#' : r > 0.19 ? '.' : ' ', C(BRICK, 2)), true; }
  }
  if (z < 1.0) { BG[i] = C(BRICK, 1.1 + L * 0.15); return set(i, fract(u * 2) < 0.04 ? '|' : ' ', C(WARM, 2)), true; }
  BG[i] = C(WARM, 1.6 + L * 0.15); return set(i, fract(u / 0.8) < 0.03 ? '|' : ' ', C(BRICK, 3)), true; // dark panelling
}
ROOM_DEFS.kissaten = { grid: backWc(13, 8), wc: wcAt(13), light: 0.65, floor: 'oak', ceil: 'pendant', sign: false, wall: kissatenWall, keeper: [4.6, 1.65],
  props: r => [KITCHEN_CUP_RACK(), KITCHEN_SERVICE_COUNTER(4.6,2.4,2.6,.3,1,BRICK,BRICK), { ...standing(4.6, 1.65, WHITE), face: [0, 1] },
    siphon(3.6, 2.4), siphon(4.1, 2.4), siphon(4.6, 2.4), ...stools(2.4, 6.9, 3.05, 0.9, RED, 0, -1, 0.35),
    ...booth(1.95, 5.0, 0.55, RED, { meal: 'coffee', top: solid(BRICK, { top: '=' }), busy: 0.4 }), ...booth(8.0, 5.0, 0.55, RED, { meal: 'coffee', top: solid(BRICK, { top: '=' }), busy: 0.4 }), ...booth(10.3, 5.0, 0.55, RED, { meal: 'coffee', top: solid(BRICK, { top: '=' }), busy: 0.35 }),
    tiffany(1.95, 5.0), tiffany(8.0, 5.0), tiffany(10.3, 5.0), ...wcFittings(13)] };

// ---- the izakaya (IZAKAYA): the counter and its stools, sake bottles up the wall behind, red lanterns, a tatami corner
// with low tables and cushions, a table for a crowd by the window
ROOM_FLOORS.izakaya = (i, f, wx, wy, r, x, L) => { // dark boards, and tatami in the front corner
  if (wx < 4.4 && wy > 4.6) { const e = fract(wx / 0.9) < 0.04 || fract((wy - 4.6) / 1.8) < 0.03; BG[i] = C(e ? BRICK : YEL, e ? 1 + f : 1.4 + f * 2.4); return set(i, !e && fract(wx * 20) < 0.15 ? '|' : ' ', C(GREEN, L * 0.4)); }
  return ROOM_FLOORS.oak(i, f, wx, wy, r, x, L);
};
function izakayaWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && noren(i, u, z, 1.5, 0.55, BLUE)) return true; // the kitchen
  if (backWall(my) && z > 1.15 && z < 2.35 && u > 2.6 && u < 8.0) { // the bottles: big sake bottles, labels on them
    const sz = (z - 1.15) / 0.6, row = Math.floor(sz), bz = fract(sz), cu = fract(u / 0.26), k = Math.floor(u / 0.26) + row * 37;
    if (bz < 0.08) { BG[i] = C(BRICK, 2); return set(i, '=', C(WARM, L)), true; }
    const bottle = Math.abs(cu - 0.5) < (bz > 0.7 ? 0.1 : 0.32) && bz < 0.95;
    BG[i] = bottle ? (bz > 0.3 && bz < 0.6 ? C(WHITE, 7) : C([GREEN, BRICK, BLUE, GRAY][k & 3], 2.2)) : C(BRICK, 1); return set(i, bottle && bz > 0.3 && bz < 0.6 && fract(bz * 8) < 0.4 ? '=' : ' ', C(GRAY, 3)), true;
  }
  if (backWall(my) && z > 2.45 && wallText(i, u, uStep, z, d, room.word, 5.3, 2.68, 0.28, 0.32, C(WHITE, 13), C(BRICK, 2))) return true;
  if (!backWall(my) && z > 1.35 && z < 2.25 && Math.abs(u) % 3.4 > 1.2 && Math.abs(u) % 3.4 < 2.6) { // the menu tags
    const tu = fract(Math.abs(u) / 0.3), k = Math.floor(Math.abs(u) / 0.3);
    if (tu < 0.18 || tu > 0.82 || z < 1.4 + hash(k, 1, 126) * 0.08) { BG[i] = C(BRICK, 1.4 + L * 0.15); return set(i, ' ', 0), true; }
    BG[i] = C(YEL, 6); return set(i, fract(z * 9 + hash(k, 2, 127)) < 0.45 ? '=' : ' ', C(GRAY, 2)), true;
  }
  BG[i] = C(BRICK, 1.4 + L * 0.15 - Math.max(0, z - 2) * 0.3); return set(i, fract(u * 2.5) < 0.05 ? '|' : ' ', C(GRAY, 2)), true;
}
const zabuton = (x, y, fx, fy) => ({ ...BX(x, y, 0.24, 0.24, 0, 0.1, solid(BLUE, { top: '#', bright: 1.5 })), walk: true, seat: true, x, y, fx, fy, h: 0.12 }); // a floor cushion
ROOM_DEFS.izakaya = { grid: backWc(13, 9), wc: wcAt(13), light: 0.7, floor: 'izakaya', ceil: 'lantern', sign: false, wall: izakayaWall, keeper: [5.3, 1.7],
  props: r => {
    const p = [KITCHEN_SERVICE_COUNTER(5.3,2.5,2.7,.3,1,BRICK,BRICK), { ...standing(5.3, 1.7, BLUE), face: [0, 1] },
      ...stools(2.9, 7.7, 3.15, 0.8, BRICK, 0, -1, 0.45), akachochin(2.0, 4.0), akachochin(8.8, 4.0),
      ...dining(9.4, 6.4, { n: 4, hl: 0.55, hw: 0.4, top: teak, chairCol: BRICK, busy: 0.45 }), ...wcFittings(13)];
    for (const y of [5.6, 7.3]) { // the tatami: low tables, a cushion either side
      p.push(BX(2.1, y, 0.45, 0.3, 0, 0.34, teak));
      for (const [x, fx] of [[1.3, 1], [2.9, -1]]) { p.push(zabuton(x, y, fx, 0)); if (chance(0.45)) p.push({ ...sitting(x, y, shirt(), 0.12), face: [fx, 0] }); }
    }
    return p;
  } };

// ---- the mahjong parlour (MAHJONG): nothing but tables, and the clatter of tiles: green paint, strip lights, the
// cashier at the back, a flask of tea for everyone; sit in on a hand at any of them
function mahjongWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L, 1.1, 2.2)) return true;
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 6.0, 2.55, 0.3, 0.34, C(RED, 14), C(WHITE, 6))) return true;
  if (backWall(my) && z > 1.55 && z < 2.15 && Math.abs(u - 8.7) < 0.9) { BG[i] = C(WHITE, 7); return wallText(i, u, uStep, z, d, 'NO SMOKING', 8.7, 1.85, 0.15, 0.2, C(RED, 6), C(WHITE, 7)) || set(i, ' ', 0), true; } // (nobody minds it)
  if (z < 1.0) { BG[i] = C(GREEN, 1.6 + L * 0.2); return set(i, fract(u * 3) < 0.04 ? '|' : ' ', C(GRAY, 3)), true; }
  BG[i] = C(GREEN, 3 + L * 0.15 - Math.max(0, z - 2) * 0.5); return set(i, hash(Math.floor(u * 3), Math.floor(z * 3), 128) > 0.96 ? '.' : ' ', C(BRICK, 4)), true; // (stained by the smoke, up top)
}
const mahjongTable = (x, y) => {
  const p = [{ mj: true, cx: x, cy: y, ...BX(x, y, 0.45, 0.45, 0.7, 0.76, (i, t, L) => { const f = HIT.face; BG[i] = f === 5 ? C(GREEN, 2) : C(BRICK, 1 + L * 0.2);
    return set(i, f === 5 && (Math.abs(Math.abs(HIT.u) - 0.32) < 0.06 || Math.abs(Math.abs(HIT.v) - 0.32) < 0.06) ? '#' : ' ', C(WHITE, 13)), true; }) }, BX(x, y, 0.08, 0.08, 0, 0.7, solid(BRICK))];
  for (const [ox, oy] of [[-0.75, 0], [0.75, 0], [0, 0.75], [0, -0.75]]) {
    p.push(...homeChair(x + ox, y + oy, -ox / 0.75, -oy / 0.75, BRICK));
    if (chance(0.6)) p.push({ ...sitting(x + ox, y + oy, shirt(), 0.48), face: [-ox / 0.75, -oy / 0.75] });
  }
  return p;
};
ROOM_DEFS.mahjong = { grid: backWc(15, 10), wc: wcAt(15), light: 0.85, floor: 'lino', ceil: 'strip', sign: false, wall: mahjongWall, keeper: [4.0, 1.6],
  props: r => [...counterBox(4.0, 2.3, 1.2), { ...standing(4.0, 1.6, GRAY), face: [0, 1] },
    BX(8.0, 1.4, 0.6, 0.3, 0, 0.85, solid(BRICK, { top: '=' })), ...[7.7, 8.0, 8.3].map(x => ROOM_MODEL(x, 1.4, (vx, vy) => drum(vx, vy, 0.07, 0.85, 1.2, (i, t, L) => { BG[i] = C(RED, 3 + L * 0.3 * drumLit(0.07)); return set(i, HIT.face === 5 ? 'o' : ' ', C(WHITE, 6)), true; }))), // the flasks of tea
    ...mahjongTable(2.6, 5.2), ...mahjongTable(7.0, 5.2), ...mahjongTable(11.2, 5.2), ...mahjongTable(2.6, 7.8), ...mahjongTable(11.2, 7.8), ...wcFittings(15)] };

// ---- the coffee roastery (COFFEE; CAFE keeps the old cafe): the roaster turning its beans over in the cooling tray,
// sacks of green coffee stacked, a pour-over bar with stools, a long table to work at, armchairs by the plants
const roaster = (x,y) => KITCHEN_COFFEE_ROASTER(x,y);
const beanSacks = (x, y) => [[0, 0, 0], [0.5, 0, 0], [0.25, 0.05, 0.38]].map(([dx, dy, z]) => BX(x + dx, y + dy, 0.24, 0.2, z, z + 0.38, (i, t, L) => { BG[i] = C(STONE, (2.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, (HIT.face === 3 || HIT.face === 4) && Math.abs(HIT.w - z - 0.2) < 0.05 ? '#' : fract(HIT.u * 10 + HIT.w * 10) < 0.15 ? ',' : ' ', C(BRICK, 6)), true; }));
const pourOver = (x,y) => KITCHEN_POUR_OVER(x,y);
function roasteryWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.35 && wallText(i, u, uStep, z, d, room.word, 6.0, 2.6, 0.32, 0.36, C(WHITE, 15), C(GRAY, 1))) return true;
  if (backWall(my) && menuBoard(i, u, uStep, z, d, 6.0, 2.0, ['ETHIOPIA  FLORAL', 'COLOMBIA  CARAMEL', ...menuLines()], 1.5, C(GRAY, 0.9), C(WHITE, 13))) return true; // (the beans this week, chalked up over the bar)
  if (z > 1.5 && !backWall(my) && my !== room.H - 1 && Math.abs(fract(Math.abs(u) / 3.2) - 0.5) < 0.18) { const k = hash(Math.floor(Math.abs(u) * 6), Math.floor(z * 6), 147); BG[i] = C(GREEN, 2 + k * 2.5); return set(i, k > 0.6 ? '&' : k > 0.4 ? '%' : ' ', C(GREEN, 9)), true; } // plants trailing down the walls
  BG[i] = C(WHITE, 4.6 + L * 0.15); return set(i, fract(z / 0.16) < 0.1 ? '-' : fract(u / 0.36 + (Math.floor(z / 0.16) & 1) * 0.5) < 0.05 ? '|' : ' ', C(GRAY, 4)), true; // white-painted brick
}
ROOM_DEFS.roastery = { grid: backWc(13, 9), wc: wcAt(13), light: 1.0, floor: 'hinoki', ceil: 'pendant', sign: false, wall: roasteryWall, keeper: [6.0, 1.7],
  props: r => [KITCHEN_SERVICE_COUNTER(6,2.4,2.4,.3,1,BRICK,BRICK), { ...standing(6.0, 1.7, GREEN), face: [0, 1] }, roaster(1.7, 1.5), ...beanSacks(1.4, 3.6),
    pourOver(4.4, 2.4), pourOver(4.8, 2.4), pourOver(5.2, 2.4), KITCHEN_ESPRESSO(7.5,2.4),
    ...stools(4.0, 8.0, 3.05, 1.0, BRICK, 0, -1, 0.4),
    BX(3.6, 6.2, 1.4, 0.45, 0.72, 0.78, solid(BRICK, { top: '=', bright: 1.2 })), ...[2.7, 4.5].map(x => BX(x, 6.2, 0.06, 0.35, 0, 0.72, solid(GRAY))), // the long table
    ...[2.8, 4.4].flatMap(x => [[5.4, 1], [7.0, -1]].flatMap(([y, fy]) => [...homeChair(x, y, 0, fy, BRICK), ...(chance(0.45) ? [{ ...sitting(x, y, shirt(), 0.48), face: [0, fy] }] : [])])),
    ...armchair(10.8, 5.3, -1, 0, GREEN), ...armchair(10.8, 7.0, -1, 0, BRICK), BX(9.9, 6.15, 0.25, 0.25, 0, 0.5, solid(BRICK, { top: '=' })), POT_PLANT(11.4, 4.1, 1.5), ...wcFittings(13)] };

// ---- the noodle house (NOODLES; RAMEN keeps the noodle bar): the cook pulling noodles by hand at the floury table in
// the window to the kitchen, the pots boiling, red lacquer round tables, the menu brushed on red strips
const noodlePuller = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // the dough stretched between the cook's hands, folded, stretched again
  const s = 0.15 + Math.abs(Math.sin(T * 1.6)) * 0.45;
  for (let k = 0; k < 5; k++) rod(vx - s, vy + 0.05, 1.25 + k * 0.012, vx + s, vy + 0.05, 1.25 + Math.sin(k) * 0.02 - s * 0.15, 0.006, WHITE, 2);
});
function noodleHouseWall(i, u, uStep, z, d, mx, my, L) {
  if (frontWindow(i, u, uStep, z, d, my, L)) return true;
  if (backWall(my) && z > 2.3 && wallText(i, u, uStep, z, d, room.word, 6.0, 2.55, 0.3, 0.34, C(YEL, 14), C(RED, 2.6))) return true;
  if (z > 1.3 && z < 2.25 && (backWall(my) ? u > 7.8 && u < 9.6 : my !== room.H - 1 && fract(Math.abs(u) / 3) < 0.5)) { // the menu, brushed on red strips
    const tu = fract(Math.abs(u) / 0.32), k = Math.floor(Math.abs(u) / 0.32);
    if (tu < 0.2 || tu > 0.8 || z < 1.35 + hash(k, 1, 148) * 0.1) { BG[i] = C(YEL, 5.4 + L * 0.15); return set(i, ' ', 0), true; }
    BG[i] = C(RED, 4.5); return set(i, fract(z * 8 + hash(k, 2, 149)) < 0.4 ? '#' : ' ', C(BRICK, 1)), true;
  }
  if (z < 1.0) { BG[i] = C(RED, 2.2 + L * 0.2); return set(i, fract(u * 3) < 0.05 ? '|' : ' ', C(BRICK, 4)), true; }
  BG[i] = C(YEL, 5.4 + L * 0.15); return set(i, ' ', 0), true;
}
ROOM_DEFS.noodlehouse = { grid: backWc(13, 9), wc: wcAt(13), light: 0.95, floor: 'tile', ceil: 'lantern', sign: false, wall: noodleHouseWall, keeper: [6.6, 1.65],
  props: r => [KITCHEN_SERVICE_COUNTER(6,2.5,2.6,.3,1,RED), { ...standing(6.6, 1.65, RED), face: [0, 1] },
    KITCHEN_PREP(2.6,1.45,.9,.35,.9,'noodles'), { ...standing(2.6, 2.05, WHITE), face: [0, -1] }, noodlePuller(2.6, 1.95), // the noodle maker at work
    stockPot(8.0, 1.45), stockPot(8.75, 1.45),
    ...[[2.5, 4.6, 0.45], [9.5, 4.6, 0.45], [2.5, 6.9, 0.35], [9.5, 6.9, 0.35]].flatMap(([x, y, busy]) => roundTable(x, y, 0.45, 4, { cloth: RED, chair: lowStool, chairCol: BRICK, busy, a0: Math.PI / 4 })),
    roundLantern(4.5, 5.8), roundLantern(7.7, 5.8), ...wcFittings(13)] };

Object.assign(ROOM_FOR, { COFFEE: 'roastery', NOODLES: 'noodlehouse', THAI: 'thai', PHO: 'pho', DUMPLINGS: 'dumplings', 'DIM SUM': 'dimsum', KISSATEN: 'kissaten', IZAKAYA: 'izakaya', MAHJONG: 'mahjong' });
