// ─────────────────────────────────────────────────────────────────
// WINDOW GEOMETRY CLAMPING
// ─────────────────────────────────────────────────────────────────
// A window whose titlebar leaves the desktop is unrecoverable: the drag handle
// and the close button go with it, so it can be neither moved back nor closed.
// Every path that writes a window's left/top/width/height ends in
// clampWinGeometry so that state is unreachable - cascade spawns, resize
// handles, unmaximize, and viewport resizes all funnel through here.
const WIN_MIN_W = 180, WIN_MIN_H = 80;   // must match .os-window min-width/min-height

function desktopBounds() {
  const d = document.getElementById('desktop');
  // #desktop is display:none until boot finishes, so a window created during
  // startup would otherwise be clamped into a 0x0 box. Fall back to the
  // viewport minus the taskbar, matching the CSS.
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  const taskbarH = isMobile ? 56 : 28;
  return {
    w: d && d.offsetWidth  ? d.offsetWidth  : window.innerWidth,
    h: d && d.offsetHeight ? d.offsetHeight : Math.max(WIN_MIN_H, window.innerHeight - taskbarH),
  };
}

// Shrinks an oversized window and pulls a stray one back inside the desktop.
// Minimized windows are display:none, so their offset* are all 0 - clamping one
// would slam it to the top-left and lose its position. They get clamped when
// they are restored instead (see unminWin).
function clampWinGeometry(el) {
  if (!el || el.style.display === 'none' || !el.offsetWidth) return;
  const { w: dw, h: dh } = desktopBounds();
  let W = el.offsetWidth, H = el.offsetHeight;
  if (W > dw) { W = Math.max(WIN_MIN_W, dw); el.style.width  = W + 'px'; }
  if (H > dh) { H = Math.max(WIN_MIN_H, dh); el.style.height = H + 'px'; }
  el.style.left = Math.max(0, Math.min(Math.max(0, dw - W), el.offsetLeft)) + 'px';
  el.style.top  = Math.max(0, Math.min(Math.max(0, dh - H), el.offsetTop))  + 'px';
}

// ── Window layout maths ──────────────────────────────────────────
// Pure functions of numbers: no DOM, no globals, no reads of `wins`. That is
// deliberate - os/wm.js is otherwise DOM-bound and unprovable in node, and
// these four functions are the part where the bugs would actually live.

const WM_SNAP_EDGE = 20;      // px from an edge that counts as the zone
const WM_CASCADE_STEP = 24;   // roughly one titlebar

// Which snap zone a CURSOR sits in. The cursor, not the window's edges: a wide
// window's edge crosses a boundary long before the player's hand does, which
// reads as snapping at random.
//
// There is no bottom zone. desktopBounds() already excludes the taskbar, so
// below the desktop is outside it, not an edge.
function wmSnapZoneAt(x, y, bounds, edge) {
  const e = typeof edge === 'number' ? edge : WM_SNAP_EDGE;
  if (!bounds || x < 0 || y < 0 || x > bounds.w || y > bounds.h) return null;
  // Top wins the corners. Dragging into a corner is far more often an attempt
  // to maximize than to half-snap, and deciding it here means the two branches
  // cannot disagree depending on evaluation order.
  if (y <= e) return 'top';
  if (x <= e) return 'left';
  if (x >= bounds.w - e) return 'right';
  return null;
}

// The rectangle a zone produces. Left takes the floor of half the width and
// right takes the remainder, so an odd desktop width leaves no one-pixel gap
// down the middle.
function wmSnapRect(zone, bounds) {
  if (!zone || !bounds) return null;
  const half = Math.floor(bounds.w / 2);
  if (zone === 'left')  return { left: 0,    top: 0, width: half,             height: bounds.h };
  if (zone === 'right') return { left: half, top: 0, width: bounds.w - half,  height: bounds.h };
  if (zone === 'top')   return { left: 0,    top: 0, width: bounds.w,         height: bounds.h };
  return null;
}

// Cascade: each window one step down-right of the last. The modulo keeps a
// long run from marching off the bottom-right forever - it wraps back to the
// top-left and starts again, which is what every OS does with enough windows.
function wmCascadeRects(count, bounds, step) {
  if (!bounds) return [];
  const s = typeof step === 'number' ? step : WM_CASCADE_STEP;
  const n = Math.max(0, Math.trunc(count) || 0);
  const width  = Math.max(WIN_MIN_W, Math.round(bounds.w * 0.6));
  const height = Math.max(WIN_MIN_H, Math.round(bounds.h * 0.6));
  const maxLeft = Math.max(0, bounds.w - width);
  const maxTop  = Math.max(0, bounds.h - height);
  // How many steps fit before a window would hang off the edge.
  const span = Math.max(1, Math.floor(Math.min(maxLeft, maxTop) / s) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = i % span;
    out.push({ left: Math.min(maxLeft, k * s), top: Math.min(maxTop, k * s), width, height });
  }
  return out;
}

// Tile: a grid of ceil(sqrt(n)) columns. Each cell's edges are computed from
// the cumulative fraction of the row/column (c/rowCols, r/rows), not a fixed
// per-cell size, so adjacent cells always share an edge and a row's last
// edge lands exactly on bounds.w/bounds.h. The sub-pixel remainder from that
// rounding falls wherever the cumulative fraction happens to round up - not
// reliably on the last cell. For example, 7 windows on a 1000-wide desktop
// give a top row of 3 cells at 333/334/333: the extra pixel lands on the
// MIDDLE cell, not the last one.
//
// A partial last row (n not a multiple of cols) has fewer cells than `cols`,
// so its column edges are computed against ITS OWN cell count, not the grid's
// global `cols` - otherwise those cells keep the full grid's column width and
// the row falls short of the right edge instead of stretching to fill it.
//
// With enough windows a cell would be smaller than a usable window, so the
// result is clamped to WIN_MIN_W/WIN_MIN_H and the tiles overlap. Overlapping
// windows you can still drag beat a grid of unusable slivers.
function wmTileRects(count, bounds) {
  if (!bounds) return [];
  const n = Math.max(0, Math.trunc(count) || 0);
  if (!n) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const rowCols = Math.min(cols, n - r * cols); // cells actually in this row
    // Cells in the final column/row take the remainder, so edges line up.
    const x0 = Math.round(bounds.w * c / rowCols);
    const x1 = Math.round(bounds.w * (c + 1) / rowCols);
    const y0 = Math.round(bounds.h * r / rows);
    const y1 = Math.round(bounds.h * (r + 1) / rows);
    out.push({
      left: x0,
      top: y0,
      width:  Math.max(WIN_MIN_W, x1 - x0),
      height: Math.max(WIN_MIN_H, y1 - y0),
    });
  }
  return out;
}

// A window is "filled" when it occupies a computed rectangle rather than its
// own remembered geometry - maximized or snapped. Both remember where they came
// from in origStyle, and both restore the same way, which is the whole reason
// snap is a state here rather than a one-off resize.
function wmIsFilled(w) {
  return !!(w && (w.maximized || w.snap));
}

// Snap a window to a zone. Captures origStyle only on the way OUT of normal, so
// snapping left then right then left again still remembers the size the player
// last chose for themselves rather than a half-screen.
function wmApplySnap(id, zone) {
  const w = wins[id]; if (!w) return;
  const rect = wmSnapRect(zone, desktopBounds());
  if (!rect) return;
  if (!wmIsFilled(w)) w.origStyle = w.el.style.cssText;
  w.el.style.left   = rect.left + 'px';
  w.el.style.top    = rect.top + 'px';
  w.el.style.width  = rect.width + 'px';
  w.el.style.height = rect.height + 'px';
  w.el.style.zIndex = ++zTop;
  w.maximized = false;
  w.snap = zone;
}

// One preview element for the whole OS, created on first use. Not one per
// window: a second drag would orphan the first one's overlay.
function wmSnapPreviewEl() {
  let el = document.getElementById('snap-preview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snap-preview';
    const desk = document.getElementById('desktop');
    (desk || document.body).appendChild(el);
  }
  return el;
}

function wmSnapPreviewShow(zone) {
  const rect = wmSnapRect(zone, desktopBounds());
  if (!rect) return wmSnapPreviewHide();
  const el = wmSnapPreviewEl();
  el.style.left   = rect.left + 'px';
  el.style.top    = rect.top + 'px';
  el.style.width  = rect.width + 'px';
  el.style.height = rect.height + 'px';
  el.style.display = 'block';
}

function wmSnapPreviewHide() {
  const el = document.getElementById('snap-preview');
  if (el) el.style.display = 'none';
}

function mkWin({ id, title, icon = 'icon:text', x, y, w = 500, h = 380,
                 menubar = true, statusbar = true, popup = false }) {
  if (wins[id]) { focusWin(id); unminWin(id); return null; }

  // Default position: slightly random cascade; on mobile fill viewport (except small popups)
  const count = Object.keys(wins).length;
  const isMobile = window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
  const bounds = desktopBounds();
  if (isMobile && !popup) {
    x = 0; y = 0;
    w = bounds.w;
    h = bounds.h;
  } else {
    // Cascade wraps back to the origin instead of marching off the bottom-right
    // corner once enough windows are open.
    if (x === undefined || y === undefined) {
      const room = Math.min(bounds.w - w - 80, bounds.h - h - 44);
      const slots = Math.max(1, Math.floor(room / 22) + 1);
      const step = (count % slots) * 22;
      if (x === undefined) x = 80 + step;
      if (y === undefined) y = 44 + step;
    }
    // Center popups on mobile
    if (isMobile && popup) {
      x = Math.max(4, Math.floor((bounds.w - w) / 2));
      y = Math.max(4, Math.floor((bounds.h - h) / 3));
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
  clampWinGeometry(el);   // callers pass explicit x/y/w/h that may not fit this viewport
  wins[id] = { el, title, icon, minimized: false, maximized: false, snap: null, origStyle: null };

  // Built-in apps are real processes with real lifetimes. Registering here rather
  // than in each app means an app cannot forget to appear in ps.
  wins[id].pid = kernelRegisterSystem(id, processDisplayName(title, id));

  // Every app reaches the OS through mkWin, so the probe goes here rather than
  // into eight app files. A future app is instrumented the moment it opens a
  // window, with nothing to remember.
  wins[id].removeProbe = instInstallProbe(el, id);

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
  w.minimized = false; w.el.style.display = 'flex';
  // Minimized windows are skipped by the resize clamp (they have no layout box),
  // so a window minimized on a large viewport and restored on a small one gets
  // pulled back inside here.
  if (w.maximized) fitMaximized(w); else if (w.snap) fitSnapped(w); else clampWinGeometry(w.el);
  focusWin(id);
}

function fitMaximized(w) {
  const { w: dw, h: dh } = desktopBounds();
  w.el.style.left   = '0';
  w.el.style.top    = '0';
  w.el.style.width  = dw + 'px';
  w.el.style.height = dh + 'px';
}

// Re-fit a snapped window to the current desktop, mirroring fitMaximized's
// shape. Geometry only - no zIndex, no state changes - so a reflow never
// reorders the stack the way routing this through wmApplySnap would. Falls
// back to a plain clamp if the window's snap value is somehow unknown, so a
// corrupt `snap` can never leave the window unclamped.
function fitSnapped(w) {
  const rect = wmSnapRect(w.snap, desktopBounds());
  if (!rect) { clampWinGeometry(w.el); return; }
  w.el.style.left   = rect.left + 'px';
  w.el.style.top    = rect.top + 'px';
  w.el.style.width  = rect.width + 'px';
  w.el.style.height = rect.height + 'px';
}

function maxWin(id) {
  const w = wins[id]; if (!w) return;
  if (w.maximized) {
    w.el.style.cssText = w.origStyle;
    w.maximized = false;
    w.snap = null;
    // origStyle was captured against whatever the desktop measured at the time;
    // it can be stale by now.
    clampWinGeometry(w.el);
  } else {
    // Only capture from a normal window: maximizing a SNAPPED one must keep the
    // size the player chose, not overwrite it with a half-screen.
    if (!wmIsFilled(w)) w.origStyle = w.el.style.cssText;
    fitMaximized(w);
    w.el.style.zIndex = ++zTop;
    w.maximized = true;
    w.snap = null;
  }
}

// Renamed from restoreMaximizedForDrag: it now returns a SNAPPED window to its
// previous size too, which is the same operation. A second copy for snap is how
// the two states would drift apart.
function restoreFilledForDrag(id, clientX, clientY) {
  const w = wins[id];
  if (!w || !wmIsFilled(w) || !w.origStyle) return;
  const fullRect = w.el.getBoundingClientRect();
  const pointerRatio = fullRect.width ? Math.min(0.9, Math.max(0.1, (clientX - fullRect.left) / fullRect.width)) : 0.5;
  w.el.style.cssText = w.origStyle;
  w.maximized = false;
  w.snap = null;
  w.el.style.zIndex = ++zTop;
  clampWinGeometry(w.el);   // the restored size may not fit the current desktop
  const { w: dw, h: dh } = desktopBounds();
  const maxLeft = Math.max(0, dw - w.el.offsetWidth);
  const maxTop = Math.max(0, dh - w.el.offsetHeight);
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
  if (wins[id] && typeof wins[id].removeProbe === 'function') wins[id].removeProbe();
  w.el.remove(); delete wins[id];
  // A window can be closed by a script mid-drag, in which case the drag's own
  // mouseup cleanup never runs for it. An overlay left on screen with no window
  // to explain it is worse than no preview at all.
  wmSnapPreviewHide();
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
    const { w: dw, h: dh } = desktopBounds();
    const maxLeft = Math.max(0, dw - win.offsetWidth);
    const maxTop = Math.max(0, dh - win.offsetHeight);
    win.style.left = Math.max(0, Math.min(maxLeft, sl + cx - sx)) + 'px';
    win.style.top  = Math.max(0, Math.min(maxTop, st + cy - sy)) + 'px';
  }

  handle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    restoreFilledForDrag(id, e.clientX, e.clientY);
    startDrag(e.clientX, e.clientY);
    // Mobile windows already fill the desktop (mkWin), so there is nothing to
    // snap and a 20px zone is barely hittable with a finger. No snap logic runs
    // on that branch at all rather than shipping a control that cannot work.
    const snapEnabled = !(window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches);
    let pendingZone = null;
    const onMove = (e) => {
      moveDrag(e.clientX, e.clientY);
      if (!snapEnabled) return;
      const zone = wmSnapZoneAt(e.clientX, e.clientY, desktopBounds(), WM_SNAP_EDGE);
      if (zone !== pendingZone) {
        pendingZone = zone;
        if (zone) wmSnapPreviewShow(zone); else wmSnapPreviewHide();
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      wmSnapPreviewHide();
      if (!snapEnabled || !pendingZone) return;
      if (pendingZone === 'top') { if (!wins[id] || !wins[id].maximized) maxWin(id); }
      else wmApplySnap(id, pendingZone);
      pendingZone = null;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handle.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    focusWin(id);
    const t = e.touches[0];
    restoreFilledForDrag(id, t.clientX, t.clientY);
    startDrag(t.clientX, t.clientY);
    const onMove = (e) => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); };
    const onEnd = () => { handle.removeEventListener('touchmove', onMove); handle.removeEventListener('touchend', onEnd); };
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd);
  }, { passive: false });
}

function makeResizable(win, id) {
  const MIN_W = WIN_MIN_W, MIN_H = WIN_MIN_H;
  win.querySelectorAll('.win-rz').forEach(handle => {
    const a = [...handle.classList].find(c => c.startsWith('win-rz-') && c !== 'win-rz').replace('win-rz-','');
    handle.addEventListener('mousedown', e => {
      const w = wins[id]; if (w && wmIsFilled(w)) return; // don't resize while filled (maximized or snapped)
      e.preventDefault(); e.stopPropagation();
      focusWin(id);
      const x0 = e.clientX, y0 = e.clientY;
      const W0 = win.offsetWidth, H0 = win.offsetHeight;
      const L0 = win.offsetLeft,  T0 = win.offsetTop;
      const onMove = e => {
        const dx = e.clientX - x0, dy = e.clientY - y0;
        const { w: dw, h: dh } = desktopBounds();
        let W = W0, H = H0, L = L0, T = T0;
        // Each edge is capped at the desktop edge it is heading for. Without
        // this, an east drag pushes the titlebar's close/maximize buttons past
        // the right edge, and a west drag puts the window's origin at a
        // negative left - in both cases the window is stuck there, since the
        // drag clamp can only move it within the desktop.
        if (a.includes('e')) W = Math.max(MIN_W, Math.min(W0 + dx, dw - L0));
        if (a.includes('s')) H = Math.max(MIN_H, Math.min(H0 + dy, dh - T0));
        if (a.includes('w')) { W = Math.max(MIN_W, Math.min(W0 - dx, L0 + W0)); L = L0 + W0 - W; }
        if (a.includes('n')) { H = Math.max(MIN_H, Math.min(H0 - dy, T0 + H0)); T = T0 + H0 - H; }
        win.style.width = W+'px'; win.style.height = H+'px';
        win.style.left  = L+'px'; win.style.top    = T+'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// Shrinking the browser window used to strand every window that sat past the
// new edge: nothing re-measured them, and the drag clamp could not pull back a
// titlebar that was already outside the desktop. Re-clamp on every viewport
// change, and re-fit maximized windows to the new desktop while at it.
// rAF-coalesced because resize fires continuously during a drag.
let _wmReflowPending = false;
function reflowWindows() {
  Object.values(wins).forEach(w => {
    if (w.minimized) return;   // clamped on restore instead - see unminWin
    if (w.maximized) fitMaximized(w); else if (w.snap) fitSnapped(w); else clampWinGeometry(w.el);
  });
}
window.addEventListener('resize', () => {
  if (_wmReflowPending) return;
  _wmReflowPending = true;
  requestAnimationFrame(() => { _wmReflowPending = false; reflowWindows(); });
});

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
    else if (w.maximized) { maxWin(id); }
    else if (w.snap) { wmUnsnap(id); }
    else if (w.el.classList.contains('inactive')) { focusWin(id); }
    else { minWin(id); }
  });
  document.getElementById('taskbar-programs').appendChild(btn);
}

// Return a snapped window to its remembered size in place, without the pointer
// tracking restoreFilledForDrag does - there is no cursor to follow here.
function wmUnsnap(id) {
  const w = wins[id]; if (!w || !w.snap || !w.origStyle) return;
  w.el.style.cssText = w.origStyle;
  w.snap = null;
  w.el.style.zIndex = ++zTop;
  clampWinGeometry(w.el);
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
    html:'icon:browser', htm:'icon:browser', url:'icon:browser', css:'icon:script', py:'icon:script',
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
