'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('airborne keyboard, mouse, controller and touch tricks preserve momentum; ramp pops stay near the wall',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
  let pad=null;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad?[pad]:[]});const bad=[],popCases=[];
  const reset=()=>{skateDismount();for(const k in K)K[k]=0;pad=null;SK.lastT=T;SK.charge=-1;px=SKATEPARK.bx*8+5.5;py=SKATEPARK.by*8+3.8;a=SK.dir=0;SK.v=.5;SKB.v=[.5,0,0];SKB.yaw=SKB.pitch=SKB.roll=0;SKB.surf=skateSurface(px,py);body.z=body.vz=body.peak=0;body.trick=null;body.buf=-9;};
  const tick=()=>{T+=1/120;stepSkate(1/120);stepBody(1/120);};
  for(const input of ['keyboard','space','mouse','controller','touch']){
   reset();skatePop('');for(let i=0;i<12;i++)tick();const vz=body.vz,speed=SK.v,z=body.z;
   if(input==='keyboard'){
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft',key:'ArrowLeft',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft',key:'ArrowLeft',bubbles:true}));for(let i=0;i<10;i++)tick();
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft',key:'ArrowLeft',bubbles:true}));
   }else if(input==='space'){K.ArrowLeft=1;skateSpace(true);skateSpace(false);K.ArrowLeft=0;}
   else if(input==='touch')jump('A');
   else if(input==='mouse'){skateMouseBegin();T+=.01;skateMouseMove(0,60);T+=.06;skateMouseMove(-42,-108);skateMouseEnd();}
   else{pad={connected:true,mapping:'standard',axes:[0,0,0,.95],buttons:[]};T+=.01;skatePollInput(.01);pad.axes=[0,0,-.7,-.8];T+=.06;skatePollInput(.06);}
   if(body.trick?.name!=='late kickflip')bad.push([input,body.trick?.name]);
   const expected=vz-(input==='keyboard'?GRAV*10/120:0);
   if(Math.abs(body.vz-expected)>1e-8||Math.abs(SK.v-speed)>1e-8||input!=='keyboard'&&Math.abs(body.z-z)>1e-8)bad.push([input,'changed flight']);
  }
  reset();skatePop('S');body.trick.t=.05;const original=body.trick;
  if(skateGesturePlay({key:'D'})||body.trick!==original)bad.push('interrupted active shuvit');
  body.trick.t=body.trick.duration-.1;const vz=body.vz;
  if(!skateGesturePlay({key:'D'})||body.trick!==original)bad.push('did not buffer near catch');
  body.trick.t=body.trick.duration;T+=.11;skateAirTrickStep();
  if(body.trick?.name!=='late heelflip'||body.vz!==vz||SK.lateTrick)bad.push('buffer did not finish at catch');
  for(const o of SK_TRANSITIONS)for(const fraction of [.6,.95]){
   reset();const u=o.profile.flat/2+o.profile.curve*fraction;
   if(o.pool){const f=skatePoolFrame(o,u,.4);SK.transition={o,u,axis:.4,vs:.5,va:0,velocity:f.tu.map(v=>v*.5)};a=Math.atan2(f.tu[1],f.tu[0]);}
   else if(o.bowl){SK.transition={o,u,axis:.4,vs:.5,va:0};a=.4;}
   else{SK.transition={o,u,axis:0,vs:.5,va:0};a=Math.atan2(o.s,o.c);}
   skateTransitionPlace(SK.transition);const v=SKB.v.slice(),up=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up,normal=SKB.surf.n;
   skateTransitionPop('',{strength:1});skateAirPose(0);
   const impulse=SKB.v.map((x,i)=>x-v[i]),side=Math.hypot(impulse[0],impulse[1]),after=skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).up;
   if(side>POP_V/10*.181||impulse[2]<POP_V/10*.98||Math.abs(Math.hypot(...impulse)-POP_V/10)>1e-8)bad.push(['ramp impulse',o.kind,fraction,impulse]);
   if(Math.hypot(...up.map((x,i)=>x-after[i]))>1e-7)bad.push('flattened ramp pop');
   popCases.push({fraction,side,normalSide:Math.hypot(normal[0],normal[1])*POP_V/10});
  }
  return {bad,popCases};
 });assert.deepEqual(r.bad,[]);assert.ok(r.popCases.length>=6);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
