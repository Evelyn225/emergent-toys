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
function showDropdown(anchor, items) {
  closeDropdown();
  const rect = anchor.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  dd.style.left = rect.left + 'px'; dd.style.top = rect.bottom + 'px';
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'menu-dd-item' + (item.disabled ? ' disabled' : '');
      el.textContent = item.label;
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

function showCtxMenu(x, y, items) {
  closeDropdown();
  const dd = document.createElement('div');
  dd.className = 'menu-dropdown'; dd.id = 'active-dropdown';
  // Keep menu on screen
  dd.style.left = x + 'px'; dd.style.top = y + 'px';
  items.forEach(item => {
    if (item === '-') {
      const sep = document.createElement('div'); sep.className = 'menu-dd-sep'; dd.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'menu-dd-item' + (item.disabled ? ' disabled' : '');
      el.textContent = item.label;
      if (!item.disabled) el.addEventListener('pointerdown', e => { e.stopPropagation(); closeDropdown(); item.action(); });
      dd.appendChild(el);
    }
  });
  document.body.appendChild(dd);
  // Clamp to viewport
  const r = dd.getBoundingClientRect();
  if (r.right  > window.innerWidth)  dd.style.left = (x - r.width)  + 'px';
  if (r.bottom > window.innerHeight) dd.style.top  = (y - r.height) + 'px';
  setTimeout(() => {
    document.addEventListener('mousedown', closeDropdown, { once: true });
    document.addEventListener('touchstart', closeDropdown, { once: true, passive: true });
  }, 0);
}

// ── OS-native dialog replacements (no browser prompt/alert/confirm) ──
function _osDlgPos(w, h) {
  return { x: Math.max(20, Math.floor(window.innerWidth/2)  - Math.floor(w/2)),
           y: Math.max(20, Math.floor(window.innerHeight/2) - Math.floor(h/2)) };
}
function osAlert(msg, title, icon) {
  title = title || 'sleepOS'; icon = icon || '🔔';
  const id = 'os-alert-' + Date.now();
  const p = _osDlgPos(320, 175);
  if (!mkWin({ id, title, icon, w:320, h:175, x:p.x, y:p.y, menubar:false, statusbar:false, popup:true })) return;
  const b = document.getElementById('wb-' + id);
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${icon}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns"><button class="dlg-btn primary" id="${id}-ok">OK</button></div>`;
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
  b.innerHTML = `<div class="dlg-body"><div class="dlg-icon">${icon}</div><div class="dlg-text" style="white-space:pre-wrap;">${(msg+'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div><div class="dlg-btns" id="${id}-btns"></div>`;
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

