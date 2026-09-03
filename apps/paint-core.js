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
