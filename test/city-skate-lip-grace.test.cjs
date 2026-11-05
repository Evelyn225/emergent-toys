'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {skateSim}=require('./helpers/skate-sim.cjs');
const opts={bowl:{radius:.3,height:.22},position:[.22,0],speed:.9,dt:1/120,fixed:true};
const first=skateSim([{frames:160}],opts).findIndex(p=>p.contact==='air');assert.ok(first>10);
test('Space release just after a bowl lip completes the loaded trick',()=>{
 const run=skateSim([{frames:first-6},{frames:10,keys:{Space:1}},{keys:{ArrowLeft:1}}],opts);
 assert.equal(run.at(-1).trick,'kickflip');assert.ok(run.at(-1).vz>0);
});
test('a right-stick load started on the wall can finish after crossing the coping',()=>{
 const run=skateSim([{frames:first-3},{frames:7,sticks:{right:[0,1]}},{sticks:{right:[-.7,-.8]}}],opts);
 assert.equal(run.at(-1).trick,'kickflip','grace pop is a normal trick, not an underpowered late flip');
});
test('holding Space beyond the lip grace cannot add a second jump',()=>{
 const run=skateSim([{frames:first-6},{frames:27,keys:{Space:1}},{keys:{ArrowLeft:1}}],opts);
 const coast=skateSim([{frames:first+22}],opts);
 assert.equal(run.at(-1).trick,'late kickflip','expired pop grace still permits a flip, without another jump');
 assert.ok(Math.abs(run.at(-1).vz-coast.at(-1).vz)<1e-8);
 assert.ok(Math.abs(run.at(-1).worldZ-coast.at(-1).worldZ)<1e-8);
});
