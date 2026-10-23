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
test('every bathroom opening has a pocket door: shut when nobody is near, open as you come either way, hidden in the wall when open',()=>fixture(async page=>{
 const r=await page.evaluate(()=>Object.keys(ROOM_DEFS).filter(kind=>ROOM_DEFS[kind].wc).map(kind=>{
  const r=makeRoom(kind),problems=[];room=r;mode='room';
  const doors=r.props.filter(p=>p.bathroomDoor),openings=bathroomOpenings(r);
  if(doors.length!==openings.length)problems.push(`${doors.length} doors for ${openings.length} openings`);
  for(const d of doors){
   const q=d.bathroomDoor,shapes=[],draw=drawBox,along=(u,v)=>q.vertical?[q.cross+.5+v,u]:[u,q.cross+.5+v];
   const leaf=()=>{shapes.length=0;drawBox=(box,shade,ray=rayBox)=>shapes.push({box,ray});try{d.draw(d.x,d.y);}finally{drawBox=draw;}
    return shapes.filter(s=>s.box.leaf);};
   // far away (over by the room's own door) for a while: it shuts the opening, full height
   [px,py]=r.def.spawn||[r.W/2,r.H-1.6];for(let k=0;k<40;k++){T+=.05;leaf();}
   const shut=leaf(),[mx,my]=along((q.start+q.end)/2,0);
   if(!shut.some(s=>s.ray(mx,my,1,0,0,-1,s.box)>0||s.ray(...along((q.start+q.end)/2,-.3),1,...(q.vertical?[1,0]:[0,1]),0,s.box)>0))problems.push('shut leaf does not fill the opening');
   // walk up to it from outside, then from inside: it opens, and is then entirely inside the wall beside the opening
   for(const v of [-1.1,1.1]){
    [px,py]=along((q.start+q.end)/2,v);for(let k=0;k<20;k++){T+=.05;leaf();}
    const open=leaf();
    for(const s of open)for(const u of [s.box.x-s.box.hl*Math.abs(s.box.c)-s.box.hw*Math.abs(s.box.s),s.box.x+s.box.hl*Math.abs(s.box.c)+s.box.hw*Math.abs(s.box.s)])
     for(const w of [s.box.y-s.box.hl*Math.abs(s.box.s)-s.box.hw*Math.abs(s.box.c),s.box.y+s.box.hl*Math.abs(s.box.s)+s.box.hw*Math.abs(s.box.c)])
      if(!'#W'.includes(r.grid[Math.floor(w)]?.[Math.floor(u)]))problems.push(`open leaf corner ${u.toFixed(2)},${w.toFixed(2)} outside the wall (from ${v})`);
   }
  }
  return{kind,doors:doors.length,problems};
 }));
 for(const p of r)assert.deepEqual(p.problems,[],JSON.stringify(p));
 assert.ok(r.reduce((n,p)=>n+p.doors,0)>=30,'a door in every discovered opening');
}));
test('the pocket door closes behind you once you are in, and slides with a sound',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  enterRoom('hotelroom',{lobby:{word:'MOTEL',ret:[100,100,0]}},[8.3,3.5,Math.PI/2]);
  const d=room.props.find(p=>p.bathroomDoor),q=d.bathroomDoor,w=room.def.wc,heard=[],real=bathroomDoorSound;bathroomDoorSound=(kind)=>heard.push(kind);
  // which way the bathroom lies from the opening, and a spot at its far end
  const mid=(q.start+q.end)/2,inWc=(x,y)=>x>=w.x0&&x<w.x1&&y>=w.y0&&y<w.y1,at=v=>q.vertical?[q.cross+.5+v,mid]:[mid,q.cross+.5+v];
  const inward=inWc(...at(1))?1:-1,far=q.vertical?[inward>0?w.x1-.5:w.x0+.5,(w.y0+w.y1)/2]:[(w.x0+w.x1)/2,inward>0?w.y1-.5:w.y0+.5];
  try{
   const step=n=>{for(let k=0;k<n;k++){T+=.05;d.draw(d.x,d.y);}};
   [px,py]=at(-inward*3.2);step(5);const away=d.open;                  // (out in the room, well clear)
   // and drawn shut: looking straight at it, the middle of the screen is the leaf, not the bathroom beyond it
   a=Math.atan2(d.y-py,d.x-px);pitch=0;render(0);const shutDepth=ZB[(hor)*cols+(cols>>1)],leafDepth=Math.hypot(d.x-px,d.y-py);
   [px,py]=at(-inward*1.1);step(20);const approached=d.open;           // (in the room, by the door)
   [px,py]=at(inward*1.1);step(10);const through=d.open;               // (just inside the bathroom)
   [px,py]=far;step(30);const inside=d.open;                           // (at the far end of the bathroom)
   return{away,approached,through,inside,heard,shutDepth,leafDepth};
  }finally{bathroomDoorSound=real;}
 });
 assert.ok(r.away<.01&&r.approached>.99&&r.through>.99,JSON.stringify(r));
 assert.ok(r.inside<.01,'privacy: shut behind you: '+JSON.stringify(r));
 assert.ok(Math.abs(r.shutDepth-r.leafDepth)<.1,'the shut leaf is what you see: '+JSON.stringify(r));
 assert.deepEqual(r.heard,['open','close']);
}));
test('a paper holder within reach of each toilet and a towel bar beside each basin, fixed to real walls and clear of the fittings',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const out={holders:0,towels:0,problems:[]};
  for(const kind of Object.keys(ROOM_DEFS)){
   let rm;try{rm=makeRoom(kind);}catch{continue;}
   room=rm;mode='room';px=rm.W/2;py=rm.H/2;
   const solid=(x,y)=>'#W'.includes(rm.grid[Math.floor(y)]?.[Math.floor(x)]||' ');
   for(const p of rm.props){
    if(!p.draw)continue;
    const shapes=[],draw=drawBox;drawBox=(b,s,ray)=>shapes.push(b);try{p.draw(p.x,p.y,p);}catch(e){out.problems.push(kind+': '+e.message);}finally{drawBox=draw;}
    for(const b of shapes){
     if(b.roll){
      out.holders++;
      if(!(solid(b.wall+.01,b.ay)&&!solid(b.wall-.01,b.ay)||solid(b.wall-.01,b.ay)&&!solid(b.wall+.01,b.ay)))out.problems.push(kind+': roll holder not on a wall face');
      if(b.az<.6||b.az>.85)out.problems.push(kind+': roll at '+b.az);
     }
     if(b.towel){
      out.towels++;
      const [wx,wy]=b.wall,behind=[b.x+wx*.08,b.y+wy*.08];
      if(!solid(...behind))out.problems.push(kind+': towel not against a wall');
      if(b.z0<.5)out.problems.push(kind+': towel on the floor');
      for(const q of rm.props)if(q!==p&&q.box&&!q.walk&&q.box.z1>.6&&q.box.z0<1.06&&[-1,0,1].some(k=>inBox(q.box,b.x+b.c*k*b.hl,b.y+b.s*k*b.hl,0)))out.problems.push(kind+': towel inside another fitting');
     }
    }
   }
  }
  return out;
 });
 assert.deepEqual(r.problems,[]);
 assert.ok(r.holders>=20&&r.towels>=29,JSON.stringify(r)); // (every basin with a wall mirror has a towel)
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
