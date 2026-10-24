'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}
test('pizza oven has a real open mouth, a closed inner roof and arch trim on the measured dome',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});
  try{KITCHEN_PIZZA_OVEN(0,0).draw(0,0);}finally{drawBox=draw;}
  const dome=shapes.find(q=>q.ray===kitchenRayPizzaOven),b=dome.box;
  const hit=(x,y,z,rx,ry,rz)=>{const t=dome.ray(x,y,z,rx,ry,rz,b);return{t,z:z+rz*t,n:[HIT.nx,HIT.ny,HIT.nz]};};
  return{mouth:hit(0,2,1.14,0,-1,0),side:hit(.4,2,1.14,0,-1,0),roof:hit(0,-.05,1.35,0,0,1),
   crown:hit(0,-.05,3,0,0,-1),arch:PIZZA_ARCH.every(([u,v,z])=>Math.abs(Math.hypot(u,v)-pizzaDomeRadius(z))<1e-8)};
 });
 assert.ok(r.mouth.t>2&&r.side.t>0&&r.side.t<2,JSON.stringify(r));assert.ok(r.mouth.n[1]>.8);
 assert.ok(r.roof.z>1.60&&r.roof.z<1.62&&r.roof.n[2]<-.8,JSON.stringify(r));
 assert.ok(r.crown.z>r.roof.z+.07&&r.crown.n[2]>.8);assert.equal(r.arch,true);
}));
test('specialist ovens and racks clear room walls and staff while the clerk remains usable',()=>fixture(async p=>{
 for(const kind of ['pizzeria','bakery']){
  const r=await p.evaluate(kind=>{
   enterRoom(kind,{word:kind==='pizzeria'?'PIZZA':'BAKERY',ret:[100,100,0]},kind==='pizzeria'?[6.6,3.5,-Math.PI/2]:[5,3.35,-Math.PI/2]);
   const models=room.props.filter(p=>p.kitchenAppliance),fail=[];
   for(const p of models)for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)
    if('#W'.includes(room.grid[y][x])&&furnishingOverlap(p.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))fail.push([p.kitchenAppliance.kind,x,y]);
   return{count:models.length,fail,prompt:promptText()};
  },kind);
  assert.ok(r.count>0);assert.deepEqual(r.fail,[]);assert.match(r.prompt,/E: shop$/);
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
test('deck oven windows own their light and handles meet the case; bread rests on real shelves',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,capture=fn=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{fn();}finally{drawBox=draw;}return out;};
  const shapes=capture(()=>KITCHEN_DECK_OVEN(0,0).draw(0,0)),body=shapes[0],pane=shapes.find(q=>q.box.hw===.003);
  const sample=(q,x,z,time)=>{T=time;const t=q.ray(x,2,z,0,-1,0,q.box),drawn=q.shade(0,t,8);return{t,drawn,color:BG[0]};};
  const off=sample(body,.63,.42,0),on=sample(body,.63,.42,2),opening=sample(body,0,.42,0),glass=sample(pane,0,.42,0);
  const rack=capture(()=>KITCHEN_BREAD_RACK(0,0).draw(0,0)),loaves=rack.filter(q=>q.ray===foodRayEllipsoid);
  const supported=loaves.every(loaf=>rack.some(q=>{
   if(q===loaf)return false;const t=q.ray(loaf.box.x,loaf.box.y,loaf.box.z0+.1,0,0,-1,q.box);return t>0&&Math.abs(loaf.box.z0+.1-t-loaf.box.z0)<1e-6;
  }));
  return{off,on,opening,glass,loaves:loaves.length,supported};
 });
 assert.equal(r.off.color,r.on.color);assert.equal(r.opening.drawn,false);assert.ok(r.glass.t>0&&r.glass.drawn);
 assert.equal(r.loaves,30);assert.ok(r.supported);
}));
