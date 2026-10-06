// ===== your save: money, tickets, what you carry, your storage unit and closet, and what you own (homes, and where
// your cars and boats are), how hungry, thirsty and hurt you are, the city time, and the last spot you stood on the
// street, kept in localStorage every few seconds and when you leave. Not saved: the police (you start each visit clean).
const SAVE_KEY = 'ascii-city-save';
let streetSpot = null; // where you last were on foot outdoors (inside a shop or on a train, you come back out where you went in)
function noteStreet() {
  if (mode === 'walk') streetSpot = { x: px, y: py, a };
  else if (mode === 'drive' && me) streetSpot = { x: me.x, y: me.y, a: Math.atan2(me.hy, me.hx) };
}
function saveGame() {
  noteStreet();
  const items = list => list.map(it => ({ id: it.id, uses: it.uses }));
  const data = { v: 1, day: dayNum, tod, tags, money, tickets, held, quickSlots: [...quickSlots], inv: items(inv), stored: items(stored), closet: items(closet),
    shares, market: { prices: STOCKS.map(s => [s.sym, s.price, s.open, s.hist]), lastMin: MARKET.lastMin },
    homes: owned.homes, cars: owned.cars.map(c => ({ model: c.model, x: c.x, y: c.y, hx: c.hx, hy: c.hy })), boats: savedBoats(), at: streetSpot, season: seasonShift, seasonDays: SEASON_DAYS, stolen: museumStolen, hotelStolen: grandHotelStolen, needs: { food: needs.food, drink: needs.drink, health: needs.health, bladder: needs.bladder } };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private window: just not kept */ }
}
function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return; }
  if (!d || d.v !== 1) return;
  const items = (list, into, limit = Infinity) => { into.length = 0; for (const it of list || []) { if (into.length >= limit) break; if (ITEMS[it.id]) into.push({ id: it.id, uses: it.uses }); } };
  money = d.money ?? money; tickets = d.tickets || 0; if (d.day !== undefined) dayNum = d.day;
  if (Number.isFinite(d.tod) && d.tod >= 0 && d.tod < 24) tod = d.tod;
  tags.length = 0; for (const t of d.tags || []) tags.push(t); reindexTags();
  items(d.inv, inv, INV_SIZE); items(d.stored, stored); items(d.closet, closet);
  quickSlots.fill(-1);
  if (Array.isArray(d.quickSlots)) {
    for (let s = 0; s < QUICK_SLOTS; s++) { const k = d.quickSlots[s]; if (Number.isInteger(k) && k >= 0 && k < inv.length && !quickSlots.includes(k)) quickSlots[s] = k; }
  } else for (let s = 0; s < Math.min(QUICK_SLOTS, inv.length); s++) quickSlots[s] = s;
  held = clamp(d.held ?? -1, -1, inv.length - 1);
  for (const sym in d.shares || {}) if (stockBy(sym)) shares[sym] = d.shares[sym];
  if (d.market) { for (const [sym, p, o, h] of d.market.prices || []) { const s = stockBy(sym); if (s) { s.price = p; s.open = o; if (h && h.length) s.hist = h.slice(-48); } } MARKET.lastMin = d.market.lastMin ?? null; }
  owned.homes.length = 0; for (const h of d.homes || []) if (SHOP[h.cell] && ITEMS[h.kind]) owned.homes.push({ ...h,
    decor: (Array.isArray(h.decor) ? h.decor : []).filter(isHomeDecor).slice(0, HOME_SHELF_CAPACITY),
    fridge: (Array.isArray(h.fridge) ? h.fridge : []).filter(isFridgeItem).slice(0, STORE_SIZE),
    pets: (Array.isArray(h.pets) ? h.pets : h.pet ? [h.pet] : []).filter(p => p === 'petcat' || p === 'petdog').filter((p, i, all) => all.indexOf(p) === i) });
  for (const c of d.cars || []) if (CAR_MODELS[c.model]) spawnOwnedCar(c.model, c.x, c.y, c.hx, c.hy, true);
  ensureCarKeys();
  loadBoats(d.boats);
  if (Number.isFinite(d.season)) seasonShift = mod(d.season + Math.floor(dayNum / (d.seasonDays > 0 ? d.seasonDays : 7)) - Math.floor(dayNum / SEASON_DAYS), 4);
  grandHotelStolen = !!d.hotelStolen;
  if (d.stolen && typeof d.stolen === 'object') museumStolen = { diamond: !!d.stolen.diamond, orrery: !!d.stolen.orrery };
  if (d.needs) for (const k of ['food', 'drink', 'health', 'bladder']) if (isFinite(d.needs[k])) needs[k] = clamp(d.needs[k], k === 'health' ? 1 : 0, 100);
  const at = d.at;
  if (at && isFinite(at.x) && isFinite(at.y) && !map[idx(Math.floor(at.x), Math.floor(at.y))] && !isWater(at.x, at.y)) {
    px = mod(at.x, N); py = mod(at.y, N); a = at.a || 0; streetSpot = { x: px, y: py, a };
  }
}
function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ } location.reload(); }
loadGame();
setInterval(saveGame, 10000);
addEventListener('pagehide', saveGame);
