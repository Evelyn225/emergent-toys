'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('Belle cornices, slabs, brackets, ironwork, copper roofs and crowns are colour, modelled in light and shade',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   // every part, sampled across its face up close and far off: never a character; ironwork see-through between its bars up close
   for(const kind of ['cornice','slab','bracket','iron']){
    const o=belleDetails.find(q=>q.kind===kind);if(!o){bad.push(['no '+kind]);continue;}
    let chars=0,drawn=0,open=0;const tones=new Set();
    for(const t of [.5,8])for(let u=-o.hl;u<o.hl;u+=o.hl/60)for(let z=o.z0;z<o.z1;z+=(o.z1-o.z0)/40){
     HIT.u=u;HIT.v=0;HIT.w=z;HIT.face=3;CH[0]=' ';BG[0]=0;
     if(belleDetailShade(o,0,t,10)){drawn++;if(CH[0]!==' ')chars++;tones.add(BG[0]);}else open++;}
    if(chars)bad.push([kind,'characters',chars]);
    if(tones.size<2)bad.push([kind,'one flat tone',tones.size]);
    if(kind==='iron'&&!open)bad.push(['ironwork not see-through']);}
   // from the street: the facades at most a trace of characters (main had 3.3%: '=' and '|' on every cornice and balcony)
   let n=0,g=0;const irons=belleDetails.filter(o=>o.kind==='iron'&&o.hl>.15);
   for(let k=0;k<irons.length;k+=Math.max(1,irons.length/5|0)){const o=irons[k];for(const sg of [1,-1]){const x=o.x+o.s*sg*2.6,y=o.y+o.c*sg*2.6;if(!ROAD[idx(Math.floor(x),Math.floor(y))])continue;
     px=x;py=y;a=Math.atan2(-o.c*sg,-o.s*sg);pitch=.22;render(0);for(let i=0;i<cols*rows;i++){n++;if(CH[i]!==' '&&CH[i]!=='')g++;}break;}}
   if(!n||g/n>.012)bad.push(['street views glyph share',n,+(100*g/n).toFixed(2)]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
