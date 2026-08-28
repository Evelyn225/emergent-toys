let _dragCount = 0;
document.addEventListener('dragenter', e => {
  if (getShellDragPayload()) return;
  if ([...e.dataTransfer.types].includes('Files') && !e.target.closest?.('.os-window')) {
    _dragCount++;
    document.getElementById('drop-overlay').classList.add('active');
  }
});
document.addEventListener('dragleave', () => {
  _dragCount = Math.max(0, _dragCount - 1);
  if (_dragCount === 0) document.getElementById('drop-overlay').classList.remove('active');
});
document.addEventListener('dragover', e => {
  if (getShellDragPayload()) return;
  if (![...e.dataTransfer.types].includes('Files')) return;
  if (e.target.closest?.('.os-window')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', e => {
  if (e.defaultPrevented || getShellDragPayload()) return;
  if (!e.dataTransfer.files.length) return;
  if (e.target.closest?.('.os-window')) return;
  e.preventDefault();
  _dragCount = 0;
  document.getElementById('drop-overlay').classList.remove('active');
  _uploadCwd = 'DESKTOP';
  handleFileUpload(e.dataTransfer.files);
});
document.getElementById('file-upload-input').addEventListener('change', function() {
  if (this.files.length) handleFileUpload(this.files);
  this.value = '';
});

// Shared dropdown menu helpers
function closeDropdown() {
  const old = document.getElementById('active-dropdown');
  if (old) old.remove();
}
// A menu item may carry an `icon`. Items are laid out with a fixed 16px gutter
// so their labels line up whether or not each one has art - but only if some
// item in THIS menu has an icon, so the File/Edit/View menubar dropdowns, which
// never do, stay as tight as they were.
function buildMenuItemEl(item, gutter) {
  const el = document.createElement('div');
  el.className = 'menu-dd-item' + (item.disabled ? ' disabled' : '') + (gutter ? ' has-gutter' : '');
  if (gutter) {
    const ic = document.createElement('span');
    ic.className = 'menu-dd-icon';
    ic.innerHTML = iconMarkup(item.icon || '');
    el.appendChild(ic);
  }
  const label = document.createElement('span');
  label.textContent = item.label;
  el.appendChild(label);
  return el;
}
function menuNeedsGutter(items) {
  return items.some(item => item !== '-' && item.icon);
}
function showDropdown(anchor, items) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
  const gutter = menuNeedsGutter(items);
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = buildMenuItemEl(item, gutter);
      if (!item.disabled) el.addEventListener('mousedown', e => { e.stopPropagation(); closeDropdown(); item.action(); });
      dd.appendChild(el);
    }
  });
  document.body.appendChild(dd);
  setTimeout(() => document.addEventListener('mousedown', closeDropdown, { once: true }), 0);
}
// Long-press to context menu on touch - dispatches synthetic contextmenu event
let _longPressActive = false;
function addLongPress(el) {
  let timer, startX, startY;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      _longPressActive = true;
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: startX, clientY: startY }));
    }, 500);
  }, { passive: true });
  el.addEventListener('pointermove', e => {
    if (!timer) return;
    if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) { clearTimeout(timer); timer = null; }
  }, { passive: true });
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerup', cancel, { passive: true });
  el.addEventListener('pointercancel', cancel, { passive: true });
}

function showCtxMenu(x, y, items, opts) {
  closeDropdown();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  // Keep menu on screen
  dd.style.left = x + 'px'; dd.style.top = y + 'px';
  const gutter = menuNeedsGutter(items);
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = buildMenuItemEl(item, gutter);
      if (!item.disabled) el.addEventListener('pointerdown', e => { e.stopPropagation(); closeDropdown(); item.action(); });
      dd.appendChild(el);
    }
  });
  document.body.appendChild(dd);
  // Clamp to viewport
  const r = dd.getBoundingClientRect();
  if (r.right  > window.innerWidth)  dd.style.left = (x - r.width)  + 'px';
  if (opts && opts.anchorBottom) {
    // Callers anchored to the bottom edge of a bar want the menu ABOVE that
    // edge whether or not it would have overflowed the viewport. Leaving
    // this to the overflow clamp only works while the menu is taller than
    // the bar, which is false for the shorter mobile taskbar menu.
    dd.style.top = Math.max(0, y - r.height) + 'px';
  } else if (r.bottom > window.innerHeight) {
    dd.style.top = (y - r.height) + 'px';
  }
  setTimeout(() => {
    document.addEventListener('mousedown', closeDropdown, { once: true });
    document.addEventListener('touchstart', closeDropdown, { once: true, passive: true });
  }, 0);
}

// ── System toast ──────────────────────────────────────────────────
// A disk-full notice is useless if anything can cover it, so the toast sits at
// 99993: above every window, the 28px taskbar (9000), the start menu (9001)
// and the alt-tab / CAD / sleep overlays (99990-99992), and below the
// daemon-fx, glitch, CRT and context-menu layers. A low z-index fails twice
// over - the bar renders underneath the taskbar it is anchored to, and zTop
// starts at 100 and increments on every window FOCUS, not just creation, so
// windows climb past a three-digit value during an ordinary session.
var _osToastHideTimer = null;
var _osToastClearTimer = null;

function showOsToast(message) {
  let el = document.getElementById('os-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'os-toast';
    // pointer-events:none, following #crt: the bar must never swallow a click
    // aimed at the desktop, and it is anchored 8px above the taskbar so the
    // start button stays reachable while it is showing.
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'transform:translateX(-50%)',
      'bottom:36px',
      'z-index:99993',
      'max-width:min(520px, calc(100vw - 32px))',
      'padding:12px',
      'background:rgba(20,14,20,0.94)',
      'border:1px solid rgba(154,179,147,0.18)',
      'box-shadow:0 2px 14px rgba(0,0,0,0.55)',
      'font-family:var(--sleep-font)',
      'font-size:12px',
      'line-height:1.5',
      'color:rgba(255,255,255,0.8)',
      'text-align:center',
      'pointer-events:none',
      'opacity:0',
      'display:none',
    ].join(';') + ';';
    document.body.appendChild(el);
  }
  // One element, reused. A full disk fails its commit again on every retry and
  // a column of identical toasts would bury the screen it is trying to warn
  // about; the newest message replaces the old one and restarts the clock.
  el.textContent = String(message == null ? '' : message);
  // The toast only ever reports a failure (a commit that could not be saved),
  // so unlike osAlert it needs no test for what kind of message this is.
  playSound('error');
  clearTimeout(_osToastHideTimer);
  clearTimeout(_osToastClearTimer);
  // Appearing is SYNCHRONOUS and deliberately has no transition. A fade-in out
  // of display:none does not start in the tick the element becomes displayed -
  // there is no before-change style to interpolate from - so the declared
  // transition pinned the computed opacity at 0 and the toast never appeared:
  // display:block, correctly positioned, inline opacity 1, nothing on screen.
  // Deferring to requestAnimationFrame fixes that only where frames are
  // running; it was still invisible after four seconds on a frame-starved
  // renderer. This is the one message that tells the user their work was not
  // saved, so its visibility must not depend on the frame clock at all.
  el.style.transition = 'none';
  el.style.display = 'block';
  el.style.opacity = '1';
  _osToastHideTimer = setTimeout(() => {
    // Fading OUT can safely use a transition: if it never runs, the toast
    // simply disappears when display flips instead of dissolving.
    el.style.transition = 'opacity 320ms ease';
    el.style.opacity = '0';
    _osToastClearTimer = setTimeout(() => { el.style.display = 'none'; }, 400);
  }, 6000);
}

// ── OS-native dialog replacements (no browser prompt/alert/confirm) ──
function _osDlgPos(w, h) {
  return { x: Math.max(20, Math.floor(window.innerWidth/2)  - Math.floor(w/2)),
           y: Math.max(20, Math.floor(window.innerHeight/2) - Math.floor(h/2)) };
}
// osAlert is also the About and Help dialog, so an unconditional buzz would
// fire on "About DEFRAG.exe". Only failures get the sound, recognised from the
// two arguments every call site already passes.
//
// 'icon:error' leads the list because it is what this codebase actually uses
// for a failure - Paste Failed, Upload Failed, Cannot Open, Cannot Create,
// Cannot Save, Disk Full, Rename Failed, Missing Shortcut all pass it, and
// nothing informational does. 'icon:warning' covers the softer refusals
// (blocked delete, access denied, drive not found).
//
// The bare emoji are kept alongside the tokens. Nothing in the OS passes them
// any more, but they cost one Set entry each and they are what a stale window
// or an old persisted shortcut would still carry.
//
// Deliberately NOT matched against the message body, only the title and icon.
// The body is where the tempting words are, and also where they lie: Help
// Topics for DEFRAG.exe contains "some system files cannot be moved", which a
// body scan would hear as an error.
const ALERT_ERROR_ICONS = new Set(['icon:error', 'icon:warning', 'X', '⚠', '⚠️', '❌', '\u{1F6AB}', '⛔', '\u{1F4A5}']);
const ALERT_ERROR_TITLE = /\b(error|fail(ed|ure|s)?|denied|invalid|refused|corrupt|unavailable|not found|no such|cannot|can't)\b/i;
function isErrorAlert(title, icon) {
  return ALERT_ERROR_ICONS.has(String(icon == null ? '' : icon).trim())
      || ALERT_ERROR_TITLE.test(String(title == null ? '' : title));
}

function osAlert(msg, title, icon) {
  title = title || 'sleepOS'; icon = icon || 'icon:tip';
  const id = 'os-alert-' + Date.now();
  const p = _osDlgPos(320, 175);
  if (!mkWin({ id, title, icon, w:320, h:175, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  if (isErrorAlert(title, icon)) playSound('error');
  const b = document.getElementById('wb-' + id);
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${iconMarkup(icon)}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns"><button class="dlg-btn primary" id="${id}-ok">OK</button></div>`;
  const ok = document.getElementById(id + '-ok');
  ok.onclick = () => closeWin(id);
  ok.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') closeWin(id); });
  setTimeout(() => ok.focus(), 40);
}
function osConfirm(msg, title, cb, icon) {
  title = title || 'Confirm'; icon = icon || '❓';
  const id = 'os-confirm-' + Date.now();
  const p = _osDlgPos(320, 175);
  if (!mkWin({ id, title, icon, w:320, h:175, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const b = document.getElementById('wb-' + id);
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${iconMarkup(icon)}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns" id="${id}-btns"></div>`;
  const row = document.getElementById(id + '-btns');
  const ok  = document.createElement('button'); ok.className  = 'dlg-btn primary'; ok.textContent = 'OK';
  const can = document.createElement('button'); can.className = 'dlg-btn';         can.textContent = 'Cancel';
  ok.onclick  = () => { closeWin(id); cb(true);  };
  can.onclick = () => { closeWin(id); cb(false); };
  [ok, can].forEach(btn => btn.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
    if (e.key === 'Escape') can.click();
  }));
  row.appendChild(ok); row.appendChild(can);
  setTimeout(() => ok.focus(), 40);
}
function osPrompt(msg, def, title, cb, icon) {
  title = title || 'Input'; icon = icon || '✏️'; def = def ?? '';
  const id = 'os-prompt-' + Date.now();
  const p = _osDlgPos(340, 185);
  if (!mkWin({ id, title, icon, w:340, h:185, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const b = document.getElementById('wb-' + id);
  b.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:8px;font-size:11px;';
  const msgDiv = document.createElement('div');
  msgDiv.style.whiteSpace = 'pre-wrap'; msgDiv.textContent = msg;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = def;
  inp.style.cssText = 'border:2px solid;border-color:#808080 #fff #fff #808080;padding:2px 4px;font-family: var(--sleep-font);font-size:11px;background:#fff;width:100%;box-sizing:border-box;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;';
  const ok  = document.createElement('button'); ok.className  = 'dlg-btn primary'; ok.textContent = 'OK';
  const can = document.createElement('button'); can.className = 'dlg-btn';         can.textContent = 'Cancel';
  ok.onclick  = () => { const v = inp.value; closeWin(id); cb(v.trim() || null); };
  can.onclick = () => { closeWin(id); cb(null); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') can.click(); });
  row.appendChild(ok); row.appendChild(can);
  b.appendChild(msgDiv); b.appendChild(inp); b.appendChild(row);
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
}

