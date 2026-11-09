'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run,seed=1){
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(seed=>{requestAnimationFrame=()=>0;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);},seed);
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;rain=snow=snowCover=0;env(0);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('three quiet places fit the city, connect to public access and render in day, night and snow',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],directory=mapDirectory();
  for(const s of QUIET_PLACES){
   if(!directory.some(p=>p.id===s.id&&p.x===s.entry.x&&p.y===s.entry.y))bad.push(['not mapped',s.type]);
   for(const p of s.parts){
    if(!(p.hl>0&&p.hw>0&&p.z1>p.z0))bad.push(['invalid part',s.type,p.role]);
    if(p.profile&&Math.max(...p.profile.map(p=>p[0]))>p.z1+1e-8)bad.push(['clipped vessel',p.role]);
   }
   if(s.type!=='roof'){
    // Walk through the doorway into the actual room/court, never a teleport.
    px=s.entry.x;py=s.entry.y;
    const distance=near(s.x,s.y,s.entry.x,s.entry.y);for(let d=0;d<distance;d+=.015){const f=d/distance,x=s.entry.x+(s.x-s.entry.x)*f,y=s.entry.y+(s.y-s.entry.y)*f;if(!free(x,y))bad.push(['blocked entrance',s.type,d]);}
    const queue=[[s.entry.x,s.entry.y]],seen=new Set();let connected=false;
    for(let head=0;head<queue.length&&head<20000;head++){
     const [x,y]=queue[head];if(ROAD[idx(x,y)]){connected=true;break;}
     for(const [dx,dy]of [[.12,0],[-.12,0],[0,.12],[0,-.12]]){
      const xx=x+dx,yy=y+dy,key=Math.round((xx-s.x)/.12)+','+Math.round((yy-s.y)/.12);
      if(seen.has(key)||Math.abs(xx-s.x)>5||Math.abs(yy-s.y)>5)continue;seen.add(key);
      if(free(xx,yy)&&free(x+dx/2,y+dy/2))queue.push([xx,yy]);
     }
    }
    if(!connected)bad.push(['no public access',s.type]);
    for(const p of s.parts)if(ROAD[idx(p.x,p.y)]||map[idx(p.x,p.y)]||isWater(p.x,p.y))bad.push(['occupied ground',s.type,p.role]);
   }
   for(const td of [14,22])for(const cover of [0,.6]){
    tod=td;snowCover=cover;env(0);px=s.x+.2;py=s.y+(s.type==='shore'?.15:.4);a=-Math.PI/2;pitch=-.08;freecam={x:px,y:py,z:s.base+.17};render(0);
   }
   freecam=null;
  }
  return {bad,types:QUIET_PLACES.map(s=>s.type)};
 });
 assert.deepEqual(r.types,['roof','court','shore']);assert.deepEqual(r.bad,[]);
}));
test('roof uses its apartment lift; planters and room walls block at their own height',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const s=QUIET_PLACES.find(s=>s.type==='roof'),b=s.building;
  const kind=lobbyKind(b.x0,b.y0);enterRoom(kind,{word:b.sh.word,cell:[b.x0,b.y0],ret:[s.entry.x,s.entry.y,0]},[0,0,0]);
  px=room.def.ex;py=1.5;a=-Math.PI/2;interact();
  const arrived=mode==='roof'&&roofH===s.base,landingClear=roofFree(px,py);
  const planter=s.parts.find(p=>p.role==='planter-soil');
  const solidTop=Math.abs(roofHeightAt(planter.x,planter.y)-planter.z1)<1e-6;
  const blocksRoof=!roofFree(planter.x,planter.y),clearStreet=!quietPlaceBlocked(planter.x,planter.y,.02,0),clearAbove=!quietPlaceBlocked(planter.x,planter.y,.02,planter.z1+.01);
  mode='walk';room=null;roofH=0;
  const station=QUIET_PLACES.find(s=>s.type==='shore'),wall=station.parts.find(p=>p.role==='station-back'),board=station.parts.find(p=>p.role==='roof-board');
  const shelter=quietPlaceCover(board.x,board.y,station.base+.17)&&!snowExposed(board.x,board.y,station.base+.1);
  const gapX=station.x-Math.sin(station.turn||0)*.2,gapY=station.y+Math.cos(station.turn||0)*.2;
  const gapOpen=!quietPlaceCover(gapX,gapY,station.base+.17);
  return {arrived,landingClear,blocksRoof,clearStreet,clearAbove,solidTop,shelter,gapOpen,wallBlocks:quietPlaceBlocked(wall.x,wall.y,.02,station.base),doorClear:!quietPlaceBlocked(station.x-Math.sin(station.turn||0)*.56,station.y+Math.cos(station.turn||0)*.56,.03,station.base)};
 });
 assert.ok(Object.values(r).every(Boolean),JSON.stringify(r));
}));
test('pump and ledger use the aimed interaction system; walls prevent reading through them',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const s=QUIET_PLACES.find(s=>s.type==='court');
  px=s.x+.033;py=s.y-.45;a=-Math.PI/2;pitch=0;render(0);pitch=(s.base+.15-interactionEye())/.25*projY/rows;
  const pump=interactionFocus(),prompt=focusedInteractionPrompt(pump);useFocusedInteraction(pump);
  const running=s.flowUntil>T;T+=19;const stopped=s.flowUntil<T;
  const h=QUIET_PLACES.find(s=>s.type==='shore');const turn=h.turn||0,t=h.targets[0],tx=h.x+t.u,ty=h.y+t.v;px=tx-Math.sin(turn)*.21;py=ty+Math.cos(turn)*.21;a=turn-Math.PI/2;pitch=0;render(0);pitch=(h.base+.105-interactionEye())/.21*projY/rows;
  const ledger=interactionFocus();useFocusedInteraction(ledger);
  const read=msgText.includes('October 17');
  const roof=QUIET_PLACES.find(s=>s.type==='roof'),note=roof.targets.find(t=>t.label.includes('notebook'));
  mode='roof';roofH=roof.base;px=roof.x+note.u;py=roof.y+note.v+.22;a=-Math.PI/2;pitch=0;render(0);pitch=(roof.base+.1-interactionEye())/.22*projY/rows;
  const notebook=interactionFocus();useFocusedInteraction(notebook);const noteRead=msgText.includes('notebook');
  const gardener=()=>quietPlaceTargets().some(t=>t.label==='talk to the gardener');
  const presentByDay=gardener();tod=22;const absentAtNight=!gardener();tod=14;rain=.8;const absentInRain=!gardener();rain=0;
  const gardenerSchedule=presentByDay&&absentAtNight&&absentInRain;
  mode='walk';roofH=0;
  px=h.x+Math.sin(turn)*.75;py=h.y-Math.cos(turn)*.75;a=turn+Math.PI/2;pitch=0;
  const occluded=!interactionClear(tx,ty,h.base+.105);
  return {prompt,running,stopped,read,noteRead,gardenerSchedule,occluded};
 });
 assert.match(r.prompt,/hand pump/);assert.ok(r.running&&r.stopped&&r.read&&r.noteRead&&r.gardenerSchedule&&r.occluded,JSON.stringify(r));
}));

for(const seed of [7,29])test(`quiet places retain clear entrances with city population seed ${seed}`,()=>fixture(async p=>{
 const result=await p.evaluate(()=>QUIET_PLACES.map(s=>({type:s.type,clear:s.type==='roof'||free(s.entry.x,s.entry.y)})));
 assert.deepEqual(result.map(s=>s.type),['roof','court','shore']);assert.ok(result.every(s=>s.clear));
},seed));
