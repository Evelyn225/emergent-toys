'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('fourteen street lines fit their sites, share visible ride/grind geometry and appear in map search',async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 const r=await p.evaluate(()=>{
  paused=false;mode='walk';room=me=freecam=null;T=100;tod=13;third=false;clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;
  const bad=[],directory=mapDirectory();
  for(const g of GRINDS)if(![g.x,g.y].every(Number.isFinite))bad.push('invalid grind bucket coordinates');
  for(const s of SKATE_STREET_SITES){
   if(!['park','yard'].includes(blockKind(s.bx,s.by)))bad.push(['not an open lot or park',s.id]);
   for(const other of SKATE_STREET_SITES)if(other!==s&&Math.hypot(rel(s.x-other.x),rel(s.y-other.y))<12)bad.push(['spots too close',s.id]);
   if(!directory.some(p=>p.id===s.id&&p.category==='activities'))bad.push(['not mapped',s.id]);
   for(let u=-1.1;u<=1.1001;u+=.22)for(let v=-.52;v<=.5201;v+=.26){const [x,y]=skateStreetPoint(s,u,v),bx=Math.floor(x/8),by=Math.floor(y/8);if(ROAD[idx(Math.floor(x),Math.floor(y))]||map[idx(Math.floor(x),Math.floor(y))]||isWater(x,y))bad.push(['bad ground',s.id]);if(blockKind(bx,by)==='park'&&(inPond(mod(x,8),mod(y,8),bx,by,.2)||Math.abs(mod(x,8)-5)<.35||Math.abs(mod(y,8)-5)<.35))bad.push(['pond',s.id]);}
   // A mapped approach must connect to a public street through the existing
   // yard gate/path. Check segment midpoints so thin fences cannot be skipped.
   const entry=directory.find(p=>p.id===s.id);px=entry.x;py=entry.y;body.z=body.vz=0;SK.grind=SK.transition=null;
   const queue=[[0,0]],seen=new Set(['0,0']);let connected=false;
   for(let head=0;head<queue.length&&head<5000;head++){
    const [i,j]=queue[head],x=entry.x+i*.12,y=entry.y+j*.12;
    if(ROAD[idx(Math.floor(x),Math.floor(y))]){connected=true;break;}
    for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj,key=ni+','+nj,nx=entry.x+ni*.12,ny=entry.y+nj*.12,lx=nx-s.bx*8,ly=ny-s.by*8;
     if(seen.has(key)||lx<1.6||lx>8.1||ly<1.6||ly>8.1)continue;seen.add(key);
     if(free(nx,ny)&&free((x+nx)/2,(y+ny)/2))queue.push([ni,nj]);
    }
   }
   if(!connected)bad.push(['no street access',s.id]);
   const objects=SKATE_STREET_FEATURES.filter(o=>o.streetSite===s.id);
   for(const o of objects){
    if(!solids.includes(o))bad.push(['missing collision',s.id]);
    if(o.streetRail){
     const path=GRIND_PATHS.find(p=>p.feature===o);if(!path){bad.push('rail not grindable');continue;}
     const catchAt=grindPathAt(path,path.length*.45);px=catchAt.p[0];py=catchAt.p[1];SK.dir=a=Math.atan2(catchAt.tangent[1],catchAt.tangent[0]);SK.v=.55;SK.bail=0;SK.grind=SK.transition=null;SK.airSource=null;body.trick=null;body.z=(catchAt.p[2]-walkGround(px,py))*10+.01;body.vz=-.1;skatePathCatch();if(SK.grind?.path!==path)bad.push(['rail cannot catch',s.id]);SK.grind=null;
     for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,z=(a[2]+b[2])/2;
      const t=o.ray(x,y,z+.1,0,0,-1,o);if(t<=0||Math.abs(HIT.w-z)>.0031)bad.push(['rail drawing/path mismatch',s.id]);
      if(solidAt(x,y,.001,z+.002)||!solidAt(x,y,.001,z-.015))bad.push(['rail collision/path mismatch',s.id]);
     }
    }else{
     const h=o.ramp?rampHeight(o,0):o.z1;if(Math.abs(walkGround(o.x,o.y)-h)>.0001)bad.push(['wrong height',s.id,o.kind,h,walkGround(o.x,o.y)]);
     if(o.ramp){const t=rayRamp(o.x,o.y,o.z1+.1,0,0,-1,o);if(t<=0||Math.abs(HIT.w-h)>1e-7)bad.push(['bank ray/ground mismatch',s.id]);}
    }
   }
   // The access bank reaches each raised landing exactly, and its centre line
   // is walkable/rideable up and back down without a side-wall teleport.
   if(['stairs','dock'].includes(s.type)){
    const bank=objects.find(o=>o.ramp),[x,y]=skateStreetPoint(s,-1.02,0);px=x;py=y;a=SK.dir=Math.atan2(s.s,s.c);SK.v=.65;SK.lastT=T;SK.grind=SK.transition=null;SK.bail=0;body.z=body.vz=0;body.trick=null;SKB.v=[s.c*.65,s.s*.65,0];SKB.surf=null;
    for(let i=0;i<210;i++){T+=1/120;stepSkate(1/120);stepBody(1/120);if(SK.bail)break;}
    const progress=rel(px-s.x)*s.c+rel(py-s.y)*s.s;if(progress<-.2||SK.bail)bad.push(['bank access blocked',s.id,progress,SK.bail]);
   }
  }
  // Elevated-base ramps must use rise above base, not absolute world height.
  const ramp=SKATE_STREET_FEATURES.find(o=>o.ramp==='kicker'),z0=ramp.z0,z1=ramp.z1;
  try{ramp.z0+=.2;ramp.z1+=.2;const h=rampHeight(ramp,0),surf=skateSurface(ramp.x,ramp.y),slope=(z1-z0)/(ramp.run||2*ramp.hl);
   if(Math.abs(h-(.2+z0+(z1-z0)*ramp.hl/(ramp.run||2*ramp.hl)))>1e-8||Math.abs(surf.n[2]-1/Math.hypot(1,slope))>1e-8)bad.push('elevated ramp normal');
   rayRamp(ramp.x,ramp.y,ramp.z1+.1,0,0,-1,ramp);if(Math.abs(HIT.w-h)>1e-8)bad.push('elevated ramp ray');
  }finally{ramp.z0=z0;ramp.z1=z1;}
  const stairs=SKATE_STREET_SITES.find(s=>s.type==='stairs'),rail=SKATE_STREET_FEATURES.find(o=>o.streetSite===stairs.id&&o.streetRail),path=GRIND_PATHS.find(p=>p.feature===rail);
  SK.bail=0;SK.v=.55;const at=grindPathAt(path,.02);a=SK.dir=Math.atan2(at.tangent[1],at.tangent[0]);body.trick=null;startPathGrind(path,.02,1);let speeds=[];
  for(let i=0;i<180&&SK.grind;i++){T+=1/120;SK.grind.bal=SK.grind.balV=0;stepPathGrind(1/120);speeds.push(SK.v);}
  if(Math.max(...speeds)<speeds[0]+.05)bad.push('downhill handrail did not accelerate');
  const count=SKATE_STREET_SITES.length,styles=new Set(SKATE_STREET_SITES.map(s=>s.type)).size,districts=new Set(SKATE_STREET_SITES.map(s=>s.district)).size;
  return {bad,count,styles,districts};
 });assert.deepEqual(r.bad,[]);assert.equal(r.count,14);assert.equal(r.styles,8);assert.ok(r.districts>=3);assert.deepEqual(errors,[]);
 await p.keyboard.press('KeyM');await p.locator('#bigmap input').fill('Four-step');assert.ok(await p.locator('[data-place]').count()>=1);await p.locator('[data-place]').first().click();assert.match(await p.locator('.place-detail').innerText(),/four 18 cm stairs/);await p.locator('[data-map="waypoint"]').click();assert.ok(await p.evaluate(()=>mapWaypoint.id.startsWith('skate-street:')));
 }finally{await b.close();}
});
