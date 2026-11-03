'use strict';
// Sat down and looking down, you see your own legs; standing, or looking ahead, you don't.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('your legs show when you look down sitting on a bench',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=13;weather='clear';for(const q of people)q.hidden=true;env(0);render(0);
   const bn=benches[7];px=bn.x;py=bn.y;const s=nearSeat();if(!s)return{noSeat:true};
   const legCells=()=>{let n=0;const real=drawSeatedLegs;const before=new Uint32Array(BG.length);
    drawSeatedLegs=()=>{};env(0);render(0);before.set(BG);drawSeatedLegs=real;env(0);render(0);
    for(let i=0;i<BG.length;i++)if(BG[i]!==before[i]&&(BG[i]>>4===BLUE||BG[i]>>4===BLACK))n++;return n;};
   body.seat={...s,from:[px,py]};px=s.x;py=s.y;if(s.fx!=null)a=Math.atan2(s.fy,s.fx);
   pitch=-.9;const down=legCells();pitch=.2;const ahead=legCells();
   const yaw0=a;pitch=-.9;a=yaw0+Math.PI;const behind=legCells();a=yaw0;
   body.seat=null;pitch=-.9;const standing=legCells();
   return{down,ahead,behind,standing,cells:cols*rows};});
  assert.ok(!r.noSeat,'found a bench');
  assert.ok(r.down>r.cells*.04,'legs fill part of the view looking down '+JSON.stringify(r));
  assert.equal(r.ahead,0,'not looking ahead');assert.equal(r.behind,0,'they stay where the seat faces, not behind you');
  assert.equal(r.standing,0,'not standing');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
