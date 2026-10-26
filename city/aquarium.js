// ===== the aquarium, across the shore road from the Sunset Pier (world.js gives it its lot). Inside: the open
// ocean window across the back of the main hall, a walk-through tunnel with sharks and rays going over your head,
// a dark gallery of jellyfish, a bright one of reef tanks and a kelp forest, seahorses by the door, a touch pool
// and a gift shop. Outside: the ground floor is one long tank behind glass, fish swimming past the windows.
//
// Tanks are cells of the room grid, so they're solid and the raycaster draws their glass like any wall. A run of the
// same tank letter is one tank: the fish in it swim its whole length, and you see them through either side.
const AQUA_FEE = 8;
AQUARIUM.sh.fee = AQUA_FEE;
// O open ocean, R coral reef, J jellyfish, K kelp forest, H seahorses
const AQUA_GRID = [
  '########################',
  '#OOOOOOOOOOOOOOOOOOOOOO#',
  '#......................#',
  '#......................#',
  '#...JJ...O....O...KK...#',
  '#J.......O....O.......R#',
  '#J..JJ...O....O...RR..R#',
  '#J.......O....O.......R#',
  '#J..JJ...O....O...KK..R#',
  '#J.......O....O.......R#',
  '#J..JJ...O....O...RR..R#',
  '#........O....O........#',
  '#H....................R#',
  '#H.....................#',
  '#......................#',
  '###########DD###########'];
const AQUA_TUNNEL = { x0: 10, x1: 14, y0: 4, y1: 12 }; // the corridor between the two ocean walls: water overhead
const TOUCH_POOL = { x: 5.5, y: 13.2, hl: 1.1, hw: 0.6 };
// how each kind of tank looks: glass from base to top (m), water colour, and its name plate
const TANKS = {
  O: { name: 'OPEN OCEAN', base: 0.2, top: 2.8, water: BLUE, bright: 1 },
  R: { name: 'CORAL REEF', base: 0.5, top: 2.4, water: CYAN, bright: 1.2 },
  J: { name: 'JELLYFISH', base: 0.5, top: 2.4, water: BLUE, bright: 0.6 },
  K: { name: 'KELP FOREST', base: 0.4, top: 2.5, water: GREEN, bright: 0.9 },
  H: { name: 'SEAHORSES', base: 0.7, top: 2.2, water: CYAN, bright: 1.1 },
};
// ---- the fish: each species a side profile, painted in solid colour the way the animals are. In a fish's own frame
// x runs 0 (tail) to 1 (snout) as it faces right, y from -0.5 (belly) to 0.5 (back), in its length and height. A
// shape returns [colour, brightness] (1 = as lit), or null where the fish isn't. Darker over the back and paler
// underneath, as real fish are; the fins, eye and markings are each species' own.
// (t: seconds, for a tail beat or a pulse; k: which one, for colour)
const fishHalf = (x, x0, A) => x < x0 || x > 1 ? 0 : A * Math.pow(Math.sin(Math.PI * Math.pow((x - x0) / (1 - x0), 0.72)), 0.6); // (its half height there)
const fishBody = (x, y, x0, A) => { // a body tapering from the tail joint x0 to the snout: where y is across it (-1 belly .. 1 back), or -1 outside
  const hb = fishHalf(x, x0, A);
  return hb > 1e-4 && Math.abs(y) < hb ? Math.abs(y) / hb * Math.sign(y || 1) : -1;
};
const fishShade = n => n > 0 ? 1.05 - n * 0.35 : 1.15 + n * 0.1; // (countershaded: dark back, pale belly; n -1 belly .. 1 back)
const fishTail = (x, y, x0, spread, beat) => { // a forked tail behind the joint, flicking
  if (x >= x0 || x < 0) return false;
  const s = (x0 - x) / x0, yy = y - beat * s * 0.12;
  return Math.abs(yy) < 0.04 + s * spread && !(s > 0.55 && Math.abs(yy) < (s - 0.55) * spread * 1.4);
};
const fishEye = (x, y, ex, ey, r) => Math.hypot((x - ex) * 2.4, y - ey) < r;
function standardFish(x, y, t, body, belly, { x0 = 0.24, A = 0.42, spread = 0.36, fin = body, eye = 0.84, mark } = {}) {
  if (fishTail(x, y, x0, spread, Math.sin(t * 7))) return [fin, 0.85];
  const n = fishBody(x, y, x0, A);
  if (n === -1) { // outside the body: only the dorsal fin, a low triangle along the back amidships
    const back = fishHalf(x, x0, A);
    return x > 0.42 && x < 0.66 && y > 0 && y < back + 0.13 * (0.66 - x) / 0.24 ? [fin, 0.8] : null;
  }
  if (fishEye(x, y, eye, 0.08, 0.07)) return [GRAY, 0.15];
  if (mark) { const m = mark(x, y, n); if (m) return m; }
  return [n < -0.35 ? belly : body, fishShade(n)];
}
const FISH = {
  tiny: { len: 0.12, h: 0.05, shape: (x, y, t, k) => standardFish(x, y, t, [YEL, CYAN, ORANGE, WHITE][k & 3], WHITE, { A: 0.4 }) },
  sardine: { len: 0.14, h: 0.04, shape: (x, y, t) => standardFish(x, y, t, BLUE, WHITE, { A: 0.34, spread: 0.3, fin: GRAY,
    mark: (x, y, n) => n > -0.35 && n < 0.35 ? [WHITE, 1.25 - (x > 0.4 && x < 0.8 && Math.abs(n) < 0.1 && fract(x * 18) < 0.3 ? 0.7 : 0)] : null }) }, // (a silver flank, a row of dark spots)
  fish: { len: 0.32, h: 0.07, shape: (x, y, t, k) => standardFish(x, y, t, [ORANGE, YEL, GRAY, BRICK][k & 3], [YEL, WHITE, WHITE, YEL][k & 3]) },
  clown: { len: 0.2, h: 0.06, shape: (x, y, t) => standardFish(x, y, t, ORANGE, ORANGE, { A: 0.44, spread: 0.32, x0: 0.22,
    mark: x => { for (const bx of [0.34, 0.58, 0.82]) { const d = Math.abs(x - bx); if (d < 0.045) return [WHITE, 1.3]; if (d < 0.065) return [GRAY, 0.2]; } return null; } }) }, // (three white bands, edged black)
  tang: { len: 0.24, h: 0.08, shape: (x, y, t) => x < 0.3 && fishTail(x, y, 0.26, 0.42, Math.sin(t * 7)) ? [YEL, 1.2] : standardFish(x, y, t, BLUE, BLUE, { A: 0.48, x0: 0.26, spread: 0.42, fin: BLUE,
    mark: (x, y, n) => n > 0.1 && x > 0.35 && x < 0.75 && Math.abs(y - 0.12 - (x - 0.35) * 0.15) < 0.07 ? [GRAY, 0.2] : null }) }, // (a yellow tail, the dark palette mark)
  angel: { len: 0.24, h: 0.24, shape: (x, y, t, k) => { // a tall disc, fins streaming up and down behind, vertical stripes
    const body = k & 1 ? YEL : GRAY, n = fishBody(x, y, 0.3, 0.32);
    if (n !== -1) { if (fishEye(x, y, 0.82, 0.06, 0.06)) return [GRAY, 0.15]; return [Math.abs(fract(x * 5) - 0.5) < 0.12 ? GRAY : body, Math.abs(fract(x * 5) - 0.5) < 0.12 ? 0.35 : fishShade(n)]; }
    const fin = (x > 0.12 && x < 0.62) && (Math.abs(y) < 0.5 - (0.62 - x) * 0.25) && Math.abs(y) > 0.28 - (0.62 - x) * 0.5;
    return fin || fishTail(x, y, 0.3, 0.2, Math.sin(t * 5)) ? [body, 0.75] : null;
  } },
  octopus: { len: 0.36, h: 0.26, shape: (x, y, t) => { // the mantle up top, eyes on its side, arms curling under it
    if (Math.hypot((x - 0.6) / 0.28, (y - 0.18) / 0.3) < 1) return fishEye(x, y, 0.7, 0.08, 0.05) ? [YEL, 0.9] : [RED, fishShade((y - 0.18) / 0.3)];
    for (let a = 0; a < 4; a++) {
      const ax = 0.3 + a * 0.13 + 0.05 * Math.sin(t * 1.5 + a + y * 9), top = 0.02;
      if (y < top && y > -0.5 && Math.abs(x - ax - 0.06 * Math.sin(y * 12 + t * 2 + a)) < 0.035 * (1 + y)) return [RED, fract(y * 18) < 0.3 ? 1.3 : 0.9]; // (suckers)
    }
    return null;
  } },
  shark: { len: 1.9, h: 0.45, shape: (x, y, t) => { // a torpedo, the tall dorsal, the long upper lobe of the tail, gill slits
    const beat = Math.sin(t * 2.5);
    if (x < 0.2) { const s = (0.2 - x) / 0.2, yy = y - beat * s * 0.08; if (yy > -0.05 && yy < 0.06 + s * 0.42 && yy < 0.06 + s * 0.42 && (yy > s * 0.3 - 0.05 || s < 0.5) || yy < 0 && yy > -0.06 - s * 0.2 && s < 0.6) return [GRAY, 0.75]; return null; }
    if (x > 0.48 && x < 0.66 && y > 0.1 && y < 0.5 - (x - 0.48) * 1.8 + (x - 0.48) * 0.6) return [GRAY, 0.7]; // the dorsal
    if (x > 0.6 && x < 0.72 && y < -0.08 && y > -0.42 + (x - 0.6) * 2) return [GRAY, 0.8]; // a pectoral fin
    const n = fishBody(x, y, 0.2, 0.34);
    if (n === -1) return null;
    if (fishEye(x, y, 0.9, 0.06, 0.035)) return [GRAY, 0.1];
    if (x > 0.75 && x < 0.82 && n > -0.2 && n < 0.45 && fract(x * 70) < 0.25) return [GRAY, 0.4]; // the gill slits
    return [n < -0.25 ? WHITE : GRAY, n < -0.25 ? 1.2 : fishShade(n) * 0.9];
  } },
  ray: { len: 1.3, h: 0.28, shape: (x, y, t) => { // side on: a thin disc, its wing tips rippling, the whip of a tail
    if (x < 0.4) return Math.abs(y + 0.02 - 0.05 * Math.sin(x * 9 + t * 2)) < 0.025 ? [BRICK, 0.7] : null;
    const tt = (x - 0.4) / 0.6, thick = 0.16 * Math.sin(Math.PI * tt), wave = 0.22 * Math.sin(Math.PI * tt) * Math.sin(t * 1.6 + tt * 4);
    if (Math.abs(y - wave * 0.3) < thick) return fishEye(x, y, 0.88, 0.05, 0.04) ? [GRAY, 0.15] : [y < wave * 0.3 - thick * 0.3 ? WHITE : BRICK, y < wave * 0.3 - thick * 0.3 ? 1.1 : 0.9];
    if (Math.abs(y - wave) < 0.05 && tt > 0.15 && tt < 0.85) return [BRICK, 0.8]; // the wing's edge, curling
    return null;
  } },
  turtle: { len: 0.9, h: 0.4, shape: (x, y, t) => { // a domed shell in plates, flippers rowing, a head out front
    const stroke = Math.sin(t * 1.4);
    if (y > -0.1 && Math.hypot((x - 0.5) / 0.32, (y + 0.1) / 0.5) < 1) { const plate = Math.abs(fract(x * 7 + (y > 0.15 ? 0.5 : 0)) - 0.5) < 0.06 || Math.abs(y - 0.15) < 0.025; return [BRICK, plate ? 0.5 : 1.05 - y * 0.6]; }
    if (y <= -0.1 && y > -0.2 && x > 0.2 && x < 0.8) return [YEL, 0.9]; // the pale plastron under it
    if (x > 0.78 && Math.hypot((x - 0.88) / 0.1, (y + 0.08) / 0.14) < 1) return fishEye(x, y, 0.93, -0.03, 0.03) ? [GRAY, 0.1] : [GREEN, 0.95]; // the head
    const fx = 0.68 + 0.08 * stroke; if (Math.abs(y + 0.22 + (x - fx) * 1.4) < 0.06 && x > fx - 0.04 && x < fx + 0.2) return [GREEN, 0.85]; // front flipper
    if (Math.abs(y + 0.18 + (0.3 - x) * 0.6) < 0.04 && x > 0.12 && x < 0.3) return [GREEN, 0.8]; // a hind one
    return null;
  } },
  jelly: { len: 0.34, h: 0.55, shape: (x, y, t, k) => { // a bell, pulsing, and the tentacles trailing under it
    const col = [MAG, CYAN, WHITE, ORANGE][k & 3], pulse = 1 + 0.12 * Math.sin(t * 3 + k);
    if (y > 0.05 && Math.hypot((x - 0.5) / (0.42 * pulse), (y - 0.05) / 0.45) < 1) return [col, 0.7 + (y - 0.05) * 1.1 + (Math.hypot((x - 0.5) / (0.42 * pulse), (y - 0.05) / 0.45) > 0.85 ? 0.4 : 0)]; // (a brighter rim)
    if (y <= 0.05) for (let a = 0; a < 5; a++) { const ax = 0.2 + a * 0.15 + 0.04 * Math.sin(y * 10 - t * 2 + a); if (Math.abs(x - ax) < 0.018 && y > -0.5 + 0.1 * (a & 1)) return [col, 0.55]; }
    return null;
  } },
  seahorse: { len: 0.12, h: 0.3, shape: (x, y, t, k) => { // upright: a curled tail, a belly, a head with its snout out front
    const col = k & 1 ? YEL : ORANGE, cx = 0.5 + 0.18 * Math.sin((y + 0.5) * 5.5) + 0.03 * Math.sin(t), w = 0.14 + 0.12 * Math.max(0, Math.sin((y + 0.35) * 3.2));
    if (y > 0.28 && Math.hypot((x - 0.48) / 0.18, (y - 0.38) / 0.1) < 1) return fishEye(x, y, 0.55, 0.4, 0.05) ? [GRAY, 0.1] : [col, 1];
    if (y > 0.3 && y < 0.42 && x > 0.6 && x < 0.95 && Math.abs(y - 0.36) < 0.035) return [col, 0.85]; // the snout
    if (y < 0.3 && y > -0.5 && Math.abs(x - cx) < w * (y < -0.25 ? 0.5 : 1)) return [col, fract(y * 14) < 0.2 ? 0.7 : 1]; // ridged rings
    return null;
  } },
};
// who lives in each kind of tank, per metre of tank: [species, how many] (at least one of each)
const STOCKING = {
  O: [['shark', 0.12], ['ray', 0.12], ['turtle', 0.06], ['fish', 0.6], ['tiny', 1], ['sardine', 1]],
  R: [['clown', 0.7], ['tang', 0.5], ['angel', 0.4], ['tiny', 0.8], ['octopus', 0.1]],
  J: [['jelly', 1.3]],
  K: [['sardine', 2.5], ['fish', 0.4]],
  H: [['seahorse', 1.6]],
};

// ---- a run of tank: the cells of one letter in a line, along x (side 1, seen from north or south) or along y
function tankRun(mx, my, side, c) {
  const key = `${mx},${my},${side}`;
  const runs = room.runs || (room.runs = new Map());
  let run = runs.get(key);
  if (run) return run;
  let a = side ? mx : my, b = a;
  const at = v => side ? roomAt(v, my) : roomAt(mx, v);
  while (at(a - 1) === c) a--;
  while (at(b + 1) === c) b++;
  const line = side ? my : mx, tk = TANKS[c], len = b + 1 - a;
  run = { u0: a, u1: b + 1, c, fish: [], frame: -1 };
  let n = 0;
  for (const [sp, per] of STOCKING[c]) for (let k = 0; k < Math.max(1, Math.round(per * len)); k++, n++) {
    const h = (j) => hash(a * 13 + line * 7 + side, n, 400 + j), f = FISH[sp];
    const school = sp === 'tiny' || sp === 'sardine' ? Math.floor(k / 5) : -1; // the little ones swim in schools of five
    const hs = school >= 0 ? (j) => hash(a * 13 + line * 7 + side, 1000 + school * 7 + sp.length, 400 + j) : h;
    run.fish.push({ sp, f, k: n, speed: (sp === 'shark' ? 0.35 : sp === 'ray' || sp === 'turtle' ? 0.25 : sp === 'jelly' || sp === 'seahorse' ? 0.04 : 0.3 + hs(1) * 0.4),
      ph: hs(2), zf: hs(3), wob: h(4) * 6.28, off: school >= 0 ? (h(5) - 0.5) * 0.3 : 0, offz: school >= 0 ? (h(6) - 0.5) * 0.2 : 0 });
  }
  for (const s of run.fish) [s.lo, s.hi] = [tk.base + 0.1 + s.f.h / 2, tk.top - 0.1 - s.f.h / 2];
  runs.set(key, run);
  return run;
}
// where everything in a run is this frame
function placeFish(run) {
  if (run.frame === T) return;
  run.frame = T;
  const span = Math.max(0.2, run.u1 - run.u0 - 0.3);
  for (const s of run.fish) {
    if (s.sp === 'jelly') { // drifting up and over, pulsing
      s.u = run.u0 + 0.15 + span * (0.5 + 0.45 * Math.sin(T * 0.07 + s.ph * 6.28));
      s.z = s.lo + (s.hi - s.lo) * (0.5 + 0.5 * Math.sin(T * 0.12 + s.wob)); s.dir = 1;
      continue;
    }
    if (s.sp === 'seahorse') { // bobbing in place, mostly
      s.u = run.u0 + 0.15 + span * (0.15 + 0.7 * s.ph) + 0.03 * Math.sin(T * 0.3 + s.wob);
      s.z = s.lo + (s.hi - s.lo) * s.zf + 0.04 * Math.sin(T * 0.8 + s.wob); s.dir = Math.sin(T * 0.05 + s.wob) > 0 ? 1 : -1;
      continue;
    }
    const p = mod(T * s.speed + s.ph * 2 * span, 2 * span), there = p < span; // up the tank and back
    s.u = run.u0 + 0.15 + (there ? p : 2 * span - p) + s.off; s.dir = there ? 1 : -1;
    s.z = clamp(s.lo + (s.hi - s.lo) * s.zf + s.offz + 0.06 * Math.sin(T * 0.6 + s.wob), s.lo, s.hi);
    if (s.sp === 'turtle' || s.sp === 'ray') s.z = clamp(s.z + 0.15 * Math.sin(T * 0.2 + s.wob), s.lo, s.hi); // gliding up and down
  }
}
// the fish character at (u, z) on a run's glass, or null
// (u along the wall, z up: the shape's in the tank's own coordinates, so either side of the glass sees it the right
// way round. [colour, brightness] or null)
function fishAt(run, u, z) {
  for (const s of run.fish) {
    const f = s.f, q = (u - s.u) / f.len + 0.5, y = (z - s.z) / f.h;
    if (q < 0 || q >= 1 || y < -0.5 || y >= 0.5) continue;
    const hit = f.shape(s.dir > 0 ? q : 1 - q, y, T + s.ph * 9, s.k);
    if (hit) return hit;
  }
  return null;
}

// ---- the glass of a tank
// su is the wall coordinate as the renderer hands it, signed so that it runs left to right on screen (for the name
// plate); u is where along the wall we really are, for everything else; flip = the glass seen from its far side
function tankCell(i, su, uStep, z, d, side, mx, my, L, c, u) {
  const flip = su < 0 !== u < 0 ? -1 : 1;
  const tk = TANKS[c], run = tankRun(mx, my, side, c), Lt = clamp(15 - d * 0.6, 6, 15) * tk.bright, dz = d / projY;
  if (z < tk.base) { BG[i] = C(GRAY, 1); return set(i, z > tk.base - 0.05 ? '=' : fract(u * 2) < 0.06 ? '|' : ' ', C(GRAY, L * 0.7)); } // the cabinet
  if (z > tk.top) { // the hood, with the tank's name on it (the ocean has no room for one: it's labelled on the hall wall)
    BG[i] = C(GRAY, 1);
    if (c !== 'O' && wallText(i, su, uStep, z, d, tk.name, flip * (run.u0 + run.u1) / 2, (tk.top + 3) / 2, 0.16, 0.25, C(WHITE, 14), C(GRAY, 1))) return;
    return set(i, z < tk.top + 0.04 ? '=' : ' ', C(GRAY, L));
  }
  if (u - run.u0 < 0.04 || run.u1 - u < 0.04) { BG[i] = C(GRAY, 1); return set(i, '|', C(GRAY, L)); } // corner posts
  placeFish(run);
  const caustic = noise(u * 2.2 + T * 0.25, z * 3 - T * 0.15, 33);
  BG[i] = C(tk.water, (1 + caustic * 2.2) * tk.bright * (0.6 + 0.4 * Lt / 15));
  const fish = fishAt(run, u, z);
  if (fish) { BG[i] = C(fish[0], clamp(Lt * fish[1] * 0.75, 1, 15)); return set(i, ' ', 0); } // (solid, like the animals)
  for (let b = 0; b < 6; b++) { // bubbles, rising off the bubbler in the corner
    const bz = tk.base + mod(T * 0.45 + b * 0.37, tk.top - tk.base), bu = run.u0 + 0.22 + 0.025 * Math.sin(T * 3 + b);
    if (Math.abs(u - bu) < Math.max(uStep / 2, 0.018) && Math.abs(z - bz) < Math.max(dz / 2, 0.018)) return set(i, 'o', C(WHITE, Lt * 0.8));
  }
  const floor = tk.base + 0.18;
  if (c === 'K' || c === 'O' && hash(Math.floor(u * 3), side ? my : mx, 77) > 0.8) { // kelp, swaying up from the bottom
    const ks = Math.floor(u * 5), sx = (ks + 0.5) / 5 + 0.05 * Math.sin(T * 0.6 + z * 2 + ks), tall = tk.base + (tk.top - tk.base) * (0.55 + 0.45 * hash(ks, 3, 78));
    if (z < tall && Math.abs(u - sx) < Math.max(uStep / 2, 0.025) && hash(ks, 2, 78) > (c === 'K' ? 0.2 : 0.5)) return set(i, Math.sin(T * 0.6 + z * 2 + ks) > 0 ? ')' : '(', C(GREEN, Lt * 0.8));
  }
  if (c === 'R' && z < floor + 0.3) { // coral: branching, fans, brain coral in a riot of colour
    const ck = Math.floor(u * 6), ch = floor + 0.3 * hash(ck, 1, 79);
    if (z < ch) return set(i, 'Y*@%&'[hash(ck, 2, 79) * 5 | 0], C([MAG, ORANGE, YEL, RED, GREEN][hash(ck, 3, 79) * 5 | 0], Lt));
  }
  if (c === 'H' && z < floor + 0.35 && Math.abs(fract(u * 4) - 0.5) < 0.08) return set(i, '|', C(GREEN, Lt * 0.7)); // seagrass for their tails
  if (z < floor) { // sand, and rocks
    const rk = hash(Math.floor(u * 4), 1, 80);
    if (rk > 0.75 && z < tk.base + 0.18 * (rk - 0.6) * 3) return set(i, '#', C(GRAY, Lt * 0.6));
    BG[i] = C(YEL, 1 + Lt * 0.08); return set(i, (Math.floor(u * 30) + Math.floor(z * 30)) % 3 ? '.' : ',', C(WARM, Lt * 0.6));
  }
  if (c === 'J') return set(i, hash(Math.floor(u * 20), Math.floor(z * 20 - T), 81) > 0.97 ? '.' : ' ', C(MAG, 8)); // specks in the dark
  return set(i, z > tk.top - 0.08 && fract(u * 3 - T * 0.2) < 0.4 ? '~' : hash(Math.floor(u * 15), Math.floor(z * 15 + T * 0.5), 82) > 0.985 ? '.' : ' ', C(WHITE, Lt * 0.6)); // the surface, and drifting motes
}
// the plain walls: deep blue, a wave frieze, signs for the galleries and the shop
function aquaWall(i, u, uStep, z, d, mx, my, L) {
  BG[i] = C(BLUE, 1);
  if (Math.abs(z - 2.65) < 0.08) return set(i, fract(u * 2.5 + T * 0.1) < 0.5 ? '~' : '-', C(CYAN, Math.max(L, 9))), true;
  // Interior left/front faces run in negative wall coordinates so lettering
  // reads toward the viewer. The gift label sits above its actual counter.
  const sign = mx === room.W - 1 ? [['CORAL REEF', 7.5]] : mx === 0 ? [['JELLYFISH', -4.6], ['SEAHORSES', -13]] : my === room.H - 1 ? [['THANK YOU FOR VISITING', -6], ['GIFT SHOP', -room.def.keeper[0]]] : [];
  for (const [s, u0] of sign) if (wallText(i, u, uStep, z, d, s, u0, 2.3, 0.2, 0.28, C(WHITE, 14), C(BLUE, 2))) return true;
  if (my === 1 || my === 2 && (mx === 0 || mx === room.W - 1)) // the hall's side walls, by the big window
    if (wallText(i, u, uStep, z, d, 'OPEN OCEAN', mx === 0 ? -2.6 : 2.6, 2.3, 0.2, 0.28, C(WHITE, 14), C(BLUE, 2))) return true;
  return set(i, (Math.floor(u * 3) + Math.floor(z * 3)) % 7 ? ' ' : '.', C(BLUE, L * 0.5)), true;
}
// one of the big ones as you see it from underneath, in solid colour: along 0 its snout .. 1 its tail, across -1 .. 1
// its half width. Pale bellies; the shark's pectoral fins swept back and its tail fin edge on, the ray's diamond and
// whip, the turtle's plastron and flippers. [colour, brightness] or null
function tunnelBelly(kind, along, across, col) {
  const x = Math.abs(across);
  if (kind === 'shark') {
    const w = along < 0.15 ? Math.sqrt(along / 0.15) * 0.9 : along > 0.7 ? Math.max(0.15, (1 - along) / 0.3) : 1;
    if (x < w) return x < w * 0.55 ? [WHITE, 11] : [col, 8];
    if (along > 0.3 && along < 0.46 && x < w + (along - 0.3) * 9 && x > w + (along - 0.36) * 9) return [col, 7]; // the pectoral fins
    return along > 0.86 && x < 0.12 ? [col, 6] : null; // the tail fin, edge on
  }
  if (kind === 'ray') {
    if (along > 0.7) return x < 0.06 ? [col, 6] : null; // the whip of a tail
    const w = Math.max(0, 1 - Math.abs(along - 0.35) * 2.6);
    return x < w ? (x > w * 0.8 ? [col, 7] : [WHITE, 10]) : null;
  }
  if (kind === 'turtle') {
    const w = Math.sin(along * Math.PI) * 0.85;
    if (along < 0.12) return x < 0.3 ? [GREEN, 9] : null; // the head
    if (x < w) return x < w * 0.7 ? [YEL, 9] : [col, 7]; // the plastron, the shell's rim round it
    const flip = along > 0.2 && along < 0.36 ? 1.9 - (along - 0.2) * 6 : along > 0.74 && along < 0.86 ? 1.25 - (along - 0.74) * 3 : 0; // flippers, front and back, tapering behind
    return flip && x < flip ? [GREEN, 8] : null;
  }
  const w = Math.sin(along * Math.PI);
  if (x < w) return [x < w * 0.5 ? WHITE : col, x < w * 0.5 ? 10 : 11];
  return along > 0.9 && x < (along - 0.9) * 6 ? [col, 9] : null; // the tail
}
// overhead: the tunnel's water with the big ones gliding across it, dark everywhere else with a few blue lights
function aquaCeil(i, r, x, wx, wy) {
  const tn = AQUA_TUNNEL;
  if (wx < tn.x0 || wx > tn.x1 || wy < tn.y0 || wy > tn.y1) {
    const on = Math.hypot(fract(wx / 3) - 0.5, fract(wy / 3) - 0.5) < 0.05;
    return set(i, on ? 'o' : ' ', C(CYAN, on ? 12 : 2));
  }
  if (fract(wy / 1.5) < 0.04) return set(i, '=', C(GRAY, 7)); // the tunnel's ribs
  const caustic = noise(wx * 1.5 + T * 0.3, wy * 1.5 - T * 0.2, 34);
  BG[i] = C(BLUE, 1 + caustic * 3);
  // seen from below: [lane x, length, width, speed, colour, kind]
  for (const [lx, len, wd, sp, col, kind] of [[11, 2.2, 0.45, 0.7, GRAY, 'shark'], [12.8, 1.4, 1.1, 0.45, BRICK, 'ray'], [10.6, 0.5, 0.15, 1.1, YEL, 'fish'], [13.3, 0.4, 0.12, -0.9, ORANGE, 'fish'], [12, 1.0, 0.6, -0.3, GREEN, 'turtle']]) {
    const span = tn.y1 - tn.y0 + 6, pos = mod(T * Math.abs(sp) + lx * 3.7, span);
    const head = sp > 0 ? tn.y0 - 3 + pos : tn.y1 + 3 - pos, along = (sp > 0 ? head - wy : wy - head) / len;
    const across = (wx - lx - 0.2 * Math.sin(T * 0.3 + lx)) / (wd / 2);
    if (along < 0 || along > 1) continue;
    const hit = tunnelBelly(kind, along, across, col);
    if (hit) { BG[i] = C(hit[0], hit[1]); return set(i, ' ', 0); }
  }
  // bubbles going up: a little silvery disc in the middle of one 1/6 m square in a hundred and fifty
  const bx = fract(wx * 6) - 0.5, by = fract(wy * 6 + T * 0.3) - 0.5, br = bx * bx + by * by;
  if (br < 0.06 && hash(Math.floor(wx * 6), Math.floor(wy * 6 + T * 0.3), 35) > 0.993) BG[i] = C(br > 0.035 ? WHITE : CYAN, br > 0.035 ? 11 : 6);
  return set(i, ' ', 0);
}
// underfoot: dark blue carpet with the light off the tanks rippling over it
function aquaFloor(i, f, wx, wy) {
  const c = noise(wx * 1.8 + T * 0.35, wy * 1.8 - T * 0.2, 36);
  BG[i] = C(BLUE, 1 + c * 1.5 * f);
  return set(i, c > 0.62 ? '~' : ' ', C(CYAN, 4 + f * 6));
}
const TOUCH_LINES = ['You stroke a starfish. It feels like a wet cat tongue.', 'A hermit crab pulls itself back into its shell. Rude.',
  'The sea urchin is spikier than it looks. Ow.', 'A little ray glides under your hand. Smooth as a wet mushroom.', 'You touch an anemone and it closes up round your finger.'];
const nearTouchPool = () => mode === 'room' && room.kind === 'aquarium' && Math.abs(px - TOUCH_POOL.x) < TOUCH_POOL.hl + 0.7 && Math.abs(py - TOUCH_POOL.y) < TOUCH_POOL.hw + 0.8;

ROOM_FOR.AQUARIUM = 'aquarium';
ROOM_DEFS.aquarium = { grid: AQUA_GRID, light: 0.55, floor: 'aqua', ceil: 'aqua', wall: aquaWall, keeper: [20.5, 13.3], height: 3,
  props: r => {
    const p = [];
    for (const x of [4.5, 9, 15, 19.5]) { // benches in front of the big window
      p.push(BENCHP(x, 3.3, 0, -1));
      if (chance(0.55)) p.push(sitting(x - 0.3 + Math.random() * 0.6, 3.28, shirt(), 0.45, true));
    }
    const spots = [[3, 2.6], [7.2, 2.4], [12, 2.5], [17, 2.7], [21, 2.4], [2.5, 6.4], [6.8, 7.3], [11.3, 6], [12.6, 9.5], [16.6, 6.2], [21, 8.6], [17.2, 9.6], [3.1, 12.4], [8, 10.8]];
    for (const [x, y] of spots) if (chance(0.5)) p.push(chance(0.3) // visitors, some of them kids
      ? figProp(x, y, figAnyone(shirt(), { kid: true, bot: 'shorts' }), { h: 1.2 })
      : standing(x, y, shirt()));
    // the touch pool: a low rock basin, starfish and crabs and urchins in the shallows
    p.push(TOUCH_POOL_TANK(TOUCH_POOL.x, TOUCH_POOL.y, TOUCH_POOL.hl, TOUCH_POOL.hw)); // starfish, urchins and anemones under the water (built: leisure-fittings.js)
    if (chance(0.7)) p.push(figProp(TOUCH_POOL.x + 0.4, TOUCH_POOL.y + 0.9, figAnyone(YEL, { kid: true, bot: 'shorts' }), { h: 1.2, pose: 'reach', face: [-0.4, -0.9] })); // a kid, hands in the water
    // the gift shop: a counter, the keeper, a stand of plush sharks
    p.push(...counterBox(20.5, 13.95, 1.1), standing(20.5, 13.3, CYAN));
    p.push(PLUSH_STAND(22.4, 13.2)); // the stand of plush sharks, turning
    return p;
  } };
STOCK_WORD.AQUARIUM = ['sharkplush', 'snowglobe', 'soda', 'water'];

// ---- outside: the ground floor is one long tank, with fish going past the windows; the floors above are tiled in
// blues and whites with portholes, a frieze of waves along the top
const AQUA_FACADE_FISH = Array.from({ length: 30 }, (_, k) => ({
  sp: ['fish', 'tiny', 'tang', 'clown', 'fish', 'tiny', 'shark', 'ray', 'turtle', 'fish', 'angel', 'tiny', 'tang', 'jelly', 'fish'][k % 15], k,
  speed: 0.03 + hash(k, 1, 410) * 0.04, ph: hash(k, 2, 410), zf: hash(k, 3, 410), wob: hash(k, 4, 410) * 6.28 }));
const FACADE_SCALE = 0.3; // a metre of fish, in cells: three times life size (it's a big tank, and a fish in the window wants to read from the street)
function aquaFront(i, u, uStep, z, d, side, L) {
  if (!side) return aquaUpper(i, u, uStep, z, d, L); // the ends of the building: tiles
  const glow = 10 + 5 * Math.max(night, overcast * 0.5), open = openAt(AQUARIUM.sh, tod);
  if (z < 0.025) return set(i, '=', C(GRAY, L));
  if (fract(u) < 0.02 || fract(u) > 0.98 || z > 0.3) { BG[i] = C(GRAY, 1 + L * 0.1); return set(i, z > 0.3 ? '=' : '|', C(GRAY, L)); } // mullions
  if (Math.abs(u - AQUARIUM.doorU) < 0.14 && z < 0.24) { // the doors
    if (Math.abs(u - AQUARIUM.doorU) < 0.005 || Math.abs(u - AQUARIUM.doorU) > 0.13) return set(i, '|', C(GRAY, L));
    BG[i] = C(open ? WARM : GRAY, open ? 3 : 1); return set(i, z > 0.2 ? '-' : ' ', C(GRAY, L));
  }
  const u0 = AQUARIUM.x0, span = AQUARIUM.x1 - AQUARIUM.x0 - 0.2, c = noise(u * 6 + T * 0.2, z * 20 - T * 0.15, 33);
  BG[i] = C(BLUE, (1.5 + c * 2.5) * (open ? 1 : 0.6));
  for (const s of AQUA_FACADE_FISH) {
    const f = FISH[s.sp], len = f.len * FACADE_SCALE, h = f.h * FACADE_SCALE;
    const p = mod(T * s.speed + s.ph * 2 * span, 2 * span), there = p < span, fu = u0 + 0.1 + (there ? p : 2 * span - p);
    const fz = 0.04 + h / 2 + (0.24 - h) * s.zf + 0.008 * Math.sin(T * 0.7 + s.wob);
    const q = (u - fu) / len + 0.5, y = (z - fz) / h;
    if (q < 0 || q >= 1 || y < -0.5 || y >= 0.5) continue;
    const hit = f.shape(there ? q : 1 - q, y, T + s.ph * 9, s.k);
    if (hit) { BG[i] = C(hit[0], clamp((open ? glow : glow * 0.6) * hit[1] * 0.75, 1, 15)); return set(i, ' ', 0); }
  }
  if (z < 0.05) return set(i, (Math.floor(u * 80) & 3) ? '.' : '*', C(YEL, 8)); // the sandy bottom
  const ks = Math.floor(u * 40), sx = (ks + 0.5) / 40 + 0.004 * Math.sin(T * 0.6 + z * 30 + ks);
  if (hash(ks, 5, 411) > 0.75 && z < 0.06 + 0.15 * hash(ks, 6, 411) && Math.abs(u - sx) < Math.max(uStep / 2, 0.002)) return set(i, ')', C(GREEN, 10)); // weed
  return set(i, hash(Math.floor(u * 120), Math.floor(z * 120 + T * 2), 412) > 0.996 ? 'o' : ' ', C(WHITE, 9)); // bubbles
}
function aquaUpper(i, u, uStep, z, d, L) {
  const zz = z - 0.4, glowL = Math.max(L, night * 12);
  if (Math.abs(zz - 1.25) < 0.05) return set(i, fract(u * 6 + T * 0.05) < 0.5 ? '~' : '-', C(CYAN, glowL)); // the wave frieze
  const pu = fract(u * 2) - 0.5, pz = fract(zz * 2) - 0.5;
  if (zz > 0.1 && Math.hypot(pu * 0.6, pz) < 0.18) { BG[i] = C(CYAN, 2 + night * 4); return set(i, Math.hypot(pu * 0.6, pz) > 0.14 ? 'O' : ' ', C(GRAY, L)); } // portholes, lit inside
  BG[i] = C(BLUE, ((Math.floor(u * 16) + Math.floor(z * 32)) & 1 ? 1.5 : 2.5) + L * 0.1); // tiles, two blues
  return set(i, ' ', 0);
}
