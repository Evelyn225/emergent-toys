// ---- audio mix: how loud each layer of sound should be right now, 0..1, from the game state alone.
// Pure, so the node tests can check it; city/audio.js plays it and glides every layer toward these targets,
// which is what makes day turn into night, and indoors into outdoors, without a seam.
//
// Layers: recorded beds (city, night, crowd, restaurant, bossa, coffee, karaoke, arcade, rain, birds, cathedral,
// pachinko, waterfall, aquarium, soft aquarium water) and synthesised ones (waves, wind, rumble, tunnel, engine).
// One-shots (footsteps, sirens, the till) are handled in audio.js.

// how much traffic / crowd / night-time nature each district has
const AUDIO_DISTRICT = {
  downtown: { city: 1, crowd: 0.8, night: 0.4 }, midtown: { city: 1, crowd: 0.8, night: 0.5 },
  belle: { city: 0.8, crowd: 0.65, night: 0.5 },
  chinatown: { city: 0.85, crowd: 1, night: 0.5 }, industrial: { city: 0.7, crowd: 0.15, night: 0.7 },
  brownstones: { city: 0.5, crowd: 0.35, night: 1 }, waterfront: { city: 0.35, crowd: 0.5, night: 0.9 },
  sea: { city: 0.15, crowd: 0, night: 0.8 }, shotengai: { city: 0.55, crowd: 1, night: 0.4 },
};
// which room plays what: [restaurant crowd, bossa nova, coffee jazz]. Music only where a shop would have it on:
// cafes and restaurants, bars, the shops and hotel lobbies; not apartment lobbies, the bank, the gym, the cinema or the subway
const ROOM_AUDIO = {
  bar: [1, 0.55, 0], diner: [0.7, 0.75, 0], karaoke: [0.8, 0, 0], arcade: [0.35, 0, 0], store: [0, 0, 0.5],
  laundry: [0, 0, 0.45], barber: [0.1, 0, 0.55], petshop: [0, 0, 0.5], florist: [0, 0.35, 0.4],
  hotel: [0.2, 0.4, 0], grandhotel: [0.15, 0.35, 0], casino: [0.7, 0, 0], stripclub: [0.55, 0.8, 0], aquarium: [0.2, 0, 0], conservatory: [0.1, 0, 0], aviary: [0.1, 0, 0], cathedral: [0.06, 0, 0], pachinko: [0.3, 0, 0], cranes: [0.25, 0, 0], capsule: [0, 0, 0], hospital: [0.25, 0, 0], hotelroom: [0, 0, 0], bank: [0.15, 0, 0], gym: [0.15, 0, 0], cinema: [0, 0, 0], apts: [0, 0, 0], walkup: [0, 0, 0], tower: [0.1, 0, 0], freightlobby: [0, 0, 0], bellelobby: [0.1, 0, 0], station: [0.25, 0, 0], train: [0, 0, 0],
  grocer: [0, 0, 0.45], deli: [0.35, 0, 0.35], hardware: [0, 0, 0.3], skate: [0.15, 0, 0.3], sports: [0.1, 0, 0.4], toys: [0.2, 0, 0.45], thrift: [0, 0.35, 0.2], records: [0.1, 0.3, 0.55], tattoo: [0.1, 0, 0.55],
  pizzeria: [0.65, 0.4, 0], burgerjoint: [0.65, 0.6, 0], taqueria: [0.6, 0.35, 0], sushibar: [0.5, 0, 0.2], icecream: [0.25, 0, 0.45], bakery: [0.2, 0.3, 0.3],
  chickenshop: [0.55, 0.3, 0], kebabshop: [0.5, 0.2, 0], bento: [0.3, 0, 0.3], takoyaki: [0.35, 0, 0.2], yakitori: [0.7, 0, 0], donutshop: [0.25, 0.2, 0.4], juicebar: [0.2, 0.3, 0.3], bagelshop: [0.35, 0, 0.4],
  thai: [0.55, 0.3, 0], pho: [0.6, 0, 0], dumplings: [0.6, 0, 0], dimsum: [0.85, 0, 0], kissaten: [0.15, 0.55, 0.3], izakaya: [0.85, 0.2, 0], mahjong: [0.6, 0, 0],
  bodega: [0.2, 0, 0.45], markethall: [0.7, 0, 0.2], fruitshop: [0.15, 0, 0.4], motel: [0.1, 0, 0.3], welding: [0.1, 0, 0.2], tireshop: [0.2, 0, 0.3], tailor: [0.1, 0.35, 0.2], antiques: [0.05, 0.45, 0.1],
  drugstore: [0.25, 0, 0.5], delicatessen: [0.35, 0.2, 0.3], gacha: [0.25, 0, 0.3], roastery: [0.2, 0.45, 0.55], noodlehouse: [0.65, 0, 0],
  pharmacy: [0, 0, 0.4], tobacco: [0, 0.5, 0], video: [0, 0, 0.45], herbs: [0, 0, 0.25], phones: [0.1, 0, 0.35], pawn: [0, 0, 0.3], liquor: [0, 0, 0.4], jeweler: [0, 0.45, 0], gas: [0, 0, 0.35], terminal: [0.55, 0, 0.15],
};
const CAFE_WORDS = new Set(['CAFE', 'COFFEE', 'DONUTS', 'BAKERY', 'TEA HOUSE', 'DIM SUM']);
// how busy the streets sound by hour: quiet small hours, morning and evening peaks
const busyHour = h => clamp(Math.sin((h - 5) / 19 * Math.PI) * 1.3, 0, 1);
// distance to open water, in cells (0 on it)
function seaDist(x, y) {
  if (seaAt(x, y) && !onPier(x, y)) return 0;
  if(worldReady)return Math.max(0,archipelagoEdge(x,y));
  const m = worldCoord(y);
  return Math.max(0, Math.min(m - shoreN(x), shoreS(x) - m));
}

function audioMix(s) {
  const out = { board: 0, city: 0, crowd: 0, night: 0, restaurant: 0, bossa: 0, coffee: 0, karaoke: 0, arcade: 0, rain: 0,
    birds: 0, cathedral: 0, pachinko: 0, waterfall: 0, aquarium: 0, waterSoft: 0,
    fluorescent: 0, watch: s.watch ? 1 : 0, waves: 0, wind: 0, rumble: 0, tunnel: 0, engine: 0 };
  if (s.mode === 'room') {
    const k = s.room.kind, [rest, bossa, coffee] = ROOM_AUDIO[k] || [0, 0, 0];
    const cafe = CAFE_WORDS.has(s.room.word);
    out.restaurant = rest * (k === 'bar' || k === 'karaoke' ? s.barCrowd : 1);
    out.bossa = cafe ? 0.8 : bossa;
    if (k === 'hotelroom' && s.room.suite) out.bossa = 0.2;
    out.coffee = cafe ? 0 : coffee;
    if (k === 'karaoke') out.karaoke = 0.9; // somebody's always singing Sweet Caroline
    if (k === 'arcade') out.arcade = 0.85;
    if (k === 'casino') out.arcade = 0.55; // the slots chiming over the crowd // chiptunes over the cabinets' bleeps
    out.city = 0.08 * (0.4 + 0.6 * s.day); // the street, through the walls
    out.rain = 0.6 * s.rain; // (low-passed: on the windows, through the walls)
    if (k === 'station') out.tunnel = 0.7;
    if (k === 'cathedral') out.cathedral = 0.8;
    if (k === 'pachinko') out.pachinko = 0.75;
    if (k === 'laundry') out.fluorescent = 0.28;
    if (k === 'jail') out.fluorescent = 0.55;
    if (k === 'backrooms') out.fluorescent = 1; // (nothing else in there but the lights)
    if (k === 'aviary') out.birds = 0.8;
    if (k === 'conservatory') out.birds = 0.16;
    if (k === 'conservatory') out.waterfall = s.waterfall || 0;
    if (k === 'aquarium') { out.aquarium = 0.9; out.waterSoft = 0.7; }
    if (k === 'lighthouse' || k === 'lamproom') { out.waves = 0.55; out.wind = k === 'lamproom' ? 0.5 : 0.15; out.city = 0; } // the sea all round
    if (k === 'train') out.rumble = 0.9;
    if (k === 'cathedral') out.city = 0.015; // thick walls
    if (k === 'pachinko') out.arcade = 0; // the pachinko recording replaces the generic arcade bed
    if (k === 'cranes') out.arcade = 0.75;
    if (k === 'conservatory') { out.waves = 0.3; out.city = 0.02; } // the waterfall
    if (k === 'aviary') out.city = 0.04;
    if (s.room.burgled) { out.restaurant = out.bossa = out.coffee = out.karaoke = out.arcade = 0; out.city *= 0.6; } // broken into at night: nobody here, nothing on, just the street outside
    if (k === 'aquarium') { out.waves = 0.22; out.city = 0.02; } // the tanks' pumps and bubblers, like the sea far off
    if (k === 'islandhome'||k==='islandshelter'||s.wilderness) { out.waves=.3;out.city=out.night=out.crowd=0;out.birds=.12*s.day*(1-.65*s.rain);out.wind=.06; }
    if(s.record)out[s.record.song]=.7*s.record.gain;
    if(s.boombox)out[s.song||'bossa']=.7;
    return out;
  }
  const d = AUDIO_DISTRICT[s.district] || AUDIO_DISTRICT.midtown;
  out.waterfall=s.waterfall||0;
  // up high (a roof, the el) the street is further away and the wind gets at you
  const height = s.mode === 'roof' ? s.roofH : s.mode === 'el' || s.mode === 'elplat' ? 0.7 : s.mode === 'fair' ? s.fairEye || 0 : 0;
  const far = 1 / (1 + Math.max(height, s.mode === 'air' ? s.airHeight || 0 : 0) * 0.25);
  out.city = far * d.city * (0.3 + 0.7 * s.day) * (1 - 0.35 * s.rain);
  out.crowd = far * d.crowd * busyHour(s.tod) * (1 - 0.7 * s.rain);
  out.night = far * (0.5 + 0.5 * d.city) * s.night * (1 - 0.35 * s.rain); // the city at night: a distant hum, the odd car
  out.rain = s.rain;
  out.waves = clamp(1 - s.seaDist / 22, 0, 1) ** 1.5;
  out.wind = clamp(height / 6, 0, 0.7) + (s.onBridge ? 0.45 : 0) + 0.25 * out.waves + 0.2 * s.fog + 0.45 * (s.storm || 0);
  out.rumble = s.mode === 'el' ? 0.85 : s.elNear;
  if (s.gardens) { out.city *= 0.35; out.crowd *= 0.4; out.night *= 0.5; out.waves = Math.max(out.waves, 0.15); } // the traffic's far off behind the trees; the lake lapping
  if (s.gardens) out.birds = (0.25 + 0.75 * s.day) * (1 - 0.65 * s.rain); // songbirds in the gardens by day
  if (s.district === 'shotengai') out.pachinko = Math.max(out.pachinko, 0.28 * far); // parlour roar spilling into the covered street
  if (s.fireworks) out.crowd = Math.max(out.crowd, 0.8 * clamp(1 - s.seaDist / 30, 0.2, 1)); // the crowd on the shore, oohing
  if (s.fairNear) { // the Sunset Pier: a crowd, and the booths' bleeps and jingles drifting over it
    out.crowd = Math.max(out.crowd, 0.7 * s.fairNear * (s.tod >= 9 || s.tod < 2 ? 1 : 0.2));
    out.arcade = 0.4 * s.fairNear * far;
  }
  if (s.serenade) out.bossa = Math.max(out.bossa, 0.8 * s.serenade); // Nico on the bar roof, after his guitar came back
  // Use the botanical garden's nature recording, including after dark. Apply
  // this after event beds so a distant city fireworks show cannot restore crowds.
  if(s.wilderness){out.city=out.crowd=out.night=out.pachinko=out.arcade=0;out.birds=(.25+.75*s.day)*(1-.65*s.rain);}
  if (s.boombox) out[s.song || 'bossa'] = 0.7; // your boombox, playing whichever tape's in
  out.board = s.skating ? 0.3 + 0.4 * clamp(s.skating, 0, 1.3) : 0; // wheels on asphalt, louder the faster they roll (skating: speed / cruising top)
  out.engine = s.mode === 'air' ? 0.35 + 0.55 * clamp(s.throttle || 0, 0, 1) : s.mode === 'drive' ? 0.35 + 0.65 * clamp(Math.abs(s.speed) / 2.5, 0, 1) : s.mode === 'taxi' ? 0.25 + 0.3 * clamp(s.speed / 2, 0, 1) : s.mode === 'sea' ? 0.25 + 0.5 * clamp(Math.abs(s.speed) / 1.5, 0, 1) : 0;
  if(s.mode==='ferry') {
    out.engine=s.ferryInside ? .12 : .18;out.engine+=s.ferryMoving ? .1 : 0;
    out.city*=.2;out.waves*=s.ferryInside ? .35 : .85;out.wind*=s.ferryInside ? .15 : .75;
    out.rain*=s.ferryInside ? .12 : 1;out.crowd=s.ferryInside ? .08 : .025;
  }
  for (const k in out) out[k] = clamp(out[k], 0, 1);
  return out;
}

// Ten metres per outdoor cell. No minimum gain: distant sources fade to silence
// and lose their sharp high frequencies before they disappear.
function soundDistanceProfile(rx,ry,rz,yaw,range=180,reference=14,indoors=false) {
  const distance=Math.hypot(rx,ry,rz),edge=1-smooth(clamp((distance/range-.75)/.25,0,1));
  return {distance,gain:edge/(1+(distance/reference)**2)*(indoors?.15:1),
    cutoff:Math.max(180,Math.min(indoors?900:18000,18000/(1+distance/12)**1.5)),
    pan:clamp((-Math.sin(yaw)*rx+Math.cos(yaw)*ry)/Math.max(.01,distance),-.9,.9),delay:distance/34};
}

// what's underfoot, for the footstep sound
function surfaceAt(mode, room, x, y) {
  if(mode==='ferry')return ferryRide?.u>-.98&&Math.abs(ferryRide.v)<.46?'carpet':'wood';
  if (mode === 'room') {
    const f = room.def.floor;
    const w=room.def.wc;if(w&&x>=w.x0&&x<w.x1&&y>=w.y0&&y<w.y1)return 'tile';
    return f === 'carpet' ? 'carpet' : ['wood','home','hotel','cove','islandwood','fernwood'].includes(f) ? 'wood' : f === 'rubber' ? 'carpet' : 'tile';
  }
  if (mode === 'elplat' || mode === 'roof') return mode === 'roof' ? 'gravel' : 'metal';
  if (onPier(x, y)) return 'wood';
  const k = ROAD[idx(Math.floor(x), Math.floor(y))], bx = Math.floor(x / 8), by = Math.floor(y / 8);
  if (k === 1 && onBridge(bx, by)) return 'metal';
  if (k) return 'stone';
  const kind = blockKind(bx, by);
  if (kind === 'gardens' && inGardens(x, y)) { const [gx, gy] = gardenLocal(x, y); return onJetty(gx, gy) ? 'wood' : gardenPathDist(gx, gy) < 0.25 ? 'gravel' : 'grass'; }
  if (kind === 'park') return inPond(mod(x, 8), mod(y, 8), bx & (NB - 1), by & (NB - 1), 0.15) ? 'wood' : 'grass';
  if (kind === 'waterfront') return seaDist(x, y) < 1.6 && hash(bx & (NB - 1), (by & (NB - 1)) === SHORE_S ? 1 : 2, 47) < 0.35 ? 'sand' : 'stone';
  if (kind === 'construction' || kind === 'yard') return 'gravel';
  return 'stone';
}
// Outdoor sources stay in world coordinates while the listener is in a room.
function audioWorldPosition(mode,room,x,y) {
  const ret=mode==='room'&&(room?.ret||room?.lobby?.ret);
  return ret?[ret[0],ret[1]]:[x,y];
}
