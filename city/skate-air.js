// Board rotation and catch live independently of the rider's yaw. Radians and
// cell velocities; the legacy body still integrates vertical metres this release.
function skateTrick(name, flip, turn, air, nollie = false) {
  return { name, flip, turn, air, t: 0, nollie, duration: flip || turn ? (Math.abs(turn) >= 1 ? .46 : .38) : .08,
    pitch: SKB.pitch, baseRoll: Math.atan2(Math.sin(SKB.roll),Math.cos(SKB.roll)), caughtAt: flip||turn?null:0, grab: null, grabTime: 0, grabPoints: 0 };
}
function skateTrickName(tr){return tr?.nollie?(tr.name==='ollie'?'nollie':'nollie '+tr.name):tr?.name||'ollie';}
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
  SK.airRoute=null;SK.pivot=null;SK.lipPop=null;SK.lateTrick=null;SK.airArrow=null;SK.trickKeyT=-1;SK.spin=0;SK.airSpinV=0;SK.preWind=0;
  const up=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;
  SK.airPose={t:T,yaw:SKB.yaw,bodyYaw:a,pitch:SKB.pitch,roll:SKB.roll,normal:up.slice()};
  SK.airNormal=up.slice();SK.airForward=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).axis;SK.airSource=source;
}
// Ease angular speed, never the angle: releasing can leave any partial turn.
function skateAirSpinStep(dt,steer){
  const target=steer*SK_SPIN+(SK.preWind||0)*2*Math.max(0,1-(T-SK.popT)/.5);
  SK.airSpinV=(SK.airSpinV||0)+(target-(SK.airSpinV||0))*(1-Math.exp(-dt/.045));
  const turn=SK.airSpinV*dt;a+=turn;SK.spin+=turn;
}
function skateApplyAirFrame(frame){
  SKB.yaw=Math.atan2(frame.axis[1],frame.axis[0]);SKB.pitch=Math.asin(clamp(frame.axis[2],-1,1));
  const neutral=skateBoardAxes(SKB.yaw,SKB.pitch,0).up,right=[-Math.sin(SKB.yaw),Math.cos(SKB.yaw),0];
  const dot=v=>frame.up.reduce((sum,x,i)=>sum+x*v[i],0);
  SKB.roll=Math.atan2(dot(right),dot(neutral));
}
function skateAirBase(dt,pitch,roll) {
  const pose=SK.airPose;
  if(!pose)return {yaw:a-(SK.spin||0),pitch,roll};
  if(pose.yaw==null){pose.yaw=a-(SK.spin||0);pose.bodyYaw=pose.yaw;}
  let yaw=pose.yaw+a-(SK.spin||0)-pose.bodyYaw;
  pitch=pose.pitch??pitch;roll=pose.roll??roll;
  const height=Math.max(0,body.z/10),vz=body.vz/10;
  const flight=clamp((vz+Math.sqrt(vz*vz+2*.98*height))/.98,0,1.2);
  const [x,y]=skateAirRoutePoint(worldCoord(px+Math.cos(SK.dir)*SK.v*flight),worldCoord(py+Math.sin(SK.dir)*SK.v*flight));
  let surface=skateSurface(x,y),hit=skateTransitionAt(x,y,surface.h);
  if(SK.airRoute&&!SK.airRoute.out){
    // A steep wall can meet the descending board well before a flat-ground
    // flight-time estimate. Predict the first contact on the assisted path.
    if(!pose.landNormal||T-(pose.landT||0)>.05){
      const origin=skateGround(px,py)+height,horizon=clamp((vz+Math.sqrt(vz*vz+2*.98*(height+.5)))/.98,.1,2.5);
      const sample=t=>{const [qx,qy]=skateAirRoutePoint(worldCoord(px+Math.cos(SK.dir)*SK.v*t),worldCoord(py+Math.sin(SK.dir)*SK.v*t));return {x:qx,y:qy,gap:origin+vz*t-.49*t*t-skateGround(qx,qy)};};
      let lo=0,point=null;
      for(let i=1;i<=12;i++){let hi=horizon*i/12;const q=sample(hi);if(q.gap<=0){for(let j=0;j<5;j++){const mid=(lo+hi)/2;if(sample(mid).gap>0)lo=mid;else hi=mid;}point=sample(hi);pose.landAt=T+hi;break;}lo=hi;}
      if(point){surface=skateSurface(point.x,point.y);hit=skateTransitionAt(point.x,point.y,surface.h);}
      pose.landNormal=(hit&&Math.abs(hit.o.z0+hit.at.z-surface.h)<.025?hit.n:surface.n).slice();pose.landT=T;
    }
    surface={...surface,n:pose.landNormal};hit=null;
  }
  const target=hit&&Math.abs(hit.o.z0+hit.at.z-surface.h)<.025?hit.n:surface.n,ease=1-Math.exp(-14*dt);
  pose.normal=pose.normal.map((v,i)=>v+(target[i]-v)*ease);
  const length=Math.hypot(...pose.normal)||1,n=pose.normal.map(v=>v/length);
  const blend=clamp((T-pose.t-.10)/.32,0,1),smooth=blend*blend*(3-2*blend);
  // Catch toward the forecast touchdown axis, choosing forward/fakie against
  // the takeoff heading. Chasing the current velocity through the apex could
  // accumulate an unsolicited half turn as that velocity reversed.
  const landingIn=Math.max(0,(pose.landAt??T+flight)-T);
  const v=[Math.cos(SK.dir)*SK.v,Math.sin(SK.dir)*SK.v,body.vz/10-.98*landingIn];
  const vn=v.reduce((sum,k,i)=>sum+k*n[i],0),travel=v.map((k,i)=>k-vn*n[i]);
  if(Math.hypot(travel[0],travel[1])>1e-4){
    const targetYaw=pose.yaw+mod(Math.atan2(travel[1],travel[0])-pose.yaw+Math.PI/2,Math.PI)-Math.PI/2;
    const carry=(targetYaw-yaw)*ease*smooth;a+=carry;yaw+=carry;
  }
  const wantPitch=Math.atan2(-(n[0]*Math.cos(yaw)+n[1]*Math.sin(yaw)),Math.max(.001,n[2]));
  const neutral=skateBoardAxes(yaw,wantPitch,0).up,right=[-Math.sin(yaw),Math.cos(yaw),0];
  const dot=(v,w)=>v.reduce((s,k,i)=>s+k*w[i],0);
  const wantRoll=Math.atan2(dot(n,right),dot(n,neutral));
  const angle=(from,to)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*smooth;
  const base={yaw,pitch:angle(pitch,wantPitch),roll:angle(roll,wantRoll)};
  SK.airNormal=skateBoardAxes(yaw,base.pitch,base.roll).up;
  return base;
}
function skateAirPose(dt = 0) {
  const tr = body.trick;
  const base=skateAirBase(dt,SK.airPose?.pitch??SKB.pitch,SK.airPose?.roll??SKB.roll);
  const rider=skateTrickAxes(base.yaw,base.pitch,base.roll,0,SK.spin||0);
  SK.airForward=rider.axis;SK.airNormal=rider.up;SKB.riderYaw=a;
  if(!tr){skateApplyAirFrame(rider);return;}
  const duration=tr.duration??tr.air,p=clamp(tr.t/duration,0,1),e=p*p*(3-2*p);
  const popPitch=base.pitch+Math.sin(Math.min(1,p*4)*Math.PI)*.35*(tr.nollie?-1:1);
  const frame=skateTrickAxes(base.yaw,popPitch,base.roll,e*tr.flip*Math.PI*2,(SK.spin||0)+e*tr.turn*Math.PI*2);
  skateApplyAirFrame(frame);
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
  let depth = SK_INPUT.mouseHeld?(SK.manual?.mouseDepth??SK_INPUT.mouse[1]):(SK_INPUT.manualDepth??skateBalanceStick()[1]);
  const depthHeld=SK.manual?Math.abs(depth)>.1&&Math.abs(depth)<.9&&(depth<0)===SK.manual.nose:Math.abs(depth)>.18&&Math.abs(depth)<.55;
  const held = depthHeld && SK.v > .06;
  if (!held) { if (SK.manual) skateManualEnd(); return; }
  if (!SK.manual) {
    SK.manual={nose:depth<0,t0:T,bal:0,balV:0,mouseDepth:SK_INPUT.mouseHeld?Math.sign(depth)*.35:null};
    if(SK_INPUT.mouseHeld)depth=SK.manual.mouseDepth;
  }
  const m=SK.manual,offset=Math.abs(depth)-.35;
  // Mouse entry establishes a comfortable neutral point. A small quiet band
  // absorbs hand jitter without changing stick physics or the gesture stream.
  const pressure=SK_INPUT.mouseHeld?Math.sign(offset)*Math.max(0,Math.abs(offset)-.02):offset;
  const control=pressure*6*(m.nose?-1:1);
  m.balV += (m.bal * 1.1 + control + Math.sin((T - m.t0) * 2.7) * .12 - m.balV * 1.6) * dt;
  m.bal += (m.balV+control*.15) * dt;
  if (m.bal < -1) { SK.manual = null; return skateBail('BAIL! Over the nose.'); }
  if (m.bal > 1) return skateManualEnd(true);
  SKB.pitch += (m.nose ? -.15 : .15) + m.bal * .12;
  SKB.contact = 'manual';
}
