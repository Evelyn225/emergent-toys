'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=null;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('closed home window casings touch their wall, join across their corners and bars, retain clear panes and reuse their geometry',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  px=py=0;projX=10000;const errors=[],save=drawBox;
  for(const tier of [0,1,2])for(const face of ['west','east','north','south']){
   const win={face,center:5,half:1,bottom:1,top:2.7},o=HOME_WINDOW_CASING(win,12,12,tier),c=face==='north'?1:face==='south'?-1:0,s=face==='west'?-1:face==='east'?1:0;
   const capture=()=>{const a=[];drawBox=(box,shade,ray)=>a.push({box:{...box},ref:box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=save;}return a;},P=capture(),again=capture();
   const point=(u,v)=>[o.x+c*u-s*v,o.y+s*u+c*v];
   const cast=(q,u,v,z,du,dv,dz)=>q.ray(...point(u,v),z,c*du-s*dv,s*du+c*dv,dz,q.box);
   const solid=(u,z)=>P.some(q=>{const t=cast(q,u,1,z,0,-1,0);return t>0&&t<1.01;});
   for(const [k,q] of P.entries()){
    const b=q.box,u=(b.x-o.x)*c+(b.y-o.y)*s,v=-(b.x-o.x)*s+(b.y-o.y)*c;
    if(Math.abs(v-b.hw)>1e-8)errors.push([face,'back detached from wall',v,b.hw]);
    if(Math.abs(u)+b.hl>1.055001||v+b.hw>.160001||b.z0<.954999||b.z1>2.700001)errors.push([face,'outside opening surround']);
    const t=cast(q,u,1,(b.z0+b.z1)/2,0,-1,0);if(!(t>0))errors.push('open or missing front');else {q.shade(0,t,8);if(Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>.00001)errors.push('non-unit normal');}
    if(q.ref!==again[k].ref||q.ray!==again[k].ray||q.shade!==again[k].shade)errors.push('per-frame geometry/material rebuild');
   }
   // Sample both sides of each join on the actual rendered shapes.
   for(const u of [-.955,.955])for(const z of [1.095,1.1,1.105,2.595,2.6,2.605])if(!solid(u,z))errors.push([face,'open casing join',u,z]);
   for(const z of [2.08,2.085,2.09,2.15,2.155,2.16])if(!solid(0,z))errors.push([face,'open glazing-bar join',z]);
   for(const u of [-.45,.45])for(const z of [1.4,2.4])if(solid(u,z))errors.push([face,'pane blocked',u,z]);
   const sill=P.find(q=>q.box.z1===1);if(!sill||Math.abs(2-cast(sill,0,.08,2,0,0,-1)-1)>.0002)errors.push('sill does not support bottom rail');
  }
  return errors;
 });assert.deepEqual(bad,[]);
}));

test('all native apartment families use their real openings and exterior views; fitted windows preserve room routes and leave Fern alone',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const errors=[];
  for(const kind of ['home','loft','bellehome']){
   enterRoom(kind,{ret:[100,100,0]},ROOM_DEFS[kind].entry);const frames=room.props.filter(o=>o.windowCasing);
   if(frames.length!==room.def.windows.length||frames.length!==(kind==='home'?2:5))errors.push([kind,'missing windows']);
   const draw=drawBox;try{for(const f of frames){const pieces=[];drawBox=b=>pieces.push({...b});f.draw(f.x,f.y);
    for(const o of room.props.filter(o=>o.box&&['shelf','cabinet','bed'].includes(o.furniture)))if(pieces.some(b=>b.z0<o.box.z1-.001&&b.z1>o.box.z0+.001&&furnishingOverlap(b,o.box,.001)))errors.push([kind,'window intersects fitted furniture',o.furniture,o.x,o.y]);
   }}finally{drawBox=draw;}
   const view=homeView,calls=[];homeView=(i,u,z,face)=>{calls.push(face);BG[i]=C(CYAN,7);set(i,'Q',C(WHITE,12));};
   try{for(const win of room.def.windows){const mx=win.face==='west'?0:Math.floor(win.center),my=win.face==='north'?0:Math.floor(win.center);
    homeWall(0,win.center,.01,1.5,1,mx,my,8);if(CH[0]!=='Q'||calls.at(-1)!==win.face)errors.push([kind,'wall still paints a frame instead of a real view']);
   }}finally{homeView=view;}
   const saved=[px,py,a,pitch],r=room;render(0);if(room!==r||[px,py,a,pitch].some((v,k)=>v!==saved[k])||!room.exterior)errors.push([kind,'exterior rendering changed the camera']);
   // Decorations must not introduce a collision box across a doorway or route.
   if(frames.some(o=>o.box)||!free(...room.def.entry.slice(0,2)))errors.push([kind,'window geometry blocks room entry']);
   if(kind!=='home'){const y=kind==='loft'?7:8;if(!roomWalkLine(5.5,y-.5,5.5,y+2.5))errors.push([kind,'bedroom route blocked']);}
  }
  enterRoom('islandhome',{ret:[100,100,0]},ROOM_DEFS.islandhome.entry);if(room.props.some(o=>o.windowCasing))errors.push('Fern received duplicate frames');
  return errors;
 });assert.deepEqual(bad,[]);
}));
