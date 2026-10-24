'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();

test('Friday moving day has loading, leftovers and clear-pavement phases with shared solid geometry',()=>{
  const result=ev(`(()=>{
    STREET_SCENES.moving={x:100,y:100};
    STREET_SCENES.boxes.push({x:100,y:100,c:1,s:0,hl:.2,hw:.1,z0:0,z1:.25},{x:100.5,y:100,c:1,s:0,hl:.04,hw:.04,z0:0,z1:.16,leftover:true});
    dayNum=4;tod=12;streetSceneState.lampWeek=-1;
    const loading=[movingPhase(),streetSceneHeight(100,100),streetSceneBlocked(100,100),streetSceneCarClear(100,100,1,0,.1,.1)];
    tod=18;const leftovers=[movingPhase(),streetSceneHeight(100,100),streetSceneHeight(100.5,100)];
    streetSceneState.lampWeek=movingWeek();const taken=streetSceneHeight(100.5,100);
    dayNum=5;const quiet=[movingPhase(),streetSceneBlocked(100,100)];
    return {loading,leftovers,taken,quiet};
  })()`);
  assert.deepEqual(Array.from(result.loading),['loading',.25,true,false]);
  assert.deepEqual(Array.from(result.leftovers),['leftovers',0,.16]);
  assert.equal(result.taken,0);assert.deepEqual(Array.from(result.quiet),['quiet',false]);
});

test('chalk progresses through the afternoon, rain damage persists, and a new day starts a fresh drawing',()=>{
  const result=ev(`(()=>{
    dayNum=4;tod=8;rain=0;loadStreetScenes(null);const morning=chalkProgress();
    tod=12;const noon=chalkProgress();tod=16;const finished=chalkProgress();
    rain=1;stepStreetScenes(30);const washed=chalkWash();
    rain=0;stepStreetScenes(30);const dry=chalkWash();
    loadStreetScenes({chalkDay:4,wash:washed,lampWeek:2});const restored=chalkWash();
    dayNum=5;tod=9;const next=chalkWash();stepStreetScenes(.1);
    return {morning,noon,finished,washed,dry,restored,next,reset:streetSceneState.wash};
  })()`);
  assert.equal(result.morning,0);assert.ok(result.noon>0&&result.noon<1);assert.equal(result.finished,1);
  assert.ok(result.washed>.5);assert.equal(result.dry,result.washed);assert.equal(result.restored,result.washed);
  assert.equal(result.next,0);assert.equal(result.reset,0);
});

test('miniature coaches follow equal arc distances around the oval and rise to the bridge deck',()=>{
  const result=ev(`(()=>{
    let min=Infinity,max=0,height=0,wrap=0;
    for(let k=0;k<256;k++) {
      const d=RAILWAY_LENGTH*k/256,a=railwayAtDistance(d),b=railwayAtDistance(d-.063),c=railwayAtDistance(d+RAILWAY_LENGTH);
      const distance=Math.hypot(a.x-b.x,a.y-b.y);min=Math.min(min,distance);max=Math.max(max,distance);
      height=Math.max(height,a.z);wrap=Math.max(wrap,Math.hypot(a.x-c.x,a.y-c.y));
    }
    tod=12;T=1;const stopped=railwayClock().stopped;T=9;const moving=!railwayClock().stopped;
    tod=23;const closed=!railwayClock().running;streetSceneState.demoUntil=T+48;const demo=railwayClock().running;
    return {min,max,height,wrap,stopped,moving,closed,demo};
  })()`);
  assert.ok(result.min>.055&&result.max<.064,JSON.stringify(result));assert.ok(Math.abs(result.height-.1)<1e-6);
  assert.ok(result.wrap<1e-10);assert.ok(result.stopped&&result.moving&&result.closed&&result.demo);
});
