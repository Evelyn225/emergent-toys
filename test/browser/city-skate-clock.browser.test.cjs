'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('real skating loop is render-rate independent, interpolates one pose, and resets after pause or teleport',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});
   const bad=[],runs=[],actualRender=render;let clock=performance.now();
   render=()=>{if(skateView&&(Math.abs(SKB.p[0]-skateView.x)>1e-9||Math.abs(SKB.p[1]-skateView.y)>1e-9||SK.renderContact!==SKB.contact))bad.push('rider/board render phase mismatch');};
   const frame=dt=>{clock+=dt*1000;loop(clock);if(SK.renderContact!=null)bad.push('render pose leaked');};
   try{
    for(const hz of [30,60,120,144]){
     for(const key in K)K[key]=0;skateDismount();T=100;t0=clock;
     px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;a=SK.dir=0;SK.v=0;SK.lastT=T;SK.look=0;SK.lookT=-9;
     body.z=body.vz=body.mx=body.my=body.peak=0;body.trick=null;SKB.v=[0,0,0];
     K.KeyW=1;for(let i=0;i<hz*2;i++)frame(1/hz);K.KeyW=0;
     skateSpace(true);K.Space=1;for(let i=0;i<hz/2;i++)frame(1/hz);K.Space=0;skateSpace(false);
     for(let i=0;i<hz;i++)frame(1/hz);
     runs.push([px,py,body.z,SK.v,SK_CLOCK.time,T]);
    }
    const before=px;openPause();clock+=2000;loop(clock);if(SK_CLOCK.active)bad.push('pause retained clock');
    closePause(false);frame(1/60);if(Math.abs(px-before)>.1)bad.push('resume caught up paused time');
    const time=SK_CLOCK.time;frame(1);if(SK_CLOCK.time-time>.051||SK_CLOCK.accumulator>=SKATE_DT)bad.push('unbounded hitch catch-up');
    px+=10;const destination=px;frame(1/144);const pose=skatePoseSample();if(pose&&Math.abs(pose.p[0]-destination)>.15)bad.push('teleport interpolated old position');
   }finally{render=actualRender;}
   frame(0);return {bad,runs};
  });
  assert.deepEqual(r.bad,[]);for(const run of r.runs.slice(1))for(let i=0;i<run.length;i++)assert.ok(Math.abs(run[i]-r.runs[0][i])<1e-7,JSON.stringify(r.runs));assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
