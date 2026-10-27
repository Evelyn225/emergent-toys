'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(id,run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(id=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;money=500000;env(0);render(0);const point=id==='home_island'?FERN_HOUSE.door:citySourcePoint(41,73),purchase=buyProperty(id,...point);if(!purchase[0])throw Error(purchase[1]);const h=owned.homes.at(-1),kind=homeRoomKind(id);enterRoom(kind,{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[...point,0]},ROOM_DEFS[kind].entry);render(0);},id);
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('furniture and workshop refresh retain native bathroom geometry, partial private door state and living/dead figures in all four owned homes',async()=>{
 for(const id of ['home_studio','home_loft','home_belle','home_island'])await fixture(id,async p=>{
  const r=await p.evaluate(()=>{
   const structural=room.props.filter(p=>p.bathroomOpening||p.bathroomDoor||p.bathroomAccessory),door=room.bathroomDoors[0],d=door.bathroomDoor,bad=[];
   if(structural.length<4||d.pub)bad.push('missing private native fixtures');
   bathroomDoorUse(door);stepBathroomDoors(.15);const state={open:d.open,target:d.target,box:door.box};
   if(!(d.open>0&&d.open<1))bad.push('fixture did not partially close');
   const living=standing(2,8,GREEN),dead=standing(3,8,BRICK);killRoomFigure(dead,1,0);dead.looted=true;room.props.push(living,dead);
   const h=homeRecord(),w=workshopState(h);w.parts.push({id:'bench',key:1,x:6,y:8,a:0});
   for(const refresh of [refreshFurnishedRoom,refreshWorkshopRoom,refreshFurnishedRoom,refreshWorkshopRoom]){
    refresh();
    if(structural.some(p=>room.props.filter(q=>q===p).length!==1))bad.push('native structural object lost/duplicated');
    if(room.props.filter(p=>p.bathroomOpening||p.bathroomDoor||p.bathroomAccessory).length!==structural.length)bad.push('native structure count changed');
    if(room.bathroomDoors[0]!==door||d.open!==state.open||d.target!==state.target||door.box!==state.box)bad.push('private animation state reset');
    if(room.props.filter(p=>p===living).length!==1||room.props.filter(p=>p===dead).length!==1||!dead.dead||!dead.looted)bad.push('figure identity/death/loot lost');
    if(!room.props.some(p=>p.box?.z0===.83&&p.box.z1===.93))bad.push('workshop not rebuilt');
   }
   stepBathroomDoors(2);if(d.open!==0||free(door.x,door.y))bad.push('refreshed shut leaf has no collision');
   return bad;
  });assert.deepEqual(r,[],id);
 });
});

async function aimDoor(p){return p.evaluate(()=>{const prop=room.bathroomDoors[0],d=prop.bathroomDoor,c=d.vertical?0:1,s=d.vertical?1:0,width=d.end-d.start,offset=d.dir*(d.open>.85?width/2-.06:width*d.open/2);px=prop.x-s*1.05;py=prop.y+c*1.05;a=Math.atan2(prop.y+s*offset-py,prop.x+c*offset-px);pitch=0;render(0);return{prompt:promptText(),free:free(px,py)};});}
async function intact(p){assert.equal(await p.evaluate(()=>window.nativeFixtures.every(q=>room.props.filter(p=>p===q).length===1)&&room.bathroomDoors.every(p=>room.props.includes(p))),true);}

test('real furniture move/pack/unpack keeps Fern bathroom rendering, E passage and saved privacy',()=>fixture('home_island',async p=>{
 await p.evaluate(()=>{window.nativeFixtures=room.props.filter(p=>p.bathroomOpening||p.bathroomDoor||p.bathroomAccessory);buy('f_lamp');px=18;py=19;a=0;pitch=0;render(0);});
 await p.keyboard.press('q');assert.equal(await p.evaluate(()=>furnishingCandidate().ok),true);await p.keyboard.press('e');await intact(p);
 await p.keyboard.press('f');await p.locator('[data-move="1"]').click();await p.evaluate(()=>{px=18;py=20;a=0;render(0);});await p.keyboard.press('e');await intact(p);
 assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].y),20);
 await p.keyboard.press('f');await p.locator('[data-pack="1"]').click();await intact(p);assert.equal(await p.evaluate(()=>room.props.filter(p=>p.furnishingKey===1).length),0);await p.keyboard.press('e');
 await p.keyboard.press('f');await p.locator('[data-place]').first().click();await p.keyboard.press('e');await intact(p);
 assert.equal(await p.evaluate(()=>room.props.filter(p=>p.furnishingKey===2).length),1);
 assert.match((await aimDoor(p)).prompt,/close bathroom door/);await p.keyboard.press('e');await p.evaluate(()=>stepBathroomDoors(2));
 const closed=await p.evaluate(()=>{const door=room.bathroomDoors[0],draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{door.draw(door.x,door.y);}finally{drawBox=draw;}
  return{open:door.bathroomDoor.open,blocked:!free(door.x,door.y),visible:shapes.some(p=>p.box.z0===.04&&p.box.z1===2.16),through:interactionClear(door.x,door.y-1.05,1.5)};});
 assert.deepEqual(closed,{open:0,blocked:true,visible:true,through:false});
 assert.match((await aimDoor(p)).prompt,/open bathroom door/);await p.keyboard.press('e');await p.evaluate(()=>stepBathroomDoors(2));assert.equal(await p.evaluate(()=>free(room.bathroomDoors[0].x,room.bathroomDoors[0].y)),true);
 assert.equal(await p.evaluate(()=>{const d=room.bathroomDoors[0].bathroomDoor,c=d.vertical?0:1,s=d.vertical?1:0,x=px,y=py;for(let i=0;i<21;i++)move(s*.1,-c*.1);const crossed=Math.hypot(px-x,py-y)>2.09;for(let i=0;i<21;i++)move(-s*.1,c*.1);return crossed&&Math.hypot(px-x,py-y)<1e-8;}),true);
 await aimDoor(p);await p.keyboard.press('e');await p.evaluate(()=>{stepBathroomDoors(2);refreshWorkshopRoom();saveGame();});await intact(p);
 await p.reload();const saved=await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();return{open:room.bathroomDoors[0].bathroomDoor.open,blocked:!free(room.bathroomDoors[0].x,room.bathroomDoors[0].y),furnishings:homeFurnishings(homeRecord()).parts.length};});assert.deepEqual(saved,{open:0,blocked:true,furnishings:1});
}));
