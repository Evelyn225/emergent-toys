// ===== aircraft: everything that flies from the airport (world.js has the airport, aircraft-render.js draws them,
// flight.js flies the one you're in). Speeds in cells a second (1 = 36 km/h), heights in cells (1 = 10m).
// The airliners belong to the airport: they sit at the gates, and every few minutes one pushes back, taxis out, rolls
// down the runway and climbs away east over the bay, or one comes in from the west, lands, and taxis to an empty gate.
// The light planes, the jet and the helicopters are there to be flown: bought at the terminal, or just taken.
const PLANE_TYPES = {
  // len: nose to tail; span: wingtip to wingtip; r: the fuselage's radius; tail: the fin's height; vr: rotation speed
  // (lift-off); cruise / top: in the air; climb: how hard it can climb (cells a second at full throttle); price: to buy
  airliner: { name: 'airliner', len: 3.4, span: 3.2, r: 0.2, tail: 0.85, body: WHITE, stripe: BLUE, engines: 'wing', vr: 7.5, cruise: 9 },
  prop: { name: 'Skylark', len: 0.8, span: 1.1, r: 0.065, tail: 0.24, body: WHITE, stripe: RED, prop: true, vr: 2.4, cruise: 4, top: 5.6, climb: 1.1, price: 9000 },
  jet: { name: 'Comet', len: 1.45, span: 1.15, r: 0.09, tail: 0.36, body: GRAY, stripe: CYAN, engines: 'tail', vr: 4, cruise: 7, top: 10, climb: 2.2, price: 30000 },
  heli: { name: 'Hornet', heli: true, len: 0.45, rotor: 0.5, body: RED, stripe: WHITE, top: 4.2, climb: 1.4, price: 14000 },
};
const aircraft = []; // { id, type, x, y, z, yaw, pitch, roll, v, state, ... }
let aircraftId = 0;
const STAND_Y = APRON.y0 + 1.75; // an airliner at its gate: nose to the terminal
function addAircraft(type, x, y, yaw, extra) {
  const a = { id: aircraftId++, type, x, y, z: 0, yaw, pitch: 0, roll: 0, v: 0, state: 'parked', dmg: 0, ...extra };
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
const gateFree = k => !aircraft.some(a => a.type === 'airliner' && a.gate === k);
function stepAirTraffic(dt, rnd = Math.random) {
  const moving = aircraft.find(a => a.type === 'airliner' && a.state !== 'parked');
  if (moving) stepAirliner(moving, dt);
  if (moving || (airNext -= dt) > 0) return;
  airNext = AIR_GAP[0] + rnd() * (AIR_GAP[1] - AIR_GAP[0]);
  const parked = aircraft.filter(a => a.type === 'airliner' && a.state === 'parked');
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
// what you'd walk into: a parked (or taxiing) aircraft's fuselage and its wheels; under the wings you can walk
function aircraftAt(x, y, pad = 0) {
  for (const a of aircraft) {
    if (a.z > 0.3 || Math.abs(rel(a.x - x)) > 2.5 || Math.abs(rel(a.y - y)) > 2.5) continue;
    const T_ = PLANE_TYPES[a.type], fx = Math.cos(a.yaw), fy = Math.sin(a.yaw), qx = rel(x - a.x), qy = rel(y - a.y);
    const along = qx * fx + qy * fy, across = -qx * fy + qy * fx;
    if (T_.heli ? Math.abs(along) < 0.24 + pad && Math.abs(across) < 0.09 + pad : Math.abs(along) < T_.len / 2 + pad && Math.abs(across) < T_.r + pad) return a;
  }
  return null;
}
