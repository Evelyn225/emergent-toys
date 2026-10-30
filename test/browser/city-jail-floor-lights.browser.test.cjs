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
test('jail floor is glyph-free filtered concrete with its yellow line, the same footsteps and a plain board-marked ceiling',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],hue=()=>BG[0]>>4,floor=(x,y,fp=.001,L=6,line=fp)=>{jailFloorFinish(0,x,y,L,fp,line);if(CH[0]!==' ')bad.push('floor glyph');return BG[0];};
  if(room.def.floor!=='jail'||surfaceAt('room',room,11,7.5)!=='tile')bad.push('footstep surface changed');
  floor(11,JAIL_BARS_NEAR+.45);if(hue()!==YEL)bad.push('line missing on its centre');
  floor(11,JAIL_BARS_NEAR+.55);if(hue()===YEL)bad.push('line wider than its paint');
  floor(11,JAIL_BARS_NEAR+.37);if(hue()===YEL)bad.push('line wider than its paint');
  floor(1.2,JAIL_BARS_NEAR+.45);if(hue()!==YEL)bad.push('line stops short of the corridor');
  // Saw cuts show close and resolve to the plain slab far away; patches are world-fixed.
  if(floor(3,4.4)>=floor(3.4,4.4))bad.push('missing slab joint');
  const far=new Set();for(let x=.03;x<3;x+=.17)for(let y=.05;y<3;y+=.19)far.add(floor(x,y,3));if(far.size!==1)bad.push('far floor still carries detail');
  const near=new Set();for(let x=.03;x<3;x+=.17)for(let y=.05;y<3;y+=.19)near.add(floor(x,y));if(near.size<2)bad.push('near floor has no worn patches');
  for(const [x,y]of [[11.2,4.3],[2.7,10.1]]){if(floor(x,y)!==floor(x,y))bad.push('floor not stable');}
  ROOM_CEILS.jail(0,0,0,3.13,3.13);if(CH[0]!==' ')bad.push('ceiling glyph');
  jailCeilingFinish(0,1.2,.001);const joint=BG[0];jailCeilingFinish(0,1.8,.001);if(joint>=BG[0])bad.push('missing ceiling board mark');
  jailCeilingFinish(0,1.2,3);const a=BG[0];jailCeilingFinish(0,1.8,3);if(a!==BG[0])bad.push('far ceiling marks unfiltered');
  if(typeof jailFloor!=='undefined'||typeof jailCeil!=='undefined')bad.push('old painters still present');
  return bad;
 });
 assert.deepEqual(r,[]);
}));
test('the yellow line stays one thin continuous stripe down the whole corridor in the actual view',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const out={};room.props=room.props.filter(q=>!q.guard);
  px=3;py=7.5;a=0;pitch=-.1;render(0);
  const rowsSeen=new Map();
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const i=r*cols+c;if(FL[i]===1&&BG[i]>>4===YEL)rowsSeen.set(r,(rowsSeen.get(r)||0)+1);}
  const list=[...rowsSeen.keys()].sort((a,b)=>a-b);let gap=0;for(let k=1;k<list.length;k++)gap=Math.max(gap,list[k]-list[k-1]);
  out.rows=list.length;out.gap=gap;out.far=rowsSeen.get(list[0]);out.top=list[0];out.hor=hor;
  out.farWidth=Math.max(...list.slice(0,6).map(r=>rowsSeen.get(r)));
  return out;
 });
 assert.ok(r.rows>=20,JSON.stringify(r));
 assert.ok(r.gap<=2,`stripe breaks up: ${JSON.stringify(r)}`);
 assert.ok(r.top-r.hor<=6,`stripe stops short of the far end: ${JSON.stringify(r)}`);
 assert.ok(r.farWidth<=4,`distant stripe swells into a wedge: ${JSON.stringify(r)}`);
}));
test('ten caged lamps are fitted at the old points: plate on the ceiling, joined cage, lit dome inside it, clear headroom',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],draw=drawBox,lamps=room.props.filter(q=>q.jailCeilingLight),height=room.def.height||3;
  const want=[[4,3],[11,3],[18,3],[4,10.5],[11,10.5],[18,10.5],[2.5,7.5],[8.5,7.5],[14.5,7.5],[20,7.5]];
  for(const [x,y]of want)if(!lamps.some(q=>q.x===x&&q.y===y))bad.push(['missing',x,y]);
  for(const q of lamps){
   if(roomAt(q.x,q.y)!=='.')bad.push(['over a wall',q.x,q.y]);
   if(!q.walk||!q.overhead||q.box.z0<2.5)bad.push(['headroom',q.x,q.y]);
   const shapes=[];drawBox=(box,shade,ray=rayBox)=>shapes.push({box,shade,ray});try{q.draw(q.x,q.y);}finally{drawBox=draw;}
   if(shapes.length!==q.jailCeilingLight.parts.length)bad.push('parts not all drawn');
   for(const s of shapes)if(s.box.z0<q.box.z0-1e-9||s.box.z1>height+1e-9||Math.abs(s.box.x-q.x)+s.box.hl>q.box.hl+1e-9||Math.abs(s.box.y-q.y)+s.box.hw>q.box.hw+1e-9)bad.push(['bounds',s.box.z0,s.box.z1]);
  }
  const parts=lamps[0].jailCeilingLight.parts,plate=parts.find(q=>q.role==='plate'),dome=parts.find(q=>q.role==='dome'),wires=parts.filter(q=>q.role==='cage');
  const top=Math.max(...plate.box.profile.map(q=>q[0]));if(Math.abs(top-height)>1e-9)bad.push('plate not on the ceiling');
  const bottom=Math.min(...plate.box.profile.map(q=>q[0])),radius=Math.max(...plate.box.profile.map(q=>q[1]));
  // Every wire end meets another wire or is buried in the plate.
  const ends=wires.flatMap(w=>[[w.box.ax,w.box.ay,w.box.az],[w.box.bx,w.box.by,w.box.bz]]);
  for(const [x,y,z]of ends){
   const inPlate=z>=bottom-1e-9&&z<=top+1e-9&&Math.hypot(x,y)<=radius;
   const shared=ends.filter(o=>Math.hypot(o[0]-x,o[1]-y,o[2]-z)<1e-9).length>1;
   if(!inPlate&&!shared)bad.push(['loose wire end',x,y,z]);
  }
  if(!ends.some(([x,y,z])=>z>=bottom&&z<=top&&Math.hypot(x,y)<=radius))bad.push('cage not buried in the plate');
  // The dome sits inside the cage on all four sides, and straight below it.
  const ray=(ox,oz,rx,rz)=>{const hits=wires.map(w=>w.ray(ox,0,oz,rx,0,rz,w.box)).filter(t=>t>0);return hits.length?Math.min(...hits):Infinity;};
  const domeZ=height-.10,sideWire=ray(1,domeZ,-1,0),sideDome=dome.ray(1,0,domeZ,-1,0,0,dome.box);
  if(!(sideDome>0))bad.push('dome missing');if(sideWire>=sideDome)bad.push('dome outside its cage');
  const under=dome.ray(0,0,1,0,0,1,dome.box);if(!(under>0)||Math.abs(1+under-Math.min(...dome.box.profile.map(q=>q[0])))>1e-6)bad.push('dome not closed below');
  // In a real view the fitting is drawn and its glass is the bright part.
  px=10.3;py=7.2;a=3.3;pitch=.5;render(0);let lit=0;for(let k=0;k<BG.length;k++)if(BG[k]>>4===STONE&&(BG[k]&15)>=11)lit++;
  if(lit<8)bad.push(['no lit glass in view',lit]);
  ROOM_CEILS.jail(0,0,0,8.5,7.5);if(CH[0]!==' '||BG[0]>>4!==GRAY)bad.push('lamp still painted on the ceiling');
  return{bad,lamps:lamps.length,wires:wires.length,lit};
 });
 assert.deepEqual(r.bad,[]);assert.equal(r.lamps,10);assert.equal(r.wires,20);
}));
