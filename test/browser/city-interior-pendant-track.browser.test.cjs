'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
 await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('native pendant, tin and track ceilings have mounted physical fixtures clear of walls and feature lamps',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let count=0;
  for(const kind of ['bar','cafe','books','realty','records','tattoo','thrift','tailor','antiques','fruitshop','deli','delicatessen','bagelshop','tobacco','pizzeria','kissaten','dimsum','bakery','juicebar','icecream','skate','phones']){
   enterRoom(kind,{word:kind==='thrift'?'THRIFT':kind.toUpperCase(),ret:[100,100,0]},[5,5,0]);
   const feature=room.props.filter(o=>o.tiffanyLamp||o.heatLamp||o.roundLantern||o.paperLantern),original=room.props.slice();render(0);
   const lamps=room.props.filter(o=>o.ceilingPendant||o.ceilingTrack);count+=lamps.length;
   if(!lamps.length)bad.push([kind,'still painted']);
   for(const o of lamps){const b=o.box,h=room.def.height||3;
    if(!o.walk||Math.abs(b.z1-h)>1e-8||b.z0<2.2)bad.push([kind,'mount gap or floor obstruction']);
    for(const u of [-b.hl,b.hl])for(const v of [-b.hw,b.hw]){const x=b.x+b.c*u-b.s*v,y=b.y+b.s*u+b.c*v;if(!'.S'.includes(room.grid[Math.floor(y)]?.[Math.floor(x)]||'#'))bad.push([kind,'through wall']);}
    if(feature.some(q=>Math.hypot(q.x-o.x,q.y-o.y)<.5))bad.push([kind,'overlaps feature lamp']);
   }
   if(feature.some(o=>!room.props.includes(o))||original.some(o=>!room.props.includes(o)))bad.push([kind,'authored prop removed']);
  }return {bad:bad.slice(0,12),count};
 });assert.deepEqual(r.bad,[]);assert.ok(r.count>60,JSON.stringify(r));
}));

test('pendant shades are open shells with real bulbs and connected ceiling mounts, prepared once',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('records',{word:'RECORDS',ret:[100,100,0]},[5,5,0]);render(0);projX=10000;
  const bad=[],lamps=room.props.filter(o=>o.ceilingPendant),draw=drawBox;let count=0;
  if(!lamps.length)return {bad:['no physical pendants'],count};
  const capture=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of lamps){const a=capture(o),b=capture(o),parts=o.lightFitting.parts,shade=parts.find(p=>p.role==='shade'),bulb=parts.find(p=>p.role==='bulb');
   const S={...shade.box,x:o.x,y:o.y},G={...bulb.box,x:o.x,y:o.y};
   // The open shade axis reaches the glass, rather than an opaque filled cap.
   if(coveRayLathe(o.x,o.y,S.z0-.05,0,0,1,S)>=0)bad.push('shade mouth filled');
   if(coveRayLathe(o.x,o.y,S.z0-.05,0,0,1,G)<0)bad.push('no glass inside shade');
   const z=S.z0+.08,t=coveRayLathe(o.x,o.y,z,1,0,0,S);
   if(t<.05||t>.25||HIT.nx>-.2)bad.push('missing inward shade wall');
   const mount=parts.find(p=>p.role==='mount'),cord=parts.find(p=>p.role==='cord'),socket=parts.find(p=>p.role==='socket');
   if(Math.abs(mount.box.z1-o.box.z1)>1e-8||Math.abs(cord.box.z1-mount.box.z0)>1e-8||Math.abs(socket.box.z1-cord.box.z0)>1e-8||Math.abs(bulb.box.z1-socket.box.z0)>1e-8)bad.push('disconnected suspension');
   a.forEach((q,k)=>{const B=q.box,P=o.box;if(Math.abs(B.x-P.x)+B.hl>P.hl+1e-8||Math.abs(B.y-P.y)+B.hw>P.hw+1e-8||B.z0<P.z0-1e-8||B.z1>P.z1+1e-8)bad.push('part outside bounds');
    if(B.profile&&(B.profile!==b[k].box.profile||q.shade!==b[k].shade))bad.push('profile or material rebuilt');
   });count++;
  }
  const state=room.interiorHanging,old=state?.fixtures.slice();render(0);render(0);
  if(room.interiorHanging!==state||state.fixtures.some((o,k)=>o!==old[k])||room.props.filter(o=>o.ceilingPendant).length!==lamps.length)bad.push('room layout rebuilt');
  return {bad:bad.slice(0,10),count};
 });assert.deepEqual(r.bad,[]);assert.ok(r.count>3);
}));

test('track lights have connected bounded rails, recessed closed heads and fitted luminous lenses',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('phones',{word:'PHONES',ret:[100,100,0]},[5,5,0]);render(0);
  const bad=[],tracks=room.props.filter(o=>o.ceilingTrack),draw=drawBox;let heads=0;
  if(!tracks.length)return {bad:['no physical tracks'],heads};
  const capture=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of tracks){const data=o.ceilingTrack,a=capture(o),b=capture(o),h=o.box.z1,rail=data.parts.find(p=>p.role==='track');
   if(Math.abs(rail.box.z1-h)>1e-8)bad.push('rail not ceiling mounted');
   for(const p of data.parts){const B=p.box;const i=data.parts.indexOf(p);if(Math.abs(B.x)+B.hl>o.box.hl+1e-8||B.hw>o.box.hw+1e-8||B.z0<o.box.z0-1e-8||B.z1>h+1e-8)bad.push('track part outside bounds');
    if(B.profile&&(B.profile!==b[i].box.profile||a[i].shade!==b[i].shade))bad.push('track surfaces rebuilt');
    if(p.role!=='head')continue;heads++;
    const t=p.ray(B.x,B.y,B.z0-.1,0,0,1,B);if(Math.abs(t-.21)>1e-7||HIT.nz>-.99)bad.push('head recess missing closed back');
    const stem=data.parts.find(q=>q.role==='stem'&&q.box.x===B.x),lens=data.parts.find(q=>q.role==='lens'&&q.box.x===B.x);
    if(!stem||!lens||stem.box.z0>B.z1||Math.abs(stem.box.z1-rail.box.z0)>1e-8||lens.box.hl<.059||lens.box.z1<=B.z0)bad.push('detached stem or lens');
    if(lens){lens.ray(B.x,B.y,lens.box.z0-.1,0,0,1,lens.box);lens.shade(0,.1,8);if((BG[0]&15)<10||CH[0]!==' ')bad.push('lens not luminous surface');}
   }
  }return {bad:bad.slice(0,10),heads};
 });assert.deepEqual(r.bad,[]);assert.ok(r.heads>=6);
}));

test('fitted ceilings omit painted lamp glyphs while homes, hotels and civic rooms retain their own ceilings',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  for(const kind of ['records','deli','phones']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0]},[5,5,0]);render(0);
   const spec=room.def.ceil==='spots'?CEIL_SPOTS:CEIL_PENDANT,mask=ceilMask('legacy-probe',spec),at=mask.findIndex(v=>v===1);
   const x=(at%(room.W*CEIL_RES)+.5)/CEIL_RES,y=(Math.floor(at/(room.W*CEIL_RES))+.5)/CEIL_RES,h=room.def.height||3,d=h-eye;
   CH[0]='?';roomCeil(0,hor-.5-projY,0,(x-px)/d,(y-py)/d);if(CH[0]==='o'||CH[0]==='-')bad.push([kind,'painted lamp remains']);
  }
  for(const kind of ['home','loft','bellehome','hotelroom','hotel','bank','apts']){
   enterRoom(kind,{word:kind.toUpperCase(),ret:[100,100,0],lobby:{word:'HOTEL',ret:[100,100,0]}},[5,5,0]);render(0);
   if(room.interiorHanging||room.props.some(o=>o.ceilingPendant||o.ceilingTrack))bad.push([kind,'scope changed']);
  }return bad;
 });assert.deepEqual(r,[]);
}));
