'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the cinema, arcade and Velvet Rope walls are colour: the movie, curtain folds, a neon zigzag that never vanishes, the chase strip and buttoned velvet',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   const bad=[],hue=c=>c>>4,enter=k=>enterRoom(k,{word:k.toUpperCase(),neon:CYAN,ret:[100,100,0],cell:[10,10]},ROOM_DEFS[k].entry||[3,3,0]);
   for(const k of ['cinema','arcade','stripclub']){enter(k);room.props=[];const W=room.W,H=room.H;let g=0,n=0;
    for(const [x,y]of [[1.6,1.6],[W-1.6,1.6],[1.6,H-1.6],[W-1.6,H-1.6]]){px=x;py=y;a=Math.atan2(H/2-y,W/2-x);pitch=0;render(0);
     for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z]/.test(c))g++;}}
    if(g/n>.002)bad.push([k,'glyph share',+(100*g/n).toFixed(2)]);}
   // the movie moves and changes brightness; the curtains fold up close and settle far off
   enter('cinema');const movie=t=>{T=t;const s=[];for(let u=3;u<11;u+=.4){cinemaWall(0,u,.01,1.5,3,7,0,8);s.push(BG[0]);}return s.join();};
   if(movie(26)===movie(27))bad.push('still movie');
   const folds=d=>{const s=new Set();for(let u=0;u<2;u+=.02){cinemaWall(0,u,.005,1,d,0,5,8);s.add(BG[0]);}return s.size;};
   if(!(folds(1)>1&&folds(40)===1))bad.push(['curtains',folds(1),folds(40)]);
   // the arcade's zigzag stays at least a cell at any distance
   enter('arcade');for(const d of [1,6,12]){let on=0;for(let z=1.3;z<2.2;z+=.005){arcadeWall(0,.6,.01,z,d,0,5,8);if(hue(BG[0])!==MAG||BG[0]>C(MAG,1))on++;}if(!on)bad.push(['zigzag lost at',d]);}
   // the club: the chase strip moves, velvet buttons up close and plain far off
   enter('stripclub');const strip=t=>{T=t;clubWall(0,1.2,.01,2.47,2,0,5,8);return BG[0];};if(strip(26)===strip(26.3))bad.push('still strip');
   const velvet=d=>{const s=new Set();for(let u=.05;u<1;u+=.013)for(let z=.2;z<.8;z+=.02){clubWall(0,u,.002,z,d,0,5,8);s.add(BG[0]);}return s.size;};
   if(!(velvet(.5)>1&&velvet(30)===1))bad.push(['velvet',velvet(.5),velvet(30)]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
