'use strict';
// The hardware store's garden-centre walls stay green from across the shop up to the trellis: no flip to grey up close.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('the garden centre wall stays green as you walk up to it',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=13;env(0);render(0);enterRoom('hardware',{word:'HARDWARE',ret:[100,100,0]},[5,5,0]);render(0);
   const out=[];for(const fp of [.005,.02,.035,.05,.065,.08,.2]){const n={green:0,warm:0,other:0};
    for(let k=0;k<400;k++){const u=(k%20)*.137,z=.3+Math.floor(k/20)*.1;hardwareWall(0,u,fp,z,1,16,3,8);const b=BG[0]>>4;if(b===GREEN)n.green++;else if(b===WARM)n.warm++;else n.other++;}
    out.push([fp,n]);}
   return out;});
  for(const [fp,n] of r){assert.equal(n.other,0,'no grey at footprint '+fp+' '+JSON.stringify(n));assert.ok(n.green>=n.warm*2,'mostly green at '+fp);}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
