// The recognizer is platform independent: normalized x/right, y/tail samples,
// timestamped in seconds. Mouse and gamepad share the same state machine.
function skateStick(x = 0, y = 0, dead = .15) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const r = Math.hypot(x, y);
  if (r <= dead) return [0, 0];
  const scale = Math.min(1, (r - dead) / (1 - dead)) / r;
  return [x * scale, y * scale];
}
function createSkateGesture() {
  let samples = [], load = null, armed = true, lastTime = -Infinity;
  const reset = () => { samples = []; load = null; armed = true; lastTime = -Infinity; };
  function sample(x, y, t) {
    if (![x, y, t].every(Number.isFinite)) return null;
    if (t < lastTime) reset();
    lastTime = t;
    samples.push({ x, y, t });
    samples = samples.filter(p => t - p.t <= .4).slice(-128);
    const radius = Math.hypot(x, y);
    if (!armed) { if (radius < .25) armed = true; return null; }
    if (!load) {
      if (Math.abs(y) > .6 && Math.abs(x) < .45) load = { side: Math.sign(y), t, arc: 0, angle: Math.atan2(y, x), left: false, fastest: 0 };
      return null;
    }
    if (radius > .45) {
      for (const p of samples) if (t - p.t <= .12 && t > p.t)
        load.fastest = Math.max(load.fastest, Math.hypot(x - p.x, y - p.y) / .12);
    }
    if (!load.left && y * load.side > .6 && Math.abs(x) < .45) { load.t = t; load.angle = Math.atan2(y, x); return null; }
    load.left = true;
    if (t - load.t > .18) { load = null; return null; }
    if (radius > .45) {
      const angle = Math.atan2(y, x), delta = Math.atan2(Math.sin(angle - load.angle), Math.cos(angle - load.angle));
      // A straight flick crosses the centre and jumps angle by pi. Only a
      // series of small angular steps is a scoop, never that single jump.
      if (Math.abs(delta) < 1.2) load.arc += delta;
      load.angle = angle;
    }
    const arc = Math.abs(load.arc), curled = arc > 1.3;
    const forward = y * load.side < -.6;
    const released = radius < .25;
    if ((!curled && forward) || (curled && released && arc > 2.3)) {
      const key = arc > 4.2 ? (load.arc > 0 ? 'AS' : '360S') : arc > 2.3 ? 'S' : x < -.3 ? 'A' : x > .3 ? 'D' : '';
      const result = { key, nollie: load.side < 0, strength: .7 + .45 * Math.min(1, load.fastest / (2 / .12)) };
      load = null; armed = false; return result;
    }
    // Passing through centre is part of a straight flick; retain the load
    // until the 180 ms deadline instead of cancelling at that midpoint.
    return null;
  }
  return { sample, reset, get loaded() { return !!load; }, get samples() { return samples.slice(); } };
}
const skateGestureLoaded = () => SK_INPUT.padGesture.loaded || SK_INPUT.mouseHeld && SK_INPUT.mouseGesture.loaded;

const SK_INPUT = { steer: 0, push: false, mongo: false, brake: false, grabL: 0, grabR: 0,
  right: [0, 0], mouse: [0, 0], mouseHeld: false, mouseT: -9, fired: false,
  padGesture: createSkateGesture(), mouseGesture: createSkateGesture() };
function skateInputReset() {
  Object.assign(SK_INPUT, { steer: 0, push: false, mongo: false, brake: false, grabL: 0, grabR: 0,
    right: [0, 0], mouse: [0, 0], mouseHeld: false, fired: false });
  SK_INPUT.padGesture.reset(); SK_INPUT.mouseGesture.reset();
}
function skateGesturePlay(gesture) {
  if (!gesture || SK.bail > 0) return false;
  if (skateAir()) {
    const [name, flip, turn] = TRICKS[gesture.key] || ['ollie', 0, 0];
    if (!flip && !turn || body.trick && body.trick.flip && body.trick.t < (body.trick.duration ?? body.trick.air)) return false;
    body.trick = skateTrick('late ' + name, flip, turn, .32, gesture.nollie);
  } else skatePop(gesture.key, gesture);
  return true;
}
function skateMouseBegin() {
  SK_INPUT.mouse = [0, 0]; SK_INPUT.mouseHeld = true; SK_INPUT.mouseT = T;
  SK_INPUT.fired = false; SK_INPUT.mouseGesture.reset();
}
function skateMouseMove(x, y) {
  const m = SK_INPUT.mouse, r = Math.hypot(m[0] + x / 60, m[1] + y / 60);
  SK_INPUT.mouse = [(m[0] + x / 60) / Math.max(1, r), (m[1] + y / 60) / Math.max(1, r)];
  SK_INPUT.mouseT = T;
  if (skateGesturePlay(SK_INPUT.mouseGesture.sample(...SK_INPUT.mouse, T))) SK_INPUT.fired = true;
}
function skateMouseEnd() {
  if (skateGesturePlay(SK_INPUT.mouseGesture.sample(0, 0, T))) SK_INPUT.fired = true;
  SK_INPUT.mouseHeld = false; SK_INPUT.mouse = [0, 0];
  return SK_INPUT.fired;
}
function skatePollInput(dt) {
  if (typeof paused !== 'undefined' && paused || typeof document !== 'undefined' && document.hidden) { skateInputReset(); return; }
  // Exactly one Gamepad API read per simulation frame. No synthetic key presses,
  // so disconnecting a pad cannot leave the keyboard stuck down.
  let pads = [];
  try { pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() || [] : []; } catch (_) { /* browser policy may deny gamepads */ }
  const pad = Array.from(pads).find(p => p?.connected && (p.mapping === 'standard' || !p.mapping));
  const button = i => pad?.buttons[i]?.value || (pad?.buttons[i]?.pressed ? 1 : 0);
  SK_INPUT.steer = pad ? skateStick(pad.axes[0], pad.axes[1])[0] : 0;
  SK_INPUT.push = button(0) > .5 || button(2) > .5; SK_INPUT.mongo = button(2) > .5;
  SK_INPUT.brake = button(1) > .5; SK_INPUT.grabL = button(6); SK_INPUT.grabR = button(7);
  SK_INPUT.right = pad ? skateStick(pad.axes[2], pad.axes[3]) : [0, 0];
  if (!pad) SK_INPUT.padGesture.reset();
  else skateGesturePlay(SK_INPUT.padGesture.sample(...SK_INPUT.right, T));
  if (SK_INPUT.mouseHeld) {
    const relax = Math.exp(-dt / .15);
    if (T - SK_INPUT.mouseT > .015) SK_INPUT.mouse = SK_INPUT.mouse.map(v => v * relax);
    if (skateGesturePlay(SK_INPUT.mouseGesture.sample(...SK_INPUT.mouse, T))) SK_INPUT.fired = true;
  }
}
