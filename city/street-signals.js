// A traffic signal, built: a turned pole on a flanged foot with a push-button
// box for the crossing; a two-faced head (lamps toward both ends of its street)
// on a rounded housing, each face on a backplate with a white border, each lamp
// a lens under a cowl visor; and a pedestrian head facing across the junction:
// the walking figure while walkers may start, the hand flashing as the green
// runs out, the hand steady on red. You see the lamps only from along the
// street (the visors hide them from the cross street, as they're meant to).
const SIG = { hl: 0.012, hw: 0.017, z0: 0.29, z1: 0.376 }, SIG_LAMPS = [['R', 0.36, RED], ['Y', 0.333, YEL], ['G', 0.306, GREEN]];
const SIG_PED = { z0: .205, z1: .245, hw: .016, d: .012, out: .02 }; // the pedestrian head, out from the pole
const SIG_HOUSING = (i, t, L) => { BG[i] = C(GRAY, (0.6 + L * 0.12) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '_' : ' ', C(GRAY, L * 0.5)), true; };
const SIG_POLE = [[0, 0], [0, .02], [.006, .02], [.014, .013], [.024, .0095], [.03, .0088], [SIG.z0 - .004, .0082], [SIG.z0, .0095], [SIG.z0, 0]];
// The pedestrian state at a signal's corner: 'walk', 'flash' or 'stop'.
function pedestrianSignal(s, t) {
  if (walkSig(s.bx, s.by, s.vert, t)) return 'walk';
  return light(s.bx, s.by, s.vert, t) === 'R' ? 'stop' : 'flash';
}
// The walking figure and the raised hand, 5 wide by 7 high.
const SIG_FIGURES = { walk: ['..#..', '.###.', '#.#.#', '..#..', '.#.#.', '#...#', '#...#'], stop: ['#.#.#', '#.#.#', '#####', '#####', '.####', '.###.', '..#..'] };
function drawSignal(s) {
  const [vx, vy] = R(s.x, s.y), d = Math.hypot(vx, vy);
  if (d > vis + 1) return;
  const c = s.vert ? 0 : 1, sn = s.vert ? 1 : 0, on = light(s.bx, s.by, s.vert, T), near = d < 6;
  if (near) coveLathe(vx, vy, 0, SIG_POLE, (i, t, L) => coveMetal(i, L, HIT.nx, HIT.ny, HIT.nz, GRAY));
  else rod(vx, vy, 0, vx, vy, SIG.z0, 0.009);
  coveRound(vx, vy, c, sn, SIG.hl, SIG.hw, SIG.z0, SIG.z1, .004, (i, t, L) => { BG[i] = C(GRAY, .55 + L * .14 * coveLight(HIT.nx, HIT.ny, HIT.nz)); return set(i, ' ', 0), true; });
  const k = -(vx * c + vy * sn) / (d || 1); // +1: we're off the head's +u end
  for (const e of [-1, 1]) {
    if (near) { // the backplate, a white border round its black face
      const bx = vx + c * e * (SIG.hl + .0015), by = vy + sn * e * (SIG.hl + .0015);
      drawBox(boxAt(bx, by, c, sn, .0015, SIG.hw + .01, SIG.z0 - .008, SIG.z1 + .008), (i, t, L) => {
        const edge = Math.abs(HIT.v) > SIG.hw + .007 || HIT.w < SIG.z0 - .005 || HIT.w > SIG.z1 + .005;
        BG[i] = edge ? C(WHITE, 3 + L * .1) : C(GRAY, .35); return set(i, ' ', 0), true; });
    }
    if (e * k < 0.3) continue;
    const ux = vx + c * e * (SIG.hl + .003), uy = vy + sn * e * (SIG.hl + .003);
    // the lit lamp first: far off all three share a character, and it should be the one you see
    for (const [st, z, col] of [...SIG_LAMPS].sort(a => a[0] === on ? -1 : 1)) {
      const lit = st === on;
      dot(ux, uy, z, 0.0095, (i, t, L) => { // up close a lens of solid colour, far off its one character
        BG[i] = C(col, lit ? 11 : 2.2);
        return set(i, 0.019 * projX / t > 2 ? ' ' : lit ? 'O' : 'o', C(col, lit ? 15 : 4)), true;
      });
      if (near) { // the cowl: a hood over the lens and its two cheeks, open below
        const hx = ux + c * e * .007, hy = uy + sn * e * .007;
        drawBox(boxAt(hx, hy, c, sn, .007, .012, z + .0095, z + .0115), SIG_HOUSING);
        for (const f of [-1, 1]) drawBox(boxAt(hx - sn * f * .011, hy + c * f * .011, c, sn, .007, .001, z - .004, z + .0095), SIG_HOUSING);
      }
    }
  }
  if (!near) return;
  // the pedestrian head, facing across the junction (toward its middle), and the push button facing the kerb
  const away = Math.sign(s.vert ? s.y - (s.by + 1) : s.x - (s.bx + 1)) || 1, nx = -c * away, ny = -sn * away;
  const ped = pedestrianSignal(s, T), lit = ped === 'walk' || ped === 'stop' || fract(T) < .5, fig = SIG_FIGURES[ped === 'walk' ? 'walk' : 'stop'];
  const px_ = vx + nx * SIG_PED.out, py_ = vy + ny * SIG_PED.out;
  coveTube(vx, vy, (SIG_PED.z0 + SIG_PED.z1) / 2, px_ - nx * SIG_PED.d, py_ - ny * SIG_PED.d, (SIG_PED.z0 + SIG_PED.z1) / 2, .003, GRAY); // its bracket
  drawBox(boxAt(px_, py_, c, sn, SIG_PED.d, SIG_PED.hw, SIG_PED.z0, SIG_PED.z1), (i, t, L) => {
    const front = HIT.face === (away < 0 ? 1 : 2); // (the face toward the junction)
    if (!front) return SIG_HOUSING(i, t, L);
    const q = (HIT.v * (away < 0 ? -1 : 1) * (s.vert ? -1 : 1) / SIG_PED.hw + 1) / 2, zz = (HIT.w - SIG_PED.z0) / (SIG_PED.z1 - SIG_PED.z0);
    const col = ped === 'walk' ? WHITE : ORANGE, cx = Math.floor(q * 7) - 1, cz = 6 - Math.floor(zz * 9 - 1);
    const on = lit && cx >= 0 && cx < 5 && cz >= 0 && cz < 7 && fig[cz][cx] === '#';
    const big = SIG_PED.hw * 2 / 7 * projX / t > 1; // (the figure once its dots are a character or more, else the lamp's colour)
    BG[i] = !lit ? C(GRAY, .4) : big ? (on ? C(col, 12) : C(GRAY, .4)) : C(col, 6); return set(i, ' ', 0), true;
  });
  const bx = vx - nx * .011, by = vy - ny * .011;
  drawBox(boxAt(bx, by, c, sn, .003, .008, .1, .125), (i, t, L) => { // the push button box, yellow, a black button in it
    const btn = Math.hypot(HIT.v, HIT.w - .114) < .003; BG[i] = btn ? C(GRAY, .3) : C(YEL, 3 + L * .2 * coveLight(0, 0, 1)); return set(i, ' ', 0), true; });
}
