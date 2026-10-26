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
 assert.ok(r.near[0]<.01&&r.near.at(-1)>.99,'distinct bars and slots remain close up');assert.equal(r.far.length,1);
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

test('whole tree grates cross ground-cell boundaries, filtering transitions continuously and bridge runoff stays absent',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const bad=[];let checked=0,bridge=0;
  const test=(yes,why)=>{if(!yes)bad.push(why);};
  for(const t of trees.filter(treeHasPit)){
   const road=ROAD[idx(Math.floor(t.x),Math.floor(t.y))],bx=Math.floor(t.x/8),by=Math.floor(t.y/8);
   for(const [u,v]of [[-.03,0],[.03,0],[0,-.03],[0,.03],[-.035,-.035],[.035,.035]]){
    const g=streetGrateCell(t.x+u,t.y+v,8,.03,road,bx,by);test(!!g&&g[0]===' ','tree grate clipped at a ground-cell boundary');checked++;
   }
   const first=treePitCells;treePitsNear(t.x+.02,t.y);test(treePitCells===first,'tree-pit index rebuilt each lookup');
  }
  for(let by=0;by<NB;by++)for(let bx=0;bx<NB;bx++)if(vseg(bx,by)&&onBridge(bx,by)){
   rain=1;for(let n=0;n<30;n++){T=n*.08;for(const a of GULLY.at){test(!gutterRunoff(1,.305,a+.2,bx,by,8),'runoff drains toward absent bridge gully');bridge++;}}
  }
  rain=0;
  for(let n=0;n<80;n++){
   const q=(n+.17)*GULLY.bar/19,a=grateBars(q,GULLY.bar,GULLY.bar*(.35-1e-5)),b=grateBars(q,GULLY.bar,GULLY.bar*(.35+1e-5));
   test(Math.abs(a-b)<.001,'bar filtering pops at its old distance threshold');
   test(Math.abs(grateBars(q,GULLY.bar,GULLY.bar*1.01)-.45)<1e-9,'distant grate does not average its real iron area');
  }
  for(const bar of [0,.25,.5,.75,1]){const out=grateTone(bar,false,8);test(out[0]===' '&&out[2]===C(GRAY,.25+bar*(1.05+.8)),'filtered coverage not used by rendered material');}
  return {bad:bad.slice(0,12),checked,bridge};
 });assert.deepEqual(r.bad,[]);assert.ok(r.checked>120);assert.ok(r.bridge>0,'native bridge deck exercised');
}));

test('the native ground renderer visibly draws gullies, tree grates and subway vents at their actual positions',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='walk';room=me=null;rain=snow=0;body.z=0;const scenes=[];
  for(let by=3;by<NB&&scenes.length===0;by++)for(let bx=3;bx<NB;bx++)if(hseg(bx,by)&&gullyAt(2,.32,GULLY.at[0],bx,by)){
   const x=bx*8+GULLY.at[0],y=by*8+.32;if(free(x+.06,y+.09)){scenes.push({name:'gully',x,y,cx:x+.06,cy:y+.09,h:.03});break;}
  }
  const t=trees.find(t=>treeHasPit(t)&&free(t.x+.09,t.y+.09));if(t)scenes.push({name:'tree',x:t.x,y:t.y,cx:t.x+.09,cy:t.y+.09,h:TREE_GRATE.half});
  const st=stations.find(st=>free(st.x+VENT_GRATE.off+.08,st.y+.09));if(st)scenes.push({name:'vent',x:st.x+VENT_GRATE.off,y:st.y,cx:st.x+VENT_GRATE.off+.08,cy:st.y+.09,h:VENT_GRATE.hl});
  const out=[],paint=streetGrateCell;
  for(const q of scenes){
   px=q.cx;py=q.cy;a=Math.atan2(q.y-py,q.x-px);const base=terrainHeight(q.x,q.y);freecam={z:base+.12};pitch=0;env(0);render(0);pitch=-.12/Math.hypot(q.x-px,q.y-py)*projY/rows;
   streetGrateCell=(x,y,...args)=>{const v=paint(x,y,...args);return v&&Math.abs(rel(x-q.x))<q.h+.001&&Math.abs(rel(y-q.y))<q.h+.001?[' ',0,C(MAG,15)]:v;};
   try{render(0);out.push({name:q.name,clear:free(px,py),pixels:Array.from(BG).filter(c=>c===C(MAG,15)).length});}finally{streetGrateCell=paint;}
  }freecam=null;return out;
 });assert.deepEqual(r.map(x=>x.name),['gully','tree','vent']);for(const x of r){assert.equal(x.clear,true);assert.ok(x.pixels>4,`${x.name} not present in actual ground raster: ${x.pixels}`);}
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

test('hatch indexing covers every actual plate cell and keeps its seam and diamond surface filtered at distance',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof hatchPlate!=='function')return {bad:['no continuous hatch surface'],n:0};
  hatchesNear(0,0);const bad=[],first=hatchCells;let n=0;const test=(yes,why)=>{if(!yes)bad.push(why);};
  const refs=new Map();for(const list of hatchCells.values())for(const h of list)refs.set(h,(refs.get(h)||0)+1);
  for(const h of HATCHES){n++;
   test(refs.get(h)<=4,'hatch index includes unrelated neighbour cells');
   for(const u of [-HATCH.hl+.001,0,HATCH.hl-.001])for(const v of [HATCH.out0+.001,(HATCH.out0+HATCH.out1)/2,HATCH.out1-.001]){
    const x=h.x+h.c*u+h.nx*v,y=h.y+h.s*u+h.ny*v;test(hatchesNear(x,y)?.includes(h)&&!!hatchCell(x,y,8,.0005),'hatch clipped at a cell boundary');
   }
   test(hatchCells===first,'hatch cell cache rebuilt per sample');
   const hinge=hatchCell(h.x+h.c*.028+h.nx*.02,h.y+h.s*.028+h.ny*.02,8,.0005);test((hinge[2]&15)>=2,'hinge looks like a black cut-out');
   const rx=h.x+h.c*.015+h.nx*.043,ry=h.y+h.s*.015+h.ny*.043;test((hatchCell(rx,ry,12,.0005)[2]&15)>(hatchCell(rx,ry,0,.0005)[2]&15),'lifting ring ignores ambient light');
   for(const [u,v,f]of [[.02,.055,.08],[.015,.043,.03]]){const x=h.x+h.c*u+h.nx*v,y=h.y+h.s*u+h.ny*v;test(hatchCell(x,y,8,f)?.[2]===C(GRAY,1.8),'unfiltered seam or ring persists at distance');}
   const v=.055;
   for(const u of [.02,.024,.028]){
    const x=h.x+h.c*u+h.nx*v,y=h.y+h.s*u+h.ny*v,out=hatchCell(x,y,8,.025),expected=C(GRAY,1.15+8*.08+.3276*.5);
    test(out?.[2]===expected,'distant material keeps unfiltered rings, ridges or wide seam');
   }
  }
  for(let k=0;k<80;k++){
   const u=k*.00123,v=.055,a=hatchPlate(u,v,HATCH.plate*(.4-1e-5)),b=hatchPlate(u,v,HATCH.plate*(.4+1e-5));
   test(Math.abs(a-b)<.001,'diamond plate pops at old distance threshold');
   test(Math.abs(hatchPlate(u,v,.03)-.3276)<1e-9,'distant ridges do not use their real area average');
  }
  return {bad:bad.slice(0,12),n};
 });assert.deepEqual(r.bad,[]);assert.ok(r.n>100);
}));

test('native cellar hatch surfaces are visible from clear pavement beside their shop doors',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='walk';room=me=null;rain=snow=0;body.z=0;hatchesNear(0,0);
  const h=HATCHES.find(h=>free(h.x+h.nx*.16+h.c*.06,h.y+h.ny*.16+h.s*.06));if(!h)throw Error('no clear hatch approach');
  const x=h.x+h.nx*.043,y=h.y+h.ny*.043;px=h.x+h.nx*.16+h.c*.06;py=h.y+h.ny*.16+h.s*.06;a=Math.atan2(y-py,x-px);
  const base=terrainHeight(x,y);freecam={z:base+.10};pitch=0;env(0);render(0);pitch=-.10/Math.hypot(x-px,y-py)*projY/rows;
  const paint=hatchCell;hatchCell=(wx,wy,...args)=>{const v=paint(wx,wy,...args);return v&&Math.abs(rel(wx-x))<.09&&Math.abs(rel(wy-y))<.09?[' ',0,C(MAG,15)]:v;};
  try{render(0);return {clear:free(px,py),pixels:Array.from(BG).filter(c=>c===C(MAG,15)).length};}finally{hatchCell=paint;freecam=null;}
 });assert.equal(r.clear,true);assert.ok(r.pixels>4,'hatch absent from actual ground raster');
}));

test('the apartment exception removes a hatch even when the same door otherwise has valid wall and pavement clearance',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  hatchesNear(0,0);const h=HATCHES[0];
  const owner=doors.find(d=>{
   if(!d.sh||d.sh.kind===SHOP_APTS)return false;const n=Math.hypot(d.nx,d.ny)||1,nx=-d.nx/n,ny=-d.ny/n,c=Math.abs(ny),s=Math.abs(nx),side=hash(Math.floor(d.x*5),Math.floor(d.y*5),1461)<.5?-1:1;
   return Math.hypot(rel(d.x-nx*.12+c*side*HATCH.along-h.x),rel(d.y-ny*.12+s*side*HATCH.along-h.y))<1e-8;
  });if(!owner)return {owner:false};
  const original=owner.sh;try{owner.sh={...original,kind:SHOP_APTS};hatchCount=-1;hatchesNear(0,0);return {owner:true,removed:!HATCHES.some(q=>Math.hypot(rel(q.x-h.x),rel(q.y-h.y))<1e-8)};}finally{owner.sh=original;hatchCount=-1;hatchesNear(0,0);}
 });assert.equal(r.owner,true,'an actually placed hatch has a native owning door');assert.equal(r.removed,true,'apartment door gets cellar hatch');
}));
