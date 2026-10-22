// Assemble the generated city after authored outdoor geometry has been created,
// before saves or the first frame. Interior coordinates never enter this pass.
function assembleArchipelago() {
  if (worldReady) return;
  const oldN = N, moved = new WeakSet();
  const sourcePlaces = new WeakMap();
  for (const p of CITY_PLACES.values()) sourcePlaces.set(p.shop, [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2]);
  function point(p, kind = 'city') {
    if (!p || moved.has(p)) return;
    moved.add(p);
    [p[0], p[1]] = citySourcePoint(p[0], p[1], kind);
  }
  function geometry(o, kind = 'city', inherited = null) {
    if (!o || typeof o !== 'object' || moved.has(o)) return;
    if (Array.isArray(o)) {
      for (const child of o) geometry(child, kind, inherited);
      return;
    }
    moved.add(o);
    let sourceY = o.y ?? o.y0;
    if (sourceY == null) {
      if (o.by != null) sourceY = o.by * 8;
      else if (o.side) sourceY = o.line;
      else sourceY = o.start ?? 0;
    }
    let sourceX = o.x ?? o.x0;
    if (sourceX == null) sourceX = o.bx != null ? o.bx * 8 : 0;
    if (o.ownerCell != null) {
      sourceX = o.ownerCell % oldN + .5;
      sourceY = Math.floor(o.ownerCell / oldN) + .5;
    } else if (sourcePlaces.has(o.sh || o.b?.sh)) {
      // Projecting signs, eaves and balconies belong to their building, even
      // when their centre falls across a neighborhood boundary.
      [sourceX, sourceY] = sourcePlaces.get(o.sh || o.b.sh);
    }
    const [targetX, targetY] = citySourcePoint(sourceX, sourceY, kind);
    const offset = inherited || [targetX - sourceX, targetY - sourceY];
    const [dx, dy] = offset;
    if (sourcePlaces.has(o.sh || o.b?.sh)) {
      // Original east-edge doors wrapped x=256 back to zero. Keep them beside
      // their owning building before applying the neighborhood translation.
      for (const key of ['x','x0','x1','cx','ex','gx']) if (Number.isFinite(o[key])) {
        o[key] = sourceX + mod(o[key] - sourceX + oldN / 2, oldN) - oldN / 2;
      }
    }
    for (const key of ['x','x0','x1','cx','ex','gx']) if (Number.isFinite(o[key])) o[key] += dx;
    for (const key of ['y','y0','y1','cy','ey','gy']) if (Number.isFinite(o[key])) o[key] += dy;
    if (Number.isFinite(o.bx)) o.bx += dx / 8;
    if (Number.isFinite(o.by)) o.by += dy / 8;
    if (Number.isInteger(o.ownerCell)) o.ownerCell = citySourceCell(o.ownerCell);
    if (Number.isInteger(o.block)) o.block = citySourceCell(o.block,true);
    if (o.side != null && Number.isFinite(o.start) && Number.isFinite(o.line)) {
      o.start += o.side ? dx : dy;
      o.end += o.side ? dx : dy;
      o.line += o.side ? dy : dx;
      if (o.sign?.center != null) o.sign.center += o.side ? dx : dy;
    }
    for (const key of ['tiers','crown','roofRects','roofParts','faces','architecture','belle','solids']) geometry(o[key],kind,offset);
    if (o.sh) {
      geometry(o.sh.architecture, kind, offset);
      geometry(o.sh.belle, kind, offset);
    }
  }
  function arrayCells(source, blocks = false, blank) {
    const size = blocks ? CITY_LAYOUT.width / 8 : CITY_LAYOUT.width;
    const out = Array.isArray(source) ? new Array(size * size + 1) : new source.constructor(size * size + 1);
    if (blank !== undefined) out.fill(blank);
    const stride = blocks ? CITY_SOURCE_NB : CITY_SOURCE_N;
    for (let k = stride * (blocks ? 1 : 8); k < stride * (blocks ? 25 : 200); k++) {
      if (source[k] !== undefined) out[citySourceCell(k,blocks)] = source[k];
    }
    return out;
  }
  function sparseCells(source) {
    const out = arrayCells(source);
    source.length = out.length;
    for (let k = 0; k < source.length; k++) {
      delete source[k];
      if (out[k] !== undefined) source[k] = out[k];
    }
  }
  function blockMap(source) {
    const entries = Array.from(source);
    source.clear();
    for (const [k,value] of entries) source.set(citySourceCell(k,true),value);
  }
  const originalCounts = {
    places: CITY_PLACES.size,
    homes: Array.from(CITY_PLACES.values()).filter(p => p.shop.kind === SHOP_APTS).length,
    people: people.length,
  };
  const serviceLanes = SERVICES.map(s => {
    const [, y] = citySourcePoint(s.bx * 8, s.by * 8);
    return [s, s.lane + y - s.by * 8];
  });
  for (let i = lamps.length - 1; i >= 0; i--) {
    if (seaAt(lamps[i].x, lamps[i].y) && !onPier(lamps[i].x, lamps[i].y)) lamps.splice(i, 1);
  }
  // The airport moves independently, keeping its runway, aircraft and terminal together.
  for (const o of [AIRPORT,RUNWAY,TAXIWAY,APRON,HELIPADS,TOWER,AIRPORT_BLDG,aircraft]) geometry(o,'airport');
  for (const craft of aircraft) {
    geometry(craft.home, 'airport');
    if (craft.path) for (const p of craft.path) point(p, 'airport');
  }
  for (let k = 0; k < STANDS_X.length; k++) STANDS_X[k] += CITY_LAYOUT.airportX;
  STAND_Y += CITY_LAYOUT.airportY;
  // The causeway runs beside the east edge of the airfield, then turns into its landside road.
  Object.assign(CAUSEWAY, { x: AIRPORT.x1 + 14, y0: AIRPORT.y0 + 1, y1: 105 });
  moved.add(CAUSEWAY);

  const belleRoofs = belleBuildingsB.flat();
  for (const root of [GRAND_HOTEL,AQUARIUM,CASINO,EXCHANGE,MUSEUM,CLUB,GARDEN,ISLE,LIGHTHOUSE,FOOTBRIDGE,
    FAIR,WHEEL,CAROUSEL,WHEEL_BOARD,MARINA,SERVICES,GAS_STATIONS,BELLE_BUILDINGS,BACKROOMS_SEAM,
    COURIER_DEPOT,COURIER_SURFACES,COURIER_STAIRS,COURIER_LADDERS,COURIER_SCENERY,COURIER_SITE,COURIER_GARDEN,
    COURIER_FOREMAN,COURIER_NICO,COURIER_ARCH,COURIER_ARCADE_SIGN,COURIER_SIGNS,COURIER_RODS,COURIER_LATTICE,COURIER_BULBS,
    lamps,trees,benches,parks,extras,cranes,stacks,solids,radios,potties,stations,NIGHT_MARKET,STALLS,BOOTHS,fairFolk,
    FISH_HUT,GRILLS,lanterns,vendors,machines,roofs,GAS_CLEAR,ARCH_BUILDINGS,ARCH_DETAILS,ARCH_BLOCKERS,ARCH_STEPS,
    LANDMARK_BUILDINGS,LANDMARK_SOLIDS,LANDMARK_BLOCKERS,MERCHANT_BUILDINGS,PAVILION_SOLIDS,belleRoofs,belleDetails,
    doors,people,footCops,cars,elPillars,ANGLERS,SLOTS,fleet]) geometry(root);
  for (const cop of footCops) {
    const corner = cop.corner;
    const [x, y] = citySourcePoint(corner.ix * 8, corner.iy * 8);
    corner.ix = x / 8;
    corner.iy = y / 8;
  }
  for (const visitor of fairFolk) {
    [visitor.tx, visitor.ty] = citySourcePoint(visitor.tx, visitor.ty);
  }
  for (const p of people) {
    p.path = [];
    if (p.goal) geometry(p.goal);
  }
  for (const p of parks) {
    const [x, y] = citySourcePoint(p[0] * 8, p[1] * 8);
    p[0] = x / 8;
    p[1] = y / 8;
  }
  for (const light of lights) {
    const sourceX = light.bx, sourceY = light.by;
    geometry(light);
    [light.bx, light.by] = citySourcePoint(sourceX, sourceY);
  }
  for (const b of [GRAND_HOTEL,AQUARIUM]) b.doorU += CITY_LAYOUT.cityX;
  MARINA.end += CITY_LAYOUT.southY;
  for (let i = 0; i < MARINA.fingers.length; i++) MARINA.fingers[i] += CITY_LAYOUT.southY;
  geometry(MARINA.office);
  for (const [service, lane] of serviceLanes) {
    service.lane = lane;
    point(service.door);
  }
  point(COURIER_DEPOT.roof);
  point(COURIER_DEPOT.door);
  for (const ladder of COURIER_LADDERS) { point(ladder.bottom);point(ladder.top); }
  for (const rod of COURIER_RODS) { point(rod.a);point(rod.b); }
  for (const p of COURIER_NEON) point(p);
  for (const stall of STALLS) point(stall.at);
  for (const booth of BOOTHS) point(booth.at);
  for (const pier of PIERS) {
    const x = (pier[0] + pier[2]) / 2, y = (pier[1] + pier[3]) / 2;
    const [targetX, targetY] = citySourcePoint(x, y);
    const dx = targetX - x, dy = targetY - y;
    pier[0] += dx;
    pier[2] += dx;
    pier[1] += dy;
    pier[3] += dy;
  }
  for (const station of EL_STATIONS) {
    // Stations stay on the straight railway beside their stairs. Without a y
    // coordinate, the generic transform mistakes the terminals for coastal lots.
    geometry(station,'city',[CITY_LAYOUT.cityX,CITY_LAYOUT.southY]);
    for (const stair of station.stairs) {
      stair.ox += CITY_LAYOUT.cityX;
      stair.oy += CITY_LAYOUT.southY;
      geometry(stair);
    }
  }
  EL_Y+=CITY_LAYOUT.southY;EL_Y0+=CITY_LAYOUT.southY;EL_Y1+=CITY_LAYOUT.southY;
  for(let i=elPillars.length-1;i>=0;i--)if(elPillars[i].x<140||elPillars[i].x>352)elPillars.splice(i,1);
  for (let i = 0; i < 2; i++) {
    EL_TRACK[i] += CITY_LAYOUT.southY;
    EL_PLAT[i] += CITY_LAYOUT.southY;
  }
  for (const seed of DIST_SEEDS) {
    const [x, y] = citySourcePoint(seed[0] * 8, seed[1] * 8);
    seed[0] = x / 8;
    seed[1] = y / 8;
  }
  for (const r of [...SUPER, ...removed]) {
    const [x, y] = citySourcePoint(r[0] * 8, r[1] * 8);
    const dx = x / 8 - r[0], dy = y / 8 - r[1];
    r[0] += dx;
    r[1] += dy;
    if (r.length > 3) {
      r[2] += dx;
      r[3] += dy;
    }
  }
  for (const p of CITY_PLACES.values()) {
    p.legacyCells = p.cells.slice();
    p.cell = citySourceCell(p.cell);
    p.cells = p.cells.map(k => citySourceCell(k));
    geometry(p);
    if (Array.isArray(p.shop.pad)) point(p.shop.pad);
  }
  for (const faces of [...ARCH_FACES, ...MERCHANT_FACES, ...BELLE_FACES]) {
    for (const f of faces) geometry(f);
    sparseCells(faces);
  }
  map=arrayCells(map);STY=arrayCells(STY);SEED=arrayCells(SEED);SHOP=arrayCells(SHOP);ROAD=arrayCells(ROAD);
  GAS_CELL=arrayCells(GAS_CELL);BELLE_ROOF_CELLS=arrayCells(BELLE_ROOF_CELLS);
  architectureStepCells=arrayCells(architectureStepCells);architectureWalkCells=arrayCells(architectureWalkCells);architectureCarCells=arrayCells(architectureCarCells);
  LANDMARK_ROOF_MASK=arrayCells(LANDMARK_ROOF_MASK);LANDMARK_BLOCK_MASK=arrayCells(LANDMARK_BLOCK_MASK);PAVILION_ROOF_MASK=arrayCells(PAVILION_ROOF_MASK);BELLE_ROOF_INFILL=arrayCells(BELLE_ROOF_INFILL);
  for(const a of [courierSurfaceCells,lampGlowCells,streetGeometryCells,GAS_ZONE])sparseCells(a);
  groundSnowCells.length=CITY_LAYOUT.width*CITY_LAYOUT.height+1;groundSnowCells.fill(undefined);
  DIST=arrayCells(DIST,true,'sea');KIND=arrayCells(KIND,true,'sea');DIST_OWNER=arrayCells(DIST_OWNER,true,-1);
  HSEG=arrayCells(HSEG,true);VSEG=arrayCells(VSEG,true);
  blockMap(landmarkOf);blockMap(LANDMARK_BY_BLOCK);blockMap(STATION_AT);
  const oldSt = ST_NAMES, oldAve = AVE_NAMES;
  ST_NAMES = new Array(CITY_LAYOUT.height / 8).fill('COAST ROAD');
  AVE_NAMES = new Array(CITY_LAYOUT.width / 8).fill('SHORE WAY');
  oldSt.forEach((name, i) => {
    const [, y] = citySourcePoint(0, i * 8);
    ST_NAMES[y / 8] = name;
  });
  oldAve.forEach((name, i) => { AVE_NAMES[i + CITY_LAYOUT.cityX / 8] = name; });
  const bridgeNames = Object.entries(BRIDGE_NAMES);
  for (const k of Object.keys(BRIDGE_NAMES)) delete BRIDGE_NAMES[k];
  for (const [k, name] of bridgeNames) BRIDGE_NAMES[Number(k) + CITY_LAYOUT.cityX / 8] = name;
  SHORE_N = CITY_LAYOUT.northY / 8;
  SHORE_S = (200 + CITY_LAYOUT.southY) / 8;
  EL_ROW += CITY_LAYOUT.southY / 8;
  ISLE_BX += CITY_LAYOUT.cityX / 8;
  FAIR_BX += CITY_LAYOUT.cityX / 8;
  MARINA_BX += CITY_LAYOUT.cityX / 8;
  BRIDGE_X = BRIDGE_X.map(x => x + CITY_LAYOUT.cityX / 8);
  [px, py] = citySourcePoint(px, py);
  N = CITY_LAYOUT.width;
  NB = N / 8;
  worldReady = true;
  CITY_LAYOUT_ID = CITY_LAYOUT.id;
  CITY_SAVE_VERSION = 5;
  Object.assign(MAP_WORLD, { width: CITY_LAYOUT.chartWidth, height: CITY_LAYOUT.chartHeight, wrap: false });

  // Keep the street grid inside intact neighborhoods; its outer ring follows the
  // stepped headlands instead of enclosing the former rectangular footprint.
  cityBlockMask = new Uint8Array(NB * NB);
  for (let y = 1; y < 25; y++) for (let x = 0; x < CITY_SOURCE_NB; x++) {
    const [wx, wy] = citySourcePoint(x * 8, y * 8);
    cityBlockMask[bi(wx / 8, wy / 8)] = 1;
  }
  for (let y = 0; y < NB; y++) for (let x = 0; x < NB; x++) {
    const k = bi(x, y), here = !!cityBlockMask[k];
    const above = !!cityBlockMask[bi(x, y - 1)], left = !!cityBlockMask[bi(x - 1, y)];
    if (!here && !above) HSEG[k] = 0;
    else if (here !== above) HSEG[k] = 1;
    if (!here && !left) VSEG[k] = 0;
    else if (here !== left) VSEG[k] = 1;
  }
  for(const bx of BRIDGE_X)for(let y=21;y<27;y++)VSEG[bi(bx,y)]=1;
  buildCityCoasts();
  ROAD.fill(0);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++) {
    const lx=x&7,ly=y&7,bx=x>>3,by=y>>3;
    let road = 0;
    if (lx < 2 && ly < 2) road = degree(bx, by) ? 3 : 0;
    else if (lx < 2 && vseg(bx, by)) road = 1;
    else if (ly < 2 && hseg(bx, by)) road = 2;
    ROAD[idx(x, y)] = road;
  }
  for (let y = 0; y < NB; y++) for (let x = 0; x < NB; x++) {
    const k = bi(x, y);
    if (DIST[k] === 'sea' && CITY_ISLANDS.some(o => cityIslandEdge(x * 8 + 4, y * 8 + 4, o) > -4)) {
      DIST[k] = KIND[k] = 'waterfront';
    }
  }
  // Junctions moved with their neighboring lots; rebuild poles on the new grid.
  lights.length = 0;
  for (let y = 0; y < NB; y++) for (let x = 0; x < NB; x++) {
    if (degree(x, y) < 3) continue;
    const bx = x * 8, by = y * 8;
    if (vseg(x, y - 1)) lights.push({ x: bx + 2 - CURB, y: by - .25, vert: true, bx, by });
    if (vseg(x, y)) lights.push({ x: bx + CURB, y: by + 2.25, vert: true, bx, by });
    if (hseg(x - 1, y)) lights.push({ x: bx - .25, y: by + CURB, vert: false, bx, by });
    if (hseg(x, y)) lights.push({ x: bx + 2.25, y: by + 2 - CURB, vert: false, bx, by });
  }
  // Outdated seam structure is replaced with the raised crossings below.
  bridgeBits.length = towers.length = boats.length = 0;
  // Keep working cranes on the industrial quay, rather than across public piers.
  for(const crane of cranes)if(onPier(crane.x,crane.y)){
    const candidates=[];
    for(let y=crane.y-32;y<crane.y+32;y++)for(let x=crane.x-32;x<crane.x+32;x++){
      if(![[0,0],[.6,.6],[.6,-.6],[-.6,.6],[-.6,-.6]].every(([ox,oy])=>!seaAt(x+ox,y+oy)&&!ROAD[idx(x+ox,y+oy)]&&!map[idx(x+ox,y+oy)]&&!onPier(x+ox,y+oy)))continue;
      if(cranes.some(o=>o!==crane&&near(o.x,o.y,x,y)<2)||doors.some(o=>near(o.x,o.y,x,y)<2))continue;
      const kind=blockKind(Math.floor(x/8),Math.floor(y/8));
      candidates.push({x,y,score:near(x,y,crane.x,crane.y)+(['yard','construction'].includes(kind)?0:100)});
    }
    candidates.sort((a,b)=>a.score-b.score);
    if(candidates.length){crane.x=candidates[0].x;crane.y=candidates[0].y;}
  }
  for (let y = 80; y < 380; y += 2) for (let x = 56; x < 480; x += 2) {
    if (!naturalCoastAt(x, y) || coastalGround(x, y).depth <= 2 || onPier(x, y) || ROAD[idx(x, y)] || hash(x, y, 736) >= .09) continue;
    trees.push({ x, y, kind: hash(x, y, 737) > .4 ? 'pine' : 'birch', s: .8 + hash(x, y, 738) * .5, seed: hash(x, y, 739) });
  }
  for (let i = 0; i < 16; i++) {
    let kind = 'sail';
    if (i % 4 === 0) kind = 'ferry';
    else if (i % 3 === 0) kind = 'tug';
    boats.push({ kind, a: 140, b: 372, y: 187 + i % 3 * 4, sp: .15 + i % 4 * .04, ph: i / 16 });
  }
  buildWildIslandFields();
  buildWildIslands();
  // Opposite source blocks may now be on separate headlands. Validate against
  // the finished building map before rebuilding the renderer's spatial buckets.
  for (let i = lanterns.length - 1; i >= 0; i--) if (!lanternAnchored(lanterns[i])) lanterns.splice(i, 1);
  function rebucket(b, items) {
    const fresh = bucketed(items);
    b.length = fresh.length;
    for (let i = 0; i < fresh.length; i++) b[i] = fresh[i];
  }
  for(const [b,items]of [[lampsB,lamps],[treesB,trees],[benchesB,benches],[extrasB,extras],[solidsB,solids],[lanternsB,lanterns],[machinesB,machines],[roofsB,roofs],
    [architectureBuildingsB,ARCH_BUILDINGS],[architectureDetailsB,ARCH_DETAILS],[architectureBlockersB,ARCH_BLOCKERS],[architectureStepsB,ARCH_STEPS],
    [landmarkSolidsB,LANDMARK_SOLIDS],[landmarkBlockersB,LANDMARK_BLOCKERS],[pavilionSolidsB,PAVILION_SOLIDS],[belleBuildingsB,belleRoofs],[belleDetailsB,belleDetails],
    [doorsB,doors],[lightsB,lights],[elPillarsB,elPillars],[bridgeB,bridgeBits],
    [courierSceneryB,COURIER_SCENERY],[courierSignsB,COURIER_SIGNS],[courierSurfacesB,COURIER_SURFACES],[courierRodsB,COURIER_RODS],[courierLatticeB,COURIER_LATTICE],[courierBulbsB,COURIER_BULBS]])rebucket(b,items);
  routeCache.clear();POND_SD.clear();
  GN=N/2;carGrid=Array.from({length:GN*GN+1},()=>[]);pplGrid=Array.from({length:GN*GN+1},()=>[]);
  for (const c of cars) {
    delete c.sceneKey;
    delete c.route;
    c.dest = c.nh = null;
    // Cars on the old wrapping bridge must join the finished road network too.
    if (!ROAD[idx(c.x, c.y)]) toLane(c);
    plan(c);
  }
  TERRAIN_N = N * TERRAIN_SCALE;
  terrainHeights = new Float32Array(TERRAIN_N * TERRAIN_N + 1);
  terrainCells = new Uint8Array(N * N + 1);
  buildTerrain();
  buildIslandScenery();
  CITY_LAYOUT_CHECKPOINT={...originalCounts,layout:CITY_LAYOUT_ID};
}
let CITY_LAYOUT_CHECKPOINT=null;
assembleArchipelago();
