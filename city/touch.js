// ===== touch: on a phone or tablet. A floating stick under the left thumb walks (or drives: push it to the rim to
// run), dragging anywhere on the right looks round, and buttons down the right stand in for the keys. Everything goes
// through the same key handlers as the keyboard (synthetic keydown / keyup), so nothing in the game knows the
// difference. Menus are plain HTML: tap their rows.
const TOUCH_KEYS = [ // [label, key, when it shows (always if absent)]
  ['A', 'Space', () => !!game || onFootMode() && !me], ['C', 'KeyC', () => !game && onFootMode()], ['E', 'KeyE'], ['Q', 'KeyQ', () => !game && !me], ['I', 'KeyI', () => !game && !me], ['M', 'KeyM', () => !game],
  ['H', 'KeyH', () => !game && mode === 'walk'], ['G', 'KeyG', () => !game && (mode === 'walk' || mode === 'room' || mode === 'taxi')],
  ['T', 'KeyT', () => !game], ['Y', 'KeyY', () => !game],
];
const TOUCH_CSS = `
  #touch { position: fixed; inset: 0; z-index: 900; pointer-events: none; font: 500 16px/1 'DM Mono', monospace; }
  #touch button { pointer-events: auto; position: absolute; width: 48px; height: 48px; border: 1px solid rgba(255,255,255,0.28);
    background: rgba(0,0,0,0.45); color: rgba(255,255,255,0.85); font: inherit; touch-action: none; user-select: none;
    -webkit-user-select: none; -webkit-tap-highlight-color: transparent; padding: 0; }
  #touch button.down { background: rgba(255,255,255,0.22); color: #fff; }
  #touch button.big { width: 64px; height: 64px; font-size: 22px; }
  #touch .stick { position: absolute; width: 110px; height: 110px; margin: -55px 0 0 -55px; border: 1px solid rgba(255,255,255,0.25);
    border-radius: 50%; display: none; }
  #touch .nub { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; background: rgba(255,255,255,0.25); border-radius: 50%; display: none; }
  #touch .digits { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); display: none; gap: 8px; }
  #touch .digits button { position: static; }
  canvas { touch-action: none; }
  body { overscroll-behavior: none; -webkit-user-select: none; user-select: none; }`;
let touchEl = null;
function keyDown(code) { onkeydown({ code, repeat: false }); }
function keyUp(code) { onkeyup({ code }); }

function buildTouch() {
  const s = document.createElement('style'); s.textContent = TOUCH_CSS; document.head.appendChild(s);
  touchEl = document.createElement('div'); touchEl.id = 'touch';
  touchEl.innerHTML = `<div class="stick"></div><div class="nub"></div><div class="digits">${[1, 2, 3, 4, 5].map(n => `<button data-key="Digit${n}">${n}</button>`).join('')}</div>`
    + `<button data-key="Escape" style="top:10px;right:10px">II</button>`
    + TOUCH_KEYS.map(([l, k]) => `<button data-key="${k}"${l === 'E' || l === 'A' ? ' class="big"' : ''}>${l}</button>`).join('');
  document.body.appendChild(touchEl);
  // a button holds its key down for as long as it's touched (T fast-forwards while held, A works a paddle)
  for (const b of touchEl.querySelectorAll('button')) {
    const k = b.dataset.key;
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); keyDown(k); }, { passive: false });
    const up = e => { e.preventDefault(); b.classList.remove('down'); keyUp(k); };
    b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
  }
  layoutTouch(); addEventListener('resize', layoutTouch);
  setInterval(showTouch, 150);
}
// the buttons in columns up the right edge, E (or A, in a game) biggest and lowest, under the thumb; a column that
// would reach the pause button wraps into the next one to its left
function layoutTouch() {
  const top = 70, gap = 8;
  let y = innerHeight - 16, col = 0;
  for (const b of touchEl.querySelectorAll('button:not([data-key="Escape"]):not(.digits button)')) {
    if (b.style.display === 'none') continue;
    const h = b.classList.contains('big') ? 64 : 48;
    if (y - h < top) { col++; y = innerHeight - 16; }
    const slot = y === innerHeight - 16 ? 64 : h; // every column's bottom slot is E-sized, so the rows above line up
    y -= slot; b.style.top = y + (slot - h) / 2 + 'px'; b.style.right = 16 + col * (64 + gap) + (64 - h) / 2 + 'px'; y -= gap;
  }
}
function showTouch() {
  const pauseUp = typeof pauseEl !== 'undefined' && pauseEl && pauseEl.style.display !== 'none' && paused;
  touchEl.style.display = pauseUp ? 'none' : 'block'; // (a shop or the bag pauses too, but E closes it: keep the buttons)
  let changed = false;
  for (const [l, k, when] of TOUCH_KEYS) {
    const b = touchEl.querySelector(`[data-key="${k}"]`), show = !when || when() ? '' : 'none';
    if (b.style.display !== show) { b.style.display = show; changed = true; }
  }
  if (changed) layoutTouch();
  const pick = (mode === 'taxi' && me && !me.dest) || (mode === 'room' && room && room.kind === 'train' && room.dest == null);
  touchEl.querySelector('.digits').style.display = pick ? 'flex' : 'none';
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
