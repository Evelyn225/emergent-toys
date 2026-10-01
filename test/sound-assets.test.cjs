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

// Every file that plays a sound. A trigger in a file missing from this list is
// invisible to the checks below, so a new caller of playSound belongs here.
const TRIGGER_SOURCES = ['os/audio.js', 'os/startup.js', 'os/shutdown.js', 'os/wm.js',
                         'os/ui-chrome.js', 'os/registry.js', 'apps/defrag.js', 'apps/paint.js',
                         'apps/daemon-ui.js'];

// A key is either a bare identifier (click:) or a quoted name ('paint-fill':).
// The quoted form exists because PAINT's sounds are named after their files,
// hyphens and all.
const KEY = String.raw`(?:([a-z][a-z0-9_]*)|'([a-z][a-z0-9_-]*)')`;
const escapeRe = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function tableBlock(name) {
  const start = audioSrc.indexOf(`const ${name} = {`);
  assert.notStrictEqual(start, -1, `const ${name} = { not found in os/audio.js`);
  const end = audioSrc.indexOf('\n};', start);
  assert.notStrictEqual(end, -1, `${name} is not terminated`);
  return audioSrc.slice(start, end);
}

function soundFiles() {
  const block = tableBlock('SOUND_FILES');
  const entries = [...block.matchAll(new RegExp(String.raw`^\s{2}${KEY}:\s*'([^']+)'`, 'gm'))]
    .map(m => ({ name: m[1] || m[2], file: m[3] }));
  // The failure this guards against is silent. This parser used to accept bare
  // keys only, so a quoted one simply did not match - and the test stayed green
  // while checking nothing about it. Every line of the table that looks like an
  // entry must have parsed as one.
  const entryLines = block.split('\n').filter(l => /^\s{2}\S[^/]*:\s*'/.test(l));
  const unparsed = entryLines.filter(l => !entries.some(e => l.includes(`'${e.file}'`)));
  assert.deepStrictEqual(unparsed, [],
    'these SOUND_FILES lines did not parse as entries, so nothing would check them');
  return entries;
}

function triggerSources() {
  return TRIGGER_SOURCES.map(rel => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
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

// The reverse: a file dropped into os/sounds with nothing pointing at it ships
// to every visitor and plays for none of them.
test('every file in os/sounds is in SOUND_FILES', () => {
  const declared = new Set(soundFiles().map(e => e.file));
  const orphans = fs.readdirSync(path.join(ROOT, 'os/sounds'))
    .filter(f => !f.startsWith('.') && !declared.has(f));
  assert.deepStrictEqual(orphans, [], 'these sound files are in os/sounds but nothing can play them');
});

// The gain table is what keeps the mix in one place; a sound with no entry
// silently falls back to a middle value, which is how an ambience loop ends up
// three times louder than intended.
test('every sound has a gain and a real trigger', () => {
  const entries = soundFiles();
  const gainBlock = tableBlock('SOUND_GAIN');
  const sources = triggerSources();

  for (const { name } of entries) {
    const n = escapeRe(name);
    assert.ok(new RegExp(String.raw`^\s{2}(?:${n}|'${n}'):`, 'm').test(gainBlock),
      `${name} has no entry in SOUND_GAIN`);
    assert.ok(
      new RegExp(String.raw`(playSound|startSoundLoop)\('${n}'`).test(sources),
      `${name} is declared but never played - either wire it up or drop it from SOUND_FILES`
    );
  }
});

// Loops are the only sounds that can outlive the thing that started them.
test('every started loop has a matching stop or duck', () => {
  const sources = triggerSources();
  const started = new Set([...sources.matchAll(/startSoundLoop\('([a-z][a-z0-9_-]*)'/g)].map(m => m[1]));
  assert.ok(started.size > 0, 'expected at least one startSoundLoop call');
  for (const name of started) {
    assert.ok(
      new RegExp(String.raw`(stopSoundLoop|duckSoundLoop)\('${escapeRe(name)}'`).test(sources),
      `${name} is looped but never stopped or ducked`
    );
  }
});
