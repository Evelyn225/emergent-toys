'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ev}=require('./helpers/load-city.cjs').loadCity();
test('four tyre contacts give a rigid orthonormal chassis aligned to uphill, downhill and cross slopes',()=>{
 const rows=JSON.parse(ev(`JSON.stringify([0,Math.PI/2,Math.PI,Math.PI*1.5].map(yaw=>{
   const f=vehicleGroundFrame([.22,.085],20,30,Math.cos(yaw),Math.sin(yaw),(x,y)=>.12*x-.08*y+2);
   const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
   return {z:f.z,tilted:f.tilted,lengths:[f.f,f.side,f.up].map(v=>Math.hypot(...v)),dots:[dot(f.f,f.side),dot(f.f,f.up),dot(f.side,f.up)],frontResidual:f.f[2]-(.12*f.f[0]-.08*f.f[1]),sideResidual:f.side[2]-(.12*f.side[0]-.08*f.side[1])};
 }))`));
 for(const r of rows){assert.ok(Math.abs(r.z-2)<1e-10);assert.equal(r.tilted,true);for(const n of r.lengths)assert.ok(Math.abs(n-1)<1e-10);for(const d of r.dots)assert.ok(Math.abs(d)<1e-10);assert.ok(Math.abs(r.frontResidual)<1e-10);assert.ok(Math.abs(r.sideResidual)<1e-10);}
});
test('level streets retain the fast upright rendering path',()=>{
 const r=JSON.parse(ev("JSON.stringify(vehicleGroundFrame([.22,.085],0,0,1,0,()=>.4))"));
 assert.equal(r.tilted,false);assert.deepEqual(r.f,[1,0,0]);assert.deepEqual(r.side,[0,1,0]);assert.deepEqual(r.up,[0,0,1]);assert.equal(r.z,.4);
});
