'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('S stops and pivots with camera follow, orbit is unlimited, and lip grace pops only once',async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await p.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;T=100;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});const bad=[],wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const reset=()=>{skateDismount();for(const k in K)K[k]=0;px=SKATEPARK.bx*8+5.5;py=SKATEPARK.by*8+3.8;a=SK.dir=0;SK.v=.8;SKB.v=[.8,0,0];SKB.yaw=SKB.pitch=SKB.roll=0;SKB.fakie=false;body.z=body.vz=body.peak=0;body.trick=null;SK.lastT=T;pitch=-.12;};
  reset();let clock=performance.now();t0=clock;K.KeyS=1;const start=[px,py];let stop=null,pivoted=false;
  for(let i=0;i<240;i++){clock+=1000/120;loop(clock);if(SK.v<.02&&stop===null)stop=i/120;if(SK.pivot){pivoted=true;if(SK.v>.001)bad.push('pivot while rolling');}}
  if(stop===null||stop>1.5||!pivoted||Math.abs(wrap(a-Math.PI))>.01||SKB.v[0]>=0||SKB.fakie||SK.bail)bad.push('stop/pivot/reverse failed');
  if(Math.abs(wrap(SK.camYaw-a))>.4)bad.push('camera did not follow pivot');
  K.KeyS=0;const speed=SK.v;clock+=1000/60;loop(clock);if(SK.v>=speed)bad.push('release did not coast');
  reset();SK.v=0;SKB.v=[0,0,0];SK.camYaw=SK.camBase=null;skateCam(0);let previous=SK.camYaw;
  for(let i=0;i<240;i++){T+=1/60;turnBy(6*Math.PI/(.003*settings.sensitivity*240),0);skateCam(1/60);if(SK.camYaw<previous-1e-8)bad.push('orbit reversed at wrap');previous=SK.camYaw;}
  if(SK.look<5.9*Math.PI||SK.camYaw<5*Math.PI)bad.push('mouse orbit bounded');
  for(let i=0;i<150;i++){T+=1/60;const prev=SK.camYaw;skateCam(1/60);if(Math.abs(wrap(SK.camYaw-prev))>.3)bad.push('orbit recenter jump');}
  if(Math.abs(wrap(SK.camYaw-a+SK.stance*SK_CAM_SIDE))>.2)bad.push('orbit did not recenter the short way');
  // The same unbounded turnBy path is used by controller LB-look.
  const pad={index:0,id:'Orbit test',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});controllerTick(0);SK.look=0;SK.camYaw=SK.camBase=null;skateCam(0);pad.buttons[4].value=1;pad.axes[2]=1;
  for(let i=0;i<360;i++){T+=1/60;controllerTick(1/60);skateCam(1/60);}
  if(SK.look<4*Math.PI||Math.abs(a)>.001)bad.push('controller orbit bounded or steered board');
  pad.buttons[4].value=0;pad.axes[2]=0;controllerTick(0);
  const o=SK_TRANSITIONS.find(o=>o.pool&&o.spotPark);
  const lip=()=>{reset();const u=o.profile.limit-.001,f=skatePoolFrame(o,u,0);SK.transition={o,u,axis:0,velocity:f.tu.map(v=>v*.8),vs:.8,va:0,yawOff:0};a=0;skateTransitionPlace(SK.transition);skateTransitionRelease(SK.transition,true);};
  lip();SK.charge=T-.3;T+=.07;const before=body.vz;K.ArrowLeft=1;skateSpace(false);K.ArrowLeft=0;
  if(body.trick?.name!=='kickflip'||body.vz<=before||SK.lipPop)bad.push('Space lip grace failed');
  const once=body.vz;skatePop('');if(body.vz!==once)bad.push('grace double pop');
  lip();T+=.13;if(skateLipPop('A')||body.trick)bad.push('expired grace popped');
  lip();pad.buttons[7].value=1;pad.axes[3]=.95;T+=.01;controllerTick(.01);skatePollInput(.01);pad.axes[2]=-.7;pad.axes[3]=-.8;T+=.06;controllerTick(.05);skatePollInput(.05);
  if(body.trick?.name!=='kickflip'||!SK.airRoute?.out||SK_INPUT.grabR)bad.push('controller grace/air-out failed');
  return {bad,stop};
 });assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
