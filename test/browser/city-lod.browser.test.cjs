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
test('Detail distance shows on a real street: the paving, road markings and window interiors carry further out',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';tod=13;dayNum=10;env(0);render(0);for(const q of people)q.hidden=true;cars.length=0;
   for(let k=0;k<N*N;k++){const X=k%N,Y=k/N|0;if(ROAD[k]===1&&X>100&&Y>100&&[1,2,3,4,5,6].every(j=>ROAD[idx(X,Y-j)])&&!map[k]){px=X+.25;py=Y+.5;a=-Math.PI/2;break;}}pitch=-.08;
   const shot=l=>{settings.lod=l;render(0);render(0);return Int16Array.from(BG);};
   const one=shot(1),again=shot(1),three=shot(3),half=shot(.5);let same=0,more=0,less=0;
   for(let i=0;i<one.length;i++){if(one[i]!==again[i])same++;if(three[i]!==one[i])more++;if(half[i]!==one[i])less++;}
   const fp=l=>{settings.lod=l;return homeBalconyPavingFootprint(2,.17);},ground=[fp(1),fp(3)];settings.lod=1;
   return{same,more,less,ground};});
  assert.equal(r.same,0,'the same picture at the same setting');
  assert.ok(r.more>150,'3x: more detail on screen ('+r.more+' cells)');assert.ok(r.less>100,'0.5x: less ('+r.less+' cells)');
  assert.ok(Math.abs(r.ground[1]-r.ground[0]/3)<1e-12,'the ground filters three times finer at 3x');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
