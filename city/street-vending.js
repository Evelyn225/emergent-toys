// The vending machine, built: a steel cabinet with rounded edges on a recessed
// plinth, its door framing a lit header, a glass window onto four shelves of
// stock, the control column (display, keypad, coin and note slots, the coin
// cup) and the delivery flap in its chute. Sizes are metres; sc/10 scales them
// (sc 1 outdoors, in cells; 10 indoors). The footprint is VM_HL x VM_HW x VM_H.
const VM_COL = { DRINKS: RED, SNACKS: BLUE, CIGARETTES: GRAY };
const VM_GOODS = { DRINKS: ['o', [RED, BLUE, GREEN, YEL, WHITE]], SNACKS: ['#', [YEL, ORANGE, RED, GREEN, MAG]], CIGARETTES: ['=', [WHITE, RED, YEL, WHITE, CYAN]] };
// a: across the front, left to right as you face it; v: out of the front; z: up
const VM = { a0: -.39, a1: .15, z0: .46, z1: 1.58, // the window
  shell: .28, door: .34, glass: [.30, .31], back: -.2, chute: [-.33, .05, .14, .36], shelves: 4, items: 5, near: .9 };
const VM_CAN = [[0, 0], [0, .028], [.008, .033], [.112, .033], [.123, .026], [.123, 0]];
// A flat part's world normal from its rayBox face, for coveLight.
function vmNormal(c, s) {
  const f = HIT.face;
  HIT.nx = f === 1 ? c : f === 2 ? -c : f === 3 ? -s : f === 4 ? s : 0;
  HIT.ny = f === 1 ? s : f === 2 ? -s : f === 3 ? c : f === 4 ? -c : 0;
  HIT.nz = f === 5 ? 1 : f === 6 ? -1 : 0;
}
function drawVending(m, vx, vy, sc = 1) {
  const k = sc / 10, fs = m.fs, c = m.c, s = m.s, body = VM_COL[m.kind], [g_, cols_] = VM_GOODS[m.kind];
  const glow = Math.max(night, overcast * 0.6), fx = -s * fs, fy = c * fs;
  const at = (a, v) => { const u = a * fs * k, w = v * fs * k; return [vx + c * u - s * w, vy + s * u + c * w]; };
  const near = Math.hypot(vx, vy) < VM.near * sc, front = -(vx * fx + vy * fy) > VM.door * k; // (you can see into it)
  const lit = (base, n) => (i, t, L) => { BG[i] = C(base, n + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; };
  const flat = (a0, a1, v0, v1, z0, z1, shade) => { const [x, y] = at((a0 + a1) / 2, (v0 + v1) / 2); drawBox(boxAt(x, y, c, s, (a1 - a0) / 2 * k, (v1 - v0) / 2 * k, z0 * k, z1 * k), (i, t, L) => (vmNormal(c, s), shade(i, t, L))); };
  const across = (centre = 0) => HIT.u * fs / k + centre, outward = () => (-s * HIT.nx + c * HIT.ny) * fs; // (a of a hit on a part centred at a = centre; its normal out of the front)
  // the cabinet: one rounded shell, open where the window and the chute look into it
  const [sx, sy] = at(0, (VM.shell - .35) / 2);
  coveRound(sx, sy, c, s, .45 * k, (VM.shell + .35) / 2 * k, .06 * k, 1.9 * k, .035 * k, (i, t, L) => {
    const a = across(), z = HIT.w / k, [ca0, ca1, cz0, cz1] = VM.chute;
    if (outward() > .7 && (a > VM.a0 && a < VM.a1 && z > VM.z0 && z < VM.z1 || a > ca0 && a < ca1 && z > cz0 && z < cz1)) return false;
    const band = Math.abs(outward()) < .3 && z > 1.0 && z < 1.32; // a lighter stripe down each side
    BG[i] = C(body, (band ? 2.4 : 1.5) + L * .32 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true;
  });
  flat(-.42, .42, -.32, .25, 0, .06, lit(GRAY, .8)); // the plinth, set back under it
  // the door: header, stile, control column and the frame round the chute
  const [hx, hy] = at(0, (VM.shell + .35) / 2);
  coveRound(hx, hy, c, s, .44 * k, (.35 - VM.shell) / 2 * k, VM.z1 * k, 1.86 * k, .012 * k, (i, t, L) => {
    if (outward() < .7) { BG[i] = C(body, 1.4 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; }
    BG[i] = C(body, 5 + glow * 7);
    const word = m.kind, letterW = Math.min(.075, .8 / word.length) * k;
    return set(i, worldText(word, HIT.u * fs, HIT.w, t, i, hx, hy, 1.72 * k, c * fs, s * fs, letterW, .16 * k), C(WHITE, 15)), true;
  });
  const frame = lit(body, 1.6), panel = lit(GRAY, 1.8);
  flat(-.44, VM.a0, VM.shell, VM.door, VM.z0, VM.z1, frame); // the stile
  flat(VM.a1, .44, VM.shell, VM.door, VM.z0, VM.z1, panel); // the control column
  const [ca0, ca1, cz0, cz1] = VM.chute;
  flat(-.44, .44, VM.shell, VM.door, cz1, VM.z0, frame); flat(-.44, .44, VM.shell, VM.door, .08, cz0, frame); // above and below the chute
  flat(-.44, ca0, VM.shell, VM.door, cz0, cz1, frame); flat(ca1, .44, VM.shell, VM.door, cz0, cz1, frame); // either side of it
  // the chute, and its flap hanging in it with a lip to push
  flat(ca0, ca1, VM.shell - .09, VM.shell - .01, cz0, cz1, (i, t, L) => { BG[i] = C(GRAY, .5); return set(i, ' ', 0), true; });
  flat(ca0 + .01, ca1 - .01, VM.shell - .005, VM.shell + .005, cz0 + .01, cz1 - .005, lit(GRAY, 1.2));
  flat(ca0 + .1, ca1 - .1, VM.shell + .005, VM.shell + .02, cz1 - .035, cz1 - .02, lit(GRAY, 2.4));
  // the controls, out of the column's face: display, keypad, coin slot, note slot, coin cup
  if (front) {
    const d = VM.door;
    flat(.2, .39, d, d + .01, 1.37, 1.49, (i, t, L) => { BG[i] = C(GRAY, .4); if (outward() < .7 || .032 * k * projX / t < .8) return set(i, ' ', 0), true; const [ex, ey] = at(.295, d + .01);
      return set(i, worldText('READY', HIT.u * fs, HIT.w, t, i, ex, ey, 1.43 * k, c * fs, s * fs, .032 * k, .001 * k), C(RED, 7 + glow * 8)), true; }); // (one character a letter, never block letters; blank once they're smaller than a cell)
    flat(.22, .37, d, d + .01, 1.0, 1.3, (i, t, L) => {
      const key = outward() > .7 && fract(HIT.w / k / .075) > .35 && fract(across() / .05 + .5) > .3;
      BG[i] = C(key ? WHITE : GRAY, (key ? 2.4 : 1.2) + L * .2 * coveDetail(t, .05)); return set(i, ' ', 0), true;
    });
    flat(.25, .33, d, d + .01, .86, .94, (i, t, L) => { BG[i] = C(GRAY, outward() > .7 && Math.abs(HIT.w / k - .9) < .008 ? .3 : 3 + L * .2); return set(i, ' ', 0), true; });
    flat(.22, .37, d, d + .01, .7, .8, (i, t, L) => { BG[i] = C(GRAY, outward() > .7 && Math.abs(HIT.w / k - .75) < .006 ? .3 : 2.2 + L * .2); return set(i, ' ', 0), true; });
    flat(.26, .34, d - .03, d + .005, .52, .6, (i, t, L) => { BG[i] = C(GRAY, HIT.face === 5 ? .4 : 2.6 + L * .2); return set(i, ' ', 0), true; });
  }
  const [gl0, gl1] = VM.glass, rows_ = VM.shelves, wide = VM.a1 - VM.a0, high = VM.z1 - VM.z0, mid = (VM.a0 + VM.a1) / 2;
  const inside = near && front; // (stock you can see into is built; otherwise it's painted on the glass)
  if (inside) {
    // inside: the lit back, the lining, the shelves with their price lips, and the stock on them
    const lining = (i, t, L) => { BG[i] = C(GRAY, 1.8 + glow * 1.6); return set(i, ' ', 0), true; }, b = VM.back, sh = VM.shell;
    flat(VM.a0, VM.a1, b - .02, b, VM.z0, VM.z1, (i, t, L) => { BG[i] = C(WHITE, 1.8 + glow * 2.4); return set(i, ' ', 0), true; });
    flat(VM.a0 - .02, VM.a0, b, sh, VM.z0, VM.z1, lining); flat(VM.a1, VM.a1 + .02, b, sh, VM.z0, VM.z1, lining);
    flat(VM.a0, VM.a1, b, sh, VM.z1, VM.z1 + .02, (i, t, L) => { BG[i] = C(WHITE, 4 + glow * 6); return set(i, ' ', 0), true; }); // the strip light in its ceiling
    for (let r = 0; r < rows_; r++) {
      const z = VM.z0 + r * high / rows_;
      flat(VM.a0, VM.a1, b, .25, z, z + .015, lining);
      flat(VM.a0, VM.a1, .25, .265, z, z + .035, (i, t, L) => { const slot = fract((across(mid) - VM.a0) / wide * VM.items), tag = slot > .35 && slot < .65; BG[i] = C(tag ? WHITE : GRAY, tag ? 3.5 + glow * 3 : 1.6); return set(i, ' ', 0), true; });
      for (let j = 0; j < VM.items; j++) {
        const a = VM.a0 + (j + .5) * wide / VM.items, col = cols_[(j + r * 2) % 5], [x, y] = at(a, .1), zz = (z + .015) * k;
        if (m.kind === 'DRINKS') coveLathe(x, y, zz, VM_CAN.map(([h, rr]) => [h * k, rr * k]), (i, t, L) => {
          const band = Math.abs(HIT.w / k - z - .075) < .02; BG[i] = C(band ? WHITE : col, (band ? 3 : 2.2) + glow * 2 + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; });
        else if (m.kind === 'SNACKS') coveRound(x, y, c, s, .042 * k, .014 * k, zz, zz + .17 * k, .012 * k, (i, t, L) => {
          BG[i] = C(col, 2.4 + glow * 2 + L * .3 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; });
        else for (const e of [-1, 1]) { const [px_, py_] = at(a + e * .03, .1); drawBox(boxAt(px_, py_, c, s, .027 * k, .011 * k, zz, zz + .088 * k), (i, t, L) => {
          vmNormal(c, s); const top = HIT.w / k > z + .075; BG[i] = C(top ? WHITE : col, (top ? 3.2 : 2.2) + glow * 2 + L * .25 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; }); }
      }
    }
  }
  // the glass: clear but for a glint up close; at a distance the stock is painted on it instead
  flat(VM.a0, VM.a1, gl0, gl1, VM.z0, VM.z1, (i, t, L) => {
    const q = (across(mid) - VM.a0) / wide, z = (HIT.w / k - VM.z0) / high;
    if (inside) return Math.abs(fract(q * .7 + z * .9) - .3) < .012 ? set(i, '/', C(WHITE, 6 + glow * 3)) || true : false; // (no background of its own)
    const sz = z * rows_, row = Math.floor(sz), sq = q * VM.items, j = Math.floor(sq);
    BG[i] = C(CYAN, 1 + glow * 2.5);
    if (fract(sz) < .12) return set(i, '_', C(GRAY, Math.max(L * .7, glow * 8))), true;
    const item = fract(sq) > .18 && fract(sq) < .82 && fract(sz) < .8, col = cols_[(j + row * 2) % 5];
    if (item) BG[i] = C(col, 2 + glow * 3);
    return set(i, item ? g_ : ' ', C(col, Math.max(L, glow * 13))), true;
  });
}
