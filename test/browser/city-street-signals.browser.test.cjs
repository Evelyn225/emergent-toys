'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('pedestrian heads follow the lights: walk while walkers may start, the hand flashing as the green runs out, steady on red',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],seen=new Set();
  for(const s of lights.filter(s=>signalled(s.bx,s.by)).slice(0,30))for(let t=0;t<CYCLE;t+=.25){
   const ped=pedestrianSignal(s,t),car=light(s.bx,s.by,s.vert,t);seen.add(ped);
   if(ped==='walk'&&(!walkSig(s.bx,s.by,s.vert,t)||car!=='G'))bad.push(['walk when walkers may not start',t]);
   if(ped==='stop'&&car!=='R')bad.push(['a steady hand on',car]);
   if(ped==='flash'&&car==='R')bad.push('a flashing hand on red');
  }
  return {bad:bad.slice(0,6),seen:[...seen].sort()};
 });
 assert.deepEqual(r.bad,[]);assert.deepEqual(r.seen,['flash','stop','walk']);
}));

test('the signal is built: the pole meets the head, a cowl over every lens, the pedestrian head turned to the junction showing its figure',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let checked=0;
  for(const s of lights.filter(s=>signalled(s.bx,s.by)).slice(0,8)){
   const c=s.vert?0:1,sn=s.vert?1:0,away=Math.sign(s.vert?s.y-(s.by+1):s.x-(s.bx+1))||1;
   // stand a little way off along the junction side, so both faces' cowls and the pedestrian head are drawn
   px=s.x-c*away*.3;py=s.y-sn*away*.3;const vx=rel(s.x-px),vy=rel(s.y-py);
   for(const ped of ['walk','stop']){
    let t=0;for(;t<CYCLE;t+=.25)if(pedestrianSignal(s,t)===ped)break;T=t;
    const out=[],draw=drawBox;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{drawSignal(s);}finally{drawBox=draw;}checked++;
    const pole=out.find(q=>q.ray===coveRayLathe),head=out.find(q=>q.ray===coveRayRounded);
    if(!pole||!head||Math.abs(pole.box.z1-head.box.z0)>1e-9)bad.push('pole not meeting the head');
    for(const q of out){const b=q.box,reach=Math.hypot(b.x-vx,b.y-vy)+Math.max(b.hl,b.hw);if(reach>.06)bad.push(['part off the pole',+reach.toFixed(3)]);if(b.z1>SIG.z1+.012)bad.push('above the head');}
    const cowls=out.filter(q=>q.shade===SIG_HOUSING&&Math.abs(q.box.hl-.007)<1e-9);
    if(cowls.length<9)bad.push(['cowls',cowls.length]);
    // the pedestrian head: its lit face toward the junction, the figure's dots in the state's colour
    const pedBox=out.find(q=>Math.abs(q.box.hw-SIG_PED.hw)<1e-9&&Math.abs(q.box.z0-SIG_PED.z0)<1e-9);
    if(!pedBox){bad.push('no pedestrian head');continue;}
    const toward=((pedBox.box.x-vx)*-c*away+(pedBox.box.y-vy)*-sn*away);if(toward<.015)bad.push('pedestrian head not out toward the junction');
    const face=away<0?1:2;let lit=0,col=new Set();
    for(let qv=-.9;qv<=.9;qv+=.1)for(let qz=.05;qz<1;qz+=.05){HIT.face=face;HIT.v=qv*SIG_PED.hw;HIT.w=SIG_PED.z0+qz*(SIG_PED.z1-SIG_PED.z0);pedBox.shade(0,.02,8);if((BG[0]&15)>=10){lit++;col.add(BG[0]>>4);}}
    if(!lit)bad.push(['figure not lit',ped]);if([...col].some(k=>k!==(ped==='walk'?WHITE:ORANGE)))bad.push(['wrong colour for',ped]);
    HIT.face=face===1?2:1;pedBox.shade(0,.02,8);if((BG[0]&15)>=10)bad.push('figure on the back of the head');
   }
  }
  // the flashing hand goes on and off
  const s=lights.find(s=>signalled(s.bx,s.by));let tf=0;for(;tf<CYCLE;tf+=.05)if(pedestrianSignal(s,tf)==='flash')break;
  const litAt=t=>{T=t;const c=s.vert?0:1,sn=s.vert?1:0,away=Math.sign(s.vert?s.y-(s.by+1):s.x-(s.bx+1))||1;px=s.x-c*away*.3;py=s.y-sn*away*.3;const out=[],draw=drawBox;drawBox=(box,shade)=>out.push({box,shade});try{drawSignal(s);}finally{drawBox=draw;}
   const q=out.find(q=>Math.abs(q.box.hw-SIG_PED.hw)<1e-9);let n=0;for(let qv=-.9;qv<=.9;qv+=.1)for(let qz=.05;qz<1;qz+=.05){HIT.face=away<0?1:2;HIT.v=qv*SIG_PED.hw;HIT.w=SIG_PED.z0+qz*(SIG_PED.z1-SIG_PED.z0);q.shade(0,.02,8);if((BG[0]&15)>=10)n++;}return n;};
  const base=Math.floor(tf)+1;const a1=litAt(base+.1),a2=litAt(base+.6);if(pedestrianSignal(s,base+.1)==='flash'&&pedestrianSignal(s,base+.6)==='flash'&&!(a1>0&&a2===0))bad.push(['hand not flashing',a1,a2]);
  return {bad:bad.slice(0,8),checked};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.checked>=8);
}));
