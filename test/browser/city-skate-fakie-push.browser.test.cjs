'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('regular and fakie kicks face their impulse direction, including mongo, then coast at speed',async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await p.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;sleep=null;third=true;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;T=100;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});const bad=[];
  const reset=(direction,speed=.4)=>{skateDismount();for(const k in K)K[k]=0;px=SKATEPARK.bx*8+4.3;py=SKATEPARK.by*8+3.4;a=0;SK.dir=direction;SK.v=speed;SKB.v=[Math.cos(direction)*speed,Math.sin(direction)*speed,0];SKB.yaw=SKB.pitch=SKB.roll=0;SKB.fakie=direction!==0;SK.lastT=T;body.z=body.vz=body.peak=0;body.trick=null;};
  const tick=()=>{T+=1/120;skateFixedFrame(1/120);};
  for(const direction of [0,Math.PI])for(const mongo of [false,true]){
   reset(direction);K.KeyW=1;if(mongo)K.ShiftLeft=1;for(let i=0;i<20;i++)tick();
   if(SK.v<=.4||Math.abs(a)>.001||SKB.fakie!==(direction!==0))bad.push('wrong push impulse '+direction+'/'+mongo);
   let board,rider;const db=drawSkateBoard,df=drawSkaterFigure;
   drawSkateBoard=(...args)=>board=args;drawSkaterFigure=(...args)=>rider=args;
   try{skateFixedRender(()=>{const original=a;a=.7;skateView={x:px,y:py,a:original,eye:.5};try{drawSkater();}finally{a=original;skateView=null;}});}finally{drawSkateBoard=db;drawSkaterFigure=df;}
   const facing=Math.atan2(rider[5],rider[4]),delta=facing-direction;
   if(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))>.001||Math.abs(board[3])>.001)bad.push('wrong push pose '+direction+'/'+mongo);
   if(!rider[7].startsWith(mongo?'mongo':'push'))bad.push('wrong planted leg');
   K.KeyW=0;for(let i=0;i<10;i++)tick();const speed=SK.v;K.KeyW=1;for(let i=0;i<20;i++)tick();if(SK.v<=speed||SKB.fakie!==(direction!==0))bad.push('repeated kick reversed direction');
  }
  reset(0,1.15);K.KeyW=1;tick();if(SK.kicking||!SK.pushCruise)bad.push('kept kicking at cruising speed');
  SK.v=.99;SKB.v=[.99,0,0];tick();if(!SK.kicking)bad.push('did not resume after slowing');
  return bad;
 });assert.deepEqual(r,[]);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
