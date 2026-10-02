// ===== goods on screen: the shop menu, the inventory, the hotbar, and what's in your hand (or mouth, or underfoot)
// ---- in your hand: ascii art at the bottom right, bobbing as you walk. [lines, colour(ch, row)]
const HAND = {
  coffee: [['  ) )', ' ( (', '.-----.', '|     |]', '|CAFE |', "'-----'"], (c, r) => r < 2 ? C(WHITE, 7) : c === 'C' || c === 'A' || c === 'F' || c === 'E' ? C(GREEN, 12) : C(WHITE, 13)],
  latte: [['  ) )', '.-----.', '|~~~~~|]', '|     |', "'-----'"], (c, r) => r === 2 ? C(WARM, 13) : C(WHITE, 13)],
  tea: [['  ) )', ' _____', '|     |)', '|  o  |', "'-----'"], (c, r) => c === 'o' ? C(GREEN, 12) : C(WHITE, 12)],
  soda: [[' .---.', ' |   |', ' |COLA', ' |   |', " '---'"], (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : C(RED, 13)],
  water: [['  _', ' | |', '|   |', '|~~~|', '|___|'], (c, r) => C(CYAN, 12)],
  energy: [[' .---.', ' |ZAP|', ' | / |', ' |/  |', " '---'"], (c, r) => /[A-Z/]/.test(c) ? C(YEL, 15) : C(GREEN, 12)],
  beer: [[' _____', '(~~~~~)', '|     |]', '|     |]', '|_____|'], (c, r) => r < 2 ? C(WHITE, 14) : C(YEL, 12)],
  whiskey: [['', ' _____', '|~~~~~|', '| o o |', '|_____|'], (c, r) => r === 2 ? C(ORANGE, 12) : c === 'o' ? C(CYAN, 13) : C(WHITE, 11)],
  cocktail: [['  \\ o', '\\_____/', ' \\~~~/', '  \\ /', '   |', ' __|__'], (c, r) => c === 'o' ? C(RED, 14) : r === 2 ? C(MAG, 13) : C(WHITE, 12)],
  hotdog: [[' ___________', '(~~~~~~~~~~~)', ' (_________)'], (c, r) => r === 1 ? C(c === '~' ? YEL : RED, 13) : C(ORANGE, 12)],
  taco: [['  ________', ' /%%%%%%%%\\', '/__________\\'], (c, r) => r === 1 ? C(GREEN, 12) : C(YEL, 13)],
  icecream: [['  @@@', ' @@@@@', '  \\#/', '   V'], (c, r) => c === '@' ? C(MAG, 14) : C(ORANGE, 12)],
  noodlebox: [['   ||', ' _||__', '|~~~~~|', '\\_____/'], (c, r) => r < 2 ? C(BRICK, 12) : r === 2 ? C(YEL, 13) : C(WHITE, 13)],
  ramen: [['   ||', ' _||___', '(~~@~~~)', ' \\____/'], (c, r) => c === '@' ? C(WHITE, 15) : r === 2 ? C(YEL, 13) : C(RED, 12)],
  croissant: [['  _.--._', ' (__\\/__)'], (c, r) => C(ORANGE, 13)],
  donut: [['  .---.', ' ( (o) )', "  '---'"], (c, r) => c === 'o' ? C(GRAY, 3) : C(MAG, 13)],
  bagel: [['  .---.', ' ( (_) )', "  '---'"], (c, r) => C(WARM, 12)],
  sandwich: [[' _________', '/%%%%%%%%%\\', '|=========|', '\\_________/'], (c, r) => r === 1 ? C(GREEN, 12) : r === 2 ? C(RED, 12) : C(WARM, 12)],
  chips: [[' .------.', ' | CHIPS|', ' |  ()  |', " '------'"], (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : C(YEL, 13)],
  apple: [['   ,', ' .-|-.', '(     )', " '---'"], (c, r) => r === 0 || c === '|' ? C(GREEN, 12) : C(RED, 13)],
  slice: [['\\%%%%%%/', ' \\%o%%/', '  \\%%/', '   \\/'], (c, r) => c === 'o' ? C(RED, 13) : C(YEL, 13)],
  burger: [[' .-----.', '(%%%%%%%)', '(=======)', " '-----'"], (c, r) => r === 1 ? C(GREEN, 12) : r === 2 ? C(BRICK, 12) : C(ORANGE, 13)],
  kebab: [['  _____', ' /%%%%%\\', ' \\_____/', '   | |'], (c, r) => r === 1 ? C(GREEN, 12) : C(WARM, 13)],
  dumplings: [[' .-. .-.', '( . ( . )', ' \\_/ \\_/'], (c, r) => C(WHITE, 13)],
  mooncake: [[' .----.', '( (**) )', " '----'"], (c, r) => c === '*' ? C(YEL, 15) : C(ORANGE, 12)],
  book: [[' ________', '|        |', '| ~~~~~~ |', '|________|'], (c, r) => r === 2 ? C(WHITE, 12) : C(BLUE, 12)],
  newspaper: [[' ________', '|NEWS ==|', '|=== ===|', '|=== ===|'], (c, r) => C(WHITE, 13)],
  vinyl: [[' _______', '|  ___  |', '| ( o ) |', '|_______|'], (c, r) => c === 'o' ? C(RED, 13) : C(MAG, 12)],
  flowers: [[' *@*@*', '  \\|/', '   |', '  [_]'], (c, r) => r === 0 ? C(ITEM_COL[(c.charCodeAt(0) + r) & 7], 14) : c === '[' || c === ']' || c === '_' ? C(BRICK, 12) : C(GREEN, 12)],
  umbrella: [['   |', '   |', '   J'], (c, r) => C(GRAY, 12)],
  ball: [['  ____', ' / \\/ \\', '|  /\\  |', ' \\_\\/_/'], (c, r) => C(WHITE, 13)],
  boombox: [[' _[====]_', '|O |==| O|', '|_|____|_|'], (c, r) => c === 'O' ? C(GRAY, 9) : c === '=' ? C(CYAN, 13) : C(GRAY, 13)],
  skateboard: [['  _____________', ' (_____________)', '   o         o'], (c, r) => r < 2 ? C(RED, 12) : C(WHITE, 13)],
  cigarettes: [[' _____', '|=====|', '|SMOKE|', '|_____|'], (c, r) => /[A-Z]/.test(c) ? C(RED, 13) : C(WHITE, 13)],
};
const HAND_FIST = ['  ____', ' (    \\', '(______)']; // the hand holding it
let smokePuffs = []; // [x, y, life] in screen cells
const putCell = (r, c, ch, col, bg = NONE) => { if (r < 0 || r >= rows || c < 0 || c >= cols || ch === ' ' && bg === NONE) return; const i = r * cols + c; set(i, ch, col); BG[i] = bg; FOGS[i] = FOGB[i] = 0; };
// draw ascii art solid: the gaps inside each line are filled, so the street doesn't show through the cup
function putArt(art, r0, c0, col, bg) {
  art.forEach((l, r) => { const a0 = l.search(/\S/), a1 = l.length - [...l].reverse().join('').search(/\S/);
    [...l].forEach((ch, k) => putCell(r0 + r, c0 + k, ch, col(ch, r), k >= a0 && k < a1 ? bg : NONE)); });
}
function drawHeld(dt) {
  if (!(mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat')) return;
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, bob = moving ? Math.round(Math.sin(T * (fx.skating ? 4 : 9)) * 0.6) : 0;
  if (fx.skating && mode === 'walk') { // the board under your feet
    putArt(HAND.skateboard[0], rows - 3, (cols >> 1) - 8, HAND.skateboard[1], C(GRAY, 1));
  }
  const it = heldItem();
  if (it && !(fx.skating && it.id === 'skateboard')) {
    const [art, col] = HAND[it.id] || HAND.book, c0 = Math.floor(cols * 0.72), r0 = rows - art.length - 3 + bob;
    putArt(art, r0, c0, col, C(GRAY, 1));
    putArt(HAND_FIST, rows - 3 + bob, c0, () => C(SKIN, 12), C(SKIN, 4));
    if (it.id === 'umbrella' && rain > 0.2) { // the canopy overhead
      for (let c = 0; c < cols; c++) {
        const edge = Math.round(4 + Math.abs(c - cols / 2) / cols * 6);
        for (let r = 0; r < edge; r++) { const i = r * cols + c; set(i, r === edge - 1 ? (c % 9 === 0 ? 'Y' : '-') : ' ', C(BLUE, 6)); BG[i] = C(BLUE, 2); FOGS[i] = FOGB[i] = 0; }
        if (c % 9 === 0 && Math.random() < 0.3) putCell(edge + (T * 6 + c | 0) % 3, c, '.', C(BLUE, 8)); // drips off the edge
      }
    }
  }
  if (fx.smoke > 0) { // a cigarette in your mouth, tip glowing; drags puff smoke
    const c0 = (cols >> 1) - 2, r0 = rows - 2, tip = fract(T * 2) < 0.5 ? 12 + cigTip * 3 : 10 + cigTip * 5;
    for (let k = 0; k < 6; k++) putCell(r0 - (k >> 1), c0 + k, k < 1 ? '_' : '/', C(WHITE, 14), C(GRAY, 2));
    putCell(r0 - 3, c0 + 6, '*', C(cigTip > 0.3 ? YEL : ORANGE, tip), C(RED, 2 + cigTip * 4));
    if (Math.random() < dt * (1.5 + cigTip * 25)) smokePuffs.push([c0 + 6, r0 - 4, 1]);
  }
  smokePuffs = smokePuffs.filter(p => (p[2] -= dt * 0.35) > 0);
  for (const p of smokePuffs) { p[1] -= dt * 4; p[0] += Math.sin(T * 3 + p[1]) * dt * 3; putCell(Math.round(p[1]), Math.round(p[0]), p[2] > 0.6 ? '~' : '.', C(GRAY, 4 + p[2] * 8)); }
}

// ---- the hotbar and the effects you're under, bottom left
function hotbar() {
  if (mode === 'drive' || mode === 'taxi' || !inv.length && !fx.caffeine && !fx.booze) return;
  let x = 6;
  const y = cv.height - FS * 2 - 10;
  inv.forEach((it, k) => {
    const s = `${k + 1} ${ITEMS[it.id].name}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`, w = g.measureText(s).width + 12;
    g.fillStyle = k === held ? 'rgba(255,184,77,0.35)' : 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, FS + 8);
    g.fillStyle = k === held ? '#fff' : '#bbb'; g.fillText(s, x + 6, y + 4);
    x += w + 4;
  });
  const tags = [fx.caffeine > 0 && 'caffeinated', fx.booze > 0.5 ? 'drunk' : fx.booze > 0.15 && 'tipsy', fx.skating && 'skating', fx.boombox && 'music on'].filter(Boolean);
  if (tags.length) { const s = tags.join('  '); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(6, y - FS - 10, g.measureText(s).width + 12, FS + 6); g.fillStyle = '#ffb84d'; g.fillText(s, 12, y - FS - 7); }
}

// ---- shop menu and inventory: small panels over a frozen game, keyboard or mouse
let shopEl = null, invEl = null, shopCtx = null;
function panel(id) {
  const el = document.createElement('div');
  el.id = id;
  el.innerHTML = `<style>
    #${id} { position: fixed; inset: 0; z-index: 400; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); font: 13px/1.5 monospace; color: rgba(255,255,255,0.85); }
    #${id} .panel { width: min(380px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; box-sizing: border-box; padding: 18px 20px; background: rgba(10,6,10,0.94); border: 1px solid rgba(255,255,255,0.15); }
    #${id} h1 { margin: 0 0 4px; font-size: 16px; font-weight: normal; letter-spacing: 3px; color: #fff; }
    #${id} .sub { margin: 0 0 12px; color: rgba(255,255,255,0.5); }
    #${id} button { display: grid; grid-template-columns: 1.6em 1fr auto; gap: 8px; width: 100%; box-sizing: border-box; margin: 5px 0; padding: 7px 10px; text-align: left; font: inherit; color: #fff; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); cursor: pointer; }
    #${id} button:hover, #${id} button:focus-visible { background: rgba(255,184,77,0.18); border-color: rgba(255,184,77,0.6); outline: none; }
    #${id} button[disabled] { opacity: 0.4; cursor: default; }
    #${id} .k { color: rgba(255,184,77,0.9); }
    #${id} .hint { margin: 12px 0 0; color: rgba(255,255,255,0.45); }
  </style><div class="panel"></div>`;
  document.body.appendChild(el);
  return el;
}
function showPanel(el, html) {
  el.querySelector('.panel').innerHTML = html; el.style.display = 'flex'; paused = true;
  for (const k in K) K[k] = 0;
  if (document.pointerLockElement) document.exitPointerLock();
}
function hidePanel(el) { if (el && el.style.display !== 'none') { el.style.display = 'none'; paused = false; } }
const panelOpen = () => shopEl && shopEl.style.display === 'flex' || invEl && invEl.style.display === 'flex';
// title, item ids, and the cart if it's a street vendor (for the fetch favour)
function openShop(title, stock, vendor = null) {
  shopEl = shopEl || panel('shop');
  shopCtx = { title, stock, vendor };
  const rows_ = stock.map((id, k) => { const it = ITEMS[id]; return `<button data-buy="${id}" ${money < it.price ? 'disabled' : ''}><span class="k">${k + 1}</span><span>${it.name}</span><span>${fmt$(it.price)}</span></button>`; }).join('');
  showPanel(shopEl, `<h1>${title}</h1><p class="sub">You have ${fmt$(money)} &middot; ${inv.length}/${INV_SIZE} carried</p>${rows_}<p class="hint">1-${stock.length} or click to buy &middot; E / Esc to close</p>`);
  shopEl.onclick = e => { const b = e.target.closest('[data-buy]'); if (b) shopBuy(b.dataset.buy); };
}
function shopBuy(id) {
  const [ok, line] = buy(id);
  say(line, 3);
  if (ok && shopCtx.vendor && taskBuy(shopCtx.vendor)) say(`${line} That's the one they wanted.`, 4);
  openShop(shopCtx.title, shopCtx.stock, shopCtx.vendor); // refresh (money changed)
}
const closeShop = () => hidePanel(shopEl);
function openInventory() {
  invEl = invEl || panel('inventory');
  const rows_ = inv.length ? inv.map((it, k) => `<button data-slot="${k}"><span class="k">${k + 1}</span><span>${ITEMS[it.id].name}${k === held ? ' (in hand)' : ''}</span><span>${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? 'x' + it.uses : ''}</span></button>`).join('') : '<p class="sub">Nothing. Shops sell things.</p>';
  showPanel(invEl, `<h1>CARRYING</h1><p class="sub">${fmt$(money)} &middot; ${inv.length}/${INV_SIZE}</p>${rows_}<p class="hint">click or 1-${INV_SIZE}: hold &middot; Q use &middot; X drop &middot; I / Esc close</p>`);
  invEl.onclick = e => { const b = e.target.closest('[data-slot]'); if (b) { held = +b.dataset.slot; openInventory(); } };
}
const closeInventory = () => hidePanel(invEl);
// keys while a panel is up; true if handled
function panelKey(e) {
  if (!panelOpen()) return false;
  const shop = shopEl && shopEl.style.display === 'flex', n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE' && shop || e.code === 'KeyI' && !shop) { shop ? closeShop() : closeInventory(); return true; }
  if (shop && n && shopCtx.stock[n[1] - 1]) { shopBuy(shopCtx.stock[n[1] - 1]); return true; }
  if (!shop && n && inv[n[1] - 1]) { held = n[1] - 1; openInventory(); return true; }
  if (!shop && e.code === 'KeyQ') { closeInventory(); useHeldItem(); return true; }
  if (!shop && e.code === 'KeyX') { const d = dropHeld(); if (d) say(`You leave the ${d} behind.`); openInventory(); return true; }
  return true; // swallow everything else
}

// ---- using things: the sounds that go with them
const HEADLINES = () => [`${pick(stations).name} station closed for repairs`, 'Mayor vows to fix the el (again)', 'Bridge tolls to rise',
  'Local cat elected to community board', `Rents soar in ${pick(['Chinatown', 'the Brownstones', 'Midtown'])}`, 'Ambulance response times improve',
  'Record crowds at the waterfront', 'Fog to roll in this week, say forecasters'];
function useHeldItem() {
  const [line, sound] = useHeld({ indoors: mode === 'room', x: px, y: py, a, rain, person: nearPerson(), headlines: HEADLINES() });
  say(line, 3);
  if (actx && sound) sfxUse(sound);
}
function sfxUse(s) {
  const at = actx.currentTime;
  if (s === 'bite') { burst(at, 0.06, [filt('bandpass', 2200, 1.2)], 0.12); burst(at + 0.09, 0.05, [filt('bandpass', 1800, 1.2)], 0.09); }
  if (s === 'sip') burst(at, 0.25, [filt('lowpass', 900), filt('highpass', 300)], 0.07);
  if (s === 'light') { tone(at, 2600, 0.03, 0.08, 'square'); burst(at + 0.04, 0.4, [filt('lowpass', 1500)], 0.1); }
  if (s === 'drag') { burst(at, 0.4, [filt('bandpass', 3500, 0.8)], 0.03); burst(at + 0.6, 0.9, [filt('lowpass', 900)], 0.06); }
  if (s === 'kick') { tone(at, 110, 0.12, 0.2); burst(at, 0.05, [filt('bandpass', 900, 1)], 0.15); }
  if (s === 'page') burst(at, 0.15, [filt('highpass', 2500)], 0.05);
  if (s === 'board') { tone(at, 180, 0.08, 0.12); burst(at, 0.1, [filt('bandpass', 1200, 1)], 0.1); }
  if (s === 'click') tone(at, 1800, 0.03, 0.08, 'square');
  if (s === 'chime') sfxDoor();
}
// the ball, out in the world
function drawBall() {
  if (!ball) return;
  const [vx, vy] = R(ball.x, ball.y);
  drawArt(vx, vy, ball.z, 0.035, 0.035, ['O'], (c, row, L) => C(WHITE, Math.max(L, 6)));
}
