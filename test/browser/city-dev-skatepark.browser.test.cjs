'use strict';
// Dev tools > Places has a Skatepark jump: you land on your feet at the park's edge, on clear ground.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('the skatepark jump puts you at the park',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);
   if(!SKATEPARK)return{none:true};const e=devPlaces().find(q=>q[0]==='Landmarks'&&q[1]==='Skatepark');if(!e)return{missing:true};e[2]();
   return{mode,free:free(px,py),near:inSkatepark(px,py,.3)};});
  if(r.none)return;assert.ok(!r.missing,'listed under Landmarks');
  assert.deepEqual(r,{mode:'walk',free:true,near:true});assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
