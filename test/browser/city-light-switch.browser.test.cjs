'use strict';
// A light switch turned off makes the ceiling lamps go dark (tubes, spots, pendants, bulbs), not stay white or yellow.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('switching the lights off darkens every ceiling lamp, and back on lights them again',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const lvl=()=>Math.max(BG[0]&15,CH[0]!==' '?COL[0]&15:0),out={};
  enterRoom('store',{word:'24/7',ret:[100,100,0]},[5,5,0]);render(0);
  const draw=drawBox,shades=[];drawBox=(box,shade)=>shades.push(shade);
  try{room.props.filter(o=>o.ceilingBatten).forEach(o=>o.draw(o.x,o.y));}finally{drawBox=draw;}
  const glass=()=>{let m=0;for(const s of shades){HIT.nz=-1;HIT.nx=HIT.ny=0;s(0,1,8);m=Math.max(m,lvl());}return m;};
  const probe=fn=>{setRoomLights(true);fn();const on=lvl();setRoomLights(false);fn();const off=lvl();setRoomLights(true);return[on,off];};
  out.batten=[(setRoomLights(true),glass()),(setRoomLights(false),glass())];setRoomLights(true);
  out.pendant=probe(()=>sharedPendantCeil(0,true));
  out.bulb=probe(()=>{HIT.nx=HIT.ny=0;HIT.nz=-1;restaurantLampBulbShade(0,1,8);});
  let spot=null;for(let x=0;x<8&&!spot;x+=.05)for(let y=0;y<8&&!spot;y+=.05)if(ceilAt('spots',CEIL_SPOTS,x,y)===1)spot=[x,y];
  out.spots=probe(()=>{prepareInteriorHanging=()=>false;ROOM_CEILS.spots(0,0,0,spot[0],spot[1]);});
  let strip=null;for(let x=0;x<8&&!strip;x+=.05)for(let y=0;y<8&&!strip;y+=.05)if(ceilAt('strip',CEIL_STRIP,x,y)===1)strip=[x,y];
  room.def={...room.def,ceil:undefined};const d=(room.def.height||3)-eye;out.strip=probe(()=>roomCeil(0,hor-.5-projY,0,(strip[0]-px)/d,(strip[1]-py)/d));
  return out;
 });
 for(const [k,[on,off]] of Object.entries(r)){assert.ok(on>=10,k+' lit when on '+on);assert.ok(off<=2,k+' dark when off '+off);}
}));
