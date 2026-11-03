'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('a street lamp\'s light falls over the ground: dithered warm over the ground\'s own colour and texture, not a flat disc',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=22;env(0);render(0);
   const bad=[];let views=0;
   for(const l of lamps.filter(q=>ROAD[idx(Math.floor(q.x),Math.floor(q.y))]).slice(5,40).filter((_,k)=>k%7===0)){
    const ang=Math.atan2(l.ay,l.ax)+Math.PI/2;px=l.x-Math.cos(ang)*1.1+l.ax*.6;py=l.y-Math.sin(ang)*1.1+l.ay*.6;a=ang;pitch=-.25;render(0);
    // the cells of the pool (lit by the lamp, on the ground): both the ground's own colour and warm light, in several levels
    const bases=new Map(),levels=new Set();let n=0;
    for(let i=0;i<cols*rows;i++)if(LAMPL[i]>2&&FL[i]!==0&&ZB[i]<3){n++;bases.set(BG[i]>>4,(bases.get(BG[i]>>4)||0)+1);levels.add(BG[i]);}
    if(n<40)continue;views++;
    const warm=(bases.get(WARM)||0)/n;
    if(warm>.9||warm<.1)bad.push(['pool not dithered',+warm.toFixed(2),n]);
    if(levels.size<4)bad.push(['pool flat',levels.size]);
    // its body (moderately lit: not the hot spot under the lamp): still a mix of warm and the ground, never solid warm (the old flat disc)
    let cn=0,cw=0;for(let i=0;i<cols*rows;i++)if(LAMPL[i]>5&&LAMPL[i]<9&&FL[i]!==0&&ZB[i]<3){cn++;if(BG[i]>>4===WARM)cw++;}
    if(cn>20&&cw/cn>.9)bad.push(['solid warm core',+(cw/cn).toFixed(2),cn]);}
   if(views<2)bad.push(['too few pools seen',views]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
