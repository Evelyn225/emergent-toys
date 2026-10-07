'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PAGE = pathToFileURL(path.join(__dirname, '..', '..', 'ascii-city.html')).href;

async function withHeistPage(fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof beginGrandHotelHeist === 'function' && Number.isFinite(eye));
    await page.evaluate(() => { paused = true; clearWanted(); });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('all three hotel paintings can be stolen independently, inspected with Q, and restored from saves', () => withHeistPage(async page => {
  const result = await page.evaluate(() => {
    tod = 23; grandHotelStolen = {}; inv.length = 0;
    enterRoom('grandhotel', { word: 'GRAND HOTEL', ret: [53,64.2,0] }, [10.7,2.1,0]);
    beginGrandHotelHeist();
    const frames = room.props.filter(p => p.hotelPainting);
    const fixed = frames.every(p => p.box && !p.art && p.box.hw < .05 && p.box.y - p.box.hw >= 1);
    const ids = [], deadlines = [], messages = [];
    for (const p of HOTEL_PAINTINGS) {
      px = p.x; py = p.y + 1.4;
      if (p.id === 'hotelharbour') crimeKey('KeyG'); else interact();
      game.onDone(true); game = null;
      deadlines.push(hotelAlarm.deadline);
      ids.push(heldItem().id);
      useHeldItem(); messages.push(msgText);
      env(0); render(0); T += 2;
    }
    const empty = room.props.filter(p => p.hotelPainting && p.stolen).length;
    leaveRoom(); const lobbyTimer = !!hotelAlarm;
    leaveRoom(); T += 60; stepGrandHotel();
    const quiet = wanted.stars === 0 && hotelAlarm === null;
    saveGame(); grandHotelStolen = {}; inv.length = 0; loadGame();
    const restored = HOTEL_PAINTINGS.every(p => grandHotelStolen[p.id] && inv.some(it => it.id === p.id));
    const save = JSON.parse(localStorage.getItem(SAVE_KEY)); save.hotelStolen = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save)); loadGame();
    const legacy = HOTEL_PAINTINGS.map(p => !!grandHotelStolen[p.id]);
    const remaining = makeRoom('grandhotelheist',{burgled:true}).props.filter(p => p.hotelPainting && !p.stolen).length;
    return { fixed, ids, deadlines, messages, empty, lobbyTimer, quiet, restored, legacy, remaining };
  });
  assert.equal(result.fixed,true);
  assert.deepEqual(result.ids,['hotelmasterpiece','hotelharbour','hotelstilllife']);
  assert.equal(new Set(result.deadlines).size,1,'additional paintings never extend the escape deadline');
  for (let n=0;n<3;n++) assert.match(result.messages[n],[/Duke of Brie/,/Harbour at First Light/,/Midnight Supper/][n]);
  assert.equal(result.empty,3);
  assert.equal(result.lobbyTimer,true,'returning to the lobby is still inside the hotel');
  assert.equal(result.quiet,true);
  assert.equal(result.restored,true);
  assert.deepEqual(result.legacy,[true,false,false]);
  assert.equal(result.remaining,2);
  await page.evaluate(() => {
    clearInventory(); carryItem({id:'hotelmasterpiece',uses:0}); msgText = ''; paused = false;
  });
  await page.keyboard.press('KeyQ');
  await page.evaluate(() => paused = true);
  assert.match(await page.evaluate(() => msgText),/Duke of Brie/);
}));

test('hotel alarms require being inside at the deadline, and leaving after an alarm does not clear the pursuit', () => withHeistPage(async page => {
  const result = await page.evaluate(() => {
    const cases = [];
    for (const scenario of ['gallery','lobby','suite','early exit','late exit','other building']) {
      clearWanted(); hotelAlarm = null; grandHotelStolen = {}; tod = 23;
      enterRoom('grandhotel',{word:'GRAND HOTEL',ret:[53,64.2,0]},[10.7,2.1,0]);
      beginGrandHotelHeist(); armHotelAlarm(); const deadline = hotelAlarm.deadline;
      if (scenario !== 'gallery') leaveRoom();
      if (scenario === 'suite') enterRoom('hotelroom',{lobby:{...room,grandHotel:true},suite:true},[4.5,5.3,0]);
      if (scenario === 'early exit') { T = deadline - .01; leaveRoom(); }
      if (scenario === 'other building') enterRoom('store',{word:'BODEGA',ret:[100,100,0]},[4,4,0]);
      T = deadline + .01;
      if (scenario === 'late exit') leaveRoom(); else stepGrandHotel();
      cases.push({scenario,stars:wanted.stars,pending:!!hotelAlarm});
    }
    return cases;
  });
  assert.deepEqual(result,[
    {scenario:'gallery',stars:3,pending:false},
    {scenario:'lobby',stars:3,pending:false},
    {scenario:'suite',stars:3,pending:false},
    {scenario:'early exit',stars:0,pending:false},
    {scenario:'late exit',stars:3,pending:false},
    {scenario:'other building',stars:0,pending:false},
  ]);
}));

test('a witnessed museum break-in gives officers time to enter instead of arresting at the spawn point', () => withHeistPage(async page => {
  const result = await page.evaluate(() => {
    tod = 23; mode = 'walk'; room = null;
    px = MUSEUM.bx * 8 + 4.5; py = MUSEUM.by * 8 + 1.7; a = Math.PI / 2;
    lookHit = {d:.2,mx:MUSEUM.bx*8+4,my:MUSEUM.by*8+2};
    const cop = footCops[0]; cop.x = px; cop.y = py; cop.returnCar = null;
    pickLock(MUSEUM.sh); game.onDone(true); game = null;
    const kind = room.kind, entry = [px,py];
    const first = stepCrime(1/60), initialCops = roomCops.length;
    T += ROOM_ENTRY_DELAY / 2; const before = stepCrime(1/60);
    px = entry[0]; py = entry[1]; T += ROOM_ENTRY_DELAY;
    for (let n=0;n<60&&!wanted.busted;n++) { T += 1/60; stepCrime(1/60); }
    return {kind,first,initialCops,before,arrived:roomCops.length>0,caught:wanted.busted};
  });
  assert.equal(result.kind,'museum');
  assert.notEqual(result.first,'busted');
  assert.equal(result.initialCops,0);
  assert.notEqual(result.before,'busted');
  assert.equal(result.arrived,true);
  assert.equal(result.caught,true,'waiting at the doorway still lets pursuing officers catch you');
}));

test('Grand Hotel: suite, patrols, distraction, theft, quiet escape and save', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(PAGE);
    await page.waitForTimeout(300);
    await page.evaluate(() => { paused = true; });

    assert.deepEqual(await page.evaluate(() => {
      enterRoom('grandhotel', { word: 'GRAND HOTEL', neon: YEL, cell: [53, 63], ret: [53, 64.2, -Math.PI / 2] }, [6.5, 3.4, -Math.PI / 2]);
      money = 1000; tod = 14; interact();
      const early = [money, !!sleep];
      tod = 21; interact();
      stepSleep(1.6);
      const booked = [money, room.kind, room.suite, room.W, room.H, tod];
      sleep = null; fade = 0; leaveRoom();
      return [early, booked, room.kind, room.ret];
    }), [[1000, false], [750, 'hotelroom', true, 9, 7, 7], 'grandhotel', [53, 64.2, -Math.PI / 2]]);

    assert.deepEqual(await page.evaluate(() => {
      px = HOTEL_HEIST_DOOR[0]; py = 2.1; tod = 22; interact();
      const closed = room.kind;
      tod = 23; interact();
      for (const p of room.props) if (p.tick) p.tick(p);
      const cover = lineClear(8, 4, 10, 4);
      px = 12; py = 13.8; interact();
      const guards = room.props.filter(p => p.guard);
      guards.forEach(g => g.tick(g));
      const before = guards.map(g => [g.x, g.y]);
      T += 5; guards.forEach(g => g.tick(g));
      const still = guards.every((g, i) => Math.hypot(g.x - before[i][0], g.y - before[i][1]) < 0.001);
      const firstDeadline = room.distractedUntil;
      interact();
      return [closed, room.kind, cover, guards.length, still, room.distractedUntil === firstDeadline, room.trolleyUsed, crimePrompt().includes('cheese')];
    }), ['grandhotel', 'grandhotelheist', false, 2, true, true, true, true]);

    assert.deepEqual(await page.evaluate(() => {
      px = HOTEL_PAINTING[0]; py = HOTEL_PAINTING[1]; interact();
      const started = !!game && game.onDone !== undefined;
      game.onDone(false); game = null;
      const deadline = hotelAlarm.deadline;
      T += 2; interact(); game.onDone(true); game = null;
      const unchanged = hotelAlarm.deadline === deadline;
      const carried = inv.some(it => it.id === 'hotelmasterpiece');
      leaveRoom(); const lobby = room.kind;
      leaveRoom(); const outside = mode;
      T = deadline + 0.1; stepGrandHotel();
      return [started, unchanged, carried, grandHotelStolen.hotelmasterpiece, lobby, outside, wanted.stars > 0, hotelAlarm === null];
    }), [true, true, true, true, 'grandhotel', 'walk', false, true]);

    assert.deepEqual(await page.evaluate(() => {
      saveGame();
      grandHotelStolen = {}; inv.length = 0; loadGame();
      const recovered = inv.some(it => it.id === 'hotelmasterpiece');
      const gallery = makeRoom('grandhotelheist', { burgled: true });
      return [grandHotelStolen.hotelmasterpiece, recovered, gallery.props.filter(p => p.hotelPainting && !p.stolen).length];
    }), [true, true, 2]);

    // Exercise the real room wall adapter while police search, rather than a headless fixture.
    await page.evaluate(() => {
      enterRoom('grandhotel', { word: 'GRAND HOTEL', ret: [53, 64.2, 0] }, [7, 7.2, -Math.PI / 2]);
      addWanted('heist', 53, 64.2, true);
      wanted.lastX = 53; wanted.lastY = 64.2; wanted.seen = true;
      stepCrime(0.05); T += ROOM_ENTRY_DELAY + .1; stepCrime(.05); env(0); render(0);
    });
    assert.ok(await page.evaluate(() => roomCops.length > 0));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
