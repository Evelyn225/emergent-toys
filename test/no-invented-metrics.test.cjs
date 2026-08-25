'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'apps', 'sysmon.js'), 'utf8');

// SYSMON is a system monitor. There is no honest reason for it to contain a
// random number generator, and for three phases it contained eight.
test('SYSMON does not invent a number', () => {
  assert.ok(!/Math\.random/.test(SRC), 'Math.random is back in SYSMON');
});

test('the invented meters are gone, not merely hidden', () => {
  ['Soul Integrity', 'Dream Cache', 'Entropy Level', 'Void Pressure',
   'Daemon Activity', 'Coherence'].forEach(function (label) {
    assert.ok(!SRC.includes(label), label + ' is still in SYSMON');
  });
});

test('SYSMON reads real sources for the meters it keeps', () => {
  assert.ok(/instWindowSample/.test(SRC), 'CPU is not read from the accounting core');
  assert.ok(/fsCountFreeBlocks/.test(SRC), 'Disk is not read from the superblock');
});

// The units differ per row on purpose: a script reports interpreter bytes and
// an app reports DOM nodes. The column must never claim a single unit.
test('the memory column does not claim one unit for every row', () => {
  assert.ok(/memUnit/.test(SRC), 'rows are rendered without their per-row unit');
});
