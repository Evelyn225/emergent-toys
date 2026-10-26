'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the street lamp up close is turned: base, tapering pole, collar, a neck joined end to end, the drop into the lantern, lit glass after dark',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];projX=10000; // (every tube drawn as a tube, not a line glyph)
  const parts=(top,ax,ay)=>{const out=[],draw=drawBox;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{drawLamp3D(0,0,ax,ay,top);}finally{drawBox=draw;}return out;};
  for(const top of [LAMP_TOP,.7])for(const [ax,ay] of [[1,0],[0,-1]]){
   const ps=parts(top,ax,ay),lathes=ps.filter(q=>q.ray===coveRayLathe),tubes=ps.filter(q=>q.ray===coveRayCapsule).map(q=>q.box);
   const neck=tubes.filter(b=>b.r>.005);
   if(neck.length!==LAMP_NECK_BITS)bad.push(['neck pieces',neck.length]);
   if(Math.hypot(neck[0].ax,neck[0].ay)>1e-9||Math.abs(neck[0].az-top)>1e-9)bad.push('neck not starting at the pole top');
   for(let k=1;k<neck.length;k++)if(Math.hypot(neck[k].ax-neck[k-1].bx,neck[k].ay-neck[k-1].by,neck[k].az-neck[k-1].bz)>1e-9)bad.push(['neck broken at',k]);
   const end=neck[neck.length-1],drop=tubes.find(b=>b.r<.005);
   if(!drop||Math.hypot(drop.ax-end.bx,drop.ay-end.by,drop.az-end.bz)>1e-9)bad.push('drop not hanging from the neck end');
   const lantern=lathes.find(q=>Math.abs(q.box.x-end.bx)<1e-9&&Math.abs(q.box.y-end.by)<1e-9);
   if(!lantern||drop.bz>lantern.box.z1+1e-9||drop.bz<lantern.box.z1-.01)bad.push('drop not entering the lantern cap'); // (it runs into the cap, not short of it)
   const pole=lathes.find(q=>q.box.z0===.062&&q.box.x===0),base=lathes.find(q=>q.box.z0===0&&q.box.x===0);
   if(!pole||!base||Math.abs(base.box.z1-pole.box.z0)>1e-9||Math.abs(pole.box.z1-top)>1e-9)bad.push('pole not standing on its base up to the top');
   const prof=pole&&pole.box.profile;if(prof&&!(prof[1][1]>prof[2][1]))bad.push('pole not tapering');
   // nothing reaches past the lamp's collision post and arm
   for(const q of ps){const b=q.box,reach=Math.hypot(b.x,b.y)+Math.max(b.hl,b.hw);if(reach>2*NECK+.04)bad.push(['part beyond the arm',+reach.toFixed(3)]);if(b.z0<-1e-9)bad.push('below the pavement');}
   // the glass glows after dark
   const glassAt=on=>{lampsOn=on;const q=parts(top,ax,ay).find(q=>q.ray===coveRayLathe&&Math.abs(q.box.x-end.bx)<1e-9&&Math.abs(q.box.y-end.by)<1e-9); // (lit or not is decided as it's drawn)
    if(!q){bad.push('lantern missing at the neck end');return -1;}
    HIT.u=.02*Math.cos(Math.PI/6);HIT.v=.02*Math.sin(Math.PI/6);HIT.w=q.box.z0+.06;HIT.nx=1;HIT.ny=HIT.nz=0;q.shade(0,1,8);return BG[0]>>4;}; // (between two frame bars)
   if(glassAt(1)!==WARM)bad.push('glass not lit at night');if(glassAt(0)===WARM)bad.push('glass lit by day');lampsOn=0;
  }
  return bad.slice(0,8);
 });
 assert.deepEqual(r,[]);
}));

test('street lamp styles cache fixed profiles and moved rays while retaining thin-tube fallback through camera changes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof streetLampModel!=='function')return {bad:['no prepared street lamps'],checked:0};
  const bad=[],draw=drawBox,shape=drawShape;let checked=0;
  const capture=(x,y,ax,ay,top)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});drawShape=()=>{};try{drawLamp3D(x,y,ax,ay,top);}finally{drawBox=draw;drawShape=shape;}return out;};
  const test=(yes,why)=>{if(!yes)bad.push(why);};
  dx=1;dy=0;projX=100;
  for(const top of [LAMP_TOP,.7])for(const [ax,ay]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const model=streetLampModel(ax,ay,top),saved=model.parts.slice(),a=capture(.1,.1,ax,ay,top),b=capture(.12,.12,ax,ay,top);checked++;
   const ribs=model.parts.filter(p=>p.role==='rib');test(ribs.length===6,'lantern has no physical frame ribs');
   for(const p of ribs){const B=p.box,hx=ax*2*NECK,hy=ay*2*NECK;test(Math.abs(B.az-(top-.12))<1e-9&&Math.abs(B.bz-(top-.06))<1e-9&&Math.hypot(B.ax-hx,B.ay-hy)-B.r<=.02&&Math.hypot(B.bx-hx,B.by-hy)-B.r<=.024,'lantern rib misses its lower rim or cap');test(p.fallback===false,'thin frame bars turn into oversized glyphs');}

   test(model===streetLampModel(ax,ay,top)&&model.parts.every((p,j)=>p===saved[j]),'lamp fixed model rebuilt');
   test(a.every((p,j)=>p.shade===b[j].shade&&p.ray===b[j].ray&&p.box.profile===b[j].box.profile),'lamp profiles/materials/rays rebuilt');
   const base=model.parts.findIndex(p=>p.role==='base'),B=a[base].box,t=a[base].ray(B.x,B.y,.2,0,0,-1,B);
   test(t>0&&Math.abs(HIT.w-.062)<1e-8,'translated cast base has an open cap');
   const near=capture(.1,.05,ax,ay,top),far=capture(4.8,0,ax,ay,top),again=capture(4.9,0,ax,ay,top);
   test(far.some((p,j)=>p.ray!==near[j].ray),'thin tubes lose their far fallback');
   test(far.every((p,j)=>p.ray===again[j].ray&&p.shade===again[j].shade),'thin tube fallback rebuilt on movement');
   for(const [j,q]of model.parts.entries())if(q.kind==='tube'){
    const B=near[j].box,Q=q.box,mx=(Q.ax+Q.bx)/2+.1,my=(Q.ay+Q.by)/2+.05,mz=(Q.az+Q.bz)/2;
    // A horizontal cross-ray hits even a vertical drop; use the prepared line ray to verify glyph coordinates.
    const cross=q.lineMoved(mx+.08,my,mz,-1,0,0,{...B,x:.1+Q.x,y:.05+Q.y});
    if(Math.abs(Q.bx-Q.ax)<1e-9)test(cross>0&&Math.abs(HIT.u-mx)<1e-7&&Math.abs(HIT.v-my)<1e-7,'moved wire glyph point stays at model origin');
   }
  }return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,8);
}));

test('a lantern remains visible above you when its supporting post is behind the camera',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='walk';room=me=null;body.z=0;
  const o=lamps.find(o=>districtAt(o.x,o.y)!=='belle'&&(o.top??LAMP_TOP)===LAMP_TOP&&free(o.x+o.ax*.11,o.y+o.ay*.11)),top=o.top??LAMP_TOP;
  px=o.x+o.ax*.11;py=o.y+o.ay*.11;a=Math.atan2(o.ay,o.ax);freecam={z:top-.21};pitch=0;env(0);render(0);pitch=.12/.13*projY/rows;
  const lamp=drawLamp3D,draw=drawBox;let active=false,calls=0,glass=0;
  drawLamp3D=(x,y,...args)=>{active=Math.hypot(x-rel(o.x-px),y-rel(o.y-py))<1e-8;if(active)calls++;try{return lamp(x,y,...args);}finally{active=false;}};
  drawBox=(B,shade,ray)=>{if(active&&B.profile&&Math.abs(B.z1-B.z0-.12)<1e-8){glass++;return draw(B,i=>{BG[i]=C(MAG,15);set(i,' ',0);return true;},ray);}return draw(B,shade,ray);};
  try{render(0);return {calls,glass,pixels:Array.from(BG).filter(c=>c===C(MAG,15)).length,clear:free(px,py)};}finally{drawLamp3D=lamp;drawBox=draw;freecam=null;}
 });assert.equal(r.clear,true);assert.ok(r.calls>0&&r.glass>0&&r.pixels>4,'lamp head wrongly culled with its post: '+JSON.stringify(r));
}));
