'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=0;T=10;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('Belle ironwork has supported closed posts, joined curved bars, shared corners and identical prepared geometry at metre/city scales',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);};enterRoom('bellehome',{ret:[50,73,0]},ROOM_DEFS.bellehome.entry);
  const rails=room.props.filter(o=>o.homeBalconyRail);if(rails.length!==3)return {bad:['no three fitted rail runs'],checked:0};
  const draw=drawBox,capture=(o,x,y,scale=1,base=0)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box:{...box},ref:box,shade,ray});try{o.drawScaled(x,y,scale,base);}finally{drawBox=draw;}return out;};
  dx=1;dy=0;projX=10000;projY=6000;let checked=0;const all=[],posts=[],corners=[];
  const distance=(P,A,B)=>{const v=B.map((n,j)=>n-A[j]),w=P.map((n,j)=>n-A[j]),n=v.reduce((s,n)=>s+n*n,0),f=clamp(w.reduce((s,n,j)=>s+n*v[j],0)/n,0,1);return Math.hypot(...P.map((n,j)=>n-A[j]-v[j]*f));};
  for(const o of rails){
   const m=o.homeBalconyRail,A=capture(o,o.x,o.y),again=capture(o,o.x+.1,o.y+.2);capture(o,o.x,o.y);
   const v=m.variants.get('1:0');if(!v?.parts){bad.push('near rails use painted fallback');continue;}checked++;
   check(A.length===v.parts.length&&A.every((q,j)=>q.ref===again[j].ref&&q.shade===again[j].shade&&q.ray===again[j].ray&&q.box.profile===again[j].box.profile),'rail profiles/materials/bounds rebuilt after movement');
   const rows=A.map((q,j)=>({...q,role:v.parts[j].role}));all.push(...rows);
   const hand=rows.find(q=>q.role==='handrail')?.box,lower=rows.find(q=>q.role==='lower-rail')?.box;if(!hand||!lower){bad.push('missing supported horizontal rails');continue;}
   for(const q of rows.filter(q=>q.role==='post')){
    const b=q.box,t=q.ray(b.x,b.y,1.3,0,0,-1,b);check(t>0&&Math.abs(HIT.w-1.1)<1e-8&&HIT.nz>.99,'post has no closed finial cap');
    check(b.z0===0&&b.x-b.hl>=20-1e-8&&b.x+b.hl<=25+1e-8&&b.y-b.hw>=3-1e-8&&b.y+b.hw<=17+1e-8,'post foot overhangs the deck or floats');
    check(distance([b.x,b.y,1.045],[hand.ax,hand.ay,hand.az],[hand.bx,hand.by,hand.bz])<1e-8,'handrail misses a post');posts.push(b);
   }
   const bars=rows.filter(q=>q.role==='baluster');check(bars.length>12&&bars.length%3===0,'no joined bowed balusters');
   for(let j=0;j<bars.length;j+=3){const a=bars[j].box,b=bars[j+1].box,c=bars[j+2].box;
    check(Math.hypot(a.bx-b.ax,a.by-b.ay,a.bz-b.az)<1e-9&&Math.hypot(b.bx-c.ax,b.by-c.ay,b.bz-c.az)<1e-9,'baluster knee disconnected');
    check(distance([a.ax,a.ay,a.az],[lower.ax,lower.ay,lower.az],[lower.bx,lower.by,lower.bz])<1e-8&&distance([c.bx,c.by,c.bz],[hand.ax,hand.ay,hand.az],[hand.bx,hand.by,hand.bz])<1e-8,'baluster misses a horizontal rail');
   }
   if(!m.endPosts){
    const cx=Math.max(hand.ax,hand.bx),cy=hand.ax>hand.bx?hand.ay:hand.by;corners.push([cx,cy]);
    for(const q of rows.filter(q=>q.role==='wall-plate'))check(Math.abs(q.box.x-q.box.hl-19)<1e-8,'side rail wall plate detached from facade');
   }
   const base=1.6,world=capture(o,100+(o.x-19)/10,150+(o.y-10)/10,.1,base),twice=capture(o,100.01+(o.x-19)/10,150.02+(o.y-10)/10,.1,base);
   check(world.length===A.length&&world.every((q,j)=>q.ref===twice[j].ref&&q.shade===twice[j].shade&&q.ray===twice[j].ray&&q.box.profile===twice[j].box.profile),'city-scale rail model rebuilt');
   for(const [j,q]of world.entries()){
    const a=A[j].box,b=q.box;check(Math.abs(b.x-(100+(a.x-19)/10))<1e-8&&Math.abs(b.y-(150+(a.y-10)/10))<1e-8&&Math.abs(b.z0-(base+a.z0/10))<1e-8&&Math.abs(b.z1-(base+a.z1/10))<1e-8,'city rail bound differs from metre geometry');
    if(a.ax!=null)check(Math.abs(b.ax-(100+(a.ax-19)/10))<1e-8&&Math.abs(b.by-(150+(a.by-10)/10))<1e-8&&Math.abs(b.az-(base+a.az/10))<1e-8&&Math.abs(b.r-a.r/10)<1e-8,'city tube endpoints/radius not scaled');
    if(a.profile)check(b.profile.every(([z,r],k)=>Math.abs(z-(base+a.profile[k][0]/10))<1e-8&&Math.abs(r-a.profile[k][1]/10)<1e-8),'city post profile not scaled');
   }
   check(m.variants.size===2,'room/city variants not retained');
  }
  for(const [x,y]of corners)check(posts.filter(p=>Math.hypot(p.x-x,p.y-y)<1e-8).length===1,'corner has no single shared post');
  for(const o of rails){const m=o.homeBalconyRail,u=-m.half+m.pitch/2,x=o.x+m.c*u-m.s*.5,y=o.y+m.s*u+m.c*.5;
   check(!all.some(q=>{const t=q.ray(x,y,.6,m.s,-m.c,0,q.box);return t>0&&t<.7;}),'physical gaps are filled solid');}
  return {bad:bad.slice(0,14),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,3);
}));

test('distant balcony runs keep an open cached fallback without preparing close geometry',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof HOME_BALCONY_RAIL!=='function')return ['no rail builder'];const bad=[],draw=drawBox;dx=1;dy=0;projX=50;projY=30;
  for(const [c,s,end]of [[1,0,false],[0,1,true],[-1,0,false]]){
   const o=HOME_BALCONY_RAIL(0,0,c,s,5.94,end,c===-1?1:-1),capture=x=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(x,0);}finally{drawBox=draw;}return out;};
   const A=capture(10),B=capture(10.1),v=o.homeBalconyRail.variants.get('1:0');
   if(A.length!==1||v.parts!==null||A[0].box!==B[0].box||A[0].shade!==B[0].shade)bad.push('far rails prepare/rebuild fine geometry');
   HIT.u=0;HIT.w=1.045;if(!A[0].shade(0,10,8))bad.push('far handrail missing');
   let gaps=0;for(let u=-2.8;u<2.9;u+=.03){HIT.u=u;HIT.w=.6;if(!A[0].shade(0,10,8))gaps++;}if(gaps<20)bad.push('far rail painted as a solid wall');
   projX=10000;capture(.1);if(!v.parts?.length)bad.push('close rail never resolves');projX=50;const C=capture(10);if(C[0].box!==A[0].box||C[0].shade!==A[0].shade)bad.push('return to far rebuilds fallback');
  }return bad;
 });assert.deepEqual(r,[]);
}));

test('subcell balcony bars keep cached continuous strokes in a native view and resolve to rounded surfaces up close',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof HOME_BALCONY_RAIL!=='function')return ['no rail builder'];const bad=[],draw=drawBox;
  enterRoom('bellehome',{ret:[41,73,0]},[21.2,12,0]);a=Math.atan2(-2,3.74);pitch=0;render(0);pitch=(.55-1.7)/Math.hypot(2,3.74)*projY/rows;
  const lineShaders=new Set();let calls=0,pixels=0;
  drawBox=(b,shade,ray)=>{if(ray!==rayRod)return draw(b,shade,ray);calls++;lineShaders.add(shade);
   return draw(b,(i,t,L)=>{const hit=shade(i,t,L);if(hit){pixels++;BG[i]=C(MAG,15);}return hit;},ray);};
  try{render(0);const cached=new Set(lineShaders),count=pixels;lineShaders.clear();render(0);
   if(calls<20||count<30)bad.push('native subcell ironwork has no continuous thin strokes');
   if([...cached].some(s=>!lineShaders.has(s)))bad.push('thin stroke materials rebuilt each frame');
   const o=room.props.find(o=>o.homeBalconyRail),v=o.homeBalconyRail.variants.get('1:0');
   if(!v?.parts){bad.push('thin strokes replace the whole fine model');return bad;}
   for(const p of v.parts.filter(p=>p.tube)){
    const b=p.view,t=rayRod((b.ax+b.bx)/2+1,(b.ay+b.by)/2,(b.az+b.bz)/2,-1,0,0,b);
    if(t<0||Math.abs(HIT.u-(b.ax+b.bx)/2)>1e-5)bad.push('thin stroke loses translated coordinates');
   }
   const capture=[];drawBox=(b,s,ray)=>capture.push({b,s,ray});dx=1;dy=0;projX=10000;projY=6000;o.draw(1,0);
   if(capture.some(q=>q.ray===rayRod)||!capture.some(q=>q.ray===coveRayCapsule))bad.push('resolved bars stay as flat strokes');
  }finally{drawBox=draw;}return bad;
 });assert.deepEqual(r,[]);
}));

test('all three native balcony runs remain visible with no duplicate painted ironwork and block only their measured rail line',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('bellehome',{ret:[41,73,0]},[21.2,12,0]);const rails=room.props.filter(o=>o.homeBalconyRail),bad=[],draw=drawBox;
  if(rails.length!==3)return ['no three native rails'];
  for(const o of rails){
   const m=o.homeBalconyRail;let active=false,pixels=0;const original=o.draw;
   o.draw=(...a)=>{active=true;try{return original(...a);}finally{active=false;}};
   drawBox=(b,shade,ray)=>draw(b,active?(i,t,L)=>{const hit=shade(i,t,L);if(hit){pixels++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
   px=m.endPosts?23.5:21;py=m.endPosts?10:m.s===0&&m.c>0?4.7:15.3;
   const targetX=m.endPosts?o.x:21,targetY=m.endPosts?10:o.y;a=Math.atan2(targetY-py,targetX-px);freecam={z:.6};pitch=0;render(0);
   if(pixels<100)bad.push(['native rail hidden behind painted grid',m.c,m.s,pixels]);
   const ix=targetX+(m.endPosts?-.3:0),iy=targetY+(m.endPosts?0:m.c*.3);
   if(!free(ix,iy))bad.push('old grid still blocks the clear deck approach');
   if(free(targetX,targetY))bad.push('new line collider lets player through rail');
   drawBox=draw;o.draw=original;
  }
  px=23.5;py=10;a=0;freecam={z:.6};pitch=0;render(0);homeOutdoorRay(0);const expected=[BG[0],CH[0],COL[0]];
  for(const u of [0,.13,.2,.24,.37])for(const z of [.2,.6,1.04]){
   homeWall(0,u,.01,z,2,25,10,10);
   if(BG[0]!==expected[0]||CH[0]!==expected[1]||COL[0]!==expected[2])bad.push('legacy painted ironwork remains behind fitted rails');
  }
  if(ROOMW.cell(25,10)!==1.1||ROOMW.cell(21,2)!==1.1)bad.push('native grid edge/height changed');
  freecam=null;return bad;
 });assert.deepEqual(r,[]);
}));

test('native reverse city view retains both horizontal rails when the handrail is wider than a column but thinner than a row',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof HOME_BALCONY_RAIL!=='function')return ['no rail builder'];money=20000;buy('home_belle');const home=owned.homes.find(h=>h.kind==='home_belle'),bad=[],draw=drawBox;
  enterRoom('bellehome',{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[41,73,0]},[22.8,12,0]);stepHomeBalcony();const b=room.balconyWorld;
  px=b.x0+.9;py=b.y;a=Math.PI;freecam={z:b.z+.07};pitch=0;render(0);pitch=(.055-.07)/.306*projY/rows;render(0);
  const model=homeBalconyModels.get(home).find(o=>o.homeBalconyRail),variant=[...model.homeBalconyRail.variants.values()][0];
  if(!variant?.parts)return ['no resolved city rail geometry'];
  try{for(const role of ['handrail','lower-rail']){
   const part=variant.parts.find(p=>p.role===role);if(!part){bad.push('missing '+role);continue;}
   let count=0;drawBox=(box,shade,ray)=>draw(box,box===part.view?(i,t,L)=>{const hit=shade(i,t,L);if(hit){count++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
   render(0);const visible=Array.from(BG).filter(c=>c===C(MAG,15)).length;
   if(count<cols*.5||visible<cols*.4)bad.push([role,'lost row coverage',count,visible,cols]);
  }}finally{drawBox=draw;freecam=null;}return bad;
 });assert.deepEqual(r,[]);
}));

test('native room and city views draw the same resolved ironwork, preserve open deck routes and allow clearance above the rail',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof HOME_BALCONY_RAIL!=='function')return {bad:['no fitted balcony rails'],views:0};
  const bad=[],factory=HOME_BALCONY_RAIL,draw=drawBox;let active=null,wanted=1,mark=false,calls=0,profiles=new Set(),bounds=[];
  HOME_BALCONY_RAIL=(...args)=>{
   const o=factory(...args),roomDraw=o.draw,cityDraw=o.drawScaled;
   o.draw=(...a)=>{const previous=active;active=1;if(wanted===1)calls++;try{return roomDraw(...a);}finally{active=previous;}};
   o.drawScaled=(...a)=>{const previous=active;active=a[2]??1;if(wanted===active)calls++;try{return cityDraw(...a);}finally{active=previous;}};return o;
  };
  drawBox=(b,shade,ray)=>{
   const target=active===wanted&&b.profile;if(target){profiles.add(b.profile);bounds.push({...b});}
   return draw(b,target&&mark?(i,t,L)=>{const hit=shade(i,t,L);if(hit)BG[i]=C(MAG,15);return hit;}:shade,ray);
  };
  let views=0;
  try{
   money=20000;buy('home_belle');const home=owned.homes.find(h=>h.kind==='home_belle');if(!home)return {bad:['no native property'],views};
   enterRoom('bellehome',{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[41,73,0]},[23.7,12,0]);body.z=body.vz=0;pitch=0;render(0);pitch=(.55-1.7)/1.24*projY/rows;
   for(const stage of ['room','city']){
    if(stage==='city'){px=22.8;py=12;stepHomeBalcony();const b=room.balconyWorld;px=b.x0+.4;py=b.doorY;a=0;pitch=0;render(0);pitch=(.055-.17)/(b.x1-.006-px)*projY/rows;wanted=.1;}
    mark=false;render(0);const before=Array.from(BG);calls=0;profiles=new Set();bounds=[];mark=true;render(0);
    const pixels=Array.from(BG).filter((v,i)=>v===C(MAG,15)&&before[i]!==v).length,first=new Set(profiles);
    if(calls===0||profiles.size===0||pixels===0)bad.push([stage,'native rounded posts missing',calls,profiles.size,pixels]);
    if(stage==='city'){
     const b=room.balconyWorld;if(!bounds.every(q=>q.hl<=.0060001&&Math.abs(q.z0-b.z)<1e-8&&Math.abs(q.z1-b.z-.11)<1e-8))bad.push('native city posts use room scale or wrong floor');
    }
    profiles=new Set();render(0);if([...first].some(p=>!profiles.has(p)))bad.push('native rail profiles rebuilt on next frame');views++;
   }
   const b=room.balconyWorld,points=[[b.x1-.002,b.doorY],[b.x0+.3,b.y0+.002],[b.x0+.3,b.y1-.002]];
   body.z=0;if(points.some(([x,y])=>roofFree(x,y)))bad.push('rail boundaries let grounded player through');
   if(!roofFree(b.x0+.3,b.y))bad.push('a rail collider spans the deck');
   body.z=1.2;if(points.some(([x,y])=>!roofFree(x,y)))bad.push('rail collider remains solid above its actual height');body.z=0;
   px=b.x0+.1;py=b.doorY;leaveHomeBalcony();if(mode!=='room'||!free(px,py))bad.push('rail change broke return inside');
  }finally{HOME_BALCONY_RAIL=factory;drawBox=draw;body.z=0;}
  return {bad,views};
 });assert.deepEqual(r.bad,[]);assert.equal(r.views,2);
}));
