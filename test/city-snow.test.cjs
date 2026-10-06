'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

const { ev } = loadCity();

test('settled snow grows gradually, melts completely, and stays continuous across cell and block boundaries', () => {
  const result = JSON.parse(ev(`JSON.stringify((() => {
    let monotonic = true, continuous = true, partial = false;
    for (let x = 0; x <= 32; x++) {
      let previous = 0;
      for (const cover of [0, 0.02, 0.1, 0.25, 0.5, 0.75, 1]) {
        snowCover = cover;
        const amount = settledSnow(x, 12.37);
        monotonic &&= amount >= previous && amount <= 1;
        partial ||= amount > 0 && amount < 1;
        continuous &&= Math.abs(settledSnow(x - 0.00001, 12.37) - settledSnow(x + 0.00001, 12.37)) < 0.001;
        previous = amount;
      }
    }
    snowCover = 1;
    const complete = settledSnow(7.4, 8.3), worn = settledSnow(7.4, 8.3, 0.8);
    snowCover = 0;
    return { monotonic, continuous, partial, complete, worn, melted: settledSnow(7.4, 8.3) };
  })())`));
  assert.ok(result.monotonic && result.continuous && result.partial);
  assert.equal(result.complete, 1);
  assert.ok(result.worn < result.complete);
  assert.equal(result.melted, 0);
});

test('cached snow preserves the original texture through lattice collisions and distant world copies', () => {
  const result = JSON.parse(ev(`JSON.stringify((() => {
    const original=(x,y,cover,wear)=>{
      const drift=noise(x*.8,y*.8,43)*.7+noise(x*2.1,y*2.1,45)*.25+noise(x*7,y*7,44)*.05;
      const edge=clamp((cover*1.3-drift+.16)/.32,0,1);
      return edge*edge*(3-2*edge)*clamp(cover*8,0,1)*(1-wear);
    };
    let errors=0;
    for(let n=0;n<5000;n++) {
      const x=(n*71%613)-130+.0137,y=(n*113%521)-90+.0271;
      for(let f=0;f<4;f++) {
        const {scale,seed}=SNOW_FIELDS[f],expected=noise(x*scale,y*scale,seed);
        if(snowNoise(x,y,f)!==expected)errors++;
        snowNoise(x+512/scale,y,f); // evict this slot with a different coordinate
        if(snowNoise(x,y,f)!==expected)errors++;
      }
      for(const cover of [.02,.35,.7,.89,.9,1]) {
        snowCover=cover;
        if(settledSnow(x,y,.65)!==original(x,y,cover,.65))errors++;
      }
    }
    snowCover=0;return {errors};
  })())`));
  assert.deepEqual(result,{errors:0});
});
