'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('back reverses into fakie; bowl jumps work and outside walls cannot lift the skater onto the deck',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const bad=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;T=100;third=false;clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;
   const bad=[],o=SK_TRANSITIONS.find(o=>o.pool&&o.spotPark),tick=()=>{T+=1/60;stepSkate(1/60);stepBody(1/60);};
   const reset=()=>{for(const key in K)K[key]=0;skateDismount();SK.lastT=T;SK.bail=0;body.z=body.vz=body.peak=0;body.trick=null;body.buf=-9;};
   reset();px=SKATEPARK.bx*8+5.5;py=SKATEPARK.by*8+3.8;a=SK.dir=0;SK.v=.25;SKB.v=[.25,0,0];
   K.KeyS=1;for(let i=0;i<240;i++)tick();K.KeyS=0;
   const reversedX=px;for(let i=0;i<30;i++)tick();
   if(SKB.v[0]>=0||!SKB.fakie||Math.abs(a)>.01||px>=reversedX||SK.bail)bad.push('back did not brake, reverse and coast fakie');
   for(const bowl of SK_TRANSITIONS.filter(o=>o.pool))for(const method of ['jump','space'])for(const yaw of [0,Math.PI/2,Math.PI]){
    const o=bowl;reset();const f=skatePoolFrame(o,o.profile.flat/2+o.profile.radius*.8,0);
    px=o.x+f.x;py=o.y+f.y;a=SK.dir=yaw;SK.v=.6;
    enterSkateTransition(skateTransitionAt(px,py,o.z0+f.z));skateTransitionPlace(SK.transition);
    if(method==='jump')jump('');else{
     window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
     window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));
    }
    if(!body.trick||SK.transition)bad.push(['jump did not pop',method,yaw]);
    let airs=0;for(let i=0;i<30;i++){tick();if(skateAir())airs++;if(SK.grind)bad.push('coping stole jump');}
    if(airs<5||SK.bail)bad.push(['bowl jump failed',method,yaw,airs,SK.bail]);
   }
   for(const angle of [0,Math.PI/2,Math.PI*1.5]){
    reset();const rim=skatePoolFrame(o,o.profile.limit,angle),r=rim.r+o.profile.deck;
    px=o.x+Math.cos(angle)*(r+.08);py=o.y+Math.sin(angle)*(r+.08);a=SK.dir=angle+Math.PI;SK.v=.3;
    body.ground=walkGround(px,py);body.groundMode=mode;
    // This also checks a deliberately long displacement cannot tunnel through.
    const from=[px,py];move(-Math.cos(angle)*.13,-Math.sin(angle)*.13);
    if(skateBowlLocalRadius(o,px,py)<=o.profile.tip+o.profile.deck)bad.push(['wall tunnelling',angle]);
    [px,py]=from;for(let i=0;i<30;i++)tick();
    if(walkGround(px,py)>o.z0+.05||SK.transition)bad.push(['wall lifted onto deck',angle]);
   }
   const stairs=SK_BOWL_STAIRS.find(s=>s.bowl===o),last=stairs.steps.at(-1);
   reset();px=last.x;py=last.y;body.ground=walkGround(px,py);body.groundMode=mode;
   const deckX=stairs.end+.01;
   if(!free(deckX,py))bad.push('stairs no longer reach deck');
   return bad;
  });
  assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
