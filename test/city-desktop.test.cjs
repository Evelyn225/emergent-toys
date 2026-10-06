'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../city/desktop-release.js'), 'utf8');
const { desktopReleaseUpdate, newerDesktopVersion } = vm.runInNewContext(source + '\n({desktopReleaseUpdate, newerDesktopVersion})');
const release = (version, overrides = {}) => ({
  tag_name: 'ascii-city-v' + version,
  assets: [{ name: 'Glyphport-Setup.exe', browser_download_url: `https://github.com/Evelyn225/emergent-toys/releases/download/ascii-city-v${version}/Glyphport-Setup.exe` }],
  ...overrides
});
test('desktop update versions compare numerically, including double-digit patches', () => {
  assert.equal(newerDesktopVersion('1.0.10', '1.0.9'), true);
  assert.equal(newerDesktopVersion('2.0.0', '1.99.99'), true);
  for (const version of ['1.0.3', '1.0.2', '1.0.4-beta', '../1.0.4', '01.0.4', null]) assert.equal(newerDesktopVersion(version, '1.0.3'), false);
});
test('desktop updates select the newest complete official installer, ignoring unrelated and unfinished releases', () => {
  const releases = [release('1.0.4'), release('1.0.10'), release('1.0.8'), release('9.0.0', { draft: true }),
    release('8.0.0', { prerelease: true }), release('7.0.0', { tag_name: 'another-toy-v7.0.0' }),
    release('6.0.0', { assets: [] }), release('5.0.0', { assets: [{ name: 'Glyphport-Setup.exe', browser_download_url: 'https://untrusted.example/setup.exe' }] }), { tag_name: 5 }, null];
  const update = desktopReleaseUpdate(releases, '1.0.3');
  assert.equal(update.version, '1.0.10');
  assert.equal(update.url, release('1.0.10').assets[0].browser_download_url);
  assert.equal(desktopReleaseUpdate(releases, '1.0.10'), null);
  assert.throws(() => desktopReleaseUpdate({}, '1.0.3'));
  assert.throws(() => desktopReleaseUpdate([], undefined));
});
test('desktop staging embeds the same installed version as the native app', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));
  const cargo = fs.readFileSync(path.join(__dirname, '../src-tauri/Cargo.toml'), 'utf8');
  assert.equal(cargo.match(/^version = "([^"]+)"/m)[1], config.version);
});
