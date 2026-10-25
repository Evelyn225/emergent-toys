// The kerb fixtures, built (see kerb-fixtures.js). Metres scaled to cells
// (K = .1). Up close each has its fittings; past KERB_NEAR only its main body.
const KERB_K = .1, KERB_NEAR = 2.5;
const kerbPaint = (col, base = 2.2) => (i, t, L) => { BG[i] = C(col, base + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; };
const kerbLathe = (x, y, z, profile, shade) => coveLathe(x, y, z, profile.map(([h, r]) => [h * KERB_K, r * KERB_K]), shade);
// A fire hydrant: a flanged foot, the barrel, a collar, the bonnet and its
// operating nut; a hose outlet either side along the kerb and the pumper
// nozzle facing the road, each with its cap.
const KERB_HYDRANT = [[0, 0], [0, .15], [.04, .15], [.05, .12], [.08, .115], [.5, .105], [.52, .125], [.56, .125], [.58, .11], [.66, .1], [.7, .07], [.72, .035], [.72, 0]];
const KERB_NUT = [[0, 0], [0, .03], [.05, .026], [.05, 0]];
function drawKerbHydrant(o, vx, vy, z, near) {
  const paint = kerbPaint(o.col, 2.3), k = KERB_K;
  if (near) {
    kerbLathe(vx, vy, z + .72 * k, KERB_NUT, (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY));
    const tube = (ux, uy, z0, a, b, r, cap) => { // along (ux, uy) from a to b at height z0, and its cap at the end
      coveTube(vx + ux * a * k, vy + uy * a * k, z + z0 * k, vx + ux * (b - .02) * k, vy + uy * (b - .02) * k, z + z0 * k, r * k, o.col);
      coveTube(vx + ux * (b - .02) * k, vy + uy * (b - .02) * k, z + z0 * k, vx + ux * b * k, vy + uy * b * k, z + z0 * k, cap * k, o.col);
    };
    for (const e of [-1, 1]) tube(o.c * e, o.s * e, .42, .08, .16, .032, .042);
    tube(o.fx, o.fy, .34, .08, .18, .045, .056);
  }
  kerbLathe(vx, vy, z, KERB_HYDRANT, paint);
}
// A litter bin: a ribbed steel drum with a rolled rim and the bag folded over
// it, open at the top onto the rubbish inside.
const KERB_BIN = [[0, 0], [0, .2], [.03, .22], [.82, .25], [.84, .26], [.88, .26], [.88, .232], [.84, .228], [.64, .218], [.64, 0]];
function drawKerbBin(o, vx, vy, z, near) {
  const body = (i, t, L) => {
    const w = (HIT.w - z) / KERB_K, a = Math.atan2(HIT.v, HIT.u);
    if (w > .835) { BG[i] = C(GRAY, .8 + L * .15); return set(i, ' ', 0), true; } // the bag over the rim
    if (w > .63 && w < .66 && HIT.nz > .5) { BG[i] = C(GRAY, .6 + hash(Math.floor(HIT.u * 400), Math.floor(HIT.v * 400), 1410) * .9); return set(i, ' ', 0), true; } // the rubbish
    const rib = coveGroove(a * .25 / Math.PI * 8, 1, .18, t / projX / (.25 * KERB_K) * 2) * coveDetail(t, .05);
    BG[i] = C(o.col, 1.8 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz) - rib * .7); return set(i, ' ', 0), true;
  };
  if (near) for (let n = 0; n < 3; n++) { const a = o.seed * 20 + n * 2.1, r = .1 * KERB_K; // litter on top
    foodOval(vx + Math.cos(a) * r, vy + Math.sin(a) * r, z + .64 * KERB_K, .04 * KERB_K, .03 * KERB_K, .03 * KERB_K, kerbPaint(n === 1 ? RED : WHITE, 2.4)); }
  kerbLathe(vx, vy, z, KERB_BIN, body);
}
// A mailbox: four legs, the box with its rounded top (a half cylinder running
// front to back), the pull-down chute and its handle on the front, the
// collection-times plate and its name.
function drawKerbMailbox(o, vx, vy, z, near) {
  const k = KERB_K, c = o.c, s = o.s, fs = Math.sign(-s * o.fx + c * o.fy) || 1, paint = kerbPaint(o.col, 2);
  const at = (a, v) => [vx + (c * a - s * v * fs) * k, vy + (s * a + c * v * fs) * k]; // a along the kerb, v out of the front
  if (near) {
    for (const a of [-.19, .19]) for (const v of [-.22, .22]) { const [x, y] = at(a, v); coveRound(x, y, c, s, .02 * k, .02 * k, z, z + .23 * k, .006 * k, paint); }
    const [cx, cy] = at(0, .255), [hx, hy] = at(0, .275);
    coveRound(cx, cy, c, s, .16 * k, .015 * k, z + .78 * k, z + 1.0 * k, .008 * k, kerbPaint(o.col, 2.6)); // the chute door
    coveRound(hx, hy, c, s, .1 * k, .012 * k, z + .958 * k, z + .982 * k, .01 * k, (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY)); // its handle
    const [px_, py_] = at(.0, .252);
    drawBox(boxAt(px_, py_, c, s, .1 * k, .004 * k, z + .6 * k, z + .7 * k), kerbPaint(WHITE, 3.4)); // the collection times
    const [wx, wy] = at(0, .25);
    drawBox(boxAt(wx, wy, c, s, .2 * k, .001 * k, z + .38 * k, z + .52 * k), (i, t, L) => {
      BG[i] = C(o.col, 2 + L * .2); return set(i, worldText('MAIL', HIT.u * fs, HIT.w, t, i, wx, wy, z + .45 * k, c * fs, s * fs, .07 * k, .1 * k), C(WHITE, 13)), true; });
  }
  const [bx, by] = at(0, 0);
  coveRound(bx, by, c, s, .22 * k, .25 * k, z + .22 * k, z + 1.05 * k, .02 * k, paint);
  // the rounded top: a side-on lathe whose axis runs front to back (the box's v)
  drawBox({ ...boxAt(bx, by, c, s, .22 * k, .25 * k, z + .83 * k, z + 1.27 * k), centerZ: z + 1.05 * k,
    clockShape: { x: 0, y: 0, profile: [[-.25 * k, 0], [-.25 * k, .22 * k], [.25 * k, .22 * k], [.25 * k, 0]] } }, paint, homeClockRay);
}
// A bollard: a steel post with a domed head and a reflective band.
const KERB_BOLLARD = [[0, 0], [0, .1], [.74, .1], [.8, .095], [.86, .07], [.9, .03], [.905, 0]];
function drawKerbBollard(o, vx, vy, z, near) {
  kerbLathe(vx, vy, z, KERB_BOLLARD, (i, t, L) => {
    const w = (HIT.w - z) / KERB_K, band = near && w > .62 && w < .7;
    BG[i] = band ? C(YEL, 4 + L * .25) : C(GRAY, 1.2 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true;
  });
}
// A flat part's world normal from its rayBox face (the box runs along (c, s)), for kerbPaint.
function kerbNormal(c, s) {
  const f = HIT.face;
  HIT.nx = f === 1 ? c : f === 2 ? -c : f === 3 ? -s : f === 4 ? s : 0;
  HIT.ny = f === 1 ? s : f === 2 ? -s : f === 3 ? c : f === 4 ? -c : 0;
  HIT.nz = f === 5 ? 1 : f === 6 ? -1 : 0;
}
// A street cabinet (signal controller grey, telecom green): a concrete plinth,
// a steel body under an overhanging cap, two doors on the pavement side with a
// handle, hinges and a label, and louvred vents high on each end.
function drawKerbCabinet(o, vx, vy, z, near) {
  const k = KERB_K, c = o.c, s = o.s, fs = Math.sign(-s * o.fx + c * o.fy) || 1, paint = kerbPaint(o.col, 1.9);
  const at = (a, v) => [vx + (c * a - s * v * fs) * k, vy + (s * a + c * v * fs) * k]; // a along the kerb, v out of the doors
  const flat = (a0, a1, v0, v1, z0, z1, shade) => { const [x, y] = at((a0 + a1) / 2, (v0 + v1) / 2); drawBox(boxAt(x, y, c, s, (a1 - a0) / 2 * k, (v1 - v0) / 2 * k, z + z0 * k, z + z1 * k), (i, t, L) => (kerbNormal(c, s), shade(i, t, L))); };
  if (near) {
    for (const e of [-1, 1]) flat(e > 0 ? .005 : -.38, e > 0 ? .38 : -.005, .25, .256, .16, 1.3, kerbPaint(o.col, 2.2)); // the doors, a seam between
    flat(.3, .33, .256, .27, .62, .82, (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY)); // the handle
    for (const zz of [.3, 1.1]) for (const e of [-1, 1]) flat(e * .395 - .01, e * .395 + .01, .25, .262, zz, zz + .08, (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY)); // hinges
    flat(-.3, -.12, .256, .258, 1.05, 1.17, kerbPaint(WHITE, 3.6)); // its label
    for (const e of [-1, 1]) for (let n = 0; n < 5; n++) { const zz = 1.0 + n * .055; // louvres down each end
      flat(e * .4 - (e > 0 ? 0 : .012), e * .4 + (e > 0 ? .012 : 0), -.18, .18, zz, zz + .022, kerbPaint(o.col, 1.4)); }
  }
  const [bx, by] = at(0, 0);
  coveRound(bx, by, c, s, .43 * k, .28 * k, z + 1.35 * k, z + 1.41 * k, .012 * k, paint); // the cap
  coveRound(bx, by, c, s, .4 * k, .25 * k, z + .1 * k, z + 1.35 * k, .02 * k, paint); // the body
  const stone = kerbPaint(STONE, 2.6);
  drawBox(boxAt(bx, by, c, s, .42 * k, .27 * k, z, z + .1 * k), (i, t, L) => (kerbNormal(c, s), stone(i, t, L))); // the plinth
}
// A street shelter, open to the road: four steel posts, a roof with a lip, a
// glass back with a frosted band at eye height, a glass screen at one end and a
// lit advert panel at the other. (Its bench is a street bench: benches.)
function drawKerbShelter(o, vx, vy, z, near) {
  const k = KERB_K, c = o.c, s = o.s, fs = Math.sign(-s * o.fx + c * o.fy) || 1, steel = (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY);
  const at = (a, v) => [vx + (c * a - s * v * fs) * k, vy + (s * a + c * v * fs) * k]; // a along the kerb, v out of the open front
  const flat = (a0, a1, v0, v1, z0, z1, shade) => { const [x, y] = at((a0 + a1) / 2, (v0 + v1) / 2); drawBox(boxAt(x, y, c, s, (a1 - a0) / 2 * k, (v1 - v0) / 2 * k, z + z0 * k, z + z1 * k), (i, t, L) => (kerbNormal(c, s), shade(i, t, L))); };
  const glass = (i, t, L) => { // clear, but for the frosted band and a glint; the pane's edge is its frame
    const w = (HIT.w - z) / k;
    if (w > 1.0 && w < 1.12) { BG[i] = C(WHITE, 2.6 + L * .1); return set(i, ' ', 0), true; }
    if (near && Math.abs(fract((HIT.u / k + w) * .6) - .3) < .015) return set(i, '/', C(WHITE, 6)) || true;
    return false;
  };
  const [rx, ry] = at(0, 0);
  coveRound(rx, ry, c, s, 1.55 * k, .69 * k, z + 2.35 * k, z + 2.45 * k, .02 * k, kerbPaint(GRAY, 1.6)); // the roof
  for (const a of [-1.45, 1.45]) for (const v of [-.6, .6]) { const [x, y] = at(a, v); coveRound(x, y, c, s, .03 * k, .03 * k, z, z + 2.35 * k, .01 * k, steel); } // the posts
  flat(-1.42, 1.42, -.6, -.52, .08, .14, steel); flat(-1.42, 1.42, -.6, -.52, 2.22, 2.35, steel); // the back's rails, top and bottom
  flat(-1.42, 1.42, -.565, -.555, .14, 2.22, glass); // the glass back
  flat(-1.48, -1.42, -.57, .1, .14, 2.22, glass); // the glass end screen
  const word = (o.word || 'DRINK COLA').split(' ')[0], glow = Math.max(night, overcast * .6);
  const [ex, ey] = at(1.45, -.13);
  flat(1.39, 1.51, -.565, .305, .2, 2.2, (i, t, L) => { // the advert panel, lit, its word on both broad faces
    const w = (HIT.w - z) / k, face = HIT.face;
    if (face !== 1 && face !== 2 || w < .3 || w > 2.1) { BG[i] = C(GRAY, 1.4 + L * .2 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; }
    BG[i] = C(BLUE, 3 + glow * 6);
    if (!near) return set(i, ' ', 0), true;
    const e = face === 1 ? 1 : -1, tx = -s * fs * e, ty = c * fs * e; // (read left to right from either side: along -v from +a, +v from -a)
    return set(i, worldText(word, HIT.v * e * fs, HIT.w, t, i, ex, ey, z + 1.3 * k, tx, ty, .14 * k, .22 * k), C(WHITE, 14)), true;
  });
}
// A timber pole (creosoted, tapering, its top chamfered), the crossarm reaching out over the road on a steel brace,
// a porcelain insulator under each wire, the telephone cable on its bracket, and on some a transformer can on the
// building side, its leads jumping up beside the pole to the first wire. Service drops run back to a wall bracket.
const POLE_TIMBER = (i, t, L) => {
  const grain = coveDetail(t, .3) ? Math.sin(HIT.w * 900 + Math.atan2(HIT.v, HIT.u) * 3) * .12 : 0;
  BG[i] = C(BRICK, .9 + (1.1 + L * .2) * coveLight(HIT.nx, HIT.ny, HIT.nz) + grain); return set(i, ' ', 0), true;
};
const POLE_INSULATOR = [[0, 0], [0, .0025], [.004, .0055], [.006, .0035], [.009, .005], [.012, .003], [.014, 0]];
const POLE_CAN = [[0, 0], [0, .024], [.004, .027], [.1, .027], [.104, .024], [.11, .012], [.112, 0]];
// a wire: a near-black line, dark against the sky and the walls alike; solid once it's wider than a character
const wire = (pts, r, k) => { for (let n = 0; n + 1 < pts.length; n++) { const [ax, ay, az] = pts[n], [bx, by, bz] = pts[n + 1];
  drawRod(ax, ay, az, bx, by, bz, r, (i, t, L) => {
    if (r * 2 * projX / t > 1.2) BG[i] = C(GRAY, .3 + L * k * .1);
    return set(i, courierGlyph(HIT.u, HIT.v, HIT.w, bx - ax, by - ay, bz - az), C(GRAY, .4 + L * k * .1)), true;
  }); } };
function drawKerbPole(o, vx, vy, z, near) {
  const top = z + o.h, at = (off, a = 0) => [vx + o.fx * off + o.c * a, vy + o.fy * off + o.s * a];
  coveLathe(vx, vy, z, [[0, 0], [0, POLE.r0], [o.h - .004, POLE.r1], [o.h, .006], [o.h, 0]], POLE_TIMBER);
  coveRound(...at(.09), o.fx, o.fy, .11, .0055, top - .04, top - .03, .002, POLE_TIMBER); // the crossarm
  if (o.can) coveLathe(...at(-.042), top - .2, POLE_CAN, kerbPaint(GRAY, 2.4));
  if (!near) return;
  coveTube(...at(.012), top - .11, ...at(.1), top - .04, .0025, GRAY); // the arm's brace
  for (const w of POLE_WIRES) if (!w.tel) coveLathe(...at(w.off), top - .03, POLE_INSULATOR, kerbPaint(WHITE, 2.8));
  drawBox(boxAt(...at(.02), o.fx, o.fy, .022, .004, top - .086, top - .078), kerbPaint(GRAY, 1.6)); // the cable bracket
  if (o.can) {
    drawBox(boxAt(...at(-.016), o.fx, o.fy, .006, .02, top - .17, top - .15), kerbPaint(GRAY, 1.6)); // its hanger
    for (const a of [-.01, .01]) wire([[...at(-.042, a), top - .088], [...at(-.018, a + Math.sign(a) * .008), top - .02], [...at(.045, Math.sign(a) * .018), top - .02], [...at(.06), top - .018]], .0012, .14);
  }
  if (o.drop) { // the service drop, sagging to its bracket on the wall
    const w = POLE_WIRES[3], [ex, ey] = R(o.drop.x, o.drop.y), z0 = top - w.dz;
    wire(Array.from({ length: 5 }, (_, n) => { const t = n / 4, [sx, sy] = at(w.off); return [sx + (ex - sx) * t, sy + (ey - sy) * t, z0 + (o.drop.z - z0) * t - .04 * t * (1 - t)]; }), .0015, .12);
    drawBox(boxAt(ex + o.fx * .004, ey + o.fy * .004, o.fx, o.fy, .004, .008, o.drop.z - .004, o.drop.z + .012), kerbPaint(GRAY, 1.8));
  }
}
// a guy wire from near the top of an end pole down to its anchor, a yellow guard sleeve over its foot
function drawKerbGuy(o, vx, vy, z, near) {
  const [px_, py_] = R(o.pole.x, o.pole.y), [gx, gy] = R(o.gx, o.gy), top = o.pole.z + o.pole.h - .05, k = .25;
  wire([[px_, py_, top], [gx, gy, o.gz]], .0012, .14);
  const lift = .004 / (top - o.gz); // (the sleeve's rounded foot rests on the ground)
  coveTube(gx + (px_ - gx) * k * .25, gy + (py_ - gy) * k * .25, o.gz + (top - o.gz) * k * .25, gx + (px_ - gx) * lift, gy + (py_ - gy) * lift, o.gz + .004, .0035, YEL);
  if (near) coveLathe(gx, gy, o.gz, [[0, 0], [0, .006], [.004, .004], [.004, 0]], kerbPaint(GRAY, 1.4)); // the anchor eye
}
// the wires, span by span: sampled finer up close; past POLE_WIRE_VIS (100 m) a wire is too fine to see at all
const POLE_WIRE_VIS = 10;
function drawPoleSpans() {
  forNear(poleSpansB, sp => {
    const [ax, ay] = R(sp.p.x, sp.p.y), [bx, by] = R(sp.q.x, sp.q.y), d = Math.min(Math.hypot(ax, ay), Math.hypot(bx, by));
    if (d > Math.min(vis, POLE_WIRE_VIS) || !inView((ax + bx) / 2, (ay + by) / 2, sp.len / 2 + .2)) return;
    const n = d < 3 ? 12 : d < 6 ? 6 : 3;
    for (const w of POLE_WIRES) wire(Array.from({ length: n + 1 }, (_, k) => { const [x, y, z] = poleWirePoint(sp, w, k / n); return [...R(x, y), z]; }), w.tel ? .0028 : .0016, w.tel ? .1 : .14);
  });
}
const KERB_DRAW = { hydrant: drawKerbHydrant, bin: drawKerbBin, mailbox: drawKerbMailbox, bollard: drawKerbBollard, cabinet: drawKerbCabinet, shelter: drawKerbShelter, pole: drawKerbPole, guy: drawKerbGuy };
function drawKerbFixtures() {
  forNear(kerbsB, o => {
    const [vx, vy] = R(o.x, o.y), d = Math.hypot(vx, vy);
    if (d > vis || o.h * projY / d < .6 || !inView(vx, vy, .05)) return; // (none smaller than a character)
    KERB_DRAW[o.kind](o, vx, vy, terrainHeight(o.x, o.y), d < KERB_NEAR);
  });
  drawPoleSpans();
}
