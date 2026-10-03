// ===== your save: money, tickets, what you carry, your storage unit and closet, and what you own (homes, and where
// your cars are parked), kept in localStorage every few seconds and when you leave. Not saved: where you are, the
// time, the police (you start each visit clean, on the street).
const SAVE_KEY = 'ascii-city-save';
function saveGame() {
  const items = list => list.map(it => ({ id: it.id, uses: it.uses }));
  const data = { v: 1, day: dayNum, money, tickets, held, inv: items(inv), stored: items(stored), closet: items(closet),
    homes: owned.homes, cars: owned.cars.map(c => ({ model: c.model, x: c.x, y: c.y, hx: c.hx, hy: c.hy })) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private window: just not kept */ }
}
function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return; }
  if (!d || d.v !== 1) return;
  const items = (list, into) => { into.length = 0; for (const it of list || []) if (ITEMS[it.id]) into.push({ id: it.id, uses: it.uses }); };
  money = d.money ?? money; tickets = d.tickets || 0; if (d.day !== undefined) dayNum = d.day;
  items(d.inv, inv); items(d.stored, stored); items(d.closet, closet);
  held = clamp(d.held ?? -1, -1, inv.length - 1);
  owned.homes.length = 0; for (const h of d.homes || []) if (SHOP[h.cell] && ITEMS[h.kind]) owned.homes.push(h);
  for (const c of d.cars || []) if (CAR_MODELS[c.model]) spawnOwnedCar(c.model, c.x, c.y, c.hx, c.hy, true);
}
function newGame() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to clear */ } location.reload(); }
loadGame();
setInterval(saveGame, 10000);
addEventListener('pagehide', saveGame);
