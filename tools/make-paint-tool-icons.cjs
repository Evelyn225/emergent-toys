'use strict';
// Draws PAINT.exe's eleven toolbox icons into os/sprites/paint-tools.png.
//
// Run BY HAND, never by `npm run build`, like the two atlas cutters beside it:
//
//   node tools/make-paint-tool-icons.cjs
//
// WHY A GENERATOR AND NOT ELEVEN PNGs IN AN EDITOR: the art below IS the
// source. Every pixel is visible and diffable in this file, so changing the
// eraser's colour or nudging the dropper's tip is a text edit and a re-run,
// not a binary somebody has to open Aseprite to touch. It is the same bargain
// the sticker atlas makes, and it is why `sound.png` in os/icons was authored
// the same way.
//
// WHY NOT TEXT GLYPHS (what this replaces): the toolbox used Unicode symbols -
// pencil, alembic, flower, and so on. They render at whatever weight and
// baseline the user's font stack decides, several were unrecognisable at 26px
// (the alembic in particular read as a beaker nobody could connect to an
// eyedropper), and none of them matched the OS's hand-drawn 16px icon set.
//
// NO CANVAS, NO BROWSER: an 11-cell sheet of flat indexed colours is a
// hand-written PNG. Encoding it here keeps this tool a plain `node` run with
// no Chromium dependency, unlike the atlas cutters which need canvas for JPEG
// decoding and resampling.
//
// GEOMETRY: authored on a 16x16 grid, emitted at 2x, so a cell is 32x32 and
// the sheet is 352x32. The toolbox displays a cell at 16px with
// image-rendering: pixelated, which makes it exact at 1x (a 2:1 nearest
// downscale of a clean 2x upscale is lossless) and sharp on a 2x display.
// Cell order is the order of PAINT_TOOLS in apps/paint-core.js; apps/paint.js
// names it again in PAINT_TOOL_ICON_ORDER rather than trusting that, so a tool
// inserted in the middle of the list cannot silently shift ten icons.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'os/sprites/paint-tools.png');

const SIZE = 16;   // authored grid
const SCALE = 2;   // emitted at 2x

// The Win95 desktop palette plus the handful of saturated accents the KidPix
// side of the program wants. Kept small on purpose: these icons sit next to the
// OS's own icon set and should look like they came from the same hand.
const PAL = {
  '.': null,              // transparent
  k: [0x00, 0x00, 0x00],  // outline black
  d: [0x40, 0x40, 0x40],  // shadow
  g: [0x80, 0x80, 0x80],  // Win95 mid grey
  l: [0xc0, 0xc0, 0xc0],  // Win95 face grey
  w: [0xff, 0xff, 0xff],
  y: [0xff, 0xd0, 0x00],  // pencil / star yellow
  o: [0xff, 0x80, 0x00],
  r: [0xe0, 0x00, 0x00],
  p: [0xff, 0x80, 0xc0],  // eraser rubber pink
  b: [0x00, 0x00, 0xd0],
  c: [0x00, 0xc0, 0xd0],
  e: [0x00, 0xa8, 0x00],
  m: [0x90, 0x50, 0x20],  // brush handle wood
};

// Each entry is 16 rows of 16 characters. Read them as pictures - that is the
// whole point of keeping the art in text.
const ICONS = {
  // Yellow pencil on the anti-diagonal, eraser end top-right, graphite point
  // bottom-left. The body is two pixels of colour between two of outline, which
  // is the narrowest a shaft can be and still read as a tube rather than a line.
  pencil: [
    '............kppk',
    '...........kppk.',
    '..........kggk..',
    '.........kyyk...',
    '........kyyk....',
    '.......kyyk.....',
    '......kyyk......',
    '.....kyyk.......',
    '....kyyk........',
    '...kyyk.........',
    '..kyyk..........',
    '.kyyk...........',
    'kwwk............',
    'kkk.............',
    'kk..............',
    '................',
  ],

  // Straight 2px diagonal, corner to corner. Nothing else: the moment a line
  // icon grows endpoint handles it starts competing with the Move tool.
  line: [
    '..............kk',
    '.............kk.',
    '............kk..',
    '...........kk...',
    '..........kk....',
    '.........kk.....',
    '........kk......',
    '.......kk.......',
    '......kk........',
    '.....kk.........',
    '....kk..........',
    '...kk...........',
    '..kk............',
    '.kk.............',
    'kk..............',
    '................',
  ],

  rect: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kkkkkkkkkkkk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kk........kk..',
    '..kkkkkkkkkkkk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],

  // Two pixels thick like the rectangle, so the two shape tools read as a pair.
  oval: [
    '.....kkkkkk.....',
    '...kkkkkkkkkk...',
    '..kkk......kkk..',
    '..kk........kk..',
    '.kk..........kk.',
    '.kk..........kk.',
    'kk............kk',
    'kk............kk',
    'kk............kk',
    'kk............kk',
    '.kk..........kk.',
    '.kk..........kk.',
    '..kk........kk..',
    '..kkk......kkk..',
    '...kkkkkkkkkk...',
    '.....kkkkkk.....',
  ],

  // A bucket of paint, and nothing else. Earlier drafts added a drip and a
  // puddle to say "fill" rather than "container", and both times the extra
  // silhouette merged with the bucket at 16px and the whole icon read as a
  // funnel. The bucket alone is the universally understood fill symbol; the
  // pixels are better spent making it a clean one.
  fill: [
    '................',
    '....kkkkkkkk....',
    '...k........k...',
    '...k........k...',
    '.kkkkkkkkkkkkkk.',
    '.kllllllllllllk.',
    '.kbbbbbbbbbbbbk.',
    '.kbbbbbbbbbbbbk.',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '..kbbbbbbbbbbk..',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],

  // Dropper: red bulb top-right, white barrel tapering to a point bottom-left.
  // Same anti-diagonal as the pencil on purpose - both are held things - but the
  // fat bulb and the white body keep them apart at a glance.
  eyedropper: [
    '..........kkkk..',
    '.........krrrrk.',
    '.........krrrrk.',
    '.........kkrrk..',
    '.......kkkkkk...',
    '......kwwwk.....',
    '.....kwwwk......',
    '....kwwwk.......',
    '...kwwwk........',
    '..kwwwk.........',
    '..kwwk..........',
    '.kwwk...........',
    '.kwk............',
    'kwk.............',
    'kk..............',
    '................',
  ],

  text: [
    '................',
    '................',
    '.......kk.......',
    '......kkkk......',
    '......kkkk......',
    '.....kk..kk.....',
    '.....kk..kk.....',
    '....kk....kk....',
    '....kkkkkkkk....',
    '....kkkkkkkk....',
    '...kk......kk...',
    '...kk......kk...',
    '..kk........kk..',
    '..kk........kk..',
    '................',
    '................',
  ],

  // A star, because the sticker sheet's own contents are 112 unrelated
  // drawings and no single one of them can stand for the set.
  sticker: [
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.....kyyyyk.....',
    'kkkkkkyyyykkkkkk',
    'kyyyyyyyyyyyyyyk',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '...kyyyyyyyyk...',
    '..kyyyyyyyyyyk..',
    '..kyyyk..kyyyk..',
    '.kyyk......kyyk.',
    '.kyk........kyk.',
    '.kk..........kk.',
    '................',
  ],

  // Brush with rainbow bristles. The colours are the whole message: this is the
  // tool that does not do what you asked.
  wacky: [
    '............kmmk',
    '...........kmmk.',
    '..........kmmk..',
    '.........kmmk...',
    '........kmmk....',
    '.......kmmk.....',
    '......kmmk......',
    '.....kggggk.....',
    '.....kggggk.....',
    '...krrbbeeyyk...',
    '..krrbbbeeyyyk..',
    '..krrbbbeeyyyk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],

  // A rubber, drawn as a slanted block: grey holder on top, pink rubber below,
  // with two crumbs it has just rubbed off. The slant is what stops it reading
  // as another rectangle tool.
  eraser: [
    '................',
    '................',
    '.......kkkkkkkk.',
    '......kwwwwwwwk.',
    '.....kwwwwwwwk..',
    '....kwwwwwwwk...',
    '...kkkkkkkkk....',
    '..kpppppppk.....',
    '.kpppppppk......',
    'kpppppppk.......',
    'kkkkkkkk........',
    '................',
    '..........g.g...',
    '.............g..',
    '...........g....',
    '................',
  ],

  // Not a tool: the undo button's icon. It rides in this sheet rather than in a
  // PNG of its own because it is drawn the same way, at the same size, and
  // belongs to the same program - one asset, one generator. apps/paint.js
  // reaches it by name through the same order table.
  //
  // A plain arrow. It replaced a drawing of the Undo Guy, and was first made by
  // editing paint-tools.png directly; it lives here now so re-running this tool
  // reproduces it instead of quietly putting the Undo Guy back.
  undo: [
    '................',
    '................',
    '................',
    '................',
    '.............k..',
    '.............k..',
    '............kk..',
    '....k.......k...',
    '...kk......kk...',
    '..kkk....kkk....',
    'kkkkkkkkkk......',
    '..kkk...........',
    '...kk...........',
    '....k...........',
    '................',
    '................',
  ],

  // Marching ants. Dashed so it cannot be confused with the Rectangle tool,
  // which is the solid one two rows above it in the same toolbox.
  select: [
    '................',
    '................',
    '..kk.kk.kk.kkk..',
    '..k..........k..',
    '..k..........k..',
    '................',
    '..k..........k..',
    '..k..........k..',
    '................',
    '..k..........k..',
    '..k..........k..',
    '................',
    '..k..........k..',
    '..kk.kk.kk.kkk..',
    '................',
    '................',
  ],
};

// Cell order. apps/paint.js repeats this list; if the two ever disagree the
// toolbox shows the wrong art, which is why both are written out by name. The
// eleven tools come first, in PAINT_TOOLS order, and anything that is not a
// tool - the undo button's arrow - goes on the end so adding one cannot shift
// a tool's cell.
const ORDER = ['pencil', 'line', 'rect', 'oval', 'fill', 'eyedropper',
               'text', 'sticker', 'wacky', 'eraser', 'select', 'undo'];

// ── validation ───────────────────────────────────────────────────
// Cheap, but it catches the one mistake this format invites: a row that is 15
// or 17 characters long, which would otherwise skew everything after it into a
// diagonal smear that looks deliberate enough to ship.
ORDER.forEach(id => {
  const rows = ICONS[id];
  if (!rows) throw new Error('no art for tool ' + id);
  if (rows.length !== SIZE) throw new Error(id + ': ' + rows.length + ' rows, expected ' + SIZE);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(id + ' row ' + y + ': ' + row.length + ' chars, expected ' + SIZE);
    for (const ch of row) {
      if (!(ch in PAL)) throw new Error(id + ' row ' + y + ': unknown palette char ' + JSON.stringify(ch));
    }
  });
});
Object.keys(ICONS).forEach(id => {
  if (!ORDER.includes(id)) throw new Error('art for ' + id + ' is never placed - missing from ORDER');
});

// ── raster ───────────────────────────────────────────────────────
const W = ORDER.length * SIZE * SCALE;
const H = SIZE * SCALE;
const rgba = Buffer.alloc(W * H * 4); // zero-filled = transparent

ORDER.forEach((id, cell) => {
  ICONS[id].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = PAL[ch];
      if (!col) return;
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const px = (cell * SIZE + x) * SCALE + sx;
          const py = y * SCALE + sy;
          const i = (py * W + px) * 4;
          rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = 255;
        }
      }
    });
  });
});

// ── PNG encode ───────────────────────────────────────────────────
// Truecolour+alpha, filter type 0 on every scanline. No filtering worth the
// name on art this flat, and an unfiltered stream is trivially verifiable.
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0; // filter: none
  rgba.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // colour type: truecolour with alpha
ihdr[10] = 0;  // deflate
ihdr[11] = 0;  // adaptive filtering
ihdr[12] = 0;  // no interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + W + 'x' + H
          + ', ' + ORDER.length + ' icons (' + SIZE + 'px art at ' + SCALE + 'x)');
