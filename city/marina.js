// ===== boats, drawn as real 3D boxes (drawBox) so they look right from any side and you can sail right up to them:
// a hull with a stepped bow and a waterline, and on top whatever that kind of boat carries (a windscreen and an
// outboard, a cabin and a mast with two sails, a wheelhouse and funnel, two decks of windows). Used for the boats going
// round the bay, the ones in the marina, and the one you're at the helm of. Also: the marina office and its board.
// the letter of a word painted across a face at q (0..1 along it) on the row dz from its middle line, or ' ': only
// where it's big enough on screen to read (see the pier booths' signs)
function signChar(word, q, dz, t, half) {
  const n = word.length + 2, lq = q * n - 1, k = Math.floor(lq), cellU = t / projX / (2 * half) * n;
  return Math.abs(dz) < t / projY / 2 && k >= 0 && k < word.length && (cellU > 0.6 || Math.abs(fract(lq) - 0.5) < cellU / 2) ? word[k] : ' ';
}
const BOW_SLICES = 6;
const boatBob = (x, y) => Math.sin(T * 1.3 + x * 3 + y * 2) * 0.0035;
// b: { kind, col }. (vx, vy) relative to you, (hx, hy) the way the bow points. moving: 0..1 how hard it's going (a wake)
function drawBoat3D(b, vx, vy, hx, hy, moving = 0) {
  const k = BOAT_KINDS[b.kind], { hl, hw, fb } = k, z = boatBob(vx + px, vy + py), lit = Math.max(night, overcast * 0.5);
  if (Math.hypot(vx, vy) > vis + hl) return;
  const part = (u, phl, phw, z0, z1, shade, v = 0) => drawBox(boxAt(vx + hx * u - hy * v, vy + hy * u + hx * v, hx, hy, phl, phw, z0 + z, z1 + z), shade);
  const hullCol = b.col ?? WHITE, deck = b.kind === 'tug' || b.kind === 'ferry' ? GRAY : b.kind === 'sail' || b.kind === 'sailboat' ? BRICK : WHITE;
  // the hull: sides in its colour, a white rail along the top, a dark band at the waterline with a little wash
  const hull = (top, stern) => (i, t, L) => {
    const f = HIT.face, w = HIT.w - z;
    if (f === 6) return false;
    if (stern && f === 2 && b.name && w > 0.012 && w < top - 0.007) { // her name across the transom
      BG[i] = C(hullCol, (1.4 + L * 0.45) * shadeFace(f));
      const ch = signChar(b.name.toUpperCase(), (HIT.v / hw + 1) / 2, w - top * 0.5, t, hw);
      return set(i, ch, C(hullCol === WHITE || hullCol === YEL ? BLUE : WHITE, Math.max(L, 9))), true;
    }
    if (f === 5) { BG[i] = C(deck, 1.5 + L * 0.35); return set(i, deck === BRICK && fract(HIT.u * 40) < 0.2 ? '=' : ' ', C(BRICK, L * 0.6)), true; }
    BG[i] = C(hullCol, (1.4 + L * 0.45) * (f <= 2 ? 0.75 : shadeFace(f)) * (w < top * 0.4 ? 0.7 : 1)); // (darker low down, where she curves under)
    if (w < 0.01) { BG[i] = C(b.kind === 'ferry' ? BLUE : GRAY, 1 + L * 0.15); return set(i, moving && hash(Math.floor(HIT.u * 60 - T * 9), 1, 1501) > 0.5 ? '~' : '_', C(WHITE, L * 0.8)), true; }
    if (w > top - 0.007) return set(i, '=', C(hullCol === WHITE ? GRAY : WHITE, L)), true;
    if (b.kind === 'tug' && w > 0.015 && w < 0.03 && Math.abs(fract(HIT.u * 9) - 0.5) < 0.18) { BG[i] = C(GRAY, 1); return set(i, 'O', C(GRAY, L * 0.6)), true; } // tyres for fenders
    if ((b.kind === 'cruiser' || b.kind === 'speedboat') && Math.abs(w - top * 0.55) < 0.005) return set(i, '-', C(hullCol === BLUE ? WHITE : BLUE, L)), true; // a go-faster stripe
    return set(i, ' ', 0), true;
  };
  // the hull, in slices so it curves: a transom at the stern (her name on it), the body, then the bow narrowing to a
  // point and rising a little (the sheer) in BOW_SLICES steps along a curve
  part(-hl * 0.95, hl * 0.05, hw * 0.93, 0, fb, hull(fb, true));
  part(-hl * 0.35, hl * 0.55, hw, 0, fb, hull(fb));
  for (let k = 0; k < BOW_SLICES; k++) {
    const t0 = k / BOW_SLICES, t1 = (k + 1) / BOW_SLICES, tm = (t0 + t1) / 2, u0 = hl * (0.2 + 0.8 * t0), u1 = hl * (0.2 + 0.8 * t1);
    const top = fb * (1 + 0.28 * tm * tm);
    part((u0 + u1) / 2, (u1 - u0) / 2 + 0.002, hw * Math.max(0.12, Math.sqrt(1 - tm ** 1.7)), 0, top, hull(top));
  }
  if (moving > 0.05) part(-hl - hl * 1.2, hl * 1.2, hw * 3, 0, 0.002, (i, t, L) => { // the wake: a V of foam opening out behind
    if (HIT.face !== 5) return false;
    const q = (-hl - HIT.u) / (hl * 2.4), edge = hw * (0.7 + q * 2.2), av = Math.abs(HIT.v);
    const n = hash(Math.floor(HIT.u * 50 - T * 6), Math.floor(HIT.v * 50), 1502);
    if (Math.abs(av - edge) < 0.02 + q * 0.02 && n > q * 0.8) return set(i, '~', C(WHITE, L * (1.3 - q) * moving)), true;
    if (av < hw * 0.4 * (1 - q) && n > 0.7 + q * 0.3) return set(i, n > 0.8 ? '~' : '-', C(WHITE, L * (1 - q) * moving)), true; // the propeller's wash
    return false;
  });
  const glass = (frame) => (i, t, L) => { // windows: dark by day with a glint, lit up warm after dark
    const f = HIT.face;
    if (f === 5 || f === 6) { BG[i] = C(WHITE, 1.5 + L * 0.35); return set(i, ' ', 0), true; }
    if (frame(f)) { BG[i] = C(WHITE, (1.5 + L * 0.4) * shadeFace(f)); return set(i, '|', C(GRAY, L * 0.6)), true; }
    BG[i] = lit > 0.3 ? C(WARM, 2 + lit * 5) : C(CYAN, 1 + L * 0.12);
    return set(i, lit > 0.3 ? ' ' : hash(Math.floor(HIT.u * 30), Math.floor(HIT.w * 40), 1503) > 0.92 ? '/' : ' ', C(WHITE, 12)), true;
  };
  const cabin = (wy0, wy1, ports) => (i, t, L) => { // white sides, a band of windows (or round portholes)
    const f = HIT.face, w = HIT.w - z;
    BG[i] = C(WHITE, (1.5 + L * 0.42) * shadeFace(f));
    if (f === 5) return set(i, fract(HIT.u * 20) < 0.1 ? '-' : ' ', C(GRAY, L * 0.5)), true;
    if (w > wy0 && w < wy1 && f !== 6) {
      if (ports) return Math.abs(fract(HIT.u * ports + (f <= 2 ? HIT.v * ports : 0)) - 0.5) < 0.2 ? (set(i, 'o', C(lit > 0.3 ? YEL : CYAN, Math.max(L, lit * 15))), true) : (set(i, ' ', 0), true);
      BG[i] = lit > 0.3 ? C(WARM, 2 + lit * 5) : C(CYAN, 1 + L * 0.12);
      return set(i, Math.abs(fract(HIT.u * 12) - 0.5) < 0.06 ? '|' : ' ', C(WHITE, L * 0.7)), true;
    }
    return set(i, ' ', 0), true;
  };
  const solidCol = (col, top) => (i, t, L) => { BG[i] = C(col, (1.3 + L * 0.4) * shadeFace(HIT.face)); return set(i, top && HIT.w - z > top ? '=' : ' ', C(GRAY, L * 0.3)), true; };
  if (b.kind === 'speedboat') {
    part(hl * 0.12, 0.012, hw * 0.85, fb, fb + 0.035, glass(f => f <= 2 ? false : true)); // the windscreen
    part(-hl * 0.25, hl * 0.25, hw * 0.65, fb, fb + 0.018, (i, t, L) => { BG[i] = C(hullCol === RED ? WHITE : RED, (1.4 + L * 0.4) * shadeFace(HIT.face)); return set(i, HIT.face === 5 && fract(HIT.u * 25) < 0.2 ? '-' : ' ', C(WHITE, L * 0.5)), true; }); // the seats
    part(-hl - 0.012, 0.014, 0.025, 0.005, fb + 0.035, solidCol(GRAY, fb + 0.025)); // the outboard
  } else if (b.kind === 'sail' || b.kind === 'sailboat') {
    const mastU = hl * 0.18, mastTop = fb + 0.95;
    part(-hl * 0.05, hl * 0.32, hw * 0.65, fb, fb + 0.04, cabin(fb + 0.012, fb + 0.03, 10));
    part(mastU, 0.006, 0.006, fb + 0.04, mastTop, (i, t, L) => (HIT.w - z > mastTop - 0.02 && lit > 0.3 ? set(i, '*', C(WHITE, 15)) : set(i, '|', C(GRAY, L * 1.1)), true)); // the mast, a white light on top at night
    const sail = (u0, u1, z0, z1, aft) => { // a triangle: the mainsail tapers back from the mast, the jib forward to the bow
      const half = (u1 - u0) / 2;
      part((u0 + u1) / 2, half, 0.004, z0, z1, (i, t, L) => { // (HIT.u is from the box's middle)
        const h = (HIT.w - z - z0) / (z1 - z0), q = aft ? (half - HIT.u) / (2 * half) : (HIT.u + half) / (2 * half);
        if (q > 1 - h) return false; // outside the triangle: see-through
        BG[i] = C(WHITE, (2 + L * 0.5) * (HIT.face === 3 ? 1 : 0.85));
        return set(i, Math.abs(fract(h * 7) - 0.5) < 0.06 ? '-' : ' ', C(GRAY, L * 0.5)), true;
      });
    };
    sail(mastU - hl * 0.85, mastU - 0.008, fb + 0.07, mastTop - 0.04, true);
    sail(mastU + 0.008, hl * 0.97, fb + 0.03, mastTop - 0.1, false);
    part(mastU - hl * 0.42, hl * 0.43, 0.006, fb + 0.055, fb + 0.065, solidCol(GRAY)); // the boom
  } else if (b.kind === 'cruiser') {
    part(-hl * 0.05, hl * 0.5, hw * 0.82, fb, fb + 0.07, cabin(fb + 0.03, fb + 0.058, 0));
    part(hl * 0.42, 0.015, hw * 0.8, fb + 0.01, fb + 0.065, glass(f => f >= 3)); // the windscreen at the front of the cabin
    part(-hl * 0.18, hl * 0.22, hw * 0.65, fb + 0.07, fb + 0.1, glass(f => f >= 3 && Math.abs(fract(HIT.u * 8) - 0.5) < 0.1)); // the flybridge
  } else if (b.kind === 'tug') {
    part(hl * 0.1, 0.09, hw * 0.7, fb, fb + 0.1, cabin(fb + 0.06, fb + 0.09, 0)); // the wheelhouse
    part(-hl * 0.3, 0.028, 0.028, fb, fb + 0.17, (i, t, L) => { BG[i] = HIT.w - z > fb + 0.15 ? C(GRAY, 0.6) : C(YEL, (1.6 + L * 0.4) * shadeFace(HIT.face)); return set(i, ' ', 0), true; }); // the funnel
  } else if (b.kind === 'ferry') {
    part(-hl * 0.05, hl * 0.8, hw * 0.92, fb, fb + 0.07, cabin(fb + 0.025, fb + 0.05, 14));
    part(-hl * 0.1, hl * 0.55, hw * 0.8, fb + 0.07, fb + 0.13, cabin(fb + 0.09, fb + 0.115, 14));
    part(hl * 0.38, 0.07, hw * 0.85, fb + 0.13, fb + 0.17, cabin(fb + 0.14, fb + 0.165, 0)); // the bridge
    part(-hl * 0.4, 0.045, 0.045, fb + 0.13, fb + 0.26, (i, t, L) => { BG[i] = HIT.w - z > fb + 0.23 ? C(GRAY, 0.6) : C(RED, (1.6 + L * 0.4) * shadeFace(HIT.face)); return set(i, ' ', 0), true; });
  }
  if (lit > 0.3) { // navigation lights: red to port, green to starboard
    for (const [s, col] of [[-1, RED], [1, GREEN]]) {
      const lx = vx + hx * hl * 0.45 - hy * hw * s, ly = vy + hy * hl * 0.45 + hx * hw * s;
      drawArt(lx, ly, fb + z + 0.005, 0.02, 0.02, ['o'], () => C(col, 15));
    }
  }
}
// the boats going round the bay: heading from where they'll be a moment from now
function bayBoats() {
  for (const b of boats) {
    const p = boatAt(b, T), [vx, vy] = R(p.x, p.y);
    if (Math.abs(vx) > vis + 1 || Math.abs(vy) > vis + 1) continue;
    const q = boatAt(b, T + 0.3), hx = rel(q.x - p.x), hy = rel(q.y - p.y), n = Math.hypot(hx, hy) || 1;
    if (!b.col) b.col = b.kind === 'tug' ? RED : b.kind === 'ferry' ? WHITE : [WHITE, BLUE, WHITE, GREEN][hash(b.a, b.y, 1504) * 4 | 0];
    drawBoat3D(b, vx, vy, hx / n, hy / n, 0.6);
  }
}
const SALE_SIGN = pad(['.--------.', '|FOR SALE|', "'--------'"]), RENT_SIGN = pad(['.--------.', '| RENTAL |', "'--------'"]);
function marinaSprites() {
  for (const b of fleet) {
    const [vx, vy] = R(b.x, b.y);
    if (Math.hypot(vx, vy) > vis + 1) continue;
    drawBoat3D(b, vx, vy, b.hx, b.hy, b === sea ? clamp(Math.abs(b.v) / 0.8, 0, 1) : 0);
    if (b !== sea && (b.deal === 'sale' || b.deal === 'rent') && Math.hypot(vx, vy) < 6) { // a little board propped up on the deck
      const k = BOAT_KINDS[b.kind];
      drawArt(vx - b.hx * k.hl * 0.5, vy - b.hy * k.hl * 0.5, k.fb + 0.04, 0.14, 0.045, b.deal === 'sale' ? SALE_SIGN : RENT_SIGN, (c, row, L) => row === 1 && /[A-Z]/.test(c) ? C(b.deal === 'sale' ? RED : BLUE, Math.max(L, 10)) : C(WHITE, Math.max(L, 8)));
    }
  }
  const [vx, vy] = R(MARINA.x + 0.7, MARINA.office.y - 0.2); // the board at the foot of the jetty
  if (Math.hypot(vx, vy) < 8) drawArt(vx, vy, 0, 0.5, 0.42, MARINA_BOARD, (c, row, L) => row === 1 ? C(WHITE, Math.max(L, 11)) : row > 5 ? C(GRAY, L) : /[$0-9]/.test(c) ? C(YEL, Math.max(L, 9)) : C(WHITE, Math.max(L, 7)));
}
const MARINA_BOARD = pad(['.---------------.', '| BOATS FOR HIRE |', '| speed     $' + BOAT_KINDS.speedboat.rent + ' |', '| sail      $' + BOAT_KINDS.sailboat.rent + ' |', '| cruiser   $' + BOAT_KINDS.cruiser.rent + ' |',
  "'---------------'", '       |||', '       |||']);
// the marina office: white clapboard, a blue roof, MARINA over the door on the side facing the road, windows looking
// down the jetty
SOLID_SHADE.marina = o => (i, t, L) => {
  const f = HIT.face, w = HIT.w, u = HIT.u, glow = Math.max(night, overcast * 0.6);
  if (f === 5) { BG[i] = C(BLUE, 1.5 + L * 0.3); return set(i, fract(u * 10) < 0.15 ? '|' : ' ', C(BLUE, L * 0.5)), true; }
  BG[i] = C(WHITE, (1.4 + L * 0.4) * shadeFace(f));
  if (w > 0.27) { BG[i] = C(BLUE, 1.5 + L * 0.3); return set(i, '=', C(WHITE, L * 0.5)), true; } // the eaves
  if (f === 4 && w > 0.2) { // MARINA over the door
    BG[i] = C(BLUE, 2 + glow * 5);
    return set(i, signGlyph('MARINA', (1 - u / o.hl) / 2 * 8 - 1, (0.265 - w) / 0.06, t, 2 * o.hl / 8, 0.06, farDepth(rel(o.x - px), rel(o.y - py), o.hl)) || ' ', C(WHITE, 15)), true;
  }
  if (f === 4 && Math.abs(u) < 0.07 && w < 0.19) { BG[i] = C(BLUE, 1 + L * 0.1); return set(i, Math.abs(u) > 0.06 ? '|' : w > 0.18 ? '-' : ' ', C(WHITE, L)), true; } // the door
  if ((f === 3 || f === 4) && Math.abs(Math.abs(u) - 0.3) < 0.08 && Math.abs(w - 0.13) < 0.045) { // windows
    BG[i] = glow > 0.3 ? C(WARM, 2 + glow * 5) : C(CYAN, 1 + L * 0.12);
    return set(i, Math.abs(Math.abs(u) - 0.3) < 0.006 ? '|' : ' ', C(WHITE, L)), true;
  }
  return set(i, fract(w * 30) < 0.18 ? '-' : ' ', C(GRAY, L * 0.5)), true; // the clapboard
};
SOLID_SHADE.bollard = () => (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.2); return set(i, HIT.face === 5 ? 'o' : '|', C(GRAY, L)), true; };
// where the camera goes out on the water: behind and above the boat (easing round), or at the helm
function seaCam(dt, chase) {
  const b = sea, k = BOAT_KINDS[b.kind];
  if (!chase) { const back = k.hl * (b.kind === 'sailboat' ? 0.8 : 0.45); camYaw = a; return [mod(b.x - b.hx * back, N), mod(b.y - b.hy * back, N), a]; }
  camYaw += (mod(a - camYaw + Math.PI, 2 * Math.PI) - Math.PI) * Math.min(1, dt * 4);
  const bx = Math.cos(camYaw), by = Math.sin(camYaw);
  let back = 0.7 + k.hl * 1.6;
  while (back > 0.3 && map[idx(Math.floor(b.x - bx * back), Math.floor(b.y - by * back))]) back -= 0.05;
  return [mod(b.x - bx * back, N), mod(b.y - by * back, N), camYaw];
}
const seaEye = () => { const k = BOAT_KINDS[sea.kind]; return chaseOn ? 0.22 + k.hl * 0.25 : k.fb + (sea.kind === 'cruiser' ? 0.25 : 0.16); }; // (the cruiser: up on the flybridge)
