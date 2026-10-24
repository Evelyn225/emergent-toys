'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('round fruit packs inside the crate: the bottom layer on the real floor, each upper fruit resting on four below',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out=[],draw=drawBox;projX=10000;
  for(const kind of ['orange','apple','lime']){
   const model=KITCHEN_PRODUCE_CRATE(0,0,kind),d=model.produceCrate,shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const tray=shapes.find(q=>q.ray===foodRayTray),fruit=d.fruit,bad=[];
   for(const [k,q]of fruit.entries()){
    if(Math.abs(q.u)+q.hr>d.inner[0]+1e-9||Math.abs(q.v)+q.hr>d.inner[1]+1e-9)bad.push(['wall',k]);
    const below=fruit.filter(o=>o.layer===q.layer-1&&Math.abs(Math.hypot(o.u-q.u,o.v-q.v,(o.z-q.z)*q.hr/q.vr)-2*q.hr)<1e-9);
    if(q.layer===0){const t=tray.ray(q.u,q.v,q.z-q.vr+.5,0,0,-1,tray.box);if(!(t>0&&Math.abs(t-.5)<1e-6))bad.push(['floor',k,t]);}
    else if(below.length!==4)bad.push(['rest',k,below.length]);
    for(const o of fruit.slice(k+1))if(Math.hypot(o.u-q.u,o.v-q.v,(o.z-q.z)*q.hr/q.vr)<2*q.hr-1e-9)bad.push(['overlap',k]);
   }
   const solids=shapes.filter(q=>q.ray===foodRayEllipsoid||q.ray===coveRayLathe).length;
   out.push({kind,fruit:fruit.length,solids,heap:Math.max(...fruit.map(q=>q.z+q.vr))-d.rim,bad,top:model.box.z1});
  }
  return out;
 });
 for(const q of r){
  assert.deepEqual(q.bad,[],q.kind);assert.ok(q.fruit>=60&&q.solids>=q.fruit,JSON.stringify(q));
  assert.ok(q.heap>0&&Math.abs(q.top-q.heap-.6)<1e-9,`${q.kind} heaps above its rim`);
 }
}));

test('banana hands lie on the crate floor or on the hands beneath, curved, crowned and inside the walls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,model=KITCHEN_PRODUCE_CRATE(0,0,'banana'),d=model.produceCrate,shapes=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const tray=shapes.find(q=>q.ray===foodRayTray),{fingers,crowns}=d.bananas,bad=[];
  const inside=q=>Math.abs(q.u)+Math.abs(q.c)*q.hl+Math.abs(q.s)*q.hw<=d.inner[0]+1e-9&&Math.abs(q.v)+Math.abs(q.s)*q.hl+Math.abs(q.c)*q.hw<=d.inner[1]+1e-9;
  const under=(q,o)=>{const x=q.u-o.u,y=q.v-o.v,a=x*o.c+y*o.s,b=-x*o.s+y*o.c;return (a/o.hl)**2+(b/o.hw)**2<1;};
  const lower=fingers.filter(q=>!q.upper),upper=fingers.filter(q=>q.upper);
  for(const [k,q]of [...fingers,...crowns].entries())if(!inside(q))bad.push(['wall',k]);
  for(const q of lower){const t=tray.ray(q.u,q.v,q.z0+.5,0,0,-1,tray.box);if(!(t>0&&Math.abs(t-.5)<1e-6))bad.push(['floor',q.u,q.v]);}
  const lowerTop=Math.max(...lower.map(q=>q.z1)),held=q=>lower.some(o=>o.hw===PRODUCE_FINGER/2&&under(q,o));
  // Each upper hand bridges the two rows beneath: held on both sides of the gap.
  const bridged=[0,1].map(h=>{const hand=upper.slice(h*20,h*20+20).filter(held);return hand.some(q=>q.v<0)&&hand.some(q=>q.v>0);});
  if(upper.some(q=>Math.abs(q.z0-lowerTop)>1e-9))bad.push(['upper height']);
  // Each finger turns along its arc rather than lying straight.
  const turns=[];for(let k=0;k<fingers.length;k+=4)turns.push(Math.abs(Math.atan2(fingers[k+3].s,fingers[k+3].c)-Math.atan2(fingers[k].s,fingers[k].c)));
  return{bad,lower:lower.length,upper:upper.length,bridged,crowns:crowns.length,turn:Math.min(...turns),
   rendered:shapes.filter(q=>q.ray===foodRayEllipsoid).length,rimClear:lowerTop<=d.rim+1e-9};
 });
 assert.deepEqual(r.bad,[]);assert.equal(r.lower,80);assert.equal(r.upper,40);assert.equal(r.crowns,6);
 assert.deepEqual(r.bridged,[true,true]);assert.ok(r.turn>.6,'fingers curve');
 assert.ok(r.rendered>=126&&r.rimClear,JSON.stringify(r));
}));

test('the juice bar stocks four produce crates on clear floor in place of painted crate lids',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('juicebar',{word:'JUICE',ret:[100,100,0]},[5,4,0]);
  const crates=room.props.filter(q=>q.produceCrate),bad=[];
  for(const q of crates){
   const b=q.box;if(b.x-b.hl<1||b.x+b.hl>room.W-1||b.y-b.hw<1||b.y+b.hw>room.H-1)bad.push(['outside',q.x,q.y]);
   for(const o of room.props)if(o!==q&&o.box&&!o.seat&&Math.abs(o.box.x-b.x)<o.box.hl*Math.abs(o.box.c)+o.box.hw*Math.abs(o.box.s)+b.hl&&Math.abs(o.box.y-b.y)<o.box.hl*Math.abs(o.box.s)+o.box.hw*Math.abs(o.box.c)+b.hw)bad.push(['overlap',q.x,q.y,o.x,o.y]);
  }
  const painted=room.props.filter(q=>q.shade&&q.box&&Math.abs(q.box.z1-.62)<1e-9).length;
  return{kinds:crates.map(q=>q.produceCrate.kind).sort(),bad,painted};
 });
 assert.deepEqual(r.kinds,['apple','banana','lime','orange']);assert.deepEqual(r.bad,[]);assert.equal(r.painted,0);
}));
