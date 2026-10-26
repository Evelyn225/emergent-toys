'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the generic shops have a door under their board, and a plain transom where the painted awning was',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],boards=ARCH_DETAILS.filter(o=>o.kind==='fascia'&&SHOP[o.ownerCell]&&!SHOP[o.ownerCell].architecture&&[2,15].includes(STY[o.ownerCell])&&SHOP[o.ownerCell].kind!==SHOP_SHUT);
  const awned=o=>ARCH_DETAILS.some(q=>q.kind==='awning'&&q.ownerCell===o.ownerCell&&Math.hypot(q.x-o.x,q.y-o.y)<.2);
  const look=(o,t)=>{px=o.x+o.nx;py=o.y+o.ny;a=Math.atan2(-o.ny,-o.nx);pitch=0;tod=t;env(0);};
  let doors=0,plain=0,checked=0;
  for(const o of boards.slice(0,40)){const sh=SHOP[o.ownerCell];if(!openAt(sh,14))continue;
   look(o,14);let n=0;const d0=shopDoor;shopDoor=(...z)=>{const k=d0(...z);if(k&&z[3]===sh)n++;return k;};try{render(0);}finally{shopDoor=d0;}
   if(n>20)doors++;else bad.push(['no door under the board',sh.word,n]);
   if(awned(o)||plain>=6)continue;plain++;
   // the band where the painted awning was, 28 to 32 cm up the wall (2.8 to 3.2 m), seen square on from 10 m
   for(let i=0;i<CH.length;i++){const dz=ZB[i];if(Math.abs(dz-1)>.03)continue;const z=eye+(hor-Math.floor(i/cols)-.5)*dz/projY;
    if(z>.285&&z<.315){checked++;if(CH[i]==='/')bad.push(['a painted awning left',sh.word]);}}}
  if(doors<10)bad.push(['too few shops checked',doors]);
  if(!checked)bad.push('no transom seen');
  return bad.slice(0,8);
 });
 assert.deepEqual(r,[]);
}));
