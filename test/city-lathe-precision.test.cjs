'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../city/cabin-cove.js'),'utf8');
const start=source.indexOf('function coveRayLathe('),end=source.indexOf('function coveLathe(',start),HIT={};
const ray=new Function('HIT',source.slice(start,end)+';return coveRayLathe;')(HIT);
const tableware=fs.readFileSync(path.join(__dirname,'../city/kitchen-tableware.js'),'utf8');
const vessels=new Function(tableware.slice(0,tableware.indexOf('const kitchenScaledProfiles'))+';return KITCHEN_VESSELS;')();

test('a shallow dish keeps its inside floor and upward unit normal at the centre at any height',()=>{
 for(const base of [0,.24,.2501411392,1,1.1,2,-3.7])for(const scale of [.5,1,1.05,2]){
  const profile=vessels.plate.map(([z,r])=>[base+z*scale,r*scale]);
  const t=ray(7,-11,base+3,0,0,-1,{x:7,y:-11,profile}),expected=base+.009*scale;
  assert.ok(t>0&&Math.abs(HIT.w-expected)<1e-7,JSON.stringify({base,scale,t,z:HIT.w,expected}));
  assert.ok(HIT.nz>.999&&Math.abs(Math.hypot(HIT.nx,HIT.ny,HIT.nz)-1)<1e-7);
 }
});

test('near-axis inner floor intersections stay invariant when dishes are translated and scaled',()=>{
 let sequence=1234;
 const random=()=>((sequence=Math.imul(sequence,1664525)+1013904223>>>0)/4294967296);
 for(let k=0;k<500;k++){
  const base=random()*10-5,scale=.5+random()*1.5,r=k%2?1e-4*scale:0;
  const profile=vessels.plate.map(([z,r])=>[base+z*scale,r*scale]),expected=base+scale*.009+r*.001/.079;
  const t=ray(r,0,base+1+random()*4,0,0,-1,{x:0,y:0,profile});
  assert.ok(t>0&&Math.abs(HIT.w-expected)<1e-7,JSON.stringify({base,scale,r,t,z:HIT.w,expected}));
  assert.ok(Number.isFinite(HIT.nz)&&HIT.nz>0);
 }
});

test('tangent tolerance does not close hollow throats or accept genuine misses and backward rays',()=>{
 for(const base of [0,1,3.5]){
  const tube={x:0,y:0,profile:[[base,.1],[base+.3,.1],[base+.3,.07],[base,.07],[base,.1]]};
  assert.equal(ray(0,0,base+1,0,0,-1,tube),-1,'the axial throat remains open');
  assert.equal(ray(1,0,base+.15,1,0,0,tube),-1,'surfaces behind the ray do not hit');
  assert.ok(Math.abs(ray(0,0,base+.15,1,0,0,tube)-.07)<1e-8);assert.ok(HIT.nx<-.99);
  const cone={x:0,y:0,profile:[[base,0],[base,.3],[base+.5,.1],[base+.6,0]]};
  assert.equal(ray(.20001,-2,base+.25,0,1,0,cone),-1,'a real near-tangent miss stays a miss');
  assert.ok(Math.abs(ray(.2,-2,base+.25,0,1,0,cone)-2)<1e-6);
 }
});
