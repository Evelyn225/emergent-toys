'use strict';
// Subway entrances: railings you see the steps through and round frosted globe lamps (not blocks of `o`); and every
// kind of shop shows what it sells in its window, lobbies for the hotels and banks, on every facade family.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';tod=14;dayNum=12;env(0);render(0);for(const q of people)q.hidden=true;cars.length=0;});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a subway entrance up close: no wall of o characters; round glowing globes; a railing you see through',()=>city(async p=>{
 const r=await p.evaluate(()=>{const s=stations[2];px=s.x-.25;py=s.y;a=0;pitch=-.05;render(0);
  let os=0,green=0;for(let i=0;i<CH.length;i++){if(CH[i]==='o')os++;if((BG[i]>>4)===GREEN&&(BG[i]&15)>=5)green++;}
  // the railing is see-through between its balusters: a ray between two of them misses it
  HIT.u=.022-SUBWAY_HOLE[0];HIT.w=.06;HIT.face=3;const gap=subwayRailing(SUBWAY_HOLE[0])(0,.05,8);HIT.u=-SUBWAY_HOLE[0];const bar=subwayRailing(SUBWAY_HOLE[0])(0,.05,8);
  return{os,green,gap,bar};});
 assert.ok(r.os<10,'not a field of o characters: '+r.os);assert.ok(r.green>40,'the globes glow green: '+r.green);
 assert.equal(r.gap,false,'between balusters: see through');assert.equal(r.bar,true,'on a post: solid');
}));

test('every shop kind has a display of its own; hotels, banks and gyms show their lobby instead',()=>city(async p=>{
 const r=await p.evaluate(()=>{const kinds={};for(const w of ['PET SHOP','TOYS','PAWN','TOBACCO','REALTY','CINEMA','JEWELER','SPORTS','SKATE','TIRES','HARDWARE','WELDING','CARS','HOTEL','BANK','GYM'])kinds[w]=shopDisplay({word:w})[0];
  const generic=Object.entries(kinds).filter(([,k])=>k==='box').map(([w])=>w);
  // the near shops render their display: count the window cells each code path fills from a spot outside each
  const drawn={};for(const w of ['PET SHOP','ANTIQUES','REALTY']){gotoShop(w);px-=Math.cos(a)*.3;py-=Math.sin(a)*.3;pitch=-.1;let n=0;const sw=shopWindow;shopWindow=(...g)=>{const q=sw(...g);if(q)n++;return q;};try{render(0);}finally{shopWindow=sw;}drawn[w]=n;}
  return{kinds,generic,drawn};});
 assert.deepEqual(r.generic,[],'no shop left with the generic boxes');
 for(const w of ['HOTEL','BANK','GYM'])assert.equal(r.kinds[w],'lobby');
 for(const [w,n] of Object.entries(r.drawn))assert.ok(n>100,w+': its display drawn ('+n+' cells)');
}));
