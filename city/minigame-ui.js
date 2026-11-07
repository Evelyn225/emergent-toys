// ===== playing a minigame (minigames.js): an arcade cabinet or a work shift takes over the screen. The game's grid is
// drawn into the same character grid as the world, scaled up into blocks, inside a cabinet-style frame, with its
// score below. The world keeps ticking along behind. Arcade games cost a credit and pay tickets; shifts pay money.
let game = null; // { g, kind: 'arcade' | 'shift' | 'bout' | ..., paid, pressed: {} }

const GAME_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
                    ArrowDown: 'down', KeyS: 'down', Space: 'act', Enter: 'act' };
function startGame(id, kind, word = '', opts) { // word: the shop's sign, for what's on its shelves; opts: the game's own (the ring's fighter)
  for (const k in K) K[k] = 0;
  game = { g: GAMES[id](Math.random, word, opts), kind, paid: false, pressed: {} }; // (the mouse stays locked: it just doesn't turn you)
}
// keys while a game's up; true if handled (every key is, while playing)
function gameKey(e) {
  if (!game) return false;
  const k = GAME_KEYS[e.code];
  if (k || e.code === 'Escape' || e.code === 'KeyE') e.preventDefault?.(); // Space must not activate the menu button that started the game.
  if (k) K[e.code] = 1; // held, for the paddle (keyup clears it as usual)
  if (e.repeat) return true;
  if (game.g.over) { // the results screen: go again, or walk away
    if (game.kind === 'cook') { // Heat is still Space/Enter: it must never dismiss the finished dish.
      if (e.code === 'KeyE' || e.code === 'Escape') game = null;
      return true;
    }
    if ((k === 'act') && game.kind === 'arcade') { if (pay(CREDIT)) { const id = game.g.id; startGame(id, 'arcade'); } else say(`A credit's ${fmt$(CREDIT)}. You're out of cash.`); }
    else if (k === 'act' && game.kind === 'table') { if (pay(MJ_BUYIN)) startGame(game.g.id, 'table'); else say(`The buy-in's ${fmt$(MJ_BUYIN)}. You're out of cash.`); } // another hand
    else if (e.code === 'Escape' || e.code === 'KeyE' || k === 'act') game = null;
    return true;
  }
  if (e.code === 'Escape' || e.code === 'KeyE') { // walk away: a shift pays for what you did, a game its tickets; a crime you just don't do
    if (game.kind === 'market') { game = null; return true; }
    if (game.kind === 'show') { game = null; say('You leave in the middle of the song. No refunds.', 3); return true; }
    if (game.kind === 'casino') { if (game.g.inRound()) say('You get up mid-hand. Your bet stays on the table.', 3); game = null; return true; }
    if (game.kind === 'crime') { const cb = game.onDone; game = null; cb('abort'); return true; }
    if (game.kind === 'cook') { game = null; say('You take it off the heat. Nothing\'s wasted.', 2); return true; } // (cooking.js: nothing's used till it's done)
    if (game.kind === 'workshop') {game=null;workshopRun=null;say('You switch the machine off. Your supplies are kept.',3);return true;}
    finishGame(true); game = null; return true;
  }
  if (k) game.pressed[k + 'P'] = 1;
  return true;
}
function finishGame(quit) {
  const g = game.g;
  g.over = true;
  if (game.paid) return;
  game.paid = true;
  if (game.kind === 'crime') { game.closeT = T + 0.8; game.onDone(g.success); return; } // (and the screen closes a moment later)
  if (game.kind === 'cook') { game.onDone(g.result); return; } // (dished up: cooking-ui.js)
  if (game.kind === 'workshop') {game.onDone(g.result);return;}
  if (game.kind === 'casino' || game.kind === 'market') return; // (its money changes hands round by round, or trade by trade)
  if (game.kind === 'bout') return finishBout(g, quit); // (gym.js)
  if (game.kind === 'show') { say(g.endLine, 5); game.closeT = T + 0.6; return; }
  const r = g.reward();
  if (game.kind === 'table') { // the mahjong table: the pot if you won, your stake back if nobody did
    const res = g.result;
    if (r > 0) earn(r);
    say(quit && !res ? 'You get up from the table. Your stake stays in the pot.' : !res ? '' : res.winner === 0 ? `MAHJONG! You take the pot: ${fmt$(r)}.` : res.winner < 0 ? 'A draw: the wall ran out. Everyone takes their stake back.' : `${MJ_NAMES[res.winner]} wins. Your ${fmt$(MJ_BUYIN)} goes in their pocket.`, 4);
    return;
  }
  if (game.kind === 'arcade' && g.prize) { // the crane dropped something in the chute
    if (g.id === 'goldfish') { tickets += r; const got = inv.length < INV_SIZE; if (got) carryItem({ id: g.prize, uses: 0 }); say(`${r} tickets, and the stallholder ties one fish up in a bag for you${got ? '' : ' (but your bag is full: it goes back in the tub)'}.`, 4); }
    else if (inv.length < INV_SIZE) { carryItem({ id: g.prize, uses: ITEMS[g.prize].uses || 0 }); say(`It drops down the chute: ${aOrSome(ITEMS[g.prize].name)}! Yours.`, 4); }
    else say(`It drops down the chute, but your bag is full. You leave ${aOrSome(ITEMS[g.prize].name)} for the next kid.`, 4);
  } else if (game.kind === 'arcade') { tickets += r; say(r ? `${r} tickets.` : g.id === 'crane' ? 'The claw comes up empty.' : 'No tickets this time.', 3); }
  else { if (r > 0) earn(r); say(quit ? `You clock off early. You earned ${fmt$(r)} (less for the hours you didn't work).` : `Shift's over. You earned ${fmt$(r)}.`, 4); }
}
function stepGame(dt) {
  const g = game.g;
  if (g.over) { if (!game.paid) finishGame(false); if (game && game.closeT && T > game.closeT) game = null; return; }
  const keys = { ...game.pressed };
  for (const code in GAME_KEYS) if (K[code]) keys[GAME_KEYS[code]] = 1;
  game.pressed = {};
  const ev = g.step(dt, keys);
  if (game.kind === 'casino') for (const e of ev) { // the casino: your stake on the table, your winnings back
    if ((e === 'stake' || e === 'double') && !pay(g.bet)) g.refused();
    if (e === 'payout') earn(g.win);
  }
  if (game.kind === 'show') for (const e of ev) if (e === 'tip' && !pay(1)) g.noCash();
  if (actx) for (const e of new Set(ev)) sfxGame(e);
  if (g.over) finishGame(false);
}
// blips and buzzes
function sfxGame(e) {
  if (game && game.kind === 'cook' && sfxCook(e)) return; // (the pan's own noises: cooking-ui.js)
  if (game && game.kind === 'workshop' && sfxWorkshop(e)) return; // (the bench's: workshop-ui.js)
  const at = actx.currentTime, sq = (f, len, gain = 0.05) => tone(at, f, len, gain, 'square');
  if (e === 'eat' || e === 'place' || e === 'serve') { sq(880, 0.06); tone(at + 0.06, 1320, 0.08, 0.05, 'square'); }
  else if (e === 'brick') sq(660 + Math.random() * 200, 0.05);
  else if (e === 'paddle' || e === 'wall' || e === 'hop' || e === 'slide' || e === 'launch') sq(e === 'paddle' ? 440 : e === 'hop' ? 520 : 330, 0.03, 0.035);
  else if (e === 'score' || e === 'clear') [523, 659, 784, 1047].forEach((f, k) => tone(at + k * 0.08, f, 0.1, 0.05, 'square'));
  else if (e === 'miss' || e === 'die' || e === 'break' || e === 'angry' || e === 'wrong') { tone(at, 160, 0.25, 0.08, 'sawtooth'); tone(at + 0.12, 110, 0.3, 0.07, 'sawtooth'); }
  else if (e === 'bump') sq(200, 0.04, 0.03);
  else if (e === 'end') [784, 659, 523].forEach((f, k) => tone(at + k * 0.1, f, 0.12, 0.05, 'square'));
}

// on a phone the buttons keep part of the screen (the bottom, held upright; the right, sideways): px to leave clear
function gameClear() {
  if(!TOUCH)return[0,0];
  const pad=touchEl?.querySelector('.pad'),r=pad?.getBoundingClientRect();
  if(r&&r.height>0)return innerWidth>innerHeight?[Math.max(TOUCH_PAD_W-30,innerWidth-r.left+12),0]:[0,innerHeight-r.top+12];
  return innerWidth>innerHeight?[TOUCH_PAD_W-30,0]:[0,TOUCH_PAD_H];
}
function gameFrameColor(g){return game.kind==='arcade'?NEON[ARCADE_GAMES.indexOf(g.id)&3]:game.kind==='crime'||game.kind==='bout'?RED:game.kind==='table'?GREEN:g.id==='serve'||g.id==='cook'?ORANGE:g.id==='tapper'?YEL:CYAN;}
function gameFS(g,layout=minigamePresentation(g)) {
  const ratio=cw/FS;
  return clamp(Math.floor(Math.min(DETAIL[settings.detail],layout.width/((2*g.W+6)*ratio),(innerHeight-layout.bottom-layout.top-layout.foot)/(g.H+4))),5,40);
}
// what the screen says to press: on a phone, the buttons' names
// (on a phone: what the buttons are called. UP is the Mahjong! button only at the mahjong table; lockpicking's HOLD UP
// is the stick held up)
const cookVerb = g => ({ pot: 'Stir', oven: 'Turn', grill: 'Turn' }[g.how] || 'Flip');
function gameText(s, g) {
  if (!TOUCH) return s;
  if (g?.id === 'workshop') return s.replace('HOLD SPACE power','HOLD POWER').replace('UP vent','VENT').replace('DOWN seal','SEAL').replace(/\[UP\]/g,'[VENT]').replace(/\[DOWN\]/g,'[SEAL]');
  if (g && g.id === 'cook') {
    const verb = cookVerb(g).toUpperCase();
    return s.replace('HOLD SPACE heat', 'HOLD HEAT').replace('UP flip / stir', verb).replace('DOWN add', 'ADD')
      .replace(/\[UP\]/g, `[${verb}]`).replace(/\[DOWN\]/g, '[ADD]');
  }
  if (g && g.id === 'mahjong') s = s.replace(/\bUP\b/g, 'MAHJONG');
  if (g && g.id === 'boxing') s = s.replace('DOWN block   UP head   SPACE body', 'the buttons block and punch');
  return s.replace(/HOLD UP/g, 'HOLD THE STICK UP').replace(/UP\/DOWN|ARROWS|LEFT\/RIGHT/g, 'STICK').replace(/SPACE/g, 'GO');
}
// the screen: a dark room, the cabinet bezel in the game's colour, the game blown up into blocks of characters
function drawGame() {
  const g=game.g,layout=minigamePresentation(g),fs=gameFS(g,layout);
  if (fs !== FS) { FS = fs; resize(); } // (put back when the game's done: see loop)
  const n = rows * cols;
  for (let i = 0; i < n; i++) { CH[i] = ' '; COL[i] = 0; BG[i] = C(GRAY, 0); }
  FOGS.fill(0); FOGB.fill(0);
  const ac=Math.min(cols-Math.ceil(layout.right/cw),Math.floor(layout.width/cw)),ar=rows-Math.ceil(layout.bottom/FS),top=Math.ceil(layout.top/FS),availableRows=ar-top-Math.ceil(layout.foot/FS);
  const s=clamp(Math.floor(Math.min((availableRows-4)/g.H,(ac-6)/(2*g.W))),1,3),bw=2*s,bh=s;
  const gw=g.W*bw,gh=g.H*bh,x0=Math.round(layout.left/cw)+((ac-gw)>>1),y0=top+2+(TOUCH&&innerWidth<=innerHeight?0:Math.max(0,(availableRows-gh-4)>>1)),frame=gameFrameColor(g);
  for (let y = y0 - 2; y <= y0 + gh + 1; y++) for (let x = x0 - 3; x <= x0 + gw + 2; x++) { // the bezel
    if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
    const i = y * cols + x, edgeY = y === y0 - 2 || y === y0 + gh + 1, edgeX = x === x0 - 3 || x === x0 + gw + 2;
    if (edgeY || edgeX) { set(i,' ',0);BG[i]=C(frame,7); }
    else if (y < y0 || y >= y0 + gh || x < x0 || x >= x0 + gw) BG[i] = C(frame, 1);
    else BG[i] = C(GRAY, 0);
  }
  g.draw((x, y, ch, col, bg) => { // one game cell: a block of characters
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return;
    for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) {
      const i = (y0 + y * bh + r) * cols + x0 + x * bw + c;
      set(i, ch, col); if (bg !== undefined && bg !== NONE) BG[i] = bg;
    }
  }, (x, y, s_, col, align) => {
       if (g.id === 'cook' || g.id === 'workshop') s_ = gameText(s_, g);
       putText(y0 + y * bh + (bh >> 1), Math.round(x0 + x * bw - (align === 'center' ? s_.length / 2 : 0)), s_, col);
     }, // a label, at normal size
     (c, y, s_, col) => putText(y0 + y * bh + (bh >> 1), x0 + c, s_, col), // one placed by character (a column in a table): c counts characters from the left
     (x, y, w, h, fill, col) => { // lines of characters filling a w x h patch of cells, centred: fill(chars wide, chars high) gives them
       const W_ = w * bw, H_ = h * bh, lines = fill(W_, H_).slice(0, H_), top = y0 + y * bh + ((H_ - lines.length) >> 1);
       lines.forEach((l, r) => { const s_ = l.slice(0, W_); putText(top + r, x0 + x * bw + ((W_ - s_.length) >> 1), s_, col); });
     });
  placeMinigameFooter((y0+gh+2)*FS+10);
  present();
}

// ---- in the arcade: the cabinets (each plays one of ARCADE_GAMES), and the prize counter
const nearCabinet = () => mode === 'room' && room.kind === 'arcade' &&
  room.props.find(s => s.game && Math.abs(px - s.cx) < 0.55 && py > s.cy + 0.3 && py < s.cy + 1.5) || null;
function playCabinet(cab) {
  if (!pay(CREDIT)) return say(`A credit's ${fmt$(CREDIT)}. You're out of cash.`);
  startGame(cab.game, 'arcade');
}
let prizeEl = null;
function openPrizes() {
  prizeEl = prizeEl || panel('prizes');
  const rows_ = PRIZES.map(([id, cost], k) => `<button class="item" data-prize="${id}" ${tickets < cost ? 'disabled' : ''}><span class="k">${k + 1}</span><span>${ITEMS[id].name}</span><span class="lead"></span><span class="v">${cost} tix</span></button>`).join('');
  showPanel(prizeEl, `<h1>Prize counter</h1><p class="sub">You have ${tickets} tickets &middot; carrying ${inv.length}/${INV_SIZE}</p>${rows_}<p class="hint">1-${PRIZES.length} trade &middot; E / Esc close</p>`);
  prizeEl.onclick = e => { const b = e.target.closest('[data-prize]'); if (b) { say(claimPrize(b.dataset.prize)[1], 3); openPrizes(); } };
}
function prizeKey(e) {
  if (!prizeEl || prizeEl.style.display !== 'flex') return false;
  const n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE') hidePanel(prizeEl);
  else if (n && PRIZES[n[1] - 1]) { say(claimPrize(PRIZES[n[1] - 1][0])[1], 3); openPrizes(); }
  return true;
}
