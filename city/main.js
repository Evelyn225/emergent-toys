// closing a menu with E, I or J (a key press the browser lets us use) takes the mouse straight back; Esc leaves it
// free, like any other page, and a click takes it back
function relock(e) {
  if (e.code === 'Escape' || paused || document.pointerLockElement) return;
  lockMouse();
}
onkeydown = e => {
  if (bustedKey(e)) return; // caught: nothing till you've chosen
  if (gameKey(e)) { if (!game) relock(e); return; } // at a cabinet or on a shift
  if (!e.repeat && prizeKey(e)) return relock(e);
  if (!e.repeat && panelKey(e)) return relock(e); // a shop or the inventory is open (and may just have closed)
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) return togglePause();
  if (e.code === 'KeyE' && paused && pauseEl && pauseEl.style.display !== 'none' && !e.repeat) return closePause(true); // E resumes too (and takes the mouse back)
  if (paused) return;
  K[e.code] = 1;
  if (e.repeat) return;
  audioStart(); // sound can only start from a key press or click
  if (e.code === 'KeyN') toggleSound();
  if (e.code === 'KeyE' && !sleep) interact();
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
  if (onFoot && !sleep) {
    if (e.code === 'KeyQ') useHeldItem();
    if (e.code === 'Space') jump();
    if (e.code === 'KeyC') { if (body.seat) standUp(); else sitDown(); } // (held without a seat near: crouch)
    if (e.code === 'KeyI') openInventory();
    if (e.code === 'KeyX') dropHere();
    const slot = /^Digit([1-8])$/.exec(e.code);
    if (slot && inv[slot[1] - 1] && !(mode === 'room' && room.kind === 'train')) holdSlot(slot[1] - 1); // again: put it away
    if (e.code === 'Digit0' || e.code === 'Backquote') held = -1; // empty your hands
    if (e.code === 'KeyG' || e.code === 'KeyL') crimeKey(e.code); // pickpocket / shoplift / lockpick
    if (e.code === 'KeyB' && heldItem() && heldItem().id === 'boombox' && fx.boombox) { say(`Next tape: ${nextSong()}.`, 2); if (actx) sfxUse('click'); }
  }
  if (e.code === 'KeyH') hail();
  if (e.code === 'KeyG' && mode === 'taxi') tipDriver();
  if (e.code === 'KeyJ' && mode === 'walk') { const c = nearestCar(0.5); if (c && c.body === TAXI && c.v < 0.6) startTaxiShift(c); }
  if (e.code === 'KeyV' && me) third = !third;
  if (e.code === 'KeyM') showMap = !showMap;
  if (e.code === 'KeyY') { weather = WEATHER_NEXT[weather]; wTimer = 150; say(`Weather: ${weather}`); }
  const n = /^Digit([1-6])$/.exec(e.code);
  if (n && mode === 'taxi' && !me.dest && (n[1] !== '6' || owned.homes.length)) setDest(+n[1]);
  if (n && mode === 'room' && room.kind === 'train' && room.dest == null && +n[1] <= room.opts.length) { room.dest = room.opts[n[1] - 1]; room.rideT = 9; }
};
onkeyup = e => K[e.code] = 0;
cv.onclick = () => { audioStart(); if (!paused) lockMouse(); };
// how far you can look down / up; behind the wheel (or in the back of a cab) only a little down, not at your feet
const clampPitch = () => pitch = clamp(pitch, me ? -0.3 : -1.2, 1.6);
// turn your head by (mx, my) mouse pixels' worth (the mouse, or a drag on a touch screen)
function turnBy(mx, my) {
  if (paused || game) return;
  const s = settings.sensitivity;
  if (mode === 'taxi' || mode === 'fair' && fairRide.kind === 'carousel') look += mx * 0.003 * s; else if (mode !== 'drive') a += mx * 0.003 * s;
  pitch -= my * 0.002 * s * (settings.invertY ? -1 : 1); clampPitch();
}
onmousemove = e => { if (document.pointerLockElement) turnBy(e.movementX, e.movementY); };

const free = (x, y) => {
  if (mode === 'room') return !ROOMW.cell(Math.floor(x), Math.floor(y)) && !(room.def.block && room.def.block(x, y)) &&
    !room.props.some(s => s.box && !s.walk && s.box.z0 < 1.2 && inBox(s.box, x, y, 0.2) || s.bench && Math.hypot(x - s.x, y - s.y) < 0.5); // furniture
  if (mode === 'roof') return map[idx(Math.floor(x), Math.floor(y))] === roofH; // stay on this roof
  if (mode === 'elplat') return mod(x - plat.s.x0, N) < plat.s.x1 - plat.s.x0 && Math.abs(y - EL_PLAT[plat.tr]) < 0.14; // on the platform
  return !map[idx(Math.floor(x), Math.floor(y))] && !isWater(x, y) && !(mode === 'walk' && machineAt(x, y, 0.02)) && !solidAt(x, y, 0.03) && !fairBlocked(x, y, 0.03) && !(mode === 'walk' && gateShutHere(x, y)) &&
    Math.hypot(rel(x - LIGHTHOUSE.x), rel(y - LIGHTHOUSE.y)) > LIGHTHOUSE.r; // you walk round the lighthouse
};
function move(fx, fy) {
  const m = mode === 'room' ? 0.25 : 0.05;
  // walking into a way out (a shop's door, the top of the subway stairs) takes you through it
  const n = Math.hypot(fx, fy);
  if (mode === 'room' && n > 0 && roomAt(Math.floor(px + fx / n * 0.45), Math.floor(py + fy / n * 0.45)) === 'D') return leaveRoom();
  if (free(px + fx + Math.sign(fx) * m, py)) px += fx;
  if (free(px, py + fy + Math.sign(fy) * m)) py += fy;
}
const CRASH_V = 1; // 36 km/h (1 unit/s = 10 m/s): slower than this and you've only bumped into something
function drive(dt) {
  const spun = me.spunT > T; // spun out by the police: no say in it till you've stopped turning
  const c = me, f = spun ? 0 : (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = spun ? 0 : (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  if (spun) { c.v *= 1 - 2.5 * dt; a += dt * 5 * Math.min(1, Math.abs(c.v) * 2 + 0.3) * (me.spunT - T) / 2.5; }
  if (f > 0) c.v += (c.v < 0 ? 2.5 : 1) * dt; else if (f < 0) c.v -= (c.v > 0 ? 2.5 : 0.8) * dt; else c.v *= 1 - 0.7 * dt;
  c.v = clamp(c.v, -0.5, K.ShiftLeft || K.ShiftRight ? c.boost || 3.2 : c.top || 2.2); // (a car you own goes as fast as its model)
  a += s * dt * 1.8 * clamp(c.v / 0.5, -1, 1);
  const hx = Math.cos(a), hy = Math.sin(a), nx = c.x + hx * c.v * dt, ny = c.y + hy * c.v * dt;
  const fx = nx + hx * 0.22 * Math.sign(c.v), fy = ny + hy * 0.22 * Math.sign(c.v); // bumper
  const hitCar = cars.find(o => o !== c && Math.hypot(rel(o.x - fx), rel(o.y - fy)) < 0.3);
  const hitPerson = people.find(p => !p.hidden && Math.hypot(rel(p.x - fx), rel(p.y - fy)) < 0.15) || footCops.find(p => Math.hypot(rel(p.x - fx), rel(p.y - fy)) < 0.15);
  const hit = !free(fx, fy) || hitCar || hitPerson;
  if (hit) { // a real crash only above CRASH_V; anything slower is a bump
    const sp = Math.abs(c.v);
    if (hitPerson && sp > 0.4) { hitPerson.talk = 3; say(pick(['"Watch it!"', '"Are you CRAZY?"', '"Hey! You hit me!"']), 2); crime('hit', c.x, c.y); } // you hit someone
    if (sp > CRASH_V) { say('*CRUNCH*', 1); taxiCrash(); if (actx) playClip('crash', clamp(0.3 + (sp - CRASH_V) * 0.35, 0.3, 0.8)); if (hitCar && !hitCar.player) crime('crash', c.x, c.y); }
    else if (sp > 0.2 && actx) tone(actx.currentTime, 70, 0.12, 0.08 * sp); // a soft thud
    c.v = 0;
  } else { c.x = mod(nx, N); c.y = mod(ny, N); }
  c.hx = hx; c.hy = hy; c.brake = f < 0; px = c.x; py = c.y;
  const road = ROAD[idx(Math.floor(c.x), Math.floor(c.y))]; // into a junction on red, right in front of a cop
  if (road === 3 && c.lastRoad && c.lastRoad !== 3 && Math.abs(c.v) > 0.4) {
    const ix = Math.floor(c.x / 8) * 8, iy = Math.floor(c.y / 8) * 8;
    if (signalled(ix, iy) && light(ix, iy, Math.abs(hy) > Math.abs(hx), T) === 'R' && redLightCrime(c.x, c.y)) say('A siren whoops behind you.', 2);
  }
  c.lastRoad = road;
  c.off = 0; c.ex = c.x; c.ey = c.y; // where it's drawn and where traffic sees it: right here
}

let t0 = performance.now();
function loop(t) {
  if (paused) { t0 = t; requestAnimationFrame(loop); return; } // frozen: the last frame stays up under the menu
  const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; T += dt; msgT -= dt;
  env(dt);
  if (!game && FS !== DETAIL[settings.detail]) { FS = DETAIL[settings.detail]; resize(); } // a game shrank the text to fit
  if (game) { // a cabinet or a shift has the screen; the world carries on behind it
    stepTraffic(dt, T); stepGame(dt); if (game) drawGame(); audioTick(dt);
    requestAnimationFrame(loop); return;
  }
  if (sleep) stepSleep(dt);
  pitch += ((K.KeyR ? 1 : 0) - (K.KeyF ? 1 : 0)) * dt; clampPitch();
  if (!sleep && (mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat')) {
    a += ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
    const run = K.ShiftLeft || K.ShiftRight, sp = (mode === 'room' ? (run ? 2.5 : 1.6) : run ? 0.8 : 0.5) * dt * (fx.caffeine > 0 ? 1.25 : 1) * (fx.skating && mode === 'walk' ? 1.8 : 1); // sprint 29 km/h, cars top out at 79
    const f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
    const cx = Math.cos(a), cy = Math.sin(a);
    const lurch = (f || s) ? Math.sin(T * 1.7) * 0.35 * Math.min(1, fx.booze) : 0; // drunk: you weave as you walk
    if (body.seat && (f || s)) standUp(); // walking gets you up
    if (!body.seat) move((cx * f - cy * (s + lurch)) * sp * footSlow(), (cy * f + cx * (s + lurch)) * sp * footSlow());
  } else if (mode === 'drive') drive(dt);
  else if (mode === 'fair') stepFair(dt);
  else if (mode === 'boat') stepBoat(dt);
  else if (mode === 'el') { // riding: you move with the train; look around with the mouse or arrows
    a += ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
    px = mod(elRiding().x + ride.off, N);
  }
  stepBody(dt);
  stepTraffic(dt, T);
  stepTask(dt);
  stepLaundry();
  stepEvents(dt);
  stepGardens(dt);
  stepHaze(dt);
  stepTaxiJob(dt);
  const law = stepCrime(dt);
  if (law === 'busted') openBusted();
  else if (law === 'lost') say('You lost them.', 3);
  else if (law === 'pullover') say('"PULL OVER!" booms from the cruiser on your tail.', 3);
  else if (law === 'pit') { say('The cruiser clips your back corner and you spin out.', 3); if (actx) playClip('crash', 0.6); }
  else if (law === 'cab') { // your cabbie, pulled over for it: he's cuffed, you're out on the sidewalk
    const c = me; leaveCar(); c.v = 0; c.stopT = T + 25;
    say(pick(['A cruiser lights up behind you. "License and registration." They cuff your driver.', '"Out of the cab, sir." Your driver gets arrested. You walk from here.']), 5);
  }
  if (fract(T / 2) < dt / 2) tidyPolice();
  if (stepGoods(dt) === 'lost') say('Splash. The ball floats away.');
  if (mode === 'taxi') {
    px = me.x; py = me.y;
    const target = Math.atan2(me.hy, me.hx) + look; // camera eases round corners
    a += (mod(target - a + Math.PI, 2 * Math.PI) - Math.PI) * Math.min(1, dt * 4);
    if (me.arrived && me.v < 0.02) leaveCar();
  }
  if (mode === 'room' && room.kind === 'train' && room.dest != null) { // the ride: speed up, cruise, slow down, arrive
    room.rideT -= dt;
    room.track += dt * 2.5 * clamp(room.rideT / 2, 0, 1) * clamp((9 - room.rideT) / 2, 0, 1);
    if (room.rideT <= 0) arriveAt(room.dest);
  }
  chaseOn = !!me && third;
  if (chaseOn) { // render from behind the car, then put the real position back
    const saved = [px, py, a], [cx, cy, yaw] = chaseCam(dt);
    px = cx; py = cy; a = yaw; render(dt); [px, py, a] = saved;
  } else { // a drink or two and the world sways; more and you're seeing double
    camYaw = a; const wob = Math.min(1.3, fx.booze);
    const sa = (Math.sin(T * 0.9) * 0.07 + Math.sin(T * 2.3) * 0.02) * wob, sp_ = (Math.sin(T * 1.3) * 0.04 + Math.sin(T * 3.1) * 0.01) * wob;
    a += sa; pitch += sp_; render(dt); a -= sa; pitch -= sp_;
    if (wob > 0.08) drunkVision(wob);
  }
  audioTick(dt);
  requestAnimationFrame(loop);
}
// double vision: a ghost of the frame laid over itself, drifting apart and back, stronger the more you've had
function drunkVision(wob) {
  const k = Math.min(1, wob), ox = Math.sin(T * 0.7) * 18 * k + 4 * k, oy = Math.cos(T * 0.53) * 6 * k;
  g.save(); g.globalAlpha = 0.18 + 0.22 * k; g.drawImage(cv, ox, oy); g.restore();
}
// third person: behind and above the car, easing round corners; pulled in if a wall is in the way
function chaseCam(dt) {
  const target = mode === 'taxi' ? a : Math.atan2(me.hy, me.hx);
  camYaw += (mod(target - camYaw + Math.PI, 2 * Math.PI) - Math.PI) * Math.min(1, dt * 5);
  const bx = Math.cos(camYaw), by = Math.sin(camYaw);
  let back = 1.1;
  while (back > 0.15 && !free(me.x - bx * back, me.y - by * back)) back -= 0.05;
  return [me.x - bx * back, me.y - by * back, camYaw];
}
// ?goto=ARCADE (any shop sign: HOSPITAL, PAWN, KARAOKE...) starts you on the sidewalk outside the nearest one, facing
// its door: for finding things, and for trying them out
function gotoShop(word) {
  let best = null, bd = Infinity;
  for (let k = 0; k < N * N; k++) {
    const sh = SHOP[k];
    if (!sh || sh.word !== word) continue;
    const x = k % N, y = k / N | 0;
    for (const [ox, oy, ang] of [[0, 1, -Math.PI / 2], [0, -1, Math.PI / 2], [1, 0, Math.PI], [-1, 0, 0]]) { // a street cell beside it
      const nx = x + ox, ny = y + oy;
      if (map[idx(nx, ny)] || !ROAD[idx(nx, ny)]) continue;
      const d = Math.hypot(rel(x - px), rel(y - py));
      if (d < bd) { bd = d; best = { x: nx + 0.5 - ox * 0.3, y: ny + 0.5 - oy * 0.3, a: ang, sh }; }
    }
  }
  if (!best) return say(`No ${word} in town.`);
  px = mod(best.x, N); py = mod(best.y, N); a = best.a; pitch = 0;
  say(`Outside ${word}. ${openAt(best.sh, tod) ? 'Walk up and press E.' : `Closed, opens at ${best.sh.hours[0]}:00.`}`, 5);
}
{ const w = new URLSearchParams(location.search).get('goto'); if (w) gotoShop(w.toUpperCase()); }
requestAnimationFrame(loop);

// the mouse wheel cycles what's in your hand
addEventListener('wheel', e => { if (!paused && inv.length) held = mod(held + 1 + Math.sign(e.deltaY), inv.length + 1) - 1; }, { passive: true }); // (round through empty hands too)
