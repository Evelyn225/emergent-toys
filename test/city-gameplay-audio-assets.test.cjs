'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('the four recorded effects are normalized PCM, reload matches its action, and loop wraps stay continuous', () => {
  const report = JSON.parse(fs.readFileSync(path.join(root, 'audio/ascii-city/gameplay-levels.json')));
  assert.deepEqual(report.clips.map(c => c.key), ['gunshot', 'reload', 'sizzle', 'rotor']);
  for (const clip of report.clips) {
    const data = fs.readFileSync(path.join(root, 'audio/ascii-city', clip.file));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.readUInt16LE(22), 1); assert.equal(data.readUInt32LE(24), 24000);
    assert.equal(data.readUInt16LE(34), 16);
    assert.ok(clip.lufs > -21 && clip.lufs < -19.8, clip.key);
    assert.ok(clip.truePeakDB <= -2.9, clip.key);
    assert.equal((data.length - 44) / 48000, clip.duration);
    if (clip.key === 'reload') assert.equal(clip.duration, 1.6);
    if (clip.loop) {
      assert.equal(clip.seamSamples, 2880);
      const n = (data.length - 44) / 2;
      let averageDelta = 0;
      for (let i = 1; i < n; i++) averageDelta += Math.abs(data.readInt16LE(44 + i * 2) - data.readInt16LE(42 + i * 2));
      averageDelta /= n - 1;
      const seamDelta = Math.abs(data.readInt16LE(44) - data.readInt16LE(data.length - 2));
      assert.ok(seamDelta < Math.max(200, averageDelta * 5), `${clip.key}: wrap ${seamDelta}, mean delta ${averageDelta}`);
    }
  }
});
