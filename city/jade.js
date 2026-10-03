// ===== the jade shop, in Chinatown: red lacquer walls with gold trim and a lattice, a carved jade dragon coiling
// across the back wall through gold clouds, hanging scrolls, red lanterns overhead, glass cases of bangles and little
// figures, a tall vase in the corner, a lucky cat waving on the counter, incense curling up. The bangles and dragons
// it sells are lucky (see luck() in goods.js).
const JADE_W = 12, JADE_H = 9;
function jadeWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su);
  if (z < 0.85) { BG[i] = C(BRICK, 1 + L * 0.1); return set(i, fract(z / 0.28) < 0.12 ? '=' : fract(u * 1.5) < 0.06 ? '|' : ' ', C(BRICK, L * 0.8)), true; } // dark wood panelling
  if (Math.abs(z - 0.88) < 0.04 || Math.abs(z - 2.62) < 0.04) return set(i, '=', C(YEL, Math.max(L, 10))), true; // gold trim
  if (my === 0 && z > 0.95 && z < 2.55) { // the back wall: a jade dragon in relief, coiling through gold clouds
    const body = 1.72 + 0.42 * Math.sin(u * 1.25 - 0.8), dz = Math.abs(z - body);
    if (dz < 0.13 && u > 1.5 && u < JADE_W - 2.2) { BG[i] = C(GREEN, 2 + L * 0.1); return set(i, dz < 0.05 ? '=' : (Math.floor(u * 6) + Math.floor(z * 8)) & 1 ? '%' : '#', C(GREEN, Math.max(L * 1.2, 9))), true; }
    if (u > JADE_W - 2.4 && u < JADE_W - 1.3 && Math.abs(z - (1.72 + 0.42 * Math.sin((JADE_W - 2.2) * 1.25 - 0.8))) < 0.32) { // its head, an eye, whiskers
      BG[i] = C(GREEN, 2.5); return set(i, Math.abs(u - (JADE_W - 1.8)) < 0.12 && Math.abs(z - 1.86) < 0.08 ? '@' : '%', C(Math.abs(u - (JADE_W - 1.8)) < 0.12 ? RED : GREEN, 13)), true; }
    if (dz > 0.18 && noise(u * 1.4, z * 2.2, 1301) > 0.68) { BG[i] = C(YEL, 2); return set(i, '@', C(YEL, Math.max(L, 9))), true; } // the clouds
    BG[i] = C(RED, 1.5 + L * 0.12); return set(i, ' ', 0), true;
  }
  if (z > 2.62) { BG[i] = C(RED, 1 + L * 0.08); return set(i, ' ', 0), true; }
  const scroll = Math.abs(fract(u / 2.6) - 0.5) < 0.12 && z > 1.05 && z < 2.45; // hanging scrolls between the lattice
  if (scroll) { BG[i] = C(WHITE, 3 + L * 0.1); return set(i, hash(Math.floor(u * 4), Math.floor(z * 5), 1302) > 0.45 ? '#' : ' ', C(GRAY, 3)), true; }
  BG[i] = C(RED, 1.5 + L * 0.12); // red lacquer with a gold lattice worked over it
  return set(i, fract(u * 2 + z * 2) < 0.07 || fract(u * 2 - z * 2) < 0.07 ? '+' : ' ', C(YEL, L * 0.55)), true;
}
function jadeFloor(i, f, wx, wy) { // dark red tiles, a patterned runner up the middle
  if (Math.abs(wx - JADE_W / 2) < 1) { BG[i] = C(RED, 1 + f * 1.5); return set(i, Math.abs(wx - JADE_W / 2) > 0.85 ? '|' : (Math.floor(wy * 2) & 1) ? '+' : 'o', C(YEL, 3 + f * 6)); }
  BG[i] = (Math.floor(wx) + Math.floor(wy)) & 1 ? C(BRICK, 1 + f * 1.4) : C(RED, 0.8 + f);
  return set(i, ' ', 0);
}
// a glass display case on a red base: jade laid out on red velvet inside, seen through the glass top and sides
const jadeCase = (x, y, hl, hw, items) => BX(x, y, hl, hw, 0, 1, (i, t, L) => {
  const f = HIT.face, w = HIT.w, u = HIT.u + 9, v = (HIT.v ?? 0) + 9;
  const piece = (a, b) => { const k = hash(Math.floor(a * 3), Math.floor(b * 3), x * 7 + y); return k > 0.5 && Math.abs(fract(a * 3) - 0.5) < 0.3 && Math.abs(fract(b * 3) - 0.5) < 0.3 ? items[k * 97 % items.length | 0] : null; };
  if (f === 5) { // looking down through the glass top
    if (Math.abs(HIT.u) > hl - 0.06 || Math.abs(HIT.v ?? 0) > hw - 0.06) return set(i, '=', C(YEL, Math.max(L, 9))), true; // the gold frame
    const pc = piece(u, v);
    BG[i] = C(RED, 1 + L * 0.08);
    return set(i, pc || (hash(Math.floor(u * 9), Math.floor(v * 9), 1303) > 0.96 ? '/' : ' '), pc ? C(GREEN, Math.max(L * 1.2, 11)) : C(WHITE, 8)), true; // (a glint on the glass)
  }
  if (w < 0.45) { BG[i] = C(RED, (1 + L * 0.15) * shadeFace(f)); return set(i, w > 0.41 ? '=' : ' ', C(YEL, L)), true; } // the base
  if (w > 0.95) return set(i, '=', C(YEL, Math.max(L, 9))), true; // the frame along the top
  const pc = w > 0.5 && w < 0.88 ? piece(u, w * 2) : null; // through the side: the pieces on their stands
  BG[i] = pc ? C(RED, 1) : C(CYAN, 0.8);
  return set(i, pc || (Math.abs(fract(u * 2) - 0.5) < 0.03 ? '|' : ' '), pc ? C(GREEN, Math.max(L * 1.2, 11)) : C(WHITE, L * 0.5)), true;
});
const JADE_VASE = pad(['  ___  ', ' (___) ', '  ) (  ', ' /%%%\\ ', '(%%@%%)', '(%%%%%)', ' \\%%%/ ', '  ===  ']);
const JADE_CAT = pad([' /\\_/\\ ', '( ^.^ )/', ' (=Y=) ', ' (___) ']);
ROOM_DEFS.jade = { grid: boxRoom(JADE_W, JADE_H), light: 0.75, floor: 'jade', ceil: 'lantern', sign: true, signAt: 3, wall: jadeWall, keeper: [6, 1.6],
  props: r => {
    const p = [...counterBox(6, 2.2, 1.6), standing(6, 1.6, GREEN)];
    p.push({ ...SP(7.1, 2.2, 0.45, 0.5, JADE_CAT, (c, row, L) => c === '^' || c === 'Y' ? C(RED, 14) : C(WHITE, Math.max(L, 10)), 1.05), tick: s => { s.art = fract(T * 1.3) < 0.5 ? JADE_CAT : JADE_CAT.map((l, k) => k === 1 ? l.replace(')/', ')-') : l); } }); // waving
    for (const [x, y] of [[2.2, 4.2], [9.8, 4.2], [2.2, 6.6], [9.8, 6.6]]) p.push(jadeCase(x, y, 0.9, 0.45, ['o', 'O', '&', '@', '8']));
    p.push(SP(10.9, 1.4, 0.7, 1.5, JADE_VASE, (c, row, L) => c === '%' || c === '@' ? C(GREEN, Math.max(L * 1.2, 9)) : C(YEL, Math.max(L, 8))));
    p.push(SP(1.2, 1.4, 0.35, 0.6, pad([' | ', ' | ', '[_]']), (c, row, L) => row < 2 ? C(RED, 14) : C(YEL, 12))); // the incense
    if (chance(0.5)) p.push(standing(4.2, 5.4, shirt()));
    return p;
  } };
ROOM_FOR.JADE = 'jade';
let jadeIncenseT = 0;
function stepJadeIncense(dt) { // a thread of incense smoke curling up in the corner, into the haze
  if (mode !== 'room' || room.kind !== 'jade' || (jadeIncenseT -= dt) > 0) return;
  jadeIncenseT = 0.7;
  haze.push({ at: placeKey(), kind: 'smoke', s: 1, x: 1.2 + (Math.random() - 0.5) * 0.05, y: 1.4, z: 0.75, r: 0.1, rMax: 0.45, vx: 0, vy: 0.02, vz: 0.35, life: 0.8, fade: 1 / 5, seed: Math.random() * 100 });
}
