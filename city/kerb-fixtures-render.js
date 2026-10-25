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
const KERB_DRAW = { hydrant: drawKerbHydrant, bin: drawKerbBin, mailbox: drawKerbMailbox, bollard: drawKerbBollard };
function drawKerbFixtures() {
  forNear(kerbsB, o => {
    const [vx, vy] = R(o.x, o.y), d = Math.hypot(vx, vy);
    if (d > vis || o.h * projY / d < .6 || !inView(vx, vy, .05)) return; // (none smaller than a character)
    KERB_DRAW[o.kind](o, vx, vy, terrainHeight(o.x, o.y), d < KERB_NEAR);
  });
}
