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
test('the fallback wall is a glyph-free dado, rail and plaster, with whole posters and a neon band only where asked',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],wall=(u,z,posters=false,neon,d=2,step=.001)=>{sharedWallFinish(0,u,step,z,d,3,0,8,posters,neon);if(CH[0]!==' ')bad.push('wall glyph');return BG[0];},hue=c=>c>>4;
  if(hue(wall(.3,.5))!==BRICK)bad.push('no dado');if(hue(wall(.3,2))!==WHITE)bad.push('no plaster');
  if(wall(.3,.92)===wall(.3,.5)||hue(wall(.3,.92))!==BRICK)bad.push('no rail');
  if(wall(.6,.5)===wall(.3,.5))bad.push('no dado panels');
  const far=new Set();for(let u=.03;u<6;u+=.07)far.add(wall(u,.5,false,undefined,20,.3));if(far.size!==1)bad.push('panels alias far off');
  if(hue(wall(.3,2.8,false,CYAN))!==CYAN)bad.push('neon band missing');if(hue(wall(.3,2.8))===CYAN)bad.push('neon band unasked');
  const hues=new Set();for(let u=.05;u<14;u+=.1)for(let z=1;z<2.7;z+=.1)hues.add(hue(wall(u,z,true)));if(hues.size<2)bad.push('no posters');
  const plain=new Set();for(let u=.05;u<14;u+=.1)for(let z=1;z<2.7;z+=.1)plain.add(hue(wall(u,z)));if(plain.size!==1)bad.push('posters unasked');
  sharedGlassDoor(0,.5,1,8);if(CH[0]!==' '||hue(BG[0])===GRAY)bad.push('door pane');sharedGlassDoor(0,.5,2.5,8);if(hue(BG[0])!==GRAY)bad.push('door head');sharedGlassDoor(0,.02,1,8);if(hue(BG[0])!==GRAY)bad.push('door mullion');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('shared ceilings are glyph-free, disco spots turn as a whole, and any strip room gets fitted battens except the rail rooms',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  sharedPendantCeil(0,true);const lit=BG[0];if(CH[0]!==' ')bad.push('pendant glyph');sharedPendantCeil(0,false);if(BG[0]===lit)bad.push('pendant lamp not lit');
  sharedDarkCeil(0);if(CH[0]!==' ')bad.push('dark glyph');
  const seen=new Set();for(let y=.5;y<12;y++)for(let x=.5;x<12;x++){sharedDiscoCeil(0,x,y);if(CH[0]!==' ')bad.push('disco glyph');seen.add(BG[0]>>4);}if(seen.size<3)bad.push('disco has no spots');
  // inside one spot, a small step never changes the colour
  let spot=null;for(let y=.5;y<12&&!spot;y++)for(let x=.5;x<12&&!spot;x++){sharedDiscoCeil(0,x,y);if(BG[0]>>4!==GRAY)spot=[x,y];}
  if(spot){const col=new Set();for(let k=0;k<8;k++){sharedDiscoCeil(0,Math.floor(spot[0])+.45+k*.005,Math.floor(spot[1])+.5);col.add(BG[0]);}if(col.size!==1)bad.push('disco flickers inside a spot');}
  for(const kind of ['garage','freightlobby','courier','capsule']){
   enterRoom(kind,{word:kind.toUpperCase(),neon:CYAN,ret:[100,100,0],cell:[10,10]},ROOM_DEFS[kind].entry||[3,3,0]);px=room.W/2;py=room.H/2;a=0;pitch=-1.1;render(0);
   if(!room.interiorBattens?.fixtures.length)bad.push(kind+' has no battens');
  }
  enterRoom('station',{word:'STATION',ret:[100,100,0]},ROOM_DEFS.station.entry||[3,3,0]);render(0);if(room.interiorBattens)bad.push('station got battens');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
