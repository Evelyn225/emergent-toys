'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('seated knees and shins retain their depth in front of the ferry bench, including fine sprites',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1170,height:800}});
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const results=await p.evaluate(()=>{
  tod=14;env(0);render(0);dx=1;dy=0;eye=.09;hor=rows*.3;amb=homeLight=1;const results=[];
  const look=figLook({hair:'short',top:'short',bot:'pants',col:{top:[RED,15],bot:[MAG,15],shoe:[YEL,15]}});
  for(const distance of [.175/FIG_TALL*projY/3,.6]){
   T++;figFineT=-1;figFineN=0;
   const base=FERRY_BENCH.top-7*.175/FIG_TALL,reset=()=>{ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(C(BLUE,1));CH.fill(' ');};
   const person=()=>drawFigure(distance,0,base,.175,-1,0,look,'sit7',{light:15});
   const bench=()=>drawBox(boxAt(distance,0,0,1,FERRY_BENCH.hl,FERRY_BENCH.hw,FERRY_BENCH.bottom,FERRY_BENCH.top),i=>{BG[i]=C(WHITE,10);set(i,' ',0);return true;});
   reset();person();const candidates=[];
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c,z=eye+(hor-r-.5)*distance/projY;
    // The knee/shin lies ahead of the cushion's front edge, not on the hip plane.
    if((BG[i]>>4)===MAG&&z<FERRY_BENCH.top+.012&&z>.005)candidates.push({i,depth:ZB[i]});
   }
   const front=candidates.filter(q=>q.depth<distance-FERRY_BENCH.hw-.001);
   reset();bench();person();let visible=0;for(const q of front)if((BG[q.i]>>4)===MAG)visible++;
   // A nearer opaque obstruction must still hide the seated person.
   reset();drawBox(boxAt(distance*.4,0,1,0,.008,.12,0,.25),i=>{BG[i]=C(WHITE,10);set(i,' ',0);return true;});person();
   let leaked=0;for(const q of candidates)if((BG[q.i]>>4)===MAG)leaked++;
   results.push({distance,fine:[...figFineCache.keys()].some(k=>k.startsWith(look.shape+'|sit7|')),candidates:candidates.length,front:front.length,visible,leaked});
  }return results;
 });
 assert.equal(results[0].fine,true,JSON.stringify(results));
 for(const r of results){assert.ok(r.candidates>5,JSON.stringify(r));assert.ok(r.front>3,JSON.stringify(r));assert.equal(r.visible,r.front,JSON.stringify(r));assert.equal(r.leaked,0,JSON.stringify(r));}
 }finally{await browser.close();}
});
