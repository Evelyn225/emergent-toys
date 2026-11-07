'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('mouse and gamepad share gestures; polling, disconnect, pause and controls behave',async()=>{
 const browser=await chromium.launch(),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=null;T=100;third=false;
   clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;
   [px,py]=citySourcePoint(41.5,73.5);a=0;SK.lastT=T;SK.v=.3;SK.dir=0;
   body.z=body.vz=0;body.trick=null;
   let calls=0,pad={connected:true,mapping:'standard',axes:[.5,0,0,0],buttons:[]};
   Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{calls++;return pad?[pad]:[];}});
   const ride=()=>{T+=1/60;stepSkate(1/60);stepBody(1/60);};
   ride();const steer=SK_INPUT.steer;
   pad=null;ride();const disconnected=SK_INPUT.steer===0&&!SK_INPUT.push;
   skateMouseBegin();T+=.02;skateMouseMove(0,60);T+=.02;skateMouseMove(0,-120);
   const mouse={name:body.trick?.name,vz:body.vz};
   const played=skateMouseEnd();
   // Clear the jump and run the same path through the Gamepad API.
   body.z=body.vz=0;body.trick=null;skateInputReset();
   pad={connected:true,mapping:'standard',axes:[0,0,0,1],buttons:[]};ride();
   pad.axes[3]=-1;ride();const gamepad={name:body.trick?.name,vz:body.vz};
   const polls=calls; // exactly four stepSkate calls above
   body.z=body.vz=0;body.trick=null;skateMouseBegin();skateMouseMove(0,60);
   openPause();const reset=!SK_INPUT.mouseHeld&&SK_INPUT.padGesture.samples.length===0;
   pauseEl.querySelector('[data-act=controls]').click();controlsEl.querySelector('[data-controls-tab=skate]').click();const section=controlsEl.querySelector('[data-controls-section=skate]'),controls=section.innerText;const controlsVisible=!section.hidden;
   return {steer,disconnected,mouse,played,gamepad,polls,reset,controls,controlsVisible};
  });
  assert.ok(r.steer>0&&r.steer<.5);assert.equal(r.disconnected,true);
  assert.equal(r.mouse.name,'ollie');assert.ok(r.mouse.vz>0);assert.equal(r.played,true);
  assert.equal(r.gamepad.name,r.mouse.name);assert.ok(r.gamepad.vz>0);
  assert.equal(r.polls,4);assert.equal(r.reset,true);
  assert.equal(r.controlsVisible,true);assert.match(r.controls,/Skateboarding/);assert.match(r.controls,/right stick/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
