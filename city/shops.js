// ===== the specialist shops: what's behind the doors that used to open on the one convenience store (rooms.js has
// the renderer, the store, and every other interior). A grocer's produce and fridges, a deli's counter under hanging
// salami, a hardware store's pegboard, a skate shop's wall of decks, the toy shop's train set, and so on. 24/7s and
// bodegas are still the corner store, with a few things of their own. Many aren't one box: there's a stockroom behind
// plastic strips, a back room behind a bead curtain, a beer cave, a lounge through an arch, a tea room through a moon
// gate, fitting rooms, toilets. What each sells goes by its sign (goods.js), not its room: the clerk stands at
// `keeper` behind a counter, as in every other shop, and E there opens the till.

// ---- bits of furniture, in metres (room coordinates). Shades follow the house style: (i, t, L) => paint, return true.
const BXD = (vx, vy, hl, hw, z0, z1, shade, ca = 1, sa = 0) => drawBox(boxAt(vx, vy, ca, sa, hl, hw, z0, z1), shade); // (inside a model's draw)
// a clothes rail along x: chrome uprights and rail, garments hanging off it in a run of colours
const clothesRack = (x, y, hl, seed, cols = ITEM_COL, long = false) => ROOM_MODEL(x, y, (vx, vy) => {
  for (const e of [-1, 1]) { rod(vx + e * hl, vy, 0, vx + e * hl, vy, 1.45, 0.015, GRAY, 1.2); rod(vx + e * hl, vy - 0.25, 0.01, vx + e * hl, vy + 0.25, 0.01, 0.015, GRAY, 1.2); }
  rod(vx - hl, vy, 1.45, vx + hl, vy, 1.45, 0.012, GRAY, 1.3);
  const n = Math.floor(hl * 2 / 0.11);
  for (let k = 0; k < n; k++) {
    const gx = vx - hl + (k + 0.5) * 2 * hl / n, col = cols[hash(k, seed, 61) * cols.length | 0], len = long || hash(k, seed, 62) > 0.7 ? 0.95 : 0.6;
    BXD(gx, vy, 0.022, 0.21, 1.4 - len, 1.4, (i, t, L) => { // a shirt on its hanger: sleeves folded in, a fold or two
      if (HIT.face === 1 || HIT.face === 2) { if (HIT.w > 1.3 && Math.abs(HIT.v) > 0.12 + (HIT.w - 1.3)) return false; }
      BG[i] = C(col, (1.3 + L * 0.3) * shadeFace(HIT.face)); return set(i, fract(HIT.v * 6) < 0.15 ? '|' : ' ', C(col, L * 0.5)), true;
    });
  }
}, [hl + 0.05, 0.28, 1.45]);
// a mannequin in an outfit, facing (fx, fy): a dress form (no head, no arms, no legs: a torso on a pole), so it's never
// mistaken for somebody standing there, even in the dark
const mannequin = (x, y, top, bot, col, fx = 0, fy = 1) => figProp(x, y, figLook({ hair: 'bald', top, bot, form: true,
  col: { skin: [WHITE, 12], top: [col, 11], inner: [WHITE, 13], bot: [GRAY, 4], shoe: [GRAY, 2], hair: [WHITE, 12] } }), { face: [fx, fy], chat: false, still: true, light: 6 });
// things hung from the ceiling on strings at (x, y): what hangs is drawn by thing(vx, vy, z), its top at z (string above)
const hung = (x, y, z, thing) => ROOM_MODEL(x, y, (vx, vy) => { rod(vx, vy, z, vx, vy, room.def.height || 3, 0.003, GRAY, 0.7); thing(vx, vy, z); });
// a ceiling fan, turning slowly: a drop rod, the motor, four wooden blades
const ceilingFan = (x, y, rate = 2.5) => ROOM_MODEL(x, y, (vx, vy) => {
  const top = room.def.height || 3;
  rod(vx, vy, top, vx, vy, top - 0.35, 0.015, GRAY, 1.1);
  drum(vx, vy, 0.09, top - 0.45, top - 0.33, CHROME);
  for (let k = 0; k < 4; k++) {
    const an = T * rate + k * Math.PI / 2, c = Math.cos(an), s_ = Math.sin(an);
    BXD(vx + c * 0.36, vy + s_ * 0.36, 0.27, 0.06, top - 0.41, top - 0.39, solid(BRICK, { top: '=' }), c, s_);
  }
});
// a television on (x, y, z) facing (fx, fy): a box with the picture on its front: static, or show(i, u, w) painting it
const tvSet = (x, y, z, fx, fy, hw = 0.3, show = null) => ROOM_MODEL(x, y, (vx, vy) => {
  BXD(vx, vy, 0.2, hw, z, z + hw * 1.5, (i, t, L) => {
    const sc = HIT.face === 1 && Math.abs(HIT.v) < hw - 0.04 && HIT.w > z + 0.05 && HIT.w < z + hw * 1.5 - 0.05;
    if (!sc) { BG[i] = C(GRAY, (1 + L * 0.2) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }
    if (show) return show(i, HIT.v / hw, (HIT.w - z) / (hw * 1.5));
    const k = hash(i, Math.floor(T * 15), 7); BG[i] = C(GRAY, 2 + k * 4); return set(i, k > 0.7 ? '#' : k > 0.4 ? ':' : '.', C(WHITE, 8 + k * 6)), true; // snow
  }, fx, fy);
});
// a shopper (somebody to talk to), browsing: standing about, facing the shelves
const shopper = (x, y, fx = 0, fy = -1) => ({ ...standing(x, y, shirt()), face: [fx, fy] });
const shoppers = (spots, p) => spots.filter(() => chance(p)).map(([x, y, fx, fy]) => shopper(x, y, fx, fy));
// a little sign hung over the aisles, facing the door
const aisleSign = (x, y, word, bg, col, hl = 0.45) => ({ x, y, draw: (vx, vy) => hallSign(vx, vy, hl, 2.3, 2.45, room.def.height || 3, word, bg, col) });
// which wall a wall painter's on
const backWall = my => my === 0, leftWall = mx => mx === 0, rightWall = mx => room && mx === room.W - 1;

// ---- the ways between a shop's rooms. Each fills a gap left in a wall of the grid, across it along (ca, sa), and
// none of them is in your way (walk: you go through the strips, the beads, the arch's opening)
// a lintel: the wall over a doorway, 2.2m up to the ceiling, so it reads as a door and not a slot to the roof
const lintel = (x, y, hl, ca, sa, col = GRAY) => BX(x, y, hl, 0.5, 2.2, 3, solid(col, { bright: 0.8 }), ca, sa);
// one along x with a word over the door, on the side toward the door you came in by (+y)
const lintelSign = (x, y, hl, word, bg, col, wall = GRAY) => ({ x, y, draw: (vx, vy) => drawBox(boxAt(vx, vy, 1, 0, hl, 0.5, 2.2, 3), (i, t, L) => {
  if (HIT.face === 3 && HIT.w < 2.52) { const ch = faceText(word, i, t, vx, vy, hl, 2.26, 0.22); BG[i] = bg; return set(i, ch && ch !== ' ' ? ch : ' ', col), true; }
  BG[i] = C(wall, (1 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }) });
// a strip curtain of heavy plastic, the stockroom's: you see the room behind between the strips, and push through
const stripCurtain = (x, y, hl, ca = 1, sa = 0) => ({ ...BX(x, y, hl, 0.02, 0, 2.2, (i, t, L) => {
  const f = fract((HIT.u + hl) / 0.2);
  if (HIT.face >= 5 || f < 0.5) return false; // (between the strips)
  BG[i] = C(CYAN, 0.8 + L * 0.05); return set(i, f > 0.9 ? '|' : ' ', C(WHITE, 7)), true;
}, ca, sa), walk: true });
// a curtain of beads on strings, swaying a little, every string its own run of colours
const beadCurtain = (x, y, hl, ca = 1, sa = 0) => ({ ...BX(x, y, hl, 0.02, 0, 2.15, (i, t, L) => {
  if (HIT.face >= 5) return false;
  const s = (HIT.u + hl) / 0.07 + Math.sin(T * 0.8 + HIT.w * 2) * 0.25, k = Math.floor(s);
  if (Math.abs(fract(s) - 0.5) > 0.22) return false;
  return set(i, fract(HIT.w * 9) < 0.55 ? 'o' : ':', C(NEON[(k + Math.floor(HIT.w * 9)) & 3], 11)), true;
}, ca, sa), walk: true });
// A wall with a hole through it, for drawBox: the box b (as rayBox's: u along it, v through it, w up) with b.hole cut
// right through it along v. The hole's outline is convex: an arch (straight sides a either side of the middle up to
// the springing s, then half an ellipse b high) or a circle (r across, its middle c up). The ray meets the wall's face,
// or, going in through the hole, the hole's own sides, the soffit (face 7), where it comes out of the outline before
// it's through the wall; or passes through. You can be in the hole yourself, walking through it
function inHole(u, w, h) {
  return h.r ? u * u + (w - h.c) ** 2 < h.r * h.r : Math.abs(u) < h.a && (w < h.s || (u / h.a) ** 2 + ((w - h.s) / h.b) ** 2 < 1);
}
function holeExit(lu, du, oz, rz, t0, h) { // the first t past t0 where the ray leaves the outline
  let best = Infinity;
  const take = t => { if (t > t0 + 1e-6 && t < best) best = t; };
  const ellipse = (A, B, C, ok) => {
    const qa = du * du / (A * A) + rz * rz / (B * B), qb = 2 * (lu * du / (A * A) + (oz - C) * rz / (B * B)), qc = lu * lu / (A * A) + (oz - C) ** 2 / (B * B) - 1, disc = qb * qb - 4 * qa * qc;
    if (qa < 1e-12 || disc < 0) return;
    for (const e of [-1, 1]) { const t = (-qb + e * Math.sqrt(disc)) / (2 * qa); if (ok(oz + rz * t)) take(t); }
  };
  if (h.r) ellipse(h.r, h.r, h.c, () => true);
  else {
    if (Math.abs(du) > 1e-12) for (const e of [-1, 1]) { const t = (e * h.a - lu) / du; if (oz + rz * t <= h.s) take(t); } // its straight sides
    ellipse(h.a, h.b, h.s, w => w >= h.s); // and the arch over them
  }
  return best;
}
function rayHoled(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y, lu = qx * b.c + qy * b.s, lv = -qx * b.s + qy * b.c, du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let tmin = -Infinity, tmax = Infinity, face = 0;
  const slab = (o, d, lo, hi, fLo, fHi) => {
    if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
    let t1 = (lo - o) / d, t2 = (hi - o) / d, f1 = fLo, f2 = fHi;
    if (t1 > t2) { [t1, t2] = [t2, t1]; f1 = fHi; f2 = fLo; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(lu, du, -b.hl, b.hl, 2, 1) || !slab(lv, dv, -b.hw, b.hw, 4, 3) || !slab(oz, rz, b.z0, b.z1, 6, 5) || tmax < 0.01) return -1;
  const t0 = Math.max(tmin, 0.01), u0 = lu + du * t0, w0 = oz + rz * t0;
  if (!inHole(u0, w0, b.hole)) { // the wall's own face (or, standing inside the wall itself, nothing)
    if (tmin < 0.01) return -1;
    HIT.face = face; HIT.u = u0; HIT.v = lv + dv * t0; HIT.w = w0; return t0;
  }
  const te = holeExit(lu, du, oz, rz, t0, b.hole);
  if (te >= tmax) return -1; // straight through
  HIT.face = 7; HIT.u = lu + du * te; HIT.v = lv + dv * te; HIT.w = oz + rz * te; return te;
}
// a wall with a hole through it filling a gap hl either side of (x, y), along (ca, sa): drawn by shade (face 7 is the
// hole's sides), and solid either side of the hole (to `side` out from the middle) where you'd walk into it
const holedWall = (x, y, hl, ca, sa, hole, side, shade) => [
  { x, y, draw: (vx, vy) => drawBox({ ...boxAt(vx, vy, ca, sa, hl, 0.5, 0, 3), hole }, shade, rayHoled) },
  ...[-1, 1].map(e => { const m = (hl + side) / 2, bx = x + ca * e * m, by = y + sa * e * m; return { x: bx, y: by, draw: () => {}, box: { x: bx, y: by, c: ca, s: sa, hl: (hl - side) / 2, hw: 0.5, z0: 0, z1: 3 } }; })];
// an archway: a round-headed opening, `open` either side of the middle, springing at 1.9m into a half ellipse, in a
// wall of brick; dressed stone round it and through it, a keystone at the top
const archway = (x, y, hl, ca, sa, col = BRICK, open = hl - 0.25, spring = 1.9) => holedWall(x, y, hl, ca, sa, { a: open, s: spring, b: open * 0.75 }, open, (i, t, L) => {
  const u = HIT.u, w = HIT.w;
  if (HIT.face === 7) { // the soffit: voussoirs over the arch, ashlar down the sides
    const course = w > spring ? Math.atan2(w - spring, u) / Math.PI * 9 : w * 3.3;
    BG[i] = C(STONE, (1.8 + L * 0.12) * (w > spring ? 0.8 : 1)); return set(i, fract(course) < 0.1 ? (w > spring ? '-' : '=') : fract(HIT.v * 2) < 0.04 ? '|' : ' ', C(GRAY, L * 0.6)), true;
  }
  const rim = Math.abs(u) < open + 0.12 && (w < spring + 0.05 ? Math.abs(u) > open - 0.01 : (u / (open + 0.12)) ** 2 + ((w - spring) / (open * 0.75 + 0.12)) ** 2 < 1);
  BG[i] = C(rim ? STONE : col, (rim ? 2.4 : 1.4) + L * 0.15);
  return set(i, rim && Math.abs(u) < 0.08 && w > spring + open * 0.6 ? '#' : rim ? '=' : fract(w * 4 + (Math.floor(u * 3) & 1) * 0.5) < 0.08 ? '-' : ' ', C(rim ? GRAY : WARM, L * 0.6)), true;
});
// a moon gate: a round opening r across, its middle zc up, in a red wall; a gold ring round it, and through it
const moonGate = (x, y, hl, ca, sa, r = 0.95, zc = 1.15) => holedWall(x, y, hl, ca, sa, { r, c: zc }, r * 0.72, (i, t, L) => {
  if (HIT.face === 7) { BG[i] = C(YEL, 2.4 + L * 0.15 + Math.sin(Math.atan2(HIT.w - zc, HIT.u)) * 0.6); return set(i, fract(HIT.v * 3) < 0.08 ? '-' : ' ', C(ORANGE, 9)), true; }
  const d = Math.hypot(HIT.u, HIT.w - zc);
  if (d < r + 0.07) { BG[i] = C(YEL, 4 + L * 0.2); return set(i, 'o', C(ORANGE, 12)), true; }
  BG[i] = C(RED, 1.2 + L * 0.1); return set(i, ' ', 0), true;
});
// cartons on a pallet, stacked as they came off the lorry
const cartons = (x, y, n, seed) => [BX(x, y, 0.5, 0.4, 0, 0.12, solid(BRICK, { panel: 0.2 })),
  ...Array.from({ length: n }, (_, k) => BX(x + (hash(k, seed, 1) - 0.5) * 0.12, y + (hash(k, seed, 2) - 0.5) * 0.1, 0.42, 0.34, 0.12 + k * 0.38, 0.12 + k * 0.38 + 0.37, (i, t, L) => {
    BG[i] = C(WARM, (2.2 + L * 0.25) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? (Math.abs(HIT.v) < 0.03 ? '=' : ' ') : Math.abs(HIT.w - 0.31 - k * 0.38) < 0.03 ? '-' : ' ', C(BRICK, L * 0.7)), true; }))];

// ---- floors and ceilings
Object.assign(ROOM_FLOORS, {
  // (each goes to its average once a pixel spans most of a repeat, so nothing shimmers far off)
  checker: (i, f, wx, wy, r, x, L) => { // a deli's black and white
    const fp = sharedFloorDepth(r); set(i, ' ', 0);
    if (fp > 0.25) { BG[i] = C(GRAY, 1.5 + f * 2); return; }
    BG[i] = (Math.floor(wx / 0.4) + Math.floor(wy / 0.4)) & 1 ? C(WHITE, 2 + f * 4) : C(GRAY, 0.6);
  },
  lino: (i, f, wx, wy, r, x, L) => { // speckled vinyl, the speckle close to
    const fp = sharedFloorDepth(r), h = fp < 0.04 ? hash(Math.floor(wx * 9), Math.floor(wy * 9), 51) : 0; set(i, ' ', 0);
    BG[i] = C(STONE, 1.3 + f * 2.5 + (h > 0.9 ? -0.7 : 0));
  },
  court: (i, f, wx, wy, r, x, L) => { // a sports shop's floor: maple boards, a basketball key painted on them
    const cx = room.W / 2, fp = sharedFloorDepth(r), w = Math.max(0.04, Math.min(fp, 0.12));
    const line = Math.abs(Math.hypot(wx - cx, wy - 1) - 3.2) < w || Math.abs(Math.abs(wx - cx) - 1.6) < w && wy < 4.2 || Math.abs(wy - 4.2) < w && Math.abs(wx - cx) < 1.6 || Math.abs(Math.hypot(wx - cx, wy - 4.2) - 1.2) < w;
    set(i, ' ', 0);
    BG[i] = line && fp < 0.3 ? C(WHITE, 4 + L * 0.3) : C(WARM, 1.3 + f * 2.5 + (fp < 0.2 ? (Math.floor(wx * 2) & 1) * 0.4 : 0.2));
  },
  kids: (i, f, wx, wy, r, x, L) => { // foam play tiles in four colours
    const fp = sharedFloorDepth(r), tx = Math.floor(wx / 0.6), ty = Math.floor(wy / 0.6); set(i, ' ', 0);
    if (fp > 0.3) { BG[i] = C(GRAY, 1.6 + f * 2); return; }
    BG[i] = C([RED, YEL, GREEN, BLUE][tx * 3 + ty * 5 & 3], 1.2 + f * 2.5 - 3 * Math.max(coveGroove(wx, 0.6, 0.012, fp), coveGroove(wy, 0.6, 0.012, fp)));
  },
  boards: (i, f, wx, wy, r, x, L) => { // old floorboards, and a rug in the middle of the room
    const fp = sharedFloorDepth(r), rug = Math.abs(wx - room.W / 2) < 2 && Math.abs(wy - room.H / 2 - 0.4) < 1.4; set(i, ' ', 0);
    if (rug) { BG[i] = C(Math.abs(wx - room.W / 2) > 1.85 || Math.abs(wy - room.H / 2 - 0.4) > 1.25 ? YEL : RED, 1 + f * 1.6); return; }
    BG[i] = C(BRICK, 1 + f * 1.6 + (fp < 0.15 ? (Math.floor(wx * 3) & 1) * 0.4 : 0.2) - 1.5 * coveGroove(wx, 1 / 3, 0.008, fp));
  },
});
const CEIL_SPOTS = { s: 2, r: 1.2, track: true };
Object.assign(ROOM_CEILS, {
  tin: (i, r, x, wx, wy) => { // pressed tin: a square motif on a grid, a lamp every 2m
    const fp = homeBalconyPavingFootprint(((room.def.height || 3) - eye) * projY / (hor - r - 0.5), (room.def.height || 3) - eye);
    set(i, ' ', 0);
    if (!prepareInteriorHanging() && ceilAt('pendant', CEIL_PENDANT, wx, wy) === 1) { BG[i] = C(WARM, 14); return; }
    const u = fract(wx / 0.6) - 0.5, v = fract(wy / 0.6) - 0.5;
    BG[i] = C(STONE, 2.4 - 1 * Math.max(coveGroove(wx, 0.6, 0.015, fp), coveGroove(wy, 0.6, 0.015, fp)) + (fp < 0.05 && Math.abs(Math.abs(u) + Math.abs(v) - 0.28) < 0.05 ? 0.8 : 0));
  },
  spots: (i, r, x, wx, wy) => { // black, with tracks of little spotlights
    set(i, ' ', 0);
    if (prepareInteriorHanging()) { BG[i] = C(GRAY, .7); return; }
    const k = ceilAt('spots', CEIL_SPOTS, wx, wy);
    BG[i] = k === 1 ? C(WHITE, 14) : k === 2 ? C(GRAY, 2.4) : C(GRAY, .5);
  },
});

// ---- the grocer (GROCERY, MARKET; FRUIT is more produce): fridges down the left, an aisle of shelves, tiered stands of
// fruit and veg, the checkout by the door with its belt running, and through the plastic strips at the back, the
// stockroom: cartons on pallets, bananas ripening
// (the produce stands, melon bin, baskets, crates and checkout are built: grocer-produce.js)
ROOM_DEFS.grocer = { grid: ['##############', '#.......#....#', '#..SS...#....#', '#..SS...##.###', '#..SS........#', '#..SS........#', '#............#', '#............#', '#............#', '######DD######'],
  light: 1, floor: 'tile', ceil: 'strip', sign: true, signAt: 6, keeper: [11.45, 7.6], glyphs: 'o#=@',
  wall: (i, u, uStep, z, d, mx, my, L) => {
    if (mx >= 8 && my <= 3) { BG[i] = C(GRAY, 1.6); return set(i, fract(u * 2.5 + (Math.floor(z * 5) & 1) * 0.5) < 0.05 || fract(z * 5) < 0.06 ? '+' : ' ', C(GRAY, L * 0.5)), true; } // the stockroom: bare breeze block
    return false; // (the fridges along the left and back walls are built: shop-fridges.js)
  },
  props: r => {
    const fruit = r.word === 'FRUIT', p = [CHECKOUT_COUNTER(10.65, 7.6, 0.85), standing(11.45, 7.6, GREEN), ...SHOP_FRIDGES.grocer(),
      PRODUCE_STAND(8.9, 4.9, 0.9, 63), PRODUCE_STAND(8.5, 6.6, 0.8, 70), // (a clear way down from the stockroom door, and between the two)
      ...(fruit ? [PRODUCE_STAND(6.5, 2.4, 0.8, 11)] : []), WATERMELON_BIN(12.2, 6.1),
      stripCurtain(10.5, 3.5, 0.5), lintelSign(10.5, 3.5, 0.5, 'STAFF', C(RED, 4), C(WHITE, 15)), // the way into the stockroom
      ...cartons(9.65, 1.5, 3, 1), ...cartons(12.4, 1.55, 4, 2), ...cartons(12.4, 2.55, 2, 3),
      KITCHEN_PRODUCE_CRATE(10.9, 1.35, 'banana'), BASKET_STACK(1.4, 8.5)]; // bananas ripening; baskets by the door
    p.push(aisleSign(8.9, 4.5, fruit ? 'FRESH FRUIT' : 'PRODUCE', C(GREEN, 4), C(WHITE, 15), 0.6));
    if (!fruit) p.push(aisleSign(4, 3.6, 'AISLE 1', C(BLUE, 4), C(WHITE, 15), 0.35));
    p.push(...shoppers([[2, 4, -1, 0], [7.2, 3.6, 1, 0], [7.2, 6, 0, -1], [5.6, 2.6, -1, 0]], 0.35));
    p.push(UPTURNED_CRATE(11.5, 2.6, 0.4), SEAT(11.5, 2.6, -1, 0, 0.4)); // an upturned crate
    if (chance(0.4)) p.push({ ...sitting(11.5, 2.6, GREEN, 0.4), face: [-1, 0] }); // somebody on their break, on it
    return p;
  } };

// ---- the deli (DELI, DELICATESSEN): a long glass counter of meats and cheeses under a rail of hanging salami, the
// slicer, "now serving" over it all, take a number, two little tables, and the customers' toilet in the front corner
const salami = (vx, vy, z) => drawRod(vx, vy, z, vx, vy, z - 0.42, 0.045, (i, t, L) => { BG[i] = C(BRICK, 1.4 + L * 0.2); return set(i, hash(i, 11) > 0.6 ? '.' : ' ', C(WHITE, 8)), true; });
const cheeseWheel = (vx, vy, z) => drum(vx, vy, 0.14, z - 0.14, z, (i, t, L) => { BG[i] = C(YEL, (2.5 + L * 0.3) * drumLit(0.14)); return set(i, HIT.face === 5 ? 'o' : '=', C(ORANGE, L * 0.7)), true; });
function deliWall(i, u, uStep, z, d, mx, my, L) {
  const footprint = Math.max(uStep, d / projY);
  if (backWall(my)) {
    if (z > 1.7 && z < 2.15 && Math.abs(u - room.W / 2) < 1.3) { // the number board: red digits, ticking over now and then
      BG[i] = C(GRAY, 0.6);
      return wallText(i, u, uStep, z, d, `NOW SERVING ${String(10 + Math.floor(T / 9) % 90)}`, room.W / 2, 1.93, 0.17, 0.26, C(RED, 15), C(GRAY, 0.6)) || (set(i, ' ', 0), true);
    }
    for (const [u0, items] of [[2.4, ['PASTRAMI 9', 'REUBEN 10', 'BLT 7']], [room.W - 2.4, ['SOUP 5', 'PICKLE 1', 'SALAD 6']]]) if (Math.abs(u - u0) < 1.4 && z > 1.35 && z < 2.25) { // chalkboards
      BG[i] = C(GRAY, 1);
      for (const [k, it] of items.entries()) if (wallText(i, u, uStep, z, d, it, u0, 2.08 - k * 0.27, 0.15, 0.22, C(WHITE, 13), C(GRAY, 1))) return true;
      return set(i, ' ', 0), true;
    }
    if (z < 1.25) { set(i, ' ', 0); BG[i] = C(WHITE, 2.8 + L * 0.1 - 3 * Math.max(coveGroove(u, 1 / 6, 0.006, footprint), coveGroove(z, 1 / 6, 0.006, d / projY))); return true; } // white tiles behind the counter
  }
  // (the left wall's fridges are built: shop-fridges.js)
  set(i, ' ', 0);
  if (z < 1.0) { BG[i] = C(GREEN, 1.4 + L * 0.1 - coveGroove(u, 1 / 3, 0.02, footprint)); return true; } // green panelling
  if (z < 1.05) { BG[i] = C(WARM, 3 + L * 0.2); return true; }
  BG[i] = C(STONE, 2 + L * 0.1); return true;
}
ROOM_DEFS.deli = { grid: ['##############', '#............#', '#............#', '#............#', '#.........W.W#', '#.........W..#', '#.........W..#', '#.........W..#', '######DD######'],
  wc: { x0: 11, y0: 5, x1: 13, y1: 8, sign: [10, 4, 10.5] }, light: 0.95, floor: 'checker', ceil: 'tin', sign: true, signAt: 7, wall: deliWall, keeper: [7, 1.52],
  props: r => {
    const p = [KITCHEN_FOOD_CASE(7,2.1,3,.4,1.25,'deli',WHITE), standing(7, 1.52, WHITE), standing(5, 1.52, WHITE), ...SHOP_FRIDGES.deli(),
      SHOP_COUNTER(7, 1.18, 4.5, 0.18, 0.95, 1, 0, GRAY), MEAT_SLICER(9.2, 1.18, 0.95, 0, 1), // the back counter, on the wall now, and the slicer on it
      TICKET_DISPENSER(2.2, 3.6, 0, 1), // take a number
      ...toilet(12.3, 7.55, 1, porcelain), washbasin(11.3, 6.1, 1, 0), // the toilet
    ];
    for (let k = 0; k < 7; k++) p.push(hung(4.4 + k * 0.85, 2.15, 2.3, k % 3 === 1 ? cheeseWheel : salami));
    for (const [x, y] of [[2.4, 5.4], [2.4, 7.1]]) { p.push(...tableBox(x, y, 0.35, 0.35), STOOL(x + 0.65, y, GREEN, 0.62)); if (chance(0.4)) p.push({ ...sitting(x + 0.65, y, shirt(), 0.62), face: [-1, 0] }); }
    p.push(...shoppers([[5.4, 3.2, 0, -1], [7.6, 3.1, 0, -1], [4, 3.6, 0, -1], [9.2, 3.4, 0, -1]], 0.5));
    return p;
  } };

// ---- the hardware store: pegboard of tools down both sides, paint along the back, two tall aisles of bins, ladders, a
// pyramid of paint cans, the counter by the door with the key cutter on it; and through the wide opening on the right,
// the garden centre: lumber, plants, bags of compost, a lawnmower
function hardwareWall(i, u, uStep, z, d, mx, my, L) {
  // (the aisles of bins are built gondolas: shop-gondolas.js)
  if (mx >= 13) { // garden walls keep their trellis, including the back wall
    const lattice = Math.abs(fract((u + z) * 2) - 0.5) < 0.06 || Math.abs(fract((u - z) * 2) - 0.5) < 0.06, leaf = noise(u * 3, z * 3, 61) > 0.62 && z < 2.4;
    BG[i] = C(leaf ? GREEN : STONE, leaf ? 1.6 : 1.4); return set(i, leaf ? '&' : lattice ? 'x' : ' ', C(leaf ? GREEN : WARM, leaf ? 8 : L * 0.5)), true;
  }
  if (backWall(my) && z < 2.1) { // paint: shelves of cans, each with its colour on the label
    if (fract(z / 0.42) < 0.1) return set(i, '=', C(GRAY, L)), true;
    const can = fract(u / 0.22), k = hash(Math.floor(u / 0.22), Math.floor(z / 0.42), 5);
    if (can < 0.12 || fract(z / 0.42) > 0.85) return set(i, ' ', 0), true;
    const band = Math.abs(fract(z / 0.42) - 0.45) < 0.15;
    BG[i] = band ? C(ITEM_COL[k * 8 | 0], 3) : C(GRAY, 2.5); return set(i, band ? ' ' : can > 0.85 ? '|' : ' ', C(GRAY, 6)), true;
  }
  if ((leftWall(mx) || rightWall(mx)) && z > 0.6 && z < 2.3) { // pegboard, hung with tools
    const k = hash(Math.floor(u / 0.3), Math.floor(z / 0.35), mx + 1), tool = fract(u / 0.3) > 0.25 && fract(u / 0.3) < 0.75 && fract(z / 0.35) > 0.2 && k > 0.35;
    BG[i] = C(BRICK, 1.4);
    if (tool) return set(i, 'T7/F!JL'[k * 70 % 7 | 0], C(k > 0.7 ? RED : k > 0.5 ? YEL : GRAY, 13)), true;
    return set(i, (Math.floor(u * 10) + Math.floor(z * 10)) & 1 ? '.' : ' ', C(BRICK, L * 0.5)), true;
  }
  return false;
}
const ladder = (x, y, h, lean, col = YEL) => ROOM_MODEL(x, y, (vx, vy) => { // leaning back against the wall behind it (-x)
  for (const e of [-0.2, 0.2]) rod(vx, vy + e, 0, vx - lean, vy + e, h, 0.018, col, 1.3);
  for (let k = 1; k < h / 0.3; k++) { const f = k * 0.3 / h; rod(vx - lean * f, vy - 0.2, k * 0.3, vx - lean * f, vy + 0.2, k * 0.3, 0.012, col, 1.2); }
}, [0.25, 0.25, h]);
const paintPyramid = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // cans on a pallet, four, three, two, one
  BXD(vx, vy, 0.5, 0.5, 0, 0.12, solid(BRICK, { panel: 0.2 }));
  for (let l = 0; l < 4; l++) for (let a_ = 0; a_ < 4 - l; a_++) for (let b = 0; b < 4 - l; b++) {
    const cx = vx + (a_ - (3 - l) / 2) * 0.24, cy = vy + (b - (3 - l) / 2) * 0.24, z0 = 0.12 + l * 0.25, col = ITEM_COL[(a_ + b * 3 + l * 5) & 7];
    drum(cx, cy, 0.11, z0, z0 + 0.24, (i, t, L) => { BG[i] = HIT.face === 5 ? C(GRAY, 3) : Math.abs(HIT.w - z0 - 0.12) < 0.05 ? C(col, 4) : C(GRAY, (2 + L * 0.3) * drumLit(0.11)); return set(i, HIT.face === 5 ? 'o' : ' ', C(GRAY, 8)), true; });
  }
}, [0.5, 0.5, 1.1]);
ROOM_DEFS.hardware = { grid: ['##################', '#............#...#', '#...SS..SS...#...#', '#...SS..SS.......#', '#...SS..SS.......#', '#...SS..SS.......#',
    '#............#...#', '#............#...#', '#............#...#', '########DD########'],
  light: 0.9, floor: 'concrete', ceil: 'strip', sign: true, signAt: 7, wall: hardwareWall, keeper: [2.6, 6.8],
  props: r => {
    const p = [SHOP_COUNTER(2.6, 7.5, 1.3, 0.32, 1.0, 1, 0, ORANGE), standing(2.6, 6.8, ORANGE),
      KEY_CUTTER(1.8, 7.55, 1.0, 0, 1), GAS_TILL(3.4, 7.55, 1.0, 0, -1), // the key cutter, wheel to the customer; the till, to the clerk
      paintPyramid(10.6, 7.4), ladder(1.25, 3, 2.3, 0.25), ladder(1.25, 4.1, 1.9, 0.2, GRAY),
      BULKHEAD(13.5, 4.5, 1.5, 0.5, 2.3, 3, 0, 1), // the beam over the opening
      aisleSign(15.5, 3.4, 'GARDEN', C(GREEN, 4), C(WHITE, 15), 0.4)];
    p.push(LUMBER(16.945, 2.41, Array.from({ length: 7 }, (_, k) => [-0.81 + k * 0.27, 2.5 - (k % 3) * 0.2]), 0, 1, 0.05, 0.12)); // lumber, stood on end against the wall
    p.push(HOSE_COILS(16.3, 5.4)); // coils of garden hose
    for (const [x, y, h] of [[14.4, 1.5, 1.4], [15.2, 1.45, 1.0], [14.5, 6.4, 1.6], [16.4, 6.6, 1.2]]) p.push(POT_PLANT(x, y, h));
    p.push(COMPOST_BAGS(16.2, 8.25)); // bags of compost
    p.push(ROOM_MODEL(14.6, 8.1, (vx, vy) => { // a lawnmower: the red deck on its wheels, the handle back up to waist height
      BXD(vx, vy, 0.28, 0.24, 0.08, 0.32, (i, t, L) => { BG[i] = C(RED, (2.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? 'o' : ' ', C(GRAY, 6)), true; });
      for (const [e, w] of [[-0.22, -0.2], [-0.22, 0.2], [0.22, -0.2], [0.22, 0.2]]) dot(vx + e, vy + w, 0.07, 0.07, (i, t, L) => { BG[i] = C(GRAY, 0.8); return set(i, 'o', C(GRAY, 5)), true; });
      for (const w of [-0.18, 0.18]) rod(vx, vy + w, 0.3, vx + 0.55, vy + w, 0.95, 0.012, GRAY, 1.2);
      rod(vx + 0.55, vy - 0.18, 0.95, vx + 0.55, vy + 0.18, 0.95, 0.015, GRAY, 1.2);
    }, [0.3, 0.26, 0.4]));
    for (const [x, y, w] of [[5, 3.9, 'TOOLS'], [9, 3.9, 'PLUMBING']]) p.push(aisleSign(x, y, w, C(ORANGE, 5), C(WHITE, 15), 0.5));
    p.push(...shoppers([[6.5, 3.2, -1, 0], [10.8, 4.4, 1, 0], [6.6, 5.4, 1, 0], [15, 4.6, 1, 0]], 0.4));
    return p;
  } };

Object.assign(ROOM_FOR, { GROCERY: 'grocer', DELI: 'deli', HARDWARE: 'hardware' }); // (MARKET, FRUIT, DELICATESSEN: storefronts.js)

// ---- painters for walls of things: each takes the wall's (i, u, z, L) and a seed, paints the cell and returns true,
// or returns false where the wall shows through
// skateboard decks hung on end in two rows, each its own graphic: stripes, a big dot, a slash, a checkerboard
function deckWall(i, u, z, L, seed) {
  const n = Math.floor(u / 0.3), du = fract(u / 0.3) * 0.3 - 0.15, row = z < 1.25 ? 0 : 1, z0 = row ? 1.38 : 0.35, dz = z - z0;
  if (dz < 0 || dz > 0.82 || Math.abs(du) > 0.105) return false;
  const e = Math.min(dz, 0.82 - dz); if (e < 0.1 && Math.hypot(du, 0.1 - e) > 0.105) return false; // (the rounded nose and tail)
  const k = hash(n, row, seed), base = ITEM_COL[k * 8 | 0], alt = ITEM_COL[(k * 8 + 3) & 7], kind = k * 41 % 4 | 0;
  const on = kind === 0 ? fract(dz * 5) < 0.5 : kind === 1 ? Math.hypot(du, dz - 0.41) < 0.08 : kind === 2 ? Math.abs(du - (dz - 0.41) * 0.4) < 0.03 : (Math.floor(du * 25) + Math.floor(dz * 12)) & 1;
  BG[i] = C(on ? alt : base, on ? 5 : 3); return set(i, Math.abs(du) > 0.09 ? '|' : ' ', C(GRAY, 9)), true;
}
// sneakers on little shelves, side on: a white sole, the upper in its colour, a swoosh of another
function shoeWall(i, u, z, L, seed) {
  if (z < 0.4 || z > 2.2) return false;
  const sh = fract((z - 0.4) / 0.36), dz = sh * 0.36;
  if (sh < 0.05) { BG[i] = C(WHITE, 3); return set(i, ' ', 0), true; } // the shelf
  const n = Math.floor(u / 0.34), du = fract(u / 0.34) * 0.34 - 0.17, k = hash(n, Math.floor((z - 0.4) / 0.36), seed);
  if (k < 0.15 || Math.abs(du) > 0.13 || dz > 0.03 + 0.1 - Math.max(0, du - 0.03) * 0.8) return false;
  set(i, ' ', 0);
  BG[i] = dz < 0.045 ? C(WHITE, 5) : C(ITEM_COL[k * 8 | 0], 3); return true; // the sole, the upper
}
// football shirts hung flat, a number on each
function jerseyWall(i, u, z, L, seed) {
  const n = Math.floor(u / 0.62), du = fract(u / 0.62) * 0.62 - 0.31, dz = z - 1.25;
  if (dz < 0 || dz > 0.62) return false;
  const body = Math.abs(du) < 0.17 && dz < 0.58, sleeve = Math.abs(du) < 0.29 && dz > 0.42 && dz < 0.58 - (Math.abs(du) - 0.17) * 0.4;
  if (!body && !sleeve) return false;
  const k = hash(n, 1, seed), col = ITEM_COL[k * 7 | 0], trim = ITEM_COL[(k * 7 + 4) & 7];
  set(i, ' ', 0);
  if (Math.abs(du) < 0.05 && dz > 0.54) { BG[i] = C(GRAY, 1); return true; } // the collar
  BG[i] = Math.abs(du) < 0.05 && Math.abs(dz - 0.3) < 0.08 ? C(WHITE, 9) : C(sleeve && !body ? trim : col, 3.5); return true; // (a white number patch)
}
// rows of boxed toys: boxes of different sizes, each with a window to see what's in it
function toyBoxWall(i, u, z, L, seed) {
  if (z > 2.25) return false;
  const shelf = Math.floor(z / 0.5), sz = fract(z / 0.5) * 0.5;
  if (sz < 0.04) { set(i, ' ', 0); BG[i] = C(WHITE, 2.8 + L * 0.2); return true; }
  const w = 0.25 + hash(Math.floor(u / 0.5), shelf, seed) * 0.2, n = Math.floor(u / w), fu = fract(u / w), k = hash(n, shelf, seed + 1), h = 0.25 + k * 0.2;
  if (sz > h || fu < 0.06) return false;
  const win = fu > 0.2 && fu < 0.8 && sz > 0.08 && sz < h - 0.08;
  set(i, ' ', 0);
  BG[i] = win ? C(ITEM_COL[(k * 8 + 2) & 7], 2.4) : C(ITEM_COL[k * 8 | 0], 3.5); return true;
}
// a pharmacy's shelves: small white boxes with a coloured stripe, row on row
function boxesWall(i, u, z, L, seed) {
  if (z > 2.2 || z < 0.2) return false;
  if (fract(z / 0.3) < 0.08) return set(i, '=', C(GRAY, L)), true;
  const n = Math.floor(u / 0.12), k = hash(n, Math.floor(z / 0.3), seed), fz = fract(z / 0.3);
  if (fract(u / 0.12) < 0.15 || fz > 0.8 || k < 0.1) return set(i, ' ', 0), true;
  BG[i] = Math.abs(fz - 0.45) < 0.1 ? C(ITEM_COL[k * 8 | 0], 4) : C(WHITE, 3.5); return set(i, ' ', 0), true;
}
// a bike, side on along x: two spoked wheels, the frame, the saddle and bars
function drawBicycle(vx, vy, col) {
  for (const e of [-1, 1]) {
    const cx = vx + e * 0.5;
    for (let k = 0; k < 14; k++) { const a0 = k / 14 * TAU, a1 = (k + 1) / 14 * TAU; rod(cx + Math.cos(a0) * 0.33, vy, 0.34 + Math.sin(a0) * 0.33, cx + Math.cos(a1) * 0.33, vy, 0.34 + Math.sin(a1) * 0.33, 0.018, GRAY, 0.8); }
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI; rod(cx - Math.cos(a) * 0.31, vy, 0.34 - Math.sin(a) * 0.31, cx + Math.cos(a) * 0.31, vy, 0.34 + Math.sin(a) * 0.31, 0.004, GRAY, 1.3); }
  }
  const bb = [vx - 0.05, 0.3], seat = [vx - 0.18, 0.86], head = [vx + 0.32, 0.86];
  for (const [a_, b] of [[[vx - 0.5, 0.34], bb], [bb, seat], [seat, [vx - 0.5, 0.34]], [seat, head], [head, bb], [head, [vx + 0.5, 0.34]]]) rod(a_[0], vy, a_[1], b[0], vy, b[1], 0.02, col, 1.3);
  rod(seat[0], vy, seat[1], seat[0] - 0.02, vy, seat[1] + 0.1, 0.015, GRAY, 1);
  BXD(seat[0] - 0.04, vy, 0.12, 0.05, seat[1] + 0.1, seat[1] + 0.14, solid(GRAY));
  rod(head[0], vy, head[1], head[0] - 0.05, vy, head[1] + 0.18, 0.015, GRAY, 1.1); rod(head[0] - 0.05, vy - 0.22, head[1] + 0.18, head[0] - 0.05, vy + 0.22, head[1] + 0.18, 0.015, GRAY, 1.1);
}
const bike = (x, y, col) => ROOM_MODEL(x, y, (vx, vy) => drawBicycle(vx, vy, col), [0.85, 0.25, 1.05]);

// ---- the skate shop (SKATE): a wall of decks behind the counter, sneakers down one side, tags down the other, a
// quarter pipe in the corner for trying a board, a rack of hoodies, a couple of skaters hanging about
function skateWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z < 2.25 && deckWall(i, u, z, L, 21)) return true;
  if (leftWall(mx) && my > 0 && shoeWall(i, u, z, L, 22)) return true;
  if (rightWall(mx) && z < 2.6) { // tags and throw-ups, sprayed over each other
    const n = noise(u * 1.6, z * 2.2, 23), m = noise(u * 5, z * 6, 24), col = NEON[(Math.floor(u * 0.7) + Math.floor(z)) & 3];
    if (n > 0.55) { BG[i] = C(col, 2 + (n - 0.55) * 8); return set(i, m > 0.6 ? '~' : m > 0.45 ? 'S' : ' ', C(WHITE, 13)), true; }
    BG[i] = C(GRAY, 1.2); return set(i, m > 0.82 ? '*' : (Math.floor(u * 4) + Math.floor(z * 4)) % 5 ? ' ' : '.', C(NEON[(n * 40) & 3], 12)), true;
  }
  if (z < 0.9) { BG[i] = C(GRAY, 1); return set(i, fract(u * 2.5) < 0.06 ? '|' : ' ', C(GRAY, L * 0.5)), true; }
  return false;
}
// a quarter pipe along y, its deck at the +x end against the wall: slices of plywood climbing the curve, steel coping on top
const quarterPipe = (x, y, hw) => ROOM_MODEL(x, y, (vx, vy) => {
  const R = 1.25, n = 12, len = 1.15;
  for (let k = 0; k < n; k++) {
    const u0 = k / n * len, u1 = (k + 1) / n * len, z = R - Math.sqrt(Math.max(0, R * R - u1 * u1));
    BXD(vx - len / 2 + (u0 + u1) / 2, vy, (u1 - u0) / 2 + 0.002, hw, 0, z, (i, t, L) => {
      const f = HIT.face;
      if (f === 5) { BG[i] = C(WARM, 2 + L * 0.3); return set(i, fract(HIT.v * 1.2) < 0.03 ? '|' : '=', C(BRICK, L * 0.5)), true; }
      BG[i] = C(BRICK, (1.4 + L * 0.25) * shadeFace(f)); return set(i, f === 1 || f === 2 ? '#' : ' ', C(WARM, L * 0.4)), true;
    });
  }
  const top = R - Math.sqrt(R * R - len * len);
  rod(vx + len / 2, vy - hw, top + 0.02, vx + len / 2, vy + hw, top + 0.02, 0.03, GRAY, 1.6); // the coping
  BXD(vx + len / 2 + 0.25, vy, 0.25, hw, 0, top, solid(BRICK, { top: '=', panel: 0.4 })); // the deck behind it
}, [0.85, 1.3, 1]);
const skateboard = (x, y, a_ = 0.4) => ROOM_MODEL(x, y, (vx, vy) => {
  const c = Math.cos(a_), s_ = Math.sin(a_);
  BXD(vx, vy, 0.4, 0.1, 0.09, 0.11, (i, t, L) => { BG[i] = HIT.face === 5 ? C(GRAY, 0.8) : C(ORANGE, 3); return set(i, HIT.face === 5 ? ':' : '=', C(GRAY, 6)), true; }, c, s_);
  for (const e of [-0.28, 0.28]) for (const w of [-0.08, 0.08]) dot(vx + c * e - s_ * w, vy + s_ * e + c * w, 0.035, 0.032, (i, t, L) => { BG[i] = C(YEL, 6); return set(i, 'o', C(WHITE, 12)), true; });
});
ROOM_DEFS.skate = { grid: boxRoom(12, 9), light: 0.85, floor: 'concrete', ceil: 'spots', sign: true, signAt: 6, neon: true, wall: skateWall, keeper: [3.3, 1.45],
  props: r => {
    const p = [...glassCase(3.3, 2.3, 1.4, 0.35, 1.05, caseGoods('skate', [YEL, RED, CYAN, WHITE, GREEN], false, 31), MAG), standing(3.3, 1.45, r.neon),
      quarterPipe(10.35, 3.2, 1.25), clothesRack(2.4, 6.6, 0.9, 32, [GRAY, RED, BLUE, GREEN, WHITE, ORANGE]), skateboard(7.8, 7.2), skateboard(9.6, 5.6, -0.9)];
    const kid = (x, y, fx, fy) => figProp(x, y, figAnyone(shirt(), { hat: chance(0.5) ? 'cap' : 'beanie', top: pick(['tee', 'long', 'jacket']), bot: pick(['pants', 'shorts']) }), { face: [fx, fy] });
    if (chance(0.7)) p.push(kid(8.6, 4.6, 1, -0.4)); // watching somebody's line
    if (chance(0.6)) p.push(kid(2.1, 4.6, -1, 0)); // trying on shoes
    if (chance(0.4)) p.push(kid(5, 3.2, 0, -1));
    return p;
  } };

// ---- the sports shop (SPORTS): a court painted on the floor, team shirts along the back, trainers down the side, bins of
// balls, a bike on display, a treadmill to try
function sportsWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && jerseyWall(i, u, z, L, 41)) return true;
  if (leftWall(mx) && my > 0 && shoeWall(i, u, z, L, 42)) return true;
  if (rightWall(mx) && z > 0.5 && z < 2.3) { // rackets and bats on hooks
    const n = Math.floor(u / 0.3), du = fract(u / 0.3) * 0.3 - 0.15, k = hash(n, 2, 43), col = ITEM_COL[k * 8 | 0];
    if (k < 0.5) { const r = Math.hypot(du / 0.11, (z - 1.85) / 0.17); if (r < 1) { BG[i] = r > 0.8 ? C(col, 5) : C(WHITE, 3); return set(i, ' ', 0), true; }
      if (Math.abs(du) < 0.02 && z > 1.1 && z < 1.7) { BG[i] = C(GRAY, 3); return set(i, ' ', 0), true; } }
    else if (Math.abs(du) < 0.03 + (z - 0.6) * 0.035 && z > 0.6 && z < 1.6) { BG[i] = C(BRICK, 3); return set(i, ' ', 0), true; } // a bat
  }
  if (my > 0 && z < 0.3) { BG[i] = C(GRAY, 1.6 + L * 0.15); return set(i, ' ', 0), true; }
  return false;
}
const ballBin = (x, y, kinds) => ROOM_MODEL(x, y, (vx, vy) => { // a wire bin, heaped with balls
  BXD(vx, vy, 0.45, 0.45, 0, 0.75, (i, t, L) => { const f = HIT.face; if (f >= 5) return false; const a_ = f <= 2 ? HIT.v : HIT.u;
    return Math.abs(fract(a_ * 6) - 0.5) > 0.4 || HIT.w > 0.72 || HIT.w < 0.05 ? (set(i, HIT.w > 0.72 ? '=' : '|', C(GRAY, L)), true) : false; });
  for (let k = 0; k < 9; k++) {
    const [col, r] = kinds[k % kinds.length], ax = (k % 3 - 1) * 0.27, ay = (Math.floor(k / 3) - 1) * 0.27;
    dot(vx + ax, vy + ay, 0.65 + r * 0.5 + (k & 1) * 0.04, r, (i, t, L) => { BG[i] = C(col, 3 + L * 0.3); return set(i, col === WHITE ? (hash(i, 4) > 0.6 ? '#' : ' ') : col === ORANGE ? (fract(HIT.w * 9) < 0.15 ? '-' : ' ') : ' ', C(GRAY, 3)), true; });
  }
}, [0.45, 0.45, 0.95]);
ROOM_DEFS.sports = { grid: boxRoom(14, 9), light: 1, floor: 'court', ceil: 'strip', sign: true, signAt: 7, wall: sportsWall, keeper: [11.2, 6.6],
  props: r => {
    const p = [SHOP_COUNTER(11.2, 7.25, 1.1, 0.3, 1.0, 1, 0, BLUE), standing(11.2, 6.6, BLUE),
      ballBin(4, 5.5, [[ORANGE, 0.12], [WHITE, 0.11]]), ballBin(9.8, 4.2, [[YEL, 0.035], [WHITE, 0.11], [ORANGE, 0.12]]),
      bike(7, 2.6, RED), FLOOR_MAT(7, 2.6, 0.9, 0.3, 0.04), TREADMILL(12.4, 2.4), WEIGHT_RACK(3, 1.35)];
    p.push(...shoppers([[2.2, 4.4, -1, 0], [5.6, 3.3, 0, -1], [8.6, 6, 1, -0.5]], 0.45));
    return p;
  } };

// ---- the toy shop (TOYS): boxed toys floor to ceiling, an aisle of plush, the train set going round on its table with a
// kid watching it, a giant teddy, a rocking horse, balloons up against the ceiling
const trainSet = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  const a = 0.75, b = 0.38, top = 0.75;
  BXD(vx, vy, 0.95, 0.6, 0, top, (i, t, L) => { const f = HIT.face; if (f === 5) { BG[i] = C(GREEN, 2 + L * 0.2); // the baseboard: grass, the track's oval
      const q = Math.hypot(HIT.u / a, HIT.v / b); return set(i, Math.abs(q - 1) < 0.06 ? '=' : hash(Math.floor(HIT.u * 20), Math.floor(HIT.v * 20), 3) > 0.9 ? '"' : ' ', C(Math.abs(q - 1) < 0.06 ? GRAY : GREEN, 10)), true; }
    BG[i] = C(BRICK, (1.3 + L * 0.25) * shadeFace(f)); return set(i, ' ', 0), true; });
  dot(vx, vy, top + 0.08, 0.14, (i, t, L) => { BG[i] = C(GREEN, 1.6 + L * 0.2); return set(i, HIT.w > top + 0.17 ? '^' : '%', C(WHITE, 8)), true; }); // a hill in the middle, snow on top
  for (let k = 0; k < 4; k++) { // the engine and three cars, round and round
    const th = T * 0.9 - k * 0.32, ex = Math.cos(th) * a, ey = Math.sin(th) * b, tx = -Math.sin(th) * a, ty = Math.cos(th) * b, tl = Math.hypot(tx, ty);
    BXD(vx + ex, vy + ey, 0.075, 0.04, top + 0.01, top + (k ? 0.08 : 0.1), (i, t, L) => { BG[i] = C(k ? ITEM_COL[k + 1] : RED, 3 + L * 0.3); return set(i, k ? ' ' : HIT.face === 1 ? 'o' : ' ', C(YEL, 15)), true; }, tx / tl, ty / tl);
    if (!k) dot(vx + ex + tx / tl * 0.03, vy + ey + ty / tl * 0.03, top + 0.14 + fract(T * 2) * 0.12, 0.025 + fract(T * 2) * 0.02, (i, t, L) => { BG[i] = C(WHITE, 6 - fract(T * 2) * 4); return set(i, ' ', 0), true; }); // a puff of steam
  }
}, [0.95, 0.6, 0.75]);
const teddy = (x, y, s = 1) => ROOM_MODEL(x, y, (vx, vy) => {
  const fur = (i, t, L) => { BG[i] = C(BRICK, (2 + L * 0.3)); return set(i, hash(i, 2) > 0.7 ? '"' : ' ', C(WARM, 8)), true; };
  dot(vx, vy, 0.45 * s, 0.45 * s, fur); dot(vx, vy + 0.05 * s, 1.08 * s, 0.3 * s, fur);
  for (const e of [-1, 1]) { dot(vx + e * 0.22 * s, vy + 0.02, 1.33 * s, 0.1 * s, fur); dot(vx + e * 0.42 * s, vy + 0.15 * s, 0.55 * s, 0.15 * s, fur); dot(vx + e * 0.25 * s, vy + 0.3 * s, 0.13 * s, 0.17 * s, fur);
    dot(vx + e * 0.1 * s, vy + 0.31 * s, 1.15 * s, 0.03 * s, (i, t, L) => { BG[i] = C(GRAY, 0.5); return set(i, ' ', 0), true; }); } // its eyes
  dot(vx, vy + 0.3 * s, 1.03 * s, 0.09 * s, (i, t, L) => { BG[i] = C(WARM, 4); return set(i, HIT.w > 1.04 * s ? 'o' : ' ', C(GRAY, 1)), true; }); // the muzzle, its nose
  dot(vx, vy + 0.4 * s, 0.55 * s, 0.16 * s, (i, t, L) => { BG[i] = C(RED, 4); return set(i, ' ', 0), true; }); // a bow
}, [0.5 * s, 0.5 * s, 1.4 * s]);
const rockingHorse = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // along x, its head at +x, rocking
  const rk = Math.sin(T * 1.6) * 0.04, paint = (col, k = 3) => (i, t, L) => { BG[i] = C(col, k + L * 0.25 * shadeFace(HIT.face)); return set(i, ' ', 0), true; };
  for (const e of [-0.15, 0.15]) for (let k = 0; k < 8; k++) { const a0 = -0.6 + k * 0.15, a1 = a0 + 0.15; rod(vx + Math.sin(a0) * 0.9, vy + e, 0.95 - Math.cos(a0) * 0.9 + (a0 > 0 ? -rk : rk) * a0 * 3, vx + Math.sin(a1) * 0.9, vy + e, 0.95 - Math.cos(a1) * 0.9 + (a1 > 0 ? -rk : rk) * a1 * 3, 0.025, RED, 1.2); }
  BXD(vx, vy, 0.38, 0.12, 0.45 + rk, 0.68 + rk, paint(WHITE, 4));
  BXD(vx + 0.36, vy, 0.1, 0.08, 0.68 + rk * 2, 0.95 + rk * 2, paint(WHITE, 4)); BXD(vx + 0.48, vy, 0.12, 0.07, 0.85 + rk * 2, 0.98 + rk * 2, paint(WHITE, 4)); // neck, head
  BXD(vx + 0.33, vy, 0.06, 0.09, 0.85 + rk * 2, 1.0 + rk * 2, paint(BRICK, 2)); // the mane
  for (const e of [-0.3, 0.3]) for (const w of [-0.08, 0.08]) rod(vx + e, vy + w, 0.45 + rk, vx + e * 1.2, vy + w, 0.2, 0.02, WHITE, 1.2);
  BXD(vx - 0.05, vy, 0.12, 0.13, 0.68 + rk, 0.71 + rk, paint(RED, 3)); // the saddle
}, [0.7, 0.25, 1]);
const balloon = (x, y, col) => ({ x, y, draw: (vx, vy) => { const z = (room.def.height || 3) - 0.22 + Math.sin(T * 1.3 + x * 3) * 0.02;
  dot(vx, vy, z, 0.17, (i, t, L) => { BG[i] = C(col, 4 + L * 0.3); return set(i, HIT.w > z + 0.08 && hash(i, 1) > 0.5 ? '.' : ' ', C(WHITE, 14)), true; });
  rod(vx, vy, z - 0.17, vx + Math.sin(T + x) * 0.05, vy, z - 1.1, 0.003, WHITE, 0.8); } });
function toysWall(i, u, uStep, z, d, mx, my, L) {
  if (my < room.H - 1 && toyBoxWall(i, u, z, L, mx * 13 + my)) return true;
  if (my < room.H - 1 && z < 2.25) { BG[i] = C(WHITE, 1.5); return set(i, ' ', 0), true; } // the back of the shelves
  if (z > 2.3 && z < 2.42) { BG[i] = C(ITEM_COL[Math.floor(u * 2) & 7], 7); return set(i, ' ', 0), true; } // bunting
  return false;
}
ROOM_DEFS.toys = { grid: boxRoom(12, 9, { '2,2': 'S', '3,2': 'S', '2,3': 'S', '3,3': 'S' }), light: 1, floor: 'kids', ceil: 'strip', sign: true, signAt: 6, wall: toysWall, keeper: [2.6, 6.55], glyphs: '@&*%o8',
  props: r => {
    const p = [SHOP_COUNTER(2.6, 7.25, 1.2, 0.3, 0.95, 1, 0, [RED, BLUE, GREEN, YEL]),
      standing(2.6, 6.55, YEL), trainSet(6.4, 4.4), teddy(10.6, 1.6), rockingHorse(9.6, 6.4)];
    for (const [x, y, col] of [[5.2, 2.2, RED], [6, 1.6, YEL], [7.4, 2.4, CYAN], [8.6, 3.8, MAG], [4.4, 5.6, GREEN], [7.6, 6.4, BLUE]]) p.push(balloon(x, y, col));
    if (chance(0.8)) p.push(figProp(7.65, 4.6, figAnyone(shirt(), { kid: true, bot: 'shorts' }), { h: 1.15, face: [-1, -0.2] })); // a kid watching the train go round
    if (chance(0.5)) p.push(shopper(8.3, 5.4, -0.7, -0.7)); // and their mum or dad
    p.push(...shoppers([[4.5, 2.6, -1, 0], [8.6, 2.6, 0, -1]], 0.4));
    return p;
  } };

// ---- second-hand (THRIFT), ANTIQUES, a TAILOR: one shell of old boards and pendant lamps, furnished three ways, with
// two little fitting rooms behind curtains in the back corner
// a curtain on a rail across an opening: heavy cloth in folds, stopping short of the floor; you push through it
const clothCurtain = (x, y, hl, col, ca = 0, sa = 1) => ({ ...BX(x, y, hl, 0.02, 0.12, 2.05, (i, t, L) => {
  if (HIT.face >= 5) return false;
  const fold = fract((HIT.u + hl) / 0.16 + Math.sin(T * 0.5) * 0.05);
  BG[i] = C(col, (1.2 + Math.abs(fold - 0.5) * 2) + L * 0.15); return set(i, fold < 0.08 ? '|' : HIT.w > 1.98 ? 'o' : ' ', C(col, L * 0.6)), true;
}, ca, sa), walk: true });
const clockTall = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // a grandfather clock against the back wall: the face, the pendulum swinging
  BXD(vx, vy, 0.24, 0.16, 0, 2.1, (i, t, L) => {
    const f = HIT.face, u = HIT.u, w = HIT.w;
    if (f === 3 && Math.hypot(u, w - 1.78) < 0.17) { // the face: two hands telling the real time
      const an = Math.atan2(u, w - 1.78), rr = Math.hypot(u, w - 1.78), hh = mod(tod, 12) / 12 * TAU, mm = fract(tod) * TAU, off = (q, len) => Math.abs(mod(an - q + Math.PI, TAU) - Math.PI) < 0.25 && rr < len;
      BG[i] = C(WHITE, 4); return set(i, off(mm, 0.15) ? '|' : off(hh, 0.1) ? '#' : rr > 0.14 ? '.' : ' ', C(GRAY, 1)), true;
    }
    if (f === 3 && w > 0.5 && w < 1.45 && Math.abs(u) < 0.13) { // the window, the pendulum behind it
      const sw = Math.sin(T * Math.PI) * 0.08 * (1.45 - w) / 0.95; // (from the pivot at the top, a swing a second)
      BG[i] = C(BRICK, 0.8); return set(i, Math.abs(u - sw) < 0.025 ? (w < 0.7 ? 'O' : '|') : ' ', C(YEL, 13)), true;
    }
    BG[i] = C(BRICK, (1.6 + L * 0.3) * shadeFace(f)); return set(i, f === 5 ? '^' : fract(w * 2) < 0.04 ? '-' : ' ', C(YEL, L * 0.6)), true;
  });
}, [0.24, 0.16, 2.1]);
const armchair = (x, y, fx, fy, col = BRICK) => [ARMCHAIR(x, y, fx, fy, col), SEAT(x, y, fx, fy, 0.42)]; // (built: shop-fittings.js)
const lampStand = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { // a standard lamp: a fringed shade, glowing
  rod(vx, vy, 0, vx, vy, 1.45, 0.012, BRICK, 1.2); drum(vx, vy, 0.14, 0, 0.03, solid(BRICK));
  BXD(vx, vy, 0.2, 0.2, 1.35, 1.65, (i, t, L) => { if (Math.hypot(HIT.u, HIT.v) > 0.2 - (HIT.w - 1.35) * 0.3 && HIT.face < 5) return false; BG[i] = C(WARM, 7); return set(i, HIT.w < 1.38 ? "'" : ' ', C(YEL, 13)), true; });
}, [0.15, 0.15, 1.6]);
const dressForm = (x, y, col) => ROOM_MODEL(x, y, (vx, vy) => { // a tailor's dummy on its stand, half dressed
  rod(vx, vy, 0, vx, vy, 0.95, 0.015, GRAY, 1.2); for (let k = 0; k < 3; k++) { const an = k / 3 * TAU; rod(vx, vy, 0.05, vx + Math.cos(an) * 0.22, vy + Math.sin(an) * 0.22, 0, 0.012, GRAY, 1.1); }
  for (const [z, r] of [[1.0, 0.15], [1.15, 0.13], [1.3, 0.16], [1.45, 0.17]]) drum(vx, vy, r, z - 0.08, z + 0.08, (i, t, L) => { BG[i] = C(z > 1.2 ? col : STONE, (2 + L * 0.3) * drumLit(r)); return set(i, ' ', 0), true; });
  drum(vx, vy, 0.05, 1.53, 1.62, solid(BRICK));
}, [0.22, 0.22, 1.6]);
function oldWall(i, u, uStep, z, d, mx, my, L) {
  const w = room.word, footprint = Math.max(uStep, d / projY);
  if (w === 'TAILOR' && backWall(my) && z < 2.3) { // bolts of cloth on end, row on row
    set(i, ' ', 0);
    if (fract(z / 0.55) < 0.07) { BG[i] = C(BRICK, 2.4 + L * 0.15); return true; }
    const k = hash(Math.floor(u / 0.17), Math.floor(z / 0.55), 71), du = fract(u / 0.17) - 0.5, col = ITEM_COL[k * 8 | 0];
    if (Math.abs(du) > 0.45) return true;
    BG[i] = C(k > 0.85 ? GRAY : col, 2 + (0.5 - Math.abs(du)) * 3); return true;
  }
  if (rightWall(mx) && (my === 1 || my === 3) && z > 0.3 && z < 2) { set(i, ' ', 0); BG[i] = C(CYAN, 1.4 + z * 0.4); return true; } // a fitting room's mirror
  if (mx === 9 && my === 2 && wallText(i, u, uStep, z, d, 'FITTING', 2.5, 1.95, 0.13, 0.2, C(YEL, 14), C(BRICK, 1))) return true;
  if (w === 'THRIFT' && leftWall(mx) && my > 0 && shoeWall(i, u, z, L, 72)) return true;
  set(i, ' ', 0);
  if ((w !== 'THRIFT' || rightWall(mx)) && my > 0 && my < room.H - 1 && z > 1.1 && z < 2.3) { // pictures in gilt frames: a landscape, a portrait, the sea
    const n = Math.floor(u / 1.4), fu = fract(u / 1.4), k = hash(n, mx * 3 + my, 73), h = 0.5 + k * 0.4, fz = (z - 1.2) / h;
    if (fu > 0.18 && fu < 0.82 && fz > 0 && fz < 1 && k > 0.3) {
      if (fu < 0.22 || fu > 0.78 || fz < 0.06 || fz > 0.94) { BG[i] = C(YEL, 4 + L * 0.15); return true; }
      const sky = fz > 0.55 - noise(u * 4, 0, n) * 0.2, kind = k * 9 | 0;
      BG[i] = kind % 3 === 0 ? C(sky ? CYAN : GREEN, 2 + fz) : kind % 3 === 1 ? C(Math.hypot((fu - 0.5) * 2, fz - 0.55) < 0.35 ? SKIN : BRICK, 2.5) : C(sky ? WARM : BLUE, 2 + fz * 1.5);
      return true;
    }
  }
  if (z < 0.9) { BG[i] = C(BRICK, 1.4 + L * 0.1 - coveGroove(u, 1 / 3, 0.02, footprint)); return true; } // panelling
  if (z < 0.95) { BG[i] = C(YEL, 2.6 + L * 0.2); return true; }
  BG[i] = C(w === 'TAILOR' ? STONE : GREEN, 1.5 + L * 0.08); return true; // faded wallpaper
}
ROOM_DEFS.thrift = { grid: ['############', '#..........#', '#........###', '#..........#', '#........###', '#..........#', '#..........#', '#..........#', '#####DD#####'], light: 0.8, floor: 'boards', ceil: 'pendant', sign: true, signAt: 6, shelves: r => r.word === 'THRIFT' && { kind: 'thrift', to: 8.6, timber: true }, glyphs: '&%@o*', wall: oldWall, keeper: [9.8, 6.55],
  props: r => {
    const w = r.word, p = [SHOP_COUNTER(9.8, 7.25, 1.0, 0.3, 0.95, 1, 0, BRICK), standing(9.8, 6.55, w === 'TAILOR' ? GRAY : r.neon),
      clothCurtain(10.02, 1.5, 0.5, w === 'TAILOR' ? GRAY : RED), clothCurtain(10.02, 3.5, 0.5, w === 'TAILOR' ? GRAY : RED)]; // the fitting rooms
    if (w === 'ANTIQUES') {
      p.push(clockTall(1.5, 1.35), ...armchair(3.6, 4.6, 1, 0, RED), ...armchair(5.6, 4.6, -1, 0, GREEN), ...tableBox(4.6, 4.6, 0.3, 0.3), lampStand(2.6, 3.2), lampStand(8.7, 3.3),
        DRESSER(7.8, 1.36, 0.9, 0.34, 1.0, 0, 1), // a dresser, against the back wall
        hung(6, 4.6, 2.3, (vx, vy, z) => { for (let k = 0; k < 6; k++) { const an = k / 6 * TAU; dot(vx + Math.cos(an) * 0.3, vy + Math.sin(an) * 0.3, z - 0.15, 0.04, (i, t, L) => { BG[i] = C(YEL, 10); return set(i, '*', C(WHITE, 15)), true; }); rod(vx, vy, z, vx + Math.cos(an) * 0.3, vy + Math.sin(an) * 0.3, z - 0.12, 0.008, YEL, 1.2); } })); // a little chandelier
    } else if (w === 'TAILOR') {
      p.push(dressForm(3, 3, BLUE), dressForm(4.4, 3, GRAY), dressForm(7.4, 3.2, RED), clothesRack(7.2, 5.6, 1.0, 74, [GRAY, BLUE, GRAY, BRICK], true),
        ...tableBox(2.6, 5.8, 0.6, 0.45), SEWING_MACHINE(2.5, 5.8, 0.78)); // the sewing machine
    } else {
      p.push(clothesRack(3.8, 3.4, 1.3, 75), clothesRack(3.8, 5.6, 1.3, 76, [BRICK, GREEN, GRAY, YEL, BLUE, MAG]), clothesRack(7.6, 3.4, 1.1, 77, [RED, GRAY, BLUE, WHITE], true),
        mannequin(7.4, 5.4, 'jacket', 'skirt', ORANGE), mannequin(1.4, 7.4, 'dress', 'pants', MAG, 1, 0), ...armchair(10.4, 5.45, -1, 0, GREEN), lampStand(1.4, 3),
        RECORD_CRATE(7.6, 6.9, 0.45, 0.3, 78)); // a crate of records
    }
    p.push(...shoppers([[5.6, 4.4, 0, -1], [2.2, 4.6, 1, 0], [8.4, 4.6, 0, -1]], 0.4));
    if (chance(0.3)) p.push(shopper(10.5, 3.5, 1, 0)); // trying something on
    return p;
  } };

// ---- the pharmacy (PHARMACY, DRUGSTORE): the dispensary along the back under PRESCRIPTIONS, the green cross, two aisles
// with their signs, a blood pressure machine with a chair, a spinner of sunglasses, and the little consultation room
function pharmacyWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && z < 2.2 && boxesWall(i, u, z, L, 81)) return true;
  if (mx === 3 && my === 7 && wallText(i, u, uStep, z, d, 'CONSULT', -7.5, 1.95, 0.12, 0.2, C(WHITE, 15), C(GREEN, 4))) return true; // by its door
  if (leftWall(mx) && my > 0) { // the green cross, lit
    const cu = Math.abs(-u - 3.5), cz = Math.abs(z - 1.9);
    if (cu < 0.45 && cz < 0.15 || cu < 0.15 && cz < 0.45) { BG[i] = C(GREEN, 6 + (fract(T * 0.5) < 0.5 ? 2 : 0)); return set(i, ' ', 0), true; }
  }
  if (z < 1.2) { BG[i] = C(WHITE, 2.5); return set(i, fract(u * 4) < 0.04 ? '|' : ' ', C(GRAY, L * 0.5)), true; }
  BG[i] = C(WHITE, 2); return set(i, ' ', 0), true;
}
const sunglassSpinner = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  rod(vx, vy, 0, vx, vy, 1.75, 0.015, GRAY, 1.3);
  drum(vx, vy, 0.18, 0.5, 1.7, (i, t, L) => { const an = Math.atan2(HIT.v, HIT.u) + T * 0.6, row = Math.floor((HIT.w - 0.5) / 0.2), slot = fract(an / TAU * 8);
    if (slot < 0.2 || fract((HIT.w - 0.5) / 0.2) < 0.4) return false;
    return set(i, slot < 0.55 ? 'o' : slot < 0.65 ? '-' : 'o', C(ITEM_COL[(Math.floor(an / TAU * 8) + row) & 7], 13)), true; });
}, [0.2, 0.2, 1.75]);
ROOM_DEFS.pharmacy = { grid: ['############', '#..........#', '#..........#', '#..........#', '#.SS....SS.#', '####....SS.#', '#..........#', '#..#.......#', '#####DD#####'], light: 1.1, floor: 'lino', ceil: 'strip', sign: true, signAt: 6, wall: pharmacyWall, keeper: [6, 1.4],
  props: r => {
    const p = [SHOP_COUNTER(6, 2.15, 2.4, 0.32, 1.15, 1, 0, WHITE), standing(6, 1.4, WHITE), standing(4.4, 1.4, WHITE), // the pharmacist, and one counting pills
      { x: 6, y: 2.4, draw: (vx, vy) => hallSign(vx, vy, 0.95, 1.94, 2.12, 3, 'PRESCRIPTIONS', C(GREEN, 4), C(WHITE, 15)) },
      aisleSign(2.9, 4.95, 'COLD & FLU', C(BLUE, 4), C(WHITE, 15), 0.6), aisleSign(9.1, 4.95, 'VITAMINS', C(ORANGE, 4), C(WHITE, 15), 0.5),
      BP_MACHINE(10.8, 7.4, -1, 0), // the blood pressure machine
      STOOL(10.15, 7.4, BLUE, 0.45), SEAT(10.15, 7.4, 1, 0, 0.45), sunglassSpinner(4.5, 7.5),
      SMALL_DESK(1.5, 6.5, 0.35, 0.3, 0.75, 0, -1), STOOL(1.5, 7.4, BLUE, 0.5), DESK_MONITOR(1.4, 6.45, 0.75, 0, 1)]; // the consultation room: a desk, a stool, its screen
    p.push(...shoppers([[6, 3.1, 0, -1], [6.3, 3.9, 0, -1], [4.8, 4.6, -1, 0], [7.2, 6.2, 1, 0]], 0.45));
    if (chance(0.4)) p.push({ ...sitting(10.15, 7.45, shirt(), 0.45), face: [1, 0] });
    return p;
  } };

Object.assign(ROOM_FOR, { SKATE: 'skate', SPORTS: 'sports', TOYS: 'toys', THRIFT: 'thrift', PHARMACY: 'pharmacy' }); // (ANTIQUES, TAILOR, DRUGSTORE: storefronts.js)

// more walls of things
// tapes face out on a shelf: a cover each, the title strip across its top
function vhsWall(i, u, z, L, seed) {
  if (z < 0.25 || z > 2.15) return false;
  const row = Math.floor((z - 0.25) / 0.38), dz = fract((z - 0.25) / 0.38) * 0.38, n = Math.floor(u / 0.15), fu = fract(u / 0.15);
  if (dz < 0.03) return set(i, '=', C(GRAY, L)), true;
  BG[i] = C(GRAY, 0.6);
  if (dz > 0.27 || fu < 0.1) return set(i, ' ', 0), true;
  const k = hash(n, row, seed), col = [RED, BLUE, GREEN, MAG, ORANGE, GRAY, CYAN, YEL][k * 8 | 0];
  if (dz > 0.2) { BG[i] = C(WHITE, 4); return set(i, fract(u * 40) < 0.5 ? '-' : ' ', C(GRAY, 2)), true; }
  BG[i] = C(col, 2.5 + (k * 10 % 1) * 1.5); return set(i, Math.abs(fu - 0.55) < 0.2 && Math.abs(dz - 0.1) < 0.04 ? '*@#%!'[k * 77 % 5 | 0] : ' ', C(WHITE, 11)), true;
}
// a herbalist's chest: a hundred little drawers, a brass ring and a paper label on each
function drawerWall(i, u, z, L) {
  if (z < 0.25 || z > 2.35) return false;
  const du = fract(u / 0.26), dz = fract((z - 0.25) / 0.21);
  set(i, ' ', 0);
  BG[i] = C(BRICK, 1.5 + ((Math.floor(u / 0.26) + Math.floor((z - 0.25) / 0.21)) & 1) * 0.3);
  if (du < 0.06 || dz < 0.09) { BG[i] = C(BRICK, 0.5); return true; }
  if (Math.abs(du - 0.53) < 0.09 && Math.abs(dz - 0.38) < 0.14) { BG[i] = C(YEL, 4.5); return true; } // the knob
  if (Math.abs(dz - 0.76) < 0.1 && Math.abs(du - 0.53) < 0.3) BG[i] = C(STONE, 4); // its label
  return true;
}
// shelves of big glass jars, each a third full of something
function jarWall(i, u, z, L, seed) {
  if (z < 0.5 || z > 2.3) return false;
  const row = Math.floor((z - 0.5) / 0.45), dz = fract((z - 0.5) / 0.45) * 0.45, n = Math.floor(u / 0.28), du = fract(u / 0.28) * 0.28 - 0.14;
  if (dz < 0.03) { set(i, ' ', 0); BG[i] = C(BRICK, 2.4 + L * 0.15); return true; }
  if (Math.abs(du) > 0.1 || dz > 0.36) return false;
  set(i, ' ', 0);
  if (dz > 0.31) { BG[i] = C(RED, 2.5); return true; } // the lid
  const k = hash(n, row, seed), fill = 0.12 + k * 0.14, col = [BRICK, RED, YEL, GREEN, ORANGE, WARM][k * 6 | 0];
  BG[i] = dz < fill ? C(col, 2.4 + L * 0.1) : Math.abs(du) > 0.085 ? C(WHITE, 2.4) : C(CYAN, 0.8); return true; // what's in it, the glass
}
// phone cases on pegs, a grid of them in every colour
function caseWall(i, u, z, L, seed) {
  if (z < 0.8 || z > 2.2) return false;
  const du = fract(u / 0.16), dz = fract((z - 0.8) / 0.28), k = hash(Math.floor(u / 0.16), Math.floor((z - 0.8) / 0.28), seed);
  if (du < 0.2 || du > 0.8 || dz < 0.12 || dz > 0.82) return dz > 0.88 && Math.abs(du - 0.5) < 0.1 ? (set(i, '.', C(GRAY, 10)), true) : false;
  BG[i] = C(ITEM_COL[k * 8 | 0], 3); return set(i, Math.abs(du - 0.35) < 0.08 && dz > 0.62 ? 'o' : ' ', C(GRAY, 1)), true; // (the camera hole)
}
// packets of cigarettes behind the counter, row on row, a run of each brand
function packWall(i, u, z, L) {
  if (z < 1.05 || z > 2.25) return false;
  const du = fract(u / 0.075), dz = fract((z - 1.05) / 0.12), brand = hash(Math.floor(u / 0.3), Math.floor((z - 1.05) / 0.24), 91), col = [RED, WHITE, YEL, BLUE, GREEN, GRAY][brand * 6 | 0];
  set(i, ' ', 0);
  BG[i] = dz < 0.12 ? C(GRAY, 3) : du < 0.1 ? C(GRAY, 0.6) : dz > 0.7 ? C(col, 4) : C(WHITE, 3);
  return true;
}
// bottles on shelves: a body and a neck, a label, catching the light
function bottleWall(i, u, z, L, seed) {
  if (z < 0.2 || z > 2.3) return false;
  const row = Math.floor((z - 0.2) / 0.42), dz = fract((z - 0.2) / 0.42) * 0.42, n = Math.floor(u / 0.12), du = fract(u / 0.12) * 0.12 - 0.06;
  if (dz < 0.03) return set(i, '=', C(GRAY, L)), true;
  const k = hash(n, row, seed), col = [BRICK, GREEN, WHITE, BRICK, BLUE, RED, YEL][k * 7 | 0], tall = 0.24 + k * 0.08;
  if (dz < tall && Math.abs(du) < 0.042) { BG[i] = Math.abs(dz - tall * 0.45) < 0.04 ? C(WHITE, 4) : C(col, 2.3); return set(i, Math.abs(du + 0.02) < 0.008 ? '|' : ' ', C(WHITE, 12)), true; }
  if (dz < tall + 0.1 && Math.abs(du) < 0.012) { BG[i] = C(col, 2); return set(i, dz > tall + 0.08 ? '-' : ' ', C(GRAY, 8)), true; }
  return false;
}
// a wine rack: a diamond lattice of wood, a bottle's end in each diamond
function wineWall(i, u, z, L, seed) {
  if (z < 0.1 || z > 2.15) return false;
  const a_ = (u + z) * 3.2, b = (u - z) * 3.2;
  BG[i] = C(BRICK, 0.6);
  if (fract(a_) < 0.1 || fract(b) < 0.1) return set(i, fract(a_) < 0.1 ? '/' : '\\', C(WARM, 9)), true;
  const da = fract(a_) - 0.55, db = fract(b) - 0.55;
  if (Math.hypot(da, db) < 0.22) { const k = hash(Math.floor(a_), Math.floor(b), seed); if (k > 0.25) { BG[i] = C(k > 0.6 ? GREEN : RED, 1.5); return set(i, Math.hypot(da, db) < 0.08 ? 'o' : ' ', C(YEL, 8)), true; } }
  return set(i, ' ', 0), true;
}

// ---- the tobacconist (TOBACCO): dark panelling, a glass-walled humidor, pipes in the case, packets behind the counter;
// through the arch at the back, the smoking lounge: leather chairs, the fan turning the smoke over, cigar boxes on the
// shelves, and the gents off it
function tobaccoWall(i, u, uStep, z, d, mx, my, L) {
  if (rightWall(mx) && my >= 5 && packWall(i, u, z, L)) return true; // packets, behind the counter
  set(i, ' ', 0);
  if (backWall(my) && mx < 8 && z > 1.0 && z < 2.1) { // the lounge: cigar boxes on shelves
    if (fract(z / 0.36) < 0.1) { BG[i] = C(BRICK, 2.6 + L * 0.15); return true; }
    const k = hash(Math.floor(u / 0.32), Math.floor(z / 0.36), 92);
    BG[i] = fract(u / 0.32) < 0.08 ? C(BRICK, 0.8) : Math.abs(fract(z / 0.36) - 0.5) < 0.1 ? C(YEL, 3.5) : C(k > 0.5 ? BRICK : WARM, 2 + k); return true;
  }
  const footprint = Math.max(uStep, d / projY);
  BG[i] = C(BRICK, 1.3 + L * 0.1 - coveGroove(u, 1 / 2.2, 0.02, footprint) * 1); return true; // panelling
}
const humidor = (x, y, hl, hw) => BX(x, y, hl, hw, 0, 2.4, (i, t, L) => {
  const f = HIT.face, a_ = f <= 2 ? HIT.v : HIT.u, half = f <= 2 ? hw : hl, w = HIT.w;
  if (f === 5) { BG[i] = C(BRICK, 1.2); return set(i, ' ', 0), true; }
  if (half - Math.abs(a_) < 0.05 || w > 2.32 || w < 0.08 || fract((a_ + half) / 0.7) < 0.05) { BG[i] = C(BRICK, 1.8 + L * 0.2); return set(i, ' ', 0), true; } // the frame
  if (f === 3 && Math.abs(a_ + 0.1) < 0.02 && w > 0.9 && w < 1.3) return set(i, '|', C(YEL, 14)), true; // the door's handle
  BG[i] = C(WARM, 1.2 + L * 0.06); // inside: cedar shelves of cigar boxes, through the glass
  return set(i, fract(w / 0.4) < 0.1 ? '=' : fract(w / 0.4) < 0.4 && hash(Math.floor(a_ * 4), Math.floor(w / 0.4), 93) > 0.3 ? (fract(a_ * 4) < 0.15 ? '|' : '-') : ' ', C(BRICK, 11)), true;
});
const smoke = (x, y, z) => ({ x, y, draw: (vx, vy) => { for (let k = 0; k < 4; k++) { const p = fract(T * 0.25 + k / 4); dot(vx + Math.sin(T + k * 2) * 0.05 * p * 3, vy, z + p * 1.3, 0.03 + p * 0.1, (i, t, L) => (set(i, p > 0.6 ? '.' : '~', C(GRAY, 10 - p * 7)), true)); } } });
ROOM_DEFS.tobacco = { grid: ['############', '#.......W..#', '#..........#', '#.......WWW#', '####...#####', '#..........#', '#..........#', '#..........#', '#..........#', '#####DD#####'],
  wc: { x0: 9, y0: 1, x1: 11, y1: 3, sign: [8, 1, 1.5] }, light: 0.6, floor: 'boards', ceil: 'tin', sign: true, signAt: 4, wall: tobaccoWall, keeper: [10.1, 6.6],
  props: r => {
    const p = [...glassCase(9.2, 6.6, 1.1, 0.32, 1.05, caseGoods('tobacco', [BRICK, WARM, GRAY, YEL], false, 94), BRICK, 0, 1), standing(10.1, 6.6, BRICK),
      humidor(2.3, 6.3, 0.95, 1.05), { x: 2.3, y: 7.45, draw: (vx, vy) => hallSign(vx, vy, 0.45, 2.45, 2.62, 3, 'HUMIDOR', C(BRICK, 2), C(YEL, 15)) },
      ...archway(5.5, 4.5, 1.5, 1, 0, BRICK), // through to the lounge
      ...armchair(2.4, 2, 1, 0, BRICK), ...armchair(4.8, 2, -1, 0, BRICK), ...armchair(6.9, 1.7, 0, 1, GREEN), ...tableBox(3.6, 2, 0.25, 0.25),
      ROOM_MODEL(3.6, 2, (vx, vy) => drum(vx, vy, 0.08, 0.78, 0.81, (i, t, L) => { BG[i] = C(GRAY, 2.5); return set(i, HIT.face === 5 ? 'o' : '=', C(GRAY, 8)), true; })), // the ashtray
      smoke(3.6, 2, 0.82), ceilingFan(4.2, 2.1, 1.6), lampStand(1.5, 1.4),
      ...toilet(10.4, 1.35, -1, porcelain), washbasin(10.68, 2.45, -1, 0)];
    if (chance(0.6)) p.push({ ...sitting(2.4, 2, shirt(), 0.42), face: [1, 0] });
    if (chance(0.4)) p.push({ ...sitting(4.8, 2, shirt(), 0.42), face: [-1, 0] });
    p.push(...shoppers([[6.6, 6.2, 1, 0], [4.6, 6.8, -1, 0]], 0.4));
    return p;
  } };

// ---- the video shop (VIDEO): aisles of tapes face out, new releases down the wall, a film playing on the telly on the
// counter, the popcorn machine, a cardboard action hero by the door; and in the corner, 18+ over a curtain of beads,
// the back room: more tapes under a red bulb
function videoWall(i, u, uStep, z, d, mx, my, L) {
  if (leftWall(mx) && my > 0 && z > 2.18 && z < 2.42) return wallText(i, u, uStep, z, d, 'NEW RELEASES', -4.5, 2.3, 0.2, 0.24, C(YEL, 15)) || (set(i, '~', C(RED, 10)), true);
  if (my < room.H - 1 && vhsWall(i, u, z, L, mx * 17 + my)) return true;
  BG[i] = mx >= 8 && my <= 4 ? C(RED, 0.9) : C(BLUE, 0.8); // (the back room's lit red)
  return set(i, (Math.floor(u * 4) + Math.floor(z * 4)) % 5 ? ' ' : '*', C(YEL, L * 0.4)), true;
}
const movie = (i, u, w) => { // on the telly: a car chase at sunset, or near enough
  const sky = w > 0.45, sun = Math.hypot(u - 0.3, w - 0.6) < 0.18, road = !sky && Math.abs(u - (w - 0.2) * 0.3) < 0.5 - w, car = !sky && Math.abs(u - Math.sin(T * 0.8) * 0.4) < 0.12 && Math.abs(w - 0.2) < 0.07;
  BG[i] = car ? C(RED, 8) : sun ? C(YEL, 12) : sky ? C(ORANGE, 3 + w * 6) : road ? C(GRAY, 3) : C(GREEN, 2);
  return set(i, road && !car && fract(w * 8 + T * 3) < 0.3 ? '|' : ' ', C(WHITE, 12)), true;
};
const popcornMachine = (x, y, z) => ROOM_MODEL(x, y, (vx, vy) => {
  BXD(vx, vy, 0.22, 0.2, z, z + 0.5, (i, t, L) => { const f = HIT.face, w = HIT.w - z;
    if (f === 5 || w > 0.42) { BG[i] = C(RED, 4 + L * 0.2); return set(i, f === 5 ? ' ' : '=', C(YEL, 13)), true; }
    if (w < 0.06) { BG[i] = C(RED, 3); return set(i, ' ', 0), true; }
    BG[i] = C(YEL, w < 0.22 ? 5 : 1.5); return set(i, w < 0.22 ? (hash(i, Math.floor(T * 4)) > 0.5 ? '@' : 'o') : hash(i, Math.floor(T * 6)) > 0.93 ? '*' : ' ', C(WHITE, 14)), true; });
}, null);
ROOM_DEFS.video = { grid: ['############', '#.......#..#', '#.SS.SS.#..#', '#.SS.SS.#..#', '#.SS.SS.#.##', '#.SS.SS....#', '#..........#', '#..........#', '#..........#', '#####DD#####'],
  light: 0.85, floor: 'carpet', ceil: 'strip', sign: true, signAt: 4.5, wall: videoWall, keeper: [9.8, 6.75],
  props: r => {
    const p = [SHOP_COUNTER(9.8, 7.45, 1.15, 0.3, 1.0, 1, 0, BLUE), standing(9.8, 6.75, r.neon),
      tvSet(9.15, 7.45, 1.0, 0, 1, 0.24, movie), popcornMachine(10.6, 7.45, 1.0),
      RETURNS_BOX(1.6, 8.2, 1, 0), // the returns box
      figProp(1.5, 6.6, figLook({ hair: 'buzz', shades: true, top: 'tank', bot: 'pants', bw: 1.3, col: { top: [GRAY, 3], bot: [GREEN, 4], skin: [SKIN, 12], hair: [GRAY, 1] } }), { face: [0.6, 1], chat: false, still: true, cutout: true }), // a cardboard action hero
      aisleSign(3, 3.6, 'ACTION', C(RED, 4), C(WHITE, 15), 0.4), aisleSign(6, 3.6, 'HORROR', C(GRAY, 1), C(RED, 15), 0.4),
      beadCurtain(9.5, 4.5, 0.5), lintelSign(9.5, 4.5, 0.5, '18+', C(GRAY, 0.5), C(RED, 15)), // the way through to the back
      hung(10, 2.3, 2.45, (vx, vy, z) => dot(vx, vy, z - 0.06, 0.06, (i, t, L) => { BG[i] = C(RED, 12); return set(i, 'o', C(YEL, 15)), true; }))]; // its red bulb
    if (chance(0.5)) p.push(shopper(10.3, 2.2, 1, -0.3)); // somebody in there, not looking round
    p.push(...shoppers([[1.4, 3.4, 1, 0], [4.5, 2.6, -1, 0], [4.5, 5, 1, 0], [7.4, 3.6, -1, 0]], 0.35));
    return p;
  } };

// ---- the herbalist (HERBS): the wall of drawers behind the counter, jars on it and a brass scale, ginseng in a case,
// sacks of dried things on the floor, bundles of herbs hung drying from the ceiling; and through the moon gate, a quiet
// tea room behind paper screens, a low table and cushions
const jar = (x, y, z, col) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, 0.08, z, z + 0.24, (i, t, L) => { if (HIT.w < z + 0.13) { BG[i] = C(col, 2.5); return set(i, '%', C(col, 9)), true; } BG[i] = C(CYAN, 0.9); return set(i, ' ', 0), true; });
  drum(vx, vy, 0.085, z + 0.24, z + 0.28, solid(RED));
});
const brassScale = (x, y, z) => ROOM_MODEL(x, y, (vx, vy) => {
  const tip = Math.sin(T * 0.7) * 0.03;
  rod(vx, vy, z, vx, vy, z + 0.32, 0.012, YEL, 1.3); rod(vx - 0.2, vy, z + 0.32 + tip, vx + 0.2, vy, z + 0.32 - tip, 0.01, YEL, 1.3);
  for (const e of [-1, 1]) { const zz = z + 0.32 - e * tip; rod(vx + e * 0.2, vy, zz, vx + e * 0.2, vy, zz - 0.15, 0.003, YEL, 1); drum(vx + e * 0.2, vy, 0.08, zz - 0.17, zz - 0.15, (i, t, L) => { BG[i] = C(YEL, 4); return set(i, HIT.face === 5 && e < 0 ? '%' : ' ', C(BRICK, 10)), true; }); }
});
const herbBundle = (vx, vy, z) => { for (let k = 0; k < 5; k++) dot(vx + (k % 3 - 1) * 0.04, vy + (k - 2) * 0.025, z - 0.08 - k * 0.05, 0.06, (i, t, L) => { BG[i] = C(k & 1 ? GREEN : BRICK, 1.5 + L * 0.15); return set(i, k & 1 ? '%' : '&', C(k & 1 ? GREEN : WARM, 9)), true; }); };
const sack = (x, y, col, ch) => ROOM_MODEL(x, y, (vx, vy) => drum(vx, vy, 0.24, 0, 0.5, (i, t, L) => {
  if (HIT.face === 5) { BG[i] = C(col, 2.5); return set(i, hash(i, 6) > 0.4 ? ch : ' ', C(col, 10)), true; }
  BG[i] = C(WARM, (1.3 + L * 0.2) * drumLit(0.24)); return set(i, HIT.w > 0.43 ? '~' : hash(i, 8) > 0.8 ? '#' : ' ', C(BRICK, 7)), true; }), [0.24, 0.24, 0.5]);
function herbsWall(i, u, uStep, z, d, mx, my, L) {
  if (mx >= 9) { // the tea room: paper screens in a dark wooden lattice
    if (z < 0.25 || z > 2.5) { BG[i] = C(BRICK, 1.2); return set(i, ' ', 0), true; }
    const lat = fract(u / 0.45) < 0.06 || fract(z / 0.55) < 0.05;
    BG[i] = lat ? C(BRICK, 1.4) : C(STONE, 3.6 + L * 0.15); return set(i, ' ', 0), true;
  }
  if (backWall(my) && drawerWall(i, u, z, L)) return true;
  if (leftWall(mx) && my > 0 && my < room.H - 1 && jarWall(i, u, z, L, mx + 5)) return true;
  BG[i] = Math.abs(z - 2.45) < 0.04 ? C(YEL, 4.5) : C(RED, 0.9 + L * 0.05); return set(i, ' ', 0), true;
}
ROOM_DEFS.herbs = { grid: ['###############', '#........#....#', '#........#....#', '#.............#', '#.............#', '#........#....#', '#........#....#', '######DD#######'],
  light: 0.7, floor: 'wood', ceil: 'lantern', sign: true, signAt: 5, wall: herbsWall, keeper: [5, 1.4],
  props: r => {
    const p = [SHOP_COUNTER(5, 2.1, 2, 0.3, 1.0, 1, 0, BRICK), standing(5, 1.4, RED),
      jar(3.4, 2.05, 1.0, RED), jar(3.75, 2.15, 1.0, YEL), jar(6.4, 2.1, 1.0, BRICK), brassScale(5.7, 2.1, 1.0),
      ...glassCase(1.75, 4.2, 0.7, 0.3, 1.0, caseGoods('herbs', [WARM, YEL, BRICK], false, 95), BRICK, 0, 1),
      sack(1.7, 5.75, BRICK, '@'), sack(1.7, 6.4, RED, 'o'), sack(2.35, 6.45, YEL, '*'), sack(3.0, 6.45, GREEN, '%'),
      ...moonGate(9.5, 4, 1, 0, 1), // through to the tea room
      TEA_TABLE(11.8, 3.5, 0.45, 0.35, 0.36), // its low table
      ROOM_MODEL(11.8, 3.5, (vx, vy) => { // a tea set: the pot, four cups
        drum(vx, vy, 0.07, 0.36, 0.48, (i, t, L) => { BG[i] = C(WHITE, 3.5 * drumLit(0.07)); return set(i, HIT.face === 5 ? 'o' : ' ', C(BLUE, 8)), true; });
        for (const [e, w] of [[-0.25, -0.15], [0.25, -0.15], [-0.25, 0.15], [0.25, 0.15]]) drum(vx + e, vy + w, 0.03, 0.36, 0.41, (i, t, L) => { BG[i] = C(WHITE, 3); return set(i, ' ', 0), true; });
      }),
      ...[[11.0, 3.5, 1, 0], [12.6, 3.5, -1, 0], [11.8, 2.7, 0, 1], [11.8, 4.3, 0, -1]].map(([x, y, fx, fy]) => ({ ...FLOOR_CUSHION(x, y, 0.25, 0.25, 0.12, RED), walk: true, seat: true, x, y, fx, fy, h: 0.12 })), // cushions
      POT_PLANT(13.4, 1.5, 1.4), POT_PLANT(13.4, 6.4, 1.1)];
    for (const [x, y] of [[3, 3.4], [4.2, 4.2], [5.6, 3.4], [6.8, 4.4], [4.6, 5.4], [6, 5.6]]) p.push(hung(x, y, 2.35, herbBundle));
    if (chance(0.6)) p.push({ ...sitting(11.0, 3.5, shirt(), 0.12), face: [1, 0] }, { ...sitting(12.6, 3.5, shirt(), 0.12), face: [-1, 0] }); // two over a pot of tea
    p.push(...shoppers([[3.2, 3.2, 0, -1], [3.2, 4.4, -1, 0], [7.2, 5.2, 1, 0]], 0.4));
    return p;
  } };

// ---- the phone shop (PHONES): white and bright, the new one on a screen the size of the wall, cases floor to ceiling,
// handsets on their tethers on two tables, the repairs bench with its magnifier, a ticket for the queue
function phonesWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && Math.abs(u - room.W / 2) < 2 && z > 1.05 && z < 2.3) { // the screen: a phone turning in a wash of colour
    const du = (u - room.W / 2), dz = z - 1.65, hue = NEON[Math.floor(T / 6) & 3], w_ = 0.22 * Math.abs(Math.cos(T * 0.8)) + 0.03;
    if (Math.abs(du) < w_ && Math.abs(dz) < 0.42) { // the phone: its edge, and its own screen glowing
      const glass = Math.abs(du) < w_ - 0.03 && Math.abs(dz) < 0.38;
      BG[i] = glass ? C(hue, 6 + Math.sin(T * 2 + dz * 6) * 3) : C(GRAY, 1); return set(i, glass ? ' ' : '|', C(WHITE, 12)), true;
    }
    BG[i] = C(hue, 1.5 + (1 - Math.abs(du) / 2) * 3); return wallText(i, u, uStep, z, d, 'THE NEW ONE', room.W / 2 - 1.2, 2.1, 0.13, 0.18, C(WHITE, 15), BG[i]) || (set(i, ' ', 0), true);
  }
  if ((leftWall(mx) || rightWall(mx)) && my > 0 && caseWall(i, u, z, L, mx + 9)) return true;
  BG[i] = C(WHITE, 3.2); return set(i, ' ', 0), true;
}
const phoneTable = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  BXD(vx, vy, 0.75, 0.4, 0.82, 0.9, solid(WHITE, { bright: 1.6 })); BXD(vx, vy, 0.55, 0.25, 0, 0.82, solid(WHITE, { bright: 1.3 }));
  for (let k = 0; k < 5; k++) {
    const hx = vx - 0.6 + k * 0.3, hy = vy + (k & 1 ? 0.12 : -0.12), lit = fract(T * 0.2 + k * 0.37);
    BXD(hx, hy, 0.04, 0.075, 0.9, 0.915, (i, t, L) => { BG[i] = HIT.face === 5 ? C(NEON[k & 3], 3 + lit * 6) : C(GRAY, 1); return set(i, ' ', 0), true; }, 0, 1);
    rod(hx, hy - 0.08, 0.91, hx, vy - 0.4, 0.9, 0.004, GRAY, 0.8); // its tether
  }
}, [0.75, 0.4, 0.9]);
ROOM_DEFS.phones = { grid: boxRoom(12, 8), light: 1.1, floor: 'marble', ceil: 'spots', sign: true, signAt: 6, wall: phonesWall, keeper: [8.8, 1.25],
  props: r => {
    const p = [SHOP_COUNTER(8.8, 1.95, 1.2, 0.3, 1.0, 1, 0, WHITE), standing(8.8, 1.25, GRAY),
      phoneTable(3.8, 4.1), phoneTable(8.2, 4.1),
      SMALL_DESK(1.5, 5.3, 0.9, 0.35, 0.9, -1, 0, GRAY), STOOL(2.25, 5.3, GRAY, 0.6), // the repairs bench
      ROOM_MODEL(1.5, 5.3, (vx, vy) => { rod(vx - 0.2, vy, 0.9, vx + 0.05, vy, 1.4, 0.01, GRAY, 1.2); rod(vx + 0.05, vy, 1.4, vx + 0.3, vy, 1.2, 0.01, GRAY, 1.2);
        dot(vx + 0.32, vy, 1.15, 0.07, (i, t, L) => { BG[i] = C(WHITE, 6); return set(i, 'O', C(GRAY, 6)), true; }); }), // its magnifier lamp
      QUEUE_SCREEN(10.7, 6.3, 0, 1)]; // the queue ticket screen
    if (chance(0.7)) p.push({ ...sitting(2.25, 5.3, BLUE, 0.6), face: [-1, 0], chat: false }); // the repair tech, at it
    p.push(...shoppers([[3.8, 4.8, 0, -1], [8.2, 4.8, 0, -1], [8.9, 3.4, 0, 1], [8.4, 2.7, 0, -1]], 0.4));
    return p;
  } };

// ---- the pawnbroker (PAWN): guitars on the wall, WE BUY GOLD in neon, the counter behind bars with rings and watches
// in its case, a stack of tellies, a bike, a case of watches down the side, the ceiling fan
const guitar = (x, y, col) => ROOM_MODEL(x, y, (vx, vy) => BXD(vx, vy, 0.2, 0.02, 0.95, 2.05, (i, t, L) => { // flat to the wall: its face to the room
  const u = HIT.u, w = HIT.w, lower = Math.hypot(u / 0.19, (w - 1.18) / 0.2) < 1, upper = Math.hypot(u / 0.14, (w - 1.45) / 0.14) < 1, neck = Math.abs(u) < 0.03 && w > 1.5 && w < 1.95, head = Math.abs(u) < 0.05 && w >= 1.95;
  if (!(lower || upper || neck || head)) return false;
  if (neck || head) { BG[i] = C(BRICK, 1.3 + L * 0.2); return set(i, head ? 'o' : '=', C(WARM, 10)), true; }
  const hole = Math.hypot(u, w - 1.33) < 0.05; BG[i] = C(hole ? GRAY : col, hole ? 0.3 : 2.5 + L * 0.25); return set(i, Math.abs(u) < 0.012 && !hole ? '|' : ' ', C(WHITE, 9)), true;
}, 0, 1));
function pawnWall(i, u, uStep, z, d, mx, my, L) {
  if (leftWall(mx) && my > 0 && z > 2.15 && z < 2.45 && wallText(i, u, uStep, z, d, 'WE BUY GOLD', -4.5, 2.3, 0.22, 0.26, C(YEL, 15))) return true;
  const footprint = Math.max(uStep, d / projY);
  set(i, ' ', 0);
  if (rightWall(mx) && my > 0 && my < room.H - 1 && z > 0.9 && z < 2.1) { // shelves of other people's things: radios, cameras, a drill
    if (fract(z / 0.4) < 0.08) { BG[i] = C(GRAY, 2.2 + L * 0.2); return true; }
    const k = hash(Math.floor(u / 0.45), Math.floor(z / 0.4), 96);
    if (fract(u / 0.45) >= 0.15 && fract(z / 0.4) <= 0.75 && k >= 0.25) { BG[i] = C([GRAY, BRICK, GRAY, RED][k * 4 | 0], 2 + L * 0.12); return true; }
  }
  if (z < 1.0) { BG[i] = C(GRAY, 1.5 + L * 0.1 - coveGroove(u, 0.5, 0.02, footprint)); return true; }
  BG[i] = C(STONE, 1.7 + L * 0.1); return true;
}
const grille = (x, y, hl, z0, z1) => Object.assign(BX(x, y, hl, 0.02, z0, z1, (i, t, L) => { // a grille, with a window to talk through in the middle
  if (Math.abs(HIT.u) < 0.45 && HIT.w < z0 + 0.5 || HIT.face >= 5) return false;
  if (fract(HIT.u / 0.12) < 0.25 || Math.abs(HIT.w - z0 - 0.52) < 0.03) { BG[i] = C(GRAY, 2.5 + L * 0.3); return set(i, '|', C(WHITE, 8)), true; }
  return false;
}), {shotPermeable:true});
ROOM_DEFS.pawn = { grid: boxRoom(12, 9), light: 0.75, floor: 'lino', ceil: 'strip', sign: true, signAt: 6, wall: pawnWall, keeper: [6, 1.55],
  props: r => {
    const p = [...glassCase(6, 2.4, 2.1, 0.35, 1.0, caseGoods('jewellery', [YEL, WHITE, YEL, CYAN], true, 97), GRAY), grille(6, 2.1, 2.1, 1.0, 2.25), standing(6, 1.55, r.neon),
      guitar(1.03, 3.2, RED), guitar(1.03, 4.0, BRICK), guitar(1.03, 4.8, YEL), guitar(1.03, 5.6, BLUE),
      ...glassCase(10.55, 5.2, 1.2, 0.35, 1.0, caseGoods('watches', [YEL, WHITE, GRAY], true, 98), GRAY, 0, 1),
      tvSet(10.75, 1.55, 0.012, -1, 0, 0.35), tvSet(10.75, 2.35, 0.012, -1, 0, 0.35), tvSet(10.75, 1.95, 0.012 + 0.35 * 1.5, -1, 0, 0.35, movie),
      FLOOR_MAT(10.75, 1.95, 0.25, 0.75, 0.012), bike(3.6, 7.6, BLUE), ceilingFan(6, 5)]; // (the tellies stand on a mat)
    p.push(...shoppers([[4.1, 3.3, 0, -1], [9.6, 5.2, 1, 0], [2.2, 4.2, -1, 0]], 0.4));
    return p;
  } };

// ---- the off-licence (LIQUOR): bottles floor to ceiling along the back, the beer fridges, wine racks in the middle and
// down the side, the counter with its screen of plexiglass, and in the back corner through its glass door the beer
// cave: a walk-in cold room lined with fridges, cases stacked to the ceiling
function liquorWall(i, u, uStep, z, d, mx, my, L) {
  if (mx <= 4 && my <= 3) { // the cold room: frosted insulated panels round its fridges
    // (its back wall's fridges are built; the rest is insulated panelling)
    BG[i] = C(WHITE, 2.6 + L * 0.1); return set(i, fract(u / 0.6) < 0.04 ? '|' : hash(Math.floor(u * 12), Math.floor(z * 12), 6) > 0.9 ? '.' : ' ', C(CYAN, 8)), true;
  }
  if (rightWall(mx) && my > 0 && my < room.H - 1) return wineWall(i, u, z, L, mx * 3 + my) || false; // (the middle racks are built gondolas)
  if (backWall(my) && bottleWall(i, u, z, L, 99)) return true;
  if (leftWall(mx) && my > 3 && my < room.H - 1) {
    if (z > 2.18 && z < 2.42) return wallText(i, u, uStep, z, d, 'COLD BEER', -5.5, 2.3, 0.22, 0.24, C(RED, fract(T * 0.4) < 0.92 ? 15 : 5)) || false;
    return false; // (under the sign: the built beer fridges)
  }
  return false;
}
// the cave's glass door, frosted at the edges and fogged where it's cold
const caveDoor = (x, y, hl) => ({ ...BX(x, y, hl, 0.03, 0, 2.2, (i, t, L) => {
  const edge = hl - Math.abs(HIT.u) < 0.05 || HIT.w > 2.14 || HIT.w < 0.08;
  if (edge) { BG[i] = C(GRAY, 3 + L * 0.3); return set(i, ' ', 0), true; }
  if (HIT.face < 5 && Math.abs(HIT.u + hl - 0.12) < 0.02 && HIT.w > 0.9 && HIT.w < 1.4) return set(i, '|', C(WHITE, 14)), true; // the handle
  return hash(Math.floor(HIT.u * 30), Math.floor(HIT.w * 30), 8) > 0.82 ? (set(i, '.', C(WHITE, 10)), true) : false;
}), walk: true });
const beerCases = (x, y, n) => ROOM_MODEL(x, y, (vx, vy) => { for (let k = 0; k < n; k++) { const col = [RED, GREEN, BLUE, YEL][hash(k, x * 10 | 0, 7) * 4 | 0];
  BXD(vx + (k & 1) * 0.04 - 0.02, vy, 0.3, 0.2, k * 0.24, k * 0.24 + 0.23, (i, t, L) => { BG[i] = C(col, (2.2 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 3 && Math.abs(HIT.w - k * 0.24 - 0.12) < 0.04 ? '=' : ' ', C(WHITE, 12)), true; }); } }, [0.32, 0.22, n * 0.24]);
ROOM_DEFS.liquor = { grid: ['############', '#...#......#', '#...#......#', '##.##.SS...#', '#.....SS...#', '#..........#', '#..........#', '#..........#', '#####DD#####'],
  light: 0.9, floor: 'tile', ceil: 'strip', sign: true, signAt: 7.5, wall: liquorWall, keeper: [9.6, 5.55],
  props: r => {
    const p = [SHOP_COUNTER(9.6, 6.25, 1.0, 0.3, 1.0, 1, 0, GRAY), standing(9.6, 5.55, r.neon),
      PLEXI_SCREEN(9.6, 6.1, 1.0, 1.0, 0.95, 1, 0), GAS_TILL(10.35, 6.25, 1.0, 0, -1), // the plexiglass; the till, to the clerk
      caveDoor(2.5, 3.5, 0.5), lintelSign(2.5, 3.5, 0.5, 'BEER', C(BLUE, 3), C(WHITE, 15), WHITE), // the way into the beer cave
      beerCases(1.5, 1.62, 6), beerCases(3.4, 1.62, 7), ...SHOP_FRIDGES.liquor(), beerCases(3.45, 2.4, 5), beerCases(1.7, 7.2, 4), beerCases(2.4, 7.2, 3)];
    p.push(...shoppers([[8.4, 3.6, -1, 0], [7.6, 2, 0, -1], [2.4, 5.4, 0, -1]], 0.4));
    if (chance(0.4)) p.push(shopper(2.2, 2.3, -1, -0.4)); // in the cave, choosing
    return p;
  } };

// ---- the jeweller (JEWELER): red velvet and gilt, mirrors, chandeliers, three cases of things that glitter, a guard,
// and a private room to one side for looking at the expensive things sitting down
function jewelWall(i, u, uStep, z, d, mx, my, L) {
  set(i, ' ', 0);
  if (Math.abs(z - 2.3) < 0.04 || Math.abs(z - 0.9) < 0.03) { BG[i] = C(YEL, 5 + L * 0.2); return true; } // gilt mouldings
  if (my > 0 && my < room.H - 1 && !backWall(my) && z > 1.0 && z < 2.2 && Math.abs(fract(u / 1.6) - 0.5) < 0.25) { BG[i] = C(CYAN, 1.5 + (z - 1) * 0.5); return true; } // mirrors
  BG[i] = C(RED, (z < 0.9 ? 0.9 : 1.4) + L * 0.06); return true; // velvet
}
const stanchion = (x, y) => ROOM_MODEL(x, y, (vx, vy) => { drum(vx, vy, 0.12, 0, 0.03, CHROME); rod(vx, vy, 0, vx, vy, 0.9, 0.018, YEL, 1.5); dot(vx, vy, 0.93, 0.04, CHROME); }, [0.12, 0.12, 0.95]);
ROOM_DEFS.jeweler = { grid: ['#############', '#........#..#', '#...........#', '#........#..#', '#........#..#', '#........#..#', '#####DD######'],
  light: 1, floor: 'marble', ceil: 'chandelier', sign: true, signAt: 5, wall: jewelWall, keeper: [5, 1.4],
  props: r => {
    const sparkle = seed => caseGoods('jewellery', [YEL, WHITE, CYAN, RED], true, seed), p = [...glassCase(5, 2.05, 2, 0.32, 1.05, sparkle(101), BRICK), standing(5, 1.4, GRAY),
      ...glassCase(1.85, 3.9, 0.75, 0.3, 1.05, sparkle(102), BRICK, 0, 1), ...glassCase(8.15, 4.3, 0.75, 0.3, 1.05, sparkle(103), BRICK, 0, 1),
      figProp(8.6, 5.6, figGuardLook(7), { face: [-1, -0.3], chat: false }), stanchion(3.2, 5.6), stanchion(3.2, 4.6),
      ROOM_MODEL(3.2, 5.1, (vx, vy) => { for (let k = 0; k < 6; k++) { const a0 = k / 6, a1 = (k + 1) / 6, z0 = 0.86 - Math.sin(a0 * Math.PI) * 0.15, z1 = 0.86 - Math.sin(a1 * Math.PI) * 0.15; rod(vx, vy - 0.5 + a0, z0, vx, vy - 0.5 + a1, z1, 0.02, RED, 1.4); } }), // the velvet rope
      lintel(9.5, 2.5, 0.5, 0, 1, YEL), // the door to the private room
      ...tableBox(11, 3.4, 0.4, 0.35), ...armchair(11, 2.5, 0, 1, RED), ...armchair(11, 4.35, 0, -1, RED), // in it: a table, two chairs
      ROOM_MODEL(11, 3.4, (vx, vy) => { BXD(vx, vy, 0.18, 0.12, 0.78, 0.81, (i, t, L) => { BG[i] = C(BLUE, 2); return set(i, ' ', 0), true; }); // a velvet tray, a ring on it, catching the light
        dot(vx, vy, 0.83, 0.025, (i, t, L) => { BG[i] = C(YEL, 9); return set(i, fract(T * 1.5) < 0.2 ? '*' : 'o', C(WHITE, 15)), true; }); })];
    if (chance(0.6)) p.push(shopper(5.4, 2.85, 0, -1)); // trying on a ring
    if (chance(0.4)) p.push(shopper(2.65, 3.9, -1, 0));
    if (chance(0.5)) p.push({ ...sitting(11, 4.35, shirt(), 0.42), face: [0, -1] }); // somebody being shown something special
    return p;
  } };

// ---- the corner store stays the corner store (24/7, BODEGA and anything else without a place of its own), but with a
// wall of fridges, and at a 24/7 the slushie machine and the hot dogs turning; at a bodega, the bodega cat
const storeProps = ROOM_DEFS.store.props;
// (the store's right-wall fridges are built: shop-fridges.js)
ROOM_DEFS.store.props = r => {
  const p = [...storeProps(r), ...SHOP_FRIDGES.store()];
  if (r.word === '24/7') p.push(ROOM_MODEL(5.65, BACK_COUNTER_Y, (vx, vy) => { // the slushie machine: two tanks churning, red and blue
    for (const [e, col] of [[-0.12, RED], [0.12, BLUE]]) drum(vx + e, vy, 0.1, 1.05, 1.45, (i, t, L) => { BG[i] = C(col, 3 + L * 0.3); return set(i, fract(HIT.w * 6 - T * 1.5 + Math.atan2(HIT.v, HIT.u)) < 0.2 ? '~' : ' ', C(WHITE, 12)), true; });
    BXD(vx, vy, 0.24, 0.13, 1.45, 1.55, solid(WHITE, { top: '=' }));
  }), HOTDOG_ROLLER_AT(5, BACK_COUNTER_Y, 1.05)); // the hot dog roller
  if (r.word === 'BODEGA') p.push(figProp(5.65, 1.7, CAT_LOOK, { z: 1.05, h: 0.75 / CAT_LOOK.scale(0), pose: () => fract(T / 5) < 0.05 ? 'f1' : 'f0', face: [0, 1], chat: false, still: true, light: 8 })); // the bodega cat, on the counter
  return p;
};

Object.assign(ROOM_FOR, { TOBACCO: 'tobacco', VIDEO: 'video', HERBS: 'herbs', PHONES: 'phones', PAWN: 'pawn', LIQUOR: 'liquor', JEWELER: 'jeweler' });

// ---- the gas station's shop (GAS): coolers along the back, aisles of snacks and motor oil, coffee and the hot dog
// roller down the left, the clerk behind a counter by the door with the cigarettes and the lottery on the wall behind
// and the pump console in front of them, the restroom in the back corner (the key's on a hubcap). The front is glass:
// through it the forecourt, the pumps under the lit canopy, and whoever's filling up out there right now
const GAS_ISLE = [6.8, 12.8], GAS_LANE = [15.8, 9.8, 3.8]; // (the forecourt from the windows: metres out to each island, each lane)
// what's out there, as boxes in room coordinates (the front wall's at y = H - 1; out past it is the forecourt, turned
// round so it lines up: room x = 6.5 - 10 * (forecourt x - 1.5), room y = H - 1 + 10 * (2 - forecourt y))
function gasOutside(H) {
  const st = room.gas, out = [];
  for (const d of GAS_ISLE) {
    const y = H - 1 + d;
    out.push({ b: boxAt(6.5, y, 1, 0, 4, 0.6, 0, 0.25), kind: 'isle' }, { b: boxAt(6.5, y, 1, 0, 0.6, 0.45, 0.25, 2), kind: 'pump' });
    for (const e of [-3.65, 3.65]) out.push({ b: boxAt(6.5 + e, y, 1, 0, 0.22, 0.22, 0.25, 4.3), kind: 'post' });
  }
  if (st) for (const c of cars) { // the cars in the forecourt: filling up, pulling in, pulling out
    if (!c.pit || c.pit.st !== st || c.player || c.parked) continue;
    const x = 6.5 - 10 * (rel(c.x - st.x0) - 1.5), y = H - 1 + 10 * (2 - rel(c.y - st.y0)), hx = -c.hx, hy = -c.hy;
    out.push({ b: boxAt(x, y, hx, hy, 2.4, 1.05, 0.25, 1), kind: 'car', col: c.body }, { b: boxAt(x - hx * 0.2, y - hy * 0.2, hx, hy, 1.3, 0.95, 1, 1.45), kind: 'cab', col: c.body });
  }
  return out;
}
// one cell of the view through the front windows: the nearest of the forecourt's boxes, its ground, the canopy's
// lights overhead, the street and the buildings across it, the sky
function gasWindow(i, x, z, L) {
  const H = room.H, ox = px, oy = py, rx = x - px, ry = H - 1 - py, rz = z - eye;
  if (ry <= 0.01) return set(i, ' ', 0);
  const f = gasWindow.frame === T ? gasWindow : Object.assign(gasWindow, { frame: T, out: gasOutside(H) });
  const lit = gasLights(), sun = 2 + day * 7, under = (gx, gy) => gy > H - 1 + 1.7 && gy < H - 1 + 19.3 && gx > -4 && gx < 17;
  let best = Infinity, hit = null, hu = 0, hv = 0, hw = 0, hf = 0;
  for (const o of f.out) {
    const t = rayBox(ox, oy, eye, rx, ry, rz, o.b);
    if (t > 1 && t < best) { best = t; hit = o; hu = HIT.u; hv = HIT.v; hw = HIT.w; hf = HIT.face; }
  }
  const tg = rz < 0 ? -eye / rz : Infinity, tc = rz > 0 ? (4.3 - eye) / rz : Infinity, tw = (H - 1 + 40 - oy) / ry;
  const cy = oy + ry * tc, cx = ox + rx * tc, canopy = tc < best && tc < tw && under(cx, cy);
  if (hit && best < Math.min(tg, canopy ? tc : Infinity, tw)) {
    const gl = Math.max(sun, lit * 9);
    if (hit.kind === 'car') { BG[i] = C(hit.col, (1.6 + gl * 0.25) * (hf === 5 ? 1.2 : 1)); return set(i, hw < 0.5 ? (Math.abs(hu) > 1.6 ? 'o' : '_') : ' ', C(GRAY, 4)); }
    if (hit.kind === 'cab') { BG[i] = hf === 5 ? C(hit.col, 1.6 + gl * 0.25) : C(CYAN, 1 + gl * 0.15); return set(i, ' ', 0); }
    if (hit.kind === 'pump') { BG[i] = hw > 1.75 ? C(room.gas ? room.gas.col : RED, 2 + gl * 0.3) : C(WHITE, 1.5 + gl * 0.25); return set(i, hw > 1.3 && hw < 1.6 && Math.abs(hu) < 0.4 ? ':' : ' ', C(GREEN, 12)); }
    if (hit.kind === 'post') { BG[i] = C(WHITE, 1.4 + gl * 0.25); return set(i, '|', C(GRAY, 6)); }
    BG[i] = C(fract(hu * 1.5 + hw * 4) < 0.5 ? YEL : GRAY, 1.5 + gl * 0.2); return set(i, ' ', 0); // the island's kerb
  }
  if (canopy) { // its underside, rows of lights over the lanes
    const d = cy - (H - 1), on = GAS_LANE.some(l => Math.abs(d - l) < 0.5) && Math.abs(fract((cx - 6.5) / 7 + 0.5) - 0.5) * 7 < 0.7;
    BG[i] = on ? C(WHITE, 7 + lit * 8) : C(WHITE, 1.2 + day * 2 + lit * 2.2);
    return set(i, on ? ' ' : fract(cx / 1.5) < 0.06 || fract(cy / 1.5) < 0.06 ? '+' : ' ', C(GRAY, 5));
  }
  if (tg < tw) { // the ground: the forecourt's concrete, lit under the canopy, then the street
    const gx = ox + rx * tg, gy = oy + ry * tg, d = gy - (H - 1), glow = under(gx, gy) ? lit * 10 : lit * 2;
    if (d < 20) { BG[i] = C(GRAY, 1 + day * 2.5 + glow * 0.25); return set(i, fract(gx / 5) < 0.04 || fract(d / 5) < 0.04 ? '+' : ' ', C(GRAY, 4 + glow * 0.5)); }
    BG[i] = C(GRAY, 0.5 + day * 1.5); return set(i, Math.abs(d - 30) < 0.25 && fract(gx / 4) < 0.5 ? '=' : d < 22 || d > 38 ? ',' : ' ', C(Math.abs(d - 30) < 0.25 ? YEL : GRAY, 5 + day * 4));
  }
  const wz = eye + rz * tw, wx = ox + rx * tw; // the buildings across the street, and over them the sky
  if (wz < 22) {
    const win = fract(wx / 3) > 0.3 && fract(wz / 3) > 0.35 && fract(wz / 3) < 0.8, on = hash(Math.floor(wx / 3), Math.floor(wz / 3), 881) > 0.45;
    BG[i] = C(BRICK, 0.6 + day * 2.2); return set(i, win ? '#' : ' ', C(win && on && night > 0.3 ? WARM : GRAY, win && on ? 4 + night * 9 : 3));
  }
  BG[i] = C(BLUE, 0.4 + day * 5); return set(i, night > 0.6 && hash(Math.floor(wx), Math.floor(wz), 882) > 0.97 ? '.' : ' ', C(WHITE, 10));
}
function gasWall(i, u, uStep, z, d, mx, my, L) {
  const H = room.H, c = roomAt(mx, my);
  if (c === 'W') return mx === 9 && my === 3 && wallText(i, u, uStep, z, d, 'KEY AT COUNTER', 3.5, 1.6, 0.11, 0.15, C(WHITE, 13), C(BLUE, 2)); // (round the restroom door)
  if (backWall(my) && mx < 9) {
    if (z > 2.25 && z < 2.6) return wallText(i, u, uStep, z, d, 'ICE COLD', 4.5, 2.42, 0.22, 0.28, C(CYAN, 15), C(BLUE, 2)) || (BG[i] = C(BLUE, 2), set(i, ' ', 0), true);
    return false; // (the fridges are built: shop-fridges.js)
  }
  if (rightWall(mx) && my >= 5) { // behind the counter: the cigarettes, the lottery
    if (z > 2.2 && z < 2.6) return wallText(i, u, uStep, z, d, 'LOTTO', 7, 2.4, 0.2, 0.28, C(YEL, 15), C(RED, 3)) || (BG[i] = C(RED, 3), set(i, ' ', 0), true);
    if (z > 1.15 && z < 2.15) {
      const row = Math.floor((z - 1.15) / 0.2), k = hash(Math.floor(u / 0.12), row, 884);
      if (fract((z - 1.15) / 0.2) < 0.15) return set(i, '_', C(GRAY, L)), true;
      BG[i] = C([RED, WHITE, BLUE, GREEN, YEL, GRAY][k * 6 | 0], 2.2 + L * 0.1); return set(i, fract(u / 0.12) < 0.12 ? '|' : ' ', C(GRAY, 5)), true; // packs, every brand
    }
    if (z < 1.05) { BG[i] = C(GRAY, 1.4); return set(i, fract(u * 2) < 0.05 ? '|' : '_', C(GRAY, L * 0.7)), true; }
  }
  if (leftWall(mx) && my <= 3 && z > 1.5 && z < 2.3) { // over the coffee: the menu board
    BG[i] = C(GRAY, 0.8);
    for (const [k, it] of ['COFFEE 1.99', 'REFILL .99', 'HOT DOG 2.49'].entries()) if (wallText(i, u, uStep, z, d, it, -2, 2.15 - k * 0.27, 0.12, 0.2, C(k === 2 ? ORANGE : WHITE, 14), C(GRAY, 0.8))) return true;
    return set(i, ' ', 0), true;
  }
  if (my === H - 1 && z > 0.4 && z < 2.45) { // the front: glass from wall to wall
    const x = Math.abs(u);
    if (z > 2.4 || z < 0.45) return set(i, '=', C(GRAY, L * 1.2)), true; // the frames
    if (fract((x - 1) / 1.6) < 0.035) return set(i, '|', C(GRAY, L * 1.2)), true;
    if (x > 2 && x < 3.4 && z > 1.25 && z < 1.85) { // a poster stuck to the glass
      BG[i] = C(RED, 3); return wallText(i, u, uStep, z, d, '2 FOR $3', -2.7, 1.55, 0.15, 0.22, C(YEL, 15), C(RED, 3)) || (set(i, ' ', 0), true);
    }
    return gasWindow(i, x, z, L), true;
  }
  return false;
}
// (the counters, till, console, jar, cups, ice chest, ATM, crisps and papers are built: gas-store.js; the oil shelf
// under the front windows is a wall-shelf run)
const roller = (x,y) => KITCHEN_HOTDOG_ROLLER(x,y);
const coffeeMaker = (x,y) => KITCHEN_DRIP_BREWER(x,y);
ROOM_DEFS.gas = { grid: ['#############', '#........W..#', '#...........#', '#..SS....W..#', '#..SS....WWW#', '#..SS.......#', '#..SS.......#', '#...........#', '#...........#', '######DD#####'],
  wc: { x0: 10, y0: 1, x1: 12, y1: 4, sign: [9, 1, 1.5] }, light: 1.2, floor: 'lino', ceil: 'strip', sign: false, wall: gasWall, shelves: { kind: 'oil', wall: 'front', from: 2.7, to: 4.5, levels: [0.1, 0.36], height: 0.62 }, keeper: [10.4, 7.2], glyphs: 'o#=@%',
  props: r => {
    const p = [SHOP_COUNTER(9.3, 7.2, 1, 0.32, 1, 0, 1), ...SHOP_FRIDGES.gas(), // the counter, along the aisle
      { ...standing(10.4, 7.2, r.neon), face: [-1, 0] },
      GAS_TILL(9.35, 7.75, 1, 1, 0), PUMP_CONSOLE(9.4, 6.65, 1, 1, 0, r.gas), // the till and the pump console, to the clerk
      ROOM_MODEL(9.25, 6.3, (vx, vy) => { // the restroom key, on a hubcap so it comes back
        drum(vx, vy, 0.16, 1, 1.03, (i, t, L) => { BG[i] = C(GRAY, 3 + L * 0.3); return set(i, HIT.face === 5 ? (Math.hypot(HIT.u, HIT.v) < 0.04 ? 'o' : fract(Math.atan2(HIT.v, HIT.u) * 1.6) < 0.2 ? '-' : ' ') : '=', C(WHITE, 11)), true; });
        rod(vx + 0.1, vy, 1.035, vx + 0.22, vy, 1.035, 0.008, YEL, 1.4);
      }),
      JERKY_JAR(9.2, 8.05, 1),
      SHOP_COUNTER(1.3, 2, 0.9, 0.3, 0.92, 0, -1, BRICK), coffeeMaker(1.25, 1.55), coffeeMaker(1.25, 2.15), CUP_STACK(1.3, 2.7, 0.92), // coffee
      SHOP_COUNTER(1.3, 6.1, 0.8, 0.3, 0.92, 0, -1, BRICK), roller(1.3, 5.75), // hot food
      KITCHEN_SLUSH_MACHINE(1.3,6.55),
      ICE_CHEST(1.6, 8.55, 0.55, 0.3, 0.85, 0, -1), ATM_MACHINE(8.5, 8.6, 0, -1),
      CRISP_STAND(6.6, 4.4, 0.55, 0.35, 1.15, 85), NEWS_RACK(5.2, 8.7, 0, -1), // crisps on pegs in the middle; the papers by the door
      ...toilet(11.3, 3.45, 1, porcelain), washbasin(10.6, 1.3, 0, 1), // the restroom
      aisleSign(4, 5, 'SNACKS', C(RED, 4), C(WHITE, 15), 0.4), aisleSign(6.6, 1.8, 'DRINKS', C(BLUE, 4), C(WHITE, 15), 0.4),
      hung(11.6, 5.3, 2.55, (vx, vy, z) => dot(vx, vy, z - 0.12, 0.12, (i, t, L) => { BG[i] = C(GRAY, 4 + L * 0.3); return set(i, fract(HIT.u * 4 + HIT.v * 4) < 0.2 ? ')' : ' ', C(WHITE, 12)), true; })), // the round mirror, for the aisles
    ];
    if (chance(0.3)) p.push(WET_FLOOR_CONE(8.4, 1.75)); // wet floor (in front of the fridges)
    p.push(...shoppers([[2.4, 5.2, -1, 0], [5.5, 3.5, -1, 0], [8.4, 2, 0, -1], [2.2, 1.8, -1, 0], [7.6, 4.4, -1, 0]], 0.35));
    return p;
  } };
Object.assign(ROOM_FOR, { GAS: 'gas' });

// ---- the record shop (RECORDS): two long bins of LPs down the middle to flip through, divider cards sticking up out
// of them; a wall of sleeves face-out at the back, gig posters down the left, CDs and tapes racked on the right; a
// listening station with its headphones; and the counter by the door, a record going round on the deck behind it
const RECORD_COLS = [RED, ORANGE, YEL, GREEN, CYAN, BLUE, MAG, WHITE, BRICK];
// (the bins, the face-out wall, the counter and the listening cabinet are built: record-shop.js)
// a turntable on top of something z high: the platter going round, the tonearm across it
const turntable = (x, y, z) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, 0.22, 0.17, z, z + 0.06), solid(GRAY, { top: ' ' }));
  drum(vx - 0.04, vy, 0.15, z + 0.06, z + 0.075, (i, t, L) => {
    if (HIT.face !== 5) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
    const r = Math.hypot(HIT.u, HIT.v), ang = Math.atan2(HIT.v, HIT.u) - T * 3.5; // (33 and a third)
    if (r < 0.04) { BG[i] = C(RED, 6); return set(i, r < 0.01 ? '.' : ' ', C(GRAY, 1)), true; } // the label
    BG[i] = C(GRAY, 0.4 + (Math.abs(fract(ang / (Math.PI * 2)) - 0.5) < 0.04 ? 1.6 : 0)); // the light running round the grooves
    return set(i, fract(r * 40) < 0.3 ? ':' : ' ', C(GRAY, 3)), true;
  });
  rod(vx + 0.15, vy - 0.12, z + 0.11, vx - 0.02, vy - 0.05, z + 0.085, 0.006, WHITE, 1.3); // the tonearm
});
function recordsWall(i, u, uStep, z, d, mx, my, L) {
  if (backWall(my) && wallText(i, u, uStep, z, d, 'NEW IN', 2.4, 2.75, 0.18, 0.25, C(YEL, 15))) return true; // (the sleeves under it are built)
  set(i, ' ', 0);
  if (leftWall(mx) && z > 0.9 && z < 2.5) { // gig posters and flyers, pasted over each other
    const pu = Math.floor(u / 0.7), pz = Math.floor((z - 0.9) / 0.8), h = hash(pu, pz, 74), col = RECORD_COLS[h * 9 | 0], fz = fract((z - 0.9) / 0.8);
    if (fract(u / 0.7) >= 0.08 && fz >= 0.06) { BG[i] = fz > 0.75 ? C(h > 0.5 ? WHITE : GRAY, h > 0.5 ? 6 : 1) : C(col, 2.2 + L * 0.2); return true; } // a headline band over the picture
  }
  if (z < 1.0) { BG[i] = C(GRAY, 0.6 + L * 0.1); return true; }
  BG[i] = C(MAG, 0.8 + L * 0.12); return true; // painted a deep purple, the way record shops are
}
ROOM_DEFS.records = { grid: boxRoom(12, 9), light: 0.75, floor: 'boards', ceil: 'pendant', sign: true, signAt: 6, wall: recordsWall, keeper: [10.35, 6.2],
  shelves: { kind: 'cds', wall: 'right', from: 1, to: 4.6, levels: [0.3, 0.7, 1.1, 1.5, 1.9], height: 2.3 }, // CDs and tapes on the right
  props: r => {
    const p = [RECORD_BIN_UNIT(3.3, 3.7, 1.7, 1), RECORD_BIN_UNIT(6.1, 3.7, 1.7, 2), RECORD_FACEOUT_WALL(1, 11),
      SHOP_COUNTER(9.6, 6.2, 1.25, 0.32, 1.0, 0, 1, BRICK), // the counter by the door,
      { ...standing(10.35, 6.2, r.neon), face: [-1, 0] }, // and behind it, facing the shop
      GAS_TILL(9.6, 7.0, 1.0, 1, 0), // the till
      turntable(9.6, 5.5, 1.0), // what's playing
      SHOP_COUNTER(1.35, 6.6, 0.4, 0.28, 0.9, 0, -1, GRAY), turntable(1.35, 6.6, 0.9), STOOL(2.1, 6.6, RED, 0.62), // the listening station
      ROOM_MODEL(1.35, 6.25, (vx, vy) => { rod(vx - 0.08, vy, 1.05, vx + 0.08, vy, 1.05, 0.01, GRAY, 1); for (const e of [-1, 1]) dot(vx + e * 0.09, vy, 0.98, 0.04, solid(GRAY)); }), // its headphones
      aisleSign(3.3, 3.7, 'ROCK  SOUL', C(GRAY, 1), C(YEL, 15), 0.6), aisleSign(6.1, 3.7, 'JAZZ  DUB', C(GRAY, 1), C(CYAN, 15), 0.6)];
    p.push(...shoppers([[2.4, 3.2, 1, 0], [4.2, 4.4, -1, 0], [5.2, 2.6, 1, 0], [7.0, 4.6, -1, 0]], 0.4)); // crate diggers, heads down
    return p;
  } };
Object.assign(ROOM_FOR, { RECORDS: 'records' });

// ---- the tattoo parlour (TATTOO), the good kind: black and white floor, oxblood damask walls hung with gilt-framed
// flash, a big koi mural over the lounge (a chesterfield, a rug, the portfolios on the table, the jukebox), a glass
// case of piercing jewellery for a counter with ink bottles racked behind it, and three stations down the back: a
// contoured chair with its leg rest and arm pads, the artist's stool, a ring light, a rolling cart with the machine and
// a row of ink caps, a sharps bin on the wall, and art-covered screens between them. NO REGRETS in pink neon. You can
// get tattooed: pick a design off the wall at the counter (goods.js), sit for it, and wear it (skate.js shows it).
const INK_COLS = [RED, ORANGE, YEL, GREEN, CYAN, BLUE, MAG, GRAY, WHITE];
// a sheet of flash in its frame: little designs in rows on cream paper. (u, z) across the sheet from its corner, w x h
const FLASH = [['<3', RED], ['@', RED], ['+-', GRAY], ['v', BLUE], ['$', GREEN], ['*', YEL], ['%', MAG], ['()', CYAN], ['&', RED], ['#', BLUE]];
function flashSheet(i, u, z, w, h, seed, L) {
  set(i, ' ', 0);
  if (u < 0.05 || z < 0.05 || w - u < 0.05 || h - z < 0.05) { BG[i] = C(YEL, 4.5 + L * 0.2); return true; } // gilt frame
  BG[i] = C(STONE, 3.2 + L * 0.1); // the paper
  const cu = Math.floor(u / 0.17), cz = Math.floor(z / 0.17), fu = fract(u / 0.17), fz = fract(z / 0.17);
  if (fu < 0.2 || fz < 0.25) return true;
  BG[i] = C(FLASH[hash(cu, cz, seed) * FLASH.length | 0][1], 4); return true; // a design, as a block of ink
}
// the koi mural: deep water, ripples, a big orange-and-white koi turning, its tail fanned, blossom on the surface
function koiMural(i, u, z, L) {
  const cx = 7.4, cz = 1.8, du = u - cx, dz = z - cz, ang = -0.35, ru = du * Math.cos(ang) - dz * Math.sin(ang), rz = du * Math.sin(ang) + dz * Math.cos(ang);
  const body = (ru / 1.15) ** 2 + (rz / (0.36 * (1 - Math.max(0, ru) * 0.25))) ** 2;
  set(i, ' ', 0);
  if (body < 1) { // the koi: white with orange patches, an eye near the head
    if (Math.hypot(ru - 0.85, rz - 0.08) < 0.05) { BG[i] = C(GRAY, 0.4); return true; }
    BG[i] = noise(ru * 2.6 + 3, rz * 3, 81) > 0.45 ? C(ORANGE, 7 + L * 0.2) : C(WHITE, 8 + L * 0.2); return true;
  }
  const tu = -ru - 1.05, tail = tu > 0 && tu < 0.55 && Math.abs(rz) < tu * 0.9 + 0.05; // the tail, fanned out behind
  if (tail) { BG[i] = C(ORANGE, 6 + L * 0.2); return true; }
  for (const sg of [1, -1]) if (Math.hypot(ru - 0.3, rz - sg * 0.45) < 0.16) { BG[i] = C(ORANGE, 6); return true; } // fins
  if (hash(Math.floor(u * 4), Math.floor(z * 4), 82) > 0.93 && z > 2.3) { BG[i] = C(MAG, 5); return true; } // blossom, floating
  BG[i] = C(BLUE, 1.5 + z * 0.35 + L * 0.1); return true; // the water, lighter toward the top
}
function tattooWall(i, u, uStep, z, d, mx, my, L) {
  const W = room.W, H = room.H;
  set(i, ' ', 0);
  if (z > 2.95) { BG[i] = C(GRAY, 0.4); return true; } // the cornice, in shadow
  if (z < 1.0) { BG[i] = z > 0.95 ? C(YEL, 4 + L * 0.2) : C(GRAY, 0.5 + L * 0.06); return true; } // black wainscot, a brass rail
  if (backWall(my)) {
    if (z > 2.35 && z < 2.85) { // NO REGRETS, in pink neon, a glow round it
      if (wallText(i, u, uStep, z, d, 'NO REGRETS', W / 2, 2.6, 0.22, 0.34, C(WHITE, 15))) { BG[i] = C(MAG, 9); return true; }
      if (Math.abs(u - W / 2) < 1.4) { BG[i] = C(MAG, 2.4); return set(i, ' ', 0), true; }
    }
    for (const sx of [2.6, 7, 11.4]) { // over each station: a mirror, two flash sheets either side
      if (Math.abs(u - sx) < 0.42 && z > 1.25 && z < 2.25) { set(i, ' ', 0); BG[i] = Math.abs(u - sx) > 0.38 || z < 1.29 || z > 2.21 ? C(YEL, 4.5) : C(CYAN, 1.5); return true; }
      for (const e of [-1, 1]) { const fx = sx + e * 0.95 - 0.35; if (u > fx && u < fx + 0.7 && z > 1.3 && z < 2.2) return flashSheet(i, u - fx, z - 1.3, 0.7, 0.9, Math.round(sx * 3 + e), L); }
    }
  }
  if (leftWall(mx) && -u > 4.9 && -u < 9.9 && z < 2.95) return koiMural(i, -u, z, L); // over the lounge (from inside, u runs the other way along this wall)
  if (rightWall(mx) && u > 5.6 && u < 9.6) { // behind the counter: WALK-INS WELCOME, and the ink, racked by colour
    if (z > 2.45 && wallText(i, u, uStep, z, d, 'WALK-INS WELCOME', 7.6, 2.62, 0.13, 0.22, C(YEL, 15))) { BG[i] = C(GRAY, 0.6); return true; }
    if (z > 1.15 && z < 2.3) {
      set(i, ' ', 0);
      if (fract((z - 1.15) / 0.38) < 0.14) { BG[i] = C(BRICK, 2.2 + L * 0.15); return true; } // the shelves
      const k = Math.floor(u / 0.13), col = INK_COLS[hash(k, Math.floor((z - 1.15) / 0.38), 83) * INK_COLS.length | 0];
      if (fract(u / 0.13) < 0.25) { BG[i] = C(GRAY, 0.6); return true; }
      BG[i] = fract((z - 1.15) / 0.38) > 0.7 ? C(WHITE, 5) : C(col, 2.2 + L * 0.2); return true; // a bottle, its cap
    }
  }
  if (z > 1.25 && z < 2.3) { // gilt-framed flash, salon-style, everywhere else
    const fw = 0.75, fh = 0.85, cu = Math.floor(u / 1.0), fu = u - cu * 1.0 - 0.12, fz = z - 1.3 - (cu & 1) * 0.08;
    if (fu > 0 && fu < fw && fz > 0 && fz < fh) return flashSheet(i, fu, fz, fw, fh, cu * 7 + mx * 3 + my, L);
  }
  set(i, ' ', 0);
  BG[i] = C(BRICK, 1.2 + L * 0.12); return true; // oxblood damask
}
// a station, the chair along x (its head end at -x): what everything at it is made of, and where
const vinyl = (i, t, L) => { BG[i] = C(GRAY, (1.5 + L * 0.2) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? (fract(HIT.u * 6) < 0.12 ? '-' : ' ') : '=', C(RED, HIT.face === 5 ? 6 : 9)), true; }; // black vinyl, red piping
const tattooStation = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx + 0.1, vy, 0.22, 0, 0.06, CHROME); drum(vx + 0.1, vy, 0.08, 0.06, 0.48, CHROME); // the hydraulic pedestal
  drawBox(boxAt(vx + 0.1, vy, 1, 0, 0.36, 0.28, 0.48, 0.62), vinyl); // the seat
  drawBox(boxAt(vx - 0.5, vy, Math.cos(0.55), 0, 0.3, 0.27, 0.6, 1.0), vinyl); // the back, tilted up
  drawBox(boxAt(vx - 0.86, vy, 1, 0, 0.08, 0.15, 1.0, 1.12), vinyl); // the headrest
  drawBox(boxAt(vx + 0.68, vy, Math.cos(-0.3), 0, 0.26, 0.24, 0.32, 0.48), vinyl); // the leg rest, angled down
  for (const e of [-1, 1]) { drawBox(boxAt(vx - 0.05, vy + e * 0.42, 1, 0, 0.32, 0.07, 0.68, 0.76), vinyl); rod(vx - 0.05, vy + e * 0.36, 0.55, vx - 0.05, vy + e * 0.42, 0.68, 0.012, GRAY, 1.3); } // the arm pads
  const sx = vx + 0.25, sy = vy + 0.75; // the artist's stool
  drum(sx, sy, 0.19, 0.44, 0.52, (i, t, L) => { BG[i] = C(GRAY, (1.5 + L * 0.2) * drumLit(0.19)); return set(i, HIT.face === 5 ? 'o' : ' ', C(RED, 8)), true; });
  drum(sx, sy, 0.03, 0.06, 0.44, CHROME); drum(sx, sy, 0.2, 0, 0.06, CHROME);
  const lx = vx - 0.75, ly = vy - 0.55; // the ring light on its stand, glowing
  rod(lx, ly, 0, lx, ly, 1.45, 0.012, GRAY, 1.2);
  for (let k = 0; k < 14; k++) { const t = k / 14 * Math.PI * 2; dot(lx + Math.cos(t) * 0.17 * 0.3, ly + Math.cos(t) * 0.17 * 0.95, 1.62 + Math.sin(t) * 0.17, 0.022, (i, t2, L) => { BG[i] = C(WHITE, 14); return set(i, ' ', 0), true; }); }
  const cx = vx + 0.75, cy = vy - 0.6; // the rolling cart: two chrome shelves, the tray on top
  for (const e of [-1, 1]) for (const f of [-1, 1]) rod(cx + e * 0.2, cy + f * 0.15, 0.05, cx + e * 0.2, cy + f * 0.15, 0.85, 0.008, GRAY, 1.4);
  drawBox(boxAt(cx, cy, 1, 0, 0.22, 0.17, 0.35, 0.37), CHROME); drawBox(boxAt(cx, cy, 1, 0, 0.22, 0.17, 0.85, 0.87), CHROME);
  for (let k = 0; k < 7; k++) dot(cx - 0.15 + k * 0.05, cy - 0.08, 0.89, 0.016, (i, t, L) => { BG[i] = C(INK_COLS[k], 9); return set(i, ' ', 0), true; }); // the ink caps
  rod(cx + 0.02, cy + 0.06, 0.885, cx + 0.16, cy + 0.03, 0.9, 0.012, GRAY, 1.6); // the machine
  drum(cx - 0.12, cy + 0.07, 0.035, 0.87, 1.02, (i, t, L) => { BG[i] = C(CYAN, 3); return set(i, ' ', 0), true; }); // green soap, in its spray bottle
  drum(cx + 0.14, cy - 0.08, 0.04, 0.37, 0.6, (i, t, L) => { BG[i] = C(WHITE, 8 * drumLit(0.04)); return set(i, ' ', 0), true; }); // the paper towel, on the shelf below
  drawBox(boxAt(vx - 0.2, vy - 0.93, 1, 0, 0.1, 0.06, 1.15, 1.35), (i, t, L) => { BG[i] = C(RED, 5); return set(i, HIT.face === 4 && Math.abs(HIT.w - 1.3) < 0.02 ? '!' : ' ', C(YEL, 14)), true; }); // the sharps bin, on the wall
}, [1.0, 0.45, 1.1]);
// the screens between stations: tall black panels, a framed sheet of flash on each face
const tattooScreen = (x, y0, y1) => BX(x, (y0 + y1) / 2, (y1 - y0) / 2, 0.04, 0, 1.95, (i, t, L) => {
  const f = HIT.face, u = HIT.u + (y1 - y0) / 2, w = HIT.w;
  if ((f === 3 || f === 4) && u > 0.2 && u < 1.0 && w > 0.9 && w < 1.8) return flashSheet(i, u - 0.2, w - 0.9, 0.8, 0.9, Math.round(x * 10) + f, L);
  BG[i] = C(GRAY, (0.7 + L * 0.08) * shadeFace(f)); return set(i, f === 5 ? '=' : ' ', C(YEL, 6)), true;
}, 0, 1);
// the chesterfield: oxblood leather, buttoned all over
const chesterfield = (x, y, hl) => [SEAT(x + 0.05, y - hl * 0.55, 1, 0), SEAT(x + 0.05, y, 1, 0), SEAT(x + 0.05, y + hl * 0.55, 1, 0), BX(x, y, hl, 0.42, 0, 0.45, (i, t, L) => { BG[i] = C(BRICK, (1.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 && fract(HIT.u * 4) < 0.15 ? '.' : ' ', C(GRAY, 1)), true; }, 0, 1),
  BX(x - 0.36, y, hl, 0.1, 0.45, 0.85, (i, t, L) => { BG[i] = C(BRICK, (1.6 + L * 0.3) * shadeFace(HIT.face)); return set(i, fract(HIT.u * 4) < 0.15 && fract(HIT.w * 5) < 0.3 ? '.' : ' ', C(GRAY, 1)), true; }, 0, 1),
  ...[-1, 1].map(e => BX(x, y + e * hl, 0.42, 0.1, 0, 0.7, solid(BRICK, { top: '=' }), 0, 1))];
// the artists: tees, both arms done, every one a bit different
const artistLook = seed => figStreetLook(seed, [GRAY, RED, GREEN, BLUE][seed & 3], GRAY, seasonIdx(), { top: 'tee', bot: 'pants', ink: 0.8 + (seed % 3) * 0.1,
  col: { ...figStreetLook(seed, GRAY, GRAY).col, top: [[GRAY, 2], [GRAY, 3], [RED, 3], [GREEN, 3]][seed & 3], ink: [[GRAY, 2], [BLUE, 4], [GREEN, 4], [RED, 4]][(seed >> 2) & 3] } });
const artist = (x, y, seed, o) => figProp(x, y, artistLook(seed), o);
ROOM_DEFS.tattoo = { grid: boxRoom(14, 11), light: 0.85, floor: 'checker', ceil: 'pendant', height: 3.1, sign: false, neon: true, wall: tattooWall, keeper: [10.2, 6.75],
  props: r => {
    const p = [tattooScreen(4.8, 1, 3.6), tattooScreen(9.2, 1, 3.6),
      ...[2.6, 7.0, 11.4].flatMap(sx => [tattooStation(sx, 2.3), SEAT(sx - 0.1, 2.3, 1, 0, 0.6), SEAT(sx + 0.25, 3.05, 0, -1, 0.52)]), // (sit in the chair, or on the artist's stool)
      ...glassCase(10.2, 7.45, 1.5, 0.34, 1.0, caseGoods('piercing', [YEL, WHITE, GRAY, CYAN], true, 84), GRAY), // the counter: rings, studs, barbells
      { ...artist(10.2, 6.75, (r.cell ? r.cell[0] * 31 + r.cell[1] : 7) | 0, { face: [0, 1] }) }, // behind it
      GAS_TILL(11.2, 7.45, 1.0, 0, -1), BOOK_STACK(9.3, 7.4, 1.0, [[0.14, 0.2, 0.08, GRAY], [0.14, 0.2, 0.06, RED]]), // the till; portfolios
      ROOM_MODEL(9.8, 7.5, (vx, vy) => drum(vx, vy, 0.07, 1.0, 1.18, (i, t, L) => { BG[i] = C(CYAN, 1); const k = hash(Math.floor(HIT.u * 40), Math.floor(HIT.w * 30), 85); return set(i, k > 0.55 ? 'o' : ' ', C(INK_COLS[k * 9 | 0], 13)), true; })), // a jar of lollipops
      ...chesterfield(1.4, 8.0, 1.2), JUKEBOX(1.35, 5.6, 1, 0), POT_PLANT(5.4, 9.4, 1.5),
      FURNITURE_EAT_TABLE(2.75, 8.0, 0.55, 0.35, GRAY, 0.42), BOOK_STACK(2.75, 7.8, 0.42, [[0.12, 0.16, 0.05, MAG]]), BOOK_STACK(2.7, 8.3, 0.42, [[0.12, 0.16, 0.04, BLUE]]), // the low table and its binders
      FLOOR_RUG(2.6, 8.0, 1.25, 1.0, RED, YEL, 0, 1)]; // the rug
    let seed = 11;
    for (const sx of [2.6, 7.0, 11.4]) if (chance(0.55)) p.push( // someone in the chair, and their artist hunched over the work
      { ...sitting(sx - 0.2, 2.3, shirt(), 0.62), face: [1, 0] }, artist(sx + 0.25, 3.05, seed++, { pose: 'sit6', face: [0, -1] }));
    if (chance(0.6)) p.push({ ...sitting(1.45, 8.3, shirt(), 0.45), face: [1, 0] }); // waiting their turn, flicking through a binder
    if (chance(0.4)) p.push({ ...standing(4.2, 6.2, shirt()), face: [-1, 0] }); // looking at the mural
    return p;
  } };
Object.assign(ROOM_FOR, { TATTOO: 'tattoo' });
