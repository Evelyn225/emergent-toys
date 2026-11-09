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
      if (du < 0.11 && dv < 0.06) { BG[i] = du > 0.095 || dv > 0.048 ? C(GRAY, 2 + L * .2) : C(WHITE, 6 + lit * 9); return set(i, ' ', 0), true; } // a light panel in its housing
      const fp = t / projY, j = Math.max(coveGroove(HIT.u, .2, .012, fp), coveGroove(HIT.v, .2, .012, fp)); // the soffit's panels, their joints filtered
      BG[i] = C(WHITE, 1.4 + L * 0.15 + lit * 2.5 - j * .8);
      return set(i, ' ', 0), true;
    }
    if (f === 5) { BG[i] = C(GRAY, 1.6 + L * 0.3 + roadLine(Math.abs(fract(HIT.u * 3 + .5) - .5) / 3, .012, t / projY) * .7); return set(i, ' ', 0), true; } // the roof deck's seams
    const w = HIT.w;
    if (w > 0.495 || w < 0.445) { BG[i] = C(WHITE, (2.6 + L * 0.3 + lit * 2) * shadeFace(f) - (w < 0.445 && w > 0.437 ? 1 : 0) + (w > .505 ? .6 : 0)); return set(i, ' ', 0), true; } // the fascia: lit along its top, a drip edge in shadow
    BG[i] = C(st.col, 2.6 + L * 0.25 + lit * 3);
    if (f !== 3) { // (not on the side over the shop)
      const ch = gasFaceText(o, st.brand, i, t, ...R(o.x, o.y), 0.47, 0.045, 0.07);
      if (ch !== null && ch !== ' ') return set(i, ch, C(WHITE, 15)), true;
    }
    return set(i, ' ', 0), true;
  },
  // an island: a kerb painted in yellow and black hazard stripes, concrete on top
  gasisle: () => (i, t, L) => {
    if (HIT.face === 5) { BG[i] = C(GRAY, 1.8 + L * 0.27); return set(i, ' ', 0), true; }
    const s = fract((HIT.face <= 2 ? HIT.v : HIT.u) * 12 + HIT.w * 12) < 0.5;
    BG[i] = C(s ? YEL : GRAY, s ? 2.5 + L * 0.3 : 0.6); return set(i, ' ', 0), true;
  },
  // a pump: the brand's colours, a lit display on each face that looks at a lane (dollars and gallons running up while
  // somebody fills up from it, the price per gallon when nobody is), three grade buttons, the nozzle hung up in its
  // holster when it isn't in a car
  gaspump: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w, st = o.st, k = shadeFace(f);
    if (f === 5) { BG[i] = C(st.col, 2.5 + L * 0.3); return set(i, ' ', 0), true; }
    if (w > 0.17) { BG[i] = C(st.col, (2.4 + L * 0.3) * k + (w > .193 ? 1.2 : 0)); return set(i, ' ', 0), true; } // the lit header, its top edge glowing
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, (1.8 + L * 0.3) * k - roadBands(w, 1 / 30, .2, t / projY) * .8); return set(i, ' ', 0), true; } // louvres down the sides
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
      if (fract((q + 0.6) / 0.4) < 0.2) BG[i] = C(GRAY, 1.2); // (between the buttons)
      return set(i, ' ', 0), true;
    }
    if (q > 0.62 && w > 0.04 && w < 0.115) { // the holster, and the nozzle in it unless it's out filling a car
      const nz = !busy && (w > 0.09 ? Math.abs(q - .8) < .12 : Math.abs(q - .74) < .05); // the nozzle: its grip, and the spout down into the holster
      BG[i] = nz ? C(BLUE, 6 + L * .3 + (w > .1 ? .8 : 0)) : C(GRAY, 1.2);
      return set(i, ' ', 0), true;
    }
    BG[i] = w < 0.03 ? C(st.col, (2 + L * .3) * k) : C(f === 3 || f === 4 ? WHITE : GRAY, (2.2 + L * 0.3) * k); // the kick plate in the brand's colour
    return set(i, ' ', 0), true;
  },
  gaspost: () => (i, t, L) => { BG[i] = C(WHITE, (2 + L * 0.3) * shadeFace(HIT.face) + (HIT.face === 5 ? .5 : 0)); return set(i, ' ', 0), true; },
  // the price sign: the brand at the top, the three grades below in lit red digits, both faces
  gassign: o => (i, t, L) => {
    const f = HIT.face, w = HIT.w + 0.33 - o.z0, st = o.st, lit = Math.max(gasLights(), 0.35); // (w: as if the board started at 0.33, where its layout was drawn)
    if (f !== 3 && f !== 4) { BG[i] = C(GRAY, (1.5 + L * 0.3) * shadeFace(f)); return set(i, ' ', 0), true; }
    const [vx, vy] = R(o.x, o.y);
    if (w > 0.57) { // the brand
      BG[i] = C(st.col, 3 + lit * 7);
      const ch = gasFaceText(o, st.brand, i, t, vx, vy, 0.615 - 0.33 + o.z0, 0.06, 0.04);
      return set(i, ch && ch !== ' ' ? ch : ' ', C(WHITE, 15)), true;
    }
    BG[i] = C(GRAY, 0.6 + lit * 0.6);
    const row = Math.floor((0.565 - w) / 0.075), p = gasPrices(st)[row];
    if (!p || Math.abs(HIT.u) > o.hl - 0.012 || w < 0.34) { BG[i] = C(WHITE, 2.4 + L * .3); return set(i, ' ', 0), true; } // the frame
    const ch = gasFaceText(o, p, i, t, vx, vy, 0.53 - row * 0.075 - 0.33 + o.z0, 0.045, 0.036);
    return set(i, ch && ch !== ' ' ? ch : ' ', C(ch && ch >= 'A' ? WHITE : RED, 15)), true;
  },
  // the ice chest by the door: white, ICE in blue down its front, frost on the lid
  gasice: o => (i, t, L) => {
    const f = HIT.face;
    BG[i] = C(WHITE, (2.6 + L * 0.3) * shadeFace(f));
    if (f === 5) { BG[i] = C(hash(Math.floor(HIT.u * 60), Math.floor(HIT.v * 60), 874) > .6 ? WHITE : CYAN, 4 + L * .3); return set(i, ' ', 0), true; } // frost on the lid
    if (f === 4) { const ch = gasFaceText(o, 'ICE', i, t, ...R(o.x, o.y), 0.05, 0.05, 0.06); if (ch && ch !== ' ') return set(i, ch, C(BLUE, 14)), true; }
    return set(i, ' ', 0), true;
  },
});

// the forecourt: concrete slabs, oil where the cars stand, yellow hatching in front of the shop door; shaded under the
// canopy by day, lit up white under it after dark
function gasFloor(i, r, x, wx, wy, f, L, d) {
  const st = gasStationAt(wx, wy), lx = rel(wx - st.x0), ly = rel(wy - st.y0), fp = homeBalconyPavingFootprint(d, eye);
  const out = Math.hypot(Math.max(0, 0.45 - lx, lx - 2.55), Math.max(0, 0.07 - ly, ly - 1.83)), under = out === 0;
  const lit = gasLights() * clamp(1 - out / 0.45, 0, 1), base = Math.max(L * roadDark() * .44 * (under ? .7 : 1), lit * 6.5);
  // concrete slabs, their joints faint and filtered (strong, they read as road markings); a little oil where the cars stand; yellow hatching in front of the door; white under the canopy after dark
  const j = Math.max(coveGroove(lx, .5, .012, fp), coveGroove(ly, .5, .012, fp));
  let bg = C(lit > .3 ? WHITE : GRAY, base * (1 - j * .12) + (hash(Math.floor(wx * 90), Math.floor(wy * 90), 88) - .5) * .25 * clamp(1 - fp / .008, 0, 1)); // (a fine grain, only up close: coarser, it blotched)
  if (GAS.lanes.some(l => Math.abs(ly - l) < 0.05) && Math.abs(lx - GAS.slotX) < 0.12 && noise(wx * 9, wy * 9, 87) > 0.58) bg = C(GRAY, base * .82); // oil, a faint stain where the cars stand
  if (ly > 1.86 && Math.abs(lx - 1.5) < 0.3 && roadBands(lx + ly, 1 / 7, .45, fp) > .5) bg = C(YEL, Math.max(3, base * 1.1));
  set(i, ' ', 0); BG[i] = bg; LAMPL[i] = lit * 12;
}

// the shop: a low box along the back of the forecourt. Its front (facing the pumps): glass between steel columns,
// shelves lit up behind it, sliding doors in the middle, the brand's colour along the top with FOOD MART on it.
// Its side on the street has a door of its own
function gasFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const st = SHOP[idx(mx, my)].gas, L = fog * amb * (side ? 10 : 15), glow = Math.max(L, 7 + night * 6);
  const front = side && rel(py - my) < 0, s = Math.abs(u - wc) < 1e-6 ? 1 : -1; // (u is wc, or -wc)
  const a = front ? worldCoord(wc - st.x0) : worldCoord(wc - st.y0 - 2); // along the face, from its west / north end
  BG[i] = bgAt(front ? WHITE : BRICK, day * 2.6 * (0.45 + 0.55 * fog) * (side ? 0.8 : 1), d);
  const fp = uStep;
  if (z > h - 0.025) { BG[i] = C(GRAY, 1.6 + L * .3 + (z > h - .01 ? .7 : 0)); return set(i, ' ', 0); } // the coping
  if (z > 0.29) { // the fascia (its lettering kept inside it, clear of the coping above: centred at 0.3225, 0.05 high)
    BG[i] = C(st.col, 2 + L * 0.2 + night * 3);
    if (front && wallText(i, u, uStep, z, d, 'FOOD MART', s * (wc - a + 1.5), 0.3225, 0.07, 0.05, C(WHITE, 15), C(st.col, 2 + L * 0.2 + night * 3))) return;
    if (!front && wallText(i, u, uStep, z, d, st.brand, s * (wc - a + 0.5), 0.3225, 0.06, 0.05, C(WHITE, 15), C(st.col, 2 + L * 0.2 + night * 3))) return;
    return set(i, ' ', 0);
  }
  if (!front) { // the side: brick, a door, a poster for the car wash
    if (Math.abs(a - 0.5) < 0.1 && z < 0.24) { BG[i] = Math.abs(a - 0.5) > 0.085 || z > 0.22 ? C(GRAY, 2.4 + L * .25) : C(CYAN, 1.5 + night * 2 + (z > .17 ? .6 : 0)); return set(i, ' ', 0); } // the side door: its frame, glass with the sky in its top
    if (Math.abs(a - 0.8) < 0.09 && z > 0.1 && z < 0.24) { BG[i] = C(BLUE, 2.5); if (wallText(i, u, uStep, z, d, 'CAR WASH', s * (wc - a + 0.8), 0.19, 0.02, 0.03, C(WHITE, 14), C(BLUE, 2.5))) return; if (z < 0.15) BG[i] = C(fract(a * 40 + z * 30) < 0.5 ? CYAN : BLUE, 4); return set(i, ' ', 0); } // (bubbles under the lettering)
    brickFace(i, a, z, BRICK, L * .6, fp, st.k); return set(i, ' ', 0);
  }
  if (a < 0.08 || a > 2.92 || Math.abs(a - 1.2) < 0.03 || Math.abs(a - 1.8) < 0.03) { const e = a < .08 ? a / .08 : a > 2.92 ? (3 - a) / .08 : 1 - Math.min(Math.abs(a - 1.2), Math.abs(a - 1.8)) / .03; BG[i] = C(GRAY, 1.8 + L * .3 + (e > .5 ? .6 : -.3)); return set(i, ' ', 0); } // the steel columns, round: lit down their middles
  if (z < 0.035) { BG[i] = C(GRAY, 1.6 + L * .25 + (z > .028 ? .6 : 0)); return set(i, ' ', 0); } // the kerb along its foot
  if (Math.abs(a - 1.5) < 0.27) { // the sliding doors: glass, a seam down the middle, OPEN 24 HRS on them
    BG[i] = C(CYAN, 1.5 + night * 2.5);
    if (z > 0.25) { BG[i] = C(GRAY, 1.8 + L * .3); return set(i, ' ', 0); } // the door head
    if (wallText(i, u, uStep, z, d, 'OPEN 24H', s * (wc - a + 1.5), 0.2, 0.03, 0.035, C(RED, 15), C(CYAN, 1.5 + night * 2.5))) return;
    if (Math.abs(a - 1.5) < 0.006) BG[i] = C(GRAY, 2.4 + L * .25); else if (z > .19) BG[i] = C(CYAN, 2 + night * 2.5 + day * .6); // the meeting stiles; the sky in the glass's top
    return set(i, ' ', 0);
  }
  if (z > 0.265) { BG[i] = C(GRAY, 1.8 + L * .3); return set(i, ' ', 0); } // the frame over the glass
  // the windows: shelves of snacks lit up behind them, posters stuck to the glass
  BG[i] = C(WARM, 1.2 + night * 2.5);
  const pane = Math.floor(a / 0.6), poster = hash(pane, st.k, 871) > 0.5 && fract(a / 0.6) > 0.25 && fract(a / 0.6) < 0.7 && z > 0.13 && z < 0.23;
  if (poster) { const col = [RED, YEL, BLUE, GREEN][hash(pane, st.k, 872) * 4 | 0]; BG[i] = fract(z * 40) < 0.3 ? C(WHITE, 8) : C(col, 4); return set(i, ' ', 0); } // a poster: bold lines of print on a colour
  const sh = fract(z / 0.06);
  if (sh < 0.18) { BG[i] = C(GRAY, 2 + night * 2 + (sh > .12 ? .8 : 0)); return set(i, ' ', 0); } // the shelves, their lips lit
  const g = hash(Math.floor(a * 30), Math.floor(z / 0.06), st.k + 873);
  if (g >= 0.3) BG[i] = C(ITEM_COL[g * 97 % 8 | 0], 2.5 + night * 3 + (sh > .7 ? .8 : 0)); // goods on them, lit along their tops
  return set(i, ' ', 0);
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
