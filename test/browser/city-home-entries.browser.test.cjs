'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('home entrance leaves have real recessed panels, closed supported frames and mounted hardware, with cached surfaces',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);};let checked=0;const draw=drawBox;
  for(const kind of ['home','loft','bellehome']){
   enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);const o=room.props.find(p=>p.homeEntry);if(!o){bad.push(kind+' has no fitted entry');continue;}checked++;
   const capture=(x,y)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},ref:box,shade,ray});try{o.draw(x,y);}finally{drawBox=draw;}return out;};
   const A=capture(o.x,o.y),B=capture(o.x+.1,o.y+.2),again=capture(o.x,o.y),{half,leafHalf,parts}=o.homeEntry;
   check(A.length===B.length&&A.every((p,j)=>p.ref===B[j].ref&&p.ray===B[j].ray&&p.shade===B[j].shade&&p.box.profile===B[j].box.profile),'entry surfaces/materials rebuilt');
   const cast=(q,u,v,z,du,dv,dz)=>q.ray(o.x-u,o.y-v,z,-du,-dv,dz,q.box);
   const front=(u,z)=>{let nearest=Infinity;for(const p of again){const t=cast(p,u,1,z,0,-1,0);if(t>0)nearest=Math.min(nearest,t);}return Number.isFinite(nearest)?1-nearest:null;};
   const body=front(0,.5),stile=front(leafHalf-.03,.5);check(body!==null&&stile!==null&&stile-body>.01,'panels are painted flat instead of recessed');
   const tone=(u,z)=>{let nearest=Infinity,hit=null;for(const q of again){const t=cast(q,u,1,z,0,-1,0);if(t>0&&t<nearest){nearest=t;hit=q;}}if(!hit)return -1;cast(hit,u,1,z,0,-1,0);hit.shade(0,nearest,8);return BG[0]&15;};
   check(tone(leafHalf-.03,.5)>tone(0,.5),'recessed panels merge into the stile colour');
   const rail=again[parts.findIndex(p=>p.role==='rail')],lit=face=>{HIT.face=face;HIT.w=.18;HIT.u=HIT.v=0;rail.shade(0,3,10);return BG[0];};eye=1.7;check(lit(5)===lit(3),'unresolved rail edges become bright disconnected cells');
   check(front(leafHalf+.002,1.5)!==null,'leaf reveal has no solid back');
   for(const u of [-half-.045,half+.045])for(const z of [.0349,.035,.0351,2.1899,2.19,2.1901])check(front(u,z)!==null,'frame join has a visible hole');
   const byRole=role=>parts.map((p,j)=>({p,q:again[j]})).filter(({p})=>p.role===role);
   if(['leaf','threshold','handle-plate','handle-post','handle-grip'].some(role=>!byRole(role).length)){bad.push('missing closed door/support/hardware');continue;}
   check(byRole('hinge-barrel').length>=2&&byRole('hinge-plate').length===byRole('hinge-barrel').length,'door has no supported hinges');
   const back=byRole('leaf')[0].q,backHit=cast(back,0,-.1,.5,0,1,0);check(backHit>0&&Math.abs(HIT.v+back.box.hw)<1e-8,'leaf has no closed back');
   for(const {p,q}of byRole('jamb').concat(byRole('head'))){
    const b=p.local;check(Math.abs(-b.y-b.hw)<1e-9,'surround detached from wall');
    const t=cast(q,-b.x,.5,(b.z0+b.z1)/2,0,-1,0);if(t>0)q.shade(0,t,8);check(t>0&&Math.abs(HIT.ny+1)<1e-8,'frame front is open or has the wrong normal');
   }
   const threshold=byRole('threshold')[0].q,t=cast(threshold,0,.06,1,0,0,-1);
   check(t>0&&Math.abs(HIT.w-.035)<.0003,'threshold has no closed supporting top');
   for(const {p,q}of byRole('hinge-barrel')){
    const b=q.box,t=q.ray(b.x,b.y,b.z1+.1,0,0,-1,b);check(t>0&&Math.abs(HIT.w-b.z1)<1e-8&&HIT.nz>.99,'hinge barrel has an open cap');
    const v=-p.local.y,plate=byRole('hinge-plate').find(({p:a})=>a.local.z0===p.local.z0)?.p.local;
    check(plate&&v-p.local.hw<=-plate.y+plate.hw+1e-9&&-plate.y-plate.hw<=.063+1e-9,'hinge is floating off its plate or leaf');
   }
   const plate=byRole('handle-plate')[0].p.local,post=byRole('handle-post')[0].p.local,grip=byRole('handle-grip')[0].p.local;
   check(Math.abs(-plate.y-plate.hw-.063)<1e-9,'handle plate floats off the stile');
   check(Math.abs(-post.ay-(-plate.y+plate.hw))<1e-9&&Math.hypot(post.bx-grip.ax,post.by-grip.ay,post.bz-grip.az)<1e-9,'handle post/grip not connected to mounting plate');
   check(-grip.ay-grip.r-.063>.04,'lever has no finger clearance');
   for(const {p,q}of byRole('handle-grip').concat(byRole('handle-post'))){
    const b=p.local,mx=o.x+(b.ax+b.bx)/2,my=o.y+(b.ay+b.by)/2,mz=(b.az+b.bz)/2,alongX=Math.abs(b.bx-b.ax)>Math.abs(b.by-b.ay),nx=alongX?0:1,ny=alongX?1:0;
    const t=q.ray(mx+nx*.1,my+ny*.1,mz,-nx,-ny,0,q.box);
    check(t>0&&Math.abs(HIT.u-mx)<.02&&Math.abs(HIT.v-my)<.02,'translated hardware remains at the model origin');
   }
   check(parts.every(p=>p.local.z0>=0&&p.local.z1<=2.28&&Math.abs(p.local.x)+p.local.hl<1),'entry extends below floor, above head or beyond native exit wall');
  }return {bad:bad.slice(0,14),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,3);
}));

test('native home entries render the leaf and keep bathroom state, entry routes, E and walking exits intact',()=>fixture(async page=>{
 for(const kind of ['home','loft','bellehome']){
  const r=await page.evaluate(kind=>{
   enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);const o=room.props.find(p=>p.homeEntry);if(!o)return {missing:true};
   px=o.x;py=o.y-2.4;a=Math.PI/2;pitch=-.16;fade=0;const draw=drawBox,original=o.draw;let calls=0,active=false;
   o.draw=(...args)=>{calls++;active=true;try{return original(...args);}finally{active=false;}};
   drawBox=(b,shade,ray)=>draw(b,active&&o.homeEntry.parts.some(p=>p.view===b&&['leaf','panel'].includes(p.role))?(i,t,L)=>{const hit=shade(i,t,L);if(hit)BG[i]=C(MAG,15);return hit;}:shade,ray);
   try{roomWall(0,o.x+.85,.01,1.5,room.def.height,1,1,Math.floor(o.x+.85),room.H-1,1,o.x+.85);const privateWall=CH[0]!==':';render(0);return {privateWall,calls,pixels:Array.from(BG).filter(c=>c===C(MAG,15)).length,grid:room.grid.flatMap(row=>[...row]).filter(c=>c==='D').length,entry:free(...room.def.entry.slice(0,2)),extraCollision:!!o.box,bathroom:room.bathroomDoors?.every(p=>!p.bathroomDoor.pub&&p.bathroomDoor.open===1)};}
   finally{drawBox=draw;o.draw=original;px=o.x;py=o.y-.4;a=Math.PI/2;pitch=0;}
  },kind);
  assert.equal(r.missing,undefined);assert.ok(r.calls>0&&r.pixels>10,JSON.stringify({kind,r}));assert.equal(r.privateWall,true);assert.equal(r.grid,2);assert.equal(r.entry,true);assert.equal(r.extraCollision,false);assert.equal(r.bathroom,true);
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>mode),'walk',kind+' E exit');
  const walk=await page.evaluate(kind=>{enterRoom(kind,{ret:[50,73,0]},ROOM_DEFS[kind].entry);px=room.def.entry[0];py=room.H-1.3;move(0,.02);return mode;},kind);assert.equal(walk,'walk',kind+' walk exit');
 }
 const controls=await page.evaluate(()=>{
  const out=[];for(const kind of ['islandhome','islandshelter','cafe','hotelroom']){enterRoom(kind,{ret:[50,73,0],lobby:{word:'HOTEL',ret:[50,73,0]}},ROOM_DEFS[kind].entry||[4,4,0]);out.push({kind,duplicate:room.props.some(p=>p.homeEntry)});}return out;
 });assert.ok(controls.every(q=>!q.duplicate),JSON.stringify(controls));
}));
