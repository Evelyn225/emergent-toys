'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('behind a shop window up close: the plinth, the goods standing on it in front of the back, the shop beyond, spotlights after dark',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],sh={word:'FLORIST',neon:GREEN},u0=1,u1=1.4,z0=.04,z1=.3,base=z0+SHOP_WINDOW.plinth;
  const look=(u,z,sl,dn=.3)=>{WH.dn=dn;WH.sl=sl;WH.wc=u;eye=.17;BG[0]=-1;CH[0]='?';shopWindow(0,u,z,u0,u1,z0,z1,sh,true,10,7);return BG[0];};
  tod=14;env(0);
  const front=look(1.2,base-.01,0),top=look(1.2,base+.002,0,.02);
  if(front!==C(GREEN,.8+10*.05)||front===top)bad.push(['no plinth front below the plinth top',front,top]);
  // straight on through the middle of the first flower bunch (its head), and through the gap between two
  const step=(u1-u0)/Math.round((u1-u0)/SHOP_WINDOW.spacing),c0=u0+step/2,[,ht]=SHOP_DISPLAYS.flowers;
  const head=look(c0,base+ht*.7,0),gap=look(u0+step,base+ht*.7,0);
  if(!ITEM_COL.some(col=>[2.4,3.9].some(k=>Math.abs(head-C(col,k+10*.18))<1e-9)))bad.push(['no flowers on the plinth',head]);
  if(gap===head||![C(WARM,1.4+day),C(WARM,1.4+day+.5)].includes(gap))bad.push(['no shop beyond between the goods',gap]);
  // the goods stand part-way in: a ray at an angle sees them shift against the back
  const slid=look(c0+.03,base+ht*.7,-1.2);if(slid!==head)bad.push('the goods not standing in front of the back');
  if(look(u0+.005,base+.1,-6)!==C(GRAY,1.2+10*.1))bad.push('no side wall at a steep angle');
  tod=22;env(0);const spot=look(c0,z1-.002,0,.02);if(spot!==C(YEL,12))bad.push(['no spotlight over the goods after dark',spot]);
  if(look(u0+step,z1-.002,0,.02)===C(YEL,12))bad.push('spotlights between the goods');
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('every shop family shows its displays up close and flat glass further off; neon shops, flats and warehouses keep their fronts',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],seen={};
  const fams={midtown:s=>s.architecture&&!s.architecture.profile&&s.architecture.region==='midtown'&&s.architecture.sty!==14,downtown:s=>s.architecture&&!s.architecture.profile&&(s.architecture.region==='downtown'||s.architecture.sty===14),
   brownstones:s=>s.architecture&&s.architecture.region==='brownstones',residential:s=>s.architecture?.profile,generic:s=>!s.architecture&&[2,15].includes(STY[ARCH_DETAILS.find(o=>o.kind==='fascia'&&SHOP[o.ownerCell]===s).ownerCell])};
  for(const [fam,is] of Object.entries(fams)){
   const cands=ARCH_DETAILS.filter(o=>o.kind==='fascia'&&SHOP[o.ownerCell].kind===SHOP_LIT&&SHOP[o.ownerCell].word===o.word&&is(SHOP[o.ownerCell]));
   let ok=false;
   for(const o of cands.slice(0,12)){const sh=SHOP[o.ownerCell];if(!openAt(sh,14))continue;
    const count=d=>{px=o.x+o.nx*d;py=o.y+o.ny*d;a=Math.atan2(-o.ny,-o.nx);pitch=-.15;tod=14;env(0);let n=0;const w0=shopWindow;shopWindow=(...z)=>{if(z[7]===sh)n++;return w0(...z);};try{render(0);}finally{shopWindow=w0;}return n;};
    const near=count(.3),far=count(4.5); // (45 m)
    if(far)bad.push([fam,'displays drawn from further off',far]);
    if(near>20){ok=true;break;}}
   if(!ok)bad.push([fam,'no shop window display up close']);}
  // the fronts that keep their glow or their doors
  const keep=ARCH_DETAILS.filter(o=>o.kind==='fascia'&&(SHOP[o.ownerCell].kind===SHOP_NEON||STY[o.ownerCell]===8)).slice(0,6);
  for(const o of keep){const sh=SHOP[o.ownerCell];px=o.x+o.nx*.3;py=o.y+o.ny*.3;a=Math.atan2(-o.ny,-o.nx);pitch=-.15;tod=14;env(0);let n=0;const w0=shopWindow;shopWindow=(...z)=>{if(z[7]===sh)n++;return w0(...z);};try{render(0);}finally{shopWindow=w0;}
   if(n)bad.push([sh.kind===SHOP_NEON?'a neon shop':'a warehouse','with a display',sh.word]);}
  return bad;
 });
 assert.deepEqual(r,[]);
}));
