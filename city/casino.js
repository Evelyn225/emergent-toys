// ===== the casino: downtown, facing the plaza across the street (world.js puts it up). Outside: black glass and gold,
// CASINO in big letters lit up in chasing colours, bulbs running round the edge of every face, a red carpet up to the
// doors. Inside: red-and-gold carpet, chandeliers, two blackjack tables, a roulette wheel, rows of slot machines down
// both walls, and the cashier's cage at the back (a drink while you're there). Luck (goods.js) helps at every table.
function casinoFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), glow = Math.max(night, overcast * 0.5, 0.35), sgn = Math.sign(u * wc) || 1;
  const c = CASINO, x0 = c.bx * 8 + 2, x1 = c.bx * 8 + 8, y0 = c.by * 8 + 2, y1 = c.by * 8 + 6;
  const front = side && Math.abs(rel((my + (rel(py - my) < 0 ? 0 : 1)) - y0)) < 0.01; // the face on the plaza
  const a0 = side ? x0 : y0, a1 = side ? x1 : y1, along = wc - a0, len = a1 - a0; // along this face, in cells
  const chase = Math.floor(T * 8);
  if (along < 0.05 || along > len - 0.05 || z > h - 0.06) { // bulbs round the edge of the face, chasing
    const k = Math.floor((along + z) * 12);
    BG[i] = C(BRICK, 1);
    return set(i, 'o', (k + chase) % 3 === 0 ? C(YEL, 15) : C(ORANGE, Math.max(L, glow * 7)));
  }
  if (front && z < 0.42) { // the entrance: gold columns, glass doors, the red carpet running up to them
    const mid = Math.abs(along - len / 2);
    if (mid < 1.2 && z < 0.32) { if (Math.abs(fract(along * 4) - 0.5) < 0.06) return set(i, '|', C(YEL, 14)); BG[i] = C(YEL, 2 + glow * 3); return set(i, ':', C(WHITE, 9)); }
    if (z > 0.32) return set(i, '=', C(YEL, Math.max(L, 12)));
    if (Math.abs(fract(along) - 0.5) < 0.08) { BG[i] = C(YEL, 2); return set(i, '#', C(YEL, Math.max(L, 12))); } // a column
    BG[i] = C(GRAY, 0.6); return set(i, fract(along * 6) < 0.1 ? '|' : ' ', C(MAG, Math.max(L * 0.6, glow * 6)));
  }
  if (front && z > 0.5 && z < 1.05) { // CASINO, in big block letters, each one lit in a different colour, the colours chasing
    const word = 'CASINO', q = (u - sgn * (a0 + len / 2)) / (len * 0.9 / word.length) + word.length / 2, k = Math.floor(q), gy = Math.floor((1.05 - z) / 0.55 * 5);
    if (k >= 0 && k < word.length && gy >= 0 && gy < 5) {
      const on = glyphOn(word[k], Math.floor(fract(q) * 4), gy), col = NEON[(k + chase) & 3];
      BG[i] = on ? C(col, 5) : C(GRAY, 0.5);
      return set(i, on ? '#' : ' ', C(col, 15));
    }
  }
  // the rest: black glass with gold mullions, lit from inside at night
  if (Math.abs(fract(along * 2) - 0.5) < 0.04) return set(i, '|', C(YEL, Math.max(L * 0.8, glow * 9)));
  if (Math.abs(fract(z * 5) - 0.5) < 0.04) return set(i, '-', C(YEL, Math.max(L * 0.6, glow * 7)));
  BG[i] = C(MAG, 0.6 + glow * 1.5);
  return set(i, hash(Math.floor(along * 6), Math.floor(z * 10), 1401) > 0.9 ? '.' : ' ', C(YEL, 12));
}

// ---- inside
const CASINO_W = 22, CASINO_H = 16;
function casinoWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su);
  if (Math.abs(fract(u / 2.5) - 0.5) < 0.06) return set(i, '|', C(YEL, Math.max(L, 9))), true; // gold pilasters
  if (z < 0.9) { BG[i] = C(BRICK, 1 + L * 0.1); return set(i, fract(z / 0.3) < 0.1 ? '=' : ' ', C(YEL, L * 0.6)), true; }
  if (Math.abs(z - 0.95) < 0.05 || Math.abs(z - 3.1) < 0.05) return set(i, '=', C(YEL, Math.max(L, 9))), true;
  if (z > 1.2 && z < 2.9) { BG[i] = C(GRAY, 1 + L * 0.06); return set(i, hash(Math.floor(u * 5), Math.floor(z * 5), 1402) > 0.94 ? '*' : ' ', C(YEL, 10)), true; } // mirrors, the lights twinkling in them
  BG[i] = C(RED, 1 + L * 0.1); return set(i, ' ', 0), true;
}
function casinoFloor(i, f, wx, wy) { // the carpet: red, a gold diamond pattern, busy enough to keep you awake
  const a = fract((wx + wy) * 0.8), b = fract((wx - wy) * 0.8), edge = a < 0.08 || b < 0.08, dot = Math.abs(a - 0.5) < 0.12 && Math.abs(b - 0.5) < 0.12;
  BG[i] = C(RED, 1 + f * 1.4);
  return set(i, edge ? '+' : dot ? '*' : ' ', C(YEL, 3 + f * 6));
}
function casinoCeil(i, wx, wy) { // chandeliers
  const d = Math.hypot(fract(wx / 4) - 0.5, fract(wy / 4) - 0.5) * 4;
  if (d < 0.32) { BG[i] = C(YEL, 3 + (d < 0.15 ? 4 : 0)); return set(i, hash(Math.floor(wx * 9), Math.floor(wy * 9), Math.floor(T * 4)) > 0.7 ? '*' : 'o', C(WHITE, 15)); }
  return set(i, d < 0.7 && hash(Math.floor(wx * 6), Math.floor(wy * 6), 1403) > 0.7 ? '.' : ' ', C(YEL, 6));
}
// cards lying on a blackjack table (u along it, v across: + toward the players): [u, v, pip, colour]
const BJ_CARDS = [];
for (const [u, v] of [[-0.85, 0.36], [0, 0.4], [0.85, 0.36], [-0.1, -0.3]]) for (const k of [0, 1]) BJ_CARDS.push([u + k * 0.09, v - k * 0.02, '♠♥♦♣'[(BJ_CARDS.length * 7) & 3], (BJ_CARDS.length * 7) & 3 && ((BJ_CARDS.length * 7) & 3) < 3 ? RED : GRAY]);
const SLOT_ART = pad([' .---. ', ' |7=7| ', ' |---|o', ' |___|/', ' [###] ', ' [###] ']);
const felt = (shade) => (i, t, L) => { // a gaming table: green felt on top, a padded rail round it, wood below
  const f = HIT.face;
  if (f === 5) { const s = shade && shade(i, L); if (s) return true; BG[i] = C(GREEN, 2 + L * 0.06); return set(i, ' ', 0), true; }
  BG[i] = C(BRICK, (1 + L * 0.15) * shadeFace(f));
  return set(i, HIT.w > 0.78 ? '=' : ' ', C(BRICK, L)), true;
};
ROOM_DEFS.casino = { grid: boxRoom(CASINO_W, CASINO_H), light: 0.7, height: 3.6, floor: 'casino', ceil: 'chandelier', sign: true, signAt: CASINO_W / 2, wall: casinoWall, keeper: [11, 1.5],
  props: r => {
    const p = [...counterBox(11, 2.2, 2.4, 1.1), standing(11, 1.5, GREEN)];
    for (const x of [8.4, 9.6, 10.8, 12, 13.2]) p.push(BX(x, 2.5, 0.03, 0.03, 1.1, 2.4, solid(YEL))); // the cage's bars
    for (const [x, y] of [[5, 6.5], [17, 6.5]]) { // blackjack: cards out on the felt, the dealer behind
      p.push({ casino: 'blackjack', cx: x, cy: y + 0.9, ...BX(x, y, 1.3, 0.6, 0, 0.8, felt((i, L) => {
        const card = BJ_CARDS.find(([cu, cv]) => Math.abs(HIT.u - cu) < 0.06 && Math.abs(HIT.v - cv) < 0.085); // the hands dealt: a pair at each seat, the dealer's
        if (card) { BG[i] = C(WHITE, 9); return set(i, Math.abs(HIT.u - card[0]) < 0.025 && Math.abs(HIT.v - card[1]) < 0.035 ? card[2] : ' ', C(card[3], 12)), true; }
        return false; })) });
      p.push(standing(x, y - 0.9, WHITE));
      for (const ox of [-0.8, 0.8]) if (chance(0.6)) p.push(standing(x + ox, y + 0.95, shirt()));
    }
    p.push({ casino: 'roulette', cx: 11, cy: 10.4, ...BX(11, 9.3, 1.8, 0.7, 0, 0.8, felt((i, L) => { // the roulette table: the wheel at one end, spinning, the layout of numbers
      const wx = HIT.u + 1.2, d = Math.hypot(wx, HIT.v);
      if (d < 0.55) { const an = Math.atan2(HIT.v, wx) + T * 2; BG[i] = d < 0.15 ? C(YEL, 6) : (Math.floor(an / (Math.PI * 2) * 37 + 37) & 1) ? C(RED, 5) : C(GRAY, 1.5); return set(i, d < 0.15 ? '+' : ' ', C(YEL, 15)), true; }
      if (HIT.u > -0.4) { BG[i] = (Math.floor((HIT.u + 0.4) * 5) + Math.floor((HIT.v + 0.7) * 3)) & 1 ? C(RED, 3) : C(GRAY, 1.5); return set(i, Math.abs(fract((HIT.u + 0.4) * 5) - 0.5) < 0.1 ? '|' : ' ', C(WHITE, 8)), true; }
      return false; })) });
    p.push(standing(11, 8.3, WHITE));
    for (const ox of [-1.2, 0, 1.2]) if (chance(0.5)) p.push(standing(11 + ox, 10.35, shirt()));
    for (const x of [1.3, CASINO_W - 1.3]) for (let y = 4.5; y < CASINO_H - 2; y += 1.6) { // slot machines down both walls, lights going
      const ph = x * 3 + y;
      p.push({ casino: 'slots', cx: x + (x < 5 ? 0.9 : -0.9), cy: y, ...SP(x, y, 0.75, 1.7, SLOT_ART, (c, row, L) => c === '7' ? C(RED, 15) : c === '=' && row === 1 ? C(YEL, 15) : c === 'o' ? C(RED, 14) : row === 0 ? C(NEON[(Math.floor(T * 5 + ph)) & 3], 15) : C(GRAY, Math.max(L, 8))) });
      if (chance(0.3)) p.push(sitting(x + (x < 5 ? 0.7 : -0.7), y, shirt(), 0.45, x > 5));
    }
    return p;
  } };
ROOM_FOR.CASINO = 'casino';
const CASINO_NAMES = { blackjack: 'blackjack', roulette: 'roulette', slots: 'the slots' };
const casinoSpot = () => { // the table or machine you're at, if any
  if (mode !== 'room' || room.kind !== 'casino') return null;
  let best = null, bd = 1.4;
  for (const s of room.props) if (s.casino) { const d = Math.hypot(px - s.cx, py - s.cy); if (d < bd) { bd = d; best = s.casino; } }
  return best;
};
