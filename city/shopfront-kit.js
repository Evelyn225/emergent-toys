// A shop's front, after Cabin Cove's lesson: depth from tone. Every shop picks a style from its name: a painted
// timber front, a glazed-tile front, a polished granite one, an aluminium modern one, or brick with arched lights.
// Each has its own stallriser under the window, sill, glazing bars, transom lights and pilasters. Frames are
// bevelled (lit along their upper and left edges, shaded along the others), glass reflects the sky (lighter
// upward, a diagonal sheen up close) with the reveal's shadow under the head and down one side, sills catch the
// light and cast a shadow below. Fine detail fades with the cell's footprint, so a far front settles calmly.
// Units: city units (1 = 10 m). a: across the opening from its left edge, 0..w; z: up from the pavement.
const SF_KIT_STYLES = [
  { kind: 'timber', riser: 'panel', bars: [.5], transom: true, pilaster: true, paints: [GREEN, RED, BLUE, BLACK, CYAN, BRICK] },
  { kind: 'tile', riser: 'tile', bars: [.33, .67], transom: true, pilaster: false, paints: [GREEN, BLUE, BRICK, YEL, CYAN] },
  { kind: 'granite', riser: 'granite', bars: [], transom: false, pilaster: true, paints: [BLACK, GRAY, BRICK] },
  { kind: 'modern', riser: 'metal', bars: [.5], transom: false, pilaster: false, paints: [GRAY, WHITE, BLACK] },
  { kind: 'arched', riser: 'brick', bars: [.25, .5, .75], transom: true, pilaster: true, paints: [WHITE, STONE, GREEN, RED] },
];
const SF_KIT_STYLE_OF = new WeakMap();
function shopfrontStyle(sh) {
  let s = SF_KIT_STYLE_OF.get(sh);
  if (s) return s;
  let h = 17;
  for (const ch of sh.word || '') h = (h * 31 + ch.charCodeAt(0)) | 0;
  const r = j => hash(h & 0xffff, (h >>> 16) & 0xffff, 1600 + j);
  const st = SF_KIT_STYLES[(r(0) * SF_KIT_STYLES.length) | 0];
  s = { ...st, paint: st.paints[(r(1) * st.paints.length) | 0], accent: [YEL, WHITE, RED, GREEN, BLUE][(r(2) * 5) | 0], seed: h & 0xffff };
  SF_KIT_STYLE_OF.set(sh, s);
  return s;
}
// paint levels sit a little higher on dark colours, so a black front still shows its bevels
const sfPaint = (col, lvl) => C(col, col === BLACK ? lvl * .55 + 1.2 : lvl);
// a bar's bevel across its width: s in -1..1 from its left/lower edge to its right/upper one; up close only
const sfBevel = (s, fine) => 1 + (s > .45 ? .28 : s < -.45 ? -.3 : 0) * fine;
// glass: the sky reflected, lighter toward the top, a diagonal sheen up close; the reveal's shadow under the head
// and down the left; lit from inside when the shop's lights are on
function sfGlass(i, a, z, z0, z1, w, lit, L, fine, seed) {
  const up = clamp((z - z0) / (z1 - z0), 0, 1), reveal = Math.max(clamp(1 - (z1 - z) / .012, 0, 1), clamp(1 - a / .01, 0, 1));
  // one or two soft diagonal streaks of reflected sky per pane, not a regular stripe
  const diag = a * .8 + z, streak = Math.max(0, 1 - Math.abs(fract(diag * 2.2 + seed * .37) - .3) / .07), streak2 = Math.max(0, 1 - Math.abs(fract(diag * 2.2 + seed * .37) - .42) / .025);
  const sheen = fine > .2 ? (streak * .7 + streak2 * .5) * fine : 0;
  if (lit) { BG[i] = C(WARM, (1.6 + night * 3.2 + up * .5) * (1 - reveal * .45) + sheen * .4); return; }
  BG[i] = C(CYAN, (.9 + day * 1.4 + up * (.6 + day)) * (1 - reveal * .5) + sheen);
}
// the opening's parts, top to bottom: head (frame), transom lights, the glass with its bars, the sill, the stallriser
function shopfrontBay(i, a, w, z, z0, z1, sh, L, fp, lit, d) {
  const st = shopfrontStyle(sh), fine = clamp(1 - fp / .02, 0, 1), paint = st.paint;
  const frame = (s = 0) => { BG[i] = sfPaint(paint, (1.9 + L * .28) * sfBevel(s, fine)); };
  set(i, ' ', 0);
  const riserTop = z0 + .055, sillTop = riserTop + .008, head = z1 - .016, transom = st.transom ? head - .035 : head;
  const side = st.pilaster ? .022 : .01;
  // pilasters (or a plain frame) at either side; a capital where they meet the head
  if (a < side || w - a < side) {
    const e = a < side ? a / side : (w - a) / side; // 0 at the outer edge, 1 at the glass
    if (st.pilaster && z > head - .02) { BG[i] = sfPaint(paint, (2.3 + L * .3) * sfBevel(.6, fine)); return; } // the capital
    const flute = st.pilaster && fine > .3 && Math.abs(fract(e * 2) - .5) < .12;
    return frame(e < .2 ? .7 : e > .8 ? -.7 : flute ? -.5 : 0);
  }
  const ga = a - side, gw = w - 2 * side; // across the glass
  if (z > head) return frame(z > head + .01 ? .7 : 0); // the head
  if (z < riserTop) return stallriser(i, ga, gw, z - z0, riserTop - z0, st, L, fp, fine);
  if (z < sillTop) { BG[i] = sfPaint(st.kind === 'modern' ? GRAY : paint === BLACK ? STONE : paint, (2.4 + L * .32) * (z > sillTop - .003 ? 1.15 : .9)); return; } // the sill, its top catching the light
  const shadowUnderSill = z < sillTop + .006 && fine > .2;
  // the transom: a band of small lights over the main glass
  if (z > transom) {
    const bar = Math.abs(z - transom) < .004 || fine > .2 && Math.abs(fract(ga / gw * 6) - .5) > .45;
    if (bar) return frame(z - transom < .002 ? -.7 : .6);
    if (st.kind === 'arched') { // little arched heads to each light
      const k = fract(ga / gw * 6), crown = transom + .02 + Math.sqrt(Math.max(0, .25 - (k - .5) ** 2)) * .03;
      if (z > crown) return frame(.3);
    }
    return sfGlass(i, ga, z, transom, head, gw, lit, L, fine, st.seed + 7);
  }
  // glazing bars: wider than half a cell, drawn with their bevel; thinner, a shade on the glass
  for (const b of st.bars) {
    const dist = ga - b * gw, cov = facadeLine(Math.abs(dist), .012, fp);
    if (cov > .5) return frame(fine > .3 ? clamp(dist / .006, -1, 1) : 0);
  }
  sfGlass(i, ga, z, sillTop, transom, gw, lit, L, fine, st.seed);
  if (shadowUnderSill) BG[i] = C(BG[i] >> 4, (BG[i] & 15) * .8);
}
// under the window: what each style puts there
function stallriser(i, a, w, h, H, st, L, fp, fine) {
  const top = h > H - .006; // its capping
  if (st.riser === 'panel') { // a timber panel with a raised moulding round its field
    const m = .008, inField = a > m && a < w - m && h > m && h < H - m, edgeLit = inField && (a < m * 2 || h > H - m * 2), edgeDark = inField && (a > w - m * 2 || h < m * 2);
    BG[i] = sfPaint(st.paint, (1.7 + L * .26) * (top ? 1.15 : edgeLit && fine > .2 ? 1.18 : edgeDark && fine > .2 ? .78 : inField ? .95 : 1.05)); return;
  }
  if (st.riser === 'tile') { // glazed tiles: a glossy square each, a highlight in its upper corner, grout round it
    const t = .012, tu = fract(a / t), tz = fract(h / t), grout = fine > .3 && (tu < .1 || tz < .1);
    const gloss = fine > .4 && tu > .15 && tu < .4 && tz > .6 && tz < .85;
    BG[i] = grout ? C(WHITE, 2 + L * .15) : C(st.paint, (2 + L * .28) * (gloss ? 1.35 : .95 + hash(Math.floor(a / t), Math.floor(h / t), st.seed) * .12)); return;
  }
  if (st.riser === 'granite') { // polished dark stone: flecks up close, a sheen
    const fleck = fine > .3 && hash(Math.floor(a * 900), Math.floor(h * 900), st.seed) > .86;
    BG[i] = C(st.paint === GRAY ? GRAY : BLACK, (top ? 2.2 : 1.2 + L * .1) + (fleck ? 1.2 : 0) + (fract((a + h) * 8) < .1 ? .5 * fine : 0)); return;
  }
  if (st.riser === 'metal') { BG[i] = C(GRAY, (1.9 + L * .25) * (top ? 1.2 : 1) - coveGroove(a, .03, .002, fp) * .6); return; } // a brushed panel, its seams
  return brickFace(i, a, h, BRICK, L, fp, st.seed); // brick
}
// brick: each brick its own tone, mortar lighter in the joints; settles to the wall's colour far off
function brickFace(i, a, z, base, L, fp, seed = 0, lift = 0) {
  // real brick: 7.5 cm courses, 23 cm long, 1 cm joints (city units are 10 m)
  const course = .0075, len = .023, row = Math.floor(z / course), off = (row & 1) * len / 2, k = Math.floor((a + off) / len);
  const fine = clamp(1 - fp / .008, 0, 1), j = Math.max(coveGroove(z, course, .001, fp), coveGroove(a + off, len, .001, fp));
  const tone = (hash(k, row, 1700 + seed) - .5) * 2 * fine;
  BG[i] = j > .5 && fine > .2 ? C(STONE, 1.9 + L * .2 + lift) : C(base, 1.6 + L * .22 + lift + tone + j * .6); // (far off the light mortar lifts the brick's average a little)
}

// a building's own wall beside and above its shopfronts: brick (each brick its own tone), painted render (a soft
// mottle and a plinth), or stone blocks (each block its own tone, the joints filtered)
function shopWall(i, a, z, sty, L, fp, seed) {
  const fine = clamp(1 - fp / .012, 0, 1);
  if (sty === 2 || sty === 8) return brickFace(i, a, z, BRICK, L, fp, seed);
  if (sty === 15) { // painted render over a dark plinth
    if (z < .04) { BG[i] = C(GRAY, 1.3 + L * .15 - coveGroove(a, .1, .003, fp) * .5); return; }
    BG[i] = C(STONE, 2.1 + L * .24 + (noise(a * 40, z * 40, 1701 + seed) - .5) * .5 * fine + (noise(a * 6, z * 6, 1702) - .5) * .3); return;
  }
  const bl = .06, bh = .03, row = Math.floor(z / bh), off = (row & 1) * bl / 2, k = Math.floor((a + off) / bl); // ashlar
  const j = Math.max(coveGroove(z, bh, .003, fp), coveGroove(a + off, bl, .003, fp));
  BG[i] = C(GRAY, 1.9 + L * .24 + (hash(k, row, 1703 + seed) - .5) * .7 * fine - j * .7);
}
// An upper-floor window, after the shopfronts: a bevelled frame round glass that reflects the sky (or glows when
// lit), the reveal's shadow under the head, a sill that catches the light. a: across from its left edge, 0..w;
// z: up from its sill, 0..h (city units). True if (i) fell on it.
function facadeWindow(i, a, w, z, h, lit, litCol, L, fp, frame, seed, bars = 1) {
  const fw = .007, fine = clamp(1 - fp / .02, 0, 1);
  if (a < -fw || a > w + fw || z < -fw * 1.4 || z > h + fw) return false;
  set(i, ' ', 0);
  if (z < 0) { BG[i] = sfPaint(frame, (2.5 + L * .3) * (z > -.003 ? 1.18 : .9)); return true; } // the sill, its lip lit
  if (a < 0 || a > w || z > h) { // the frame: lit along its outer top and left edges, shaded on the others
    const s = z > h ? (z > h + fw * .5 ? .7 : -.5) : a < 0 ? (a < -fw * .5 ? .7 : -.4) : (a > w + fw * .5 ? -.7 : .3);
    BG[i] = sfPaint(frame, (2 + L * .28) * sfBevel(s, fine)); return true;
  }
  for (let k = 1; k <= bars; k++) if (facadeLine(Math.abs(a - w * k / (bars + 1)), .007, fp) > .5) { BG[i] = sfPaint(frame, (1.9 + L * .26) * sfBevel(a < w * k / (bars + 1) ? .6 : -.6, fine)); return true; } // glazing bars
  if (lit) { BG[i] = C(litCol, (1.6 + night * 3.2 + z / h * .5) * (1 - clamp(1 - (h - z) / .01, 0, 1) * .4)); return true; }
  sfGlass(i, a, z, 0, h, w, false, L, fine, seed);
  return true;
}
// corrugated sheet: ribs every 7.5 cm, a lit crest and a shadowed trough up close, an even tone far off
function corrugated(i, a, base, L, fp, lift = 0) {
  const fine = clamp(1 - fp / .02, 0, 1), f = fract(a / .0075);
  BG[i] = C(base, 1.7 + L * .24 + lift + (f < .3 ? .5 : f > .65 ? -.45 : 0) * fine);
}
