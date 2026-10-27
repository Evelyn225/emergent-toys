'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=10;tod=21;body.z=body.vz=0;clearWanted();env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('all five complete market stalls fit between native entrances with supported canopies and attached sellers',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof NIGHT_MARKET_GROUPS==='undefined')return {bad:['market has no coherent placement groups']};
  const bad=[],parts=new Set(NIGHT_MARKET_GROUPS.flatMap(g=>g.parts));
  for(const g of NIGHT_MARKET_GROUPS){const c=g.counter,roof=g.parts.find(p=>p.kind==='stallroof'),poles=g.parts.filter(p=>p.kind==='stallpole'),seller=g.seller;
   if(g.parts.length!==4||poles.length!==2||!roof||!STALLS.includes(c)||!solids.includes(c)||!extras.includes(seller)){bad.push('missing connected stall parts');continue;}
   if(c.hl>.15||roof.hl>.18||roof.hl<=c.hl||roof.hw<c.hw)bad.push('stall footprint is oversized or counter extends through canopy');
   if(Math.abs(roof.x-c.x)>1e-8||Math.abs(roof.y-c.y-.02)>1e-8||Math.abs(seller.x-c.x-(.1-c.k%3*.1))>1e-8||Math.abs(seller.y-c.y-.14)>1e-8)bad.push([c.word,'canopy or seller left behind']);
   if(Math.abs(c.at[0]-c.x)>1e-8||Math.abs(c.at[1]-c.y+.3)>1e-8)bad.push('service point left behind');
   for(const p of poles){if(Math.abs(p.y-c.y+.08)>1e-8||Math.abs(Math.abs(p.x-c.x)-.14)>1e-8||p.z0!==0||p.z1!==roof.z0||p.hl>.008||Math.abs(p.x-roof.x)+p.hl>roof.hl)bad.push('unsupported canopy pole');}
   const boxes=[...g.parts,{x:seller.x,y:seller.y,c:1,s:0,hl:.03,hw:.03,z0:0,z1:.18}];
   if(boxes.some(p=>streetEntranceCollision(p)||streetGeometryCollision(p,true,parts)))bad.push([c.word,'blocked entrance or occupied space']);
   for(const [list,kind]of [[lamps,'lamp'],[lights,'signal'],[trees,'tree'],[benches,'bench'],[machines,'machine'],[vendors,'vendor'],[extras.filter(p=>p.bike!=null),'bike']])for(const p of list)
    if(Math.abs(rel(p.x-c.x))<1&&Math.abs(rel(p.y-c.y))<1&&streetFixtureBoxes(p,kind).some(a=>boxes.some(b=>streetBoxesOverlap(a,b,0))))bad.push([c.word,'overlaps actual street fixture',kind]);
   if(map[idx(seller.x,seller.y)]||!map[idx(c.x,c.y+.3)]||!map[idx(c.x,c.y-2)])bad.push('seller in wall or market without its street');
   if(isWater(...c.at)||map[idx(...c.at)]||solidAt(...c.at,.03))bad.push('service approach obstructed');
  }
  return {bad:bad.slice(0,10),count:NIGHT_MARKET_GROUPS.length,report:NIGHT_MARKET_PLACEMENT};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,5);assert.deepEqual(r.report.unfitted,[]);assert.ok(r.report.moved>0);
}));

test('moved market pieces and sellers retain exact bucket/geometry cells and cached snow cover agrees with actual roofs',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof NIGHT_MARKET_GROUPS==='undefined')return ['no market placement groups'];
  const bad=[],parts=new Set(NIGHT_MARKET_GROUPS.flatMap(g=>g.parts)),actual=new Map([...parts].map(p=>[p,new Set()]));
  for(let cell=0;cell<streetGeometryCells.length;cell++)for(const p of streetGeometryCells[cell]||[])if(parts.has(p)){if(actual.get(p).has(cell))bad.push('duplicate geometry-cell member');actual.get(p).add(cell);}
  for(const p of parts){const expected=new Set(),[ex,ey]=geometryBounds(p);for(let y=Math.floor(p.y-ey);y<=Math.floor(p.y+ey);y++)for(let x=Math.floor(p.x-ex);x<=Math.floor(p.x+ex);x++)expected.add(idx(x,y));if(expected.size!==actual.get(p).size||[...expected].some(cell=>!actual.get(p).has(cell)))bad.push('missing or ghost market geometry cell');}
  for(const [items,buckets]of [[solids,solidsB],[extras,extrasB]])if(buckets.flat().length!==items.length||items.some(p=>!buckets[bi(Math.floor(p.x/8),Math.floor(p.y/8))].includes(p)))bad.push('stale market solid/seller bucket');
  const lo=Math.min(...STALLS.map(p=>p.x))-1,hi=Math.max(...STALLS.map(p=>p.x))+1,y=STALLS[0].y;
  const nearby=STREET_GEOMETRY.filter(p=>p.x>lo-2&&p.x<hi+2&&Math.abs(p.y-y)<2);
  for(let x=lo;x<hi;x+=.07)for(const dy of [-.14,-.04,.06,.14])if(snowExposed(x,y+dy)!==geometrySnowExposed(x,y+dy,0,nearby))bad.push('cached cover differs from actual roof');
  return bad.slice(0,10);
 });assert.deepEqual(r,[]);
}));

test('walking reaches the formerly counter-blocked merchant door and actual E enters the ramen shop',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{cars.length=0;for(const p of people)p.hidden=true;px=156.7;py=137.45;a=Math.PI/2;pitch=0;for(let k=0;k<14;k++)move(0,.03);render(0);return {free:free(px,py),y:py,prompt:promptText()};});
 assert.ok(r.free&&r.y>137.84,JSON.stringify(r));assert.match(r.prompt,/RAMEN/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>mode),'room');assert.equal(await p.evaluate(()=>room.word),'RAMEN');
}));

test('all moved market service points keep their daytime tarp and real nighttime E interactions',()=>fixture(async p=>{
 await p.evaluate(()=>{cars.length=0;for(const p of people)p.hidden=true;money=50;const c=STALLS[2];[px,py]=c.at;a=Math.PI/2;pitch=0;tod=13;render(0);});
 assert.match(await p.evaluate(()=>promptText()),/under a tarp/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>panelOpen()),false);
 await p.evaluate(()=>{tod=21;render(0);});assert.match(await p.evaluate(()=>promptText()),/CURIOS/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>panelOpen()),true);assert.equal(await p.evaluate(()=>shopCtx.title),'CURIOS');await p.keyboard.press('Escape');
 for(const k of [3,4]){
  await p.evaluate(k=>{[px,py]=STALLS[k].at;a=Math.PI/2;render(0);},k);await p.keyboard.press('e');
  if(k===3){assert.match(await p.evaluate(()=>msgText),/She turns/);assert.equal(await p.evaluate(()=>money),45);}else{assert.equal(await p.evaluate(()=>game.g.id),'goldfish');assert.equal(await p.evaluate(()=>money),43);}
 }
}));

test('a pre-existing street fixture makes the whole stall choose another gap, with old roof cover cleared',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof fitNightMarket!=='function')return ['no complete-stall placement routine'];
  // Repeat the placement phase with one real-sized ordinary post already in
  // the preferred gap. Later kerbs have not spawned during that phase.
  kerbs.length=0;for(const b of kerbsB)b.length=0;
  const c=STALLS[0],oldX=c.x,oldY=c.y,x=oldX-.1,y=oldY-.12;
  snowExposed(x,y);const cell=idx(x,y),primed=!!groundSnowCells[cell];
  const lamp={...lamps.find(p=>p.ax===0&&p.ay===-1),x:oldX,y:oldY,ax:0,ay:-1};
  lamps.push(lamp);lampsB[bi(Math.floor(oldX/8),Math.floor(oldY/8))].push(lamp);
  fitNightMarket();
  const bad=[],parts=NIGHT_MARKET_GROUPS[0].parts;
  if(!primed||Math.abs(c.x-oldX)<.1||NIGHT_MARKET_PLACEMENT.unfitted.length)bad.push('stall did not find another supported gap');
  if(parts.some(p=>streetFixtureBoxes(lamp,'lamp').some(b=>streetBoxesOverlap(p,b,0))))bad.push('stall was placed through the existing post');
  if(snowExposed(x,y)!==geometrySnowExposed(x,y,0,STREET_GEOMETRY))bad.push('old roof shelter remains after the complete move');
  return bad;
 });assert.deepEqual(r,[]);
}));
