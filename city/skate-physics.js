// Skating uses cells and seconds throughout. The legacy body height is metres;
// skateBoardSync is the only conversion boundary for that height.
const SKB = { p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0, roll: 0,
  riderYaw: 0, contact: 'ground', surf: null, stance: 1, fakie: false };
const SK_PHYS = { gravity: .98, pushCap: 1.2, pushBurst: .28, reverseCap: .45, reverseAccel: .3, drag: .04, brake: .25, slide: .75, concrete: .012, asphalt: .018 };
const skateSurfaceCells = new Map();
let skateSurfaceCount = -1;
function skateSurfaceReset() { skateSurfaceCells.clear(); skateSurfaceCount = -1; }
function skateSurface(x, y, zHint) {
  const h = skateGround(x, y), e = .02;
  const xp=skateGround(worldCoord(x+e),y),xm=skateGround(worldCoord(x-e),y);
  const yp=skateGround(x,worldCoord(y+e)),ym=skateGround(x,worldCoord(y-e));
  // A kerb/ledge is a step, not a steep bank across the finite-difference
  // sample. Continuous park ramps provide their own exact normals below.
  let gx=Math.abs(xp+xm-2*h)>.004?0:(xp-xm)/(2*e);
  let gy=Math.abs(yp+ym-2*h)>.004?0:(yp-ym)/(2*e);
  let ref = null, kind = mode === 'roof' ? 'roof' : 'street', material = mode === 'roof' ? 'concrete' : typeof ROAD !== 'undefined' && !ROAD[idx(Math.floor(x),Math.floor(y))] ? 'grass' : 'asphalt';
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
      if(o.pool){const q=skatePoolSample(o,x,y);if(q&&Math.abs(q.h-h)<.001)return {h,n:q.n,kind:'transition',material:'concrete',ref:o};continue;}
      const qx = rel(x - o.x), qy = rel(y - o.y), u = o.bowl ? Math.hypot(qx,qy) : qx * o.c + qy * o.s;
      if (Math.abs(u) > o.hl || Math.abs(-qx * o.s + qy * o.c) > o.hw) continue;
      const top = o.profile ? skateProfileHeight(o, u) : o.ramp ? rampHeight(o, u) : o.z1;
      if (Math.abs(top - h) > .001) continue; // a higher city surface owns contact
      ref = o; kind = o.ramp || o.kind; material = o.material || 'concrete';
      if (o.profile) { const at = skateProfilePoint(o.profile, skateProfileU(o.profile, u, (zHint || h) - o.z0)); return { h, n: [-(o.bowl ? qx / (u || 1) : o.c) * at.tz, -(o.bowl ? qy / (u || 1) : o.s) * at.tz, at.tx], kind: 'transition', material: 'concrete', ref: o }; }
      const slope = !o.ramp ? 0 : o.ramp === 'kicker' ? o.z1 / (2 * o.hl)
        : Math.abs(u) < o.hl - o.run ? 0 : -Math.sign(u) * o.z1 / o.run;
      gx = slope * o.c; gy = slope * o.s;
    }
    if (!ref && typeof inSkatepark === 'function' && (inSkatepark(x, y) || typeof inSkateSpotPatch === 'function' && inSkateSpotPatch(x,y))) material = 'concrete';
  }
  // Generic terrain has no vertical rideable faces. A stair corner can put
  // the two samples on different decks and otherwise imply a huge launch
  // speed. Real steep transitions have already returned analytic normals.
  if(!ref&&Math.hypot(gx,gy)>1){gx=0;gy=0;}
  const len = Math.hypot(gx, gy, 1);
  return { h, n: [-gx / len, -gy / len, 1 / len], kind, material, ref };
}
// Bend an existing velocity onto a new riding plane without manufacturing
// kinetic energy. Reconstructing vz from unchanged horizontal speed did that.
function skateTangentVelocity(v,n) {
  const speed=Math.hypot(...v),z=-(v[0]*n[0]+v[1]*n[1])/Math.max(.001,n[2]);
  const tangent=[v[0],v[1],z],length=Math.hypot(...tangent);
  return length>1e-9?tangent.map(x=>x*speed/length):[0,0,0];
}
function skateContactVelocity(n) {
  const v=[Math.cos(SK.dir)*SK.v,Math.sin(SK.dir)*SK.v,skateAir()?body.vz/10:SKB.surf?SKB.v[2]:0];
  if(!skateAir())return skateTangentVelocity(v,n);
  const dot=v.reduce((sum,x,i)=>sum+x*n[i],0);
  return v.map((x,i)=>x-dot*n[i]);
}
// Nearest parallel board heading preserves a rollback as fakie. Camera look
// chooses the travel direction only when starting a push from rest.
function skateFaceTravel() {
  if(SK.v>.005)a+=mod(SK.dir-a+Math.PI/2,Math.PI)-Math.PI/2;
  return Math.cos(SK.dir-a)<0;
}
function skatePushFromRest(push,speed) {
  if(!push){SK.pushFakie=null;return;}
  if(speed>=.025||SK.pushFakie!=null)return;
  const facing=typeof third!=='undefined'&&third&&Number.isFinite(SK.camYaw)?SK.camYaw:a+(SK.look||0);
  SK.dir=facing;a+=mod(facing-a+Math.PI/2,Math.PI)-Math.PI/2;
  SK.pushFakie=Math.cos(facing-a)<0;
}
const skateRideYaw=()=>a+(SK.slide||0)*Math.PI/2;
function skateBoardSync() {
  SKB.p = [px, py, skateGround(px, py) + body.z / 10];
  SKB.riderYaw = a; SKB.stance = SK.stance;
  if (!skateAir() && !SK.transition && !SK.grind) SKB.yaw = skateRideYaw();
  SKB.contact = SK.bail > 0 ? 'bail' : SK.grind ? 'grind' : SK.transition ? 'transition' : skateAir() ? 'air' : SK.manual ? 'manual' : 'ground';
  if (SKB.contact === 'grind' && SK.grind.exitVelocity) SKB.v = SK.grind.exitVelocity.slice();
  else if (SKB.contact !== 'ground' && SKB.contact !== 'manual' && SKB.contact !== 'transition') SKB.v = [Math.cos(SK.dir) * SK.v, Math.sin(SK.dir) * SK.v, body.vz / 10];
}
function skateGroundVelocity(dt, push, brake, steer, reverse = false) {
  const previous=SKB.surf,surf = SKB.surf = skateSurface(px, py), n = surf.n;
  // External teleports, mounting and the compatibility release may still write
  // SK.v/SK.dir. Import those only when they differ from the last derived state.
  const hv = Math.hypot(SKB.v[0], SKB.v[1]);
  if (Math.abs(hv - SK.v) > 1e-6 || (hv > 1e-6 && Math.abs(Math.atan2(SKB.v[1], SKB.v[0]) - SK.dir) > 1e-6)) {
    SKB.v[0] = Math.cos(SK.dir) * SK.v; SKB.v[1] = Math.sin(SK.dir) * SK.v;
  }
  if(previous)SKB.v=skateTangentVelocity(SKB.v,n);
  let vx = SKB.v[0], vy = SKB.v[1];
  // The board remains tangent: gravity projected into that plane acts even at
  // zero speed, so reaching a stall never traps you halfway up a hill.
  vx += SK_PHYS.gravity * n[2] * n[0] * dt;
  vy += SK_PHYS.gravity * n[2] * n[1] * dt;
  let speed = Math.hypot(vx, vy);
  skatePushFromRest(push,speed);
  SK.kicking = false;
  SK.mongo = !!(K.ShiftLeft || K.ShiftRight || SK_INPUT.mongo);
  if (push && SK.charge < 0 && !skateGestureLoaded() && speed < SK_PHYS.pushCap) {
    const before = SK.kick; SK.kick += dt / .7; SK.kicking = true;
    if (before < .15 && SK.kick >= .15) {
      const burst = SK_PHYS.pushBurst * Math.max(0, 1 - speed / SK_PHYS.pushCap);
      const facing=a+(SK.pushFakie?Math.PI:0);
      vx += Math.cos(facing) * burst; vy += Math.sin(facing) * burst;
      if (actx) sfxSkate('push');
    }
    if (SK.kick >= 1) SK.kick -= 1;
  } else SK.kick = 0;
  speed = Math.hypot(vx, vy);
  const turn = steer * (2.6 - 1.43 * Math.min(1, speed / SK_PHYS.pushCap)) * dt;
  const beforeTurn=Math.hypot(vx,vy,-(vx*n[0]+vy*n[1])/Math.max(.001,n[2]));
  a += turn;
  const c = Math.cos(turn), s = Math.sin(turn), tx = vx * c - vy * s;
  vy = vx * s + vy * c; vx = tx;
  if(Math.hypot(vx,vy)>1e-9){const scale=beforeTurn/Math.hypot(vx,vy,-(vx*n[0]+vy*n[1])/Math.max(.001,n[2]));vx*=scale;vy*=scale;}
  speed=Math.hypot(vx,vy);
  // Require deliberate braking + steering; hysteresis avoids stick chatter.
  const sliding = brake && Math.abs(steer) > (SK.sliding ? .25 : .45) && speed > .12;
  SK.sliding=sliding;
  const slideTarget=sliding?Math.sign(steer):0;
  SK.slide=(SK.slide||0)+(slideTarget-(SK.slide||0))*(1-Math.exp(-12*dt));
  if (sliding && SK.combo && !SK.reverted && T - (SK.landedAt ?? -9) < .25) {
    SK.combo.names.push('REVERT'); SK.combo.pts += 75; SK.combo.t = T; SK.reverted = true;
  }
  // Holding back must first finish braking. Once stopped, it becomes a
  // modest backwards push; the board heading and stance stay unchanged.
  const reversing=reverse&&!push&&Math.abs(steer)<.1&&(SK.reversing||speed<.015);
  SK.reversing=reversing;
  if (brake && !reversing && !sliding && speed > .01 && (SK.dragT -= dt) <= 0) {
    SK.dragT = .12; if (actx) sfxSkate('drag', Math.min(1, speed / SK_TOP));
  }
  const mu = surf.material === 'concrete' ? SK_PHYS.concrete : surf.material === 'grass' ? .06 : SK_PHYS.asphalt;
  const loss = ((brake&&!reversing ? sliding ? SK_PHYS.slide : SK_PHYS.brake : mu * SK_PHYS.gravity)
    + SK_PHYS.drag * speed * speed) * dt + speed * Math.abs(turn) * .025;
  const keep = speed > 0 ? Math.max(0, speed - loss) / speed : 0;
  vx *= keep; vy *= keep;
  if(reversing){
    const backward=Math.max(0,-vx*Math.cos(a)-vy*Math.sin(a));
    const impulse=SK_PHYS.reverseAccel*dt*Math.max(0,1-backward/SK_PHYS.reverseCap);
    vx-=Math.cos(a)*impulse;vy-=Math.sin(a)*impulse;
  }
  // Limit extreme downhill runs, never ordinary slope acceleration.
  const tangentZ=-(vx*n[0]+vy*n[1])/Math.max(.001,n[2]);
  const cap = Math.min(1, 1.4 / (Math.hypot(vx, vy,tangentZ) || 1)); vx *= cap; vy *= cap;
  const vz = -(vx * n[0] + vy * n[1]) / Math.max(.05, n[2]);
  SKB.v = [vx, vy, vz]; SK.v = Math.hypot(vx, vy);
  if (SK.v > 1e-7) SK.dir = Math.atan2(vy, vx);
  SKB.fakie = Math.cos(SK.dir - a) < 0;
  const yaw=skateRideYaw();
  SKB.pitch=Math.atan2(-(n[0]*Math.cos(yaw)+n[1]*Math.sin(yaw)),Math.max(.001,n[2]));
  const neutral=skateBoardAxes(yaw,SKB.pitch,0).up,right=[-Math.sin(yaw),Math.cos(yaw),0];
  const dot=v=>n.reduce((sum,k,i)=>sum+k*v[i],0);
  SKB.roll=Math.atan2(dot(right),dot(neutral))-steer*Math.min(.18,SK.v*.2);
  if (sliding && actx && T > SK.scrapeT) { SK.scrapeT = T + .15; sfxSkate('scrape', .5); }
}
function skateSurfaceExit(x0, y0, dt) {
  if (skateAir() || !SKB.surf || SK.v < .01) return;
  const expected = SKB.surf.h + SKB.v[2] * dt, ground = skateGround(px, py);
  if (expected - ground > .008) {
    skateAirBegin(SKB.surf.ref);
    body.z = Math.max(.001, (expected - ground) * 10);
    body.vz = SKB.v[2] * 10;
    body.ground = ground; body.groundMode = mode;
    SK.popT = T;
  }
}
