onkeydown = e => {
  K[e.code] = 1;
  if (e.repeat) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyH') hail();
  if (e.code === 'KeyV' && me) third = !third;
  if (e.code === 'KeyM') showMap = !showMap;
  if (e.code === 'KeyY') { weather = { clear: 'rain', rain: 'fog', fog: 'clear' }[weather]; wTimer = 150; say(`Weather: ${weather}`); }
  const n = /^Digit([1-5])$/.exec(e.code);
  if (n && mode === 'taxi' && !me.dest) setDest(+n[1]);
  if (n && mode === 'room' && room.kind === 'train' && room.dest == null && +n[1] <= room.opts.length) { room.dest = room.opts[n[1] - 1]; room.rideT = 9; }
};
onkeyup = e => K[e.code] = 0;
cv.onclick = () => cv.requestPointerLock();
const clampPitch = () => pitch = clamp(pitch, -1.2, 1.6);
onmousemove = e => {
  if (!document.pointerLockElement) return;
  if (mode === 'taxi') look += e.movementX * 0.003; else if (mode !== 'drive') a += e.movementX * 0.003;
  pitch -= e.movementY * 0.002; clampPitch();
};

const free = (x, y) => {
  if (mode === 'room') return !ROOMW.cell(Math.floor(x), Math.floor(y)) && !(room.def.block && room.def.block(x, y));
  if (mode === 'roof') return map[idx(Math.floor(x), Math.floor(y))] === roofH; // stay on this roof
  if (mode === 'elplat') return mod(x - plat.s.x0, N) < plat.s.x1 - plat.s.x0 && Math.abs(y - EL_PLAT[plat.tr]) < 0.14; // on the platform
  return !map[idx(Math.floor(x), Math.floor(y))] && !isWater(x, y);
};
function move(fx, fy) {
  const m = mode === 'room' ? 0.25 : 0.05;
  if (mode === 'room' && roomAt(Math.floor(px + fx * 3), Math.floor(py + fy * 3)) === 'D') return leaveRoom();
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
}

let t0 = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; T += dt; msgT -= dt;
  env(dt);
  pitch += ((K.KeyR ? 1 : 0) - (K.KeyF ? 1 : 0)) * dt; clampPitch();
  if (mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat') {
    a += ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
    const run = K.ShiftLeft || K.ShiftRight, sp = (mode === 'room' ? (run ? 2.5 : 1.6) : run ? 0.8 : 0.5) * dt; // sprint 29 km/h, cars top out at 79
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
  } else { camYaw = a; render(dt); }
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
