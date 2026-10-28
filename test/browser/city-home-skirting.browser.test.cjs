'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('fitted home baseboards have supported closed profiles, no overlapping corners or fixture intersections, and cached bounds',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[];let checked=0;for(const kind of ['home','loft','bellehome']){
  enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);render(0);const model=room.props.find(p=>p.homeSkirting);if(!model){bad.push(kind+' lacks fitted baseboards');continue;}
  const parts=model.homeSkirting.parts;if(parts.length<16)bad.push(kind+' loses wall coverage');
  const draw=drawBox,capture=(o,x=o.x,y=o.y)=>{const out=[];drawBox=(b,shade,ray=rayBox)=>out.push({box:{...b},ref:b,shade,ray});try{o.draw(x,y,o);}finally{drawBox=draw;}return out;};
  const native=capture(model),again=capture(model),moved=capture(model,.2,.3);capture(model);
  for(let k=0;k<parts.length;k++){
   checked++;const part=parts[k],b=part.box,[nx,ny]=part.normal,q=native[k],back=b.x*nx+b.y*ny-b.hw,plane=part.wall*(nx||ny);
   if(Math.abs(back-plane+.002)>1e-8||b.z0<0||b.z1>.17||b.hw*2>.04)bad.push('unsupported or oversized board');
   if(q.ref!==again[k].ref||q.shade!==again[k].shade||q.ref!==moved[k].ref||Math.abs(moved[k].box.x-b.x-.2)>1e-8||Math.abs(moved[k].box.y-b.y-.3)>1e-8)bad.push('bounds/material rebuilt or displaced');
   const t=q.ray(b.x+nx*(b.hw+.2),b.y+ny*(b.hw+.2),(b.z0+b.z1)/2,-nx,-ny,0,b);if(Math.abs(t-.2)>1e-8)bad.push('front not closed');
   q.shade(0,t,8);if(Math.hypot(HIT.nx-nx,HIT.ny-ny,HIT.nz)>1e-8)bad.push('wrong rotated lighting normal');
   const cap=q.ray(b.x,b.y,b.z1+.2,0,0,-1,b);if(cap<0||Math.abs(HIT.w-b.z1)>1e-8)bad.push('missing solid cap');
   for(let j=k+1;j<parts.length;j++){const B=parts[j].box;if(b.z0<B.z1-1e-7&&b.z1>B.z0+1e-7&&furnishingOverlap(b,B,1e-7))bad.push('overlapping baseboard faces');}
  }
  const lip=parts.find(p=>p.normal[0]===0&&p.normal[1]===-1&&p.box.z1===model.homeSkirting.profile[1][1]);
  const lipColor=(face,t)=>{HIT.face=face;HIT.u=HIT.v=0;HIT.w=lip.box.z1;lip.shade(0,t,8);return BG[0];};
  if(lipColor(5,20)!==lipColor(3,20)||lipColor(5,.2)===lipColor(3,.2))bad.push('cap light fails to filter at distance or resolve nearby');
  const contains=(x,y,z)=>parts.some(p=>z>p.box.z0&&z<p.box.z1&&inBox(p.box,x,y,0));
  for(const [z0,z1]of model.homeSkirting.profile){const z=(z0+z1)/2;
   for(const [x,y]of [[3,room.H-1-.005],[1.005,room.H-1-.005],[room.def.wc.x0-1-.005,room.def.wc.y1+1+.005]])if(!contains(x,y,z))bad.push(kind+' open straight/corner join');
  }
  const [body,cap]=model.homeSkirting.profile,edge=room.H-1-body[2]-.002;
  if(contains(3,edge,(body[0]+body[1])/2)||!contains(3,edge,(cap[0]+cap[1])/2))bad.push('cap has no real projecting step');
  // Probe the drawn low geometry independently, including entry/passage/bathroom casings.
  const fixtures=room.props.filter(o=>o!==model&&!o.fig&&typeof o.draw==='function').flatMap(o=>capture(o)).filter(q=>q.box.z0<.17&&q.box.z1>0);
  for(const part of parts)for(const q of fixtures){const a=part.box,b=q.box;if(a.z0<b.z1-1e-6&&a.z1>b.z0+1e-6&&furnishingOverlap(a,b,1e-6))bad.push(kind+' baseboard intersects drawn fixture');}
  for(const cut of room.def.homePassages||[])for(const u of [cut.start+.2,(cut.start+cut.end)/2,cut.end-.2])if(parts.some(p=>p.box.z0<.1&&inBox(p.box,u,cut.cross+.5,.1)))bad.push('board crosses open passage');
  homeWall(0,5,0,.05,1,0,0,8);if(CH[0]!==' ')bad.push('painted base glyph remains');
 }
 enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);if(room.props.some(p=>p.homeSkirting))bad.push('Fern altered');return{bad,checked};});assert.ok(r.checked>70);assert.deepEqual(r.bad,[]);
}));

test('baseboards keep real home passage walking, lamp controls and furniture packing/refresh usable',()=>fixture(async p=>{
 for(const [id,kind] of [['home_studio','home'],['home_loft','loft'],['home_belle','bellehome']]){
  await p.evaluate(({id,kind})=>{mode='walk';room=null;money=500000;const q=buyProperty(id,...citySourcePoint(41,73));if(!q[0])throw Error(q[1]);const h=owned.homes.at(-1);enterRoom(kind,{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[100,100,0]},ROOM_DEFS[kind].entry);window.baseboard=room.props.find(p=>p.homeSkirting);for(const cut of room.def.homePassages||[]){px=(cut.start+cut.end)/2;py=cut.cross-.7;for(let i=0;i<24;i++)move(0,.1);if(Math.abs(py-cut.cross-1.7)>1e-8)throw Error('blocked passage');for(let i=0;i<24;i++)move(0,-.1);}
   const [x,y]=room.def.lamps[0];px=x;py=y+1.5;a=-Math.PI/2;pitch=0;render(0);pitch=((room.def.height-.65-eye)/1.5)*projY/rows;render(0);
  },{id,kind});
  assert.match(await p.evaluate(()=>promptText()),/lamp off/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeRecord().lights.fixed0),false);
  await p.evaluate(()=>{const f=homeFurnishings(homeRecord());f.parts.push({id:'f_lamp',key:f.next++,x:3,y:room.H-2,a:0,on:true});refreshFurnishedRoom();});
  await p.keyboard.press('f');await p.locator('[data-pack="1"]').click();await p.keyboard.press('e');
  assert.equal(await p.evaluate(()=>{refreshWorkshopRoom();return room.props.filter(p=>p===window.baseboard).length===1&&homeFurnishings(homeRecord()).parts.length===0&&inv.some(i=>i.id==='f_lamp');}),true);
 }
}));

test('native wall raster samples stay above the floor at baseboard joins and ordinary room/city views',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[];let checked=0;const wall=ROOMW.wall,cityWall=CITY.wall;const probe=original=>(...args)=>{checked++;if(args[3]<-1e-8)bad.push(args[3]);return original(...args);};ROOMW.wall=probe(wall);CITY.wall=probe(cityWall);
  try{for(const kind of ['home','loft','bellehome','bar','hotelroom']){enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry||[3.5,6,0]);px=kind==='bar'?3.5:kind==='hotelroom'?7:4.1;py=room.H-3;a=2.5;for(const v of [-.3,0,.3]){pitch=v;render(0);}}
   mode='walk';room=null;[px,py]=citySourcePoint(41,73);a=.4;for(const v of [-.3,0,.3]){pitch=v;render(0);}
  }finally{ROOMW.wall=wall;CITY.wall=cityWall;}return{checked,bad};});assert.ok(r.checked>1000);assert.deepEqual(r.bad,[]);
}));
