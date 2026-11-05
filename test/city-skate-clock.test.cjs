'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {skateSim}=require('./helpers/skate-sim.cjs');
const ctx=vm.createContext({});vm.runInContext('const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(v,m)=>(v%m+m)%m,worldCoord=x=>x,rel=x=>x;',ctx);
for(const file of ['skate-air.js','skate-clock.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../city',file),'utf8'),ctx);
const axes=vm.runInContext('skateBoardAxes',ctx),blend=vm.runInContext('skateBoardBlend',ctx);
test('quaternion interpolation preserves orthogonal board axes through vert and angle wraps',()=>{
 for(const yaw of [-3.14,0,3.14])for(const pitch of [-1.57,-.8,0,1.57])for(const roll of [-3.14,0,3.14]){
  const from=axes(yaw,pitch,roll),to=axes(yaw+.1,pitch+.02,roll+.1);
  for(const t of [0,.5,1]){const b=blend(from,to,t),frame=axes(b.yaw,b.pitch,b.roll),want=t===0?from:t===1?to:null;
   assert.ok(Math.abs(frame.axis.reduce((s,v,i)=>s+v*frame.up[i],0))<1e-9);
   if(want)assert.ok(Math.hypot(...frame.up.map((v,i)=>v-want.up[i]))<1e-7);
   else assert.ok(frame.up.reduce((s,v,i)=>s+v*from.up[i],0)>.97);
  }
 }
});
test('fixed skating produces the same push, carve and ollie at 30/60/120/144 render Hz',()=>{
 for(const pad of [false,true]){
  const runs=[30,60,120,144].map(hz=>skateSim([
   {frames:hz*2,...pad?{buttons:{push:true}}:{keys:{KeyW:1}}},
   {frames:hz/2,...pad?{sticks:{left:[-.6,0]}}:{keys:{KeyA:1}}},
   {frames:hz/2,keys:{Space:1}},{frames:hz*2}
  ],{dt:1/hz,fixed:true}));
  for(const run of runs.slice(1))for(const key of ['x','y','speed','yaw','score'])assert.ok(Math.abs(run.at(-1)[key]-runs[0].at(-1)[key])<1e-8,`${pad}/${key}`);
  assert.ok(runs.every(run=>run.some(p=>p.contact==='air')&&run.every(p=>!p.bail)));
 }
});
test('rider, board and camera share interpolation phase, and render errors cannot change physics',()=>{
 vm.runInContext(`
 let px=0,py=0,a=0,pitch=0,mode='walk';
 const body={z:2,vz:1,trick:{name:'ollie',t:.2}},SKB={p:[0,0,.2],v:[.5,0,.1],yaw:0,pitch:0,roll:0,riderYaw:0,contact:'air',surf:{h:0,n:[0,0,1],ref:1}};
 const SK={v:.5,dir:0,kick:.2,kicking:false,bail:0,bailAt:null,bailData:null,transition:null,grind:null,airNormal:[0,0,1],renderContact:null};
 const skateGround=()=>0;
 SK_CLOCK.active=true;SK_CLOCK.accumulator=SKATE_DT*.5;
 SK_CLOCK.current=skatePoseCapture();SK_CLOCK.current.camera=[-.55,0,0,.4,0];
 SK_CLOCK.previous={...SK_CLOCK.current,p:[-.1,0,.2],camera:[-.65,0,0,.4,-.2]};
 `,ctx);
 const state=()=>vm.runInContext('JSON.stringify({px,py,a,pitch,body,SKB,SK})',ctx),before=state();
 const result=vm.runInContext('skateFixedRender(camera=>({gap:camera[0]-px,x:px,z:body.z,pitch,contact:SK.renderContact}))',ctx);
 assert.ok(Math.abs(result.gap+.55)<1e-9);assert.ok(Math.abs(result.x+.05)<1e-9);assert.equal(result.z,2);assert.equal(result.contact,'air');assert.ok(Math.abs(result.pitch+.1)<1e-12);
 assert.equal(state(),before);
 assert.throws(()=>vm.runInContext("skateFixedRender(()=>{throw Error('render failed')})",ctx),/render failed/);assert.equal(state(),before);
 vm.runInContext('skateFixedReset()',ctx);assert.equal(vm.runInContext('skatePoseSample()',ctx),null);
});


test('short frames mixed with 50 ms hitches retain the fractional tick instead of losing time',()=>{
 const mixed=skateSim([{frames:96,keys:{KeyW:1}}],{fixed:true,frameTimes:[1/240,.05,1/240,.05]});
 const steady=skateSim([{frames:312,keys:{KeyW:1}}],{fixed:true,dt:1/120});
 for(const key of ['x','y','speed','yaw'])assert.ok(Math.abs(mixed.at(-1)[key]-steady.at(-1)[key])<1e-8,key);
});
