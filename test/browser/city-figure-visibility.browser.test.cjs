'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');

const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => {
  const engine = process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium;
  browser = await engine.launch();
});
test.after(async () => { await browser?.close(); });

async function withPage(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => { paused = true; env(0); render(0); });
    await fn(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('figures outside the view or fully behind geometry never request sprites', () => withPage(async page => {
  const result = await page.evaluate(() => {
    const original = figSprite, requests = [], look = figLook({});
    figSprite = (...args) => { requests.push(args[3]); return original(...args); };
    try {
      dx = 1; dy = 0; eye = .17; hor = rows / 2;
      for (const [x, y, z, occluded] of [
        [-10, 0, 0], [.04, 0, 0], [vis + 1, 0, 0],
        [.1, 10, 0], [.1, -10, 0], [1, 0, 10], [1, 0, -10], [1, 0, 0, true]
      ]) {
        ZB.fill(occluded ? .1 : Infinity); ZBG.set(ZB);
        drawFigure(x, y, z, .175, -1, 0, look);
      }
      const rejected = requests.length;
      ZB.fill(Infinity);
      drawFigure(1, 0, 0, .175, -1, 0, look);
      const visible = requests.length - rejected;
      const painted = [...ZB].some(z => z === 1);
      return { rejected, visible, painted };
    } finally { figSprite = original; }
  });
  assert.deepEqual(result, { rejected: 0, visible: 1, painted: true });
}));

test('a foreground bar keeps its stroke while the same skin color remains visible behind it',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    dx=1;dy=0;eye=.17;hor=rows/2;
    const look=figLook({hair:'bald',col:{skin:[SKIN,12]}});
    ZB.fill(Infinity);ZBG.fill(Infinity);BG.fill(C(GRAY,3));
    drawFigure(1,0,0,.175,-1,0,look);
    const face=Array.from(BG, (bg,i)=>bg>>4===SKIN?i:-1).filter(i=>i>=0);
    const colors=face.map(i=>BG[i]);
    ZB.fill(.5);ZBG.fill(Infinity);BG.fill(C(GRAY,3));CH.fill('|');COL.fill(C(WHITE,12));
    drawFigure(1,0,0,.175,-1,0,look);
    return {face:face.length,skin:face.every((i,k)=>BG[i]===colors[k]),
      bars:face.every(i=>CH[i]==='|'&&COL[i]===C(WHITE,12)&&ZB[i]===.5),
      backgroundDepth:face.every(i=>ZBG[i]===1)};
  });
  assert.ok(result.face>10);assert.equal(result.skin,true);assert.equal(result.bars,true);assert.equal(result.backgroundDepth,true);
}));

test('moving across the jail cell preserves the officer skin around the actual steel bars',()=>withPage(async page=>{
  const result=await page.evaluate(()=>{
    T=0;enterRoom('jail',{word:'JAIL',until:60,ret:[px,py,a]},[9,5.3,Math.PI/2]);env(0);
    const officer=room.props.find(s=>s.fig&&s.tick&&s.y===7.5);
    // Random civilian builds can leave only two face pixels under a bar. Use a
    // fixed adult officer and distinct skin palette to exercise the overlap consistently.
    const look=officer.fig=figLook({hair:'short',hat:'copcap',top:'uniform',bot:'pants',bw:1,col:{skin:[SKIN,12],top:[BLUE,6],hat:[BLUE,5]}});
    officer.tick=null;officer.x=11;officer.face=[0,-1];
    const props=room.props.filter(s=>!s.fig||s===officer),withoutBars=props.filter(s=>!s.peeThrough),out=[];
    for(let step=0;step<5;step++) {
      if(step)move(.8,0);
      a=Math.atan2(officer.y-py,officer.x-px);pitch=0;
      room.props=withoutBars;render(0);
      const depth=dx*(officer.x-px)+dy*(officer.y-py);
      const skin=Array.from(BG,(bg,i)=>bg>>4===look.base[FR.SKIN]&&Math.abs(ZBG[i]-depth)<1e-4?{i,bg,depth:ZBG[i]}:null).filter(Boolean);
      room.props=props;render(0);
      const visible=skin.filter(s=>ZB[s.i]>=s.depth-1e-4),covered=skin.filter(s=>ZB[s.i]<s.depth-1e-4);
      out.push({samples:visible.length,covered:covered.length,same:officer.fig===look,skin:visible.every(s=>BG[s.i]===s.bg),metal:covered.every(s=>BG[s.i]>>4===GRAY)});
    }
    return out;
  });
  assert.ok(result.filter(r=>r.samples>5).length>=3,JSON.stringify(result));
  assert.ok(result.some(r=>r.covered>5),JSON.stringify(result));
  for(const r of result){assert.equal(r.same,true);assert.equal(r.skin,true);assert.equal(r.metal,true);}
}));

test('partially visible figures still paint at every screen edge', () => withPage(async page => {
  const results = await page.evaluate(() => {
    dx = 1; dy = 0; eye = .17;
    const look = figLook({});
    const height = FIG_H * .175 / FIG_TALL;
    return [
      { y: .99, horizon: rows / 2 }, { y: -.99, horizon: rows / 2 },
      { y: 0, horizon: (.08 - eye) * projY },
      { y: 0, horizon: rows - (eye - height + .08) * projY }
    ].map(({ y, horizon }) => {
      hor = horizon; ZB.fill(Infinity);
      drawFigure(1, y, 0, .175, -1, 0, look);
      return [...ZB].some(z => z === 1);
    });
  });
  assert.deepEqual(results, [true, true, true, true]);
}));

test('invisible figures leave fine detail for visible people and its budget renews at frozen simulation time', () => withPage(async page => {
  const result = await page.evaluate(() => {
    const originalSprites = CITY.sprites, originalFigureSprite = figSprite;
    const look = figLook({}), scales = [];
    figCache.clear(); figFineCache.clear();
    figSprite = function (...args) {
      const sprite = originalFigureSprite(...args);
      if (args[3] > 1) scales.push(sprite.S);
      return sprite;
    };
    const time = T;
    let frame = 0;
    CITY.sprites = () => {
      dx = 1; dy = 0; eye = .17; hor = rows / 2;
      drawFigure(-1, 0, 0, .175, -1, 0, look, 'walk' + frame);
      ZB.fill(Infinity);
      drawFigure(.06, 0, 0, .175, -1, 0, look, 'walk' + frame);
      ZB.fill(Infinity);
      drawFigure(.06, 0, 0, .175, -1, 0, look, 'run' + frame);
      frame++;
    };
    try {
      render(0); render(0);
      return { scales, frozen: T === time, fineSprites: figFineCache.size };
    } finally { CITY.sprites = originalSprites; figSprite = originalFigureSprite; }
  });
  assert.deepEqual(result.scales, [4, 1, 4, 1]);
  assert.equal(result.fineSprites, 2);
  assert.equal(result.frozen, true);
}));
