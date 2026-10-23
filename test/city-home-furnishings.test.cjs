'use strict';const test=require('node:test'),assert=require('node:assert/strict'),{loadCity}=require('./helpers/load-city.cjs');const{ev}=loadCity(),j=s=>JSON.parse(ev(`JSON.stringify(${s})`));
test('furniture admits flush wall placement, rejects rotated wall intersections, overlaps and blocked door approaches',()=>{
 const r=j(`(()=>{const grid=['##########',...Array(7).fill('#........#'),'####DD####'],p={id:'f_table',key:1,x:1.95,y:4,a:0},fit=(q,obs=[])=>furnishingFit(q,grid,obs);return {flush:fit(p),wall:fit({...p,x:1.8}),rotated:fit({...p,a:Math.PI/2,y:1.4}),occupied:fit(p,[{box:{x:2,y:4,c:1,s:0,hl:.3,hw:.3,z0:0,z1:1}}]),door:fit({...p,x:5,y:7.6}),touch:furnishingOverlap({x:0,y:0,c:1,s:0,hl:1,hw:1},{x:2,y:0,c:1,s:0,hl:1,hw:1})};})()`);
 assert.equal(r.flush,'');assert.match(r.wall,/wall/);assert.match(r.rotated,/wall|inside/);assert.match(r.occupied,/furniture/);assert.match(r.door,/door/);assert.equal(r.touch,false);
});
test('home contents reject unknown, duplicate and invalid furniture while preserving lamp, record and photo state',()=>{
 const r=j(`restoreHomeFurnishings({parts:[{id:'f_lamp',key:1,x:3,y:4,a:0,on:false},{id:'bad',key:2,x:2,y:2,a:0},{id:'f_frame',key:3,x:6,y:3,a:0,z:1.8,photo:7},{id:'f_lamp',key:1,x:4,y:4,a:0},{id:'f_lamp',key:9,x:NaN,y:4,a:0}]},'home_studio')`);
 assert.equal(r.parts.length,2);assert.equal(r.parts[0].on,false);assert.equal(r.parts[1].photo,7);assert.equal(r.next,4);
 const photos=j(`restoreHomePhotos({next:8,photos:[{id:1,w:48,h:28,chars:' '.repeat(1344),fg:Array(1344).fill(1),bg:Array(1344).fill(2),title:'Sea'},{id:2,w:100000,h:2,chars:'x',fg:[],bg:[]}]})`);
 assert.equal(photos.photos.length,1);assert.equal(photos.next,8);
});
