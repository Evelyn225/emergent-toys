'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('fryer has a recessed oil well, supported baskets and real wire holes with stable face lighting',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});
  try{KITCHEN_FRYER(0,0).draw(0,0);}finally{drawBox=draw;}
  const pan=shapes.find(q=>q.ray===foodRayTray),wire=shapes.find(q=>q.shade===kitchenFryerWire&&q.box.hw===.001&&q.box.y>.1);
  const top=(x,y)=>{const t=pan.ray(x,y,2,0,0,-1,pan.box);return 2-t;};
  const floor=top(0,0),rim=top(.447,0),bottoms=shapes.filter(q=>q.shade===kitchenFryerWire&&q.box.z1-q.box.z0<.003);
  const sample=x=>{HIT.nx=HIT.ny=HIT.nz=100;const t=wire.ray(x,2,.93,0,-1,0,wire.box);return{t,paint:wire.shade(0,t,8),normal:[HIT.nx,HIT.ny,HIT.nz]};};
  const body=shapes.find(q=>q.ray===coveRayRounded&&Math.abs(q.box.z0-.075)<1e-6);
  const color=time=>{T=time;const t=body.ray(0,2,.5,0,-1,0,body.box);body.shade(0,t,8);return BG[0];};
  return{floor,rim,bottoms:bottoms.map(q=>q.box.z0),line:sample(wire.box.x),hole:sample(wire.box.x+.01),colors:[color(0),color(4)]};
 });
 assert.ok(Math.abs(r.floor-.868)<1e-6&&r.rim>r.floor+.04);assert.equal(r.bottoms.length,2);
 for(const z of r.bottoms)assert.ok(Math.abs(z-r.floor)<1e-6);assert.equal(r.line.paint,true);assert.equal(r.hole.paint,false);
 assert.deepEqual(r.line.normal,[0,1,0]);assert.equal(r.colors[0],r.colors[1]);
}));

test('spit meat has a continuous profile and the skewers rest on the charcoal trough rim',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,capture=fn=>{const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{fn();}finally{drawBox=draw;}return shapes;};
  projX=10000;const meat=[];
  for(const kind of ['doner','pastor']){
   const shapes=capture(()=>KITCHEN_SPIT(0,0,kind).draw(0,0)),shell=shapes.find(q=>q.ray===coveRayLathe&&q.box.z0===1.05);
   const ts=[],normals=[];for(let n=0;n<40;n++){
    const z=1.10+n/39*(kind==='doner'?.62:.58),t=shell.ray(0,2,z,0,-1,0,shell.box);ts.push(t);normals.push(Math.hypot(HIT.nx,HIT.ny,HIT.nz));
   }
   meat.push({kind,positive:ts.every(t=>t>0),jump:Math.max(...ts.slice(1).map((t,k)=>Math.abs(t-ts[k]))),unit:normals.every(n=>Math.abs(n-1)<1e-6)});
  }
  const shapes=capture(()=>KITCHEN_YAKITORI(0,0,1.6).draw(0,0)),pan=shapes.find(q=>q.ray===foodRayTray),
   skewers=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.004);
  const supported=skewers.every(q=>{
   const x=q.box.ax,y=-.195,up=q.ray(x,y,.90,0,0,1,q.box),down=pan.ray(x,y,2,0,0,-1,pan.box);
   return up>0&&down>0&&Math.abs(.90+up-(2-down))<1e-6;
  });
  return{meat,skewers:skewers.length,supported};
 });
 for(const q of r.meat)assert.ok(q.positive&&q.unit&&q.jump<.022,JSON.stringify(q));assert.ok(r.skewers>10&&r.supported,JSON.stringify(r));
}));

test('hot-line models clear staff and walls, keep handles inside their measured bounds, and preserve E service',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['chickenshop','CHICKEN',5.6,3.15],['kebabshop','KEBAB',5.6,3.2],['taqueria','TACOS',5.2,3.3],['yakitori','YAKITORI',5.45,3.25]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const models=room.props.filter(o=>o.kitchenHotline),bad=[],draw=drawBox;projX=10000;
   for(const o of models){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
    for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
    const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    for(const {box:b}of shapes)if(Math.abs(b.x-o.box.x)+b.hl>o.box.hl+1e-6||Math.abs(b.y-o.box.y)+b.hw>o.box.hw+1e-6||b.z0<o.box.z0-1e-6||b.z1>o.box.z1+1e-6)bad.push(['bounds',o.kitchenHotline.kind,b.z0,b.z1]);
   }
   if(kind==='yakitori'&&!Array.from({length:21},(_,k)=>free(px,py+k*.04)).every(Boolean))bad.push(['blocked stool approach']);
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{models:models.length,bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.equal(r.models,1);assert.deepEqual(r.bad,[],kind);assert.ok(r.clear,JSON.stringify({kind,...r}));assert.match(r.prompt,/E: shop$/,JSON.stringify({kind,...r}));
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
