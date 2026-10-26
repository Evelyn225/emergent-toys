'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('downpipes run down street fronts from under the cornice, round every moulding, clear of doors; meters beside some',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let jogs=0;
  for(const q of facadePipes){
   const wx=q.x-q.ax*PIPE.off,wy=q.y-q.ay*PIPE.off;
   if(!(map[idx(Math.floor(wx-q.ax*.05),Math.floor(wy-q.ay*.05))]>0))bad.push('no wall behind');
   if(map[idx(Math.floor(wx+q.ax*.05),Math.floor(wy+q.ay*.05))]||!ROAD[idx(Math.floor(wx+q.ax*.1),Math.floor(wy+q.ay*.1))])bad.push('no pavement in front');
   if(districtAt(wx,wy)==='belle')bad.push('on a Belle front');
   if(doors.some(d=>Math.abs(rel(d.x-q.x))<.4&&Math.abs(rel(d.y-q.y))<.4&&Math.abs(rel(d.x-q.x)*q.c+rel(d.y-q.y)*q.s)<.09))bad.push('across a door');
   if(q.pts[0].z>.05||q.pts.at(-1).z+PIPE.head>q.h+1e-9)bad.push('not reaching from the pavement to its head');
   if(q.pts.some(t=>t.out>PIPE.off))jogs++;
   // every leg of the route, and the hopper head, clear of everything on the facade
   for(let n=1;n<q.pts.length;n++){const a0=q.pts[n-1],a1=q.pts[n];
    for(let f=0;f<=1;f+=.25){const z=a0.z+(a1.z-a0.z)*f;if(z<.05)continue;const out=a0.out+(a1.out-a0.out)*f,box={x:wx+q.ax*out,y:wy+q.ay*out,c:q.c,s:q.s,hl:PIPE.r,hw:PIPE.r,z0:z-.002,z1:z+.002};
     const hit=streetGeometryCollision(box,false);if(hit){bad.push(['pipe through',hit.kind,+z.toFixed(3)]);break;}}}
   const head=streetGeometryCollision({x:wx+q.ax*(PIPE.off+.002),y:wy+q.ay*(PIPE.off+.002),c:q.c,s:q.s,hl:.016,hw:.013,z0:q.h-PIPE.head,z1:q.h},false);if(head)bad.push(['hopper head in',head.kind]);
  }
  // drawn parts stay within a hand's width of the wall; the water pours only in the rain
  const q=facadePipes.find(q=>q.meter==='gas')||facadePipes[0];px=q.x+q.ax*.3;py=q.y+q.ay*.3;
  const parts=on=>{rain=on;const out=[],draw=drawBox,shape=drawShape;let water=0;drawBox=(b)=>out.push(b);drawShape=()=>{water++;};try{drawFacadePipe(q,rel(q.x-px),rel(q.y-py));}finally{drawBox=draw;drawShape=shape;}rain=0;return {out,water};};
  const dry=parts(0),wet=parts(.8),vx=rel(q.x-px),vy=rel(q.y-py),wvx=vx-q.ax*PIPE.off,wvy=vy-q.ay*PIPE.off;
  for(const b of dry.out){const c=Math.abs(b.c??1),s=Math.abs(b.s??0),ex=b.hl*c+b.hw*s,ey=b.hl*s+b.hw*c,out=Math.max(Math.abs((b.x-wvx)*q.ax)+ex*Math.abs(q.ax),Math.abs((b.y-wvy)*q.ay)+ey*Math.abs(q.ay));if(out>.06)bad.push(['part off the wall',+out.toFixed(3)]);}
  if(dry.water)bad.push('water with no rain');if(!wet.water)bad.push('no water in the rain');
  return {bad:bad.slice(0,8),pipes:facadePipes.length,meters:facadePipes.filter(q=>q.meter).length,jogs};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.pipes>500,`pipes: ${r.pipes}`);assert.ok(r.meters>100);assert.ok(r.jogs>0,'some pipes step round a moulding');
}));

test('prepared pipe models retain closed supports, joined routes, wall-mounted meters and translated thin-tube coordinates',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof facadePipeModel!=='function')return {bad:['no prepared pipe models'],checked:0};
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);},samples=new Map();let checked=0;
  for(const p of facadePipes){const key=[p.ax,p.ay,p.meter,p.side,p.pts.length>2].join(',');if(!samples.has(key))samples.set(key,p);}
  const draw=drawBox,shape=drawShape,capture=(p,x,y)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});drawShape=()=>{};try{drawFacadePipe(p,x,y);}finally{drawBox=draw;drawShape=shape;}return out;};
  for(const p of samples.values()){
   const model=facadePipeModel(p),saved=model.parts.slice();checked++;dx=1;dy=0;projX=10000;
   const x=.11,y=.07,A=capture(p,x,y),B=capture(p,x+.01,y+.01);
   check(model===facadePipeModel(p)&&model.parts.every((q,j)=>q===saved[j]),'fixed pipe model rebuilt');
   check(A.length===B.length&&A.every((q,j)=>q.shade===B[j].shade&&q.ray===B[j].ray),'pipe surfaces/materials/rays rebuilt');
   const pipes=model.parts.filter(q=>q.role==='pipe');check(pipes.length===p.pts.length-1,'pipe route missing a segment');
   for(let j=1;j<pipes.length;j++){const a=pipes[j-1].box,b=pipes[j].box;check(Math.hypot(a.bx-b.ax,a.by-b.ay,a.bz-b.az)<1e-9,'pipe route is disconnected');}
   const head=model.parts.find(q=>q.role==='hopper'),shoe=model.parts.find(q=>q.role==='shoe').box,first=pipes[0]?.box,last=pipes.at(-1)?.box;
   if(!first||!last){bad.push('pipe route has no rendered segment');continue;}
   check(Math.abs(last.bz-head.box.z0)<1e-9&&Math.hypot(last.bx-head.box.x,last.by-head.box.y)<.003,'pipe stops short of its hopper');
   check(Math.hypot(first.ax-shoe.ax,first.ay-shoe.ay,first.az-shoe.az)<=PIPE.r,'shoe detached from downpipe');
   const H={...head.box,x:x+head.box.x,y:y+head.box.y},t=head.moved(H.x,H.y,H.z1+.1,0,0,-1,H);
   check(t>0&&Math.abs(HIT.w-H.z1)<.0003&&HIT.nz>.99,'hopper has an open or displaced cap');
   for(const q of model.parts.filter(q=>q.role==='bracket')){
    const b=q.box,wall=-PIPE.off,out=b.x*p.ax+b.y*p.ay;
    check(out-b.hw<=wall+1e-9,'bracket floats off wall');
    const z=(b.z0+b.z1)/2;let contact=false;
    for(const q of pipes){const a=q.box;if(z<a.az-PIPE.r||z>a.bz+PIPE.r)continue;const f=clamp((z-a.az)/(a.bz-a.az),0,1),v=(a.ax+(a.bx-a.ax)*f)*p.ax+(a.ay+(a.by-a.ay)*f)*p.ay;
     if(v-PIPE.r<=out+b.hw+1e-9&&v+PIPE.r>=out-b.hw-1e-9)contact=true;}
    check(contact,'bracket misses the actual pipe route');
   }
   const meter=model.parts.find(q=>q.role==='meter');if(meter){
    const b=meter.box,out=b.x*p.ax+b.y*p.ay;check(Math.abs(out-b.hw+PIPE.off)<1e-9,'meter floats from its wall');
    const M={...b,x:x+b.x,y:y+b.y},t=meter.moved(M.x+p.ax*.1,M.y+p.ay*.1,.12,-p.ax,-p.ay,0,M);
    check(t>0&&Math.abs(t-(.1-b.hw))<1e-8,'meter is not a closed translated housing');
    if(p.meter==='gas'){const gas=model.parts.find(q=>q.role==='gas').box;check(gas.az===0&&gas.bz===b.z0&&Math.abs((gas.bx-b.x)*p.c+(gas.by-b.y)*p.s)<1e-9,'gas riser misses ground or meter');}
   }
   for(const q of model.parts.filter(q=>q.tube)){
    const b=q.box,mx=x+(b.ax+b.bx)/2,my=y+(b.ay+b.by)/2,mz=(b.az+b.bz)/2,len=Math.hypot(b.bx-b.ax,b.by-b.ay),nx=len?-(b.by-b.ay)/len:1,ny=len?(b.bx-b.ax)/len:0;
    const t=q.lineMoved(mx+nx*.08,my+ny*.08,mz,-nx,-ny,0,{...b,x:x+b.x,y:y+b.y});
    check(t>0&&Math.abs(HIT.u-mx)<1e-7&&Math.abs(HIT.v-my)<1e-7,'translated pipe glyph stays at model origin');
   }
   projX=100;dx=1;dy=0;const far=capture(p,3.1,.04),thin=capture(p,2.9,.04),again=capture(p,2.91,.04);
   check(far.length===pipes.length&&far.every(q=>pipes.some(p=>p.lineMoved===q.ray)),'distant pipes draw nearby hardware or lose thin fallback');
   check(thin.length===again.length&&thin.every((q,j)=>q.ray===again[j].ray&&q.shade===again[j].shade),'thin-pipe fallback rebuilt after movement');
  }
  return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=24,`native styles checked: ${r.checked}`);
}));

test('native facade rendering shows wall meters on every facing and runoff only in rain',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],draw=drawBox,shape=drawShape,pipe=drawFacadePipe;let checked=0,active=false;
  const samples=[];for(const meter of ['electric','gas'])for(const [ax,ay]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const p=facadePipes.find(p=>p.meter===meter&&p.ax===ax&&p.ay===ay&&free(p.x+p.ax*.14+p.c*p.side*.05,p.y+p.ay*.14+p.s*p.side*.05));if(!p){bad.push('missing native meter facing');continue;}samples.push(p);
  }
  drawFacadePipe=(p,...args)=>{active=p===window.utilityTarget;try{return pipe(p,...args);}finally{active=false;}};
  try{
   for(const p of samples){
    window.utilityTarget=p;mode='walk';room=me=null;body.z=0;T=3.25;tod=12;env(0);rain=0;px=p.x+p.ax*.14+p.c*p.side*.05;py=p.y+p.ay*.14+p.s*p.side*.05;
    const tx=p.x+p.c*p.side*.05-p.ax*.003,ty=p.y+p.s*p.side*.05-p.ay*.003;a=Math.atan2(ty-py,tx-px);freecam={z:.11};pitch=0;
    drawBox=(B,shade,ray)=>draw(B,active&&Math.abs(B.hw-.008)<1e-9&&Math.abs(B.z0-.085)<1e-9?(i,t,L)=>{const hit=shade(i,t,L);if(hit)BG[i]=C(MAG,15);return hit;}:shade,ray);
    render(0);if(!Array.from(BG).some(c=>c===C(MAG,15)))bad.push(['native meter missing',p.meter,p.ax,p.ay]);checked++;
   }
   const p=samples[0];window.utilityTarget=p;drawBox=draw;px=p.x+p.ax*.10+p.c*.01;py=p.y+p.ay*.10+p.s*.01;a=Math.atan2(p.y-py,p.x-px);freecam={z:.03};pitch=0;render(0);pitch=-.02/Math.hypot(.10,.01)*projY/rows;
   for(const wet of [false,true]){
    let calls=0;rain=wet?.8:0;drawShape=(x,y,z,w,h,fn,...rest)=>{
     const water=active&&w===.02&&h===.02;if(water)calls++;
     return shape(x,y,z,w,h,water?(i,...args)=>{const hit=fn(i,...args);if(hit)BG[i]=C(MAG,15);return hit;}:fn,...rest);
    };render(0);const pixels=Array.from(BG).filter(c=>c===C(MAG,15)).length;
    if(wet?calls===0||pixels===0:calls!==0||pixels!==0)bad.push(['native rain mismatch',wet,calls,pixels]);checked++;
   }
  }finally{drawBox=draw;drawShape=shape;drawFacadePipe=pipe;delete window.utilityTarget;freecam=null;rain=0;}
  return {bad,checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,10);
}));
