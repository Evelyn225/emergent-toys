// ===== your save: money, tickets, what you carry, your storage unit and closet, and what you own (homes, and where
// your cars and boats are), kept in localStorage every few seconds and when you leave. Not saved: where you are, the
// time, the police (you start each visit clean, on the street).
const SAVE_KEY = 'ascii-city-save';
function saveGame() {
  const items = list => list.map(it => ({ id: it.id, uses: it.uses }));
  const data = { v: 1, day: dayNum, tags, money, tickets, held, inv: items(inv), stored: items(stored), closet: items(closet),
    shares, market: { prices: STOCKS.map(s => [s.sym, s.price, s.open, s.hist]), lastMin: MARKET.lastMin },
    homes: owned.homes, cars: owned.cars.map(c => ({ model: c.model, x: c.x, y: c.y, hx: c.hx, hy: c.hy })), boats: savedBoats() };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private window: just not kept */ }
}
function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return; }
  if (!d || d.v !== 1) return;
  const items = (list, into) => { into.length = 0; for (const it of list || []) if (ITEMS[it.id]) into.push({ id: it.id, uses: it.uses }); };
  money = d.money ?? money; tickets = d.tickets || 0; if (d.day !== undefined) dayNum = d.day;
  tags.length = 0; for (const t of d.tags || []) tags.push(t); reindexTags();
  items(d.inv, inv); items(d.stored, stored); items(d.closet, closet);
  held = clamp(d.held ?? -1, -1, inv.length - 1);
  for (const sym in d.shares || {}) if (stockBy(sym)) shares[sym] = d.shares[sym];
  if (d.market) { for (const [sym, p, o, h] of d.market.prices || []) { const s = stockBy(sym); if (s) { s.price = p; s.open = o; if (h && h.length) s.hist = h.slice(-48); } } MARKET.lastMin = d.market.lastMin ?? null; }
  owned.homes.length = 0; for (const h of d.homes || []) if (SHOP[h.cell] && ITEMS[h.kind]) owned.homes.push(h);
  for (const c of d.cars || []) if (CAR_MODELS[c.model]) spawnOwnedCar(c.model, c.x, c.y, c.hx, c.hy, true);
  loadBoats(d.boats);
}
function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ } location.reload(); }
loadGame();
setInterval(saveGame, 10000);
addEventListener('pagehide', saveGame);
