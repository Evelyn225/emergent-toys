'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;T=10;tod=12;snowCover=0;env(0);render(0);money=20000;buy('home_belle');const h=owned.homes.find(h=>h.kind==='home_belle');enterRoom('bellehome',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},[18,12.5,0]);});
 await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('Belle deck is a cached closed slab at the physical balcony edges and floor height, with supported native/world joins',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof homeBalconyDeckModel!=='function')return ['no measured deck model'];const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);},h=homeRecord(),b=homeBalconyBounds(h),draw=drawBox;
  const capture=()=>{let out;drawBox=(box,shade,ray=rayBox)=>out={b:{...box},ref:box,shade,ray};try{drawHomeBalconyDeck(h,b);}finally{drawBox=draw;}return out;};
  px=b.x0+.3;py=b.y;const A=capture(),m=homeBalconyDeckModel(h,b);px+=.02;py+=.03;const B=capture(),q=B.b;
  check(A.ref===B.ref&&A.shade===B.shade&&m===homeBalconyDeckModel(h,{...b}),'deck bounds/material rebuilt per frame');
  check(Math.abs(q.x-q.hl+px-b.x0)<1e-8&&Math.abs(q.x+q.hl+px-b.x1)<1e-8&&Math.abs(q.y-q.hw+py-b.y0)<1e-8&&Math.abs(q.y+q.hw+py-b.y1)<1e-8,'deck slab differs from physical edges');
  check(q.z1===b.z&&Math.abs(q.z0-b.z+.025)<1e-8,'deck walking height or25cm thickness changed');
  const z=(q.z0+q.z1)/2;
  for(const[face,O,D]of [[1,[q.x+q.hl+.1,q.y,z],[-1,0,0]],[2,[q.x-q.hl-.1,q.y,z],[1,0,0]],[3,[q.x,q.y+q.hw+.1,z],[0,-1,0]],[4,[q.x,q.y-q.hw-.1,z],[0,1,0]],[5,[q.x,q.y,q.z1+.1],[0,0,-1]],[6,[q.x,q.y,q.z0-.1],[0,0,1]]]){
   const t=B.ray(...O,...D,q);check(t>0&&Math.abs(t-.1)<1e-8&&HIT.face===face,'slab has an open or displaced face');
   B.shade(0,t,12);check(CH[0]===' '&&BG[0]!==NONE,'slab uses noisy repeated glyphs or transparent faces');
  }
  const changed=homeBalconyDeckModel(h,{...b,z:b.z+.1});check(changed!==m&&Math.abs(changed.local.z1-b.z-.1)<1e-8,'deck height cache stays stale');
  const widened=homeBalconyDeckModel(h,{...b,x1:b.x1+.1});check(Math.abs(widened.local.hl-(b.x1+.1-b.x0)/2)<1e-8,'deck extent cache stays stale');
  homeBalconyDeckModel(h,b);
  // home is already owned in this fixture: the existing world surface must
  // remain exactly the slab's top and still end at its east edge.
  check(homeBalconyHeight(b.x0+.3,b.y)===b.z&&homeBalconyHeight(b.x1+.01,b.y)===0,'deck painting changed world floor bounds');
  return bad;
 });assert.deepEqual(r,[]);
}));

test('real home floor and city slab use matching metre paving, filter grazing joints and keep snow fixed in world coordinates',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof homeBalconyPaving!=='function')return ['no shared paving'];const bad=[],check=(ok,why)=>{if(!ok)bad.push(why);},h=homeRecord(),b=homeBalconyBounds(h),m=homeBalconyDeckModel(h,b),paving=homeBalconyPaving,snowPaint=paintSettledSnow;
  let sample,snowCalls=[];
  homeBalconyPaving=(i,u,v,L,fp)=>{sample={u,v,L,fp};return paving(i,u,v,L,fp);};
  paintSettledSnow=(i,x,y,L,exposure,wear,z)=>{snowCalls.push([x,y,z]);return snowPaint(i,x,y,L,exposure,wear,z);};
  try{
   projX=100;projY=60;hor=0;const row=59,i=row*cols,d=1.7*projY/(row+.5);
   for(const[x,y,threshold]of [[21,10.25,false],[21.25,10.25,false],[21.499,10.01,false],[19.5,12.5,true]]){
    mode='room';eye=1.7;px=threshold?x-d:x;py=threshold?y:y+d;sample=null;
    roomFloor(i,row,0,threshold?1:0,threshold?0:-1);const native={...sample,bg:BG[i],ch:CH[i]};
    check(sample&&Math.abs(sample.u-(x-19))<1e-8&&Math.abs(sample.v-(y-3))<1e-8,'native paving misses its deck/threshold coordinates');
    mode='roof';eye=b.z+.17;HIT.face=5;HIT.u=(x-19)/10-m.local.hl;HIT.v=(y-3)/10-m.local.hw;HIT.w=b.z;
    m.shade(i,d/10,native.L);check(Math.abs(sample.u-native.u)<1e-8&&Math.abs(sample.v-native.v)<1e-8&&Math.abs(sample.fp-native.fp)<1e-8&&BG[i]===native.bg&&CH[i]===native.ch,'city paving uses a different size/phase/filter or material');
    const first={...sample};px+=.07;py+=.03;m.shade(i,d/10,native.L);check(sample.u===first.u&&sample.v===first.v,'paving swims with the camera');
   }
   const near=new Set(),far=new Set();for(let k=0;k<100;k++){paving(0,k*.005,.25,13,.001);near.add(BG[0]);check(CH[0]===' ','paving draws repeated text');paving(0,k*.005,.25,13,.8);far.add(BG[0]);}
   check(near.size>1&&far.size===1,'fine grout is missing nearby or aliases far away');
   check(homeBalconyPavingFootprint(2,.1)>homeBalconyPavingFootprint(2,1.7)*2,'grazing row footprint is ignored');
   snowCover=1;eye=b.z+.17;HIT.face=5;HIT.u=0;HIT.v=0;HIT.w=b.z;snowCalls=[];m.shade(0,.2,12);
   check(BG[0]>>4===WHITE&&snowCalls.length===1&&Math.abs(snowCalls[0][0]-m.x)<1e-8&&Math.abs(snowCalls[0][1]-m.y)<1e-8&&snowCalls[0][2]===b.z,'settled snow lost its actual top surface');
   const first=snowCalls[0];px+=.03;py+=.04;m.shade(0,.2,12);check(first&&snowCalls[1]&&snowCalls[1].every((v,k)=>v===first[k]),'snow moves with the view');
   const n=snowCalls.length;HIT.face=1;m.shade(0,.2,12);check(snowCalls.length===n,'snow paints a vertical slab face');
  }finally{homeBalconyPaving=paving;paintSettledSnow=snowPaint;snowCover=0;}
  return bad;
 });assert.deepEqual(r,[]);
}));

test('native deck ends at the real rail edge, renders both top and underside, and retains walking and return through the doors',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  if(typeof homeBalconyPaving!=='function')return ['no bounded paving'];const bad=[],floor=ROOMW.floor,outside=homeOutdoorRay,paving=homeBalconyPaving,draw=drawBox;let inFloor=false,outsideCalls=0,overhang=0;
  ROOMW.floor=(...args)=>{inFloor=true;try{return floor(...args);}finally{inFloor=false;}};
  homeOutdoorRay=(...args)=>{if(inFloor)outsideCalls++;return outside(...args);};
  homeBalconyPaving=(i,u,v,...rest)=>{if(inFloor&&u>=6)overhang++;return paving(i,u,v,...rest);};
  try{px=24.4;py=10;freecam={z:2.5};a=0;pitch=0;render(0);pitch=-2.5/(25.5-px)*projY/rows;render(0);if(!free(px,py)||overhang||outsideCalls<5)bad.push(['floor extends past the native rail instead of showing the city',overhang,outsideCalls]);}
  finally{ROOMW.floor=floor;homeOutdoorRay=outside;homeBalconyPaving=paving;freecam=null;}
  px=18.3;py=12.5;for(let k=0;k<16&&mode==='room';k++)move(.1,0);if(!homeBalconyActive())return ['cannot walk to actual deck'];
  const b=room.balconyWorld,h=homeRecord();let views=0;
  try{for(const side of ['top','bottom']){
   if(side==='top'){px=b.x0+.3;py=b.y+.2;freecam={z:b.z+.17};a=-Math.PI/2;pitch=0;render(0);pitch=-.17/.2*projY/rows;}
   else{px=b.x1+.15;py=b.y;freecam={z:b.z-.08};a=Math.PI;pitch=0;render(0);pitch=.055/.4*projY/rows;}
   render(0);const m=homeBalconyDeckModels.get(h);if(!m){bad.push('deck is absent from real city renderer');continue;}
   let paints=0;drawBox=(box,shade,ray)=>draw(box,box===m.view?(i,t,L)=>{const hit=shade(i,t,L);if(hit&&HIT.face===(side==='top'?5:6)){paints++;BG[i]=C(MAG,15);}return hit;}:shade,ray);
   render(0);if(paints<20||Array.from(BG).filter(c=>c===C(MAG,15)).length<20)bad.push([side,'native deck surface invisible',paints]);views++;drawBox=draw;
  }}finally{drawBox=draw;freecam=null;}
  px=b.x0+.3;py=b.doorY;for(let k=0;k<32&&mode==='roof';k++)move(-.01,0);if(mode!=='room'||!free(px,py))bad.push('paving changed walking return');
  return {bad,views};
 });assert.deepEqual(r.bad,[]);assert.equal(r.views,2);
}));
