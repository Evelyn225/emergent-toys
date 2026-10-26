'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('rotated produce retains actual crate floors, fruit axes, stable normals and prepared surfaces',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('fruitshop',{word:'FRUIT',ret:[100,100,0]},[5,5,0]);projX=10000;
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of room.props.filter(o=>o.produceStand)){
   const d=o.produceStand,a=parts(o),b=parts(o),c=d.c,s=d.s;
   for(const t of d.tiers)for(const q of t.crates){
    const x=o.x+c*q.u-s*t.v,y=o.y+s*q.u+c*t.v,tr=a.find(p=>p.box.trayShape&&Math.hypot(p.box.x-x,p.box.y-y)<1e-8);
    if(!tr){bad.push('no rotated tray');continue;}
    const hit=tr.ray(x,y,q.rim+.1,0,0,-1,tr.box),floor=q.rim+.1-hit;
    if(hit<0||Math.abs(floor-q.floor)>1e-8||HIT.nz<.99)bad.push('rotated crate floor wrong');
    const hitWall=tr.ray(x,y,q.rim+.1,-s*.15,c*.15,-.12,tr.box);
    if(hitWall<0)bad.push('rotated inner wall missing');
    for(const m of q.models){const x1=x+c*m.box.x-s*m.box.y,y1=y+s*m.box.x+c*m.box.y;
     const actual=a.find(p=>p.ray===m.ray&&Math.hypot(p.box.x-x1,p.box.y-y1)<1e-8&&Math.abs(p.box.z0-m.box.z0)<1e-8);
     if(!actual||actual.ray===foodRayEllipsoid&&(Math.abs(actual.box.c-c)>1e-9||Math.abs(actual.box.s-s)>1e-9))bad.push('fruit lost its rotated shape');
    }
   }
   const structure=a.filter(q=>q.box.z1>2),reached=new Set(structure.map((q,k)=>q.box.z0===d.top?k:-1).filter(k=>k>=0)),queue=[...reached];
   const local=q=>{const b=q.box;return {u:(b.x-o.x)*d.c+(b.y-o.y)*d.s,v:-(b.x-o.x)*d.s+(b.y-o.y)*d.c,...b};},st=structure.map(local);
   while(queue.length){const k=queue.pop(),A=st[k];st.forEach((B,j)=>{if(!reached.has(j)&&Math.abs(A.u-B.u)<=A.hl+B.hl+1e-8&&Math.abs(A.v-B.v)<=A.hw+B.hw+1e-8&&A.z0<=B.z1+1e-8&&B.z0<=A.z1+1e-8){reached.add(j);queue.push(j);}});}
   if(reached.size!==structure.length)bad.push('awning frame disconnected from posts');
   a.forEach((q,k)=>{if(q.box.profile&&q.box.profile!==b[k].box.profile||q.box.trayShape&&q.box.trayShape!==b[k].box.trayShape)bad.push('produce rebuilt');});
  }return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

test('market fish rest on the ice and bread rests on baskets without intersecting, with fixed display surfaces',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('markethall',{word:'MARKET',ret:[100,100,0]},[5,5,0]);projX=10000;const draw=drawBox,bad=[];
  const parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of room.props.filter(o=>o.marketStall)){
   const d=o.marketStall,a=parts(o),b=parts(o),fruit=a.filter(q=>q.ray===foodRayEllipsoid);
   if(d.kind==='fish')for(const q of fruit)if(Math.abs(q.box.z0-d.top-.045)>1e-8)bad.push('fish sinks into ice');
   if(d.kind==='bread'){
    for(const q of fruit)if(Math.abs(q.box.z0-d.top-.008)>1e-8)bad.push('loaf floats above basket floor');
    for(let j=0;j<fruit.length;j++)for(let k=0;k<j;k++){const A=fruit[j].box,B=fruit[k].box,dx=A.x-B.x,dy=A.y-B.y;
     if((dx*d.c+dy*d.s)**2/(A.hl+B.hl)**2+(-dx*d.s+dy*d.c)**2/(A.hw+B.hw)**2<1-1e-8)bad.push('loaves intersect');}
   }
   const posts=a.filter(q=>q.box.z0===d.top&&q.box.z1===2.15);
   for(const post of posts)for(const q of a.filter(q=>q.box.z1<=2&&q.box.z1>d.top)){const P=post.box,B=q.box,dx=B.x-P.x,dy=B.y-P.y,uu=dx*d.c+dy*d.s,vv=-dx*d.s+dy*d.c;
    const dot=B.c*d.c+B.s*d.s,cross=-B.c*d.s+B.s*d.c,ex=Math.abs(dot)*B.hl+Math.abs(cross)*B.hw,ey=Math.abs(cross)*B.hl+Math.abs(dot)*B.hw;
    if(Math.abs(uu)<P.hl+ex-1e-8&&Math.abs(vv)<P.hw+ey-1e-8)bad.push('goods intersect awning posts');
   }
   const structure=a.filter(q=>q.box.z1>2),reached=new Set(structure.map((q,k)=>q.box.z0===d.top?k:-1).filter(k=>k>=0)),queue=[...reached];
   const local=q=>{const b=q.box;return {u:(b.x-o.x)*d.c+(b.y-o.y)*d.s,v:-(b.x-o.x)*d.s+(b.y-o.y)*d.c,...b};},st=structure.map(local);
   while(queue.length){const k=queue.pop(),A=st[k];st.forEach((B,j)=>{if(!reached.has(j)&&Math.abs(A.u-B.u)<=A.hl+B.hl+1e-8&&Math.abs(A.v-B.v)<=A.hw+B.hw+1e-8&&A.z0<=B.z1+1e-8&&B.z0<=A.z1+1e-8){reached.add(j);queue.push(j);}});}
   if(reached.size!==structure.length)bad.push('awning frame disconnected from posts');
   a.forEach((q,k)=>{if(q.box.profile&&q.box.profile!==b[k].box.profile||q.shade!==b[k].shade)bad.push('market display rebuilt');});
  }return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

test('deli slicer fits its counter and clears the wall, and grinder and slicer wheels have connected shafts',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};projX=10000;
  enterRoom('deli',{word:'DELI',ret:[100,100,0]},[5,5,0]);const o=room.props.find(o=>o.slicer),base=parts(o).find(q=>q.box.z0===o.slicer.z),counter=room.props.find(o=>o.shopCounter);
  if(base.box.y-base.box.hw<1||base.box.y-base.box.hw<counter.box.y-counter.box.hw-1e-9||base.box.y+base.box.hw>counter.box.y+counter.box.hw+1e-9)bad.push('slicer cuts through wall or overhangs counter');
  const ps=parts(o);if(!ps.some(q=>q.box.hw<=.013&&q.box.hl<=.01&&q.box.z0<o.slicer.z+.17&&q.box.z1>o.slicer.z+.17))bad.push('slicer blade has no spindle');
  enterRoom('welding',{word:'WELDING',ret:[100,100,0]},[5,5,0]);const g=room.props.find(o=>o.vice),gp=parts(g);
  if(!gp.some(q=>q.ray===coveRayCapsule&&q.box.r===.008&&Math.abs(q.box.az-g.vice.z-.12)<1e-8&&Math.abs(q.box.by-q.box.ay)>=.17))bad.push('grinder wheels disconnected from motor');
  const rack=room.props.find(o=>o.steelRack),r=parts(rack),c=rack.box.c,s=rack.box.s;
  for(const q of r.filter(q=>q.ray===coveRayCapsule)){const v=-(q.box.x-rack.x)*s+(q.box.y-rack.y)*c;if(v-q.box.r<-.14-1e-8)bad.push('steel passes through rack upright');}
  const gate=room.props.find(o=>o.gate),frame=parts(gate);if(Math.abs(Math.min(...frame.map(q=>q.box.z0)))>1e-8)bad.push('gate floats above floor');
  return bad;
 });assert.deepEqual(bad,[]);
}));

test('curtain hangs from its mounted rail and the chair back joins its base',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('tailor',{word:'TAILOR',ret:[100,100,0]},[5,5,0]);projX=10000;const draw=drawBox,bad=[],parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  const o=room.props.find(o=>o.curtain),ps=parts(o),folds=ps.filter(q=>q.ray===coveRayRounded&&q.box.z0===.05),rail=ps.find(q=>q.ray===coveRayCapsule&&q.box.r===.012);
  const tabs=ps.filter(q=>q.ray===coveRayCapsule&&q.box.r<.006&&q.box.z0<=2.1&&q.box.z1>=2.12);
  if(tabs.length<folds.length)bad.push('curtain floats below rail');
  if(!rail||Math.abs(Math.max(rail.box.ax,rail.box.bx)-10)>.03)bad.push('curtain rail stops short of wall');
  const chair=room.props.find(o=>o.armchair),cp=parts(chair),back=cp.find(q=>q.box.z1===.95),base=cp.find(q=>Math.abs(q.box.z0-.1)<1e-8);
  if(!back||!base||Math.abs(back.box.z0-base.box.z1)>1e-8)bad.push('chair back suspended above base');
  return bad;
 });assert.deepEqual(bad,[]);
}));

test('new machine openings have depth, coin cup clears its cabinet, and printed symbols do not stamp glyphs',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[],draw=drawBox,parts=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};projX=projY=10000;
  for(const [o,height,lo,hi]of [[COFFEE_VENDING(0,0,1,0),.47,.44,.50],[CHANGE_MACHINE(0,0,0,-1),1.06,.45,.47]]){
   const ps=parts(o),q=ps.find(q=>q.box.z0===0&&q.box.z1>1),b=q.box,t=q.ray(b.x-b.s*.6,b.y+b.c*.6,height,b.s,-b.c,0,b);
   // The ray starts60cm in front; cabinet fronts are25/20cm away from its centre.
   if(t<lo||t>hi)bad.push(['flat machine opening',height,t]);
   if(height>1){const cup=ps.find(q=>q.box.profile),v=-(cup.box.x-o.x)*b.s+(cup.box.y-o.y)*b.c;if(v-cup.box.hw<b.hw-1e-8)bad.push('coin cup inside cabinet');}
  }
  const ice=parts(ICE_MACHINE(0,0,0,1)),flake=ice.find(q=>q.box.z0===1.15);Object.assign(HIT,{face:3,u:0,w:1.27});flake.shade(0,.1,8);if(CH[0]!==' ')bad.push('repeated snowflake glyphs');
  for(const o of [CUTTING_TABLE(0,0,1.3,.55,.9),FITTING_MIRROR(0,0,.6,2,-1,0)]){
   for(const q of parts(o))if(q.box.z0===.9||q.box.z0===.08){Object.assign(HIT,{face:q.box.z0===.08?3:5,u:-.3,v:0,w:q.box.z0===.08?.3:.902,nx:0,ny:1,nz:1});q.shade(0,.1,8);if(CH[0]!==' ')bad.push('stamped pattern on fitted surface');}
  }return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

test('stacked suitcases stay within their real support heights and render bounds',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  enterRoom('antiques',{word:'ANTIQUES',ret:[100,100,0]},[5,5,0]);projX=10000;const draw=drawBox,bad=[];
  for(const o of room.props.filter(o=>o.suitcases)){
   const ps=[];drawBox=(box,shade,ray=rayBox)=>ps.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
   for(const [x,y,z0,z1]of o.suitcases.cases)for(const q of ps.filter(q=>q.box.z0>=z0&&q.box.z0<z1))if(q.box.z1>z1+1e-8)bad.push('strap penetrates suitcase above');
   for(const q of ps)if(q.box.y+q.box.hw>o.box.y+o.box.hw+1e-8||q.box.z1>o.box.z1+1e-8)bad.push('suitcase handle or strap outside bounds');
  }return bad.slice(0,8);
 });assert.deepEqual(bad,[]);
}));

test('each hot dog touches two rollers and the complete display fits its supporting tray',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const o=HOTDOG_ROLLER_AT(0,0,1.05),draw=drawBox,ps=[],bad=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>ps.push({box,shade,ray});try{o.draw(0,0);}finally{drawBox=draw;}
  const dogs=ps.filter(q=>q.ray===coveRayCapsule&&q.box.r>.02),rollers=ps.filter(q=>q.ray===coveRayCapsule&&q.box.r<.02);
  if(dogs.length!==3||rollers.length!==6)return ['missing roller surfaces'];
  for(const q of dogs){const d=q.box,contacts=rollers.filter(q=>Math.abs(Math.hypot(d.ay-q.box.ay,d.az-q.box.az)-d.r-q.box.r)<1e-8);if(contacts.length!==2)bad.push('hot dog not supported by two rollers');}
  for(const q of ps)if(Math.abs(q.box.x)+q.box.hl>o.box.hl+1e-8||Math.abs(q.box.y)+q.box.hw>o.box.hw+1e-8||q.box.z1>o.box.z1+1e-8)bad.push('display outside tray envelope');
  return bad;
 });assert.deepEqual(bad,[]);
}));
