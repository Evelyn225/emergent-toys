'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('Fern, Cabin Cove, Juniper and Crescent Sands landings are furnished on dry land, the path up from each stays walkable, and the lamps light at night',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const out={};for(const id of ['fern','cabin','wood','sand']){const I=WILD_ISLANDS.find(q=>q.id===id),[lx,ly]=I.landing;
  const near3=ISLAND_DETAILS.filter(m=>near(m.x,m.y,lx,ly)<3),before=near3.length;
  const wet=near3.filter(m=>m.kind!=='cover'&&seaAt(m.x,m.y)).length;
  // the path up from the landing: free to walk for its first three cells
  const paths=id==='fern'?FERN_TRAILS:ISLAND_PATHS[id];let blocked=0;const pth=paths[0];let walked=0; // (the first three cells of the path up)
  for(let k=1;k<pth.length&&walked<3;k++){const [ax,ay]=pth[k-1],[bx,by]=pth[k],l=near(ax,ay,bx,by);for(let d=0;d<l&&walked<3;d+=.05,walked+=.05){const x=ax+(bx-ax)*d/l,y=ay+(by-ay)*d/l;if(islandSightBlocked(x,y,terrainHeight(x,y)))blocked++;}}
  const lamps=near3.filter(m=>m.kind==='lamp').length,obstacles=ISLAND_OBSTACLES.filter(o=>near(o.x,o.y,lx,ly)<3).length;
  out[id]={before,wet,blocked,lamps,obstacles};}
  return {out};});
 for(const [id,q] of Object.entries(r.out)){assert.equal(q.wet,0,id+' has things standing in the sea');assert.equal(q.blocked,0,id+' path blocked at '+q.blocked+' samples');assert.ok(q.lamps>=1&&q.obstacles>=2&&q.before>=20,id+' landing barely furnished: '+JSON.stringify(q));}
 const lit=await p.evaluate(()=>{const I=WILD_ISLANDS.find(q=>q.id==='cabin'),lamp=ISLAND_DETAILS.find(m=>m.kind==='lamp'&&near(m.x,m.y,...I.landing)<3);px=lamp.x-1.2;py=lamp.y;a=0;pitch=0;body.z=0;const shot=t=>{tod=t;env(0);render(0);let n=0;for(let i=0;i<BG.length;i++)if(BG[i]===C(WARM,3+night*6))n++;return n;};return {day:shot(14),night:shot(23)};});
 assert.ok(lit.night>0,'the landing lamp shows at night: '+JSON.stringify(lit));
}));
