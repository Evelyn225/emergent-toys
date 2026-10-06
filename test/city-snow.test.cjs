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
