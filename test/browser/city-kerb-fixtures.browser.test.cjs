'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('hydrants, bins, mailboxes and bollards stand on the kerb line, clear of the walking line and of everything else on the street',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],count={};
  for(const o of kerbs){count[o.kind]=(count[o.kind]||0)+1;
   const across=o.c?mod(o.y,8):mod(o.x,8); // (a kerb runs along x when its box does)
   const line=CURB-(KERB_KINDS[o.kind].line||0); // (a shelter stands set back from the kerb line)
   if(Math.abs(across-line)>1e-9&&Math.abs(across-(2-line))>1e-9)bad.push([o.kind,'off the kerb line',+across.toFixed(3)]);
   if(Math.min(Math.abs(across-.12),Math.abs(across-1.88))<o.hw+.02)bad.push([o.kind,'in the walking line']);
   if(!ROAD[idx(Math.floor(o.x),Math.floor(o.y))]||isWater(o.x,o.y))bad.push([o.kind,'not on a street']);
   const hit=streetGeometryCollision({x:o.x,y:o.y,c:o.c,s:o.s,hl:o.hl,hw:o.hw,z0:0,z1:o.h},true);if(hit)bad.push([o.kind,'inside',hit.kind]);
   for(const l of lamps)if(Math.abs(rel(l.x-o.x))<.06&&Math.abs(rel(l.y-o.y))<.06)bad.push([o.kind,'against a lamp']);
   for(const m of machines)if(Math.hypot(rel(m.x-o.x),rel(m.y-o.y))<.08)bad.push([o.kind,'against a vending machine']);
   for(const s of stations)if(Math.hypot(rel(s.x-o.x),rel(s.y-o.y))<.3)bad.push([o.kind,'at a subway entrance']);
   const face=Math.sign(o.c?o.fy:o.fx),road=across<1?1:-1;if(['mailbox','cabinet'].includes(o.kind)?face!==-road:face!==road)bad.push([o.kind,'facing the wrong way']); // (doors and slots to the pavement)
   if(o.signal&&!lights.some(l=>Math.hypot(rel(l.x-o.x),rel(l.y-o.y))<.8))bad.push('a signal cabinet away from any signal');
  }
  for(let i=0;i<kerbs.length;i++)for(let j=i+1;j<kerbs.length;j++){const a_=kerbs[i],b=kerbs[j];if(Math.abs(rel(a_.x-b.x))<a_.hl+b.hl+.01&&Math.abs(rel(a_.y-b.y))<a_.hl+b.hl+.01&&Math.hypot(rel(a_.x-b.x),rel(a_.y-b.y))<Math.max(a_.hl,a_.hw)+Math.max(b.hl,b.hw)+.01)bad.push(['two fixtures overlap',a_.kind,b.kind]);}
  const indexed=kerbsB.flat().length===kerbs.length&&kerbs.every(o=>kerbsB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].includes(o));
  return {bad:bad.slice(0,10),count,indexed};
 });
 assert.deepEqual(r.bad,[]);
 assert.equal(r.indexed,true);
 for(const k of ['hydrant','bin','mailbox','bollard','cabinet','shelter'])assert.ok(r.count[k]>100,`plenty of ${k}s: ${r.count[k]}`);
}));

test('each fixture is built inside its box, and on foot you walk round it while the walking line stays open',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],seen={};
  for(const o of kerbs){if(seen[o.kind+o.c+o.fx+o.fy])continue;seen[o.kind+o.c+o.fx+o.fy]=1;
   px=o.x-o.fx*.15;py=o.y-o.fy*.15;const z=terrainHeight(o.x,o.y),out=[],draw=drawBox;
   drawBox=(box)=>out.push(box);try{KERB_DRAW[o.kind](o,o.x-px,o.y-py,z,true);}finally{drawBox=draw;}
   const vx=o.x-px,vy=o.y-py;if(out.length<4&&!['bollard','guy'].includes(o.kind))bad.push([o.kind,'no fittings up close',out.length]);
   for(const q of out){if(o.kind==='pole'&&q.z0>z+.3||o.kind==='guy'&&q.az!=null&&Math.max(q.az,q.bz)>z+o.h)continue; // (overhead, the arm and its wires reach out over the road; the guy wire runs up to its pole: city-overhead-lines checks those)
const c=Math.abs(q.c??1),s=Math.abs(q.s??0),ex=q.hl*c+q.hw*s,ey=q.hl*s+q.hw*c,bx=o.hl*o.c+o.hw*o.s,by=o.hl*o.s+o.hw*o.c;
    if(Math.abs(q.x-vx)+ex>bx+1e-6||Math.abs(q.y-vy)+ey>by+1e-6||q.z1>z+o.h+1e-6||q.z0<z-1e-6)bad.push([o.kind,'a part outside its box',+((Math.abs(q.x-vx)+ex)*1000).toFixed(1),+((Math.abs(q.y-vy)+ey)*1000).toFixed(1),+(q.z1-z).toFixed(4)]);}
   mode='walk';const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1,lp=(a,v)=>[o.x+o.c*a-o.s*v*fs,o.y+o.s*a+o.c*v*fs];
   if(o.kind!=='shelter'&&free(o.x,o.y))bad.push([o.kind,'walked through']);
   if(o.kind==='shelter'){ // its walls are solid, its inside open and roofed, its bench inside
    if(free(...lp(0,-.056)))bad.push('walked through the shelter back');if(free(...lp(.145,0)))bad.push('walked through the advert panel');
    if(!free(...lp(0,.02)))bad.push('no way into the shelter');
    if(!shelterRoofAt(...lp(0,.02),.17))bad.push('rain under the shelter roof');if(shelterRoofAt(...lp(0,.12),.17))bad.push('roof past the shelter');
    if(!benches.some(b=>b.shelter===o&&shelterRoofAt(b.x,b.y,.05)))bad.push('no bench in the shelter');}
   const across=o.c?mod(o.y,8):mod(o.x,8),walk=across<1?.12:1.88,wx=o.c?o.x:o.x-across+walk,wy=o.c?o.y-across+walk:o.y;
   if(kerbAt(wx,wy,.02))bad.push([o.kind,'blocks the walking line']);
  }
  return {bad:bad.slice(0,10),kinds:Object.keys(seen).length};
 });
 assert.deepEqual(r.bad,[]);
 assert.ok(r.kinds>=12,'every kind in more than one facing was built');
}));
