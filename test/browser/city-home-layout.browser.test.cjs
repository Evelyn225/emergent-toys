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
test('Fern glass renders the real dock side with moving objects, caches views and preserves the room camera',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('islandhome',{ret:[...FERN_HOUSE.door,Math.PI]},[4.5,21.5,Math.PI/2]);pitch=0;T=30;tod=12;env(0);
  const inside=room,cell=CITY.cell,sprites=CITY.sprites,buffers=[CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL],saved=[px,py,a,pitch];
  let markerY=244.75;
  CITY.sprites=()=>{sprites();drawBox(boxAt(538.5-px,markerY-py,1,0,.08,.08,.05,.27),(i,t,L)=>{BG[i]=C(MAG,10);set(i,'Q',C(MAG,14));return true;});};
  const sample=()=>{const pixels=(COVE_VIEW.marks.get('south')||[]).filter(([i,d])=>Math.abs(ZB[i]-d)<.0001&&CH[i]==='Q').map(([i])=>i%cols);return {count:pixels.length,mean:pixels.reduce((a,b)=>a+b,0)/Math.max(1,pixels.length)};};
  try{
   render(0);const first=sample(),passes=COVE_VIEW.passes;render(0);const cached=COVE_VIEW.passes===passes;
   markerY+=.15;T+=.1;render(0);const moved=sample();
   const unchanged=mode==='room'&&room===inside&&[px,py,a,pitch].every((v,k)=>v===saved[k])&&CITY.cell===cell&&buffers.every((b,k)=>b===[CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL][k])&&!COVE_VIEW.active;
   const frames=FERN_WINDOWS.map(w=>{const e=fernExteriorWindow(w);return {width:Math.abs(w.half-e.half*10),z:Math.abs(w.top-e.top*10),attached:Math.abs(e.x-FERN_HOUSE.x0)<1e-8||Math.abs(e.x-FERN_HOUSE.x1)<1e-8||Math.abs(e.y-FERN_HOUSE.y0)<1e-8||Math.abs(e.y-FERN_HOUSE.y1)<1e-8};});
   return{first,moved,cached,unchanged,frames};
  }finally{CITY.sprites=sprites;}
 });
 assert.ok(r.first.count>20&&r.moved.count>10&&Math.abs(r.first.mean-r.moved.mean)>2,JSON.stringify(r));assert.ok(r.cached&&r.unchanged,JSON.stringify(r));for(const f of r.frames)assert.ok(f.attached&&f.width<1e-8&&f.z<1e-8);
}));
test('Fern has one dock-facing entrance and old saved property doors resolve to that front',()=>fixture(async p=>{
 await p.evaluate(()=>{money=20000;buyProperty('home_island',...FERN_HOUSE.door);[px,py]=FERN_HOUSE.door;a=0;render(0);});
 await p.keyboard.press('e');
 assert.equal(await p.evaluate(()=>room?.kind),'islandhome');
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>mode),'walk');
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>room?.kind),'islandhome');
 const r=await p.evaluate(()=>{
  const h=homeRecord(),old=[540.5,247.2];leaveRoom();const front=near(px,py,...FERN_HOUSE.door)<1e-8;
  h.door=old;const meeting=buyerDoor(h);saveGame();
  [px,py]=old;interact();const oldClosed=mode==='walk';
  [px,py]=FERN_HOUSE.terrace;interact();const backClosed=mode==='walk';
  [px,py]=FERN_HOUSE.door;interact();const gridClosed=room.grid[16][0]==='#',door=[...FERN_HOUSE.door];
  return{front,oldClosed,backClosed,gridClosed,meeting,door,trail:near(...FERN_TRAILS[0].at(-1),...door)<1e-8};
 });
 assert.ok(r.front&&r.oldClosed&&r.backClosed&&r.gridClosed&&r.trail,JSON.stringify(r));assert.deepEqual(r.meeting,r.door);
 await p.reload();assert.deepEqual(await p.evaluate(()=>owned.homes.find(h=>h.kind==='home_island').door),r.door);
}));

test('Fern bathroom perimeter walls stay tiled from either side of its doorway',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);render(0);
  const sample=(x,y,mx)=>{px=x;py=y;roomWall(0,mx+.4,.01,.5,3.4,3,1,mx,0,1,false);return BG[0]>>4;};
  return{outside:sample(20,8,20),inside:sample(20,3,20),bedroom:sample(20,3,3),white:WHITE,wood:BRICK};
 });assert.equal(r.outside,r.white);assert.equal(r.inside,r.white);assert.equal(r.bedroom,r.wood);
}));
