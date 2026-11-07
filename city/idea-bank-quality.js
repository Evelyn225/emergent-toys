// Two interiors finished (WORLD_QUALITY.md items 39 and 40): IDEA, the flatpack furniture store, and the bank's hall.
// Metres. What each already had (the things you buy at IDEA, the bank's tellers, vault and guard) stays put.

// ---- IDEA: room sets round the buyable pieces, the warehouse racking along the back, the yellow arrows on the floor,
// the departments' signs hung from the ceiling, trolleys at the door, shoppers and a member of staff in yellow
// a flat thing on the floor you walk over (a rug, an arrow)
const IDEA_FLAT = (x, y, hl, hw, shade) => ({ ...BX(x, y, hl, hw, 0, .012, (i, t, L) => HIT.face === 5 ? shade(i, t, L) : false), walk: true });
const IDEA_RUG = (x, y, hl, hw, col) => IDEA_FLAT(x, y, hl, hw, (i, t, L) => {
  const e = Math.min(hl - Math.abs(HIT.u), hw - Math.abs(HIT.v)), stripe = fract(HIT.u * 1.5) < .5;
  BG[i] = C(e < .1 ? WHITE : col, (e < .1 ? 3.4 : stripe ? 2.6 : 2.1) + L * .2); return set(i, ' ', 0), true;
});
// an arrow painted on the floor pointing (dx, dy): the way round the store
function IDEA_ARROW(x, y, dx, dy) {
  return IDEA_FLAT(x, y, .45, .45, (i, t, L) => {
    const u = HIT.u * dx + HIT.v * dy, v = -HIT.u * dy + HIT.v * dx, head = u > 0 && Math.abs(v) < (.4 - u) * .9, shaft = u <= 0 && u > -.4 && Math.abs(v) < .1;
    if (!head && !shaft) return false;
    BG[i] = C(YEL, 8 + L * .2); return set(i, ' ', 0), true;
  });
}
// a department's sign on wires from the ceiling, its name both sides
function IDEA_HANGING_SIGN(x, y, word, along = true, ceiling = 3.4) {
  const hl = word.length * .14 + .2, c = along ? 1 : 0, s = along ? 0 : 1;
  return { x, y, ideaSign: word, radius: hl + .2, draw: (vx, vy) => {
    for (const k of [-1, 1]) rod(vx + c * k * (hl - .1), vy + s * k * (hl - .1), 2.95, vx + c * k * (hl - .1), vy + s * k * (hl - .1), ceiling, .006, GRAY, 1);
    drawBox(boxAt(vx, vy, c, s, hl, .03, 2.55, 2.95), (i, t, L) => {
      BG[i] = C(YEL, 9 + L * .2);
      if (HIT.face !== 3 && HIT.face !== 4) return set(i, ' ', 0), true;
      const n = word.length, q = (HIT.face === 3 ? HIT.u : -HIT.u) / (hl * 2 - .2) * n + n / 2;
      if (q >= 0 && q < n && oneCell(HIT.w - 2.75, t / projY) && oneCell((fract(q) - .5) * (hl * 2 - .2) / n, t / projX)) return set(i, word[Math.floor(q)], C(BLUE, 4)), true;
      return set(i, ' ', 0), true;
    });
  } };
}
// pallet racking against a wall, facing (0, 1): blue uprights, orange beams on three levels, flatpacks in their brown
// boxes on every shelf with the store's labels, the aisle and bay on a plate
function IDEA_RACKING(x, y, hl, aisle) {
  const D = .45, levels = [.12, 1.2, 2.3];
  return { x, y, ideaRacking: aisle, radius: hl + .5, box: boxAt(x, y, 1, 0, hl, D, 0, 2.7), draw: (vx, vy) => {
    drawBox(boxAt(vx, vy, 1, 0, hl, D, 0, 2.7), (i, t, L) => {
      const u = HIT.u + hl, w = HIT.w, f = HIT.face, upright = Math.abs(fract(u / 1.4) - .5) * 1.4 > .66 || u < .05 || u > 2 * hl - .05;
      const lvl = levels.findIndex(z => w >= z && w < z + .08);
      if (upright) { BG[i] = C(BLUE, 3 + L * .25 - (fract(w * 12) < .2 ? .7 : 0)); return set(i, ' ', 0), true; } // (its punched holes)
      if (lvl >= 0) { BG[i] = C(ORANGE, 6 + L * .3); return set(i, ' ', 0), true; }
      const base = levels.filter(z => w >= z + .08).pop(), bay = Math.floor(u / .7), k = levels.indexOf(base), fill = hash(bay, k, 3401 + aisle);
      const top = base + .1 + .55 + fill * .3, boxHere = base != null && w < Math.min(top, (levels[k + 1] ?? 2.7) - .05) && fill > .15 && Math.abs(fract(u / .7) - .5) < .44;
      if (!boxHere) { if (f === 4 || f === 3) return false; BG[i] = C(GRAY, 1); return set(i, ' ', 0), true; } // (empty: see the wall behind)
      const label = f === 4 && Math.abs(fract(u / .7) - .5) < .12 && Math.abs(w - base - .3) < .06; // (4: the front, toward the aisle)
      BG[i] = label ? C(WHITE, 9) : C(BRICK, (f === 5 ? 3.6 : 2.8 * shadeFace(f)) + L * .2 - (Math.abs(fract(u / .7) - .5) > .41 ? .6 : 0)); return set(i, ' ', 0), true;
    });
  } };
}
// a store trolley: a wire basket on wheels, yellow handle
const IDEA_TROLLEY = (x, y) => ROOM_MODEL(x, y, (vx, vy) => {
  drawBox(boxAt(vx, vy, 1, 0, .4, .27, .35, .85), (i, t, L) => { const mesh = Math.abs(fract(HIT.u * 18) - .5) > .38 || Math.abs(fract(HIT.w * 18) - .5) > .38 || HIT.face === 6; if (!mesh) return false; BG[i] = C(GRAY, 4 + L * .3); return set(i, ' ', 0), true; });
  drawBox(boxAt(vx - .42, vy, 1, 0, .03, .27, .85, 1.0), (i, t, L) => { BG[i] = C(YEL, 8); return set(i, ' ', 0), true; });
  for (const [u, v] of [[-.32, -.22], [-.32, .22], [.32, -.22], [.32, .22]]) drawBox(boxAt(vx + u, vy + v, 1, 0, .04, .04, 0, .35), (i, t, L) => { BG[i] = C(GRAY, HIT.w < .08 ? 1 : 3); return set(i, ' ', 0), true; });
}, [.45, .3, 1]);
// a price tag on a stand by a set: yellow, the price in black
function IDEA_TAG(x, y, price) {
  const text = '$' + price;
  return ROOM_MODEL(x, y, (vx, vy) => {
    drawBox(boxAt(vx, vy, 1, 0, .012, .012, 0, .9), (i, t, L) => { BG[i] = C(GRAY, 3); return set(i, ' ', 0), true; });
    drawBox(boxAt(vx, vy, 1, 0, .16, .012, .9, 1.12), (i, t, L) => {
      BG[i] = C(YEL, 10 + L * .2);
      if (HIT.face !== 3 && HIT.face !== 4) return set(i, ' ', 0), true;
      const q = (HIT.face === 3 ? HIT.u : -HIT.u) / .28 * text.length + text.length / 2;
      if (q >= 0 && q < text.length && oneCell(HIT.w - 1.01, t / projY) && oneCell((fract(q) - .5) * .28 / text.length, t / projX)) return set(i, text[Math.floor(q)], C(GRAY, 1)), true;
      return set(i, ' ', 0), true;
    });
  });
}
const IDEA_BASE_PROPS = ROOM_DEFS.idea.props, IDEA_BASE_WALL = ROOM_DEFS.idea.wall;
// the walls: the store's blue band below, white above, a yellow stripe between; the back wall over the racking marked SELF SERVE
ROOM_DEFS.idea.wall = (i, u, uStep, z, d, mx, my, L) => {
  if (my === 0 && z > 2.85 && z < 3.25 && Math.abs(u - 9) > 2.2 && wallText(i, u, uStep, z, d, 'SELF SERVE', u < 9 ? 3.6 : 14.4, 3.05, .26, .3, C(BLUE, 10), C(YEL, 9))) return true;
  if (Math.abs(z - .74) < .05) { BG[i] = C(YEL, 8 + L * .2); return set(i, ' ', 0), true; }
  return IDEA_BASE_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.idea.props = r => {
  const p = [...IDEA_BASE_PROPS(r)];
  p.push(IDEA_RUG(3, 5.9, 1.7, 1.25, BLUE), IDEA_RUG(3, 8.6, 1.3, 1.1, GREEN), IDEA_RUG(14.3, 5.4, 1.5, 1.1, RED), IDEA_RUG(14.6, 11, 1.6, 1.5, BLUE)); // under each set
  p.push(...FURNITURE_BED(14.6, 11.2, .8, 1.05, WHITE, 0, .5, 1), FURNITURE_STORAGE(13.4, 10.4, .22, .2, .55), FURNITURE_STORAGE(15.8, 10.4, .22, .2, .55)); // the bedroom set
  p.push(IDEA_RACKING(3.6, 1.5, 2.8, 1), IDEA_RACKING(14.4, 1.5, 2.8, 2)); // the warehouse along the back
  p.push(IDEA_HANGING_SIGN(3, 6.4, 'LIVING ROOMS'), IDEA_HANGING_SIGN(14.6, 10.6, 'BEDROOMS'), IDEA_HANGING_SIGN(14.3, 4.6, 'KIDS'), IDEA_HANGING_SIGN(9, 4.3, 'MARKET HALL'));
  for (const [x, y, dx, dy] of [[9, 11.4, 0, -1], [7.4, 10.2, -.7, -.7], [6.2, 8.2, 0, -1], [6.6, 4.8, .7, -.7], [11.6, 4.8, .7, .7], [12, 7.8, 0, 1]]) p.push(IDEA_ARROW(x, y, dx, dy)); // the way round
  p.push(IDEA_TAG(4.9, 4.4, 349), IDEA_TAG(4.6, 8, 129), IDEA_TAG(12.6, 12.2, 499), IDEA_TAG(12.4, 5.6, 19));
  p.push(IDEA_TROLLEY(11.2, 12.4), IDEA_TROLLEY(12.2, 12.4), POT_PLANT(16.8, 12.8, 1.6, 71));
  // shoppers browsing the sets, a couple trying the bed, and somebody from the store in yellow
  p.push({ ...standing(5.4, 6.3, GREEN), face: [-1, -.3] }, { ...standing(13.2, 12.6, MAG), face: [.6, -1] }, { ...standing(14, 12.7, BLUE), face: [.2, -1] },
    { ...figProp(11.8, 8.6, figLook({ hair: 'pony', top: 'tee', bot: 'pants', col: { top: [YEL, 13], bot: [BLUE, 5] } }), { face: [-1, 0] }) });
  return p;
};

// ---- the bank's hall: a queue between stanchions and their ropes up to the tellers, a desk for filling in slips, the
// manager's desk with a nameplate, the cash machine by the door, a rates board, the founder's portrait and a clock
function BANK_STANCHIONS(x0, x1, y) {
  const n = Math.round((x1 - x0) / 1.2) + 1, xs = Array.from({ length: n }, (_, k) => x0 + (x1 - x0) * k / (n - 1));
  return [...xs.map(x => ROOM_MODEL(x, y, (vx, vy) => {
    drum(vx, vy, .16, 0, .04, (i, t, L) => { BG[i] = C(YEL, 4 + L * .3); return set(i, ' ', 0), true; });
    drawBox(boxAt(vx, vy, 1, 0, .025, .025, .04, .95), (i, t, L) => { BG[i] = C(YEL, 5 + L * .3); return set(i, ' ', 0), true; });
    drum(vx, vy, .04, .95, 1.0, (i, t, L) => { BG[i] = C(YEL, 8); return set(i, ' ', 0), true; });
  }, [.06, .06, 1])), { x: (x0 + x1) / 2, y, bankRope: true, radius: (x1 - x0) / 2 + .2, draw: (vx, vy) => { // the ropes, sagging between
    for (let k = 1; k < n; k++) { const a = xs[k - 1] - (x0 + x1) / 2, b = xs[k] - (x0 + x1) / 2;
      for (let j = 0; j < 6; j++) { const q0 = j / 6, q1 = (j + 1) / 6, z = q => .9 - Math.sin(q * Math.PI) * .12; drawRod(vx + a + (b - a) * q0, vy, z(q0), vx + a + (b - a) * q1, vy, z(q1), .03, (i, t, L) => { BG[i] = C(RED, 5 + L * .4); return set(i, " ", 0), true; }); } }
  } }];
}
// a writing desk: a slab on a pedestal, deposit slips in a rack, pens on chains
const BANK_WRITING_DESK = (x, y) => [BX(x, y, .8, .35, 0, 1.05, (i, t, L) => {
  const top = HIT.face === 5, slip = top && Math.abs(HIT.v) < .2 && Math.abs(fract(HIT.u * 2) - .5) < .15;
  BG[i] = slip ? C(WHITE, 9) : C(top ? STONE : BRICK, (top ? 4 : 2.2 * shadeFace(HIT.face)) + L * .25); return set(i, ' ', 0), true; })];
// the manager's desk: walnut, a green lamp, a nameplate facing out, a leather chair behind
function BANK_MANAGER(x, y) {
  return [SMALL_DESK(x, y, .85, .42, .78, 1, 0, BRICK), ...homeChair(x - .85, y, 1, 0, BRICK), ...homeChair(x + 1, y, -1, 0, RED),
    ROOM_MODEL(x + .3, y - .25, (vx, vy) => { drawBox(boxAt(vx, vy, 1, 0, .012, .012, .78, 1.08), (i, t, L) => { BG[i] = C(YEL, 4); return set(i, ' ', 0), true; });
      drawBox(boxAt(vx, vy, 1, 0, .12, .06, 1.04, 1.12), (i, t, L) => { BG[i] = C(GREEN, 5 + night * 3); return set(i, ' ', 0), true; }); }),
    ROOM_MODEL(x + .4, y + .2, (vx, vy) => drawBox(boxAt(vx, vy, 0, 1, .16, .02, .78, .86), (i, t, L) => { BG[i] = HIT.face === 1 || HIT.face === 2 ? C(YEL, 7) : C(BRICK, 2); return set(i, ' ', 0), true; })),
    { ...figProp(x - .85, y, figLook({ hair: 'short', top: 'suit', bot: 'pants', col: { top: [GRAY, 3], inner: [WHITE, 12], tie: [RED, 8], bot: [GRAY, 3], hair: [GRAY, 8] } }), { pose: 'sit', seatZ: .45, face: [1, 0], chat: false }) }];
}
const BANK_QUALITY_PROPS = ROOM_DEFS.bank.props, BANK_QUALITY_WALL = ROOM_DEFS.bank.wall;
ROOM_DEFS.bank.wall = (i, u, uStep, z, d, mx, my, L) => {
  const W = room.W, H = room.H, v = mx === 0 || my === H - 1 ? -u : u; // (u runs negative on the left and front walls)
  if (mx === 0 && v > 2.6 && v < 5.4 && z > 1.4 && z < 2.6) { // the rates board: green felt, white letters, a brass frame
    if (v < 2.68 || v > 5.32 || z < 1.48 || z > 2.52) { BG[i] = C(YEL, 5 + L * .3); return set(i, ' ', 0), true; }
    BG[i] = C(GREEN, 1.6 + L * .1);
    const rows = ['RATES', 'SAVINGS  2.5%', 'MORTGAGE 6.1%', 'LOANS    8.9%'], row = Math.floor((2.5 - z) / .26);
    if (row >= 0 && row < rows.length && wallText(i, u, uStep, z, d, rows[row], -4, 2.37 - row * .26, .17, .18, C(row ? WHITE : YEL, 13), C(GREEN, 1.6))) return true;
    return set(i, ' ', 0), true;
  }
  if (mx === 0 && Math.abs(v - 6.8) < .55 && z > 1.3 && z < 2.7) { // the founder: an oil portrait in a gilt frame
    const fu = (v - 6.8) / .55, fz = (z - 2) / .7;
    if (Math.abs(fu) > .86 || Math.abs(fz) > .9) { BG[i] = C(YEL, 6 + L * .3); return set(i, ' ', 0), true; }
    const head = Math.hypot(fu * 1.3, fz - .35) < .35, body = fz < 0 && Math.abs(fu) < .6 - fz * .3;
    BG[i] = head ? C(SKIN, 6) : body ? C(GRAY, 1.2) : C(BRICK, 1.8 + fz * .5); return set(i, ' ', 0), true;
  }
  if (my === 0 && Math.hypot(u - 11.9, z - 2.85) < .3) { // the clock over the tellers
    const r = Math.hypot(u - 11.9, z - 2.85), ang = Math.atan2(z - 2.85, u - 11.9), hr = Math.PI / 2 - (tod % 12) / 12 * TAU, mn = Math.PI / 2 - fract(tod) * TAU;
    const hand = (r < .18 && Math.abs(Math.sin(ang - hr)) < .08 && Math.cos(ang - hr) > 0) || (r < .25 && Math.abs(Math.sin(ang - mn)) < .06 && Math.cos(ang - mn) > 0);
    BG[i] = r > .27 ? C(YEL, 6) : hand ? C(GRAY, 1) : C(WHITE, 10); return set(i, ' ', 0), true;
  }
  if (my === H - 1 && Math.abs(v - 3.6) < .45 && z > .8 && z < 2) { // the cash machine in the front wall: screen, keypad, the slot
    const fu = v - 3.6;
    if (z > 1.45 && z < 1.8 && Math.abs(fu) < .3) { BG[i] = C(CYAN, 5 + Math.sin(T * 2) * .4); return set(i, z > 1.7 && Math.abs(fu) < .2 ? '-' : ' ', C(WHITE, 12)), true; }
    if (z > 1.1 && z < 1.38 && Math.abs(fu) < .18) { BG[i] = C(GRAY, 3 + (Math.abs(fract(fu * 18) - .5) < .2 && Math.abs(fract(z * 18) - .5) < .2 ? 2 : 0)); return set(i, ' ', 0), true; }
    if (Math.abs(z - .98) < .02 && Math.abs(fu) < .2) { BG[i] = C(GRAY, .6); return set(i, ' ', 0), true; }
    BG[i] = C(GRAY, 2.4 + L * .25); return set(i, ' ', 0), true;
  }
  return BANK_QUALITY_WALL(i, u, uStep, z, d, mx, my, L);
};
ROOM_DEFS.bank.props = r => [...BANK_QUALITY_PROPS(r), ...bankQualityAdds(r)];
// (the people added here are tagged bankExtra: customers and the manager, not the tellers or the guard)
const bankQualityAdds = r => [...BANK_STANCHIONS(3.6, 9.6, 3.9), ...BANK_WRITING_DESK(9.4, 6.4), ...BANK_MANAGER(2.4, 6.2),
  POT_PLANT(1.4, 1.4, 1.5, 61), POT_PLANT(12.6, 7.6, 1.6, 62), POT_PLANT(1.3, 7.7, 1.5, 63),
  { ...standing(5.2, 4.5, GREEN), face: [0, -1] }, { ...standing(6.2, 4.7, MAG), face: [0, -1] }, { ...standing(9.6, 6.95, YEL), face: [0, -1] }].map(o => o.fig ? { ...o, bankExtra: true } : o); // the queue, and someone filling in a slip
