// Pure schema upgrade. Terrain relocation gets its own explicit layout migration later;
// never load an unknown layout's raw cells into this one.
const CITY_SAVE_VERSION = 2;
function prepareCitySave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  for (const key of ['homes', 'cars', 'boats', 'planes', 'inv', 'stored', 'closet', 'tags', 'tattoos'])
    if (raw[key] != null && !Array.isArray(raw[key])) return null;
  for (const key of ['homes', 'cars', 'boats', 'planes'])
    if (raw[key]?.some(value => !value || typeof value !== 'object' || Array.isArray(value))) return null;
  if (raw.v === CITY_SAVE_VERSION) {
    if (raw.world?.layout !== CITY_LAYOUT_ID) return null;
    return { data: raw, upgraded: false };
  }
  if (raw.v !== 1) return null;
  const data = JSON.parse(JSON.stringify(raw));
  data.v = CITY_SAVE_VERSION;
  data.world = { layout: CITY_LAYOUT_ID };
  if (Array.isArray(data.homes)) for (const home of data.homes) {
    const place = cityPlaceAtCell(home?.cell);
    if (place) home.placeId = place.id;
  }
  if (data.waypoint && typeof data.waypoint.id === 'string') data.waypoint.id = cityWaypointId(data.waypoint.id);
  return { data, upgraded: true };
}
function savedCityHomes() {
  return owned.homes.map(home => ({ ...home, placeId: cityPlaceAtCell(home.cell)?.id || home.placeId }));
}
