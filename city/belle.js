// Belle stone bays, balconies and copper roofs use the shared geometry from belle-geometry.js.
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
  const x = ox - b.x, y = oy - b.y, planes = b.planeData || roofPlaneData(b.planes);
  for (let j = 0; j < planes.length; j += 4) {
    const nx = planes[j], ny = planes[j + 1], nz = planes[j + 2];
    const dist = planes[j + 3] - nx * x - ny * y - nz * oz, vel = nx * rx + ny * ry + nz * rz;
    if (Math.abs(vel) < 1e-8) { if (dist < 0) return -1; continue; }
    const t = dist / vel;
    if (vel < 0 && t > entry) { entry = t; face = j / 4; } else if (vel > 0) exit = Math.min(exit, t);
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
    drawBox({ ...boxAt(vx, vy, 1, 0, (b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, b.h, b.h + 0.45), planeData: b.planeData }, (i, t, L) => {
      if (SHOP[idx(Math.floor(b.x + HIT.u), Math.floor(b.y + HIT.v))] !== b.sh) return false;
      const seam = Math.abs(fract((HIT.face < 8 ? HIT.v : HIT.u) * 5) - 0.5) > 0.46;
      BG[i] = C(GREEN, 1 + L * (HIT.face === 4 ? 0.3 : 0.19));
      set(i, seam ? '/' : ' ', C(seam ? YEL : GREEN, L * 0.8));
      paintSettledSnow(i, b.x + HIT.u, b.y + HIT.v, L * 0.6, HIT.face === 4 ? 1 : 0.55,0,HIT.w);
      return true;
    }, rayMansard);
    if (fract(b.seed * 19) < 0.35) {
      const tx = b.x1 - 0.65, ty = b.y0 + 0.65;
      if (SHOP[idx(tx, ty)] === b.sh) drawCopperDome(...R(tx, ty), b.h + 0.38, 0.46, 0.48, b.h + 0.08);
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
// Intersect the rounded opal glass itself, not its bounding box or a camera-facing disc.
function rayBelleGlobe(ox, oy, oz, rx, ry, rz, b) {
  const z = (b.z0 + b.z1) / 2, h = (b.z1 - b.z0) / 2;
  const x = (ox - b.x) / b.hl, y = (oy - b.y) / b.hw, w = (oz - z) / h;
  const ux = rx / b.hl, uy = ry / b.hw, uz = rz / h;
  const aa = ux * ux + uy * uy + uz * uz, bb = x * ux + y * uy + w * uz;
  const disc = bb * bb - aa * (x * x + y * y + w * w - 1);
  if (disc < 0) return -1;
  const t = (-bb - Math.sqrt(disc)) / aa;
  if (t < 0.01) return -1;
  const qx = ox + rx * t - b.x, qy = oy + ry * t - b.y;
  HIT.u = qx * b.c + qy * b.s; HIT.v = -qx * b.s + qy * b.c; HIT.w = oz + rz * t; HIT.face = 0;
  return t;
}
function belleLampShade(o, i, t, L) {
  if (o.kind === 'globe') {
    const normalZ = (HIT.w - (o.z0 + o.z1) / 2) / ((o.z1 - o.z0) / 2);
    const light = 0.65 + 0.35 * Math.max(0, normalZ);
    BG[i] = C(WHITE, 2 + L * 0.35 * light + lampsOn * 6);
    return set(i, normalZ > 0.65 ? '.' : ':', C(WARM, Math.max(L * light, lampsOn * 15))), true;
  }
  const fluted = o.kind === 'pole' || o.kind === 'finial';
  let ch = '=';
  if (fluted) ch = '|';
  else if (o.kind === 'base') ch = '#';
  BG[i] = C(GRAY, (1 + L * 0.18) * shadeFace(HIT.face));
  return set(i, HIT.face === 5 ? '.' : ch, C(fluted ? GRAY : YEL, L * 0.85)), true;
}
// Paired globes and ornamental ironwork remain solid and correctly foreshortened at every viewing distance.
function drawBelleLamp(vx, vy, ax, ay) {
  for (const o of belleLampParts(vx, vy, ax, ay)) {
    drawBox(o, (i, t, L) => belleLampShade(o, i, t, L), o.kind === 'globe' ? rayBelleGlobe : rayBox);
  }
}
