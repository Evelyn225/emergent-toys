// ---- multiplayer: the connection, other players drawn in the city, chat, the shared clock and the join menu
// (MULTIPLAYER_PLAN.md; the rules and checks are in net-core.js). Players connect straight to each other over WebRTC
// (Trystero, vendored in vendor/trystero.js), so there's no game server. ?net=local swaps in a BroadcastChannel
// transport: two tabs on one machine, no network at all, for development and the browser tests.
const NET_TRYSTERO_URL = './vendor/trystero.js', NET_APP_ID = 'glyphport-ascii-city';
const NET_TRANSPORT = (() => { try { return new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'trystero'; } catch (e) { return 'trystero'; } })();
const NET_TYPES = ['emergency', 'emergencyAct', 'emergencyWater', 'tick', 'hello', 'chat', 'clock', 'bolt', 'tags', 'parked', 'claim', 'claimed', 'ride', 'rideOk', 'rideOut', 'bump', 'paint', 'shot', 'down', 'hook', 'reel', 'unhook', 'runover', 'pickStart', 'pickStop', 'pick', 'picked', 'ballGone', 'dm', 'gift', 'giftAck', 'invite', 'drops', 'dropClaim', 'dropGiven', 'fare', 'homeAction', 'homeState', 'homeReply', 'homeActivity', 'teleport']; // every message kind (Trystero needs them all up front)
const NET_CSS = ['#e66', '#69f', '#6c6', '#f93', '#ee6', '#e6e', '#6ee', '#eee', '#aaa', '#c86']; // NET_COLOURS, as text colours
const NET_STORE = 'asciiCity.net';
try { // ?netfeatures=chat,clock: exactly these switched on (none: all off), to try things out (everyone in the room needs the same)
  const want = new URLSearchParams(location.search).get('netfeatures');
  if (want !== null) { const on = want.split(','); for (const k in NET_FEATURES) NET_FEATURES[k] = on.includes(k); }
} catch (e) { /* no query */ }
const netNow = () => performance.now() / 1000;
const netRandomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

// ---- transports: { selfId, send(type, data, to?), leave(), onJoin(id), onLeave(id), onMessage(type, data, from), onError(text) }
function netLocalTransport(code) {
  const tx = { selfId: netRandomId(), onJoin: null, onLeave: null, onMessage: null, onError: null };
  const ch = new BroadcastChannel('glyphport-net:' + code), seen = new Map();
  const post = (kind, data, to) => { try { ch.postMessage({ kind, from: tx.selfId, to: to || null, data: data ?? null }); } catch (e) { /* closed */ } };
  ch.onmessage = e => {
    const m = e.data;
    if (!m || typeof m.from !== 'string' || m.from === tx.selfId || m.to && m.to !== tx.selfId) return;
    if (m.kind === '~bye') { if (seen.delete(m.from)) tx.onLeave?.(m.from); return; }
    if (!seen.has(m.from)) { seen.set(m.from, netNow()); tx.onJoin?.(m.from); if (m.kind !== '~hi') post('~hi', null, m.from); } // (and say hello back, so they know us)
    seen.set(m.from, netNow());
    if (m.kind[0] !== '~') tx.onMessage?.(m.kind, m.data, m.from);
  };
  const beat = setInterval(() => { // a heartbeat, and anyone not heard from in a while has gone (a closed tab says nothing)
    post('~beat');
    for (const [id, t] of seen) if (netNow() - t > 10) { seen.delete(id); tx.onLeave?.(id); } // (generous: a busy machine starves background tabs' timers)
  }, 1000);
  tx.send = (type, data, to) => post(type, data, to);
  tx.leave = () => { post('~bye'); clearInterval(beat); ch.close(); };
  setTimeout(() => post('~hi'), 0); // (once the handlers are on)
  return tx;
}
async function netTrysteroTransport(code) {
  const { joinRoom, selfId } = await import(NET_TRYSTERO_URL);
  const tx = { selfId, onJoin: null, onLeave: null, onMessage: null, onError: null };
  // the code is the password too: the handshake is encrypted, so nobody else on the public relays can read it
  const room = joinRoom({ appId: NET_APP_ID, password: 'glyphport:' + code }, code, {
    onJoinError: d => tx.onError?.(d && d.error ? String(d.error.message || d.error) : 'a connection failed'),
  });
  const actions = {};
  for (const type of NET_TYPES) {
    const act = room.makeAction(type);
    act.onMessage = (data, meta) => tx.onMessage?.(type, data, meta && meta.peerId);
    actions[type] = act;
  }
  room.onPeerJoin = id => tx.onJoin?.(id);
  room.onPeerLeave = id => tx.onLeave?.(id);
  tx.send = (type, data, to) => { try { Promise.resolve(actions[type].send(data, to ? { target: to } : undefined)).catch(() => {}); } catch (e) { /* not connected yet */ } };
  tx.leave = () => { try { room.leave(); } catch (e) { /* already gone */ } };
  return tx;
}

// ---- joining and leaving
function netLoadPrefs() { try { return JSON.parse(localStorage.getItem(NET_STORE)) || {}; } catch (e) { return {}; } }
function netSavePrefs(p) { try { localStorage.setItem(NET_STORE, JSON.stringify({ ...netLoadPrefs(), ...p })); } catch (e) { /* not kept */ } }
function netStatus(s) { net.status = s; netMenuShow(); }
function netLog(text, who = null, col = '#9ab') { net.chat.push({ who, text, col, t: netNow() }); if (net.chat.length > 60) net.chat.shift(); }
async function netJoin(codeIn, nameIn) {
  if (net.on || net.joining) netLeave();
  const code = netCode(codeIn), name = netClean(nameIn, NET_NAME_MAX) || 'player';
  if (!code) return netStatus('Pick a room code first: letters, numbers and dashes.');
  netSavePrefs({ name });
  net.joining = true; netStatus('Connecting...');
  let tx;
  try { tx = NET_TRANSPORT === 'local' ? netLocalTransport(code) : await netTrysteroTransport(code); }
  catch (e) { net.joining = false; return netStatus('Could not start multiplayer: ' + (e && e.message || e)); }
  if (!net.joining) { tx.leave(); return; } // (left again while it was connecting)
  Object.assign(net, { on: true, joining: false, code, name, selfId: tx.selfId, tx, look: playerAppearance || netLookFor(name), peers: new Map(), clockOwner: true,
    cars: new Map(), mine: new Set(), carN: 0, parkedT: 0, taken: new Map(), claiming: null, riders: new Map(), riderCar: '', ride: null, asking: null, hitT: new Map(), paintOut: [], paintKeys: null, shots: [], hooking: '', hooked: null, peaceful: !!netLoadPrefs().peaceful, knocked: null, picking: null, picked: null, pickCool: new Map(), runT: new Map(), balls: new Map(), ballGone: new Map(), myBallT: 0, myBall: null, gifts: new Map(), invites: new Map(), dropTaken: new Map(), dropsT: 0,
    joinedT: performance.now() / 1000, aloneSaid: false, sendT: 0, clockT: 0, lastBolt: bolt, lastWeather: weather, bubble: null, chatBucket: {} });
  netHomeReset(); netTeleportReset();
  tx.onJoin = netPeerJoined; tx.onLeave = netPeerLeft; tx.onMessage = netReceive;
  tx.onError = text => { netLog('A connection failed (' + text + '). Their network may need a relay server.', null, '#f96'); netMenuShow(); };
  netLog(`You're in room "${code}". Invite friends with the link from the multiplayer menu.`);
  netStatus(`In room "${code}". Waiting for others...`);
}
function netLeave() {
  net.joining = false;
  if (!net.on) return;
  try { net.tx.leave(); } catch (e) { /* gone */ }
  netHomeLeave();
  const was = net.clockOwner,emergencySelfBefore=net.selfId;
  if (mode === 'ride') netEject('You get out.');
  netDropCars();
  if (net.balls.has(netMyBallId())) { const b = net.balls.get(netMyBallId()); ball = b; } // (yours comes back to you where it is)
  net.balls.clear(); net.myBall = null;
  Object.assign(net, { on: false, tx: null, peers: new Map(), clockOwner: true, bubble: null });
  netEmergencyLeft(emergencySelfBefore);
  reindexTags(); // (theirs come off your walls)
  if (!was && NET_FEATURES.clock) wTimer = 60 + Math.random() * 90; // your own weather again
  netLog('You left the room.');
  netStatus('Not connected.');
}
addEventListener('pagehide', () => { if (net.on) net.tx.leave(); });

function netPeerJoined(id) {
  if (!net.on || net.peers.has(id)) return;
  if (net.peers.size >= NET_MAX_PEERS) return; // the room's full: they're not drawn or listened to
  net.peers.set(id, { id, name: '', hello: null, snaps: [], seenT: netNow(), ph: 0, chatBucket: {}, bubble: null });
  net.tx.send('hello', { name: net.name, ver: netBuildId(), look: net.look, ask: true }, id); // (ask: say hello back, even if they never lost sight of us)
  netSendTags(id); // (your tags, for their walls)
  netSendParked(id); // (and where you've left cars)
  netSendEmergency(id);
  netSendDrops(id); // (and what you've put down in the street)
  netSendPaint(sprayDots.slice(-NET_PAINT_JOIN), id); // (and your most recent spray paint)
  netReclock();
}
function netPeerLeft(id) {
  const p = net.peers.get(id);
  if (!p) return;
  netHomePeerLeft(id); netTeleportPeerLeft(id);
  net.peers.delete(id);
  netEmergencyPeerLeft(id);
  if (p.hello) netLog(`${p.name} left.`);
  if (p.tags) reindexTags();
  for (const [gid, g] of [...net.gifts]) if (g.to === id) { net.gifts.delete(gid); netGiftBack(g, 'left'); } // (a gift they never took: yours again)
  net.invites.delete(id);
  for (const b of [...net.balls.values()]) { if (b.owner === id) net.balls.delete(b.id); else if (b.runner === id) { b.runner = ''; b.vx = b.vy = b.vz = 0; } } // (theirs go with them; the rest stop where they are)
  if (net.riders?.delete(id)) netLog(`${p.name} is gone from your car.`);
  netReclock(); netMenuShow();
}
function netReclock() {
  const was = net.clockOwner;
  net.clockOwner = netClockOwnerOf(net.selfId, [...net.peers.keys()]);
  if (NET_FEATURES.clock && net.clockOwner && !was) wTimer = 60 + Math.random() * 90; // you keep the time now: the weather moves on again
  if (net.clockOwner) net.clockT = 0; // (send it straight away)
}
function netReceive(type, data, from) {
  const p = net.peers.get(from);
  if (!net.on || !p) return;
  const now = netNow();
  p.seenT = now;
  if (type === 'hello') {
    const h = netCheckHello(data);
    if (!h) return;
    const first = !p.hello;
    if (data.ask) net.tx.send('hello', { name: net.name, ver: netBuildId(), look: net.look }, from); // (they've only just got us back: introduce ourselves again)
    p.hello = h; p.name = h.name; p.mismatch = h.ver !== netBuildId(); p.figLook = null; p.figSpr = null; p.figS = 0;
    if (first) netLog(p.mismatch ? `${p.name} is on a different version of the game. Both of you refresh the page.` : `${p.name} joined.`, null, p.mismatch ? '#f96' : '#9ab');
    if (net.clockOwner) net.clockT = 0;
    if (p.tags) reindexTags(); // (any that came before their hello)
    netMenuShow(); return;
  }
  if (type === 'tags') { // (may come before their hello: kept, and shown once they've said who they are)
    if (!NET_FEATURES.tags || !netAllow(p.tagBucket ||= {}, now, 0.5, 4)) return;
    const list = netCheckTags(data, designCount);
    if (list) { p.tags = list; reindexTags(); }
    return;
  }
  if (!p.hello || p.mismatch) return;
  if (netEmergencyMessage(type,data,from,p))return;
  if (netCarMessage(type, data, from, p, now)) return;
  if (netGunMessage(type, data, from, p, now)) return;
  if (netCrimeMessage(type, data, from, p, now)) return;
  if (netHomeMessage(type, data, from, p, now) || netTeleportMessage(type, data, from, p, now)) return;
  if (netSocialMessage(type, data, from, p, now)) return;
  if (netHookMessage(type, data, from, p, now)) return;
  if (type === 'paint') { // their spray paint, on your walls (anything you've got already, from them or earlier, isn't doubled)
    if (!NET_FEATURES.paint || !netAllow(p.paintBucket ||= {}, now, 0.05, 12)) return;
    const keys = netPaintKeys(), fresh = netCheckDots(data, SPRAY_COLOURS.length).filter(d => { const k = netDotKey(d); if (keys.has(k)) return false; keys.add(k); return true; });
    if (fresh.length) paintDots(fresh, false);
    return;
  }
  if (type === 'tick') { const s = netCheckTick(data); if (s) { netPushSnap(p, s, now); netReceiveBalls(p, data.balls); } return; }
  if (type === 'ballGone') { const id = data && typeof data.id === 'string' ? data.id : ''; net.balls.delete(id); net.ballGone.set(id, now + 3); if (id === netMyBallId() && ball) { ball = null; net.myBall = null; } return; }
  if (type === 'chat') {
    if (!NET_FEATURES.chat || !netAllow(p.chatBucket, now, 1, 3)) return;
    const text = netClean(data && data.text, NET_CHAT_MAX);
    if (!text) return;
    netLog(text, p.name, NET_CSS[p.hello.look.top]);
    p.bubble = { lines: netWrap(text), until: now + netBubbleTime(text) };
    return;
  }
  // the time and the sky: only from whoever keeps the clock
  if (!NET_FEATURES.clock) return;
  if (from !== [net.selfId, ...net.peers.keys()].sort()[0]) return;
  if (type === 'clock') { const c = netCheckClock(data); if (c) netApplyClock(c); }
  if (type === 'bolt' && data && netNum(data.az) && netNum(data.d) && netNum(data.seed)) bolt = { t: T, az: data.az, d: clamp(data.d, 1, 200), seed: data.seed | 0 };
}
function netApplyClock(c) {
  tod = c.tod; dayNum = c.dayNum; // (both run the same clock between these, so the step is a game minute or two at most)
  if (weather !== c.weather) weather = c.weather;
  seasonShift = c.seasonShift; wTimer = 1e9; weatherDue = 0; // (theirs decides when it changes)
}

// ---- every frame (from main.js, before anything else, paused or not)
function netFrame(t, fromTimer = false) {
  const now = t / 1000, dt = net.lastT ? clamp(now - net.lastT, 0, 0.25) : 0;
  net.lastT = now;
  if (!fromTimer) net.frameT = now;
  if (!net.on) return;
  // The main/background simulation loop advances the clock exactly once. // the shared clock keeps going while you're in a menu, at a cabinet or in another tab
  netEmergencyFrame(dt); netHomeFrame(dt, now, fromTimer); netTeleportFrame(now);
  if ((net.sendT -= dt) <= 0) { net.sendT += 1 / NET_TICK_HZ; if (net.sendT < 0) net.sendT = 1 / NET_TICK_HZ; netSendTick(now); }
  if (netClockShared() && net.clockOwner) {
    if ((net.clockT -= dt) <= 0 || weather !== net.lastWeather) {
      net.clockT = NET_CLOCK_EVERY; net.lastWeather = weather;
      net.tx.send('clock', { tod, dayNum, weather, seasonShift });
    }
    if (bolt && bolt !== net.lastBolt) net.tx.send('bolt', { az: bolt.az, d: bolt.d, seed: bolt.seed });
  }
  net.lastBolt = bolt;
  if (!net.peers.size && !net.aloneSaid && now - net.joinedT > 20) {
    net.aloneSaid = true;
    netLog(`Still nobody here. If a friend joined "${net.code}" too, one of your networks may be blocking the connection.`, null, '#f96');
    netStatus(`In room "${net.code}". Nobody else has connected yet.`);
  }
  // quiet a while: not drawn till they speak again (only the transport says someone has actually gone)
  for (const p of net.peers.values()) p.stale = now - p.seenT > NET_TIMEOUT;
  if (net.paintOut.length) { netSendPaint(net.paintOut); net.paintOut = []; } // (the strokes you've sprayed since the last frame)
  if (NET_FEATURES.cars) {
    if ((net.parkedT -= dt) <= 0) { net.parkedT = 1; netSendParked(); }
    if (net.claiming && now - net.claiming.t > 4) { net.claiming = null; say('Nothing. It won\'t open.', 2); }
    if (net.asking && now - net.asking.t > 4) { net.asking = null; say('No answer from the driver.', 2); }
    if (net.riders.size && wanted.busted) { // busted at the wheel: they pull your passengers out too
      for (const id of net.riders.keys()) net.tx.send('rideOut', { id: net.riderCar, why: 'busted' }, id);
      net.riders.clear();
    }
    if (net.riders.size && netMyVehicleId() !== net.riderCar) { // out of the car, boat or aircraft (or in another): your passengers get out too
      for (const id of net.riders.keys()) net.tx.send('rideOut', { id: net.riderCar, why: 'parked' }, id);
      net.riders.clear();
    }
  }
  netSyncCars(now);
  netPeeFrame(dt);
  netKnockFrame(dt); netPickFrame(dt); netBallFrame(dt, now); netGiftFrame(now);
  if (NET_FEATURES.gifts && (net.dropsT -= dt) <= 0) { net.dropsT = 1; netSendDrops(); }
  for (const [id, t] of net.dropTaken) if (now > t) net.dropTaken.delete(id);
  if (netPlayersOpen() && (netPlayersT -= dt) <= 0) { netPlayersT = 0.5; netPlayersShow(); } // (the list: where everyone is now)
  if (mode === 'ride') netRideStep();
  netHookFrame(dt);
}
// A tab in the background (or a window covered up, in some browsers) gets no animation frames, so the loop stops: keep
// sending and listening on a timer meanwhile (otherwise you'd freeze for everyone, and if you keep the clock, so would the time)
function netBackgroundTick(){
  const now=performance.now();if(!net.on||now/1000-(net.frameT||0)<=.4)return;
  // Catch up in normal 50 ms physics steps; draw only the final step. This also
  // lets a hidden/paused airborne player land instead of hovering for everyone.
  t0=Math.max(t0,now-250);
  while(t0<now-1)loop(Math.min(now,t0+50),true,now-t0<=50);
}
setInterval(()=>netBackgroundTick(),250);
// you, as others see you
function netSelfZ() {
  try {
    if (mode === 'room') return typeof stairRise === 'function' ? stairRise(px, py) : 0;
    if (mode === 'roof') return roofH;
    if (mode === 'elplat' || mode === 'el') return EL_TOP;
    if (mode === 'ferry') return ferryGround();
    if ((mode === 'drive' || mode === 'taxi') && me) return roadGroundHeight(me.x, me.y);
    if (skatingNow()) return skateGround(px, py) + Math.max(0, body.z) / 10;
    return walkGround(px, py) + Math.max(0, body.z) / 10;
  } catch (e) { return 0; }
}
function netSelfPose(speed) {
  if (skatingNow()) return skateAir() ? 'skateair' : SK.charge >= 0 ? 'crouch' : SK.kicking ? 'push' + (Math.floor(SK.kick * 8) & 7) : 'ride' + Math.round(1 + clamp(SK.steer * SK.stance, -1, 1)); // (as skate.js draws you)
  if (net.hooked) return net.hooked.haul ? 'walk' + (Math.floor(T * 10) & 7) : fract(T * 1.5) < .5 ? 'gasp' : 'stand'; // (on someone's line: digging in, or staggering in)
  if (body.seat) return 'sit';
  if (heldGun() && gunAim() > 0.5) return 'aim';
  if (body.crouch > 0.5) return 'crouch';
  const [run, walk] = mode === 'room' ? [2, 0.3] : [0.65, 0.05];
  return speed > run ? 'run' : speed > walk ? 'walk' : 'stand';
}
function netSendTick(now) {
  const car = (mode === 'drive' || mode === 'taxi') && me ? me : null, plane = mode === 'air' && pilot ? pilot : null, helm = mode === 'sea' && sea ? sea : null;
  const x = car ? car.x : plane ? plane.x : helm ? helm.x : px, y = car ? car.y : plane ? plane.y : helm ? helm.y : py;
  const a_ = car ? Math.atan2(car.hy, car.hx) : plane ? plane.yaw : helm ? Math.atan2(helm.hy, helm.hx) : a;
  const last = net.lastSent, gap = last ? now - last.t : 0;
  const speed = last && gap > 0 && last.rk === netRoomKey() ? Math.hypot(rel(x - last.x), rel(y - last.y)) / gap : 0;
  const it = heldItem();
  const loc = mapPlayerLocation();
  const s = { loc: { ...loc, inside: mode === 'room' }, t: now, x, y, z: netSelfZ(), a: a_, mode, rk: netRoomKey(), pose: netSelfPose(speed), held: it ? it.id : '', stars: wanted.stars | 0 };
  if(game?.g.id==='cook'||game?.kind==='workshop')s.pose='reach';
  if (netAway()) s.away = true;
  if (net.peaceful) s.peaceful = true;
  if (NET_FEATURES.balls) { const bs = netMyBalls(now); if (bs.length) s.balls = bs; }
  if (net.knocked) s.pose = 'down';
  if (plane) { s.z = plane.z; s.craft = { k: 'air', kind: plane.type, yaw: plane.yaw, pitch: plane.pitch, roll: plane.roll, rotor: plane.rotor || 0 }; }
  if (helm) s.craft = { k: 'sea', kind: helm.kind, col: helm.col ?? WHITE, v: helm.v || 0 };
  if (mode === 'boat') s.craft = { k: 'swan' };
  if (mode === 'ride' && net.ride) s.ride = net.ride.id;
  if (pee) s.pee = { el: clamp(Math.atan(pitch * rows / projY) + 0.55, -1.3, 1.3), flow: Math.min(1, 0.35 + pee.t * 1.6) * Math.min(1, Math.max(0, pee.left) / 1.4), loo: pee.loo || null }; // (as peeSpray aims it, pee.js)
  if (heldItem()?.id === 'spraypaint' && usingHeldItem() && onFootMode()) { s.spray = { col: sprayColourOf(heldItem()) }; s.pose = 'reach'; } // (holding Q with the can: spraying, spray-paint.js)
  if (fishing && fishing.st !== 'wind' && netNum(fishing.x)) s.fish = { x: fishing.x, y: fishing.y, z: fishing.z };
  if (skatingNow() && SK.bailAt) { // fallen off the board: as skate-bails.js draws you
    const B = SK.bailData, age = B ? T - B.t0 : 0;
    s.x = SK.bailAt[0]; s.y = SK.bailAt[1]; s.a = SK.bailAt[2]; s.z = skateGround(s.x, s.y);
    s.pose = 'tumble' + clamp(age < .35 ? Math.floor(age / .35 * 3) : SK.bail > .5 ? 3 : 4 + Math.floor((.5 - SK.bail) / .5 * 4), 0, 7);
    s.sk = B ? { yaw: B.yaw, nose: 0, roll: B.roll, st: 1, bx: B.board[0], by: B.board[1], bz: B.board[2] } : { yaw: s.a, nose: 0, roll: 0, st: 1 };
  }
  if (NET_FEATURES.police && wanted.stars > 0) s.cops = netMyCops();
  if (skatingNow() && !car && !SK.bailAt) s.sk = { yaw: SKB.yaw, nose: SKB.pitch, roll: SKB.roll, st: SK.stance };
  if (car) s.veh = { shift: !!(job && car.body === TAXI && mode === 'drive'), id: mode === 'drive' && NET_FEATURES.cars ? netMyCarId(car) : '', kind: car.kind, body: car.body, v: car.v, brake: !!car.brake, dmg: car.dmg || 0, patrol: !!car.patrol, ev: !!car.ev, siren:!!car.siren };
  net.lastSent = s;
  net.tx.send('tick', s);
}

// ---- shared cars. A car you've driven is yours to share: while you drive it, it's in your updates; once you leave it
// parked, it's in a list you send each second. Everyone else has a stand-in for it in their own traffic (remote: true,
// see playerCar in core.js): the traffic steers round it, your car can hit it, a bullet can. To take one someone's
// left parked, you ask them, and their game hands it over and drops it from their city, so it's never in two places.
// One they bought stays locked.
function netMyCarId(c) {
  if (!c.netId) c.netId = net.selfId + ':' + (++net.carN);
  net.mine.add(c);
  return c.netId;
}
function netMyParked() {
  for (const c of net.mine) if (!cars.includes(c) || !c.parked && !c.player) { net.mine.delete(c); delete c.netId; } // (towed, or back in the traffic)
  const d = c => Math.hypot(rel(c.x - px), rel(c.y - py));
  return [...net.mine].filter(c => c.parked && !c.player).sort((p, q) => d(p) - d(q)).slice(0, NET_PARKED_MAX);
}
function netSendParked(to) {
  if (!net.on || !NET_FEATURES.cars) return;
  net.tx.send('parked', netMyParked().map(c => ({ id: c.netId, kind: c.kind, body: c.body, x: c.x, y: c.y, a: Math.atan2(c.hy, c.hx), dmg: c.dmg || 0,
    wrecked: !!c.wrecked || c.fireT != null, locked: !!c.owned, patrol: !!c.patrol, ev: !!c.ev })), to);
}
// every frame: the stand-ins match what everyone's told us (made, moved, or gone)
function netSyncCars(now) {
  const want = new Map();
  if (NET_FEATURES.cars) for (const p of net.peers.values()) {
    if (!p.hello || p.mismatch) continue;
    for (const c of p.parked || []) if (!net.taken.has(c.id)) want.set(c.id, { ...c, owner: p.id, parked: true, v: 0, brake: true });
    if (p.stale) continue;
    const s = netSample(p, now);
    if (s && s.veh && s.veh.id && s.rk === 'out' && VEHICLES[s.veh.kind]) want.set(s.veh.id, { ...s.veh, x: s.x, y: s.y, a: s.a, owner: p.id, parked: false });
    if (s && s.cops && NET_FEATURES.police) for (const c of s.cops) if (c.k === 'car' && VEHICLES[c.kind]) // (the cruisers after them: lights and siren, but not after you)
      want.set('cop:' + p.id + ':' + c.id, { kind: c.kind, body: c.body, x: c.x, y: c.y, a: c.a, v: c.v, owner: p.id, parked: false, patrol: true, cop: true });
  }
  for (const c of [...net.cars.values()]) if (!want.has(c.netId)) netDropCar(c);
  for (const [id, w] of want) {
    let c = net.cars.get(id);
    if (!c) { c = { id: ++carId, remote: true, netId: id, path: [], last: [0, 0], off: 0 }; net.cars.set(id, c); cars.push(c); }
    Object.assign(c, { owner: w.owner, kind: w.kind, body: w.body, x: w.x, y: w.y, ex: w.x, ey: w.y, hx: Math.cos(w.a), hy: Math.sin(w.a), v: w.v || 0,
      brake: !!w.brake, dmg: w.dmg || 0, wrecked: !!w.wrecked, locked: !!w.locked, parked: !!w.parked, patrol: !!w.patrol, ev: !!w.ev, cop: !!w.cop,
      state: w.cop||w.ev&&w.siren ? 'out' : undefined }); // (out on a call: lights and siren, traffic.js's code(); never pursuit, which would make it one of yours)
  }
  for (const [id, t] of net.taken) if (now > t) net.taken.delete(id);
}
function netDropCar(c) {
  if (mode === 'ride' && me === c) netEject(net.peers.has(c.owner) ? 'The car pulls away without you.' : 'The driver\'s gone. You climb out.');
  net.cars.delete(c.netId);
  const k = cars.indexOf(c);
  if (k >= 0) cars.splice(k, 1);
}
function netDropCars() { if (net.cars) for (const c of [...net.cars.values()]) netDropCar(c); }
const netCarNear = (r = 0.5) => { let best = null, bd = r; if (net.on && net.cars) for (const c of net.cars.values()) { if (c.cop) continue; const d = Math.hypot(rel(c.x - px), rel(c.y - py)); if (d < bd) { bd = d; best = c; } } return best; };
const netOwnerName = c => net.peers.get(c.owner)?.name || 'someone';
function netCarPrompt() { // (hud.js, for E)
  const c = mode === 'walk' && NET_FEATURES.cars ? netCarNear() : null;
  if (!c) return '';
  if (!c.parked) return c.v < 0.6 && !c.wrecked ? `E: ride with ${netOwnerName(c)}` : '';
  return c.locked ? `${netOwnerName(c)}'s car (locked)` : c.wrecked ? `${netOwnerName(c)}'s car (a wreck)` : `E: take ${netOwnerName(c)}'s car`;
}
function netCarUse() { // (actions.js, on E: true if it was about another player's car)
  const c = mode === 'walk' && NET_FEATURES.cars ? netCarNear() : null;
  if (!c) return false;
  if (!c.parked) return netAskRide(c), true;
  if (c.locked) return say(`That's ${netOwnerName(c)}'s car. It's locked.`, 3), true;
  if (c.wrecked) return say('It\'s a wreck. Nobody\'s driving that anywhere.', 3), true;
  if (net.claiming) return true;
  net.claiming = { id: c.netId, t: netNow() };
  net.tx.send('claim', { id: c.netId }, c.owner);
  return true;
}
// your car (or your bullet) hurt one of theirs: tell them, and they dent it (damageCar sends it here, damage.js)
function netHurtCar(c, n) {
  if (!net.on || !c.owner || !c.netId || c.cop) return; // (their police car: it shrugs it off, as far as you can tell)
  const at = me && me !== c ? me : { x: px, y: py }, dx = rel(c.x - at.x), dy = rel(c.y - at.y), d = Math.hypot(dx, dy) || 1;
  const crash = mode === 'drive' && !!me && Math.hypot(rel(me.x - c.x), rel(me.y - c.y)) < 0.7;
  if (crash) net.hitT.set(c.owner, netNow());
  net.tx.send('bump', { id: c.netId, dmg: Math.min(n, 100), dx: dx / d, dy: dy / d, crash }, c.owner);
}

// ---- riding with someone: in their car, their boat, their swan or their aircraft. You ask; their game says yes if
// there's a seat; you're carried along with it (mode 'ride'), looking about with the mouse; E gets you out (or, up in
// the air, out with a parachute). Riding with someone on a taxi shift, you pay the fare when you get out.
const NET_CRAFT_RE = /^craft:[A-Za-z0-9_-]{1,40}:(sea|air|swan)$/;
const netRideId = v => netCarId(v) || (typeof v === 'string' && NET_CRAFT_RE.test(v) ? v : '');
const netSeats = kind => kind === 'car' || kind === 'taxi' ? 3 : 1; // (behind the driver: the front seat and two in the back)
function netMyVehicleId() { // what you're at the controls of, as riders name it
  if (mode === 'drive' && me) return netMyCarId(me);
  if (mode === 'sea' && sea) return 'craft:' + net.selfId + ':sea';
  if (mode === 'air' && pilot) return 'craft:' + net.selfId + ':air';
  if (mode === 'boat') return 'craft:' + net.selfId + ':swan';
  return '';
}
function netMySeats() { return mode === 'drive' && me ? netSeats(me.kind) : mode === 'sea' ? 3 : mode === 'air' && pilot ? (PLANE_TYPES[pilot.type]?.heli ? 3 : 2) : mode === 'boat' ? 1 : 0; }
function netFreeSeat() { const n = netMySeats(), used = new Set(net.riders.values()); for (let k = 1; k <= n; k++) if (!used.has(k)) return k; return 0; }
function netAskRide(c) {
  if (c.v >= 0.6) return say('Not while it\'s moving.', 2);
  if (c.wrecked) return say('It\'s a wreck.', 2);
  if (net.asking) return;
  net.asking = { id: c.netId, t: netNow() };
  net.tx.send('ride', { id: c.netId }, c.owner);
  say(`You knock on ${netOwnerName(c)}'s window...`, 2);
}
// someone's boat, swan or aircraft, close enough to climb into and stopped (an aircraft: down on the ground beside you)
function netCraftNear() {
  if (!net.on || mode !== 'walk' || !NET_FEATURES.cars) return null;
  for (const p of net.peers.values()) {
    const s = netViewOf(p), c = s && s.craft;
    if (!p.hello || p.mismatch || p.stale || !c || s.rk !== 'out') continue;
    const d = Math.hypot(rel(s.x - px), rel(s.y - py)), reach = c.k === 'sea' ? (BOAT_KINDS[c.kind]?.hl || 0.15) + 0.25 : c.k === 'air' ? 0.5 : 0.3;
    if (d > reach) continue;
    const stopped = c.k === 'air' ? Math.abs(s.z - netSelfZ()) < 0.15 : Math.abs(c.v || 0) < 0.3;
    return { p, s, k: c.k, stopped, what: c.k === 'sea' ? 'boat' : c.k === 'air' ? (PLANE_TYPES[c.kind]?.heli ? 'helicopter' : 'plane') : 'swan' };
  }
  return null;
}
function netCraftPrompt() { const n = netCraftNear(); return n ? (n.stopped ? `E: ride in ${n.p.name}'s ${n.what}` : `${n.p.name}'s ${n.what}`) : ''; }
function netCraftUse() {
  const n = netCraftNear();
  if (!n) return false;
  if (!n.stopped) return say(n.k === 'air' ? 'Not while it\'s up there.' : 'Not while it\'s moving.', 2), true;
  if (net.asking) return true;
  const id = 'craft:' + n.p.id + ':' + n.k;
  net.asking = { id, t: netNow() };
  net.tx.send('ride', { id }, n.p.id);
  say(`You wave to ${n.p.name}...`, 2);
  return true;
}
const NET_SEAT_AT = [null, [0.02, 0.045], [-0.08, -0.045], [-0.08, 0.045]]; // seat: [forward, right] of the car's middle
function netRideStep() {
  const R_ = net.ride;
  if (R_ && R_.craft) { // in their boat, swan or aircraft
    const p = net.peers.get(R_.peer), s = p && netViewOf(p);
    if (!s || !s.craft || s.craft.k !== R_.craft) return netEject(p ? `${p.name} is off without you.` : 'They\'re gone. You climb out.');
    const back = R_.craft === 'air' ? 0.06 * R_.seat : R_.craft === 'sea' ? 0.04 * R_.seat : 0.03, side = R_.seat === 2 ? -0.03 : R_.seat === 3 ? 0.03 : 0;
    const hx = Math.cos(s.a), hy = Math.sin(s.a);
    px = worldCoord(s.x - hx * back - hy * side); py = worldCoord(s.y - hy * back + hx * side);
    R_.z = s.z; a = s.a + look;
    return;
  }
  const c = R_ && net.cars.get(R_.id);
  if (!c) return netEject('The car pulls away without you.');
  if (c.wrecked) return netEject('You scramble out of the wreck.');
  const [f, r] = NET_SEAT_AT[R_.seat] || NET_SEAT_AT[1], yaw = carYaw(c);
  const ox = px, oy = py;
  px = worldCoord(c.x + c.hx * f - c.hy * r); py = worldCoord(c.y + c.hy * f + c.hx * r);
  if (R_.lastX !== undefined) R_.dist += Math.min(1, Math.hypot(rel(px - ox), rel(py - oy))); // (how far, for a fare)
  R_.lastX = px;
  a = yaw + look; // (where the car's pointing, and wherever you're looking)
}
function netRideEye() { // (render.js: how high your eye is, riding in a boat or an aircraft; null in a car)
  const R_ = net.ride;
  if (mode !== 'ride' || !R_ || !R_.craft) return null;
  if (R_.craft === 'air') return (R_.z || 0) + 0.14;
  if (R_.craft === 'sea') { const p = net.peers.get(R_.peer), k = p && netViewOf(p)?.craft?.kind; return (BOAT_KINDS[k]?.fb ?? 0.05) + 0.12; }
  return 0.11;
}
function netLandNear(x, y, r) { // a spot of dry, open ground within r (cells) of (x, y), nearest first
  for (let d = 0; d <= r; d += 0.05) for (let k = 0; k < 16; k++) {
    const an = k / 16 * Math.PI * 2, nx = worldCoord(x + Math.cos(an) * d), ny = worldCoord(y + Math.sin(an) * d);
    if (!isWater(nx, ny) && free(nx, ny)) return [nx, ny];
  }
  return null;
}
function netEject(text) {
  const c = me, R_ = net.ride;
  if (c && !(R_ && R_.craft)) { c.rider = false; try { [px, py] = exitSpot(c); } catch (e) { /* stay put */ } a = Math.atan2(c.hy, c.hx); }
  me = null; mode = 'walk'; look = 0; net.ride = null;
  if (R_ && R_.craft === 'air' && (R_.z || 0) - walkGround(px, py) > 0.3) { // up in the air: out you go, with a parachute
    body.z = Math.max(0.5, (R_.z - walkGround(px, py)) * 10 - 1); body.vz = 0; body.seat = null; chute = { open: false, t: 0 };
    return say((text ? text + ' ' : '') + 'You jump. SPACE: pull the cord!', 4);
  }
  if (R_ && R_.craft && (isWater(px, py) || !free(px, py))) { const at = netLandNear(px, py, 3); if (at) [px, py] = at; } // (off a boat: onto the nearest dry ground)
  if (text) say(text, 3);
}
function netPayFare() { // (out of a taxi on someone's shift: what the meter says, or what you've got)
  const R_ = net.ride, c = R_ && net.cars.get(R_.id), p = c && net.peers.get(c.owner), s = p && netViewOf(p);
  if (!c || !s || !s.veh || !s.veh.shift || !(R_.dist > 0.2)) return;
  const fare = Math.min(money, Math.round(taxiFare(R_.dist) * 100) / 100);
  if (fare <= 0) return say('You can\'t pay the fare. You get a look.', 3);
  pay(fare); net.tx.send('fare', { cash: fare }, c.owner);
  say(`Fare: ${fmt$(fare)}. ${p.name} thanks you.`, 3);
}
function netGetOut() {
  if (mode !== 'ride' || !net.ride) return;
  const R_ = net.ride;
  if (R_.craft) {
    const p = net.peers.get(R_.peer), s = p && netViewOf(p);
    if (R_.craft !== 'air' && !netLandNear(px, py, 0.6)) return say('Not out here. Wait till they pull in to the side.', 2);
    if (p) net.tx.send('rideOut', { id: R_.id }, p.id);
    return netEject(R_.craft === 'air' && s && s.z - walkGround(px, py) > 0.3 ? '' : 'You climb out.');
  }
  const c = net.cars.get(R_.id);
  if (c && c.v > 0.6) return say('Not at this speed.', 2);
  if (c) { netPayFare(); net.tx.send('rideOut', { id: R_.id }, c.owner); }
  netEject('You get out.');
}
const netRidePrompt = () => {
  const R_ = net.ride;
  if (R_ && R_.craft) { const p = net.peers.get(R_.peer); return p ? `With ${p.name}. E: ${R_.craft === 'air' ? 'get out (in the air: jump)' : 'get out (near land)'}` : ''; }
  const c = R_ && net.cars.get(R_.id);
  return c ? `In ${netOwnerName(c)}'s car. ` + (c.v > 0.6 ? 'V: camera' : 'E: get out   V: camera') : '';
};

// the car messages (true if it was one)
function netCarMessage(type, data, from, p, now) {
  if (!['parked', 'claim', 'claimed', 'ride', 'rideOk', 'rideOut', 'bump', 'fare'].includes(type)) return false;
  if (!NET_FEATURES.cars) return true;
  if (type === 'parked') { if (netAllow(p.parkedBucket ||= {}, now, 0.5, 4)) p.parked = netCheckParked(data) || []; return true; }
  const id = netRideId(data && data.id);
  if (type === 'fare') { if (data && netNum(data.cash) && data.cash > 0 && net.riders.has(from)) { const cash = Math.min(data.cash, 500); earn(cash); if (job) job.earned = (job.earned || 0) + cash; netLog(`${p.name} pays the fare: ${fmt$(cash)}.`, null, '#9e9'); } return true; }
  if (type === 'claim') { // someone wants a car you left: theirs, if it's still there and not one you bought
    const c = [...net.mine].find(c => c.netId === id);
    const ok = !!c && c.parked && !c.player && !c.owned && !c.wrecked && c.fireT == null && cars.includes(c);
    if (ok) { cars.splice(cars.indexOf(c), 1); net.mine.delete(c); delete c.netId; netSendParked(); netLog(`${p.name} drove off in the car you left.`); }
    net.tx.send('claimed', { id, ok }, from);
    return true;
  }
  if (type === 'bump') { // you hit (or shot) one of their cars, or they did one of yours: the damage is the owner's to take
    if (!netAllow(p.bumpBucket ||= {}, now, 0.3, 4) || !data || !netNum(data.dmg)) return true;
    const c = [...net.mine].find(c => c.netId === id);
    if (!c || !cars.includes(c)) return true;
    if (c.player && now - (net.hitT.get(from) ?? -9) < 0.6) return true; // (you were both driving and both felt it: yours already counted it)
    damageCar(c, clamp(data.dmg, 0, 100));
    if (c.player) { // at the wheel: knocked, and slowed
      const dx = netNum(data.dx) ? clamp(data.dx, -1, 1) : 0, dy = netNum(data.dy) ? clamp(data.dy, -1, 1) : 0, nx = worldCoord(c.x + dx * 0.04), ny = worldCoord(c.y + dy * 0.04);
      if (free(nx, ny)) { c.x = nx; c.y = ny; c.ex = nx; c.ey = ny; px = nx; py = ny; }
      c.v *= 0.4;
      if (data.crash) { say('*CRUNCH*', 1); if (actx) playClip('crash', 0.5); }
    }
    return true;
  }
  if (type === 'ride') { // someone wants a lift: in, if you're driving the car they mean and there's a seat
    if (net.riders.size && netMyVehicleId() !== net.riderCar) net.riders.clear(); // (riders from what you were in before)
    const seat = netFreeSeat(), ok = !!id && netMyVehicleId() === id && seat > 0 && !net.riders.has(from);
    if (ok) { net.riders.set(from, seat); net.riderCar = id; netLog(`${p.name} got in.`); }
    net.tx.send('rideOk', { id, ok, seat }, from);
    return true;
  }
  if (type === 'rideOk') {
    if (!net.asking || net.asking.id !== id) return true;
    net.asking = null;
    const craft = id.startsWith('craft:') ? id.slice(id.lastIndexOf(':') + 1) : '', c = craft ? null : net.cars.get(id);
    if (!data.ok || !craft && !c) return say(data.ok ? 'They drove off.' : 'No room in there.', 2), true;
    const s = craft && netViewOf(p), far = craft ? !s || Math.hypot(rel(s.x - px), rel(s.y - py)) > 0.8 : Math.hypot(rel(c.x - px), rel(c.y - py)) > 0.8;
    if (mode !== 'walk' || far) { net.tx.send('rideOut', { id }, from); return true; } // (walked off meanwhile)
    body.seat = null; fx.skating = false;
    if (craft) { me = null; mode = 'ride'; look = 0; pitch = 0; net.ride = { id, craft, peer: from, seat: clamp(data.seat | 0, 1, 3) }; }
    else { me = c; c.rider = true; mode = 'ride'; look = 0; pitch = 0; camYaw = carYaw(c); net.ride = { id, seat: clamp(data.seat | 0, 1, 3), dist: 0 }; }
    netRideStep();
    say(`You climb in with ${p.name}. E: get out`, 3);
    return true;
  }
  if (type === 'rideOut') {
    if (net.riders.get(from) !== undefined && id === net.riderCar) { net.riders.delete(from); netLog(`${p.name} got out.`); return true; } // (a passenger, getting out)
    if (mode === 'ride' && net.ride && net.ride.id === id) {
      if (data.why === 'busted') { netEject(`The police drag ${p.name} out of the car, and you with them. You run.`); if (NET_FEATURES.police) addWanted('accomplice', px, py, true); }
      else { if (data.why === 'parked') netPayFare(); netEject(data.why === 'parked' ? `${p.name} ${net.ride?.craft ? 'is done.' : 'parks up.'} You get out.` : 'You get out.'); } // (the driver's done)
    }
    return true;
  }
  if (type === 'claimed') {
    if (!net.claiming || net.claiming.id !== id) return true;
    net.claiming = null;
    const c = net.cars.get(id);
    if (!data.ok || !c) return say('It won\'t open.', 2), true;
    net.cars.delete(id); net.taken.set(id, now + 5); // (theirs no longer: till their list catches up, don't make it again)
    if (p.parked) p.parked = p.parked.filter(x => x.id !== id);
    delete c.remote; delete c.owner; delete c.netId; c.locked = false;
    if (mode !== 'walk' || Math.hypot(rel(c.x - px), rel(c.y - py)) > 0.8) { c.parked = true; return true; } // (walked off meanwhile: it's left there, yours to take)
    me = c; mode = 'drive'; c.player = true; c.parked = false; c.v = 0; a = Math.atan2(c.hy, c.hx); c.travelA = a; look = 0;
    say(`You get into ${p.name}'s car.`, 2);
    return true;
  }
  return true;
}

// ---- guns: your shot goes to everyone (fireGun calls netShotFired): they see the streak and hear it, the street round
// it scatters on their screens too, and if it hit someone, that player's game takes the damage, as a police round
// would (gun.js, gun-ui.js). Unless they've switched friendly fire off for themselves (the multiplayer menu).
function netShotFired(shot, indoors) {
  if (!net.on || !NET_FEATURES.guns) return;
  const target = shot.what === 'player' && shot.who ? (shot.who.netPeer || shot.who.id) : '';
  net.tx.send('shot', { x0: shot.x0, y0: shot.y0, z0: shot.z0, x: shot.x, y: shot.y, z: shot.z, what: shot.what, target, rk: netRoomKey(), indoors: !!indoors });
}
function netRoomShotTargets() { // (gun-ui.js's traceRoomShot: who's in this room with you, as something to hit)
  if (!net.on || !NET_FEATURES.guns || mode !== 'room') return [];
  const out = [], rk = netRoomKey();
  for (const p of net.peers.values()) {
    const s = netViewOf(p);
    if (p.hello && !p.mismatch && !p.stale && s && !s.away && s.rk === rk && s.mode === 'room') out.push({ x: s.x, y: s.y, z: s.z, h: 1.8, fig: true, netPeer: p.id, name: p.name });
  }
  return out;
}
function netGunMessage(type, data, from, p, now) {
  if (type !== 'shot' && type !== 'down') return false;
  if (!NET_FEATURES.guns || !data) return true;
  if (type === 'shot') {
    if (!netAllow(p.shotBucket ||= {}, now, FIRE_GAP * 0.8, 3)) return true;
    const ok = ['x0', 'y0', 'z0', 'x', 'y', 'z'].every(k => netNum(data[k]));
    if (!ok || data.rk !== netRoomKey()) return true; // (somewhere else: out of earshot, as far as this goes)
    const inside = mode === 'room';
    if(inside)panicInRoom('gunfire',false);else panicAt(data.x0,data.y0);
    if (data.target === net.selfId && !net.peaceful && !sleep && !wakeT && !netAway()) { // you: hit
      gun.copShots.push({ x: data.x0, y: data.y0, hit: true, t: T, room: inside, side: Math.random() < 0.5 ? -1 : 1 }); // (the bang, the flash at them, "you're hit": gun-ui.js)
      needs.health = Math.max(0, needs.health - (NET_SHOT_HURT[0] + Math.random() * (NET_SHOT_HURT[1] - NET_SHOT_HURT[0])));
      gun.hurtT = T;
      if (needs.health <= 0) netShotDown(p);
      return true;
    }
    if (actx) { // somebody else's: heard from where it was fired
      const d = inside ? Math.hypot(data.x0 - px, data.y0 - py) / 10 : Math.hypot(rel(data.x0 - px), rel(data.y0 - py)), side = inside ? 0 : Math.sin(Math.atan2(rel(data.y0 - py), rel(data.x0 - px)) - a);
      gunBang(actx.currentTime, clamp(1.1 - d / 9, 0.15, 0.9), clamp(side, -0.8, 0.8), inside ? 'in' : d > 3 ? 'far' : '');
    }
    if (!inside) { net.shots.push({ x0: data.x0, y0: data.y0, z0: data.z0, x: data.x, y: data.y, z: data.z, what: data.what, t: T }); }
    if (net.shots.length > 24) net.shots.shift();
    return true;
  }
  // somebody's gone down: shot by whoever (by), where they fell. You see them lie there a few seconds
  if (!netNum(data.x) || !netNum(data.y) || !netNum(data.z) || !netNum(data.a)) return true;
  p.fallen = { x: data.x, y: data.y, z: data.z, a: data.a, rk: typeof data.rk === 'string' ? data.rk : 'out', until: now + 6 };
  const by = data.by === net.selfId ? 'you' : net.peers.get(data.by)?.name || 'someone', car = data.cause === 'car';
  netLog(car ? `${p.name} went down, hit by ${by === 'you' ? 'your' : by + "'s"} car.` : `${p.name} went down, shot by ${by}.`, null, '#f96');
  if (data.by === net.selfId) { const [cx, cy] = crimePos(); if (car) crime('roadkill', cx, cy); else gunCrime('shotdown', cx, cy); }
  return true;
}
// your health's gone: down where you stand for everyone, and you come to in the hospital (as after the police shoot you,
// but they keep nothing: it wasn't them)
function netShotDown(by, cause = 'shot') {
  net.knocked = null;
  net.tx.send('down', { by: by.id, x: px, y: py, z: netSelfZ(), a, rk: netRoomKey(), cause });
  passOut(cause === 'car' ? `Hit by a car. ${by.name} was driving, they say.` : `Gunshot wounds. Someone called ${by.name} did this, they say.`);
}
function netDrawShots() { // (gun-ui.js's drawShots: their shots, a streak from them to where it stopped)
  if (!net.on) return;
  for (const s of net.shots) {
    const age = T - s.t;
    if (age > 0.09 || age < 0) continue;
    const p0 = fishProj(rel(s.x0 - px), rel(s.y0 - py), s.z0 - 0.02), p1 = fishProj(rel(s.x - px), rel(s.y - py), s.z);
    if (p0 && p1) fishSeg(p0, p1, C(age < .04 ? WHITE : YEL, 15), true);
    if (p0) fishSurface(p0.c, p0.r, p0.depth, C(YEL, 15)); // (the flash at the gun)
    if (p1 && (s.what === 'wall' || s.what === 'ground' || s.what === 'car')) fishSurface(p1.c, p1.r, p1.depth, C(s.what === 'car' ? YEL : WHITE, 14));
  }
}

// ---- rod hooks: your cast catches another player by the coat (fishing.js asks netHookTarget, then netHookPeer). From
// then on they're on your line in their own game: held there, and they can work it loose (Space or E, over and over);
// once you reel, their game walks them in to you, snagging on a corner as anyone would. Either side lets go if the
// other's gone, gets in a car, goes indoors or the line's out too far.
const NET_HOOK_SLACK = 6; // seconds hooked and not reeled before the hook works itself loose
function netHookPeer(f, who) {
  Object.assign(f, { st: 'hooked', t: 0, who, x: who.x, y: who.y, z: walkGround(who.x, who.y) + .11, d: Math.max(f.d, Math.hypot(rel(who.x - px), rel(who.y - py)) + .1) });
  net.hooking = who.netPeer;
  net.tx.send('hook', {}, who.netPeer);
  fishSfx.push('ground');
  say(`You hook ${who.name} by the coat. (Q: reel them in)`, 3);
}
function netHookReel(f) { net.tx.send('reel', {}, f.who.netPeer); }
function netHookAnglerStep(f, dt) { // (fishing.js's stepHooked, for a player: the lure stays in them, wherever they go)
  const p = net.peers.get(f.who.netPeer), s = p && netViewOf(p);
  if (!p || p.stale || !s || s.rk !== 'out' || s.veh) return netHookLetGo(f, `${f.who.name} is off your line.`);
  f.x = s.x; f.y = s.y; f.z = s.z + .11;
  if (Math.hypot(rel(s.x - px), rel(s.y - py)) > CAST_MAX * 1.5) { net.tx.send('unhook', { why: 'snap' }, p.id); return netHookLetGo(f, 'The line pulls tight and they tear free.'); }
}
function netHookLetGo(f, text) { // (your end: the line comes in empty)
  net.hooking = '';
  if (fishing === f) { f.who = null; f.catch = null; reelIn(); fishSfx.push('reel'); }
  if (text) say(text, 2.5);
}
function netHookMessage(type, data, from, p, now) {
  if (type !== 'hook' && type !== 'reel' && type !== 'unhook') return false;
  if (!NET_FEATURES.hooks) return true;
  if (type === 'hook') { // you're on their line (if you can be)
    if (mode !== 'walk' || skatingNow() || net.hooked || sleep || wakeT || netAway() || net.peaceful) { net.tx.send('unhook', { why: 'no' }, from); return true; }
    net.hooked = { by: from, t: 0, haul: false, struggle: 0, d0: Math.max(0.15, netViewOf(p) ? Math.hypot(rel(netViewOf(p).x - px), rel(netViewOf(p).y - py)) : 0.5), keys: false };
    body.seat = null;
    say(`${p.name}'s fishing line has you by the coat! (Space or E, again and again: work it loose)`, 4);
    return true;
  }
  if (type === 'reel') { if (net.hooked && net.hooked.by === from) { net.hooked.haul = true; say(`${p.name} starts reeling you in!`, 2); } return true; }
  // unhook: from the angler (they let go: you're free) or from the one you'd hooked (they're free)
  if (net.hooked && net.hooked.by === from) { net.hooked = null; if (data && data.why === 'snap') say('The line snaps tight and you pull free.', 2); return true; }
  if (net.hooking === from && fishing && fishing.who && fishing.who.netPeer === from) {
    const why = data && data.why, msg = why === 'free' ? `${p.name} works the hook loose and glares at you.` : why === 'reeled' ? `${p.name} is at your feet. They yank the hook out and shove it back at you.`
      : why === 'snag' ? 'The line snags on the corner and they pull free.' : why === 'no' ? 'The hook doesn\'t catch.' : `${p.name} is off your line.`;
    netHookLetGo(fishing, msg);
  }
  return true;
}
function netHookFrame(dt) { // every frame: both ends of a line
  if (net.hooking && !(fishing && fishing.who && fishing.who.netPeer === net.hooking)) { net.tx.send('unhook', { why: 'away' }, net.hooking); net.hooking = ''; } // (you put the rod away)
  const h = net.hooked;
  if (!h) return;
  const p = net.peers.get(h.by), s = p && netViewOf(p), free = (why, text) => { net.tx.send('unhook', { why }, h.by); net.hooked = null; if (text) say(text, 3); };
  if (!p || p.stale || !s || s.rk !== 'out') return free('gone');
  if (mode !== 'walk' || skatingNow()) return free('gone');
  if (netAway()) return free('free', 'You slip off the hook.'); // (paused, or in another tab: let go)
  h.t += dt;
  const keys = !!(K.Space || K.KeyE); // (struggling: each press loosens it)
  if (keys && !h.keys) h.struggle += h.haul ? 0.1 : 0.16;
  h.keys = keys;
  if (h.struggle >= 1) return free('free', 'You work the hook out of your coat. Free.');
  if (!h.haul && h.t > NET_HOOK_SLACK) return free('free', 'The hook works itself loose.');
  const ex = rel(s.x - px), ey = rel(s.y - py), d = Math.hypot(ex, ey) || 1;
  if (h.haul) { // in you come, staggering, the way you'd reel in anyone
    if (d < .1) return free('reeled', pick([`"Are you out of your MIND?" You yank the hook out and shove it back at ${p.name}.`, 'At their feet, you tug yourself free.']));
    const step = Math.min(d - .09, HOOK_HAUL * dt * (.7 + .3 * Math.sin(T * 9))), nx = worldCoord(px + ex / d * step), ny = worldCoord(py + ey / d * step);
    if (map[idx(Math.floor(nx), Math.floor(ny))] > 0) return free('snag', 'The line snags on the corner and you pull free.');
    px = nx; py = ny;
  } else if (d > h.d0 + .08) { px = worldCoord(px + ex / d * (d - h.d0 - .08)); py = worldCoord(py + ey / d * (d - h.d0 - .08)); } // (held at the end of the line)
}

// ---- the players menu (hold Tab): everyone in the room, where they are, and things to do with them: whisper (a message
// only they see), give them money or something from your bag, invite them to your home, or head to one they've invited
// you to. Hold Tab to look; click something and it stays open till you're done (Esc or Done).
const NET_GIFT_WAIT = 10; // seconds for a gift to be taken before it comes back to you
let netPlayersEl = null, netPlayersPinned = false, netPlayersForm = null, netPlayersT = 0;
const netPlayersOpen = () => !!netPlayersEl && netPlayersEl.style.display === 'flex';
function netPlayersKey(e) { // (main.js, on a key going down)
  if (e.code !== 'Tab') return false;
  e.preventDefault?.();
  if (net.on && !e.repeat && !netPlayersOpen()) openNetPlayers();
  return true;
}
function netPlayersKeyUp(e) { if (e.code === 'Tab' && netPlayersOpen() && !netPlayersPinned) closeNetPlayers(); } // (main.js, on a key going up)
function buildNetPlayers() {
  const el = menuEl('netplayers', 530, `
    <div class="panel" role="dialog" aria-label="Players" style="width:min(560px, calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;overflow-wrap:anywhere;box-sizing:border-box">
      <h1>Players</h1>
      <p class="sub" data-np="room"></p>
      <div data-np="requests"></div>
      <div data-np="list"></div>
      <div data-np="form" style="margin-top:12px"></div>
      <button class="item" data-np-act="done" style="margin-top:12px">Done <span class="k" style="margin-left:auto">Esc</span></button>
    </div>`);
  el.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); closeNetPlayers(); }
    else if (e.code === 'Enter' && e.target.matches('input')) { e.preventDefault(); el.querySelector('[data-np-act="send"]')?.click(); }
    e.stopPropagation();
  });
  el.addEventListener('keyup', e => { if (e.code === 'Tab') netPlayersKeyUp(e); e.stopPropagation(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-np-act]');
    if (!b) return;
    const act = b.dataset.npAct, id = b.dataset.id, p = id && net.peers.get(id);
    if (act === 'done') return closeNetPlayers();
    netPlayersPinned = true; // (doing something: it stays open)
    if (act === 'whisper' || act === 'cash' || act === 'item') { netPlayersForm = { act, id }; return netPlayersShow(true); }
    if ((act === 'tp-to' || act === 'tp-here') && p) { netTeleportRequest(p, act === 'tp-to' ? 'to' : 'here'); return netPlayersShow(true); }
    if (act === 'tp-yes' || act === 'tp-no') { netTeleportAnswer(b.dataset.req, act === 'tp-yes'); return netPlayersShow(true); }
    if (act === 'invite' && p) { netInvite(p); return netPlayersShow(true); }
    if (act === 'go' && p) { netGoToInvite(p); return closeNetPlayers(); }
    if (act === 'cancel') { netPlayersForm = null; return netPlayersShow(true); }
    if (act === 'send' && netPlayersForm) {
      const f = netPlayersForm, q = net.peers.get(f.id), input = el.querySelector('[data-np="input"]');
      if (q && f.act === 'whisper' && netWhisper(q, input.value)) { input.value = ''; input.focus(); }
      if (q && f.act === 'cash' && netGiveCash(q, +input.value)) { netPlayersForm = null; netPlayersShow(true); }
      return;
    }
    if (act === 'give' && netPlayersForm) { const q = net.peers.get(netPlayersForm.id); if (q && netGiveItem(q, +b.dataset.k)) { netPlayersForm = null; netPlayersShow(true); } }
  });
  return el;
}
function openNetPlayers() {
  netPlayersEl = netPlayersEl || buildNetPlayers();
  netPlayersPinned = false; netPlayersForm = null;
  for (const k in K) K[k] = 0;
  releaseHeldMouse(); releaseMouse();
  netPlayersEl.style.display = 'flex';
  netPlayersShow(true);
}
function closeNetPlayers() {
  if (!netPlayersEl) return;
  netPlayersEl.style.display = 'none'; netPlayersPinned = false; netPlayersForm = null;
  if (!paused) lockMouse();
}
function netWhere(p) { // where someone is, in a few words
  const s = netViewOf(p);
  if (!s) return '';
  if (s.rk !== 'out') return 'inside, ' + (s.rk === netRoomKey() ? 'here with you' : (s.rk.split(':')[0] || 'somewhere'));
  const d = Math.hypot(rel(s.x - px), rel(s.y - py)) * 10, place = typeof streetName === 'function' ? streetName(s.x, s.y) : '';
  const how = s.veh ? 'driving' : s.ride ? 'riding' : s.craft ? (s.craft.k === 'air' ? 'flying' : 'on the water') : s.sk ? 'skating' : '';
  return [how, place, mode === 'room' ? '' : d < 1000 ? Math.round(d) + 'm away' : (d / 1000).toFixed(1) + 'km away'].filter(Boolean).join(', ');
}
function netPlayersShow(all = false) {
  if (!netPlayersOpen()) return;
  const el = netPlayersEl, others = [...net.peers.values()].filter(p => p.hello && !p.mismatch);
  el.querySelector('[data-np="room"]').textContent = net.on ? `Room "${net.code}": you and ${others.length} other${others.length === 1 ? '' : 's'}.` : 'Not in a room. Esc, then Multiplayer, to join one.';
  netTeleportShow(el);
  const balance = el.querySelector('[data-np="balance"]'); if (balance) balance.textContent = 'Available: ' + fmt$(money);
  const canInvite = owned.homes.length > 0;
  const list = el.querySelector('[data-np="list"]');
  const listHTML = others.length ? others.map(p => {
    const inv = net.invites.get(p.id), btn = (act, label) => `<button class="opt" data-np-act="${act}" data-id="${netEsc(p.id)}">${label}</button>`;
    return `<div data-peer="${netEsc(p.id)}" style="padding:8px 0;border-top:1px solid #2a3338">
      <div><b style="color:${NET_CSS[p.hello.look.top]}">${netEsc(p.name)}</b> <span data-player-status style="color:#89a"></span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${btn('whisper', 'Whisper')}${btn('cash', 'Give money')}${btn('item', 'Give item')}${btn('tp-to', 'Request teleport to them')}${btn('tp-here', 'Ask them to teleport here')}${canInvite ? btn('invite', 'Invite home') : ''}${inv && inv.until > netNow() ? btn('go', 'Go to their home') : ''}</div>
    </div>`;
  }).join('') : '<div style="color:#789">Nobody else here yet.</div>';
  if (list.dataset.html !== listHTML) { list.innerHTML = listHTML; list.dataset.html = listHTML; }
  for(const p of others){const s=netViewOf(p),tags=[s?.peaceful?'peaceful':'',s?.away?'paused':'',s?.stars?'*'.repeat(s.stars):''].filter(Boolean).join(' · '),row=[...list.children].find(row=>row.dataset.peer===p.id);if(row)row.querySelector('[data-player-status]').textContent=netWhere(p)+(tags?' · '+tags:'');}
  if (!all) return;
  const f = netPlayersForm, q = f && net.peers.get(f.id), form = el.querySelector('[data-np="form"]');
  if (!q) { form.innerHTML = ''; return; }
  const input = (ph, type = 'text', max = NET_CHAT_MAX) => `<input data-np="input" type="${type}" maxlength="${max}" placeholder="${ph}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0;box-sizing:border-box;font:inherit;color:#eee;background:${f.act==='whisper'?'transparent':'#000'};border:${f.act==='whisper'?'0':'1px solid #567'};padding:6px 8px">`;
  const bar = inner => `<div style="display:flex;gap:8px;align-items:center">${inner}<button class="opt" data-np-act="cancel">Cancel</button></div>`;
  if (f.act === 'whisper') form.innerHTML = `<p class="sub">Whisper to ${netEsc(q.name)} (only they see it)</p>` + bar(input('Say something...') + '<button class="opt" data-np-act="send">Send</button>');
  if (f.act === 'cash') form.innerHTML = `<p class="sub">Give ${netEsc(q.name)} money</p><p class="sub" data-np="balance">Available: ${fmt$(money)}</p>` + bar(input('Amount', 'number', 8) + '<button class="opt" data-np-act="send">Give</button>');
  if (f.act === 'item') form.innerHTML = `<p class="sub">Give ${netEsc(q.name)} something from your bag</p>` + (inv.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${inv.map((it, k) => `<button class="opt" data-np-act="give" data-k="${k}">${netEsc(itemName(it))}</button>`).join('')}</div>`
    : '<div style="color:#789">Your bag is empty.</div>') + `<div style="margin-top:6px">${bar('')}</div>`;
  form.querySelector('[data-np="input"]')?.focus();
}
// whispers: to one player only, in the chat log in pink, no speech bubble
function netWhisper(p, textIn) {
  const text = netClean(textIn, NET_CHAT_MAX);
  if (!text || !net.on) return false;
  if (!netAllow(net.chatBucket, netNow(), 1, 3)) { netLog('Slow down a little.', null, '#f96'); return false; }
  net.tx.send('dm', { text }, p.id);
  netLog(text, `(to ${p.name})`, '#f9c');
  return true;
}
// gifts: out of your money or bag now; if they haven't taken it in NET_GIFT_WAIT seconds (gone, or their bag's full) it's yours again
function netGiveCash(p, amount) {
  amount = Math.round((+amount || 0) * 100) / 100;
  if (!(amount > 0)) return say('How much?', 2), false;
  if (amount > money) return say(`You've only got ${fmt$(money)}.`, 2), false;
  pay(amount);
  netSendGift(p, { cash: amount });
  netLog(`You give ${p.name} ${fmt$(amount)}.`);
  return true;
}
function netGiveItem(p, k) {
  const it = inv[k];
  if (!it) return false;
  const copy = JSON.parse(JSON.stringify(it));
  takeSlot(k);
  netSendGift(p, { item: copy });
  netLog(`You give ${p.name} the ${itemName(copy)}.`);
  return true;
}
function netSendGift(p, what) {
  const gid = netRandomId();
  net.gifts.set(gid, { to: p.id, name: p.name, ...what, t: netNow() });
  net.tx.send('gift', { gid, ...what }, p.id);
}
function netGiftBack(g, why) { // (not taken: back to you)
  if (g.cash) earn(g.cash); else if (g.item) carryItem(g.item, false);
  netLog(`${g.name} ${why}, so ${g.cash ? 'you keep the ' + fmt$(g.cash) : 'you keep the ' + itemName(g.item)}.`, null, '#f96');
}
function netGiftFrame(now) {
  for (const [gid, g] of net.gifts) if (now - g.t > NET_GIFT_WAIT) { net.gifts.delete(gid); netGiftBack(g, 'never took it'); }
}
// home invitations: they get a copy of your place as it is (the furniture, the shelves), and the way in by your door
function netInvite(p) {
  const near = h => { const d = h.door || [h.cell % N + 0.5, Math.floor(h.cell / N) + 0.5]; return Math.hypot(rel(d[0] - px), rel(d[1] - py)); };
  const home = homeRecord(room) || [...owned.homes].sort((a_, b) => near(a_) - near(b))[0];
  if (!home) return say('You need a home of your own to invite anyone over.', 3);
  netHomeInvite(p, home);
  net.tx.send('invite', { cell: home.cell, kind: home.kind, door: home.door || null, rec: JSON.parse(JSON.stringify(home)) }, p.id);
  netLog(`You invite ${p.name} over to your place.`);
}
function netGuestHome(d) { // (their home record, made safe the way save.js loads your own)
  const h = d.rec && typeof d.rec === 'object' ? d.rec : {};
  return { cell: d.cell, kind: d.kind, door: null,
    decor: (Array.isArray(h.decor) ? h.decor : []).filter(isHomeDecor).slice(0, HOME_SHELF_CAPACITY).map(restoreShelfItem),
    fridge: (Array.isArray(h.fridge) ? h.fridge : []).filter(isFridgeItem).slice(0, STORE_SIZE),
    workshop: restoreWorkshop(h.workshop, d.kind), furnishings: restoreHomeFurnishings(h.furnishings, d.kind),
    lights: Object.fromEntries(Object.entries(h.lights || {}).filter(([k, v]) => /^fixed[0-9]{1,2}$/.test(k) && typeof v === 'boolean')),
    ...(h.bathroomDoors !== undefined ? { bathroomDoors: Array.isArray(h.bathroomDoors) ? h.bathroomDoors.slice(0, 8).map(v => v !== false) : [] } : {}),
    pets: (Array.isArray(h.pets) ? h.pets : []).filter(p => p === 'petcat' || p === 'petdog').filter((p, i, all) => all.indexOf(p) === i) };
}
function netGoToInvite(p) {
  const v = net.invites.get(p.id);
  if (!v) return;
  const [x, y] = v.door || [v.cell % N + 0.5, Math.floor(v.cell / N) + 0.5];
  setMapWaypoint({ id: 'invite:' + p.id, name: `${p.name}'s home`, x, y });
  say(`${p.name}'s place is marked on your map. Go in by their door.`, 4);
}
function netInviteAt(sh) { // (actions.js, at a door: a home you've been invited to, behind it)
  if (!net.on) return null;
  const now = netNow();
  for (const [from, v] of net.invites) if (v.until > now && SHOP[v.cell] === sh && net.peers.has(from)) return { ...v, from };
  return null;
}
function netEnterAsGuest(v) {
  const kind = homeRoomKind(v.kind), def = ROOM_DEFS[kind];
  enterRoom(kind, { word: 'HOME', ret: [px, py, a], cell: [v.cell % N, Math.floor(v.cell / N)], guestHome: v.home, guestOf: v.from, guestName: v.name }, def.entry);
  say(`You let yourself into ${v.name}'s place.`, 3);
}
// ---- things put down in the street: yours go out to everyone (each second, like cars you've left); theirs show where
// they put them, and picking one up asks them for it, so it's only ever in one bag
const NET_DROPS_MAX = 20;
function netMyDrops() {
  const out = [];
  for (const d of dropped) if (d.at === '' && out.length < NET_DROPS_MAX) {
    d.netId ||= net.selfId + ':' + (++net.carN);
    const { x, y, z, at, displayZ, displaySize, netId, ...it } = d;
    out.push({ id: netId, x, y, z: z || 0, it: JSON.parse(JSON.stringify(it)) });
  }
  return out;
}
function netSendDrops(to) { if (net.on && NET_FEATURES.gifts) net.tx.send('drops', netMyDrops(), to); }
function netCheckDrops(d) {
  if (!Array.isArray(d)) return [];
  return d.slice(0, NET_DROPS_MAX).filter(o => o && netCarId(o.id) && netNum(o.x) && netNum(o.y) && netNum(o.z) && o.it && typeof o.it.id === 'string' && ITEMS[o.it.id])
    .map(o => ({ id: o.id, x: worldCoord(o.x), y: worldCoord(o.y), z: clamp(o.z, -5, 50), it: o.it }));
}
function netDrawDrops() {
  if (!net.on || mode === 'room') return;
  for (const p of net.peers.values()) for (const d of p.drops || []) {
    if (net.dropTaken.has(d.id)) continue;
    const vx = rel(d.x - px), vy = rel(d.y - py);
    if (Math.hypot(vx, vy) < 12) drawDropped({ ...d.it, x: d.x, y: d.y, z: d.z, at: '' }, vx, vy, 0.1);
  }
}
function netDropNear() {
  if (!net.on || mode !== 'walk') return null;
  let best = null, bd = 0.15;
  for (const p of net.peers.values()) for (const d of p.drops || []) {
    if (net.dropTaken.has(d.id)) continue;
    const dd = Math.hypot(rel(d.x - px), rel(d.y - py));
    if (dd < bd) { bd = dd; best = { ...d, owner: p }; }
  }
  return best;
}
const netDropPrompt = () => { const d = netDropNear(); return d ? `E: pick up the ${itemName(d.it)} (${d.owner.name} put it down)` : ''; };
function netDropUse() { // (actions.js, on E: true if it was about someone else's thing in the street)
  const d = netDropNear();
  if (!d) return false;
  if (inv.length >= INV_SIZE) return say('Your bag is full.'), true;
  net.dropTaken.set(d.id, netNow() + 5); // (gone from your street at once; theirs says yes or no)
  net.tx.send('dropClaim', { id: d.id }, d.owner.id);
  return true;
}
function netSocialMessage(type, data, from, p, now) {
  if (!['dm', 'gift', 'giftAck', 'invite', 'drops', 'dropClaim', 'dropGiven'].includes(type)) return false;
  if (!NET_FEATURES.gifts && type !== 'dm') return true;
  if (type === 'dm') {
    if (!netAllow(p.chatBucket, now, 1, 3)) return true;
    const text = netClean(data && data.text, NET_CHAT_MAX);
    if (text) { netLog(text, `${p.name} (whispers)`, '#f9c'); if (actx) tone(actx.currentTime, 880, 0.06, 0.05); }
    return true;
  }
  if (type === 'gift') {
    if (!data || typeof data.gid !== 'string' || !netAllow(p.giftBucket ||= {}, now, 0.5, 5)) return true;
    if (netNum(data.cash) && data.cash > 0) {
      const cash = Math.min(Math.round(data.cash * 100) / 100, 1e6);
      earn(cash); netLog(`${p.name} gives you ${fmt$(cash)}.`, null, '#9e9');
      net.tx.send('giftAck', { gid: data.gid }, from);
    } else if (data.item && typeof data.item.id === 'string' && ITEMS[data.item.id]) {
      if (inv.length >= INV_SIZE) { net.tx.send('giftAck', { gid: data.gid, back: 'full' }, from); netLog(`${p.name} tried to give you something, but your bag is full.`, null, '#f96'); return true; }
      const it = { ...data.item, uses: netNum(data.item.uses) ? data.item.uses : ITEMS[data.item.id].uses || 0 };
      carryItem(it, false); netLog(`${p.name} gives you the ${itemName(it)}.`, null, '#9e9');
      net.tx.send('giftAck', { gid: data.gid }, from);
    }
    return true;
  }
  if (type === 'giftAck') {
    const g = data && net.gifts.get(data.gid);
    if (!g || g.to !== from) return true;
    net.gifts.delete(data.gid);
    if (data.back) netGiftBack(g, 'has no room for it');
    return true;
  }
  if (type === 'invite') {
    if (!data || !Number.isInteger(data.cell) || !SHOP[data.cell] || typeof data.kind !== 'string' || ITEMS[data.kind]?.kind !== 'home') return true;
    const door = Array.isArray(data.door) && data.door.length === 2 && data.door.every(netNum) ? data.door.map(v => worldCoord(v)) : null;
    net.invites.set(from, { cell: data.cell, kind: data.kind, door, home: netGuestHome(data), name: p.name, until: now + 1800 });
    netLog(`${p.name} invites you over to their place. (Hold Tab: Go to their home)`, null, '#9e9');
    netPlayersShow();
    return true;
  }
  if (type === 'drops') { if (netAllow(p.dropsBucket ||= {}, now, 0.5, 4)) p.drops = netCheckDrops(data); return true; }
  if (type === 'dropClaim') { // someone's picking up a thing you put down: theirs, if it's still there
    const id = data && data.id, d = dropped.find(o => o.netId === id && o.at === '');
    if (d) { const { x, y, at, z, displayZ, displaySize, netId, ...it } = d; dropped.splice(dropped.indexOf(d), 1); net.tx.send('dropGiven', { id, it: JSON.parse(JSON.stringify(it)) }, from); netSendDrops(); }
    else net.tx.send('dropGiven', { id, it: null }, from);
    return true;
  }
  if (type === 'dropGiven') {
    const it = data && data.it;
    if (it && typeof it.id === 'string' && ITEMS[it.id]) { carryItem(it, false); say(`You pick up the ${itemName(it)}.`); }
    else say('Someone got there first.', 2);
    return true;
  }
  return true;
}

// ---- spray paint (spray-paint.js): what you spray goes out as you spray it (PAINT_LISTENERS); someone arriving gets your
// most recent. The keys are every dot you've got, so nothing's painted twice when it comes round again.
function netPaintKeys() {
  if (!net.paintKeys || net.paintKeys.size > PAINT_MAX * 3) net.paintKeys = new Set(sprayDots.map(netDotKey));
  return net.paintKeys;
}
function netSendPaint(dots, to) {
  if (!net.on || !NET_FEATURES.paint || !dots.length) return;
  for (let k = 0; k < dots.length; k += NET_PAINT_MSG) net.tx.send('paint', dots.slice(k, k + NET_PAINT_MSG).map(netDotOut), to);
}
PAINT_LISTENERS.push(dots => {
  if (!net.on || !NET_FEATURES.paint) return;
  for (const d of dots) { net.paintOut.push(d); if (net.paintKeys) net.paintKeys.add(netDotKey(d)); }
});

// your tags (graffiti.js), to everyone or to one who's just arrived: the whole list, so the council's scrubbing goes too
function netSendTags(to) {
  if (!net.on || !NET_FEATURES.tags) return;
  net.tx.send('tags', tags.map(t => ({ cell: t.cell, face: t.face, u: t.u, z: t.z, design: t.design })), to);
}

// in the pause menu, or the game's in another tab: you're not really here, so nobody can hurt or hook you
const netAway = () => !!(paused || document.hidden);

// ---- chat
function netSay(textIn) {
  const text = netClean(textIn, NET_CHAT_MAX);
  if (!text || !net.on || !NET_FEATURES.chat) return false;
  if (!netAllow(net.chatBucket, netNow(), 1, 3)) { netLog('Slow down a little.', null, '#f96'); return false; }
  net.tx.send('chat', { text });
  netLog(text, net.name, NET_CSS[net.look.top]);
  net.bubble = { lines: netWrap(text), until: netNow() + netBubbleTime(text) };
  return true;
}
let netChatEl = null, netChatPrompt = null;
const netTyping = () => !!netChatEl && netChatEl.style.display !== 'none';
function netOpenChat() {
  if (!netChatEl) {
    netChatEl = document.createElement('input');
    netChatEl.id = 'net-chat'; netChatEl.maxLength = NET_CHAT_MAX; netChatEl.autocomplete = 'off'; netChatEl.spellcheck = false;
    netChatEl.placeholder = 'message · Enter to send · Esc to cancel';
    netChatEl.setAttribute('aria-label', 'Chat message');
    Object.assign(netChatEl.style, { position: 'fixed', left: '24px', bottom: '8px', width: 'min(544px, calc(100vw - 32px))', zIndex: 400, display: 'none',
      font: '14px monospace', lineHeight: '20px', color: '#eee', background: 'transparent', border: '0', borderRadius: '0', boxShadow: 'none', padding: '6px 0', outline: 'none', caretColor: '#a9ffb0', textShadow: '0 1px 3px #000, 0 0 5px #000' });
    netChatEl.addEventListener('keydown', e => {
      e.stopPropagation(); // (typing never reaches the game)
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); netSay(netChatEl.value); netCloseChat(); }
      else if (e.code === 'Escape') { e.preventDefault(); netCloseChat(); }
    });
    netChatEl.addEventListener('keyup', e => e.stopPropagation());
    netChatEl.addEventListener('blur', () => { if (netTyping() && CONTROLLER.textInput !== netChatEl) netCloseChat(false); }); // (the controller's on-screen keyboard takes the focus while you type)
    netChatEl.addEventListener('change', () => { if (netChatEl.dataset.pad) { delete netChatEl.dataset.pad; netSay(netChatEl.value); netCloseChat(); } }); // (the controller's keyboard: Done sends it)
    netChatPrompt=document.createElement('span');netChatPrompt.id='net-chat-prompt';netChatPrompt.textContent='>';netChatPrompt.setAttribute('aria-hidden','true');
    Object.assign(netChatPrompt.style,{position:'fixed',left:'8px',bottom:'14px',zIndex:400,font:'14px monospace',lineHeight:'20px',color:'#a9ffb0',textShadow:'0 1px 3px #000, 0 0 5px #000',display:'none',pointerEvents:'none'});
    document.body.append(netChatPrompt,netChatEl);
  }
  for (const k in K) K[k] = 0; // (stop walking: the keys are for the message now)
  releaseHeldMouse(); releaseMouse();
  netChatEl.value = ''; netChatEl.style.display = 'block'; netChatPrompt.style.display='block'; netChatEl.focus();
  if (CONTROLLER.active) { netChatEl.dataset.pad = '1'; controllerKeyboard(netChatEl); } // (a controller: type it on the on-screen keyboard)
}
function netCloseChat(relockMouse = true) {
  if (!netChatEl) return;
  netChatEl.style.display = 'none'; if(netChatPrompt)netChatPrompt.style.display='none'; netChatEl.blur();
  if (relockMouse && !paused) lockMouse();
}
// from main.js's key handler, once the menus have had theirs: T or Enter opens the chat box (only in a room)
function netChatKey(e) {
  if (!net.on || !NET_FEATURES.chat || e.repeat || sleep) return false;
  if (e.code !== 'KeyT' && e.code !== 'Enter' && e.code !== 'NumpadEnter') return false;
  e.preventDefault?.(); netOpenChat(); return true;
}

// ---- drawing the others: in the street (or the same room as you), on the ground, facing where they're going
function netFigLook(p) {
  if (p.figLook) return p.figLook;
  return p.figLook = figLook(netAppearanceOptions(p.hello.look));
}
const NET_ON_FOOT = new Set(['walk', 'room', 'roof', 'elplat', 'el', 'ferry', 'fair', 'ladder']);
function netVisible(p, s) { return s && s.rk === netRoomKey() && (mode === 'room' || Math.abs(rel(s.x - px)) < vis + 1 && Math.abs(rel(s.y - py)) < vis + 1); }
function drawPeers() {
  if (!net.on || !net.peers.size) return;
  netDrawBalls(); netDrawDrops();
  const now = netNow(), inRoom = mode === 'room';
  for (const p of net.peers.values()) {
    const f = p.fallen; // (shot down a moment ago: lying where they fell, till the ambulance has them)
    if (f && f.until > now && f.rk === netRoomKey() && p.hello) {
      const fx = inRoom ? f.x - px : rel(f.x - px), fy = inRoom ? f.y - py : rel(f.y - py);
      if (inRoom || Math.hypot(fx, fy) < vis) drawFigure(fx, fy, f.z, inRoom ? 1.8 : 0.175, -Math.cos(f.a), -Math.sin(f.a), netFigLook(p), 'dead', { light: inRoom ? 9 : 6 });
    }
    if (!p.hello || p.mismatch || p.stale) { p.drawn = false; continue; }
    const s = p.view = netSample(p, now);
    if (s && s.cops && s.rk === netRoomKey()) netDrawCops(p, s, inRoom);
    if (!netVisible(p, s)) { p.drawn = false; continue; }
    const vx = inRoom ? s.x - px : rel(s.x - px), vy = inRoom ? s.y - py : rel(s.y - py), fx = Math.cos(s.a), fy = Math.sin(s.a);
    if (p.lastX !== undefined && p.lastRk === s.rk) p.ph += Math.hypot(rel(s.x - p.lastX), rel(s.y - p.lastY)) * (inRoom ? 3 : 30);
    p.lastX = s.x; p.lastY = s.y; p.lastRk = s.rk; p.drawn = true;
    if (s.veh && s.veh.id && net.cars.has(s.veh.id)) continue; // at the wheel of a car they're sharing: it's in the traffic (netSyncCars), drawn with the rest
    if (s.veh && VEHICLES[s.veh.kind]) { // in a taxi (a picture of it)
      const car = p.car = Object.assign(p.car || { id: (hash(p.id.length, p.id.charCodeAt(0) || 0, 77) * 1e6) | 0 }, s.veh);
      drawVehicle(car, vx, vy, fx, fy);
      continue;
    }
    if (s.craft) { netDrawCraft(p, s, vx, vy); continue; } // (a boat, a swan, an aircraft)
    if (!NET_ON_FOOT.has(s.mode)) continue;
    const gait = /^(walk|run)$/.test(s.pose) ? s.pose + (Math.floor(p.ph) & 7) : s.pose;
    if (s.sk && !inRoom && /^tumble/.test(s.pose)) { // bailed: the board gone off on its own, them sprawled (as skate-bails.js draws you)
      const sk = s.sk;
      if (netNum(sk.bx)) drawSkateBoard(rel(sk.bx - px), rel(sk.by - py), sk.bz, sk.yaw, 0, sk.roll);
      drawFigure(vx, vy, s.z, SB.rider, fx, fy, netFigLook(p), s.pose, { light: 5, hold: p });
      continue;
    }
    if (s.sk && !inRoom) { // on the board: the deck under them, and them side on to it, front foot forward (as skate.js draws you)
      const sk = s.sk, ang = sk.yaw + sk.st * Math.PI / 2, look = netFigLook(p), pose = /^(ride|push|crouch|skateair|mongo)/.test(s.pose) ? s.pose : 'ride1';
      drawSkateBoard(vx, vy, s.z, sk.yaw, sk.nose, sk.roll);
      drawFigure(vx, vy, s.z + SB.up + SB.ht, SB.rider, Math.cos(ang), Math.sin(ang), look, pose, { light: 5, hold: p }); // (the plain figure: skate.js's per-pixel one is made to be seen from behind at a distance, and comes apart up close)
      continue;
    }
    if (inRoom) drawFigure(vx, vy, s.z, 1.8, fx, fy, netFigLook(p), gait, { light: 9, hold: p });
    else drawFigure(vx, vy, s.z, 0.175, fx, fy, netFigLook(p), gait, { light: 6, hold: p });
    if (s.spray && !inRoom) { // the can out in front of them, and the mist off it
      const col = SPRAY_COLOURS[s.spray.col] ?? MAG, mx = vx + fx * 0.06, my = vy + fy * 0.06;
      drawArt(mx, my, s.z + 0.12, 0.03, 0.03, [fract(T * 7) < .5 ? '.:.' : ':.:'], () => C(col, 13));
    }
  }
}

// ---- police: yours, sent while you're wanted (the cruisers go into everyone's traffic as stand-ins, netSyncCars), and
// theirs drawn on foot. Your own patrol cars aren't drawn right where someone else's chase is, so they don't double up.
function netMyCops() {
  const out = [], add = o => out.length < NET_COPS_MAX && out.push(o);
  if (mode === 'room') roomCops.forEach((c, k) => { if (!c.dead) add({ k: 'room', id: k, x: c.x, y: c.y, a: Math.atan2(c._fy || 0, c._fx || 1) }); });
  for (const c of cars) if (c.pursuit && c.patrol && !playerCar(c) && !c.wrecked && near(c.x, c.y, px, py) < 40) add({ k: 'car', id: c.id, kind: c.kind, body: c.body, x: c.x, y: c.y, a: Math.atan2(c.hy, c.hx), v: c.v });
  footCops.forEach((c, k) => { if (c.chase && !c.dead && !c.down) add({ k: 'foot', id: k, x: c.x, y: c.y, a: Math.atan2(c._fy || 0, c._fx || 1) }); });
  roofCops.forEach((c, k) => { if (!c.dead) add({ k: 'roof', id: k, x: c.x, y: c.y, z: policeRoofHeight(c.x, c.y), a: Math.atan2(c._fy || 0, c._fx || 1) }); });
  return out;
}
function netDrawCops(p, s, inRoom) {
  const objs = p.copObjs ||= {};
  for (const c of s.cops) {
    if (c.k === 'car' || (c.k === 'room') !== inRoom) continue;
    const o = objs[c.k + c.id] ||= { seed: (hash(c.id, c.k.length, 6113) * 1e9) | 0 };
    const vx = inRoom ? c.x - px : rel(c.x - px), vy = inRoom ? c.y - py : rel(c.y - py);
    if (!inRoom && Math.hypot(vx, vy) > vis) continue;
    const z = inRoom ? 0 : c.k === 'roof' ? c.z : walkGround(c.x, c.y);
    drawFigure(vx, vy, z, inRoom ? 1.8 : 0.18, Math.cos(c.a), Math.sin(c.a), copLook(o), 'run' + (Math.floor(T * 10 + c.id) & 7), { light: inRoom ? 9 : 7 });
    if (!inRoom && fract(T * 3) < 0.5) drawArt(vx, vy, z + 0.2, 0.03, 0.05, ['!'], () => C(RED, 15));
  }
}
const netCopCarNear = m => { if (!net.on || !net.cars) return false; for (const c of net.cars.values()) if (c.cop && Math.hypot(rel(c.x - m.x), rel(c.y - m.y)) < 1.5) return true; return false; };

// a boat at the helm, a swan on the lake, an aircraft: drawn as they draw their own (marina.js, gardens.js, aircraft-render.js)
function netDrawCraft(p, s, vx, vy) {
  const c = s.craft, hx = Math.cos(s.a), hy = Math.sin(s.a);
  if (c.k === 'sea' && BOAT_KINDS[c.kind]) drawBoat3D(p.boat = Object.assign(p.boat || {}, { kind: c.kind, col: c.col }), vx, vy, hx, hy, Math.abs(c.v) > 0.1 ? 0.6 : 0);
  else if (c.k === 'swan') { drawSwanBoat(vx, vy, hx, hy); drawFigure(vx - hx * 0.01, vy - hy * 0.01, 0.01, 0.17, hx, hy, netFigLook(p), 'sit6'); }
  else if (c.k === 'air' && PLANE_TYPES[c.kind]) {
    const T_ = PLANE_TYPES[c.kind], o = p.plane = Object.assign(p.plane || { id: (hash(p.id.length, p.id.charCodeAt(1) || 0, 91) * 1e6) | 0 },
      { x: s.x, y: s.y, z: s.z, yaw: c.yaw, pitch: c.pitch, roll: c.roll, rotor: c.rotor, rotorA: T * 40 * (c.rotor || 0), wrecked: false });
    if (T_.heli) drawHeliCraft(o, T_, vx, vy); else drawPlaneCraft(o, T_, vx, vy);
  }
}
// their fishing lines (render.js, after the anglers'): the rod in their hands, the line to the lure, a bobber on the water.
// If the lure's in you (hooked), the line runs to just in front of you.
function netDrawLines() {
  if (!net.on) return;
  for (const p of net.peers.values()) {
    const s = p.view;
    if (!s || !s.fish || !p.drawn || s.rk !== 'out') continue;
    const vx = rel(s.x - px), vy = rel(s.y - py), fx = Math.cos(s.a), fy = Math.sin(s.a);
    const hand = fishProj(vx + fx * 0.02, vy + fy * 0.02, s.z + 0.1), tip = fishProj(vx + fx * 0.12, vy + fy * 0.12, s.z + 0.22);
    if (hand && tip) fishSeg(hand, tip, C(YEL, 13));
    let lx = rel(s.fish.x - px), ly = rel(s.fish.y - py), lz = s.fish.z;
    if (Math.hypot(lx, ly) < 0.06) { lx = dx * 0.08; ly = dy * 0.08; lz = eye - 0.05; } // (it's in you)
    const end = fishProj(lx, ly, lz);
    if (tip && end) fishSeg(tip, end, C(WHITE, 8 * Math.max(0.5, amb)));
    if (end && lz < 0.02) fishSurface(end.c, end.r, end.depth, C(RED, 14)); // (the bobber)
  }
}

// ---- hit by a car: the driver's game sees you in the road (drive() asks netCarHitsPlayer) and tells you; your game
// knocks you flat for a moment, takes health by how fast it was going, and the hospital if that's the last of it
function netCarHitsPlayer(c, fx, fy) {
  if (!net.on || !NET_FEATURES.guns) return false;
  const now = netNow();
  for (const p of net.peers.values()) {
    const s = netViewOf(p);
    if (!p.hello || p.mismatch || p.stale || !s || s.rk !== 'out' || s.mode !== 'walk' || s.veh || s.pose === 'down' || !netCanTouch(s)) continue;
    if (Math.hypot(rel(s.x - fx), rel(s.y - fy)) > 0.15 || now - (net.runT.get(p.id) ?? -9) < 1.5) continue;
    net.runT.set(p.id, now);
    const sg = Math.sign(c.v), yaw = c.travelA ?? Math.atan2(c.hy, c.hx);
    net.tx.send('runover', { sp: Math.abs(c.v), dx: Math.cos(yaw) * sg, dy: Math.sin(yaw) * sg }, p.id);
    say(pick([`*THUMP* You knock ${p.name} flying.`, `*THUMP* ${p.name} goes over the bonnet.`]), 2.5);
    crime('hit', c.x, c.y);
    return true;
  }
  return false;
}
function netKnockFrame(dt) { // flat on your back: you stay where you landed till you're up
  const k = net.knocked;
  if (!k) return;
  if ((k.t += dt) >= k.dur || mode !== 'walk') { net.knocked = null; return; }
  px = k.x; py = k.y;
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) K[key] = 0;
  body.mx = body.my = 0;
}
// ---- pickpocketing: behind another player, G. You play the pickpocket game; they feel it a moment in, and if they
// turn round to you or step away before you're done, they've caught you. Their game takes the cash out of their pocket
// (a tenth of what they carry, up to $50) and hands it to yours. Peaceful or paused: not them.
const NET_PICK_COOL = 60, NET_PICK_SHARE = 0.1, NET_PICK_MAX = 50;
function netPickTarget() {
  if (!net.on || !NET_FEATURES.guns || mode !== 'walk' || net.picking) return null;
  let best = null, bd = 0.3;
  for (const p of net.peers.values()) {
    const s = netViewOf(p);
    if (!p.hello || p.mismatch || p.stale || !s || s.rk !== 'out' || s.mode !== 'walk' || s.veh || s.sk || !netCanTouch(s)) continue;
    const ex = rel(px - s.x), ey = rel(py - s.y), d = Math.hypot(ex, ey);
    if (d > bd || ex * Math.cos(s.a) + ey * Math.sin(s.a) > 0) continue; // (in front of them: they'd see you)
    best = p; bd = d;
  }
  return best;
}
function netPickpocket(p) {
  net.picking = { id: p.id, stopped: false };
  net.tx.send('pickStart', {}, p.id);
  startCrime('pickpocket', ok => {
    const caught = net.picking && net.picking.stopped;
    net.picking = null;
    if (caught) return; // (they caught you: netCrimeMessage has said so)
    if (ok === 'abort') return net.tx.send('pick', { ok: false, abort: true }, p.id);
    net.tx.send('pick', { ok: !!ok }, p.id);
    if (!ok) { say(pick([`"HEY!" ${p.name} spins round. "Get your hand out of my pocket!"`, `${p.name} feels it and slaps your hand away.`]), 3); crime('pickpocket', px, py); }
  });
}
function netPickFrame(dt) { // you: is there a hand in your pocket?
  const h = net.picked;
  if (!h) return;
  const p = net.peers.get(h.by), s = p && netViewOf(p);
  if (!p || !s || (h.t += dt) > 20) { net.picked = null; return; }
  if (!h.noticed && h.t > h.notice) { h.noticed = true; say('You feel a hand in your pocket! Turn round, or step away!', 3); if (actx) tone(actx.currentTime, 520, 0.08, 0.12); }
  if (!h.noticed || h.stopped) return;
  const ex = rel(s.x - px), ey = rel(s.y - py), d = Math.hypot(ex, ey) || 1, facing = (Math.cos(a) * ex + Math.sin(a) * ey) / d;
  if (facing > 0.5 || d > 0.45) { // caught them at it
    h.stopped = true;
    net.tx.send('pickStop', {}, h.by);
    say(`You catch ${p.name}'s hand in your pocket!`, 3);
  }
}
function netCrimeMessage(type, data, from, p, now) {
  if (!['runover', 'pickStart', 'pickStop', 'pick', 'picked'].includes(type)) return false;
  if (!NET_FEATURES.guns || !data) return true;
  if (type === 'runover') { // their car's hit you
    if (net.peaceful || netAway() || mode !== 'walk' || net.knocked || sleep || wakeT || !netNum(data.sp)) return true;
    const sp = clamp(data.sp, 0, 4), dxv = netNum(data.dx) ? clamp(data.dx, -1, 1) : 0, dyv = netNum(data.dy) ? clamp(data.dy, -1, 1) : 0;
    const k = Math.min(0.6, 0.15 + sp * 0.12), nx = worldCoord(px + dxv * k), ny = worldCoord(py + dyv * k);
    if (!map[idx(Math.floor(nx), Math.floor(ny))]) { px = nx; py = ny; }
    fx.skating = false; body.seat = null;
    needs.health = Math.max(0, needs.health - clamp(10 + sp * 22, 10, 60));
    gun.hurtT = T;
    if (actx) playClip('crash', 0.4);
    if (needs.health <= 0) { netShotDown(p, 'car'); return true; }
    net.knocked = { t: 0, dur: 1.2 + Math.min(1.5, sp * 0.6), x: px, y: py };
    say(pick([`*THUMP* ${p.name}'s car knocks you flat.`, `${p.name} runs you down. You're on your back in the road.`]), 3);
    return true;
  }
  if (type === 'pickStart') { // a hand in your pocket (you'll feel it in a moment)
    if (net.peaceful || netAway() || net.picked) return true;
    if (now < (net.pickCool.get(from) ?? 0)) return true;
    net.picked = { by: from, t: 0, notice: 0.6 + Math.random() * 0.9, noticed: false, stopped: false };
    return true;
  }
  if (type === 'pickStop') { // they caught you at it
    if (net.picking && net.picking.id === from) {
      net.picking.stopped = true;
      say(pick([`${p.name} turns round and grabs your wrist. "I don't THINK so."`, `${p.name} catches you at it. "Hey! Thief!"`]), 3);
      crime('pickpocket', px, py);
      if (game && game.kind === 'crime') { const cb = game.onDone; game = null; cb('abort'); }
    }
    return true;
  }
  if (type === 'pick') { // how it went for them: if they finished and you didn't catch them, it's gone
    const h = net.picked;
    if (!h || h.by !== from) return true;
    net.picked = null;
    net.pickCool.set(from, now + NET_PICK_COOL);
    if (data.abort) return true;
    if (!data.ok) { if (!h.stopped) say(`${p.name} just tried to pick your pocket!`, 3); return true; }
    if (h.stopped || net.peaceful || netAway()) { net.tx.send('picked', { cash: 0, caught: true }, from); return true; }
    const cash = Math.min(money, NET_PICK_MAX, Math.max(Math.min(1, money), Math.round(money * NET_PICK_SHARE * 4) / 4));
    if (cash > 0) pay(cash);
    net.tx.send('picked', { cash }, from);
    setTimeout(() => say(cash > 0 ? `Your pocket feels lighter. ${fmt$(cash)} gone.` : 'Someone was in your pocket. Lucky it was empty.', 3), 1500);
    return true;
  }
  if (type === 'picked') { // what came out of their pocket
    const cash = netNum(data.cash) ? clamp(data.cash, 0, NET_PICK_MAX) : 0;
    if (data.caught) { say(`${p.name} catches your hand at the last second!`, 3); crime('pickpocket', px, py); return true; }
    if (cash > 0) { earn(cash); say(`You lift ${fmt$(cash)} from ${p.name}'s pocket. They walk on.`, 3); }
    else say(`${p.name}'s pockets are empty.`, 2);
    return true;
  }
  return true;
}

// ---- soccer balls: whoever touched one last runs it (the ball physics in goods.js) and sends it with their updates;
// everyone else carries it on between updates. Touch someone's ball in your own game and it's yours to run, stamped with
// when you touched it; two touches at once, the later one wins. Your own ball is goods.js's `ball` while you're running
// it; anyone else's (or yours, while someone else has it) is in net.balls. Only its owner can pick it up.
const netMyBallId = () => net.selfId + ':ball';
const netBallOwner = id => id.slice(0, id.lastIndexOf(':'));
function netBallOut(b, id, tt) { return { id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, tt }; }
function netMyBalls(now) { // (in your updates: the balls you're running)
  const out = [];
  if (ball) out.push(netBallOut(ball, netMyBallId(), net.myBallT));
  for (const b of net.balls.values()) if (b.runner === net.selfId) out.push(netBallOut(b, b.id, b.tt));
  return out;
}
function netReceiveBalls(p, list) {
  if (!NET_FEATURES.balls || !Array.isArray(list)) return;
  const now = netNow();
  for (const d of list.slice(0, 8)) {
    if (!d || typeof d.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}:ball$/.test(d.id) || !['x', 'y', 'z', 'vx', 'vy', 'vz', 'tt'].every(k => netNum(d[k]))) continue;
    const tt = d.tt + (p.off ?? 0); // (their clock, as ours)
    if (now < (net.ballGone.get(d.id) ?? 0)) continue; // (just picked up or lost: an update still on its way doesn't bring it back)
    if (d.id === netMyBallId()) { if (net.myBallT >= tt) continue; if (ball) { net.myBall = null; ball = null; } } // (yours: they've taken it on since you last touched it)
    const b = net.balls.get(d.id);
    if (b && b.tt > tt) continue; // (somebody touched it since)
    const o = b || { id: d.id, owner: netBallOwner(d.id), lx: d.x, ly: d.y };
    Object.assign(o, { x: worldCoord(d.x), y: worldCoord(d.y), z: clamp(d.z, 0, 5), vx: clamp(d.vx, -20, 20), vy: clamp(d.vy, -20, 20), vz: clamp(d.vz, -20, 20), tt, runner: p.id });
    net.balls.set(d.id, o);
  }
}
function netBallFrame(dt, now) {
  if (net.myBall && !ball && !net.balls.has(netMyBallId())) netBallGone(netMyBallId()); // (you picked it up, or it's in the water)
  if (ball && ball !== net.myBall) { net.myBall = ball; net.myBallT = now; } // (kicked out of your bag: running it)
  if (!NET_FEATURES.balls || paused || dt <= 0) return;
  for (const b of [...net.balls.values()]) {
    const near = mode === 'walk' && Math.hypot(rel(b.x - px), rel(b.y - py)) < 0.07;
    if (b.runner !== net.selfId && near) { b.runner = net.selfId; b.tt = now; } // (you've touched it: yours to run)
    if (b.runner === net.selfId) {
      if (b.id === netMyBallId()) { net.balls.delete(b.id); ball = b; net.myBall = b; net.myBallT = b.tt; continue; } // (your own, back with you: goods.js runs it)
      const mine = ball; ball = b; // (goods.js's physics, on this one)
      let lost = false;
      try { lost = stepBall(dt) === 'lost' || !ball; } finally { ball = mine; }
      if (lost) netBallGone(b.id);
    } else { // somebody else's: on along its way till their next update
      b.vz -= 2 * dt; b.z = Math.max(0, b.z + b.vz * dt); if (b.z === 0 && b.vz < 0) b.vz = 0;
      const f = Math.max(0, 1 - (b.z > 0 ? 0.2 : 1.1) * dt); b.vx *= f; b.vy *= f;
      if (!ballBlocked(b.x + b.vx * dt, b.y + b.vy * dt, b.z)) { b.x = worldCoord(b.x + b.vx * dt); b.y = worldCoord(b.y + b.vy * dt); }
    }
  }
}
function netBallGone(id) { // (gone for good: everyone drops it, and nobody's late update brings it back for a few seconds)
  net.balls.delete(id); net.ballGone.set(id, netNow() + 3);
  if (id === netMyBallId()) net.myBall = null;
  net.tx.send('ballGone', { id });
}
function netReclaimBall() { // (goods.js's pickUpBall: your own ball, when someone else has been running it, is yours to pick up)
  const b = net.on && net.balls.get(netMyBallId());
  if (!b || ball || Math.hypot(rel(b.x - px), rel(b.y - py)) > 0.3) return false;
  net.balls.delete(b.id); ball = b; net.myBall = b; net.myBallT = netNow();
  return true;
}
const netOwnBallNear = () => { const b = net.on && net.balls.get(netMyBallId()); return !!b && Math.hypot(rel(b.x - px), rel(b.y - py)) < 0.3; };
function netDrawBalls() {
  if (!net.on || !net.balls.size || mode === 'room') return;
  const mine = ball;
  try { for (const b of net.balls.values()) { ball = b; drawBall(); } } finally { ball = mine; }
}

// ---- peeing: theirs runs through your own pee.js, drop by drop, from where they stand the way they're aimed, so the
// arc, the splashes on the wall and the puddle are all there for you as they are for them. And you hear it, close up.
let netPeeVoice = null;
function netPeeFrame(dt) {
  let nearest = Infinity;
  const at = placeKey(), rk = netRoomKey();
  if (net.on && at !== null && !paused) for (const p of net.peers.values()) {
    if (!p.hello || p.mismatch || p.stale) continue;
    const s = netViewOf(p);
    if (!s || !s.pee || s.rk !== rk || !NET_ON_FOOT.has(s.mode)) continue;
    const inRoom = mode === 'room', sc = inRoom ? 1 : 0.1, d = inRoom ? Math.hypot(s.x - px, s.y - py) : Math.hypot(rel(s.x - px), rel(s.y - py));
    nearest = Math.min(nearest, d / sc);
    if (d / sc > 40) continue; // (out of sight: no point)
    const { el, flow, loo } = s.pee, hip = s.z + 0.9 * sc;
    for (let n = Math.round(PEE_RATE * dt + Math.random() * 0.5); n > 0; n--) {
      const wob = Math.sin(T * 6 + p.ph) * 0.05 + Math.sin(T * 1.7) * 0.09, x = s.x + Math.cos(s.a) * 0.25 * sc, y = s.y + Math.sin(s.a) * 0.25 * sc;
      let ang = s.a + wob, sp = (1.5 + flow * 4.5) * Math.cos(el), up = Math.sin(el) * (1.5 + flow * 4.5);
      if (loo) { // (at a toilet: into the bowl, as yours goes)
        const dd = Math.hypot(loo[0] - x, loo[1] - y), fall = Math.max(0.05, hip - LOO_TOP);
        up = 0.4 + flow * 0.7; ang = Math.atan2(loo[1] - y, loo[0] - x); sp = dd * 9.8 / (up + Math.sqrt(up * up + 2 * 9.8 * fall));
      }
      peeDrops.push({ at, s: sc, x, y, z: hip, vx: Math.cos(ang) * sp * sc, vy: Math.sin(ang) * sp * sc, vz: (up + (Math.random() - 0.5) * 0.15) * sc, t0: T, n: peeN++ });
    }
    while (peeDrops.length > 400) peeDrops.shift();
  }
  // the sound: theirs, by how near the nearest is (yours plays itself, pee.js)
  const vol = !pee && nearest < 15 ? 0.22 * (1 - nearest / 15) : 0;
  if (!actx) return;
  if (vol > 0 && !netPeeVoice) {
    netPeeVoice = { gain: null, source: null, loading: true };
    clipBuffer('piss_seamless').then(buf => {
      if (!buf || !netPeeVoice || !netPeeVoice.loading) return;
      const source = actx.createBufferSource(), gain = actx.createGain();
      source.buffer = buf; source.loop = true; gain.gain.value = 0; source.connect(gain); gain.connect(sfxBus); source.start();
      Object.assign(netPeeVoice, { source, gain, loading: false });
    });
  }
  if (netPeeVoice && netPeeVoice.gain) netPeeVoice.gain.gain.setTargetAtTime(vol, actx.currentTime, 0.1);
  if (netPeeVoice && !vol && netPeeVoice.gain) { const v = netPeeVoice; netPeeVoice = null; v.source.stop(actx.currentTime + 0.4); v.source.onended = () => { v.source.disconnect(); v.gain.disconnect(); }; }
  else if (netPeeVoice && !vol && netPeeVoice.loading) netPeeVoice = null;
}

// everyone else for the maps (hud.js's minimap, bigmap.js): where they are in the city; inside somewhere, at the door
// they went in by (it's in their room key: 'kind:x,y')
function netMapPlayers() {
  const out = [];
  if (!net.on) return out;
  for (const p of net.peers.values()) {
    if (!p.hello || p.mismatch) continue;
    const s = p.snaps[p.snaps.length - 1] || p.view;
    if (!s) continue;
    let loc = s.loc;
    if (!loc) {
      loc = { x: s.x, y: s.y, inside: s.mode === 'room' };
      if (loc.inside) { const m = /:(-?[\d.]+),(-?[\d.]+)$/.exec(s.rk); if (!m) continue; loc.x = +m[1]; loc.y = +m[2]; }
    }
    out.push({ ...loc, id: p.id, name: p.name, col: NET_CSS[p.hello.look.top], status: p.stale ? 'Last seen' : loc.inside ? 'Inside · ' + s.rk.split(':')[0] : s.mode === 'ride' || s.mode === 'taxi' ? 'Riding' : s.veh ? 'Driving' : s.craft ? 'Travelling' : 'On foot' });
  }
  return out;
}
function netPlayerPlaces() { return netMapPlayers().map(p => ({ ...p, id: 'player:' + p.id, category: 'players', kind: 'player', color: p.col, description: 'Multiplayer player · ' + p.status })); }
let netMapRefreshT = -1;
function netRefreshMapPlaces(force = false) {
  const now = performance.now();
  if (!force && now - netMapRefreshT < 500) return;
  netMapRefreshT = now;
  BIGMAP.places = BIGMAP.places.filter(p => p.kind !== 'player').concat(netPlayerPlaces());
  mapPlaceCache = null;
  if(mapWaypoint?.id.startsWith('player:')){const p=BIGMAP.places.find(p=>p.id===mapWaypoint.id);if(!p){mapWaypoint=null;MAP_NAV.path=null;}else if(mapDistance(p,mapWaypoint)>.2){mapWaypoint={id:p.id,name:p.name,x:p.x,y:p.y};MAP_NAV.path=null;MAP_NAV.routeFrom=null;}}
}

// ---- over the frame: their names, their speech bubbles (and yours, when you can see yourself), the chat log
function netProject(vx, vy, z) {
  const depth = dx * vx + dy * vy;
  if (depth < 0.05 || depth > vis) return null;
  const sc = projX / depth;
  return { c: cols / 2 + (-dy * vx + dx * vy) * sc, r: hor - (z - eye) * projY / depth, depth };
}
function netSeen(vx, vy, z0, h, depth, radius) { // is anything nearer than their near side in the way (a wall, a car)? At the chest and the head
  for (const f of [0.55, 0.9]) {
    const q = netProject(vx, vy, z0 + h * f);
    if (!q) continue;
    const c = Math.floor(q.c), r = Math.floor(q.r);
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    const zb = ZB[r * cols + c];
    if (!(zb > 0 && zb < depth - radius)) return true;
  }
  return false;
}
function netBubbleAt(x, y, lines, alpha) {
  g.font = FS + 'px monospace';
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + 12, h = lines.length * FS + 8, left = clamp(x - w / 2, 2, cv.width - w - 2), top = y - h - 6;
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(8,10,12,0.88)'; g.fillRect(left, top, w, h);
  g.strokeStyle = '#cdd'; g.lineWidth = 1; g.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
  g.fillStyle = '#cdd'; g.fillText('v', clamp(x, left + 4, left + w - 12) - g.measureText('v').width / 2, top + h - 4);
  g.fillStyle = '#fff'; lines.forEach((l, k) => g.fillText(l, left + 6, top + 4 + k * FS));
  g.globalAlpha = 1;
  return top;
}
function netOverlay() {
  if (!net.on && !net.chat.length) return;
  const now = netNow(), inRoom = mode === 'room';
  if (net.on) {
    g.font = FS + 'px monospace';
    for (const p of net.peers.values()) {
      const s = p.view;
      if (!p.hello || p.mismatch || !p.drawn || !s) continue;
      const vx = inRoom ? s.x - px : rel(s.x - px), vy = inRoom ? s.y - py : rel(s.y - py), h = inRoom ? 1.8 : s.veh ? 0.12 : 0.175;
      const head = netProject(vx, vy, s.z + h);
      if (!head) continue;
      const far = inRoom ? 0 : head.depth, fade = clamp(1.4 - far / 22, 0, 1);
      if (fade <= 0 || !netSeen(vx, vy, s.z, h, head.depth, inRoom ? 0.6 : s.veh ? 0.4 : 0.06)) continue;
      const x = head.c * cw, y = head.r * FS - 4; // (just over the top of their head, or the car's roof)
      let tagTop = y;
      const riders = s.veh && s.veh.id ? [...net.peers.values()].filter(q => q.hello && q.view && q.view.ride === s.veh.id).map(q => q.name) : [];
      if (riders.length) p.tagName = p.name + ' + ' + riders.join(', '); else p.tagName = p.name; // (and whoever's riding with them)
      const tag = p.tagName + (s.peaceful ? ' ~' : '') + (s.away ? ' (paused)' : '') + (s.stars ? ' ' + '*'.repeat(s.stars) : '');
      if (fade > 0.05) { // the name: small, over their head
        const w = g.measureText(tag).width;
        g.globalAlpha = fade * 0.9; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w / 2 - 3, y - FS - 2, w + 6, FS + 2);
        g.fillStyle = NET_CSS[p.hello.look.top]; g.fillText(p.tagName, x - w / 2, y - FS);
        let tx = x - w / 2 + g.measureText(p.tagName).width;
        if (s.peaceful) { g.fillStyle = '#9db'; g.fillText(' ~', tx, y - FS); tx += g.measureText(' ~').width; } // (peaceful)
        if (s.away) { g.fillStyle = '#9ab'; g.fillText(' (paused)', tx, y - FS); tx += g.measureText(' (paused)').width; }
        if (s.stars) { g.fillStyle = '#f55'; g.fillText(' ' + '*'.repeat(s.stars), tx, y - FS); }
        g.globalAlpha = 1; tagTop = y - FS - 2;
      }
      if (p.bubble && p.bubble.until > now && (inRoom || head.depth < 20)) netBubbleAt(x, tagTop, p.bubble.lines, clamp((p.bubble.until - now) * 2, 0, 1) * Math.max(0.35, fade));
    }
    // your own, over you, when the camera's behind you (in the car, on the board)
    if (net.bubble && net.bubble.until > now && (chaseOn && me || skateView)) {
      const [sx, sy, sz] = chaseOn && me ? [me.x, me.y, roadGroundHeight(me.x, me.y) + 0.16] : [skateView.x, skateView.y, skateGround(skateView.x, skateView.y) + 0.22];
      const q = netProject(rel(sx - px), rel(sy - py), sz);
      if (q) netBubbleAt(q.c * cw, q.r * FS, net.bubble.lines, clamp((net.bubble.until - now) * 2, 0, 1));
    }
  }
  // the log, bottom left: the last few lines for a while after they come in; everything recent while you're typing
  const typing = netTyping(), keep = typing ? 14 : 6, recent = net.chat.filter(m => typing || now - m.t < 12).slice(-keep);
  if (!recent.length) return;
  g.font = FS + 'px monospace';
  const maxW = Math.min(560, cv.width - 24), bottom = cv.height - (typing ? 48 : Math.max(96, cv.height * 0.18));
  const rowsOut = [];
  for (const m of recent) {
    const lines = wrapText((m.who ? m.who + ': ' : '') + m.text, maxW);
    lines.forEach((l, k) => rowsOut.push({ l, m, first: k === 0 }));
  }
  rowsOut.splice(0, Math.max(0, rowsOut.length - keep - 2));
  rowsOut.forEach((row, k) => {
    const y = bottom - (rowsOut.length - k) * (FS + 2), age = now - row.m.t, alpha = typing ? 1 : clamp((12 - age) / 2, 0, 1);
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(4, y - 1, g.measureText(row.l).width + 8, FS + 2);
    if (row.first && row.m.who) {
      const name = row.m.who + ': ';
      g.fillStyle = row.m.col; g.fillText(name, 8, y);
      g.fillStyle = '#eee'; g.fillText(row.l.slice(name.length), 8 + g.measureText(name).width, y);
    } else { g.fillStyle = row.m.who ? '#eee' : row.m.col; g.fillText(row.l, 8, y); }
  });
  g.globalAlpha = 1;
}

// ---- the menu: Esc, then Multiplayer
let netMenuEl = null;
const netMenuOpen = () => !!netMenuEl && netMenuEl.style.display === 'flex';
const netInviteLink = code => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', code); if (NET_TRANSPORT === 'local') u.searchParams.set('net', 'local'); return u.href; };
const netEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function netSuggestCode() { const w = ['harbour', 'neon', 'tram', 'lantern', 'pier', 'alley', 'rooftop', 'ferry', 'arcade', 'noodle']; return w[Math.random() * w.length | 0] + '-' + netRandomId().slice(0, 4); }
function buildNetMenu() {
  const prefs = netLoadPrefs();
  const field = (k, label, max, value) => `<label style="display:flex;gap:12px;align-items:center;margin:10px 0"><span style="width:110px;color:#9ab">${label}</span>
    <input data-net="${k}" maxlength="${max}" value="${netEsc(value)}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0;box-sizing:border-box;font:inherit;color:#eee;background:${f.act==='whisper'?'transparent':'#000'};border:${f.act==='whisper'?'0':'1px solid #567'};padding:6px 8px"></label>`;
  const el = menuEl('netmenu', 520, `
    <div class="panel" role="dialog" aria-label="Multiplayer" style="width:min(480px, calc(100vw - 32px))">
      <h1>Multiplayer</h1>
      <p class="sub" data-net="about"></p>
      ${field('name', 'Your name', NET_NAME_MAX, prefs.name || '')}
      ${field('code', 'Room code', NET_CODE_MAX, net.code || netPendingCode || netSuggestCode())}
      <button class="item" data-net-act="appearance">Customize character</button>
      <button class="item" data-net-act="join">Join room</button>
      <button class="item" data-net-act="copy">Copy invite link</button>
      <button class="item" data-net-act="leave">Leave room</button>
      <button class="item" data-net-act="peaceful">Peaceful <span class="k" data-net="peaceful" style="margin-left:auto"></span></button>
      <p class="sub" data-net="status"></p>
      <div data-net="peers" style="margin:6px 0 12px"></div>
      <p class="sub" data-net="chathelp" style="display:${NET_FEATURES.chat ? 'block' : 'none'}">In a room: T or Enter to chat.</p>
      <button class="item" data-net-act="back">Back</button>
    </div>`);
  el.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); closeNetMenu(); }
    else if (e.code === 'Enter' && e.target.matches('input')) { e.preventDefault(); el.querySelector('[data-net-act="join"]').click(); }
    e.stopPropagation(); // (typing a name never reaches the game)
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-net-act]');
    if (!b) return;
    const name = el.querySelector('[data-net="name"]').value, code = el.querySelector('[data-net="code"]').value;
    if (b.dataset.netAct === 'appearance') openAppearance('multiplayer');
    if (b.dataset.netAct === 'join') netJoin(code, name);
    if (b.dataset.netAct === 'leave') netLeave();
    if (b.dataset.netAct === 'peaceful') { net.peaceful = !net.peaceful; netSavePrefs({ peaceful: net.peaceful }); netMenuShow(); }
    if (b.dataset.netAct === 'back') closeNetMenu();
    if (b.dataset.netAct === 'copy') {
      const link = netInviteLink(netCode(code) || net.code);
      Promise.resolve(navigator.clipboard?.writeText(link)).then(() => netStatus('Invite link copied: ' + link), () => netStatus('Invite link: ' + link));
    }
  });
  return el;
}
function netMenuShow() {
  if (!netMenuOpen()) return;
  const el = netMenuEl;
  el.querySelector('[data-net="about"]').textContent = `Your friends walking and driving about in your city${NET_FEATURES.clock ? ', at the same time and in the same weather' : ''}. Everyone keeps their own city, money, things and saves.`;
  el.querySelector('[data-net="peaceful"]').textContent = net.peaceful ? '[x] on: nobody can hurt or rob you, nor you them' : '[ ] off';
  el.querySelector('[data-net="status"]').textContent = net.status || (net.on ? `In room "${net.code}".` : 'Not connected.');
  el.querySelector('[data-net-act="leave"]').style.display = net.on || net.joining ? 'flex' : 'none';
  el.querySelector('[data-net-act="join"]').firstChild.textContent = net.on ? 'Join a different room' : 'Join room';
  const others = [...net.peers.values()].filter(p => p.hello);
  el.querySelector('[data-net="peers"]').innerHTML = net.on ? (others.length
    ? others.map(p => `<div style="color:${NET_CSS[p.hello.look.top]}">${netEsc(p.name)}${p.mismatch ? ' <span style="color:#f96">(different version)</span>' : ''}</div>`).join('')
    : '<div style="color:#789">Nobody else here yet.</div>') : '';
}
function openNetMenu() {
  netMenuEl = netMenuEl || buildNetMenu();
  netMenuEl.style.display = 'flex';
  if (net.on && net.peers.size) net.status = `In room "${net.code}".`;
  netMenuShow();
  const name = netMenuEl.querySelector('[data-net="name"]');
  (name.value ? netMenuEl.querySelector('[data-net-act="join"]') : name).focus();
}
function closeNetMenu() {
  if (!netMenuEl) return;
  netMenuEl.style.display = 'none';
  pauseEl?.querySelector('[data-act="multiplayer"]')?.focus();
}
// a link with ?room=code: that room's filled in, and you're told how to join it
let netPendingCode = '';
try { netPendingCode = netCode(new URLSearchParams(location.search).get('room') || ''); } catch (e) { /* no query */ }
if (netPendingCode) setTimeout(() => say(`You've been invited to room "${netPendingCode}". Esc, then Multiplayer, to join.`, 10), 1500);
