'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {skateSim}=require('./helpers/skate-sim.cjs');
const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
test('a bowl rollback keeps the board facing uphill and returns fakie',()=>{
 for(const pool of [undefined,{rx:.55,ry:.9,curve:0}]){
  const run=skateSim([{frames:300}],{bowl:{radius:.3,height:.22,...pool?{pool}:{}},position:[pool?.rx?pool.rx+.06:.18,0],speed:.28,dt:1/120});
  const back=run.find(p=>p.vx<-.02);
  assert.ok(back&&back.fakie,JSON.stringify(back));assert.ok(angle(back.yaw,0)<.25,'no forced 180 at the stall');
 }
});
test('from rest pushing follows camera look, including a fakie start',()=>{
 for(const look of [0,.8,Math.PI,-Math.PI/2]){
  const run=skateSim([{frames:30,keys:{KeyW:1}}],{look,fixed:true}),p=run.at(-1);
  assert.ok(p.speed>.1);assert.ok(angle(p.heading,look)<1e-8);
  assert.equal(p.fakie,Math.cos(look)<0);
 }
});
test('C and RT choose the same air-out at takeoff, with the choice held through flight',()=>{
 const options={bowl:{},position:[.22,0],speed:.8,dt:1/120};
 const normal=skateSim([{frames:180}],options);
 const key=skateSim([{frames:100,keys:{KeyC:1}},{frames:80}],options);
 const pad=skateSim([{frames:100,buttons:{grabR:true}},{frames:80}],options);
 const first=normal.findIndex(p=>p.airOut!==null);assert.ok(first>0);
 assert.equal(normal[first].airOut,false);assert.equal(key[first].airOut,true);assert.equal(pad[first].airOut,true);
 assert.ok(key[first].vx>normal[first].vx+.05,'air out has outward carry');
 for(let i=first;i<key.length&&key[i].contact==='air';i++)assert.equal(key[i].airOut,true);
 for(let i=first;i<Math.min(first+20,key.length);i++)assert.ok(Math.abs(key[i].x-pad[i].x)<1e-9);
});
test('ordinary curved-pool airs stay inside the coping while the rider spins',()=>{
 const pool={rx:.6,ry:.9,curve:.1};
 for(const yaw of [0,.8,2.4,4.5]){
  const floor=1/Math.sqrt(Math.cos(yaw)**2/pool.rx**2+Math.sin(yaw)**2/pool.ry**2)*(1+pool.curve*(Math.sin(3*yaw)+.65*Math.cos(3*yaw)));
  const options={bowl:{radius:.3,height:.22,pool},position:[(floor+.07)*Math.cos(yaw),(floor+.07)*Math.sin(yaw)],yaw,speed:.9,dt:1/120};
  const plain=skateSim([{frames:220}],options),first=plain.findIndex(p=>p.contact==='air');assert.ok(first>0);
  const run=skateSim([{frames:first},{frames:50,keys:{KeyD:1}},{frames:170}],options);
  const tip=.12+Math.sqrt(.3**2-(.3-.22)**2);
  for(const p of run.filter(p=>p.airOut===false&&p.contact==='air')){
   const t=Math.atan2(p.y,p.x),r=1/Math.sqrt(Math.cos(t)**2/pool.rx**2+Math.sin(t)**2/pool.ry**2)*(1+pool.curve*(Math.sin(3*t)+.65*Math.cos(3*t)));
   assert.ok(Math.hypot(p.x,p.y)<=r+tip-.12-.0149,'return air crossed the lip');
  }
  assert.ok(run.slice(first+1).some(p=>p.contact==='transition'),'returns to the bank');
 }
});

test('controller forward can push from a stop toward camera look',()=>{
 const run=skateSim([{frames:30,sticks:{left:[0,-1]}}],{look:Math.PI,fixed:true}),p=run.at(-1);
 assert.ok(p.speed>.1&&p.vx<0&&p.fakie);assert.ok(angle(p.yaw,0)<1e-8);
});

test('intentional air-outs clear the deck and can land cleanly',()=>{
 for(const bowl of [{},{radius:.3,height:.22,pool:{rx:.6,ry:.9,curve:.1}}]){
  const run=skateSim([{frames:210,keys:{KeyC:1}}],{bowl,position:[bowl.pool ? .7 : .22,0],speed:.8,dt:1/120});
  assert.ok(run.some(p=>p.airOut===true));assert.ok(run.every(p=>!p.bail));assert.equal(run.at(-1).contact,'ground');
 }
});

test('unsteered natural bowl airs retain the forward/fakie axis across the apex',()=>{
 for(const curve of [0,.1]){
  const run=skateSim([{frames:260}],{bowl:{radius:.3,height:.22,pool:{rx:.6,ry:.9,curve}},position:[.7,0],speed:.9,dt:1/120,fixed:true});
  const start=run.findIndex(p=>p.contact==='air'),air=run.slice(start).filter(p=>p.contact==='air');assert.ok(start>0&&air.length>40);
  for(const p of air)assert.ok(angle(p.yaw,air[0].yaw)<(curve?1.4:.01),'landing assist must not accumulate a half-turn');
  const landing=run.slice(start+1).find(p=>p.contact==='transition');assert.ok(landing?.fakie,'the return is tail-first');
  assert.ok(run.every(p=>!p.bail));
 }
});
