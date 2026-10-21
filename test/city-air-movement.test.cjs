'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();
ev('body.hop=1.9');

test('air strafing adds useful lateral velocity without replacing forward momentum or adding idle drag',()=>{
  ev('body.mx=.8;body.my=0;for(let n=0;n<20;n++)airStrafe(0,1,.8,1/120,0)');
  assert.equal(ev('body.mx'),.8);
  assert.ok(ev('body.my')>.15&&ev('body.my')<.25,'a modest correction is available without sprint-speed sideways motion');
  const before=ev('JSON.stringify([body.mx,body.my])');
  ev('airStrafe(0,0,.8,.5,0)');
  assert.equal(ev('JSON.stringify([body.mx,body.my])'),before);
});

test('air wish directions rotate with the camera and steering keeps existing drift',()=>{
  ev('body.mx=.8;body.my=0;for(let n=0;n<20;n++)airStrafe(1,0,.8,1/120,Math.PI/2)');
  assert.ok(ev('body.mx')>.79&&ev('body.my')>.15&&ev('body.my')<.25,'looking north while holding forward adds northward movement to eastward momentum');
  ev('body.mx=0;body.my=.8;airStrafe(0,-1,.8,.1,Math.PI/2)');
  assert.ok(ev('body.mx')>.1&&ev('body.mx')<.13&&ev('body.my')>.79,'left is relative to the north-facing camera');
});

test('air control converges to the same velocity across frame rates and handles zero-time frames',()=>{
  const velocities=JSON.parse(ev(`JSON.stringify([30,60,120].map(fps=>{
    body.mx=.8;body.my=0;for(let n=0;n<fps;n++)airStrafe(0,1,.8,1/fps,0);
    airStrafe(1,0,Infinity,0,0);return [body.mx,body.my];
  }))`));
  for(const [x,y] of velocities){assert.ok(Math.abs(x-.8)<1e-10);assert.ok(Math.abs(y-.24)<1e-10);}
});

test('alternating sideways inputs cannot instantly reverse a hop and steering changes direction gently',()=>{
  ev('body.mx=.8;body.my=0;for(let n=0;n<60;n++)airStrafe(0,n%2?1:-1,.8,1/60,0)');
  assert.ok(Math.abs(ev('body.my'))<.03);assert.ok(ev('body.mx')>.79);
  ev('body.mx=.8;body.my=0;airStrafe(0,1,.8,.2,0);var beforeSide=body.my;airStrafe(0,-1,.8,1/60,0)');
  assert.ok(ev('body.my')>0,'one opposite input cannot flip the velocity');
  ev('body.mx=.8;body.my=0;for(let n=0;n<30;n++)airSteer(0,1,HOP_TURN_RATE,1/60)');
  assert.ok(ev('Math.atan2(body.my,body.mx)')<.71);assert.ok(Math.abs(ev('Math.hypot(body.mx,body.my)')-.8)<1e-9);
});

test('ordinary jumps retain the air correction needed by authored rooftop crossings',()=>{
  ev('body.hop=1;body.mx=.8;body.my=0;for(let n=0;n<30;n++)airStrafe(0,1,.8,1/60,0)');
  assert.ok(Math.abs(ev('body.my')-.56)<1e-9);assert.equal(ev('body.mx'),.8);
  ev('body.hop=1.9');
});
