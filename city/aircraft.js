// ===== aircraft: everything that flies from the airport (world.js has the airport, aircraft-render.js draws them,
// flight.js flies the one you're in). Speeds in cells a second (1 = 36 km/h), heights in cells (1 = 10m).
// The airliners belong to the airport: they sit at the gates, and every few minutes one pushes back, taxis out, rolls
// down the runway and climbs away east over the bay, or one comes in from the west, lands, and taxis to an empty gate.
// The light planes, the jet and the helicopters are there to be flown: bought at the terminal, or just taken. An
// airliner parked at its gate can be taken too (not bought): big, slow, and slow to answer the controls.
const PLANE_TYPES = {
  // len: nose to tail; span: wingtip to wingtip; r: the fuselage's radius; tail: the fin's height; vr: rotation speed
  // (lift-off); cruise / top: in the air; climb: how hard it can climb (cells a second at full throttle); ceil: as high as
  // it'll go (the air's too thin above: well clear of the tallest tower, 17); price: to buy; handling: how quickly it
// answers the stick, the throttle and the nose wheel (1, or less for something heavy)
  airliner: { name: 'airliner', len: 3.4, span: 3.2, r: 0.2, tail: 0.85, body: WHITE, stripe: BLUE, engines: 'wing', vr: 5, cruise: 7, top: 7.5, ceil: 40, handling: 0.35 },
  prop: { name: 'Skylark', len: 0.8, span: 1.1, r: 0.065, tail: 0.24, body: WHITE, stripe: RED, prop: true, vr: 2.4, cruise: 4, top: 5.6, climb: 1.1, ceil: 36, price: 9000 },
  jet: { name: 'Comet', len: 1.45, span: 1.15, r: 0.09, tail: 0.36, body: GRAY, stripe: CYAN, engines: 'tail', vr: 4, cruise: 7, top: 10, climb: 2.2, ceil: 50, price: 30000 },
  heli: { name: 'Hornet', heli: true, len: 0.45, rotor: 0.5, body: RED, stripe: WHITE, top: 4.2, climb: 1.4, ceil: 30, price: 14000 },
};
const aircraft = []; // { id, type, x, y, z, yaw, pitch, roll, v, state, ... }
let aircraftId = 0;
const STAND_Y = APRON.y0 + 1.75; // an airliner at its gate: nose to the terminal
function addAircraft(type, x, y, yaw, extra) {
  const a = { id: aircraftId++, type, x, y, z: 0, yaw, pitch: 0, roll: 0, v: 0, state: 'parked', dmg: 0, ...extra };
  if (a.forSale) a.home = { x, y, yaw }; // (the airport's own: whoever takes it, it finds its way back here)
  aircraft.push(a); return a;
}
// the fleet at dawn of the first day: an airliner at two of the three gates, light aircraft by the hangars, the jet in
// the first hangar, a helicopter on each pad
addAircraft('airliner', STANDS_X[0], STAND_Y, -Math.PI / 2, { gate: 0 });
addAircraft('airliner', STANDS_X[2], STAND_Y, -Math.PI / 2, { gate: 2 });
addAircraft('jet', 20.2, AIRPORT.y0 + 2.4, Math.PI / 2, { forSale: true });
addAircraft('prop', 25.2, AIRPORT.y0 + 6.2, Math.PI / 2, { forSale: true });
addAircraft('prop', 29, AIRPORT.y0 + 6.2, Math.PI / 2, { forSale: true });
for (const h of HELIPADS) addAircraft('heli', h.x, h.y, 0, { forSale: true });

// ---- the airliners' day: a timetable that's a little irregular, one movement at a time on the runway
const AIR_GAP = [100, 220]; // seconds between movements
let airNext = 40; // (the first one soon after you arrive, so there's something to see)
const airline = a => a.type === 'airliner' && !a.stolen; // (the airline's own: not one you've taken)
const gateFree = k => !aircraft.some(a => a.type === 'airliner' && (a.gate === k || a.stolen && Math.hypot(rel(a.x - STANDS_X[k]), rel(a.y - STAND_Y)) < 2));
function stepAirTraffic(dt, rnd = Math.random) {
  const moving = aircraft.find(a => airline(a) && a.state !== 'parked');
  if (moving) stepAirliner(moving, dt);
  if (moving || (airNext -= dt) > 0) return;
  if (aircraft.some(a => !airline(a) && !a.ditched && onRunway(a.x, a.y) && a.z < 1)) { airNext = 15; return; } // (something's on the runway: the tower holds them)
  airNext = AIR_GAP[0] + rnd() * (AIR_GAP[1] - AIR_GAP[0]);
  const parked = aircraft.filter(a => airline(a) && a.state === 'parked');
  const free = [0, 1, 2].filter(gateFree);
  if (parked.length && (!free.length || rnd() < 0.5)) departAirliner(parked[Math.floor(rnd() * parked.length)]);
  else if (free.length) arriveAirliner(free[Math.floor(rnd() * free.length)]);
}
// a departure: push back off the gate to the taxiway, taxi to the west end, down onto the runway, line up east
function departAirliner(a) {
  const sx = STANDS_X[a.gate];
  a.gate = null; a.state = 'push';
  a.path = [[sx, TAXIWAY.y, 'push'], [TAXIWAY.x0 + 1.2, TAXIWAY.y], [TAXIWAY.x0, TAXIWAY.y + 1.2], [TAXIWAY.x0, RUNWAY.y - 0.8], [TAXIWAY.x0 + 1, RUNWAY.y], [RUNWAY.x0 + 3, RUNWAY.y]];
}
// an arrival: from out west over the water, down the glide slope, onto the runway at the touchdown marks
function arriveAirliner(gate) {
  const T_ = PLANE_TYPES.airliner, d = 60;
  addAircraft('airliner', RUNWAY.x0 + 6 - d, RUNWAY.y, 0, { z: d * GLIDE_SLOPE, v: T_.vr * 0.95, pitch: 0.03, state: 'approach', target: gate });
}
const GLIDE_SLOPE = 0.052; // three degrees
const TAXI_V = 0.7, PUSH_V = 0.25;
function stepAirliner(a, dt) {
  const T_ = PLANE_TYPES.airliner;
  if (a.state === 'push' || a.state === 'taxi') { // along the path, at walking pace (backwards at first)
    const [tx, ty, kind] = a.path[0], vx = rel(tx - a.x), vy = rel(ty - a.y), d = Math.hypot(vx, vy);
    const back = kind === 'push', want = back ? Math.atan2(-vy, -vx) : Math.atan2(vy, vx);
    a.yaw += clamp(mod(want - a.yaw + Math.PI, TAU) - Math.PI, -0.6 * dt, 0.6 * dt);
    a.v += clamp((back ? PUSH_V : TAXI_V) - a.v, -0.5 * dt, 0.3 * dt);
    const step = Math.min(d, a.v * dt);
    a.x = mod(a.x + vx / (d || 1) * step, N); a.y = mod(a.y + vy / (d || 1) * step, N);
    if (d < 0.05) { a.path.shift(); a.state = 'taxi'; if (!a.path.length) { a.state = a.parkAt != null ? 'parked' : 'roll'; if (a.parkAt != null) { a.gate = a.parkAt; a.parkAt = null; a.v = 0; a.yaw = -Math.PI / 2; } } }
    return;
  }
  if (a.state === 'roll') { // full power down the runway, nose up at rotation speed
    a.yaw = 0; a.y += (RUNWAY.y - a.y) * Math.min(1, dt * 2);
    a.v += 1.25 * dt; a.x = mod(a.x + a.v * dt, N);
    if (a.v >= T_.vr) a.state = 'climb';
    return;
  }
  if (a.state === 'climb') { // away east over the bay, climbing, then a long turn to the south out of sight
    a.v = Math.min(T_.cruise, a.v + 0.5 * dt); a.pitch += (0.14 - a.pitch) * Math.min(1, dt * 1.5);
    const turn = a.z > 3 ? 0.06 : 0;
    a.yaw += turn * dt; a.roll += (turn * 4 - a.roll) * Math.min(1, dt);
    a.x = mod(a.x + Math.cos(a.yaw) * a.v * dt, N); a.y = mod(a.y + Math.sin(a.yaw) * a.v * dt, N); a.z += Math.sin(a.pitch) * a.v * dt;
    if (a.z > 14) aircraft.splice(aircraft.indexOf(a), 1); // (gone, high over the bay)
    return;
  }
  if (a.state === 'approach') { // on the glide slope, flaring just before the marks
    const toGo = rel(RUNWAY.x0 + 6 - a.x);
    a.x = mod(a.x + a.v * dt, N); a.yaw = 0;
    a.z = Math.max(0, toGo * GLIDE_SLOPE + (toGo < 2 ? 0.02 * toGo : 0));
    a.pitch = toGo < 3 ? 0.08 : 0.03;
    if (toGo <= 0) { a.z = 0; a.pitch = 0; a.state = 'rollout'; }
    return;
  }
  if (a.state === 'rollout') { // brakes and reversers, off at the east end, back along the taxiway to the gate
    a.v = Math.max(TAXI_V, a.v - 1.6 * dt); a.x = mod(a.x + a.v * dt, N);
    if (mod(a.x, N) >= TAXIWAY.x1 - 1) {
      const sx = STANDS_X[a.target];
      a.state = 'taxi'; a.parkAt = a.target; a.target = null;
      a.path = [[TAXIWAY.x1, RUNWAY.y - 0.8], [TAXIWAY.x1, TAXIWAY.y + 0.8], [TAXIWAY.x1 - 1, TAXIWAY.y], [sx + 1.2, TAXIWAY.y], [sx, TAXIWAY.y - 1], [sx, STAND_Y]];
    }
  }
}
// a plane's wings, in its own frame (aircraft-render.js draws them from this too): how far the outer panels are swept
// back, the inner panels' half chord, and how high they sit off the fuselage's axis
const wingGeom = T_ => ({ sweep: T_.engines ? T_.span * 0.12 : 0, chord: T_.len * (T_.engines ? 0.13 : 0.12), wz: T_.prop ? T_.r * 0.9 : -T_.r * 0.4 });
// its footprint seen from above, as rectangles [along, across (from the middle line, either side), half along, half
// across]: the fuselage, both wing panels, the tailplane, the engines. A helicopter: its cabin and the tail boom
function craftParts(T_) {
  if (T_.parts) return T_.parts;
  if (T_.heli) return T_.parts = [[0.02, 0, 0.22, 0.09], [-0.33, 0, 0.19, 0.03]];
  const { sweep, chord } = wingGeom(T_), L2 = T_.len / 2;
  T_.parts = [[0, 0, L2, T_.r], [-T_.len * 0.02, T_.span * 0.14, chord, T_.span * 0.14], [-T_.len * 0.02 - sweep, T_.span * 0.37, chord * 0.75, T_.span * 0.13],
    [-L2 + chord * 0.5, 0, chord * 0.55, T_.span * 0.17]];
  if (T_.engines === 'wing') T_.parts.push([T_.len * 0.03, T_.span * 0.2, T_.len * 0.07 + T_.r * 0.38, T_.r * 0.38]);
  if (T_.engines === 'tail') T_.parts.push([-L2 * 0.625, T_.r * 1.6, L2 * 0.175 + T_.r * 0.5, T_.r * 0.5]);
  return T_.parts;
}
// what you'd walk into: a parked (or taxiing) aircraft, wings and tail and all
function aircraftAt(x, y, pad = 0) {
  for (const a of aircraft) {
    if (a.z > 0.3 || Math.abs(rel(a.x - x)) > 2.5 || Math.abs(rel(a.y - y)) > 2.5) continue;
    const T_ = PLANE_TYPES[a.type], fx = Math.cos(a.yaw), fy = Math.sin(a.yaw), qx = rel(x - a.x), qy = rel(y - a.y);
    const along = qx * fx + qy * fy, across = Math.abs(-qx * fy + qy * fx);
    if (craftParts(T_).some(([ca, cb, ha, hb]) => Math.abs(along - ca) < ha + pad && Math.abs(across - cb) < hb + pad)) return a;
  }
  return null;
}

// ---- flying one (flight.js has your hands on the controls, the camera and the instruments). Arcade, GTA-style.
// input: { throttle: -1..1 (W/S), pitch: -1..1 (nose up +), turn: -1..1 (right +), lift: -1..1 (a helicopter's up +) }
// Returns what happened: 'takeoff', 'land', 'hard' (a heavy landing, some damage), 'crash', 'ditch' (into the water),
// 'stall' (too slow: the nose drops), 'bump'.
const G = 0.98; // gravity, cells a second a second
const stallSpeed = T_ => T_.vr * 0.85;
// the top of whatever's built at (x, y), from the ground up: a building's roof, the el's deck, the airport's
// buildings, a bridge tower; 0 on the ground. Given the height z something's at, a hangar it's inside is just its floor
function builtHeight(x, y, z = Infinity) {
  let h = Math.max(policeRoofHeight(x, y), airportHeight(x, y, z));
  for (const t of towers) if (Math.abs(rel(x - t.x)) < 0.4 && Math.abs(rel(y - t.y)) < 0.25) h = Math.max(h, TOWER_H);
  return h;
}
const overWater = (x, y) => seaAt(x, y) && !onPier(x, y) && !ROAD[idx(Math.floor(x), Math.floor(y))];
function flyStep(a, inp, dt) {
  const T_ = PLANE_TYPES[a.type], ev = [];
  if (a.wrecked) return ev;
  return T_.heli ? heliStep(a, T_, inp, dt, ev) : planeStep(a, T_, inp, dt, ev);
}
function planeStep(a, T_, inp, dt, ev) {
  const hd = T_.handling || 1;
  a.throttle = clamp((a.throttle || 0) + inp.throttle * 0.7 * hd * dt, 0, 1);
  const stall = stallSpeed(T_);
  if (a.ground) { // on the wheels: steer the nose wheel, brake with the throttle shut (stopped, it backs up), rotate at speed
    a.v += (a.throttle * T_.top - a.v) * 0.12 * dt;
    if (inp.throttle < 0 && a.throttle === 0) a.v = a.v > 0.02 ? Math.max(0, a.v - 1.4 * dt) : Math.max(-0.35, a.v - 0.5 * dt); // (the brakes; then reverse)
    else if (a.v < 0) a.v = Math.min(0, a.v + 1 * dt);
    a.yaw += inp.turn * 0.9 * hd * clamp(a.v / 0.8, -1, 1) * (a.v < 2 ? 1 : 0.3) * dt;
    a.roll = 0; a.pitch = Math.max(0, a.pitch - dt * 0.5);
    if (a.v > T_.vr && inp.pitch > 0.2) { a.ground = false; a.pitch = 0.1; ev.push('takeoff'); }
  } else {
    const pull = a.throttle * T_.top - a.v;
    a.v += (pull * (pull > 0 ? 0.25 : 0.1) - G * Math.sin(a.pitch) * 1.2) * dt; // (diving speeds you up, climbing slows you; with the power off it glides)
    const heavy = 0.5 + 0.5 * hd; // (a big one banks less, and turns less for it)
    a.roll += (inp.turn * 0.75 * heavy - a.roll) * Math.min(1, 2.5 * hd * dt); // bank into the turn, level out when you let go
    a.yaw += a.roll * 0.9 * heavy * dt;
    if (inp.pitch) a.pitch += inp.pitch * 0.7 * hd * dt; else a.pitch -= a.pitch * 0.4 * dt;
    if (a.v < stall) { a.pitch -= (stall - a.v) * 0.7 * dt; if (!a.stalled) ev.push('stall'); a.stalled = true; } else a.stalled = false; // too slow: the nose drops
    a.pitch = clamp(a.pitch, -0.9, 0.55);
  }
  a.v = clamp(a.v, a.ground ? -0.35 : 0, T_.top * 1.3);
  // short of flying speed the wings hold you up less: throttle back and it settles gently (that's how you land);
  // below the stall it drops
  const level = T_.vr * 1.2, sink = a.ground ? 0 : Math.min(1.3, Math.max(0, level - Math.max(a.v, stall)) * 0.5 + Math.max(0, stall - a.v) * 0.9);
  a.vz = a.ground ? 0 : a.v * Math.sin(a.pitch) - sink;
  return moveCraft(a, T_, Math.cos(a.yaw) * a.v * Math.cos(a.pitch), Math.sin(a.yaw) * a.v * Math.cos(a.pitch), dt, ev);
}
function heliStep(a, T_, inp, dt, ev) {
  a.rotor = inp.dead ? Math.max(0, (a.rotor || 0) - dt / 4) : Math.min(1, (a.rotor || 0) + dt / 3); // spinning up when you get in (down, with nobody at the controls)
  a.rotorA = ((a.rotorA || 0) + a.rotor * 25 * dt) % TAU;
  const ready = a.rotor > 0.95;
  a.yaw += inp.turn * 1.3 * dt;
  const fwd = inp.throttle > 0 ? inp.throttle * T_.top : inp.throttle * T_.top * 0.4, hx = Math.cos(a.yaw), hy = Math.sin(a.yaw);
  a.hvx = (a.hvx || 0) + (hx * fwd * (ready ? 1 : 0) - (a.hvx || 0)) * Math.min(1, 1.1 * dt);
  a.hvy = (a.hvy || 0) + (hy * fwd * (ready ? 1 : 0) - (a.hvy || 0)) * Math.min(1, 1.1 * dt);
  a.v = Math.hypot(a.hvx, a.hvy);
  a.vz = ready ? (a.vz || 0) + (inp.lift * T_.climb * (inp.lift < 0 ? 0.55 : 1) - (a.vz || 0)) * Math.min(1, 2 * dt) : a.ground ? 0 : (a.vz || 0) - G * dt;
  if (a.ground && a.vz <= 0) { a.vz = 0; a.hvx *= 1 - Math.min(1, 4 * dt); a.hvy *= 1 - Math.min(1, 4 * dt); }
  else if (a.ground && a.vz > 0) { a.ground = false; ev.push('takeoff'); }
  a.pitch += (-inp.throttle * 0.2 * (a.ground ? 0 : 1) - a.pitch) * Math.min(1, 3 * dt); // (nose down to go forward)
  a.roll += (inp.turn * 0.12 * (a.ground ? 0 : 1) - a.roll) * Math.min(1, 3 * dt);
  return moveCraft(a, T_, a.hvx, a.hvy, dt, ev);
}
// what an aircraft can't go into: the airport's walls, and the terminal at all (it fits through the doors; it mustn't)
const craftBlocked = (x, y) => airportBlocked(x, y) || airportBldgAt(x, y)?.kind === 'terminal';
// move it, and what it meets: the ground (a landing, or not), a building (on top: a landing; its side: a crash), the water
function moveCraft(a, T_, vx, vy, dt, ev) {
  if (a.vz > 0 && T_.ceil) a.vz *= clamp((T_.ceil - a.z) / 2, 0, 1); // near its ceiling the climb fades away to nothing
  const nx = mod(a.x + vx * dt, N), ny = mod(a.y + vy * dt, N), h = builtHeight(nx, ny, a.z), speed = Math.hypot(vx, vy);
  let nz = a.z + a.vz * dt;
  if (a.ground) { // rolling or sitting: into a wall, a building, another aircraft, the water?
    const nose = (T_.heli ? 0.25 : T_.len / 2) * (!T_.heli && a.v < 0 ? -1 : 1), fx = nx + Math.cos(a.yaw) * nose, fy = ny + Math.sin(a.yaw) * nose; // (backing up: its tail)
    if (speed > 0.02 && (builtHeight(fx, fy, a.z) > a.z + 0.2 || craftBlocked(fx, fy) || aircraftAt(fx, fy) && aircraftAt(fx, fy) !== a)) {
      if (speed > 1.2) return crashCraft(a, speed, ev);
      a.v = 0; a.hvx = a.hvy = 0; ev.push('bump'); return ev;
    }
    if (overWater(nx, ny)) return ditchCraft(a, ev);
    a.x = nx; a.y = ny; a.z = Math.max(h, nz); return ev;
  }
  const top = builtHeight(nx, ny); // (what's there, all of it: in a hangar, its roof overhead)
  if (h < top && nz > top - 0.05) { nz = top - 0.05; a.vz = Math.min(0, a.vz); } // inside a hangar: the roof stops you
  if (craftBlocked(nx, ny) && a.z < top - 0.1) return crashCraft(a, Math.hypot(speed, a.vz), ev); // into a wall, from the side
  if (nz > h) { a.x = nx; a.y = ny; a.z = nz; return ev; }
  // down to something: water, the side of a building, or a surface to land on
  if (overWater(nx, ny) && h === 0) return ditchCraft(a, ev);
  if (a.z < h - 0.1) return crashCraft(a, Math.hypot(speed, a.vz), ev); // flew into its side
  const down = -a.vz, gentle = T_.heli ? down < 1 && speed < 1.5 : down < 0.9 && Math.abs(a.roll) < 0.35 && a.pitch > -0.12;
  const hard = T_.heli ? down < 1.8 && speed < 2.5 : down < 1.6 && Math.abs(a.roll) < 0.55 && a.pitch > -0.25;
  if (!gentle && !hard) return crashCraft(a, Math.hypot(speed, a.vz), ev);
  a.x = nx; a.y = ny; a.z = h; a.vz = 0; a.ground = true; a.roll = 0; a.stalled = false;
  if (!T_.heli) a.pitch = Math.max(0, a.pitch);
  if (!gentle) { damageCraft(a, 25 + down * 15); ev.push('hard'); } else ev.push('land');
  return ev;
}
// it hits: where it is, if that's on something (the ground, a roof); up in the air against a wall it doesn't stop there
// or jump to the ground below: it drops, nose going over, till it lands on whatever's under it (stepCraftFalls)
function crashCraft(a, speed, ev) {
  a.crashSpeed = speed; a.v = 0; a.hvx = a.hvy = 0; a.vz = 0; a.roll = 0;
  const below = Math.max(0, builtHeight(a.x, a.y, a.z));
  if (a.z > below + 0.05) { a.falling = true; a.ground = false; a.spin = (a.yaw * 7 % 2 > 1 ? 1 : -1) * (0.6 + speed * 0.2); }
  else { a.z = below; a.ground = true; a.pitch = 0; }
  damageCraft(a, speed > 1.5 ? DMG_FIRE : 40 + speed * 30);
  ev.push('crash'); return ev;
}
// wrecks coming down: gravity, tumbling, bounced back off the wall a little; onto the ground or a roof, or into the
// water (where it sinks)
function stepCraftFalls(dt) {
  for (const a of aircraft) {
    if (!a.falling) continue;
    a.vz -= G * dt; a.z += a.vz * dt;
    a.pitch = Math.max(-1.1, a.pitch - 0.8 * dt); a.roll += a.spin * dt;
    const bx = mod(a.x - Math.cos(a.yaw) * 0.25 * dt, N), by = mod(a.y - Math.sin(a.yaw) * 0.25 * dt, N);
    if (!craftBlocked(bx, by) && builtHeight(bx, by, a.z) <= a.z) { a.x = bx; a.y = by; }
    const below = Math.max(0, builtHeight(a.x, a.y, a.z));
    if (a.z > below) continue;
    a.z = below; a.vz = 0; a.falling = false; a.ground = true; a.roll = 0; a.pitch = Math.max(a.pitch, -0.35);
    if (below === 0 && overWater(a.x, a.y)) { a.ditched = true; a.sinkT = T; }
  }
}
function ditchCraft(a, ev) { a.ditched = true; a.v = 0; a.hvx = a.hvy = 0; a.vz = 0; a.z = 0; a.ground = true; ev.push('ditch'); return ev; }
// aircraft damage works as the cars' does (damage.js): at the top it burns, and BURN_T later it goes up
function damageCraft(a, n) {
  if (a.wrecked || !(n > 0)) return;
  a.dmg = Math.min(DMG_FIRE, (a.dmg || 0) + n);
  if (a.dmg >= DMG_FIRE && a.fireT == null) a.fireT = 0;
}
function stepAircraftFires(dt) {
  const out = [];
  for (const a of aircraft) if (a.fireT != null && !a.wrecked && (a.fireT += dt) >= BURN_T) { a.wrecked = true; a.boomT = T; out.push(a); }
  return out;
}

// ---- the airport's fleet, bought or stolen. Yours stays where you leave it (and is saved); one you stole and left
// somewhere goes back to its stand once you're well away; a wreck, or one at the bottom of the bay, is replaced on its
// stand (yours on the insurance, which charges the excess)
const AIR_EXCESS = 500;
const AIR_AWAY = 30; // how far off you must be (from it, and from its stand) before it's quietly put back
function returnHome(a) {
  const h = a.home;
  Object.assign(a, { x: h.x, y: h.y, yaw: h.yaw, z: 0, pitch: 0, roll: 0, v: 0, vz: 0, hvx: 0, hvy: 0, throttle: 0, rotor: 0, dmg: 0, ground: true, state: 'parked' });
  for (const k of ['wrecked', 'fireT', 'ditched', 'sinkT', 'boomT', 'stalled', 'warnedFire', 'crashSpeed', 'stolen']) delete a[k];
}
// what wants putting back, given where you are and what you're flying: returns the ones it put back
function stepFleet(px_, py_, flying) {
  const back = [];
  for (let k = aircraft.length - 1; k >= 0; k--) { // a stolen airliner left somewhere: once you're well away, the airline has it towed off
    const a = aircraft[k];
    if (a.type === 'airliner' && a.stolen && a !== flying && a.state !== 'abandoned' && !(a.fireT != null && !a.wrecked) && Math.hypot(rel(a.x - px_), rel(a.y - py_)) > AIR_AWAY) aircraft.splice(k, 1);
  }
  for (const a of aircraft) {
    if (!a.home || a === flying || a.state === 'abandoned' || a.fireT != null && !a.wrecked) continue; // (let a fire burn out first)
    const lost = a.wrecked || a.ditched, astray = !a.owned && (Math.abs(rel(a.x - a.home.x)) > 0.05 || Math.abs(rel(a.y - a.home.y)) > 0.05 || a.dmg > 0);
    if (!lost && !astray) continue;
    const far = (x, y) => Math.hypot(rel(x - px_), rel(y - py_)) > AIR_AWAY;
    if (!a.ditched && !far(a.x, a.y) || !far(a.home.x, a.home.y)) continue;
    if (aircraft.some(b => b !== a && !b.ditched && Math.hypot(rel(b.x - a.home.x), rel(b.y - a.home.y)) < 1)) continue; // (something's on its stand)
    returnHome(a); back.push(a);
  }
  return back;
}
// the save: which of the fleet are yours, and where they are
// (one that's up in the air when you leave is waiting on its stand when you come back)
const savedPlanes = () => aircraft.filter(a => a.owned).map(a => {
  const up = a.state === 'flown' && !a.ground, at = up ? a.home : a;
  return { id: a.id, type: a.type, x: at.x, y: at.y, yaw: at.yaw, dmg: a.dmg || 0, lost: !!(a.wrecked || a.ditched || a.fireT != null) };
});
function loadPlanes(list) {
  for (const p of list || []) {
    const a = aircraft.find(b => b.id === p.id && b.type === p.type && b.home);
    if (!a) continue;
    a.owned = true; a.forSale = false;
    if (p.lost) { returnHome(a); a.owed = true; continue; } // (the insurance has it: the excess is due when you next fly)
    if (![p.x, p.y, p.yaw].every(Number.isFinite) || overWater(p.x, p.y)) continue;
    a.x = mod(p.x, N); a.y = mod(p.y, N); a.yaw = p.yaw; a.z = builtHeight(a.x, a.y, 0); a.dmg = clamp(p.dmg || 0, 0, DMG_FIRE - 1);
  }
}
