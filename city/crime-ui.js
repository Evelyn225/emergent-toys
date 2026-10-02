// ===== crime on screen and at the keys: the wanted stars, getting busted (a fine, or jail), and the crimes you do on
// purpose: G picks a pocket (on the street, from behind) or shoplifts (in a shop with someone behind the counter),
// L picks the lock of a shop that's shut for the night. The rules are in crime.js, the minigames in minigames.js.

// ---- the stars, top middle: red and blue while they can see you, grey while you're hiding (and how long to go)
function wantedHud() {
  const pend = reports.length && !wanted.stars;
  if (!wanted.stars && !pend) return;
  const s = Math.max(16, Math.round(cv.height / 34)), y = 44;
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, stars = [1, 2, 3].map(k => k <= wanted.stars ? '*' : '.').join(' ');
  const line = pend ? "someone's calling the police..." : `WANTED  ${stars}`, x = cv.width / 2 - line.length * w / 2;
  const flash = fract(T * 3) < 0.5, hue = wanted.seen ? (flash ? RED : BLUE) : flash ? WHITE : GRAY;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w, y - s * 0.15, (line.length + 2) * w, s * 1.3);
  artText([line], x, y, s, (c, r, k) => pend ? C(GRAY, 12) : c === '.' ? C(GRAY, 7) : C(hue, 15)); // flashing: you can't miss it
  if (!pend && !wanted.seen) {
    const left = Math.max(0, ESCAPE_T[wanted.stars] - wanted.hideT), sub = `out of sight: losing them in ${Math.ceil(left)}s`;
    g.font = FS + 'px monospace';
    const sw = g.measureText(sub).width;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cv.width / 2 - sw / 2 - 6, y + s + 4, sw + 12, FS + 6);
    g.fillStyle = PAL[C(GRAY, 13)]; g.fillText(sub, cv.width / 2 - sw / 2, y + s + 7);
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
function outOfCar() { // they take you out of whatever you were driving
  if (!me) return;
  const c = me;
  if (mode === 'drive') { c.player = false; c.v = 0; toLane(c); }
  else { c.rider = c.dest = c.arrived = c.rush = false; plan(c); }
  me = null; mode = 'walk';
}
function bustedChoice(how) {
  const f = fineFor(wanted.stars);
  if (how === 'fine' && !payFine()) return;
  hidePanel(bustedEl); endTaxiShift(); outOfCar();
  if (how === 'fine') return say(`You pay the ${fmt$(f)} fine. "Don't let me see you again."`, 4);
  const [st] = SERVICES.filter(b => b.kind === 'police').map(b => [b, Math.hypot(rel(b.x - px), rel(b.y - py))]).reduce((m, b) => b[1] < m[1] ? b : m, [null, Infinity]);
  goToJail();
  enterRoom('jail', { word: 'JAIL', ret: [st.x + 0.6, st.by * 8 + 1.9, Math.PI / 2], until: T + JAIL_T }, [2.5, 2.4, Math.PI / 2]);
  say('The cell door slams. Everything you were carrying is in an evidence bag.', 5);
}

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
      if (Math.random() < 0.25 && inv.length < INV_SIZE) { const id = pick(LIFTS); inv.push({ id, uses: ITEMS[id].uses || 0 }); return say(`You lift ${aOrSome(ITEMS[id].name)}. They walk on.`, 3); }
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
      if (inv.length >= INV_SIZE) return say("You've nowhere to put it.");
      const id = pick(stockFor(room.kind, room.word)); inv.push({ id, uses: ITEMS[id].uses || 0 }); held = inv.length - 1;
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
// in a shop you've broken into: E at the counter empties the till, G takes something off the shelves
function emptyTill() {
  if (room.tillTaken) return say('The till\'s empty.');
  room.tillTaken = true; const c = Math.round((10 + Math.random() * 35) * 4) / 4; earn(c);
  return say(`You empty the till: ${fmt$(c)}.`, 3);
}
function grabStock() {
  const stock = stockFor(room.kind, room.word);
  if (!stock.length) return say('Nothing worth taking.');
  if (room.loot >= 4) return say("You've cleaned the place out.");
  if (inv.length >= INV_SIZE) return say('Your hands are full.');
  const id = pick(stock); inv.push({ id, uses: ITEMS[id].uses || 0 }); held = inv.length - 1; room.loot++;
  say(`You take ${aOrSome(ITEMS[id].name)}.`, 2);
}
// G and L
function crimeKey(code) {
  if (code === 'KeyG') {
    if (mode === 'room' && room.burgled) return grabStock();
    if (canShoplift()) return shoplift();
    const p = pickTarget();
    if (p) return pickpocket(p);
  }
  if (code === 'KeyL') { const sh = lockTarget(); if (sh) return pickLock(sh); }
}
// what G / L would do here, for the prompt line
function crimePrompt() {
  if (mode === 'room' && room.burgled) return 'G: take something   E (at the counter): the till';
  if (pickTarget()) return 'G: pick their pocket';
  const sh = lockTarget();
  if (sh && nightTime()) return (jammed.get(sh) || 0) > T ? "The lock's jammed." : `${sh.word}: closed   L: pick the lock`;
  return '';
}
