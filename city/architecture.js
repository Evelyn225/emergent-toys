// Deliberate building compositions for the Brownstones and downtown. Ground footprints and shop identities stay
// stable; stepped tower heights participate in the same map used by movement, roof routes and the raycaster.
const ARCH_BUILDINGS = [], ARCH_FACES = Array.from({ length: 4 }, () => new Array(N * N));
const ARCH_DETAILS = [], ARCH_BLOCKERS = [], ARCH_STEPS = [];
const ARCH_DIRECTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
function architectureTier(x0, y0, x1, y1, h) { return { x0, y0, x1, y1, h: Math.fround(h) }; }
function towerComposition(b) {
  const { x0, y0, x1, y1, h, form } = b, w = x1 - x0, d = y1 - y0;
  const podium = Math.min(2.05, 0.4 + Math.floor(h * 0.6) / 3);
  const tiers = [architectureTier(x0, y0, x1, y1, podium)];
  const reverse = fract(b.seed * 43) > 0.5;
  if (form === 'stepped') {
    const inset = w >= 5 && d >= 5 ? 1 : 0;
    tiers.push(architectureTier(x0 + 1, y0 + 1, x1 - inset, y1 - inset, h - 0.8));
    tiers.push(architectureTier(x0 + Math.floor(w / 2), y0 + Math.floor(d / 2), x0 + Math.floor(w / 2) + Math.max(1, w - 4), y0 + Math.floor(d / 2) + Math.max(1, d - 4), h));
  } else if (form === 'paired') {
    const cut = x0 + Math.floor(w / 2);
    tiers.push(architectureTier(x0, y0 + 1, cut, y1, h));
    tiers.push(architectureTier(cut + 1, y0 + 1, x1, y1, h - 2 / 3));
  } else if (form === 'offset') {
    tiers.push(architectureTier(x0 + 1, y0, x1, y1 - 1, h - 2 / 3));
    tiers.push(architectureTier(x0, y0 + 1, x1 - 1, y1, h));
  } else {
    // A long shaft over a lower entrance wing; the side of its terrace follows the composition's seed.
    tiers.push(architectureTier(x0 + (reverse ? 1 : 0), y0 + 1, x1 - (reverse ? 0 : 1), y1, h));
  }
  return tiers;
}
function architectureFaces(b, cells) {
  const faces = new Map();
  for (const k of cells) {
    const x = b.x0 + mod(k % N - b.x0, N), y = b.y0 + mod(Math.floor(k / N) - b.y0, N), height = map[k];
    for (let dir = 0; dir < 4; dir++) {
      const [nx, ny] = ARCH_DIRECTIONS[dir], low = map[idx(x + nx, y + ny)];
      if (low >= height) continue;
      const side = ny ? 1 : 0, sx = side, sy = 1 - side;
      const same = step => {
        const at = idx(x + sx * step, y + sy * step);
        return SHOP[at] === b.sh && map[at] === height && map[idx(x + sx * step + nx, y + sy * step + ny)] === low;
      };
      let start = side ? x : y, end = start + 1;
      for (let n = 1; n < 9 && same(-n); n++) start--;
      for (let n = 1; n < 9 && same(n); n++) end++;
      const line = side ? y + (ny > 0) : x + (nx > 0), key = [dir, line, start, end, height].join(',');
      if (!faces.has(key)) {
        const units = Math.max(1, Math.round((end - start) / 0.95));
        const floors = Math.max(2, Math.floor((height - 0.48) / 0.34));
        faces.set(key, { dir, nx, ny, side, start, end, line, height, low, units, spacing: (end - start) / units, floors, fh: (height - 0.48) / floors, front: false });
      }
      ARCH_FACES[dir][k] = faces.get(key);
    }
  }
  const ground = [...faces.values()].filter(f => !f.low);
  ground.sort((a, c) => (c.end - c.start + (c.ny < 0 ? 3 : 0)) - (a.end - a.start + (a.ny < 0 ? 3 : 0)));
  if (ground[0]) ground[0].front = true;
  return [...faces.values()];
}
function architectureDetail(b, f, along, depth, hl, hw, z0, z1, kind, extra = {}) {
  const ownerCell = idx(Math.floor((f.side ? along : f.line) - f.nx * 0.1), Math.floor((f.side ? f.line : along) - f.ny * 0.1));
  const o = { x: (f.side ? along : f.line) + f.nx * depth, y: (f.side ? f.line : along) + f.ny * depth,
    c: f.side ? 1 : 0, s: f.side ? 0 : 1, hl, hw, z0, z1, kind, nx: f.nx, ny: f.ny, region: b.region, material: b.material, seed: b.seed, ownerCell, ownerHeight: map[ownerCell], ...extra };
  if (kind === 'bay' || kind === 'baycap') {
    o.bevelW = Math.min(hl * 0.48, 0.09); o.bevelD = Math.min(hw * 0.48, 0.045);
    o.outSign = f.ny * o.c - f.nx * o.s;
    const limit = o.bevelD * hl + o.bevelW * hw - o.bevelW * o.bevelD;
    o.planes = [[1,0,0,hl,1],[-1,0,0,hl,2],[0,1,0,hw,3],[0,-1,0,hw,4],[0,0,1,z1,5],[0,0,-1,-z0,6],
      [o.bevelD,o.bevelW*o.outSign,0,limit,7],[-o.bevelD,o.bevelW*o.outSign,0,limit,8]];
  }
  ARCH_DETAILS.push(o);
  if (kind === 'step') { ARCH_STEPS.push(o); ARCH_BLOCKERS.push(o); }
  else if (z0 < 0.28) ARCH_BLOCKERS.push(o);
  return o;
}
function brownstoneDetails(b) {
  for (const f of b.faces) {
    // Cornices and string courses are continuous architectural members, rather than one per window.
    const center = (f.start + f.end) / 2, half = (f.end - f.start) / 2;
    architectureDetail(b, f, center, 0.025, half, 0.055, b.h - 0.09, b.h + 0.035, 'cornice');
    architectureDetail(b, f, center, 0.012, half, 0.025, 0.425, 0.46, 'course');
    if (!f.front) continue;
    for (let unit = 0; unit < f.units; unit++) {
      const center = f.start + (unit + 0.5) * f.spacing, door = center - f.spacing * 0.24;
      if (b.sh.kind === SHOP_APTS) {
        for (let step = 0; step < 5; step++)
          architectureDetail(b, f, door, 0.035 + (4 - step) * 0.031, f.spacing * 0.14, 0.02, 0, (step + 1) * 0.024, 'step');
        for (const sign of [-1, 1]) {
          const rail = architectureDetail(b, f, door + sign * f.spacing * 0.16, 0.075, 0.008, 0.08, 0, 0.22, 'rail');
          rail.c = f.side ? 0 : 1; rail.s = f.side ? 1 : 0; rail.hl = 0.08; rail.hw = 0.008;
        }
        architectureDetail(b, f, door, 0.025, f.spacing * 0.18, 0.045, 0.35, 0.385, 'doorhood');
      }
      if (hash(unit, 1, Math.floor(b.seed * 1e4)) > 0.32) {
        architectureDetail(b, f, center + f.spacing * 0.22, 0.055, f.spacing * 0.19, 0.095, 0.45, b.h - 0.12, 'bay', { fh: f.fh, floors: f.floors });
        architectureDetail(b, f, center + f.spacing * 0.22, 0.055, f.spacing * 0.22, 0.11, b.h - 0.145, b.h - 0.11, 'baycap');
      }
    }
  }
}
function downtownDetails(b) {
  for (const f of b.faces) {
    const center = (f.start + f.end) / 2, half = (f.end - f.start) / 2;
    architectureDetail(b, f, center, 0.018, half, 0.035, f.height - 0.035, f.height + 0.025, 'cornice');
    if (b.sty !== 14 || f.end - f.start < 1) continue;
    const piers = Math.max(2, Math.round((f.end - f.start) / 0.7));
    for (let p = 0; p <= piers; p++) {
      const along = f.start + 0.06 + p / piers * (f.end - f.start - 0.12);
      architectureDetail(b, f, along, 0.022, 0.025, 0.04, Math.max(0.43, f.low), f.height - 0.035, 'pier');
    }
  }
  if (b.sty !== 14 || b.access) return;
  const top = b.tiers[b.tiers.length - 1], inset = 0.3;
  b.crown = { x: (top.x0 + top.x1) / 2, y: (top.y0 + top.y1) / 2, hl: (top.x1 - top.x0) / 2 - 0.04, hw: (top.y1 - top.y0) / 2 - 0.04, z0: b.h, z1: b.h + 0.38, inset };
  const c = b.crown, slope = (c.z1 - c.z0) / inset;
  c.planes = [[1,0,0,c.hl],[-1,0,0,c.hl],[0,1,0,c.hw],[0,-1,0,c.hw],[0,0,1,c.z1],[0,0,-1,-c.z0],
    [slope,0,1,c.z0+slope*c.hl],[-slope,0,1,c.z0+slope*c.hl],[0,slope,1,c.z0+slope*c.hw],[0,-slope,1,c.z0+slope*c.hw]];
}
{
  const lots = new Map();
  for (let k = 0; k < map.length; k++) {
    const sh = SHOP[k], sty = STY[k], district = districtAt(k % N, Math.floor(k / N));
    if (!sh || sh.base || !map[k]) continue;
    if (!(district === 'brownstones' && sty === 9 || district === 'downtown' && [0, 1, 14].includes(sty))) continue;
    if (!lots.has(sh)) lots.set(sh, []);
    lots.get(sh).push(k);
  }
  for (const [sh, cells] of lots) {
    const refX = cells[0] % N, refY = Math.floor(cells[0] / N);
    const xs = cells.map(k => refX + rel(k % N - refX)), ys = cells.map(k => refY + rel(Math.floor(k / N) - refY));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
    const region = districtAt(refX, refY), seed = SEED[cells[0]], sty = STY[cells[0]], access = sh.kind === SHOP_APTS || sh.word === 'HOTEL' || sh.word === 'MOTEL';
    const forms = sty === 14 ? ['stepped', 'shoulder', 'stepped'] : ['shoulder', 'paired', 'offset'];
    const b = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, x0, y0, x1, y1, h: map[cells[0]], region, seed, sty, access,
      material: Math.floor(fract(seed * 17) * 5), form: region === 'brownstones' ? 'terrace' : forms[Math.floor(fract(seed * 31) * forms.length)], sh };
    b.tiers = [architectureTier(x0, y0, x1, y1, b.h)];
    if (region === 'downtown' && !access && x1 - x0 >= 3 && y1 - y0 >= 2) {
      b.tiers = towerComposition(b);
      for (const k of cells) {
        const x = refX + rel(k % N - refX), y = refY + rel(Math.floor(k / N) - refY);
        map[k] = Math.max(...b.tiers.filter(t => x >= t.x0 && x < t.x1 && y >= t.y0 && y < t.y1).map(t => t.h));
      }
    }
    b.faces = architectureFaces(b, cells);
    if (region === 'brownstones') brownstoneDetails(b); else downtownDetails(b);
    // Keep metadata serializable: faces and roof data never contain their owning shop.
    const { sh: ignoredShop, ...metadata } = b;
    sh.architecture = metadata;
    ARCH_BUILDINGS.push(b);
  }
}
const architectureBuildingsB = bucketed(ARCH_BUILDINGS), architectureDetailsB = bucketed(ARCH_DETAILS);
const architectureBlockersB = bucketed(ARCH_BLOCKERS), architectureStepsB = bucketed(ARCH_STEPS);
// Most streets have no added geometry. Cell masks avoid bucket scans there, including while following a car.
function architectureCellMask(items, pad) {
  const mask = new Uint8Array(N * N);
  for (const o of items) {
    const ex = Math.abs(o.c) * (o.hl + pad) + Math.abs(o.s) * (o.hw + pad);
    const ey = Math.abs(o.s) * (o.hl + pad) + Math.abs(o.c) * (o.hw + pad);
    for (let y = Math.floor(o.y - ey); y <= Math.floor(o.y + ey); y++)
      for (let x = Math.floor(o.x - ex); x <= Math.floor(o.x + ex); x++) mask[idx(x, y)] = 1;
  }
  return mask;
}
const architectureStepCells = architectureCellMask(ARCH_STEPS, 0);
const architectureWalkCells = architectureCellMask(ARCH_BLOCKERS.filter(o => o.kind !== 'step'), 0.03);
const architectureCarCells = architectureCellMask(ARCH_BLOCKERS, 0.4);
function architectureRoofHeight(x, y) {
  const k = idx(Math.floor(x), Math.floor(y)), b = SHOP[k]?.architecture, c = b?.crown;
  if (!c || map[k] !== Math.fround(c.z0)) return 0;
  const ex = c.hl - Math.abs(rel(x - c.x)), ey = c.hw - Math.abs(rel(y - c.y));
  return ex >= 0 && ey >= 0 ? c.z0 + (c.z1 - c.z0) * clamp(Math.min(ex, ey) / c.inset, 0, 1) : 0;
}
for (const o of roofs) if (SHOP[idx(Math.floor(o.x), Math.floor(o.y))]?.architecture)
  o.z = Math.max(map[idx(Math.floor(o.x), Math.floor(o.y))], architectureRoofHeight(o.x, o.y));
function architectureContains(o, x, y, pad = 0) {
  const qx = rel(x - o.x), qy = rel(y - o.y);
  return Math.abs(qx * o.c + qy * o.s) < o.hl + pad && Math.abs(-qx * o.s + qy * o.c) < o.hw + pad;
}
// Convex bay profile: a broad center window and two glazed, angled corners, in the box's own coordinates.
function rayBeveledBay(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y;
  const u = qx * b.c + qy * b.s, v = -qx * b.s + qy * b.c;
  const du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let enter = 0, leave = Infinity, face = 0;
  for (const [nx, ny, nz, limit, f] of b.planes) {
    const dist = limit - nx * u - ny * v - nz * oz, speed = nx * du + ny * dv + nz * rz;
    if (Math.abs(speed) < 1e-10) { if (dist < 0) return -1; continue; }
    const t = dist / speed;
    if (speed < 0 && t > enter) { enter = t; face = f; } else if (speed > 0) leave = Math.min(leave, t);
    if (enter > leave) return -1;
  }
  if (enter < 0.01 || leave < 0) return -1;
  HIT.u = u + du * enter; HIT.v = v + dv * enter; HIT.w = oz + rz * enter; HIT.face = face;
  return enter;
}
function architectureGroundHeight(x, y) {
  if (!architectureStepCells[idx(Math.floor(x), Math.floor(y))]) return 0;
  let h = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
    for (const o of architectureStepsB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)])
      if (map[o.ownerCell] === o.ownerHeight && architectureContains(o, x, y)) h = Math.max(h, o.z1);
  return h;
}
function architectureBlocked(x, y, pad = 0) {
  if (pad <= 0.03 && !architectureWalkCells[idx(Math.floor(x), Math.floor(y))]) return false;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
    for (const o of architectureBlockersB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)])
      if (map[o.ownerCell] === o.ownerHeight && o.kind !== 'step' && architectureContains(o, x, y, pad)) return true;
  return false;
}
function architectureCarClear(x, y, hx, hy, hl, hw) {
  if (Math.hypot(hl, hw) <= 0.4 && !architectureCarCells[idx(Math.floor(x), Math.floor(y))]) return true;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
    for (const o of architectureBlockersB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)]) {
      if (map[o.ownerCell] !== o.ownerHeight) continue;
      const qx = rel(o.x - x), qy = rel(o.y - y);
      const along = Math.abs(hx * o.c + hy * o.s), across_ = Math.abs(hx * o.s - hy * o.c);
      if (Math.abs(qx * hx + qy * hy) < hl + o.hl * along + o.hw * across_ &&
          Math.abs(-qx * hy + qy * hx) < hw + o.hl * across_ + o.hw * along &&
          Math.abs(qx * o.c + qy * o.s) < o.hl + hl * along + hw * across_ &&
          Math.abs(-qx * o.s + qy * o.c) < o.hw + hl * across_ + hw * along) return false;
    }
  return true;
}
