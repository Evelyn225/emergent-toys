'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('aquarium',{word:'AQUARIUM',ret:[100,100,0]},[12,14,-Math.PI/2]);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('the aquarium hall, tanks, tunnel and carpet paint no glyphs but their names, at several times of day',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],keep=room.props;room.props=[];
  for(const t of [26,31.7,40.2]){T=t;let g=0,n=0;const where={};
   for(const [x,y,ang,pt]of [[12,14,-1.57,.1],[12,8,-1.57,.8],[7,3,-1.57,.1],[17,9,0,.05],[3,8,3.14,0],[2.5,12.5,3.14,.1],[12,11.5,-1.57,1]]){px=x;py=y;a=ang;pitch=pt;render(0);
    for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z]/.test(c)){g++;where[c]=(where[c]||0)+1;}}}
   if(g/n>.002)bad.push(['glyph share',t,+(100*g/n).toFixed(2),where]);}
  room.props=keep;return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the tanks keep their fish, coral, kelp, sand, bubbles and rippling surface as colour, and the tunnel keeps its ribs',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=c=>c>>4;
  // sample a reef tank's glass (x=22, y=5..11 is R) across its whole face over a few seconds
  const seen=new Set();
  for(const t of [26,28,30])for(let u=5.05;u<11.95;u+=.03)for(let z=.52;z<2.38;z+=.03){T=t;BG[0]=0;tankCell(0,u,.01,z,2,0,22,5,10,'R',u);seen.add(hue(BG[0]));}
  for(const [h,name] of [[CYAN,'water'],[YEL,'sand'],[MAG,'coral'],[WHITE,'bubbles']])if(!seen.has(h))bad.push(['reef lacks',name]);
  // the surface ripples: its brightness changes over time along the top
  const surf=t=>{T=t;const s=[];for(let u=5.05;u<6;u+=.05){tankCell(0,u,.01,2.36,2,0,22,5,10,'R',u);s.push(BG[0]);}return s.join();};
  if(surf(26)===surf(26.9))bad.push('still surface');
  // kelp sways in the kelp forest
  let green=0;for(let u=18.05;u<19.95;u+=.01)for(let z=.6;z<2.3;z+=.05){T=26;tankCell(0,u,.005,z,2,1,18,4,10,'K',u);if(hue(BG[0])===GREEN)green++;}if(green<50)bad.push(['kelp',green]);
  // tunnel ribs from below at a distance still show
  px=12;py=11.5;a=-1.57;pitch=.6;render(0);let rib=0;for(let i=0;i<cols*rows;i++)if(BG[i]===C(GRAY,3))rib++;if(rib<50)bad.push(['tunnel ribs',rib]);
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
