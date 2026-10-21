// ---- gas stations, drawn (gas.js and world.js have the rest): the forecourt's concrete, the canopy with its lights
// and the brand along its edge, the islands and pumps (the pump's display counting up while someone fills up), the
// price sign on its pole, the shop's front; the drivers out at the pumps with the hose in the car.

// the canopy's lights: on day and night, but you only see them make a difference after dark (or in the murk)
const gasLights = () => clamp(night * 1.4 + fogAmt * 0.5 + storm * 0.4, 0, 1);
// a line of text across one face of a box solid (any of its four sides), centred, letters letterW apart, its middle
// at zc. null off the ends of the text, ' ' off its row
function gasFaceText(o, word, i, t, vx, vy, zc, bandH, letterW) {
  const f = HIT.face, along = f === 3 ? HIT.u : f === 4 ? -HIT.u : f === 1 ? -HIT.v : HIT.v; // (the way it reads)
  const [ex, ey] = f === 3 ? [o.c, o.s] : f === 4 ? [-o.c, -o.s] : f === 1 ? [o.s, -o.c] : [-o.s, o.c];
  const end = f <= 2, out = end ? o.hl : o.hw, nx = end ? o.c * (f === 1 ? 1 : -1) : -o.s * (f === 3 ? 1 : -1), ny = end ? o.s * (f === 1 ? 1 : -1) : o.c * (f === 3 ? 1 : -1);
  const fx = vx + nx * out, fy = vy + ny * out; // (the middle of the face itself: a deep box's middle is well behind it)
  return signLine(word, along / letterW + word.length / 2, (zc + bandH / 2 - HIT.w) / bandH, i, zc, midDepth(fx, fy), t, letterW, bandH, farDepth(fx, fy, end ? o.hw : o.hl), ex, ey);
}
const gasPrices = st => [['REG', st.price], ['MID', st.price + 0.3], ['DSL', st.price + 0.5]].map(([g, p]) => `${g} ${p.toFixed(2)}`);
Object.assign(SOLID_SHADE, {
  // the canopy: from below, white panels with rows of lights over the lanes; round its edge a white fascia with a band
  // of the brand's colour and its name, facing the streets
  gascanopy: o => (i, t, L) => {
    const f = HIT.face, st = o.st, lit = gasLights();
    if (f === 6) {
      const du = Math.min(...[-0.7, 0, 0.7].map(c => Math.abs(HIT.u - c))), dv = Math.min(...GAS.lanes.map(l => Math.abs(HIT.v - l + 0.95)));
      if (du < 0.11 && dv < 0.06) { BG[i] = C(WHITE, 6 + lit * 9); return set(i, du > 0.095 || dv > 0.048 ? '+' : ' ', C(GRAY, 9)), true; }
      BG[i] = C(WHITE, 1.4 + L * 0.15 + lit * 2.5);
      return set(i, fract(HIT.u * 5) < 0.06 || fract(HIT.v * 5) < 0.06 ? '+' : ' ', C(GRAY, 4 + L * 0.3)), true;
    }
    if (f === 5) { BG[i] = C(GRAY, 1.6 + L * 0.3); return set(i, fract(HIT.u * 3) < 0.04 ? '=' : ' ', C(GRAY, L * 0.5)), true; }
    const w = HIT.w;
    if (w > 0.495 || w < 0.445) { BG[i] = C(WHITE, (2.6 + L * 0.3 + lit * 2) * shadeFace(f)); return set(i, w < 0.445 && w > 0.437 ? '_' : ' ', C(GRAY, 6)), true; }
    BG[i] = C(st.col, 2.6 + L * 0.25 + lit * 3);
    if (f !== 3) { // (not on the side over the shop)
      const ch = gasFaceText(o, st.brand, i, t, ...R(o.x, o.y), 0.47, 0.045, 0.07);
      if (ch !== null && ch !== ' ') return set(i, ch, C(WHITE, 15)), true;
    }
    return set(i, ' ', 0), true;
  },
  // an island: a kerb painted in yellow and black hazard stripes, concrete on top
  gasisle: () => (i, t, L) => {
    if (HIT.face === 5) { BG[i] = C(GRAY, 1.6 + L * 0.25); return set(i, '.', C(GRAY, L * 0.6)), true; }
    const s = fract((HIT.face <= 2 ? HIT.v : HIT.u) * 12 + HIT.w * 12) < 0.5;
    BG[i] = C(s ? YEL : GRAY, s ? 2.5 + L * 0.3 : 0.6); return set(i, ' ', 0), true;
  },
  // a pump: the brand's colours, a lit display on each face that looks at a lane (dollars and gallons running up while
  // somebody fills up from it, the price per gallon when nobody is), three grade buttons, the nozzle hung up in its
  // holster when it isn't in a car
  gaspump: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w, st = o.st, k = shadeFace(f);
    if (f === 5) { BG[i] = C(st.col, 2.5 + L * 0.3); return set(i, ' ', 0), true; }
    if (w > 0.17) { BG[i] = C(st.col, (2.4 + L * 0.3) * k); return set(i, w > 0.193 ? '_' : ' ', C(WHITE, 10)), true; } // the lit header
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, (1.8 + L * 0.3) * k); return set(i, fract(w * 30) < 0.2 ? '-' : ' ', C(GRAY, L * 0.5)), true; }
    const l = o.isle + (f === 3 ? 1 : 0), c = GAS_FILLING[st.k] && GAS_FILLING[st.k][l], busy = c && GAS_FILL[l][0] === o.isle;
    const q = (f === 3 ? HIT.u : -HIT.u) / o.hl; // -1..1 across the face, left to right as you look at it
    if (w > 0.115 && Math.abs(q) < 0.8) { // the display
      BG[i] = C(GRAY, 0.5);
      const [vx, vy] = R(o.x, o.y), sale = busy ? (T - c.pit.t0) * 2.15 : 0;
      const line = w > 0.142 ? (busy ? '$' + sale.toFixed(2) : 'PAY HERE') : (busy ? (sale / st.price).toFixed(2) + 'G' : st.price.toFixed(2));
      const ch = gasFaceText(o, line, i, t, vx, vy, w > 0.142 ? 0.155 : 0.128, 0.022, 0.011);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(busy ? GREEN : CYAN, 14)), true;
    }
    if (w > 0.075 && w < 0.1 && Math.abs(q) < 0.6) { // the grade buttons
      const b = Math.floor((q + 0.6) / 0.4); BG[i] = C([YEL, GREEN, BLUE][b] ?? GRAY, 3 + L * 0.2);
      return set(i, fract((q + 0.6) / 0.4) < 0.2 ? '|' : ' ', C(GRAY, 4)), true;
    }
    if (q > 0.62 && w > 0.04 && w < 0.115) { // the holster, and the nozzle in it unless it's out filling a car
      BG[i] = C(GRAY, 1.2);
      return set(i, busy ? ' ' : w > 0.09 ? 'J' : '|', C(busy ? GRAY : BLUE, 12)), true;
    }
    BG[i] = C(f === 3 || f === 4 ? WHITE : GRAY, (2.2 + L * 0.3) * k);
    return set(i, w < 0.03 ? '#' : ' ', C(st.col, L)), true;
  },
  gaspost: () => (i, t, L) => { BG[i] = C(WHITE, (2 + L * 0.3) * shadeFace(HIT.face)); return set(i, '|', C(GRAY, L * 0.7)), true; },
  // the price sign: the brand at the top, the three grades below in lit red digits, both faces
  gassign: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w, st = o.st, lit = Math.max(gasLights(), 0.35);
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, (1.5 + L * 0.3) * shadeFace(f)); return set(i, ' ', 0), true; }
    const [vx, vy] = R(o.x, o.y);
    if (w > 0.57) { // the brand
      BG[i] = C(st.col, 3 + lit * 7);
      const ch = gasFaceText(o, st.brand, i, t, vx, vy, 0.615, 0.06, 0.04);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 15)), true;
    }
    BG[i] = C(GRAY, 0.6 + lit * 0.6);
    const row = Math.floor((0.565 - w) / 0.075), p = gasPrices(st)[row];
    if (!p || Math.abs(HIT.u) > o.hl - 0.012 || w < 0.34) return set(i, w < 0.345 ? '=' : '|', C(WHITE, L)), true; // the frame
    const ch = gasFaceText(o, p, i, t, vx, vy, 0.53 - row * 0.075, 0.045, 0.036);
    return set(i, ch && ch !== ' ' ? ch : ' ', C(ch && ch >= 'A' ? WHITE : RED, 15)), true;
  },
  // the ice chest by the door: white, ICE in blue down its front, frost on the lid
  gasice: o => (i, t, L) => {
    const f = HIT.face;
    BG[i] = C(WHITE, (2.6 + L * 0.3) * shadeFace(f));
    if (f === 5) return set(i, '-', C(CYAN, 8)), true;
    if (f === 4) { const ch = gasFaceText(o, 'ICE', i, t, ...R(o.x, o.y), 0.05, 0.05, 0.06); if (ch && ch !== ' ') return set(i, ch, C(BLUE, 14)), true; }
    return set(i, ' ', 0), true;
  },
});

// the forecourt: concrete slabs, oil where the cars stand, yellow hatching in front of the shop door; shaded under the
// canopy by day, lit up white under it after dark
function gasFloor(i, r, x, wx, wy, f, L) {
  const st = gasStationAt(wx, wy), lx = rel(wx - st.x0), ly = rel(wy - st.y0);
  const out = Math.hypot(Math.max(0, 0.45 - lx, lx - 2.55), Math.max(0, 0.07 - ly, ly - 1.83)), under = out === 0;
  const lit = gasLights() * clamp(1 - out / 0.45, 0, 1);
  let ch = (r + x) & 1 ? '.' : ' ', col = GRAY, k = 1;
  if (fract(lx * 2) < 0.025 || fract(ly * 2) < 0.025) ch = '+'; // the joints between slabs
  else if (GAS.lanes.some(l => Math.abs(ly - l) < 0.07) && Math.abs(lx - GAS.slotX) < 0.16 && noise(wx * 7, wy * 7, 87) > 0.52) { ch = '%'; k = 0.55; } // oil
  if (ly > 1.86 && Math.abs(lx - 1.5) < 0.3) { ch = fract((lx + ly) * 7) < 0.45 ? '/' : ' '; col = YEL; k = 1.3; }
  const glowL = lit * 12;
  set(i, ch, C(col === GRAY && glowL > L ? WHITE : col, Math.max(L * k * (under ? 0.7 : 1), glowL * k)));
  BG[i] = glowL > 2 ? C(WHITE, 1 + lit * 2.4) : bgAt(GRAY, day * 2.2 * f * (under ? 0.5 : 1));
  LAMPL[i] = glowL;
}

// the shop: a low box along the back of the forecourt. Its front (facing the pumps): glass between steel columns,
// shelves lit up behind it, sliding doors in the middle, the brand's colour along the top with FOOD MART on it.
// Its side on the street has a door of its own
function gasFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const st = SHOP[idx(mx, my)].gas, L = fog * amb * (side ? 10 : 15), glow = Math.max(L, 7 + night * 6);
  const front = side && rel(py - my) < 0, s = Math.abs(u - wc) < 1e-6 ? 1 : -1; // (u is wc, or -wc)
  const a = front ? worldCoord(wc - st.x0) : worldCoord(wc - st.y0 - 2); // along the face, from its west / north end
  BG[i] = bgAt(front ? WHITE : BRICK, day * 2.6 * (0.45 + 0.55 * fog) * (side ? 0.8 : 1), d);
  if (z > h - 0.025) return set(i, '=', C(GRAY, L));
  if (z > 0.29) { // the fascia
    BG[i] = C(st.col, 2 + L * 0.2 + night * 3);
    if (front && wallText(i, u, uStep, z, d, 'FOOD MART', s * (wc - a + 1.5), 0.335, 0.07, 0.06, C(WHITE, 15), C(st.col, 2 + L * 0.2 + night * 3))) return;
    if (!front && wallText(i, u, uStep, z, d, st.brand, s * (wc - a + 0.5), 0.335, 0.06, 0.06, C(WHITE, 15), C(st.col, 2 + L * 0.2 + night * 3))) return;
    return set(i, ' ', 0);
  }
  if (!front) { // the side: brick, a door, a poster for the car wash
    if (Math.abs(a - 0.5) < 0.1 && z < 0.24) { BG[i] = C(CYAN, 1.5 + night * 2); return set(i, Math.abs(a - 0.5) > 0.085 ? '|' : z > 0.22 ? '=' : ':', C(WHITE, glow)); }
    if (Math.abs(a - 0.8) < 0.09 && z > 0.1 && z < 0.24) { BG[i] = C(BLUE, 2.5); if (wallText(i, u, uStep, z, d, 'CAR WASH', s * (wc - a + 0.8), 0.19, 0.02, 0.03, C(WHITE, 14), C(BLUE, 2.5))) return; return set(i, z < 0.15 && fract(a * 40) < 0.5 ? '~' : ' ', C(CYAN, 12)); }
    return set(i, fract(a * 12 + (Math.floor(z * 24) & 1) * 0.5) < 0.15 ? '|' : '_', C(BRICK, L));
  }
  if (a < 0.08 || a > 2.92 || Math.abs(a - 1.2) < 0.03 || Math.abs(a - 1.8) < 0.03) return set(i, '|', C(GRAY, L * 1.2)); // the columns
  if (z < 0.035) return set(i, '_', C(GRAY, L)); // the kerb along its foot
  if (Math.abs(a - 1.5) < 0.27) { // the sliding doors: glass, a seam down the middle, OPEN 24 HRS on them
    BG[i] = C(CYAN, 1.5 + night * 2.5);
    if (z > 0.25) return set(i, '=', C(GRAY, L));
    if (wallText(i, u, uStep, z, d, 'OPEN 24H', s * (wc - a + 1.5), 0.2, 0.03, 0.035, C(RED, 15), C(CYAN, 1.5 + night * 2.5))) return;
    return set(i, Math.abs(a - 1.5) < 0.006 ? '|' : ' ', C(GRAY, 8));
  }
  if (z > 0.265) return set(i, '-', C(GRAY, L)); // the frame over the glass
  // the windows: shelves of snacks lit up behind them, posters stuck to the glass
  BG[i] = C(WARM, 1.2 + night * 2.5);
  const pane = Math.floor(a / 0.6), poster = hash(pane, st.k, 871) > 0.5 && fract(a / 0.6) > 0.25 && fract(a / 0.6) < 0.7 && z > 0.13 && z < 0.23;
  if (poster) { const col = [RED, YEL, BLUE, GREEN][hash(pane, st.k, 872) * 4 | 0]; BG[i] = C(col, 3); return set(i, fract(z * 40) < 0.3 ? '=' : ' ', C(WHITE, 12)); }
  if (fract(z / 0.06) < 0.18) return set(i, '_', C(GRAY, glow * 0.7)); // the shelves
  const g = hash(Math.floor(a * 30), Math.floor(z / 0.06), st.k + 873);
  return set(i, g < 0.3 ? ' ' : 'o#=@%'[g * 50 % 5 | 0], C(ITEM_COL[g * 97 % 8 | 0], glow * 0.8));
}

// before the solids: who's filling up where (for the pumps' displays), and the drivers out at the pumps, the hose from
// the pump to the filler cap
const GAS_FILLING = []; // (per station, by lane: the car filling up there, while it's near enough to see)
function gasFigureTargets() {
  const out=[];
  for(const c of cars)if(gasFilling(c)) {
    const p=c.pit,st=p.st,l=p.lane,[isle]=GAS_FILL[l],sd=Math.sign(GAS.islands[isle]-GAS.lanes[l]);p.gasDriver=true;
    out.push(sceneFigureTarget(p,st.x0+GAS.pumpX+.13,st.y0+GAS.lanes[l]+sd*.175,0,.175,{sd,car:c}));
  }
  for(const b of bodies)if(b.who.gasDriver&&!out.some(p=>p.who===b.who))out.push(sceneFigureTarget(b.who,b.x,b.y,0));
  return out;
}
function gasSprites() {
  for(const p of gasFigureTargets())if(p.who.dead&&!p.who.hidden)drawSceneFigure(p,p.who.look ||= figStreetLook(17,BLUE,BLUE));
  for (const st of GAS_STATIONS) {
    const [vx, vy] = R(st.x0 + 1.5, st.y0 + 1);
    GAS_FILLING[st.k] = Math.abs(vx) < vis + 2 && Math.abs(vy) < vis + 2 ? [null, null, null] : null;
  }
  for (const c of cars) {
    if (!gasFilling(c) || !GAS_FILLING[c.pit.st.k]) continue;
    const p = c.pit, st = p.st, l = p.lane, [isle] = GAS_FILL[l], iy = GAS.islands[isle], ly = GAS.lanes[l], sd = Math.sign(iy - ly);
    GAS_FILLING[st.k][l] = c;
    const [vx, vy] = R(st.x0 + GAS.pumpX + 0.13, st.y0 + ly + sd * 0.175);
    if (!inView(vx, vy, 0.4)) continue;
    if(p.dead||p.hidden)continue;
    drawFigure(vx, vy, 0, 0.175, 0, -sd, p.look ||= figStreetLook(c.id * 7919 + 17, pick([RED, BLUE, GREEN, WHITE, GRAY]), BLUE), 'stand');
    // the hose: out of the pump's side, sagging, into the filler cap
    const [ax, ay] = R(st.x0 + GAS.pumpX + 0.05, st.y0 + iy - sd * 0.045), [bx, by] = R(st.x0 + GAS.pumpX, st.y0 + ly + sd * 0.115);
    const z = q => 0.13 + (0.075 - 0.13) * q - Math.sin(q * Math.PI) * 0.05;
    for (let k = 0; k < 4; k++) { const q0 = k / 4, q1 = (k + 1) / 4; rod(ax + (bx - ax) * q0, ay + (by - ay) * q0, z(q0), ax + (bx - ax) * q1, ay + (by - ay) * q1, z(q1), 0.004, GRAY, 0.7); }
  }
}
