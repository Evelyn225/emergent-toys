'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();

test('edge neighborhood moves preserve whole lots and authored footprints',()=>{
 const result=ev(`(()=>{
  const all=[...CITY_PLACES.values(),...ARCH_BUILDINGS,...BELLE_BUILDINGS,...MERCHANT_BUILDINGS,
   ...cityLayoutInventory().fixed.filter(p=>p.id!=='elevated-railway')];
  const conflicts=[];
  for(const p of CITY_EDGE_NEIGHBORHOODS)for(const b of all){
   const overlap=b.x0<p.x1&&b.x1>p.x0&&b.y0<p.y1&&b.y1>p.y0;
   const inside=b.x0>=p.x0&&b.x1<=p.x1&&b.y0>=p.y0&&b.y1<=p.y1;
   if(overlap&&!inside)conflicts.push(b.id||b.sh?.word);
  }
  return JSON.stringify(conflicts);
 })()`);
 assert.deepEqual(JSON.parse(result),[]);
});

test('contoured city blocks never overlap and their coordinates round-trip',()=>{
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  const addresses=new Set(),rows=new Map();let overlaps=0,roundTrips=0;
  for(let y=8;y<200;y+=8)for(let x=0;x<256;x+=8){
   const p=citySourcePoint(x+.5,y+.5),key=p.join(',');
   if(addresses.has(key))overlaps++;addresses.add(key);
   const source=cityWorldSourcePoint(...p);if(source[0]!==x+.5||source[1]!==y+.5)roundTrips++;
   const row=rows.get(p[1])||[];row.push(p[0]);rows.set(p[1],row);
  }
  const lefts=[...rows.values()].map(r=>Math.min(...r));
  return {blocks:addresses.size,overlaps,roundTrips,variance:Math.max(...lefts)-Math.min(...lefts)};
 })())`));
 assert.equal(result.blocks,768);assert.equal(result.overlaps,0);assert.equal(result.roundTrips,0);assert.ok(result.variance>=48);
});

test('the contour upgrade leaves the northern airfield and central courier route in place',()=>{
 const result=JSON.parse(ev('JSON.stringify([cityPreviousPoint(168,63),citySourcePoint(183.5,106.5)])'));
 assert.deepEqual(result,[[168,63],[311.5,250.5]]);
});
