'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('bamboo baskets have real hollows, adjoining stack rims and a sealed domed lid',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{KITCHEN_STEAMER_STACK(0,0,4).draw(0,0);}finally{drawBox=draw;}
  const baskets=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z1-q.box.z0-.09)<1e-6);
  const hit=(q,x,z)=>{const t=q.ray(x,0,z,0,0,-1,q.box);return{t,z:z-t,n:HIT.nz};};
  const lid=shapes.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-1.36)<1e-6);
  return{count:baskets.length,floor:hit(baskets[0],0,2),rim:hit(baskets[0],.165,2),
   joins:baskets.slice(1).map((q,k)=>q.box.z0-baskets[k].box.z1),
   crown:[-.15,-.1,-.025,0,.025,.1,.15].map(x=>hit(lid,x,2))};
 });
 assert.equal(r.count,4);assert.ok(Math.abs(r.floor.z-1.012)<1e-6&&r.floor.n>.9);
 assert.ok(r.rim.z>r.floor.z+.07);for(const d of r.joins)assert.ok(Math.abs(d)<1e-6);
 for(const h of r.crown)assert.ok(h.t>0&&h.z>=1.36&&h.z<=1.403&&h.n>0,JSON.stringify(h));
}));

test('service carts have wheels on the floor, supported baskets and plates, and turn with their route',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('dimsum',{word:'DIM SUM',ret:[100,100,0]},[7.4,9,-Math.PI/2]);
  const cart=room.props.find(o=>o.kitchenCart),draw=drawBox,out=[];projX=10000;
  for(const time of [0,10,20,30]){
   T=time;cart.tick(cart);const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});
   try{cart.draw(0,0);}finally{drawBox=draw;}
   const deck=shapes.find(q=>Math.abs(q.box.z1-.8)<1e-6&&q.ray===homeRayWorktop),baskets=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-.8)<1e-6);
   const wheels=shapes.filter(q=>q.ray===foodRayEllipsoid&&q.box.z0===0);
   const support=baskets.every(q=>{const t=deck.ray(q.box.x,q.box.y,1,0,0,-1,deck.box);return t>0&&Math.abs(1-t-q.box.z0)<1e-6;});
   const plates=shapes.filter(q=>q.ray===coveRayLathe&&q.box.z0>=.24&&q.box.z0<.3&&q.box.hl>.13);
   const lower=shapes.find(q=>q.ray===homeRayWorktop&&Math.abs(q.box.z1-.24)<1e-6);
   const platesSupported=plates.every((q,k)=>{const below=k?plates[k-1]:lower,
    t=below.ray(q.box.x+KITCHEN_VESSELS.plate[1][1]*1.05,q.box.y,1,0,0,-1,below.box);return t>0&&Math.abs(1-t-q.box.z0)<1e-6;});
   const a=T*.15,tangent=[-1.7*Math.sin(a),Math.cos(a)],length=Math.hypot(...tangent);
   out.push({wheels:wheels.length,baskets:baskets.length,plates:plates.length,platesSupported,support,aligned:deck.box.c*tangent[0]/length+deck.box.s*tangent[1]/length,
    route:Math.hypot(cart.x-DIMSUM_LOOP(T,0)[0],cart.y-DIMSUM_LOOP(T,0)[1]),foods:shapes.filter(q=>q.ray===foodRayEllipsoid&&q.box.z0>.8).length});
  }
  return out;
 });
 for(const q of r){assert.equal(q.wheels,4);assert.equal(q.baskets,4);assert.equal(q.plates,3);assert.equal(q.foods,12);assert.ok(q.support&&q.platesSupported&&q.aligned>.999&&q.route<1e-8,JSON.stringify(q));}
}));

test('steamer wisps rise from the lid, stay local and short-lived, and respect the shared cloud cap',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('dumplings',{word:'DUMPLINGS',ret:[100,100,0]},[6.7,3.4,-Math.PI/2]);haze.length=0;
  const stack=room.props.find(o=>o.kitchenSteamer);T=100;stack.tick(stack);const count=haze.length,puff={...haze[0]};
  stack.tick(stack);const once=haze.length===count;stepHaze(2);const expired=haze.length===0;
  for(let n=0;n<180;n++){T+=1.2;stack.tick(stack);}const cap=haze.length;
  mode='walk';T+=2;stack.tick(stack);const outdoors=haze.length;
  return{count,once,expired,cap,outdoors,puff,top:stack.kitchenSteamer.top,at:room.id};
 });
 assert.equal(r.count,1);assert.ok(r.once&&r.expired);assert.equal(r.cap,140);assert.equal(r.outdoors,140);
 assert.equal(r.puff.kind,'steam');assert.notEqual(r.puff.at,'');assert.ok(r.puff.z>=r.top&&r.puff.vz>0&&r.puff.rMax<=.06);
}));
