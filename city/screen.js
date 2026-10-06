const cv = document.getElementById('c'), g = cv.getContext('2d');
// ---- screen
let cols, rows, cw, CH, COL, BG, ZB, ZBG, FL, FOGS, FOGB, BASE, LAMPL; // ZBG / FOGB: depth and fog of the background colour; LAMPL: streetlamp light on a puddle
function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
  g.font = FS + 'px monospace'; g.textBaseline = 'top';
  cw = g.measureText('M').width;
  cols = Math.floor(innerWidth / cw); rows = Math.floor(innerHeight / FS);
  const n = cols * rows;
  CH = new Array(n); COL = new Uint8Array(n); BG = new Uint8Array(n); ZB = new Float32Array(n); ZBG = new Float32Array(n); FL = new Uint8Array(n);
  FOGS = new Uint8Array(n); FOGB = new Uint8Array(n); LAMPL = new Uint8Array(n);
  BASE = new Int32Array(cols);
}
addEventListener('resize', resize); resize();

let tf, projX, projY, hor, dx, dy, eye, lookHit;
const set = (i, c, col) => { CH[i] = c; COL[i] = col; };
const putText = (r, c, s, col) => { for (let k = 0; k < s.length; k++) if (r >= 0 && r < rows && c + k >= 0 && c + k < cols) set(r * cols + c + k, s[k], col); };
const bgAt = (base, lvl) => lvl < 1 ? NONE : C(base, lvl);
// Is this cell the one that gets the letter? `off` = distance from the letter's centre, `step` = size of one cell there.
// Half-open [-0.5, 0.5) so exactly one row/column wins. The small offset breaks exact ties: text at eye height sits precisely
// between two rows, and float rounding could otherwise let both rows through and duplicate the line.
const oneCell = (off, step) => { const k = off / step + 0.0137; return k >= -0.5 && k < 0.5; };
// text painted on a wall: centered on wall coordinate u0 at height z0, one cell per letter however close you are.
// Returns false when (u, z) is outside the text, so the caller draws the wall there instead.
function wallText(i, u, uStep, z, d, text, u0, z0, cwid, bandH, col, bgc = NONE) {
  if (Math.abs(z - z0) > bandH / 2) return false;
  const q = (u - u0) / cwid + text.length / 2, p = Math.floor(q);
  if (p < 0 || p >= text.length) return false;
  if (wallTextBig(u, uStep, d, u0, cwid, bandH, text.length)) { // close enough: every letter drawn large in blocks
    BG[i] = bgc; const ch = text[p];
    return set(i, GLYPH5[ch] !== undefined && glyphOn(ch, Math.floor(fract(q) * 4), Math.floor((z0 + bandH / 2 - z) / bandH * 5)) ? '#' : ' ', col), true;
  }
  const centered = (uStep >= cwid || oneCell((fract(q) - 0.5) * cwid, uStep)) && oneCell(z - z0, d / projY);
  set(i, centered ? text[p] : ' ', col); BG[i] = bgc;
  return true;
}

// is a wall text big enough on screen for block letters? Judged from its smallest (furthest) letter, so the whole text
// switches together. From the ray that hit this wall (WH): how a step along the wall grows with distance along it
function wallTextBig(u, uStep, d, u0, cwid, bandH, len) {
  if (cwid / uStep < 1.5) return false;
  const D = WH.dn, s0 = WH.sl * D, sgn = Math.sign(u * WH.wc) || 1, r0 = D * D + s0 * s0;
  for (const e of [-1, 1]) {
    const s = s0 + sgn * (u0 + e * (len / 2 - 0.5) * cwid - u), r = (D * D + s * s) / r0;
    if (cwid / (uStep * r) < 2.2 || bandH * projY / (d * Math.sqrt(r)) < 2.8) return false;
  }
  return true;
}

// ---- seeing through glass. Before each wall the renderer leaves in WH the ray that hit it: dn, how far the eye is
// from the wall's plane; sl, how far the ray goes along the wall (world units) for each unit it goes in; wc, the
// hit's world coordinate along the wall. Carry the ray on past the glass and whatever is behind it moves as it would
// if it were really there: rooms behind lit windows, plants deep in a glasshouse, the skyline out of a window.
const WH = { dn: 1, sl: 0, wc: 0 };
const glassSlopes = (u, z) => [(Math.sign(u * WH.wc) || 1) * WH.sl, (z - eye) / WH.dn]; // per unit of depth: along u, up
// a box behind the glass: u0..u1 across (in the wall's u), floor z0, ceiling z1, back wall `dep` in. Which face the
// ray meets first, how deep (q), and where on it (u, z)
function boxBehind(u, z, u0, u1, z0, z1, dep) {
  const [su, sz] = glassSlopes(u, z);
  let q = dep, s = 'back';
  if (su > 1e-6 && (u1 - u) / su < q) { q = (u1 - u) / su; s = 'side'; }
  if (su < -1e-6 && (u0 - u) / su < q) { q = (u0 - u) / su; s = 'side'; }
  if (sz > 1e-6 && (z1 - z) / sz < q) { q = (z1 - z) / sz; s = 'ceil'; }
  if (sz < -1e-6 && (z0 - z) / sz < q) { q = (z0 - z) / sz; s = 'floor'; }
  return { s, q, u: u + su * q, z: z + sz * q };
}
// a room behind a lit window, for the street's buildings: wallpaper in the window's colour, a lamp in the ceiling, a
// floor, and something against the back wall (a shelf, a bed, the telly's glow, somebody home). u0..u1 the bay, z0..z1
// the storey, all in cells; `seed` picks the room
function litRoom(i, u, z, u0, u1, z0, z1, col, lit, seed) {
  const b = boxBehind(u, z, u0, u1, z0, z1, (u1 - u0) * 0.9), w = u1 - u0, hh = z1 - z0;
  const fu = (b.u - u0) / w, fz = (b.z - z0) / hh, edge = b.s === 'back' && (fu < 0.03 || fu > 0.97 || fz < 0.03 || fz > 0.97);
  const k = hash(seed, 1, 881), lamp = Math.hypot(fu - 0.5, (b.s === 'ceil' ? b.q / (w * 0.9) : 9) - 0.45) < 0.11;
  if (b.s === 'ceil') { BG[i] = lamp ? C(YEL, 12) : C(col, 2.5); return set(i, ' ', 0); } // a lampshade's glow
  if (b.s === 'floor') { BG[i] = C(BRICK, 1.5 + (1 - b.q / (w * 0.9)) * 1.5); return set(i, fract(b.u * 40) < 0.2 ? '|' : ' ', C(BRICK, lit * 0.5)); }
  if (b.s === 'side') { BG[i] = C(col, 2.2); return set(i, (Math.floor(b.q * 60) + Math.floor(b.z * 60)) % 4 ? ' ' : '.', C(col, lit * 0.4)); }
  if (edge) { BG[i] = C(col, 2); return set(i, fz < 0.03 || fz > 0.97 ? '_' : '|', C(GRAY, lit * 0.5)); }
  BG[i] = C(col, 4);
  if (k < 0.25 && fz < 0.75 && Math.abs(fu - 0.3) < 0.18) return set(i, fract(fz * 5) < 0.2 ? '=' : '#', C(ITEM_COL[(fu * 20 | 0) & 7], lit)); // a bookshelf
  if (k < 0.45 && fz < 0.3 && Math.abs(fu - 0.55) < 0.3) return set(i, fz > 0.24 ? '_' : '#', C(WHITE, lit * 0.8)); // a bed
  if (k < 0.65 && fz > 0.2 && fz < 0.5 && Math.abs(fu - 0.6) < 0.15) { BG[i] = C(BLUE, 6 + Math.sin(T * 7 + seed) * 2); return set(i, ' ', 0); } // the telly
  if (k < 0.8 && fz < 0.62 && Math.abs(fu - 0.4 - 0.15 * Math.sin(T * 0.3 + seed)) < 0.06) return set(i, fz > 0.5 ? 'o' : '|', C(GRAY, 3)); // somebody home
  return set(i, (Math.floor(b.u * 50) + Math.floor(b.z * 50)) % 5 ? ' ' : '.', C(col, lit * 0.4));
}
// out of a window: a building across the street `near` away (its lit windows), the skyline at the horizon (fixed to
// the direction you look, so it stays put as you walk past), and the sky. `up`: how high the window is above the
// street, in the same units
function viewOut(i, u, z, near, up) {
  const [su, sz] = glassSlopes(u, z), nu = u + su * near, nz = z + sz * near + up;
  if (nz > 0 && nz < up + near * 0.25 && Math.abs(fract(nu / (near * 1.5)) - 0.5) < 0.42) { // the building across the street
    const wl = fract(nu / 3), fl = fract(nz / 3), lit = hash(Math.floor(nu / 3), Math.floor(nz / 3), 882) > 0.45 + day * 0.4;
    BG[i] = C(BRICK, 1 + day * 2.5);
    if (wl > 0.25 && wl < 0.75 && fl > 0.3 && fl < 0.8) { if (lit) BG[i] = C(WARM, 6); return set(i, lit ? ' ' : ':', C(GRAY, 5)); }
    return set(i, ' ', 0);
  }
  if (nz < 0) { // the street below: the centre line, cars' lights going by
    const qs = (-up - z) / sz, su_ = u + su * qs;
    BG[i] = C(GRAY, 1 + day);
    if (Math.abs(qs - near * 0.5) < near * 0.03) return set(i, fract(su_ * 0.25) < 0.5 ? '-' : ' ', C(YEL, 9));
    const car = fract(su_ * 0.03 + T * (qs < near * 0.5 ? 0.04 : -0.04) + (qs < near * 0.5 ? 0 : 0.5)) < 0.06 && Math.abs(qs - near * (qs < near * 0.5 ? 0.3 : 0.7)) < near * 0.08;
    return set(i, car ? 'o' : ' ', car ? C(night > 0.3 ? YEL : RED, 13) : 0);
  }
  const ang = Math.atan(su), col = Math.floor(ang * 18), top = hash(col, 4, 883) * 0.3 + (hash(col >> 2, 5, 884) > 0.8 ? 0.25 : 0);
  if (sz < top) { // the skyline, far off
    const lit = night > 0.2 && hash(Math.floor(ang * 90), Math.floor(sz * 90), 885) > 0.8;
    BG[i] = C(GRAY, 1.5 + day * 3); return set(i, lit ? '.' : ' ', C(YEL, 12));
  }
  BG[i] = day > 0.3 ? C(day > 0.6 ? CYAN : BLUE, 3 + day * 8) : dusk > 0.3 ? C(ORANGE, 4) : C(BLUE, 1);
  return set(i, night > 0.5 && hash(Math.floor(ang * 120), Math.floor(sz * 120), 886) > 0.96 ? '.' : ' ', C(WHITE, 12));
}

// fog: at draw time every cell's text and background colors are mixed toward the fog color by distance.
// 8 blend levels, with a Bayer dither between neighbouring levels so the gradient stays smooth.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const fogCache = new Map();
let fogRGB = [0, 0, 0], fogKey = -1;
// Also always: distance haze, so far scenery fades into a sky-tinted color instead of ending in black at the draw distance.
function fogSteps() {
  const foggy = fogAmt > 0.3, k = Math.round(day * 16) * 2 + foggy;
  if (k !== fogKey) { // fog is grey; clear-weather haze is a little bluer
    fogKey = k; fogCache.clear(); const v = 22 + day * 150;
    fogRGB = foggy ? [v, v + 4, v + 12] : [v * 0.7, v * 0.85, Math.min(255, v * 1.15)];
  }
  const anyFog = fogAmt > 0.03, sky = anyFog ? clamp(Math.floor(fogAmt * 8), 0, 8) : 0; // open sky: only real fog
  const level = (z, wisp, dith) => {
    if (z === Infinity) return sky;
    const haze = clamp((z / vis - 0.5) / 0.5, 0, 1);
    const f = anyFog ? Math.max(haze, fogAmt * clamp((z / vis - 0.15) / 0.85 * wisp, 0, 1)) : haze;
    return clamp(Math.floor(f * 8 + dith), 0, 8);
  };
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
    const i = r * cols + x, z = ZB[i], zb = ZBG[i], dith = BAYER[(r & 3) * 4 + (x & 3)];
    const wisp = anyFog && (z !== Infinity || zb !== Infinity) ? 0.85 + 0.3 * noise(x * 0.03 + T * 0.1, r * 0.06, 51) : 0;
    FOGS[i] = level(z, wisp, dith); FOGB[i] = zb === z ? FOGS[i] : level(zb, wisp, dith);
  }
}
function fogged(idx, s) { // palette color (or black for NONE) mixed s/8 of the way to the fog color
  const key = idx * 9 + s;
  let v = fogCache.get(key);
  if (v === undefined) {
    const [r, gg, b] = idx === NONE ? [0, 0, 0] : PALRGB[idx], k = s / 8;
    v = `rgb(${r + (fogRGB[0] - r) * k | 0},${gg + (fogRGB[1] - gg) * k | 0},${b + (fogRGB[2] - b) * k | 0})`;
    fogCache.set(key, v);
  }
  return v;
}


// a phone or tablet: no mouse to lock, touch controls instead (touch.js)
const TOUCH = matchMedia('(pointer: coarse)').matches; // (primary pointer a finger: not a touchscreen laptop with a mouse)
const NATIVE_MOUSE_APP = Boolean(window.__GLYPHPORT_DESKTOP__ && window.__TAURI__?.core?.invoke);
let desktopMouseCaptured = false;
let desktopMouseFallback = false;
// on a touch screen the buttons say what they do, so "E: talk" reads "talk" and "1: Canal St" just "Canal St"
const keyless = s => TOUCH ? s.replace(/(^|\s)[A-Z0-9](?: \(([^)]*)\))?: /g, (m, sp, note) => sp + (note ? note + ': ' : '')) : s;
function lockMouse() { // take the mouse (refused or impossible: a click will do it, or there's no mouse at all)
  if (TOUCH) return;
  if (NATIVE_MOUSE_APP) {
    desktopMouseCaptured = true;
    window.__TAURI__.core.invoke('set_game_mouse_capture', { active: true, confined: true }).then(ok => {
      if (!ok) { desktopMouseCaptured = false; desktopMouseFallback = true; say('Using window-limited mouse-look because native capture was unavailable.', 4); }
      else desktopMouseFallback = false;
    }).catch(() => { desktopMouseCaptured = false; desktopMouseFallback = true; });
    return;
  }
  if (!cv.requestPointerLock) return;
  const p = cv.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
}
function releaseMouse() {
  if (NATIVE_MOUSE_APP) {
    desktopMouseCaptured = false;
    desktopMouseFallback = false;
    window.__TAURI__.core.invoke('set_game_mouse_capture', { active: false, confined: document.hasFocus() }).catch(() => {});
  }
  if (document.pointerLockElement) document.exitPointerLock();
}
const mouseCaptured = () => desktopMouseCaptured || Boolean(document.pointerLockElement);
