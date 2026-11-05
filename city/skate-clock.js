// Fixed skating ticks, independent of render rate. The world retains its
// existing 50 ms frame budget: at most six 120 Hz ticks run in one frame.
const SKATE_DT=1/120,SKATE_FRAME_MAX=.05;
const SK_CLOCK={active:false,time:0,accumulator:0,previous:null,current:null,camera:null};
function skateFixedReset(){SK_CLOCK.active=false;SK_CLOCK.accumulator=0;SK_CLOCK.previous=SK_CLOCK.current=null;SK_CLOCK.camera=null;}
function skatePoseCapture(){
  return {mode,p:[px,py,skateGround(px,py)+body.z/10],a,pitch,v:SKB.v.slice(),board:skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll),
    vz:body.vz,trick:body.trick?{...body.trick}:null,contact:SKB.contact,
    surf:SKB.surf?{...SKB.surf,n:SKB.surf.n.slice()}:null,airNormal:SK.airNormal?.slice(),airForward:SK.airForward?.slice(),
    transition:SK.transition?{...SK.transition}:null,grind:SK.grind?{...SK.grind}:null,
    speed:SK.v,dir:SK.dir,kick:SK.kick,kicking:SK.kicking,mongo:SK.mongo,pushFakie:SK.pushFakie,
    bail:SK.bail,bailAt:SK.bailAt?.slice(),bailData:SK.bailData?{...SK.bailData,board:SK.bailData.board.slice()}:null,
    camera:SK_CLOCK.camera?.slice()};
}
function skateFixedFrame(dt){
  const end=T,c=SK_CLOCK;
  const moved=c.current&&Math.hypot(rel(px-c.current.p[0]),rel(py-c.current.p[1]))>.15;
  if(!c.active||moved||c.current?.mode!==mode||Math.abs(c.time+c.accumulator-(end-dt))>.1){
    skateFixedReset();c.active=true;c.time=end-dt;c.current=skatePoseCapture();c.previous=c.current;
  }
  try{
    T=c.time;
    // Observe input once, at the simulation boundary. Steering response itself
    // advances on the fixed clock; gestures are observed once per frame.
    if(typeof controllerSkatePad==='function')skatePollInput(dt,controllerSkatePad(),true);
    else skatePollInput(dt,undefined,true);
    c.accumulator+=Math.min(SKATE_FRAME_MAX,Math.max(0,dt));
    while(c.accumulator+1e-10>=SKATE_DT){
      c.previous=c.current;c.time+=SKATE_DT;T=c.time;
      skateSteerStep(SKATE_DT);stepSkate(SKATE_DT,false);stepBody(SKATE_DT);
      if(typeof stepRoof==='function')stepRoof();skateBoardSync();
      if(typeof skateCamOn==='function'&&skateCamOn()){
        c.camera=[...skateCam(SKATE_DT),pitch];
      }
      c.current=skatePoseCapture();c.accumulator=Math.max(0,c.accumulator-SKATE_DT);
      if(!skatingNow()||sleep){skateFixedReset();break;}
    }
  }finally{T=end;if(typeof CONTROLLER!=='undefined')CONTROLLER.sampleT=end;}
  return true;
}
const skateLerp=(a,b,t)=>a+(b-a)*t;
const skateAngleLerp=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
function skateVectorLerp(a,b,t){return a.map((v,i)=>skateLerp(v,b[i],t));}
function skateNormalLerp(a,b,t){const n=skateVectorLerp(a,b,t),l=Math.hypot(...n);return l<1e-6?b.slice():n.map(v=>v/l);}
// Convert the board's orthonormal basis to a quaternion. Interpolating its
// Euler angles independently can turn a vertical board sideways at +/-pi.
function skateQuaternion(axes){
  const f=axes.axis,u=axes.up,r=[u[1]*f[2]-u[2]*f[1],u[2]*f[0]-u[0]*f[2],u[0]*f[1]-u[1]*f[0]];
  const m=[f[0],r[0],u[0],f[1],r[1],u[1],f[2],r[2],u[2]],q=[0,0,0,0],trace=m[0]+m[4]+m[8];
  if(trace>0){const s=Math.sqrt(trace+1)*2;q[3]=s/4;q[0]=(m[7]-m[5])/s;q[1]=(m[2]-m[6])/s;q[2]=(m[3]-m[1])/s;}
  else{const i=m[0]>m[4]&&m[0]>m[8]?0:m[4]>m[8]?1:2,j=(i+1)%3,k=(i+2)%3;
    const s=Math.sqrt(1+m[i*3+i]-m[j*3+j]-m[k*3+k])*2;
    q[i]=s/4;q[3]=(m[k*3+j]-m[j*3+k])/s;q[j]=(m[j*3+i]+m[i*3+j])/s;q[k]=(m[k*3+i]+m[i*3+k])/s;
  }
  return q;
}
function skateBoardBlend(from,to,t){
  const a=skateQuaternion(from),b=skateQuaternion(to);let dot=a.reduce((v,n,i)=>v+n*b[i],0);
  if(dot<0){for(let i=0;i<4;i++)b[i]=-b[i];dot=-dot;}
  let x=1-t,y=t;
  if(dot<.9995){const theta=Math.acos(clamp(dot,-1,1)),s=Math.sin(theta);x=Math.sin((1-t)*theta)/s;y=Math.sin(t*theta)/s;}
  const q=a.map((v,i)=>v*x+b[i]*y),len=Math.hypot(...q);const [qx,qy,qz,qw]=q.map(v=>v/len);
  const axis=[1-2*(qy*qy+qz*qz),2*(qx*qy+qz*qw),2*(qx*qz-qy*qw)];
  const up=[2*(qx*qz+qy*qw),2*(qy*qz-qx*qw),1-2*(qx*qx+qy*qy)];
  const yaw=Math.atan2(axis[1],axis[0]),pitch=Math.asin(clamp(axis[2],-1,1)),neutral=skateBoardAxes(yaw,pitch,0).up,right=[-Math.sin(yaw),Math.cos(yaw),0];
  const d=v=>up.reduce((sum,n,i)=>sum+n*v[i],0);
  return {yaw,pitch,roll:Math.atan2(d(right),d(neutral))};
}
function skatePoseSample(){
  const c=SK_CLOCK,b=c.current,a=c.previous;
  if(!c.active||!a||!b)return null;
  const t=clamp(c.accumulator/SKATE_DT,0,1);
  if(a.mode!==b.mode||Math.hypot(rel(b.p[0]-a.p[0]),rel(b.p[1]-a.p[1]))>.15||(a.contact==='bail')!==(b.contact==='bail'))return {...b,orientation:skateBoardBlend(b.board,b.board,0)};
  const p=[worldCoord(a.p[0]+rel(b.p[0]-a.p[0])*t),worldCoord(a.p[1]+rel(b.p[1]-a.p[1])*t),skateLerp(a.p[2],b.p[2],t)];
  const camera=a.camera&&b.camera?[worldCoord(a.camera[0]+rel(b.camera[0]-a.camera[0])*t),worldCoord(a.camera[1]+rel(b.camera[1]-a.camera[1])*t),skateAngleLerp(a.camera[2],b.camera[2],t),skateLerp(a.camera[3],b.camera[3],t),skateAngleLerp(a.camera[4],b.camera[4],t)]:b.camera;
  const tr=b.trick?{...b.trick,t:skateLerp(a.trick?.name===b.trick.name?a.trick.t:0,b.trick.t,t)}:null;
  let bailData=b.bailData,bailAt=b.bailAt;
  if(a.bailData&&b.bailData){bailData={...bailData,board:skateVectorLerp(a.bailData.board,b.bailData.board,t),yaw:skateAngleLerp(a.bailData.yaw,b.bailData.yaw,t),roll:skateAngleLerp(a.bailData.roll,b.bailData.roll,t)};bailAt=[...p.slice(0,2),b.bailAt[2],skateAngleLerp(a.bailAt[3],b.bailAt[3],t)];}
  return {...b,p,a:skateAngleLerp(a.a,b.a,t),pitch:skateAngleLerp(a.pitch,b.pitch,t),v:skateVectorLerp(a.v,b.v,t),vz:skateLerp(a.vz,b.vz,t),
    orientation:skateBoardBlend(a.board,b.board,t),surf:b.surf?{...b.surf,n:a.surf?.ref===b.surf.ref?skateNormalLerp(a.surf.n,b.surf.n,t):b.surf.n}:null,
    airNormal:a.airNormal&&b.airNormal?skateNormalLerp(a.airNormal,b.airNormal,t):b.airNormal,
    airForward:a.airForward&&b.airForward?skateNormalLerp(a.airForward,b.airForward,t):b.airForward,
    trick:tr,camera,bailData,bailAt,speed:skateLerp(a.speed,b.speed,t),dir:skateAngleLerp(a.dir,b.dir,t),
    kick:a.kicking&&b.kicking?mod(a.kick+mod(b.kick-a.kick,1)*t,1):b.kick};
}
function skateFixedRender(draw){
  const pose=skatePoseSample();if(!pose)return draw(null);
  const position=[px,py,a,pitch],oldBody={z:body.z,vz:body.vz,trick:body.trick};
  const oldBoard={p:SKB.p,v:SKB.v,riderYaw:SKB.riderYaw,yaw:SKB.yaw,pitch:SKB.pitch,roll:SKB.roll,surf:SKB.surf,contact:SKB.contact};
  const old={};for(const key of ['v','dir','kick','kicking','mongo','pushFakie','airNormal','airForward','transition','grind','bail','bailAt','bailData','renderContact'])old[key]=SK[key];
  try{
    [px,py]=pose.p;a=pose.a;pitch=pose.camera?pose.camera[4]:pose.pitch;
    body.z=(pose.p[2]-skateGround(px,py))*10;body.vz=pose.vz;body.trick=pose.trick;
    Object.assign(SKB,{p:pose.p,v:pose.v,riderYaw:pose.a,...pose.orientation,surf:pose.surf,contact:pose.contact});
    Object.assign(SK,{v:pose.speed,dir:pose.dir,kick:pose.kick,kicking:pose.kicking,mongo:pose.mongo,pushFakie:pose.pushFakie,airNormal:pose.airNormal,airForward:pose.airForward,transition:pose.transition,grind:pose.grind,
      bail:pose.bail,bailAt:pose.bailAt,bailData:pose.bailData,renderContact:pose.contact});
    return draw(pose.camera);
  }finally{[px,py,a,pitch]=position;Object.assign(body,oldBody);Object.assign(SKB,oldBoard);Object.assign(SK,old);}
}
