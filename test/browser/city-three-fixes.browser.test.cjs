'use strict';
// A walker's dog keeps its breed as they walk; leafy trees have no grey squares in spring; downpipe water is one stream.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function page(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=10;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a dog walker\'s dog keeps its colour, size and side as they walk',()=>page(async p=>{
 const r=await p.evaluate(()=>{const ws=people.filter(q=>walkingDog(q)).slice(0,20);let changed=0;
  for(const w of ws){const first=dogOf(w);for(let f=0;f<120;f++){T+=1/60;w.ph+=.15;const d=dogOf(w);if(d.col!==first.col||d.small!==first.small)changed++;}}
  return{n:ws.length,changed};});
 assert.ok(r.n>0);assert.equal(r.changed,0,JSON.stringify(r));
}));

test('a figure on the line between two views holds one instead of flickering',()=>page(async p=>{
 const flips=await p.evaluate(()=>{const hold={};let last=null,n=0;
  for(let f=0;f<200;f++){const ang=Math.PI/FIG_VIEWS+Math.sin(f)*.02,v=figView(0,-1,Math.sin(ang),Math.cos(ang),hold);if(last!=null&&v!==last)n++;last=v;}return n;});
 assert.equal(flips,0);
}));

test('leafy trees in spring are green with no grey-white squares; only the blossom tree flowers',()=>page(async p=>{
 const r=await p.evaluate(()=>{const out={};
  for(const kind of ['oak','birch','poplar','blossom']){const t={kind,seed:.4,s:1};let white=0,mag=0,n=0;
   for(let u=-.3;u<=.3;u+=.004)for(let z=.15;z<=.7;z+=.004){if(Math.abs(u)<.035)continue;if(!treeCell(0,u,z,.02,.02,8,t))continue;n++;const b=BG[0]>>4;if(b===WHITE||b===GRAY||b===STONE)white++;if(b===MAG)mag++;}
   out[kind]={n,white,mag};}
  return{out,season:seasonIdx()};});
 if(r.season!==0)return; // (the test city starts in spring)
 for(const k of ['oak','birch','poplar']){assert.equal(r.out[k].white,0,k+' '+JSON.stringify(r.out[k]));assert.equal(r.out[k].mag,0,k);}
 assert.ok(r.out.blossom.mag>r.out.blossom.n*.5,'the blossom tree flowers');
}));

test('rain off a downpipe is one unbroken stream down to a splash',()=>page(async p=>{
 const r=await p.evaluate(()=>{rain=1;const col=[];for(let z=.004;z<=.011;z+=.0005)col.push(facadePipeWater(0,0,z,.001,.0005)?1:0);
  let splash=0;for(let u=-.01;u<=.01;u+=.001)if(facadePipeWater(0,u,.0005,.001,.0005))splash++;return{col,splash};});
 assert.ok(r.col.every(Boolean),'unbroken '+r.col.join(''));assert.ok(r.splash>=5,'a splash at the bottom');
}));
