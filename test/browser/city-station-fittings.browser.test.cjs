'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;body.z=body.vz=body.crouch=0;enterRoom('station',{st:0,word:stations[0].name,t0:0,ret:[px,py,a]},[11.5,7.5,-Math.PI/2]);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('station stair handrails follow the treads, attach to solid wall brackets and keep the stair centre and exit clear',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const rails=room.props.filter(p=>p.stationHandrail),bad=[];if(rails.length!==2)return {bad:['no station handrails']};
  for(const p of rails){const r=p.stationHandrail,pts=r.points;
   if(pts.length!==4||pts[0][0]<=STATION_STAIRS.y1||pts[3][0]>=STATION_STAIRS.y0)bad.push('missing landing extensions');
   for(let y=STATION_STAIRS.y0;y<STATION_STAIRS.y1;y+=.031){const t=(STATION_STAIRS.y1-y)/(STATION_STAIRS.y1-STATION_STAIRS.y0),z=pts[1][1]+(pts[2][1]-pts[1][1])*t,above=z-stairRise(p.x,y);if(above<.9-1e-7||above>1.05)bad.push(['wrong rail height',above]);}
   if(r.parts.length!==12)bad.push('missing bracket hardware');
   const drawn=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>{if(ray===rayBox)drawn.push({box,shade,ray});};p.draw(p.x,p.y,p);}finally{drawBox=old;}if(drawn.length!==12)bad.push('brackets absent from renderer');
   for(let k=0;k<drawn.length;k+=3){const [plate,arm,tip]=drawn.slice(k,k+3).map(q=>q.box),join=(a,b)=>Math.abs(a.x-b.x)<=a.hl+b.hl+1e-8&&Math.abs(a.y-b.y)<=a.hw+b.hw+1e-8&&a.z0<=b.z1&&b.z0<=a.z1;if(!(plate.x-plate.hl<r.wall&&plate.x+plate.hl>r.wall)||!join(plate,arm)||!join(arm,tip)||Math.abs(tip.x-p.x)>1e-8)bad.push('floating wall bracket');}
   for(const q of drawn){Object.assign(HIT,{face:5});CH[0]='?';BG[0]=NONE;q.shade(0,1,10);if(CH[0]!==' '||BG[0]===NONE)bad.push('bracket glyph');}
  }
  for(const y of [1.4,3,5,7.1]){if(!free(11.5,y))bad.push('stair centre blocked');for(const p of rails)if(free(p.x,y))bad.push('rail collision absent');}
  px=11.5;py=7.4;for(let n=0;n<430&&mode==='room';n++)move(0,-.015);if(mode!=='walk')bad.push('stairs no longer exit');
  return {bad};});assert.deepEqual(r.bad,[]);
}));
test('station ceiling lamps are mounted closed fittings clear of walls, pillars and stair headroom; the ceiling is colour',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const bad=[],lamps=room.props.filter(p=>p.stationCeiling);if(lamps.length!==7)return {bad:['no physical station ceiling lamps']};
  const capture=p=>{const a=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});p.draw(p.x,p.y,p);}finally{drawBox=old;}return a;};
  for(const p of lamps){const h=room.def.height,b=p.box;if(!p.walk||b.z0<h-.075||b.z1!==h)bad.push('lamp gap or floor collision');
   for(const u of [-b.hl,0,b.hl])for(const v of [-b.hw,0,b.hw]){const x=b.x+b.c*u-b.s*v,y=b.y+b.s*u+b.c*v;if(room.grid[Math.floor(y)]?.[Math.floor(x)]!=='.')bad.push('fitting intersects wall or pillar');if(b.z0-stairRise(x,y)<2.9)bad.push('stair headroom reduced');}
   const a=capture(p),bParts=capture(p);if(a.length!==p.ceilingBatten.modules*4||a.some((q,k)=>q.box.planes!==bParts[k].box.planes||q.shade!==bParts[k].shade||q.ray!==homeRayWorktop))bad.push('fitting geometry/materials rebuilt');
   for(const q of a){Object.assign(HIT,{face:6,nx:0,ny:0,nz:-1});CH[0]='?';BG[0]=NONE;q.shade(0,1,10);if(CH[0]!==' '||BG[0]===NONE)bad.push('fixture glyph');}
   if(!a.some(q=>q.box.z1===h))bad.push('unmounted fitting');
   const hits=a.map(q=>q.ray(p.x,p.y,h-1,0,0,1,q.box)).filter(t=>t>.01);if(!hits.length||Math.abs(h-1+Math.min(...hits)-(h-.061))>1e-7)bad.push('native diffuser underside differs from mounted model');
  }
  for(const td of [0,14]){tod=td;env(0);for(const row of [1,5,hor-3]){CH[0]='?';BG[0]=NONE;roomCeil(0,row,0,.7,.3);if(CH[0]!==' '||BG[0]===NONE)bad.push('painted ceiling characters');}}
  const lamp=lamps[0],parts=capture(lamp),lens=parts.find(q=>q.box.z0===room.def.height-.061);if(!lens)bad.push('no diffuser');else{Object.assign(HIT,{face:6,nx:0,ny:0,nz:-1});setRoomLights(true);lens.shade(0,1,10);const on=BG[0]&15;setRoomLights(false);lens.shade(0,1,10);if(on<10||(BG[0]&15)>2)bad.push('diffuser ignores light state');setRoomLights(true);}
  return {bad};});assert.deepEqual(r.bad,[]);
}));
