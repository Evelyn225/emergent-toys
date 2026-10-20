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
async function withYoyo(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => {
      paused = false; mode = 'walk'; room = me = null; T = 10; env(0); render(0);
      clearInventory(); carryItem({ id: 'yoyo', uses: 0 });
      Object.assign(yoyo, { out: true, len: 1, lenV: 0, ang: 0, angV: 0, aimX: 0, aimY: 1, spin: 10 });
      fx.yoyo = 1;
    });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('pavement contact is continuous and walk the dog still rolls fully sideways under the real hand', () => withYoyo(async page => {
  const r = await page.evaluate(() => {
    const x = 600, y = 500, len = .9, angle = Math.acos((cv.height * .95 - y) / (cv.height * .36 * len));
    const before = yoyoPos(x, y, angle - 1e-6, len), after = yoyoPos(x, y, angle + 1e-6, len);
    const hand = heldFrame(heldItem()), hx = hand.cx - hand.hsz * .2, hy = hand.hy + HAND_ART.length * hand.hsz;
    const left = yoyoPos(hx, hy, -.4, 1), right = yoyoPos(hx, hy, .4, 1);
    const fullRoll = yoyoPos(600, 600, .3, 1), expectedX = 600 + Math.sin(.3) * cv.height * .36 * 1.15;
    return { jump: Math.hypot(before.x - after.x, before.y - after.y), left, right, ground: cv.height * .95, fullRoll, expectedX };
  });
  assert.ok(r.jump < .01, `ground contact jumped ${r.jump}px`);
  assert.ok(r.left.rolling && r.right.rolling);
  assert.equal(r.left.y, r.ground); assert.equal(r.right.y, r.ground);
  assert.ok(r.right.x - r.left.x > 200, 'walk the dog must cover a clear sideways span');
  assert.ok(Math.abs(r.fullRoll.x - r.expectedX) < 1e-10, 'the full original sideways reach is preserved');
}));

test('string characters hold their spacing as length grows and blend across slope changes', () => withYoyo(async page => {
  const r = await page.evaluate(() => {
    g.font = '10px monospace';
    const text = g.fillText;
    const sample = (x, y) => {
      const points = [];
      g.fillText = function(ch, x, y) { points.push({ch, x, y, alpha:g.globalAlpha}); };
      try { drawYoyoString(0, 0, x, y, 6, 10, '#fff'); } finally { g.fillText = text; }
      return points;
    };
    return { short: sample(0, 99.9), longer: sample(0, 100.1), diagonal: sample(60 * Math.cos(.3), 100 * Math.sin(.3)) };
  });
  for (let k = 0; k < 9; k++) {
    assert.equal(r.short[k].x, r.longer[k].x);
    assert.ok(Math.abs(r.short[k].y - r.longer[k].y) < 1e-10, 'adding a character must not reposition the earlier ones');
  }
  assert.ok(r.diagonal.some(p => p.alpha > .05 && p.alpha < .95), 'the two neighboring slopes crossfade');
}));

test('the yo-yo does not jump into its idle pose or change spin phase when touching the ground', () => withYoyo(async page => {
  const r = await page.evaluate(() => {
    const position = yoyoPos, draw = artText, frames = [];
    let endpoint;
    yoyoPos = function (...args) { const p = position(...args); endpoint = p; return p; };
    artText = function (art, x, y, s, col) {
      frames.push(art.map((line,r) => [...line].map((ch,c) => ch + ':' + col(ch,r,c)).join(',')).join('\n'));
    };
    try {
      yoyo.out = false; yoyo.ang = 1.7; yoyo.angV = 0;
      const s = Math.round(Math.max(14, cv.height / 36) * .72), hang = 5 * s / (cv.height * .36);
      yoyo.len = hang - 1e-6; drawYoyo(500, 300); const before = endpoint;
      yoyo.len = hang + 1e-6; drawYoyo(500, 300); const after = endpoint;
      yoyo.out = true; yoyo.len = .8; yoyo.ang = .5;
      drawYoyo(500, 495); const air = endpoint, faceAir = frames.at(-1);
      drawYoyo(500, 505); const ground = endpoint, faceGround = frames.at(-1);
      return { jump: Math.hypot(before.x - after.x, before.y - after.y), air, ground, faceAir, faceGround };
    } finally { yoyoPos = position; artText = draw; }
  });
  assert.ok(r.jump < .01, `reel-in pose jumped ${r.jump}px`);
  assert.equal(r.air.rolling, false); assert.equal(r.ground.rolling, true);
  assert.equal(r.faceAir, r.faceGround, 'contact must not multiply the accumulated spin phase');
}));

test('mouse steering still makes circles, keeps the view still, carries momentum and reels back in', () => withYoyo(async page => {
  const r = await page.evaluate(() => {
    const camera = [a, pitch];
    yoyo.aimX = .6; yoyo.aimY = 0;
    let previous = yoyo.ang, turns = 0;
    for (let n = 0; n < 360; n++) {
      const t = n / 60, w = Math.PI * 2 * 1.2;
      turnBy(120 * (Math.cos(w * (t + 1 / 60)) - Math.cos(w * t)) / settings.sensitivity,
        120 * (Math.sin(w * (t + 1 / 60)) - Math.sin(w * t)) / settings.sensitivity);
      stepYoyo(1 / 60);
      if (Math.abs(yoyo.ang - previous) > 3) turns++; previous = yoyo.ang;
    }
    const angle = yoyo.ang, speed = yoyo.angV;
    yoyo.aimX = Math.sin(angle) * .8; yoyo.aimY = Math.cos(angle) * .8;
    stepYoyo(1 / 60); const coast = Math.abs(speed) > .1 && Math.abs(yoyo.ang - angle) > .001;
    const line = useHeld()[0];
    for (let n = 0; n < 600; n++) stepYoyo(1 / 60);
    return { camera, afterCamera: [a, pitch], turns, coast, line, out: yoyo.out, len: yoyo.len };
  });
  assert.deepEqual(r.afterCamera, r.camera);
  assert.ok(r.turns >= 2); assert.ok(r.coast);
  assert.match(r.line, /reel it back/); assert.equal(r.out, false); assert.equal(r.len, 0);
}));
