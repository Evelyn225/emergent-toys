'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('map coordinates and routes support both wrapping and bounded rectangular worlds',()=>{
  const {ev}=loadCity();
  ev(`globalThis.w={width:9,height:5,wrap:true};globalThis.routeStart={x:.5,y:2.5};globalThis.routeGoal={x:8.5,y:2.5};`);
  assert.equal(ev('mapDistance(routeStart,routeGoal,w)'),1);
  assert.equal(ev('findMapRoute(routeStart,routeGoal,w,()=>true).length'),2);
  ev('w.wrap=false');assert.equal(ev('mapDistance(routeStart,routeGoal,w)'),8);
  assert.equal(ev('findMapRoute(routeStart,routeGoal,w,()=>true).length'),9);
  assert.equal(ev('mapCoordinate(-3,9,w)'),0);assert.equal(ev('mapDifference(-8,9,w)'),-8);
});

test('walking routes avoid blocked cells, snap a building to its approach and report disconnected areas',()=>{
  const {ev}=loadCity();
  ev(`globalThis.w={width:8,height:7,wrap:false};globalThis.open=(x,y)=>x!==3||y===5;
    globalThis.route=findMapRoute({x:1.5,y:1.5},{x:6.5,y:1.5},w,open);`);
  assert.equal(ev('route.every(p=>open(Math.floor(p.x),Math.floor(p.y)))'),true);
  assert.equal(ev('route.some(p=>p.x===3.5&&p.y===5.5)'),true);
  assert.equal(ev('findMapRoute({x:1.5,y:1.5},{x:6.5,y:1.5},w,(x,y)=>x!==3)'),null);
  assert.equal(ev('findMapRoute({x:1.5,y:1.5},{x:3.5,y:1.5},w,open).at(-1).x!==3.5'),true);
});

test('saved waypoints reject invalid coordinates and retain a bounded useful label',()=>{
  const {ev}=loadCity();
  ev('loadMapWaypoint({x:5,y:6,name:"A place",id:"shop:5"})');assert.equal(ev('mapWaypoint.name'),'A place');
  ev('loadMapWaypoint({x:Infinity,y:6,name:"Bad"})');assert.equal(ev('mapWaypoint'),null);
  ev('loadMapWaypoint({x:-1,y:6,name:"Bad"})');assert.equal(ev('mapWaypoint'),null);
  ev('loadMapWaypoint({x:5,y:6,name:"x".repeat(200)})');assert.equal(ev('mapWaypoint.name.length'),100);
});
