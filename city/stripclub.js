// ===== the Velvet Rope: a strip club in midtown (world.js puts it up). Outside: a black front, XXX in pink neon
// blinking, GIRLS GIRLS GIRLS and LIVE DANCERS, a neon martini, a velvet rope and a bouncer who won't let you in with
// the police on your tail. $20 at the door, 8pm to 4am. Inside: purple and pink, a stage with three poles and a
// dancer on each (in sequins, spinning), a bar, cocktail tables with punters you can talk to, and the VIP booth at the back where $40 buys a private dance: very
// much like a certain game's, except the dancer is six characters, all in.
const CLUB_FEE = 20, LAPDANCE = 40;
function clubFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), glow = Math.max(night, overcast * 0.5, 0.3), sgn = Math.sign(u * wc) || 1;
  const c = CLUB, y0 = c.by * 8 + 2, a0 = side ? c.bx * 8 + 2 : y0, along = wc - a0, len = side ? 6 : 4;
  const front = side && Math.abs(rel((my + (rel(py - my) < 0 ? 0 : 1)) - y0)) < 0.01, blink = fract(T * 1.3) < 0.7;
  BG[i] = C(GRAY, 0.4);
  if (front) {
    if (z < 0.34 && Math.abs(along - len / 2) < 0.35) { // the door: padded, a porthole, light spilling out
      if (Math.abs(along - len / 2) > 0.32) return set(i, '|', C(MAG, Math.max(L, 9)));
      BG[i] = C(RED, 1 + glow * 1.5);
      return set(i, Math.hypot((along - len / 2) * 3, z - 0.24) < 0.05 ? 'O' : fract(z * 25 + (along * 8 | 0) * 0.5) < 0.2 ? '+' : ' ', C(MAG, 12));
    }
    if (z > 0.38 && z < 0.5) { // VELVET ROPE, in a marquee of bulbs
      if (wallText(i, u, uStep, z, d, 'THE VELVET ROPE', sgn * (a0 + len / 2), 0.44, 0.06, 0.07, C(MAG, 15), C(GRAY, 0.4))) return;
      return set(i, (Math.floor(along * 10) + Math.floor(T * 6)) % 3 ? '.' : 'o', C(YEL, Math.max(L, 12 * glow)));
    }
    if (z > 0.56 && z < 0.98) { // XXX, big, pink, blinking; the martini glass in neon either side
      const word = 'XXX', q = (u - sgn * (a0 + len / 2)) / (1.6 / word.length) + word.length / 2, k = Math.floor(q), gy = Math.floor((0.98 - z) / 0.42 * 5);
      if (k >= 0 && k < 3 && gy >= 0 && gy < 5 && glyphOn('X', Math.floor(fract(q) * 4), gy)) { BG[i] = blink ? C(MAG, 5) : C(GRAY, 0.4); return set(i, '#', blink ? C(MAG, 15) : C(MAG, 4)); }
      for (const mxp of [0.7, len - 0.7]) { // a martini glass with an olive
        const dx = along - mxp, dz = z - 0.6;
        if (dz > 0.18 && dz < 0.22 && Math.abs(dx) < 0.24) return set(i, '-', C(CYAN, 15));
        if (dz > 0.06 && dz < 0.2 && Math.abs(Math.abs(dx) - (dz - 0.06) * 1.6) < 0.025) return set(i, Math.sign(dx) > 0 ? '/' : '\\', C(CYAN, 15));
        if (dz > 0.18 && dz < 0.2 && Math.abs(dx - 0.08) < 0.025) return set(i, 'o', C(GREEN, 15));
        if (dz > 0 && dz <= 0.06 && Math.abs(dx) < 0.02) return set(i, '|', C(CYAN, 14));
        if (Math.abs(dz) < 0.012 && Math.abs(dx) < 0.1) return set(i, '_', C(CYAN, 14));
      }
    }
    if (z > 1.05 && z < 1.25) { // GIRLS GIRLS GIRLS, and LIVE DANCERS under it, chasing
      if (wallText(i, u, uStep, z, d, 'GIRLS  GIRLS  GIRLS', sgn * (a0 + len / 2), 1.2, 0.055, 0.06, C(NEON[Math.floor(T * 3) & 3], 15), C(GRAY, 0.4))) return;
      if (wallText(i, u, uStep, z, d, '* LIVE DANCERS *', sgn * (a0 + len / 2), 1.1, 0.055, 0.06, C(YEL, blink ? 15 : 8), C(GRAY, 0.4))) return;
    }
  }
  return clubSide(i, u, uStep, z, d, side, along, len, sgn, a0, L, glow, blink);
}
// the other three walls: a pink neon tube round the roofline, black quilted padding with pink portholes, on each
// end wall a neon pole dancer (she swings round, frame by frame, like the ones inside) over OPEN TIL 4AM, and round
// the back the stage door under its red bulb
function clubSide(i, u, uStep, z, d, side, along, len, sgn, a0, L, glow, blink) {
  if (z > 1.5 && z < 1.56) return set(i, '=', C(NEON[(Math.floor(along * 3 + T * 5)) & 3], Math.max(L, 13 * glow))); // the roofline tube
  if (z < 0.06) { BG[i] = C(GRAY, 0.6); return set(i, '_', C(GRAY, Math.max(L * 0.5, 3))); } // the kick plate
  const mid = len / 2;
  if (!side) { // an end wall: the neon dancer
    const art = DANCER_FRAMES[mod(Math.floor(T * 1.6), DANCER_FRAMES.length)], x0 = mid - 0.45, col = Math.floor((along - x0) / 0.3), row = Math.floor((1.3 - z) / 0.2);
    if (Math.abs(along - (mid + 0.6)) < Math.max(0.018, uStep * 0.5) && z > 0.42 && z < 1.4) { BG[i] = C(MAG, 1 + glow); return set(i, '|', C(WHITE, Math.max(L, 14 * glow))); } // the pole
    if (col >= 0 && col < 3 && row >= 0 && row < 4 && art[row][col] !== ' ') { // each character of her a bent neon tube, one cell thick
      const ch = art[row][col], lx = (along - x0) / 0.3 - col, lz = (1.3 - z) / 0.2 - row, w = Math.max(0.09, uStep / 0.3 * 0.6);
      const on = ch === '|' ? Math.abs(lx - 0.5) < w : ch === '/' ? Math.abs(lx - (1 - lz)) < w : ch === '\\' ? Math.abs(lx - lz) < w
        : ch === 'o' ? Math.abs(Math.hypot(lx - 0.5, (lz - 0.5) * 0.8) - 0.3) < w : Math.abs(lz - (ch === '_' ? 0.9 : 0.5)) < w;
      if (on) { BG[i] = C(MAG, 1 + glow * 2); return set(i, ch === 'o' ? 'o' : ch, ch === 'o' ? C(SKIN, 15) : C(blink ? MAG : CYAN, Math.max(L, 15 * glow))); }
      BG[i] = C(MAG, 0.5 + glow * 0.8); return set(i, ' ', 0); // (the glow round the tubes)
    }
    if (wallText(i, u, uStep, z, d, 'OPEN TIL 4AM', sgn * (a0 + mid), 0.3, 0.045, 0.05, C(YEL, blink ? 15 : 9), C(GRAY, 0.4))) return;
  } else { // round the back: the stage door, a red bulb over it, and a sign asking nicely
    const dx = along - 1.2;
    if (z < 0.32 && Math.abs(dx) < 0.22) { BG[i] = C(GRAY, 1.2); return set(i, Math.abs(dx) > 0.19 ? '|' : z > 0.16 && z < 0.18 && dx > 0.1 ? 'o' : fract(z * 12) < 0.15 ? '-' : ' ', C(GRAY, Math.max(L, 6))); }
    if (Math.abs(dx) < 0.03 && Math.abs(z - 0.37) < 0.025) { BG[i] = C(RED, 2 + glow * 3); return set(i, '@', C(RED, 15)); }
    if (wallText(i, u, uStep, z, d, 'STAGE DOOR - NO LOITERING', sgn * (a0 + 1.2), 0.45, 0.04, 0.045, C(WHITE, Math.max(L, 8)), C(GRAY, 0.4))) return;
  }
  for (const wx of side ? [2.4, 3.4, 4.4] : [0.6, len - 0.6]) { // portholes, pink light behind frosted glass
    const r = Math.hypot(along - wx, (z - 0.95) * 1.4);
    if (r < 0.15) { BG[i] = C(MAG, r < 0.12 ? 2 + glow * 3 : 1); return set(i, r > 0.12 ? 'o' : hash(Math.floor(along * 9), Math.floor(z * 9), 1603) > 0.8 ? '.' : ' ', C(MAG, Math.max(L, 12 * glow))); }
  }
  // black quilted padding, a stud at every crossing
  const qa = fract(along * 3), qz = fract(z * 4), cross = Math.abs(qa - qz) < 0.1 ? '\\' : Math.abs(qa + qz - 1) < 0.1 ? '/' : '';
  if ((qa < 0.08 || qa > 0.92) && (qz < 0.1 || qz > 0.9)) return set(i, '*', C(MAG, Math.max(L * 0.5, glow * 7)));
  return set(i, cross || ' ', C(MAG, Math.max(L * 0.35, glow * 3.5)));
}
// the bouncer and the velvet rope on the sidewalk outside
const BOUNCER_ART = pad(['  ___ ', ' [=_=]', ' /###\\', '|#####|', ' |###|', ' || ||', ' ## ##']);
function clubSprites() {
  const dx_ = CLUB.bx * 8 + 2 + 3, dy_ = CLUB.by * 8 + 2 - 0.1, [vx, vy] = R(dx_, dy_);
  if (Math.hypot(vx, vy) > vis) return;
  drawArt(vx + 0.06, vy, 0, 0.07, 0.19, BOUNCER_ART, (c, row, L) => row === 1 ? (c === '=' ? C(GRAY, 3) : C(SKIN, Math.max(L, 6))) : row < 4 ? C(GRAY, Math.max(L * 0.5, 3)) : C(GRAY, Math.max(L * 0.3, 2)));
  for (const s of [-0.13, -0.03]) drawArt(vx + s, vy, 0, 0.012, 0.07, ['o', '|', '|', '|', '='], () => C(YEL, 12)); // brass posts
  drawArt(vx - 0.08, vy, 0.045, 0.09, 0.015, ['~~~~~~'], () => C(RED, 14)); // the rope
}
// ---- inside
const CLUB_W = 18, CLUB_H = 14;
function clubWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su);
  if (z > 2.4 && z < 2.55) return set(i, '=', C(NEON[(Math.floor(u * 2 + T * 4)) & 3], 14)), true; // a strip of light chasing round the room
  if (my === 0 && z > 1.4 && z < 2.2 && Math.abs(u - CLUB_W / 2) < 2.5) { // XXX over the stage
    if (wallText(i, su, uStep, z, d, 'X X X', CLUB_W / 2 * Math.sign(su), 1.8, 0.6, 0.6, C(MAG, fract(T * 1.3) < 0.7 ? 15 : 6), C(GRAY, 0.3))) return true;
  }
  if (z > 0.9 && z < 2.3 && Math.abs(fract(u / 3) - 0.5) < 0.3) { BG[i] = C(MAG, 0.8 + L * 0.05); return set(i, hash(Math.floor(u * 5), Math.floor(z * 5), Math.floor(T * 2)) > 0.95 ? '*' : ' ', C(WHITE, 12)), true; } // mirrors, the lights in them
  BG[i] = C(MAG, 0.5 + L * 0.04); // padded purple velvet
  return set(i, (Math.floor(u * 3) + Math.floor(z * 3)) & 1 ? '+' : ' ', C(MAG, L * 0.6)), true;
}
const DANCER_FRAMES = [ // round the pole: she swings from one side of it to the other
  [' o ', '/|\\', ' |\\', '/ \\'], ['\\o/', ' | ', '/| ', '/ \\'], [' o/', '/| ', ' |\\', '/  '], ['\\o ', ' |\\', '/| ', '  \\']].map(pad);
const SEQUINS = [MAG, CYAN, YEL, RED];
// buttoned velvet, for the chair backs: a stud in every diamond
const tufted = (i, t, L) => {
  BG[i] = C(MAG, (1.2 + L * 0.3) * shadeFace(HIT.face));
  const a_ = fract(HIT.u * 9), b_ = fract(HIT.w * 9);
  return set(i, a_ < 0.25 && b_ < 0.3 ? '*' : Math.abs(a_ - b_) < 0.12 ? '\\' : Math.abs(a_ + b_ - 1) < 0.12 ? '/' : ' ', C(MAG, L * 1.3)), true;
};
ROOM_DEFS.stripclub = { grid: boxRoom(CLUB_W, CLUB_H), block: (x, y) => x < 1.75 && Math.abs(y - 9.8) < 0.45, light: 0.45, floor: 'carpet', ceil: 'disco', sign: false, wall: clubWall, keeper: [2.2, 6],
  props: r => {
    const p = [BX(CLUB_W / 2, 2.2, 4.5, 1.3, 0, 0.5, solid(GRAY, { top: '=', bright: 1.4 }))]; // the stage
    p.push(...counterBox(2.2, 6, 0.9, 1.05).map(b => ({ ...b, box: { ...b.box, c: 0, s: 1 } })), standing(1.5, 6, MAG)); // the bar along the left wall, the bartender behind it
    for (let k = 0; k < 3; k++) { // three poles, a dancer on each
      const x = 5.5 + k * 3.5, col = SEQUINS[k];
      p.push(BX(x, 2, 0.04, 0.04, 0.5, 3, solid(WHITE, { bright: 1.6 })));
      p.push({ ...SP(x, 2.05, 0.7, 1.7, DANCER_FRAMES[0], (c, row, L) => row === 0 && c === 'o' ? C(SKIN, 15) : C(col, 15), 0.5),
        tick: s => { const f = mod(Math.floor(T * 1.6 + k * 1.3), DANCER_FRAMES.length); s.art = DANCER_FRAMES[f]; s.x = x + Math.sin(T * 1.2 + k) * 0.28; s.y = 2.05 + Math.cos(T * 1.2 + k) * 0.12; } }); // (swinging round the pole)
    }
    // little round cocktail tables, a candle on each, two velvet chairs apiece facing the stage; the punters in them, all eyes front
    const busy = 0.45 + 0.4 * barCrowd();
    for (const [x, y] of [[6, 6.4], [9.5, 6.4], [13, 6.4], [7.7, 9.2], [11.2, 9.2]]) {
      p.push(BX(x, y, 0.32, 0.32, 0.68, 0.74, solid(GRAY, { top: '.', trim: 0.05, bright: 1.2 })), BX(x, y, 0.05, 0.05, 0, 0.68, solid(GRAY)));
      p.push({ ...SP(x, y, 0.12, 0.14, ['*'], () => C(fract(T * 3 + x) < 0.85 ? YEL : ORANGE, 15), 0.74) }); // (the candle flickers)
      for (const cx of [x - 0.42, x + 0.42]) {
        const cy = y + 0.55;
        p.push(BX(cx, cy, 0.22, 0.22, 0, 0.42, solid(MAG, { top: '=', bright: 1.6 })), BX(cx, cy + 0.2, 0.22, 0.04, 0.42, 0.72, tufted)); // (a low back: you can see who's in it)
        if (chance(busy)) p.push(sitting(cx, cy - 0.04, shirt(), 0.42, true));
      }
    }
    for (const y of [5.2, 6.8]) { p.push(SP(3.05, y, 0.4, 0.75, ART.stool, wood)); if (chance(busy)) p.push(sitting(3.05, y, shirt(), 0.45, true)); } // stools at the bar
    p.push(BX(15.5, 11.5, 1.6, 1.4, 0, 2.4, (i, t, L) => { BG[i] = C(RED, 1 + L * 0.1); return set(i, fract(HIT.u * 6) < 0.3 ? '|' : ' ', C(RED, L * 1.1)), true; })); // the VIP booth, curtained off
    p.push({ ...SP(13.6, 11.2, 0.6, 0.35, ['VIP'], () => C(YEL, 15), 2.2) });
    p.push(standing(13.4, 10.2, GRAY)); // the host by the curtain
    p.push({ vm: { kind: 'CIGARETTES', c: 0, s: 1, fs: -1 }, x: 1.4, y: 9.8 }); // a cigarette machine by the bar, the same as the ones on the street
    return p;
  } };
ROOM_FOR.VELVET = 'stripclub';
const nearClubCigs = () => mode === 'room' && room.kind === 'stripclub' && Math.hypot(px - 1.6, py - 9.8) < 1.2;
const nearVip = () => mode === 'room' && room.kind === 'stripclub' && Math.hypot(px - 13.4, py - 10.2) < 1.4;
const nearStage = () => mode === 'room' && room.kind === 'stripclub' && py < 5.2 && px > 4 && px < 14;
function tipDancer() {
  if (!pay(5)) return say('You pat your pockets. Nothing.', 2);
  return say(pick(['You tuck $5 in her garter. She gives you a little wave from the pole.', 'Five bucks on the stage. A spin, just for you.', '$5. The dancer blows you a kiss. Your heart, briefly, is full.']), 3);
}

// the private dance: you sit, she dances, you keep your hands to yourself. SPACE tips a dollar (the vibe goes up),
// the bouncer looks in now and then; about twenty-five seconds and it's over
const LAP_FRAMES = [
  [' \\o/ ', '  |  ', ' / \\ '], [' _o_ ', '  |  ', ' / > '], ['  o/ ', ' /|  ', ' < \\ '], [' \\o  ', '  |\\ ', '  /\\ '],
  ['  o  ', ' /|\\ ', '  /| '], [' _o  ', '  |\\_', '  |  '], ['  o_ ', '_/|  ', '  |  '], [' \\o/ ', '  |  ', '  |\\ ']];
const LAP_LINES = ['She is doing a lot with six characters.', 'The music is loud. The bass is in your teeth.', 'You look her in the eyes. Both of them. (The two dots.)', 'Hands on your knees. The bouncer is watching.',
  'She does a spin. Well, the "o" goes round.', 'This is the most expensive ASCII you have ever seen.', 'Somewhere, a dial-up modem screams.', 'She whispers something. It\'s "do you want another song". It\'s $40.'];
GAMES.lapdance = () => {
  const W = 32, H = 19, g = { id: 'lapdance', title: 'V I P', W, H, score: 0, over: false, vibe: 0, tips: 0 };
  let t = 0, peek = 0, line = 0, lineT = 0, broke = false;
  g.noCash = () => { broke = true; };
  g.step = (dt, k) => {
    const ev = [];
    t += dt; lineT -= dt; g.vibe = Math.max(0, g.vibe - dt * 0.02);
    if (lineT <= 0) { line = (line + 1 + (Math.random() * 3 | 0)) % LAP_LINES.length; lineT = 3.2; }
    if (peek > 0) peek -= dt; else if (Math.random() < dt * 0.15) peek = 1.6; // the bouncer sticks his head round the curtain
    if (k.actP) { g.tips++; g.vibe = Math.min(1, g.vibe + 0.12); broke = false; ev.push('tip'); }
    if (t > 25) {
      g.over = true; ev.push('end');
      g.endLine = g.vibe > 0.7 ? 'She gives you a wink on the way out. ;) "Come back soon, big spender."' : g.vibe > 0.3 ? '"Thanks, hon." The song ends. You feel, somehow, poorer.' : 'The song ends. She is already looking at the next guy.';
    }
    return ev;
  };
  g.draw = (put, text, chars) => {
    for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) put(x, y, '|', C(RED, 10 + (y & 1) * 2), C(RED, 2)); // the curtains
    for (let x = 2; x < W - 2; x++) put(x, 15, '=', C(MAG, 6), C(MAG, 1)); // the floor, lit pink
    const f = LAP_FRAMES[Math.floor(t * 2.4) % LAP_FRAMES.length], cx = 16 + Math.round(Math.sin(t * 1.4) * 2);
    f.forEach((l, r) => text(cx - 1, 12 + r, l, C(SEQUINS[Math.floor(t) & 3], 15))); // her, in sequins: all six characters of her (every frame, exactly six), at the world's own size
    for (let k = 0; k < Math.min(g.tips, 12); k++) text(4 + (k * 7) % 24, 14, '$', C(GREEN, 12)); // dollars on the floor
    if (peek > 0) { put(2, 6, '[', C(GRAY, 12)); put(3, 6, '=', C(GRAY, 4)); text(2, 7, '"No touching."', C(GRAY, 12)); } // the bouncer, peeking
    text(2, 1, LAP_LINES[line].slice(0, 56), C(WHITE, 14));
    const n = Math.round(g.vibe * 16);
    text(2, 17, `VIBE [${'#'.repeat(n)}${'-'.repeat(16 - n)}]   TIPS $${g.tips}${broke ? '   (you are out of singles)' : ''}`, C(MAG, 14));
    text(2, 18, `${Math.max(0, 25 - t) | 0}s left in the song`, C(GRAY, 10));
  };
  g.status = () => 'SPACE tip $1   E leave (no refunds)';
  g.reward = () => 0;
  return g;
};
