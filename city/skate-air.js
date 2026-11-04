// Board rotation and catch live independently of the rider's yaw. Radians and
// cell velocities; the legacy body still integrates vertical metres this release.
function skateTrick(name, flip, turn, air, nollie = false) {
  return { name, flip, turn, air, t: 0, nollie, duration: flip || turn ? (Math.abs(turn) >= 1 ? .42 : .32) : .08,
    pitch: SKB.pitch, caughtAt: null, grab: null, grabTime: 0, grabPoints: 0 };
}
function skateBoardAxes(yaw, pitch, roll) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return { axis: [c * cp, s * cp, sp], up: [-c * sp * cr - s * sr, -s * sp * cr + c * sr, cp * cr] };
}
function skateLandingQuality({ up, axis, velocity, normal, catchLead = Infinity, catchWindow = .12, grab = false }) {
  if (grab) return 'bail';
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const angle = Math.acos(clamp(dot(up, normal), -1, 1));
  // Compare both directions in the surface plane, allowing switch and fakie.
  const project = v => { const d = dot(v, normal); return v.map((x, i) => x - d * normal[i]); };
  const av = project(axis), vv = project(velocity), denom = Math.hypot(...av) * Math.hypot(...vv);
  const line = denom > 1e-9 ? Math.acos(clamp(Math.abs(dot(av, vv) / denom), 0, 1)) : 0;
  const tilt = 25 * Math.PI / 180, align = 20 * Math.PI / 180;
  if (angle <= tilt && line <= align && catchLead >= catchWindow * .7) return 'clean';
  if (angle <= tilt * 1.6 && line <= align * 1.6 && catchLead >= catchWindow * .7 / 1.6) return 'sloppy';
  return 'bail';
}
function skateAirPose(dt = 0) {
  const tr = body.trick;
  SKB.riderYaw = a;
  if (!tr) { SKB.yaw = a; return; }
  const duration = tr.duration ?? tr.air, p = clamp(tr.t / duration, 0, 1), e = p * p * (3 - 2 * p);
  SKB.yaw = a + e * tr.turn * Math.PI * 2;
  SKB.roll = e * tr.flip * Math.PI * 2;
  SKB.pitch = (tr.pitch || 0) + Math.sin(Math.min(1, p * 4) * Math.PI) * .35 * (tr.nollie ? -1 : 1);
  if (tr.caughtAt == null && tr.t >= duration) tr.caughtAt = duration;
  const left = K.KeyQ || SK_INPUT.grabL > .25, right = K.KeyE || SK_INPUT.grabR > .25;
  if ((left || right) && tr.caughtAt != null) {
    const [x, y] = SK_INPUT.mouseHeld ? SK_INPUT.mouse : SK_INPUT.right;
    tr.grab = y < -.4 ? 'nose grab' : y > .4 ? 'tail grab' : left ? (x < 0 ? 'melon' : 'mute') : x > 0 ? 'stalefish' : 'indy';
    tr.grabTime = (tr.grabTime || 0) + dt;
    tr.grabPoints = Math.round(tr.grabTime * 150);
  } else {
    if (tr.grab) tr.lastGrab = tr.grab;
    tr.grab = null;
  }
  SKB.trick = { flip: SKB.roll, shuv: e * tr.turn * Math.PI * 2, spin: SK.spin,
    grab: tr.grab, t: tr.t, catchT: tr.caughtAt };
}
function skateManualEnd(scrape = false) {
  const m = SK.manual;
  if (!m) return;
  SK.manual = null;
  if (scrape) { SK.v *= .6; if (actx) sfxSkate('scrape', .5); }
  if (T - m.t0 > .25) {
    const c = SK.combo ||= { names: [], pts: 0, t: T };
    c.names.push(m.nose ? 'NOSE MANUAL' : 'MANUAL'); c.pts += Math.round((T - m.t0) * 100); c.t = T;
  }
}
function skateManualStep(dt) {
  if (skateAir() || SK.grind || SK.bail > 0) { skateManualEnd(); return; }
  const depth = SK_INPUT.mouseHeld ? SK_INPUT.mouse[1] : SK_INPUT.right[1];
  const held = Math.abs(depth) > .18 && Math.abs(depth) < .55 && SK.v > .06;
  if (!held) { if (SK.manual) skateManualEnd(); return; }
  if (!SK.manual) SK.manual = { nose: depth < 0, t0: T, bal: 0, balV: 0 };
  const m = SK.manual, control = (Math.abs(depth) - .35) * 6 * (m.nose ? -1 : 1);
  m.balV += (m.bal * 1.1 + control + Math.sin((T - m.t0) * 2.7) * .12 - SK.steer * .12 - m.balV * 1.6) * dt;
  m.bal += m.balV * dt;
  if (m.bal < -1) { SK.manual = null; return skateBail('BAIL! Over the nose.'); }
  if (m.bal > 1) return skateManualEnd(true);
  SKB.pitch += (m.nose ? -1 : 1) * (.15 + m.bal * .12);
  SKB.contact = 'manual';
}
