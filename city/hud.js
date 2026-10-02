function dash() {
  const c = me;
  FOGS.fill(0, (rows - 4) * cols); FOGB.fill(0, (rows - 4) * cols); // the dashboard is never in the fog
  if (!chaseOn) { // hood and dashboard only from the driver's seat
    for (let r = rows - 4; r < rows; r++) for (let x = 0; x < cols; x++) {
      const i = r * cols + x;
      set(i, r === rows - 4 ? '_' : ' ', C(c.body, 6)); BG[i] = r === rows - 4 ? NONE : C(GRAY, 1);
    }
    if (mode === 'drive') ['.--------.', '|---()---|', "'--------'"].forEach((l, k) => putText(rows - 3 + k, (cols - 10) >> 1, l, C(GRAY, 10)));
  }
  if (mode === 'drive' && job) { // on a taxi shift
    putText(rows - 3, 3, `TAXI SHIFT   trips ${job.trips}   earned ${fmt$(job.earned)}${job.ride ? `   meter ${fmt$(taxiFare(job.ride.odo))}` : ''}`, C(TAXI, 15));
    putText(rows - 2, 3, `${Math.abs(c.v * 36) | 0} km/h   ${jobLine()}`, C(WHITE, 13));
  } else if (mode === 'drive') {
    putText(rows - 2, 3, `${Math.abs(c.v * 36) | 0} km/h`, C(CYAN, 15)); // 1 unit/s = 10 m/s
  } else {
    putText(rows - 3, 3, `TAXI   fare ${fmt$(taxiFare(c.fare))}   you have ${fmt$(money)}`, C(TAXI, 15));
    putText(rows - 2, 3, c.dest ? `to: ${c.destName}` : 'Where to?   1: nearest park   2: across town   3: anywhere   4: the waterfront   5: subway', C(WHITE, 12));
  }
}

// riding the el: the carriage round you - roof, floor and window posts
function elFrame() {
  const posts = Math.max(3, cols / 45 | 0), bodyCol = C(GRAY, 4);
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
    const i = r * cols + x, top = r < 3, bot = r >= rows - 4, post = Math.abs((x + cols / posts / 2) % (cols / posts) - cols / posts / 2) < 1.5;
    if (!top && !bot && !post) continue;
    FOGS[i] = FOGB[i] = 0; BG[i] = C(GRAY, top || bot ? 1 : 2);
    set(i, top ? (r === 2 ? '=' : ' ') : bot ? (r === rows - 4 ? '_' : (x & 3) ? ' ' : '.') : '|', top && r === 2 || bot ? bodyCol : C(GRAY, 6));
  }
}
const nearestCar = r => {
  let best = null, bd = r;
  for (const c of cars) { if (c.player || c.rider || c.ev) continue; const d = Math.hypot(rel(c.x - px), rel(c.y - py)); if (d < bd) { bd = d; best = c; } } // (not the ambulance)
  return best;
};
// someone right in front of you, close enough to talk to
const nearPerson = () => {
  if (mode !== 'walk') return null;
  let best = null, bd = 0.45;
  for (const p of people) {
    if (p.hidden) continue;
    const ex = rel(p.x - px), ey = rel(p.y - py), d = Math.hypot(ex, ey);
    if (d < bd && (ex * Math.cos(a) + ey * Math.sin(a)) / d > 0.85) { bd = d; best = p; }
  }
  return best;
};
const nearVendor = () => vendors.find(v => Math.hypot(rel(v.x - px), rel(v.y - py)) < 0.35);
// a vending machine you're facing, within arm's reach (3m of its middle)
const nearMachine = () => mode === 'walk' ? machinesB[bi(Math.floor(px / 8), Math.floor(py / 8))].find(m => {
  const ex = m.x - px, ey = m.y - py, d = Math.hypot(ex, ey);
  return d < 0.3 && (d < 0.12 || (ex * Math.cos(a) + ey * Math.sin(a)) / d > 0.5);
}) : null;
const nearStation = () => stations.find(s => Math.hypot(rel(s.x - px), rel(s.y - py)) < 0.35);
const nearElevator = () => room.def.ex && Math.abs(px - room.def.ex) < 1.3 && py < 2.4;
const canBoard = () => room.kind === 'station' && trainStopped(room) && py > ST_TRACK - 1.8 && Math.abs(px - 23) < 13;
// near a way out: a door, or the foot of the station stairs
const nearExit = () => {
  const s = room.def.stairs;
  if (s && px > s.x0 - 0.5 && px < s.x1 + 0.5 && py < s.y1 + 1.2) return true;
  for (let y = Math.floor(py - 1.4); y <= py + 1.4; y++) for (let x = Math.floor(px - 1.4); x <= px + 1.4; x++)
    if (roomAt(x, y) === 'D' && Math.hypot(x + 0.5 - px, y + 0.5 - py) < 1.6) return true;
  return false;
};
const nearKeeper = () => { const k = room.def.keeper; return k && Math.hypot(px - k[0], py - k[1]) < 2; };
function promptText() {
  if (mode === 'room') {
    if (room.kind === 'train') return room.dest == null
      ? 'Next stop?   ' + room.opts.map((s, n) => `${n + 1}: ${stations[s].name}`).join('   ')
      : room.rideT > 0 ? `Next stop: ${stations[room.dest].name}` : '';
    const drIn = droppedHere();
    if (drIn) return `E: pick up the ${ITEMS[drIn.id].name}`;
    if (nearElevator()) return 'E: elevator to the roof';
    if (canBoard()) return 'E: board the train';
    if (room.kind === 'arcade') {
      const cab = nearCabinet();
      if (cab) return cab.busy ? 'Somebody\'s playing this one' : `E: play ${GAMES[cab.game]().title} (${fmt$(CREDIT)} a credit)`;
      if (nearKeeper()) return `E: prize counter (${tickets} tickets)`;
    }
    if (room.kind === 'storage' && nearKeeper()) return `E: your storage unit (${stored.length} stored)`;
    if (room.kind === 'hotel' && nearKeeper()) return checkInOpen(tod) ? `E: book a room for the night (${fmt$(ROOM_RATE(room.word))})` : '"Check-in is from 6pm."';
    if (nearKeeper() && stockFor(room.kind, room.word).length) return `"${room.line}"   E: shop`;
    if (nearKeeper()) return `"${room.line}"`;
    if (nearExit()) return room.kind === 'station' ? 'E: up the stairs to the street' : 'E: leave';
    return '';
  }
  if (mode === 'roof') { const dr = droppedHere(); return dr ? `E: pick up the ${ITEMS[dr.id].name}` : 'E: take the stairs down'; }
  if (mode === 'el') { const t = elRiding(); return t.stopped ? `E: get off at ${EL_STATIONS[t.station].name}` : `Next stop: ${EL_STATIONS[t.next].name}`; }
  if (mode === 'elplat') {
    if (elHere()) return 'E: board the train';
    const next = elTrains(T).filter(t => t.tr === plat.tr && EL_STATIONS[t.next] === plat.s && !t.stopped).map(t => t.left);
    return `E: stairs down${next.length ? `   (next train in ${Math.ceil(Math.min(...next))}s)` : ''}`;
  }
  if (mode === 'drive') return 'W/S gas & brake | A/D steer | V: camera | E: get out (when slow)';
  if (mode === 'taxi') return 'mouse: look around | V: camera | E: get out';
  const c = nearestCar(0.5);
  const dr = droppedHere();
  if (dr) return `E: pick up the ${ITEMS[dr.id].name}`;
  const vm = nearMachine();
  if (vm) return `E: ${VENDING[vm.kind].title.toLowerCase()}`;
  if (c && c.v < 0.6 && !c.ev) return c.body === TAXI ? 'E: get in the taxi   J: drive it (taxi shift)' : 'E: take this car';
  const who = nearPerson();
  if (who) return task && task.who === who ? (task.kind === 'fetch' && task.have ? 'E: hand it over' : 'E: talk') : 'E: talk';
  if (nearDog()) return 'E: call the dog';
  const el = nearElStairs();
  if (el) return `E: up to the ${el.s.name} el, ${el.tr ? 'eastbound' : 'westbound'} (${fmt$(SUBWAY_FARE)})`;
  const st = nearStation();
  if (st) return `E: go down to ${st.name} station (${fmt$(SUBWAY_FARE)})`;
  if (ball && Math.hypot(rel(ball.x - px), rel(ball.y - py)) < 0.3) return 'E: pick up the ball';
  const ven = nearVendor();
  if (ven) return `E: buy from the ${ven.type.name.toLowerCase()} cart`;
  if (lookHit && lookHit.d < 0.35 && SHOP[idx(lookHit.mx, lookHit.my)]) {
    const sh = SHOP[idx(lookHit.mx, lookHit.my)];
    if (sh.base) return `${BASE_KINDS[sh.base].title}: staff only`;
    if (sh.kind === SHOP_SHUT) return 'Closed.';
    if (!openAt(sh, tod)) return `${sh.signed ? sh.word : 'Shop'}: closed, opens at ${sh.hours[0]}:00`;
    if (sh.kind === SHOP_APTS) return 'E: enter the building (roof access)';
    return `E: enter ${sh.signed ? sh.word : 'shop'}${ROOM_FOR[sh.word] === 'hotel' ? ' (roof access)' : ''}`;
  }
  if (cars.some(c => c.body === TAXI && !c.rider && !c.player && !c.hail && Math.hypot(rel(c.x - px), rel(c.y - py)) < 2.5)) return 'H: hail the taxi';
  return '';
}
// north-up minimap, top right: buildings shaded by height, parks, water, stations, cars, people, you, taxi destination
let showMap = false;
// the minimap (M): solid tiles so the street grid reads at a glance, in an ASCII frame with character markers to match
// the rest of the HUD. MAP_R cells each side of you; a tile is two characters wide and one tall, so it's square.
const MAP_R = 14;
const MAP_COL = { park: '#1f5a2a', sea: '#1d3f7a', construction: '#4a3a28', yard: '#3a3428', waterfront: '#4a4636' };
function mapTile(mx, my) {
  const k = idx(mx, my), h = map[k], wx = mx + 0.5, wy = my + 0.5;
  if (h) { const v = Math.min(h, 12) * 12; return `rgb(${60 + v},${60 + v},${75 + v})`; } // taller is lighter
  if (Math.abs(rel(wx - FOOTBRIDGE.x)) < 0.6 && onFootbridge(FOOTBRIDGE.x, wy) || onPier(wx, wy)) return '#5a4030'; // (the bridge is thinner than a tile)
  if (onIsland(wx, wy)) return '#2a5a30';
  if (ROAD[k]) return underEl(wy) ? '#3a2420' : '#16161c';
  if (seaAt(wx, wy)) return MAP_COL.sea;
  return MAP_COL[blockKind(Math.floor(mod(mx, N) / 8), Math.floor(mod(my, N) / 8))] || '#2a2a30';
}
function minimap() {
  if (!showMap || mode === 'room') return;
  const fs = Math.max(10, Math.round(cv.height / 66)); g.font = fs + 'px monospace';
  const cw_ = g.measureText('M').width, n = MAP_R * 2 + 1, W = n * 2 * cw_, H = n * fs, x0 = Math.round(cv.width - W - 14), y0 = 44;
  g.fillStyle = 'rgba(0,0,0,0.82)'; g.fillRect(x0 - cw_ * 1.5, y0 - fs * 1.2, W + cw_ * 3, H + fs * 2.4);
  const ox = Math.floor(px), oy = Math.floor(py), tw = 2 * cw_;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = mapTile(ox + i - MAP_R, oy + j - MAP_R); g.fillRect(x0 + i * tw, y0 + j * fs, tw + 0.5, fs + 0.5); }
  const inMap = (wx, wy) => { const i = Math.floor(rel(wx - px)) + MAP_R, j = Math.floor(rel(wy - py)) + MAP_R; return i >= 0 && j >= 0 && i < n && j < n ? [x0 + i * tw, y0 + j * fs] : null; };
  const mark = (wx, wy, ch, col) => { // a character on a dark chip, so it reads over any tile
    const p = inMap(wx, wy); if (!p) return;
    g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(p[0], p[1], tw, fs);
    g.fillStyle = col; g.fillText(ch, p[0] + (ch.length < 2 ? cw_ / 2 : 0), p[1]);
  };
  for (const pp of people) if (!pp.hidden) { const p = inMap(pp.x, pp.y); if (p) { g.fillStyle = '#b9a'; g.fillRect(p[0] + cw_ * 0.8, p[1] + fs * 0.4, 2, 2); } }
  for (const c of cars) if (c !== me) mark(c.x, c.y, 'o', PAL[C(c.body, 13)]);
  for (const s of stations) mark(s.x, s.y, 'S', '#4f4');
  for (const s of EL_STATIONS) mark(s.x, EL_Y + 1, 'E', '#f84');
  for (const v of vendors) mark(v.x, v.y, '$', '#fa3');
  const tt = taskTarget(); if (tt) mark(tt.x, tt.y, '?', '#4ff');
  const jt = jobTarget(); if (jt && fract(T * 2) < 0.7) mark(jt.x, jt.y, '!', '#ff0');
  if (me && me.dest) mark(me.dest[0], me.dest[1], 'X', '#f4f');
  const ang = me ? Math.atan2(me.hy, me.hx) : a; // you, and which way you're facing
  mark(px, py, '@' + ['>', 'v', '<', '^'][mod(Math.round(ang / (Math.PI / 2)), 4)], '#ff5');
  g.fillStyle = PAL[C(GRAY, 9)]; // the frame
  const edge = '+' + '-'.repeat(n * 2 + 1) + '+';
  g.fillText(edge, x0 - cw_ * 1.5, y0 - fs * 1.2); g.fillText(edge, x0 - cw_ * 1.5, y0 + H + fs * 0.2);
  for (let j = 0; j < n; j++) { g.fillText('|', x0 - cw_ * 1.5, y0 + j * fs); g.fillText('|', x0 + W + cw_ * 0.5, y0 + j * fs); }
  g.fillStyle = PAL[C(WHITE, 15)]; g.fillText('N', x0 + W / 2 - cw_ / 2, y0 - fs * 1.2);
  g.font = FS + 'px monospace';
}

const DISTRICT_TITLE = { downtown: 'Downtown', midtown: 'Midtown', chinatown: 'Chinatown', industrial: 'the Docks',
                         brownstones: 'the Brownstones', waterfront: 'the Waterfront', sea: 'the Bay' };
function hud() {
  drawHeldBig();
  if (job && mode === 'drive') jobArrow();
  minimap();
  hotbar();
  const hh = Math.floor(tod), mm = Math.floor(fract(tod) * 60);
  const isle = onIsland(px, py) ? 'Lighthouse Island' : onFootbridge(px, py) ? 'the Lighthouse Walk' : '';
  const where = mode === 'room' ? '' : isle || [streetName(px, py), DISTRICT_TITLE[districtAt(px, py)]].filter(Boolean).join(', ');
  const lines = [`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${weather}${K.KeyT ? '  >> x40' : ''}   ${fmt$(money)}${where ? '   ' + where : ''}`,
                 settings.help ? 'WASD move | mouse or arrows look | R/F up/down | shift run | E use / talk | H hail taxi | hold T: time | Y: weather | M: map | N: sound | Esc: pause' : 'Esc: pause'];
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, g.measureText(lines[1]).width + 8, FS * 2 + 6);
  g.fillStyle = '#bbb'; lines.forEach((l, k) => g.fillText(l, 4, 3 + k * FS));
  if (task) { // the favour you're doing, under the help line
    const s = 'TASK: ' + taskText(), w = g.measureText(s).width;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, FS * 2 + 6, w + 8, FS + 4);
    g.fillStyle = '#4ff'; g.fillText(s, 4, FS * 2 + 8);
  }
  const p = promptText(), y = (mode === 'drive' || mode === 'taxi' ? rows - 6 : rows - 3) * FS;
  for (const [s, yy, col] of [[p, y, '#ff8'], [msgT > 0 ? msgText : '', FS * 4, '#fff']]) {
    if (!s) continue;
    const w = g.measureText(s).width;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect((cv.width - w) / 2 - 6, yy - 3, w + 12, FS + 6);
    g.fillStyle = col; g.fillText(s, (cv.width - w) / 2, yy);
  }
}


