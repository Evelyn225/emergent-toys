// ===== car damage (any car: yours, a stolen one, the traffic, a cruiser). Every crash harder than a bump takes
// something out of a car, both of them when it's two: at a quarter it's dented and scraped, at half the windscreen
// cracks and the engine smokes, at three quarters it's black smoke and down on power, and at the top it catches fire.
// Get out: a few seconds later it goes up, and what's left is a burnt-out shell that goes nowhere. The city tows the
// traffic's wrecks once you're well away; yours waits for the garage (the key fob, property.js). A respray at an
// AUTO REPAIR (crime.js) puts any car right. On screen: city-sprites.js (dents, cracks, flames, the shell) and
// damage-fx.js (smoke, the bang, the dashboard).
const DMG_DENTS = 25, DMG_SMOKE = 50, DMG_BAD = 75, DMG_FIRE = 100, BURN_T = 6, TOW_FEE = 200;
const crashDamage = speed => Math.max(0, (speed - 0.6) * 22); // 1 (36 km/h): 9; flat out (79): 35; boosting: 57
function damageCar(c, n) {
  if (!c || c.wrecked || !(n > 0)) return;
  c.dmg = Math.min(DMG_FIRE, (c.dmg || 0) + n);
  if (c.dmg >= DMG_FIRE && c.fireT == null) c.fireT = 0; // alight
  if (c.fireT != null && !c.player && !c.parked) { c.parked = true; c.v = 0; c.ex = c.x; c.ey = c.y; c.pursuit = false; c.bail = true; } // (whoever's driving it stops and gets out)
}
const carPower = c => !c || !c.dmg ? 1 : c.dmg >= DMG_BAD ? 0.7 : c.dmg >= DMG_SMOKE ? 0.9 : 1; // the share of its top speed it can still make
const burning = c => c.fireT != null && !c.wrecked;
// every frame: fires burn down to the bang; returns the cars that have just gone up
function stepCarFires(dt) {
  const out = [];
  for (const c of cars) if (burning(c) && (c.fireT += dt) >= BURN_T) { c.wrecked = true; c.v = 0; c.boomT = T; out.push(c); }
  return out;
}
function repairCar(c) { c.dmg = 0; c.fireT = null; c.wrecked = false; c.boomT = undefined; }
