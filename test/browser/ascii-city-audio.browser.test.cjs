'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

test('recorded police sirens share a gapless buffer, spatialize, and stop when returning or busted', async () => {
  const root = path.resolve(__dirname, '../..');
  let releaseClip, requestedClip, clipRequests = 0;
  const loading = new Promise(resolve => { releaseClip = resolve; });
  const requested = new Promise(resolve => { requestedClip = resolve; });
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const filename = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    if (pathname.endsWith('/police-siren.wav')) { clipRequests++; requestedClip(); await loading; }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    res.end(fs.readFileSync(filename));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    await page.route('https://**', route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/ascii-city.html`);
    await page.evaluate(() => {
      paused = true; clearWanted(); audioStart();
      for (const c of cars) { c.returning = true; c.pursuit = false; }
      const officers = cars.filter(c => c.kind === 'police').slice(0, 2);
      officers.forEach((c, i) => {
        c.returning = false; c.state = 'out';
        c.x = c.ex = px + (i ? -2 : 2); c.y = c.ey = py + (i ? -2 : 2);
        c.hx = i ? 1 : -1; c.hy = 0; c.v = 2;
      });
      window.sirenTestCars = officers;
      tickSirens(false);
    });
    await requested;
    assert.equal(await page.evaluate(() => sirens.size), 0, 'no voice starts with a missing buffer');
    // A vehicle that finishes its call while loading must not acquire a stale voice.
    await page.evaluate(() => { sirenTestCars[1].returning = true; });
    releaseClip();
    await page.waitForFunction(() => !!policeSirenBuffer);
    await page.evaluate(() => { tickSirens(false); });
    assert.equal(await page.evaluate(() => sirens.size), 1);
    await page.evaluate(() => { sirenTestCars[1].returning = false; tickSirens(false); });
    await page.waitForTimeout(500);
    const voices = await page.evaluate(() => [...sirens.values()].map(v => ({
      recorded: v.recorded, bufferSource: v.o instanceof AudioBufferSourceNode,
      sharedBuffer: v.o.buffer === policeSirenBuffer, loop: v.o.loop,
      duration: v.o.buffer.duration, rate: v.o.playbackRate.value,
      pan: v.p.pan.value, gain: v.g.gain.value, cutoff: v.lp.frequency.value
    })));
    assert.equal(voices.length, 2);
    for (const v of voices) {
      assert.ok(v.recorded && v.bufferSource && v.sharedBuffer && v.loop);
      assert.ok(Math.abs(v.duration - 112201 / 24000) < 1 / 24000);
      assert.ok(v.rate > 1 && v.rate < 1.2, 'approaching cars raise pitch');
      assert.ok(v.gain > 0.3 && v.cutoff > 2000);
    }
    assert.ok(voices[0].pan * voices[1].pan < 0, 'opposite sides pan in opposite directions');
    assert.equal(clipRequests, 1, 'the recording is fetched once for all cars');

    // Render several real Web Audio loops, checking every output sample against
    // the decoded buffer, including samples on each side of the loop boundary.
    const looping = await page.evaluate(async () => {
      const buf = policeSirenBuffer, frames = buf.length * 3;
      const offline = new OfflineAudioContext(buf.numberOfChannels, frames, buf.sampleRate);
      const source = offline.createBufferSource(); source.buffer = buf; source.loop = true;
      source.connect(offline.destination); source.start();
      const output = await offline.startRendering();
      let error = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const expected = buf.getChannelData(c), actual = output.getChannelData(c);
        for (let i = 0; i < frames; i++) error = Math.max(error, Math.abs(actual[i] - expected[i % buf.length]));
      }
      return { error, copies: output.length / buf.length };
    });
    assert.equal(looping.copies, 3);
    assert.ok(looping.error < 1e-6, JSON.stringify(looping));

    await page.evaluate(() => {
      for (const c of sirenTestCars) c.v = -2;
      tickSirens(true);
    });
    await page.waitForTimeout(650);
    const indoors = await page.evaluate(() => [...sirens.values()].map(v => ({ rate: v.o.playbackRate.value, gain: v.g.gain.value, cutoff: v.lp.frequency.value })));
    for (let i = 0; i < indoors.length; i++) {
      assert.ok(indoors[i].rate < 1, 'receding cars lower pitch');
      assert.ok(indoors[i].gain < voices[i].gain * 0.15, 'walls attenuate sirens');
      assert.ok(indoors[i].cutoff < 800, 'walls muffle sirens');
    }
    await page.evaluate(() => {
      window.endedSirens = 0;
      for (const v of sirens.values()) v.o.addEventListener('ended', () => endedSirens++);
      sirenTestCars[0].returning = true; tickSirens(false);
    });
    assert.equal(await page.evaluate(() => sirens.size), 1, 'returning officer is quiet');
    await page.evaluate(() => { wanted.busted = true; tickSirens(false); });
    assert.equal(await page.evaluate(() => sirens.size), 0, 'being caught stops remaining voices');
    await page.waitForFunction(() => endedSirens === 2);
    assert.deepEqual(errors, []);
  } finally {
    releaseClip();
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
