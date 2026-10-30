'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('tile, concrete and carpet are glyph-free, show their joints or flecks up close, settle far off and answer the light',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],run=(fn,x,y,fp=.001,L=6)=>{fn(0,x,y,L,fp);if(CH[0]!==' ')bad.push(fn.name+' glyph');return BG[0];};
  if(run(sharedTileFinish,.6001,.3)===run(sharedTileFinish,.9,.3))bad.push('tile has no grout');
  if(run(sharedTileFinish,.3,.3)===run(sharedTileFinish,.9,.3))bad.push('tile has no check');
  if(run(sharedConcreteFinish,4,2)===run(sharedConcreteFinish,2,2))bad.push('concrete has no saw cut');
  const near=new Set();for(let y=.02;y<3;y+=.11)for(let x=.03;x<3;x+=.13)near.add(run(sharedCarpetFinish,x,y)>>4);if(near.size<3)bad.push('carpet lost its flecks');
  for(const fn of [sharedTileFinish,sharedConcreteFinish,sharedCarpetFinish]){
   const far=new Set();for(let y=.1;y<12;y+=.37)for(let x=.1;x<14;x+=.41)far.add(run(fn,x,y,5));if(far.size!==1)bad.push(fn.name+' aliases far off');
   if(run(fn,2.3,2.3,5,0)===run(fn,2.3,2.3,5,12))bad.push(fn.name+' ignores light');
  }
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('real rooms: their floor cells carry no glyphs, and footsteps sound as they did',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],want={store:'tile',diner:'tile',barber:'tile',grocer:'tile',cafe:'wood',bar:'wood',books:'wood',garage:'tile',tireshop:'tile',arcade:'carpet',karaoke:'carpet',cinema:'carpet'};
  for(const [kind,steps]of Object.entries(want)){
   enterRoom(kind,{word:kind.toUpperCase(),neon:CYAN,ret:[100,100,0],cell:[10,10]},ROOM_DEFS[kind].entry||[3,3,0]);
   const cx=room.W/2,cy=room.H/2;let floor=0,marked=0;
   for(const [x,y]of [[1.5,1.5],[room.W-1.5,1.5],[1.5,room.H-1.5],[room.W-1.5,room.H-1.5]]){
    px=x;py=y;a=Math.atan2(cy-y,cx-x);pitch=0;render(0);
    for(let i=0;i<cols*rows;i++)if(FL[i]===1){floor++;if(CH[i]!==' ')marked++;}
   }
   if(!floor)bad.push(kind+' saw no floor');
   // (what stands on the floor can still paint a cell; the field itself is gone)
   if(marked>floor*.02)bad.push([kind,'floor glyphs',marked,floor]);
   if(surfaceAt('room',room,px,py)!==steps)bad.push([kind,'footsteps',surfaceAt('room',room,px,py)]);
  }
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
