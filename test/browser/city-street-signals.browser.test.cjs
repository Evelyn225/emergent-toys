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
    const pole=out.find(q=>q.box.profile),head=out.find(q=>q.box.round);
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

test('signal styles reuse fixed geometry and materials with translated closed surfaces, joined cowls and live lamp priority',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof streetSignalModel!=='function')return {bad:['no fixed signal model'],checked:0};
  const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);};let checked=0;
  const capture=(model,x,y,near,on='R',ped='stop',lit=true)=>{const out=[],draw=drawBox;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{model.draw(x,y,near,on,ped,lit);}finally{drawBox=draw;}return out;};
  for(const vert of [false,true])for(const away of [-1,1]){
   const model=streetSignalModel(vert,away),parts=model.parts.slice(),c=vert?0:1,s=vert?1:0;checked++;
   dx=-c*away;dy=-s*away;projX=1000;
   const x=-c*away*.2+.031,y=-s*away*.2+.047,A=capture(model,x,y,true),B=capture(model,x+.01,y+.01,true);
   check(model===streetSignalModel(vert,away)&&parts.every((q,j)=>q===model.parts[j]),'fixed signal model rebuilt');
   check(A.length===B.length&&A.every((q,j)=>q.shade===B[j].shade&&q.ray===B[j].ray&&q.box.profile===B[j].box.profile),'prepared signal rays/materials rebuilt');
   const pole=model.parts.find(p=>p.role==='pole'),P=A.find(p=>p.box.profile),head=model.parts.find(p=>p.role==='head');
   const t=P.ray(x,y,.4,0,0,-1,P.box);
   check(t>0&&Math.abs(HIT.w-SIG.z0)<1e-8&&HIT.nz>.99,'pole has no closed head support');
   check(Math.abs(pole.box.z1-head.box.z0)<1e-9&&pole.box.profile[0][0]===0,'pole floating below head or ground');
   const bracket=model.parts.find(p=>p.role==='bracket').box,ped=model.parts.find(p=>p.role==='pedestrian').box;
   check(Math.hypot(bracket.ax,bracket.ay)<1e-9&&Math.abs(Math.hypot(bracket.bx-ped.x,bracket.by-ped.y)-ped.hl)<1e-9,'pedestrian bracket misses its housing');
   for(const hood of model.parts.filter(p=>p.role==='hood')){
    const H=hood.box,e=Math.sign(H.x*c+H.y*s),inner=(H.x*c+H.y*s)*e-H.hl;
    check(Math.abs(inner-(SIG.hl+.003))<1e-9,'cowl detached from backplate');
    const cheeks=model.parts.filter(p=>p.role==='cheek'&&Math.abs(p.box.z1-H.z0)<1e-9&&Math.sign(p.box.x*c+p.box.y*s)===e);
    check(cheeks.length===2&&cheeks.every(p=>Math.abs(p.box.hl-H.hl)<1e-9&&Math.abs(Math.abs(-p.box.x*s+p.box.y*c)+p.box.hw-H.hw)<1e-9),'cowl cheeks do not join its hood');
   }
   // Exercise the actual translated cap and rod rays, including both glyph coordinates.
   for(const q of model.parts.filter(p=>['far-pole','bracket-line','lens'].includes(p.role))){
    const Q=q.box,mx=x+(Q.ax+Q.bx)/2,my=y+(Q.ay+Q.by)/2,mz=(Q.az+Q.bz)/2;
    const len=Math.hypot(Q.bx-Q.ax,Q.by-Q.ay),nx=len?-(Q.by-Q.ay)/len:1,ny=len?(Q.bx-Q.ax)/len:0;
    const b={...Q,x:Q.x+x,y:Q.y+y},t=q.moved(mx+nx*.1,my+ny*.1,mz,-nx,-ny,0,b);
    check(t>0&&Math.abs(HIT.u-mx)<1e-7&&Math.abs(HIT.v-my)<1e-7,'translated signal rod glyph stays at model origin');
   }
   for(const near of [true,false])for(const on of ['R','Y','G']){
    const out=capture(model,-c*away*.3,-s*away*.3,near,on),lenses=out.filter(q=>q.box.r===.0095);
    check(lenses.length===3,'wrong street-facing lens count');
    check(lenses.every(q=>(q.box.x+c*away*.3)*c*away+(q.box.y+s*away*.3)*s*away>0),'traffic lenses drawn on the hidden face');
    const expected=on==='R'?RED:on==='Y'?YEL:GREEN;let lit=0;
    for(const [j,q]of lenses.entries()){q.shade(0,1,8);if((BG[0]&15)===11){lit++;check(j===0&&(BG[0]>>4)===expected,'live lamp priority/state stale');}}
    check(lit===1,'not exactly one live traffic lamp');
    if(!near)check(out.every(q=>!q.box.profile&&Math.abs(q.box.hw-SIG_PED.hw)>1e-9),'near-only fixtures drawn at distance');
   }
   const thin=capture(model,-c*away*5,-s*away*5,true),physical=A.find(q=>q.ray===model.parts.find(p=>p.role==='bracket').moved),line=thin.find(q=>q.ray===model.parts.find(p=>p.role==='bracket-line').moved);
   check(physical&&line,'thin pedestrian bracket loses its projected fallback');
   check(capture(model,-s*.3,c*.3,true).every(q=>q.box.r!==.0095),'vehicle lamps face across the street');
   for(const [state,lit,col]of [['walk',true,WHITE],['stop',true,ORANGE],['flash',true,ORANGE],['flash',false,ORANGE]]){
    const out=capture(model,x,y,true,'R',state,lit),q=out.find(q=>Math.abs(q.box.hw-SIG_PED.hw)<1e-9);let count=0;
    for(let v=-.9;v<1;v+=.1)for(let z=.05;z<1;z+=.05){HIT.face=away<0?1:2;HIT.v=v*SIG_PED.hw;HIT.w=SIG_PED.z0+z*(SIG_PED.z1-SIG_PED.z0);q.shade(0,.02,8);if((BG[0]&15)>=10){count++;check(BG[0]>>4===col,'cached pedestrian colour stale');}}
    check(lit?count>0:count===0,'cached walk/stop/flash state stale');
   }
  }return {bad:bad.slice(0,14),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,4);
}));

test('native street rasters retain the live vehicle lens and pedestrian walk/steady/flashing hand',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let checked=0;const draw=drawBox,signal=drawSignal;
  for(const vert of [false,true]){
   const s=lights.find(s=>s.vert===vert&&signalled(s.bx,s.by)&&(()=>{const away=Math.sign(s.vert?s.y-s.by-1:s.x-s.bx-1)||1,c=s.vert?0:1,n=s.vert?1:0;return free(s.x-c*away*.075,s.y-n*away*.075);})());
   if(!s){bad.push('no native signal fixture');continue;}
   const c=s.vert?0:1,n=s.vert?1:0,away=Math.sign(s.vert?s.y-s.by-1:s.x-s.bx-1)||1;
   for(const state of ['R','Y','G','walk','stop','flash-on','flash-off']){
    let time=-1;for(let t=0;t<CYCLE;t+=.025){
     const wanted=state==='flash-on'||state==='flash-off'?'flash':state;
     if((state.length===1?light(s.bx,s.by,s.vert,t):pedestrianSignal(s,t))!==wanted)continue;
     if(state==='flash-on'&&fract(t)>.4||state==='flash-off'&&fract(t)<.6)continue;time=t;break;
    }
    if(time<0){bad.push('missing native state '+state);continue;}
    const ped=state.length>1,d=ped?.075:.22,z=ped?.225:.333;px=s.x-c*away*d;py=s.y-n*away*d;a=Math.atan2(s.y-py,s.x-px);freecam={z};pitch=0;T=time;tod=12;env(0);
    let active=false,calls=0;
    drawSignal=q=>{active=q===s;if(active)calls++;try{return signal(q);}finally{active=false;}};
    drawBox=(B,shade,ray)=>{
     const target=active&&(ped?Math.abs(B.hw-SIG_PED.hw)<1e-9&&Math.abs(B.z0-SIG_PED.z0)<1e-9:B.r===.0095);
     return draw(B,target?(i,t,L)=>{const hit=shade(i,t,L);if(hit&&(ped?(BG[i]&15)>=10:(BG[i]&15)===11))BG[i]=C(MAG,15);return hit;}:shade,ray);
    };
    try{render(0);const pixels=Array.from(BG).filter(v=>v===C(MAG,15)).length;
     if(calls===0||(state==='flash-off'?pixels!==0:pixels===0))bad.push([vert,state,calls,pixels]);checked++;
    }finally{drawBox=draw;drawSignal=signal;}
   }
  }freecam=null;return {bad,checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,14);
}));
