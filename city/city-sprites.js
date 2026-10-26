// ===== city sprites: everything drawn over the raycast scene, nearest-first order doesn't matter (drawArt depth-tests)
// visit the props in the blocks within draw distance
function forNear(b, fn) {
  const r = Math.ceil(vis / 8) + 1, cx = Math.floor(px / 8), cy = Math.floor(py / 8);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) for (const it of b[bi(cx + i, cy + j)]) fn(it);
}
const R = (x, y) => [rel(x - px), rel(y - py)];
// could anything within r of (vx, vy) (camera-relative) be on screen? Behind you, past the draw distance or off to
// the side of the view, no: a model checks this before building itself, so it costs nothing when it can't be seen
const inView = (vx, vy, r) => { const d = dx * vx + dy * vy; return d > -r && d < vis + r && Math.abs(-dy * vx + dx * vy) - r <= (Math.max(d, 0) + r) * tf; };
// how much a world direction (ax, ay) lies across our view of a point at (vx, vy): +1 = pointing right on screen
const across = (ax, ay, vx, vy) => { const n = Math.hypot(vx, vy) || 1; return (ax * -vy + ay * vx) / n; };
let siren = null; // the emergency vehicle in sight, if any: floorCell washes its lights over the street
// the light bar's strobe: a double flash of red, a double flash of blue, dark in between. RED, BLUE or -1 (dark)
function strobe() { const p = Math.floor(fract(T * 1.4) * 10); return p === 0 || p === 2 ? RED : p === 5 || p === 7 ? BLUE : -1; }

// ---- trees: a solid canopy you can't see the sky through (shaded lighter on top, ragged at the edges), on a trunk.
// Sizes for a tree of s = 1, in cells: [half width, height]
const TREE_SIZE = { oak: [0.27, 0.62], blossom: [0.27, 0.6], pine: [0.21, 0.8], birch: [0.16, 0.68], poplar: [0.12, 0.82] };
const TREE_BLOBS = { oak: [[0, 0.44, 0.17], [-0.13, 0.33, 0.13], [0.13, 0.34, 0.13], [0, 0.29, 0.13]], blossom: [[0, 0.42, 0.16], [-0.13, 0.33, 0.13], [0.13, 0.32, 0.12], [0, 0.27, 0.12]],
  birch: [[0, 0.47, 0.13], [-0.04, 0.36, 0.1], [0.04, 0.56, 0.08]], poplar: [[0, 0.5, 0.11], [0, 0.34, 0.1], [0, 0.66, 0.08]] };
const TREE_WINTER_BRANCHES = Object.fromEntries(['oak', 'blossom', 'birch', 'poplar'].map(kind => {
  const [hw, h] = TREE_SIZE[kind], limbs = [[0, 0, 0.012, h * 0.95, 1.8]];
  for (let j = 0; j < 7; j++) {
    const sign = j & 1 ? 1 : -1, z = h * (0.28 + j * 0.078), reach = hw * (0.94 - j * 0.065);
    const x = sign * reach, tip = Math.min(h * 0.94, z + h * 0.24), midx = x * 0.56, midz = z + (tip - z) * 0.4;
    limbs.push([0.012 * z / h, z, midx, midz, 1], [midx, midz, x, tip, 0.65]);
    limbs.push([midx, midz, midx + sign * reach * 0.12, Math.min(h * 0.98, tip + h * 0.09), 0.42]);
    const forkX = midx + (x - midx) * 0.65, forkZ = midz + (tip - midz) * 0.65;
    limbs.push([forkX, forkZ, x * 0.7, Math.min(h * 0.98, tip + h * 0.05), 0.3]);
    limbs.push([forkX, forkZ, x * 1.04, Math.min(h * 0.98, tip + h * 0.025), 0.3]);
  }
  return [kind, limbs];
}));
const WINTER_BRANCH_PAD = 0.025, WINTER_BRANCH_ROWS = 16;
const TREE_WINTER_ROWS = Object.fromEntries(Object.keys(TREE_WINTER_BRANCHES).map(kind => {
  const height = TREE_SIZE[kind][1];
  return [kind, Array.from({ length: WINTER_BRANCH_ROWS }, (_, row) => {
    const z0 = row * height / WINTER_BRANCH_ROWS - WINTER_BRANCH_PAD, z1 = (row + 1) * height / WINTER_BRANCH_ROWS + WINTER_BRANCH_PAD;
    return TREE_WINTER_BRANCHES[kind].map((b, id) => b[1] <= z1 && b[3] >= z0 ? id : -1).filter(id => id >= 0);
  })];
}));
function winterTreeBranches(t) {
  if (t.winterBranches) return t.winterBranches;
  const warp = 0.92 + t.seed * 0.16;
  t.winterBranches = TREE_WINTER_BRANCHES[t.kind].map(([ax,z0,bx,z1,thickness]) => {
    const x0 = ax * warp, x1 = bx * warp, du = x1 - x0, dz = z1 - z0;
    return { x0, z0, x1, z1, du, dz, length2: du * du + dz * dz, thickness,
      minX: Math.min(x0,x1), maxX: Math.max(x0,x1), slope: dz / (du || 0.0001) };
  });
  return t.winterBranches;
}
function drawTree(t, vx, vy) {
  const [hw, h] = TREE_SIZE[t.kind], s = t.s;
  drawShape(vx, vy, terrainHeight(t.x, t.y), hw * s, h * s, (i, u, z, du, dz, L) => treeCell(i, u / s, z / s, du / s, dz / s, L, t));
}
function treeCell(i, u, z, du, dz, L, t) {
  const k = t.kind, au = Math.abs(u), tint = 0.85 + t.seed * 0.3, sn = seasonIdx(), bare = sn === 3 && k !== 'pine';
  if (bare) return winterTreeCell(i, u, z, du, dz, L, t);
  let e = -1, cz = 0.4; // how far inside the canopy (0 at its edge, 1 at the middle), and the middle's height
  if (k === 'pine') { // tiers of boughs, each a triangle, narrowing up the tree
    for (let j = 0; j < 4; j++) {
      const z0 = 0.12 + j * 0.15, top = z0 + 0.24, w = 0.21 - j * 0.04;
      if (z > z0 && z < top) { const half = (top - z) / 0.24 * w; if (au < half) e = Math.max(e, Math.min(1, (half - au) / 0.06, (z - z0) / 0.04)); }
    }
    cz = 0.45;
  } else for (const [bu, bz, r] of TREE_BLOBS[k]) { const d = Math.hypot(u - bu, (z - bz) * 1.1) / r; if (d < 1) { e = Math.max(e, 1 - d); cz = bz; } }
  const trunkTop = k === 'pine' ? 0.2 : k === 'poplar' ? 0.25 : 0.32, trunkW = k === 'oak' || k === 'blossom' ? 0.025 : 0.018;
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

function winterTreeCell(i, u, z, du, dz, L, t) {
  const height = TREE_SIZE[t.kind][1], pixel = Math.max(du * 0.42, dz * 0.4), branches = winterTreeBranches(t);
  const row = clamp(Math.floor(z / height * WINTER_BRANCH_ROWS), 0, WINTER_BRANCH_ROWS - 1);
  const ids = pixel <= WINTER_BRANCH_PAD ? TREE_WINTER_ROWS[t.kind][row] : null;
  let slope = null;
  for (let j = 0; j < (ids ? ids.length : branches.length); j++) {
    const b = branches[ids ? ids[j] : j], width = Math.max(0.0045 * b.thickness, pixel);
    if (z < b.z0 - width || z > b.z1 + width || u < b.minX - width || u > b.maxX + width) continue;
    const along = clamp(((u - b.x0) * b.du + (z - b.z0) * b.dz) / b.length2, 0, 1);
    if ((u - b.x0 - b.du * along) ** 2 + (z - b.z0 - b.dz * along) ** 2 < width * width) { slope = b.slope; break; }
  }
  if (slope === null) return false;
  const snow = snowCover > 0.2 && z > height * 0.55 && Math.abs(slope) < 1.8 && hash(Math.floor(u * 90 + t.seed * 99), Math.floor(z * 90), 816) > 0.68;
  const ch = snow ? '-' : Math.abs(slope) > 1.8 ? '|' : Math.abs(slope) < 0.28 ? '-' : slope > 0 ? '/' : '\\';
  return set(i, ch, C(snow ? WHITE : t.kind === 'birch' ? WHITE : BRICK, snow ? 12 : clamp(6 + L * 0.45, 6, 13))), true;
}

// a person's look, kept until the season changes their clothes; their pose from their walk phase (still: standing)
function streetLook(m) {
  const si = seasonIdx();
  if (m.look?.si !== si) { m.look = figStreetLook(m.seed ??= Math.random() * 1e9 | 0, m.shirt, m.pants || GRAY, si); m.look.si = si; }
  return m.look;
}
const copLook = c => c.look ||= figCopLook(c.seed ??= Math.random() * 1e9 | 0);
function walkPose(m, gait = 'walk') {
  if (m.ph !== m._ph) { m._ph = m.ph; m._phT = T; }
  return T - (m._phT ?? -1) < 0.3 || m.chase ? gait + (Math.floor(m.ph * 2) & 7) : 'stand'; // (still walking if they stepped a moment ago: a pause doesn't stop them)
}
function citySprites() {
  drawFerries();
  drawWildScenery();
  drawRoadBridges();
  drawDrugBuyer();
  drawWorkshopSupplier();
  drawCourier();
  drawMuseumRoof();
  drawRoofPolice();
  drawChopper(); // (5 stars: chopper.js)
  drawAirport(); // (airport-render.js)
  drawAircraft(); // (aircraft-render.js)
  drawBelleBuildings();
  drawArchitecture();
  drawLandmarks();
  drawPavilions();
  drawStreetScenes();
  drawCoastLife();
  drawHomeBalconies();
  drawSkater(); // you, on the board, seen from behind (skate.js)
  forNear(treesB, t => { const [vx, vy] = R(t.x, t.y); if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawTree(t, vx, vy); });
  forNear(benchesB, b => { const [vx, vy] = R(b.x, b.y); drawBench(vx,vy,b.fx,b.fy,.01,terrainHeight(b.x,b.y)); });
  gardenSprites();
  clubSprites();
  drawPigeons();
  bayBoats(); // (marina.js: real 3D boats)
  marinaSprites();
  drawAnglers(); // (fishing-render.js)
  drawCampfires(); // (cooking-ui.js)
  forNear(extrasB, o => {
    if (!inView(rel(o.x - px), rel(o.y - py), 0.6)) return;
    if(o.hidden)return;
    if (o.spire && mode === 'roof' && Math.hypot(rel(o.x - px), rel(o.y - py)) < 0.8 || o.when && !o.when()) return; // (not the spire you're standing under)
    if (o.parkLamp) drawParkLamp(...R(o.x, o.y));
    else if (o.fairPost) drawFairPost(o, ...R(o.x, o.y));
    else if (o.lantern) drawMarketLantern(o, ...R(o.x, o.y));
    else if (o.bike != null) drawBike(o, ...R(o.x, o.y));
    else if (o.banner) drawBanner(o, ...R(o.x, o.y));
    else if (o.fishSign) drawFishSign(o, ...R(o.x, o.y));
    else if (o.person != null) drawFigure(...R(o.x, o.y), o.z, 0.175, o.dead?-o.down.fx:0, o.dead?-o.down.fy:0, o.look ||= figStreetLook(hash(o.x, o.y, 9081) * 1e9 | 0, o.person, GRAY), o.dead?'dead':'stand', { light: 6 });
    else drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, o.col);
  });
  drawGrandHotelDome();
  for (const v of vendors) {
    if (!inView(rel(v.x - px), rel(v.y - py), 0.5)) continue;
    drawCart(v);
    if(!v.hidden)drawFigure(...R(v.x + v.ox, v.y + v.oy), 0, 0.175, v.dead?-v.down.fx:0, v.dead?-v.down.fy:0, v.look ||= figStreetLook(hash(v.x, v.y, 9080) * 1e9 | 0, v.shirt, GRAY),v.dead?'dead':'stand'); // (minding the cart: facing you)
  }
  for (const r of radios) { const [vx, vy] = R(r.x, r.y); if (inView(vx, vy, 1.2)) drawRadioTower(vx, vy); }
  for (const s of stations) { const [vx, vy] = R(s.x, s.y); if (Math.hypot(vx, vy) < vis && inView(vx, vy, 1)) drawStationEntrance(s, vx, vy); }
  forNear(roofsB, o => {
    const [vx, vy] = R(o.x, o.y);
    if (Math.hypot(vx, vy) < vis + 1 && inView(vx, vy, 0.6)) (o.kind === 'tank' ? drawTank : o.kind === 'antenna' ? drawAntenna : drawBoard)(o, vx, vy);
  });
  for (const k of cranes) {
    if(k.hidden)continue;
    const [vx, vy] = R(k.x, k.y);
    if (Math.abs(vx) > vis + 5 || Math.abs(vy) > vis + 5) continue;
    const th = k.slew + T * 0.03; // the jib slews slowly
    // where the hook hangs: under the trolley, always clear of whatever's built below it
    const f = 0.45 + 0.35 * Math.sin(T * 0.08 + k.slew), tx = k.x + Math.cos(th) * JIB * f, ty = k.y + Math.sin(th) * JIB * f;
    let below = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) below = Math.max(below, map[idx(Math.floor(tx) + i, Math.floor(ty) + j)]);
    k.tro = f; k.hz = Math.min(k.H - 0.6, below + 0.5 + 0.8 * (0.5 + 0.5 * Math.sin(T * 0.05 + k.slew * 3)));
    if (inView(vx, vy, JIB + 0.6)) drawCrane(k, vx, vy, th); // (the hook's height is kept up either way)
  }
  for (const s of stacks) {
    const [vx, vy] = R(s.x, s.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis && inView(vx, vy, 1.6)) { drawStack(s, vx, vy); drawShape(vx, vy, s.z + s.H, 1.6, 2.2, (i, u, z, du, dz, L) => smokeCell(i, u, z, L, s)); }
  }
  forNear(lampsB, ({ x, y, ax, ay, top = LAMP_TOP }) => {
    const [vx, vy] = R(x, y), depth = dx * vx + dy * vy;
    const lampRadius=REACH+.08;
    if (depth < -lampRadius || depth > vis+lampRadius) return;
    if (districtAt(x, y) === 'belle') {if(depth<.05||depth>vis)return;return drawBelleLamp(vx, vy, ax, ay);}
    if(!inView(vx,vy,lampRadius))return;
    if (vx * vx + vy * vy < LAMP_3D * LAMP_3D) return drawLamp3D(vx, vy, ax, ay, top); // up close: a real one
    const s = across(ax, ay, vx, vy); // arm across our view: +1 reaching right
    drawShape(vx, vy, 0, REACH + 0.08, top + NECK + 0.03, (i, u, z, du, dz, L) => lampCell(i, u, z, du, dz, L, s, top));
  });
  islandSprites();
  fairSprites();
  gasSprites(); // (the drivers at the pumps: gas-render.js)
  forNear(solidsB, o => { const [vx, vy] = R(o.x, o.y); if (Math.hypot(vx, vy) < vis + 1 && inView(vx, vy, Math.max(o.hl, o.hw) + 0.1)) drawBox(boxAt(vx, vy, o.c, o.s, o.hl, o.hw, o.z0, o.z1), SOLID_SHADE[o.kind](o)); });
  drawFacadeUtilities(); // (facade-utilities.js)
  drawKerbFixtures(); // (kerb-fixtures-render.js)
  forNear(machinesB, m => { const [vx, vy] = R(m.x, m.y); if (Math.hypot(vx, vy) < vis) drawVending(m, vx, vy); });
  forNear(lanternsB, l => { const [vx, vy] = R(l.x, l.y); if (Math.hypot(vx, vy) < 30) drawLanternString(vx, vy, l.ax, l.ay); });
  forNear(lightsB, s => { if (inView(rel(s.x - px), rel(s.y - py), 0.3)) drawSignal(s); });
  bridgeSprites();
  elSprites();
  siren = null;
  for (const m of cars) {
    if ((m.player || m.rider) && !chaseOn) continue; // first person: you're inside it
    const [vx, vy] = R(m.ex, m.ey), steering = m.kind === 'taxi' && !m.player && !m.parked && m.laneYaw != null;
    const hx = steering ? Math.cos(m.laneYaw) : m.hx, hy = steering ? Math.sin(m.laneYaw) : m.hy;
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    if ((m.ev || m.patrol) && lightsOn_(m) && Math.hypot(vx, vy) < vis) siren = m;
    if (inView(vx, vy, 0.6)) drawVehicle(m, vx, vy, hx, hy); // (its siren lights the street even when it's out of sight)
  }
  for (const b of SERVICES) if (!b.out) { // parked out front of its station, ready to go
    const [vx, vy] = R(b.x, b.y);
    if (Math.hypot(vx, vy) < vis) drawVehicle(b.parked || (b.parked = { kind: b.kind, body: EV_BODY[b.kind], ev: true, state: 'home', v: 0 }), vx, vy, -1, 0);
  }
  for (const m of fairFolk) if(!m.hidden) { // the crowd at the fair (fair.js)
    const [vx, vy] = R(m.x, m.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis) { figMotion(m); drawFigure(vx, vy, 0, 0.175, m._fx || 0, m._fy || 0, streetLook(m), m.dead?'dead':walkPose(m)); }
  }
  for (const m of people) if (!m.hidden) { // facing the way they last walked: from behind, their back (and their pockets)
    if (m.dead && sheeted(m)) drawSheet(m, ...R(m.x, m.y)); // (shot, and the paramedics are here: gun-ui.js)
    else if (m.down) drawFigure(...R(m.x, m.y), walkGround(m.x, m.y), 0.175, -m.down.fx, -m.down.fy, streetLook(m), downPose(m.down)); // (knocked down: flat on their back)
    else if (m.flee) { drawFigure(...R(m.x, m.y), walkGround(m.x, m.y), 0.175, m.flee.x, m.flee.y, streetLook(m), walkPose(m, 'run')); if (m.flee.scream && fract(T * 2.5 + m.ph) < 0.6) drawArt(...R(m.x, m.y), 0.2, 0.03, 0.05, ['!'], () => C(WHITE, 14)); } // (running from a gunshot)
    else if (m.help || m.gawk) { // run over to help, crouched by them; or stopped, staring (a hand to their mouth, some of them)
      const v = m.help || m.gawk, dx = rel(v.x - m.x), dy = rel(v.y - m.y), d = Math.hypot(dx, dy) || 1;
      drawFigure(...R(m.x, m.y), walkGround(m.x, m.y), 0.175, dx / d, dy / d, streetLook(m), m.help ? (d < 0.13 ? 'crouch' : walkPose(m, 'run')) : m.ph % 1 < 0.4 ? 'gasp' : 'stand');
    } else drawFigure(...R(m.x, m.y), walkGround(m.x, m.y), 0.175, m.last[0], m.last[1], streetLook(m), m.hailing ? 'wave' : walkPose(m));
    if (walkingDog(m)) { // the dog, and the lead from the walker's hand to its collar
      const d = dogOf(m), [vx, vy] = R(d.x, d.y), [hx, hy] = R(m.x, m.y), s = d.small ? 0.7 : 1;
      const dogGround = walkGround(d.x, d.y), handGround = walkGround(m.x, m.y);
      drawDog(vx, vy, d.mx, d.my, d.col, s, d.sniff ? 4 : Math.floor(T * 8 + m.ph * 4) & 3, dogGround);
      const lz = t => handGround * (1 - t) + dogGround * t + 0.085 - (0.085 - 0.04 * s) * t - Math.sin(t * Math.PI) * 0.012, cx = vx + d.mx * 0.03 * s, cy = vy + d.my * 0.03 * s; // the lead, sagging a little
      for (let k = 0; k < 5; k++) { const t0 = k / 5, t1 = (k + 1) / 5; rod(hx + (cx - hx) * t0, hy + (cy - hy) * t0, lz(t0), hx + (cx - hx) * t1, hy + (cy - hy) * t1, lz(t1), 0.0015, RED, 1.1); }
    }
    if (m.hailing) drawArt(...R(m.x, m.y), 0.2, 0.03, 0.06, ['!'], () => C(YEL, fract(T * 3) < 0.6 ? 15 : 8)); // waving you down
  }
  drawBall();
  for (const c of footCops) { // police on foot: navy cap, uniform, running when they're after you
    const [vx, vy] = R(c.x, c.y);
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    if (c.dead && sheeted(c)) { drawSheet(c, vx, vy); continue; }
    if (c.down) { drawFigure(vx, vy, walkGround(c.x, c.y), 0.18, -c.down.fx, -c.down.fy, copLook(c), downPose(c.down)); continue; }
    figMotion(c);
    if (c.aimT > T) { const [fx_, fy_] = aimAt(rel(px - c.x), rel(py - c.y)); drawFigure(vx, vy, walkGround(c.x, c.y), 0.18, fx_, fy_, copLook(c), 'aim'); continue; } // (shooting at you: gun.js)
    drawFigure(vx, vy, walkGround(c.x, c.y), 0.18, c._fx || 0, c._fy || 0, copLook(c), walkPose(c, c.chase ? 'run' : 'walk'));
    if (c.chase && fract(T * 3) < 0.5) drawArt(vx, vy, 0.2, 0.03, 0.05, ['!'], () => C(RED, 15));
  }
  for (const d of dropped) if (d.at === '') { const [vx, vy] = R(d.x, d.y); if (Math.hypot(vx, vy) < 12) drawDropped(d, vx, vy, 0.1); } // things you put down
  if (job && job.ride) { // the fare's stop: a big marker hanging over the street
    const [vx, vy] = R(job.ride.dest[0], job.ride.dest[1]);
    drawArt(vx, vy, 0.25, 0.12, 0.18, ['\\ /', ' V '], () => C(YEL, fract(T * 2) < 0.7 ? 15 : 9));
  }
  if (task && task.kind === 'dog') { // the lost dog: nosing about, or trotting after you
    const g = task.dog, mx = rel(g.x - (g._lx ?? g.x)), my = rel(g.y - (g._ly ?? g.y)), v = Math.hypot(mx, my);
    if (v > 1e-4) { g._fx = mx / v; g._fy = my / v; }
    g._lx = g.x; g._ly = g.y;
    drawDog(...R(g.x, g.y), g._fx ?? 1, g._fy ?? 0, BRICK, 1, g.follow && v > 1e-4 ? Math.floor(T * 8) & 3 : 4, walkGround(g.x, g.y));
  }
}

function drawGrandHotelDome() {
  if (mode === 'room') return;
  const x = GRAND_HOTEL.bx * 8 + 5, y = GRAND_HOTEL.by * 8 + 5, [vx, vy] = R(x, y);
  if (Math.hypot(vx, vy) > vis + 3) return;
  drawCopperDome(vx, vy, 3.75, 1.06, 1.02);
  for (const off of [-2.4, 2.4]) {
    const [tx, ty] = R(x + off, GRAND_HOTEL.by * 8 + 7.4);
    drawCopperDome(tx, ty, 2.7, 0.48, 0.58);
  }
  // The entry canopy projects over the pavement; its columns leave the revolving door clear.
  const [cx, cy] = R(x, GRAND_HOTEL.by * 8 + 7.9);
  drawBox({ x: cx, y: cy, c: 1, s: 0, hl: 1.1, hw: 0.48, z0: 0.52, z1: 0.58 }, (i, t, L) => {
    BG[i] = C(GREEN, 1 + L * 0.2); return set(i, HIT.face === 5 ? '/' : '=', C(YEL, L)), true;
  });
  for (const off of [-1, 1]) drawBox({ x: cx + off, y: cy + 0.3, c: 1, s: 0, hl: 0.025, hw: 0.025, z0: 0, z1: 0.52 },
    (i, t, L) => (set(i, '|', C(YEL, L)), true));
}
function rayCopperCap(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, z = oz - b.z0;
  const aa = (rx * rx + ry * ry) * b.invRadius2 + rz * rz * b.invHeight2;
  const bb = (x * rx + y * ry) * b.invRadius2 + z * rz * b.invHeight2;
  const q = (x * x + y * y) * b.invRadius2 + z * z * b.invHeight2 - 1, disc = bb * bb - aa * q;
  if (disc < 0) return -1;
  let t = (-bb - Math.sqrt(disc)) / aa, face = 5;
  if (t < .01) return -1;
  if (z + rz * t < 0) {
    if (Math.abs(rz) < 1e-12) return -1;
    t = -z / rz; face = 6;
    if (t < .01 || (x + rx * t) ** 2 + (y + ry * t) ** 2 > b.hl * b.hl) return -1;
  }
  HIT.u = x + rx * t; HIT.v = y + ry * t; HIT.w = oz + rz * t; HIT.face = face;
  return t;
}
function rayCopperDrum(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, aa = rx * rx + ry * ry, bb = x * rx + y * ry;
  const disc = bb * bb - aa * (x * x + y * y - b.hl * b.hl);
  if (disc < 0) return -1;
  let entry = -Infinity, exit = Infinity, face = 3;
  if (aa > 1e-12) {
    const root = Math.sqrt(disc); entry = (-bb - root) / aa; exit = (-bb + root) / aa;
  } else if (x * x + y * y > b.hl * b.hl) return -1;
  if (Math.abs(rz) < 1e-12) { if (oz < b.z0 || oz > b.z1) return -1; }
  else {
    const a0 = (b.z0 - oz) / rz, a1 = (b.z1 - oz) / rz, lower = Math.min(a0, a1);
    if (lower > entry) { entry = lower; face = rz > 0 ? 6 : 5; }
    exit = Math.min(exit, Math.max(a0, a1));
  }
  if (entry < .01 || entry > exit) return -1;
  HIT.u = x + rx * entry; HIT.v = y + ry * entry; HIT.w = oz + rz * entry; HIT.face = face;
  return entry;
}
// Low copper crowns on dressed drums, with quiet patina panels and narrow standing seams.
// drawBox bounds the actual vertical silhouette, avoiding full-screen ray tests for roofs high above the camera.
function drawCopperDome(vx, vy, base, radius, height, supportBase = base) {
  const drum = height * .18, capHeight = height - drum;
  const ring = (r, z0, z1, stone) => drawBox(boxAt(vx, vy, 1, 0, r, r, z0, z1), (i, t, L) => {
    const angle = Math.atan2(HIT.v, HIT.u), flute = Math.abs(Math.sin(angle * 12)) < .13;
    const color = stone ? STONE : GREEN;
    let ch = ' ';
    if (HIT.face >= 5) ch = '=';
    else if (flute) ch = '|';
    BG[i] = C(color, 1.5 + L * .28);
    set(i, ch, C(stone ? STONE : YEL, L * .75));
    return true;
  }, rayCopperDrum);
  // On a sloping mansard the pedestal extends down into the roof, keeping the crown supported at every edge.
  ring(radius * 1.035, supportBase, base + .025, true);
  ring(radius * .96, base + .025, base + drum, false);
  ring(radius * 1.025, base + drum - .018, base + drum + .012, false);
  const b = { ...boxAt(vx, vy, 1, 0, radius, radius, base + drum, base + height),
    invRadius2: 1 / (radius * radius), invHeight2: 1 / (capHeight * capHeight) };
  drawBox(b, (i, t, L) => {
    if (HIT.face === 6) { BG[i] = C(GREEN, 1); set(i, ' ', 0); return true; }
    const z = HIT.w - b.z0, nx = HIT.u * b.invRadius2, ny = HIT.v * b.invRadius2, nz = z * b.invHeight2;
    const length = Math.hypot(nx, ny, nz), angle = Math.atan2(HIT.v, HIT.u);
    const light = .55 + .45 * Math.max(0, (-nx * .55 + ny * .35 + nz * .76) / length);
    const patina = .5 + .5 * Math.sin(angle * 3 + z / capHeight * 2);
    const rib = Math.abs(fract(angle * 6 / Math.PI) - .5) < .016;
    BG[i] = C(GREEN, 1.2 + L * light * (.25 + patina * .025));
    set(i, rib ? '|' : ' ', C(GREEN, L * light * .6));
    if (nz / length > .35) paintSettledSnow(i, vx + px + HIT.u, vy + py + HIT.v, L * .6, nz / length, 0, HIT.w);
    return true;
  }, rayCopperCap);
  drawBox(boxAt(vx, vy, 1, 0, radius * .022, radius * .022, base + height - .008, base + height + .07), (i, t, L) => {
    BG[i] = C(GRAY, 1); set(i, HIT.face === 5 ? '+' : '|', C(YEL, L * .85)); return true;
  });
}

// a classic street lamp: a tall fluted pole, a swan neck curving out over the street, a lantern hanging from its end.
// Drawn from measurements, so the curve stays one character thick at any distance; s squashes the neck sideways
// when the arm points toward or away from you, so it turns smoothly as you walk round it.
function lampCell(i, u, z, du, dz, L, s, top = LAMP_TOP) {
  const lit = lampsOn > 0.3, steel = C(GRAY, L * 1.1), hx = 2 * NECK * s, lu = u - hx, lz = z - (top - 0.09);
  // the lantern: a cap, a glass body glowing after dark, a finial underneath
  if (Math.abs(lu) < Math.max(0.03, du * 0.75) && z < top - 0.03 && z > top - 0.14) {
    if (z > top - 0.055) return set(i, Math.abs(lu) < Math.max(0.015, du / 2) ? '^' : '_', steel), true;
    if (z < top - 0.125) return set(i, 'v', steel), true;
    if (lit) BG[i] = C(WARM, 4 + lampsOn * 4);
    return set(i, lit ? '#' : ':', lit ? C(WARM, 15) : C(GRAY, L * 0.7)), true;
  }
  if (z <= top && z > top - 0.03 && onLine(lu, du, 0, 0)) return set(i, '|', steel), true; // the drop
  const halo = Math.hypot(lu / 0.075, lz / 0.065);
  if (lit && halo < 1) { BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, " ", 0), true; } // a soft glow round it
  // the pole: a flared base, a collar, a finial on top
  if (z < top + 0.02 && Math.abs(u) < Math.max(du / 2, z < 0.06 ? 0.03 : 0.012)) {
    if (z < 0.06) return set(i, z < 0.025 ? '#' : 'A', steel), true;
    return set(i, Math.abs(z - 0.42) < Math.max(0.012, dz / 2) ? '=' : '|', steel), true;
  }
  // the swan neck: the upper half of an ellipse from the pole top out to the lantern
  const w = NECK * Math.abs(s);
  if (w > du * 0.3 && z > top - dz) {
    const ex = (u - NECK * s) / w, ez = (z - top) / NECK, rho = Math.hypot(ex, ez), tol = Math.max(du / w, dz / NECK) / 2;
    if (Math.abs(rho - 1) < tol && ez > -tol) {
      const ang = Math.atan2(ez, ex), tu = -w * Math.sin(ang) / du, tz = NECK * Math.cos(ang) / dz; // tangent, in cells
      const sl = Math.abs(tz) / (Math.abs(tu) + 1e-9);
      return set(i, sl > 2.5 ? '|' : sl < 0.4 ? '-' : tu * tz > 0 ? '/' : '\\', steel), true; // rising to the right: '/'
    }
  }
  return false;
}

// a lamp up close is turned and built (drawLamp3D, street-lamps.js); further off the billboard (lampCell) looks the
// same and costs far less. STEEL: plain steel parts shared by the signals, the el and the bridges.
const LAMP_3D = 5;
const steelBox = ch => (i, t, L) => { BG[i] = C(GRAY, (0.9 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '.' : ch, C(GRAY, L * 1.15)), true; };
const STEEL = { pole: steelBox('|'), base: steelBox('#'), arm: steelBox('='), cap: steelBox('_') };
// ---- signals and roof clutter as real 3D parts. Poles, masts, legs and wires are rods (rayRod, courier-ui.js): round
// up close and never thinner than a character far off, so they hold the skyline at any distance. a, b camera-relative.
function drawRod(ax, ay, az, bx, by, bz, r, shade) {
  const m = r + 0.01;
  drawBox({ x: (ax + bx) / 2, y: (ay + by) / 2, c: 1, s: 0, hl: Math.abs(bx - ax) / 2 + m, hw: Math.abs(by - ay) / 2 + m,
            z0: Math.min(az, bz) - m, z1: Math.max(az, bz) + m, ax, ay, az, bx, by, bz, r }, shade, rayRod);
}
// a steel rod drawn along itself ('|' up a pole, '/' on a brace); solid-backed once it's wider than a character
function rod(ax, ay, az, bx, by, bz, r, col = GRAY, k = 1) {
  drawRod(ax, ay, az, bx, by, bz, r, (i, t, L) => {
    if (r * 2 * projX / t > 1.5) BG[i] = C(col, 0.8 + L * 0.25 * k);
    return set(i, courierGlyph(HIT.u, HIT.v, HIT.w, bx - ax, by - ay, bz - az), C(col, L * k)), true;
  });
}
// a point: a little sphere up close, one character far off (bz nudged so rayRod has an axis to measure along)
const dot = (x, y, z, r, shade) => drawRod(x, y, z, x, y, z - 0.002, r, shade);

// a wooden water tank on a steel stand: braced legs, a platform, the barrel with its iron hoops, a conical roof
const TANK = { r: 0.11, leg: 0.13, top: 0.3, roof: 0.07 };
function drawTank(o, vx, vy) {
  const z = o.z, near = vx * vx + vy * vy < 100, ca = Math.cos(o.turn), sa = Math.sin(o.turn), q = 0.075, base = z + TANK.leg + 0.01;
  const legs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [vx + (a * ca - b * sa) * q, vy + (a * sa + b * ca) * q]);
  legs.forEach(([x, y], k) => {
    rod(x, y, z, x, y, base, 0.006);
    if (near) { const [x2, y2] = legs[(k + 1) & 3]; rod(x, y, z + 0.01, x2, y2, base - 0.015, 0.003, GRAY, 0.7); } // cross bracing
  });
  drawBox(boxAt(vx, vy, ca, sa, q + 0.025, q + 0.025, base - 0.01, base), (i, t, L) => {
    BG[i] = C(GRAY, (0.9 + L * 0.2) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '#' : '=', C(GRAY, L * 0.6)), true;
  });
  drawBox(boxAt(vx, vy, 1, 0, TANK.r, TANK.r, base, z + TANK.top), (i, t, L) => { // the barrel: staves and hoops
    const ang = Math.atan2(HIT.v, HIT.u), light = 0.55 + 0.45 * Math.max(0, (-HIT.u * 0.55 + HIT.v * 0.35) / TANK.r);
    const P = (z + TANK.top - base) / 4, hoop = Math.abs(fract((HIT.w - base) / P) - 0.5) * P < Math.max(0.003, 0.5 * t / projY); // (a row thick at least)
    BG[i] = C(BRICK, 1 + L * 0.28 * light);
    return set(i, HIT.face >= 5 ? ' ' : hoop ? '=' : fract(ang * 8 / Math.PI) < 0.14 ? '|' : ' ', C(hoop ? GRAY : WARM, L * light * (hoop ? 1.1 : 0.75))), true;
  }, rayCopperDrum);
  const roof = boxAt(vx, vy, 1, 0, TANK.r * 1.1, TANK.r * 1.1, z + TANK.top, z + TANK.top + TANK.roof);
  drawBox(roof, (i, t, L) => { // the roof: rings of shingles, lit from the sun's side, snow on top
    if (HIT.face === 6) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
    const rho = Math.hypot(HIT.u, HIT.v) || 1, kk = roof.hl / TANK.roof, n = Math.hypot(1, kk);
    const light = 0.5 + 0.5 * Math.max(0, (-HIT.u / rho * 0.55 + HIT.v / rho * 0.35 + kk * 0.76) / n);
    BG[i] = C(GRAY, 0.8 + L * 0.2 * light);
    set(i, fract((HIT.w - roof.z0) / TANK.roof * 5) < 0.25 ? '-' : ' ', C(GRAY, L * light));
    paintSettledSnow(i, vx + px + HIT.u, vy + py + HIT.v, L * 0.6, kk / n, 0, HIT.w);
    return true;
  }, rayCone);
  rod(vx, vy, roof.z1 - 0.01, vx, vy, roof.z1 + 0.025, 0.003); // the finial
}
// a cone: base radius b.hl at b.z0 narrowing to a point at b.z1. Hits on the sloping side (face 5) or the base (6).
function rayCone(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, k = b.hl / (b.z1 - b.z0), k2 = k * k, Z = b.z1 - oz;
  const qa = rx * rx + ry * ry - k2 * rz * rz, qb = x * rx + y * ry + k2 * Z * rz, qc = x * x + y * y - k2 * Z * Z;
  let best = Infinity, face = 5;
  const side = t => { const w = oz + rz * t; if (t > 0.01 && t < best && w >= b.z0 && w <= b.z1) best = t; };
  if (Math.abs(qa) > 1e-12) { const disc = qb * qb - qa * qc; if (disc >= 0) { const r = Math.sqrt(disc); side((-qb - r) / qa); side((-qb + r) / qa); } }
  else if (Math.abs(qb) > 1e-12) side(-qc / (2 * qb));
  if (Math.abs(rz) > 1e-12) {
    const t = (b.z0 - oz) / rz;
    if (t > 0.01 && t < best && (x + rx * t) ** 2 + (y + ry * t) ** 2 <= b.hl * b.hl) { best = t; face = 6; }
  }
  if (best === Infinity) return -1;
  HIT.u = x + rx * best; HIT.v = y + ry * best; HIT.w = oz + rz * best; HIT.face = face;
  return best;
}

// a radio mast: a steel pole with crossed arms, guyed down to the roof, a red beacon blinking on top
function drawAntenna(o, vx, vy) {
  const z = o.z, H = 1, ca = Math.cos(o.turn), sa = Math.sin(o.turn);
  rod(vx, vy, z, vx, vy, z + H, 0.006);
  for (const [h, w] of [[0.55, 0.08], [0.8, 0.06]]) for (const [c, s] of [[ca, sa], [-sa, ca]])
    rod(vx - c * w, vy - s * w, z + h, vx + c * w, vy + s * w, z + h, 0.003);
  for (let k = 0; k < 3; k++) { const th = o.turn + k * 2.094; rod(vx, vy, z + 0.6, vx + Math.cos(th) * 0.22, vy + Math.sin(th) * 0.22, z, 0.0015, GRAY, 0.45); }
  const blink = fract(T * 0.8 + o.x) < 0.5;
  dot(vx, vy, z + H + 0.012, 0.008, (i, t, L) => { if (blink) BG[i] = C(RED, 8); return set(i, '*', C(RED, blink ? 15 : 3)), true; });
}

// a rooftop billboard: the ad on a panel facing the street (o.c, o.s), neon round its edge after dark, a catwalk
// along the front, and the steel frame behind holding it up
function drawBoard(o, vx, vy) {
  const n = o.word.length + 2, hw = n * 0.025, z0 = o.z + 0.14, z1 = z0 + 0.17, c = o.c, s = o.s, glow = Math.max(night, overcast * 0.6);
  const band0 = z0 + 0.04, bandH = 0.09, far = farDepth(vx, vy, hw);
  for (const f of [-0.75, 0, 0.75]) { // uprights behind the panel, each with a kicker brace back to the roof
    const lx = vx - c * 0.014 - s * f * hw, ly = vy - s * 0.014 + c * f * hw;
    rod(lx, ly, o.z, lx, ly, z1 - 0.01, 0.005);
    rod(lx - c * 0.1, ly - s * 0.1, o.z, lx, ly, z0 + 0.06, 0.003, GRAY, 0.7);
  }
  drawBox(boxAt(vx, vy, c, s, 0.008, hw, z0, z1), (i, t, L) => {
    const f = HIT.face, v = HIT.v, w = HIT.w;
    if (f !== 1) { // the back and edges: the steel frame
      const gv = fract(v * 12) < 0.12, gw = fract((w - z0) * 12) < 0.15;
      BG[i] = C(GRAY, (0.8 + L * 0.2) * shadeFace(f));
      return set(i, f === 2 ? (gv && gw ? '+' : gv ? '|' : gw ? '-' : ' ') : ' ', C(GRAY, L * 0.6)), true;
    }
    const q = (hw - v) / (2 * hw), edge = Math.min(hw - Math.abs(v), w - z0, z1 - w);
    if (edge < 0.012) { // the neon tube round the edge, a chase of light running round it after dark
      BG[i] = C(o.neon, glow > 0.3 ? 6 + glow * 4 : 1.5 + L * 0.15);
      return set(i, glow > 0.3 && fract(q * 20 - T * 2) < 0.3 ? '*' : ' ', C(WHITE, 15)), true;
    }
    BG[i] = C(GRAY, 1.3 + L * 0.2 + glow * 0.8);
    const ch = signLine(o.word, q * n - 1, (band0 + bandH - w) / bandH, i, band0 + bandH / 2, midDepth(vx, vy), t, 2 * hw / n, bandH, far, s, -c);
    return set(i, ch ?? ' ', C(o.neon, Math.max(L, glow * 15))), true;
  });
  drawBox(boxAt(vx + c * 0.03, vy + s * 0.03, c, s, 0.022, hw, z0 - 0.012, z0 - 0.005), (i, t, L) => { // the catwalk
    BG[i] = C(GRAY, (0.7 + L * 0.15) * shadeFace(HIT.face)); return set(i, HIT.face >= 5 ? '#' : '_', C(GRAY, L * 0.5)), true;
  });
}

// ---- the el: latticed steel columns under the deck, and a switchback stair tower up to each platform.
// A column: a concrete footing, a shaft with flanges up its edges and zigzag bracing between, a flared cap under the
// deck. Far off it's a rod, keeping one character wide wherever it stands.
const EL_COL = 0.022, EL_PANEL = 0.07;
function drawElPillar(p) {
  const [vx, vy] = R(p.x, p.y), d = Math.hypot(vx, vy);
  if (d > vis + 1) return;
  if (d > 9) return rod(vx, vy, 0, vx, vy, EL_BOT, EL_COL, GRAY, 0.9);
  drawBox(boxAt(vx, vy, 1, 0, 0.04, 0.04, 0, 0.025), (i, t, L) => {
    BG[i] = C(STONE, (1.2 + L * 0.25) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? ' ' : '_', C(STONE, L * 0.6)), true;
  });
  drawBox(boxAt(vx, vy, 1, 0, EL_COL, EL_COL, 0.025, EL_BOT - 0.035), (i, t, L) => {
    const f = HIT.face, side = f < 3 ? HIT.v : HIT.u, q = (HIT.w - 0.025) / EL_PANEL, n = Math.floor(q), k = q - n;
    const tol = Math.max(0.003, 0.5 * t / projX);
    BG[i] = C(GRAY, (0.7 + L * 0.18) * shadeFace(f));
    if (f >= 5) return set(i, ' ', 0), true;
    if (Math.abs(side) > EL_COL - tol * 1.2) return set(i, '|', C(GRAY, L)), true; // the flanges
    if (k * EL_PANEL < Math.max(0.003, 0.5 * t / projY)) return set(i, '-', C(GRAY, L * 0.85)), true; // a batten each panel
    const sg = n & 1 ? -1 : 1, target = sg * EL_COL * (2 * k - 1);
    if (Math.abs(side - target) > tol * 1.6) return set(i, ' ', 0), true;
    const run = 2 * EL_COL * sg; // the brace's direction, so its glyph leans the way it does on screen
    return set(i, courierGlyph(vx + HIT.u, vy + HIT.v, HIT.w, f < 3 ? 0 : run, f < 3 ? run : 0, EL_PANEL), C(GRAY, L * 0.85)), true;
  });
  drawBox(boxAt(vx, vy, 1, 0, 0.05, 0.034, EL_BOT - 0.035, EL_BOT), (i, t, L) => {
    BG[i] = C(GRAY, (0.8 + L * 0.2) * shadeFace(HIT.face)); return set(i, HIT.face < 5 ? '=' : ' ', C(GRAY, L * 0.7)), true;
  });
}
// The stairs up to the el (laid out in elevated.js): two straight flights along the curb side of the sidewalk with a
// landing halfway, a landing at the top that runs out onto the platform, posts down to the street, a rail each side,
// a turnstile at the foot, and the green EL sign at the top facing the street. Flights are inclined slabs (planes).
const elStairShade = (i, t, L) => {
  if (HIT.face >= 7) { // the treads: open steel, the street showing between them
    if (fract(HIT.u * 55) < 0.25) return false;
    BG[i] = C(GRAY, 1.3 + L * 0.25); return set(i, '=', C(WHITE, L * 0.7)), true;
  }
  BG[i] = C(GRAY, (1.1 + L * 0.25) * shadeFace(HIT.face)); return set(i, ' ', 0), true; // the stringers
};
function drawElStairs(st) {
  const H = EL_TOP, c = st.c, s = st.s, fx = st.ax, fy = st.ay;
  const [ox, oy] = R(st.ox, st.oy), at = (u, v) => [ox + c * (st.off + u) + fx * v, oy + s * (st.off + u) + fy * v];
  const [mx, my] = at(0, 0.3), d = Math.hypot(mx, my);
  if (d > vis + 2) return;
  const vm = (ELS.v0 + ELS.v1) / 2, hw = (ELS.v1 - ELS.v0) / 2, far = d > 12;
  for (const [ua, ub, za, zb] of [[ELS.u0, ELS.u1, 0, H / 2], [ELS.u2, ELS.u3, H / 2, H]]) { // the two flights
    const run = (ub - ua) / 2, mid = (za + zb) / 2, slope = (zb - za) / (ub - ua), [x, y] = at((ua + ub) / 2, vm);
    if (far) { const [ax, ay] = at(ua, vm), [bx, by] = at(ub, vm); rod(ax, ay, za, bx, by, zb, 0.03); continue; }
    drawBox({ x, y, c, s, hl: run, hw, z0: za - 0.015, z1: zb + 0.015,
      planes: [[1, 0, 0, run, 1], [-1, 0, 0, run, 2], [0, 1, 0, hw, 3], [0, -1, 0, hw, 4], [-slope, 0, 1, mid, 7], [slope, 0, -1, -mid + 0.02, 8]] },
      elStairShade, rayBeveledBay);
    for (const e of [-1, 1]) { const [ax, ay] = at(ua, vm + e * hw), [bx, by] = at(ub, vm + e * hw); rod(ax, ay, za + 0.1, bx, by, zb + 0.1, 0.004); } // the rails
  }
  const landing = (ua, ub, va, vb, z) => { const [x, y] = at((ua + ub) / 2, (va + vb) / 2); drawBox(boxAt(x, y, c, s, (ub - ua) / 2, (vb - va) / 2, z - 0.015, z), STEEL.cap); };
  landing(ELS.u1, ELS.u2, ELS.v0, ELS.v1, H / 2);
  landing(ELS.u3, ELS.u4, ELS.v0, ELS.top, H);
  // the posts: under the landings and halfway along each flight
  for (const [u, z] of ELS_POSTS)
    for (const v of [ELS.v0 + 0.01, ELS.v1 - 0.01]) { const [x, y] = at(u, v); rod(x, y, 0, x, y, z - 0.015, 0.008); }
  if (far) return;
  // rails round the landings (open where the stairs come in, and onto the deck)
  for (const [ua, ub, z] of [[ELS.u1, ELS.u2, H / 2]]) for (const v of [ELS.v0, ELS.v1]) { const [ax, ay] = at(ua, v), [bx, by] = at(ub, v); rod(ax, ay, z + 0.1, bx, by, z + 0.1, 0.004); }
  { const [ax, ay] = at(ELS.u4, ELS.v0), [bx, by] = at(ELS.u4, ELS.top); rod(ax, ay, H + 0.1, bx, by, H + 0.1, 0.004); } // the far end of the top
  { const [ax, ay] = at(ELS.u3, ELS.v0), [bx, by] = at(ELS.u4, ELS.v0); rod(ax, ay, H + 0.1, bx, by, H + 0.1, 0.004); } // the building side of the top
  { const [ax, ay] = at(ELS.u3, ELS.v1), [bx, by] = at(ELS.u3, ELS.top); rod(ax, ay, H + 0.1, bx, by, H + 0.1, 0.004); } // the near side, past the stairs' head
  // the turnstile at the foot: a post, its arm across the way (swung round once you've swiped)
  { const pu = ELS.u0 - 0.02, pv = ELS.v1 - 0.015, [x, y] = at(pu, pv), open = elPass && elPass.st === st;
    drawBox(boxAt(x, y, c, s, 0.012, 0.012, 0, 0.09), STEEL.cap);
    const [bx, by] = open ? at(pu + 0.11, pv - 0.01) : at(pu, ELS.v0 + 0.01); rod(x, y, 0.075, bx, by, 0.075, 0.004, open ? GREEN : RED, 1.5); }
  // the sign at the top, facing the street
  const [sx, sy] = at((ELS.u3 + ELS.u4) / 2, ELS.v0 + 0.005), sfar = farDepth(sx, sy, 0.07);
  drawBox(boxAt(sx, sy, c, s, 0.07, 0.008, H + 0.1, H + 0.16), (i, t, L) => {
    BG[i] = C(GREEN, 4 + Math.max(night, overcast * 0.6) * 5);
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, ' ', 0), true;
    const q = ((HIT.face === 3 ? HIT.u : -HIT.u) + 0.07) / 0.14, ch = signLine('EL', q * 4 - 1, (H + 0.15 - HIT.w) / 0.04, i, H + 0.13, midDepth(sx, sy), t, 0.035, 0.04, sfar, ...faceDir(c, s));
    return set(i, ch ?? ' ', C(WHITE, 15)), true;
  });
}

// ---- street carts (vendors, props.js): a body on two wheels with a push handle, its name on the front, and an
// umbrella, an awning or a cloud of candy floss on top. Kiosks (tall) have a serving hatch you see the vendor through.
const CART_WHEEL = (i, t, L) => { BG[i] = C(GRAY, 1); return set(i, '@', C(GRAY, L * 0.5)), true; };
function drawCart(v) {
  const t = v.type, [vx, vy] = R(v.x, v.y);
  if (Math.hypot(vx, vy) > vis) return;
  const c = v.oy ? 1 : 0, s = v.oy ? 0 : 1, fs = Math.sign(s * v.ox - c * v.oy) || 1; // along the street; fs: which side (v) faces it
  const hl = t.w * 0.38, hw = 0.045, top = t.tall ? 0.17 : 0.1, glow = Math.max(night, overcast * 0.6), n = t.name.length + 2;
  const at = (u, w) => [vx + c * u - s * w, vy + s * u + c * w], far = farDepth(vx, vy, hl);
  for (const su of [-1, 1]) { const [ax, ay] = at(su * hl * 0.6, -hw - 0.006), [bx, by] = at(su * hl * 0.6, hw + 0.006); drawRod(ax, ay, 0.022, bx, by, 0.022, 0.02, CART_WHEEL); }
  { const [ax, ay] = at(-hl, 0), [bx, by] = at(-hl - 0.05, 0); rod(ax, ay, 0.08, bx, by, 0.095, 0.004); } // the push handle
  drawBox(boxAt(vx, vy, c, s, hl, hw, 0.035, top), (i, tt, L) => {
    const f = HIT.face, u = HIT.u, w = HIT.w;
    if (f === 5) { BG[i] = C(GRAY, 1.6 + L * 0.3); return set(i, t.hot ? '#' : '=', C(GRAY, L * 0.7)), true; } // a griddle, or lids
    if (f === 6) { BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; }
    const front = (f === 3 || f === 4) && Math.sign(HIT.v) === fs, q = (u * fs + hl) / (2 * hl);
    if (front && t.tall && w > 0.1 && w < 0.15 && Math.abs(u) < hl * 0.8) return false; // the hatch
    if (front && w > top - 0.035 && w < top - 0.005) { // the name, lit after dark
      BG[i] = C(t.color, 3 + glow * 6);
      const ch = signLine(t.name, q * n - 1, (top - 0.005 - w) / 0.03, i, top - 0.02, midDepth(vx, vy), tt, 2 * hl / n, 0.03, far, fs * c, fs * s);
      return set(i, ch ?? ' ', C(WHITE, 15)), true;
    }
    BG[i] = C(t.color, (1.6 + L * 0.32) * shadeFace(f));
    if (Math.abs(w - 0.05) < Math.max(0.004, 0.5 * tt / projY)) { BG[i] = C(t.trim, 3 + L * 0.3); return set(i, ' ', 0), true; } // a stripe round it
    return set(i, w < 0.042 ? '_' : ' ', C(GRAY, L * 0.5)), true;
  });
  if (t.roof === 'umbrella') {
    rod(vx, vy, top, vx, vy, 0.23, 0.004);
    drawBox(boxAt(vx, vy, 1, 0, 0.15, 0.15, 0.2, 0.245), (i, tt, L) => { // panels in two colours
      const seg = Math.floor(mod(Math.atan2(HIT.v, HIT.u), Math.PI * 2) / (Math.PI / 4)) & 1;
      BG[i] = C(seg ? t.trim : t.color, HIT.face === 6 ? 1.4 + glow : 2.4 + L * 0.35); return set(i, ' ', 0), true;
    }, rayCone);
  } else if (t.roof === 'awning') {
    for (const su of [-1, 1]) { const [x, y] = at(su * hl * 0.95, -fs * hw * 0.85); rod(x, y, top, x, y, 0.215, 0.004); }
    const stripe = (L, k) => C(fract(HIT.u * 14) < 0.5 ? t.color : t.trim, (2.2 + L * 0.3) * k);
    const [ax, ay] = at(0, fs * 0.015), [ex, ey] = at(0, fs * (hw + 0.045));
    drawBox(boxAt(ax, ay, c, s, hl + 0.015, hw + 0.03, 0.2, 0.215), (i, tt, L) => { BG[i] = stripe(L, shadeFace(HIT.face)); return set(i, ' ', 0), true; });
    drawBox(boxAt(ex, ey, c, s, hl + 0.015, 0.003, 0.18, 0.2), (i, tt, L) => { // the scalloped valance along the front
      if (HIT.w < 0.19 && fract((HIT.u + hl) * 30) > 0.5) return false;
      BG[i] = stripe(L, 1); return set(i, ' ', 0), true;
    });
  } else if (t.roof === 'floss') {
    for (const [u, z, r] of [[0, 0.145, 0.035], [-0.04, 0.135, 0.027], [0.04, 0.133, 0.025]]) {
      const [x, y] = at(u, 0);
      dot(x, y, z, r, (i, tt, L) => { BG[i] = C(MAG, 3 + L * 0.35); return set(i, '@', C(WHITE, L * 0.5 + 3)), true; });
    }
  }
  if (t.hot) { const [x, y] = at(-hl * 0.4, fs * 0.02); drawArt(x, y, top + 0.004, 0.04, 0.018, [(T * 2 | 0) & 1 ? ' ~ ~' : '~ ~ '], (ch, row, L) => C(WHITE, L * 0.6)); } // steam off the front of the griddle
}

// a garden lamp: a post on a little plinth, a cap, and a glass globe that glows after dark
function drawParkLamp(vx, vy) {
  const d = Math.hypot(vx, vy), top = 0.3, lit = lampsOn > 0.3;
  if (d > vis) return;
  if (d < 6) drawBox(boxAt(vx, vy, 1, 0, 0.016, 0.016, 0, 0.03), STEEL.base);
  rod(vx, vy, 0, vx, vy, top, 0.006);
  dot(vx, vy, top + 0.024, 0.022, (i, t, L) => {
    BG[i] = lit ? C(WARM, 6 + lampsOn * 6) : C(WHITE, 1.5 + L * 0.2);
    return set(i, lit ? ' ' : 'o', C(GRAY, L * 0.7)), true;
  });
  drawBox(boxAt(vx, vy, 1, 0, 0.014, 0.014, top + 0.046, top + 0.056), STEEL.cap);
  if (lit) drawShape(vx, vy, top - 0.04, 0.07, 0.13, (i, u, z) => {
    const halo = Math.hypot(u / 0.07, (z - 0.065) / 0.065);
    if (halo >= 1) return false;
    BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, ' ', 0), true;
  });
}

// a bulb post along the pier's edge: a post on a little foot, and a bulb on top cycling through the colours
const FAIR_BULBS = [YEL, RED, CYAN, MAG];
function drawFairPost(o, vx, vy) {
  const d = Math.hypot(vx, vy), top = 0.36, col = FAIR_BULBS[(Math.floor(T * 2) + Math.round(o.y)) & 3];
  if (d > vis) return;
  if (d < 6) drawBox(boxAt(vx, vy, 1, 0, 0.014, 0.014, 0, 0.025), STEEL.base);
  rod(vx, vy, 0, vx, vy, top, 0.006);
  dot(vx, vy, top + 0.016, 0.016, (i, t, L) => {
    BG[i] = C(col, 2 + night * 9 + L * 0.15);
    return set(i, night > 0.3 ? ' ' : 'o', C(WHITE, Math.max(L, 6))), true;
  });
}

// a paper lantern on the night market's string: hung off a hook, a cap and a foot, glowing after dark. The string runs
// halfway to the next lantern each way, so the row of them makes one string down the street, tied off to a post at each end.
function drawMarketLantern(o, vx, vy) {
  const d = Math.hypot(vx, vy), z0 = o.z, z1 = o.z + 0.055, top = o.z + 0.07, lit = Math.max(night, overcast * 0.6);
  if (d > vis) return;
  rod(vx - (o.first ? 0 : 0.225), vy, top, vx + (o.last ? 0 : 0.225), vy, top, 0.002, GRAY, 0.7); // (to halfway to the next lantern each way)
  for (const [end, e] of [[o.first, -1], [o.last, 1]]) if (end) { const x = vx + e * 0.225; rod(vx, vy, top, x, vy, top, 0.002, GRAY, 0.7); rod(x, vy, 0, x, vy, top + 0.01, 0.006, GRAY); } // a post at each end of the string
  rod(vx, vy, top, vx, vy, z1, 0.0015, GRAY, 0.7);
  const lw = Math.max(0.016, 0.55 * d / projX); // a cell wide at least, far off
  drawBox(boxAt(vx, vy, 1, 0, lw, lw, z0, z1), (i, t, L) => {
    const cap = HIT.w > z1 - 0.008 || HIT.w < z0 + 0.008;
    BG[i] = cap ? C(GRAY, 2) : C(RED, 3 + lit * 9 + L * 0.2);
    return set(i, cap ? '=' : lit > 0.3 ? '@' : ' ', C(YEL, 15)), true;
  });
}

// a bicycle parked along a shopfront (o.c, o.s: the way it points): two spoked wheels, a diamond frame, a saddle and
// handlebars. Far off, just the wheels and the line of the frame.
const BIKE = { r: 0.032, hub: 0.055 };
// a tube that always fills its cells (rod() only backs one once it's wider than a character): thin parts stay solid
function tube(ax, ay, az, bx, by, bz, r, col, bg, k = 1) {
  drawRod(ax, ay, az, bx, by, bz, r, (i, t, L) => {
    BG[i] = C(col, bg + L * 0.2);
    return set(i, courierGlyph(HIT.u, HIT.v, HIT.w, bx - ax, by - ay, bz - az), C(WHITE, L * k)), true;
  });
}
function drawBike(o, vx, vy) {
  const d = Math.hypot(vx, vy), c = o.c, s = o.s, col = o.bike, r = BIKE.r;
  if (d > vis) return;
  const at = (u, w = 0) => [vx + c * u - s * w, vy + s * u + c * w];
  const bar = (u0, z0, u1, z1, rr = 0.004, w0 = 0, w1 = 0) => { const [ax, ay] = at(u0, w0), [bx, by] = at(u1, w1); tube(ax, ay, z0, bx, by, z1, rr, col, 1.6, 0.5); };
  for (const hu of [-BIKE.hub, BIKE.hub]) { // the wheels: a tyre round in pieces, spokes up close
    const segs = d < 7 ? 10 : 5;
    for (let k = 0; k < segs; k++) {
      const a0 = k / segs * Math.PI * 2, a1 = (k + 1) / segs * Math.PI * 2;
      const [ax, ay] = at(hu + Math.cos(a0) * r), [bx, by] = at(hu + Math.cos(a1) * r);
      tube(ax, ay, r + Math.sin(a0) * r, bx, by, r + Math.sin(a1) * r, 0.005, GRAY, 0.5, 0.6);
    }
    if (d < 4) for (const a of [0.4, 1.97]) {
      const [ax, ay] = at(hu - Math.cos(a) * r), [bx, by] = at(hu + Math.cos(a) * r);
      rod(ax, ay, r - Math.sin(a) * r, bx, by, r + Math.sin(a) * r, 0.001, GRAY, 0.6);
    }
  }
  // the frame: chainstays, seat stays, seat tube, down tube, top tube, the fork, the stem and bars
  const bb = [-0.008, 0.03], seat = [-0.025, 0.078], head = [0.035, 0.08];
  bar(-BIKE.hub, r, ...bb); bar(-BIKE.hub, r, ...seat); bar(...bb, ...seat); bar(...bb, ...head); bar(...seat, ...head);
  bar(...head, BIKE.hub, r);
  bar(...head, head[0] - 0.006, 0.096);
  { const [ax, ay] = at(head[0] - 0.006, -0.022), [bx, by] = at(head[0] - 0.006, 0.022); tube(ax, ay, 0.096, bx, by, 0.096, 0.004, GRAY, 0.9, 0.7); } // the handlebars, across
  const [sx, sy] = at(seat[0] - 0.003);
  drawBox(boxAt(sx, sy, c, s, 0.014, 0.006, 0.084, 0.092), (i, t, L) => { BG[i] = C(GRAY, 0.6); return set(i, HIT.face === 5 ? '=' : '_', C(GRAY, L * 0.5)), true; });
  bar(seat[0], seat[1], seat[0] - 0.003, 0.084);
}

// a line of a flat sign's text, small (block letters, when they fit, are signGlyph's). Each letter shows in exactly
// one cell: the column its middle projects into, so none doubles across two cells and none is skipped while there's
// room for it, on the row the line's middle projects into at the sign's middle, so the line stays straight on screen
// even seen at an angle. zc: the line's middle height; tc: the sign's middle depth (see midDepth); (ex, ey): the way the
// text runs, a unit vector. hz only matters for blocks.
function signLine(word, lq, hz, i, zc, tc, t, letterW, bandH, far, ex, ey) {
  if (signIsBig(letterW, bandH, far)) return signGlyph(word, lq, hz, t, letterW, bandH, far);
  const k = Math.floor(lq);
  if (k < -1 || k > word.length) return null;
  if (Math.floor(i / cols) !== Math.floor(hor - (zc - eye) * projY / tc)) return ' ';
  const c = i % cols, cx = 2 * (c + 0.5) / cols - 1, X = (dx - dy * tf * cx) * t, Y = (dy + dx * tf * cx) * t; // where this cell's ray met the sign
  let best = ' ', bd = Infinity;
  for (let j = Math.max(0, k - 1); j <= Math.min(word.length - 1, k + 1); j++) { // this letter or a neighbour, whichever's middle lands here
    const off = (j + 0.5 - lq) * letterW, PX = X + ex * off, PY = Y + ey * off, dep = dx * PX + dy * PY;
    if (dep > 0.05 && Math.floor(cols / 2 + (-dy * PX + dx * PY) * projX / dep) === c && Math.abs(off) < bd) { bd = Math.abs(off); best = word[j]; }
  }
  return best;
}
const midDepth = (vx, vy) => Math.max(0.05, dx * vx + dy * vy);
// Flat prop labels share the shop font and project each distant letter once.
// (ex, ey) runs left-to-right on the visible face; reverse it on the back.
function worldText(word,u,z,t,i,vx,vy,zc,ex,ey,letterW,bandH) {
  const far=Math.max(.05,dx*vx+dy*vy+Math.abs(dx*ex+dy*ey)*word.length*letterW/2);
  return signLine(word,u/letterW+word.length/2,(zc+bandH/2-z)/bandH,i,zc,midDepth(vx,vy),t,letterW,bandH,far,ex,ey)||' ';
}
// the way a broad face's text runs (see faceQ), for a box along (c, s)
const faceDir = (c, s) => HIT.face === 3 ? [c, s] : [-c, -s];
// which way a broad face (3: +v, 4: -v) reads: 0 at its left edge, 1 at its right, as you look at it
const faceQ = (u, hl) => HIT.face === 3 ? (u + hl) / (2 * hl) : (hl - u) / (2 * hl);

// a cloth banner hung across the Shotengai from the arcade roof: a rail along its top on two cords, the word on both
// sides, a border in a brighter weave and a fringe along the bottom. o.c, o.s: the way the street runs (it faces that way).
function drawBanner(o, vx, vy) {
  const d = Math.hypot(vx, vy);
  if (d > vis) return;
  const word = o.banner, n = word.length + 4, hw = 0.0225 * n, z0 = o.z + 0.012, z1 = o.z + 0.1, c = o.c, s = o.s, glow = Math.max(night, overcast * 0.6);
  const at = v => [vx - s * v, vy + c * v], far = farDepth(vx, vy, hw), tc = midDepth(vx, vy), band0 = z0 + 0.025, bandH = 0.05;
  { const [ax, ay] = at(-hw - 0.01), [bx, by] = at(hw + 0.01); rod(ax, ay, z1 + 0.004, bx, by, z1 + 0.004, 0.004); } // the rail
  for (const e of [-1, 1]) { const [x, y] = at(e * hw * 0.85); rod(x, y, z1 + 0.004, x, y, ARCADE_Z, 0.0015, GRAY, 0.6); }
  drawBox(boxAt(vx, vy, c, s, 0.003, hw, z0, z1), (i, t, L) => {
    const f = HIT.face, v = HIT.v, w = HIT.w;
    if (w < z0 + 0.01 && fract((v + hw) * 45) > 0.5) return false; // the fringe
    const edge = Math.min(hw - Math.abs(v), z1 - w, w - z0 - 0.01) < 0.01;
    BG[i] = C(o.col, (edge ? 3.5 : 2.2) + L * 0.3 + glow * (edge ? 3 : 1));
    if (f !== 1 && f !== 2 || edge) return set(i, ' ', 0), true;
    const q = f === 1 ? (hw - v) / (2 * hw) : (v + hw) / (2 * hw);
    return set(i, signLine(word, q * n - 2, (band0 + bandH - w) / bandH, i, band0 + bandH / 2, tc, t, 2 * hw / n, bandH, far, ...(f === 1 ? [s, -c] : [-s, c])) ?? ' ', C(WHITE, Math.max(L, 10))), true;
  });
}

// the aquarium's sign: a neon fish in glass tube mounted off the wall over the doors, drawn as tube outlines on the
// sign's plane (a body, a forked tail, a gill, its eye), cyan with an orange tail and a white eye. Flickers after dark.
const FISH_W = 0.15, FISH_H = 0.13;
const segDist = (x, z, ax, az, bx, bz) => { const ex = bx - ax, ez = bz - az, k = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1); return Math.hypot(x - ax - ex * k, z - az - ez * k); };
function fishTube(x, z, th) { // which tube (x, z) is on, if any: x along the fish (+ toward the snout), z up from its middle
  if (Math.hypot(x - 0.065, z - 0.012) < Math.max(0.01, th * 1.2)) return WHITE; // the eye
  const e = Math.hypot((x - 0.02) / 0.095, z / 0.05);
  if (Math.abs(e - 1) * 0.05 < th && x > -0.07) return CYAN; // the body
  if (x > 0.015 && x < 0.04 && Math.abs(Math.hypot((x + 0.01) / 0.045, z / 0.04) - 1) * 0.04 < th) return CYAN; // the gill
  if (segDist(x, z, -0.068, 0, -0.14, 0.045) < th || segDist(x, z, -0.068, 0, -0.14, -0.045) < th || segDist(x, z, -0.14, 0.045, -0.12, 0) < th && x < -0.12 || segDist(x, z, -0.14, -0.045, -0.12, 0) < th) return ORANGE; // the tail
  return -1;
}
function drawFishSign(o, vx, vy) {
  if (Math.hypot(vx, vy) > vis) return;
  const on = night * (fract(T * 0.4) < 0.96 ? 1 : 0.4), zm = o.z + FISH_H / 2;
  for (const e of [-1, 1]) rod(vx + e * FISH_W * 0.5, vy - 0.03, zm, vx + e * FISH_W * 0.5, vy, zm, 0.002, GRAY, 0.6); // the stand-offs
  drawBox(boxAt(vx, vy, 1, 0, FISH_W, 0.004, o.z, o.z + FISH_H), (i, t, L) => {
    if (HIT.face !== 3 && HIT.face !== 4) return false;
    const th = Math.max(0.005, 0.55 * t / projY), col = fishTube((faceQ(HIT.u, FISH_W) * 2 - 1) * FISH_W, HIT.w - zm, th);
    if (col < 0) return false;
    BG[i] = C(col, 2 + L * 0.25 + on * 7);
    return set(i, ' ', 0), true;
  });
}

// ---- a tower crane, like the one on the courier route: a latticed mast (rayLattice, courier-ui.js), a truss jib and
// counter-jib slewing round on top, a cab, counterweights, the apex with its ties out to both, and the trolley's
// cable, hook and a slung load of beams. th: which way the jib points now. (k.tro, k.hz: set in citySprites)
function craneTruss(b, col, solid) { // solid: too far off for its lattice to read, a beam (as the old crane drew it)
  if (solid) return drawBox(b, (i, t, L) => { BG[i] = C(col, (0.9 + L * 0.2) * shadeFace(HIT.face)); return set(i, b.kind === 'mast' ? '|' : '=', C(col, L)), true; });
  drawBox(b, (i, t, L) => {
    const [ux, uy, uz] = latticeDirection(b, HIT.part, HIT.face);
    return set(i, courierGlyph(b.x + HIT.u * b.c - HIT.v * b.s, b.y + HIT.u * b.s + HIT.v * b.c, HIT.w, ux, uy, uz), C(col, L)), true;
  }, rayLattice);
}
function drawCrane(k, vx, vy, th) {
  const H = k.H, c = Math.cos(th), s = Math.sin(th), top = H + JH, apex = H + 0.75, at = u => [vx + c * u, vy + s * u], d = Math.hypot(vx, vy);
  const farMast = 2 * MW * projX / d < 2, farJib = JH * projY / d < 3;
  const steel = (i, t, L) => { BG[i] = C(YEL, (1.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, ' ', 0), true; };
  craneTruss({ x: vx, y: vy, c: 1, s: 0, hl: MW, hw: MW, z0: 0, z1: H, panel: PANEL, kind: 'mast' }, YEL, farMast);
  { const [x, y] = at(JIB / 2); craneTruss({ x, y, c, s, hl: JIB / 2, hw: MW * 0.8, z0: H, z1: top, panel: JH * 1.4, kind: 'truss' }, YEL, farJib); }
  { const [x, y] = at(-CJIB / 2); craneTruss({ x, y, c, s, hl: CJIB / 2, hw: MW, z0: H, z1: top, panel: JH * 1.4, kind: 'truss' }, YEL, farJib); }
  drawBox(boxAt(vx, vy, c, s, MW + 0.02, MW + 0.02, H - 0.05, H), steel); // the slewing ring
  { const [x, y] = at(-CJIB * 0.8); drawBox(boxAt(x, y, c, s, 0.2, MW * 1.1, H - 0.3, H), (i, t, L) => { // the counterweights
    BG[i] = C(GRAY, (1 + L * 0.25) * shadeFace(HIT.face)); return set(i, fract((HIT.u + 0.2) * 15) < 0.15 ? '|' : '#', C(GRAY, L * 0.7)), true; }); }
  { const [x, y] = at(MW + 0.09); drawBox(boxAt(x, y, c, s, 0.08, 0.07, H - 0.22, H), (i, t, L) => { // the operator's cab, hung under the jib
    if (HIT.w > H - 0.13 && HIT.face !== 5 && HIT.face !== 6) { BG[i] = C(CYAN, 1.5 + night * 4); return set(i, ':', C(CYAN, Math.max(L, night * 12))), true; }
    return steel(i, t, L); }); }
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) rod(vx + sx * MW, vy + sy * MW, top, vx, vy, apex, 0.008, YEL); // the apex
  for (const u of [JIB * 0.7, -CJIB]) { const [x, y] = at(u); rod(vx, vy, apex, x, y, top, 0.003, GRAY, 0.8); } // its ties
  const [tx, ty] = at(JIB * k.tro), hz = k.hz;
  drawBox(boxAt(tx, ty, c, s, 0.05, MW * 0.9, H - 0.05, H), steel); // the trolley
  rod(tx, ty, H - 0.05, tx, ty, hz, 0.003, GRAY, 0.8);
  drawBox(boxAt(tx, ty, c, s, 0.02, 0.02, hz - 0.08, hz), (i, t, L) => { BG[i] = C(GRAY, 1.2); return set(i, 'J', C(YEL, L)), true; }); // the hook block
  for (const e of [-1, 1]) { const [ax, ay] = [tx - s * e * 0.04, ty + c * e * 0.04]; rod(tx, ty, hz - 0.08, ax, ay, hz - 0.14, 0.002, GRAY, 0.7); } // the slings
  drawBox(boxAt(tx, ty, c, s, 0.3, 0.05, hz - 0.22, hz - 0.14), (i, t, L) => { // the load: a bundle of steel beams
    BG[i] = C(ORANGE, (1.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 1 || HIT.face === 2 ? 'I' : '=', C(BRICK, L * 0.8)), true; });
  if (night > 0.3 || overcast > 0.5) { // red warning lights on the apex and the jib tip
    const on = fract(T * 0.7) < 0.5, red = (i, t, L) => { if (on) BG[i] = C(RED, 8); return set(i, '*', C(RED, on ? 15 : 4)), true; }, rr = Math.max(0.03, 0.6 * Math.hypot(vx, vy) / projX);
    dot(vx, vy, apex + 0.02, rr, red); { const [x, y] = at(JIB); dot(x, y, top + 0.02, rr, red); }
  }
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
  vehicleDrawBox(boxAt(vx + hx * mo, vy + hy * mo, hx, hy, mhl, hw, 0.012, MH), (i, t, L) => { // the box
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
  vehicleDrawBox(boxAt(vx + hx * co, vy + hy * co, hx, hy, chl, hw * 0.94, 0.012, CH), (i, t, L) => { // the cab
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
  vehicleDrawBox(boxAt(vx + hx * lb, vy + hy * lb, hx, hy, 0.018, hw * 0.85, MH, MH + 0.016), (i, t, L) => {
    const side = HIT.v > 0 ? RED : BLUE, on = !m.wrecked && lightsOn_(m) && strobe() === side;
    BG[i] = C(side, on ? 15 : 3); return set(i, on ? '*' : '=', C(on ? WHITE : side, on ? 15 : 7)), true;
  });
  for (const s of [-1, 1]) vehicleDrawBox(boxAt(vx + hx * (mo - mhl + 0.012) - hy * s * hw * 0.8, vy + hy * (mo - mhl + 0.012) + hx * s * hw * 0.8, hx, hy, 0.01, 0.012, MH, MH + 0.012), (i, t, L) => {
    const on = lightsOn_(m) && strobe() === (s > 0 ? RED : BLUE);
    BG[i] = C(RED, on ? 15 : 4); return set(i, on ? '*' : ' ', C(WHITE, 15)), true;
  });
}
// a car on fire (damage.js): flames out of the bonnet, licking up the windscreen, higher as it goes on
function drawCarFire(m, vx, vy, hx, hy) {
  if (!burning(m)) return;
  const [hl, hw, top] = VEHICLES[m.kind], fx_ = vx + hx * hl * 0.55, fy_ = vy + hy * hl * 0.55, tall = 0.07 + 0.12 * Math.min(1, m.fireT / BURN_T);
  const flame = (i, t, L) => { // ragged: tongues of yellow and orange with the street showing between them
    const hot = hash(i, Math.floor(T * 14), m.id);
    if (hot < 0.3) return false;
    BG[i] = C(hot > 0.75 ? YEL : hot > 0.5 ? ORANGE : RED, 7 + hot * 8); return set(i, hot > 0.65 ? '^' : hot > 0.45 ? '(' : ')', C(hot > 0.85 ? WHITE : YEL, 15)), true;
  };
  for (let k = 0; k < 4; k++) { // four tongues across the bonnet, each leaping and dropping on its own
    const s_ = (k - 1.5) * hw * 0.5, fl = 0.45 + 0.55 * Math.abs(Math.sin(T * (9 + k * 2.3) + k * 1.7)), sway = 0.025 * Math.sin(T * 6 + k * 2);
    drawRod(fx_ - hy * s_, fy_ + hx * s_, top, fx_ - hy * s_ + hx * sway, fy_ + hx * s_ + hy * sway, top + tall * fl, 0.016, flame);
  }
}
let vehicleDrawFrame=null;
function vehicleDrawBox(b,shade) {
  const frame=vehicleDrawFrame;
  if(!frame?.tilted)return drawBox(b,shade);
  const {f,side,up,hx,hy,vx,vy}=frame;
  const turn=(x,y,z)=>{
    const u=x*hx+y*hy,v=-x*hy+y*hx;
    return [f[0]*u+side[0]*v+up[0]*z,f[1]*u+side[1]*v+up[1]*z,f[2]*u+side[2]*v+up[2]*z];
  };
  // Conservative world bounds retain drawBox's normal culling and depth tests.
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
  for(const u of [-b.hl,b.hl])for(const v of [-b.hw,b.hw])for(const z of [b.z0,b.z1]) {
    const q=turn(b.x-vx+u*b.c-v*b.s,b.y-vy+u*b.s+v*b.c,z);
    x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);z0=Math.min(z0,q[2]);z1=Math.max(z1,q[2]);
  }
  const envelope=boxAt(vx+(x0+x1)/2,vy+(y0+y1)/2,1,0,(x1-x0)/2,(y1-y0)/2,z0,z1);
  const inverse=(x,y,z)=>{
    const u=x*f[0]+y*f[1]+z*f[2],v=x*side[0]+y*side[1]+z*side[2];
    return [hx*u-hy*v,hy*u+hx*v,x*up[0]+y*up[1]+z*up[2]];
  };
  const origin=inverse(-vx,-vy,eye);
  drawBox(envelope,shade,(ox,oy,oz,rx,ry,rz)=>{
    const r=inverse(rx,ry,rz);
    return rayBox(origin[0]+vx,origin[1]+vy,origin[2],r[0],r[1],r[2],b);
  });
}
function drawVehicle(m, vx, vy, hx, hy) {
  const savedEye=eye,savedFrame=vehicleDrawFrame;
  const frame=vehicleGroundFrame(VEHICLES[m.kind],px+vx,py+vy,hx,hy);
  eye-=frame.z;vehicleDrawFrame={...frame,vx,vy};
  try { drawVehicleBody(m, vx, vy, hx, hy); }
  finally { eye=savedEye;vehicleDrawFrame=savedFrame; }
}
function drawVehicleBody(m, vx, vy, hx, hy) {
  drawCarFire(m, vx, vy, hx, hy);
  if (m.kind === 'amb') return drawAmbulance(m, vx, vy, hx, hy);
  const [hl, hw, top, cab, chl, cof] = VEHICLES[m.kind], wreck = !!m.wrecked, lightsOn = !wreck && (night > 0.4 || overcast > 0.5);
  // damage (damage.js): dents and scrapes over the body, more of them the worse it is; a wreck is burnt black
  const dmg = m.dmg || 0, dented = (u, w) => dmg >= DMG_DENTS && hash(Math.floor(u * 22), Math.floor(w * 40), m.id) < (dmg - 15) / 160;
  const alarmFlash = carAlarming(m) && fract(T * 1.5) < 0.5; // (an alarm going: every light on it flashing)
  const fobBlinking = m.owned && m.fobBlinkAt !== undefined && T - m.fobBlinkAt < 2.4 || carAlarming(m);
  const fobHeadlight = !fobBlinking || (carAlarming(m) ? alarmFlash : Math.floor((T - m.fobBlinkAt) * 4) % 2 === 0);
  const braking = !wreck && (m.brake || m.v < 0.05), body = wreck ? GRAY : m.body, burnt = wreck ? 0.35 : 1;
  // body: wheels and a dark sill along the bottom, headlights and grille at the front, tail lights at the back
  vehicleDrawBox(boxAt(vx, vy, hx, hy, hl, hw, 0.012, top), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w, k = shadeFace(f);
    BG[i] = C(body, (1.5 + L * 0.45) * k * burnt);
    if (wreck) return set(i, hash(Math.floor(u * 30), Math.floor(w * 50), m.id) < 0.3 ? '%' : f === 5 ? '.' : ' ', C(GRAY, 2 + L * 0.2)), true; // (scorched)
    if (f > 2 && f < 5 && w > 0.025 && dented(u, w)) { BG[i] = C(body, (0.8 + L * 0.3) * k); return set(i, hash(i, m.id, 3) < 0.5 ? '%' : '~', C(GRAY, 4 + L * 0.3)), true; }
    if (f === 5) return set(i, m.kind === 'amb' && Math.abs(u) < 0.05 && Math.abs(v) < 0.05 ? '+' : ' ', C(RED, 12)), true;
    if (f === 1) return set(i, w < 0.05 && Math.abs(v) > hw * 0.55 ? 'O' : w < 0.04 ? '=' : ' ', w < 0.05 && Math.abs(v) > hw * 0.55 ? C(fobBlinking ? (fobHeadlight ? WHITE : BLACK) : WHITE, fobBlinking || lightsOn ? 15 : 10) : C(GRAY, L * 0.5)), true;
    if (f === 2) return set(i, w < 0.055 && w > 0.03 && Math.abs(v) > hw * 0.55 ? ']' : ' ', C(RED, braking || alarmFlash ? 15 : 8)), true;
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
  if (cab) vehicleDrawBox(boxAt(vx + hx * cof, vy + hy * cof, hx, hy, chl, hw * 0.9, top, cab), (i, t, L) => {
    const f = HIT.face, u = HIT.u, v = HIT.v, w = HIT.w;
    if (f === 5 || f === 6) { BG[i] = C(body, (1.5 + L * 0.45) * shadeFace(f)); return set(i, ' ', 0), true; }
    const edge = f <= 2 ? Math.abs(v) > hw * 0.8 : Math.abs(u - cof) > chl * 0.85;
    if (edge || w > cab - 0.008) { BG[i] = C(body, (1.5 + L * 0.45) * 0.8 * burnt); return set(i, '|', C(body, L * 0.5)), true; }
    if (wreck) { BG[i] = C(GRAY, 0.6); return set(i, hash(i, m.id, 5) < 0.2 ? '\\' : ' ', C(GRAY, 3)), true; } // (the windows gone)
    BG[i] = C(CYAN, 1 + L * 0.12);
    if (dmg >= DMG_SMOKE && hash(Math.floor(u * 40 + v * 13), Math.floor(w * 60), m.id + 9) < 0.18) return set(i, hash(i, 7, m.id) < 0.5 ? '/' : '*', C(WHITE, 9 + L * 0.2)), true; // cracked
    return set(i, ' ', 0), true;
  });
  const roof = cab || top; // what sits on the roof
  if (m.kind === 'taxi') vehicleDrawBox(boxAt(vx, vy, hx, hy, 0.03, 0.05, roof, roof + 0.02), (i, t, L) => {
    BG[i] = C(YEL, lightsOn ? 13 : 9); return set(i, HIT.face <= 4 ? '=' : ' ', C(GRAY, 3)), true;
  });
  if (m.ev || m.patrol) vehicleDrawBox(boxAt(vx + hx * (m.kind === 'amb' ? hl * 0.7 : 0), vy + hy * (m.kind === 'amb' ? hl * 0.7 : 0), hx, hy, 0.02, hw * 0.8, roof, roof + 0.015), (i, t, L) => {
    const side = HIT.v > 0 ? RED : BLUE, on = !wreck && lightsOn_(m) && strobe() === side; // the light bar: red on one side, blue the other
    BG[i] = C(side, on ? 15 : 3); return set(i, on ? '*' : '=', C(on ? WHITE : side, on ? 15 : 7)), true;
  });
  if (m.kind === 'fire') vehicleDrawBox(boxAt(vx - hx * 0.05, vy - hy * 0.05, hx, hy, 0.28, 0.035, top, top + 0.025), (i, t, L) => {
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
      const n = o.word.length + 2, ch = signLine(o.word, q * n - 1, (0.33 - w) / 0.07, i, 0.295, midDepth(rel(o.x - px), rel(o.y - py)), t, 2 * o.hl / n, 0.07, farDepth(rel(o.x - px), rel(o.y - py), o.hl), o.fs * o.c, o.fs * o.s);
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
    const n = o.word.length + 2, ch = signLine(o.word, q * n - 1, (0.255 - w) / 0.045, i, 0.2325, midDepth(rel(o.x - px), rel(o.y - py)), t, 2 * o.hl / n, 0.045, farDepth(rel(o.x - px), rel(o.y - py), o.hl), o.fs * o.c, o.fs * o.s);
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
// the lighthouse: a tapering tower (one frustum) in red and white bands with a door and slit windows, a railed gallery,
// the glazed lantern room with the lamp, a red dome and its vent. flare = how squarely a beam points at you (the lamp
// blazes)
const LH_BAND = 0.44, LH_TOWER = 2.2;
function drawLighthouse(lx, ly, flare) {
  const d = Math.hypot(lx, ly), minR = 0.55 * d / projX, lit = beamLit(), vxn = -lx / (d || 1), vyn = -ly / (d || 1);
  drawBox({ x: lx, y: ly, c: 1, s: 0, hl: Math.max(minR, 0.24), hw: Math.max(minR, 0.24), r1: Math.max(minR, 0.24 - LH_TOWER * 0.035), z0: 0, z1: LH_TOWER }, (i, t, L) => {
    const ang = Math.atan2(HIT.v, HIT.u), light = frustumLit(), w = HIT.w;
    if (HIT.face !== 3) { BG[i] = C(GRAY, 2); return set(i, ' ', 0), true; }
    if (w < 0.22 && Math.abs(ang + Math.PI / 2) < 0.22) { BG[i] = C(GRAY, 1); return set(i, w > 0.19 ? '=' : '#', C(BRICK, L * 0.6)), true; } // the door (facing -y)
    if ([0.75, 1.25, 1.75].some(z => Math.abs(w - z) < 0.06) && Math.abs(Math.abs(ang) - Math.PI / 2) < 0.12) { BG[i] = C(GRAY, 1); return set(i, '#', C(WARM, Math.max(L * 0.3, lit * 9))), true; } // slit windows
    BG[i] = Math.floor(w / LH_BAND) & 1 ? C(RED, (2 + L * 0.5) * light) : C(WHITE, (5 + L * 0.6) * light); // the bands, painted on
    return set(i, ' ', 0), true;
  }, rayFrustum);
  drawBox(boxAt(lx, ly, 1, 0, 0.3, 0.3, LH_TOWER, 2.27), (i, t, L) => { BG[i] = C(GRAY, 3 + L * 0.3); return set(i, HIT.face === 5 ? ' ' : '=', C(WHITE, L)), true; }, rayCopperDrum); // the gallery
  drawBox(boxAt(lx, ly, 1, 0, 0.29, 0.29, 2.27, 2.34), (i, t, L) => { // its railing: posts and a top rail, the lantern room showing between
    if (HIT.w > 2.32 || HIT.face === 5) return set(i, '-', C(WHITE, L * 0.9)), true;
    return fract(Math.atan2(HIT.v, HIT.u) * 8 / Math.PI) < 0.3 ? (set(i, '|', C(WHITE, L * 0.9)), true) : false;
  }, rayCopperDrum);
  drawBox(boxAt(lx, ly, 1, 0, Math.max(minR, 0.15), Math.max(minR, 0.15), 2.27, 2.62), (i, t, L) => { // the lantern room
    const across = HIT.u * -vyn + HIT.v * vxn; // (from the axis, as you see it)
    if (lit && Math.abs(across) < 0.075 && Math.abs(HIT.w - LH_H) < 0.07) { BG[i] = C(YEL, 8 + flare * 7); return set(i, '@', C(WHITE, 15)), true; }
    if (HIT.face === 5) { BG[i] = C(RED, 2); return set(i, ' ', 0), true; }
    BG[i] = C(CYAN, 1 + lit * 3); return set(i, fract(Math.atan2(HIT.v, HIT.u) * 7 / Math.PI) < 0.15 ? '|' : ' ', C(GRAY, L * 0.8)), true;
  }, rayCopperDrum);
  drawBox(boxAt(lx, ly, 1, 0, Math.max(minR, 0.17), Math.max(minR, 0.17), 2.62, 2.79), (i, t, L) => { BG[i] = C(RED, 2 + L * 0.35); return set(i, ' ', 0), true; }, rayCone); // the dome
  rod(lx, ly, 2.78, lx, ly, 2.88, 0.008); // the vent and lightning rod
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
  if (inView(lx, ly, 0.35)) drawLighthouse(lx, ly, flare); // (its beams sweep on regardless)
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
    return set(i, signLine(FB_SIGN, q, (0.35 - HIT.w) / 0.045, i, 0.3275, midDepth(gx, gy), t, 2 * (hw + 0.012) / n, 0.045, farDepth(gx, gy, hw), ...faceDir(1, 0)) || ' ', C(WHITE, Math.max(L * 1.2, night * 14))), true;
  });
}

// The shared slatted bench; s=.01 outdoors in cells and .1 indoors in metres.
function drawBench(vx,vy,fx,fy,s,base=0) {
  drawFurnitureBench(vx,vy,.75,fx,fy,BRICK,true,s/.1,base);
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
    if (HIT.face !== 3 && HIT.face !== 4) return set(i, ' ', 0), true; // (3 / 4: its broad faces, across the stairwell)
    const n = name.length + 2, q = faceQ(HIT.u, hw) * n - 1;
    return set(i, signLine(name, q, (0.125 - HIT.w) / 0.035, i, 0.1075, midDepth(vx + hl, vy), t, 2 * hw / n, 0.035, farDepth(vx, vy, hl + hw), ...faceDir(0, 1)) || ' ', C(WHITE, 15)), true;
  });
  // and a tall lit blade on a post at two corners, SUBWAY down both faces and a green lamp on top: seen from down the
  // block either way
  for (const blade of s.blades) subwayBlade(vx + rel(blade.x-s.x),vy + rel(blade.y-s.y),iron);
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
  // Grow the cord to one character cell at a distance, keeping the same dark material as it widens.
  const d = Math.hypot(vx, vy), th = Math.max(0.004, 0.55 * d / projY), tw = Math.max(0.004, 0.55 * d / projX);
  const segs = 8, cord = i => { BG[i] = C(GRAY, 1); return set(i, '-', C(GRAY, 2)), true; };
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

// a tapering round tower (b.hl at the foot, b.r1 at the top, z0..z1): one true frustum, so a taper has no ledges.
// Hits its side (face 3), its top (5) or its foot (6); HIT.u, v, w the point, local.
function rayFrustum(ox, oy, oz, rx, ry, rz, b) {
  const x = ox - b.x, y = oy - b.y, k = (b.hl - b.r1) / (b.z1 - b.z0), A = b.hl - k * (oz - b.z0), B = k * rz;
  const qa = rx * rx + ry * ry - B * B, qb = x * rx + y * ry + A * B, qc = x * x + y * y - A * A;
  let best = Infinity, face = 3;
  const side = t => { const w = oz + rz * t; if (t > 0.01 && t < best && w >= b.z0 && w <= b.z1 && A - B * t > 0) best = t; };
  if (Math.abs(qa) > 1e-12) { const d = qb * qb - qa * qc; if (d >= 0) { const r = Math.sqrt(d); side((-qb - r) / qa); side((-qb + r) / qa); } }
  else if (Math.abs(qb) > 1e-12) side(-qc / (2 * qb));
  if (Math.abs(rz) > 1e-12) for (const [z, r, f] of [[b.z1, b.r1, 5], [b.z0, b.hl, 6]]) {
    const t = (z - oz) / rz;
    if (t > 0.01 && t < best && (x + rx * t) ** 2 + (y + ry * t) ** 2 <= r * r) { best = t; face = f; }
  }
  if (best === Infinity) return -1;
  HIT.u = x + rx * best; HIT.v = y + ry * best; HIT.w = oz + rz * best; HIT.face = face;
  return best;
}
const frustumLit = () => 0.55 + 0.45 * Math.max(0, (-HIT.u * 0.55 + HIT.v * 0.35) / (Math.hypot(HIT.u, HIT.v) || 1)); // (lit from over your left shoulder)
// a factory smokestack: one tapering brick tower with rings round it, red and white bands at the top, a dark mouth;
// a cell wide at least, far off
function drawStack(s, vx, vy) {
  const H = s.H, minR = 0.55 * Math.hypot(vx, vy) / projX;
  drawBox({ x: vx, y: vy, c: 1, s: 0, hl: Math.max(minR, 0.16), hw: Math.max(minR, 0.16), r1: Math.max(minR, 0.11), z0: s.z, z1: s.z + H }, (i, t, L) => {
    if (HIT.face === 5) { BG[i] = C(GRAY, 0.5); return set(i, ' ', 0), true; } // the mouth
    const w = HIT.w - s.z, light = frustumLit(), striped = w > H - 0.5;
    BG[i] = striped ? C(fract(w * 4) < 0.5 ? RED : WHITE, (1.6 + L * 0.35) * light) : C(BRICK, (1.2 + L * 0.3) * light);
    return set(i, striped ? ' ' : fract(w * 6) < 0.15 ? '=' : ' ', C(BRICK, L * 0.7)), true;
  }, rayFrustum);
}
// its smoke: curling off downwind as it rises (z from the stack's top)
function smokeCell(i, u, sz, L, s) {
  const cu = u - sz * 0.6 - Math.sin(T * 0.3 + s.x) * 0.1 * sz; // drifts downwind as it rises
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
    if (Math.abs(vx) > vis + 2 || Math.abs(vy) > vis + 2 || !inView(vx, vy, 1.3)) continue;
    drawBridgeTower(vx, vy);
  }
  forNear(bridgeB, b => {
    const [vx, vy] = R(b.x, b.y);
    if (Math.abs(vx) > vis + 1 || Math.abs(vy) > vis + 1 || !inView(vx, vy, 0.6)) return;
    if (b.kind === 'hanger') return rod(vx, vy, b.z, vx, vy, b.z + b.h, 0.008, GRAY, 0.7);
    if (b.z2 != null) rod(vx, vy, b.z, vx, vy + 0.5, b.z2, 0.025, GRAY, 0.9); // the main cable, on to the next point
    if (night > 0.4) dot(vx, vy, b.z, Math.max(0.035, 0.6 * Math.hypot(vx, vy) / Math.min(projX, projY)), (i, t, L) => { BG[i] = C(WARM, 6); return set(i, '*', C(WARM, 15)), true; }); // its necklace of lights (kept wider than the cable, which is a character wide far off, so they show)
  });
}
// a bridge tower: two steel legs either side of the deck, banded where the sections join, three crossbeams, and a red
// beacon blinking on each leg after dark
const TOWER_LEG = 0.95;
function drawBridgeTower(vx, vy) {
  const lw = Math.max(0.1, 0.55 * Math.hypot(vx, vy) / projX), top = TOWER_H + 0.4;
  const steel = (i, t, L) => {
    BG[i] = C(GRAY, (1.3 + L * 0.3) * shadeFace(HIT.face));
    return set(i, HIT.face >= 5 ? '#' : fract(HIT.w * 3) < 0.1 ? '=' : '|', C(GRAY, L * 1.1)), true;
  };
  for (const e of [-1, 1]) drawBox(boxAt(vx + e * TOWER_LEG, vy, 1, 0, lw, lw * 1.2, 0, top), steel);
  for (const z of [1.2, 4, TOWER_H]) drawBox(boxAt(vx, vy, 1, 0, TOWER_LEG, lw * 0.9, z - 0.12, z + 0.12), (i, t, L) => {
    BG[i] = C(GRAY, (1.2 + L * 0.3) * shadeFace(HIT.face)); return set(i, z === TOWER_H ? '#' : '=', C(GRAY, L)), true;
  });
  if (night > 0.3) for (const e of [-1, 1]) dot(vx + e * TOWER_LEG, vy, top + 0.06, Math.max(0.05, lw * 0.8), (i, t, L) => {
    const on = fract(T * 0.7) < 0.5; if (on) BG[i] = C(RED, 8); return set(i, '*', C(RED, on ? 15 : 4)), true;
  });
}

// one el car as a real box running east-west: steel sides with a red stripe, a band of windows (lit warm after dark),
// a pair of doors each side, a driver's cab with headlights at the leading and trailing ends (cab: +1 / -1 = which
// end, 0 = none), an air-conditioning hump on the roof and a dark underframe
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
const EL_BOARD_CACHE=new Map();
function drawElStation(station){
 for(const tr of [0,1]){
  const y=tr?EL_Y1+EL_PLATFORM_OUT/2:EL_Y0-EL_PLATFORM_OUT/2,[vx,vy]=R((station.x0+station.x1)/2,y);
  drawBox(boxAt(vx,vy,1,0,(station.x1-station.x0)/2,EL_PLATFORM_OUT/2,EL_TOP-.025,EL_TOP),STEEL.cap);
  const key=station.name+tr,cached=EL_BOARD_CACHE.get(key);
  const service=cached?.t===Math.floor(T)?cached.service:elNextArrival(station,tr);
  EL_BOARD_CACHE.set(key,{t:Math.floor(T),service});
  if(!service)continue;
  const next=EL_STATIONS[service.next].name,wait=service.seconds?'IN '+Math.floor(service.seconds/60)+':'+String(service.seconds%60).padStart(2,'0'):'BOARDING';
  const boardY=tr?EL_Y1+EL_PLATFORM_OUT-.01:EL_Y0-EL_PLATFORM_OUT+.01,[x,z]=R(station.x,boardY);
  const lines=[wait+' '+(service.dir>0?'EAST':'WEST'),'NEXT '+next],width=.6/Math.max(...lines.map(l=>l.length));
  drawBox(boxAt(x,z,1,0,.34,.025,EL_TOP+.23,EL_TOP+.39),(i,t,L)=>{
    BG[i]=C(GRAY,1);
    if(Math.abs(HIT.v)<.024||Math.abs(HIT.u)>.315)return set(i,' ',0),true;
    const row=HIT.w>EL_TOP+.31?0:1,center=EL_TOP+(row ? .27 : .35),side=HIT.face===3?1:-1;
    const mark=worldText(lines[row],HIT.u*side,HIT.w,t,i,x,z+side*.025,center,side,0,width,.05);
    return set(i,mark,C(YEL,15)),true;
  });
  for(const off of [-.28,.28])rod(x+off,z,EL_TOP,x+off,z,EL_TOP+.23,.008);
 }
}
function elSprites() {
  for(const station of EL_STATIONS)if(inView(rel(station.x-px),rel(EL_Y+1-py),3))drawElStation(station);
  forNear(elPillarsB, p => { if (inView(rel(p.x - px), rel(p.y - py), 0.1)) drawElPillar(p); });
  for (const s of EL_STATIONS) for (const stairs of s.stairs) if (inView(rel(stairs.ox + stairs.c * stairs.off - px), rel(stairs.oy + stairs.ay * 0.25 - py), 1.7)) drawElStairs(stairs);
  for(const station of EL_STATIONS)if(inView(rel(station.x-px),rel(EL_Y+1-py),3))for(const tr of [0,1])
    for(const [ax,ay,bx,by] of elPlatformRails(station,tr)) {
      const [vx,vy]=R(ax,ay),[wx,wy]=R(bx,by),n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/.3));
      for(const z of [.055,EL_RAIL_H])rod(vx,vy,EL_TOP+z,wx,wy,EL_TOP+z,EL_RAIL_R);
      for(let i=0;i<=n;i++){const t=i/n,x=vx+(wx-vx)*t,y=vy+(wy-vy)*t;rod(x,y,EL_TOP,x,y,EL_TOP+EL_RAIL_H,.005);}
    }
  for (const t of elTrains(T)) {
    drawElRiders(t);
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
    drawCarouselHorse(cx, cy, ps, j);
  }
}
// horse j on its brass pole at angle ps round the carousel (cx, cy), going round and rising and falling
const HORSE_COLS = [WHITE, YEL, BRICK, WHITE, MAG, YEL, BRICK, CYAN];
function drawCarouselHorse(cx, cy, ps, j) {
  const hx = cx + 0.42 * Math.cos(ps), hy = cy + 0.42 * Math.sin(ps), hz = 0.14 + 0.04 * Math.sin(ps * 2 + T * 4), col = HORSE_COLS[j];
  rod(hx, hy, 0.04, hx, hy, 0.34, 0.005, YEL, 1.2); // its brass pole, turntable to canopy
  const tx = -Math.sin(ps), ty = Math.cos(ps); // the way it's going
  drawBox(boxAt(hx, hy, tx, ty, 0.06, 0.018, hz - 0.02, hz + 0.02), solidHorse(col)); // the body
  drawBox(boxAt(hx + tx * 0.06, hy + ty * 0.06, tx, ty, 0.015, 0.012, hz + 0.01, hz + 0.06), solidHorse(col)); // the neck and head
  for (const e of [-1, 1]) drawBox(boxAt(hx + tx * 0.04 * e, hy + ty * 0.04 * e, tx, ty, 0.006, 0.006, hz - 0.07, hz - 0.02), solidHorse(col)); // legs
}
// the carousel from outside, in 3D: the turntable, the mirrored drum in the middle, the horses on their poles, a
// scalloped valance strung with bulbs, and the striped canopy coming to a point with a pennant on top. All of it turns.
function drawCarousel(cx, cy) {
  const rot = TAU * T / CAROUSEL.rev, lit = night > 0.25 || overcast > 0.6, r = CAROUSEL.r, minR = 0.55 * Math.hypot(cx, cy) / projX;
  const turnAng = () => Math.atan2(HIT.v, HIT.u) - rot; // (round the carousel, turning with it)
  drawBox(boxAt(cx, cy, 1, 0, r, r, 0, 0.04), (i, t, L) => { // the turntable: boards, a gilt edge
    if (HIT.face === 5) { BG[i] = C(BRICK, 2 + L * 0.3); return set(i, fract(turnAng() * 16 / TAU) < 0.1 ? '|' : '=', C(BRICK, L * 0.8)), true; }
    BG[i] = C(YEL, 2.5 + L * 0.3); return set(i, '=', C(BRICK, L)), true;
  }, rayCopperDrum);
  drawBox(boxAt(cx, cy, 1, 0, 0.1, 0.1, 0.04, 0.34), (i, t, L) => { // the drum: mirrors and lights, up to the canopy
    const a = turnAng(), panel = fract(a * 8 / TAU);
    BG[i] = panel < 0.08 ? C(YEL, 4) : C(CYAN, 1 + (lit ? 3 : 1));
    return set(i, panel < 0.08 ? '|' : fract(HIT.w * 30 + T) < 0.2 ? '*' : ':', C(WHITE, Math.max(L, lit ? 12 : 6))), true;
  }, rayCopperDrum);
  for (let j = 0; j < 8; j++) drawCarouselHorse(cx, cy, rot + j * TAU / 8, j);
  const R2 = Math.max(minR, r + 0.03);
  drawBox(boxAt(cx, cy, 1, 0, R2, R2, 0.29, 0.34), (i, t, L) => { // the valance: scallops along its bottom, a bulb in each
    const a = turnAng(), sc = fract(a * 24 / TAU);
    if (HIT.w < 0.305 && Math.abs(sc - 0.5) > 0.3) return false;
    if (HIT.face === 6) { BG[i] = C(RED, 1.5); return set(i, ' ', 0), true; }
    const bulb = Math.abs(sc - 0.5) < 0.18 && HIT.w < 0.32, on = lit && fract(a * 24 / TAU / 2 - T) < 0.5;
    BG[i] = bulb && lit ? C(YEL, on ? 12 : 6) : C(YEL, 2.5 + L * 0.35);
    return set(i, bulb ? (lit ? '*' : 'o') : 'v', bulb && lit ? C(WHITE, 15) : C(RED, L)), true;
  }, rayCopperDrum);
  drawBox(boxAt(cx, cy, 1, 0, R2, R2, 0.34, 0.5), (i, t, L) => { // the canopy: stripes coming to a point
    if (HIT.face === 6) { BG[i] = C(Math.floor(turnAng() / (TAU / 16)) & 1 ? RED : WHITE, 2 + L * 0.2); return set(i, ' ', 0), true; }
    BG[i] = C(Math.floor(mod(turnAng(), TAU) / (TAU / 16)) & 1 ? RED : WHITE, (Math.floor(mod(turnAng(), TAU) / (TAU / 16)) & 1 ? 2.2 : 5) + L * 0.4);
    return set(i, ' ', 0), true;
  }, rayCone);
  rod(cx, cy, 0.49, cx, cy, 0.58, 0.004, YEL, 1.2); // the pennant's pole
  drawBox(boxAt(cx + Math.cos(rot) * 0.03, cy + Math.sin(rot) * 0.03, Math.cos(rot), Math.sin(rot), 0.03, 0.002, 0.54, 0.575), (i, t, L) => { // the pennant, streaming round
    if (HIT.w - 0.54 > 0.035 * (1 - (HIT.u + 0.03) / 0.06)) return false;
    BG[i] = C(RED, 4 + L * 0.3); return set(i, ' ', 0), true;
  });
}
const solidHorse = col => (i, t, L) => { BG[i] = C(col, (1.4 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '~' : ' ', C(YEL, L)), true; };
// the Ferris wheel, in 3D: two rims (rings of steel, an inner ring each) turning on a hub barrel, spokes out to the
// rims, a cross-bar between the rims at each car's pivot with the car hanging off it, an A-frame of legs each side
// splayed out to the deck and braced, a plank platform at the bottom, and bulbs round both rims that chase after dark.
// The wheel turns in the x-z plane; its axle runs along y. Everything is camera-relative ((wx, wy): the hub's foot).
const WHEEL_RIM = 36, WHEEL_SPOKES = 16, WHEEL_BULBS = 24, WHEEL_COLS = [RED, YEL, CYAN, MAG, GREEN, ORANGE];
function drawWheel(wx, wy) {
  const Rr = WHEEL.R, hub = WHEEL.hub, th = TAU * T / WHEEL.rev, lit = night > 0.25 || overcast > 0.6, riding = fairRide && fairRide.kind === 'wheel';
  const P = (ang, r) => [wx + r * Math.cos(ang), hub + r * Math.sin(ang)]; // (x, z) of a point on the wheel
  const near = (x, y, z) => riding && Math.hypot(x, y, z - eye) < 0.25; // (what's at arm's length in your car: the car's frame covers it)
  const steel = (col, glow, solid) => (ax, ay, az, bx, by, bz, r) => { // solid: filled even when thinner than a cell
    if (near((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)) return;
    drawRod(ax, ay, az, bx, by, bz, r, (i, t, L) => {
      if (solid || r * 2 * projX / t > 1.5) BG[i] = C(col, solid ? (lit ? 1.6 : 2.4 + L * 0.4) : 1.2 + L * 0.3);
      return set(i, courierGlyph(HIT.u, HIT.v, HIT.w, bx - ax, by - ay, bz - az), C(col, Math.max(L, glow))), true;
    });
  };
  const white = steel(WHITE, lit ? 9 : 0), grey = steel(GRAY, 0), rim = steel(WHITE, lit ? 9 : 0, true);
  for (const sd of [-1, 1]) {
    const y = wy + sd * WHEEL_GAP;
    for (let k = 0; k < WHEEL_RIM; k++) { // the rim
      const [ax, az] = P(th + k * TAU / WHEEL_RIM, Rr), [bx, bz] = P(th + (k + 1) * TAU / WHEEL_RIM, Rr);
      rim(ax, y, az, bx, y, bz, 0.035);
    }
    for (let k = 0; k < WHEEL_SPOKES; k++) { // the inner ring, and the spokes through it out to the rim
      const a0 = th + k * TAU / WHEEL_SPOKES, [ax, az] = P(a0, Rr * 0.55), [bx, bz] = P(a0 + TAU / WHEEL_SPOKES, Rr * 0.55), [hx, hz] = P(a0, 0.14), [rx, rz] = P(a0, Rr);
      grey(ax, y, az, bx, y, bz, 0.012);
      white(hx, y, hz, rx, y, rz, 0.01);
    }
    for (let k = 0; k < WHEEL_BULBS; k++) { // the bulbs, chasing round
      const ang = th + (k + 0.5) * TAU / WHEEL_BULBS, [x, z] = P(ang, Rr + 0.04), chase = fract(k / 4 - T * 1.5) < 0.5, col = [YEL, MAG, CYAN, RED][k & 3]; // (lit, every one; the chase runs brighter through them)
      if (near(x, y, z)) continue;
      dot(x, y, z, Math.max(0.025, 0.6 * Math.hypot(x, y) / Math.min(projX, projY)), (i, t, L) => { // (wider than the rim far off, so they show)
        if (!lit) { BG[i] = C(WHITE, 3 + L * 0.3); return set(i, 'o', C(GRAY, L)), true; }
        BG[i] = C(col, chase ? 12 : 6); return set(i, '*', C(WHITE, chase ? 15 : 10)), true;
      });
    }
    for (const e of [-1, 1]) { // the A-frame: hub down to the deck, splayed out from the rim
      const fy = y + sd * 0.3;
      grey(wx, y + sd * 0.04, hub, wx + e * 0.95, fy, 0, 0.045);
    }
    { const by = y + sd * (0.04 + 0.26 * 0.45); grey(wx - 0.95 * 0.45, by, hub * 0.55, wx + 0.95 * 0.45, by, hub * 0.55, 0.025); } // its brace, partway down
  }
  // the hub barrel and the axle
  drawRod(wx, wy - WHEEL_GAP - 0.05, hub, wx, wy + WHEEL_GAP + 0.05, hub, 0.13, (i, t, L) => { BG[i] = C(GRAY, 2 + L * 0.3); return set(i, '@', C(WHITE, Math.max(L, lit ? 10 : 0))), true; });
  grey(wx, wy - WHEEL_GAP - 0.1, hub, wx, wy + WHEEL_GAP + 0.1, hub, 0.035);
  // the platform at the bottom, where you board
  drawBox(boxAt(wx, wy - 0.15, 1, 0, 0.6, 0.4, 0, 0.04), (i, t, L) => { BG[i] = C(BRICK, (1.4 + L * 0.3) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? (fract(HIT.u * 18) < 0.12 ? '|' : '=') : '_', C(BRICK, L * 0.8)), true; });
  // the cars: a cross-bar between the rims at each pivot, the car hanging plumb beneath it
  for (let k = 0; k < WHEEL.n; k++) {
    const ph = wheelAngle(k, T), gx = wx + Rr * Math.cos(ph), gz = hub + Rr * Math.sin(ph), col = WHEEL_COLS[k % 6];
    white(gx, wy - WHEEL_GAP, gz, gx, wy + WHEEL_GAP, gz, 0.012);
    if (riding && fairRide.k === k) continue; // (you're in this one)
    grey(gx, wy, gz, gx, wy, gz - 0.05, 0.008); // its hanger
    drawBox(boxAt(gx, wy, 1, 0, 0.115, WHEEL_GAP - 0.01, gz - 0.075, gz - 0.05), (i, t, L) => { // the roof, overhanging
      BG[i] = C(col, (2 + L * 0.35) * shadeFace(HIT.face)); return set(i, HIT.face === 5 ? '^' : '_', C(WHITE, L * 0.7)), true; });
    drawBox(boxAt(gx, wy, 1, 0, 0.1, WHEEL_GAP - 0.03, gz - 0.24, gz - 0.075), (i, t, L) => { // the car: windows round the middle, a solid floor
      const w = (gz - 0.075 - HIT.w) / 0.165, f = HIT.face;
      BG[i] = C(col, (1.6 + L * 0.35) * shadeFace(f));
      if (f === 6 || w > 0.85) return set(i, '=', C(col, L)), true;
      if (w > 0.12 && w < 0.6) { BG[i] = lit ? C(WARM, 3 + night * 5) : C(CYAN, 1.5 + L * 0.2); return set(i, Math.abs(fract((f <= 2 ? HIT.v : HIT.u) * 12) - 0.5) < 0.1 ? '|' : ' ', C(col, L)), true; }
      return set(i, ' ', 0), true;
    });
  }
}
const FAIR_SIGN = 'SUNSET PIER';
function fairSprites() {
  const [wx, wy] = R(WHEEL.x, WHEEL.y);
  if (Math.hypot(wx, wy) < vis + 4 && inView(wx, wy, WHEEL.R + 0.3)) drawWheel(wx, wy);
  const [cx, cy] = R(CAROUSEL.x, CAROUSEL.y);
  if (fairRide && fairRide.kind === 'carousel') carouselInside(cx, cy); // on it: built round you, not a picture
  else if (Math.hypot(cx, cy) < vis && inView(cx, cy, CAROUSEL.r + 0.1)) drawCarousel(cx, cy);
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
    const ch = signLine(FAIR_SIGN, q, (0.51 - HIT.w) / 0.08, i, 0.47, midDepth(gx, gy), t, 2 * (hw + 0.03) / n, 0.08, farDepth(gx, gy, hw), ...faceDir(1, 0));
    if (ch !== null && (ch !== ' ' || Math.abs(HIT.w - 0.47) < 0.03)) return set(i, ch, C(YEL, 15)), true;
    return set(i, glow > 0.3 && Math.abs(HIT.w - 0.47) > 0.03 && fract(q * 0.5 - T * 2) < 0.25 ? '*' : ' ', C(WHITE, 15)), true; // (bulbs above and below the letters)
  });
}
