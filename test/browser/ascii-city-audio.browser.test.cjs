'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

// Web Audio can advance more slowly than wall time on a busy headless runner.
async function settleAudio(page, seconds) {
  const until = await page.evaluate(s => actx.currentTime + s, seconds);
  await page.waitForFunction(until => actx.currentTime >= until, until);
}

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
      // (paused, so only these hand-driven ticks move the sirens; a frozen frame would hush them, checked below)
      paused = true; clearWanted(); audioStart();
      window.realHush = hushSirens; hushSirens = () => {};
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
    await settleAudio(page, .5);
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

    // A frozen frame (a shop, the inventory, the map) silences them rather than leaving them holding a note
    await page.evaluate(() => { hushSirens = realHush; });
    await settleAudio(page, .4);
    assert.ok(await page.evaluate(() => [...sirens.values()].every(v => v.g.gain.value < 0.01)), 'paused: the sirens fall silent');
    await page.evaluate(() => { hushSirens = () => {}; tickSirens(false); });

    await page.evaluate(() => {
      for (const c of sirenTestCars) c.v = -2;
      tickSirens(true);
    });
    await settleAudio(page, .8);
    const indoors = await page.evaluate(() => [...sirens.values()].map(v => ({ rate: v.o.playbackRate.value, gain: v.g.gain.value, cutoff: v.lp.frequency.value })));
    for (let i = 0; i < indoors.length; i++) {
      assert.ok(indoors[i].rate < 1, 'receding cars lower pitch');
      assert.ok(indoors[i].gain < voices[i].gain * 0.15, 'walls attenuate sirens');
      assert.ok(indoors[i].cutoff < 800, 'walls muffle sirens');
    }
    // Exercise the same shutdown code on an offline clock. An online source's
    // future stop depends on the runner's audio device progressing; that final
    // wall-clock wait intermittently timed out after all live checks passed.
    // Keep the sources, render through both stop times, and verify real output.
    const stopped = await page.evaluate(async () => {
      for (const v of sirens.values()) v.o.stop();
      sirens.clear();
      const online = actx, bus = sfxBus;
      const offline = new OfflineAudioContext(2, 24000 * 3, 24000);
      let ended = 0;
      try {
        actx = offline; sfxBus = offline.destination;
        wanted.busted = false; for (const c of sirenTestCars) c.returning = false;
        tickSirens(false);
        const voices = [...sirens.values()];
        const completions = voices.map(v => new Promise(resolve => {
          v.o.addEventListener('ended', () => { ended++; resolve(); }, { once: true });
          v.g.gain.setValueAtTime(.4, 0);
        }));
        sirenTestCars[0].returning = true; tickSirens(false);
        const returning = sirens.size;
        wanted.busted = true; tickSirens(false);
        const busted = sirens.size;
        const output = await offline.startRendering();
        await Promise.all(completions);
        const samples = output.getChannelData(0);
        let early = 0, tail = 0;
        for (let k = 0; k < 4800; k++) early += samples[k] ** 2;
        for (let k = 48000; k < samples.length; k++) tail = Math.max(tail, Math.abs(samples[k]));
        return { returning, busted, ended, voices: voices.length, early, tail };
      } finally { actx = online; sfxBus = bus; sirens.clear(); }
    });
    assert.equal(stopped.voices, 2);
    assert.equal(stopped.returning, 1, 'returning officer is quiet');
    assert.equal(stopped.busted, 0, 'being caught stops remaining voices');
    assert.equal(stopped.ended, 2, 'both sources dispatch ended');
    assert.ok(stopped.early > .01, 'sources render audio before their stop deadlines');
    assert.equal(stopped.tail, 0, 'stopped sources render silence beyond both deadlines');
    assert.deepEqual(errors, []);
  } finally {
    releaseClip();
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
