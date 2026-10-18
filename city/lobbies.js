// ===== the way up to the roof, by the kind of building it is (actions.js asks lobbyKind which room you walk into):
// - a walk-up (the Brownstones, Chinatown, the Shotengai): a narrow hall, the mailboxes, a bike, and a real flight of
//   stairs you climb to the roof door on the landing
// - a tower (Downtown, the taller Midtown blocks): a stone lobby, the security desk and its guard, a bank of lifts
// - a freight lobby (the Docks, the Yards): bare brick, a concrete floor, a freight lift behind its gate
// - the Belle Époque Quarter: carpet, panelling, a gilt mirror, and a brass cage lift
// - anywhere else: the plain lobby (apts, rooms.js)
// Each has ex (the way up, along the back wall) and, where it isn't a lift, upPrompt; liftWall draws the way up (the
// 'E' cells on the back wall: u runs along x there).
const LOBBY_KINDS = new Set(['apts', 'walkup', 'tower', 'freightlobby', 'bellelobby']);
function lobbyKind(mx, my) {
  const d = districtAt(mx + 0.5, my + 0.5), h = map[idx(mx, my)];
  if (d === 'belle') return 'bellelobby';
  if (d === 'brownstones' || d === 'chinatown' || d === 'shotengai') return 'walkup';
  if (d === 'industrial' || d === 'yards' || d === 'waterfront') return 'freightlobby';
  if (d === 'downtown' || d === 'midtown' && h >= 4) return 'tower';
  return 'apts';
}
// a door in a wall at u0 (its middle), w wide, from z0 up, h tall: the frame, the panels, the knob. Or false
function wallDoor(i, u, z, u0, w, z0, h, col, L) {
  const du = u - u0;
  if (Math.abs(du) > w / 2 + 0.06 || z < z0 || z > z0 + h + 0.06) return false;
  if (Math.abs(du) > w / 2 || z > z0 + h) { BG[i] = C(WHITE, 2.4 + L * 0.1); return set(i, ' ', 0), true; } // the frame
  BG[i] = C(col, 1.4 + L * 0.2);
  if (Math.abs(du - w * 0.36) < 0.04 && Math.abs(z - z0 - 1.0) < 0.04) return set(i, 'o', C(YEL, 13)), true; // the knob
  const panel = Math.abs(fract((z - z0) / (h / 2)) - 0.5) > 0.42 || Math.abs(Math.abs(du) - w * 0.22) < 0.02;
  return set(i, panel ? '|' : ' ', C(col, L * 0.5)), true;
}

// ---- the walk-up: 5m wide, the stairs up the right side to a landing at the back, the roof door on it
const WALKUP_STAIRS = { x0: 3.7, x1: 6, y0: 2.6, y1: 7.6, rise: 1.0 };
const WALKUP_RAIL = 3.62; // (the banister down the open side of the stairs and the landing)
// the banister: a handrail on posts following the stairs up, and round the landing to the back wall; it stops you
// stepping off (only its foot is open, where the stairs meet the floor)
const BANISTER = ROOM_MODEL(WALKUP_RAIL, (1 + WALKUP_STAIRS.y1 - 0.8) / 2, (vx, vy) => {
  const s = WALKUP_STAIRS, y0 = (1 + s.y1 - 0.8) / 2, at = y => vy + y - y0, step = y => s.rise * clamp((s.y1 - y) / (s.y1 - s.y0), 0, 1);
  const wood = (i, t, L) => { BG[i] = C(BRICK, 1.6 + L * 0.3); return set(i, '=', C(WARM, L * 0.6)), true; };
  drawRod(vx, at(s.y1 - 0.8), step(s.y1 - 0.8) + 0.95, vx, at(s.y0), s.rise + 0.95, 0.03, wood); // the handrail, sloping up
  drawRod(vx, at(s.y0), s.rise + 0.95, vx, at(1.05), s.rise + 0.95, 0.03, wood); // and level round the landing
  for (let y = s.y1 - 0.8; y > 1.1; y -= 0.25) rod(vx, at(y), step(y), vx, at(y), step(y) + 0.95, 0.012, WHITE, 1.2); // the balusters
  drawRod(vx, at(s.y1 - 0.8), 0, vx, at(s.y1 - 0.8), step(s.y1 - 0.8) + 1.05, 0.05, wood); // the newel post at the foot
}, [0.06, (WALKUP_STAIRS.y1 - 0.8 - 1) / 2, 2.4]);
const walkupTint = r => r.district === 'chinatown' || r.district === 'shotengai' ? RED : GREEN;
ROOM_DEFS.walkup = { grid: boxRoom(7, 10, { '4,0': 'E', '5,0': 'E' }), light: 0.6, floor: 'checker', ceil: 'pendant', height: 3.4, stairs: WALKUP_STAIRS, ex: 4.85, exReach: 1.2,
  upPrompt: 'E: up the stairs to the roof', upSay: 'You climb flight after flight, and shoulder open the roof door.',
  liftWall: (i, u, uStep, z, d, mx, my, L) => { // the roof door, up on the landing, and the sign over it
    const s = WALKUP_STAIRS;
    if (wallText(i, u, uStep, z, d, 'ROOF ^', 4.85, s.rise + 2.2, 0.16, 0.22, C(GREEN, 15))) return;
    if (wallDoor(i, u, z, 4.85, 0.9, s.rise, 2.0, GRAY, L)) return;
    return walkupWall(i, u, uStep, z, d, mx, my, L) || set(i, ' ', 0);
  },
  wall: (i, u, uStep, z, d, mx, my, L) => walkupWall(i, u, uStep, z, d, mx, my, L),
  props: r => [BANISTER, ...stairSteps(WALKUP_STAIRS),
    BX(1.3, 5.2, 0.5, 0.06, 0.2, 0.75, (i, t, L) => { BG[i] = C(WHITE, 1.8 + L * 0.2); return set(i, fract(HIT.u * 9) < 0.35 ? '|' : ' ', C(GRAY, L * 0.6)), true; }, 0, 1), // the radiator
    ROOM_MODEL(1.25, 7.4, (vx, vy) => { // a bike against the wall
      for (const e of [-0.5, 0.5]) drawBox(boxAt(vx, vy + e, 0, 1, 0.33, 0.02, 0, 0.66), (i, t, L) => Math.hypot(HIT.u, HIT.w - 0.33) > 0.3 && Math.hypot(HIT.u, HIT.w - 0.33) < 0.34 ? (BG[i] = C(GRAY, 1), set(i, 'o', C(GRAY, 6)), true) : false);
      rod(vx, vy - 0.5, 0.33, vx, vy, 0.62, 0.015, walkupTint(r), 1.2); rod(vx, vy, 0.62, vx, vy + 0.5, 0.33, 0.015, walkupTint(r), 1.2);
      rod(vx, vy - 0.5, 0.33, vx, vy - 0.42, 0.95, 0.015, GRAY, 1.2); rod(vx, vy + 0.08, 0.62, vx, vy + 0.12, 0.88, 0.015, GRAY, 1.2);
      rod(vx - 0.2, vy - 0.42, 0.95, vx + 0.2, vy - 0.42, 0.95, 0.015, GRAY, 1.4); // (the handlebars)
    }, [0.12, 0.85, 1]),
    BX(3, 8.6, 0.45, 0.3, 0, 0.02, (i, t, L) => { BG[i] = C(BRICK, 1.2); return set(i, HIT.face === 5 && Math.abs(HIT.v) < 0.12 ? '~' : ' ', C(YEL, L * 0.6)), true; }), // the doormat
    ...(walkupTint(r) === RED ? [ROOM_MODEL(2.3, 3.2, (vx, vy) => { // a paper lantern
      drum(vx, vy, 0.2, 2.45, 2.85, (i, t, L) => { BG[i] = C(RED, 5 + 4 * Math.max(night, 0.4)); return set(i, fract(HIT.w * 8) < 0.2 ? '-' : ' ', C(YEL, 10)), true; });
      rod(vx, vy, 2.85, vx, vy, 3.4, 0.008, GRAY, 0.6);
    })] : []),
    ...(chance(0.5) ? [{ ...standing(1.9, 3.4, shirt()), face: [-1, 0] }] : [])], // a neighbour at the mailboxes
};
function walkupWall(i, u, uStep, z, d, mx, my, L) {
  const tint = walkupTint(room);
  if (mx === 0 && u > 2.4 && u < 4.4 && z > 1.0 && z < 1.75) { // the mailboxes, a row of little brass doors
    BG[i] = C(tint === RED ? RED : BRICK, 1.6 + L * 0.2);
    return set(i, fract(u / 0.4) < 0.1 || fract(z / 0.25) < 0.12 ? '+' : fract(u / 0.4) > 0.75 && fract(z / 0.25) > 0.5 ? '-' : ' ', C(YEL, L * 0.8)), true;
  }
  if (mx === 0 && wallDoor(i, u, z, 6.2, 0.9, 0, 2.05, BRICK, L)) return true; // 1A
  if (mx === 0 && wallText(i, u, uStep, z, d, '1A', 6.2, 2.25, 0.14, 0.18, C(YEL, 13))) return true;
  if (z < 1.0) { BG[i] = C(tint, 1 + L * 0.15); return set(i, z > 0.94 ? '=' : fract(u * 2) < 0.04 ? '|' : ' ', C(tint, L * 0.6)), true; } // the dado: tongue and groove
  BG[i] = C(STONE, 1.3 + L * 0.12); return set(i, ' ', 0), true; // painted plaster, a bit tired
}

// ---- the tower: a stone lobby, three lifts across the back, the security desk in front of them
const TOWER_LIFTS = [4.5, 7, 9.5];
ROOM_DEFS.tower = { grid: boxRoom(14, 10, Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map(x => [x + ',0', 'E']))), light: 1.1, floor: 'marble', ceil: 'strip', height: 3.6, ex: 7, exReach: 3.4,
  liftWall: (i, u, uStep, z, d, mx, my, L) => {
    if (z > 2.78 && z < 3.12 && wallText(i, u, uStep, z, d, 'ALL FLOORS  ROOF ^', 7, 2.95, 0.17, 0.3, C(ORANGE, 14))) return;
    const k = TOWER_LIFTS.findIndex(c => Math.abs(u - c) < 0.75);
    if (k < 0) return towerWall(i, u, z, L);
    const c = TOWER_LIFTS[k], du = u - c, floorNo = 3 + ((Math.floor(T / 2.5) + k * 5) % 30); // (each lift somewhere in the building)
    if (z > 2.35 && z < 2.6) return wallText(i, u, uStep, z, d, String(floorNo).padStart(2, ' ') + (k & 1 ? 'v' : '^'), c, 2.47, 0.12, 0.2, C(ORANGE, 15), C(GRAY, 0.6)) || (BG[i] = C(GRAY, 0.6), set(i, ' ', 0));
    if (Math.abs(du) > 0.6 || z > 2.2) { BG[i] = C(GRAY, 3.2 + L * 0.2); return set(i, ' ', 0); } // the steel frame
    BG[i] = C(GRAY, 2.2 + L * 0.25 + (Math.abs(du) < 0.03 ? -1 : 0));
    return set(i, Math.abs(du) < 0.03 ? '|' : fract(z * 2) < 0.05 ? '-' : ' ', C(WHITE, L * 0.4));
  },
  wall: (i, u, uStep, z, d, mx, my, L) => towerWall(i, u, z, L),
  props: r => {
    const guard = figProp(1.75, 5, figGuardLook(r.cell ? r.cell[0] * 7 + r.cell[1] : 3), { face: [1, 0] }); // (off to the side, watching the way in)
    return [BX(2.45, 5, 1.4, 0.4, 0, 1.1, solid(GRAY, { panel: 0.9, trim: 1.04, top: '=', bright: 1.3 }), 0, 1), // the desk, in polished stone
      BX(2.35, 4.4, 0.15, 0.25, 1.1, 1.35, (i, t, L) => { BG[i] = HIT.face === 1 ? C(CYAN, 2.5) : C(GRAY, 1.2); return set(i, HIT.face === 1 && fract(HIT.w * 20) < 0.3 ? '-' : ' ', C(GREEN, 9)), true; }), // the camera monitor
      guard, POT_PLANT(1.6, 1.6, 1.8), POT_PLANT(12.4, 1.6, 1.8), POT_PLANT(1.6, 8.2, 1.5), POT_PLANT(12.4, 8.2, 1.5),
      BENCHP(12.6, 5, -1, 0), BX(12.75, 5, 0.9, 0.25, 0, 0.45, solid(BRICK, { top: '=' }), 0, 1), // a bench along the far wall
      ...(chance(0.7) ? [{ ...standing(9.5, 2.6, shirt()), face: [0, -1] }] : []), ...(chance(0.5) ? [{ ...standing(4.4, 2.8, shirt()), face: [0, -1] }] : [])]; // waiting for a lift
  } };
function towerWall(i, u, z, L) { // big stone panels with a bronze reveal between them
  if (z < 0.12) { BG[i] = C(GRAY, 1 + L * 0.1); return set(i, '_', C(GRAY, L * 0.4)), true; }
  BG[i] = C(STONE, 2 + L * 0.18);
  return set(i, fract(u / 1.5) < 0.025 || fract(z / 1.2) < 0.03 ? '|' : ' ', C(ORANGE, L * 0.5)), true;
}

// ---- the freight lobby: an old warehouse's way in: brick, concrete, pipes, and the freight lift behind its gate
ROOM_DEFS.freightlobby = { grid: boxRoom(10, 9, { '3,0': 'E', '4,0': 'E', '5,0': 'E', '6,0': 'E' }), light: 0.8, floor: 'concrete', ceil: 'strip', height: 3.8, ex: 5, exReach: 1.6,
  upPrompt: 'E: freight lift to the roof', upSay: 'The gate rattles shut and the old lift grinds its way up.',
  liftWall: (i, u, uStep, z, d, mx, my, L) => {
    const du = u - 5;
    if (z > 2.65 && z < 3.0 && wallText(i, u, uStep, z, d, 'FREIGHT  ROOF ^', 5, 2.82, 0.13, 0.22, C(YEL, 15), C(GRAY, 0.5))) return;
    if (Math.abs(du) > 1.6 || z > 2.6) return loftWall(i, u, z, L) || set(i, ' ', 0);
    if (Math.abs(du) > 1.35 || z > 2.4) { const s = (Math.floor((u + z) * 5) & 1); BG[i] = C(s ? YEL : GRAY, s ? 6 : 0.6); return set(i, ' ', 0); } // hazard stripes round it
    BG[i] = C(GRAY, 0.4); // the dark shaft, through the gate's slats
    return set(i, fract(du * 4) < 0.18 ? '|' : fract(z * 2.5) < 0.1 ? '=' : ' ', C(GRAY, L * 1.1));
  },
  wall: (i, u, uStep, z, d, mx, my, L) => loftWall(i, u, z, L),
  props: r => [...cartons(8, 2.2, 3, 4), ...cartons(8.1, 3.3, 2, 5),
    BX(1.3, 6.5, 0.5, 0.4, 0, 0.14, solid(BRICK, { panel: 0.25, top: '=' })), // a pallet
    ROOM_MODEL(1.25, 4, (vx, vy) => { rod(vx, vy, 0, vx, vy, 0.55, 0.09, RED, 1.4); rod(vx, vy, 0.55, vx, vy + 0.06, 0.66, 0.02, GRAY, 1); }, [0.1, 0.1, 0.6]), // a fire extinguisher
    ...(chance(0.5) ? [{ ...standing(3.2, 3.5, shirt()), face: [1, 0] }] : [])] };
function loftWall(i, u, z, L) {
  if (z > 3.3 && z < 3.45) { BG[i] = C(GRAY, 1.2); return set(i, '=', C(GRAY, L)), true; } // a pipe along the top
  const row = Math.floor(z / 0.075), brick = fract(u / 0.22 + (row & 1) * 0.5) < 0.1 || fract(z / 0.075) < 0.18;
  BG[i] = C(BRICK, 1.6 + L * 0.2 + hash(Math.floor(u / 0.22), row, 61) * 0.6);
  return set(i, brick ? '.' : ' ', C(GRAY, L * 0.4)), true;
}

// ---- the Belle Époque lobby: panelling, carpet, a gilt mirror, and the lift in its brass cage
ROOM_DEFS.bellelobby = { grid: boxRoom(9, 9, { '3,0': 'E', '4,0': 'E', '5,0': 'E' }), light: 0.75, floor: 'royal', ceil: 'chandelier', height: 3.6, ex: 4.5, exReach: 1.3,
  liftWall: (i, u, uStep, z, d, mx, my, L) => {
    const du = u - 4.5;
    if (z > 2.55 && z < 2.85 && wallText(i, u, uStep, z, d, 'ASCENSEUR', 4.5, 2.7, 0.13, 0.2, C(YEL, 15), C(BRICK, 1))) return;
    if (Math.abs(du) > 0.85 || z > 2.5) return belleWall(i, u, z, L) || set(i, ' ', 0);
    if (Math.abs(du) > 0.75 || z > 2.4) { BG[i] = C(YEL, 4 + L * 0.3); return set(i, '=', C(ORANGE, L)); } // the brass frame
    BG[i] = C(BRICK, 0.6 + L * 0.1); // the cage: a brass lattice, the car dark behind it
    const a1 = fract((du + z) * 3.2), a2 = fract((du - z) * 3.2);
    return set(i, a1 < 0.1 && a2 < 0.1 ? '+' : a1 < 0.1 ? '/' : a2 < 0.1 ? '\\' : ' ', C(YEL, L * 1.2));
  },
  wall: (i, u, uStep, z, d, mx, my, L) => {
    if (mx === 0 && Math.abs(u - 4.5) < 0.7 && z > 0.9 && z < 2.4) { // the gilt mirror
      if (Math.abs(u - 4.5) > 0.62 || z < 0.98 || z > 2.32) { BG[i] = C(YEL, 4 + L * 0.3); return set(i, '*', C(ORANGE, L)), true; }
      BG[i] = C(CYAN, 1.4); return set(i, fract((u + z) * 2.5) < 0.05 ? '/' : ' ', C(WHITE, 10)), true;
    }
    return belleWall(i, u, z, L);
  },
  props: r => [POT_PLANT(1.5, 1.5, 1.9), POT_PLANT(7.5, 1.5, 1.9),
    BX(7.3, 4.6, 0.6, 0.25, 0, 0.8, solid(BRICK, { panel: 0.4, top: '=' }), 0, 1), BOUQUET(7.3, 4.6, MAG), // a console table, flowers on it
    BENCHP(1.4, 6.4, 1, 0), BX(1.3, 6.4, 0.75, 0.28, 0, 0.45, solid(RED, { top: '#' }), 0, 1), // a velvet banquette
    ...(chance(0.6) ? [{ ...standing(6.2, 3.2, shirt()), face: [-1, 0] }] : [])] };
function belleWall(i, u, z, L) { // dark wood panelling below, cream and gold stripes above, a moulded cornice
  if (z > 3.3) { BG[i] = C(WHITE, 2.8 + L * 0.15); return set(i, fract(u * 5) < 0.3 ? '^' : ' ', C(YEL, L * 0.6)), true; }
  if (z < 1.05) { BG[i] = C(BRICK, 1 + L * 0.18); return set(i, z > 0.98 ? '=' : Math.abs(fract(u / 0.8) - 0.5) > 0.42 || Math.abs(z - 0.52) > 0.4 ? '|' : ' ', C(ORANGE, L * 0.6)), true; }
  BG[i] = C(fract(u / 0.3) < 0.5 ? YEL : STONE, (fract(u / 0.3) < 0.5 ? 3.2 : 3) + L * 0.15); // (cream and gold)
  return set(i, fract(u / 0.3) < 0.04 ? '|' : ' ', C(ORANGE, L * 0.5)), true;
}
