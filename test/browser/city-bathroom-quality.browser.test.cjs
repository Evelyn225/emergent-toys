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
   // nothing shares the wall's jamb planes (they z-fight), and the wide, thin soffit is a flat box, not a rounded march
   for(const s of shapes){
    const b=s.box,ex=[b.x-b.hl*Math.abs(b.c)-b.hw*Math.abs(b.s),b.x+b.hl*Math.abs(b.c)+b.hw*Math.abs(b.s)],ey=[b.y-b.hl*Math.abs(b.s)-b.hw*Math.abs(b.c),b.y+b.hl*Math.abs(b.s)+b.hw*Math.abs(b.c)];
    const [ends,depth]=q.vertical?[ey,ex]:[ex,ey],inWall=depth[0]<q.cross+1-1e-6&&depth[1]>q.cross+1e-6;
    // (a box in the wall's depth, beyond a jamb, whose face looks into the opening from that jamb's own plane)
    if(b.z0<2.2&&inWall&&(Math.abs(ends[1]-q.start)<1e-6||Math.abs(ends[0]-q.end)<1e-6))problems.push('trim face in a jamb plane');
   }
   const soffit=shapes.find(s=>s.box.z0===2.2&&s.box.z1===2.26);
   if(!soffit||soffit.box.round)problems.push('soffit missing or rounded');
  }
  return{kind,openings:r.props.filter(p=>p.bathroomOpening).length,problems};
 }));
 assert.ok(r.find(p=>p.kind==='bar').openings===1&&r.find(p=>p.kind==='islandhome').openings===1,JSON.stringify(r));
 for(const p of r)assert.deepEqual(p.problems,[],JSON.stringify(p));
}));
test('bathroom paper has an open core with correct axis normals, and mounted fittings stay on real wall faces',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[];let paper=0,towels=0,expectedPaper=0,expectedTowels=0,core,normal;
  for(const kind of Object.keys(ROOM_DEFS)){
   const r=makeRoom(kind);room=r;mode='room';
   expectedPaper+=r.props.filter(p=>p.bathroomToilet&&!p.bathroomToilet.metal).length;
   expectedTowels+=r.props.filter(p=>p.bathroomSink&&bathroomMirrorMount(p.x,p.y,p.bathroomSink.fx,p.bathroomSink.fy,r).wall).length;
   for(const prop of r.props.filter(p=>p.bathroomAccessory)){
    const d=prop.bathroomAccessory,[wx,wy]=d.wall,[x,y]=d.anchor,dist=Math.hypot(x-wx,y-wy),nx=(x-wx)/dist,ny=(y-wy)/dist;
    if(!'#W'.includes(r.grid[Math.floor(wy-ny*.01)]?.[Math.floor(wx-nx*.01)]||' '))bad.push([kind,'floating mount',d]);
    const pad=d.kind==='towel'?d.half+.02:.11;
    for(const side of [-1,1])if(r.grid[Math.floor(y+nx*side*pad)]?.[Math.floor(x-ny*side*pad)]!=='.')bad.push([kind,'side wall overlap',d]);
    for(const q of r.props)if(q!==prop&&q.box&&!q.walk&&q.box.z1>.6&&q.box.z0<1.215&&[-1,0,1].some(k=>inBox(q.box,x-ny*k*pad,y+nx*k*pad,0)))bad.push([kind,'inside another fitting',d]);
    if(d.kind==='towel'){
     towels++;
     const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{prop.draw(prop.x,prop.y);}finally{drawBox=draw;}
     const fold=shapes.find(s=>s.ray===coveRayCapsule&&s.box.r===.02);
     if(!fold){bad.push([kind,'missing cloth fold']);continue;}
     HIT.face=0;HIT.nx=0;HIT.ny=0;HIT.nz=1;HIT.u=0;HIT.w=1.2;fold.shade(0,1,1);const color=BG[0];
     HIT.u=1;HIT.w=0;fold.shade(0,1,1);if(BG[0]!==color)bad.push([kind,'fold uses stale UV coordinates']);
    }else{
     paper++;
     if(core===undefined){
      const draw=drawBox,shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{prop.draw(prop.x,prop.y);}finally{drawBox=draw;}
      const roll=shapes.find(s=>s.ray===bathroomRayRoll);
      core=roll.ray(x-.5,y,.65,1,0,0,roll.box);
      roll.ray(x-.5,y+.035,.65,1,0,0,roll.box);normal={nx:HIT.nx,n:Math.hypot(HIT.nx,HIT.ny,HIT.nz)};
     }
    }
   }
  }
  return{bad,paper,towels,expectedPaper,expectedTowels,core,normal};
 });assert.deepEqual(r.bad,[]);assert.ok(r.paper>0&&r.paper===r.expectedPaper&&r.towels===r.expectedTowels,JSON.stringify(r));assert.ok(r.core<0&&r.normal.nx<-.9&&Math.abs(r.normal.n-1)<1e-8,JSON.stringify(r));
}));
