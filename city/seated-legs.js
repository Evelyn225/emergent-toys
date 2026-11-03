// ===== your own legs, sat down: look down from a bench, a chair or a stool and there they are, thighs along the seat,
// knees bent, shins down to your shoes on the floor (on the grass, stretched out in front of you). Drawn in camera
// space like the skateboard (moves.js): x right, y down, z ahead, metres from the eye, anchored to the horizon, each
// cell ray-cast against the legs as capsules; anything nearer in the world (a table's top) stays in front of them.
const LEG = { r: .07, gap: .11, shoe: .055 };
let seatedLegCaps = null, seatedLegKey = '';
function seatedLegCapsules(seatH) {
  const grass = seatH < .2, hipY = .62, floorY = grass ? 1.15 : 1.15 + (seatH - .45); // (a higher seat lifts the eye with it: the floor's further below)
  const caps = [];
  for (const s of [-1, 1]) {
    const x = s * LEG.gap;
    if (grass) { // stretched out on the ground, ankles crossed a little
      caps.push({ a: [x, floorY - LEG.r, .12], b: [x * .7, floorY - LEG.r, .95], r: LEG.r, col: BLUE });
      caps.push({ a: [x * .7, floorY - LEG.shoe - .06, .98], b: [x * .7, floorY - .2, 1.04], r: LEG.shoe, col: BLACK });
    } else {
      const knee = [x * 1.1, hipY, .5], foot = [x * 1.15, floorY - LEG.shoe, .58];
      caps.push({ a: [x, hipY, .06], b: knee, r: LEG.r, col: BLUE }); // the thigh, along the seat
      caps.push({ a: knee, b: [foot[0], foot[1] - .04, foot[2]], r: LEG.r * .85, col: BLUE }); // the shin, down to the floor
      caps.push({ a: [foot[0], foot[1], foot[2] - .03], b: [foot[0], foot[1], foot[2] + .16], r: LEG.shoe, col: BLACK }); // the shoe
    }
  }
  return caps;
}
// a ray from the eye (o = 0) along d against a capsule: the nearest t, or -1 (after Inigo Quilez's capsule intersector)
function rayCapsule(d, c) {
  const [ax, ay, az] = c.a, bax = c.b[0] - ax, bay = c.b[1] - ay, baz = c.b[2] - az, oax = -ax, oay = -ay, oaz = -az;
  const baba = bax * bax + bay * bay + baz * baz, bard = bax * d[0] + bay * d[1] + baz * d[2], baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d[0] * oax + d[1] * oay + d[2] * oaz, oaoa = oax * oax + oay * oay + oaz * oaz, rr = c.r * c.r;
  const A = baba - bard * bard, B = baba * rdoa - baoa * bard, Cc = baba * oaoa - baoa * baoa - rr * baba, h = B * B - A * Cc;
  if (h >= 0) {
    const t = (-B - Math.sqrt(h)) / A, y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
    const ocx = y <= 0 ? oax : -c.b[0], ocy = y <= 0 ? oay : -c.b[1], ocz = y <= 0 ? oaz : -c.b[2];
    const b2 = d[0] * ocx + d[1] * ocy + d[2] * ocz, c2 = ocx * ocx + ocy * ocy + ocz * ocz - rr, h2 = b2 * b2 - c2;
    if (h2 > 0) return -b2 - Math.sqrt(h2);
  }
  return -1;
}
function capsuleNormal(p, c) {
  const bax = c.b[0] - c.a[0], bay = c.b[1] - c.a[1], baz = c.b[2] - c.a[2], pax = p[0] - c.a[0], pay = p[1] - c.a[1], paz = p[2] - c.a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return [(pax - bax * h) / c.r, (pay - bay * h) / c.r, (paz - baz * h) / c.r];
}
function drawSeatedLegs() {
  const seat = body.seat;
  if (!seat || !onFootMode() || skatingNow()) return;
  const seatH = seat.grass ? 0 : seat.h ?? .45, key = seatH.toFixed(3);
  if (key !== seatedLegKey) { seatedLegCaps = seatedLegCapsules(seatH); seatedLegKey = key; }
  // the legs point the way the seat faces, whichever way you look
  const yaw = seat.yaw ?? (seat.yaw = a), dl = yaw - a, sd = Math.sin(dl), cd = Math.cos(dl);
  const caps = seatedLegCaps.map(c => { const rot = p => [p[2] * sd + p[0] * cd, p[1], p[2] * cd - p[0] * sd]; return { ...c, a: rot(c.a), b: rot(c.b) }; });
  // only the rows that could show them: below the horizon by at least the nearest knee's drop
  const r0 = Math.max(0, Math.floor(hor + .3 * projY / 1.2)), worldScale = mode === 'room' ? 1 : 10;
  if (r0 >= rows) return;
  const ox = cols / 2, light = mode === 'room' ? (room?.def.light ?? 1) : Math.max(.35, amb);
  for (let r = r0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const d = [(c + .5 - ox) / projX, (r + .5 - hor) / projY, 1], n = Math.hypot(d[0], d[1], d[2]);
    d[0] /= n; d[1] /= n; d[2] /= n;
    let best = 1e9, hit = null;
    for (const cap of caps) { const t = rayCapsule(d, cap); if (t > 0 && t < best) { best = t; hit = cap; } }
    if (!hit) continue;
    const i = r * cols + c, Z = best * d[2];
    if (ZB[i] > 0 && ZB[i] * worldScale < Z - .02) continue; // (a table in front of your knees)
    const p = [d[0] * best, d[1] * best, d[2] * best], nn = capsuleNormal(p, hit), up = clamp(-nn[1] * .7 + .35 - nn[2] * .2, 0, 1);
    BG[i] = C(hit.col, (hit.col === BLACK ? .6 + up * 1.4 : 1.2 + up * 3.2) * light + (hit.col === BLUE && hash(c, r, 77) > .93 ? .4 : 0)); // (denim's flecks)
    set(i, ' ', 0); FOGS[i] = FOGB[i] = 0;
  }
}
