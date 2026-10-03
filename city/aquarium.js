// ===== the aquarium, across the shore road from the pleasure pier (world.js gives it its lot). Inside: the open
// ocean window across the back of the main hall, a walk-through tunnel with sharks and rays going over your head,
// a dark gallery of jellyfish, a bright one of reef tanks and a kelp forest, seahorses by the door, a touch pool
// and a gift shop. Outside: the ground floor is one long tank behind glass, fish swimming past the windows.
//
// Tanks are cells of the room grid, so they're solid and the raycaster draws their glass like any wall. A run of the
// same tank letter is one tank: the fish in it swim its whole length, and you see them through either side.
const AQUA_FEE = 8;
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
// the fish: art facing right (row by row), size in metres, colour by character
const FISH = {
  tiny: { art: ['><>'], len: 0.12, h: 0.05, col: (k, c) => [YEL, CYAN, ORANGE, WHITE][k & 3] },
  sardine: { art: ['>=>'], len: 0.14, h: 0.04, col: () => WHITE },
  fish: { art: ['><(((o>'], len: 0.32, h: 0.07, col: (k, c) => c === 'o' ? WHITE : [ORANGE, YEL, GRAY, BRICK][k & 3] },
  clown: { art: ["><|=|o>"], len: 0.2, h: 0.06, col: (k, c) => c === '|' ? WHITE : ORANGE },
  tang: { art: ['<\\==o>'], len: 0.24, h: 0.08, col: (k, c) => c === '\\' ? YEL : BLUE },
  angel: { art: [' /|', '<=o>', ' \\|'], len: 0.24, h: 0.24, col: (k, c) => c === 'o' ? WHITE : k & 1 ? YEL : GRAY },
  octopus: { art: [' .--.', '( oo )', '/\\/\\/\\'], len: 0.36, h: 0.26, col: () => RED },
  shark: { art: ['       /|', '><=========o>', '      \\/'], len: 1.9, h: 0.45, col: (k, c) => c === 'o' ? WHITE : GRAY },
  ray: { art: ['   _.--._', '~~(_______)>'], len: 1.3, h: 0.28, col: (k, c) => c === '~' ? GRAY : BRICK },
  turtle: { art: ['   ____', ' _/####\\_o', '  /    \\'], len: 0.9, h: 0.4, col: (k, c) => c === '#' ? BRICK : GREEN },
  jelly: { art: ['.-"-.', '(   )', ' )|( ', '(|||)', ' ) ( '], len: 0.34, h: 0.55, col: (k, c) => [MAG, CYAN, WHITE, ORANGE][k & 3] },
  seahorse: { art: [' _', '(o\\', ' )|', ' (/', '  ~'], len: 0.12, h: 0.3, col: (k, c) => k & 1 ? YEL : ORANGE },
};
const MIRROR = { '<': '>', '>': '<', '(': ')', ')': '(', '/': '\\', '\\': '/', '[': ']', ']': '[', '{': '}', '}': '{' };
for (const f of Object.values(FISH)) { // pad the rows, and a copy facing left
  const W = Math.max(...f.art.map(r => r.length));
  f.art = f.art.map(r => r.padEnd(W));
  f.left = f.art.map(r => [...r].reverse().map(c => MIRROR[c] || c).join(''));
  f.W = W;
}
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
function fishAt(run, u, z, flip = 1) {
  for (const s of run.fish) {
    const f = s.f, q = (u - s.u) / f.len + 0.5, rr = (s.z + f.h / 2 - z) / f.h;
    if (q < 0 || q >= 1 || rr < 0 || rr >= 1) continue;
    let art = s.dir * flip > 0 ? f.art : f.left; // (from the far side of the glass it's swimming the other way)
    if (s.sp === 'jelly' && fract(T * 0.8 + s.ph) < 0.5) art = art.map((r, k) => k > 1 ? r.replace(/[()]/g, '|') : r); // a pulse
    const ch = art[Math.floor(rr * art.length)][Math.floor((flip > 0 ? q : 1 - q) * f.W)]; // (screen left to right)
    if (ch !== ' ') return [ch, f.col(s.k, ch)];
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
  const fish = fishAt(run, u, z, flip);
  if (fish) return set(i, fish[0], C(fish[1], Lt));
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
  const sign = mx === room.W - 1 ? [['GIFT SHOP', 13.4], ['CORAL REEF', 7.5]] : mx === 0 ? [['JELLYFISH', 4.6], ['SEAHORSES', 13]] : my === room.H - 1 ? [['THANK YOU FOR VISITING', 6]] : [];
  for (const [s, u0] of sign) if (wallText(i, u, uStep, z, d, s, u0, 2.3, 0.2, 0.28, C(WHITE, 14), C(BLUE, 2))) return true;
  if (my === 1 || my === 2 && (mx === 0 || mx === room.W - 1)) // the hall's side walls, by the big window
    if (wallText(i, u, uStep, z, d, 'OPEN OCEAN', 2.6, 2.3, 0.2, 0.28, C(WHITE, 14), C(BLUE, 2))) return true;
  return set(i, (Math.floor(u * 3) + Math.floor(z * 3)) % 7 ? ' ' : '.', C(BLUE, L * 0.5)), true;
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
    const w = kind === 'ray' ? Math.max(0, 1 - Math.abs(along - 0.4) * 2.2) : kind === 'shark' ? (along < 0.15 ? along / 0.15 : along > 0.7 ? Math.max(0.2, (1 - along) / 0.3) : 1) : Math.sin(along * Math.PI);
    if (Math.abs(across) < w) return set(i, along < 0.12 ? (sp > 0 ? 'v' : '^') : kind === 'turtle' ? '#' : kind === 'shark' && Math.abs(across) > w * 0.7 && along > 0.3 && along < 0.45 ? '<' : '=', C(col, 12));
    if (kind === 'shark' && along > 0.85 && Math.abs(across) < 0.15) return set(i, '|', C(col, 10)); // the tail
  }
  return set(i, hash(Math.floor(wx * 6), Math.floor(wy * 6 + T * 0.3), 35) > 0.993 ? 'o' : ' ', C(WHITE, 8)); // bubbles going up
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
      ? SP(x, y, 0.4, 1.15, ART.keeper, ((s) => (c, row, L) => C(row < 3 ? SKIN : row < 6 ? s : GRAY, L))(shirt()))
      : standing(x, y, shirt()));
    // the touch pool: a low rock basin, starfish and crabs and urchins in the shallows
    p.push(BX(TOUCH_POOL.x, TOUCH_POOL.y, TOUCH_POOL.hl, TOUCH_POOL.hw, 0, 0.75, (i, t, L) => {
      if (HIT.face !== 5) { BG[i] = C(GRAY, (1 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.w > 0.7 ? '=' : (Math.floor(HIT.u * 6) + Math.floor(HIT.w * 6)) & 1 ? '#' : ' ', C(GRAY, L * 0.7)), true; }
      if (Math.abs(HIT.u) > TOUCH_POOL.hl - 0.08 || Math.abs(HIT.v) > TOUCH_POOL.hw - 0.08) { BG[i] = C(GRAY, 2); return set(i, '=', C(GRAY, L)), true; }
      BG[i] = C(CYAN, 2 + noise(HIT.u * 4 + T * 0.4, HIT.v * 4, 37) * 2);
      const k = hash(Math.floor(HIT.u * 5), Math.floor(HIT.v * 5), 38);
      return set(i, k > 0.85 ? '*' : k > 0.78 ? 'w' : k > 0.73 ? '#' : k > 0.6 ? '~' : ' ', C(k > 0.85 ? ORANGE : k > 0.78 ? RED : k > 0.73 ? MAG : WHITE, 13)), true;
    }));
    if (chance(0.7)) p.push(SP(TOUCH_POOL.x + 0.4, TOUCH_POOL.y + 0.9, 0.4, 1.15, ART.keeper, (c, row, L) => C(row < 3 ? SKIN : row < 6 ? YEL : BLUE, L))); // a kid, hands in the water
    // the gift shop: a counter, the keeper, a stand of plush sharks
    p.push(...counterBox(20.5, 13.95, 1.1), standing(20.5, 13.3, CYAN));
    p.push(BX(22.4, 13.2, 0.3, 0.3, 0, 1.6, (i, t, L) => {
      BG[i] = C(BRICK, (1 + L * 0.3) * shadeFace(HIT.face));
      if (HIT.face === 5) return set(i, ' ', 0), true;
      return set(i, fract(HIT.w / 0.4) < 0.15 ? '=' : hash(Math.floor((HIT.u + HIT.v) * 6), Math.floor(HIT.w / 0.4), 39) > 0.4 ? '<' : '@', C(fract(HIT.w / 0.4) < 0.15 ? BRICK : [GRAY, BLUE, MAG, CYAN][Math.floor(HIT.w / 0.4) & 3], 13)), true;
    }));
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
    const q = (u - fu) / len + 0.5, rr = (fz + h / 2 - z) / h;
    if (q < 0 || q >= 1 || rr < 0 || rr >= 1) continue;
    const art = there ? f.art : f.left, ch = art[Math.floor(rr * art.length)][Math.floor(q * f.W)];
    if (ch !== ' ') return set(i, ch, C(f.col(s.k, ch), open ? glow : glow * 0.6));
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
