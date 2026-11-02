'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('conservatory',{word:'CONSERVATORY',neon:CYAN,ret:[100,100,0],cell:[10,10]},[7,14.4,-Math.PI/2]);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
test('the glasshouse shell paints no glyphs: glazing, plinth, waterfall, divider displays, sand, pool, boardwalk and roof, day and night',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],W=room.W,H=room.H,keep=room.props;room.props=keep.filter(o=>o.consFrame);
  for(const td of [12,23]){tod=td;env(0);let g=0,n=0;const where={};
   for(const [x,y,ang,pt]of [[7,14.4,-1.57,.1],[2,13,-.6,.15],[20,13,-1.9,.1],[10,4,0,.1],[6.5,6,-1.57,.4],[18,4,-2.6,.8],[3,7,.3,-.6]]){px=x;py=y;a=ang;pitch=pt;render(0);
    for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z&]/.test(c)){g++;where[c]=(where[c]||0)+1;}}}
   if(g/n>.005)bad.push(['glyph share',td,+(100*g/n).toFixed(2),where]);}
  room.props=keep;return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the glazing bars are built on the walls above the plinth, leave the waterfall clear, and the roof has ribs',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],f=room.props.find(o=>o.consFrame),h=room.def.height;
  if(!f)return {bad:['no frame']};if(!f.walk||f.box)bad.push('frame blocks');
  const boxes=f.consFrame.boxes,bars=boxes.filter(b=>b.z0===CONS_GLAZE.plinth&&b.z1===h);
  if(bars.length<60)bad.push(['bars',bars.length]);
  const fall=[CONS_FALL.x-CONS_FALL.half-.25,CONS_FALL.x+CONS_FALL.half+.25];
  for(const b of boxes){const onNorth=b.y-b.hw<1.2&&b.z0<h-.5;if(onNorth&&b.x+b.hl>fall[0]&&b.x-b.hl<fall[1])bad.push(['steel across the falls',b.x,b.z0]);}
  const ribs=boxes.filter(b=>b.z1===h&&b.z0>h-.3&&(b.hl>5||b.hw>5));if(ribs.length<15)bad.push(['roof ribs',ribs.length]);
  // the boardwalk stays walkable, the pool blocks
  if(!free(6.5,6))bad.push('boardwalk blocked');if(!room.def.block(CONS_POOL.x,CONS_POOL.y))bad.push('pool walkable');
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the waterfall falls in strands that move, and its detail settles with distance',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],sample=(d,t)=>{T=t;const out=new Set();for(let u=CONS_FALL.x-.5;u<CONS_FALL.x+.5;u+=.05){BG[0]=0;conservatoryWall(0,u,.001,1.5,d,6,0,10);out.add(BG[0]);}return out;};
  const near=sample(2,26),later=sample(2,26.13),far=sample(40,26);
  if(near.size<2)bad.push('no strands up close');if([...near].join()===[...later].join())bad.push('the falls are still');
  if(![...near].every(c=>c>>4===CYAN))bad.push('not water');if(far.size>near.size)bad.push('busier far off');
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('the planting is built: palms, ferns, bananas, saguaros, barrels, agaves and rocks as shaped models, under 1% glyphs with everything in',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],W=room.W,H=room.H,plants=room.props.filter(o=>o.consPlant),count={};
  if(room.props.some(o=>o.art))bad.push('a sprite is left');
  for(const o of plants)count[o.consPlant.kind]=(count[o.consPlant.kind]||0)+1;
  const want={palm:7,fern:8,banana:3,saguaro:6,barrel:6,agave:3,rock:3};
  for(const k in want)if(count[k]!==want[k])bad.push(['count',k,count[k]]);
  for(const o of plants){const {kind,heightM}=o.consPlant,blocks=!!o.box&&!o.walk;
   if((['palm','banana','saguaro','barrel','rock'].includes(kind))!==blocks)bad.push(['collision',kind,o.x,o.y]);
   if(inConsPool(o.x,o.y))bad.push(['in the pool',kind,o.x,o.y]);
   if((o.x>13)!==['saguaro','barrel','agave','rock'].includes(kind))bad.push(['wrong house',kind,o.x]);
   if(o.box&&o.box.z1>heightM+.01)bad.push(['collision above the plant',kind]);}
  // drawn as shaped animals, at the size they're meant to be
  const seen=[],df=drawFigure;drawFigure=(vx,vy,z,h,fx,fy,look)=>seen.push({h,look});
  try{for(const o of plants)o.draw(o.x-px,o.y-py,o);}finally{drawFigure=df;}
  if(seen.length!==plants.length)bad.push(['drawn',seen.length]);
  plants.forEach((o,k)=>{const s=seen[k],u=PLANT_UNITS[o.consPlant.kind];if(!s||Math.abs(s.h/FIG_TALL*u-o.consPlant.heightM)>1e-6||s.look!==PLANT_LOOKS[o.consPlant.kind])bad.push(['size or look',o.consPlant.kind]);});
  // the lizard still basks on its rock's top
  const rock=plants.find(o=>o.consPlant.kind==='rock'&&Math.hypot(o.x-19.5,o.y-4.4)<.01),liz=room.props.find(o=>o.tick&&Math.abs(o.z-.42)<1e-6);
  if(!rock||!liz||rock.box.z1>liz.z||liz.z-rock.box.z1>.1)bad.push(['lizard and rock',rock?.box?.z1,liz?.z]);
  // and with everything in, still glyph-free
  let g=0,n=0;for(const [x,y,ang,pt]of [[7,14.4,-1.57,.1],[2,13,-.6,.15],[20,13,-1.9,.1],[9,9,-2.4,.2],[18,4,-2.6,.3]]){px=x;py=y;a=ang;pitch=pt;render(0);
   for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z&]/.test(c))g++;}}
  if(g/n>.01)bad.push(['glyph share',+(100*g/n).toFixed(2)]);
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
