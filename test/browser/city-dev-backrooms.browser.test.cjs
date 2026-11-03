'use strict';
// Dev tools > Places has a Backrooms entrance jump: you land in the lane facing the seam, a few steps from it.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the backrooms entrance jump puts you in front of the seam',async()=>{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);
   const e=devPlaces().find(q=>q[0]==='Landmarks'&&q[1]==='Backrooms entrance');if(!e)return{missing:true};e[2]();
   let ahead=false;for(let k=1;k<=6;k++)if(backroomsSeamAt(px+Math.cos(a)*k*.1,py+Math.sin(a)*k*.1))ahead=true;
   return{ahead,here:backroomsSeamAt(px,py),mode,inRoom:!!room};});
  assert.ok(!r.missing,'listed under Landmarks');assert.equal(r.mode,'walk');assert.equal(r.inRoom,false);
  assert.equal(r.here,false,'not already through');assert.ok(r.ahead,'the seam is a few steps ahead');
  assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
