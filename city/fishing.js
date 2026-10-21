// ===== fishing. A rod from the bait and tackle hut at the foot of the Sunset Pier (props.js puts the hut up,
// fishing-render.js draws it and everything on the line), and any water you can stand beside: the bay off the sea
// wall, a pier or a bridge, the open water out past the end of the long piers, the marina, a park pond, the lake in the
// Botanical Gardens. Each has its own fish, and its own junk, and now and then something worth keeping.
// Like Minecraft: hold Q to wind up and let go to cast (longer, further), wait for the bobber, watch for the fish
// coming in, and when it pulls the bobber under, Q to strike. Too soon and it bolts; too late and it's away.
// The hut buys what you catch (the fish by weight, the junk for the bin); the pawn shop takes the treasure too.
Object.assign(ITEMS, {
  rod: { name: 'fishing rod', price: 35, kind: 'gear', rod: { wait: 1, window: 0.85, junk: 1, treasure: 1 } },
  carbonrod: { name: 'carbon fishing rod', price: 160, kind: 'gear', rod: { wait: 0.7, window: 1.15, junk: 0.6, treasure: 1.7 } },
  // fish: price is what a middling one fetches at the hut; kg the range they come in
  mackerel: { name: 'mackerel', price: 5, kind: 'fish', kg: [0.3, 1.1], col: BLUE, stripes: true },
  herring: { name: 'herring', price: 3, kind: 'fish', kg: [0.1, 0.4], col: CYAN },
  seabass: { name: 'sea bass', price: 14, kind: 'fish', kg: [0.8, 4], col: GRAY },
  flounder: { name: 'flounder', price: 8, kind: 'fish', kg: [0.4, 2], col: BRICK, flat: true },
  cod: { name: 'cod', price: 12, kind: 'fish', kg: [1, 7], col: GREEN },
  crab: { name: 'crab', price: 7, kind: 'fish', kg: [0.3, 1.4], col: RED, crab: true },
  squid: { name: 'squid', price: 8, kind: 'fish', kg: [0.2, 1.2], col: MAG, squid: true },
  conger: { name: 'conger eel', price: 10, kind: 'fish', kg: [1, 14], col: GRAY, eel: true },
  bream: { name: 'sea bream', price: 15, kind: 'fish', kg: [0.5, 3], col: WHITE },
  bluefish: { name: 'bluefish', price: 13, kind: 'fish', kg: [1, 6], col: BLUE },
  monkfish: { name: 'monkfish', price: 24, kind: 'fish', kg: [2, 12], col: BRICK, ugly: true },
  tuna: { name: 'bluefin tuna', price: 70, kind: 'fish', kg: [8, 45], col: BLUE },
  mullet: { name: 'grey mullet', price: 4, kind: 'fish', kg: [0.4, 2.5], col: GRAY },
  carp: { name: 'carp', price: 6, kind: 'fish', kg: [1, 9], col: YEL },
  perch: { name: 'perch', price: 5, kind: 'fish', kg: [0.2, 1.5], col: GREEN, stripes: true },
  bluegill: { name: 'bluegill', price: 3, kind: 'fish', kg: [0.1, 0.5], col: BLUE },
  catfish: { name: 'catfish', price: 11, kind: 'fish', kg: [2, 16], col: BRICK, whiskers: true },
  strayfish: { name: 'goldfish somebody let go', price: 2, kind: 'fish', kg: [0.1, 0.6], col: ORANGE },
  trout: { name: 'brown trout', price: 12, kind: 'fish', kg: [0.5, 4], col: BRICK, spots: true },
  tench: { name: 'tench', price: 8, kind: 'fish', kg: [0.5, 3.5], col: GREEN },
  orfe: { name: 'golden orfe', price: 9, kind: 'fish', kg: [0.3, 2], col: ORANGE },
  pike: { name: 'pike', price: 22, kind: 'fish', kg: [2, 14], col: GREEN, spots: true, long: true },
  // the Botanical Gardens' golden koi: Q makes a wish, and then it's gone
  goldkoi: { name: 'golden koi', price: 0, kind: 'wish', kg: [1.5, 4], col: YEL },
  // junk: the hut bins it for you
  oldboot: { name: 'old boot', price: 0, kind: 'junk', line: 'An old boot. Left foot. The right one is presumably still down there.' },
  tincan: { name: 'tin can', price: 0, kind: 'junk', line: 'A tin can. Beans, once.' },
  seaweed: { name: 'clump of seaweed', price: 0, kind: 'junk', line: 'A clump of seaweed. It smells exactly how you would expect.' },
  plasticbag: { name: 'plastic bag', price: 0, kind: 'junk', line: 'A plastic bag. You were going to put the fish in it, if you caught one.' },
  tyre: { name: 'bicycle tyre', price: 0, kind: 'junk', line: 'A bicycle tyre. Flat, which is fair.' },
  trafficcone: { name: 'traffic cone', price: 0, kind: 'junk', line: 'A traffic cone. Nobody knows how they get into the water. Nobody asks.' },
  flipflop: { name: 'flip-flop', price: 0, kind: 'junk', line: 'One flip-flop. Somebody walked home lopsided.' },
  trolleywheel: { name: 'shopping trolley wheel', price: 0, kind: 'junk', line: 'A wheel off a shopping trolley. The rest of the trolley is still in there. It always is.' },
  soggybook: { name: 'soggy paperback', price: 0, kind: 'junk', line: 'A paperback, swollen to twice its size. A detective novel. You will never know who did it.' },
  // treasure: gear, so it keeps (and the pawn shop will take it)
  bottlemsg: { name: 'message in a bottle', price: 6, kind: 'gear', fished: true, line: 'A bottle with a rolled-up note in it. Q to read it.' },
  oldcoin: { name: 'old silver coin', price: 45, kind: 'gear', fished: true, line: 'Something glints on the hook: a silver coin, black with age. A king you don\'t recognise.' },
  goldring: { name: 'gold ring', price: 140, kind: 'gear', fished: true, line: 'A gold ring, caught round the hook. There is an inscription inside. It says "Again?"' },
  pearl: { name: 'pearl', price: 110, kind: 'gear', fished: true, line: 'An oyster, clamped shut. You prise it open. A pearl, a good one.' },
  compass: { name: 'brass compass', price: 40, kind: 'gear', fished: true, line: 'A brass compass, green with the sea. The needle still finds north.' },
  divewatch: { name: 'dive watch', price: 75, kind: 'gear', fished: true, line: 'A diver\'s watch. Still ticking. It is, to be fair, the one thing it was built for.' },
  pocketknife: { name: 'pocket knife', price: 18, kind: 'gear', fished: true, line: 'A folding knife with the gardens\' crest on it. A gardener is looking for this.' },
  wishcoins: { name: 'wishing coins', price: 0, kind: 'cash', line: 'A clump of coins, thrown in for luck by somebody else.' }, // (straight into your pocket)
});
// what bites where: [id, weight, 'night' | 'day' (only then)]
const WATERS = {
  sea: { name: 'the bay', fish: [['mackerel', 28], ['herring', 22], ['seabass', 12], ['flounder', 12], ['cod', 9], ['crab', 9], ['squid', 10, 'night'], ['conger', 6, 'night']],
    junk: [['oldboot', 3], ['tincan', 3], ['seaweed', 5], ['plasticbag', 3], ['flipflop', 2], ['tyre', 1]],
    treasure: [['bottlemsg', 5], ['oldcoin', 3], ['compass', 2], ['pearl', 1], ['goldring', 1], ['divewatch', 1]] },
  deep: { name: 'open water', fish: [['mackerel', 20], ['bluefish', 16], ['bream', 14], ['cod', 14], ['monkfish', 8], ['seabass', 10], ['squid', 8, 'night'], ['conger', 6, 'night'], ['tuna', 2.5]],
    junk: [['seaweed', 5], ['oldboot', 2], ['plasticbag', 2]],
    treasure: [['bottlemsg', 4], ['pearl', 2], ['oldcoin', 3], ['compass', 2], ['divewatch', 2], ['goldring', 1]] },
  marina: { name: 'the marina', fish: [['mullet', 30], ['herring', 18], ['crab', 18], ['mackerel', 12], ['conger', 6, 'night']],
    junk: [['tincan', 4], ['trafficcone', 3], ['flipflop', 3], ['oldboot', 3], ['plasticbag', 3], ['tyre', 2]],
    treasure: [['divewatch', 3], ['goldring', 2], ['compass', 2], ['bottlemsg', 1]] },
  pond: { name: 'the pond', fish: [['carp', 30], ['perch', 22], ['bluegill', 26], ['strayfish', 8], ['catfish', 10, 'night']],
    junk: [['trolleywheel', 4], ['soggybook', 3], ['tincan', 3], ['oldboot', 2], ['plasticbag', 2]],
    treasure: [['wishcoins', 6], ['goldring', 1]] },
  lake: { name: 'the gardens\' lake', fish: [['trout', 24], ['tench', 22], ['orfe', 22], ['perch', 16], ['pike', 7], ['catfish', 6, 'night'], ['goldkoi', 1.4]],
    junk: [['soggybook', 3], ['tincan', 2], ['oldboot', 2]],
    treasure: [['wishcoins', 4], ['pocketknife', 3], ['goldring', 1]] },
};
const CAST_MIN = 0.35, CAST_MAX = 1.9; // how far a cast goes (cells: 3.5m with no wind-up, 19m at full)
const ROD_Z = 0.22; // how high the rod tip is held (the eye's 0.17: screen.js)
const rodTipHeight = () => ROD_Z + (mode === 'walk' ? outdoorGroundHeight(px, py) : 0);
const FISH_DEEP = 9; // this far off the shore (cells) the bay counts as open water
const HUT_HOURS = [5, 20]; // (anglers get up early)
const hutOpen = (t = tod) => t >= HUT_HOURS[0] && t < HUT_HOURS[1];
let fishing = null; // the line, while it's out (see stepFishing)
const fishLog = { caught: 0, best: null }; // how many you've landed, and your heaviest fish { id, kg }
const fishSfx = []; // sounds for fishing-render.js to play: 'whoosh' | 'plop' | 'splash' | 'reel' | 'land'
const fishFx = []; // spray off the water { x, y, z, vx, vy, vz, life }
// where you can fish from: on foot, or sat still in a boat (yours, a rental, a swan), looking from your seat (picking
// the rod up out there swaps the chase view, V, for your seat)
const afloat = () => mode === 'sea' || mode === 'boat';
const fishingFrom = () => mode === 'walk' || afloat() && !third;
const boatSpeed = () => mode === 'sea' && sea ? Math.abs(sea.v) : mode === 'boat' && boat ? Math.abs(boat.v) : 0;
const heldRod = () => { const it = heldItem(); return it && ITEMS[it.id].rod ? it : null; };
// what water is at (x, y), if any: 'sea' | 'deep' | 'marina' | 'pond' | 'lake', 'ice' (a frozen pond), or null (dry land)
function waterKind(x, y) {
  if (onPier(x, y) || ROAD[idx(Math.floor(x), Math.floor(y))]&&!roadBridgeAt(x,y)) return null;
  if (gardenLake(x, y)) return 'lake';
  const bx = Math.floor(x / 8) & (NB - 1), by = Math.floor(y / 8) & (NB - 1);
  if (blockKind(bx, by) === 'park') return pondSD(mod(x, 8), mod(y, 8), bx, by) < -0.02 ? (seasonIdx() === 3 ? 'ice' : 'pond') : null;
  if (!seaAt(x, y)) return null;
  if (inMarina(x, y)) return 'marina';
  const m = worldCoord(y), off = worldReady ? -archipelagoEdge(x,y) : Math.min(worldCoord(m - shoreS(x)), worldCoord(shoreN(x) - m));
  return off >= FISH_DEEP ? 'deep' : 'sea';
}
// what's on the hook: fish mostly, some junk, now and then treasure (a better rod, and luck, tip it)
function rollCatch(water, rod, rnd = Math.random) {
  const W = WATERS[water], R = ITEMS[rod].rod, night_ = tod < 6 || tod >= 20;
  const pJunk = (water === 'marina' ? 0.2 : 0.1) * R.junk, pTreasure = (0.05 + luck() * 0.3) * R.treasure;
  const r = rnd(), cat = r < pTreasure ? 'treasure' : r < pTreasure + pJunk ? 'junk' : 'fish';
  const list = W[cat].filter(([, , when]) => !when || (when === 'night') === night_);
  let s = rnd() * list.reduce((t, e) => t + e[1], 0), id = list[0][0];
  for (const [k, w] of list) if ((s -= w) < 0) { id = k; break; }
  const kg = ITEMS[id].kg;
  return kg ? { id, kg: Math.round((kg[0] + (kg[1] - kg[0]) * rnd() ** 2) * 10) / 10 } : { id }; // (small ones are commoner)
}
// what the hut gives for a catch: a fish by its weight, junk for nothing (they bin it), treasure at the pawn shop's rate
function catchPrice(it) {
  const d = ITEMS[it.id];
  if (d.kind === 'fish') { const mid = (d.kg[0] + d.kg[1]) / 2; return Math.max(0.25, Math.round(d.price * (it.kg || mid) / mid * 4) / 4); }
  return d.fished ? Math.max(0.25, Math.round(d.price * 0.4 * 4) / 4) : 0;
}
// the sushi bars buy sea fish too (not the ponds' or the lake's), and pay better than the hut
for (const id of ['mackerel', 'herring', 'seabass', 'flounder', 'cod', 'crab', 'squid', 'conger', 'bream', 'bluefish', 'monkfish', 'tuna', 'mullet']) ITEMS[id].salt = true;
const SUSHI_PAYS = 1.4;
const sushiPrice = it => ITEMS[it.id].salt ? Math.round(catchPrice(it) * SUSHI_PAYS * 4) / 4 : 0;
const catchName = it => it.kg ? `${it.kg}kg ${ITEMS[it.id].name}` : ITEMS[it.id].name;
// how long till something comes for it: quicker in the rain and round dawn and dusk, with a good rod
const biteWait = (rod, rnd = Math.random) => (5 + rnd() * 13) * ITEMS[rod].rod.wait * (rain > 0.3 ? 0.7 : 1) * (tod >= 5 && tod < 8 || tod >= 18 && tod < 21 ? 0.75 : 1);

// Q with a rod in your hand: start winding up; or, with the line out, strike (or reel in)
function rodUse(near) {
  const it = heldRod();
  if (near.indoors) return ['Not in here.', null];
  if (afloat() && boatSpeed() > 0.12 && !fishing) return ['Not while she\'s moving. Ease off and let her drift.', null];
  if (afloat() && third) { third = false; return ['You settle in over the side with the rod. (V: the view from behind again, and the line comes in)', null]; }
  if (!fishingFrom()) return ['Not from up here.', null];
  if (fx.skating) return ['Not while you\'re on the board.', null];
  const f = fishing;
  if (!f) { fishing = { st: 'wind', t: 0, power: 0, rod: it.id }; return ['', null]; }
  if (f.st === 'bite') { // got it
    f.catch = rollCatch(f.water, f.rod); reelIn();
    return [pick(['Fish on!', 'Got it!', 'Something\'s on!']), 'reel'];
  }
  if (f.st === 'lure') { reelIn(); return ['Too soon. Whatever it was bolts.', 'reel']; }
  if (f.st === 'wait' || f.st === 'land') { reelIn(); return ['', 'reel']; }
  return ['', null];
}
function reelIn() {
  const f = fishing;
  Object.assign(f, { st: 'reel', t: 0, sx: f.x, sy: f.y, sz: f.z, dur: 0.45 + Math.hypot(rel(f.x - px), rel(f.y - py)) * 0.35 + (f.catch && f.catch.kg ? Math.min(1.2, f.catch.kg * 0.05) : 0) });
}
// let go of Q: the cast, off the rod tip out in front of you and arcing down, stopped short by a wall
function castLine() {
  const f = fishing, d = CAST_MIN + f.power * (CAST_MAX - CAST_MIN), ca = Math.cos(a), sa = Math.sin(a);
  let reach = d;
  for (let s = 0.1; s <= d; s += 0.05) if (map[idx(Math.floor(px + ca * s), Math.floor(py + sa * s))] > 0) { reach = Math.max(0.1, s - 0.08); break; }
  f.competitionDay=fishingCompetitionActive()?fishCompetition.round.day:null;
  Object.assign(f, { st: 'fly', t: 0, d: reach, dur: 0.3 + reach * 0.2, ox: px + ca * 0.06, oy: py + sa * 0.06, oz: rodTipHeight(),
    tx: px + ca * reach, ty: py + sa * reach, x: px, y: py, z: rodTipHeight() });
  fishSfx.push('whoosh');
}
function splash(x, y, n, up) {
  for (let k = 0; k < n; k++) { const an = Math.random() * TAU, s = 0.02 + Math.random() * 0.06; fishFx.push({ x, y, z: 0.002, vx: Math.cos(an) * s, vy: Math.sin(an) * s, vz: up * (0.5 + Math.random() * 0.6), life: 1 }); }
}
// every frame: the line's state, and the spray off the water
function stepFishing(dt, rnd = Math.random) {
  for (let k = fishFx.length - 1; k >= 0; k--) {
    const p = fishFx[k]; p.vz -= 1.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt * 1.5;
    if (p.z < 0 || p.life <= 0) fishFx.splice(k, 1);
  }
  const f = fishing;
  if (!f) return;
  if (!heldRod() || heldRod().id !== f.rod || !fishingFrom() || fx.skating) { fishing = null; return; } // (put it away: the line comes in with it)
  f.t += dt;
  const out = f.st === 'wait' || f.st === 'lure' || f.st === 'bite' || f.st === 'land';
  if (out && boatSpeed() > 0.3) { f.catch = null; reelIn(); say('You\'d be trolling. You wind the line in.', 2); fishSfx.push('reel'); return; } // (under way)
  if (out && Math.hypot(rel(f.x - px), rel(f.y - py)) > f.d + 0.5) { f.catch = null; reelIn(); say('The line pulls tight, and you reel it in.', 2); fishSfx.push('reel'); return; }
  if (f.st === 'wind') { // Q held: winding up. Let go to cast
    f.power = Math.min(1, f.t / 1.1);
    if (!usingHeldItem()) castLine();
  } else if (f.st === 'fly') {
    const q = Math.min(1, f.t / f.dur), arc = 0.06 + f.d * 0.09;
    f.x = worldCoord(f.ox + rel(f.tx - f.ox) * q); f.y = worldCoord(f.oy + rel(f.ty - f.oy) * q); f.z = f.oz * (1 - q) + terrainHeight(f.tx, f.ty) * q + arc * 4 * q * (1 - q);
    if (q >= 1) {
      f.water = waterKind(f.x, f.y); f.z = terrainHeight(f.x, f.y); f.t = 0;
      if (f.water && f.water !== 'ice') { f.st = 'wait'; f.next = biteWait(f.rod, rnd); splash(f.x, f.y, 6, 0.25); fishSfx.push('plop'); f.ring = T; }
      else {
        f.st = 'land';
        say(f.water === 'ice' ? 'The bobber skitters across the ice. The pond is frozen solid.' : pick(['It lands on dry ground. Nothing is biting there.', 'Not even close to the water.', 'You catch some ground. It does not fight.']), 2.5);
      }
    }
  } else if (f.st === 'wait') { // bobbing: then something comes for it, from somewhere off to one side
    if (f.t >= f.next) Object.assign(f, { st: 'lure', t: 0, dur: 1.2 + rnd() * 1.3, from: rnd() * TAU });
  } else if (f.st === 'lure') {
    if (f.t >= f.dur) { Object.assign(f, { st: 'bite', t: 0 }); splash(f.x, f.y, 18, 0.5); fishSfx.push('splash'); f.ring = T; }
  } else if (f.st === 'bite') { // pulled under: a moment to strike
    if (f.t >= ITEMS[f.rod].rod.window) { Object.assign(f, { st: 'wait', t: 0, next: biteWait(f.rod, rnd) * 0.5 }); say(pick(['It got away.', 'Missed it.', 'Gone. It took the bait with it, in spirit.']), 1.5); f.ring = T; }
  } else if (f.st === 'reel') { // in it comes, skipping over the water, the catch swinging up out of it at the end
    const q = Math.min(1, f.t / f.dur), ex = px + Math.cos(a) * 0.12, ey = py + Math.sin(a) * 0.12;
    f.x = worldCoord(f.sx + rel(ex - f.sx) * q); f.y = worldCoord(f.sy + rel(ey - f.sy) * q);
    f.z = q < 0.65 ? f.sz * (1 - q / 0.65) : (q - 0.65) / 0.35 * (rodTipHeight() - 0.07);
    if (q > 0.05 && q < 0.65 && f.catch && rnd() < dt * 12) splash(f.x, f.y, 1, 0.2); // (thrashing as it comes)
    if (q >= 1) { if (f.catch) landCatch(f); else fishing = null; }
  } else if (f.st === 'landed') { if (f.t > 1.6) fishing = null; }
}
// out of the water and into your bag
function landCatch(f) {
  const c = f.catch, d = ITEMS[c.id];
  Object.assign(f, { st: 'landed', t: 0 });
  fishSfx.push('land');
  const competitionBest=recordFishingCompetitionCatch(f);
  if (d.kind === 'cash') { const amt = Math.round((0.5 + Math.random() * 3.5) * 4) / 4; earn(amt); return say(`${d.line} ${fmt$(amt)} in all.`, 4); }
  if (inv.length >= INV_SIZE) return say(`${d.kind === 'fish' ? `A ${catchName(c)}` : cap(d.name)}. Your bag's full, so back it goes.${competitionBest}`, 3);
  carryItem(c.kg ? { id: c.id, uses: 0, kg: c.kg } : { id: c.id, uses: 0 }, false);
  if (d.kind === 'fish') {
    fishLog.caught++;
    const best = !fishLog.best || c.kg > fishLog.best.kg;
    if (best) fishLog.best = { id: c.id, kg: c.kg };
    if (c.kg >= 10) newsEvent('bigfish', px, py, { fish: d.name, kg: c.kg });
    return say(`A ${catchName(c)}.${best && fishLog.caught > 1 ? ' Your biggest yet.' : ''}${competitionBest}`, 3);
  }
  if (d.kind === 'wish') return say(`A golden koi, ${c.kg}kg, shining like a coin. It looks at you as if it's expecting something. (Q: make a wish)`, 5);
  return say(d.line, Math.max(3, d.line.length / 20));
}
// the golden koi in your hand: Q, and a wish, and back it goes. Something small, and right away
const KOI_WISHES = [
  ['heal', () => needs.health < maxHealth() - 1, () => { needs.health = maxHealth(); return 'Every ache you had is gone.'; }],
  ['cash', () => true, () => { const amt = 25 * (2 + Math.floor(Math.random() * 7)); earn(amt); return `There is ${fmt$(amt)} in your pocket that was not there before.`; }],
  ['clear', () => weather !== 'clear', () => { weather = 'clear'; wTimer = 600; return 'The clouds pull apart. The sun comes out to see.'; }],
];
function koiWish() {
  const w = pick(KOI_WISHES.filter(([, ok]) => ok()));
  removeHeld();
  return [`You close your eyes and wish. When you open them the koi gives one flick of its tail and is gone. ${w[2]()}`, 'chime'];
}
// a message in a bottle: somebody's
const BOTTLE_NOTES = ['"If you are reading this, I have moved. The new address is enclosed." Nothing else is enclosed.',
  '"Day 4. Still on the island. The lighthouse keeper says the footbridge is right there. I am choosing not to look."',
  '"Whoever finds this: the stock tip is PIER. Buy." It is not dated.', '"Please return this bottle. It was my good bottle."',
  '"I threw my phone in after this. Do not look for it."', '"Hello from 1987. Are the trains on time yet."'];
const readBottle = () => [pick(BOTTLE_NOTES), 'page'];
// the hut: standing at its hatch on the promenade side
const nearHut = () => mode === 'walk' && Math.abs(rel(px - FISH_HUT.x - FISH_HUT.hatch)) < 0.2 && rel(FISH_HUT.y - FISH_HUT.hw - py) > 0 && rel(FISH_HUT.y - FISH_HUT.hw - py) < 0.4;
function hutPrompt() {
  if (!hutOpen() && (fishingCompetitionOpen() || fishCompetition.round)) return 'E: Friday Fish-off (entry, standings & results)';
  if (!hutOpen()) return 'BAIT & TACKLE: shut. Open 5am till 8pm.';
  return `E: bait & tackle (rods, and they buy your catch)${fishingCompetitionOpen()?'   Friday Fish-off: entries open':''}${fishLog.best ? `   your best: ${catchName(fishLog.best)}` : ''}`;
}

// ---- the regulars: a few anglers out at the ends of the piers, along the Lighthouse Walk, at a park pond and on the
// Gardens' lake shore, rods out (fishing-render.js draws them, and now and then one of them lands something). Talk to
// one and you get a tip. { x, y, a: the way they face, cast: how far out their bobber sits, seed, shirt }
const ANGLERS = [];
{
  const add = (x, y, a, cast = 0.6) => { const k = ANGLERS.length; ANGLERS.push({ x: worldCoord(x), y: worldCoord(y), a, cast, seed: k, shirt: [BLUE, GREEN, BRICK, GRAY, RED, YEL, CYAN][k % 7] }); };
  add(FAIR.x0 + 0.14, FAIR.y1 - 0.7, Math.PI); // the Sunset Pier's end, over each side and off the end
  add(FAIR.x1 - 0.14, FAIR.y1 - 1.1, 0);
  add(FAIR.cx + 1.6, FAIR.y1 - 0.14, Math.PI / 2, 0.8);
  add(MARINA.x + 0.75, MARINA.end - 0.06, Math.PI / 2); // the end of the marina's T
  let south = 0, north = 0;
  for (const p of PIERS) { // the narrow piers: one at the end of a couple on each shore
    if (p.marina || p[2] - p[0] > 1 || p[0] === FAIR.x0) continue;
    const far = p[3] > N; // (the north shore's run out north, over the wrap)
    if (far ? north++ >= 2 : south++ >= 2) continue;
    add((p[0] + p[2]) / 2 + 0.15, far ? p[1] + 0.14 : p[3] - 0.14, far ? -Math.PI / 2 : Math.PI / 2, 0.7);
  }
  add(FOOTBRIDGE.x + FOOTBRIDGE.hw - 0.05, (FOOTBRIDGE.y0 + FOOTBRIDGE.y1) / 2, 0, 0.7); // halfway along the Lighthouse Walk, over the rail
  pond: for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { // the first park's pond: on its west bank, facing in
    if (blockKind(bx, by) !== 'park') continue;
    for (let lx = POND[0] - 2; lx < POND[0]; lx += 0.02) if (pondSD(lx, POND[1], bx, by) < 0.12) { add(bx * 8 + lx, by * 8 + POND[1], 0, 0.45); break pond; }
  }
  for (let gx = LAKE.x - LAKE.rx * 1.5; gx < LAKE.x; gx += 0.02) if (gardenLakeEdge(gx, LAKE.y + 0.6) > -0.12) { const [x, y] = gx2w(gx, LAKE.y + 0.6); add(x, y, 0, 0.6); break; } // the lake's west shore
}
for (const o of ANGLERS) { const ca = Math.cos(o.a), sa = Math.sin(o.a); while (o.cast > 0.2 && !waterKind(o.x + ca * o.cast, o.y + sa * o.cast)) o.cast -= 0.05; } // (their bobbers on the water)
const ANGLER_TIPS = ['"Squid come in after dark. They like the lights."', '"Pond\'s all carp. The sushi place won\'t touch carp. Sea fish only."',
  '"Sushi bars pay better than the hut. For the right fish."', '"Get the carbon rod. They bite quicker, and you\'ve longer to strike."',
  '"Strike when it goes under. Not before. Everybody strikes before."', '"There\'s a golden koi in the Gardens\' lake. I\'ve seen it twice. Nobody believes me."',
  '"Out past the end of the long piers, that\'s where the big ones are."', '"Rain\'s good. The fish don\'t mind rain."', '"Dawn and dusk. That\'s when they bite."',
  '"Caught a boot once. Then the other boot. Different years."', '"You can fish off a boat, you know. Have to sit still, mind."', '"Catfish. Nights, in the ponds. Ugly things. Good eating."'];
// standing by one (a little closer than you'd stand to a stranger), and their line on the go
const nearAngler = () => mode === 'walk' ? ANGLERS.find(o => Math.hypot(rel(o.x - px), rel(o.y - py)) < 0.32) || null : null;
// where one's at in their own slow round: most of the time waiting, then a bite and a fish reeled up (0..1 through it),
// every minute or two
function anglerPhase(o, t = T) {
  const P = 50 + hash(o.seed, 3, 1621) * 60, q = fract((t + hash(o.seed, 4, 1621) * 300) / P), land = 4 / P;
  return q < 1 - land ? { st: 'wait' } : { st: 'catch', k: (q - (1 - land)) / land };
}
