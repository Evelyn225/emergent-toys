// ===== the airport terminal, inside (world.js has the building and its doors; you go in and out by them with E). A
// long hall, the landside along the near wall where the main doors are: check-in desks with their baggage belt behind
// on the left, the café on the right, the restrooms in the corner; the departures board hung over the middle; security
// across the hall, through the arches; then the gates, rows of seats looking out through the glass at the planes
// (whichever are really parked at the gates out there), a door out to the apron between each two gates.
// The hall's x runs the other way to the world's (you face the planes, south, coming in), so gate 1 is on the right.
const TERMINAL_GATE_X = [27, 16, 5], TERMINAL_ROOM_DOOR_X = [16, 23, 9]; // (by gate; by door, as TERMINAL_DOORS)
const TERMINAL_GRID = ['########DD############DD########', ...Array.from({ length: 8 }, () => '#' + '.'.repeat(30) + '#'),
  '#' + '.'.repeat(27) + 'WWW#', '#' + '.'.repeat(27) + 'W..#', '#' + '.'.repeat(30) + '#', '#' + '.'.repeat(27) + 'W..#', '###############DD###############'];

// in by one of the building's doors: the main doors into check-in, the airside ones in by the gates
function enterTerminal(d) {
  enterRoom('terminal', { word: 'GLYPHPORT', neon: BLUE, ret: [px, py, a], line: '' }, d ? [TERMINAL_ROOM_DOOR_X[d], 1.8, Math.PI / 2] : [16, 12.2, -Math.PI / 2]);
}
// and out: by the door you walk into, the main doors or the nearer airside one
function leaveTerminal() {
  const d = py < room.H / 2 ? (px > room.W / 2 ? 1 : 2) : 0, o = TERMINAL_DOORS[d];
  px = mod(TERMINAL.x + o.u, N); py = mod(TERMINAL.y + (o.land ? -1 : 1) * (TERMINAL.hw + 0.22), N); a = o.land ? -Math.PI / 2 : Math.PI / 2;
}

// ---- out of the windows. The gates' side: the airliners parked at them, nose in, a jet bridge out to each; the apron,
// the taxiway, the grass and the runway, the sea beyond. Real distances (metres), though the gates are closer together
// in here than out there, so each plane's a regional jet, stubby enough not to clip its neighbours
const TV_PLANE = gx => [ // { b: box, kind }
  { b: boxAt(gx, -10.5, 0, 1, 7.5, 1.5, 0.9, 3.9), kind: 'body' }, { b: boxAt(gx, -11.5, 1, 0, 5.2, 1.6, 1.7, 2), kind: 'wing' },
  ...[-3.2, 3.2].map(e => ({ b: boxAt(gx + e, -10, 0, 1, 1.2, 0.7, 0.8, 1.9), kind: 'engine' })),
  { b: boxAt(gx, -16.8, 0, 1, 1.4, 0.15, 3.9, 8), kind: 'fin' }, { b: boxAt(gx, -17, 1, 0, 3.2, 0.8, 3.9, 4.15), kind: 'wing' }];
function terminalOutside() {
  const out = [];
  TERMINAL_GATE_X.forEach((gx, k) => {
    out.push({ b: boxAt(gx - 2.4, -1.6, 0, 1, 1.6, 0.9, 2.3, 4.4), kind: 'bridge' }); // the jet bridge, out from the wall
    if (aircraft.some(c => c.type === 'airliner' && c.gate === k && c.state === 'parked')) out.push(...TV_PLANE(gx));
  });
  return out;
}
function terminalView(i, x, z) {
  const rx = x - px, ry = -py, rz = z - eye;
  if (ry >= -0.01) return set(i, ' ', 0);
  const f = terminalView.frame === T ? terminalView : Object.assign(terminalView, { frame: T, out: terminalOutside() });
  const lit = Math.max(night, overcast * 0.6), sun = 2 + day * 7, flood = lit * 6;
  let best = Infinity, hit = null, hf = 0, hu = 0, hv = 0, hw = 0;
  for (const o of f.out) {
    const t = rayBox(px, py, eye, rx, ry, rz, o.b);
    if (t > 1 && t < best) { best = t; hit = o; hf = HIT.face; hu = HIT.u; hv = HIT.v; hw = HIT.w; }
  }
  const tg = rz < 0 ? -eye / rz : Infinity;
  if (hit && best < tg) {
    const k = shadeFace(hf), L = Math.max(sun, flood) * k;
    if (hit.kind === 'bridge') { BG[i] = C(GRAY, 1.2 + L * 0.2); return set(i, Math.abs(hw - 3.4) < 0.3 && fract(hu * 0.8) < 0.5 ? '#' : fract(hu * 2) < 0.06 ? '|' : ' ', C(CYAN, 6 + lit * 6)); }
    if (hit.kind === 'body') { // white, the airline's blue cheat line, a row of windows, the flight deck's windows on the nose
      if (hf === 1 && hw > 2.8 && hw < 3.4 && Math.abs(hv) < 1) { BG[i] = C(GRAY, 0.6); return set(i, Math.abs(hv) < 0.06 ? '|' : ' ', C(GRAY, 4)); }
      if (Math.abs(hw - 2.3) < 0.2) { BG[i] = C(BLUE, 2 + L * 0.2); return set(i, ' ', 0); }
      BG[i] = C(WHITE, 1.4 + L * 0.3);
      return set(i, Math.abs(hw - 2.9) < 0.15 && fract(hu * 1.2) < 0.4 ? '.' : ' ', C(lit > 0.4 ? WARM : GRAY, lit > 0.4 ? 13 : 5));
    }
    if (hit.kind === 'fin') { BG[i] = C(hw > 6 ? BLUE : WHITE, 1.4 + L * 0.3); return set(i, ' ', 0); }
    if (hit.kind === 'engine') { BG[i] = C(GRAY, 1.2 + L * 0.25); return set(i, hf <= 2 ? 'O' : ' ', C(GRAY, 4)); }
    BG[i] = C(WHITE, 1.2 + L * 0.25); return set(i, hf === 6 ? '=' : ' ', C(GRAY, 5)); // a wing, a tailplane
  }
  if (tg < Infinity) { // the ground, out to wherever the ray comes down
    const gx = px + rx * tg, d = -(py + ry * tg); // (metres out from the glass)
    if (d > 130) { // the sea
      BG[i] = C(BLUE, 0.6 + day * 3); return set(i, noise(gx * 0.05 + T * 0.1, d * 0.05, 93) > 0.6 ? '~' : ' ', C(CYAN, 4 + day * 6));
    }
    if (d > 80 && d < 95) { BG[i] = C(GRAY, 0.5 + day * 1.4); return set(i, Math.abs(d - 87.5) < 0.6 && fract(gx / 12) < 0.5 ? '=' : ' ', C(WHITE, 6 + day * 6)); } // the runway
    if (d > 44 && d < 52) { BG[i] = C(GRAY, 0.6 + day * 1.6); return set(i, Math.abs(d - 48) < 0.3 ? '-' : ' ', C(YEL, 6 + day * 5)); } // the taxiway
    if (d > 52) { BG[i] = C(GREEN, 0.5 + day * 2); return set(i, hash(Math.floor(gx), Math.floor(d), 94) > 0.8 ? ',' : ' ', C(GREEN, 4 + day * 5)); } // grass
    const lead = TERMINAL_GATE_X.some(g => Math.abs(gx - g) < 0.12) && d < 30; // the apron: concrete, a yellow line in to each gate
    BG[i] = C(GRAY, 1 + day * 2.6 + flood * 0.35);
    return set(i, lead ? '|' : fract(gx / 7.5) < 0.02 || fract(d / 7.5) < 0.02 ? '+' : ' ', C(lead ? YEL : GRAY, lead ? 9 + day * 5 : 4 + day * 3));
  }
  const el = rz / Math.hypot(rx, ry); // the sky: dusk low down, stars at night
  BG[i] = C(BLUE, 0.4 + day * 6 - el * day * 2);
  return set(i, night > 0.6 && hash(Math.floor(x * 9 + px), Math.floor(z * 9), 95) > 0.985 ? '.' : ' ', C(WHITE, 12));
}
// the landside: the road out front, the bay, the city across it, lit up after dark
function terminalLandView(i, x, z) {
  const H = room.H, rx = x - px, ry = H - 1 - py, rz = z - eye;
  if (ry <= 0.01) return set(i, ' ', 0);
  if (rz < 0) {
    const tg = -eye / rz, d = py + ry * tg - (H - 1), gx = px + rx * tg;
    if (d < 4) { BG[i] = C(STONE, 1 + day * 3); return set(i, fract(gx / 1.5) < 0.05 ? '+' : ' ', C(GRAY, 5)); } // the pavement
    if (d < 20) { BG[i] = C(GRAY, 0.5 + day * 1.6); return set(i, Math.abs(d - 12) < 0.15 && fract(gx / 4) < 0.5 ? '=' : ' ', C(YEL, 5 + day * 5)); } // the road
    BG[i] = C(BLUE, 0.6 + day * 3); return set(i, noise(gx * 0.05, d * 0.05 + T * 0.05, 96) > 0.62 ? '~' : ' ', C(CYAN, 4 + day * 5)); // the bay
  }
  const el = rz / Math.hypot(rx, ry), az = Math.atan2(rx, ry), col = Math.floor(az * 60), sky = 0.015 + 0.06 * hash(col, 3, 97) ** 2;
  if (el < sky) { // the skyline across the water, its windows lit at night
    const on = night > 0.3 && hash(col, Math.floor(el * 400), 98) > 0.7;
    BG[i] = C(GRAY, 0.5 + day * 1.8); return set(i, on ? '.' : ' ', C(WARM, 12));
  }
  BG[i] = C(BLUE, 0.4 + day * 6); return set(i, ' ', 0);
}

// ---- its walls: the planes' side glass from the floor nearly to the ceiling, between steel mullions; the landside
// glass over the desks and the café; adverts on the end walls; the restrooms' sign
function terminalWall(i, u, uStep, z, d, mx, my, L) {
  const H = room.H, c = roomAt(mx, my);
  if (c === 'W') return mx === 28 && my === 12 && wallText(i, u, uStep, z, d, 'RESTROOMS', 12.5, 2.2, 0.12, 0.16, C(WHITE, 14), C(BLUE, 2.5));
  if (my === 0) { // the gates' glass
    if (z > 4.4 || z < 0.3) { BG[i] = C(GRAY, 1.6); return set(i, '=', C(GRAY, L)), true; }
    if (fract(u / 2) < 0.03 || Math.abs(z - 2.7) < 0.04) { BG[i] = C(GRAY, 2); return set(i, fract(u / 2) < 0.03 ? '|' : '-', C(GRAY, 8)), true; }
    return terminalView(i, u, z), true;
  }
  if (my === H - 1) { // the landside: glass above the desks and the café, a wall below
    if (z < 1.6 || z > 4) { BG[i] = C(STONE, 1.4 + L * 0.1); return set(i, z > 4 ? '=' : fract(Math.abs(u) / 1.5) < 0.04 ? '|' : ' ', C(GRAY, L * 0.6)), true; }
    if (fract(Math.abs(u) / 2) < 0.03) { BG[i] = C(GRAY, 2); return set(i, '|', C(GRAY, 8)), true; }
    return terminalLandView(i, Math.abs(u), z), true;
  }
  if ((mx === 0 || mx === room.W - 1) && z > 1.2 && z < 3.6) { // an advert lit up on each end
    const end = mx === 0, word = end ? 'FLY AIR 9' : 'WELCOME', mid = end ? -6.5 : 6.5;
    BG[i] = C(end ? BLUE : MAG, 4);
    return wallText(i, u, uStep, z, d, word, mid, 2.4, 0.38, 0.6, C(WHITE, 15), C(end ? BLUE : MAG, 4)) || (set(i, ' ', 0), true);
  }
  BG[i] = C(STONE, 1.6 + L * 0.1); return set(i, fract(z / 1.25) < 0.03 ? '-' : ' ', C(GRAY, L * 0.6)), true; // stone panels
}
// the floor: polished terrazzo, carpet at the gates, a mat inside each door
ROOM_FLOORS.terrazzo = (i, f, wx, wy, r, x, L) => {
  const mat = TERMINAL_ROOM_DOOR_X.some((dx, k) => Math.abs(wx - dx) < 1.2 && (k ? wy < 2.2 : wy > room.H - 2.2));
  const carpet = wy < 6.6 && TERMINAL_GATE_X.some(g => Math.abs(wx - g) < 3.6);
  if (mat) { BG[i] = C(BRICK, 1 + f * 1.5); return set(i, '=', C(BRICK, L)); }
  if (carpet) { BG[i] = C(BLUE, 1 + f * 1.6); return set(i, (r + x) % 3 ? ' ' : '.', C(BLUE, L)); }
  BG[i] = C(STONE, 1.6 + f * 3);
  return set(i, fract(wx / 1.5) < 0.03 || fract(wy / 1.5) < 0.03 ? '+' : hash(Math.floor(wx * 30), Math.floor(wy * 30), 343) > 0.93 ? '.' : ' ', C(STONE, L * 0.8));
};

// ---- what's in it
// the departures board, both faces: departures toward the doors, arrivals toward the gates
const TBOARD = { hl: 3, z0: 2.7, z1: 4.3, row: 0.26, n: 27, status: 17 };
const departuresBoard = (x, y) => ({ x, y, draw: (vx, vy) => {
  for (const e of [-1, 1]) rod(vx + e * TBOARD.hl * 0.85, vy, TBOARD.z1, vx + e * TBOARD.hl * 0.85, vy, room.def.height, 0.02, GRAY, 0.9);
  const lines = { 3: boardLines(true), 4: boardLines(false) };
  drawBox(boxAt(vx, vy, 1, 0, TBOARD.hl, 0.06, TBOARD.z0, TBOARD.z1), (i, t) => {
    const f = HIT.face, row = Math.floor((TBOARD.z1 - 0.04 - HIT.w) / TBOARD.row);
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, 1.6); return set(i, ' ', 0), true; }
    BG[i] = C(BLACK, 3);
    if (row < 0 || row > 5) return set(i, ' ', 0), true;
    const z0 = TBOARD.z1 - 0.04 - (row + 1) * TBOARD.row, line = row ? lines[f][row - 1] : null;
    if (row && !line) return set(i, ' ', 0), true;
    const ch = faceText(row ? line.text : (f === 3 ? 'DEPARTURES' : 'ARRIVALS').padEnd(TBOARD.n), i, t, vx, vy, TBOARD.hl, z0, TBOARD.row);
    const col = !row ? C(WHITE, 15) : Math.floor(faceQ(HIT.u, TBOARD.hl) * TBOARD.n) >= TBOARD.status ? C(statusCol(line.status), 14) : C(YEL, 14);
    return set(i, ch && ch !== ' ' ? ch : ' ', col), true;
  });
} });
// a walk-through metal detector: two grey posts and a head, a light on top going green (red now and then)
const detector = x => ROOM_MODEL(x, 7.3, (vx, vy) => {
  for (const e of [-0.55, 0.55]) BXD(vx + e, vy, 0.06, 0.3, 0, 2.15, solid(GRAY));
  BXD(vx, vy, 0.62, 0.3, 2.15, 2.4, solid(GRAY, { top: '=' }));
  dot(vx, vy, 2.48, 0.06, (i, t, L) => { const red = fract(T / 7 + x) < 0.08; BG[i] = C(red ? RED : GREEN, 10); return set(i, ' ', 0), true; });
});
const glassScreen = (x0, x1) => BX((x0 + x1) / 2, 7.3, (x1 - x0) / 2, 0.05, 0, 1.1, (i, t, L) => { // the barrier along security: glass panels
  if (HIT.face === 5 || HIT.w > 1.06) { BG[i] = C(GRAY, 3); return set(i, ' ', 0), true; }
  return fract(HIT.u / 1.2) < 0.03 ? (set(i, '|', C(GRAY, 9)), true) : HIT.face <= 2 ? (BG[i] = C(GRAY, 2), set(i, ' ', 0), true) : false; // (see-through)
});
// a row of airport seats along x, facing the windows (-y): steel frame, blue seats, their backs on the +y side
const seatRow = (x, y, hl) => ROOM_MODEL(x, y, (vx, vy) => {
  BXD(vx, vy, hl, 0.25, 0.4, 0.48, (i, t, L) => { BG[i] = C(BLUE, 2 + L * 0.2); return set(i, fract(HIT.u / 0.55 + 0.5) < 0.08 ? '|' : ' ', C(BLUE, 8)), true; });
  BXD(vx, vy + 0.22, hl, 0.04, 0.48, 0.95, (i, t, L) => { BG[i] = C(BLUE, 1.7 + L * 0.2); return set(i, fract(HIT.u / 0.55 + 0.5) < 0.08 ? '|' : ' ', C(BLUE, 7)), true; });
  BXD(vx, vy, hl * 0.9, 0.03, 0, 0.4, (i, t, L) => { BG[i] = C(GRAY, 1.3); return set(i, '|', C(GRAY, 6)), true; });
}, [hl, 0.27, 0.95]);
const suitcase = (x, y, col) => BX(x, y, 0.2, 0.12, 0, 0.62, (i, t, L) => { BG[i] = C(col, (1.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '=' : fract(HIT.w * 6) < 0.1 ? '-' : ' ', C(GRAY, 7)), true; });

ROOM_DEFS.terminal = { grid: TERMINAL_GRID, height: 5, light: 1.15, floor: 'terrazzo', ceil: 'strip', sign: false, wall: terminalWall, keeper: [23.5, 12.2],
  wc: { x0: 29, y0: 10, x1: 31, y1: 13, sign: [28, 10, 10.5] },
  props: r => {
    const desk = solid(BLUE, { panel: 0.5, trim: 1, top: '=' }), counter = solid(BRICK, { panel: 0.6, trim: 1, top: '=' });
    const p = [
      BX(8, 12.72, 6.6, 0.2, 0, 0.45, (i, t, L) => { // the baggage belt behind the desks, running
        if (HIT.face === 5) { BG[i] = C(GRAY, 1.2); return set(i, fract(HIT.u * 2 - T * 0.6) < 0.1 ? '|' : ' ', C(GRAY, 7)), true; }
        BG[i] = C(GRAY, (1.8 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }),
      BX(23.5, 11.3, 2.2, 0.35, 0, 1.05, counter), { ...standing(23.5, 12.2, WHITE), face: [0, -1] }, // the café, and its barista
      BX(22.4, 11.3, 0.3, 0.22, 1.05, 1.55, (i, t, L) => { BG[i] = C(GRAY, (2.2 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 4 && HIT.w > 1.35 ? 'o' : ' ', C(RED, 13)), true; }), // the espresso machine
      ...glassCase(24.8, 11.3, 0.6, 0.3, 1.5, caseGoods('@o%', [WARM, BRICK, YEL], false, 7), BRICK),
      aisleSign(23.5, 11.3, 'CAFE  GLYPH', C(WARM, 4), C(BRICK, 15), 0.75),
      departuresBoard(16, 9.4), aisleSign(16, 7.3, 'SECURITY', C(GRAY, 4), C(WHITE, 15), 0.6),
      glassScreen(1, 13.35), detector(14), detector(18), glassScreen(18.65, 31),
      BX(16, 7.3, 1.35, 0.35, 0, 0.9, (i, t, L) => { // the X-ray belt between the arches, the tunnel over it
        if (HIT.face === 5) { BG[i] = C(GRAY, 1.2); return set(i, fract(HIT.u * 3 - T * 0.5) < 0.1 ? '|' : ' ', C(GRAY, 7)), true; }
        BG[i] = C(GRAY, (1.7 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }),
      BX(16, 7.3, 0.6, 0.4, 0.9, 1.6, (i, t, L) => { BG[i] = C(GRAY, (2.3 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face <= 2 && HIT.w < 1.3 ? '#' : HIT.face === 4 && HIT.w > 1.4 ? '-' : ' ', C(BLACK, 6)), true; }),
      { ...figProp(12.6, 7.9, figGuardLook(11), { chat: false }), face: [1, 0] }, { ...figProp(19.4, 7.9, figGuardLook(12), { chat: false }), face: [-1, 0] },
      ...toilet(30.2, 12.45, 1, porcelain), washbasin(29.4, 10.3, 0, 1), // the restrooms
    ];
    [3.5, 6.5, 9.5, 12.5].forEach((x, k) => { // check-in: four desks, an agent at each, a sign over it
      p.push(BX(x, 11.4, 1.05, 0.33, 0, 1, desk), { ...standing(x, 12.25, BLUE), face: [0, -1] }, aisleSign(x, 11.4, `CHECK-IN ${k + 1}`, C(BLUE, 3.5), C(WHITE, 15), 0.6));
      if (chance(0.7)) p.push({ ...standing(x - 0.2, 10.35, shirt()), face: [0, 1] }, suitcase(x + 0.35, 10.3, pick([RED, BLUE, GRAY, GREEN])));
    });
    TERMINAL_GATE_X.forEach((g, k) => { // each gate: four rows of seats facing the glass, the podium, its sign; people waiting
      for (const [dx, y] of [[-1.7, 3], [1.7, 3], [-1.7, 4.5], [1.7, 4.5]]) {
        p.push(seatRow(g + dx, y, 1.25));
        for (const s of [-0.825, 0, 0.825]) if (chance(0.3)) p.push({ ...sitting(g + dx + s, y, shirt(), 0.48), face: [0, -1] });
      }
      const pd = g + (k < 2 ? 3 : -3); // (gate 3's on the far side, out of the way of the door)
      p.push(BX(pd, 1.7, 0.5, 0.28, 0, 1.05, desk), { ...standing(pd, 1.15, BLUE), face: [0, 1] }, aisleSign(g, 1.9, `GATE ${k + 1}`, C(BLACK, 4), C(YEL, 15), 0.55));
    });
    for (const [x, y] of [[21, 9], [26, 9]]) p.push(...tableBox(x, y, 0.4, 0.4), STOOL(x - 0.7, y, RED, 0.62), STOOL(x + 0.7, y, RED, 0.62)); // the café's tables
    p.push(...shoppers([[9, 8.4, 0, 1], [20.5, 9.9, 1, 0], [5, 6, 0, -1], [26.5, 6.2, 0, -1], [11, 5.8, -1, 0]], 0.5));
    return p;
  } };
STOCK_ROOM.terminal = ['coffee', 'latte', 'croissant', 'sandwich', 'water'];
