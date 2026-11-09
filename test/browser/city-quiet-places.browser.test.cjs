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

test('fitted masonry has no overlapping coplanar tops, and thresholds meet floor edges',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{
  const bad=[];
  for(const s of QUIET_PLACES){
   const roles=/^(garden-wall|entry-return|wall-coping|entry-coping|station-wall|station-back|door-jamb|door-head|window-pier|window-spandrel|station-floor|door-threshold)$/;
   const parts=s.parts.filter(p=>roles.test(p.role));
   const local=p=>{const c=Math.cos(s.turn||0),sn=Math.sin(s.turn||0),dx=p.x-s.x,dy=p.y-s.y;return {x:c*dx+sn*dy,y:-sn*dx+c*dy};};
   for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j];if(Math.abs(a.z1-b.z1)>1e-9)continue;
    const u=local(a),v=local(b),ox=Math.min(u.x+a.hl,v.x+b.hl)-Math.max(u.x-a.hl,v.x-b.hl),oy=Math.min(u.y+a.hw,v.y+b.hw)-Math.max(u.y-a.hw,v.y-b.hw);
    if(ox>1e-8&&oy>1e-8)bad.push(['coplanar overlap',s.type,a.role,b.role]);
   }
   if(s.type==='shore'){
    const floor=s.parts.find(p=>p.role==='station-floor'),threshold=s.parts.find(p=>p.role==='door-threshold'),a=local(floor),b=local(threshold);
    if(Math.abs(a.y+floor.hw-(b.y-threshold.hw))>1e-9||floor.z1!==threshold.z1)bad.push('threshold seam');
    for(let u=-threshold.hl+.005;u<threshold.hl;u+=.01){const turn=s.turn||0,x=s.x+Math.cos(turn)*u-Math.sin(turn)*.56,y=s.y+Math.sin(turn)*u+Math.cos(turn)*.56;
     if(Math.abs(quietPlaceGround(x,y)-threshold.z1)>1e-8)bad.push('threshold height mismatch');}
   }
  }return bad;
 });assert.deepEqual(bad,[]);
}));

test('vessel bottoms are closed, barrel corners stay clear and support follows the rendered contour',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const s=QUIET_PLACES.find(s=>s.type==='roof'),barrel=s.parts.find(p=>p.role==='water-barrel'),pot=s.parts.find(p=>p.role==='flowerpot');
  const bottom=coveRayLathe(pot.x,pot.y,pot.z1+.1,0,0,-1,pot),bottomZ=HIT.w;
  const lip=coveRayLathe(pot.x+.019,pot.y,pot.z1+.1,0,0,-1,pot),lipZ=HIT.w;
  const cornerClear=!quietPlaceBlocked(barrel.x+barrel.hl*.9,barrel.y+barrel.hl*.9,0,s.base+.02);
  const sideBlocks=quietPlaceBlocked(barrel.x+barrel.hl-.003,barrel.y,.002,s.base+.02);
  const shell=[];
  for(const radius of [0,.02,.034,.037,.04]){
   const t=coveRayLathe(barrel.x+radius,barrel.y,barrel.z1+.1,0,0,-1,barrel),z=HIT.w;
   if(t>0&&Math.abs(quietPartHeight(barrel,radius,0)-z)>1e-7)shell.push([radius,z,quietPartHeight(barrel,radius,0)]);
  }
  return {bottom,lip,bottomZ,lipZ,cornerClear,sideBlocks,shell};
 });assert.ok(r.bottom>0&&r.lip>0&&r.bottomZ<r.lipZ);assert.ok(r.cornerClear&&r.sideBlocks);assert.deepEqual(r.shell,[]);
}));

test('the hand pump responds to real E input, completes, and can be used again',()=>fixture(async p=>{
 await p.evaluate(()=>{const s=QUIET_PLACES.find(s=>s.type==='court');px=s.x+.033;py=s.y-.45;a=-Math.PI/2;render(0);pitch=(s.base+.15-interactionEye())/.25*projY/rows;});
 await p.keyboard.press('e');assert.ok(await p.evaluate(()=>QUIET_PLACES.find(s=>s.type==='court').flowUntil>T));
 await p.evaluate(()=>T+=19);assert.ok(await p.evaluate(()=>QUIET_PLACES.find(s=>s.type==='court').flowUntil<T));
 await p.keyboard.press('e');assert.ok(await p.evaluate(()=>QUIET_PLACES.find(s=>s.type==='court').flowUntil>T));
}));

test('sign lettering fits its panel and the courtyard lamp lights only the facing wall surface',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  render(0);const widths=[],original=wallText;snowCover=0;lampsOn=1;
  wallText=(i,u,step,z,d,text,centre,mid,width)=>{widths.push([text,width*text.length]);return false;};
  try{
   for(const s of QUIET_PLACES)for(const panel of s.parts.filter(p=>p.text)){
    Object.assign(HIT,{face:3,u:0,v:panel.hw,w:(panel.z0+panel.z1)/2});
    quietMaterial(panel,0,.2,8);
    if(widths.at(-1)[1]>panel.hl*2+1e-8)throw new Error('lettering exceeds its panel');
   }
  }finally{wallText=original;}
  const s=QUIET_PLACES.find(s=>s.type==='court'),wall=s.parts.find(p=>p.role==='garden-wall'&&p.textureV<0);
  const sample=(face,lamp)=>{Object.assign(HIT,{face,u:-.55,v:face===3?wall.hw:-wall.hw,w:s.base+.18});quietMaterial(wall,0,.05,0,lamp);return BG[0];};
  return {widths,inside:sample(3,s.lamp),insideDark:sample(3,null),outside:sample(4,s.lamp),outsideDark:sample(4,null)};
 });assert.equal(r.widths.length,3);assert.ok((r.inside&15)>(r.insideDark&15),JSON.stringify(r));assert.equal(r.outside,r.outsideDark);
}));

test('thin skate rails remain continuous solid steel at normal viewing distances',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const o=SKATE_STREET_FEATURES.find(o=>o.streetRail&&o.streetSite===SKATE_STREET_SITES.find(s=>s.type==='flatbars').id);
  px=o.x-o.s*2;py=o.y+o.c*2;a=Math.atan2(o.y-py,o.x-px);pitch=0;freecam={x:px,y:py,z:o.z0+.17};render(0);
  ZB.fill(vis);BG.fill(NONE);CH.fill(' ');drawStreetSkateRail(o);
  let samples=0,missed=0,glyphs=0;
  const a0=o.streetRail[0],b0=o.streetRail.at(-1);
  for(let j=1;j<30;j++){
   const f=j/30,u=a0[0]+(b0[0]-a0[0])*f,z=a0[1]+(b0[1]-a0[1])*f-.003,x=rel(o.x+o.c*u-px),y=rel(o.y+o.s*u-py),d=dx*x+dy*y;
   const c=Math.floor(cols/2+(-dy*x+dx*y)*projX/d),r=Math.floor(hor-(z-eye)*projY/d);
   if(c<1||c>=cols-1||r<1||r>=rows-1)continue;samples++;
   let hit=false;for(let yy=r-1;yy<=r+1;yy++)for(let xx=c-1;xx<=c+1;xx++)if(ZB[yy*cols+xx]<vis)hit=true;
   if(!hit)missed++;
  }
  for(let i=0;i<CH.length;i++)if(ZB[i]<vis&&CH[i]!==' ')glyphs++;
  return {samples,missed,glyphs};
 });assert.ok(r.samples>=20);assert.equal(r.missed,0);assert.equal(r.glyphs,0);
}));
