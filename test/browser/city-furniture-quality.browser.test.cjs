'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');

test('fitted beds and storage clear walls and each other, with cupboards facing their approach',async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const rooms=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=null;body.z=body.vz=0;
   return ['home','loft','bellehome','islandhome','motelRoom','hotelroom','hotelSuite'].map(kind=>{
    const def=ROOM_DEFS[kind];
    enterRoom(kind,{ret:[100,100,0]},def.entry);
    const fitted=room.props.filter(o=>o.furniture),walls=[],intersections=[],facing=[];
    for(const o of fitted){
     for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)
      if('#W'.includes(room.grid[y][x])&&furnishingOverlap(o.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))
       walls.push({object:o.furniture,x:o.x,y:o.y,wall:[x,y]});
     if(o.furniture==='cabinet')for(const bed of fitted.filter(q=>['bed','headboard'].includes(q.furniture)))
      if(furnishingOverlap(o.box,bed.box))intersections.push({cabinet:[o.x,o.y],bed:bed.furniture});
    }
    for(const name of ['closet','workshop']){
     const target=room.def.spots?.[name];if(!target)continue;
     const cabinet=fitted.filter(o=>o.furniture==='cabinet').sort((a,b)=>near(a.x,a.y,...target)-near(b.x,b.y,...target))[0];
     const b=cabinet.box;facing.push({name,dot:(target[0]-b.x)*-b.s+(target[1]-b.y)*b.c});
    }
    env(0);render(0);
    return {kind,walls,intersections,facing,beds:fitted.filter(o=>o.furniture==='bed').length};
   });
  });
  for(const r of rooms){
   assert.equal(r.beds,1,r.kind);assert.deepEqual(r.walls,[],JSON.stringify(r));
   assert.deepEqual(r.intersections,[],JSON.stringify(r));
   assert.ok(r.facing.every(f=>f.dot>0),JSON.stringify(r));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('a street bench supports the sitter at its actual seat height, and C restores the approach',async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const result=await page.evaluate(()=>{
   paused=false;mode='walk';room=me=null;fx.skating=false;body.z=body.vz=0;
   const b=benches.slice().sort((a,b)=>terrainHeight(b.x,b.y)-terrainHeight(a.x,a.y))[0];
   px=b.x+b.fx*.1;py=b.y+b.fy*.1;a=Math.atan2(-b.fy,-b.fx);env(0);render(0);
   const draw=drawBox,bench=drawBench;let active=false;const heights=[],support=[];
   drawBench=(...args)=>{active=Math.hypot(args[0]-(b.x-px),args[1]-(b.y-py))<1e-6;try{return bench(...args);}finally{active=false;}};
   drawBox=(box,shade,ray=rayBox)=>{
    if(active){
     heights.push([box.z0,box.z1]);
     const z=terrainHeight(b.x,b.y)+.2,t=ray(b.x-px+b.fx*.005,b.y-py+b.fy*.005,z,0,0,-1,box);
     if(t>0)support.push(z-t);
    }
    return draw(box,shade,ray);
   };
   try{render(0);}finally{drawBox=draw;drawBench=bench;}
   return {base:terrainHeight(b.x,b.y),bottom:Math.min(...heights.map(h=>h[0])),top:Math.max(...heights.map(h=>h[1])),seatTop:Math.max(...support),from:[px,py],count:heights.length};
  });
  assert.ok(result.count>0);
  assert.ok(Math.abs(result.bottom-result.base)<1e-8);
  assert.ok(Math.abs(result.top-(result.base+.085))<1e-8);
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(()=>!!body.seat),true);
  const seatedHeight=await page.evaluate(()=>body.seat.h??.45);
  assert.ok(Math.abs((result.seatTop-result.base)*10-seatedHeight)<1e-6,JSON.stringify(result));
  await page.keyboard.press('c');assert.equal(await page.evaluate(()=>body.seat),null);
  assert.deepEqual(await page.evaluate(()=>[px,py]),result.from);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
