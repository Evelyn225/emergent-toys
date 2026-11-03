'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('a shop told from the street: barber poles, pharmacy crosses, lanterns, café boards, florists\' buckets and bar signs, in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],all=shopExteriorList().flat();
   const want={pole:[RED,WHITE,BLUE],cross:[GREEN],lantern:[RED],board:[GREEN,WHITE,WARM],buckets:[GRAY,GREEN],barsign:[YEL]};
   for(const [kind,hues] of Object.entries(want)){
    const e=all.find(q=>q.kind===kind);if(!e){bad.push(['none',kind]);continue;}
    if(SHOP_EXTERIOR_FOR[e.sh.word]!==kind)bad.push(['wrong shop',kind,e.sh.word]);
    tod=kind==='barsign'?21:12;env(0);
    // (hung out from the wall: seen from along the street; on the pavement: from further out, looking down at it; on the wall: from in front)
    const along=kind==='cross'||kind==='barsign',ground=kind==='board'||kind==='buckets',fx=e.x+e.nx*(along?.08:ground?.3:0),fy=e.y+e.ny*(along?.08:ground?.3:0);
    px=along?fx-e.tx*.6:fx+e.nx*(ground?.6:.5);py=along?fy-e.ty*.6:fy+e.ny*(ground?.6:.5);a=Math.atan2(fy-py,fx-px);pitch=ground?-.3:.15;render(0);
    for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}
    const [vx,vy]=R(e.x,e.y);drawShopExterior(e,vx,vy);
    let n=0,ch=0;const seen=new Set();for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){n++;if(CH[i]!==' ')ch++;seen.add(BG[i]>>4);}
    if(n<40)bad.push([kind,'barely drawn',n]);if(ch)bad.push([kind,'characters',ch]);
    for(const c of hues)if(!seen.has(c))bad.push([kind,'missing colour',c,[...seen]]);}
   // one per shop, never on a shop closed down for good
   const shops=new Set();for(const e of all){if(shops.has(e.sh))bad.push(['two on one shop',e.sh.word]);shops.add(e.sh);if(e.sh.kind===SHOP_SHUT)bad.push(['on a vacant shop']);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
