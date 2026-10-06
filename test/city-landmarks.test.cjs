'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

test('all clock towers and cathedrals have distinct compositions and retain the cathedral forecourt', () => {
  const { ev } = loadCity();
  assert.equal(ev('LANDMARK_BUILDINGS.filter(b=>b.kind==="clock").length'),5);
  assert.equal(ev('new Set(LANDMARK_BUILDINGS.map(b=>b.profile.name)).size'),10);
  assert.ok(ev(`LANDMARK_BUILDINGS.filter(b=>b.kind==='cathedral').every(b=>
    map[idx(b.x+3,b.y+3)]===8 && !map[idx(b.x+5,b.y+3)] &&
    !landmarkBlocked(b.x+5,b.y+3.7,.03) && !landmarkBlocked(b.x+5,b.y+3.98,.03))`));
  assert.equal(ev('extras.filter(o=>o.spire).length'),0,'billboard spires have been replaced by solids');
});

test('pitched nave roofs and tapered clock caps share the heights used by movement and police', () => {
  const { ev } = loadCity();
  const heights = ev(`LANDMARK_BUILDINGS.filter(b=>b.solids.some(o=>o.kind==='roof' && o.walkRoof)).map(b=>{
    const o=b.solids.find(o=>o.kind==='roof' && o.walkRoof);
    return [landmarkSurfaceHeight(o,o.x,o.y),o.z1,landmarkSurfaceHeight(o,o.x+o.hl*.7,o.y),o.z0,
      policeRoofHeight(o.x,o.y),landmarkRoofHeight(o.x,o.y)];
  })`);
  for (const [center,top,edge,bottom,police,height] of heights) {
    assert.ok(Math.abs(center-top)<1e-8);
    assert.ok(edge>=bottom && edge<top,'inclined roof falls away from its ridge');
    assert.equal(police,height);
  }
  assert.ok(ev(`LANDMARK_BUILDINGS.filter(b=>b.kind==='cathedral').every(b=>
    landmarkRoofHeight(b.x+3.5,b.y+3.5)===0 && policeRoofHeight(b.x+3.5,b.y+3.5)===8 &&
    !landmarkTowerBlocked(b.x+3.5,b.y+3.5,8) && landmarkTowerBlocked(b.x+3.93,b.y+3.93,8))`),
  'the open belfry roof does not replace the accessible stair landing');
});

test('cathedral buttresses stop walking and sideways vehicles without blocking the great doors', () => {
  const { ev } = loadCity();
  assert.ok(ev(`LANDMARK_BUILDINGS.filter(b=>b.kind==='cathedral').every(b=>{
    const o=b.solids.find(o=>o.kind==='buttress');
    return !map[idx(Math.floor(o.x),Math.floor(o.y))] && landmarkBlocked(o.x,o.y,.03) &&
      !carBodyClear(o.x,o.y,Math.SQRT1_2,Math.SQRT1_2) &&
      carBodyClear(b.x+5,b.y+3.65,0,1,.1,.08);
  })`));
});

test('a purchased Belle balcony is a real outdoor surface attached to its apartment building', () => {
  const { ev } = loadCity();
  const result = ev(`(()=>{
    const cell=freeHomeNear(px,py,'belle'),home={cell,kind:'home_belle'},b=homeBalconyBounds(home);
    const x=b.x0+.3,y=b.doorY,before=homeBalconyHeight(x,y);
    owned.homes.push(home);
    return [before,homeBalconyHeight(x,y),b.z,map[idx(Math.floor(x),Math.floor(y))],
      homeBalconyHeight(b.x1+.01,y),homeBalconyHeight(x,b.y0-.01),policeRoofHeight(x,y),
      homeBalconyBounds({cell,kind:'home_loft'})];
  })()`);
  assert.equal(result[0],0);
  assert.equal(result[1],result[2]);
  assert.equal(result[3],0,'the balcony projects over an open street-facing cell');
  assert.equal(result[4],0); assert.equal(result[5],0);
  assert.equal(result[6],result[2]); assert.equal(result[7],null);
});
