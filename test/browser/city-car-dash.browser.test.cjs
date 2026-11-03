'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('from the driver\'s seat: a bonnet in the car\'s colour, a dashboard, a round wheel and dials lit after dark, no characters but the readouts',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;room=freecam=null;T=26;const bad=[];
   const c=cars.find(c=>!c.parked&&c.kind==='car')||cars[0];c.body=RED;me=c;mode='drive';c.player=true;c.v=0;a=Math.atan2(c.hy,c.hx);px=c.x;py=c.y;look=0;chaseOn=false;
   for(const td of [14,22]){tod=td;env(0);render(0);
    let chars=0;const seen=new Map();for(let rr=rows-DASH_ROWS;rr<rows;rr++)for(let x=0;x<cols;x++){const i=rr*cols+x;if(CH[i]!==' '&&CH[i]!==''&&!/[0-9a-z\/]/.test(CH[i]))chars++;seen.set(BG[i]>>4,(seen.get(BG[i]>>4)||0)+1);}
    if(chars)bad.push([td,'characters on the dash',chars]);
    if(!(seen.get(RED)>cols*.6))bad.push([td,'no bonnet in the car\'s colour',seen.get(RED)]);
    let rim=0;for(let rr=rows-DASH_ROWS+2;rr<rows;rr++)for(let x=0;x<cols;x++){const b=BG[rr*cols+x];if(b>>4===GRAY&&(b&15)>=4)rim++;}if(rim<6)bad.push([td,'no lit wheel rim',rim]);
    if(td===22&&!seen.get(CYAN))bad.push(['dials not lit at night']);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
