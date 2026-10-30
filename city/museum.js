// ===== the Glyphport Museum: downtown, across the street from the plaza (world.js puts it up). A grand stone front:
// steps, columns hung with banners, bronze doors, a copper dome. Open 10 to 6, $10 in.
// Inside: the entrance hall with a T. rex skeleton and the gift shop desk; the Egyptian room to the west (a gold
// sarcophagus, the walls covered in hieroglyphs); the picture gallery to the east (every painting generated, so no two
// frames match); and through the arch at the back, the gem room: the Glyphport Star (a diamond the size of your fist)
// and the Equinox Orrery (turn its crank and the year turns) under glass. Every exhibit has a plaque (E).
// After dark it's a job: pick the door lock (L), keep out of the guards' torch beams (crouch and they see less far),
// crack a case (the lock game). That sets off a silent alarm: half a minute, then every cop in town. What you take
// is gone for good: the case stands empty, with a card.
const MUSEUM_W = 26, MUSEUM_H = 18;
let museumStolen = {}; // { diamond: true, orrery: true } once they're gone (kept in the save)

// ---- outside
const MUSEUM_EAVE = 1.32, MUSEUM_RIDGE = 1.75;
function museumRoofHeight(x, y) {
  const gx = rel(x - (MUSEUM.bx * 8 + 5)), gy = rel(y - (MUSEUM.by * 8 + 5));
  if (Math.abs(gx) > 3 || Math.abs(gy) > 3) return 0;
  return MUSEUM_RIDGE - Math.abs(gx) * (MUSEUM_RIDGE - MUSEUM_EAVE) / 3;
}
// Clip the view ray against a triangular prism: two sloping planes, two gables and a bottom.
function museumRoofRay(ox, oy, oz, rx, ry, rz, b) {
  const slope = (MUSEUM_RIDGE - MUSEUM_EAVE) / b.hl;
  let enter = 0, leave = Infinity;
  for (const [nx, ny, nz, limit] of [
    [1, 0, 0, b.x + b.hl], [-1, 0, 0, -b.x + b.hl],
    [0, 1, 0, b.y + b.hw], [0, -1, 0, -b.y + b.hw],
    [0, 0, -1, -b.z0],
    [slope, 0, 1, b.z1 + slope * b.x], [-slope, 0, 1, b.z1 - slope * b.x]
  ]) {
    const distance = limit - nx * ox - ny * oy - nz * oz, velocity = nx * rx + ny * ry + nz * rz;
    if (Math.abs(velocity) < 1e-9) { if (distance < 0) return -1; continue; }
    const t = distance / velocity;
    if (velocity < 0) enter = Math.max(enter, t); else leave = Math.min(leave, t);
    if (enter > leave) return -1;
  }
  return enter > 0 ? enter : -1;
}
function drawMuseumRoof() {
  const x = rel(MUSEUM.bx * 8 + 5 - px), y = rel(MUSEUM.by * 8 + 5 - py);
  if (Math.hypot(x, y) > vis + 5) return;
  drawBox(boxAt(x, y, 1, 0, 3, 3, MUSEUM_EAVE, MUSEUM_RIDGE), (i, t, L) => {
    const screenX = 2 * (i % cols + 0.5) / cols - 1;
    const u = (dx - dy * tf * screenX) * t - x, v = (dy + dx * tf * screenX) * t - y;
    const z = eye + (hor - Math.floor(i / cols) - 0.5) / projY * t;
    const gable = Math.abs(Math.abs(v) - 3) < 0.001;
    if (gable) {
      const rim = z > MUSEUM_RIDGE - Math.abs(u) * (MUSEUM_RIDGE - MUSEUM_EAVE) / 3 - 0.035;
      BG[i] = C(WHITE, 2 + L * 0.18);
      set(i, rim ? (u < 0 ? '/' : '\\') : Math.abs(u) < 0.3 && z < 1.55 && z > 1.38 ? 'o' : ' ', C(rim ? WHITE : YEL, L));
    } else {
      BG[i] = C(GRAY, 1.5 + L * (u < 0 ? 0.14 : 0.09));
      set(i, fract(v * 5) < 0.12 ? '-' : fract(u * 8 + (Math.floor(v * 5) & 1) * 0.5) < 0.08 ? '|' : ' ', C(GRAY, L * 0.7));
    }
    return true;
  }, museumRoofRay);
}
function museumFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), glow = Math.max(night, overcast * 0.5), sgn = Math.sign(u * wc) || 1, c = MUSEUM;
  const y0 = c.by * 8 + 2, a0 = side ? c.bx * 8 + 2 : y0, along = wc - a0, len = 6, sh = SHOP[idx(mx, my)];
  const front = side && Math.abs(rel((my + (rel(py - my) < 0 ? 0 : 1)) - y0)) < 0.01;
  BG[i] = bgAt(WHITE, day * 2.6 * (0.45 + 0.55 * fog) * (side ? 0.75 : 1), d);
  if (h > 2.5) { // the dome: copper gone green, ribbed, a ring of little windows, a lantern on top
    if (z < 2.2) return set(i, fract(z * 9) < 0.12 ? '_' : ' ', C(WHITE, L * 0.6));
    const top = 2.2 + 1.2 * Math.sqrt(Math.max(0, 1 - ((fract((wc - (side ? c.bx * 8 + 4 : y0 + 2)) / 2 + 0.5) - 0.5) * 2) ** 2));
    if (z > top) return set(i, ' ', 0);
    BG[i] = C(GREEN, (1.6 + L * 0.2) * (side ? 0.9 : 0.7));
    if (z > 2.45 && z < 2.6 && fract(wc * 3) < 0.4) { BG[i] = C(YEL, 1 + glow * 5); return set(i, ' ', 0); }
    return set(i, fract(wc * 4) < 0.1 ? '|' : z > top - 0.06 ? '^' : ' ', C(CYAN, L * 0.7));
  }
  if (front && z > 1.18 && z <= 1.32) { // the frieze
    if (wallText(i, u, uStep, z, d, 'GLYPHPORT MUSEUM', sgn * (a0 + len / 2), 1.25, 0.07, 0.08, C(GRAY, 3), C(WHITE, Math.max(L * 0.4, 3)))) return;
    return set(i, fract(z * 30) < 0.15 ? '-' : ' ', C(WHITE, L * 0.8));
  }
  if (z < 1.18) { // the colonnade: steps, eight fluted columns, banners hung between them, the bronze doors
    if (z < 0.08) return set(i, fract(z * 40) < 0.5 ? '=' : '-', C(WHITE, L));
    if (z > 1.1) return set(i, '=', C(WHITE, L * 1.1));
    const fc = fract(along * 1.25);
    if (Math.abs(fc - 0.5) < 0.15) return set(i, Math.abs(fc - 0.5) < 0.05 ? '|' : ':', C(WHITE, L * (1 - Math.abs(fc - 0.5) * 2)));
    if (front && Math.abs(along - len / 2) < 0.35 && z < 0.55) { BG[i] = C(BRICK, 1.5 + glow * 2); return set(i, Math.abs(along - len / 2) < 0.02 ? '|' : '#', C(ORANGE, L * 0.8)); } // the doors
    const bk = Math.floor(along * 1.25);
    if (front && z > 0.62 && z < 1.02 && bk !== 3 && Math.abs(fc) > 0.2 && fract(along * 1.25) > 0.22 && fract(along * 1.25) < 0.78) { // banners: what's on
      const col = [RED, BLUE, MAG, GREEN, RED, BLUE, MAG, GREEN][bk & 7], word = ['T.REX', 'GEMS', 'ART', 'EGYPT'][bk & 3];
      BG[i] = C(col, 2.5 + glow * 2);
      const k = Math.floor((1.0 - z) / 0.08);
      return set(i, word[k] && Math.abs(fract(along * 1.25) - 0.5) < 0.09 ? word[k] : ' ', C(WHITE, 14));
    }
    BG[i] = C(GRAY, 0.5 + glow * 1.5); return set(i, ' ', 0); // shadow behind the columns
  }
  // the upper storey: stone in courses, tall arched windows, dark at night (or lit, if someone's in there who shouldn't be)
  const fu = fract(along * 1.5), fz = fract(z * 2);
  if (fu > 0.3 && fu < 0.7 && fz > 0.25 && fz < 0.9) return set(i, fz > 0.8 ? '^' : ':', C(day > 0.5 ? CYAN : GRAY, L * 0.5));
  void sh;
  return set(i, fract(z * 9) < 0.12 ? '_' : ' ', C(WHITE, L * 0.6));
}

// ---- inside: the walls of each room
const museumWing = (x, y) => y < 9 && x > 7 && x < 18 ? 'gems' : x < 7 ? 'egypt' : x > 18 ? 'gallery' : 'hall';

// ---- the guards: walking set loops; by night each carries a torch, and a beam on the floor shows what it sees
const GUARD_PATHS = [[[3.5, 3], [3.5, 13], [21.5, 13], [21.5, 3], [21.5, 13], [3.5, 13]], // the wings and the hall
  [[9.5, 6.8], [16.5, 6.8], [16.5, 2.2], [9.5, 2.2]]]; // round the cases in the gem room
function guardAt(path, t) { // where along its loop at time t (it walks at a steady pace), and which way it's facing
  const segs = path.map((p, k) => [p, path[(k + 1) % path.length]]), lens = segs.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1])), tot = lens.reduce((a, b) => a + b, 0);
  let s = mod(t * 0.9, tot);
  for (let k = 0; k < segs.length; k++) { if (s <= lens[k]) { const [p, q] = segs[k], f = s / lens[k]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, Math.atan2(q[1] - p[1], q[0] - p[0])]; } s -= lens[k]; }
  return [path[0][0], path[0][1], 0];
}
const museumBlocked = (x, y) => roomAt(Math.floor(x), Math.floor(y)) === '#';
function lineClear(x0, y0, x1, y1) { // nothing but air between: walls stop a torch beam
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25);
  for (let k = 1; k < n; k++) if (museumBlocked(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)) return false;
  return true;
}
const TORCH_LEN = 4.6, TORCH_HALF = 0.42;
function inBeam(g, x, y, len = TORCH_LEN) { // how brightly g's torch lights (x, y): 0 outside it
  const dx_ = x - g.x, dy_ = y - g.y, d = Math.hypot(dx_, dy_);
  if (d > len || d < 0.3) return 0;
  const off = Math.abs(mod(Math.atan2(dy_, dx_) - g.dir + Math.PI, Math.PI * 2) - Math.PI);
  if (off > TORCH_HALF || !lineClear(g.x, g.y, x, y)) return 0;
  return (1 - d / len) * (1 - off / TORCH_HALF * 0.6);
}
// what the torches light at height z: the floor gets the whole wedge; a wall or an exhibit gets a pool round where the
// beam (held at 1.2m, angled down) meets it, wider the further it's gone. You're in the way of it too: your shadow
// falls behind you, the shape of you, bigger the nearer you are to the torch
const TORCH_Z = 1.2;
function torchAt(x, y, z) {
  let best = 0;
  for (const g of room.props) {
    if (!g.guard) continue;
    let b = inBeam(g, x, y);
    if (!b) continue;
    const D = Math.hypot(x - g.x, y - g.y);
    if (z > 0.05) { // (a wall stays brighter further off than the floor does: the beam meets it square on)
      b *= (1 - (D / TORCH_LEN) ** 3) / Math.max(0.05, 1 - D / TORCH_LEN);
      const zc = TORCH_Z - D * 0.2, hh = D * 0.42 + 0.12, v = 1 - ((z - zc) / hh) ** 2; if (v <= 0) continue; b *= Math.sqrt(v); }
    if (b > best && !torchShadow(g, x, y, z, D)) best = b;
  }
  return best;
}
function torchShadow(g, x, y, z, D) { // is your body between g's torch and (x, y, z)?
  const vx = (x - g.x) / D, vy = (y - g.y) / D, ox = px - g.x, oy = py - g.y, s = ox * vx + oy * vy;
  if (s < 0.25 || s > D - 0.15) return false;
  const h = TORCH_Z + (z - TORCH_Z) * s / D, top = 1.78 - body.crouch * 0.7; // how high the ray is as it passes you
  if (h < 0 || h > top) return false;
  return Math.abs(ox * vy - oy * vx) < (h > top - 0.27 ? 0.11 : h > top - 0.55 ? 0.24 : 0.17); // head, shoulders, the rest
}
// after everything's drawn: each cell's own world point (from its depth), lit up where a beam lands on it, the colours
// the dark was hiding coming back. The floor already did its own
function museumTorchFx() {
  if (!room.burgled) return;
  for (let c = 0; c < cols; c++) {
    const cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
    for (let r = 0; r < rows; r++) {
      const i = r * cols + c, t = ZB[i];
      if (t < 0.05 || t > vis) continue;
      const z = eye + t * (hor - r - 0.5) / projY;
      if (z < 0.05 || z > 3.9) continue;
      const b = torchAt(px + rx * t, py + ry * t, z);
      if (!b) continue;
      const bg = BG[i], hue = bg >> 4;
      COL[i] = C(COL[i] >> 4, Math.max(COL[i] & 15, 5) + b * 10);
      if (b < 0.1) continue; // the pool's soft edge: only the marks on the wall catch it
      BG[i] = bg === NONE || hue === GRAY || hue === WHITE ? C(YEL, 1.5 + b * 7) : C(hue, (bg & 15) + 2 + b * 8); // plain stone goes torch-yellow
    }
  }
}
// something solid and tall enough between g and you (a case, the sarcophagus, the desk) hides you: anything over your
// shoulders standing, over waist height crouched. (Only for being seen: the beam on the floor still runs through.)
function hiddenBehind(g) {
  const top = body.crouch > 0.5 ? 0.8 : 1.4, n = Math.ceil(Math.hypot(px - g.x, py - g.y) / 0.1);
  for (const p of room.props) {
    const b = p.box; if (!b || p.exhibit || b.z1 < top) continue; // (not the glass: they see straight through that)
    for (let k = 1; k < n; k++) {
      const qx = g.x + (px - g.x) * k / n - b.x, qy = g.y + (py - g.y) * k / n - b.y;
      if (Math.abs(qx * b.c + qy * b.s) < b.hl && Math.abs(-qx * b.s + qy * b.c) < b.hw) return true;
    }
  }
  return false;
}
// a guard's spotted you once you've stood in a beam a moment (crouched, the beam has to be nearer to catch you)
function stepMuseum(dt) {
  if (mode !== 'room' || (room.kind !== 'museum' && room.kind !== 'grandhotelheist') || !room.burgled || game) return;
  const len = body.crouch > 0.5 ? TORCH_LEN * 0.6 : TORCH_LEN;
  const seen = room.props.some(g => g.guard && inBeam(g, px, py, len) > 0 && !hiddenBehind(g));
  room.spot = clamp((room.spot || 0) + (seen ? dt * 1.6 : -dt), 0, 1);
  if (seen && room.spot > 0.2 && !room.warned && !room.alarm) { room.warned = true; say('A torch beam swings across you. "...Hello?"', 2); if (actx) playClip('guard-hello', 0.55); }
  if (!seen && room.spot === 0) room.warned = false;
  if (room.spot >= 1 && !room.alarm) museumAlarm('"HEY! STOP RIGHT THERE!" The guard hits the alarm. Every cop in town is coming: RUN.');
  if (room.silent && T > room.silent && !room.alarm) museumAlarm('The silent alarm\'s done its job: sirens outside, getting closer. Get out, NOW.');
}
function museumAlarm(line) {
  room.alarm = true;
  if (room.kind === 'grandhotelheist') hotelAlarm = null;
  addWanted('heist', room.ret[0], room.ret[1], true);
  if (actx) { const at = actx.currentTime; for (let k = 0; k < 30; k++) tone(at + k * 0.11, k & 1 ? 1800 : 2400, 0.09, 0.05, 'square'); }
  say(line, 5);
}

// ---- what's on show: the plaques, and the two cases
const CASES = [{ id: 'diamond', x: 10.5, y: 4.3, plaque: 'THE GLYPHPORT STAR. Forty carats, found inside a cod at the fish market in 1887. Insured for more than this building is worth.' },
  { id: 'orrery', x: 15.5, y: 4.3, plaque: 'THE EQUINOX ORRERY. Brass and glass, maker unknown. The story goes that turning its crank turns the year. Please do not turn the crank.' }];
const PLAQUES = [
  [12.5, 13.2, 2.6, 'TYRANNOSAURUS GLYPHUS. Dug out of the cliffs under the lighthouse in 1911. Its arms were too short to hold this plaque, so we did.'],
  [3.5, 6.6, 1.6, 'THE SARCOPHAGUS OF ANKH-ASCII, a scribe who wrote everything in fixed-width. Please do not knock. We mean it.'],
  [5.5, 2.4, 1.3, 'ANUBIS, guardian of the dead and of the gift shop. He sees you.'],
  [21.5, 8, 4, 'THE GALLERY. Every painting here was made by a machine, and no two are ever the same. Neither are the critics.'],
];
function museumSpot() {
  if (mode !== 'room' || room.kind !== 'museum') return null;
  for (const c of CASES) if (Math.hypot(px - c.x, py - c.y) < 1.4) return { case: c };
  for (const [x, y, r, text] of PLAQUES) if (Math.hypot(px - x, py - y) < r) return { text };
  return null;
}
function museumPrompt() {
  const sp = museumSpot();
  if (!sp) return room.burgled ? (room.alarm ? 'ALARM! Get out!' : room.silent ? `Silent alarm: ${Math.max(0, Math.ceil(room.silent - T))}s` : 'Keep out of the torch beams (C: crouch)') : '';
  if (sp.case) { const gone = museumStolen[sp.case.id]; return gone ? 'An empty case' : room.burgled ? `E: crack the case (${ITEMS[sp.case.id].name})` : 'E: read the plaque'; }
  return 'E: read the plaque';
}
function museumUse() {
  const sp = museumSpot();
  if (!sp) return false;
  if (sp.text) return say(sp.text, 6), true;
  const c = sp.case;
  if (museumStolen[c.id]) return say(`An empty case. A card in it: "${c.id === 'diamond' ? 'The Glyphport Star' : 'The Equinox Orrery'} is away for... cleaning." The police tape says otherwise.`, 5), true;
  if (!room.burgled) return say(c.plaque, 6), true;
  if (inv.length >= INV_SIZE) return say('Your bag is full.'), true;
  startCrime('lockpick', ok => {
    if (ok === 'abort') return;
    if (!ok) return museumAlarm('The pick slips, the glass cracks, and every alarm in the building goes off. RUN.');
    museumStolen[c.id] = true; carryItem({ id: c.id, uses: 0 });
    room.props = room.props.filter(p => p.exhibit !== c.id);
    if (!room.silent && !room.alarm) room.silent = T + 30;
    say(`The case clicks open. ${c.id === 'diamond' ? 'The Glyphport Star' : 'The Equinox Orrery'} is yours. A tiny red light starts blinking: you have half a minute.`, 5);
  });
  return true;
}

// ---- the room
const museumGrid = () => {
  const extra = {};
  for (let y = 1; y < MUSEUM_H - 1; y++) for (const x of [7, 18]) if (y < 11 || y > 14) extra[x + ',' + y] = '#'; // the wings' walls, an opening into each
  for (let x = 8; x < 18; x++) if (x < 12 || x > 13) extra[x + ',9'] = '#'; // the gem room's wall, the arch in the middle
  return boxRoom(MUSEUM_W, MUSEUM_H, extra);
};
ROOM_DEFS.museum = { grid: museumGrid(), light: 1, height: 4, floor: 'museum', ceil: 'strip', fx: museumTorchFx, keeper: [20.5, 15.4], spawn: [12.5, 16.2],
  props: r => {
    const p = [...counterBox(20.5, 15.9, 1.6), standing(20.5, 15.4, MAG)]; // the ticket desk and gift shop, by the door
    p.push(MUSEUM_TREX(12.5, 12), MUSEUM_SARCOPHAGUS(3.5, 6), MUSEUM_ANUBIS(5.5, 1.3));
    for (const c of CASES) { // the gem room's cases: a pedestal, the glass, what's in it, velvet ropes round it
      p.push(MUSEUM_PEDESTAL(c.x, c.y), MUSEUM_ROPES(c.x, c.y));
      if (museumStolen[c.id]) { p.push(MUSEUM_STOLEN_CARD(c.x, c.y)); continue; }
      p.push(MUSEUM_CASE_GLASS(c.x, c.y, c.id), c.id === 'diamond' ? MUSEUM_STAR(c.x, c.y, c.id) : MUSEUM_ORRERY(c.x, c.y, c.id));
    }
    if (r.burgled) { // after dark: two guards with torches, walking their rounds
      GUARD_PATHS.forEach((path, k) => p.push({ ...figProp(path[0][0], path[0][1], figGuardLook(k), { h: 1.8, chat: false, light: 5 }), guard: true, dir: 0,
        tick: s => { [s.x, s.y, s.dir] = guardAt(path, T + k * 7); } }));
      return p;
    }
    // by day: visitors wandering, a guard on each door of the gem room
    for (let k = 0; k < 7; k++) {
      const x0 = [3.5, 12, 21.5, 9, 16, 4, 21][k], y0 = [10, 15, 10, 6, 6, 4, 4][k], sp = 0.12 + (k % 3) * 0.05;
      p.push({ ...standing(x0, y0, [RED, BLUE, GREEN, YEL, WHITE, ORANGE, CYAN][k]), tick: s => { s.x = x0 + Math.sin(T * sp + k) * 1.2; s.y = y0 + Math.cos(T * sp * 0.8 + k) * 0.6; } });
    }
    p.push({ ...figProp(11.2, 10.2, figGuardLook(7), { h: 1.8, chat: false, pose: 'ease' }), guard: false });
    return p;
  } };
ROOM_FOR.MUSEUM = 'museum';
