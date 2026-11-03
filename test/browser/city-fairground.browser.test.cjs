'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('Sunset Pier in colour: the deck, the Ferris wheel, the carousel, the booths and their prizes, the gate',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   const bad=[];
   for(const [td,limit] of [[14,.02],[21,.05]]){paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=td;env(0);render(0);
    let n=0,g=0;
    for(const [x,y,ang,pt] of [[FAIR.cx,FAIR.y0-.5,Math.PI/2,.25],[WHEEL_BOARD.x,WHEEL_BOARD.y-1.2,Math.PI/2,.5],[CAROUSEL.x-CAROUSEL.r-1,CAROUSEL.y,0,.1],[FAIR.cx+1,FAIR.y0+1.5,Math.PI/2+.6,.1]]){
     px=x;py=y;a=ang;pitch=pt;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Z0-9]/.test(CH[i]))g++;}}
    if(g/n>limit)bad.push([td,'fair views glyph share',+(100*g/n).toFixed(2)]);} // (main had 37% by day; at night the stars and the search beams count too)
   // the pier's deck: boards in colour, none of the old characters
   tod=14;env(0);px=FAIR.cx;py=FAIR.y0+1;a=Math.PI/2;pitch=-.4;render(0);let dn=0,dc=0;
   for(let rr=rows-15;rr<rows;rr++)for(let c=10;c<cols-10;c++){const i=rr*cols+c;if(FL[i]===0)continue;dn++;if(CH[i]!==' ')dc++;}
   if(!dn||dc/dn>.01)bad.push(['characters on the deck',dc,dn]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
