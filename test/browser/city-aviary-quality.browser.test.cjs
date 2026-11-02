'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('aviary',{word:'AVIARY',neon:CYAN,ret:[100,100,0],cell:[10,10]},[3,3,0]);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('the aviary is built: no painted glyphs on its mesh, grass, pond or roof, day or night, and no sprite trees',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],W=room.W,H=room.H;
  if(room.props.some(o=>o.art===ART.tree))bad.push('sprite tree');
  for(const td of [12,23]){tod=td;env(0);
   let g=0,n=0;const birds=room.props;room.props=[];
   for(const [x,y,pt]of [[1.6,1.6,0],[W-1.6,1.6,.5],[1.6,H-1.6,-.4],[W-1.6,H-1.6,0],[7,10.4,.9]]){px=x;py=y;a=Math.atan2(H/2-y,W/2-x);pitch=pt;render(0);
    for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!=='')g++;}}
   room.props=birds;if(g/n>.01)bad.push(['glyph share',td,+(100*g/n).toFixed(1)]);}
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('each tree stands on the floor: a tapering trunk with collision, limbs reaching its crown, leaf clumps lit from above',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],trees=room.props.filter(o=>o.aviaryTree);
  if(trees.length!==4)bad.push(['trees',trees.length]);
  for(const o of trees){const t=o.aviaryTree,b={x:0,y:0,...t.trunk};
   if(!o.box||o.walk||o.box.z1<t.trunk.h-.01||o.box.hl<t.trunk.r0)bad.push(['trunk collision',t.k]);
   // rays at the trunk from the side: the radius narrows with height, and the foot is on the floor
   const rad=z=>{const hit=aviaryTrunkRay(-5,0,z,1,0,0,b);return hit<0?-1:5-hit;};
   if(Math.abs(rad(.01)-t.trunk.r0)>.003||!(rad(t.trunk.h*.9)<rad(.2)))bad.push(['taper',t.k,rad(.01),rad(t.trunk.h*.9)]);
   if(aviaryTrunkRay(-5,0,t.trunk.h+.05,1,0,0,b)>=0)bad.push(['trunk above its top',t.k]);
   for(const l of t.limbs){if(Math.hypot(l.ax-t.x,l.ay-t.y)>1e-6||l.az>t.trunk.h)bad.push(['limb off the trunk',t.k]);
    if(!t.clumps.some(c=>Math.hypot(l.bx-c.x,l.by-c.y,l.bz-c.z)<c.r))bad.push(['limb ends outside the leaves',t.k]);}
   if(!t.clumps.every(c=>c.z-c.r>t.trunk.h*.6))bad.push(['crown sags to the ground',t.k]);
   if(Math.hypot(t.x-AVIARY_POND.x,(t.y-AVIARY_POND.y)*AVIARY_POND.rx/AVIARY_POND.ry)<AVIARY_POND.rx+t.trunk.r0)bad.push(['tree in the pond',t.k]);
  }
  // a clump is brighter on top than underneath
  const tree=trees[0].aviaryTree,c=tree.clumps[0],shade=(nz)=>{HIT.u=0;HIT.v=Math.sqrt(1-nz*nz);HIT.w=nz;AVIARY_VIEW.clump={wx:c.x,wy:c.y,wz:c.z,r:c.r};BG[0]=0;tree.leaves(0,30,10);return BG[0]&15;};
  if(!(shade(.95)>shade(-.9)))bad.push(['leaf light',shade(.95),shade(-.9)]);
  // drawn: the trunk and clumps reach the renderer as real shapes
  const kinds=new Set(),db=drawBox;drawBox=(b,s,ray)=>{kinds.add(ray===aviaryTrunkRay?'trunk':ray===raySphere?'clump':ray===rayRod?'limb':'box');};
  try{for(const o of trees)o.draw(o.x-px,o.y-py,o);}finally{drawBox=db;}
  for(const k of ['trunk','clump','limb'])if(!kinds.has(k))bad.push(['not drawn',k]);
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the mesh frame: posts every 2 m on the kerb up to the roof rail, roof ribs across, and none of it blocks the floor while the pond does',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],f=room.props.find(o=>o.aviaryFrame),h=room.def.height;
  if(!f)return {bad:['no frame']};if(!f.walk||f.box)bad.push('frame blocks');
  const boxes=f.aviaryFrame.boxes,posts=boxes.filter(b=>b.z0===AVIARY_KERB&&b.z1===h);
  if(posts.length<20)bad.push(['posts',posts.length]);
  for(const b of posts){const onWall=Math.min(Math.abs(b.x-b.hl-1),Math.abs(b.x+b.hl-(room.W-1)),Math.abs(b.y-b.hw-1),Math.abs(b.y+b.hw-(room.H-1)));if(onWall>1e-6)bad.push(['post off the wall',b.x,b.y]);}
  const ribs=boxes.filter(b=>b.z1===h&&b.z0>h-.3&&(b.hl>3||b.hw>3));if(ribs.length<8)bad.push(['roof ribs',ribs.length]);
  if(!room.def.block(7,6))bad.push('pond walkable');
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
