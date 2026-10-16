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
  const cellW = (right - left) / AC, cellH = (bot - top) / AR, stretched = cellW > 1 || cellH > 1;
  for (let r = r0; r < r1; r++) {
    const ay = Math.min(AR - 1, Math.max(0, (r + 0.5 - top) / (bot - top) * AR | 0)), line = art[ay];
    for (let c = c0; c < c1; c++) {
      const i = r * cols + c;
      if (depth >= ZB[i]) continue;
      const ax = Math.min(AC - 1, Math.max(0, (c + 0.5 - left) / (right - left) * AC | 0)), ch = line[ax];
      if (ch === ' ') continue;
      // up close, a letter that's part of a word (signs on carts, stations, billboards, taxis) gets just the middle
      // cell of its stretched span instead of smearing into "HHHOOOTTT"
      const word = stretched && isWordChar(ch) && (isWordChar(line[ax - 1]) || isWordChar(line[ax + 1]));
      if (word && cellW >= 3 && cellH >= 3.5 && GLYPH5[ch] !== undefined) { // big enough: the letter drawn large in blocks (every letter of the art at once)
        const fx = (c + 0.5 - left) / cellW - ax, fy = (r + 0.5 - top) / cellH - ay;
        set(i, glyphOn(ch, Math.floor(fx * 4), Math.floor(fy * 5)) ? '#' : ' ', colFn(ch, ay, L)); ZB[i] = depth; FL[i] = 0; continue;
      }
      if (word && (Math.floor(left + (ax + 0.5) * cellW) !== c || Math.floor(top + (ay + 0.5) * cellH) !== r)) {
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
      if (depth >= ZB[i]) continue;
      const bg = BG[i]; BG[i] = BG_UNSET;
      const drew = fn(i, (c + 0.5 - cx) * du, z, du, dz, L);
      if (BG[i] === BG_UNSET) BG[i] = bg; else if (drew) ZBG[i] = depth; // (a background it paints is its own, for the fog)
      if (drew) { ZB[i] = depth; FL[i] = 0; }
    }
  }
}

// A real 3D box: every screen cell its outline could cover casts its ray at it (rayBox), so it looks right from any
// side. b: {x, y relative to you, c, s heading, hl, hw, z0, z1}. shade(i, t, L) paints the cell from HIT (which face,
// where on it) and returns true if it drew. Backgrounds get the box's depth too, so fog treats it as solid.
function drawBox(b, shade, intersect = rayBox) {
  // A box crossing the camera's near plane otherwise tests every screen cell, even when entirely off to one side.
  // Conservative bounds also cover sloped custom shapes contained by this box.
  const along = dx * b.c + dy * b.s, across = -dx * b.s + dy * b.c;
  const far = dx * b.x + dy * b.y + Math.abs(along) * b.hl + Math.abs(across) * b.hw;
  const edge = Math.abs(-dy * b.x + dx * b.y) - Math.abs(across) * b.hl - Math.abs(along) * b.hw;
  if (far < .02 || edge > far * tf) return;
  const above = b.z0 > eye, below = b.z1 < eye;
  const bottom = hor - (b.z0 - eye) * projY / far, top = hor - (b.z1 - eye) * projY / far;
  if (above && bottom < -1 || below && top > rows + 1) return;
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
  if (behind) {
    c0 = 0; c1 = cols;
    // Balconies immediately beside the camera can cross the near plane while lying far above the view.
    r0 = below ? Math.max(0, top - 1) : 0;
    r1 = above ? Math.min(rows, bottom + 1) : rows;
  }
  c0 = Math.max(0, Math.floor(c0)); c1 = Math.min(cols, Math.ceil(c1) + 1);
  r0 = Math.max(0, Math.floor(r0)); r1 = Math.min(rows, Math.ceil(r1) + 1);
  for (let c = c0; c < c1; c++) {
    const cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
    for (let r = r0; r < r1; r++) {
      const i = r * cols + c;
      // Even the nearest corner is behind this cell: skip the expensive shape intersection.
      if (ZB[i] <= near) continue;
      const t = intersect(0, 0, eye, rx, ry, (hor - r - 0.5) / projY, b);
      if (t < 0 || t >= ZB[i] || t > vis) continue;
      const bg = BG[i]; BG[i] = BG_UNSET;
      const drew = shade(i, t, (1 - t / vis) * 15 * amb);
      if (BG[i] === BG_UNSET) BG[i] = bg; else if (drew) ZBG[i] = t; // (as drawShape: only a background it paints is its own, for the fog)
      if (drew) { ZB[i] = t; FL[i] = 0; }
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
      : mode === 'walk' ? 0.17 : mode === 'boat' ? (chaseOn ? 0.2 : 0.11) : mode === 'sea' ? seaEye() : chaseOn ? 0.28 : 0.12;
  if (freecam) eye = freecam.z;
  else if (mode === 'air') eye = airEye;
  else if(mode==='ladder'&&climbing)eye=climbing.z+.17;
  else {
    eye += eyeLift() * (mode === 'room' ? 1 : 0.1); // jumping, crouching, sitting (metres; a cell outdoors is 10)
    if (mode === 'walk') eye += walkGround(px, py);
  }
  tf = Math.tan(FOV / 2); projX = cols / 2 / tf; projY = projX * cw / FS;
  hor = (rows >> 1) + pitch * rows | 0;
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
      WH.wc = side ? px + rx * d : py + ry * d; WH.dn = Math.abs(side ? ry * d : rx * d) || 1e-4; WH.sl = (side ? rx * d : ry * d) / WH.dn; // (for things seen through glass)
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
  if (city) drawTireMarks();
  drawPuddles(); // (under whoever's standing in one)
  W.sprites();
  drawPeeMarks(); // stains on walls and solid static objects
  if (!city && room.def.fx) room.def.fx(); // a room's own lighting over the top (the museum's torches)
  drawStream();
  drawHaze(); // smoke hanging in the air, over everything it's in front of
  if (city) { reflect(); fogSteps(); drawFireworks(); rainFx(dt); } else { FOGS.fill(0); FOGB.fill(0); }
  if (!freecam) {
    if (mode === 'drive' || mode === 'taxi') dash();
    if (mode === 'air') airDash();
    chuteFrame();
    if (mode === 'el') elFrame();
    if (mode === 'fair') fairFrame();
    drawHeld(dt); // what's in your hand (or mouth, or under your feet)
  }
  present();
  if (freecam) freecamHud();
  else {
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, cv.width, cv.height); }
    hud();
  }
}
// paint the character grid (CH / COL / BG, with fog): the world's frame, or a minigame's. With WebGL the whole grid goes
// in one shader pass (glPresent) onto a canvas of its own, just under the game's canvas, which is then left clear for
// the HUD and whatever else draws over the frame; without it, the canvas calls of present2D. (Whatever needs the
// picture as you see it, both layers together, takes frameCanvas().)
function present() {
  if (!glPresent()) present2D();
}
// One pass of a fragment shader over the WebGL canvas: per cell, its character (from an atlas of the ASCII
// glyphs drawn in the game's own font), its text and background colours (palette indices) and their fog. The rare
// non-ASCII character is drawn on the game's canvas over it with fillText, as present2D would. Gives up (returns false)
// for good if WebGL isn't there or the context is lost, and the canvas calls take over.)
let GLP = null, GLP_OFF = false, GLP_SOFT = false; // (GLP_SOFT: allow a software GL, which is slower than the 2D path; tests only)
const GLP_VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const GLP_FS = `precision highp float;
uniform sampler2D cells, pal, atlas; uniform vec2 grid, cell, atlasSize; uniform float slotW, canvasH; uniform vec3 fog;
vec3 palette(float k) { return k > 254.5 ? vec3(0.0) : texture2D(pal, vec2((k + 0.5) / 256.0, 0.5)).rgb; }
void main() {
  vec2 p = vec2(gl_FragCoord.x, canvasH - gl_FragCoord.y), c = floor(p / cell);
  if (c.x >= grid.x || c.y >= grid.y) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec4 d = floor(texture2D(cells, (c + 0.5) / grid) * 255.0 + 0.5);
  float fs = floor(d.a / 16.0), fb = d.a - fs * 16.0;
  vec3 col = mix(palette(d.b), fog, fb / 8.0);
  if (d.r < 254.5 && fs < 7.5) {
    vec2 l = p - c * cell;
    float a = texture2D(atlas, vec2((d.r * slotW + l.x) / atlasSize.x, l.y / atlasSize.y)).a;
    col = mix(col, mix(palette(d.g), fog, fs / 8.0), a);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
function glPresentInit() {
  const glc = document.createElement('canvas'), gl = glc.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: !GLP_SOFT }); // (kept: screenshots and double vision read it later)
  if (!gl) return null;
  // a GPU only: shading every pixel on the CPU (SwiftShader, llvmpipe) halves the frame rate the 2D canvas gets
  const dbg = gl.getExtension('WEBGL_debug_renderer_info'), who = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (!GLP_SOFT && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(who)) return null;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const vs = sh(gl.VERTEX_SHADER, GLP_VS), fs = sh(gl.FRAGMENT_SHADER, GLP_FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle over the screen
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t; };
  const U = n => gl.getUniformLocation(prog, n), st = { glc, gl, prog, U, cells: tex(0), pal: tex(1), atlas: tex(2), key: '' };
  gl.uniform1i(U('cells'), 0); gl.uniform1i(U('pal'), 1); gl.uniform1i(U('atlas'), 2);
  const P = new Uint8Array(256 * 4); PALRGB.forEach((c, k) => P.set([c[0], c[1], c[2], 255], k * 4));
  gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, P);
  glc.addEventListener('webglcontextlost', () => { GLP_OFF = true; GLP = null; glc.remove(); });
  glc.style.zIndex = '0'; glc.style.pointerEvents = 'none'; cv.before(glc); // (under the game's canvas, which keeps the input)
  return st;
}
// (re)build what depends on the screen's size: the glyph atlas, the cell texture, the canvas
function glPresentSize(st) {
  const { gl, U } = st, slotW = Math.ceil(cw) + 1, at = document.createElement('canvas'), x = at.getContext('2d');
  at.width = 96 * slotW; at.height = FS;
  x.font = FS + 'px monospace'; x.textBaseline = 'top'; x.fillStyle = '#fff';
  for (let k = 1; k < 95; k++) x.fillText(String.fromCharCode(32 + k), k * slotW, 0); // ('!'..'~'; 0 is the space)
  gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, at);
  st.data = new Uint8Array(cols * rows * 4);
  gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, st.data);
  st.glc.width = cv.width; st.glc.height = cv.height; gl.viewport(0, 0, cv.width, cv.height);
  gl.uniform2f(U('grid'), cols, rows); gl.uniform2f(U('cell'), cw, FS); gl.uniform2f(U('atlasSize'), at.width, at.height);
  gl.uniform1f(U('slotW'), slotW); gl.uniform1f(U('canvasH'), cv.height);
  st.key = [cols, rows, cw, FS, cv.width, cv.height].join();
}
function glPresent() {
  if (GLP_OFF) return false;
  if (!GLP) { try { GLP = glPresentInit(); } catch (e) { GLP = null; } if (!GLP) { GLP_OFF = true; return false; } }
  const st = GLP, { gl, U } = st;
  if (st.key !== [cols, rows, cw, FS, cv.width, cv.height].join()) glPresentSize(st);
  const D = st.data, odd = []; // (cells whose character isn't plain ASCII: drawn over the top after)
  for (let i = 0, n = cols * rows; i < n; i++) {
    const ch = CH[i], code = typeof ch === 'string' && ch.length === 1 ? ch.charCodeAt(0) : 0, j = i * 4;
    D[j] = code > 32 && code < 127 && FOGS[i] < 8 ? code - 32 : 255;
    if (D[j] === 255 && ch && ch !== ' ' && FOGS[i] < 8 && !(code > 32 && code < 127)) odd.push(i);
    D[j + 1] = COL[i]; D[j + 2] = BG[i]; D[j + 3] = FOGS[i] * 16 + FOGB[i];
  }
  gl.activeTexture(gl.TEXTURE0); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, D);
  gl.uniform3f(U('fog'), fogRGB[0] / 255, fogRGB[1] / 255, fogRGB[2] / 255);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  g.clearRect(0, 0, cv.width, cv.height); // (the game's canvas, clear over the frame for what's drawn on top)
  for (const i of odd) { g.fillStyle = FOGS[i] ? fogged(COL[i], FOGS[i]) : PAL[COL[i]]; g.fillText(CH[i], (i % cols) * cw, Math.floor(i / cols) * FS, cw); }
  return true;
}
// the picture as you see it: the WebGL frame under the game's canvas, flattened into one canvas
function frameCanvas() {
  if (!GLP) return cv;
  const c = GLP.flat ||= document.createElement('canvas'), x = c.getContext('2d'); // (one, reused: double vision wants it every frame)
  if (c.width !== cv.width || c.height !== cv.height) { c.width = cv.width; c.height = cv.height; }
  x.drawImage(GLP.glc, 0, 0); x.drawImage(cv, 0, 0); // (the GL frame is opaque, so it covers whatever was there)
  return c;
}
// the same, in canvas calls: backgrounds run-length, then text a run of one colour at a time
function present2D() {
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
  const singleWidth = ch => ch.length === 1 && ch.charCodeAt(0) < 128;
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols;) {
    const i = r * cols + x;
    if (blank(i)) { x++; continue; }
    // Unicode fallback fonts and combining sequences can have a different advance. Give each its own cell,
    // preserving both the complete grapheme and the position of the ordinary text that follows it.
    if (!singleWidth(CH[i])) {
      g.fillStyle = FOGS[i] ? fogged(COL[i],FOGS[i]) : PAL[COL[i]];
      g.fillText(CH[i],x * cw,r * FS,cw);
      x++; continue;
    }
    const key = COL[i] * 9 + FOGS[i];
    let s = CH[i], x1 = x + 1, end = x1;
    for (; x1 < cols; x1++) {
      const j = r * cols + x1;
      if (blank(j)) { s += ' '; continue; }
      if (COL[j] * 9 + FOGS[j] !== key) break;
      if (!singleWidth(CH[j])) break;
      s += CH[j]; end = x1 + 1;
    }
    g.fillStyle = FOGS[i] ? fogged(COL[i], FOGS[i]) : PAL[COL[i]];
    g.fillText(s.slice(0, end - x), x * cw, r * FS);
    x = end;
  }
}
