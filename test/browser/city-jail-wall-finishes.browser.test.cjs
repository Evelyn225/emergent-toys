'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.addInitScript(()=>{requestAnimationFrame=()=>0;});
    await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=body.crouch=0;T=26;tod=12;env(0);render(0);enterRoom('jail',{word:'JAIL',until:T+60,ret:[100,100,0]},[11,3.2,Math.PI/2]);render(0);});
    await run(p);assert.deepEqual(errors,[]);
  }finally{await p.close();}
}
test('jail wall trim is cached, grounded, ceiling-mounted and fitted around actual bars and the final door',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],models=room.props.filter(p=>p.jailSkirting||p.jailCeilingTrim),draw=drawBox;let checked=0;
  if(models.length!==2)return{bad:['missing floor/ceiling strip models'],checked};
  const solids=[];drawBox=b=>solids.push({...b});try{for(const p of room.props.filter(p=>p.jailBars||p.jailExitDoor))p.draw(p.x,p.y);}finally{drawBox=draw;}
  const actual=solids.map(b=>{const ex=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;return{x0:b.x-ex,x1:b.x+ex,y0:b.y-ey,y1:b.y+ey,z0:b.z0,z1:b.z1};});
  for(const o of models){
   const data=o.jailSkirting||o.jailCeilingTrim,base=!!o.jailSkirting;
   const capture=()=>{const A=[];drawBox=(b,shade,ray=rayBox)=>A.push({b:{...b},ref:b,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return A;},A=capture(),B=capture();
   if(A.length<15)bad.push('missing wall runs');
   for(let k=0;k<A.length;k++){
    const q=A[k],b=q.b;checked++;
    if(q.ref!==B[k].ref||q.shade!==B[k].shade)bad.push('rebuilt trim');
    const low=q.ray(b.x,b.y,-1,0,0,1,b)-1,high=4-q.ray(b.x,b.y,4,0,0,-1,b);
    if(Math.abs(low-(base?0:2.94))>1e-8||Math.abs(high-(base?.10:3))>1e-8)bad.push('floating base or ceiling gap');
    const ex=Math.abs(b.c)*b.hl+Math.abs(b.s)*b.hw,ey=Math.abs(b.s)*b.hl+Math.abs(b.c)*b.hw;
    const bounds={x0:b.x-ex,x1:b.x+ex,y0:b.y-ey,y1:b.y+ey,z0:b.z0,z1:b.z1};
    for(const cut of actual.concat(data.blockers))if(Math.min(bounds.x1,cut.x1)-Math.max(bounds.x0,cut.x0)>1e-6&&Math.min(bounds.y1,cut.y1)-Math.max(bounds.y0,cut.y0)>1e-6&&Math.min(bounds.z1,cut.z1)-Math.max(bounds.z0,cut.z0)>1e-6)bad.push('trim cuts fixture');
    const n=data.parts[k].normal,line=data.parts[k].wall,axis=n[0]?b.x:b.y,half=n[0]?ex:ey,near=n[0]||n[1];if(!(axis-half<=line+.00001&&axis+half>=line-.00001))bad.push('trim detached from wall');
   }
   if(!o.walk)bad.push('new floor collider');
   // The proxy must expose actual round-rod/sill bounds, not the legacy slab.
   if(data.blockers.some(b=>Math.abs(b.x1-b.x0-6)<1e-8&&Math.abs(b.y1-b.y0-.06)<1e-8&&b.z0===0&&b.z1===3))bad.push('collision slab leaves artificial trim gaps');
  }
  const guard=room.props.find(p=>p.fig&&p.tick&&p.y===7.5);
  if(room.grid!==JAIL_GRID||room.def.block!==jailBlock||room.props.filter(p=>p.jailBars).length!==6||room.props.filter(p=>p.jailBunk).length!==6||!room.props.some(p=>p.jailExitDoor)||!room.props.some(p=>p.jailWestWindow)||!guard||!free(11,3.2)||!free(11,5.3)||free(11,5.85))bad.push('native jail state changed');
  return{bad,checked};
 });assert.ok(r.checked>30,JSON.stringify(r));assert.deepEqual(r.bad,[]);
}));
test('native cinder walls have visible filtered joints, stable world coordinates and retained bunk tally marks',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];if(room.def.wall!==jailWallFinish)bad.push('new finish not active');
  const sample=(u,z,step,d)=>{room.def.wall(0,u,step,z,d,14,2,10);return{bg:BG[0],ch:CH[0]};};
  let fine=new Set(),coarse=new Set();for(let j=0;j<60;j++){fine.add(sample(14+j*.008,1.13,.002,.1).bg);coarse.add(sample(14+j*.008,1.13,.25,24).bg);}
  if(fine.size<2||coarse.size!==1)bad.push('missing joints or unfiltered far texture');
  const points=Array.from({length:30},(_,j)=>14+j*.013),first=points.map(u=>sample(u,1.13,.002,.1));px=12.13;py=4.1;const moved=points.map(u=>sample(u,1.13,.002,.1));if(first.some((p,k)=>p.bg!==moved[k].bg||p.ch!==moved[k].ch))bad.push('finish moves with player');
  jailWallFinish(0,8.7,.01,1.2,1,9,0,10);if(CH[0]===' ')bad.push('bunk tally marks removed');const backing=BG[0];jailWallFinish(0,8.7,.01,1.2,1,14,2,10);if(BG[0]!==backing)bad.push('tally field replaces wall material');
  px=12.5;py=3.5;a=0;pitch=0;render(0);const nativeWall=CH.filter(c=>c==='_'||c==='|').length;
  // Observe palette variation owned by the actual east partition wall.
  const finish=room.def.wall,hits=new Map();room.def.wall=(i,u,step,z,d,mx,my,L)=>{const ok=finish(i,u,step,z,d,mx,my,L);if(mx===14&&z>.5&&z<2.5)hits.set(i,{bg:BG[i],ch:CH[i]});return ok;};try{render(0);}finally{room.def.wall=finish;}
  const colors=new Set([...hits].filter(([i,q])=>BG[i]===q.bg&&CH[i]===q.ch).map(([i,q])=>q.bg));if(colors.size<2)bad.push('mortar invisible in actual standing view');
  const out=[];for(const [key,z]of [['jailSkirting',.05],['jailCeilingTrim',2.97]]){
   const model=room.props.find(p=>p[key]);pitch=(z-eye)/1.5*projY/rows;render(0);const before=[BG.slice(),CH.slice(),COL.slice()],d=model.draw;model.draw=()=>{};let changed=0;
   try{render(0);for(let i=0;i<BG.length;i++)if(BG[i]!==before[0][i]||CH[i]!==before[1][i]||COL[i]!==before[2][i])changed++;}finally{model.draw=d;}out.push(changed);
  }
  return{bad,out,colors:colors.size,nativeWall,clear:free(px,py)};
 });assert.deepEqual(r.bad,[]);assert.ok(r.clear&&r.out.every(n=>n>20),JSON.stringify(r));
}));
