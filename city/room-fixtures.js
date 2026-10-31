// ---- the fixtures anybody can use, in any room: the tap on every sink (bathroom basins, fitted kitchens) and a
// light switch on the wall beside the way out. Aim and E. Taps run till you turn them off (or leave); the switch
// takes the room down to a glow, and the ceiling lamps in shops go with it (render.js dims by homeBaseLight).
// In your own place the switch flips the fixed lamps the same as aiming at them does (home-furnishing-ui.js).
const ROOM_DIM = .2; // how much light is left with the switch off
// where each sink's water comes out, and where it lands. Bathroom basins and fitted kitchens share bathroomTap, whose
// spout ends .06 in front of the tap, .18 above its base
function roomTaps(r = room) {
  if (r.taps) return r.taps;
  const taps = [];
  for (const p of r.props) {
    const b = p.bathroomSink, k = p.kitchen;
    if (b) taps.push({ x: b.x - .06 * b.fx, y: b.y - .06 * b.fy, z: 1.03, bowl: .8, prop: p });
    if (k) {
      const c = Math.cos(k.angle), s = Math.sin(k.angle), v = .19 - k.radius - .045, tx = p.x + c * k.sink - s * v, ty = p.y + s * k.sink + c * v;
      taps.push({ x: tx + s * .06, y: ty - c * .06, z: k.height + .17, bowl: .78, prop: p });
    }
    if (p.sinkTap) taps.push({ ...p.sinkTap, prop: p });
  }
  for (const t of taps) {
    t.on = false;
    t.stream = { ...ROOM_MODEL(t.x, t.y, (vx, vy) => {
      if (!t.on) return;
      drawRod(vx, vy, t.z, vx, vy, t.bowl, .008, (i, tt, L) => {
        const ripple = Math.sin(T * 40 + HIT.w * 90) * .5 + .5;
        BG[i] = C(CYAN, 2.6 + L * .2 + ripple * .9); set(i, ripple > .7 ? ':' : '|', C(WHITE, L * .5)); return true;
      });
    }), radius: .2 };
  }
  return r.taps = taps;
}
// the switch: on the wall beside the first doorway, a hand's width from the frame. null if the room has no door
function roomSwitchSpot(r) {
  const g = r.grid, at = (x, y) => g[y]?.[x];
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
    if (at(x, y) !== 'D') continue;
    for (const [nx, ny] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { // the way into the room
      if (at(x + nx, y + ny) !== '.') continue;
      const tx = -ny, ty = nx;
      for (const dir of [1, -1]) {
        let k = 1; while (at(x + tx * dir * k, y + ty * dir * k) === 'D') k++;
        const wx = x + tx * dir * k, wy = y + ty * dir * k;
        if (at(wx, wy) !== '#' || at(wx + nx, wy + ny) !== '.') continue;
        const along = -dir * .25, sx = wx + .5 + nx * .52 + tx * along, sy = wy + .5 + ny * .52 + ty * along;
        if (r.props.some(p => p.box && !p.walk && p.box.z1 > 1 && p.box.z0 < 1.4 && inBox(p.box, sx + nx * .1, sy + ny * .1, .05))) continue;
        return { x: sx, y: sy, nx, ny };
      }
    }
  }
  return null;
}
const roomLightsOn = (r = room) => {
  const home = homeRecord(r);
  return home ? !(r.def.lamps || []).length || (r.def.lamps || []).some((_, k) => home.lights?.['fixed' + k] !== false) : !r.lightsOff;
};
function roomSwitch(r = room) {
  if (r.lightSwitch !== undefined) return r.lightSwitch;
  const at = r.kind === 'train' || homeRecord(r) && !(r.def.lamps || []).length ? null : roomSwitchSpot(r);
  if (!at) return r.lightSwitch = null;
  const c = -at.ny, s = at.nx, plate = (i, t, L) => { BG[i] = C(WHITE, 3.4 + L * .25); set(i, ' ', 0); return true; };
  const rocker = (i, t, L) => { BG[i] = C(GRAY, 2 + L * .3); set(i, ' ', 0); return true; };
  const model = { ...ROOM_MODEL(at.x, at.y, (vx, vy) => {
    drawBox(boxAt(vx, vy, c, s, .045, .006, 1.15, 1.27), plate);
    const up = roomLightsOn(r) ? .012 : -.012; // (down for off, as switches go)
    drawBox(boxAt(vx + at.nx * .01, vy + at.ny * .01, c, s, .014, .006, 1.2 + up - .02, 1.2 + up + .02), rocker);
  }), radius: .1, lightSwitch: true };
  r.props.push(model);
  return r.lightSwitch = { ...at, model };
}
// apply the switch: a shop's own lights; at home, every fixed lamp at once
function setRoomLights(on, r = room) {
  const home = homeRecord(r);
  if (home) {
    home.lights ||= {};
    (r.def.lamps || []).forEach((_, k) => { home.lights['fixed' + k] = on; });
    updateHomeLights(); saveGame(); return;
  }
  r.lightsOff = !on;
  r.homeBaseLight ??= r.def.light;
  r.def = { ...r.def, light: r.homeBaseLight * (on ? 1 : ROOM_DIM) };
}
// what E can aim at: the switch, any tap, and (in shops) the ceiling lamps themselves
function roomFixtureTargets() {
  if (mode !== 'room' || !room) return [];
  const out = [], sw = roomSwitch();
  if (sw) {
    if (!room.props.includes(sw.model)) room.props.push(sw.model); // (a furnished home rebuilds its props)
    out.push({ kind: 'switch', x: sw.x, y: sw.y, z0: 1.12, z1: 1.3, radius: .08, reach: 2 });
  }
  for (const t of roomTaps()) {
    if (!room.props.includes(t.stream)) room.props.push(t.stream);
    out.push({ kind: 'tap', tap: t, x: t.x, y: t.y, z0: t.bowl, z1: t.z + .05, radius: .12, reach: 1.8, part: t.prop });
  }
  if (!homeRecord(room)) for (const p of room.props) if (p.ceilingPendant || p.ceilingTrack) {
    const top = room.def.height || 3;
    out.push({ kind: 'lamp', x: p.x, y: p.y, z0: top - .8, z1: top, radius: p.ceilingTrack ? Math.min(.4, p.ceilingTrack.length / 2) : .25, reach: 3.2, part: p });
  }
  return out;
}
function roomFixturePrompt(t) {
  if (t.kind === 'tap') return t.tap.on ? 'E: turn the tap off' : 'E: turn the tap on';
  return roomLightsOn() ? 'E: switch the lights off' : 'E: switch the lights on';
}
function roomFixtureUse(t) {
  if (t.kind === 'tap') {
    t.tap.on = !t.tap.on;
    if (actx) burst(actx.currentTime, t.tap.on ? .5 : .12, [filt('bandpass', 2800, .8)], t.tap.on ? .07 : .03);
    if (!t.tap.on) return say('You turn the tap off. It drips once, and stops.', 2);
    if (needs.drink < 70 && !heldItem()) { // (empty-handed and thirsty: you cup your hands under it)
      needs.drink = Math.min(100, needs.drink + 15);
      return say('You cup your hands under the tap and drink. Cold, and a bit metallic.', 3);
    }
    return say(pick(['The tap coughs, then runs clear.', 'Water drums into the basin.', 'You run the tap. It takes a moment to get cold.']), 2);
  }
  const on = !roomLightsOn();
  setRoomLights(on);
  if (actx) sfxUse('click');
  say(on ? 'Click. The lights come back up.' : 'Click. The room drops into shadow.', 2);
}
