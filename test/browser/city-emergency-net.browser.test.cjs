'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const URL_=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href+'?net=local';
let browser;test.before(async()=>browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']}));test.after(async()=>browser?.close());
async function session(run){const ctx=await browser.newContext({viewport:{width:1170,height:800}}),errors=[],roomCode='emergency-'+Date.now().toString(36);const open=async name=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});await p.goto(URL_);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;clearWanted();tod=14;env(0);});await p.evaluate(([code,name])=>netJoin(code,name),[roomCode,name]);return p;};try{const A=await open('Ann'),B=await open('Bob');await A.waitForFunction(()=>[...net.peers.values()].some(p=>p.hello),null,{polling:100,timeout:10000});await B.waitForFunction(()=>[...net.peers.values()].some(p=>p.hello),null,{polling:100,timeout:10000});await run({A,B,open});assert.deepEqual(errors,[]);}finally{await ctx.close();}}
async function until(p,fn,arg,label){try{await p.waitForFunction(fn,arg,{timeout:10000,polling:100});}catch(e){assert.fail(label+': '+e.message);}}
test('shared fire: late join sees the same incident; another player claims, sprays and resolves it once',()=>session(async({A,B,open})=>{
 const id=await A.evaluate(()=>{const b=SERVICES.find(b=>b.kind==='fire');px=b.x;py=b.y;const f=createCityFire([b.x,b.y],'building');for(const n of f.nodes)n.heat=.3;spawnEmergency('fire',[f.x,f.y],f);netSendEmergency();return f.id;});
 await until(B,id=>cityFires.some(f=>f.id===id&&f.crewCar?.ev&&f.crewCar.state==='out'),id,'Bob sees fire and dispatched engine');
 await B.evaluate(id=>{const b=SERVICES.find(b=>b.kind==='fire');enterRoom('firestation',{word:'FIRE DEPT',ret:[...b.door,Math.PI/2]},[3.2,4,-Math.PI/2]);startEmergencyShift('fire');netSendTick(netNow());},id);
 await until(A,()=>{const p=[...net.peers.values()].find(p=>p.name==='Bob'),s=netSample(p,netNow());return s?.veh?.kind==='fire';},null,'Bob signed on and driving');
 assert.equal(await B.evaluate(()=>{const send=net.tx.send;net.tx.send=(type,data,to)=>{if(type==='emergencyAct'&&data.action==='claim'){net.tx.send=send;return;}send(type,data,to);};T+=3;stepEmergencyJob(3);return emergencyJob.call?.id;}),id);
 // Losing the first assignment request must not strand a responder forever.
 await B.evaluate(()=>{T+=1.1;stepEmergencyJob(1.1);});
 await until(A,id=>cityFires.find(f=>f.id===id)?.assigned&&cityFires.find(f=>f.id===id).assigned!==net.selfId,id,'Ann grants Bob the call');
 await until(B,id=>emergencyJob.call?.id===id&&emergencyJob.call.assigned===net.selfId,id,'Bob gets assignment');
 const C=await open('Cam');await until(C,id=>cityFires.some(f=>f.id===id&&f.nodes.every(n=>n.heat===.3)),id,'late join matches heat');
 await B.evaluate(()=>{const j=emergencyJob,f=j.call,c=j.car;let spot;for(let k=0;k<16&&!spot;k++){const x=f.x+Math.cos(k/16*TAU)*.9,y=f.y+Math.sin(k/16*TAU)*.9;if(!map[idx(x,y)]&&f.nodes.every(n=>fireWaterClear(x,y,.17,n.x,n.y,n.z)))spot=[x,y];}Object.assign(c,{x:spot[0],y:spot[1],ex:spot[0],ey:spot[1],v:0});px=c.x;py=c.y;leaveCar();px=c.x;py=c.y-.22;interact();px=spot[0];py=spot[1];render(0);netSendTick(netNow());});
 await until(A,()=>{const p=[...net.peers.values()].find(p=>p.name==='Bob'),s=netSample(p,netNow());return s?.mode==='walk'&&!s.away;},null,'Bob outdoors on foot');
 const before=await B.evaluate(()=>money);
 for(let node=0;node<4;node++){
  await B.evaluate(node=>{const n=emergencyJob.call.nodes[node];a=Math.atan2(n.y-py,n.x-px);pitch=(n.z-(walkGround(px,py)+.17))/Math.hypot(n.x-px,n.y-py)*projY/rows;},node);
  for(let k=0;k<5;k++){await B.evaluate(()=>sprayEmergencyWater(.1));await B.waitForTimeout(170);}
 }
 await until(A,id=>cityFires.find(f=>f.id===id)?.out,id,'authority extinguished');
 await until(C,id=>cityFires.find(f=>f.id===id)?.out,id,'late join sees completion');
 await until(B,id=>cityFires.find(f=>f.id===id)?.out,id,'responder sees completion');
 const result=await B.evaluate(()=>{stepEmergencyJob(.05);const once=money;for(let k=0;k<10;k++)stepEmergencyJob(.05);return {earned:emergencyJob.earned,calls:emergencyJob.calls,once:money===once,money,health:needs.health};});
 assert.equal(result.calls,1);assert.ok(result.earned>=140&&result.once&&result.money>before,JSON.stringify(result));
 // A different peer cannot replace the creator's incident or resurrect it.
 const preserved=await C.evaluate(id=>{const f=cityFires.find(f=>f.id===id),fake={id,kind:'building',x:f.x,y:f.y,rev:1e6,nodes:f.nodes.map(n=>({...n,heat:3})),out:false};acceptEmergencyWire(fake,[...net.peers.values()].find(p=>p.name==='Bob').id);return f.out;},id);assert.ok(preserved);
}));
test('medical call survives its responder disconnecting; a new crew can treat and hand over the same patient',()=>session(async({A,B})=>{
 const id=await A.evaluate(()=>{const b=SERVICES.find(b=>b.kind==='amb');enterRoom('hospital',{word:'HOSPITAL',ret:[...b.door,Math.PI/2]},[1.9,5,-Math.PI/2]);startEmergencyShift('amb');stepEmergencyJob(3);const f=emergencyJob.call,c=emergencyJob.car;Object.assign(c,{x:f.x,y:f.y-.45,ex:f.x,ey:f.y-.45});px=c.x;py=c.y;leaveCar();px=f.x;py=f.y+.15;interact();for(let k=0;k<65;k++){T+=.05;stepEmergencyJob(.05);}netSendEmergency();return f.id;});
 await until(B,id=>medicalCalls.some(f=>f.id===id&&f.stage==='transport'),id,'same patient loaded');
 await A.evaluate(()=>netLeave());
 await until(B,id=>{const f=medicalCalls.find(f=>f.id===id);return f?.owner===net.selfId&&f.stage==='waiting'&&!f.assigned;},id,'patient released after disconnect');
 const result=await B.evaluate(id=>{
  const b=SERVICES.find(b=>b.kind==='amb');enterRoom('hospital',{word:'HOSPITAL',ret:[...b.door,Math.PI/2]},[1.9,5,-Math.PI/2]);startEmergencyShift('amb');stepEmergencyJob(3);
  const j=emergencyJob,f=j.call,c=j.car;if(f.id!==id)return {same:false};
  Object.assign(c,{x:f.x,y:f.y-.45,ex:f.x,ey:f.y-.45});px=c.x;py=c.y;leaveCar();px=f.x;py=f.y+.15;interact();for(let k=0;k<65;k++){T+=.05;stepEmergencyJob(.05);}
  px=c.x;py=c.y+.23;interact();const t=emergencyTarget();Object.assign(c,{x:t.x,y:t.y,ex:t.x,ey:t.y,v:0});px=c.x;py=c.y;stepEmergencyJob(.05);stepEmergencyJob(.05);return {same:true,out:f.out,count:j.calls,earned:j.earned};
 },id);assert.ok(result.same&&result.out&&result.count===1&&result.earned>=95,JSON.stringify(result));
}));
