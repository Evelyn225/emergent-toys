'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());

test('the fruit shop wallpaper has small oranges with leaves in a repeating pattern, not whole squares of fruit',async()=>{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=null;T=10;tod=14;env(0);enterRoom('fruitshop',{word:'FRUIT',ret:[100,100,0]},[5,5,0]);
   const at=(u,z)=>{BG[0]=-1;CH[0]='?';fruitWall(0,u,.01,z,2,0,3,10);return CH[0]===' '?BG[0]:'glyph';};
   const paper=at(.01,2.19),orange=C(ORANGE,7+10*.2),leaf=C(GREEN,3+10*.2),bad=[];let fruit=0,leaves=0,n=0,worst=0;
   // every 50 cm square of the paper above the dado, sampled every 1 cm
   for(let su=0;su<12;su+=.5)for(let sz=1;sz<2.2;sz+=.5){let k=0,m=0;
    for(let u=su;u<su+.5;u+=.01)for(let z=sz;z<Math.min(sz+.5,2.2);z+=.01){const b=at(u,z);m++;if(b!==paper)k++;if(b===orange)fruit++;if(b===leaf)leaves++;}
    worst=Math.max(worst,k/m);n+=m;}
   if(worst>.2)bad.push(['a square mostly fruit',worst]);
   // a repeat, not a scatter: the same paper half a metre along or up, and a quarter along and up (the half drop)
   for(let u=.003;u<3;u+=.011)for(let z=1.003;z<1.6;z+=.013){const b=at(u,z);if(b!==at(u+.5,z)||b!==at(u,z+.5)||b!==at(u+.25,z+.25)){bad.push(['not a repeating pattern',+u.toFixed(3),+z.toFixed(3)]);u=9;break;}}
   if(fruit/n<.01||leaves/n<.001)bad.push(['no fruit on the paper',fruit/n,leaves/n]);
   return bad;
  });
  assert.deepEqual(r,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
