const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
let browser, app, database, base;
let rows = {}, unavailable = false, readDelay = 0, writeDelay = 0;
let readStarted = null, writeStarted = null;

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

before(async () => {
  database = http.createServer(async (req, res) => {
    assert.equal(req.headers.apikey, 'sb_secret_browser_fixture');
    assert.ok(req.url.startsWith('/rest/v1/ottawa_trip_fields?'));
    if (unavailable) { res.writeHead(503).end(); return; }
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      if (writeStarted) writeStarted();
      if (writeDelay) await new Promise(resolve => setTimeout(resolve, writeDelay));
      for (const row of JSON.parse(body)) rows[row.key] = row.value;
      res.writeHead(204).end();
    } else {
      const snapshot = JSON.stringify(Object.entries(rows).map(([key, value]) => ({ key, value })));
      if (readStarted) readStarted();
      if (readDelay) await new Promise(resolve => setTimeout(resolve, readDelay));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(snapshot);
    }
  });
  const dbPort = await listen(database);
  const probe = http.createServer();
  const appPort = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${appPort}`;
  app = spawn(process.execPath, ['server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort), SUPABASE_URL: `http://127.0.0.1:${dbPort}`, SUPABASE_SECRET_KEY: 'sb_secret_browser_fixture' },
    stdio: 'ignore'
  });
  const deadline = Date.now() + 15000;
  while (true) {
    try {
      if ((await fetch(base + '/ottawa')).ok) break;
    } catch {}
    if (Date.now() > deadline) throw new Error('Ottawa local server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
});

after(async () => {
  if (browser) await browser.close();
  if (app && app.exitCode === null && app.signalCode === null) {
    const stopped = new Promise(resolve => app.once('exit', resolve));
    app.kill();
    await stopped;
  }
  if (database) {
    database.closeAllConnections();
    await new Promise(resolve => database.close(resolve));
  }
});

async function openPlanner(t, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  return page;
}

async function waitForSaved(page, predicate) {
  await page.waitForFunction(() => document.querySelector('#syncstatus').textContent === 'Synced with both of you');
  assert.ok(predicate(rows), 'saved database fields do not match the edit');
}

async function refreshShared(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
}

test('Vercel routes select Ottawa before the generic HTML route and retain the homepage', async () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  for (const url of ['/ottawa', '/ottawa/']) {
    const route = config.routes.find(route => new RegExp(route.src).test(url));
    assert.equal(route.dest, '/ottawa-trip.html');
    assert.equal(await (await fetch(base + url)).text(), fs.readFileSync(path.join(root, 'ottawa-trip.html'), 'utf8'));
  }
  assert.equal(await (await fetch(base + '/')).text(), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  assert.equal((await fetch(base + '/api/ottawa-state')).headers.get('content-type').split(';')[0], 'application/json');
});

test('notes, budget, bookings and plan edits persist and sync to a second browser', async t => {
  rows = {}; unavailable = false; readDelay = 0; writeDelay = 0;
  const first = await openPlanner(t);
  const second = await openPlanner(t);
  await first.goto(base + '/ottawa');
  await second.goto(base + '/ottawa/');
  await waitForSaved(first, () => true);
  assert.equal(await first.locator('[data-save=cost3]').inputValue(), '200');
  assert.equal(await first.locator('#total').textContent(), '$1,562.52');
  await first.locator('#notes').fill('Dinner at 7; bring raincoats');
  await first.locator('[data-save=cost3]').fill('215.50');
  await first.locator('[data-save=hotel]').check();
  await first.locator('#dayselect').selectOption('1');
  await first.locator('#compactday [data-move="1-4"]').selectOption('3');
  await first.locator('#compactday [data-complete="1-0"]').click();
  await first.locator('#rain').click();
  await waitForSaved(first, fields => fields.notes === 'Dinner at 7; bring raincoats'
    && fields.cost3 === '215.50' && fields.hotel === true
    && fields['plan-1-4'].day === 3 && fields['plan-1-0'].done === true
    && fields['plan-2-1'].skip && fields['plan-2-2'].skip);
  await refreshShared(second);
  await second.waitForFunction(() => document.querySelector('#notes').value === 'Dinner at 7; bring raincoats');
  assert.equal(await second.locator('[data-save=cost3]').inputValue(), '215.50');
  assert.ok(await second.locator('[data-save=hotel]').isChecked());
  await second.locator('#dayselect').selectOption('3');
  assert.match(await second.locator('#compactday').textContent(), /Ottawa Art Gallery/);
  await first.reload();
  assert.equal(await first.locator('#notes').inputValue(), 'Dinner at 7; bring raincoats');
  assert.equal(await first.locator('#dayselect').inputValue(), '2');
  assert.match(await first.locator('#locallinks').textContent(), /bunker only/);
  first.once('dialog', dialog => dialog.accept());
  await first.locator('#resetplan').click();
  await waitForSaved(first, fields => Object.entries(fields).filter(([key]) => key.startsWith('plan-')).every(([, value]) => Object.keys(value).length === 0));
  assert.equal(await first.locator('#notes').inputValue(), 'Dinner at 7; bring raincoats');
  assert.equal(await first.locator('[data-save=cost3]').inputValue(), '215.50');
});

test('offline edits survive reload, then retry without overwriting unrelated shared fields', async t => {
  rows = { notes: 'Remote note', dinner: true }; unavailable = true;
  const page = await openPlanner(t);
  await page.goto(base + '/ottawa');
  await page.locator('#notes').fill('Saved offline');
  await page.locator('[data-save=cost3]').fill('230');
  await page.waitForFunction(() => document.querySelector('#syncstatus').textContent.includes('sync unavailable'));
  await page.reload();
  assert.equal(await page.locator('#notes').inputValue(), 'Saved offline');
  assert.equal(await page.locator('[data-save=cost3]').inputValue(), '230');
  unavailable = false;
  await refreshShared(page);
  await waitForSaved(page, fields => fields.notes === 'Saved offline' && fields.cost3 === '230' && fields.dinner === true);
  await refreshShared(page);
  await page.waitForFunction(() => document.querySelector('[data-save=dinner]').checked);
});

test('a delayed read cannot revert a newer local edit', async t => {
  rows = { notes: 'Old snapshot' }; unavailable = false; readDelay = 1200;
  const page = await openPlanner(t);
  const started = new Promise(resolve => { readStarted = resolve; });
  await page.goto(base + '/ottawa');
  await started;
  readStarted = null;
  await page.locator('#notes').fill('New local edit');
  await page.locator('#notes').blur();
  await waitForSaved(page, fields => fields.notes === 'New local edit');
  assert.equal(await page.locator('#notes').inputValue(), 'New local edit');
  readDelay = 0;
  await refreshShared(page);
  await waitForSaved(page, fields => fields.notes === 'New local edit');
});

test('editing during an in-flight write keeps the newer value queued', async t => {
  rows = {}; readDelay = 0; writeDelay = 1200;
  const page = await openPlanner(t);
  await page.goto(base + '/ottawa');
  await waitForSaved(page, () => true);
  const started = new Promise(resolve => { writeStarted = resolve; });
  await page.locator('#notes').fill('First edit');
  await started;
  writeStarted = null;
  await page.locator('#notes').fill('Second edit');
  await waitForSaved(page, fields => fields.notes === 'Second edit');
  assert.equal(await page.evaluate(() => localStorage.getItem('ottawa2026-pending')), '{}');
  writeDelay = 0;
});

test('existing browser fields can be shared, and Thursday mine navigation uses driving', async t => {
  rows = {}; unavailable = false;
  const page = await openPlanner(t, { viewport: { width: 390, height: 844 } });
  await page.context().addInitScript(() => {
    localStorage.setItem('ottawa2026-notes', 'Old browser note');
    localStorage.setItem('ottawa2026-cost3', '130');
    localStorage.setItem('ottawa2026-hotel', 'true');
    localStorage.setItem('ottawa2026-plan', JSON.stringify({ '3-0': { done: true }, '3-1': { done: true }, '3-2': { done: true }, '3-3': { done: true } }));
  });
  await page.goto(base + '/ottawa');
  await waitForSaved(page, () => true);
  assert.equal(await page.locator('[data-save=cost3]').inputValue(), '130');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importlocal').click();
  await waitForSaved(page, fields => fields.notes === 'Old browser note' && fields.cost3 === '130' && fields.hotel);
  assert.equal(rows.cost0, undefined, 'import must not publish default values');
  await page.locator('#dayselect').selectOption('3');
  const navigation = new URL(await page.locator('#nextstop a').getAttribute('href'));
  assert.equal(navigation.searchParams.get('destination'), 'Marmoraton Mine Marmora');
  assert.equal(navigation.searchParams.get('travelmode'), 'driving');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.match(await page.locator('#foodcards').textContent(), /Little Victories/);
  assert.match(await page.locator('#daycards').textContent(), /Ottawa Art Gallery \(optional\)/);
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex,nofollow');
  await page.locator('#today').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(root, 'tmp/ottawa-mobile.png') });
});
