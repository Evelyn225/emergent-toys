'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;snowCover=0;T=20;tod=22;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('shore campfires stay dark by day, move at night and burn higher when cooking',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=FIRES.find(o=>o.nightOnly&&!o.ring);px=o.x+.46;py=o.y;a=Math.PI;pitch=-.18;render(0);
  const heatCells=()=>{ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(NONE);drawCampfires();return Array.from(BG,(c,i)=>[c,i]).filter(([c])=>[RED,ORANGE,YEL,WHITE].includes(c>>4)&&(c&15)>=7).map(([,i])=>i);};
  tod=14;env(0);const day=heatCells();tod=22;env(0);const night=heatCells();T+=.25;const moved=heatCells();
  cookCtx={spot:o,on:'fire'};game={g:{id:'cook'}};const cooking=heatCells();game=cookCtx=null;
  return {day:day.length,night:night.length,cooking:cooking.length,moves:JSON.stringify(night)!==JSON.stringify(moved)};
 });assert.equal(r.day,0);assert.ok(r.night>0&&r.cooking>r.night&&r.moves,JSON.stringify(r));
}));
test('campfire light warms raised shoreline terrain while preserving its material and blank surface',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=FIRES.find(o=>o.z>.05&&o.nightOnly),x=o.x+.12,y=o.y+.06,i=0;
  terrainCell(i,x,y,.5,0,0,1);const lit={background:BG[i],ch:CH[i]};
  const index=FIRES.indexOf(o);FIRES.splice(index,1);terrainCell(i,x,y,.5,0,0,1);const dark={background:BG[i],ch:CH[i]};FIRES.splice(index,0,o);
  return {lit,dark,opaque:lit.background!==NONE&&dark.background!==NONE,preservesBlank:lit.ch===dark.ch&&lit.ch===' ',unlitColour:campfireLightColour(C(GREEN,3),0)===C(GREEN,3)};
 });assert.ok(r.opaque&&r.preservesBlank&&r.unlitColour,JSON.stringify(r));assert.notEqual(r.lit.background,r.dark.background);
}));
