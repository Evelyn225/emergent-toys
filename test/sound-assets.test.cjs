'use strict';
// os/audio.js fetches its files by name at runtime, and a fetch that 404s is
// swallowed on purpose so a missing sound never breaks the thing it decorates.
// That is the right behaviour at runtime and a terrible one for catching a
// rename: the OS just goes quiet. This turns a typo or a deleted .ogg into a
// build failure instead.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const audioSrc = fs.readFileSync(path.join(ROOT, 'os/audio.js'), 'utf8');

function soundFiles() {
  const start = audioSrc.indexOf('const SOUND_FILES = {');
  assert.notStrictEqual(start, -1, 'const SOUND_FILES = { not found in os/audio.js');
  const end = audioSrc.indexOf('\n};', start);
  assert.notStrictEqual(end, -1, 'SOUND_FILES is not terminated');
  const block = audioSrc.slice(start, end);
  return [...block.matchAll(/^\s{2}([a-z][a-z0-9_]*):\s*'([^']+)'/gm)].map(m => ({ name: m[1], file: m[2] }));
}

test('every sound in SOUND_FILES exists in os/sounds', () => {
  const entries = soundFiles();
  assert.ok(entries.length >= 7, `expected to find the SOUND_FILES table, found ${entries.length} entries`);
  for (const { name, file } of entries) {
    const full = path.join(ROOT, 'os/sounds', file);
    assert.ok(fs.existsSync(full), `${name} points at os/sounds/${file}, which does not exist`);
    assert.ok(fs.statSync(full).size > 0, `os/sounds/${file} is empty`);
  }
});

// The gain table is what keeps the mix in one place; a sound with no entry
// silently falls back to a middle value, which is how an ambience loop ends up
// three times louder than intended.
test('every sound has a gain and a real trigger', () => {
  const entries = soundFiles();
  const gainStart = audioSrc.indexOf('const SOUND_GAIN = {');
  assert.notStrictEqual(gainStart, -1, 'const SOUND_GAIN = { not found in os/audio.js');
  const gainBlock = audioSrc.slice(gainStart, audioSrc.indexOf('\n};', gainStart));

  const sources = ['os/audio.js', 'os/startup.js', 'os/shutdown.js', 'os/wm.js', 'os/ui-chrome.js',
                   'os/registry.js', 'apps/defrag.js']
    .map(rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');

  for (const { name } of entries) {
    assert.ok(new RegExp(`^\\s{2}${name}:`, 'm').test(gainBlock), `${name} has no entry in SOUND_GAIN`);
    assert.ok(
      new RegExp(`(playSound|startSoundLoop)\\('${name}'`).test(sources),
      `${name} is declared but never played - either wire it up or drop it from SOUND_FILES`
    );
  }
});

// Loops are the only sounds that can outlive the thing that started them.
test('every started loop has a matching stop or duck', () => {
  const sources = ['os/startup.js', 'os/shutdown.js', 'os/wm.js', 'apps/defrag.js']
    .map(rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
  const started = new Set([...sources.matchAll(/startSoundLoop\('([a-z]+)'/g)].map(m => m[1]));
  assert.ok(started.size > 0, 'expected at least one startSoundLoop call');
  for (const name of started) {
    assert.ok(
      new RegExp(`(stopSoundLoop|duckSoundLoop)\\('${name}'`).test(sources),
      `${name} is looped but never stopped or ducked`
    );
  }
});
