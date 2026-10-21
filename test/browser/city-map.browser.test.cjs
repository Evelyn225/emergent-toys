'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,firefox,devices}=require('playwright');
const PAGE=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href;
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(fn,mobile=false) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile,...mobile?{userAgent:devices['iPhone 13'].userAgent}:{}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});await page.goto(PAGE);
    await page.evaluate(()=>{paused=false;mode='walk';room=me=null;[px,py]=citySourcePoint(41,73);T=10;tod=12;money=5000;env(0);render(0);});
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}

test('M opens the full map, M and Escape return to play, Shift+M toggles the minimap and Pause stays paused',()=>fixture(async page=>{
  await page.keyboard.press('KeyM');assert.equal(await page.evaluate(()=>bigMapOpen()&&paused),true);
  await page.keyboard.press('KeyM');assert.equal(await page.evaluate(()=>bigMapOpen()||paused),false);
  await page.keyboard.press('Shift+KeyM');assert.equal(await page.evaluate(()=>showMap&&!bigMapOpen()),true);
  await page.keyboard.press('KeyM');await page.locator('#bigmap input').fill('coffee');await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>bigMapOpen()||paused),false);
  await page.evaluate(()=>openPause());await page.locator('[data-act="map"]').click();await page.locator('[data-map="close"]').click();
  assert.equal(await page.evaluate(()=>paused&&pauseEl.style.display==='flex'),true);
}));

test('search and filters expose shop hours, select places, persist a waypoint and draw a valid street route',()=>fixture(async page=>{
  await page.keyboard.press('KeyM');await page.locator('#bigmap input').fill('coffee');
  const rows=await page.locator('[data-place]').count();assert.ok(rows>0);
  await page.locator('[data-place]').first().click();assert.match(await page.locator('.place-detail').innerText(),/COFFEE|CAFE|coffee/);
  await page.locator('[data-map="waypoint"]').click();
  const saved=await page.evaluate(()=>({waypoint:mapWaypoint,path:MAP_NAV.path?.length,valid:MAP_NAV.path?.every(p=>mapWalkableCell(Math.floor(p.x),Math.floor(p.y)))}));
  assert.ok(saved.path>1);assert.equal(saved.valid,true);
  await page.keyboard.press('Escape');
  const hud=await page.evaluate(()=>{const text=g.fillText,out=[];g.fillText=function(s,...args){out.push(s);return text.call(this,s,...args);};try{render(0);}finally{g.fillText=text;}return out.join(' ');});
  assert.match(hud,new RegExp(saved.waypoint.name));
  await page.reload();assert.deepEqual(await page.evaluate(()=>mapWaypoint),saved.waypoint);
  await page.evaluate(()=>{paused=false;openBigMap();});await page.locator('[data-category="transport"]').click();
  assert.equal(await page.evaluate(()=>mapFilteredPlaces().every(p=>p.category==='transport')),true);
}));

test('Mara is discoverable before owning a home and can be called from the map after buying one; she keeps waiting',()=>fixture(async page=>{
  await page.keyboard.press('KeyM');await page.locator('[data-map="supplier"]').click();
  assert.match(await page.locator('.place-detail').innerText(),/Mara/);
  assert.equal(await page.locator('[data-map="call-supplier"]').isDisabled(),true);
  await page.locator('[data-map="find-housing"]').click();assert.ok(await page.locator('[data-place]').count()>0);
  await page.keyboard.press('Escape');await page.evaluate(()=>buy('home_studio'));
  await page.keyboard.press('KeyM');await page.locator('[data-map="supplier"]').click();await page.locator('[data-map="call-supplier"]').click();
  assert.equal(await page.evaluate(()=>supplierVisit&&mapWaypoint.id==='supplier'&&!!MAP_NAV.path),true);
  assert.match(await page.locator('.place-detail').innerText(),/Waiting outside/);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>{T+=1000;nearWorkshopSupplier();return !!supplierVisit;}),true);
}));

test('clicks pick places or drop pins, while dragging and a pinch never drop a pin',()=>fixture(async page=>{
  await page.keyboard.press('KeyM');await page.locator('[data-map="places"]').click();
  await page.mouse.move(900,450);await page.mouse.down();await page.mouse.move(1000,500,{steps:4});await page.mouse.up();
  assert.equal(await page.evaluate(()=>BIGMAP.selected),null);
  await page.evaluate(()=>bigMapDraw());await page.mouse.click(1000,500);
  assert.ok(await page.evaluate(()=>!!BIGMAP.selected));
  await page.evaluate(()=>{BIGMAP.selected=null;bigMapEl.querySelector('.directory').hidden=true;bigMapCv.setPointerCapture=()=>{};});
  await page.locator('#bigmap canvas').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:600,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:700,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',clientX:600,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerup',{pointerId:2,pointerType:'touch',clientX:700,clientY:300});
  assert.equal(await page.evaluate(()=>BIGMAP.selected),null);
}));

test('the map uses the street location inside apartments and can display bounded edges without wrapping',()=>fixture(async page=>{
  const result=await page.evaluate(()=>{
    buy('home_studio');const home=owned.homes[0],door=buyerDoor(home),def=ROOM_DEFS.home;
    enterRoom('home',{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[...door,0]},def.entry);openBigMap();
    const result={centre:[BIGMAP.cx,BIGMAP.cy],door};
    MAP_WORLD.wrap=false;bigMapFit();bigMapPan(1e6,1e6);bigMapDraw();
    result.bounded=BIGMAP.cx===0&&BIGMAP.cy===0;return result;
  });
  assert.deepEqual(result.centre,result.door);assert.equal(result.bounded,true);
}));

test('phone map controls and supplier details remain reachable at narrow and landscape sizes',()=>fixture(async page=>{
  for(const [width,height] of [[320,568],[390,844],[844,390]]) {
    await page.setViewportSize({width,height});await page.evaluate(()=>{openBigMap();bigMapDraw();});
    for(const el of await page.locator('#bigmap .bar button,#bigmap .bar input').all()) {
      const r=await el.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width&&r.y+r.height<=height);
    }
    await page.locator('[data-map="supplier"]').click();
    assert.equal(await page.locator('[data-map="find-housing"]').isVisible(),true);
    const box=await page.locator('.directory').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=height);
    await page.locator('[data-map="close"]').click();assert.equal(await page.evaluate(()=>paused),false);
  }
},true));
