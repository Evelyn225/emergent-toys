'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=0;env(0);});
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}
test('rendered sink, toilet and bath have hollow interiors, closed rims and unit curved normals',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  ROOM_DEFS.bathProbe={grid:boxRoom(12,10),light:1,height:3,props:()=>[washbasin(3,1.4,0,1),...toilet(5,1.4,-1,porcelain),BATHTUB(8,3)]};
  enterRoom('bathProbe',{ret:[100,100,0]},[6,8,-Math.PI/2]);render(0);
  const capture=p=>{
   const shapes=[],draw=drawBox;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});
   try{p.draw(p.x,p.y);}finally{drawBox=draw;}return shapes;
  };
  const surface=(shapes,x,y)=>Math.max(-Infinity,...shapes.map(s=>{const t=s.ray(x,y,2,0,0,-1,s.box);return t>0?2-t:-Infinity;}));
  const sink=capture(room.props[0]),bowl=capture(room.props.find(p=>p.loo)),tub=capture(room.props.find(p=>p.bath));
  const frame=sink.find(s=>s.box.round&&s.box.hl===.25&&s.box.z0===1.15).box;
  const shape=bowl.find(s=>s.box.lathe?.profile.length>8),t=shape.ray(6,1.36,.36,-1,0,0,shape.box);
  const normal={hit:t>0,len:Math.hypot(HIT.nx,HIT.ny,HIT.nz),nx:HIT.nx,nz:HIT.nz};
  return {sink:{inside:surface(sink,3,1.4),rim:surface(sink,3.2,1.4)},
   toilet:{inside:surface(bowl,5,1.36),rim:surface(bowl,5.18,1.36)},
   tub:{inside:surface(tub,8,3),rim:surface(tub,8.4,3)},
   mirrorBack:frame.y-Math.abs(frame.s)*frame.hl-Math.abs(frame.c)*frame.hw,normal};
 });
 assert.ok(r.sink.inside>.75&&r.sink.inside<.79&&r.sink.rim>.85,JSON.stringify(r));
 assert.ok(r.toilet.inside>.32&&r.toilet.inside<.34&&r.toilet.rim>.415,JSON.stringify(r));
 assert.ok(r.tub.inside<.2&&r.tub.rim>.61,JSON.stringify(r));
 assert.ok(Math.abs(r.mirrorBack-1)<1e-6,'mirror frame is fitted to the wall face');
 assert.ok(r.normal.hit&&Math.abs(r.normal.len-1)<1e-8&&r.normal.nx>.1&&Math.abs(r.normal.nz)>.05,JSON.stringify(r.normal));
}));
test('home and hotel bathroom fixtures stay on the usable side of their partitions',()=>fixture(async page=>{
 const results=await page.evaluate(()=>['home','loft','bellehome','islandhome','motelRoom','hotelroom','hotelSuite'].map(kind=>{
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);
  const fixtures=room.props.filter(p=>p.loo||p.bath||p.box?.z1===.82||p.box?.z1===.86&&p.box.hl===.24),overlaps=[];
  for(const p of fixtures)for(let y=0;y<room.H;y++)for(let x=0;x<room.W;x++)
   if('#W'.includes(room.grid[y][x])&&furnishingOverlap(p.box,{x:x+.5,y:y+.5,c:1,s:0,hl:.5,hw:.5}))overlaps.push({at:[p.box.x,p.box.y],wall:[x,y]});
  return {kind,overlaps};
 }));
 for(const r of results)assert.deepEqual(r.overlaps,[],JSON.stringify(r));
}));
