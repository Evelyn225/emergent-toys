'use strict';
// Screenshots (F12, the pause menu) leave out the top-left info block: it's drawn on a layer of its own (hud.js).
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('the top info block is on screen but not in the screenshot',async()=>{
 const browser=await chromium.launch();
 try{
  const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   tod=14;env(0);paused=false;mode='walk';room=game=freecam=null;settings.help=true;render(0);
   const lay=document.querySelectorAll('canvas'),i=[...lay].indexOf(cv);
   const L=hudTopLayer,box=L.getContext('2d').getImageData(0,0,200,30).data;let onLayer=0;for(let k=3;k<box.length;k+=4)if(box[k])onLayer++;
   // what you see (the frame, the game canvas and the layer) has the block; the screenshot doesn't
   const shot=frameCanvas().getContext('2d').getImageData(0,0,200,30).data;
   const seen=document.createElement('canvas');seen.width=cv.width;seen.height=cv.height;const sx=seen.getContext('2d');sx.drawImage(frameCanvas(),0,0);sx.drawImage(L,0,0);
   const view=sx.getImageData(0,0,200,30).data;let differ=0;for(let k=0;k<view.length;k+=4)if(view[k]!==shot[k]||view[k+1]!==shot[k+1]||view[k+2]!==shot[k+2])differ++;
   return{onLayer,differ,after:lay[i+1]===L,size:[L.width,L.height,cv.width,cv.height],pe:L.style.pointerEvents};
  });
  assert.ok(r.onLayer>200,JSON.stringify(r));
  assert.ok(r.differ>200,'the block is in the view but missing from the screenshot');
  assert.ok(r.after,'the layer sits right after the game canvas');
  assert.deepEqual(r.size.slice(0,2),r.size.slice(2));
  assert.equal(r.pe,'none');
  // and a frame without the HUD (a cabinet, the free camera) doesn't leave it behind
  const left=await p.evaluate(()=>{clearHudTop();const d=hudTopLayer.getContext('2d').getImageData(0,0,200,30).data;let n=0;for(let k=3;k<d.length;k+=4)if(d[k])n++;return n;});
  assert.equal(left,0);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
