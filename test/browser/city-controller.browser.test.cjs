'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
async function fixture(run){const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=game=null;T=100;sleep=null;third=false;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=false;
  px=SKATEPARK.bx*8+5.5;py=SKATEPARK.by*8+3.8;a=0;body.z=body.vz=0;
  window.testPad={index:0,id:'Standard test controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0}))};window.padPolls=0;
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{padPolls++;return testPad?[testPad]:[];}});
  let clock=performance.now();window.padFrame=(count=1)=>{for(let i=0;i<count;i++){clock+=1000/60;loop(clock);}};
  window.padButton=(index,down)=>{testPad.buttons[index].value=down?1:0;padFrame();};
  window.padTap=index=>{padButton(index,true);padButton(index,false);};padFrame();
 });await run(page);assert.deepEqual(errors,[]);}finally{await browser.close();}}

test('controller walks analog, looks, jumps and interacts; disconnect clears held controls',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const start=px;testPad.axes[1]=-.6;padFrame(15);const gentle=px-start;
  px=start;body.mx=body.my=0;testPad.axes[1]=-1;padFrame(15);const full=px-start;
  testPad.axes[1]=0;testPad.axes[2]=.7;const before=a;padFrame(12);const looked=a-before;testPad.axes[2]=0;
  padButton(0,true);const jump=body.vz>0&&K.Space;padButton(0,false);
  const old=interact;let calls=0;interact=()=>{calls++;};padButton(2,true);padFrame(8);padButton(2,false);interact=old;
  const oldUse=useHeldItem;useHeldItem=()=>{};
  padButton(7,true);testPad.buttons[7].value=0;CONTROLLER.active=false;padFrame();const inactiveRelease=!K.KeyQ;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));padButton(7,true);padButton(7,false);const keyboardPreserved=!!K.KeyQ;
  window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ',bubbles:true}));
  padButton(7,true);const used=K.KeyQ;useHeldItem=oldUse;testPad=null;padFrame();
  return {gentle,full,looked,inactiveRelease,keyboardPreserved,jump:!!jump,calls,used:!!used,cleared:!K.KeyQ&&!K.Space,paused};
 });assert.ok(r.gentle>.015&&r.full>r.gentle*1.7,JSON.stringify(r));assert.ok(r.looked>.1);assert.ok(r.jump);assert.equal(r.calls,1);assert.ok(r.used&&r.cleared&&r.paused&&r.inactiveRelease&&r.keyboardPreserved);
}));

test('controller navigates actions, inventory, settings and map search without a keyboard',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];padTap(3);if(CONTROLLER.sheet?.style.display!=='flex')bad.push('actions not open');
  padTap(1);padTap(12);if(invEl?.style.display!=='flex')bad.push('D-pad inventory not open');
  const items=controllerControls(invEl),select=invEl.querySelector('select');controllerFocus(invEl,items.indexOf(select));const oldSlot=quickSlots.indexOf(0);
  padTap(15);if(quickSlots.indexOf(0)===oldSlot)bad.push('quick slot did not change');
  padButton(1,true);padFrame(3);if(paused||K.KeyC)bad.push('back leaked into crouch');padButton(1,false);
  openShop('GROCERY',['water']);padFrame();const cash=money,count=inv.length;
  const buy=shopEl.querySelector('[data-buy]');controllerFocus(shopEl,controllerControls(shopEl).indexOf(buy));padButton(0,true);padFrame(5);padButton(0,false);
  if(inv.length!==count+1||money>=cash)bad.push('controller purchase failed or repeated');padTap(1);
  openStorage();padFrame();const carried=inv.length,storedBefore=stored.length;
  const store=storeEl.querySelector('[data-store]');controllerFocus(storeEl,controllerControls(storeEl).indexOf(store));padTap(0);
  if(inv.length!==carried-1||stored.length!==storedBefore+1)bad.push('controller storage failed');padTap(1);
  padTap(9);if(!paused||pauseEl?.style.display!=='flex')bad.push('pause not open');
  const resume=pauseEl.querySelector('[data-act="resume"]');controllerFocus(pauseEl,controllerControls(pauseEl).indexOf(resume));testPad.axes[1]=.45;padFrame();
  if(document.activeElement===resume)bad.push('menu needs excessive stick travel');testPad.axes[1]=0;padFrame();
  const controls=controllerControls(pauseEl),slider=pauseEl.querySelector('[data-set="controllerLook"]'),old=settings.controllerLook;
  controllerFocus(pauseEl,controls.indexOf(slider));padTap(15);if(settings.controllerLook<=old)bad.push('slider did not adjust');
  padTap(9);if(paused)bad.push('Start did not resume');
  padTap(8);if(!bigMapOpen())bad.push('map not open');
  padTap(3);if(CONTROLLER.keyboard?.style.display!=='flex')bad.push('typing not open');
  padTap(0);padTap(15);padTap(0);padTap(2);
  if(BIGMAP.query!=='q')bad.push(['typing/erase failed',BIGMAP.query]);
  padTap(1);if(!bigMapOpen()||CONTROLLER.keyboard.style.display!=='none')bad.push('typing back closed map');
  padTap(1);if(bigMapOpen()||paused)bad.push('map did not close');return bad;
 });assert.deepEqual(r,[]);
}));

test('one poll per skating frame; camera modifier never pops and diagonal carving never brakes',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const pulses=[];testPad.vibrationActuator={playEffect:(kind,value)=>{pulses.push(value);return Promise.resolve();},reset:()=>Promise.resolve()};
  fx.skating=true;SK.lastT=T;SK.v=.4;SK.dir=a;padFrame();
  const before=padPolls;padFrame(10);const polls=padPolls-before;
  testPad.axes[0]=.7;testPad.axes[1]=.7;padFrame(8);const accidentalBrake=SK_INPUT.back;
  testPad.axes[0]=testPad.axes[1]=0;padButton(4,true);testPad.axes[3]=1;padFrame();testPad.axes[3]=-1;padFrame();
  const whileLooking=!!body.trick;padButton(4,false);padFrame(2);const afterLooking=!!body.trick;
  testPad.axes[3]=0;padFrame(7);testPad.axes[3]=1;padFrame(2);testPad.axes[3]=-1;padFrame();
  return {polls,accidentalBrake,whileLooking,afterLooking,popped:body.trick?.name,pulsed:pulses.some(p=>p.duration===45),steer:SK_INPUT.steer};
 });assert.equal(r.polls,10);assert.equal(r.accidentalBrake,false);assert.equal(r.whileLooking,false);assert.equal(r.afterLooking,false);assert.equal(r.popped,'ollie');assert.equal(r.pulsed,true);
}));

test('controller supplies proportional vehicle throttle and held activity controls',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];mode='drive';me=cars.find(c=>!c.parked&&c.kind==='car')||cars[0];me.player=true;me.wrecked=false;me.spunT=0;me.v=0;px=me.x;py=me.y;a=Math.atan2(me.hy,me.hx);testPad.buttons[7].value=.35;
  // Read controller values without a vehicle/world step, then compare depths.
  controllerTick(1/60);const low=CONTROLLER.motion.throttle;drive(1/60);const slow=me.v;me.v=0;testPad.buttons[7].value=.8;controllerTick(1/60);const high=CONTROLLER.motion.throttle;drive(1/60);const fast=me.v;
  mode='walk';me=null;testPad.buttons[7].value=0;startGame('pong','arcade');padFrame();padButton(0,true);padButton(12,true);
  const held=!!K.Space&&!!K.ArrowUp;padButton(0,false);padButton(12,false);padTap(9);const pausedGame=paused&&!!game;
  padTap(9);padTap(1);return {low,high,slow,fast,held,pausedGame,left:!game,bad};
 });assert.ok(r.low>.3&&r.high>r.low+.3);assert.ok(r.fast>r.slow*1.8,JSON.stringify(r));assert.ok(r.held&&r.pausedGame&&r.left);
}));

test('controller operates boats and aircraft, with directional fallback for transit and parachutes',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const b=fleet[0];sea=b;mode='sea';a=Math.atan2(b.hy,b.hx);px=b.x;py=b.y;b.v=0;
  testPad.buttons[7].value=.35;controllerTick(1/60);stepSea(1/60);const slow=b.v;
  b.v=0;testPad.buttons[7].value=.8;controllerTick(1/60);stepSea(1/60);const fast=b.v;
  testPad.buttons[7].value=0;controllerTick(1/60);
  const c=aircraft.find(c=>c.type==='prop');c.owned=true;enterAircraft(c);c.x=RUNWAY.x0+1;c.y=RUNWAY.y;c.yaw=0;
  testPad.axes[0]=.7;testPad.axes[1]=-.5;testPad.buttons[7].value=.4;controllerTick(1/60);
  const flight=[airInput(0),airInput(1)];stepFlight(1/60);const powered=c.throttle>0;
  mode='ferry';testPad.axes[0]=0;testPad.axes[1]=-1;testPad.buttons[7].value=0;controllerTick(1/60);const passenger=!!K.KeyW;
  mode='walk';chute={};controllerTick(1/60);const canopy=!!K.KeyW;chute=null;testPad.axes[1]=0;controllerTick(1/60);
  return {slow,fast,flight,powered,passenger,canopy,clear:!K.KeyW};
 });assert.ok(r.slow>0&&r.fast>r.slow*1.8,JSON.stringify(r));assert.ok(r.flight[0]>.1&&r.flight[1]<-.1);assert.ok(r.powered&&r.passenger&&r.canopy&&r.clear);
}));
