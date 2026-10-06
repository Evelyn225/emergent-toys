// ===== the cell block: where you end up if you can't pay the fine. Your cell is the middle one of a row of three;
// through its bars, a corridor, a guard walking up and down it, a desk at one end and the steel door out at the
// other, and three cells across the way with their own bars and their own unlucky tenants. The bars are real
// see-through boxes, so it all moves right as you walk about your cell.
const JAIL_W = 22, JAIL_D = 13;
const JAIL_GRID = Array.from({ length: JAIL_D }, (_, y) => Array.from({ length: JAIL_W }, (_, x) => {
  if (x === 0 || y === 0 || x === JAIL_W - 1 || y === JAIL_D - 1) return '#';
  if ((x === 7 || x === 14) && (y <= 5 || y >= 9)) return '#'; // the walls between cells, both sides of the corridor
  return '.';
}).join(''));
const JAIL_BARS_NEAR = 6, JAIL_BARS_FAR = 9; // where the two rows of bars stand (y)
const jailBlock = (x, y) => y > JAIL_BARS_NEAR - 0.25 || x < 8.25 || x > 13.75; // you're in your cell, x 8..14, y 1..6
// a set of bars across a cell front: round uprights every 25cm, a band across near the top
const barShade = (i, t, L) => {
  const u = HIT.u, w = HIT.w, f = HIT.face;
  if (f === 5 || f === 6) return false;
  if (w < 0.06 || Math.abs(w - 2.3) < 0.035) { BG[i] = C(GRAY, 2); return set(i, '=', C(WHITE, L * 1.2)), true; } // a sill and a band across the top
  if (Math.abs(fract(u * 4 + 0.5) - 0.5) < 0.09) return set(i, '|', C(WHITE, L * 1.3)), true;
  return false; // between the bars: see through
};
const bars = (x, y) => ({ ...BX(x, y, 3, 0.03, 0, 3, barShade), peeThrough: true });
const inmate = (x, y, sit) => sit ? sitting(x, y, ORANGE, 0.42) : standing(x, y, ORANGE);
const bunk = (x, y) => [BX(x, y, 0.95, 0.42, 0.42, 0.58, solid(BLUE, { top: '~', bright: 2 })), // a blanket on a steel frame
  BX(x, y, 0.95, 0.42, 0, 0.42, (i, t, L) => { BG[i] = C(GRAY, 2 + L * 0.15); return set(i, HIT.face <= 2 || fract(HIT.u * 2) < 0.12 ? '|' : '_', C(GRAY, L)), true; })];
// a toilet: the cistern against the wall, a pedestal, and the bowl on it with a rim round the water. back: which way
// the wall is (-1: toward -y). Steel in a cell, white porcelain anywhere nicer. The bowl carries `loo` (where it is),
// which is how peeing finds it (pee.js); flushing swirls the water for a moment
const steel = (i, t, L) => { BG[i] = C(GRAY, (1.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '=' : fract(HIT.w * 6) < 0.12 ? '-' : ' ', C(WHITE, L * 0.7)), true; };
const porcelain = (i, t, L) => { BG[i] = C(WHITE, (3.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '=' : ' ', C(GRAY, L * 0.7)), true; };
let flushT = -9;
const toilet = (x, y, back = -1, mat = steel) => [
  BX(x, y + back * 0.3, 0.24, 0.09, 0, 0.82, mat), // the cistern
  BX(x + 0.16, y + back * 0.2, 0.025, 0.04, 0.68, 0.72, (i, t, L) => (set(i, '-', C(WHITE, L)), true)), // its flush handle
  BX(x, y + back * 0.02, 0.11, 0.13, 0, 0.3, mat), // the pedestal
  { ...BX(x, y + back * 0.04, 0.21, 0.26, 0.3, 0.42, (i, t, L) => { // the bowl: an oval rim, water in the middle
    const rim = mat === steel ? GRAY : WHITE;
    if (HIT.face !== 5) return false; // leave the box's square sides transparent; the pedestal forms the bowl's base
    const e = Math.hypot(HIT.u / 0.21, HIT.v / 0.26), swirl = T - flushT < 2.5;
    if (e > 1) return false;
    if (e > 0.68) { BG[i] = C(rim, 2.2 + L * 0.3); return set(i, 'o', C(mat === steel ? WHITE : GRAY, L)), true; }
    if (swirl) { BG[i] = C(BLUE, 2 + L * 0.2); return set(i, '@*o~'[(Math.floor(Math.atan2(HIT.v, HIT.u) * 2 + T * 12) & 3)], C(CYAN, L * 1.3)), true; }
    BG[i] = C(BLUE, 1.4 + L * 0.15); return set(i, e < 0.3 && hash(Math.floor(T * 2), 1, 15) > 0.6 ? '~' : ' ', C(CYAN, L)), true;
  }), loo: [x, y + back * 0.04] }];
function jailProps(r) {
  const p = [];
  for (const cx of [4, 11, 18]) { // the three cells on your side (yours is the middle) and the three across
    p.push(bars(cx, JAIL_BARS_NEAR), bars(cx, JAIL_BARS_FAR));
    p.push(...bunk(cx - 1.1, 1.55), ...toilet(cx + 1.9, 1.4, -1)); // ours: bunk along the back wall
    p.push(...bunk(cx - 1.1, JAIL_D - 2.55), ...toilet(cx + 1.9, JAIL_D - 2.4, 1)); // theirs, the mirror of it
  }
  if (r.cabbie) p.push({ ...sitting(9.9, 1.75, YEL, 0.58), cabbie: true }); // your cab driver, on the bunk, arms folded, not looking at you
  // who's across the way: one at the bars, one asleep on his bunk, one pacing
  p.push(inmate(4.6, 9.6), inmate(10.2, JAIL_D - 2.55, true));
  p.push({ ...inmate(18, 10.6), tick: s => { s.x = 18 + 1.6 * Math.sin(T * 0.35); } });
  // the guard, walking the corridor end to end, and the desk where he sits when he isn't
  p.push({ ...standing(10, 7.5, BLUE), tick: s => { s.x = 11 + 8.5 * Math.sin(T * 0.09); } });
  p.push(BX(19.6, 7.5, 0.5, 0.9, 0, 0.8, solid(GRAY, { panel: 0.4, top: '=' })),
    BX(19.6, 7.3, 0.18, 0.15, 0.8, 1.1, (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, HIT.face === 4 || HIT.face === 3 ? (fract(T * 2) < 0.5 ? ':' : '.') : '#', C(GREEN, 12)), true; }), // a CCTV monitor
    SP(19.6, 8.2, 0.12, 0.08, ['o-'], () => C(YEL, 13), 0.8)); // and his coffee
  return p;
}
// the walls: painted cinder block; the tally marks scratched by your bunk; the corridor's two ends
function jailWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su);
  if (mx === JAIL_W - 1 && my >= 6 && my <= 8) { // the steel door out, its little wired window, the exit sign
    const du = u - 7.5;
    if (Math.abs(du) < 0.65 && z < 2.2) {
      BG[i] = C(GRAY, 2.5 + L * 0.1);
      if (Math.abs(du) < 0.25 && z > 1.4 && z < 1.85) { BG[i] = C(YEL, 2); return set(i, (Math.floor(du * 20) + Math.floor(z * 20)) & 1 ? 'x' : ' ', C(GRAY, 8)), true; }
      return set(i, Math.abs(du) > 0.6 || z > 2.15 ? '#' : Math.abs(du - 0.45) < 0.04 && Math.abs(z - 1.05) < 0.08 ? 'o' : fract(z * 3) < 0.05 ? '-' : ' ', C(GRAY, L * 1.2)), true;
    }
    if (Math.abs(du) < 0.35 && Math.abs(z - 2.45) < 0.12) { BG[i] = C(GREEN, 4); return wallText(i, su, uStep, z, d, 'EXIT', 7.5 * Math.sign(su), 2.45, 0.15, 0.2, C(WHITE, 15)) || set(i, ' ', 0), true; }
  }
  if (mx === 0 && my >= 6 && my <= 8) { // a high barred window at the far end: the sky, whatever it's doing
    const du = u - 7.5;
    if (Math.abs(du) < 0.7 && z > 2.0 && z < 2.7) {
      if (fract(du * 4 + 0.5) < 0.15 || z < 2.05 || z > 2.65) return set(i, '|', C(WHITE, L)), true;
      BG[i] = day > 0.3 ? C(CYAN, 3 + day * 6) : C(BLUE, 1); return set(i, night > 0.5 && fract(du * 7 + z * 3) < 0.05 ? '.' : ' ', C(WHITE, 12)), true;
    }
    if (wallText(i, su, uStep, z, d, 'BLOCK C', 7.5 * Math.sign(su), 1.6, 0.2, 0.28, C(YEL, 13), C(GRAY, 3))) return true;
  }
  if (my === 0 && mx >= 8 && mx <= 13 && z > 1 && z < 1.4 && u > 8.6 && u < 10.4) // tally marks, yours and the ones before you
    return BG[i] = C(GRAY, 3 + L * 0.12), set(i, fract(u * 9) < 0.35 ? '|' : z > 1.3 && fract(u * 1.8) < 0.5 ? '/' : ' ', C(WHITE, L * 0.8)), true;
  BG[i] = C(GRAY, 3 + L * 0.12); // painted cinder blocks: courses every 20cm, the joints staggered
  const row = Math.floor(z * 5), joint = fract(z * 5) < 0.14 || fract(u * 2.5 + (row & 1) * 0.5) < 0.05;
  return set(i, joint ? (fract(z * 5) < 0.14 ? '_' : '|') : ' ', C(GRAY, L * 0.7)), true;
}
// overhead: bare concrete, a caged lamp in each cell and down the corridor; underfoot: painted concrete, a yellow
// line down the corridor the inmates aren't to cross
function jailCeil(i, wx, wy) {
  const lamps = [[4, 3], [11, 3], [18, 3], [4, 10.5], [11, 10.5], [18, 10.5], [2.5, 7.5], [8.5, 7.5], [14.5, 7.5], [20, 7.5]];
  for (const [lx, ly] of lamps) {
    const r = Math.hypot(wx - lx, wy - ly);
    if (r < 0.16) { BG[i] = C(YEL, 6); return set(i, r < 0.08 ? 'O' : '#', C(r < 0.08 ? WHITE : GRAY, 15)); }
  }
  BG[i] = C(GRAY, 1);
  return set(i, (Math.floor(wx * 2) + Math.floor(wy * 2)) % 7 ? ' ' : '.', C(GRAY, 4));
}
function jailFloor(i, f, wx, wy) {
  if (wy > JAIL_BARS_NEAR + 0.3 && wy < JAIL_BARS_FAR - 0.3 && Math.abs(wy - JAIL_BARS_NEAR - 0.45) < 0.05) return set(i, '=', C(YEL, 5 + f * 8)); // the line
  BG[i] = C(GRAY, 1 + f * 1.2);
  return set(i, hash(Math.floor(wx * 3), Math.floor(wy * 3), 37) > 0.92 ? '.' : ' ', C(GRAY, 3 + f * 4));
}
