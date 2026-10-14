// ===== at the controls of an aircraft (the physics: aircraft.js; the airport: world.js). On foot by one that's
// parked, E gets you in. A plane: W/S throttle (shut, S brakes on the ground), A/D or the mouse across to bank and
// turn, the up/down arrows or the mouse up and down for the nose; past lift-off speed, pull up. A helicopter: W/S
// forward and back, A/D or the mouse to turn, R/F (or up/down) climb and descend. V: behind it, or in the cockpit.
// On the ground and stopped, E gets you out. Crash and you're thrown clear (hurt, or the hospital); ditch in the bay
// and a boat fishes you out; whatever's left burns and goes up, as a car does.
let pilot = null, airEye = 0, airCamYaw = 0;
const airMouse = [0, 0]; // the mouse's say on the controls: it springs back
const flyable = c => !!PLANE_TYPES[c.type].price;
// the parked aircraft you're standing by (at its cockpit door, its side), or null
function nearAircraft() {
  if (mode !== 'walk') return null;
  let best = null, bd = 0.55;
  for (const c of aircraft) {
    if (!flyable(c) || c.state === 'flown' || c.wrecked || c.ditched || c.fireT != null || c.z > builtHeight(c.x, c.y) + 0.05) continue;
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
  pilot = c; mode = 'air'; c.state = 'flown'; c.throttle = 0; c.v = 0; c.vz = 0; c.ground = true; c.z = builtHeight(c.x, c.y);
  airCamYaw = c.yaw; px = c.x; py = c.y; airMouse[0] = airMouse[1] = 0;
  say(T_.heli ? `You climb into the ${T_.name}. The rotor starts to turn.   R/F up and down, W/S forward and back, A/D turn` :
    `You climb into the ${T_.name}.   W/S throttle, A/D bank, arrows pitch; past ${Math.round(T_.vr * 36)} km/h, pull up`, 5);
  if (theft) { // not yours: the tower's on the radio to the police before you're off the ground
    c.stolen = true; addWanted('planetheft', c.x, c.y, true);
    say(`You climb into the ${T_.name} and get it started. The radio crackles: "Unauthorised movement on stand ${c.id}. Police are on the way."`, 5);
  }
}
// buying the one you're standing by: it's yours, kept where you leave it (and saved)
function buyAircraft(c) {
  const T_ = PLANE_TYPES[c.type];
  if (c.stolen && !c.owned) return say('Not one you\'ve just stolen.', 2);
  if (!pay(T_.price)) return say(`The ${T_.name} is ${fmt$(T_.price)}. You can't cover it.`, 3);
  c.owned = true; c.forSale = false; saveGame();
  if (actx) sfxUse('click');
  say(`The ${T_.name} is yours. Keys, logbook, and a full tank. Park it anywhere: it stays where you leave it.`, 5);
}
function aircraftPrompt(c) {
  const T_ = PLANE_TYPES[c.type];
  if (c.owned) return `E: get in your ${T_.name}${c.owed ? ` (insurance excess ${fmt$(AIR_EXCESS)})` : ''}`;
  return `E: steal the ${T_.name}   U: buy it for ${fmt$(T_.price)}`;
}
// out, onto the ground beside it (its left side), as long as it's on the ground and stopped
function leaveAircraft(why) {
  const c = pilot, T_ = PLANE_TYPES[c.type], side = T_.heli ? 0.22 : T_.r + 0.15;
  const [x, y] = spotNear(c.x + Math.sin(c.yaw) * side, c.y - Math.cos(c.yaw) * side);
  pilot = null; mode = 'walk'; c.state = 'parked'; c.throttle = 0; c.v = 0;
  px = x; py = y; a = c.yaw; pitch = 0; body.z = body.vz = 0;
  if (why) say(why, 4);
}
// somewhere you can stand near (x, y): out from it in a widening ring
function spotNear(x, y) {
  if (free(x, y)) return [x, y];
  for (let r = 0.2; r < 6; r += 0.2) for (let k = 0; k < 12; k++) {
    const qx = mod(x + Math.cos(k / 12 * TAU) * r, N), qy = mod(y + Math.sin(k / 12 * TAU) * r, N);
    if (free(qx, qy) && !overWater(qx, qy)) return [qx, qy];
  }
  return [x, y];
}
function stepFlight(dt) {
  const c = pilot, T_ = PLANE_TYPES[c.type];
  const turn = clamp((K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0) + airMouse[0], -1, 1);
  const thr = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0);
  const nose = clamp((K.ArrowUp ? 1 : 0) - (K.ArrowDown ? 1 : 0) - airMouse[1], -1, 1);
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
    else if (e === 'crash') return airCrash(c);
    else if (e === 'ditch') return airDitch(c);
  }
  if (burning(c) && !c.warnedFire) { c.warnedFire = true; say('Fire! Get it down and get out.', 4); }
}
// thrown clear: hurt by how hard it hit, or the hospital
function airCrash(c) {
  if (actx) playClip('crash', 1);
  const hurtBy = clamp(20 + (c.crashSpeed || 0) * 14, 20, 95), [x, y] = spotNear(c.x, c.y + 0.4);
  pilot = null; c.state = 'parked'; mode = 'walk'; px = x; py = y; a = Math.atan2(rel(c.y - y), rel(c.x - x)); pitch = 0; body.z = body.vz = 0;
  if (hurt(hurtBy)) return passOut('Pulled from the wreck of an aircraft. Lucky to be alive.');
  if (needs.health < 35) needs.warned = 'weak'; // (you know)
  say('You come down hard. You crawl out of the wreck before it goes up.', 5);
}
// into the bay: it sinks, you swim, a boat hauls you out at the marina
function airDitch(c) {
  if (actx) playClip('crash', 0.7);
  pilot = null; c.state = 'parked'; mode = 'walk';
  c.sinkT = T;
  px = MARINA.x - 1.2; py = MARINA.y0 - 0.4; a = -Math.PI / 2; pitch = 0; body.z = body.vz = 0;
  hurt(15); say('It hits the water and goes under. You swim for it, and a harbour launch hauls you out at the marina.', 6);
}
// burning aircraft go up (the bang hurts whoever's near); sunk ones sink; smoke off the damaged ones
let airSmokeT = 0;
function stepAirWrecks(dt) {
  for (const c of stepAircraftFires(dt)) {
    const d = Math.hypot(rel(c.x - px), rel(c.y - py));
    if (actx && d < 40) { playClip('crash', clamp(1 - d / 40, 0.2, 1)); tone(actx.currentTime, 35, 1.1, 0.14 * clamp(1 - d / 40, 0, 1), 'sawtooth'); }
    if (c === pilot) { airCrash(c); continue; }
    if (onFootMode() && d < 0.9) { hurt(30 * (1 - d / 0.9)); say('The blast knocks you flat.', 3); }
    for (let k = 0; k < 14; k++) haze.push({ at: '', kind: 'soot', s: 0.1, x: c.x + (Math.random() - 0.5) * 0.5, y: c.y + (Math.random() - 0.5) * 0.5, z: c.z + 0.1, r: 0.12, rMax: 0.45, vx: 0, vy: 0, vz: 0.3, life: 1, fade: 1 / 6, seed: Math.random() * 100 });
  }
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
  if (!third) { // the cockpit: out over the nose
    const ahead = T_.heli ? 0.12 : T_.len * 0.32, z = c.z + (T_.heli ? 0.2 : T_.r * 1.9 + (c.ground ? T_.r * 1.8 : 0));
    return [mod(c.x + Math.cos(c.yaw) * ahead, N), mod(c.y + Math.sin(c.yaw) * ahead, N), c.yaw, z, f(Math.tan(c.pitch) * projY / rows)];
  }
  airCamYaw += (mod(c.yaw - airCamYaw + Math.PI, TAU) - Math.PI) * (1 - Math.exp(-2.5 * dt));
  const back = T_.heli ? 1.15 : T_.len * 0.9 + 0.45, up = T_.heli ? 0.38 : 0.22 + T_.len * 0.12;
  const cx = mod(c.x - Math.cos(airCamYaw) * back, N), cy = mod(c.y - Math.sin(airCamYaw) * back, N);
  const cz = Math.max(c.z + up + (c.ground ? 0.12 : 0) - Math.sin(c.pitch) * back * 0.5, builtHeight(cx, cy) + 0.15);
  const down = Math.atan2(cz - (c.z + 0.15), back); // (looking down at it a little, and up and down with its nose)
  return [cx, cy, airCamYaw, cz, f((Math.tan(c.pitch * 0.35) - Math.tan(down) * 0.8) * projY / rows)];
}
// ---- the instruments, along the bottom: speed, height, throttle, climb, heading, and a little horizon that banks
function airDash() {
  const c = pilot, T_ = PLANE_TYPES[c.type], r0 = rows - 3;
  if (!third) { // in the cockpit: the window posts either side, and (a plane) the nose out ahead
    const col = C(T_.heli ? GRAY : WHITE, 4);
    for (let r = 0; r < r0 - 1; r++) for (const s of [-1, 1]) {
      const x = Math.round(cols / 2 + s * (cols * 0.36 + (r0 - r) * 0.18));
      for (let k = 0; k < 3; k++) { const xx = x + s * k; if (xx >= 0 && xx < cols) { const i = r * cols + xx; set(i, k ? ' ' : s < 0 ? '\\' : '/', col); BG[i] = C(GRAY, 2); FOGS[i] = FOGB[i] = 0; } }
    }
    if (!T_.heli) for (let r = r0 - 4; r < r0 - 1; r++) { const w = Math.round(cols * (0.06 + (r - r0 + 4) * 0.035)); for (let x = (cols >> 1) - w; x <= (cols >> 1) + w; x++) { const i = r * cols + x; set(i, r === r0 - 4 ? '_' : ' ', col); BG[i] = C(c.type === 'jet' ? GRAY : RED, 3); FOGS[i] = FOGB[i] = 0; } }
  }
  for (let r = r0 - 1; r < rows; r++) for (let x = 0; x < cols; x++) { const i = r * cols + x; FOGS[i] = FOGB[i] = 0; if (r >= r0) { set(i, ' ', 0); BG[i] = C(GRAY, 1); } }
  const alt = Math.round(c.z * 10), sp = Math.round(c.v * 36), climb = Math.round((c.vz || 0) * 10), hdg = Math.round(mod(c.yaw * 180 / Math.PI + 90, 360)); // (north up: 0 is north)
  const thr = Math.round((T_.heli ? c.rotor || 0 : c.throttle || 0) * 10), bar = '#'.repeat(thr) + '-'.repeat(10 - thr);
  putText(r0, 2, `${sp} km/h`, C(CYAN, 15)); putText(r0 + 1, 2, `ALT ${alt} m`, C(CYAN, 14)); putText(r0 + 2, 2, `${climb >= 0 ? '+' : ''}${climb} m/s`, C(climb < -8 ? RED : CYAN, 13));
  putText(r0, 18, `${T_.heli ? 'ROTOR' : 'THR'} [${bar}]`, C(YEL, 14)); putText(r0 + 1, 18, `HDG ${String(hdg).padStart(3, '0')}`, C(WHITE, 13));
  putText(r0 + 2, 18, c.ground ? (T_.heli ? 'ON THE GROUND' : 'ON THE WHEELS') : 'AIRBORNE', C(GRAY, 11));
  // the horizon: a line tilted by the bank, up and down with the nose
  const hc = cols >> 1, hw = 8;
  for (let k = -hw; k <= hw; k++) { const y = Math.round(r0 + 1 + k * Math.tan(-c.roll) * 0.5 + Math.sin(c.pitch) * 2); if (y >= r0 && y < rows) set(y * cols + hc + k, k ? '-' : '+', C(k ? WHITE : YEL, 15)); }
  set((r0 + 1) * cols + hc - hw - 2, '[', C(GRAY, 10)); set((r0 + 1) * cols + hc + hw + 2, ']', C(GRAY, 10));
  const blink = fract(T * 2) < 0.5, warn = burning(c) ? 'FIRE' : c.stalled ? 'STALL' : !c.ground && c.vz < -1 && c.z - builtHeight(c.x, c.y) < 1.5 ? 'PULL UP' : c.dmg >= DMG_SMOKE ? 'DAMAGE' : '';
  if (warn) putText(r0 + 1, cols - warn.length - 3, warn, C(RED, blink ? 15 : 7));
}
function airPrompt() {
  const c = pilot;
  if (c.ground && c.v < 0.3) return 'E: get out';
  return '';
}
