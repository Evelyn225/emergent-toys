'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;room=me=freecam=null;mode='walk';body.z=body.vz=0;env(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('home TV cabinets leave the full bedroom-to-lounge doorway approach clear',()=>fixture(async p=>{
 const r=await p.evaluate(()=>[['loft',7],['bellehome',8],['islandhome',10]].map(([kind,wall])=>{
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);
  const clear=roomWalkLine(5.5,wall-.5,5.5,wall+2.5),tv=room.props.find(p=>p.box&&p.box.z0===.61&&p.box.z1===1.55);
  return{kind,clear,offDoor:Math.abs(tv.x-5.5)>tv.box.hl+.2};
 }));for(const q of r)assert.ok(q.clear&&q.offDoor,JSON.stringify(q));
}));
test('Fern bathroom sign sits beside its doorway and wood panelling stays fixed when the player enters',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);render(0);
  const sample=(x,y)=>{px=x;py=y;fernRoomWall(0,3,.01,.5,3,2,10,8);return[BG[0],CH[0]];};
  const outside=sample(15,8),inside=sample(20,3),[sx,sy]=room.def.wc.sign;
  return{outside,inside,sign:room.grid[sy][sx],beside:sy===6&&sx===21};
 });assert.deepEqual(r.inside,r.outside);assert.ok(r.beside&&r.sign==='W');
}));
test('Fern worktop has a real sink recess, a closed bevel and a supported fridge clear of its wall',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);render(0);
  const kitchen=room.props.find(p=>p.box?.x===15.35),fridge=room.props.find(p=>p.box?.z1===1.9),draw=drawBox,shapes=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{kitchen.draw(kitchen.x,kitchen.y);}finally{drawBox=draw;}
  const top=(x,y)=>Math.max(-Infinity,...shapes.map(s=>{const t=s.ray(x,y,2,0,0,-1,s.box);return t>0&&s.shade(0,t,1)!==false?2-t:-Infinity;}));
  const worktop=shapes.find(s=>s.ray===homeRayWorktop),hit=worktop.ray(15.35,2.5,1.02,0,-1,-.08,worktop.box),normal=Math.hypot(HIT.nx,HIT.ny,HIT.nz);
  return{basin:top(14.45,1.42),counter:top(15.35,1.6),hit:hit>0,normal,fridgeWall:fridge.box.y-fridge.box.hw,approach:free(11.6,2.6)};
 });assert.ok(r.basin>.78&&r.basin<.82&&Math.abs(r.counter-.95)<1e-8,JSON.stringify(r));assert.ok(r.hit&&Math.abs(r.normal-1)<1e-8);assert.ok(r.fridgeWall>=1&&r.approach,JSON.stringify(r));
}));
