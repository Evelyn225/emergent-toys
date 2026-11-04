'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('distinct skateparks include a large rideable bowl with drop-ins around its entire deck',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;T=100;third=false;clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;
   const bad=[],big=SK_TRANSITIONS.find(o=>o.bowl&&o.spotPark),flow=SK_TRANSITIONS.find(o=>o.spotPark&&!o.bowl);
   if(!big||!flow)return{bad:['missing parks']};
   const directory=mapDirectory();
   const stairs=SK_BOWL_STAIRS.find(s=>s.bowl===big);
   if(!stairs)bad.push('missing access stairs');
   else for(let i=0;i<stairs.steps.length;i++){
     const step=stairs.steps[i];
     if(Math.abs(walkGround(step.x,step.y)-step.z1)>.00001||solidAt(step.x,step.y,.02,step.z1-.02))bad.push('stairs not walkable');
   }
   // Toggle the real held board while constrained, walk away, and remount.
   const setup=skatePoolFrame(big,big.profile.flat/2+.1,0);px=big.x+setup.x;py=big.y;a=SK.dir=Math.PI/2;SK.v=.3;SK.lastT=T;
   body.z=body.vz=0;stepSkate(1/60);
   if(SK.transition?.o!==big)bad.push('setup did not enter bowl');
   useHeld({indoors:false});
   if(SK.transition||SK.grind||SK.manual)bad.push('dismount retained constraint');
   px=big.x+1.4;py=big.y;body.z=body.vz=0;body.mx=body.my=0;
   const remountX=px;useHeld({indoors:false});T+=1/60;stepSkate(1/60);
   if(Math.abs(px-remountX)>.02||SK.transition)bad.push('remount teleported into bowl');
   // Normal pushing must build useful speed, not just pass a force-unit test.
   px=SKATEPARK.bx*8+4;py=SKATEPARK.by*8+3.3;a=SK.dir=0;SK.v=0;SK.lastT=T;
   K.KeyW=1;for(let i=0;i<240;i++){T+=1/60;stepSkate(1/60);stepBody(1/60);}K.KeyW=0;
   if(SK.v<.4)bad.push(['pushing too slow',SK.v]);
   SK.camYaw=SK.camZ=null;skateCam(1/60);
   if(SK.camBack<.45)bad.push(['camera too close',SK.camBack]);

   for(const id of ['skatepark','skatepark-big-bowl','skatepark-flow-yard'])if(!directory.some(p=>p.id===id))bad.push(['not mapped',id]);
   if(big.hl*20<20||big.hw*20<28||big.profile.height*10<3)bad.push('bowl too small');
   if(Math.hypot(big.x-flow.x,big.y-flow.y)<8)bad.push('parks not separate');
   for(const o of [big,flow]){
    if(trees.some(t=>Math.abs(t.x-o.x)<o.hl+.05&&Math.abs(t.y-o.y)<o.hw+.05))bad.push('tree in riding area');
    if(!GRIND_PATHS.some(p=>p.feature===o))bad.push('missing coping');
   }
   for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const rim=skatePoolFrame(big,big.profile.limit,angle);px=big.x+rim.x+Math.cos(angle)*.04;py=big.y+rim.y+Math.sin(angle)*.04;
    a=SK.dir=angle+Math.PI;SK.v=0;SK.lastT=T;SK.transition=SK.grind=null;SK.bail=0;body.z=body.vz=0;body.trick=null;skateInputReset();
    const start=walkGround(px,py);K.KeyW=1;
    for(let i=0;i<15;i++){T+=1/60;stepSkate(1/60);stepBody(1/60);}K.KeyW=0;
    if(SK.transition?.o!==big||SKB.p[2]>start-.02||SK.bail>0)bad.push(['drop-in failed',angle,SKB.p[2],start]);
   }
   const theta=.8,rad=big.profile.flat/2+big.profile.radius*Math.sin(theta);
   for(const angle of [0,.8,2.4,4.5]){
    const f=skatePoolFrame(big,big.profile.flat/2+big.profile.radius*theta,angle),x=big.x+f.x,y=big.y+f.y;
    if(Math.abs(walkGround(x,y)-(big.z0+big.profile.radius*(1-Math.cos(theta))))>1e-6)bad.push('ground does not match bowl');
    const surf=skatePoolSample(big,x,y);
    if(!surf||Math.abs(surf.h-walkGround(x,y))>.00001)bad.push('pool surface does not match ground');
   }
   SK.transition=null;body.z=body.vz=0;fx.skating=false;px=big.x-1.5;py=big.y-.6;a=Math.atan2(.6,1.5);pitch=-.25;tod=13;env(0);render(0);
   return{bad,diameter:big.hl*20,depth:big.profile.height*10};
  });
  assert.deepEqual(r.bad,[]);assert.ok(r.diameter>=20);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
