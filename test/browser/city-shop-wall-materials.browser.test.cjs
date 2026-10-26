'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';T=12;tod=12;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);}finally{await page.close();}}
test('shop section walls keep their own material when the player crosses a section boundary',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],cases=[
   ['hardware',17,5,5.3,1.4,[8,6],[15,6],[3,0]],
   ['grocer',13,2,2.3,1.2,[5,6],[10,2],[0,5]],
   ['video',11,0,10.3,2.8,[6,6],[10,2],[3,0]],
   ['herbs',9,1,1.3,1.2,[5,5],[11,4],[0,5]],
   ['liquor',0,2,2.3,1.2,[7,5],[2,2],[11,5]],
  ];
  for(const[kind,mx,my,u,z,outside,inside,other]of cases){
   enterRoom(kind,{ret:[100,100,0]},[...outside,0]);
   const sample=at=>{[px,py]=at;BG[0]=BG_UNSET;set(0,' ',0);const drew=room.def.wall(0,u,.01,z,3,mx,my,8);return[drew,BG[0],CH[0],COL[0]];};
   const A=sample(outside),B=sample(inside),C=sample(outside);
   if(JSON.stringify(A)!==JSON.stringify(B)||JSON.stringify(A)!==JSON.stringify(C))bad.push([kind,'section material follows camera',A,B,C]);
   if(!B[0])bad.push([kind,'section has no own wall material']);
   BG[0]=BG_UNSET;set(0,' ',0);const own=room.def.wall(0,u,.01,z,3,...other,8),main=[own,BG[0],CH[0],COL[0]];
   if(JSON.stringify(main)===JSON.stringify(B))bad.push([kind,'section material blankets the main shop']);
  }return bad;
 });assert.deepEqual(r,[]);
}));

test('walking through the real hardware garden opening keeps its visible trellis and its back wall finish',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('hardware',{word:'HARDWARE',ret:[100,100,0]},[12.1,4.5,0]);body.z=body.vz=0;pitch=0;
  const bad=[],wall=room.def.wall,sample=(mx,my)=>{BG[0]=BG_UNSET;set(0,' ',0);wall(0,4.3,.01,1.4,2,mx,my,8);return[BG[0],CH[0],COL[0]];},expected=sample(17,4);
  let visible=0;room.def.wall=(...args)=>{const hit=wall(...args);if(hit&&args[5]>=13){visible++;BG[args[0]]=C(MAG,15);}return hit;};
  try{for(let step=0;step<=32;step++){
   if(step)move(.1,0);if(!free(px,py))bad.push('walk enters blocked floor');
   if(JSON.stringify(sample(17,4))!==JSON.stringify(expected))bad.push('walking swaps trellis');
   if([0,12,32].includes(step)){visible=0;render(0);if(visible<30||!Array.from(BG).includes(C(MAG,15)))bad.push(['no native garden wall',step,visible]);}
  }
  if(px<15.2)bad.push(['garden opening blocks actual walking',px,py]);
  // The garden's back wall is trellis too, rather than the main shop's paint cans.
  const garden=sample(14,0),main=sample(3,0);if(JSON.stringify(garden)===JSON.stringify(main))bad.push('garden back wall still has paint cans');
  }finally{room.def.wall=wall;}return bad;
 });assert.deepEqual(r,[]);
}));
