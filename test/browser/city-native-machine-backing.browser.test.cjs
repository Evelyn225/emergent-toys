'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=12;tod=12;body.z=body.vz=0;clearWanted();env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('all native vending machines retain a real wall backing and usable front, with only the fourteen orphan mounts relocated',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof NATIVE_MACHINE_PLACEMENT==='undefined')return {bad:['no finished-world mount repair']};
  const bad=[];for(const m of machines){const fx=-m.s*m.fs,fy=m.c*m.fs;
   if(!map[idx(m.x-fx*.1,m.y-fy*.1)]||map[idx(m.x+fx*.3,m.y+fy*.3)])bad.push([m.kind,'orphan mount or blocked front',m.x,m.y]);
  }
  for(const {o,before,distance}of NATIVE_MACHINE_PLACEMENT.moved){const fx=-o.s*o.fs,fy=o.c*o.fs;
   if(!machines.includes(o)||o.kind!==before.kind||distance>16||distance<.01||!ROAD[idx(o.x,o.y)]||isWater(o.x,o.y))bad.push('machine lost identity or left its native street');
   if(!streetFixtureClear(o,'machine')||!streetEntranceFixtureClear(o,'machine')||elStairLocal(o.x,o.y)||stations.some(s=>Math.hypot(rel(s.x-o.x),rel(s.y-o.y))<.7))bad.push('new mount conflicts with structure, entrance or transit');
   const front={x:o.x+fx*.15,y:o.y+fy*.15,c:1,s:0,hl:.025,hw:.025,z0:0,z1:.2};
   if(streetGeometryCollision(front,true)||streetEntranceCollision(front))bad.push('no room to stand in front');
   for(const [items,kind]of [[lamps,'lamp'],[lights,'signal'],[trees,'tree'],[benches,'bench'],[machines,'machine'],[vendors,'vendor'],[extras.filter(p=>p.bike!=null),'bike']])for(const p of items)
    if(p!==o&&Math.abs(rel(p.x-o.x))<1&&Math.abs(rel(p.y-o.y))<1&&streetFixtureBoxes(p,kind).some(a=>[...streetFixtureBoxes(o,'machine'),front].some(b=>streetBoxesOverlap(a,b,0))))bad.push(['machine overlaps actual fixture',kind]);
  }
  for(let i=0;i<machines.length;i++)for(let j=i+1;j<machines.length;j++)if(Math.abs(rel(machines[i].x-machines[j].x))<.2&&Math.abs(rel(machines[i].y-machines[j].y))<.2&&streetFixtureBoxes(machines[i],'machine').some(a=>streetFixtureBoxes(machines[j],'machine').some(b=>streetBoxesOverlap(a,b,0))))bad.push('machines overlap');
  return {bad:bad.slice(0,10),count:machines.length,moved:NATIVE_MACHINE_PLACEMENT.moved.length,unfitted:NATIVE_MACHINE_PLACEMENT.unfitted.length};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,448);assert.equal(r.moved,14);assert.equal(r.unfitted,0);
}));

test('relocated machines keep exact live buckets and collision, and their actual controls face out of the new wall',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof NATIVE_MACHINE_PLACEMENT==='undefined')return ['no native machine mount repair'];
  const bad=[];if(machinesB.flat().length!==machines.length||machines.some(m=>!machinesB[bi(Math.floor(m.x/8),Math.floor(m.y/8))].includes(m)))bad.push('stale machine spatial index');
  const draw=drawBox;
  try{for(const {o}of NATIVE_MACHINE_PLACEMENT.moved){const fx=-o.s*o.fs,fy=o.c*o.fs;px=o.x+fx*.2;py=o.y+fy*.2;
   if(!machineAt(o.x,o.y,0))bad.push('new machine body has no collision');
   const boxes=[];drawBox=b=>boxes.push({...b});drawVending(o,...R(o.x,o.y));
   const q=boxes.find(b=>b.vmRole==='delivery-top');
   if(!q||Math.abs((q.x+px-o.x)*fx+(q.y+py-o.y)*fy-.031)>1e-8||Math.abs(q.c*o.c+q.s*o.s)<.99)bad.push('actual control geometry still faces old mount');
  }}finally{drawBox=draw;}
  return bad;
 });assert.deepEqual(r,[]);
}));

test('walking to a remounted machine and real E still opens its original stock and buys an item',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof NATIVE_MACHINE_PLACEMENT==='undefined')return {bad:'no mount repair'};
  cars.length=0;for(const p of people)p.hidden=true;money=100;inv.length=0;
  const o=NATIVE_MACHINE_PLACEMENT.moved.find(q=>q.o.kind==='DRINKS').o,fx=-o.s*o.fs,fy=o.c*o.fs;
  px=o.x+fx*.27;py=o.y+fy*.27;a=Math.atan2(-fy,-fx);pitch=0;for(let k=0;k<4;k++)move(-fx*.03,-fy*.03);render(0);
  return {free:free(px,py),near:nearMachine()===o,kind:o.kind,title:VENDING[o.kind].title,item:VENDING[o.kind].stock[0],price:ITEMS[VENDING[o.kind].stock[0]].price,prompt:promptText()};
 });assert.ok(r.free&&r.near,JSON.stringify(r));assert.match(r.prompt,/machine/);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>panelOpen()),true);assert.equal(await p.evaluate(()=>shopCtx.title),r.title);
 await p.keyboard.press('1');assert.equal(await p.evaluate(()=>inv[0]?.id),r.item);assert.equal(await p.evaluate(()=>money),100-r.price);
}));

test('a native doorway is kept clear when it is the nearest otherwise valid mount',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof fitNativeMachineMounts!=='function')return ['no native mount placement routine'];
  // Recreate placement-phase conditions with an invalidly facing machine
  // directly in front of the real PHARMACY door. Other people/geometry stay.
  kerbs.length=0;for(const b of kerbsB)b.length=0;
  const o=NATIVE_MACHINE_PLACEMENT.moved[0].o,old=machinesB[bi(Math.floor(o.x/8),Math.floor(o.y/8))];old.splice(old.indexOf(o),1);
  Object.assign(o,{x:275.5,y:120.04,c:1,s:0,fs:-1});machinesB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].push(o);
  fitNativeMachineMounts();
  return NATIVE_MACHINE_PLACEMENT.unfitted.length||!machineMountClear(o)||!streetEntranceFixtureClear(o,'machine')||Math.abs(o.x-275.5)<.14?['preferred mount still blocks the native door']:[];
 });assert.deepEqual(r,[]);
}));

test('an occupied customer standing area makes the machine choose another supported mount',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof fitNativeMachineMounts!=='function')return ['no native mount placement routine'];
  kerbs.length=0;for(const b of kerbsB)b.length=0;
  const record=NATIVE_MACHINE_PLACEMENT.moved[0],o=record.o,fx=-o.s*o.fs,fy=o.c*o.fs;
  const lamp={...lamps[0],x:o.x+fx*.15,y:o.y+fy*.15,ax:0,ay:-1,top:LAMP_TOP};lamps.push(lamp);lampsB[bi(Math.floor(lamp.x/8),Math.floor(lamp.y/8))].push(lamp);
  const old=machinesB[bi(Math.floor(o.x/8),Math.floor(o.y/8))];old.splice(old.indexOf(o),1);Object.assign(o,record.before);machinesB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].push(o);
  fitNativeMachineMounts();const nx=-o.s*o.fs,ny=o.c*o.fs,front={x:o.x+nx*.15,y:o.y+ny*.15,c:1,s:0,hl:.025,hw:.025,z0:0,z1:.2};
  return NATIVE_MACHINE_PLACEMENT.unfitted.length||!machineMountClear(o)||streetFixtureBoxes(lamp,'lamp').some(b=>streetBoxesOverlap(front,b,0))?['customer would stand inside an existing post']:[];
 });assert.deepEqual(r,[]);
}));
