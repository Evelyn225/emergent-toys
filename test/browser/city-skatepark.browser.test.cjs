'use strict';
// ASCII City: the skatepark and grinding, and flip tricks that land going uphill.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=100;tod=13;env(0);render(0);
  clearInventory();carryItem({id:'skateboard',uses:0});fx.skating=true;third=false;
  // ride n frames at 60 fps with these keys held
  window.tRide=(n,keys={})=>{for(let k=0;k<n;k++){Object.assign(K,keys);T+=1/60;stepSkate(1/60);stepBody(1/60);for(const k2 in keys)K[k2]=0;}};
  // line up a run along a grind edge from `back` cells before its start, rolling at v, and pop after `popAt` frames
  window.tRun=(g,{back=.25,v=.6,popAt=8,keys={},hold={},off=g.kind==='skaterail'?0:.07}={})=>{const ux=g.bx-g.ax,uy=g.by-g.ay,L=Math.hypot(ux,uy);
   px=g.ax-ux/L*back+uy/L*off;py=g.ay-uy/L*back-ux/L*off;a=Math.atan2(uy,ux);body.z=body.vz=0;body.trick=null;SK.lastT=T;SK.v=v;SK.dir=a;SK.bail=0;SK.grind=null;SK.combo=null;SK.score=0;tRide(1);
   for(let k=0;k<80&&!SK.grind&&SK.bail<=0;k++){if(k===popAt){Object.assign(K,keys);skatePop();for(const k2 in keys)K[k2]=0;}tRide(1,hold);}};
 });
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the skatepark: real ledges, bars and a pad on concrete in a park, every bench and park edge grindable',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];if(!SKATEPARK)return ['no skatepark'];
  if(SKATE_FEATURES.length<5)bad.push(['features',SKATE_FEATURES.length]);
  for(const o of SKATE_FEATURES){
   if(!inSkatepark(o.x,o.y))bad.push(['outside',o.kind]);
   if(!solidsB[bi(Math.floor(o.x/8),Math.floor(o.y/8))].includes(o))bad.push(['not collidable',o.kind]);
   if(o.ramp)continue; // (a ramp you roll up, not a block you bump: its own test)
   if(Math.abs(skateparkGround(o.x,o.y)-o.z1)>1e-9)bad.push(['no top to ride',o.kind]);
   // walking you bump into it; with your feet above its top you clear it
   if(!solidAt(o.x,o.y,.03,0))bad.push(['walk through',o.kind]);if(solidAt(o.x,o.y,.03,o.z1+.001))bad.push(['cannot clear',o.kind]);
  }
  if(trees.some(t=>inSkatepark(t.x,t.y,.3)))bad.push('trees on the concrete');
  const park=GRINDS.filter(g=>g.kind!=='bench'),bench=GRINDS.filter(g=>g.kind==='bench');
  if(park.length<7)bad.push(['park edges',park.length]);
  if(bench.length<benches.filter(b=>!b.shelter).length*.9)bad.push(['bench edges',bench.length,benches.length]);
  if(new Set(GRIND_PATHS.filter(p=>p.kind==='kerb').map(p=>p.district)).size<3)bad.push('kerbs need at least three districts');
  if(!GRIND_PATHS.some(p=>p.kind==='handrail'&&p.segments.some(s=>Math.abs(s.d[2])>.01)))bad.push('no sloping handrails');
  if(!mapDirectory().some(p=>p.id==='skatepark'))bad.push('not on the map');
  // the concrete is drawn as concrete
  px=SKATEPARK.bx*8+5.3;py=SKATEPARK.by*8+5.2;a=.75;pitch=-.3;env(0);render(0);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('ollie onto a bar going along it and you grind: points while you hold it, off the end into the combo',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const g=GRINDS.find(g=>g.kind==='skaterail');tRun(g);
  const on={grind:!!SK.grind,name:SK.grind?.name,approach:!SK.grind?{v:SK.v,z:body.z,bail:SK.bail,msg:msgText,x:px-g.ax,y:py-g.ay}:null};const top=terrainHeight(g.x,g.y)+g.z;
  const feet=skateGround(px,py)+body.z/10;tRide(20);const mid={grind:!!SK.grind,msg:msgText,onEdge:Math.abs(skateGround(px,py)+body.z/10-top)<1e-3};
  // Lower material friction carries a run along the whole 20 m rail. Keep
  // balance during that longer ride, then allow the combo clock to bank it.
  for(let i=0;i<360;i++){
   const lean=SK.grind?Math.sign(SK.grind.bal*2+SK.grind.balV):0;
   tRide(1,!SK.grind?{KeyS:1}:lean>0?{KeyD:1}:lean<0?{KeyA:1}:{});
  }
  return {on,feet:+(feet-top).toFixed(4),mid,score:SK.score,bail:SK.bail,ground:body.z,msg:msgText};
 });
 assert.ok(r.on.grind&&r.on.name==='50-50',JSON.stringify(r.on));
 assert.ok(Math.abs(r.feet)<1e-3,'standing on the bar: '+r.feet);
 assert.ok(r.mid.grind&&r.mid.onEdge&&/^50-50  \d+$/.test(r.mid.msg),JSON.stringify(r.mid));
 assert.ok(r.score>150&&r.bail<=0&&r.ground===0,'banked, rolled away: '+JSON.stringify(r));
}));

test('grinds are named by how the board sits, pop off with a flip into a combo, and leaning the wrong way bails',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const g=GRINDS.find(g=>g.kind==='skateledge'),out={};
  tRun(g,{hold:{ArrowUp:1}});out.nose=SK.grind?.name;
  tRun(g);const edgeA=Math.atan2(g.by-g.ay,g.bx-g.ax);
  // turned across it as it locks on: rerun with the board swung round in the air
  tRun(g,{popAt:8});if(SK.grind){SK.grind=null;}
  const cross=()=>{const ux=g.bx-g.ax,uy=g.by-g.ay,L=Math.hypot(ux,uy);px=g.ax+ux/L*.06;py=g.ay+uy/L*.06;SK.dir=edgeA;a=edgeA+Math.PI/2;SK.v=.6;SK.grind=null;SK.bail=0;
   body.z=(terrainHeight(g.x,g.y)+g.z-skateGround(px,py))*10+.05;body.vz=-.5;grindCatch();};
  cross();out.cross=SK.grind?.name;
  // pop off with a kickflip, land: the combo has both
  tRun(g);tRide(10);K.ArrowLeft=1;skateSpace(true);K.ArrowLeft=0;for(let k=0;k<90&&(body.z>0||body.vz>0);k++)tRide(1);
  out.combo=SK.combo?.names.join(' + ')||'';out.bailPop=SK.bail;
  // lean hard the wrong way and you come off
  tRun(GRINDS.find(g=>g.kind==='skaterail'));let k=0;for(;k<200&&SK.grind;k++){const side=Math.sign(SK.grind.bal||1);tRide(1,side>0?{KeyA:1}:{KeyD:1});}
  out.lost=SK.bail>0&&/balance/.test(msgText);
  return out;
 });
 assert.equal(r.nose,'nosegrind');
 assert.ok(['lipslide','boardslide'].includes(r.cross),'across it: '+r.cross);
 assert.match(r.combo,/^50-50 \+ KICKFLIP$/);assert.ok(!(r.bailPop>0));
 assert.ok(r.lost,'leaning into the wobble throws you off');
}));

test('flip tricks land going uphill (and down): the flip times itself to the slope',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  // a bridge ramp: find where the road climbs, ride up it and kickflip
  const b=ROAD_BRIDGES[0],out=[];
  for(const [y0,dir] of [[b.y0+.5,1],[b.y1-.5,-1]]){
   px=b.x;py=y0;a=Math.PI/2*dir;SK.dir=a;SK.v=.8;SK.lastT=T;SK.bail=0;SK.combo=null;body.z=body.vz=0;body.trick=null;tRide(1);
   const g0=walkGround(px,py);SK.charge=T-.6;skatePop('A');for(let k=0;k<120&&(body.z>0||body.vz>0);k++)tRide(1);
   out.push({rise:+(walkGround(px,py)-g0).toFixed(3),bail:SK.bail>0,msg:msgText});
  }
  return out;
 });
 for(const s of r)assert.ok(s.rise>0&&!s.bail&&/KICKFLIP/.test(s.msg),JSON.stringify(r));
}));

test('the skatepark\'s ramps: a funbox you roll over (its deck edges grind) and a kicker that throws you off its lip',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const k=SKATE_FEATURES.find(o=>o.ramp==='kicker'),fb=SKATE_FEATURES.find(o=>o.ramp==='funbox');if(!k||!fb)return{missing:true};
  const run=(sx,sy,dir,v,frames)=>{px=sx;py=sy;a=dir;body.z=body.vz=0;body.trick=null;fx.skating=true;mode='walk';SK.lastT=T;SK.v=v;SK.dir=dir;SK.grind=null;SK.bail=0;
   let peak=0,top=0;for(let f=0;f<frames;f++){T+=1/60;stepSkate(1/60);stepBody(1/60);peak=Math.max(peak,body.z);top=Math.max(top,skateparkGround(px,py));}
   return{peak,top,end:px-sx};};
  // Start just before the bank. The old .4-cell run-in started on a separate
  // ledge; Phase 1 correctly makes leaving that ledge airborne instead of
  // snapping the wheels to the ground, obscuring this funbox-only assertion.
  const kick=run(k.x-k.hl-.4,k.y,0,.75,90),fun=run(fb.x-fb.hl-.1,fb.y,0,.75,160);
  const deck=GRINDS.filter(g=>g.feature===fb).length,long=Math.max(...GRINDS.filter(g=>g.kind!=='bench').map(g=>Math.hypot(g.bx-g.ax,g.by-g.ay)));
  const size=[(SKATEPARK.x1-SKATEPARK.x0)*10,(SKATEPARK.y1-SKATEPARK.y0)*10];
  return{kick,fun,deck,long,size};});
 assert.ok(!r.missing,'a kicker and a funbox');
 assert.ok(r.kick.peak>.4,'off the kicker you are airborne '+JSON.stringify(r.kick));
 assert.ok(r.fun.top>.04&&r.fun.peak<.05&&r.fun.end>1.1,'over the funbox and down the far side, without a launch '+JSON.stringify(r.fun));
 assert.equal(r.deck,2,'both deck edges grind');assert.ok(r.long>=1.9,'a 20 m line to grind');
 assert.ok(r.size[0]>=50&&r.size[1]>=50,'a park about 50 m across '+r.size);
}));

test('a slow bank climb stalls and rolls back fakie; board state and surface normal follow the ramp',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const fb=SKATE_FEATURES.find(o=>o.ramp==='funbox');
  px=fb.x-fb.hl+.08;py=fb.y;a=0;SK.dir=0;SK.v=.08;SK.lastT=T;
  SK.bail=0;SK.grind=null;body.z=body.vz=0;body.trick=null;
  const start=px,s=skateSurface(px,py);let peak=px;
  for(let i=0;i<60;i++){tRide(1);peak=Math.max(peak,px);}
  return {start,peak,x:px,yaw:a,fakie:SKB.fakie,vx:SKB.v[0],stance:SK.stance,
   kind:s.kind,n:s.n,position:SKB.p,legacy:[px,py,skateGround(px,py)+body.z/10],contact:SKB.contact};
 });
 assert.equal(r.kind,'funbox');assert.ok(r.n[0]<0&&r.n[2]>.9);
 assert.ok(r.peak>r.start&&r.x<r.start&&r.vx<0,JSON.stringify(r));
 assert.equal(r.fakie,true);assert.equal(r.stance,1);assert.ok(Math.abs(r.yaw)<1e-6);
 assert.deepEqual(r.position,r.legacy);assert.equal(r.contact,'ground');
}));
