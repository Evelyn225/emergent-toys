'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));try{
  await page.addInitScript(()=>{requestAnimationFrame=()=>0;let s=1;Math.random=()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;mode='walk';room=me=null;body.z=body.vz=body.crouch=0;body.seat=null;tod=12;T=10;rain=wet=snowCover=0;weather='clear';env(0);});
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}}

test('the miniature rails, bridge and approaches share closed joins and supported decks',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],pieces=RAILWAY_MODELS,rails=pieces.filter(o=>o.kind==='rail'),beds=pieces.filter(o=>o.kind==='trackbed'),decks=pieces.filter(o=>o.kind==='bridge');
  function top(solids,x,y){let best=Infinity;for(const o of solids){const t=railwayRay(x,y,.5,0,0,-1,o);if(t>0)best=Math.min(best,t);}return .5-best;}
  let probes=0;
  for(let k=0;k<RAILWAY_PATH.length-1;k++)for(const f of [0,.5,1]){
   const a=RAILWAY_PATH[k],b=RAILWAY_PATH[k+1],p={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f,c:a.c+(b.c-a.c)*f,s:a.s+(b.s-a.s)*f};
   for(const side of [-1,1]){const h=top(rails,p.x-p.s*side*.0085,p.y+p.c*side*.0085);if(Math.abs(h-p.z)>1e-7)bad.push(['rail',k,f,h,p.z]);probes++;}
   const bed=top(beds,p.x,p.y);if(Math.abs(bed-(p.z-.0025))>1e-7)bad.push(['bed',k,f,bed,p.z]);
   if(Math.abs(p.x)<(p.y<.23?.15:.06)-1e-8){const deck=top(decks,p.x,p.y);if(Math.abs(deck-(p.z-.0085))>1e-7)bad.push(['deck',k,f,deck,p.z]);}
  }
  for(const o of pieces.filter(o=>o.kind==='pier')){
   const deck=top(decks,o.x,o.y);
   if(Math.abs(deck-.0055-o.z1)>1e-7||o.z0!==.062)bad.push(['pier',o.x,deck,o.z1]);
  }
  const guards=pieces.filter(o=>o.kind==='railing'&&o.miniPlanes);
  for(const o of pieces.filter(o=>o.kind==='railing'&&!o.miniPlanes)){
   const bar=top(guards,o.x,o.y),deck=top(decks,o.x,o.y);
   if(Math.abs(bar-o.z1-.003)>1e-7||Math.abs(deck-o.z0)>1e-7||Math.abs(o.x)+o.hl>.15)bad.push(['guard',o.x,bar,o.z1,deck,o.z0]);
  }
  return{bad:bad.slice(0,20),probes,rails:rails.length,bridge:decks.length};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.probes>750&&r.rails>500&&r.bridge>20,JSON.stringify(r));
}));

test('the pitched train clears bridge, approaches and tunnel throughout a complete lap',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const bad=[],obstacles=RAILWAY_MODELS.filter(o=>!['rail','trackbed'].includes(o.kind));let pitched=0;
  function inside(o,x,y,z){
   const b=railwayBounds(o);if(x<=b[0]+1e-6||x>=b[3]-1e-6||y<=b[1]+1e-6||y>=b[4]-1e-6||z<=b[2]+1e-6||z>=b[5]-1e-6)return false;
   const p=o.miniPlanes||o.planeData;
   if(p){const xx=x-(o.miniPlanes?0:o.x),yy=y-(o.miniPlanes?0:o.y);for(let j=0;j<p.length;j+=4)if(p[j]*xx+p[j+1]*yy+p[j+2]*z>p[j+3]-1e-7)return false;return true;}
   const u=(x-o.x)*o.c+(y-o.y)*o.s,v=-(x-o.x)*o.s+(y-o.y)*o.c;return Math.abs(u)<o.hl-1e-6&&Math.abs(v)<o.hw-1e-6;
  }
  for(let frame=0;frame<168;frame++){
   T=3+frame/168*21;updateWindowTrain();
   for(const o of [...RAILWAY_TRAIN,...RAILWAY_ENGINE]){
    const p=o.pose;if(Math.abs(p.sp)>.05)pitched++;
    for(const u of [-o.hl,0,o.hl])for(const v of [-o.hw,0,o.hw])for(const w of [o.z0,(o.z0+o.z1)/2,o.z1]){
     const x=o.x+p.c*(p.cp*u-p.sp*w)-p.s*v,y=o.y+p.s*(p.cp*u-p.sp*w)+p.c*v,z=o.poseZ+p.sp*u+p.cp*w;
     for(const b of obstacles)if(inside(b,x,y,z)&&bad.length<20)bad.push([frame,o.kind,b.kind,x,y,z]);
    }
   }
  }
  return{bad,pitched};
 });assert.deepEqual(r.bad,[]);assert.ok(r.pitched>100,'cars follow both bridge grades');
}));

test('window column caching preserves uncropped ray hits while reducing actual intersection work',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const s=STREET_SCENES.railway,original=railwayColumnCast,ray=railwayRay;let bad=0,checked=0,fastCalls=0,referenceCalls=0,phase='fast';
  railwayRay=(...args)=>{if(phase==='fast')fastCalls++;else referenceCalls++;return ray(...args);};
  railwayColumnCast=(...args)=>{
   phase='fast';const h=original(...args),saved={piece:h.piece,t:h.t,face:h.face,u:h.u,v:h.v,z:h.z};
   phase='reference';const full=railwayCast(args[1],args[2],args[3],args[4],args[5],true);
   // Coplanar triangles at a shared seam may tie; material and actual hit must match.
   if(saved.piece?.kind!==full.piece?.kind||Math.abs(saved.t-full.t)>1e-8||saved.piece&&Math.abs(saved.z-full.z)>1e-8)bad++;
   checked++;Object.assign(RAILWAY_HIT,saved);return RAILWAY_HIT;
  };
  try{
   for(const [offset,dist,time,tilt]of [[0,.22,10,.04],[.22,.28,14,.04],[-.22,.28,19,-.08],[.01,.23,20,.1],[0,.65,9,.04],[0,2,9,.04]]){
    const p=scenePoint(s,offset,dist);px=p.x;py=p.y;a=Math.atan2(s.y-py,s.x-px);pitch=tilt;T=time;render(0);
   }
  }finally{railwayColumnCast=original;railwayRay=ray;}
  return{bad,checked,fastCalls,referenceCalls};
 });
 assert.equal(r.bad,0,JSON.stringify(r));assert.ok(r.checked>1000,JSON.stringify(r));
 assert.ok(r.fastCalls<r.referenceCalls*.05,JSON.stringify(r));
}));

test('both wheelsets sit on the rendered rail heads on flat track and bridge grades',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const rails=RAILWAY_MODELS.filter(o=>o.kind==='rail'),bad=[];let count=0;
  for(let frame=0;frame<84;frame++){
   T=3+frame/84*21;updateWindowTrain();
   for(const o of RAILWAY_WHEELS){
    const p=o.pose,side=Math.sign(o.side)*.0085,x=p.x-p.s*side,y=p.y+p.c*side;
    let rail=-Infinity;for(const b of rails){const t=railwayRay(x,y,.5,0,0,-1,b);if(t>0)rail=Math.max(rail,.5-t);}
    const t=railwayRay(x,y,p.z-.01,0,0,1,o),wheel=p.z-.01+t;
    if(t<0||Math.abs(wheel-rail)>1e-7)bad.push([frame,o.car,o.axle,wheel,rail]);count++;
   }
  }
  return{bad:bad.slice(0,20),count};
 });assert.deepEqual(r.bad,[]);assert.ok(r.count>1000);
}));
