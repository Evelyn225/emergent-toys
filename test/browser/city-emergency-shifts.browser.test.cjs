'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
const URL_=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href;
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});await p.goto(URL_);await p.evaluate(()=>{paused=false;mode='walk';me=freecam=null;body.z=body.vz=body.crouch=0;tod=14;env(0);clearWanted();reports.length=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('hospital dispatch starts a legal paramedic shift; treat, load, drive, hand over and pay once',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const base=SERVICES.find(b=>b.kind==='amb');enterRoom('hospital',{word:'HOSPITAL',ret:[...base.door,Math.PI/2]},[11.5,8.9,-Math.PI/2]);render(0);
  const focus=interactionFocus()?.kind,prompt=promptText();interact();const j=emergencyJob,legal=wanted.stars===0&&reports.length===0,c=j.car;
  T+=3;stepEmergencyJob(3);const f=j.call;
  Object.assign(c,{x:f.x,y:f.y-.45,ex:f.x,ey:f.y-.45,v:0});px=c.x;py=c.y;leaveCar();
  const stillShift=emergencyJob===j;px=f.x;py=f.y+.15;a=-Math.PI/2;interact();
  for(let k=0;k<65;k++){T+=.05;stepEmergencyJob(.05);}
  const loaded=f.stage==='transport',marked=emergencyTarget()?.what;
  px=c.x;py=c.y+.23;interact();const driving=mode==='drive'&&me===c;
  const t=emergencyTarget();Object.assign(c,{x:t.x,y:t.y,ex:t.x,ey:t.y,v:0});px=c.x;py=c.y;
  const before=money;stepEmergencyJob(.05);stepEmergencyJob(.05);const paid=money-before,count=j.calls;
  for(let k=0;k<10;k++)stepEmergencyJob(.05);
  const once=money-before===paid&&j.calls===count,oldCar=c;endEmergencyShift();
  return {focus,prompt,legal,stillShift,loaded,marked,driving,paid,count,once,finished:emergencyJob===null&&!oldCar.emergencyShift&&!oldCar.siren};
 });assert.equal(r.focus,'emergency-dispatch');assert.match(r.prompt,/paramedic/);assert.ok(r.legal&&r.stillShift&&r.loaded&&r.driving&&r.once&&r.finished,JSON.stringify(r));assert.equal(r.marked,'HOSPITAL HANDOVER');assert.equal(r.count,1);assert.ok(r.paid>=95);
}));
test('fire station dispatch and hose: aiming matters, extinguish every patch, earn one payout',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const base=SERVICES.find(b=>b.kind==='fire');enterRoom('firestation',{word:'FIRE DEPT',ret:[...base.door,Math.PI/2]},[3.2,4,-Math.PI/2]);render(0);
  const focus=interactionFocus()?.kind;interact();const j=emergencyJob,c=j.car;T+=3;stepEmergencyJob(3);const f=j.call;
  Object.assign(c,{x:f.x,y:f.y-.5,ex:f.x,ey:f.y-.5,v:0});px=c.x;py=c.y;leaveCar();px=c.x;py=c.y-.22;interact();const equipped=j.hose;
  px=f.x;py=f.y-.9;a=Math.PI;pitch=0;render(0);K.KeyQ=1;
  const before=f.nodes.reduce((s,n)=>s+n.heat,0);stepEmergencyWater(.1);const miss=f.nodes.reduce((s,n)=>s+n.heat,0)===before;
  const start=money;
  for(const n of f.nodes){
    a=Math.atan2(n.y-py,n.x-px);pitch=(n.z-(walkGround(px,py)+.17))/Math.hypot(n.x-px,n.y-py)*projY/rows;
    for(let k=0;k<110&&n.heat>0;k++){T+=.05;stepEmergencyWater(.05);}
  }
  K.KeyQ=0;stepEmergencyJob(.05);const paid=money-start;for(let k=0;k<10;k++)stepEmergencyJob(.05);
  return {focus,equipped,miss,out:f.out,remaining:f.nodes.map(n=>n.heat),paid,count:j.calls,once:money-start===paid,stillShift:emergencyJob===j};
 });assert.equal(r.focus,'emergency-dispatch');assert.ok(r.equipped&&r.miss&&r.out&&r.once&&r.stillShift,JSON.stringify(r));assert.equal(r.count,1);assert.ok(r.paid>=100);
}));
test('dispatched NPC fire engines have real fires, spray water until out, then return to base',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const b=SERVICES.find(b=>b.kind==='fire');px=b.x;py=b.y;const c=spawnEmergency('fire'),f=c?.fireIncident;if(!c)return {spawned:false};
  let spot;for(let k=0;k<16&&!spot;k++){const x=f.x+Math.cos(k/16*TAU)*.65,y=f.y+Math.sin(k/16*TAU)*.65;if(!map[idx(x,y)]&&f.nodes.every(n=>fireWaterClear(x,y,.21,n.x,n.y,n.z)))spot=[x,y];}
  Object.assign(c,{x:spot[0],y:spot[1],ex:spot[0],ey:spot[1]});evArrive(c);c.until=T;
  const active=fireActive(f),spraying=!!fireCrewTarget(c);stepEmergency(.1);const waits=c.state==='scene';
  for(let k=0;k<400;k++){T+=.05;stepCityFires(.05);}
  stepEmergency(.1);return {spawned:true,active,spraying,waits,out:f.out,back:c.state==='back'};
 });assert.ok(r.spawned&&r.active&&r.spraying&&r.waits&&r.out&&r.back,JSON.stringify(r));
}));
test('car fires remain extinguishable during a response; water cannot pass through buildings',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const base=SERVICES.find(b=>b.kind==='fire'),f=createCityFire([base.x,base.y],'car');
  const car=f.car;if(!car)return {car:false};
  const before=burning(car);stepCarFires(BURN_T+1);const noExplosion=!car.wrecked;
  for(const n of f.nodes)coolFireNode(f,n,10);
  const stopped=!burning(car)&&!car.wrecked&&car.dmg===DMG_BAD;
  const d=doors.find(d=>d.ny>0),clear=fireWaterClear(d.x,d.y-.5,.17,d.x,d.y+.105,.17),blocked=fireWaterClear(d.x,d.y-.5,.17,d.x,d.y+2,.17);
  return {car:true,before,noExplosion,stopped,clear,blocked};
 });assert.ok(r.car&&r.before&&r.noExplosion&&r.stopped&&r.clear&&!r.blocked,JSON.stringify(r));
}));
test('fire station can be entered from the street with E, with clear routes to dispatch, equipment and lockers',()=>fixture(async p=>{
 const front=await p.evaluate(()=>{for(const person of people)person.hidden=true;cars.length=0;const b=SERVICES.find(b=>b.kind==='fire');px=b.door[0];py=b.door[1]-.15;a=Math.PI/2;pitch=0;render(0);return promptText();});assert.match(front,/enter fire station/);
 await p.keyboard.press('KeyE');
 const r=await p.evaluate(()=>{const entered=room?.kind==='firestation';if(!entered)return {entered};const field=roomEscapeField(),points=[[3.2,4.2],[7,2.5],[10.5,9],[3.3,9.5]];return {entered,routes:points.map(([x,y])=>roomOpen(x,y)&&roomWitnessPath({x,y,pose:'stand'},field).length>0)};});assert.ok(r.entered&&r.routes.every(Boolean),JSON.stringify(r));
}));
