'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;mode='walk';room=me=freecam=game=null;body.z=body.vz=body.crouch=0;});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('four distinct island landmarks register native cached closed parts with terrain-buried foundations and colour materials',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{if(typeof ISLAND_LANDMARKS==='undefined')return['no island landmarks'];const bad=[],ids=ISLAND_LANDMARKS.map(g=>g.id);if(ids.join(',')!=='cormorant-arch,crescent-wreck,fern-camp-shelter,juniper-garden')bad.push('missing island identities');const old=drawBox;
  for(const g of ISLAND_LANDMARKS){if(!ISLAND_DETAILS.includes(g.root)||seaAt(g.x,g.y)||g.parts.length<10)bad.push('unregistered or wet landmark');const A=[],B=[];try{drawBox=(b,shade,ray)=>A.push({b:{...b},ref:b,shade,ray});drawIslandLandmark(g,0,0);drawBox=(b,shade,ray)=>B.push({b:{...b},ref:b,shade,ray});drawIslandLandmark(g,.2,.3);}finally{drawBox=old;}if(A.length!==g.parts.length)bad.push('missing native parts');
   for(let k=0;k<A.length;k++){const a=A[k],b=B[k],part=g.parts[k];if(a.ref!==b.ref||a.shade!==b.shade||a.b.planeData!==b.b.planeData||Math.abs(b.b.x-a.b.x-.2)>1e-8||Math.abs(b.b.y-a.b.y-.3)>1e-8)bad.push('uncached/mistranslated part');if(!ISLAND_OBSTACLES.includes(part))bad.push('missing physical part');const range=islandLandmarkInterval(part,part.x,part.y);if(!range)bad.push('open convex piece');else{const t=a.ray(a.b.x,a.b.y,range[1]+1,0,0,-1,a.b);if(!(t>0))bad.push('missing closed cap');Object.assign(HIT,{face:0,u:0,v:0,w:(part.z0+part.z1)/2});CH[0]='?';a.shade(0,1,8);if(CH[0]!==' '||BG[0]===NONE)bad.push('non-colour surface');}
    if(['pier','post','bench-foot'].includes(part.role)&&part.z0>terrainHeight(part.x,part.y)+1e-8)bad.push('floating foundation');
   }
  }return bad;});assert.deepEqual(bad,[]);
}));
test('Cormorant arch has a real clear opening for walking, bullets and aircraft, with solid piers and a solid crown',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{if(typeof ISLAND_LANDMARKS==='undefined')return{bad:['no arch']};const g=ISLAND_LANDMARKS[0],bad=[],ground=terrainHeight(g.x,g.y),under=g.spring+.30,roof=g.spring+.75;
  px=g.x;py=g.y+.7;body.z=0;for(let y=g.y-.4;y<=g.y+.4;y+=.02){if(islandSightBlocked(g.x,y,terrainHeight(g.x,y),.03))bad.push('invisible barrier in arch');if(islandSightHeight(g.x,y,under)>under||builtHeight(g.x,y,under)>under)bad.push('filled-in opening height');}
  for(const p of g.parts.filter(p=>p.role==='pier'))if(!islandSightBlocked(p.x,p.y,terrainHeight(p.x,p.y),.03))bad.push('walk through pier');
  if(!islandSightBlocked(g.x,g.y,roof,.01)||islandSightHeight(g.x,g.y,roof)<=roof||builtHeight(g.x,g.y,roof)<=roof)bad.push('missing crown collision');
  const clearShot=traceShot(g.x,g.y+.65,under,0,-1,0),roofShot=traceShot(g.x,g.y+.65,roof,0,-1,0);
  if(clearShot.d<1)bad.push(['shot stopped in opening',clearShot]);if(roofShot.what!=='wall'||roofShot.d<.35||roofShot.d>.45)bad.push(['shot passed through crown',roofShot]);
  px=g.x;py=g.y+.45;for(let k=0;k<45;k++)move(0,-.02);if(Math.abs(py-(g.y-.45))>.02)bad.push('actual walking stopped in opening');return{bad};});assert.deepEqual(r.bad,[]);
}));
test('existing landing, house and sight trails stay clear of all new landmark footprints',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{if(typeof ISLAND_LANDMARKS==='undefined')return['no landmark clearances'];const bad=[];
  for(const island of WILD_ISLANDS){for(const point of [island.landing,...(island.id==='fern'?FERN_TRAILS:ISLAND_PATHS[island.id]).flat()])for(const p of ISLAND_OBSTACLES.filter(p=>p.landmarkPart)){const range=islandLandmarkInterval(p,...point,.07);if(range&&range[0]<terrainHeight(...point)+.17&&range[1]>terrainHeight(...point))bad.push(['blocked trail point',island.id,point]);}
   for(const path of island.id==='fern'?FERN_TRAILS:ISLAND_PATHS[island.id])for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.05);for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;for(const p of ISLAND_OBSTACLES.filter(p=>p.landmarkPart)){const r=islandLandmarkInterval(p,x,y,.04);if(r&&r[0]<terrainHeight(x,y)+.17&&r[1]>terrainHeight(x,y))bad.push(['blocked trail segment',island.id,x,y]);}}}
  }return bad.slice(0,8);});assert.deepEqual(bad,[]);
}));
test('Juniper garden bench is usable with C and uses its drawn seat height',()=>fixture(async p=>{
 await p.evaluate(()=>{const g=typeof ISLAND_LANDMARKS==='undefined'?null:ISLAND_LANDMARKS.find(g=>g.seat);if(!g)return;px=g.seat.x;py=g.seat.y+.12;a=-Math.PI/2;render(0);});assert.equal(await p.evaluate(()=>free(px,py)),true);
 await p.keyboard.press('c');const r=await p.evaluate(()=>{const g=typeof ISLAND_LANDMARKS==='undefined'?null:ISLAND_LANDMARKS.find(g=>g.seat);return{seated:!!body.seat,drawn:g?.parts.find(p=>p.role==='bench-seat').z1,h:body.seat?terrainHeight(px,py)+body.seat.h/10:null};});assert.ok(r.seated&&Math.abs(r.drawn-r.h)<1e-8,JSON.stringify(r));await p.keyboard.press('c');assert.equal(await p.evaluate(()=>!body.seat&&free(px,py)),true);
}));
test('native island scenes visibly draw the additions, while winter removes flowers and leaves bare snowy garden beds',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{if(typeof ISLAND_LANDMARKS==='undefined')return['no native island scenery'];const bad=[];
  for(const g of ISLAND_LANDMARKS){const arch=g.id==='cormorant-arch';px=g.x+(arch?1.2:.6);py=g.y+(arch?2.5:1.1);a=Math.atan2(g.y-py,g.x-px);pitch=0;render(0);pitch=(g.ground+(arch?.65:.10)-eye)/Math.hypot(px-g.x,py-g.y)*projY/rows;render(0);const A=BG.slice(),orig=drawIslandLandmark;drawIslandLandmark=(o,...args)=>{if(o!==g)return orig(o,...args);};let changed=0;try{render(0);for(let i=0;i<A.length;i++)if(A[i]!==BG[i])changed++;}finally{drawIslandLandmark=orig;}if(changed<30)bad.push(['not visible through native scenery hook',g.id,changed]);}
  const g=ISLAND_LANDMARKS.find(g=>g.id==='juniper-garden'),oldSeason=seasonIdx(),draw=drawBox,oldSnow=paintSettledSnow;let calls=0,snow=0;try{drawBox=()=>calls++;setSeason(3);drawIslandLandmark(g,0,0);if(calls!==g.parts.filter(p=>!['bloom','stem'].includes(p.role)).length)bad.push('winter flowers remain');paintSettledSnow=()=>snow++;const p=g.parts.find(p=>p.role==='soil'),index=p.planes.findIndex(p=>p[2]>0);Object.assign(HIT,{face:index,u:0,v:0,w:p.z1});p.shade(0,1,8);if(!snow)bad.push('soil ignores snow');}finally{setSeason(oldSeason);drawBox=draw;paintSettledSnow=oldSnow;}
  return bad;});assert.deepEqual(bad,[]);
}));
