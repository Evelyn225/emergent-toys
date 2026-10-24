'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('hollow woks meet their support rings, liquids fit the inner walls, and handles and food have actual contacts',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=KITCHEN_WOK_RANGE(0,0),draw=drawBox,shapes=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const bowls=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-WOK.base)<1e-6&&q.box.z1-q.box.z0>.13),
   rings=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-WOK.top)<1e-6),
   liquids=shapes.filter(q=>q.ray===coveRayLathe&&Math.abs(q.box.z0-WOK.fill)<1e-6),
   shafts=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.008&&q.box.az>1),
   grips=shapes.filter(q=>q.ray===coveRayRounded&&q.box.c===0),
   food=shapes.filter(q=>q.ray===coveRayCapsule&&q.box.r===.003&&q.box.z0>WOK.fill||q.ray===foodRayEllipsoid&&Math.abs(q.box.z0-WOK.fill-.001)<1e-6);
  const contacts=bowls.every(q=>{
   const b=q.box,ring=rings.find(r=>Math.abs(r.box.x-b.x)<1e-6),liquid=liquids.find(r=>Math.abs(r.box.x-b.x)<1e-6),
    down=ring.ray(b.x+.07,b.y,2,0,0,-1,ring.box),up=q.ray(b.x+.07,b.y,.7,0,0,1,b),
    floor=2-q.ray(b.x,b.y,2,0,0,-1,b),inner=q.ray(b.x,b.y,WOK.fill,1,0,0,b),outer=1-q.ray(b.x+1,b.y,WOK.fill,-1,0,0,b),
    liquidEdge=liquid.ray(b.x,b.y,WOK.fill+.0005,1,0,0,liquid.box),wallEdge=q.ray(b.x,b.y,WOK.fill+.0005,1,0,0,b);
   return down>0&&up>0&&Math.abs((2-down)-(.7+up))<1e-6&&Math.abs(floor-(WOK.base+.006))<1e-6&&outer-inner>.003&&outer-inner<.008&&
    liquidEdge>0&&Math.abs(liquidEdge-wallEdge)<1e-6&&liquid.box.z1<b.z1-.05;
  });
  const mounted=shafts.every(q=>{
   const b=q.box,grip=grips.find(g=>Math.abs(g.box.x-b.bx)<1e-6),bowl=bowls.find(g=>Math.abs(g.box.x-b.ax)<1e-6),
    wall=bowl.ray(b.ax,bowl.box.y,b.az,0,1,0,bowl.box);
   return grip&&inBox(grip.box,b.bx,b.by,0)&&b.bz>grip.box.z0&&b.bz<grip.box.z1&&Math.abs(b.ay-bowl.box.y-wall)<b.r;
  });
  const supported=food.every(q=>liquids.some(l=>{
   const t=l.ray(q.box.x,q.box.y,2,0,0,-1,l.box);return t>0&&Math.abs(2-t-q.box.z0)<1e-6;
  }));
  const bounds=shapes.every(({box:b})=>Math.abs(b.x)+Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw<=model.box.hl+1e-6&&
   Math.abs(b.y-model.box.y)+Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw<=model.box.hw+1e-6&&b.z0>=0&&b.z1<=model.box.z1+1e-6);
  return{bowls:bowls.length,shafts:shafts.length,grips:grips.length,food:food.length,contacts,mounted,supported,bounds};
 });
 assert.equal(r.bowls,2);assert.equal(r.shafts,2);assert.equal(r.grips,2);assert.equal(r.food,42);assert.ok(r.contacts&&r.mounted&&r.supported&&r.bounds,JSON.stringify(r));
}));

test('the diner griddle supports eight patties while its case stays unlit and wok steam alternates locally',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=KITCHEN_FLATTOP(0,0,1,.35,'burger'),draw=drawBox,shapes=[];projX=10000;
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const plate=shapes.find(q=>q.ray===homeRayWorktop),foods=shapes.filter(q=>q.ray===foodRayEllipsoid&&q.box.z0===.96),body=shapes.find(q=>q.ray===coveRayRounded);
  const supported=foods.every(q=>{const t=plate.ray(q.box.x,q.box.y,2,0,0,-1,plate.box);return t>0&&Math.abs(2-t-q.box.z0)<1e-6;});
  const colors=[10,20].map(time=>{T=time;const t=body.ray(0,2,.4,0,-1,0,body.box);body.shade(0,t,8);return BG[0];});
  enterRoom('thai',{word:'THAI',ret:[100,100,0]},[7.2,2.65,0]);const wok=room.props.find(q=>q.kitchenWok);haze.length=0;T=10;
  for(let n=0;n<50;n++)wok.tick(wok);const once=haze.length;T+=1.2;wok.tick(wok);
  return{foods:foods.length,supported,colors,once,steam:haze.map(h=>({x:h.x-wok.x,y:h.y-wok.y,z:h.z,life:h.life}))};
 });
 assert.equal(r.foods,8);assert.ok(r.supported);assert.equal(r.colors[0],r.colors[1]);assert.equal(r.once,1);assert.equal(r.steam.length,2);
 assert.ok(r.steam[0].x*r.steam[1].x<0);for(const s of r.steam)assert.ok(Math.abs(Math.abs(s.x)-.37)<1e-6&&Math.abs(s.y+.01)<1e-6&&Math.abs(s.z-1.005)<1e-6&&s.life===1);
}));

test('Thai and diner cooking lines clear their walls, staff and serving counters and retain real E shopping',()=>fixture(async p=>{
 for(const [kind,word,x,y]of [['thai','THAI',5,3.2],['diner','DINER',6,2.85]]){
  const r=await p.evaluate(({kind,word,x,y})=>{
   enterRoom(kind,{word,ret:[100,100,0]},[x,y,-Math.PI/2]);const model=room.props.find(q=>q.kitchenWok||q.kitchenPlate?.meal==='burger'),bad=[];
   for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)if('#WS'.includes(room.grid[y][x])&&furnishingOverlap(model.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))bad.push(['wall',x,y]);
   for(const q of room.props.filter(q=>q.fig))if(inBox(model.box,q.x,q.y,.18))bad.push(['staff',q.x,q.y]);
   for(const q of room.props.filter(q=>q.furniture==='counter'))if(furnishingOverlap(model.box,q.box))bad.push(['counter',q.x,q.y]);
   a=Math.atan2(room.def.keeper[1]-py,room.def.keeper[0]-px);render(0);return{bad,clear:free(px,py),prompt:promptText()};
  },{kind,word,x,y});
  assert.deepEqual(r.bad,[],JSON.stringify({kind,...r}));assert.ok(r.clear);assert.match(r.prompt,/E: shop$/);await p.keyboard.press('KeyE');assert.ok(await p.evaluate(()=>shopEl?.style.display==='flex'));await p.keyboard.press('KeyE');
 }
}));
