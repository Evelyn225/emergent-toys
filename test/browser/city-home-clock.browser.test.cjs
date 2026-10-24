'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('wall clocks have open rims, fitted dial/back/glass, supported indices, and correctly separated solid hands',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;
  for(const angle of [0,.2,Math.PI/2,Math.PI,Math.PI*1.5]){
   const part={id:'f_clock',key:1,x:0,y:0,z:1.6,a:angle},model=HOME_WALL_CLOCK(part),c=Math.cos(angle),s=Math.sin(angle),shapes=[],bad=[];
   const capture=time=>{tod=time;shapes.length=0;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}};
   const one=role=>shapes.find(q=>q.box.clockRole===role),cast=(q,u,z,v=1,dir=-1)=>q.ray(c*u-s*v,s*u+c*v,part.z+z,-s*dir,c*dir,0,q.box);
   capture(15.5);
   if(cast(one('rim'),0,0)>0||!(cast(one('rim'),.235,0)>0))bad.push('rim opening');
   if(cast(one('dial'),.20,.20)>0)bad.push('square dial corner');
   const front=role=>1-cast(one(role),.03,0),back=role=>-1+cast(one(role),.03,0,-1,1);
   if(Math.abs(front('back')-back('dial'))>1e-7)bad.push('back/dial gap');
   if(!(front('dial')<front('glass')&&back('glass')>front('dial')))bad.push('glass depth');
   const glass=one('glass'),t=cast(glass,.03,0);if(!(t>0)||glass.shade(0,t,8))bad.push('opaque glass');
   if(!(cast(one('minute-hand'),0,-.12)>0)||cast(one('minute-hand'),0,.12)>0)bad.push('3:30 minute');
   if(!(cast(one('hour-hand'),.08,-.0214359354)>0)||cast(one('hour-hand'),-.08,.0214359354)>0)bad.push('3:30 hour');
   // Capsules use world-axis bounds, so measure their actual depth endpoints.
   const capsuleDepth=q=>{const b=q.box;return q.ray===homeClockRayHand?[-s*b.x+c*b.y-b.hw,-s*b.x+c*b.y+b.hw]:[-s*b.ax+c*b.ay-b.r,-s*b.ax+c*b.ay+b.r];};
   const minuteShape=one('minute-hand'),frontMinute=1-cast(minuteShape,0,-.12),backMinute=-1+cast(minuteShape,0,-.12,-1,1);
   if(Math.abs(frontMinute-backMinute-.004)>1e-6||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-7)bad.push('solid hand thickness/normal');
   const hour=capsuleDepth(one('hour-hand')),minute=capsuleDepth(one('minute-hand'));
   if(!(hour[0]>front('dial')&&hour[1]<minute[0]&&minute[1]<back('glass')))bad.push('hand separation');
   const pivot=one('pivot'),pivotFront=1-cast(pivot,0,0);if(!(pivotFront<back('glass')&&cast(pivot,0,0)>0))bad.push('pivot/glass');
   for(const q of shapes.filter(q=>q.box.clockRole==='wall-pad')){
    const b=q.box;if(Math.abs((-s*b.ax+c*b.ay)-b.r+.04)>1e-7||Math.abs((-s*b.ax+c*b.ay)+b.r+.03)>1e-7)bad.push('wall pad');
   }
   for(const q of shapes.filter(q=>q.box.clockRole==='index'))if(capsuleDepth(q)[0]>front('dial')+1e-7)bad.push('floating index');
   for(const q of shapes){const b=q.box;let u,v,z0,z1;
    if(q.ray===coveRayCapsule){u=Math.max(Math.abs(c*b.ax+s*b.ay),Math.abs(c*b.bx+s*b.by))+b.r;v=Math.max(Math.abs(-s*b.ax+c*b.ay),Math.abs(-s*b.bx+c*b.by))+b.r;z0=Math.min(b.az,b.bz)-b.r;z1=Math.max(b.az,b.bz)+b.r;}
    else{u=Math.abs(c*b.x+s*b.y)+b.hl;v=Math.abs(-s*b.x+c*b.y)+b.hw;z0=b.z0;z1=b.z1;}
    if(u>.25+1e-7||v>.04+1e-7||z0<1.35-1e-7||z1>1.85+1e-7)bad.push(['bounds',b.clockRole]);
   }
   for(const time of [0,6,12,23.999]){capture(time);const minute=one('minute-hand'),up=cast(minute,0,.12),down=cast(minute,0,-.12);if(!(up>0)||down>0)bad.push(['midnight/noon minute',time]);if(time===6&&!(cast(one('hour-hand'),0,-.08)>0))bad.push('6am hour');}
   capture(0);const dial=one('dial');const hit=cast(dial,.1,0);if(!(hit>0)||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-7)bad.push('normal');
   out.push({angle,bad,indices:shapes.filter(q=>q.box.clockRole==='index').length});
  }return out;
 });for(const q of r){assert.deepEqual(q.bad,[],JSON.stringify(q));assert.equal(q.indices,12);}
}));

test('an IDEA clock hangs, reads the current time, reloads and packs through normal controls',()=>fixture(async p=>{
 await p.evaluate(()=>{money=30000;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();enterRoom('idea',{word:'IDEA',ret:room.ret},[9,3.8,-Math.PI/2]);render(0);});
 await p.keyboard.press('KeyE');await p.locator('[data-buy="f_clock"]').click();await p.keyboard.press('KeyE');
 await p.evaluate(()=>{mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();held=inv.findIndex(q=>q.id==='f_clock');px=22.2;py=20;a=0;pitch=0;fade=0;render(0);});
 await p.keyboard.press('KeyQ');assert.ok(await p.evaluate(()=>furnishingCandidate().ok));await p.keyboard.press('KeyE');
 assert.ok(await p.evaluate(()=>{const h=homeRecord(),part=homeFurnishings(h).parts[0];return part.id==='f_clock'&&room.props.some(q=>q.furnishingKey===part.key)&&STOCK_WORD.IDEA.includes('f_clock');}));
 const target=await p.evaluate(()=>{tod=14.25;render(0);return {kind:interactionFocus()?.kind,prompt:focusedInteractionPrompt()};});
 assert.equal(target.kind,'home-fixture');assert.match(target.prompt,/read clock/);
 await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>msgText),'The clock reads 14:15.');assert.ok(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].on),'reading does not switch the clock off');
 await p.evaluate(()=>saveGame());await p.reload();await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();px=22.2;py=20;a=0;env(0);render(0);});
 assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].id),'f_clock');
 await p.keyboard.press('KeyF');await p.locator('[data-pack="1"]').click();assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts.length),0);assert.ok(await p.evaluate(()=>inv.some(q=>q.id==='f_clock')));
}));
