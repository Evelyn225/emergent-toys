// ===== the big map: the whole city on one sheet, opened from the pause menu. Drag it about (mouse or finger),
// zoom with the wheel, a pinch, or the + / - buttons; arrows or WASD pan too. Neighbourhood names always, the
// landmarks and stations, and (zoomed in) every shop by its sign. Esc, M or the x closes it, back to the pause menu.
let bigMapEl = null, bigMapCv = null, bigMapSheet = null;
const BIGMAP = { cx: 0, cy: 0, z: 4, drag: null, pts: new Map(), pinch: null, keys: {}, found: null, hits: [], hitK: 0 };
const BIGMAP_Z = 48; // most px per cell: a shop front across the screen. The least: the whole city just fills the screen
const bigMapMinZ = () => Math.max(bigMapCv.clientWidth, bigMapCv.clientHeight) / N;
const BIGMAP_CSS = `
  #bigmap { background: #000; }
  #bigmap canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; touch-action: none; }
  #bigmap canvas.drag { cursor: grabbing; }
  #bigmap .bar { position: absolute; z-index: 2; top: calc(12px + env(safe-area-inset-top)); left: calc(12px + env(safe-area-inset-left)); display: flex; gap: 6px; }
  #bigmap .bar button { min-width: 38px; height: 38px; padding: 0 10px; background: rgba(6, 6, 8, 0.9); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; }
  #bigmap .bar button:hover { border-color: #fff; }
  #bigmap .bar input { width: 200px; height: 38px; padding: 0 10px; background: rgba(6, 6, 8, 0.9); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; font: inherit; outline: none; }
  #bigmap .bar input:focus { border-color: #fff; }
  #bigmap .tip { position: absolute; z-index: 2; left: calc(12px + env(safe-area-inset-left)); bottom: 10px; color: rgba(255, 255, 255, 0.45); pointer-events: none; }`;

// the city drawn once, a pixel a cell, then scaled up crisp
function bigMapRender() {
  const c = bigMapSheet || (bigMapSheet = document.createElement('canvas'));
  c.width = c.height = N;
  const x = c.getContext('2d');
  for (let my = 0; my < N; my++) for (let mx = 0; mx < N; mx++) { x.fillStyle = mapTile(mx, my); x.fillRect(mx, my, 1, 1); }
}
// what's named on the map: [x, y, text, colour, kind]. kind: 'area' (always), 'place' (always), 'shop' (zoomed in)
function bigMapLabels() {
  const out = [];
  for (const sd of DIST_SEEDS) { const [sx] = sd, d = seedName(sd), sy = d === 'industrial' ? (sd[1] > (SHORE_N + SHORE_S) / 2 ? SHORE_S - 0.4 : SHORE_N + 1.4) : sd[1]; out.push([sx * 8, sy * 8, (DISTRICT_TITLE[d] || d).replace(/^the /, 'The '), 'rgba(255,255,255,0.55)', 'area']); }
  const place = (x, y, t) => out.push([x, y, t, '#fd8', 'place']);
  place(GRAND_HOTEL.bx * 8 + 5, GRAND_HOTEL.by * 8 + 5, 'Grand Hotel');
  place(MARINA.x, MARINA.y0 + 2, 'Marina'); place(FAIR.cx, FAIR.y0 + 3, 'Sunset Pier'); place(WHEEL.x, WHEEL.y - 1.5, 'Ferris wheel');
  place(...COURIER_DEPOT.roof,COURIER_COMPANY);
  place(LIGHTHOUSE.x, LIGHTHOUSE.y - 2, 'Lighthouse'); place(GARDEN.x0 + 12, GARDEN.y0 + 10, 'Botanical Gardens');
  const LM = { cathedral: 'Cathedral', clock: 'Clock tower', screens: 'Big screens', radio: 'Radio tower' };
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { const lm = landmarkOf.get(bi(bx, by)); if (lm) place(bx * 8 + 5, by * 8 + 5, LM[lm] || lm); }
  for (const s of SERVICES) place(s.x, s.y - 0.8, { police: 'Police', fire: 'Fire station', amb: 'Hospital' }[s.kind] || s.kind);
  for (const s of stations) out.push([s.x, s.y - 0.8, s.name, '#6f6', 'place']);
  for (const s of EL_STATIONS) out.push([s.x, EL_Y - 0.4, s.name, '#f96', 'place']);
  const seen = new Set();
  for (let k = 0; k < N * N; k++) {
    const sh = SHOP[k]; if (!sh || !sh.word || sh.kind === SHOP_APTS || seen.has(sh)) continue;
    seen.add(sh); out.push([k % N + 0.5, Math.floor(k / N) + 0.5, sh.word, '#ccd', 'shop']);
  }
  return out;
}
let bigMapNames = null;

function bigMapDraw() {
  if (!bigMapOpen()) return;
  const cv_ = bigMapCv, dpr = devicePixelRatio || 1, W = cv_.clientWidth, H = cv_.clientHeight;
  if (cv_.width !== Math.round(W * dpr) || cv_.height !== Math.round(H * dpr)) { cv_.width = Math.round(W * dpr); cv_.height = Math.round(H * dpr); }
  BIGMAP.z = clamp(BIGMAP.z, bigMapMinZ(), BIGMAP_Z); // (the window may have changed)
  const x = cv_.getContext('2d'), z = BIGMAP.z, now = performance.now() / 1000; // (T is frozen under the pause menu)
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  // world (wx, wy) -> screen, taking the copy of the (wrapping) city nearest the middle of the view
  const sx = wx => W / 2 + rel(wx - BIGMAP.cx) * z, sy = wy => H / 2 + rel(wy - BIGMAP.cy) * z;
  const ox = W / 2 - BIGMAP.cx * z, oy = H / 2 - BIGMAP.cy * z, S = N * z;
  for (let tx = Math.floor(-ox / S) - 1; tx * S + ox < W; tx++) for (let ty = Math.floor(-oy / S) - 1; ty * S + oy < H; ty++)
    x.drawImage(bigMapSheet, ox + tx * S, oy + ty * S, S, S);
  if (z >= 10) { // the street grid gets block lines once there's room
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
    for (let gx = Math.floor((BIGMAP.cx - W / 2 / z) / 8) * 8; gx < BIGMAP.cx + W / 2 / z; gx += 8) { const p = W / 2 + (gx - BIGMAP.cx) * z; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, H); x.stroke(); }
    for (let gy = Math.floor((BIGMAP.cy - H / 2 / z) / 8) * 8; gy < BIGMAP.cy + H / 2 / z; gy += 8) { const p = H / 2 + (gy - BIGMAP.cy) * z; x.beginPath(); x.moveTo(0, p); x.lineTo(W, p); x.stroke(); }
  }
  const onScreen = (X, Y, m = 40) => X > -m && Y > -m && X < W + m && Y < H + m;
  const dot = (wx, wy, ch, col, size = 12) => {
    const X = sx(wx), Y = sy(wy); if (!onScreen(X, Y)) return;
    x.font = `bold ${size}px monospace`; const w = x.measureText(ch).width + 4;
    x.fillStyle = 'rgba(0,0,0,0.8)'; x.fillRect(X - w / 2, Y - size / 2 - 1, w, size + 2);
    x.fillStyle = col; x.fillText(ch, X, Y + 1);
  };
  x.textAlign = 'center'; x.textBaseline = 'middle';
  // names: biggest first, and nothing drawn over something already written
  const taken = [];
  const label = (wx, wy, t, col, size, bold) => {
    const X = sx(wx), Y = sy(wy); if (!onScreen(X, Y, 120)) return;
    x.font = `${bold ? 'bold ' : ''}${size}px monospace`;
    const w = x.measureText(t).width, r = [X - w / 2 - 3, Y - size / 2 - 2, X + w / 2 + 3, Y + size / 2 + 2];
    if (taken.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return;
    taken.push(r);
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    x.fillStyle = col; x.fillText(t, X, Y + 1);
  };
  const delivery=courierRoute();
  if(delivery) {
    dot(delivery.recipient.x,delivery.recipient.y,'!', '#6f9',18);
    label(delivery.recipient.x,delivery.recipient.y-.8,'ROOF GARDEN','#6f9',14,true);
  }
  // you, and what's yours, go on first so nothing hides them
  const ang = me ? Math.atan2(me.hy, me.hx) : a;
  const youX = sx(px), youY = sy(py);
  if (onScreen(youX, youY)) {
    x.save(); x.translate(youX, youY); x.rotate(ang);
    x.fillStyle = fract(T * 2) < 0.5 ? '#ff5' : '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(9, 0); x.lineTo(-6, -6); x.lineTo(-3, 0); x.lineTo(-6, 6); x.closePath(); x.stroke(); x.fill(); x.restore();
    taken.push([youX - 10, youY - 10, youX + 10, youY + 10]);
  }
  for (const h of owned.homes) { // your homes: a pulsing ring and a tag, loud enough to spot from the whole-city view
    const hx = h.cell % N + 0.5, hy = Math.floor(h.cell / N) + 0.5, X = sx(hx), Y = sy(hy);
    if (!onScreen(X, Y)) continue;
    x.strokeStyle = '#ff4'; x.lineWidth = 2;
    for (const k of [0, 0.5]) { const f = fract(now * 0.6 + k); x.globalAlpha = 1 - f; x.beginPath(); x.arc(X, Y, 8 + f * 18, 0, Math.PI * 2); x.stroke(); }
    x.globalAlpha = 1;
    dot(hx, hy, 'HOME', '#ff4', 18);
    x.strokeStyle = '#ff4'; x.strokeRect(X - 27, Y - 12, 54, 24);
    taken.push([X - 26, Y - 14, X + 26, Y + 14]);
  }
  for (const c of owned.cars) if (c !== me) dot(c.x, c.y, 'C', '#fff');
  for (const b of fleet) if (b.deal === 'mine' && b !== sea) dot(b.x, b.y, 'B', '#fff');
  const tt = taskTarget(); if (tt) dot(tt.x, tt.y, '?', '#4ff');
  const jt = jobTarget(); if (jt) dot(jt.x, jt.y, '!', '#ff0');
  if (me && me.dest) dot(me.dest[0], me.dest[1], 'X', '#f4f');
  for (const c of cars) if (c.pursuit) dot(c.x, c.y, 'P', fract(T * 3) < 0.5 ? '#f44' : '#48f', 10);
  const f = BIGMAP.found;
  if (f && now - f.t < 6 && onScreen(sx(f.x), sy(f.y))) {
    x.strokeStyle = '#4ff'; x.lineWidth = 2; x.globalAlpha = 1 - (now - f.t) / 6;
    x.beginPath(); x.arc(sx(f.x), sy(f.y), 14 + 6 * Math.sin(now * 6), 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
  }
  const big = clamp(z * 1.4, 12, 22), mid = clamp(z * 1.1, 10, 14), small = clamp(z * 0.55, 9, 13);
  for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'area') label(lx, ly, z < 7 ? t.toUpperCase() : t, col, big, true);
  for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'place' && z >= 6) label(lx, ly, t, col, mid, false);
  if (z >= 14) for (const [lx, ly, t, col, kind] of bigMapNames) if (kind === 'shop') label(lx, ly, t, col, small, false);
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
}

function bigMapZoom(f, X, Y) { // zoom by f about screen point (X, Y): the spot under it stays put
  const W = bigMapCv.clientWidth, H = bigMapCv.clientHeight, z0 = BIGMAP.z, z1 = clamp(z0 * f, bigMapMinZ(), BIGMAP_Z);
  if (X === undefined) { X = W / 2; Y = H / 2; }
  BIGMAP.cx = mod(BIGMAP.cx + (X - W / 2) * (1 / z0 - 1 / z1), N); BIGMAP.cy = mod(BIGMAP.cy + (Y - H / 2) * (1 / z0 - 1 / z1), N);
  BIGMAP.z = z1;
}
function bigMapPan(dx, dy) { BIGMAP.cx = mod(BIGMAP.cx - dx / BIGMAP.z, N); BIGMAP.cy = mod(BIGMAP.cy - dy / BIGMAP.z, N); }
function bigMapCentre() { BIGMAP.cx = px; BIGMAP.cy = py; }

function openBigMap() {
  if (!bigMapEl) {
    const st = document.createElement('style'); st.textContent = BIGMAP_CSS; document.head.appendChild(st);
    bigMapEl = menuEl('bigmap', 900, `<canvas></canvas>
      <div class="bar"><button data-map="in" aria-label="Zoom in">+</button><button data-map="out" aria-label="Zoom out">-</button><button data-map="me">you</button><input type="search" list="bigmap-names" placeholder="find a place..." aria-label="Find a place"><datalist id="bigmap-names"></datalist><button data-map="close" aria-label="Close map">x</button></div>
      <div class="tip">${TOUCH ? 'drag to move, pinch to zoom' : 'drag to move, wheel to zoom, Esc to close'}</div>`);
    bigMapCv = bigMapEl.querySelector('canvas');
    const q = bigMapEl.querySelector('input');
    q.addEventListener('keydown', e => { if (e.code === 'Enter') bigMapFind(q.value, true); });
    q.addEventListener('input', () => bigMapFind(q.value, false));
    bigMapEl.addEventListener('click', e => {
      const b = e.target.closest('[data-map]'); if (!b) return;
      const m = b.dataset.map;
      if (m === 'in') bigMapZoom(1.5); if (m === 'out') bigMapZoom(1 / 1.5); if (m === 'me') bigMapCentre(); if (m === 'close') closeBigMap();
    });
    bigMapCv.addEventListener('pointerdown', e => {
      bigMapCv.setPointerCapture(e.pointerId); BIGMAP.pts.set(e.pointerId, [e.offsetX, e.offsetY]); bigMapCv.classList.add('drag');
      BIGMAP.pinch = null;
    });
    bigMapCv.addEventListener('pointermove', e => {
      const p = BIGMAP.pts.get(e.pointerId); if (!p) return;
      if (BIGMAP.pts.size >= 2) { // two fingers: pinch to zoom (and drag with the pair)
        p[0] = e.offsetX; p[1] = e.offsetY;
        const [[ax, ay], [bx, by]] = [...BIGMAP.pts.values()], d = Math.hypot(bx - ax, by - ay), mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (BIGMAP.pinch) { bigMapPan(mx - BIGMAP.pinch.mx, my - BIGMAP.pinch.my); bigMapZoom(d / BIGMAP.pinch.d, mx, my); }
        BIGMAP.pinch = { d: d || 1, mx, my };
        return;
      }
      bigMapPan(e.offsetX - p[0], e.offsetY - p[1]); p[0] = e.offsetX; p[1] = e.offsetY;
    });
    const up = e => { BIGMAP.pts.delete(e.pointerId); BIGMAP.pinch = null; if (!BIGMAP.pts.size) bigMapCv.classList.remove('drag'); };
    bigMapCv.addEventListener('pointerup', up); bigMapCv.addEventListener('pointercancel', up);
    bigMapCv.addEventListener('wheel', e => { e.preventDefault(); bigMapZoom(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
  }
  bigMapRender(); bigMapNames = bigMapLabels(); bigMapCentre();
  const names = [...new Set(bigMapNames.map(n => n[2]))].sort((p, q) => p.localeCompare(q));
  bigMapEl.querySelector('datalist').innerHTML = names.map(n => `<option value="${n.replace(/[&"<]/g, c => `&#${c.charCodeAt(0)};`)}">`).join('');
  bigMapEl.querySelector('input').value = ''; BIGMAP.found = null; BIGMAP.hits = [];
  BIGMAP.z = clamp(Math.min(innerWidth, innerHeight) / 60, 4, 10); // a few blocks round you to start
  BIGMAP.keys = {}; BIGMAP.pts.clear();
  bigMapEl.style.display = 'block';
  paused = true;
  const tick = () => { if (!bigMapOpen()) return; bigMapStep(); bigMapDraw(); requestAnimationFrame(tick); };
  BIGMAP.last = performance.now(); requestAnimationFrame(tick);
}
// search: typing jumps to the nearest place whose name matches; Enter again steps on to the next nearest of them
function bigMapFind(text, next) {
  const t = text.trim().toLowerCase();
  if (!t) { BIGMAP.found = null; BIGMAP.hits = []; return; }
  if (!next || !BIGMAP.hits.length || BIGMAP.hitQ !== t) {
    const hits = bigMapNames.filter(n => n[2].toLowerCase().includes(t)), d = n => Math.hypot(rel(n[0] - px), rel(n[1] - py));
    const exact = hits.filter(n => n[2].toLowerCase() === t); // (picked from the list: only that name)
    BIGMAP.hits = (exact.length ? exact : hits).sort((p, q) => d(p) - d(q)); BIGMAP.hitQ = t; BIGMAP.hitK = 0;
  } else BIGMAP.hitK = (BIGMAP.hitK + 1) % BIGMAP.hits.length;
  const h = BIGMAP.hits[BIGMAP.hitK]; if (!h) return;
  BIGMAP.cx = mod(h[0], N); BIGMAP.cy = mod(h[1], N); BIGMAP.z = Math.max(BIGMAP.z, h[4] === 'shop' ? 16 : 8); // (close enough that its name's drawn)
  BIGMAP.found = { x: h[0], y: h[1], t: performance.now() / 1000 };
}
function bigMapStep() { // held keys pan smoothly, a screen's width every second or so
  const now = performance.now(), dt = Math.min(0.05, (now - BIGMAP.last) / 1000), k = BIGMAP.keys, s = 700 * dt;
  BIGMAP.last = now;
  const dx = (k.ArrowLeft || k.KeyA ? 1 : 0) - (k.ArrowRight || k.KeyD ? 1 : 0), dy = (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0);
  if (dx || dy) bigMapPan(dx * s, dy * s);
}
function closeBigMap() { if (!bigMapOpen()) return; bigMapEl.style.display = 'none'; BIGMAP.keys = {}; if (pauseEl) pauseEl.querySelector('[data-act="map"]').focus(); }
const bigMapOpen = () => !!bigMapEl && bigMapEl.style.display !== 'none';
// keys while the map's up: it takes them all (the game's paused under it)
function bigMapKey(e, down) {
  if (!bigMapOpen()) return false;
  if (e.target && e.target.tagName === 'INPUT') { if (down && e.code === 'Escape') e.target.blur(); return true; } // typing in the search box: the keys are its own
  if (down && !e.repeat && (e.code === 'Escape' || e.code === 'KeyM')) { closeBigMap(); return true; }
  if (down && (e.key === '+' || e.key === '=')) bigMapZoom(1.25);
  if (down && (e.key === '-' || e.key === '_')) bigMapZoom(0.8);
  if (down && e.code === 'Space') bigMapCentre();
  BIGMAP.keys[e.code] = down;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  return true;
}
addEventListener('keyup', e => { if (bigMapOpen()) BIGMAP.keys[e.code] = false; });
