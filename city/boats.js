// ===== boats of your own: at the marina (world.js lays out its jetty) you can rent one by the trip, buy one outright
// (it's yours, tied up wherever you leave it, and kept in the save), or hotwire somebody else's (boat theft). Out on
// the water it's mode 'sea': W throttle, Shift to cruise, S brake/astern, A/D the helm, E to step off beside land.
// Raised bridges have clearance below their decks, with solid supports. marina.js draws the boats and marina.
const BOAT_KINDS = { // hl, hw: half length and beam (cells: 10m), fb: how high the deck stands out of the water
  speedboat: { name: 'speedboat', hl: 0.26, hw: 0.085, fb: 0.045, price: 1500, rent: 30, top: 1.8, cruise: 4.8, acc: 1, turn: 1.7 },
  sailboat: { name: 'sailboat', hl: 0.4, hw: 0.12, fb: 0.05, price: 3000, rent: 50, top: 0.85, cruise: 1.4, acc: 0.3, turn: 1 },
  cruiser: { name: 'cabin cruiser', hl: 0.55, hw: 0.16, fb: 0.065, price: 6000, rent: 80, top: 1.25, cruise: 3.1, acc: 0.5, turn: 0.8 },
  tug: { name: 'tug', hl: 0.35, hw: 0.12, fb: 0.06 }, ferry: { name: 'ferry', hl: 0.8, hw: 0.2, fb: 0.06 }, // (only out in the bay)
};
BOAT_KINDS.sail = BOAT_KINDS.sailboat;
const MARINA_HOURS = [7, 21];
const marinaOpen = (t = tod) => t >= MARINA_HOURS[0] && t < MARINA_HOURS[1];
const BOAT_NAMES = ['Sea Biscuit', 'Reel Therapy', 'Knot Today', 'Nauti Buoy', 'Aqua Holic', 'Unsinkable II', 'Second Wind', 'Loan Shark',
  'Pier Pressure', 'Shore Thing', 'Bad Decision', 'Liquid Asset', 'Dock Holiday', 'Seas the Day', 'Ship Happens', 'Hull Raiser'];
// the slips: either side of each finger pier, west and east of the jetty, bows pointing out toward open water
const SLOTS = [];
for (const fy of MARINA.fingers) for (const side of [-1, 1]) for (const sx of [-1, 1]) SLOTS.push({ x: MARINA.x + sx * 1.9, y: fy + side * 0.38, hx: sx, hy: 0 });
const SLOT_PLAN = [['speedboat', 'rent', WHITE], ['sailboat', 'rent', BLUE], ['cruiser', 'rent', WHITE], ['speedboat', 'sale', RED],
  ['sailboat', 'sale', GREEN], ['cruiser', 'sale', BLUE], ['speedboat', 'private', YEL], ['cruiser', 'private', WHITE]];
// every boat tied up somewhere (or under you): { kind, deal: rent | sale | private | mine | stolen, x, y, hx, hy, col,
// name, v, slot, hired (a rental out on its trip) }
const fleet = SLOTS.map((s, k) => ({ kind: SLOT_PLAN[k][0], deal: SLOT_PLAN[k][1], col: SLOT_PLAN[k][2], x: s.x, y: s.y, hx: s.hx, hy: s.hy,
  id: `marina:${k}`, name: BOAT_NAMES[(k * 5 + 3) % BOAT_NAMES.length], v: 0, slot: k }));
let sea = null; // the boat you're at the helm of

// how far (x, y) is from boat b's hull (0 inside it)
function boatDist(b, x, y) {
  const k = BOAT_KINDS[b.kind], qx = rel(x - b.x), qy = rel(y - b.y), u = qx * b.hx + qy * b.hy, v = -qx * b.hy + qy * b.hx;
  return Math.hypot(Math.max(0, Math.abs(u) - k.hl), Math.max(0, Math.abs(v) - k.hw));
}
// the boat you're standing beside (the one you're facing, if there are two)
function nearBoat() {
  if (mode !== 'walk') return null;
  let best = null, bd = 0.45;
  for (const b of fleet) {
    const d = boatDist(b, px, py) - 0.12 * (Math.cos(a) * rel(b.x - px) + Math.sin(a) * rel(b.y - py)) / (Math.hypot(rel(b.x - px), rel(b.y - py)) || 1);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const nearOffice = () => mode === 'walk' && Math.abs(rel(px - MARINA.office.x)) < 0.8 && Math.abs(rel(py - MARINA.office.y)) < 0.6;
const boatTitle = b => `the ${BOAT_KINDS[b.kind].name} '${b.name}'`;
function marinaPrompt() {
  if (mode === 'sea') {
    const k = BOAT_KINDS[sea.kind];
    if (landingSpot(sea)) return Math.abs(sea.v) > 0.25 ? 'Slow down to step off' : `E: tie up and step off${sea.hired && inMarina(sea.x, sea.y) ? ' (return rental)' : ''}`;
    const speed = `${Math.round(Math.abs(sea.v) * 19.4)} knots${sea.v > k.top + .1 ? ' (cruising)' : ''}`;
    return typeof TOUCH !== 'undefined' && TOUCH ? `stick: throttle / helm; full forward: cruise; back: brake   ${speed}` : `W throttle | Shift: cruise | S brake / astern | A/D steer | mouse: look around | V: camera   ${speed}`;
  }
  const b = nearBoat();
  if (!b) return nearOffice() ? (marinaOpen() ? 'MARINA: boats by the trip or to buy, down on the jetty.' : 'MARINA: shut. Open 7am till 9pm.') : '';
  const k = BOAT_KINDS[b.kind], nm = boatTitle(b);
  if (b.deal === 'mine' || b.deal === 'stolen') return `E: take ${nm} out`;
  if (b.deal === 'rent' && b.hired) return `E: continue your trip in ${nm}`;
  if (b.deal === 'rent') return marinaOpen() ? `E: rent ${nm} (${fmt$(k.rent)} a trip)   L: hotwire it` : 'The rentals are chained up till 7.   L: hotwire one';
  if (b.deal === 'sale') return `${marinaOpen() ? `E: buy ${nm}` : `FOR SALE: ${nm}`} (${fmt$(k.price)})   L: hotwire it`;
  return `${nm}: somebody's pride and joy.   L: hotwire it`;
}
function useMarina() { // true if E did something
  if (mode === 'sea') { leaveBoat(); return true; }
  const b = nearBoat();
  if (!b) return false;
  const k = BOAT_KINDS[b.kind];
  if (b.deal === 'rent' && b.hired) { boardBoat(b); say(`You cast off. Return the '${b.name}' to the marina when you're finished.`, 3); return true; }
  if (b.deal === 'mine' || b.deal === 'stolen') { boardBoat(b); say(b.deal === 'mine' ? `You cast off the '${b.name}'.` : 'Back at the helm of your ill-gotten boat.', 3); return true; }
  if (b.deal === 'private') { say("Somebody's boat. Not for hire. (L to hotwire it, if you're that kind of person.)", 3); return true; }
  if (!marinaOpen()) { say('The marina\'s shut. Open 7am till 9pm.', 3); return true; }
  if (b.deal === 'rent') {
    if (!pay(k.rent)) { say(`That's ${fmt$(k.rent)} for the trip.`); return true; }
    b.hired = true; boardBoat(b);
    const controls = typeof TOUCH !== 'undefined' && TOUCH ? 'Stick to steer; full forward to cruise, back to brake.' : 'W to go, A/D to steer. Hold Shift to cruise; S to brake.';
    say(`"Have her back in one piece." Return the ${k.name} to the marina when you're finished. ${controls}`, 5);
    return true;
  }
  if (!pay(k.price)) { say(`The '${b.name}' is ${fmt$(k.price)}. You have ${fmt$(money)}.`, 3); return true; }
  b.deal = 'mine';
  say(`Sold! The '${b.name}' is yours. She stays tied up wherever you leave her. E to take her out.`, 4);
  return true;
}
function stealBoat() { // L beside a boat that isn't yours: true if it did
  const b = nearBoat();
  if (!b || b.deal === 'mine' || b.deal === 'stolen' || b.hired) return false;
  b.deal = 'stolen'; b.hired = false;
  const seen = crime('boattheft', b.x, b.y);
  boardBoat(b);
  say(`You pry the panel off, twist two wires together, and the engine coughs into life.${seen === 'cop' ? ' A whistle blows on the promenade.' : seen ? ' Somebody on the jetty is on the phone.' : ''}`, 4);
  return true;
}
function boardBoat(b) {
  sea = b; b.v = 0; mode = 'sea'; px = b.x; py = b.y; a = Math.atan2(b.hy, b.hx); camYaw = a; pitch = 0;
}
// somewhere to step off: a jetty, the promenade, a beach, right beside the hull
const dryLand = (x, y) => !map[idx(Math.floor(x), Math.floor(y))] && !isWater(x, y) && outdoorGroundHeight(x, y) <= .12 && !solidAt(x, y, 0.06);
function landingSpot(b) {
  const k = BOAT_KINDS[b.kind];
  for (const off of [0.2, 0.4]) for (const [u, v] of [[0, k.hw + off], [0, -k.hw - off], [k.hl * 0.5, k.hw + off], [k.hl * 0.5, -k.hw - off],
    [-k.hl * 0.5, k.hw + off], [-k.hl * 0.5, -k.hw - off], [k.hl + off, 0], [-k.hl - off, 0]]) {
    const x = b.x + b.hx * u - b.hy * v, y = b.y + b.hy * u + b.hx * v;
    if (dryLand(x, y)) return [worldCoord(x), worldCoord(y)];
  }
  return null;
}
function leaveBoat() {
  const b = sea;
  if (Math.abs(b.v) > 0.25) return say('Slow down first.', 2);
  const at = landingSpot(b);
  if (!at) return say('Nowhere to step off. Pull up alongside a jetty or the sea wall.', 3);
  a = Math.atan2(rel(at[1] - b.y), rel(at[0] - b.x)); [px, py] = at; mode = 'walk'; sea = null; b.v = 0;
  if (b.hired) {
    if (inMarina(b.x, b.y)) {
      const s = SLOTS[b.slot];
      b.hired = false; Object.assign(b, { x: s.x, y: s.y, hx: s.hx, hy: s.hy });
      say('You tie her up and hand the keys back.', 3);
    } else say(`You tie up the '${b.name}'. She's waiting for your return trip.`, 3);
  } else say(b.deal === 'mine' ? `You tie up the '${b.name}'. She'll be here when you get back.` : 'You tie her up and walk away whistling.', 3);
}
// out on the water: nothing solid at the hull's corners (the shore, a jetty, a bridge, a moored boat)
const navigable = (x, y) => seaAt(x, y) && (isWater(x, y) || !!roadBridgeAt(x,y)) && !roadBridgePierAt(x,y);
function hullPoints(b, x, y, hx, hy) {
  const k = BOAT_KINDS[b.kind];
  return [[k.hl, 0], [k.hl * 0.6, k.hw], [k.hl * 0.6, -k.hw], [0, k.hw], [0, -k.hw], [-k.hl, k.hw], [-k.hl, -k.hw]].map(([u, v]) => [x + hx * u - hy * v, y + hy * u + hx * v]);
}
const waterClear = (b, x, y, hx, hy) => hullPoints(b, x, y, hx, hy).every(([qx, qy]) => navigable(qx, qy) && roadBridgeClearance(qx,qy) > (b.kind==='sailboat'?1.05:.28) && !ferryHullAt(qx,qy) && !fleet.some(o => o !== b && boatDist(o, qx, qy) < 0.01));
function trafficClear(b, x, y, hx, hy, t = T) { // the boats going round the bay
  const pts = hullPoints(b, x, y, hx, hy);
  return !boats.some(o => { const p = boatAt(o, t), r = BOAT_HL[o.kind] * 0.85; return Math.abs(rel(p.x - x)) < 3 && pts.some(([qx, qy]) => Math.hypot(rel(p.x - qx), rel(p.y - qy)) < r); });
}
function stepSea(dt) { // throttle and helm; the shore and everything else in the water stops you
  const b = sea, k = BOAT_KINDS[b.kind];
  const f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  const cruise = K.ShiftLeft || K.ShiftRight, limit = cruise ? k.cruise : k.top;
  if (f > 0) {
    // Releasing cruise eases back to harbour speed instead of cutting velocity instantly.
    if (b.v > limit) b.v = Math.max(limit, b.v - k.acc * 1.5 * dt);
    else {
      let acceleration = cruise ? 1.6 : 1;
      if (b.v < 0) acceleration = 2;
      b.v = Math.min(limit, b.v + k.acc * acceleration * dt);
    }
  } else if (f < 0) {
    const brake = b.v > 0 ? k.acc * 1.5 + Math.max(0, b.v - k.top) * .75 : k.acc * .6;
    b.v -= brake * dt;
  } else b.v *= Math.max(0, 1 - .35 * dt);
  b.v = clamp(b.v, -k.top * .3, k.cruise);
  const turn = s * dt * k.turn * clamp(Math.abs(b.v) / .35, .25, 1) * Math.min(1, k.top / Math.max(k.top, Math.abs(b.v))) * (b.v < -.02 ? -1 : 1);
  // Sweep translation and rotation: even a fast boat cannot skip a thin pier between frames.
  const steps = Math.max(1, Math.ceil((Math.abs(b.v) * dt + k.hl * Math.abs(turn)) / .06));
  for (let n = 0; n < steps; n++) {
    const yaw = a + turn / steps, hx = Math.cos(yaw), hy = Math.sin(yaw), nx = b.x + hx * b.v * dt / steps, ny = b.y + hy * b.v * dt / steps;
    const ok = waterClear(b, nx, ny, hx, hy) && (trafficClear(b, nx, ny, hx, hy) || !trafficClear(b, b.x, b.y, b.hx, b.hy)); // (something ran into you: you can get away)
    if (ok) { b.x = worldCoord(nx); b.y = worldCoord(ny); b.hx = hx; b.hy = hy; a = yaw; continue; }
    const sp = Math.abs(b.v);
    if (sp > 0.7) { say(pick(['*THUNK*', '*CRUNCH* That\'ll buff out.', '*BONK*']), 1.5); if (typeof actx !== 'undefined' && actx) playClip('crash', clamp(0.2 + sp * 0.2, 0.2, 0.6)); }
    if (waterClear(b, b.x, b.y, hx, hy)) { b.hx = hx; b.hy = hy; a = yaw; }
    b.v = -b.v * 0.25;
    break;
  }
  px = b.x; py = b.y;
}
// Keep an active rental ashore too: an island visit must survive a save/reload without stranding you.
const savedBoats = () => fleet.filter(b => b.deal === 'mine' || b.hired).map(({ id, kind, x, y, hx, hy, col, name, deal, slot }) =>
  ({ id, kind, x, y, hx, hy, col, name, ...(deal === 'rent' ? { deal, slot, hired: true } : {}) }));
function loadBoats(list) {
  const restoredRentals = new Set();
  for (const [index, s] of (list || []).entries()) {
    if (!s || !BOAT_KINDS[s.kind]?.price) continue;
    if (![s.x, s.y, s.hx, s.hy].every(Number.isFinite) || Math.hypot(s.hx, s.hy) < .1) continue;
    const length = Math.hypot(s.hx, s.hy), position = { x: worldCoord(s.x), y: worldCoord(s.y), hx: s.hx / length, hy: s.hy / length, v: 0 };
    if (s.deal === 'rent') {
      if (s.hired !== true || !Number.isInteger(s.slot) || restoredRentals.has(s.slot)) continue;
      const rental = fleet.find(b => b.slot === s.slot && b.deal === 'rent' && b.kind === s.kind);
      if (!rental || !waterClear(rental, position.x, position.y, position.hx, position.hy)) continue;
      Object.assign(rental, position, { hired: true });
      restoredRentals.add(s.slot);
      continue;
    }
    const id = typeof s.id === 'string' && s.id.length <= 100 ? s.id : `owned:${index}`;
    const existing = fleet.find(b => b.id === id && b.deal === 'mine');
    if (existing) { Object.assign(existing, position); continue; }
    const sold = fleet.findIndex(b => b.deal === 'sale' && b.kind === s.kind);
    if (sold >= 0) fleet.splice(sold, 1);
    fleet.push({ id, kind: s.kind, deal: 'mine', ...position, col: s.col ?? WHITE, name: s.name || 'Boaty', slot: -1 });
  }
}
