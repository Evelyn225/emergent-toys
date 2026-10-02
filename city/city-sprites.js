// ===== city sprites: everything drawn over the raycast scene, nearest-first order doesn't matter (drawArt depth-tests)
// visit the props in the blocks within draw distance
function forNear(b, fn) {
  const r = Math.ceil(vis / 8) + 1, cx = Math.floor(px / 8), cy = Math.floor(py / 8);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) for (const it of b[bi(cx + i, cy + j)]) fn(it);
}
const R = (x, y) => [rel(x - px), rel(y - py)];
// how much a world direction (ax, ay) lies across our view of a point at (vx, vy): +1 = pointing right on screen
const across = (ax, ay, vx, vy) => { const n = Math.hypot(vx, vy) || 1; return (ax * -vy + ay * vx) / n; };
const FERRY = pad(['   _|_ _|_', ' _|o_o_o_o|___', '|o o o o o o o|', '\\_____________/']);
const PILLAR = pad(['[=]', '|#|', '|#|', '|#|', '|#|', '|#|', '|#|', '/#\\']);
const EL_STAIRS = pad(['[ EL ]', '    _|', '   _| ', '  _|  ', ' _|   ', '_|    ']);
const SAIL_R = mirror(ART.sail);
const DOG = pad(['  __', '(o_ \\_', ' /\\ /\\']);
let siren = null; // the emergency vehicle in sight, if any: floorCell washes its lights over the street
// the light bar's strobe: a double flash of red, a double flash of blue, dark in between. RED, BLUE or -1 (dark)
function strobe() { const p = Math.floor(fract(T * 1.4) * 10); return p === 0 || p === 2 ? RED : p === 5 || p === 7 ? BLUE : -1; }

function citySprites() {
  forNear(treesB, t => drawArt(...R(t.x, t.y), 0, 0.45 * t.s, 0.6 * t.s, ART.tree,
    (c, row, L) => row > 4 ? C(BRICK, L) : C(GREEN, c === '%' ? L * 0.45 : c === '@' ? L * 0.8 : L)));
  forNear(benchesB, b => { const [vx, vy] = R(b.x, b.y); drawBench(vx, vy, b.fx, b.fy, 0.01); });
  for (const b of boats) {
    const p = boatAt(b, T), [vx, vy] = R(p.x, p.y);
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    const toRight = across(p.dir, 0, vx, vy) > 0; // which way it's going across the screen: the sail fills the other way
    const lit = (c, L) => C(YEL, Math.max(L, night * 15));
    if (b.kind === 'sail') drawArt(vx, vy, 0, 0.6, 0.9, toRight ? SAIL_R : ART.sail, (c, row, L) => C(row < 4 ? WHITE : BRICK, L));
    else if (b.kind === 'tug') drawArt(vx, vy, 0, 0.7, 0.45, ART.tug, (c, row, L) => c === 'o' ? lit(c, L) : C(row === 0 ? GRAY : RED, L));
    else drawArt(vx, vy, 0, 1.6, 0.6, FERRY, (c, row, L) => c === 'o' ? lit(c, L) : C(row < 2 ? WHITE : row === 2 ? BLUE : GRAY, L));
  }
  forNear(extrasB, o => drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, o.col));
  for (const v of vendors) {
    const t = v.type, frame = t.art[(T * 2 | 0) & 1];
    drawArt(...R(v.x, v.y), 0, t.w, 0.22, frame, (c, row, L) =>
      c === '~' ? C(WHITE, L * 0.6) : row < 3 && /[A-Z]/.test(c) ? C(WHITE, Math.max(L, night * 15)) :
      row < 3 ? C(t.color, Math.max(L, night * 12)) : c === 'O' ? C(GRAY, L * 0.5) : C(t.color, L));
    drawArt(...R(v.x + v.ox, v.y + v.oy), 0, 0.06, 0.18, ART.walkB, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? v.shirt : GRAY, L));
  }
  for (const s of stations) { const [vx, vy] = R(s.x, s.y); if (Math.hypot(vx, vy) < vis) drawStationEntrance(s, vx, vy); }
  forNear(roofsB, o => {
    const blink = fract(T * 0.8 + o.x) < 0.5;
    drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, (c, row, L) =>
      o.kind === 'antenna' ? (c === '*' ? C(RED, blink ? 15 : 3) : C(GRAY, L)) :
      o.kind === 'tank' ? C(c === '=' ? GRAY : BRICK, L) :
      row === 1 && c !== '|' ? C(o.neon, Math.max(L, night * 15)) : C(GRAY, L));
  });
  for (const k of cranes) {
    const [vx, vy] = R(k.x, k.y);
    if (Math.abs(vx) > vis + 5 || Math.abs(vy) > vis + 5) continue;
    // the jib slews slowly; p = how much of it faces sideways to us (+ = reaching right on screen)
    const th = k.slew + T * 0.03, p = across(Math.cos(th), Math.sin(th), vx, vy);
    // where the hook hangs: under the trolley, always clear of whatever's built below it
    const f = 0.45 + 0.35 * Math.sin(T * 0.08 + k.slew), tx = k.x + Math.cos(th) * JIB * f, ty = k.y + Math.sin(th) * JIB * f;
    let below = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) below = Math.max(below, map[idx(Math.floor(tx) + i, Math.floor(ty) + j)]);
    k.tro = f; k.hz = Math.min(k.H - 0.6, below + 0.5 + 0.8 * (0.5 + 0.5 * Math.sin(T * 0.05 + k.slew * 3)));
    drawShape(vx, vy, 0, 5, k.H + 0.8, (i, u, z, du, dz, L) => craneCell(i, u, z, du, dz, L, k, p));
  }
  for (const s of stacks) {
    const [vx, vy] = R(s.x, s.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawShape(vx, vy, s.z, 1.6, s.H + 2.2, (i, u, z, du, dz, L) => stackCell(i, u, z, du, dz, L, s));
  }
  forNear(lampsB, ({ x, y, ax, ay }) => {
    const [vx, vy] = R(x, y), depth = dx * vx + dy * vy;
    if (depth < 0.05 || depth > vis) return;
    const s = across(ax, ay, vx, vy); // arm across our view: +1 reaching right
    drawShape(vx, vy, 0, REACH + 0.08, LAMP_TOP + NECK + 0.03, (i, u, z, du, dz, L) => lampCell(i, u, z, du, dz, L, s));
  });
  islandSprites();
  forNear(machinesB, m => { const [vx, vy] = R(m.x, m.y); if (Math.hypot(vx, vy) < vis) drawVending(m, vx, vy); });
  forNear(lanternsB, l => { const [vx, vy] = R(l.x, l.y); if (Math.hypot(vx, vy) < 30) drawLanternString(vx, vy, l.ax, l.ay); });
  const LC = { G: GREEN, Y: YEL, R: RED };
  forNear(lightsB, s => {
    const col = C(LC[light(s.bx, s.by, s.vert, T)], 15);
    drawArt(...R(s.x, s.y), 0, 0.05, 0.4, ART.signal, (c, row, L) => c === 'O' ? col : C(GRAY, L));
  });
  bridgeSprites();
  elSprites();
  siren = null;
  for (const m of cars) {
    if ((m.player || m.rider) && !chaseOn) continue; // first person: you're inside it
    const [vx, vy] = R(m.ex, m.ey), hx = m.hx, hy = m.hy;
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    if (m.ev && lightsOn_(m) && Math.hypot(vx, vy) < vis) siren = m;
    drawVehicle(m, vx, vy, hx, hy);
  }
  for (const b of SERVICES) if (!b.out) { // parked out front of its station, ready to go
    const [vx, vy] = R(b.x, b.y);
    if (Math.hypot(vx, vy) < vis) drawVehicle(b.parked || (b.parked = { kind: b.kind, body: EV_BODY[b.kind], ev: true, state: 'home', v: 0 }), vx, vy, -1, 0);
  }
  for (const m of people) if (!m.hidden) {
    drawArt(...R(m.x, m.y), 0, 0.06, 0.18, (m.ph | 0) % 2 ? ART.walkA : ART.walkB,
            (c, row, L) => C(row < 2 ? SKIN : row === 2 ? m.shirt : m.pants, L));
    if (m.hailing) drawArt(...R(m.x, m.y), 0.2, 0.03, 0.06, ['!'], () => C(YEL, fract(T * 3) < 0.6 ? 15 : 8)); // waving you down
  }
  drawBall();
  if (task && task.kind === 'dog') drawArt(...R(task.dog.x, task.dog.y), 0, 0.07, 0.05, DOG, (c, row, L) => C(BRICK, L * 1.2));
}

// a classic street lamp: a tall fluted pole, a swan neck curving out over the street, a lantern hanging from its end.
// Drawn from measurements, so the curve stays one character thick at any distance; s squashes the neck sideways
// when the arm points toward or away from you, so it turns smoothly as you walk round it.
const LAMP_TOP = 0.95, NECK = REACH / 2; // pole height; the neck is a half circle of radius NECK
function lampCell(i, u, z, du, dz, L, s) {
  const lit = lampsOn > 0.3, steel = C(GRAY, L * 1.1), hx = 2 * NECK * s, lu = u - hx, lz = z - (LAMP_TOP - 0.09);
  // the lantern: a cap, a glass body glowing after dark, a finial underneath
  if (Math.abs(lu) < Math.max(0.03, du * 0.75) && z < LAMP_TOP - 0.03 && z > LAMP_TOP - 0.14) {
    if (z > LAMP_TOP - 0.055) return set(i, Math.abs(lu) < Math.max(0.015, du / 2) ? '^' : '_', steel), true;
    if (z < LAMP_TOP - 0.125) return set(i, 'v', steel), true;
    if (lit) BG[i] = C(WARM, 4 + lampsOn * 4);
    return set(i, lit ? '#' : ':', lit ? C(WARM, 15) : C(GRAY, L * 0.7)), true;
  }
  if (z <= LAMP_TOP && z > LAMP_TOP - 0.03 && onLine(lu, du, 0, 0)) return set(i, '|', steel), true; // the drop
  const halo = Math.hypot(lu / 0.075, lz / 0.065);
  if (lit && halo < 1) { BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, " ", 0), true; } // a soft glow round it
  // the pole: a flared base, a collar, a finial on top
  if (z < LAMP_TOP + 0.02 && Math.abs(u) < Math.max(du / 2, z < 0.06 ? 0.03 : 0.012)) {
    if (z < 0.06) return set(i, z < 0.025 ? '#' : 'A', steel), true;
    return set(i, Math.abs(z - 0.42) < Math.max(0.012, dz / 2) ? '=' : '|', steel), true;
  }
  // the swan neck: the upper half of an ellipse from the pole top out to the lantern
  const w = NECK * Math.abs(s);
  if (w > du * 0.3 && z > LAMP_TOP - dz) {
    const ex = (u - NECK * s) / w, ez = (z - LAMP_TOP) / NECK, rho = Math.hypot(ex, ez), tol = Math.max(du / w, dz / NECK) / 2;
    if (Math.abs(rho - 1) < tol && ez > -tol) {
      const ang = Math.atan2(ez, ex), tu = -w * Math.sin(ang) / du, tz = NECK * Math.cos(ang) / dz; // tangent, in cells
      const sl = Math.abs(tz) / (Math.abs(tu) + 1e-9);
      return set(i, sl > 2.5 ? '|' : sl < 0.4 ? '-' : tu * tz > 0 ? '/' : '\\', steel), true; // rising to the right: '/'
    }
  }
  return false;
}

// ---- vehicles as real boxes (see drawBox): a body, a cabin with glass, and whatever goes on the roof.
// Sizes in cells (1 = 10m): [half length, half width, body top, cabin top, cabin half length, cabin offset along]
const VEHICLES = {
  car: [0.21, 0.09, 0.075, 0.13, 0.11, -0.02], taxi: [0.21, 0.09, 0.075, 0.13, 0.11, -0.02],
  police: [0.22, 0.09, 0.075, 0.13, 0.11, -0.02], amb: [0.25, 0.1, 0.15, 0, 0, 0], fire: [0.37, 0.1, 0.14, 0.17, 0.06, 0.29],
};
const shadeFace = f => f === 5 ? 1 : f === 1 || f === 2 ? 0.85 : 0.7; // a little light from above, a little less on the sides
function drawVehicle(m, vx, vy, hx, hy) {
  const [hl, hw, top, cab, chl, cof] = VEHICLES[m.kind], lightsOn = night > 0.4 || overcast > 0.5;
  const braking = m.brake || m.v < 0.05, body = m.body;
  // body: wheels and a dark sill along the bottom, headlights and grille at the front, tail lights at the back
  drawBox(boxAt(vx, vy, hx, hy, hl, hw, 0.012, top), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w, k = shadeFace(f);
    BG[i] = C(body, (1.5 + L * 0.45) * k);
    if (f === 5) return set(i, m.kind === 'amb' && Math.abs(u) < 0.05 && Math.abs(v) < 0.05 ? '+' : ' ', C(RED, 12)), true;
    if (f === 1) return set(i, w < 0.05 && Math.abs(v) > hw * 0.55 ? 'O' : w < 0.04 ? '=' : ' ', w < 0.05 && Math.abs(v) > hw * 0.55 ? C(WHITE, lightsOn ? 15 : 10) : C(GRAY, L * 0.5)), true;
    if (f === 2) return set(i, w < 0.055 && w > 0.03 && Math.abs(v) > hw * 0.55 ? ']' : ' ', C(RED, braking ? 15 : 8)), true;
    if (f === 6) return set(i, ' ', 0), true;
    const wheel = w < 0.035 && Math.min(Math.abs(u - hl * 0.62), Math.abs(u + hl * 0.62)) < 0.04;
    if (wheel) { BG[i] = C(GRAY, 1); return set(i, '@', C(GRAY, L * 0.5)), true; }
    if (w < 0.022) { BG[i] = C(GRAY, 1); return set(i, '_', C(GRAY, L * 0.3)), true; }
    if (m.kind === 'amb' && w > 0.06 && w < 0.13) { // the ambulance's side: windows up front, a red stripe and cross
      if (u > hl * 0.55 && w > 0.09) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, ' ', 0), true; }
      if (Math.abs(w - 0.08) < 0.008) return set(i, '=', C(RED, 13)), true;
      if (Math.abs(u) < 0.03 && w > 0.095) return set(i, '+', C(RED, 14)), true;
    }
    if (m.kind === 'fire' && w > 0.05) return set(i, Math.abs(fract(u * 12) - 0.5) < 0.12 ? '|' : '=', C(GRAY, L * 0.7)), true; // lockers
    return set(i, Math.abs(w - 0.05) < 0.006 ? '-' : ' ', C(body, L * 0.6)), true;
  });
  // cabin: glass all round, pillars at the corners, a roof
  if (cab) drawBox(boxAt(vx + hx * cof, vy + hy * cof, hx, hy, chl, hw * 0.9, top, cab), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    if (f === 5 || f === 6) { BG[i] = C(body, (1.5 + L * 0.45) * shadeFace(f)); return set(i, ' ', 0), true; }
    const edge = f <= 2 ? Math.abs(v) > hw * 0.8 : Math.abs(u - cof) > chl * 0.85;
    if (edge || w > cab - 0.008) { BG[i] = C(body, (1.5 + L * 0.45) * 0.8); return set(i, '|', C(body, L * 0.5)), true; }
    BG[i] = C(CYAN, 1 + L * 0.12); return set(i, ' ', 0), true;
  });
  const roof = cab || top; // what sits on the roof
  if (m.kind === 'taxi') drawBox(boxAt(vx, vy, hx, hy, 0.03, 0.05, roof, roof + 0.02), (i, t, L) => {
    BG[i] = C(YEL, lightsOn ? 13 : 9); return set(i, HIT.face <= 4 ? '=' : ' ', C(GRAY, 3)), true;
  });
  if (m.ev) drawBox(boxAt(vx + hx * (m.kind === 'amb' ? hl * 0.7 : 0), vy + hy * (m.kind === 'amb' ? hl * 0.7 : 0), hx, hy, 0.02, hw * 0.8, roof, roof + 0.015), (i, t, L) => {
    const side = HIT.v > 0 ? RED : BLUE, on = lightsOn_(m) && strobe() === side; // the light bar: red on one side, blue the other
    BG[i] = C(side, on ? 15 : 3); return set(i, on ? '*' : '=', C(on ? WHITE : side, on ? 15 : 7)), true;
  });
  if (m.kind === 'fire') drawBox(boxAt(vx - hx * 0.05, vy - hy * 0.05, hx, hy, 0.28, 0.035, top, top + 0.025), (i, t, L) => {
    BG[i] = C(GRAY, 1 + L * 0.2); return set(i, Math.abs(fract(HIT.u * 30) - 0.5) < 0.2 ? '|' : '=', C(WHITE, L * 0.8)), true; // the ladder
  });
}

// ---- lighthouse island
// the lighthouse, drawn as a billboard (it's round, so it looks the same from every side): a tapering tower in red
// and white bands with a door and slit windows, a railed gallery, the glazed lantern room with the lamp, a red dome.
// flare = how squarely a beam is pointing at you (the lamp blazes)
function lighthouseCell(i, u, z, du, dz, L, flare) {
  const au = Math.abs(u), lit = beamLit();
  if (z < 2.2) {
    const R = 0.24 - z * 0.035;
    if (au > Math.max(R, du / 2)) return false;
    const n = au / R, shade = 1 - 0.55 * n * n;
    if (z < 0.22 && au < 0.055) { BG[i] = C(GRAY, 1); return set(i, z > 0.19 ? '=' : '#', C(BRICK, L * 0.6)), true; } // the door
    if (au < Math.max(0.022, du / 2) && [0.75, 1.25, 1.75].some(w => Math.abs(z - w) < 0.06)) { BG[i] = C(GRAY, 1); return set(i, '#', C(WARM, Math.max(L * 0.3, lit * 9))), true; }
    BG[i] = C(Math.floor(z / 0.44) & 1 ? RED : WHITE, (1.5 + L * 0.5) * shade);
    return set(i, n > 0.85 ? '|' : ' ', C(GRAY, L * 0.5)), true;
  }
  if (z < 2.27) { if (au > 0.3) return false; BG[i] = C(GRAY, 2 + L * 0.2); return set(i, '=', C(WHITE, L)), true; } // the gallery
  if (z < 2.34 && au > 0.15) { // its railing
    if (au > 0.3) return false;
    return fract(u * 25) < 0.35 || z > 2.32 ? (set(i, z > 2.32 ? '-' : '|', C(WHITE, L * 0.9)), true) : false;
  }
  if (z < 2.62) { // the lantern room
    if (au > Math.max(0.15, du / 2)) return false;
    if (lit && au < 0.075 && Math.abs(z - LH_H) < 0.07) { BG[i] = C(YEL, 8 + flare * 7); return set(i, '@', C(WHITE, 15)), true; }
    BG[i] = C(CYAN, 1 + lit * 3); return set(i, fract(u * 14) < 0.2 ? '|' : ' ', C(GRAY, L * 0.8)), true;
  }
  const domeR = 0.17 * Math.sqrt(Math.max(0, 1 - ((z - 2.62) / 0.17) ** 2));
  if (z < 2.79 && au < Math.max(domeR, du / 2)) { BG[i] = C(RED, 2 + L * 0.35); return set(i, ' ', 0), true; }
  if (z < 2.88 && au < Math.max(0.01, du / 2)) return set(i, '|', C(GRAY, L)), true; // the vent and lightning rod
  return false;
}
// the beams: from the lamp out across the bay, a thin shaft of pale light drawn in characters that follow its slope
// on screen (- / \ |), brightest by the lamp and fading out over the water, stronger in rain and fog. Each sample
// along a beam covers the cells it spans (a little wider close up), in front of whatever is behind it.
// Returns how squarely a beam is pointing at you (the lamp flares).
function drawBeams(lx, ly) {
  const lit = beamLit();
  if (!lit) return 0;
  const haze = 0.55 + 0.45 * Math.max(fogAmt, rain), camAng = Math.atan2(-ly, -lx);
  const flare = clamp(1 - beamOff(camAng) / 0.3, 0, 1) * lit;
  for (const side of [0, Math.PI]) {
    const ang = beamAng() + side, cx = Math.cos(ang), cy = Math.sin(ang);
    let prev = null;
    for (let s = 0.3; s < BEAM_LEN; s += 0.12 + s * 0.02) {
      const vx = lx + cx * s, vy = ly + cy * s, depth = dx * vx + dy * vy;
      if (depth < 0.3 || depth > vis + 10) { prev = null; continue; }
      const sc = projX / depth, col = cols / 2 + (-dy * vx + dx * vy) * sc, row = hor - (LH_H - s * 0.012 - eye) * projY / depth;
      const slope = prev ? (row - prev[1]) / ((col - prev[0]) || 1e-6) * (FS / cw) : 0; // in screen units
      const ch = !prev ? '-' : Math.abs(slope) < 0.35 ? '-' : Math.abs(slope) > 2.5 ? '|' : slope < 0 ? '/' : '\\';
      prev = [col, row];
      const w = 0.025 + s * 0.008, rc = Math.min(2, w * sc), rr = Math.min(1, w * projY / depth);
      const I = lit * haze * (1 - s / BEAM_LEN) ** 1.2;
      for (let r = Math.max(0, Math.round(row - rr)); r <= Math.min(rows - 1, Math.round(row + rr)); r++)
        for (let c = Math.max(0, Math.round(col - rc)); c <= Math.min(cols - 1, Math.round(col + rc)); c++) {
          const i = r * cols + c;
          if (ZB[i] < depth) continue;
          const core = Math.abs(r - row) < 0.6 && Math.abs(c - col) < 0.6;
          set(i, core ? (I > 0.5 ? '=' : ch) : ch, C(YEL, 3 + I * (core ? 12 : 7)));
          if (core && s < 3) BG[i] = C(YEL, 2 + I * 4); // the glow right by the lamp
          FOGS[i] = 0;
        }
    }
  }
  return flare;
}
function islandSprites() {
  const [lx, ly] = R(LIGHTHOUSE.x, LIGHTHOUSE.y), D = Math.hypot(lx, ly);
  if (D > vis + BEAM_LEN) return;
  drawFootbridge();
  const flare = drawBeams(lx, ly);
  drawShape(lx, ly, 0, 0.32, 2.9, (i, u, z, du, dz, L) => lighthouseCell(i, u, z, du, dz, L, flare));
  if (flare > 0.05) { // the lamp, blazing straight at you
    const depth = dx * lx + dy * ly;
    if (depth > 0.3) {
      const sc = projX / depth, col = cols / 2 + (-dy * lx + dx * ly) * sc, row = hor - (LH_H - eye) * projY / depth, R_ = 1 + flare * 5;
      for (let r = Math.floor(row - R_ / 2); r <= row + R_ / 2; r++) for (let c = Math.floor(col - R_); c <= col + R_; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const i = r * cols + c, q = Math.hypot((c - col) / R_, (r - row) / (R_ / 2));
        if (q < 1 && ZB[i] >= depth - 0.5) BG[i] = C(YEL, 6 + flare * 9 * (1 - q));
      }
    }
  }
}
// the footbridge's handrails (posts and a top rail, see-through between) in 2-cell lengths, and a gateway at the
// shore end with the island's name across it
const FB_SIGN = 'LIGHTHOUSE';
function drawFootbridge() {
  const rail = (i, t, L) => HIT.w > 0.088 || HIT.face === 5 ? (set(i, '=', C(GRAY, L * 1.1)), true)
                          : fract(HIT.u * 5) < 0.2 ? (set(i, '|', C(GRAY, L * 0.9)), true) : false;
  for (let y = FOOTBRIDGE.y0; y < FOOTBRIDGE.y1; y += 2) {
    const len = Math.min(2, FOOTBRIDGE.y1 - y), [vx, vy] = R(FOOTBRIDGE.x, y + len / 2);
    if (Math.hypot(vx, vy) > vis + 1) continue;
    for (const s of [-1, 1]) drawBox(boxAt(vx + s * (FOOTBRIDGE.hw - 0.006), vy, 0, 1, len / 2, 0.006, 0, 0.1), rail);
  }
  const [gx, gy] = R(FOOTBRIDGE.x, FOOTBRIDGE.y0 + 0.15), hw = FOOTBRIDGE.hw + 0.02;
  if (Math.hypot(gx, gy) > vis) return;
  const iron = (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.1); return set(i, '|', C(GRAY, L)), true; };
  for (const s of [-1, 1]) drawBox(boxAt(gx + s * hw, gy, 1, 0, 0.012, 0.012, 0, 0.36), iron);
  drawBox(boxAt(gx, gy, 1, 0, hw + 0.012, 0.008, 0.3, 0.355), (i, t, L) => { // the sign, readable from both ends
    BG[i] = C(GRAY, 2 + night * 2);
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, '=', C(GRAY, L)), true;
    const n = FB_SIGN.length + 2, q = ((HIT.face === 3 ? HIT.u : -HIT.u) / (hw + 0.012) + 1) / 2 * n - 1, k = Math.floor(q), cellU = t / projX / (2 * hw) * n;
    const on = k >= 0 && k < FB_SIGN.length && (cellU > 0.6 || Math.abs(fract(q) - 0.5) < cellU / 2) && Math.abs(HIT.w - 0.3275) <= t / projY / 2 + 1e-4;
    return set(i, on ? FB_SIGN[k] : ' ', C(WHITE, Math.max(L * 1.2, night * 14))), true;
  });
}

// a vending machine: a lit header, a glass front with shelves of goods, a keypad and coin slot down the right,
// the flap you reach into at the bottom. Glows after dark.
const VM_COL = { DRINKS: RED, SNACKS: BLUE, CIGARETTES: GRAY };
const VM_GOODS = { DRINKS: ['o', [RED, BLUE, GREEN, YEL, WHITE]], SNACKS: ['#', [YEL, ORANGE, RED, GREEN, MAG]], CIGARETTES: ['=', [WHITE, RED, YEL, WHITE, CYAN]] };
function drawVending(m, vx, vy) {
  const body = VM_COL[m.kind], glow = Math.max(night, overcast * 0.6), [g_, cols_] = VM_GOODS[m.kind];
  drawBox(boxAt(vx, vy, m.c, m.s, VM_HL, VM_HW, 0, VM_H), (i, t, L) => {
    const f = HIT.face, front = (f === 3 || f === 4) && Math.sign(HIT.v) === m.fs;
    if (!front) { BG[i] = C(body, (1.5 + L * 0.35) * shadeFace(f)); return set(i, f === 5 ? ' ' : HIT.w < 0.01 ? '_' : ' ', C(GRAY, L * 0.4)), true; }
    const q = (HIT.u * m.fs / VM_HL + 1) / 2, z = HIT.w / VM_H; // across the front 0..1 (left to right), up it 0..1
    if (z > 0.85) { // the lit header, with what it sells across it
      BG[i] = C(body, 5 + glow * 7);
      const name = m.kind, n = name.length + 2, lq = q * n - 1, k = Math.floor(lq), cellU = t / projX / (2 * VM_HL) * n;
      const letter = Math.abs(z - 0.925) < t / projY / VM_H / 2 && k >= 0 && k < name.length && (cellU > 0.6 || Math.abs(fract(lq) - 0.5) < cellU / 2);
      return set(i, letter ? name[k] : ' ', C(WHITE, 15)), true;
    }
    if (q > 0.72) { // the control column: keypad, coin slot
      BG[i] = C(GRAY, 2 + L * 0.1);
      return set(i, z > 0.55 && z < 0.72 ? ':' : z > 0.44 && z < 0.5 ? '-' : ' ', z > 0.5 ? C(WHITE, Math.max(L, glow * 11)) : C(YEL, 12)), true;
    }
    if (z < 0.17) { BG[i] = C(GRAY, 1); return set(i, z > 0.05 && z < 0.12 ? '_' : ' ', C(GRAY, L * 0.5)), true; } // the flap
    if (z < 0.22) { BG[i] = C(body, 1.5 + L * 0.35); return set(i, ' ', 0), true; }
    // the window: four shelves of goods behind glass
    const sz = (z - 0.22) / 0.63 * 4, row = Math.floor(sz), sq = q / 0.72 * 5, k = Math.floor(sq);
    BG[i] = C(CYAN, 1 + glow * 2.5);
    if (fract(sz) < 0.12) return set(i, '_', C(GRAY, Math.max(L * 0.7, glow * 8))), true; // the shelf
    const item = fract(sq) > 0.18 && fract(sq) < 0.82 && fract(sz) < 0.8; // each thing on it, glass between
    if (item) BG[i] = C(cols_[(k + row * 2) % 5], 2 + glow * 3);
    return set(i, item ? g_ : ' ', C(cols_[(k + row * 2) % 5], Math.max(L, glow * 13))), true;
  });
}

// a bench facing (fx, fy): seat, backrest, two legs; s scales it (0.01 outdoors in cells, 1 indoors in metres)
function drawBench(vx, vy, fx, fy, s) {
  const ax = -fy, ay = fx, wood = (i, t, L) => { BG[i] = C(BRICK, (1 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '=' : '-', C(BRICK, L * 0.8)), true; };
  drawBox(boxAt(vx, vy, ax, ay, 7.5 * s, 2 * s, 4 * s, 4.8 * s), wood); // seat
  drawBox(boxAt(vx - fx * 1.9 * s, vy - fy * 1.9 * s, ax, ay, 7.5 * s, 0.4 * s, 4.8 * s, 8.5 * s), wood); // back
  for (const e of [-6, 6]) drawBox(boxAt(vx + ax * e * s, vy + ay * e * s, ax, ay, 0.5 * s, 1.8 * s, 0, 4 * s), (i, t, L) => {
    BG[i] = C(GRAY, 1); return set(i, '|', C(GRAY, L * 0.7)), true;
  });
}

// a subway entrance in 3D: railings round a stairwell cut into the sidewalk (its treads are drawn by floorCell,
// see SUBWAY_HOLE), green globe lamps at the open end, and the station's name on a sign over the far railing
function drawStationEntrance(s, vx, vy) {
  const [hl, hw] = SUBWAY_HOLE, iron = (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, HIT.face === 5 ? '=' : '|', C(GREEN, L * 0.7)), true; };
  for (const side of [-1, 1]) drawBox(boxAt(vx, vy + side * hw, 1, 0, hl, 0.004, 0, 0.09), iron); // the long sides
  drawBox(boxAt(vx + hl, vy, 0, 1, hw, 0.004, 0, 0.09), iron); // the far end
  for (const side of [-1, 1]) { // the lamps either side of the way in
    drawBox(boxAt(vx - hl, vy + side * hw, 1, 0, 0.005, 0.005, 0, 0.13), iron);
    drawBox(boxAt(vx - hl, vy + side * hw, 1, 0, 0.014, 0.014, 0.13, 0.158), (i, t, L) => { BG[i] = C(GREEN, 6 + night * 7); return set(i, 'o', C(WHITE, 15)), true; });
  }
  const name = s.name; // the sign: one letter per cell across its face, so it never smears
  drawBox(boxAt(vx + hl, vy, 0, 1, hw, 0.006, 0.09, 0.125), (i, t, L) => {
    BG[i] = C(GREEN, 4 + night * 3);
    if (HIT.face !== 1 && HIT.face !== 2) return set(i, ' ', 0), true;
    const q = (HIT.u / hw * (HIT.face === 1 ? 1 : -1) + 1) / 2 * (name.length + 2) - 1, k = Math.floor(q);
    const cellU = t / projX / (2 * hw) * (name.length + 2); // how much of one letter a screen cell covers
    return set(i, k >= 0 && k < name.length && (cellU > 0.6 || Math.abs(fract(q) - 0.5) < cellU / 2) ? name[k] : ' ', C(WHITE, 15)), true;
  });
}

// chinatown lanterns: a cord sagging across the street (short box segments) with red paper lanterns hanging off it,
// glowing after dark. Real 3D, so it stays put across the street as you walk round it.
const sagZ = t => 0.5 - 0.06 * (1 - t * t); // t: -1..1 across the street
function drawLanternString(vx, vy, ax, ay) {
  // the cord is thinner than a character cell past a few metres, so it grows to stay one cell thick (a grey dashed
  // line) instead of breaking up into the odd cell the rays happen to hit
  const d = Math.hypot(vx, vy), th = Math.max(0.004, 0.55 * d / projY), tw = Math.max(0.004, 0.55 * d / projX), far = th > 0.01;
  const segs = 8, cord = (i, t, L) => { if (!far) BG[i] = C(GRAY, 1); return set(i, '-', C(GRAY, L * 0.7)), true; };
  for (let k = 0; k < segs; k++) {
    const t0 = -1 + 2 * k / segs, t1 = t0 + 2 / segs, tm = (t0 + t1) / 2, z = (sagZ(t0) + sagZ(t1)) / 2;
    drawBox(boxAt(vx + ax * tm * LANTERN_SPAN, vy + ay * tm * LANTERN_SPAN, ax, ay, LANTERN_SPAN / segs + 0.003, tw, z - th, z + th), cord);
  }
  const lit = Math.max(night, overcast * 0.6);
  for (const t of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const z = sagZ(t), gold = t === 0;
    const lw = Math.max(0.018, tw); // at a distance a lantern stays at least a cell wide too
    drawBox(boxAt(vx + ax * t * LANTERN_SPAN, vy + ay * t * LANTERN_SPAN, ax, ay, lw, lw, z - 0.05, z - 0.006), (i, tt, L) => {
      const cap = HIT.w > z - 0.014 || HIT.w < z - 0.042;
      BG[i] = cap ? C(GRAY, 2) : C(gold ? YEL : RED, 3 + lit * 9 + L * 0.2);
      return set(i, cap ? '=' : lit > 0.3 ? 'o' : ' ', C(YEL, 15)), true;
    });
  }
}

// a factory smokestack: banded brick, red and white at the top, smoke curling off downwind
function stackCell(i, u, z, du, dz, L, s) {
  const H = s.H, w = 0.16 - z / H * 0.05;
  if (z < H && Math.abs(u) < Math.max(w, du / 2)) {
    BG[i] = bgAt(BRICK, day * 2);
    if (z > H - 0.5) return set(i, '=', C(fract(z * 4) < 0.5 ? RED : WHITE, L)), true;
    return set(i, fract(z * 6) < 0.15 ? '=' : '#', C(BRICK, L * 0.9)), true;
  }
  const sz = z - H, cu = u - sz * 0.6 - Math.sin(T * 0.3 + s.x) * 0.1 * sz; // drifts downwind as it rises
  if (sz > 0 && sz < 2 && Math.abs(cu) < 0.15 + sz * 0.25) {
    const n = noise(cu * 4 + T * 0.2, sz * 3 - T * 0.6, 57 + s.x);
    if (n > 0.45 + sz * 0.15) { BG[i] = C(GRAY, (2 + n * 6) * (0.4 + 0.6 * amb) * (1 - sz / 2.2)); return set(i, ' ', 0), true; }
  }
  return false;
}

// the suspension bridges: towers (drawn across the deck, foreshortened when seen from the side), cables as a chain of
// points that light up at night, and the hangers down to the deck
function bridgeSprites() {
  for (const t of towers) {
    const [vx, vy] = R(t.x, t.y);
    if (Math.abs(vx) > vis + 2 || Math.abs(vy) > vis + 2) continue;
    const hw = 0.95 * Math.abs(across(1, 0, vx, vy)) + 0.12;
    drawShape(vx, vy, 0, hw + 0.15, TOWER_H + 0.5, (i, u, z, du, dz, L) => towerCell(i, u, z, du, dz, L, hw));
  }
  forNear(bridgeB, b => {
    const [vx, vy] = R(b.x, b.y);
    if (b.kind === 'hanger') return drawArt(vx, vy, b.z, 0.02, b.h, ['|'], (c, row, L) => C(GRAY, L * 0.7));
    drawArt(vx, vy, b.z - 0.03, 0.06, 0.06, [night > 0.4 ? '*' : '.'], (c, row, L) => night > 0.4 ? C(WARM, 13) : C(GRAY, L * 1.2));
  });
}
function towerCell(i, u, z, du, dz, L, hw) {
  const leg = Math.abs(Math.abs(u) - hw) < Math.max(0.1, du / 2);
  if (z > TOWER_H + 0.35 && Math.abs(Math.abs(u) - hw) < du && night > 0.3) return set(i, '*', C(RED, fract(T * 0.7) < 0.5 ? 15 : 4)), true;
  if (leg && z < TOWER_H + 0.4) { BG[i] = bgAt(GRAY, day * 3); return set(i, fract(z * 3) < 0.1 ? '=' : '|', C(GRAY, L * 1.1)), true; }
  if (Math.abs(u) < hw && [1.2, 4, TOWER_H].some(b => Math.abs(z - b) < Math.max(0.12, dz / 2)))
    return set(i, Math.abs(z - TOWER_H) < 0.12 ? '#' : '=', C(GRAY, L)), true;
  return false;
}

// the el: pillars, stairs at the stations, and the trains (cars drawn one by one, so they foreshorten properly)
function elSprites() {
  forNear(elPillarsB, p => drawArt(...R(p.x, p.y), 0, 0.09, EL_BOT, PILLAR, (c, row, L) => C(GRAY, L * 0.9)));
  for (const s of EL_STATIONS) for (const y of [EL_Y + 0.14, EL_Y + 1.86])
    drawArt(...R(s.x, y), 0, 0.22, EL_BOT - 0.02, EL_STAIRS, (c, row, L) => row === 0 ? C(GREEN, Math.max(L, 12)) : C(GRAY, L));
  for (const t of elTrains(T)) {
    if (mode === 'el' && ride && ride.tr === t.tr && ride.k === t.k) continue; // the one you're on
    for (let j = 0; j < EL_CARS; j++) {
      const [vx, vy] = R(t.x - t.dir * (j - 1) * EL_CAR_LEN, EL_TRACK[t.tr]);
      if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
      const s = Math.abs(across(1, 0, vx, vy)), side = s > 0.3;
      drawArt(vx, vy, EL_TOP, side ? EL_CAR_LEN * s + 0.18 : 0.2, 0.3, side ? ART.elSide : ART.elEnd, (c, row, L) =>
        c === '#' ? C(WARM, Math.max(L * 0.8, night * 14)) : c === 'o' ? C(WHITE, 14) : row === 2 ? C(RED, L) : C(GRAY, L * 1.1));
    }
  }
}
