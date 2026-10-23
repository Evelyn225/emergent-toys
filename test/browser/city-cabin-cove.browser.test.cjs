'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=26;tod=12;rain=snow=snowCover=0;body.z=body.vz=body.crouch=0;[px,py]=COVE_CABIN.door;env(0);render(0);});
  await page.keyboard.press('e');assert.equal(await page.evaluate(()=>room?.kind),'islandshelter');
  await run(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

test('rounded cabin joinery has curved normals, and the cup has a real open rim and recessed bottom',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  const box={x:0,y:0,c:1,s:0,hl:1,hw:.5,z0:0,z1:1,round:.1},normals=[];
  for(const x of [.91,.94,.97,.99]){const t=coveRayRounded(x,-2,.5,0,1,0,box);normals.push({t,x:HIT.nx,y:HIT.ny,n:Math.hypot(HIT.nx,HIT.ny,HIT.nz)});}
  const emptyCorner=coveRayRounded(.995,-2,.995,0,1,0,box),solidCenter=coveRayRounded(0,-2,.5,0,1,0,box);
  const cup={x:0,y:0,profile:COVE_CUP_PROFILE};
  const bottom=coveRayLathe(0,0,.5,0,0,-1,cup),bottomZ=HIT.w;
  const lip=coveRayLathe(.075,0,.5,0,0,-1,cup),lipZ=HIT.w;
  const side=coveRayLathe(0,-.4,.1,0,1,0,cup),outerRadius=Math.abs(HIT.v);
  const capsule={ax:0,ay:0,az:0,bx:0,by:0,bz:1,r:.1};
  const tubeSide=coveRayCapsule(.5,0,.5,-1,0,0,capsule),sideNormal=HIT.nx;
  const tubeCap=coveRayCapsule(0,0,2,0,0,-1,capsule),capZ=HIT.w;
  const tubeCorner=coveRayCapsule(.095,-2,1.095,0,1,0,capsule);
  return {normals,emptyCorner,solidCenter,bottom,lip,side,bottomZ,lipZ,outerRadius,tubeSide,sideNormal,tubeCap,capZ,tubeCorner};
 });
 assert.equal(r.emptyCorner,-1);assert.ok(r.solidCenter>0);
 for(let k=0;k<r.normals.length;k++){const n=r.normals[k];assert.ok(n.t>0);assert.ok(Math.abs(n.n-1)<1e-6);assert.ok(n.x>0&&n.y<0);if(k)assert.ok(n.x>r.normals[k-1].x);}
 assert.ok(r.bottom>0&&r.lip>0&&r.side>0);assert.ok(Math.abs(r.bottomZ-.035)<1e-6);assert.ok(Math.abs(r.lipZ-.19)<1e-6);assert.ok(r.outerRadius>.08&&r.outerRadius<.09);
 assert.ok(Math.abs(r.tubeSide-.4)<1e-9);assert.ok(Math.abs(r.sideNormal-1)<1e-9);assert.ok(r.tubeCap>0);assert.ok(Math.abs(r.capZ-1.1)<1e-9);assert.equal(r.tubeCorner,-1);
}));

test('cabin glass shows real moving world geometry, respects interior occlusion and caches unchanged views without leaking camera state',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  px=2.5;py=4.5;a=Math.PI;pitch=0;env(0);
  const inside=room,cell=CITY.cell,buffers=[CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL],heights=inside.grid,worldCells=Array.from({length:4},(_,k)=>map[idx(491+k%2,390+Math.floor(k/2))]);
  const sprites=CITY.sprites;let markerY=390.95;
  CITY.sprites=()=>{sprites();drawBox(boxAt(490.45-px,markerY-py,1,0,.11,.11,.07,.26),(i,t,L)=>{BG[i]=C(MAG,10);set(i,'Q',C(MAG,14));return true;});};
  const sample=()=>{const pixels=(COVE_VIEW.marks.get('west')||[]).filter(([i,d])=>Math.abs(ZB[i]-d)<.0001&&CH[i]==='Q').map(([i])=>i%cols);return {count:pixels.length,mean:pixels.reduce((a,b)=>a+b,0)/Math.max(1,pixels.length)};};
  try{
   render(0);const first=sample(),firstMarks=(COVE_VIEW.marks.get('west')||[]).filter(([i,d])=>Math.abs(ZB[i]-d)<.0001),passes=COVE_VIEW.passes;render(0);const cached=COVE_VIEW.passes===passes;
   markerY+=.18;T+=.1;render(0);const moved=sample();
   room.props.push(BX(1.3,4.5,.04,.45,1.1,2.1,(i,t,L)=>{BG[i]=C(BLUE,9);set(i,'P',C(WHITE,15));return true;}));
   T+=.1;render(0);const covered=(COVE_VIEW.marks.get('west')||[]).filter(([i,d])=>CH[i]==='P'&&ZB[i]<d).length;
   room.props.pop();inv.push({id:'rod',uses:0});held=inv.length-1;
   const rodBefore=JSON.stringify(rodView);COVE_VIEW.cache.clear();coveWindowScene('west',firstMarks);const rodUnchanged=rodBefore===JSON.stringify(rodView);inv.pop();held=-1;
   pitch=-2;const before=COVE_VIEW.passes;render(0);const skipped=COVE_VIEW.passes===before;
   const unchanged=mode==='room'&&room===inside&&px===2.5&&py===4.5&&a===Math.PI&&freecam===null&&CITY.cell===cell&&buffers.every((b,k)=>b===[CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL][k])&&worldCells.every((h,k)=>h===map[idx(491+k%2,390+Math.floor(k/2))])&&room.grid===heights&&!COVE_VIEW.active;
   return {first,moved,cached,covered,skipped,unchanged,rodUnchanged};
  }finally{CITY.sprites=sprites;}
 });
 assert.ok(r.first.count>30,JSON.stringify(r));assert.ok(r.moved.count>10);assert.ok(Math.abs(r.first.mean-r.moved.mean)>3,JSON.stringify(r));
 for(const key of ['cached','skipped','unchanged','rodUnchanged'])assert.equal(r[key],true,JSON.stringify(r));assert.ok(r.covered>30,JSON.stringify(r));
}));

test('masked window cells match a full outdoor render, including sea reflections, and frames share exterior opening measurements',()=>fixture(async page=>{
 const r=await page.evaluate(()=>{
  px=2.5;py=4.5;a=Math.PI;pitch=-.08;env(0);
  const original=render;let camera,mask;
  render=(dt,only,m)=>{if(only){camera={px,py,eye:freecam.z,amb,vis};mask=m;}return original(dt,only,m);};
  try{render(0);}finally{render=original;}
  const visible=(COVE_VIEW.marks.get('west')||[]).filter(([i,d])=>Math.abs(ZB[i]-d)<.0001),expected=visible.map(([i])=>[i,CH[i],COL[i],BG[i],FOGS[i],FOGB[i]]);
  const saved=[mode,room,px,py,freecam,amb,vis],cell=CITY.cell,c=COVE_CABIN;
  let differences=0,first;
  try{
   mode='walk';room=null;px=camera.px;py=camera.py;freecam={z:camera.eye};amb=camera.amb;vis=camera.vis;COVE_VIEW.active=true;
   CITY.cell=(x,y)=>x>=c.x0&&x<c.x1&&y>=c.y0&&y<c.y1?0:cell(x,y);
   original(0,true);
   for(const [i,ch,col,bg,fs,fb]of expected)if(CH[i]!==ch||COL[i]!==col||BG[i]!==bg||FOGS[i]!==fs||FOGB[i]!==fb){differences++;first||={i,expected:[ch,col,bg,fs,fb],actual:[CH[i],COL[i],BG[i],FOGS[i],FOGB[i]]};}
  }finally{CITY.cell=cell;COVE_VIEW.active=false;[mode,room,px,py,freecam,amb,vis]=saved;}
  const frames=COVE_WINDOWS.map(w=>{const e=coveExteriorWindow(w);return {face:w.face,insideWidth:w.half*2,outsideWidth:e.half*20,heightError:Math.abs(e.bottom*10-w.bottom)+Math.abs(e.top*10-w.top),onWall:w.face==='west'?e.x===c.x0:w.face==='east'?e.x===c.x1:w.face==='north'?e.y===c.y0:e.y===c.y1};});
  // Exercise reflective water as well as the actual cabin view. Reflection
  // source pixels can lie outside the visible glass mask.
  mode='walk';room=null;freecam={z:.24};px=MARINA.x;py=MARINA.end-.2;a=Math.PI/2;pitch=-.15;env(0);original(0,true);
  const sea=[];for(let row=hor+3;row<rows-4;row++)for(let col=Math.floor(cols*.35);col<cols*.65;col++){const i=row*cols+col;if(FL[i]===3)sea.push([i,CH[i],COL[i],BG[i],FOGS[i],FOGB[i]]);}
  const seaMask=coveWindowMask(sea);ZB.fill(0);FL.fill(0);FOGS.fill(0);FOGB.fill(0);original(0,true,seaMask);
  let seaDifferences=0;for(const [i,ch,col,bg,fs,fb]of sea)if(CH[i]!==ch||COL[i]!==col||BG[i]!==bg||FOGS[i]!==fs||FOGB[i]!==fb)seaDifferences++;
  return {visible:visible.length,differences,first,maskCells:mask.cells.reduce((a,b)=>a+b,0),total:cols*rows,frames,signBlack:ISLAND_DETAILS.find(o=>o.word==='CABIN COVE').ink===BLACK,sea:sea.length,seaDifferences};
 });
 assert.ok(r.visible>100,JSON.stringify(r));assert.equal(r.differences,0,JSON.stringify(r));assert.ok(r.maskCells<r.total*.9,JSON.stringify(r));
 for(const frame of r.frames){assert.equal(frame.onWall,true);assert.ok(Math.abs(frame.insideWidth-frame.outsideWidth)<1e-9);assert.ok(frame.heightError<1e-9);}
 assert.equal(r.signBlack,true);assert.ok(r.sea>30,JSON.stringify(r));assert.equal(r.seaDifferences,0,JSON.stringify(r));
}));
