// The docks and the yards (style 8), one building at a time (the user: the industrial district lacked unique
// exteriors). Each industrial building is one of four kinds, from its seed:
//   shed     corrugated sheet on a steel frame, roll-up loading doors under a lit canopy, a band of high windows
//   mill     a brick mill: tall arched multi-pane windows on stone sills, a string course at each floor, timber
//            loading doors stacked up the middle bay under a hoist beam, a faded painted sign under the parapet
//   cold     a cold store: white insulated panels, dock doors in black rubber seals with striped bollards, a blue band
//   works    a concrete-framed works: columns and floor beams, every bay filled with a steel window, odd panes open
// Open shops keep their roll-up doors rolled away (a restaurant's room, a garage's lift, a store's racking behind them:
// shop-scenes.js); shut ones show their shutters. Everything is colour. u along the wall, z up it, both in city units.
const INDUSTRIAL_KINDS = ['shed', 'mill', 'cold', 'works', 'shed', 'mill'];
const INDUSTRIAL_NAMES = {
  shed: ['EAGLE FREIGHT', 'PIER 9 STORAGE', 'HARBOR SUPPLY', 'BAYSIDE HAULAGE', 'GULL LINE CARGO'],
  mill: ['UNION MILLS', 'NORTHERN WOOLEN CO', 'HALE & SONS', 'ACME COOKIE CO', 'STAR CORDAGE'],
  cold: ['DELTA COLD STORE', 'POLAR FISH CO', 'ICEHOUSE 3', 'ARCTIC FREEZE'],
  works: ['IRON WORKS', 'CITY FOUNDRY', 'KESTREL MOTORS', 'ATLAS PRINTING'],
};
const industrialKind = sk => INDUSTRIAL_KINDS[sk % INDUSTRIAL_KINDS.length];
const industrialName = (kind, sk) => { const n = INDUSTRIAL_NAMES[kind]; return n[(sk >> 3) % n.length]; };
// steel-framed multi-pane glass: its muntins filtered, the sky in it by day, warm after dark when lit; some panes open
function industrialGlass(i, a, z, pw, ph, lit, L, fp, seed) {
  const mu = Math.max(facadeLine(pw / 2 - Math.abs(fract(a / pw) - .5) * pw, .007, fp), facadeLine(ph / 2 - Math.abs(fract(z / ph) - .5) * ph, .007, fp)); // (distance to the nearest glazing bar)
  if (mu > .5) { BG[i] = C(GRAY, 1.2 + L * .2); return; }
  const pane = hash(Math.floor(a / pw), Math.floor(z / ph), seed);
  if (pane > .975) { BG[i] = C(GRAY, 1); return; } // a pane hinged open, the dark behind it
  BG[i] = lit ? C(WARM, 3 + night * 3 + pane * .8 - mu * 2) : C(CYAN, 1 + day * 1.2 + L * .08 + (pane > .8 ? .5 : 0) + (z / ph % 1 > .7 ? .3 : 0) - mu * 2); // (the odd pane a different age of glass; the sky in each pane's top; bars thinner than a cell darken it)
}
// a painted name across the wall; true if this cell is a letter (wallText draws it)
function industrialSign(i, u, uStep, z, d, word, wc, zc, band, fg, bg) {
  const sg = Math.sign(u * wc) || 1, every = 3, c = sg * (Math.floor(wc / every) * every + every / 2), cw = Math.min(.07, (every - .6) / Math.max(1, word.length));
  return wallText(i, u, uStep, z, d, word, c, zc, cw, band, fg, bg);
}
function industrialFacade(i, u, uStep, z, h, d, side, mx, my, wc, sh, sk, L, glowL, open) {
  const done = industrialWall(i, u, uStep, z, h, d, wc, sh, sk, L, open);
  // the name, painted once every 30 m under the parapet, over the wall (a faded white on the mill's brick, blue on the cold store's white)
  const kind = industrialKind(sk);
  if (done && h > .7 && z > h - .13 && z < h - .04) {
    const fg = kind === 'mill' ? C(WHITE, 3 + L * .2) : kind === 'cold' ? C(BLUE, 4 + L * .3) : kind === 'works' ? C(WHITE, 4 + L * .3) : C(YEL, 4 + L * .3);
    industrialSign(i, u, uStep, z, d, industrialName(kind, sk), wc, h - .085, .05, fg, BG[i]);
  }
  return done;
}
function industrialWall(i, u, uStep, z, h, d, wc, sh, sk, L, open) {
  const kind = industrialKind(sk), fp = Math.max(uStep, d / projY), lit = n => hash(n, 11, sk) > (night > .3 ? .45 : .8);
  set(i, ' ', 0);
  // the parapet's coping, lit along its top
  if (z > h - .03) { BG[i] = C(kind === 'mill' ? STONE : GRAY, 1.6 + L * .3 + (z > h - .012 ? .7 : 0)); return true; }
  const ground = z < .4;
  if (kind === 'mill') {
    const bay = Math.floor(u * 2), fu = fract(u * 2), mid = bay % 6 === 3; // (the hoist bay: loading doors up the middle)
    if (!ground && Math.abs(fract((z - .4) * 3) - 1) < .02 || Math.abs(z - .4) < .012) { BG[i] = C(STONE, 1.9 + L * .28 + (fract((z - .4) * 3) > .99 ? .5 : 0)); return true; } // the string course at each floor
    if (mid && z > h - .1 && z < h - .07 && fu > .35 && fu < .65) { BG[i] = C(GRAY, 1 + L * .2 + (z > h - .075 ? .5 : 0)); return true; } // the hoist beam, out over the doors
    if (mid && fu > .28 && fu < .72) { // timber loading doors on every floor, a ledge under each
      const zf = ground ? z : (z - .4) % (1 / 3), top = ground ? .3 : .27;
      if (zf < top && zf > (ground ? 0 : .04)) { const brace = Math.abs((fu - .28) / .44 - (zf / top)) < .05 || Math.abs(fu - .5) < .008; BG[i] = C(GREEN, (1.6 + L * .25) * (brace ? 1.25 : 1) - (fract(fu * 30) < .15 ? .3 : 0)); return true; }
    }
    // tall arched windows: segmental heads of brick, stone sills, steel-framed glass
    const zf = ground ? z - .06 : (z - .4) % (1 / 3) - .05, wh = ground ? .22 : .18, half = .085, du = (fu - .5) * .5, arch = wh + Math.sqrt(Math.max(0, (half * .9) ** 2 - du * du)) * .7; // (a round head over the tall window)
    if (!mid && Math.abs(du) < half * .9 && zf > 0 && zf < arch) {
      if (zf > arch - .016) { BG[i] = C(BRICK, 1 + L * .14 + (zf > arch - .006 ? .5 : 0)); return true; } // the arch's ring of headers, in shadow under the lit top
      if (sh && shopSceneFor(sh) && ground && open && d < SHOP_WINDOW.near * 1.6) { const c0 = Math.floor(u * 2) / 2; return shopWindow(i, u, z, c0 + .25 - half * .45, c0 + .25 + half * .45, .06, .06 + wh, sh, open, L, sk + bay), true; }
      industrialGlass(i, du, zf, .038, .042, lit(bay + Math.floor(z * 3) * 17), L, fp, sk + bay); return true;
    }
    if (!mid && Math.abs(du) < half * 1.05 && zf > -.014 && zf <= 0) { BG[i] = C(STONE, 2.2 + L * .3 + (zf > -.004 ? .6 : 0)); return true; } // the sill
    brickFace(i, u, z, BRICK, L * .9, fp, sk); return true;
  }
  if (kind === 'cold') {
    const panel = coveGroove(z, .05, .002, fp) * .5 + coveGroove(u, 1, .003, fp) * .5;
    if (!ground) { // insulated panels, a blue band, louvres for the plant
      if (z > h - .16 && z < h - .14) { BG[i] = C(BLUE, 3 + L * .3); return true; }
      if (fract(u / 2.5) < .06 && z > h - .3 && z < h - .2) { BG[i] = C(GRAY, 1.6 + L * .2 - coveGroove(z, .01, .003, fp)); return true; } // a louvre
      BG[i] = C(WHITE, 4 + L * .35 - panel * .9); return true;
    }
    const fd = fract(u * .8), door = fd > .18 && fd < .82;
    if (door && z < .3) {
      if (fd < .22 || fd > .78 || z > .28) { BG[i] = C(BLACK, 0); return true; } // the rubber seal round the opening
      if (open && sh && sh.kind !== SHOP_SHUT) return warehouseInside(i, u, z, sh, open, L, sk, fd), true;
      BG[i] = C(WHITE, 3.6 + L * .3 - coveGroove(z, .04, .003, fp) * .9); return true; // the insulated door, shut
    }
    if (z < .1 && (Math.abs(fd - .13) < .025 || Math.abs(fd - .87) < .025)) { BG[i] = C(Math.floor(z * 60) & 1 ? YEL : BLACK, Math.floor(z * 60) & 1 ? 6 : 0); return true; } // striped bollards
    BG[i] = C(WHITE, 3.8 + L * .35 - panel * .9); return true;
  }
  if (kind === 'works') { // a concrete frame, its bays all steel windows
    const col = facadeLine(Math.abs(fract(u * 2 + .5) - .5) * .5, .035, fp), beam = facadeLine(Math.abs(fract((z - .4) * 3 + .5) - .5) / 3, .03, fp);
    if (col > .5 || (!ground && beam > .5) || Math.abs(z - .4) < .015) { BG[i] = C(STONE, 1.9 + L * .3 + (beam > .5 && fract((z - .4) * 3) < .5 ? .4 : 0)); return true; }
    if (ground && fract(u * .5) < .25) { // a goods door every other bay
      if (z < .3) { if (open && sh && sh.kind !== SHOP_SHUT) return warehouseInside(i, u, z, sh, open, L, sk, fract(u * 2)), true; BG[i] = C(GRAY, 1.5 + L * .2 - coveGroove(z, 1 / 40, .006, fp) * .8); return true; }
    }
    const zf = ground ? z - .02 : (z - .4) % (1 / 3);
    if (zf < .03) { BG[i] = C(STONE, 1.6 + L * .25); return true; } // the upstand under the glazing
    industrialGlass(i, u, zf, .04, .035, lit(Math.floor(u * 2) + Math.floor(z * 3) * 13), L, fp, sk + 31); return true;
  }
  // shed: corrugated sheet, roll-up doors under a canopy, high windows
  const fd = fract(u * 0.8);
  if (ground && fd > 0.12 && fd < 0.88 && z < 0.3) return false; // (its doors: baseFacade's roll-up doors, shutters and shop rooms)
  if (ground && fd > .1 && fd < .9 && z >= .3 && z < .33) { BG[i] = C(GRAY, 1.8 + L * .3 + (z > .325 ? .6 : 0)); if (z < .305 && Math.max(night, overcast * .6) > .3 && Math.abs(fd - .5) < .05) BG[i] = C(WARM, 10); return true; } // the canopy over the door, a lamp under it after dark
  if (!ground && h - z < 0.3) { const fw = fract(u * 2); if (fw > 0.08 && fw < 0.92 && z < h - 0.08) { industrialGlass(i, fw, z, .05, .04, lit(Math.floor(u * 2)), L, fp, sk); return true; } }
  corrugated(i, u, sk & 1 ? ORANGE : GRAY, L, fp, sk & 1 ? -.3 : 0); return true; // rusty or grey
}
// an open goods door's inside: a shop's own room if it has one (shop-scenes.js), otherwise pallet racking
function warehouseInside(i, u, z, sh, open, L, sk, fd) {
  const w0 = Math.floor(u * .8) / .8;
  sceneOverride = SHOP_SCENES.storage;
  try { shopWindowBehind(i, u, z, w0 + .15, w0 + 1.1, .0, .3, sh, open, L, sk + Math.floor(u * .8)); } finally { sceneOverride = null; }
}

// ---- the roofs (pass 25): sheds and works under sawtooth north lights, cold stores with their refrigeration plant,
// mills with ventilators. Each roof cell of an industrial building gets its own, so a building's teeth run on unbroken
// across its cells. Teeth: ridges along x, the steep glazed face to the north (-y), the long slope of sheet to the south.
const SAWTOOTH = { teeth: 3, h: .11 };
// a tooth as half-spaces (n.p <= d, box-local x/y, absolute z): 0 the floor, 1-2 the ends, 3 the glazed face, 4 the slope
function sawtoothPlanes(h, P, H) {
  return [[0, 0, -1, -h], [1, 0, 0, .5], [-1, 0, 0, .5], [0, -1, 0, P / 2], [0, H / P, 1, h + H - P / 2 * H / P]];
}
let INDUSTRIAL_ROOFS_B = null;
function industrialRoofs() {
  if (!INDUSTRIAL_ROOFS_B) { // (built once the city is: which roof cells, what kind)
    const items = [];
    for (let k = 0; k < N * N; k++) {
      if (STY[k] !== 8 || SHOP[k]?.architecture || !map[k]) continue;
      const sk = sk0(SEED[k]), kind = industrialKind(sk), x = k % N, y = (k / N) | 0;
      const saw = kind === 'works' || kind === 'shed' && (sk & 2);
      if (saw || kind === 'cold' && hash(x, y, 1701) < .45 || kind === 'mill' && hash(x, y, 1702) < .35) items.push({ x: x + .5, y: y + .5, h: map[k], kind, saw, sk });
    }
    INDUSTRIAL_ROOFS_B = bucketed(items);
  }
  const P = 1 / SAWTOOTH.teeth, H = SAWTOOTH.h, lit = Math.max(night, overcast * .6) > .3;
  forNear(INDUSTRIAL_ROOFS_B, r => {
    const [vx, vy] = R(r.x, r.y), d = Math.hypot(vx, vy);
    if (d > vis || !inView(vx, vy, .8)) return;
    if (r.saw) for (let t = 0; t < SAWTOOTH.teeth; t++) {
      const cy = vy - .5 + (t + .5) * P, planes = sawtoothPlanes(r.h, P, H);
      drawBox({ x: vx, y: cy, c: 1, s: 0, hl: .5, hw: P / 2, z0: r.h, z1: r.h + H, planeData: roofPlaneData(planes) }, (i, tt, L) => {
        const f = HIT.face, fp = tt / projY;
        set(i, ' ', 0);
        if (f === 3) { // the north lights: glazing in steel bars, the sky in it, the works lit up behind it after dark
          const bar = Math.max(facadeLine(.03 - Math.abs(fract(HIT.u / .06) - .5) * .06, .004, fp), facadeLine(Math.abs(HIT.w - r.h - H * .5), .004, fp));
          BG[i] = bar > .5 ? C(GRAY, 1.6 + L * .2) : lit && hash(r.x, t, 1703) > .3 ? C(WARM, 5 + night * 4) : C(CYAN, 1.4 + day * 1.6 + (HIT.w - r.h > H * .5 ? .5 : 0) - bar);
          return true;
        }
        if (f === 4) { BG[i] = C(r.sk & 1 ? ORANGE : GRAY, 1.6 + L * .32 + roadBands(HIT.u, .02, .3, fp) * .4 - (r.sk & 1 ? .3 : 0)); paintSettledSnow(i, r.x + HIT.u, r.y + HIT.v, L * .6, .7, 0, HIT.w); return true; } // the slope of corrugated sheet, lit by the sky
        BG[i] = C(GRAY, (1.3 + L * .25) * shadeFace(f === 0 ? 6 : 1)); return true; // its ends
      }, rayMansard);
    }
    else if (r.kind === 'cold') { // a refrigeration unit: a louvred grey box, two fans on top
      const ux = vx + (hash(r.x, r.y, 1704) - .5) * .4, uy = vy + (hash(r.x, r.y, 1705) - .5) * .4;
      drawBox(boxAt(ux, uy, 1, 0, .12, .06, r.h, r.h + .06), (i, tt, L) => {
        set(i, ' ', 0);
        if (HIT.face === 5) { const fan = Math.min(Math.hypot(HIT.u - .06, HIT.v), Math.hypot(HIT.u + .06, HIT.v)); BG[i] = fan < .045 ? C(GRAY, fan < .012 ? 3 : .8 + (fract(Math.atan2(HIT.v, HIT.u - Math.sign(HIT.u) * .06) / 1.05 + T * 3) < .5 ? .6 : 0)) : C(GRAY, 2.6 + L * .3); return true; } // the fans turning
        BG[i] = C(GRAY, (1.8 + L * .3) * shadeFace(HIT.face) - roadBands(HIT.w, .008, .4, tt / projY) * .6); return true; // louvred sides
      });
    } else { // a mill's roof ventilator: a drum on a short neck, a cap over it
      const ux = vx + (hash(r.x, r.y, 1706) - .5) * .5, uy = vy + (hash(r.x, r.y, 1707) - .5) * .5;
      drawBox({ x: ux, y: uy, c: 1, s: 0, hl: .035, hw: .035, r1: .035, z0: r.h, z1: r.h + .07 }, (i, tt, L) => { BG[i] = C(GRAY, (1.4 + L * .3) * frustumLit() + (HIT.face === 5 ? .4 : 0) - (fract((HIT.w - r.h) * 60) < .2 ? .4 : 0)); return set(i, ' ', 0), true; }, rayFrustum); // the turbine's vanes
      drawBox({ x: ux, y: uy, c: 1, s: 0, hl: .045, hw: .045, r1: .02, z0: r.h + .07, z1: r.h + .09 }, (i, tt, L) => { BG[i] = C(GRAY, (1.8 + L * .3) * frustumLit()); return set(i, ' ', 0), true; }, rayFrustum); // its cap
    }
  });
}
