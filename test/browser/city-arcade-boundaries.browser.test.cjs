'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the assembled museum street has no canopy pixels or cover, while interior Shotengai roofs still render',async()=>{
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=12;tod=12;env(0);render(0);
   const bad=[];for(let x=MUSEUM.bx*8+2;x<MUSEUM.bx*8+8;x++)for(const y of [MUSEUM.by*8+8.05,MUSEUM.by*8+9.95])if(arcadeAt(x+.5,y)||arcadeRoofPart(x+.5,y))bad.push([x,y]);
   px=MUSEUM.bx*8+5;py=MUSEUM.by*8+9.1;a=-Math.PI/2;pitch=.35;render(0);render(0);const clear=free(px,py),covered=underCover(px,py),before=[CH.slice(),COL.slice(),BG.slice()];
   const sky=arcadeSky,hit=arcadeRoofHit;let changed=0;arcadeSky=()=>false;arcadeRoofHit=()=>null;try{render(0);for(let i=0;i<CH.length;i++)if(CH[i]!==before[0][i]||COL[i]!==before[1][i]||BG[i]!==before[2][i])changed++;}finally{arcadeSky=sky;arcadeRoofHit=hit;}
   let control=null;for(const ns of [true,false])for(let lane=MUSEUM.by*8;lane<MUSEUM.by*8+64&&!control;lane+=8)for(let along=MUSEUM.bx*8-32;along<MUSEUM.bx*8+64&&!control;along++){
    const s=arcadeSpanFor(ns,lane,along);if(!s||![s.lo-1,s.hi].every(q=>districtAt(ns?q+.5:along+.5,ns?along+.5:q+.5)==='shotengai'))continue;
    px=ns?(s.lo+s.hi)/2:along+.5;py=ns?along+.5:(s.lo+s.hi)/2;control={part:arcadeRoofPart(px,py),covered:underCover(px,py),drawn:arcadeSky(0,0,0,1),point:[px,py]};
   }
   return{bad,clear,covered,changed,control};
  });assert.deepEqual(r.bad,[]);assert.ok(r.clear);assert.equal(r.covered,false);assert.equal(r.changed,0,'removing the roof renderer must not change the museum-facing view');assert.ok(r.control?.part&&r.control.covered&&r.control.drawn,JSON.stringify(r.control));assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
