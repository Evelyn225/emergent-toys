'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('pole lines run down one side of the streets in the Docks and the Yards, their wires clear of everything and of each other',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],poles=kerbs.filter(o=>o.kind==='pole'),guys=kerbs.filter(o=>o.kind==='guy');
  for(const o of poles){
   if(districtAt(o.x-o.fx*.6,o.y-o.fy*.6)!=='industrial')bad.push(['a pole outside the Docks and the Yards',o.x,o.y]);
   if(!o.next&&!o.prev)bad.push('a pole with no wires');
   if(o.h!==(o.ori==='v'?POLE.hv:POLE.hh))bad.push('a pole at the wrong height for its line');
  }
  const pts=[];
  for(const sp of poleSpans){const {p:a,q:b}=sp,across=o=>o.ori==='h'?mod(o.y,8):mod(o.x,8);
   if(a.next!==b||b.prev!==a||a.ori!==b.ori||Math.abs(across(a)-across(b))>1e-9)bad.push('a span between poles of different lines');
   if(sp.len>POLE.span+1e-9)bad.push(['a span too long',sp.len]);
   POLE_WIRES.forEach((w,k)=>{
    for(const [o,t] of [[a,0],[b,1]]){const e=poleWirePoint(sp,w,t);if(Math.hypot(rel(e[0]-o.x-o.fx*w.off),rel(e[1]-o.y-o.fy*w.off),e[2]-o.z-o.h+w.dz)>1e-9)bad.push('a wire end off its pole');}
    for(let n=1;n<60;n++){const [x,y,z]=poleWirePoint(sp,w,n/60),g=terrainHeight(x,y);
     if(z-g<.44)bad.push(['a wire low over the road',+(z-g).toFixed(3)]); // (4.4 m)
     if(map[idx(Math.floor(x),Math.floor(y))]>z)bad.push('a wire through a building');
     if(Math.abs(rel(y-(EL_Y+1)))<EL_HALF)bad.push('a wire under the el');
     const box={x,y,c:1,s:0,hl:.002,hw:.002,z0:z-.002,z1:z+.002};
     const hit=streetGeometryCollision(box,true);if(hit)bad.push(['a wire through',hit.kind]);
     for(const l of lamps)if(Math.abs(rel(l.x-x))<.6&&Math.abs(rel(l.y-y))<.6&&streetFixtureBoxes(l,'lamp').some(b=>streetBoxesOverlap(box,b,0)))bad.push('a wire through a lamp');
     pts.push([x,y,z,sp,k]);}
   });
  }
  // where lines cross over a junction they keep half a metre apart
  const grid=new Map(),key=(x,y)=>Math.floor(x*10)+','+Math.floor(y*10);let close=0;
  for(const q of pts){(grid.get(key(q[0],q[1]))||grid.set(key(q[0],q[1]),[]).get(key(q[0],q[1]))).push(q);}
  for(const q of pts)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const o of grid.get(key(q[0]+i*.1,q[1]+j*.1))||[]){
   if(o[3]===q[3]||o[3].p.ori===q[3].p.ori)continue;
   if(Math.hypot(rel(o[0]-q[0]),rel(o[1]-q[1]))<.03&&Math.abs(o[2]-q[2])<.05)close++;}
  if(close)bad.push(['crossing wires too close',close]);
  for(const g of guys){const o=g.pole,end=o.ori==='h'?Math.sign(rel(g.gx-o.x)):Math.sign(rel(g.gy-o.y));
   if(end<0?o.prev:o.next)bad.push('a guy wire on a pole with a span that way');
   if(!ROAD[idx(Math.floor(g.gx),Math.floor(g.gy))])bad.push('a guy anchored off the street');}
  const ends=poles.reduce((n,o)=>n+!o.prev+!o.next,0);
  for(const o of poles)if(o.drop){const d=o.drop,across=o.ori==='h'?mod(d.y,8):mod(d.x,8);
   if(Math.min(across,2-across)>.003)bad.push(['a service drop ending short of the wall',+across.toFixed(3)]);
   if(!(map[idx(Math.floor(d.x-o.fx*.05),Math.floor(d.y-o.fy*.05))]>d.z))bad.push('a service drop to no building');}
  return {bad:bad.slice(0,10),poles:poles.length,spans:poleSpans.length,guys:guys.length,ends,drops:poles.filter(o=>o.drop).length,cans:poles.filter(o=>o.can).length,v:poles.filter(o=>o.ori==='v').length};
 });
 assert.deepEqual(r.bad,[]);
 assert.ok(r.poles>200&&r.spans>r.poles*.6,`poles ${r.poles}, spans ${r.spans}`);
 assert.ok(r.v>50&&r.poles-r.v>50,'lines along both the avenues and the cross streets');
 assert.ok(r.guys>r.ends*.6,`guys ${r.guys} for ${r.ends} line ends`);
 assert.ok(r.drops>50&&r.cans>50,`drops ${r.drops}, cans ${r.cans}`);
}));

test('each wire sits on its insulator or bracket, wires draw up close and are gone past 100 m, and the pole is solid',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  for(const ori of ['h','v']){const o=kerbs.find(q=>q.kind==='pole'&&q.ori===ori&&q.next);
   px=o.x-o.fx*.15;py=o.y-o.fy*.15;const z=terrainHeight(o.x,o.y),out=[],draw=drawBox;
   drawBox=(box,shade,ray)=>out.push(box);try{drawKerbPole(o,o.x-px,o.y-py,z,true);}finally{drawBox=draw;}
   for(const w of POLE_WIRES){const wx=o.x-px+o.fx*w.off,wy=o.y-py+o.fy*w.off,wz=z+o.h-w.dz;
    const seat=out.some(b=>b.profile?Math.hypot(b.x-wx,b.y-wy)<1e-9&&Math.abs(Math.max(...b.profile.map(q=>q[0]))-wz)<.003 // an insulator's top
     :!b.ax&&b.round==null&&Math.abs(rel(wx-b.x))<=b.hl*Math.abs(b.c)+b.hw*Math.abs(b.s)+1e-9&&Math.abs(rel(wy-b.y))<=b.hl*Math.abs(b.s)+b.hw*Math.abs(b.c)+1e-9&&wz>=b.z0&&wz<=b.z1); // the cable bracket
    if(!seat)bad.push([ori,'a wire with nothing under it',w.off]);
    if(!w.tel&&!out.some(b=>b.round!=null&&b.z1<=wz&&b.z1>wz-.02&&Math.abs((wx-b.x)*b.c+(wy-b.y)*b.s)<=b.hl))bad.push([ori,'an insulator off the arm',w.off]);}
   if(free(o.x,o.y))bad.push([ori,'walked through a pole']);
  }
  const count=(x,y,a_)=>{px=x;py=y;a=a_;dx=Math.cos(a);dy=Math.sin(a);pitch=.3;let n=0;const d0=drawRod;drawRod=(...z)=>{n++;return d0(...z);};try{drawPoleSpans();}finally{drawRod=d0;}return n;};
  const sp=poleSpans[0],mx=sp.p.x+rel(sp.q.x-sp.p.x)/2,my=sp.p.y+rel(sp.q.y-sp.p.y)/2,ux=sp.p.ori==='h'?1:0,uy=1-ux;
  const near=count(mx+sp.p.fx*.5,my+sp.p.fy*.5,Math.atan2(-sp.p.fy,-sp.p.fx));
  // just past 100 m from a span, looking straight at it (other spans further still)
  const WIRE_VIS=10;
  let far=Infinity;for(let k=0;k<poleSpans.length&&far===Infinity;k++){const s=poleSpans[k],cx=s.p.x+rel(s.q.x-s.p.x)/2,cy=s.p.y+rel(s.q.y-s.p.y)/2,x=cx+s.p.fx*(WIRE_VIS+3),y=cy+s.p.fy*(WIRE_VIS+3);
   if(poleSpans.every(o=>Math.hypot(rel(o.p.x-x),rel(o.p.y-y))>WIRE_VIS+.5&&Math.hypot(rel(o.q.x-x),rel(o.q.y-y))>WIRE_VIS+.5))far=count(x,y,Math.atan2(-s.p.fy,-s.p.fx));}
  if(!near)bad.push('no wires drawn beside a span');if(far)bad.push(['wires drawn past 100 m',far]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));
