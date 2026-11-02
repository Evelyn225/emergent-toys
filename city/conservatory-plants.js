// The conservatory's planting, built like the animals (figures.js): parts cast
// into a cached sprite from the side you see, painted as solid colour, so a palm
// reads as clearly as a person at any distance. Each body is built `tall` units
// high and drawn at its height in metres. Roles: BODY trunks and stems, WING
// leaves, MARK flowers and fruit, LEG soil and rock.
const PLANT_UNITS = { palm: 30, fern: 13, banana: 30, saguaro: 30, barrel: 22, agave: 14, rock: 14 };
const pv = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const pnorm = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const pcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a leaf blade: an ellipsoid from `from` along dir (len long, wid wide, thin), flat to the side
function plantBlade(from, dir, len, wid, thin, role) {
  const d = pnorm(dir), side = pnorm(Math.abs(d[2]) > .95 ? [1, 0, 0] : pcross(d, [0, 0, 1])), n = pcross(side, d);
  return figEll(pv(from, d, len), [d, side, n], [len, wid, thin], role);
}
// a frond that rises then droops: two blades end to end
function plantFrond(from, ang, rise, len, wid, droop, role) {
  const out = [Math.cos(ang), Math.sin(ang), 0], d1 = pnorm([out[0], out[1], rise]), mid = pv(from, d1, len);
  const d2 = pnorm([out[0], out[1], rise - droop]);
  return [plantBlade(from, d1, len / 2, wid, .25, role), plantBlade(mid, d2, len * .45, wid * .8, .22, role)];
}
const PLANT_BODIES = {
  palm: f => { // a slim trunk leaning a little, in four tapering pieces, with a crown of nine arching fronds
    const R = AR, lean = f === 1 ? -1 : 1, trunk = [[0, 0, 0], [.3 * lean, 0, 8], [.8 * lean, 0, 16], [1.4 * lean, 0, 24]], parts = [];
    for (let k = 1; k < trunk.length; k++) parts.push(figCap(trunk[k - 1], trunk[k], .78 - k * .1, () => R.BODY));
    const top = trunk[3];
    parts.push(figEll(pv(top, [0, 0, 1], .3), AN_I, [.8, .8, .8], () => R.MARK)); // the crownshaft's coconuts
    for (let k = 0; k < 9; k++) parts.push(...plantFrond(pv(top, [0, 0, 1], 1), k / 9 * Math.PI * 2 + f, k % 3 === 0 ? .8 : .35, 9.5 + (k % 2) * 1.6, 1.6, 1.9, () => R.WING));
    return { parts, decals: [] };
  },
  fern: f => { // a low rosette of fine fronds arching out from a crown
    const R = AR, parts = [figEll([0, 0, 1], AN_I, [1.4, 1.4, 1], () => R.LEG)];
    for (let k = 0; k < 9; k++) parts.push(...plantFrond([0, 0, 1.6], k / 9 * Math.PI * 2 + f * .4, 1.3 - (k % 3) * .2, 4.2 + (k % 2), 1.1, 2.4, () => R.WING));
    return { parts, decals: [] };
  },
  banana: f => { // a pseudostem, broad leaves held up and out, a bunch of yellow fruit hanging under them
    const R = AR, parts = [figCap([0, 0, 0], [0, 0, 18], 1.7, () => R.BODY)];
    for (let k = 0; k < 6; k++) {
      const ang = k / 6 * Math.PI * 2 + f, out = [Math.cos(ang), Math.sin(ang), 0];
      parts.push(figCap(pv([0, 0, 17], out, .5), pv([0, 0, 20.5], out, 2.5), .45, () => R.BODY), plantBlade(pv([0, 0, 20.5], out, 2.5), pnorm([out[0], out[1], k & 1 ? 1.2 : .55]), 6.8, 3, .3, () => R.WING));
    }
    for (let k = 0; k < 5; k++) parts.push(figEll([2.1 + (k & 1) * .6, .3 * k - .6, 13.5 - k * 1.1], AN_I, [.55, .55, 1], () => R.MARK));
    return { parts, decals: [] };
  },
  saguaro: f => { // a ribbed column with two arms that turn up, and a flower on top
    const R = AR, s = f === 1 ? -1 : 1, parts = [figCap([0, 0, 0], [0, 0, 27.5], 2.4, () => R.BODY)];
    parts.push(figCap([2 * s, 0, 11], [5.2 * s, 0, 11.5], 1.5, () => R.BODY), figCap([5.2 * s, 0, 11.5], [5.4 * s, 0, 19], 1.5, () => R.BODY));
    parts.push(figCap([-2 * s, 0, 15.5], [-4.4 * s, 0, 16], 1.3, () => R.BODY), figCap([-4.4 * s, 0, 16], [-4.6 * s, 0, 21.5], 1.3, () => R.BODY));
    parts.push(figEll([0, 0, 29.5], AN_I, [1.1, 1.1, .7], () => R.MARK));
    return { parts, decals: [] };
  },
  barrel: () => { // a squat ribbed globe crowned with magenta flowers
    const R = AR, parts = [figEll([0, 0, 8.5], AN_I, [9, 9, 8.5], () => R.BODY)];
    for (let k = 0; k < 5; k++) { const ang = k / 5 * Math.PI * 2; parts.push(figEll([Math.cos(ang) * 2.2, Math.sin(ang) * 2.2, 17], AN_I, [1.4, 1.4, 1.1], () => R.MARK)); }
    return { parts, decals: [] };
  },
  agave: f => { // a rosette of stiff pointed leaves, the outer ones lower
    const R = AR, parts = [];
    for (let k = 0; k < 12; k++) {
      const ang = k / 12 * Math.PI * 2 + f * .3 + (k & 1) * .26, out = [Math.cos(ang), Math.sin(ang), 0], rise = k & 1 ? 1.9 : .9;
      parts.push(plantBlade([0, 0, 1], pnorm([out[0], out[1], rise]), 6.2 - (k & 1) * .8, 1.3, .55, () => R.WING));
    }
    return { parts, decals: [] };
  },
  rock: f => { // a weathered boulder: two overlapping lumps
    const R = AR, parts = [figEll([0, 0, 3.6], AN_I, [13, 9, 4.2], () => R.LEG), figEll([4 - f * 8, 1.5, 4.6], AN_I, [6.5, 5.5, 3.6], () => R.LEG)];
    return { parts, decals: [] };
  },
};
Object.assign(ANIMAL_BODIES, Object.fromEntries(Object.entries(PLANT_BODIES).map(([k, v]) => ['plant_' + k, v])));
const PLANT_LOOKS = {
  palm: animalLook('plant_palm', { body: [BRICK, 7], wing: [GREEN, 9], mark: [BRICK, 4], leg: [GREEN, 5] }),
  fern: animalLook('plant_fern', { body: [GREEN, 7], wing: [GREEN, 10], leg: [BRICK, 4] }),
  banana: animalLook('plant_banana', { body: [GREEN, 7], wing: [GREEN, 11], mark: [YEL, 12] }),
  saguaro: animalLook('plant_saguaro', { body: [GREEN, 8], mark: [WHITE, 13] }),
  barrel: animalLook('plant_barrel', { body: [GREEN, 9], mark: [MAG, 13] }),
  agave: animalLook('plant_agave', { wing: [CYAN, 8] }),
  rock: animalLook('plant_rock', { leg: [BRICK, 6] }),
};
// A plant at (x, y), heightM tall, turned by its seed; trunks and boulders block, leafy plants don't.
function CONS_PLANT(kind, x, y, heightM, seed, foot) {
  const ang = hash(seed, 3, 886) * Math.PI * 2, fx = Math.cos(ang), fy = Math.sin(ang), frame = seed & 1;
  const h = heightM * FIG_TALL / PLANT_UNITS[kind], look = PLANT_LOOKS[kind];
  const o = ROOM_MODEL(x, y, (vx, vy) => drawAnimal(vx, vy, 0, h, fx, fy, look, frame), foot);
  return { ...o, radius: heightM, consPlant: { kind, heightM, unit: h / FIG_TALL } };
}
