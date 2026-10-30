'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('gym',{word:'GYM',ret:[100,100,0]},[8,9.4,-Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('treadmills: uprights end in the deck and console, runners stand on the belt, the belt moves up close and is quiet far off',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],mills=room.props.filter(o=>o.treadmill);
  if(mills.length!==4)bad.push('treadmills '+mills.length);
  const {parts,deck}=mills[0].treadmill,belt=parts.find(q=>q.role==='belt'),con=parts.find(q=>q.role==='console');
  if(belt.box.z1!==deck)bad.push('belt not at the deck');
  for(const q of parts.filter(q=>q.role==='upright')){
   if(Math.min(q.box.az,q.box.bz)>deck)bad.push('upright off the deck');
   const top=q.box.az>q.box.bz?q.box:{ax:q.box.bx,ay:q.box.by,az:q.box.bz};
   if(top.az<con.box.z0||Math.abs(top.ay-con.box.y)>con.box.hw)bad.push('upright short of the console');
  }
  for(const q of parts.filter(q=>q.role==='handrail-post'))if(Math.min(q.box.az,q.box.bz)!==deck)bad.push('handrail post off the deck');
  for(const o of mills)if(o.box.z1<con.box.z1)bad.push('box below the console');
  for(const fig of room.props.filter(o=>o.fig&&o.y>2&&o.y<3)){const mill=mills.find(o=>Math.abs(o.x-fig.x)<.01);if(!mill||Math.abs(fig.z-deck)>1e-9)bad.push('runner off the belt');}
  HIT.nz=1;HIT.nx=HIT.ny=0;HIT.v=.1;
  const shade=(time,t)=>{const keep=T;T=time;gymBeltShade(0,t,6);T=keep;if(CH[0]!==' ')bad.push('belt glyph');return BG[0];};
  const near=new Set();for(let k=0;k<20;k++)near.add(shade(k*.013,1));if(near.size<2)bad.push('belt does not move');
  const far=new Set();for(let k=0;k<20;k++)far.add(shade(k*.013,40));if(far.size!==1)bad.push('belt shimmers far off');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('weight racks: each head rests on its rails, sizes fit their bays and tiers, and the rails meet the posts',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],racks=room.props.filter(o=>o.weightRack);if(racks.length!==2)bad.push('racks '+racks.length);
  const {parts,bells}=racks[0].weightRack,{rail,railR,half,tiers,top}=GYM_RACK;
  if(bells.length!==14)bad.push('bells '+bells.length);
  const heads=parts.filter(q=>q.role==='head');
  for(const q of heads){
   if(!tiers.some(z=>Math.abs(q.box.z0-z-railR)<1e-9))bad.push('head off the rail');
   if(Math.abs(Math.abs(q.box.y)-rail)>1e-9)bad.push('head beside the rail');
   if(q.box.hl>.12)bad.push('head wider than its bay');
  }
  for(const z of tiers){const next=tiers.find(v=>v>z)??top;for(const q of heads.filter(q=>Math.abs(q.box.z0-z-railR)<1e-9))if(q.box.z1>next-railR)bad.push('head hits the tier above');}
  for(const q of parts.filter(q=>q.role==='rail'))if(Math.abs(q.box.ax)!==half||Math.abs(q.box.bx)!==half)bad.push('rail short of the post');
  for(const q of parts.filter(q=>q.role==='post'))if(Math.max(q.box.az,q.box.bz)!==top)bad.push('post not full height');
  for(const o of racks){const reach=Math.max(...parts.map(q=>Math.abs(q.box.y)+q.box.hw));if(reach>o.box.hw+1e-9)bad.push('rack outside its box');if(o.y+o.box.hw>10)bad.push('rack in the wall');}
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('ring: ropes end in the pads, posts stand on the canvas, the box reaches their tops, the canvas is glyph-free and filters its roundel',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],o=room.props.find(q=>q.boxingRing),{parts,ropes,post}=o.boxingRing,{h,top}=GYM_RING;
  if(!o||o.x!==GYM_RING.x||o.y!==GYM_RING.y)bad.push('ring moved');
  const ends=parts.filter(q=>q.role==='rope');if(ends.length!==12)bad.push('ropes '+ends.length);
  const pads=parts.filter(q=>q.role==='pad');
  for(const q of ends)for(const [x,y,z]of [[q.box.ax,q.box.ay,q.box.az],[q.box.bx,q.box.by,q.box.bz]]){
   if(!ropes.includes(z))bad.push('rope height');
   if(!pads.some(q=>Math.abs(q.box.x-x)<1e-9&&Math.abs(q.box.y-y)<1e-9&&z>top+.25&&z<top+.95))bad.push('rope end outside its pad');
  }
  const posts=parts.filter(q=>q.role==='post');if(posts.length!==4)bad.push('posts');
  for(const q of posts){if(q.box.z0!==top)bad.push('post off the canvas');if(q.box.z1>o.box.z1+1e-9)bad.push('post above the box');if(Math.abs(q.box.x)!==post)bad.push('post moved');}
  if(o.box.hl!==h||o.box.hw!==h)bad.push('footprint changed');
  const canvas=(u,v,t,face=5)=>{HIT.face=face;HIT.u=u;HIT.v=v;HIT.w=top;gymRingShade(0,t,6);if(CH[0]!==' ')bad.push('canvas glyph');return BG[0]>>4;};
  if(canvas(.7,0,3)!==RED)bad.push('roundel missing');if(canvas(1.2,0,3)!==WHITE)bad.push('roundel too wide');
  if(canvas(h-.02,0,3)!==BLUE)bad.push('edge tape missing');
  if(canvas(.7,0,40)===RED)bad.push('roundel aliases far off');
  // walking round it: the old approach still gets the prompt, and the ring stops you at the ropes
  px=12;py=7.4;needs.health=100;if(!/fight/.test(gymPrompt()))bad.push('ring prompt gone');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the bag hangs from the ceiling on a joined chain with headroom under it, the desk stays where the trainer stands, and the sports shop keeps its kit',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],H=room.def.height||3,o=room.props.find(q=>q.heavyBag),{parts,bottom,shoulder,height}=o.heavyBag;
  if(height!==H)bad.push('bag height');
  const chain=parts.find(q=>q.role==='chain'),plate=parts.find(q=>q.role==='plate');
  if(Math.min(chain.box.az,chain.box.bz)!==shoulder)bad.push('chain off the bag');if(Math.max(chain.box.az,chain.box.bz)!==plate.box.z0)bad.push('chain off the plate');
  if(plate.box.z1!==H)bad.push('plate off the ceiling');
  if(o.box.z0!==bottom||o.box.z1!==H)bad.push('bag box');
  if(roomAt(o.x,o.y)!=='.')bad.push('bag in a wall');
  // clear of the door approach and the ring
  if(Math.hypot(o.x-8,o.y-10)<3||Math.max(Math.abs(o.x-GYM_RING.x),Math.abs(o.y-GYM_RING.y))<GYM_RING.h+.6)bad.push('bag in the way');
  const desk=room.props.find(q=>q.box&&Math.abs(q.x-3)<1e-9&&Math.abs(q.y-7.95)<1e-9);
  if(!desk||Math.abs(desk.box.z1-1.05)>.06)bad.push('desk');
  px=3;py=6.9;money=100;if(!nearKeeper())bad.push('trainer unreachable');
  enterRoom('sports',{word:'SPORTS',ret:[100,100,0]},ROOM_DEFS.sports.entry||[5,5,0]);render(0);
  if(room.props.filter(q=>q.treadmill).length!==1||room.props.filter(q=>q.weightRack).length!==1)bad.push('sports kit lost');
  const rack=room.props.find(q=>q.weightRack);if(rack.y-rack.box.hw<1)bad.push('sports rack in the wall');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
