'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('a shutter up close: housing, slats with lit lips and shadowed creases, rails in the reveal, the bottom bar and its padlock; plain ribs further off',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],sh={word:'TOBACCO',neon:RED},a0=0,a1=.4,z0=0,z1=.3,W=SHOP_SHUTTER,top=z1-W.housing,paint=shutterPaint(sh);
  const look=(a,z,d,sl=0)=>{WH.dn=.3;WH.sl=sl;eye=z;BG[0]=-1;CH[0]='?';const drew=shopShutter(0,a,z,a0,a1,z0,z1,sh,10,d,sl);return {bg:BG[0],ch:CH[0],drew};};
  tod=23;env(0);
  const near=.2,far=6;if(W.slat*projY/near<2)bad.push(['the near view does not resolve the slats',W.slat*projY/near]);
  const hous=look(.2,z1-.01,near);if(hous.bg!==C(GRAY,1.5+10*.12+day*.3))bad.push(['no housing at the head',hous]);
  // a lip near the top of a slat and the crease at its foot, straight on through the middle
  const slat=k=>top-(k+.1)*W.slat,crease=k=>top-(k+.93)*W.slat;
  const lip=look(.2,slat(8),near),cr=look(.2,crease(8),near);
  if(lip.ch!=='-'||cr.ch!=='_'||lip.bg===cr.bg)bad.push(['slats without relief',lip,cr]);
  if(lip.bg!==C(paint,1.9+10*.12+day*.4))bad.push(['slat not in the shop\'s paint',lip.bg]);
  // further off the slats run together into an even texture
  const fl=look(.2,slat(8),far),fc=look(.2,crease(8),far);
  if(fl.bg!==fc.bg||fl.ch!=='=')bad.push(['slats drawn from too far',fl,fc]);
  // looking along the wall from the side, the ray meets the guide rail's channel in the reveal before the curtain
  const side=look(a0+.003,.15,near,-3);if(side.ch!=='|'||side.bg!==C(GRAY,.9+10*.1))bad.push(['no reveal at the side',side]);
  const edge=look(a0+.002,.15,near);if(edge.ch!=='|')bad.push(['curtain edge not in its rail',edge]);
  const lock=look((a0+a1)/2,z0+.006,near),barEnd=look(.06,z0+.006,near);
  if(lock.ch!=='o')bad.push(['no padlock in the bottom bar',lock]);
  if(barEnd.ch!=='='||barEnd.bg!==C(paint,1.8+10*.15))bad.push(['no bottom bar',barEnd]);
  // one colour for one shop, and not every shop galvanised
  if(shutterPaint(sh)!==paint||shutterPaint({...sh})!==paint)bad.push('paint not fixed per shop');
  const cols=new Set(SHOP.filter(s=>s&&s.word).slice(0,400).map(shutterPaint));if(cols.size<3)bad.push(['every shutter the same colour',[...cols]]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('every facade family pulls its shutters down when the shop is shut, and none when it is open',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],views={};
  const fasc=is=>ARCH_DETAILS.filter(o=>o.kind==='fascia'&&SHOP[o.ownerCell]&&is(SHOP[o.ownerCell],o.ownerCell)).map(o=>({sh:SHOP[o.ownerCell],x:o.x,y:o.y,nx:o.nx,ny:o.ny}));
  const cells=is=>{const out=[];for(let k=0;k<map.length&&out.length<40;k++){const sh=SHOP[k];if(!sh||!map[k]||!is(sh,k))continue;const x=k%N,y=Math.floor(k/N);
   for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]])if(!map[idx(x+dx,y+dy)]){out.push({sh,x:x+.5+dx*.5,y:y+.5+dy*.5,nx:dx,ny:dy});break;}}return out;};
  views.brownstones=fasc(s=>s.architecture&&s.architecture.region==='brownstones');
  views.downtown=fasc(s=>s.architecture&&!s.architecture.profile&&(s.architecture.region==='downtown'||s.architecture.sty===14));
  views.residential=fasc(s=>s.architecture?.profile);
  views.generic=fasc((s,k)=>!s.architecture&&[2,15].includes(STY[k]));
  views.warehouses=fasc((s,k)=>!s.architecture&&STY[k]===8);
  views.merchants=cells(s=>MERCHANT_BY_SHOP.get(s)); // (Chinatown's and every shop in the Shotengai)
  for(const [fam,list] of Object.entries(views)){
   let ok=false;
   for(const v of list.filter(v=>v.sh.kind!==SHOP_SHUT&&!openAt(v.sh,23.5)&&openAt(v.sh,14)).slice(0,10)){
    const count=t=>{px=v.x+v.nx*.3;py=v.y+v.ny*.3;a=Math.atan2(-v.ny,-v.nx);pitch=-.15;tod=t;env(0);let n=0;const s0=shopShutter;shopShutter=(...z)=>{if(z[7]===v.sh)n++;return s0(...z);};try{render(0);}finally{shopShutter=s0;}return n;};
    const shut=count(23.5),open=count(14);
    if(open)bad.push([fam,'shutters down while open',v.sh.word,open]);
    if(shut>20){ok=true;break;}}
   if(!ok)bad.push([fam,'no shutters on a shut shop']);}
  return bad;
 });
 assert.deepEqual(r,[]);
}));
