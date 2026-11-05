'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('C and RT explicitly air out, RT does not grab, return airs stay inside, and coping boardslides catch',async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const result=await p.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;T=100;
  const o=SK_TRANSITIONS.find(o=>o.pool&&o.spotPark),bad=[];
  const mount=()=>{skateDismount();body.z=body.vz=body.peak=0;body.trick=null;body.seat=null;for(const k in K)K[k]=0;
   const u=o.profile.limit-.005,f=skatePoolFrame(o,u,0);SK.transition={o,u,axis:0,velocity:f.tu.map(v=>v*.7),vs:.7,va:0,yawOff:0};a=0;SK.lastT=T;skateTransitionPlace(SK.transition);};
  const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  mount();key('keydown','KeyC');if(body.seat)bad.push('C sat down');skatePop('');if(!SK.airRoute?.out)bad.push('C did not choose exit');key('keyup','KeyC');if(!SK.airRoute?.out)bad.push('release changed flight');
  mount();const pad={index:0,id:'Bowl test',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  controllerTick(1/120);pad.buttons[7].value=1;pad.axes[3]=.95;T+=.01;controllerTick(.01);skatePollInput(.01);
  pad.axes[3]=-.95;T+=.08;controllerTick(.05);skatePollInput(.05);
  if(!SK.airRoute?.out||SK.transition)bad.push('RT gesture did not exit');
  for(let i=0;i<10;i++){T+=1/120;controllerTick(1/120);stepSkate(1/120);stepBody(1/120);}
  if(SK_INPUT.grabR||body.trick?.grab)bad.push('exit trigger became grab');
  pad.buttons[7].value=0;pad.axes[3]=0;controllerTick(0);mount();skateTransitionRelease(SK.transition,true);
  const route=SK.airRoute;for(let i=0;i<12;i++){a+=.1;T+=1/120;stepSkate(1/120);stepBody(1/120);const q=skatePoolSample(o,px,py);if(!q||q.local>o.profile.tip-.0149)bad.push('return air crossed coping');if(SK.airRoute!==route)bad.push('spin changed route');}
  // A separate deck approach, and an intentional exit from this bowl, both
  // allow a crosswise board to slide while its velocity carries along coping.
  const path=GRIND_PATHS.find(p=>p.feature===o),at=grindPathAt(path,path.length*.23),angle=Math.atan2(at.tangent[1],at.tangent[0]);
  for(const own of [false,true]){skateDismount();px=at.p[0];py=at.p[1];a=angle+Math.PI/2;SK.dir=angle+.8;SK.v=.5;SK.lastT=T;body.z=(at.p[2]-skateGround(px,py))*10;body.vz=-.1;body.trick=null;SK.airSource=own?o:null;SK.airRoute=own?{o,out:true}:null;skatePathCatch();if(SK.grind?.name!=='boardslide')bad.push('boardslide rejected '+own);}
  mount();SK.camYaw=Math.PI;SK.transition=null;body.z=body.vz=0;px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;SKB.v=[0,0,0];SKB.surf=null;SK.v=0;SK.dir=a=0;K.KeyW=1;for(let i=0;i<20;i++){T+=1/120;stepSkate(1/120);stepBody(1/120);}K.KeyW=0;if(SKB.v[0]>=0||!SKB.fakie||Math.abs(a)>.01)bad.push('camera-facing fakie push failed');
  openPause();const controls=pauseEl.textContent;if(!controls.includes('hold C')||!controls.includes('air out'))bad.push('missing controls');closePause(false);
  return {bad};
 });assert.deepEqual(result.bad,[]);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
