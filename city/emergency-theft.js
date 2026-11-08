'use strict';
// ---- the emergency vehicles you can take (WORLD_QUALITY item 45). The ambulance, fire engine or police car parked out
// front of its station is a real vehicle: walk up, E, and it's yours (and stolen: the station always calls it in). One
// pulled in at a call can be taken too, while it's stopped there. Each drives like what it is (EV_HANDLING), and H
// works its lights and siren: traffic pulls over for you as it does for the real thing. Left behind and out of sight,
// it goes back to its station.

const EV_NAME = { amb: 'ambulance', fire: 'fire engine', police: 'police car' };
// multipliers on an ordinary car's driving (main.js drive): pickup, braking, steering, grip; and its own top speeds
const EV_HANDLING = {
  amb: { accel: 1.35, brake: .8, steer: .7, grip: .85, top: 2.0, boost: 2.6 }, // heavy and slow to turn, but quick off the line
  fire: { accel: .7, brake: .65, steer: .55, grip: .8, top: 1.7, boost: 2.1 }, // the heaviest thing on the road: everything takes a while
  police: { accel: 1.25, brake: 1.15, steer: 1.12, grip: 1.1, top: 2.6, boost: 3.6 }, // built for it
};
const NO_HANDLING = { accel: 1, brake: 1, steer: 1, grip: 1 };

// the station vehicle within reach, waiting at its kerb
function nearStationVehicle(r = .5) {
  if (mode !== 'walk') return null;
  let best = null, bd = r;
  for (const b of SERVICES) if (!b.out) { const d = Math.hypot(rel(b.x - px), rel(b.y - py)); if (d < bd) { bd = d; best = b; } }
  return best;
}
// one stopped at a call that you could take, in reach
function nearSceneVehicle(r = .5) {
  if (mode !== 'walk') return null;
  return cars.find(c => c.ev && !playerCar(c) && !c.mine && c.state === 'scene' && Math.abs(c.v) < .6 && Math.hypot(rel(c.x - px), rel(c.y - py)) < r) || null;
}
function evPrompt() {
  const b = nearStationVehicle(), c = b ? null : nearSceneVehicle();
  return b || c ? `E: take the ${EV_NAME[(b || c).kind]}` : '';
}
// make it a driveable, stolen vehicle of yours (it remembers its station, to go back to)
function makeEvYours(c, base) {
  Object.assign(c, { ev: true, mine: true, state: null, dest: null, until: null, born: T, home: false, siren: false, parked: false,
    stolenFrom: base || c.base || null, base: null, handling: EV_HANDLING[c.kind], top: EV_HANDLING[c.kind].top, boost: EV_HANDLING[c.kind].boost });
  return c;
}
function driveOff(c, line) {
  me = c; mode = 'drive'; c.player = true; c.v = 0; a = Math.atan2(c.hy, c.hx); c.travelA = a; look = 0;
  px = c.ex; py = c.ey;
  const w = crime('steal', c.x, c.y);
  say(w === 'cop' ? 'A cop saw that.' : line, 3);
}
// E on foot: take the station's vehicle, or the one at the call. True if it did.
function takeEmergencyVehicle() {
  const b = nearStationVehicle();
  if (b) {
    b.out = true;
    const c = addCar({ kind: b.kind, body: EV_BODY[b.kind], x: b.x, y: b.y, hx: -1, hy: 0 });
    makeEvYours(c, b); c.ex = c.x; c.ey = c.y;
    driveOff(c, b.kind === 'police' ? 'The keys are in it. Of course they are.' : b.kind === 'fire' ? 'You haul yourself up into the cab. It\'s enormous.' : 'You climb into the ambulance. The keys are in it.');
    return true;
  }
  const c = nearSceneVehicle();
  if (c) {
    if (c.pursuit || c.patrol || c.returning) takePoliceCar(c);
    makeEvYours(c, c.base);
    driveOff(c, `The crew's busy. You slide into the ${EV_NAME[c.kind]} and pull away.`);
    return true;
  }
  return false;
}
// H at the wheel of one: lights and siren on or off
function toggleEvSiren() {
  if (mode !== 'drive' || !me?.ev) return false;
  me.siren = !me.siren;
  say(me.siren ? 'Lights and siren.' : 'Lights off.', 1.5);
  return true;
}
// left somewhere and out of sight: back to its station (taken off the road; it's parked out front again)
function returnStolenEv(c, k) {
  cars.splice(k, 1);
  if (c.stolenFrom) c.stolenFrom.out = false;
}
