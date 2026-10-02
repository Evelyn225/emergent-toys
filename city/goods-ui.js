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
  candy: [['  ______', ' (CANDY )', "  '----'"], (c, r) => /[A-Z]/.test(c) ? C(WHITE, 15) : C(MAG, 12)],
  yoyo: [[' | ', ' | ', '(@)'], (c, r) => r < 2 ? C(WHITE, 10) : c === '@' ? C(WHITE, 15) : C(RED, 14)],
  harmonica: [[' ________', '[::::::::]', " '------'"], (c, r) => c === ':' ? C(GRAY, 6) : C(GRAY, 13)],
  duck: [['   __', ' <(o )___', '  ( ._> /', "   `---'"], (c, r) => c === '>' ? C(ORANGE, 15) : C(YEL, 15)],
  sparklers: [['|', '|', '|', '|'], (c, r) => C(GRAY, 11)],
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
  ball: [['  ____', ' / \\/ \\', '|  /\\  |', ' \\_\\/_/'], (c, r) => C(WHITE, 13)],
  boombox: [[' _[====]_', '|O |==| O|', '|_|____|_|'], (c, r) => c === 'O' ? C(GRAY, 9) : c === '=' ? C(CYAN, 13) : C(GRAY, 13)],
  skateboard: [['  _____________', ' (_____________)', '   o         o'], (c, r) => r < 2 ? C(RED, 12) : C(WHITE, 13)],
  cigarettes: [[' _____', '|=====|', '|SMOKE|', '|_____|'], (c, r) => /[A-Z]/.test(c) ? C(RED, 13) : C(WHITE, 13)],
};
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
  if (fx.smoke > 0) { // a cigarette in your mouth, tip glowing; drags puff smoke
    const c0 = (cols >> 1) - 2, r0 = rows - 2, tip = fract(T * 2) < 0.5 ? 12 + cigTip * 3 : 10 + cigTip * 5;
    for (let k = 0; k < 6; k++) putCell(r0 - (k >> 1), c0 + k, k < 1 ? '_' : '/', C(WHITE, 14), C(GRAY, 2));
    putCell(r0 - 3, c0 + 6, '*', C(cigTip > 0.3 ? YEL : ORANGE, tip), C(RED, 2 + cigTip * 4));
    if (Math.random() < dt * (1.5 + cigTip * 25)) smokePuffs.push([c0 + 6, r0 - 4, 1]);
  }
  smokePuffs = smokePuffs.filter(p => (p[2] -= dt * 0.35) > 0);
  for (const p of smokePuffs) { p[1] -= dt * 4; p[0] += Math.sin(T * 3 + p[1]) * dt * 3; putCell(Math.round(p[1]), Math.round(p[0]), p[2] > 0.6 ? '~' : '.', C(GRAY, 4 + p[2] * 8)); }
}

// ---- what's in your hand, drawn big over the finished frame: ASCII at ~2x the map's character size, every line
// solid-backed so nothing shows through, the hand gripping the bottom of whatever it holds
function bigArt(lines, x, y, size, colFn, bgFn) {
  const w = g.measureText('M').width;
  lines.forEach((l, r) => {
    const a0 = l.search(/\S/), a1 = l.length - [...l].reverse().join('').search(/\S/);
    if (a0 < 0) return;
    if (bgFn && l.replace(/ /g, '').length > 2) for (let k = a0; k < a1; k++) { const b = bgFn(l[k], r, k); if (b !== NONE) { g.fillStyle = PAL[b]; g.fillRect(x + k * w, y + r * size, w + 0.5, size); } }
    for (let k = a0; k < a1; k++) if (l[k] !== ' ') { g.fillStyle = PAL[colFn(l[k], r)]; g.fillText(l[k], x + k * w, y + r * size); }
  });
  return w;
}
// the hand, in ASCII at the held item's size: four fingers curled round the front of whatever it holds (stacked
// bands, a knuckle crease in each), the thumb hooked over the top on the left, the wrist running off the screen.
// Solid skin behind every row so nothing shows through; outlines and creases a darker brown.
let HAND_ART = [
  '  _',
  ' / )-----.',
  '( (__:___ )',
  ' (___:___ )',
  ' (___:___ )',
  '  (__:__ /',
  '   |     |',
  '   |     |',
  '   |     |'];
const HAND_EDGE = new Set(['(', ')', '/', '\\', '|', '_', '-', '.', ':']);
function drawHand(cx, top, size) {
  g.font = size + 'px monospace';
  const w = g.measureText('M').width, artW = Math.max(...HAND_ART.map(l => l.length));
  bigArt(HAND_ART, cx - artW * w / 2, top, size, (c, r) => HAND_EDGE.has(c) ? C(BRICK, c === ':' ? 6 : 8) : C(SKIN, 12),
         (c, r) => r === 0 ? NONE : C(SKIN, r > 5 ? 6 : 8));
}
function drawHeldBig() {
  const it = heldItem();
  if (!it || !(mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat') || fx.skating && it.id === 'skateboard') return;
  const moving = K.KeyW || K.KeyS || K.KeyA || K.KeyD, u = Math.max(14, cv.height / 36), size = Math.round(u * 1.5); // scaled to the screen, not the detail setting
  const bob = moving ? Math.sin(T * (fx.skating ? 4 : 9)) * u * 0.35 : Math.sin(T * 1.5) * u * 0.08;
  const hx = Math.round(cv.width * 0.7), hy = Math.round(cv.height - 5.4 * size + bob); // the top of the hand (its thumb)
  const open = it.id === 'umbrella' && rain > 0.2;
  g.font = size + 'px monospace';
  const w = g.measureText('M').width;
  if (open) { // the umbrella, open overhead, seen from underneath: ribs fan out from the hub at the top of the screen
    // to a scalloped rim that hangs lowest straight ahead; the shaft runs from your fist up to the hub
    const W = cv.width, H = cv.height, gx = hx + 2.6 * u, hub = [W * 0.56, H * 0.05 + bob * 0.5], ribs = 10, tips = [];
    for (let k = 0; k <= ribs; k++) { const t = k / ribs * 2 - 1; tips.push([W * (0.5 + t * 0.62), H * (0.36 - t * t * 0.5) + bob * 0.5]); }
    g.fillStyle = PAL[C(BLUE, 3)]; g.fillRect(0, 0, W, hub[1]); // above the hub the canopy runs on over your head
    const line = Math.max(1.5, u * 0.09);
    for (let k = 0; k < ribs; k++) { // the panels: alternating tones, each edge scalloped up toward the hub
      const [x0, y0] = tips[k], [x1, y1] = tips[k + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      g.beginPath(); g.moveTo(hub[0], hub[1]); g.lineTo(x0, y0);
      g.quadraticCurveTo(mx + (hub[0] - mx) * 0.12, my + (hub[1] - my) * 0.22, x1, y1); g.closePath();
      g.fillStyle = PAL[C(BLUE, k & 1 ? 5 : 3)]; g.fill();
    }
    g.strokeStyle = PAL[C(GRAY, 7)]; g.lineWidth = line;
    for (const [x, y] of tips) { g.beginPath(); g.moveTo(hub[0], hub[1]); g.lineTo(x, y); g.stroke(); } // the ribs
    g.fillStyle = PAL[C(GRAY, 11)];
    tips.forEach(([x, y], k) => {
      g.beginPath(); g.arc(x, y, u * 0.16, 0, Math.PI * 2); g.fill(); // the rib tips
      const d = fract(T * 1.3 + k * 0.37); // a drip falling off each tip
      g.fillStyle = PAL[C(BLUE, 10)]; g.fillRect(x - 1, y + u * 0.3 + d * H * 0.25, 2, u * 0.35); g.fillStyle = PAL[C(GRAY, 11)];
    });
    g.lineCap = 'round'; // the shaft: dark edge, light core, from your fist up to the hub
    g.strokeStyle = PAL[C(GRAY, 3)]; g.lineWidth = u * 0.42; g.beginPath(); g.moveTo(gx, hy + u); g.lineTo(hub[0], hub[1]); g.stroke();
    g.strokeStyle = '#cfcfd8'; g.lineWidth = u * 0.24; g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = PAL[C(GRAY, 12)]; g.beginPath(); g.arc(hub[0], hub[1], u * 0.4, 0, Math.PI * 2); g.fill(); // the hub
  } else if (it.id === 'umbrella') { // furled: the shaft up out of your fist into the wrapped canopy, strap, tip
    g.save(); g.translate(hx + 2.6 * u, hy + u); g.rotate(-0.1); // leaning a touch to the left; up is -y
    g.lineCap = 'round';
    g.strokeStyle = PAL[C(GRAY, 3)]; g.lineWidth = u * 0.42; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -13 * u); g.stroke();
    g.strokeStyle = '#cfcfd8'; g.lineWidth = u * 0.24; g.stroke(); // the shaft (its tip pokes out the top)
    g.beginPath(); g.moveTo(-0.3 * u, -3 * u); // the wrapped canopy: bunched at the bottom, swelling, tapering to the tip
    g.bezierCurveTo(-1.6 * u, -4.2 * u, -1.1 * u, -8 * u, -0.12 * u, -12.3 * u); g.lineTo(0.12 * u, -12.3 * u);
    g.bezierCurveTo(1.1 * u, -8 * u, 1.6 * u, -4.2 * u, 0.3 * u, -3 * u); g.closePath();
    g.fillStyle = PAL[C(BLUE, 6)]; g.fill(); g.strokeStyle = PAL[C(BLUE, 2)]; g.lineWidth = Math.max(1.5, u * 0.08); g.stroke();
    g.strokeStyle = PAL[C(BLUE, 9)]; g.lineWidth = Math.max(1, u * 0.06);
    for (const k of [-0.5, 0.15, 0.7]) { g.beginPath(); g.moveTo(k * 0.5 * u, -3.3 * u); g.quadraticCurveTo(k * 1.4 * u, -6.5 * u, 0, -12 * u); g.stroke(); } // the folds
    g.fillStyle = PAL[C(GRAY, 12)]; g.fillRect(-1.15 * u, -5.6 * u, 2.3 * u, 0.4 * u); // the strap
    g.lineCap = 'butt'; g.restore();
  } else {
    const [art, col] = HAND[it.id] || HAND.book, artW = Math.max(...art.map(l => l.length)), top = hy - (art.length - 1.6) * size;
    // centred over the fingers, the bottom of it tucked behind them
    if (!(it.id === 'yoyo' && fx.yoyo > 0)) bigArt(art, hx + 2.6 * u - artW * w / 2, top, size, col, () => C(GRAY, 1));
    if (it.id === 'sparklers' && fx.spark > 0) drawSparks(hx + 2.6 * u, top - size * 0.5, size);
  }
  drawHand(hx + 2.6 * u, hy, size);
  if (it.id === 'yoyo' && fx.yoyo > 0) drawYoyo(hx + 2.6 * u, hy + size, size);
  g.font = FS + 'px monospace';
}
// a yo-yo trick (fx.yoyo counts down): around the world, a loop up in front of you and back to your hand, the string
// drawn in characters that follow its slope
function drawYoyo(x, y, size) {
  g.font = size + 'px monospace';
  const w = g.measureText('M').width, th = (1 - fx.yoyo / 1.4) * Math.PI * 2, R = 2.4;
  const yx = x + Math.sin(th) * R * w * 1.7, yy = y - (1 - Math.cos(th)) * R * size;
  const n = Math.ceil(Math.hypot((yx - x) / w, (yy - y) / size)), dxs = (yx - x) / w, dys = (yy - y) / size;
  const ch = Math.abs(dys) > Math.abs(dxs) * 2 ? '|' : Math.abs(dxs) > Math.abs(dys) * 2 ? '-' : dxs * dys < 0 ? '/' : '\\';
  g.fillStyle = PAL[C(WHITE, 11)];
  for (let k = 1; k < n; k++) g.fillText(ch, x + (yx - x) * k / n - w / 2, y + (yy - y) * k / n - size / 2);
  bigArt(['(' + '@*o*'[(T * 16 | 0) & 3] + ')'], yx - 1.5 * w, yy - size / 2, size, c => c === '(' || c === ')' ? C(RED, 14) : C(WHITE, 15), () => C(RED, 4));
}
// a lit sparkler: a fizzing ball at the tip, sparks spitting out every which way (fx.spark counts down), in ASCII
function drawSparks(x, y, size) {
  g.font = size + 'px monospace';
  const w = g.measureText('M').width;
  for (let k = 0; k < 14; k++) {
    const a_ = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 2.6;
    g.fillStyle = PAL[C(Math.random() < 0.5 ? YEL : WHITE, 9 + Math.random() * 6)];
    g.fillText(r < 1.4 ? '*' : Math.random() < 0.5 ? '+' : '.', x - w / 2 + Math.cos(a_) * r * w * 1.6, y + Math.sin(a_) * r * size * 0.9);
  }
  g.fillStyle = PAL[C(WHITE, 15)]; g.fillText('@', x - w / 2, y);
}

// ---- the hotbar and the effects you're under, bottom left
function hotbar() {
  if (mode === 'drive' || mode === 'taxi' || !inv.length && !fx.caffeine && !fx.booze) return;
  let x = 6;
  const y = cv.height - FS * 2 - 10;
  inv.forEach((it, k) => {
    const s = `${k + 1} ${ITEMS[it.id].name}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`, w = g.measureText(s).width + 12;
    g.fillStyle = k === held ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, FS + 8);
    g.fillStyle = k === held ? '#fff' : 'rgba(255,255,255,0.5)'; g.fillText(s, x + 6, y + 4);
    x += w + 4;
  });
  const tags = [tickets > 0 && `${tickets} tickets`, fx.caffeine > 0 && 'caffeinated', fx.booze > 0.5 ? 'drunk' : fx.booze > 0.15 && 'tipsy', fx.skating && 'skating', fx.boombox && 'music on'].filter(Boolean);
  if (tags.length) { const s = tags.join('  '); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(6, y - FS - 10, g.measureText(s).width + 12, FS + 6); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(s, 12, y - FS - 7); }
}

// ---- shop menu and inventory: small panels over a frozen game, keyboard or mouse
let shopEl = null, invEl = null, shopCtx = null;
const panel = id => menuEl(id, 400, '<div class="panel"></div>');
function showPanel(el, html) {
  el.querySelector('.panel').innerHTML = html; el.style.display = 'flex'; paused = true;
  for (const k in K) K[k] = 0;
  if (document.pointerLockElement) document.exitPointerLock();
}
function hidePanel(el) { if (el && el.style.display !== 'none') { el.style.display = 'none'; paused = false; } }
const panelOpen = () => [shopEl, invEl, storeEl].some(el => el && el.style.display === 'flex');
// title, item ids, and the cart if it's a street vendor (for the fetch favour)
function openShop(title, stock, vendor = null) {
  shopEl = shopEl || panel('shop');
  shopCtx = { title, stock, vendor };
  const rows_ = stock.map((id, k) => { const it = ITEMS[id]; return `<button class="item" data-buy="${id}" ${money < it.price ? 'disabled' : ''}><span class="k">${k + 1}</span><span>${it.name}</span><span class="lead"></span><span class="v">${fmt$(it.price)}</span></button>`; }).join('');
  const rate = SELL_RATE[title], sells = rate ? inv.map((it, k) => { const p = sellPrice(it, rate);
    return `<button class="item" data-sell="${k}" ${p ? '' : 'disabled'}><span class="k">^${k + 1}</span><span>${ITEMS[it.id].name}</span><span class="lead"></span><span class="v">${p ? fmt$(p) : 'no'}</span></button>`; }).join('') || '<p class="sub" style="padding-left:18px">Nothing to sell.</p>' : '';
  const work = shiftHere();
  const workRow = work ? `<h2>work</h2><button class="item" data-work><span class="k">J</span><span>${work === 'serve' ? 'Wait tables for a shift' : 'Stock the shelves for a shift'}</span><span class="lead"></span><span class="v">paid</span></button>` : '';
  showPanel(shopEl, `<h1>${title[0] + title.slice(1).toLowerCase()}</h1><p class="sub">${fmt$(money)} on you &middot; carrying ${inv.length}/${INV_SIZE}</p>
    ${rate ? `<h2>buy</h2>${rows_}<h2>sell</h2>${sells}` : rows_}${workRow}<p class="hint">1-${stock.length} buy${rate ? ' &middot; shift+1-9 sell' : ''}${work ? ' &middot; J work' : ''} &middot; E / Esc close</p>`);
  shopEl.onclick = e => { const b = e.target.closest('[data-buy]'), v = e.target.closest('[data-sell]'); if (b) shopBuy(b.dataset.buy); else if (v) shopSell(+v.dataset.sell); else if (e.target.closest('[data-work]')) startShift(); };
}
function shopBuy(id) {
  const [ok, line] = buy(id);
  say(line, 3);
  if (ok && shopCtx.vendor && taskBuy(shopCtx.vendor)) say(`${line} That's the one they wanted.`, 4);
  openShop(shopCtx.title, shopCtx.stock, shopCtx.vendor); // refresh (money changed)
}
function shopSell(k) {
  say(sellSlot(k, SELL_RATE[shopCtx.title])[1], 3);
  openShop(shopCtx.title, shopCtx.stock, shopCtx.vendor);
}
const closeShop = () => hidePanel(shopEl);
// work going here? (a room's counter, not a street cart; one shift a visit)
const shiftHere = () => mode === 'room' && !shopCtx.vendor && !room.worked && SHIFT_FOR[room.kind] || null;
function startShift() {
  const id = shiftHere();
  if (!id) return;
  room.worked = true; closeShop(); startGame(id, 'shift');
}
function openInventory() {
  invEl = invEl || panel('inventory');
  const rows_ = inv.length ? inv.map((it, k) => `<button class="item" data-slot="${k}"${k === held ? ' style="color:#fff"' : ''}><span class="k">${k + 1}</span><span>${ITEMS[it.id].name}${k === held ? ' &middot; in hand' : ''}</span><span class="lead"></span><span class="v">${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? 'x' + it.uses : ''}</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Nothing. Shops sell things.</p>';
  showPanel(invEl, `<h1>Carrying</h1><p class="sub">${fmt$(money)} on you &middot; ${inv.length}/${INV_SIZE}</p>${rows_}<p class="hint">1-${INV_SIZE} hold &middot; Q use &middot; X drop &middot; I / Esc close</p>`);
  invEl.onclick = e => { const b = e.target.closest('[data-slot]'); if (b) { held = +b.dataset.slot; openInventory(); } };
}
const closeInventory = () => hidePanel(invEl);
// your storage unit: click a carried thing to put it in, a stored thing to take it out
let storeEl = null;
function openStorage() {
  storeEl = storeEl || panel('storage');
  const item = it => `${ITEMS[it.id].name}${it.uses > 0 && ITEMS[it.id].kind !== 'gear' ? ` x${it.uses}` : ''}`;
  const carried = inv.length ? inv.map((it, k) => `<button class="item" data-store="${k}"><span class="k">${k + 1}</span><span>${item(it)}</span><span class="lead"></span><span class="v">store</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Nothing in your hands.</p>';
  const unit = stored.length ? stored.map((it, k) => `<button class="item" data-take="${k}"><span class="k">${k < 9 ? '^' + (k + 1) : ''}</span><span>${item(it)}</span><span class="lead"></span><span class="v">take</span></button>`).join('') : '<p class="sub" style="padding-left:18px">Empty.</p>';
  showPanel(storeEl, `<h1>Storage unit</h1><p class="sub">The same unit at every storage place in town</p>
    <h2>carrying ${inv.length}/${INV_SIZE}</h2>${carried}
    <h2>in the unit ${stored.length}/${STORE_SIZE}</h2>${unit}
    <p class="hint">1-${INV_SIZE} store &middot; shift+1-9 take &middot; E / Esc close</p>`);
  storeEl.onclick = e => {
    const s = e.target.closest('[data-store]'), t = e.target.closest('[data-take]');
    if (s) say(storeSlot(+s.dataset.store)[1], 2); else if (t) say(retrieveSlot(+t.dataset.take)[1], 2); else return;
    openStorage();
  };
}
// keys while a panel is up; true if handled
function panelKey(e) {
  if (!panelOpen()) return false;
  if (storeEl && storeEl.style.display === 'flex') {
    const n = /^Digit([1-9])$/.exec(e.code);
    if (e.code === 'Escape' || e.code === 'KeyE') hidePanel(storeEl);
    else if (n) { say((e.shiftKey ? retrieveSlot(n[1] - 1) : storeSlot(n[1] - 1))[1], 2); openStorage(); }
    return true;
  }
  const shop = shopEl && shopEl.style.display === 'flex', n = /^Digit([1-9])$/.exec(e.code);
  if (e.code === 'Escape' || e.code === 'KeyE' && shop || e.code === 'KeyI' && !shop) { shop ? closeShop() : closeInventory(); return true; }
  if (shop && e.code === 'KeyJ' && shiftHere()) { startShift(); return true; }
  if (shop && n && e.shiftKey && SELL_RATE[shopCtx.title]) { shopSell(n[1] - 1); return true; }
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
  const [line, sound] = useHeld({ indoors: mode === 'room', x: px, y: py, a, rain, person: nearPerson(), headlines: HEADLINES(),
    water: mode === 'walk' && (seaDist(px, py) < 1.2 || blockKind(Math.floor(px / 8), Math.floor(py / 8)) === 'park' && inPond(mod(px, 8), mod(py, 8), Math.floor(px / 8) & (NB - 1), Math.floor(py / 8) & (NB - 1), 0.4)) });
  say(line, 3);
  if (actx && sound) sfxUse(sound);
}
function sfxUse(s) {
  const at = actx.currentTime;
  if (s === 'bite') playClip('eat', 0.5);
  if (s === 'sip') playClip('drink', 0.6);
  if (s === 'light') { tone(at, 2600, 0.03, 0.08, 'square'); burst(at + 0.04, 0.4, [filt('lowpass', 1500)], 0.1); }
  if (s === 'drag') { burst(at, 0.4, [filt('bandpass', 3500, 0.8)], 0.03); burst(at + 0.6, 0.9, [filt('lowpass', 900)], 0.06); }
  if (s === 'kick') { tone(at, 110, 0.12, 0.2); burst(at, 0.05, [filt('bandpass', 900, 1)], 0.15); }
  if (s === 'page') burst(at, 0.15, [filt('highpass', 2500)], 0.05);
  if (s === 'board') { tone(at, 180, 0.08, 0.12); burst(at, 0.1, [filt('bandpass', 1200, 1)], 0.1); }
  if (s === 'click') tone(at, 1800, 0.03, 0.08, 'square');
  if (s === 'chime') sfxDoor();
  if (s === 'whirr') { burst(at, 0.5, [filt('bandpass', 700, 3)], 0.05); burst(at + 0.55, 0.4, [filt('bandpass', 900, 3)], 0.04); }
  if (s === 'squeak') { const o = actx.createOscillator(), gn = actx.createGain(); o.frequency.setValueAtTime(1300, at); o.frequency.exponentialRampToValueAtTime(2100, at + 0.12);
    gn.gain.setValueAtTime(0, at); gn.gain.linearRampToValueAtTime(0.06, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.0005, at + 0.2); chain(o, gn, sfxBus); o.start(at); o.stop(at + 0.25); }
  if (s === 'harmonica') [392, 466, 523, 587, 523, 466, 392].forEach((f, k) => { // a blues lick, reedy
    tone(at + k * 0.2, f, 0.24, 0.035, 'sawtooth'); tone(at + k * 0.2, f * 2, 0.24, 0.015, 'square'); });
}
// the ball, out in the world
function drawBall() {
  if (!ball) return;
  const [vx, vy] = R(ball.x, ball.y);
  drawArt(vx, vy, ball.z, 0.035, 0.035, ['O'], (c, row, L) => C(WHITE, Math.max(L, 6)));
}
