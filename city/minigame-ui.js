// ===== playing a minigame (minigames.js): an arcade cabinet or a work shift takes over the screen. The game's grid is
// drawn into the same character grid as the world, scaled up into blocks, inside a cabinet-style frame, with its
// score below. The world keeps ticking along behind. Arcade games cost a credit and pay tickets; shifts pay money.
let game = null; // { g, kind: 'arcade' | 'shift', paid, pressed: {} }

const GAME_KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
                    ArrowDown: 'down', KeyS: 'down', Space: 'act', Enter: 'act' };
function startGame(id, kind, word = '') { // word: the shop's sign, for what's on its shelves
  for (const k in K) K[k] = 0;
  game = { g: GAMES[id](Math.random, word), kind, paid: false, pressed: {} }; // (the mouse stays locked: it just doesn't turn you)
}
// keys while a game's up; true if handled (every key is, while playing)
function gameKey(e) {
  if (!game) return false;
  const k = GAME_KEYS[e.code];
  if (k) K[e.code] = 1; // held, for the paddle (keyup clears it as usual)
  if (e.repeat) return true;
  if (game.g.over) { // the results screen: go again, or walk away
    if ((k === 'act') && game.kind === 'arcade') { if (pay(CREDIT)) { const id = game.g.id; startGame(id, 'arcade'); } else say(`A credit's ${fmt$(CREDIT)}. You're out of cash.`); }
    else if (e.code === 'Escape' || e.code === 'KeyE' || k === 'act') game = null;
    return true;
  }
  if (e.code === 'Escape' || e.code === 'KeyE') { // walk away: a shift pays for what you did, a game its tickets; a crime you just don't do
    if (game.kind === 'crime') { const cb = game.onDone; game = null; cb('abort'); return true; }
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
  const r = g.reward();
  if (game.kind === 'arcade') { tickets += r; say(r ? `${r} tickets.` : 'No tickets this time.', 3); }
  else { if (r > 0) earn(r); say(quit ? `You clock off early. You earned ${fmt$(r)} (less for the hours you didn't work).` : `Shift's over. You earned ${fmt$(r)}.`, 4); }
}
function stepGame(dt) {
  const g = game.g;
  if (g.over) { if (!game.paid) finishGame(false); if (game && game.closeT && T > game.closeT) game = null; return; }
  const keys = { ...game.pressed };
  for (const code in GAME_KEYS) if (K[code]) keys[GAME_KEYS[code]] = 1;
  game.pressed = {};
  const ev = g.step(dt, keys);
  if (actx) for (const e of new Set(ev)) sfxGame(e);
  if (g.over) finishGame(false);
}
// blips and buzzes
function sfxGame(e) {
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
const gameClear = () => !TOUCH ? [0, 0] : innerWidth > innerHeight ? [TOUCH_PAD_W - 30, 0] : [0, TOUCH_PAD_H];
// the character size that fits the whole cabinet on screen, never bigger than the detail setting's
function gameFS(g) {
  const [cr, cb] = gameClear(), ratio = cw / FS; // (a character's width per px of height, in this font)
  return clamp(Math.floor(Math.min(DETAIL[settings.detail], (innerWidth - cr) / ((2 * g.W + 6) * ratio), (innerHeight - cb) / (g.H + 9))), 5, 40);
}
// what the screen says to press: on a phone, the buttons' names
const gameText = s => TOUCH ? s.replace(/HOLD UP/g, 'HOLD THE STICK UP').replace(/UP\/DOWN|ARROWS/g, 'STICK').replace(/SPACE/g, 'GO') : s;
// the screen: a dark room, the cabinet bezel in the game's colour, the game blown up into blocks of characters
function drawGame() {
  const g = game.g, fs = gameFS(g);
  if (fs !== FS) { FS = fs; resize(); } // (put back when the game's done: see loop)
  const n = rows * cols;
  for (let i = 0; i < n; i++) { CH[i] = ' '; COL[i] = 0; BG[i] = C(GRAY, 0); }
  FOGS.fill(0); FOGB.fill(0);
  const [cr, cb] = gameClear(), ac = cols - Math.ceil(cr / cw), ar = rows - Math.ceil(cb / FS); // the columns and rows we can use
  const s = clamp(Math.floor(Math.min((ar - 9) / g.H, (ac - 6) / (2 * g.W))), 1, 3), bw = 2 * s, bh = s;
  const gw = g.W * bw, gh = g.H * bh, x0 = (ac - gw) >> 1, y0 = Math.max(4, (ar - gh) >> 1);
  const frame = game.kind === 'arcade' ? NEON[ARCADE_GAMES.indexOf(g.id) & 3] : game.kind === 'crime' ? RED : g.id === 'serve' ? ORANGE : g.id === 'tapper' ? YEL : CYAN;
  for (let y = y0 - 2; y <= y0 + gh + 1; y++) for (let x = x0 - 3; x <= x0 + gw + 2; x++) { // the bezel
    if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
    const i = y * cols + x, edgeY = y === y0 - 2 || y === y0 + gh + 1, edgeX = x === x0 - 3 || x === x0 + gw + 2;
    if (edgeY || edgeX) { set(i, edgeY && edgeX ? '+' : edgeY ? '=' : '|', C(frame, 12)); BG[i] = C(frame, 2); }
    else if (y < y0 || y >= y0 + gh || x < x0 || x >= x0 + gw) BG[i] = C(frame, 1);
    else BG[i] = C(GRAY, 0);
  }
  putText(y0 - 3, x0 + ((gw - g.title.length * 2) >> 1), g.title.split('').join(' '), C(frame, 15));
  g.draw((x, y, ch, col, bg) => { // one game cell: a block of characters
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return;
    for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) {
      const i = (y0 + y * bh + r) * cols + x0 + x * bw + c;
      set(i, ch, col); if (bg !== undefined && bg !== NONE) BG[i] = bg;
    }
  }, (x, y, s_, col) => putText(y0 + y * bh + (bh >> 1), x0 + x * bw, s_, col)); // a label, at normal size
  // the status under the screen, in two lines if it's wider than the cabinet
  const st = gameText(g.status()), parts = st.length > gw + 4 ? st.split(/\s{3}/) : [st], half = Math.ceil(parts.length / 2);
  const sts = parts.length > 1 ? [parts.slice(0, half).join('   '), parts.slice(half).join('   ')] : parts;
  sts.forEach((l, k) => putText(y0 + gh + 2 + k, x0 + ((gw - l.length) >> 1), l, C(WHITE, 12)));
  const leave = TOUCH ? '' : game.kind === 'arcade' ? '   E / ESC leave' : game.kind === 'crime' ? 'E / ESC back off' : '   E / ESC clock off';
  const foot = game.kind === 'arcade' ? `TICKETS ${tickets}   ${fmt$(money)}${leave}` : game.kind === 'crime' ? leave : `${fmt$(money)}${leave}`;
  putText(Math.min(ar - 1, y0 + gh + 2 + sts.length), x0 + ((gw - foot.length) >> 1), foot, C(GRAY, 9));
  if (g.over && game.kind !== 'crime') { // the results card
    const r = g.reward(), lines = game.kind === 'arcade'
      ? ['GAME OVER', `${g.status().split('   ')[0]}`, `+${r} TICKETS`, ...TOUCH ? [] : ['', `SPACE play again (${fmt$(CREDIT)})   E leave`]]
      : ['SHIFT OVER', g.status().split('   ').slice(0, 2).join('   '), `PAID ${fmt$(r)}`, ...TOUCH ? [] : ['', 'E or SPACE to finish']];
    const w = Math.min(ac, Math.max(...lines.map(l => l.length)) + 6), h = lines.length + 2, cx = (ac - w) >> 1, cy = (ar - h) >> 1;
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) {
      const i = y * cols + x; set(i, ' ', 0); BG[i] = C(GRAY, 1);
      if (y === cy || y === cy + h - 1) set(i, '-', C(frame, 10));
    }
    lines.forEach((l, k) => putText(cy + 1 + k, cx + ((w - l.length) >> 1), l, C(k === 2 ? YEL : WHITE, k === 0 ? 15 : 12)));
  }
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
