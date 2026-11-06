// ===== the Yards ground (STADIUM_PLAN.md): an old-school football ground. Four separate stands round a full-size pitch:
// the tall main stand down the north side, the east and south stands, and a standing terrace behind the west goal,
// each with a pitched roof on steel columns; four floodlight pylons in the corners; a scoreboard over the south stand.
// The match itself is the engine's (match-engine.js), played out by real figures on the grass. Room units: metres,
// x east along the pitch, y south across it; the floor rises up the stands (stadiumRise, through stairRise).
const STADIUM = { W: 150, H: 114, cx: 75, cy: 57, hl: 52.5, hw: 34, runoff: 5.5, board: 3.2 };
// the stands: which side, where the front row is, how many rows, how deep and how high each, along which span
const STANDS = [
  { id: 'north', axis: 'y', front: 18.8, out: -1, rows: 20, depth: .85, rise: .46, a0: 14, a1: 136, roof: 13.2, seats: true, home: .7 },
  { id: 'south', axis: 'y', front: 95.4, out: 1, rows: 16, depth: .85, rise: .42, a0: 20, a1: 130, roof: 11.4, seats: true, home: .55 },
  { id: 'east', axis: 'x', front: 133.4, out: 1, rows: 14, depth: .85, rise: .4, a0: 22, a1: 92, roof: 10.4, seats: true, home: .2 }, // (the away end)
  { id: 'west', axis: 'x', front: 16.6, out: -1, rows: 18, depth: .6, rise: .28, a0: 22, a1: 92, roof: 9.4, seats: false, home: .95 }, // (the terrace: standing)
];
const standOf = (x, y) => {
  for (const s of STANDS) {
    const a = s.axis === 'y' ? x : y, back = (s.axis === 'y' ? y : x) - s.front;
    const k = Math.floor(back * s.out / s.depth);
    if (a >= s.a0 && a <= s.a1 && k >= 0 && k < s.rows) return { s, k };
  }
  return null;
};
// how high the floor is here: up a row of the stand for every row back
function stadiumRise(x, y) { const at = standOf(x, y); return at ? (at.k + 1) * at.s.rise : 0; }
const pitchX = x => STADIUM.cx + x, pitchY = y => STADIUM.cy + y; // (the engine's pitch to the room)

// how far a point on the pitch (folded into one quarter: ax, ay >= 0) is from the nearest marking, in metres
function pitchMarkDist(ax, ay, lx, ly) {
  const P = MatchEngine.PITCH, seg = (v, c, lo, hi, w) => w < lo ? Math.hypot(Math.abs(v - c), lo - w) : w > hi ? Math.hypot(Math.abs(v - c), w - hi) : Math.abs(v - c);
  const spotX = P.hl - P.spot, r = Math.hypot(lx, ly), toSpot = Math.hypot(ax - spotX, ay);
  return Math.min(
    seg(ax, P.hl, 0, P.hw, ay), seg(ay, P.hw, 0, P.hl, ax), seg(ax, 0, 0, P.hw, ay), // goal line, touchline, halfway
    Math.abs(r - P.circle), Math.max(0, r - .15), // the centre circle and spot
    seg(ax, P.hl - P.boxD, 0, P.boxHW, ay), seg(ay, P.boxHW, P.hl - P.boxD, P.hl, ax), // the penalty box
    seg(ax, P.hl - P.sixD, 0, P.sixHW, ay), seg(ay, P.sixHW, P.hl - P.sixD, P.hl, ax), // the six-yard box
    ax < P.hl - P.boxD ? Math.abs(toSpot - P.circle) : 1e3, Math.max(0, toSpot - .15), // the arc, the penalty spot
    Math.abs(Math.hypot(P.hl - ax, P.hw - ay) - 1)); // the corner arcs
}
// the pitch: mown in stripes across it, the markings in white, filtered to the cell's footprint; the run-off a darker,
// worn green; the cinder track by the boards
ROOM_FLOORS.pitch = (i, f, wx, wy, r, x, L) => {
  const fp = homeBalconyPavingFootprint(eye * projY / Math.max(.5, r - hor + .5), eye), lx = wx - STADIUM.cx, ly = wy - STADIUM.cy;
  const P = MatchEngine.PITCH, ax = Math.abs(lx), ay = Math.abs(ly), lw = .12;
  const inside = ax <= P.hl + .06 && ay <= P.hw + .06;
  const lit = night > .3 ? .92 : 1; // (evenly lit: by day the sun, after dark the floodlights)
  if (!inside) { // the run-off and the track
    const track = ax > P.hl + STADIUM.runoff - 1.4 || ay > P.hw + STADIUM.runoff - 1.4;
    BG[i] = track ? C(BRICK, 2.6 * lit) : C(GREEN, 2.7 * lit); return set(i, ' ', 0);
  }
  const stripe = Math.floor((lx + P.hl) / 5.25) & 1;
  // the markings: how far this point is from the nearest line, and how much of the cell a 12cm line would cover
  // its width on screen: across the line, how much grass one character covers (a lot in depth, little sideways), so a
  // line's always at least a character wide and never more, whichever way it runs
  const md = (x, y) => pitchMarkDist(Math.abs(x), Math.abs(y), x, y), d = md(lx, ly), e = .05;
  const gx = (md(lx + e, ly) - md(lx - e, ly)) / (2 * e), gy = (md(lx, ly + e) - md(lx, ly - e)) / (2 * e);
  const dist = Math.hypot(wx - px, wy - py), fpDep = dist * dist / (eye * projY), fpLat = dist / projX, ca = Math.cos(a), sa = Math.sin(a);
  const across = Math.max(.01, Math.abs(gx * ca + gy * sa) * fpDep + Math.abs(-gx * sa + gy * ca) * fpLat);
  const cover = d < .06 ? 1 : clamp(1 - (d - .06) / (across * .7), 0, 1);
  const wear = ax > P.hl - 7 && ay < 6 ? .35 * (1 - ax / P.hl) : 0; // (the goalmouths, worn)
  const grass = (stripe ? 4.6 : 3.6) * lit + (hash(Math.floor(wx * 6), Math.floor(wy * 6), 2202) - .5) * .4 * clamp(1 - fp / .1, 0, 1);
  if (cover > .45) BG[i] = C(WHITE, (9 + cover * 4) * lit); // (the line)
  else BG[i] = C(wear > .1 && hash(Math.floor(wx * 3), Math.floor(wy * 3), 2201) > .6 ? BRICK : GREEN, grass + cover * 4);
  return set(i, ' ', 0);
};
// the sky over the open ground (and, round the stands' backs, above the outer walls): the floodlights' glow at night
const stadiumSky = (wx, wy) => night > .5 ? C(BLUE, 1.4) : consSky();
ROOM_CEILS.sky = (i, r, x, wx, wy) => { BG[i] = stadiumSky(wx, wy); set(i, ' ', 0); };
// the outer walls: the back of each stand, brick and corrugated sheeting, EXIT signs at the gangways; open sky above
function stadiumWall(i, u, uStep, z, d, mx, my, L) {
  set(i, ' ', 0);
  if (z > 15) { BG[i] = stadiumSky(); return true; }
  if (z > 11.5) { BG[i] = C(GRAY, (1.6 + L * .12) - (fract(u * 4) < .1 ? .5 : 0)); return true; } // the sheeting, ribbed
  if (z < 2.4 && Math.abs(fract(u / 24) - .5) < .04) { if (wallText(i, u, uStep, z, d, 'EXIT', Math.floor(u / 24) * 24 + 12, 2.1, .12, .2, C(GREEN, 12), C(GRAY, 1))) return true; }
  BG[i] = C(BRICK, (1.6 + L * .18) - Math.max(coveGroove(z, .075, .008, d / projY), coveGroove(u + (Math.floor(z / .075) & 1) * .11, .22, .008, uStep)) * .6);
  return true;
}
// a supporter's colours: the home end in the home side's kit, the away end in the away side's
const STADIUM_KIT = { RED, WHITE, BLUE, GREEN, YEL, BRICK, CYAN, MAG, GRAY };
const kitCol = (name, lvl) => C(STADIUM_KIT[name] ?? GRAY, lvl);

// the stands as models: a tier of concrete for every row (walked on: its top is the floor), a strip of supporters
// sitting or standing along each, a roof on columns over the lot, railings at the front
function standProps(s, r) {
  const out = [], P = MatchEngine.PITCH, rows = s.rows, along = s.axis === 'y', mid = (s.a0 + s.a1) / 2, half = (s.a1 - s.a0) / 2;
  const box = (a, b, ha, hb, z0, z1, shade, extra = {}) => along ? { ...BX(a, b, ha, hb, z0, z1, shade), ...extra } : { ...BX(b, a, hb, ha, z0, z1, shade), ...extra };
  for (let k = 0; k < rows; k++) {
    const b0 = s.front + s.out * k * s.depth, b1 = b0 + s.out * s.depth, bc = (b0 + b1) / 2, top = (k + 1) * s.rise;
    out.push(box(mid, bc, half, s.depth / 2, 0, top, (i, t, L) => { // the tier: its tread (a seat back along it on a seated stand), its riser
      const f = HIT.face, isTop = f === 5, u = along ? HIT.u : HIT.v;
      if (isTop && s.seats) { const seat = fract(u / SEAT_PITCH); BG[i] = C(s.home > .5 ? RED : BLUE, (seat < .15 ? .8 : 1.6) + L * .1); return set(i, ' ', 0), true; }
      BG[i] = C(GRAY, (isTop ? 2.4 : 1.7 * shadeFace(f)) + L * .15 - (isTop && fract(u / 4) < .02 ? .5 : 0)); return set(i, ' ', 0), true;
    }, { walk: true }));
    // the supporters along the row: a seat every half metre, most of them taken, everyone facing the pitch
    out.push(box(mid, bc + s.out * s.depth * .15, half, s.depth * .3, top, top + (s.seats ? 1.1 : 1.65), (i, t, L) => crowdShade(i, t, L, s, k, along ? HIT.u : HIT.v), { walk: true }));
    if (s.seats && along) out.push({ x: mid, y: bc, seatRow: { x0: s.a0 + .5, x1: s.a1 - .5, y: bc, fx: 0, fy: -s.out, h: .45 } }); // (a seat anywhere along the row: sit down with C)
  }
  // the barrier and the boards at the front, the roof over the back on its columns
  const back = s.front + s.out * rows * s.depth, roofIn = s.front - s.out * 1.2, roofC = (back + roofIn) / 2, roofH = Math.abs(back - roofIn) / 2;
  out.push(box(mid, s.front - s.out * .1, half, .06, 0, 1.05, solid(GRAY, { bright: .9 })));
  out.push(box(mid, roofC, half + .5, roofH, s.roof, s.roof + .35, (i, t, L) => { // the roof: corrugated underneath, lit by a row of lamps
    const u = along ? HIT.u : HIT.v, lamp = HIT.face === 6 && Math.abs(fract(u / 6) - .5) < .04 && Math.abs((along ? HIT.v : HIT.u)) < roofH * .3;
    BG[i] = lamp ? C(WHITE, night > .3 ? 13 : 4) : C(GRAY, HIT.face === 6 ? 1.1 - (fract(u * 3) < .15 ? .3 : 0) : 2.2 * shadeFace(HIT.face) + L * .2); return set(i, ' ', 0), true;
  }));
  for (const f of [.04, .3, .7, .96]) out.push(box(s.a0 + (s.a1 - s.a0) * f, roofIn + s.out * .2, .12, .12, 0, s.roof, solid(GRAY, { bright: 1.1 }))); // (columns: in somebody's way, but not the halfway line's)
  return out;
}
// the crowd along a row: a head, a shirt in their side's colours, sometimes a scarf; an empty seat here and there;
// on their feet when their side scores, arms up
const SEAT_PITCH = .65; // (a seat every 65cm along a row: room between neighbours)
function crowdShade(i, t, L, s, k, u) {
  const m = stadiumMatch, seat = Math.floor(u / SEAT_PITCH), h = hash(seat, k, s.id.length * 31 + 2203), fill = m ? m.crowd : .8;
  if (h > fill) return false; // (an empty seat: you see it, or the row behind)
  const sx = s.axis === 'y' ? s.a0 + (s.a1 - s.a0) / 2 + u : 0, sy = s.front + s.out * (k + .5) * s.depth;
  if (s.axis === 'y' && Math.abs(sx - px) < .8 && Math.abs(sy - py) < .5) return false; // (the seat you're in, and the ones either side, are yours)
  if (crowdNear(s, k, seat)) return false; // (close by: drawn as people, nearCrowdProp)
  const homeFan = hash(seat, k, 2204) < s.home, side = homeFan ? 0 : 1, team = m?.teams[side], kit = team ? team.kit : ['RED', 'WHITE'];
  const cheering = stadiumCheers(m) === side, standing = !s.seats || cheering || (m && m.phase === 'play' && m.danger > .6 && homeFan === (m.ball.lastTouch?.team.side === 0));
  const zIn = HIT.w - (k + 1) * s.rise, tall = standing ? 1.55 : 1.05, w = (fract(u / SEAT_PITCH) - .5) * SEAT_PITCH / .5; // (w: across the seat, in half-metres from its middle)
  if (HIT.face === 5) { // seen from above (the rows below you): the tops of heads, shoulders either side
    const across = Math.abs((s.axis === 'y' ? HIT.v : HIT.u)) / (s.depth * .3);
    if (Math.abs(w) > .34 || across > .9) return false;
    const hair = Math.abs(w) < .13 && across < .5;
    BG[i] = hair ? C(hash(seat, k, 2209) > .7 ? BRICK : GRAY, hash(seat, k, 2209) > .7 ? 4 : 1.6) : kitCol(kit[hash(seat, k, 2208) > .8 ? 1 : 0], 5 * (.55 + L * .03)); return set(i, ' ', 0), true;
  }
  const arms = cheering && zIn > tall && zIn < tall + .45 && Math.abs(Math.abs(w) - .3) < .08 && fract(T * 2 + h * 7) < .8;
  if (zIn > tall + (arms ? .45 : 0) || Math.abs(w) > .36) return false;
  if (arms) { BG[i] = C(SKIN, 9 + L * .1); return set(i, ' ', 0), true; }
  const head = zIn > tall - .24 && Math.abs(w) < .14;
  if (zIn > tall - .24 && !head) return false;
  const skin = [[SKIN, 12], [SKIN, 10], [BRICK, 7], [BRICK, 5]][Math.floor(hash(seat, k, 2205) * 4)];
  if (head) { BG[i] = zIn > tall - .06 && hash(seat, k, 2206) > .4 ? C(GRAY, 2) : C(skin[0], skin[1] * (.55 + L * .03)); return set(i, ' ', 0), true; }
  const scarf = zIn > tall - .38 && hash(seat, k, 2207) > .6, colour = hash(seat, k, 2208) > .8 ? 1 : 0;
  BG[i] = kitCol(scarf ? kit[1] : kit[colour], (scarf ? 7 : 5.5) * (.55 + L * .03) - (zIn < .35 ? 1.5 : 0)); return set(i, ' ', 0), true;
}
// which side's fans are up celebrating (-1: nobody's): a goal, a penalty in the shootout, the shootout won
const stadiumCheers = m => !m ? -1 : m.phase === 'goal' ? m.celebrate?.side ?? -1
  : m.phase === 'pens' ? (m.shoot.step === 'after' && m.shoot.last ? (m.shoot.last.scored ? m.shoot.last.side : 1 - m.shoot.last.side) : -1)
  : m.phase === 'ft' && m.pens && m.t - m.shoot.last.t < 20 ? (m.pens[0] > m.pens[1] ? 0 : 1) : -1;
// the supporters close round you: real people, sat on the row or up on their feet, in their side's colours. Further
// off the strip above stands in for them (it leaves out these seats, so nobody is drawn twice)
const CROWD_NEAR = 6.5, CROWD_H = 1.6; // (a touch under full height: sat down, the heads in front sit below your eyes)
const seatAt = (s, k, seat) => { const a = (s.a0 + s.a1) / 2 + (seat + .5) * SEAT_PITCH, b = s.front + s.out * (k + .5 + .15) * s.depth; return s.axis === 'y' ? [a, b] : [b, a]; };
const crowdNear = (s, k, seat) => { const [x, y] = seatAt(s, k, seat); return (x - px) ** 2 + (y - py) ** 2 < CROWD_NEAR * CROWD_NEAR; };
const crowdLooks = new Map();
function crowdLook(s, k, seat, kit, side) {
  const key = `${s.id}:${k}:${seat}:${kit.join()}`;
  let look = crowdLooks.get(key);
  if (look) return look;
  if (crowdLooks.size > 600) crowdLooks.clear();
  const h = j => hash(seat, k, 2210 + j), of = (a, j) => a[Math.floor(h(j) * a.length)], main = kit[h(1) > .8 ? 1 : 0], other = kit[main === kit[0] ? 1 : 0];
  const top = of(['tee', 'tee', 'long', 'jacket', 'long'], 2), hat = h(3) < .18 ? 'beanie' : h(3) < .26 ? 'cap' : null;
  look = figLook({ hair: of(['short', 'short', 'buzz', 'long', 'bob', 'bald', 'pony', 'afro'], 4), hat, top, bot: 'pants', bw: [.95, 1, 1.1, 1.2][Math.floor(h(5) * 4)],
    col: { hair: of(FIG_HAIRS, 6), skin: of(FIG_SKINS, 7), top: [STADIUM_KIT[main] ?? GRAY, main === 'WHITE' ? 12 : 9], inner: [STADIUM_KIT[other] ?? WHITE, 11],
           bot: h(8) < .6 ? [BLUE, 5] : [GRAY, 3], hat: [STADIUM_KIT[other] ?? GRAY, 9], hatD: [STADIUM_KIT[other] ?? GRAY, 6], shoe: of(FIG_SHOES, 9) } });
  crowdLooks.set(key, look);
  return look;
}
// a plastic tip-up seat on its row, facing (fx, fy): the pan they sit on and the back behind them
function tipUpSeat(rx, ry, z0, fx, fy, col) {
  const shade = (i, t, L) => { BG[i] = C(col, (HIT.face === 5 ? 4.2 : 3.2 * shadeFace(HIT.face)) + L * .15); return set(i, ' ', 0), true; };
  drawBox(boxAt(rx + fx * .02, ry + fy * .02, fy ? 1 : 0, fy ? 0 : 1, .25, .2, z0 + .36, z0 + .42), shade);
  drawBox(boxAt(rx - fx * .21, ry - fy * .21, fy ? 1 : 0, fy ? 0 : 1, .25, .03, z0 + .42, z0 + .82), shade);
  drawBox(boxAt(rx + fx * .02, ry + fy * .02, fy ? 1 : 0, fy ? 0 : 1, .04, .04, z0, z0 + .36), solid(GRAY));
}
const nearCrowdProp = () => ({ get x() { return px; }, get y() { return py; }, radius: CROWD_NEAR + 1, draw: () => {
  const m = stadiumMatch, fill = m ? m.crowd : .8;
  for (const s of STANDS) {
    const along = s.axis === 'y', across = along ? py : px, alongMe = (along ? px : py) - (s.a0 + s.a1) / 2;
    const k0 = Math.max(0, Math.floor((across - s.front) * s.out / s.depth - CROWD_NEAR / s.depth)), k1 = Math.min(s.rows - 1, Math.ceil((across - s.front) * s.out / s.depth + CROWD_NEAR / s.depth));
    const half = (s.a1 - s.a0) / 2 / SEAT_PITCH;
    for (let k = k0; k <= k1; k++) {
      const z0 = (k + 1) * s.rise;
      for (let seat = Math.max(-Math.floor(half), Math.floor((alongMe - CROWD_NEAR) / SEAT_PITCH)); seat <= Math.min(Math.ceil(half) - 1, Math.ceil((alongMe + CROWD_NEAR) / SEAT_PITCH)); seat++) {
        if (!crowdNear(s, k, seat)) continue;
        const [x, y] = seatAt(s, k, seat), rx = x - px, ry = y - py;
        if (!inView(rx, ry, 1)) continue;
        if (s.seats) tipUpSeat(rx, ry, z0, along ? 0 : -s.out, along ? -s.out : 0, s.home > .5 ? RED : BLUE);
        const hs = hash(seat, k, s.id.length * 31 + 2203); if (hs > fill) continue;
        if (Math.abs(x - px) < .8 && Math.abs(y - py) < .5) continue; // (your seat, and the ones either side)
        const homeFan = hash(seat, k, 2204) < s.home, side = homeFan ? 0 : 1, team = m?.teams[side], kit = team ? team.kit : ['RED', 'WHITE'];
        const cheers = stadiumCheers(m), cheering = cheers === side, gutted = cheers === 1 - side;
        const up = !s.seats || cheering || (m && m.phase === 'play' && m.danger > .6 && homeFan === (m.ball.lastTouch?.team.side === 0));
        const fx = along ? 0 : -s.out, fy = along ? -s.out : 0, look = crowdLook(s, k, seat, kit, side);
        const pose = cheering && fract(T * 2 + hs * 7) < .8 ? 'cheer' : gutted && !s.seats && hs < fill * .4 ? 'dejected' : up ? 'stand' : 'sit' + Math.round(.42 / (CROWD_H / FIG_TALL));
        drawFigure(rx, ry, z0, CROWD_H, fx, fy, look, pose);
      }
    }
  }
} });
// a floodlight pylon in a corner: a lattice mast and a bank of lamps on top, blazing after dark
const floodlight = (x, y) => ({ x, y, radius: 4, draw: (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .45, .45, 0, 34), (i, t, L) => { const lat = Math.abs(fract(HIT.w / 1.2 + (HIT.u + HIT.v) * .9) - .5) < .12; BG[i] = C(GRAY, (lat ? 2.6 : 1.4) + L * .15); return set(i, ' ', 0), true; });
  const ax = STADIUM.cx - x, ay = STADIUM.cy - y, d = Math.hypot(ax, ay), c = ax / d, s = ay / d;
  drawBox(boxAt(vx + c * .6, vy + s * .6, -s, c, 2.6, .35, 33, 36.4), (i, t, L) => {
    const front = HIT.face === 4 || HIT.face === 3, lamp = front && Math.abs(fract(HIT.u / .65) - .5) < .38 && Math.abs(fract((HIT.w - 33) / .85) - .5) < .38;
    BG[i] = lamp ? C(night > .3 ? WHITE : GRAY, night > .3 ? 15 : 5) : C(GRAY, 1.6 + L * .1); return set(i, ' ', 0), true;
  });
} });
// the goals: posts and bar in white, a net behind on its stanchions you can see through
const goalFrame = end => {
  const P = MatchEngine.PITCH, gx = pitchX(end * P.hl), y0 = pitchY(-P.goalHW), y1 = pitchY(P.goalHW), white = solid(WHITE, { bright: 1.2 });
  const post = .06, depth = 2.2, out = [];
  for (const y of [y0, y1]) out.push(BX(gx + end * post, y, post, post, 0, P.goalH + post, white));
  out.push(BX(gx + end * post, (y0 + y1) / 2, post, P.goalHW + post, P.goalH, P.goalH + post * 2, white));
  out.push({ ...BX(gx + end * (depth / 2 + .1), (y0 + y1) / 2, depth / 2, P.goalHW, 0, P.goalH, (i, t, L) => { // the net: a mesh, sagging at the back
    const a = HIT.face === 3 || HIT.face === 4 ? HIT.u : HIT.v, mesh = Math.abs(fract(a / .12) - .5) > .38 || Math.abs(fract(HIT.w / .12) - .5) > .38;
    if (!mesh || HIT.face === 1 && end > 0 || HIT.face === 2 && end < 0) return false;
    BG[i] = C(WHITE, 5 + L * .15); return set(i, ' ', 0), true;
  }), walk: true });
  return out;
};
// the scoreboard over the south stand: both names, the score and the clock, lit
const scoreboard = () => ({ x: STADIUM.cx - 14, y: 111.5, radius: 9, draw: (vx, vy) => {
  const m = stadiumMatch; if (!m) return;
  const [h, a] = m.teams, min = MatchEngine.minute(m), half = m.period === 1 ? 45 : 90;
  const pens = m.phase === 'pens' ? m.shoot.goals : m.pens, clock = m.phase === 'ft' ? 'FT' : m.phase === 'pens' ? 'PENS' : m.phase === 'ht' ? 'HT' : String(Math.min(Math.floor(min), half)).padStart(2, '0') + "'";
  const line1 = `${h.short} ${h.score}-${a.score} ${a.short}`, line2 = clock + (m.phase === 'goal' ? ' GOAL!' : pens ? ` ${pens[0]}-${pens[1]}` : '');
  for (const e of [-1, 1]) drawBox(boxAt(vx + e * 5, vy + .2, 1, 0, .15, .15, 11.4, 14), solid(GRAY));
  drawBox(boxAt(vx, vy, 1, 0, 7, .25, 14, 18.6), (i, t, L) => {
    if (HIT.face !== 4) { BG[i] = C(GRAY, 1.2); return set(i, ' ', 0), true; }
    const top = HIT.w > 16.3, ch = faceText(top ? line1 : line2, i, t, vx, vy, 6.6, top ? 16.6 : 14.4, 1.7);
    BG[i] = C(GRAY, .4); return set(i, ch && ch !== ' ' ? ch : ' ', m.phase === 'goal' && fract(T * 3) < .5 ? C(YEL, 15) : C(top ? WHITE : YEL, 14)), true;
  });
} });
// the match: the engine stepped on with the clock, the players, the referee and the ball drawn where it puts them
function stadiumLooks(m) {
  return m.looks ||= m.teams.map(t => ({
    out: figLook({ hair: 'short', top: 'tee', bot: 'shorts', tights: true, col: { top: [STADIUM_KIT[t.kit[0]], 9], bot: [STADIUM_KIT[t.kit[1]], 10], tights: [STADIUM_KIT[t.kit[0]], 7], shoe: [GRAY, 1] } }),
    gk: figLook({ hair: 'short', top: 'long', bot: 'shorts', tights: true, col: { top: [t.side ? ORANGE : GREEN, 8], bot: [GRAY, 2], tights: [GRAY, 2], shoe: [GRAY, 1] } }),
  }));
}
const stadiumRefLook = () => STADIUM_REF ||= figLook({ hair: 'buzz', top: 'tee', bot: 'shorts', tights: true, col: { top: [GRAY, 1.5], bot: [GRAY, 1], tights: [GRAY, 1], shoe: [GRAY, 1], skin: [SKIN, 11] } });
let STADIUM_REF = null, stadiumMatch = null; // (the match on today: it carries on while you're in the concourse)
const matchProp = () => ({ x: STADIUM.cx, y: STADIUM.cy, radius: 80, tick: () => {
  const m = stadiumMatch; if (!m) return;
  const dt = clamp(T - (m.lastT ?? T), 0, .25); m.lastT = T; m.lastDt = dt;
  if (m.kick != null && nowHour() < m.kick) return; // (the teams lined up, waiting for kick-off)
  MatchEngine.step(m, dt);
  stadiumAtmosphere(); // the commentary and the crowd (stadium-atmosphere.js)
  if (m.kick != null && m.phase !== 'ft') { // the city clock at the match's pace: about two hours from kick-off to the final whistle
    const hr = m.kick + clamp(m.t / stadiumPlaySeconds(m), 0, .985) * MATCH_HOURS; dayNum = Math.floor(hr / 24); tod = hr - dayNum * 24; // (short of the end while it's on: penalties can run over)
  }
  // how dangerous it is right now (the crowd's on its feet): the ball near a goal, in play
  const P = MatchEngine.PITCH, bx = m.ball.p[0];
  m.danger = m.phase === 'play' ? clamp((Math.abs(bx) - (P.hl - 30)) / 25, 0, 1) * clamp(1 - Math.abs(m.ball.p[1]) / 30, 0, 1) : 0;
}, draw: () => {
  const m = stadiumMatch; if (!m) return;
  const looks = stadiumLooks(m), replay = stadiumTVOn() && stadiumReplayFrame();
  if (replay) { // the TV's replay: everyone where they were, in slow motion
    replay.p.forEach(([x0, y0, fx, fy, sp, side, gk], k) => {
      const x = pitchX(x0), y = pitchY(y0), st = replay.stride[k], pose = sp > 4.2 ? 'run' + (Math.floor(st / 1.9 * 8) & 7) : sp > .5 ? 'walk' + (Math.floor(st / 1.5 * 8) & 7) : 'stand';
      if (inView(x - px, y - py, 1)) drawFigure(x - px, y - py, 0, 1.8, fx, fy, gk ? looks[side].gk : looks[side].out, pose, { light: night > .3 ? 7 : 0 });
    });
  } else for (const t of m.teams) for (const p of t.players) {
    if (p.off && !p.leaving) continue;
    const x = pitchX(p.pos[0]), y = pitchY(p.pos[1]), sp = Math.hypot(p.vel[0], p.vel[1]);
    p.stride = (p.stride || 0) + sp * (m.lastDt || .016);
    const L = m.phase === 'pens' && m.shoot.step === 'after' ? m.shoot.last : null; // (a penalty just taken: the taker and the keeper react)
    const c = m.phase === 'goal' ? m.celebrate : L && (L.taker === p && L.scored || L.keeper === p && L.saved) ? { side: t.side, scorer: p } : L && L.taker === p ? { side: 1 - t.side } : null, scorer = c?.scorer, mob = c && t.side === c.side && p.role !== 'GK' && scorer && Math.hypot(p.pos[0] - scorer.pos[0], p.pos[1] - scorer.pos[1]) < 4;
    const pose = c && (scorer === p || mob) && sp < 2.5 ? 'cheer' // (the scorer arms aloft, mobbed by the rest)
      : c && t.side !== c.side && sp < 1.2 ? 'dejected' // (the other lot, hands on heads)
      : sp > 4.2 ? 'run' + (Math.floor(p.stride / 1.9 * 8) & 7) : sp > .5 ? 'walk' + (Math.floor(p.stride / 1.5 * 8) & 7) : 'stand';
    if (!inView(x - px, y - py, 1)) continue;
    drawFigure(x - px, y - py, 0, 1.8, p.face[0], p.face[1], p.role === 'GK' ? looks[t.side].gk : looks[t.side].out, pose, { hold: p, light: night > .3 ? 7 : 0 });
  }
  const rx = pitchX(m.ref.pos[0]), ry = pitchY(m.ref.pos[1]);
  if (!replay && inView(rx - px, ry - py, 1)) drawFigure(rx - px, ry - py, 0, 1.78, m.ref.face[0], m.ref.face[1], stadiumRefLook(), 'stand', { hold: m.ref });
  // the ball, and its shadow on the grass (it's small: never less than a cell, so you can follow it from the stands)
  const b = replay ? replay.b : m.ball.p, bx = pitchX(b[0]) - px, by = pitchY(b[1]) - py, d = Math.hypot(bx, by), tv = stadiumTVOn(), r = Math.max(tv ? .32 : .14, d * (tv ? 1.8 : .8) / projY); // (bigger than life on TV, so you can follow it)
  if (inView(bx, by, 1)) {
    // a box the ball's size, facing you, cut to a disc: its shadow flat on the grass, the ball itself where it is (up in the air too)
    const fx = bx / (d || 1), fy = by / (d || 1), zc = Math.max(r, b[2]);
    drawBox(boxAt(bx, by, -fy, fx, r * 1.1, .02, .005, .02), (i) => { if (HIT.face !== 5) return false; if ((HIT.u / (r * 1.1)) ** 2 + (HIT.v / .02) ** 2 > 1.2) return false; BG[i] = C(GRAY, .8); return set(i, ' ', 0), true; });
    drawBox(boxAt(bx, by, -fy, fx, r, r, zc - r, zc + r), (i) => {
      const u = HIT.face === 3 || HIT.face === 4 ? HIT.u : HIT.v, w = HIT.w - zc;
      if (u * u + w * w > r * r) return false;
      BG[i] = C(WHITE, 14 - (u * u + w * w > r * r * .55 ? 3 : 0)); return set(i, tv && u * u + w * w < r * r * .3 ? 'o' : ' ', C(GRAY, 4)), true; // (lit white, shading at the rim; on TV, a panel)
    });
  }
} });
// the ground's grid: walls round the outside, a gate in the south-east corner
function stadiumGrid() {
  const { W, H } = STADIUM, rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) row += x === 0 || y === 0 || x === W - 1 || y === H - 1 ? (y === H - 1 && (x === 140 || x === 141) ? 'D' : '#') : '.';
    rows.push(row);
  }
  return rows;
}
ROOM_DEFS.stadium = {
  grid: stadiumGrid(), light: 1, height: 40, vis: 200, floor: 'pitch', ceil: 'sky', sign: false, wall: stadiumWall, rise: stadiumRise, outdoor: true,
  props: r => {
    const p = [matchProp(), scoreboard(), bigScreen(), kioskProp(), nearCrowdProp(), ...goalFrame(-1), ...goalFrame(1)];
    for (const s of STANDS) p.push(...standProps(s, r));
    for (const [x, y] of [[8, 8], [142, 8], [8, 106], [142, 106]]) p.push(floodlight(x, y));
    // the advertising boards round the pitch: the city's shops, in their colours (and between you and the grass)
    const P = MatchEngine.PITCH, bx = P.hl + STADIUM.board, by = P.hw + STADIUM.board;
    const ads = ['YARDS ATHLETIC', 'HARDWARE', 'GLYPHPORT', 'DINER', 'BODEGA 24/7', 'VIDEO', 'TATTOO', 'COURIER'];
    for (const [e, ax] of [[-1, 'x'], [1, 'x'], [-1, 'y'], [1, 'y']]) {
      const len = ax === 'x' ? bx : by, cxp = ax === 'x' ? STADIUM.cx : STADIUM.cx + e * bx, cyp = ax === 'x' ? STADIUM.cy + e * by : STADIUM.cy;
      for (let k = 0, n = Math.round(len * 2 / 12); k < n; k++) {
        const off = -len + (k + .5) * len * 2 / n, x = ax === 'x' ? cxp + off : cxp, y = ax === 'x' ? cyp : cyp + off, word = ads[(k + (e + 1) * 3 + (ax === 'y' ? 5 : 0)) % ads.length];
        const col = [RED, BLUE, GREEN, YEL, MAG, CYAN][(k + e + 2) % 6];
        p.push({ x, y, radius: 6, box: { ...boxAt(x, y, ax === 'x' ? 1 : 0, ax === 'x' ? 0 : 1, len / n - .05, .08, 0, .9) }, draw: (vx, vy) => drawBox(boxAt(vx, vy, ax === 'x' ? 1 : 0, ax === 'x' ? 0 : 1, len / n - .05, .08, 0, .9), (i, t, L) => {
          if (HIT.face !== 3 && HIT.face !== 4 || HIT.w < .15) { BG[i] = C(GRAY, 1.5); return set(i, ' ', 0), true; }
          const ch = ax === 'x' ? faceText(word, i, t, vx, vy, len / n - .4, .25, .55) : ' ';
          BG[i] = C(col, 4 + L * .15); return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 15)), true;
        }) });
      }
    }
    return p;
  } };
// into the ground, and a match on (a new one if there isn't one: the home side the Yards)
// the sections a ticket buys: where you're shown to, and what it costs
const STADIUM_SECTIONS = {
  main: { name: 'Main stand, centre', price: 40, stand: 'north', note: 'Covered, on the halfway line: the best view in the house' },
  south: { name: 'South stand', price: 25, stand: 'south', note: 'Opposite the main stand, under the scoreboard' },
  terrace: { name: 'West terrace (standing)', price: 15, stand: 'west', note: 'Behind the goal with the home end. Loud' },
};
function enterStadium(section = 'main', dev = false) {
  const sec = STADIUM_SECTIONS[section] || STADIUM_SECTIONS.main, s = STANDS.find(q => q.id === sec.stand);
  enterRoom('stadium', { word: 'THE YARDS GROUND', ret: [px, py, a], section }, [139.5, 106.5, -Math.PI * .75]);
  stadiumTV = false; stadiumCamX = null; // (you walk in seeing it with your own eyes)
  stadiumLiveMatch();
  // shown to your place: a seat along a row (the main stand near the halfway line), or a spot on the terrace
  const k = s.seats ? 6 + (Math.random() * 6 | 0) - (6 + (Math.random() * 6 | 0)) % 2 : 7 + (Math.random() * 6 | 0), back = s.front + s.out * (k + .5) * s.depth;
  const along = section === 'main' ? STADIUM.cx + (Math.random() - .5) * 24 : s.seats ? STADIUM.cx + (Math.random() - .5) * 60 : STADIUM.cy + (Math.random() - .5) * 30;
  if (s.axis === 'y') { px = along; py = back; a = Math.atan2(-s.out, 0); } else { px = back; py = along; a = Math.atan2(0, -s.out); }
  pitch = -.12;
  if (s.seats) body.seat = { x: px, y: py, fx: 0, fy: -s.out, h: .45, from: [px, py] };
}

// ---- the TV view (V): a camera on the gantry slung under the front of the main stand's roof, panning to follow the
// ball along the touchline and tilting down to it, through a narrower lens, like the match on the telly
let stadiumView = null, stadiumCamX = null, stadiumTV = false;
const stadiumTVOk = () => mode === 'room' && room?.kind === 'stadium' && !!stadiumMatch;
const stadiumTVOn = () => stadiumTV && stadiumTVOk() && !freecam;
function stadiumCam(dt) {
  const rf = stadiumReplayFrame();
  if (rf) { // the replay: from behind the goal it went in at, low, the play coming toward you
    const end = stadiumReplay.end, bx = pitchX(rf.b[0]), by = pitchY(rf.b[1]), x = pitchX(end * (MatchEngine.PITCH.hl + 9)), y = STADIUM.cy + end * 4, z = 4.2, dx = bx - x, dy = by - y, d = Math.hypot(dx, dy) || 1;
    return { x, y, z, a: Math.atan2(dy, dx), pitch: -projY * Math.tan(Math.atan2(z - Math.max(0, rf.b[2]), d)) / rows, fov: (30 + clamp(d / 50, 0, 1) * 18) * Math.PI / 180 };
  }
  const m = stadiumMatch;
  if (m.phase === 'pens') { // the shootout: low behind the taker, the keeper on the line in front
    const P = MatchEngine.PITCH, end = m.shoot.end, gx = pitchX(end * P.hl), gy = STADIUM.cy, x = pitchX(end * (P.hl - P.spot - 13)), y = gy + 1.5, z = 3.4, d = Math.hypot(gx - x, gy - y);
    return { x, y, z, a: Math.atan2(gy - y, gx - x), pitch: -projY * Math.tan(Math.atan2(z - 1, d)) / rows, fov: 30 * Math.PI / 180 };
  }
  const sc = m.phase === 'goal' && m.celebrate?.scorer, b = sc ? [sc.pos[0], sc.pos[1], 1] : m.ball.p, bx = pitchX(b[0]), by = pitchY(b[1]); // (after a goal, on the scorer, not the ball in the net)
  const want = STADIUM.cx + clamp(b[0] * .82, -44, 44);
  stadiumCamX = stadiumCamX == null ? want : stadiumCamX + (want - stadiumCamX) * Math.min(1, dt * 1.6);
  const x = stadiumCamX, y = 19.6, z = 12.4, dx = bx - x, dy = by - y, d = Math.hypot(dx, dy) || 1;
  const fov = (34 + clamp(d / 60, 0, 1) * 10) * Math.PI / 180; // (tighter on play near the camera's side, wider across)
  const tilt = Math.atan2(z - Math.max(0, b[2] * .5), d);
  return { x, y, z, a: Math.atan2(dy, dx), pitch: -projY * Math.tan(tilt) / rows, fov };
}

// ---- the ground from the street (world.js STADIUM_SITE: two blocks, a ring of stands round the pitch, STY 26). City units
// here: 1 = 10m. Outside, brick at street level with the turnstiles along the south front, the poster for the next
// match by them; corrugated steel cladding above, the ground's name along it in big letters, a red trim at the top.
// The faces toward the pitch (seen from the el, or the air) are the stands: rows of supporters under the roof's shadow.
const stadiumBounds = () => { const S = STADIUM_SITE; return { x0: S.bx * 8 + 2, x1: S.bx * 8 + 16, y0: S.by * 8 + 2, y1: S.by * 8 + 8 }; };
const isStadiumPitchCell = (x, y) => STY[idx(x, y)] === 26 && map[idx(x, y)] < .1;
function stadiumFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), fp = Math.max(uStep, d / projY), B = stadiumBounds();
  const nx = side ? 0 : (px < mx + .5 ? -1 : 1), ny = side ? (py < my + .5 ? -1 : 1) : 0, inner = isStadiumPitchCell(mx + nx, my + ny);
  set(i, ' ', 0);
  if (inner) { // the stands from inside: rows of supporters, the roof's shadow over the back rows, a roof edge on top
    if (z > h - .05) { BG[i] = C(GRAY, 1.8 + L * .1); return; }
    const row = Math.floor(z / .045), seat = Math.floor(wc * 20), hsh = hash(row, seat, 2311);
    const roof = z > h - .45 ? .6 : 1, person = hsh < (stadiumMatch && stadiumMatchLive() ? .85 : .08);
    BG[i] = person ? C(hash(row, seat, 2312) < .65 ? RED : [WHITE, BLUE, GRAY][row % 3], (2.6 + L * .15) * roof) : C(GRAY, (1.2 + L * .1) * roof - (fract(z / .045) < .2 ? .4 : 0));
    return;
  }
  if (z > h - .04) { BG[i] = C(RED, 3.2 + L * .2); return; } // the trim along the top
  if (z > .36) { // the cladding: corrugated, with the name painted big along the south and north faces
    const word = ny > 0 ? 'THE YARDS GROUND' : ny < 0 ? 'YARDS ATHLETIC' : '';
    if (word && z > .62 && z < .98) { const mid = (B.x0 + B.x1) / 2, cw = .5; if (wallText(i, wc - mid, uStep, z, d, word, 0, .8, cw, .34, C(WHITE, 9 + L * .3), null)) return; }
    if (z > .5 && z < .58) { BG[i] = C(RED, 2.6 + L * .16); return; } // a band in the home club's red, round the whole ground
    const panel = Math.max(coveGroove(wc, .1, .004, fp), coveGroove(z, .18, .004, d / projY)); // (the sheets' seams)
    BG[i] = C(GRAY, 2.5 + L * .16 - panel * .9 - coveGroove(wc, .025, .006, fp) * .35 - (Math.abs(z - .36) < .01 ? .8 : 0)); return;
  }
  // street level: brick, the turnstile bays along the south front, a poster between them
  const bay = ny > 0 ? fract((wc - B.x0) / 1.4) : -1;
  if (bay >= 0 && bay > .3 && bay < .7 && z < .26) { // a turnstile: a green gate in a dark opening, TURNSTILES over it, a lamp
    if (z > .2) { const c = Math.floor((wc - B.x0) / 1.4) * 1.4 + B.x0 + .7; if (wallText(i, wc - c, uStep, z, d, stadiumGatesOpen() ? 'TURNSTILES' : 'CLOSED', 0, .23, .03, .04, C(stadiumGatesOpen() ? YEL : GRAY, stadiumGatesOpen() ? 14 : 5), C(GRAY, 1))) return; BG[i] = C(GRAY, 1); return; }
    const bars = fract(wc * 30) < .3 && z < .17;
    BG[i] = bars ? C(GREEN, 2.6 + L * .2) : C(GRAY, stadiumGatesOpen() ? 2.4 + night * 3 : .6); return;
  }
  if (bay >= 0 && (bay < .2 || bay > .8) && z > .07 && z < .22 && Math.floor((wc - B.x0) / 1.4) % 2 === 0) { // the poster for the next match
    const c = Math.floor((wc - B.x0) / 1.4) * 1.4 + B.x0 + (bay < .2 ? .07 : 1.33), f = stadiumNextFixture();
    if (Math.abs(wc - c) < .12) {
      if (z > .185 && wallText(i, wc - c, uStep, z, d, f ? f.when : 'NO MATCHES', 0, .2, .016, .022, C(WHITE, 14), C(RED, 3))) return;
      if (z < .185 && z > .1 && f && wallText(i, wc - c, uStep, z, d, f.short.replace(' v ', ' V '), 0, .145, .016, .03, C(YEL, 14), C(RED, 3))) return;
      BG[i] = C(RED, 3 + L * .15); return;
    }
  }
  BG[i] = C(BRICK, 1.5 + L * .16 - Math.max(coveGroove(z, 1 / 40, .003, fp), coveGroove(wc + (Math.floor(z * 40) & 1) * .05, .1, .003, fp)) * .6);
}
// from above: the stands' roofs in grey sheeting with the red trim, and inside them the pitch, mown and marked
function stadiumRoof(i, wx, wy, h, d, L) {
  set(i, ' ', 0);
  const mx = Math.floor(wx), my = Math.floor(wy), fp = d / projY;
  if (h < .1) {
    const B = stadiumBounds(), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, lx = (wx - cx) * 10, ly = (wy - cy) * 10 * (68 / 40); // (metres, squeezed to the ground's real proportions)
    const P = MatchEngine.PITCH, line = pitchMarkDist(Math.abs(lx), Math.abs(ly), lx, ly) < .15 + fp * 6;
    BG[i] = line && Math.abs(lx) <= P.hl + .2 && Math.abs(ly) <= P.hw + .2 ? C(WHITE, 8 + day * 4) : C(GREEN, (Math.floor((lx + P.hl) / 5.25) & 1 ? 3.6 : 3) * (.6 + day * .4) + (night > .3 && stadiumMatchLive() ? 1.4 : 0));
    return;
  }
  BG[i] = C(GRAY, 1.6 + day * 1.6 - coveGroove(wx, .03, .005, fp) * .4);
}
// the floodlight pylons at the inside corners, 38m high, their lamp banks lit for an evening match
function stadiumExterior() {
  if (!STADIUM_SITE?.sh) return;
  const B = stadiumBounds(), lit = night > .3 && stadiumMatchLive();
  for (const [x, y] of [[B.x0 + 1.15, B.y0 + 1.15], [B.x1 - 1.15, B.y0 + 1.15], [B.x0 + 1.15, B.y1 - 1.15], [B.x1 - 1.15, B.y1 - 1.15]]) {
    const [vx, vy] = R(x, y);
    if (Math.hypot(vx, vy) > vis + 2 || !inView(vx, vy, .5)) continue;
    drawBox(boxAt(vx, vy, 1, 0, .05, .05, 0, 3.6), (i, t, L) => { BG[i] = C(GRAY, 1.6 + L * .15 - (fract(HIT.w * 6 + HIT.u * 8) < .2 ? .5 : 0)); return set(i, ' ', 0), true; });
    const cx = (B.x0 + B.x1) / 2 - x, cy = (B.y0 + B.y1) / 2 - y, cd = Math.hypot(cx, cy);
    drawBox(boxAt(vx + cx / cd * .06, vy + cy / cd * .06, -cy / cd, cx / cd, .3, .04, 3.45, 3.85), (i, t, L) => {
      const lamp = Math.abs(fract(HIT.u / .07) - .5) < .35 && Math.abs(fract((HIT.w - 3.45) / .1) - .5) < .35;
      BG[i] = lamp ? C(lit ? WHITE : GRAY, lit ? 15 : 4) : C(GRAY, 1.4); return set(i, ' ', 0), true;
    });
  }
}

// ---- the gates: buying a ticket (the next match, its kick-off, the sections and their prices), and the table
let ticketEl = null;
function openStadiumTickets() {
  const f = stadiumNextFixture();
  if (!f.open) return say(`No match on. Next at the Yards ground: ${clubName(f.home)} v ${clubName(f.away)}, ${f.when}. The gates open an hour and a half before.`, 6);
  ticketEl ||= panel('tickets');
  const table = leagueTable().slice(0, 8).map((t, k) => `<div class="tbl"><span>${k + 1}. ${t.name}</span><span>${t.p}</span><span>${t.gf - t.ga >= 0 ? '+' : ''}${t.gf - t.ga}</span><span><b>${t.pts}</b></span></div>`).join('');
  const minute = stadiumMatch?.slot === f.n && f.live ? Math.floor(Math.min(90, MatchEngine.minute(stadiumLiveMatch()))) : null;
  showPanel(ticketEl, `<style>#tickets .tbl{display:grid;grid-template-columns:1fr 2.5em 3em 2.5em;gap:4px;font-size:.9em;opacity:.9}#tickets .tbl span:not(:first-child){text-align:right}</style>
    <h1>The Yards Ground</h1><p class="sub">${f.cup ? `<b>${f.cup}</b> &middot; ` : ''}${clubName(f.home)} v ${clubName(f.away)} &middot; ${f.live ? `kicked off${minute != null ? `, ${minute}'` : ''}` : 'kick-off ' + f.when.replace('TODAY ', '')} &middot; you have ${fmt$(money)}</p>
    ${Object.entries(STADIUM_SECTIONS).map(([id, s]) => `<button class="item" data-sec="${id}" ${money < s.price && !hasSeasonTicket() ? 'disabled' : ''}><span>${s.name}<br><small>${s.note}</small></span><span class="lead"></span><span class="v">${hasSeasonTicket() ? 'season ticket' : fmt$(s.price)}</span></button>`).join('')}
    ${stadiumExtrasHtml(f)}
    <h2>the table</h2><div class="tbl"><span></span><span>P</span><span>GD</span><span>Pts</span></div>${table}
    ${cupBracketHtml()}
    <p class="hint">E / Esc close</p>`);
  ticketEl.onclick = e => {
    const x = e.target.closest('button[data-x]'); if (x) { const r = stadiumExtra(f, x.dataset.x); if (r) say(r[1], 4); return openStadiumTickets(); }
    const b = e.target.closest('button[data-sec]'); if (!b) return;
    const s = STADIUM_SECTIONS[b.dataset.sec]; if (!hasSeasonTicket() && !pay(s.price)) return say('Not enough on you.', 2);
    hidePanel(ticketEl); enterStadium(b.dataset.sec);
    say(`${s.name}. ${stadiumMatchLive() ? 'The match is on.' : 'Kick-off soon.'} V: the TV view, E: leave whenever you like.`, 5);
  };
}

// the City Cup so far this season: each round's ties, scores (and pens) where they're played, the winner through in bold
function cupBracketHtml() {
  const h = nowHour(), S = seasonOfHour(h), mine = league.cup?.S === S;
  if (!mine && cupKick(S, 0) + MATCH_HOURS <= h) return `<h2>the City Cup</h2><p class="sub">Under way. The draw for next season's is at the start of the season.</p>`;
  const tie = (t, played) => {
    if (!t) return '';
    const [home, away] = played ? [played.home, played.away] : t, nm = id => played?.winner === id ? `<b>${clubShort(id)}</b>` : clubShort(id);
    const sc = played ? `${played.score[0]}-${played.score[1]}${played.pens ? ` <small>(${played.pens[0]}-${played.pens[1]} pens)</small>` : ''}` : 'v';
    return `<div class="tie"><span>${nm(home)}</span><span>${sc}</span><span>${nm(away)}</span></div>`;
  };
  const rows = CUP_ROUNDS.map((R, r) => {
    const played = mine ? league.cup.rounds[r] : null, ties = played || cupTies(S, r);
    const when = `${R.day} ${R.time}`, at = played ? '' : ` <small>${when}</small>`;
    return `<p class="sub">${R.name.replace('Cup ', '')}${at}</p>${ties ? ties.map(t => played ? tie(t, t) : tie(t)).join('') : '<p class="sub"><small>to be decided</small></p>'}`;
  }).join('');
  const won = mine && league.cup.winner ? `<p class="sub">Winners: <b>${clubName(league.cup.winner)}</b></p>` : league.cupHolder ? `<p class="sub">Holders: ${clubName(league.cupHolder)}</p>` : '';
  return `<style>#tickets .tie{display:grid;grid-template-columns:1fr 8em 1fr;gap:4px;font-size:.9em;opacity:.9}#tickets .tie span:nth-child(2){text-align:center}#tickets .tie span:nth-child(3){text-align:right}</style><h2>the City Cup</h2>${rows}${won}`;
}

// ---- replays (phase 6): the build-up to every goal, kept from the engine's last eight seconds (match-engine.js replay),
// played back slowed down a few seconds after it goes in, once the celebrating's started: on the big screen over the
// south stand, and with the TV view on, re-staged from a camera behind that goal
let stadiumReplay = null, stadiumReplayPending = null;
const STADIUM_REPLAY_SPEED = .55;
function queueStadiumReplay(m, e) {
  const frames = m.replay.slice(-56); if (frames.length < 10) return;
  const last = frames[frames.length - 1].b;
  stadiumReplayPending = { at: T + 3, frames, end: Math.sign(last[0]) || 1, scorer: e.player, side: e.side };
}
function tickStadiumReplay() {
  if (stadiumReplayPending && T >= stadiumReplayPending.at) { stadiumReplay = { ...stadiumReplayPending, t0: T }; stadiumReplayPending = null; if (stadiumTVOn()) say(`REPLAY: ${stadiumReplay.scorer}`, stadiumReplay.frames.length * .1 / STADIUM_REPLAY_SPEED); }
  if (stadiumReplay && (T - stadiumReplay.t0) * STADIUM_REPLAY_SPEED > (stadiumReplay.frames.length - 1) * .1) stadiumReplay = null;
}
// the frame of the replay now, interpolated, with each player's stride so far (for their running legs)
function stadiumReplayFrame() {
  const R = stadiumReplay; if (!R) return null;
  const f = Math.min(R.frames.length - 1.001, (T - R.t0) * STADIUM_REPLAY_SPEED / .1), k = Math.floor(f), u = f - k, A = R.frames[k], B = R.frames[k + 1] || A;
  const lerp = (a, b) => a + (b - a) * u;
  R.stride ||= A.p.map(() => 0);
  const p = A.p.map((q, j) => { const r = B.p[j] || q; return [lerp(q[0], r[0]), lerp(q[1], r[1]), lerp(q[2], r[2]), lerp(q[3], r[3]), lerp(q[4], r[4]), q[5], q[6], q[7]]; });
  const dt = R.lastF == null ? 0 : (f - R.lastF) * .1; R.lastF = f;
  p.forEach((q, j) => { R.stride[j] = (R.stride[j] || 0) + q[4] * dt; });
  return { p, b: [lerp(A.b[0], B.b[0]), lerp(A.b[1], B.b[1]), lerp(A.b[2], B.b[2])], stride: R.stride };
}
// the big screen beside the scoreboard: the match from above (the pitch, both sides in their colours, the ball), and
// after a goal the replay, REPLAY in the corner
const bigScreen = () => ({ x: STADIUM.cx + 9, y: 111.5, radius: 12, draw: (vx, vy) => {
  const m = stadiumMatch; if (!m) return;
  for (const e of [-1, 1]) drawBox(boxAt(vx + e * 8, vy + .2, 1, 0, .2, .2, 11.4, 12.6), solid(GRAY));
  const P = MatchEngine.PITCH, hl = 10, z0 = 12.6, z1 = 20.6, R = stadiumReplayFrame();
  const kit = m.teams.map(t => STADIUM_KIT[t.kit[0]] ?? GRAY), dots = R ? R.p.map(q => [q[0], q[1], q[5]]) : m.teams.flatMap(t => t.players.filter(p => !p.off).map(p => [p.pos[0], p.pos[1], t.side]));
  const ball = R ? R.b : m.ball.p;
  drawBox(boxAt(vx, vy, 1, 0, hl, .25, z0, z1), (i, t, L) => {
    if (HIT.face !== 4) { BG[i] = C(GRAY, 1.2); return set(i, ' ', 0), true; }
    const u = HIT.u, w = HIT.w, rim = Math.abs(u) > hl - .25 || w < z0 + .25 || w > z1 - .25;
    if (rim) { BG[i] = C(GRAY, .6); return set(i, ' ', 0), true; }
    if (R && u > hl - 4.4 && w > z1 - 1.6 && fract(T * 1.2) < .75) { const ch = faceText('REPLAY', i, t, vx + (hl - 2.3), vy, 2, z1 - 1.5, 1.1); if (ch && ch !== ' ') { BG[i] = C(RED, 4); return set(i, ch, C(WHITE, 15)), true; } }
    const x = (u / (hl - .25)) * (P.hl + 3), y = -((w - (z0 + z1) / 2) / ((z1 - z0) / 2 - .25)) * (P.hw + 3); // (the screen's the pitch, seen from above, north at the top)
    const near = Math.hypot(x - ball[0], y - ball[1]);
    if (near < 1.8) { BG[i] = C(WHITE, 15); return set(i, ' ', 0), true; }
    for (const [dx, dy, side] of dots) if (Math.hypot(x - dx, y - dy) < 2.2) { BG[i] = C(kit[side], 11); return set(i, ' ', 0), true; }
    const line = pitchMarkDist(Math.abs(x), Math.abs(y), x, y) < .9 && Math.abs(x) <= P.hl + .5 && Math.abs(y) <= P.hw + .5;
    BG[i] = line ? C(WHITE, 8) : C(GREEN, (Math.floor((x + P.hl) / 5.25) & 1 ? 4.5 : 3.6)); return set(i, ' ', 0), true;
  });
} });
