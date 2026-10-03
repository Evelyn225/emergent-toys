// ===== city world =====
const sk0 = seed => seed * 1e4 | 0;
// background tint per facade style (0 office, 1 glass, 2 brick, 7 tenement, 8 warehouse, 9 brownstone, 10 shophouse,
// 14 art deco, 15 parking garage, 16 balcony apartments)
const FACADE_BG = [GRAY, BLUE, BRICK, GRAY, GRAY, GRAY, GRAY, WARM, GRAY, BRICK, RED, GRAY, BRICK, WHITE, WARM, GRAY, WHITE];
const ARCADE_SIGN = new Set(['ARCADE']);
// a 3x5 pixel font for signs seen up close: 15 bits a glyph, top row first, left to right
const GLYPH5 = { 'A': 11245, 'B': 27566, 'C': 14627, 'D': 27502, 'E': 31143, 'F': 31140, 'G': 14699, 'H': 23533, 'I': 29847, 'J': 4714, 'K': 23469, 'L': 18727, 'M': 24557, 'N': 27501, 'O': 11114, 'P': 27556, 'Q': 11123, 'R': 27565, 'S': 14478, 'T': 29842, 'U': 23407, 'V': 23402, 'W': 23549, 'X': 23213, 'Y': 23186, 'Z': 29351, '0': 31599, '1': 11415, '2': 25255, '3': 25230, '4': 23497, '5': 31118, '6': 14831, '7': 29330, '8': 31727, '9': 31694, '/': 4772, '.': 2, '-': 448 };
const glyphOn = (ch, gx, gy) => gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && (GLYPH5[ch] >> (14 - gy * 3 - gx) & 1) === 1;
// uStep = how far u moves between this screen column and the next
function facade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const k = idx(mx, my), sty = STY[k], sh = SHOP[k], sk = sk0(SEED[k]);
  if (sty >= 3 && sty <= 6) return landmarkFacade(i, u, uStep, z, h, d, side, sty, fog, wc);
  const L = fog * amb * (side ? 10 : 15), glowL = night * fog * 14, open = openAt(sh, tod);
  BG[i] = bgAt(FACADE_BG[sty], day * 3 * (0.45 + 0.55 * fog) * (side ? 0.7 : 1), d);
  if (z > h - 0.04) return set(i, '=', C(GRAY, L)); // cornice
  if (z < 0.4) { // ground floor shop
    if (z > 0.32) {
      const w = sh.word, m = w.length + 3, p = mod(Math.floor(u * 10), m);
      // up close a letter spans many cells: draw it once, in the middle cell of its span
      const centered = (uStep >= 0.1 || oneCell((fract(u * 10) - 0.5) * 0.1, uStep)) && oneCell(z - 0.36, d / projY);
      const lvl = !open ? L * 0.5 : sh.kind === SHOP_APTS ? L : Math.max(L, night * 15 * Math.max(fog, 0.5)); // closed: sign off
      // closer still, big enough for it: the letter drawn large in blocks, so the sign grows as you walk up to it
      if (p < w.length && GLYPH5[w[p]] !== undefined && 0.1 / uStep >= 4 && 0.08 / (d / projY) >= 5) {
        const gx = Math.floor(fract(u * 10) * 4), gy = Math.floor((0.4 - z) / 0.08 * 5); // (a column's gap after each letter)
        const col = ARCADE_SIGN.has(w) && open ? NEON[(p + Math.floor(T * 6)) & 3] : sh.neon, on = glyphOn(w[p], gx, gy);
        if (on) BG[i] = C(col, Math.min(lvl, 15) * 0.25);
        return set(i, on ? '#' : ' ', C(col, ARCADE_SIGN.has(w) && open ? Math.max(lvl, 13) : lvl));
      }
      if (ARCADE_SIGN.has(w) && open) { // flashier than the rest: a chasing rainbow, bulbs between
        const lit = Math.max(lvl, 13), chase = Math.floor(T * 6);
        if (p < w.length) return set(i, centered ? w[p] : ' ', C(NEON[(p + chase) & 3], lit));
        return set(i, centered ? '*' : ' ', (p + chase) & 1 ? C(YEL, lit) : C(GRAY, L * 0.5));
      }
      if (p < w.length) return set(i, centered ? w[p] : ' ', C(sh.neon, lvl));
      return set(i, '-', C(GRAY, L));
    }
    if (sh.base) return serviceFront(i, u, z, sh.base, L, Math.max(L, night * fog * 14));
    if (sty === 8) { // warehouse: big roll-up doors
      const fd = fract(u * 0.8);
      if (fd > 0.12 && fd < 0.88 && z < 0.3) return set(i, fract(z * 40) < 0.5 ? '=' : '-', C(open ? ORANGE : GRAY, L * 0.7));
      return set(i, '|', C(GRAY, L * 0.8));
    }
    if (sh.kind === SHOP_APTS && sty === 9) { // brownstone stoop: steps up to a raised front door, railings either side
      const fd = fract(u * 1.2), step = 0.13 - (fd - 0.42) * 0.55;
      if (fd > 0.24 && fd < 0.4 && z > 0.13 && z < 0.34) return set(i, fd < 0.26 || fd > 0.38 ? '|' : z > 0.3 ? '=' : '#', C(BRICK, L * 0.8));
      if (fd > 0.29 && fd < 0.35 && z > 0.34 && z < 0.38) return set(i, '*', C(WARM, Math.max(L, night * 15)));
      if (fd >= 0.4 && fd < 0.66) { if (z < step) return set(i, '_', C(GRAY, L)); if (z < step + 0.06) return set(i, '\\', C(GRAY, L * 0.7)); }
      if (fd > 0.75 && fd < 0.95 && z > 0.14 && z < 0.3) return set(i, '#', C(WARM, hash(Math.floor(u * 1.2), 9, sk) > 0.4 ? Math.max(L * 0.6, glowL) : L * 0.3));
      return set(i, fract(u * 12 + (Math.floor(z * 24) & 1) * 0.5) < 0.15 ? '|' : '.', C(BRICK, L * 0.8));
    }
    if (sh.kind === SHOP_APTS) { // brick front with a lit doorway every 5m
      const fd = fract(u * 2);
      if (fd > 0.4 && fd < 0.6 && z < 0.26) return fd < 0.42 || fd > 0.58 ? set(i, '|', C(GRAY, L)) : set(i, z > 0.2 ? '=' : '#', C(BRICK, L * 0.7));
      if (fd > 0.47 && fd < 0.53 && z > 0.27 && z < 0.31) return set(i, '*', C(WARM, Math.max(L, night * 15)));
      return set(i, fract(u * 12 + (Math.floor(z * 24) & 1) * 0.5) < 0.15 ? '|' : '_', C(BRICK, L));
    }
    const fs = fract(u * 2);
    if (fs < 0.08) return set(i, '|', C(GRAY, L));
    if (!open) return set(i, fract(z * 60) < 0.5 ? '=' : '-', C(GRAY, L * 0.6)); // roll-down shutter: vacant, or shut for the night
    if (z > 0.28) return set(i, '/', C(fract(u * 8) < 0.5 ? sh.neon : WHITE, L)); // awning
    if (sh.kind === SHOP_PRODUCE && z < 0.08) // crates of fruit out front
      return set(i, 'o@*o'[hash(Math.floor(u * 20), 1, sk) * 4 | 0], C(ITEM_COL[hash(Math.floor(u * 20), 2, sk) * 4 | 0], L));
    const on = hash(Math.floor(u * 2), 3, sk) > 0.25;
    if (sh.kind === SHOP_NEON) return set(i, on ? (fract(z * 30) < 0.5 ? ':' : '.') : '.', C(on ? sh.neon : GRAY, on ? Math.max(L, glowL) : L * 0.3));
    return on ? set(i, ':', C(WARM, Math.max(L * 0.8, glowL))) : set(i, '.', C(GRAY, L * 0.3));
  }
  const zz = z - 0.4, fl = Math.floor(zz * 3), fz = fract(zz * 3);
  if (sty >= 11 && sty <= 13) return serviceUpper(i, u, z, zz, fl, fz, h, d, sty, sk, L, glowL);
  if (sty === 8) { // warehouse: corrugated sheet metal, a band of high windows under the roof
    const top = h - z < 0.3, fw = fract(u * 2);
    if (top && fw > 0.08 && fw < 0.92 && z < h - 0.08) return set(i, '#', hash(Math.floor(u * 2), 7, sk) > 0.7 ? C(YEL, Math.max(L * 0.5, glowL * 0.8)) : C(GRAY, L * 0.4));
    return set(i, fract(u * 20) < 0.5 ? '|' : ':', C(sk & 1 ? ORANGE : GRAY, L * (sk & 1 ? 0.55 : 0.8))); // rusty or grey
  }
  if (sty === 9) { // brownstone: tall narrow windows with stone lintels
    const fu = fract(u * 4);
    if (fu > 0.3 && fu < 0.7 && fz > 0.2 && fz < 0.8)
      return hash(Math.floor(u * 4), fl, sk) > litT - 0.1 ? set(i, '#', C(WARM, Math.max(L, glowL))) : set(i, '.', C(GRAY, L * 0.3));
    if (fu > 0.25 && fu < 0.75 && fz >= 0.8 && fz < 0.9) return set(i, '-', C(GRAY, L));
    return set(i, (Math.floor(u * 12) + Math.floor(zz * 18)) % 5 ? ' ' : '.', C(BRICK, L * 0.7));
  }
  if (sty === 10) { // chinatown shophouse: balconies, red lanterns under the eaves, a tall vertical sign
    const fu = fract(u * 1.25), w = sh.word, vs = Math.abs(fu - 0.5) < 0.06 && zz < 1.2 && sh.kind !== SHOP_APTS;
    if (vs) { // vertical sign: the shop's name top to bottom, one cell per letter
      BG[i] = C(sh.neon, open ? 2 : 1);
      const q = (1.15 - zz) / 0.11, p = Math.floor(q);
      const on = oneCell((fract(q) - 0.5) * 0.11, d / projY) && (uStep >= 0.096 || oneCell((fu - 0.5) * 0.8, uStep));
      return set(i, on && p >= 0 && p < w.length ? w[p] : ' ', C(sh.neon, open ? Math.max(L, night * 15) : L * 0.6));
    }
    if (fz < 0.1) return set(i, fract(u * 10) < 0.3 ? '|' : '=', C(GREEN, L)); // balcony rail
    if (fz > 0.86 && Math.abs(fract(u * 3) - 0.5) < 0.08) return set(i, 'o', C(RED, Math.max(L, night * 14)));
    const wu = fract(u * 3);
    if (wu > 0.2 && wu < 0.8 && fz > 0.25 && fz < 0.8)
      return hash(Math.floor(u * 3), fl, sk) > litT - 0.1 ? set(i, '#', C(WARM, Math.max(L, glowL))) : set(i, '.', C(GRAY, L * 0.3));
    return set(i, ' ', 0);
  }
  if (sty === 14) { // art deco: limestone piers running the full height, gold chevrons round the crown, spandrels between floors
    const fu = fract(u * 4), crown = h - z < 0.32;
    if (fu < 0.16) return set(i, '|', C(WHITE, L * 0.9)); // the piers
    if (crown) return set(i, (Math.floor(u * 16) + Math.floor(z * 24)) & 1 ? '^' : 'v', C(YEL, Math.max(L, night * fog * 11)));
    if (fz < 0.2) return set(i, fract(u * 16) < 0.5 ? '=' : '#', C(WARM, L * 0.55)); // spandrel panel
    return hash(Math.floor(u * 4), fl, sk) > litT ? set(i, '#', C(YEL, Math.max(L * 0.8, glowL))) : set(i, ':', C(day > 0.5 ? CYAN : GRAY, L * 0.4));
  }
  if (sty === 15) { // parking garage: open concrete decks, cars nose-out behind the parapet, sodium lamps at night
    const fu = fract(u * 2);
    if (fu < 0.06) return set(i, '|', C(GRAY, L)); // columns
    if (fz < 0.22) return set(i, '=', C(GRAY, L * 1.1)); // the deck edge and parapet
    if (fz > 0.85 && Math.abs(fract(u * 4) - 0.5) < 0.08) return set(i, 'o', C(ORANGE, Math.max(L * 0.6, night * fog * 14)));
    const bay = Math.floor(u * 3), car = hash(bay, fl, sk + 9);
    if (car > 0.4 && fz < 0.55 && Math.abs(fract(u * 3) - 0.5) < 0.32) {
      if (fz > 0.45) return set(i, '_', C(GRAY, L * 0.7)); // the roofline
      return set(i, Math.abs(fract(u * 3) - 0.5) > 0.24 && fz < 0.33 ? 'o' : '#', C(ITEM_COL[car * 97 & 7], L * 0.8));
    }
    BG[i] = C(GRAY, 1); return set(i, ' ', 0); // dark inside
  }
  if (sty === 16) { // modern apartments: a balcony a bay, glass rails, sliding doors, the odd plant
    const fu = fract(u * 2), bay = Math.floor(u * 2);
    if (fu < 0.05) return set(i, '|', C(WHITE, L * 0.8));
    if (fz < 0.08) return set(i, '=', C(WHITE, L * 1.1)); // the balcony slab
    if (fz < 0.36) { // the glass rail, a plant behind it now and then
      if (hash(bay, fl, sk + 4) > 0.75 && Math.abs(fu - 0.75) < 0.1) return set(i, '%', C(GREEN, L));
      return set(i, fz > 0.32 ? '-' : ':', C(CYAN, L * (fz > 0.32 ? 0.9 : 0.4)));
    }
    if (fu > 0.15 && fu < 0.85 && fz < 0.88) return hash(bay, fl, sk) > litT - 0.05 ? set(i, fu < 0.5 ? '#' : '|', C(WARM, Math.max(L, glowL))) : set(i, fu < 0.5 ? ':' : '|', C(CYAN, L * 0.5));
    return set(i, ' ', 0);
  }
  if (sty === 0) { // office
    const fu = fract(u * 4);
    if (fu > 0.15 && fu < 0.85 && fz > 0.25 && fz < 0.85)
      return hash(Math.floor(u * 4), fl, sk) > litT ? set(i, '#', C(YEL, Math.max(L * 0.7, glowL))) : set(i, '.', C(day > 0.5 ? CYAN : GRAY, L * 0.35));
    return set(i, RAMP[fog * (side ? 0.6 : 1) * 8.99 | 0], C(GRAY, L));
  }
  if (sty === 1) { // glass tower
    const fu = fract(u * 8);
    if (fu < 0.1) return set(i, '|', C(GRAY, L));
    if (fz < 0.12) return set(i, '-', C(GRAY, L));
    if (hash(Math.floor(u * 8), fl, sk) > litT + 0.15) return set(i, '+', C(CYAN, Math.max(L, glowL)));
    if (fract((u * 0.7 + zz) * 2) < 0.06) return set(i, '/', C(CYAN, L * 0.6));
    return set(i, ' ', 0);
  }
  if (sty === 7) { // tenement: cream plaster, two windows a bay, black fire escapes zig-zagging up the front
    BG[i] = bgAt(WARM, day * 3 * (0.45 + 0.55 * fog) * (side ? 0.7 : 1));
    const fe = fract(u / 3);
    if (fe > 0.35 && fe < 0.65) {
      if (fz < 0.06) return set(i, '=', C(GRAY, L * 1.2)); // landing
      if (fz < 0.3 && (fe < 0.37 || fe > 0.63)) return set(i, '|', C(GRAY, L)); // railing posts
      const t = (fe - 0.35) / 0.3, up = fl & 1 ? t : 1 - t; // the ladder runs the other way on each floor
      if (Math.abs(fz - up) < 0.07) return set(i, fl & 1 ? '/' : '\\', C(GRAY, L));
    }
    const wu = fract(u * 4);
    if (wu > 0.2 && wu < 0.8 && fz > 0.3 && fz < 0.85)
      return hash(Math.floor(u * 4), fl, sk) > litT - 0.05 ? set(i, '#', C(WARM, Math.max(L, glowL))) : set(i, '.', C(GRAY, L * 0.3));
    if (fz < 0.08) return set(i, '_', C(WARM, L * 0.6)); // floor line
    return set(i, ' ', 0);
  }
  // brick
  const fu = fract(u * 3);
  if (fu > 0.3 && fu < 0.7 && fz > 0.25 && fz < 0.75)
    return hash(Math.floor(u * 3), fl, sk) > litT - 0.1 ? set(i, '#', C(ORANGE, Math.max(L, glowL))) : set(i, '.', C(GRAY, L * 0.3));
  if (fu > 0.25 && fu < 0.75 && fz > 0.18 && fz <= 0.25) return set(i, '=', C(GRAY, L));
  if (d > 8) return set(i, RAMP[fog * (side ? 0.6 : 1) * 8.99 | 0], C(BRICK, L));
  return set(i, fract(u * 12 + (Math.floor(zz * 24) & 1) * 0.5) < 0.15 ? '|' : '_', C(BRICK, L));
}

// the ground floor of a police station (lit windows, a blue lamp either side of the door), a fire station (tall red
// engine-bay doors) or a hospital (wide lit glass doors between two red crosses)
function serviceFront(i, u, z, base, L, lit) {
  if (base === 'fire') {
    const fd = fract(u * 0.7);
    if (fd < 0.08 || z > 0.3) return set(i, fd < 0.08 ? '|' : '-', C(GRAY, L));
    if (z > 0.2 && z < 0.25 && fract(fd * 5) > 0.25) return set(i, '#', C(WARM, lit * 0.8)); // a row of windows in each door
    BG[i] = C(RED, 1 + L * 0.12);
    return set(i, fract(z * 30) < 0.5 ? '=' : '-', C(RED, L * 1.1));
  }
  if (base === 'police') {
    const fd = fract(u * 1.5);
    if ((Math.abs(fd - 0.3) < 0.035 || Math.abs(fd - 0.7) < 0.035) && z > 0.24 && z < 0.29) { // the blue lamps
      BG[i] = C(BLUE, 3 + night * 6); return set(i, '*', C(WHITE, Math.max(L, night * 15)));
    }
    if (fd > 0.36 && fd < 0.64 && z < 0.24) return set(i, fd < 0.38 || fd > 0.62 ? '|' : z > 0.2 ? '=' : '#', C(GRAY, L * 0.8)); // the doors
    if (z > 0.08 && z < 0.22 && (fd < 0.26 || fd > 0.74)) return set(i, ':', C(CYAN, lit * 0.75));
    return set(i, '_', C(GRAY, L));
  }
  const fd = fract(u * 1.2); // hospital
  if (z > 0.2 && z < 0.3 && (Math.abs(fd - 0.15) < 0.05 || Math.abs(fd - 0.85) < 0.05)) {
    const arm = Math.abs(z - 0.25) < 0.018 || Math.abs(fd - (fd < 0.5 ? 0.15 : 0.85)) < 0.017;
    BG[i] = arm ? C(RED, 6 + night * 8) : bgAt(WHITE, 3 + night * 3); return set(i, ' ', 0);
  }
  if (fd > 0.3 && fd < 0.7 && z < 0.26) { BG[i] = C(CYAN, 1 + night * 3); return set(i, Math.abs(fd - 0.5) < 0.012 ? '|' : z > 0.24 ? '=' : ':', C(WHITE, lit)); }
  return set(i, fract(u * 12) < 0.12 ? '|' : '.', C(WHITE, L * 0.55));
}

// the floors above: police (dressed grey stone, a blue band over the entrance, square windows lit a cool white),
// fire station (red brick, tall round-headed windows, the hose tower's slit windows), hospital (white panels, long
// ribbon windows, a big red cross up by the roof on every face)
function serviceUpper(i, u, z, zz, fl, fz, h, d, sty, sk, L, glowL) {
  if (sty === 11) {
    if (zz < 0.06) { BG[i] = C(BLUE, 2 + L * 0.2); return set(i, '=', C(BLUE, Math.max(L, night * 10))); }
    const fu = fract(u * 3);
    if (fu > 0.3 && fu < 0.7 && fz > 0.3 && fz < 0.8)
      return hash(Math.floor(u * 3), fl, sk) > litT - 0.2 ? set(i, '#', C(CYAN, Math.max(L * 0.6, glowL * 0.8))) : set(i, '.', C(GRAY, L * 0.3));
    return set(i, (Math.floor(u * 6) + Math.floor(zz * 9)) % 3 ? ' ' : '_', C(GRAY, L * 0.7)); // stone courses
  }
  if (sty === 12) {
    if (h > 1.5) { // the hose tower: a slit window each floor, louvres at the top
      if (z > h - 0.25) return set(i, fract(z * 25) < 0.5 ? '=' : '-', C(GRAY, L * 0.8));
      if (Math.abs(fract(u) - 0.5) < 0.05 && fz > 0.3 && fz < 0.8) return set(i, '#', C(WARM, Math.max(L * 0.4, glowL * 0.6)));
      return set(i, fract(u * 12 + (Math.floor(zz * 24) & 1) * 0.5) < 0.15 ? '|' : '_', C(BRICK, L));
    }
    const fu = fract(u * 2.5), arch = fz > 0.72 && fz < 0.82 && Math.abs(fu - 0.5) < 0.2 - (fz - 0.72) * 1.4;
    if (fu > 0.3 && fu < 0.7 && fz > 0.2 && fz < 0.75 || arch)
      return hash(Math.floor(u * 2.5), fl, sk) > litT - 0.15 ? set(i, arch ? '^' : '#', C(WARM, Math.max(L, glowL))) : set(i, arch ? '^' : '.', C(GRAY, L * 0.35));
    if (fz < 0.06) return set(i, '=', C(WHITE, L * 0.7)); // a stone string course each floor
    return set(i, fract(u * 12 + (Math.floor(zz * 24) & 1) * 0.5) < 0.15 ? '|' : '_', C(BRICK, L));
  }
  // hospital
  const cu = fract(u) - 0.5, cz = z - (h - 0.32);
  if (Math.abs(cz) < 0.2 && Math.abs(cu) < 0.2) { // the cross
    const arm = Math.abs(cz) < 0.065 || Math.abs(cu) < 0.065;
    BG[i] = arm ? C(RED, 7 + night * 7) : bgAt(WHITE, 4 + night * 2); return set(i, ' ', 0);
  }
  if (fz > 0.3 && fz < 0.75) { // ribbon windows, mullions every few metres
    if (fract(u * 5) < 0.06) return set(i, '|', C(WHITE, L * 0.8));
    if (hash(Math.floor(u * 5), fl, sk) > litT - 0.35) { BG[i] = C(CYAN, 1 + night * 2.5); return set(i, '-', C(WHITE, Math.max(L * 0.8, glowL))); } // wards lit all night
    return set(i, ' ', 0);
  }
  BG[i] = bgAt(WHITE, day * 4 + 1 + night * 1.5);
  return set(i, fz < 0.08 ? '_' : ' ', C(GRAY, L * 0.6));
}

// wc = world coordinate along the wall; lu = position across the face from the block's middle, left-to-right on screen
const TICKER = ADS.join('   *   ') + '   *   ';
function landmarkFacade(i, u, uStep, z, h, d, side, sty, fog, wc) {
  const L = fog * amb * (side ? 10 : 15), lu = (mod(wc, 8) - 5) * (Math.abs(u - wc) < 1e-6 ? 1 : -1);
  if (sty === 3) { // clock tower: stone, with a clock face showing the game time on every side
    BG[i] = bgAt(GRAY, day * 5 * (0.5 + 0.5 * fog));
    const dz = z - (h - 1.4), rr = Math.hypot(lu, dz);
    if (rr < 0.75) {
      if (rr > 0.66) return set(i, 'O', C(GRAY, L * 1.2));
      const ang = Math.atan2(lu, dz); // clockwise from 12
      const onHand = (A, len) => rr < len && Math.abs(mod(ang - A + Math.PI, 2 * Math.PI) - Math.PI) * Math.max(rr, 0.06) < 0.05;
      BG[i] = C(WHITE, Math.max(8 * amb, night * 11)); // the face glows at night
      if (onHand(mod(tod, 12) / 12 * 2 * Math.PI, 0.38) || onHand(fract(tod) * 2 * Math.PI, 0.6)) return set(i, '#', C(GRAY, 1));
      return set(i, Math.abs(rr - 0.57) < 0.05 && fract(ang / (Math.PI / 6) + 0.1) < 0.2 ? '+' : ' ', C(GRAY, 3));
    }
    if (z > h - 0.25) return set(i, '^', C(GRAY, L));
    return set(i, fract(z * 4) < 0.15 ? '=' : fract(u * 3 + (Math.floor(z * 4) & 1) * 0.5) < 0.1 ? '|' : ' ', C(GRAY, L));
  }
  if (sty === 4) { // cathedral: stone with tall pointed stained-glass windows
    BG[i] = bgAt(GRAY, day * 5 * (0.5 + 0.5 * fog));
    const fu = fract(u * 1.5), wcen = Math.abs(fu - 0.5), top = (h > 4 ? h - 1.5 : 2.3) - wcen * 1.2;
    if (wcen < 0.2 && z > 0.6 && z < top) {
      if (wcen > 0.16) return set(i, '|', C(GRAY, L));
      const glass = [MAG, BLUE, YEL, RED, CYAN][hash(Math.floor(u * 1.5), Math.floor(z * 6), 41) * 5 | 0];
      return set(i, '#', C(glass, Math.max(L * 0.6, night * fog * 13)));
    }
    if (z > h - 0.08) return set(i, '^', C(GRAY, L));
    return set(i, fract(z * 5) < 0.12 ? '-' : fract(u * 4 + (Math.floor(z * 5) & 1) * 0.5) < 0.1 ? '|' : '.', C(GRAY, L * 0.8));
  }
  if (sty === 5) { // tower wrapped in giant video screens, with a scrolling news ticker
    if (z < 0.5 || z > h - 0.3) { BG[i] = bgAt(GRAY, day * 2 * fog); return set(i, '=', C(GRAY, L)); }
    if (z > 1.1 && z < 1.5) { // ticker: one cell per letter, scrolling left
      const q = (u + T * 1.2) / 0.3, p = mod(Math.floor(q), TICKER.length);
      BG[i] = C(GRAY, 1);
      return set(i, (uStep >= 0.3 || oneCell((fract(q) - 0.5) * 0.3, uStep)) && oneCell(z - 1.3, d / projY) ? TICKER[p] : ' ', C(YEL, 15));
    }
    const k = (Math.floor(T / 7) + (side ? 1 : 0)) & 3, v = noise(u * 0.5 + T * 0.4, z * 0.7 - T * 0.25, 111 + k);
    BG[i] = C(NEON[(k + (v * 3 | 0)) & 3], 3 + v * 9); // screens glow regardless of daylight
    return set(i, v > 0.7 ? '*' : ' ', C(WHITE, 15));
  }
  // 6: construction: a steel skeleton with open floors
  BG[i] = NONE;
  const fl = fract(z * 3), fu = fract(u * 2);
  if (fl < 0.1) return set(i, '=', C(ORANGE, L));
  if (fu < 0.08) return set(i, '|', C(ORANGE, L));
  if (Math.abs(fract(u * 2 + z * 3) - 0.5) < 0.05 && (Math.floor(z * 3) & 1)) return set(i, '/', C(ORANGE, L * 0.7));
  set(i, ' ', 0);
}

// the top of a building, seen from above (you're on a roof): gravel with a parapet where the roof ends
function roofTop(i, wx, wy, h, d) {
  const L = Math.max(0, 1 - d / vis) * amb * 10, mx = Math.floor(wx), my = Math.floor(wy), lx = wx - mx, ly = wy - my;
  const edge = lx < 0.05 && map[idx(mx - 1, my)] !== h || lx > 0.95 && map[idx(mx + 1, my)] !== h ||
               ly < 0.05 && map[idx(mx, my - 1)] !== h || ly > 0.95 && map[idx(mx, my + 1)] !== h;
  BG[i] = bgAt(GRAY, day * 2.5);
  if (edge) return set(i, '#', C(GRAY, L * 1.3));
  const sh = SHOP[idx(mx, my)];
  if (sh && sh.pad && STY[idx(mx, my)] === 13) { // the hospital's helipad: a yellow ring round a big H
    const ex = wx - sh.pad[0], ey = wy - sh.pad[1], rr = Math.hypot(ex, ey);
    if (Math.abs(rr - 1.05) < 0.07) return set(i, '#', C(YEL, Math.max(L * 1.4, night * 12)));
    const H = Math.abs(ey) < 0.55 && (Math.abs(Math.abs(ex) - 0.38) < 0.08 || Math.abs(ex) < 0.38 && Math.abs(ey) < 0.07);
    if (rr < 1.12) { BG[i] = C(GREEN, 1 + day * 1.5); return set(i, H ? '#' : ' ', C(WHITE, Math.max(L * 1.5, 8))); }
  }
  set(i, hash(Math.floor(wx * 25), Math.floor(wy * 25), 61) > 0.7 ? ':' : '.', C(GRAY, L * 0.6));
}

// how far down a subway entrance's stairs (wx, wy) is (0 at the top step, 1 at the bottom), or -1 if it isn't in one
function subwayHole(wx, wy, bx, by) {
  const s = STATION_AT.get(bi(bx, by));
  if (!s) return -1;
  const u = rel(wx - s.x), v = rel(wy - s.y);
  return Math.abs(u) < SUBWAY_HOLE[0] && Math.abs(v) < SUBWAY_HOLE[1] ? (u + SUBWAY_HOLE[0]) / (2 * SUBWAY_HOLE[0]) : -1;
}
let stHole = -1;
function floorCell(i, r, x, rx, ry) {
  const d = eye * projY / (r - hor + 0.5), f = Math.max(0, 1 - d / vis * 1.5);
  ZB[i] = d; FL[i] = 1;
  const wx = px + rx * d, wy = py + ry * d, lx = mod(wx, 8), ly = mod(wy, 8), mx = Math.floor(wx), my = Math.floor(wy);
  const bx = Math.floor(wx / 8), by = Math.floor(wy / 8), road = ROAD[idx(mx, my)], shade = underEl(wy);
  // under the el the street is in the deck's shadow, striped with light between the ties
  const L = f * 6 * (0.6 + amb) * (1 - wet * 0.25) * (shade ? (fract(wx * 2) < 0.35 ? 0.35 : 0.6) : 1);
  let ch = (r + x) & 1 ? '.' : ' ', base = GRAY, k = 1, soft = false;
  if (!road) { // not a street: parks, plazas, the waterfront, the sea...
    const kind = blockKind(bx, by);
    if (onFootbridge(wx, wy)) { // the footbridge: boards across it, lamplight pooling under each lamp after dark
      soft = true; base = BRICK; k = 1.3;
      const e = Math.abs(rel(wx - FOOTBRIDGE.x)) / FOOTBRIDGE.hw;
      ch = e > 0.88 ? '|' : fract(wy * 5) < 0.2 ? '=' : '-';
      const pool = lampsOn * Math.max(0, 1 - Math.abs(fract((mod(wy, N) - FOOTBRIDGE.y0 - 1.5) / FB_LAMP + 0.5) - 0.5) * FB_LAMP / 0.5);
      if (pool > 0) { base = WARM; k = 1.3 + pool * 1.6; }
    } else if (onIsland(wx, wy)) { // the island: rocks round the shore, a gravel path out to the lighthouse, rough grass
      soft = true;
      const e = isleEdge(wx, wy), path = Math.abs(rel(wx - FOOTBRIDGE.x - (rel(wy - FOOTBRIDGE.y1) / (LIGHTHOUSE.y - FOOTBRIDGE.y1)) * (LIGHTHOUSE.x - FOOTBRIDGE.x)));
      const onPath = path < 0.13 && rel(wy - FOOTBRIDGE.y1) > -0.5 && rel(wy - LIGHTHOUSE.y) < 0;
      if (e < 0.45) { ch = hash(Math.floor(wx * 9), Math.floor(wy * 9), 34) > 0.45 ? '%' : 'o'; base = GRAY; k = 1.25; }
      else if (onPath) { ch = (r * 5 + x) % 3 ? ':' : '.'; base = WARM; k = 1; }
      else { ch = (r * 3 + x) % 4 ? '"' : ','; base = GREEN; k = 1.1; }
    } else if (onPier(wx, wy)) { // planks running out to sea
      soft = true; base = BRICK; k = 1.3;
      ch = fract(wy * 6) < 0.15 ? '=' : hash(mx, Math.floor(wy * 6), 33) > 0.85 ? ':' : '|';
    } else if (seaAt(wx, wy)) { // open water: drifting waves; reflect() mirrors the skyline into it
      const n = noise(wx * 2.5 + T * 0.25, wy * 2.5 - T * 0.1, 91), surf = isleEdge(wx, wy) > -0.3; // white water round the island
      set(i, surf ? '~' : n > 0.62 ? '~' : n > 0.47 ? '-' : ' ', surf ? C(WHITE, L * 1.6) : C(n > 0.62 ? CYAN : BLUE, L * 1.5));
      BG[i] = C(BLUE, 1 + day * 3); FL[i] = 3;
      const lb = beamOnWater(wx, wy); // the lighthouse beam sweeping over it
      if (lb > 0.05) { BG[i] = C(WARM, 1 + lb * 7); if (CH[i] === ' ') CH[i] = '-'; COL[i] = C(YEL, 6 + lb * 9); FL[i] = 0; }
      return;
    } else if (kind === 'waterfront') {
      soft = true;
      const south = (by & (NB - 1)) === SHORE_S, toWater = south ? shoreS(wx) - mod(wy, N) : mod(wy, N) - shoreN(wx);
      const beach = hash(bx & (NB - 1), south ? 1 : 2, 47) < 0.35;
      if (toWater < 0.2 && !beach) { ch = '#'; k = 1.4; } // the sea wall
      else if (beach && toWater < 1.6) { // sand, and surf where it meets the water
        const surf = toWater < 0.25; ch = surf ? '~' : (r * 7 + x * 3) % 5 ? '.' : ':'; base = surf ? WHITE : YEL; k = surf ? 1.2 : 0.8;
      } else if (fract(wx * 1.5) < 0.08 || fract(wy * 1.5) < 0.08) { ch = '+'; base = WARM; k = 0.9; } // promenade flagstones
      else ch = (r + x) % 3 ? ' ' : '.';
    } else if (kind === 'construction') { // churned-up dirt with tyre tracks
      soft = true; base = BRICK; k = 1.1;
      ch = fract(lx * 3 + ly * 0.4) < 0.12 ? '=' : hash(Math.floor(wx * 12), Math.floor(wy * 12), 97) > 0.6 ? ':' : '.';
    } else if (kind === 'yard') { // cracked concrete, oil stains, painted bays
      ch = fract(lx * 1.5) < 0.04 ? '|' : hash(Math.floor(wx * 9), Math.floor(wy * 9), 98) > 0.92 ? '%' : (r + x) % 4 ? ' ' : '.'; k = 0.9;
    } else if (kind === 'park') {
      soft = true;
      const pbx = bx & (NB - 1), pby = by & (NB - 1);
      if (inPond(lx, ly, pbx, pby)) { const n = noise(wx * 4 + T * 0.3, wy * 4, 92); ch = n > 0.6 ? '~' : n > 0.45 ? '-' : ' '; base = BLUE; k = 1.4; }
      else if (inPond(lx, ly, pbx, pby, 0.15)) { ch = (r + x) % 3 ? '|' : ','; base = GREEN; k = 0.9; } // reeds round the edge
      else if (Math.abs(lx - 5) < 0.2 || Math.abs(ly - 5) < 0.2) { ch = ':'; base = BRICK; k = 1.2; } // dirt path
      else { ch = (r * 3 + x) % 4 ? '"' : ','; base = GREEN; k = 1.3; }
    } else if (fract(lx * 2) < 0.06 || fract(ly * 2) < 0.06) ch = '+'; // paving
  } else if (road === 2 && (stHole = subwayHole(wx, wy, bx, by)) >= 0) { // a subway entrance's stairs, going down
    const deep = stHole;
    set(i, fract(deep * 8) < 0.3 ? '=' : ' ', C(deep > 0.5 ? YEL : GRAY, deep > 0.5 ? 8 + night * 5 : L * (1 - deep * 0.85) * 1.5)); // the station's light, coming up the stairs
    BG[i] = deep > 0.5 ? C(YEL, 2 + (deep - 0.5) * 6 + night * 3) : C(GRAY, 1 + (1 - deep) * 2);
    return;
  } else if (road === 3) { // intersection: crosswalks across the streets that come in, plain sidewalk where none does
    const n = ly < 0.3 ? vseg(bx, by - 1) : ly > 1.7 ? vseg(bx, by) : -1, w = lx < 0.3 ? hseg(bx - 1, by) : lx > 1.7 ? hseg(bx, by) : -1;
    if (n === 0 || w === 0) { ch = ','; k = 1.3; }
    else if (n === 1 && fract(lx * 4) < 0.5 || w === 1 && fract(ly * 4) < 0.5) { ch = '='; base = WHITE; }
  } else {
    const e = road === 1 ? lx : ly, along = road === 1 ? wy : wx, bridge = road === 1 && onBridge(bx, by);
    if (bridge && (e < 0.06 || e > 1.94)) { ch = '|'; k = 1.6; } // railings
    else if (e < 0.3 || e > 1.7) { ch = bridge ? '=' : ','; k = 1.3; } // sidewalk (on a bridge, a walkway of plates)
    else if (Math.abs(e - 1) < 0.04 && fract(along * 2) < 0.5) { ch = '='; base = YEL; k = 1.5; }
  }
  let col = C(base, L * k);
  BG[i] = bgAt(base === GREEN || base === BLUE ? base : GRAY, day * 2.2 * f * (shade ? 0.4 : 1));
  if (!soft && wet > 0.05 && noise(wx * 3, wy * 3, 41) < wet * 0.5) FL[i] = 2; // puddle, filled in by reflect()
  if (lampsOn > 0) {
    const gl = glow(wx, wy) * lampsOn;
    if (gl > 0) { col = C(WARM, Math.max(L * k, gl * 13)); if (ch === ' ') ch = '.'; }
  }
  if (siren) { // an emergency vehicle's lights wash over the street round it
    const s = 1 - Math.hypot(rel(wx - siren.ex), rel(wy - siren.ey)) / 1.2;
    const on = strobe();
    if (s > 0 && on >= 0) BG[i] = C(on, 1 + s * 3.5);
  }
  set(i, ch, col);
}

// the lighthouse: its lamp turns once every BEAM_P seconds, two beams back to back, lit from dusk to dawn (and in fog)
const BEAM_P = 9, LH_H = 2.45, BEAM_LEN = 28;
const beamLit = () => clamp((night - 0.25) * 2.5 + fogAmt * 0.8 + storm * 0.5, 0, 1);
const beamAng = () => T / BEAM_P * Math.PI * 2;
const beamOff = ang => Math.abs(mod(ang - beamAng() + Math.PI / 2, Math.PI) - Math.PI / 2); // angle to the nearer beam
function beamOnWater(wx, wy) { // how brightly the beam lights the sea at (wx, wy), 0..1
  const lit = beamLit();
  if (!lit) return 0;
  const ex = rel(wx - LIGHTHOUSE.x), ey = rel(wy - LIGHTHOUSE.y), D = Math.hypot(ex, ey);
  if (D > BEAM_LEN || D < 1) return 0;
  return clamp(1 - beamOff(Math.atan2(ey, ex)) / 0.06, 0, 1) * (1 - D / BEAM_LEN) * lit;
}

// the el deck: its underside (girders and cross ties) seen from the street, and its top (two tracks, and the
// platforms at stations) seen from up there. ly = across the deck, 0..2*EL_HALF
function slabFace(i, wx, wy, below, d) {
  const L = Math.max(0, 1 - d / vis) * amb * 9, ly = mod(wy, N) - EL_Y0, W = EL_HALF * 2;
  if (below) {
    BG[i] = C(GRAY, 1);
    if (Math.abs(ly - W / 2) < 0.06 || ly < 0.07 || ly > W - 0.07) return set(i, '=', C(GRAY, L * 0.9)); // girders
    return set(i, fract(wx * 2) < 0.25 ? '#' : ' ', C(BRICK, L * 0.6)); // cross ties
  }
  BG[i] = bgAt(GRAY, day * 2);
  if (elStationAt(wx) && (ly < 0.17 || ly > W - 0.17)) { // platforms, with a yellow edge
    const edge = Math.abs(ly - 0.15) < 0.025 || Math.abs(ly - (W - 0.15)) < 0.025;
    return set(i, ly < 0.03 || ly > W - 0.03 ? '|' : edge ? '=' : '.', edge ? C(YEL, L * 1.4) : C(GRAY, L));
  }
  if (ly < 0.04 || ly > W - 0.04) return set(i, '|', C(GRAY, L * 1.2)); // edge rail
  for (const t of EL_TRACK) if (Math.abs(Math.abs(mod(wy, N) - t) - 0.1) < 0.025) return set(i, '=', C(GRAY, L * 1.4)); // rails
  set(i, fract(wx * 4) < 0.35 ? '-' : ' ', C(BRICK, L * 0.8)); // sleepers
}
// the deck's side, seen from the street: a riveted steel girder
function slabEdge(i, u, z, d, side) {
  const L = Math.max(0, 1 - d / vis) * amb * (side ? 10 : 13);
  BG[i] = bgAt(GRAY, day * 2);
  if (z > EL_TOP - 0.025 || z < EL_BOT + 0.02) return set(i, '=', C(GRAY, L));
  set(i, Math.abs(fract(u * 3 + (z - EL_BOT) * 12) - 0.5) < 0.12 ? 'X' : fract(u * 6) < 0.15 ? 'o' : ' ', C(GRAY, L * 0.8));
}
// standing under the el while a train goes over: the whole street shudders (a row up or down, now and then)
function shake() {
  if (mode === 'room' || mode === 'roof' || !underEl(py) || mode === 'el' || mode === 'elplat') return 0;
  if (!elTrains(T).some(t => !t.stopped && Math.abs(rel(t.x - px)) < 3.5)) return 0;
  return Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? -1 : 1;
}

function skyCell(i, r, x, rx, ry) {
  ZB[i] = Infinity; FL[i] = 0;
  const up = (hor - r - 0.5) / projY, az = Math.atan2(ry, rx); // up = tan(elevation)
  BG[i] = rain > 0.5 ? C(GRAY, 1 + day * 6) : fogAmt > 0.5 ? bgAt(GRAY, day * 4)
        : dusk > 0.3 && up < 0.3 ? bgAt(up < 0.1 ? ORANGE : MAG, dusk * (up < 0.1 ? 8 : 4) * (1 - overcast), 0)
        : day > 0.15 ? bgAt(up < 0.08 ? CYAN : BLUE, day * (9 - Math.min(4, up * 8)), 0)
        : up < 0.05 ? C(ORANGE, 1) : up < 0.35 ? C(BLUE, 1) : C(BLUE, 0); // night: navy, city glow at the horizon
  // clouds: a flat layer CLOUD_H up, so they flatten into the horizon in perspective (and look the same from a roof).
  // Soft background fills, lit white by day, faintly grey by moonlight; thinning out with distance.
  // Far off they lose fine detail (which would only alias into speckle) and thin out just above the horizon.
  const cd = CLOUD_H / Math.max(up, 1e-4), fade = clamp(1.3 - cd / 1800, 0, 1);
  if (up > 0) {
    const wx = rx * cd / 30 + cloudT * 0.02, wy = ry * cd / 30, fine = fade * fade;
    const n = noise(wx, wy, 31) * (1 - 0.3 * fine) + noise(wx * 2.6, wy * 2.6, 32) * 0.3 * fine, cover = 0.62 - overcast * 0.3;
    if (n > cover) {
      const k = (n - cover) / (1 - cover) * fade;
      if (k > 0.08) { BG[i] = day > 0.3 ? C(WHITE, (6 + k * 8) * day) : C(GRAY, 1 + k * 2); return set(i, ' ', 0); }
    }
  }
  // stars: one cell each (indexed per screen column, but fixed to the world), twinkling
  const s = hash(Math.floor(az * projX), r - hor, 3);
  if (night > 0.5 && overcast < 0.4 && s > 0.988) {
    const tw = 0.6 + 0.4 * Math.sin(T * 3 + s * 1e4);
    return set(i, s > 0.998 ? '*' : s > 0.994 ? '+' : '.', C([WHITE, WHITE, CYAN, YEL][s * 1e5 & 3], (s > 0.994 ? 13 : 7) * night * tw));
  }
  set(i, ' ', 0);
}

// filled disc with a soft halo, drawn only on open sky
function disc(az, el, body, halo, rad, craters) {
  if (el < -0.05 || el > 1.4 || overcast > 0.6) return;
  const ra = mod(az - a + Math.PI, 2 * Math.PI) - Math.PI;
  if (Math.abs(ra) > FOV) return;
  const c0 = cols / 2 + Math.tan(ra) * projX, r0 = hor - Math.tan(el) * projY, R = rad * 2.2;
  for (let r = Math.floor(r0 - R); r <= r0 + R; r++) for (let c = Math.floor(c0 - R * 2); c <= c0 + R * 2; c++) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    const i = r * cols + c, q = Math.hypot((c - c0) * cw / FS, r - r0);
    if (ZB[i] !== Infinity || q > R) continue;
    if (q <= rad) { BG[i] = body; set(i, craters && hash(c - (c0 | 0), r - (r0 | 0), 8) > 0.75 ? 'o' : ' ', C(GRAY, 9)); }
    else if (BG[i] === NONE || (BG[i] & 15) < (halo & 15)) BG[i] = halo;
  }
}
// lightning: while a strike flickers the whole sky lights up (clouds most) and the bolt itself forks down to the
// horizon in its direction, in front of anything further off than the strike
function lightning() {
  const fl = flash();
  if (fl < 0.03) return;
  for (let i = 0; i < rows * cols; i++) if (ZB[i] === Infinity) {
    const cloud = BG[i] !== NONE && (BG[i] >> 4 === WHITE || BG[i] >> 4 === GRAY) && (BG[i] & 15) > 1;
    BG[i] = C(cloud ? WHITE : GRAY, (cloud ? 5 : 2) + fl * (cloud ? 10 : 6));
  }
  const s = T - bolt.t, ra = mod(bolt.az - a + Math.PI, Math.PI * 2) - Math.PI;
  if (s > 0.22 || s > 0.07 && s < 0.13 || Math.abs(ra) > FOV * 0.7) return; // only while it's flickering, and in view
  const top = Math.max(0, Math.floor(hor - Math.min(3, 30 / bolt.d) * projY)), bot = Math.min(rows - 1, Math.ceil(hor + eye * projY / bolt.d));
  const fork = top + Math.floor((bot - top) * (0.3 + hash(bolt.seed, 2, 7) * 0.3));
  const branch = (c0, r0, r1, k) => {
    let c = c0;
    for (let r = r0; r <= r1; r++) {
      const step = Math.round((hash(r, bolt.seed + k, 5) - 0.5 + (k ? 0.35 * Math.sign(k) : 0)) * 2.4);
      c += step;
      const x = Math.round(c);
      if (x < 0 || x >= cols) return;
      const i = r * cols + x;
      if (ZB[i] < bolt.d) continue; // behind something nearer than the strike
      set(i, step > 0 ? '\\' : step < 0 ? '/' : '|', C(WHITE, 15)); BG[i] = C(CYAN, 5 + fl * 6); FOGS[i] = 0;
      if (r === fork && !k) branch(c, r + 1, Math.min(bot, r + (bot - top) * 0.35), hash(bolt.seed, 3, 7) < 0.5 ? -1 : 1);
    }
  };
  branch(cols / 2 + Math.tan(ra) * projX, top, bot, 0);
}
function sunMoon() { // sun rises in +x, sets in -x
  const sunEl = Math.sin((tod - 6) / 12 * Math.PI), az = (tod - 6) / 12 * Math.PI;
  disc(az, Math.asin(sunEl), C(YEL, 15), C(YEL, 11), 1.8, false);
  disc(az + Math.PI, Math.asin(-sunEl), C(WHITE, 13), C(BLUE, 2), 1.4, true);
}

// puddles (FL 2) and open water (FL 3) mirror whatever is above them, about the base of the nearest wall in that column
function reflect() {
  for (let x = 0; x < cols; x++) {
    const b = BASE[x];
    for (let r = Math.max(b, hor + 1); r < rows; r++) {
      const i = r * cols + x, f = FL[i];
      if (f < 2) continue;
      const s = 2 * b - r - 1 + (f === 3 ? Math.round(Math.sin(r * 1.7 + T * 3) * 0.6) : 0), j = s * cols + x; // water ripples
      if (s >= 0 && s < rows && FL[j] === 0 && CH[j] !== ' ') { CH[i] = CH[j]; COL[i] = (COL[j] & 0xf0) | ((COL[j] & 15) * 0.55 | 0); }
      else if (f === 2) set(i, '~', C(BLUE, 3 + day * 3));
    }
  }
}

const drops = Array.from({ length: 700 }, () => [Math.random(), Math.random(), 0.7 + Math.random() * 0.6]);
function rainFx(dt) {
  const under = heldItem() && heldItem().id === 'umbrella'; // the umbrella keeps most of it off
  const n = drops.length * rain * (under ? 0.3 : 1) | 0;
  for (let k = 0; k < n; k++) {
    const d = drops[k];
    if ((d[1] += d[2] * dt * 1.8) > 1) { d[1] -= 1; d[0] = Math.random(); }
    const i = (d[1] * rows | 0) * cols + (d[0] * cols | 0);
    set(i, k & 1 ? '|' : '!', C(k % 3 ? BLUE : WHITE, 5 + day * 5)); FOGS[i] = 0; // drops are right in front of you
  }
}

// tower crane, drawn from world measurements so the truss stays one character thick at any distance.
// u = across the billboard (0 = mast), z = height, du/dz = one cell's size there, p = jib facing (see citySprites)
const MW = 0.12, PANEL = 0.24, JH = 0.18, JIB = 4.5, CJIB = 1.4;
// within half a cell of a line through the cell? `slope` = how far the line moves in u per unit of z
const onLine = (off, du, dz, slope) => Math.abs(off) < Math.max(du, dz * Math.abs(slope)) / 2;
function craneCell(i, u, z, du, dz, L, k, p) {
  const H = k.H, jx = JIB * p, cx = -CJIB * p, top = H + JH, apex = H + 0.75, steel = C(YEL, L), dark = C(GRAY, L * 0.8);
  const blink = (night > 0.3 || overcast > 0.5) && fract(T * 0.7) < 0.5;
  // red warning lights on the apex and the jib tip
  if (blink && (onLine(u, du, 0, 0) && onLine(z - apex, dz, 0, 0) || onLine(u - jx, du, 0, 0) && onLine(z - top, dz, 0, 0)))
    return set(i, '*', C(RED, 15)), true;
  const between = (v, a, b) => v >= Math.min(a, b) && v <= Math.max(a, b);
  if (z < H && Math.abs(u) <= MW + du / 2) { // mast: lattice with X bracing
    if (2 * MW < du * 1.5) return set(i, '|', steel), true; // far away: one line
    if (onLine(Math.abs(u) - MW, du, 0, 0)) return set(i, '|', steel), true;
    const b = fract(z / PANEL);
    if (onLine((b > 0.5 ? b - 1 : b) * PANEL, dz, 0, 0)) return set(i, '-', steel), true;
    if (onLine(u - (-MW + b * 2 * MW), du, dz, 2 * MW / PANEL)) return set(i, '/', steel), true;
    if (onLine(u - (MW - b * 2 * MW), du, dz, 2 * MW / PANEL)) return set(i, '\\', steel), true;
    return false;
  }
  if (z >= top && z <= apex && Math.abs(u) <= MW) { // apex frame above the jib
    const w = MW * (apex - z) / (apex - top);
    if (onLine(Math.abs(u) - w, du, dz, MW / (apex - top))) return set(i, u < 0 ? '/' : '\\', steel), true;
  }
  for (const end of [jx * 0.7, cx]) // pendant ties from the apex down to the jib and counter-jib
    if (Math.abs(end) > du && z >= top && z <= apex && onLine(u - end * (apex - z) / (apex - top), du, dz, end / (apex - top)))
      return set(i, end > 0 ? '\\' : '/', dark), true;
  if (z >= H - 0.02 && z <= top + 0.02 && (between(u, 0, jx) || between(u, 0, cx))) { // jib and counter-jib trusses
    if (JH < dz * 3) return set(i, '=', steel), true; // too few rows for a truss to read: a solid beam
    if (onLine(z - top, dz, 0, 0)) return set(i, '_', steel), true;
    if (onLine(z - H, dz, 0, 0)) return set(i, '=', steel), true;
    const pw = JH * 1.4 * Math.abs(p) + 1e-6, a = fract(Math.abs(u) / pw), tri = 1 - Math.abs(2 * a - 1), b = (z - H) / JH;
    if (onLine((b - tri) * JH, dz, du, 2 * JH / pw)) return set(i, (a < 0.5) === (u > 0) ? '/' : '\\', steel), true;
    return false;
  }
  if (z < H && z > H - 0.3 && between(u, cx * 0.75, cx) && Math.abs(cx) > du) return set(i, '#', C(GRAY, L * 0.7)), true; // counterweights
  if (z < H && z > H - 0.22 && between(u * Math.sign(p || 1), MW, MW + 0.16)) // operator's cab
    return set(i, z > H - 0.12 ? ':' : '#', z > H - 0.12 ? C(CYAN, Math.max(L, night * 12)) : steel), true;
  // trolley, cable, hook and a slung load of beams, drifting along the jib
  const tro = jx * k.tro, hz = k.hz; // set each frame in citySprites, clear of the buildings below
  if (Math.abs(jx) > du && z < H && z > hz && onLine(u - tro, du, 0, 0)) return set(i, '|', dark), true;
  if (z <= hz && z > hz - 0.08 && onLine(u - tro, du, 0, 0)) return set(i, 'J', dark), true;
  if (z <= hz - 0.08 && z > hz - 0.22 && Math.abs(u - tro) < 0.3) return set(i, '=', C(ORANGE, L)), true;
  return false;
}

const CITY = { cell: (x, y) => map[idx(x, y)], wall: facade, floor: floorCell, sky: skyCell, roof: roofTop, sprites: citySprites,
               deck: true, slabFace, slabEdge };

