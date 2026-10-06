// Belle Époque's projecting stone bays, iron balconies and sloping copper roofs are geometry, depth-tested
// against the street scene. Their positions follow complete facade bays, with room at every corner.
function mansardPlanes(hl, hw, z0, z1) {
  const slope = (z1 - z0) / 0.65;
  return [[1, 0, 0, hl], [-1, 0, 0, hl], [0, 1, 0, hw], [0, -1, 0, hw], [0, 0, 1, z1], [0, 0, -1, -z0],
    [slope, 0, 1, z0 + slope * hl], [-slope, 0, 1, z0 + slope * hl], [0, slope, 1, z0 + slope * hw], [0, -slope, 1, z0 + slope * hw]];
}
const belleBuildingsB = bucketed(BELLE_BUILDINGS.map(b => ({ ...b, planes: mansardPlanes((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, b.h, b.h + 0.45) }))), belleDetails = [];
for (const b of BELLE_BUILDINGS) {
  const faces = new Map();
  for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
    const k = idx(x, y);
    if (SHOP[k] !== b.sh) continue;
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (map[idx(x + nx, y + ny)] >= b.h) continue;
      const side = ny ? 1 : 0, start = BELLE_FACE_START[side][k], end = BELLE_FACE_END[side][k];
      const line = ny ? y + (ny > 0 ? 1 : 0) : x + (nx > 0 ? 1 : 0), key = [nx, ny, line, start, end].join(',');
      if (!faces.has(key)) faces.set(key, { nx, ny, side, start, end, line });
    }
  }
  for (const f of faces.values()) {
    const spacing = (f.end - f.start) / Math.max(1, Math.floor((f.end - f.start) / 0.85));
    const floors = Math.max(1, Math.floor((b.h - 0.55) / 0.42)), fh = (b.h - 0.55) / floors;
    for (let bay = 0; bay < (f.end - f.start) / spacing - 0.01; bay++) {
      const along = f.start + (bay + 0.5) * spacing;
      const x = f.side ? along : f.line, y = f.side ? f.line : along;
      const add = (depth, hl, hw, z0, z1, kind) => belleDetails.push({ x: x + f.nx * depth, y: y + f.ny * depth, c: f.side ? 1 : 0, s: f.side ? 0 : 1, hl, hw, z0, z1, kind, material: b.material, seed: b.seed });
      if (b.balconies && bay % 2 === 0) for (let fl = 1; fl < floors; fl += 2) {
        const z = 0.45 + fl * fh + fh * 0.2, half = Math.min(0.36, spacing * 0.4);
        add(0.1, half, 0.12, z - 0.025, z, 'slab');
        add(0.21, half, 0.008, z, z + 0.11, 'iron');
        for (const sign of [-1, 1]) belleDetails.push({ x: x + f.nx * 0.1 + (f.side ? sign * half : 0), y: y + f.ny * 0.1 + (f.side ? 0 : sign * half), c: f.side ? 0 : 1, s: f.side ? 1 : 0, hl: 0.11, hw: 0.008, z0: z, z1: z + 0.11, kind: 'iron' });
        add(0.075, half * 0.65, 0.05, z - 0.1, z - 0.025, 'bracket');
      }
      if (bay % 3 === 1 && fract(b.seed * 37) < 0.65) add(0.07, Math.min(0.27, spacing * 0.3), 0.12, 0.48, b.h - 0.14, 'bay');
      add(0.025, spacing * 0.47, 0.045, b.h - 0.08, b.h + 0.035, 'cornice');
    }
  }
}
const belleDetailsB = bucketed(belleDetails);
function belleDetailShade(o, i, t, L) {
  const base = [STONE, WHITE, GRAY, BRICK, STONE][o.material || 0], z = HIT.w;
  if (o.kind === 'iron') {
    if (HIT.face >= 5 || z > o.z1 - 0.012 || z < o.z0 + 0.009 || Math.abs(fract(HIT.u * 13) - 0.5) > 0.44 || Math.abs(fract(HIT.u * 7) - 0.5) < Math.sin((z - o.z0) / 0.11 * Math.PI) * 0.15) {
      BG[i] = C(GRAY, 1); return set(i, HIT.face >= 5 || z > o.z1 - 0.012 ? '=' : '|', C(GRAY, L * 0.9)), true;
    }
    return false;
  }
  BG[i] = C(base, (1 + L * 0.32) * shadeFace(HIT.face));
  if (o.kind === 'bay' && HIT.face < 5) {
    const fl = fract((z - 0.45) / 0.42), along = HIT.face <= 2 ? HIT.v : HIT.u, half = HIT.face <= 2 ? o.hw : o.hl;
    if (Math.abs(along) < half - 0.045 && fl > 0.24 && fl < 0.83) {
      const lit = hash(Math.floor(z / 0.42), 1, sk0(o.seed)) > litT - 0.2;
      BG[i] = C(lit ? WARM : CYAN, lit ? 2 + night * 4 : 1 + day);
      return set(i, Math.abs(along) < 0.012 ? '|' : ':', C(WHITE, Math.max(L * 0.6, lit ? night * 12 : 0))), true;
    }
  }
  return set(i, HIT.face === 5 || o.kind === 'cornice' || o.kind === 'slab' ? '=' : '|', C(WHITE, L * 0.85)), true;
}
// Clip the ray against the ten planes of a mansard: four walls, floor, ridge and four inclined faces.
function rayMansard(ox, oy, oz, rx, ry, rz, b) {
  let entry = 0, exit = Infinity, face = 5;
  const x = ox - b.x, y = oy - b.y, planes = b.planes;
  for (let j = 0; j < planes.length; j++) {
    const [nx, ny, nz, lim] = planes[j], dist = lim - nx * x - ny * y - nz * oz, vel = nx * rx + ny * ry + nz * rz;
    if (Math.abs(vel) < 1e-8) { if (dist < 0) return -1; continue; }
    const t = dist / vel;
    if (vel < 0 && t > entry) { entry = t; face = j; } else if (vel > 0) exit = Math.min(exit, t);
    if (entry > exit) return -1;
  }
  if (entry < 0.02 || exit < 0) return -1;
  HIT.u = x + rx * entry; HIT.v = y + ry * entry; HIT.w = oz + rz * entry; HIT.face = face;
  return entry;
}
function drawBelleBuildings() {
  forNear(belleBuildingsB, b => {
    const [vx, vy] = R(b.x, b.y);
    if (b.access || Math.hypot(vx, vy) > vis + 8) return;
    drawBox({ ...boxAt(vx, vy, 1, 0, (b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, b.h, b.h + 0.45), planes: b.planes }, (i, t, L) => {
      if (SHOP[idx(Math.floor(b.x + HIT.u), Math.floor(b.y + HIT.v))] !== b.sh) return false;
      const seam = Math.abs(fract((HIT.face < 8 ? HIT.v : HIT.u) * 5) - 0.5) > 0.46;
      BG[i] = C(GREEN, 1 + L * (HIT.face === 4 ? 0.3 : 0.19));
      set(i, seam ? '/' : ' ', C(seam ? YEL : GREEN, L * 0.8));
      paintSettledSnow(i, b.x + HIT.u, b.y + HIT.v, L * 0.6, HIT.face === 4 ? 1 : 0.55);
      return true;
    }, rayMansard);
    if (fract(b.seed * 19) < 0.35) {
      const tx = b.x1 - 0.65, ty = b.y0 + 0.65;
      if (SHOP[idx(tx, ty)] === b.sh) drawCopperDome(...R(tx, ty), b.h + 0.1, 0.52, 0.75);
    }
  });
  forNear(belleDetailsB, o => {
    // The inhabited balcony replaces any decorative bay or ironwork across its French doors.
    if (owned.homes.some(home => {
      const b = homeBalconyBounds(home);
      return b && Math.abs(o.x - b.x0) < .25 && Math.abs(o.y - b.y) < .9 && o.z1 > b.z - .14 && o.z0 < b.z + .35;
    })) return;
    drawBox({ ...o, x: rel(o.x - px), y: rel(o.y - py) }, (i, t, L) => belleDetailShade(o, i, t, L));
  });
}
// Fluted iron posts and paired opal globes, distinct from the other districts' swan-neck street lamps.
function drawBelleLamp(vx, vy) {
  drawShape(vx, vy, 0, 0.16, 0.64, (i, u, z, du, dz, L) => {
    const stem = Math.abs(u) < Math.max(0.01, du * 0.45) && z < 0.58;
    const foot = z < 0.055 && Math.abs(u) < 0.035, arm = Math.abs(z - 0.49) < Math.max(0.008, dz * 0.45) && Math.abs(u) < 0.12;
    const globe = Math.hypot((Math.abs(u) - 0.11) / 0.045, (z - 0.55) / 0.055) < 1;
    if (globe) { BG[i] = C(WHITE, 2 + lampsOn * 7); return set(i, 'o', C(WARM, Math.max(L, lampsOn * 15))), true; }
    if (!stem && !foot && !arm) return false;
    BG[i] = C(GRAY, 1); return set(i, foot ? '#' : arm ? '=' : '|', C(GRAY, L)), true;
  });
}
