// ===== owning things: a car from a CAR LOT, a home from a REALTY office. Pure (no DOM), so the node tests can buy
// them; save.js keeps them (and your money and things) in localStorage between visits.
// A car you own is a car in `cars` flagged `owned`: always parked where you left it (never handed back to the
// traffic), yours to get into without it being a crime, faster or slower depending on the model.
const CAR_MODELS = {
  car_hatch: { body: GREEN, top: 2.0, boost: 2.9 }, car_sedan: { body: BLUE, top: 2.3, boost: 3.3 }, car_sports: { body: RED, top: 2.8, boost: 4.2 },
};
// a home is the apartment building on a lot (any cell of it: they share one SHOP), and how big a place you bought
ITEMS.home_island = { name: 'Fern Island house', price: 6800, kind: 'home' };
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
  const X = Math.round((x - 1) / 8) * 8 + 1, Y = Math.round((y - 1) / 8) * 8 + 1, bx = worldBlock(Math.floor(x / 8)), by = worldBlock(Math.floor(y / 8));
  const vOK = vseg(worldBlock(Math.round((x - 1) / 8)), by), hOK = hseg(bx, worldBlock(Math.round((y - 1) / 8)));
  const useV = vOK && (!hOK || Math.abs(rel(x - X)) < Math.abs(rel(y - Y)));
  if (useV) { const dir = Math.sign(rel(x - X)) || 1; return { x: worldCoord(X + 0.4 * dir), y, hx: 0, hy: dir }; }
  const dir = -(Math.sign(rel(y - Y)) || 1); return { x, y: worldCoord(Y - 0.4 * dir), hx: dir, hy: 0 };
}
// a car of yours, parked at (x, y) facing (hx, hy) (exactly there, or pulled in to the kerb)
function spawnOwnedCar(model, x, y, hx, hy, exact = false) {
  const m = CAR_MODELS[model], c = addCar({ x, y, hx, hy, body: m.body, owned: true, model, top: m.top, boost: m.boost, mine: true });
  if (!exact) parkCar(c); else { c.ex = c.x; c.ey = c.y; c.parked = true; }
  owned.cars.push(c);
  return c;
}
// car keys: a set with every car you buy. Q with them in your hand and the car comes round to you, pulled in at the
// kerb nearest where you're standing (the nearest of them, if you've bought more than one of a model)
function giveCarKeys(model) { // into your hands, or if they're full, your storage unit
  const k = { id: 'key_' + model, uses: 0 };
  if (inv.length < INV_SIZE) { carryItem(k, false); return 'Here are the keys (hold them, Q: it comes to you).'; }
  stored.push(k); return 'Your bag is full: the keys are in your storage unit.';
}
function ensureCarKeys() { // (a save from before there were keys: you get a set for each car you own)
  for (const m of new Set(owned.cars.map(c => c.model))) if (![...inv, ...stored, ...closet].some(it => it.id === 'key_' + m)) giveCarKeys(m);
}
function summonCar(model) {
  const name = ITEMS[model].name, mine = owned.cars.filter(c => c.model === model && !c.player), dist = c => Math.hypot(rel(c.x - px), rel(c.y - py));
  if (!mine.length) return [`You press the fob. Nothing. Wherever your ${name} is, it isn't listening.`, 'click'];
  if (mode !== 'walk') return [mode === 'room' ? 'No signal in here. Try it out on the street.' : 'Not from up here. Try it down on the street.', null];
  const here = mine.find(c => dist(c) < 2 && !c.wrecked && c.fireT == null); // (a wreck, even right here, goes to the garage)
  if (here) { here.fobBlinkAt = T; return [`Your ${name}'s right here. Its lights blink at you.`, 'click']; }
  const c = mine.reduce((b, c) => dist(c) < dist(b) ? c : b), l = laneNear(px, py);
  if(worldReady&&!ROAD[idx(Math.floor(l.x),Math.floor(l.y))])return ['No road nearby. Try the fob from a street.','click'];
  let towed = '';
  if (c.wrecked || c.fireT != null) { // a burnt-out shell: the garage tows it in and puts it right, for a price
    if (!pay(TOW_FEE)) return [`Your ${name}'s a wreck. The garage wants ${fmt$(TOW_FEE)} to tow it in and fix it, and you're short.`, 'click'];
    repairCar(c); towed = ` The garage towed what was left of it and put it right (${fmt$(TOW_FEE)}).`;
  }
  for (const s of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4]) { // along the kerb to a gap between parked cars
    c.x = worldCoord(l.x + l.hx * s); c.y = worldCoord(l.y + l.hy * s); c.hx = l.hx; c.hy = l.hy; c.v = 0; parkCar(c);
    if (!cars.some(o => o !== c && Math.hypot(rel(o.ex - c.x), rel(o.ey - c.y)) < 0.5)) break;
  }
  return [`You press the fob. A minute later your ${name} rolls up at the kerb, lights blinking.${towed}`, 'click'];
}
// the nearest apartment building to (x, y) that isn't yours already, within a few blocks: its cell index
const homeRoomKind = kind => kind === 'home_island' ? 'islandhome' : kind === 'home_belle' ? 'bellehome' : kind === 'home_loft' ? 'loft' : 'home';
function homeBalconyBounds(home) {
  const b = home?.kind === 'home_belle' && SHOP[home.cell]?.belle;
  if (!b) return null;
  const y = (b.y0 + b.y1) / 2;
  return { x0: b.x1, x1: b.x1 + .6, y0: y - .7, y1: y + .7, y, doorY: y + .2, z: Math.min(2,Math.max(.3,b.h - .4)) };
}
function homeBalconyHeight(x, y) {
  let height = 0;
  for (const home of owned.homes) {
    const b = homeBalconyBounds(home);
    if (b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) height = Math.max(height,b.z);
  }
  return height;
}
function restoreHomeCell(cell, placeId = null) {
  if (placeId != null) {
    cell = cityPlaceCell(placeId, cell);
    if (cell < 0 || homeAt(SHOP[cell])) return -1;
  }
  if (!Number.isInteger(cell) || cell < 0 || cell >= N * N) return -1;
  const x = cell % N, y = Math.floor(cell / N);
  if (SHOP[cell] && map[cell] && (SHOP[cell].kind === SHOP_APTS || districtAt(x, y) === 'belle')) return cell;
  // A building since redeveloped (the courier routes turned some apartment blocks into a building site and shops): the nearest free flat.
  if (districtAt(x, y) !== 'belle') return freeHomeNear(x + 0.5, y + 0.5);
  let best = -1, distance = Infinity;
  for (let my = Math.floor(y / 8) * 8; my < Math.floor(y / 8) * 8 + 8; my++) for (let mx = Math.floor(x / 8) * 8; mx < Math.floor(x / 8) * 8 + 8; mx++) {
    const k = idx(mx, my), d = Math.hypot(mx - x, my - y);
    if (map[k] && STY[k] === 24 && SHOP[k] && !homeAt(SHOP[k]) && d < distance) { best = k; distance = d; }
  }
  return best;
}
function freeHomeNear(x, y, district = null) {
  let best = -1, bd = district ? N : 30;
  const range = district ? N / 2 : 24;
  for (let dy = -range; dy < range + (district ? 0 : 1); dy++) for (let dx = -range; dx < range + (district ? 0 : 1); dx++) {
    const i = idx(worldCoord(Math.floor(x) + dx), worldCoord(Math.floor(y) + dy)), sh = SHOP[i];
    if (!sh || sh.kind !== SHOP_APTS || !map[i] || homeAt(sh) || district && districtAt(i % N, Math.floor(i / N)) !== district) continue;
    if (district === 'belle') {
      const b = sh.belle;
      if (!b) continue;
      let clear = true;
      for (let row = b.y0; row < b.y1; row++) if (map[idx(b.x1, row)]) { clear = false; break; }
      if (!clear) continue; // the residence's balcony needs a street-facing exterior wall
    }
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
    return [true, `You buy ${aOrSome(it.name)}. It's parked out front (C on your map). ${giveCarKeys(id)}`];
  }
  const cell = id === 'home_island' ? cityPlaceCell('fern-house') : freeHomeNear(x, y, id === 'home_belle' ? 'belle' : null);
  if (id === 'home_island' && (cell < 0 || homeAt(SHOP[cell]))) return [false, 'Fern House is already owned.'];
  if (cell < 0) return [false, '"Nothing on the market round here right now."'];
  if (!pay(it.price)) return [false, `${cap(it.name)} is ${fmt$(it.price)}. You can't afford it.`];
  owned.homes.push({ cell, kind: id, decor: [], fridge: [], pet: null });
  return [true, `You buy ${aOrSome(it.name)} at ${SHOP[cell].word}. Your keys. (H on your map)`];
}
