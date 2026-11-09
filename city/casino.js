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
    BG[i] = (k + chase) % 3 === 0 ? C(YEL, 15) : C(ORANGE, Math.max(L * .5, glow * 6)); // bulbs round the edge, chasing
    return set(i, ' ', 0);
  }
  if (front && z < 0.42) { // the entrance: gold columns, glass doors, the red carpet running up to them
    const mid = Math.abs(along - len / 2);
    if (mid < 1.2 && z < 0.32) { BG[i] = Math.abs(fract(along * 4) - 0.5) < 0.06 ? C(YEL, 9 + glow * 3) : C(YEL, 3 + glow * 3 + (z > .25 ? .8 : 0)); return set(i, ' ', 0); } // the glass doors in gold frames, lit gold inside
    if (z > 0.32) { BG[i] = C(YEL, Math.max(6, L * .6) + (z > .38 ? 1 : 0)); return set(i, ' ', 0); } // the gilded canopy
    if (Math.abs(fract(along) - 0.5) < 0.08) { BG[i] = C(YEL, 4 + glow * 3 + (fract(along) < .5 ? 1.2 : -.5)); return set(i, ' ', 0); } // a gold column, round: lit down one side
    BG[i] = C(fract(along * 6) < 0.1 ? MAG : GRAY, fract(along * 6) < 0.1 ? Math.max(L * .3, glow * 5) : 0.6); return set(i, ' ', 0); // dark glass, neon tubes down it
  }
  if (front && z > 0.5 && z < 1.05) { // CASINO, in big block letters, each one lit in a different colour, the colours chasing
    const word = 'CASINO', q = (u - sgn * (a0 + len / 2)) / (len * 0.9 / word.length) + word.length / 2, k = Math.floor(q), gy = Math.floor((1.05 - z) / 0.55 * 5);
    if (k >= 0 && k < word.length && gy >= 0 && gy < 5) {
      const on = glyphOn(word[k], Math.floor(fract(q) * 4), gy), col = NEON[(k + chase) & 3];
      BG[i] = on ? C(col, 12 + glow * 3) : C(GRAY, 0.5); // the letters, solid light
      return set(i, ' ', 0);
    }
  }
  // the rest: black glass with gold mullions, lit from inside at night
  if (Math.abs(fract(along * 2) - 0.5) < 0.04 || Math.abs(fract(z * 5) - 0.5) < 0.04) { BG[i] = C(YEL, Math.max(2.4 + L * .3, glow * 6)); return set(i, ' ', 0); } // gold mullions and transoms
  BG[i] = hash(Math.floor(along * 6), Math.floor(z * 10), 1401) > 0.9 ? C(YEL, 6 + glow * 5) : C(MAG, 0.6 + glow * 1.5 + (fract(z * 5) > .7 ? .4 : 0)); // black glass, a chandelier's glint here and there
  return set(i, ' ', 0);
}

// ---- inside
const CASINO_W = 22, CASINO_H = 16;
// a thin line's coverage of a cell: dist from its middle, w its width, fp the cell's footprint (metres)
const casinoLine = (dist, w, fp) => clamp((w / 2 - dist) / Math.max(fp, .002) + .5, 0, 1) * Math.min(1, w / Math.max(fp, w));
function casinoWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), fp = Math.max(uStep, d / projY), gold = C(YEL, 4 + L * .3);
  set(i, ' ', 0);
  if (casinoLine(Math.abs(fract(u / 2.5) - 0.5) * 2.5, .3, fp) > .5) { BG[i] = gold; return true; } // gold pilasters
  if (z < 0.9) { BG[i] = coveGroove(z, .3, .03, fp) > .5 ? C(YEL, 2.4 + L * .15) : C(BRICK, 1 + L * 0.1); return true; } // the dado, gold beads in it
  if (Math.abs(z - 0.95) < 0.05 || Math.abs(z - 3.1) < 0.05) { BG[i] = gold; return true; } // the rails
  if (z > 1.2 && z < 2.9) { // mirrors, the chandeliers' lights twinkling in them (up close)
    const cu = Math.floor(u * 5), cz = Math.floor(z * 5), tw = hash(cu, cz, 1402) > 0.94 ? casinoLine(Math.hypot(u * 5 - cu - .5, z * 5 - cz - .5) / 5, .05, fp) : 0;
    BG[i] = tw > .5 ? C(YEL, 10) : C(GRAY, 1 + L * 0.06 + tw * 2); return true;
  }
  BG[i] = C(RED, 1 + L * 0.1); return true;
}
function casinoFloor(i, f, wx, wy, fp = 0) { // the carpet: red, a gold diamond pattern, busy enough to keep you awake; it settles far off
  const a = fract((wx + wy) * 0.8), b = fract((wx - wy) * 0.8), k = .8 * Math.SQRT2; // (the lattice's lines run diagonally, 1/k apart)
  const edge = Math.max(casinoLine(Math.min(a, 1 - a) / k, .1, fp), casinoLine(Math.min(b, 1 - b) / k, .1, fp));
  const dot = Math.abs(a - 0.5) < 0.12 && Math.abs(b - 0.5) < 0.12 && fp < .25;
  set(i, ' ', 0);
  // (lines narrower than a cell would only break into dashes: past that they warm the red instead)
  BG[i] = fp < .07 && (edge > .5 || dot) ? C(YEL, 2 + f * 3) : C(RED, 1 + f * 1.4 + edge * (fp < .07 ? .6 : 1.4));
}
ROOM_FLOORS.casinoCarpet = (i, f, wx, wy, r) => casinoFloor(i, f, wx, wy, homeBalconyPavingFootprint(eye * projY / Math.max(.5, r - hor + .5), eye));
function casinoCeil(i, wx, wy) { // chandeliers: bright drops round a gilt rose, on a dark ceiling
  const d = Math.hypot(fract(wx / 4) - 0.5, fract(wy / 4) - 0.5) * 4;
  set(i, ' ', 0);
  if (!ceilLit()) { BG[i] = d < 0.15 ? C(GRAY, 1.3) : d < 0.32 ? C(YEL, 1.4) : C(GRAY, 0.9); return; } // (switched off: dull glass, a dull rose, no pool of light)
  BG[i] = d < 0.15 ? C(WHITE, 13) : d < 0.32 ? C(YEL, 6) : d < 0.7 ? C(YEL, 1.6) : C(GRAY, 0.9);
}
// cards lying on a blackjack table (u along it, v across: + toward the players): [u, v, pip, colour]
const BJ_CARDS = [];
for (const [u, v] of [[-0.85, 0.36], [0, 0.4], [0.85, 0.36], [-0.1, -0.3]]) for (const k of [0, 1]) BJ_CARDS.push([u + k * 0.09, v - k * 0.02, '♠♥♦♣'[(BJ_CARDS.length * 7) & 3], (BJ_CARDS.length * 7) & 3 && ((BJ_CARDS.length * 7) & 3) < 3 ? RED : GRAY]);
// (the tables, the slots and the cage are built: leisure-fittings.js)
ROOM_DEFS.casino = { grid: boxRoom(CASINO_W, CASINO_H), light: 0.7, height: 3.6, floor: 'casinoCarpet', footstepFloor: 'casino', ceil: 'chandelier', sign: true, signAt: CASINO_W / 2, wall: casinoWall, keeper: [11, 1.5],
  props: r => {
    const p = [...counterBox(11, 2.2, 2.4, 1.1), standing(11, 1.5, GREEN)];
    p.push(CASHIER_CAGE_BARS([8.4, 9.6, 10.8, 12, 13.2], 2.5, 1.1, 2.4)); // the cage's bars
    for (const [x, y] of [[5, 6.5], [17, 6.5]]) { // blackjack: cards out on the felt, the dealer behind
      p.push({ casino: 'blackjack', cx: x, cy: y + 0.9, ...BLACKJACK_TABLE(x, y) }); // cards out on the felt, chips by the seats
      p.push({ ...standing(x, y - 0.9, WHITE), face: [0, 1] }); // the dealer, and the players across the felt from her
      for (const ox of [-0.8, 0.8]) if (chance(0.6)) p.push({ ...standing(x + ox, y + 0.95, shirt()), face: [0, -1] });
    }
    p.push({ casino: 'roulette', cx: 11, cy: 10.4, ...ROULETTE_TABLE(11, 9.3) }); // the wheel at one end, spinning, the layout of numbers
    p.push({ ...standing(11, 8.3, WHITE), face: [0, 1] });
    for (const ox of [-1.2, 0, 1.2]) if (chance(0.5)) p.push({ ...standing(11 + ox, 10.35, shirt()), face: [0, -1] });
    for (const x of [1.3, CASINO_W - 1.3]) for (let y = 4.5; y < CASINO_H - 2; y += 1.6) { // slot machines down both walls, lights going
      const ph = x * 3 + y;
      p.push({ casino: 'slots', cx: x + (x < 5 ? 0.9 : -0.9), cy: y, ...SLOT_MACHINE(x, y, x < 5 ? 1 : -1, 0, ph) });
      p.push({ ...STOOL(x + (x < 5 ? 0.7 : -0.7), y, RED, 0.45), walk: true, fx: x < 5 ? -1 : 1, fy: 0 }); // (its stool: walk past, or sit and you're at it)
      if (chance(0.3)) p.push({ ...sitting(x + (x < 5 ? 0.7 : -0.7), y, shirt(), 0.45), face: [x < 5 ? -1 : 1, 0] }); // (at the machine)
    }
    return p;
  } };
ROOM_FOR.CASINO = 'casino';
const CASINO_NAMES = { blackjack: 'blackjack', roulette: 'roulette', slots: 'the slots' };
const casinoSpot = () => { // the table or machine you're at, if any
  if (mode !== 'room' || room.kind !== 'casino' || room.burgled) return null; // (no dealing to burglars)
  let best = null, bd = 1.4;
  for (const s of room.props) if (s.casino) { const d = Math.hypot(px - s.cx, py - s.cy); if (d < bd) { bd = d; best = s.casino; } }
  return best;
};
