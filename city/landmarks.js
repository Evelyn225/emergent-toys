// Landmarks have authored silhouettes rather than taller versions of an ordinary city lot.
// The cathedral's left tower always retains its 80m stair landing, beneath an open belfry.
const CLOCK_PROFILES = [
  { name: 'civic', stone: STONE, roof: GRAY, shaft: 7.3, half: .72, cap: 1.2, form: 'hip' },
  { name: 'merchant', stone: BRICK, roof: GREEN, shaft: 6.2, half: .64, cap: 2.0, form: 'spire' },
  { name: 'works', stone: GRAY, roof: GRAY, shaft: 8.1, half: .58, cap: .55, form: 'flat' },
  { name: 'campanile', stone: WHITE, roof: BRICK, shaft: 7.8, half: .68, cap: 1.25, form: 'gable' },
  { name: 'harbor', stone: STONE, roof: GREEN, shaft: 6.8, half: .8, cap: 1.7, form: 'spire' },
];
const CATHEDRAL_PROFILES = [
  { name: 'twin spires', stone: GRAY, roof: GRAY, aisle: 2, ridge: 4.15, right: 8, spire: 3.2, cap: 'spire' },
  { name: 'limestone minster', stone: STONE, roof: GREEN, aisle: 2.15, ridge: 3.8, right: 6.2, spire: 2.1, cap: 'hip' },
  { name: 'brick basilica', stone: BRICK, roof: BRICK, aisle: 1.85, ridge: 3.6, right: 7.2, spire: 1.15, cap: 'hip' },
  { name: 'high gothic', stone: WHITE, roof: GRAY, aisle: 2.2, ridge: 4.55, right: 8.9, spire: 3.7, cap: 'spire' },
  { name: 'copper abbey', stone: STONE, roof: GREEN, aisle: 1.7, ridge: 3.9, right: 5.7, spire: 1.5, cap: 'hip' },
];
const LANDMARK_BUILDINGS = [], LANDMARK_SOLIDS = [], LANDMARK_BLOCKERS = [];
function landmarkPlanes(hl, hw, z0, z1, form) {
  const planes = [[1,0,0,hl],[-1,0,0,hl],[0,1,0,hw],[0,-1,0,hw],[0,0,1,z1],[0,0,-1,-z0]];
  if (form === 'gable' || form === 'crossgable') {
    const slope = (z1 - z0) / (form === 'gable' ? hl : hw);
    if (form === 'gable') planes.push([slope,0,1,z1],[-slope,0,1,z1]);
    else planes.push([0,slope,1,z1],[0,-slope,1,z1]);
  } else if (form === 'hip' || form === 'spire') {
    const sx = (z1 - z0) / hl, sy = (z1 - z0) / hw;
    planes.push([sx,0,1,z1],[-sx,0,1,z1],[0,sy,1,z1],[0,-sy,1,z1]);
    if (form === 'spire') for (const nx of [-1,1]) for (const ny of [-1,1]) {
      planes.push([nx / hl,ny / hw,0,1.42]);
      planes.push([nx * sx / Math.SQRT2,ny * sy / Math.SQRT2,1,z1]);
    }
  }
  return planes;
}
function landmarkSolid(b, x, y, hl, hw, z0, z1, kind, form = null, walkRoof = false) {
  const o = { x: b.x + x, y: b.y + y, c: 1, s: 0, hl, hw, z0, z1, kind, form, b, walkRoof };
  if (form) o.planes = landmarkPlanes(hl, hw, z0, z1, form);
  LANDMARK_SOLIDS.push(o); b.solids.push(o);
  if (z0 < .2) LANDMARK_BLOCKERS.push(o);
  return o;
}
function clockComposition(b) {
  const p = b.profile, h = p.shaft, r = p.half;
  // The map is the broad stone plinth; every narrower stage above it is a real solid.
  for (let y = 4; y < 6; y++) for (let x = 4; x < 6; x++) map[idx(b.x + x, b.y + y)] = Math.fround(.38);
  landmarkSolid(b, 5, 5, 1.06, 1.06, 0, .38, 'base', null, true);
  landmarkSolid(b, 5, 5, r + .13, r + .13, .38, .75, 'course', null, true);
  landmarkSolid(b, 5, 5, r, r, .75, h, 'shaft', null, true);
  for (const z of [1.05, h * .52, h - .08]) landmarkSolid(b, 5, 5, r + .05, r + .05, z, z + .08, 'course', null, true);
  // Corner piers, recessed shaft windows and a slightly overhanging clock chamber.
  for (const sx of [-1,1]) for (const sy of [-1,1]) landmarkSolid(b, 5 + sx * (r - .025), 5 + sy * (r - .025), .045, .045, .75, h, 'pier', null, true);
  landmarkSolid(b, 5, 5, r + .12, r + .12, h, h + 1.35, 'clock', null, true);
  landmarkSolid(b, 5, 5, r + .2, r + .2, h + 1.35, h + 1.46, 'course', null, true);
  if (p.form === 'flat') {
    for (const sx of [-1,1]) for (const sy of [-1,1]) landmarkSolid(b, 5 + sx * r, 5 + sy * r, .095, .095, h + 1.46, h + 2.01, 'pier', null, true);
  } else {
    landmarkSolid(b, 5, 5, r + .2, r + .2, h + 1.46, h + 1.46 + p.cap, 'roof', p.form, true);
    landmarkSolid(b, 5, 5, .016, .016, h + 1.46 + p.cap, h + 1.76 + p.cap, 'finial', null, true);
  }
}
function cathedralComposition(b) {
  const p = b.profile;
  for (let y = 4; y < 8; y++) for (const x of [3,6]) map[idx(b.x + x,b.y + y)] = Math.fround(p.aisle);
  map[idx(b.x + 6,b.y + 3)] = Math.fround(p.right);
  // Tall central nave, lower side aisles and a proper ridge instead of a flat four-cell roof.
  landmarkSolid(b, 5, 6, 1.07, 2.08, 3, p.ridge, 'roof', 'gable', true);
  for (const sx of [-1,1]) landmarkSolid(b, 5 + sx * 1.5, 6, .55, 2.08, p.aisle, p.aisle + .5, 'roof', 'gable', true);
  if (p.name === 'high gothic' || p.name === 'limestone minster')
    landmarkSolid(b, 5, 6.6, 2.06, .53, p.aisle, p.name === 'high gothic' ? 3.5 : 3.2, 'roof', 'crossgable', true);
  for (const z of [.28, p.aisle - .1]) {
    landmarkSolid(b, 3, 6, .045, 2.06, z, z + .075, 'course');
    landmarkSolid(b, 7, 6, .045, 2.06, z, z + .075, 'course');
  }
  // Inclined buttresses grow out of the aisle walls. They have a footprint, not a painted stripe.
  for (const sx of [-1,1]) for (const y of [4.5,5.5,6.5,7.5]) {
    const o = landmarkSolid(b, 5 + sx * 2.13, y, .23, .085, 0, p.aisle + .6, 'buttress', 'box');
    o.planes.push([sx * 2.5,0,1,p.aisle + .05]);
    landmarkSolid(b, 5 + sx * 2.14, y, .26, .115, 0, .22, 'base');
  }
  for (const sx of [-1,1]) landmarkSolid(b, 5 + sx * .3, 3.95, .055, .095, 0, .6, 'portal');
  landmarkSolid(b, 5, 3.95, .37, .095, .6, .86, 'portal', 'gable');
  for (const [x, height, cap] of [[3.5,8,p.spire],[6.5,p.right,p.spire * (p.name === 'limestone minster' ? .55 : 1)]]) {
    // The solid tower stops at the stair landing. The bell and roof sit above an open gallery.
    landmarkSolid(b, x, 3.5, .55, .55, height - .1, height, 'course');
    for (const sx of [-1,1]) for (const sy of [-1,1]) landmarkSolid(b, x + sx * .43, 3.5 + sy * .43, .055, .055, height, height + .87, 'pier');
    landmarkSolid(b, x, 3.5, .11, .11, height + .39, height + .63, 'bell', 'hip');
    landmarkSolid(b, x, 3.5, .018, .018, height + .6, height + .89, 'finial');
    landmarkSolid(b, x, 3.5, .57, .57, height + .87, height + .97, 'course');
    landmarkSolid(b, x, 3.5, .59, .59, height + .97, height + .97 + cap, 'roof', p.cap);
    landmarkSolid(b, x, 3.5, .018, .018, height + .97 + cap, height + 1.22 + cap, 'finial');
    landmarkSolid(b, x, 3.5, .075, .012, height + 1.12 + cap, height + 1.14 + cap, 'finial');
    // Low open balustrades at the landing, with clear views between the stone uprights.
    for (const sy of [-1,1]) landmarkSolid(b, x, 3.5 + sy * .47, .45, .018, height, height + .11, 'balustrade');
    for (const sx of [-1,1]) landmarkSolid(b, x + sx * .47, 3.5, .018, .45, height, height + .11, 'balustrade');
  }
  if (p.name === 'copper abbey') {
    landmarkSolid(b, 5, 6.8, .38, .38, p.ridge - .2, p.ridge + .5, 'lantern', null, true);
    landmarkSolid(b, 5, 6.8, .43, .43, p.ridge + .5, p.ridge + 1.15, 'roof', 'hip', true);
  }
}
let clockNumber = 0, cathedralNumber = 0;
for (const [block, kind] of landmarkOf) {
  if (kind !== 'clock' && kind !== 'cathedral') continue;
  const b = { block, kind, x: block % NB * 8, y: Math.floor(block / NB) * 8, solids: [],
    profile: kind === 'clock' ? CLOCK_PROFILES[clockNumber++ % CLOCK_PROFILES.length] : CATHEDRAL_PROFILES[cathedralNumber++ % CATHEDRAL_PROFILES.length] };
  LANDMARK_BUILDINGS.push(b);
  if (kind === 'clock') clockComposition(b); else cathedralComposition(b);
}
const landmarkSolidsB = bucketed(LANDMARK_SOLIDS), landmarkBlockersB = bucketed(LANDMARK_BLOCKERS);
const LANDMARK_BY_BLOCK = new Map(LANDMARK_BUILDINGS.map(b => [b.block,b]));
const LANDMARK_ROOF_MASK = architectureCellMask(LANDMARK_SOLIDS.filter(o => o.walkRoof), 0);
const LANDMARK_BLOCK_MASK = architectureCellMask(LANDMARK_BLOCKERS, .5);
function landmarkSurfaceHeight(o, x, y) {
  const u = rel(x - o.x), v = rel(y - o.y);
  if (Math.abs(u) > o.hl || Math.abs(v) > o.hw) return 0;
  let top = o.z1, bottom = o.z0;
  if (o.planes) for (const [nx,ny,nz,limit] of o.planes) {
    const d = limit - nx * u - ny * v;
    if (!nz) { if (d < 0) return 0; }
    else if (nz > 0) top = Math.min(top,d / nz); else bottom = Math.max(bottom,d / nz);
  }
  return top >= bottom ? top : 0;
}
function landmarkRoofHeight(x, y) {
  if (!LANDMARK_ROOF_MASK[idx(Math.floor(x),Math.floor(y))]) return 0;
  let height = 0;
  for (const b of LANDMARK_BUILDINGS) {
    if (Math.abs(rel(x - b.x - 5)) > 3 || Math.abs(rel(y - b.y - 5.5)) > 3) continue;
    for (const o of b.solids) if (o.walkRoof) height = Math.max(height,landmarkSurfaceHeight(o,x,y));
  }
  return height;
}
function landmarkBlocked(x, y, pad = 0) {
  if (!LANDMARK_BLOCK_MASK[idx(Math.floor(x),Math.floor(y))]) return false;
  for (const o of landmarkBlockersB[bi(Math.floor(x / 8),Math.floor(y / 8))]) if (landmarkContains(o,x,y,pad)) return true;
  return false;
}
function landmarkTowerBlocked(x, y, height) {
  return landmarkSolidsB[bi(Math.floor(x / 8),Math.floor(y / 8))].some(o => o.kind === 'pier' && o.z0 === height && landmarkContains(o,x,y,.035));
}
const landmarkContains = (o,x,y,pad = 0) => Math.abs(rel(x - o.x)) < o.hl + pad && Math.abs(rel(y - o.y)) < o.hw + pad;
function landmarkCarClear(x, y, hx, hy, hl, hw) {
  const pad = hl + hw;
  if (!LANDMARK_BLOCK_MASK[idx(Math.floor(x),Math.floor(y))]) return true;
  // All additional ground members are axis aligned; test the vehicle and masonry separating axes.
  for (const o of LANDMARK_BLOCKERS) {
    const qx = rel(o.x - x), qy = rel(o.y - y);
    if (Math.abs(qx) > o.hl + pad || Math.abs(qy) > o.hw + pad) continue;
    if (Math.abs(qx) < o.hl + Math.abs(hx) * hl + Math.abs(hy) * hw && Math.abs(qy) < o.hw + Math.abs(hy) * hl + Math.abs(hx) * hw &&
      Math.abs(qx * hx + qy * hy) < hl + Math.abs(hx) * o.hl + Math.abs(hy) * o.hw &&
      Math.abs(-qx * hy + qy * hx) < hw + Math.abs(hy) * o.hl + Math.abs(hx) * o.hw) return false;
  }
  return true;
}
