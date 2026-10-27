'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=12;tod=12;env(0);enterRoom('hotelroom',{suite:true,lobby:{word:'GRAND HOTEL',grandHotel:true,ret:[100,100,0]}},ROOM_DEFS.hotelSuite.entry);render(0);});
 await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('Grand suite dining geometry clears the green sofa and kitchen with walkable gaps and an aligned chair',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],table=room.props.find(p=>p.box?.hl===1.1&&p.box.hw===.55&&p.box.z1===.78),sofa=room.props.find(p=>p.box?.hl===1.7&&p.box.z1===.94),kitchen=room.props.find(p=>p.kitchen);
  if(!table||!sofa||!kitchen)return ['native suite fixtures missing'];
  const capture=o=>{const out=[],draw=drawBox;drawBox=b=>out.push({...b});try{o.draw(o.x,o.y,o);}finally{drawBox=draw;}return out;};
  const A=capture(table),B=capture(sofa);
  if(A.some(a=>B.some(b=>a.z0<b.z1-.005&&a.z1>b.z0+.005&&furnishingOverlap(a,b))))bad.push('drawn dining pieces intersect green sofa');
  const t=table.box,s=sofa.box,k=kitchen.box,sofaRight=s.x+s.hl,tableLeft=t.x-t.hl,tableRight=t.x+t.hl,kitchenLeft=k.x-Math.abs(k.c)*k.hl-Math.abs(k.s)*k.hw;
  if(tableLeft-sofaRight<.6-1e-8||kitchenLeft-tableRight<.6-1e-8)bad.push('sofa/table/kitchen leave less than 60cm clearance');
  const chair=room.props.find(p=>p.seat&&p.y>t.y&&Math.abs(p.y-t.y-1.2)<1e-8);
  if(!chair||Math.abs(chair.x-t.x)>1e-8||chair.fy!==-1)bad.push('dining chair no longer aligns with table');
  for(const x of [(sofaRight+tableLeft)/2,(tableRight+kitchenLeft)/2]){
   px=x;py=7.5;const start=py;if(!free(px,py))bad.push('corridor starts inside furniture');
   for(let i=0;i<50;i++)move(0,.1);if(Math.abs(py-start-5)>1e-8)bad.push('cannot walk beside dining table');
   for(let i=0;i<50;i++)move(0,-.1);if(Math.abs(py-start)>1e-8)bad.push('cannot return beside dining table');
  }
  const fridge=room.props.find(p=>p.kitchenAppliance?.kind==='fridge'),front=[fridge.x-fridge.box.hw-.65,fridge.y];
  if(!free(...front)||!roomPath(...room.def.entry.slice(0,2),...front).length)bad.push('entry route to fridge blocked');
  px=15.8;py=12.7;for(let i=0;i<23;i++)move(-.1,0);if(Math.abs(px-13.5)>1e-8)bad.push('cannot walk behind dining chair to fridge');
  for(const tier of [0,1]){const def=tier?ROOM_DEFS.hotelroom:ROOM_DEFS.motelRoom;enterRoom('hotelroom',{lobby:{word:tier?'HOTEL':'MOTEL',ret:[100,100,0]}},def.entry);
   const dining=room.props.filter(p=>p.box?.hw===.55&&p.box.z1===.78);if(tier?dining.length!==1||dining[0].x!==8:dining.length!==0)bad.push('other hotel tier dining layout changed');}
  return bad;
 });assert.deepEqual(r,[]);
}));

test('real C uses the Grand suite dining chair and green sofa, and E still reaches its kitchen and TV',()=>fixture(async page=>{
 await page.evaluate(()=>{const t=room.props.find(p=>p.box?.hl===1.1&&p.box.hw===.55&&p.box.z1===.78);window.suiteDining={x:t.x,y:t.y};px=t.x-.9;py=t.y+1.2;a=0;render(0);});
 assert.equal(await page.evaluate(()=>free(px,py)),true);
 await page.keyboard.press('c');
 assert.deepEqual(await page.evaluate(()=>({seat:!!body.seat,aligned:Math.abs(px-window.suiteDining.x)<1e-8&&Math.abs(py-window.suiteDining.y-1.2)<1e-8,facing:Math.sin(a)<-.999})),{seat:true,aligned:true,facing:true});
 await page.keyboard.press('c');assert.equal(await page.evaluate(()=>!body.seat&&free(px,py)),true);
 await page.evaluate(()=>{const s=room.props.filter(p=>p.seat&&Math.abs(p.y-11.04)<1e-8).sort((a,b)=>b.x-a.x)[0];window.suiteSofaSeat=[s.x,s.y];px=s.x;py=s.y+1.06;render(0);});
 assert.equal(await page.evaluate(()=>free(px,py)),true);await page.keyboard.press('c');
 assert.equal(await page.evaluate(()=>!!body.seat&&Math.hypot(px-window.suiteSofaSeat[0],py-window.suiteSofaSeat[1])<1e-8),true);await page.keyboard.press('c');
 await page.evaluate(()=>{px=15.62;py=10;a=Math.atan2(room.def.hotelAmenities.stove[1]-py,room.def.hotelAmenities.stove[0]-px);render(0);});
 assert.equal(await page.evaluate(()=>free(px,py)),true);assert.match(await page.evaluate(()=>promptText()),/cook/);await page.keyboard.press('e');
 assert.equal(await page.evaluate(()=>cookCtx?.on==='stove'&&cookEl.style.display==='flex'),true);await page.keyboard.press('e');
 await page.evaluate(()=>{px=9.7;py=9.2;a=Math.atan2(room.def.hotelAmenities.tv[1]-py,room.def.hotelAmenities.tv[0]-px);render(0);});assert.equal(await page.evaluate(()=>free(px,py)),true);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>room.tv),true);
 assert.equal(await page.evaluate(()=>room.bathroomDoors.every(p=>p.bathroomDoor.pub&&p.bathroomDoor.open===0)),true);
}));
