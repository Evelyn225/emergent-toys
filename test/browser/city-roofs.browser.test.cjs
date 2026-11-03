'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('roofs from above: each building its own surface, a lit coping on the parapet, cornices and bays in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   // roof cells straight from roofTop across many buildings: no characters, several kinds of surface
   const hues=new Set();let roofs=0,chars=0;
   for(let k=0;k<4000;k++){const mx=40+(k*37)%300,my=40+((k*53)>>2)%300;const h=map[idx(mx,my)];if(!(h>.3)||STY[idx(mx,my)]===19||STY[idx(mx,my)]===6)continue;
    BG[0]=0;CH[0]='?';roofTop(0,mx+.5,my+.5,h,2);roofs++;hues.add(BG[0]>>4);if(CH[0]!==' ')chars++;}
   if(roofs<200)bad.push(['roofs sampled',roofs]);if(chars)bad.push(['characters on roofs',chars]);if(hues.size<3)bad.push(['roof kinds',[...hues]]);
   // a parapet: the coping's outer edge lit, its inner face darker
   let found=false;for(let mx=40;mx<340&&!found;mx++)for(let my=40;my<340&&!found;my++){const h=map[idx(mx,my)];if(!(h>.3)||map[idx(mx-1,my)]===h||STY[idx(mx,my)]===19)continue;
    roofTop(0,mx+.005,my+.5,h,1);const outer=BG[0];roofTop(0,mx+.04,my+.5,h,1);const inner=BG[0];found=true;
    if(outer>>4!==STONE||!((outer&15)>(inner&15)))bad.push(['coping',outer,inner]);}
   if(!found)bad.push('no parapet found');
   // rooftop views over three districts, day and night
   for(const td of [14,22]){tod=td;env(0);let g=0,n=0;
    for(const dist of ['downtown','midtown']){let s=null;for(let by=1;by<N/8-1&&!s;by++)for(let bx=1;bx<N/8-1&&!s;bx++)if(districtOf(bx,by)===dist)s=[bx*8+4,by*8+2.15];
     freecam={x:s[0],y:s[1],z:3,yaw:.6,pitch:-.3};[px,py]=s;a=.6;pitch=-.3;render(0);
     for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Za-z0-9]/.test(c))g++;}}
    freecam=null;if(g/n>.06)bad.push([td,'rooftop glyph share',+(100*g/n).toFixed(1)]);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
