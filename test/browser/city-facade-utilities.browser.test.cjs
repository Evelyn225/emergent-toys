'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('downpipes run down street fronts from under the cornice, round every moulding, clear of doors; meters beside some',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let jogs=0;
  for(const q of facadePipes){
   const wx=q.x-q.ax*PIPE.off,wy=q.y-q.ay*PIPE.off;
   if(!(map[idx(Math.floor(wx-q.ax*.05),Math.floor(wy-q.ay*.05))]>0))bad.push('no wall behind');
   if(map[idx(Math.floor(wx+q.ax*.05),Math.floor(wy+q.ay*.05))]||!ROAD[idx(Math.floor(wx+q.ax*.1),Math.floor(wy+q.ay*.1))])bad.push('no pavement in front');
   if(districtAt(wx,wy)==='belle')bad.push('on a Belle front');
   if(doors.some(d=>Math.abs(rel(d.x-q.x))<.4&&Math.abs(rel(d.y-q.y))<.4&&Math.abs(rel(d.x-q.x)*q.c+rel(d.y-q.y)*q.s)<.09))bad.push('across a door');
   if(q.pts[0].z>.05||q.pts.at(-1).z+PIPE.head>q.h+1e-9)bad.push('not reaching from the pavement to its head');
   if(q.pts.some(t=>t.out>PIPE.off))jogs++;
   // every leg of the route, and the hopper head, clear of everything on the facade
   for(let n=1;n<q.pts.length;n++){const a0=q.pts[n-1],a1=q.pts[n];
    for(let f=0;f<=1;f+=.25){const z=a0.z+(a1.z-a0.z)*f;if(z<.05)continue;const out=a0.out+(a1.out-a0.out)*f,box={x:wx+q.ax*out,y:wy+q.ay*out,c:q.c,s:q.s,hl:PIPE.r,hw:PIPE.r,z0:z-.002,z1:z+.002};
     const hit=streetGeometryCollision(box,false);if(hit){bad.push(['pipe through',hit.kind,+z.toFixed(3)]);break;}}}
   const head=streetGeometryCollision({x:wx+q.ax*(PIPE.off+.002),y:wy+q.ay*(PIPE.off+.002),c:q.c,s:q.s,hl:.016,hw:.013,z0:q.h-PIPE.head,z1:q.h},false);if(head)bad.push(['hopper head in',head.kind]);
  }
  // drawn parts stay within a hand's width of the wall; the water pours only in the rain
  const q=facadePipes.find(q=>q.meter==='gas')||facadePipes[0];px=q.x+q.ax*.3;py=q.y+q.ay*.3;
  const parts=on=>{rain=on;const out=[],draw=drawBox,shape=drawShape;let water=0;drawBox=(b)=>out.push(b);drawShape=()=>{water++;};try{drawFacadePipe(q,rel(q.x-px),rel(q.y-py));}finally{drawBox=draw;drawShape=shape;}rain=0;return {out,water};};
  const dry=parts(0),wet=parts(.8),vx=rel(q.x-px),vy=rel(q.y-py),wvx=vx-q.ax*PIPE.off,wvy=vy-q.ay*PIPE.off;
  for(const b of dry.out){const c=Math.abs(b.c??1),s=Math.abs(b.s??0),ex=b.hl*c+b.hw*s,ey=b.hl*s+b.hw*c,out=Math.max(Math.abs((b.x-wvx)*q.ax)+ex*Math.abs(q.ax),Math.abs((b.y-wvy)*q.ay)+ey*Math.abs(q.ay));if(out>.06)bad.push(['part off the wall',+out.toFixed(3)]);}
  if(dry.water)bad.push('water with no rain');if(!wet.water)bad.push('no water in the rain');
  return {bad:bad.slice(0,8),pipes:facadePipes.length,meters:facadePipes.filter(q=>q.meter).length,jogs};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.pipes>500,`pipes: ${r.pipes}`);assert.ok(r.meters>100);assert.ok(r.jogs>0,'some pipes step round a moulding');
}));
