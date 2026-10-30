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
test('gym floor, ceiling and walls are glyph-free filtered finishes with the same footsteps, and the mirrors run to their frames',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=()=>BG[0]>>4,floor=(x,y,fp=.001,L=6)=>{gymFloorFinish(0,x,y,L,fp);if(CH[0]!==' ')bad.push('floor glyph');return BG[0];};
  if(room.def.floor!=='gymRubber'||surfaceAt('room',room,8,6)!=='carpet')bad.push('footstep surface changed');
  if(floor(3,3.5)===floor(3.5,3.5))bad.push('no mat joint');
  const far=new Set();for(let y=1;y<9;y+=.17)for(let x=1;x<14;x+=.23)far.add(floor(x,y,2));if(far.size!==1)bad.push('joints alias at distance');
  if(floor(3.5,3.5,.001,0)===floor(3.5,3.5,.001,12))bad.push('floor ignores light');
  ROOM_CEILS.gymPlaster(0);if(CH[0]!==' ')bad.push('ceiling glyph');
  const wall=(u,z,mx,my)=>{gymWallFinish(0,u,.001,z,2,mx,my,8);if(CH[0]!==' ')bad.push('wall glyph');return hue();};
  // both signs of u: it runs whichever way reads left to right
  for(const u of [5,-5])if(wall(u,1.2,0,5)!==CYAN)bad.push('west mirror missing at '+u);
  if(wall(5,1.2,15,5)!==CYAN)bad.push('east mirror missing');
  if(wall(5,.2,0,5)===CYAN||wall(5,2.4,0,5)===CYAN)bad.push('mirror past its rails');
  if(wall(.8,1.2,0,1)===CYAN||wall(9.9,1.2,0,9)===CYAN)bad.push('mirror past its end bars');
  if(wall(5,1.2,5,0)===CYAN||wall(5,1.2,3,10)===CYAN)bad.push('mirror on an end wall');
  if(wall(5,2.26,5,0)!==ORANGE||wall(5,2.1,5,0)===ORANGE||wall(5,2.4,5,0)===ORANGE)bad.push('band wrong height');
  if(room.def.sign)bad.push('old painted sign still on');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('gym fittings: frames on the wall with bars over the joints, six lights on the ceiling, a board, a base and an entrance, none of it in the way',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],H=room.def.height||3,frames=room.props.filter(o=>o.gymMirrorFrame),lights=room.props.filter(o=>o.gymCeilingLight);
  if(frames.length!==2)bad.push('frames '+frames.length);
  for(const o of frames){
   const {parts,normal}=o.gymMirrorFrame;
   for(const q of parts){const face=o.x+q.box.x-normal*q.box.hl;if(Math.abs(face-o.x)>1e-9)bad.push('frame off the wall');}
   const joints=parts.filter(q=>q.role==='joint').map(q=>+(o.y+q.box.y).toFixed(6));
   const want=Array.from({length:GYM_MIRROR.panels-1},(_,k)=>+(GYM_MIRROR.y0+(k+1)*gymMirrorPitch()).toFixed(6));
   if(JSON.stringify(joints)!==JSON.stringify(want))bad.push('joints off the panel layout');
   const rails=parts.filter(q=>q.role==='rail');
   if(rails.length!==2||rails.some(q=>Math.abs(q.box.hw-((GYM_MIRROR.y1-GYM_MIRROR.y0)/2+.03))>1e-9))bad.push('rails short of the run');
   if(!rails.some(q=>q.box.z1===GYM_MIRROR.z0)||!rails.some(q=>q.box.z0===GYM_MIRROR.z1))bad.push('rails not touching the glass');
   for(const q of parts.filter(q=>q.role==='joint'||q.role==='end'))if(q.box.z0!==GYM_MIRROR.z0||q.box.z1!==GYM_MIRROR.z1)bad.push('bar short of the rails');
   if(o.box)bad.push('frame collides');
  }
  if(lights.length!==6)bad.push('lights '+lights.length);
  for(const o of lights){if(Math.abs(o.box.z1-H)>1e-9||!o.walk||!o.overhead)bad.push('light not on the ceiling');if(o.box.z0<H-.1)bad.push('light in the headroom');}
  const board=room.props.find(o=>o.gymWallBoard),b=board.gymWallBoard.parts[0].box;
  if(Math.abs(board.y-b.hw-1)>1e-9)bad.push('board off the back wall');if(board.box)bad.push('board collides');
  const base=room.props.filter(o=>o.gymSkirting);if(!base.length)bad.push('no skirting');
  const entry=room.props.find(o=>o.gymEntrance);if(!entry||entry.box||!entry.walk)bad.push('entrance');
  // the two door cells stay as they were, and the base stops short of them
  const parts=[],draw=drawBox;drawBox=box=>parts.push(box);try{for(const o of base)o.draw(o.x,o.y);}finally{drawBox=draw;}
  if(!parts.length)bad.push('base draws nothing');
  for(const q of parts)if(q.z1>.2)bad.push('base too tall');
  if(parts.some(q=>{const ex=Math.abs(q.c)*q.hl+Math.abs(q.s)*q.hw,ey=Math.abs(q.s)*q.hl+Math.abs(q.c)*q.hw;return q.y+ey>9.9&&q.y-ey<10.1&&q.x-ex<8.9&&q.x+ex>7.1;}))bad.push('base across the door');
  if(roomAt(7.5,9.5)!=='.'||roomAt(8.5,9.5)!=='.'||roomAt(7.5,10.5)!=='D'||roomAt(8.5,10.5)!=='D')bad.push('door cells changed');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('actual view: the mirror and band show from clear floor, the floor carries no glyphs, and the ring and trainer still work',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];px=5;py=5.5;a=Math.PI;pitch=0;render(0);
  const hues=new Set();for(let i=0;i<cols*rows;i++)hues.add(BG[i]>>4);
  if(!hues.has(CYAN))bad.push('no mirror in view');if(!hues.has(ORANGE))bad.push('no band in view');
  px=8;py=6;a=-Math.PI/2;pitch=0;render(0);
  let glyphs=0;for(let i=0;i<cols*rows;i++)if(FL[i]===1&&CH[i]!==' ')glyphs++;
  if(glyphs)bad.push('floor glyphs '+glyphs);
  needs.health=100;money=100;
  px=12;py=7.4;if(!nearRing())bad.push('ring not reachable');
  if(!/fight/.test(gymPrompt()))bad.push('ring prompt gone');
  px=3;py=6.9;if(!nearKeeper())bad.push('trainer not reachable');
  if(!/trainer|shape|tomorrow/i.test(gymPrompt()))bad.push('trainer prompt gone');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
