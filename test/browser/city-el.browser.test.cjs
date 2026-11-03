'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the el: deck, girders, pillars, stairs and cars are colour (the handrails are rod() lines)',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],V=[];
   for(const st of EL_STATIONS.slice(0,2))V.push([st.x0-1,(EL_TRACK[0]+EL_TRACK[1])/2,0,.3],[st.x+.5,EL_TRACK[1]+1.2,-Math.PI/2,.4],[st.x,EL_TRACK[0]-1.4,Math.PI/2,.3]);
   for(const td of [14,22]){tod=td;env(0);let n=0,g=0;
    for(const [x,y,ang,pt] of V){px=x;py=y;a=ang;pitch=pt;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9]/.test(CH[i]))g++;}}
    if(g/n>.05)bad.push([td,'el views glyph share',+(100*g/n).toFixed(2)]);} // main had 30%
   // the deck's painters: underside, top (track, platform) and the girder's side, near and far
   let dc=0;for(const d of [.5,6])for(let k=0;k<400;k++){const wx=EL_STATIONS[0].x+k*.013,wy=EL_Y0+(k%37)/37*EL_HALF*2;CH[0]=' ';slabFace(0,wx,wy,true,d);if(CH[0]!==' ')dc++;slabFace(0,wx,wy,false,d);if(CH[0]!==' ')dc++;slabEdge(0,k*.01,EL_BOT+(k%20)/20*(EL_TOP-EL_BOT),d,k&1);if(CH[0]!==' ')dc++;}
   if(dc)bad.push(['deck characters',dc]);
   // a car on its own, from the side, by day and at night: no characters, its windows lit after dark
   for(const td of [14,22]){tod=td;env(0);render(0);for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}
    px=EL_STATIONS[0].x;py=EL_TRACK[0]-1.5;a=Math.PI/2;pitch=.3;const [vx,vy]=R(EL_STATIONS[0].x,EL_TRACK[0]);drawElCar(vx,vy,1);
    let cells=0,ch=0,warm=0;for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){cells++;if(CH[i]!==' ')ch++;if(BG[i]>>4===WARM)warm++;}
    if(cells<100)bad.push([td,'car barely drawn',cells]);if(ch)bad.push([td,'car characters',ch]);if(td===22&&!warm)bad.push(['car windows not lit at night']);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
