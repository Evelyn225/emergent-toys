'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
// (the rooms with bathrooms are in here too: their tile is shared)
const SHOPS=['jeweler','tobacco','deli','delicatessen','thrift','tattoo','gacha','tireshop','florist','petshop','pawn','toys','antiques','sports','welding','tailor','herbs','records'];
test('a shop with its props taken out is walls, floor and ceiling with barely a glyph left, and those are its lettering',()=>fixture(async p=>{
 const r=await p.evaluate(SHOPS=>{
  const bad=[];
  for(const kind of SHOPS){
   enterRoom(kind,{word:kind.toUpperCase(),neon:CYAN,ret:[100,100,0],cell:[10,10]},ROOM_DEFS[kind].entry||[3,3,0]);
   room.props=[];const W=room.W,H=room.H;let g=0,n=0;const stray={};
   for(const [x,y]of [[1.6,1.6],[W-1.6,1.6],[1.6,H-1.6],[W-1.6,H-1.6]]){
    px=x;py=y;a=Math.atan2(H/2-y,W/2-x);pitch=0;render(0);
    for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''){g++;if(!/[A-Za-z0-9#]/.test(c))stray[c]=(stray[c]||0)+1;}}
   }
   // (a stray cell or two is punctuation on a sign, like the hyphen in WALK-INS)
   if(Object.values(stray).reduce((t,v)=>t+v,0)>8)bad.push([kind,'painted marks',stray]);
   if(g/n>.06)bad.push([kind,'glyph share',+(100*g/n).toFixed(1)]);
  }
  return{bad};
 },SHOPS);
 assert.deepEqual(r.bad,[]);
}));
test('each shop keeps its character: mirrors, gilt, tanks, fish, ink, hazard stripes, and finishes that settle far off',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],enter=kind=>enterRoom(kind,{word:kind.toUpperCase(),neon:CYAN,ret:[100,100,0],cell:[10,10]},ROOM_DEFS[kind].entry||[3,3,0]);
  const at=(fn,u,z,mx,my,d=2,step=.001)=>{fn(0,u,step,z,d,mx,my,8);return BG[0];},hue=c=>c>>4;
  enter('jeweler');if(hue(at(jewelWall,.8,1.5,1,3))!==CYAN)bad.push('jeweler mirror');if(hue(at(jewelWall,.8,2.3,1,3))!==YEL)bad.push('jeweler gilt');if(hue(at(jewelWall,0,1.5,1,3))!==RED)bad.push('jeweler velvet');
  enter('petshop');if(hue(at(petWall,.8,1.2,1,3))!==BLUE&&hue(at(petWall,.5,1.5,1,3))!==BLUE)bad.push('pet tank');
  const frames=new Set();const t0=T;for(let k=0;k<200;k++){T=t0+k*.1;frames.add(at(petWall,2.3,1.357,1,3));}T=t0;if(frames.size<2)bad.push('no fish swim past');
  enter('tireshop');const stripes=new Set();for(let u=.02;u<1;u+=.03)stripes.add(hue(at(tyreWall,u,.5,3,3)));if(!stripes.has(YEL)||stripes.size<2)bad.push('hazard stripes');
  const farStripes=new Set();for(let u=.02;u<3;u+=.03)farStripes.add(at(tyreWall,u,.5,3,3,20,.3));if(farStripes.size!==1)bad.push('hazard stripes alias far off');
  enter('florist');const near=new Set();for(let u=.02;u<3;u+=.07)for(let z=.2;z<2.2;z+=.07)near.add(at(floristWall,u,z,1,3,1));if(near.size<3)bad.push('florist has no vines');
  const far=new Set();for(let u=.02;u<3;u+=.07)for(let z=.2;z<2.2;z+=.07)far.add(at(floristWall,u,z,1,3,12,.1));if(far.size!==1)bad.push('florist vines shimmer far off');
  if(floristWall(0,1,.001,2.5,2,1,3,8)!==false||floristWall(0,1,.001,1,2,1,0,8)!==false)bad.push('florist took the back wall or the frieze');
  enter('tattoo');if(hue(at(tattooWall,room.W/2,2.6,5,0))!==MAG)bad.push('neon glow lost');
  flashSheet(0,.3,.3,.7,.9,3,8);if(CH[0]!==' ')bad.push('flash glyph');
  koiMural(0,7.4,1.8,8);if(CH[0]!==' '||![ORANGE,WHITE].includes(hue(BG[0])))bad.push('koi body');
  enter('toys');if(toyBoxWall(0,.1,.2,8,3)&&CH[0]!==' ')bad.push('toy box glyph');
  // the shared front window, by day and at night
  enter('tailor');const window=()=>{frontWindow(0,-.8,.001,1.5,2,room.H-1,8);return BG[0];};const dayGlass=window();if(CH[0]!==' ')bad.push('window glyph');if(hue(dayGlass)!==BLUE)bad.push('window glass');
  frontWindow(0,-.01,.001,1.5,2,room.H-1,8);if(hue(BG[0])!==GRAY)bad.push('window mullion');
  if(frontWindow(0,-.8,.001,1.5,2,3,8)!==false)bad.push('window on a side wall');
  return{bad};
 });
 assert.deepEqual(r.bad,[]);
}));
