'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('roaster drum has a closed horizontal shell with world normals and an actually open hopper',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});
  try{KITCHEN_COFFEE_ROASTER(0,0).draw(0,0);}finally{drawBox=draw;}
  const drum=shapes.find(q=>q.ray===kitchenRayRoastDrum),hopper=shapes.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-1.06)<1e-6);
  const hit=(q,x,y,z,rx,ry,rz)=>{const t=q.ray(x,y,z,rx,ry,rz,q.box);return{t,z:z+rz*t,n:[HIT.nx,HIT.ny,HIT.nz]};};
  return{front:hit(drum,0,2,.78,0,-1,0),top:hit(drum,0,0,2,0,0,-1),side:hit(drum,2,0,.78,-1,0,0),
   throat:hit(hopper,0,0,2,0,0,-1),inner:hit(hopper,.10,0,2,0,0,-1),rim:hit(hopper,.222,0,2,0,0,-1)};
 });
 assert.ok(Math.abs(r.front.t-1.74)<1e-6&&r.front.n[1]>.99);assert.ok(Math.abs(r.top.z-1.07)<1e-6&&r.top.n[2]>.99);
 assert.ok(Math.abs(r.side.t-1.71)<1e-6&&r.side.n[0]>.99);assert.ok(r.throat.t<0);
 assert.ok(r.inner.t>0&&r.inner.z<r.rim.z-.15&&r.inner.n[2]>0);assert.ok(r.rim.z>1.45);
}));

test('pour-over vessels have hollow mouths and a drain, and the drip falls into the carafe',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,capture=time=>{const out=[];T=time;drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{KITCHEN_POUR_OVER(0,0).draw(0,0);}finally{drawBox=draw;}return out;};
  const shapes=capture(0),cone=shapes.find(q=>q.box.z0===1.24&&q.ray===coveRayLathe),glass=shapes.find(q=>q.box.z0===1.02&&q.ray===coveRayLathe);
  const hit=(q,x)=>{const t=q.ray(x,0,2,0,0,-1,q.box);return{t,z:2-t,n:HIT.nz};};
  const droplets=[0,.18,.36].map(t=>capture(t).find(q=>q.ray===foodRayEllipsoid).box);
  return{drain:hit(cone,0),rim:hit(cone,.073),inside:hit(cone,.04),carafe:hit(glass,.01),mouth:hit(glass,.028),
   droplets:droplets.map(b=>({z:b.z0,top:b.z1,x:b.x,y:b.y})),
   supported:shapes.some(q=>{const t=q.ray(.08,0,2,0,0,-1,q.box);return t>0&&Math.abs(2-t-glass.box.z0)<1e-6;})};
 });
 assert.ok(r.drain.t<0);assert.ok(r.inside.t>0&&r.inside.z<r.rim.z-.04);assert.ok(r.carafe.t>0&&r.carafe.z<1.04&&r.mouth.z>1.18);
 assert.ok(r.supported);assert.ok(r.droplets[0].z>r.droplets[1].z&&r.droplets[1].z>r.droplets[2].z);
 for(const d of r.droplets)assert.ok(d.top<1.24&&d.z>1.09&&d.x===0&&d.y===0);
 assert.ok(r.droplets[2].z<1.19);
}));

test('coffee equipment stays on its supports, clears room walls/staff, and leaves a real E purchase approach',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('roastery',{word:'COFFEE',ret:[100,100,0]},[6.5,2.95,-Math.PI/2]);
  const models=room.props.filter(o=>o.kitchenCoffee),bad=[],draw=drawBox;projX=10000;
  for(const o of models){
   for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&
    furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',o.kitchenCoffee.kind,x,y]);
   for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
   const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
   for(const {box:b}of shapes)if(b.z1<=1.575&&(Math.abs(b.x-o.box.x)+b.hl>o.box.hl+1e-6||
    Math.abs(b.y-o.box.y)+b.hw>o.box.hw+1e-6||b.z0<o.box.z0-1e-6||b.z1>o.box.z1+1e-6))bad.push(['bounds',o.kitchenCoffee.kind,b.z0,b.z1]);
  }
  a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);
  return{count:models.length,bad,clear:free(px,py),prompt:promptText()};
 });
 assert.equal(r.count,5);assert.deepEqual(r.bad,[]);assert.ok(r.clear);assert.match(r.prompt,/E: shop$/);
 await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));
}));
