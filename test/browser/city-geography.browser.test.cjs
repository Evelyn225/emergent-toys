'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');
const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => { browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch(); });
test.after(async () => { await browser?.close(); });
async function fixture(run) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => {
      paused = false; mode = 'walk'; room = me = null; [px,py] = citySourcePoint(41,73); T = 10; tod = 12; money = 5000;
      env(0); render(0); buy('home_studio');
    });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}
async function legacySave(page) {
  return page.evaluate(() => {
    const home = owned.homes[0], w = workshopState(home);
    home.door = buyerDoor(home); home.decor = [{ id: 'yoyo', uses: 0 }]; home.fridge = [{ id: 'slice', uses: 1 }];
    Object.assign(w, { owned: { bench: 1, processor: 1, packer: 1, fan: 0, growrack: 1 }, supplies: 9, seeds: 4, powered: true,
      upgrades: { controller: true, lamp: true }, next: 5, parts: [
        { id: 'bench', key: 1, x: 3.75, y: 11.25, a: 0 },
        { ...workshopAttachment('processor', { key: 1, x: 3.75, y: 11.25, a: 0 }), key: 2 },
        { ...workshopAttachment('packer', { key: 1, x: 3.75, y: 11.25, a: 0 }), key: 3 },
        { id: 'growrack', key: 4, x: 10, y: 11.25, a: 0, crop: { left: 25, tended: true } },
      ] });
    closet.push({ id: 'weed', uses: 12, q: 'perfect' });
    carryItem({ id: 'neon', uses: 3, q: 'fine' });
    courierRecords.best.garden = 48; drugContacts.supplierOrders = 6;
    mapWaypoint = { id: `home:${home.cell}`, name: 'Home', x: home.door[0], y: home.door[1] };
    saveGame();
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    data.v = 1; delete data.world;
    for (const h of data.homes) {
      const place=cityPlaceAtCell(h.cell);
      h.cell=place.legacyCells.find(k=>citySourceCell(k)===h.cell);
      if(h.door)h.door=cityWorldSourcePoint(...h.door);
      delete h.placeId;
    }
    data.at={x:41,y:73,a:0};
    data.waypoint.id=`home:${data.homes[0].cell}`;[data.waypoint.x,data.waypoint.y]=cityWorldSourcePoint(data.waypoint.x,data.waypoint.y);
    const text = JSON.stringify(data);
    localStorage.removeItem(SAVE_BACKUP_KEY); localStorage.setItem(SAVE_KEY, text);
    return { text, home: data.homes[0], money: data.money, closet: data.closet, inv: data.inv };
  });
}

test('a real legacy save upgrades and reloads with the original bytes backed up and workshop production intact', () => fixture(async page => {
  const original = await legacySave(page);
  // Navigation's pagehide autosave must not replace the fixture before the new page loads it.
  await page.evaluate(() => { citySaveBlocked = true; });
  await page.reload();
  const result = await page.evaluate(() => {
    saveGame();
    return { backup: localStorage.getItem(SAVE_BACKUP_KEY), data: JSON.parse(localStorage.getItem(SAVE_KEY)),
      homeId: cityHomeId(owned.homes[0]), blocked: citySaveBlocked };
  });
  assert.equal(result.backup, original.text);
  assert.equal(result.data.v, 5);
  assert.equal(result.data.world.layout, 'archipelago-v3');
  assert.equal(result.data.money, original.money);
  assert.deepEqual(result.data.closet, original.closet);
  assert.deepEqual(result.data.inv, original.inv);
  assert.deepEqual(result.data.homes[0].workshop, original.home.workshop);
  assert.deepEqual(result.data.homes[0].decor, original.home.decor);
  assert.deepEqual(result.data.homes[0].fridge, original.home.fridge);
  assert.equal(result.data.courier.records.best.garden, 48);
  assert.equal(result.data.drugContacts.supplierOrders, 6);
  assert.equal(result.data.waypoint.id, result.homeId);
  assert.equal(result.blocked, false);
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_BACKUP_KEY)), original.text);
  assert.equal(await page.evaluate(() => owned.homes.length), 1);
}));

test('unrecognized or corrupt saves survive autosave and pagehide without being overwritten', () => fixture(async page => {
  const unknown = JSON.stringify({ v: 2, world: { layout: 'unknown' }, money: 9274 });
  await page.evaluate(text => { localStorage.setItem(SAVE_KEY, text); citySaveBlocked = true; }, unknown);
  await page.reload();
  assert.equal(await page.evaluate(() => saveGame()), false);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), unknown);
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), unknown);
  await page.evaluate(() => { localStorage.setItem(SAVE_KEY, '{broken'); });
  await page.reload();
  assert.equal(await page.evaluate(() => saveGame()), false);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), '{broken');
}));

test('backup storage failure still loads progress and prevents overwrite until backup storage recovers', () => fixture(async page => {
  const original = await legacySave(page);
  await page.evaluate(() => { citySaveBlocked = true; });
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.includes('save-backup') && !window.allowBackup) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.reload();
  assert.equal(await page.evaluate(() => money), original.money);
  assert.equal(await page.evaluate(() => owned.homes.length), 1);
  assert.equal(await page.evaluate(() => saveGame()), false);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), original.text);
  await page.evaluate(() => { window.allowBackup = true; });
  assert.equal(await page.evaluate(() => saveGame()), true);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_BACKUP_KEY)), original.text);
}));

test('an offshore rental remains beside the landing after a real save/reload and appears in map search', () => fixture(async page => {
  await page.evaluate(() => {
    const b = fleet.find(b => b.deal === 'rent' && b.kind === 'speedboat');
    b.hired = true; b.x = FOOTBRIDGE.x + .4; b.y = FOOTBRIDGE.y0 + 10; b.hx = 0; b.hy = 1;
    boardBoat(b); leaveBoat(); saveGame();
  });
  const at = await page.evaluate(() => ({ x: px, y: py, boat: savedBoats()[0] }));
  await page.reload();
  const restored = await page.evaluate(() => savedBoats()[0]);
  assert.ok(Math.abs(restored.x - at.boat.x) < 1e-9 && Math.abs(restored.y - at.boat.y) < 1e-9);
  assert.deepEqual({ ...restored, x: 0, y: 0 }, { ...at.boat, x: 0, y: 0 });
  await page.evaluate(() => { paused = false; tod = 23; env(0); render(0); openBigMap(); });
  await page.locator('#bigmap input').fill('rental');
  assert.match(await page.locator('#bigmap .places').innerText(), /Your rental/);
  await page.locator('[data-map="close"]').click();
  const before = await page.evaluate(() => money);
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => mode), 'sea');
  assert.equal(await page.evaluate(() => money), before);
}));
