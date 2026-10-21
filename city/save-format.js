// Pure save preparation for source construction and the live layout. Bootstrap sets
// the live schema before save loading; never interpret unknown raw cells here.
let CITY_SAVE_VERSION = 2;
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
  const previousIslands = worldReady && raw.v === 3 && raw.world?.layout === 'archipelago-v1';
  const previousContours = worldReady && raw.v === 4 && raw.world?.layout === 'archipelago-v2';
  if (raw.v !== 1 && !(worldReady && raw.v === 2 && raw.world?.layout === 'coastal-v1') && !previousIslands && !previousContours) return null;
  const data = JSON.parse(JSON.stringify(raw));
  data.v = CITY_SAVE_VERSION;
  data.world = { layout: CITY_LAYOUT_ID };
  if(worldReady) {
    if (previousContours) migrateIslandStride(data);
    else if (previousIslands) migrateIslandContours(data);
    else migrateCoastalSave(data);
    return {data,upgraded:true,backupKey:previousContours?'ascii-city-save-backup-v4-archipelago-v2':previousIslands?'ascii-city-save-backup-v3-archipelago-v1':'ascii-city-save-backup-v2-coastal-v1'};
  }
  if (Array.isArray(data.homes)) for (const home of data.homes) {
    const place = cityPlaceAtCell(home?.cell);
    if (place) home.placeId = place.id;
  }
  if (data.waypoint && typeof data.waypoint.id === 'string') data.waypoint.id = cityWaypointId(data.waypoint.id);
  return { data, upgraded: true };
}

function migrateCoastalSave(data) {
  const legacyPlaces=new Map();
  for(const place of CITY_PLACES.values())for(const cell of place.legacyCells)legacyPlaces.set(cell,place);
  function position(o) {
    if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))return;
    const airport=o.x>=10&&o.x<=70&&o.y>=212&&o.y<=237;
    [o.x,o.y]=citySourcePoint(o.x,o.y,airport?'airport':'city');
  }
  if(data.at&&Math.abs(data.at.x-40)<1&&data.at.y>202&&data.at.y<217) {
    data.at.x=CAUSEWAY.x;data.at.y=CAUSEWAY.y1-.5;
  } else position(data.at);
  for(const home of data.homes||[]) {
    const place=CITY_PLACES.get(home.placeId)||legacyPlaces.get(home.cell);
    if(place){home.placeId=place.id;home.cell=place.legacyCells.includes(home.cell)?citySourceCell(home.cell):place.cell;}
    if(Array.isArray(home.door)&&home.door.length===2)home.door=citySourcePoint(...home.door);
  }
  for(const key of ['cars','boats','planes'])for(const o of data[key]||[])position(o);
  for(const tag of data.tags||[]) {
    if(!Number.isInteger(tag.cell))continue;
    const x=tag.cell%CITY_SOURCE_N,y=Math.floor(tag.cell/CITY_SOURCE_N);
    const [targetX,targetY]=citySourcePoint(x,y);
    tag.cell=citySourceCell(tag.cell);
    if(Number.isFinite(tag.u))tag.u+=tag.face==='N'||tag.face==='S'?targetX-x:targetY-y;
  }
  if(data.waypoint) {
    const match=/^home:(\d+)$/.exec(data.waypoint.id||'');
    if(match){const place=legacyPlaces.get(Number(match[1]));if(place)data.waypoint.id=`home:${place.id}`;}
    position(data.waypoint);
  }
}
function migrateIslandContours(data) {
  function position(o) {
    if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) [o.x, o.y] = cityPreviousPoint(o.x, o.y);
  }
  position(data.at);
  for (const home of data.homes || []) {
    if (Number.isInteger(home.cell)) {
      const [x,y] = cityPreviousPoint(home.cell % 512, Math.floor(home.cell / 512));
      home.cell = Math.floor(y) * CITY_LAYOUT.width + Math.floor(x);
    }
    if (Array.isArray(home.door) && home.door.length === 2) home.door = cityPreviousPoint(...home.door);
  }
  for (const key of ['cars','boats','planes']) for (const o of data[key] || []) position(o);
  for (const tag of data.tags || []) {
    if (!Number.isInteger(tag.cell)) continue;
    const x = tag.cell % 512, y = Math.floor(tag.cell / 512);
    const [targetX,targetY] = cityPreviousPoint(x,y);
    tag.cell = Math.floor(targetY) * CITY_LAYOUT.width + Math.floor(targetX);
    if (Number.isFinite(tag.u)) tag.u += tag.face === 'N' || tag.face === 'S' ? targetX-x : targetY-y;
  }
  position(data.waypoint);
}
function migrateIslandStride(data) {
  const cell = k => Math.floor(k / 512) * CITY_LAYOUT.width + k % 512;
  for (const home of data.homes || []) if (Number.isInteger(home.cell)) home.cell = cell(home.cell);
  for (const tag of data.tags || []) if (Number.isInteger(tag.cell)) tag.cell = cell(tag.cell);
  const match = /^home:(\d+)$/.exec(data.waypoint?.id || '');
  if (match) data.waypoint.id = cityHomeId({cell: cell(Number(match[1]))});
}
function savedCityHomes() {
  return owned.homes.map(home => ({ ...home, placeId: cityPlaceAtCell(home.cell)?.id || home.placeId }));
}
