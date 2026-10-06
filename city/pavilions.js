// Glasshouse silhouettes and merchant rows share the city's existing ground footprints and shop identities.
// These are roof volumes and details above head height; nothing narrows a door or the covered streets.
const PAVILION_SOLIDS = [], MERCHANT_BUILDINGS = [], MERCHANT_FACES = Array.from({ length: 4 }, () => new Array(N * N));
const MERCHANT_BY_SHOP = new Map();
const MERCHANT_PROFILES = {
  chinatown: [
    { name: 'jade gallery', wall: STONE, trim: GREEN, roof: GREEN, spacing: .65, rise: .32, balconies: true },
    { name: 'brick merchant', wall: BRICK, trim: RED, roof: GRAY, spacing: .52, rise: .24, balconies: false },
    { name: 'tea terrace', wall: SKIN, trim: GREEN, roof: GREEN, spacing: .8, rise: .4, balconies: true },
    { name: 'painted guildhall', wall: STONE, trim: RED, roof: BRICK, spacing: .7, rise: .3, balconies: false },
  ],
  shotengai: [
    { name: 'timber shop', wall: BRICK, trim: GRAY, roof: GRAY, spacing: .7, rise: .28, timber: true },
    { name: 'tile arcade', wall: STONE, trim: BLUE, roof: GRAY, spacing: .55, rise: .18, timber: false },
    { name: 'showa shop', wall: SKIN, trim: GREEN, roof: GREEN, spacing: .8, rise: .24, timber: false },
    { name: 'lantern counter', wall: GRAY, trim: RED, roof: GRAY, spacing: .65, rise: .32, timber: true },
  ],
};
function pavilionSolid(x, y, hl, hw, z0, z1, kind, extra = {}) {
  const o = { x, y, hl, hw, z0, z1, c: 1, s: 0, kind, ...extra };
  PAVILION_SOLIDS.push(o); return o;
}
for (const gh of GLASSHOUSES) {
  const x0 = GARDEN.x0 + gh.gx0, y0 = GARDEN.y0 + gh.gy0;
  const x1 = GARDEN.x0 + gh.gx1 + 1, y1 = GARDEN.y0 + gh.gy1 + 1;
  const x = (x0 + x1) / 2, y = (y0 + y1) / 2, eave = gh.sty === 18 ? .72 : gh.h;
  for (let gy = gh.gy0; gy <= gh.gy1; gy++) for (let gx = gh.gx0; gx <= gh.gx1; gx++) map[idx(GARDEN.x0 + gx,GARDEN.y0 + gy)] = eave;
  gh.eave = eave;
  if (gh.sty === 18) {
    // A tall palm-house lantern flanked by two lower hipped wings; the central ridge runs toward the lake.
    for (const sign of [-1,1]) {
      const roof = pavilionSolid(x + sign * 1.65,y,.87,1.53,eave,1.15,'glazing',{ gh, walkRoof: true });
      roof.planes = landmarkPlanes(roof.hl,roof.hw,roof.z0,roof.z1,'hip');
    }
    pavilionSolid(x,y,.84,1.5,eave,1.32,'clerestory',{ gh, walkRoof: true });
    const roof = pavilionSolid(x,y,.89,1.55,1.32,2.02,'glazing',{ gh, walkRoof: true });
    roof.planes = landmarkPlanes(roof.hl,roof.hw,roof.z0,roof.z1,'gable');
    pavilionSolid(x,y,.025,1.58,2.02,2.1,'crest',{ gh });
    for (const sign of [-1,1]) pavilionSolid(x + sign * .85,y,.018,1.54,eave,1.36,'iron',{ gh });
  }
  const doorX = GARDEN.x0 + gh.door[0], doorY = GARDEN.y0 + gh.door[1];
  const hood = pavilionSolid(doorX,doorY,.35,.18,.35,.53,'glazing',{ gh });
  hood.planes = landmarkPlanes(hood.hl,hood.hw,hood.z0,hood.z1,'gable');
}
{
  const lots = new Map();
  for (let k = 0; k < map.length; k++) {
    const sh = SHOP[k], sty = STY[k];
    if (!sh || !map[k] || sty !== 10 && sty !== 17) continue;
    if (!lots.has(sh)) lots.set(sh,[]);
    lots.get(sh).push(k);
  }
  for (const [sh,cells] of lots) {
    const rx = cells[0] % N, ry = Math.floor(cells[0] / N), seed = SEED[cells[0]];
    const xs = cells.map(k => rx + rel(k % N - rx)), ys = cells.map(k => ry + rel(Math.floor(k / N) - ry));
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
    const region = STY[cells[0]] === 10 ? 'chinatown' : 'shotengai';
    const p = MERCHANT_PROFILES[region][Math.floor(fract(seed * 37) * 4)];
    const b = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, x0, x1, y0, y1, h: map[cells[0]], seed, region, profile: p, sh };
    b.faces = architectureFaces(b,cells,MERCHANT_FACES);
    for (const f of b.faces) {
      f.units = Math.max(1,Math.floor((f.end - f.start - .16) / p.spacing));
      f.spacing = (f.end - f.start - .16) / f.units;
      f.floors = Math.max(2,Math.floor((f.height - .52) / .35));
      f.fh = (f.height - .52) / f.floors;
      const center = (f.start + f.end) / 2, half = (f.end - f.start) / 2;
      const detail = (along,depth,hl,hw,z0,z1,kind,extra = {}) => pavilionSolid(
        (f.side ? along : f.line) + f.nx * depth,(f.side ? f.line : along) + f.ny * depth,
        hl,hw,z0,z1,kind,{ c: f.side ? 1 : 0,s: f.side ? 0 : 1,b,f,...extra });
      detail(center,.035,half,.075,b.h - .065,b.h + .025,'eave');
      if (!f.front) continue;
      detail(center,.035,half - .1,.055,.33,.405,'shopboard');
      const awning = detail(center,.12,half - .12,.19,.285,.325,'awning');
      if (region === 'shotengai' && p.timber) awning.kind = 'eave';
      // One blade sign per storefront, placed at its edge, instead of a neon sign repeated in every bay.
      const signHeight = Math.min(.55,sh.word.length * .065 + .055);
      detail(f.start + .23,.105,.027,.055,.52,Math.min(b.h - .16,.52 + signHeight),'blade');
      if (region === 'chinatown' && p.balconies) {
        const z = .52 + f.fh;
        detail(center,.085,half - .16,.14,z,z + .028,'balcony');
        detail(center,.215,half - .16,.009,z + .028,z + .14,'lattice');
        for (const sign of [-1,1]) detail(center + sign * (half - .16),.085,.012,.14,z + .028,z + .14,'lattice');
      } else if (region === 'shotengai') {
        detail(center,.025,half - .12,.055,.52 + f.fh,.56 + f.fh,'windowhood');
        detail(f.end - .28,.08,.13,.09,.62,.74,'ac');
      }
    }
    const access = sh.kind === SHOP_APTS || sh.word === 'HOTEL' || sh.word === 'MOTEL';
    if (!access) {
      const roof = pavilionSolid(b.x,b.y,(x1 - x0) / 2 + .04,(y1 - y0) / 2 + .04,b.h,b.h + p.rise,'tiles',{ b,walkRoof: true });
      roof.planes = landmarkPlanes(roof.hl,roof.hw,roof.z0,roof.z1,region === 'chinatown' ? 'hip' : 'gable');
    }
    MERCHANT_BUILDINGS.push(b); MERCHANT_BY_SHOP.set(sh,b);
  }
}
const pavilionSolidsB = bucketed(PAVILION_SOLIDS);
const PAVILION_ROOF_MASK = architectureCellMask(PAVILION_SOLIDS.filter(o => o.walkRoof),0);
function pavilionRoofHeight(x, y) {
  if (!PAVILION_ROOF_MASK[idx(Math.floor(x),Math.floor(y))]) return 0;
  let height = 0;
  for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++)
    for (const o of pavilionSolidsB[bi(Math.floor(x / 8) + k,Math.floor(y / 8) + j)])
      if (o.walkRoof) height = Math.max(height,landmarkSurfaceHeight(o,x,y));
  return height;
}
for (const o of roofs) o.z = Math.max(o.z,pavilionRoofHeight(o.x,o.y));
