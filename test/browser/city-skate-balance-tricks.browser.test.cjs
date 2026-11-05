'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('A/D and right stick correct grind balance; mouse manuals hold; every trick is reachable on controller',async()=>{
 const b=await chromium.launch(),p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await p.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=false;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;T=100;
  const pad={index:0,id:'Trick test',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});controllerTick(0);
  const base=[SKATEPARK.bx*8+4.3,SKATEPARK.by*8+3.4],bad=[],balances=[];
  const reset=()=>{skateDismount();for(const k in K)K[k]=0;[px,py]=base;a=SK.dir=0;SK.v=.5;SKB.v=[.5,0,0];body.z=body.vz=body.peak=0;body.trick=null;SK.lastT=T;pad.axes=[0,0,0,0];pad.buttons.forEach(b=>b.value=0);controllerTick(0);};
  const tick=()=>{T+=1/120;controllerTick(1/120);stepSkate(1/120);stepBody(1/120);};
  const path=addGrindPath([[base[0],base[1],.035],[base[0]+2,base[1],.035]],{kind:'handrail',material:'metal',feature:{}});
  for(const source of ['key','stick','mouse']){reset();startPathGrind(path,.1,1);SK.grind.bal=.65;SK.grind.balV=.8;if(source==='key')K.KeyA=1;else if(source==='stick')pad.axes[2]=-1;else{skateMouseBegin();skateMouseMove(-60,0);}for(let i=0;i<36;i++){if(source==='mouse')skateMouseMove(-3,0);tick();}balances.push(SK.grind?.bal);if(!SK.grind||SK.grind.bal>=.6)bad.push(source+' balance did not recover');}
  reset();skateMouseBegin();skateMouseMove(0,21);for(let i=0;i<60;i++)tick();if(!SK.manual)bad.push('mouse manual relaxed away');
  flick={x:0,y:21};window.dispatchEvent(new MouseEvent('mouseup',{button:2,bubbles:true}));if(body.trick||body.vz>0)bad.push('releasing balance mouse popped');
  const circle=(turn,n)=>Array.from({length:n+1},(_,i)=>[Math.cos(Math.PI/2+turn*i/n),Math.sin(Math.PI/2+turn*i/n)]);
  const paths={'ollie':[[0,1],[0,.3],[0,-1]],kickflip:[[0,1],[0,.3],[-.6,-.6]],heelflip:[[0,1],[0,.3],[.6,-.6]],'pop shuvit':[...circle(Math.PI,14),[0,0]],'360 flip':[...circle(Math.PI*1.5,20),[0,0]],'360 shuvit':[...circle(-Math.PI*1.5,20),[0,0]],hardflip:[...circle(Math.PI/2,7),[.7,-.7]],'inward heelflip':[...circle(-Math.PI/2,7),[-.7,-.7]],'varial heelflip':[...circle(-Math.PI,14),[.7,-.7],[0,0]]};
  for(const [name,points]of Object.entries(paths)){reset();for(const right of points){pad.axes[2]=right[0];pad.axes[3]=right[1];T+=1/60;controllerTick(1/60);skatePollInput(1/60);}if(body.trick?.name!==name)bad.push(name+' became '+body.trick?.name);}
  return {bad,balances};
 });assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
