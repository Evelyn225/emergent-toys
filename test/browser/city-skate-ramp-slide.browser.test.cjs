'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('real kicker keeps launch energy bounded and sliding rider shares the board stance',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
   const o=SKATE_FEATURES.find(o=>o.ramp==='kicker');skateDismount();T=100;
   px=o.x-o.c*(o.hl+.08);py=o.y-o.s*(o.hl+.08);a=SK.dir=Math.atan2(o.s,o.c);SK.v=.95;SK.lastT=T;
   body.z=body.vz=body.peak=0;body.trick=null;SKB.v=[o.c*.95,o.s*.95,0];SKB.surf=null;
   const base=skateGround(px,py),initial=.5*.95**2,energies=[],vz=[];const catchGrind=grindCatch;grindCatch=()=>false;
   try{for(let i=0;i<85;i++){T+=1/120;stepSkate(1/120);stepBody(1/120);skateBoardSync();energies.push(.5*SKB.v.reduce((s,v)=>s+v*v,0)+.98*(skateGround(px,py)+body.z/10-base));vz.push(body.vz);}}finally{grindCatch=catchGrind;}
   const bail=SK.bail;
   // Capture production drawing inputs, including the authored foot anchor.
   skateDismount();px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;a=SK.dir=0;SK.v=.8;SKB.v=[.8,0,0];body.z=body.vz=0;body.trick=null;SK.lastT=T;
   K.KeyS=K.KeyD=1;for(let i=0;i<15;i++){T+=1/120;stepSkate(1/120);stepBody(1/120);}K.KeyS=K.KeyD=0;
   let board,rider;const db=drawSkateBoard,df=drawSkaterFigure;
   drawSkateBoard=(...args)=>board=args;drawSkaterFigure=(...args)=>rider=args;
   const saved=[px,py,a],[cx,cy,yaw,z]=skateCam(.1);skateView={x:px,y:py,a,eye:z};px=cx;py=cy;a=yaw;
   try{drawSkater();}finally{drawSkateBoard=db;drawSkaterFigure=df;[px,py,a]=saved;skateView=null;}
   return {initial,maxEnergy:Math.max(...energies),launch:Math.max(...vz),bail,boardYaw:board[3],riderYaw:Math.atan2(rider[5],rider[4]),stance:SK.stance,slide:SK.slide,anchor:rider[10]};
  });
  assert.ok(r.maxEnergy<=r.initial*1.04,JSON.stringify(r));assert.ok(r.launch>0&&r.launch<9.5,JSON.stringify(r));assert.equal(r.bail,0);
  const delta=r.riderYaw-r.boardYaw-r.stance*Math.PI/2;
  assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<1e-8,JSON.stringify(r));assert.ok(r.slide>.7);assert.equal(r.anchor.length,3);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
