'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
const SHAPES=`const shapes=o=>{const draw=drawBox,out=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return out;};`;

test('every restaurant lamp is a built fixture hanging on a cord from a rose at the ceiling, clear of heads, its parts joined top to bottom',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${SHAPES}
  const rooms=[['dumplings','DUMPLINGS','roundLantern',2],['dimsum','DIM SUM','roundLantern',3],['noodlehouse','NOODLES','roundLantern',2],
   ['kissaten','KISSATEN','tiffanyLamp',3],['pizzeria','PIZZA','heatLamp',3],['chickenshop','CHICKEN','heatLamp',2]],bad=[],counts=[];
  for(const [kind,word,key,n] of rooms){
   enterRoom(kind,{word,ret:[100,100,0]},[5,5,0]);const ceiling=room.def.height||3;
   const lamps=room.props.filter(o=>o[key]);counts.push(lamps.length===n);
   for(const o of lamps){
    const parts=shapes(o).filter(q=>q.ray===coveRayLathe).map(q=>q.box).sort((a,b)=>a.z0-b.z0);
    if(Math.abs(Math.max(...parts.map(b=>b.z1))-ceiling)>1e-9)bad.push([kind,'not up to the ceiling']);
    // each part meets the one above it: no gaps down the stack (a little overlap where pieces seat)
    for(let k=1;k<parts.length;k++)if(parts[k].z0>Math.max(...parts.slice(0,k).map(b=>b.z1))+1e-9)bad.push([kind,'gap',parts[k].z0]);
    const low=Math.min(...parts.map(b=>b.z0));if(low<1.6)bad.push([kind,'head height',low]);
    for(const b of parts)if(Math.hypot(b.x-o.x,b.y-o.y)>1e-9)bad.push([kind,'off axis']);
   }
  }
  return{bad:bad.slice(0,8),counts};
 })()`);
 assert.deepEqual(r.bad,[]);assert.deepEqual(r.counts,[true,true,true,true,true,true]);
}));

test('wire chairs: legs on the floor meeting the seat ring, the low ring where the legs pass, the hoop on its posts; patrons still sit on them',()=>fixture(async p=>{
 const r=await p.evaluate(`(()=>{${SHAPES}
  const rnd=Math.random;Math.random=()=>.1;try{enterRoom('icecream',{word:'ICE CREAM',ret:[100,100,0]},[5.5,6.6,-Math.PI/2]);}finally{Math.random=rnd;}
  const chairs=room.props.filter(o=>o.wireChair),bad=[];
  for(const o of chairs){const w=o.wireChair,parts=shapes(o);
   const legs=parts.filter(q=>q.ray===coveRayCapsule&&Math.min(q.box.az,q.box.bz)<.02);
   if(legs.length!==4)bad.push(['legs',legs.length]);
   const seatRing=parts.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-(w.seat-.06))<1e-9),lowRing=parts.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-.16)<1e-9);
   for(const l of legs){const b=l.box,top=b.az>b.bz?[b.ax,b.ay,b.az]:[b.bx,b.by,b.bz],foot=b.az>b.bz?[b.bx,b.by,b.bz]:[b.ax,b.ay,b.az];
    if(Math.abs(top[2]-(w.seat-.06))>1e-9)bad.push('leg not up to the seat ring');
    if(Math.abs(foot[2]-b.r)>1e-9)bad.push(['leg not on the floor',foot[2],b.r]);
    // where the leg crosses the low ring's height, it passes through the ring's band
    const f=(.165-foot[2])/(top[2]-foot[2]),lx=foot[0]+(top[0]-foot[0])*f-o.x,ly=foot[1]+(top[1]-foot[1])*f-o.y,d=Math.hypot(lx,ly);
    const band=lowRing.box.profile.map(q=>q[1]);if(d<Math.min(...band)-.008||d>Math.max(...band)+.008)bad.push(['low ring misses the legs',+d.toFixed(3)]);
    const sb=seatRing.box.profile.map(q=>q[1]),sd=Math.hypot(top[0]-o.x,top[1]-o.y);if(sd<Math.min(...sb)-.008||sd>Math.max(...sb)+.008)bad.push(['seat ring misses the legs',+sd.toFixed(3)]);
   }
   const hoop=parts.filter(q=>q.ray===homeClockRay);if(hoop.length!==2||hoop.some(q=>q.box.z0<w.seat))bad.push('hoop');
   // the inner ring is held in the hoop: bars run from inside the inner ring's band out into the hoop's
   const B=WIRE_CHAIR_BACK,bars=parts.filter(q=>q.ray===homeClockRayHand).map(q=>{const h=q.box.handShape,cu=(q.box.x-(o.x-w.fx*.17))*w.fy-(q.box.y-(o.y-w.fy*.17))*w.fx; // (its ends are stored along the hoop from the bar's own centre)
    return [Math.hypot(h.ax+cu,h.az-w.back),Math.hypot(h.bx+cu,h.bz-w.back)];});
   if(bars.length<3||bars.some(([r0,r1])=>Math.min(r0,r1)>B.inner[1]||Math.min(r0,r1)<B.inner[0]-1e-9||Math.max(r0,r1)<B.hoop[0]||Math.max(r0,r1)>B.hoop[1]+1e-9))bad.push(['the inner ring floats',bars.length]);
   if(o.h!==w.seat)bad.push('seat height');
  }
  const sat=room.props.filter(o=>o.fig&&/^sit/.test(typeof o.pose==='string'?o.pose:'sit')).length;
  return{bad:bad.slice(0,8),chairs:chairs.length,sat};
 })()`);
 assert.deepEqual(r.bad,[]);assert.equal(r.chairs,6);assert.ok(r.sat>0,'patrons sit on the chairs');
}));

test('Tiffany and heat lamps have closed hollow shades with supported bulbs and sockets inside the open rims',()=>fixture(async p=>{
 const bad=await p.evaluate(`(()=>{${SHAPES}
  enterRoom('kissaten',{word:'KISSATEN',ret:[100,100,0]},[5,5,0]);const bad=[];
  for(const[kind,o,bottom]of [['Tiffany',TIFFANY_LAMP(5,5),1.77],['heat',HEAT_LAMP(5,5,1.8),1.8]]){
   const P=shapes(o),shade=P.find(q=>q.ray===coveRayLathe&&q.box.hl>.1&&Math.abs(q.box.z0-bottom)<1e-8),bulbs=P.filter(q=>q.ray===foodRayEllipsoid);
   const again=shapes(o);if(P.some((q,k)=>q.box.profile&&q.box.profile!==again[k].box.profile))bad.push([kind,'fixed profiles rebuilt during drawing']);
   const up=shade.ray(5,5,bottom-.4,0,0,1,shade.box);if(up>0&&up<.475)bad.push([kind,'rim filled by a glowing disk']);
   const inner=shade.ray(5,5,bottom+.025,1,0,0,shade.box),nx=HIT.nx;
   const outer=1-shade.ray(6,5,bottom+.025,-1,0,0,shade.box),wall=outer-inner;
   if(!(inner>0&&nx<-.5&&wall>.003&&wall<.02))bad.push([kind,'shade lacks a real inner wall',inner,nx,wall]);
   if(bulbs.length!==1){bad.push([kind,'missing real bulb']);continue;}
   const bulb=bulbs[0],b=bulb.box,socket=P.find(q=>q.ray===coveRayLathe&&q!==shade&&q.box.hl<.025&&q.box.z0<b.z1&&q.box.z1>b.z1+.02);
   if(!socket)bad.push([kind,'bulb has no supporting socket']);
   else {
    const top=P.some(q=>{if(q===socket||q.ray!==coveRayLathe)return false;const t=q.ray(5,5,bottom-.4,0,0,1,q.box),z=bottom-.4+t;return t>0&&z>=socket.box.z0&&z<=socket.box.z1+1e-7;});if(!top)bad.push([kind,'socket detached from shade/cap']);
   }
   for(const f of [.1,.25,.5,.75,.9]){const z=b.z0+(b.z1-b.z0)*f,rr=b.hl*Math.sqrt(1-(f*2-1)**2),cavity=shade.ray(5,5,z,1,0,0,shade.box);if(!(cavity>rr))bad.push([kind,'bulb intersects shade']);}
   bulb.ray(5,4,b.z0+(b.z1-b.z0)/2,0,1,0,b);bulb.shade(0,1,0);if((BG[0]&15)<11)bad.push([kind,'bulb is not luminous']);
   shade.ray(6,5,bottom+.025,-1,0,0,shade.box);shade.shade(0,1,0);if((BG[0]&15)>9)bad.push([kind,'whole outer case glows like the bulb']);
  }
  return bad;
 })()`);assert.deepEqual(bad,[]);
}));
