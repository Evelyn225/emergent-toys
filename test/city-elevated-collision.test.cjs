'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('the elevated landing surface and station platforms wrap with the world',()=>{
  const {ev}=loadCity();
  assert.equal(ev('elDeckHeight(20,EL_Y+1)'),ev('EL_TOP'));
  assert.equal(ev('elDeckHeight(20+N,EL_Y+1-N)'),ev('EL_TOP'));
  assert.equal(ev('elDeckHeight(20,EL_Y0-.01)'),0);
  assert.equal(ev('elDeckHeight(20,EL_Y1+.01)'),0);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x+N,EL_PLAT[0]-N).tr'),0);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x,EL_TRACK[0])'),null);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x,EL_Y0-.02)'),null);
});

test('moving elevated cars hit bodies on the track but clear the sidewalk, platform and air above',()=>{
  const {ev}=loadCity();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    const tr=elTrain(0,0,15),x=tr.x;
    const hit=(y,z)=>!!elTrainImpact([x,y,z],[x,y,z],15,15.05);
    return {track:hit(EL_TRACK[0],EL_TOP),platform:hit(EL_PLAT[0],EL_TOP),
      underneath:hit(EL_TRACK[0],0),above:hit(EL_TRACK[0],EL_TOP+EL_H+.03),
      stopped:!!elTrainImpact([EL_STATIONS[0].x,EL_TRACK[0],EL_TOP],[EL_STATIONS[0].x,EL_TRACK[0],EL_TOP],1,1.05)};
  })())`));
  assert.deepEqual(result,{track:true,platform:false,underneath:false,above:false,stopped:false});
});

test('elevated impact sweeps catch crossings between frames and at the world seam',()=>{
  const {ev}=loadCity();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    const t=15,train=elTrain(0,0,t),y=EL_TRACK[0];
    const across=elTrainImpact([train.x,y-.3,EL_TOP],[train.x,y+.3,EL_TOP],t,t+.05);
    const seamTime=Array.from({length:EL_CYCLE*100},(_,i)=>i/100).find(t=>{
      const a=elTrain(0,0,t),b=elTrain(0,0,t+.05);return !a.stopped&&a.x<.2&&b.x>N-.2;
    });
    const at=elTrain(0,0,seamTime+.025);
    return {across:!!across,seam:!!elTrainImpact([at.x,y,EL_TOP],[at.x,y,EL_TOP],seamTime,seamTime+.05)};
  })())`));
  assert.deepEqual(result,{across:true,seam:true});
});

test('the el stairs: a step at a time up and down, the rails keep you on them, the turnstile wants a swipe', () => {
  const { ev } = require('./helpers/load-city.cjs').loadCity();
  const r = JSON.parse(ev(`(() => {
    const st = EL_STATIONS[2].stairs[0], at = (u, v) => [st.ox + st.c * (st.off + u) + st.ax * v, st.oy + st.s * (st.off + u) + st.ay * v];
    const vm = (ELS.v0 + ELS.v1) / 2, step = (u0, v0, u1, v1, pass) => elStairStep(...at(u0, v0), ...at(u1, v1), pass);
    // walk the whole way up in small steps, swiped in
    let up = true; for (let u = ELS.u0 - 0.1; u < ELS.u4 - 0.05; u += 0.03) up = up && !step(u, vm, u + 0.03, vm, { st });
    const top = elStairGround(...at(ELS.u4 - 0.1, vm));
    return JSON.stringify({ up, top,
      turnstile: step(ELS.u0 - 0.05, vm, ELS.u0 + 0.01, vm, null), swiped: step(ELS.u0 - 0.05, vm, ELS.u0 + 0.01, vm, { st }),
      rail: step(-0.6, vm, -0.6, ELS.v1 + 0.05, { st }), railLow: step(ELS.u0 + 0.02, vm, ELS.u0 + 0.02, ELS.v1 + 0.05, { st }),
      under: step(0.3, ELS.v1 + 0.05, 0.3, vm, { st }), deck: step(ELS.u4 - 0.1, ELS.top - 0.08, ELS.u4 - 0.1, ELS.top + 0.02, null),
      halfway: elStairGround(...at((ELS.u1 + ELS.u2) / 2, vm)), street: elStairStep(...at(ELS.u0 - 1, 0.1), ...at(ELS.u0 - 0.9, 0.1), null) });
  })()`));
  assert.ok(r.up, 'walkable from the street to the top');
  assert.equal(r.top, ev('EL_TOP'));
  assert.equal(r.halfway, ev('EL_TOP / 2'), 'a flat landing halfway');
  assert.equal(r.turnstile, true, 'no swipe, no stairs');
  assert.equal(r.swiped, false);
  assert.equal(r.rail, true, 'over the rail halfway up: no');
  assert.equal(r.railLow, false, 'off the side of the bottom step: fine');
  assert.equal(r.under, true, 'the steelwork under the stairs is solid from the street');
  assert.equal(r.deck, false, 'off the top landing onto the deck');
  assert.equal(r.street, null, 'the sidewalk elsewhere is nothing to do with the stairs');
});
