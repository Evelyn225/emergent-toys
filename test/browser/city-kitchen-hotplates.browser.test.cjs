'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('takoyaki wells are actual recesses, balls touch their floors, and picks rest on the iron ledge',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[];projX=10000;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});
  try{KITCHEN_TAKO_GRIDDLE(0,0).draw(0,0);}finally{drawBox=draw;}
  const plate=shapes.find(q=>q.ray===homeRayWorktop),wells=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-TAKO.wellBase)<1e-8),
    balls=shapes.filter(q=>q.ray===foodRayEllipsoid&&Math.abs(q.box.z0-TAKO.wellBase-.004)<1e-8);
  const t=plate.ray(TAKO.x0,TAKO.y0,2,0,0,-1,plate.box),opening=!plate.shade(0,t,8),well=wells[0],floorT=well.ray(TAKO.x0,TAKO.y0,2,0,0,-1,well.box),floor=2-floorT;
  well.shade(0,floorT,14);const floorColor=BG[0];
  const outside=plate.ray(TAKO.x0+.05,TAKO.y0,2,0,0,-1,plate.box);plate.shade(0,outside,14);const plateColor=BG[0];
  const lip=well.ray(TAKO.x0+.034,TAKO.y0,2,0,0,-1,well.box);well.shade(0,lip,14);const rimColor=BG[0];
  const supported=balls.every(q=>{
   const w=wells.find(w=>Math.hypot(w.box.x-q.box.x,w.box.y-q.box.y)<1e-8),down=w.ray(q.box.x,q.box.y,2,0,0,-1,w.box),up=q.ray(q.box.x,q.box.y,.8,0,0,1,q.box);
   return down>0&&up>0&&Math.abs((2-down)-(.8+up))<1e-6;
  });
  const picks=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.007);
  const picksSupported=picks.every(q=>{const x=(q.box.ax+q.box.bx)/2,y=q.box.ay,
    up=q.ray(x,y,.8,0,0,1,q.box),down=plate.ray(x,y,2,0,0,-1,plate.box);return up>0&&down>0&&Math.abs(.8+up-(2-down))<1e-6;});
  return{opening,floor,floorColor,plateColor,rimColor,wells:wells.length,balls:balls.length,supported,picks:picks.length,picksSupported};
 });
 assert.ok(r.opening&&Math.abs(r.floor-.942)<1e-6);assert.equal(r.wells,72);assert.equal(r.balls,66);assert.ok(r.supported);
 assert.ok(r.floorColor<r.plateColor&&r.rimColor>r.plateColor);
 assert.equal(r.picks,2);assert.ok(r.picksSupported);
}));

test('flat-top grease channel is recessed, food meets the plate and the steel case does not glow',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,shapes=[],model=KITCHEN_FLATTOP(0,0);projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const plate=shapes.find(q=>q.ray===homeRayWorktop),channel=shapes.find(q=>q.ray===foodRayTray),body=shapes.find(q=>q.ray===coveRayRounded);
  const t=plate.ray(0,.27,2,0,0,-1,plate.box),opening=!plate.shade(0,t,8),floor=2-channel.ray(0,.27,2,0,0,-1,channel.box);
  const foods=shapes.filter(q=>q.ray===foodRayEllipsoid&&q.box.z0===.96||q.ray===coveRayLathe&&q.box.z0===.96);
  const supported=foods.every(q=>{const t=plate.ray(q.box.x,q.box.y,2,0,0,-1,plate.box);return t>0&&Math.abs(2-t-q.box.z0)<1e-6;});
  const color=time=>{T=time;const t=body.ray(0,2,.4,0,-1,0,body.box);body.shade(0,t,8);return BG[0];};
  return{opening,floor,foods:foods.length,supported,colors:[color(0),color(10)]};
 });
 assert.ok(r.opening&&Math.abs(r.floor-.923)<1e-6);assert.equal(r.foods,10);assert.ok(r.supported);assert.equal(r.colors[0],r.colors[1]);
}));

test('kettle and stockpot have thin hollow walls, supported bottoms and liquids fitted below their rims',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const draw=drawBox,out=[];projX=10000;
  for(const water of [false,true]){
   const model=KITCHEN_POT_STOVE(0,0,water),m=model.kitchenPlate,shapes=[];
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
   const pot=shapes.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-m.top)<1e-8&&q.box.z1-q.box.z0>.4),
    burner=shapes.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z1-m.top)<1e-8),
    liquid=shapes.find(q=>q.ray===coveRayLathe&&Math.abs(q.box.z1-q.box.z0-.001)<1e-8);
   const inner=pot.ray(0,0,m.top+.25,1,0,0,pot.box),outer=1-pot.ray(1,0,m.top+.25,-1,0,0,pot.box);
   const insideAtFill=pot.ray(0,0,liquid.box.z0,1,0,0,pot.box),down=burner.ray(0,0,2,0,0,-1,burner.box),up=pot.ray(0,0,.1,0,0,1,pot.box);
   const t=liquid.ray(0,0,2,0,0,-1,liquid.box);liquid.shade(0,t,8);
   const rings=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z1-q.box.z0-.044)<1e-6);
   out.push({water,wall:outer-inner,supported:Math.abs((2-down)-(.1+up))<1e-6,
    inside:liquid.box.hl<=insideAtFill+1e-6,below:liquid.box.z1<pot.box.z1-.05,color:BG[0]>>4,expected:water?GRAY:ORANGE,
    rings:rings.length,floating:rings.every(q=>q.box.z0<liquid.box.z0&&q.box.z1>liquid.box.z1&&Math.hypot(q.box.x,q.box.y)+q.box.hl<liquid.box.hl)});
  }
  return out;
 });
 for(const q of r){assert.ok(q.wall>.002&&q.wall<.006,JSON.stringify(q));assert.ok(q.supported&&q.inside&&q.below&&q.floating,JSON.stringify(q));assert.equal(q.color,q.expected);assert.equal(q.rings,q.water?4:0);}
}));

test('hotplate, kettle and coffee fittings clear walls and staff, and all five shops retain real E service',()=>fixture(async p=>{
 for(const [kind,word,x,y,count]of [['takoyaki','TAKOYAKI',4.5,3.2,1],['taqueria','TACOS',5.2,3.3,1],['pho','PHO',5,3.3,2],['bagelshop','BAGELS',5,3.15,1],['donutshop','DONUTS',5,3.15,1]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const models=room.props.filter(o=>o.kitchenPlate||kind==='donutshop'&&o.kitchenCoffee?.kind==='espresso'),bad=[],draw=drawBox;projX=10000;
   for(const o of models){
    for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#W'.includes(room.grid[y][x])&&furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
    for(const q of room.props.filter(q=>q.fig))if(inBox(o.box,q.x,q.y,.18))bad.push(['person',q.x,q.y]);
    const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}
    for(const {box:b}of shapes)if(Math.abs(b.x-o.box.x)+b.hl>o.box.hl+1e-6||Math.abs(b.y-o.box.y)+b.hw>o.box.hw+1e-6||b.z0<o.box.z0-1e-6||b.z1>o.box.z1+1e-6)bad.push(['bounds',o.kitchenPlate?.kind||'espresso',b.z0,b.z1]);
   }
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{models:models.length,bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.equal(r.models,count);assert.deepEqual(r.bad,[],kind);assert.ok(r.clear,JSON.stringify({kind,...r}));assert.match(r.prompt,/E: shop$/,JSON.stringify({kind,...r}));
  await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
