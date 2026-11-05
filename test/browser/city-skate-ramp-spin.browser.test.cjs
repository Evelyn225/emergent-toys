'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('camera follows a natural fakie ramp return and steep air rider frames remain tangent',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});skateDismount();SK.lastT=T;body.trick=null;
  const o=SK_TRANSITIONS.find(o=>!o.bowl),yaw=Math.atan2(o.s,o.c);a=yaw;
  SK.transition={o,u:o.profile.flat/2+o.profile.radius*.8,axis:0,vs:.18,va:0,yawOff:0};skateTransitionPlace(SK.transition);skateCam(0);
  let descent=0,cameraError=null,facingError=null,fakie=false;
  for(let i=0;i<240;i++){
   T+=1/120;stepSkate(1/120);stepBody(1/120);skateCam(1/120);
   if(SKB.v[2]<-.02&&SK.v>.05)descent++;
   if(descent===65){cameraError=Math.abs(Math.atan2(Math.sin(SK.camYaw-SK.dir),Math.cos(SK.camYaw-SK.dir)));facingError=Math.abs(Math.atan2(Math.sin(a-yaw),Math.cos(a-yaw)));fakie=SKB.fakie;break;}
  }

  // Verify the rendered rider receives the full 3D facing, even on vert.
  SK.transition=null;body.z=4;body.vz=1;body.trick=null;SKB.yaw=a=0;SKB.pitch=1.56;SKB.roll=.4;skateAirBegin();SK.spin=.8;skateAirPose(0);
  const original=drawSkaterFigure;let tangent=null;
  drawSkaterFigure=(...args)=>{const u=args[9],f=args[11];tangent=f&&Math.abs(f.reduce((s,v,i)=>s+v*u[i],0))<1e-7&&Math.hypot(...f)>.99;return original(...args);};
  const saved=[px,py,a],[x,y,cam,z]=skateCam(.1);skateView={x:px,y:py,a,eye:z};px=x;py=y;a=cam;try{tod=13;env(0);render(0);}finally{[px,py,a]=saved;skateView=null;drawSkaterFigure=original;}
  return {descent,cameraError,facingError,fakie,tangent};
 });assert.ok(r.descent===65&&r.cameraError<.4,JSON.stringify(r));assert.ok(r.fakie&&r.facingError<.01,JSON.stringify(r));assert.equal(r.tangent,true);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
