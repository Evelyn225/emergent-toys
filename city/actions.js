// ---- actions
function curbOf(c) { // sidewalk spot on the car's right, next to its lane
  const vert = Math.abs(c.hy) > Math.abs(c.hx), dir = Math.sign(vert ? c.hy : c.hx) || 1;
  return vert ? [mod(Math.round((c.x - 1) / 8) * 8 + 1 + 0.88 * dir, N), c.y] : [c.x, mod(Math.round((c.y - 1) / 8) * 8 + 1 - 0.88 * dir, N)];
}
function toLane(c) { // snap a car onto the nearest lane in the direction it points and hand it back to the AI
  const vert = Math.abs(c.hy) > Math.abs(c.hx), dir = Math.sign(vert ? c.hy : c.hx) || 1;
  if (vert) { c.x = mod(Math.round((c.x - 1) / 8) * 8 + 1 + 0.4 * dir, N); c.hx = 0; c.hy = dir; }
  else { c.y = mod(Math.round((c.y - 1) / 8) * 8 + 1 - 0.4 * dir, N); c.hx = dir; c.hy = 0; }
  plan(c);
}
function leaveCar() {
  const c = me;
  [px, py] = curbOf(c);
  if (mode === 'drive') { c.player = false; c.v = 0; toLane(c); c.ex = c.x; c.ey = c.y; a += Math.PI / 2; }
  else { // settle up: all of it if you can, everything you've got if you can't
    const fare = Math.round(taxiFare(c.fare) * 100) / 100;
    if (pay(fare)) say(`Fare: ${fmt$(fare)}. Thanks!`);
    else { const all = money; pay(all); say(`Fare's ${fmt$(fare)}. You've only got ${fmt$(all)}. The driver takes it, muttering.`, 4); }
    c.rider = c.dest = c.arrived = false; plan(c);
  }
  me = null; mode = 'walk';
}
// taxi destinations: always a point in the middle of a street that exists
function setDest(n) {
  const c = me, far = p => Math.hypot(rel(p[0] - c.x), rel(p[1] - c.y));
  const nearest = pts => pts.reduce((b, p) => far(p) < far(b) ? p : b);
  // the middle of a street beside block (bx, by): its west street if there is one, else its north street
  const beside = (bx, by) => vseg(bx, by) ? [bx * 8 + 1, by * 8 + 5] : hseg(bx, by) ? [bx * 8 + 5, by * 8 + 1] : null;
  if (n === 1) { c.dest = nearest(parks.map(([bx, by]) => beside(bx, by)).filter(Boolean)); c.destName = 'the park'; }
  else if (n === 4) { // the shore road, south or north, level with you
    const bx = Math.floor(c.x / 8);
    c.dest = nearest([[bx * 8 + 5, SHORE_S * 8 + 1], [bx * 8 + 5, (SHORE_N + 1) * 8 + 1]]); c.destName = 'the waterfront';
  } else if (n === 5) { // the street in front of the nearest station entrance
    const s = stations.reduce((b, s) => far([s.x, s.y]) < far([b.x, b.y]) ? s : b);
    c.dest = [s.x, s.y - mod(s.y, 8) + 1]; c.destName = `${s.name} station`;
  } else {
    let p; do p = beside(Math.random() * NB | 0, 1 + Math.random() * (SHORE_S - 1) | 0); while (!p || n === 2 && far(p) < 60);
    c.dest = p; c.destName = n === 2 ? 'across town' : 'somewhere';
  }
  plan(c);
}

// ---- the el: stairs up from the sidewalk, a platform per direction, trains you ride standing at the window
let plat = null, ride = null; // plat: {s: station, tr: which side}; ride: {tr, k, off: where you stand along the train}
const nearElStairs = () => {
  if (mode !== 'walk') return null;
  for (const s of EL_STATIONS) for (const tr of [0, 1])
    if (Math.hypot(rel(s.x - px), rel(EL_Y + (tr ? 1.86 : 0.14) - py)) < 0.4) return { s, tr };
  return null;
};
function elUp({ s, tr }) {
  mode = 'elplat'; plat = { s, tr }; px = s.x; py = EL_PLAT[tr]; a = tr ? 0 : Math.PI; pitch = 0; // facing the way the trains go
  say(`${s.name} el, ${tr ? 'eastbound' : 'westbound'} platform`);
}
function elDown() {
  mode = 'walk'; px = plat.s.x; py = EL_Y + (plat.tr ? 1.88 : 0.12); plat = null;
}
// the train standing at your platform, if there is one
const elHere = () => plat && elTrains(T).find(t => t.tr === plat.tr && t.stopped && EL_STATIONS[t.station] === plat.s);
function elBoard() {
  const t = elHere();
  if (!t) return false;
  ride = { tr: t.tr, k: t.k, off: clamp(rel(px - t.x), -EL_CAR_LEN, EL_CAR_LEN) };
  mode = 'el'; py = EL_TRACK[t.tr] + (t.tr ? 0.12 : -0.12); // by the window on the platform side
  say(`Next stop: ${EL_STATIONS[t.next].name}`);
  return true;
}
const elRiding = () => ride && elTrain(ride.tr, ride.k, T);
function elGetOff() {
  const t = elRiding();
  if (!t.stopped) return say('Wait for the next stop.');
  const s = EL_STATIONS[t.station];
  mode = 'elplat'; plat = { s, tr: ride.tr }; ride = null; py = EL_PLAT[plat.tr];
  px = clamp(px, s.x0, s.x1);
  say(`${s.name}`);
}
function enterRoom(kind, extra, spawn) {
  room = makeRoom(kind, extra); mode = 'room'; [px, py, a] = spawn; pitch = 0;
  if (actx && kind !== 'station' && kind !== 'train' && kind !== 'apts') sfxDoor(); // the bell over the shop door
}
function interact() {
  if (mode === 'room') {
    if (room.kind === 'train') return;
    if (nearElevator()) { // up to the roof, standing in the middle of the lot you walked into
      const [mx, my] = room.cell, ox = (mod(mx, 8) - 2) % 3, oy = (mod(my, 8) - 2) % 3;
      roofH = map[idx(mx, my)]; mode = 'roof'; px = mx - ox + 1.5; py = my - oy + 1.5; pitch = 0;
      return say(`Roof, ${roofH * 10}m up`);
    }
    if (canBoard()) {
      const from = room.st;
      return enterRoom('train', { st: from, opts: [1, 2, 3, 4, 5].map(k => (from + k) % stations.length), dest: null, track: 0 }, [2, 2.5, 0.25]);
    }
    return leaveRoom();
  }
  if (mode === 'roof') { mode = 'room'; px = room.def.ex; py = 1.7; a = Math.PI / 2; return; }
  if (mode === 'el') return elGetOff();
  if (mode === 'elplat') return elBoard() || elDown();
  if (mode === 'drive') { if (Math.abs(me.v) < 0.3) leaveCar(); else say('Slow down first.'); return; }
  if (mode === 'taxi') return leaveCar();
  const c = nearestCar(0.5);
  if (c && c.v < 0.6) {
    me = c;
    if (c.body === TAXI) {
      if (money < 3) { me = null; return say(`"Cash first, pal." You can't cover the flag fall.`); }
      mode = 'taxi'; c.rider = true; c.hail = false; c.fare = 0; c.dest = null; look = 0;
    }
    else { mode = 'drive'; c.player = true; c.v = 0; a = Math.atan2(c.hy, c.hx); }
    px = c.x; py = c.y;
    return;
  }
  const who = nearPerson();
  if (who) return talkTo(who);
  if (nearDog()) { task.dog.follow = true; return say('The dog wags its whole body and trots after you.'); }
  const el = nearElStairs();
  if (el && !pay(SUBWAY_FARE)) return say(`The turnstile wants ${fmt$(SUBWAY_FARE)}. You don't have it.`);
  if (el) { elUp(el); return say(`Swipe: -${fmt$(SUBWAY_FARE)}. ${msgText}`); }
  const ven = nearVendor();
  if (ven && !pay(ven.type.price)) return say(`${ven.type.item[0].toUpperCase() + ven.type.item.slice(1)} is ${fmt$(ven.type.price)}. You can't afford it.`);
  if (ven && taskBuy(ven)) return say(`You buy ${ven.type.item}. Not for you, though.`);
  if (ven) return say(pick([`You buy ${ven.type.item}. Delicious.`, `${ven.type.item[0].toUpperCase() + ven.type.item.slice(1)}, $${ven.type.price}. Worth it.`, `"Enjoy!" says the ${ven.type.name.toLowerCase()} vendor.`]));
  const st = nearStation();
  if (st && !pay(SUBWAY_FARE)) return say(`The turnstile wants ${fmt$(SUBWAY_FARE)}. You don't have it.`);
  if (st) say(`Swipe: -${fmt$(SUBWAY_FARE)}`);
  if (st) return enterRoom('station', { st: stations.indexOf(st), word: st.name, t0: T - 30, ret: [px, py, a] }, [2, 1.7, Math.PI / 2]);
  if (lookHit && lookHit.d < 0.35 && SHOP[idx(lookHit.mx, lookHit.my)]) {
    const sh = SHOP[idx(lookHit.mx, lookHit.my)];
    if (sh.kind === SHOP_SHUT) return say('Closed.');
    if (!openAt(sh, tod)) return say(`Closed. Opens at ${sh.hours[0]}:00.`);
    const kind = sh.kind === SHOP_APTS ? 'apts' : ROOM_FOR[sh.word] || 'store';
    const r = { ...sh, cell: [lookHit.mx, lookHit.my], ret: [px, py, a], line: pick(LINES).replace('{}', sh.word) };
    enterRoom(kind, r, [0, 0, -Math.PI / 2]);
    px = room.W / 2; py = room.H - 1.6;
  }
}
function leaveRoom() {
  if (room.kind === 'station') { const s = stations[room.st]; px = s.x; py = s.y - 0.12; a = -Math.PI / 2; }
  else { [px, py, a] = room.ret; a += Math.PI; }
  room = null; mode = 'walk';
}
function arriveAt(n) { // off the train onto the destination platform; the train pulls out a few seconds later
  enterRoom('station', { st: n, word: stations[n].name, t0: T - 13 }, [15, 3.6, -Math.PI / 2]); // back from the edge, so E means leave
  say(`${stations[n].name}`);
}
function hail() {
  if (mode !== 'walk') return;
  let best = null, bd = 5;
  for (const c of cars) if (c.body === TAXI && !c.rider && !c.player) { const d = Math.hypot(rel(c.x - px), rel(c.y - py)); if (d < bd) { bd = d; best = c; } }
  if (best) { best.hail = true; say('TAXI!'); } else say('No taxi nearby.');
}

