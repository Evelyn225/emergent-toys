'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('native hotel floors retain world alignment and flush depth with light-responsive filtered timber and original rug footprints',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[];
  for(const tier of [0,1,2]){const def=[ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite][tier];enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);render(0);
   const native=(wx,wy,depth,rx=1,ry=0)=>{const row=rows-2;eye=1.7;hor=row+.5-eye*projY/depth;px=wx-rx*depth;py=wy-ry*depth;roomFloor(0,row,0,rx,ry);return{bg:BG[0],ch:CH[0],depth:ZB[0],floor:FL[0]};};
   const wood=homeFloorWood,seen=[];homeFloorWood=(...args)=>{seen.push(args.slice(1));return wood(...args);};try{const first=native(1.13,1.13,3),moved=native(1.13,1.13,3,0,1);if(first.bg!==moved.bg||first.ch!==' '||Math.abs(first.depth-3)>1e-8||first.floor!==1)bad.push('world alignment/native floor plane changed');if(seen.length!==2||seen.some(q=>Math.abs(q[0]-1.13)>1e-8||Math.abs(q[1]-1.13)>1e-8||q[4]!==tier))bad.push('native hotel does not use world timber coordinates/tier');if(seen.length&&Math.abs(seen[0][3]-Math.max(3/projX,9/(1.7*projY)))>1e-8)bad.push('grazing row footprint lost');}finally{homeFloorWood=wood;}
   const sample=(wx,wy,depth=.01,L=8)=>{const row=rows-2;eye=1.7;hor=row+.5-eye*projY/depth;ROOM_FLOORS.hotel(0,.8,wx,wy,row,0,L);if(CH[0]!==' ')bad.push('painted floor/rug character');return BG[0];};
   const near=[],far=[];for(let y=1.007;y<1.7;y+=.037)for(let x=1.037;x<1.6;x+=.071){near.push(sample(x,y));far.push(sample(x,y,40));}if(new Set(near).size<2)bad.push('near boards lost material relief');if(new Set(far).size!==1)bad.push('distant board phase aliases');
   if(sample(1.13,1.13,.01,0)===sample(1.13,1.13,.01,12))bad.push('wood ignores light');
   const [sx,sy]=def.hotelAmenities.sofa,half=tier===2?2.6:1.65,tint=tier===2?GREEN:BLUE;
   for(const[x,y]of [[sx,sy],[sx+half-.01,sy],[sx,sy-2.09],[sx,sy+.59]])if(sample(x,y)>>4!==tint)bad.push('rug shrank from original footprint');
   for(const[x,y]of [[sx+half+.01,sy],[sx,sy-2.11],[sx,sy+.61]])if(sample(x,y)>>4!==BRICK)bad.push('rug extends beyond original footprint');
   if(sample(sx,sy,.01,0)===sample(sx,sy,.01,12))bad.push('rug ignores light');
  }return bad;});assert.deepEqual(bad,[]);
}));
test('hotel views render the floor finish without a second slab and retain bathroom and unrelated room surfaces',()=>fixture(async p=>{
 const bad=await p.evaluate(()=>{const bad=[],wood=homeFloorWood;let used=0;homeFloorWood=(...q)=>{used++;return wood(...q);};try{for(const tier of [0,1,2]){const def=[ROOM_DEFS.motelRoom,ROOM_DEFS.hotelroom,ROOM_DEFS.hotelSuite][tier];enterRoom('hotelroom',{suite:tier===2,lobby:{word:tier===0?'MOTEL':'HOTEL',ret:[100,100,0]}},def.entry);[px,py,a]=def.entry;pitch=-.35;const before=used;render(0);if(used===before||!free(px,py))bad.push('native floor hook not visible from clear entry');const row=rows-2,d=3;eye=1.7;hor=row+.5-eye*projY/d;px=def.wc.x0+.5-d;py=2;const count=used;roomFloor(0,row,0,1,0);if(used!==count||FL[0]!==1||Math.abs(ZB[0]-d)>1e-8)bad.push('bathroom surface/plane changed');
   const draw=drawBox;let slabs=0;drawBox=(b,...rest)=>{if(b.z0<.001&&b.z1>.001&&b.hl>3&&b.hw>3)slabs++;return draw(b,...rest);};try{render(0);}finally{drawBox=draw;}if(slabs)bad.push('second giant floor slab');
  }const before=used;enterRoom('grandhotel',{ret:[100,100,0]},[12,15.4,-Math.PI/2]);render(0);if(used!==before)bad.push('Grand lobby floor changed');}finally{homeFloorWood=wood;}return bad;});assert.deepEqual(bad,[]);
}));
