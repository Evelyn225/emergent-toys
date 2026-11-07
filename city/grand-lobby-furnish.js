// The Grand Hotel's lobby furnished as the city's showpiece (WORLD_QUALITY.md item 37). The 24 x 17 m hall gets:
// - walls: walnut panelling to the dado, cream above between gilt pilasters, arched mirrors on the side walls, a frieze
//   and cornice, the hotel's name over the reception, its key cubbies behind the desk, and two brass lift doors
// - floor: a long runner from the doors to the flowers, oriental rugs under the two sitting areas
// - furniture: armchairs facing the sofas, standard lamps beside them, a colonnade either side, more chandeliers, palms
//   at the doors, a concierge's podium, and guests: reading, waiting at the desk, checking in with luggage
// The existing reception, staff door, clock, entrance, arrival table and trolley stay where they are.
const GRAND_LIFTS = [4.2, 7.2]; // (centres along the right-hand wall, y)
const GRAND_GILT = L => C(YEL, 6 + L * .5);
function grandLobbyWall(i, u, uStep, z, d, mx, my, L) {
  const W = room.W, H = room.H, side = mx === 0 || mx === W - 1, back = my === 0, along = u, fp = Math.max(uStep, d / projY);
  set(i, ' ', 0);
  if (z > 4.75) { BG[i] = C(STONE, 3.6 + L * .2 - (z < 4.82 ? .8 : 0)); return true; } // the cornice, its shadowed lip
  if (z > 4.4) { const egg = fract(along * 4) < .5; BG[i] = z > 4.68 || z < 4.47 ? GRAND_GILT(L) : C(STONE, (egg ? 3 : 2.4) + L * .2); return true; } // the frieze between gilt bands
  // the lifts: brass doors with their seam, a frame, and the floor dial over each
  if (mx === W - 1) for (const c of GRAND_LIFTS) {
    const q = along - c;
    if (Math.abs(q) < .75 && z < 2.6) {
      if (Math.abs(q) > .62 || z > 2.45) { BG[i] = C(BRICK, 2 + L * .2); return true; } // the frame
      const seam = Math.abs(q) < Math.max(.012, fp * .6), panel = Math.abs(fract(z / .6) - .5) < .02;
      BG[i] = C(YEL, (seam ? 2.5 : panel ? 4 : 5.4) + L * .35 - Math.abs(q) * 1.5); return true;
    }
    if (Math.abs(q) < .32 && z > 2.75 && z < 3.15) { // the dial: an arc of numbers and its needle
      const r = Math.hypot(q, z - 2.75) / .32, ang = Math.atan2(z - 2.75, q), needle = Math.abs(ang - (1 + Math.sin(T * .13 + c) * .9)) < .06 && r < .9;
      BG[i] = r > .92 ? GRAND_GILT(L) : needle ? C(GRAY, 1) : C(STONE, 4 + L * .3); return true;
    }
  }
  if (back) { // over the reception: the hotel's name in gilt; behind the desk, the key cubbies
    if (z > 3.35 && z < 3.85 && wallText(i, u, uStep, z, d, 'THE GRAND HOTEL', 12, 3.6, .38, .4, GRAND_GILT(L), C(BRICK, 1.6 + L * .1))) return true;
    if (Math.abs(along - 6.5) < 1.5 && z > 1.25 && z < 2.55) {
      const cx = fract((along - 5) / .3), cz = fract((z - 1.25) / .26), key = cx > .4 && cx < .6 && cz > .25 && cz < .7 && hash(Math.floor((along - 5) / .3), Math.floor((z - 1.25) / .26), 3301) > .35;
      BG[i] = cx < .08 || cz < .1 ? C(BRICK, 2.6 + L * .2) : key ? GRAND_GILT(L) : C(BRICK, 1.1 + L * .1); return true;
    }
  }
  // gilt pilasters every 3 m, panelled walnut to the dado, cream above (an arched mirror between pilasters on the sides)
  const bay = fract(along / 3), pil = Math.abs(bay - .5) > .46;
  if (pil && z > 1.15) { BG[i] = C(STONE, 4 + L * .3 - (Math.abs(Math.abs(bay - .5) - .48) < .006 ? 1 : 0)); return true; }
  if (z < 1.15) { // the wainscot: walnut panels under a moulded rail
    if (z > 1.08) { BG[i] = C(BRICK, 3 + L * .25); return true; }
    const pu = fract(along / 1.5), panel = pu > .08 && pu < .92 && z > .16 && z < .98, edge = panel && (pu < .11 || pu > .89 || z < .19 || z > .95);
    BG[i] = C(BRICK, (edge ? 2.6 : panel ? 1.9 : 1.6) + L * .2 + (hash(Math.floor(along * 40), Math.floor(z * 6), 3302) - .5) * .25); return true;
  }
  if (side && z > 1.45 && z < 3.9 && Math.abs(bay - .5) < .3) { // an arched mirror: silvered, a soft band of reflected light
    const top = 3.6 + Math.sqrt(Math.max(0, .09 - (bay - .5) ** 2)) * 1.0, rim = Math.abs(bay - .5) > .27 || z < 1.5 || z > top - .05;
    if (z < top) { BG[i] = rim ? GRAND_GILT(L) : C(GRAY, 3.6 + L * .25 + Math.max(0, 1 - Math.abs(fract((z + along) * .4) - .5) * 6) * 1.5); return true; }
  }
  BG[i] = C(STONE, 4.2 + L * .3 - (z > 4.2 ? .5 : 0) + (hash(Math.floor(along * 3), Math.floor(z * 3), 3303) - .5) * .2); return true; // cream plaster, faintly mottled
}
// a rug on the marble: a border, a field with a medallion, fringes at the ends. Flat: you walk over it
function GRAND_RUG(x, y, hl, hw, col, alongX = true) {
  const shade = (i, t, L) => {
    if (HIT.face !== 5) return false;
    const u = alongX ? HIT.u : HIT.v, v = alongX ? HIT.v : HIT.u, eu = hl - Math.abs(u), ev = hw - Math.abs(v), e = Math.min(eu, ev);
    if (eu < .06 && ev > .05) { BG[i] = C(WHITE, 3 + L * .2); return set(i, fract(v * 25) < .5 ? '|' : ' ', C(STONE, 6)), true; } // the fringe
    const med = Math.hypot(u / (hl * .45), v / (hw * .5));
    BG[i] = e < .14 ? C(col === RED ? BLUE : RED, 1.8 + L * .2 + (e < .05 ? .5 : 0)) : med < 1 ? C(YEL, (med < .5 ? 2.8 : 2.2) + L * .2) : C(col, 1.8 + L * .2 + (fract(u * 4 + v * 4) < .1 ? .4 : 0));
    return set(i, ' ', 0), true;
  };
  return { ...BX(x, y, alongX ? hl : hw, alongX ? hw : hl, 0, .012, shade), walk: true };
}
// a standard lamp: a brass column on a round foot, a pleated shade lit from within
function GRAND_FLOOR_LAMP(x, y) {
  return ROOM_MODEL(x, y, (vx, vy) => {
    const brass = (i, t, L) => { BG[i] = C(YEL, 3.5 + L * .3); return set(i, ' ', 0), true; };
    drum(vx, vy, .16, 0, .04, brass);
    drawBox(boxAt(vx, vy, 1, 0, .015, .015, .04, 1.45), brass);
    drum(vx, vy, .22, 1.4, 1.72, (i, t, L) => { if (HIT.face === 5 || HIT.face === 6) return false; BG[i] = C(WARM, 8 + night * 4 - (fract(Math.atan2(HIT.v, HIT.u) * 4) < .15 ? 1.2 : 0)); return set(i, ' ', 0), true; });
  }, [.18, .18, 1.72]);
}
// the concierge's podium by the doors: a lectern of walnut with a brass lamp, the concierge behind it
function GRAND_CONCIERGE(x, y) {
  return [BX(x, y, .38, .3, 0, 1.12, (i, t, L) => { BG[i] = C(BRICK, (HIT.face === 5 ? 2.8 : 2.2 * shadeFace(HIT.face)) + L * .25 - (HIT.w > 1.06 ? -.6 : 0)); return set(i, ' ', 0), true; }),
    ROOM_MODEL(x + .2, y, (vx, vy) => { drawBox(boxAt(vx, vy, 1, 0, .01, .01, 1.12, 1.35), (i, t, L) => { BG[i] = C(YEL, 4); return set(i, ' ', 0), true; });
      drum(vx, vy, .07, 1.3, 1.38, (i, t, L) => { BG[i] = C(GREEN, 4 + night * 3); return set(i, ' ', 0), true; }); }),
    { ...figProp(x, y - .55, figLook({ hair: 'short', top: 'suit', bot: 'pants', col: { top: [GRAY, 2], inner: [WHITE, 12], tie: [YEL, 10], bot: [GRAY, 2] } }), { face: [0, 1], chat: false }), concierge: true }];
}
const GRAND_FURNISH_PROPS = ROOM_DEFS.grandhotel.props, GRAND_FURNISH_WALL = ROOM_DEFS.grandhotel.wall;
ROOM_DEFS.grandhotel.wall = (i, u, uStep, z, d, mx, my, L) => hotelEntranceGlass(i, u, z, mx, my) || grandLobbyWall(i, u, uStep, z, d, mx, my, L);
ROOM_DEFS.grandhotel.props = r => {
  const p = [...GRAND_FURNISH_PROPS(r)], h = r.def.height;
  p.push(GRAND_RUG(12, 13.4, 3.1, .75, RED, false), GRAND_RUG(5.7, 9, 2.4, 1.7, RED), GRAND_RUG(18.3, 9, 2.4, 1.7, BLUE)); // the runner, the sitting areas
  const seats = [...armchair(8.1, 8.2, -1, 0, GREEN), ...armchair(8.1, 9.8, -1, 0, GREEN), ...armchair(15.9, 8.2, 1, 0, BRICK), ...armchair(15.9, 9.8, 1, 0, BRICK)];
  p.push(...seats, GRAND_FLOOR_LAMP(3.4, 11.1), GRAND_FLOOR_LAMP(20.6, 11.1), GRAND_FLOOR_LAMP(9.2, 6.7), GRAND_FLOOR_LAMP(14.8, 11.3));
  for (const [x, y] of [[8.5, 4.2], [15.5, 4.2], [8.5, 13.6], [15.5, 13.6]]) p.push(HOTEL_LOBBY_COLUMN(x, y, h)); // the colonnade
  p.push(HOTEL_LOBBY_CHANDELIER(5.5, 9, h), HOTEL_LOBBY_CHANDELIER(18.5, 9, h));
  p.push(POT_PLANT(9.8, 15.4, 2.7, 91), POT_PLANT(14.2, 15.4, 2.7, 92), POT_PLANT(1.3, 3.2, 2.2, 93), POT_PLANT(22.7, 13.6, 2.4, 94)); // palms by the doors and in the corners
  p.push(...GRAND_CONCIERGE(20.8, 14.6));
  // guests: one reading on each sofa, somebody in an armchair, two waiting at the desk, one checking in with a case
  const sit = (x, y, f, col) => ({ ...figProp(x, y, figAnyone(col), { pose: 'sit', seatZ: .45, face: f }), guest: true });
  p.push(sit(4.3, 8.4, [1, 0], BLUE), sit(19.6, 9.6, [-1, 0], MAG), sit(15.95, 8.2, [1, 0], YEL));
  p.push({ ...standing(4.6, 3.6, RED), face: [.6, -1] }, { ...standing(4.9, 4.5, GREEN), face: [.5, -1] }); // (waiting their turn off to the side: the desk itself free to check in, the view to the staff door's plaque clear)
  if (tod >= 7 && tod < 22) p.push({ ...standing(16.9, 12.6, WHITE), face: [-1, -.3] });
  return p;
};
