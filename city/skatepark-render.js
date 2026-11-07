// ===== the skatepark drawn (skatepark.js builds it): steel flat bars on posts, granite ledges with steel coping, a
// concrete manual pad, and the park's smooth concrete with its saw-cut joints. Fine detail fades with distance
const SK_STEEL = (L, top) => C(GRAY, (top ? 4.2 : 2.6) + L * .35);
// a park's surfaces wear where people ride: thin dark wheel streaks running the way you go (along: that direction, a
// unit vector in world x/y), denser where it's ridden most (k: 0..1). 0 for none, up to 1 for a fresh dark one; filtered
// out once a cell's wider than a mark
function skWheelMarks(wx, wy, ax, ay, k, foot) {
  if (foot > .03 || k <= 0) return 0;
  const along = wx * ax + wy * ay, across = -wx * ay + wy * ax, w = Math.max(.006, foot);
  const lane = Math.floor(across / w), streak = hash(lane, Math.floor(along / .12 + hash(lane, 3, 2111) * 9), 2112);
  return streak > 1 - k * .2 ? (1 - clamp((foot - .01) / .02, 0, 1)) * (.45 + .45 * hash(lane, 7, 2113)) * (.006 / w) ** .5 : 0;
}
// a world point on a solid's face, from its local u/v (o.c, o.s: its axis)
const skWorld = (o, u, v) => [o.x + u * o.c - v * o.s, o.y + u * o.s + v * o.c];
// painted steel that the boards have scraped back to bare metal along the top; the paint picked per bar
const SK_PAINT = [YEL, RED, GRAY, BLUE, YEL];
// a flat bar: the round bar along the top, square posts 30 cm in from each end, nothing in between. Painted (yellow,
// red, black or blue); the bar's top ground back to bright steel by the grinds, the paint chipped at its ends
SOLID_SHADE.skaterail = o => (i, t, L) => {
  const w = HIT.w, bar = w > o.z1 - .005, post = Math.abs(Math.abs(HIT.u) - (o.hl - .03)) < .004;
  if (!bar && !post) return false; // (see-through under the bar)
  const paint = SK_PAINT[Math.floor(hash(Math.floor(o.x * 10), Math.floor(o.y * 10), 2114) * SK_PAINT.length)], dark = paint === GRAY;
  const scraped = bar && (HIT.face === 5 || w > o.z1 - .0015) && Math.abs(HIT.u) < o.hl - .02, chip = hash(Math.floor(HIT.u * 300), Math.floor(w * 300), 2115) > .9;
  if (scraped || chip && bar) { BG[i] = SK_STEEL(L, true); return set(i, ' ', 0), true; }
  BG[i] = C(paint, (dark ? 1.2 : 3.4) * shadeFace(HIT.face) + L * (dark ? .1 : .3) - (post && w < .006 ? 1 : 0)); return set(i, ' ', 0), true; // (rust at the feet)
};
// granite: a speckled pale grey block, darker low down where boards scuff it; steel coping along the top edges
SOLID_SHADE.skateledge = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .006 : o.z1 - HIT.w < .006;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const fine = coveDetail(t, .05), fleck = hash(Math.floor((o.x + HIT.u) * 160), Math.floor(HIT.w * 160 + HIT.v * 160), 2101) * fine;
  const scuff = !top && HIT.w < o.z1 * .45 ? .5 : 0;
  // wax: a dark glossy band along the top and face just under the coping where the trucks bite, patchy along its length
  const fromEdge = top ? o.hw - Math.abs(HIT.v) : o.z1 - HIT.w, waxed = fromEdge < .016 && noise((o.x + HIT.u) * 40, o.y * 40, 2116) > .35;
  // and the corners knocked off over the years
  const chipped = !top && Math.abs(HIT.u) > o.hl - .01 && fromEdge < .012 && hash(Math.floor(HIT.w * 400), Math.sign(HIT.u) + 3, 2117) > .5;
  if (chipped) { BG[i] = C(STONE, 2.2 * shadeFace(f) + L * .2); return set(i, fine > .5 ? '.' : ' ', C(GRAY, 6)), true; }
  BG[i] = C(o.material === 'wood' ? BRICK : STONE, (top ? 4.2 : 3.2 - scuff) * shadeFace(f) + L * .25 + (fleck - .5) * .8 - (waxed ? 1.1 : 0)); return set(i, ' ', 0), true;
};
// the manual pad: poured concrete, steel angle on its long edges, a joint across the middle
SOLID_SHADE.manualpad = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .005 : o.z1 - HIT.w < .005;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const joint = top ? coveGroove(HIT.u, o.hl, .004, t / projX) : 0;
  BG[i] = C(GRAY, (top ? 4.4 : 3) * shadeFace(f) * (1 - joint * .5) + L * .25); return set(i, ' ', 0), true;
};
// a ramp, ray-cast as the convex solid it is: the box's sides and floor, cut by its slopes (a kicker: one rising to the
// lip at +u; a funbox: up, a flat deck, down). Faces 7 and 8: the slopes up and down
function rayRamp(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y, lu = qx * b.c + qy * b.s, lv = -qx * b.s + qy * b.c, du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let tmin = -Infinity, tmax = Infinity, face = 0;
  const cut = (nu, nv, nz, d, f) => { // keep n.p <= d
    const den = nu * du + nv * dv + nz * rz, dist = d - (nu * lu + nv * lv + nz * oz);
    if (Math.abs(den) < 1e-12) return dist >= 0;
    const t = dist / den;
    if (den < 0) { if (t > tmin) { tmin = t; face = f; } } else if (t < tmax) tmax = t;
    return tmin <= tmax;
  };
  const kick = b.ramp === 'kicker', k = kick ? (b.z1-b.z0) / (b.run||2*b.hl) : (b.z1-b.z0) / b.run;
  if (!cut(1, 0, 0, b.hl, 1) || !cut(-1, 0, 0, b.hl, 2) || !cut(0, 1, 0, b.hw, 3) || !cut(0, -1, 0, b.hw, 4) || !cut(0, 0, -1, -b.z0, 6) || !cut(0, 0, 1, b.z1, 5)) return -1;
  if (!cut(-k, 0, 1, b.z0+k * b.hl, 7)) return -1; // z <= k (u + hl)
  if (!kick && !cut(k, 0, 1, b.z0+k * b.hl, 8)) return -1; // z <= k (hl - u)
  if (tmin < 0.01) return -1;
  HIT.face = face; HIT.u = lu + du * tmin; HIT.v = lv + dv * tmin; HIT.w = oz + rz * tmin;
  return tmin;
}
// ramps: smooth grey concrete, the slopes catching the light, steel coping along a funbox's deck edges and a kicker's lip
SOLID_SHADE.skateramp = o => (i, t, L) => {
  const f = HIT.face, slope = f === 7 || f === 8, top = f === 5 || slope, h = rampHeight(o, HIT.u);
  const coping = top && (o.ramp === 'kicker' ? HIT.u > o.hl - .01 : f === 5 && o.hw - Math.abs(HIT.v) < .006) || !top && Math.abs(HIT.w - h) < .004 && (f === 3 || f === 4) && (o.ramp !== 'kicker' || HIT.u > o.hl - .01);
  if (coping) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const foot = t / projY, [wx, wy] = skWorld(o, HIT.u, HIT.v);
  if (slope || top) { // up and down the slopes: rubber streaks, thickest down the middle where the lines are; the deck pale and polished at the lip
    const mid = 1 - Math.abs(HIT.v) / o.hw, marks = slope ? skWheelMarks(wx, wy, o.c, o.s, .5 + mid * .5, foot) : 0;
    const polish = !slope && o.ramp !== 'kicker' && o.hw - Math.abs(HIT.v) < .02 ? .35 : 0, mottle = (noise(wx * 30, wy * 30, 2118) - .5) * .5 * coveDetail(t, .08);
    BG[i] = C(GRAY, (slope ? (f === 7 ? 4.6 : 3.6) : 4.3) + L * .25 - marks * 2.2 + polish + mottle); return set(i, ' ', 0), true;
  }
  // the sides: concrete, rust bleeding down from the coping in streaks, and on some of them somebody's tag
  const drip = hash(Math.floor(HIT.u * 160 + o.x * 7), 1, 2119), rust = (f === 3 || f === 4) && drip > .86 && h - HIT.w < .012 + drip * .03; // (thin, ragged runs from under the coping)
  const tag = skSideTag(o, i, f, HIT.u, HIT.w, h, t, L);
  if (tag) return true;
  BG[i] = C(rust ? BRICK : GRAY, (rust ? 2.2 : 2.8) * shadeFace(f) + L * .25); return set(i, ' ', 0), true;
};
// a tag on a ramp's side wall (about one in three of them): a word in a spray colour, outlined, low down where a
// writer could reach; the same on every visit
const SK_TAGS = ['SK8', 'RAD', 'ZOO', 'GNAR', 'OLLIE', 'DOGTOWN', 'SHRED', 'YARDS'];
function skSideTag(o, i, f, u, w, h, t, L) {
  if (f !== 3 && f !== 4) return false;
  const seed = hash(Math.floor(o.x * 10), Math.floor(o.y * 10) + f, 2120);
  if (seed > .38) return false;
  const word = SK_TAGS[Math.floor(seed * 100) % SK_TAGS.length], cw = Math.min(.035, o.hl * 1.2 / word.length), zc = Math.min(h * .55, .08), band = Math.min(.045, h * .6);
  if (band < .012 || Math.abs(w - zc) > band / 2) return false;
  const q = (f === 3 ? u : -u) / cw + word.length / 2; if (q < 0 || q >= word.length) return false;
  const col = [MAG, CYAN, GREEN, ORANGE, RED][Math.floor(seed * 1000) % 5], hz = (zc + band / 2 - w) / band, foot = t / projY;
  if (cw / foot >= 1.5 && band / foot >= 2.5) { const ch = blockGlyph(word, q, hz, foot / cw, foot / band); BG[i] = C(GRAY, 2.6 + L * .25); return set(i, ch || ' ', C(col, 12)), true; }
  BG[i] = C(col, 4 + L * .2); return set(i, ' ', 0), true; // (far off: a smear of its colour)
}
// the park's concrete (floorBaseCell): smooth, pale, saw-cut every 3 m, a few dark scuffs and wax marks
function skateparkFloor(wx, wy, r, x, d) {
  const foot = d / projY, joint = Math.max(coveGroove(wx, .3, .004, foot), coveGroove(wy, .3, .004, foot));
  const scuff = noise(wx * 9, wy * 9, 2102) > .78 ? .8 : 1;
  // each 3 m slab cured a shade different; wheel streaks crossing it the ways people push between the features (one
  // way more than the other); a hairline crack across the odd slab; flecks of aggregate up close
  const sx = Math.floor(wx / .3), sy = Math.floor(wy / .3), cure = (hash(sx, sy, 2121) - .5) * .18;
  const ang = hash(sx >> 1, sy >> 1, 2122) * Math.PI, marks = Math.max(skWheelMarks(wx, wy, Math.cos(ang), Math.sin(ang), .3, foot), skWheelMarks(wx, wy, -Math.sin(ang), Math.cos(ang), .15, foot) * .7);
  const crack = hash(sx, sy, 2123) > .86 && foot < .006 && Math.abs(fract(wx / .3) - .5 - (fract(wy / .3) - .5) * (hash(sx, sy, 2124) - .5) * 1.4 - Math.sin(wy * 60) * .02) < .006;
  const fleck = foot < .003 && hash(Math.floor(wx * 400), Math.floor(wy * 400), 2125) > .93;
  return [fleck ? '.' : ' ', GRAY, (2.3 - joint * .7 + cure - marks * .6 - (crack ? .45 : 0)) * scuff];
}
