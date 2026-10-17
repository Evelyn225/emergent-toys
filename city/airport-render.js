// ===== the airport on screen (where everything is: world.js). The ground: the runway with its edge and centre lines,
// threshold stripes and numbers (09 at the west end, 27 at the east, the way a pilot coming in reads them), touchdown
// bars; the taxiway's yellow line; the apron's concrete and the stands' lead-in lines; the helipads; the landside road;
// grass and rocks round the shore; and after dark the runway's white edge lights, green and red at its ends, blue along
// the taxiway. The buildings: the terminal (glass both sides, its name along the top), the two hangars (arched, open
// at the front), the control tower, the windsock.
const runwayNumber = (num, along, across) => { // is (along, across) on a painted digit? along 0..1.25 from its foot, across -0.55..0.55
  if (along < 0 || along >= 1.25 || Math.abs(across) >= 0.55) return false;
  const k = across < 0 ? 0 : 1, col = Math.floor(((across < 0 ? across + 0.55 : across - 0.1) / 0.45) * 3);
  if (col < 0 || col > 2) return false;
  const row = 4 - Math.floor(along / 0.25);
  return (DIGIT5[num[k]] >> (14 - row * 3 - col) & 1) === 1;
};
function airportFloor(i, r, x, wx, wy, L) { // [ch, base, k] for the floor cell; or null, having painted it itself (a light)
  const X = mod(wx, N), Y = mod(wy, N), lit = lampsOn > 0.2, blink = (light, col, ch = '*') => { set(i, ch, C(col, 15)); BG[i] = C(col, 3 + light * 4); FOGS[i] = 0; return null; };
  if (airportEdge(wx, wy) < 0.5) return [hash(Math.floor(wx * 9), Math.floor(wy * 9), 341) > 0.45 ? '%' : 'o', GRAY, 1.2]; // rocks
  if (onRunway(wx, wy)) {
    const u = X - RUNWAY.x0, v = Y - RUNWAY.y, len = RUNWAY.x1 - RUNWAY.x0;
    if (lit && Math.abs(v) > 1.38 && fract(u / 3) < 0.07) return blink(lampsOn, u < 0.5 ? GREEN : u > len - 0.5 ? RED : WHITE); // edge lights
    if (lit && (u < 0.12 || u > len - 0.12)) return blink(lampsOn, u < 0.12 ? GREEN : RED, 'o'); // the threshold bars
    if (Math.abs(v) > 1.36) return ['=', WHITE, 1.2]; // edge lines
    if ((u < 1.8 || u > len - 1.8) && Math.abs(v) < 1.2 && fract(v * 2.5) < 0.55) return ['#', WHITE, 1.3]; // piano keys
    if (runwayNumber('09', u - 2.2, v) || runwayNumber('27', len - 2.2 - u, -v)) return ['#', WHITE, 1.3];
    if ((Math.abs(u - 6) < 0.7 || Math.abs(u - (len - 6)) < 0.7) && Math.abs(Math.abs(v) - 0.7) < 0.2) return ['=', WHITE, 1.2]; // touchdown bars
    if (Math.abs(v) < 0.06 && fract(u / 1.6) < 0.55) return ['-', WHITE, 1.2]; // centre line
    return [hash(Math.floor(wx * 7), Math.floor(wy * 7), 342) > 0.8 ? '.' : ' ', GRAY, 0.55];
  }
  const taxiA = Math.abs(Y - TAXIWAY.y) < TAXIWAY.hw && X > TAXIWAY.x0 - TAXIWAY.hw && X < TAXIWAY.x1 + TAXIWAY.hw;
  const link = [TAXIWAY.x0, TAXIWAY.x1].find(tx => Math.abs(X - tx) < TAXIWAY.hw && Y > TAXIWAY.y && Y < RUNWAY.y);
  if (taxiA || link != null) {
    const v = taxiA ? Y - TAXIWAY.y : X - link;
    if (lit && Math.abs(v) > TAXIWAY.hw - 0.06 && fract((taxiA ? X : Y) / 2) < 0.1) return blink(lampsOn, BLUE);
    if (Math.abs(v) < 0.05) return ['-', YEL, 1.4];
    return [' ', GRAY, 0.6];
  }
  for (const h of HELIPADS) { // a ring and an H
    const du = X - h.x, dv = Y - h.y, d = Math.hypot(du, dv);
    if (d > h.r) continue;
    if (lit && d > h.r - 0.08 && fract(Math.atan2(dv, du) / TAU * 12) < 0.12) return blink(lampsOn, GREEN);
    if (Math.abs(d - h.r * 0.8) < 0.06 || Math.abs(du) < 0.35 && Math.abs(dv) < 0.45 && (Math.abs(du) > 0.24 || Math.abs(dv) < 0.06)) return ['#', WHITE, 1.3];
    return [' ', GREEN, 0.5];
  }
  if (Y > APRON.y0 && Y < APRON.y1 && X > APRON.x0 && X < APRON.x1) { // concrete, its joints, and a yellow line in to each stand
    if (STANDS_X.some(sx => Math.abs(X - sx) < 0.05) || AIRPORT_BLDG.some(h => h.kind === 'hangar' && Math.abs(X - h.x) < 0.012)) return ['|', YEL, 1.3]; // (and out of each hangar)
    if (fract(X / 1.5) < 0.04 || fract(Y / 1.5) < 0.04) return ['+', GRAY, 0.8];
    return [(r + x) % 4 ? ' ' : '.', GRAY, 0.9];
  }
  const bld = airportBldgAt(wx, wy);
  if (bld && bld.kind === 'terminal') { // the hall: polished terrazzo under the lights, mats in the doors, carpet at the gates
    const u = X - bld.x, v = Y - bld.y, f = Math.max(0, 1 - Math.hypot(rel(wx - px), rel(wy - py)) / vis * 1.5);
    const mat = v < -0.75 && Math.abs(u) < TERMINAL_DOOR || v > 0.75 && TERMINAL_AIRDOORS.some(d => Math.abs(u - d) < TERMINAL_AIRDOOR), carpet = v > 0.38 && TERMINAL_GATES.some(g => Math.abs(u - g) < 1);
    const joint = fract(u * 4) < 0.05 || fract(v * 4) < 0.05, fleck = hash(Math.floor(wx * 30), Math.floor(wy * 30), 343) > 0.93;
    BG[i] = mat ? C(BRICK, 1 + f * 1.5) : carpet ? C(BLUE, 1 + f * 1.4) : C(STONE, 2 + f * 3);
    set(i, mat ? '=' : carpet ? ((r + x) % 3 ? ' ' : '.') : joint ? '+' : fleck ? '.' : ' ', C(mat ? BRICK : carpet ? BLUE : STONE, 4 + f * 4));
    return null;
  }
  if (bld) { // a hangar's floor: in its shade, a yellow line down the middle out to the apron
    if (bld.kind === 'hangar' && Math.abs(X - bld.x) < 0.012) return ['|', YEL, 1];
    return [(r + x) % 3 ? ' ' : '.', GRAY, 0.6];
  }
  if (Y < AIRPORT.y0 + 1.6) { // the landside road, from the causeway along the front
    if (Math.abs(Y - (AIRPORT.y0 + 0.85)) < 0.04 && fract(X * 2) < 0.5) return ['=', YEL, 1.4];
    return [(r + x) & 1 ? '.' : ' ', GRAY, 0.75];
  }
  return [(r * 3 + x) % 4 ? '"' : ',', GREEN, 1.1]; // grass
}
// the causeway: a road out over the water, railings each side, lamps along it
function causewayFloor(r, x, wx, wy) {
  const e = Math.abs(rel(wx - CAUSEWAY.x)) / CAUSEWAY.hw;
  if (e > 0.9) return ['|', GRAY, 1.5];
  if (e < 0.04 && fract(wy * 2) < 0.5) return ['=', YEL, 1.4];
  return [(r + x) & 1 ? '.' : ' ', GRAY, 0.8];
}
// ---- the buildings
// a hangar (world.js has its shape), for drawBox: the nearest of its arched roof (outside, face 5, or its underside, 7),
// its back wall (2; inside, 9) and its front wall round the opening (1; inside, 8). Through the opening a ray goes on
// in, to the underside, the back wall, or out the other side onto the floor. HIT.u along it (+ the front), v across.
function rayHangar(ox, oy, oz, rx, ry, rz, b) {
  const qv = ox - b.x, qu = oy - b.y, dz = oz - b.z0;
  let best = Infinity, face = 0;
  const aa = rx * rx + rz * rz, bb = qv * rx + dz * rz, cc = qv * qv + dz * dz - b.r * b.r, disc = bb * bb - aa * cc;
  if (disc >= 0 && aa > 1e-12) { // into the arch's circle (the outside of the roof), and out of it (the underside)
    const sq = Math.sqrt(disc);
    for (const [t, f] of [[(-bb - sq) / aa, 5], [(-bb + sq) / aa, 7]]) if (t > 0.01 && t < best && oz + rz * t >= 0 && Math.abs(qu + ry * t) <= b.hw) { best = t; face = f; }
  }
  if (Math.abs(ry) > 1e-9) for (const end of [1, -1]) {
    const t = (end * b.hw - qu) / ry, v = qv + rx * t, z = oz + rz * t;
    if (!(t > 0.01 && t < best && z >= 0 && v * v + (z - b.z0) ** 2 <= b.r * b.r) || end > 0 && hangarDoor(b.bld, v, z)) continue;
    best = t; face = (end > 0) === (ry < 0) ? (end > 0 ? 1 : 2) : (end > 0 ? 8 : 9); // (met from outside, or from in)
  }
  if (best === Infinity) return -1;
  HIT.u = qu + ry * best; HIT.v = qv + rx * best; HIT.w = oz + rz * best; HIT.face = face;
  return best;
}
function drawAirport() {
  const cx = (AIRPORT.x0 + AIRPORT.x1) / 2, cy = (AIRPORT.y0 + AIRPORT.y1) / 2;
  if (Math.hypot(rel(cx - px), rel(cy - py)) > vis + 30) return;
  const lit = Math.max(night, overcast * 0.6);
  for (const b of AIRPORT_BLDG) {
    const [vx, vy] = R(b.x, b.y);
    if (!inView(vx, vy, b.hl + 0.2)) continue;
    if (b.kind === 'terminal') drawTerminal(b, vx, vy, lit);
    else drawHangar(b, vx, vy, lit);
  }
  { // the control tower: a concrete shaft with slit windows, the glass cab, its roof, the mast and its red light
    const [vx, vy] = R(TOWER.x, TOWER.y);
    if (inView(vx, vy, TOWER.cab + 0.1)) {
      drawBox(boxAt(vx, vy, 1, 0, TOWER.r, TOWER.r, 0, TOWER.h), (i, t, L) => {
        BG[i] = C(STONE, (1.6 + L * 0.3) * drumLit(TOWER.r));
        return set(i, fract(HIT.w * 2.2) < 0.12 && Math.abs(Math.atan2(HIT.v, HIT.u)) < 0.6 ? '=' : ' ', C(CYAN, 6 + lit * 6)), true;
      }, rayCopperDrum);
      drawBox(boxAt(vx, vy, 1, 0, TOWER.cab, TOWER.cab, TOWER.h, TOWER.h + 0.52), (i, t, L) => {
        if (HIT.face > 4) { BG[i] = C(GRAY, 2 + L * 0.3); return set(i, ' ', 0), true; }
        const mull = fract(Math.atan2(HIT.v, HIT.u) / TAU * 10) < 0.1 || HIT.w > TOWER.h + 0.46;
        BG[i] = mull ? C(GRAY, 2 + L * 0.3) : C(CYAN, 1.5 + lit * 3 + L * 0.15); return set(i, mull ? '|' : lit > 0.3 && hash(i, 3, 5) > 0.9 ? '.' : ' ', C(WARM, 12)), true;
      }, rayCopperDrum);
      drawBox(boxAt(vx, vy, 1, 0, TOWER.cab + 0.06, TOWER.cab + 0.06, TOWER.h + 0.52, TOWER.h + 0.6), (i, t, L) => { BG[i] = C(GRAY, 2.5 + L * 0.3); return set(i, ' ', 0), true; }, rayCopperDrum);
      rod(vx, vy, TOWER.h + 0.6, vx, vy, TOWER.h + 1.1, 0.012, GRAY, 1.2);
      if (fract(T * 0.8) < 0.5) dot(vx, vy, TOWER.h + 1.12, 0.03, (i, t, L) => { BG[i] = C(RED, 13); return set(i, '*', C(WHITE, 15)), true; });
    }
  }
  { // the windsock, at the east end: a pole, and the sock streaming off downwind in orange and white
    const [vx, vy] = R(RUNWAY.x1 - 1.5, RUNWAY.y - RUNWAY.hw - 1.2), wl = Math.hypot(...HAZE_WIND) || 1, ax = HAZE_WIND[0] / wl, ay = HAZE_WIND[1] / wl;
    if (inView(vx, vy, 0.6)) {
      rod(vx, vy, 0, vx, vy, 0.62, 0.01, GRAY, 1.2);
      for (let k = 0; k < 5; k++) {
        const f0 = k * 0.09, f1 = (k + 1) * 0.09, droop = 0.03 + 0.02 * Math.sin(T * 3 + k);
        rod(vx + ax * f0, vy + ay * f0, 0.6 - droop * k / 5, vx + ax * f1, vy + ay * f1, 0.6 - droop * (k + 1) / 5, 0.035 - k * 0.004, k & 1 ? WHITE : ORANGE, 1.4);
      }
    }
  }
}
// ---- the terminal (world.js has its plan). rayTerminal, for drawBox: the nearest of its solid parts, from outside or
// in: the roof (5) or the ceiling under it (16), the ends (1 east, 2 west; their insides 11, 12), the long walls' frames
// (3 airside, 4 landside; inside 13, 14). The glass and the open doors let the ray on through, into the hall and out the
// far side. HIT.u east along it, v south across it.
function rayTerminal(ox, oy, oz, rx, ry, rz, b) {
  const qu = ox - b.x, qv = oy - b.y;
  let best = Infinity, face = 0;
  if (Math.abs(rx) > 1e-9) for (const e of [1, -1]) {
    const t = (e * b.hl - qu) / rx, v = qv + ry * t, z = oz + rz * t;
    if (t > 0.01 && t < best && Math.abs(v) <= b.hw && z >= 0 && z <= b.h) { best = t; face = (e > 0) === (rx < 0) ? (e > 0 ? 1 : 2) : (e > 0 ? 11 : 12); }
  }
  if (Math.abs(ry) > 1e-9) for (const e of [1, -1]) {
    const t = (e * b.hw - qv) / ry, u = qu + rx * t, z = oz + rz * t;
    if (t > 0.01 && t < best && Math.abs(u) <= b.hl && z >= 0 && z <= b.h && !terminalGlass(e < 0, u, z)) { best = t; face = (e > 0) === (ry < 0) ? (e > 0 ? 3 : 4) : (e > 0 ? 13 : 14); }
  }
  if (Math.abs(rz) > 1e-9) {
    const t = (b.h - oz) / rz, u = qu + rx * t, v = qv + ry * t;
    if (t > 0.01 && t < best && Math.abs(u) <= b.hl && Math.abs(v) <= b.hw) { best = t; face = rz < 0 ? 5 : 16; }
  }
  if (best === Infinity) return -1;
  HIT.u = qu + rx * best; HIT.v = qv + ry * best; HIT.w = oz + rz * best; HIT.face = face;
  return best;
}
const inLight = t => (1 - t / vis) * 15; // (indoors the lights are on, day and night)
// a line of text across a box's broad face (3 or 4, a box along x), on the band from z0 (its foot) bandH tall
function faceText(word, i, t, vx, vy, hl, z0, bandH) {
  const n = word.length, [ex, ey] = faceDir(1, 0);
  return signLine(word, faceQ(HIT.u, hl) * n, (z0 + bandH - HIT.w) / bandH, i, z0 + bandH / 2, midDepth(vx, vy), t, 2 * hl / n, bandH, farDepth(vx, vy, hl), ex, ey);
}
// the terminal's shell: concrete ends, the name in a band along the top of both long sides, frames round the glass; from
// inside, the ceiling's rows of light panels and an advert lit up on each end wall
function drawTerminal(b, vx, vy, lit) {
  const NAME = 'GLYPHPORT INTERNATIONAL', band = b.h - 0.22;
  drawBox(boxAt(vx, vy, 1, 0, b.hl, b.hw, 0, b.h), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    if (f === 5) { BG[i] = C(GRAY, 2 + L * 0.25); return set(i, hash(Math.floor(u * 3), Math.floor(v * 3), 77) > 0.85 ? '#' : ' ', C(GRAY, 6)), true; } // roof, plant on it
    if (f === 1 || f === 2) { BG[i] = C(STONE, (1.6 + L * 0.3) * shadeFace(f)); return set(i, ' ', 0), true; } // the ends
    const IN = inLight(t);
    if (f === 16) { // the ceiling: two rows of light panels the length of the hall, a grid of tiles between
      if (Math.abs(Math.abs(v) - 0.45) < 0.09 && fract(u * 1.25) < 0.7) { BG[i] = C(WHITE, 7 + IN * 0.35); return set(i, ' ', 0), true; }
      BG[i] = C(GRAY, 1.8 + IN * 0.12); return set(i, fract(u * 4) < 0.08 || fract(v * 4) < 0.08 ? '+' : ' ', C(GRAY, 5)), true;
    }
    if (f === 11 || f === 12) { // the ends, inside: an advert lit up on each, framed in steel
      if (!(Math.abs(v) < 0.7 && w > 0.42 && w < 0.86)) { BG[i] = C(STONE, 1.6 + IN * 0.12); return set(i, Math.abs(v) < 0.74 && w > 0.38 && w < 0.9 ? '#' : ' ', C(GRAY, 7)), true; }
      const ad = f === 11 ? 'FLY AIR 9' : 'WELCOME', n = ad.length, q = f === 11 ? (v + 0.7) / 1.4 : (0.7 - v) / 1.4, wx = f === 11 ? vx + b.hl : vx - b.hl;
      const ch = signLine(ad, q * n, (0.78 - w) / 0.28, i, 0.64, midDepth(wx, vy), t, 1.4 / n, 0.28, farDepth(wx, vy, 0.7), 0, f === 11 ? 1 : -1);
      BG[i] = C(f === 11 ? BLUE : MAG, 4 + IN * 0.2);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 15)), true;
    }
    if (w > band) { // the band along the top: the name outside, a plain soffit in
      if (f > 10) { BG[i] = C(GRAY, 1.6 + IN * 0.1); return set(i, ' ', 0), true; }
      BG[i] = C(BLUE, 1.5 + L * 0.2);
      const n = NAME.length, side = f === 3 ? 1 : -1, q = (u * side / b.hl + 1) / 2;
      const ch = signLine(NAME, q * n, (b.h - 0.11 - w) / 0.2, i, b.h - 0.11, midDepth(vx, vy), t, 2 * b.hl / n, 0.16, farDepth(vx, vy, b.hl), side, 0);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 13 + lit * 2)), true;
    }
    const landside = f === 4 || f === 14, door = landside ? Math.abs(u) < TERMINAL_DOOR + 0.06 : TERMINAL_AIRDOORS.some(d => Math.abs(u - d) < TERMINAL_AIRDOOR + 0.06);
    if (door && w < 0.47) { BG[i] = C(YEL, f < 10 ? 3 + L * 0.3 : 2.5 + IN * 0.1); return set(i, ' ', 0), true; } // the doors' frames
    const bay = terminalBay(u), frame = (landside ? w > 0.46 && w < 0.9 : w > 0.12) && (bay < (landside ? 0.18 : 0.16) || bay > 0.97); // (round the windows: steel)
    if (frame || !landside) { BG[i] = C(GRAY, f < 10 ? 2.5 + L * 0.3 : 2 + IN * 0.1); return set(i, frame && bay < 0.1 ? '|' : '=', C(GRAY, 6)), true; }
    BG[i] = C(STONE, f < 10 ? (1.8 + L * 0.3) * shadeFace(f) : 1.8 + IN * 0.12); // the landside wall: concrete panels
    return set(i, fract(u * 2.4) < 0.04 || fract(w * 4) < 0.05 ? '.' : ' ', C(GRAY, 5)), true;
  }, (ox, oy, oz, rx, ry, rz) => rayTerminal(ox, oy, oz, rx, ry, rz, { x: vx, y: vy, hl: b.hl, hw: b.hw, h: b.h }));
  if (Math.hypot(vx, vy) < 22) drawTerminalHall(b, vx, vy);
}
// the departures (or arrivals) board's lines: a flight every 25 minutes from six in the morning; the next few, and the
// last one gone (or landed). Each: time, where, gate, and how it's doing
const AIR_PLACES = ['PARIS', 'TOKYO', 'LAGOS', 'OSLO', 'LIMA', 'CAIRO', 'SEOUL', 'ROME', 'QUITO', 'PERTH', 'DUBLIN', 'HAVANA', 'MUMBAI', 'BERLIN'];
const AIR_STEP = 25 / 60, AIR_DAILY = 41; // (06:00 to 22:40)
function boardLines(dep) {
  const out = [];
  for (let d = 0; d < 2; d++) for (let j = 0; j < AIR_DAILY && out.length < 5; j++) { // (today's, then tomorrow's)
    const at = 6 + j * AIR_STEP + d * 24, to = at - tod, h = hash(dayNum + d, j, dep ? 61 : 62);
    if (to < -0.3) continue;
    const status = dep ? (to < 0 ? 'DEPARTED' : to < 0.35 ? 'BOARDING' : to < 0.6 ? 'GO TO GATE' : h > 0.86 ? 'DELAYED' : 'ON TIME')
      : (to < 0 ? 'LANDED' : to < 0.25 ? 'LANDING' : h > 0.86 ? 'DELAYED' : 'ON TIME');
    const mins = Math.round(mod(at, 24) * 60), hh = String(Math.floor(mins / 60) % 24).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
    const place = AIR_PLACES[Math.floor(h * 997) % AIR_PLACES.length];
    out.push({ text: `${hh}:${mm} ${place.padEnd(7)} G${1 + j % 3} ${status.padEnd(10)}`, status });
  }
  return out;
}
const FLIGHT_BOARD = { hl: 0.95, z0: 0.56, z1: 0.94, row: 0.06, n: 27, status: 17 }; // (n: characters a line; status: where that starts)
const statusCol = s => s === 'BOARDING' || s === 'LANDING' ? (fract(T) < 0.6 ? GREEN : BLACK) : s === 'DELAYED' ? RED : s === 'DEPARTED' || s === 'LANDED' ? GRAY : s === 'GO TO GATE' ? ORANGE : YEL;
// the folk in the hall: staff behind the desks and the café counter, people queueing, sitting at the gates, walking through
const HALL_SHIRTS = [RED, BLUE, GREEN, YEL, MAG, CYAN, ORANGE, WHITE, BRICK];
const HALL_FOLK = [
  ...[-5.7, -4.5, -3.3, -2.1].map((u, k) => ({ u, v: -0.8, fx: 0, fy: 1, shirt: BLUE, pants: BLUE, seed: 700 + k })), // at the desks
  ...[[-5.7, 2], [-4.5, 1], [-2.1, 2], [3.1, 1], [3.8, 1]].flatMap(([u, n], k) => [...Array(n)].map((_, j) => ({ u: u + j * 0.04, v: -0.43 + j * 0.13, fx: 0, fy: -1, seed: 720 + k * 3 + j }))), // queueing
  ...[3.0, 3.8].map((u, k) => ({ u, v: -0.82, fx: 0, fy: 1, shirt: WHITE, pants: GRAY, seed: 740 + k })), // the café's
  ...TERMINAL_GATES.flatMap((g, k) => [[-0.7, 0.48], [-0.2, 0.48], [0.35, 0.74], [0.75, 0.48], [-0.55, 0.74]].map(([e, v], j) => ({ u: g + e, v, fx: 0, fy: 1, sit: true, seed: 760 + k * 7 + j }))), // waiting at the gates
].map(m => ({ ...m, shirt: m.shirt ?? HALL_SHIRTS[m.seed % HALL_SHIRTS.length] }));
const HALL_WALKERS = [[-0.2, 0.11, 0], [-0.2, 0.08, 1.1], [0.29, 0.1, 0.5], [0.29, 0.07, 1.6]].map(([v, sp, ph], k) => ({ v, sp, ph, seed: 800 + k, shirt: HALL_SHIRTS[(k * 4 + 1) % HALL_SHIRTS.length] }));
// a sign hung from the ceiling on two rods: word on both faces, in col on bg
function hallSign(x, y, hl, z0, z1, ceiling, word, bg, col) {
  for (const e of [-1, 1]) rod(x + e * hl * 0.8, y, z1, x + e * hl * 0.8, y, ceiling, 0.004, GRAY, 0.8);
  drawBox(boxAt(x, y, 1, 0, hl, 0.012, z0, z1), (i, t) => {
    if (HIT.face !== 3 && HIT.face !== 4) { BG[i] = C(GRAY, 1.5); return set(i, ' ', 0), true; }
    const ch = faceText(word, i, t, x, y, hl, z0 + 0.008, z1 - z0 - 0.016);
    BG[i] = bg; return set(i, ch && ch !== ' ' ? ch : ' ', col), true;
  });
}
// inside: the desks and their signs, the café, the columns, the seats and gate signs, the departures board, the people
function drawTerminalHall(b, vx, vy) {
  for (const o of TERMINAL_IN) {
    const x = vx + o.u, y = vy + o.v;
    if (o.kind === 'column') { drum(x, y, o.hu, 0, b.h, (i, t) => { BG[i] = C(STONE, (3 + inLight(t) * 0.35) * drumLit(o.hu)); return set(i, ' ', 0), true; }); continue; }
    if (o.kind === 'seats') { // a row of blue seats on a steel beam, facing the planes
      drawBox(boxAt(x, y + 0.01, 1, 0, o.hu, o.hv - 0.01, 0.036, 0.046), (i, t) => { BG[i] = C(BLUE, 2 + inLight(t) * 0.18); return set(i, fract(HIT.u * 10) < 0.1 ? '|' : ' ', C(BLUE, 8)), true; });
      drawBox(boxAt(x, y - o.hv + 0.006, 1, 0, o.hu, 0.006, 0.046, o.h), (i, t) => { BG[i] = C(BLUE, 1.6 + inLight(t) * 0.16); return set(i, fract(HIT.u * 10) < 0.1 ? '|' : ' ', C(BLUE, 7)), true; });
      drawBox(boxAt(x, y, 1, 0, o.hu * 0.9, 0.008, 0, 0.036), i => { BG[i] = C(GRAY, 1.2); return set(i, '|', C(GRAY, 6)), true; });
      continue;
    }
    const cafe = o.kind === 'cafe'; // a counter: its front panelled, a pale top; screens on a desk, a coffee machine and a cake case on the café's
    drawBox(boxAt(x, y, 1, 0, o.hu, o.hv, 0, o.h), (i, t) => {
      const IN = inLight(t);
      if (HIT.face === 5) { BG[i] = C(cafe ? WARM : WHITE, 2.5 + IN * 0.2); return set(i, ' ', 0), true; }
      const stripe = !cafe && Math.abs(HIT.w - 0.08) < 0.01;
      BG[i] = stripe ? C(YEL, 5 + IN * 0.3) : C(cafe ? BRICK : BLUE, 1.5 + IN * 0.18);
      return set(i, cafe && fract(HIT.u * 5) < 0.06 ? '|' : ' ', C(BRICK, 6)), true;
    });
    for (const e of cafe ? [-0.3, 0.45] : [-0.2, 0.2]) drawBox(boxAt(x + e, y - o.hv * 0.4, 1, 0, cafe ? 0.07 : 0.035, cafe ? 0.03 : 0.006, o.h, o.h + (cafe ? 0.07 : 0.05)), (i, t) => {
      if (cafe) { BG[i] = C(e < 0 ? GRAY : WARM, (e < 0 ? 2 : 4) + inLight(t) * 0.2); return set(i, e < 0 && HIT.face !== 5 && HIT.w > o.h + 0.05 ? 'o' : ' ', C(RED, 13)), true; }
      BG[i] = HIT.face === 3 || HIT.face === 4 ? C(CYAN, 5 + fract(T * 0.3 + e) * 3) : C(GRAY, 1.5); return set(i, ' ', 0), true;
    });
    if (cafe) hallSign(x, y, 0.45, 0.4, 0.47, b.h, 'CAFE  GLYPH', C(WARM, 4), C(BRICK, 15));
    else hallSign(x, y, 0.3, 0.4, 0.47, b.h, `CHECK-IN ${o.n}`, C(BLUE, 3.5), C(WHITE, 15));
  }
  STANDS_X.forEach((sx, k) => hallSign(vx + sx - b.x, vy + 0.88, 0.2, 0.45, 0.53, b.h, `GATE ${k + 1}`, C(BLACK, 4), C(YEL, 15))); // over the seats by each gate
  // the board, hung over the middle of the hall: departures facing the doors, arrivals facing the gates
  const lines = { 4: boardLines(true), 3: boardLines(false) }, x = vx, y = vy - 0.15;
  for (const e of [-1, 1]) rod(x + e * FLIGHT_BOARD.hl * 0.85, y, FLIGHT_BOARD.z1, x + e * FLIGHT_BOARD.hl * 0.85, y, b.h, 0.005, GRAY, 0.9);
  drawBox(boxAt(x, y, 1, 0, FLIGHT_BOARD.hl, 0.02, FLIGHT_BOARD.z0, FLIGHT_BOARD.z1), (i, t) => {
    const f = HIT.face, row = Math.floor((FLIGHT_BOARD.z1 - 0.01 - HIT.w) / FLIGHT_BOARD.row);
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, 1.6); return set(i, ' ', 0), true; }
    BG[i] = C(BLACK, 3);
    if (row < 0 || row > 5) return set(i, ' ', 0), true;
    const z0 = FLIGHT_BOARD.z1 - 0.01 - (row + 1) * FLIGHT_BOARD.row, line = row ? lines[f][row - 1] : null;
    if (row && !line) return set(i, ' ', 0), true;
    const ch = faceText(row ? line.text : (f === 4 ? 'DEPARTURES' : 'ARRIVALS').padEnd(FLIGHT_BOARD.n), i, t, x, y, FLIGHT_BOARD.hl, z0, FLIGHT_BOARD.row);
    const col = !row ? C(WHITE, 15) : Math.floor(faceQ(HIT.u, FLIGHT_BOARD.hl) * FLIGHT_BOARD.n) >= FLIGHT_BOARD.status ? C(statusCol(line.status), 14) : C(YEL, 14);
    return set(i, ch && ch !== ' ' ? ch : ' ', col), true;
  });
  // the people
  for (const m of HALL_FOLK) drawFigure(vx + m.u, vy + m.v, 0, 0.175, m.fx, m.fy, streetLook(m), m.sit ? 'sit7' : 'stand', { light: 9 });
  for (const m of HALL_WALKERS) { // up and down the hall, turning at the ends
    const p = mod(T * m.sp + m.ph, 2), dir = p < 1 ? 1 : -1, u = -6.3 + 12.6 * (p < 1 ? p : 2 - p);
    drawFigure(vx + u, vy + m.v, 0, 0.175, dir, 0, streetLook(m), 'walk' + (Math.floor(T * 7 + m.seed) & 7), { light: 9 });
  }
}
// a hangar: corrugated sheeting arched over it front to back, a strip of rooflights along the crown, its number over
// the opening; inside, steel ribs under the roof, lamps hung between them, a workbench and tool board along the back
function drawHangar(b, vx, vy, lit) {
  const { r, z0 } = hangarArch(b), num = AIRPORT_BLDG.filter(o => o.kind === 'hangar').indexOf(b) + 1, L0 = HANGAR_DOOR.lintel;
  const hazard = (i, v, w, k) => (BG[i] = fract((v + w) * 5) < 0.5 ? C(YEL, 6 * k) : C(BLACK, 4), set(i, ' ', 0), true); // the opening's edge
  const numeral = (v, w) => { // the hangar's number, painted big on the wall over the opening
    const row = Math.floor((L0 + 0.33 - w) / 0.058), col = Math.floor((v + 0.087) / 0.058);
    return row >= 0 && row < 5 && col >= 0 && col < 3 && (DIGIT5[num] >> (14 - row * 3 - col) & 1) === 1;
  };
  drawBox(boxAt(vx, vy, 0, 1, b.hw, b.hl, 0, b.h), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    if (f === 5) { // the roof, lit from above: the sheets' seams, the rooflights along the crown
      const k = (2.6 + L * 0.35) * (0.6 + 0.4 * (w - z0) / r), seam = fract(u / 0.6) < 0.06;
      if (Math.abs(v) < 0.28 && !seam) return BG[i] = C(CYAN, 1.5 + day * 2 + lit * 2.5), set(i, ' ', 0), true;
      return BG[i] = C(GRAY, seam ? k * 0.7 : k), set(i, ' ', 0), true;
    }
    if (f === 7) { // under it: a rib every 6m, lamps hung in two rows between them, daylight down the rooflights
      const rib = fract(u / 0.6) < 0.07, lamp = Math.abs(Math.abs(v) - 0.95) < 0.11 && Math.abs(fract(u / 0.6) - 0.5) < 0.1;
      if (lamp) return BG[i] = C(WHITE, 9 + lit * 4), set(i, ' ', 0), true;
      if (Math.abs(v) < 0.28 && !rib) return BG[i] = C(CYAN, 1 + day * 3), set(i, ' ', 0), true;
      return BG[i] = C(GRAY, rib ? 3.2 : 2.2 + L * 0.1), set(i, rib ? '=' : ' ', C(GRAY, 7)), true;
    }
    const edge = hangarDoor(b, v, w - 0.04) || hangarDoor(b, v - 0.04 * Math.sign(v), w); // (just round the opening)
    if (f === 1 || f === 8) { // the front: clad, its number up top, striped where the doors run
      if (edge && w > 0.02) return hazard(i, v, w, f === 1 ? 1 : 0.6);
      if (f === 1 && numeral(v, w)) return BG[i] = C(YEL, 8 + lit * 3), set(i, ' ', 0), true;
      const k = f === 1 ? 2.4 + L * 0.35 : 2.2;
      return BG[i] = C(GRAY, k), set(i, fract(v * 2) < 0.06 ? '|' : ' ', C(GRAY, f === 1 ? 7 : 4)), true;
    }
    if (f === 2) { // the back, outside: cladding and a small door
      if (Math.abs(v) < 0.09 && w < 0.22) return BG[i] = C(GRAY, 1.2), set(i, Math.abs(v) > 0.07 || w > 0.2 ? '|' : ' ', C(GRAY, 6)), true;
      return BG[i] = C(GRAY, 2.1 + L * 0.3), set(i, fract(v * 2) < 0.06 ? '|' : ' ', C(GRAY, 6)), true;
    }
    // the back, inside: a workbench along it, the tool board over it, the cladding's rails above
    if (w < 0.09 && Math.abs(v) < 1.6) return BG[i] = C(BRICK, w > 0.075 ? 3 : 1.6), set(i, w > 0.075 ? '=' : ' ', C(BRICK, 6)), true;
    if (w > 0.13 && w < 0.32 && Math.abs(v) < 1.3) {
      const tool = hash(Math.floor(v * 14), Math.floor(w * 12), 87 + num);
      return BG[i] = C(GRAY, 2.6), set(i, tool > 0.82 ? '/' : tool > 0.7 ? '|' : tool > 0.62 ? 'o' : ' ', C(tool > 0.78 ? RED : WHITE, 8)), true;
    }
    return BG[i] = C(GRAY, 2.3), set(i, fract(w / 0.35) < 0.08 ? '-' : ' ', C(GRAY, 6)), true;
  }, (ox, oy, oz, rx, ry, rz) => rayHangar(ox, oy, oz, rx, ry, rz, { x: vx, y: vy, hl: b.hl, hw: b.hw, r, z0, bld: b }));
}
