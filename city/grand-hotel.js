// ===== the Belle Epoque quarter's landmark hotel: a premium suite by night, a very bad idea after midnight.
const HOTEL_SUITE_RATE = 250;
const HOTEL_HEIST_DOOR = [10.7, 1.45];
const HOTEL_PAINTING = [18.8, 2.6];
const HOTEL_FRAME = [18.8, 1.3];
let grandHotelStolen = false;
let hotelAlarm = null;
const HOTEL_TROLLEY = [12, 12.8];

function hotelGalleryGrid() {
  const walls = {};
  for (const x of [9, 15]) for (let y = 3; y <= 12; y++) if (y < 7 || y > 9) walls[x + ',' + y] = '#';
  return boxRoom(24, 17, walls);
}

ROOM_FOR['GRAND HOTEL'] = 'grandhotel';
ROOM_DEFS.grandhotel = { grid: boxRoom(14, 9), light: 0.95, floor: 'marble', ceil: 'pendant', keeper: [6.5, 2.15],
  wall: (i, u, uStep, z, d, mx, my, L) => {
    if (z < 0.45) { BG[i] = C(BRICK, 2); return set(i, z < 0.12 ? '=' : '#', C(YEL, L * 0.65)), true; }
    if (z > 2.5) return set(i, z > 2.8 ? 'o' : '=', C(YEL, L * 0.7)), true;
    if (mx === 0 && z > 0.75 && z < 2.35 && fract(u * 0.45) < 0.32) return set(i, z > 2.15 ? '^' : '|', C(WHITE, L)), true;
    if (my === 0 && z > 1 && z < 2.4 && fract(u * 0.36) > 0.27 && fract(u * 0.36) < 0.73) { BG[i] = C(BRICK, 1.4); return set(i, z > 1.2 ? ':' : '=', C(YEL, L * 0.7)), true; }
    BG[i] = C(WHITE, 2);
    return set(i, fract(u / 1.4) < 0.03 ? ':' : ' ', C(YEL, L * 0.45)), true;
  },
  props: r => [
    ...counterBox(6.5, 2.75, 1.35, 1.05), standing(6.5, 2.15, YEL),
    BX(3, 1.2, 0.42, 0.42, 0, 0.48, solid(BRICK, { top: '=' })),
    SP(11.9, 1.3, 0.65, 1.5, ART.plant, plantCol),
    SP(3, 1.15, 0.52, 0.72, pad(['+-----+', '|  o  |', '|     |', '+-----+']), (c, row) => C(c === 'o' ? YEL : WHITE, 12)),
    SP(10.7, 1.4, 0.7, 1.65, pad(['  .------.', '  |STAFF |', '  | ONLY |', '  |______|']), (c, row) => C(c === '|' ? YEL : BRICK, 12)),
    BX(3.4, 4.8, 1.1, 0.38, 0, 0.55, solid(BRICK, { top: '=' })),
    BX(10.2, 4.8, 1.1, 0.38, 0, 0.55, solid(BRICK, { top: '=' })),
    ...(tod >= 18 || tod < 2 ? [standing(9, 3.6, MAG), standing(4.5, 3.6, BLUE)] : []),
  ] };

ROOM_DEFS.hotelSuite = { grid: boxRoom(9, 7), light: 1, floor: 'royal', ceil: 'pendant', wall: hotelSuiteWall,
  props: r => [
    BX(2.25, 2.55, 1.15, 0.9, 0, 0.58, (i, t, L) => { const f = HIT.face; BG[i] = C(f === 5 ? WHITE : MAG, 2 + L * 0.25 * shadeFace(f)); return set(i, f === 5 ? '~' : '-', C(f === 5 ? WHITE : MAG, L * 0.6)), true; }, 0, 1),
    ...[1.8, 2.7].map(x => BX(x, 1.8, 0.32, 0.23, 0.58, 0.68, solid(WHITE, { top: '~' }))),
    BX(2.25, 1.32, 0.95, 0.07, 0, 1.35, solid(YEL, { panel: 0.42, trim: 1.27 })),
    BX(4.05, 1.55, 0.42, 0.35, 0, 0.72, solid(BRICK, { top: '=' })),
    BX(4.05, 1.55, 0.1, 0.1, 0.72, 1.02, (i, t, L) => { BG[i] = C(WARM, 7); return set(i, '#', C(YEL, 15)), true; }),
    BX(6.4, 3.7, 0.8, 0.32, 0, 0.55, solid(BLUE, { top: '=' })),
    BX(6.4, 3.4, 0.8, 0.08, 0.4, 1.1, solid(BLUE, { trim: 1.03 })),
    ...[-1, 1].map(s => BX(6.4 + s * 0.75, 3.7, 0.08, 0.32, 0.4, 0.72, solid(YEL))),
    ...tableBox(6.4, 4.7, 0.5, 0.35),
    SP(6.8, 1.2, 0.6, 1.1, ART.plant, plantCol),
  ] };

ROOM_DEFS.grandhotelheist = { grid: hotelGalleryGrid(), light: 0.22, height: 3.8, floor: 'concrete', ceil: 'dark', fx: museumTorchFx,
  wall: (i, u, uStep, z, d, mx, my, L) => {
    if (z > 3.55) return set(i, '=', C(YEL, L)), true;
    if (z < 0.65) { BG[i] = C(BRICK, 0.6); return set(i, z < 0.12 ? '=' : '#', C(GRAY, L * 0.5)), true; }
    const bay = fract(u / 3.2), fz = fract(z / 2.6);
    if (bay > 0.18 && bay < 0.82 && fz > 0.18 && fz < 0.82) { BG[i] = C(GRAY, 1); return set(i, ':', C(GRAY, L * 0.4)), true; }
    return false;
  },
  props: r => {
    const p = [
      hotelPortrait(),
      BX(12, 12.8, 0.7, 0.4, 0, 0.82, solid(YEL, { top: '=', panel: 0.5 })),
      SP(12, 12.8, 0.55, 0.3, pad(['  o  ', ' /_\\ ', '(____)']), (c, row, L) => C(WHITE, Math.max(L, 6)), 0.82),
      SP(7.3, 1.45, 1.4, 1.05, pad(['.------.', '| ~~   |', '|  <>  |', '`------`']), (c, row, L) => C(c === '.' || c === '-' || c === '|' ? YEL : CYAN, Math.max(L, 4)), 1.2),
      SP(13.5, 1.45, 1.4, 1.05, pad(['.------.', '| .--. |', '| `--` |', '`------`']), (c, row, L) => C(c === '.' || c === '-' || c === '|' ? YEL : MAG, Math.max(L, 4)), 1.2),
    ];
    if (r.burgled) HOTEL_GUARD_PATHS.forEach((path, k) => p.push({ ...SP(path[0][0], path[0][1], 0.58, 1.8, ART.guard, (c, row, L) => C(row < 2 ? BLUE : row < 4 ? SKIN : c === '*' ? YEL : BLUE, Math.max(L, 5))), guard: true, dir: 0,
      tick: s => {
        const distracted = r.distractedUntil > T;
        if (distracted) s.patrolDelay = (s.patrolDelay || 0) + Math.max(0, T - (s.lastTick ?? T));
        s.lastTick = T;
        [s.x, s.y, s.dir] = guardAt(path, T + k * 9 - (s.patrolDelay || 0));
        if (distracted) s.dir = Math.atan2(HOTEL_TROLLEY[1] - s.y, HOTEL_TROLLEY[0] - s.x);
      } }));
    return p;
  } };
const HOTEL_GUARD_PATHS = [[[18.5, 3], [20, 8], [18.5, 12], [16.5, 8]], [[4, 4], [7.5, 4], [7.5, 11], [4, 11]]];

function hotelHeistDoorNear() { return mode === 'room' && room.kind === 'grandhotel' && Math.hypot(px - HOTEL_HEIST_DOOR[0], py - HOTEL_HEIST_DOOR[1]) < 1.05; }
function hotelHeistPaintingNear() { return mode === 'room' && room.kind === 'grandhotelheist' && Math.hypot(px - HOTEL_PAINTING[0], py - HOTEL_PAINTING[1]) < 1.35; }
function grandHotelPrompt() {
  if (room.kind === 'grandhotelheist') {
    if (nearExit()) return 'E: back to the hotel lobby';
    if (hotelTrolleyNear()) return room.trolleyUsed ? 'The complimentary cheese has been comprehensively investigated.' : 'E: ring the room-service bell (distract the guards)';
    if (room.alarm) return 'ALARM! Get out of the hotel!';
    if (room.silent) return `Silent alarm: ${Math.max(0, Math.ceil(room.silent - T))}s`;
    if (hotelHeistPaintingNear()) return grandHotelStolen ? 'The empty frame. Someone left the little museum card in it.' : 'E: steal THE DUKE OF BRIE';
    return 'Stay out of the guards\' torch beams (C: crouch)';
  }
  if (room.kind !== 'grandhotel') return '';
  if (hotelHeistDoorNear()) {
    if (grandHotelStolen) return 'The staff door is locked again.';
    return tod >= 23 || tod < 5 ? 'E: slip into the after-hours gallery' : 'The staff door is locked until 11pm.';
  }
  if (nearKeeper()) return checkInOpen(tod) ? `E: book the Royal Suite (${fmt$(HOTEL_SUITE_RATE)} a night)` : '"Check-in is from 6pm."';
  return '';
}
function bookGrandHotelSuite() {
  if (!checkInOpen(tod)) return say('"The Royal Suite checks in from 6pm."', 3);
  if (!pay(HOTEL_SUITE_RATE)) return say(`"The Royal Suite is ${fmt$(HOTEL_SUITE_RATE)} a night." You can't cover it.`, 4);
  const lobby = { word: room.word, neon: room.neon, ret: room.ret, cell: room.cell, line: room.line, grandHotel: true, suite: true };
  say('"The Royal Suite. Please enjoy the view. And please leave the chandeliers."', 4);
  sleep = { t: 0, lobby };
}
function beginGrandHotelHeist() {
  if (grandHotelStolen) return say('The staff door has a fresh lock. The hotel has noticed its missing masterpiece.', 4);
  if (!(tod >= 23 || tod < 5)) return say('The night manager gives the staff door a pointed look. "That gallery is closed until 11."', 4);
  const lobby = { word: room.word, neon: room.neon, ret: room.ret, cell: room.cell, line: room.line, grandHotel: true };
  enterRoom('grandhotelheist', { word: 'PRIVATE GALLERY', ret: room.ret, lobby, burgled: true, spot: 0 }, [12, 14.6, -Math.PI / 2]);
  if (hotelAlarm) room.silent = hotelAlarm.deadline;
  say('You slip into the private gallery. Somewhere, a guard jingles a comically large ring of keys.', 5);
}
function stealHotelPainting() {
  if (grandHotelStolen) return say('The painting is gone. The empty frame is still under guard.'), true;
  if (inv.length >= INV_SIZE) return say('Your bag is full. That frame is not going to fit in a quick slot.'), true;
  startCrime('lockpick', ok => {
    if (ok === 'abort') return;
    if (!ok) { armHotelAlarm(); return say('The frame squeals as it comes loose. A silent alarm starts counting down.', 4); }
    grandHotelStolen = true; carryItem({ id: 'hotelmasterpiece', uses: 0 });
    room.props = room.props.filter(p => p.hotelPainting !== true);
    room.props.push(hotelPortrait());
    armHotelAlarm(); saveGame();
    say('The painting comes free. A tiny red light starts blinking. You have 40 seconds to leave before the hotel calls the police.', 6);
  });
  return true;
}
function grandHotelUse() {
  if (room.kind === 'grandhotel' && hotelHeistDoorNear()) return beginGrandHotelHeist(), true;
  if (room.kind === 'grandhotel' && nearKeeper()) return bookGrandHotelSuite(), true;
  if (room.kind === 'grandhotelheist' && hotelTrolleyNear()) {
    if (room.trolleyUsed) return say('Not a crumb left.'), true;
    room.trolleyUsed = true; room.distractedUntil = T + 12;
    say('DING! "Complimentary cheese?" Both guards stop their rounds and turn towards room service. "Who ordered the cheese?"', 5);
    return true;
  }
  if (room.kind === 'grandhotelheist' && hotelHeistPaintingNear()) return stealHotelPainting();
  return false;
}

function hotelTrolleyNear() { return Math.hypot(px - HOTEL_TROLLEY[0], py - HOTEL_TROLLEY[1]) < 1.35; }
function armHotelAlarm() {
  if (room.alarm || hotelAlarm) return;
  hotelAlarm = { deadline: T + 40, ret: [...room.ret] };
  room.silent = hotelAlarm.deadline;
}
function stepGrandHotel() {
  if (!hotelAlarm || T < hotelAlarm.deadline) return;
  const ret = hotelAlarm.ret;
  hotelAlarm = null;
  if (mode === 'room' && (room.kind === 'grandhotelheist' || room.kind === 'grandhotel')) room.alarm = true;
  addWanted('heist', ret[0], ret[1], true);
  say('The Grand Hotel alarm goes off. The police are heading for the gallery.', 5);
}

function hotelSuiteWall(i, u, uStep, z, d, mx, my, L) {
  if (hotelRoomWall(i, u, uStep, z, d, mx, my, L)) return true;
  BG[i] = C(z < 0.8 ? BRICK : WHITE, z < 0.8 ? 1.5 : 2.2);
  if (z < 0.12 || Math.abs(z - 0.8) < 0.04 || z > 2.7) return set(i, '=', C(YEL, L)), true;
  const panel = fract(u / 1.3);
  let glyph = ' ';
  if (z < 0.8 && panel < 0.04) glyph = '|';
  else if (z >= 0.8 && panel < 0.03) glyph = ':';
  set(i, glyph, C(YEL, L * 0.5));
  return true;
}

function hotelPortrait() {
  const stolen = grandHotelStolen;
  const art = stolen ? ['.========.', '|        |', '|  GONE  |', '|        |', '\'========\''] :
    ['.========.', '|~~.oo.~~|', '|~~(oo)~~|', '|^^/##\\^^|', '\'========\''];
  const color = (c, row, L) => {
    let hue = CYAN;
    if (stolen || '.=|\''.includes(c)) hue = YEL;
    else if (c === 'o') hue = WARM;
    else if (c === '#') hue = BRICK;
    else if (c === '^') hue = GREEN;
    return C(hue, Math.max(L, 5));
  };
  return { ...SP(HOTEL_FRAME[0], HOTEL_FRAME[1], 1.75, 1.25, pad(art), color, 1.2), hotelPainting: !stolen };
}
