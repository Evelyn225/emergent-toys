// ===== held items, the dense way (a trial: ?items=dense). Drawn at a little over the world's own character size
// with twice the detail: each picture is sculpted cell by cell from a shape, shaded through a ramp of characters
// with a light from the top left, like an ASCII-art image, instead of being outlined in big letters.
const DENSE_ON = typeof location !== 'undefined' && /[?&]items=dense\b/.test(location.search);
const D_RAMP = ' .:-=+*#%@', D_ASPECT = 0.6; // a character is about 0.6 as wide as it is tall
const dRamp = b => D_RAMP[clamp(Math.round(b * (D_RAMP.length - 1)), 1, D_RAMP.length - 1)];
const D_FILL = '=+*#%@', dFill = b => D_FILL[clamp(Math.round(b * (D_FILL.length - 1)), 0, D_FILL.length - 1)]; // solid: light shows in the colour
// a picture W x H cells: fn(x, y) for each cell's centre (in row heights from the middle, so circles come out round)
// gives null (nothing there) or [character, colour]. Returns [lines, colour of cell (ch, row, col)]
function sculpt(W, H, fn) {
  const cells = [];
  for (let r = 0; r < H; r++) { const row = []; for (let k = 0; k < W; k++) row.push(fn((k + 0.5 - W / 2) * D_ASPECT, r + 0.5 - H / 2) || null); cells.push(row); }
  return [cells.map(row => row.map(c => c ? c[0] : ' ').join('')), (ch, r, k) => cells[r][k] ? cells[r][k][1] : 0];
}
// light on a surface with normal (nx, ny up-is-negative, nz toward you): from the top left, a little in front
const dLight = (nx, ny, nz) => clamp(0.15 + 0.85 * Math.max(0, -0.45 * nx - 0.55 * ny + 0.7 * nz), 0, 1);
const dSphere = (x, y, R) => { const nx = x / R, ny = y / R, q = 1 - nx * nx - ny * ny; return q < 0 ? -1 : dLight(nx, ny, Math.sqrt(q)); };
const dCyl = (x, hw) => { const nx = x / hw; return Math.abs(nx) > 1 ? -1 : dLight(nx, -0.15, Math.sqrt(1 - nx * nx)); };
// bites out of the right-hand side, more the less there's left: true inside a bite, 'rim' just inside its edge
function dBites(x, y, f, R, n = 3) {
  const gone = Math.round((1 - f) * n);
  for (let k = 0; k < gone; k++) { const bx = R * 1.05, by = (k - 1) * R * 0.7, d = Math.hypot(x - bx, y - by) - R * 0.5; if (d < 0) return true; }
  for (let k = 0; k < gone; k++) { const bx = R * 1.05, by = (k - 1) * R * 0.7; if (Math.hypot(x - bx, y - by) - R * 0.5 < 0.7) return 'rim'; }
  return false;
}
const DENSE = {
  apple: (it, f) => sculpt(26, 13, (x, y) => {
    const R = 5.2;
    if (Math.abs(x - 0.25 - (y + R) * -0.18) < 0.28 && y < -R * 0.65 && y > -R * 1.2) return ['|', C(BRICK, 11)]; // the stem
    const lx = x - 1.5, ly = y + R * 1.02, lu = lx * 0.8 + ly * 0.6, lv = -lx * 0.6 + ly * 0.8; // the leaf, tilted
    if ((lu / 1.5) ** 2 + (lv / 0.55) ** 2 < 1) return [lv < 0 ? '~' : '-', C(GREEN, 9 + (lv < 0 ? 4 : 1))];
    const dimple = Math.max(0, 1 - Math.abs(x) / 1.4) * 0.9 * (y < 0 ? 1 : 0.25), r = R * (1 + 0.04 * Math.sign(y)) - dimple;
    if (Math.hypot(x / 1.08, y) > r) return null;
    const bite = dBites(x, y, f, R);
    if (bite === true) return null;
    if (bite === 'rim') return [':', C(WARM, 14)]; // white flesh where it's been bitten
    const b = dSphere(x / 1.08, y, R), spec = Math.hypot(x / 1.08 + R * 0.38, y + R * 0.42) < 0.75; // a glint, top left
    return [spec ? '@' : dFill(b), spec ? C(WHITE, 15) : C(RED, 6 + b * 9)];
  }),
  coffee: (it, f) => sculpt(30, 17, (x, y) => {
    const top = -4.6, bot = 7.5, hw = 4.6 - (y - top) / (bot - top) * 1.1; // a paper cup, narrowing to the base
    if (y < top - 0.2) { // the steam: two wisps curling up while it's hot
      if (f <= 0.25 || y < top - 3.6) return null;
      for (const s of [-1.6, 0, 1.6]) { const wx = s + Math.sin(y * 1.3 + T * 2.5 + s * 2) * 0.55; if (Math.abs(x - wx) < 0.22) return [Math.cos(y * 1.3 + T * 2.5 + s * 2) > 0 ? '(' : ')', C(WHITE, 6 + (y - top + 3.6) * 1.5)]; }
      return null;
    }
    if (y < top + 1.1) { // the lid: a rim, a raised dome with the sip hole
      if (Math.abs(x) > hw + 0.35) return null;
      if (y > top + 0.6) return ['=', C(WHITE, 13)];
      if (Math.abs(x) > hw - 0.3) return null;
      return [Math.abs(x + 0.9) < 0.3 ? 'o' : dRamp(0.4 + 0.5 * dCyl(x, hw)), C(WHITE, 8 + dCyl(x, hw) * 6)];
    }
    if (y > bot || Math.abs(x) > hw) return null;
    const b = dCyl(x, hw), band = y > -0.6 && y < 3.2;
    if (band) { // the sleeve: brown card, CAFE printed on it
      const word = 'CAFE', k = Math.floor((x + 1.2) / 0.6);
      if (Math.abs(y - 1.3) < 0.5 && k >= 0 && k < 4) return [word[k], C(WHITE, 15)];
      return [dFill(b * 0.8), C(BRICK, 6 + b * 8)];
    }
    return [dFill(b), C(WHITE, 7 + b * 8)];
  }),
  soda: (it, f) => sculpt(26, 15, (x, y) => {
    const hw = 4.3, top = -6.2, bot = 6.5;
    if (y < top || y > bot || Math.abs(x) > hw + (y < top + 0.8 || y > bot - 0.8 ? -0.35 : 0)) return null;
    const b = dCyl(x, hw);
    if (y < top + 0.8) return Math.abs(x - 1) < 0.6 && y < top + 0.4 ? ['o', C(GRAY, 14)] : ['=', C(GRAY, 7 + b * 8)]; // the lid and its ring pull
    if (y > bot - 0.8) return ['_', C(GRAY, 7 + b * 8)];
    const wave = Math.abs(y - (1.4 + Math.sin(x * 1.3) * 0.7)) < 0.45; // a white swoosh round it
    if (Math.abs(y + 1.6) < 0.5) { const k = Math.floor((x + 1.2) / 0.6); if (k >= 0 && k < 4) return ['COLA'[k], C(WHITE, 15)]; }
    if (wave) return ['~', C(WHITE, 9 + b * 6)];
    return [b > 0.92 ? '|' : dFill(b), b > 0.92 ? C(WHITE, 15) : C(RED, 6 + b * 9)];
  }),
  slice: (it, f) => sculpt(26, 14, (x, y) => {
    const top = -6, tip = 7, half = 7.4 * (tip - y) / (tip - top); // a wedge, point down
    if (y < top || y > tip || Math.abs(x) > half) return null;
    if (y > top + 1.6 + (tip - top - 1.6) * f + Math.sin(x * 3) * 0.4) return null; // eaten from the tip up
    if (y < top + 1.6) { const b = clamp(0.35 + 0.5 * Math.cos((y - top) / 1.6 * Math.PI - 0.6) - x * 0.02, 0, 1); return [dFill(b), C(BRICK, 6 + b * 9)]; } // the crust
    for (const [px, py] of [[-2.6, -2.6], [1.8, -2.2], [-0.4, 0.4], [2.6, 0.9], [-1.3, 3.3]]) { // pepperoni
      const d = Math.hypot(x - px, y - py);
      if (d < 1.15) return [d < 0.5 ? '@' : 'O', C(RED, 8 + (1 - d) * 5)];
    }
    const n = noise(x * 1.6, y * 1.6, 951), b = clamp(0.45 + n * 0.5, 0, 1); // the cheese, bubbled
    return [n > 0.72 ? 'o' : dFill(b), C(n > 0.72 ? ORANGE : YEL, 7 + b * 8)];
  }),
};
// the fist, drawn the same size: four fingers curled round from the left, each a band lit along its top and creased
// along its bottom, the thumb over the top, the arm running off to the right edge. '~' cells repeat to reach it
const DENSE_HAND = [
  '    ______________________',
  "  .'%%%%%%%%%%%%%%%%%%%%%%'.      .~",
  ' (%%%%%%%%%%%%%%%%%%%%%%%%%%)  .-\'%~',
  ' (############################).-\'%%%%~',
  '(%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%~',
  '(______________________________)####~',
  '(%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%)####~',
  '(______________________________)-.##~',
  ' (%%%%%%%%%%%%%%%%%%%%%%%%%%%%)   \'-~',
  "  '--------------------------'     ~"];
const DENSE_GRIP = 14;
function denseHand(reach) {
  const lines = DENSE_HAND.map(l => l.endsWith('~') ? l.slice(0, -1).padEnd(reach, l[l.length - 2] === ' ' ? ' ' : l[l.length - 2]) : l);
  return [lines, (ch, r, k) => ch === '%' ? C(SKIN, 15 - r * 0.6 - Math.max(0, 6 - k) * 0.3) : ch === '#' ? C(SKIN, 10 - r * 0.4) : C(SKIN, 9), DENSE_GRIP];
}
// in place of the item and the fist, when trying it out (null: not one of the examples)
function drawHeldDense(it, cx, bob) {
  if (!DENSE_ON || !DENSE[it.id]) return false;
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 0.72); // a little over the world's character size
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, hTop = Math.round(cv.height - 9.6 * s + bob), grip = hTop + 1.6 * s;
  const reach = Math.ceil((cv.width - cx) / w) + 12, [hl, hc, gk] = denseHand(reach), x0 = cx - (gk + 0.5) * w;
  const [art, col] = DENSE[it.id](it, usesLeft(it)), artW = Math.max(...art.map(l => l.length)), top = grip + 0.6 * s - art.length * s;
  g.save(); g.beginPath(); g.rect(0, 0, cv.width, hTop + 1.6 * s); g.clip(); // the fingers hide its bottom
  artText(art, cx - artW * w / 2, top, s, col); g.restore();
  artText(hl, x0, hTop, s, hc);
  g.font = FS + 'px monospace';
  return true;
}
