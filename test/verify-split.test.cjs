'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { verifySplit } = require('../tools/verify-split.cjs');

test('extracted files plus inline remainder reproduce the original script body', () => {
  const result = verifySplit();
  assert.ok(result.ok, result.detail);
});
