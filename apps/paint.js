// ─────────────────────────────────────────────────────────────────
// PAINT.exe - UI half
// ─────────────────────────────────────────────────────────────────
// The pure half is apps/paint-core.js. Everything here touches the DOM, the
// canvas, the filesystem or the window manager, and none of it is reachable
// from `npm test` - which is exactly why the brushes live next door.
//
// The renderer below is deliberately dumb: a switch over op types with no
// knowledge of what a brush IS. Every decision about what a stroke looks like
// was already made by a pure function.

const PAINT_WIN_ID = 'paint';
const PAINT_REG_PATH = 'SOFTWARE\\sleepOS\\Paint';
const PAINT_UNDO_STEPS = 20;
const PAINT_DEFAULT_DIR = 'PICTURES';

let paintState = null;

// ── sound shim ───────────────────────────────────────────────────
// PAINT ships silent. test/sound-assets.test.cjs fails the build on a
// SOUND_FILES name with no .ogg behind it, so no name may enter that table
// before its file exists. Every trigger is in place now, so wiring real sounds
// later is a one-table change with no edits to any call site.
//
// Wanted, in rough order of how much each one carries the feel:
//   paint-undo (the Undo Guy whoop), paint-stamp, paint-fill,
//   paint-firecracker, paint-eraser, paint-brush, then paint-pencil,
//   paint-shape, paint-eyedropper, paint-text, paint-blackhole,
//   paint-dissolve, paint-clear, paint-palette.
function paintSound(name) {
  if (typeof SOUND_FILES === 'object' && SOUND_FILES && SOUND_FILES[name]) playSound(name);
}

// ── registry-backed preferences ──────────────────────────────────
function paintRegValue(name, fallback) {
  const key = registryData['HKEY_CURRENT_USER'] && registryData['HKEY_CURRENT_USER'][PAINT_REG_PATH];
  const entry = key && key[name];
  return entry ? entry.value : fallback;
}
function paintSetRegValue(name, value) {
  const key = registryData['HKEY_CURRENT_USER'] && registryData['HKEY_CURRENT_USER'][PAINT_REG_PATH];
  if (!key || !key[name]) return;
  key[name].value = value;
  saveRegistry();
}

// ── the op renderer ──────────────────────────────────────────────
// One switch, no cleverness. If a brush looks wrong the bug is in
// apps/paint-core.js, and a node test can find it.
function paintExecOps(ctx, ops) {
  ops.forEach(op => {
    switch (op.op) {
      case 'dab':
        ctx.fillStyle = op.color;
        ctx.beginPath();
        ctx.arc(op.x, op.y, Math.max(0.5, op.r), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'line':
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.w;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(op.x0, op.y0);
        ctx.lineTo(op.x1, op.y1);
        ctx.stroke();
        break;
      case 'rect':
        ctx.fillStyle = op.color;
        ctx.fillRect(op.x, op.y, op.w, op.h);
        break;
      case 'erase':
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(op.x, op.y, Math.max(0.5, op.r), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sprite':
        paintDrawSticker(ctx, op);
        break;
    }
  });
}

// One <img> for the whole atlas, loaded once and shared. drawImage takes an
// HTMLImageElement directly, so there is no need to decode it into anything.
let paintStickerImg = null;
function paintStickerImage() {
  if (!paintStickerImg) {
    paintStickerImg = new Image();
    // The size-variant previews are drawn onto a canvas the moment this
    // function first runs, which is necessarily before the atlas can have
    // decoded - paintDrawSticker's img.complete guard makes that first pass
    // draw nothing. Redraw the options bar once the atlas is actually ready,
    // so those previews stop being permanently blank. Guard on paintState:
    // it goes null when the window closes, and paintRenderOptionsBar
    // dereferences paintState.tool without a null check of its own.
    paintStickerImg.onload = () => {
      if (paintState && paintState.tool === 'sticker') paintRenderOptionsBar();
    };
    paintStickerImg.src = 'os/sprites/paint-stickers.png';
  }
  return paintStickerImg;
}

function paintDrawSticker(ctx, op) {
  const rect = paintStickerRect(op.idx);
  if (!rect) return;
  const img = paintStickerImage();
  if (!img.complete || !img.naturalWidth) return;
  const half = op.size / 2;
  // Nearest-neighbour, always: these are 32px pixel-art cells and a smoothed
  // upscale to 52px turns them to mush.
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh,
                Math.round(op.x - half), Math.round(op.y - half), op.size, op.size);
  ctx.imageSmoothingEnabled = prev;
}

// ── canvas scaling ───────────────────────────────────────────────
// The backing store never changes size; only how many screen pixels each canvas
// pixel occupies does. paintDisplayScale keeps that a whole number wherever 1x
// fits, which is what keeps every pixel square.
function paintFitCanvas() {
  const s = paintState;
  if (!s) return;
  const stage = document.getElementById('paint-stage');
  if (!stage) return;
  const scale = paintDisplayScale(stage.clientWidth, stage.clientHeight);
  s.scale = scale;
  s.canvas.style.width = (paintCanvasWidth() * scale) + 'px';
  s.canvas.style.height = (paintCanvasHeight() * scale) + 'px';
}

// A pointer event's position in CANVAS pixels. Every generator works in canvas
// space and none of them knows the display scale exists - this is the one place
// the conversion happens.
function paintPointerPos(e) {
  const s = paintState;
  const r = s.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / s.scale,
    y: (e.clientY - r.top) / s.scale,
  };
}

// ── undo ─────────────────────────────────────────────────────────
function paintSnapshot() {
  const s = paintState;
  return s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
}
function paintRestore(snapshot) {
  if (snapshot) paintState.ctx.putImageData(snapshot, 0, 0);
}
// Called once per completed stroke, not per segment: an undo should take back a
// line, not one twitch of the mouse.
function paintCommitUndo() {
  paintUndoPush(paintState.ring, paintSnapshot());
}
function paintUndo() {
  const snap = paintUndoUndo(paintState.ring);
  if (!snap) return false;
  paintRestore(snap);
  paintSound('paint-undo');
  return true;
}
function paintRedo() {
  const snap = paintUndoRedo(paintState.ring);
  if (!snap) return false;
  paintRestore(snap);
  return true;
}

// ── tool selection ───────────────────────────────────────────────
// Exposed as functions rather than inline handlers so the browser tests can
// drive the app the way a user would, without synthesising clicks on chrome
// that Task 6 has not built yet.
function paintSelectTool(toolId) {
  if (!paintState) return;
  const variants = paintVariantsFor(toolId);
  paintState.tool = toolId;
  paintState.variant = variants.length ? variants[0].id : null;
  paintSetRegValue('Tool', toolId);
  paintRenderOptionsBar();
  paintSyncToolButtons();
}
function paintSelectVariant(variantId) {
  if (!paintState) return;
  paintState.variant = variantId;
  paintSyncOptionButtons();
}
function paintSetColor(hex) {
  if (!paintState) return;
  paintState.color = hex;
  paintSetRegValue('Color', hex);
  paintSyncPalette();
}

// Sized off the variant id where the id encodes it - 'p5' is a 5px pencil, 'e10'
// a 10px eraser. Anything else falls back to a sane middle.
function paintSizeForVariant(variantId) {
  const m = /^[a-z](\d+)$/.exec(String(variantId || ''));
  return m ? Number(m[1]) : 3;
}

// ── stroke handling ──────────────────────────────────────────────
function paintStrokeState() {
  const s = paintState;
  return {
    color: s.color,
    size: paintSizeForVariant(s.variant),
    rng: s.rng,
    points: s.points,
    stickerIndex: s.stickerIndex,
  };
}

function paintBeginStroke(pos) {
  const s = paintState;
  // Two tools read the canvas and finish in one click, so they never enter the
  // stroke machinery below at all.
  if (s.tool === 'fill')       { paintDoFill(pos); return; }
  if (s.tool === 'eyedropper') { paintDoEyedropper(pos); return; }
  // One rng per stroke, seeded once, so a stroke is reproducible end to end
  // rather than drifting with whatever else asked for a random number.
  s.strokeSeed = (Math.random() * 0xffffffff) >>> 0;
  s.rng = paintRng(s.strokeSeed);
  s.points = [{ x: pos.x, y: pos.y }];
  s.segIndex = 0;
  s.drawing = true;
  s.origin = { x: pos.x, y: pos.y };
  // A shape is previewed live and only committed on release, so the pixels
  // underneath it have to survive every mouse move.
  s.preview = paintIsShapeTool(s.tool) ? paintSnapshot() : null;
  paintDrawSegment(pos.x, pos.y, pos.x, pos.y);
}

function paintExtendStroke(pos) {
  const s = paintState;
  if (!s.drawing) return;
  if (s.preview) {
    // Restore, then redraw the whole shape from the drag origin. Drawing the
    // shape incrementally would leave every intermediate rectangle on screen.
    paintRestore(s.preview);
    s.points = [s.origin, { x: pos.x, y: pos.y }];
    paintDrawSegment(s.origin.x, s.origin.y, pos.x, pos.y);
    return;
  }
  const prev = s.points[s.points.length - 1];
  s.points.push({ x: pos.x, y: pos.y });
  s.segIndex++;
  paintDrawSegment(prev.x, prev.y, pos.x, pos.y);
}

function paintEndStroke() {
  const s = paintState;
  if (!s.drawing) return;
  s.drawing = false;
  s.dirty = true;
  if (s.preview) { s.preview = null; paintSound('paint-shape'); }
  paintCommitUndo();
}

// ─────────────────────────────────────────────────────────────────
// Fill and eyedropper
// ─────────────────────────────────────────────────────────────────
// These two READ the canvas, which is why neither goes through paintGenerate:
// a generator is a pure function of a stroke and knows nothing about what is
// already painted. Both complete in one click.

function paintDoFill(pos) {
  const s = paintState;
  const x = Math.floor(pos.x), y = Math.floor(pos.y);
  const w = s.canvas.width, h = s.canvas.height;
  const id = s.ctx.getImageData(0, 0, w, h);

  // Fill flat first, in the paint colour. The pattern is then punched back out
  // of exactly the pixels this fill claimed - which is what keeps a patterned
  // fill inside the same region a solid one would have found.
  const before = id.data.slice();
  const rgba = paintHexToRgba(s.color);
  const n = paintFloodFill(id.data, w, h, x, y, rgba, 12);
  if (!n) return;

  if (s.variant !== 'solid') {
    const rng = paintRng((Math.random() * 0xffffffff) >>> 0);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        // Only pixels this fill actually changed are candidates.
        if (id.data[i] === before[i] && id.data[i + 1] === before[i + 1] && id.data[i + 2] === before[i + 2]) continue;
        if (s.variant === 'gradient') {
          // Vertical ramp from the paint colour to white across the canvas.
          const t = py / h;
          id.data[i]     = Math.round(rgba[0] + (255 - rgba[0]) * t);
          id.data[i + 1] = Math.round(rgba[1] + (255 - rgba[1]) * t);
          id.data[i + 2] = Math.round(rgba[2] + (255 - rgba[2]) * t);
          continue;
        }
        if (!paintPatternAt(s.variant, px, py, rng)) {
          // Not inked: put back whatever was there before the flood.
          id.data[i] = before[i]; id.data[i + 1] = before[i + 1];
          id.data[i + 2] = before[i + 2]; id.data[i + 3] = before[i + 3];
          continue;
        }
        const alt = paintPatternColor(s.variant, s.color, rng);
        if (alt) {
          const c = paintHexToRgba(alt);
          id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2];
        }
      }
    }
  }

  s.ctx.putImageData(id, 0, 0);
  s.dirty = true;
  paintSound('paint-fill');
  paintCommitUndo();
}

function paintDoEyedropper(pos) {
  const s = paintState;
  const x = Math.floor(pos.x), y = Math.floor(pos.y);
  if (x < 0 || y < 0 || x >= s.canvas.width || y >= s.canvas.height) return;
  const d = s.ctx.getImageData(x, y, 1, 1).data;
  paintSetColor(paintRgbaToHex(d[0], d[1], d[2]));
  paintSound('paint-eyedropper');
  // Back to the pencil. Staying on the eyedropper means a second click before
  // you can use the colour you just picked, which is a step nobody wants.
  paintSelectTool('pencil');
}

function paintDrawSegment(x0, y0, x1, y1) {
  const s = paintState;
  const seg = { x0, y0, x1, y1, index: s.segIndex };
  paintExecOps(s.ctx, paintGenerate(s.tool, s.variant, seg, paintStrokeState()));
}

// ── launcher ─────────────────────────────────────────────────────
function openPaint() {
  if (!mkWin({ id: PAINT_WIN_ID, title: 'untitled.png - Paint', icon: 'icon:paint',
               w: 620, h: 540, menubar: true, statusbar: true })) return;

  const body = document.getElementById('wb-' + PAINT_WIN_ID);
  body.className = 'win-body paint-body';
  body.innerHTML = `
    <div class="paint-root">
      <div class="paint-tools" id="paint-tools"></div>
      <div class="paint-stage" id="paint-stage">
        <canvas id="paint-canvas"></canvas>
      </div>
      <div class="paint-bottom">
        <div class="paint-palette" id="paint-palette"></div>
        <div class="paint-options" id="paint-options"></div>
        <button class="paint-undo-guy" id="paint-undo-guy" type="button"
                title="Undo" aria-label="Undo"></button>
      </div>
    </div>`;

  const canvas = document.getElementById('paint-canvas');
  canvas.width = paintCanvasWidth();
  canvas.height = paintCanvasHeight();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const storedTool = String(paintRegValue('Tool', 'pencil'));
  const tool = paintTools().some(t => t.id === storedTool) ? storedTool : 'pencil';
  const storedColor = String(paintRegValue('Color', '#000000'));
  const color = paintPalette().some(c => c.hex === storedColor) ? storedColor : '#000000';

  paintState = {
    tool,
    variant: (paintVariantsFor(tool)[0] || { id: null }).id,
    color,
    canvas, ctx,
    scale: 1,
    ring: paintUndoInit(PAINT_UNDO_STEPS),
    dirty: false,
    file: null,
    dir: PAINT_DEFAULT_DIR,
    stickerIndex: 0,
    stickerPage: 0,
    points: [],
    segIndex: 0,
    drawing: false,
    rng: paintRng(1),
  };
  // The blank canvas is the first undo state, so undoing the very first stroke
  // returns to white rather than doing nothing.
  paintUndoPush(paintState.ring, paintSnapshot());

  paintRenderTools();
  paintRenderPalette();
  paintRenderOptionsBar();

  paintBuildMenu(document.getElementById('mb-' + PAINT_WIN_ID));

  document.getElementById('paint-undo-guy').textContent = '↶';
  document.getElementById('paint-undo-guy').addEventListener('click', () => paintUndo());

  document.getElementById('win-' + PAINT_WIN_ID).addEventListener('keydown', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); paintUndo(); }
    else if (k === 'y') { e.preventDefault(); paintRedo(); }
    else if (k === 's') { e.preventDefault(); paintState.file ? paintSave(paintState.file, paintState.dir) : paintSaveAs(); }
  });

  const winEl = document.getElementById('win-' + PAINT_WIN_ID);
  if (!winEl.hasAttribute('tabindex')) winEl.setAttribute('tabindex', '-1');
  procSetTimeout(PAINT_WIN_ID, () => winEl.focus(), 40);

  paintFitCanvas();

  // pointer events, not mouse events: one code path covers mouse, finger and
  // stylus, which is what makes this work on a phone at all.
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    paintBeginStroke(paintPointerPos(e));
  });
  canvas.addEventListener('pointermove', e => {
    if (!paintState || !paintState.drawing) return;
    e.preventDefault();
    paintExtendStroke(paintPointerPos(e));
  });
  const finish = e => {
    if (!paintState || !paintState.drawing) return;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    paintEndStroke();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  // Dragging off the canvas and letting go must end the stroke; without this the
  // next hover keeps painting with no button held.
  canvas.addEventListener('pointerleave', e => { if (paintState && paintState.drawing) finish(e); });

  // Touch scrolling would otherwise fight every drag on a phone.
  canvas.style.touchAction = 'none';

  const ro = new ResizeObserver(() => paintFitCanvas());
  ro.observe(document.getElementById('paint-stage'));

  wins[PAINT_WIN_ID]._onclose = () => { ro.disconnect(); paintState = null; };
}

// ─────────────────────────────────────────────────────────────────
// Toolbox, palette, options bar
// ─────────────────────────────────────────────────────────────────

// Tool glyphs are text, not art. Eleven more 32x32 PNGs would be eleven more
// things to keep consistent with a set drawn by hand, and at 26px in a bevelled
// button a glyph reads fine. The OS's own icon set stays for the window and the
// desktop, where it is doing real work.
const PAINT_TOOL_GLYPHS = {
  pencil: '✎', line: '╱', rect: '▭', oval: '◯',
  fill: '◧', eyedropper: '⚗', text: 'A', sticker: '☺',
  wacky: '❀', eraser: '◻', select: '✥',
};
function paintToolGlyph(toolId) { return PAINT_TOOL_GLYPHS[toolId] || '?'; }

function paintRenderTools() {
  const host = document.getElementById('paint-tools');
  if (!host) return;
  host.innerHTML = '';
  paintTools().forEach(tool => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paint-tool';
    b.dataset.tool = tool.id;
    b.title = tool.label;
    b.setAttribute('aria-label', tool.label);
    b.textContent = paintToolGlyph(tool.id);
    b.addEventListener('click', () => paintSelectTool(tool.id));
    host.appendChild(b);
  });
  paintSyncToolButtons();
}

function paintSyncToolButtons() {
  document.querySelectorAll('.paint-tool').forEach(b => {
    b.classList.toggle('sel', b.dataset.tool === paintState.tool);
  });
}

function paintRenderPalette() {
  const host = document.getElementById('paint-palette');
  if (!host) return;
  host.innerHTML = '';
  paintPalette().forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paint-swatch';
    b.dataset.hex = c.hex;
    b.style.background = c.hex;
    b.title = c.id;
    b.setAttribute('aria-label', c.id);
    b.addEventListener('click', () => { paintSetColor(c.hex); paintSound('paint-palette'); });
    host.appendChild(b);
  });
  paintSyncPalette();
}

function paintSyncPalette() {
  document.querySelectorAll('.paint-swatch').forEach(b => {
    b.classList.toggle('sel', b.dataset.hex === paintState.color);
  });
}

// The options bar draws each variant by RUNNING IT. A hand-drawn icon per
// variant would be 40-odd more pieces of art to keep in step with behaviour
// that is still being tuned, and the first thing to go stale. This cannot: the
// button art is the brush's actual output on a 22x22 canvas.
function paintRenderOptionsBar() {
  const host = document.getElementById('paint-options');
  if (!host) return;
  host.innerHTML = '';
  const variants = paintVariantsFor(paintState.tool);
  variants.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paint-opt';
    b.dataset.variant = v.id;
    b.title = v.label;
    b.setAttribute('aria-label', v.label);
    b.appendChild(paintVariantPreview(paintState.tool, v.id));
    b.addEventListener('click', () => paintSelectVariant(v.id));
    host.appendChild(b);
  });
  paintRenderStickerPager(host);
  paintSyncOptionButtons();
}

function paintSyncOptionButtons() {
  document.querySelectorAll('.paint-opt').forEach(b => {
    b.classList.toggle('sel', b.dataset.variant === paintState.variant);
  });
}

// ── sticker picker ───────────────────────────────────────────────
// The picker lives IN the options bar, beside the size variants, because that
// is where the reference puts it and because a sticker's identity is a variant
// of the sticker tool in every way that matters.
function paintSetStickerPage(n) {
  const pages = paintStickerPages();
  // Wrapping rather than clamping: eight pages of stamps is a carousel, and a
  // dead arrow at either end is a button that looks broken.
  paintState.stickerPage = ((n % pages) + pages) % pages;
  paintRenderOptionsBar();
}

function paintRenderStickerPager(host) {
  if (paintState.tool !== 'sticker') return;
  const perPage = paintStickerPerPage();
  const base = paintState.stickerPage * perPage;

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'paint-pager paint-pager-prev';
  prev.textContent = '◄';
  prev.title = 'Previous page of stickers';
  prev.setAttribute('aria-label', 'Previous page of stickers');
  prev.addEventListener('click', () => paintSetStickerPage(paintState.stickerPage - 1));
  host.appendChild(prev);

  for (let i = 0; i < perPage; i++) {
    const idx = base + i;
    const rect = paintStickerRect(idx);
    if (!rect) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paint-sticker' + (idx === paintState.stickerIndex ? ' sel' : '');
    b.dataset.idx = String(idx);
    b.title = 'Sticker ' + (idx + 1);
    b.setAttribute('aria-label', 'Sticker ' + (idx + 1));
    b.style.backgroundImage = 'url("os/sprites/paint-stickers.png")';
    b.style.backgroundPosition = (-rect.sx) + 'px ' + (-rect.sy) + 'px';
    b.addEventListener('click', () => {
      paintState.stickerIndex = idx;
      paintSound('paint-stamp');
      document.querySelectorAll('.paint-sticker').forEach(el =>
        el.classList.toggle('sel', Number(el.dataset.idx) === idx));
    });
    host.appendChild(b);
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'paint-pager paint-pager-next';
  next.textContent = '►';
  next.title = 'Next page of stickers';
  next.setAttribute('aria-label', 'Next page of stickers');
  next.addEventListener('click', () => paintSetStickerPage(paintState.stickerPage + 1));
  host.appendChild(next);
}

// A fixed seed, so a preview is stable across rebuilds of the bar - a splatter
// button that reshuffles every time you change tool reads as a glitch.
const PAINT_PREVIEW_SEED = 20260902;

// Sticker preview sizes, in a 22px button. NOT the real stamp sizes (20/32/52)
// - two of those overflow the button. These keep the same ordering so the three
// buttons still read as small / medium / large at a glance.
const PAINT_STICKER_PREVIEW_SIZES = { small: 11, medium: 16, large: 21 };

function paintVariantPreview(toolId, variantId) {
  const size = 22;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  // A diagonal drag across the button, which is enough of a stroke for every
  // generator to show its character.
  const seg = { x0: 3, y0: size - 3, x1: size - 3, y1: 3, index: 0 };
  const st = {
    color: paintState ? paintState.color : '#000000',
    size: paintSizeForVariant(variantId),
    rng: paintRng(PAINT_PREVIEW_SEED),
    points: [{ x: seg.x0, y: seg.y0 }],
    stickerIndex: paintState ? paintState.stickerIndex : 0,
  };
  // An eraser previews against ink, or it previews nothing at all: white on
  // white is an empty button.
  if (toolId === 'eraser') {
    g.fillStyle = paintState ? paintState.color : '#000000';
    g.fillRect(0, 0, size, size);
  }
  // A stamp has no stroke to show, so the diagonal above is the wrong question
  // to ask it. The sticker generator stamps at the START of that drag, which
  // lands the sprite on (3, 19) - the bottom-left corner - and 'large' stamps
  // at 52px, so most of it falls outside a 22px button entirely. Preview the
  // stamp itself instead: one sprite, centred, scaled so the three sizes still
  // read as visibly different from each other.
  if (toolId === 'sticker') {
    const half = size / 2;
    paintExecOps(g, [{ op: 'sprite', idx: st.stickerIndex, x: half, y: half,
                       size: PAINT_STICKER_PREVIEW_SIZES[variantId] || 16, rot: 0 }]);
    return c;
  }
  paintExecOps(g, paintGenerate(toolId, variantId, seg, st));
  return c;
}

// ─────────────────────────────────────────────────────────────────
// Menus, keyboard, and the Undo Guy
// ─────────────────────────────────────────────────────────────────

function paintClearCanvas() {
  const s = paintState;
  s.ctx.fillStyle = '#ffffff';
  s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
}

function paintNewCanvas() {
  const s = paintState;
  const go = () => {
    paintClearCanvas();
    s.ring = paintUndoInit(PAINT_UNDO_STEPS);
    paintUndoPush(s.ring, paintSnapshot());
    s.dirty = false;
    s.file = null;
    setWinTitle(PAINT_WIN_ID, 'untitled.png - Paint');
    paintSound('paint-clear');
  };
  // Only ask when there is something to lose. A confirm on an untouched canvas
  // is a dialog that teaches people to click through dialogs.
  if (!s.dirty) { go(); return; }
  osConfirm('Start a new painting? The current one has not been saved.',
            'New Painting', ok => { if (ok) go(); }, 'icon:warning');
}

function paintBuildMenu(mb) {
  mb.innerHTML = '';
  const menus = [
    { label: 'File', items: () => [
      { label: 'New', action: paintNewCanvas },
      { label: 'Open…', action: paintOpenDialog },
      '-',
      { label: 'Save  Ctrl+S', action: () => paintState.file ? paintSave(paintState.file, paintState.dir) : paintSaveAs() },
      { label: 'Save As…', action: paintSaveAs },
      '-',
      { label: 'Set as Wallpaper', action: paintSetWallpaper },
      '-',
      { label: 'Close', action: () => closeWin(PAINT_WIN_ID) },
    ]},
    { label: 'Edit', items: () => [
      { label: 'Undo  Ctrl+Z', action: paintUndo },
      { label: 'Redo  Ctrl+Y', action: paintRedo },
      '-',
      { label: 'Clear Canvas', action: () => { paintClearCanvas(); paintCommitUndo(); paintSound('paint-clear'); } },
    ]},
    // Populated by Task 17. An empty Goodies menu would be a dead item, so it
    // carries its one honest entry until then.
    { label: 'Goodies', items: () => paintGoodiesItems() },
  ];
  menus.forEach(m => {
    const span = document.createElement('span');
    span.className = 'menu-item';
    span.textContent = m.label;
    // Rebuilt per open rather than captured: Task 8 adds a Save whose label
    // depends on whether the painting has a file yet.
    span.addEventListener('click', e => { e.stopPropagation(); showDropdown(span, m.items()); });
    mb.appendChild(span);
  });

  const help = document.createElement('button');
  help.className = 'ms-help-btn';
  help.type = 'button';
  help.title = 'Help and credits';
  help.setAttribute('aria-label', 'Help and credits');
  help.innerHTML = iconMarkup('icon:help');
  help.addEventListener('click', e => { e.stopPropagation(); paintOpenHelp(); });
  mb.appendChild(help);
}

// Replaced wholesale by Task 17.
function paintGoodiesItems() {
  return [{ label: 'Nothing here yet', disabled: true, action: () => {} }];
}

function paintOpenHelp() {
  const id = 'paint-help';
  const p = { x: Math.max(20, Math.floor(window.innerWidth / 2) - 190),
              y: Math.max(20, Math.floor(window.innerHeight / 2) - 195) };
  if (!mkWin({ id, title: 'Paint Help', icon: 'icon:help', w: 380, h: 390,
               x: p.x, y: p.y, menubar: false, statusbar: false, popup: true })) return;
  const body = document.getElementById('wb-' + id);
  body.className = 'win-body ms-help';
  body.innerHTML = `
    <div class="ms-help-scroll">
      <h3>How to paint</h3>
      <p>Pick a tool down the left, pick a version of it along the bottom, pick
         a colour, then drag on the canvas.</p>
      <p><b>Ctrl+Z</b> undoes and <b>Ctrl+Y</b> redoes, up to twenty steps back.
         <b>Ctrl+S</b> saves into C:\sleepOS\PICTURES.</p>
      <h3>Credits</h3>
      <p>The stickers are Br&oslash;derbund <i>Kid Pix</i> stamps. A tribute,
         not the original.</p>
    </div>
    <div class="dlg-btns"><button class="dlg-btn primary" id="${id}-ok">OK</button></div>`;
  const ok = document.getElementById(id + '-ok');
  ok.addEventListener('click', () => closeWin(id));
  procSetTimeout(id, () => ok.focus(), 40);
}

// ─────────────────────────────────────────────────────────────────
// Saving
// ─────────────────────────────────────────────────────────────────
// A painting is a real PNG blob in the VFS, which is what lets it show up in
// Explorer, open in the image viewer, and become the wallpaper. Blob bytes go
// through the same vfsWriteBlob -> commit path as an uploaded file; nothing
// here is a special case.

function paintCanvasBlob() {
  return new Promise(resolve => paintState.canvas.toBlob(resolve, 'image/png'));
}

// One implementation for Save and Save As, for the reason apps/notepad.js
// states about its own pair: two near-duplicates is how a try/catch gets added
// to one and forgotten on the other.
//
// The title bar and the dirty flag are updated ONLY on success. Reporting a
// save that did not happen is precisely the failure this shape exists to kill -
// notepad's writeAndSync was written after exactly that bug.
async function paintWriteAndSync(fname, dir) {
  const blob = await paintCanvasBlob();
  if (!blob) {
    osAlert('The canvas could not be encoded.', 'Cannot Save', 'icon:error');
    return false;
  }
  const url = URL.createObjectURL(blob);
  let saved;
  try {
    saved = await vfsWriteBlob(fname, { url, kind: 'image', size: blob.size, mime: 'image/png' }, dir);
  } catch (err) {
    // Nothing else holds this URL once the tree entry was refused, so release
    // it rather than leaking it for the rest of the session - same shape as
    // handleFileUpload's own catch in os/media.js.
    URL.revokeObjectURL(url);
    if (err.code === 'ENOSPC') {
      osAlert('Not enough space to save this painting.\nDelete something and try again.', 'Disk Full', 'icon:error');
    } else if (err.code === 'EACCES') {
      osAlert('Storage is unavailable, so this painting cannot be saved.', 'Cannot Save', 'icon:error');
    } else if (err.code === 'EEXIST') {
      osAlert('A text file already uses that name.', 'Cannot Save', 'icon:error');
    } else {
      osAlert('Could not save: ' + err.message, 'Cannot Save', 'icon:error');
    }
    return false;
  }
  paintState.file = saved.fileName;
  paintState.dir = saved.dirName;
  paintState.dirty = false;
  setWinTitle(PAINT_WIN_ID, saved.fileName + ' - Paint');
  const ws = document.getElementById('ws-' + PAINT_WIN_ID);
  if (ws) ws.textContent = 'Saved to C:\\sleepOS\\' + (saved.dirName ? saved.dirName + '\\' : '') + saved.fileName;
  return true;
}

// Every caller is a menu action or a key handler, none of which can await.
// paintWriteAndSync reports its own failures; this catch only stops an
// unexpected throw from becoming an unhandled rejection.
function paintSave(fname, dir) {
  paintWriteAndSync(fname, dir).catch(err => reportVfsError(err));
}

function paintSaveAs() {
  openSaveDialog(paintState.file || 'untitled.png', (fname, dir) => paintSave(fname, dir),
                 { startDir: paintState.dir });
}

// ─────────────────────────────────────────────────────────────────
// Opening
// ─────────────────────────────────────────────────────────────────

// Draws an image onto the fixed canvas, scaled down to fit and letterboxed on
// white. Smoothing is ON for this one draw and off again straight after: a
// photograph downscaled with nearest-neighbour is mush, while every stroke made
// afterwards still has to land on the hard pixel grid.
function paintDrawImageFitted(img) {
  const s = paintState;
  paintClearCanvas();
  const scale = Math.min(s.canvas.width / img.width, s.canvas.height / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const x = Math.floor((s.canvas.width - w) / 2);
  const y = Math.floor((s.canvas.height - h) / 2);
  s.ctx.imageSmoothingEnabled = scale < 1;
  s.ctx.drawImage(img, x, y, w, h);
  s.ctx.imageSmoothingEnabled = false;
}

function paintLoadImage(name, dir) {
  const st = vfsStatSync(name, dir);
  const blob = st && st.kind === 'blob' ? st.blob : null;
  if (!blob || blob.kind !== 'image') {
    osAlert('That is not an image file:\n' + name, 'Cannot Open', 'icon:error');
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      paintDrawImageFitted(img);
      const s = paintState;
      s.file = st.name;
      s.dir = st.dirName;
      s.dirty = false;
      // A fresh ring, not a push. Undoing back to the blank canvas you happened
      // to have open before loading somebody's photo is not an undo of anything
      // the painter did.
      s.ring = paintUndoInit(PAINT_UNDO_STEPS);
      paintUndoPush(s.ring, paintSnapshot());
      setWinTitle(PAINT_WIN_ID, st.name + ' - Paint');
      resolve(true);
    };
    img.onerror = () => {
      osAlert('That image could not be read.', 'Cannot Open', 'icon:error');
      resolve(false);
    };
    img.src = blob.url;
  });
}

function paintOpenDialog() {
  openSaveDialog(paintState.file || '', (fname, dir) => { paintLoadImage(fname, dir); },
                 { mode: 'open', kinds: ['blob'], title: 'Open Picture', startDir: paintState.dir });
}

// Wallpaper resolves a VFS path, so there must be a real file first. Saving
// before applying is not a shortcut - applyWallpaper has nothing to resolve
// otherwise and would silently fall back to the colour.
function paintSetWallpaper() {
  const apply = () => {
    const path = (paintState.dir ? paintState.dir + '\\' : '') + paintState.file;
    applyWallpaper(path);
  };
  if (paintState.file && !paintState.dirty) { apply(); return; }
  openSaveDialog(paintState.file || 'wallpaper.png', (fname, dir) => {
    paintWriteAndSync(fname, dir).then(ok => { if (ok) apply(); }).catch(err => reportVfsError(err));
  });
}

// The entry point FILE_HANDLERS and Explorer's Edit item both use: open the
// window if it is not up, then load the file into it.
function openPaintFile(name, dir) {
  if (!paintState) openPaint();
  if (!name) return;
  // openPaint's own setup runs synchronously, so paintState is live by here.
  paintLoadImage(name, dir);
}
