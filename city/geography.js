// Content identities are assigned before any layout relocation. Keep these IDs when moving a lot;
// its current grid cell is an address into the runtime map, not its save identity.
let CITY_LAYOUT_ID = 'coastal-v1';
const CITY_PLACES = new Map();
const cityPlaceByShop = new WeakMap();
for (let cell = 0; cell < SHOP.length; cell++) {
  const shop = SHOP[cell];
  if (!shop || !map[cell]) continue;
  let place = cityPlaceByShop.get(shop);
  if (!place) {
    place = { id: `shop:${cell}`, shop, cell, cells: [], x0: N, y0: N, x1: 0, y1: 0 };
    CITY_PLACES.set(place.id, place);
    cityPlaceByShop.set(shop, place);
  }
  const x = cell % N, y = Math.floor(cell / N);
  place.cells.push(cell);
  place.x0 = Math.min(place.x0, x); place.y0 = Math.min(place.y0, y);
  place.x1 = Math.max(place.x1, x + 1); place.y1 = Math.max(place.y1, y + 1);
}
function cityPlaceAtCell(cell) {
  const shop = Number.isInteger(cell) && cell >= 0 && cell < SHOP.length && SHOP[cell];
  return shop ? cityPlaceByShop.get(shop) || null : null;
}
function cityPlaceCell(id, preferred = -1) {
  const place = CITY_PLACES.get(id);
  if (!place) return -1;
  if (cityPlaceAtCell(preferred) === place && map[preferred]) return preferred;
  return place.cells.find(cell => SHOP[cell] === place.shop && map[cell]) ?? -1;
}
function cityHomeId(home) {
  const place = cityPlaceAtCell(home.cell);
  return place ? `home:${place.id}` : `home:${home.cell}`;
}
function cityWaypointId(id) {
  const match = /^home:(\d+)$/.exec(id);
  if (!match) return id;
  return cityHomeId({ cell: Number(match[1]) });
}
// A machine-readable preservation inventory. The cut is a candidate until every footprint clears it.
function cityLayoutInventory(splitY = 72) {
  const group = (id, name, x0, y0, x1, y1, kind = 'authored') => ({ id, name, kind, x0, y0, x1, y1 });
  const fixed = [
    group('grand-hotel', 'Grand Hotel', GRAND_HOTEL.bx * 8 + 2, GRAND_HOTEL.by * 8 + 2, GRAND_HOTEL.bx * 8 + 8, GRAND_HOTEL.by * 8 + 8),
    group('gardens', 'Botanical Gardens', GARDEN.x0, GARDEN.y0, GARDEN.x0 + GARDEN.w, GARDEN.y0 + GARDEN.h),
    ...[['casino', CASINO], ['exchange', EXCHANGE], ['museum', MUSEUM], ['club', CLUB], ['aquarium', AQUARIUM]].map(([id, b]) =>
      group(id, b.sh.word, b.bx * 8, b.by * 8, b.bx * 8 + 8, b.by * 8 + 8)),
    group('airport', 'Glyphport International', AIRPORT.x0, AIRPORT.y0, AIRPORT.x1, AIRPORT.y1),
    group('lighthouse', 'Lighthouse and footbridge', ISLE.x - ISLE.r * 1.5, FOOTBRIDGE.y0, ISLE.x + ISLE.r * 1.5, ISLE.y + ISLE.r * 1.5),
    group('fair', 'Sunset Pier', FAIR.x0, FAIR.y0, FAIR.x1, FAIR.y1),
    group('marina', 'Marina', MARINA.x - MARINA.reach - 1.2, MARINA.y0 - 1.2, MARINA.x + MARINA.reach + 1.2, MARINA.end + .8),
    group('courier-cluster', 'All authored courier routes',
      Math.min(COURIER_DEPOT.x0, ...COURIER_SURFACES.map(s => s.x - s.hl)),
      Math.min(COURIER_DEPOT.y0, ...COURIER_SURFACES.map(s => s.y - s.hw)),
      Math.max(COURIER_GARDEN.x + 1, ...COURIER_SURFACES.map(s => s.x + s.hl)),
      Math.max(COURIER_NICO.y + 1, ...COURIER_SURFACES.map(s => s.y + s.hw))),
    group('elevated-railway', 'Elevated railway and station approaches', 0, EL_Y - 1, N, EL_Y + 3, 'transport'),
    ...SUPER.map(([x0, y0, x1, y1, kind], i) => group(`superblock:${i}`, kind, x0 * 8, y0 * 8, (x1 + 1) * 8, (y1 + 1) * 8, 'superblock')),
    ...Array.from(landmarkOf, ([cell, kind]) => group(`landmark:${cell}`, kind, cell % NB * 8, Math.floor(cell / NB) * 8, cell % NB * 8 + 8, Math.floor(cell / NB) * 8 + 8, 'landmark')),
  ];
  const places = Array.from(CITY_PLACES.values(), p => ({
    ...group(p.id, p.shop.word, p.x0, p.y0, p.x1, p.y1, p.shop.kind === SHOP_APTS ? 'apartments' : 'shop'),
    cell: p.cell, cells: p.cells.length,
  }));
  const architecture = [...ARCH_BUILDINGS, ...BELLE_BUILDINGS, ...MERCHANT_BUILDINGS].map((b, i) =>
    group(`building:${i}`, b.sh?.word || 'Building', b.x0, b.y0, b.x1, b.y1, 'building'));
  const infrastructure = [
    ...stations.map((s, i) => group(`subway:${i}`, s.name, s.x - .3, s.y - .15, s.x + .3, s.y + .15, 'transport')),
    ...EL_STATIONS.map((s, i) => group(`el-station:${i}`, s.name, s.x - 3, EL_Y, s.x + 3, EL_Y + 2, 'transport')),
    ...GAS_STATIONS.map(s => group(`gas:${s.k}`, s.brand, s.x0, s.y0, s.x0 + 3, s.y0 + 3, 'service')),
    ...SERVICES.map((s, i) => group(`service:${i}`, BASE_KINDS[s.kind].title, s.bx * 8, s.by * 8, s.bx * 8 + 8, s.by * 8 + 8, 'service')),
    ...PIERS.map(([x0, y0, x1, y1], i) => {
      // Old northern piers cross y=256. Unroll that legacy representation onto the north coast for the audit.
      const offset = y1 > N ? N : 0;
      return group(`pier:${i}`, 'Pier', x0, y0 - offset, x1, y1 - offset, 'landing');
    }),
    group('fishing-hut', 'Bait and tackle hut', FISH_HUT.x - FISH_HUT.hl, FISH_HUT.y - FISH_HUT.hw, FISH_HUT.x + FISH_HUT.hl, FISH_HUT.y + FISH_HUT.hw, 'activity'),
    ...GRILLS.map((g, i) => group(`grill:${i}`, g.on, g.x - .2, g.y - .2, g.x + .2, g.y + .2, 'activity')),
    ...vendors.map((v, i) => group(`vendor:${i}`, v.type.name, v.x - v.type.w, v.y - .3, v.x + v.type.w, v.y + .3, 'activity')),
    ...STALLS.map((s, i) => group(`night-market:${i}`, s.word, s.x - .56, s.y - .15, s.x + .56, s.y + .15, 'activity')),
    ...ANGLERS.map((p, i) => {
      const y = p.y > N - 16 ? p.y - N : p.y;
      return group(`angler:${i}`, 'Fishing regular', p.x - .1, y - .1, p.x + .1, y + .1, 'activity');
    }),
  ];
  const crosses = p => p.y0 < splitY && p.y1 > splitY;
  const all = [...fixed, ...places, ...architecture, ...infrastructure];
  const classify = p => ({ ...p, island: p.y1 <= splitY ? 'north' : p.y0 >= splitY ? 'south' : 'crosses-cut' });
  return {
    layout: CITY_LAYOUT_ID, splitY, contentCells: N * N,
    counts: { places: places.length, apartmentLots: places.filter(p => p.kind === 'apartments').length, authoredGroups: fixed.length, architecturalBuildings: architecture.length, infrastructure: infrastructure.length },
    fixed: fixed.map(classify), places: places.map(classify), infrastructure: infrastructure.map(classify),
    conflicts: all.filter(crosses),
    coordinateState: ['player street position', 'owned-home cell and entrance', 'parked cars', 'owned and hired boats', 'owned aircraft', 'graffiti', 'map waypoint'],
    identityState: ['inventory and closet', 'home decor and fridge', 'workshop equipment, upgrades and production', 'courier route IDs and records', 'supplier and buyer history'],
    seamDependencies: ['east/west road connections', 'bridges across old north/south seam', 'elevated train loop', 'boat patrol bands', 'spatial buckets', 'renderer and camera nearest-copy distances'],
  };
}
