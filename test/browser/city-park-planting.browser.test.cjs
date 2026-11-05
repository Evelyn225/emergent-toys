'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;body.seat=null;snowCover=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('street planters and park shrubs preserve pavement, entrances, paths, ponds and existing vegetation',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof parkShrubs==='undefined')return {bad:['no park planting'],planters:0,shrubs:0};
  const planters=kerbs.filter(o=>o.kind==='planter'),bad=[];
  for(const o of planters){
   const edge=o.c?mod(o.y,8):mod(o.x,8);
   if(Math.abs(Math.min(edge,2-edge)-CURB)>1e-8||Math.min(edge,2-edge)+o.hw>.3)bad.push('planter off pavement');
   if(streetEntranceCollision({...o,z0:0,z1:o.h})||streetGeometryCollision({...o,z0:0,z1:o.h},true))bad.push('planter obstructs existing geometry');
   if(SKATE_SPOTS.some(p=>p.id.startsWith('skate-kerb:')&&Math.hypot(rel(p.x-o.x),rel(p.y-o.y))<3.6))bad.push('mapped kerb line obstructed');
   if(kerbAt(o.x,o.y,0)!==o)bad.push('planter has no collision');
   for(const u of [-.12,0,.12]){const x=o.x+o.c*u-o.fx*.13,y=o.y+o.s*u-o.fy*.13;if(kerbAt(x,y,.02))bad.push('walking line obstructed');}
  }
  for(const o of parkShrubs){
   const bx=Math.floor(o.x/8),by=Math.floor(o.y/8),u=mod(o.x,8),v=mod(o.y,8);
   if(u+o.hl>=5.5||v+o.hw>=5.5)bad.push('shrub occupies the street-skate edge reservation');
   if(blockKind(bx,by)!=='park'||Math.abs(u-5)<.5||Math.abs(v-5)<.5||inPond(u,v,bx,by,.4))bad.push('shrub on path or pond');
   if(trees.some(t=>Math.hypot(rel(t.x-o.x),rel(t.y-o.y))<.4)||benches.some(b=>Math.hypot(rel(b.x-o.x),rel(b.y-o.y))<.5))bad.push('shrub at tree or bench');
   if(SKATE_PATCHES.some(q=>Math.abs(rel(o.x-q.x))<q.hl+.3&&Math.abs(rel(o.y-q.y))<q.hw+.3))bad.push('shrub in skate area');
   if(kerbAt(o.x,o.y,0)!==o||!parkShrubsB[bi(bx,by)].includes(o))bad.push('shrub missing collision/index');
  }
  return {bad:[...new Set(bad)],planters:planters.length,shrubs:parkShrubs.length};
 });assert.deepEqual(r.bad,[]);assert.ok(r.planters>100&&r.shrubs>10,JSON.stringify(r));
 const walk=await p.evaluate(()=>{const o=kerbs.find(q=>q.kind==='planter'&&[-.2,0,.2].every(u=>free(q.x+q.c*u-q.fx*.13,q.y+q.s*u-q.fy*.13)));px=o.x-o.fx*.13-o.c*.2;py=o.y-o.fy*.13-o.s*.2;for(let n=0;n<40;n++)move(o.c*.01,o.s*.01);return {distance:(px-o.x)*o.c+(py-o.y)*o.s,free:free(px,py)};});assert.ok(walk.free&&walk.distance>.18,JSON.stringify(walk));
}));
test('native planting rays agree with collision, soil is recessed, and seasonal models paint colour',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof parkShrubs==='undefined')return {bad:['no park planting']};
  const bad=[],pot=kerbs.find(o=>o.kind==='planter'),shrub=parkShrubs[0];
  const capture=(o,draw)=>{const parts=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});draw(o,0,0,0,true);}finally{drawBox=old;}return parts;};
  const potParts=capture(pot,drawStreetPlanter),bushParts=capture(shrub,drawParkShrub);
  const hit=(parts,x,y)=>{let nearest=Infinity;for(const q of parts){const t=q.ray(x,y,1,0,0,-1,q.box);if(t>.01)nearest=Math.min(nearest,t);}return nearest;};
  const solid=potParts.slice(0,PLANTER_PARTS.length);
  const soil=1-hit(solid,0,0),rim=1-hit(solid,pot.c*(PLANTER.hl-.002),pot.s*(PLANTER.hl-.002));
  if(!(rim-soil>.01))bad.push(['soil not recessed',soil,rim]);
  for(let u=-.16;u<.16;u+=.009)for(let v=-.1;v<.1;v+=.009){
   const px=pot.c*u-pot.s*v,py=pot.s*u+pot.c*v;
   if(Number.isFinite(hit(solid,px,py))!==plantingFootprint(pot,u,v,0,0,.2))bad.push('pot collision differs from visible shell');
   if(Number.isFinite(hit(bushParts,u,v))!==plantingFootprint(shrub,u,v,0,0,.2))bad.push('shrub collision has empty corners');
  }
  for(const [o,draw]of [[pot,drawStreetPlanter],[shrub,drawParkShrub]]){
   const image=z=>{dx=1;dy=0;eye=.14+z;hor=rows/2;ZB.fill(Infinity);ZBG.fill(Infinity);CH.fill(' ');BG.fill(C(BLUE,1));draw(o,.4,0,z,true);return [...BG];};
   const flat=image(0),raised=image(.4);if(flat.filter((v,i)=>v!==raised[i]).length>flat.length*.01)bad.push('cached planting shading changed with terrain translation');
  }
  if(plantingFootprint(shrub,0,0,0,.3,.5)||plantingFootprint(pot,0,0,0,.1,.2))bad.push('collision above planting');
  for(const td of [14,22])for(const season of [0,1,2,3]){
   tod=td;env(0);setSeason(season);dx=1;dy=0;eye=.14;hor=rows/2;snowCover=0;
   for(const [o,draw]of [[pot,drawStreetPlanter],[shrub,drawParkShrub]]){
    ZB.fill(Infinity);ZBG.fill(Infinity);CH.fill(' ');BG.fill(C(BLUE,1));draw(o,.4,0,0,true);
    let cells=0,glyphs=0;const colors=new Set();for(let i=0;i<ZB.length;i++)if(Number.isFinite(ZB[i])){cells++;colors.add(BG[i]);if(CH[i]!==' ')glyphs++;}
    if(cells<20||glyphs||colors.size<2)bad.push([o.kind,td,season,cells,glyphs,colors.size]);
   }
  }
  return {bad:[...new Set(bad.map(x=>JSON.stringify(x)))]};
 });assert.deepEqual(r.bad,[]);
}));
