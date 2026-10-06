// ===== graffiti: murals painted across some buildings' upper floors, each district in its own style (rust and anchors on
// the docks, dragons in Chinatown, flowers in the Brownstones, a lone stencil downtown), quick tags low on the shutters, and the tags
// you spray yourself with a can from the hardware store. Police don't like it: spraying is vandalism, and if a cop
// sees you, you're wanted. Your tags stay where you put them (save.js keeps them).
// each district paints its own: a palette, words, the pictures it likes, how often a wall gets a mural, how often a
// shutter or a door gets a quick tag
const MURAL_ART = {
  anchor: [' __O__ ', '   |   ', '\\  |  /', ' \\_|_/ '],
  ship: ['   |\\   ', '   | \\  ', '   |__\\ ', '___|____', '\\______/'],
  wild: ['>>-->  ', '  <==<<'],
  dragon: ['   /\\_/\\___   ', '  ( @ @     \\__', '   >  ^  /\\/\\ \\', '  /_/\\_/     \\/'],
  koi: ['    ___    ', '><(( o )>  ', '    ^^^    '],
  lantern: ['  _|_  ', ' (###) ', ' (###) ', '  `|`  '],
  flowers: [' @  *  @ ', ' |  |  | ', '\\|/\\|/\\|/'],
  sun: [' \\ | / ', '-- O --', ' / | \\ '],
  heart: [' _   _ ', '( \\_/ )', ' \\   / ', '  \\_/  '],
  cat: ['  /\\_/\\  ', ' ( o.o ) ', '  > ^ <  '],
  eyes: [' ___   ___ ', '( @ ) ( @ )', ' ---   --- '],
  wave: ['  .-~~-.   ', ' ~      ~. ', '~~~~~~~~~~~'],
  fish: ['><(((o>', '  <o)))><'],
  balloon: ['  O    ()', ' /|\\   | ', ' / \\   | '],
  checker: ['#.#.#.#', '.#.#.#.', '#.#.#.#'],
  bear: [
    '───▄▀▀▀▄▄▄▄▄▄▄▀▀▀▄───',
    '───█▒▒░░░░░░░░░▒▒█───',
    '────█░░█░░░░░█░░█────',
    '─▄▄──█░░░▀█▀░░░█──▄▄─',
    '█░░█─▀▄░░░░░░░▄▀─█░░█',
  ],
  coffee: [
    '░▀▄░░▄▀',
    '▄▄▄██▄▄▄▄▄░▀█▀▐░▌',
    '█▒░▒░▒░█▀█░░█░▐░▌',
    '█░▒░▒░▒█▀█░░█░░█',
    '█▄▄▄▄▄▄███══════',
  ],
  dinosaur: ['░▄▄▄▄░', '▀▀▄██►', '▀▀███►', '░▀███►░█►', '▒▄████▀▀'],
  island: [
    '░░▄▀▀▀▄░▄▄░░░░░░╠▓░░░░',
    '░░░▄▀▀▄█▄░▀▄░░░▓╬▓▓▓░░',
    '░░▀░░░░█░▀▄░░░▓▓╬▓▓▓▓░',
    '░░░░░░▐▌░░░░▀▀███████▀',
    '▒▒▄██████▄▒▒▒▒▒▒▒▒▒▒▒▒',
  ],
  boombox: [
    '░░█▀▀▀▀▀▀▀▀▀▀▀▀▀▀█',
    '██▀▀▀██▀▀▀▀▀▀██▀▀▀██',
    '█▒▒▒▒▒█▒▀▀▀▀▒█▒▒▒▒▒█',
    '█▒▒▒▒▒█▒████▒█▒▒▒▒▒█',
    '██▄▄▄██▄▄▄▄▄▄██▄▄▄██',
  ],
};
const MURAL_THEMES = {
  belle: { chance: 0, tags: 0, words: [], art: [], styles: [], pals: [] },
  industrial: { chance: 0.08, tags: 0.3, words: ['DOCKS', 'RUST', 'HAUL', 'STEEL', 'PORT', 'GRIT'], art: ['anchor', 'ship', 'wild', 'boombox', 'dinosaur', 'island'], styles: [4, 1, 3], pals: [[ORANGE, BRICK, YEL], [GRAY, ORANGE, CYAN], [RED, YEL, GRAY]] },
  chinatown: { chance: 0.02, tags: 0.08, words: ['LUCK', 'JADE', 'TEA', 'FORTUNE'], art: ['dragon', 'koi', 'lantern'], styles: [0, 2], pals: [[RED, YEL, ORANGE], [RED, GREEN, YEL]] },
  brownstones: { chance: 0.03, tags: 0.1, words: ['PEACE', 'HOME', 'BLOCK', 'LOVE'], art: ['flowers', 'sun', 'heart', 'bear', 'coffee'], styles: [0, 3, 4], pals: [[GREEN, YEL, MAG], [BLUE, YEL, WHITE], [ORANGE, GREEN, CYAN]] },
  midtown: { chance: 0.035, tags: 0.15, words: ['POP', 'NOW', 'WOW', 'CITY', 'ZAP'], art: ['checker', 'eyes', 'heart', 'boombox', 'dinosaur', 'bear'], styles: [5, 2, 3], pals: [[MAG, CYAN, YEL], [RED, BLUE, YEL], [CYAN, MAG, WHITE]] },
  downtown: { chance: 0.01, tags: 0.03, words: ['LOOK UP', 'RISE', 'DREAM'], art: ['balloon'], styles: [6], pals: [[GRAY, WHITE, RED]] },
  shotengai: { chance: 0.03, tags: 0.18, words: ['NEKO', 'KAWAII', 'GO GO'], art: ['cat', 'eyes', 'bear', 'coffee', 'dinosaur'], styles: [5, 1], pals: [[MAG, CYAN, WHITE], [YEL, MAG, BLUE]] },
  waterfront: { chance: 0.03, tags: 0.12, words: ['SURF', 'WAVE', 'SUN', 'TIDE'], art: ['wave', 'fish', 'sun', 'island', 'bear'], styles: [1, 0], pals: [[CYAN, BLUE, YEL], [BLUE, WHITE, ORANGE]] },
};
const themeAt = (mx, my) => MURAL_THEMES[districtAt(mx, my)] || MURAL_THEMES.midtown;
// Keep complete graphemes together: the butterfly's combining marks belong to its wings, not extra cells.
const paintSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const paintGlyphCache = new Map();
function paintGlyphs(text) {
  if (!paintGlyphCache.has(text)) paintGlyphCache.set(text, Array.from(paintSegmenter.segment(text),part => part.segment));
  return paintGlyphCache.get(text);
}
const paintGlyphMasks = new Map();
let paintGlyphCanvas = null;
function paintGlyphOn(ch, u, v) {
  if (ch === '█') return true;
  if (ch === '▀') return v < .5;
  if (ch === '▄') return v >= .5;
  if (ch === '─') return Math.abs(v - .5) < .045;
  if (ch === '═') return Math.abs(v - .38) < .035 || Math.abs(v - .62) < .035;
  if (GLYPH5[ch] !== undefined) return glyphOn(ch,Math.floor(u * 4),Math.floor(v * 5));
  let mask = paintGlyphMasks.get(ch);
  if (!mask) {
    if (!paintGlyphCanvas) {
      paintGlyphCanvas = document.createElement('canvas');
      paintGlyphCanvas.width = 32; paintGlyphCanvas.height = 48;
    }
    const ctx = paintGlyphCanvas.getContext('2d',{ willReadFrequently: true });
    ctx.clearRect(0,0,32,48); ctx.font = '40px monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.save(); ctx.scale(32 / Math.max(1,ctx.measureText(ch).width),1); ctx.fillText(ch,0,0); ctx.restore();
    const pixels = ctx.getImageData(0,0,32,48).data;
    mask = new Uint8Array(32 * 48);
    for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3] > 80;
    paintGlyphMasks.set(ch,mask);
  }
  return !!mask[clamp(Math.floor(v * 48),0,47) * 32 + clamp(Math.floor(u * 32),0,31)];
}
const MURAL_IMAGES = Object.fromEntries(Object.entries(MURAL_ART).map(([name,art]) => {
  const rows = art.map(paintGlyphs);
  return [name,{ name, rows, width: Math.max(...rows.map(row => row.length)), height: rows.length, blocks: art.some(row => /[░▒▓█▀▄]/u.test(row)) }];
}));
// The quick tags on shutters and doors mix names with little faces and symbols; no extra line underneath.
const STREET_TAGS = ['KAT', 'REX', 'ZEN', 'MOE', 'DUKE', 'JINX', 'NOX', 'VEX', 'SKY', 'BOO', 'ACE', 'OZ', 'RAZE', 'FLY'];
const TAG_SYMBOLS = ['><>', '¯\\_(ツ)_/¯', '(^.^)', '<*_*>', 'ʕ•ᴥ•ʔ', 'Ƹ̵̡Ӝ̵̨̄Ʒ', '<3'];
const STREET_MARKS = [...STREET_TAGS,...TAG_SYMBOLS];
const tags = []; // { cell, face: 'N' | 'S' | 'E' | 'W', u (along the wall, world), z (height, cells), design }
const TAG_MAX = 60, TAG_W = 0.26, TAG_H = 0.12;
let tagIndex = new Map(); // cell -> its tags, for the facade to check quickly
const reindexTags = () => { tagIndex = new Map(); for (const t of tags) { if (!tagIndex.has(t.cell)) tagIndex.set(t.cell, []); tagIndex.get(t.cell).push(t); } };
// which face of cell (mx, my) we're looking at, from where we stand
const faceOf = (side, mx, my) => side ? (rel(py - (my + 0.5)) < 0 ? 'N' : 'S') : (rel(px - (mx + 0.5)) < 0 ? 'W' : 'E');
// tag designs: small pieces of ASCII art, or a word in bubble letters, in two colours
const TAG_ART = [
  { art: [' .---. ', '/ o o \\', '\\ \\_/ /', " '---' "], col: () => YEL },
  { art: ['\\^/\\^/\\', ' |#o#| ', " '---' "], col: (c) => c === 'o' ? RED : YEL },
  { art: [' _   _ ', '( \\_/ )', ' \\   / ', '  \\_/  '], col: () => RED },
  { art: ['  /\\_/\\ ', ' ( o.o )', '  > ^ < '], col: (c) => c === 'o' ? GREEN : ORANGE },
  { art: ['  ___ ', ' (o o)', '  |=| ', ' /|_|\\'], col: (c) => c === 'o' ? WHITE : MAG },
  { art: [' \\|||/ ', ' |o o| ', '  \\_/  '], col: (c) => c === 'o' ? WHITE : YEL }, // a crowned face
  { art: ['   /|  ', '  / |  ', ' /__|_ ', '    |/ '], col: () => YEL }, // a lightning bolt
  { art: ['  .--.  ', ' ( @@ ) ', "  '--'  "], col: (c) => c === '@' ? CYAN : BLUE }, // an eye
  { art: ['  *  ', '*****', ' * * '], col: () => MAG }, // a star
];
const TAG_WORDS = ['ACE', 'ZAP', 'YO', 'KAT', 'REX', 'OK', 'WOW', 'RAD', 'BAM', 'HEY', 'GO', 'ART'];
// Append the symbols after the old designs so numeric design IDs in existing saves keep their meaning.
const SYMBOL_DESIGN_START = TAG_ART.length + TAG_WORDS.length;
const designCount = SYMBOL_DESIGN_START + TAG_SYMBOLS.length;

// a mural on this face? deterministic per face, so it's always there
const paintable = k => { const sh = SHOP[k]; return sh && !sh.base && !sh.aqua && !sh.glass && !sh.casino && !sh.exchange && !sh.club && !(STY[k] >= 3 && STY[k] <= 6) && !(STY[k] >= 11 && STY[k] <= 13); };
function muralSeed(k, mx, my, face) {
  if (!paintable(k)) return -1;
  const fx_ = face === 'E' ? 1 : face === 'W' ? -1 : 0, fy = face === 'S' ? 1 : face === 'N' ? -1 : 0;
  if (map[idx(mx + fx_, my + fy)]) return -1; // a wall nobody can see
  const h = hash(mx * 3 + fx_, my * 3 + fy, 601);
  return h < themeAt(mx, my).chance ? hash(mx, my, 602) : -1;
}
const muralPlanCache = new WeakMap();
function muralPlan(seed, th, span = 1.45) {
  let plans = muralPlanCache.get(th);
  if (!plans) { plans = new Map(); muralPlanCache.set(th,plans); }
  const key = seed + ':' + span;
  if (plans.has(key)) return plans.get(key);
  const image = (seed * 7 | 0) % 3 > 0 ? MURAL_IMAGES[th.art[(seed * 911 | 0) % th.art.length]] : null;
  let width = .82, height = .4;
  if (image) {
    // A glyph is about twice as tall as it is wide. Fit the whole picture without stretching its rows.
    height = width * image.height / image.width * 1.85 / span;
    if (height > .72) { width *= .72 / height; height = .72; }
  }
  const plan = { image, width, height, center: .52, span,
    bottom: .52 - height / 2 - .1 / span, top: .52 + height / 2 + .1 / span,
    style: th.styles[(seed * 5 | 0) % th.styles.length], pal: th.pals[(seed * 37 | 0) % th.pals.length] };
  plans.set(key,plan);
  return plan;
}
function muralOpacity(lu, lz, seed, plan) {
  // Paint wears in world coordinates, so walking past it never makes its chips shimmer.
  const ragged = (noise(lu * 25,lz * plan.span * 25,seed * 1703) - .5) * .055;
  const freestanding = plan.image?.blocks;
  const inset = freestanding ? .5 - plan.width / 2 - .015 : .035;
  const bottom = freestanding ? plan.center - plan.height / 2 - .02 / plan.span : plan.bottom;
  const top = freestanding ? plan.center + plan.height / 2 + .02 / plan.span : plan.top;
  const edge = Math.min(lu - inset,1 - inset - lu,(lz - bottom) * plan.span,(top - lz) * plan.span) + ragged;
  const fade = clamp(edge / (freestanding ? .055 : .1),0,1);
  const worn = noise(lu * 48,lz * plan.span * 48,seed * 1301);
  return fade * (.97 + worn * .03);
}
function muralInk(image, ch, cx, cy, pal) {
  if (image.name === 'bear') {
    if (ch === '░') return WHITE;
    return ch === '█' ? GRAY : pal[1];
  }
  if (image.name === 'coffee') {
    if (ch === '░') return WHITE;
    return ch === '▒' ? WARM : BRICK;
  }
  if (image.name === 'dinosaur') return ch === '░' ? pal[0] : GREEN;
  if (image.name === 'island') {
    if (cy === image.height - 1) return CYAN;
    if (ch === '░') return BLUE;
    return cx < 12 ? GREEN : WHITE;
  }
  if (image.name === 'boombox') {
    if (ch === '░') return CYAN;
    return ch === '▒' ? BLUE : WHITE;
  }
  return WHITE;
}
// A mural cell: lu across the face, lz up it (0..1); du/dz are one screen cell's size in those coordinates.
function muralCell(i, lu, lz, seed, L, th, du, dz, span = 1.45) {
  const plan = muralPlan(seed,th,span), { style, pal, image } = plan, lit = Math.max(L * .9,3);
  const opacity = muralOpacity(lu,lz,seed,plan), grain = hash(Math.floor(lu * 135),Math.floor(lz * span * 135),seed * 1999);
  if (opacity <= grain) return false; // transparent overspray and missing flakes reveal the facade below
  // the ground: bands, waves, a sunburst, blobs, mountains, a pop-art dot grid, or (downtown) bare wall for a stencil
  const bgOf = () => {
    if (style === 0) return pal[Math.floor(lz * 3) % 3]; // sunset bands
    if (style === 1) return pal[mod(Math.floor(lz * 6 + Math.sin(lu * 9) * 0.6),3)]; // waves
    if (style === 2) return pal[Math.floor((Math.atan2(lz - 0.15, lu - 0.5) + 3.2) * 3) % 3]; // a sunburst
    if (style === 3) return pal[noise(lu * 4, lz * 4, seed * 50) * 3 | 0]; // blobs
    if (style === 5) return Math.hypot(fract(lu * 12) - 0.5, fract(lz * 8) - 0.5) < 0.3 ? pal[1] : pal[0]; // dots
    if (style === 6) return GRAY; // a plain wall
    return lz < 0.35 + 0.25 * Math.abs(fract(lu * 2.5) - 0.5) ? pal[0] : lz < 0.7 ? pal[1] : pal[2]; // mountains
  };
  if (image) {
    const { width: W, height: H } = image;
    const q = (lu - .5 + plan.width / 2) / plan.width * W, r = (plan.center + plan.height / 2 - lz) / plan.height * H, cx = Math.floor(q), cy = Math.floor(r);
    if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      const ch = image.rows[cy][cx];
      if (ch && ch !== ' ') { // a painted stroke: the cell filled in, the character once in its middle
        let density = 1;
        if (ch === '░') density = .52;
        else if (ch === '▒') density = .74;
        if (grain > opacity * (.8 + density * .2)) return false;
        const ink = muralInk(image,ch,cx,cy,pal);
        const inkLight = image.blocks && ink === GRAY ? lit * .25 : lit * (.7 + opacity * .3);
        // Close up, sample the actual glyph's strokes; at a distance, use the character itself once.
        const big = plan.width / W / du >= 2.2 && plan.height / H / dz >= 2.8;
        if (image.blocks && '░▒▓'.includes(ch) && image.name !== 'island' && image.name !== 'dinosaur') {
          // Tonal block characters describe filled paint, not dozens of disconnected dots. Keep their shapes
          // readable while exposing a few flakes; the outline and eyes still follow their actual glyphs.
          BG[i] = C(ink,lit * (.35 + density * .5));
          let mark = ch;
          if (big) mark = grain > .93 ? '.' : ' ';
          set(i,mark,C(ink,lit * density));
          return true;
        }
        if (big && paintGlyphOn(ch,fract(q),fract(r))) {
          if (image.blocks) BG[i] = C(ink,lit * (ink === GRAY ? .2 : .7));
          return set(i,'#',C(style === 6 ? GRAY : ink,inkLight)), true;
        }
        const mid = oneCell((fract(q) - .5) * plan.width / W,du) && oneCell((fract(r) - .5) * plan.height / H,dz);
        if (!big && (mid || plan.width / W < du * 1.5)) {
          set(i,ch,C(style === 6 ? GRAY : ink,inkLight));
          return true;
        }
      }
    }
    if (image.blocks) return false; // freestanding artwork; the real wall surrounds it
  } else {
    const word = th.words[(seed * 911 | 0) % th.words.length], n = word.length * 4 - 1;
    const gx = Math.floor((lu - 0.06) / 0.88 * n), gy = Math.floor((0.72 - lz) / 0.4 * 5), li = Math.floor(gx / 4), lx = gx % 4;
    const on = (x, y) => { const l = Math.floor(x / 4), xx = x % 4; return x >= 0 && x < n && xx < 3 && glyphOn(word[l], xx, y); };
    if (gx >= 0 && gx < n && gy >= -1 && gy <= 5) {
      if (lx < 3 && on(gx, gy)) { BG[i] = C(WHITE, lit * 0.8); return set(i, '#', C(pal[(li + 1) % 3], lit)); }
      if (on(gx - 1, gy) || on(gx + 1, gy) || on(gx, gy - 1) || on(gx, gy + 1)) { BG[i] = C(GRAY, 1); return set(i, ' ', 0); } // the outline
    }
  }
  if (style === 6) return false; // (a stencil on bare wall: the wall shows round it)
  BG[i] = C(bgOf(),lit * (.24 + opacity * .21));
  return set(i, hash(Math.floor(lu * 40), Math.floor(lz * 40), seed * 99) > 0.93 ? '*' : ' ', C(WHITE, lit)), true; // spatter
}
// a quick tag's letters, sprayed straight on the wall: only the letters themselves (the wall shows between them)
function tagText(i, u, uStep, z, d, text, u0, z0, col) {
  const glyphs = paintGlyphs(text), cw_ = .028, height = cw_ * 1.85, dz = d / projY;
  if (Math.abs(z - z0) > Math.max(dz,height) / 2) return false;
  const q = (u - u0) / cw_ + glyphs.length / 2, p = Math.floor(q);
  if (p < 0 || p >= glyphs.length || glyphs[p] === ' ') return false;
  if (cw_ / uStep >= 2.2 && height / dz >= 2.8) {
    if (!paintGlyphOn(glyphs[p],fract(q),(z0 + height / 2 - z) / height)) return false;
    return set(i,'#',col), true;
  }
  if (!(uStep >= cw_ || oneCell((fract(q) - 0.5) * cw_, uStep)) || !oneCell(z - z0, dz)) return false;
  return set(i,glyphs[p],col), true;
}
// street tags on this face: up to two quick names low down, near the corners (clear of the door), in the district's colours
const streetTagCache = new Map();
const PAINT_FACE = { N: 0, S: 1, E: 2, W: 3 };
function streetTags(k, mx, my, face) {
  if (!paintable(k)) return null;
  const fx_ = face === 'E' ? 1 : face === 'W' ? -1 : 0, fy = face === 'S' ? 1 : face === 'N' ? -1 : 0, th = themeAt(mx, my), out = [];
  if (map[idx(mx + fx_, my + fy)]) return null;
  const key = k * 4 + PAINT_FACE[face];
  if (streetTagCache.has(key)) return streetTagCache.get(key);
  for (const s of [0, 1]) {
    const h = hash(mx * 5 + fx_ + s * 17, my * 5 + fy, 611);
    if (h >= th.tags) continue;
    const word = STREET_MARKS[hash(mx + s,my,612) * STREET_MARKS.length | 0].replace(/E/g,hash(mx,my + s,613) > .6 ? '3' : 'E').replace(/A/g,hash(mx,my + s,614) > .6 ? '4' : 'A');
    const half = paintGlyphs(word).length * .028 / 2;
    const at = clamp(s ? .78 + hash(mx,my + s,615) * .1 : .12 + hash(mx,my + s,615) * .1,half + .045,1 - half - .045);
    out.push({ word,half,at,z: .12 + hash(mx + s,my,616) * .12,col: th.pals[hash(mx,my,617) * th.pals.length | 0][s + 1] });
  }
  const result = out.length ? out : null;
  streetTagCache.set(key,result);
  return result;
}
// a tag cell: q across it (0..1, left to right), r down it (0..1)
function tagCell(i, q, r, t, L) {
  const lit = Math.max(L * 1.1, 5);
  if (t.design < TAG_ART.length) {
    const d = TAG_ART[t.design], W = Math.max(...d.art.map(l => l.length)), ch = (d.art[Math.floor(r * d.art.length)] || '')[Math.floor(q * W)];
    if (!ch || ch === ' ') return false;
    return set(i, ch, C(d.col(ch), lit)), true;
  }
  if (t.design >= SYMBOL_DESIGN_START) {
    const glyphs = paintGlyphs(TAG_SYMBOLS[t.design - SYMBOL_DESIGN_START] || '');
    if (r < .25 || r > .75 || q < 0 || q >= 1) return false;
    const ch = glyphs[Math.floor(q * glyphs.length)];
    if (!ch || ch === ' ') return false;
    return set(i,ch,C([MAG,CYAN,GREEN,ORANGE][t.design & 3],lit)), true;
  }
  const word = TAG_WORDS[t.design - TAG_ART.length], n = word.length * 4 - 1, gx = Math.floor(q * n), gy = Math.floor(r * 5);
  if (gx % 4 < 3 && glyphOn(word[Math.floor(gx / 4)], gx % 4, gy)) { BG[i] = C([MAG, CYAN, GREEN, ORANGE][t.design & 3], lit * 0.5); return set(i, '#', C(WHITE, lit)), true; }
  return false;
}
// the facade asks first: graffiti here? (true if it painted the cell)
function graffitiCell(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const k = idx(mx, my), face = faceOf(side, mx, my), L = fog * amb * (side ? 10 : 15), flip = u < 0 !== wc < 0 ? -1 : 1;
  const mine = tagIndex.get(k);
  if (mine) for (const t of mine) {
    if (t.face !== face || Math.abs(rel(wc - t.u)) > TAG_W / 2 || Math.abs(z - t.z) > TAG_H / 2) continue;
    if (t.design >= SYMBOL_DESIGN_START && t.design < designCount) {
      const u0 = u - rel(wc - t.u) * flip;
      if (tagText(i,u,uStep,z,d,TAG_SYMBOLS[t.design - SYMBOL_DESIGN_START],u0,t.z,C([MAG,CYAN,GREEN,ORANGE][t.design & 3],Math.max(L * 1.1,5)))) return true;
      continue;
    }
    const q = rel(wc - t.u) / TAG_W * flip + 0.5, r = (t.z + TAG_H / 2 - z) / TAG_H;
    if (tagCell(i, q, r, t, L)) return true;
  }
  if (z < 0.33 && d < 6) { // the quick tags low down
    const st = streetTags(k, mx, my, face);
    if (st) for (const t of st) {
      const lu = flip > 0 ? fract(wc) : 1 - fract(wc), u0 = u + (t.at - lu); // (the tag's centre, in u)
      if (Math.abs(lu - t.at) > t.half + uStep) continue;
      if (tagText(i, u, uStep, z, d, t.word, u0, t.z, C(t.col, Math.max(L * 1.1, 5)))) return true;
    }
  }
  if (z < 0.45 || z > Math.min(h - 0.1, 1.9)) return false;
  const seed = muralSeed(k, mx, my, face);
  if (seed < 0) return false;
  const f = fract(wc), top = Math.min(h - 0.1, 1.9);
  return muralCell(i, flip > 0 ? f : 1 - f, (z - .45) / (top - .45),seed,L,themeAt(mx,my),uStep,d / projY / (top - .45),top - .45) !== false;
}

// ---- spraying: hold the can, face a wall up close, Q
function sprayTarget() {
  if (mode !== 'walk' || !lookHit || lookHit.d > 0.3) return null;
  const k = idx(lookHit.mx, lookHit.my);
  if (!map[k] || STY[k] >= 3 && STY[k] <= 6) return null; // (not the landmarks)
  const hx = px + Math.cos(a) * lookHit.d, hy = py + Math.sin(a) * lookHit.d, fx_ = fract(hx), fy = fract(hy);
  const ex = Math.min(fx_, 1 - fx_), ey = Math.min(fy, 1 - fy), side = ey < ex; // which edge of the cell we hit
  const face = faceOf(side, lookHit.mx, lookHit.my);
  return { cell: k, face, u: side ? mod(hx, N) : mod(hy, N), z: 0.16 };
}
function sprayTag() {
  const it = heldItem(), tg = sprayTarget();
  if (!tg) return say(mode === 'walk' ? 'Get up close to a wall.' : 'Not here.');
  if (tags.some(t => t.cell === tg.cell && t.face === tg.face && Math.abs(rel(t.u - tg.u)) < TAG_W)) return say('There\'s a tag there already. Find a clean wall.');
  tags.push({ ...tg, design: Math.random() * designCount | 0 });
  if (tags.length > TAG_MAX) tags.shift(); // (the council scrubs the oldest)
  reindexTags();
  if (actx) burst(actx.currentTime, 1.1, [filt('highpass', 3500, 0.7)], 0.14); // psssssht
  const empty = --it.uses <= 0;
  if (empty) removeHeld();
  const w = crime('graffiti', px, py);
  say((w === 'cop' ? '"HEY! You! Drop the can!"' : w === 'reported' ? 'Psssht. Somebody across the street gets their phone out.' : pick(['Psssht. Nice.', 'Psssht. Your mark on the city.', 'Psssht. Nobody saw. Probably.'])) + (empty ? ' The can rattles empty.' : ''), 3);
}
