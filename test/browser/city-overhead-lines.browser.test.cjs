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
  const count=(x,y,a_)=>{px=x;py=y;a=a_;dx=Math.cos(a);dy=Math.sin(a);pitch=.3;let n=0;const d0=drawBox;drawBox=(...z)=>{n++;return d0(...z);};try{drawPoleSpans();}finally{drawBox=d0;}return n;};
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

test('cached poles and span detail levels keep their real contact points, closed surfaces and camera-relative wire glyph coordinates',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof poleSpanModel!=='function')return {bad:['wire spans not cached'],checked:0};
  const bad=[],draw=drawBox,test=(yes,why)=>{if(!yes)bad.push(why);};let checked=0;
  const capture=(model,x,y,z)=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{model.draw(x,y,z);}finally{drawBox=draw;}return out;};
  for(const o of kerbs.filter(o=>o.kind==='pole'&&o.can&&o.drop).slice(0,12)){
   const model=kerbModel(o,true),parts=model.parts,saved=parts.slice(),a=capture(model,.2,.1,o.z),b=capture(model,.3,.25,o.z+.4),c=capture(model,.4,.3,o.z+.4);checked++;
   test(kerbModel(o,true)===model&&parts.every((p,i)=>p===saved[i]),'pole model rebuilt');
   test(a.every((p,i)=>p.shade===b[i].shade&&b[i].ray===c[i].ray&&p.box.profile===b[i].box.profile),'pole shapes/materials/rays rebuilt');
   const lathes=parts.filter(p=>p.box.profile),radius=p=>Math.max(...p.box.profile.map(q=>q[1]));
   const body=lathes.find(p=>Math.abs(radius(p)-POLE.r0)<1e-9),can=lathes.find(p=>Math.abs(radius(p)-.027)<1e-9),bush=lathes.filter(p=>Math.abs(radius(p)-.0032)<1e-9);
   test(!!body&&!!can&&bush.length===2,'missing transformer bushings or pole');if(!body||!can)continue;
   const index=parts.indexOf(body),B=b[index].box,t=b[index].ray(B.x,B.y,o.z+o.h+.6,0,0,-1,B);
   test(t>0&&Math.abs(HIT.w-(o.z+o.h+.4))<1e-7,'translated closed pole top missing');
   for(const q of bush){
    const B=q.box,t=can.ray(B.x,B.y,can.box.z1+.05,0,0,-1,can.box);test(t>0&&HIT.w>B.z0&&HIT.w<B.z1,'bushing floats above can');
    const join=parts.some(p=>p.box.az!=null&&Math.hypot(p.box.ax-B.x,p.box.ay-B.y,p.box.az-B.z1)<1e-8);test(join,'transformer lead misses bushing cap');
   }
   const ex=rel(o.drop.x-o.x),ey=rel(o.drop.y-o.y),wall=parts.find(p=>!p.box.profile&&p.box.ax==null&&p.box.round==null&&Math.abs((p.box.z1-p.box.z0)-.016)<1e-8);
   test(!!wall,'missing service-drop bracket');if(wall){const d=(wall.box.x-ex)*o.fx+(wall.box.y-ey)*o.fy-wall.box.hl;test(Math.abs(d+.002)<1e-9,'service bracket floats off wall');}
  }
  for(const sp of poleSpans.slice(0,8))for(const n of [3,6,12]){
   const model=poleSpanModel(sp,n),a=capture(model,.3,.2,.4),b=capture(model,.4,.3,.5);checked++;
   test(model===poleSpanModel(sp,n)&&model.parts.length===4*n,'span detail cache rebuilt or missing wires');
   for(let j=0;j<model.parts.length;j++){
    const P=model.parts[j],B=a[j].box,Q=P.box,mx=(Q.ax+Q.bx)/2+.3,my=(Q.ay+Q.by)/2+.2,mz=(Q.az+Q.bz)/2+.4;
    const t=a[j].ray(mx,my,mz+.05,0,0,-1,B);
    test(t>0&&Math.hypot(HIT.u-mx,HIT.v-my,HIT.w-mz)<1e-7,'cached wire glyph coordinates do not follow the camera');
    test(a[j].shade===b[j].shade&&a[j].ray===b[j].ray,'span per-draw surface preparation');
   }
   for(let w=0;w<4;w++){
    const A=model.parts[w*n].box,Z=model.parts[(w+1)*n-1].box,expected=poleWirePoint(sp,POLE_WIRES[w],0),end=poleWirePoint(sp,POLE_WIRES[w],1);
    test(Math.hypot(A.ax-rel(expected[0]-sp.p.x),A.ay-rel(expected[1]-sp.p.y),A.az-expected[2])<1e-8&&Math.hypot(Z.bx-rel(end[0]-sp.p.x),Z.by-rel(end[1]-sp.p.y),Z.bz-end[2])<1e-8,'cached span endpoints detached');
    for(let k=1;k<n;k++){const p=model.parts[w*n+k-1].box,q=model.parts[w*n+k].box;test(Math.hypot(p.bx-q.ax,p.by-q.ay,p.bz-q.az)<1e-9,'cached sagged wire disconnected');}
   }
  }return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=30);
}));

test('guy-wire guards reach their anchors at both detail levels and their solid foot follows the sloped wire rather than its empty box',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],test=(yes,why)=>{if(!yes)bad.push(why);};let checked=0;
  for(const o of kerbs.filter(o=>o.kind==='guy').slice(0,40)){
   const base=terrainHeight(o.x,o.y),ground=o.gz-base,rise=o.pole.z+o.pole.h-.05-o.gz,anchor=rel(o.gx-o.x)*o.c+rel(o.gy-o.y)*o.s,pole=rel(o.pole.x-o.x)*o.c+rel(o.pole.y-o.y)*o.s;checked++;
   for(const near of [false,true]){
    const parts=kerbModel(o,near).parts,guard=parts.find(p=>Math.abs(p.box.r-.0035)<1e-9),eye=parts.find(p=>p.box.profile&&Math.abs(Math.max(...p.box.profile.map(q=>q[1]))-.006)<1e-9);
    test(!!guard&&!!eye,'guy guard or ground anchor missing');if(!guard||!eye)continue;
    test(Math.max(guard.box.az,guard.box.bz)>=o.gz+.16-1e-9,'yellow guard too short');
    test(eye.box.z0===o.gz&&Math.min(guard.box.az,guard.box.bz)-guard.box.r<=eye.box.z1,'guard detached from grounded anchor');
   }
   for(const h of [.002,.03,.12,.19]){
    const u=anchor+(pole-anchor)*h/rise;
    test(kerbFootprint(o,u,0,.0001,ground+h-.001,ground+h+.001),'ball passes through guy wire or anchor');
   }
   test(!kerbFootprint(o,o.hl-.002,o.hw-.001,.0001,.10,.11),'empty guy bounding corner blocks movement');
   test(!kerbFootprint(o,anchor,0,.0001,.11,.12),'invisible vertical wall above anchor');
  }return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=20);
}));

test('a service-drop wall bracket remains visibly rendered when looking away from the pole body',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=kerbs.find(o=>o.kind==='pole'&&o.drop&&o.ori==='v'),to=o.drop;
  mode='walk';room=me=null;px=o.x-o.fx*.14+o.c*.04;py=o.y-o.fy*.14+o.s*.04;
  a=Math.atan2(rel(to.y-py),rel(to.x-px));freecam={z:to.z+.02};pitch=0;env(0);render(0);pitch=-.02/Math.hypot(rel(to.x-px),rel(to.y-py))*projY/rows;
  const draw=drawBox,pole=KERB_DRAW.pole;let active=false,calls=0,plates=0;
  KERB_DRAW.pole=(q,...args)=>{if(q===o)calls++;active=q===o;try{return pole(q,...args);}finally{active=false;}};
  drawBox=(box,shade,ray)=>{
   if(active&&box.profile==null&&box.ax==null&&box.round==null&&Math.abs(box.z1-box.z0-.016)<1e-8){plates++;return draw(box,(i)=>{BG[i]=C(MAG,15);set(i,' ',0);return true;},ray);}
   return draw(box,shade,ray);
  };
  try{render(0);return {calls,plates,pixels:Array.from(BG).filter(c=>c===C(MAG,15)).length,clear:free(px,py)};}finally{drawBox=draw;KERB_DRAW.pole=pole;freecam=null;}
 });assert.equal(r.clear,true);assert.ok(r.calls>0,'pole attachments wrongly culled with the body');assert.ok(r.plates>0&&r.pixels>4,'actual wall bracket is not visible');
}));
