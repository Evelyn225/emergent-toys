'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
 const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);
   enterRoom('cathedral',{word:'CATHEDRAL',ret:[100,100,0]},[11,37,-Math.PI/2]);});
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
const VIEWS=[[11,37,-1.57,.15],[3,20,0,.1],[11,20,-1.57,.7],[17,30,-2.5,.05],[11,10,1.57,.2],[11,6,-1.57,.3]];
test('the nave paints no glyphs on its stone, glass, rose, organ, doors, vault or floor, day and night',()=>fixture(async p=>{
 const r=await p.evaluate(VIEWS=>{
  const bad=[],keep=room.props;room.props=keep.filter(o=>o.cathPillar);
  for(const td of [12,23]){tod=td;env(0);let g=0,n=0;const where={};
   for(const [x,y,ang,pt]of VIEWS){px=x;py=y;a=ang;pitch=pt;render(0);
    for(let i=0;i<cols*rows;i++){n++;const c=CH[i];if(c!==' '&&c!==''&&!/[A-Z]/.test(c)){g++;where[c]=(where[c]||0)+1;}}}
   if(g/n>.002)bad.push(['glyph share',td,+(100*g/n).toFixed(2),where]);}
  room.props=keep;return {bad};
 },VIEWS);
 assert.deepEqual(r.bad,[]);
}));
test('fourteen round clustered pillars stand on the floor up to the vault, block like the old piers, and carry a gilt capital at 7 m',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],ps=room.props.filter(o=>o.cathPillar);
  if(ps.length!==14)bad.push(['pillars',ps.length]);
  if(room.grid.some(row=>row.includes('P')))bad.push('painted piers left in the grid');
  for(const o of ps){
   if(!o.box||o.walk||o.box.hl!==.5||o.box.z1!==CATH_H)bad.push(['collision',o.x,o.y]);
   const parts=o.cathPillar.parts,core=parts.find(q=>q.b.r===.34);
   if(!core||core.b.z1!==CATH_H)bad.push(['core to the vault',o.x,o.y]);
   if(parts.filter(q=>q.b.r===.11&&q.b.z1===CATH_H).length!==4)bad.push(['four shafts',o.x,o.y]);
   if(!parts.some(q=>q.b.z0===0))bad.push(['not on the floor',o.x,o.y]);
   const cap=parts.find(q=>q.b.z0===7);if(!cap||cap.b.r<=core.b.r)bad.push(['capital',o.x,o.y]);
   const stack=parts.filter(q=>q.b.x===0&&q.b.y===0).sort((a,b)=>a.b.z0-b.b.z0);
   for(let k=1;k<stack.length;k++)if(stack[k].b.z0>stack[k-1].b.z1+1e-9&&stack[k].b.z0<7.7)bad.push(['gap in the column',o.x,o.y,stack[k].b.z0]);
  }
  // round: a ray from the side meets the core at its radius whatever the bearing
  const b={x:0,y:0,r:.34,z0:.6,z1:CATH_H};
  for(let k=0;k<8;k++){const ang=k/8*Math.PI*2,ox=Math.cos(ang)*3,oy=Math.sin(ang)*3,t=cathColumnRay(ox,oy,2,-Math.cos(ang),-Math.sin(ang),0,b);if(Math.abs(t-(3-.34))>1e-6)bad.push(['not round',k,t]);
   if(Math.abs(Math.hypot(HIT.nx,HIT.ny)-1)>1e-6)bad.push(['normal',k]);}
  if(cathColumnRay(0,0,20,0,0,-1,b)<0||HIT.face!==5)bad.push('no top');
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
test('fine detail settles with distance: leading thins, flagstones stop striping, and the vault keeps its ribs and stars',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=c=>c>>4;
  const lead=fp=>{let g=0;for(let du=-.9;du<.9;du+=.013)for(let z=4;z<7;z+=.05){glassCell(0,du,z,3,8.6,1.05,fp);if(BG[0]===C(GRAY,1))g++;}return g;};
  if(!(lead(0)>lead(.3)*2))bad.push(['leading',lead(0),lead(.3)]);
  const flags=fp=>{const s=new Set();for(let wx=2;wx<5;wx+=.11)for(let wy=12;wy<20;wy+=.37){cathedralFloor(0,1,wx,wy,fp);s.add(BG[0]);}return s.size;};
  if(!(flags(.01)>flags(1)))bad.push(['flagstones',flags(.01),flags(1)]);
  px=11;py=20;a=-1.57;pitch=.9;render(0);let rib=0,star=0,web=0;
  for(let i=0;i<cols*(rows>>2);i++){if(BG[i]===C(GRAY,2.4))rib++;else if(BG[i]===C(YEL,6))star++;else if(hue(BG[i])===BLUE)web++;}
  if(rib<20||star<3||web<200)bad.push(['vault',rib,star,web]);
  return {bad};
 });
 assert.deepEqual(r.bad,[]);
}));
