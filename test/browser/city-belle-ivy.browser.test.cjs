'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=11;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('Belle Époque ivy has woody stems and separate lit leaves that change with the seasons, and keeps its texture from across the street',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{const b=BELLE_BUILDINGS.find(q=>q.ivy)||[...new Set(SHOP.filter(s=>s?.belle?.ivy))][0].belle,h=2.4,out={};
  for(const sn of [0,1,2,3]){setSeason(sn);const cols=new Map();let leaf=0,stem=0,tones=new Set();
   for(let z=.02;z<1.6;z+=.004)for(let u=0;u<.7;u+=.004){BG[0]=0;if(!belleIvy(0,u,z,h,b,10,.002))continue;const c=BG[0];cols.set(c,(cols.get(c)||0)+1);tones.add(c);
    if(c===C(BRICK,.9+10*.12)||c===C(BRICK,1.2+10*.12))stem++;else leaf++;}
   out[sn]={leaf,stem,tones:tones.size};}
  // from across the street (a cell of wall bigger than a leaf), it's still clumps, not one flat colour
  setSeason(1);const far=new Set();let farHits=0;for(let z=.02;z<1.6;z+=.01)for(let u=0;u<.7;u+=.01){BG[0]=0;if(belleIvy(0,u,z,h,b,10,.04)){farHits++;far.add(BG[0]);}}
  return {out,far:far.size,farHits};});
 const [spring,summer,autumn,winter]=[0,1,2,3].map(k=>r.out[k]);
 assert.ok(summer.leaf>2000&&summer.stem>50,'leaves and stems up close '+JSON.stringify(summer));
 assert.ok(summer.tones>=4,'leaves each lit and toned, not one flat green: '+summer.tones);
 assert.ok(winter.leaf<summer.leaf*.35&&winter.stem>summer.stem,'winter strips the leaves and shows the stems '+JSON.stringify([summer,winter]));
 assert.ok(autumn.tones>summer.tones,'autumn turns red, orange and gold');
 assert.ok(r.farHits>100&&r.far>=4,'from across the street it keeps some texture '+JSON.stringify(r));
}));
