// ===== graffiti: murals painted across some buildings' upper floors (more on the docks, fewer downtown), and the tags
// you spray yourself with a can from the hardware store. Police don't like it: spraying is vandalism, and if a cop
// sees you, you're wanted. Your tags stay where you put them (save.js keeps them).
const MURAL_WORDS = ['ASCII', 'DREAM', 'LOVE', 'CITY', 'HOPE', 'WAVE', 'NOW', 'YES', 'GLOW', 'ZAP', 'RISE', 'FREE'];
const MURAL_CHANCE = { industrial: 0.16, brownstones: 0.06, midtown: 0.07, chinatown: 0.04, downtown: 0.025 };
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
];
const TAG_WORDS = ['ACE', 'ZAP', 'YO', 'KAT', 'REX', 'OK', 'WOW', 'RAD'];
const designCount = TAG_ART.length + TAG_WORDS.length;

// a mural on this face? deterministic per face, so it's always there
function muralSeed(k, mx, my, face) {
  const sh = SHOP[k];
  if (!sh || sh.base || sh.aqua || sh.glass || STY[k] >= 3 && STY[k] <= 6 || STY[k] >= 11 && STY[k] <= 13) return -1;
  const fx_ = face === 'E' ? 1 : face === 'W' ? -1 : 0, fy = face === 'S' ? 1 : face === 'N' ? -1 : 0;
  if (map[idx(mx + fx_, my + fy)]) return -1; // a wall nobody can see
  const h = hash(mx * 3 + fx_, my * 3 + fy, 601);
  return h < (MURAL_CHANCE[districtAt(mx, my)] || 0.05) ? hash(mx, my, 602) : -1;
}
// a mural cell: lu across the face (0..1, left to right on screen), lz up it (0..1)
function muralCell(i, lu, lz, seed, L) {
  const style = seed * 5 | 0, lit = Math.max(L * 0.9, 3), pal = [[MAG, ORANGE, YEL], [BLUE, CYAN, GREEN], [RED, MAG, BLUE], [GREEN, YEL, ORANGE], [CYAN, MAG, WHITE]][(seed * 37 | 0) % 5];
  // the ground: bands, waves, a sunburst, blobs or mountains
  const bgOf = () => {
    if (style === 0) return pal[Math.floor(lz * 3) % 3]; // sunset bands
    if (style === 1) return pal[Math.floor(lz * 6 + Math.sin(lu * 9) * 0.6) % 3]; // waves
    if (style === 2) return pal[Math.floor((Math.atan2(lz - 0.15, lu - 0.5) + 3.2) * 3) % 3]; // a sunburst
    if (style === 3) return pal[noise(lu * 4, lz * 4, seed * 50) * 3 | 0]; // blobs
    return lz < 0.35 + 0.25 * Math.abs(fract(lu * 2.5) - 0.5) ? pal[0] : lz < 0.7 ? pal[1] : pal[2]; // mountains
  };
  // over it, a word in big bubble letters with a dark outline
  const word = MURAL_WORDS[(seed * 911 | 0) % MURAL_WORDS.length], n = word.length * 4 - 1;
  const gx = Math.floor((lu - 0.06) / 0.88 * n), gy = Math.floor((0.72 - lz) / 0.4 * 5), li = Math.floor(gx / 4), lx = gx % 4;
  const on = (x, y) => { const l = Math.floor(x / 4), xx = x % 4; return x >= 0 && x < n && xx < 3 && glyphOn(word[l], xx, y); };
  if (gx >= 0 && gx < n && gy >= -1 && gy <= 5) {
    if (lx < 3 && on(gx, gy)) { BG[i] = C(WHITE, lit * 0.8); return set(i, '#', C(pal[(li + 1) % 3], lit)); }
    if (on(gx - 1, gy) || on(gx + 1, gy) || on(gx, gy - 1) || on(gx, gy + 1)) { BG[i] = C(GRAY, 1); return set(i, ' ', 0); } // the outline
  }
  BG[i] = C(bgOf(), lit * 0.45);
  return set(i, hash(Math.floor(lu * 40), Math.floor(lz * 40), seed * 99) > 0.93 ? '*' : ' ', C(WHITE, lit)); // spatter
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
  if (z < 0.45 || z > Math.min(h - 0.1, 1.9)) return false;
  const seed = muralSeed(k, mx, my, face);
  if (seed < 0) return false;
  const f = fract(wc);
  return muralCell(i, flip > 0 ? f : 1 - f, (z - 0.45) / (Math.min(h - 0.1, 1.9) - 0.45), seed, L), true;
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
