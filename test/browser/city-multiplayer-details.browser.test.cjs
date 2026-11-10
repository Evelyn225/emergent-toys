'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']}));test.after(async()=>browser?.close());
async function session(run){const ctx=await browser.newContext({viewport:{width:1280,height:850}}),errors=[];const open=async name=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href+'?net=local');await p.evaluate(()=>{paused=false;room=me=freecam=null;mode='walk';lockMouse=()=>{};T=20;tod=14;env(0);render(0);});return p;};try{const A=await open(),B=await open(),code='details-'+Date.now().toString(36);await A.evaluate(code=>netJoin(code,'Ann'),code);await B.evaluate(code=>netJoin(code,'Bob'),code);await A.waitForFunction(()=>[...net.peers.values()].some(p=>p.hello),null,{polling:100});await B.waitForFunction(()=>[...net.peers.values()].some(p=>p.hello),null,{polling:100});await run(A,B);assert.deepEqual(errors,[]);}finally{await ctx.close();}}
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{polling:100,timeout:10000});
test('police stay synchronized after a fine and after the suspect moves to jail; identities survive list removal',()=>session(async(A,B)=>{
 const state=await B.evaluate(()=>{const b=SERVICES.find(b=>b.kind==='police');px=b.x;py=b.y;globalThis.qaCar=addCar({kind:'police',body:BLUE,x:px,y:py,hx:1,hy:0,patrol:true,pursuit:true});globalThis.qaCop={x:px+.5,y:py,car:qaCar,chase:true,ph:0};footCops.push(qaCop);money=1000;wanted.stars=1;wanted.crime='urination';net.lastSent=null;netSendTick(netNow());return {x:px,y:py,car:qaCar.id,cop:netMyCops().find(c=>c.k==='foot'&&c.x===qaCop.x).id};});
 await A.evaluate(s=>{px=s.x;py=s.y;net.lastSent=null;netSendTick(netNow());},state);
 await wait(B,s=>[...net.peers.values()].some(p=>p.name==='Ann'&&near(netSample(p,netNow())?.x??0,netSample(p,netNow())?.y??0,s.x,s.y)<1),state);
 await wait(A,s=>[...net.cars.values()].some(c=>c.netId.endsWith(':'+s.car)),state);
 assert.equal(await B.evaluate(()=>payFine()),true);await B.evaluate(()=>{net.lastSent=null;netSendTick(netNow());});
 await wait(A,s=>[...net.peers.values()].some(p=>netSample(p,netNow())?.cops?.some(c=>c.k==='foot'&&c.id===s.cop&&c.returning)),state);
 const fine=await A.evaluate(s=>{netSyncCars(netNow());return [...net.cars.values()].some(c=>c.netId.endsWith(':'+s.car)&&c.state==='back');},state);assert.ok(fine);
 await B.evaluate(()=>{const base=SERVICES.find(b=>b.kind==='police');goToJail();enterRoom('jail',{word:'JAIL',ret:[worldCoord(base.x+100),worldCoord(base.y+100),0],until:T+60},[3,3,0]);net.lastSent=null;netSendTick(netNow());});
 await wait(A,()=>[...net.peers.values()].some(p=>netSample(p,netNow())?.rk.startsWith('jail:')));
 const visible=await A.evaluate(s=>{let count=0;const orig=netDrawCops;netDrawCops=(...args)=>{count++;return orig(...args);};render(0);netDrawCops=orig;netSyncCars(netNow());return {count,car:[...net.cars.values()].some(c=>c.netId.endsWith(':'+s.car))};},state);assert.ok(visible.count>0&&visible.car,JSON.stringify(visible));
 const id=await B.evaluate(()=>{const before=netMyCops().find(c=>c.k==='foot'&&c.x===qaCop.x).id;footCops.splice(0,1);return [before,netMyCops().find(c=>c.k==='foot'&&c.x===qaCop.x).id];});assert.equal(id[0],id[1]);
 const returns=await B.evaluate(()=>{qaCop.x=qaCar.x+.01;qaCop.y=qaCar.y;stepReturningPolice(.1);tidyPolice();return cars.includes(qaCar)&&qaCar.returning&&!footCops.includes(qaCop);});assert.ok(returns,'the officer boards the cruiser and the observer keeps its return trip alive');
}));
test('held milk and smoking state reach the other player, use posed anchors and clear when put away',()=>session(async(A,B)=>{
 await B.evaluate(()=>{clearInventory();carryItem({id:'milk',uses:2});fx.smoke=40;fx.smokeKind='joint';net.lastSent=null;netSendTick(netNow());});
 await wait(A,()=>[...net.peers.values()].some(p=>{const s=netSample(p,netNow());return s?.held==='milk'&&s.smoking==='joint'&&s.heldUses===2;}));
 const r=await A.evaluate(()=>{const p=[...net.peers.values()].find(p=>p.name==='Bob'),s=netSample(p,netNow()),look=netFigLook(p);let art=0,rods=0;const a=drawArt,b=drawRod;drawArt=()=>art++;drawRod=()=>rods++;try{netDrawAccessories(p,s,1,0,'stand',false);netDrawAccessories(p,s,2,0,'sit7',true);}finally{drawArt=a;drawRod=b;}const body=figBody(look,'stand');return {art,rods,mouth:body.mouth.every(Number.isFinite),hand:body.hands[0].every(Number.isFinite)};});assert.ok(r.art===2&&r.rods===4&&r.mouth&&r.hand,JSON.stringify(r));
 await B.evaluate(()=>{held=-1;fx.smoke=0;net.lastSent=null;netSendTick(netNow());});await wait(A,()=>[...net.peers.values()].some(p=>{const s=netSample(p,netNow());return s?.held===''&&!s.smoking;}));
}));
test('hose leaves localized wet walls and reflective ground, drains with rain-style drips, then dries',()=>session(async(A)=>{
 const r=await A.evaluate(()=>{
  wet=rain=0;hoseWetPatches.length=0;PARTS.length=0;
  let hit,from,to;for(const d of doors){if(!d.nx&&!d.ny)continue;from=[d.x-Math.sign(d.nx)*.25,d.y-Math.sign(d.ny)*.25,.18];to=[d.x+Math.sign(d.nx)*.25,d.y+Math.sign(d.ny)*.25,.18];hit=hoseSurfaceHit(from,to);if(hit&&!hit.nz)break;}
  if(!hit)return {hit:false};px=from[0];py=from[1];a=Math.atan2(to[1]-py,to[0]-px);pitch=0;render(0);const before=Array.from(BG);
  for(let k=0;k<20;k++)wetHoseImpact(hit,.1);drawHoseWetness();const changed=Array.from(BG).filter((v,i)=>v!==before[i]).length;
  stepHoseWetness(.3);const drips=PARTS.filter(p=>p.kind==='drip').length,marks=hoseWetPatches.length,ground=hoseWetPatches.some(q=>q.nz===1);
  for(const q of hoseWetPatches)if(q.nz===1)q.water=1;
  render(0);const reflected=Array.from(FL).some(f=>f===2);stepHoseWetness(181);
  const o=solids.find(o=>o.kind==='potty'),savedMode=mode,savedRoom=room;mode='room';room={props:[]};let outdoorProps;try{outdoorProps=!!hoseSurfaceHit([o.x+o.c*(o.hl+.03),o.y+o.s*(o.hl+.03),(o.z0+o.z1)/2],[o.x+o.c*(o.hl-.01),o.y+o.s*(o.hl-.01),(o.z0+o.z1)/2]);}finally{mode=savedMode;room=savedRoom;}
  return {hit:true,changed,drips,marks,ground,reflected,dry:hoseWetPatches.length===0,weather:wet===0&&rain===0,outdoorProps};
 });assert.ok(r.hit&&r.changed>0&&r.drips>0&&r.marks>=2&&r.ground&&r.reflected&&r.dry&&r.weather&&r.outdoorProps,JSON.stringify(r));
}));
test('NPC detail transitions keep one outfit and use hysteresis instead of alternating head sprites',()=>session(async(A)=>{
 const r=await A.evaluate(()=>{
  a=0;pitch=0;render(0);const m={seed:67,shirt:BLUE,pants:GRAY},look=streetLook(m),unit=.175/FIG_TALL,out=[];
  for(const level of [1.95,2.05,2.3,1.95,1.7]){const d=unit*projY/level;ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(NONE);drawFigure(d,0,0,.175,-1,0,streetLook(m),'stand',{hold:m,light:10});out.push({tier:m.figRequestedS,same:streetLook(m)===look,skin:look.base[FR.SKIN],shade:look.base[FR.SKIN_D]});}
  return out;
 });assert.deepEqual(r.map(x=>x.tier),[1,1,2,2,1]);assert.ok(r.every(x=>x.same&&x.skin===r[0].skin&&x.shade===r[0].skin));
}));
