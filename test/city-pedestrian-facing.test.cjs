'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

test('park detours face movement on entry, return and short arrival without changing street-route memory', () => {
  const { ev } = loadCity();
  ev(`people.length=0;
    var walker={x:100,y:100,last:[1,0],path:[],sp:.12,ph:0,wait:0,act:'wander'};
    people.push(walker);`);
  for (const [x,y] of [[100,101],[100,100],[99,99]]) {
    ev(`walker.path=[{x:${x},y:${y}}];
      var oldX=walker.x,oldY=walker.y;
      stepPeople(.1,12,true);`);
    assert.ok(ev(`{
      const dx=rel(walker.x-oldX),dy=rel(walker.y-oldY),d=Math.hypot(dx,dy);
      d>0 && Math.abs(walker.facing[0]-dx/d)<1e-8 && Math.abs(walker.facing[1]-dy/d)<1e-8;
    }`), 'faces the actual displacement, including the return leg');
    assert.deepEqual(Array.from(ev('walker.last')), [1,0]);
  }
  ev('walker.path=[{x:walker.x+.001,y:walker.y-.001}];stepPeople(.1,12,true)');
  assert.equal(ev('walker.path.length'),0,'short arrival consumes its waypoint');
  assert.ok(ev('Math.abs(walker.facing[0]-Math.SQRT1_2)<1e-8 && Math.abs(walker.facing[1]+Math.SQRT1_2)<1e-8'));
  ev('walker.path=[];walker.wait=5;var facingBefore=walker.facing;stepPeople(.1,12,true)');
  assert.equal(ev('walker.facing===facingBefore'),true,'resting preserves the last walking direction');
});
