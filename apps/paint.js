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
    // so those previews stop being permanently blank. This is not just the
    // sticker tool's problem: wacky/scatter also emits sprite ops, so any
    // tool's bar can be showing a blank sprite preview when this fires.
    // Redraw unconditionally rather than re-narrowing to a tool list that the
    // next sprite-emitting brush would only have to widen again. Guard on
    // paintState: it goes null when the window closes, and
    // paintRenderOptionsBar dereferences paintState.tool without a null
    // check of its own.
    paintStickerImg.onload = () => {
      if (paintState) paintRenderOptionsBar();
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
  paintDropSelection();
  return true;
}
function paintRedo() {
  const snap = paintUndoRedo(paintState.ring);
  if (!snap) return false;
  paintRestore(snap);
  paintDropSelection();
  return true;
}

// ── selection lifecycle ─────────────────────────────────────────
// sel.base is a snapshot of the canvas taken BEFORE the marquee was drawn onto
// it. Anything that replaces the canvas wholesale - undo, redo, Clear Canvas, a
// fresh canvas, loading a photo, a Goodie - makes that snapshot describe pixels
// that are gone. There are two correct responses, and conflating them is the
// bug this pair of helpers exists to prevent:
function paintDropSelection() {
  // The canvas was just replaced out from under sel.base. Restoring it here
  // would paint the OLD picture back over the NEW one - that IS the bug.
  // Just forget the selection ever happened.
  if (paintState) paintState.sel = null;
}
function paintFlattenSelection() {
  // About to read the live canvas, or overwrite it wholesale, and the marquee
  // must not be part of that. Restore the clean pixels first so the read never
  // sees it, then drop - base no longer describes anything once this returns.
  const s = paintState;
  if (!s) return;
  if (s.sel) { if (s.sel.base) paintRestore(s.sel.base); s.sel = null; }
}

// ── tool selection ───────────────────────────────────────────────
// Exposed as functions rather than inline handlers so the browser tests can
// drive the app the way a user would, without synthesising clicks on chrome
// that Task 6 has not built yet.
function paintSelectTool(toolId) {
  if (!paintState) return;
  const variants = paintVariantsFor(toolId);
  // A marquee belongs to the move tool. Leaving it drawn under the pencil is a
  // dashed rectangle nobody can get rid of.
  paintFlattenSelection();
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
  // Every option button draws itself in the current colour, so a colour change
  // that only repainted the palette left a row of buttons still showing the old
  // one. Rebuilding the bar is what makes "the button shows what the tool does"
  // true of the colour as well as the shape.
  paintRenderOptionsBar();
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
  // Fill and the eyedropper read the canvas and finish in one click; text
  // needs a string rather than a drag; a whole-image eraser reads the canvas
  // and destroys it in one go. None of the four enter the stroke machinery
  // below at all.
  if (s.tool === 'fill')       { paintDoFill(pos); return; }
  if (s.tool === 'eyedropper') { paintDoEyedropper(pos); return; }
  if (s.tool === 'text')       { paintDoText(pos); return; }
  if (s.tool === 'eraser' && PAINT_WHOLE_ERASERS[s.variant]) { paintDoWholeEraser(pos); return; }
  if (s.tool === 'select')     { paintSelectBegin(pos); s.drawing = true; s.selecting = true; return; }
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
  if (s.selecting) { paintSelectDrag(pos); return; }
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
  if (s.selecting) { s.selecting = false; s.drawing = false; paintSelectEnd(); return; }
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
  // Sized so the sticker row and the Undo Guy are BOTH visible without
  // scrolling, which 620 was not: the bottom bar has to fit a 189px palette,
  // an options bar that reaches ~620px on the sticker tool (14 thumbnails at
  // 36px plus three size buttons and two page arrows), and a 38px undo button.
  // That is ~860px of content, plus a 60px tool column.
  if (!mkWin({ id: PAINT_WIN_ID, title: 'untitled.png - Paint', icon: 'icon:paint',
               w: 900, h: 580, menubar: true, statusbar: true })) return;

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
    sel: null,
    selecting: false,
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

  // On the window rather than the document, so PAINT cannot eat Ctrl+Z from
  // another app or from a dialog.
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

// Derives a per-variant seed from the shared base seed. Two variants of the
// same tool can roll the exact same stochastic branch off one shared seed -
// wacky's drips and leaky both draw nothing but their base line under
// PAINT_PREVIEW_SEED, since neither one's occasional extra happened to fire,
// and the two buttons read as duplicates. Hashing the tool/variant id into the
// seed gives every button its own deterministic-but-different roll instead.
function paintPreviewSeed(toolId, variantId) {
  const s = toolId + ':' + variantId;
  let h = PAINT_PREVIEW_SEED;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  // A plain running hash lands adjacent variant ids on adjacent seeds, and
  // paintRng's first output is continuous in its seed - two adjacent seeds
  // roll almost the same first float, which is exactly the drips/leaky
  // failure mode this function exists to avoid. Run the combined hash through
  // a standard integer finalizer (avalanche) so nearby ids land on
  // well-separated seeds instead.
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

// Sticker preview sizes, in a 22px button. NOT the real stamp sizes (16/32/64)
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
    rng: paintRng(paintPreviewSeed(toolId, variantId)),
    // Three points along the diagonal, not just the one endpoint - wacky's
    // connect needs at least two prior points before it draws any chords, and
    // one point left its preview showing nothing but a lone dot.
    points: [
      { x: seg.x0, y: seg.y0 },
      { x: seg.x0 + (seg.x1 - seg.x0) / 3, y: seg.y0 + (seg.y1 - seg.y0) / 3 },
      { x: seg.x0 + (seg.x1 - seg.x0) * 2 / 3, y: seg.y0 + (seg.y1 - seg.y0) * 2 / 3 },
    ],
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
    paintDropSelection();
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
      { label: 'Clear Canvas', action: () => { paintFlattenSelection(); paintClearCanvas(); paintCommitUndo(); paintSound('paint-clear'); } },
    ]},
    // Whole-image operations - flip, invert, darken/lighten, posterize,
    // scramble, edges. Rebuilt per open like every other menu here.
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

const PAINT_GOODIE_LABELS = {
  flipH: 'Flip Horizontal', flipV: 'Flip Vertical', invert: 'Invert Colours',
  darken: 'Darken', lighten: 'Lighten', posterize: 'Posterize',
  scramble: 'Scramble', edges: 'Find Edges',
};

function paintApplyGoodie(name) {
  const s = paintState;
  // A live marquee is real canvas pixels. Flatten before reading, or a Goodie
  // bakes the dashed border - and whatever the selection was hovering - into
  // the pixel buffer and the undo history right along with it.
  paintFlattenSelection();
  const id = s.ctx.getImageData(0, 0, s.canvas.width, s.canvas.height);
  if (!paintGoodie(name, id.data, s.canvas.width, s.canvas.height)) return;
  s.ctx.putImageData(id, 0, 0);
  s.dirty = true;
  paintCommitUndo();
}

function paintGoodiesItems() {
  return paintGoodieNames().map(name => ({
    label: PAINT_GOODIE_LABELS[name] || name,
    action: () => paintApplyGoodie(name),
  }));
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
  // An idle marquee is real canvas pixels. Flatten it before encoding, the same
  // way switching tools does, so a save taken between marking and moving never
  // carries the dashed border into the file. Synchronous and flicker-free -
  // restore-then-redraw-after would have to outlive an async toBlob callback.
  paintFlattenSelection();
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
      paintDropSelection();
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

// ─────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────
// Text does not go through paintGenerate either: it needs a string, and a
// generator's whole contract is that it depends on nothing but the segment and
// the state. Asking for the string is a modal, and a modal in a pure function
// is not a pure function.

function paintTextSize(variantId) {
  const m = /^t(\d+)$/.exec(String(variantId || ''));
  return m ? Number(m[1]) : 12;
}

// Draws a string centred on a point. w95font is the OS's own face, so text
// painted here matches the chrome around it; the fallback keeps this working if
// the font has not finished loading.
function paintDrawText(pos, text, size) {
  const s = paintState;
  s.ctx.save();
  s.ctx.imageSmoothingEnabled = false;
  s.ctx.fillStyle = s.color;
  s.ctx.font = size + 'px w95font, "Courier New", monospace';
  s.ctx.textAlign = 'center';
  s.ctx.textBaseline = 'middle';
  s.ctx.fillText(text, Math.round(pos.x), Math.round(pos.y));
  s.ctx.restore();
  s.dirty = true;
  paintCommitUndo();
}

function paintDoText(pos) {
  const s = paintState;
  const size = paintTextSize(s.variant);
  osPrompt('Type some text:', '', 'Text', value => {
    if (!value) return;
    paintDrawText(pos, value, size);
    paintSound('paint-text');
  });
}

// ─────────────────────────────────────────────────────────────────
// Whole-image erasers
// ─────────────────────────────────────────────────────────────────
// Each of these is ONE undo step, however much it destroys. That is the whole
// contract that makes them safe to be this rude.

function paintEraseHoles(holes) {
  const g = paintState.ctx;
  g.fillStyle = '#ffffff';
  holes.forEach(hole => {
    g.beginPath();
    g.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    g.fill();
  });
}

function paintApplyBlast(pos) {
  paintEraseHoles(paintBlastPattern(pos.x, pos.y, paintRng((Math.random() * 0xffffffff) >>> 0)));
  paintSound('paint-firecracker');
}

// Pulls every pixel toward the click point, leaving white behind. Read from a
// snapshot and written to a fresh buffer: sampling the canvas while writing to
// it would smear each pixel through its own already-moved neighbours.
function paintApplyBlackhole(pos) {
  const s = paintState;
  const w = s.canvas.width, h = s.canvas.height;
  const src = s.ctx.getImageData(0, 0, w, h);
  const dst = s.ctx.createImageData(w, h);
  dst.data.fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - pos.x, dy = y - pos.y;
      const d = Math.hypot(dx, dy);
      // Everything inside the event horizon is simply gone.
      if (d < 26) continue;
      const pull = Math.min(0.75, 34 / d);
      const sx = Math.round(x + dx * pull), sy = Math.round(y + dy * pull);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
      dst.data[di] = src.data[si]; dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2]; dst.data[di + 3] = 255;
    }
  }
  s.ctx.putImageData(dst, 0, 0);
  paintSound('paint-blackhole');
}

function paintApplyDissolve() {
  const s = paintState;
  const w = s.canvas.width, h = s.canvas.height;
  const id = s.ctx.getImageData(0, 0, w, h);
  const order = paintDissolveOrder(w, h, paintRng((Math.random() * 0xffffffff) >>> 0));
  // Sixty per cent, not all of it: a full dissolve is just Clear with extra
  // steps, and leaving some behind is what makes it read as decay.
  const kill = Math.floor(order.length * 0.6);
  for (let k = 0; k < kill; k++) {
    const i = order[k] * 4;
    id.data[i] = 255; id.data[i + 1] = 255; id.data[i + 2] = 255; id.data[i + 3] = 255;
  }
  s.ctx.putImageData(id, 0, 0);
  paintSound('paint-dissolve');
}

function paintApplyFade() {
  const s = paintState;
  // A single flat wash toward white, applied to the whole canvas.
  s.ctx.save();
  s.ctx.globalAlpha = 0.45;
  s.ctx.fillStyle = '#ffffff';
  s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
  s.ctx.restore();
  paintSound('paint-eraser');
}

function paintApplyBlinds() {
  const s = paintState;
  s.ctx.fillStyle = '#ffffff';
  paintBlindRows(s.canvas.height, 12).forEach(r => s.ctx.fillRect(0, r.y, s.canvas.width, r.h));
  paintSound('paint-eraser');
}

const PAINT_WHOLE_ERASERS = {
  firecracker: paintApplyBlast,
  blackhole:   paintApplyBlackhole,
  dissolve:    () => paintApplyDissolve(),
  fade:        () => paintApplyFade(),
  blinds:      () => paintApplyBlinds(),
};

function paintDoWholeEraser(pos) {
  const fn = PAINT_WHOLE_ERASERS[paintState.variant];
  if (!fn) return false;
  fn(pos);
  paintState.dirty = true;
  paintCommitUndo();
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Move
// ─────────────────────────────────────────────────────────────────
// Two gestures, not one: the first drag MARKS a rectangle, the second MOVES it.
// A single drag that both selects and moves cannot express "I want this exact
// box", and every paint program that has tried it is annoying to use.
//
// Only the move pushes an undo state. Marking a rectangle changes no pixels, so
// an undo step for it would be an undo that appears to do nothing.

function paintSelectBegin(pos) {
  const s = paintState;
  const sel = s.sel;
  // Inside an existing marquee: this drag moves it.
  if (sel && sel.w > 0 && pos.x >= sel.x && pos.x <= sel.x + sel.w
                       && pos.y >= sel.y && pos.y <= sel.y + sel.h) {
    sel.phase = 'moving';
    sel.grabX = pos.x - sel.x;
    sel.grabY = pos.y - sel.y;
    // The dashed marquee was drawn onto these exact pixels, so wipe it back to
    // the clean copy first - otherwise the lift below carries the border along
    // as part of the moved image.
    paintRestore(sel.base);
    // Lift the pixels, then white out where they came from, and remember the
    // result as the base every preview frame draws onto.
    sel.data = s.ctx.getImageData(sel.x, sel.y, sel.w, sel.h);
    s.ctx.fillStyle = '#ffffff';
    s.ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
    sel.base = paintSnapshot();
    return;
  }
  // Starting fresh outside any existing marquee: wipe whatever was left
  // resting on the canvas from a previous mark first. Snapshotting before
  // that restore would bake the old marquee into the new "clean" base, and
  // every later restore would reproduce it.
  if (sel && sel.base) paintRestore(sel.base);
  s.sel = { phase: 'marking', x0: pos.x, y0: pos.y, x: pos.x, y: pos.y, w: 0, h: 0,
            data: null, base: paintSnapshot() };
}

function paintSelectDrag(pos) {
  const s = paintState;
  const sel = s.sel;
  if (!sel) return;
  if (sel.phase === 'marking') {
    sel.x = Math.min(sel.x0, pos.x);
    sel.y = Math.min(sel.y0, pos.y);
    sel.w = Math.abs(pos.x - sel.x0);
    sel.h = Math.abs(pos.y - sel.y0);
    paintDrawMarquee();
    return;
  }
  // Moving: restore the vacated canvas, then draw the lifted pixels at the
  // pointer. Compositing onto the live canvas instead would smear a trail.
  paintRestore(sel.base);
  sel.x = Math.round(pos.x - sel.grabX);
  sel.y = Math.round(pos.y - sel.grabY);
  s.ctx.putImageData(sel.data, sel.x, sel.y);
}

function paintSelectEnd() {
  const s = paintState;
  const sel = s.sel;
  if (!sel) return;
  if (sel.phase === 'marking') {
    // A marquee is not a pixel change, so no undo state and no dirty flag. A
    // near-zero drag is discarded outright - restore first, so whatever sliver
    // of dashed marquee it drew does not stay baked onto the canvas.
    if (sel.w < 2 || sel.h < 2) { paintRestore(sel.base); s.sel = null; }
    return;
  }
  sel.phase = 'idle';
  sel.data = null;
  sel.base = null;
  s.dirty = true;
  paintCommitUndo();
}

// The marquee is drawn onto the canvas over a restored copy, so it never gets
// baked in - the next restore wipes it. A separate overlay element would be
// cleaner but would have to track the display scale, and this cannot drift.
function paintDrawMarquee() {
  const s = paintState;
  const sel = s.sel;
  paintRestore(sel.base);
  s.ctx.save();
  s.ctx.strokeStyle = '#000000';
  s.ctx.lineWidth = 1;
  s.ctx.setLineDash([4, 4]);
  s.ctx.strokeRect(Math.round(sel.x) + 0.5, Math.round(sel.y) + 0.5, Math.round(sel.w), Math.round(sel.h));
  s.ctx.restore();
}
