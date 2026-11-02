'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=14;env(0);render(0);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('upper floors across the districts are walls, windows, frames and fire escapes in colour, day and night (landmarks aside)',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],LANDMARK=new Set([3,4,5,6,20,21,22,23,25]);
  for(const td of [14,22]){tod=td;env(0);const stat={},orig=CITY.wall;
   CITY.wall=function(i,u,uStep,z,h,d,side,mx,my){const res=orig.apply(this,arguments);const k=idx(mx,my);
    if(z>=.44&&d<10&&!LANDMARK.has(STY[k])){const dist=districtOf(mx>>3,my>>3);const s=stat[dist]||(stat[dist]=[0,0]);s[1]++;if(CH[i]!==' '&&CH[i]!==''&&!/[A-Za-z0-9]/.test(CH[i]))s[0]++;}return res;};
   const seen={};
   try{for(let by=1;by<N/8-1;by++)for(let bx=1;bx<N/8-1;bx++){const dist=districtOf(bx,by);if((seen[dist]=(seen[dist]||0)+1)>5)continue;
    for(const [ox,oy,ang] of [[4,.15,Math.PI/2],[4,.15,-Math.PI/2],[.15,4,0],[.15,4,Math.PI]]){px=bx*8+ox;py=by*8+oy;if(!ROAD[idx(Math.floor(px),Math.floor(py))])continue;a=ang;pitch=.35;render(0);}}}
   finally{CITY.wall=orig;}
   for(const [k,[g,n]] of Object.entries(stat)){if(n<2000)continue;if(g/n>.04)bad.push([td,k,'glyph share',+(100*g/n).toFixed(1)]);}
   if(Object.keys(stat).length<6)bad.push(['districts seen',Object.keys(stat)]);
  }
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('a window has a frame, a sill and glass that reflects the sky; corrugated sheet ribs up close and settles far off; a lit room paints no characters',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=c=>c>>4,at=(a,z,lit=false,fp=.002)=>{BG[0]=0;CH[0]='?';const hit=facadeWindow(0,a,.1,z,.2,lit,WARM,10,fp,STONE,3);return {hit,bg:BG[0],ch:CH[0]};};
  const sill=at(.05,-.004),frame=at(-.004,.1),low=at(.02,.02),high=at(.02,.18),litG=at(.02,.1,true),off=at(.05,-.05);
  if(hue(sill.bg)!==STONE||hue(frame.bg)!==STONE)bad.push(['frame or sill',sill,frame]);
  if(hue(low.bg)!==CYAN||!((high.bg&15)>(low.bg&15)))bad.push(['glass reflection',low,high]);
  if(hue(litG.bg)!==WARM)bad.push(['lit glass',litG]);if(off.hit)bad.push('drew outside the window');
  for(const c of [sill,frame,low,high,litG])if(c.ch!==' ')bad.push(['a character on a window',c.ch]);
  const rib=fp=>{const s=new Set();for(let a=0;a<.05;a+=.0005){corrugated(0,a,GRAY,10,fp);s.add(BG[0]);}return s.size;};
  if(!(rib(.001)>=2&&rib(.05)===1))bad.push(['corrugation',rib(.001),rib(.05)]);
  let chars=0;for(let u=0;u<.33;u+=.005)for(let z=.4;z<.73;z+=.005){WH.sl=.3;WH.dn=.3;WH.wc=u;eye=.17;CH[0]=' ';litRoom(0,u,z,0,.33,.4,.73,WARM,10,7);if(CH[0]!==' ')chars++;}
  if(chars)bad.push(['characters in a lit room',chars]);
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
