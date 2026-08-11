function mkWin({ id, title, icon = 'icon:text', x, y, w = 500, h = 380,
                 menubar = true, statusbar = true, popup = false }) {
  if (wins[id]) { focusWin(id); unminWin(id); return null; }

  // Default position: slightly random cascade; on mobile fill viewport (except small popups)
  const count = Object.keys(wins).length;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  const taskbarH = isMobile ? 44 : 28;
  if (isMobile && !popup) {
    x = 0; y = 0;
    w = window.innerWidth;
    h = window.innerHeight - taskbarH;
  } else {
    if (x === undefined) x = 80 + count * 22;
    if (y === undefined) y = 44 + count * 22;
    // Center popups on mobile
    if (isMobile && popup) {
      x = Math.max(4, Math.floor((window.innerWidth - w) / 2));
      y = Math.max(4, Math.floor((window.innerHeight - taskbarH - h) / 3));
    }
  }

  const el = document.createElement('div');
  el.className = 'os-window inactive';
  el.id = 'win-' + id;
  el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++zTop}`;

  el.innerHTML = `
    <div class="win-rz win-rz-n"></div><div class="win-rz win-rz-s"></div>
    <div class="win-rz win-rz-e"></div><div class="win-rz win-rz-w"></div>
    <div class="win-rz win-rz-nw"></div><div class="win-rz win-rz-ne"></div>
    <div class="win-rz win-rz-sw"></div><div class="win-rz win-rz-se"></div>
    <div class="win-titlebar" id="tb-${id}">
      <div class="win-title-text">
        <span class="win-icon">${iconMarkup(icon)}</span>
        <span id="wtitle-${id}">${escHtml(title == null ? '' : String(title))}</span>
      </div>
      <div class="win-controls">
        <button class="win-btn" title="Minimize" onclick="minWin('${id}')">─</button>
        <button class="win-btn" title="Maximize" onclick="maxWin('${id}')">□</button>
        <button class="win-btn" title="Close"    onclick="closeWin('${id}')">✕</button>
      </div>
    </div>
    ${menubar ? `<div class="win-menubar" id="mb-${id}"></div>` : ''}
    <div class="win-body" id="wb-${id}"></div>
    ${statusbar ? `<div class="win-statusbar"><div class="statusbar-panel" id="ws-${id}">Ready</div></div>` : ''}
  `;

  document.getElementById('windows-layer').appendChild(el);
  wins[id] = { el, title, icon, minimized: false, maximized: false, origStyle: null };

  // Built-in apps are real processes with real lifetimes. Registering here rather
  // than in each app means an app cannot forget to appear in ps.
  wins[id].pid = kernelRegisterSystem(id, processDisplayName(title, id));

  makeDraggable(el, document.getElementById('tb-' + id));
  makeResizable(el, id);
  addTbBtn(id, title, icon);
  el.addEventListener('mousedown', () => focusWin(id));
  el.addEventListener('touchstart', () => focusWin(id), { passive: true });

  focusWin(id);
  return el;
}

function focusWin(id) {
  const w = wins[id]; if (!w) return;
  w.el.style.zIndex = ++zTop;
  Object.values(wins).forEach(v => v.el.classList.add('inactive'));
  w.el.classList.remove('inactive');
  document.querySelectorAll('.taskbar-btn').forEach(b => b.classList.remove('focused'));
  const btn = document.getElementById('tbtn-' + id);
  if (btn) btn.classList.add('focused');
}

function minWin(id) {
  const w = wins[id]; if (!w) return;
  w.minimized = true; w.el.style.display = 'none';
  const btn = document.getElementById('tbtn-' + id);
  if (btn) btn.classList.remove('focused');
}

function unminWin(id) {
  const w = wins[id]; if (!w) return;
  w.minimized = false; w.el.style.display = 'flex'; focusWin(id);
}

function maxWin(id) {
  const w = wins[id]; if (!w) return;
  if (w.maximized) {
    w.el.style.cssText = w.origStyle;
    w.maximized = false;
  } else {
    w.origStyle = w.el.style.cssText;
    const d = document.getElementById('desktop');
    w.el.style.left   = '0';
    w.el.style.top    = '0';
    w.el.style.width  = d.offsetWidth + 'px';
    w.el.style.height = d.offsetHeight + 'px';
    w.el.style.zIndex = ++zTop;
    w.maximized = true;
  }
}

function restoreMaximizedForDrag(id, clientX, clientY) {
  const w = wins[id];
  if (!w || !w.maximized || !w.origStyle) return;
  const fullRect = w.el.getBoundingClientRect();
  const pointerRatio = fullRect.width ? Math.min(0.9, Math.max(0.1, (clientX - fullRect.left) / fullRect.width)) : 0.5;
  w.el.style.cssText = w.origStyle;
  w.maximized = false;
  w.el.style.zIndex = ++zTop;
  const desktop = document.getElementById('desktop');
  const maxLeft = Math.max(0, desktop.offsetWidth - w.el.offsetWidth);
  const maxTop = Math.max(0, desktop.offsetHeight - w.el.offsetHeight);
  w.el.style.left = Math.max(0, Math.min(maxLeft, clientX - w.el.offsetWidth * pointerRatio)) + 'px';
  w.el.style.top = Math.max(0, Math.min(maxTop, clientY - 14)) + 'px';
}

function closeWin(id) {
  const w = wins[id]; if (!w) return;
  if (w._interval) clearInterval(w._interval);
  // Apps that own something outside their DOM subtree - an observer, a running
  // sound, a subscription - hang a teardown here. DEFRAG.exe has set _onclose
  // since it was written and nothing ever called it, so its ResizeObserver
  // outlived every window it was created for. Wrapped because a throwing
  // teardown must not leave a closed window in `wins` and on the taskbar.
  if (typeof w._onclose === 'function') {
    try { w._onclose(); } catch (e) {}
  }
  w.el.remove(); delete wins[id];
  kernelDeregisterSystem(id);
  const btn = document.getElementById('tbtn-' + id); if (btn) btn.remove();
}

function makeDraggable(win, handle) {
  let sx, sy, sl, st;
  const id = win.id.replace('win-', '');

  function startDrag(cx, cy) {
    sx = cx; sy = cy;
    sl = win.offsetLeft; st = win.offsetTop;
  }
  function moveDrag(cx, cy) {
    const desktop = document.getElementById('desktop');
    const maxLeft = Math.max(0, desktop.offsetWidth - win.offsetWidth);
    const maxTop = Math.max(0, desktop.offsetHeight - win.offsetHeight);
    win.style.left = Math.max(0, Math.min(maxLeft, sl + cx - sx)) + 'px';
    win.style.top  = Math.max(0, Math.min(maxTop, st + cy - sy)) + 'px';
  }

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    restoreMaximizedForDrag(id, e.clientX, e.clientY);
    startDrag(e.clientX, e.clientY);
    const onMove = (e) => moveDrag(e.clientX, e.clientY);
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    const t = e.touches[0];
    restoreMaximizedForDrag(id, t.clientX, t.clientY);
    startDrag(t.clientX, t.clientY);
    const onMove = (e) => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); };
    const onEnd = () => { handle.removeEventListener('touchmove', onMove); handle.removeEventListener('touchend', onEnd); };
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd);
  }, { passive: false });
}

function makeResizable(win, id) {
  const MIN_W = 180, MIN_H = 80;
  win.querySelectorAll('.win-rz').forEach(handle => {
    const a = [...handle.classList].find(c => c.startsWith('win-rz-') && c !== 'win-rz').replace('win-rz-','');
    handle.addEventListener('mousedown', e => {
      const w = wins[id]; if (w && w.maximized) return; // don't resize while maximized
      e.preventDefault(); e.stopPropagation();
      focusWin(id);
      const x0 = e.clientX, y0 = e.clientY;
      const W0 = win.offsetWidth, H0 = win.offsetHeight;
      const L0 = win.offsetLeft,  T0 = win.offsetTop;
      const onMove = e => {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        let W = W0, H = H0, L = L0, T = T0;
        if (a.includes('e')) W = Math.max(MIN_W, W0 + dx);
        if (a.includes('s')) H = Math.max(MIN_H, H0 + dy);
        if (a.includes('w')) { W = Math.max(MIN_W, W0 - dx); L = L0 + W0 - W; }
        if (a.includes('n')) { H = Math.max(MIN_H, H0 - dy); T = T0 + H0 - H; }
        win.style.width = W+'px'; win.style.height = H+'px';
        win.style.left  = L+'px'; win.style.top    = T+'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// Rename a live window. A window's title is shown in four places and they used
// to be updated one at a time by whoever remembered: the titlebar span, the
// taskbar button, and - through wins[id].title - the Alt+Tab overlay, SYSMON's
// process list and the terminal's task list. Callers that only touched the
// span left the other three showing the old name.
function setWinTitle(id, title) {
  const w = wins[id];
  if (!w) return;
  w.title = title;
  const span = document.getElementById('wtitle-' + id);
  if (span) span.textContent = title;
  const btn = document.getElementById('tbtn-' + id);
  // The button is `<span>icon</span><span>title</span>`; only the label moves.
  if (btn && btn.lastElementChild) btn.lastElementChild.textContent = title;
}

function addTbBtn(id, title, icon) {
  const btn = document.createElement('button');
  btn.className = 'taskbar-btn focused';
  btn.id = 'tbtn-' + id;
  btn.innerHTML = `<span class="tb-icon">${iconMarkup(icon)}</span><span></span>`;
  btn.lastElementChild.textContent = title;
  btn.addEventListener('click', () => {
    const w = wins[id]; if (!w) return;
    if (w.minimized) { unminWin(id); }
    else if (w.maximized) { maxWin(id); }   // restore to pre-maximize size
    else if (w.el.classList.contains('inactive')) { focusWin(id); }
    else { minWin(id); }
  });
  document.getElementById('taskbar-programs').appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────────────────────
function formatClockDisplay(now, allowCorruption = true) {
  if (allowCorruption && window._clockCorrupted && Math.random() < 0.75) return '??:??';
  let h = allowCorruption && Math.random() < 0.004 ? Math.floor(Math.random() * 24) : now.getHours();
  const m = allowCorruption && Math.random() < 0.004 ? Math.floor(Math.random() * 60) : now.getMinutes();
  let suffix = '';
  if (osSettings.clock12h) {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
  }
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + suffix;
}
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = formatClockDisplay(now, true);
  const sleepClock = document.getElementById('sleep-clock');
  if (sleepClock) sleepClock.textContent = formatClockDisplay(now, false);
}
setInterval(updateClock, 1000); updateClock();

// idle sleep
const IDLE_MOVE_THROTTLE_MS = 1000;
const MANUAL_SLEEP_WAKE_DELAY_MS = 500;
let idleSleepTimer = null;
let idleSleepActive = false;
let idleSleepArmed = false;
let idleLastActivityTs = Date.now();
let idleLastMoveTs = 0;
let idleSleepWakeLockedUntil = 0;

function scheduleIdleSleep() {
  if (idleSleepTimer) clearTimeout(idleSleepTimer);
  if (!idleSleepArmed || idleSleepActive || !bisDone) return;
  const remainingMs = getIdleSleepMs() - (Date.now() - idleLastActivityTs);
  if (remainingMs <= 0) {
    enterIdleSleep();
    return;
  }
  idleSleepTimer = setTimeout(enterIdleSleep, remainingMs);
}
function noteIdleActivity(kind = 'generic', force = false) {
  if (!idleSleepArmed) return;
  const now = Date.now();
  if (!force && idleSleepActive) return;
  if (kind === 'move') {
    if (!force && now - idleLastMoveTs < IDLE_MOVE_THROTTLE_MS) return;
    idleLastMoveTs = now;
  }
  idleLastActivityTs = now;
  scheduleIdleSleep();
}
function enterIdleSleep(wakeLockMs = 0) {
  if (idleSleepActive || !bisDone) return;
  idleSleepActive = true;
  idleSleepWakeLockedUntil = Date.now() + Math.max(0, wakeLockMs || 0);
  if (idleSleepTimer) clearTimeout(idleSleepTimer);
  closeStart();
  closeDropdown();
  closeCad();
  if (altTabActive) closeAltTab();
  const overlay = document.getElementById('sleep-overlay');
  if (!overlay) return;
  document.body.classList.add('idle-sleeping');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  // The monitor sleeps; the machine does not. Ducked rather than stopped.
  duckSoundLoop('ambience', AMBIENCE_SLEEP_DUCK, 1.2);
  updateClock();
  overlay.focus();
}
function wakeIdleSleep() {
  if (!idleSleepActive) return;
  idleSleepActive = false;
  idleSleepWakeLockedUntil = 0;
  const overlay = document.getElementById('sleep-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('idle-sleeping');
  duckSoundLoop('ambience', 1, 0.9);
  idleLastActivityTs = Date.now();
  scheduleIdleSleep();
}
function armIdleSleep() {
  if (idleSleepArmed) {
    noteIdleActivity('generic', true);
    return;
  }
  idleSleepArmed = true;

  document.addEventListener('pointerdown', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('pointermove', () => noteIdleActivity('move'), { passive: true });
  document.addEventListener('wheel', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('touchstart', () => noteIdleActivity('generic'), { passive: true });
  document.addEventListener('keydown', () => noteIdleActivity('generic'));

  const wakeAndSwallow = e => {
    if (!idleSleepActive) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (Date.now() < idleSleepWakeLockedUntil) return;
    wakeIdleSleep();
  };
  document.addEventListener('keydown', wakeAndSwallow, true);
  document.addEventListener('pointerdown', wakeAndSwallow, true);
  document.addEventListener('pointermove', wakeAndSwallow, true);
  document.addEventListener('touchstart', wakeAndSwallow, true);

  window.addEventListener('focus', () => {
    if (!idleSleepActive && Date.now() - idleLastActivityTs >= getIdleSleepMs()) enterIdleSleep();
    else noteIdleActivity('generic', true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || idleSleepActive) return;
    if (Date.now() - idleLastActivityTs >= getIdleSleepMs()) enterIdleSleep();
    else scheduleIdleSleep();
  });

  scheduleIdleSleep();
}

// ─────────────────────────────────────────────────────────────────
// START MENU
// ─────────────────────────────────────────────────────────────────
let startOpen = false;
function toggleStart() {
  startOpen = !startOpen;
  document.getElementById('start-menu').style.display = startOpen ? 'flex' : 'none';
  document.getElementById('start-btn').classList.toggle('pressed', startOpen);
}
function closeStart() { if (startOpen) toggleStart(); }
function handleOutsideStart(e) {
  if (startOpen && !e.target.closest('#start-menu') && e.target.id !== 'start-btn')
    closeStart();
}
document.addEventListener('mousedown', handleOutsideStart);
document.addEventListener('touchstart', handleOutsideStart, { passive: true });

// Uppercase stem, preserve extension case: "untitled.txt" → "UNTITLED.txt"
function iconLabel(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name.toUpperCase();
  return name.slice(0, dot).toUpperCase() + name.slice(dot);
}

function resolveFsIcon(name, kind) {
  // The bin is the one icon with two states, so it is resolved here rather than
  // read out of SYSTEM_FILE_ICONS' static map. recycleBinEntries is declared in
  // fs-persist.js, which the bundle loads well before this ever runs.
  if (isRecycleBinItemName(name)) {
    return recycleBinEntries.length ? 'icon:recycle-full' : 'icon:recycle-empty';
  }
  if (kind === 'image') return 'icon:image';
  if (kind === 'video') return 'icon:video';
  if (kind === 'audio') return 'icon:audio';
  if (kind === 'dir') return 'icon:folder';
  const systemIcon = SYSTEM_FILE_ICONS[String(name).toUpperCase()];
  if (systemIcon) return systemIcon;
  const ext = (String(name || '').split('.').pop() || '').toLowerCase();
  return {
    exe:'icon:exe', script:'icon:script', txt:'icon:text', readme:'icon:text', md:'icon:text',
    json:'icon:script', js:'icon:script', ts:'icon:script', jsx:'icon:script', tsx:'icon:script',
    html:'icon:browser', htm:'icon:browser', css:'icon:script', py:'icon:script',
    tmp:'icon:void', log:'icon:text', csv:'icon:sysmon', core:'icon:daemon'
  }[ext] || 'icon:unknown';
}

function getDesktopFsIcons() {
  // vfsListSync returns [] for a missing directory, which is what the old
  // `if (!dir) return []` did, and it yields dirs, then text files, then blobs -
  // the same order the three legacy loops produced, so icon order is unchanged.
  //
  // The kinds do NOT map one to one. vfsListSync reports 'dir' / 'text' /
  // 'blob'; this function has always emitted 'dir' / 'file' / the blob's own
  // media kind, and resolveFsIcon above branches on 'image' / 'video' /
  // 'audio' / 'dir'. Passing 'blob' through would strip the icon off every
  // uploaded image, video and audio file on the desktop. The kind also lands in
  // the returned target, which the open path reads. So remap explicitly.
  const icons = vfsListSync('DESKTOP').map(entry => ({
    name: entry.name,
    kind: entry.kind === 'dir' ? 'dir'
        : entry.kind === 'text' ? 'file'
        : entry.blob?.kind || inferBlobKindFromName(entry.name),
  }));
  return icons.map(item => ({
    name: item.name,
    emoji: resolveFsIcon(item.name, item.kind),
    kind: item.kind,
    desktopEntry: true,
    target: {
      name: item.name,
      path: 'DESKTOP\\' + item.name,
      kind: item.kind === 'dir' ? 'dir' : 'file',
      sysfile: false,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────
// DESKTOP ICON GRID
// ─────────────────────────────────────────────────────────────────
