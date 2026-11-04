// Board rotation and catch live independently of the rider's yaw. Radians and
// cell velocities; the legacy body still integrates vertical metres this release.
function skateTrick(name, flip, turn, air, nollie = false) {
  return { name, flip, turn, air, t: 0, nollie, duration: flip || turn ? (Math.abs(turn) >= 1 ? .46 : .38) : .08,
    pitch: SKB.pitch, baseRoll: Math.atan2(Math.sin(SKB.roll),Math.cos(SKB.roll)), caughtAt: flip||turn?null:0, grab: null, grabTime: 0, grabPoints: 0 };
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
function skateTrickAxes(yaw,pitch,bank,flip,shuv) {
  const base=skateBoardAxes(yaw,pitch,bank),f=base.axis,u=base.up;
  const r=[u[1]*f[2]-u[2]*f[1],u[2]*f[0]-u[0]*f[2],u[0]*f[1]-u[1]*f[0]];
  const c=Math.cos(shuv),s=Math.sin(shuv);
  const axis=f.map((v,i)=>v*c+r[i]*s),right=r.map((v,i)=>v*c-f[i]*s);
  return {axis,up:u.map((v,i)=>v*Math.cos(flip)+right[i]*Math.sin(flip))};
}
// Each flight owns its takeoff frame; grinds and old bowl runs cannot leak
// their orientation into a later kerb hop. Preserve the pop, then prepare for
// the surface below the predicted touchdown without changing trick rotation.
function skateAirBegin(source = null) {
  const up=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;
  SK.airPose={t:T,pitch:SKB.pitch,roll:SKB.roll,normal:up.slice()};
  SK.airNormal=up.slice();SK.airSource=source;
}
function skateAirBase(dt,pitch,roll) {
  const pose=SK.airPose;
  if(!pose)return {pitch,roll};
  const height=Math.max(0,body.z/10),vz=body.vz/10;
  const flight=clamp((vz+Math.sqrt(vz*vz+2*.98*height))/.98,0,1.2);
  const x=worldCoord(px+Math.cos(SK.dir)*SK.v*flight),y=worldCoord(py+Math.sin(SK.dir)*SK.v*flight);
  const surface=skateSurface(x,y),hit=skateTransitionAt(x,y,surface.h);
  const target=hit&&Math.abs(hit.o.z0+hit.at.z-surface.h)<.025?hit.n:surface.n,ease=1-Math.exp(-14*dt);
  pose.normal=pose.normal.map((v,i)=>v+(target[i]-v)*ease);
  const length=Math.hypot(...pose.normal)||1,n=pose.normal.map(v=>v/length);
  const blend=clamp((T-pose.t-.10)/.32,0,1),smooth=blend*blend*(3-2*blend);
  // With no requested body spin, catch toward travel in the landing plane.
  // Choose the nearer forward/switch axis so a vert return does not turn 180.
  if(Math.abs(SK.spin||0)<.05&&!K.KeyA&&!K.KeyD&&!SK_INPUT.steer){
    const v=[Math.cos(SK.dir)*SK.v,Math.sin(SK.dir)*SK.v,body.vz/10];
    const vn=v.reduce((sum,k,i)=>sum+k*n[i],0),travel=v.map((k,i)=>k-vn*n[i]);
    if(Math.hypot(travel[0],travel[1])>1e-4){
      const delta=mod(Math.atan2(travel[1],travel[0])-a+Math.PI/2,Math.PI)-Math.PI/2;
      a+=delta*ease*smooth;
    }
  }
  const wantPitch=Math.atan2(-(n[0]*Math.cos(a)+n[1]*Math.sin(a)),Math.max(.001,n[2]));
  const neutral=skateBoardAxes(a,wantPitch,0).up,right=[-Math.sin(a),Math.cos(a),0];
  const dot=(v,w)=>v.reduce((s,k,i)=>s+k*w[i],0);
  const wantRoll=Math.atan2(dot(n,right),dot(n,neutral));
  const angle=(from,to)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*smooth;
  const base={pitch:angle(pitch,wantPitch),roll:angle(roll,wantRoll)};
  SK.airNormal=skateBoardAxes(a,base.pitch,base.roll).up;
  return base;
}
function skateAirPose(dt = 0) {
  const tr = body.trick;
  SKB.riderYaw = a;
  if (!tr) { const base=skateAirBase(dt,SK.airPose?.pitch??SKB.pitch,SK.airPose?.roll??SKB.roll);SKB.yaw=SKB.riderYaw=a;SKB.pitch=base.pitch;SKB.roll=base.roll;return; }
  const duration = tr.duration ?? tr.air, p = clamp(tr.t / duration, 0, 1), e = p * p * (3 - 2 * p);
  const base=skateAirBase(dt,tr.pitch||0,tr.baseRoll||0);
  SKB.riderYaw=a;
  const popPitch=base.pitch+Math.sin(Math.min(1,p*4)*Math.PI)*.35*(tr.nollie?-1:1);
  const frame=skateTrickAxes(a,popPitch,base.roll,e*tr.flip*Math.PI*2,e*tr.turn*Math.PI*2);
  SKB.yaw=Math.atan2(frame.axis[1],frame.axis[0]);SKB.pitch=Math.asin(clamp(frame.axis[2],-1,1));
  const neutral=skateBoardAxes(SKB.yaw,SKB.pitch,0),rightAxis=[-Math.sin(SKB.yaw),Math.cos(SKB.yaw),0];
  const dot=(x,y)=>x.reduce((v,n,i)=>v+n*y[i],0);
  SKB.roll=Math.atan2(dot(frame.up,rightAxis),dot(frame.up,neutral.up));
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
