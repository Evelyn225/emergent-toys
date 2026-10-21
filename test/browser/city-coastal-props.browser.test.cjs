'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); });
async function fixture(run) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      let a = 1;
      Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href);
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('the coastal night market has buildings on both sides, dry service points and reachable stalls', () => fixture(async page => {
  const result = await page.evaluate(() => {
    mode = 'walk'; paused = false; tod = 21; T = 10; env(0);
    const errors = [];
    for (const s of STALLS) {
      for (const y of [s.y + .3, s.y - 2]) if (!map[idx(s.x, y)]) errors.push([s.word, 'missing facade']);
      [px, py] = s.at;
      if (isWater(px, py) || map[idx(px, py)] || solidAt(px, py, .03) || marketSpot() !== s) errors.push([s.word, 'service point']);
      a = Math.PI / 2; pitch = 0; render(0);
      if (!marketPrompt(s).includes(s.word) && !['FORTUNES', 'GOLDFISH'].includes(s.word)) errors.push([s.word, 'prompt']);
    }
    return { count: STALLS.length, errors };
  });
  assert.equal(result.count, 5);
  assert.deepEqual(result.errors, []);
}));

test('finished coastal lantern strings reach opposing facades at cord height and buckets contain no orphan strings', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const bad = lanterns.filter(l => [-1, 1].some(sign => {
      const x = l.x + l.ax * LANTERN_SPAN * sign, y = l.y + l.ay * LANTERN_SPAN * sign;
      return map[idx(x, y)] < sagZ(sign);
    }));
    return { count: lanterns.length, bad, bucketed: lanternsB.flat().length, allPresent: lanternsB.flat().every(l => lanterns.includes(l)) };
  });
  assert.ok(result.count > 100);
  assert.deepEqual(result.bad, []);
  assert.equal(result.bucketed, result.count);
  assert.equal(result.allPresent, true);
}));

test('old bridge taxis spawn on finished roads and keep driving on roads or raised bridge decks', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const errors = cars.filter(c => !ROAD[idx(c.x, c.y)]).map(c => ['spawn', c.id, c.kind, c.x, c.y]);
    const original = cars.length, originalTaxis = cars.filter(c => c.kind === 'taxi').length;
    // Seed 1 put these three cars on the removed wrapping bridge, including two taxis.
    const recovered = cars.filter(c => [8, 312, 332].includes(c.id));
    cars.splice(0, cars.length, ...recovered); people.length = footCops.length = 0;
    mode = 'walk'; px = py = 250; evTimer = Infinity;
    let distance = 0;
    for (let n = 0; n < 1200; n++) {
      T += .1; stepTraffic(.1, T, true);
      for (const c of cars) {
        distance += c.v * .1;
        if (!ROAD[idx(c.x, c.y)]) errors.push(['drive', c.id, c.x, c.y]);
        if (errors.length > 10) break;
      }
      if (errors.length > 10) break;
    }
    return { original, originalTaxis, recovered: recovered.length, distance, errors };
  });
  assert.equal(result.original, 420);
  assert.ok(result.originalTaxis > 50);
  assert.equal(result.recovered, 3);
  assert.ok(result.distance > 50, JSON.stringify(result));
  assert.deepEqual(result.errors, []);
}));

test('box column bounds paint exactly the same cells as the general ray intersection', () => fixture(async page => {
  const result = await page.evaluate(() => {
    paused = true; mode = 'walk'; T = 10; tod = 12; env(0); render(0);
    const shade = i => { BG[i] = C(GRAY, HIT.face); set(i, String(HIT.face), C(WHITE, 12)); return true; };
    let errors = 0, painted = 0;
    for (const yaw of [0, .7, 1.5]) for (const height of [.17, 1.3, 3]) {
      dx = Math.cos(yaw); dy = Math.sin(yaw); eye = height;
      for (const spec of [[2,0,1,0,.4,.3,0,.8],[.1,.2,1,0,.7,.5,0,2],[-2,0,1,0,.3,.3,0,1],[3,1,Math.cos(.6),Math.sin(.6),1,.5,.3,2]]) {
        const b = boxAt(...spec);
        function draw(intersect) {
          ZB.fill(Infinity); ZBG.fill(20); BG.fill(NONE); CH.fill(' '); COL.fill(0); FL.fill(1);
          drawBox(b, shade, intersect);
          return [Array.from(ZB), Array.from(ZBG), Array.from(BG), CH.slice(), Array.from(COL), Array.from(FL)];
        }
        const fast = draw(rayBox), general = draw((...args) => rayBox(...args));
        if (JSON.stringify(fast) !== JSON.stringify(general)) errors++;
        painted += fast[3].filter(ch => ch !== ' ').length;
      }
    }
    return { errors, painted };
  });
  assert.equal(result.errors, 0);
  assert.ok(result.painted > 100);
}));
