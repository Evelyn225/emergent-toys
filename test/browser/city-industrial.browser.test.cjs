'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
test('the docks and yards: sheds, brick mills, cold stores and concrete works, each its own building in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[],sig={};
   // each kind of building, its whole face (two storeys over the ground floor) sampled: what it's made of, and no stray characters
   for(const kind of ['shed','mill','cold','works']){
    let sk=0;while(sk<60&&industrialKind(sk)!==kind)sk++;if(sk>=60){bad.push(['no '+kind]);continue;}
    const h={};let n=0,ch=0;
    for(let u=.013;u<6;u+=.021)for(let z=.002;z<1.07;z+=.009){CH[0]=' ';BG[0]=0;const done=industrialFacade(0,u,.005,z,1.07,1,true,0,0,u,null,sk+60,10,0,false);if(!done)continue;n++;if(CH[0]!==' '&&!/[A-Z0-9&]/.test(CH[0]))ch++;h[BG[0]>>4]=(h[BG[0]>>4]||0)+1;}
    sig[kind]=Object.fromEntries(Object.entries(h).map(([k,v])=>[k,+(v/n).toFixed(2)]));
    if(ch)bad.push([kind,'characters',ch]);}
   const share=(k,b)=>sig[k][b]||0;
   if(!(share('mill',BRICK)>.45))bad.push(['a mill is brick',sig.mill]);
   if(!(share('cold',WHITE)>.6))bad.push(['a cold store is white panels',sig.cold]);
   if(!(share('works',STONE)>.12&&share('works',CYAN)+share('works',WARM)>.4))bad.push(['a works is a concrete frame full of glass',sig.works]);
   if(!(share('shed',GRAY)+share('shed',ORANGE)>.5))bad.push(['a shed is corrugated sheet',sig.shed]);
   // the docks really have all four
   const seen=new Set();for(let k=0;k<N*N;k++)if(STY[k]===8&&!SHOP[k]?.architecture)seen.add(industrialKind(sk0(SEED[k])));
   if(seen.size<4)bad.push(['kinds in the docks',[...seen]]);
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
