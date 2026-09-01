'use strict';
// Harness for the browser suite.
//
// The node suite (test/*.cjs) loads os/ sources into a vm and proves the parts
// that are pure functions of data. It cannot see layout, paint order, or what a
// real mouse does, and that is exactly where this project's expensive defects
// have lived: a snap preview painted OVER the window it was previewing, a
// taskbar menu that covered the bar it belonged to, a resize guard that let a
// story render shrink a snapped window, a titlebar that dragged on the right
// mouse button. Every one of those passed a fully green node suite.
//
// So this harness starts the real server, drives real Chromium, and asserts on
// measured geometry and sampled pixels rather than on stubs.
//
// Deliberately NOT matched by `npm test`'s `test/*.cjs` glob: these need a
// browser binary that a contributor may not have installed, and a green unit
// run must not depend on that. `npm run test:browser` is the entry point.
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..', '..');
const PORT = Number(process.env.SLEEPOS_TEST_PORT || 3199);
const BASE = 'http://localhost:' + PORT;

function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(BASE + '/sleep-os.html', res => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => { req.destroy(); });
      function retry() {
        if (Date.now() > deadline) return reject(new Error('server did not come up on ' + BASE));
        setTimeout(poll, 150);
      }
    };
    poll();
  });
}

// One server and one browser for the whole file. Each test gets its own browser
// CONTEXT, which is what isolates IndexedDB - sleepOS persists its filesystem
// there, so a shared context would let one test's writes reach the next.
async function startHarness() {
  const server = spawn(process.execPath, ['server.cjs'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: 'ignore',
  });
  try {
    await waitForServer();
  } catch (err) {
    server.kill();
    throw err;
  }
  const browser = await chromium.launch();
  return {
    browser,
    async stop() {
      await browser.close().catch(() => {});
      server.kill();
    },
  };
}

// A booted desktop at a known size.
//
// The keypress is not a hack, it is the product's own affordance: os/bios.js
// binds `document.addEventListener('keydown', biosFinish, { once: true })` so a
// player can skip the boot text, and skipping it is what almost every real
// visitor does. Measured on a fresh context: letting the BIOS run to the end
// takes 38.6s, pressing a key takes 613ms. Without this every test in the file
// would spend most of its life watching boot text scroll, and a 30s wait would
// time out - which is exactly how this harness failed on its first run.
//
// Boot is then awaited on real conditions rather than a sleep, because neither
// the BIOS duration nor the mount's is a contract.
// `firstRun` controls whether the first-run WELCOME.README window is allowed to
// open. It defaults to OFF, and that default is load-bearing: every context here
// is fresh, so every boot is a first run, and the welcome window would be
// sitting on the desktop before any test opened a window of its own. That is
// not hypothetical - it broke the Tile test, which counts what is on screen and
// suddenly had three visible windows where it had arranged two.
//
// Suppressed by writing the flag the OS itself checks, from an init script that
// runs before any page script, rather than by closing the window afterwards:
// closing it would still let it open, take focus, and bump zTop first.
async function openDesktop(browser, { width = 1280, height = 800, firstRun = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (!firstRun) {
    await context.addInitScript(() => {
      try { localStorage.setItem('sleepOS-welcome-seen', '1'); } catch (e) {}
    });
  }
  const page = await context.newPage();
  // Collected rather than thrown: throwing from this listener escapes the test
  // that caused it and lands as an unhandled rejection somewhere else.
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err)));
  await page.goto(BASE + '/sleep-os.html');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const d = document.getElementById('desktop');
    return d && getComputedStyle(d).display !== 'none';
  }, null, { timeout: 30000 });
  // The window manager's globals are what these tests assert against, so wait
  // until they exist rather than assuming boot order.
  await page.waitForFunction(() => typeof wins === 'object' && typeof desktopBounds === 'function',
    null, { timeout: 30000 });
  return { context, page, pageErrors };
}

// Skip the BIOS and wait for a booted desktop. Letting the boot text run to the
// end takes 38.6s; the keypress is the product's own skip affordance (os/bios.js
// binds keydown to biosFinish) and takes about 600ms.
async function waitForBootedDesktop(page) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const d = document.getElementById('desktop');
    return d && getComputedStyle(d).display !== 'none';
  }, null, { timeout: 30000 });
  await page.waitForFunction(() => typeof wins === 'object' && typeof desktopBounds === 'function',
    null, { timeout: 30000 });
}

// Reload the SAME page, and therefore the same browser context, so everything
// in localStorage and IndexedDB survives. This is the only way to test anything
// that claims to persist: openDesktop's fresh context is deliberately amnesiac,
// which is the opposite property.
async function rebootDesktop(page) {
  await page.reload();
  await waitForBootedDesktop(page);
}

// Drive a factory reset and wait out the reboot it ends in.
//
// performFactoryReset is fired WITHOUT awaiting it: it finishes with
// location.replace, which destroys the execution context the promise lives in,
// so awaiting it inside the page rejects with "execution context was destroyed"
// rather than resolving. The load event of the replacement document is the
// signal to wait on instead, and it has to be subscribed to BEFORE the reset
// starts or it can fire before anyone is listening.
//
// The reset deliberately sets the force-boot key, so the machine comes back
// through the full BIOS - which is why this cannot skip waitForBootedDesktop's
// keypress and wait for the desktop directly.
async function factoryReset(page) {
  const loaded = page.waitForEvent('load', { timeout: 30000 });
  await page.evaluate(() => { void performFactoryReset(); });
  await loaded;
  await waitForBootedDesktop(page);
}

// Open a window by calling the OS's own launcher, then wait for the id to
// appear in `wins`. Returns the id so a test never hardcodes one.
async function openWindow(page, launcher, matcher) {
  const before = await page.evaluate(() => Object.keys(wins));
  await page.evaluate(l => { globalThis[l](); }, launcher);
  await page.waitForFunction(
    (b) => Object.keys(wins).some(k => !b.includes(k)),
    before, { timeout: 15000 });
  const after = await page.evaluate(() => Object.keys(wins));
  const fresh = after.filter(k => !before.includes(k));
  const id = matcher ? fresh.find(k => matcher.test(k)) : fresh[0];
  if (!id) throw new Error('no new window from ' + launcher + '; got ' + after.join(','));
  return id;
}

const rectOf = (page, id) => page.evaluate(
  w => { const r = wins[w].el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, id);

const stateOf = (page, id) => page.evaluate(
  w => ({ snap: wins[w].snap, maximized: wins[w].maximized, minimized: wins[w].minimized }), id);

const previewDisplay = (page) => page.evaluate(() => {
  const p = document.getElementById('snap-preview');
  // Absent is a meaningful state: the element is created on first use, so
  // "never created" and "created then hidden" are different facts.
  return p ? getComputedStyle(p).display : 'absent';
});

// Press the titlebar and move, leaving the button DOWN so a caller can inspect
// mid-drag state before releasing.
async function dragTitlebarTo(page, id, x, y, { button = 'left' } = {}) {
  const tb = await page.evaluate(w => wins[w].el.querySelector('.win-titlebar').getBoundingClientRect().toJSON(), id);
  await page.mouse.move(tb.x + 30, tb.y + tb.height / 2);
  await page.mouse.down({ button });
  await page.mouse.move(x, y, { steps: 10 });
}

// Whether a 6x6 patch of the page changes when `mutate` runs. Used to answer
// paint-order questions, which getBoundingClientRect and elementFromPoint
// cannot: the preview is pointer-events:none, so elementFromPoint looks
// straight through it whatever the z-index is.
async function patchChangesWhen(page, point, mutate) {
  const clip = { x: point.x, y: point.y, width: 6, height: 6 };
  const before = (await page.screenshot({ clip })).toString('base64');
  await mutate();
  const after = (await page.screenshot({ clip })).toString('base64');
  return before !== after;
}

module.exports = {
  BASE, PORT, startHarness, openDesktop, openWindow, rebootDesktop,
  waitForBootedDesktop, factoryReset,
  rectOf, stateOf, previewDisplay, dragTitlebarTo, patchChangesWhen,
};
