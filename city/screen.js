const cv = document.getElementById('c'), g = cv.getContext('2d');
// ---- screen
let cols, rows, cw, CH, COL, BG, ZB, ZBG, FL, FOGS, FOGB, BASE; // ZBG / FOGB: depth and fog of the background colour
function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
  g.font = FS + 'px monospace'; g.textBaseline = 'top';
  cw = g.measureText('M').width;
  cols = Math.floor(innerWidth / cw); rows = Math.floor(innerHeight / FS);
  const n = cols * rows;
  CH = new Array(n); COL = new Uint8Array(n); BG = new Uint8Array(n); ZB = new Float32Array(n); ZBG = new Float32Array(n); FL = new Uint8Array(n);
  FOGS = new Uint8Array(n); FOGB = new Uint8Array(n);
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
  const centered = (uStep >= cwid || oneCell((fract(q) - 0.5) * cwid, uStep)) && oneCell(z - z0, d / projY);
  set(i, centered ? text[p] : ' ', col); BG[i] = bgc;
  return true;
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

