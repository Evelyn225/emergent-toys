'use strict';
// ASCII City: the open sea. Soft swell shading rather than fields of '-' and '~'; calm far off; dark at night; a
// glitter path under the moon.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=100;weather='clear';rain=0;fogAmt=0;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('open water is shaded swell with few glyphs, calm far off, and dark at night',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],look=(t,a_)=>{tod=t;px=684;py=346;a=a_;pitch=-.12;freecam={z:.4};env(0);render(0);
   const sea=[];for(let i=0;i<BG.length;i++)if(FL[i]===3&&ZB[i]<vis)sea.push(i);return sea;};
  const day=look(13,.35),glyphs=day.filter(i=>CH[i]!==' ').length,lv=day.map(i=>BG[i]&15);
  if(day.length<2000)bad.push(['not looking at the sea',day.length]);
  if(glyphs>day.length*.12)bad.push(['glyph fields',glyphs,day.length]);
  if(new Set(lv).size<3)bad.push('flat');
  // far water (the last rows before the horizon) varies less than near water
  const spread=rs=>{const v=rs.map(i=>BG[i]&15);return Math.max(...v)-Math.min(...v);};
  const near=day.filter(i=>ZB[i]<1.5),far=day.filter(i=>ZB[i]>vis*.5);
  if(far.length&&near.length&&spread(far)>spread(near))bad.push(['far water busier than near',spread(far),spread(near)]);
  const mean=s=>s.reduce((m,i)=>m+(BG[i]&15),0)/s.length,dayMean=mean(day);
  const night=look(23,.35),nightMean=mean(night);
  if(!(nightMean<dayMean*.5))bad.push(['not dark at night',+nightMean.toFixed(2),+dayMean.toFixed(2)]);
  if(night.some(i=>CH[i]!==' '&&(COL[i]&15)>6&&(COL[i]>>4)===CYAN))bad.push('bright glyphs at night');
  // at dusk the moon is up in the east: looking at it, a path of brighter water under it; looking away, none
  const path=a_=>{const s=look(19.3,a_),mid=s.filter(i=>Math.abs(i%cols-cols/2)<cols*.08);return mid.filter(i=>(BG[i]>>4)===BLUE&&(BG[i]&15)>=3||CH[i]==='-').length/Math.max(1,mid.length);};
  tod=19.3;const moonAz=sunAz()+Math.PI,toward=path(moonAz),away=path(moonAz+Math.PI);
  if(!(toward>away*2+.05))bad.push(['no moon path',+toward.toFixed(3),+away.toFixed(3)]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('surf at night: the foam and the wash running up the sand still catch the moonlight',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const I=WILD_ISLANDS.find(i=>i.id==='sand'),period=typeof SWASH_T==='number'?SWASH_T:7,low=typeof SWASH_LOW==='number'?SWASH_LOW:-1;let at=null;
  for(let y=I.y;y<I.y+16&&!at;y+=.02)if(wildIslandEdge(716,y,I)<.75)at=[716,y];
  [px,py]=at;a=Math.PI/2;pitch=-.17;freecam=null;mode='walk';tod=23;
  let lit=0,dark=0;
  for(let k=0;k<12;k++){T=1400+k*period/12;env(0);render(0);
   for(let i=0;i<BG.length;i++){const t=ZB[i];if(!(t>.05&&t<2))continue;const q=2*(i%cols)/cols-1,x=px+(dx-dy*tf*q)*t,y=py+(dy+dx*tf*q)*t,band=seaShoreBand(x,y);
    if(!band?.beach||band.edge<low||band.edge>band.limit)continue;const s=islandShoreSurface(x,y,band.edge,true);
    if(s.foam||s.film||s.water){if((BG[i]&15)>=2)lit++;else dark++;}}}
  return {lit,dark};
 });
 assert.ok(r.lit>40&&r.lit>r.dark*2,JSON.stringify(r));
}));
