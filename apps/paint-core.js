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
    { id: 'stamp', label: 'Alphabet Stamp' },
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
