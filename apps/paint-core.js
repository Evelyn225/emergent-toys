// -----------------------------------------------------------------
// PAINT.exe - pure core
// -----------------------------------------------------------------
// No DOM, no canvas, no globals. Everything a brush does is a function from a
// stroke segment to a list of plain-data draw ops, so `npm test` can prove it
// in node - the same split apps/minesweeper.js and os/wm.js use, and for the
// same reason: the interesting mistakes here are logic, and a screenshot of a
// wacky brush cannot tell you whether it is wrong.
//
// Everything the tests reach is a `function` declaration on purpose.
// test/helpers/load-os.cjs loads sources into a node:vm, where `const` and
// `let` do NOT become context properties. Tables are therefore exposed through
// accessor functions rather than as bare consts.

// The canvas is fixed. A saved painting has to mean the same thing on every
// machine, and a surface that resizes with the window must either crop the art
// or throw it away. KidPix never did that either. 480x360 is 4:3 at
// three-quarters of KidPix's 640x480, chosen so 2x (960x720) still fits a
// maximised window on a normal laptop.
const PAINT_W = 480;
const PAINT_H = 360;

function paintCanvasWidth()  { return PAINT_W; }
function paintCanvasHeight() { return PAINT_H; }

// Integer scaling keeps every canvas pixel square, which is the whole look.
// The one exception is a viewport too narrow for even 1x - a phone - where the
// alternative is scrolling a painting, and a pixelated downscale of pixel art
// is the lesser evil.
function paintDisplayScale(availW, availH) {
  const fit = Math.min(availW / PAINT_W, availH / PAINT_H);
  if (fit >= 1) return Math.floor(fit);
  return fit > 0 ? fit : 1;
}

function paintHsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function paintRgbToHex(r, g, b) {
  const two = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + two(r) + two(g) + two(b);
}

// 28 colours, derived rather than invented so they cannot drift: black, white
// and four greys, then two rings of eleven hues evenly spaced round the wheel -
// one bright and saturated, one darker. Flat, high-saturation and low-count is
// what makes a painting read as 8-bit era rather than as a modern gradient.
function paintBuildPalette() {
  const out = [
    { id: 'black',  hex: '#000000' },
    { id: 'grey1',  hex: '#404040' },
    { id: 'grey2',  hex: '#808080' },
    { id: 'grey3',  hex: '#c0c0c0' },
    { id: 'grey4',  hex: '#e0e0e0' },
    { id: 'white',  hex: '#ffffff' },
  ];
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < 11; i++) {
      const rgb = paintHsvToRgb((i * 360) / 11, 1, ring === 0 ? 1 : 0.58);
      out.push({ id: 'hue' + ring + '-' + i, hex: paintRgbToHex(rgb[0], rgb[1], rgb[2]) });
    }
  }
  return out;
}

const PAINT_PALETTE = paintBuildPalette();
function paintPalette() { return PAINT_PALETTE.slice(); }

// Tool order is the left column, read top to bottom, two icons wide.
const PAINT_TOOLS = [
  { id: 'pencil',     label: 'Pencil' },
  { id: 'line',       label: 'Line' },
  { id: 'rect',       label: 'Rectangle' },
  { id: 'oval',       label: 'Oval' },
  { id: 'fill',       label: 'Fill' },
  { id: 'eyedropper', label: 'Eyedropper' },
  { id: 'text',       label: 'Text' },
  { id: 'sticker',    label: 'Stickers' },
  { id: 'wacky',      label: 'Wacky Brush' },
  { id: 'eraser',     label: 'Eraser' },
  { id: 'select',     label: 'Move' },
];
function paintTools() { return PAINT_TOOLS.slice(); }

const PAINT_VARIANTS = {
  pencil: [
    { id: 'p1', label: 'Fine' },
    { id: 'p2', label: 'Small' },
    { id: 'p3', label: 'Medium' },
    { id: 'p5', label: 'Fat' },
    { id: 'dotted', label: 'Dotted' },
    { id: 'sketchy', label: 'Sketchy' },
  ],
  line: [
    { id: 'l1', label: 'Thin' },
    { id: 'l3', label: 'Medium' },
    { id: 'l6', label: 'Thick' },
    { id: 'dashed', label: 'Dashed' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'wiggly', label: 'Wiggly' },
  ],
  rect:   [{ id: 'outline', label: 'Outline' }, { id: 'filled', label: 'Filled' }, { id: 'round', label: 'Rounded' }],
  oval:   [{ id: 'outline', label: 'Outline' }, { id: 'filled', label: 'Filled' }],
  fill: [
    { id: 'solid',    label: 'Solid' },
    { id: 'gradient', label: 'Gradient' },
    { id: 'check',    label: 'Checks' },
    { id: 'stripe',   label: 'Stripes' },
    { id: 'diag',     label: 'Diagonals' },
    { id: 'dots',     label: 'Dots' },
    { id: 'grid',     label: 'Grid' },
    { id: 'noise',    label: 'Static' },
    { id: 'confetti', label: 'Confetti' },
  ],
  eyedropper: [],
  text: [
    { id: 't8',  label: 'Small' },
    { id: 't12', label: 'Medium' },
    { id: 't20', label: 'Large' },
  ],
  sticker: [
    { id: 'small',  label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large',  label: 'Large' },
  ],
  wacky: [
    { id: 'spray',    label: 'Spray Can' },
    { id: 'echo',     label: 'Echo' },
    { id: 'kaleido',  label: 'Kaleidoscope' },
    { id: 'spiral',   label: 'Spiral' },
    { id: 'tree',     label: 'Tree' },
    { id: 'drips',    label: 'Drips' },
    { id: 'bubbles',  label: 'Bubbles' },
    { id: 'rainbow',  label: 'Rainbow Ribbon' },
    { id: 'scatter',  label: 'Sticker Scatter' },
    { id: 'connect',  label: 'Connect the Dots' },
    { id: 'fuzzy',    label: 'Fuzzy' },
    { id: 'stars',    label: 'Stars' },
    { id: 'splatter', label: 'Splatter' },
    { id: 'beads',    label: 'Beads' },
    { id: 'leaky',    label: 'Leaky Pen' },
  ],
  eraser: [
    { id: 'e4',          label: 'Small' },
    { id: 'e10',         label: 'Medium' },
    { id: 'e24',         label: 'Fat' },
    { id: 'firecracker', label: 'Firecracker' },
    { id: 'blackhole',   label: 'Black Hole' },
    { id: 'melt',        label: 'Drips' },
    { id: 'dissolve',    label: 'Dissolve' },
    { id: 'fade',        label: 'Fade Away' },
    { id: 'blinds',      label: 'Blinds' },
  ],
  select: [{ id: 'move', label: 'Move' }],
};
function paintVariantsFor(toolId) {
  const v = PAINT_VARIANTS[toolId];
  return v ? v.slice() : [];
}

// Mulberry32. Small, fast, and good enough that a splatter looks random - but
// the point is that it is SEEDED, so every generator below is deterministic and
// a test can assert exact output. Same motive as msSeed's injectable rng.
function paintRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------
// Undo ring
// -----------------------------------------------------------------
// `index` is the position of the CURRENT state, not the next free slot, so
// undo is a decrement and redo an increment and neither needs a special case
// for "have we drawn anything yet". -1 means empty.
//
// Snapshots are opaque here: the UI pushes ImageData, the tests push strings.
// Keeping the core ignorant of what a snapshot IS is what lets this be tested
// in node with no canvas.
function paintUndoInit(capacity) {
  const cap = Math.max(1, Math.floor(Number(capacity) || 1));
  return { cap, items: [], index: -1 };
}

function paintUndoPush(ring, snapshot) {
  // A push after an undo abandons the redo branch. Keeping it would let redo
  // jump to a state that never followed from what is now on the canvas.
  if (ring.index < ring.items.length - 1) ring.items.length = ring.index + 1;
  ring.items.push(snapshot);
  // Drop from the front rather than refusing the push: the newest work is
  // always worth more than the oldest undo step.
  while (ring.items.length > ring.cap) ring.items.shift();
  ring.index = ring.items.length - 1;
  return ring;
}

function paintUndoUndo(ring) {
  if (ring.index <= 0) return null;
  ring.index--;
  return ring.items[ring.index];
}

function paintUndoRedo(ring) {
  if (ring.index >= ring.items.length - 1) return null;
  ring.index++;
  return ring.items[ring.index];
}

// -----------------------------------------------------------------
// Flood fill
// -----------------------------------------------------------------
// Scanline fill over a raw RGBA buffer - exactly what ctx.getImageData().data
// hands back, so the UI passes it straight through with no conversion.
//
// Two decisions that are easy to get wrong and invisible once they are:
//
// 4-CONNECTED, not 8. Two regions that touch only at a corner are two regions
// to anyone looking at the picture. An 8-connected fill leaks between them, and
// on a real drawing that reads as the fill "escaping" through a line the artist
// can see is closed.
//
// SCANLINE RUN-BASED SEEDING, not per-pixel recursion. A per-pixel stack on a
// 480x360 canvas can hold 172,800 entries; the scanline form detects runs in
// neighbour rows and pushes one entry per contiguous run, which keeps stack
// depth bounded and a whole-canvas fill fast.
function paintFloodFill(pixels, w, h, x, y, rgba, tolerance) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const tol = Math.max(0, Number(tolerance) || 0);
  const at = (px, py) => (py * w + px) * 4;

  const start = at(x, y);
  const sr = pixels[start], sg = pixels[start + 1], sb = pixels[start + 2], sa = pixels[start + 3];
  const [nr, ng, nb, na] = rgba;

  // Without this the fill would repaint the region it is standing on, find every
  // pixel already matching, and walk forever on a tolerance that lets the new
  // colour match the old one.
  if (sr === nr && sg === ng && sb === nb && sa === na) return 0;

  const matches = i => Math.abs(pixels[i] - sr) <= tol
                    && Math.abs(pixels[i + 1] - sg) <= tol
                    && Math.abs(pixels[i + 2] - sb) <= tol
                    && Math.abs(pixels[i + 3] - sa) <= tol;

  const paint = i => { pixels[i] = nr; pixels[i + 1] = ng; pixels[i + 2] = nb; pixels[i + 3] = na; };

  let filled = 0;
  const stack = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop();
    let left = px;
    while (left > 0 && matches(at(left - 1, py))) left--;
    let right = px;
    while (right < w - 1 && matches(at(right + 1, py))) right++;

    for (let i = left; i <= right; i++) {
      const idx = at(i, py);
      if (!matches(idx)) continue;
      paint(idx);
      filled++;
    }

    // Seed the rows above and below by detecting runs. For each neighbour row,
    // scan the columns directly above/below [left, right] and detect transitions
    // from non-matching to matching. Push only the start of each run, so the
    // stack holds one entry per contiguous neighbouring run.
    const seedRow = (neighborY) => {
      if (neighborY < 0 || neighborY >= h) return;
      let inRun = false;
      for (let i = left; i <= right; i++) {
        const idx = at(i, neighborY);
        if (matches(idx)) {
          if (!inRun) {
            // Start of a new run in the neighbor row
            stack.push([i, neighborY]);
            inRun = true;
          }
        } else {
          inRun = false;
        }
      }
    };
    if (py > 0) seedRow(py - 1);
    if (py < h - 1) seedRow(py + 1);
  }
  return filled;
}

// ─────────────────────────────────────────────────────────────────
// Brush generators
// ─────────────────────────────────────────────────────────────────
// THE central interface. A brush is a pure function from one stroke segment to
// a list of plain-data draw ops. apps/paint.js holds a dumb switch that
// executes them; nothing in this file knows a canvas exists.
//
// Three things fall out of that, and they are the reason for the design:
//   1. Every brush is testable in node. "Given this segment and this seed,
//      expect these ops" is a real assertion; "it did not throw" is not.
//   2. Randomness is injected through st.rng, so a splatter is reproducible.
//   3. The options bar previews itself - each variant button runs its own
//      generator on a 22x22 offscreen canvas, so the button art IS the
//      behaviour and cannot go stale as variants are tuned.
//
// seg = { x0, y0, x1, y1, index }   index is the segment number within the
//                                   stroke, 0-based, for brushes with memory
// st  = { color, size, rng, points, stickerIndex }
//
// Ops:
//   { op:'dab',    x, y, r, color }        filled circle
//   { op:'line',   x0,y0,x1,y1, w, color } round-capped line
//   { op:'rect',   x, y, w, h, color }
//   { op:'sprite', idx, x, y, size, rot }  a sticker from the atlas
//   { op:'erase',  x, y, r }               clears to white
const PAINT_GENERATORS = {};

function paintGenerate(toolId, variantId, seg, st) {
  const byTool = PAINT_GENERATORS[toolId];
  if (!byTool) return [];
  const gen = byTool[variantId];
  if (!gen) return [];
  const ops = gen(seg, st);
  return Array.isArray(ops) ? ops : [];
}

// Registers one generator. Kept as a function rather than object literals so a
// tool's variants can be declared in several places - Tasks 12-16 each add
// their own group from their own section of this file, without editing a
// single growing literal.
function paintRegisterGenerator(toolId, variantId, fn) {
  if (!PAINT_GENERATORS[toolId]) PAINT_GENERATORS[toolId] = {};
  PAINT_GENERATORS[toolId][variantId] = fn;
}

// Segment length, needed by nearly every generator to decide how many dabs a
// drag deserves. Zero for a click, which is the case that must still draw.
function paintSegLen(seg) {
  return Math.hypot(seg.x1 - seg.x0, seg.y1 - seg.y0);
}

// Walks a segment at a fixed spacing, always including both ends. The `<=` and
// the explicit final point are what make a click (length 0) yield exactly one
// position rather than none.
function paintWalk(seg, spacing) {
  const len = paintSegLen(seg);
  const step = Math.max(0.5, spacing);
  const out = [];
  const n = Math.floor(len / step);
  for (let i = 0; i <= n; i++) {
    const t = len === 0 ? 0 : (i * step) / len;
    out.push({ x: seg.x0 + (seg.x1 - seg.x0) * t, y: seg.y0 + (seg.y1 - seg.y0) * t });
  }
  const last = out[out.length - 1];
  if (len > 0 && (last.x !== seg.x1 || last.y !== seg.y1)) out.push({ x: seg.x1, y: seg.y1 });
  return out;
}

// ── pencil ───────────────────────────────────────────────────────
// A line op rather than a run of dabs: one round-capped stroke is what the
// canvas draws well, and a dab chain at these widths visibly beads.
[['p1', 1], ['p2', 2], ['p3', 3], ['p5', 5]].forEach(([id, w]) => {
  paintRegisterGenerator('pencil', id, (seg, st) =>
    [{ op: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1, w, color: st.color }]);
});

paintRegisterGenerator('pencil', 'dotted', (seg, st) =>
  paintWalk(seg, Math.max(3, st.size * 2))
    .filter((_, i) => i % 2 === 0)
    .map(p => ({ op: 'dab', x: p.x, y: p.y, r: Math.max(1, st.size / 2), color: st.color })));

paintRegisterGenerator('pencil', 'sketchy', (seg, st) => {
  // Three offset passes over the same segment, the way a pencil sketch is built
  // out of repeated approximate strokes rather than one confident line.
  const ops = [];
  for (let k = 0; k < 3; k++) {
    const j = () => (st.rng() - 0.5) * 4;
    ops.push({ op: 'line', x0: seg.x0 + j(), y0: seg.y0 + j(),
               x1: seg.x1 + j(), y1: seg.y1 + j(), w: 1, color: st.color });
  }
  return ops;
});

// ─────────────────────────────────────────────────────────────────
// Sticker atlas geometry
// ─────────────────────────────────────────────────────────────────
// os/sprites/paint-stickers.png is a 448x256 sheet: 14 columns by 8 rows of
// 32x32 cells with NO gutter, so every source offset is a flat multiple of the
// cell size. The minesweeper atlas is packed the same way and for the same
// reason - a 1px gutter turns every offset into an arithmetic trap.
//
// 14 and not 15: the reference sheet's fifteenth column is the page-number
// arrow strip, which is chrome rather than a sticker.
const PAINT_STICKER_CELL = 32;
const PAINT_STICKER_COLS = 14;
const PAINT_STICKER_ROWS = 8;

function paintStickerCell()    { return PAINT_STICKER_CELL; }
function paintStickerPerPage() { return PAINT_STICKER_COLS; }
function paintStickerPages()   { return PAINT_STICKER_ROWS; }
function paintStickerCount()   { return PAINT_STICKER_COLS * PAINT_STICKER_ROWS; }

function paintStickerRect(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= paintStickerCount()) return null;
  return {
    sx: (idx % PAINT_STICKER_COLS) * PAINT_STICKER_CELL,
    sy: Math.floor(idx / PAINT_STICKER_COLS) * PAINT_STICKER_CELL,
    sw: PAINT_STICKER_CELL,
    sh: PAINT_STICKER_CELL,
  };
}

// ── stickers ─────────────────────────────────────────────────────
// A click stamps once; a drag lays a trail. The spacing is the stamp size, so a
// dragged trail reads as a row of stamps rather than a smear - which is what
// separates a sticker tool from a very wide brush.
// The three sizes are INTEGER multiples of the atlas cell (32px): 1x, 2x, and
// a half-size 16px. A non-integer scale like the old 52px doubles some source
// pixels and not others, which is what made the large stamp look chewed up
// rather than chunky. Nearest-neighbour only looks deliberate on whole numbers.
[['small', 16], ['medium', 32], ['large', 64]].forEach(([id, size]) => {
  paintRegisterGenerator('sticker', id, (seg, st) => {
    const pts = paintWalk(seg, size);
    // paintWalk always appends the segment's exact endpoint so a drag never
    // stops short of where the pointer let go. That endpoint can land closer
    // than one stamp width from the previous one, which is the smear this
    // tool exists to avoid - so drop it when it would bunch up rather than
    // trail. The stamp before it already overlaps the tail closely enough.
    if (pts.length > 1) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < size * 0.75) pts.pop();
    }
    return pts.map(p => ({
      op: 'sprite', idx: st.stickerIndex, x: p.x, y: p.y, size, rot: 0,
    }));
  });
});

// ── shapes ───────────────────────────────────────────────────────
// A shape is defined by where the drag STARTED and where it is NOW, not by the
// segment between two mouse moves. apps/paint.js therefore feeds these
// generators the whole drag every move and restores the canvas underneath -
// see paintIsShapeTool.
function paintIsShapeTool(toolId) {
  return toolId === 'line' || toolId === 'rect' || toolId === 'oval';
}

// Normalises a drag box so a rectangle dragged up-and-left is still positive.
// A negative width draws absolutely nothing and looks like a dead tool.
function paintBox(seg) {
  return {
    x: Math.min(seg.x0, seg.x1),
    y: Math.min(seg.y0, seg.y1),
    w: Math.abs(seg.x1 - seg.x0),
    h: Math.abs(seg.y1 - seg.y0),
  };
}

[['l1', 1], ['l3', 3], ['l6', 6]].forEach(([id, w]) => {
  paintRegisterGenerator('line', id, (seg, st) =>
    [{ op: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1, w, color: st.color }]);
});

paintRegisterGenerator('line', 'dashed', (seg, st) =>
  paintWalk(seg, 8).filter((_, i) => i % 2 === 0)
    .map(p => ({ op: 'dab', x: p.x, y: p.y, r: 2, color: st.color })));

paintRegisterGenerator('line', 'arrow', (seg, st) => {
  const ops = [{ op: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1, w: 3, color: st.color }];
  const a = Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0);
  const head = 12;
  [a + Math.PI * 0.82, a - Math.PI * 0.82].forEach(ang => {
    ops.push({ op: 'line', x0: seg.x1, y0: seg.y1,
               x1: seg.x1 + Math.cos(ang) * head, y1: seg.y1 + Math.sin(ang) * head,
               w: 3, color: st.color });
  });
  return ops;
});

paintRegisterGenerator('line', 'wiggly', (seg, st) => {
  const len = paintSegLen(seg);
  const a = Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0);
  const nx = -Math.sin(a), ny = Math.cos(a);
  const ops = [];
  let px = seg.x0, py = seg.y0;
  const steps = Math.max(2, Math.round(len / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wob = Math.sin(t * Math.PI * 2 * 4) * 5;
    const x = seg.x0 + (seg.x1 - seg.x0) * t + nx * wob;
    const y = seg.y0 + (seg.y1 - seg.y0) * t + ny * wob;
    ops.push({ op: 'line', x0: px, y0: py, x1: x, y1: y, w: 2, color: st.color });
    px = x; py = y;
  }
  return ops;
});

paintRegisterGenerator('rect', 'filled', (seg, st) => {
  const b = paintBox(seg);
  return [{ op: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, color: st.color }];
});

paintRegisterGenerator('rect', 'outline', (seg, st) => {
  const b = paintBox(seg);
  const t = 2;
  return [
    { op: 'rect', x: b.x, y: b.y, w: b.w, h: t, color: st.color },
    { op: 'rect', x: b.x, y: b.y + b.h - t, w: b.w, h: t, color: st.color },
    { op: 'rect', x: b.x, y: b.y, w: t, h: b.h, color: st.color },
    { op: 'rect', x: b.x + b.w - t, y: b.y, w: t, h: b.h, color: st.color },
  ];
});

paintRegisterGenerator('rect', 'round', (seg, st) => {
  const b = paintBox(seg);
  // A QUARTER of the smaller side, not a half. At a half the corner circles
  // meet in the middle, both spanning bars collapse to zero width, and the
  // shape renders as a plain circle - which is exactly what the 22px preview
  // button was showing. A quarter always leaves a visible straight edge, so a
  // rounded rectangle reads as a rectangle at every size.
  const r = Math.min(8, b.w / 4, b.h / 4);
  return [
    { op: 'rect', x: b.x + r, y: b.y, w: Math.max(0, b.w - r * 2), h: b.h, color: st.color },
    { op: 'rect', x: b.x, y: b.y + r, w: b.w, h: Math.max(0, b.h - r * 2), color: st.color },
    { op: 'dab', x: b.x + r, y: b.y + r, r, color: st.color },
    { op: 'dab', x: b.x + b.w - r, y: b.y + r, r, color: st.color },
    { op: 'dab', x: b.x + r, y: b.y + b.h - r, r, color: st.color },
    { op: 'dab', x: b.x + b.w - r, y: b.y + b.h - r, r, color: st.color },
  ];
});

// Dabs along the ellipse rather than a stroked path, so an oval is made of the
// same primitive as everything else and the renderer stays a five-case switch.
function paintEllipseDabs(seg, radius, color, fill) {
  const b = paintBox(seg);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rx = b.w / 2, ry = b.h / 2;
  const ops = [];
  if (fill) {
    // Horizontal spans, which is the cheapest honest fill for an ellipse.
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const frac = 1 - (y * y) / (ry * ry || 1);
      if (frac < 0) continue;
      const half = rx * Math.sqrt(frac);
      ops.push({ op: 'rect', x: cx - half, y: cy + y, w: half * 2, h: 1, color });
    }
    return ops;
  }
  const steps = Math.max(16, Math.round((rx + ry) * 1.5));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ops.push({ op: 'dab', x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, r: radius, color });
  }
  return ops;
}

paintRegisterGenerator('oval', 'outline', (seg, st) => paintEllipseDabs(seg, 1.5, st.color, false));
paintRegisterGenerator('oval', 'filled',  (seg, st) => paintEllipseDabs(seg, 1.5, st.color, true));

// ─────────────────────────────────────────────────────────────────
// Fill patterns
// ─────────────────────────────────────────────────────────────────
// A pattern answers one question per pixel: is this position inked? The fill
// walks its flooded region and consults this, so a patterned fill is the same
// flood as a solid one with a mask on top.
//
// Every geometric pattern is a function of x and y ONLY. Reading the rng for a
// pattern that has a fixed shape makes a fill shimmer differently each time it
// is applied to the same region, which reads as a rendering bug.
function paintHexToRgba(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

function paintRgbaToHex(r, g, b) {
  return paintRgbToHex(r, g, b);
}

function paintPatternAt(patternId, x, y, rng) {
  switch (patternId) {
    case 'solid':    return true;
    case 'gradient': return true;   // handled by the caller, which knows the region's extent
    case 'check':    return ((x >> 2) + (y >> 2)) % 2 === 0;
    case 'stripe':   return (y >> 2) % 2 === 0;
    case 'diag':     return ((x + y) >> 2) % 2 === 0;
    case 'dots':     return (x % 6 < 2) && (y % 6 < 2);
    case 'grid':     return (x % 8 === 0) || (y % 8 === 0);
    case 'noise':    return rng() < 0.5;
    case 'confetti': return rng() < 0.22;
    default:         return false;
  }
}

// Confetti and static want a colour per pixel rather than one flat colour.
// Returns null when the pattern is monochrome, so the caller keeps its fast path.
function paintPatternColor(patternId, baseHex, rng) {
  if (patternId !== 'confetti') return null;
  const pal = paintPalette();
  return pal[Math.floor(rng() * pal.length)].hex;
}

// ── fill (preview only) ─────────────────────────────────────────
// paintDoFill in apps/paint.js never calls paintGenerate - it reads and writes
// real canvas pixels, which this pure file cannot do. These nine generators
// exist for one reason only: paintRenderOptionsBar draws every variant button
// by running paintGenerate on a 22x22 offscreen canvas (paintVariantPreview),
// and with no generator registered that call returns [], so all nine fill
// buttons would render as blank white squares. Same preview-only role Task 14
// and Task 16 play for text and eraser.
//
// Each one inks the pattern directly across the 22x22 button so the button art
// IS the pattern, the same "the preview is the real output" rule every other
// tool follows here - it just is not the rule fill's ACTUAL stroke follows,
// since fill has no stroke.
function paintFillPreviewOps(patternId, st) {
  const w = 22, h = 22;
  if (patternId === 'gradient') {
    // Same ramp paintDoFill applies: the paint colour at the top fading to
    // white at the bottom.
    const rgba = paintHexToRgba(st.color);
    const ops = [];
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1);
      const hex = paintRgbToHex(
        rgba[0] + (255 - rgba[0]) * t,
        rgba[1] + (255 - rgba[1]) * t,
        rgba[2] + (255 - rgba[2]) * t);
      ops.push({ op: 'rect', x: 0, y, w, h: 1, color: hex });
    }
    return ops;
  }
  const ops = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!paintPatternAt(patternId, x, y, st.rng)) continue;
      const alt = paintPatternColor(patternId, st.color, st.rng);
      ops.push({ op: 'rect', x, y, w: 1, h: 1, color: alt || st.color });
    }
  }
  return ops;
}

['solid', 'gradient', 'check', 'stripe', 'diag', 'dots', 'grid', 'noise', 'confetti'].forEach(id => {
  paintRegisterGenerator('fill', id, (seg, st) => paintFillPreviewOps(id, st));
});

// ── text (preview only) ───────────────────────────────────────────
// The text tool is driven by the UI (it needs a string), but the options bar
// previews a variant by RUNNING it, so a button with no generator is a blank
// button. These exist purely to draw the preview: a bar whose height tracks the
// text size, which is exactly the thing the variant chooses.
paintVariantsFor('text').forEach(v => {
  paintRegisterGenerator('text', v.id, (seg, st) => {
    const h = Math.max(3, Number((/^t(\d+)$/.exec(v.id) || [])[1] || 8) * 0.7);
    return [{ op: 'rect', x: seg.x0, y: seg.y1, w: 3, h, color: st.color }];
  });
});

// ─────────────────────────────────────────────────────────────────
// The wacky brush
// ─────────────────────────────────────────────────────────────────
// Fifteen variants, each a pure function of one segment. This is where the
// generator design pays for itself twice over: every one of these is provable
// in node, and every one draws its own button in the options bar for free.
//
// Two rules all of them follow:
//   - read randomness ONLY from st.rng, so a stroke is reproducible
//   - stay near the segment. A brush that scatters unboundedly paints outside
//     the canvas at the edges, which is invisible until someone draws there.

// Rotates a hex colour's hue. Used by the rainbow ribbon, and kept here rather
// than in the UI because the ops carry finished colours - the renderer does no
// colour maths at all.
function paintHueShift(hex, degrees) {
  const [r, g, b] = paintHexToRgba(hex);
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const v = max, d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r / 255)      h = 60 * (((g - b) / 255 / d) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else                      h = 60 * ((r - g) / 255 / d + 4);
  }
  h = (((h + degrees) % 360) + 360) % 360;
  // A grey has no hue to rotate, so give the ribbon a saturated one to work
  // with rather than emitting 30 identical greys.
  const rgb = paintHsvToRgb(h, s < 0.05 ? 1 : s, v < 0.15 ? 1 : v);
  return paintRgbToHex(rgb[0], rgb[1], rgb[2]);
}

paintRegisterGenerator('wacky', 'spray', (seg, st) => {
  const ops = [];
  paintWalk(seg, 4).forEach(p => {
    for (let i = 0; i < 8; i++) {
      const a = st.rng() * Math.PI * 2;
      const d = st.rng() * 10;
      ops.push({ op: 'dab', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 1, color: st.color });
    }
  });
  return ops;
});

paintRegisterGenerator('wacky', 'echo', (seg, st) => {
  // Four ghosts trailing behind the stroke's own direction, each smaller.
  const dx = seg.x1 - seg.x0, dy = seg.y1 - seg.y0;
  const ops = [];
  for (let k = 0; k < 4; k++) {
    ops.push({ op: 'dab', x: seg.x1 - dx * k * 1.6, y: seg.y1 - dy * k * 1.6,
               r: Math.max(1, st.size * (1 - k * 0.2)), color: st.color });
  }
  return ops;
});

paintRegisterGenerator('wacky', 'kaleido', (seg, st) => {
  // Four-fold: the dab plus its mirror in each axis and both. The canvas
  // dimensions are the mirror lines, which is why this generator is the one
  // place in the file that reads them.
  const W = paintCanvasWidth(), H = paintCanvasHeight();
  const ops = [];
  paintWalk(seg, 3).forEach(p => {
    [[p.x, p.y], [W - p.x, p.y], [p.x, H - p.y], [W - p.x, H - p.y]].forEach(([x, y]) => {
      ops.push({ op: 'dab', x, y, r: Math.max(1, st.size), color: st.color });
    });
  });
  return ops;
});

paintRegisterGenerator('wacky', 'spiral', (seg, st) => {
  const ops = [];
  const turns = 3, steps = 40;
  const maxR = 6 + st.size * 3;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns + seg.index * 0.4;
    const r = t * maxR;
    ops.push({ op: 'dab', x: seg.x1 + Math.cos(a) * r, y: seg.y1 + Math.sin(a) * r,
               r: 1.5, color: st.color });
  }
  return ops;
});

paintRegisterGenerator('wacky', 'tree', (seg, st) => {
  // A two-level branch off the segment's end. Not a real L-system: three
  // recursion levels at every mouse move is a solid black blob within a second.
  const ops = [];
  const baseA = Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0) - Math.PI / 2;
  const len = 10 + st.size * 2;
  const grow = (x, y, a, l, depth) => {
    const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
    ops.push({ op: 'line', x0: x, y0: y, x1: nx, y1: ny, w: Math.max(1, depth), color: st.color });
    if (depth <= 0) return;
    grow(nx, ny, a - 0.5 - st.rng() * 0.3, l * 0.7, depth - 1);
    grow(nx, ny, a + 0.5 + st.rng() * 0.3, l * 0.7, depth - 1);
  };
  grow(seg.x1, seg.y1, baseA, len, 2);
  return ops;
});

paintRegisterGenerator('wacky', 'drips', (seg, st) => {
  const ops = [{ op: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1,
                 w: Math.max(2, st.size), color: st.color }];
  // A run of paint down from the stroke, now and then.
  if (st.rng() < 0.25) {
    const len = 8 + st.rng() * 34;
    ops.push({ op: 'line', x0: seg.x1, y0: seg.y1, x1: seg.x1, y1: seg.y1 + len, w: 2, color: st.color });
    ops.push({ op: 'dab', x: seg.x1, y: seg.y1 + len, r: 2.5, color: st.color });
  }
  return ops;
});

paintRegisterGenerator('wacky', 'bubbles', (seg, st) => {
  const ops = [];
  paintWalk(seg, 9).forEach(p => {
    const r = 2 + st.rng() * 9;
    const a = st.rng() * Math.PI * 2;
    const d = st.rng() * 8;
    const cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
    // A ring of small dabs, so a bubble reads as an outline rather than a blob.
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      ops.push({ op: 'dab', x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r, r: 1, color: st.color });
    }
  });
  return ops;
});

paintRegisterGenerator('wacky', 'rainbow', (seg, st) => {
  const ops = [];
  paintWalk(seg, 2).forEach((p, i) => {
    ops.push({ op: 'dab', x: p.x, y: p.y, r: Math.max(2, st.size),
               color: paintHueShift(st.color, (seg.index * 9 + i * 7) % 360) });
  });
  return ops;
});

paintRegisterGenerator('wacky', 'scatter', (seg, st) => {
  const count = paintStickerCount();
  return paintWalk(seg, 26).map(p => ({
    op: 'sprite',
    idx: Math.floor(st.rng() * count) % count,
    x: p.x, y: p.y,
    size: 16 + Math.floor(st.rng() * 18),
    rot: 0,
  }));
});

paintRegisterGenerator('wacky', 'connect', (seg, st) => {
  const ops = [{ op: 'dab', x: seg.x1, y: seg.y1, r: 2.5, color: st.color }];
  // Chords back to a few earlier points in the same stroke. Capped at four, or
  // a long stroke becomes O(n^2) lines and the canvas fills with black.
  const pts = st.points || [];
  pts.slice(-5, -1).forEach(p => {
    ops.push({ op: 'line', x0: seg.x1, y0: seg.y1, x1: p.x, y1: p.y, w: 1, color: st.color });
  });
  return ops;
});

paintRegisterGenerator('wacky', 'fuzzy', (seg, st) => {
  const ops = [];
  paintWalk(seg, 3).forEach(p => {
    for (let i = 0; i < 6; i++) {
      const a = st.rng() * Math.PI * 2;
      const l = 3 + st.rng() * 7;
      ops.push({ op: 'line', x0: p.x, y0: p.y,
                 x1: p.x + Math.cos(a) * l, y1: p.y + Math.sin(a) * l, w: 1, color: st.color });
    }
  });
  return ops;
});

paintRegisterGenerator('wacky', 'stars', (seg, st) => {
  const ops = [];
  paintWalk(seg, 14).forEach(p => {
    const r = 4 + st.rng() * 7;
    const spin = st.rng() * Math.PI;
    // Five-pointed, drawn as five spokes. Cheap and unmistakable.
    for (let i = 0; i < 5; i++) {
      const a = spin + (i / 5) * Math.PI * 2;
      ops.push({ op: 'line', x0: p.x, y0: p.y,
                 x1: p.x + Math.cos(a) * r, y1: p.y + Math.sin(a) * r, w: 2, color: st.color });
    }
  });
  return ops;
});

paintRegisterGenerator('wacky', 'splatter', (seg, st) => {
  const ops = [];
  paintWalk(seg, 7).forEach(p => {
    const blobs = 3 + Math.floor(st.rng() * 4);
    for (let i = 0; i < blobs; i++) {
      const a = st.rng() * Math.PI * 2;
      const d = st.rng() * 16;
      ops.push({ op: 'dab', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
                 r: 1 + st.rng() * 4, color: st.color });
    }
  });
  return ops;
});

paintRegisterGenerator('wacky', 'beads', (seg, st) => {
  const spacing = Math.max(6, st.size * 3);
  return paintWalk(seg, spacing).map((p, i) => ({
    op: 'dab', x: p.x, y: p.y,
    r: 3 + Math.sin((seg.index + i) * 0.7) * 2,
    color: st.color,
  }));
});

paintRegisterGenerator('wacky', 'leaky', (seg, st) => {
  const ops = [{ op: 'line', x0: seg.x0, y0: seg.y0, x1: seg.x1, y1: seg.y1, w: 1, color: st.color }];
  // Occasional blots, the way a bad pen lets go all at once.
  if (st.rng() < 0.18) {
    const r = 3 + st.rng() * 7;
    ops.push({ op: 'dab', x: seg.x1, y: seg.y1, r, color: st.color });
    for (let i = 0; i < 3; i++) {
      const a = st.rng() * Math.PI * 2;
      ops.push({ op: 'dab', x: seg.x1 + Math.cos(a) * r * 1.7,
                 y: seg.y1 + Math.sin(a) * r * 1.7, r: 1 + st.rng() * 2, color: st.color });
    }
  }
  return ops;
});

// ─────────────────────────────────────────────────────────────────
// Erasers
// ─────────────────────────────────────────────────────────────────
// Three of them rub things out. Six of them do something TO the picture, and
// those are the point - a paint program where the eraser might blow up your
// drawing is the difference between KidPix and MS Paint.
//
// The whole-image erasers run in the UI because they read the canvas, but their
// PATTERNS live here and are seeded, so what a firecracker does is provable in
// node rather than something you have to squint at.

[['e4', 4], ['e10', 10], ['e24', 24]].forEach(([id, size]) => {
  paintRegisterGenerator('eraser', id, (seg) =>
    paintWalk(seg, size / 2).map(p => ({ op: 'erase', x: p.x, y: p.y, r: size / 2 })));
});

// Drips is a stroke eraser rather than a whole-image one: it melts what it
// touches downward, so it is a generator like the plain three.
paintRegisterGenerator('eraser', 'melt', (seg, st) => {
  const ops = [];
  paintWalk(seg, 5).forEach(p => {
    ops.push({ op: 'erase', x: p.x, y: p.y, r: 5 });
    const run = 6 + st.rng() * 26;
    for (let d = 0; d < run; d += 4) ops.push({ op: 'erase', x: p.x, y: p.y + d, r: 3 });
  });
  return ops;
});

// A firecracker: a dense core and a scatter of shrapnel holes. Deterministic
// from the rng, so the browser test can assert on it and a replay is identical.
function paintBlastPattern(cx, cy, rng) {
  const holes = [{ x: cx, y: cy, r: 26 }];
  const shards = 24;
  for (let i = 0; i < shards; i++) {
    const a = rng() * Math.PI * 2;
    const d = 18 + rng() * 110;
    holes.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 3 + rng() * 16 });
  }
  return holes;
}

// A shuffled visit order over every pixel index. Partial Fisher-Yates over the
// whole array - the same shape msSeed uses, and for the same reason: it is the
// honest way to get a permutation rather than sampling with rejection.
function paintDissolveOrder(w, h, rng) {
  const n = w * h;
  const order = new Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order;
}

// Alternating bands, top to bottom. The last band is clamped rather than
// allowed to overhang, so a height that is not a multiple of the step does not
// erase past the canvas.
function paintBlindRows(h, step) {
  const rows = [];
  for (let y = 0; y < h; y += step * 2) {
    rows.push({ y, h: Math.min(step, h - y) });
  }
  return rows;
}

// The whole-image erasers are applied by the UI, but the options bar previews a
// variant by RUNNING it. These stand-ins draw the SHAPE of what each one does
// on a 22x22 button - a blast, a swirl, speckle, a wash, bands - so the row
// reads at a glance instead of showing five identical blank squares.
paintRegisterGenerator('eraser', 'firecracker', (seg, st) =>
  paintBlastPattern(seg.x1, seg.y1, st.rng).slice(0, 8)
    .map(h => ({ op: 'erase', x: h.x, y: h.y, r: Math.max(1, h.r / 6) })));

paintRegisterGenerator('eraser', 'blackhole', (seg) => {
  const ops = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const a = t * Math.PI * 4;
    ops.push({ op: 'erase', x: seg.x1 + Math.cos(a) * t * 9, y: seg.y1 + Math.sin(a) * t * 9, r: 1.5 });
  }
  return ops;
});

paintRegisterGenerator('eraser', 'dissolve', (seg, st) => {
  const ops = [];
  for (let i = 0; i < 40; i++) ops.push({ op: 'erase', x: st.rng() * 22, y: st.rng() * 22, r: 1 });
  return ops;
});

paintRegisterGenerator('eraser', 'fade', () =>
  [{ op: 'erase', x: 11, y: 11, r: 10 }]);

paintRegisterGenerator('eraser', 'blinds', () =>
  paintBlindRows(22, 3).map(r => ({ op: 'erase', x: 11, y: r.y + r.h / 2, r: r.h })));

// ─────────────────────────────────────────────────────────────────
// Goodies - whole-image operations
// ─────────────────────────────────────────────────────────────────
// A menu rather than tools: these act on the whole picture at once, and a
// column of per-stroke instruments is the wrong place for something that is not
// a stroke.
//
// Every one mutates a raw RGBA buffer in place and touches no canvas, so
// `npm test` proves each one. Several have properties worth asserting - flip
// and invert are involutions, posterize is idempotent, scramble conserves
// pixels - and a property is a much better test than a golden image.
const PAINT_GOODIES = ['flipH', 'flipV', 'invert', 'darken', 'lighten', 'posterize', 'scramble', 'edges'];
function paintGoodieNames() { return PAINT_GOODIES.slice(); }

function paintGoodie(name, px, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  const swap = (i, j) => {
    for (let k = 0; k < 4; k++) { const t = px[i + k]; px[i + k] = px[j + k]; px[j + k] = t; }
  };
  switch (name) {
    case 'flipH':
      for (let y = 0; y < h; y++) for (let x = 0; x < w >> 1; x++) swap(at(x, y), at(w - 1 - x, y));
      return true;
    case 'flipV':
      for (let y = 0; y < h >> 1; y++) for (let x = 0; x < w; x++) swap(at(x, y), at(x, h - 1 - y));
      return true;
    case 'invert':
      // Alpha is deliberately untouched: inverting it would turn the picture
      // transparent rather than negative.
      for (let i = 0; i < px.length; i += 4) {
        px[i] = 255 - px[i]; px[i + 1] = 255 - px[i + 1]; px[i + 2] = 255 - px[i + 2];
      }
      return true;
    case 'darken':
      for (let i = 0; i < px.length; i += 4) {
        px[i] *= 0.8; px[i + 1] *= 0.8; px[i + 2] *= 0.8;
      }
      return true;
    case 'lighten':
      for (let i = 0; i < px.length; i += 4) {
        px[i] += (255 - px[i]) * 0.2;
        px[i + 1] += (255 - px[i + 1]) * 0.2;
        px[i + 2] += (255 - px[i + 2]) * 0.2;
      }
      return true;
    case 'posterize': {
      // Snapping to fixed levels is what makes this idempotent: a value already
      // on a level maps to itself, so applying it twice changes nothing.
      const levels = 4;
      const step = 255 / (levels - 1);
      for (let i = 0; i < px.length; i += 4) {
        for (let k = 0; k < 3; k++) px[i + k] = Math.round(Math.round(px[i + k] / step) * step);
      }
      return true;
    }
    case 'scramble': {
      // Sixteen tiles, shuffled. A fixed permutation rather than a random one so
      // the operation is a pure function of the image - and so the test can
      // assert pixel conservation without threading an rng through.
      const cols = 4, rows = 4;
      const tw = Math.floor(w / cols), th = Math.floor(h / rows);
      if (tw < 1 || th < 1) return true;
      const perm = [5, 11, 2, 14, 0, 9, 7, 3, 12, 1, 15, 6, 10, 4, 13, 8];
      const copy = px.slice();
      for (let t = 0; t < 16; t++) {
        const sx = (perm[t] % cols) * tw, sy = Math.floor(perm[t] / cols) * th;
        const dx = (t % cols) * tw, dy = Math.floor(t / cols) * th;
        for (let y = 0; y < th; y++) {
          for (let x = 0; x < tw; x++) {
            const si = ((sy + y) * w + (sx + x)) * 4, di = ((dy + y) * w + (dx + x)) * 4;
            for (let k = 0; k < 4; k++) px[di + k] = copy[si + k];
          }
        }
      }
      return true;
    }
    case 'edges': {
      // Difference from the pixel to the right and below, inverted, so edges
      // come out dark on white rather than white on black.
      const copy = px.slice();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = at(x, y);
          const r = at(Math.min(w - 1, x + 1), y);
          const d = at(x, Math.min(h - 1, y + 1));
          let g = 0;
          for (let k = 0; k < 3; k++) g += Math.abs(copy[i + k] - copy[r + k]) + Math.abs(copy[i + k] - copy[d + k]);
          const v = Math.max(0, 255 - g);
          px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
        }
      }
      return true;
    }
    default:
      return false;
  }
}
