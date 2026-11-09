'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=20;tod=14;env(0);render(0);clearWanted();reports.length=0;const door=doors.find(d=>!map[idx(d.x,d.y)]&&!isWater(d.x,d.y)&&!solidAt(d.x,d.y,.025));window.testExit=[door.x,door.y,Math.atan2(door.ny,door.nx)];});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('shooting someone in a cafe makes surviving staff and guests flee and report the murder',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('cafe',{word:'CAFE',ret:testExit.slice()},[CAFE_BAR.x,4,-Math.PI/2]);
  const victim=room.props.find(p=>roomWitness(p)&&Math.hypot(p.x-CAFE_BAR.x,p.y-CAFE_BAR.keeperY)<.1);
  px=victim.x;py=victim.y+2;a=-Math.PI/2;pitch=0;render(0);
  clearInventory();carryItem({id:'revolver',uses:6});held=0;gun.cool=gun.reload=0;
  const before=people.length,shot=fireGun(px,py,1.65,a,0,true),r=room;
  const survivors=r.props.filter(roomWitness),started=survivors.every(p=>p.roomFlee?.path.length),first=survivors[0],from=[first.x,first.y];
  for(let j=0;j<4;j++){T+=.05;stepGun(.05);stepBathroomDoors(.05);}
  const moving=Math.hypot(first.x-from[0],first.y-from[1])>.1;
  const report=reports.find(r=>r.kind==='murder'),doorReport=report?.x===testExit[0]&&report?.y===testExit[1];
  const count=reports.length;gun.cool=0;fireGun(px,py,1.65,0,0,true);const noSpam=reports.length===count;
  for(let j=0;j<600;j++){T+=.05;stepRoomPanic(.05);stepBathroomDoors(.05);}
  stepCrime(0);const dispatched=wanted.stars>0&&reports.length===0;
  return {dispatched,what:shot.what,dead:victim.dead,started,moving,doorReport,noSpam,escaped:survivors.every(p=>p.hidden),outside:people.length-before,expected:survivors.length,keeper:nearKeeper()};
 });assert.equal(r.what,'person');assert.ok(r.dead&&r.started&&r.moving&&r.doorReport&&r.noSpam&&r.escaped&&r.dispatched,JSON.stringify(r));assert.equal(r.outside,r.expected);assert.equal(r.keeper,false);
}));
test('witnesses route around counters, tables and cinema seats in real interiors',()=>fixture(async p=>{
 const results=await p.evaluate(()=>{
  const out=[];
  for(const [kind,word]of [['store','24/7'],['bar','BAR'],['diner','DINER'],['cinema','CINEMA'],['hospital','HOSPITAL'],['tea','TEA HOUSE']]){
   ROOM_PANICS.clear();enterRoom(kind,{word,ret:testExit.slice()},[5,5,0]);
   const count=panicInRoom('gunfire'),actors=room.props.filter(p=>p.roomFlee),unrouted=actors.filter(p=>!p.roomFlee.path.length).length;
   for(let j=0;j<600;j++){T+=.05;stepRoomPanic(.05);stepBathroomDoors(.05);}
   out.push({kind,count,unrouted,left:actors.filter(p=>!p.hidden).length});
  }return out;
 });for(const r of results){assert.ok(r.count>0,JSON.stringify(r));assert.equal(r.unrouted,0,JSON.stringify(r));assert.equal(r.left,0,JSON.stringify(r));}
}));
test('escape opens a closed bathroom door and continues after the player leaves',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('cafe',{word:'CAFE',ret:testExit.slice()},[5,5,0]);
  let spot=null;for(let y=1.5;y<3;y+=.25)for(let x=10.25;x<12;x+=.25)if(roomOpen(x,y))spot=[x,y];
  const witness=standing(...spot,GREEN);room.props.push(witness);
  const door=room.bathroomDoors[0],closed=door.bathroomDoor.open===0,before=people.length;
  panicInRoom('gunfire');const path=witness.roomFlee.path.length,old=room;
  mode='walk';room=null;px=100;py=100;
  for(let j=0;j<600;j++){T+=.05;stepRoomPanic(.05);}
  return {closed,path,escaped:witness.hidden,doorOpen:door.bathroomDoor.open===1,outside:people.length>before,restored:room===null&&mode==='walk',left:old.props.filter(p=>p.roomFlee&&!p.hidden).length};
 });assert.ok(r.closed&&r.path>0&&r.escaped&&r.doorOpen&&r.outside&&r.restored,JSON.stringify(r));assert.equal(r.left,0);
}));
test('animals, mannequins and empty rooms do not invent human witness calls; remote shots panic without blaming the observer',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('store',{word:'24/7',ret:testExit.slice()},[5,5,0]);
  const human=room.props.find(roomWitness);human.dead=true;
  room.props.push({...standing(4,4,GREEN),still:true},{...standing(5,4,GREEN),cutout:true});
  const noWitnesses=panicInRoom('murder')===0&&reports.length===0;
  human.dead=false;
  const peer={id:'shooter',name:'Shooter'},data={x0:4,y0:4,z0:1.5,x:5,y:5,z:1.5,rk:netRoomKey(),what:'wall'};
  netGunMessage('shot',data,'shooter',peer,10);
  return {noWitnesses,panics:!!human.roomFlee,noBlame:reports.length===0&&wanted.stars===0};
 });assert.ok(r.noWitnesses&&r.panics&&r.noBlame,JSON.stringify(r));
}));
