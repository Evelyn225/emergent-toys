// The car dealership (WORLD_QUALITY.md item 38): an 18 x 13 m showroom with three full-size cars (one on a slowly
// turning turntable), each with its price on a stand; the dealer's wall with the name in big letters, car posters and
// a SALE banner; pennant bunting under the lights; the salesman's desk and a second one with chairs for customers;
// and a corner to wait in with a sofa, the coffee machine and a rack of brochures. Metres.
// A car as convex solids, ray-cast (rayBeveledBay): a body with a sloping bonnet and boot, its sides tucked in at the
// sills and rounded over at the shoulders; a glasshouse narrower than the body, raked windscreen and rear glass; four
// wheels in their arches. (x, y): its middle; ang: which way it points; col: its paint; z0: what it stands on
const SHOWROOM_CAR = { hl: 2.2, hw: .9, sill: .2, belt: .78, roof: 1.36 };
function showroomCarPlanes() {
  const S = SHOWROOM_CAR, n = (a, b, c) => { const l = Math.hypot(a, b, c); return [a / l, b / l, c / l]; };
  const plane = (nx, ny, nz, pu, pv, pz, f) => { const [a, b, c] = n(nx, ny, nz); return [a, b, c, a * pu + b * pv + c * pz, f]; };
  const body = [plane(1, 0, 0, S.hl, 0, 0, 1), plane(-1, 0, 0, -S.hl, 0, 0, 2), plane(0, 1, 0, 0, S.hw, 0, 3), plane(0, -1, 0, 0, -S.hw, 0, 4),
    plane(0, 0, 1, 0, 0, S.belt, 5), plane(0, 0, -1, 0, 0, S.sill, 6),
    plane(.45, 0, 1, S.hl, 0, .6, 7), plane(-.4, 0, 1, -S.hl, 0, .68, 8), // the nose and the tail falling away
    plane(0, .55, 1, 0, S.hw, .68, 9), plane(0, -.55, 1, 0, -S.hw, .68, 10), // the shoulders
    plane(0, .7, -1, 0, S.hw, .36, 11), plane(0, -.7, -1, 0, -S.hw, .36, 11)]; // the sills tucked under
  const cab = [plane(1, 0, .72, .72, 0, S.belt, 13), plane(-1, 0, .95, -1.45, 0, S.belt, 14), plane(0, 1, .36, 0, .82, S.belt, 15), plane(0, -1, .36, 0, -.82, S.belt, 15),
    plane(0, 0, 1, 0, 0, S.roof, 5), plane(0, 0, -1, 0, 0, S.belt - .02, 6)];
  return { body, cab };
}
const SHOWROOM_CAR_PLANES = showroomCarPlanes();
function drawShowroomCar(vx, vy, ang, col, z0 = 0) {
  const S = SHOWROOM_CAR, c = Math.cos(ang), s = Math.sin(ang), lift = pl => pl.map(([a, b, cc, d, f]) => [a, b, cc, d + cc * z0, f]);
  const paint = (lv, k = 1) => C(col, Math.max(.6, lv * k));
  drawBox({ ...boxAt(vx, vy, c, s, S.hl, S.hw, z0 + S.sill, z0 + S.belt + .02), planes: lift(SHOWROOM_CAR_PLANES.body) }, (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w - z0, fp = t / projY, lit = 1.6 + L * .42;
    if (f === 5 || f === 7 || f === 8 || f === 9 || f === 10) { // bonnet, boot and shoulders: the showroom lights on the paint
      const gleam = Math.abs(fract(u * .35 + v * .2) - .5) < .04 && fp < .02;
      BG[i] = gleam ? C(WHITE, 12) : paint(lit + (f === 5 ? 1.2 : .8)); return set(i, ' ', 0), true;
    }
    if (f === 1) { // the nose: headlamps, the grille, the badge, the plate
      if (w > .5 && w < .62 && Math.abs(v) > .48 && Math.abs(v) < .82) { BG[i] = C(WHITE, 12); return set(i, ' ', 0), true; }
      if (w > .36 && w < .5 && Math.abs(v) < .42) { BG[i] = C(GRAY, 1 + (fract(w / .03) < .5 ? .8 : 0)); return set(i, ' ', 0), true; }
      if (w > .26 && w < .34 && Math.abs(v) < .25) { BG[i] = C(WHITE, 8); return set(i, ' ', 0), true; }
      BG[i] = paint(lit); return set(i, ' ', 0), true;
    }
    if (f === 2) { // the tail: lamps across, the boot's shut line, the plate
      if (w > .55 && w < .66 && Math.abs(v) > .4) { BG[i] = C(RED, 9); return set(i, ' ', 0), true; }
      if (w > .3 && w < .4 && Math.abs(v) < .25) { BG[i] = C(WHITE, 8); return set(i, ' ', 0), true; }
      BG[i] = paint(lit * .9 - (Math.abs(w - .7) < .008 ? .8 : 0)); return set(i, ' ', 0), true;
    }
    if (f === 6 || f === 11) { BG[i] = C(GRAY, .8); return set(i, ' ', 0), true; } // underneath, in shadow
    // the sides: wheel arches cut dark, door shut lines, handles, a crease along the waist
    for (const wc of [S.hl * .62, -S.hl * .62]) if (Math.hypot(u - wc, w - .34) < .42) { BG[i] = C(GRAY, .5); return set(i, ' ', 0), true; }
    const shut = (Math.abs(u - .55) < .008 || Math.abs(u + .75) < .008) && w < S.belt - .02, handle = Math.abs(w - .66) < .02 && (Math.abs(u - .3) < .07 || Math.abs(u + 1) < .07);
    BG[i] = handle ? C(GRAY, 5) : paint(lit * .95 - (shut && fp < .015 ? .9 : 0) - (Math.abs(w - .62) < .01 ? .35 : 0)); return set(i, ' ', 0), true;
  }, rayBeveledBay);
  drawBox({ ...boxAt(vx, vy, c, s, 1.6, .82, z0 + S.belt - .02, z0 + S.roof), planes: lift(SHOWROOM_CAR_PLANES.cab) }, (i, t, L) => {
    const f = HIT.face, u = HIT.u, w = HIT.w - z0, lit = 1.6 + L * .42;
    if (f === 5) { BG[i] = paint(lit + 1.4); return set(i, ' ', 0), true; } // the roof
    if (f === 6) return false;
    const glassTop = S.roof - .06, pillar = f === 15 && (Math.abs(u - .1) < .05 || u > .55 || u < -1.2) || w > glassTop || w < S.belt + .03;
    if (pillar) { BG[i] = paint(lit); return set(i, ' ', 0), true; }
    const streak = Math.abs(fract(u * .6 + w * 1.4) - .5) < .06; // glass: dark, a sheen of the lights across it
    BG[i] = C(CYAN, (f === 13 || f === 14 ? 1.6 : 1.2) + L * .12 + (streak ? 1.6 : 0)); return set(i, ' ', 0), true;
  }, rayBeveledBay);
  for (const wu of [S.hl * .62, -S.hl * .62]) for (const side of [-1, 1]) { // the wheels: tyre, alloy rim, hub
    const wx = vx + c * wu - s * side * (S.hw - .14), wy = vy + s * wu + c * side * (S.hw - .14);
    drawBox(boxAt(wx, wy, c, s, .34, .12, z0, z0 + .68), (i, t, L) => {
      const u = HIT.u, w = HIT.w - z0 - .34, r = Math.hypot(u, w);
      if (r > .34) return false;
      if (HIT.face !== 3 && HIT.face !== 4) { BG[i] = C(GRAY, .6); return set(i, ' ', 0), true; } // the tread
      const spoke = r < .22 && r > .06 && Math.abs(fract(Math.atan2(w, u) / TAU * 5) - .5) < .12;
      BG[i] = r > .23 ? C(GRAY, .5) : r < .06 ? C(GRAY, 5 + L * .2) : spoke || r > .2 ? C(GRAY, 4.2 + L * .3) : C(GRAY, 1.3); return set(i, ' ', 0), true;
    });
  }
}
// a showroom car as a room prop: solid to walk into, and when on the turntable, turning slowly with it
const SHOWROOM_CAR_PROP = (x, y, ang, col, spin = 0, z0 = 0) => ({ x, y, radius: 2.6, showroomCar: true, draw: (vx, vy) => drawShowroomCar(vx, vy, ang + spin * T, col, z0),
  box: boxAt(x, y, spin ? 1 : Math.cos(ang), spin ? 0 : Math.sin(ang), spin ? 2.2 : SHOWROOM_CAR.hl, spin ? 2.2 : SHOWROOM_CAR.hw, 0, z0 + SHOWROOM_CAR.roof) });
// the turntable: a low steel drum, ribbed, edged with a strip of light
const SHOWROOM_TURNTABLE = (x, y) => ({ ...ROOM_MODEL(x, y, (vx, vy) => drum(vx, vy, 2.7, 0, .1, (i, t, L) => {
  const r = Math.hypot(HIT.u, HIT.v), ang = Math.atan2(HIT.v, HIT.u) - T * .12;
  BG[i] = HIT.face === 5 ? (r > 2.58 ? C(WHITE, 10) : C(GRAY, 2.6 + L * .2 + (Math.abs(fract(ang / TAU * 36) - .5) < .04 ? .7 : 0))) : C(GRAY, 1.6 + L * .15);
  return set(i, ' ', 0), true; })), walk: true });
// a price board on a chrome stand: the price big, a line of small print
function SHOWROOM_PRICE(x, y, ang, price) {
  const c = Math.cos(ang), s = Math.sin(ang), text = '$' + price;
  return { showroomPrice: price, ...ROOM_MODEL(x, y, (vx, vy) => {
    drawBox(boxAt(vx, vy, c, s, .02, .02, 0, 1.0), CHROME);
    drawBox(boxAt(vx, vy, c, s, .32, .02, 1.0, 1.4), (i, t, L) => {
      BG[i] = C(WHITE, 9 + L * .2);
      if (HIT.face !== 3 && HIT.face !== 4) return set(i, ' ', 0), true;
      const q = (HIT.face === 3 ? HIT.u : -HIT.u) / .58 * text.length + text.length / 2;
      if (Math.abs(HIT.w - 1.25) < .06 && q >= 0 && q < text.length && oneCell(HIT.w - 1.25, t / projY) && oneCell((fract(q) - .5) * .58 / text.length, t / projX)) return set(i, text[Math.floor(q)], C(RED, 4)), true; // (a letter in the column at its middle)
      if (Math.abs(HIT.w - 1.1) < .015) { BG[i] = C(GRAY, 6); return set(i, ' ', 0), true; } // the small print
      return set(i, ' ', 0), true;
    });
  }, [.32, .1, 1.4]) };
}
// pennants on a line from wall to wall, under the lights
function SHOWROOM_BUNTING(x0, y0, x1, y1, z) {
  const len = Math.hypot(x1 - x0, y1 - y0), c = (x1 - x0) / len, s = (y1 - y0) / len, n = Math.floor(len / .5);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, radius: len / 2 + .5, draw: (vx, vy) => {
    for (let k = 0; k < n; k++) {
      const q = (k + .5) / n - .5, sag = (1 - (2 * q) ** 2) * .35, cx = vx + c * q * len, cy = vy + s * q * len, col = [RED, YEL, BLUE, GREEN, WHITE][k % 5];
      drawBox(boxAt(cx, cy, c, s, .17, .01, z - sag - .32, z - sag), (i, t, L) => { if (Math.abs(HIT.u) > .17 * (HIT.w - (z - sag - .32)) / .32) return false; BG[i] = C(col, 6 + L * .3); return set(i, ' ', 0), true; });
    }
  } };
}
// the dealer's wall: the name across the back in big letters, posters of cars, a SALE banner; pale elsewhere, a dado stripe
function showroomWall(i, u, uStep, z, d, mx, my, L) {
  set(i, ' ', 0);
  if (my === 0 && z > 3.1 && z < 3.9 && wallText(i, u, uStep, z, d, 'CITY MOTORS', 9, 3.5, .62, .7, C(RED, 12), C(WHITE, 5 + L * .2))) return true;
  if (my === 0 && z > 3 && z < 4) { BG[i] = C(WHITE, 5 + L * .2); return true; }
  const side = mx === 0 || mx === room.W - 1, bay = fract(u / 4), poster = side && bay > .25 && bay < .75 && z > 1.3 && z < 2.6;
  if (poster) { // a car on a road under a sunset: the sky in bands, the car's silhouette, a white frame
    const pu = (bay - .25) / .5, pz = (z - 1.3) / 1.3;
    if (pu < .04 || pu > .96 || pz < .05 || pz > .95) { BG[i] = C(WHITE, 8); return true; }
    const car = pz > .2 && pz < .45 && Math.abs(pu - .5) < .3 - (pz > .35 ? (pz - .35) * 1.5 : 0);
    BG[i] = car ? C(GRAY, 1.2) : pz < .2 ? C(GRAY, 2.5) : C(pz > .7 ? MAG : pz > .5 ? ORANGE : YEL, 6 + L * .2); return true;
  }
  if (mx === room.W - 1 && z > 2.75 && z < 3.15 && wallText(i, u, uStep, z, d, 'SALE  0% FINANCE', room.H / 2, 2.95, .3, .35, C(WHITE, 15), C(RED, 7))) return true;
  BG[i] = Math.abs(z - 1.1) < .06 ? C(RED, 6 + L * .2) : C(WHITE, (z < 1.05 ? 3.6 : 4.6) + L * .3); return true;
}
ROOM_DEFS.showroom = { grid: boxRoom(18, 13), light: 1.05, floor: 'marble', ceil: 'strip', sign: false, keeper: [14.5, 2.4], wall: showroomWall, height: 4.2,
  props: r => [
    SHOWROOM_TURNTABLE(9, 6.2), SHOWROOM_CAR_PROP(9, 6.2, .5, RED, .12, .1), SHOWROOM_PRICE(11.9, 8.2, -.6, 32900),
    SHOWROOM_CAR_PROP(3.8, 9.6, -.9, BLUE), SHOWROOM_PRICE(5.9, 11.2, .3, 18450),
    SHOWROOM_CAR_PROP(14.4, 9.8, .9, WHITE), SHOWROOM_PRICE(12.1, 11.4, -.3, 24990),
    SMALL_DESK(14.5, 1.6, 1.1, .4, .78, 0, -1, WHITE), { ...standing(14.5, 2.4, BLUE), face: [0, 1] }, ...homeChair(14.1, 3.3, 0, -1), ...homeChair(14.9, 3.3, 0, -1),
    SMALL_DESK(10.6, 1.6, .9, .4, .78, 0, -1, WHITE), ...homeChair(10.6, 2.9, 0, -1),
    ...couch(2.0, 3.2, 1.2, 1, 0, GRAY), ...tableBox(3.6, 3.2, .45, .45), POT_PLANT(1.3, 1.3, 1.6, 81), POT_PLANT(16.7, 11.7, 1.8, 82), POT_PLANT(7.2, 1.3, 1.4, 83),
    ...counterBox(5.2, 1.4, .7, .95), // the coffee counter (its machine: the register)
    SHOWROOM_BUNTING(.5, 4.5, 17.5, 4.5, 4), SHOWROOM_BUNTING(.5, 8.5, 17.5, 8.5, 4),
    { ...standing(6.4, 7.6, GREEN), face: [.6, -.6] }, { ...standing(12.6, 8.0, MAG), face: [.4, 1] }, // customers looking the cars over
  ] };
