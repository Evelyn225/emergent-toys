// ---- multiplayer, the part with no DOM in it: message checks, smoothing other players between updates, and the rules
// every client applies the same way so nobody needs a server to referee (MULTIPLAYER_PLAN.md). Each client still runs
// its own city; the network only carries players, their chat and the shared clock. The transport and the drawing are in
// net.js.
const NET_PROTOCOL = 13; // shared homes/transit plus returning police and visible held/smoking props
// (2: spray-paint tags; 3: shared cars; 4: freehand spray paint; 5: guns; 6: rod hooks; 7: police; 8: away, and what more is shown; 9: peaceful, car hits, pickpocketing, balls; 10: whispers, gifts, invites, drops, more rides)
const NET_MAX_PEERS = 7; // others in the room (eight players in all: everyone connects to everyone)
const NET_TICK_HZ = 12, NET_DELAY = 0.15; // updates a second; how far behind their latest update others are drawn (s)
const NET_SNAP = 4; // cells: further than this between two updates is a teleport (a door, a taxi ride), not a walk
const NET_TIMEOUT = 8; // seconds without a word from someone and they've gone
const NET_CHAT_MAX = 120, NET_NAME_MAX = 16, NET_CODE_MAX = 32;
const NET_CLOCK_EVERY = 2; // s: the clock owner's broadcast
const NET_MODES = ['walk', 'room', 'roof', 'elplat', 'el', 'ferry', 'drive', 'taxi', 'boat', 'sea', 'air', 'fair', 'ladder', 'ride'];
const NET_POSES = /^(stand|walk|run|sit|crouch|ride|push|aim|wave|skateair|dance|gasp|tumble|reach|mongo|down)\d*$/;

// What's switched on: other players are always there (the ghosts); chat and the shared clock are on; the phases after
// them (riding, guns, hooks, police) get a flag each as they land, off until they've been tried. Everyone in a room
// needs the same set, so the set is part of netBuildId(). (?netfeatures=a,b sets exactly that list, and
// ?netfeatures=none switches them all off, for trying things out: net.js)
const NET_FEATURES = { chat: true, clock: true, tags: true, cars: true, paint: true, guns: true, hooks: true, police: true, balls: true, gifts: true };
const netFeatureKey = () => Object.keys(NET_FEATURES).filter(k => NET_FEATURES[k]).join(',');
// everything multiplayer, while you're in a room (on: true) and not
const net = { peaceful: false, shots: [], on: false, code: '', name: '', selfId: '', status: '', peers: new Map(), chat: [], clockOwner: true, sendT: 0, clockT: 0, lastBolt: null, ph: 0 };
const netShared = () => net.on && net.peers.size > 0; // somebody else is here
const netClockShared = () => NET_FEATURES.clock && netShared(); // the clock isn't yours alone
const netFollowsClock = () => netClockShared() && !net.clockOwner; // their clock, not yours: the weather and the time come from them

// The world and the items have to match, or the same id means a different thing: a fingerprint of what this build has.
function netBuildId() {
  const items = typeof ITEMS === 'object' ? Object.keys(ITEMS) : [], s = NET_PROTOCOL + ':' + N + ':' + netFeatureKey() + ':' + items.length + ':' + items.join(',');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return NET_PROTOCOL + '-' + (h >>> 0).toString(36);
}

// text from someone else: printable, trimmed, bounded
const netClean = (s, max) => typeof s === 'string' ? s.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/ +/g, ' ').trim().slice(0, max) : '';
const netNum = v => typeof v === 'number' && Number.isFinite(v);
const netCode = s => netClean(s, NET_CODE_MAX).toLowerCase().replace(/[^a-z0-9-]/g, '');

// Where you are, as far as who can see whom goes: outdoors everyone shares the street; an interior's coordinates are
// its own, so two players are only in the same one if they came in by the same door.
function netRoomKey(m = mode, r = room) {
  if (m !== 'room' || !r) return 'out';
  if (r.cell && ['home', 'loft', 'bellehome', 'islandhome'].includes(r.kind)) return r.kind + ':' + (net.on ? (r.guestOf || net.selfId) + ':' : '') + Math.floor(r.cell[0]) + ',' + Math.floor(r.cell[1]); // (a home: by its cell, so its owner and a guest in by the same door are in the same place)
  if (r.kind === 'station') return 'station:' + r.st;
  if (r.kind === 'train') return 'train:' + r.st + ':' + (r.netBoard ??= Math.floor((dayNum * 24 + tod) * 20 / 45)); // (a carriage has no street door: the station it left and the shared 45-second arrival cycle)
  if (r.kind === 'stadium' || r.kind === 'terminal' || r.kind === 'lighthouse' || r.kind === 'lamproom') return r.kind + ':shared';
  if (r.tower) return r.kind + ':' + r.tower.join(',');
  if (r.cell) {
    const cell = idx(Math.floor(r.cell[0]), Math.floor(r.cell[1])), sh = SHOP[cell];
    const site = r.netSite ??= sh ? SHOP.indexOf(sh) : cell;
    return r.kind + ':site:' + site;
  }
  if (r.lobby) return r.kind + ':' + netRoomKey('room', r.lobby);
  if(r.netDoorSite)return r.netDoorSite;
  if (r.ret && typeof doors !== 'undefined') {
    const nearDoor = doors.filter(d => Math.hypot(rel(d.x-r.ret[0]),rel(d.y-r.ret[1])) < 1).sort((a,b)=>Math.hypot(rel(a.x-r.ret[0]),rel(a.y-r.ret[1]))-Math.hypot(rel(b.x-r.ret[0]),rel(b.y-r.ret[1])))[0];
    if(nearDoor) return r.netDoorSite = r.kind + ':site:' + SHOP.indexOf(nearDoor.sh);
  }
  const ret = r.ret ? r.ret.slice(0, 2).map(v => (+v).toFixed(1)).join(',') : '';
  return r.kind + ':' + ret;
}

// an update from someone: the shape we expect, or null (and they're ignored)
function netCheckTick(d) {
  if (!d || typeof d !== 'object') return null;
  if (!netNum(d.t) || !netNum(d.x) || !netNum(d.y) || !netNum(d.z) || !netNum(d.a)) return null;
  if (!NET_MODES.includes(d.mode) || typeof d.rk !== 'string' || d.rk.length > 80) return null;
  const pose = typeof d.pose === 'string' && NET_POSES.test(d.pose) ? d.pose : 'stand';
  const out = { t: d.t, x: d.x, y: d.y, z: clamp(d.z, -5, 200), a: d.a, mode: d.mode, rk: d.rk, pose, held: typeof d.held === 'string' ? d.held.slice(0, 24) : '', stars: clamp(d.stars | 0, 0, 5) };
  if (d.loc && netNum(d.loc.x) && netNum(d.loc.y)) out.loc = { x: worldCoord(d.loc.x), y: worldCoord(d.loc.y), inside: !!d.loc.inside };
  if (d.veh && typeof d.veh === 'object' && typeof d.veh.kind === 'string' && d.veh.kind.length < 16 && netNum(d.veh.body))
    out.veh = { id: netCarId(d.veh.id), kind: d.veh.kind, body: d.veh.body | 0, v: netNum(d.veh.v) ? d.veh.v : 0, brake: !!d.veh.brake, dmg: netNum(d.veh.dmg) ? clamp(d.veh.dmg, 0, 200) : 0, patrol: !!d.veh.patrol, ev: !!d.veh.ev, siren:!!d.veh.siren, shift: !!d.veh.shift };
  if(['cigarette','joint','pipe'].includes(d.smoking))out.smoking=d.smoking;
  if(netNum(d.heldUses))out.heldUses=clamp(d.heldUses,0,999);
  if (Array.isArray(d.cops)) out.cops = netCheckCops(d.cops);
  if (d.away) out.away = true; // (in the pause menu or another tab)
  if (d.peaceful) out.peaceful = true; // (peaceful mode: can't hurt or rob anyone, nor be hurt or robbed)
  if (d.ride) out.ride = netCarId(d.ride); // (in someone's car: which)
  if (d.pee && netNum(d.pee.el) && netNum(d.pee.flow)) out.pee = { el: clamp(d.pee.el, -1.3, 1.3), flow: clamp(d.pee.flow, 0, 1), loo: d.pee.loo && netNum(d.pee.loo[0]) && netNum(d.pee.loo[1]) ? [d.pee.loo[0], d.pee.loo[1]] : null }; // (peeing: aimed how high, how hard)
  if (d.spray && Number.isInteger(d.spray.col)) out.spray = { col: clamp(d.spray.col, 0, 8) }; // (spraying, in this colour)
  if (d.fish && netNum(d.fish.x) && netNum(d.fish.y) && netNum(d.fish.z)) out.fish = { x: d.fish.x, y: d.fish.y, z: clamp(d.fish.z, -1, 50) }; // (their line's out: the lure)
  if (d.craft && typeof d.craft === 'object' && ['sea', 'swan', 'air'].includes(d.craft.k)) { // (a boat, a swan, an aircraft)
    const c = d.craft, o = { k: c.k, kind: typeof c.kind === 'string' ? c.kind.slice(0, 20) : '', col: netNum(c.col) ? c.col | 0 : 0, v: netNum(c.v) ? c.v : 0 };
    for (const f of ['yaw', 'pitch', 'roll', 'rotor']) o[f] = netNum(c[f]) ? c[f] : 0;
    out.craft = o;
  } // (in the pause menu or another tab: can't be hurt or hooked, and it says so over them)
  if (d.sk && typeof d.sk === 'object' && netNum(d.sk.yaw) && netNum(d.sk.nose) && netNum(d.sk.roll)) // on the board: which way it points, tipped how, and which foot forward
    out.sk = { yaw: d.sk.yaw, nose: clamp(d.sk.nose, -Math.PI, Math.PI), roll: clamp(d.sk.roll, -Math.PI, Math.PI), st: d.sk.st < 0 ? -1 : 1,
      ...(netNum(d.sk.bx) && netNum(d.sk.by) && netNum(d.sk.bz) ? { bx: d.sk.bx, by: d.sk.by, bz: d.sk.bz } : {}) }; // (bx..: where the board went, in a bail)
  return out;
}
function netCheckHello(d) {
  if (!d || typeof d !== 'object' || typeof d.ver !== 'string') return null;
  return { name: netClean(d.name, NET_NAME_MAX) || 'someone', ver: d.ver.slice(0, 40), look: netCheckLook(d.look) };
}
// what you wear: the same outfit as you (a beanie and jeans), in your own colours
const NET_COLOURS = [RED, BLUE, GREEN, ORANGE, YEL, MAG, CYAN, WHITE, GRAY, BRICK];
function netLookFor(name) {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 2654435761) >>> 0;
  return { hat: h % NET_COLOURS.length, top: (h >>> 8) % NET_COLOURS.length, bot: (h >>> 16) % 3 };
}
function netCheckLook(l) {
  const ok = v => Number.isInteger(v) && v >= 0 && v < NET_COLOURS.length;
  const base=l && ok(l.hat) && ok(l.top) && Number.isInteger(l.bot) && l.bot >= 0 && l.bot < 3 ? { hat: l.hat, top: l.top, bot: l.bot } : { hat: 0, top: 1, bot: 0 };
  if(l?.custom!==1)return base; // old clients keep their original outfit
  const out={...base,custom:1};
  for(const [key,choices]of Object.entries(PLAYER_STYLE_CHOICES))out[key]=Number.isInteger(l[key])&&l[key]>=0&&l[key]<choices.length?l[key]:0;
  return out;
}
function netCheckClock(d) {
  if (!d || !netNum(d.tod) || !netNum(d.dayNum) || typeof d.weather !== 'string' || !WEATHER_NEXT[d.weather]) return null;
  return { tod: mod(d.tod, 24), dayNum: Math.max(0, d.dayNum | 0), weather: d.weather, seasonShift: mod(d.seasonShift | 0, 4) };
}

// ---- police: the ones after a wanted player, as that player's game has them (car: a cruiser in pursuit; foot: an officer
// running; roof: one up on the roofs; room: one in the same building)
const NET_COP_KINDS = ['car', 'foot', 'roof', 'room'], NET_COPS_MAX = 12;
function netCheckCops(d) {
  const out = [];
  for (const c of d.slice(0, NET_COPS_MAX)) {
    if (!c || !NET_COP_KINDS.includes(c.k) || !Number.isInteger(c.id) || c.id < 0 || !netNum(c.x) || !netNum(c.y) || !netNum(c.a)) continue;
    const o = { k: c.k, id: c.id, x: c.x, y: c.y, a: c.a, z: netNum(c.z) ? clamp(c.z, 0, 50) : 0, returning:!!c.returning,rk:typeof c.rk==='string'&&c.rk.length<=80?c.rk:c.k==='room'?'':'out' };
    if (c.k === 'car') { if (typeof c.kind !== 'string' || c.kind.length > 15 || !netNum(c.body)) continue; o.kind = c.kind; o.body = c.body | 0; o.v = netNum(c.v) ? c.v : 0; }
    out.push(o);
  }
  return out;
}

// ---- cars: one a player's driven is theirs to share (net.js). Its id is theirs too: their peer id and a count, so two
// players never make the same one.
const NET_PARKED_MAX = 12; // cars of yours others see parked where you left them (the nearest, if you've left more)
const netCarId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}:\d{1,6}$/.test(v) ? v : '';
function netCheckParked(d) {
  if (!Array.isArray(d)) return null;
  const out = [];
  for (const c of d.slice(0, NET_PARKED_MAX)) {
    if (!c || !netCarId(c.id) || typeof c.kind !== 'string' || c.kind.length > 15 || !netNum(c.body) || !netNum(c.x) || !netNum(c.y) || !netNum(c.a)) continue;
    out.push({ id: c.id, kind: c.kind, body: c.body | 0, x: worldCoord(c.x), y: worldCoord(c.y), a: c.a, dmg: netNum(c.dmg) ? clamp(c.dmg, 0, 200) : 0,
      wrecked: !!c.wrecked, locked: !!c.locked, patrol: !!c.patrol, ev: !!c.ev });
  }
  return out;
}

// someone's spray-painted tags (graffiti.js): theirs to keep in their save, shown on your walls while they're here
const NET_TAG_FACES = ['N', 'S', 'E', 'W'], NET_TAG_MAX = 60;
function netCheckTags(d, designs) {
  if (!Array.isArray(d)) return null;
  const out = [];
  for (const t of d.slice(-NET_TAG_MAX)) {
    if (!t || !Number.isInteger(t.cell) || t.cell < 0 || t.cell >= N * N || !NET_TAG_FACES.includes(t.face) || !netNum(t.u) || !netNum(t.z)) continue;
    if (!Number.isInteger(t.design) || t.design < 0 || t.design >= designs) continue;
    out.push({ cell: t.cell, face: t.face, u: t.u, z: clamp(t.z, 0, 2), design: t.design });
  }
  return out;
}
const netPeerTags = () => { const out = []; if (net.on && NET_FEATURES.tags) for (const p of net.peers.values()) if (p.tags && p.hello && !p.mismatch) for (const t of p.tags) out.push(t); return out; };

// freehand spray paint (spray-paint.js): dots [cell, face, u, z, r, colour, seed]. What others spray goes on your walls
// and stays there (paintDots(..., false): kept in your save like your own, till the council scrubs the oldest)
const NET_PAINT_MSG = 1000, NET_PAINT_JOIN = 3000; // dots per message at most; your most recent, sent to someone arriving
function netCheckDots(d, colours) {
  if (!Array.isArray(d)) return [];
  const out = [];
  for (const t of d.slice(0, NET_PAINT_MSG)) {
    if (!Array.isArray(t) || t.length < 7) continue;
    const [cell, face, u, z, r, col, seed] = t;
    if (!Number.isInteger(cell) || cell < 0 || cell >= N * N || !Number.isInteger(face) || face < 0 || face > 3 || !netNum(u) || !netNum(z) || z < 0 || z > 50) continue;
    if (!netNum(r) || r <= 0 || r > 0.05 || !Number.isInteger(col) || col < 0 || col >= colours || !Number.isInteger(seed) || seed < 0 || seed > 1e7) continue;
    out.push([cell, face, worldCoord(u), z, r, col, seed]);
  }
  return out;
}
const netDotKey = d => d[0] + ',' + d[1] + ',' + (+d[2]).toFixed(4) + ',' + (+d[3]).toFixed(4) + ',' + d[6];
const netDotOut = d => [d[0], d[1], +(+d[2]).toFixed(4), +(+d[3]).toFixed(4), +(+d[4]).toFixed(4), d[5], d[6]];

// player against player (shots, hooks, car hits, pickpocketing): only if neither of you is peaceful and they're here
const netCanTouch = s => !net.peaceful && !!s && !s.peaceful && !s.away;
// where someone is right now (as drawn this instant), whether or not this frame's drawn them yet
const netViewOf = p => netSample(p, performance.now() / 1000) || p.view;
// other players out in the street as something a bullet can hit (gun.js's traceShot): standing where they're drawn
const NET_SHOOTABLE = new Set(['walk', 'roof', 'elplat', 'fair']);
function netShotTargets(x, y) {
  if (!net.on || !NET_FEATURES.guns || mode === 'room') return [];
  const out = [];
  for (const p of net.peers.values()) {
    const s = netViewOf(p);
    if (!p.hello || p.mismatch || p.stale || !s || s.rk !== 'out' || s.veh || !netCanTouch(s) || !NET_SHOOTABLE.has(s.mode)) continue;
    if (Math.hypot(rel(s.x - x), rel(s.y - y)) > SHOT_RANGE) continue;
    out.push({ who: p, x: s.x, y: s.y, z: s.z, h: 0.175 });
  }
  return out;
}
const NET_SHOT_HURT = [22, 36];
// another player your lure's passing through (fishing.js's lureHits): on foot in the street, the lure at their body
function netHookTarget(f) {
  if (!net.on || !NET_FEATURES.hooks || mode !== 'walk') return null;
  for (const p of net.peers.values()) {
    const s = netViewOf(p);
    if (!p.hello || p.mismatch || p.stale || !s || s.rk !== 'out' || s.veh || s.sk || !netCanTouch(s) || s.mode !== 'walk') continue;
    if (Math.hypot(rel(s.x - f.x), rel(s.y - f.y)) > HOOK_REACH) continue;
    const h = f.z - s.z; if (h < .005 || h > .2) continue;
    return { netPeer: p.id, name: p.name, x: s.x, y: s.y, hooked: { t: 0, haul: false } };
  }
  return null;
} // what a round from another player takes off you (health's out of 100: three will do)

// ---- smoothing: an update arrives every 80 ms or so, a little early or late; others are drawn NET_DELAY behind the
// newest, between the two updates either side of then, so they glide instead of hopping
function netPushSnap(p, s, now) {
  // Their clock isn't ours. The smallest gap seen between their send time and our arrival time is the best guess at
  // the offset (the fastest delivery); it's let creep up slowly in case their clock runs slow against ours.
  const off = now - s.t;
  p.off = p.off === undefined ? off : Math.min(off, p.off + 0.002);
  s.at = s.t + p.off;
  const snaps = p.snaps;
  if (snaps.length && s.t <= snaps[snaps.length - 1].t) return; // out of order or repeated
  snaps.push(s);
  while (snaps.length > 2 && snaps[1].at < now - NET_DELAY - 1) snaps.shift(); // (a second's worth behind is plenty)
}
const netLerpAngle = (a0, a1, f) => a0 + (mod(a1 - a0 + Math.PI, Math.PI * 2) - Math.PI) * f;
// where someone is drawn at local time `now`: the update before and after (now - NET_DELAY), blended; past the newest,
// held there (no guessing ahead: a held pose reads better than one that overshoots and snaps back)
function netSample(p, now) {
  const snaps = p.snaps;
  if (!snaps.length) return null;
  const t = now - NET_DELAY;
  let k = 0;
  while (k < snaps.length - 1 && snaps[k + 1].at <= t) k++;
  const s0 = snaps[k], s1 = snaps[k + 1];
  if (!s1 || t <= s0.at) return { ...s0 };
  const f = clamp((t - s0.at) / Math.max(1e-3, s1.at - s0.at), 0, 1);
  if (s0.rk !== s1.rk || s0.mode !== s1.mode && (s0.mode === 'room' || s1.mode === 'room')) return { ...(f < 0.5 ? s0 : s1) }; // through a door: no sliding through the wall
  const ddx = rel(s1.x - s0.x), ddy = rel(s1.y - s0.y);
  if (Math.hypot(ddx, ddy) > NET_SNAP) return { ...(f < 0.5 ? s0 : s1) };
  const out = { ...s1, x: worldCoord(s0.x + ddx * f), y: worldCoord(s0.y + ddy * f), z: s0.z + (s1.z - s0.z) * f, a: netLerpAngle(s0.a, s1.a, f) };
  if (s0.cops && s1.cops) out.cops = s1.cops.map(c1 => { // (each officer between their two places, as for the player)
    const c0 = s0.cops.find(c => c.k === c1.k && c.id === c1.id);
    if (!c0) return c1;
    const ex = c1.k === 'room' ? c1.x - c0.x : rel(c1.x - c0.x), ey = c1.k === 'room' ? c1.y - c0.y : rel(c1.y - c0.y);
    if (Math.hypot(ex, ey) > NET_SNAP) return c1;
    return { ...c1, x: c1.k === 'room' ? c0.x + ex * f : worldCoord(c0.x + ex * f), y: c1.k === 'room' ? c0.y + ey * f : worldCoord(c0.y + ey * f), z: c0.z + (c1.z - c0.z) * f, a: netLerpAngle(c0.a, c1.a, f) };
  });
  if (s0.sk && s1.sk) out.sk = { ...s1.sk, yaw: netLerpAngle(s0.sk.yaw, s1.sk.yaw, f), nose: s0.sk.nose + (s1.sk.nose - s0.sk.nose) * f, roll: s0.sk.roll + (s1.sk.roll - s0.sk.roll) * f };
  return out;
}

// ---- rules that stand in for a server: everyone sees the same peers and applies the same rule, so they agree
const netClockOwnerOf = (selfId, peerIds) => [selfId, ...peerIds].sort()[0] === selfId; // the lowest id keeps the time
// a little allowance per sender: `burst` at once, then one every `per` seconds
function netAllow(bucket, now, per, burst) {
  bucket.n = Math.min(burst, (bucket.n ?? burst) + (now - (bucket.t ?? now)) / per);
  bucket.t = now;
  if (bucket.n < 1) return false;
  bucket.n--; return true;
}
// a chat line wrapped for a speech bubble: up to `rows` lines of `width` characters, the last cut short with ...
function netWrap(text, width = 24, rows = 3) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (let w of words) {
    while (w.length > width) { if (line) { lines.push(line); line = ''; } lines.push(w.slice(0, width)); w = w.slice(width); }
    if (!line) line = w; else if (line.length + 1 + w.length <= width) line += ' ' + w; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > rows) { lines.length = rows; lines[rows - 1] = lines[rows - 1].slice(0, width - 3).trimEnd() + '...'; }
  return lines;
}
const netBubbleTime = text => 4 + text.length / 15; // seconds a speech bubble stays up

// Optional appearance fields extend hello without changing older peers' colours.
const PLAYER_STYLE_CHOICES={
 skin:['Porcelain','Light','Warm','Tan','Brown','Deep brown','Dark'],
 hairStyle:['Short','Buzz cut','Long','Bob','Bun','Ponytail','Afro','Bald'],
 hairColour:['Black','Dark brown','Brown','Auburn','Blond','Silver'],
 headwear:['Beanie','Cap','None'],
 shirtStyle:['Long sleeves','T-shirt','Tank top','Jacket'],
 shoes:['White','Black','Brown','Red']
};
const PLAYER_HAIRS=['short','buzz','long','bob','bun','pony','afro','bald'];
const PLAYER_HAIR_COLOURS=[[GRAY,2],[BRICK,4],[BRICK,6],[ORANGE,7],[YEL,11],[GRAY,8]];
function netAppearanceOptions(raw){
 const l=netCheckLook(raw),custom=l.custom===1;
 return {hair:custom?PLAYER_HAIRS[l.hairStyle]:'short',hat:custom?['beanie','cap',null][l.headwear]:'beanie',top:custom?['long','tee','tank','jacket'][l.shirtStyle]:'long',bot:'pants',bw:1,
 col:{hair:custom?PLAYER_HAIR_COLOURS[l.hairColour]:[BRICK,4],skin:custom?FIG_SKINS[l.skin]:[SKIN,11],hat:[NET_COLOURS[l.hat],11],hatD:[NET_COLOURS[l.hat],7],top:[NET_COLOURS[l.top],7],inner:[WHITE,12],bot:[[BLUE,5],[GRAY,3],[BRICK,4]][l.bot],shoe:custom?[[WHITE,13],[GRAY,2],[BRICK,4],[RED,7]][l.shoes]:[WHITE,13],belt:[GRAY,2]}};
}

// A remote witness keeps a returning unit alive even after the suspect goes to jail.
function netPoliceObserved(o){
 if(!net.on)return false;
 for(const p of net.peers.values()){if(!p.hello||p.stale||p.mismatch)continue;const s=netSample(p,netNow());if(s?.rk==='out'&&near(o.x,o.y,s.x,s.y)<MAXD+2)return true;}
 return false;
}
