'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('blender jug has a clear air space, fitted liquid and an open handle on a supported motor',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;eye=1.385;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{KITCHEN_BLENDER(0,0,ORANGE).draw(0,-2);}finally{drawBox=draw;}
  const glass=shapes.find(q=>q.ray===coveRayLathe&&q.box.z0===1.12),liquid=shapes.find(q=>q.ray===coveRayLathe&&q.box.z0===1.13);
  const t=glass.ray(0,0,1.385,0,-1,0,glass.box),clear=!glass.shade(0,t,8);
  const inside=glass.ray(0,-2,1.35,1,0,0,glass.box);
  const handles=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.az>1.20&&q.box.bz>1.20);
  const probe=(x,z)=>handles.some(q=>q.ray(x,0,z,0,-1,0,q.box)>0);
  const motor=shapes.find(q=>q.ray===coveRayRounded),support=motor.ray(0,-2,2,0,0,-1,motor.box);
  return{clear,inside,liquidRadius:liquid.box.hl,hole:probe(.094,1.29),handle:probe(.119,1.29),support:2-support,jugBottom:glass.box.z0};
 });
 assert.ok(r.clear&&r.inside>0);assert.ok(r.liquidRadius<=r.inside+1e-6);assert.equal(r.hole,false);assert.equal(r.handle,true);
 assert.ok(Math.abs(r.support-r.jugBottom)<1e-6);
}));

test('hot dogs touch both neighbouring rollers and clear the metal case under the transparent guard',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});
  try{KITCHEN_HOTDOG_ROLLER(0,0).draw(0,0);}finally{drawBox=draw;}
  const dogs=shapes.filter(q=>q.ray===foodRayEllipsoid),rollers=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.012),contacts=[];
  for(const dog of dogs){
   const x=dog.box.x,y=dog.box.y,z=(dog.box.z0+dog.box.z1)/2;
   for(const roller of rollers.filter(q=>Math.abs(Math.abs(q.box.ax-x)-.03)<1e-6)){
    const vx=roller.box.ax-x,vz=roller.box.az-z,d=Math.hypot(vx,vz),dx=vx/d,dz=vz/d;
    const a=roller.ray(x,y,z,dx,0,dz,roller.box),b=dog.ray(roller.box.ax,y,roller.box.az,-dx,0,-dz,dog.box);
    contacts.push(a>0&&b>0&&Math.abs(a+b-d)<1e-6);
   }
  }
  const glass=shapes.find(q=>q.box.z0===1.214&&q.ray===rayBox),t=glass.ray(0,0,2,0,0,-1,glass.box);
  return{dogs:dogs.length,rollers:rollers.length,contacts,aboveBase:dogs.every(q=>q.box.z0>.955),clear:!glass.shade(0,t,8)};
 });
 assert.equal(r.dogs,10);assert.equal(r.rollers,6);assert.equal(r.contacts.length,20);assert.ok(r.contacts.every(Boolean));assert.ok(r.aboveBase&&r.clear);
}));

test('rice cooker steam starts at the physical lid vent and remains bounded',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('bento',{word:'BENTO',ret:[100,100,0]},[7.3,2.7,-Math.PI/2]);haze.length=0;
  const cooker=room.props.find(o=>o.kitchenCounter?.kind==='rice-cooker');T=100;cooker.tick(cooker);cooker.tick(cooker);
  const puff=haze[0];return{count:haze.length,kind:puff.kind,x:puff.x-cooker.x,y:puff.y-cooker.y,z:puff.z,max:puff.rMax,fade:puff.fade};
 });
 assert.equal(r.count,1);assert.equal(r.kind,'steam');assert.ok(Math.abs(r.x+.06)<1e-8&&r.y===0&&r.z>=1.155&&r.z<1.17);assert.ok(r.max<=.06&&r.fade>.5);
}));

test('small appliances have actual worktop support, stay inside bounds, clear staff/walls and preserve shop use',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['juicebar','JUICE',5.0,2.9],['bento','BENTO',4.6,3.1],['gas','GAS',8.5,7.2]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const models=room.props.filter(o=>o.kitchenCounter),bad=[],draw=drawBox;projX=10000;
   for(const o of models){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
    for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
    const z=o.kitchenCounter.support;
    if(!room.props.some(q=>q!==o&&q.box&&Math.abs(q.box.z1-z)<1e-6&&
      [-1,1].every(a=>[-1,1].every(b=>inBox(q.box,o.x+a*o.box.hl,o.y+b*o.box.hw,0)))))bad.push(['unsupported',o.kitchenCounter.kind]);
    const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    for(const {box:b}of shapes)if(Math.abs(b.x-o.box.x)+b.hl>o.box.hl+1e-6||Math.abs(b.y-o.box.y)+b.hw>o.box.hw+1e-6||b.z0<o.box.z0-1e-6||b.z1>o.box.z1+1e-6)bad.push(['bounds',o.kitchenCounter.kind,b.z0,b.z1]);
   }
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{count:models.length,bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.equal(r.count,kind==='juicebar'?3:kind==='bento'?1:4);assert.deepEqual(r.bad,[],kind);assert.ok(r.clear,JSON.stringify({kind,...r}));assert.match(r.prompt,/E: shop$/,JSON.stringify({kind,...r}));
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
