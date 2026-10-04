// ===== the cathedral (a landmark: world.js builds it, its spires are props), now with a way in. Through the great
// doors between the towers: a nave 38m long under a 16m vault, two rows of pillars down it, pews, tall stained-glass
// windows down both sides throwing coloured light on the floor when the sun's up, a rose window over the altar,
// organ pipes over the doors, candles to light, and the stairs up one of the towers to the bell.
const CATH_H = 16, CATH_W = 22, CATH_D = 40; // vault height, width, length (m)
const CATH_GRID = Array.from({ length: CATH_D }, (_, y) => Array.from({ length: CATH_W }, (_, x) => {
  if (y === CATH_D - 1 && (x === 10 || x === 11)) return 'D';
  if (x === 0 || y === 0 || x === CATH_W - 1 || y === CATH_D - 1) return '#';
  if ((x === 6 || x === 15) && y >= 7 && y <= 31 && (y - 7) % 4 === 0) return 'P'; // the arcade's pillars
  return '.';
}).join(''));
const CATH_BAYS = [9, 13, 17, 21, 25, 29]; // window bays down each side, between the pillars
const CATH_TOWER = [2.2, 37.6]; // the tower stair door, in the corner by the entrance
const GLASS = [RED, BLUE, YEL, GREEN, MAG, CYAN, BLUE, RED];
const cathOpen = () => tod >= 7 && tod < 22;
// the great doors, from outside: a cathedral block, standing in the forecourt between the towers
function churchDoor() {
  if (mode !== 'walk') return null;
  const bx = Math.floor(px / 8), by = Math.floor(py / 8);
  if (landmarkOf.get(bi(bx, by)) !== 'cathedral') return null;
  const lx = mod(px, 8), ly = mod(py, 8);
  return Math.abs(lx - 5) < 0.4 && ly > 3.4 && ly < 4 ? { bx: mod(bx, NB), by: mod(by, NB) } : null;
}
function enterCathedral(cd) {
  if (!cathOpen()) return say('The great doors are locked for the night. Open again at 7.', 3);
  enterRoom('cathedral', { word: 'CATHEDRAL', neon: YEL, ret: [px, py, a], tower: [cd.bx * 8 + 3.5, cd.by * 8 + 3.5], candles: 3 + (Math.random() * 6 | 0),
    line: pick(['Peace be with you.', 'All are welcome here.', 'Mind the step by the font.', 'Evensong is at six, if you\'d like to stay.']) }, [11, CATH_D - 1.6, -Math.PI / 2]);
  say(pick(['The doors close behind you and the city goes quiet.', 'Cool air, old stone, a hush. Your footsteps echo.']), 3);
}
// inside: what's in reach
const nearCandles = () => room.kind === 'cathedral' && Math.hypot(px - 19, py - 34.6) < 1.3;
const nearTowerStair = () => room.kind === 'cathedral' && Math.hypot(px - CATH_TOWER[0], py - CATH_TOWER[1]) < 1.3;
function cathedralPrompt() {
  if (nearCandles()) return `E: light a candle (${fmt$(1)})`;
  if (nearTowerStair()) return 'E: climb the bell tower';
  return '';
}
function useCathedral() { // true if E did something
  if (nearCandles()) {
    if (!pay(1)) return say('A coin in the box for a candle. You have nothing.'), true;
    room.candles = Math.min(24, room.candles + 1);
    say(pick(['You light a candle and watch it catch.', 'A small flame, for someone.', 'You light a candle. It flickers, then holds.']), 3);
    if (actx) [262, 330, 392, 523].forEach((f, k) => tone(actx.currentTime + k * 0.25, f, 1.6, 0.025)); // somewhere, the organ
    return true;
  }
  if (nearTowerStair()) { // up the tower: stand on its top, by the bell, 80m over the square
    mode = 'roof'; roofH = map[idx(Math.floor(room.tower[0]), Math.floor(room.tower[1]))]; px = room.tower[0]; py = room.tower[1]; a = -Math.PI / 2; pitch = -0.1;
    say('Three hundred and twelve steps. The bell hangs over you and the whole city spreads out below.', 5);
    return true;
  }
  return false;
}

// ---- the walls
// a lancet window: pointed top. du = across from its middle, z0..z1 its height, hw half width. Returns 0 outside it,
// 1 in the glass, 2 on its stone frame
function lancet(du, z, z0, z1, hw) {
  const ad = Math.abs(du), zs = z1 - hw * 1.6; // where the arch springs from its straight sides
  if (ad > hw + 0.12 || z < z0 - 0.15) return 0;
  const top = z1 - (z1 - zs) * Math.min(1, ad / hw) ** 0.7; // two curves meeting in a point
  if (z > top + 0.15) return 0;
  return z < z0 || z > top || ad > hw ? 2 : 1;
}
// stained glass: leaded panes in jewel colours, a round medallion up the middle; it glows with the daylight
function glassCell(i, du, z, seed, cz, hw) {
  const lit = 4 + day * 10 + dusk * 3, rr = Math.hypot(du, (z - cz) * 0.9);
  if (rr < hw * 0.75) { // the medallion: rings, a gold halo in the middle
    if (Math.abs(rr - hw * 0.72) < 0.05) { BG[i] = C(GRAY, 1); return set(i, 'o', C(GRAY, 6)); }
    const ring = Math.floor(rr / (hw * 0.18)), sec = Math.floor((Math.atan2(du, z - cz) + Math.PI) / (Math.PI / 4));
    BG[i] = C(ring === 0 ? YEL : GLASS[(ring * 3 + sec + seed) & 7], lit * (ring === 0 ? 1.1 : 0.8));
    return set(i, ring === 0 ? '+' : (sec + ring) & 1 ? ' ' : '.', C(WHITE, lit));
  }
  if (fract(du / 0.28 + 0.5) < 0.1 || fract(z / 0.4) < 0.08) { BG[i] = C(GRAY, 1); return set(i, '+', C(GRAY, 5)); } // the leading
  const k = hash(Math.floor(du / 0.28 + 0.5) + seed * 7, Math.floor(z / 0.4), 501);
  BG[i] = C(GLASS[k * 8 | 0], lit * (0.6 + 0.4 * k));
  return set(i, k > 0.85 ? '*' : ' ', C(WHITE, lit));
}
const stone = (i, u, z, L) => { // coursed stone blocks
  BG[i] = C(GRAY, 1 + L * 0.12);
  return set(i, fract(z / 0.5) < 0.08 ? '-' : fract(u + (Math.floor(z / 0.5) & 1) * 0.5) < 0.05 ? '|' : ' ', C(GRAY, L * 0.7));
};
function cathedralWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), c = roomAt(mx, my);
  if (c === 'P') { // a clustered pillar: shafts running up into the vault, a carved capital
    BG[i] = C(GRAY, 1.5 + L * 0.15);
    if (z < 0.6) return set(i, fract(z / 0.2) < 0.2 ? '=' : '#', C(GRAY, L)), true; // the base
    if (z > 7 && z < 7.7) return set(i, z > 7.55 ? '=' : '%', C(z > 7.55 ? GRAY : YEL, L * (z > 7.55 ? 1 : 0.6))), true; // capital, leaves picked out in gilt
    return set(i, fract(u / 0.2) < 0.25 ? '|' : ' ', C(GRAY, L)), true;
  }
  if (my === CATH_D - 1) { // the west end: the great doors, the organ gallery over them
    const dx = u - 11;
    const door = lancet(dx, z, 0, 5, 1.2);
    if (door === 1) { BG[i] = C(BRICK, 2 + L * 0.2); return set(i, Math.abs(dx) < 0.04 ? '|' : hash(Math.floor(dx * 6), Math.floor(z * 6), 502) > 0.92 ? 'o' : fract(dx * 4) < 0.15 ? '|' : ' ', C(Math.abs(dx) < 0.04 ? GRAY : BRICK, L * 1.1)), true; }
    if (door === 2) return set(i, '#', C(GRAY, L)), true;
    if (Math.abs(z - 5.8) < 0.15 && Math.abs(dx) < 7) return set(i, '=', C(BRICK, L * 1.2)), true; // the gallery rail
    if (z > 6 && Math.abs(dx) < 6.5) { // organ pipes, tallest in the middle and at the towers either side
      const p = Math.floor(dx / 0.3), top = 13 - Math.abs(p) * 0.18 + (Math.abs(p) % 7 === 0 ? 1.2 : 0) + 0.5 * Math.cos(p * 0.9);
      if (z > top) return stone(i, u, z, L), true;
      const fp = fract(dx / 0.3);
      if (fp < 0.15 || fp > 0.85) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
      BG[i] = C(Math.abs(p) % 7 === 0 ? YEL : GRAY, 2 + L * 0.25);
      return set(i, z < 6.6 && z > 6.35 ? 'v' : fract(fp * 3) < 0.3 ? '|' : ' ', C(WHITE, L * 1.2)), true;
    }
    if (Math.abs(u - CATH_TOWER[0]) < 0.6 && z < 2.4) { // the tower stair's little door
      BG[i] = C(BRICK, 1.5); return set(i, z > 2.25 || Math.abs(u - CATH_TOWER[0]) > 0.5 ? '#' : fract(u * 5) < 0.2 ? '|' : ' ', C(GRAY, L)), true;
    }
    if (Math.abs(u - CATH_TOWER[0]) < 1 && Math.abs(z - 2.75) < 0.2 && wallText(i, su, uStep, z, d, 'TOWER', CATH_TOWER[0] * Math.sign(su), 2.75, 0.18, 0.25, C(WHITE, 13))) return true;
    return stone(i, u, z, L), true;
  }
  if (my === 0) { // the east end: the rose window, three lancets, a gilded reredos behind the altar
    const dx = u - 11, rz = z - 11, rr = Math.hypot(dx, rz);
    if (rr < 3.6) {
      if (rr > 3.3) { BG[i] = C(GRAY, 2); return set(i, '#', C(GRAY, L)), true; }
      const ang = Math.atan2(dx, rz), sec = Math.floor((ang + Math.PI) / (Math.PI / 6)), lit = 4 + day * 10 + dusk * 3;
      const rings = [0.7, 1.6, 2.5, 3.3], ring = rings.findIndex(q => rr < q);
      if (rings.some(q => Math.abs(rr - q) < 0.07) || Math.abs(fract((ang + Math.PI) / (Math.PI / 6)) - 0.5) > 0.47 && rr > 0.7) { BG[i] = C(GRAY, 1); return set(i, '+', C(GRAY, 6)), true; } // the tracery
      const petal = ring === 2 ? Math.hypot(fract((ang + Math.PI) / (Math.PI / 6)) - 0.5, (rr - 2.05) / 0.9) < 0.42 : true;
      BG[i] = C(ring === 0 ? YEL : petal ? GLASS[(sec + ring * 2) & 7] : BLUE, lit * (ring === 0 ? 1.2 : 0.85));
      return set(i, ring === 0 ? '*' : petal && ring === 2 ? '.' : ' ', C(WHITE, lit)), true;
    }
    for (const [cx, hw] of [[8.3, 0.7], [11, 0.9], [13.7, 0.7]]) {
      const w = lancet(u - cx, z, 3, cx === 11 ? 7.2 : 6.6, hw);
      if (w === 1) return glassCell(i, u - cx, z, cx | 0, cx === 11 ? 5.6 : 5.2, hw), true;
      if (w === 2) { BG[i] = C(GRAY, 1.5); return set(i, '#', C(GRAY, L)), true; }
    }
    if (Math.abs(dx) < 3.2 && z > 0.9 && z < 2.6) { // the reredos: gilt niches
      BG[i] = C(YEL, 2 + L * 0.2);
      const nf = fract((dx + 3.2) / 0.8);
      return set(i, nf < 0.1 ? '|' : z > 2.4 ? '^' : nf > 0.3 && nf < 0.7 && z > 1.2 && z < 2.2 ? (z > 1.9 ? 'o' : '|') : ' ', C(YEL, Math.max(L * 1.3, 9))), true;
    }
    return stone(i, u, z, L), true;
  }
  // the long walls: a tall window in every bay, the stations of the cross small and framed below them
  for (const [k, by] of CATH_BAYS.entries()) {
    const w = lancet(u - by, z, 3.5, 11.5, 1.05);
    if (w === 1) return glassCell(i, u - by, z, k * 3 + (mx ? 1 : 0), 8.6, 1.05), true;
    if (w === 2) { BG[i] = C(GRAY, 1.5); return set(i, '#', C(GRAY, L)), true; }
    if (Math.abs(u - by) < 0.35 && z > 1.6 && z < 2.3) { // a station of the cross: a small carved panel
      BG[i] = C(BRICK, 1.5);
      return set(i, Math.abs(u - by) > 0.3 || z < 1.65 || z > 2.25 ? '#' : Math.abs(u - by) < 0.04 || Math.abs(z - 2.05) < 0.03 ? '+' : ' ', C(YEL, L)), true;
    }
  }
  if (z < 1.1) { BG[i] = C(BRICK, 1 + L * 0.1); return set(i, z > 1.02 ? '=' : fract(u / 0.6) < 0.1 ? '|' : ' ', C(BRICK, L)), true; } // oak panelling
  return stone(i, u, z, L), true;
}
// overhead: a ribbed vault, bay by bay, the nave's webs painted deep blue with gold stars
function cathedralCeil(i, wx, wy) {
  const bay = (wy - 7) / 4, ly = fract(bay), nave = wx > 6 && wx < 16, x0 = nave ? 6 : wx < 6 ? 0 : 16, x1 = nave ? 16 : wx < 6 ? 6 : CATH_W;
  const lx = (wx - x0) / (x1 - x0), e = 0.035;
  if (ly < e * 1.2 || ly > 1 - e * 1.2 || Math.abs(lx - ly) < e || Math.abs(lx + ly - 1) < e || nave && Math.abs(wx - 11) < 0.08 || lx < 0.02 || lx > 0.98) {
    BG[i] = C(GRAY, 2); return set(i, '=', C(GRAY, 8)); // the ribs
  }
  if (Math.abs(lx - 0.5) < 0.04 && Math.abs(ly - 0.5) < 0.04) return set(i, '@', C(YEL, 12)); // a gilt boss where they cross
  if (nave) { BG[i] = C(BLUE, 1.5); return set(i, hash(Math.floor(wx * 3), Math.floor(wy * 3), 503) > 0.9 ? '*' : ' ', C(YEL, 10)); }
  BG[i] = C(GRAY, 1); return set(i, (Math.floor(wx * 2) + Math.floor(wy * 2)) % 5 ? ' ' : '.', C(GRAY, 4));
}
// underfoot: worn flagstones, a red runner up the middle aisle, and pools of coloured light under the windows
function cathedralFloor(i, f, wx, wy) {
  if (Math.abs(wx - 11) < 0.65 && wy > 6.5) { BG[i] = C(RED, 1.5 + f * 2); return set(i, Math.abs(wx - 11) > 0.55 ? '|' : ' ', C(YEL, 4 + f * 6)); }
  if (day > 0.2) for (const [k, by] of CATH_BAYS.entries()) for (const side of [0, 1]) { // the sun through the glass
    const off = side ? CATH_W - wx : wx, shift = (tod - 12) * 0.25 * (side ? -1 : 1);
    if (off > 2.2 && off < 5.8 && Math.abs(wy - by - shift) < 0.9) { // (thrown well out across the floor: the sun's coming in high)
      const kk = hash(Math.floor((wy - by - shift) / 0.28), Math.floor(off / 0.5) + k * 3, 504);
      BG[i] = C(GLASS[kk * 8 | 0], 1 + day * 3 * f * (1 - Math.abs(off - 4) / 2.5));
      return set(i, ' ', 0);
    }
  }
  const edge = fract(wx / 1.2) < 0.04 || fract(wy / 1.2 + (Math.floor(wx / 1.2) & 1) * 0.5) < 0.04;
  BG[i] = C(GRAY, (Math.floor(wx / 1.2) + Math.floor(wy / 1.2)) & 1 ? 1 : 1.6);
  return set(i, edge ? '+' : ' ', C(GRAY, 3 + f * 4));
}

ROOM_DEFS.cathedral = { grid: CATH_GRID, light: 0.8, height: CATH_H, floor: 'cathedral', ceil: 'cathedral', wall: cathedralWall, keeper: [11, 4.9],
  props: r => {
    const gold = solid(YEL, { top: '=', bright: 1.4 }), white = solid(WHITE, { top: '~', trim: 0.92 });
    const flame = (x, y, z) => SP(x, y, 0.05, 0.12, ['*', '|'], (c, row, L) => row ? C(WHITE, 14) : C(fract(T * 7 + x * 3) < 0.5 ? YEL : ORANGE, 15), z);
    const p = [
      { ...BX(11, 4, 5, 2.2, 0, 0.3, solid(GRAY, { top: '.', panel: 1 })), walk: true }, // the sanctuary steps
      BX(11, 3.1, 1.5, 0.5, 0, 1.0, white), // the altar, under its cloth
      BX(11, 2.5, 0.06, 0.06, 1.0, 2.8, gold), BX(11, 2.5, 0.45, 0.06, 2.15, 2.3, gold), // the cross
      BX(9.2, 3.2, 0.05, 0.05, 0, 1.5, gold), BX(12.8, 3.2, 0.05, 0.05, 0, 1.5, gold), flame(9.2, 3.2, 1.5), flame(12.8, 3.2, 1.5),
      BX(8.65, 6.4, 1.65, 0.06, 0, 0.9, solid(BRICK, { panel: 0.3, top: '=' })), BX(13.35, 6.4, 1.65, 0.06, 0, 0.9, solid(BRICK, { panel: 0.3, top: '=' })), // the altar rail
      BX(7.8, 7.4, 0.4, 0.4, 0, 1.3, solid(BRICK, { panel: 0.2, trim: 1.2, top: '=' })), // the pulpit
      standing(11, 4.9, WHITE), // the priest
      BX(11, 36, 0.5, 0.5, 0, 1.0, (i, t, L) => { // the font
        if (HIT.face === 5) { BG[i] = C(CYAN, 2 + noise(HIT.u * 6 + T * 0.3, HIT.v * 6, 505) * 2); return set(i, Math.hypot(HIT.u, HIT.v) > 0.42 ? '#' : '~', C(WHITE, 10)), true; }
        BG[i] = C(GRAY, (1.5 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.w > 0.9 ? '=' : HIT.w < 0.15 ? '#' : (Math.floor(HIT.u * 8) & 1) ? '|' : ' ', C(GRAY, L)), true;
      }),
      BX(19, 34, 0.8, 0.25, 0, 0.9, (i, t, L) => { // the votive stand: rows of little candles, as many lit as there are
        if (HIT.face !== 5) { BG[i] = C(BRICK, (1 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.w > 0.84 ? '=' : ' ', C(YEL, L)), true; }
        const slot = Math.floor((HIT.u + 0.8) / 0.2) + Math.floor((HIT.v + 0.25) / 0.17) * 8;
        BG[i] = C(BRICK, 2);
        return set(i, slot < room.candles ? '*' : 'i', slot < room.candles ? C(fract(T * 6 + slot * 0.37) < 0.5 ? YEL : ORANGE, 15) : C(WHITE, 8)), true;
      }),
    ];
    for (let y = 11; y <= 30; y += 2.1) for (const cx of [8.8, 13.2]) { // the pews, either side of the aisle
      p.push({ ...BX(cx, y, 1.6, 0.22, 0, 0.45, solid(BRICK, { top: '=', bright: 1.3 })), seatRow: { x0: cx - 1.4, x1: cx + 1.4, y, fx: 0, fy: -1 } },
             BX(cx, y + 0.26, 1.6, 0.05, 0.45, 1.0, solid(BRICK, { panel: 0.4, trim: 0.94, bright: 1.3 })));
      if (chance(0.3)) p.push(sitting(cx - 1.2 + Math.random() * 2.4, y + 0.02, pick([GRAY, BLUE, BRICK, WHITE, GREEN]), 0.45, true));
    }
    for (const y of [13, 21, 29]) p.push(SP(11, y, 0.5, 3, pad(['  |', '  |', '  |', '  |', ' _|_', '*-o-*', " \\_/"]), // chandeliers on long chains
      (c, row, L) => c === '*' ? C(fract(T * 5 + y) < 0.5 ? YEL : ORANGE, 15) : row < 4 ? C(GRAY, L * 0.8) : C(YEL, Math.max(L, 9)), 6),
      BX(11, y, 0.025, 0.025, 8.7, CATH_H, (i, t, L) => (set(i, fract(HIT.w * 3) < 0.5 ? '|' : ':', C(GRAY, L * 0.8)), true))); // the chain, right up to the vault
    for (const [x, y] of [[3, 20], [18.5, 14], [4, 33], [17, 26]]) if (chance(0.5)) p.push(standing(x, y, pick([GRAY, BLUE, BRICK, GREEN]))); // a few sightseers in the aisles
    return p;
  } };
