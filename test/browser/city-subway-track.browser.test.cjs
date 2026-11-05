'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1170,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{tod=14;env(0);render(0);paused=false;body.z=body.vz=body.crouch=0;enterRoom('station',{st:0,word:stations[0].name,t0:0,ret:[px,py,a]},[23,10.8,Math.PI/2]);T=12;render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('subway rails have physical supported joints in a closed recessed track bed, with floor depth below platform level',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof SUBWAY_TRACK==='undefined')return {bad:['flat painted track']};
  const S=SUBWAY_TRACK,parts=room.props.filter(p=>p.subwayTrackRole),bad=[];
  const hit=(x,y,z,rx,ry,rz)=>{let d=Infinity,role=null;for(const p of parts){const t=rayBox(x,y,z,rx,ry,rz,p.box);if(t>=0&&t<d){d=t;role=p.subwayTrackRole;CH[0]='?';p.shade(0,t,10);if(CH[0]!==' ')bad.push('track surface glyph');}}return {d,role};};
  for(const side of [-1,1]){const y=S.centre+side*S.gauge/2;
   const head=hit(7.05,y,1,0,0,-1),joint=hit(7,y,1,0,0,-1);
   if(head.role!=='rail-head'||Math.abs(1-head.d-S.railTop)>1e-8||joint.role!=='rail-web'||joint.d-head.d<.03)bad.push(['no physical rail joint',head,joint]);
   const foot=hit(7.05,y+.06,1,0,0,-1);if(foot.role!=='rail-foot')bad.push('unsupported rail web');
  }
  const sleeper=parts.find(p=>p.subwayTrackRole==='sleeper');if(!sleeper||sleeper.box.z0!==S.bed||sleeper.box.z1!==S.sleeperTop)bad.push('floating sleepers');
  for(const [x,y,rx,ry,role]of [[23,12,0,-1,'platform-face'],[8,12.5,0,-1,'tunnel-face'],[9.5,11.7,-1,0,'platform-return'],[36.5,11.7,1,0,'platform-return'],[23,14.5,0,1,'back-face'],[1.2,14,-1,0,'end-face'],[44.8,14,1,0,'end-face']]){
   const h=hit(x,y,-.5,rx,ry,0);if(h.role!==role||!Number.isFinite(h.d))bad.push(['open pit face',role,h]);
  }
  const row=rows-1,d0=eye*projY/(row-hor+.5);roomFloor(0,row,0,0,(14-py)/d0);
  const depth=ZB[0],expected=(eye-S.bed)/eye*d0;
  if(Math.abs(depth-expected)>.0001||CH[0]!==' ')bad.push(['bed at platform height',depth,expected]);
  if(!(room.H-1>S.centre+SUBWAY_CAR.hw))bad.push('train clips tunnel back wall');
  px=23;py=11.1;move(0,.4);if(py>11.2)bad.push('player can fall onto track');
  return {bad,parts:parts.length};
 });assert.deepEqual(r.bad,[],JSON.stringify(r));assert.ok(r.parts>80);
}));
test('moving subway cars retain round wheelsets on both rails, joined bearings, frames and body pivots',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  if(typeof SUBWAY_TRACK==='undefined')return {bad:['no train bogies']};
  const S=SUBWAY_TRACK,bad=[],counts=[];
  for(const phase of [4,6,12,17.5,19,23]){
   T=phase;const parts=[],old=drawBox;try{drawBox=(box,shade,ray=rayBox)=>parts.push({box,shade,ray});drawSubwayTrainCar(trainX(room),S.centre,0);}finally{drawBox=old;}
   const wheels=parts.filter(p=>p.box.subwayRole==='wheel');counts.push(parts.length);
   if(wheels.length!==8)bad.push(['missing wheels',phase,wheels.length]);
   for(const p of wheels){const b=p.box,rail=S.centre+b.subwaySide*S.gauge/2;
    if(Math.abs(b.y-rail)>1e-9||Math.abs(b.z0-S.railTop)>1e-9)bad.push(['wheel off rail',phase,b]);
    const bottom=p.ray(b.x,b.y,-2,0,0,1,b);if(Math.abs(-2+bottom-S.railTop)>1e-8)bad.push('wheel tread does not contact rail head');
    const corner=p.ray(b.x+S.wheelRadius*.9,b.y-.2,b.centerZ+S.wheelRadius*.9,0,1,0,b);if(corner>=0)bad.push('square wheel silhouette');
    const face=p.ray(b.x,b.y-.2,b.centerZ,0,1,0,b);if(!(face>0))bad.push('open wheel face');else{CH[0]='?';p.shade(0,face,10);if(CH[0]!==' ')bad.push('wheel glyph');}
    const bearing=parts.find(q=>q.box.subwayRole==='axle-bearing'&&q.box.subwayBogie===b.subwayBogie&&q.box.subwayAxle===b.subwayAxle&&q.box.subwaySide===b.subwaySide)?.box;
    const axle=parts.find(q=>q.box.subwayRole==='axle'&&q.box.subwayAxle===b.subwayAxle)?.box;
    if(!bearing||!axle||bearing.z0>b.centerZ||bearing.z1<b.centerZ||axle.hw<Math.abs(bearing.y-S.centre)+bearing.hw)bad.push('axle disconnected from bearing');
   }
   for(const centre of S.bogieCentres){const frame=parts.find(q=>q.box.subwayRole==='bogie-frame'&&q.box.subwayBogie===centre)?.box,pivot=parts.find(q=>q.box.subwayRole==='bogie-pivot'&&q.box.subwayBogie===centre)?.box;
    const bolster=parts.find(q=>q.box.subwayRole==='bogie-bolster'&&q.box.subwayBogie===centre)?.box;
    if(!frame||!pivot||!bolster||bolster.z0>frame.z1||bolster.hw<Math.abs(frame.y-S.centre)||pivot.z0>bolster.z1||pivot.z1<SUBWAY_CAR.bottom)bad.push('body floating above bogie');
   }
   const coupler=parts.find(q=>q.box.subwayRole==='coupler'&&q.box.x>trainX(room)).box;if(Math.abs(coupler.x+coupler.hl-trainX(room)-SUBWAY_CAR.spacing/2)>1e-8)bad.push('coupler misses adjacent car');
  }
  if(!counts.every(n=>n===counts[0]))bad.push('bogies spawn at stop');
  // Native raster path with the lower background depth: a wheel below zero
  // must survive drawBox's occlusion check. Other car parts are omitted here to inspect the wheel raster directly.
  T=30;px=23-2.55-.54;py=11.42;a=Math.PI/2;pitch=-.9;render(0);let wheelCells=0;const old=drawBox;
  try{drawBox=(b,shade,ray)=>{if(b.subwayRole&&b.subwayRole!=='wheel')return;return old(b,(...args)=>{const result=shade(...args);if(b.subwayRole==='wheel'&&result)wheelCells++;return result;},ray);};drawSubwayTrainCar(23-px,S.centre-py,0);}finally{drawBox=old;}
  if(!wheelCells)bad.push('flat floor still hides wheels in native renderer');
  return {bad,wheelCells};
 });assert.deepEqual(r.bad,[],JSON.stringify(r));assert.ok(r.wheelCells>0);
}));
