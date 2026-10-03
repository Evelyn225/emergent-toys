const isWordChar = ch => ch !== undefined && /[A-WYZ0-9$%]/.test(ch); // capitals & digits; not X (lattice/crane art)
// billboard: rx_,ry_ = position relative to player; z = base height; w,h = world size
function drawArt(rx_, ry_, z, w, h, art, colFn) {
  const depth = dx * rx_ + dy * ry_;
  if (depth < 0.05 || depth > vis) return;
  const sc = projX / depth, cx = cols / 2 + (-dy * rx_ + dx * ry_) * sc;
  const left = cx - w * sc / 2, right = cx + w * sc / 2;
  const top = hor - (z + h - eye) * projY / depth, bot = hor - (z - eye) * projY / depth;
  const c0 = Math.max(0, Math.floor(left)), c1 = Math.min(cols, Math.ceil(right));
  const r0 = Math.max(0, Math.floor(top)), r1 = Math.min(rows, Math.ceil(bot));
  const L = (1 - depth / vis) * 15 * amb, AR = art.length, AC = art[0].length;
  const cellW = (right - left) / AC, cellH = (bot - top) / AR, stretched = cellW > 1.5 || cellH > 1.5;
  for (let r = r0; r < r1; r++) {
    const ay = Math.min(AR - 1, Math.max(0, (r + 0.5 - top) / (bot - top) * AR | 0)), line = art[ay];
    for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      if (depth >= ZB[i]) continue;
      const ax = Math.min(AC - 1, Math.max(0, (c + 0.5 - left) / (right - left) * AC | 0)), ch = line[ax];
      if (ch === ' ') continue;
      // up close, a letter that's part of a word (signs on carts, stations, billboards, taxis) gets just the middle
      // cell of its stretched span instead of smearing into "HHHOOOTTT"
      if (stretched && isWordChar(ch) && (isWordChar(line[ax - 1]) || isWordChar(line[ax + 1])) &&
          (Math.floor(left + (ax + 0.5) * cellW) !== c || Math.floor(top + (ay + 0.5) * cellH) !== r)) {
        set(i, ' ', 0); ZB[i] = depth; FL[i] = 0; continue;
      }
      set(i, ch, colFn(ch, ay, L)); ZB[i] = depth; FL[i] = 0;
    }
  }
}

// a billboard painted by a function of world position instead of ascii art, for things too big for art to scale well.
// hw = half width. fn(i, u, z, du, dz, L): u across (0 = centre, + right), z = height, du/dz = one cell's size there;
// it paints the cell and returns true, or false to leave it see-through.
function drawShape(rx_, ry_, z0, hw, h, fn) {
  const depth = dx * rx_ + dy * ry_;
  if (depth < 0.05 || depth > vis) return;
  const sc = projX / depth, cx = cols / 2 + (-dy * rx_ + dx * ry_) * sc, du = 1 / sc, dz = depth / projY;
  const c0 = Math.max(0, Math.floor(cx - hw * sc)), c1 = Math.min(cols, Math.ceil(cx + hw * sc));
  const r0 = Math.max(0, Math.floor(hor - (z0 + h - eye) / dz)), r1 = Math.min(rows, Math.ceil(hor - (z0 - eye) / dz));
  const L = (1 - depth / vis) * 15 * amb;
  for (let r = r0; r < r1; r++) {
    const z = eye + (hor - r - 0.5) * dz - z0;
    for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      const bg = BG[i];
      if (depth < ZB[i] && fn(i, (c + 0.5 - cx) * du, z, du, dz, L)) { ZB[i] = depth; FL[i] = 0; if (BG[i] !== bg) ZBG[i] = depth; } // (a background it paints is its own, for the fog)
    }
  }
}

// A real 3D box: every screen cell its outline could cover casts its ray at it (rayBox), so it looks right from any
// side. b: {x, y relative to you, c, s heading, hl, hw, z0, z1}. shade(i, t, L) paints the cell from HIT (which face,
// where on it) and returns true if it drew. Backgrounds get the box's depth too, so fog treats it as solid.
function drawBox(b, shade) {
  let c0 = cols, c1 = -1, r0 = rows, r1 = -1, behind = 0, near = Infinity;
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const X = b.x + su * b.hl * b.c - sv * b.hw * b.s, Y = b.y + su * b.hl * b.s + sv * b.hw * b.c, depth = dx * X + dy * Y;
    near = Math.min(near, depth);
    if (depth < 0.02) { behind++; continue; }
    const sc = projX / depth, col = cols / 2 + (-dy * X + dx * Y) * sc;
    c0 = Math.min(c0, col); c1 = Math.max(c1, col);
    r0 = Math.min(r0, hor - (b.z1 - eye) * projY / depth); r1 = Math.max(r1, hor - (b.z0 - eye) * projY / depth);
  }
  if (behind === 4 || near > vis) return;
  if (behind) { c0 = 0; c1 = cols; r0 = 0; r1 = rows; } // straddling us: test the whole screen
  c0 = Math.max(0, Math.floor(c0)); c1 = Math.min(cols, Math.ceil(c1) + 1);
  r0 = Math.max(0, Math.floor(r0)); r1 = Math.min(rows, Math.ceil(r1) + 1);
  for (let c = c0; c < c1; c++) {
    const cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
    for (let r = r0; r < r1; r++) {
      const i = r * cols + c, t = rayBox(0, 0, eye, rx, ry, (hor - r - 0.5) / projY, b);
      if (t < 0 || t >= ZB[i] || t > vis) continue;
      if (shade(i, t, (1 - t / vis) * 15 * amb)) { ZB[i] = ZBG[i] = t; FL[i] = 0; }
    }
  }
}
// a box at world position (x, y) heading angle a (or cos/sin), for drawBox
const boxAt = (x, y, ca, sa, hl, hw, z0, z1) => ({ x, y, c: ca, s: sa, hl, hw, z0, z1 });

// the el deck in one screen column, for the stretch of ray [t0, t1] that's inside it: its underside (from below) or
// top (from above), and the girder along its side where the ray comes in. Only fills cells nothing nearer covered.
function drawDeck(x, rx, ry, t0, t1) {
  const below = eye < EL_BOT, above = eye > EL_TOP;
  if (below || above) {
    const k = (below ? EL_BOT - eye : eye - EL_TOP) * projY;
    const r0 = below ? (t0 > 0 ? Math.ceil(hor - k / t0) : 0) : Math.ceil(hor + k / t1);
    const r1 = below ? Math.ceil(hor - k / t1) : t0 > 0 ? Math.ceil(hor + k / t0) : rows;
    for (let r = Math.max(0, r0); r < Math.min(rows, r1); r++) {
      const i = r * cols + x;
      if (ZB[i] >= 0) continue;
      const dr = below ? k / (hor - r - 0.5) : k / (r - hor + 0.5);
      CITY.slabFace(i, px + rx * dr, py + ry * dr, below, dr); ZB[i] = dr; FL[i] = 0;
    }
  }
  if (t0 > 0) { // the side girder, where the ray meets the deck
    const r0 = Math.max(0, Math.ceil(hor - (EL_TOP - eye) * projY / t0)), r1 = Math.min(rows, Math.ceil(hor - (EL_BOT - eye) * projY / t0));
    const u = (ry > 0 ? -1 : 1) * (px + rx * t0);
    for (let r = r0; r < r1; r++) {
      const i = r * cols + x;
      if (ZB[i] >= 0) continue;
      CITY.slabEdge(i, u, eye + (hor - r - 0.5) * t0 / projY, t0, 1); ZB[i] = t0; FL[i] = 0;
    }
  }
}

function render(dt) {
  const W = mode === 'room' ? ROOMW : CITY, city = W === CITY;
  eye = mode === 'room' ? 1.7 + stairRise(px, py) : mode === 'roof' ? roofH + 0.17 : mode === 'el' || mode === 'elplat' ? EL_TOP + 0.17 : mode === 'fair' ? fairEye
      : mode === 'walk' ? 0.17 : mode === 'boat' ? 0.09 : chaseOn ? 0.28 : 0.12;
  eye += eyeLift() * (mode === 'room' ? 1 : 0.1); // jumping, crouching, sitting (metres; a cell outdoors is 10)
  tf = Math.tan(FOV / 2); projX = cols / 2 / tf; projY = projX * cw / FS;
  hor = (rows >> 1) + pitch * rows + shake() | 0;
  dx = Math.cos(a); dy = Math.sin(a);
  lookHit = null;
  for (let x = 0; x < cols; x++) {
    const cx = 2 * x / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
    const cx2 = cx + 2 / cols, rx2 = dx - dy * tf * cx2, ry2 = dy + dx * tf * cx2; // next column's ray
    for (let r = 0; r < rows; r++) { const i = r * cols + x; BG[i] = NONE; ZB[i] = -1; } // -1: nothing drawn here yet
    // DDA through the grid, front to back; `clip` = lowest row not yet covered
    // The el deck is a box over the middle of its street (y in EL_Y0..EL_Y1, z in EL_BOT..EL_TOP), narrower than a cell
    // pair, so it isn't part of the grid: work out where this ray is inside it ([te, tx]) and draw it when the DDA
    // gets that far. It leaves gaps in the column, so once it's drawn every later write checks ZB first.
    let mx = Math.floor(px), my = Math.floor(py), clip = rows, first = true, dPrev = 0, hCur = W.cell(mx, my), holes = false;
    let te = Infinity, tx = -Infinity;
    if (W.deck) {
      const yc = py + rel(EL_Y + 1 - py), y0 = yc - EL_HALF, y1 = yc + EL_HALF;
      if (Math.abs(ry) < 1e-9) { if (py > y0 && py < y1) { te = 0; tx = Infinity; } }
      else { const a0 = (y0 - py) / ry, a1 = (y1 - py) / ry; tx = Math.max(a0, a1); te = tx > 0 ? Math.max(0, Math.min(a0, a1)) : Infinity; }
    }
    let deckDue = te < vis;
    BASE[x] = clamp(hor, 0, rows);
    const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
    let sdx = (rx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (ry < 0 ? py - my : my + 1 - py) * ddy;
    while (clip > 0) {
      let d, side;
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; side = 0; } else { d = sdy; sdy += ddy; my += sy; side = 1; }
      // the cell we just crossed spans dPrev..d; when we're above it (on a roof), draw its top
      if (hCur > 0 && hCur < eye && W.roof) {
        const k = (eye - hCur) * projY, rIn = dPrev > 0 ? Math.ceil(hor + k / dPrev) : rows, rOut = Math.max(0, Math.ceil(hor + k / Math.min(d, vis)));
        for (let r = rOut; r < Math.min(clip, rIn); r++) {
          const i = r * cols + x, dr = k / (r - hor + 0.5);
          if (holes && ZB[i] >= 0) continue;
          W.roof(i, px + rx * dr, py + ry * dr, hCur, dr); ZB[i] = dr; FL[i] = 0;
        }
        clip = Math.min(clip, rOut);
      }
      // everything nearer than the deck is drawn: now the deck, before anything behind it
      if (deckDue && d > te) { drawDeck(x, rx, ry, te, Math.min(tx, vis)); deckDue = false; holes = true; }
      if (d > vis) break;
      const h = W.cell(mx, my); hCur = h; dPrev = d;
      if (!h) continue;
      if (first) { first = false; BASE[x] = Math.min(rows, Math.ceil(hor + eye * projY / d)); if (x === cols >> 1) lookHit = { d, mx, my }; }
      const top = Math.max(0, Math.ceil(hor - (h - eye) * projY / d));
      const bot = Math.min(clip, Math.ceil(hor + eye * projY / d));
      // u runs left-to-right on screen for whichever face we see, so signs read correctly
      const u = side ? (ry > 0 ? -1 : 1) * (px + rx * d) : (rx > 0 ? 1 : -1) * (py + ry * d);
      const uStep = side ? Math.abs(rx2 * (ry * d / ry2) - rx * d) : Math.abs(ry2 * (rx * d / rx2) - ry * d);
      for (let r = top; r < bot; r++) {
        const i = r * cols + x;
        if (holes && ZB[i] >= 0) continue;
        W.wall(i, u, uStep, eye + (hor - r - 0.5) * d / projY, h, d, side, mx, my, 1 - d / vis, side ? px + rx * d : py + ry * d);
        ZB[i] = d; FL[i] = 0;
      }
      clip = Math.min(clip, top);
    }
    if (deckDue) { drawDeck(x, rx, ry, te, Math.min(tx, vis)); holes = true; } // nothing at all was in front of it
    // sky / floor only where no wall or roof landed: shading them first and painting over was most of the cell work
    for (let r = 0; r < rows; r++) { const i = r * cols + x; if (ZB[i] < 0) (r < hor ? W.sky : W.floor)(i, r, x, rx, ry); }
  }
  if (city) { sunMoon(); lightning(); }
  ZBG.set(ZB); // sprites draw characters over whatever background was there, so backgrounds keep this depth for fog
  W.sprites();
  if (city) { reflect(); fogSteps(); drawFireworks(); rainFx(dt); } else { FOGS.fill(0); FOGB.fill(0); }
  if (mode === 'drive' || mode === 'taxi') dash();
  if (mode === 'el') elFrame();
  if (mode === 'fair') fairFrame();
  if (mode === 'boat') boatFrame();
  drawHeld(dt); // what's in your hand (or mouth, or under your feet)
  present();
  if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, cv.width, cv.height); }
  hud();
}
// paint the character grid (CH / COL / BG, with fog) onto the canvas: the world's frame, or a minigame's
function present() {
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  for (let r = 0; r < rows; r++) for (let x0 = 0; x0 < cols;) { // backgrounds, run-length
    const j = r * cols + x0, b = BG[j], s = FOGB[j]; let x1 = x0 + 1;
    while (x1 < cols && BG[r * cols + x1] === b && FOGB[r * cols + x1] === s) x1++;
    if (s || b !== NONE) { g.fillStyle = s ? fogged(b, s) : PAL[b]; g.fillRect(x0 * cw, r * FS, (x1 - x0) * cw + 0.5, FS); }
    x0 = x1;
  }
  // text: one fillText per run of same-coloured characters on a row (gaps of spaces are allowed inside a run);
  // the font is monospace so a run lines up with the grid, and it's far fewer canvas calls than one per cell
  const blank = j => CH[j] === ' ' || FOGS[j] === 8; // fully fogged text is invisible
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols;) {
    const i = r * cols + x;
    if (blank(i)) { x++; continue; }
    const key = COL[i] * 9 + FOGS[i];
    let s = CH[i], x1 = x + 1, end = x1;
    for (; x1 < cols; x1++) {
      const j = r * cols + x1;
      if (blank(j)) { s += ' '; continue; }
      if (COL[j] * 9 + FOGS[j] !== key) break;
      s += CH[j]; end = x1 + 1;
    }
    g.fillStyle = FOGS[i] ? fogged(COL[i], FOGS[i]) : PAL[COL[i]];
    g.fillText(s.slice(0, end - x), x * cw, r * FS);
    x = end;
  }
}

