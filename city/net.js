// ---- multiplayer: the connection, other players drawn in the city, chat, the shared clock and the join menu
// (MULTIPLAYER_PLAN.md; the rules and checks are in net-core.js). Players connect straight to each other over WebRTC
// (Trystero, vendored in vendor/trystero.js), so there's no game server. ?net=local swaps in a BroadcastChannel
// transport: two tabs on one machine, no network at all, for development and the browser tests.
const NET_TRYSTERO_URL = './vendor/trystero.js', NET_APP_ID = 'glyphport-ascii-city';
const NET_TRANSPORT = (() => { try { return new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'trystero'; } catch (e) { return 'trystero'; } })();
const NET_TYPES = ['tick', 'hello', 'chat', 'clock', 'bolt']; // every message kind (Trystero needs them all up front)
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
    for (const [id, t] of seen) if (netNow() - t > 4) { seen.delete(id); tx.onLeave?.(id); }
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
  Object.assign(net, { on: true, joining: false, code, name, selfId: tx.selfId, tx, look: netLookFor(name), peers: new Map(), clockOwner: true,
    joinedT: performance.now() / 1000, aloneSaid: false, sendT: 0, clockT: 0, lastBolt: bolt, lastWeather: weather, bubble: null, chatBucket: {} });
  tx.onJoin = netPeerJoined; tx.onLeave = netPeerLeft; tx.onMessage = netReceive;
  tx.onError = text => { netLog('A connection failed (' + text + '). Their network may need a relay server.', null, '#f96'); netMenuShow(); };
  netLog(`You're in room "${code}". Invite friends with the link from the multiplayer menu.`);
  netStatus(`In room "${code}". Waiting for others...`);
}
function netLeave() {
  net.joining = false;
  if (!net.on) return;
  try { net.tx.leave(); } catch (e) { /* gone */ }
  const was = net.clockOwner;
  Object.assign(net, { on: false, tx: null, peers: new Map(), clockOwner: true, bubble: null });
  if (!was && NET_FEATURES.clock) wTimer = 60 + Math.random() * 90; // your own weather again
  netLog('You left the room.');
  netStatus('Not connected.');
}
addEventListener('pagehide', () => { if (net.on) net.tx.leave(); });

function netPeerJoined(id) {
  if (!net.on || net.peers.has(id)) return;
  if (net.peers.size >= NET_MAX_PEERS) return; // the room's full: they're not drawn or listened to
  net.peers.set(id, { id, name: '', hello: null, snaps: [], seenT: netNow(), ph: 0, chatBucket: {}, bubble: null });
  net.tx.send('hello', { name: net.name, ver: netBuildId(), look: net.look }, id);
  netReclock();
}
function netPeerLeft(id) {
  const p = net.peers.get(id);
  if (!p) return;
  net.peers.delete(id);
  if (p.hello) netLog(`${p.name} left.`);
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
    p.hello = h; p.name = h.name; p.mismatch = h.ver !== netBuildId(); p.figLook = null;
    if (first) netLog(p.mismatch ? `${p.name} is on a different version of the game. Both of you refresh the page.` : `${p.name} joined.`, null, p.mismatch ? '#f96' : '#9ab');
    if (net.clockOwner) net.clockT = 0;
    netMenuShow(); return;
  }
  if (!p.hello || p.mismatch) return;
  if (type === 'tick') { const s = netCheckTick(data); if (s) netPushSnap(p, s, now); return; }
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
function netFrame(t) {
  const now = t / 1000, dt = net.lastT ? clamp(now - net.lastT, 0, 0.25) : 0;
  net.lastT = now;
  if (!net.on) return;
  if ((paused || game || document.hidden) && netClockShared()) env(dt); // the shared clock keeps going while you're in a menu, at a cabinet or in another tab
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
}
// A tab in the background gets no animation frames, so the loop stops: keep sending and listening on a timer meanwhile
// (otherwise you'd freeze for everyone, and if you keep the clock, so would the time)
setInterval(() => { if (document.hidden && net.on) netFrame(performance.now()); }, 250);
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
  if (body.seat) return 'sit';
  if (heldGun() && gunAim() > 0.5) return 'aim';
  if (body.crouch > 0.5) return 'crouch';
  const [run, walk] = mode === 'room' ? [2, 0.3] : [0.65, 0.05];
  return speed > run ? 'run' : speed > walk ? 'walk' : 'stand';
}
function netSendTick(now) {
  const car = (mode === 'drive' || mode === 'taxi') && me ? me : null;
  const x = car ? car.x : px, y = car ? car.y : py, a_ = car ? Math.atan2(car.hy, car.hx) : a;
  const last = net.lastSent, gap = last ? now - last.t : 0;
  const speed = last && gap > 0 && last.rk === netRoomKey() ? Math.hypot(rel(x - last.x), rel(y - last.y)) / gap : 0;
  const it = heldItem();
  const s = { t: now, x, y, z: netSelfZ(), a: a_, mode, rk: netRoomKey(), pose: netSelfPose(speed), held: it ? it.id : '', stars: wanted.stars | 0 };
  if (skatingNow() && !car) s.sk = { yaw: SKB.yaw, nose: SKB.pitch, roll: SKB.roll, st: SK.stance };
  if (car) s.veh = { kind: car.kind, body: car.body, v: car.v, brake: !!car.brake, dmg: car.dmg || 0, patrol: !!car.patrol, ev: !!car.ev };
  net.lastSent = s;
  net.tx.send('tick', s);
}

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
let netChatEl = null;
const netTyping = () => !!netChatEl && netChatEl.style.display !== 'none';
function netOpenChat() {
  if (!netChatEl) {
    netChatEl = document.createElement('input');
    netChatEl.id = 'net-chat'; netChatEl.maxLength = NET_CHAT_MAX; netChatEl.autocomplete = 'off'; netChatEl.spellcheck = false;
    netChatEl.placeholder = 'Say something (Enter to send, Esc to cancel)';
    Object.assign(netChatEl.style, { position: 'fixed', left: '8px', bottom: '8px', width: 'min(560px, calc(100vw - 16px))', zIndex: 400, display: 'none',
      font: '14px monospace', color: '#eee', background: 'rgba(0,0,0,0.85)', border: '1px solid #678', padding: '6px 8px', outline: 'none' });
    netChatEl.addEventListener('keydown', e => {
      e.stopPropagation(); // (typing never reaches the game)
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); netSay(netChatEl.value); netCloseChat(); }
      else if (e.code === 'Escape') { e.preventDefault(); netCloseChat(); }
    });
    netChatEl.addEventListener('keyup', e => e.stopPropagation());
    netChatEl.addEventListener('blur', () => { if (netTyping()) netCloseChat(false); });
    document.body.appendChild(netChatEl);
  }
  for (const k in K) K[k] = 0; // (stop walking: the keys are for the message now)
  releaseHeldMouse(); releaseMouse();
  netChatEl.value = ''; netChatEl.style.display = 'block'; netChatEl.focus();
}
function netCloseChat(relockMouse = true) {
  if (!netChatEl) return;
  netChatEl.style.display = 'none'; netChatEl.blur();
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
  const l = p.hello.look, bot = [[BLUE, 5], [GRAY, 3], [BRICK, 4]][l.bot];
  return p.figLook = figLook({ hair: 'short', hat: 'beanie', top: 'long', bot: 'pants', bw: 1,
    col: { hair: [BRICK, 4], skin: [SKIN, 11], hat: [NET_COLOURS[l.hat], 11], hatD: [NET_COLOURS[l.hat], 7], top: [NET_COLOURS[l.top], 7], bot, shoe: [WHITE, 13], belt: [GRAY, 2] } });
}
const NET_ON_FOOT = new Set(['walk', 'room', 'roof', 'elplat', 'el', 'ferry', 'fair', 'ladder']);
function netVisible(p, s) { return s && s.rk === netRoomKey() && (mode === 'room' || Math.abs(rel(s.x - px)) < vis + 1 && Math.abs(rel(s.y - py)) < vis + 1); }
function drawPeers() {
  if (!net.on || !net.peers.size) return;
  const now = netNow(), inRoom = mode === 'room';
  for (const p of net.peers.values()) {
    if (!p.hello || p.mismatch || p.stale) { p.drawn = false; continue; }
    const s = p.view = netSample(p, now);
    if (!netVisible(p, s)) { p.drawn = false; continue; }
    const vx = inRoom ? s.x - px : rel(s.x - px), vy = inRoom ? s.y - py : rel(s.y - py), fx = Math.cos(s.a), fy = Math.sin(s.a);
    if (p.lastX !== undefined && p.lastRk === s.rk) p.ph += Math.hypot(rel(s.x - p.lastX), rel(s.y - p.lastY)) * (inRoom ? 3 : 30);
    p.lastX = s.x; p.lastY = s.y; p.lastRk = s.rk; p.drawn = true;
    if (s.veh && VEHICLES[s.veh.kind]) { // at the wheel: their car (it's only a picture of one: you can't get in or hit it yet)
      const car = p.car = Object.assign(p.car || { id: (hash(p.id.length, p.id.charCodeAt(0) || 0, 77) * 1e6) | 0 }, s.veh);
      drawVehicle(car, vx, vy, fx, fy);
      continue;
    }
    if (!NET_ON_FOOT.has(s.mode)) continue; // (on the water or in the air: just their name, for now)
    const gait = /^(walk|run)$/.test(s.pose) ? s.pose + (Math.floor(p.ph) & 7) : s.pose;
    if (s.sk && !inRoom) { // on the board: the deck under them, and them side on to it, front foot forward (as skate.js draws you)
      const sk = s.sk, ang = sk.yaw + sk.st * Math.PI / 2, look = netFigLook(p), pose = /^(ride|push|crouch|skateair|mongo)/.test(s.pose) ? s.pose : 'ride1';
      drawSkateBoard(vx, vy, s.z, sk.yaw, sk.nose, sk.roll);
      drawSkaterFigure(vx, vy, s.z + SB.up + SB.ht, SB.rider, Math.cos(ang), Math.sin(ang), look, pose, 5, [0, 0, 1], skaterFootAnchor(pose, look));
      continue;
    }
    if (inRoom) drawFigure(vx, vy, s.z, 1.8, fx, fy, netFigLook(p), gait, { light: 9, hold: p });
    else drawFigure(vx, vy, s.z, 0.175, fx, fy, netFigLook(p), gait, { light: 6, hold: p });
  }
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
      const tag = p.name + (s.stars ? ' ' + '*'.repeat(s.stars) : '');
      if (fade > 0.05) { // the name: small, over their head
        const w = g.measureText(tag).width;
        g.globalAlpha = fade * 0.9; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w / 2 - 3, y - FS - 2, w + 6, FS + 2);
        g.fillStyle = NET_CSS[p.hello.look.top]; g.fillText(p.name, x - w / 2, y - FS);
        if (s.stars) { g.fillStyle = '#f55'; g.fillText(' ' + '*'.repeat(s.stars), x - w / 2 + g.measureText(p.name).width, y - FS); }
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
    <input data-net="${k}" maxlength="${max}" value="${netEsc(value)}" autocomplete="off" spellcheck="false" style="flex:1;font:inherit;color:#eee;background:#000;border:1px solid #567;padding:6px 8px"></label>`;
  const el = menuEl('netmenu', 520, `
    <div class="panel" role="dialog" aria-label="Multiplayer" style="width:min(480px, calc(100vw - 32px))">
      <h1>Multiplayer</h1>
      <p class="sub" data-net="about"></p>
      ${field('name', 'Your name', NET_NAME_MAX, prefs.name || '')}
      ${field('code', 'Room code', NET_CODE_MAX, net.code || netPendingCode || netSuggestCode())}
      <button class="item" data-net-act="join">Join room</button>
      <button class="item" data-net-act="copy">Copy invite link</button>
      <button class="item" data-net-act="leave">Leave room</button>
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
    if (b.dataset.netAct === 'join') netJoin(code, name);
    if (b.dataset.netAct === 'leave') netLeave();
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
