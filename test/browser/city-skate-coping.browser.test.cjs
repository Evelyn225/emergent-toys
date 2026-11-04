'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('coping grinds stand upright; bowl airs cannot snap back onto their launch coping',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const bad=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;
   const bad=[],o=SK_TRANSITIONS.find(o=>o.pool&&o.spotPark),path=GRIND_PATHS.find(p=>p.feature===o),at=grindPathAt(path,.2);
   SK.v=.6;a=SK.dir=Math.atan2(at.tangent[1],at.tangent[0]);SK.lastT=T;SKB.roll=1.5;SKB.pitch=.9;SK.transition={o};
   startPathGrind(path,.2,1);T+=1/60;stepSkate(1/60);stepBody(1/60);
   if(skateAir()||Math.abs(SKB.roll)>.1||SK.transition||SK.airNormal[2]<.99)bad.push('grind retained bowl bank');
   const draw=()=>{const saved=[px,py,a],[x,y,yaw,z]=skateCam(.1);skateView={x:px,y:py,a,eye:z};px=x;py=y;a=yaw;tod=13;env(0);render(0);[px,py,a]=saved;skateView=null;};draw();
   // Scan the real stair corners: crossing an edge must not manufacture
   // tens of metres/second of vertical velocity from ordinary cruising.
   SK.grind=SK.transition=null;
   const stairs=SK_BOWL_STAIRS.find(s=>s.bowl===o);
   for(const step of stairs.steps)for(const xx of [step.x-step.hl,step.x,step.x+step.hl])for(const yy of [step.y-step.hw-.001,step.y,step.y+step.hw+.001]){
    px=xx;py=yy;a=SK.dir=0;SK.v=.8;SKB.v=[.8,0,0];body.z=body.vz=0;
    skateGroundVelocity(1/60,false,false,0);
    if(Math.abs(SKB.v[2])>1.25)bad.push(['stair corner launch',SKB.v[2]]);
   }
   // Leave the old bank in history, then pop on ordinary flat concrete.
   SK.grind=SK.transition=null;px=SKATEPARK.bx*8+4;py=SKATEPARK.by*8+3.3;a=SK.dir=0;SK.v=.4;body.z=body.vz=0;body.trick=null;
   SKB.pitch=SKB.roll=SKB.yaw=0;SK.airNormal=[1,0,0];SK.airPose={t:T,pitch:0,roll:1.5,normal:[1,0,0]};skatePop('');
   if(SK.airNormal[2]<.99||Math.abs(SK.airPose.roll)>.01)bad.push('new hop reused old bowl bank');
   // Recreate a real banked pop and test a descending pass exactly on coping.
   const f=skatePoolFrame(o,o.profile.flat/2+o.profile.radius*.8,0);
   px=o.x+f.x;py=o.y+f.y;a=SK.dir=0;SK.v=.65;body.z=body.vz=0;body.trick=null;SK.grind=SK.transition=null;
   enterSkateTransition(skateTransitionAt(px,py,o.z0+f.z));skateTransitionPlace(SK.transition);skateTransitionPop('');
   const q=grindPathAt(path,.2);px=q.p[0];py=q.p[1];SK.dir=Math.atan2(q.tangent[1],q.tangent[0]);SK.v=.5;
   body.z=(q.p[2]-skateGround(px,py))*10;body.vz=-.1;skatePathCatch();
   if(SK.grind)bad.push('coping stole its own launch');
   SK.airSource=null;skatePathCatch();if(!SK.grind)bad.push('intentional separate approach cannot grind');
   draw();return bad;
  });
  assert.deepEqual(bad,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
