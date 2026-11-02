'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the night market: stalls and their goods in colour, each stall its own goods, day and night',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=21;env(0);render(0);
   const bad=[];if(!STALLS.length)return {bad:['no stalls']};
   // (the strings' thin wires are line characters, drawn by the shared rod(): the rest is colour)
   for(const td of [21,14]){tod=td;env(0);let g=0,n=0;
    for(const s of STALLS){const nx=-s.s*s.fs,ny=s.c*s.fs;px=s.x+nx*.4;py=s.y+ny*.4;a=Math.atan2(s.y-py,s.x-px);pitch=0;render(0);
     for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Za-z0-9]/.test(c))g++;}}
    if(g/n>.04)bad.push([td,'glyph share',+(100*g/n).toFixed(1)]);}
   // each stall's goods on its counter, at night: several colours, no characters
   tod=21;env(0);
   const kinds=new Set();
   for(const o of STALLS){const f=SOLID_SHADE.stall(o),cols=new Set();
    for(let u=-o.hl*.9;u<o.hl*.9;u+=.0007)for(const v of [-.6,.6]){HIT.face=5;HIT.u=u;HIT.v=v*o.hw;HIT.w=o.z1;CH[0]='?';f(0,.3,10);cols.add(BG[0]>>4);if(CH[0]!==' ')bad.push(['a character on a stall',o.k,CH[0]]);}
    if(cols.size<3)bad.push(['stall goods too plain',o.k,[...cols]]);kinds.add(o.k);}
   if(kinds.size<4)bad.push(['stall kinds',[...kinds]]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
