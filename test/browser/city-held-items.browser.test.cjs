'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');

const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => {
  browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch();
});
test.after(async () => { await browser?.close(); });
async function withItems(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => {
      paused = true; T = 10; mode = 'walk'; room = me = null; env(0); render(0);
      rain = 0; heldUse = null; for (const key in fx) fx[key] = 0;
    });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('all held pictures use hand culling and fit portrait, landscape and desktop screens throughout a gesture', () => withItems(async page => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 720], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(() => {
      resize();
      const text = g.fillText, hand = drawHand, clip = g.clip;
      let inHand = false, clips = 0, bounds = null;
      g.clip = function (...args) { clips++; return clip.apply(this, args); };
      drawHand = function (...args) { inHand = true; try { return hand(...args); } finally { inHand = false; } };
      g.fillText = function (str, x, y, ...args) {
        if (!inHand && str.trim() && bounds) {
          const m = g.getTransform(), metrics = g.measureText(str);
          for (const px of [x, x + metrics.width]) for (const py of [y, y + parseFloat(g.font)]) {
            const sx = m.a * px + m.c * py + m.e, sy = m.b * px + m.d * py + m.f;
            bounds.left = Math.min(bounds.left, sx); bounds.right = Math.max(bounds.right, sx);
            bounds.top = Math.min(bounds.top, sy); bounds.bottom = Math.max(bounds.bottom, sy);
          }
        }
        return text.call(this, str, x, y, ...args);
      };
      const bad = [], missing = [], ids = Object.keys(ITEMS).filter(id => !['car', 'home', 'tattoo', 'look'].includes(ITEMS[id].kind));
      try {
        for (const id of ids) {
          inv.length = 0; inv.push({ id, uses: ITEMS[id].uses || 0, q: 'fine', kg: 1.5 }); held = 0;
          if (!DENSE[id] && !ITEMS[id].rod && ITEMS[id].kind !== 'gun' && id !== 'yoyo') missing.push(id);
          // Special gun/rod/yo-yo motions retain their own geometry. Check all normal item gestures here.
          for (const phase of [-1, .2, .5, .8]) {
            heldUse = phase < 0 ? null : { item: inv[0], t: T - phase * .65, duration: .65 };
            bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
            g.clearRect(0, 0, cv.width, cv.height); g.textBaseline = 'top'; drawHeldBig();
            if (DENSE[id] && (bounds.left < 0 || bounds.right > cv.width || bounds.top < 0 || bounds.bottom > cv.height))
              bad.push({ id, phase, ...bounds });
          }
        }
        return { count: ids.length, missing, clips, bad };
      } finally { g.fillText = text; drawHand = hand; g.clip = clip; }
    });
    assert.ok(result.count >= 187);
    assert.deepEqual(result.missing, []);
    assert.equal(result.clips, result.count * 4, 'each item is culled against its hand once per frame');
    assert.deepEqual(result.bad, [], `${width}x${height}: ${JSON.stringify(result.bad)}`);
  }
}));

test('cans retain an unbroken shell; cooked meals retain depletion and quality; ammunition has its own box and round count', () => withItems(async page => {
  const r = await page.evaluate(() => {
    const signature = ([art, col]) => art.map((line, r) => [...line].map((ch, c) => ch === ' ' ? ' ' : ch + ':' + col(ch, r, c)).join(',')).join('\n');
    const holes = [], unchanged = [], small = [], quality = [];
    for (const id of ['soda', 'energy']) for (const f of [1, .75, .5, .25, 0]) {
      const [art] = DENSE[id]({ id, uses: ITEMS[id].uses * f }, f);
      for (const line of art) if (/\S +\S/.test(line.trim())) holes.push({ id, f, line });
    }
    for (const { id } of RECIPES) {
      const full = DENSE[id]({ id, q: 'fine' }, 1), partly = DENSE[id]({ id, q: 'fine' }, .2), burnt = DENSE[id]({ id, q: 'burnt' }, 1);
      if (signature(full) === signature(partly)) unchanged.push(id);
      if (signature(full) === signature(burnt)) quality.push(id);
      if (full[0].length < 10 || Math.max(...full[0].map(l => l.length)) < 24) small.push(id);
    }
    const ammo = signature(DENSE.ammo({ id: 'ammo', uses: 24 }, 1));
    return { holes, unchanged, quality, small, ammoIsBook: ammo === signature(DENSE.book({ id: 'book' }, 1)),
      ammoDepletes: ammo !== signature(DENSE.ammo({ id: 'ammo', uses: 2 }, 1)),
      groundAmmoIsBook: JSON.stringify(DROPPED_ART.ammo({ uses: 24 })[0]) === JSON.stringify(DROPPED_ART.book({})[0]) };
  });
  assert.deepEqual(r.holes, []); assert.deepEqual(r.unchanged, []); assert.deepEqual(r.quality, []); assert.deepEqual(r.small, []);
  assert.equal(r.ammoIsBook, false); assert.equal(r.groundAmmoIsBook, false); assert.equal(r.ammoDepletes, true);
}));

test('visible item strokes touch the drawn fingers at multiple sizes, including thin bases and hollow objects', () => withItems(async page => {
  for (const [width, height] of [[1280, 720], [390, 844], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    const r = await page.evaluate(() => {
      resize(); heldUse = null;
      const hand = drawHand, floating = [];
      const examples = ['tea', 'jadedragon', 'bottlemsg', 'ball', 'soda', 'energy', 'redstring', 'goldring', 'plasticbag', 'panfish', 'ammo', 'sparklers', 'pocketknife', 'book'];
      const ids = cv.width === 1280 ? Object.keys(DENSE).filter(id => ITEMS[id] && id !== 'yoyo') : examples;
      try {
        for (const id of ids) for (const remaining of [1, .25]) {
          inv.length = 0; inv.push({ id, uses: Math.ceil((ITEMS[id].uses || 0) * remaining), q: 'fine', kg: 1.5 }); held = 0;
          const G = heldFrame(inv[0], heldPicture(inv[0])), w = G.hsz * 2, h = G.hsz * 4;
          const left = Math.round(G.cx - w / 2), top = Math.round(G.hy - G.hsz * 2);
          g.clearRect(0, 0, cv.width, cv.height); g.textBaseline = 'top';
          drawHand = () => {}; drawHeldBig();
          const item = g.getImageData(left, top, w, h).data;
          drawHand = hand; drawHeldBig();
          const final = g.getImageData(left, top, w, h).data;
          g.clearRect(0, 0, cv.width, cv.height); hand(G.cx, G.hy, G.hsz);
          const onlyHand = g.getImageData(left, top, w, h).data;
          let gap = Infinity, clearGap = Infinity;
          for (let x = 0; x < w; x++) {
            let firstHand = -1, lastItem = -1;
            for (let y = 0; y < h; y++) {
              const k = (y * w + x) * 4;
              if (onlyHand[k] > 65 && onlyHand[k + 1] > 30 && onlyHand[k + 3] > 160) { firstHand = y; break; }
            }
            for (let y = 0; y < firstHand; y++) {
              const k = (y * w + x) * 4;
              if (item[k + 3] > 160 && final[k + 3] > 160 && Math.max(final[k], final[k + 1], final[k + 2]) > 15 &&
                Math.abs(item[k] - final[k]) + Math.abs(item[k + 1] - final[k + 1]) + Math.abs(item[k + 2] - final[k + 2]) < 30) lastItem = y;
            }
            if (lastItem < 0 || firstHand < 0) continue;
            gap = Math.min(gap, firstHand - lastItem - 1);
            let empty = 0;
            for (let y = lastItem + 1; y < firstHand; y++) if (final[(y * w + x) * 4 + 3] < 96) empty++;
            clearGap = Math.min(clearGap, empty);
          }
          // Only the two text outlines may separate the colored strokes, with no transparent band.
          if (clearGap > 0 || gap > Math.ceil(G.hsz * .07 + G.s * .07) + 2)
            floating.push({ id, remaining, gap, clearGap });
        }
        const [art, col] = DENSE.pocketknife({ id: 'pocketknife' }), red = [];
        art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ' ' && col(ch, r, c) >> 4 === RED) red.push([c, r]); }));
        const w = Math.max(...red.map(p => p[0])) - Math.min(...red.map(p => p[0]));
        const h = Math.max(...red.map(p => p[1])) - Math.min(...red.map(p => p[1]));
        return { floating, knifeUpright: h > w * D_ASPECT * 2 };
      } finally { drawHand = hand; }
    });
    assert.deepEqual(r.floating, [], `${width}x${height}: visible contact after the hand covers the item`);
    assert.equal(r.knifeUpright, true);
  }
}));

test('only the item is culled behind the hand pixels: scenery shows through and exposed parts survive above, beside and below it', () => withItems(async page => {
  const frames = await page.evaluate(() => [0, .9].map(angle => {
    g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = '#20507b'; g.fillRect(0, 0, cv.width, cv.height);
    g.textBaseline = 'top'; g.save(); g.translate(480, 240); g.rotate(angle);
    const size = 24;
    drawBehindHand(0, 0, size, () => { g.fillStyle = '#ee2222'; g.fillRect(-200, -200, 800, 500); });
    const m = g.getTransform(); g.restore();
    const at = ([x, y]) => [...g.getImageData(Math.round(m.a * x + m.c * y + m.e), Math.round(m.b * x + m.d * y + m.f), 1, 1).data];
    return { inside: [[0, 1.4 * size], [0, 2.4 * size], [200, 3.2 * size]].map(at),
      outside: [[0, -size], [-6 * size, 2 * size], [0, 6 * size]].map(at) };
  }));
  for (const frame of frames) {
    for (const pixel of frame.inside) assert.deepEqual(pixel, [32, 80, 123, 255], 'the background shows through the unfilled hand');
    for (const pixel of frame.outside) assert.deepEqual(pixel, [238, 34, 34, 255], 'the hand does not slice off exposed item pixels');
  }
}));

test('use gestures animate the intended item, finish cleanly and stay separate from inventory slots and the camera', () => withItems(async page => {
  const r = await page.evaluate(() => {
    const camera = [px, py, a, pitch], gestures = [], pictures = [];
    for (const id of ['duck', 'book', 'newspaper', 'pocketknife', 'oldcoin', 'snowglobe', 'coffee', 'plushcat', 'compass']) {
      inv.length = 0; inv.push({ id, uses: ITEMS[id].uses || 0 }); held = 0;
      animateHeldUse(inv[0]); const idle = heldFrame(inv[0], heldPicture(inv[0]));
      T += .2; const use = heldFrame(inv[0], heldPicture(inv[0]));
      if (JSON.stringify(idle) !== JSON.stringify(use)) gestures.push(id);
      if (['book', 'newspaper', 'pocketknife'].includes(id)) {
        const active = heldPicture(inv[0]).art.join('\n'); T += 1;
        if (active !== heldPicture(inv[0]).art.join('\n')) pictures.push(id);
      } else T += 1;
    }
    inv.length = 0; inv.push({ id: 'duck', uses: 0 }, { id: 'duck', uses: 0 }); held = 0;
    animateHeldUse(inv[0]); T += .2;
    const active = heldUsePhase(inv[0]), other = heldUsePhase(inv[1]);
    T += 1; const finished = heldUsePhase(inv[0]);
    const sameFrame = heldPicture(inv[0]) === heldPicture(inv[0]);
    return { gestures, pictures, active, other, finished, sameFrame, cameraUnchanged: JSON.stringify(camera) === JSON.stringify([px, py, a, pitch]) };
  });
  assert.equal(r.gestures.length, 9); assert.deepEqual(r.pictures, ['book', 'newspaper', 'pocketknife']);
  assert.ok(r.active > 0); assert.equal(r.other, -1); assert.equal(r.finished, -1);
  assert.equal(r.sameFrame, true); assert.equal(r.cameraUnchanged, true);
}));
