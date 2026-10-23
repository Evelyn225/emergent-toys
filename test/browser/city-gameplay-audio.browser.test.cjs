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
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch({ args: process.env.CITY_TEST_BROWSER === 'firefox' ? [] : ['--autoplay-policy=no-user-gesture-required'] });
});
test.after(async () => { await browser?.close(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); });
async function fixture(run, setup) {
  const page = await browser.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  const wait = (fn, arg) => page.waitForFunction(fn, arg, { polling: 25 });
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.route('https://**', route => route.abort());
    if (setup) await setup(page);
    await page.goto(origin + '/ascii-city.html');
    await page.evaluate(() => {
      paused = false; clearWanted(); room = null; mode = 'walk';
      cars.length = people.length = footCops.length = 0; aircraft.forEach(c => { c.rotor = 0; });
      env(0); audioStart();
    });
    await wait(() => actx.state === 'running');
    await run(page, wait);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('actual shooting/reloading use the recordings once, retain action timing and spatialize police shots', () => fixture(async (page, wait) => {
  await wait(() => Object.keys(gameplayBuffers).length === 4);
  const result = await page.evaluate(() => {
    clearInventory(); carryItem({ id: 'revolver', uses: 2 }); carryItem({ id: 'ammo', uses: 12 }); held = 0;
    a = 0; eye = .17; hor = rows >> 1; gun.cool = gun.reload = 0;
    const before = heldGun().uses; pullTrigger();
    const shot = [...gameplayShots][0];
    const fired = { rounds: heldGun().uses, before, voices: gameplayShots.size, buffer: shot.source.buffer === gameplayBuffers.gunshot };
    // Repeated rendering/UI observation doesn't replay the player's event.
    for (let i = 0; i < 8; i++) stepGunUI();
    const repeated = gameplayShots.size;
    reloadKey(); const reload = [...gameplayShots].find(v => v.source.buffer === gameplayBuffers.reload);
    const reloading = { seconds: gun.reload, duration: reload.source.buffer.duration, voices: gameplayShots.size };
    gunBang(actx.currentTime, .5, -.7, 'far');
    const far = [...gameplayShots].at(-1);
    const spatial = { pan: far.nodes[3].pan.value, cutoff: far.nodes[1].frequency.value, gain: far.gain.gain.value };
    for (let i = 0; i < 33; i++) stepGun(.05);
    tickGameplayAudio();
    return { fired, repeated, reloading, spatial, loaded: heldGun().uses, reloadVoices: [...gameplayShots].filter(v => v.source.buffer === gameplayBuffers.reload).length };
  });
  assert.deepEqual(result.fired, { rounds: 1, before: 2, voices: 1, buffer: true });
  assert.equal(result.repeated, 1); assert.equal(result.reloading.voices, 2);
  assert.equal(result.reloading.seconds, 1.6); assert.ok(Math.abs(result.reloading.duration - 1.6) < 1 / 24000);
  assert.ok(result.spatial.pan < -.69); assert.equal(result.spatial.cutoff, 1100); assert.ok(Math.abs(result.spatial.gain - .6) < 1e-6);
  assert.equal(result.loaded, 6); assert.equal(result.reloadVoices, 0);
}));

test('cooking starts one heat-driven loop, cools/finishes/aborts cleanly and does not stack sizzle events', () => fixture(async (page, wait) => {
  await wait(() => !!gameplayBuffers.sizzle);
  const hot = await page.evaluate(() => {
    startGame('cook', 'cook', '', { recipe: 'panfish' });
    tickGameplayAudio(); const cold = gameplayLoops.size;
    for (let i = 0; i < 35; i++) { K.Space = 1; stepGame(.025); tickGameplayAudio(); }
    const first = gameplayLoops.get(game.g);
    for (let i = 0; i < 30; i++) { tickGameplayAudio(); sfxCook('sizzle'); }
    window.firstSizzleVoice = first;
    K.Space = 0;
    return { cold, heat: game.g.state().heat, voices: gameplayLoops.size, same: first === gameplayLoops.get(game.g), loop: first.source.loop, buffer: first.source.buffer === gameplayBuffers.sizzle };
  });
  assert.equal(hot.cold, 0); assert.ok(hot.heat > .35);
  assert.deepEqual({ voices: hot.voices, same: hot.same, loop: hot.loop, buffer: hot.buffer }, { voices: 1, same: true, loop: true, buffer: true });
  const cooled = await page.evaluate(() => {
    for (let i = 0; i < 40; i++) { stepGame(.025); tickGameplayAudio(); }
    const cool = gameplayLoops.size;
    for (let i = 0; i < 40; i++) { K.Space = 1; stepGame(.025); tickGameplayAudio(); }
    const reheated = gameplayLoops.size;
    gameKey({ code: 'Escape' }); tickGameplayAudio();
    return { cool, reheated, aborted: !game && gameplayLoops.size === 0 };
  });
  assert.deepEqual(cooled, { cool: 0, reheated: 1, aborted: true });
  assert.equal(await page.evaluate(() => {
    startGame('cook', 'cook', '', { recipe: 'panfish' });
    for (let i = 0; i < 40; i++) game.g.step(.025, { act: 1 });
    tickGameplayAudio(); game.g.over = true; tickGameplayAudio(); return gameplayLoops.size;
  }), 0);
}));

test('police and pilot share the rotor buffer with distance, panning, muffling and spin-up/down', () => fixture(async (page, wait) => {
  await wait(() => !!gameplayBuffers.rotor);
  await page.evaluate(() => {
    mode = 'walk'; a = 0; heli = { x: px, y: py + 3, z: terrainHeight(px, py) + 3 };
    window.testHelicopter = addAircraft('heli', px + 4, py - 3, 0, { rotor: .5, z: terrainHeight(px, py), state: 'abandoned' });
    tickGameplayAudio();
  });
  await page.waitForTimeout(400);
  const near = await page.evaluate(() => ({ size: gameplayLoops.size, voices: [...gameplayLoops.values()].map(v => ({
    buffer: v.source.buffer === gameplayBuffers.rotor, loop: v.source.loop, gain: v.gain.gain.value, pan: v.panner.pan.value, rate: v.source.playbackRate.value
  })) }));
  assert.equal(near.size, 2); assert.ok(near.voices.every(v => v.buffer && v.loop));
  assert.ok(near.voices[0].pan < 0 && near.voices[1].pan > 0);
  assert.ok(near.voices[0].rate < near.voices[1].rate);
  await page.evaluate(() => {
    const ret = [px, py, a]; enterRoom('bar', { ret, word: 'BAR' }, [2, 2, 0]); tickGameplayAudio();
  });
  await wait(() => [...gameplayLoops.values()].every(v => v.lp.frequency.value < 900));
  const inside = await page.evaluate(() => [...gameplayLoops.values()].map(v => ({ gain: v.gain.gain.value, cutoff: v.lp.frequency.value })));
  assert.equal(inside.length, 2, 'indoor listener uses the actual outdoor doorway');
  inside.forEach((voice, i) => { assert.ok(voice.cutoff < 900); assert.ok(voice.gain < near.voices[i].gain * .3); });
  await page.evaluate(() => leaveRoom());
  // Move police away, board and spool the actual player helicopter.
  const aboard = await page.evaluate(() => {
    heli = null;
    Object.assign(testHelicopter, { x: HELIPADS[0].x, y: HELIPADS[0].y, z: builtHeight(HELIPADS[0].x, HELIPADS[0].y, 0), ground: true });
    testHelicopter.owned = true; enterAircraft(testHelicopter);
    for (let i = 0; i < 180; i++) heliStep(pilot, PLANE_TYPES.heli, { turn: 0, throttle: 0, lift: 0 }, 1 / 60, []);
    tickGameplayAudio(); audioTick(.016);
    return { size: gameplayLoops.size, rate: gameplayLoops.get(pilot).source.playbackRate.value, spin: pilot.rotor, engineTarget: synth.engine.gain.value };
  });
  assert.equal(aboard.size, 1); assert.ok(aboard.spin > .99);
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => ({ rate: gameplayLoops.get(pilot).source.playbackRate.value, pan: gameplayLoops.get(pilot).panner.pan.value, engine: synth.engine.gain.value }));
  assert.ok(running.rate > .98); assert.ok(Math.abs(running.pan) < .02); assert.ok(running.engine < .01);
  const down = await page.evaluate(() => {
    leaveAircraft(); tickGameplayAudio();
    const parkedLoops = gameplayLoops.size;
    testHelicopter.state = 'abandoned';
    for (let i = 0; i < 250; i++) heliStep(testHelicopter, PLANE_TYPES.heli, { dead: true, turn: 0, throttle: 0, lift: 0 }, 1 / 60, []);
    tickGameplayAudio(); return { spin: testHelicopter.rotor, size: gameplayLoops.size, parkedLoops };
  });
  assert.deepEqual(down, { spin: 0, size: 0, parkedLoops: 0 });
}));

test('recordings fetch/decode once and canceled states cannot start loops after delayed loads', () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const counts = {};
  return fixture(async (page, wait) => {
    try {
      await page.evaluate(() => {
        startGame('cook', 'cook', '', { recipe: 'panfish' });
        for (let i = 0; i < 40; i++) game.g.step(.025, { act: 1 });
        tickGameplayAudio(); game = null; tickGameplayAudio();
        preloadGameplayAudio(); preloadGameplayAudio();
      });
      assert.equal(await page.evaluate(() => gameplayLoops.size), 0);
      release(); await wait(() => Object.keys(gameplayBuffers).length === 4);
      assert.equal(await page.evaluate(() => { tickGameplayAudio(); return gameplayLoops.size; }), 0);
      assert.deepEqual(Object.values(counts), [1, 1, 1, 1]);
    } finally { release(); }
  }, async page => {
    page.on('request', req => { if (/\/(gunshot|revolver-reload|cooking-sizzle|helicopter-rotor)\.wav$/.test(req.url())) counts[req.url()] = (counts[req.url()] || 0) + 1; });
    await page.route('**/cooking-sizzle.wav', async route => { await gate; await route.continue(); });
  });
});

test('pause, mute, freecam, zero volume, save load and location changes clean up loops/one-shots', () => fixture(async (page, wait) => {
  await wait(() => Object.keys(gameplayBuffers).length === 4);
  for (const action of ['pause', 'mute', 'freecam', 'volume', 'save', 'location']) {
    const result = await page.evaluate(action => {
      paused = false; soundOn = true; settings.effects = .7; freecam = null; mode = 'walk'; room = null;
      heli = { x: px, y: py + 2, z: terrainHeight(px, py) + 3 };
      startGame('cook', 'cook', '', { recipe: 'panfish' }); for (let i = 0; i < 40; i++) game.g.step(.025, { act: 1 });
      tickGameplayAudio(); gunBang(actx.currentTime, 1);
      const before = { loops: gameplayLoops.size, shots: gameplayShots.size };
      if (action === 'pause') { paused = true; hushSirens(); }
      if (action === 'mute') toggleSound();
      if (action === 'freecam') { freecam = {}; audioTick(0); }
      if (action === 'volume') { settings.effects = 0; tickGameplayAudio(); }
      if (action === 'save') loadGame();
      if (action === 'location') { game = null; heli = null; enterRoom('station', { st: 0, t0: T }, [23, ST_TRACK - 2, 0]); tickGameplayAudio(); }
      return { before, loops: gameplayLoops.size, shots: gameplayShots.size };
    }, action);
    assert.deepEqual(result, { before: { loops: 2, shots: 1 }, loops: 0, shots: 0 }, action);
  }
}));

test('decoded loop output repeats sample-exactly across multiple wraps', () => fixture(async (page, wait) => {
  await wait(() => !!gameplayBuffers.rotor && !!gameplayBuffers.sizzle);
  const result = await page.evaluate(async () => {
    const checks = [];
    for (const key of ['rotor', 'sizzle']) {
      const buffer = gameplayBuffers[key], context = new OfflineAudioContext(1, buffer.length * 2 + 100, buffer.sampleRate);
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(context.destination); source.start();
      const output = (await context.startRendering()).getChannelData(0), expected = buffer.getChannelData(0);
      let error = 0;
      for (let i = 0; i < output.length; i++) error = Math.max(error, Math.abs(output[i] - expected[i % expected.length]));
      checks.push({ key, error });
    }
    return checks;
  });
  assert.ok(result.every(r => r.error < 1e-6), JSON.stringify(result));
}));

test('indoor sirens use the actual outdoor location instead of the room furniture coordinates', () => fixture(async page => {
  const result=await page.evaluate(()=>{
    const c={kind:'amb',state:'out',returning:false,x:12,y:18,ex:12,ey:18,hx:1,hy:0,v:0};cars.push(c);
    enterRoom('islandshelter',{ret:[626,195,0]},[12,18,0]);
    tickSirens(true);const mainland=sirens.size;
    Object.assign(c,{x:628,y:195,ex:628,ey:195});tickSirens(true);const nearby=sirens.size;
    px=5;py=4;tickSirens(true);const movedInside=sirens.size;
    const distance=worldSoundProfile(628,195,0).distance;
    room.ret=[53,64.2,0];tickSirens(true);const anotherBuilding=sirens.size;
    return {mainland,nearby,movedInside,distance,anotherBuilding};
  });
  assert.deepEqual([result.mainland,result.nearby,result.movedInside,result.anotherBuilding],[0,1,1,0]);
  assert.ok(result.distance>=2&&result.distance<3);
}));

test('a record player and a rooftop serenade pan toward their source; your own boombox stays centred', () => fixture(async (page, wait) => {
  const pans = () => page.evaluate(() => Object.fromEntries(['bossa', 'coffee'].map(k => [k, beds[k].pan.pan.value])));
  await page.evaluate(() => { homeRecordAudio = () => ({ song: 'coffee', gain: 1, pan: -.6 }); audioTick(.016); });
  await wait(() => beds.coffee.pan.pan.value < -.55);
  const record = await pans();
  await page.evaluate(() => {
    homeRecordAudio = () => null; px = COURIER_NICO.x; py = COURIER_NICO.y - 1; a = 0;
    courierEncore = true; COURIER_NICO.dead = COURIER_NICO.hidden = false; audioTick(.016);
  });
  await wait(() => Math.abs(beds.bossa.pan.pan.value) > .8 && Math.abs(beds.coffee.pan.pan.value) < .05);
  const serenade = await pans();
  await page.evaluate(() => { fx.boombox = true; fx.song = 'bossa'; audioTick(.016); });
  await wait(() => Math.abs(beds.bossa.pan.pan.value) < .05);
  assert.ok(record.coffee < -.55 && Math.abs(record.bossa) < .05, JSON.stringify(record));
  assert.ok(serenade.bossa > .8, 'Nico is to the right when facing east with him to the south: ' + JSON.stringify(serenade));
}));

test('a laundromat sounds of its washers, and your load audibly finishes once', () => fixture(async (page, wait) => {
  await page.evaluate(() => {
    money = Math.max(money, 50); wash = null;
    enterRoom('laundry', { word: 'LAUNDRY', cell: [40, 40], ret: [40.5, 41.5, 0] }, [3, 1.5, -Math.PI / 2]);
    audioTick(.016);
  });
  await wait(() => synth.washers.gain.value > .1);
  await page.keyboard.press('e');
  const result = await page.evaluate(() => {
    const started = !!wash, real = sfxWasherDone; let clunks = 0;
    sfxWasherDone = () => { clunks++; real(); };
    T = wash.done + .1; stepLaundry(); stepLaundry();
    sfxWasherDone = real; leaveRoom(); audioTick(.016);
    return { started, clunks };
  });
  assert.deepEqual(result, { started: true, clunks: 1 });
  await wait(() => synth.washers.gain.value < .01);
}));

test('explosions are heard from where they happen: delayed, dulled and panned outdoors, silent from another island indoors', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const heard = [], real = playClip;
    playClip = (name, gain, when, spatial) => heard.push({ name, gain, delay: when - actx.currentTime, cutoff: spatial?.cutoff, pan: spatial?.pan });
    const blast = (x, y) => { heard.length = 0; carBang({ kind: 'sedan', x, y }); return heard[0] || null; };
    try {
      mode = 'walk'; room = null; px = 300; py = 300; a = 0; eye = terrainHeight(px, py) + .17;
      const near = blast(301, 300.6), far = blast(330, 300);
      enterRoom('islandshelter', { ret: [626, 195, 0] }, [12, 18, 0]);
      const otherIsland = blast(12, 18), besideShelter = blast(627, 195);
      return { near, far, otherIsland, besideShelter };
    } finally { playClip = real; }
  });
  const { near, far, otherIsland, besideShelter } = result;
  assert.equal(near.name, 'crash');
  assert.ok(near.gain > .9 && near.cutoff > 8000 && near.pan > .4, JSON.stringify(near));
  assert.ok(far.gain < near.gain * .25 && far.cutoff < near.cutoff / 3 && Math.abs(far.delay - 30 / 34) < .02, JSON.stringify(far));
  assert.equal(otherIsland, null, 'a mainland blast at the room furniture coordinates is out of earshot');
  assert.ok(besideShelter && besideShelter.gain < .15 && besideShelter.cutoff <= 900, JSON.stringify(besideShelter));
}));
