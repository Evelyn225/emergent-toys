'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;body.z=body.vz=0;task=job=courierJob=emergencyJob=null;mapWaypoint=null;tod=14;env(0);render(0);window.compassLabel=()=>{const texts=[],original=g.fillText;try{g.fillText=function(s,...args){texts.push(String(s));return original.call(this,s,...args);};drawNavigationCompass(0);}finally{g.fillText=original;}return texts.at(-1);};});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('an emergency marker counts down to zero instead of borrowing a saved waypoint kilometres away',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='drive';me={x:100,y:100};px=100;py=100;
  mapWaypoint={id:'old-pin',name:'Saved route',x:100,y:390};MAP_NAV.path=Array.from({length:291},(_,j)=>({x:100,y:100+j}));MAP_NAV.next=0;
  emergencyJob={kind:'fire',car:me,call:{kind:'building',x:110,y:100}};
  const labels=[],distances=[];for(const x of [100,105,110]){me.x=px=x;labels.push(compassLabel());distances.push(navigationTargets()[0].distance);}
  emergencyJob=null;const waypointLabel=compassLabel();return {labels,distances,waypointLabel};
 });assert.deepEqual(r.distances,[100,50,0]);for(const [j,d]of [100,50,0].entries()){assert.match(r.labels[j],new RegExp(d+' m$'));assert.match(r.labels[j],/BUILDING FIRE/);}assert.match(r.waypointLabel,/Saved route.*3.0 km/);
}));
test('waypoints alone own walking-route distances; taxi, courier, favour and hospital targets keep their own positions',()=>fixture(async p=>{
 const results=await p.evaluate(()=>{
  px=200;py=200;mode='walk';mapWaypoint={id:'pin',name:'Saved route',x:400,y:400};MAP_NAV.path=null;const out=[];
  const record=name=>{const targets=navigationTargets(),t=targets.find(t=>t.name===name);out.push({name,found:!!t,routed:t?.routed,distance:t?.distance,expected:t?mapDistance(mapPlayerLocation(),t)*10:null,waypointRouted:targets.find(t=>t.name==='Saved route').routed});};
  task={kind:'escort',to:{x:205,y:200}};record('CURRENT FAVOUR');task=null;
  mode='drive';me={x:200,y:200};job={ride:{dest:[205,200]}};record('DROP OFF');job=null;
  mode='taxi';me={x:200,y:200,dest:[205,200],destName:'Station'};record('Station');me=null;
  mode='roof';courierJob={id:COURIER_ROUTES[0].id};const guide=courierGuide();record(guide[1].label);courierJob=null;
  emergencyJob={kind:'amb',car:{x:200,y:200},call:{kind:'medical',stage:'transport'}};record('HOSPITAL HANDOVER');
  return out;
 });for(const r of results){assert.ok(r.found&&r.waypointRouted&&!r.routed,JSON.stringify(r));assert.equal(r.distance,r.expected,JSON.stringify(r));}
}));
test('camera movement never moves the GPS origin, and the origin is restored even if rendering throws',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  const original=renderCameraView,out=[];
  try{
   renderCameraView=()=>{const saved=[px,py];try{px+=180;py+=120;out.push({mode,at:mapPlayerLocation(),distance:navigationTargets()[0].distance});}finally{[px,py]=saved;}};
   for(const m of ['walk','drive','taxi','boat','sea','air','roof','el','ferry']){mode=m;px=200;py=200;me=['drive','taxi'].includes(m)?{x:200,y:200}:null;emergencyJob={kind:'fire',car:{x:200,y:200},call:{kind:'building',x:205,y:200}};renderView(0);}
   mode='room';room={ret:[200,200,0]};px=5;py=6;renderView(0);
   renderCameraView=()=>{throw Error('render interrupted');};try{renderView(0);}catch(e){}
   return {out,restored:mapRenderPosition===null};
  }finally{renderCameraView=original;}
 });assert.ok(r.restored);for(const v of r.out){assert.deepEqual(v.at,{x:200,y:200},JSON.stringify(v));assert.equal(v.distance,50,JSON.stringify(v));}
}));
test('rendered flames flare wider above the base, taper to separate tips, animate and shrink as heat is removed',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='walk';dx=1;dy=0;eye=.17;hor=rows/2;projY=projX*cw/FS;
  const sample=(time,strength)=>{T=time;ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(NONE);drawFirePlume(.55,0,0,.11,.23,11,strength);
   const cells=[],widths=[];for(let row=0;row<rows;row++){let lo=cols,hi=-1;for(let col=0;col<cols;col++)if(BG[row*cols+col]!==NONE){cells.push(row*cols+col);lo=Math.min(lo,col);hi=Math.max(hi,col);}if(hi>=lo){const v=(eye+(hor-row-.5)*.55/projY)/.23;widths.push({v,width:hi-lo+1});}}
   const band=(a,b)=>Math.max(0,...widths.filter(w=>w.v>=a&&w.v<b).map(w=>w.width));return {cells,base:band(0,.1),flare:band(.2,.45),tip:band(.73,1)};};
  const full=sample(3.5,1),next=sample(3.9,1),cool=sample(3.5,.2),out=sample(3.5,0);
  return {base:full.base,flare:full.flare,tip:full.tip,full:full.cells.length,cool:cool.cells.length,out:out.cells.length,animated:JSON.stringify(full.cells)!==JSON.stringify(next.cells)};
 });assert.ok(r.flare>r.base&&r.tip<r.flare&&r.animated,JSON.stringify(r));assert.ok(r.full>r.cool&&r.cool>0,JSON.stringify(r));assert.equal(r.out,0);
}));
test('nested interiors and subway rooms use their world entrance rather than local room coordinates',()=>fixture(async p=>{
 const r=await p.evaluate(()=>{
  mode='room';px=3;py=4;streetSpot=null;const out=[];
  for(const scene of [{kind:'hotelroom',lobby:{ret:[240,180,0]}},{kind:'lamproom',below:{ret:[240,180,0]}},{kind:'station',st:0},{kind:'train',st:0}]){room=scene;out.push(mapPlayerLocation());}
  return {out,station:{x:stations[0].x,y:stations[0].y}};
 });assert.deepEqual(r.out,[{x:240,y:180},{x:240,y:180},r.station,r.station]);
}));
