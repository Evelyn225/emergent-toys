// ===== at the controls of an aircraft (the physics: aircraft.js; the airport: world.js). On foot by one that's
// parked, E gets you in. A plane: W/S throttle (shut, S brakes on the ground), A/D or the mouse across to bank and
// turn, the up/down arrows or the mouse up and down for the nose; past lift-off speed, pull up. A helicopter: W/S
// forward and back, A/D or the mouse to turn, R/F (or up/down) climb and descend. V: behind it, or in the cockpit.
// On a phone the left thumb's stick is the control stick (up to climb, across to bank or turn), and buttons work the
// throttle. On the ground with the throttle shut, S (or Power -) brakes, and once stopped backs it up.
// On the ground and stopped, E gets you out. Crash and you watch it happen, shaken about, the world going white and
// then dark, and you come round beside the wreck (hurt, or in the hospital); ditch in the bay and you watch it settle
// and go under, then swim for the nearest dry land. Whatever's left burns and goes up, as a car does.
let pilot = null, airEye = 0, airCamYaw = 0;
const airMouse = [0, 0]; // the mouse's say on the controls: it springs back
const airStick = [0, 0]; // the touch stick's (touch.js): held where the thumb has it, back to the middle when it lets go
const airInput = k => clamp(airMouse[k] + airStick[k], -1, 1);
const flyable = c => c.type === 'airliner' ? c.state === 'parked' : !!PLANE_TYPES[c.type].price; // (an airliner: only one at its gate)
// the parked aircraft you're standing by (at its cockpit door, its side), or null
function nearAircraft() {
  if (mode !== 'walk') return null;
  let best = null, bd = 0.55;
  for (const c of aircraft) {
    if (!flyable(c) || c.state === 'flown' || c.wrecked || c.ditched || c.fireT != null || c.z > builtHeight(c.x, c.y, c.z) + 0.05) continue;
    const T_ = PLANE_TYPES[c.type], fx = Math.cos(c.yaw), fy = Math.sin(c.yaw), ax = c.x + fx * (T_.heli ? 0.05 : T_.len * 0.25), ay = c.y + fy * (T_.heli ? 0.05 : T_.len * 0.25);
    const d = Math.hypot(rel(ax - px), rel(ay - py));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterAircraft(c) {
  const T_ = PLANE_TYPES[c.type];
  if (c.owed) { // the insurance's excess, from last time
    if (!pay(AIR_EXCESS)) return say(`The hangar won't release your ${T_.name} till the insurance excess is paid: ${fmt$(AIR_EXCESS)}.`, 4);
    c.owed = false; say(`You settle the insurance excess on the ${T_.name}: ${fmt$(AIR_EXCESS)}.`, 3);
  }
  const theft = !c.owned && !c.stolen;
  if (c.type === 'airliner') c.gate = null; // (the airline's lost it)
  wreckCam = null;
  pilot = c; mode = 'air'; c.state = 'flown'; c.throttle = 0; c.v = 0; c.vz = 0; c.ground = true; c.z = builtHeight(c.x, c.y, c.z);
  airCamYaw = c.yaw; px = c.x; py = c.y; airMouse[0] = airMouse[1] = airStick[0] = airStick[1] = 0;
  const up = settings.invertY ? 'down' : 'up', click = TOUCH || mouseCaptured() ? '' : '   (click to take it with the mouse)';
  const stick = TOUCH ? 'LEFT STICK' : 'MOUSE', w = TOUCH ? 'POWER +' : 'W', ws = TOUCH ? 'POWER +/-' : 'W/S';
  say(T_.heli ? `You climb into the ${T_.name}. The rotor starts to turn.   ${stick}: turn, and ${up} to climb   ${ws} forward and back${click}` :
    `You climb into the ${T_.name}.   ${stick} flies it: ${up} to climb, sideways to bank   ${w}: throttle up; past ${Math.round(T_.vr * 36)} km/h, ${TOUCH ? 'stick' : 'mouse'} ${up} to lift off${click}`, 6);
  if (theft) { // not yours: the tower's on the radio to the police before you're off the ground
    c.stolen = true; addWanted('planetheft', c.x, c.y, true);
    say(T_.price ? `You climb into the ${T_.name} and get it started. The radio crackles: "Unauthorised movement on stand ${c.id}. Police are on the way."` :
      `You shut the door on the empty cabin and spool up the engines. The tower: "Glyphport heavy at the gate, you are NOT cleared to push. Police are on the way."   (S backs it off the gate)`, 6);
  }
}
// buying the one you're standing by: it's yours, kept where you leave it (and saved)
function buyAircraft(c) {
  const T_ = PLANE_TYPES[c.type];
  if (!T_.price) return say(`The airline isn't selling.`, 2);
  if (c.stolen && !c.owned) return say('Not one you\'ve just stolen.', 2);
  if (!pay(T_.price)) return say(`The ${T_.name} is ${fmt$(T_.price)}. You can't cover it.`, 3);
  c.owned = true; c.forSale = false; saveGame();
  if (actx) sfxUse('click');
  say(`The ${T_.name} is yours. Keys, logbook, and a full tank. Park it anywhere: it stays where you leave it.`, 5);
}
function aircraftPrompt(c) {
  const T_ = PLANE_TYPES[c.type];
  if (c.owned) return `E: get in your ${T_.name}${c.owed ? ` (insurance excess ${fmt$(AIR_EXCESS)})` : ''}`;
  if (!T_.price) return `E: steal the ${T_.name}`;
  return `E: steal the ${T_.name}   U: buy it for ${fmt$(T_.price)}`;
}
// out, onto the ground by its door (its left side, ahead of the wing), as long as it's on the ground and stopped
function leaveAircraft(why) {
  const c = pilot, T_ = PLANE_TYPES[c.type], side = T_.heli ? 0.22 : T_.r + 0.15, fwd = T_.heli ? 0.05 : T_.len * 0.25;
  const [x, y] = spotNear(c.x + Math.cos(c.yaw) * fwd + Math.sin(c.yaw) * side, c.y + Math.sin(c.yaw) * fwd - Math.cos(c.yaw) * side);
  pilot = null; mode = 'walk'; c.state = 'parked'; c.throttle = 0; c.v = 0;
  px = x; py = y; a = c.yaw; pitch = 0; body.z = body.vz = 0;
  if (why) say(why, 4);
}
// somewhere you can stand near (x, y): out from it in a widening ring
function spotNear(x, y) {
  if (free(x, y)) return [x, y];
  for (let r = 0.2; r < 6; r += 0.2) for (let k = 0; k < 12; k++) {
    const qx = worldCoord(x + Math.cos(k / 12 * TAU) * r), qy = worldCoord(y + Math.sin(k / 12 * TAU) * r);
    if (free(qx, qy) && !overWater(qx, qy)) return [qx, qy];
  }
  return [x, y];
}
// dry land you can stand on nearest (x, y), out in widening rings (the bay is never more than a few blocks across)
function nearestShore(x, y) {
  for (let r = 0.5; r < 120; r += 0.5) {
    const n = Math.max(16, Math.round(r * 6)), k0 = Math.random() * TAU;
    for (let k = 0; k < n; k++) {
      const qx = worldCoord(x + Math.cos(k0 + k / n * TAU) * r), qy = worldCoord(y + Math.sin(k0 + k / n * TAU) * r);
      if (!seaAt(qx, qy) && !isWater(qx, qy) && free(qx, qy)) return [qx, qy];
    }
  }
  return [MARINA.x - 1.2, MARINA.y0 - 0.4]; // (can't happen; but the marina, if it did)
}
// ---- going in: a few seconds of it from outside (the camera shaken, pulled back, the screen white with the hit and
// then going dark, or the water closing over), then you, wherever you end up (airCrash, airDitch)
const WRECK_T = { crash: 2.6, ditch: 3.4 };
let wreckCam = null; // { kind, t, c }
function startWreck(c, kind) {
  wreckCam = { kind, t: 0, c }; c.throttle = 0; airMouse[0] = airMouse[1] = 0;
  if (kind === 'ditch') c.sinkT = T;
  if (actx) playClip('crash', kind === 'crash' ? 1 : 0.7);
  say(kind === 'crash' ? 'BRACE!' : 'It hits the water hard...', 2);
}
function stepWreck(dt) {
  const w = wreckCam;
  w.t += dt;
  if (w.c.falling && w.t > WRECK_T[w.kind] * 0.5) w.t = WRECK_T[w.kind] * 0.5; // (still coming down: watch it all the way)
  if (w.t < WRECK_T[w.kind]) return;
  wreckCam = null;
  if (w.kind === 'crash' && !w.c.ditched) airCrash(w.c); else airDitch(w.c);
  if (mode !== 'room') { wakeT = 2; fade = 1; } // (coming round: in from black)
}
// over the picture (render.js, after it's drawn): the flash of the hit, then dark; or the bay's green-blue over it
function wreckOverlay() {
  if (!wreckCam || mode !== 'air') return;
  const k = wreckCam.t / WRECK_T[wreckCam.kind];
  if (wreckCam.kind === 'crash') {
    const flash = clamp(1 - wreckCam.t / 0.35, 0, 1), dark = clamp((k - 0.55) / 0.4, 0, 1);
    if (flash > 0) { g.fillStyle = `rgba(255,240,210,${flash * 0.85})`; g.fillRect(0, 0, cv.width, cv.height); }
    if (dark > 0) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, cv.width, cv.height); }
    return;
  }
  const under = clamp((k - 0.35) / 0.4, 0, 1), dark = clamp((k - 0.75) / 0.25, 0, 1);
  if (under > 0) { g.fillStyle = `rgba(10,60,70,${under * 0.75})`; g.fillRect(0, 0, cv.width, cv.height); }
  if (dark > 0) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, cv.width, cv.height); }
}
function stepFlight(dt) {
  if (wreckCam) return stepWreck(dt);
  const c = pilot, T_ = PLANE_TYPES[c.type];
  const turn = clamp((K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0) + airInput(0), -1, 1);
  const thr = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0);
  const nose = clamp((K.ArrowUp ? 1 : 0) - (K.ArrowDown ? 1 : 0) - airInput(1), -1, 1);
  const lift = clamp((K.KeyR || K.Space ? 1 : 0) - (K.KeyF ? 1 : 0) + (T_.heli ? nose : 0), -1, 1);
  for (const k of [0, 1]) airMouse[k] *= Math.exp(-6 * dt);
  const ev = flyStep(c, { throttle: thr, pitch: T_.heli ? 0 : nose, turn, lift }, dt);
  px = c.x; py = c.y; a = c.yaw;
  for (const e of ev) {
    if (e === 'takeoff') say(T_.heli ? 'Up you go.' : 'Wheels up.', 2);
    else if (e === 'land') say(T_.heli ? 'Down. Skids on the ground.' : 'Down. A smooth one.', 2);
    else if (e === 'hard') { say('A heavy landing. Something cracked.', 3); if (actx) playClip('crash', 0.4); }
    else if (e === 'stall') say('STALL! Nose down, power on.', 2);
    else if (e === 'bump') { if (actx) tone(actx.currentTime, 70, 0.12, 0.08); }
    else if (e === 'crash' || e === 'ditch') return startWreck(c, e);
  }
  if (burning(c) && !c.warnedFire) { c.warnedFire = true; say(c.ground ? 'Fire! Get out of it.' : 'FIRE! It\'s going to go up.   E: bail out', 4); }
}
// thrown clear: hurt by how hard it hit, or the hospital
function airCrash(c) {
  const hurtBy = clamp(20 + (c.crashSpeed || 0) * 14, 20, 95), [x, y] = spotNear(c.x, c.y + 0.4);
  pilot = null; c.state = 'parked'; mode = 'walk'; px = x; py = y; a = Math.atan2(rel(c.y - y), rel(c.x - x)); pitch = 0; body.z = body.vz = 0;
  const blown = c.blown; delete c.blown;
  if (c.stolen && !blown) newsEvent('planecrash', c.x, c.y);
  if (hurt(hurtBy)) return passOut(blown ? 'It blew apart in the air with you still in it. They found you in the wreckage, somehow alive.' : 'Pulled from the wreck of an aircraft. Lucky to be alive.');
  if (needs.health < 35) needs.warned = 'weak'; // (you know)
  say(blown ? 'It blows apart around you. You come to in the wreckage, burnt and half deaf, somehow alive.' : 'You come down hard. You crawl out of the wreck before it goes up.', 5);
}
// into the bay: it sinks, and you swim for the nearest dry land
function airDitch(c) {
  pilot = null; c.state = 'parked'; mode = 'walk';
  if (c.stolen) newsEvent('planecrash', c.x, c.y);
  if (c.sinkT == null) c.sinkT = T;
  swimAshore(c.x, c.y);
  hurt(15); say('It goes under. You kick free of the cockpit and swim for the nearest shore, and drag yourself out, soaked.', 6);
}
// out of the water at the nearest land to (x, y), looking inland
function swimAshore(x, y) {
  [px, py] = nearestShore(x, y);
  a = Math.atan2(rel(py - y), rel(px - x)); pitch = 0; body.z = body.vz = 0;
}
// burning aircraft go up (the bang hurts whoever's near); sunk ones sink; smoke off the damaged ones
let airSmokeT = 0;
function stepAirWrecks(dt) {
  stepCraftFalls(dt);
  for (const c of stepAircraftFires(dt)) {
    const d = Math.hypot(rel(c.x - px), rel(c.y - py));
    if (actx && d < 40) { playClip('crash', clamp(1 - d / 40, 0.2, 1)); tone(actx.currentTime, 35, 1.1, 0.14 * clamp(1 - d / 40, 0, 1), 'sawtooth'); }
    if (c === pilot) { if (!c.ground) { c.blown = true; c.crashSpeed = 6; if (c.stolen) newsEvent('blownup', c.x, c.y); } if (!wreckCam) startWreck(c, 'crash'); continue; } // (still up there in it: as bad as it gets)
    if (onFootMode() && d < 0.9) { hurt(30 * (1 - d / 0.9)); say('The blast knocks you flat.', 3); }
    for (let k = 0; k < 14; k++) haze.push({ at: '', kind: 'soot', s: 0.1, x: c.x + (Math.random() - 0.5) * 0.5, y: c.y + (Math.random() - 0.5) * 0.5, z: c.z + 0.1, r: 0.12, rMax: 0.45, vx: 0, vy: 0, vz: 0.3, life: 1, fade: 1 / 6, seed: Math.random() * 100 });
  }
  stepAbandoned(dt);
  for (const c of aircraft) if (c.sinkT != null) c.z = -Math.min(0.5, (T - c.sinkT) * 0.12); // (going under)
  for (let k = aircraft.length - 1; k >= 0; k--) if (aircraft[k].sinkT != null && T - aircraft[k].sinkT > 4 && aircraft[k] !== pilot && !aircraft[k].home) aircraft.splice(k, 1);
  for (const c of stepFleet(px, py, pilot)) if (c.owned) { // yours, replaced on the insurance
    if (pay(AIR_EXCESS)) say(`The insurers have a new ${PLANE_TYPES[c.type].name} waiting on its stand at the airport. The excess: ${fmt$(AIR_EXCESS)}.`, 5);
    else { c.owed = true; say(`The insurers have a new ${PLANE_TYPES[c.type].name} on its stand at the airport, for when you can pay the ${fmt$(AIR_EXCESS)} excess.`, 5); }
  }
  if ((airSmokeT -= dt) > 0) return;
  airSmokeT = 0.12;
  for (const c of aircraft) {
    if (!(c.dmg >= DMG_SMOKE || c.wrecked && T - (c.boomT || 0) < 40) || Math.hypot(rel(c.x - px), rel(c.y - py)) > 20) continue;
    haze.push({ at: '', kind: c.dmg >= DMG_BAD || c.wrecked ? 'soot' : 'engine', s: 0.1, x: c.x, y: c.y, z: c.z + 0.2, r: 0.05, rMax: 0.25, vx: 0, vy: 0, vz: 0.15, life: 1, fade: 1 / 3, seed: Math.random() * 100 });
  }
}
// ---- the camera: behind it and a little above, swinging round after it; or from the cockpit
function airCam(dt) {
  const c = pilot, T_ = PLANE_TYPES[c.type], f = n => Math.max(-0.95, Math.min(1.2, n));
  if (wreckCam) return wreckView(c, T_, dt);
  if (!third) { // the cockpit: out over the nose
    const ahead = T_.heli ? 0.12 : T_.len * 0.32, z = c.z + (T_.heli ? 0.2 : T_.r * 1.9 + (c.ground ? T_.r * 1.8 : 0));
    return [worldCoord(c.x + Math.cos(c.yaw) * ahead), worldCoord(c.y + Math.sin(c.yaw) * ahead), c.yaw, z, f(Math.tan(c.pitch) * projY / rows)];
  }
  airCamYaw += (mod(c.yaw - airCamYaw + Math.PI, TAU) - Math.PI) * (1 - Math.exp(-2.5 * dt));
  const want = T_.heli ? 1.15 : T_.len * 0.9 + 0.45, up = T_.heli ? 0.38 : 0.22 + T_.len * 0.12, bx = Math.cos(airCamYaw), by = Math.sin(airCamYaw);
  let back = 0.2; // (pulled in short of a wall behind it: in a hangar, not out the back of it looking at the back wall)
  for (let s = 0.2; s <= want; s += 0.05) { if (airportBlocked(c.x - bx * s, c.y - by * s, 0.08)) break; back = s; }
  const cx = worldCoord(c.x - bx * back), cy = worldCoord(c.y - by * back), roof = builtHeight(cx, cy), floor = builtHeight(cx, cy, c.z + 0.05);
  let cz = Math.max(c.z + up + (c.ground ? 0.12 : 0) - Math.sin(c.pitch) * back * 0.5, builtHeight(cx, cy, c.z + up) + 0.15);
  if (roof > floor + 0.3 && c.z < roof) cz = Math.min(cz, roof - 0.12); // (indoors: under the roof)
  const down = Math.atan2(cz - (c.z + 0.15), back); // (looking down at it a little, and up and down with its nose)
  return [cx, cy, airCamYaw, cz, f((Math.tan(c.pitch * 0.35) - Math.tan(down) * 0.8) * projY / rows)];
}
// going in: from outside, shaken hard at first, swinging round it and pulling back (a crash), or sinking down to the
// water's surface beside it as it goes under (a ditching)
function wreckView(c, T_, dt) {
  const w = wreckCam, k = w.t / WRECK_T[w.kind], size = T_.heli ? 1 : T_.len, shake = Math.max(0, 1 - w.t / 1.2) * 0.05 * size;
  airCamYaw += dt * (w.kind === 'crash' ? 0.7 : 0.25);
  const back = size * (w.kind === 'crash' ? 1 + k * 1.2 : 1.3), j = () => (Math.random() - 0.5) * shake;
  const cx = worldCoord(c.x - Math.cos(airCamYaw) * back + j()), cy = worldCoord(c.y - Math.sin(airCamYaw) * back + j());
  const cz = w.kind === 'crash' ? Math.max(c.z, builtHeight(cx, cy)) + 0.25 + k * size * 0.5 + j() : Math.max(0.03, 0.4 * size * (1 - k)) + j();
  const tilt = Math.atan2(cz - c.z, back);
  return [cx, cy, airCamYaw, cz, Math.max(-0.95, Math.min(1.2, (-Math.tan(tilt) * 0.8 + j() * 4) * projY / rows))];
}
// ---- the instruments, along the bottom: speed, height, throttle, climb, heading, and a little horizon that banks
function airDash() {
  if (wreckCam) return; // (going in: no instruments, just the view)
  const c = pilot, T_ = PLANE_TYPES[c.type], r0 = rows - 3;
  if (!third) { // in the cockpit: the window posts either side, and (a plane) the nose out ahead
    const col = C(T_.heli ? GRAY : WHITE, 4);
    for (let r = 0; r < r0 - 1; r++) for (const s of [-1, 1]) {
      const x = Math.round(cols / 2 + s * (cols * 0.36 + (r0 - r) * 0.18));
      for (let k = 0; k < 3; k++) { const xx = x + s * k; if (xx >= 0 && xx < cols) { const i = r * cols + xx; set(i, k ? ' ' : s < 0 ? '\\' : '/', col); BG[i] = C(GRAY, 2); FOGS[i] = FOGB[i] = 0; } }
    }
    if (!T_.heli) for (let r = r0 - 4; r < r0 - 1; r++) { const w = Math.round(cols * (0.06 + (r - r0 + 4) * 0.035)); for (let x = (cols >> 1) - w; x <= (cols >> 1) + w; x++) { const i = r * cols + x; set(i, r === r0 - 4 ? '_' : ' ', col); BG[i] = C(c.type === 'jet' ? GRAY : RED, 3); FOGS[i] = FOGB[i] = 0; } }
  }
  for (let r = r0; r < rows; r++) for (let x = 0; x < cols; x++) { const i = r * cols + x; FOGS[i] = FOGB[i] = 0; set(i, ' ', 0); BG[i] = C(GRAY, 1); } // (the panel: out of the fog; the view above it isn't)
  const alt = Math.round(c.z * 10), sp = Math.round(c.v * 36), climb = Math.round((c.vz || 0) * 10), hdg = Math.round(mod(c.yaw * 180 / Math.PI + 90, 360)); // (north up: 0 is north)
  const thr = Math.round((T_.heli ? c.rotor || 0 : c.throttle || 0) * 10), bar = '#'.repeat(thr) + '-'.repeat(10 - thr);
  putText(r0, 2, `${sp} km/h`, C(CYAN, 15)); putText(r0 + 1, 2, `ALT ${alt} m`, C(CYAN, 14)); putText(r0 + 2, 2, `${climb >= 0 ? '+' : ''}${climb} m/s`, C(climb < -8 ? RED : CYAN, 13));
  putText(r0, 18, `${T_.heli ? 'ROTOR' : 'THR'} [${bar}]`, C(YEL, 14)); putText(r0 + 1, 18, `HDG ${String(hdg).padStart(3, '0')}`, C(WHITE, 13));
  putText(r0 + 2, 18, c.ground ? (T_.heli ? 'ON THE GROUND' : 'ON THE WHEELS') : 'AIRBORNE', C(GRAY, 11));
  // the horizon: a line tilted by the bank, up and down with the nose
  const hc = cols >> 1, hw = 8;
  for (let k = -hw; k <= hw; k++) { const y = Math.round(r0 + 1 + k * Math.tan(-c.roll) * 0.5 + Math.sin(c.pitch) * 2); if (y >= r0 && y < rows) set(y * cols + hc + k, k ? '-' : '+', C(k ? WHITE : YEL, 15)); }
  set((r0 + 1) * cols + hc - hw - 2, '[', C(GRAY, 10)); set((r0 + 1) * cols + hc + hw + 2, ']', C(GRAY, 10));
  // the stick: where the mouse has it, in a box that springs back to the middle as the mouse lets go
  const sx = hc + hw + 18, sw = 4, held = Math.hypot(airInput(0), airInput(1)) > 0.08;
  if (sx + sw + 2 < cols - 12) {
    putText(r0 + 1, sx - sw - 8, TOUCH ? 'STICK' : 'MOUSE', C(held ? YEL : GRAY, held ? 14 : 10));
    for (let r = r0; r < rows; r++) { set(r * cols + sx - sw - 1, '|', C(GRAY, 8)); set(r * cols + sx + sw + 1, '|', C(GRAY, 8)); }
    set((r0 + 1) * cols + sx, '+', C(GRAY, 7));
    const kx = sx + Math.round(airInput(0) * sw), ky = r0 + 1 + Math.round(airInput(1));
    set(ky * cols + kx, 'O', C(held ? YEL : WHITE, 15));
  }
  const sixes = fighters.filter(f => f.sixed && !fighters.leaving).length;
  const blink = fract(T * 2) < 0.5, warn = burning(c) ? (c.ground ? 'FIRE' : 'FIRE  E: BAIL OUT') : sixes ? 'BANDIT 6 O\'CLOCK' : c.stalled ? 'STALL' : T_.ceil && c.z > T_.ceil - 0.5 ? 'CEILING' : !c.ground && c.vz < -1 && c.z - builtHeight(c.x, c.y, c.z) < 1.5 ? 'PULL UP' : c.dmg >= DMG_SMOKE ? 'DAMAGE' : '';
  if (warn) putText(r0 + 1, cols - warn.length - 3, warn, C(RED, blink ? 15 : 7));
  if (fighters.length && !fighters.leaving) { const s = `FIGHTERS ${fighters.length}`; putText(r0 + 2, cols - s.length - 3, s, C(YEL, 13)); }
}
// the interceptors (fighters.js): what you hear about them, on the radio and otherwise
function fighterNews(ev) {
  for (const e of ev) {
    if (e === 'scramble') say('The radio: "Unidentified aircraft, this is the air force. Two interceptors are on their way to you. Land at once."', 6);
    else if (e === 'six') { say('BANDIT ON YOUR SIX! Bank hard, or get down low among the rooftops.', 3); if (actx) for (let k = 0; k < 4; k++) tone(actx.currentTime + k * 0.18, 1400, 0.1, 0.05, 'square'); }
    else if (e === 'hit') { say('Hit! Rounds slamming into the airframe.', 1.5); if (actx) { playClip('crash', 0.25); tone(actx.currentTime, 90, 0.2, 0.08, 'sawtooth'); } }
    else if (e === 'toolow') say('They pull up: too low over the rooftops to take the shot.', 2);
    else if (e === 'breakoff') say('The fighters break off, circle once, and climb away.', 4);
    else if (e === 'bingo') say('"Bingo fuel, returning to base." The fighters peel away.', 4);
    if (e === 'guns' && actx) gunBurst();
  }
}
function gunBurst() { // brrrt, from wherever the nearest one is
  const f = fighters.reduce((b, o) => !b || Math.hypot(rel(o.x - px), rel(o.y - py)) < Math.hypot(rel(b.x - px), rel(b.y - py)) ? o : b, null);
  if (!f) return;
  const d = Math.hypot(rel(f.x - px), rel(f.y - py)), loud = clamp(1 - d / 30, 0.15, 1), pan = clamp((-dy * rel(f.x - px) + dx * rel(f.y - py)) / Math.max(1, d), -1, 1);
  for (let k = 0; k < 8; k++) tone(actx.currentTime + k * 0.045, 140 + Math.random() * 40, 0.035, 0.06 * loud, 'square', pan);
}
// the jets' roar, louder as one comes past
let fighterRoarT = 0;
function stepFighterSound(dt) {
  if (!actx || paused || !fighters.length || (fighterRoarT -= dt) > 0) return;
  fighterRoarT = 0.12;
  for (const f of fighters) {
    const d = Math.hypot(rel(f.x - px), rel(f.y - py), f.z - eye), loud = clamp(1 - d / 25, 0, 1);
    if (loud > 0) tone(actx.currentTime, 60 + loud * 40 + Math.random() * 20, 0.14, 0.05 * loud * loud, 'sawtooth', clamp((-dy * rel(f.x - px) + dx * rel(f.y - py)) / Math.max(1, d), -1, 1));
  }
}
function airPrompt() {
  if (wreckCam) return '';
  const c = pilot, act = c.ground ? (c.v < 0.3 ? 'E: get out' : '') : 'E: bail out';
  if (TOUCH || mouseCaptured()) return act;
  return 'CLICK to fly with the mouse' + (act ? '   ' + act : ''); // (it's the stick, and it only works captured)
}
// ---- bailing out (E, in the air): you're out, falling, the aircraft flies on without you till it comes down. Space
// (or E) pulls the cord; below 150m it opens by itself. Under the canopy: A/D or the mouse to steer, W to run faster
// and drop quicker, S to flare. Land with it open and you walk away; without, it's the fall that hurts. In the water,
// a launch picks you up. Freefall and the canopy are on foot (moves.js): it's your fall, roofs and all.
let chute = null; // { open, t, openT }
const CHUTE_AUTO = 15; // (150m: the cord pulls itself)
const chuteAlt = () => body.z + (mode === 'roof' ? roofH * 10 : 0); // (metres; over a roof, body.z counts from its top)
function bailOut() {
  const c = pilot, T_ = PLANE_TYPES[c.type], side = T_.heli ? 0.2 : T_.r + 0.2;
  c.state = 'abandoned'; pilot = null; mode = 'walk'; // (the empty aircraft: stepAbandoned)
  px = worldCoord(c.x + Math.sin(c.yaw) * side); py = worldCoord(c.y - Math.cos(c.yaw) * side); a = c.yaw; pitch = -0.45;
  if (c.stolen) newsEvent('ejected', px, py);
  body.z = Math.max(0.5, c.z * 10 - 1); body.vz = Math.min(0, (c.vz || 0) * 10); body.peak = body.z; body.seat = null; body.trick = null;
  const vx = T_.heli ? c.hvx || 0 : Math.cos(c.yaw) * c.v * Math.cos(c.pitch), vy = T_.heli ? c.hvy || 0 : Math.sin(c.yaw) * c.v * Math.cos(c.pitch);
  body.mx = vx * 0.6; body.my = vy * 0.6; // (cells a second: out the door you carry some of its speed)
  chute = { open: false, t: 0 };
  if (T_.eject) { // the Comet's seat: a rocket under you, up and clear of the tail, and the chute opens by itself
    body.vz = 25; chute.autoT = T + 1.6;
    if (actx) { burst(actx.currentTime, 0.5, [filt('lowpass', 900, 0.7)], 0.35); playClip('crash', 0.3); }
    return say('BANG! The seat fires you up and out through the canopy. The chute will open by itself.', 4);
  }
  if (actx) playClip('crash', 0.15);
  say(`You jump.   SPACE: pull the cord${body.z > CHUTE_AUTO * 10 ? ' (it opens by itself at 150m)' : ''}`, 4);
}
function pullCord() {
  if (!chute || chute.open) return;
  chute.open = true; chute.openT = T; body.peak = body.z;
  if (actx) { burst(actx.currentTime, 0.35, [filt('bandpass', 500, 0.7)], 0.25); tone(actx.currentTime, 90, 0.2, 0.08); }
  say('The canopy snaps open over you.   A/D or mouse: steer   W: faster down   S: flare', 4);
}
function stepChute(dt) {
  if (!(body.z > 0 || body.vz > 0)) return chuteDown(); // (down: stepBody has done the landing, and any hurt)
  chute.t += dt;
  if (!chute.open && (chuteAlt() < CHUTE_AUTO * 10 && body.z > 2 || chute.autoT && T >= chute.autoT)) pullCord(); // (low enough, or the seat's done it)
  const turn = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
  if (!chute.open) { // falling: the air slows you to 55 m/s, and you can track a little
    body.vz = Math.max(body.vz, -55); a += turn * 1.2 * dt;
    const k = Math.exp(-0.5 * dt); body.mx = body.mx * k + Math.cos(a) * f * 0.4 * dt; body.my = body.my * k + Math.sin(a) * f * 0.4 * dt;
  } else { // under the canopy: gliding where it points, sinking at 4 m/s
    a += turn * 1.1 * dt;
    const opening = clamp((T - chute.openT) / 1.2, 0, 1), sink = f > 0 ? -6.5 : f < 0 ? -2.5 : -4, fwd = f > 0 ? 1.3 : f < 0 ? 0.45 : 0.9;
    body.vz += (sink - body.vz) * Math.min(1, (0.8 + 3 * opening) * dt) + GRAV * dt; // (stepBody takes the gravity back off)
    const k = Math.min(1, 1.5 * dt);
    body.mx += (Math.cos(a) * fwd - body.mx) * k; body.my += (Math.sin(a) * fwd - body.my) * k;
    if (opening >= 1) body.peak = body.z; // (on a full canopy the landing doesn't count as a fall; opened too low, it does)
  }
  move(body.mx * dt, body.my * dt);
}
function chuteDown() {
  const was = chute; chute = null; body.mx = body.my = 0;
  if (mode === 'room') return; // (passed out on the way down: the hospital has you)
  if (isWater(px, py) || overWater(px, py)) { // in the bay: swim for it
    swimAshore(px, py);
    return say('Splashdown. You cut yourself free of the lines and swim for the nearest shore.', 5);
  }
  if (was.open) say(mode === 'roof' ? 'You flare and set down on the roof. Not bad.' : 'You flare, run out the landing, and gather up the canopy.', 4);
}
// the empty aircraft: a plane's nose drops and it goes in; a helicopter's rotor winds down and it falls
function stepAbandoned(dt) {
  for (const c of aircraft) {
    if (c.state !== 'abandoned') continue;
    const heli = PLANE_TYPES[c.type].heli;
    const ev = flyStep(c, { throttle: 0, pitch: heli ? 0 : -0.25, turn: heli ? 0.4 : 0.1, lift: -1, dead: true }, dt);
    const d = Math.hypot(rel(c.x - px), rel(c.y - py));
    if (ev.includes('crash')) { c.state = 'parked'; if (actx && d < 40) playClip('crash', clamp(1 - d / 40, 0.2, 1)); }
    else if (ev.includes('ditch')) { c.state = 'parked'; c.sinkT = T; if (actx && d < 40) playClip('crash', 0.3 * clamp(1 - d / 40, 0, 1)); }
    else if (ev.includes('land') || ev.includes('hard')) c.state = 'parked';
  }
}
// what you see hanging under it: the canopy's edge across the top, the lines down to your shoulders
function chuteFrame() {
  if (!chute) return;
  if (!chute.open) { // the wind
    const s = Math.round(clamp(-body.vz / 55, 0, 1) * 30);
    for (let k = 0; k < s; k++) { const x = hash(k, Math.floor(T * 12), 3) * cols | 0, y = hash(k, Math.floor(T * 12), 5) * rows | 0; set(y * cols + x, '|', C(WHITE, 6)); }
    putText(rows - 2, 2, `ALT ${Math.round(chuteAlt())} m   ${Math.round(-body.vz * 3.6)} km/h`, C(CYAN, 14));
    return;
  }
  const open = clamp((T - chute.openT) / 0.6, 0, 1), depth = Math.round(rows * 0.16 * open), hc = cols / 2;
  for (let x = 0; x < cols; x++) {
    const u = (x - hc) / hc, bottom = Math.round(depth * (1 - 0.55 * u * u));
    for (let r = 0; r < bottom; r++) { const i = r * cols + x, cell = Math.floor((u + 1) * 4); BG[i] = C(cell % 2 ? RED : WHITE, r === bottom - 1 ? 5 : 4); set(i, r === bottom - 1 ? '~' : ' ', C(GRAY, 9)); FOGS[i] = FOGB[i] = 0; }
  }
  for (const s of [-1, -0.45, 0.45, 1]) { // the lines, from the canopy's edge in to you
    const x0 = hc + s * hc * 0.95, y0 = depth * (1 - 0.55 * s * s), x1 = hc + s * cols * 0.08, y1 = rows;
    for (let r = Math.ceil(y0); r < y1; r++) { const x = Math.round(x0 + (x1 - x0) * (r - y0) / (y1 - y0)); if (x >= 0 && x < cols) { const i = r * cols + x; set(i, s < 0 ? '\\' : '/', C(WHITE, 13)); FOGS[i] = FOGB[i] = 0; } }
  }
  putText(rows - 2, 2, `ALT ${Math.round(chuteAlt())} m   down ${Math.max(0, -body.vz).toFixed(1)} m/s`, C(CYAN, 14));
}
