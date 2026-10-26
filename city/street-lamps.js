// The street lamp up close, turned rather than boxed: a flared cast base, a
// fluted pole tapering to its finial with a collar part way up, the swan neck
// as one smooth curve of tube, the drop rod, and the lantern itself: a ribbed
// glass body between a domed cap and a finial, glowing after dark. Further off
// the billboard (lampCell) stands in for it at a fraction of the cost.
const LAMP_NECK_BITS = 10;
const LAMP_BASE = [[0, 0], [0, .028], [.008, .028], [.012, .025], [.03, .019], [.05, .015], [.058, .0125], [.062, .0115], [.062, 0]];
const LAMP_LANTERN = [[0, 0], [0, .004], [.012, .008], [.02, .014], [.026, .02], [.03, .02], [.09, .024], [.092, .031], [.098, .031], [.108, .018], [.116, .008], [.12, 0]]; // from its finial up to the cap
const lampSteel = (i, t, L) => {
  const flute = coveGroove(Math.atan2(HIT.v, HIT.u) * 12 / TAU, 1, .3, t / projX * 80) * coveDetail(t, .02); // the pole's flutes, gone far off
  BG[i] = C(GRAY, .9 + L * .28 * coveLight(HIT.nx, HIT.ny, HIT.nz) - flute * .35); return set(i, ' ', 0), true;
};
function drawLamp3D(vx, vy, ax, ay, top = LAMP_TOP) {
  const lit = lampsOn > .3, metal = (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY);
  coveLathe(vx, vy, 0, LAMP_BASE, metal);
  coveLathe(vx, vy, .062, [[0, 0], [0, .0105], [top - .062, .0078], [top - .062, 0]], lampSteel); // the pole, tapering
  coveLathe(vx, vy, .41, [[0, 0], [0, .014], [.006, .0165], [.014, .0165], [.02, .014], [.02, 0]], metal); // its collar
  coveLathe(vx, vy, top - .004, [[0, 0], [0, .0095], [.008, .011], [.016, .007], [.024, 0]], metal); // the finial on top
  for (let k = 0; k < LAMP_NECK_BITS; k++) { // the swan neck: up and over from the pole top out to the drop
    const t0 = Math.PI * (1 - k / LAMP_NECK_BITS), t1 = Math.PI * (1 - (k + 1) / LAMP_NECK_BITS);
    const u0 = NECK + NECK * Math.cos(t0), u1 = NECK + NECK * Math.cos(t1), z0 = top + NECK * Math.sin(t0), z1 = top + NECK * Math.sin(t1);
    coveTube(vx + ax * u0, vy + ay * u0, z0, vx + ax * u1, vy + ay * u1, z1, .0075, GRAY);
  }
  const hx = vx + ax * 2 * NECK, hy = vy + ay * 2 * NECK, base = top - .15;
  coveTube(hx, hy, top, hx, hy, base + .116, .003, GRAY); // the drop
  coveLathe(hx, hy, base, LAMP_LANTERN, (i, t, L) => {
    const w = HIT.w - base, glass = w > .03 && w < .09;
    if (!glass) return metal(i, t, L);
    const rib = coveGroove(Math.atan2(HIT.v, HIT.u) * 6 / TAU, 1, .08, t / projX * 25) * coveDetail(t, .03); // six frame bars
    if (rib > .5) return metal(i, t, L);
    BG[i] = lit ? C(WARM, 6 + lampsOn * 6) : C(CYAN, 1 + L * .12); return set(i, ' ', 0), true;
  });
  if (lit) drawShape(hx, hy, top - .16, .075, .13, (i, u, z, du, dz) => { // the soft glow round the lantern
    const halo = Math.hypot(u / .075, (z - .065) / .065);
    if (halo >= 1) return false;
    BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, ' ', 0), true;
  });
}
