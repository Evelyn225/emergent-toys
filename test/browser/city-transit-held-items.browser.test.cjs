'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(kind,run){const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(kind=>{
  paused=false;mode='walk';room=me=freecam=null;T=ferryClockOffset=0;tod=12;money=500;body.z=body.vz=body.crouch=0;body.seat=null;clearWanted();env(0);render(0);
  inv.length=0;quickSlots.fill(-1);for(const id of ['apple','water','boombox','telescope','revolver','ammo','camera','firecrackers']){inv.push({id,uses:ITEMS[id].uses|| (id==='revolver'?6:id==='ammo'?24:1)});assignQuickSlot(inv.length-1,inv.length-1);}held=-1;
  if(kind==='ferry'){[px,py]=FERRY_STOPS[0].land;a=Math.PI/2;}else{T=1;elUp({s:EL_STATIONS[0],tr:0});}
 },kind);
 await p.keyboard.press('e');assert.equal(await p.evaluate(()=>mode),kind,'real E boards the service');
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

for(const kind of ['ferry','el']){
 test(`${kind}: inventory, quick slots, Q and a captured left click use visible items while riding`,()=>fixture(kind,async p=>{
  await p.keyboard.press('i');assert.equal(await p.evaluate(()=>panelOpen()),true);
  await p.locator('#inventory [data-slot="2"]').click();assert.equal(await p.evaluate(()=>heldItem()?.id),'boombox');
  await p.keyboard.press('i');assert.equal(await p.evaluate(()=>panelOpen()),false);
  assert.equal(await p.evaluate(()=>{render(0);return handDrawn?.id;}),'boombox');
  await p.keyboard.press('q');assert.equal(await p.evaluate(()=>fx.boombox),true);
  const tape=await p.evaluate(()=>fx.song);await p.keyboard.press('b');assert.notEqual(await p.evaluate(()=>fx.song),tape);
  await p.keyboard.press('1');const before=await p.evaluate(()=>{needs.food=10;return heldItem().uses;});
  await p.keyboard.press('q');assert.equal(await p.evaluate(()=>heldItem().uses),before-1);assert.ok(await p.evaluate(()=>needs.food>10));
  assert.equal(await p.evaluate(()=>{render(0);return handDrawn?.id;}),'apple');
  await p.keyboard.press('0');assert.equal(await p.evaluate(()=>heldItem()),null);
  await p.mouse.click(640,360);await p.waitForFunction(()=>mouseCaptured());
  await p.keyboard.press('2');const water=await p.evaluate(()=>heldItem().uses);await p.mouse.down();
  assert.deepEqual(await p.evaluate(()=>[heldItem().uses,usingHeldItem()]),[water-1,true]);
  await p.mouse.up();assert.equal(await p.evaluate(()=>usingHeldItem()),false);
  await p.keyboard.press('i');await p.keyboard.press('q');assert.equal(await p.evaluate(()=>panelOpen()),false,'inventory Q closes the bag and uses once');assert.equal(await p.evaluate(()=>heldItem().uses),water-2);
  assert.equal(await p.evaluate(()=>mode),kind);
  const touch=await p.evaluate(()=>{const labels=[],fill=g.fillText;g.fillText=(s,...args)=>{labels.push(s);return fill.call(g,s,...args);};try{hud();return {actions:touchActions(),empty:SHEET.find(s=>s[0]==='Empty hands')[2](),labels:labels.join(' ')};}finally{g.fillText=fill;}});
  assert.match(touch.labels,/1-8 items/);assert.match(touch.labels,/Q use/);
  assert.ok(touch.actions.some(a=>a[0]==='Drink'&&a[1]==='KeyQ'));assert.ok(touch.actions.some(a=>a[1]==='KeyI'));assert.ok(touch.empty);
  assert.ok(!touch.actions.some(a=>a[0]==='Jump'),'passenger controls retain their own movement');
 }));

 test(`${kind}: telescope magnifies the live view, and guns retain aim, shot and reload controls`,()=>fixture(kind,async p=>{
  await p.keyboard.press('4');const before=await p.evaluate(()=>{render(0);return {tf,FOV,setting:settings.fov};});
  await p.keyboard.press('q');const zoom=await p.evaluate(()=>{render(0);return {active:telescopeActive(),tf,FOV,setting:settings.fov};});
  assert.ok(zoom.active&&zoom.tf<before.tf*.2,JSON.stringify(zoom));assert.equal(zoom.FOV,before.FOV);assert.equal(zoom.setting,before.setting);
  await p.keyboard.press('q');assert.equal(await p.evaluate(()=>{render(0);return telescopeActive();}),false);
  await p.keyboard.press('0');await p.mouse.click(640,360);await p.waitForFunction(()=>mouseCaptured());
  await p.keyboard.press('5');assert.equal(await p.evaluate(()=>{render(0);return handDrawn?.id;}),'revolver');
  const hud=await p.evaluate(()=>{const out=[],stroke=g.strokeText;g.strokeText=(s,...args)=>{out.push(s);return stroke.call(g,s,...args);};try{drawGunHud();return out;}finally{g.strokeText=stroke;}});assert.ok(hud.some(s=>/^oooooo  +24$/.test(s)),JSON.stringify(hud));
  await p.mouse.down({button:'right'});assert.ok(await p.evaluate(()=>{stepGun(.35);return gun.aim>.95&&canAimGun();}));await p.mouse.up({button:'right'});
  const ammo=await p.evaluate(()=>heldGun().uses);await p.keyboard.press('q');
  assert.equal(await p.evaluate(()=>heldGun().uses),ammo-1);assert.ok(await p.evaluate(()=>gun.shots.length===1&&Math.abs(gun.shots[0].z0-eye)<1e-8));
  await p.keyboard.down('r');const reload=await p.evaluate(()=>{const before=pitch;loop(performance.now());const heldPitch=pitch;stepGun(RELOAD_T+.01);return {started:gun.reload===0,before,heldPitch,uses:heldGun().uses};});await p.keyboard.up('r');
  assert.equal(reload.heldPitch,reload.before,'R reload does not tilt the passenger view');assert.equal(reload.uses,6);
  const buttons=await p.evaluate(()=>touchActions());assert.ok(buttons.some(a=>a[0]==='Fire'));assert.ok(buttons.some(a=>a[0]==='Reload'));
  assert.equal(await p.evaluate(()=>mode),kind);
 }));

 test(`${kind}: menus, sleep, freecam and arrest still own input, and item use preserves passenger movement and seating`,()=>fixture(kind,async p=>{
  await p.keyboard.press('1');const initial=await p.evaluate(()=>heldItem().uses);
  for(const state of ['shop','sleep','freecam','pause','arrest']){
   await p.evaluate(state=>{
    if(state==='shop')openShop('FERRY CAFE',['water']);if(state==='sleep')sleep={t:0,home:true};if(state==='freecam')freecam={x:px,y:py,yaw:a,pitch,z:eye};if(state==='pause')paused=true;if(state==='arrest')openBusted();
    Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>cv});
   },state);
   await p.keyboard.press('q');await p.mouse.click(640,360);assert.equal(await p.evaluate(()=>inv[0].uses),initial,state+' blocks item use');
   await p.evaluate(state=>{delete document.pointerLockElement;if(state==='shop')closeShop();if(state==='sleep')sleep=null;if(state==='freecam')freecam=null;if(state==='arrest'){hidePanel(bustedEl);clearWanted();}paused=false;},state);
  }
  const move=await p.evaluate(kind=>{
   held=2;useHeldItem();const oldMode=mode,drop=dropped.length;
   // Real native passenger coordinates, in a clear aisle beside an empty seat.
   if(kind==='ferry'){const k=FERRY_SEATS.findIndex((s,k)=>s.inside&&!ferrySeatOccupied(ferryRide.id,k));const s=FERRY_SEATS[k];ferryRide.u=s.u;ferryRide.v=s.v>0?.22:-.22;ferrySync();}
   else{const p=elPassengerSet(ride.tr,ride.k);const seat=[-.69,0,.69].flatMap(u=>[-1,1].map(side=>({u,side}))).find(s=>!p.some(q=>q.car===ride.car&&q.seated&&q.u===s.u&&q.side===s.side));ride.off=ride.car*EL_CAR_LEN+seat.u;ride.side=0;stepElRide(0);}
   return {oldMode,drop};
  },kind);
  await p.keyboard.press('c');assert.equal(await p.evaluate(kind=>kind==='ferry'?ferryRide.seat!=null:!!ride.seat,kind),true);
  await p.keyboard.press('1');await p.keyboard.press('q');assert.equal(await p.evaluate(()=>inv[0].uses),initial-1,'use an item while seated');
  await p.keyboard.press('c');assert.equal(await p.evaluate(kind=>kind==='ferry'?ferryRide.seat!=null:!!ride.seat,kind),false);
  await p.keyboard.press('x');assert.equal(await p.evaluate(()=>dropped.length),move.drop,'passenger items do not drop into stationary world space');
  await p.keyboard.press('i');await p.keyboard.press('x');assert.equal(await p.evaluate(()=>dropped.length),move.drop,'inventory keeps the same passenger drop policy');assert.ok(!/X drop/.test(await p.locator('#inventory .hint').innerText()));await p.keyboard.press('i');
  const travel=await p.evaluate(kind=>{
   const before=[px,py];T+=kind==='ferry'?FERRY.dwell+10:20;if(kind==='ferry')ferrySync();else stepElRide(0);const travelled=Math.hypot(rel(px-before[0]),rel(py-before[1]));
   a=kind==='ferry'?ferryShip(ferryRide.id).yaw:0;const start=kind==='ferry'?ferryRide.u:ride.off;K.KeyW=1;if(kind==='ferry')stepFerryRide(.1);else stepElRide(.1);K.KeyW=0;
   return {travelled,walked:Math.abs((kind==='ferry'?ferryRide.u:ride.off)-start),mode};
  },kind);
  assert.ok(travel.travelled>.01&&travel.walked>.005,JSON.stringify(travel));assert.equal(travel.mode,kind);
 }));
 test(`${kind}: the camera records the live view and item restrictions follow the actual cabin or open deck`,()=>fixture(kind,async p=>{
  await p.evaluate(kind=>{if(kind==='ferry'){ferryRide.u=0;ferryRide.v=0;ferrySync();}render(0);},kind);
  await p.keyboard.press('8');const before=await p.evaluate(()=>heldItem().uses);await p.keyboard.press('q');
  assert.equal(await p.evaluate(()=>heldItem().uses),before,'firecrackers keep the existing indoor restriction');
  await p.keyboard.press('7');const album=await p.evaluate(()=>homePhotos.photos.length);await p.keyboard.press('q');
  assert.equal(await p.evaluate(()=>homePhotos.photos.length),album+1);assert.ok(await p.evaluate(()=>homePhotos.photos.at(-1).chars.length===48*28));
  if(kind==='ferry'){
   await p.evaluate(()=>{ferryRide.u=-1.5;ferryRide.v=0;ferrySync();T++;render(0);});await p.keyboard.press('8');await p.keyboard.press('q');
   assert.equal(await p.evaluate(()=>heldItem().uses),before-1,'open-deck use supplies outdoor context');
  }
 }));

}
