'use strict';
// Being known (notoriety.js, news-ui.js), in the real page: the paper and the telly carry what you did, the TV over the
// bar has it on, a passer-by who knows your face stops and stares, the barber and the thrift shop sell you a new look,
// and all of it is kept across a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_ = pathToFileURL(path.join(__dirname, '../../ascii-city.html')).href;

test('the paper, the telly and the bar TV carry the news; a passer-by knows your face; a new look helps; it is all kept', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_);
    await page.waitForFunction(() => typeof stepNewsUI === 'function' && Number.isFinite(eye));
    await page.evaluate(() => localStorage.clear());
    const r = await page.evaluate(() => {
      paused = true; mode = 'walk'; room = null; px = 41; py = 73; clearWanted(); money = 500;
      noto.level = 0; noto.log.length = 0; noto.looked = {};
      addWanted('bankjob', px, py, true); clearWanted(); dayNum++; stepNotoriety(); // (yesterday)
      const out = {};
      // the paper
      inv.length = 0; carryItem({ id: 'newspaper', uses: 0 }); held = 0; useHeldItem(); out.paper = msgText;
      // the TV over the bar, a couple of seconds after you walk in
      enterRoom('bar', { word: 'BAR', ret: [px, py, a] }, [6, 6, -Math.PI / 2]); msgT = 0;
      stepNewsUI(0.1); out.barEarly = msgText; T += 3; stepNewsUI(0.1); out.bar = msgText;
      // back outside, well known: a passer-by stops and stares
      room = null; mode = 'walk'; px = 41; py = 73; noto.level = 50; noto.scanT = 0; msgT = 0;
      const p = people[0]; Object.assign(p, { x: 41.8, y: 73, hidden: false, talk: 0, down: null, follow: false, help: null, hailing: false, knew: null });
      const rnd = Math.random; Math.random = () => 0; stepNewsUI(0.1); Math.random = rnd;
      out.stare = { said: msgText, gawk: p.gawk === YOU_SPOT };
      // the barber
      const [ok, line] = buy('haircut'); out.haircut = { ok, line, level: noto.level, money };
      // kept
      saveGame(); out.saved = { level: noto.level, stories: noto.log.length };
      return out;
    });
    assert.match(r.paper, /^Headline: Bank robbed in .+\. The bank reminds customers that deposits are insured/);
    assert.equal(r.barEarly, r.paper, 'not the moment you walk in');
    assert.match(r.bar, /^The TV over the bar: Bank robbed in /);
    assert.ok(r.stare.gawk, 'they stop and look at you');
    assert.match(r.stare.said, /a beat too long|second look|Aren't you/);
    assert.ok(r.haircut.ok && /Nobody is going to match you to a description now/.test(r.haircut.line), r.haircut.line);
    assert.equal(r.haircut.level, 25);
    assert.equal(r.haircut.money, 485);
    await page.reload();
    await page.waitForFunction(() => typeof noto !== 'undefined' && Number.isFinite(eye));
    const back = await page.evaluate(() => ({ level: noto.level, stories: noto.log.length, haircut: noto.looked.haircut === dayNum }));
    assert.deepEqual(back, { level: 25, stories: r.saved.stories, haircut: true });
    await page.evaluate(() => localStorage.clear());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
