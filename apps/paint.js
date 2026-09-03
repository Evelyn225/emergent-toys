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

// Filled in by Task 11, once the atlas exists. Declared here so the renderer's
// sprite case is not a forward reference to nothing.
function paintDrawSticker(ctx, op) { /* Task 11 */ }

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
  // One rng per stroke, seeded once, so a stroke is reproducible end to end
  // rather than drifting with whatever else asked for a random number.
  s.strokeSeed = (Math.random() * 0xffffffff) >>> 0;
  s.rng = paintRng(s.strokeSeed);
  s.points = [{ x: pos.x, y: pos.y }];
  s.segIndex = 0;
  s.drawing = true;
  paintDrawSegment(pos.x, pos.y, pos.x, pos.y);
}

function paintExtendStroke(pos) {
  const s = paintState;
  if (!s.drawing) return;
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
  paintCommitUndo();
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
// button art is the brush's actual output on a 24x24 canvas.
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
  if (typeof paintRenderStickerPager === 'function') paintRenderStickerPager(host);
  paintSyncOptionButtons();
}

function paintSyncOptionButtons() {
  document.querySelectorAll('.paint-opt').forEach(b => {
    b.classList.toggle('sel', b.dataset.variant === paintState.variant);
  });
}

// A fixed seed, so a preview is stable across rebuilds of the bar - a splatter
// button that reshuffles every time you change tool reads as a glitch.
const PAINT_PREVIEW_SEED = 20260902;

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
  paintExecOps(g, paintGenerate(toolId, variantId, seg, st));
  return c;
}
