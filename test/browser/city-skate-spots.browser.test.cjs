'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('skate spots have rideable geometry, mapped destinations and clear traffic lanes',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=null;T=100;tod=13;
   const bad=[],directory=mapDirectory(),spots=SKATE_SPOTS;
   for(const id of ['skate-diy','skate-plaza','skate-stairs'])if(!spots.some(s=>s.id===id))bad.push(['missing spot',id]);
   for(const s of spots){
    if(!Number.isFinite(s.x)||!Number.isFinite(s.y))bad.push(['invalid location',s.id]);
    if(!directory.some(p=>p.id===s.id&&p.category==='activities'&&p.x===s.x&&p.y===s.y))bad.push(['not mapped',s.id]);
   }
   if(new Set(spots.filter(s=>s.id.startsWith('skate-kerb:')).map(s=>s.id)).size<3)bad.push('three kerb districts');
   for(const o of SKATE_SPOT_FEATURES){
    if(Math.abs(walkGround(o.x,o.y)-o.z1)>1e-8)bad.push(['no top',o.kind]);
    if(!GRIND_PATHS.some(p=>p.feature===o))bad.push(['no grind path',o.kind]);
    if(!solidAt(o.x,o.y,.02,o.z1-.02)||solidAt(o.x,o.y,.02,o.z1+.001))bad.push(['collision height',o.kind]);
   }
   const diy=spots.find(s=>s.id==='skate-diy');
   for(const side of [-1,1])for(let x=diy.line.x-.5;x<diy.line.x+1.5;x+=.1)
    if(solidAt(x,diy.line.y+side*.4,.1,roadGroundHeight(x,diy.line.y+side*.4)))bad.push(['traffic lane blocked',side,x]);
   const pad=SKATE_SPOT_FEATURES.find(o=>o.kind==='manualpad');
   if(pad.hl*20!==6)bad.push(['manual pad length',pad.hl*20]);
   const plaza=spots.find(s=>s.id==='skate-plaza');
   if(skateSurface(plaza.line.x+.45,plaza.line.y).material!=='concrete')bad.push('plaza surface material');
   px=diy.x-.6;py=diy.y+.2;a=0;pitch=-.2;env(0);render(0);
   return{bad,count:spots.length};
  });
  assert.deepEqual(r.bad,[]);assert.ok(r.count>=6);assert.deepEqual(errors,[]);
  await page.keyboard.press('KeyM');await page.locator('#bigmap input').fill('DIY');
  assert.equal(await page.locator('[data-place]').count(),1);
  await page.locator('[data-place]').first().click();
  assert.match(await page.locator('.place-detail').innerText(),/3.5 m transfer gap/);
  await page.locator('[data-map="waypoint"]').click();
  assert.equal(await page.evaluate(()=>mapWaypoint?.id==='skate-diy'),true);
 }finally{await browser.close();}
});
