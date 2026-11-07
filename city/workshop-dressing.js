'use strict';
// ---- a second pass over the working rooms: the garage, the tyre shop, the welder's, the courier office and the gym.
// Everything here is added on top of what each room already had (WORLD_QUALITY item 41).
// The extra people are tagged sparseExtra so the rooms' own staff counts stay what they were.

const SPARSE_FILL = (col, k = 1) => (i, t, L) => { BG[i] = C(col, (1 + L * .3 * k) * shadeFace(HIT.face) + (HIT.face === 5 ? .4 : 0)); return set(i, ' ', 0), true; };
const SPARSE_FLAT = (x, y, hl, hw, shade, c = 1, s = 0) => ({ x, y, walk: true, radius: Math.hypot(hl, hw), draw: (vx, vy) => drawBox(boxAt(vx, vy, c, s, hl, hw, 0, .004), shade) });
// a ring of short rods: a wheel's rim or a tyre seen side on, round the axis (ax, ay) at (x, y, z)
function sparseRing(x, y, z, r, ax, ay, thick, col, k = 1, n = 14) {
  for (let j = 0; j < n; j++) {
    const a0 = j / n * TAU, a1 = (j + 1) / n * TAU, p = a => [x + -ay * Math.cos(a) * r, y + ax * Math.cos(a) * r, z + Math.sin(a) * r];
    rod(...p(a0), ...p(a1), thick, col, k);
  }
}
// a car tyre on its rim, its axle along (ax, ay): black rubber, a grey hub, the tread just showing up close
function sparseTyre(x, y, z, r, ax, ay, w = .1) {
  drawRod(x - ax * w, y - ay * w, z, x + ax * w, y + ay * w, z, r, (i, t, L) => { BG[i] = C(GRAY, .55 + L * .1); return set(i, t < 4 ? ':' : ' ', C(GRAY, 1.4)), true; });
  drawRod(x - ax * (w + .01), y - ay * (w + .01), z, x + ax * (w + .01), y + ay * (w + .01), z, r * .55, (i, t, L) => { BG[i] = C(GRAY, 3 + L * .3); return set(i, ' ', 0), true; });
  dot(x + ax * (w + .02), y + ay * (w + .02), z, r * .15, (i, t, L) => { BG[i] = C(GRAY, 1.5); return set(i, ' ', 0), true; });
}
const sparseExtra = list => list.map(o => o.fig ? { ...o, sparseAdded: true, sparseExtra: true } : { ...o, sparseAdded: true });

// ---- the garage (AUTO REPAIR): the car on the lift gets wheels, lights and the lift's arms; a tool chest, oil drums,
// a trolley jack, a tyre or two waiting, oil on the floor, someone in the chair waiting for their car
const SPARSE_TOOL_CHEST = (x, y, fx, fy, col = RED) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  const c = Math.abs(fy), s = Math.abs(fx);
  drawBox(boxAt(vx, vy, c, s, .45, .25, .12, 1.05), (i, t, L) => {
    const f = HIT.face, w = HIT.w; BG[i] = C(col, (1.6 + L * .35) * shadeFace(f) + (f === 5 ? .6 : 0)); set(i, ' ', 0);
    const front = (fy && (f === 3 || f === 4)) || (fx && (f === 1 || f === 2));
    if (front && w > .15) { const dz = fract((w - .15) / .15); if (dz < .1) BG[i] = C(col, .6); else if (Math.abs(dz - .5) < .08 && Math.abs(f <= 2 ? HIT.v : HIT.u) < .3) BG[i] = C(GRAY, 4 + L * .3); } // drawers and their handles
    return true;
  });
  drawBox(boxAt(vx, vy, c, s, .45, .25, 1.05, 1.09), SPARSE_FILL(GRAY, 1.2)); // the rubber mat on top
  for (const e of [-1, 1]) for (const g of [-1, 1]) drum(vx + (c * e * .38 - s * g * .18), vy + (s * e * .38 + c * g * .18), .05, 0, .12, SPARSE_FILL(GRAY, .5));
  drawBox(boxAt(vx + fx * .1 - c * .2, vy + fy * .1 - s * .2, c, s, .12, .05, 1.09, 1.18), SPARSE_FILL(YEL)); // a spanner set in its case
}), box: boxAt(x, y, Math.abs(fy), Math.abs(fx), .45, .25, 0, 1.1), radius: .55, toolChest: true });
const SPARSE_DRUM = (x, y, col, label) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, .29, 0, .88, (i, t, L) => { const band = Math.abs(HIT.w - .3) < .02 || Math.abs(HIT.w - .6) < .02; BG[i] = C(col, (band ? 1.3 : 2.4 + L * .3) * drumLit(.29)); return set(i, ' ', 0), true; });
  drum(vx, vy, .27, .88, .9, (i, t, L) => { BG[i] = C(GRAY, 2.2 + L * .2); return set(i, Math.hypot(HIT.u - .12, HIT.v) < .04 ? 'o' : ' ', C(GRAY, .8)), true; });
}, [.29, .29, .9]);
const SPARSE_JACK = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .35, .14, .05, .17), SPARSE_FILL(RED, 1.2));
  for (const e of [-1, 1]) for (const g of [-1, 1]) drum(vx + e * .28, vy + g * .12, .045, 0, .06, SPARSE_FILL(GRAY, .4));
  drawBox(boxAt(vx + .32, vy, 1, 0, .06, .08, .17, .26), SPARSE_FILL(GRAY, 1)); // the saddle
  rod(vx - .35, vy, .14, vx - 1.05, vy, .62, .016, GRAY, 1.3); // the handle
}, [.38, .16, .3]);
// the lifted car's running gear: four wheels hanging off it, the lift's arms under the sills, lamps at each end
const SPARSE_LIFT_GEAR = (x, y, body) => ({ x, y, radius: 2.6, draw: (vx, vy) => {
  for (const e of [-1, 1]) for (const g of [-1, 1]) sparseTyre(vx + e * 1.35, vy + g * .78, 1.22, .3, 0, 1, .11);
  for (const e of [-1, 1]) for (const g of [-1, 1]) rod(vx - e * 2.2, vy + g * .55, 1.2, vx + e * .9, vy + g * .82, 1.2, .045, YEL, 1.4); // the lift's arms, swung in
  for (const g of [-1, 1]) {
    drawBox(boxAt(vx + 2.11, vy + g * .6, 1, 0, .02, .17, 1.6, 1.74), (i, t, L) => { BG[i] = C(WHITE, 9); return set(i, ' ', 0), true; });
    drawBox(boxAt(vx - 2.11, vy + g * .62, 1, 0, .02, .15, 1.62, 1.74), (i, t, L) => { BG[i] = C(RED, 8); return set(i, ' ', 0), true; });
  }
  drawBox(boxAt(vx + 2.11, vy, 1, 0, .03, .32, 1.32, 1.45), SPARSE_FILL(GRAY, 1.3)); // the front bumper
  drawBox(boxAt(vx - 2.11, vy, 1, 0, .03, .5, 1.3, 1.4), (i, t, L) => { BG[i] = C(YEL, 8); return set(i, ' ', 0), true; }); // the number plate
  rod(vx - 1.6, vy + .3, 1.18, vx - 2.3, vy + .3, 1.12, .035, GRAY, 1.2); // the exhaust
} });
const SPARSE_GARAGE_PROPS = ROOM_DEFS.garage.props;
ROOM_DEFS.garage.props = r => [...SPARSE_GARAGE_PROPS(r), ...sparseExtra([
  SPARSE_LIFT_GEAR(6.5, 4), SPARSE_FLAT(6.7, 4.2, .9, .55, (i, t, L) => { BG[i] = C(GRAY, .55 + hash(Math.floor(HIT.u * 6), Math.floor(HIT.v * 6), 512) * .25); return set(i, ' ', 0), true; }), // oil under the lift
  SPARSE_TOOL_CHEST(11.9, 8.5, 0, -1), SPARSE_TOOL_CHEST(1.6, 4.6, 1, 0, BLUE),
  SPARSE_DRUM(12.4, 5.2, BLUE), SPARSE_DRUM(12.4, 5.85, RED), SPARSE_DRUM(11.75, 5.5, BLUE),
  SPARSE_JACK(9.9, 6.1), ROOM_MODEL(11.1, 2.3, (vx, vy) => { for (let k = 0; k < 3; k++) sparseTyre(vx, vy - .25 + k * .25, .32, .3, 0, 1, .1); }, [.32, .4, .62]), // tyres waiting, stood on edge
  ...shellChair(3.2, 8.4, 0, -1, GRAY), { ...sitting(3.2, 8.4, BLUE, .47), face: [0, -1] }, { ...standing(4.9, 3.6, ORANGE), face: [1, 0] }, // the customer; a mechanic under the car
])];

// ---- the tyre shop: a wall rack of tyres on edge, rims on show, the compressor, a tyre on a stand by the door
const SPARSE_TYRE_RACK = (x, y, hl, c, s) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  const P = (u, v, z) => [vx + c * u - s * v, vy + s * u + c * v, z];
  for (const u of [-hl, hl]) for (const v of [-.25, .25]) rod(...P(u, v, 0), ...P(u, v, 2.1), .025, BLUE, 1.2);
  for (const z of [.05, .8, 1.5]) for (const v of [-.25, .25]) rod(...P(-hl, v, z), ...P(hl, v, z), .02, ORANGE, 1.3);
  for (const [k, z] of [.05, .8, 1.5].entries()) for (let j = 0; j < Math.floor(hl * 2 / .26); j++) {
    if (hash(j, k, 77) < .15) continue;
    const r = .28 + hash(j, k, 78) * .05, [tx, ty] = P(-hl + .14 + j * .26, 0, 0);
    sparseTyre(tx, ty, z + r + .01, r, c, s, .1);
  }
}), box: boxAt(x, y, c, s, hl, .3, 0, 2.1), radius: hl + .3, tyreRack: true });
// alloy rims on the wall: shiny, five spokes
function sparseRimWall(i, u, z, d, cu, cz) {
  const du = u - cu, dz = z - cz, r = Math.hypot(du, dz);
  if (r > .3) return false;
  const a = Math.atan2(dz, du), spoke = Math.abs(fract(a / TAU * 5 + .1) - .5) < .12;
  BG[i] = r > .25 ? C(GRAY, 1) : r < .06 ? C(GRAY, 5) : spoke ? C(GRAY, 4.2 + Math.cos(a) * .6) : C(GRAY, .5); return set(i, ' ', 0), true;
}
const SPARSE_COMPRESSOR = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawRod(vx - .45, vy, .32, vx + .45, vy, .32, .24, (i, t, L) => { BG[i] = C(RED, 2.2 + L * .4); return set(i, ' ', 0), true; });
  for (const e of [-1, 1]) drawBox(boxAt(vx + e * .3, vy, 1, 0, .04, .14, 0, .1), SPARSE_FILL(GRAY, .5));
  drawBox(boxAt(vx + .05, vy, 1, 0, .2, .14, .56, .78), SPARSE_FILL(GRAY, 1.2)); // the motor
  dot(vx - .25, vy - .2, .62, .05, (i, t, L) => { BG[i] = C(WHITE, 8); return set(i, '+', C(GRAY, 1)), true; }); // the gauge
  rod(vx - .4, vy - .1, .5, vx - .55, vy - .3, 1.4, .012, YEL, 1.2); // the coiled line, up to its hook
}, [.5, .25, .8]);
const SPARSE_TYRE_STAND = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .25, .2, 0, .05), SPARSE_FILL(GRAY, .8));
  rod(vx, vy, .05, vx, vy, .4, .02, GRAY, 1.3);
  sparseTyre(vx, vy, .72, .33, 0, 1, .11);
  drawBox(boxAt(vx, vy + .2, 1, 0, .2, .01, .08, .3), (i, t, L) => { BG[i] = C(YEL, 10); return wallTextFlat(i, HIT.u, HIT.w - .19, '$89', .36) || set(i, ' ', 0), true; });
}, [.3, .25, 1.05]);
function wallTextFlat(i, u, w, text, width) { // a few letters across a small face, centred, no filtering
  const n = text.length, q = (u / width + .5) * n;
  if (q < 0 || q >= n || Math.abs(w) > .05) return false;
  return set(i, text[Math.floor(q)], C(GRAY, 1)), true;
}
const SPARSE_TYRE_PROPS = ROOM_DEFS.tireshop.props, SPARSE_TYRE_WALL = ROOM_DEFS.tireshop.wall;
ROOM_DEFS.tireshop.wall = (i, u, uStep, z, d, mx, my, L) => {
  if (mx === room.W - 1 && z > 1.1 && z < 2.3) for (const [cu, cz] of [[5.2, 1.85], [5.9, 1.85], [6.6, 1.85]]) if (sparseRimWall(i, u, z, d, cu, cz)) return true;
  return SPARSE_TYRE_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.tireshop.props = r => [...SPARSE_TYRE_PROPS(r), ...sparseExtra([
  SPARSE_TYRE_RACK(10.65, 2.9, 1.5, 0, 1), SPARSE_COMPRESSOR(4.8, 1.45), SPARSE_TYRE_STAND(4.3, 6.2),
  ROOM_MODEL(6.4, 2.6, (vx, vy) => drum(vx, vy, .3, .86, 1.06, (i, t, L) => { const r = Math.hypot(HIT.u, HIT.v); BG[i] = HIT.face === 5 ? C(GRAY, r < .17 ? 3.2 : .6 + L * .1) : C(GRAY, .6 + L * .15); return set(i, ' ', 0), true; })), // the tyre on the changer, lying flat
  { ...standing(6.4, 3.3, BLUE), face: [0, -1] }, { ...standing(8.6, 7.1, shirt()), face: [1, 0] },
])];

// ---- the welder's: the welding set by the bench with its leads, a screen to keep the flash in, the scrap bin, a gate
// finished by the door, masks on the wall, the extinguisher
const SPARSE_WELDER_SET = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .3, .22, .15, .75), (i, t, L) => { BG[i] = C(BLUE, (1.6 + L * .3) * shadeFace(HIT.face)); set(i, ' ', 0); if (HIT.face === 4 && HIT.w > .55 && HIT.w < .68 && Math.abs(HIT.u) < .2) { BG[i] = C(GRAY, 1); if (Math.abs(HIT.u + .1) < .04) BG[i] = C(ORANGE, 9 + Math.sin(T * 9) * 2); } return true; });
  for (const e of [-1, 1]) drum(vx + e * .22, vy, .07, 0, .15, SPARSE_FILL(GRAY, .4));
  rod(vx - .1, vy - .23, .4, vx - .8, vy - .3, .05, .015, RED, 1.1); rod(vx - .8, vy - .3, .05, vx - 1.2, vy - .1, .85, .015, RED, 1.1); // the lead, up to the bench
  rod(vx + .1, vy - .23, .4, vx + .3, vy - .6, .02, .015, GRAY, .8); // the earth clamp
}, [.32, .24, .78]);
const SPARSE_SCREEN = (x, y, hl, c, s) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, c, s, hl, .01, .15, 1.8), (i, t, L) => { BG[i] = C(ORANGE, 1.4 + L * .2 + (fract(HIT.u * 2.5) < .05 ? -.5 : 0)); return set(i, ' ', 0), true; });
  for (const e of [-1, 1]) rod(vx + c * e * hl, vy + s * e * hl, 0, vx + c * e * hl, vy + s * e * hl, 1.85, .02, GRAY, 1.3);
  rod(vx - c * hl, vy - s * hl, 1.85, vx + c * hl, vy + s * hl, 1.85, .02, GRAY, 1.3);
}), box: boxAt(x, y, c, s, hl, .05, 0, 1.85), radius: hl + .1 });
const SPARSE_SCRAP = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .4, .3, 0, .6), SPARSE_FILL(GRAY, .9));
  for (let k = 0; k < 6; k++) { const a = hash(k, 1, 931) * TAU; rod(vx + Math.cos(a) * .2, vy + Math.sin(a) * .15, .3, vx + Math.cos(a) * .45, vy + Math.sin(a) * .3, .8 + hash(k, 2, 931) * .5, .015, k & 1 ? BRICK : GRAY, 1.1); }
}, [.42, .32, .6]);
const SPARSE_EXTINGUISHER = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drum(vx, vy, .08, .02, .55, (i, t, L) => { BG[i] = C(RED, (2.6 + L * .35) * drumLit(.08)); return set(i, Math.abs(HIT.w - .35) < .05 ? '=' : ' ', C(WHITE, 8)), true; });
  drum(vx, vy, .03, .55, .63, SPARSE_FILL(GRAY, 1.3)); rod(vx, vy, .6, vx + .08, vy, .3, .01, GRAY, .5);
}, [.1, .1, .63]);
const SPARSE_WELD_PROPS = ROOM_DEFS.welding.props, SPARSE_WELD_WALL = ROOM_DEFS.welding.wall;
ROOM_DEFS.welding.wall = (i, u, uStep, z, d, mx, my, L) => {
  if (mx === 0) { // the masks on their pegs on the left wall
    const v = -u;
    for (const cu of [3.4, 4.0, 4.6]) { const du = v - cu, dz = z - 1.75; if (Math.abs(du) < .16 && dz > -.2 && dz < .18) { const glass = Math.abs(du) < .1 && Math.abs(dz - .02) < .04; BG[i] = glass ? C(GREEN, .8) : C(GRAY, .9 + L * .15 - Math.abs(du) * 2); return set(i, ' ', 0), true; } }
  }
  return SPARSE_WELD_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.welding.props = r => [...SPARSE_WELD_PROPS(r), ...sparseExtra([
  SPARSE_WELDER_SET(6.1, 2.7), SPARSE_SCREEN(5.25, 2.5, .6, 0, 1), SPARSE_SCRAP(10.6, 7.6), SPARSE_EXTINGUISHER(1.3, 7.6),
  GATE_FRAME(10.985, 6.6, .55, 1.3, 0, 1),
  SPARSE_FLAT(4.1, 3.4, .5, .4, (i, t, L) => { const r = Math.hypot(HIT.u / .5, HIT.v / .4); BG[i] = C(GRAY, .5 + r * .6); return set(i, hash(Math.floor(HIT.u * 30), Math.floor(HIT.v * 30), 3) > .93 ? '.' : ' ', C(ORANGE, 3)), true; }), // scorch and spatter
])];

// ---- the courier office: bikes against the wall, a cage of parcels, the shelving, pigeonholes on the back wall,
// a rider waiting on a job
const SPARSE_BIKE = (x, y, col) => ROOM_MODEL(x, y, (vx, vy) => { // stood along y, leaning on a wall to its left
  const W0 = [vx, vy - .5, .33], W1 = [vx, vy + .5, .33], crank = [vx, vy, .3], seat = [vx, vy - .2, .85], head = [vx, vy + .38, .9];
  sparseRing(...W0, .32, 1, 0, .02, GRAY, .8); sparseRing(...W1, .32, 1, 0, .02, GRAY, .8);
  for (const [a, b] of [[W0, crank], [crank, seat], [seat, W0], [crank, head], [seat, head], [head, W1]]) rod(...a, ...b, .018, col, 1.4);
  rod(vx - .22, vy + .42, .98, vx + .22, vy + .42, .98, .015, GRAY, 1); // the bars
  drawBox(boxAt(vx, vy - .22, 0, 1, .1, .04, .85, .9), SPARSE_FILL(GRAY, .5)); // the saddle
  drawBox(boxAt(vx, vy + .62, 0, 1, .15, .13, .55, .78), SPARSE_FILL(ORANGE)); // a front rack and its bag
}, [.12, .62, 1]);
const SPARSE_PARCEL_SHELF = (x, y, hl, c, s) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  const P = (u, v) => [vx + c * u - s * v, vy + s * u + c * v];
  for (const u of [-hl, hl]) for (const v of [-.25, .25]) rod(...P(u, v), 0, ...P(u, v), 1.9, .02, GRAY, 1.4);
  for (const z of [.1, .7, 1.3]) {
    drawBox(boxAt(...P(0, 0), c, s, hl, .28, z - .03, z), SPARSE_FILL(GRAY, 1.1));
    let u = -hl + .05;
    for (let k = 0; u < hl - .2; k++) {
      const w = .18 + hash(k, z * 10, 611) * .2, h = .15 + hash(k, z * 10, 612) * .3, [bx, by] = P(u + w, (hash(k, z, 613) - .5) * .1);
      if (hash(k, z * 10, 614) > .12) drawBox(boxAt(bx, by, c, s, w * .95, .2, z, z + h), (i, t, L) => { BG[i] = C(BRICK, (2.6 + L * .25) * shadeFace(HIT.face) + (HIT.face === 5 ? .5 : 0)); return set(i, Math.abs(HIT.u) < .015 && HIT.face === 5 ? '|' : ' ', C(YEL, 4)), true; });
      u += w * 2 + .04;
    }
  }
}), box: boxAt(x, y, c, s, hl, .3, 0, 1.9), radius: hl + .3, parcelShelf: true });
const SPARSE_CAGE = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .45, .35, .1, 1.5), (i, t, L) => { const f = HIT.face, a = f <= 2 ? HIT.v : HIT.u; if (f !== 6 && f !== 5 && Math.abs(fract(a * 4) - .5) < .45 && Math.abs(fract(HIT.w * 4) - .5) < .45) return false; BG[i] = C(GRAY, 2.4 + L * .3); return set(i, ' ', 0), true; });
  for (const [u, v, h] of [[-.2, -.15, .45], [.18, -.1, .3], [-.15, .15, .35], [.2, .17, .5]]) drawBox(boxAt(vx + u, vy + v, 1, 0, .16, .14, .12, .12 + h), SPARSE_FILL(BRICK, 1.2));
  for (const e of [-1, 1]) for (const g of [-1, 1]) drum(vx + e * .38, vy + g * .28, .045, 0, .1, SPARSE_FILL(GRAY, .4));
}, [.47, .37, 1.5]);
const SPARSE_COURIER_PROPS = ROOM_DEFS.courier.props, SPARSE_COURIER_WALL = ROOM_DEFS.courier.wall;
ROOM_DEFS.courier.wall = (i, u, uStep, z, d, mx, my, L) => {
  if (my === 0 && u > 6.2 && u < 8.9 && z > 1.0 && z < 2.1) { // the pigeonholes, one per regular
    const cu = (u - 6.2) / .3, cz = (z - 1.0) / .22, eu = fract(cu), ez = fract(cz), k = hash(Math.floor(cu), Math.floor(cz), 615);
    if (eu < .08 || ez < .1 || u > 8.84 || z > 2.06) { BG[i] = C(BRICK, 2.6 + L * .2); return set(i, ' ', 0), true; }
    BG[i] = k > .55 && ez < .75 ? C(WHITE, 6 + k * 3) : C(BRICK, .7); return set(i, ' ', 0), true;
  }
  return SPARSE_COURIER_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.courier.props = r => [...SPARSE_COURIER_PROPS(r), ...sparseExtra([
  SPARSE_BIKE(1.25, 2.6, RED), SPARSE_BIKE(1.25, 4.0, CYAN), SPARSE_PARCEL_SHELF(12.65, 6.6, 1.6, 0, 1), SPARSE_CAGE(5.4, 6.3),
  { ...standing(6.2, 4.6, YEL), face: [1, -.4] }, { ...standing(9.6, 4.8, shirt()), face: [0, -1] }, // a rider waiting, a customer at the counter
])];

// ---- the gym: two bench-press stations, kettlebells in front of the mirror, mats for stretching
const SPARSE_BENCH_PRESS = (x, y) => ({ ...ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy + .15, 0, 1, .6, .15, .38, .48), SPARSE_FILL(GRAY, .6)); // the pad
  for (const e of [-1, 1]) drawBox(boxAt(vx, vy + .15 + e * .45, 1, 0, .1, .04, 0, .38), SPARSE_FILL(GRAY, 1.2));
  for (const e of [-1, 1]) rod(vx + e * .32, vy - .5, 0, vx + e * .32, vy - .5, 1.15, .025, GRAY, 1.5); // the uprights
  rod(vx - 1.05, vy - .5, 1.05, vx + 1.05, vy - .5, 1.05, .016, GRAY, 2); // the bar, racked
  for (const e of [-1, 1]) for (const k of [0, 1]) drawRod(vx + e * (.78 + k * .07), vy - .5, 1.05, vx + e * (.82 + k * .07), vy - .5, 1.05, .24 - k * .06, (i, t, L) => { BG[i] = C(k ? RED : GRAY, k ? 2 + L * .3 : .7 + L * .15); return set(i, ' ', 0), true; });
}), box: boxAt(x, y, 1, 0, .45, .7, 0, 1.15), radius: 1.1, benchPress: true });
const SPARSE_KETTLEBELLS = (x, y, n) => ROOM_MODEL(x, y, (vx, vy) => {
  for (let k = 0; k < n; k++) { const r = .08 + k * .012, cy = vy - (n - 1) * .2 + k * .4;
    dot(vx, cy, r, r, (i, t, L) => { BG[i] = C(GRAY, .6 + L * .2); return set(i, ' ', 0), true; });
    sparseRing(vx, cy, r * 2 + .03, .05 + k * .005, 1, 0, .012, GRAY, .7, 8);
  }
}, [.15, n * .2, .3]);
const SPARSE_GYM_PROPS = ROOM_DEFS.gym.props;
ROOM_DEFS.gym.props = r => [...SPARSE_GYM_PROPS(r), ...sparseExtra([
  SPARSE_BENCH_PRESS(6.0, 6.4), SPARSE_BENCH_PRESS(8.4, 6.4), SPARSE_KETTLEBELLS(1.35, 4.6, 4),
  SPARSE_FLAT(6.6, 9.1, .9, .45, (i, t, L) => { BG[i] = C(BLUE, 1.1 + L * .1 - (Math.abs(HIT.u) > .86 ? .4 : 0)); return set(i, ' ', 0), true; }),
  { ...standing(6.0, 7.3, RED), face: [0, -1] }, { ...standing(6.6, 9.1, GREEN), face: [1, 0] }, // a spotter, someone on the mat
])];
