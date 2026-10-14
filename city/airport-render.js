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
    const s = STANDS_X.find(sx => Math.abs(X - sx) < 0.05);
    if (s != null) return ['|', YEL, 1.3];
    if (fract(X / 1.5) < 0.04 || fract(Y / 1.5) < 0.04) return ['+', GRAY, 0.8];
    return [(r + x) % 4 ? ' ' : '.', GRAY, 0.9];
  }
  if (AIRPORT_BLDG.some(b => Math.abs(rel(wx - b.x)) < b.hl && Math.abs(rel(wy - b.y)) < b.hw)) return [(r + x) % 3 ? ' ' : '.', GRAY, 0.9]; // a hangar's floor
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
// a vault (a Nissen hut's roof): part of a cylinder lying along the box's long axis (b.c, b.s), radius b.r, its axis at
// height b.z0 (below the ground for a shallow arch), cut off at the ground and at its two ends (flat end walls)
function rayVault(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y, lx = qx * b.c + qy * b.s, ly = -qx * b.s + qy * b.c, rl = rx * b.c + ry * b.s, rw = -rx * b.s + ry * b.c, dz = oz - b.z0;
  let best = -1, face = 0;
  const aa = rw * rw + rz * rz, bb = ly * rw + dz * rz, cc = ly * ly + dz * dz - b.r * b.r, disc = bb * bb - aa * cc;
  if (disc >= 0 && aa > 1e-12) for (const t of [(-bb - Math.sqrt(disc)) / aa]) {
    const z = oz + rz * t, along = lx + rl * t;
    if (t > 0.01 && z >= 0 && Math.abs(along) <= b.hl) { best = t; face = 5; }
  }
  if (Math.abs(rl) > 1e-9) for (const end of [-1, 1]) { // the end walls
    const t = (end * b.hl - lx) / rl, w = ly + rw * t, z = oz + rz * t;
    if (t > 0.01 && (best < 0 || t < best) && z >= 0 && w * w + (z - b.z0) ** 2 <= b.r * b.r) { best = t; face = end > 0 ? 1 : 2; }
  }
  if (best < 0) return -1;
  HIT.u = lx + rl * best; HIT.v = ly + rw * best; HIT.w = oz + rz * best; HIT.face = face;
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
// the terminal: glass both long sides (airside and landside) between concrete ends, a band across the top with its
// name, a flat roof with plant on it, the doors where the causeway road comes in
function drawTerminal(b, vx, vy, lit) {
  const NAME = 'GLYPHPORT INTERNATIONAL';
  drawBox(boxAt(vx, vy, 1, 0, b.hl, b.hw, 0, b.h), (i, t, L) => {
    const f = HIT.face, u = HIT.u, w = HIT.w, k = shadeFace(f);
    if (f === 5) { BG[i] = C(GRAY, 2 + L * 0.25); return set(i, hash(Math.floor(u * 3), Math.floor(HIT.v * 3), 77) > 0.85 ? '#' : ' ', C(GRAY, 6)), true; } // roof, plant on it
    if (f === 1 || f === 2) { BG[i] = C(STONE, (1.6 + L * 0.3) * k); return set(i, ' ', 0), true; } // the ends
    if (w > b.h - 0.22) { // the name band
      BG[i] = C(BLUE, 1.5 + L * 0.2);
      const n = NAME.length, side = f === 3 ? 1 : -1, q = (u * side / b.hl + 1) / 2;
      const ch = signLine(NAME, q * n, (b.h - 0.11 - w) / 0.2, i, b.h - 0.11, midDepth(vx, vy), t, 2 * b.hl / n, 0.16, farDepth(vx, vy, b.hl), side, 0);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 13 + lit * 2)), true;
    }
    const mull = fract(u * 1.6) < 0.08 || w < 0.04 || Math.abs(w - 0.55) < 0.02, door = f === 4 && Math.abs(u) < 0.6 && w < 0.4;
    if (mull) { BG[i] = C(GRAY, 2.5 + L * 0.3); return set(i, '|', C(GRAY, 6)), true; }
    BG[i] = door ? C(GRAY, 1) : C(CYAN, 1.2 + lit * 2.5 + L * 0.15); // glass: lit up inside after dark
    return set(i, door ? '|' : lit > 0.3 && hash(Math.floor(u * 6), Math.floor(w * 8), 79) > 0.88 ? 'i' : ' ', C(WARM, 11)), true; // (people inside)
  });
}
// a hangar: an arched roof over it front to back, its doors open on the apron side, dark inside
function drawHangar(b, vx, vy, lit) {
  const r = (b.hl * b.hl + b.h * b.h) / (2 * b.h), z0 = b.h - r; // the arch through the walls' feet and the roof's peak
  const box = { x: vx, y: vy, c: 0, s: 1, hl: b.hw, hw: b.hl, z0: 0, z1: b.h, r, z0Axis: z0 };
  drawBox({ ...box, z0: z0 }, (i, t, L) => {
    const f = HIT.face, across = HIT.v, w = HIT.w;
    if (f === 5) { BG[i] = C(GRAY, (3 + L * 0.35) * (0.8 + 0.2 * Math.abs(across) / b.hl)); return set(i, fract(across * 3) < 0.15 ? '|' : ' ', C(GRAY, 7)), true; } // corrugated
    const front = f === 1, door = front && Math.abs(across) < b.hl * 0.85 && w < b.h * 0.75;
    if (door) return false; // open: you see in
    BG[i] = C(GRAY, 2.8 + L * 0.35); return set(i, front && w > b.h * 0.8 ? '=' : ' ', C(ORANGE, 12)), true;
  }, (ox, oy, oz, rx, ry, rz) => rayVault(ox, oy, oz, rx, ry, rz, { x: vx, y: vy, c: 0, s: 1, hl: b.hw, r, z0 }));
  // inside, through the open doors: the back wall, under strip lights, and the underside of the roof
  drawBox(boxAt(vx, vy - b.hw + 0.06, 1, 0, b.hl * 0.95, 0.03, 0, b.h * 0.95), (i, t, L) => {
    const strip = fract(HIT.w * 1.6) < 0.08;
    BG[i] = strip ? C(WHITE, 6 + lit * 4) : C(GRAY, 1 + lit * 0.8); return set(i, fract(HIT.u * 2) < 0.06 ? '|' : ' ', C(GRAY, 5)), true;
  });
  drawBox(boxAt(vx, vy, 1, 0, b.hl * 0.9, b.hw * 0.95, b.h * 0.75, b.h * 0.76), (i, t, L) => { BG[i] = C(GRAY, 0.8); return set(i, fract(HIT.u * 1.5) < 0.1 ? '=' : ' ', C(WHITE, 6 + lit * 6)), true; });
}
