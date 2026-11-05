'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {skateSim}=require('./helpers/skate-sim.cjs');
test('a rounded ramp cannot manufacture kinetic energy as its slope changes',()=>{
 const ground=x=>x>0&&x<.4?.03*(1-Math.cos(2*Math.PI*x/.4)):0;
 const run=skateSim([{frames:160}],{speed:1.1,fixed:true,dt:1/120,ground,physics:{asphalt:0,drag:0}});
 const initial=.5*1.1**2;
 for(const p of run.slice(2)){
  const energy=.5*p.velocity.reduce((sum,v)=>sum+v*v,0)+.98*(ground(p.x)+p.z/10);
  assert.ok(energy<initial*1.03,`energy ${energy} at ${p.x}`);
  assert.ok(!p.bail,'ordinary ramp traversal should roll away');
 }
});
test('steep transition entry redirects existing speed rather than adding vertical speed',()=>{
 const c=vm.createContext({});vm.runInContext(`const SK={dir:0,v:1},SKB={v:[1,0,0],surf:{n:[0,0,1]}},body={vz:0};const skateAir=()=>false;`,c);
 for(const file of ['skate-physics.js','skate-transitions.js','skate-bowl.js','skate-pool.js']){
  let source=fs.readFileSync(path.join(__dirname,'../city',file),'utf8');
  if(file==='skate-physics.js')source=source.slice(source.indexOf('// Bend an existing'),source.indexOf('const skateRideYaw'));
  vm.runInContext(source,c);
 }
 vm.runInContext(`const skateManualEnd=()=>{};let a=0;const hit={o:{c:1,s:0},u:.2,axis:0,at:{tx:Math.cos(1.4),tz:Math.sin(1.4)},n:[-Math.sin(1.4),0,Math.cos(1.4)]};`,c);
 for(const fn of ['enterSkateTransition','enterSkateBowl','enterSkatePool']){
  vm.runInContext(`${fn}(hit)`,c);
  const speed=vm.runInContext('Math.hypot(...(SK.transition.velocity||[SK.transition.vs,SK.transition.va]))',c);
  assert.ok(Math.abs(speed-1)<1e-9,`${fn}: ${speed}`);
 }
});
test('small braking corrections stay foot drags; a deliberate slide eases in and out with hysteresis',()=>{
 const gentle=skateSim([{frames:15,buttons:{brake:true},sticks:{left:[.42,0]}}],{speed:1,fixed:true});
 assert.ok(gentle.every(p=>!p.sliding&&p.slide===0));
 const slide=skateSim([{frames:15,keys:{KeyS:1,KeyD:1}},{frames:20}],{speed:1,fixed:true});
 assert.ok(slide[15].sliding&&slide[15].slide>.9);
 assert.ok(slide[1].slide>0&&slide[1].slide<.5,'no instantaneous 90 degree snap');
 assert.ok(!slide.at(-1).sliding&&slide.at(-1).slide<.03);
 for(const p of slide.slice(1))assert.ok(Math.abs(p.boardYaw-p.yaw-p.slide*Math.PI/2)<1e-8);
 assert.ok(slide[15].speed<gentle[15].speed);
});

test('slide engagement hysteresis holds a committed slide through a smaller correction',()=>{
 const medium=skateSim([{frames:30,buttons:{brake:true},sticks:{left:[.57,0]}}],{speed:1,fixed:true});
 assert.ok(medium.every(p=>!p.sliding));
 const held=skateSim([{frames:15,buttons:{brake:true},sticks:{left:[.9,0]}},{frames:12,buttons:{brake:true},sticks:{left:[.57,0]}}],{speed:1,fixed:true});
 assert.ok(held[15].sliding&&held.at(-1).sliding);
});
