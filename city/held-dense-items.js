// ===== the rest of the held items, sculpted the dense way (see held-dense.js). Each is (it, f) => sculpt(W, H, fn):
// x across and y down in row heights from the middle, f how much is left. Whatever you eat or drink shows it going:
// a level dropping, steam fading, fewer pieces, or bites out of it.
const dCol = (col, b, lo = 6, hi = 15) => C(col, lo + clamp(b, 0, 1) * (hi - lo));
const dLit = (b, col, lo, hi) => [dFill(b), dCol(col, b, lo, hi)];
const dEll = (x, y, cx, cy, rx, ry) => Math.hypot((x - cx) / rx, (y - cy) / ry); // under 1: inside
const dBall = (x, y, cx, cy, rx, ry = rx) => dSphere((x - cx) / rx, (y - cy) / ry, 1); // the light on it, -1 outside
// a word across, centred on (cx, cy), a column a letter
const dText = (x, y, cx, cy, word) => { if (Math.abs(y - cy) >= 0.5) return null; const k = Math.floor((x - cx) / D_ASPECT + word.length / 2); return k >= 0 && k < word.length && word[k] !== ' ' ? word[k] : null; };
// bites marching in from the right, one per use gone: true in a bite, 'rim' along its edge
function dBitesR(x, y, f, x1, r, cy = 0, n = 3) {
  const gone = Math.round((1 - f) * n);
  let rim = false;
  for (let k = 0; k < gone; k++) { const d = Math.hypot(x - (x1 - k * r * 1.1), (y - cy - (k & 1 ? 0.4 : -0.4)) * 1.2) - r; if (d < 0) return true; if (d < 0.6) rim = true; }
  return rim ? 'rim' : false;
}
// eaten from the top down: gone above a scalloped line that drops as f does; 'rim' just under it
function dBitesTop(x, y, f, top, depth) {
  const e = (1 - f) * depth;
  if (e <= 0) return false;
  const line = top + e + 0.8 - Math.abs(Math.sin(x * 0.9)) * 1.1;
  return y < line ? true : y < line + 0.6 ? 'rim' : false;
}
// a glass (or a clear cup): hw(y) its half-width at y, from top to bot; full to f of the way with liq ([colour, char])
// under a surface; foam: a head on it. Returns a cell, null (clear, nothing there) or undefined (not the glass)
function dGlass(x, y, top, bot, hw, f, liq, foam = null) {
  if (y < top || y > bot) return undefined;
  const w = hw(y);
  if (Math.abs(x) > w) return undefined;
  if (y > bot - 0.7) return ['_', C(WHITE, 12)];
  if (Math.abs(x) > w - 0.42) return ['|', C(WHITE, x < 0 ? 14 : 10)];
  const lvl = bot - 0.7 - (bot - 0.7 - top - 0.8) * f, b = dCyl(x, w);
  if (f > 0 && y >= lvl) {
    if (foam && y < lvl + 1.2) return [foam[1], dCol(foam[0], 0.6 + b * 0.4, 9)];
    if (y < lvl + 0.6) return ['~', dCol(liq[0], b, 9)];
    return [liq[1] || dFill(b), dCol(liq[0], b, 6, 14)];
  }
  return Math.abs(x + w * 0.55) < 0.25 ? [':', C(WHITE, 7)] : null; // a glint on the empty glass
}
const dStraw = (x, y, x0, y0, x1, y1, col) => { // a straight straw from (x0, y0) to (x1, y1), striped
  const t = clamp(((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2), 0, 1), d = Math.hypot(x - x0 - t * (x1 - x0), y - y0 - t * (y1 - y0));
  return d < 0.42 ? [Math.abs(x1 - x0) < Math.abs(y1 - y0) * 0.3 ? '|' : (x1 - x0) * (y1 - y0) < 0 ? '/' : '\\', (Math.floor(t * 8) & 1) ? C(WHITE, 14) : col] : null;
};
const dSteam = (x, y, top, f, xs, h = 3.4) => { // wisps curling up from top while there's enough left
  if (y >= top || y < top - h || f <= 0.3) return null;
  for (const s of xs) { const ph = y * 1.3 + T * 2.5 + s * 2, wx = s + Math.sin(ph) * 0.5; if (Math.abs(x - wx) < 0.22) return [Math.cos(ph) > 0 ? '(' : ')', C(WHITE, 6 + (y - top + h) * 1.5)]; }
  return null;
};
// a drinks can: a colour, a word, a stripe; bites out of it as it goes
const dCan = (col, word, stripe, deco) => (it, f) => sculpt(26, 15, (x, y) => {
  const hw = 4.3, top = -6.2, bot = 6.5;
  if (y < top || y > bot || Math.abs(x) > hw + (y < top + 0.8 || y > bot - 0.8 ? -0.35 : 0)) return null;
  if (dBites(x, y, 0.45 + f * 0.55, hw) === true) return null;
  const b = dCyl(x, hw);
  if (y < top + 0.8) return Math.abs(x - 1) < 0.6 && y < top + 0.4 ? ['o', C(GRAY, 14)] : ['=', dCol(GRAY, b, 7)];
  if (y > bot - 0.8) return ['_', dCol(GRAY, b, 7)];
  const t = dText(x, y, 0, -1.6, word); if (t) return [t, C(stripe, 15)];
  const d = deco && deco(x, y); if (d) return d;
  return [b > 0.92 ? '|' : dFill(b), b > 0.92 ? C(WHITE, 15) : dCol(col, b)];
});
// n pieces in a row along a tray (sushi, dumplings, takoyaki): which piece (x, y) is in, and where in it
const dPieces = (x, n, x0, step) => { const k = Math.floor((x - x0) / step); return k >= 0 && k < n ? [k, x - x0 - (k + 0.5) * step] : null; };

Object.assign(DENSE, {
  // ---- the night market's, and the two that bend the world
  pocketwatch: () => sculpt(26, 16, (x, y) => { // brass, a cracked glass, the hands racing round while you hold T
    const fast = K.KeyT && timeKeys(), ang = T * (fast ? 9 : 0.12), cx = 0, cy = 1, R = 5.4;
    if (dEll(x, y, 0, -6.2, 1.1, 0.8) < 1 && dEll(x, y, 0, -6.2, 1.1, 0.8) > 0.55) return ['o', C(GRAY, 12)]; // the ring for the chain
    if (Math.abs(x) < 0.7 && y > -5.6 && y < -4.4) return dLit(0.7, YEL, 8); // the crown
    const d = dEll(x, y, cx, cy, R, R);
    if (d > 1) return null;
    if (d > 0.84) return dLit(0.35 + dBall(x, y, cx, cy, R) * 0.65, YEL, 9, 15); // the case
    const rx = x - cx, ry = y - cy, r = Math.hypot(rx, ry), a = Math.atan2(rx, -ry);
    if (r < 0.5) return ['o', C(YEL, 15)];
    const hand = (an, len) => { const hx = Math.sin(an) * len, hy = -Math.cos(an) * len, t = clamp((rx * hx + ry * hy) / (len * len), 0, 1); return Math.hypot(rx - hx * t, ry - hy * t) < 0.38; };
    if (hand(ang, R * 0.72)) return ['#', C(fast ? RED : WHITE, 15)];
    if (hand(ang / 12, R * 0.45)) return ['#', C(WHITE, 12)];
    if (r > R * 0.64 && Math.abs(fract(a / (Math.PI / 6) + 0.5) - 0.5) < 0.14) return ['+', C(YEL, 12)]; // the hour marks
    if (Math.abs(rx * 0.7 - ry - 1.2) < 0.25 && rx > -1 && rx < 3.6) return ['/', C(CYAN, 10)]; // the crack across the glass
    return ['.', C(WARM, 6 + dBall(x, y, cx, cy, R * 0.84) * 3)]; // the face, old and yellowed
  }),
  cityglobe: () => sculpt(26, 16, (x, y) => { // the city in glass: its towers lit, the sky outside's weather inside, snow swirling after a shake
    if (y > 4.2 && y < 7.4 && Math.abs(x) < 4.8) { const t_ = dText(x, y, 0, 5.8, 'GLYPHPORT'); return t_ ? [t_, C(YEL, 14)] : dLit(0.55 - (y - 4.2) * 0.08, BRICK, 7); }
    const d = dEll(x, y, 0, -1.2, 5.4, 5.4);
    if (d > 1 || y > 4.2) return null;
    if (d > 0.92) return ['|', C(WHITE, 12)];
    const shaken = T - globeT < GLOBE_SETTLE, k = Math.floor(x / D_ASPECT + 20), towerH = 1 + hash(k >> 1, 3, 987) * 4.5;
    if (y > 4.2 - towerH && y > -0.5 - (k & 1)) return hash(k, Math.floor(y * 1.6), 988) > 0.55 ? ['#', C(night > 0.3 || weather !== 'clear' ? YEL : WHITE, 13)] : ['|', C(GRAY, 4)]; // the towers
    const snow = hash(Math.floor(x * 1.8), Math.floor(y + T * (shaken ? 4 : 0.6)), 986) > (shaken ? 0.7 : 0.94);
    if (snow) return ['*', C(WHITE, 15)];
    if (weather === 'rain' || weather === 'storm') { if (fract(x * 0.9 + y * 0.5 - T * 3) < 0.12) return ['/', C(CYAN, 11)]; if (weather === 'storm' && fract(T * 0.7) < 0.05) return [' ', 0, C(WHITE, 8)]; }
    if (weather === 'fog' && hash(Math.floor(x * 2), Math.floor(y * 2 - T), 989) > 0.6) return [':', C(GRAY, 10)];
    if (weather === 'clear' && hash(Math.floor(x * 3), Math.floor(y * 3), 990) > 0.96) return ['.', C(WHITE, 12)];
    return [' ', 0];
  }),
  bubbletea: (it, f) => sculpt(24, 17, (x, y) => { // milk tea, tapioca pearls in the bottom, a fat straw
    const s = dStraw(x, y, 0.8, -1, 2, -8.5, C(MAG, 13)); if (s) return s;
    const g = dGlass(x, y, -4, 8, yy => 3.9 - (yy + 4) * 0.06, f, [WARM, null]);
    if (g && !'|_'.includes(g[0]) && y > 4.6 && hash(Math.floor(x * 1.7), Math.floor(y * 1.2), 991) > 0.35) return ['o', C(BRICK, 9)];
    return g === undefined ? null : g;
  }),
  bao: (it, f) => sculpt(26, 12, (x, y) => { // a steamed bun, pleated on top, bites out of it
    const st = dSteam(x, y, -3.6, f, [-1.6, 1.4]); if (st) return st;
    const d = dEll(x, y, 0, 0.8, 5.6, 3.8);
    if (d > 1 || y > 3.6) return null;
    const bite = dBites(x, y, f, 5); if (bite === true) return null; if (bite === 'rim') return [':', C(BRICK, 12)];
    if (y < -1.2 && Math.abs(fract(Math.atan2(x, y + 3) * 2) - 0.5) < 0.12) return ['~', C(GRAY, 11)]; // the pleats
    return dLit(dBall(x, y, 0, 0.8, 5.6, 3.8), WHITE, 9, 15);
  }),
  eggwaffle: (it, f) => sculpt(28, 12, (x, y) => { // a sheet of golden bubbles
    const d = dEll(x, y, 0, 0, 7, 4.2);
    if (d > 1) return null;
    const bite = dBites(x, y, f, 6.5); if (bite === true) return null; if (bite === 'rim') return [':', C(WARM, 13)];
    const bx = fract(x / 1.3 + (Math.floor(y / 1.4) & 1) * 0.5), by_ = fract(y / 1.4), bub = Math.hypot(bx - 0.5, by_ - 0.5) < 0.38;
    return bub ? ['O', C(YEL, 12 + dBall(x, y, 0, 0, 7, 4.2) * 3)] : ['-', C(ORANGE, 9)];
  }),
  stinkytofu: (it, f) => sculpt(22, 17, (x, y) => { // golden cubes on a stick, one fewer a bite, and the smell rising off them
    const n = Math.max(1, it.uses), top = 5.2 - n * 2.6;
    if (Math.abs(x) < 0.25 && y > top) return ['|', C(BRICK, 12)];
    for (let k = 0; k < n; k++) { const cy = 3.8 - k * 2.6; if (Math.abs(x) < 1.9 && Math.abs(y - cy) < 1.05) return dLit(0.4 + (1.9 - Math.abs(x + 0.5)) * 0.25, ORANGE, 8); }
    if (y < top && y > top - 4) for (const s of [-1.4, 0.4, 1.8]) { const ph = y * 1.2 + T * 2 + s; if (Math.abs(x - s - Math.sin(ph) * 0.6) < 0.25) return ['~', C(GREEN, 7 + (y - top + 4) * 1.5)]; } // the stink
    return null;
  }),
  redstring: () => sculpt(24, 10, (x, y) => { // a loop of red thread, a knot and a gold bead
    if (dEll(x, y, 2.2, 3.2, 0.7, 0.6) < 1) return dLit(0.85, YEL, 10);
    const d = dEll(x, y, 0, 0, 5.6, 3.4);
    if (Math.abs(d - 1) < 0.1) return ['~', C(RED, 12 + Math.sin(x * 2) * 2)];
    if (Math.abs(x - 3.4) < 0.3 && y > 3 && y < 4.6) return ['\\', C(RED, 12)];
    return null;
  }),
  luckycoin: () => sculpt(22, 12, (x, y) => { // a gold coin with a square hole, characters round it
    const d = dEll(x, y, 0, 0, 5, 5);
    if (d > 1) return null;
    if (Math.abs(x) < 1.1 && Math.abs(y) < 1.1) return null; // the hole
    if (d > 0.88) return dLit(dBall(x, y, 0, 0, 5), YEL, 7, 14);
    if (Math.abs(x) < 1.6 && Math.abs(y) < 1.6) return ['#', C(YEL, 9)];
    const a = Math.atan2(y, x), mark = d > 0.5 && d < 0.75 && Math.abs(fract(a / (Math.PI / 2) + 0.5) - 0.5) < 0.12;
    return mark ? ['%', C(BRICK, 9)] : dLit(dBall(x, y, 0, 0, 5) * 0.8, YEL, 8, 13);
  }),
  fortunecookie: () => sculpt(24, 11, (x, y) => { // folded in a crescent, the slip of paper poking out
    if (y > -0.6 && y < 0.3 && x > 2.4 && x < 7.4) { const t_ = dText(x, y, 4.9, -0.15, 'LUCK'); return t_ ? [t_, C(RED, 12)] : ['=', C(WHITE, 14)]; }
    const d = dEll(x, y, -0.6, 0.4, 5, 3.4), notch = dEll(x, y, 2.2, 1.2, 2.6, 2);
    if (d > 1 || notch < 1) return null;
    return dLit(dBall(x, y, -0.6, 0.4, 5, 3.4), YEL, 7, 14);
  }),
  tigerbalm: it => sculpt(24, 12, (x, y) => { // a little round tin, a tiger on the lid
    if (Math.abs(x) > 5.2 || y < -4.6 || y > 4.6) return null;
    if (y < -3) return dLit(0.75 - Math.abs(x) * 0.05, GRAY, 8, 14); // the lid's rim
    const t_ = dText(x, y, 0, 2.6, 'TIGER'); if (t_) return [t_, C(YEL, 15)];
    if (dEll(x, y, 0, -0.6, 2.2, 1.6) < 1) return [Math.abs(x) < 0.4 && y > -0.6 ? 'v' : fract(x * 0.8) < 0.3 ? '|' : '%', C(ORANGE, 14)]; // the tiger's face, striped
    return dLit(0.5 - x * 0.04, RED, 7, 12);
  }),
  lantern: () => sculpt(24, 16, (x, y) => { // a red paper lantern, ribbed, glowing from inside, a gold tassel
    if (Math.abs(x) < 0.25 && y < -6) return ['|', C(GRAY, 10)];
    if (y > 5.6 && y < 7.6 && Math.abs(x) < 0.6) return ['|', C(YEL, 13)];
    if ((y < -5 && y > -6 || y > 4.6 && y < 5.6) && Math.abs(x) < 2.2) return ['=', C(YEL, 14)];
    const d = dEll(x, y, 0, -0.2, 5, 4.8);
    if (d > 1) return null;
    const lit = (1 - d) * (night > 0.3 ? 1 : 0.6) + 0.25 * (0.5 + 0.5 * Math.sin(T * 7 + x));
    if (Math.abs(fract(x / (5 * Math.sqrt(Math.max(0.05, 1 - (y / 4.8) ** 2))) * 3 + 0.5) - 0.5) < 0.07) return ['|', C(RED, 6 + lit * 4)]; // the ribs
    return [dFill(clamp(lit, 0, 1)), C(lit > 0.7 ? YEL : lit > 0.45 ? ORANGE : RED, 8 + lit * 7)];
  }),
  firecrackers: it => sculpt(20, 17, (x, y) => { // a string of red crackers on a fuse, one pair fewer each time
    const n = Math.max(1, it.uses), top = 6.6 - n * 3.6;
    if (y < top - 0.4 && y > top - 3.4 && Math.abs(x - Math.sin(y * 2) * 0.4) < 0.3) return ['~', C(GRAY, 11)]; // the fuse
    if (y < top - 3.4 && y > top - 4.6 && Math.abs(x) < 1) return ['*', C(T % 0.4 < 0.2 ? YEL : WHITE, 15)];
    if (y < top || y > 7) return null;
    if (Math.abs(x) < 0.25) return ['|', C(GRAY, 9)];
    const k = Math.floor((y - top) / 1.8), side = (k & 1 ? 1 : -1), cx = side * 1.6;
    if (Math.abs(x - cx) < 1.4 && fract((y - top) / 1.8) < 0.7) return Math.abs(x - cx) > 1.1 ? ['|', C(YEL, 12)] : dLit(0.5 - (x - cx) * 0.15, RED, 8, 14);
    return null;
  }),
  mysterybox: () => sculpt(24, 13, (x, y) => { // a cardboard box, a red ribbon, a question mark, rattling
    const jig = Math.sin(T * 13) > 0.92 ? 0.3 : 0;
    x -= jig;
    if (y < -3.6 && y > -5.2 && Math.abs(x) < 2.2 && Math.abs(Math.abs(x) - 1.1) < 0.6) return ['8', C(RED, 13)]; // the bow
    if (Math.abs(x) > 5 || y < -3.6 || y > 5.4) return null;
    if (Math.abs(x) < 0.45 || Math.abs(y + 1.6) < 0.4) return ['#', C(RED, 12)];
    const q = dText(x, y, 2.6, 2.2, '?'); if (q) return [q, C(WHITE, 15)];
    return dLit(0.45 + (y < -2.5 ? 0.25 : 0) - x * 0.03, WARM, 6, 11); // cardboard
  }),
  // ---- drinks
  latte: (it, f) => sculpt(30, 14, (x, y) => { // a glass mug: espresso under a white head, a handle
    const handle = dEll(x, y, 4.6, 0.6, 1.6, 2.6);
    if (handle < 1 && handle > 0.62 && x > 3.6) return ['(', C(WHITE, 12)];
    const g = dGlass(x + 0.6, y, -5.5, 6.5, () => 4, f, [BRICK, null], [WHITE, '@']);
    return g === undefined ? null : g;
  }),
  tea: (it, f) => sculpt(30, 15, (x, y) => { // a glass cup of tea on its saucer, steaming
    const st = dSteam(x, y, -3.6, f, [-1.2, 1.2]); if (st) return st;
    if (y > 5.6 && y < 6.6 && Math.abs(x) < 6) return ['=', dCol(WHITE, 1 - Math.abs(x) / 6, 9)];
    const handle = dEll(x, y, 4.5, 0.8, 1.4, 2.2);
    if (handle < 1 && handle > 0.6 && x > 3.6) return [')', C(WHITE, 12)];
    const g = dGlass(x, y, -3.5, 5.6, yy => 4 - Math.max(0, yy - 2) * 0.35, f, [ORANGE, null]);
    return g === undefined ? null : g;
  }),
  energy: dCan(GREEN, 'ZAP', YEL, (x, y) => Math.abs(x - (y > 1.5 ? 0.5 : -0.2) + (y - 1.5) * 0.25) < 0.4 && y > -0.6 && y < 4.4 ? ['/', C(YEL, 15)] : null), // a lightning bolt
  water: (it, f) => sculpt(22, 17, (x, y) => { // a plastic bottle: blue cap, a label round the middle, the water going down
    if (y < -7 && Math.abs(x) < 1.3) return dLit(0.4 + 0.5 * dCyl(x, 1.3), BLUE, 8);
    const hw = yy => yy < -5.2 ? 1.1 : yy < -3 ? 1.1 + (yy + 5.2) * 1.1 : 3.5;
    if (y > -1.2 && y < 1.8 && Math.abs(x) < 3.5) { const t = dText(x, y, 0, 0.3, 'AQUA'); return t ? [t, C(BLUE, 15)] : dLit(dCyl(x, 3.5), WHITE, 8); }
    const g = dGlass(x, y, -7, 8, hw, f, [CYAN, null]);
    return g === undefined ? null : g;
  }),
  beer: (it, f) => sculpt(26, 16, (x, y) => { // a pint, wider at the top, a foamy head
    const g = dGlass(x, y, -7, 7.5, yy => 4.2 - (yy + 7) * 0.08, f, [YEL, null], [WHITE, '@']);
    return g === undefined ? null : g;
  }),
  whiskey: (it, f) => sculpt(28, 11, (x, y) => { // a tumbler: short, heavy-bottomed, ice in it
    if (y > 3.6 && Math.abs(x) < 4.8) return ['#', C(WHITE, 9)]; // the thick base
    const lvl = 3.6 - 7.6 * f;
    for (const [ix, iy] of [[-1.5, lvl + 1.1], [1.4, lvl + 0.8]]) if (f > 0.2 && Math.abs(x - ix) < 1 && Math.abs(y - iy) < 0.8) return [Math.abs(x - ix) > 0.7 || Math.abs(y - iy) > 0.5 ? '+' : ' ', C(WHITE, 14)]; // ice cubes
    const g = dGlass(x, y, -5, 4.4, () => 4.8, f, [ORANGE, null]);
    return g === undefined ? null : g;
  }),
  cocktail: (it, f) => sculpt(28, 15, (x, y) => { // a martini glass with an olive on a pick
    { const s = dStraw(x, y, 2.6, -7, 0.6, -2.6, C(GRAY, 13)); if (s) return [s[0], C(GRAY, 13)]; } // the pick
    if (dEll(x, y, 1.1, -3.6, 0.8, 0.7) < 1) return ['@', C(GREEN, 13)];
    if (y > 6.4 && Math.abs(x) < 3) return ['=', C(WHITE, 12)];
    if (y > 1 && Math.abs(x) < 0.3) return ['|', C(WHITE, 12)];
    const g = dGlass(x, y, -5.5, 1.6, yy => Math.max(0.5, 5.4 * (1.6 - yy) / 7.1), f, [MAG, null]);
    return g === undefined ? null : g;
  }),
  milkshake: (it, f) => sculpt(26, 18, (x, y) => { // a tall glass, whipped cream, a cherry, a striped straw
    const s = dStraw(x, y, 0.8, -3, 3, -8.5, C(RED, 13)); if (s) return s;
    if (f > 0.4 && dEll(x, y, -0.6, -6.6, 0.8, 0.7) < 1) return ['@', C(RED, 15)];
    if (f > 0.4 && y < -4 && y > -6.2 && Math.abs(x) < 3.8 - (y + 6.2) * -0.2 + (y < -5.2 ? -1.2 : 0)) return ['@', dCol(WHITE, dBall(x, y, 0, -4, 3.8, 2.4), 10)];
    const g = dGlass(x, y, -4, 8.5, yy => 3.6 - (yy + 4) * 0.08, f, [MAG, null]);
    return g === undefined ? null : g;
  }),
  smoothie: (it, f) => sculpt(24, 17, (x, y) => { // a clear cup with a domed lid and a fat green straw
    const s = dStraw(x, y, 0.4, -2, 1.4, -8.5, C(GREEN, 13)); if (s) return s;
    if (y < -3.6 && y > -6 && dEll(x, y, 0, -3.6, 3.9, 2.4) < 1 && dEll(x, y, 0, -3.6, 3.4, 1.9) > 1) return ['-', C(WHITE, 11)];
    const g = dGlass(x, y, -3.6, 8, yy => 3.9 - (yy + 3.6) * 0.07, f, [ORANGE, null]);
    return g === undefined ? null : g;
  }),
  thaitea: (it, f) => sculpt(24, 17, (x, y) => { // orange tea, cream swirling down through it
    const s = dStraw(x, y, 0.6, -2, 1.6, -8.5, C(WHITE, 12)); if (s) return s;
    const g = dGlass(x, y, -4, 8, yy => 3.9 - (yy + 4) * 0.07, f, [ORANGE, null]);
    if (g && !'|_:~'.includes(g[0]) && Math.sin(x * 1.6 + y * 0.9 + T * 0.3) > 0.6 && y > -4 + 12 * (1 - f)) return ['~', C(WARM, 15)];
    return g === undefined ? null : g;
  }),
  herbaltea: (it, f) => sculpt(30, 13, (x, y) => { // green tea in a glass cup, a leaf floating, steam
    const st = dSteam(x, y, -2.6, f, [-1, 1]); if (st) return st;
    const handle = dEll(x, y, 4.6, 1.2, 1.4, 2);
    if (handle < 1 && handle > 0.6 && x > 3.6) return [')', C(WHITE, 12)];
    const g = dGlass(x, y, -2.5, 5.8, yy => 4.2 - Math.max(0, yy - 2) * 0.4, f, [GREEN, null]);
    if (g && g[0] === '~' && Math.abs(x + 1) < 0.8) return ['%', C(GREEN, 15)];
    return g === undefined ? null : g;
  }),
  sake: (it, f) => sculpt(20, 9, (x, y) => { // a little white cup, a blue ring round it; bites out of it anyway
    const hw = 3.3 - Math.max(0, y - 1) * 0.5;
    if (y < -3.5 || y > 3.6 || Math.abs(x) > hw) return null;
    if (dBites(x, y, 0.45 + f * 0.55, 3.3) === true) return null;
    const b = dCyl(x, hw);
    if (Math.abs(y + 1.6) < 0.45) return ['=', C(BLUE, 13)];
    if (y < -3) return ['~', C(WHITE, 15)];
    return dLit(b, WHITE, 8);
  }),
  melonsoda: (it, f) => sculpt(24, 18, (x, y) => { // bright green soda, bubbles rising, a scoop of vanilla and a cherry on top
    const s = dStraw(x, y, 1.6, -2, 3, -8.5, C(GREEN, 12)); if (s) return s;
    if (f > 0.5 && dEll(x, y, 0.4, -7.2, 0.8, 0.7) < 1) return ['@', C(RED, 15)];
    if (f > 0.5 && dEll(x, y, 0, -4.8, 2.8, 2) < 1 && y < -3.6) return dLit(dBall(x, y, 0, -4.8, 2.8, 2), WHITE, 9);
    const g = dGlass(x, y, -4, 8.5, () => 3.4, f, [GREEN, null]);
    if (g && g[0] !== '|' && g[0] !== '_' && g[0] !== '~' && g[0] !== ':' && hash(Math.floor(x * 3), Math.floor(y + T * 3), 961) > 0.86) return ['o', C(WHITE, 13)];
    return g === undefined ? null : g;
  }),
  lemonade: (it, f) => sculpt(26, 16, (x, y) => { // a jar of lemonade, a slice of lemon on the rim, a straw
    const s = dStraw(x, y, -0.6, -2, -2, -8, C(RED, 13)); if (s) return s;
    const lw = dEll(x, y, 3.2, -5, 1.8, 1.8);
    if (lw < 1) return [lw > 0.8 ? 'O' : (Math.floor(Math.atan2(y + 5, x - 3.2) * 2.5) & 1) ? '*' : ':', C(YEL, lw > 0.8 ? 12 : 15)];
    if (y < -4.8 && y > -5.6 && Math.abs(x) < 4) return ['=', C(GRAY, 12)]; // the jar's thread
    const g = dGlass(x, y, -4.8, 7.5, () => 4, f, [YEL, null]);
    return g === undefined ? null : g;
  }),
  // ---- food
  hotdog: (it, f) => sculpt(32, 9, (x, y) => {
    const bite = dBitesR(x, y, f, 9, 1.6); if (bite === true) return null;
    const saus = dEll(x, y, 0, -0.3, 9.4, 1.15);
    if (saus < 1) {
      if (Math.abs(y + 0.9 - Math.sin(x * 2.6) * 0.35) < 0.3 && Math.abs(x) < 7.6) return ['~', C(YEL, 15)]; // mustard
      return dLit(dBall(x, y, 0, -0.3, 9.4, 1.15), RED, 6, 14);
    }
    const bun = dEll(x, y, 0, 0.6, 8.2, 2.4);
    if (bun < 1 && y > -0.6) return bite === 'rim' ? [':', C(WARM, 14)] : dLit(dBall(x, y, 0, 0.6, 8.2, 2.4), ORANGE, 7);
    return null;
  }),
  taco: (it, f) => sculpt(30, 12, (x, y) => {
    const bite = dBites(x, y, f, 6.5); if (bite === true) return null;
    const r = Math.hypot(x, (y + 1.5) * 1.05);
    if (y > -1.5 && r < 6.6) return bite === 'rim' ? [':', C(YEL, 14)] : [r > 5.9 ? '#' : (Math.floor(x * 2) + Math.floor(y * 2)) % 5 ? dFill(0.6 - (y + 1.5) * 0.06) : '.', dCol(YEL, 0.85 - (y + 1.5) * 0.08)];
    if (y > -3.4 && y <= -1.5 && Math.abs(x) < 5.6 && y > -3.2 + Math.abs(Math.sin(x * 2.1)) * 0.9) { // the filling, poking out of the top
      const n = hash(Math.floor(x * 2), Math.floor(y * 2), 962);
      return n > 0.8 ? ['o', C(RED, 14)] : n > 0.55 ? ['#', C(BRICK, 11)] : n > 0.4 ? [':', C(YEL, 15)] : ['%', C(GREEN, 13)];
    }
    return null;
  }),
  icecream: (it, f) => sculpt(20, 18, (x, y) => { // two scoops on a waffle cone, eaten from the top
    const bite = dBitesTop(x, y, 0.3 + f * 0.7, -8.6, 7); if (bite === true) return null;
    if (y > 0.4 && Math.abs(x) < 3.2 * (8.6 - y) / 8.2) return [(Math.floor((x + y) * 1.4) & 1) ^ (Math.floor((x - y) * 1.4) & 1) ? '#' : '+', dCol(ORANGE, 0.8 - Math.abs(x) * 0.12, 7)];
    for (const [cy, r, col] of [[-1.4, 3.3, MAG], [-5.6, 2.8, WHITE]]) {
      if (Math.hypot(x, y - cy) < r) return bite === 'rim' ? [':', C(col, 15)] : dLit(dBall(x, y, 0, cy, r), col, 7);
    }
    return null;
  }),
  noodlebox: (it, f) => sculpt(28, 16, (x, y) => { // a white takeout box, noodles heaped in it, chopsticks
    for (const o of [0, 1]) { const s = dStraw(x, y, 4.3 + o, -1, 1.2 + o, -7.6, C(BRICK, 13)); if (s) return [s[0], C(BRICK, 13)]; }
    const hw = 4.6 - (y + 1.4) * 0.14;
    if (y > -1.4 && y < 6.8 && Math.abs(x) < hw) {
      if (dEll(x, y, 0, 2.6, 1.3, 1.3) < 1) return ['@', C(RED, 13)]; // the printed mark
      return dLit(0.55 + 0.45 * dCyl(x, hw), WHITE, 7);
    }
    const heap = -1.4 - 2.6 * f;
    if (y <= -1.4 && y > heap + Math.abs(Math.sin(x * 1.3)) * 0.6 && Math.abs(x) < 4.2) return ['~', dCol(YEL, 0.6 + 0.4 * Math.sin(x * 3 + y * 5), 9)];
    return null;
  }),
  ramen: (it, f) => sculpt(32, 13, (x, y) => { // a red bowl, the broth from above: noodles, an egg, nori; less of it each time
    for (const o of [0, 1]) { const s = dStraw(x, y, -1, -2.2 - o, 9, -5.8 - o, C(BRICK, 13)); if (s) return [s[0], C(BRICK, 13)]; } // chopsticks
    if (y > -0.6 && dEll(x, y, 0, -0.6, 8.2, 6) < 1) { const b = dBall(x, y, 0, -0.6, 8.2, 6.6); return Math.abs(y - 2.4) < 0.4 ? ['=', C(WHITE, 13)] : dLit(b, RED, 6); }
    if (dEll(x, y, 0, -0.6, 7.8, 1.6) < 1) { // the top of the broth
      if (f > 0.6 && dEll(x, y, -3.6, -0.9, 1.4, 0.8) < 1) return [dEll(x, y, -3.6, -0.9, 0.6, 0.4) < 1 ? '@' : 'O', C(dEll(x, y, -3.6, -0.9, 0.6, 0.4) < 1 ? YEL : WHITE, 15)];
      if (f > 0.3 && x > 2.4 && x < 4.6 && y > -2) return ['#', C(GREEN, 6)];
      if (hash(Math.floor(x * 3), Math.floor(y * 2), 963) < f * 0.9) return ['~', C(YEL, 14)];
      return [':', C(WARM, 10)];
    }
    return null;
  }),
  pho: (it, f) => sculpt(32, 14, (x, y) => { // a white bowl, beef, herbs and noodles in clear broth
    for (const o of [0, 1]) { const s = dStraw(x, y, -1, -2.3 - o, 9, -5.9 - o, C(BRICK, 13)); if (s) return [s[0], C(BRICK, 13)]; }
    if (y > -0.6 && dEll(x, y, 0, -0.6, 8.2, 6) < 1) { const b = dBall(x, y, 0, -0.6, 8.2, 6.6); return Math.abs(y - 2.4) < 0.4 ? ['~', C(BLUE, 13)] : dLit(b, WHITE, 7); }
    if (dEll(x, y, 0, -0.6, 7.8, 1.6) < 1) {
      const n = hash(Math.floor(x * 3), Math.floor(y * 2), 964);
      if (n < f * 0.25) return [',', C(GREEN, 15)];
      if (n < f * 0.45) return ['=', C(BRICK, 12)];
      if (n < f * 0.95) return ['~', C(WHITE, 14)];
      return [':', C(WARM, 11)];
    }
    return null;
  }),
  banhmi: (it, f) => sculpt(32, 9, (x, y) => { // a baguette split and stuffed
    const bite = dBitesR(x, y, f, 9.4, 1.7); if (bite === true) return null;
    const d = dEll(x, y, 0, 0.3, 9.6, 2.6);
    if (d > 1) return null;
    if (bite === 'rim') return [':', C(WARM, 14)];
    if (Math.abs(y + 0.4 - Math.sin(x * 1.7) * 0.3) < 0.55 && Math.abs(x) < 8.6) { const n = hash(Math.floor(x * 2), 1, 965); return [n > 0.66 ? '%' : n > 0.33 ? '=' : '~', C(n > 0.66 ? GREEN : n > 0.33 ? RED : ORANGE, 13)]; }
    const b = dBall(x, y, 0, 0.3, 9.6, 2.6);
    return Math.abs(fract(x * 0.4 - y * 0.3) - 0.5) < 0.06 && y < 0 ? ['/', C(BRICK, 10)] : dLit(b, ORANGE, 7);
  }),
  padthai: (it, f) => sculpt(30, 12, (x, y) => { // a heap of noodles on a plate, shrimp and peanuts, getting smaller
    if (y > 2.6 && y < 4 && Math.abs(x) < 8.6 - (y - 2.6)) return ['=', dCol(WHITE, 0.8 - Math.abs(x) * 0.05, 9)];
    const h = 1 + 5 * f, d = dEll(x, y, 0, 2.6, 7.2 * (0.55 + 0.45 * f), h);
    if (y <= 2.6 && d < 1) {
      const n = hash(Math.floor(x * 2.5), Math.floor(y * 2), 966);
      if (n > 0.9) return ['@', C(BRICK, 14)];
      if (n > 0.82) return ['*', C(YEL, 15)];
      if (n > 0.76) return [',', C(GREEN, 15)];
      return ['~', dCol(ORANGE, dBall(x, y, 0, 2.6, 7.2, h), 8)];
    }
    return null;
  }),
  greencurry: (it, f) => sculpt(30, 12, (x, y) => { // a bowl of green curry: chunks of chicken and veg, fewer each spoonful
    if (y > -1 && dEll(x, y, 0, -1, 7.6, 5.6) < 1) return dLit(dBall(x, y, 0, -1, 7.6, 6), WHITE, 7);
    if (dEll(x, y, 0, -1, 7.2, 1.5) < 1) {
      const n = hash(Math.floor(x * 1.6), Math.floor(y * 1.5), 967);
      if (n < f * 0.35) return ['o', C(WHITE, 14)];
      if (n < f * 0.5) return ['%', C(RED, 13)];
      return ['~', dCol(GREEN, 0.5 + 0.5 * Math.sin(x * 2 + y * 3 + T), 9)];
    }
    if (f > 0.5 && y < -2.4 && y > -4 && Math.abs(x - 1.4 - Math.sin(y * 3) * 0.4) < 0.3) return [',', C(GREEN, 15)]; // a basil sprig
    return null;
  }),
  mangorice: (it, f) => sculpt(30, 11, (x, y) => { // sticky rice, a fan of mango slices on top
    if (y > 2.6 && y < 3.8 && Math.abs(x) < 8 - (y - 2.6)) return ['=', C(GREEN, 12)]; // the leaf plate
    const slices = Math.ceil(f * 3);
    for (let k = 0; k < slices; k++) { const cx = -3.6 + k * 3.6, d = dEll(x, y, cx, -1.4, 1.9, 2.6); if (d < 1 && y < 0.4) return dLit(dBall(x, y, cx, -1.4, 1.9, 2.6), YEL, 9); }
    if (y <= 2.6 && dEll(x, y, 0, 2.6, 7, 3.2) < 1) return [hash(Math.floor(x * 3), Math.floor(y * 2), 968) > 0.85 ? '.' : ':', dCol(WHITE, dBall(x, y, 0, 2.6, 7, 3.2), 10)];
    return null;
  }),
  cottoncandy: (it, f) => sculpt(26, 18, (x, y) => { // a pink cloud on a stick, eaten from the top
    if (y > 2 && Math.abs(x) < 0.3) return ['|', C(WHITE, 13)];
    if (dBitesTop(x, y, 0.35 + f * 0.65, -8.4, 8) === true) return null;
    const blobs = [[0, -3.2, 4.6], [-3.2, -2.4, 3], [3.2, -2.6, 3], [0, -6.2, 3]];
    for (const [bx, by, r] of blobs) if (Math.hypot(x - bx, y - by) < r * (0.85 + 0.15 * noise(x * 2, y * 2, 969))) return [noise(x * 4, y * 4, 970) > 0.5 ? '@' : '%', C(MAG, 10 + noise(x * 3, y * 3, 971) * 5)];
    return null;
  }),
  corndog: (it, f) => sculpt(20, 17, (x, y) => { // golden batter on a stick, bites from the top
    if (y > 3.4 && Math.abs(x) < 0.3) return ['|', C(WARM, 12)];
    const bite = dBitesTop(x, y, f, -8, 7); if (bite === true) return null;
    if (dEll(x, y, 0, -2.4, 2.6, 5.8) < 1) return bite === 'rim' ? ['=', C(RED, 13)] : dLit(dBall(x, y, 0, -2.4, 2.6, 5.8), ORANGE, 7);
    return null;
  }),
  popcorn: (it, f) => sculpt(28, 17, (x, y) => { // a striped bucket, the heap on top going down
    const hw = 4.6 - (y + 2) * 0.12;
    if (y > -2 && y < 8 && Math.abs(x) < hw) { const t = dText(x, y, 0, 2.4, 'POPCORN'); if (t) return [t, C(WHITE, 15)]; return [Math.floor((x + 6) * 1.2) & 1 ? '|' : '#', (Math.floor((x + 6) * 1.2) & 1) ? C(WHITE, 13) : dCol(RED, 0.5 + 0.5 * dCyl(x, hw), 8)]; }
    const top = -2 - 5.5 * f;
    if (y <= -2 && y > top + Math.abs(Math.sin(x * 1.8)) * 1.2 && Math.abs(x) < 4.6) return [hash(Math.floor(x * 2), Math.floor(y), 972) > 0.5 ? 'o' : 'O', C(hash(Math.floor(x * 2), Math.floor(y), 973) > 0.8 ? YEL : WHITE, 14)];
    return null;
  }),
  fries: (it, f) => sculpt(24, 17, (x, y) => { // a red carton of fries, fewer sticking up as they go
    const hw = 3.4 + (y > 0 ? 0 : 0) - Math.max(0, y - 0.5) * 0.15;
    if (y > 0 && y < 8 && Math.abs(x) < hw) { const t = dText(x, y, 0, 3.4, 'FRIES'); if (t) return [t, C(YEL, 15)]; return dLit(0.5 + 0.5 * dCyl(x, hw), RED, 7); }
    if (y <= 0 && Math.abs(x) < 3.2) {
      const k = Math.floor((x + 3.2) / 0.9), tall = 4 + hash(k, 0, 974) * 3.4;
      if (hash(k, 1, 975) < f * 1.1 && y > -tall && fract((x + 3.2) / 0.9) > 0.25) return ['|', dCol(YEL, 0.6 + 0.4 * Math.sin(k), 11)];
    }
    return null;
  }),
  chicken: (it, f) => sculpt(30, 16, (x, y) => { // a striped bucket, drumsticks poking out, one fewer each time
    const hw = 5 - (y + 1) * 0.12;
    if (y > -1 && y < 7.5 && Math.abs(x) < hw) { const t = dText(x, y, 0, 2.4, 'CHICKEN'); if (t) return [t, C(WHITE, 15)]; return (Math.floor((x + 6) * 0.9) & 1) ? ['#', dCol(RED, 0.5 + 0.5 * dCyl(x, hw), 8)] : dLit(0.6, WHITE, 9); }
    const n = clamp(it.uses, 0, 4);
    for (let k = 0; k < n; k++) { const cx = -3.3 + k * 2.2, cy = -3 - (k & 1) * 0.8; if (dEll(x, y, cx, cy, 1.4, 2) < 1 && y < -0.8) return [noise(x * 4, y * 4, 976) > 0.5 ? '%' : '#', dCol(ORANGE, dBall(x, y, cx, cy, 1.4, 2), 8)]; }
    return null;
  }),
  croissant: (it, f) => sculpt(30, 10, (x, y) => { // a crescent, flaky bands, bites from the right
    const bite = dBites(x, y, f, 8); if (bite === true) return null;
    const outer = dEll(x, y, 0, 1, 8.6, 4.4), inner = dEll(x, y, 0, 4.2, 5, 3.4);
    if (outer > 1 || inner < 1) return null;
    if (bite === 'rim') return [':', C(YEL, 14)];
    const band = Math.abs(fract(x * 0.32 + 0.5) - 0.5) < 0.06;
    return band ? ['(', C(BRICK, 11)] : dLit(dBall(x, y, 0, 1, 8.6, 4.4), ORANGE, 7);
  }),
  donut: (it, f) => sculpt(28, 13, (x, y) => { // pink icing, sprinkles, the hole; bites from the right
    const bite = dBites(x, y, f, 7); if (bite === true) return null;
    const d = dEll(x, y, 0, 0, 7.4, 5.6);
    if (d > 1 || dEll(x, y, 0, -0.3, 2.2, 1.4) < 1) return null;
    if (bite === 'rim') return [':', C(WARM, 14)];
    const icing = y < 1.6 + Math.sin(x * 2.2) * 0.6 && d < 0.92;
    if (icing && hash(Math.floor(x * 2.5), Math.floor(y * 1.5), 977) > 0.82) return ['-', C(ITEM_COL[hash(Math.floor(x * 2.5), Math.floor(y * 1.5), 978) * 8 | 0], 15)];
    return dLit(dBall(x, y, 0, 0, 7.4, 5.6), icing ? MAG : WARM, 7);
  }),
  bagel: (it, f) => sculpt(28, 13, (x, y) => {
    const bite = dBites(x, y, f, 7); if (bite === true) return null;
    const d = dEll(x, y, 0, 0, 7.2, 5.4);
    if (d > 1 || dEll(x, y, 0, -0.2, 1.8, 1.2) < 1) return null;
    if (bite === 'rim') return [':', C(WHITE, 14)];
    if (y < 0 && hash(Math.floor(x * 2.5), Math.floor(y * 1.5), 979) > 0.88) return ['.', C(WHITE, 15)]; // sesame
    return dLit(dBall(x, y, 0, 0, 7.2, 5.4), WARM, 6);
  }),
  sandwich: (it, f) => sculpt(30, 11, (x, y) => { // bread, lettuce, tomato, cheese, bread
    const bite = dBites(x, y, f, 7.6); if (bite === true) return null;
    if (Math.abs(x) > 7.8) return null;
    if (y < -1.8 && y > -4.6 + Math.pow(x / 7.8, 2) * 1.2) return dLit(0.4 + 0.55 * (1 - (y + 4.6) / 3), WARM, 8);
    if (y >= -1.8 && y < -0.9 - Math.abs(Math.sin(x * 2.4)) * 0.3) return ['%', C(GREEN, 13)];
    if (y >= -0.9 && y < 0.2) return ['=', C(RED, 13)];
    if (y >= 0.2 && y < 1.1) return ['~', C(YEL, 15)];
    if (y >= 1.1 && y < 3.6) return dLit(0.75 - (y - 1.1) * 0.15, WARM, 7);
    return null;
  }),
  chips: (it, f) => sculpt(26, 17, (x, y) => { // a crinkly bag, CHIPS on it, chips poking out of the top
    const n = Math.ceil(f * 4);
    for (let k = 0; k < n; k++) { const cx = -2.4 + k * 1.6, cy = -6.4 - (k & 1) * 0.7; if (dEll(x, y, cx, cy, 1, 0.8) < 1) return [dEll(x, y, cx, cy, 1, 0.8) > 0.7 ? 'o' : '~', C(YEL, 15)]; }
    if (y < -6 || y > 7.4 || Math.abs(x) > 4.4 - (y < -5.2 ? 0 : 0)) return null;
    if (y < -5.2 || y > 6.6) return [(Math.floor(x / 0.6) & 1) ? '^' : 'v', C(RED, 12)];
    const t = dText(x, y, 0, -1, 'CHIPS'); if (t) return [t, C(YEL, 15)];
    if (dEll(x, y, 0, 2.6, 2, 1.6) < 1) return ['@', C(YEL, 14)];
    return dLit(0.4 + 0.5 * dCyl(x, 4.4) + Math.sin(y * 3) * 0.08, RED, 7);
  }),
  burger: (it, f) => sculpt(30, 12, (x, y) => { // sesame bun, lettuce, cheese, patty, bun
    const bite = dBites(x, y, f, 7.4); if (bite === true) return null;
    const top = dEll(x, y, 0, -1.4, 7.6, 4.2);
    if (y < -1.4 && top < 1) return hash(Math.floor(x * 2.4), Math.floor(y * 1.6), 980) > 0.86 ? ['.', C(WHITE, 15)] : dLit(dBall(x, y, 0, -1.4, 7.6, 4.2), ORANGE, 7);
    if (Math.abs(x) > 7.9) return null;
    if (y >= -1.4 && y < -0.5 - Math.abs(Math.sin(x * 2.2)) * 0.3) return ['%', C(GREEN, 13)];
    if (y >= -0.5 && y < 0.3 || y >= 0.3 && y < 0.9 && Math.abs(fract(x * 0.4) - 0.5) < 0.12) return ['~', C(YEL, 15)];
    if (y >= 0.3 && y < 2.2) return dLit(0.5 + Math.sin(x * 5) * 0.1, BRICK, 6);
    if (y >= 2.2 && y < 4.4 - Math.pow(x / 7.9, 2) * 1.2) return dLit(0.7 - (y - 2.2) * 0.15, ORANGE, 7);
    return null;
  }),
  kebab: (it, f) => sculpt(24, 16, (x, y) => { // a wrap in paper, meat and salad at the top, eaten down
    const hw = 3.8 - Math.max(0, y - 1) * 0.35;
    if (y > 0.4 && y < 7.6 && Math.abs(x) < hw) return dLit(0.55 + 0.4 * dCyl(x, hw), WHITE, 8);
    const bite = dBitesTop(x, y, 0.3 + f * 0.7, -7.4, 7); if (bite === true) return null;
    if (y <= 0.4 && y > -7.4 && Math.abs(x) < 3.6) {
      if (Math.abs(x) > 3) return ['(', C(WARM, 12)];
      const n = hash(Math.floor(x * 2), Math.floor(y * 1.5), 981);
      return n > 0.65 ? ['%', C(GREEN, 13)] : n > 0.5 ? ['o', C(RED, 13)] : ['#', C(BRICK, 11 + n * 2)];
    }
    return null;
  }),
  sushi: it => sculpt(32, 9, (x, y) => { // nigiri on a board, one fewer each time
    if (y > 1.8 && y < 3.4 && Math.abs(x) < 9) return ['=', dCol(BRICK, 0.7 - Math.abs(x) * 0.03, 9)];
    if (y > 3.4 && y < 4.4 && (Math.abs(x - 6) < 0.8 || Math.abs(x + 6) < 0.8)) return ['#', C(BRICK, 9)];
    const p = dPieces(x, clamp(it.uses, 0, 4), -8.4, 4.2);
    if (!p) return null;
    const [k, dx] = p;
    if (y > -0.6 && y <= 1.8 && Math.abs(dx) < 1.8) return dLit(0.65 + 0.3 * dCyl(dx, 1.8), WHITE, 9);
    if (y > -2.4 && y <= -0.6 && Math.abs(dx) < 2 - (y < -1.8 ? 0.4 : 0)) return [(Math.floor((dx + y) * 2) & 1) ? '=' : '#', (Math.floor((dx + y) * 2) & 1) ? C(WHITE, 14) : C(k & 1 ? RED : ORANGE, 14)];
    return null;
  }),
  vhs: () => sculpt(30, 10, (x, y) => { // a black cassette, two reels behind its window, a label
    if (Math.abs(x) > 8.4 || Math.abs(y) > 4.2) return null;
    const t = dText(x, y, 0, -2.8, 'MOVIE NITE'); if (t) return [t, C(GRAY, 6)];
    if (y < -2 && Math.abs(x) < 6) return ['=', C(WHITE, 13)];
    for (const cx of [-3, 3]) { const d = dEll(x, y, cx, 0.8, 1.6, 1.6); if (d < 1) return [d < 0.4 ? 'o' : '*', C(WHITE, d < 0.4 ? 14 : 10)]; }
    if (y > -0.8 && y < 2.4 && Math.abs(x) < 4.8) return [':', C(GRAY, 5)];
    return dLit(0.3 + 0.2 * (x < -8 || y < -4 ? 1 : 0), GRAY, 3, 8);
  }),
  dumplings: it => sculpt(30, 12, (x, y) => { // a bamboo steamer, dumplings two by two, one fewer each time
    if (y > 1.6 && y < 4.6 && Math.abs(x) < 8.4) return [Math.abs(y - 3.1) < 0.4 ? '=' : '#', dCol(WARM, 0.7 - Math.abs(x) * 0.04 - (Math.abs(y - 3.1) < 0.4 ? 0.2 : 0), 8)];
    const n = clamp(it.uses, 0, 4), spots = [[-4.6, -0.4], [-1.5, -0.4], [1.6, -0.4], [4.7, -0.4]].slice(0, n);
    for (const [cx, cy] of spots) { const d = dEll(x, y, cx, cy, 1.8, 2); if (d < 1 && y < 1.6) return y < cy - 1.4 && Math.abs(x - cx) < 0.4 ? ['^', C(WHITE, 11)] : dLit(dBall(x, y, cx, cy, 1.8, 2), WHITE, 9); }
    return null;
  }),
  mooncake: (it, f) => sculpt(26, 12, (x, y) => { // fluted edge, a pattern pressed in the top
    const bite = dBites(x, y, f, 6.4); if (bite === true) return null;
    const a = Math.atan2(y, x / 1.1), r = Math.hypot(x / 1.1, y), R = 5.4 * (1 + 0.05 * Math.cos(a * 12));
    if (r > R) return null;
    if (bite === 'rim') return [':', C(YEL, 15)];
    if (r < 2.4 && Math.abs(r - 1.8) < 0.3 || r < 0.8) return ['*', C(YEL, 15)];
    if (Math.abs(r - 3.6) < 0.25) return ['o', C(BRICK, 11)];
    return dLit(dSphere(x / 1.1, y, R), ORANGE, 7);
  }),
  ginseng: (it, f) => sculpt(22, 17, (x, y) => { // a forked root, leaves at the top
    const bite = dBitesR(x, y, 0.4 + f * 0.6, 3, 1.4, 1.6, 2); if (bite === true) return null;
    if (y < -4 && Math.abs(x - Math.sin(y) * 0.6) < 2.2 - (y + 8) * -0.1 && y > -8 && noise(x * 3, y * 3, 982) > 0.35) return ['%', C(GREEN, 13)];
    const main = Math.abs(x) < 1.5 - (y + 4) * 0.04 && y > -4 && y < 3;
    const legs = y >= 2 && y < 8 && (Math.abs(x + (y - 2) * 0.45) < 0.8 || Math.abs(x - (y - 2) * 0.5) < 0.7);
    if (main || legs) return bite === 'rim' ? [':', C(WHITE, 14)] : [Math.abs(fract(y * 1.1) - 0.5) < 0.1 ? '-' : dFill(0.6 - x * 0.08), dCol(WARM, 0.75 - x * 0.08, 8)];
    return null;
  }),
  candy: (it, f) => sculpt(30, 7, (x, y) => { // a wrapped bar: the wrapper peeled back as it's eaten, chocolate showing
    if (Math.abs(y) > 2.6 || x < -8.4) return null;
    const left = 8.6 - (1 - f) * 6, wrapEnd = left - 4.2;
    if (x > left + Math.sin(y * 3) * 0.3) return null; // bitten off
    if (x > wrapEnd) return [(Math.floor(x * 1.6) & 1) ? '#' : '=', dCol(BRICK, 0.7 - Math.abs(y) * 0.12, 7)];
    if (x > wrapEnd - 0.6) return ['>', C(MAG, 12)];
    const t = dText(x, y, -2.6, 0, 'CANDY'); if (t) return [t, C(WHITE, 15)];
    return dLit(0.75 - (y + 2.6) * 0.1, MAG, 7);
  }),
  // ---- things
  cigarettes: it => sculpt(22, 16, (x, y) => { // the pack, as many sticking out as are left
    const n = Math.max(0, it.uses);
    if (y < -3 && y > -7 && Math.abs(x) < 2.6) { const k = Math.floor((x + 2.6) / 1.05); if (k < n && fract((x + 2.6) / 1.05) > 0.3) return y < -6.2 + k * 0.2 ? ['#', C(ORANGE, 13)] : ['|', C(WHITE, 15)]; }
    if (y < -3 || y > 7.4 || Math.abs(x) > 3.6) return null;
    const t = dText(x, y, 0, -0.6, 'SMOKES'); if (t) return [t, C(WHITE, 15)];
    if (y < 1 && y > -2) return dLit(0.6 + 0.3 * dCyl(x, 3.6), RED, 7);
    return dLit(0.55 + 0.4 * dCyl(x, 3.6), WHITE, 8);
  }),
  book: () => sculpt(28, 15, (x, y) => { // a hardback: blue cover, pages along the edge, a title
    if (x > 6.6 && x < 7.4 && y > -5.6 && y < 6.6) return ['|', C(WHITE, 13)];
    if (y > 6 && y < 6.8 && x > -5.6 && x < 7.4) return ['_', C(WHITE, 13)];
    if (x < -6.6 || x > 6.6 || y < -6.6 || y > 6) return null;
    if (x < -5.6) return ['|', C(BLUE, 8)];
    const t = dText(x, y, 0.4, -2.6, 'NOVEL'); if (t) return [t, C(YEL, 15)];
    if (Math.abs(y - 1) < 0.4 && Math.abs(x - 0.4) < 3) return ['~', C(YEL, 12)];
    return dLit(0.75 - (y + 6.6) * 0.04 - (x + 5.6) * 0.02, BLUE, 6);
  }),
  newspaper: () => sculpt(30, 14, (x, y) => { // folded: the masthead, a headline, a photo, columns
    if (Math.abs(x) > 8.4 || Math.abs(y) > 6.4) return null;
    const t = dText(x, y, 0, -5, 'THE DAILY'); if (t) return [t, C(GRAY, 3)];
    if (Math.abs(y + 3.8) < 0.3) return ['=', C(GRAY, 6)];
    if (y > -3 && y < 1 && x < -1.4 && x > -7.6) return [noise(x * 2, y * 2, 983) > 0.5 ? '#' : '+', C(GRAY, 6 + noise(x * 3, y * 3, 984) * 4)];
    if (fract(y) < 0.4 && (x > -0.6 || y > 1.4) && hash(Math.floor(x * 2), Math.floor(y), 985) > 0.2 && Math.abs(fract(x * 0.3) - 0.5) < 0.42) return ['-', C(GRAY, 7)];
    return dLit(0.85 - Math.abs(x) * 0.02, WHITE, 11, 15);
  }),
  vinyl: () => sculpt(30, 15, (x, y) => { // the record sliding out of its sleeve
    const d = Math.hypot(x - 2.6, (y + 1.4) * 1.05);
    if (d < 6.2 && (x > 3 || y < -5.4)) { if (d < 0.4) return ['o', C(WHITE, 15)]; if (d < 1.8) return ['@', C(RED, 13)]; return [Math.abs(fract(d * 1.2) - 0.5) < 0.12 ? ':' : '#', C(GRAY, d > 5.6 ? 8 : 4)]; }
    if (Math.abs(x + 0.6) > 6.4 || y < -5.4 || y > 6.6) return null;
    const t = dText(x, y, -0.6, 3.6, 'GREATEST HITS'); if (t) return [t, C(WHITE, 15)];
    if (dEll(x, y, -0.6, -0.6, 3, 3) < 1) return dLit(dBall(x, y, -0.6, -0.6, 3), YEL, 9);
    return dLit(0.7 - (y + 5.4) * 0.03, MAG, 7);
  }),
  flowers: () => sculpt(28, 17, (x, y) => { // a bouquet in brown paper
    const heads = [[-3, -5.4, RED], [0, -6.4, YEL], [3, -5.4, MAG], [-1.6, -3.4, WHITE], [1.6, -3.4, ORANGE], [-4.2, -2.4, MAG], [4.2, -2.4, RED]];
    for (const [cx, cy, col] of heads) { const d = dEll(x, y, cx, cy, 1.4, 1.3); if (d < 1) return [d < 0.35 ? '@' : '*', d < 0.35 ? C(YEL, 15) : dCol(col, dBall(x, y, cx, cy, 1.4, 1.3), 9)]; }
    if (y > -2 && y < 2 && Math.abs(x) < 3.5 - (y + 2) * 0.4 && fract(x * 1.1) < 0.35) return ['|', C(GREEN, 13)];
    if (y > 0.4 && y < 8 && Math.abs(x) < 4.2 - (y - 0.4) * 0.38) return [fract(x * 0.5 - y * 0.3) < 0.1 ? '\\' : dFill(0.6), dCol(BRICK, 0.7 - Math.abs(x) * 0.06, 8)];
    return null;
  }),
  ball: () => sculpt(24, 12, (x, y) => { // a football: white, black patches
    const b = dBall(x, y, 0, 0, 5.6);
    if (b < 0) return null;
    const ax = x / 5.6, ay = y / 5.6, az = Math.sqrt(Math.max(0, 1 - ax * ax - ay * ay));
    const patch = [[0, 0, 1], [0.8, -0.5, 0.35], [-0.8, -0.5, 0.35], [0, 0.9, 0.4], [0.6, 0.7, 0.4], [-0.6, 0.7, 0.4], [0, -0.95, 0.3]].some(([px, py, pz]) => { const l = Math.hypot(px, py, pz); return (ax * px + ay * py + az * pz) / l > 0.93; });
    return patch ? ['#', C(GRAY, 2 + b * 3)] : dLit(b, WHITE, 7);
  }),
  boombox: () => sculpt(32, 13, (x, y) => { // two speakers, a tape deck, a handle, an aerial
    if (Math.abs(x - 6 - (y + 6) * 0.6) < 0.2 && y < -2.8 && y > -6.4) return ['/', C(GRAY, 13)];
    if (y < -2.6 && y > -4.2 && Math.abs(x) < 5 && (Math.abs(x) > 4.4 || y < -3.6)) return ['=', C(GRAY, 12)];
    if (Math.abs(x) > 9 || y < -2.6 || y > 5.8) return null;
    for (const cx of [-5.6, 5.6]) { const d = dEll(x, y, cx, 1.8, 2.8, 2.8); if (d < 1) return [d < 0.3 ? 'O' : Math.abs(fract(d * 3) - 0.5) < 0.15 ? 'o' : ':', C(GRAY, d < 0.3 ? 14 : 6 + d * 4)]; }
    if (Math.abs(x) < 2.2 && y > -1.4 && y < 1.8) return y < -0.6 ? ['=', C(CYAN, 14)] : dEll(x, y, -0.9, 0.6, 0.5, 0.5) < 1 || dEll(x, y, 0.9, 0.6, 0.5, 0.5) < 1 ? ['o', C(WHITE, 14)] : [':', C(GRAY, 6)];
    if (Math.abs(x) < 2.2 && y > 3 && y < 4) return ['#', C(RED, 13)];
    return dLit(0.6 - (y + 2.6) * 0.05, GRAY, 6, 12);
  }),
  skateboard: () => sculpt(16, 17, (x, y) => { // held up on end: the deck's graphic, trucks and wheels
    for (const ty of [-5.2, 5.2]) {
      if (Math.abs(y - ty) < 0.3 && Math.abs(x) < 2.4) return ['=', C(GRAY, 13)];
      if (Math.abs(y - ty) < 0.8 && Math.abs(Math.abs(x) - 2.8) < 0.5) return ['O', C(WHITE, 15)];
    }
    if (dEll(x, y, 0, 0, 2.2, 8.2) > 1) return null;
    const stripe = Math.floor((y + 8) * 0.6) & 1;
    return dLit(0.55 + 0.4 * dCyl(x, 2.2), stripe ? RED : YEL, 7);
  }),
  yoyo: () => sculpt(18, 15, (x, y) => { // the yo-yo in your hand, its string looped round your finger below
    if (y > 2.5 && Math.abs(x) < 0.15) return ['|', C(WHITE, 11)];
    const d = dEll(x, y, 0, -2.4, 3.6, 3.6);
    if (d > 1) return null;
    if (d < 0.25) return ['@', C(WHITE, 15)];
    return [Math.abs(d - 0.6) < 0.06 ? 'o' : dFill(dBall(x, y, 0, -2.4, 3.6)), dCol(RED, dBall(x, y, 0, -2.4, 3.6), 7)];
  }),
  vape: () => sculpt(12, 17, (x, y) => { // a mango vape pen; the tip glows when you draw on it
    if (y < -7 && Math.abs(x) < 0.9) return fx.vape > 0 ? ['@', C(ORANGE, 10 + fx.vape * 1.7)] : ['o', C(GRAY, 10)];
    if (Math.abs(x) > 1.6 || y < -7 || y > 8) return null;
    const k = Math.floor((y + 4) / 1.4), word = 'MANGO';
    if (Math.abs(x) < 0.4 && k >= 0 && k < 5 && Math.abs(fract((y + 4) / 1.4) - 0.5) < 0.36) return [word[k], C(YEL, 15)];
    return dLit(0.5 + 0.45 * dCyl(x, 1.6), ORANGE, 7);
  }),
  pipe: () => sculpt(28, 10, (x, y) => { // a briar pipe: the bowl, the stem off to the right
    const hw = 2.2 - Math.max(0, y - 1) * 0.5;
    if (x < 1.2 && x > -3.6 && y > -3.4 && y < 3.6 && Math.abs(x + 1.2) < hw) return y < -2.8 ? ['=', C(BRICK, 8)] : dLit(0.5 + 0.45 * dCyl(x + 1.2, hw), BRICK, 6);
    if (y > 1.4 && y < 2.6 - (x - 1) * 0.08 && x >= 0.6 && x < 8) return ['=', dCol(BRICK, 0.6 - (y - 1.4) * 0.3, 5)];
    return null;
  }),
  harmonica: () => sculpt(32, 7, (x, y) => { // chrome covers, a row of holes
    if (Math.abs(x) > 9 || Math.abs(y) > 2.6) return null;
    if (Math.abs(y) < 0.7) return Math.abs(fract(x * 0.7) - 0.5) < 0.22 ? ['o', C(GRAY, 4)] : ['|', C(BRICK, 11)];
    return dLit(0.6 + 0.35 * (y < 0 ? 1 - Math.abs(y + 1.6) / 1 : -0.3) - Math.abs(x) * 0.02, WHITE, 6);
  }),
  sharkplush: () => sculpt(32, 11, (x, y) => { // a grey shark, white belly, fin and tail, a stitched eye
    if (y < -1 && y > -5 && x > -1 && x < 2.4 - (y + 5) * 0.2 && x > -1 + (y + 5) * 0.6 - 2.4) return ['#', C(GRAY, 9)];
    const tail = x > 6.4 && x < 9.4 && Math.abs(y) < (x - 6.4) * 0.9;
    const body = dEll(x, y, -0.6, 0.6, 7.6, 2.8);
    if (body < 1 || tail) {
      if (dEll(x, y, -5.4, -0.2, 0.4, 0.4) < 1) return ['o', C(GRAY, 2)];
      if (y > 1.2 && x < 5 && !tail) return dLit(0.8, WHITE, 11);
      return dLit(tail ? 0.6 : dBall(x, y, -0.6, 0.6, 7.6, 2.8), GRAY, 7, 13);
    }
    return null;
  }),
  snowglobe: () => sculpt(24, 15, (x, y) => { // a glass globe: snow drifting down round a little fish, a wooden base
    if (y > 4.4 && y < 7 && Math.abs(x) < 4.6 - (y - 4.4) * -0.3) return dLit(0.6 - (y - 4.4) * 0.1, BRICK, 7);
    const d = dEll(x, y, 0, -1.2, 5.4, 5.4);
    if (d > 1 || y > 4.4) return null;
    if (d > 0.92) return ['|', C(WHITE, 12)];
    if (dEll(x, y, 0, 0.6, 1.6, 0.8) < 1) return [x < -1 ? '<' : x > 1.2 ? '>' : 'o', C(ORANGE, 15)];
    const fl = hash(Math.floor(x * 1.8), Math.floor(y + T * 1.5), 986) > 0.88;
    return fl ? ['*', C(WHITE, 15)] : Math.abs(x + 2.6) < 0.3 && y < -3 ? [':', C(WHITE, 9)] : [' ', 0];
  }),
  spraypaint: it => sculpt(20, 16, (x, y) => { // a spray can, its colour the one in it, the nozzle on top
    const col = [MAG, CYAN, GREEN, ORANGE][it.uses & 3], hw = 3;
    if (y < -6 && Math.abs(x) < 0.9) return y < -7 ? ['o', C(WHITE, 14)] : ['#', C(GRAY, 13)];
    if (y >= -6 && y < -4.6 && Math.abs(x) < hw - (y < -5.4 ? 1 : 0)) return dLit(0.5 + 0.4 * dCyl(x, hw), GRAY, 8);
    if (y < -4.6 || y > 7.4 || Math.abs(x) > hw) return null;
    const t = dText(x, y, 0, 0.6, 'ZAP'); if (t) return [t, C(WHITE, 15)];
    return [dCyl(x, hw) > 0.92 ? '|' : dFill(dCyl(x, hw)), dCyl(x, hw) > 0.92 ? C(WHITE, 15) : dCol(col, dCyl(x, hw))];
  }),
  plushcat: () => sculpt(26, 14, (x, y) => { // a lucky cat, one paw up and waving
    const wave = Math.sin(T * 4) * 0.5;
    if (dEll(x, y, 4.6 + wave * 0.4, -3 + wave, 1.2, 1.6) < 1) return dLit(0.8, WHITE, 11);
    for (const s of [-1, 1]) if (y > -6.4 && y < -3.6 && Math.abs(x - s * 2.4) < 1.2 - (y + 6.4) * -0.1 && Math.abs(x - s * 2.4) < (y + 6.4) * 0.5) return ['^', C(s > 0 ? WHITE : WHITE, 13)];
    const head = dEll(x, y, 0, -2.4, 3.8, 3);
    if (head < 1) {
      for (const s of [-1, 1]) if (dEll(x, y, s * 1.4, -2.8, 0.5, 0.5) < 1) return ['o', C(GREEN, 15)];
      if (dEll(x, y, 0, -1.6, 0.4, 0.3) < 1) return ['v', C(MAG, 15)];
      return dLit(dBall(x, y, 0, -2.4, 3.8, 3), WHITE, 9);
    }
    if (dEll(x, y, 0, 3, 4.2, 3.6) < 1) return Math.abs(y - 0.8) < 0.35 && Math.abs(x) < 3.6 ? ['=', C(RED, 14)] : dLit(dBall(x, y, 0, 3, 4.2, 3.6), WHITE, 9);
    return null;
  }),
  plushbear: () => sculpt(26, 15, (x, y) => { // a brown teddy, sitting
    for (const s of [-1, 1]) if (dEll(x, y, s * 2.8, -5.4, 1.2, 1.2) < 1) return dLit(0.6, BRICK, 8);
    const head = dEll(x, y, 0, -2.8, 3.4, 2.8);
    if (head < 1) {
      for (const s of [-1, 1]) if (dEll(x, y, s * 1.3, -3.2, 0.4, 0.4) < 1) return ['o', C(GRAY, 2)];
      if (dEll(x, y, 0, -1.8, 1.2, 0.9) < 1) return [dEll(x, y, 0, -2, 0.4, 0.3) < 1 ? '@' : '%', C(WARM, 12)];
      return dLit(dBall(x, y, 0, -2.8, 3.4, 2.8), BRICK, 7);
    }
    for (const s of [-1, 1]) if (dEll(x, y, s * 3.6, 1.6, 1.2, 2) < 1) return dLit(0.55, BRICK, 7);
    if (dEll(x, y, 0, 3, 3.6, 3.6) < 1) return dLit(dBall(x, y, 0, 3, 3.6), BRICK, 7);
    return null;
  }),
  yakitori: (it, f) => sculpt(26, 16, (x, y) => { // chunks of chicken on a skewer, glazed; one fewer each time
    { const s = dStraw(x, y, 3.3, -7.6, -1.9, 7.6, C(WARM, 12)); if (s) return [s[0], C(WARM, 12)]; } // the skewer
    const n = Math.ceil(f * 3);
    for (let k = 0; k < n; k++) { const cy = 3.6 - k * 3.2, cx = 3.3 - (cy + 7.6) * 5.2 / 15.2, // (on the skewer)
      d = dEll(x, y, cx, cy, 2.4, 1.5); if (d < 1) return [noise(x * 3, y * 3, 987) > 0.6 ? '%' : '#', dCol(BRICK, dBall(x, y, cx, cy, 2.4, 1.5), 7)]; }
    return null;
  }),
  takoyaki: it => sculpt(30, 11, (x, y) => { // a paper boat of takoyaki, sauce and flakes on top, one fewer each time
    if (y > 1.2 && y < 4.2 && Math.abs(x) < 8.4 - (y - 1.2) * 0.9) return dLit(0.65 - (y - 1.2) * 0.1, WARM, 8);
    const n = clamp(it.uses, 0, 4);
    for (let k = 0; k < n; k++) { const cx = -5.1 + k * 3.4, cy = 0, d = dEll(x, y, cx, cy, 1.7, 1.7); if (d < 1) {
      if (Math.abs(y + 0.5 + Math.sin((x - cx) * 2.5) * 0.25) < 0.25) return ['~', C(BRICK, 12)]; // the sauce
      if (y < -0.9 && hash(Math.floor(x * 3), Math.floor(y * 2), 988) > 0.7) return ['\'', C(WARM, 14)]; // bonito flakes
      return dLit(dBall(x, y, cx, cy, 1.7), ORANGE, 7);
    } }
    return null;
  }),
  onigiri: (it, f) => sculpt(26, 14, (x, y) => { // a rice triangle, a band of nori, a pickled plum peeking out
    const bite = dBitesTop(x, y, 0.35 + f * 0.65, -6.4, 7); if (bite === true) return null;
    if (y < -6.4 || y > 6 || Math.abs(x) > (y + 6.4) * 0.68) return null;
    if (y > 2.4 && Math.abs(x) < 3) return ['#', C(GREEN, 4)];
    if (bite === 'rim' && Math.abs(x) < 1.2) return ['@', C(RED, 13)];
    return [hash(Math.floor(x * 2.5), Math.floor(y * 1.5), 989) > 0.8 ? '.' : dFill(0.7 - y * 0.03 - x * 0.03), dCol(WHITE, 0.85 - (y + 6.4) * 0.03, 10)];
  }),
  bento: (it, f) => sculpt(30, 11, (x, y) => { // a box in four compartments, each emptied in turn
    if (Math.abs(x) > 8.4 || Math.abs(y) > 4.4) return null;
    if (Math.abs(x) > 7.8 || Math.abs(y) > 3.8 || Math.abs(x + 2) < 0.3 || Math.abs(x - 3) < 0.3 && y > -3.8 || Math.abs(y) < 0.3 && x > -2) return ['#', C(BRICK, 9)];
    const left = Math.ceil(f * 4), cell = x < -2 ? 0 : y < 0 ? (x < 3 ? 1 : 2) : 3;
    if (cell >= left) return [':', C(BRICK, 4)]; // eaten: the bare box
    if (cell === 0) return [hash(Math.floor(x * 3), Math.floor(y * 2), 990) > 0.9 ? '.' : '@', C(WHITE, 15)]; // rice, sesame
    if (cell === 1) return dEll(x, y, 0.5, -2, 1.2, 1) < 1 ? ['@', C(RED, 13)] : ['o', C(RED, 11)]; // sausages
    if (cell === 2) return ['%', C(GREEN, 13)]; // greens
    return ['=', C(YEL, 14)]; // tamagoyaki
  }),
  duck: () => sculpt(24, 12, (x, y) => { // a rubber duck
    if (dEll(x, y, -4.4, -1.6, 1.4, 0.7) < 1) return ['>', C(ORANGE, 15)];
    const head = dEll(x, y, -1.6, -2.4, 2.4, 2.2);
    if (head < 1) return dEll(x, y, -2.4, -3, 0.4, 0.4) < 1 ? ['o', C(GRAY, 2)] : dLit(dBall(x, y, -1.6, -2.4, 2.4, 2.2), YEL, 9);
    if (dEll(x, y, 0.8, 1.8, 5.2, 2.8) < 1) return dLit(dBall(x, y, 0.8, 1.8, 5.2, 2.8), YEL, 9);
    if (x > 4 && x < 6.6 && y < 1 && y > -1.6 + (6.6 - x) * 0.3) return dLit(0.7, YEL, 9); // the tail
    return null;
  }),
  jadebangle: () => sculpt(24, 11, (x, y) => { // a jade bangle, seen at a tilt: a ring, light running round it
    const d = dEll(x, y, 0, 0, 5.2, 4.2), inner = dEll(x, y, 0, 0, 3.7, 2.8);
    if (d > 1 || inner < 1) return null;
    const a = Math.atan2(y, x), b = 0.45 + 0.4 * Math.cos(a + 2.3) + (noise(x * 2, y * 2, 1311) - 0.5) * 0.3; // (veins in the stone)
    return [b > 0.85 ? '@' : dFill(b), C(b > 0.85 ? WHITE : GREEN, 6 + clamp(b, 0, 1) * 9)];
  }),
  jadedragon: () => sculpt(26, 14, (x, y) => { // a little carved jade dragon on a wooden stand
    if (y > 4.6 && y < 6.4 && Math.abs(x) < 5.2 - (y - 4.6) * -0.4) return dLit(0.7 - (y - 4.6) * 0.2, BRICK, 7);
    if (dEll(x, y, 2.6, -3.6, 0.35, 0.35) < 1) return ['@', C(RED, 15)]; // its eye
    if (y < -2 && y > -4.8 && Math.abs(x - 3.2) < 1.8 + (y + 2) * 0.2) return dLit(dBall(x, y, 3, -3.4, 2, 1.5), GREEN, 8); // the head
    if (Math.abs(y + 3.3) < 0.25 && x > 4.6 && x < 6.6) return ['~', C(GREEN, 12)]; // whiskers
    const path = [[-6.4, 1.2], [-4.8, 3], [-2.8, 0.8], [-0.8, 3], [1, 0.6], [2.2, -2.2]]; // the body, coiling from the tail up to the head
    let dmin = 9, along = 0;
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, ay] = path[k], [bx, by] = path[k + 1], t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1), dd = Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
      if (dd < dmin) { dmin = dd; along = k + t; }
    }
    const thick = 0.35 + Math.min(1, along / 1.5) * 0.75; // thin at the tail
    if (dmin < thick) return [dmin < thick * 0.3 && Math.floor(along * 4) & 1 ? '=' : dFill(0.5 + 0.45 * (1 - dmin / thick) - (y > 1 ? 0.1 : 0)), dCol(GREEN, 0.5 + 0.45 * (1 - dmin / thick), 7)];
    return null;
  }),
  // the wire, its top two thirds coated silver; lit, it burns down from the tip, leaving grey ash (#) above the fizz
  sparklers: () => { const front = sparkBurn() * 9 - 7; return sculpt(10, 15, (x, y) => Math.abs(x) >= 0.2 ? null : y < front ? ['#', C(GRAY, 6)] : y < 2 ? ['=', C(WHITE, 13)] : ['|', C(GRAY, 12)]); },
  umbrella: () => sculpt(16, 19, (x, y) => { // furled, a strap round it, the hooked handle
    if (y > 5 && Math.abs(x) < 0.2) return ['|', C(BRICK, 12)];
    if (y > 8 && dEll(x, y, 1, 8.4, 1.2, 1) < 1 && dEll(x, y, 1, 8.4, 0.6, 0.4) > 1 && y > 8.4) return ['J', C(BRICK, 12)];
    if (y < -8.6 && Math.abs(x) < 0.15) return ['|', C(GRAY, 14)];
    const hw = (y + 8.6) / 13.6 * 2.2 * (y > 2 ? (5 - y) / 3 : 1);
    if (y >= -8.6 && y <= 5 && Math.abs(x) < Math.max(0.2, hw)) return Math.abs(y + 1) < 0.4 ? ['=', C(WHITE, 14)] : [Math.abs(fract(x * 1.5 + y * 0.2) - 0.5) < 0.1 ? '/' : dFill(0.6 + 0.35 * dCyl(x, Math.max(0.2, hw))), dCol(BLUE, 0.6 + 0.35 * dCyl(x, Math.max(0.2, hw)), 7)];
    return null;
  }),
});
