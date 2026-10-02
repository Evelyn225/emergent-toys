// take the mouse back whenever the game runs without it. Browsers only allow that from a click or a key press, and
// not from Esc (Esc is the way out of a mouse lock), so after leaving a menu with Esc it comes back on your next key
function relock() {
  if (paused || document.pointerLockElement) return;
  const p = cv.requestPointerLock();
  if (p && p.catch) p.catch(() => {}); // refused (Esc, or too soon after the browser let go): the next key tries again
}
onkeydown = e => {
  if (!e.repeat && panelKey(e)) return relock(); // a shop or the inventory is open (and may just have closed)
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { togglePause(); return relock(); }
  if (paused) return;
  relock();
  K[e.code] = 1;
  if (e.repeat) return;
  audioStart(); // sound can only start from a key press or click
  if (e.code === 'KeyN') toggleSound();
  if (e.code === 'KeyE' && !sleep) interact();
  const onFoot = mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat';
  if (onFoot && !sleep) {
    if (e.code === 'KeyQ') useHeldItem();
    if (e.code === 'KeyI') openInventory();
    if (e.code === 'KeyX') { const d = dropHeld(); if (d) say(`You leave the ${d} behind.`); }
    const slot = /^Digit([1-8])$/.exec(e.code);
    if (slot && inv[slot[1] - 1] && !(mode === 'room' && room.kind === 'train')) held = slot[1] - 1;
  }
  if (e.code === 'KeyH') hail();
  if (e.code === 'KeyV' && me) third = !third;
  if (e.code === 'KeyM') showMap = !showMap;
  if (e.code === 'KeyY') { weather = { clear: 'rain', rain: 'fog', fog: 'clear' }[weather]; wTimer = 150; say(`Weather: ${weather}`); }
  const n = /^Digit([1-5])$/.exec(e.code);
  if (n && mode === 'taxi' && !me.dest) setDest(+n[1]);
  if (n && mode === 'room' && room.kind === 'train' && room.dest == null && +n[1] <= room.opts.length) { room.dest = room.opts[n[1] - 1]; room.rideT = 9; }
};
onkeyup = e => K[e.code] = 0;
cv.onclick = () => { audioStart(); if (!paused) cv.requestPointerLock(); };
const clampPitch = () => pitch = clamp(pitch, -1.2, 1.6);
onmousemove = e => {
  if (!document.pointerLockElement) return;
  if (paused) return;
  const s = settings.sensitivity;
  if (mode === 'taxi') look += e.movementX * 0.003 * s; else if (mode !== 'drive') a += e.movementX * 0.003 * s;
  pitch -= e.movementY * 0.002 * s * (settings.invertY ? -1 : 1); clampPitch();
};

const free = (x, y) => {
  if (mode === 'room') return !ROOMW.cell(Math.floor(x), Math.floor(y)) && !(room.def.block && room.def.block(x, y)) &&
    !room.props.some(s => s.box && !s.walk && s.box.z0 < 1.2 && inBox(s.box, x, y, 0.2) || s.bench && Math.hypot(x - s.x, y - s.y) < 0.5); // furniture
  if (mode === 'roof') return map[idx(Math.floor(x), Math.floor(y))] === roofH; // stay on this roof
  if (mode === 'elplat') return mod(x - plat.s.x0, N) < plat.s.x1 - plat.s.x0 && Math.abs(y - EL_PLAT[plat.tr]) < 0.14; // on the platform
  return !map[idx(Math.floor(x), Math.floor(y))] && !isWater(x, y) && !(mode === 'walk' && machineAt(x, y, 0.02));
};
function move(fx, fy) {
  const m = mode === 'room' ? 0.25 : 0.05;
  // walking into a way out (a shop's door, the top of the subway stairs) takes you through it
  const n = Math.hypot(fx, fy);
  if (mode === 'room' && n > 0 && roomAt(Math.floor(px + fx / n * 0.45), Math.floor(py + fy / n * 0.45)) === 'D') return leaveRoom();
  if (free(px + fx + Math.sign(fx) * m, py)) px += fx;
  if (free(px, py + fy + Math.sign(fy) * m)) py += fy;
}
function drive(dt) {
  const c = me, f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  if (f > 0) c.v += (c.v < 0 ? 2.5 : 1) * dt; else if (f < 0) c.v -= (c.v > 0 ? 2.5 : 0.8) * dt; else c.v *= 1 - 0.7 * dt;
  c.v = clamp(c.v, -0.5, K.ShiftLeft || K.ShiftRight ? 3.2 : 2.2);
  a += s * dt * 1.8 * clamp(c.v / 0.5, -1, 1);
  const hx = Math.cos(a), hy = Math.sin(a), nx = c.x + hx * c.v * dt, ny = c.y + hy * c.v * dt;
  const fx = nx + hx * 0.22 * Math.sign(c.v), fy = ny + hy * 0.22 * Math.sign(c.v); // bumper
  const hit = !free(fx, fy) || cars.some(o => o !== c && Math.hypot(rel(o.x - fx), rel(o.y - fy)) < 0.3)
           || people.some(p => !p.hidden && Math.hypot(rel(p.x - fx), rel(p.y - fy)) < 0.15);
  if (hit) { if (Math.abs(c.v) > 0.8) say('*CRUNCH*', 1); c.v = 0; } else { c.x = mod(nx, N); c.y = mod(ny, N); }
  c.hx = hx; c.hy = hy; c.brake = f < 0; px = c.x; py = c.y;
  c.off = 0; c.ex = c.x; c.ey = c.y; // where it's drawn and where traffic sees it: right here
}

let t0 = performance.now();
function loop(t) {
  if (paused) { t0 = t; requestAnimationFrame(loop); return; } // frozen: the last frame stays up under the menu
  const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; T += dt; msgT -= dt;
  env(dt);
  if (sleep) stepSleep(dt);
  pitch += ((K.KeyR ? 1 : 0) - (K.KeyF ? 1 : 0)) * dt; clampPitch();
  if (!sleep && (mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat')) {
    a += ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
    const run = K.ShiftLeft || K.ShiftRight, sp = (mode === 'room' ? (run ? 2.5 : 1.6) : run ? 0.8 : 0.5) * dt * (fx.caffeine > 0 ? 1.25 : 1) * (fx.skating && mode === 'walk' ? 1.8 : 1); // sprint 29 km/h, cars top out at 79
    const f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
    const cx = Math.cos(a), cy = Math.sin(a);
    move((cx * f - cy * s) * sp, (cy * f + cx * s) * sp);
  } else if (mode === 'drive') drive(dt);
  else if (mode === 'el') { // riding: you move with the train; look around with the mouse or arrows
    a += ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
    px = mod(elRiding().x + ride.off, N);
  }
  stepTraffic(dt, T);
  stepTask(dt);
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
  } else { // a drink or two and the world sways a little
    camYaw = a; const wob = fx.booze, sa = Math.sin(T * 0.9) * 0.04 * wob, sp_ = Math.sin(T * 1.3) * 0.02 * wob;
    a += sa; pitch += sp_; render(dt); a -= sa; pitch -= sp_;
  }
  audioTick(dt);
  requestAnimationFrame(loop);
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
requestAnimationFrame(loop);

// the mouse wheel cycles what's in your hand
addEventListener('wheel', e => { if (!paused && inv.length) held = mod(held + Math.sign(e.deltaY), inv.length); }, { passive: true });
