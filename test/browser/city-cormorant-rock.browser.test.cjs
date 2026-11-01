'use strict';
// ASCII City: Cormorant Rock. Stepped, tapering sea stacks with matching collision, cormorants' nests on every summit
// and ledge with birds sitting them, more wheeling round overhead, and the stacks' and the rock's own materials.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=100;tod=13;weather='clear';rain=0;fogAmt=0;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('the sea stacks are stepped, tapering tiers, each standing on the one below',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],tiers=ISLAND_OBSTACLES.filter(o=>o.kind==='stack');
  if(CORMORANT_SPIRES.length<5)bad.push(['spires',CORMORANT_SPIRES.length]);
  for(const [n,sp] of CORMORANT_SPIRES.entries()) {
   const own=tiers.filter(o=>o.spire===n).sort((a,b)=>a.tier-b.tier);
   if(own.length<3)bad.push([n,'tiers',own.length]);
   if(own[0].z0>terrainHeight(sp.x,sp.y))bad.push([n,'not in the ground']);
   const top=own[own.length-1];if(!top.top||top.z1-terrainHeight(sp.x,sp.y)<sp.h-1e-6)bad.push([n,'short']);
   for(const [k,o] of own.entries()) {
    if(!(o.rt<o.rb))bad.push([n,k,'does not taper']);
    // eight faces, every one leaning in (the same planes are drawn and collide)
    if(o.planes.filter(q=>(q[0]||q[1])&&q[2]>0).length!==8)bad.push([n,k,'walls do not lean in']);
    if(k){const below=own[k-1];
     if(Math.abs(o.z0-below.z1)>1e-9)bad.push([n,k,'gap or overlap']);
     if(!(o.rb<below.rt))bad.push([n,k,'no ledge']);
     if(Math.abs(landmarkSurfaceHeight(below,o.x,o.y)-o.z0)>1e-6)bad.push([n,k,'not standing on the tier below']);}
   }
  }
  // you can't walk through one, and it stops a shot
  const s=CORMORANT_SPIRES[1];px=s.x-s.r-.3;py=s.y;if(free(s.x,s.y)||free(s.x-s.r*.8,s.y))bad.push('walk through');
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('every summit carries nests seated on the rock, sat by black cormorants, and more on the ledges',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],nests=ISLAND_DETAILS.filter(o=>o.kind==='nest'),stacks=ISLAND_OBSTACLES.filter(o=>o.kind==='stack');
  for(const [n] of CORMORANT_SPIRES.entries()) {
   const top=stacks.find(o=>o.spire===n&&o.top),on=nests.filter(q=>Math.abs(q.z0-top.z1)<1e-6&&near(q.x,q.y,top.x,top.y)<top.rt);
   if(on.length<3)bad.push([n,'nests on top',on.length]);
  }
  for(const q of nests) { // the whole nest on rock: its rim all round and its middle at the height it sits at
   const base=Math.max(...stacks.map(o=>landmarkSurfaceHeight(o,q.x,q.y)));
   if(Math.abs(base-q.z0)>1e-6)bad.push(['floating',+q.x.toFixed(2),+q.y.toFixed(2)]);
   for(let k=0;k<8;k++){const a=k*TAU/8,x=q.x+Math.cos(a)*.025,y=q.y+Math.sin(a)*.025;
    if(Math.max(...stacks.map(o=>landmarkSurfaceHeight(o,x,y)))<q.z0-1e-6){bad.push(['over the edge',+q.x.toFixed(2),+q.y.toFixed(2)]);break;}}
   if(stacks.some(o=>o.z0>q.z0+1e-6&&o.z0<q.z1&&inBox({...o,c:1,s:0,hl:o.rb,hw:o.rb},q.x,q.y,0)&&landmarkSurfaceHeight(o,q.x,q.y)>0))bad.push('inside the tier above');
  }
  const sitting=ISLAND_BIRDS.filter(b=>b.nest);
  if(sitting.length<8)bad.push(['sitting',sitting.length]);
  for(const b of sitting){const q=nests.find(q=>near(q.x,q.y,b.x,b.y)<1e-6);if(!q||b.z<q.z0||b.z>q.z1)bad.push('not in its nest');for(let t=0;t<54;t+=1.5){const f=islandBirdPose(b,t).frame;if(f!==4&&f!==1&&f!==2){bad.push('not sitting');break;}}}
  if(ISLAND_CORMORANT_LOOK!==undefined&&!/cormorant/.test(ISLAND_CORMORANT_LOOK.shape))bad.push('not the cormorant body');
  // black birds, with the poses a cormorant has: standing, wings hung out to dry, sitting, flying
  const body=ANIMAL_BODIES.cormorant;for(const f of [0,1,2,3,4,5])if(!body(f).parts.length)bad.push(['frame',f]);
  const span=f=>Math.max(...body(f).parts.map(q=>Math.abs((q.b||q.c||[0])[0])));
  if(!(span(3)>span(0)*3))bad.push('wings not spread to dry');
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('cormorants wheel round the stacks above their tops, and can be seen doing it from the landing',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],at=(c,t)=>{const th=c.ph+t*c.w;return [c.cx+Math.cos(th)*c.r,c.cy+Math.sin(th)*c.r*.8];};
  if(ISLAND_CIRCLERS.length<12)bad.push(['circling',ISLAND_CIRCLERS.length]);
  if(ISLAND_CIRCLERS.filter(c=>c.kind==='cormorant').length<ISLAND_CIRCLERS.length*.7)bad.push('mostly cormorants');
  const tallest=Math.max(...ISLAND_OBSTACLES.filter(o=>o.kind==='stack').map(o=>o.z1));
  for(const c of ISLAND_CIRCLERS){
   const near_=CORMORANT_SPIRES.reduce((m,s)=>Math.min(m,near(c.cx,c.cy,s.x,s.y)),9);if(near_>.5)bad.push('not round a stack');
   const own=CORMORANT_SPIRES.reduce((m,s)=>near(c.cx,c.cy,s.x,s.y)<near(c.cx,c.cy,m.x,m.y)?s:m),top=terrainHeight(own.x,own.y)+own.h;
   if(c.z-.15<top)bad.push('into its stack');if(c.z>tallest+1)bad.push('too high');
   const [x0,y0]=at(c,0),[x1,y1]=at(c,1);if(near(x0,y0,x1,y1)<.2)bad.push('not moving');
  }
  // from the landing, looking at the stacks: the flock paints the sky (and nothing when it's taken away)
  const [lx,ly]=WILD_ISLANDS.find(i=>i.id==='rock').landing;px=lx;py=ly;a=Math.atan2(351-ly,702-lx);pitch=.05;env(0);
  for(let k=0;k<20;k++)render(0);const withBirds=Array.from(BG);
  const keep=ISLAND_CIRCLERS.splice(0);render(0);const without=Array.from(BG);ISLAND_CIRCLERS.push(...keep);
  const painted=withBirds.filter((v,i)=>v!==without[i]).length;if(painted<15)bad.push(['flock not seen',painted]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));

test('the stacks are layered rock streaked white, and the island is bare jointed rock, not a field of glyphs',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[],s=CORMORANT_SPIRES[1];
  // close in front of the tallest stack's face
  px=s.x-1.1;py=s.y;a=0;pitch=.25;env(0);render(0);
  const tones=new Set(),hues={};let glyphs=0,cells=0;
  for(let r_=0;r_<rows;r_++)for(let c=cols*.42|0;c<cols*.58;c++){const i=r_*cols+c;if(!(ZB[i]>0&&ZB[i]<1.6))continue;cells++;tones.add(BG[i]);hues[BG[i]>>4]=(hues[BG[i]>>4]||0)+1;if(CH[i]!==' ')glyphs++;}
  if(cells<200)bad.push(['stack not in view',cells]);
  if(tones.size<6)bad.push(['flat colour',tones.size]);
  if(!hues[WHITE])bad.push('no guano');
  if(glyphs>cells*.02)bad.push(['glyph texture on the rock',glyphs]);
  // the ground: no 'o' gravel left on the rock, and it is mostly bare grey stone
  let o=0,grey=0,n=0;for(let y=343;y<362;y+=.37)for(let x=690;x<705;x+=.37){const q=islandSurface(x,y);if(!q||seaAt(x,y))continue;n++;if(q.ch==='o')o++;if(q.background===GRAY)grey++;}
  if(o)bad.push(['gravel glyphs',o]);if(grey<n*.5)bad.push(['not mostly bare rock',grey,n]);
  return bad;
 });
 assert.deepEqual(r,[]);
}));
