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
   const vx=o.x-px,vy=o.y-py;if(out.length<(o.kind==='bollard'?1:4)&&o.kind!=='bollard')bad.push([o.kind,'no fittings up close',out.length]);
   for(const q of out){const c=Math.abs(q.c??1),s=Math.abs(q.s??0),ex=q.hl*c+q.hw*s,ey=q.hl*s+q.hw*c,bx=o.hl*o.c+o.hw*o.s,by=o.hl*o.s+o.hw*o.c;
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

test('kerb surfaces stay cached through translation and terrain height changes; bins have open mouths and mailbox roofs form one closed shell',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof kerbModel!=='function')return {bad:['fixed kerb surfaces not cached'],checked:0};
  const bad=[],draw=drawBox,seen=new Set();let checked=0;
  const capture=(o,x,y,z)=>{const a=[];drawBox=(box,shade,ray=rayBox)=>a.push({box,shade,ray});try{KERB_DRAW[o.kind](o,x,y,z,true);}finally{drawBox=draw;}return a;};
  for(const o of kerbs){const id=o.kind+o.c+o.fx+o.fy;if(seen.has(id))continue;seen.add(id);checked++;
   const model=kerbModel(o,true),saved=model.parts.slice(),a=capture(o,.2,.1,0),b=capture(o,.3,.2,.4),c=capture(o,.35,.25,.4);
   if(kerbModel(o,true)!==model||model.parts.some((p,j)=>p!==saved[j])||a.length!==b.length||b.length!==c.length)bad.push([o.kind,'model rebuilt']);
   for(let i=0;i<a.length;i++)if(a[i].shade!==b[i].shade||b[i].ray!==c[i].ray||a[i].box.profile!==b[i].box.profile||a[i].box.mailboxShape!==b[i].box.mailboxShape||a[i].box.handShape!==b[i].box.handShape)bad.push([o.kind,'fixed shapes/materials/rays rebuilt']);
   const index=model.parts.findIndex(p=>p.role==='body');if(index<0)continue;const body=c[index],B=body.box;
   if(o.kind==='bin'){
    const t=body.ray(B.x,B.y,.6,0,0,-1,B);if(Math.abs(HIT.w-.464)>1e-7||Math.abs(t-.136)>1e-7||HIT.nz<.99)bad.push('bin mouth sealed or floor missing on terrain');
    const z=.475,inside=body.ray(B.x,B.y,z,1,0,0,B);if(inside<0||HIT.nx>-.5)bad.push('bin inner wall missing');
   }
   if(o.kind==='mailbox'){
    if(model.parts.filter(p=>p.role==='body').length!==1||body.ray!==model.parts[index].shiftedRay)bad.push('mailbox still has overlapping roof bodies');
    const t=body.ray(B.x,B.y,.6,0,0,-1,B);if(Math.abs(t-.073)>1e-7||Math.abs(HIT.w-.527)>1e-7||HIT.nz<.99)bad.push('roof crown unclosed or at wrong height');
    const u=.011,roof=body.ray(B.x+B.c*u,B.y+B.s*u,.6,0,0,-1,B);if(roof<0||Math.abs(HIT.nz-Math.sqrt(.75))>1e-6)bad.push('roof normals not curved');
    for(const z of [.505-.00001,.505,.505+.00001]){const v=B.hw+.05,t=body.ray(B.x-B.s*v,B.y+B.c*v,z,B.s,-B.c,0,B);if(Math.abs(t-.05)>1e-7)bad.push('roof/carcass cap seam');}
   }
  }return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=12);
}));

test('mailbox legs stay grounded at both detail levels and pulls have mounted ends with real finger space',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof kerbModel!=='function')return ['no prepared mailbox'];const bad=[];
  const box=(b,c,s)=>{const u=b.x*c+b.y*s,v=-b.x*s+b.y*c;return {u,v,a:Math.abs(b.c*c+b.s*s)*b.hl+Math.abs(-b.s*c+b.c*s)*b.hw,b:Math.abs(-b.c*s+b.s*c)*b.hl+Math.abs(b.s*s+b.c*c)*b.hw,z0:b.z0,z1:b.z1};};
  for(const o of kerbs.filter(o=>o.kind==='mailbox').slice(0,12)){
   for(const near of [false,true]){
    const model=kerbModel(o,near),legs=model.parts.filter(p=>p.role==='leg'),body=model.parts.find(p=>p.role==='body');
    if(legs.length!==4||legs.some(p=>p.box.z0!==0||p.box.z1<body.box.z0))bad.push('mailbox floats above its supports');
   }
   const model=kerbModel(o,true),bar=model.parts.find(p=>p.role==='handle'),mounts=model.parts.filter(p=>p.role==='handle-mount'),door=model.parts.find(p=>p.role==='chute');
   if(!bar||mounts.length!==2||!door){bad.push('missing real pull');continue;}
   const label=model.parts.find(p=>p.role==='label'),plate=model.parts.find(p=>p.role==='collection');
   label.shade(0,.1,1);const low=COL[0]&15;label.shade(0,.1,12);if((COL[0]&15)<=low)bad.push('painted MAIL lettering emits fixed light');
   plate.shade(0,.1,1);const dark=BG[0]&15;plate.shade(0,.1,12);if((BG[0]&15)<=dark)bad.push('collection plate emits fixed light');
   const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1,A=box(bar.box,o.c,o.s),D=box(door.box,o.c,o.s);
   if(A.v*fs-A.b-(D.v*fs+D.b)<.0015)bad.push('no finger space');
   for(const p of mounts){const M=box(p.box,o.c,o.s);if(M.v*fs-M.b>D.v*fs+D.b+1e-8||M.v*fs+M.b<A.v*fs-A.b-1e-8||M.z1<A.z0||M.z0>A.z1)bad.push('pull mount disconnected');}
  }return bad.slice(0,10);
 });assert.deepEqual(r,[]);
}));

test('round kerb collisions leave empty corners clear and use actual heights for kicked balls',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof kerbFootprint!=='function')return ['no actual-shape collision'];const bad=[];
  for(const kind of ['bin','bollard','hydrant','mailbox']){
   const o=kerbs.find(o=>o.kind===kind),z=terrainHeight(o.x,o.y);
   if(!o||!kerbAt(o.x,o.y,.001,z))bad.push([kind,'walk through fixture']);
   if(kerbAt(o.x,o.y,.001,z+o.h+.01,.01))bad.push([kind,'blocks above its height']);
   if(kind!=='mailbox'){
    if(kerbFootprint(o,o.hl+.018,o.hw+.018,.02))bad.push([kind,'empty bounding corner blocks walking']);
   }
  }
  const h=kerbs.find(o=>o.kind==='hydrant');if(!kerbFootprint(h,0,0,.0001,.074,.075))bad.push('hydrant operating nut has no collision');
  const mail=kerbs.find(o=>o.kind==='mailbox');if(kerbFootprint(mail,0,0,.001,.004,.014))bad.push('small object cannot pass below mailbox');
  cars.length=0;const o=kerbs.find(o=>o.kind==='bin');mode='walk';px=o.x;py=o.y;body.z=0;if(free(px,py))bad.push('walking hook lost');
  const check=kerbAt;let heights=[];kerbAt=(...args)=>{heights.push(args.slice(3));return false;};
  try{ballBlocked(o.x,o.y,.05);}finally{kerbAt=check;}
  if(!heights.some(([z,height])=>Math.abs(z-.035)<1e-8&&Math.abs(height-.03)<1e-8))bad.push('kicked ball uses an infinite-height collider');
  return bad.slice(0,12);
 });assert.deepEqual(r,[]);
}));

test('utility cabinets have supported doors, joined hardware and real cabinet-sized collision at each height',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof kerbModel!=='function')return {bad:['cabinet not prepared'],checked:0};
  const bad=[],seen=new Set();let checked=0;
  const local=(b,o)=>({u:b.x*o.c+b.y*o.s,v:(-b.x*o.s+b.y*o.c)*(Math.sign(-o.s*o.fx+o.c*o.fy)||1),a:Math.abs(b.c*o.c+b.s*o.s)*b.hl+Math.abs(-b.s*o.c+b.c*o.s)*b.hw,b:Math.abs(-b.c*o.s+b.s*o.c)*b.hl+Math.abs(b.s*o.s+b.c*o.c)*b.hw,z0:b.z0,z1:b.z1});
  const test=(yes,why)=>{if(!yes)bad.push(why);};
  for(const o of kerbs.filter(o=>o.kind==='cabinet')){
   const id=[o.c,o.s,o.fx,o.fy,!!o.signal].join(',');if(seen.has(id))continue;seen.add(id);checked++;
   for(const near of [false,true]){
    const m=kerbModel(o,near),part=role=>m.parts.filter(p=>p.role===role),body=part('body')[0],cap=part('cap')[0],base=part('plinth')[0];
    if(!body||!cap||!base){bad.push('missing supported cabinet shell');continue;}
    test(base.box.z0===0&&base.box.z1===body.box.z0&&body.box.z1===cap.box.z0,'cabinet body/cap/plinth disconnected');
    for(const q of [body,base,cap]){
     const B=q.box,z=(B.z0+B.z1)/2,t=q.ray(B.x-o.fx*.1,B.y-o.fy*.1,z,o.fx,o.fy,0,B);
     test(t>0&&Math.abs(t-(.1-B.hw))<.0002,'cabinet shell has an open back');
    }
    if(!near){test(part('door').length===0&&part('louvre').length===0,'far cabinet keeps tiny hardware');continue;}
    const doors=part('door'),hinges=part('hinge'),vents=part('louvre'),bar=part('handle')[0],mounts=part('handle-mount');
    test(doors.length===2&&hinges.length===4&&vents.length===10&&!!bar&&mounts.length===2,'missing cabinet door hardware');
    for(const door of doors){const D=local(door.box,o),B=local(body.box,o);test(Math.abs(D.v-D.b-B.b)<1e-8&&D.z0>B.z0&&D.z1<B.z1,'door not seated on cabinet');}
    for(const h of hinges){const H=local(h.box,o);test(doors.some(q=>{const D=local(q.box,o);return Math.abs(D.u-H.u)<D.a+H.a&&H.v-H.b<D.v+D.b&&H.v+H.b>D.v-D.b&&H.z0>=D.z0&&H.z1<=D.z1;}),'door hinge floats');}
    if(bar&&mounts.length===2){
     const H=local(bar.box,o),D=local(doors[1].box,o);
     test(H.v-H.b-(D.v+D.b)>.001,'cabinet pull has no finger clearance');
     for(const q of mounts){const M=local(q.box,o);test(M.v-M.b<=D.v+D.b&&M.v+M.b>=H.v-H.b&&M.z0<=H.z1&&M.z1>=H.z0,'cabinet pull mount detached');}
    }
    for(const vent of vents){const V=local(vent.box,o),B=local(body.box,o);test(Math.abs(Math.abs(V.u)-V.a-B.a)<1e-8&&V.z0>B.z0&&V.z1<B.z1&&V.b<B.b,'vent detached from end panel');}
    const label=part('label')[0];if(label){label.shade(0,.1,1);const low=BG[0]&15;label.shade(0,.1,12);test((BG[0]&15)>low,'cabinet label emits fixed light');}else bad.push('missing cabinet label');
   }
   for(const [u,v,lo,hi,wanted]of [[.035,0,.06,.08,true],[.041,0,.002,.008,true],[.0425,0,.137,.139,true],[.041,0,.06,.08,false],[.0398,.0248,.06,.08,false],[0,0,.15,.16,false]]){
    test(kerbFootprint(o,u,v,0,lo,hi)===wanted,'cabinet collision does not follow its actual shell heights');
   }
   const z=terrainHeight(o.x,o.y),u=.035,x=o.x+o.c*u,y=o.y+o.s*u;
   test(kerbAt(x,y,.0001,z+.08,.01)===o,'cabinet uses hydrant collision or no collision');
  }
  return {bad:bad.slice(0,14),checked};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>=6,'both cabinet types and street facings were checked');
}));

test('shelter glass and advertising have real supports; surface bounds also govern posts, roof and rain on elevated ground',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof kerbModel!=='function'||typeof SHELTER_PARTS==='undefined')return {bad:['no shared shelter surfaces'],checked:0};
  const bad=[],seen=new Set();let checked=0;
  const test=(yes,why)=>{if(!yes)bad.push(why);};
  const box=(b,o)=>({u:b.x*o.c+b.y*o.s,v:(-b.x*o.s+b.y*o.c)*(Math.sign(-o.s*o.fx+o.c*o.fy)||1),a:Math.abs(b.c*o.c+b.s*o.s)*b.hl+Math.abs(-b.s*o.c+b.c*o.s)*b.hw,b:Math.abs(-b.c*o.s+b.s*o.c)*b.hl+Math.abs(b.s*o.s+b.c*o.c)*b.hw,z0:b.z0,z1:b.z1});
  for(const o of kerbs.filter(o=>o.kind==='shelter')){
   const id=[o.c,o.s,o.fx,o.fy].join(',');if(seen.has(id))continue;seen.add(id);checked++;
   const fs=Math.sign(-o.s*o.fx+o.c*o.fy)||1,world=(u,v)=>[o.x+o.c*u-o.s*v*fs,o.y+o.s*u+o.c*v*fs];
   for(const near of [false,true]){
    const model=kerbModel(o,near),part=role=>model.parts.find(p=>p.role===role);
    test(model.parts.length===SHELTER_PARTS.length,'shelter drops supports at a distance');
    for(const q of SHELTER_PARTS){
     const p=part(q.role);if(!p){bad.push('missing shelter surface '+q.role);continue;}
     // Four posts share a role; check their individual box centres below.
     if(q.role!=='post'){
      const B=box(p.box,o);test(Math.abs(B.u-q.a)<1e-9&&Math.abs(B.v-q.v)<1e-9&&Math.abs(B.a-q.hl)<1e-9&&Math.abs(B.b-q.hw)<1e-9&&Math.abs(B.z0-q.z0)<1e-9&&Math.abs(B.z1-q.z1)<1e-9,'collision/render bounds drift');
     }
    }
    const A=part('advert'),F=part('advert-foot'),H=part('advert-head'),roof=part('roof'),glass=part('end-glass'),edge=part('end-frame');
    if(!A||!F||!H||!roof||!glass||!edge){bad.push('unsupported advert or end glass');continue;}
    test(F.box.z0===0&&F.box.z1===A.box.z0&&A.box.z1===H.box.z0&&H.box.z1===roof.box.z0,'advert floats between floor and canopy');
    for(const [support,z]of [[F,.01],[H,.227]]){const B=support.box,t=support.ray(B.x-o.c*.1,B.y-o.s*.1,z,o.c,o.s,0,B);test(t>0&&Math.abs(t-(.1-B.hl))<.0002,'advert support has no real closed back');}
    const G=box(glass.box,o),E=box(edge.box,o),lower=part('end-lower-rail'),upper=part('end-upper-rail');
    test(Math.abs(G.v+G.b-(E.v-E.b))<1e-9&&Math.abs(G.z0-lower.box.z1)<1e-9&&Math.abs(G.z1-upper.box.z0)<1e-9&&upper.box.z1===roof.box.z0,'end glass edge/frame disconnected');
    const posts=model.parts.filter(p=>p.role==='post');test(posts.length===4&&posts.every(p=>p.box.z0===0&&p.box.z1===roof.box.z0),'canopy posts float');
    for(const p of posts){const P=box(p.box,o);test(!!kerbAt(...world(P.u,P.v),.0001,terrainHeight(o.x,o.y)+.12,.01),'can walk through shelter post');}
    const savedNight=night,savedOvercast=overcast,draw=drawBox;drawBox=()=>{};
    try{night=overcast=0;model.draw(0,0,0);HIT.face=1;HIT.w=.13;HIT.v=0;A.shade(0,.1,4);const low=BG[0]&15;night=1;model.draw(0,0,0);HIT.face=1;HIT.w=.13;HIT.v=0;A.shade(0,.1,4);test((BG[0]&15)>low,'cached advert ignores night lighting');}finally{night=savedNight;overcast=savedOvercast;drawBox=draw;}
    const shade=glass.shade;HIT.w=.15;HIT.u=.004;HIT.face=3;for(const t of [.04,.2,1]){CH[0]=' ';shade(0,t,4);test(CH[0]===' ','glass glint uses repeated slash glyphs');}
   }
   test(!kerbAt(...world(0,.02),.02),'canopy blocks open entrance');
   test(!kerbAt(...world(0,0),.001,terrainHeight(o.x,o.y)+.25,.02),'shelter blocks above its roof');
   test(kerbAt(...world(0,0),.001,terrainHeight(o.x,o.y)+.239,.002)===o,'ball passes through canopy');
   const terrain=terrainHeight;try{
    terrainHeight=()=>.4;
    test(shelterRoofAt(...world(0,0),.56)===o,'elevated shelter lets rain through');
    test(!shelterRoofAt(...world(0,0),.65),'shelter blocks rain above canopy');
    test(!shelterRoofAt(...world(0,.0695),.56),'rain cover wider than actual canopy');
   }finally{terrainHeight=terrain;}
  }return {bad:bad.slice(0,12),checked};
 });assert.deepEqual(r.bad,[]);assert.equal(r.checked,4);
}));

test('a shelter bench is reachable through its open front and C seats and restores the approach under real rain cover',()=>fixture(async p=>{
 const pos=await p.evaluate(()=>{
  mode='walk';room=me=null;fx.skating=false;body.z=body.vz=0;
  const b=benches.find(b=>b.shelter&&free(b.x+b.fx*.1,b.y+b.fy*.1));if(!b)throw Error('no shelter bench approach');
  px=b.x+b.fx*.1;py=b.y+b.fy*.1;a=Math.atan2(-b.fy,-b.fx);env(0);render(0);return {from:[px,py],b:[b.x,b.y]};
 });
 await p.keyboard.press('c');
 assert.deepEqual(await p.evaluate(()=>[px,py]),pos.b);assert.equal(await p.evaluate(()=>!!body.seat?.shelter),true);
 assert.equal(await p.evaluate(()=>!!shelterRoofAt(px,py,terrainHeight(px,py)+.12)),true);
 await p.keyboard.press('c');assert.deepEqual(await p.evaluate(()=>[px,py]),pos.from);assert.equal(await p.evaluate(()=>body.seat),null);
 const rain=await p.evaluate(()=>{
  const o=kerbs.find(o=>o.kind==='shelter'),base=terrainHeight(o.x,o.y);
  rain=1;snow=0;eye=base+.16;mode='walk';
  px=o.x;py=o.y;CH.fill(' ');rainFx(0);const inside=CH.filter(c=>c!==' ').length;
  px=o.x+o.fx*.12;py=o.y+o.fy*.12;CH.fill(' ');rainFx(0);return {inside,outside:CH.filter(c=>c!==' ').length};
 });assert.equal(rain.inside,0);assert.ok(rain.outside>0,'rain resumes outside the actual roof');
}));
