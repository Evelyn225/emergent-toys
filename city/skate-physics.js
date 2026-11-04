// Skating uses cells and seconds throughout. The legacy body height is metres;
// skateBoardSync is the only conversion boundary for that height.
const SKB = { p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
  riderYaw: 0, contact: 'ground', surf: null, stance: 1, fakie: false };
const SK_PHYS = { gravity: .98, pushCap: .6, pushBurst: .06, drag: .04, brake: .25, slide: .75, concrete: .012, asphalt: .018 };
const skateSurfaceCells = new Map();
let skateSurfaceCount = -1;
function skateSurfaceReset() { skateSurfaceCells.clear(); skateSurfaceCount = -1; }
function skateSurface(x, y, zHint) {
  const h = skateGround(x, y), e = .02;
  let gx = (skateGround(worldCoord(x + e), y) - skateGround(worldCoord(x - e), y)) / (2 * e);
  let gy = (skateGround(x, worldCoord(y + e)) - skateGround(x, worldCoord(y - e))) / (2 * e);
  let ref = null, kind = mode === 'roof' ? 'roof' : 'street', material = 'asphalt';
  if (mode !== 'roof' && typeof SKATE_FEATURES !== 'undefined') {
    if (skateSurfaceCount !== SKATE_FEATURES.length) {
      skateSurfaceCells.clear(); skateSurfaceCount = SKATE_FEATURES.length;
      for (const o of SKATE_FEATURES) {
        const ex = Math.abs(o.c) * o.hl + Math.abs(o.s) * o.hw;
        const ey = Math.abs(o.s) * o.hl + Math.abs(o.c) * o.hw;
        for (let ix = Math.floor(o.x - ex); ix <= Math.floor(o.x + ex); ix++)
          for (let iy = Math.floor(o.y - ey); iy <= Math.floor(o.y + ey); iy++) {
            const k = ix + ',' + iy, bucket = skateSurfaceCells.get(k) || [];
            bucket.push(o); skateSurfaceCells.set(k, bucket);
          }
      }
    }
    for (const o of skateSurfaceCells.get(Math.floor(x) + ',' + Math.floor(y)) || []) {
      const qx = rel(x - o.x), qy = rel(y - o.y), u = qx * o.c + qy * o.s;
      if (Math.abs(u) > o.hl || Math.abs(-qx * o.s + qy * o.c) > o.hw) continue;
      const top = o.ramp ? rampHeight(o, u) : o.z1;
      if (Math.abs(top - h) > .001) continue; // a higher city surface owns contact
      ref = o; kind = o.ramp || o.kind; material = o.material || 'concrete';
      const slope = !o.ramp ? 0 : o.ramp === 'kicker' ? o.z1 / (2 * o.hl)
        : Math.abs(u) < o.hl - o.run ? 0 : -Math.sign(u) * o.z1 / o.run;
      gx = slope * o.c; gy = slope * o.s;
    }
    if (!ref && typeof inSkatepark === 'function' && inSkatepark(x, y)) material = 'concrete';
  }
  const len = Math.hypot(gx, gy, 1);
  return { h, n: [-gx / len, -gy / len, 1 / len], kind, material, ref };
}
function skateBoardSync() {
  SKB.p = [px, py, skateGround(px, py) + body.z / 10];
  SKB.riderYaw = a; SKB.yaw = a; SKB.stance = SK.stance;
  SKB.contact = SK.bail > 0 ? 'bail' : SK.grind ? 'grind' : skateAir() ? 'air' : 'ground';
  if (SKB.contact !== 'ground') SKB.v = [Math.cos(SK.dir) * SK.v, Math.sin(SK.dir) * SK.v, body.vz / 10];
}
function skateGroundVelocity(dt, push, brake, steer) {
  const surf = SKB.surf = skateSurface(px, py), n = surf.n;
  // External teleports, mounting and the compatibility release may still write
  // SK.v/SK.dir. Import those only when they differ from the last derived state.
  const hv = Math.hypot(SKB.v[0], SKB.v[1]);
  if (Math.abs(hv - SK.v) > 1e-6 || (hv > 1e-6 && Math.abs(Math.atan2(SKB.v[1], SKB.v[0]) - SK.dir) > 1e-6)) {
    SKB.v[0] = Math.cos(SK.dir) * SK.v; SKB.v[1] = Math.sin(SK.dir) * SK.v;
  }
  let vx = SKB.v[0], vy = SKB.v[1];
  // The board remains tangent: gravity projected into that plane acts even at
  // zero speed, so reaching a stall never traps you halfway up a hill.
  vx += SK_PHYS.gravity * n[2] * n[0] * dt;
  vy += SK_PHYS.gravity * n[2] * n[1] * dt;
  let speed = Math.hypot(vx, vy);
  SK.kicking = false;
  SK.mongo = !!(K.ShiftLeft || K.ShiftRight || SK_INPUT.mongo);
  if (push && SK.charge < 0 && !skateGestureLoaded() && speed < SK_PHYS.pushCap) {
    const before = SK.kick; SK.kick += dt / .7; SK.kicking = true;
    if (before < .15 && SK.kick >= .15) {
      const burst = SK_PHYS.pushBurst * Math.max(0, 1 - speed / SK_PHYS.pushCap);
      vx += Math.cos(a) * burst; vy += Math.sin(a) * burst;
      if (actx) sfxSkate('push');
    }
    if (SK.kick >= 1) SK.kick -= 1;
  } else SK.kick = 0;
  speed = Math.hypot(vx, vy);
  const turn = steer * (2.6 - 1.43 * Math.min(1, speed / SK_PHYS.pushCap)) * dt;
  a += turn;
  const c = Math.cos(turn), s = Math.sin(turn), tx = vx * c - vy * s;
  vy = vx * s + vy * c; vx = tx;
  const sliding = brake && Math.abs(steer) > .1 && speed > .12;
  SK.slide = sliding ? steer : 0;
  if (brake && !sliding && speed > .01 && (SK.dragT -= dt) <= 0) {
    SK.dragT = .12; if (actx) sfxSkate('drag', Math.min(1, speed / SK_TOP));
  }
  const mu = surf.material === 'concrete' ? SK_PHYS.concrete : SK_PHYS.asphalt;
  const loss = ((brake ? sliding ? SK_PHYS.slide : SK_PHYS.brake : mu * SK_PHYS.gravity)
    + SK_PHYS.drag * speed * speed) * dt + speed * Math.abs(turn) * .025;
  const keep = speed > 0 ? Math.max(0, speed - loss) / speed : 0;
  vx *= keep; vy *= keep;
  // Limit extreme downhill runs, never ordinary slope acceleration.
  const cap = Math.min(1, 1.4 / (Math.hypot(vx, vy) || 1)); vx *= cap; vy *= cap;
  const vz = -(vx * n[0] + vy * n[1]) / Math.max(.05, n[2]);
  SKB.v = [vx, vy, vz]; SK.v = Math.hypot(vx, vy);
  if (SK.v > 1e-7) SK.dir = Math.atan2(vy, vx);
  SKB.fakie = Math.cos(SK.dir - a) < 0;
  SKB.pitch = Math.atan2(vz, SK.v || 1e-9) * (SKB.fakie ? -1 : 1);
  SKB.roll = -steer * Math.min(.18, SK.v * .2);
  if (sliding && actx && T > SK.scrapeT) { SK.scrapeT = T + .15; sfxSkate('scrape', .5); }
}
function skateSurfaceExit(x0, y0, dt) {
  if (skateAir() || !SKB.surf || SK.v < .01) return;
  const expected = SKB.surf.h + SKB.v[2] * dt, ground = skateGround(px, py);
  if (expected - ground > .008) {
    body.z = Math.max(.001, (expected - ground) * 10);
    body.vz = SKB.v[2] * 10;
    body.ground = ground; body.groundMode = mode;
    SK.popT = T;
  }
}
