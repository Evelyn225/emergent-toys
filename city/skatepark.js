// ===== the skatepark (props.js SKATEPARK) and everything you can grind. On the park's concrete: two flat bars, a low
// and a high granite ledge with steel coping, and a manual pad. Each is a solid you collide with below its top and can
// ride along on top of (skateparkGround); every edge you can grind is in GRINDS, with the benches' seat fronts all
// round the city. Cells (1 = 10 m)
const GRINDS = []; // { ax, ay, bx, by: the edge; z: its top above the ground there; material: 'metal' | 'stone' | 'wood'; kind }
const SKATE_FEATURES = []; // park features and the marked street-spot obstacles
let grindsB = [];
// built once the city is in its final place (world-bootstrap.js): the park block, its features and every grind edge
function buildSkatepark() {
  GRINDS.length = SKATE_FEATURES.length = 0;
  if (typeof SK_TRANSITIONS !== 'undefined') SK_TRANSITIONS.length = 0;
  if (typeof skateSurfaceReset === 'function') skateSurfaceReset();
  const park = parks.find(([bx, by]) => bx === 13 && by === 34);
  SKATEPARK = park ? { bx: 13, by: 34, x0: 2.4, y0: 2.3, x1: 7.85, y1: 7.85 } : null; // (most of the park block: the benches round it stay, to grind)
  if (SKATEPARK) {
    for (let k = trees.length - 1; k >= 0; k--) if (inSkatepark(trees[k].x, trees[k].y, .3)) trees.splice(k, 1); // (the concrete's clear)
    const ox = SKATEPARK.bx * 8, oy = SKATEPARK.by * 8;
    const add = (x, y, alongX, hl, hw, z1, kind) => {
      const o = { x: ox + x, y: oy + y, c: alongX ? 1 : 0, s: alongX ? 0 : 1, hl, hw, z0: 0, z1, kind, low: true };
      solids.push(o); SKATE_FEATURES.push(o);
      return o;
    };
    const edge = (o, side, material) => { // a long top edge: side -1 / +1 across it, 0 along its middle (a bar)
      const ex = o.x - o.s * side * o.hw, ey = o.y + o.c * side * o.hw;
      GRINDS.push({ ax: ex - o.c * o.hl, ay: ey - o.s * o.hl, bx: ex + o.c * o.hl, by: ey + o.s * o.hl, z: o.z1, material, kind: o.kind, feature: o });
    };
    edge(add(6.0, 6.0, true, .3, .004, .035, 'skaterail'), 0, 'metal'); // a 6 m flat bar, 35 cm up
    edge(add(7.3, 6.9, false, .35, .004, .03, 'skaterail'), 0, 'metal'); // and a 7 m one, 30 cm
    for (const [x, y, hl, hw, z] of [[6.5, 7.4, .45, .03, .04], [5.95, 6.75, .25, .035, .06]]) { // ledges: 9 m at 40 cm, 5 m at 60 cm
      const o = add(x, y, true, hl, hw, z, 'skateledge');
      edge(o, -1, 'metal'); edge(o, 1, 'metal'); // (steel coping on both edges)
    }
    const pad = add(7.1, 5.9, false, .25, .15, .02, 'manualpad'); // a 5 x 3 m manual pad, 20 cm
    edge(pad, -1, 'stone'); edge(pad, 1, 'stone');
    // the long lines, for long grinds: a 20 m flat bar, a 16 m ledge, a 16 m low bar, a 14 m curb
    edge(add(4.0, 2.75, true, 1.0, .004, .035, 'skaterail'), 0, 'metal');
    { const o = add(3.6, 4.2, false, .8, .03, .045, 'skateledge'); edge(o, -1, 'metal'); edge(o, 1, 'metal'); }
    edge(add(2.9, 6.7, false, .8, .004, .03, 'skaterail'), 0, 'metal');
    { const o = add(4.3, 6.3, true, .7, .025, .025, 'skateledge'); edge(o, -1, 'metal'); edge(o, 1, 'metal'); }
    // ramps (ground you roll up and over, not solids you bump: skateRamps): a funbox, 12 m long, its 6 m deck coped
    // along both sides to grind; and a kicker that throws you off its lip
    const ramp = (x, y, alongX, hl, hw, z1, kind, run) => {
      const o = { x: ox + x, y: oy + y, c: alongX ? 1 : 0, s: alongX ? 0 : 1, hl, hw, z0: 0, z1, kind: 'skateramp', ramp: kind, run, low: true, ray: typeof rayRamp === 'function' ? rayRamp : null };
      solids.push(o); SKATE_FEATURES.push(o);
      return o;
    };
    const box = ramp(4.6, 4.3, true, .6, .2, .05, 'funbox', .3);
    for (const side of [-1, 1]) { const ex = box.x - box.s * side * box.hw, ey = box.y + box.c * side * box.hw, d = box.hl - box.run;
      GRINDS.push({ ax: ex - box.c * d, ay: ey - box.s * d, bx: ex + box.c * d, by: ey + box.s * d, z: box.z1, material: 'metal', kind: 'skateledge', feature: box }); }
    ramp(6.3, 3.4, true, .175, .12, .05, 'kicker', .35);
    if (typeof addSkateTransition === 'function') {
      addSkateTransition(ox + 4.85, oy + 7.5);
      addSkateTransition(ox + 7.2, oy + 7.65, { radius: .3, height: .36, extension: .06, width: .34 });
    }
    if (typeof addSkateBowl === 'function') addSkateBowl(ox + 6.3, oy + 4.7);
  }
  if (typeof buildSkateSpots === 'function') buildSkateSpots();
  // a bench's seat front: 1.5 m of timber at 45 cm, facing out
  for (const b of benches) {
    const c = -b.fy, s = b.fx, ex = b.x + b.fx * .02, ey = b.y + b.fy * .02;
    GRINDS.push({ ax: ex - c * .075, ay: ey - s * .075, bx: ex + c * .075, by: ey + s * .075, z: .045, material: 'wood', kind: 'bench', bench: b, feature: b });
  }
  grindsB = bucketed(GRINDS.map(g => Object.assign(g, { x: (g.ax + g.bx) / 2, y: (g.ay + g.by) / 2 }))); // (by middle)
  if (typeof buildGrindPaths === 'function') buildGrindPaths();
  if (typeof refreshSkateSpotDirectory === 'function') refreshSkateSpotDirectory();
}
// the top of whatever park feature you're over (0: none): you ride along it, and drop off its end
function skateparkGround(x, y) {
  if (!inSkatepark(x, y, .1)) return typeof skateSpotGround === 'function' ? skateSpotGround(x, y) : 0;
  let top = 0;
  for (const o of SKATE_FEATURES) {
    const qx = x - o.x, qy = y - o.y, u = qx * o.c + qy * o.s;
    if (o.bowl && Math.hypot(qx, qy) > o.hl) continue;
    if (Math.abs(u) <= o.hl && Math.abs(-qx * o.s + qy * o.c) <= o.hw) top = Math.max(top, o.profile ? skateProfileHeight(o, o.bowl ? Math.hypot(qx, qy) : u) : o.ramp ? rampHeight(o, u) : o.z1);
  }
  return top;
}
// a ramp's surface at u along it: a kicker rises the whole way to its lip (+u); a funbox goes up, along its deck, and down
function rampHeight(o, u) {
  if (o.ramp === 'kicker') return o.z1 * clamp((u + o.hl) / (2 * o.hl), 0, 1);
  return o.z1 * clamp(Math.min((u + o.hl) / o.run, (o.hl - u) / o.run), 0, 1);
}
const skateRampAt = (x, y) => SKATE_FEATURES.find(o => { if (!o.ramp) return false; const qx = rel(x - o.x), qy = rel(y - o.y); return Math.abs(qx * o.c + qy * o.s) <= o.hl && Math.abs(-qx * o.s + qy * o.c) <= o.hw; });
// Slope acceleration and lip exits now live in skate-physics.js.
