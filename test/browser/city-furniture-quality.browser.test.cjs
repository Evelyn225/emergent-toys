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
