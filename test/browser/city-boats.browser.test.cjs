'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('boats are colour: speedboats, sailboats, cruisers, tugs, the ferry and the swan boats, by day and after dark, moored and underway',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];
   const clear=()=>{for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}};
   const count=()=>{let n=0,ch=0;for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){n++;if(CH[i]!==' '&&!/[A-Za-z0-9 ]/.test(CH[i]))ch++;}return [n,ch];}; // (her name on the transom is lettering)
   for(const td of [14,22]){tod=td;env(0);
    for(const kind of ['speedboat','sailboat','cruiser','tug','ferry'])for(const [turn,moving] of [[.4,0],[2.6,1]]){
     px=0;py=0;a=0;pitch=.1;render(0);clear();
     const b={kind,col:kind==='tug'?RED:kind==='cruiser'?BLUE:WHITE,name:'Second Wind'};drawBoat3D(b,1.2,.15,Math.cos(turn),Math.sin(turn),moving);
     const [n,ch]=count();if(n<60)bad.push([kind,td,turn,'barely drawn',n]);if(ch)bad.push([kind,td,turn,'characters',ch]);}
    px=0;py=0;a=0;pitch=.1;render(0);clear();drawSwanBoat(.5,.05,Math.cos(.8),Math.sin(.8));const [n,ch]=count();if(n<20)bad.push(['swan boat barely drawn',n]);if(ch)bad.push(['swan boat characters',ch]);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
