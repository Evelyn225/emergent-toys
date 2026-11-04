// A circular riding profile, extruded along its axis. u is signed arc length
// from the flat bottom's centre; unlike a heightfield this can include vert.
const SK_TRANSITIONS = [];
function skateProfile({ radius = .18, height = .14, extension = 0, flat = .24, width = .42, deck = .06 } = {}) {
  const angle = Math.acos(clamp(1 - (height - extension) / radius, 0, 1));
  const curve = radius * angle, limit = flat / 2 + curve + extension;
  const tip = flat / 2 + radius * Math.sin(angle), points = [];
  const profile = { radius, height, extension, flat, width, deck, angle, curve, limit, tip, points };
  const add = u => { const p = skateProfilePoint(profile, u); points.push([p.x, p.z]); };
  points.push([-tip - deck, height]);
  if (extension) add(-limit);
  for (let i = 16; i >= 0; i--) add(-flat / 2 - curve * i / 16);
  for (let i = 0; i <= 16; i++) add(flat / 2 + curve * i / 16);
  if (extension) add(limit);
  points.push([tip + deck, height]);
  return profile;
}
function skateProfilePoint(p, u) {
  const sign = Math.sign(u) || 1, arc = Math.max(0, Math.abs(u) - p.flat / 2);
  const theta = Math.min(p.angle, arc / p.radius), vert = Math.max(0, arc - p.curve);
  return { x: Math.abs(u) <= p.flat / 2 ? u : sign * (p.flat / 2 + p.radius * Math.sin(theta)),
    z: p.radius * (1 - Math.cos(theta)) + vert,
    tx: Math.cos(theta), tz: sign * Math.sin(theta), theta };
}
function skateProfileU(p, x, z = 0) {
  if (Math.abs(x) <= p.flat / 2) return x;
  const angle = Math.asin(clamp((Math.abs(x) - p.flat / 2) / p.radius, 0, Math.sin(p.angle)));
  return Math.sign(x) * (p.flat / 2 + p.radius * angle + (p.extension && Math.abs(x) >= p.tip - .002 ? clamp(z - (p.height - p.extension), 0, p.extension) : 0));
}
function skateProfileHeight(o, x) {
  const p = o.profile;
  return o.z0 + (Math.abs(x) > p.tip ? p.height : skateProfilePoint(p, skateProfileU(p, x)).z);
}
function skateTransitionAt(x, y, zHint = 0) {
  for (const o of SK_TRANSITIONS) {
    if (o.bowl) { const hit = skateBowlHit(o, x, y, zHint); if (hit) return hit; continue; }
    const qx = rel(x - o.x), qy = rel(y - o.y), xlocal = qx * o.c + qy * o.s, axis = -qx * o.s + qy * o.c;
    if (Math.abs(axis) > o.hw || Math.abs(xlocal) > o.profile.tip + .002) continue;
    const u = skateProfileU(o.profile, xlocal, zHint - o.z0), at = skateProfilePoint(o.profile, u);
    return { o, u, axis, at, n: [-o.c * at.tz, -o.s * at.tz, at.tx] };
  }
  return null;
}
function addSkateTransition(x, y, options = {}, yaw = 0) {
  const profile = skateProfile(options), o = { x, y, c: Math.cos(yaw), s: Math.sin(yaw),
    hl: profile.tip + profile.deck, hw: profile.width / 2, z0: terrainHeight(x, y) + .0002,
    z1: terrainHeight(x, y) + .0002 + profile.height + .003, kind: 'skateprofile', ramp: 'profile', profile,
    low: true, ray: typeof rayProfile === 'function' ? rayProfile : null };
  SK_TRANSITIONS.push(o); SKATE_FEATURES.push(o); solids.push(o);
  for (const side of [-1, 1]) {
    const ex = x + o.c * side * profile.tip, ey = y + o.s * side * profile.tip;
    GRINDS.push({ ax: ex + o.s * o.hw, ay: ey - o.c * o.hw, bx: ex - o.s * o.hw, by: ey + o.c * o.hw,
      z: profile.height + .003, material: 'metal', kind: 'coping', feature: o });
  }
  return o;
}
function enterSkateTransition(hit) {
  if (hit.o.bowl) return enterSkateBowl(hit);
  const { o, u, axis, at } = hit, tangent = [o.c * at.tx, o.s * at.tx, at.tz];
  const vertical = skateAir() ? body.vz / 10 : -(Math.cos(SK.dir) * SK.v * hit.n[0] + Math.sin(SK.dir) * SK.v * hit.n[1]) / Math.max(.05, hit.n[2]);
  SK.transition = { o, u, axis, vs: Math.cos(SK.dir) * SK.v * tangent[0] + Math.sin(SK.dir) * SK.v * tangent[1] + vertical * tangent[2],
    va: -Math.cos(SK.dir) * SK.v * o.s + Math.sin(SK.dir) * SK.v * o.c };
  skateManualEnd(); body.trick = null; body.vz = 0;
}
function skateTransitionPlace(C) {
  if (C.o.bowl) return skateBowlPlace(C);
  const { o } = C, at = skateProfilePoint(o.profile, C.u);
  px = worldCoord(o.x + o.c * at.x - o.s * C.axis); py = worldCoord(o.y + o.s * at.x + o.c * C.axis);
  const z = o.z0 + at.z;
  body.z = Math.max(.001, (z - skateGround(px, py)) * 10); body.vz = 0;
  SKB.v = [o.c * at.tx * C.vs - o.s * C.va, o.s * at.tx * C.vs + o.c * C.va, at.tz * C.vs];
  SK.v = Math.hypot(SKB.v[0], SKB.v[1]);
  if (SK.v > 1e-7) SK.dir = Math.atan2(SKB.v[1], SKB.v[0]);
  SKB.pitch = Math.atan2(at.tz, at.tx) * Math.sign(Math.cos(a) * o.c + Math.sin(a) * o.s || 1);
  SKB.roll = 0; SKB.yaw = a; SKB.p = [px, py, z]; SKB.contact = 'transition';
  SKB.surf = { h: z, n: [-o.c * at.tz, -o.s * at.tz, at.tx], kind: 'transition', material: 'concrete', ref: o };
  SKB.fakie = Math.cos(SK.dir - a) < 0;
  body.ground = skateGround(px, py); body.groundMode = mode;
  return at;
}
function skateTransitionRelease(C, coping = false) {
  const v = SKB.v.slice(), at = skateProfilePoint(C.o.profile, C.u);
  // The coping rounds the last few degrees of the mini's truncated quarter
  // into a vertical takeoff. Preserve energy and axis motion for the return.
  if (coping) { v[0] = -(C.o.bowl ? Math.sin(C.axis) : C.o.s) * C.va; v[1] = (C.o.bowl ? Math.cos(C.axis) : C.o.c) * C.va; v[2] = Math.abs(C.vs); }
  SK.transition = null; SK.leftTransition = C.o; SK.leftTransitionT = T;
  SK.v = Math.hypot(v[0], v[1]); if (SK.v > 1e-7) SK.dir = Math.atan2(v[1], v[0]);
  body.vz = v[2] * 10; body.z = Math.max(.002, body.z);
  SKB.v = v; SKB.contact = 'air'; SK.popT = T;
}
function stepSkateTransition(dt, push, brake, steer) {
  if (mode !== 'walk') { SK.transition = null; return false; }
  let C = SK.transition;
  if (!C) {
    let hit = skateTransitionAt(px, py, skateGround(px, py) + body.z / 10);
    let drop = false;
    if (!hit && push && SK.v < .1 && !skateAir()) for (const o of SK_TRANSITIONS) {
      const dx = rel(px - o.x), dy = rel(py - o.y), x = dx * o.c + dy * o.s, axis = -dx * o.s + dy * o.c;
      if(o.bowl){
        const r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
        if(r<o.profile.tip||r>o.profile.tip+o.profile.deck||Math.cos(a-angle)>-.2)continue;
        const u=o.profile.limit-.01,at=skateProfilePoint(o.profile,u);
        hit={o,u,axis:angle,at,n:[-Math.cos(angle)*at.tz,-Math.sin(angle)*at.tz,at.tx]};drop=true;break;
      }
      if (Math.abs(axis) > o.hw || Math.abs(x) < o.profile.tip || Math.abs(x) > o.profile.tip + o.profile.deck) continue;
      if ((Math.cos(a) * o.c + Math.sin(a) * o.s) * Math.sign(x) > -.2) continue;
      const u = Math.sign(x) * (o.profile.limit - .01), at = skateProfilePoint(o.profile, u);
      hit = { o, u, axis, at, n: [-o.c * at.tz, -o.s * at.tz, at.tx] }; drop = true; break;
    }
    if (!hit) return false;
    const surface = hit.o.z0 + hit.at.z, feet = skateGround(px, py) + body.z / 10;
    if (!skateAir() && feet > surface + .01 && !drop) return false;
    if (skateAir()) {
      if (body.vz > 0 || feet - surface > .025 || feet < surface - .015) return false;
      if (SK.leftTransition === hit.o && T - SK.leftTransitionT < .12) return false;
      skateAirPose();
      const quality = skateLandingQuality({ ...skateBoardAxes(SKB.yaw, SKB.pitch, SKB.roll), normal: hit.n,
        velocity: SKB.v, catchLead: body.trick ? body.trick.t - (body.trick.caughtAt ?? Infinity) : Infinity, grab: !!body.trick?.grab });
      if (quality === 'bail') { skateBail('BAIL! Missed the transition.'); return true; }
      if (quality === 'sloppy') SK.v *= .7;
    }
    enterSkateTransition(hit); C = SK.transition;
    if (drop) C.vs = -Math.sign(C.u) * .1;
  }
  if (C.o.bowl) return stepSkateBowl(C, dt, push, brake, steer);
  const at = skateProfilePoint(C.o.profile, C.u), p = C.o.profile;
  const direction = Math.sign(C.vs) || -Math.sign(C.u) || 1;
  C.vs += (-.98 * at.tz - (brake ? .25 : SK_PHYS.concrete * .98) * direction) * dt;
  // Pumping adds a small amount of work through the bottom of each turn;
  // ordinary pushes retain the same cadence and taper as flat riding.
  if (push && !skateGestureLoaded() && SK.charge < 0) {
    C.vs += direction * .06 * Math.sin(at.theta * 2) * dt;
    if (at.theta < .2 && Math.abs(C.vs) < SK_PHYS.pushCap) {
      const before = SK.kick; SK.kick += dt / .7;
      if (before < .15 && SK.kick >= .15) C.vs += direction * .06 * (1 - Math.abs(C.vs) / .6);
      if (SK.kick >= 1) SK.kick -= 1;
      SK.kicking = true;
    }
  } else SK.kick = 0;
  const turn = steer * 1.6 * dt, c = Math.cos(turn), s = Math.sin(turn), vs = C.vs * c - C.va * s;
  C.va = (C.vs * s + C.va * c) * Math.exp(-.04 * dt); C.vs = vs; a += turn;
  // Coping stalls: hold down for rock-to-fakie, up for an axle stall;
  // a neutral gentle right-stick pressure holds a 50-50 stall.
  const stall = Math.abs(C.u) > p.limit - .04 && Math.abs(C.vs) < .12 && (K.ArrowDown || K.ArrowUp || Math.abs(SK_INPUT.right[1]) > .2);
  if (stall) {
    C.stallAt ??= T; C.vs = 0;
    const name = K.ArrowDown ? 'ROCK TO FAKIE' : K.ArrowUp ? 'AXLE STALL' : '50-50 STALL';
    say(name, .5);
    if (T - C.stallAt > .3 && (push || K.ArrowDown)) {
      C.vs = -Math.sign(C.u) * .12; C.u -= Math.sign(C.u) * .015;
      const combo = SK.combo ||= { names: [], pts: 0, t: T }; combo.names.push(name); combo.pts += 150; combo.t = T; C.stallAt = null;
    }
  } else C.stallAt = null;
  C.u += C.vs * dt; C.axis += C.va * dt;
  const coping = Math.abs(C.u) > p.limit;
  if (coping) C.u = Math.sign(C.u) * p.limit;
  skateTransitionPlace(C);
  if (coping || Math.abs(C.axis) > C.o.hw) skateTransitionRelease(C, coping);
  if (SK.combo && !SK.transition && !skateAir() && T - SK.combo.t > SK_COMBO_GAP) bankCombo();
  return true;
}
function skateTransitionPop(trick, gesture) {
  const C = SK.transition, n = SKB.surf.n, v = SKB.v.slice();
  skateTransitionRelease(C);
  const pop = POP_V * (gesture?.strength ?? 1) / 10;
  const velocity = v.map((x, i) => x + n[i] * pop);
  SK.v = Math.hypot(velocity[0], velocity[1]); SK.dir = Math.atan2(velocity[1], velocity[0]); body.vz = velocity[2] * 10;
  const [name, flip, turn] = TRICKS[trick ?? arrowTrick()] || ['ollie', 0, 0];
  body.trick = skateTrick(name, flip, turn, skateAirTime(body.vz), !!gesture?.nollie);
  SK.charge = -1; SK.spin = 0; SK.popT = T;
  if (actx) sfxUse('ollie');
}
