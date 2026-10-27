'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=12;tod=14;body.z=body.vz=0;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('native street furniture and later kerb fixtures leave all rendered entrances and the outer stair approaches clear',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof STREET_ENTRANCES==='undefined')return {bad:['no native entrance reservations']};
  const bad=[],counts={},groups=[[lamps,'lamp'],[lights,'signal'],[trees,'tree'],[benches,'bench'],[machines,'machine'],[extras.filter(o=>o.bike!=null),'bike'],[vendors,'vendor']];
  for(const [list,kind]of groups){counts[kind]=list.length;for(const o of list)if(!streetEntranceFixtureClear(o,kind))bad.push([kind,o.x,o.y,'blocks an entrance']);}
  for(const o of kerbs)if(streetEntranceCollision({x:o.x,y:o.y,c:o.c,s:o.s,hl:o.hl,hw:o.hw,z0:0,z1:o.h}))bad.push([o.kind,o.x,o.y,'blocks an entrance']);
  // Protect the real outer tread and the step-off space, independently of the
  // cached stair reservations. A wall-only door check misses this strip.
  const stairs=new Map();for(const o of ARCH_STEPS)if(map[o.ownerCell]===o.ownerHeight){const key=[o.ownerCell,(o.x*o.c+o.y*o.s).toFixed(6),o.nx,o.ny].join(':');const old=stairs.get(key);if(!old||(o.x*o.nx+o.y*o.ny)>(old.x*old.nx+old.y*old.ny))stairs.set(key,o);}
  for(const o of stairs.values())for(const across of [-o.hl,0,o.hl])for(const out of [o.hw+.025,o.hw+.10]){
   const x=o.x+o.c*across+o.nx*out,y=o.y+o.s*across+o.ny*out;
   if(!streetEntranceCollision({x,y,c:1,s:0,hl:.001,hw:.001,z0:.24,z1:.31}))bad.push(['outer stair foot unprotected',x,y]);
  }
  // These are original native vending/door conflicts, not synthetic fixtures.
  for(const [x,y]of [[124.7,136.15],[309,112.15],[275.5,120.15]])if(!streetEntranceCollision({x,y,c:1,s:0,hl:.01,hw:.01,z0:0,z1:.19}))bad.push(['native door omitted',x,y]);
  return {bad:bad.slice(0,10),counts,stairs:stairs.size,zones:STREET_ENTRANCES.zones.length,removed:STREET_CLEARANCE.removed};
 });assert.deepEqual(r.bad,[]);assert.ok(r.stairs>1000&&r.zones>7000,JSON.stringify(r));
 assert.equal(r.counts.machine,448,'every vending machine is retained');assert.equal(r.counts.vendor,28,'staffed carts are retained');
 for(const k of ['lamp','signal','tree','bench','machine','bike','vendor'])assert.equal(r.removed[k],0,`${k}s fit without disappearing`);
}));

test('reserved door centres agree with native rendered doors across the offset merchant and repeated brownstone bays',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof STREET_ENTRANCES==='undefined')return ['no native entrance reservations'];
  const bad=[],old=doorGlass;cars.length=0;for(const p of people)p.hidden=true;
  for(const family of ['merchant-door','brownstone-shop','housing-door','architecture-door']){
   let checked=0;for(const z of STREET_ENTRANCES.zones.filter(z=>z.family===family)){
    if(checked===3)break;
    const wallX=z.x-z.nx*.15,wallY=z.y-z.ny*.15,k=idx(wallX-z.nx*.1,wallY-z.ny*.1),sh=SHOP[k];
    if(!sh||sh.kind===SHOP_APTS||!openAt(sh,tod))continue;
    px=wallX+z.nx*.42;py=wallY+z.ny*.42;a=Math.atan2(-z.ny,-z.nx);pitch=0;freecam={z:.2};
    let centre=false;doorGlass=(i,du,...args)=>{const hit=old(i,du,...args);if(Math.abs(du)<.008&&Math.abs(i%cols-cols/2)<2){centre=true;BG[i]=C(MAG,15);}return hit;};
    try{render(0);}finally{doorGlass=old;}
    if(!centre||!Array.from(BG).some(c=>c===C(MAG,15)))bad.push([family,sh.word,'reservation misses native door',wallX,wallY]);
    checked++;
   }
   if(checked!==3)bad.push([family,'not enough actual door views',checked]);
  }
  freecam=null;return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));

test('fitted fixtures keep their curb, backing, geometry and spatial/light caches; shelter benches stay attached',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],groups=[[lamps,lampsB,'lamp'],[lights,lightsB,'signal'],[trees,treesB,'tree'],[benches,benchesB,'bench'],[machines,machinesB,'machine'],[extras,extrasB,'extras']];
  for(const [items,buckets,kind]of groups)if(buckets.flat().length!==items.length||items.some(o=>!buckets[bi(Math.floor(o.x/8),Math.floor(o.y/8))].includes(o)))bad.push([kind,'stale spatial bucket']);
  for(const {o:m,kind} of typeof STREET_ENTRANCE_MOVES==='undefined'?[]:STREET_ENTRANCE_MOVES){if(kind!=='machine')continue;const fx=-m.s*m.fs,fy=m.c*m.fs;if(!map[idx(m.x-fx*.1,m.y-fy*.1)]||map[idx(m.x+fx*.3,m.y+fy*.3)])bad.push(['machine lost wall backing or front access',m.x,m.y]);}
  if(lamps.some(l=>Math.abs(rel(l.gx-l.x-(districtAt(l.x,l.y)==='belle'?0:l.ax*REACH)))>1e-8||Math.abs(rel(l.gy-l.y-(districtAt(l.x,l.y)==='belle'?0:l.ay*REACH)))>1e-8||glow(l.gx,l.gy)<.99))bad.push('lamp glow left at old location');
  if(lamps.some(o=>elStairLocal(o.x,o.y))||trees.some(o=>elStairLocal(o.x,o.y)))bad.push('moved into elevated stairs');
  for(const o of kerbs.filter(o=>o.kind==='shelter')){const b=benches.find(b=>b.shelter===o);if(!b||Math.hypot(rel(b.x-(o.x-o.fx*.03)),rel(b.y-(o.y-o.fy*.03)))>1e-8)bad.push('shelter bench detached');}
  if(typeof STREET_ENTRANCE_MOVES==='undefined'||STREET_ENTRANCE_MOVES.length<900)bad.push('missing native relocation audit');
  else for(const {o,kind,x,y}of STREET_ENTRANCE_MOVES){
   if(!streetEntranceFixtureClear(o,kind)||!streetFixtureClear(o,kind)||elStairLocal(o.x,o.y)||streetEntranceNeighboursOverlap(o,kind))bad.push([kind,'invalid final relocation']);
   const d=fixtureStreetDirection({...o,x,y});if(d&&Math.abs(rel(o.x-x)*d[0]+rel(o.y-y)*d[1])>1e-7)bad.push([kind,'moved off its curb']);
  }
  if(typeof STREET_ENTRANCES!=='undefined'){
   const ref=STREET_ENTRANCES.cells,zones=STREET_ENTRANCES.zones,geometry=STREET_GEOMETRY.length;render(0);render(0);
   if(STREET_ENTRANCES.cells!==ref||STREET_ENTRANCES.zones!==zones||STREET_GEOMETRY.length!==geometry||STREET_GEOMETRY.some(o=>zones.includes(o)))bad.push('access reservations rebuilt or added to physical geometry');
  }else bad.push('missing cached reservations');
  return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));

test('the cleared hardware doorway is reachable by walking and real E still enters the native shop',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  clearWanted();for(const p of people)p.hidden=true;cars.length=0;px=309;py=112.48;a=-Math.PI/2;pitch=0;
  for(let n=0;n<12;n++)move(0,-.03);render(0);return {x:px,y:py,free:free(px,py),prompt:promptText()};
 });assert.ok(r.free&&r.y<112.14,JSON.stringify(r));assert.match(r.prompt,/HARDWARE/);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>mode),'room');assert.equal(await p.evaluate(()=>room.word),'HARDWARE');
}));

test('the former cabinet obstruction leaves the real brownstone stair flight walkable into its lobby',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  clearWanted();for(const p of people)p.hidden=true;cars.length=0;px=433.4;py=135.26;a=0;pitch=0;
  for(let n=0;n<19;n++)move(.03,0);render(0);return {x:px,free:free(px,py),ground:walkGround(px,py),prompt:promptText()};
 });assert.ok(r.free&&r.x>433.92&&r.ground>.09,JSON.stringify(r));assert.match(r.prompt,/enter/);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>mode),'room');assert.equal(await p.evaluate(()=>room.kind),'walkup');
}));
