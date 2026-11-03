'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('gas stations: forecourt, canopy, islands, pumps, sign and shop front are colour; the lettering stays; the canopy lights the forecourt after dark',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],V=[];if(!GAS_STATIONS.length)return {bad:['no stations']};
   for(const st of GAS_STATIONS.slice(0,2))V.push([st.x0+1.5,st.y0-.6,Math.PI/2,.05],[st.x0+.2,st.y0+1,0,0],[st.x0+2.8,st.y0+.9,Math.PI,.1]);
   const floor={};
   for(const td of [14,22]){tod=td;env(0);let n=0,g=0;
    for(const [x,y,ang,pt] of V){px=x;py=y;a=ang;pitch=pt;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9$.]/.test(CH[i]))g++;}}
    if(g/n>.012)bad.push([td,'station views glyph share',+(100*g/n).toFixed(2)]); // main had 25%
    // the forecourt under the canopy, looking down: no characters, brighter at night than by day
    const st=GAS_STATIONS[0];px=st.x0+1.5;py=st.y0+.9;a=0;pitch=-1;render(0);let s=0,c=0,ch=0;
    for(let rr=rows-12;rr<rows-2;rr++)for(let x=(cols>>1)-8;x<(cols>>1)+8;x++){const i=rr*cols+x;s+=BG[i]&15;c++;if(CH[i]!==' ')ch++;}
    floor[td]=s/c;if(ch)bad.push([td,'characters on the forecourt',ch]);}
   if(!(floor[22]>floor[14]))bad.push(['canopy does not light the forecourt at night',floor]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
