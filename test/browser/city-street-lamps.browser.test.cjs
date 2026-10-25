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
    HIT.u=.02*Math.cos(Math.PI/6);HIT.v=.02*Math.sin(Math.PI/6);HIT.w=q.box.z0+.06;HIT.nx=1;HIT.ny=HIT.nz=0;q.shade(0,1,8);return BG[0]>>4;}; // (between two frame bars)
   if(glassAt(1)!==WARM)bad.push('glass not lit at night');if(glassAt(0)===WARM)bad.push('glass lit by day');lampsOn=0;
  }
  return bad.slice(0,8);
 });
 assert.deepEqual(r,[]);
}));
