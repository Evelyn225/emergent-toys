// A shop's kind, told from across the street (pass 13 follow-up, the user's ask): a barber's striped pole turning by the
// door, a pharmacy's green cross out over the pavement, a red paper lantern by a noodle bar's or a sushi bar's door, a
// café's chalkboard out on the pavement, a florist's buckets of flowers, a bar's lit sign hung out on a bracket. Placed
// from the shop's fascia board (one per shop, at the end of its first board), everything in colour.
// City units: 1 = 10 m; z up from the pavement.
const SHOP_EXTERIOR_FOR = {
  BARBER: 'pole', PHARMACY: 'cross', DRUGSTORE: 'cross',
  SUSHI: 'lantern', RAMEN: 'lantern', NOODLES: 'lantern', PHO: 'lantern', DUMPLINGS: 'lantern', 'DIM SUM': 'lantern', IZAKAYA: 'lantern', YAKITORI: 'lantern', THAI: 'lantern', 'TEA HOUSE': 'lantern',
  CAFE: 'board', COFFEE: 'board', BAKERY: 'board', KISSATEN: 'board', BAGELS: 'board', DONUTS: 'board', 'ICE CREAM': 'board', JUICE: 'board',
  FLORIST: 'buckets', BAR: 'barsign', KARAOKE: 'barsign',
};
let SHOP_EXTERIORS_B = null; // (built on first draw: the world has moved the fascias by then)
const shopExteriorList = () => SHOP_EXTERIORS_B ||= (() => {
  const seen = new Set(), out = [];
  for (const o of ARCH_DETAILS) {
    if (o.kind !== 'fascia') continue;
    const sh = SHOP[o.ownerCell], kind = sh && SHOP_EXTERIOR_FOR[sh.word];
    if (!kind || seen.has(sh) || sh.kind === SHOP_SHUT || sh.kind === SHOP_APTS) continue;
    seen.add(sh);
    const tx = o.c, ty = o.s, end = o.hl + .045; // along the board; past its end, where the door usually is
    out.push({ kind, sh, x: o.x + tx * end - o.nx * o.hw, y: o.y + ty * end - o.ny * o.hw, nx: o.nx, ny: o.ny, tx, ty, hl: o.hl, cx: o.x - o.nx * o.hw, cy: o.y - o.ny * o.hw, seed: o.seed, z0: o.z0 });
  }
  return bucketed(out);
})();
// a cylinder standing up, or lying along the normal: drawBox through rayFrustum (hl = hw = r1 = r)
const extCyl = (x, y, r, z0, z1, shade) => drawBox({ x, y, c: 1, s: 0, hl: r, hw: r, r1: r, z0, z1 }, shade, rayFrustum);
function drawShopExterior(e, vx, vy) {
  const lit = Math.max(night, overcast * .6) > .3, open = openAt(e.sh, tod);
  const at = (t, n) => [vx + e.tx * t + e.nx * n, vy + e.ty * t + e.ny * n]; // (t along the wall from the fixture's spot, n out from it)
  const metal = (i, t, L) => { BG[i] = C(GRAY, (1.6 + L * .3) * shadeFace(HIT.face) + (HIT.face === 5 ? .5 : 0)); return set(i, ' ', 0), true; };
  if (e.kind === 'pole') { // the barber's pole: a glass cylinder on a bracket, red, white and blue turning up it, chrome caps
    const [x, y] = at(0, .04);
    drawBox(boxAt(...at(0, .016), e.tx, e.ty, .005, .016, .19, .2), metal); // the bracket
    extCyl(x, y, .02, .09, .115, (i, t, L) => { BG[i] = C(GRAY, (2.6 + L * .3) * frustumLit()); return set(i, ' ', 0), true; });
    extCyl(x, y, .02, .285, .31, (i, t, L) => { BG[i] = C(GRAY, (2.6 + L * .3) * frustumLit() + .6); return set(i, ' ', 0), true; });
    extCyl(x, y, .016, .115, .285, (i, t, L) => {
      const ang = Math.atan2(HIT.v, HIT.u) / (Math.PI * 2), band = fract(ang + HIT.w * 14 - (open ? T * .6 : 0)) * 3 | 0, light = frustumLit();
      BG[i] = C([RED, WHITE, BLUE][band], ([3.4, 4.2, 3.2][band] + L * .3) * light + (lit && open ? 1.5 : 0)); return set(i, ' ', 0), true;
    });
    return;
  }
  if (e.kind === 'cross') { // a green cross on a bracket out over the pavement, lit from inside, both faces
    const [x, y] = at(0, .085), glow = open ? (lit ? 1 : .5) : .1, pulse = open && lit ? .8 + .2 * Math.sin(T * 3) : 1;
    drawBox(boxAt(...at(0, .02), e.nx, e.ny, .02, .004, .345, .35), metal); // the bracket
    drawBox(boxAt(x, y, e.nx, e.ny, .058, .007, .23, .345), (i, t, L) => {
      const u = HIT.u, w = HIT.w - .2875, arm = Math.abs(u) < .02 || Math.abs(w) < .02, edge = Math.abs(u) > .017 && Math.abs(u) < .02 || Math.abs(w) > .017 && Math.abs(w) < .02;
      if (!arm) return false; // (only the cross itself: the sky round it)
      BG[i] = HIT.face === 3 || HIT.face === 4 ? C(GREEN, (edge ? 2.4 : 5 + glow * 8 * pulse) + L * .15) : C(GRAY, 2 + L * .3); return set(i, ' ', 0), true;
    });
    return;
  }
  if (e.kind === 'lantern') { // a red paper lantern on a hook by the door: ribbed, black caps top and bottom, a tassel
    const [x, y] = at(0, .04);
    drawBox(boxAt(...at(0, .02), e.tx, e.ty, .004, .02, .285, .292), metal);
    extCyl(x, y, .028, .19, .285, (i, t, L) => {
      const h = HIT.w - .19, cap = h < .01 || h > .085, rib = Math.abs(fract(h / .012) - .5) < .12, bulge = Math.sin(h / .095 * Math.PI);
      BG[i] = cap ? C(BLACK, 0) : C(RED, (lit ? 6 + night * 6 : 2.4 + L * .3) * (.7 + .3 * bulge) * frustumLit() - (rib ? .8 : 0)); return set(i, ' ', 0), true;
    });
    extCyl(x, y, .005, .165, .19, (i, t, L) => { BG[i] = C(YEL, 4 + L * .2); return set(i, ' ', 0), true; }); // the tassel
    return;
  }
  if (e.kind === 'board') { // a sandwich board on the pavement: two chalkboards leaning together, framed in timber, the menu chalked up
    const [x, y] = at(-e.hl * .6, .3);
    for (const sgn of [-1, 1]) drawBox({ x: x + e.nx * sgn * .012, y: y + e.ny * sgn * .012, c: e.tx, s: e.ty, hl: .03, hw: .004, z0: 0, z1: .1 }, (i, t, L) => {
      const u = Math.abs(HIT.u), w = HIT.w, frame = u > .025 || w > .093 || w < .012;
      if (frame) { BG[i] = C(WARM, (1.8 + L * .25) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }
      const line = Math.abs(fract((w - .02) / .016) - .5) < .3 && u < .02 && hash(Math.floor(w / .016), Math.floor(HIT.u * 150), 1801) > .3; // (chalked lines of the menu, words with gaps)
      BG[i] = line ? C(WHITE, 4 + L * .2) : C(GREEN, .8 + L * .06); return set(i, ' ', 0), true; // chalk on slate
    });
    return;
  }
  if (e.kind === 'buckets') { // three zinc buckets of flowers by the door
    for (let k = 0; k < 3; k++) {
      const [x, y] = at(-e.hl * .3 - k * .045, .06), cols = [[MAG, WHITE], [YEL, ORANGE], [RED, MAG]][k];
      extCyl(x, y, .018, 0, .04, (i, t, L) => { BG[i] = C(GRAY, (2.4 + L * .3) * frustumLit() - (Math.abs(HIT.w - .03) < .002 ? .6 : 0)); return set(i, ' ', 0), true; });
      extCyl(x, y, .024, .04, .075, (i, t, L) => { const f = hash(Math.floor(HIT.u * 300), Math.floor(HIT.w * 300), 1802 + k); BG[i] = f > .4 ? C(cols[f > .7 ? 1 : 0], 4 + L * .3 + (HIT.face === 5 ? .6 : 0)) : C(GREEN, 2 + L * .3); return set(i, ' ', 0), true; }); // the blooms over the leaves
    }
    return;
  }
  if (e.kind === 'barsign') { // a sign hung out on a scrolled bracket: an oval board, lit by a lamp over it after dark
    const [x, y] = at(0, .085);
    drawBox(boxAt(...at(0, .043), e.nx, e.ny, .043, .004, .33, .336), metal);
    drawBox(boxAt(x, y, e.nx, e.ny, .055, .006, .23, .325), (i, t, L) => {
      const u = HIT.u / .055, w = (HIT.w - .2775) / .0475, r = Math.hypot(u, w);
      if (r > 1) return false;
      BG[i] = r > .85 ? C(YEL, 3 + L * .3) : C(e.sh.neon ?? BRICK, (1.8 + L * .25 + (lit ? 2 : 0)) - (Math.abs(w) < .2 && Math.abs(u) < .6 ? -.8 : 0)); return set(i, ' ', 0), true; // a gilt rim, the painted board, a band across it
    });
    if (lit) extCyl(...at(0, .1), .008, .325, .335, (i, t, L) => { BG[i] = C(WARM, 13); return set(i, ' ', 0), true; });
  }
}
function shopExteriors() {
  abandonedShopDressing();
  forNear(shopExteriorList(), e => {
    const [vx, vy] = R(e.x, e.y), d = Math.hypot(vx, vy);
    if (d > SHOP_WINDOW.near * 2.5 || !inView(vx, vy, .5)) return;
    drawShopExterior(e, vx, vy);
  });
}
