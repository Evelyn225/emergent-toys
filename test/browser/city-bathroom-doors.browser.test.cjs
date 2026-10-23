'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run,mobile=false){const p=await browser.newPage(mobile?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;room=me=freecam=null;mode='walk';body.z=body.vz=0;env(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
async function aim(p,side){return p.evaluate(side=>{const prop=room.bathroomDoors[0],d=prop.bathroomDoor,c=d.vertical?0:1,s=d.vertical?1:0,width=d.end-d.start,offset=d.open>.85?width/2-.06:width*d.open/2;px=prop.x-s*side*1.05;py=prop.y+c*side*1.05;a=Math.atan2(prop.y+s*offset-py,prop.x+c*offset-px);pitch=0;render(0);return{prompt:promptText(),free:free(px,py)};},side);}
test('real E opens and closes privacy doors from either side, matching passage and sight collision',()=>fixture(async p=>{
 await p.evaluate(()=>enterRoom('bar',{ret:[100,100,0]},[6,3,0]));
 for(const side of [-1,1]){
  const r=await aim(p,side);assert.ok(r.free,JSON.stringify(r));assert.match(r.prompt,/close bathroom door/);
  await p.keyboard.press('e');
  const shut=await p.evaluate(()=>{stepBathroomDoors(2);const prop=room.bathroomDoors[0];return{open:prop.bathroomDoor.open,blocked:!free(prop.x,prop.y),through:interactionClear(prop.x,prop.y+(py<prop.y?1.1:-1.1),1.5)};});
  assert.deepEqual(shut,{open:0,blocked:true,through:false});
  assert.match((await aim(p,side)).prompt,/open bathroom door/);await p.keyboard.press('e');
  const open=await p.evaluate(()=>{stepBathroomDoors(2);const prop=room.bathroomDoors[0];return{open:prop.bathroomDoor.open,clear:free(prop.x,prop.y)};});assert.deepEqual(open,{open:1,clear:true});
 }
}));
test('a closing pocket door reopens around a person, and its rail cannot show through the opaque shut leaf',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bar',{ret:[100,100,0]},[2.5,3,Math.PI/2]);const prop=room.bathroomDoors[0],d=prop.bathroomDoor;
  px=prop.x;py=prop.y;bathroomDoorUse(prop);stepBathroomDoors(2);const safe=d.target===1&&free(px,py);
  px=2.5;py=3;bathroomDoorUse(prop);stepBathroomDoors(2);
  const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{prop.draw(prop.x,prop.y);}finally{drawBox=draw;}
  const rail=shapes.find(s=>s.box.z0===2.16),leaf=shapes.find(s=>s.box.z0===.04&&s.box.z1===2.16);
  let holes=0;for(const sign of [-1,1])for(let z=.1;z<2.15;z+=.04)for(let x=2.15;x<2.9;x+=.05){const t=leaf.ray(x,prop.y+sign,z,0,-sign,0,leaf.box);if(t<0||leaf.shade(0,t,5)===false)holes++;}
  return{safe,holes,closed:d.open===0,railAbove:rail.box.z0>=leaf.box.z1};
 });assert.deepEqual(r,{safe:true,holes:0,closed:true,railAbove:true});
}));
test('home bathroom privacy state survives leave/re-entry and save/reload',()=>fixture(async p=>{
 await p.evaluate(()=>{money=20000;buyProperty('home_island',...FERN_HOUSE.door);[px,py]=FERN_HOUSE.door;interact();const prop=room.bathroomDoors[0];px=20;py=8;bathroomDoorUse(prop);stepBathroomDoors(2);leaveRoom();[px,py]=FERN_HOUSE.door;interact();});
 assert.equal(await p.evaluate(()=>room.bathroomDoors[0].bathroomDoor.open),0);
 await p.evaluate(()=>saveGame());await p.reload();
 const r=await p.evaluate(()=>{paused=false;[px,py]=FERN_HOUSE.door;interact();const prop=room.bathroomDoors[0];return{open:prop.bathroomDoor.open,blocked:!free(prop.x,prop.y)};});assert.deepEqual(r,{open:0,blocked:true});
}));

test('phone E uses the same bathroom door target and action',()=>fixture(async p=>{
 await p.evaluate(()=>enterRoom('bar',{ret:[100,100,0]},[2.5,3.4,Math.PI/2]));await aim(p,-1);await p.evaluate(()=>showTouch());
 await p.tap('#touch [data-key="KeyE"]');
 assert.equal(await p.evaluate(()=>room.bathroomDoors[0].bathroomDoor.target),0);
 await p.evaluate(()=>{stepBathroomDoors(2);render(0);showTouch();});
 await p.tap('#touch [data-key="KeyE"]');assert.equal(await p.evaluate(()=>room.bathroomDoors[0].bathroomDoor.target),1);
},true));

test('closed privacy doors remain routable and an approaching pursuing officer opens them',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bar',{ret:[100,100,0]},[2.5,3,Math.PI/2]);const prop=room.bathroomDoors[0];bathroomDoorUse(prop);stepBathroomDoors(2);
  const closed=prop.bathroomDoor.open===0,path=roomPath(2.5,3,2.5,5.5),blocked=!free(prop.x,prop.y);
  wanted.stars=2;searchedRoom=room;roomCops.push({x:2.5,y:3.4});stepBathroomDoors(2);
  return{closed,path:path.length,blocked,open:prop.bathroomDoor.open,clear:free(prop.x,prop.y)};
 });assert.ok(r.closed&&r.blocked&&r.path>0&&r.open===1&&r.clear,JSON.stringify(r));
}));
