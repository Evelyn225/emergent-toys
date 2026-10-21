// ===== your save: money, tickets, what you carry, your storage unit and closet, and what you own (homes, and where
// your cars and boats are), how hungry, thirsty and hurt you are, the city time, and the last spot you stood on the
// street, kept in localStorage every few seconds and when you leave. Not saved: the police (you start each visit clean).
const SAVE_KEY = 'ascii-city-save';
let SAVE_BACKUP_KEY = worldReady ? 'ascii-city-save-backup-v2-coastal-v1' : 'ascii-city-save-backup-v1-coastal-v1';
let citySaveBlocked = false; // protect an unrecognized save or one whose backup could not be written
let citySaveBackupPending = null;
function keepCitySaveBackup(text) {
  try {
    if (localStorage.getItem(SAVE_BACKUP_KEY) == null) localStorage.setItem(SAVE_BACKUP_KEY, text);
    return localStorage.getItem(SAVE_BACKUP_KEY) != null;
  } catch (e) { return false; }
}
let streetSpot = null; // where you last were on foot outdoors (inside a shop or on a train, you come back out where you went in)
function noteStreet() {
  if (mode === 'walk') streetSpot = { x: px, y: py, a };
  else if(mode==='room'&&homeRecord(room)&&room.ret)streetSpot={x:room.ret[0],y:room.ret[1],a:room.ret[2]||0};
  else if (mode === 'drive' && me) streetSpot = { x: me.x, y: me.y, a: Math.atan2(me.hy, me.hx) };
}
function saveCityJourney() {
  if(mode==='sea'&&sea&&(sea.hired||sea.deal==='mine'))return {kind:'boat',id:sea.id};
  if(mode==='air'&&pilot?.owned&&!pilot.wrecked&&!pilot.ditched)return {kind:'aircraft',id:pilot.id};
  return null;
}
function saveGame() {
  if (citySaveBackupPending != null && keepCitySaveBackup(citySaveBackupPending)) {
    citySaveBackupPending = null; citySaveBlocked = false;
  }
  if (citySaveBlocked) return false;
  noteStreet();
  const items = list => list.map(it => ({ id: it.id, uses: it.uses, ...(it.kg ? { kg: it.kg } : {}), ...(it.q ? { q: it.q } : {}), ...(it.of ? { of: it.of } : {}) })); // (a catch's weight; a dish's quality, and the fish in it)
  const data = { v: CITY_SAVE_VERSION, world: { layout: CITY_LAYOUT_ID }, day: dayNum, tod, tags, money, tickets, fish: fishLog, held, quickSlots: [...quickSlots], inv: items(inv), stored: items(stored), closet: items(closet), tattoos: [...tattoos],
    noto: { level: noto.level, day: noto.day, looked: noto.looked, lookDay: noto.lookDay, log: noto.log },
    shares, market: { prices: STOCKS.map(s => [s.sym, s.price, s.open, s.hist]), lastMin: MARKET.lastMin },
    courier: { job: courierJob, records: courierRecords },
    drugContacts,
    waypoint:mapWaypoint,
    journey:saveCityJourney(),
    homes: savedCityHomes(), cars: owned.cars.map(c => ({ model: c.model, x: c.x, y: c.y, hx: c.hx, hy: c.hy, body: c.body, dmg: c.dmg || 0, wrecked: !!c.wrecked })), boats: savedBoats(), at: streetSpot, season: seasonShift, seasonDays: SEASON_DAYS, stolen: museumStolen, hotelStolen: grandHotelStolen, needs: { food: needs.food, drink: needs.drink, health: needs.health, bladder: needs.bladder, fit: needs.fit, trained: needs.trained }, boxRank, planes: savedPlanes() };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
function loadGame() {
  cancelTransitAnnouncements();
  let text, prepared;
  citySaveBackupPending = null;
  try {
    text = localStorage.getItem(SAVE_KEY);
    if (text == null) return;
    prepared = prepareCitySave(JSON.parse(text));
    if (prepared && !prepared.upgraded) for (const key of ['ascii-city-save-backup-v3-archipelago-v1','ascii-city-save-backup-v4-archipelago-v2']) {
      if (localStorage.getItem(key) != null) SAVE_BACKUP_KEY = key;
    }
  } catch (e) { citySaveBlocked = true; return; }
  if (!prepared) { citySaveBlocked = true; return; }
  if (prepared.backupKey) SAVE_BACKUP_KEY = prepared.backupKey;
  citySaveBlocked = true;
  // Still load progress if storage is full, but retry the backup before allowing any overwrite.
  if (prepared.upgraded && !keepCitySaveBackup(text)) citySaveBackupPending = text;
  const d = prepared.data;
  const items = (list, into, limit = Infinity) => { into.length = 0; for (const it of list || []) { if (into.length >= limit) break; if (ITEMS[it.id]) into.push({ id: it.id, uses: it.uses, ...(Number.isFinite(it.kg) ? { kg: it.kg } : {}), ...(DISH_EAT[it.q] ? { q: it.q } : {}), ...(ITEMS[it.of] ? { of: it.of } : {}) }); } };
  money = d.money ?? money; tickets = d.tickets || 0; if (d.day !== undefined) dayNum = d.day;
  if (Number.isFinite(d.tod) && d.tod >= 0 && d.tod < 24) tod = d.tod;
  tags.length = 0; for (const t of d.tags || []) tags.push(t); reindexTags();
  fishLog.caught = d.fish?.caught | 0; fishLog.best = d.fish?.best && ITEMS[d.fish.best.id] && Number.isFinite(d.fish.best.kg) ? { id: d.fish.best.id, kg: d.fish.best.kg } : null;
  items(d.inv, inv, INV_SIZE); items(d.stored, stored); items(d.closet, closet);
  tattoos.length = 0; for (const id of d.tattoos || []) if (ITEMS[id] && ITEMS[id].kind === 'tattoo' && !tattoos.includes(id)) tattoos.push(id);
  if (d.noto) { // how well known you are, and what's in the papers
    noto.level = clamp(+d.noto.level || 0, 0, 100); noto.day = Number.isInteger(d.noto.day) ? d.noto.day : dayNum; noto.lookDay = d.noto.lookDay ?? -9;
    noto.looked = d.noto.looked && typeof d.noto.looked === 'object' ? { ...d.noto.looked } : {};
    noto.log = (Array.isArray(d.noto.log) ? d.noto.log : []).filter(e => e && typeof e.kind === 'string' && Number.isInteger(e.day)).slice(0, 40);
  } else noto.day = dayNum;
  quickSlots.fill(-1);
  if (Array.isArray(d.quickSlots)) {
    for (let s = 0; s < QUICK_SLOTS; s++) { const k = d.quickSlots[s]; if (Number.isInteger(k) && k >= 0 && k < inv.length && !quickSlots.includes(k)) quickSlots[s] = k; }
  } else for (let s = 0; s < Math.min(QUICK_SLOTS, inv.length); s++) quickSlots[s] = s;
  held = clamp(d.held ?? -1, -1, inv.length - 1);
  for (const sym in d.shares || {}) if (stockBy(sym)) shares[sym] = d.shares[sym];
  if (d.market) { for (const [sym, p, o, h] of d.market.prices || []) { const s = stockBy(sym); if (s) { s.price = p; s.open = o; if (h && h.length) s.hist = h.slice(-48); } } MARKET.lastMin = d.market.lastMin ?? null; }
  owned.homes.length = 0; for (const h of d.homes || []) {
    const cell = restoreHomeCell(h.cell, h.placeId);
    if (cell < 0 || ITEMS[h.kind]?.kind !== 'home') continue;
    owned.homes.push({ ...h, cell,
    decor: (Array.isArray(h.decor) ? h.decor : []).filter(isHomeDecor).slice(0, HOME_SHELF_CAPACITY),
    fridge: (Array.isArray(h.fridge) ? h.fridge : []).filter(isFridgeItem).slice(0, STORE_SIZE),
    workshop: restoreWorkshop(h.workshop,h.kind),
    door: Array.isArray(h.door) && h.door.length === 2 && h.door.every(Number.isFinite) ? h.door.map(v => worldCoord(v)) : null,
    pets: (Array.isArray(h.pets) ? h.pets : h.pet ? [h.pet] : []).filter(p => p === 'petcat' || p === 'petdog').filter((p, i, all) => all.indexOf(p) === i) });
  }
  for (const c of d.cars || []) if (CAR_MODELS[c.model]) {
    const o = spawnOwnedCar(c.model, c.x, c.y, c.hx, c.hy, true);
    if (Number.isInteger(c.body)) o.body = c.body; // (resprayed)
    if (c.wrecked) { o.dmg = DMG_FIRE; o.wrecked = true; } else if (c.dmg > 0) o.dmg = clamp(c.dmg, 0, DMG_FIRE - 1); // (a fire's out by the time you're back)
  }
  ensureCarKeys();
  loadBoats(d.boats);
  loadPlanes(d.planes);
  loadCourier(d.courier);
  loadDrugContacts(d.drugContacts);
  loadMapWaypoint(d.waypoint);
  if (Number.isFinite(d.season)) seasonShift = mod(d.season + Math.floor(dayNum / (d.seasonDays > 0 ? d.seasonDays : 7)) - Math.floor(dayNum / SEASON_DAYS), 4);
  grandHotelStolen = {};
  if (d.hotelStolen === true) grandHotelStolen.hotelmasterpiece = true; // Older saves only had the Duke.
  else if (d.hotelStolen && typeof d.hotelStolen === 'object')
    for (const p of HOTEL_PAINTINGS) if (d.hotelStolen[p.id] === true) grandHotelStolen[p.id] = true;
  if (d.stolen && typeof d.stolen === 'object') museumStolen = { diamond: !!d.stolen.diamond, orrery: !!d.stolen.orrery };
  if (d.needs && isFinite(d.needs.fit)) needs.fit = clamp(d.needs.fit | 0, 0, FIT_MAX); // (before health: it sets the most you can have)
  if (d.needs && isFinite(d.needs.trained)) needs.trained = d.needs.trained;
  if (d.needs) for (const k of ['food', 'drink', 'health', 'bladder']) if (isFinite(d.needs[k])) needs[k] = clamp(d.needs[k], k === 'health' ? 1 : 0, k === 'health' ? maxHealth() : 100);
  if (isFinite(d.boxRank)) boxRank = clamp(d.boxRank | 0, 0, BOXERS.length);
  const at = d.at;
  if (at && isFinite(at.x) && isFinite(at.y) && !map[idx(Math.floor(at.x), Math.floor(at.y))] && !isWater(at.x, at.y)) {
    px = worldCoord(at.x); py = worldCoord(at.y); a = at.a || 0; streetSpot = { x: px, y: py, a };
  }
  if(d.journey?.kind==='boat') {
    const boat=fleet.find(b=>b.id===d.journey.id&&(b.hired||b.deal==='mine'));
    if(boat&&waterClear(boat,boat.x,boat.y,boat.hx,boat.hy))boardBoat(boat);
  } else if(d.journey?.kind==='aircraft') {
    const craft=aircraft.find(c=>c.id===d.journey.id&&c.owned&&!c.wrecked&&!c.ditched);
    if(craft){pilot=craft;mode='air';craft.state='flown';px=craft.x;py=craft.y;airCamYaw=craft.yaw;}
  }
  citySaveBlocked = citySaveBackupPending != null;
}
function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ } location.reload(); }
loadGame();
setInterval(saveGame, 10000);
addEventListener('pagehide', saveGame);
