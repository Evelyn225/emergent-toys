'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('storage',{word:'STORAGE',ret:[100,100,0],cell:[10,10]},[7,8.4,-Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('one whole shutter per exposed locker face: each lock sits on its own face and no door is cut at a corner',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],locks=room.props.filter(o=>o.storageLock),faces=storageShutterFaces(room);
  if(faces.length!==60)bad.push('faces '+faces.length);if(locks.length!==faces.length)bad.push('locks '+locks.length);
  for(const o of locks){
   const {face:q,parts}=o.storageLock,ax=q.x-q.fx*.5,ay=q.y-q.fy*.5;
   if(roomAt(ax,ay)!=='L')bad.push('lock not on a locker');
   const plane=q.fy?q.y:q.x;if(Math.abs(plane-Math.round(plane))>1e-9)bad.push('lock off the door plane');
   if(roomAt(q.x+q.fx*.5,q.y+q.fy*.5)!=='.')bad.push('lock on a closed face');
   const along=q.fy?q.x:q.y;if(Math.abs(along-Math.floor(along)-.5)>1e-9)bad.push('lock off the bay centre');
   const posts=parts.filter(k=>k.role==='handle-post');if(posts.length!==2)bad.push('posts');
   for(const k of posts){const inner=k.box.ax*q.fx+k.box.ay*q.fy,outer=k.box.bx*q.fx+k.box.by*q.fy;if(Math.abs(inner)>1e-9||Math.abs(outer-STORAGE_LOCK.proud)>1e-9)bad.push('post not from door to handle');}
   const h=parts.find(k=>k.role==='handle');if(Math.abs(h.box.ax*q.fx+h.box.ay*q.fy-STORAGE_LOCK.proud)>1e-9)bad.push('handle off its posts');
   if(o.box)bad.push('lock collides');
  }
  const wall=(u,z,d=2,mx=5,my=2)=>{storageWallFinish(0,u,.001,z,d,mx,my,8);return BG[0];},hue=c=>c>>4;
  if(hue(wall(5.5,1.2))!==ORANGE)bad.push('shutter hue');if(CH[0]!==' ')bad.push('shutter glyph');
  if(hue(wall(5.002,1.2))===ORANGE)bad.push('no post at the bay edge');
  if(hue(wall(5.5,2.4))===ORANGE)bad.push('shutter into the top band');
  const near=new Set();for(let z=.1;z<2;z+=.03)near.add(wall(5.5,z,1));if(near.size<2)bad.push('no ribs');
  const far=new Set();for(let z=.1;z<2;z+=.03)far.add(wall(5.5,z,6));if(far.size!==1)bad.push('ribs beat far off');
  if(hue(wall(5.5,1.5,2,5,0))===ORANGE)bad.push('shutter on an outer wall');
  // a unit number stays inside its bay
  storageWallFinish(0,5.5,.001,2.2,1,5,2,8);if(hue(BG[0])===ORANGE)bad.push('number band');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the attendant, the aisles and the fittings: your unit still opens at the counter, routes stay clear, the shell is glyph-free',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],desk=room.props.find(o=>o.box&&Math.abs(o.x-11.5)<1e-9&&Math.abs(o.y-7.75)<1e-9);
  if(!desk||Math.abs(desk.box.z1-1.05)>.06)bad.push('desk');
  px=11.5;py=8.45;if(!nearKeeper())bad.push('attendant out of reach');if(!free(px,py))bad.push('customer side blocked');
  for(const [x,y0,y1]of [[7.5,1.5,8.4],[4.5,1.5,8.4],[10.5,1.5,6.5]])for(let y=y0;y<y1;y+=.2)if(!free(x,y))bad.push(['aisle',x,+y.toFixed(1)]);
  for(let x=1.5;x<12.5;x+=.2)for(const y of [1.5,4.5,7.5])if(!free(x,y)&&!(y===7.5&&x>10))bad.push(['cross aisle',+x.toFixed(1),y]);
  const lights=room.props.filter(o=>o.storageCeilingLight);if(lights.length!==9)bad.push('lights');
  for(const o of lights)if(Math.abs(o.box.z1-3)>1e-9||o.box.z0<2.8)bad.push('light off the ceiling');
  if(!room.props.some(o=>o.storageEntrance))bad.push('entrance');if(!room.props.some(o=>o.storageSkirting))bad.push('base');
  const board=room.props.find(o=>o.storageWallBoard);if(!board||Math.abs(board.x-7)>1e-9||board.box||room.def.sign)bad.push('board');
  if(room.def.floor!=='storageConcrete'||surfaceAt('room',room,7,8)!=='tile')bad.push('footsteps changed');
  const floor=(x,y,fp=.001,L=6)=>{storageFloorFinish(0,x,y,L,fp);if(CH[0]!==' ')bad.push('floor glyph');return BG[0];};
  if(floor(4,2)===floor(2,2))bad.push('no saw cut');const far=new Set();for(let y=1;y<9;y+=.13)for(let x=1;x<13;x+=.17)far.add(floor(x,y,5));if(far.size!==1)bad.push('floor aliases');
  if(floor(2,2,.001,0)===floor(2,2,.001,12))bad.push('floor ignores light');
  px=4.5;py=8;a=-Math.PI/2;pitch=0;render(0);let glyphs=0;for(let i=0;i<cols*rows;i++)if(FL[i]===1&&CH[i]!==' ')glyphs++;if(glyphs)bad.push('floor glyphs '+glyphs);
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
