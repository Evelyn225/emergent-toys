// ---- actions
function curbOf(c) { // sidewalk spot on the car's right, next to its lane
  const vert = Math.abs(c.hy) > Math.abs(c.hx), dir = Math.sign(vert ? c.hy : c.hx) || 1;
  return vert ? [mod(Math.round((c.x - 1) / 8) * 8 + 1 + 0.88 * dir, N), c.y] : [c.x, mod(Math.round((c.y - 1) / 8) * 8 + 1 - 0.88 * dir, N)];
}
// in a taxi: slip the driver a twenty to step on it (faster, and red lights don't count)
const TIP = 20;
function tipDriver() {
  if (me.rush) return say('"I\'m going as fast as I can, pal!"');
  if (!me.dest) return say('"Where to first?"');
  if (!pay(TIP)) return say(`You don't have ${fmt$(TIP)} to spare.`);
  me.rush = true;
  say(pick(['"Hold on to something."', '"You got it, boss." The meter ticks faster than ever.', '"Lights? What lights?"']), 3);
}
// the driver of a car you've just taken: out onto the sidewalk beside it, shouting (someone from far off stands in)
function ejectDriver(c) {
  const p = people.find(q => !q.follow && !q.hailing && Math.hypot(rel(q.x - px), rel(q.y - py)) > 40);
  if (!p) return;
  const [x, y] = curbOf(c);
  Object.assign(p, { x, y, hidden: false, inside: null, path: [], wait: 0, talk: 3, goal: null });
  snapToCorner(p);
}
// where you step out: right beside the car, whichever side (or end) has room; the kerb only if nowhere near does
function exitSpot(c) {
  const lx = c.hy, ly = -c.hx; // (the car's left)
  const cx = c.rider ? c.ex : c.x, cy = c.rider ? c.ey : c.y;
  for (const d of [0.22, 0.32, 0.45]) for (const [ox, oy] of [[lx, ly], [-lx, -ly], [-c.hx * 1.3, -c.hy * 1.3], [c.hx * 1.3, c.hy * 1.3]]) {
    const x = mod(cx + ox * d, N), y = mod(cy + oy * d, N);
    if (free(x, y) && !cars.some(o => o !== c && Math.hypot(rel(o.ex - x), rel(o.ey - y)) < 0.2)) return [x, y];
  }
  return curbOf(c);
}
function leaveCar() {
  const c = me;
  endTaxiShift();
  [px, py] = exitSpot(c);
  if (mode === 'drive') { // the car stays just where you stopped it (traffic goes round it)
    c.player = false; c.v = 0; c.off = 0; c.ex = c.x; c.ey = c.y; c.parked = true;
    a = Math.atan2(rel(py - c.y), rel(px - c.x));
  }
  else { // settle up: all of it if you can, everything you've got if you can't
    const fare = Math.round(taxiFare(c.fare) * 100) / 100;
    if (pay(fare)) say(`Fare: ${fmt$(fare)}. Thanks!`);
    else { const all = money; pay(all); say(`Fare's ${fmt$(fare)}. You've only got ${fmt$(all)}. The driver takes it, muttering.`, 4); }
    c.rider = c.dest = c.arrived = c.rush = false; plan(c);
  }
  me = null; mode = 'walk'; look = 0;
}
// taxi destinations: always a point in the middle of a street that exists
const homeDist = (h, c) => Math.hypot(rel(h.cell % N - c.x), rel(Math.floor(h.cell / N) - c.y));
function homeKerb(x, y) { // the middle of the street nearest a building's cell (x, y): one of its block's four sides
  const bx = x >> 3, by = y >> 3, opts = [];
  if (vseg(bx & (NB - 1), by & (NB - 1))) opts.push([bx * 8 + 1, y + 0.5]);
  if (vseg((bx + 1) & (NB - 1), by & (NB - 1))) opts.push([(bx + 1) * 8 + 1, y + 0.5]);
  if (hseg(bx & (NB - 1), by & (NB - 1))) opts.push([x + 0.5, by * 8 + 1]);
  if (hseg(bx & (NB - 1), (by + 1) & (NB - 1))) opts.push([x + 0.5, (by + 1) * 8 + 1]);
  return opts.reduce((b, p) => Math.hypot(p[0] - x, p[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? p : b).map(v => mod(v, N));
}
function setDest(n) {
  const c = me, far = p => Math.hypot(rel(p[0] - c.x), rel(p[1] - c.y));
  const nearest = pts => pts.reduce((b, p) => far(p) < far(b) ? p : b);
  // the middle of a street beside block (bx, by): its west street if there is one, else its north street
  const beside = (bx, by) => vseg(bx, by) ? [bx * 8 + 1, by * 8 + 5] : hseg(bx, by) ? [bx * 8 + 5, by * 8 + 1] : null;
  if (n === 1) { c.dest = nearest(parks.map(([bx, by]) => beside(bx, by)).filter(Boolean)); c.destName = 'the park'; }
  else if (n === 4) { // the shore road, south or north, level with you
    const bx = Math.floor(c.x / 8);
    c.dest = nearest([[bx * 8 + 5, SHORE_S * 8 + 1], [bx * 8 + 5, (SHORE_N + 1) * 8 + 1]]); c.destName = 'the waterfront';
  } else if (n === 6 && owned.homes.length) { // home: the street in front of whichever of your places is nearest
    const h = owned.homes.reduce((b, h) => homeDist(h, c) < homeDist(b, c) ? h : b), x = h.cell % N, y = Math.floor(h.cell / N);
    c.dest = homeKerb(x, y); c.destName = `home (${SHOP[h.cell].word})`;
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
    if (Math.hypot(rel(s.stairs[tr].x - px), rel(s.stairs[tr].y - py)) < 0.4) return { s, tr };
  return null;
};
function elUp({ s, tr }) {
  body.z=body.vz=body.peak=0;roofH=EL_TOP;
  mode = 'elplat'; plat = { s, tr }; px = s.x; py = EL_PLAT[tr]; a = tr ? 0 : Math.PI; pitch = 0; // facing the way the trains go
  say(`${s.name} el, ${tr ? 'eastbound' : 'westbound'} platform`);
}
function elDown() {
  const stairs=plat.s.stairs[plat.tr];
  mode = 'walk'; px = stairs.x; py = stairs.y-stairs.ay*.02; plat = null;
  body.z=body.vz=body.peak=0;roofH=0;
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
  body.z=body.vz=body.peak=0;roofH=EL_TOP;
  say(`${s.name}`);
}
function enterRoom(kind, extra, spawn) {
  fx.skating = false; body.seat = null; // the board comes up under your arm at the door (and you're on your feet)
  room = makeRoom(kind, extra); mode = 'room'; [px, py, a] = spawn; pitch = 0;
  if (room.line == null) room.line = pick(room.word ? LINES : LINES.slice(1)).replace('{}', room.word); // (whoever's behind the counter always has something to say)
  if (actx && kind !== 'station' && kind !== 'train' && kind !== 'apts') sfxDoor(); // the bell over the shop door
}
function interact() {
  if(courierUse())return;
  if (mode === 'room') {
    if (room.kind === 'train') return;
    if (grandHotelUse()) return;
    if (homeRecord(room)) { // your place: sleep whenever you like, your closet, the telly
      const hs = homeSpot();
      const home = homeRecord(room);
      if (!home) return say('This apartment is not yours.', 2);
      if (hs === 'bed') { sleep = { t: 0, home: true }; return say('You crawl into your own bed.', 3); }
      if (hs === 'closet') return openStorage(closet, 'your closet', 'Your closet', 'Kept at home, whichever home you go to');
      if (hs === 'shelf') {
        home.decor ||= [];
        if (heldItem() && isHomeDecor(heldItem())) {
          if (home.decor.length >= HOME_SHELF_CAPACITY) return say('The shelf is full. Take something down first.');
          const it = takeSlot(held); home.decor.push(it); saveGame(); return say(`You put the ${ITEMS[it.id].name} on the shelf.`, 2);
        }
        return openStorage(home.decor, 'the shelf', 'Display shelf', 'Keepsakes you have brought home. Click one to take it down.', isHomeDecor, HOME_SHELF_CAPACITY);
      }
      if (hs === 'fridge') { home.fridge ||= []; return openStorage(home.fridge, 'the fridge', 'Fridge', 'Food and drinks stay here. Click one to take it out.', isFridgeItem); }
      if (hs === 'pet') {
        home.pets ||= home.pet ? [home.pet] : [];
        if (heldItem() && ['petcat', 'petdog'].includes(heldItem().id) && !home.pets.includes(heldItem().id)) {
          const pet = heldItem().id; takeSlot(held); home.pets.push(pet); saveGame();
          if (actx) sfxUse(pet === 'petcat' ? 'meow' : 'bark');
          return say(pet === 'petcat' ? 'The cat steps out of its carrier and settles in at home.' : 'The dog bounds out of its carrier and settles in at home.', 3);
        }
        if (home.pets.length) {
          if (actx) sfxUse(pick(home.pets) === 'petcat' ? 'meow' : 'bark');
          return say('Your pets are happy to see you.', 2);
        }
        return say('Adopt a pet at the pet shop and bring it home.', 2);
      }
      if (hs === 'tv') { room.tv = !room.tv; return say(room.tv ? 'The telly flickers on.' : 'You switch the telly off.', 2); }
    }
    if (room.kind === 'lighthouse' && Math.hypot(px - 4, py - 3.6) < 1.8) { // up the spiral
      enterRoom('lamproom', { word: 'LAMP ROOM', below: { word: room.word, ret: room.ret, line: room.line } }, [1.6, 4.4, -Math.PI / 4]);
      return say('Round and round and up and up. The lamp room.', 3);
    }
    if (room.kind === 'lamproom') return Math.hypot(px - 1.4, py - 4.6) < 1.4 ? enterRoom('lighthouse', room.below, [4, 5.6, -Math.PI / 2]) : say('The hatch down is in the corner.', 2);
    if (room.kind === 'jail' && nearCabbie()) return talkToCabbie();
    if (room.kind === 'jail') {
      if (T >= room.until) return say('The guard unlocks the door. "Stay out of trouble."', 3), leaveRoom();
      if (room.tried) return say(`Locked in. ${Math.ceil(room.until - T)}s to go.`);
      room.tried = true; // one shot at it
      return startCrime('jailbreak', ok => {
        if (ok === 'abort') return say('You lose your nerve. No second chances.', 3);
        const got = game && game.g.hasItems;
        if (!ok) { room.until += 30; return say(got ? '"Nice try. And put those back." Thirty more seconds for that.' : '"Nice try." Thirty more seconds for that.', 4); }
        room.until = T; leaveRoom();
        if (got && seized.length) { for (const it of seized.splice(0, INV_SIZE - inv.length)) carryItem(it, false); held = inv.length ? 0 : -1; seized.length = 0; return say('You slip out past the front desk with your things stuffed in your jacket. Nobody saw a thing.', 4); }
        say('You slip out past the front desk. Nobody saw a thing.', 4);
      });
    }
    if (room.kind === 'museum' && museumUse()) return;
    if (room.burgled && nearVault()) return crackVault();
    if (room.burgled && nearKeeper()) return emptyTill();
    if (room.kind === 'laundry' && useLaundry()) return;
    if (nearTouchPool()) return say(pick(TOUCH_LINES), 3);
    if (room.kind === 'cathedral' && useCathedral()) return;
    if (atBroker()) return startGame('market', 'market');
    if (nearVip()) { if (!pay(LAPDANCE)) return say(`"Private dances are ${fmt$(LAPDANCE)}, sweetie."`, 3); startGame('lapdance', 'show'); return say('The host pulls the curtain back. You sit. Hands on your knees.', 3); }
    if (nearStage()) return tipDancer();
    if (nearClubCigs()) return openShop(VENDING.CIGARETTES.title, VENDING.CIGARETTES.stock);
    const cs = casinoSpot(); // a seat at a table, or a slot machine
    if (cs) return startGame(cs, 'casino');
    if (aviaryKeeper()) { if (T - seedT < 12) return say('You\'ve still got seed. Hold still.', 2); if (!pay(1)) return say('"A dollar a cup."'); seedT = T; return say('You hold out a cup of seed. A dozen birds land on your arms at once.', 4); }
    if (useShotengai()) return;
    if (nearElevator()) { // up to the roof, standing in the middle of the lot you walked into
      const [mx, my] = room.cell, ox = (mod(mx, 8) - 2) % 3, oy = (mod(my, 8) - 2) % 3;
      roofH = map[idx(mx, my)]; mode = 'roof'; px = mx - ox + 1.5; py = my - oy + 1.5; pitch = 0; roofLot = roofCells(mx, my);
      notePoliceRoofEntry(px, py, room.ret);
      return say(`Roof, ${roofH * 10}m up`);
    }
    if (canBoard()) {
      const from = room.st;
      return enterRoom('train', { st: from, opts: [1, 2, 3, 4, 5].map(k => (from + k) % stations.length), dest: null, track: 0 }, [2, 2.5, 0.25]);
    }
    const dr = droppedHere(); // something you put down here earlier
    if (dr) return say(pickUpDropped(dr)[1]);
    if (room.kind === 'arcade') {
      const cab = nearCabinet();
      if (cab) return cab.busy ? say('Somebody\'s on this one.') : playCabinet(cab);
      if (nearKeeper()) return openPrizes();
    }
    if (roomPerson()) return talkInRoom();
    if (room.kind === 'storage' && nearKeeper()) return openStorage(stored, 'your unit', 'Storage unit', 'The same unit at every storage place in town');
    if (room.kind === 'hotel' && nearKeeper()) return bookRoom();
    if (room.kind === 'hospital' && nearKeeper()) {
      if (needs.health >= 95) return say(`"${pick(NURSE_LINES)}"`, 3);
      if (!pay(NURSE_FEE)) return say(`"Treatment's ${fmt$(NURSE_FEE)}, I'm afraid." You can't cover it.`, 3);
      needs.health = 100; return say('The nurse cleans you up, checks your eyes with a little light and sends you off with a lollipop. Good as new.', 4);
    }
    if (nearKeeper()) { const stock = stockFor(room.kind, room.word); return stock.length ? openShop(room.word, stock) : room.line && say(`"${room.line}"`); }
    if (nearExit()) return leaveRoom();
    return say('The way out is over by the door.', 2);
  }
  if (mode === 'roof' && droppedHere()) return say(pickUpDropped(droppedHere())[1]);
  if (homeBalconyActive()) {
    if (atHomeBalconyDoor()) { leaveHomeBalcony(); return say('Back through the French doors.',2); }
    return say('The French doors are behind you. The city carries on below.',2);
  }
  if (mode === 'roof' && room && room.kind === 'cathedral') { mode = 'room'; [px, py] = CATH_TOWER; a = -Math.PI / 2; roofLot = null; roofH = 0; return say('Down and down and round and round.', 2); }
  if(mode==='roof'&&roofH===EL_TOP&&underEl(py))return say('Find a station platform to board a train or take the stairs down.',3);
  if (mode === 'roof' && !onRoofLot()) return fireEscape() ? say('You clang down the fire escape and drop the last bit to the sidewalk.', 3) : say('No way down from here. Jump, or find another roof.', 3);
  if (mode === 'roof') { mode = 'room'; px = room.def.ex; py = 1.7; a = Math.PI / 2; roofLot = null; return; }
  if (mode === 'el') return elGetOff();
  if (mode === 'boat') return useGardens();
  if (mode === 'sea') return useMarina();
  if (mode === 'fair') return say(fairRide.kind === 'wheel' ? 'The bar stays down till you\'re back at the bottom.' : 'Not while it\'s going round.', 2);
  if (mode === 'elplat') return elBoard() || elDown();
  if (mode === 'drive') { if (Math.abs(me.v) < 0.3) leaveCar(); else say('Slow down first.'); return; }
  if (mode === 'taxi') return leaveCar();
  const dr = droppedHere();
  if (dr) return say(pickUpDropped(dr)[1]);
  const vm = nearMachine(); // before the cars: you're looking right at it
  if (vm) return openShop(VENDING[vm.kind].title, VENDING[vm.kind].stock);
  if (useGardens() || useMarina()) return;
  const c = nearestCar(0.5);
  if (c && c.v < 0.6) {
    me = c;
    if (c.body === TAXI) {
      if (money < 3) { me = null; return say(`"Cash first, pal." You can't cover the flag fall.`); }
      mode = 'taxi'; c.rider = true; c.hail = false; c.fare = 0; c.dest = null; look = 0;
      a = camYaw = carYaw(c);
    }
    else { // a stolen car: if anyone saw, the police hear about it
      mode = 'drive'; c.player = true; c.v = 0; a = Math.atan2(c.hy, c.hx); c.travelA = a; look = 0;
      if (c.owned) { c.parked = false; say(`You get into your ${ITEMS[c.model].name}.`, 2); } // yours, bought and paid for
      else if (c.mine) { c.parked = false; } // your own (stolen) car, where you left it
      else {
        c.mine = true; ejectDriver(c);
        const w = crime('steal', c.x, c.y);
        say(w === 'cop' ? 'A cop saw that.' : 'You drag the driver out. They run off shouting...', 3);
      }
    }
    px = c.ex; py = c.ey;
    return;
  }
  if (pickUpBall()) return say('You pick up the ball.');
  if (nearWalkedDog()) { const p = nearWalkedDog(); p.talk = 3; return say(pick(['The dog leans into your hand. Its owner smiles: "She likes you."', 'A wet nose, a wag, a happy little snort.', '"He\'s friendly!" He is. Very.', 'The dog rolls straight over for a belly rub. Its owner sighs and waits.']), 3); }
  const who = nearPerson();
  if (who) return talkTo(who);
  if (nearDog()) { task.dog.follow = true; return say('The dog wags its whole body and trots after you.'); }
  const el = nearElStairs();
  if (el && !pay(SUBWAY_FARE)) return say(`The turnstile wants ${fmt$(SUBWAY_FARE)}. You don't have it.`);
  if (el) { elUp(el); return say(`Swipe: -${fmt$(SUBWAY_FARE)}. ${msgText}`); }
  const fsp = fairSpot();
  if (fsp) return useFair(fsp);
  const mk = marketSpot();
  if (mk) return useMarket(mk);
  const pot = pottyNear();
  if (pot) return enterPotty(pot), say(pick(['You hold your breath and step in.', 'The smell hits you before the door shuts.', 'It\'s exactly as nice as you\'d think.']), 2.5);
  const ven = nearVendor();
  if (ven) return openShop(ven.type.name, VENDOR_STOCK[ven.type.name], ven);
  const st = nearStation();
  if (st && !pay(SUBWAY_FARE)) return say(`The turnstile wants ${fmt$(SUBWAY_FARE)}. You don't have it.`);
  if (st) say(`Swipe: -${fmt$(SUBWAY_FARE)}`);
  if (st) return enterRoom('station', { st: stations.indexOf(st), word: st.name, t0: T - 30, ret: [px, py, a] }, [11.5, 7.6, Math.PI / 2]); // at the foot of the stairs, facing the platform
  if (nearLighthouse()) return enterRoom('lighthouse', { word: 'LIGHTHOUSE', ret: [px, py, a], line: 'Mind the stairs. Two hundred and twelve of them.' }, [4, 6.2, -Math.PI / 2]);
  const cd = churchDoor();
  if (cd) return enterCathedral(cd);
  if (lookHit && lookHit.d < 0.35 && SHOP[idx(lookHit.mx, lookHit.my)]) {
    const sh = SHOP[idx(lookHit.mx, lookHit.my)];
    if (sh.base && sh.base !== 'amb') return say(pick([`${BASE_KINDS[sh.base].title}. Staff only.`, 'The desk sergeant shakes their head. Not for you.', 'Nobody here needs you right now. Good.']));
    if (sh.kind === SHOP_SHUT) return say(pick(['Closed down for good. A FOR LEASE sign on the shutter.', 'Shuttered for good. The FOR LEASE sign has a phone number nobody answers.', 'Gone out of business. Just the old sign left.']));
    if (!openAt(sh, tod)) return say(`Closed. Opens at ${sh.hours[0]}:00.`);
    const home = homeAt(sh);
    if (home) {
      const kind = homeRoomKind(home.kind), def = ROOM_DEFS[kind];
      enterRoom(kind, { word: 'HOME', ret: [px, py, a], cell: [home.cell % N, Math.floor(home.cell / N)] }, def.entry);
      return say('Home.', 1.5);
    }
    if (sh.club && wanted.stars) return say('The bouncer folds his arms. "Not with the cops on your tail, pal."', 3);
    if (sh.fee && !pay(sh.fee)) return say(`Admission's ${fmt$(sh.fee)}. You're short.`);
    if (sh.fee) say(sh.club ? `${fmt$(sh.fee)} cover. The bouncer unhooks the rope. "Look, don't touch."` : `Admission: ${fmt$(sh.fee)}. "${sh.aqua ? 'Enjoy the fishes!' : sh.museum ? 'Enjoy the collection. No flash photography.' : 'Mind the butterflies.'}"`, 3);
    const kind = sh.kind === SHOP_APTS ? 'apts' : ROOM_FOR[sh.word] || 'store';
    const r = { ...sh, cell: [lookHit.mx, lookHit.my], ret: [px, py, a], line: pick(LINES).replace('{}', sh.word) };
    enterRoom(kind, r, [0, 0, -Math.PI / 2]);
    [px, py] = room.def.spawn || [room.W / 2, room.H - 1.6];
  }
}
// out cold (hunger, thirst, a bad fall): you come to in a bed at the nearest hospital, and they've billed you
let wakeT = 0;
function passOut(why) {
  if(failCourier()){why+=' Your courier delivery failed.';saveGame();}
  climbing=null;
  if (me) outOfCar(); else if (mode === 'sea') { sea.v = 0; sea = null; }
  body.seat = null; body.z = body.vz = 0; fx.skating = false; if (game) game = null;
  const s = SERVICES.filter(b => b.kind === 'amb').map(b => [b, Math.hypot(rel(b.x - px), rel(b.y - py))]).reduce((m, b) => b[1] < m[1] ? b : m, [null, Infinity])[0];
  const bill = hospitalised();
  clearWanted(); // (they lost you in the ambulance)
  enterRoom('hospital', { word: 'HOSPITAL', ret: [...s.door, Math.PI / 2] }, [10.5, 3.3, Math.PI]);
  wakeT = 3; fade = 1;
  say(`You come to in a hospital bed. "${why}" A nurse hands you the bill: ${fmt$(bill)}.`, 8);
}
function stepWake(dt) { if (wakeT > 0 && !sleep) { wakeT -= dt; fade = clamp(wakeT / 2, 0, 1); } }
// the hotel: a night's sleep, from 6pm. Fade out, wake at 7:00 in a room upstairs to a clear morning,
// with everyone outside already where their morning routine puts them
const NURSE_LINES = ['Take a seat, someone will call your name.', 'Fill this in and bring it back up.', 'Are you hurt? No? Then you\'re in luck.',
  'The doctor will see you when she can.', 'Busy night. Busy every night.'];
function bookRoom() {
  const rate = ROOM_RATE(room.word);
  if (!checkInOpen(tod)) return say('"Sorry, check-in begins at 6pm."', 4);
  if (!pay(rate)) return say(`"A room's ${fmt$(rate)} a night." You can't afford it.`, 4);
  say(`"Room ${400 + (Math.random() * 60 | 0)}. Sleep well."`, 3);
  sleep = { t: 0, lobby: { word: room.word, neon: room.neon, ret: room.ret, cell: room.cell, line: room.line } };
}
function stepSleep(dt) {
  sleep.t += dt;
  fade = sleep.t < 1.5 ? sleep.t / 1.5 : sleep.t < 3 ? 1 : clamp(1 - (sleep.t - 3) / 2, 0, 1);
  if (sleep.t >= 1.5 && !sleep.done) {
    sleep.done = true;
    if (tod > 7) dayNum++; // slept through midnight
    tod = 7; weather = 'clear'; wTimer = 150; rain = 0; fogAmt = 0; wet = Math.min(wet, 0.3);
    for (const p of people) if (!p.follow && !(p.talk > 0)) settle(p);
    if (!sleep.home) enterRoom('hotelroom', { lobby: sleep.lobby, suite: !!sleep.lobby.suite }, sleep.lobby.suite ? [4.5, 5.3, -Math.PI / 2] : [3.4, 3.2, -Math.PI / 2]); // (at home you wake where you are)
  }
  if (sleep.t > 3.2 && !sleep.said) { sleep.said = true; say('7:00. You slept well, and the sky has cleared.', 4); }
  if (sleep.t > 5) { sleep = null; fade = 0; }
}
function leaveRoom() {
  body.seat = null;
  if (hotelAlarm) stepGrandHotel(); // A late exit still triggers the alarm while you're inside.
  if (room.kind === 'grandhotelheist') return enterRoom('grandhotel', room.lobby, [10.7, 2.65, Math.PI / 2]);
  if (room.kind === 'hotelroom' && room.lobby.grandHotel) return enterRoom('grandhotel', room.lobby, [7, 6.5, -Math.PI / 2]);
  if (room.kind === 'hotelroom') return enterRoom('hotel', room.lobby, [7.5, 3, Math.PI / 2]); // back down to the lobby
  if (room.kind === 'station') { const s = stations[room.st]; px = s.x - 0.22; py = s.y; a = Math.PI; } // up out of the entrance, onto the sidewalk
  else if (room.kind === 'hospital') {
    // Use the front door for visits and recovery, including saved rooms with the old ambulance return point.
    const [rx, ry] = room.ret;
    const hospital = SERVICES.filter(b => b.kind === 'amb').reduce((best, b) =>
      near(...b.door, rx, ry) < near(...best.door, rx, ry) ? b : best);
    [px, py] = hospital.door; a = -Math.PI / 2;
  }
  else { [px, py, a] = room.ret; a += Math.PI; }
  room = null; mode = 'walk';
  hotelAlarm = null; // Leaving the building before the deadline cancels its untriggered alarm.
}
function arriveAt(n) { // off the train onto the destination platform; the train pulls out a few seconds later
  enterRoom('station', { st: n, word: stations[n].name, t0: T - 13 }, [23, ST_TRACK - 2.4, -Math.PI / 2]); // back from the edge, facing the stairs
  say(`${stations[n].name}`);
}
function hail() {
  if (mode !== 'walk') return;
  let best = null, bd = 3;
  for (const c of cars) if (c.body === TAXI && !c.rider && !c.player) { const d = Math.hypot(rel(c.x - px), rel(c.y - py)); if (d < bd) { bd = d; best = c; } }
  if (best) { best.hail = true; say('TAXI!'); } else say('No taxi nearby.');
}
