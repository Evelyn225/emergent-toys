'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('natural bowl airs accept mouse and arrow events, return fakie, and roof drops keep the rider framed',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});
  const bad=[],o=SK_TRANSITIONS.find(o=>o.pool&&o.spotPark),tick=()=>{T+=1/120;stepSkate(1/120);stepBody(1/120);skateBoardSync();};
  let axis=0,best=Infinity;for(let i=0;i<4096;i++){const t=i/4096*Math.PI*2,f=skatePoolFrame(o,o.profile.flat/2+o.profile.curve*.6,t),cross=Math.abs(f.tu.reduce((s,v,j)=>s+v*f.tv[j],0))/Math.hypot(...f.tv);if(cross<best){axis=t;best=cross;}}
  const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true})),mouse=(type,dx=0,dy=0)=>window.dispatchEvent(new MouseEvent(type,{button:2,movementX:dx,movementY:dy,bubbles:true}));
  for(const input of ['none','arrow','direct mouse','short mouse','loaded mouse']){
   skateDismount();mode='walk';room=null;for(const k in K)K[k]=0;body.z=body.vz=body.peak=0;body.trick=null;body.buf=-9;SK.lastT=T;SK.charge=-1;
   const u=o.profile.flat/2+.03,f=skatePoolFrame(o,u,axis);a=Math.atan2(f.tu[1],f.tu[0]);SK.transition={o,u,axis,vs:.9,va:0,velocity:f.tu.map(v=>v*.9)};skateTransitionPlace(SK.transition);
   let i=0;while(SK.transition&&i++<240)tick();if(!skateAir()){bad.push([input,'no natural air']);continue;}const launchYaw=a;
   for(let j=0;j<22;j++)tick();const vz=body.vz;
   if(input==='arrow'){key('keydown','ArrowLeft');key('keyup','ArrowLeft');for(let j=0;j<10;j++)tick();}
   if(input==='direct mouse'||input==='short mouse'){mouse('mousedown');mouse('mousemove',input==='short mouse'?-24:-60,0);T+=.06;mouse('mouseup');}
   if(input==='loaded mouse'){mouse('mousedown');mouse('mousemove',0,60);T+=.06;mouse('mousemove',-42,-108);mouse('mouseup');}
   if(input!=='none'&&body.trick?.name!=='late kickflip')bad.push([input,'no flip',body.trick?.name]);
   if(Math.abs(body.vz-vz+(input==='arrow'?GRAV*10/120:0))>1e-8)bad.push([input,'extra impulse']);
   let maxTurn=0;for(let j=0;j<300&&skateAir()&&!SK.bail;j++){tick();maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(a-launchYaw),Math.cos(a-launchYaw))));}
   if(maxTurn>.05||SK.bail||!SK.transition||!SKB.fakie)bad.push([input,'return',maxTurn,SK.bail,!!SK.transition,SKB.fakie]);
  }
  // Find a native tall roof beside an open street, then pop across its edge.
  let edge=null;
  for(let y=1;y<N-1&&!edge;y++)for(let x=1;x<N-1&&!edge;x++){
   const h=roofHeightAt(x+.5,y+.5);if(h<.8||map[idx(x,y)]!==h)continue;
   if(roofHeightAt(x+1.2,y+.5)===0&&walkGround(x+1.2,y+.5)<.05&&!architectureBlocked(x+1.2,y+.5,.03)&&!landmarkBlocked(x+1.2,y+.5,.03))edge={x,y,h};
  }
  if(!edge){bad.push('no roof fixture');return {bad};}
  skateDismount();for(const k in K)K[k]=0;mode='roof';room=null;roofH=edge.h;roofLot=roofCells(edge.x,edge.y);px=edge.x+.98;py=edge.y+.5;a=SK.dir=0;SK.v=.9;SKB.v=[.9,0,0];SKB.yaw=SKB.pitch=SKB.roll=0;body.z=body.vz=body.peak=0;body.trick=null;body.ground=0;body.groundMode='roof';SK.lastT=T;SK.lookT=-9;pitch=-.12;skateBoardSync();skateCam(0);skatePop('');
  let drops=0,minBack=Infinity,maxEyeGap=0,minEyeAbove=Infinity;
  for(let j=0;j<110;j++){
   T+=1/120;stepSkate(1/120);stepBody(1/120);stepRoof();skateBoardSync();const cam=skateCam(1/120);
   if(mode==='walk'&&body.z>4){drops++;minBack=Math.min(minBack,SK.camBack);maxEyeGap=Math.max(maxEyeGap,Math.abs(cam[3]-(skateGround(px,py)+body.z/10)));minEyeAbove=Math.min(minEyeAbove,cam[3]-(skateGround(px,py)+body.z/10));}
  }
  if(drops<20||minBack<.12||maxEyeGap>.4||minEyeAbove<.1)bad.push(['roof framing',edge,drops,minBack,maxEyeGap,minEyeAbove]);
  return {bad,drops,minBack,maxEyeGap};
 });assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
