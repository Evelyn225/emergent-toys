// ===== city sprites: everything drawn over the raycast scene, nearest-first order doesn't matter (drawArt depth-tests)
// visit the props in the blocks within draw distance
function forNear(b, fn) {
  const r = Math.ceil(vis / 8) + 1, cx = Math.floor(px / 8), cy = Math.floor(py / 8);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) for (const it of b[bi(cx + i, cy + j)]) fn(it);
}
const R = (x, y) => [rel(x - px), rel(y - py)];
// how much a world direction (ax, ay) lies across our view of a point at (vx, vy): +1 = pointing right on screen
const across = (ax, ay, vx, vy) => { const n = Math.hypot(vx, vy) || 1; return (ax * -vy + ay * vx) / n; };
const PILLAR = pad(['[=]', '|#|', '|#|', '|#|', '|#|', '|#|', '|#|', '/#\\']);
const EL_STAIRS = pad(['[ EL ]', '    _|', '   _| ', '  _|  ', ' _|   ', '_|    ']);
const DOG = pad(['  __', '(o_ \\_', ' /\\ /\\']), DOG_R = mirror(DOG);
let siren = null; // the emergency vehicle in sight, if any: floorCell washes its lights over the street
// the light bar's strobe: a double flash of red, a double flash of blue, dark in between. RED, BLUE or -1 (dark)
function strobe() { const p = Math.floor(fract(T * 1.4) * 10); return p === 0 || p === 2 ? RED : p === 5 || p === 7 ? BLUE : -1; }

// ---- trees: a solid canopy you can't see the sky through (shaded lighter on top, ragged at the edges), on a trunk.
// Sizes for a tree of s = 1, in cells: [half width, height]
const TREE_SIZE = { oak: [0.27, 0.62], blossom: [0.27, 0.6], pine: [0.21, 0.8], birch: [0.16, 0.68], poplar: [0.12, 0.82] };
const TREE_BLOBS = { oak: [[0, 0.44, 0.17], [-0.13, 0.33, 0.13], [0.13, 0.34, 0.13], [0, 0.29, 0.13]], blossom: [[0, 0.42, 0.16], [-0.13, 0.33, 0.13], [0.13, 0.32, 0.12], [0, 0.27, 0.12]],
  birch: [[0, 0.47, 0.13], [-0.04, 0.36, 0.1], [0.04, 0.56, 0.08]], poplar: [[0, 0.5, 0.11], [0, 0.34, 0.1], [0, 0.66, 0.08]] };
const TREE_WINTER_BRANCHES = {
  oak: [[0, 0.2, -0.15, 0.42], [0, 0.2, 0.15, 0.42], [-0.15, 0.42, -0.24, 0.57], [0.15, 0.42, 0.24, 0.57]],
  blossom: [[0, 0.2, -0.14, 0.4], [0, 0.2, 0.14, 0.4], [-0.14, 0.4, -0.23, 0.55], [0.14, 0.4, 0.23, 0.55]],
  birch: [[0, 0.27, -0.09, 0.39], [0, 0.4, 0.09, 0.52], [0, 0.52, -0.07, 0.62]],
  poplar: [[0, 0.28, -0.07, 0.37], [0, 0.4, 0.07, 0.49], [0, 0.52, -0.065, 0.61]]
};
function nearTreeBranch(u, z, x0, z0, x1, z1, width) {
  const du = x1 - x0, dz = z1 - z0, t = clamp(((u - x0) * du + (z - z0) * dz) / (du * du + dz * dz), 0, 1);
  return Math.hypot(u - x0 - du * t, z - z0 - dz * t) < width;
}
function drawTree(t, vx, vy) {
  const [hw, h] = TREE_SIZE[t.kind], s = t.s;
  drawShape(vx, vy, 0, hw * s, h * s, (i, u, z, du, dz, L) => treeCell(i, u / s, z / s, du / s, dz / s, L, t));
}
function treeCell(i, u, z, du, dz, L, t) {
  const k = t.kind, au = Math.abs(u), tint = 0.85 + t.seed * 0.3, sn = seasonIdx(), bare = sn === 3 && k !== 'pine';
  let e = -1, cz = 0.4; // how far inside the canopy (0 at its edge, 1 at the middle), and the middle's height
  if (k === 'pine') { // tiers of boughs, each a triangle, narrowing up the tree
    for (let j = 0; j < 4; j++) {
      const z0 = 0.12 + j * 0.15, top = z0 + 0.24, w = 0.21 - j * 0.04;
      if (z > z0 && z < top) { const half = (top - z) / 0.24 * w; if (au < half) e = Math.max(e, Math.min(1, (half - au) / 0.06, (z - z0) / 0.04)); }
    }
    cz = 0.45;
  } else for (const [bu, bz, r] of TREE_BLOBS[k]) { const d = Math.hypot(u - bu, (z - bz) * 1.1) / r; if (d < 1) { e = Math.max(e, 1 - d); cz = bz; } }
  const trunkTop = k === 'pine' ? 0.2 : k === 'poplar' ? 0.25 : 0.32, trunkW = k === 'oak' || k === 'blossom' ? 0.025 : 0.018;
  if (bare) { // winter branches follow a few continuous limbs instead of a noisy, leaf-shaped hatch
    const width = Math.max(0.009, du * 0.55, dz * 0.55), height = TREE_SIZE[k][1];
    let branch = false, slope = 0;
    if (nearTreeBranch(u, z, 0, 0, 0, height * 0.96, width * 1.15)) { branch = true; slope = Infinity; }
    for (const [x0, z0, x1, z1] of TREE_WINTER_BRANCHES[k]) if (nearTreeBranch(u, z, x0, z0, x1, z1, width)) {
      branch = true; slope = (z1 - z0) / (x1 - x0 || 0.001);
    }
    if (!branch) return false;
    const snow = snowCover > 0.2 && z > height * 0.55 && hash(Math.floor(u * 90 + t.seed * 99), Math.floor(z * 90), 816) > 0.68;
    const ch = snow ? '-' : !isFinite(slope) ? '|' : Math.abs(slope) > 1.8 ? '|' : Math.abs(slope) < 0.28 ? '-' : slope > 0 ? '/' : '\\';
    return set(i, ch, C(snow ? WHITE : BRICK, snow ? 12 : clamp(6 + L * 0.45, 6, 13))), true;
  }
  if (e < 0) {
    if (z < trunkTop && au < trunkW + (z < 0.03 ? 0.012 : 0)) { // the trunk (a birch's white, with black marks)
      if (k === 'birch') { BG[i] = C(WHITE, 2 + L * 0.35); return set(i, hash(Math.floor(z * 60), 1, 813) > 0.75 ? '-' : ' ', C(GRAY, 3)), true; }
      BG[i] = C(BRICK, 0.8 + L * 0.18); return set(i, au < trunkW * 0.4 ? '|' : ' ', C(BRICK, L * 0.6)), true;
    }
    return false;
  }
  const n = hash(Math.floor(u * 45 + t.seed * 99), Math.floor(z * 45), 814);
  if (e < (sn === 2 ? 0.2 : 0.14) && n > 0.55) return false; // ragged edges: a little sky between the outermost leaves (thinner in autumn)
  const lit = clamp(0.75 + (z - cz) * 1.6 - u * 0.6, 0.45, 1.25) * tint; // lighter up top and toward the sun
  const fall = sn === 2 && k !== 'pine' ? [ORANGE, RED, YEL, BRICK][Math.floor(hash(Math.floor(u * 12 + t.seed * 50), Math.floor(z * 12), 815) * 4)] : 0; // autumn colours
  const base = fall || (k === 'blossom' || sn === 0 && k !== 'pine' && n > 0.82 ? MAG : GREEN), bg = k === 'pine' || k === 'poplar' ? 0.75 : k === 'birch' ? 1.15 : 1;
  if (k === 'pine' && snowCover > 0.2 && n > 0.62) { BG[i] = C(WHITE, 3 + L * 0.3); return set(i, '^', C(WHITE, 15)), true; } // snow on the pine's boughs
  BG[i] = C(base, Math.max(0.6, (0.9 + L * 0.22) * lit * bg));
  const ch = k === 'pine' ? (n > 0.6 ? '^' : n > 0.3 ? 'A' : ' ') : n > 0.72 ? '@' : n > 0.45 ? '%' : n > 0.25 ? '&' : ' ';
  return set(i, ch, fall ? C(fall, L * (0.9 + n * 0.5) * lit) : base === MAG ? C(n > 0.8 ? WHITE : MAG, L * 1.1 * lit) : C(k === 'birch' && n > 0.8 ? YEL : GREEN, L * (0.8 + n * 0.5) * lit * bg)), true;
}

function citySprites() {
  forNear(treesB, t => { const [vx, vy] = R(t.x, t.y); if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawTree(t, vx, vy); });
  forNear(benchesB, b => { const [vx, vy] = R(b.x, b.y); drawBench(vx, vy, b.fx, b.fy, 0.01); });
  gardenSprites();
  clubSprites();
  drawPigeons();
  bayBoats(); // (marina.js: real 3D boats)
  marinaSprites();
  forNear(extrasB, o => { if (!(o.spire && mode === 'roof' && Math.hypot(rel(o.x - px), rel(o.y - py)) < 0.8) && (!o.when || o.when())) drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, o.col); }); // (not the spire you're standing under)
  for (const v of vendors) {
    const t = v.type, frame = t.art[(T * 2 | 0) & 1];
    drawArt(...R(v.x, v.y), 0, t.w, 0.22, frame, (c, row, L) =>
      c === '~' ? C(WHITE, L * 0.6) : row < 3 && /[A-Z]/.test(c) ? C(WHITE, Math.max(L, night * 15)) :
      row < 3 ? C(t.color, Math.max(L, night * 12)) : c === 'O' ? C(GRAY, L * 0.5) : C(t.color, L));
    drawArt(...R(v.x + v.ox, v.y + v.oy), 0, 0.06, 0.18, ART.walkB, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? v.shirt : GRAY, L));
  }
  for (const r of radios) { const [vx, vy] = R(r.x, r.y); if (Math.hypot(vx, vy) < vis + 2) drawRadioTower(vx, vy); }
  for (const s of stations) { const [vx, vy] = R(s.x, s.y); if (Math.hypot(vx, vy) < vis) drawStationEntrance(s, vx, vy); }
  forNear(roofsB, o => {
    const blink = fract(T * 0.8 + o.x) < 0.5;
    drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, (c, row, L) =>
      o.kind === 'antenna' ? (c === '*' ? C(RED, blink ? 15 : 3) : C(GRAY, L)) :
      o.kind === 'tank' ? C(c === '=' ? GRAY : BRICK, L) :
      row === 1 && c !== '|' ? C(o.neon, Math.max(L, night * 15)) : C(GRAY, L));
  });
  for (const k of cranes) {
    const [vx, vy] = R(k.x, k.y);
    if (Math.abs(vx) > vis + 5 || Math.abs(vy) > vis + 5) continue;
    // the jib slews slowly; p = how much of it faces sideways to us (+ = reaching right on screen)
    const th = k.slew + T * 0.03, p = across(Math.cos(th), Math.sin(th), vx, vy);
    // where the hook hangs: under the trolley, always clear of whatever's built below it
    const f = 0.45 + 0.35 * Math.sin(T * 0.08 + k.slew), tx = k.x + Math.cos(th) * JIB * f, ty = k.y + Math.sin(th) * JIB * f;
    let below = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) below = Math.max(below, map[idx(Math.floor(tx) + i, Math.floor(ty) + j)]);
    k.tro = f; k.hz = Math.min(k.H - 0.6, below + 0.5 + 0.8 * (0.5 + 0.5 * Math.sin(T * 0.05 + k.slew * 3)));
    drawShape(vx, vy, 0, 5, k.H + 0.8, (i, u, z, du, dz, L) => craneCell(i, u, z, du, dz, L, k, p));
  }
  for (const s of stacks) {
    const [vx, vy] = R(s.x, s.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawShape(vx, vy, s.z, 1.6, s.H + 2.2, (i, u, z, du, dz, L) => stackCell(i, u, z, du, dz, L, s));
  }
  forNear(lampsB, ({ x, y, ax, ay }) => {
    const [vx, vy] = R(x, y), depth = dx * vx + dy * vy;
    if (depth < 0.05 || depth > vis) return;
    if (vx * vx + vy * vy < LAMP_3D * LAMP_3D) return drawLamp3D(vx, vy, ax, ay); // up close: a real one
    const s = across(ax, ay, vx, vy); // arm across our view: +1 reaching right
    drawShape(vx, vy, 0, REACH + 0.08, LAMP_TOP + NECK + 0.03, (i, u, z, du, dz, L) => lampCell(i, u, z, du, dz, L, s));
  });
  islandSprites();
  fairSprites();
  forNear(solidsB, o => { const [vx, vy] = R(o.x, o.y); if (Math.hypot(vx, vy) < vis + 1) drawBox(boxAt(vx, vy, o.c, o.s, o.hl, o.hw, o.z0, o.z1), SOLID_SHADE[o.kind](o)); });
  forNear(machinesB, m => { const [vx, vy] = R(m.x, m.y); if (Math.hypot(vx, vy) < vis) drawVending(m, vx, vy); });
  forNear(lanternsB, l => { const [vx, vy] = R(l.x, l.y); if (Math.hypot(vx, vy) < 30) drawLanternString(vx, vy, l.ax, l.ay); });
  const LC = { G: GREEN, Y: YEL, R: RED };
  forNear(lightsB, s => {
    const col = C(LC[light(s.bx, s.by, s.vert, T)], 15);
    drawArt(...R(s.x, s.y), 0, 0.05, 0.4, ART.signal, (c, row, L) => c === 'O' ? col : C(GRAY, L));
  });
  bridgeSprites();
  elSprites();
  siren = null;
  for (const m of cars) {
    if ((m.player || m.rider) && !chaseOn) continue; // first person: you're inside it
    const [vx, vy] = R(m.ex, m.ey), hx = m.hx, hy = m.hy;
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    if ((m.ev || m.patrol) && lightsOn_(m) && Math.hypot(vx, vy) < vis) siren = m;
    drawVehicle(m, vx, vy, hx, hy);
  }
  for (const b of SERVICES) if (!b.out) { // parked out front of its station, ready to go
    const [vx, vy] = R(b.x, b.y);
    if (Math.hypot(vx, vy) < vis) drawVehicle(b.parked || (b.parked = { kind: b.kind, body: EV_BODY[b.kind], ev: true, state: 'home', v: 0 }), vx, vy, -1, 0);
  }
  for (const m of fairFolk) { // the crowd at the fair (fair.js)
    const [vx, vy] = R(m.x, m.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawArt(vx, vy, 0, 0.06, 0.18, (m.ph | 0) % 2 ? ART.walkA : ART.walkB, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? m.shirt : m.pants, L));
  }
  for (const m of people) if (!m.hidden) {
    drawArt(...R(m.x, m.y), 0, 0.06, 0.18, (m.ph | 0) % 2 ? ART.walkA : ART.walkB,
            (c, row, L) => C(row < 2 ? SKIN : row === 2 ? m.shirt : m.pants, L));
    if (walkingDog(m)) { // the dog, and the lead from the walker's hand to its collar
      const d = dogOf(m), [vx, vy] = R(d.x, d.y), [hx, hy] = R(m.x, m.y), right = -dy * d.mx + dx * d.my > 0, s = d.small ? 0.7 : 1;
      drawArt(vx, vy, 0, 0.07 * s, 0.05 * s, right ? DOG_R : DOG, (c, row, L) => c === 'o' ? C(GRAY, 3) : C(d.col, L * 1.2));
      for (let k = 1; k < 5; k++) { const t = k / 5; drawArt(hx + (vx - hx) * t, hy + (vy - hy) * t, 0.085 - 0.05 * t - Math.sin(t * Math.PI) * 0.012, 0.006, 0.006, ['.'], () => C(RED, 10)); }
    }
    if (m.hailing) drawArt(...R(m.x, m.y), 0.2, 0.03, 0.06, ['!'], () => C(YEL, fract(T * 3) < 0.6 ? 15 : 8)); // waving you down
  }
  drawBall();
  for (const c of footCops) { // police on foot: navy cap, uniform, running when they're after you
    const [vx, vy] = R(c.x, c.y);
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    drawArt(vx, vy, 0, 0.06, 0.18, (c.ph | 0) % 2 ? ART.walkA : ART.walkB, (ch, row, L) => C(row === 1 ? SKIN : BLUE, row === 0 ? L * 0.7 : row > 2 ? L * 0.6 : L));
    if (c.chase && fract(T * 3) < 0.5) drawArt(vx, vy, 0.2, 0.03, 0.05, ['!'], () => C(RED, 15));
  }
  for (const d of dropped) if (d.at === '') { const [vx, vy] = R(d.x, d.y); if (Math.hypot(vx, vy) < 12) drawDropped(d, vx, vy, 0.007); } // things you put down
  if (job && job.ride) { // the fare's stop: a big marker hanging over the street
    const [vx, vy] = R(job.ride.dest[0], job.ride.dest[1]);
    drawArt(vx, vy, 0.25, 0.12, 0.18, ['\\ /', ' V '], () => C(YEL, fract(T * 2) < 0.7 ? 15 : 9));
  }
  if (task && task.kind === 'dog') drawArt(...R(task.dog.x, task.dog.y), 0, 0.07, 0.05, DOG, (c, row, L) => C(BRICK, L * 1.2));
}

// a classic street lamp: a tall fluted pole, a swan neck curving out over the street, a lantern hanging from its end.
// Drawn from measurements, so the curve stays one character thick at any distance; s squashes the neck sideways
// when the arm points toward or away from you, so it turns smoothly as you walk round it.
const LAMP_TOP = 0.95, NECK = REACH / 2; // pole height; the neck is a half circle of radius NECK
function lampCell(i, u, z, du, dz, L, s) {
  const lit = lampsOn > 0.3, steel = C(GRAY, L * 1.1), hx = 2 * NECK * s, lu = u - hx, lz = z - (LAMP_TOP - 0.09);
  // the lantern: a cap, a glass body glowing after dark, a finial underneath
  if (Math.abs(lu) < Math.max(0.03, du * 0.75) && z < LAMP_TOP - 0.03 && z > LAMP_TOP - 0.14) {
    if (z > LAMP_TOP - 0.055) return set(i, Math.abs(lu) < Math.max(0.015, du / 2) ? '^' : '_', steel), true;
    if (z < LAMP_TOP - 0.125) return set(i, 'v', steel), true;
    if (lit) BG[i] = C(WARM, 4 + lampsOn * 4);
    return set(i, lit ? '#' : ':', lit ? C(WARM, 15) : C(GRAY, L * 0.7)), true;
  }
  if (z <= LAMP_TOP && z > LAMP_TOP - 0.03 && onLine(lu, du, 0, 0)) return set(i, '|', steel), true; // the drop
  const halo = Math.hypot(lu / 0.075, lz / 0.065);
  if (lit && halo < 1) { BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, " ", 0), true; } // a soft glow round it
  // the pole: a flared base, a collar, a finial on top
  if (z < LAMP_TOP + 0.02 && Math.abs(u) < Math.max(du / 2, z < 0.06 ? 0.03 : 0.012)) {
    if (z < 0.06) return set(i, z < 0.025 ? '#' : 'A', steel), true;
    return set(i, Math.abs(z - 0.42) < Math.max(0.012, dz / 2) ? '=' : '|', steel), true;
  }
  // the swan neck: the upper half of an ellipse from the pole top out to the lantern
  const w = NECK * Math.abs(s);
  if (w > du * 0.3 && z > LAMP_TOP - dz) {
    const ex = (u - NECK * s) / w, ez = (z - LAMP_TOP) / NECK, rho = Math.hypot(ex, ez), tol = Math.max(du / w, dz / NECK) / 2;
    if (Math.abs(rho - 1) < tol && ez > -tol) {
      const ang = Math.atan2(ez, ex), tu = -w * Math.sin(ang) / du, tz = NECK * Math.cos(ang) / dz; // tangent, in cells
      const sl = Math.abs(tz) / (Math.abs(tu) + 1e-9);
      return set(i, sl > 2.5 ? '|' : sl < 0.4 ? '-' : tu * tz > 0 ? '/' : '\\', steel), true; // rising to the right: '/'
    }
  }
  return false;
}

// a lamp up close, built from boxes so it's solid from any side: a flared base, the pole with its collar, the swan
// neck as a chain of short pieces round the half circle, and the lantern hanging off the end (glowing after dark).
// Further off the billboard (lampCell) looks the same and costs far less.
const LAMP_3D = 5, NECK_BITS = 7;
const steelBox = ch => (i, t, L) => { BG[i] = C(GRAY, (0.9 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '.' : ch, C(GRAY, L * 1.15)), true; };
const STEEL = { pole: steelBox('|'), base: steelBox('#'), arm: steelBox('='), cap: steelBox('_') };
function drawLamp3D(vx, vy, ax, ay) {
  const lit = lampsOn > 0.3, B = (u, z0, z1, hl, hw, shade) => drawBox(boxAt(vx + ax * u, vy + ay * u, ax, ay, hl, hw, z0, z1), shade);
  B(0, 0, 0.06, 0.026, 0.026, STEEL.base);
  B(0, 0.06, LAMP_TOP, 0.01, 0.01, STEEL.pole);
  B(0, 0.41, 0.43, 0.016, 0.016, STEEL.cap);
  for (let k = 0; k < NECK_BITS; k++) { // the neck: up and over from the top of the pole to the lantern
    const t0 = Math.PI * (1 - k / NECK_BITS), t1 = Math.PI * (1 - (k + 1) / NECK_BITS);
    const u0 = NECK + NECK * Math.cos(t0), u1 = NECK + NECK * Math.cos(t1), z0 = LAMP_TOP + NECK * Math.sin(t0), z1 = LAMP_TOP + NECK * Math.sin(t1);
    B((u0 + u1) / 2, Math.min(z0, z1) - 0.007, Math.max(z0, z1) + 0.007, Math.abs(u1 - u0) / 2 + 0.007, 0.008, STEEL.arm);
  }
  const hu = 2 * NECK, top = LAMP_TOP;
  B(hu, top - 0.03, top, 0.004, 0.004, STEEL.pole); // the drop
  B(hu, top - 0.055, top - 0.03, 0.032, 0.032, STEEL.cap);
  B(hu, top - 0.125, top - 0.055, 0.024, 0.024, (i, t, L) => { // the glass
    if (HIT.face === 6) { BG[i] = C(GRAY, 1); return set(i, 'v', C(GRAY, L)), true; }
    const edge = Math.abs(Math.abs(HIT.face <= 2 ? HIT.v : HIT.u) - 0.024) < 0.004;
    if (lit) BG[i] = C(WARM, 4 + lampsOn * 4);
    return set(i, edge ? '|' : lit ? '#' : ':', lit && !edge ? C(WARM, 15) : C(GRAY, L * 0.8)), true;
  });
  B(hu, top - 0.14, top - 0.125, 0.008, 0.008, STEEL.pole);
  if (lit) drawShape(vx + ax * hu, vy + ay * hu, top - 0.16, 0.075, 0.13, (i, u, z, du, dz) => { // the soft glow round the lantern
    const halo = Math.hypot(u / 0.075, (z - 0.065) / 0.065);
    if (halo >= 1) return false;
    BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, ' ', 0), true;
  });
}

// ---- vehicles as real boxes (see drawBox): a body, a cabin with glass, and whatever goes on the roof.
// Sizes in cells (1 = 10m): [half length, half width, body top, cabin top, cabin half length, cabin offset along]
const VEHICLES = {
  car: [0.21, 0.09, 0.075, 0.13, 0.11, -0.02], taxi: [0.21, 0.09, 0.075, 0.13, 0.11, -0.02],
  police: [0.22, 0.09, 0.075, 0.13, 0.11, -0.02], amb: [0.25, 0.1, 0.15, 0, 0, 0], fire: [0.37, 0.1, 0.14, 0.17, 0.06, 0.29],
};
const shadeFace = f => f === 5 ? 1 : f === 1 || f === 2 ? 0.85 : 0.7; // a little light from above, a little less on the sides
// the ambulance: a tall white box module behind a low cab. Red stripe and a star of life down the sides, a red cross on
// the roof, rear doors with chevrons and little windows, the light bar along the top front edge of the box
function drawAmbulance(m, vx, vy, hx, hy) {
  const hl = 0.25, hw = 0.1, MH = 0.165, CH = 0.11, mhl = hl * 0.68, mo = -hl + mhl, chl = hl - mhl, co = hl - chl;
  const lightsOn = night > 0.4 || overcast > 0.5, braking = m.brake || m.v < 0.05;
  const white = (f, L) => C(WHITE, (2.5 + L * 0.7) * shadeFace(f));
  const sill = (i, w, L) => { BG[i] = C(GRAY, 1); return set(i, '_', C(GRAY, L * 0.3)), true; };
  const wheel = (i, L) => { BG[i] = C(GRAY, 1); return set(i, '@', C(GRAY, L * 0.5)), true; };
  drawBox(boxAt(vx + hx * mo, vy + hy * mo, hx, hy, mhl, hw, 0.012, MH), (i, t, L) => { // the box
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    BG[i] = white(f, L);
    if (f === 6) return set(i, ' ', 0), true;
    if (f === 5) return set(i, Math.abs(u) < 0.045 && Math.abs(v) < 0.012 || Math.abs(v) < 0.045 && Math.abs(u) < 0.012 ? '#' : ' ', C(RED, 13)), true;
    if (f === 1) return set(i, ' ', 0), true; // (above the cab)
    if (f === 2) { // the back: two doors, windows up top, chevrons along the bottom, tail lights
      if (w < 0.022) return sill(i, w, L);
      if (Math.abs(v) < 0.006) return set(i, '|', C(GRAY, L * 0.6)), true;
      if (w > 0.11 && w < 0.145 && Math.abs(v) > 0.02 && Math.abs(v) < 0.075) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, ' ', 0), true; }
      if (w < 0.05 && Math.abs(v) > hw * 0.75) return set(i, ']', C(RED, braking ? 15 : 8)), true;
      if (w < 0.06) { const c = fract((v * (v > 0 ? 1 : -1) + w) * 18) < 0.5; BG[i] = C(c ? RED : YEL, c ? 9 : 12); return set(i, ' ', 0), true; }
      return set(i, ' ', 0), true;
    }
    // the sides
    if (w < 0.035 && Math.abs(u + mhl * 0.55) < 0.04) return wheel(i, L);
    if (w < 0.022) return sill(i, w, L);
    if (w > 0.062 && w < 0.078) { BG[i] = C(RED, 9 + L * 0.2); return set(i, ' ', 0), true; } // the stripe
    const su = u - mhl * 0.1, sw = w - 0.118; // the star of life
    if (Math.abs(su) < 0.03 && Math.abs(sw) < 0.03 && (Math.abs(su) < 0.009 || Math.abs(sw) < 0.009 || Math.abs(Math.abs(su) - Math.abs(sw)) < 0.008)) { BG[i] = C(BLUE, 9); return set(i, ' ', 0), true; }
    if (u > mhl * 0.6 && w > 0.1 && w < 0.14) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, ' ', 0), true; } // a little side window
    return set(i, ' ', 0), true;
  });
  drawBox(boxAt(vx + hx * co, vy + hy * co, hx, hy, chl, hw * 0.94, 0.012, CH), (i, t, L) => { // the cab
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    BG[i] = white(f, L);
    if (f === 6 || f === 2) return set(i, ' ', 0), true;
    if (f === 5) return set(i, ' ', 0), true;
    if (f === 1) { // the windscreen, headlights, a grille
      if (w > 0.07 && Math.abs(v) < hw * 0.82) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, w > 0.1 ? '-' : ' ', C(GRAY, 5)), true; }
      if (w < 0.05 && Math.abs(v) > hw * 0.55) return set(i, 'O', C(WHITE, lightsOn ? 15 : 10)), true;
      if (w < 0.045) return set(i, '=', C(GRAY, L * 0.5)), true;
      return set(i, ' ', 0), true;
    }
    if (w < 0.035 && Math.abs(u) < 0.04) return wheel(i, L);
    if (w < 0.022) return sill(i, w, L);
    if (w > 0.062 && w < 0.078) { BG[i] = C(RED, 9 + L * 0.2); return set(i, ' ', 0), true; }
    if (w > 0.072 && u > -chl * 0.6 && u < chl * 0.75) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, ' ', 0), true; } // the door window
    return set(i, Math.abs(u + chl * 0.65) < 0.004 ? '|' : ' ', C(GRAY, L * 0.5)), true;
  });
  const lb = mo + mhl - 0.02; // the light bar, and a lamp on each back corner
  drawBox(boxAt(vx + hx * lb, vy + hy * lb, hx, hy, 0.018, hw * 0.85, MH, MH + 0.016), (i, t, L) => {
    const side = HIT.v > 0 ? RED : BLUE, on = lightsOn_(m) && strobe() === side;
    BG[i] = C(side, on ? 15 : 3); return set(i, on ? '*' : '=', C(on ? WHITE : side, on ? 15 : 7)), true;
  });
  for (const s of [-1, 1]) drawBox(boxAt(vx + hx * (mo - mhl + 0.012) - hy * s * hw * 0.8, vy + hy * (mo - mhl + 0.012) + hx * s * hw * 0.8, hx, hy, 0.01, 0.012, MH, MH + 0.012), (i, t, L) => {
    const on = lightsOn_(m) && strobe() === (s > 0 ? RED : BLUE);
    BG[i] = C(RED, on ? 15 : 4); return set(i, on ? '*' : ' ', C(WHITE, 15)), true;
  });
}
function drawVehicle(m, vx, vy, hx, hy) {
  if (m.kind === 'amb') return drawAmbulance(m, vx, vy, hx, hy);
  const [hl, hw, top, cab, chl, cof] = VEHICLES[m.kind], lightsOn = night > 0.4 || overcast > 0.5;
  const fobBlinking = m.owned && m.fobBlinkAt !== undefined && T - m.fobBlinkAt < 2.4;
  const fobHeadlight = !fobBlinking || Math.floor((T - m.fobBlinkAt) * 4) % 2 === 0;
  const braking = m.brake || m.v < 0.05, body = m.body;
  // body: wheels and a dark sill along the bottom, headlights and grille at the front, tail lights at the back
  drawBox(boxAt(vx, vy, hx, hy, hl, hw, 0.012, top), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w, k = shadeFace(f);
    BG[i] = C(body, (1.5 + L * 0.45) * k);
    if (f === 5) return set(i, m.kind === 'amb' && Math.abs(u) < 0.05 && Math.abs(v) < 0.05 ? '+' : ' ', C(RED, 12)), true;
    if (f === 1) return set(i, w < 0.05 && Math.abs(v) > hw * 0.55 ? 'O' : w < 0.04 ? '=' : ' ', w < 0.05 && Math.abs(v) > hw * 0.55 ? C(fobBlinking ? (fobHeadlight ? WHITE : BLACK) : WHITE, fobBlinking || lightsOn ? 15 : 10) : C(GRAY, L * 0.5)), true;
    if (f === 2) return set(i, w < 0.055 && w > 0.03 && Math.abs(v) > hw * 0.55 ? ']' : ' ', C(RED, braking ? 15 : 8)), true;
    if (f === 6) return set(i, ' ', 0), true;
    const wheel = w < 0.035 && Math.min(Math.abs(u - hl * 0.62), Math.abs(u + hl * 0.62)) < 0.04;
    if (wheel) { BG[i] = C(GRAY, 1); return set(i, '@', C(GRAY, L * 0.5)), true; }
    if (w < 0.022) { BG[i] = C(GRAY, 1); return set(i, '_', C(GRAY, L * 0.3)), true; }
    if (m.kind === 'amb' && w > 0.06 && w < 0.13) { // the ambulance's side: windows up front, a red stripe and cross
      if (u > hl * 0.55 && w > 0.09) { BG[i] = C(CYAN, 2 + L * 0.15); return set(i, ' ', 0), true; }
      if (Math.abs(w - 0.08) < 0.008) return set(i, '=', C(RED, 13)), true;
      if (Math.abs(u) < 0.03 && w > 0.095) return set(i, '+', C(RED, 14)), true;
    }
    if (m.kind === 'fire' && w > 0.05) return set(i, Math.abs(fract(u * 12) - 0.5) < 0.12 ? '|' : '=', C(GRAY, L * 0.7)), true; // lockers
    return set(i, Math.abs(w - 0.05) < 0.006 ? '-' : ' ', C(body, L * 0.6)), true;
  });
  // cabin: glass all round, pillars at the corners, a roof
  if (cab) drawBox(boxAt(vx + hx * cof, vy + hy * cof, hx, hy, chl, hw * 0.9, top, cab), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    if (f === 5 || f === 6) { BG[i] = C(body, (1.5 + L * 0.45) * shadeFace(f)); return set(i, ' ', 0), true; }
    const edge = f <= 2 ? Math.abs(v) > hw * 0.8 : Math.abs(u - cof) > chl * 0.85;
    if (edge || w > cab - 0.008) { BG[i] = C(body, (1.5 + L * 0.45) * 0.8); return set(i, '|', C(body, L * 0.5)), true; }
    BG[i] = C(CYAN, 1 + L * 0.12); return set(i, ' ', 0), true;
  });
  const roof = cab || top; // what sits on the roof
  if (m.kind === 'taxi') drawBox(boxAt(vx, vy, hx, hy, 0.03, 0.05, roof, roof + 0.02), (i, t, L) => {
    BG[i] = C(YEL, lightsOn ? 13 : 9); return set(i, HIT.face <= 4 ? '=' : ' ', C(GRAY, 3)), true;
  });
  if (m.ev || m.patrol) drawBox(boxAt(vx + hx * (m.kind === 'amb' ? hl * 0.7 : 0), vy + hy * (m.kind === 'amb' ? hl * 0.7 : 0), hx, hy, 0.02, hw * 0.8, roof, roof + 0.015), (i, t, L) => {
    const side = HIT.v > 0 ? RED : BLUE, on = lightsOn_(m) && strobe() === side; // the light bar: red on one side, blue the other
    BG[i] = C(side, on ? 15 : 3); return set(i, on ? '*' : '=', C(on ? WHITE : side, on ? 15 : 7)), true;
  });
  if (m.kind === 'fire') drawBox(boxAt(vx - hx * 0.05, vy - hy * 0.05, hx, hy, 0.28, 0.035, top, top + 0.025), (i, t, L) => {
    BG[i] = C(GRAY, 1 + L * 0.2); return set(i, Math.abs(fract(HIT.u * 30) - 0.5) < 0.2 ? '|' : '=', C(WHITE, L * 0.8)), true; // the ladder
  });
}

// fences and shipping containers (solids, see props.js): how each kind's faces look
const CONTAINER_COL = [RED, BLUE, ORANGE, GREEN, GRAY, CYAN];
const SOLID_SHADE = {
  // a booth on the pier: candy-striped canvas, a lit sign over the counter, prizes hanging in the dark inside
  booth: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w, glow = Math.max(night, overcast * 0.6), stripe = c => C(fract(HIT.u * 7) < 0.5 ? o.awning : WHITE, c);
    if (f === 5) { BG[i] = stripe(3 + L * 0.3); return set(i, ' ', 0), true; }
    const front = (f === 3 || f === 4) && Math.sign(HIT.v) === o.fs;
    if (!front) { BG[i] = stripe((1.5 + L * 0.3) * shadeFace(f)); return set(i, w > 0.3 ? '~' : ' ', C(WHITE, L * 0.5)), true; }
    const q = (HIT.u * o.fs / o.hl + 1) / 2;
    if (w > 0.25) { // the sign
      BG[i] = C(o.awning, 3 + glow * 6);
      const n = o.word.length + 2, ch = signGlyph(o.word, q * n - 1, (0.33 - w) / 0.07, t, 2 * o.hl / n, 0.07, farDepth(rel(o.x - px), rel(o.y - py), o.hl));
      if (ch !== null && (ch !== ' ' || Math.abs(w - 0.295) < 0.035)) return set(i, ch, C(WHITE, 15)), true;
      return set(i, glow > 0.3 && Math.abs(w - 0.295) > 0.035 && fract(q * 14 - T * 2) < 0.3 ? '*' : ' ', C(YEL, 15)), true; // bulbs chasing round it
    }
    if (w > 0.11) { // the opening: what's on offer, in the dark behind the counter
      BG[i] = C(GRAY, 1 + glow * 2);
      const row = Math.floor((w - 0.11) / 0.045), col = Math.floor(q * 9);
      const ch = o.game === 'ringtoss' ? (row === 0 ? 'i' : ' ') : o.game === 'strength' ? (col === 4 ? '|' : ' ') : o.game === 'ducks' ? (row === 1 ? ' (o>'[mod(Math.floor(q * 28 - T * 3), 4)] : row === 0 ? '~' : ' ') : o.game === 'darts' ? (row >= 1 && row <= 2 ? (Math.floor(q * 18) + row) % 2 ? 'O' : ' ' : row === 0 ? (Math.floor(q * 18) % 2 ? '|' : ' ') : ' ') : o.stock ? (row === 0 ? 'o' : ' ') : row < 3 && (col + row) & 1 ? '@' : ' ';
      return set(i, ch, C(o.game === 'ringtoss' ? GREEN : o.game === 'ducks' ? (row === 0 ? CYAN : mod(Math.floor(q * 28 - T * 3), 4) === 3 ? ORANGE : YEL) : o.game === 'darts' ? (row === 0 ? GRAY : DART_COLS[(Math.floor(q * 18) + row * 3) % DART_COLS.length]) : o.stock ? ORANGE : ITEM_COL[(col + row * 3) & 7], Math.max(L, glow * 12))), true;
    }
    BG[i] = C(o.awning, 1.5 + L * 0.25); // the counter
    return set(i, w > 0.095 ? '=' : fract(q * 10) < 0.5 ? '|' : ' ', C(WHITE, L * 0.8)), true;
  },
  // the night market's stalls (props.js): by day a blue tarp's roped down over everything
  stall: o => (i, t, L) => { // the counter: planks along the front, the goods laid out on top
    const f = HIT.face, w = HIT.w;
    if (!nightMarketOpen(tod)) { BG[i] = C(BLUE, (1.4 + L * 0.3) * shadeFace(f)); return set(i, fract(HIT.u * 6 + w * 3) < 0.12 ? '\\' : ' ', C(GRAY, L * 0.7)), true; }
    if (f !== 5) { BG[i] = C(BRICK, (1.8 + L * 0.25) * shadeFace(f)); return set(i, w > 0.09 ? '=' : fract(HIT.u * 12) < 0.12 ? '|' : ' ', C(BRICK, Math.max(L, 7))), true; }
    BG[i] = C(WARM, 1.6 + night * 1.4); // a cloth on top, lit by the lanterns
    const u = HIT.u * 13, m = mod(Math.floor(u * 3), 3), back = HIT.v * -o.fs < 0, col = mod(Math.floor(u), 60);
    let ch = ' ', c = WHITE;
    if (o.k === 0) { ch = back ? '([=])'[mod(Math.floor(u * 5), 5)] : 'oO'[col & 1]; c = back ? WARM : WHITE; } // steamer baskets at the back, buns at the front
    else if (o.k === 1) { ch = back ? (col & 1 ? 'Y' : '|') : (col % 3 ? 'o' : '@'); c = back ? RED : col % 3 ? RED : YEL; } // tassels, knots, coins
    else if (o.k === 2) { ch = back ? '[#]'[m] : col % 3 === 1 ? (Math.sin(T * 2 + col) > 0.85 ? '*' : 'o') : col % 5 === 0 ? '?' : ' '; c = back ? ORANGE : col % 5 === 0 ? YEL : CYAN; } // boxes, glass jars
    else if (o.k === 3) { ch = back ? (col % 4 === 1 ? '(O)'[m] : ' ') : '#=='[m]; c = back ? (Math.sin(T * 1.5) > 0 ? CYAN : MAG) : col & 1 ? YEL : RED; } // a crystal ball at the back, tarot cards laid out
    else { ch = back ? '(~)'[m] : (col + Math.floor(T * 2)) % 3 ? '~' : '>'; c = back ? CYAN : (col + Math.floor(T * 2)) % 3 ? BLUE : ORANGE; } // bags of fish hung up, the tub with fish darting in it
    return set(i, ch, C(c, Math.max(L, 11))), true;
  },
  stallroof: o => (i, t, L) => { // the canopy: stripes, a scalloped valance along the front with the sign on it
    const f = HIT.face, w = HIT.w, q = (HIT.u * o.fs / o.hl + 1) / 2, stripe = c => C(fract(HIT.u * 9) < 0.5 ? o.canopy : YEL, c);
    if (!nightMarketOpen(tod)) { BG[i] = C(BLUE, (1.4 + L * 0.3) * shadeFace(f)); return set(i, w > 0.24 ? '~' : ' ', C(GRAY, L * 0.7)), true; }
    if (f === 5 || f === 6) { BG[i] = stripe(f === 5 ? 3 + L * 0.3 : 1.8 + night * 1.5); return set(i, ' ', 0), true; }
    const front = (f === 3 || f === 4) && Math.sign(HIT.v) === o.fs;
    if (!front) { BG[i] = stripe((1.4 + L * 0.3) * shadeFace(f)); return set(i, ' ', 0), true; }
    if (w < 0.215 && fract(q * 24) > 0.5) return false; // the scallops: you see past them
    BG[i] = C(o.canopy, 3.4 + night * 3);
    const n = o.word.length + 2, ch = signGlyph(o.word, q * n - 1, (0.255 - w) / 0.045, t, 2 * o.hl / n, 0.045, farDepth(rel(o.x - px), rel(o.y - py), o.hl));
    return ch !== null && ch !== ' ' ? (set(i, ch, C(YEL, 15)), true) : (set(i, ' ', 0), true);
  },
  stallpole: () => (i, t, L) => { BG[i] = C(GRAY, 1.5); return set(i, '|', C(GRAY, Math.max(L, 8))), true; },
  // construction hoarding: an orange-and-white striped top rail on posts, see-through between
  hoarding: () => (i, t, L) => {
    const w = HIT.w, u = HIT.u, f = HIT.face;
    if (w > 0.18 || f === 5) { BG[i] = C(fract(u * 4) < 0.5 ? ORANGE : WHITE, 3 + L * 0.3); return set(i, '=', C(GRAY, L * 0.4)), true; }
    if (Math.abs(fract(u * 2.2) - 0.5) > 0.42 || f === 1 || f === 2) return set(i, '|', C(GRAY, L)), true; // posts
    if (w < 0.03) return set(i, '_', C(ORANGE, L * 0.7)), true; // a kick board
    return false;
  },
  // a portapotty: blue ribbed plastic, a white roof, the door on its west end with a vent up top, a handle and the
  // little VACANT / OCCUPIED slot (red while you're in one... which you can't see from in there, but still)
  potty: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w, k = shadeFace(f);
    if (f === 5 || w > 0.22) { BG[i] = C(WHITE, (2.5 + L * 0.3) * k); return set(i, f === 5 ? ' ' : '_', C(GRAY, L * 0.6)), true; } // the roof
    BG[i] = C(BLUE, (1.6 + L * 0.35) * k);
    if (f === 2) { // the door
      const v = HIT.v;
      if (Math.abs(v) > 0.05) return set(i, '|', C(BLUE, L)), true; // the frame
      if (w > 0.19) return set(i, '=', C(GRAY, L * 0.8)), true; // the vent
      if (w > 0.13 && w < 0.145 && v > 0.01 && v < 0.04) { BG[i] = C(GREEN, 4); return set(i, ' ', 0), true; } // VACANT
      if (Math.abs(w - 0.11) < 0.008 && v > 0.025) return set(i, 'o', C(WHITE, L)), true; // the handle
      return set(i, fract(w * 60) < 0.12 ? '-' : ' ', C(BLUE, L * 0.8)), true;
    }
    return set(i, fract(HIT.u * 70 + HIT.v * 70) < 0.2 ? '|' : ' ', C(BLUE, L * 0.8)), true; // ribs
  },
  // chain-link: a top rail and posts, the mesh a lattice of x's you can see through
  chain: () => (i, t, L) => {
    const w = HIT.w, u = HIT.u;
    if (w > 0.185 || HIT.face === 5) return set(i, '-', C(GRAY, L)), true;
    if (Math.abs(fract(u * 0.8) - 0.5) > 0.47) return set(i, '|', C(GRAY, L * 1.1)), true;
    return fract(u * 14 + w * 14) < 0.22 || fract(u * 14 - w * 14) < 0.22 ? (set(i, 'x', C(GRAY, L * 0.7)), true) : false;
  },
  // a 40ft container: corrugated sides, doors with locking bars on the ends, a colour per box
  container: o => {
    const col = CONTAINER_COL[o.k % CONTAINER_COL.length];
    return (i, t, L) => {
      const f = HIT.face, k = shadeFace(f);
      BG[i] = C(col, (1.5 + L * 0.4) * k);
      if (f === 5) return set(i, fract(HIT.u * 8) < 0.15 ? '=' : ' ', C(col, L * 0.5)), true;
      if (HIT.w - o.z0 > 0.235 || HIT.w - o.z0 < 0.012) return set(i, '_', C(GRAY, L * 0.6)), true; // the frame
      if (f === 1 || f === 2) return set(i, Math.abs(HIT.v) < 0.006 ? '|' : fract(HIT.v * 40) < 0.2 ? '|' : ' ', C(GRAY, L * 0.8)), true; // doors and bars
      return set(i, fract(HIT.u * 30) < 0.5 ? '|' : ' ', C(col, L * 0.75)), true; // corrugation
    };
  },
};

// ---- lighthouse island
// the lighthouse, drawn as a billboard (it's round, so it looks the same from every side): a tapering tower in red
// and white bands with a door and slit windows, a railed gallery, the glazed lantern room with the lamp, a red dome.
// flare = how squarely a beam is pointing at you (the lamp blazes)
function lighthouseCell(i, u, z, du, dz, L, flare) {
  const au = Math.abs(u), lit = beamLit();
  if (z < 2.2) {
    const R = 0.24 - z * 0.035;
    if (au > Math.max(R, du / 2)) return false;
    const n = au / R, shade = 1 - 0.55 * n * n;
    if (z < 0.22 && au < 0.055) { BG[i] = C(GRAY, 1); return set(i, z > 0.19 ? '=' : '#', C(BRICK, L * 0.6)), true; } // the door
    if (au < Math.max(0.022, du / 2) && [0.75, 1.25, 1.75].some(w => Math.abs(z - w) < 0.06)) { BG[i] = C(GRAY, 1); return set(i, '#', C(WARM, Math.max(L * 0.3, lit * 9))), true; }
    BG[i] = C(Math.floor(z / 0.44) & 1 ? RED : WHITE, (1.5 + L * 0.5) * shade);
    return set(i, n > 0.85 ? '|' : ' ', C(GRAY, L * 0.5)), true;
  }
  if (z < 2.27) { if (au > 0.3) return false; BG[i] = C(GRAY, 2 + L * 0.2); return set(i, '=', C(WHITE, L)), true; } // the gallery
  if (z < 2.34 && au > 0.15) { // its railing
    if (au > 0.3) return false;
    return fract(u * 25) < 0.35 || z > 2.32 ? (set(i, z > 2.32 ? '-' : '|', C(WHITE, L * 0.9)), true) : false;
  }
  if (z < 2.62) { // the lantern room
    if (au > Math.max(0.15, du / 2)) return false;
    if (lit && au < 0.075 && Math.abs(z - LH_H) < 0.07) { BG[i] = C(YEL, 8 + flare * 7); return set(i, '@', C(WHITE, 15)), true; }
    BG[i] = C(CYAN, 1 + lit * 3); return set(i, fract(u * 14) < 0.2 ? '|' : ' ', C(GRAY, L * 0.8)), true;
  }
  const domeR = 0.17 * Math.sqrt(Math.max(0, 1 - ((z - 2.62) / 0.17) ** 2));
  if (z < 2.79 && au < Math.max(domeR, du / 2)) { BG[i] = C(RED, 2 + L * 0.35); return set(i, ' ', 0), true; }
  if (z < 2.88 && au < Math.max(0.01, du / 2)) return set(i, '|', C(GRAY, L)), true; // the vent and lightning rod
  return false;
}
// the beams: from the lamp out across the bay, a thin shaft of pale light drawn in characters that follow its slope
// on screen (- / \ |), brightest by the lamp and fading out over the water, stronger in rain and fog. Each sample
// along a beam covers the cells it spans (a little wider close up), in front of whatever is behind it.
// Returns how squarely a beam is pointing at you (the lamp flares).
function drawBeams(lx, ly) {
  const lit = beamLit();
  if (!lit) return 0;
  const haze = 0.55 + 0.45 * Math.max(fogAmt, rain), camAng = Math.atan2(-ly, -lx);
  const flare = clamp(1 - beamOff(camAng) / 0.3, 0, 1) * lit;
  for (const side of [0, Math.PI]) {
    const ang = beamAng() + side, cx = Math.cos(ang), cy = Math.sin(ang);
    let prev = null;
    for (let s = 0.3; s < BEAM_LEN; s += 0.12 + s * 0.02) {
      const vx = lx + cx * s, vy = ly + cy * s, depth = dx * vx + dy * vy;
      if (depth < 0.3 || depth > vis + 10) { prev = null; continue; }
      const sc = projX / depth, col = cols / 2 + (-dy * vx + dx * vy) * sc, row = hor - (LH_H - s * 0.012 - eye) * projY / depth;
      const slope = prev ? (row - prev[1]) / ((col - prev[0]) || 1e-6) * (FS / cw) : 0; // in screen units
      const ch = !prev ? '-' : Math.abs(slope) < 0.35 ? '-' : Math.abs(slope) > 2.5 ? '|' : slope < 0 ? '/' : '\\';
      prev = [col, row];
      const w = 0.025 + s * 0.008, rc = Math.min(2, w * sc), rr = Math.min(1, w * projY / depth);
      const I = lit * haze * (1 - s / BEAM_LEN) ** 1.2;
      for (let r = Math.max(0, Math.round(row - rr)); r <= Math.min(rows - 1, Math.round(row + rr)); r++)
        for (let c = Math.max(0, Math.round(col - rc)); c <= Math.min(cols - 1, Math.round(col + rc)); c++) {
          const i = r * cols + c;
          if (ZB[i] < depth) continue;
          const core = Math.abs(r - row) < 0.6 && Math.abs(c - col) < 0.6;
          set(i, core ? (I > 0.5 ? '=' : ch) : ch, C(YEL, 3 + I * (core ? 12 : 7)));
          if (core && s < 3) BG[i] = C(YEL, 2 + I * 4); // the glow right by the lamp
          FOGS[i] = 0;
        }
    }
  }
  return flare;
}
function islandSprites() {
  const [lx, ly] = R(LIGHTHOUSE.x, LIGHTHOUSE.y), D = Math.hypot(lx, ly);
  if (D > vis + BEAM_LEN) return;
  drawFootbridge();
  const flare = drawBeams(lx, ly);
  drawShape(lx, ly, 0, 0.32, 2.9, (i, u, z, du, dz, L) => lighthouseCell(i, u, z, du, dz, L, flare));
  if (flare > 0.05) { // the lamp, blazing straight at you
    const depth = dx * lx + dy * ly;
    if (depth > 0.3) {
      const sc = projX / depth, col = cols / 2 + (-dy * lx + dx * ly) * sc, row = hor - (LH_H - eye) * projY / depth, R_ = 1 + flare * 5;
      for (let r = Math.floor(row - R_ / 2); r <= row + R_ / 2; r++) for (let c = Math.floor(col - R_); c <= col + R_; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const i = r * cols + c, q = Math.hypot((c - col) / R_, (r - row) / (R_ / 2));
        if (q < 1 && ZB[i] >= depth - 0.5) BG[i] = C(YEL, 6 + flare * 9 * (1 - q));
      }
    }
  }
}
// the footbridge's handrails (posts and a top rail, see-through between) in 2-cell lengths, and a gateway at the
// shore end with the island's name across it
const FB_SIGN = 'LIGHTHOUSE';
function drawFootbridge() {
  const rail = (i, t, L) => HIT.w > 0.088 || HIT.face === 5 ? (set(i, '=', C(GRAY, L * 1.1)), true)
                          : fract(HIT.u * 5) < 0.2 ? (set(i, '|', C(GRAY, L * 0.9)), true) : false;
  for (let y = FOOTBRIDGE.y0; y < FOOTBRIDGE.y1; y += 2) {
    const len = Math.min(2, FOOTBRIDGE.y1 - y), [vx, vy] = R(FOOTBRIDGE.x, y + len / 2);
    if (Math.hypot(vx, vy) > vis + 1) continue;
    for (const s of [-1, 1]) drawBox(boxAt(vx + s * (FOOTBRIDGE.hw - 0.006), vy, 0, 1, len / 2, 0.006, 0, 0.1), rail);
  }
  const [gx, gy] = R(FOOTBRIDGE.x, FOOTBRIDGE.y0 + 0.15), hw = FOOTBRIDGE.hw + 0.02;
  if (Math.hypot(gx, gy) > vis) return;
  const iron = (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.1); return set(i, '|', C(GRAY, L)), true; };
  for (const s of [-1, 1]) drawBox(boxAt(gx + s * hw, gy, 1, 0, 0.012, 0.012, 0, 0.36), iron);
  drawBox(boxAt(gx, gy, 1, 0, hw + 0.012, 0.008, 0.3, 0.355), (i, t, L) => { // the sign, readable from both ends
    BG[i] = C(GRAY, 2 + night * 2);
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, '=', C(GRAY, L)), true;
    const n = FB_SIGN.length + 2, q = ((HIT.face === 3 ? HIT.u : -HIT.u) / (hw + 0.012) + 1) / 2 * n - 1;
    return set(i, signGlyph(FB_SIGN, q, (0.35 - HIT.w) / 0.045, t, 2 * (hw + 0.012) / n, 0.045, farDepth(gx, gy, hw)) || ' ', C(WHITE, Math.max(L * 1.2, night * 14))), true;
  });
}

// a vending machine: a lit header, a glass front with shelves of goods, a keypad and coin slot down the right,
// the flap you reach into at the bottom. Glows after dark.
const VM_COL = { DRINKS: RED, SNACKS: BLUE, CIGARETTES: GRAY };
const VM_GOODS = { DRINKS: ['o', [RED, BLUE, GREEN, YEL, WHITE]], SNACKS: ['#', [YEL, ORANGE, RED, GREEN, MAG]], CIGARETTES: ['=', [WHITE, RED, YEL, WHITE, CYAN]] };
function drawVending(m, vx, vy, sc = 1) { // sc: 10 indoors (metres, not cells)
  const body = VM_COL[m.kind], glow = Math.max(night, overcast * 0.6), [g_, cols_] = VM_GOODS[m.kind], HL = VM_HL * sc, HH = VM_H * sc;
  drawBox(boxAt(vx, vy, m.c, m.s, HL, VM_HW * sc, 0, HH), (i, t, L) => {
    const f = HIT.face, front = (f === 3 || f === 4) && Math.sign(HIT.v) === m.fs;
    if (!front) { BG[i] = C(body, (1.5 + L * 0.35) * shadeFace(f)); return set(i, f === 5 ? ' ' : HIT.w < 0.01 ? '_' : ' ', C(GRAY, L * 0.4)), true; }
    const q = (HIT.u * m.fs / HL + 1) / 2, z = HIT.w / HH; // across the front 0..1 (left to right), up it 0..1
    if (z > 0.85) { // the lit header, with what it sells across it
      BG[i] = C(body, 5 + glow * 7);
      const name = m.kind, n = name.length + 2, lq = q * n - 1, k = Math.floor(lq), cellU = t / projX / (2 * HL) * n;
      const letter = Math.abs(z - 0.925) < t / projY / HH / 2 && k >= 0 && k < name.length && (cellU > 0.6 || Math.abs(fract(lq) - 0.5) < cellU / 2);
      return set(i, letter ? name[k] : ' ', C(WHITE, 15)), true;
    }
    if (q > 0.72) { // the control column: keypad, coin slot
      BG[i] = C(GRAY, 2 + L * 0.1);
      return set(i, z > 0.55 && z < 0.72 ? ':' : z > 0.44 && z < 0.5 ? '-' : ' ', z > 0.5 ? C(WHITE, Math.max(L, glow * 11)) : C(YEL, 12)), true;
    }
    if (z < 0.17) { BG[i] = C(GRAY, 1); return set(i, z > 0.05 && z < 0.12 ? '_' : ' ', C(GRAY, L * 0.5)), true; } // the flap
    if (z < 0.22) { BG[i] = C(body, 1.5 + L * 0.35); return set(i, ' ', 0), true; }
    // the window: four shelves of goods behind glass
    const sz = (z - 0.22) / 0.63 * 4, row = Math.floor(sz), sq = q / 0.72 * 5, k = Math.floor(sq);
    BG[i] = C(CYAN, 1 + glow * 2.5);
    if (fract(sz) < 0.12) return set(i, '_', C(GRAY, Math.max(L * 0.7, glow * 8))), true; // the shelf
    const item = fract(sq) > 0.18 && fract(sq) < 0.82 && fract(sz) < 0.8; // each thing on it, glass between
    if (item) BG[i] = C(cols_[(k + row * 2) % 5], 2 + glow * 3);
    return set(i, item ? g_ : ' ', C(cols_[(k + row * 2) % 5], Math.max(L, glow * 13))), true;
  });
}

// a bench facing (fx, fy): seat, backrest, two legs; s scales it (0.01 outdoors in cells, 1 indoors in metres)
function drawBench(vx, vy, fx, fy, s) {
  const ax = -fy, ay = fx, wood = (i, t, L) => { BG[i] = C(BRICK, (1 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '=' : '-', C(BRICK, L * 0.8)), true; };
  drawBox(boxAt(vx, vy, ax, ay, 7.5 * s, 2 * s, 4 * s, 4.8 * s), wood); // seat
  drawBox(boxAt(vx - fx * 1.9 * s, vy - fy * 1.9 * s, ax, ay, 7.5 * s, 0.4 * s, 4.8 * s, 8.5 * s), wood); // back
  for (const e of [-6, 6]) drawBox(boxAt(vx + ax * e * s, vy + ay * e * s, ax, ay, 0.5 * s, 1.8 * s, 0, 4 * s), (i, t, L) => {
    BG[i] = C(GRAY, 1); return set(i, '|', C(GRAY, L * 0.7)), true;
  });
}

// a subway entrance in 3D: railings round a stairwell cut into the sidewalk (its treads are drawn by floorCell,
// see SUBWAY_HOLE), green globe lamps at the open end, and the station's name on a sign over the far railing
function drawStationEntrance(s, vx, vy) {
  const [hl, hw] = SUBWAY_HOLE, iron = (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, HIT.face === 5 ? '=' : '|', C(GREEN, L * 0.7)), true; };
  for (const side of [-1, 1]) drawBox(boxAt(vx, vy + side * hw, 1, 0, hl, 0.004, 0, 0.09), iron); // the long sides
  drawBox(boxAt(vx + hl, vy, 0, 1, hw, 0.004, 0, 0.09), iron); // the far end
  for (const side of [-1, 1]) { // the lamps either side of the way in
    drawBox(boxAt(vx - hl, vy + side * hw, 1, 0, 0.005, 0.005, 0, 0.13), iron);
    drawBox(boxAt(vx - hl, vy + side * hw, 1, 0, 0.014, 0.014, 0.13, 0.158), (i, t, L) => { BG[i] = C(GREEN, 6 + night * 7); return set(i, 'o', C(WHITE, 15)), true; });
  }
  const name = s.name; // the sign: one letter per cell across its face, so it never smears
  drawBox(boxAt(vx + hl, vy, 0, 1, hw, 0.006, 0.09, 0.125), (i, t, L) => {
    BG[i] = C(GREEN, 4 + night * 3);
    if (HIT.face !== 1 && HIT.face !== 2) return set(i, ' ', 0), true;
    const n = name.length + 2, q = (HIT.u / hw * (HIT.face === 1 ? 1 : -1) + 1) / 2 * n - 1;
    return set(i, signGlyph(name, q, (0.125 - HIT.w) / 0.035, t, 2 * hw / n, 0.035, farDepth(vx, vy, hl + hw)) || ' ', C(WHITE, 15)), true;
  });
  // and a tall lit blade on a post at two corners, SUBWAY down both faces and a green lamp on top: seen from down the
  // block either way
  for (const e of [-1, 1]) subwayBlade(vx + e * (hl + 0.02), vy - e * (hw + 0.025), iron);
}
function subwayBlade(tx, ty, iron) {
  const Z0 = 0.13, Z1 = 0.33, word = 'SUBWAY', lit = 9 + night * 6;
  drawBox(boxAt(tx, ty, 1, 0, 0.005, 0.005, 0, Z0), iron);
  drawBox(boxAt(tx, ty, 0, 1, 0.022, 0.006, Z0, Z1), (i, t, L) => {
    BG[i] = C(GREEN, 5 + night * 4);
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, '|', C(GREEN, lit)), true; // its edges (3 / 4: the broad faces)
    // one letter per cell: in the middle row of its span and the middle column across the blade
    const q = (Z1 - HIT.w) / (Z1 - Z0) * word.length, k = Math.floor(q), lh = (Z1 - Z0) / word.length;
    if (k >= 0 && k < word.length && signIsBig(0.044 * 0.8, lh * 0.8, farDepth(tx, ty, 0.03))) { // close: each letter in blocks, stacked down the blade
      const gx = Math.floor((HIT.u / 0.044 + 0.5 - 0.1) / 0.8 * 3), gy = Math.floor((fract(q) - 0.1) / 0.8 * 5);
      return set(i, glyphOn(word[k], gx, gy) ? '#' : ' ', C(WHITE, 15)), true;
    }
    const cellV = t / projY / lh, cellU = t / projX / 0.044;
    const mid = (cellV > 0.6 || Math.abs(fract(q) - 0.5) < cellV / 2) && (cellU > 0.6 || Math.abs(HIT.u) / 0.044 < cellU / 2);
    return set(i, k >= 0 && k < word.length && mid ? word[k] : ' ', C(WHITE, 15)), true;
  });
  drawBox(boxAt(tx, ty, 1, 0, 0.012, 0.012, Z1, Z1 + 0.024), (i, t, L) => { BG[i] = C(GREEN, 7 + night * 7); return set(i, 'O', C(WHITE, 15)), true; });
}

// the radio mast: 160m of red and white lattice, tapering in sections. Each section is four corner legs (thickened
// with distance so they never break up) and see-through faces with X bracing and a girder along the bottom; red lamps
// blink at every other joint and on the very top
const RADIO_H = 16, RADIO_SEC = 8, radioHalf = z => 0.9 - 0.78 * z / RADIO_H;
function drawRadioTower(vx, vy) {
  const d = Math.hypot(vx, vy), leg = Math.max(0.03, 0.6 * d / projX), sh = RADIO_H / RADIO_SEC;
  for (let k = 0; k < RADIO_SEC; k++) {
    const z0 = k * sh, z1 = z0 + sh, h0 = radioHalf(z0), h1 = radioHalf(z1), hs = (h0 + h1) / 2, col = k & 1 ? WHITE : RED;
    for (let q = 0; q < 4; q++) { // the legs, stepped in a little every quarter section: the taper
      const q0 = z0 + q * sh / 4, hq = radioHalf(q0 + sh / 8);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        drawBox(boxAt(vx + sx * hq, vy + sy * hq, 1, 0, leg, leg, q0, q0 + sh / 4), (i, t, L) => set(i, HIT.face > 4 ? '=' : '#', C(col, Math.max(L, 6))) || true);
    }
    drawBox(boxAt(vx, vy, 1, 0, hs, hs, z0, z1), (i, t, L) => { // the bracing on its faces; the gaps show what's behind
      if (HIT.face > 4) return false;
      const s = (HIT.face < 3 ? HIT.v : HIT.u) / hs, h = (HIT.w - z0) / sh * 2 - 1, cell = t / projX / hs * 1.2; // s, h: -1..1 across, up
      if (h < -1 + cell * 0.6) return set(i, '=', C(col, Math.max(L, 5))), true;
      if (Math.abs(s - h) < cell) return set(i, '/', C(col, Math.max(L * 0.9, 4))), true;
      if (Math.abs(s + h) < cell) return set(i, '\\', C(col, Math.max(L * 0.9, 4))), true;
      return false;
    });
    if (k & 1) for (const [sx, sy] of [[-1, -1], [1, 1]]) drawBox(boxAt(vx + sx * h1, vy + sy * h1, 1, 0, leg * 1.4, leg * 1.4, z1 - leg * 2, z1 + leg), (i, t, L) =>
      (BG[i] = C(RED, fract(T * 0.7 + k * 0.1) < 0.5 ? 6 : 0), set(i, '*', C(RED, fract(T * 0.7 + k * 0.1) < 0.5 ? 15 : 4)), true));
  }
  drawBox(boxAt(vx, vy, 1, 0, leg, leg, RADIO_H, RADIO_H + 1.2), (i, t, L) => set(i, '|', C(WHITE, Math.max(L, 6))) || true); // the aerial
  drawBox(boxAt(vx, vy, 1, 0, leg * 2, leg * 2, RADIO_H + 1.2, RADIO_H + 1.2 + leg * 3), (i, t, L) =>
    (BG[i] = C(RED, fract(T * 0.7) < 0.5 ? 8 : 0), set(i, '*', C(RED, fract(T * 0.7) < 0.5 ? 15 : 4)), true));
}
// chinatown lanterns: a cord sagging across the street (short box segments) with red paper lanterns hanging off it,
// glowing after dark. Real 3D, so it stays put across the street as you walk round it.
const sagZ = t => 0.5 - 0.06 * (1 - t * t); // t: -1..1 across the street
function drawLanternString(vx, vy, ax, ay) {
  // the cord is thinner than a character cell past a few metres, so it grows to stay one cell thick (a grey dashed
  // line) instead of breaking up into the odd cell the rays happen to hit
  const d = Math.hypot(vx, vy), th = Math.max(0.004, 0.55 * d / projY), tw = Math.max(0.004, 0.55 * d / projX), far = th > 0.01;
  const segs = 8, cord = (i, t, L) => { if (!far) BG[i] = C(GRAY, 1); return set(i, '-', C(GRAY, L * 0.7)), true; };
  for (let k = 0; k < segs; k++) {
    const t0 = -1 + 2 * k / segs, t1 = t0 + 2 / segs, tm = (t0 + t1) / 2, z = (sagZ(t0) + sagZ(t1)) / 2;
    drawBox(boxAt(vx + ax * tm * LANTERN_SPAN, vy + ay * tm * LANTERN_SPAN, ax, ay, LANTERN_SPAN / segs + 0.003, tw, z - th, z + th), cord);
  }
  const lit = Math.max(night, overcast * 0.6);
  for (const t of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const z = sagZ(t), gold = t === 0;
    const lw = Math.max(0.018, tw); // at a distance a lantern stays at least a cell wide too
    drawBox(boxAt(vx + ax * t * LANTERN_SPAN, vy + ay * t * LANTERN_SPAN, ax, ay, lw, lw, z - 0.05, z - 0.006), (i, tt, L) => {
      const cap = HIT.w > z - 0.014 || HIT.w < z - 0.042;
      BG[i] = cap ? C(GRAY, 2) : C(gold ? YEL : RED, 3 + lit * 9 + L * 0.2);
      return set(i, cap ? '=' : lit > 0.3 ? 'o' : ' ', C(YEL, 15)), true;
    });
  }
}

// a factory smokestack: banded brick, red and white at the top, smoke curling off downwind
function stackCell(i, u, z, du, dz, L, s) {
  const H = s.H, w = 0.16 - z / H * 0.05;
  if (z < H && Math.abs(u) < Math.max(w, du / 2)) {
    BG[i] = bgAt(BRICK, day * 2);
    if (z > H - 0.5) return set(i, '=', C(fract(z * 4) < 0.5 ? RED : WHITE, L)), true;
    return set(i, fract(z * 6) < 0.15 ? '=' : '#', C(BRICK, L * 0.9)), true;
  }
  const sz = z - H, cu = u - sz * 0.6 - Math.sin(T * 0.3 + s.x) * 0.1 * sz; // drifts downwind as it rises
  if (sz > 0 && sz < 2 && Math.abs(cu) < 0.15 + sz * 0.25) {
    const n = noise(cu * 4 + T * 0.2, sz * 3 - T * 0.6, 57 + s.x);
    if (n > 0.45 + sz * 0.15) { BG[i] = C(GRAY, (2 + n * 6) * (0.4 + 0.6 * amb) * (1 - sz / 2.2)); return set(i, ' ', 0), true; }
  }
  return false;
}

// the suspension bridges: towers (drawn across the deck, foreshortened when seen from the side), cables as a chain of
// points that light up at night, and the hangers down to the deck
function bridgeSprites() {
  for (const t of towers) {
    const [vx, vy] = R(t.x, t.y);
    if (Math.abs(vx) > vis + 2 || Math.abs(vy) > vis + 2) continue;
    const hw = 0.95 * Math.abs(across(1, 0, vx, vy)) + 0.12;
    drawShape(vx, vy, 0, hw + 0.15, TOWER_H + 0.5, (i, u, z, du, dz, L) => towerCell(i, u, z, du, dz, L, hw));
  }
  forNear(bridgeB, b => {
    const [vx, vy] = R(b.x, b.y);
    if (b.kind === 'hanger') return drawArt(vx, vy, b.z, 0.02, b.h, ['|'], (c, row, L) => C(GRAY, L * 0.7));
    drawArt(vx, vy, b.z - 0.03, 0.06, 0.06, [night > 0.4 ? '*' : '.'], (c, row, L) => night > 0.4 ? C(WARM, 13) : C(GRAY, L * 1.2));
  });
}
function towerCell(i, u, z, du, dz, L, hw) {
  const leg = Math.abs(Math.abs(u) - hw) < Math.max(0.1, du / 2);
  if (z > TOWER_H + 0.35 && Math.abs(Math.abs(u) - hw) < du && night > 0.3) return set(i, '*', C(RED, fract(T * 0.7) < 0.5 ? 15 : 4)), true;
  if (leg && z < TOWER_H + 0.4) { BG[i] = bgAt(GRAY, day * 3); return set(i, fract(z * 3) < 0.1 ? '=' : '|', C(GRAY, L * 1.1)), true; }
  if (Math.abs(u) < hw && [1.2, 4, TOWER_H].some(b => Math.abs(z - b) < Math.max(0.12, dz / 2)))
    return set(i, Math.abs(z - TOWER_H) < 0.12 ? '#' : '=', C(GRAY, L)), true;
  return false;
}

// one el car as a real box running east-west: steel sides with a red stripe, a band of windows (lit warm after dark),
// a pair of doors each side, a driver's cab with headlights at the leading and trailing ends (cab: +1 / -1 = which
// end, 0 = none), an air-conditioning hump on the roof and a dark underframe
const EL_HL = EL_CAR_LEN / 2 - 0.03, EL_HW = 0.14, EL_H = 0.32;
function drawElCar(vx, vy, cab) {
  const z0 = EL_TOP + 0.02, lit = Math.max(night, overcast * 0.6);
  drawBox(boxAt(vx, vy, 1, 0, EL_HL, EL_HW, z0, z0 + EL_H), (i, t, L) => {
    const f = HIT.face, u = HIT.u, w = HIT.w - z0, k = shadeFace(f);
    BG[i] = C(GRAY, (2 + L * 0.5) * k);
    if (f === 6) return set(i, ' ', 0), true;
    if (w < 0.04) { BG[i] = C(GRAY, 1); return set(i, '=', C(GRAY, L * 0.4)), true; } // the underframe
    if (f === 5) return set(i, Math.abs(u) < 0.25 ? '#' : fract(u * 6) < 0.1 ? '|' : ' ', C(GRAY, L * 0.8)), true; // roof, ribs, the AC unit
    if (f === 1 || f === 2) { // the ends: a cab with windscreen and lamps, or the gangway to the next car
      const end = (f === 1 ? 1 : -1) === cab, v = Math.abs(HIT.v);
      if (end && w > 0.17 && w < 0.27 && v < EL_HW * 0.85) { BG[i] = C(CYAN, 1 + L * 0.15); return set(i, ' ', 0), true; }
      if (end && w > 0.07 && w < 0.11 && v > EL_HW * 0.55) return set(i, 'O', C(f === 1 ? WHITE : RED, 15)), true;
      if (!end && v < 0.06 && w < 0.27) { BG[i] = C(GRAY, 1); return set(i, '|', C(GRAY, L * 0.5)), true; }
      return set(i, w > 0.12 && w < 0.14 ? '=' : ' ', C(RED, L)), true;
    }
    // the sides
    const door = [-0.45, 0.45].some(d => Math.abs(u - d * EL_HL) < 0.09);
    if (door && w > 0.05 && w < 0.29) { BG[i] = C(GRAY, (3 + L * 0.5) * k); return set(i, Math.abs(fract((u + 1) * 11) - 0.5) < 0.1 ? '|' : w > 0.18 && w < 0.26 ? '#' : ' ', w > 0.18 ? C(WARM, Math.max(L * 0.5, lit * 13)) : C(GRAY, L * 0.6)), true; }
    if (w > 0.12 && w < 0.14) return set(i, '=', C(RED, Math.max(L, 6))), true; // the stripe
    if (w > 0.17 && w < 0.27 && Math.abs(u) < EL_HL - 0.06) { // the windows
      const pane = fract(u * 4) < 0.12;
      if (pane) return set(i, '|', C(GRAY, L)), true;
      BG[i] = lit > 0.3 ? C(WARM, 3 + lit * 6) : C(CYAN, 1 + L * 0.15);
      return set(i, lit > 0.3 && hash(Math.floor(u * 4 + vx), 1, 9) > 0.6 ? 'o' : ' ', C(SKIN, 8)), true; // the odd passenger
    }
    return set(i, ' ', 0), true;
  });
}
// the el: pillars, stairs at the stations, and the trains (cars drawn one by one, so they foreshorten properly)
function elSprites() {
  forNear(elPillarsB, p => drawArt(...R(p.x, p.y), 0, 0.09, EL_BOT, PILLAR, (c, row, L) => C(GRAY, L * 0.9)));
  for (const s of EL_STATIONS) for (const y of [EL_Y + 0.14, EL_Y + 1.86])
    drawArt(...R(s.x, y), 0, 0.22, EL_BOT - 0.02, EL_STAIRS, (c, row, L) => row === 0 ? C(GREEN, Math.max(L, 12)) : C(GRAY, L));
  for (const t of elTrains(T)) {
    if (mode === 'el' && ride && ride.tr === t.tr && ride.k === t.k) continue; // the one you're on
    for (let j = 0; j < EL_CARS; j++) {
      const [vx, vy] = R(t.x - t.dir * (j - 1) * EL_CAR_LEN, EL_TRACK[t.tr]);
      if (Math.abs(vx) > vis + 2 || Math.abs(vy) > vis + 2) continue;
      drawElCar(vx, vy, j === 0 ? t.dir : j === EL_CARS - 1 ? -t.dir : 0);
    }
  }
}

// ===== the Sunset Pier: the Ferris wheel, the carousel, and the arch over the way in
// the wheel is a billboard turned to its real angle: sq = how face-on it is (its east-west axis across the screen),
// so from the side it narrows to an ellipse and then a line. Cars are real-sized whatever the angle.
const WHEEL_GAP = 0.12; // half the gap between its two rims
// riding the carousel: the mirrored drum in the middle, the striped canopy overhead, the other horses round you on
// their poles (going round with you, so they hold still), as real things rather than the picture you see from outside
function carouselInside(cx, cy) {
  const rot = TAU * T / CAROUSEL.rev, lit = night > 0.25 || overcast > 0.6, r = CAROUSEL.r;
  drawBox(boxAt(cx, cy, Math.cos(rot), Math.sin(rot), 0.065, 0.065, 0.04, 0.33), (i, t, L) => { // the drum
    BG[i] = C(CYAN, 1 + (lit ? 3 : 1)); return set(i, fract(HIT.w * 30 + T) < 0.2 ? '*' : ':', C(WHITE, Math.max(L, lit ? 12 : 6))), true;
  });
  drawBox(boxAt(cx, cy, Math.cos(rot), Math.sin(rot), r, r, 0.33, 0.36), (i, t, L) => { // the canopy, from underneath: stripes out from the middle
    const ang = Math.atan2(HIT.v, HIT.u), d = Math.hypot(HIT.u, HIT.v);
    if (d > r) return false;
    BG[i] = C(Math.floor(ang / (TAU / 16)) & 1 ? RED : WHITE, 2.5 + L * 0.25);
    return set(i, d > r - 0.04 ? (lit && fract(ang * 6 + T) < 0.4 ? '*' : 'v') : ' ', C(YEL, lit ? 15 : L)), true;
  });
  const me_ = Math.atan2(rel(py - CAROUSEL.y), rel(px - CAROUSEL.x));
  for (let j = 0; j < 8; j++) {
    const ps = me_ + (j + 0.5) * TAU / 8; // (yours is the gap behind you)
    const hx = cx + 0.42 * Math.cos(ps), hy = cy + 0.42 * Math.sin(ps), hz = 0.14 + 0.04 * Math.sin(ps * 2 + T * 4), col = [WHITE, YEL, BRICK, WHITE, MAG, YEL, BRICK, CYAN][j];
    drawBox(boxAt(hx, hy, 1, 0, 0.005, 0.005, 0.04, 0.33), (i, t, L) => (set(i, '|', C(YEL, Math.max(L, 9))), true)); // its brass pole
    const tx = -Math.sin(ps), ty = Math.cos(ps); // the way it's going
    drawBox(boxAt(hx, hy, tx, ty, 0.06, 0.018, hz - 0.02, hz + 0.02), solidHorse(col)); // the body
    drawBox(boxAt(hx + tx * 0.06, hy + ty * 0.06, tx, ty, 0.015, 0.012, hz + 0.01, hz + 0.06), solidHorse(col)); // the neck and head
    for (const e of [-1, 1]) drawBox(boxAt(hx + tx * 0.04 * e, hy + ty * 0.04 * e, tx, ty, 0.006, 0.006, hz - 0.07, hz - 0.02), solidHorse(col)); // legs
  }
}
const solidHorse = col => (i, t, L) => { BG[i] = C(col, (1.4 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '~' : ' ', C(YEL, L)), true; };
function wheelCell(i, u, z, du, dz, L, sq, side = 1) {
  const R = WHEEL.R, hub = WHEEL.hub, as = Math.max(Math.abs(sq), 0.05), U = u / (sq < 0 ? -as : as), Zc = z - hub;
  const tolU = du / as / 2, tol = Math.max(tolU, dz / 2), lit = night > 0.25 || overcast > 0.6;
  if (side < 0) L *= 0.65; // (the far rim, in the shadow of the near one)
  const rr = Math.hypot(U, Zc), ang = Math.atan2(Zc, U);
  if (rr < 0.13) return set(i, '@', C(WHITE, L * 1.2)), true; // the hub
  if (side > 0 && z < 0.05 && Math.abs(u) < 1.1 * as + 0.15) return set(i, '=', C(BRICK, L)), true; // the platform
  for (const side of [-1, 1]) { // the A-frame legs, hub to deck
    const lu = side * 0.95 * (hub - z) / hub;
    if (z < hub && Math.abs(U - lu) < Math.max(tolU, dz * 0.95 / hub / 2) * 1.2) return set(i, side * Math.sign(sq || 1) < 0 ? '/' : '\\', C(GRAY, L * 1.15)), true;
  }
  if (Math.abs(rr - R) < tol * 1.2) { // the rim, strung with bulbs that chase round after dark
    const on = lit && fract(ang * 24 / TAU - T * 1.5) < 0.5;
    return set(i, on ? '*' : 'o', on ? C([YEL, MAG, CYAN, RED][Math.floor(ang * 24 / TAU - T * 1.5) & 3], 15) : C(WHITE, L)), true;
  }
  if (Math.abs(rr - R * 0.55) < tol) return set(i, '.', C(GRAY, L)), true; // an inner ring
  if (rr < R) { // spokes
    const th = TAU * T / WHEEL.rev;
    for (let j = 0; j < 16; j++) {
      const sa = th + j * TAU / 16, d = ang - sa;
      if (Math.cos(d) > 0 && Math.abs(rr * Math.sin(d)) < tol) {
        const sx = Math.cos(sa) * as, sy = Math.sin(sa), slope = Math.abs(sy / (sx || 1e-6));
        return set(i, slope > 2.5 ? '|' : slope < 0.4 ? '-' : (sx > 0) === (sy > 0) === (sq > 0) ? '/' : '\\', lit ? C(WHITE, Math.max(L, 9)) : C(GRAY, L)), true;
      }
    }
  }
  return false;
}
// the carousel: a striped canopy with a scalloped edge of bulbs, a mirrored drum in the middle, horses going round
// and up and down on their poles. Round, so it looks the same from anywhere: drawn as a billboard.
function carouselCell(i, u, z, du, dz, L, s) {
  const r = CAROUSEL.r, rot = TAU * T / CAROUSEL.rev, lit = night > 0.25 || overcast > 0.6;
  if (z > 0.5 || Math.abs(u) > r + 0.03) return false;
  if (z > 0.33) { // the canopy, coming to a point
    const w = r * (1 - (z - 0.33) / 0.17) + 0.03;
    if (Math.abs(u) > w) return false;
    const a = Math.asin(clamp(u / w, -1, 1)) + rot;
    BG[i] = C(Math.floor(a / (TAU / 16)) & 1 ? RED : WHITE, 3 + L * 0.3);
    return set(i, z > 0.48 ? '^' : ' ', C(YEL, 15)), true;
  }
  if (z > 0.3) { // the valance: scallops, a bulb in each
    BG[i] = C(YEL, 2 + L * 0.2);
    return set(i, lit && fract(u * 12 + T) < 0.4 ? '*' : 'v', lit ? C(YEL, 15) : C(YEL, L)), true;
  }
  if (z < 0.04) return set(i, '=', C(BRICK, L)), true; // the turntable
  if (Math.abs(u) < 0.1) { BG[i] = C(CYAN, 1 + (lit ? 3 : 1)); return set(i, fract(z * 30 + T) < 0.2 ? '*' : ':', C(WHITE, Math.max(L, lit ? 12 : 0))), true; } // the drum
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j < 8; j++) { // the near horses first, then the far ones
    const ps = rot + j * TAU / 8, front = Math.cos(ps) > 0;
    if (front !== (pass === 0)) continue;
    const hu = 0.42 * Math.sin(ps), hz = 0.14 + 0.04 * Math.sin(ps * 2 + T * 4), dim = front ? 1 : 0.55;
    const col = [WHITE, YEL, BRICK, WHITE, MAG, YEL, BRICK, CYAN][j], dir = front ? 1 : -1;
    if (onLine(u - hu, du, 0, 0) && z > 0.04) return set(i, '|', C(YEL, L * dim)), true; // the brass pole
    if (Math.abs(z - hz) < 0.025 && Math.abs(u - hu) < 0.06) return set(i, '=', C(col, L * dim)), true; // body
    if (Math.abs(z - hz - 0.04) < 0.02 && Math.abs(u - hu - dir * 0.06) < 0.025) return set(i, dir > 0 ? '>' : '<', C(col, L * dim)), true; // head
    if (Math.abs(z - hz + 0.045) < 0.02 && Math.abs(Math.abs(u - hu) - 0.04) < 0.015) return set(i, '/', C(col, L * dim * 0.8)), true; // legs
  }
  return false;
}
const FAIR_SIGN = 'SUNSET PIER';
function fairSprites() {
  const [wx, wy] = R(WHEEL.x, WHEEL.y);
  if (Math.hypot(wx, wy) < vis + 4) { // two rims a few metres apart (the far one dimmer), the axle between, the cars hanging in 3D
    for (const side of [1, -1]) {
      const vy = wy + side * WHEEL_GAP, sq = across(1, 0, wx, vy), hw = (WHEEL.R + 0.15) * Math.max(Math.abs(sq), 0.06) + 0.12;
      drawShape(wx, vy, 0, hw, WHEEL.hub + WHEEL.R + 0.1, (i, u, z, du, dz, L) => wheelCell(i, u, z, du, dz, L, sq, side));
    }
    drawBox(boxAt(wx, wy, 0, 1, WHEEL_GAP + 0.03, 0.05, WHEEL.hub - 0.05, WHEEL.hub + 0.05), (i, t, L) => { BG[i] = C(GRAY, 2 + L * 0.3); return set(i, '=', C(WHITE, L)), true; });
    const lit = night > 0.25 || overcast > 0.6;
    for (let k = 0; k < WHEEL.n; k++) {
      if (fairRide && fairRide.kind === 'wheel' && fairRide.k === k) continue; // (you're in this one)
      const ph = wheelAngle(k, T), gx = wx + WHEEL.R * Math.cos(ph), gz = WHEEL.hub + WHEEL.R * Math.sin(ph), col = [RED, YEL, CYAN, MAG, GREEN, ORANGE][k % 6];
      drawBox(boxAt(gx, wy, 1, 0, 0.004, 0.004, gz - 0.06, gz), STEEL.pole); // its hanger
      drawBox(boxAt(gx, wy, 1, 0, 0.1, WHEEL_GAP - 0.03, gz - 0.24, gz - 0.06), (i, t, L) => { // the gondola: a roof, windows round the middle, a solid floor
        const w = (gz - 0.06 - HIT.w) / 0.18, f = HIT.face;
        BG[i] = C(col, (1.5 + L * 0.35) * shadeFace(f));
        if (f === 5 || w < 0.15) return set(i, '_', C(col, L)), true;
        if (w < 0.6 && f !== 6) { BG[i] = lit ? C(WARM, 3 + night * 5) : C(CYAN, 1 + L * 0.15); return set(i, Math.abs(fract((f <= 2 ? HIT.v : HIT.u) * 12) - 0.5) < 0.1 ? '|' : ' ', C(col, L)), true; }
        return set(i, w > 0.9 ? '=' : ' ', C(col, L)), true;
      });
    }
  }
  const [cx, cy] = R(CAROUSEL.x, CAROUSEL.y);
  if (fairRide && fairRide.kind === 'carousel') carouselInside(cx, cy); // on it: built round you, not a picture
  else if (Math.hypot(cx, cy) < vis) drawShape(cx, cy, 0, CAROUSEL.r + 0.04, 0.52, carouselCell);
  // the arch over the way in, its name in bulbs
  const [gx, gy] = R(FAIR.cx, FAIR.y0 + 0.2), hw = 1.3;
  if (Math.hypot(gx, gy) > vis) return;
  const post = (i, t, L) => { BG[i] = C(RED, 2 + L * 0.2); return set(i, '|', C(WHITE, L)), true; };
  for (const sd of [-1, 1]) drawBox(boxAt(gx + sd * hw, gy, 1, 0, 0.03, 0.03, 0, 0.5), post);
  drawBox(boxAt(gx, gy, 1, 0, hw + 0.03, 0.01, 0.42, 0.52), (i, t, L) => {
    const glow = Math.max(night, overcast * 0.6);
    BG[i] = C(RED, 2 + glow * 4);
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, '=', C(YEL, L)), true;
    const n = FAIR_SIGN.length + 2, q = ((HIT.face === 3 ? HIT.u : -HIT.u) / (hw + 0.03) + 1) / 2 * n - 1;
    const ch = signGlyph(FAIR_SIGN, q, (0.51 - HIT.w) / 0.08, t, 2 * (hw + 0.03) / n, 0.08, farDepth(gx, gy, hw));
    if (ch !== null && (ch !== ' ' || Math.abs(HIT.w - 0.47) < 0.03)) return set(i, ch, C(YEL, 15)), true;
    return set(i, glow > 0.3 && Math.abs(HIT.w - 0.47) > 0.03 && fract(q * 0.5 - T * 2) < 0.25 ? '*' : ' ', C(WHITE, 15)), true; // (bulbs above and below the letters)
  });
}
