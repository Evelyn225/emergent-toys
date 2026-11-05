'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;body.z=body.vz=body.crouch=0;enterRoom('station',{st:0,word:stations[0].name,t0:T-30,ret:[px,py,a]},[11.5,8,0]);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('subway station floor, track bed and walls use colour; lettering remains on the station band',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  let glyphs=0,samples=0;const materials=new Set();
  for(const td of [14,22]){tod=td;env(0);
   for(let wx=9;wx<36;wx+=.11)for(let wy=7;wy<14;wy+=.09){const r=rows-1,d=eye*projY/(r-hor+.5);CH[0]='?';roomFloor(0,r,0,(wx-px)/d,(wy-py)/d);samples++;if(CH[0]!==' ')glyphs++;materials.add(BG[0]>>4);}
   for(const d of [1,12])for(const [mx,my]of [[10,6],[10,14],[2,14],[0,12]])for(let u=0;u<8;u+=.13)for(let z=.05;z<3;z+=.09){if(z>1.55&&z<1.95)continue;CH[0]='?';stationWall(0,u,.005,z,d,mx,my,10);samples++;if(CH[0]!==' ')glyphs++;}
  }
  const old=wallText;let signs=0;try{wallText=(...a)=>{if(a[5]===room.word)signs++;return false;};stationWall(0,6,.01,1.75,1,10,6,10);}finally{wallText=old;}
  return {glyphs,samples,materials:[...materials],signs};
 });assert.equal(r.glyphs,0,JSON.stringify(r));assert.ok(r.samples>10000&&r.signs>0);assert.equal(r.materials.length,4);
}));
test('walking height and rendered stair tops agree throughout the subway flight',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const s=STATION_STAIRS,steps=room.props.filter(p=>p.walk&&p.box&&p.box.z1<=s.rise),bad=[];
  if(steps.length!==18)bad.push(['step count',steps.length]);
  if(s.rise/s.steps>.18||(s.y1-s.y0)/s.steps<.28)bad.push('uncomfortable stair proportions');
  for(const p of steps){const b=p.box;for(const dy of [-b.hw*.6,0,b.hw*.6]){const y=b.y+dy,top=Math.max(...steps.filter(q=>Math.abs(y-q.box.y)<q.box.hw+1e-8).map(q=>q.box.z1));
   if(Math.abs(stairRise(b.x,y)-top)>1e-8)bad.push(['walking below tread',y,stairRise(b.x,y),top]);
   HIT.u=0;HIT.v=b.hw-.02;HIT.w=b.z1;HIT.face=5;CH[0]='?';p.shade(0,1,10);if(CH[0]!==' '||BG[0]>>4!==YEL)bad.push('nosing not a yellow surface');
  }}
  px=11.5;py=7.1;for(let n=0;n<385&&mode==='room';n++)move(0,-.015);
  if(mode!=='room')return {bad:[...bad,'left before reaching final tread'],clear:false,y:py,rise:0,headroom:0,outside:0,exited:true};
  render(0);
  const result={bad,y:py,clear:free(px,py),rise:stairRise(px,py),headroom:room.def.height-stairRise(px,py),outside:stairRise(9.5,2)};
  for(let n=0;n<20&&mode==='room';n++)move(0,-.015);result.exited=mode==='walk';return result;
 });assert.deepEqual(r.bad,[]);assert.ok(r.clear&&r.y<1.34&&r.headroom>=3-1e-8&&r.exited,JSON.stringify(r));assert.equal(r.rise,2.6);assert.equal(r.outside,0);
}));
