'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);
}finally{await p.close();}}

test('gully grates lie in the gutter against the kerb, never on a bridge or a lane; their bars blend to an even tone far off',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let gullies=0;
  for(let by=0;by<NB;by++)for(let bx=0;bx<NB;bx++)for(const road of [1,2]){
   if(!(road===1?vseg(bx,by):hseg(bx,by)))continue;
   for(const a of GULLY.at)for(const e of [.32,1.68]){
    if(!gullyAt(road,e,a,bx,by))continue;gullies++;
    if(road===1&&onBridge(bx,by))bad.push('on a bridge');
    // the whole grate is in the gutter: road side of the kerb (0.3 / 1.7), clear of the lane where manholes go
    for(let q=0;q<=2;q+=.004)if(gullyAt(road,q,a,bx,by)&&(q<.3||q>1.7||(q>.36&&q<1.64)))bad.push(['out of the gutter',+q.toFixed(3)]); // (across the whole street)
    if(gullyAt(road,e,a+GULLY.half+.002,bx,by))bad.push('longer than its frame');
   }
  }
  // near: bars and slots alternate; far: one even tone
  const near=new Set(),far=new Set();for(let k=0;k<40;k++){const q=k*.0011;near.add(grateBars(q,GULLY.bar,.0005));far.add(grateBars(q,GULLY.bar,.01));}
  return {bad:bad.slice(0,8),gullies,near:[...near].sort(),far:[...far]};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.gullies>300,`plenty of gullies: ${r.gullies}`);
 assert.deepEqual(r.near,[0,1]);assert.equal(r.far.length,1);
}));

test('rain runs along the gutter into the grates, and only in the rain; street trees stand in grates inside the pavement; vents sit beside the subway steps',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let bx=-1,by=-1;
  for(let y=3;y<NB&&bx<0;y++)for(let x=0;x<NB;x++)if(hseg(x,y)&&!onBridge(x,y)&&gullyAt(2,.32,GULLY.at[0],x,y)){bx=x;by=y;break;}
  const runoff=r=>{rain=r;let n=0,farN=0;for(let s=GULLY.at[0]-.6;s<GULLY.at[0]+.6;s+=.01){const w=gutterRunoff(2,.305,s,bx,by,8);if(w&&w[0]==='~'){n++;if(Math.abs(s-GULLY.at[0])>.5)farN++;}}return [n,farN];};
  const [dry]=runoff(0),[wet,far]=runoff(.8);rain=0;
  if(dry)bad.push('runoff with no rain');if(!wet)bad.push('no runoff in the rain');if(far)bad.push('runoff away from any grate');
  const roadTrees=trees.filter(t=>[1,2].includes(ROAD[idx(Math.floor(t.x),Math.floor(t.y))])&&!isWater(t.x,t.y)),kerbTrees=roadTrees.filter(treeHasPit);
  const soilAt=t=>streetGrateCell(t.x,t.y+.005,8,.05,ROAD[idx(Math.floor(t.x),Math.floor(t.y))],Math.floor(t.x/8),Math.floor(t.y/8))?.[0]===':';
  for(const t of roadTrees)if(!treeHasPit(t)&&soilAt(t))bad.push('a pit dug into the road'); // (trees the fitting left in the road get none)
  if(roadTrees.length-kerbTrees.length>3)bad.push(['street trees out of the pavement',roadTrees.length-kerbTrees.length]);
  for(const t of kerbTrees){const road=ROAD[idx(Math.floor(t.x),Math.floor(t.y))],e=road===1?mod(t.x,8):mod(t.y,8); // (across its street)
   const across=e<1?e:2-e;if(across+TREE_GRATE.half>.3+1e-9)bad.push(['tree grate into the road',+across.toFixed(3)]);
   const g=streetGrateCell(t.x+TREE_GRATE.hole+.005,t.y,8,.05,ROAD[idx(Math.floor(t.x),Math.floor(t.y))],Math.floor(t.x/8),Math.floor(t.y/8)),soil=streetGrateCell(t.x,t.y+.005,8,.05,ROAD[idx(Math.floor(t.x),Math.floor(t.y))],Math.floor(t.x/8),Math.floor(t.y/8));
   if(!g||!soil||soil[0]!==':')bad.push(['no grate round a street tree',t.x,t.y]);}
  for(const s of stations){const v=streetGrateCell(s.x+VENT_GRATE.off,s.y,8,.05,2,Math.floor(s.x/8),Math.floor(s.y/8));if(!v)bad.push(['no vent at a station',s.name]);
   if(VENT_GRATE.off-VENT_GRATE.hl<SUBWAY_HOLE[0]+.05)bad.push('vent over the steps');}
  return {bad:bad.slice(0,8),trees:kerbTrees.length};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.trees>20);
}));

test('cellar hatches lie flush beside shop doors, against the wall inside the pavement, clear of the walking line and the machines',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];hatchesNear(0,0);
  for(const h of HATCHES){
   const near=doors.filter(d=>Math.abs(rel(d.x-h.nx*.12-h.x))<.3&&Math.abs(rel(d.y-h.ny*.12-h.y))<.3);
   if(!near.some(d=>d.sh&&d.sh.kind!==SHOP_APTS))bad.push('not beside a shop door');
   if(!(map[idx(Math.floor(h.x-h.nx*.05),Math.floor(h.y-h.ny*.05))]>0))bad.push('no wall behind');
   for(const [u,v] of [[-HATCH.hl,HATCH.out0],[HATCH.hl,HATCH.out1],[0,(HATCH.out0+HATCH.out1)/2]]){const x=h.x+h.c*u+h.nx*v,y=h.y+h.s*u+h.ny*v;if(map[idx(Math.floor(x),Math.floor(y))]||!ROAD[idx(Math.floor(x),Math.floor(y))])bad.push('off the pavement');}
   if(HATCH.out1+.02>.12)bad.push('into the walking line');
   if(machines.some(m=>Math.abs(rel(m.x-h.x-h.nx*.043))<.12&&Math.abs(rel(m.y-h.y-h.ny*.043))<.12))bad.push('under a vending machine');
   // painted: the frame, the seam, the plate; the plate an even tone far off
   const mx=h.x+h.nx*.043,my=h.y+h.ny*.043,seen=new Set();
   for(let u=-HATCH.hl+.002;u<HATCH.hl-.002;u+=.0021)for(let v=HATCH.out0+.002;v<HATCH.out1-.002;v+=.0023){const c=hatchCell(h.x+h.c*u+h.nx*v,h.y+h.s*u+h.ny*v,8,.0005);if(!c){bad.push('a hole in the hatch');break;}seen.add(c[2]);}
   const far=new Set();for(const sd of [-1,1])for(let u=.018;u<.034;u+=.0011)far.add(hatchCell(h.x+h.c*u*sd+h.nx*.055,h.y+h.s*u*sd+h.ny*.055,8,.01)?.[2]); // (bare plate: clear of the seam, rings, hinges and frame)
   if(seen.size<3)bad.push(['too plain up close',seen.size]); // (the seam, the plate and its raised diamonds)
   if(far.size!==1)bad.push(['plate still patterned far off',far.size]);
  }
  return {bad:bad.slice(0,8),n:HATCHES.length};
 });
 assert.deepEqual(r.bad,[]);assert.ok(r.n>100,`hatches: ${r.n}`);
}));
