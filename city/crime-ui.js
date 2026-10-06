// ===== crime on screen and at the keys: the wanted stars, getting busted (a fine, or jail), and the crimes you do on
// purpose: G picks a pocket (on the street, from behind) or shoplifts (in a shop with someone behind the counter),
// L picks the lock of a shop that's shut for the night. The rules are in crime.js, the minigames in minigames.js.

// ---- the stars, top middle: red and blue while they can see you, grey while you're hiding (and how long to go)
// On a phone: smaller, down the left under the text block, clear of the buttons and the map, and shrunk to fit
let wantedBottom = 0; // where it ends (px), so the message line goes under it
function wantedHud() {
  wantedBottom = 0;
  const pend = reports.length && !wanted.stars;
  if (!wanted.stars && !pend) return;
  const stars = [1, 2, 3].map(k => k <= wanted.stars ? '*' : '.').join(' ');
  const line = pend ? "someone's calling the police..." : `WANTED  ${stars}`, phone = TOUCH || cv.width < 700;
  const room_ = phone ? cv.width * (showMap && mode !== 'room' && cv.width < cv.height ? 0.5 : 0.9) : cv.width;
  let s = phone ? clamp(Math.round(cv.height / 48), 11, 18) : Math.max(16, Math.round(cv.height / 34));
  g.font = s + 'px monospace';
  const fit = room_ / ((line.length + 2) * g.measureText('M').width);
  if (fit < 1) { s = Math.max(8, Math.floor(s * fit)); g.font = s + 'px monospace'; }
  const w = g.measureText('M').width, y = phone ? Math.max(52, hudBottom + 6) : 44, x = phone ? w + 6 : cv.width / 2 - line.length * w / 2;
  const flash = fract(T * 3) < 0.5, hue = wanted.seen ? (flash ? RED : BLUE) : flash ? WHITE : GRAY;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w, y - s * 0.15, (line.length + 2) * w, s * 1.3);
  artText([line], x, y, s, (c, r, k) => pend ? C(GRAY, 12) : c === '.' ? C(GRAY, 7) : C(hue, 15)); // flashing: you can't miss it
  wantedBottom = y + s * 1.2;
  if (!pend && !wanted.seen) {
    const left = Math.max(0, ESCAPE_T[wanted.stars] - wanted.hideT), sub = `out of sight: losing them in ${Math.ceil(left)}s`, fs = phone ? Math.min(FS, Math.max(9, s - 2)) : FS;
    g.font = fs + 'px monospace';
    const sw = g.measureText(sub).width, sx = phone ? x - w + 6 : cv.width / 2 - sw / 2;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(sx - 6, y + s + 4, sw + 12, fs + 6);
    g.fillStyle = PAL[C(GRAY, 13)]; g.fillText(sub, sx, y + s + 7);
    wantedBottom = y + s + fs + 12;
  }
  g.font = FS + 'px monospace';
}

// ---- busted: pay the fine, or go to jail
let bustedEl = null, finePaid = 0;
function openBusted() {
  if (bustedEl && bustedEl.style.display === 'flex') return;
  if (actx) tickSirens(mode === 'room'); // the sirens cut out (they'd hang on one note while this is up)
  bustedEl = bustedEl || panel('busted');
  const f = fineFor(wanted.stars), can = money >= f;
  showPanel(bustedEl, `<h1>Busted</h1><p class="sub">${wanted.crime || 'trouble'} &middot; ${'*'.repeat(wanted.stars)}</p>
    <button class="item" data-fine ${can ? '' : 'disabled'}><span class="k">1</span><span>Pay the fine</span><span class="lead"></span><span class="v">${fmt$(f)}</span></button>
    <button class="item" data-jail><span class="k">2</span><span>Go to jail</span><span class="lead"></span><span class="v">${JAIL_T}s, lose what you carry</span></button>
    <p class="hint">${can ? '' : "You can't cover the fine. "}1 / 2 choose</p>`);
  bustedEl.onclick = e => { if (e.target.closest('[data-fine]')) bustedChoice('fine'); else if (e.target.closest('[data-jail]')) bustedChoice('jail'); };
}
function bustedKey(e) { // nothing else while they've got you: not even Esc
  if (!bustedEl || bustedEl.style.display !== 'flex') return false;
  if (!e.repeat && e.code === 'Digit1') bustedChoice('fine');
  if (!e.repeat && e.code === 'Digit2') bustedChoice('jail');
  return true;
}
function outOfCar(keepCar = false) { // paying a fine leaves the car parked where they stopped you
  if (!me) return;
  const c = me;
  if (mode === 'drive') {
    c.player = false; c.v = 0;
    if (keepCar) { [px, py] = exitSpot(c); c.parked = true; c.off = 0; c.ex = c.x; c.ey = c.y; }
    else toLane(c);
  }
  else { c.rider = c.dest = c.arrived = c.rush = false; plan(c); }
  me = null; mode = 'walk';
}
function bustedChoice(how) {
  const f = fineFor(wanted.stars);
  if (how === 'fine' && !payFine()) return;
  hidePanel(bustedEl); endTaxiShift(); outOfCar(how === 'fine');
  if (how === 'fine') return say(`You pay the ${fmt$(f)} fine. "Don't let me see you again."`, 4);
  const [st] = SERVICES.filter(b => b.kind === 'police').map(b => [b, Math.hypot(rel(b.x - px), rel(b.y - py))]).reduce((m, b) => b[1] < m[1] ? b : m, [null, Infinity]);
  goToJail();
  enterRoom('jail', { word: 'JAIL', ret: [st.x + 0.6, st.by * 8 + 1.9, Math.PI / 2], until: T + JAIL_T }, [11, 3.2, Math.PI / 2]); // facing the bars
  say('The cell door slams. Everything you were carrying is in an evidence bag.', 5);
}

// the cab you paid to step on it gets pulled over, and the officer runs your face too: you're both arrested, and you
// share a cell. He has some things to say about that
function jailWithCabbie() {
  const c = me, ret = [c.x, c.y];
  hidePanel(bustedEl); endTaxiShift(); outOfCar(); c.v = 0; c.stopT = T + 25;
  const [st] = SERVICES.filter(b => b.kind === 'police').map(b => [b, Math.hypot(rel(b.x - ret[0]), rel(b.y - ret[1]))]).reduce((m, b) => b[1] < m[1] ? b : m, [null, Infinity]);
  goToJail();
  enterRoom('jail', { word: 'JAIL', ret: [st.x + 0.6, st.by * 8 + 1.9, Math.PI / 2], until: T + JAIL_T, cabbie: true }, [11, 3.2, Math.PI / 2]);
  say('The cruiser boxes the cab in. The officer runs the driver\'s licence, then takes one look at you in the back. "Well, well." You both ride to the station in the same back seat. He doesn\'t say a word the whole way.', 7);
}
const CABBIE_LINES = ['Twenty bucks to step on it, you said. TWENTY BUCKS.', 'Nineteen years I\'ve driven this city. Clean record. Then you get in.', 'Don\'t talk to me.', 'You were WANTED? And you didn\'t think to mention that?', 'My wife\'s gonna kill me. Then she\'s gonna come for you.',
  'When we get out of here, you\'re walking. Everywhere. Forever.', 'I want you to know the meter was still running.', '...', 'Don\'t sit on my bunk.', 'You owe me a cab. And a lawyer.'];
let cabbieLast = -1;
function talkToCabbie() {
  let k = Math.random() * CABBIE_LINES.length | 0; if (k === cabbieLast) k = (k + 1) % CABBIE_LINES.length; cabbieLast = k;
  return say(`Your cab driver: "${CABBIE_LINES[k]}"`, 4);
}
const nearCabbie = () => { const w = roomPerson(); return w && w.cabbie ? w : null; };

// ---- the crime minigames: they take the screen like the arcade, then hand back success, failure or 'abort'
function startCrime(id, done) { startGame(id, 'crime'); game.onDone = done; }

// pickpocketing: someone on the sidewalk, close, and you're behind them
function pickTarget() {
  if (mode !== 'walk') return null;
  for (const p of people) {
    if (p.hidden || p.follow || p.hailing) continue;
    const ex = rel(px - p.x), ey = rel(py - p.y), d = Math.hypot(ex, ey);
    if (d > 0.3) continue;
    const [lx, ly] = p.last || [0, 0];
    if (lx * ex + ly * ey < 0 || !(lx || ly)) return p; // behind them (or they're standing still)
  }
  return null;
}
const LIFTS = ['cigarettes', 'candy', 'newspaper', 'apple', 'yoyo', 'chips'];
function pickpocket(p) {
  p.talk = 1e9; // they stand there, none the wiser (yet)
  startCrime('pickpocket', ok => {
    p.talk = 0;
    if (ok === 'abort') return;
    if (ok) {
      if (Math.random() < 0.25 && inv.length < INV_SIZE) { const id = pick(LIFTS); carryItem({ id, uses: ITEMS[id].uses || 0 }, false); return say(`You lift ${aOrSome(ITEMS[id].name)}. They walk on.`, 3); }
      const c = Math.round((2 + Math.random() * 20) * 4) / 4; earn(c); return say(`You lift ${fmt$(c)} from their pocket. They walk on.`, 3);
    }
    p.talk = 3; say(pick(['"HEY! THIEF!"', '"Get your hand out of my pocket!"', '"Somebody call the cops!"']), 3);
    crime('pickpocket', p.x, p.y);
  });
}
// shoplifting: in a shop with its clerk at the counter and something on sale
const canShoplift = () => mode === 'room' && !room.burgled && room.def.keeper && stockFor(room.kind, room.word).length && !room.caught;
function shoplift() {
  startCrime('shoplift', ok => {
    if (ok === 'abort') return;
    if (ok) {
      if (inv.length >= INV_SIZE) return say("Your bag is full.");
      const id = pick(stockFor(room.kind, room.word)); carryItem({ id, uses: ITEMS[id].uses || 0 });
      return say(`You slip ${aOrSome(ITEMS[id].name)} into your coat.`, 3);
    }
    room.caught = true; say('"HEY! Put that back! I\'m calling the police."', 4);
    crime('shoplift');
  });
}
// lockpicking: a shop that's shut, at night (not an apartment door, a vacant unit or a police station)
const nightTime = () => tod >= 21 || tod < 5;
function lockTarget() {
  if (mode !== 'walk' || !lookHit || lookHit.d > 0.35) return null;
  const sh = SHOP[idx(lookHit.mx, lookHit.my)];
  return sh && !sh.base && sh.kind !== SHOP_APTS && sh.kind !== SHOP_SHUT && !openAt(sh, tod) ? sh : null;
}
function pickLock(sh) {
  if (!nightTime()) return say('Not in broad daylight.');
  if ((jammed.get(sh) || 0) > T) return say("The lock's jammed. Give it a few hours.");
  const cell = [lookHit.mx, lookHit.my], ret = [px, py, a];
  startCrime('lockpick', ok => {
    if (ok === 'abort') return;
    if (!ok) { jammed.set(sh, T + 120); return say('The pick snaps in the lock. It\'s jammed now.', 3); }
    if (crime('burglary') !== 'cop') { /* (somebody may have seen you go in: crime() queues their call) */ }
    const kind = sh.kind === SHOP_APTS ? 'apts' : ROOM_FOR[sh.word] || 'store';
    enterRoom(kind, { ...sh, cell, ret, line: '', burgled: true, light: 0.28, loot: 0 }, [0, 0, -Math.PI / 2]);
    px = room.W / 2; py = room.H - 1.6;
    room.props = room.props.filter(p => p.art !== ART.keeper && p.art !== ART.sitter && p.art !== ART.sitterBack); // nobody here
    if (Math.random() < 0.35) { reports.push({ t: T + 12, x: ret[0], y: ret[1], kind: 'burglary' }); say('The lock gives. A little red light blinks by the door...', 4); }
    else say('The lock gives. Inside, it\'s dark and quiet.', 3);
  });
}
// in a shop you've broken into: E at the counter empties the till (a night's takings: a lot), G takes something off the
// shelves. Touch the money and the alarm goes: the police are on their way at once (a bank: all of them). In a bank
// there's the vault too, on the right-hand wall: crack it (the lockpick game) for a fortune
const nearVault = () => mode === 'room' && room.burgled && (room.kind === 'bank' && px > room.W - 2.4 && Math.abs(py - room.H / 2) < 1.4
  || room.kind === 'casino' && Math.hypot(px - 11, py - 3.2) < 1.6); // (the casino's: the cashier's cage, full of the night's takings)
function raiseAlarm(bank) {
  if (room.alarm) return;
  room.alarm = true;
  addWanted(bank ? 'bankjob' : 'alarm', room.ret[0], room.ret[1], true); // (they head for the door you came in by)
  if (actx) { const at = actx.currentTime; for (let k = 0; k < 24; k++) tone(at + k * 0.11, k & 1 ? 1800 : 2400, 0.09, 0.05, 'square'); } // the bell
}
function emptyTill() {
  if (room.tillTaken) return say('The till\'s empty.');
  room.tillTaken = true;
  const bank = room.kind === 'bank', c = Math.round((bank ? 300 + Math.random() * 300 : 120 + Math.random() * 200) * 4) / 4;
  earn(c); raiseAlarm(bank);
  return say(`You empty the till: ${fmt$(c)}. An alarm starts shrieking. The police are on their way: get out!`, 4);
}
function crackVault() {
  if (room.vaultTaken) return say('The vault\'s empty. You took it all.');
  startCrime('lockpick', ok => {
    if (ok === 'abort') return;
    raiseAlarm(true);
    if (!ok) return say('The dial won\'t give, and every alarm in the building goes off. RUN.', 4);
    room.vaultTaken = true;
    const casino = room.kind === 'casino', c = Math.round(((casino ? 1500 : 1000) + Math.random() * (casino ? 2500 : 1500)) / 10) * 10; earn(c);
    if (casino) return say(`The cage's safe swings open: the night's takings. You stuff ${fmt$(c)} into your bag. Alarms everywhere: every cop in town is coming!`, 5);
    say(`The vault door swings open. You stuff ${fmt$(c)} into your bag. Alarms everywhere: every cop in town is coming!`, 5);
  });
}
function grabStock() {
  const stock = stockFor(room.kind, room.word);
  if (!stock.length) return say('Nothing worth taking.');
  if (room.loot >= 4) return say("You've cleaned the place out.");
  if (inv.length >= INV_SIZE) return say('Your bag is full.');
  const id = pick(stock); carryItem({ id, uses: ITEMS[id].uses || 0 }); room.loot++;
  say(`You take ${aOrSome(ITEMS[id].name)}.`, 2);
}
// G and L
function crimeKey(code) {
  if (code === 'KeyG') {
    if (mode === 'room' && room.kind === 'grandhotelheist') return hotelHeistPaintingNear() ? stealHotelPainting() : say('The framed masterpiece is on the far wall.');
    if (mode === 'room' && room.burgled) return grabStock();
    if (canShoplift()) return shoplift();
    const p = pickTarget();
    if (p) return pickpocket(p);
  }
  if (code === 'KeyL') { if (stealBoat()) return; const sh = lockTarget(); if (sh) return pickLock(sh); }
}
// what G / L would do here, for the prompt line
function crimePrompt() {
  if (mode === 'room' && room.kind === 'grandhotelheist') return grandHotelPrompt();
  if (mode === 'room' && room.burgled && room.kind === 'museum') return museumPrompt() + (nearExit() ? '   E: leave' : '');
  if (mode === 'room' && room.burgled) return (room.alarm ? 'ALARM! Get out!   ' : '') + 'G: take something' + (nearVault() ? '   E: crack the vault' : nearKeeper() ? '   E: the till' : nearExit() ? '   E: leave' : ''); // (E only does something at the counter, the vault or the door)
  const vm = nearMachine(), use = vm ? `E: ${VENDING[vm.kind].title.toLowerCase()}   ` : ''; // (a machine right here still works: say so)
  if (pickTarget()) return use + 'G: pick their pocket';
  const sh = lockTarget();
  if (!sh || !nightTime()) return '';
  return use + ((jammed.get(sh) || 0) > T ? "The lock's jammed." : `${sh.word}: closed   L: pick the lock`);
}
