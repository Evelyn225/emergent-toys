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
  if (mode === 'drive') {
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
const nearStation = () => stations.find(s => Math.hypot(rel(s.x - px), rel(s.y - py)) < 0.35);
const nearElevator = () => room.def.ex && Math.abs(px - room.def.ex) < 1.3 && py < 2.4;
const canBoard = () => room.kind === 'station' && trainStopped(room) && py > 4.2 && Math.abs(px - 15) < 13;
function promptText() {
  if (mode === 'room') {
    if (room.kind === 'train') return room.dest == null
      ? 'Next stop?   ' + room.opts.map((s, n) => `${n + 1}: ${stations[s].name}`).join('   ')
      : room.rideT > 0 ? `Next stop: ${stations[room.dest].name}` : '';
    if (nearElevator()) return 'E: elevator to the roof';
    if (canBoard()) return 'E: board the train';
    const k = room.def.keeper;
    if (k && Math.hypot(px - k[0], py - k[1]) < 2) return `"${room.line}"`;
    return room.kind === 'station' ? 'E: leave (or take the EXIT stairs)' : 'E: leave';
  }
  if (mode === 'roof') return 'E: take the stairs down';
  if (mode === 'el') { const t = elRiding(); return t.stopped ? `E: get off at ${EL_STATIONS[t.station].name}` : `Next stop: ${EL_STATIONS[t.next].name}`; }
  if (mode === 'elplat') {
    if (elHere()) return 'E: board the train';
    const next = elTrains(T).filter(t => t.tr === plat.tr && EL_STATIONS[t.next] === plat.s && !t.stopped).map(t => t.left);
    return `E: stairs down${next.length ? `   (next train in ${Math.ceil(Math.min(...next))}s)` : ''}`;
  }
  if (mode === 'drive') return 'W/S gas & brake | A/D steer | V: camera | E: get out (when slow)';
  if (mode === 'taxi') return 'mouse: look around | V: camera | E: get out';
  const c = nearestCar(0.5);
  if (c && c.v < 0.6 && !c.ev) return c.body === TAXI ? 'E: get in the taxi' : 'E: take this car';
  const who = nearPerson();
  if (who) return task && task.who === who ? (task.kind === 'fetch' && task.have ? 'E: hand it over' : 'E: talk') : 'E: talk';
  if (nearDog()) return 'E: call the dog';
  const el = nearElStairs();
  if (el) return `E: up to the ${el.s.name} el, ${el.tr ? 'eastbound' : 'westbound'} (${fmt$(SUBWAY_FARE)})`;
  const st = nearStation();
  if (st) return `E: go down to ${st.name} station (${fmt$(SUBWAY_FARE)})`;
  const ven = nearVendor();
  if (ven) return `E: buy ${ven.type.item} ($${ven.type.price})`;
  if (lookHit && lookHit.d < 0.35 && SHOP[idx(lookHit.mx, lookHit.my)]) {
    const sh = SHOP[idx(lookHit.mx, lookHit.my)];
    if (sh.kind === SHOP_SHUT) return 'Closed.';
    if (!openAt(sh, tod)) return `${sh.signed ? sh.word : 'Shop'}: closed, opens at ${sh.hours[0]}:00`;
    if (sh.kind === SHOP_APTS) return 'E: enter the building (roof access)';
    return `E: enter ${sh.signed ? sh.word : 'shop'}${ROOM_FOR[sh.word] === 'hotel' ? ' (roof access)' : ''}`;
  }
  if (cars.some(c => c.body === TAXI && !c.rider && !c.player && !c.hail && Math.hypot(rel(c.x - px), rel(c.y - py)) < 5)) return 'H: hail the taxi';
  return '';
}
// north-up minimap, top right: buildings shaded by height, parks, water, stations, cars, people, you, taxi destination
let showMap = false;
const MAP_R = 20, MAP_PX = 5; // cells shown each side of you, pixels per cell (1 cell = 10m)
const MAP_COL = { park: '#1f5a2a', sea: '#1d3f7a', construction: '#4a3a28', yard: '#3a3428', waterfront: '#4a4636' };
function minimap() {
  if (!showMap || mode === 'room') return;
  const size = (MAP_R * 2 + 1) * MAP_PX, x0 = cv.width - size - 8, y0 = 42; // below the home button
  const ox = Math.floor(px), oy = Math.floor(py), sx = (wx, wy) => [x0 + (rel(wx - px) + MAP_R + 0.5) * MAP_PX, y0 + (rel(wy - py) + MAP_R + 0.5) * MAP_PX];
  g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x0 - 3, y0 - 3, size + 6, size + 6);
  g.save(); g.beginPath(); g.rect(x0, y0, size, size); g.clip();
  const fx = (MAP_R + 0.5 - fract(px)) * MAP_PX, fy = (MAP_R + 0.5 - fract(py)) * MAP_PX; // scroll smoothly by sub-cell
  for (let j = -MAP_R - 1; j <= MAP_R + 1; j++) for (let i = -MAP_R - 1; i <= MAP_R + 1; i++) {
    const mx = ox + i, my = oy + j, k = idx(mx, my), h = map[k], road = ROAD[k];
    const kind = h || road ? '' : seaAt(mx + 0.5, my + 0.5) && !onPier(mx + 0.5, my + 0.5) ? 'sea' : blockKind(Math.floor(mod(mx, N) / 8), Math.floor(mod(my, N) / 8));
    g.fillStyle = h ? `rgb(${60 + Math.min(h, 12) * 12},${60 + Math.min(h, 12) * 12},${75 + Math.min(h, 12) * 12})`
                : road ? (underEl(my + 0.5) ? '#3a2420' : '#16161c') : MAP_COL[kind] || '#3a3a40';
    g.fillRect(x0 + fx + i * MAP_PX, y0 + fy + j * MAP_PX, MAP_PX, MAP_PX);
  }
  g.restore();
  const dot = (wx, wy, col, r) => {
    const [x, y] = sx(wx, wy);
    if (x < x0 || y < y0 || x > x0 + size || y > y0 + size) return;
    g.fillStyle = col; g.fillRect(x - r / 2, y - r / 2, r, r);
  };
  for (const p of people) if (!p.hidden) dot(p.x, p.y, '#b9a', 1.5);
  for (const c of cars) if (c !== me) dot(c.x, c.y, PAL[C(c.body, 14)], 3);
  for (const s of stations) dot(s.x, s.y, '#3f3', 5);
  for (const v of vendors) dot(v.x, v.y, '#fa3', 4);
  if (me && me.dest) dot(me.dest[0], me.dest[1], '#f4f', 5);
  for (const s of EL_STATIONS) dot(s.x, EL_Y + 1, '#f84', 5);
  const tt = taskTarget();
  if (tt) dot(tt.x, tt.y, '#4ff', 6);
  // you: an arrow pointing where you face (map y runs down = +y in the world, so world angles draw as-is)
  const [cx, cy] = sx(px, py), ang = me ? Math.atan2(me.hy, me.hx) : a;
  g.fillStyle = '#ff5'; g.beginPath();
  g.moveTo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6);
  g.lineTo(cx + Math.cos(ang + 2.5) * 4, cy + Math.sin(ang + 2.5) * 4);
  g.lineTo(cx + Math.cos(ang - 2.5) * 4, cy + Math.sin(ang - 2.5) * 4);
  g.fill();
  g.fillStyle = '#bbb'; g.fillText('N', x0 + size / 2 - 3, y0 + 1);
}

const DISTRICT_TITLE = { downtown: 'Downtown', midtown: 'Midtown', chinatown: 'Chinatown', industrial: 'the Docks',
                         brownstones: 'the Brownstones', waterfront: 'the Waterfront', sea: 'the Bay' };
function hud() {
  minimap();
  const hh = Math.floor(tod), mm = Math.floor(fract(tod) * 60);
  const where = mode === 'room' ? '' : [streetName(px, py), DISTRICT_TITLE[districtAt(px, py)]].filter(Boolean).join(', ');
  const lines = [`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${weather}${K.KeyT ? '  >> x40' : ''}   ${fmt$(money)}${where ? '   ' + where : ''}`,
                 'WASD move | mouse or arrows look | R/F up/down | shift run | E use / talk | H hail taxi | hold T: time | Y: weather | M: map | N: sound'];
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

