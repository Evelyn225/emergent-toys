'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=17;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;weather='clear';rain=snow=snowCover=fogAmt=0;tod=23;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('night shore materials remain opaque across distance, slope and dawn',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const points=[];
  for(let y=74;y<410&&points.length<80;y+=3)for(let x=58;x<470&&points.length<80;x+=3){
   if(!naturalCoastAt(x,y)||map[idx(x,y)]||ROAD[idx(x,y)]||isWater(x,y))continue;
   const coast=coastalGround(x,y);if(coast.depth<.1||coast.depth>4)continue;
   points.push([x,y]);
  }
  const bad=[],hues=new Set();let checked=0;
  for(const td of [23,0,4,5.5]){tod=td;env(0);
   for(const [x,y]of points)for(const distance of [.15,1,vis*.2,vis*.5,vis*.8])for(const light of [.4,.7,1]){
    BG[0]=NONE;terrainCell(0,x,y,distance,0,0,light);checked++;hues.add(BG[0]>>4);
    if(BG[0]===NONE&&bad.length<8)bad.push({x,y,distance,light,td});
   }
  }
  // The flat fallback must keep the same materials as the sloped painter.
  tod=23;env(0);eye=.17;
  for(const [x,y]of points){
   const row=rows-3,d=eye*projY/(row-hor+.5);px=x-d;py=y;BG[0]=NONE;floorBaseCell(0,row,0,1,0);checked++;
   if(BG[0]===NONE&&bad.length<8)bad.push({x,y,flat:true});
  }
  return {bad,checked,hues:hues.size};
 });assert.ok(r.checked>1000);assert.ok(r.hues>=3);assert.deepEqual(r.bad,[]);
}));
test('real night coast views do not paint blank transparent land or intertidal strips',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const terrain=terrainCell,floor=floorBaseCell,bad=[];let checked=0;
  const check=(i,x,y)=>{
   const coast=coastalGround(worldCoord(x),worldCoord(y));
   const s=islandSurface(x,y)||(naturalCoastAt(x,y)?islandShoreSurface(x,y,coast.depth,coast.beach):null);
   if(!s||s.ch!==' ')return;checked++;if(BG[i]===NONE&&bad.length<8)bad.push({x,y});
  };
  terrainCell=function(i,x,y){const r=terrain.apply(this,arguments);check(i,x,y);return r;};
  floorBaseCell=function(i,r,c,rx,ry){const d=eye*projY/(r-hor+.5),x=px+rx*d,y=py+ry*d,result=floor.apply(this,arguments);check(i,x,y);return result;};
  try{
   for(const s of COAST_GATHERINGS.filter(s=>naturalCoastAt(s.x,s.y)&&!s.fire).slice(0,4))for(const move of [0,2]){
    px=s.x+move;py=s.y;a=Math.PI/2;pitch=-.13;freecam={x:px,y:py,z:outdoorGroundHeight(px,py)+.17};render(0);
   }
  }finally{terrainCell=terrain;floorBaseCell=floor;freecam=null;}
  return {bad,checked};
 });assert.ok(r.checked>1000);assert.deepEqual(r.bad,[]);
}));
