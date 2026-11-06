'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {skateSim}=require('./helpers/skate-sim.cjs');
const ctx=vm.createContext({});vm.runInContext('const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));',ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../city/skate-transitions.js'),'utf8'),ctx);
const profile=vm.runInContext('skateProfile',ctx),point=vm.runInContext('skateProfilePoint',ctx),inverse=vm.runInContext('skateProfileU',ctx);

test('profile arc length and inverse support curved and vertical sections',()=>{
 const p=profile({radius:.3,height:.36,extension:.06});
 for(let i=0;i<=40;i++){
  const u=-p.limit+2*p.limit*i/40,at=point(p,u);
  assert.ok(Math.abs(inverse(p,at.x,at.z)-u)<1e-7);
 }
 assert.ok(Math.abs(point(p,p.limit).z-.36)<1e-9);
 assert.ok(point(p,p.limit).tx<1e-9);
});
test('a frictionless mini-ramp conserves energy within 2% through a complete pump cycle',()=>{
 const t=skateSim([{frames:1000}],{dt:1/240,speed:.4,transition:{},physics:{concrete:0}});
 const energy=.5*.4*.4;
 for(const p of t.slice(1)){
  const e=.5*p.velocity.reduce((sum,x)=>sum+x*x,0)+.98*p.worldZ;
  assert.ok(Math.abs(e/energy-1)<.02,`${p.t}: ${e}`);
 }
 assert.ok(t.some(p=>p.x<-.2)&&t.some(p=>p.x>.2));
 assert.equal(t.at(-1).contact,'transition');
});
test('a coping air returns to the same ramp; drop-in and rock to fakie work',()=>{
 const t=skateSim([{frames:450}],{speed:.65,transition:{}});
 const air=t.findIndex(p=>p.contact==='air');
 assert.ok(air>0);assert.ok(Math.max(...t.map(p=>p.worldZ))>.18);
 assert.ok(t.slice(air+1).some(p=>p.contact==='transition'));
 assert.ok(t.every(p=>p.bail<=0));
 const p=profile({}),tip=point(p,p.limit).x;
 const drop=skateSim([{frames:40,keys:{KeyW:1}}],{transition:{},position:[tip+.02,0],yaw:Math.PI});
 assert.equal(drop.at(-1).contact,'transition');assert.ok(drop.at(-1).x<tip-.05);
 const stall=skateSim([{frames:60,keys:{ArrowDown:1}}],{transition:{},position:[tip-.001,0],speed:.02});
 assert.ok(stall.at(-1).comboNames.includes('ROCK TO FAKIE'));
 assert.ok(stall.at(-1).velocity[0]<0);
 const fifty=skateSim([{frames:30,sticks:{right:[0,.4475]}},{frames:40,buttons:{push:true},sticks:{right:[0,.4475]}}],
  {transition:{},position:[tip-.001,0],speed:.02});
 assert.ok(fifty.at(-1).comboNames.includes('50-50 STALL'));
});

test('a bowl carve stays on the wall while crossing every quadrant',()=>{
 const t=skateSim([{frames:360}],{bowl:{},position:[.37,0],yaw:Math.PI/2,speed:.5});
 assert.ok(t.slice(1).every(p=>p.contact==='transition'&&p.bail<=0));
 const quadrants=new Set(t.slice(1).map(p=>`${Math.sign(p.x)},${Math.sign(p.y)}`));
 assert.equal(quadrants.size,4);
 assert.ok(t.slice(1).every(p=>Math.hypot(p.x,p.y)>.3&&p.worldZ>.015));
});

test('vert air reaches about 1.5 m above the 3.6 m coping and re-enters',()=>{
 const t=skateSim([{frames:1440}],{dt:1/240,transition:{radius:.3,height:.36,extension:.06},speed:1});
 const peak=Math.max(...t.map(p=>p.worldZ));
 assert.ok(peak-.36>.135&&peak-.36<.165,`${(peak-.36)*10} metres`);
 const firstAir=t.findIndex(p=>p.contact==='air');
 assert.ok(firstAir>0&&t.slice(firstAir+1).some(p=>p.contact==='transition'));
 assert.ok(t.every(p=>p.bail<=0));
});

test('both half-pipe walls support angled airs and unsteered fakie re-entry',()=>{
 for(const transition of [{},{radius:.3,height:.36,extension:.06}])for(const yaw of [0,Math.PI,.2,Math.PI+.2]){
  const run=skateSim([{frames:600}],{transition,speed:transition.extension?1:.8,yaw,dt:1/120,fixed:true});
  const first=run.findIndex(p=>p.contact==='air');assert.ok(first>0);
  const landing=run.slice(first+1).find(p=>p.contact==='transition');assert.ok(landing?.fakie,'straight or shallow angled returns remain tail-first');
  assert.ok(run.every(p=>!p.bail),'both walls re-enter without a landing bail');
  const air=run.slice(first,run.indexOf(landing));for(const p of air)assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw-yaw),Math.cos(p.yaw-yaw)))<(Math.abs(Math.sin(yaw))<.01?.01:Math.PI/2),'no automatic half turn');
 }
});

test('pops on either vert wall retain descending momentum and land fakie',()=>{
 for(const yaw of [0,Math.PI]){
  const opts={transition:{radius:.3,height:.36,extension:.06},speed:1,yaw,dt:1/120,fixed:true};
  const natural=skateSim([{frames:500}],opts),first=natural.findIndex(p=>p.contact==='air');
  const run=skateSim([{frames:first-12},{frames:6,keys:{Space:1}},{frames:550}],opts),start=run.findIndex(p=>p.contact==='air');
  const landing=run.slice(start+1).find(p=>p.contact==='transition');
  assert.ok(landing?.fakie,'a heightfield touchdown must not turn the board around');
  assert.ok(Math.hypot(...landing.velocity)>.4,'falling speed flows into the wall constraint');
  assert.ok(run.every(p=>!p.bail));
 }
});
