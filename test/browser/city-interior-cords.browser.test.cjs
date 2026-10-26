'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>{requestAnimationFrame=()=>0;let seed=1;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
 await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('taqueria paper flags share their entire top edges with a continuous wall-mounted sagging cord',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('taqueria',{word:'TACOS',ret:[100,100,0]},[5,5,0]);render(0);
  const bad=[],rows=room.props.filter(o=>o.picado),eq=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))<1e-8;let flags=0;
  if(rows.length!==3)bad.push('native flag rows missing');
  for(const o of rows){const d=o.picado,cord=d.cord;flags+=d.flags.length;
   if(!o.walk||o.box.z0<2.2||Math.abs(d.x0-1)>1e-8||Math.abs(d.x1-(room.W-1))>1e-8)bad.push('wrong room attachment or floor obstruction');
   if(Math.min(...cord.map(c=>c.az))>d.z-.11)bad.push('cord has no natural sag');
   for(const c of cord)for(const [x,y,z]of [[c.ax,c.ay,c.az],[c.bx,c.by,c.bz]])if(Math.abs(x)+c.r>o.box.hl+1e-8||Math.abs(y)+c.r>o.box.hw+1e-8||z-c.r<o.box.z0-1e-8||z+c.r>o.box.z1+1e-8)bad.push('cord outside model bounds');
   for(let k=1;k<cord.length;k++)if(!eq([cord[k-1].bx,cord[k-1].by,cord[k-1].bz],[cord[k].ax,cord[k].ay,cord[k].az]))bad.push('cord gap');
   for(const f of d.flags){const run=cord.find(c=>eq([c.ax,c.ay,c.az],f.left)&&eq([c.bx,c.by,c.bz],f.right));
    if(!run)bad.push('flag top detached');
    for(const [u,point]of [[-.13,f.left],[.13,f.right]])if(Math.abs(f.box.x+u-point[0])>1e-8||Math.abs(f.box.paper.top+f.box.paper.slope*u-point[2])>1e-8)bad.push('rendered flag does not meet cord');
    if(Math.abs(f.box.x)+f.box.hl>o.box.hl||f.box.z0<o.box.z0||f.box.z1>o.box.z1)bad.push('paper outside model bounds');
   }
   if(Math.abs(cord[0].ax+o.x-d.x0)>1e-8||Math.abs(cord.at(-1).bx+o.x-d.x1)>1e-8||Math.abs(cord[0].az-d.z)>1e-8||Math.abs(cord.at(-1).bz-d.z)>1e-8)bad.push('cord not mounted at wall');
   for(const m of d.mounts)if(![d.x0,d.x1].some(x=>Math.abs(Math.abs(m.x+o.x-x)-m.hl)<1e-8))bad.push('mount floats off wall');
  }return {bad:bad.slice(0,8),flags};
 });assert.deepEqual(r.bad,[]);assert.ok(r.flags>=90);
}));

test('paper cut-outs pass through real thin shells with inward closed edges and cached shapes',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('taqueria',{word:'TACOS',ret:[100,100,0]},[5,5,0]);render(0);
  const bad=[],rows=room.props.filter(o=>o.picado),draw=drawBox;let checked=0;
  if(!rows.length)return {bad:['no built flags'],checked};
  const capture=o=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{o.draw(o.x,o.y);}finally{drawBox=draw;}return a;};
  for(const o of rows){const a=capture(o),b=capture(o);
   for(const [k,q]of a.entries()){
    const B=q.box;if(!B.paper)continue;checked++;
    if(B.paper!==b[k].box.paper||q.shade!==b[k].shade)bad.push('paper rebuilt');
    const z=B.paper.top-.025;
    const front=q.ray(B.x,B.y-.2,z,0,1,0,B),ny=HIT.ny,back=q.ray(B.x,B.y+.2,z,0,-1,0,B);
    if(Math.abs(front-.199)>1e-8||Math.abs(back-.199)>1e-8||ny>-.99||HIT.ny<.99)bad.push('open or wrongly lit paper faces');
    const h=B.paper.holes[4],hz=B.paper.top+B.paper.slope*h.x+h.z;
    if(q.ray(B.x+h.x,B.y-.2,hz,0,1,0,B)>=0)bad.push('cut-out filled');
    const edge=q.ray(B.x+h.x,B.y,hz,1,0,B.paper.slope,B);
    if(Math.abs(edge-h.r)>1e-7||HIT.nx>-.5||!Number.isFinite(HIT.nz))bad.push('missing inward cut edge');
    q.shade(0,.2,8);if(CH[0]!==' ')bad.push('paper rendered as glyph stamps');
   }
  }return {bad:bad.slice(0,10),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=90);
}));

test('noodle dough shares the rendered figure body, joins its actual hands in every pose and stays above the prep board',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  enterRoom('noodlehouse',{word:'NOODLES',ret:[100,100,0]},[5,5,0]);render(0);
  const bad=[],worker=room.props.find(o=>o.noodleCook),prep=room.props.find(o=>o.prep?.kind==='noodles');
  if(!worker?.noodleStretch||!prep)return {bad:['native noodle scene missing'],checked:0};
  const {frames,unit,source}=worker.noodleStretch;let checked=0;
  if(!isRoomPerson(worker)||worker.fig.shape===source.shape)bad.push('worker interaction or sprite cache identity lost');
  for(let f=0;f<frames.length;f++){
   T=Math.acos(1-2*f/7)/1.6;const frame=frames[f],key=worker.pose(),body=figCache.get(worker.fig.shape+'|'+key);if(body!==frame.body||worker.pose()!==frame.key)bad.push('hands/dough frame mismatch or body rebuilt');
   const hands=body.parts.filter(p=>p.k===0&&p.r.every(r=>Math.abs(r-.95)<1e-8)&&p.role({})===FR.SKIN).map(p=>p.c);hands.sort((a,b)=>a[0]-b[0]);
   for(const strand of frame.strands){
    for(const [point,hand]of [[strand.points[0],hands[0]],[strand.points.at(-1),hands[1]]])if(Math.hypot(...point.map((v,k)=>v-hand[k]))>.95-.005/unit)bad.push('dough misses actual hand');
    if(strand.points[4][2]>=Math.min(strand.points[0][2],strand.points.at(-1)[2])-.05/unit)bad.push('dough not curved');
    for(let j=0;j<strand.parts.length;j++){
     const part=strand.parts[j],a=strand.points[j],b=strand.points[j+1];checked++;
     if(!body.parts.includes(part)||part.k!==2||part.role({})!==FR.MIC)bad.push('dough not in rendered figure');
     if(part.a!==a||part.b!==b)bad.push('dough segment gap');
     const mid=a.map((v,k)=>(v+b[k])/2),hit=figHitPart(part,[mid[0],mid[1],mid[2]+2],[0,0,-1]);if(hit<0||!Number.isFinite(FIG_HIT.n[2]))bad.push('dough lacks solid round surface');
    }
    for(const point of strand.points){const x=worker.x+point[0]*unit,y=worker.y-point[1]*unit,z=point[2]*unit;
     if(Math.abs(x-prep.x)>prep.prep.hl-.01||Math.abs(y-prep.y)>prep.prep.hw-.01||z-.005<prep.prep.height+.018)bad.push('dough misses prep area or crosses board');
     if(Math.abs(point[0])+.005/unit>FIG_W/2||point[2]<0||point[2]+.005/unit>FIG_H)bad.push('dough outside sprite bounds');
    }
   }
   for(const view of [0,2,6]){T+=.0001;const spr=figSprite(worker.fig,view,frame.key,4),again=figSprite(worker.fig,view,frame.key,4);
    if(spr!==again||figCache.get(worker.fig.shape+'|'+frame.key)!==body)bad.push('fixed body or sprite rebuilt');
    if(spr.filter(v=>v===FR.MIC).length<4)bad.push('dough absent from actual cached sprite');
    let fine=false;const width=FIG_W*4;
    for(let y=0;y<FIG_H;y++)for(let x=0;x<FIG_W;x++){let n=0;for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)n+=spr[(y*4+dy)*width+x*4+dx]===FR.MIC;if(n>0&&n<16)fine=true;}
    if(!fine)bad.push('close dough remains a coarse pixel stamp');
   }
  }
  // Inspect actual close front/oblique rasters, not merely metadata: the
  // held dough must occupy pixels in the same body sprite as the hands.
  for(const view of [0,2,6]){
   const raster=figRaster(frames[7].body,view,4),pixels=Array.from(raster.data||raster.roles||raster).filter(v=>v===FR.MIC).length;
   if(pixels<4)bad.push('dough absent from actual figure raster');
  }
  const dead=figBody(worker.fig,'dead');if(dead.parts.some(p=>p.k===2&&p.role({s:.5,n:[0,0,1]})===FR.MIC))bad.push('dead worker still holds dough');
  return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,320);
}));
