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
};
const MURAL_THEMES = {
  industrial: { chance: 0.08, tags: 0.3, words: ['DOCKS', 'RUST', 'HAUL', 'STEEL', 'PORT', 'GRIT'], art: ['anchor', 'ship', 'wild', 'wild'], styles: [4, 1, 3], pals: [[ORANGE, BRICK, YEL], [GRAY, ORANGE, CYAN], [RED, YEL, GRAY]] },
  chinatown: { chance: 0.02, tags: 0.08, words: ['LUCK', 'JADE', 'TEA', 'FORTUNE'], art: ['dragon', 'koi', 'lantern'], styles: [0, 2], pals: [[RED, YEL, ORANGE], [RED, GREEN, YEL]] },
  brownstones: { chance: 0.03, tags: 0.1, words: ['PEACE', 'HOME', 'BLOCK', 'LOVE'], art: ['flowers', 'sun', 'heart'], styles: [0, 3, 4], pals: [[GREEN, YEL, MAG], [BLUE, YEL, WHITE], [ORANGE, GREEN, CYAN]] },
  midtown: { chance: 0.035, tags: 0.15, words: ['POP', 'NOW', 'WOW', 'CITY', 'ZAP'], art: ['checker', 'eyes', 'heart'], styles: [5, 2, 3], pals: [[MAG, CYAN, YEL], [RED, BLUE, YEL], [CYAN, MAG, WHITE]] },
  downtown: { chance: 0.01, tags: 0.03, words: ['LOOK UP', 'RISE', 'DREAM'], art: ['balloon'], styles: [6], pals: [[GRAY, WHITE, RED]] },
  shotengai: { chance: 0.03, tags: 0.18, words: ['NEKO', 'KAWAII', 'GO GO'], art: ['cat', 'eyes', 'cat'], styles: [5, 1], pals: [[MAG, CYAN, WHITE], [YEL, MAG, BLUE]] },
  waterfront: { chance: 0.03, tags: 0.12, words: ['SURF', 'WAVE', 'SUN', 'TIDE'], art: ['wave', 'fish', 'sun'], styles: [1, 0], pals: [[CYAN, BLUE, YEL], [BLUE, WHITE, ORANGE]] },
};
const themeAt = (mx, my) => MURAL_THEMES[districtAt(mx, my)] || MURAL_THEMES.midtown;
// the quick tags on shutters and doors: a name, written fast, a flourish
const STREET_TAGS = ['KAT', 'REX', 'ZEN', 'MOE', 'DUKE', 'JINX', 'NOX', 'VEX', 'SKY', 'BOO', 'ACE', 'OZ', 'RAZE', 'FLY'];
const TAG_FLOURISH = ['^^^', '~~~', '->', '*', '!!', '<3', '==='];
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
const designCount = TAG_ART.length + TAG_WORDS.length;

// a mural on this face? deterministic per face, so it's always there
const paintable = k => { const sh = SHOP[k]; return sh && !sh.base && !sh.aqua && !sh.glass && !sh.casino && !sh.exchange && !(STY[k] >= 3 && STY[k] <= 6) && !(STY[k] >= 11 && STY[k] <= 13); };
function muralSeed(k, mx, my, face) {
  if (!paintable(k)) return -1;
  const fx_ = face === 'E' ? 1 : face === 'W' ? -1 : 0, fy = face === 'S' ? 1 : face === 'N' ? -1 : 0;
  if (map[idx(mx + fx_, my + fy)]) return -1; // a wall nobody can see
  const h = hash(mx * 3 + fx_, my * 3 + fy, 601);
  return h < themeAt(mx, my).chance ? hash(mx, my, 602) : -1;
}
// a mural cell: lu across the face (0..1, left to right on screen), lz up it (0..1); du, dz: one screen cell's size in those
function muralCell(i, lu, lz, seed, L, th, du, dz) {
  const sts = th.styles, style = sts[(seed * 5 | 0) % sts.length], lit = Math.max(L * 0.9, 3), pal = th.pals[(seed * 37 | 0) % th.pals.length];
  // the ground: bands, waves, a sunburst, blobs, mountains, a pop-art dot grid, or (downtown) bare wall for a stencil
  const bgOf = () => {
    if (style === 0) return pal[Math.floor(lz * 3) % 3]; // sunset bands
    if (style === 1) return pal[Math.floor(lz * 6 + Math.sin(lu * 9) * 0.6) % 3]; // waves
    if (style === 2) return pal[Math.floor((Math.atan2(lz - 0.15, lu - 0.5) + 3.2) * 3) % 3]; // a sunburst
    if (style === 3) return pal[noise(lu * 4, lz * 4, seed * 50) * 3 | 0]; // blobs
    if (style === 5) return Math.hypot(fract(lu * 12) - 0.5, fract(lz * 8) - 0.5) < 0.3 ? pal[1] : pal[0]; // dots
    if (style === 6) return GRAY; // a plain wall
    return lz < 0.35 + 0.25 * Math.abs(fract(lu * 2.5) - 0.5) ? pal[0] : lz < 0.7 ? pal[1] : pal[2]; // mountains
  };
  const pick_ = (seed * 7 | 0) % 3; // over it: a picture (most of the time) or a word in big bubble letters
  if (pick_ > 0) {
    const art = MURAL_ART[th.art[(seed * 911 | 0) % th.art.length]], W = Math.max(...art.map(l => l.length)), H = art.length;
    const q = (lu - 0.12) / 0.76 * W, r = (0.82 - lz) / 0.64 * H, cx = Math.floor(q), cy = Math.floor(r);
    if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      const ch = art[cy][cx];
      if (ch && ch !== ' ') { // a painted stroke: the cell filled in, the character once in its middle
        BG[i] = style === 6 ? C(GRAY, 0.6) : C(pal[(cx + cy) % 3 === 0 ? 2 : 1], lit * 0.75); // (downtown: black stencil paint)
        const mid = oneCell((fract(q) - 0.5) * 0.76 / W, du) && oneCell((fract(r) - 0.5) * 0.64 / H, dz);
        return set(i, mid || 0.76 / W < du * 1.5 ? ch : ' ', C(WHITE, style === 6 ? lit * 0.4 : lit));
      }
    }
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
  BG[i] = C(bgOf(), lit * 0.45);
  return set(i, hash(Math.floor(lu * 40), Math.floor(lz * 40), seed * 99) > 0.93 ? '*' : ' ', C(WHITE, lit)), true; // spatter
}
// a quick tag's letters, sprayed straight on the wall: only the letters themselves (the wall shows between them)
function tagText(i, u, uStep, z, d, text, u0, z0, col) {
  const cw_ = 0.028, dz = d / projY;
  if (Math.abs(z - z0) > Math.max(dz, 0.012) / 2) return false;
  const q = (u - u0) / cw_ + text.length / 2, p = Math.floor(q);
  if (p < 0 || p >= text.length || text[p] === ' ') return false;
  if (!(uStep >= cw_ || oneCell((fract(q) - 0.5) * cw_, uStep)) || !oneCell(z - z0, dz)) return false;
  BG[i] = bgAt(FACADE_BG[STY[WH.k]], day * 3 * (0.45 + 0.55 * (1 - d / vis)), d); // (the wall's own colour round the letter)
  return set(i, text[p], col), true;
}
// street tags on this face: up to two quick names low down, near the corners (clear of the door), in the district's colours
function streetTags(k, mx, my, face) {
  if (!paintable(k)) return null;
  const fx_ = face === 'E' ? 1 : face === 'W' ? -1 : 0, fy = face === 'S' ? 1 : face === 'N' ? -1 : 0, th = themeAt(mx, my), out = [];
  if (map[idx(mx + fx_, my + fy)]) return null;
  for (const s of [0, 1]) {
    const h = hash(mx * 5 + fx_ + s * 17, my * 5 + fy, 611);
    if (h >= th.tags) continue;
    const word = STREET_TAGS[hash(mx + s, my, 612) * STREET_TAGS.length | 0].replace(/E/g, hash(mx, my + s, 613) > 0.6 ? '3' : 'E').replace(/A/g, hash(mx, my + s, 614) > 0.6 ? '4' : 'A');
    out.push({ word, at: s ? 0.78 + hash(mx, my + s, 615) * 0.1 : 0.12 + hash(mx, my + s, 615) * 0.1, z: 0.12 + hash(mx + s, my, 616) * 0.12,
      col: th.pals[hash(mx, my, 617) * th.pals.length | 0][s + 1], fl: TAG_FLOURISH[hash(mx + s, my + s, 618) * TAG_FLOURISH.length | 0] });
  }
  return out.length ? out : null;
}
// a tag cell: q across it (0..1, left to right), r down it (0..1)
function tagCell(i, q, r, t, L) {
  const lit = Math.max(L * 1.1, 5);
  if (t.design < TAG_ART.length) {
    const d = TAG_ART[t.design], W = Math.max(...d.art.map(l => l.length)), ch = (d.art[Math.floor(r * d.art.length)] || '')[Math.floor(q * W)];
    if (!ch || ch === ' ') return false;
    return set(i, ch, C(d.col(ch), lit)), true;
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
    const q = rel(wc - t.u) / TAG_W * flip + 0.5, r = (t.z + TAG_H / 2 - z) / TAG_H;
    if (tagCell(i, q, r, t, L)) return true;
  }
  if (z < 0.33 && d < 6) { // the quick tags low down
    WH.k = k;
    const st = streetTags(k, mx, my, face);
    if (st) for (const t of st) {
      const lu = flip > 0 ? fract(wc) : 1 - fract(wc), u0 = u + (t.at - lu); // (the tag's centre, in u)
      if (Math.abs(lu - t.at) > 0.12) continue;
      if (tagText(i, u, uStep, z, d, t.word, u0, t.z, C(t.col, Math.max(L * 1.1, 5)))) return true;
      if (tagText(i, u, uStep, z, d, t.fl, u0 + 0.02, t.z - 0.03, C(t.col, Math.max(L, 4)))) return true;
    }
  }
  if (z < 0.45 || z > Math.min(h - 0.1, 1.9)) return false;
  const seed = muralSeed(k, mx, my, face);
  if (seed < 0) return false;
  const f = fract(wc), top = Math.min(h - 0.1, 1.9);
  return muralCell(i, flip > 0 ? f : 1 - f, (z - 0.45) / (top - 0.45), seed, L, themeAt(mx, my), uStep, d / projY / (top - 0.45)) !== false;
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
