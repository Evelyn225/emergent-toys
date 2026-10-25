'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('spirit-house roof seams close and its gables meet the roof underside; the pedestal, tray and altar support their contents',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=THAI_SPIRIT_HOUSE(0,0),draw=drawBox,shapes=[],bad=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const role=n=>shapes.filter(q=>q.box.spiritRole===n),one=n=>role(n)[0],cast=(q,x,y,z,rx,ry,rz)=>q.ray(x,y,z,rx,ry,rz,q.box),same=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
  const top=(q,x=q.box.x,y=q.box.y)=>3-cast(q,x,y,3,0,0,-1),bottom=(q,x=q.box.x,y=q.box.y)=>-1+cast(q,x,y,-1,0,0,1);
  const roofs=role('roof');
  for(const [x,z]of model.spiritHouse.roof)for(const d of [-1e-7,0,1e-7]){
   if(Math.abs(x+d)>.255)continue;
   const t=roofs.map(q=>cast(q,x+d,0,3,0,0,-1)).filter(t=>t>0);
   if(!t.length||Math.abs(3-Math.min(...t)-z-model.spiritHouse.sheet)>.00001)bad.push(['roof seam',x,d,t]);
  }
  for(const gable of role('gable'))for(const x of [-.16,-.08,0,.08,.16]){
   const z=top(gable,x,gable.box.y),hits=roofs.map(q=>cast(q,x,gable.box.y,1,0,0,1)).filter(t=>t>0);
   if(!hits.length||!same(z,1+Math.min(...hits)))bad.push(['gable/roof',x,z,hits]);
  }
  for(const [a,b]of [['pedestal','tray'],['tray','floor'],['floor','altar'],['altar','figurine']])if(!same(top(one(a),one(b).box.x,one(b).box.y),bottom(one(b))))bad.push([a,b]);
  for(const p of role('post'))if(!same(top(one('floor'),p.box.x,p.box.y),bottom(p)))bad.push('post/floor');
  for(const p of role('offering-cup')){
   if(!same(top(one('tray'),p.box.x,p.box.y),bottom(p)))bad.push('cup/tray');
   if(!(top(p)>bottom(p)+.004&&top(p)<p.box.z1-.025))bad.push('closed offering cup');
  }
  const parent=model.box;
  for(const {box:b}of shapes)if(Math.abs(b.x)+b.hl>parent.hl+1e-7||Math.abs(b.y)+b.hw>parent.hw+1e-7||b.z0<parent.z0-1e-7||b.z1>parent.z1+1e-7)bad.push(['bounds',b.spiritRole]);
  return{bad,roofPanels:roofs.length,posts:role('post').length};
 });assert.deepEqual(r.bad,[]);assert.equal(r.roofPanels,4);assert.equal(r.posts,4);
}));

test('marigolds share the garland thread and pins reach the tray; the native Thai house stays clear of the walls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const model=THAI_SPIRIT_HOUSE(0,0),draw=drawBox,shapes=[],bad=[];
  drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{model.draw(0,0);}finally{drawBox=draw;}
  const flowers=shapes.filter(q=>q.box.spiritRole==='flower'),rope=shapes.filter(q=>q.box.spiritRole==='garland-thread'),pins=shapes.filter(q=>q.box.spiritRole==='garland-pin'),tray=shapes.find(q=>q.box.spiritRole==='tray');
  const attached=(x,y,z)=>flowers.some(q=>Math.hypot(q.box.x-x,q.box.y-y,(q.box.z0+q.box.z1)/2-z)<1e-8);
  for(const q of rope){const b=q.box;if(!attached(b.ax,b.ay,b.az)||!attached(b.bx,b.by,b.bz))bad.push('thread/blossom');}
  for(const q of pins){const b=q.box,t=tray.ray(b.ax,1,b.az,0,-1,0,tray.box),face=1-t;if(!(t>0&&b.ay-b.r<face&&b.ay+b.r>face)||!attached(b.bx,b.by,b.bz))bad.push('pin/tray/blossom');}
  for(const q of flowers){const b=q.box,t=q.ray(b.x,b.y+1,(b.z0+b.z1)/2,0,-1,0,b);
   if(!(t>0)||![HIT.nx,HIT.ny,HIT.nz].every(Number.isFinite)||Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)>1e-7)bad.push('flower normal');
   q.shade(0,t,0);const dark=BG[0]&15;q.shade(0,t,12);if((BG[0]&15)<=dark)bad.push('emissive flower');
  }
  enterRoom('thai',{word:'THAI',ret:[100,100,0]},[6,6,-Math.PI/2]);env(0);render(0);const native=room.props.find(q=>q.spiritHouse),b=native.box;
  return {bad,flowers:flowers.length,rope:rope.length,pins:pins.length,native:!!native,clear:b.x-b.hl>=1&&b.y-b.hw>=1&&b.z1<(room.def.height||3)};
 });assert.deepEqual(r.bad,[]);assert.equal(r.flowers,42);assert.equal(r.rope,6);assert.equal(r.pins,2);assert.ok(r.native&&r.clear);
}));
