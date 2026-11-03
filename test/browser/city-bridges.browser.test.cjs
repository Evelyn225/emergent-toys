'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('bridges: decks, walkways, girders, rails, towers and the footbridge are colour, with joints and boards that read',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],V=[];if(!ROAD_BRIDGES.length)return {bad:['no road bridges']};
   for(const br of ROAD_BRIDGES.slice(0,2)){const ym=(br.y0+br.y1)/2;V.push([br.x+.4,ym,Math.PI/2,0],[br.x-.85,br.y0+br.ramp+3,-Math.PI/2+.3,0],[br.x+3,br.y0-1.5,2.2,.1]);}
   V.push([FOOTBRIDGE.x,FOOTBRIDGE.y0+.6,Math.PI/2,-.1]);
   for(const td of [14,22]){tod=td;env(0);let n=0,g=0;
    for(const [x,y,ang,pt] of V){px=x;py=y;a=ang;pitch=pt;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!=='')g++;}}
    if(g/n>(td===14?.03:.045))bad.push([td,"bridge views glyph share",+(100*g/n).toFixed(2)]);}  // main had 18% by day, 19% at night (stars, the sea and the Grand Hotel stay)
   // on the deck looking along it: the asphalt, the centre line's yellow and the walkway's paler slabs all there
   tod=14;env(0);const br=ROAD_BRIDGES[0];px=br.x+.4;py=(br.y0+br.y1)/2;a=Math.PI/2;pitch=-.2;render(0);
   const bases=new Set();for(let rr=Math.ceil(hor)+2;rr<rows;rr++)for(let c=0;c<cols;c++)bases.add(BG[rr*cols+c]>>4);
   if(!bases.has(YEL))bad.push(['no centre line on the deck']);
   // the footbridge: boards in several tones close up, not one flat colour
   px=FOOTBRIDGE.x;py=FOOTBRIDGE.y0+.6;a=Math.PI/2;pitch=-.1;render(0);const c0=cols>>1,tones=new Set();
   for(let rr=rows-1;rr>rows-30;rr--)if((BG[rr*cols+c0]>>4)===BRICK)tones.add(BG[rr*cols+c0]&15);
   if(tones.size<2)bad.push(['footbridge boards flat',tones.size]);
   // steel parts shared with the el and the signals: no characters on any face
   let sc=0;for(const f of [0,1,2,3,4,5]){HIT.face=f;CH[0]=' ';STEEL.cap(0,1,10);STEEL.pole(0,1,10);if(CH[0]!==' ')sc++;}
   if(sc)bad.push(['steel characters',sc]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
