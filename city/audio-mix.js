// ---- audio mix: how loud each layer of sound should be right now, 0..1, from the game state alone.
// Pure, so the node tests can check it; city/audio.js plays it and glides every layer toward these targets,
// which is what makes day turn into night, and indoors into outdoors, without a seam.
//
// Layers: recorded beds (city, night, crowd, restaurant, bossa, coffee, karaoke, arcade, rain) and synthesised ones (waves,
// wind, rumble, tunnel, engine). One-shots (footsteps, sirens, the till) are handled in audio.js.

// how much traffic / crowd / night-time nature each district has
const AUDIO_DISTRICT = {
  downtown: { city: 1, crowd: 0.8, night: 0.4 }, midtown: { city: 1, crowd: 0.8, night: 0.5 },
  chinatown: { city: 0.85, crowd: 1, night: 0.5 }, industrial: { city: 0.7, crowd: 0.15, night: 0.7 },
  brownstones: { city: 0.5, crowd: 0.35, night: 1 }, waterfront: { city: 0.35, crowd: 0.5, night: 0.9 },
  sea: { city: 0.15, crowd: 0, night: 0.8 },
};
// which room plays what: [restaurant crowd, bossa nova, coffee jazz]. Music only where a shop would have it on:
// cafes and restaurants, bars, the shops and hotel lobbies; not apartment lobbies, the bank, the gym, the cinema or the subway
const ROOM_AUDIO = {
  bar: [1, 0.55, 0], diner: [0.7, 0.75, 0], karaoke: [0.8, 0, 0], arcade: [0.35, 0, 0], store: [0, 0, 0.5],
  laundry: [0, 0, 0.45], barber: [0.1, 0, 0.55], petshop: [0, 0, 0.5], florist: [0, 0.35, 0.4],
  hotel: [0.2, 0.4, 0], aquarium: [0.2, 0, 0], cathedral: [0.06, 0, 0], hospital: [0.25, 0, 0], hotelroom: [0, 0, 0], bank: [0.15, 0, 0], gym: [0.15, 0, 0], cinema: [0, 0, 0], apts: [0, 0, 0], station: [0.25, 0, 0], train: [0, 0, 0],
};
const CAFE_WORDS = new Set(['CAFE', 'COFFEE', 'DONUTS', 'BAKERY', 'TEA HOUSE', 'DIM SUM']);
// how busy the streets sound by hour: quiet small hours, morning and evening peaks
const busyHour = h => clamp(Math.sin((h - 5) / 19 * Math.PI) * 1.3, 0, 1);
// distance to open water, in cells (0 on it)
function seaDist(x, y) {
  if (seaAt(x, y) && !onPier(x, y)) return 0;
  const m = mod(y, N);
  return Math.max(0, Math.min(m - shoreN(x), shoreS(x) - m));
}

function audioMix(s) {
  const out = { board: 0, city: 0, crowd: 0, night: 0, restaurant: 0, bossa: 0, coffee: 0, karaoke: 0, arcade: 0, rain: 0, waves: 0, wind: 0, rumble: 0, tunnel: 0, engine: 0 };
  if (s.mode === 'room') {
    const k = s.room.kind, [rest, bossa, coffee] = ROOM_AUDIO[k] || [0, 0, 0];
    const cafe = CAFE_WORDS.has(s.room.word);
    out.restaurant = rest * (k === 'bar' || k === 'karaoke' ? s.barCrowd : 1);
    out.bossa = cafe ? 0.8 : bossa;
    out.coffee = cafe ? 0 : coffee;
    if (k === 'karaoke') out.karaoke = 0.9; // somebody's always singing Sweet Caroline
    if (k === 'arcade') out.arcade = 0.85; // chiptunes over the cabinets' bleeps
    out.city = 0.08 * (0.4 + 0.6 * s.day); // the street, through the walls
    out.rain = 0.6 * s.rain; // (low-passed: on the windows, through the walls)
    if (k === 'station') out.tunnel = 0.7;
    if (k === 'lighthouse' || k === 'lamproom') { out.waves = 0.55; out.wind = k === 'lamproom' ? 0.5 : 0.15; out.city = 0; } // the sea all round
    if (k === 'train') out.rumble = 0.9;
    if (k === 'cathedral') out.city = 0.015; // thick walls
    if (k === 'aquarium') { out.waves = 0.22; out.city = 0.02; } // the tanks' pumps and bubblers, like the sea far off
    return out;
  }
  const d = AUDIO_DISTRICT[s.district] || AUDIO_DISTRICT.midtown;
  // up high (a roof, the el) the street is further away and the wind gets at you
  const height = s.mode === 'roof' ? s.roofH : s.mode === 'el' || s.mode === 'elplat' ? 0.7 : s.mode === 'fair' ? s.fairEye || 0 : 0;
  const far = 1 / (1 + height * 0.25);
  out.city = far * d.city * (0.3 + 0.7 * s.day) * (1 - 0.35 * s.rain);
  out.crowd = far * d.crowd * busyHour(s.tod) * (1 - 0.7 * s.rain);
  out.night = far * (0.5 + 0.5 * d.city) * s.night * (1 - 0.35 * s.rain); // the city at night: a distant hum, the odd car
  out.rain = s.rain;
  out.waves = clamp(1 - s.seaDist / 22, 0, 1) ** 1.5;
  out.wind = clamp(height / 6, 0, 0.7) + (s.onBridge ? 0.45 : 0) + 0.25 * out.waves + 0.2 * s.fog + 0.45 * (s.storm || 0);
  out.rumble = s.mode === 'el' ? 0.85 : s.elNear;
  if (s.fairNear) { // the pleasure pier: a crowd, and the booths' bleeps and jingles drifting over it
    out.crowd = Math.max(out.crowd, 0.7 * s.fairNear * (s.tod >= 9 || s.tod < 2 ? 1 : 0.2));
    out.arcade = 0.4 * s.fairNear * far;
  }
  if (s.boombox) out[s.song || 'bossa'] = 0.7; // your boombox, playing whichever tape's in
  out.board = s.skating ? 0.7 : 0; // wheels on asphalt
  out.engine = s.mode === 'drive' ? 0.35 + 0.65 * clamp(Math.abs(s.speed) / 2.5, 0, 1) : s.mode === 'taxi' ? 0.25 + 0.3 * clamp(s.speed / 2, 0, 1) : 0;
  for (const k in out) out[k] = clamp(out[k], 0, 1);
  return out;
}

// what's underfoot, for the footstep sound
function surfaceAt(mode, room, x, y) {
  if (mode === 'room') {
    const f = room.def.floor;
    return f === 'carpet' ? 'carpet' : f === 'wood' ? 'wood' : f === 'rubber' ? 'carpet' : 'tile';
  }
  if (mode === 'elplat' || mode === 'roof') return mode === 'roof' ? 'gravel' : 'metal';
  if (onPier(x, y)) return 'wood';
  const k = ROAD[idx(Math.floor(x), Math.floor(y))], bx = Math.floor(x / 8), by = Math.floor(y / 8);
  if (k === 1 && onBridge(bx, by)) return 'metal';
  if (k) return 'stone';
  const kind = blockKind(bx, by);
  if (kind === 'park') return inPond(mod(x, 8), mod(y, 8), bx & (NB - 1), by & (NB - 1), 0.15) ? 'wood' : 'grass';
  if (kind === 'waterfront') return seaDist(x, y) < 1.6 && hash(bx & (NB - 1), (by & (NB - 1)) === SHORE_S ? 1 : 2, 47) < 0.35 ? 'sand' : 'stone';
  if (kind === 'construction' || kind === 'yard') return 'gravel';
  return 'stone';
}
