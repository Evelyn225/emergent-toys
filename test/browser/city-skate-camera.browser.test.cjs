'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('skate camera lags a carve, holds heading through a spin and widens FOV only during rendering',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
   px=SKATEPARK.bx*8+4;py=SKATEPARK.by*8+3.3;a=0;SK.dir=0;SK.v=.6;SK.lastT=T;SK.camYaw=SK.camZ=null;
   body.z=body.vz=0;body.trick=null;SKB.v=[.6,0,0];skateCam(1/60);
   a=.8;SK.dir=.8;T+=1/60;const turned=skateCam(1/60)[2],lag=Math.abs(a-turned);
   body.z=1;body.vz=1;const yaw0=skateCam(.5)[2];
   for(let i=0;i<30;i++){T+=1/60;a+=.2;skateCam(1/60);}
   const yawHeld=Math.abs(SK.camYaw-yaw0);
   body.z=body.vz=0;body.trick=null;SK.v=.8;SK.dir=a;SKB.v=[Math.cos(a)*.8,Math.sin(a)*.8,0];
   SK.lastT=T;const base=FOV,original=render;let seen=base;
   render=()=>{seen=FOV;};try{loop(performance.now()+100);}finally{render=original;}
   return{lag,held:yawHeld,base,seen,after:FOV,back:SK.camBack,flags:{paused,mode,skating:fx.skating,third,held,game:!!game,sleep:!!sleep}};
  });
  assert.ok(r.lag>.2&&r.lag<1.2);assert.ok(r.held<.08,JSON.stringify(r));
  assert.ok(r.seen>r.base,JSON.stringify(r));assert.equal(r.after,r.base);assert.ok(r.back>0&&r.back<=.27);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
