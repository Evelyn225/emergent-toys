'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=10;tod=12;env(0);render(0);money=20000;buy('home_belle');const h=owned.homes.find(h=>h.kind==='home_belle');enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},[18,12.5,0]);});
 await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('Belle bistro geometry has closed grounded legs, supported slats and connected rounded backs inside the original footprints at both scales',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);},models=room.props.filter(o=>o.homeBalconyFurniture),draw=drawBox;
  if(models.length!==3)return ['no three shared bistro models'];dx=1;dy=0;projX=10000;projY=6000;
  const capture=(o,scale=1,base=0,vx=o.x,vy=o.y)=>{const out=[];drawBox=(b,shade,ray=rayBox)=>out.push({b:{...b},ref:b,shade,ray});try{if(scale===1)o.draw(vx,vy,o);else o.drawScaled(vx,vy,scale,base);}finally{drawBox=draw;}return out;};
  const dist=(P,A,B)=>{const v=B.map((n,j)=>n-A[j]),w=P.map((n,j)=>n-A[j]),f=clamp(w.reduce((s,n,j)=>s+n*v[j],0)/v.reduce((s,n)=>s+n*n,0),0,1);return Math.hypot(...P.map((n,j)=>n-A[j]-v[j]*f));};
  for(const o of models){
   const meta=o.homeBalconyFurniture,A=capture(o),B=capture(o,1,0,o.x+.1,o.y+.2),W=capture(o,.1,1.6,100,150),W2=capture(o,.1,1.6,100.1,150.2);capture(o);
   check(A.length===meta.parts.length&&A.length>8,'missing furniture parts');
   const rows=A.map((q,j)=>({...q,role:meta.parts[j].role})),legs=rows.filter(q=>q.role==='leg');check(legs.length===4,'not four grounded legs');
   for(const [j,q]of A.entries()){
    const b=q.b,w=W[j].b;check(q.ref===B[j].ref&&q.shade===B[j].shade&&q.ray===B[j].ray&&W[j].ref===W2[j].ref&&W[j].shade===W2[j].shade,'models/materials rebuilt per frame');
    check(Math.abs(w.x-(100+(b.x-o.x)/10))<1e-8&&Math.abs(w.y-(150+(b.y-o.y)/10))<1e-8&&Math.abs(w.z0-(1.6+b.z0/10))<1e-8&&Math.abs(w.z1-(1.6+b.z1/10))<1e-8&&Math.abs(w.hl-b.hl/10)<1e-8&&Math.abs(w.hw-b.hw/10)<1e-8,'world furniture uses different bounds or deck elevation');
    check(b.x-b.hl>=o.x-o.box.hl-1e-8&&b.x+b.hl<=o.x+o.box.hl+1e-8&&b.y-b.hw>=o.y-o.box.hw-1e-8&&b.y+b.hw<=o.y+o.box.hw+1e-8&&b.z0>=-1e-8&&b.z1<=o.box.z1+1e-8,'geometry overhangs original footprint or floats below deck');
    if(b.ax!==undefined){check(Math.abs(w.ax-(100+(b.ax-o.x)/10))<1e-8&&Math.abs(w.by-(150+(b.by-o.y)/10))<1e-8&&Math.abs(w.az-(1.6+b.az/10))<1e-8&&Math.abs(w.r-b.r/10)<1e-8,'tube endpoints/radius not scaled');}
    else{check(Math.abs(w.round-b.round/10)<1e-8,'rounded edges not scaled');const t=q.ray(b.x,b.y,b.z1+.1,0,0,-1,b);check(t>0&&Math.abs(HIT.w-b.z1)<.0002&&HIT.nz>.99,'open or unrounded top cap');}
   }
   for(const q of legs){const b=q.b;check(Math.abs(b.az-b.r)<1e-8,'leg foot floats or sinks');const t=q.ray(b.ax,b.ay,-.1,0,0,1,b);check(t>0&&Math.abs(HIT.w)<.0002&&HIT.nz<-.99,'leg has no closed foot');}
   check(meta.variants.size===2,'unbounded room/city cache');
   if(meta.kind==='chair'){
    const pan=rows.find(q=>q.role==='seat-pan'),slats=rows.filter(q=>q.role==='seat-slat'),posts=rows.filter(q=>q.role==='back-post'),arch=rows.filter(q=>q.role==='back-arch'),rail=rows.find(q=>q.role==='back-rail');
    check(pan&&slats.length===3&&posts.length===2&&arch.length===4&&rail,'missing seat support or shaped back');
    if(pan)check(slats.every(q=>Math.abs(q.b.z0-pan.b.z1)<1e-8&&q.b.z1===o.h),'seat slats float or seating height differs');
    for(const q of arch){const b=q.b;for(const P of [[b.ax,b.ay,b.az],[b.bx,b.by,b.bz]])check(arch.concat(posts).filter(a=>a!==q).some(a=>dist(P,[a.b.ax,a.b.ay,a.b.az],[a.b.bx,a.b.by,a.b.bz])<1e-8),'back arch has a loose endpoint');}
    for(const q of rows.filter(q=>q.role==='back-picket')){const b=q.b;check(dist([b.ax,b.ay,b.az],[rail.b.ax,rail.b.ay,rail.b.az],[rail.b.bx,rail.b.by,rail.b.bz])<1e-8&&arch.some(a=>dist([b.bx,b.by,b.bz],[a.b.ax,a.b.ay,a.b.az],[a.b.bx,a.b.by,a.b.bz])<1e-8),'picket misses its upper/lower rail');}
    for(const q of rows.filter(q=>q.role==='stretcher')){const b=q.b;for(const P of [[b.ax,b.ay,b.az],[b.bx,b.by,b.bz]])check(legs.some(a=>dist(P,[a.b.ax,a.b.ay,a.b.az],[a.b.bx,a.b.by,a.b.bz])<1e-8),'stretcher misses leg');}
    check(o.seat&&o.h===.5&&o.fx*(22.3-o.x)+o.fy*(6-o.y)>0,'chair points away from table');
   }else{
    const top=rows.find(q=>q.role==='tabletop');check(top&&top.b.z1===.78&&rows.filter(q=>q.role==='apron').every(q=>Math.abs(q.b.z1-top.b.z0)<1e-8)&&legs.every(q=>Math.abs(q.b.bz+q.b.r-top.b.z0)<1e-8),'tabletop/apron/leg supports do not join');
   }
  }return bad.slice(0,15);
 });assert.deepEqual(r,[]);
}));

test('all three native bistro pieces are actually visible in room and city views without painted exterior stand-ins',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],draw=drawBox;let checked=0;
  for(const stage of ['room','city']){
   if(stage==='city'){px=22.8;py=12.5;stepHomeBalcony();}
   const b=room.balconyWorld,h=homeRecord();
   if(stage==='room'){px=21.5;py=8.8;freecam={z:1.7};a=Math.atan2(6-py,22.3-px);}
   else{px=b.x0+.25;py=b.y-.12;freecam={z:b.z+.17};a=Math.atan2(b.y-.4-py,b.x0+.33-px);}
   pitch=0;render(0);pitch=((stage==='room'?.6:b.z+.06)-freecam.z)/(stage==='room'?Math.hypot(22.3-px,6-py):Math.hypot(b.x0+.33-px,b.y-.4-py))*projY/rows;render(0);
   if(!free(px,py))bad.push('review camera intersects geometry');
   const models=stage==='room'?room.props.filter(o=>o.homeBalconyFurniture):homeBalconyModels.get(h)?.filter(o=>o.homeBalconyFurniture);
   if(models?.length!==3){bad.push(stage+' set is absent');continue;}
   for(const o of models){let active=false,paints=0;const method=stage==='room'?'draw':'drawScaled',original=o[method];
    o[method]=(...args)=>{active=true;try{return original(...args);}finally{active=false;}};
    drawBox=(b,shade,ray)=>draw(b,active?(i,t,L)=>{const hit=shade(i,t,L);if(hit){paints++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
    try{render(0);const visible=Array.from(BG).filter(c=>c===C(MAG,15)).length;if(paints<5||visible<5)bad.push([stage,o.homeBalconyFurniture.kind,'missing native furniture',paints,visible]);checked++;}
    finally{o[method]=original;drawBox=draw;}
   }
  }freecam=null;return {bad,checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,6);
}));

test('real C sits at both native and outdoor balcony chairs with the correct direction and eye height, then returns to the clear approach',()=>fixture(async page=>{
 for(const stage of ['room','city']){
  await page.evaluate(stage=>{body.seat=null;freecam=null;if(stage==='city'){px=22.8;py=12.5;stepHomeBalcony();const b=room.balconyWorld;px=b.x0+.42;py=b.y-.28;}else{px=23.2;py=7.2;}a=0;pitch=0;render(0);window.bistroApproach=[px,py,eye];},stage);
  assert.equal(await page.evaluate(()=>free(px,py)),true);
  await page.keyboard.press('c');
  const r=await page.evaluate(()=>{render(0);const b=room.balconyWorld;return {seat:body.seat,point:[px,py],height:eye,standing:window.bistroApproach[2],expected:mode==='room'?[22.3,7.2]:[b.x0+.33,b.y-.28],direction:[Math.cos(a),Math.sin(a)]};});
  assert.ok(r.seat);assert.equal(r.seat.h,.5);assert.ok(Math.hypot(...r.point.map((n,j)=>n-r.expected[j]))<1e-8);assert.ok(r.direction[1]<-.999);assert.ok(r.height<r.standing-(stage==='room'?.3:.03));
  await page.keyboard.press('c');assert.equal(await page.evaluate(()=>body.seat),null);assert.equal(await page.evaluate(()=>Math.hypot(px-window.bistroApproach[0],py-window.bistroApproach[1])<1e-8&&free(px,py)),true);
 }
 const r=await page.evaluate(()=>{const bad=[],b=room.balconyWorld;
  if(roofFree(b.x0+.33,b.y-.4)||roofFree(b.x0+.33,b.y-.28))bad.push('table or chair collider missing');
  if(!roofFree(b.x0+.16,b.y-.4))bad.push('bistro set blocks side route');
  px=b.x0+.4;py=b.doorY;for(let k=0;k<36&&mode==='roof';k++)move(-.01,0);
  if(mode!=='room'||!free(px,py))bad.push('door return broken');
  for(const kind of ['home','loft','islandhome','cafe','hotelroom']){enterRoom(kind,{ret:[50,73,0],lobby:{word:'HOTEL',ret:[50,73,0]}},ROOM_DEFS[kind].entry||[4,4,0]);if(room.props.some(o=>o.homeBalconyFurniture))bad.push('unrelated room got bistro set');}
  return bad;});assert.deepEqual(r,[]);
}));

test('subcell bistro metal keeps cached continuous strokes and resolves to closed round tubes nearby',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],draw=drawBox,o=room.props.find(o=>o.homeBalconyFurniture?.kind==='chair');if(!o)return ['no bistro chair'];
  const capture=()=>{const out=[];drawBox=(b,shade,ray)=>out.push({b,shade,ray});try{o.draw(5,0,o);}finally{drawBox=draw;}return out;};dx=1;dy=0;projX=50;projY=30;
  const A=capture(),B=capture(),thin=A.filter(q=>q.ray===rayRod);if(thin.length<10||thin.some(q=>!B.some(p=>p.b===q.b&&p.shade===q.shade&&p.ray===rayRod)))bad.push('subcell strokes missing or rebuilt');
  projX=10000;projY=6000;const near=capture();if(near.some(q=>q.ray===rayRod)||near.filter(q=>q.ray===coveRayCapsule).length!==thin.length)bad.push('tubes stay flat instead of resolving');
  return bad;
 });assert.deepEqual(r,[]);
}));
