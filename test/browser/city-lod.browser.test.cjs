'use strict';
// The Detail distance setting carries the detailed models and textures further out (1x as built).
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('Detail distance scales the detail cutoffs and is in the pause menu',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{const g={band:.1,edge:.01},at=l=>{settings.lod=l;return{near:SHOP_WINDOW.near,painted11:archFasciaPainted(g,11),groove:coveGroove(.0005,.05,.004,.03)};};
   const one=at(1),two=at(2.5);settings.lod=1;buildPause?.();
   return{one,two,slider:!!document.querySelector('[data-set="lod"]')||document.body.innerHTML.includes('Detail distance')};});
  assert.equal(r.one.near,3.5);assert.equal(r.two.near,3.5*2.5,'shop windows open up further off');
  assert.equal(r.one.painted11,true);assert.equal(r.two.painted11,false,'the fascia board stays a model further off');
  assert.ok(r.two.groove>r.one.groove,'grooves keep their lines further off');
  assert.ok(r.slider,'a Detail distance slider');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
