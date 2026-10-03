// ===== owning things: a car from a CAR LOT, a home from a REALTY office. Pure (no DOM), so the node tests can buy
// them; save.js keeps them (and your money and things) in localStorage between visits.
// A car you own is a car in `cars` flagged `owned`: always parked where you left it (never handed back to the
// traffic), yours to get into without it being a crime, faster or slower depending on the model.
const CAR_MODELS = {
  car_hatch: { body: GREEN, top: 2.0, boost: 2.9 }, car_sedan: { body: BLUE, top: 2.3, boost: 3.3 }, car_sports: { body: RED, top: 2.8, boost: 4.2 },
};
// a home is the apartment building on a lot (any cell of it: they share one SHOP), and how big a place you bought
const owned = { cars: [], homes: [] }; // cars: the car objects; homes: { cell, kind }
const homeAt = sh => owned.homes.find(h => SHOP[h.cell] === sh) || null;

// a car you get out of stays where it is: pulled in to the kerb if it's on a street, nobody drives it away
function parkCar(c) {
  const r = ROAD[idx(Math.floor(c.x), Math.floor(c.y))];
  if (r === 1 || r === 2) { // square it up to the street and into the kerb lane on the side it's nearer
    const vert = r === 1, base = Math.floor((vert ? c.x : c.y) / 8) * 8 + 1, side = Math.sign((vert ? c.x : c.y) - base) || 1;
    if (vert) { c.x = base + side * 0.72; c.hx = 0; c.hy = c.hy >= 0 ? 1 : -1; } else { c.y = base + side * 0.72; c.hy = 0; c.hx = c.hx >= 0 ? 1 : -1; }
  }
  c.off = 0; c.ex = c.x; c.ey = c.y; c.parked = true;
}
// the street lane nearest (x, y), on the side of the street you're on: {x, y, hx, hy}
function laneNear(x, y) {
  const X = Math.round((x - 1) / 8) * 8 + 1, Y = Math.round((y - 1) / 8) * 8 + 1, bx = Math.floor(x / 8) & (NB - 1), by = Math.floor(y / 8) & (NB - 1);
  const vOK = vseg(Math.round((x - 1) / 8) & (NB - 1), by), hOK = hseg(bx, Math.round((y - 1) / 8) & (NB - 1));
  const useV = vOK && (!hOK || Math.abs(rel(x - X)) < Math.abs(rel(y - Y)));
  if (useV) { const dir = Math.sign(rel(x - X)) || 1; return { x: mod(X + 0.4 * dir, N), y, hx: 0, hy: dir }; }
  const dir = -(Math.sign(rel(y - Y)) || 1); return { x, y: mod(Y - 0.4 * dir, N), hx: dir, hy: 0 };
}
// a car of yours, parked at (x, y) facing (hx, hy) (exactly there, or pulled in to the kerb)
function spawnOwnedCar(model, x, y, hx, hy, exact = false) {
  const m = CAR_MODELS[model], c = addCar({ x, y, hx, hy, body: m.body, owned: true, model, top: m.top, boost: m.boost, mine: true });
  if (!exact) parkCar(c); else { c.ex = c.x; c.ey = c.y; c.parked = true; }
  owned.cars.push(c);
  return c;
}
// the nearest apartment building to (x, y) that isn't yours already, within a few blocks: its cell index
function freeHomeNear(x, y) {
  let best = -1, bd = 30;
  for (let dy = -24; dy <= 24; dy++) for (let dx = -24; dx <= 24; dx++) {
    const i = idx(mod(Math.floor(x) + dx, N), mod(Math.floor(y) + dy, N)), sh = SHOP[i];
    if (!sh || sh.kind !== SHOP_APTS || !map[i] || homeAt(sh)) continue;
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// buying a car or a home (from buy()): x, y = where you are (the shop's door)
function buyProperty(id, x, y) {
  const it = ITEMS[id];
  if (it.kind === 'car') {
    if (!pay(it.price)) return [false, `${cap(it.name)} is ${fmt$(it.price)}. You can't afford it.`];
    const l = laneNear(x, y); spawnOwnedCar(id, l.x, l.y, l.hx, l.hy);
    return [true, `You buy ${aOrSome(it.name)}. It's parked out front (C on your map).`];
  }
  const cell = freeHomeNear(x, y);
  if (cell < 0) return [false, '"Nothing on the market round here right now."'];
  if (!pay(it.price)) return [false, `${cap(it.name)} is ${fmt$(it.price)}. You can't afford it.`];
  owned.homes.push({ cell, kind: id });
  return [true, `You buy ${aOrSome(it.name)} at ${SHOP[cell].word}. Your keys. (H on your map)`];
}
