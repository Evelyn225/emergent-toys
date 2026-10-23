'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();

test('shore breakers advance, retreat and stay below the wet-sand limit', () => {
  const result=ev(`(() => {
    const x=719,y=115,limit=.5,offset=.12*Math.sin(x*.13+y*.17);
    const peak=phase=>{
      T=(phase-offset)*7;
      let strength=0,edge=-2;
      for(let e=-1.5;e<.7;e+=.002) {
        const foam=shoreWaveFoam(x,y,e,limit);
        if(foam>strength){strength=foam;edge=e;}
      }
      return {edge,strength};
    };
    const early=peak(.2),landing=peak(.7),retreat=peak(.9);
    let escaped=0,deep=0;
    for(let n=0;n<140;n++) {
      T=n*.1;
      for(let e=limit;e<limit+2;e+=.05)escaped+=shoreWaveFoam(x,y,e,limit);
      deep+=shoreWaveFoam(x,y,-2,limit);
    }
    T=0;const start=shoreWaveFoam(x,y,-.6,limit);
    T=7;const repeat=shoreWaveFoam(x,y,-.6,limit);
    return {early,landing,retreat,escaped,deep,repeat:Math.abs(start-repeat)};
  })()`);
  assert.ok(result.landing.edge > result.early.edge + .8,JSON.stringify(result));
  assert.ok(result.landing.edge > result.retreat.edge + .5,JSON.stringify(result));
  assert.ok(result.landing.strength > .9,JSON.stringify(result));
  assert.equal(result.escaped,0);
  assert.equal(result.deep,0);
  assert.ok(result.repeat<1e-10);
});

test('foam rides the water: never ahead of the wave front on dry sand, and joined to the water behind it', () => {
  const r=ev(`(() => {
    const x=719,y=115,limit=.5;let ahead=0,gaps=0;
    for(let n=0;n<140;n++) {
      T=n*.1;const crest=shoreWaveFront(shoreWavePhase(x,y),limit);
      for(let e=-1.5;e<limit;e+=.005) if(e>crest&&shoreWaveFoam(x,y,e,limit)>0)ahead++;
      // the foam's shoreward end is the waterline itself
      const at=shoreWaveFoam(x,y,crest-.001,limit),phase=shoreWavePhase(x,y);
      if(Math.min(phase,1-phase)>.1&&at<.5)gaps++;
    }
    return {ahead,gaps};
  })()`);
  assert.equal(r.ahead,0,'no foam ahead of the water');assert.equal(r.gaps,0,'the foam reaches the waterline');
});
test('at a wall or rocks (no beach to run up) there is no white line crossing still water: the wave breaks against the edge and falls back', () => {
  const r=ev(`(() => {
    const x=300,y=200;let offshore=0,peak=0,calm=1;
    for(let n=0;n<140;n++) {
      T=n*.05;
      for(let e=-1.4;e<-.2;e+=.01)offshore+=shoreWaveFoam(x,y,e,0);
      const at=shoreWaveFoam(x,y,-.03,0);peak=Math.max(peak,at);calm=Math.min(calm,at);
    }
    return {offshore,peak,calm};
  })()`);
  assert.equal(r.offshore,0,'nothing travelling over the open water');
  assert.ok(r.peak>.8&&r.calm===0,'it surges white at the edge, then clears: '+JSON.stringify(r));
});
test('beach wash animates only the existing wet sand', () => {
  const result=ev(`(() => {
    const limit=shoreWetSandLimit(.5),wet=new Set(),dry=new Set();
    for(let n=0;n<140;n++) {
      T=n*.1;
      wet.add(islandShoreSurface(719,115,.2,true,false,.01,.5).base);
      dry.add(JSON.stringify(islandShoreSurface(719,115,limit+.001,true,false,.01,.5)));
    }
    return {wash:wet.has(WHITE),sand:wet.has(WARM),dry:dry.size};
  })()`);
  assert.equal(result.wash,true);
  assert.equal(result.sand,true);
  assert.equal(result.dry,1);
});

test('backwash exposes sand seaward of the resting coast and foam has an opaque pale surface',()=>{
 const r=ev(`(()=>{const x=707,y=100,patch=.5,offset=.12*Math.sin(x*.13+y*.17),samples=[];for(let phase=0;phase<1;phase+=.02){T=(phase-offset)*7;samples.push(islandShoreSurface(x,y,-.4,true,false,.8,patch));}return {exposed:samples.some(s=>!s.water&&s.background===BRICK),covered:samples.some(s=>s.water&&s.background===BLUE),foam:samples.some(s=>s.foam&&[WHITE,CYAN].includes(s.background)),join:Math.abs(shoreWaveFront(0,.5)-shoreWaveFront(1,.5))};})()`);
 assert.equal(r.exposed,true);assert.equal(r.covered,true);assert.equal(r.foam,true);assert.ok(r.join<1e-9);
});
