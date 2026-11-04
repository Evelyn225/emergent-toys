'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('residential planting: mounted window boxes, soil and rims, rounded seasonal foliage',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const result=await p.evaluate(()=>{
   tod=14;env(0);render(0);
   const bad=[],pots=ARCH_DETAILS.filter(o=>o.kind==='planter'),boxes=pots.filter(o=>o.windowBox);
   if(!boxes.length)bad.push('no window boxes');
   if(!pots.some(o=>!o.windowBox))bad.push('no balcony pots');
   const sample=(o,u,v,z,face)=>{HIT.u=u;HIT.v=v;HIT.w=z;HIT.face=face;CH[0]='?';residentialDetailShade(o,0,.5,10);if(CH[0]!==' ')bad.push('surface character');return BG[0];};
   for(const o of pots.slice(0,40).concat(boxes.slice(0,40))){
    const soil=sample(o,0,0,o.z1,5),rim=sample(o,o.hl-.002,0,o.z1,5),side=sample(o,0,0,o.z1-.005,3);
    if((soil&15)>=(rim&15)||soil===side)bad.push('missing recessed soil/rim');
    const leaves=ARCH_DETAILS.filter(q=>q.kind==='leaves'&&q.ownerCell===o.ownerCell&&Math.abs(q.z0-o.z1+.008)<1e-6&&Math.hypot(q.x-o.x,q.y-o.y)<o.hl*2);
    if(leaves.length<3)bad.push('missing foliage clumps');
    if(o.windowBox){const supports=ARCH_DETAILS.filter(q=>q.kind==='planter-bracket'&&q.ownerCell===o.ownerCell&&Math.abs(q.z0-o.z0+.016)<1e-6&&Math.hypot(q.x-o.x,q.y-o.y)<o.hl*2);if(supports.length<2)bad.push('unsupported window box');}
   }
   const leaf=ARCH_DETAILS.find(o=>o.kind==='leaves');
   for(const td of [14,22])for(const sn of [0,1,2,3]){tod=td;env(0);setSeason(sn);
    const lower=sample(leaf,0,0,leaf.z0+(leaf.z1-leaf.z0)*.2,3),upper=sample(leaf,0,0,leaf.z0+(leaf.z1-leaf.z0)*.8,3);
    if(td===14&&!(upper%16>lower%16))bad.push('foliage not lit above');
    if((upper>>4)!==(sn===2?ORANGE:GREEN))bad.push('wrong seasonal foliage');
   }
   const oldSnow=snowCover,exposed={...leaf,x:GARDEN.x0+3,y:GARDEN.y0+3};
   HIT.u=HIT.v=0;HIT.w=leaf.z1;HIT.face=0;HIT.nz=1;
   snowCover=0;residentialDetailShade(exposed,0,.5,10);const bare=BG[0];
   snowCover=1;residentialDetailShade(exposed,0,.5,10);if(BG[0]===bare)bad.push('snow missing from exposed foliage crown');
   snowCover=oldSnow;HIT.nz=0;
   // The actual renderer must use curved clumps, with empty corners and a visible centre.
   tod=14;env(0);setSeason(1);paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;
   let curved=0,flat=0;const original=drawBox;
   try{drawBox=function(o,shade,ray){if(o.kind==='leaves'){if(ray===homeRayEllipsoid)curved++;else flat++;}return original(o,shade,ray);};
    px=leaf.x+leaf.nx*.65;py=leaf.y+leaf.ny*.65;a=Math.atan2(-leaf.ny,-leaf.nx);pitch=.15;render(0);
   }finally{drawBox=original;}
   if(!curved||flat)bad.push(['foliage renderer',curved,flat]);
   return {bad,pots:pots.length,boxes:boxes.length};
  });
  assert.deepEqual(result.bad,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
