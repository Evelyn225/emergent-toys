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
