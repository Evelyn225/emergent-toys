let altTabActive = false;
let altTabIdx = 0;
let altTabWinIds = [];
let spaceTabHeld = false;

function getAltTabWindowIds() {
  return Object.entries(wins)
    .filter(([, win]) => !win.minimized)
    .sort(([, a], [, b]) => (parseInt(b.el.style.zIndex, 10) || 0) - (parseInt(a.el.style.zIndex, 10) || 0))
    .map(([id]) => id);
}

function renderAltTab() {
  const box = document.getElementById('alttab-box');
  if (!box) return;
  if (!altTabWinIds.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '';
  const head = document.createElement('div');
  head.id = 'alttab-head';
  head.innerHTML = `
    <div id="alttab-title">Window Switcher</div>
    <div id="alttab-hint">Hold Space, tap Tab, release Space to select</div>`;
  box.appendChild(head);
  const strip = document.createElement('div');
  strip.id = 'alttab-strip';
  altTabWinIds.forEach((id, i) => {
    const w = wins[id];
    const item = document.createElement('div');
    item.className = 'alttab-item' + (i === altTabIdx ? ' focused' : '');
    item.innerHTML = '<div class="at-icon">' + (w.icon || '📄') + '</div><div class="at-label">' + (w.title || id) + '</div>';
    item.addEventListener('click', () => {
      altTabIdx = i;
      commitAltTab();
    });
    strip.appendChild(item);
  });
  box.appendChild(strip);
}

function openAltTab(direction) {
  const ids = getAltTabWindowIds();
  if (ids.length === 0) return;
  const step = direction === -1 ? -1 : 1;
  altTabWinIds = ids;
  if (!altTabActive) altTabIdx = ids.length === 1 ? 0 : (step > 0 ? 1 : ids.length - 1);
  else altTabIdx = (altTabIdx + step + ids.length) % ids.length;
  renderAltTab();
  document.getElementById('alttab-overlay').classList.add('active');
  altTabActive = true;
}

function commitAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  const id = altTabWinIds[altTabIdx];
  if (id && wins[id]) {
    if (wins[id].minimized) unminWin(id);
    else focusWin(id);
  }
  altTabWinIds = [];
}

function closeAltTab() {
  document.getElementById('alttab-overlay').classList.remove('active');
  altTabActive = false;
  altTabIdx = 0;
  altTabWinIds = [];
  renderAltTab();
}

function closeCad() {
  document.getElementById('cad-overlay').classList.remove('active');
}
function cadAction(type) {
  closeCad();
  if (type === 'lock') {
    const lock = document.createElement('div');
    lock.id = 'lock-screen';
    lock.style.cssText = 'position:fixed;inset:0;z-index:99995;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;';
    lock.innerHTML = `
      <div style="color:#888;font-size:28px;">🔒</div>
      <div style="color:#ccc;font-size:13px;font-family:var(--sleep-font);">sleepOS is locked</div>
      <div style="color:#666;font-size:11px;font-family:var(--sleep-font);">Press any key or click to unlock</div>`;
    document.body.appendChild(lock);
    const unlock = () => { lock.remove(); };
    lock.addEventListener('click', unlock);
    lock.addEventListener('keydown', unlock);
    setTimeout(() => lock.addEventListener('keydown', unlock), 100);
  } else if (type === 'taskmgr') {
    openSysmon();
  } else if (type === 'shutdown') {
    doShutdown();
  }
}

// ── Global keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  // Don't fire in inputs/textareas (except specific shortcuts)
  const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
  const key = String(e.key || '').toLowerCase();
  const secureAttention = e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && key === 'q';

  if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (!inInput) {
      spaceTabHeld = true;
      e.preventDefault();
    }
    return;
  }
  if (!inInput && e.key === 'Tab' && spaceTabHeld && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    openAltTab(e.shiftKey ? -1 : 1);
    return;
  }
  if (inInput && !secureAttention) return;

  // Ctrl+Shift+Q - secure attention sequence
  if (secureAttention) {
    e.preventDefault();
    document.getElementById('cad-overlay').classList.add('active');
    return;
  }

  // Escape - close context menus / dismiss overlays
  if (e.key === 'Escape') {
    closeDropdown();
    closeStart();
    const cad = document.getElementById('cad-overlay');
    if (cad.classList.contains('active')) cad.classList.remove('active');
    if (altTabActive) closeAltTab();
    return;
  }

});
document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  const wasHeld = spaceTabHeld;
  spaceTabHeld = false;
  if (!wasHeld || !altTabActive) return;
  e.preventDefault();
  commitAltTab();
});
window.addEventListener('blur', () => {
  spaceTabHeld = false;
  if (altTabActive) closeAltTab();
});

// ─────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────
