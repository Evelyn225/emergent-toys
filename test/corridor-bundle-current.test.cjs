'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildCorridor, readCorridorManifest, OUT } = require('../tools/build-corridor.cjs');

const ROOT = path.join(__dirname, '..');

// The bundle is committed and is what corridor.html runs, so a stale one ships.
test('corridor.bundle.js matches its sources', () => {
  assert.strictEqual(fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'), buildCorridor(), 'bundle is stale - run: npm run build');
});

test('every file in corridor/ is in the manifest, and every manifest entry exists', () => {
  const listed = readCorridorManifest().sources;
  const present = fs.readdirSync(path.join(ROOT, 'corridor')).filter(name => name.endsWith('.js')).map(name => 'corridor/' + name);
  assert.deepStrictEqual([...listed].sort(), present.sort());
});

// Sounds are fetched by URL, so they must exist and sit under audio/**, which vercel.json deploys.
test('every sound the game fetches exists under audio/', () => {
  const source = fs.readFileSync(path.join(ROOT, 'corridor/audio.js'), 'utf8');
  const dir = source.match(/const soundDir = '([^']+)'/);
  assert.ok(dir, "const soundDir = '...' not found in corridor/audio.js");
  const files = [...source.matchAll(/'([a-z0-9-]+\.mp3)'/g)].map(m => m[1]);
  assert.ok(files.length >= 19, 'expected the sound table, found ' + files.length);
  assert.ok(dir[1].startsWith('audio/'));
  for (const file of files) assert.ok(fs.existsSync(path.join(ROOT, dir[1], file)), dir[1] + file + ' is missing');
});

test('the generated family photograph is packaged under the deployed images directory', () => {
  const source = fs.readFileSync(path.join(ROOT,'corridor/remnants.js'),'utf8');
  const asset = source.match(/const familyPhotoPath = '([^']+)'/);
  assert.ok(asset && asset[1].startsWith('images/corridor/'),'photo must use the deployed images directory');
  const png = fs.readFileSync(path.join(ROOT,asset[1]));
  assert.deepStrictEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10],'the actual generated PNG must be included');
});
