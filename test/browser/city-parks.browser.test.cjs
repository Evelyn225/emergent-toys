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
test('Botanical Gardens: lawns, beds, gravel, lake, jetty, pens, picnic blanket, railings and glasshouses in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],views=[[3,3,.6],[11,7,0],[8,10,4.2],[15,4,2.5],[5,11,-.8],[18,10,3.6],[1.5,1,2.4]];
   // every kind of ground is there to be seen
   const kinds=new Set();for(let gx=0;gx<GARDEN.w;gx+=.05)for(let gy=0;gy<GARDEN.h;gy+=.05)kinds.add(gardenSurface(gx,gy).kind);
   for(const k of ['lawn','gravel','bed','lake','reeds','jetty','bear','tortoise'])if(!kinds.has(k))bad.push(['no '+k]);
   for(const td of [14,22]){tod=td;env(0);let g=0,n=0,gg=0,gn=0;
    for(const [gx,gy,ang] of views){px=GARDEN.x0+gx;py=GARDEN.y0+gy;a=ang;pitch=-.12;render(0);
     for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!=='')g++;}
     for(let rr=Math.ceil(hor)+2;rr<rows;rr++)for(let c=0;c<cols;c++){const i=rr*cols+c;if(FL[i]===0)continue;gn++;if(CH[i]!==' '&&CH[i]!=='')gg++;}}
    if(gg/gn>.012)bad.push([td,'gardens ground glyph share',+(100*gg/gn).toFixed(1)]);
    if(g/n>.04)bad.push([td,'gardens views glyph share',+(100*g/n).toFixed(1)]);}
   // sat on the grass: a gingham blanket in front of you, three tones, no characters
   tod=14;env(0);px=GARDEN.x0+3;py=GARDEN.y0+3;a=.6;pitch=-.9;body.seat={grass:true,x:px,y:py,fx:Math.cos(a),fy:Math.sin(a)};render(0);
   const tones=new Set();let bc=0;for(let i=0;i<cols*rows;i++)if((BG[i]>>4)===RED||(BG[i]>>4)===WHITE&&FL[i]!==0){tones.add(BG[i]);if(CH[i]!==' ')bc++;}
   body.seat=null;
   if(tones.size<3||bc)bad.push(['picnic blanket',tones.size,bc]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
