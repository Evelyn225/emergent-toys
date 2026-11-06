'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('mouse manuals start neutrally across gentle pulls and retain loaded, scooped and simple trick paths',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;T=100;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});const bad=[],tricks=[];
  const reset=()=>{skateDismount();for(const k in K)K[k]=0;px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;a=SK.dir=0;SK.v=.6;SKB.v=[.6,0,0];SKB.yaw=SKB.pitch=SKB.roll=0;SKB.surf=skateSurface(px,py);body.z=body.vz=body.peak=0;body.trick=null;SK.lastT=T;SK.charge=-1;};
  const mouse=(type,x=0,y=0)=>window.dispatchEvent(new MouseEvent(type,{button:2,movementX:x,movementY:y,bubbles:true}));
  const tick=()=>{T+=1/120;stepSkate(1/120);stepBody(1/120);};
  for(const start of [12,21,30,-12,-21,-30]){
   reset();mouse('mousedown');mouse('mousemove',0,start);for(let i=0;i<60;i++)tick();
   if(!SK.manual||Math.abs(SK.manual.bal)>.04)bad.push(['entry',start,SK.manual?.bal]);
   mouse('mouseup');if(body.trick||body.vz>0)bad.push('manual release popped');tick();if(SK.manual)bad.push('manual did not release');
  }
  reset();mouse('mousedown');mouse('mousemove',0,21);tick();const before=SK.manual?.mouseDepth;mouse('mousemove',0,-18);tick();
  if(!SK.manual||Math.abs(SK.manual.mouseDepth-before+.1)>1e-8)bad.push('mouse balance range not widened');mouse('mouseup');
  const circle=turn=>Array.from({length:25},(_,i)=>[Math.cos(Math.PI/2+turn*i/24),Math.sin(Math.PI/2+turn*i/24)]);
  const paths=[['kickflip',[[0,1],[-.7,-.8]]],['pop shuvit',circle(Math.PI)],['360 flip',circle(Math.PI*1.5)]];
  for(const [name,points]of paths){reset();mouse('mousedown');for(const [x,y]of points){mouse('mousemove',(x-SK_INPUT.mouse[0])*60,(y-SK_INPUT.mouse[1])*60);tick();}mouse('mouseup');
   tricks.push({name:body.trick?.name,recognized:SK_INPUT.fired});if(body.trick?.name!==name||!SK_INPUT.fired)bad.push(['motion path',name,body.trick?.name,SK_INPUT.fired]);
  }
  reset();mouse('mousedown');mouse('mousemove',-60,0);const recognized=SK_INPUT.fired;mouse('mouseup');if(recognized||body.trick?.name!=='kickflip')bad.push('simple direction fallback changed');
  return {bad,tricks};
 });assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
