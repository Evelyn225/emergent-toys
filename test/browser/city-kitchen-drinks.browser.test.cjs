'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('drink cabinets fit their rooms without touching the clerks, and real E still opens both shops',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['burgerjoint','BURGERS',6.1,3.15],['kissaten','KISSATEN',5.55,2.95]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);
   const models=room.props.filter(o=>o.kitchenDrink),bad=[];
   for(const o of models){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&
      furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',o.kitchenDrink.kind,x,y]);
    for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
   }
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);
   return{count:models.length,bad,prompt:promptText(),clear:free(px,py)};
  },{kind,word,x,y});
  assert.equal(r.count,kind==='burgerjoint'?2:3);assert.deepEqual(r.bad,[]);assert.ok(r.clear,JSON.stringify(r));assert.match(r.prompt,/E: shop$/,JSON.stringify(r));
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));

test('drink stations have real floor/worktop support, hollow mixing cups and a recessed drip tray',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,capture=fn=>{const out=[];drawBox=(box,shade,ray=rayBox)=>out.push({box,shade,ray});try{fn();}finally{drawBox=draw;}return out;};
  projX=10000;const shake=capture(()=>KITCHEN_SHAKE_MACHINE(0,0).draw(0,0)),soda=capture(()=>KITCHEN_SODA_FOUNTAIN(0,0).draw(0,0));
  const cups=shake.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-1.06)<1e-8);
  const floors=cups.map(q=>{const t=q.ray(q.box.x,q.box.y,2,0,0,-1,q.box);return 2-t;});
  const tray=soda.find(q=>q.ray===foodRayTray),at=u=>{const t=tray.ray(u,tray.box.y,2,0,0,-1,tray.box);return{z:2-t,n:HIT.nz};};
  const bounds=(items,model)=>items.every(q=>Math.abs(q.box.x-model.box.x)+q.box.hl<=model.box.hl+1e-7&&
   Math.abs(q.box.y-model.box.y)+q.box.hw<=model.box.hw+1e-7&&q.box.z0>=-1e-7&&q.box.z1<=model.box.z1+1e-7);
  const countertop=items=>items.some(q=>{const t=q.ray(.32,0,2,0,0,-1,q.box);return t>0&&Math.abs(2-t-1)<1e-8;});
  return{floorContact:[shake,soda].every(items=>items.some(q=>q.box.z0===0)),
   countertop:[shake,soda].every(countertop),cups:floors,center:at(0),rim:at(.403),
   bounds:bounds(shake,KITCHEN_SHAKE_MACHINE(0,0))&&bounds(soda,KITCHEN_SODA_FOUNTAIN(0,0))};
 });
 assert.ok(r.floorContact&&r.countertop&&r.bounds,JSON.stringify(r));assert.equal(r.cups.length,3);
 for(const z of r.cups)assert.ok(Math.abs(z-1.072)<1e-6,JSON.stringify(r));
 assert.ok(Math.abs(r.center.z-1.008)<1e-8&&r.center.n>.9);assert.ok(r.rim.z>r.center.z+.02);
}));

test('siphon glass retains a transparent centre and curved edge; its upper chamber has a recessed floor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;eye=1.195;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{KITCHEN_SIPHON(0,0).draw(0,-2);}finally{drawBox=draw;}
  const globe=shapes.find(q=>q.ray===foodRayEllipsoid&&q.box.z0===SIPHON.bottom);
  const sample=(x,z)=>{const t=globe.ray(x,0,z,0,-1,0,globe.box);return{t,paint:globe.shade(0,t,8),normal:Math.hypot(HIT.nx,HIT.ny,HIT.nz)};};
  const chamber=shapes.find(q=>q.ray===coveRayLathe&&q.box.z0===SIPHON.chamber);
  const hit=(x)=>{const t=chamber.ray(x,-2,2,0,0,-1,chamber.box);return{z:2-t,n:HIT.nz};};
  return{clear:sample(0,1.24),edge:sample(.083,1.195),floor:hit(0),rim:hit(.055)};
 });
 assert.ok(r.clear.t>0&&r.edge.t>0);assert.equal(r.clear.paint,false);assert.equal(r.edge.paint,true);
 assert.ok(Math.abs(r.edge.normal-1)<1e-8);assert.ok(r.floor.z<1.33&&r.floor.n>.9);assert.ok(r.rim.z>1.51);
}));
