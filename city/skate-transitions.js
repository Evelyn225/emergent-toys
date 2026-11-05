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
  const v=skateContactVelocity(hit.n);
  SK.transition = { o, u, axis, vs: v.reduce((sum,x,i)=>sum+x*tangent[i],0),
    va: -v[0]*o.s+v[1]*o.c };
  SK.airRoute=null;skateManualEnd(); body.trick = null; body.vz = 0;
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
const skateAirOutHeld=()=>!!(K.KeyC||SK_INPUT.airOut);
function skateTransitionLipVelocity(C,out) {
  const o=C.o,v=SKB.v;
  let tangent=o.bowl?[-Math.sin(C.axis),Math.cos(C.axis),0]:[-o.s,o.c,0];
  if(o.pool){const tv=skatePoolFrame(o,o.profile.limit,C.axis).tv,len=Math.hypot(...tv);tangent=tv.map(x=>x/len);}
  const sign=o.bowl?1:Math.sign(C.u)||1,outward=[tangent[1]*sign,-tangent[0]*sign,0];
  const along=v.reduce((sum,x,i)=>sum+x*tangent[i],0),across=Math.sqrt(Math.max(0,v.reduce((sum,x)=>sum+x*x,0)-along*along));
  // Deliberate exits trade part of the vertical air for outward carry; they
  // do not add speed. Ordinary coping airs point up along the coping.
  const exit=out?across*.4:0,up=Math.sqrt(Math.max(0,across*across-exit*exit));
  return [tangent[0]*along+outward[0]*exit,tangent[1]*along+outward[1]*exit,up];
}
// Return airs follow the inside of curved coping instead of drifting across
// its tangent onto the deck. Only the boundary is assisted; inward travel and
// height remain free. The same map predicts the landing plane for catches.
function skateAirRoutePoint(x,y) {
  const route=SK.airRoute,o=route?.o;
  if(!o?.bowl||route.out)return [x,y];
  const dx=rel(x-o.x),dy=rel(y-o.y),axis=Math.atan2(dy,dx),radius=Math.hypot(dx,dy);
  const lip=o.pool?skatePoolFloor(o,axis)+o.profile.tip-o.profile.flat/2:o.profile.tip;
  const inside=Math.max(.01,lip-.015);
  return radius>inside?[worldCoord(o.x+dx*inside/radius),worldCoord(o.y+dy*inside/radius)]:[x,y];
}
function skateTransitionAirStep() {
  if(!skateAir()||!SK.airRoute||SK.airRoute.out)return;
  const [x,y]=skateAirRoutePoint(px,py);
  if(Math.hypot(rel(x-px),rel(y-py))<1e-10)return;
  px=x;py=y;
  const o=SK.airRoute.o,axis=Math.atan2(rel(py-o.y),rel(px-o.x));
  let tangent=[-Math.sin(axis),Math.cos(axis)];
  if(o.pool){const tv=skatePoolFrame(o,o.profile.limit,axis).tv,len=Math.hypot(tv[0],tv[1]);tangent=[tv[0]/len,tv[1]/len];}
  const vx=Math.cos(SK.dir)*SK.v,vy=Math.sin(SK.dir)*SK.v,outward=[tangent[1],-tangent[0]],out=vx*outward[0]+vy*outward[1];
  if(out>0){const v=[vx-outward[0]*out,vy-outward[1]*out];SK.v=Math.hypot(...v);if(SK.v>1e-9)SK.dir=Math.atan2(v[1],v[0]);}
}
function skateTransitionRelease(C, coping = false) {
  const out=skateAirOutHeld(),v=coping?skateTransitionLipVelocity(C,out):SKB.v.slice();
  skateAirBegin(C.o);SK.airRoute={o:C.o,out};
  SK.transition = null; SK.leftTransition = C.o; SK.leftTransitionT = T;
  SK.v = Math.hypot(v[0], v[1]); if (SK.v > 1e-7) SK.dir = Math.atan2(v[1], v[0]);
  body.vz = v[2] * 10; body.z = Math.max(.002, body.z);
  SKB.v = v; SKB.contact = 'air'; SK.popT = T;
  if(C.o.bowl&&!out){
    const z=SKB.p[2];skateTransitionAirStep();
    SKB.p=[px,py,z];SKB.v=[Math.cos(SK.dir)*SK.v,Math.sin(SK.dir)*SK.v,v[2]];
    body.ground=skateGround(px,py);body.groundMode=mode;body.z=Math.max(.002,(z-body.ground)*10);
  }
  SK.lipPop=coping?{t:T,source:C.o,n:SKB.surf.n.slice(),out,contact:{o:C.o,u:C.u,axis:C.axis}}:null;
}
function skateTransitionKick(C,dt,push) {
  const at=skateProfilePoint(C.o.profile,C.u),speed=C.velocity?Math.hypot(...C.velocity):Math.hypot(C.vs,C.va);
  skatePushFromRest(push,speed);SK.kicking=false;
  if(!skatePushReady(push,speed)||at.theta>.25||SK.charge>=0||skateGestureLoaded()){SK.kick=0;return;}
  const before=SK.kick;SK.kick+=dt/.7;SK.kicking=true;
  if(before<.15&&SK.kick>=.15){
    const facing=skatePushYaw(),n=SKB.surf?.n||[0,0,1];
    const v=skateTangentVelocity([Math.cos(facing),Math.sin(facing),0],n),burst=SK_PHYS.pushBurst*(1-speed/SK_PHYS.pushCap);
    if(C.velocity)C.velocity=C.velocity.map((x,i)=>x+v[i]*burst);
    else if(C.o.bowl){C.vs+=(v[0]*Math.cos(C.axis)*at.tx+v[1]*Math.sin(C.axis)*at.tx+v[2]*at.tz)*burst;C.va+=(-v[0]*Math.sin(C.axis)+v[1]*Math.cos(C.axis))*burst;}
    else{C.vs+=(v[0]*C.o.c*at.tx+v[1]*C.o.s*at.tx+v[2]*at.tz)*burst;C.va+=(-v[0]*C.o.s+v[1]*C.o.c)*burst;}
    if(actx)sfxSkate('push');
  }
  if(SK.kick>=1)SK.kick-=1;
}
function stepSkateTransition(dt, push, brake, steer) {
  if(SK.pivot)return false;
  const flatReverse=SK.reversing||brake&&(K.KeyS||SK_INPUT.back)&&SK.v<.02&&Math.abs(steer)<.35;
  if(SK.transition&&flatReverse&&skateProfilePoint(SK.transition.o.profile,SK.transition.u).theta<.1){SK.transition=null;body.z=body.vz=0;return false;}
  if (mode !== 'walk') { SK.transition = null; return false; }
  let C = SK.transition;
  if (!C) {
    let hit = skateTransitionAt(px, py, skateGround(px, py) + body.z / 10);
    if(hit&&flatReverse&&hit.at.theta<.1)return false;
    let drop = false;
    if (!hit && push && SK.v < .1 && !skateAir()) for (const o of SK_TRANSITIONS) {
      const dx = rel(px - o.x), dy = rel(py - o.y), x = dx * o.c + dy * o.s, axis = -dx * o.s + dy * o.c;
      if(o.pool){
        const h=skatePoolSample(o,px,py);
        if(!h||h.local<o.profile.tip||Math.cos(a-h.axis)>-.2)continue;
        const u=o.profile.limit-.01,frame=skatePoolFrame(o,u,h.axis);
        hit={o,u,axis:h.axis,at:frame.at,n:frame.n};drop=true;break;
      }
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
      if (body.vz > 0 || feet - surface > .006 || feet < surface - .015) return false;
      if (SK.leftTransition === hit.o && T - SK.leftTransitionT < .12) return false;
      skateAirPose();
      const quality = skateLandingQuality({ ...skateBoardAxes(SKB.yaw, SKB.pitch, SKB.roll), normal: hit.n,
        velocity: SKB.v, catchLead: body.trick&&(body.trick.flip||body.trick.turn) ? body.trick.t - (body.trick.caughtAt ?? Infinity) : Infinity, grab: !!body.trick?.grab });
      if (quality === 'bail') { skateBail('BAIL! Missed the transition.'); return true; }
      if (quality === 'sloppy') SK.v *= .7;
    }
    enterSkateTransition(hit); C = SK.transition;
    if (drop) { C.vs = -Math.sign(C.u) * .1; if(C.o.pool){const f=skatePoolFrame(C.o,C.u,C.axis);C.velocity=f.tu.map(v=>-.1*v);} }
  }
  skateTransitionKick(C,dt,push);
  if (C.o.bowl) return stepSkateBowl(C, dt, push, brake, steer);
  const at = skateProfilePoint(C.o.profile, C.u), p = C.o.profile;
  const direction = Math.sign(C.vs) || -Math.sign(C.u) || 1;
  C.vs += (-.98 * at.tz - (brake ? SK_PHYS.brake : SK_PHYS.concrete * .98) * direction) * dt;
  // Pumping adds a small amount of work through the bottom of each turn;
  // ordinary pushes retain the same cadence and taper as flat riding.
  if (push && !skateGestureLoaded() && SK.charge < 0) {
    C.vs += direction * .06 * Math.sin(at.theta * 2) * dt;
  }
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
const SK_LIP_GRACE=.12;
function skateCanLipPop(){return skateAir()&&!!SK.lipPop&&T>=SK.lipPop.t&&T-SK.lipPop.t<=SK_LIP_GRACE&&!body.trick&&!SK.grind&&!SK.bail;}
function skateTransitionPopStrength(gesture){
  const load=SK.charge>=0?clamp((T-SK.charge)/SK_CHARGE,0,1):0;
  return gesture?.strength??1+(3.4/POP_V-1)*load;
}
function skateFinishTransitionPop(trick,gesture,velocity){
  SK.lipPop=null;SK.v=Math.hypot(velocity[0],velocity[1]);if(SK.v>1e-9)SK.dir=Math.atan2(velocity[1],velocity[0]);body.vz=velocity[2]*10;SKB.v=velocity;
  const [name,flip,turn]=TRICKS[trick??arrowTrick()]||['ollie',0,0];
  body.trick=skateTrick(name,flip,turn,skateAirTime(body.vz),!!gesture?.nollie);
  SK.preWind=clamp((K.KeyD?1:0)-(K.KeyA?1:0)+(SK_INPUT.steerTarget??SK_INPUT.steer),-1,1);
  SK.charge=-1;SK.spin=0;SK.popT=T;controllerRumble('pop');if(actx)sfxUse('ollie');return true;
}
function skateLipPop(trick,gesture){
  if(!skateCanLipPop())return false;
  const lip=SK.lipPop,out=lip.out||skateAirOutHeld(),n=out?[0,0,1]:lip.n,pop=POP_V*skateTransitionPopStrength(gesture)/10;
  let v=[Math.cos(SK.dir)*SK.v,Math.sin(SK.dir)*SK.v,body.vz/10];
  if(out&&!lip.out&&v[2]>0){SKB.v=v;v=skateTransitionLipVelocity(lip.contact,true);}
  const spinV=SK.airSpinV;skateAirBegin(lip.source);SK.airSpinV=spinV;SK.airRoute={o:lip.source,out};
  return skateFinishTransitionPop(trick,gesture,v.map((x,i)=>x+n[i]*pop));
}
function skateTransitionPop(trick,gesture){
  const C=SK.transition,out=skateAirOutHeld(),n=out?[0,0,1]:SKB.surf.n;
  const at=skateProfilePoint(C.o.profile,C.u),v=out&&at.theta>.7?skateTransitionLipVelocity(C,true):SKB.v.slice();
  const pop=POP_V*skateTransitionPopStrength(gesture)/10;
  skateTransitionRelease(C);
  return skateFinishTransitionPop(trick,gesture,v.map((x,i)=>x+n[i]*pop));
}
