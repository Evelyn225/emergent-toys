'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run) {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;tod=12;env(0);});
    await run(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}

test('the rendered pitched roofs match walking, aircraft and shot collision heights',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const shade=islandRoofShade;let pixels=0,error=0;
    islandRoofShade=(roof,i,t,L)=>{
      if(!roof.part&&HIT.face>=6) {
        const x=roof.x+HIT.u,y=roof.y+HIT.v;
        pixels++;error=Math.max(error,Math.abs(HIT.w-islandRoofHeight(x,y)),Math.abs(HIT.w-builtHeight(x,y)),Math.abs(HIT.w-roofHeightAt(x,y)));
      }
      return shade(roof,i,t,L);
    };
    px=536;py=244;a=0;pitch=.12;freecam={z:1.1};render(0);
    islandRoofShade=shade;freecam=null;
    const roof=ISLAND_ROOFS[0],height=islandRoofHeight(roof.x,roof.y),eave=islandRoofHeight(roof.x+roof.hl-.02,roof.y);
    const hit=traceShot(roof.x-3,roof.y,roof.z0+.08,1,0,0);
    return {pixels,error,pitch:height-eave,hit:hit.what,shotError:Math.abs(islandRoofHeight(hit.x,hit.y)-hit.z),doorOpen:free(...FERN_HOUSE.door)};
  });
  assert.ok(result.pixels>20,JSON.stringify(result));assert.ok(result.error<1e-6,JSON.stringify(result));
  assert.ok(result.pitch>.15);assert.equal(result.hit,'wall');assert.ok(result.shotError<.005,JSON.stringify(result));assert.equal(result.doorOpen,true);
}));

test('the cascade joins its terrain bed and animates visible water instead of a floating box',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    const originalBox=drawBox,originalCascade=drawFernCascade;
    let recording=false,water=new Map();
    drawFernCascade=()=>{recording=true;originalCascade();recording=false;};
    drawBox=(box,shade,ray)=>originalBox(box,(i,t,L)=>{
      const painted=shade(i,t,L);if(recording&&painted)water.set(i,CH[i]);return painted;
    },ray);
    px=628.6;py=190.4;a=Math.PI;pitch=.08;freecam=null;
    T=8;render(0);const first=water;water=new Map();T=8.23;render(0);
    let animated=0;for(const [i,ch]of water)if(first.has(i)&&first.get(i)!==ch)animated++;
    drawBox=originalBox;drawFernCascade=originalCascade;
    let gap=0;
    for(const sheet of FERN_CASCADE)for(const offset of [-.25,0,.25]) {
      const plane=sheet.planes[4],z=plane[3]-plane[1]*offset;
      gap=Math.max(gap,Math.abs(z-terrainHeight(sheet.x,sheet.y+offset)));
    }
    return {visible:first.size,animated,gap,pool:fernCreekDistance(627,196.5)<0,depth:terrainHeight(627,196.5)};
  });
  assert.ok(result.visible>15,JSON.stringify(result));assert.ok(result.animated>3,JSON.stringify(result));
  assert.ok(result.gap<.05,JSON.stringify(result));assert.equal(result.pool,true);assert.ok(result.depth>.05);
}));
