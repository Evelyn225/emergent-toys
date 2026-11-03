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
test('industrial roofs, cranes and smokestacks: sawtooth north lights, plant, ventilators, a lattice crane and a banded stack, in colour',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{
   paused=false;mode='walk';room=me=null;freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);
   const bad=[];industrialRoofs();const all=INDUSTRIAL_ROOFS_B.flat();
   for(const k of ['saw','cold','mill'])if(!all.some(q=>k==='saw'?q.saw:!q.saw&&q.kind===k))bad.push(['no roofs of',k]);
   // from above a sawtooth roof: its glazing seen (cyan by day, warm after dark), no characters on it
   const s=all.filter(q=>q.saw)[60];
   for(const td of [14,21]){tod=td;env(0);px=s.x-1.1;py=s.y-1.3;a=Math.atan2(1.3,1.1);freecam={z:s.h+.3};pitch=-.25;render(0);
    let glaze=0;for(let i=0;i<cols*rows;i++){const b=BG[i]>>4;if(b===(td===14?CYAN:WARM))glaze++;}
    if(glaze<200)bad.push([td,'north lights barely seen',glaze]);}
   freecam=null;
   // a crane on its own: its yellow steel never a character (its ties and hook cable are wires)
   tod=14;env(0);const k=cranes[0];px=k.x-3.5;py=k.y-1;a=Math.atan2(1,3.5);pitch=.55;render(0);for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}
   k.tro=.5;k.hz=k.H-1;const [vx,vy]=R(k.x,k.y);drawCrane(k,vx,vy,.4);let yel=0,yc=0;for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET&&(BG[i]>>4)===YEL){yel++;if(CH[i]!==' '&&!'|/\\-'.includes(CH[i]))yc++;}
   if(yel<50||yc)bad.push(['crane steel',yel,yc]);
   // a smokestack on its own
   if(stacks.length){const st=stacks[0];px=st.x-2;py=st.y;a=0;pitch=.4;render(0);for(let i=0;i<cols*rows;i++){CH[i]=' ';BG[i]=BG_UNSET;ZB[i]=1e9;}const [sx,sy]=R(st.x,st.y);drawStack(st,sx,sy);let n=0,c=0;for(let i=0;i<cols*rows;i++)if(BG[i]!==BG_UNSET){n++;if(CH[i]!==' ')c++;}if(n<30||c)bad.push(['stack',n,c]);}
   return {bad};
  });
  assert.deepEqual(r.bad,[]);assert.deepEqual(errors,[]);
 }finally{await p.close();}
});
