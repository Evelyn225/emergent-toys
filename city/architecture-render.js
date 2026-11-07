// Entrances, windows and corner margins belong to each building's actual faces.
const BROWNSTONE_MATERIALS = [BRICK, SKIN, BRICK, STONE, BRICK];
function architectureFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const k = idx(mx, my), sh = SHOP[k], b = sh?.architecture;
  if (!b) return false;
  const dir = side ? (rel(py - my) < 0 ? 0 : 1) : (rel(px - mx) < 0 ? 2 : 3), f = ARCH_FACES[dir][k];
  if (!f || f.height !== h) return false;
  const along = rel(wc - f.start), L = fog * amb * (side ? 11 : 15);
  if (b.profile) residentialFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else if (b.region === 'midtown') midtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else if (b.region === 'brownstones') brownstoneFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  else downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  return true;
}
// A thin line's coverage of a cell (dist from its middle, w its width, fp the cell's footprint, city units): frames and
// bars wider than half a cell are drawn in their own colour, thinner ones just darken what's behind them.
const facadeLine = (dist, w, fp) => clamp((w / 2 - dist) / Math.max(fp, 1e-4) + .5, 0, 1) * Math.min(1, w / Math.max(fp, w));
function brownstoneWindow(i, du, z, half, z0, z1, lit, L, base, fp = 0) {
  if (Math.abs(du) > half + 0.025 || z < z0 - 0.025 || z > z1 + 0.035) return false;
  set(i, ' ', 0);
  if (Math.abs(du) > half || z < z0 || z > z1) { BG[i] = C(base, 1.6 + L * 0.3); return true; } // the frame, its sill and head
  const bar = Math.max(facadeLine(Math.abs(du), 0.022, fp), facadeLine(Math.abs(z - (z0 + z1) / 2), 0.024, fp)); // the glazing bars
  if (bar > .5) { BG[i] = C(base, 1.4 + L * 0.25); return true; }
  BG[i] = C(lit ? WARM : CYAN, (lit ? 2 + night * 5 : 1 + day * 1.4) * (1 - bar * .5));
  return true;
}
// a shop's way in, down to the pavement: du across it (0 its middle), up to SHOP_DOOR_TOP (clear of the awnings and
// signs above). Glass in a frame, a kick plate, a push bar; lit from inside when it's open. True if it drew (i)
const SHOP_DOOR_HALF = 0.055, SHOP_DOOR_TOP = 0.26;
function shopDoor(i, du, z, sh, L, trim, d) {
  if (Math.abs(du) > SHOP_DOOR_HALF + 0.012 || z > SHOP_DOOR_TOP + 0.014) return false;
  if (architectureShutter(i, z, sh, L, d, du, -SHOP_DOOR_HALF - 0.012, SHOP_DOOR_HALF + 0.012, 0, SHOP_DOOR_TOP + 0.014)) return true;
  if (Math.abs(du) > SHOP_DOOR_HALF || z > SHOP_DOOR_TOP) { BG[i] = C(trim, 1.4 + L * 0.25); return set(i, ' ', 0), true; } // the frame
  return doorGlass(i, du, z, openAt(sh, tod), L, trim, d / projY);
}
// the glass of a shop's double door, du across it (0 where the two leaves meet): a solid panel at the foot, a push bar
// across each leaf, the meeting stiles; by day the street and a streak of sky in it, after dark the shop lit up behind
// it (if it's open). True: it drew (i)
function doorGlass(i, du, z, open, L, trim, fp = 0) {
  set(i, ' ', 0);
  if (z < 0.035) { BG[i] = C(trim, 1.1 + L * 0.2); return true; } // the kick plate
  if (facadeLine(Math.abs(du), 0.012, fp) > .5) { BG[i] = C(trim, 1 + L * 0.2); return true; } // the meeting stiles
  if (Math.abs(du) > 0.012 && Math.abs(du) < 0.04 && facadeLine(Math.abs(z - 0.11), 0.016, fp) > .5) { BG[i] = C(GRAY, 2.5 + L * 0.25); return true; } // the push bars
  const warm = open && (night > 0.3 || overcast > 0.6), streak = fp < .02 && fract(du * 7 + z * 4) < 0.07; // (a streak of sky in the glass, up close)
  BG[i] = warm ? C(WARM, 1.2 + night * 3.2) : C(CYAN, 0.55 + day * 1.25 + (streak ? 1.2 : 0));
  return true;
}
// a shop's opening when it's shut: the roller shutter (shop-shutters.js), a across the opening, a0..a1 and z0..z1 its
// sides and its sill and head, along the wall. True if it drew (i)
function architectureShutter(i, z, sh, L, d, a, a0, a1, z0, z1) {
  return !openAt(sh, tod) && shopShutter(i, a, z, a0, a1, z0, z1, sh, L, d);
}
function brownstoneFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const base = BROWNSTONE_MATERIALS[b.material], sk = sk0(b.seed), unit = clamp(Math.floor(along / f.spacing), 0, f.units - 1);
  const center = (unit + 0.5) * f.spacing, local = along - center, corner = Math.min(along, f.end - f.start - along);
  const stone = b.material === 1 || b.material === 3, grain = hash(Math.floor(wc * 16), Math.floor(z * 22), sk);
  BG[i] = C(base, 2.5 + L * (stone ? 0.36 : 0.25) + grain * 0.45);
  const fpW = Math.max(uStep, d / projY);
  if (corner < 0.07 || Math.abs(Math.abs(local) - f.spacing / 2) < 0.025) { // quoins and the party piers: blocks a course apart, their joints filtered
    BG[i] = C(base, 2.9 + L * 0.3 - coveGroove(z, .1, .008, fpW) * 1.1); return set(i, ' ', 0);
  }
  if (b.h - z < 0.12 || Math.abs(z - 0.44) < 0.025) { BG[i] = C(stone ? WHITE : STONE, 2 + L * 0.32); return set(i, ' ', 0); } // cornice and string course
  if (z < 0.42) {
    const signLight = openAt(sh, tod) ? Math.max(L, night * 10) : L * 0.5;
    const g = architectureSignSpec(b, f, sh);
    if (z > .28 && architectureSignedFace(f, sh) && (!f.fascia || archFasciaPainted(g, d)) && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + (f.end - f.start) / 2), g.zc,
      g.cwid, g.band, C(STONE, signLight), C(base, 2))) return; // (up close, the fascia board carries it)
    if (ghostSign(i, u, uStep, z, d, b, f, sh, (Math.sign(u * wc) || 1) * (f.start + (f.end - f.start) / 2), base, L)) return; // (shut for good: the old sign's shadow)
    if (f.front && sh.kind === SHOP_APTS) {
      const door = local + f.spacing * 0.24, half = f.spacing * 0.125;
      const top = 0.35 - (door / half) ** 2 * 0.018;
      if (Math.abs(door) < half + 0.025 && z > 0.12 && z < top + 0.025) {
        set(i, ' ', 0);
        if (Math.abs(door) > half || z > top) { BG[i] = C(STONE, 1.8 + L * 0.3); return; } // its stone surround and arched head
        if (z > 0.3) { BG[i] = C(WARM, 1.5 + Math.max(L * .1, night * 3)); return; } // the fanlight
        const fpD = d / projY, stile = facadeLine(Math.abs(door), 0.02, fpD) > .5, panel = fpD < .02 && (Math.abs(fract(z / .075) - .5) > .4 || Math.abs(Math.abs(door) - half * .5) > half * .4);
        BG[i] = C(BRICK, (stile ? .8 : 1.2) + L * 0.14 - (panel ? .4 : 0)); return; // two leaves of panelled door
      }
      if (brownstoneWindow(i, local - f.spacing * 0.22, z, f.spacing * 0.15, 0.16, 0.32, hash(unit, 5, sk) > litT, L, STONE, Math.max(uStep, d / projY))) return;
    } else if (f.front && shopDoor(i, local + f.spacing * 0.24, z, sh, L, STONE, d)) return; // (where the walk-ups have theirs)
    else if (f.front && z > 0.04 && z < 0.34 && Math.abs(local) < f.spacing * 0.39) {
      if (architectureShutter(i, z, sh, L, d, local, -f.spacing * 0.39, f.spacing * 0.39, 0.04, 0.34)) return;
      if (d < SHOP_WINDOW.near * (shopSceneFor(sh) ? 1.6 : 1) && z < 0.3 && Math.abs(local) >= f.spacing * 0.03 && (sh.kind !== SHOP_NEON || shopSceneFor(sh))) { // up close, the display behind the glass (shop-windows.js)
        const e = Math.sign(local), sg = Math.sign(u * wc) || 1, ua = sg * (f.start + center + e * f.spacing * 0.03), ub = sg * (f.start + center + e * f.spacing * 0.39);
        if (shopWindow(i, u, z, Math.min(ua, ub), Math.max(ua, ub), 0.04, 0.3, sh, openAt(sh, tod), L, sk + unit * 2 + (e > 0 ? 1 : 0))) return;
      }
      const fp = Math.max(uStep, d / projY);
      if (sh.kind !== SHOP_NEON) return shopfrontBay(i, local + f.spacing * .39, f.spacing * .78, z, 0, .34, sh, L, fp, openAt(sh, tod) && (night > .3 || overcast > .6), d); // its own style of front (shopfront-kit.js)
      const mullion = facadeLine(Math.abs(local), f.spacing * 0.06, fp);
      set(i, ' ', 0);
      if (mullion > .5 || z > 0.3) { BG[i] = C(STONE, 1.6 + L * 0.28); return; } // the mullion and transom
      BG[i] = C(CYAN, (1 + night * 2 + day * .6) * (1 - mullion * .5)); return; // the shop's glass
    } else if (brownstoneWindow(i, local, z, f.spacing * 0.15, 0.13, 0.3, hash(unit, 5, sk) > litT, L, STONE, Math.max(uStep, d / projY))) return;
    if (z < 0.12) { BG[i] = C(GRAY, 1.6 + L * 0.2 - coveGroove(z, 1 / 30, .005, d / projY) * .8); return set(i, ' ', 0); } // the stone plinth, coursed
  } else {
    const fl = Math.floor((z - 0.45) / f.fh), floor0 = 0.45 + fl * f.fh;
    if (fl >= 0 && fl < f.floors) {
      const windows = f.front ? 2 : 3, gap = f.spacing * 0.74 / windows;
      const bay = clamp(Math.floor((local + f.spacing * 0.37) / gap), 0, windows - 1), du = local + f.spacing * 0.37 - (bay + 0.5) * gap;
      if (brownstoneWindow(i, du, z, Math.min(0.115, gap * 0.29), floor0 + f.fh * 0.18, floor0 + f.fh * 0.78,
        hash(unit * 3 + bay, fl, sk) > litT - 0.1, L, STONE)) return;
    }
  }
  // brick (or stone) coursing, the joints filtered so the wall settles to its colour far off
  const course = stone ? .1 : 1 / 24, joint = Math.max(coveGroove(z, course, stone ? .006 : .004, fpW), coveGroove(wc + (Math.floor(z / course) & 1) * (stone ? .125 : 1 / 30), stone ? .25 : 1 / 15, stone ? .006 : .004, fpW));
  BG[i] = C(base, (BG[i] & 15) + .4 - joint * 1.2); return set(i, ' ', 0);
}
function downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const width = f.end - f.start;
  const base = b.sty === 14 ? [STONE, WHITE, STONE, WARM, GRAY][b.material] : b.sty === 1 ? BLUE : GRAY;
  const podium = b.tiers[0].h, onPodium = z < podium && b.tiers.length > 1, stone = b.sty === 14 || onPodium;
  BG[i] = C(stone ? base : b.sty === 1 ? BLUE : GRAY, stone ? 2 + L * 0.3 : 0.6 + day * 0.7);
  if (f.height - z < 0.065 || Math.abs(z - 0.42) < 0.025 || onPodium && podium - z < 0.06) { BG[i] = C(b.sty === 14 ? STONE : GRAY, 2 + L * 0.32); return set(i, ' ', 0); } // the parapet and band courses
  const corner = Math.min(along, width - along), bays = Math.max(1, Math.floor((width - 0.12) / (b.sty === 1 ? 0.22 : 0.32)));
  const spacing = (width - 0.12) / bays, bay = Math.floor((along - 0.06) / spacing), fu = fract((along - 0.06) / spacing);
  if (corner < 0.06) { BG[i] = C(stone ? base : GRAY, (2.3 + L * .3) * (corner < .015 ? 1.15 : 1)); return set(i, ' ', 0); } // the corner, its arris catching the light
  if (z < 0.4) {
    const signLight = openAt(sh, tod) ? Math.max(L, night * 14) : L * 0.5;
    const g = architectureSignSpec(b, f, sh);
    if (z > .28 && architectureSignedFace(f, sh) && (!f.fascia || archFasciaPainted(g, d)) && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + width / 2), g.zc,
      g.cwid, g.band, C(sh.neon, signLight), C(GRAY, 1))) return;
    if (ghostSign(i, u, uStep, z, d, b, f, sh, (Math.sign(u * wc) || 1) * (f.start + width / 2), stone ? base : GRAY, L)) return; // (shut for good: the old sign's shadow)
    const lobby = f.front && Math.abs(along - width / 2) < Math.min(0.7, width * 0.25);
    if (f.front && shopDoor(i, along - width / 2, z, sh, L, b.sty === 14 ? STONE : GRAY, d)) return;
    if (z > 0.04 && z < 0.31 && (lobby || fu > 0.16 && fu < 0.84)) {
      const lw = Math.min(0.7, width * 0.25), s0 = lobby ? width / 2 - lw : 0.06 + (bay + 0.16) * spacing, s1 = lobby ? width / 2 + lw : 0.06 + (bay + 0.84) * spacing;
      if (architectureShutter(i, z, sh, L, d, along, s0, s1, 0.04, 0.31)) return;
      if (!lobby && d < SHOP_WINDOW.near * (shopSceneFor(sh) ? 1.6 : 1) && z < 0.245 && sh.kind !== SHOP_APTS && (sh.kind !== SHOP_NEON || shopSceneFor(sh))) { // up close, the display behind the glass (shop-windows.js)
        const a0 = 0.06 + (bay + 0.16) * spacing, a1 = 0.06 + (bay + 0.84) * spacing, sg = Math.sign(u * wc) || 1, ua = sg * (f.start + a0), ub = sg * (f.start + a1);
        if (shopWindow(i, u, z, Math.min(ua, ub), Math.max(ua, ub), 0.04, 0.245, sh, openAt(sh, tod), L, sk0(b.seed) + bay)) return;
      }
      const fp = Math.max(uStep, d / projY);
      if (!lobby && sh.kind !== SHOP_APTS && sh.kind !== SHOP_NEON) // a shop's bay: its own style of front (shopfront-kit.js)
        return shopfrontBay(i, (fu - .16) * spacing, .68 * spacing, z, 0, .31, sh, L, fp, openAt(sh, tod) && (night > .3 || overcast > .6), d);
      const bar = Math.max(facadeLine(Math.min(fu, 1 - fu) * spacing, spacing * .16, fp), facadeLine(Math.abs(z - 0.26), .028, fp));
      set(i, ' ', 0);
      BG[i] = bar > .5 ? C(stone ? base : GRAY, 1.8 + L * 0.3) : C(lobby ? WARM : CYAN, (1 + night * 3 + day * .5) * (1 - bar * .5)); // glass in its frames
      return;
    }
    BG[i] = C(BG[i] >> 4, (BG[i] & 15) - coveGroove(z, 1 / 14, .006, d / projY) * 1.2); return set(i, ' ', 0); // coursed stone
  }
  const floors = Math.max(1, Math.round((f.height - 0.5) * 3)), fh = (f.height - 0.5) / floors;
  const fl = Math.floor((z - 0.43) / fh), fz = fract((z - 0.43) / fh), lit = hash(bay, fl, sk0(b.seed)) > litT;
  const fpU = Math.max(uStep, d / projY), fine = clamp(1 - fpU / .02, 0, 1);
  set(i, ' ', 0);
  if (b.sty === 14) { // art deco: rounded limestone piers, spandrel panels, gilt at the crown
    if (fu < 0.15 || fu > 0.85) { const e = fu < .5 ? fu / .15 : (1 - fu) / .15; BG[i] = C(base, (2.4 + L * .3) * sfBevel(e < .25 ? .7 : e > .8 ? -.6 : 0, fine)); return; }
    if (fz < 0.2) { BG[i] = C(STONE, (1.8 + L * .24) * (fl % 4 === 0 ? 1.15 : 1) * (Math.abs(fract(fu * 6) - .5) < .1 ? .85 : 1)); return; } // a spandrel, ribbed; every fourth a band course
    if (f.height - z < 0.3) { const zig = Math.abs(fu - .5) * 2; BG[i] = C(YEL, Math.max(2.2 + L * .25, night * 5) * (fract((f.height - z) * 14 - zig) < .5 ? 1.25 : .8)); return; } // gilt chevrons at the crown
  } else if (fu < 0.07 || fz < 0.1) { BG[i] = C(GRAY, (1.8 + L * .26) * (fu < .07 ? (fu < .02 ? 1.15 : .9) : 1)); return; } // mullions and spandrels
  if (stone && (fu < 0.15 || fu > 0.85 || fz < 0.2 || fz > 0.86)) { BG[i] = C(base, 2.3 + L * .28 - coveGroove(z, 1 / 12, .004, fpU) * .7); return; } // coursed stone round the window
  // the window: lit, or the sky reflected in it (with a streak), its glass set in the bay's frame
  const a0 = stone ? .15 : .07, a1 = stone ? .85 : 1, z0 = stone ? .2 : .1, z1 = stone ? .86 : 1;
  if (facadeWindow(i, (fu - a0) * spacing, (a1 - a0) * spacing, (fz - z0) * fh, (z1 - z0) * fh, lit, WARM, L, fpU, stone ? base : GRAY, sk0(b.seed) + bay, b.sty === 1 ? 0 : 1)) return;
  BG[i] = C(GRAY, 2 + L * .26);
}
// A shop's fascia board (architecture.js): its name across the front, in the same lettering that's painted on the wall
// past ARCH_FASCIA_VIS, and a frame round it. Brownstones paint theirs, gold leaf on a dark board; downtown it's a
// box lit from inside after dark; midtown a board in the shop's colour.
const FASCIA_BOARDS = [GREEN, BLUE, GRAY, BLACK];
function architectureFasciaShade(o, i, t, L) {
  if ((o.band + o.edge * 2) * projY / t < 1) return false; // (too small to draw: its lettering is painted on the wall behind)
  const sh = SHOP[o.ownerCell];
  if (sh.word !== o.word) { // a shop renamed after it was built (the hardware store that became IDEA): refit its name to the board
    o.word = sh.word; o.cwid = Math.min(o.cmax, (o.width - o.margin) / o.word.length, (o.hl - o.edge * 2.5) * 2 / o.word.length);
  }
  const open = openAt(sh, tod), front = HIT.face === (o.outSign > 0 ? 3 : 4);
  const board = o.style === 'painted' ? FASCIA_BOARDS[Math.floor(fract(o.seed * 13) * 4)] : o.style === 'box' ? GRAY : sh.neon;
  const base = o.style === 'box' ? .8 + L * .08 + (open ? night * 1.4 : 0) : 1.3 + L * .14;
  if (!front || o.hl - Math.abs(HIT.u) < o.edge * .6 || Math.abs(HIT.w - o.zc) > o.band / 2 + o.edge * .4) { // the frame, top and ends
    BG[i] = C(o.style === 'painted' ? board : GRAY, (base + .7) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }
  BG[i] = C(board, base);
  const ink = o.style === 'painted' ? YEL : o.style === 'box' ? sh.neon : WHITE, lit = open ? Math.max(L, night * (o.style === 'box' ? 14 : 10)) : L * .5;
  const [ex, ey] = faceDir(o.c, o.s);
  return set(i, worldText(o.word, HIT.face === 3 ? HIT.u : -HIT.u, HIT.w, t, i, rel(o.x - px), rel(o.y - py), o.zc, ex, ey, o.cwid, o.band), C(ink, lit)), true;
}
// a shop's awning: a striped sheet sloping out from the wall (darker underneath) and a valance along its front with a
// scalloped hem
function architectureAwningShade(o, i, t, L) {
  const sh = SHOP[o.ownerCell], col = sh.neon === WHITE ? RED : sh.neon;
  const stripe = fract(HIT.u * 20 + .25) < .5 ? col : WHITE;
  if (o.part === 'valance') {
    const x = fract(HIT.u * 25) - .5, hem = HIT.w - o.z0;
    if (hem < .006 * 4 * x * x) return false; // (between the scallops)
    BG[i] = C(stripe, (1.6 + L * .2) * shadeFace(HIT.face)); return set(i, ' ', 0), true;
  }
  BG[i] = C(stripe, HIT.face === 5 ? 1.9 + L * .24 : HIT.face === 6 ? .8 + L * .06 : 1.5 + L * .18);
  return set(i, ' ', 0), true;
}
// the building's number on the front board of its entrance canopy, read from the pavement: white block letters on the
// dark board, the face toward the street only
function canopyNumber(o, i, t, L) {
  const sg = Math.sign(o.c * o.ny - o.s * o.nx) || 1; // (which way along the canopy reads left to right, seen from the street)
  if (HIT.face > 4 || HIT.v * sg < o.hw * .98) return false;
  const word = o.number, n = word.length, cw = Math.min(.06, (o.hl * 2 - .06) / n), band = (o.z1 - o.z0) * .78, zc = (o.z0 + o.z1) / 2;
  const q = HIT.u * sg / cw + n / 2, hz = (zc + band / 2 - HIT.w) / band, fp = t / projY, lit = Math.max(L, night * 9);
  BG[i] = C(GRAY, .9 + L * .08);
  if (q >= 0 && q < n && hz >= 0 && hz < 1 && cw / fp >= 1.5 && band / fp >= 2.5) { // close: block letters
    const ch = blockGlyph(word, q, hz, fp / cw, fp / band);
    return set(i, ch || ' ', C(WHITE, 6 + lit * .55)), true;
  }
  // further off the board's a row or two high: the number in plain characters along its middle row, a letter a
  // column, as long as a letter's at least a column wide
  if (q >= 0 && q < n && oneCell(HIT.w - zc, fp)) { // (set solid, a letter a column, centred, as the small shop signs are)
    const k = Math.floor((q - n / 2) * cw * projX / t + n / 2 + .0137);
    if (k >= 0 && k < n) return set(i, word[k].toUpperCase(), C(WHITE, 7 + lit * .5)), true;
  }
  return set(i, ' ', 0), true;
}
function architectureDetailShade(o, i, t, L) {
  if (o.kind === 'entrance-canopy' && o.number && canopyNumber(o, i, t, L)) return true;
  if (o.kind === 'fascia') return architectureFasciaShade(o, i, t, L);
  if (o.kind === 'awning') return architectureAwningShade(o, i, t, L);
  if (o.profile) return residentialDetailShade(o, i, t, L);
  const z = HIT.w, base = o.region === 'brownstones' ? BROWNSTONE_MATERIALS[o.material] : [STONE, WHITE, STONE, WARM, GRAY][o.material];
  if (o.kind === 'rail') {
    const out = HIT.u * (o.c * o.nx + o.s * o.ny), top = 0.1 + 0.12 * clamp((0.18 - out - 0.075) / 0.145, 0, 1);
    if (z > top + 0.012) return false;
    if (HIT.face >= 5 || z > top - 0.014 || Math.abs(fract(HIT.u * 32) - 0.5) < 0.17) {
      BG[i] = C(GRAY, (1.2 + L * .15) * (z > top - 0.014 ? 1.25 : 1)); return set(i, ' ', 0), true; // the stoop's iron railing, its handrail lit
    }
    return false;
  }
  BG[i] = C(o.kind === 'step' ? GRAY : base, (1.8 + L * 0.35) * (HIT.face >= 7 ? 0.78 : shadeFace(HIT.face)));
  if (o.kind === 'bay' && (HIT.face < 5 || HIT.face >= 7)) {
    const fl = Math.floor((z - 0.45) / o.fh), fz = fract((z - 0.45) / o.fh);
    let along = HIT.face <= 2 ? HIT.v + o.outSign * o.bevelD / 2 : HIT.u;
    let half = HIT.face <= 2 ? o.hw - o.bevelD / 2 : o.hl;
    if (HIT.face === (o.outSign > 0 ? 3 : 4)) half -= o.bevelW;
    if (HIT.face >= 7) {
      const sign = HIT.face === 7 ? 1 : -1, width = Math.hypot(o.bevelW, o.bevelD);
      const midU = sign * (o.hl - o.bevelW / 2), midV = o.outSign * (o.hw - o.bevelD / 2);
      along = ((HIT.u - midU) * o.bevelW - sign * o.outSign * (HIT.v - midV) * o.bevelD) / width;
      half = width / 2;
    }
    const frame = Math.min(0.03, half * 0.3);
    if (fl >= 0 && fl < o.floors && fz > 0.18 && fz < 0.78 && Math.abs(along) < half - frame) {
      const lit = hash(fl, 4, sk0(o.seed)) > litT - 0.1, fpB = t / projY;
      // a bay window's sash: framed glass, a glazing bar, the sky in it or a lamp behind
      if (facadeWindow(i, along + half - frame, 2 * (half - frame), (fz - .18) * o.fh, .6 * o.fh, lit, WARM, L, fpB, STONE, sk0(o.seed) + fl)) return true;
    }
  }
  const top = HIT.face === 5;
  // stone: tops lit, cornices and courses with a lit upper edge over their shadowed face, piers rounded at their arrises
  if ((o.kind === 'course' || o.kind === 'cornice') && !top && HIT.face < 5) BG[i] = C(BG[i] >> 4, (BG[i] & 15) * (HIT.w > o.z1 - (o.z1 - o.z0) * .3 ? 1.15 : .9));
  if (top) BG[i] = C(BG[i] >> 4, (BG[i] & 15) * 1.1);
  set(i, ' ', 0);
  if (top) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * 0.7,1,0,HIT.w);
  return true;
}
function drawArchitecture() {
  forNear(architectureBuildingsB, b => {
    const c = b.crown;
    if (!c || Math.hypot(rel(c.x - px), rel(c.y - py)) > vis + 2) return;
    drawBox({ ...boxAt(...R(c.x, c.y), 1, 0, c.hl, c.hw, c.z0, c.z1), planes: c.planes }, (i, t, L) => {
      const seam = Math.abs(fract((HIT.face < 8 ? HIT.v : HIT.u) * 8) - 0.5) > 0.44;
      BG[i] = C(GRAY, (1.2 + L * 0.25) * (HIT.face === 4 ? 1.15 : 0.85));
      set(i, seam ? '/' : ' ', C(seam ? YEL : GRAY, L));
      paintSettledSnow(i, c.x + HIT.u, c.y + HIT.v, L * 0.7, HIT.face === 4 ? 1 : 0.5,0,HIT.w);
      return true;
    }, rayMansard);
  });
  forNear(architectureDetailsB, o => {
    if (map[o.ownerCell] !== o.ownerHeight) return;
    // Massing stays in the height map; small trim is culled before it becomes an unreadable speck.
    const vx = rel(o.x - px), vy = rel(o.y - py), distance = Math.hypot(vx, vy);
    if (distance > vis + 1 || distance > (o.detailDistance || (o.kind === 'bay' || o.kind === 'cornice' ? 18 : 9)) * lodScale()) return; // (the Detail distance setting carries them further)
    // Reject boxes outside the view before projecting their corners or copying their shape data.
    const along = dx * o.c + dy * o.s, across = -dx * o.s + dy * o.c;
    const far = dx * vx + dy * vy + Math.abs(along) * o.hl + Math.abs(across) * o.hw;
    const edge = Math.abs(-dy * vx + dx * vy) - Math.abs(across) * o.hl - Math.abs(along) * o.hw;
    if (far < 0.02 || edge > far * tf) return;
    if (o.z0 > eye && (o.z0 - eye) * projY > (hor + 1) * far ||
      o.z1 < eye && (eye - o.z1) * projY > (rows + 1 - hor) * far) return;
    drawBox({ ...o, x: vx, y: vy }, (i, t, L) => architectureDetailShade(o, i, t, L), o.kind === 'leaves' ? homeRayEllipsoid : o.planes ? rayBeveledBay : rayBox);
  });
}
