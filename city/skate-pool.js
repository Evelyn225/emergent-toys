// A pool is a smooth polar outline with a quarter-pipe swept around it.
// The floor radius varies with angle: an oval for the practice pool, three
// unequal lobes for the big park. Rendering, contact and coping share this map.
function skatePoolFloor(o,t) {
  const q=o.pool,c=Math.cos(t),s=Math.sin(t);
  const oval=1/Math.sqrt(c*c/(q.rx*q.rx)+s*s/(q.ry*q.ry));
  return oval*(1+(q.curve||0)*(Math.sin(3*t)+.65*Math.cos(3*t)));
}
function skatePoolFrame(o,u,t) {
  const p=skateProfilePoint(o.profile,u),c=Math.cos(t),s=Math.sin(t);
  const f=skatePoolFloor(o,t),df=(skatePoolFloor(o,t+.0001)-skatePoolFloor(o,t-.0001))/.0002;
  const r=f+p.x-o.profile.flat/2;
  const tu=[c*p.tx,s*p.tx,p.tz],tv=[df*c-r*s,df*s+r*c,0];
  const n=[-tv[1]*p.tz,tv[0]*p.tz,r*p.tx],len=Math.hypot(...n);
  return {x:r*c,y:r*s,z:p.z,r,df,tu,tv,n:n.map(v=>v/len),at:p};
}
function skatePoolSample(o,x,y) {
  const qx=rel(x-o.x),qy=rel(y-o.y),t=Math.atan2(qy,qx),r=Math.hypot(qx,qy);
  const local=r-skatePoolFloor(o,t)+o.profile.flat/2,p=o.profile;
  if(local>p.tip+p.deck)return null;
  const u=skateProfileU(p,Math.max(0,Math.min(local,p.tip)));
  const frame=skatePoolFrame(o,u,t);
  return {o,u,axis:t,at:frame.at,n:local>p.tip?[0,0,1]:frame.n,
    h:o.z0+(local>p.tip?p.height:frame.z),local,frame};
}
function addSkatePool(x,y,options,pool) {
  const o=addSkateBowl(x,y,{...options,deferAccess:true});o.pool=pool;
  // Replace the circular coping with the actual pool outline before adding access.
  const edge=GRINDS.find(g=>g.feature===o&&g.points);
  edge.points=Array.from({length:97},(_,i)=>{const f=skatePoolFrame(o,o.profile.limit,i/96*Math.PI*2);return [x+f.x,y+f.y,o.z0+f.z+.003];});
  [edge.ax,edge.ay]=edge.points[0];[edge.bx,edge.by]=edge.points.at(-1);
  o.hl=o.hw=0;
  for(let i=0;i<192;i++){const t=i/192*Math.PI*2,f=skatePoolFrame(o,o.profile.limit,t),d=o.profile.deck;o.hl=Math.max(o.hl,Math.abs(f.x)+d);o.hw=Math.max(o.hw,Math.abs(f.y)+d);}
  o.poolMesh=buildSkatePoolMesh(o);
  if(typeof parks!=='undefined')addBowlAccess(o);
  return o;
}
function enterSkatePool(hit) {
  const [vx,vy,vz]=skateContactVelocity(hit.n);
  SK.transition={o:hit.o,u:hit.u,axis:hit.axis,velocity:[vx,vy,vz],vs:0,va:0,yawOff:Math.cos(a-SK.dir)<0?Math.PI:0};
  SK.airRoute=null;skateManualEnd();body.trick=null;body.vz=0;
}
function skatePoolPlace(C) {
  const f=skatePoolFrame(C.o,C.u,C.axis),n=f.n;
  px=worldCoord(C.o.x+f.x);py=worldCoord(C.o.y+f.y);
  SKB.v=C.velocity.slice();SK.v=Math.hypot(SKB.v[0],SKB.v[1]);
  if(SK.v>1e-7)SK.dir=Math.atan2(SKB.v[1],SKB.v[0]);
  C.yawOff=skateFaceTravel()?Math.PI:0;SKB.yaw=SKB.riderYaw=a;
  SKB.pitch=Math.atan2(SKB.v[2]*(C.yawOff?-1:1),SK.v||1e-9);
  const up=skateBoardAxes(a,SKB.pitch,0).up,right=[-Math.sin(a),Math.cos(a),0];
  const dot=(v,w)=>v.reduce((s,k,i)=>s+k*w[i],0);
  SKB.roll=Math.atan2(dot(n,right),dot(n,up));
  SKB.p=[px,py,C.o.z0+f.z];SKB.contact='transition';SKB.fakie=!!C.yawOff;
  SKB.surf={h:SKB.p[2],n,kind:'transition',material:'concrete',ref:C.o};
  body.ground=skateGround(px,py);body.groundMode=mode;
  body.z=Math.max(.001,(SKB.p[2]-body.ground)*10);body.vz=0;
}
function stepSkatePool(C,dt,push,brake,steer) {
  const p=C.o.profile,f=skatePoolFrame(C.o,C.u,C.axis),n=f.n;
  let v=C.velocity,speed=Math.hypot(...v);
  const turn=steer*1.5*dt,c=Math.cos(turn),s=Math.sin(turn);
  const cross=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]];
  v=v.map((k,i)=>k*c+cross[i]*s);
  // Pump through the lower wall, with the same modest work as a mini ramp.
  const gain=push ? .06*Math.sin(f.at.theta*2)*dt : 0;
  const target=Math.max(0,speed+gain-(brake ? SK_PHYS.brake : .98*SK_PHYS.concrete)*dt);
  if(speed>1e-8)v=v.map(k=>k*target/speed);
  speed=target;
  const nextV=v.map((k,i)=>k+(.98*n[2]*n[i]-(i===2 ? .98 : 0))*dt);
  const ct=Math.cos(C.axis),st=Math.sin(C.axis);
  const rate=(-st*nextV[0]+ct*nextV[1])/Math.max(.03,f.r);
  const du=(ct*nextV[0]+st*nextV[1]-f.df*rate)/Math.max(.1,f.at.tx);
  C.u+=du*dt;C.axis+=rate*dt;
  const coping=C.u>p.limit;C.u=clamp(C.u,p.flat/2-.01,p.limit);
  const next=skatePoolFrame(C.o,C.u,C.axis),dot=nextV.reduce((sum,k,i)=>sum+k*next.n[i],0);
  v=nextV.map((k,i)=>k-dot*next.n[i]);
  // Position-dependent gravity work avoids losing speed at every mesh/radius
  // change. The physical constraint is analytic, independent of tessellation.
  const energy=Math.max(0,speed*speed-2*.98*(next.z-f.z)),len=Math.hypot(...v);
  C.velocity=len>1e-9?v.map(k=>k*Math.sqrt(energy)/len):v;
  C.vs=du;C.va=rate*next.r;
  skatePoolPlace(C);
  if(coping)skateTransitionRelease(C,true);
  else if(C.u<p.flat/2-.006){SK.transition=null;body.z=body.vz=0;SKB.contact='ground';}
  return true;
}
