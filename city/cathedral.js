// ===== the cathedral (world.js and landmarks.js build its nave, towers and open belfries). Through the great
// doors between the towers: a nave 38m long under a 16m vault, two rows of pillars down it, pews, tall stained-glass
// windows down both sides throwing coloured light on the floor when the sun's up, a rose window over the altar,
// organ pipes over the doors, candles to light, and the stairs up one of the towers to the bell.
const CATH_H = 16, CATH_W = 22, CATH_D = 40; // vault height, width, length (m)
const CATH_GRID = Array.from({ length: CATH_D }, (_, y) => Array.from({ length: CATH_W }, (_, x) => {
  if (y === CATH_D - 1 && (x === 10 || x === 11)) return 'D';
  if (x === 0 || y === 0 || x === CATH_W - 1 || y === CATH_D - 1) return '#';
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
    roofLot = roofCells(Math.floor(px),Math.floor(py));
    notePoliceRoofEntry(px, py, room.ret);
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
// A thin line's coverage of a cell: dist from its middle, w its width, fp the cell's footprint, all in metres.
const cathLine = (dist, w, fp) => clamp((w / 2 - dist) / Math.max(fp, .002) + .5, 0, 1) * Math.min(1, w / Math.max(fp, w));
// stained glass: leaded panes in jewel colours, a round medallion up the middle; it glows with the daylight. The
// leading thins out with distance rather than breaking up.
function glassCell(i, du, z, seed, cz, hw, fp = 0) {
  const lit = 4 + day * 10 + dusk * 3, rr = Math.hypot(du, (z - cz) * 0.9);
  set(i, ' ', 0);
  if (rr < hw * 0.75) { // the medallion: rings, a gold halo in the middle
    if (cathLine(Math.abs(rr - hw * 0.72), .1, fp) > .5) { BG[i] = C(GRAY, 1); return; }
    const ring = Math.floor(rr / (hw * 0.18)), sec = Math.floor((Math.atan2(du, z - cz) + Math.PI) / (Math.PI / 4));
    BG[i] = C(ring === 0 ? YEL : GLASS[(ring * 3 + sec + seed) & 7], lit * (ring === 0 ? 1.1 : 0.8));
    return;
  }
  const lead = Math.max(coveGroove(du + 0.14, 0.28, 0.028, fp), coveGroove(z, 0.4, 0.032, fp));
  if (lead > .5) { BG[i] = C(GRAY, 1); return; } // the leading
  const k = hash(Math.floor(du / 0.28 + 0.5) + seed * 7, Math.floor(z / 0.4), 501);
  BG[i] = C(GLASS[k * 8 | 0], lit * (0.6 + 0.4 * k) * (1 - lead * .8));
}
const stone = (i, u, z, L, uStep = 0, d = 0) => { // coursed stone blocks, their joints filtered with distance
  BG[i] = C(GRAY, 1.4 + L * 0.13 - 1.1 * coursedJoint(u, z, .5, 1, uStep, d));
  return set(i, ' ', 0);
};
const cathMoulding = (i, L) => { BG[i] = C(GRAY, 1.9 + L * .16); return set(i, ' ', 0), true; }; // a window or door's stone frame
function cathedralWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), fp = Math.max(uStep, d / projY);
  set(i, ' ', 0);
  if (my === CATH_D - 1) { // the west end: the great doors, the organ gallery over them
    const dx = u - 11;
    const door = lancet(dx, z, 0, 5, 1.2);
    if (door === 1) { // oak boards, the meeting stiles darker
      const meet = cathLine(Math.abs(dx), .08, fp);
      BG[i] = C(BRICK, 2 + L * 0.2 - 1.2 * coveGroove(dx, .25, .015, fp) - 1.5 * meet);
      return true;
    }
    if (door === 2) return cathMoulding(i, L);
    if (Math.abs(z - 5.8) < 0.15 && Math.abs(dx) < 7) { BG[i] = C(BRICK, 1.8 + L * .2); return true; } // the gallery rail
    if (z > 6 && Math.abs(dx) < 6.5) { // organ pipes, tallest in the middle and at the towers either side
      const p = Math.floor(dx / 0.3), top = 13 - Math.abs(p) * 0.18 + (Math.abs(p) % 7 === 0 ? 1.2 : 0) + 0.5 * Math.cos(p * 0.9);
      if (z > top) return stone(i, u, z, L, uStep, d), true;
      const fpp = fract(dx / 0.3), gap = cathLine(Math.min(fpp, 1 - fpp) * .3, .09, fp) > .5;
      if (gap) { BG[i] = C(GRAY, 1); return true; }
      const round = 1 - Math.abs(fpp - .45) * 1.6, mouth = z < 6.6 && z > 6.35;
      BG[i] = C(Math.abs(p) % 7 === 0 ? YEL : GRAY, (2 + L * 0.25) * (.75 + .35 * round) * (mouth ? .55 : 1));
      return true;
    }
    if (Math.abs(u - CATH_TOWER[0]) < 0.6 && z < 2.4) { // the tower stair's little door in its frame
      if (z > 2.25 || Math.abs(u - CATH_TOWER[0]) > 0.5) return cathMoulding(i, L);
      BG[i] = C(BRICK, 1.5 + L * .1 - coveGroove(u, .2, .015, fp)); return true;
    }
    if (Math.abs(u - CATH_TOWER[0]) < 1 && Math.abs(z - 2.75) < 0.2 && wallText(i, su, uStep, z, d, 'TOWER', CATH_TOWER[0] * Math.sign(su), 2.75, 0.18, 0.25, C(WHITE, 13))) return true;
    return stone(i, u, z, L, uStep, d), true;
  }
  if (my === 0) { // the east end: the rose window, three lancets, a gilded reredos behind the altar
    const dx = u - 11, rz = z - 11, rr = Math.hypot(dx, rz);
    if (rr < 3.6) {
      if (rr > 3.3) return cathMoulding(i, L);
      const ang = Math.atan2(dx, rz), sec = Math.floor((ang + Math.PI) / (Math.PI / 6)), lit = 4 + day * 10 + dusk * 3;
      const rings = [0.7, 1.6, 2.5, 3.3], ring = rings.findIndex(q => rr < q), spoke = Math.abs(fract((ang + Math.PI) / (Math.PI / 6)) - 0.5);
      const tracery = Math.max(...rings.map(q => cathLine(Math.abs(rr - q), .14, fp)), rr > .7 ? cathLine((.5 - spoke) * rr * Math.PI / 6, .1, fp) : 0);
      if (tracery > .5) { BG[i] = C(GRAY, 1.2); return true; }
      const petal = ring === 2 ? Math.hypot(fract((ang + Math.PI) / (Math.PI / 6)) - 0.5, (rr - 2.05) / 0.9) < 0.42 : true;
      BG[i] = C(ring === 0 ? YEL : petal ? GLASS[(sec + ring * 2) & 7] : BLUE, lit * (ring === 0 ? 1.2 : 0.85) * (1 - tracery * .7));
      return true;
    }
    for (const [cx, hw] of [[8.3, 0.7], [11, 0.9], [13.7, 0.7]]) {
      const w = lancet(u - cx, z, 3, cx === 11 ? 7.2 : 6.6, hw);
      if (w === 1) return glassCell(i, u - cx, z, cx | 0, cx === 11 ? 5.6 : 5.2, hw, fp), true;
      if (w === 2) return cathMoulding(i, L);
    }
    if (Math.abs(dx) < 3.2 && z > 0.9 && z < 2.6) { // the reredos: gilt niches, each with a carved saint
      const nf = fract((dx + 3.2) / 0.8), post = cathLine(Math.min(nf, 1 - nf) * .8, .08, fp) > .5;
      const niche = !post && nf > .2 && nf < .8 && z < 2.4, saint = nf > .38 && nf < .62 && z > 1.2 && z < 2.2;
      BG[i] = C(YEL, (2 + L * 0.22) * (post || z > 2.4 ? 1.15 : niche ? (saint ? .95 : .6) : 1));
      return true;
    }
    return stone(i, u, z, L, uStep, d), true;
  }
  // the long walls: a tall window in every bay, the stations of the cross small and framed below them
  for (const [k, by] of CATH_BAYS.entries()) {
    const w = lancet(u - by, z, 3.5, 11.5, 1.05);
    if (w === 1) return glassCell(i, u - by, z, k * 3 + (mx ? 1 : 0), 8.6, 1.05, fp), true;
    if (w === 2) return cathMoulding(i, L);
    if (Math.abs(u - by) < 0.35 && z > 1.6 && z < 2.3) { // a station of the cross: a small carved panel, a gilt cross on it
      const du = u - by, frame = Math.abs(du) > 0.3 || z < 1.65 || z > 2.25, cross = Math.abs(du) < .045 && z > 1.72 && z < 2.2 || Math.abs(z - 2.05) < .04 && Math.abs(du) < .14;
      BG[i] = frame ? C(GRAY, 1.9 + L * .15) : cross ? C(YEL, 2.4 + L * .3) : C(BRICK, 1.5 + L * .1);
      return true;
    }
  }
  if (z < 1.1) { BG[i] = z > 1.02 ? C(BRICK, 1.8 + L * .14) : C(BRICK, 1.1 + L * 0.1 - .8 * coveGroove(u, .6, .02, fp)); return true; } // oak panelling under its rail
  return stone(i, u, z, L, uStep, d), true;
}
// overhead: a ribbed vault, bay by bay, the nave's webs painted deep blue with gold stars; ribs and stars filter
// with distance, as the vault is always far off
function cathedralCeil(i, wx, wy, fp = .2) {
  const bay = (wy - 7) / 4, ly = fract(bay), nave = wx > 6 && wx < 16, x0 = nave ? 6 : wx < 6 ? 0 : 16, x1 = nave ? 16 : wx < 6 ? 6 : CATH_W;
  const wd = x1 - x0, lx = (wx - x0) / wd, X = lx * wd, Y = ly * 4, diag = Math.hypot(4, wd);
  // (the ribs are drawn a little wider than they are and kept to a cell's width: the vault is always far off and seen
  // at a slant, and filtered to their true width they'd vanish into the webs)
  const rf = Math.min(fp, .35), rib = Math.max(cathLine(Math.min(Y, 4 - Y), .45, rf), cathLine(Math.abs(4 * X - wd * Y) / diag, .35, rf), cathLine(Math.abs(4 * (wd - X) - wd * Y) / diag, .35, rf),
    nave ? cathLine(Math.abs(wx - 11), .3, rf) : 0, cathLine(Math.min(X, wd - X), .4, rf));
  set(i, ' ', 0);
  if (Math.hypot(X - wd / 2, Y - 2) < .4) { BG[i] = C(YEL, 6); return; } // a gilt boss where they cross
  if (rib > .4) { BG[i] = C(GRAY, 2.4); return; }
  if (nave) {
    const cx = Math.floor(wx), cy = Math.floor(wy), star = hash(cx, cy, 503) > 0.55 ? cathLine(Math.hypot(wx - cx - .2 - .6 * hash(cx, cy, 505), wy - cy - .2 - .6 * hash(cx, cy, 506)), .22, fp) : 0;
    BG[i] = star > .5 ? C(YEL, 6) : C(BLUE, 1.5 + rib); return;
  }
  BG[i] = C(GRAY, 1.1 + rib * .8);
}
// underfoot: worn flagstones, a red runner with a gold border up the middle aisle, and pools of coloured light under
// the windows
function cathedralFloor(i, f, wx, wy, fp = 0) {
  set(i, ' ', 0);
  if (Math.abs(wx - 11) < 0.65 && wy > 6.5) { BG[i] = Math.abs(wx - 11) > 0.55 ? C(YEL, 1.5 + f * 3) : C(RED, 1.5 + f * 2); return; }
  if (day > 0.2) for (const [k, by] of CATH_BAYS.entries()) for (const side of [0, 1]) { // the sun through the glass
    const off = side ? CATH_W - wx : wx, shift = (tod - 12) * 0.25 * (side ? -1 : 1);
    if (off > 2.2 && off < 5.8 && Math.abs(wy - by - shift) < 0.9) { // (thrown well out across the floor: the sun's coming in high)
      const kk = hash(Math.floor((wy - by - shift) / 0.28), Math.floor(off / 0.5) + k * 3, 504);
      BG[i] = C(GLASS[kk * 8 | 0], 1 + day * 3 * f * (1 - Math.abs(off - 4) / 2.5));
      return;
    }
  }
  const joint = Math.max(coveGroove(wx, 1.2, .04, fp), coveGroove(wy + (Math.floor(wx / 1.2) & 1) * .6, 1.2, .04, fp));
  const fine = clamp(1 - fp / .6, 0, 1); // (the stones' alternating tones settle to one far off, so they don't stripe)
  BG[i] = C(GRAY, 1.4 + ((Math.floor(wx / 1.2) + Math.floor(wy / 1.2)) & 1 ? -.2 : .2) * fine + f * .6 - joint);
}
ROOM_FLOORS.cathedralFlags = (i, f, wx, wy, r) => cathedralFloor(i, f, wx, wy, homeBalconyPavingFootprint(eye * projY / Math.max(.5, r - hor + .5), eye));
ROOM_CEILS.cathedralVault = (i, r, x, wx, wy) => cathedralCeil(i, wx, wy, homeBalconyPavingFootprint((CATH_H - eye) * projY / Math.max(.5, hor - r - .5), CATH_H - eye));
// The arcade's pillars: a round core with four shafts running up into the vault, on a stepped base, under a gilt
// capital at 7 m. Rounded surfaces lit by their normals.
const CATH_PILLARS = [6, 15].flatMap(x => [7, 11, 15, 19, 23, 27, 31].map(y => [x + .5, y + .5]));
function cathColumnRay(ox, oy, oz, rx, ry, rz, b) { // an upright cylinder from z0 to z1, its flat top
  const x = ox - b.x, y = oy - b.y, A = rx * rx + ry * ry, B = x * rx + y * ry, D = B * B - A * (x * x + y * y - b.r * b.r);
  if (A > 1e-12 && D >= 0) {
    const t = (-B - Math.sqrt(D)) / A, z = oz + rz * t;
    if (t > .01 && z >= b.z0 && z <= b.z1) { const hx = x + rx * t, hy = y + ry * t; HIT.face = 0; HIT.nx = hx / b.r; HIT.ny = hy / b.r; HIT.nz = 0; HIT.w = z; return t; }
  }
  if (Math.abs(rz) > 1e-9) { const t = (b.z1 - oz) / rz; if (t > .01) { const hx = x + rx * t, hy = y + ry * t; if (hx * hx + hy * hy <= b.r * b.r) { HIT.face = 5; HIT.nx = HIT.ny = 0; HIT.nz = 1; HIT.w = b.z1; return t; } } }
  return -1;
}
// a cluster of upright cylinders sharing z0..z1 (a core and its shafts): the nearest hit of any of them
function cathClusterRay(ox, oy, oz, rx, ry, rz, b) {
  let best = -1, nx = 0, ny = 0, nz = 0, face = 0;
  for (const c of b.cols) {
    const t = cathColumnRay(ox, oy, oz, rx, ry, rz, { x: b.x + c[0], y: b.y + c[1], r: c[2], z0: b.z0, z1: b.z1 });
    if (t > 0 && (best < 0 || t < best)) { best = t; nx = HIT.nx; ny = HIT.ny; nz = HIT.nz; face = HIT.face; }
  }
  if (best > 0) { HIT.nx = nx; HIT.ny = ny; HIT.nz = nz; HIT.face = face; }
  return best;
}
const cathColumnShade = (base, k = 1) => (i, t, L) => { BG[i] = C(base, (1.2 + L * .26) * k * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; };
function CATH_PILLAR(x, y) {
  const parts = [], col = (dx, dy, r, z0, z1, shade) => parts.push({ b: { x: dx, y: dy, r, z0, z1 }, shade });
  const stone_ = cathColumnShade(GRAY), gilt = cathColumnShade(YEL, 1.2);
  col(0, 0, .5, 0, .3, stone_); col(0, 0, .44, .3, .6, stone_); // the stepped base
  col(0, 0, .34, .6, CATH_H, stone_); // the core
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) col(sx * .25, sy * .25, .11, .6, CATH_H, stone_); // shafts
  col(0, 0, .43, 7, 7.55, gilt); col(0, 0, .48, 7.55, 7.7, stone_); // the capital, its abacus
  // (the core and its shafts are traced together, so the tall cluster scans its strip of the screen once)
  const cluster = parts.filter(p => p.b.z1 === CATH_H), rest = parts.filter(p => p.b.z1 !== CATH_H), reach = .36 + .11;
  const o = ROOM_MODEL(x, y, (vx, vy) => {
    drawBox({ x: vx, y: vy, c: 1, s: 0, hl: reach, hw: reach, z0: .6, z1: CATH_H, cols: cluster.map(p => [p.b.x, p.b.y, p.b.r]) }, stone_, cathClusterRay);
    for (const p of rest) drawBox({ x: vx + p.b.x, y: vy + p.b.y, c: 1, s: 0, hl: p.b.r, hw: p.b.r, z0: p.b.z0, z1: p.b.z1, r: p.b.r }, p.shade, cathColumnRay);
  }, [.5, .5, CATH_H]);
  return { ...o, radius: .6, cathPillar: { parts } };
}
ROOM_DEFS.cathedral = { grid: CATH_GRID, light: 0.8, height: CATH_H, floor: 'cathedralFlags', footstepFloor: 'cathedral', ceil: 'cathedralVault', wall: cathedralWall, keeper: [11, 4.9],
  props: r => {
    const sanctuary=.3,altar=ALTAR(11, 3.1, 1.46, .46, 1, sanctuary);
    const p = [ // (built: cathedral-fittings.js)
      SANCTUARY_STEPS(11, 4, 5, 2.2, sanctuary), // the sanctuary steps
      altar, ALTAR_CROSS(11, 2.85, altar.altar.h), // the altar under its cloth, the cross on it
      CANDLESTICK(9.2, 3.2, 1.5, sanctuary), CANDLESTICK(12.8, 3.2, 1.5, sanctuary), // candlesticks either side
      ALTAR_RAIL(8.65, 6.4, 1.65), ALTAR_RAIL(13.35, 6.4, 1.65), // the altar rail, the way through between
      PULPIT(7.8, 7.4, 1, 1), // the pulpit
      {...standing(11, 4.9, WHITE), z:sanctuary}, // the priest, standing on the sanctuary
      FONT(11, 36), // the font
      VOTIVE_STAND(19, 34, 0.8, () => room.candles), // the votive stand: as many lit as there are
      ...CATH_PILLARS.map(([x, y]) => CATH_PILLAR(x, y)), // the arcade
    ];
    for (let y = 11; y <= 30; y += 2.1) for (const cx of [8.8, 13.2]) { // the pews, either side of the aisle
      p.push({ ...PEW(cx, y, 1.6), seatRow: { x0: cx - 1.4, x1: cx + 1.4, y, fx: 0, fy: -1 } });
      if (chance(0.3)) p.push(sitting(cx - 1.2 + Math.random() * 2.4, y + 0.02, pick([GRAY, BLUE, BRICK, WHITE, GREEN]), 0.45, true));
    }
    for (const y of [13, 21, 29]) p.push(CHANDELIER_RING(11, y, 6.4, CATH_H)); // chandeliers on long chains, right up to the vault
    for (const [x, y] of [[3, 20], [18.5, 14], [4, 33], [17, 26]]) if (chance(0.5)) p.push(standing(x, y, pick([GRAY, BLUE, BRICK, GREEN]))); // a few sightseers in the aisles
    return p;
  } };
