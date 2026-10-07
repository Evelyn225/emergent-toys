'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('courier contracts keep base pay, taper only the optional bonus, and pay once',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const route=COURIER_ROUTES[0],before=money;
    const bonuses=[0,70,110,150,10000].map(t=>courierBonus(route,t));
    const invalid=startCourier('missing'),started=startCourier(),duplicate=startCourier();
    stepCourier(110);stepCourier(-10);
    const early=finishCourier();
    mode='roof';px=route.recipient.x;py=route.recipient.y;roofH=route.recipient.z;
    const completed=finishCourier(),again=finishCourier();
    return {bonuses,invalid,started,duplicate,early,completed,again,paid:money-before,records:courierRecords};
  })())`));
  assert.deepEqual(r.bonuses,[40,40,20,0,0]);
  assert.equal(r.invalid,false);assert.equal(r.started,true);assert.equal(r.duplicate,false);
  assert.equal(r.early,null);assert.equal(r.completed.pay,100);assert.equal(r.completed.seconds,110);
  assert.equal(r.again,null);assert.equal(r.paid,100);
  assert.deepEqual(r.records,{trips:1,earned:100,best:110,failed:0});
});

test('courier saves preserve elapsed time and validate routes, times and records',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    loadCourier({job:{id:'garden',took:123.5},records:{trips:2,earned:205,best:76.2,failed:1}});
    const good={job:{...courierJob},records:{...courierRecords}};
    const invalid=[{id:'missing',took:0},{id:'garden',took:-1},{id:'garden',took:Infinity}].map(job=>{loadCourier({job,records:{trips:-1,earned:NaN,best:-20,failed:'3'}});return courierJob;});
    loadCourier();const oldSave={job:courierJob,records:{...courierRecords}};
    startCourier();const failed=failCourier(),twice=failCourier();
    return {good,invalid,oldSave,failed,twice,count:courierRecords.failed};
  })())`));
  assert.deepEqual(r.good,{job:{id:'garden',took:123.5},records:{trips:2,earned:205,best:76.2,failed:1}});
  assert.deepEqual(r.invalid,[null,null,null]);
  assert.deepEqual(r.oldSave,{job:null,records:{trips:0,earned:0,best:null,failed:0}});
  assert.equal(r.failed,true);assert.equal(r.twice,false);assert.equal(r.count,1);
});

test('courier decks and treads share their geometry with shelter and retain genuine jump gaps',()=>{
  const {ev}=loadCity();
  const r=JSON.parse(ev(`JSON.stringify((()=>{
    const surfaces=COURIER_SURFACES.map(o=>({kind:o.kind,x:o.x,y:o.y,height:courierSurfaceTop(o,o.x,o.y),
      collision:courierRoofHeight(o.x,o.y),geometry:geometrySurfaceHeight(o,o.x,o.y),
      topExposed:snowExposed(o.x,o.y,o.z1),groundExposed:snowExposed(o.x,o.y)}));
    return {surfaces,gaps:[[184.9,108.52],[193.1,101.27]].map(([x,y])=>courierRoofHeight(x,y)),
      wrapped:courierRoofHeight(179.5+N,105-N),base:courierRoofHeight(179.5,105),police:policeRoofHeight(184.5,107.4)};
  })())`));
  for(const o of r.surfaces){
    assert.ok(Math.abs(o.height-o.geometry)<1e-8,JSON.stringify(o));
    assert.ok(o.collision>=o.height-1e-8);
    assert.equal(o.groundExposed,false,JSON.stringify(o));
  }
  assert.ok(r.surfaces.filter(o=>o.topExposed).length>=8,'decks and treads are exposed to snow');
  assert.deepEqual(r.gaps,[0,0]);assert.equal(r.wrapped,r.base);
  assert.ok(r.police>1.4,'police roof navigation includes the narrow crossing at the edge of a cell');
});

test('courier bridges are level, steps have small risers, and the garden drop has no ramp',()=>{
  const {ev}=loadCity();
  assert.equal(ev('COURIER_SURFACES.filter(o=>o.kind==="bridge").length'),4);
  assert.equal(ev('COURIER_SURFACES.every(o=>o.h0===o.h1)'),true);
  assert.equal(ev('COURIER_SURFACES.some(o=>courierContains(o,198,102.4))'),false);
  const flights=JSON.parse(ev('JSON.stringify(COURIER_STAIRS.map(o=>({rise:Math.abs(o.h1-o.h0),length:2*(o.axis==="y"?o.hw:o.hl)})))'));
  for(const flight of flights)assert.ok(flight.length/flight.rise>3,'the rise fits a plausible stair flight');
  const steps=JSON.parse(ev('JSON.stringify(COURIER_SURFACES.filter(o=>o.kind==="step").map(o=>o.z1-o.z0))'));
  for(const height of steps)assert.ok(height<=.034+1e-9,'each tread covers a small riser and its thickness');
});
