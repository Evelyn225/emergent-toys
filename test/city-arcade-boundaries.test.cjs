'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{loadCity}=require('./helpers/load-city.cjs');
const{ev}=loadCity();
test('the downtown museum and its boundary street have open sky beside Shotengai',()=>{
 const r=JSON.parse(ev(`JSON.stringify((()=>{const bad=[];for(let x=MUSEUM.bx*8+2;x<=MUSEUM.bx*8+7;x++)for(const y of [MUSEUM.by*8+8.05,MUSEUM.by*8+9.95])if(arcadeAt(x+.5,y))bad.push([x,y]);return{district:districtOf(MUSEUM.bx,MUSEUM.by),bad};})())`));
 assert.equal(r.district,'downtown');assert.deepEqual(r.bad,[]);
});
test('every covered shopping-street span has two Shotengai supports and a clear dry opening',()=>{
 const r=JSON.parse(ev(`JSON.stringify((()=>{const bad=[];let count=0;for(const ns of [true,false])for(let lane=0;lane<N;lane+=8)for(let along=0;along<N;along++){
  const span=arcadeSpanFor(ns,lane,along);if(!span)continue;count++;
  for(const q of [span.lo-1,span.hi]){const x=ns?q+.5:along+.5,y=ns?along+.5:q+.5;if(districtAt(x,y)!=='shotengai'||map[idx(x,y)]<ARCADE_Z)bad.push([ns,lane,along,'support']);}
  for(let q=span.lo;q<span.hi;q++){const x=ns?q+.5:along+.5,y=ns?along+.5:q+.5;if(map[idx(x,y)]||isWater(x,y)||!arcadeAt(x,y))bad.push([ns,lane,along,'opening']);}
 }return{count,bad};})())`));assert.ok(r.count>100,'interior shopping streets retain their roofs');assert.deepEqual(r.bad,[]);
});
