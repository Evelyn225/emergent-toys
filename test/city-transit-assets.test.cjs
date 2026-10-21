'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadCity } = require('./helpers/load-city.cjs');
const root = path.resolve(__dirname, '..');
const { ev } = loadCity();
const json = expr => JSON.parse(ev('JSON.stringify(' + expr + ')'));

test('every actual transit label has a recording, while unknown/missing labels skip the whole utterance', () => {
  const labels = json('[...new Set([...stations, ...EL_STATIONS].map(s => s.name))]');
  const assets = json('TRANSIT_ASSETS');
  assert.deepEqual(labels.filter(name => !assets.stations[name]), []);
  assert.deepEqual(labels.filter(name => !assets.stations[name].file), []);
  ev("TRANSIT_ASSETS.stations['KING ST'].file = null");
  assert.equal(ev("transitFiles('next', 'KING ST')"), null);
  ev("TRANSIT_ASSETS.stations['KING ST'].file = 'transit/king-st.wav'");
  assert.equal(ev("transitFiles('arrival', 'unrecorded')"), null);
  assert.deepEqual(json("transitFiles('next', '3RD AVE')"), ['transit/next.wav', 'transit/3rd-ave.wav']);
});

test('prepared clips exist, have distinct original paths, consistent measured levels and mono PCM encoding', () => {
  const assets = json('TRANSIT_ASSETS');
  const report = JSON.parse(fs.readFileSync(path.join(root, 'audio/ascii-city/transit/levels.json')));
  assert.equal(report.clips.length, 33);
  assert.deepEqual(report.missing, []);
  for (const clip of report.clips) {
    assert.ok(clip.lufs >= -21 && clip.lufs <= -19.8, clip.key);
    assert.ok(clip.truePeakDB <= -2.9, clip.key);
    const data = fs.readFileSync(path.join(root, 'audio/ascii-city', clip.file));
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    const fmt = data.indexOf(Buffer.from('fmt '));
    assert.equal(data.readUInt16LE(fmt + 8), 1, 'PCM');
    assert.equal(data.readUInt16LE(fmt + 10), 1, 'mono');
    assert.equal(data.readUInt32LE(fmt + 12), 24000);
    assert.equal(data.readUInt16LE(fmt + 22), 16);
    assert.equal(Object.values({ ...assets.phrases, ...assets.stations }).find(a => a.file === clip.file).source, clip.source);
  }
});
