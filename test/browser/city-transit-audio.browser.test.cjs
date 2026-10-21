'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, firefox } = require('playwright');
const root = path.resolve(__dirname, '../..');
let server, browser, origin;
test.before(async () => {
  server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
    res.writeHead(200, { 'Content-Type': type[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch({ args: process.env.CITY_TEST_BROWSER === 'firefox' ? [] : ['--autoplay-policy=no-user-gesture-required'] });
});
test.after(async () => { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); });
async function fixture(run, { startAudio = true, route } = {}) {
  const page = await browser.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  // Simulation is hand-driven with RAF disabled, so waits must use a wall-clock poll.
  const waitForFunction = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, arg, options = {}) => waitForFunction(fn, arg, { polling: 25, ...options });
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.route('https://**', route => route.abort());
    if (route) await route(page);
    await page.goto(origin + '/ascii-city.html');
    await page.evaluate(() => {
      paused = false; clearWanted(); cars.length = people.length = footCops.length = 0;
      window.transitTestRender = render;
      render = hud = () => {}; // Real actions + frame simulation; rendering is checked separately below.
      window.events = [];
      const announce = transitAnnounce;
      transitAnnounce = function(phrase, station, relevant, age) {
        events.push({ phrase, station: station ?? null, files: transitFiles(phrase, station), t: T });
        return announce(phrase, station, relevant, age);
      };
      window.advance = function(seconds) { const end = T + seconds; while (T < end - 1e-8) loop(t0 + Math.min(.05, end - T) * 1000); };
    });
    if (startAudio) {
      await page.evaluate(() => audioStart());
      await page.waitForFunction(() => actx?.state === 'running');
    }
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('el actual boarding, warning, departure, arrival and both endpoint reversals use next-station direction', () => fixture(async page => {
  const result = await page.evaluate(() => {
    T = 5; elUp({ s: EL_STATIONS[0], tr: 0 }); elBoard();
    const boarding = { mode, dir: elRiding().dir };
    advance(5.1); const departure = events.slice();
    // Sample the real frame loop around arrivals without replaying the skipped journey.
    T = 35.9; stepTransitAnnouncements(); advance(.2);
    const arrival = events.slice();
    T = 107.9; stepTransitAnnouncements(); advance(.2);
    const eastEnd = { mode, dir: elRiding().dir, station: elRiding().station, events: events.slice() };
    elGetOff(); elBoard(); // Same track now boards westbound.
    const returnBoarding = events.slice();
    T = 179.9; stepTransitAnnouncements(); advance(.2);
    T = 189.9; stepTransitAnnouncements(); advance(.2);
    const returnDeparture = events.slice();
    T = 215.9; stepTransitAnnouncements(); advance(.2);
    return { boarding, departure, arrival, eastEnd, returnBoarding, returnDeparture,
      westEnd: { mode, dir: elRiding().dir, station: elRiding().station, events } };
  });
  assert.deepEqual(result.boarding, { mode: 'el', dir: 1 });
  assert.deepEqual(result.departure.map(e => e.phrase), ['east', 'doors', 'next']);
  assert.equal(result.departure.at(-1).station, '11TH AVE');
  assert.deepEqual(result.departure.at(-1).files, ['transit/next.wav', 'transit/11th-ave.wav']);
  assert.equal(result.arrival.at(-1).station, '11TH AVE');
  assert.equal(result.eastEnd.mode, 'el'); assert.equal(result.eastEnd.dir, -1); assert.equal(result.eastEnd.station, 3);
  assert.equal(result.eastEnd.events.at(-1).phrase, 'returnWest');
  assert.equal(result.returnBoarding.at(-1).phrase, 'west');
  assert.equal(result.returnDeparture.at(-1).station, '3RD AVE');
  assert.equal(result.returnDeparture.at(-1).phrase, 'next');
  assert.equal(result.westEnd.mode, 'el'); assert.equal(result.westEnd.dir, 1); assert.equal(result.westEnd.station, 0);
  assert.deepEqual(result.westEnd.events.slice(-2).map(e => [e.phrase, e.station]), [['arrival', '3RD AVE'], ['returnEast', null]]);
}));

test('subway keyboard boarding selects exactly one destination and arrives in the existing nine seconds', () => fixture(async page => {
  await page.evaluate(() => {
    T = 50; enterRoom('station', { st: 0, word: stations[0].name, t0: T - 13.9 }, [23, ST_TRACK - 1, 0]);
    advance(.2); // Platform doors warning, before boarding.
  });
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => room.kind), 'train');
  await page.keyboard.press('Digit1');
  const result = await page.evaluate(() => {
    const selected = room.dest, direction = Math.sign(stations[selected].x - stations[room.st].x);
    const before = room.rideT; advance(9.01);
    return { before, selected, direction, kind: room.kind, at: room.st, name: stations[room.st].name, events };
  });
  assert.equal(result.before, 9); assert.equal(result.kind, 'station'); assert.equal(result.at, result.selected);
  const next = result.events.filter(e => e.phrase === 'next');
  assert.equal(next.length, 1); assert.equal(next[0].station, result.name);
  assert.ok(result.events.some(e => e.phrase === (result.direction > 0 ? 'east' : 'west')));
  assert.ok(result.events.some(e => e.phrase === 'doors'));
  assert.equal(result.events.filter(e => e.phrase === 'arrival').length, 1);
  await page.evaluate(() => {
    enterRoom('station', { st: 0, word: stations[0].name, t0: T - 10 }, [23, ST_TRACK - 1, 0]); interact();
    window.westOption = room.opts.findIndex(s => stations[s].x < stations[room.st].x) + 1;
    events.length = 0;
  });
  assert.ok(await page.evaluate(() => westOption > 0));
  await page.keyboard.press('Digit' + await page.evaluate(() => westOption));
  assert.equal(await page.evaluate(() => events[0].phrase), 'west');
}));

test('a departure on the first resumed frame is announced once, and late boarding prioritizes the doors', () => fixture(async page => {
  const result = await page.evaluate(() => {
    T = 9.99; elUp({ s: EL_STATIONS[0], tr: 0 }); elBoard(); events.length = 0;
    paused = true; loop(t0 + 50); paused = false; advance(.05);
    const resumed = events.slice();
    for (let i = 0; i < 10; i++) stepTransitAnnouncements();
    const repeated = events.length;
    T = 7; elUp({ s: EL_STATIONS[0], tr: 0 }); events.length = 0; elBoard();
    return { resumed, repeated, late: events.map(e => e.phrase) };
  });
  assert.deepEqual(result.resumed.map(e => e.phrase), ['next']);
  assert.equal(result.resumed[0].station, '11TH AVE');
  assert.equal(result.repeated, 1);
  assert.deepEqual(result.late, ['doors', 'east']);
}));

test('platform announcements stay on the relevant side and render/update repeats do not duplicate speech', () => fixture(async page => {
  const result = await page.evaluate(() => {
    T = 5.9; elUp({ s: EL_STATIONS[0], tr: 0 }); advance(.2);
    const onPlatform = events.slice();
    for (let i = 0; i < 30; i++) { stepTransitAnnouncements(); if (i < 3) transitTestRender(0); audioTick(0); }
    const repeated = events.length;
    elDown(); advance(.2);
    T = 5.9; elUp({ s: EL_STATIONS[0], tr: 1 }); advance(.2);
    const oppositeSide = events.length;
    T = 215.9; elUp({ s: EL_STATIONS[0], tr: 0 }); advance(.2);
    return { onPlatform, repeated, oppositeSide, events, mode };
  });
  assert.deepEqual(result.onPlatform.map(e => e.phrase), ['doors']);
  assert.equal(result.repeated, 1); assert.equal(result.oppositeSide, 1);
  assert.deepEqual(result.events.slice(1).map(e => e.phrase), ['arrival', 'alight']);
}));

test('real decoded phrase/station sources share a precise clock, cache fetches and serialize utterances', () => fixture(async page => {
  const counts = {};
  page.on('request', req => { if (req.url().includes('/transit/')) counts[req.url()] = (counts[req.url()] || 0) + 1; });
  await page.evaluate(async () => {
    T = 1; elUp({ s: EL_STATIONS[0], tr: 0 });
    await Promise.all(Object.values(CLIPS));
    const recorded = new Set(await Promise.all(Object.values(TRANSIT_ASSETS).flatMap(group => Object.values(group).filter(a => a.file).map(a => clipBuffer(a.file)))));
    window.starts = [];
    const makeSource = actx.createBufferSource.bind(actx);
    actx.createBufferSource = function() {
      const source = makeSource(), start = source.start.bind(source);
      source.start = function(when) { if (recorded.has(source.buffer)) starts.push({ when, duration: source.buffer.duration }); start(when); };
      return source;
    };
    transitAnnounce('next', '3RD AVE');
    transitAnnounce('arrival', '3RD AVE');
  });
  await page.waitForFunction(() => starts.length === 2);
  const first = await page.evaluate(() => ({ starts, gap: TRANSIT_PA.gap, buffers: transitVoice.sources.map(s => s.buffer.numberOfChannels) }));
  assert.ok(Math.abs(first.starts[1].when - first.starts[0].when - first.starts[0].duration - first.gap) < 1e-8);
  assert.deepEqual(first.buffers, [1, 1]);
  await page.waitForFunction(() => starts.length === 4);
  const starts = await page.evaluate(() => starts);
  assert.ok(starts[2].when >= starts[1].when + starts[1].duration, 'announcements never overlap');
  assert.ok(Object.values(counts).every(count => count === 1));
  assert.equal(Object.keys(counts).length, 33);
  await page.evaluate(() => cancelTransitAnnouncements());
}));

test('late loads, missing responses and context changes cannot produce stale or dangling speech', () => fixture(async page => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  // Assets have not been requested yet: hold one half while the player leaves.
  await page.route('**/transit/3rd-ave.wav', async route => { await gate; await route.continue(); });
  await page.route('**/transit/mercer-st.wav', route => route.fulfill({ status: 404, body: '' }));
  try {
    await page.evaluate(() => { T = 1; elUp({ s: EL_STATIONS[0], tr: 0 }); transitAnnounce('next', '3RD AVE'); });
    await page.waitForFunction(() => transitLoading);
    await page.evaluate(() => elDown());
    await page.evaluate(() => {
      enterRoom('station', { st: 7, word: stations[7].name, t0: T - 10 }, [23, ST_TRACK - 2, 0]);
      transitAnnounce('arrival', 'GRAND ST');
    });
    await page.waitForFunction(() => !!transitVoice);
    await page.evaluate(() => { window.currentTransitVoice = transitVoice; });
    release();
    await page.evaluate(async () => { await Promise.all(Object.values(CLIPS)); });
    assert.ok(await page.evaluate(() => transitVoice === currentTransitVoice), 'an old decode cannot replace a new location\'s voice');
    const missing = await page.evaluate(async () => {
      elUp({ s: EL_STATIONS[0], tr: 0 }); transitAnnounce('next', 'MERCER ST');
      await Promise.resolve(); await Promise.resolve();
      return { voice: !!transitVoice, station: await clipBuffer('transit/mercer-st.wav') };
    });
    assert.deepEqual(missing, { voice: false, station: null });
  } finally { release(); }
}));

test('the shared heavier PA graph renders both station halves without clipping and respects the effects bus', () => fixture(async page => {
  const result = await page.evaluate(async () => {
    T = 1; elUp({ s: EL_STATIONS[0], tr: 0 });
    const buffers = await Promise.all(transitFiles('next', '3RD AVE').map(file => clipBuffer(file)));
    const duration = buffers[0].duration + TRANSIT_PA.gap + buffers[1].duration;
    const offline = new OfflineAudioContext(1, Math.ceil((duration + .1) * 24000), 24000);
    // Render through the exact PA graph, using the normal destination bus interface.
    const saved = [actx, sfxBus, transitBus];
    actx = offline; sfxBus = offline.destination; transitBus = null;
    const bus = transitPABus();
    [actx, sfxBus, transitBus] = saved;
    let at = 0;
    for (const buffer of buffers) {
      const source = offline.createBufferSource(); source.buffer = buffer; source.connect(bus); source.start(at);
      at += buffer.duration + TRANSIT_PA.gap;
    }
    const output = (await offline.startRendering()).getChannelData(0);
    let peak = 0, firstEnergy = 0, secondEnergy = 0;
    const stationAt = Math.ceil((buffers[0].duration + TRANSIT_PA.gap) * 24000);
    for (let i = 0; i < output.length; i++) {
      peak = Math.max(peak, Math.abs(output[i]));
      if (i < stationAt) firstEnergy += output[i] ** 2; else secondEnergy += output[i] ** 2;
    }
    settings.effects = .25; applyVolumes();
    return { peak, firstEnergy, secondEnergy, reflection: TRANSIT_PA.reflectionTime, lead: TRANSIT_PA.lead };
  });
  assert.ok(result.peak > .01 && result.peak < .8, JSON.stringify(result));
  assert.ok(result.firstEnergy > 1 && result.secondEnergy > 1, 'both the prefix and station remain audible');
  assert.ok(result.reflection < result.lead, 'the reflection ends before a subsequent utterance begins');
  await page.waitForTimeout(400);
  assert.ok(Math.abs(await page.evaluate(() => sfxBus.gain.value) - .25 ** 2 * 1.5) < .02);
}));

test('mute, zero effects/master, pause, freecam, dev time jumps and save loading cancel scheduled speech without backlog', () => fixture(async page => {
  await page.evaluate(async () => { T = 1; elUp({ s: EL_STATIONS[0], tr: 0 }); await Promise.all(Object.values(CLIPS)); });
  for (const action of ['mute', 'effects', 'master', 'pause', 'freecam', 'jump', 'save', 'location']) {
    await page.evaluate(() => {
      paused = false; freecam = null; soundOn = true; settings.effects = settings.master = .7;
      T = 1; elUp({ s: EL_STATIONS[0], tr: 0 }); transitAnnounce('next', '3RD AVE');
    });
    await page.waitForFunction(() => !!transitVoice);
    const result = await page.evaluate(action => {
      const voice = transitVoice; window.endedTransit = 0;
      for (const source of voice.sources) source.addEventListener('ended', () => endedTransit++);
      if (action === 'mute') toggleSound();
      if (action === 'effects') settings.effects = 0;
      if (action === 'master') settings.master = 0;
      if (action === 'pause') paused = true;
      if (action === 'freecam') toggleFreecam();
      if (action === 'jump') T += 100;
      if (action === 'save') { saveGame(); loadGame(); }
      if (action === 'location') { mode = 'walk'; room = null; px += 20; }
      transitSync();
      return { voice: !!transitVoice, queue: transitQueue.length, sources: voice.sources.length };
    }, action);
    assert.deepEqual(result, { voice: false, queue: 0, sources: 2 }, action);
    await page.waitForFunction(() => endedTransit === 2);
    assert.equal(await page.evaluate(() => { paused = false; freecam = null; soundOn = true; settings.effects = settings.master = .7; stepTransitAnnouncements(); return transitQueue.length; }), 0);
  }
}));

test('locked audio skips events and never replays them after unlock', () => fixture(async page => {
  const before = await page.evaluate(() => {
    T = 5; elUp({ s: EL_STATIONS[0], tr: 0 }); elBoard(); advance(5.1);
    return { voice: transitVoice, queue: transitQueue.length, context: actx };
  });
  assert.deepEqual(before, { voice: null, queue: 0, context: null });
  await page.evaluate(() => audioStart());
  await page.waitForFunction(() => actx.state === 'running');
  assert.equal(await page.evaluate(() => { stepTransitAnnouncements(); return transitQueue.length + (transitVoice ? 1 : 0); }), 0);
}, { startAudio: false }));
