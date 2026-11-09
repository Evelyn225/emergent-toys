'use strict';
// Screenshots (F12, the pause menu) are the world only: no HUD, no other players' names or chat, nothing in your hand.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('a screenshot leaves out the HUD and the held item, and the screen keeps both',async()=>{
 const browser=await chromium.launch();
 try{
  const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  for(const pausedNow of [false,true]){
   const r=await p.evaluate(pausedNow=>{
    tod=13;paused=pausedNow;mode='walk';room=game=freecam=null;settings.help=true;clearInventory();carryItem({id:'water',uses:2});held=0;env(0);
    const calls={hud:0,held:0},h=hud,d=drawHeld;hud=(...q)=>{calls.hud++;return h(...q);};drawHeld=(...q)=>{calls.held++;return d(...q);};
    let shot,during;
    try{shot=cleanFrame();during={...calls};}finally{hud=h;drawHeld=d;}
    const px=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data].slice(0,3).join();
    // the top-left text block: on screen (the redraw), not in the shot
    const box=(c)=>{const d=c.getContext('2d').getImageData(0,0,300,FS*2).data;let n=0;for(let k=0;k<d.length;k+=4)if(d[k]===187&&d[k+1]===187&&d[k+2]===187)n++;return n;};
    return{during,shotText:box(shot),screenText:box(frameCanvas()),size:[shot.width,shot.height,cv.width,cv.height]};
   },pausedNow);
   assert.deepEqual(r.during,{hud:1,held:1},'one clean draw (neither), then the normal one (both)');
   assert.equal(r.shotText,0,'no HUD text in the screenshot: '+JSON.stringify(r));
   assert.ok(r.screenText>20,'the HUD is back on screen: '+JSON.stringify(r));
   assert.deepEqual(r.size.slice(0,2),r.size.slice(2));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
