// ===== the skatepark (props.js SKATEPARK) and everything you can grind. On the park's concrete: two flat bars, a low
// and a high granite ledge with steel coping, and a manual pad. Each is a solid you collide with below its top and can
// ride along on top of (skateparkGround); every edge you can grind is in GRINDS, with the benches' seat fronts all
// round the city. Cells (1 = 10 m)
const GRINDS = []; // { ax, ay, bx, by: the edge; z: its top above the ground there; material: 'metal' | 'stone' | 'wood'; kind }
const SKATE_FEATURES = [];
let grindsB = [];
// built once the city is in its final place (world-bootstrap.js): the park block, its features and every grind edge
function buildSkatepark() {
  GRINDS.length = SKATE_FEATURES.length = 0;
  const park = parks.find(([bx, by]) => bx === 13 && by === 34);
  SKATEPARK = park ? { bx: 13, by: 34, x0: 5.5, y0: 5.45, x1: 7.85, y1: 7.85 } : null;
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
  }
  // a bench's seat front: 1.5 m of timber at 45 cm, facing out
  for (const b of benches) {
    const c = -b.fy, s = b.fx, ex = b.x + b.fx * .02, ey = b.y + b.fy * .02;
    GRINDS.push({ ax: ex - c * .075, ay: ey - s * .075, bx: ex + c * .075, by: ey + s * .075, z: .045, material: 'wood', kind: 'bench', bench: b, feature: b });
  }
  grindsB = bucketed(GRINDS.map(g => Object.assign(g, { x: (g.ax + g.bx) / 2, y: (g.ay + g.by) / 2 }))); // (by middle)
}
// the top of whatever park feature you're over (0: none): you ride along it, and drop off its end
function skateparkGround(x, y) {
  if (!inSkatepark(x, y, .1)) return 0;
  let top = 0;
  for (const o of SKATE_FEATURES) {
    const qx = x - o.x, qy = y - o.y;
    if (Math.abs(qx * o.c + qy * o.s) <= o.hl && Math.abs(-qx * o.s + qy * o.c) <= o.hw) top = Math.max(top, o.z1);
  }
  return top;
}
