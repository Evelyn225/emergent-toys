'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the Shotengai under its roof: translucent panels on a steel frame hide the floors above, and the street paints almost no characters',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;render(0);
   const bad=[],spots=[];for(let by=1;by<N/8-1&&spots.length<3;by++)for(let bx=1;bx<N/8-1&&spots.length<3;bx++)if(districtOf(bx,by)==='shotengai'&&arcadeAt(bx*8+3,by*8+1))spots.push([bx*8+3,by*8+1]);
   if(!spots.length)return {bad:['no covered street found']};
   for(const td of [14,22]){tod=td;env(0);let g=0,n=0,sky=0,roof=0,steel=0,warm=0;
    for(const [x,y] of spots)for(const [ang,pt] of [[0,.08],[Math.PI/2,.08],[0,.9]]){px=x;py=y;a=ang;pitch=pt;render(0);
     for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Za-z0-9]/.test(c))g++;}
     if(pt>.5)for(let i=0;i<cols*(rows>>2);i++){const h=BG[i]>>4;if(h===BLUE&&td===14)sky++;else if(h===WHITE||h===WARM){roof++;if(h===WARM)warm++;}else if(h===GRAY)steel++;}}
    if(g/n>.04)bad.push([td,'glyph share',+(100*g/n).toFixed(1)]);
    if(sky>roof*.05)bad.push([td,'sky through the roof',sky,roof]);if(roof<200||steel<20)bad.push([td,'roof and frame',roof,steel]);
    if(td===22&&warm<roof*.5)bad.push(['panels not lamp-lit at night',warm,roof]);}
   for(const part of ['beam','rib','bar','panel']){let found=false;const [x,y]=spots[0];for(let k=0;k<400&&!found;k++){const wx=x-2+k%20*.2,wy=y-.5+Math.floor(k/20)*.05;if(arcadeRoofPart(worldCoord(wx),worldCoord(wy))===part)found=true;}if(!found)bad.push(['no '+part]);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
