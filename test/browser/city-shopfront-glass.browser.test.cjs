'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(s=>{window.SHOW_SHARES=s;paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);},!!process.env.SHOW_SHARES);
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('brownstone, midtown, downtown and housing shopfronts are glass, frames and coursing in colour, from the street, day and night',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];
  for(const td of [14,22]){tod=td;env(0);const stat={},orig=CITY.wall;
   CITY.wall=function(i,u,uStep,z,h,d,side,mx,my){const res=orig.apply(this,arguments);const sh=SHOP[idx(mx,my)];
    if(z<.44&&d<6&&sh?.architecture){const k=sh.architecture.profile?'housing':sh.architecture.region;const s=stat[k]||(stat[k]=[0,0]);s[1]++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Za-z0-9]/.test(CH[i]))s[0]++;}return res;};
   const seen={};
   try{for(let by=1;by<N/8-1;by++)for(let bx=1;bx<N/8-1;bx++){const dist=districtOf(bx,by);if(!['brownstones','midtown','downtown'].includes(dist)||(seen[dist]=(seen[dist]||0)+1)>5)continue;
    for(const [ox,oy,ang] of [[4,.15,Math.PI/2],[4,.15,-Math.PI/2],[.15,4,0],[.15,4,Math.PI]]){px=bx*8+ox;py=by*8+oy;if(!ROAD[idx(Math.floor(px),Math.floor(py))])continue;a=ang;pitch=0;render(0);}}}
   finally{CITY.wall=orig;}
   for(const [k,[g,n]] of Object.entries(stat)){if(n<2000)continue;if(g/n>.025||window.SHOW_SHARES)bad.push([td,k,'glyph share',+(100*g/n).toFixed(1)]);}
   if(Object.keys(stat).length<3)bad.push(['families seen',Object.keys(stat)]);
  }
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('glazing bars and door stiles show up close and settle into the glass far off; door glass stays glass',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=c=>c>>4,cells=fp=>{const s=new Set();for(let du=-.1;du<.1;du+=.0013)for(let z=.13;z<.3;z+=.0021){brownstoneWindow(0,du,z,.1,.13,.3,false,8,STONE,fp);s.add(hue(BG[0]));}return s;};
  const near=cells(.002),far=cells(.08);
  if(!near.has(STONE)||!near.has(CYAN))bad.push(['near window',[...near]]);
  // far off the bars are thinner than a cell: only the frame round the edge is stone, the bars don't break the glass up
  let farBars=0;for(let z=.15;z<.28;z+=.002){brownstoneWindow(0,0,z,.1,.13,.3,false,8,STONE,.08);if(hue(BG[0])===STONE)farBars++;}
  if(farBars)bad.push(['bars far off',farBars]);
  const door=fp=>{const s=new Set();for(let du=-.05;du<.05;du+=.001)for(let z=.04;z<.25;z+=.003){doorGlass(0,du,z,true,8,STONE,fp);s.add(hue(BG[0]));}return s;};
  if(!door(.002).has(STONE))bad.push('no stiles up close');if(door(.05).has(STONE))bad.push('stiles break the glass far off');
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('Chinatown, the Shotengai, Belle and the generic and industrial fronts are colour on the ground floor too (landmarks aside)',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],LANDMARK=new Set([3,4,5,6,20,21,22,23,25]);
  for(const td of [14,22]){tod=td;env(0);const stat={},orig=CITY.wall;
   CITY.wall=function(i,u,uStep,z,h,d,side,mx,my){const res=orig.apply(this,arguments);const k=idx(mx,my);
    if(z<.44&&d<6&&!SHOP[k]?.architecture&&!LANDMARK.has(STY[k])){const dist=districtOf(mx>>3,my>>3);const s=stat[dist]||(stat[dist]=[0,0]);s[1]++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Za-z0-9]/.test(CH[i]))s[0]++;}return res;};
   const seen={};
   try{for(let by=1;by<N/8-1;by++)for(let bx=1;bx<N/8-1;bx++){const dist=districtOf(bx,by);if(!['chinatown','shotengai','belle','industrial','midtown'].includes(dist)||(seen[dist]=(seen[dist]||0)+1)>5)continue;
    for(const [ox,oy,ang] of [[4,.15,Math.PI/2],[4,.15,-Math.PI/2],[.15,4,0],[.15,4,Math.PI]]){px=bx*8+ox;py=by*8+oy;if(!ROAD[idx(Math.floor(px),Math.floor(py))])continue;a=ang;pitch=0;render(0);}}}
   finally{CITY.wall=orig;}
   for(const [k,[g,n]] of Object.entries(stat)){if(n<2000)continue;if(g/n>.04||window.SHOW_SHARES)bad.push([td,k,'glyph share',+(100*g/n).toFixed(1)]);}
   if(Object.keys(stat).length<4)bad.push(['districts seen',Object.keys(stat)]);
  }
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
