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
test('motel shower has a recessed tray, fitted plumbing and an unobstructed entrance',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('hotelroom',{lobby:{word:'MOTEL',ret:[100,100,0]}},[8.3,3.5,Math.PI/2]);render(0);
  const tray=room.props.find(p=>p.shower),side=room.props.find(p=>p.box?.z0===.047),draw=drawBox,shapes=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray,shade});try{tray.draw(tray.x,tray.y);}finally{drawBox=draw;}
  const surface=(x,y)=>Math.max(-Infinity,...shapes.map(s=>{const t=s.ray(x,y,.2,0,0,-1,s.box);return t>0&&s.shade(0,t,1)!==false?.2-t:-Infinity;}));
  const back=shapes.filter(s=>Math.abs(s.box.ay-5.995)<1e-8&&Math.abs(s.box.by-5.94)<1e-8);
  const route=[];for(let y=3.5;y<5.7;y+=.05)route.push(free(tray.x,y));
  return{inside:surface(tray.x,tray.y),rim:surface(tray.x+tray.box.hl-.03,tray.y),route:route.every(Boolean),
   rear:tray.y+tray.box.hw,wall:room.grid[6][8],glassBlocked:!free(side.x,side.y),backMounts:back.length};
 });
 assert.ok(Math.abs(r.inside-.013)<1e-6&&Math.abs(r.rim-.047)<1e-6,JSON.stringify(r));
 assert.ok(r.route&&r.glassBlocked,'walk into the tray from the open front, not through the glass: '+JSON.stringify(r));
 assert.ok(Math.abs(r.rear-6)<1e-6&&r.wall==='W'&&r.backMounts===2,'rear fittings meet the partition: '+JSON.stringify(r));
}));
test('bathroom surrounds span real partition gaps and leave the original walking opening clear',()=>fixture(async page=>{
 const r=await page.evaluate(()=>Object.keys(ROOM_DEFS).filter(kind=>ROOM_DEFS[kind].wc).map(kind=>{
  const r=makeRoom(kind),problems=[];
  room=r;mode='room';
  for(const p of r.props.filter(p=>p.bathroomOpening)){
   const q=p.bathroomOpening,shapes=[],draw=drawBox;
   drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{p.draw(p.x,p.y);}finally{drawBox=draw;}
   for(let u=q.start+.22;u<q.end-.2;u+=.1){
    const x=q.vertical?q.cross+.5:u,y=q.vertical?u:q.cross+.5;
    if(shapes.some(s=>{const t=s.ray(x,y,0,0,0,1,s.box);return t>0&&t<2.19;}))problems.push('trim inside opening');
   }
   const top=shapes.find(s=>s.box.z0===2.26&&s.box.z1===(r.def.height||3));
   if(!top)problems.push('unclosed lintel');
  }
  return{kind,openings:r.props.filter(p=>p.bathroomOpening).length,problems};
 }));
 assert.ok(r.find(p=>p.kind==='bar').openings===1&&r.find(p=>p.kind==='islandhome').openings===1,JSON.stringify(r));
 for(const p of r)assert.deepEqual(p.problems,[],JSON.stringify(p));
}));
