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
