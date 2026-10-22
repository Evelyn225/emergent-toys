'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('the elevated landing surface and station platforms wrap with the world',()=>{
  const {ev}=loadCity();
  assert.equal(ev('elDeckHeight(20,EL_Y+1)'),ev('EL_TOP'));
  assert.equal(ev('elDeckHeight(20+N,EL_Y+1-N)'),ev('EL_TOP'));
  assert.equal(ev('elDeckHeight(20,EL_Y0-.06)'),0);
  assert.equal(ev('elDeckHeight(20,EL_Y1+.06)'),0);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x+N,EL_PLAT[0]-N).tr'),0);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x,EL_TRACK[0])'),null);
  assert.equal(ev('elPlatformAt(EL_STATIONS[0].x,EL_Y0-.06)'),null);
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
  assert.equal(r.under, null, 'the street remains walkable beneath the raised flight');
  assert.equal(r.deck, false, 'off the top landing onto the deck');
  assert.equal(r.street, null, 'the sidewalk elsewhere is nothing to do with the stairs');
});

test('both stair orientations allow headroom underneath without lifting the street, while posts and low treads stay solid',()=>{
  const {ev}=loadCity();
  const cases=JSON.parse(ev(`JSON.stringify(EL_STATIONS.flatMap(s=>s.stairs.map(st=>{
    const at=(u,v)=>[worldCoord(st.ox+st.c*(st.off+u)+st.ax*v),st.oy+st.s*(st.off+u)+st.ay*v],vm=(ELS.v0+ELS.v1)/2;
    const from=at(.25,ELS.v1+.08),to=at(.25,vm),post=at(ELS.u3,ELS.v0+.01),low=at(ELS.u0+.15,vm);
    elStairOn=null;
    const street=outdoorGroundHeight(...to),under=elStairStep(...from,...to,null,0);
    elStairOn=st;
    const tread=outdoorGroundHeight(...to);elStairOn=null;
    return {under,street,tread,post:elStairPostAt(...post,0),low:elStairStep(...from,...low,null,0),
      seam:Math.abs((st.oy+st.ay*ELS.top)-(st.tr?EL_Y1+EL_PLATFORM_OUT:EL_Y0-EL_PLATFORM_OUT))<1e-10};
  })))`));
  for(const r of cases){assert.equal(r.under,null);assert.equal(r.street,0);assert.ok(r.tread>.17);assert.equal(r.post,true);assert.equal(r.low,true);assert.equal(r.seam,true);}
});

test('station railings protect the outer edge and platform ends, leaving stair mouths and train boarding open',()=>{
  const {ev}=loadCity();
  const cases=JSON.parse(ev(`JSON.stringify(EL_STATIONS.flatMap(s=>s.stairs.map(st=>{
    const tr=st.tr,y=tr?EL_Y1+EL_PLATFORM_OUT:EL_Y0-EL_PLATFORM_OUT,opening=st.ox+st.c*(st.off+(ELS.u3+ELS.u4)/2);
    const rails=elPlatformRails(s,tr),mid=rails.filter(r=>Math.abs(r[2]-r[0])>.1).sort((a,b)=>(b[2]-b[0])-(a[2]-a[0]))[0],x=(mid[0]+mid[2])/2;
    return {outer:elPlatformRailAt(x,y,EL_TOP),end:elPlatformRailAt(s.x0,EL_PLAT[tr],EL_TOP),
      stair:elPlatformRailAt(opening,y,EL_TOP),boarding:elPlatformRailAt(s.x,EL_PLAT[tr]+(tr?-.12:.12),EL_TOP),
      below:elPlatformRailAt(x,y,0),above:elPlatformRailAt(x,y,EL_TOP+EL_RAIL_H+.01),outside:elPlatformRailAt(s.x1+.5,y,EL_TOP)};
  })))`));
  for(const r of cases)assert.deepEqual(r,{outer:true,end:true,stair:false,boarding:false,below:false,above:false,outside:false});
});
