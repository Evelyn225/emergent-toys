// ===== touch: on a phone or tablet. A floating stick under the left thumb walks (or drives: push it to the rim to
// run), dragging anywhere on the right looks round. Buttons are words, not keys, and only the ones that do something
// right here show: the big one is whatever E would do (Talk, Enter, Get in...), smaller ones pop up beside it when
// they apply (Hail taxi, Pick pocket, a taxi's destinations), and everything else lives in the More sheet up top.
// Everything goes through the same key handlers as the keyboard (synthetic keydown / keyup), so nothing in the game
// knows the difference. Menus are plain HTML: tap their rows.
const TOUCH_CSS = `
  #touch { position: fixed; inset: 0; z-index: 900; pointer-events: none; font: 15px/1.1 'W95', monospace; }
  #touch button { pointer-events: auto; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.55);
    color: rgba(255,255,255,0.9); font: inherit; touch-action: none; user-select: none; -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent; padding: 0 12px; height: 44px; border-radius: 22px; white-space: nowrap; }
  #touch button.down { background: rgba(255,255,255,0.25); color: #fff; }
  #touch .bar { position: absolute; top: calc(8px + env(safe-area-inset-top)); right: calc(8px + env(safe-area-inset-right)); display: flex; gap: 6px; }
  #touch .bar button { height: 36px; border-radius: 6px; padding: 0 10px; }
  #touch .bar button.on { background: rgba(255,255,255,0.2); }
  #touch .sheet { position: absolute; top: calc(52px + env(safe-area-inset-top)); right: calc(8px + env(safe-area-inset-right)); display: none;
    grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; background: rgba(6,6,8,0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; pointer-events: auto; }
  #touch .sheet.open { display: grid; }
  #touch .sheet button { border-radius: 6px; min-width: 110px; }
  #touch .pad { position: absolute; right: calc(14px + env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  #touch .pops { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  #touch .row { display: flex; align-items: flex-end; gap: 10px; }
  #touch .main { min-width: 92px; height: 64px; border-radius: 32px; font-size: 17px; background: rgba(255,240,140,0.18); border-color: rgba(255,240,140,0.6); color: #ffe98a; }
  #touch .jump { width: 56px; height: 56px; border-radius: 50%; padding: 0; }
  #touch .stick { position: absolute; width: 110px; height: 110px; margin: -55px 0 0 -55px; border: 1px solid rgba(255,255,255,0.25);
    border-radius: 50%; display: none; }
  #touch .nub { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; background: rgba(255,255,255,0.25); border-radius: 50%; display: none; }
  canvas { touch-action: none; }
  body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; }`;
// how much of the screen the buttons take, for the HUD and the minigames to keep clear of (px)
const TOUCH_PAD_W = 180, TOUCH_PAD_H = 190;
let touchEl = null, sheetOpen = false;
function keyDown(code) { onkeydown({ code, repeat: false }); }
function keyUp(code) { onkeyup({ code }); }

// the big button's label: what E does here, as a word or two (from the prompt line, so it always agrees with it)
const E_WORDS = [[/^talk/, 'Talk'], [/^hand it over/, 'Give'], [/^(get in|take this car)/, 'Get in'], [/^get out/, 'Get out'],
  [/^get off/, 'Get off'], [/^board/, 'Board'], [/^pick up/, 'Pick up'], [/^buy/, 'Buy'], [/^shop/, 'Shop'], [/^play/, 'Play'],
  [/^(enter|go into|go in)/, 'Enter'], [/^go down|stairs down|take the stairs down|back down/, 'Go down'], [/^up/, 'Go up'],
  [/^elevator/, 'Elevator'], [/^leave|the guard lets you out/, 'Leave'], [/^sleep/, 'Sleep'], [/^your closet/, 'Closet'],
  [/^telly/, 'TV'], [/^book/, 'Book room'], [/^try to break out/, 'Break out'], [/^prize counter/, 'Prizes'],
  [/^your storage/, 'Storage'], [/^call the dog/, 'Call dog'], [/^the till/, 'Till'], [/machine$/, 'Buy'], [/^ride/, 'Ride'], [/^prize stall/, 'Prizes'], [/^run a wash/, 'Wash'], [/^take out/, 'Take out'], [/^touch the touch pool/, 'Touch'], [/^light a candle/, 'Candle'], [/^sit in on a hand/, 'Play'], [/^climb/, 'Climb'], [/^go into/, 'Enter'], [/^back down/, 'Go down'], [/^rent a swan/, 'Rent boat'], [/^back to the jetty/, 'Jetty'], [/^feed the ducks/, 'Feed ducks'], [/^work a shift/, 'Work'], [/^a cup of seed/, 'Buy seed']];
function eLabel(p) {
  const m = /(?:^|\s)E(?: \([^)]*\))?: ([^"]+?)(?:\s{3}|$)/.exec(p);
  if (!m) return '';
  const s = m[1].toLowerCase();
  for (const [re, w] of E_WORDS) if (re.test(s)) return w;
  return m[1].split(' ').slice(0, 2).join(' ');
}
const TAXI_STOPS = ['Park', 'Across town', 'Anywhere', 'Waterfront', 'Subway'];
const ITEM_VERB = { drink: 'Drink', food: 'Eat', smoke: 'Smoke', toy: 'Play', gear: 'Use' };
// [label, key, kind] for what's worth a button right now. kind: main (the big one) | jump | pop (pops up beside it)
function touchActions() {
  if (sleep || bustedEl && bustedEl.style.display === 'flex') return []; // (busted: tap a row)
  if (panelOpen() || prizeEl && prizeEl.style.display === 'flex') return [['Close', 'KeyE', 'main']];
  if (game) {
    if (game.g.over) return game.kind === 'arcade' ? [['Leave', 'KeyE', 'pop'], [`Again ${fmt$(CREDIT)}`, 'Space', 'main']] : game.kind === 'table' ? [['Leave', 'KeyE', 'pop'], [`Again ${fmt$(MJ_BUYIN)}`, 'Space', 'main']] : [['Done', 'KeyE', 'main']];
    if (game.g.id === 'mahjong') return [['Leave', 'KeyE', 'pop'], ['Mahjong!', 'ArrowUp', 'pop'], [game.g.state() === 'claim' ? 'Pass' : 'Throw', 'Space', 'main']];
    return [[game.kind === 'shift' ? 'Clock off' : game.kind === 'crime' ? 'Back off' : 'Leave', 'KeyE', 'pop'], ['Go', 'Space', 'main']];
  }
  const out = [], p = promptText(), e = eLabel(p);
  if (mode === 'taxi') {
    if (!me.dest) { TAXI_STOPS.forEach((s, k) => out.push([s, 'Digit' + (k + 1), 'pop'])); if (owned.homes.length) out.push(['Home', 'Digit6', 'pop']); }
    else if (!me.rush) out.push([`Tip ${fmt$(TIP)}`, 'KeyG', 'pop']);
    out.push(['Camera', 'KeyV', 'pop'], ['Get out', 'KeyE', 'main']);
    return out;
  }
  if (mode === 'drive') return [['Camera', 'KeyV', 'pop'], ['Get out', 'KeyE', 'main']];
  if (mode === 'room' && room.kind === 'train' && room.dest == null) room.opts.forEach((s, k) => out.push([stations[s].name, 'Digit' + (k + 1), 'pop']));
  if (onFootMode()) {
    if (/\bJ: /.test(p)) out.push(['Drive taxi', 'KeyJ', 'pop']);
    if (/\bH: /.test(p)) out.push(['Hail taxi', 'KeyH', 'pop']);
    if (/\bG: pick/.test(p)) out.push(['Pick pocket', 'KeyG', 'pop']);
    if (/\bG: take/.test(p)) out.push(['Grab', 'KeyG', 'pop']);
    if (/\bL: /.test(p)) out.push(['Pick lock', 'KeyL', 'pop']);
    const it = heldItem();
    if (it) { out.push([it.id === 'spraypaint' ? 'Spray' : ITEM_VERB[ITEMS[it.id].kind] || 'Use', 'KeyQ', 'pop']); if (it.id === 'boombox' && fx.boombox) out.push(['Next tape', 'KeyB', 'pop']); }
    if (skatingNow()) out.push(['Camera', 'KeyV', 'pop']);
    if (body.seat) out.push(['Stand', 'KeyC', 'pop']); else if (nearSeat()) out.push(['Sit', 'KeyC', 'pop']);
    out.push(['Jump', 'Space', 'jump']);
  }
  if (e) out.push([e, 'KeyE', 'main']);
  return out;
}
// the More sheet: [label, key, when]. Held buttons (Fast-forward) work while held, the rest close the sheet
const SHEET = [
  ['Crouch', 'KeyC', () => onFootMode() && !body.seat, true], ['Drop item', 'KeyX', () => onFootMode() && !!heldItem()],
  ['Empty hands', 'Digit0', () => onFootMode() && held >= 0], ['Shoplift', 'KeyG', () => onFootMode() && canShoplift()],
  ['Hail taxi', 'KeyH', () => mode === 'walk'], ['Fast-forward', 'KeyT', null, true], ['Weather', 'KeyY'], ['Sound on/off', 'KeyN'],
];

function bindHold(b, k, after) { // a button holds its key down for as long as it's touched
  b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); keyDown(k); }, { passive: false });
  const up = e => { e.preventDefault(); b.classList.remove('down'); keyUp(k); if (after) after(); };
  b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
}
function buildTouch() {
  const s = document.createElement('style'); s.textContent = TOUCH_CSS; document.head.appendChild(s);
  menuStyle(); // (the W95 font comes in with the menu stylesheet)
  touchEl = document.createElement('div'); touchEl.id = 'touch';
  touchEl.innerHTML = '<div class="stick"></div><div class="nub"></div>'
    + '<div class="bar"><button data-key="KeyI">Bag</button><button data-key="KeyM">Map</button><button data-more>More</button><button data-key="Escape">II</button></div>'
    + `<div class="sheet">${SHEET.map(([l, k]) => `<button data-sheet="${l}">${l}</button>`).join('')}</div>`
    + '<div class="pad"><div class="pops"></div><div class="row"></div></div>';
  document.body.appendChild(touchEl);
  for (const b of touchEl.querySelectorAll('.bar [data-key]')) bindHold(b, b.dataset.key, () => setSheet(false));
  const more = touchEl.querySelector('[data-more]');
  more.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); setSheet(!sheetOpen); }, { passive: false });
  SHEET.forEach(([l, k, , holdIt]) => bindHold(touchEl.querySelector(`[data-sheet="${l}"]`), k, holdIt ? null : () => setSheet(false)));
  setInterval(showTouch, 120);
}
function setSheet(on) { sheetOpen = on; touchEl.querySelector('.sheet').classList.toggle('open', on); touchEl.querySelector('[data-more]').classList.toggle('on', on); }
let padSig = '';
function showTouch() {
  const pauseUp = typeof pauseEl !== 'undefined' && pauseEl && pauseEl.style.display !== 'none' && paused;
  touchEl.style.display = pauseUp ? 'none' : 'block'; // (a shop or the bag pauses too, but Close shuts it: keep the buttons)
  const busy = !!game || sleep || panelOpen();
  touchEl.querySelector('.bar').style.visibility = busy ? 'hidden' : 'visible';
  if (busy && sheetOpen) setSheet(false);
  touchEl.querySelector('[data-key="KeyM"]').classList.toggle('on', showMap);
  for (const [l, , when] of SHEET) touchEl.querySelector(`[data-sheet="${l}"]`).style.display = !when || when() ? '' : 'none';
  // the pad: rebuilt only when what's on it changes (a button being held keeps its key down until it's let go)
  const acts = touchActions(), sig = acts.map(x => x.join(':')).join('|');
  if (sig === padSig || touchEl.querySelector('.pad button.down')) return;
  padSig = sig;
  const btn = ([l, k, kind]) => { const b = document.createElement('button'); b.textContent = l; b.dataset.key = k; if (kind !== 'pop') b.className = kind; bindHold(b, k); return b; };
  const pops = touchEl.querySelector('.pops'), row = touchEl.querySelector('.row');
  pops.replaceChildren(...acts.filter(x => x[2] === 'pop').map(btn));
  row.replaceChildren(...acts.filter(x => x[2] !== 'pop').map(btn));
}

// the stick: wherever the left thumb lands, it measures from there. Its direction holds W / A / S / D down, and
// pushed right out to the rim, Shift too
const STICK_R = 50, stickKeys = new Set();
let stickId = null, stickX = 0, stickY = 0, lookId = null, lookX = 0, lookY = 0;
function setStick(dx, dy) {
  const m = Math.hypot(dx, dy) / STICK_R, want = new Set();
  if (m > 0.3) {
    if (dy < -0.38 * STICK_R) want.add('KeyW'); if (dy > 0.38 * STICK_R) want.add('KeyS');
    if (dx < -0.38 * STICK_R) want.add('KeyA'); if (dx > 0.38 * STICK_R) want.add('KeyD');
    if (m > 0.95 && !game) want.add('ShiftLeft');
  }
  for (const k of stickKeys) if (!want.has(k)) { keyUp(k); stickKeys.delete(k); }
  for (const k of want) if (!stickKeys.has(k)) { keyDown(k); stickKeys.add(k); }
  const c = Math.min(1, m) / (m || 1), nub = touchEl.querySelector('.nub');
  nub.style.left = stickX + dx * c + 'px'; nub.style.top = stickY + dy * c + 'px';
}
function onTouch(e) {
  if (paused) return;
  if (e.type === 'touchstart' && sheetOpen) setSheet(false); // a tap on the world puts the sheet away
  for (const t of e.changedTouches) {
    if (e.type === 'touchstart') {
      audioStart();
      if (t.clientX < innerWidth * 0.45 && stickId === null) {
        stickId = t.identifier; stickX = t.clientX; stickY = t.clientY;
        for (const el of touchEl.querySelectorAll('.stick, .nub')) { el.style.display = 'block'; el.style.left = stickX + 'px'; el.style.top = stickY + 'px'; }
      } else if (lookId === null) { lookId = t.identifier; lookX = t.clientX; lookY = t.clientY; }
    } else if (e.type === 'touchmove') {
      if (t.identifier === stickId) setStick(t.clientX - stickX, t.clientY - stickY);
      if (t.identifier === lookId) { turnBy((t.clientX - lookX) * 1.6, (t.clientY - lookY) * 1.6); lookX = t.clientX; lookY = t.clientY; }
    } else { // let go
      if (t.identifier === stickId) { stickId = null; setStick(0, 0); for (const el of touchEl.querySelectorAll('.stick, .nub')) el.style.display = 'none'; }
      if (t.identifier === lookId) lookId = null;
    }
  }
  e.preventDefault();
}
if (TOUCH) {
  buildTouch();
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) cv.addEventListener(ev, onTouch, { passive: false });
}
