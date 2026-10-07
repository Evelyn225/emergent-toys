// ===== the Belle Epoque quarter's landmark hotel: a premium suite by night, a very bad idea after midnight.
const HOTEL_SUITE_RATE = 250;
const HOTEL_HEIST_DOOR = [10.7, 1.45];
const HOTEL_PAINTINGS = [
  { id: 'hotelmasterpiece', title: 'THE DUKE OF BRIE', x: 18.8, w: 1.9, h: 1.65, art: [
    'ggggg..............ggggg',
    'gggg....yyyyyyyy....gggg',
    'ggg....yyrrrrrryy....ggg',
    'gg....yyrrssssrryy....gg',
    'g.....yrrssssssrry.....g',
    '......yrss@ss@ssry......',
    '......yrssssssssry......',
    '.......rssssssssr.......',
    '........ss====ss........',
    '......rrrrssrrrrrr......',
    '....rrrrrryyrrrrrrrr....',
    '...rrrrrrrrrrrrrrrrrr...',
    '..rrrrrrrryyrrrrrrrrrr..',
    '.rrrrrrryyyyyyrrrrrrrrr.',
    'rrrrrrrrrrrrrrrrrrrrrrrr',
  ] },
  { id: 'hotelharbour', title: 'HARBOUR AT FIRST LIGHT', x: 7.3, w: 2.5, h: 1.55, art: [
    '..............................',
    '....................ooo.......',
    '...................ooooo......',
    '....................ooo.......',
    '......ww......................',
    '.....www............ww........',
    '....wwww...........www........',
    '...wwwww..........wwww........',
    '..wwwwww.........wwwww........',
    '~~~~~~|~~~~~~~~~~~~|~~~~~~~~~~~',
    '~~rrrrrrrr~~~~~~rrrrrrrrr~~~~~~',
    '~~~rrrrrr~~~~~~~~rrrrrrr~~~~~~~',
    'cccccc~cccccc~cccccccccc~cccccc',
    'ccc~cccccc~ccccccccc~cccccc~ccc',
    'c~cccccccccccc~ccccccccccccc~cc',
  ] },
  { id: 'hotelstilllife', title: 'MIDNIGHT SUPPER', x: 13.1, w: 1.9, h: 1.6, art: [
    '........................',
    '.....rr.................',
    '.....rr............w....',
    '....rrrr..........www...',
    '....rrrr.....g.....w....',
    '....rrrr....ggg....w....',
    '....rrrr...ggggg...|....',
    '....rrrr...ggggg...|....',
    'yyyyyyyyyyyyyyyyyyyyyyyy',
    'yyoooooyygggyywwwwwwwyyy',
    'yoooooooyggggywwwwwwwyyy',
    'yyoooooyygggyyywwwwwyyyy',
    'yyyyyyyyyyyyyyyyyyyyyyyy',
    'rrrrrrrrrrrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrrrrrrrrrrr',
  ] },
].map(p => ({ ...p, y: 1.045, z: 1.05, art: pad(p.art) }));
const HOTEL_PAINTING = [HOTEL_PAINTINGS[0].x, 2.6];
let grandHotelStolen = {};
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
      ...HOTEL_PAINTINGS.map(hotelPortrait),
      BX(12, 12.8, 0.7, 0.4, 0, 0.82, solid(YEL, { top: '=', panel: 0.5 })),
      SP(12, 12.8, 0.55, 0.3, pad(['  o  ', ' /_\\ ', '(____)']), (c, row, L) => C(WHITE, Math.max(L, 6)), 0.82),
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
function hotelHeistPaintingNear() {
  if (mode !== 'room' || room.kind !== 'grandhotelheist') return null;
  return HOTEL_PAINTINGS.find(p => Math.abs(px - p.x) < p.w / 2 + .2 && py > p.y && py < p.y + 2.2) || null;
}
const hotelGalleryEmpty = () => HOTEL_PAINTINGS.every(p => grandHotelStolen[p.id]);
function grandHotelPrompt() {
  if (room.kind === 'grandhotelheist') {
    if (nearExit()) return 'E: back to the hotel lobby';
    if (hotelTrolleyNear()) return room.trolleyUsed ? 'The complimentary cheese has been comprehensively investigated.' : 'E: ring the room-service bell (distract the guards)';
    if (room.alarm) return 'ALARM! Get out of the hotel!';
    if (room.silent) return `Silent alarm: ${Math.max(0, Math.ceil(room.silent - T))}s`;
    const painting = hotelHeistPaintingNear();
    if (painting) return grandHotelStolen[painting.id] ? `The empty frame: ${painting.title}.` : `E: steal ${painting.title}`;
    return 'Stay out of the guards\' torch beams (C: crouch)';
  }
  if (room.kind !== 'grandhotel') return '';
  if (hotelHeistDoorNear()) {
    if (hotelGalleryEmpty()) return 'The staff door is locked again.';
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
  if (hotelGalleryEmpty()) return say('The staff door has a fresh lock. The hotel has noticed its missing paintings.', 4);
  if (!(tod >= 23 || tod < 5)) return say('The night manager gives the staff door a pointed look. "That gallery is closed until 11."', 4);
  const lobby = { word: room.word, neon: room.neon, ret: room.ret, cell: room.cell, line: room.line, grandHotel: true };
  enterRoom('grandhotelheist', { word: 'PRIVATE GALLERY', ret: room.ret, lobby, burgled: true, spot: 0 }, [12, 14.6, -Math.PI / 2]);
  if (hotelAlarm) room.silent = hotelAlarm.deadline;
  say('You slip into the private gallery. Somewhere, a guard jingles a comically large ring of keys.', 5);
}
function stealHotelPainting(painting) {
  if (grandHotelStolen[painting.id]) return say('The painting is gone. The empty frame is still under guard.'), true;
  if (inv.length >= INV_SIZE) return say('Your bag is full. That frame is not going to fit in a quick slot.'), true;
  const gallery = room;
  startCrime('lockpick', ok => {
    if (ok === 'abort' || room !== gallery || mode !== 'room') return;
    if (!ok) { armHotelAlarm(); return say('The frame squeals as it comes loose. A silent alarm starts counting down.', 4); }
    grandHotelStolen[painting.id] = true; carryItem({ id: painting.id, uses: 0 });
    room.props = room.props.filter(p => p.hotelPainting !== painting.id);
    room.props.push(hotelPortrait(painting));
    armHotelAlarm(); saveGame();
    say(`${painting.title} comes free. ${room.alarm ? 'The alarm is already ringing: get out!' : `Leave the hotel within ${Math.max(0, Math.ceil(room.silent - T))} seconds to beat the silent alarm.`}`, 6);
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
  const painting = hotelHeistPaintingNear();
  if (painting) return stealHotelPainting(painting);
  return false;
}

function hotelTrolleyNear() { return Math.hypot(px - HOTEL_TROLLEY[0], py - HOTEL_TROLLEY[1]) < 1.35; }
function armHotelAlarm() {
  if (room.alarm || hotelAlarm) return;
  hotelAlarm = { deadline: T + 40, ret: [...room.ret] };
  room.silent = hotelAlarm.deadline;
}
function stepGrandHotel() {
  if (!hotelAlarm) return;
  const lobby = room?.kind === 'hotelroom' ? room.lobby : room;
  const inside = mode === 'room' && (room.kind === 'grandhotel' || room.kind === 'grandhotelheist' || lobby?.grandHotel) &&
    lobby?.ret?.[0] === hotelAlarm.ret[0] && lobby?.ret?.[1] === hotelAlarm.ret[1];
  if (!inside) { hotelAlarm = null; return; }
  if (T < hotelAlarm.deadline) return;
  const ret = hotelAlarm.ret;
  hotelAlarm = null;
  room.alarm = true;
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

const HOTEL_PAINT_COLORS = { '.': BLUE, g: GREEN, y: YEL, r: BRICK, s: SKIN, '@': GRAY, '=': WHITE,
  o: ORANGE, w: WHITE, '|': BRICK, '~': CYAN, c: BLUE };
function hotelPaintingPixel(p, u, v) {
  const row = clamp(Math.floor(v * p.art.length), 0, p.art.length - 1);
  const col = clamp(Math.floor(u * p.art[0].length), 0, p.art[0].length - 1);
  const code = p.art[row][col];
  return [code === '.' ? ' ' : code === '@' ? 'o' : '=|~'.includes(code) ? code : ':', HOTEL_PAINT_COLORS[code] ?? BLUE];
}
function hotelPortrait(p) {
  const stolen = !!grandHotelStolen[p.id], border = .085, hl = p.w / 2;
  const frame = BX(p.x, p.y, hl, .035, p.z, p.z + p.h, (i, t, L) => {
    if (HIT.face !== 3 || Math.abs(HIT.u) > hl - border || HIT.w < p.z + border || HIT.w > p.z + p.h - border) {
      BG[i] = C(YEL, 1 + L * .25 * shadeFace(HIT.face));
      return set(i, HIT.face === 5 || Math.abs(HIT.u) < hl - border ? '=' : '|', C(YEL, Math.max(4, L))), true;
    }
    if (stolen) {
      BG[i] = C(GRAY, .8);
      return set(i, Math.abs(HIT.u) < .03 && HIT.w > p.z + p.h * .75 ? 'o' : ' ', C(YEL, Math.max(3, L))), true;
    }
    const [ch, hue] = hotelPaintingPixel(p, (HIT.u + hl - border) / (p.w - border * 2), (p.z + p.h - border - HIT.w) / (p.h - border * 2));
    BG[i] = C(hue, .8 + L * .2);
    return set(i, ch, C(hue, Math.max(4, L))), true;
  });
  return { ...frame, hotelPainting: p.id, stolen };
}
