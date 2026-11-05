'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{skateSim}=require('./helpers/skate-sim.cjs');
test('a flick after an ollie can finish, catch and roll away without a second jump',()=>{
 const opts={speed:.5,dt:1/120,fixed:true};
 const start=[{frames:8,keys:{Space:1}},{frames:12}];
 const plain=skateSim([...start,{frames:3},{frames:100}],opts);
 for(const x of [-.7,.7]){
  const run=skateSim([...start,{sticks:{right:[0,1]}},{sticks:{right:[0,.3]}},{sticks:{right:[x,-.8]}},{frames:100}],opts);
  assert.equal(run[23].trick,x<0?'late kickflip':'late heelflip');
  assert.ok(run.every(p=>!p.bail),'late flick has time to finish and catch');
  assert.ok(run.at(-1).score+run.at(-1).combo>0);assert.equal(run.at(-1).contact,'ground');
  for(let i=0;i<run.length;i++)assert.ok(Math.abs(run[i].worldZ-plain[i].worldZ)<1e-8,'flip does not change flight height');
 }
});
