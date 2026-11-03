'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('parks: lawns, paths, reeds, ponds and trees in colour, lit and shaded, day and night',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],parks=[];for(let by=1;by<N/8-1&&parks.length<3;by++)for(let bx=1;bx<N/8-1&&parks.length<3;bx++)if(blockKind(bx,by)==='park'&&!inSkatepark(bx*8+3,by*8+3))parks.push([bx*8+3,by*8+5]);
   if(!parks.length)return {bad:['no park']};
   for(const td of [14,22]){tod=td;env(0);let g=0,n=0;
    for(const [x,y] of parks)for(const ang of [-.6,.4,2]){px=x;py=y;a=ang;pitch=-.12;render(0);
     for(let rr=Math.ceil(hor)+2;rr<rows;rr++)for(let c=0;c<cols;c++){const i=rr*cols+c;if(FL[i]===0)continue;n++;if(CH[i]!==' '&&CH[i]!=='')g++;}}
    if(g/n>.03)bad.push([td,'park ground glyph share',+(100*g/n).toFixed(1)]);}
   // a tree: no characters anywhere on it, and its canopy lighter on top than underneath
   tod=14;env(0);const t=trees.find(q=>q.kind==='oak')||trees.find(q=>q.kind!=='pine');let chars=0,top=0,topN=0,low=0,lowN=0;
   const hits=[];for(let u=-.6;u<.6;u+=.004)for(let z=.02;z<1.2;z+=.004){CH[0]=' ';BG[0]=0;if(!treeCell(0,u,z,.002,.002,10,t))continue;if(CH[0]!==' ')chars++;if(z>.34)hits.push([z,BG[0]&15]);}
   const zs=hits.map(h=>h[0]),z0=Math.min(...zs),z1=Math.max(...zs),span=z1-z0;for(const [z,l] of hits){if(z>z1-span/3){top+=l;topN++;}else if(z<z0+span/3){low+=l;lowN++;}}
   if(chars)bad.push(['characters on a tree',chars]);if(!(topN&&lowN&&top/topN>low/lowN))bad.push(['canopy not lit from above',top/topN,low/lowN]);
   // bare in winter: branches as colour
   const was=seasonShift;let wchars=0,wcells=0;try{setSeason(3);for(let u=-.25;u<.25;u+=.004)for(let z=.02;z<.95;z+=.004){CH[0]=' ';if(treeCell(0,u,z,.002,.002,10,t)){wcells++;if(CH[0]!==' ')wchars++;}}}finally{seasonShift=was;}
   if(!wcells||wchars)bad.push(['winter branches',wcells,wchars]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
