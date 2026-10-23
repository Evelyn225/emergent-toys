'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);
 await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;env(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('fitted home and hotel kitchens have recessed sinks, sealed tops and correctly rotated bevel normals',()=>fixture(async p=>{
 const r=await p.evaluate(()=>['home','loft','bellehome','hotelroom','hotelSuite'].map(kind=>{
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);
  const model=room.props.find(p=>p.kitchen),d=model.kitchen,c=Math.cos(d.angle),s=Math.sin(d.angle),draw=drawBox,shapes=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
  const at=(u,v)=>[model.x+c*u-s*v,model.y+s*u+c*v];
  const top=(u,v)=>{const[x,y]=at(u,v);return Math.max(-Infinity,...shapes.map(q=>{
   const t=q.ray(x,y,2,0,0,-1,q.box);return t>0&&q.shade(0,t,6)!==false?2-t:-Infinity;
  }));};
  const slab=shapes.find(q=>q.ray===homeRayWorktop&&Math.abs(q.box.z1-d.height)<1e-8),[x,y]=at(0,d.depth+1);
  const hit=slab.ray(x,y,.9,s,-c,0,slab.box),normal=[HIT.nx,HIT.ny,HIT.nz];
  return{kind,basin:top(d.sink,0),rim:top(d.sink+d.radius*.98,0),top:top(d.compact?0:d.hl-.12,-.04),height:d.height,hit,normal,front:[-s,c,0]};
 }));
 for(const q of r){assert.ok(q.basin>.77&&q.basin<.79&&q.rim>.94,JSON.stringify(q));assert.ok(Math.abs(q.top-q.height)<1e-8,JSON.stringify(q));
  assert.ok(q.hit>0&&q.normal.every((v,k)=>Math.abs(v-q.front[k])<1e-8),JSON.stringify(q));}
}));
test('kitchen appliances face their clear approaches, stay out of walls and preserve room routes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>['home','loft','bellehome','hotelroom','hotelSuite','islandhome'].map(kind=>{
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);
  const bad=[],stove=room.def.spots?.stove||room.def.hotelAmenities.stove,fridge=room.props.find(p=>p.kitchenAppliance?.kind==='fridge'),b=fridge.box;
  for(const prop of room.props.filter(p=>p.kitchen||p.kitchenAppliance))for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)
   if('#W'.includes(room.grid[y][x])&&furnishingOverlap(prop.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
  const angle=fridge.kitchenAppliance.angle,c=Math.cos(angle),s=Math.sin(angle),front=[fridge.x-s*(b.hw+.65),fridge.y+c*(b.hw+.65)];
  const approach=room.def.spots?stove:[stove[0]-1,stove[1]],start=room.def.entry||[room.W/2,room.H-1.6];
  return{kind,bad,fridge:free(...front),stove:free(...approach),fridgeRoute:roomPath(start[0],start[1],...front).length,stoveRoute:roomPath(start[0],start[1],...approach).length};
 }));
 for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.ok(q.fridge&&q.stove&&q.fridgeRoute>0&&q.stoveRoute>0,JSON.stringify(q));}
}));
test('cooking lights physical hob elements or the oven glass while cupboard cases stay unlit',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('loft',{ret:[100,100,0]},ROOM_DEFS.loft.entry);const model=room.props.find(p=>p.kitchen),d=model.kitchen;
  const sample=recipe=>{
   game=recipe?{g:{id:'cook'}}:null;cookCtx=recipe?{on:'stove',recipe}:null;
   const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(model.x,model.y);}finally{drawBox=draw;}
   const c=Math.cos(d.angle),s=Math.sin(d.angle),color=(q,u,v,z,rx,ry,rz)=>{
    const t=q.ray(q.box.x+c*u-s*v,q.box.y+s*u+c*v,z,rx,ry,rz,q.box);q.shade(0,t,6);return BG[0];
   };
   const ring=shapes.find(q=>Math.abs(q.box.z0-d.height-.014)<1e-8),cab=shapes.find(q=>q.box.z0===.09),glass=shapes.find(q=>q.box.z0===.23);
   return{ring:color(ring,ring.box.hl*.9,0,2,0,0,-1),cab:color(cab,d.hl-.1,1,.4,s,-c,0),glass:color(glass,0,1,.415,s,-c,0)};
  };
  try{return{off:sample(null),pan:sample('friedeggs'),oven:sample('jacketpotato'),offAgain:sample(null),red:RED,orange:ORANGE};}finally{game=cookCtx=null;}
 });
 assert.equal(r.off.cab,r.pan.cab);assert.equal(r.off.cab,r.oven.cab);assert.deepEqual(r.off,r.offAgain);
 assert.notEqual(r.off.ring,r.pan.ring);assert.equal(r.pan.ring>>4,r.red);assert.equal(r.oven.glass>>4,r.orange);assert.equal(r.oven.ring,r.off.ring);
}));
test('real E still opens each owned home fridge and cooks with its saved pantry at the fitted stove',()=>fixture(async p=>{
 for(const [id,kind] of [['home_studio','home'],['home_loft','loft'],['home_belle','bellehome']]){
  const r=await p.evaluate(({id,kind})=>{
   mode='walk';room=null;money=500000;clearWanted();
   const purchase=buyProperty(id,...citySourcePoint(41,73));if(!purchase[0])throw Error(purchase[1]);
   const home=owned.homes.at(-1);home.fridge.push({id:'butter',uses:0});
   enterRoom(kind,{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[100,100,0]},ROOM_DEFS[kind].entry);
   [px,py]=room.def.spots.fridge;const model=room.props.find(p=>p.kitchenAppliance);a=Math.atan2(model.y-py,model.x-px);render(0);
   return{free:free(px,py),prompt:promptText()};
  },{id,kind});assert.ok(r.free,kind);assert.equal(r.prompt,'E: open fridge');
  await p.keyboard.press('e');assert.ok(await p.evaluate(()=>panelOpen()),kind);await p.keyboard.press('e');
  await p.evaluate(()=>{[px,py]=room.def.spots.stove;a=0;render(0);});
  assert.equal(await p.evaluate(()=>promptText()),'E: cook');await p.keyboard.press('e');
  assert.ok(await p.evaluate(()=>cookCtx?.pantry===homeRecord().fridge&&cookEl.style.display==='flex'&&cookCtx.pantry[0].id==='butter'),kind);
  await p.keyboard.press('e');
 }
}));
