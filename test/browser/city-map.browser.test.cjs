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
  const pin=await page.evaluate(()=>({selected:BIGMAP.selected,pin:BIGMAP.places.find(p=>p.id==='pin'),waypoint:mapWaypoint}));
  assert.equal(pin.selected,'pin');assert.equal(pin.waypoint.id,'pin');assert.equal(pin.waypoint.x,pin.pin.x);assert.equal(pin.waypoint.y,pin.pin.y);
  await page.evaluate(()=>{BIGMAP.selected=null;bigMapEl.querySelector('.directory').hidden=true;bigMapCv.setPointerCapture=()=>{};});
  await page.locator('#bigmap canvas').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:600,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:700,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',clientX:600,clientY:300});
  await page.locator('#bigmap canvas').dispatchEvent('pointerup',{pointerId:2,pointerType:'touch',clientX:700,clientY:300});
  assert.equal(await page.evaluate(()=>BIGMAP.selected),null);
  assert.deepEqual(await page.evaluate(()=>mapWaypoint),pin.waypoint,'pinching leaves the active destination alone');
  await page.reload();assert.deepEqual(await page.evaluate(()=>mapWaypoint),pin.waypoint,'a dropped pin is saved as the active waypoint');
}));

test('compass bearings turn with the view, guide job stops, and appear only while a destination is active',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    clearMapWaypoint();task=job=courierJob=null;
    const empty=drawNavigationCompass(0),t={id:'test',name:'East test',x:px+10,y:py};setMapWaypoint(t);
    a=0;const ahead=navigationBearing(t);a=-Math.PI/2;const right=navigationBearing(t);a=Math.PI;const behind=navigationBearing(t);
    me={x:px,y:py};mode='drive';job={ride:{dest:[px,py],name:'Mercer Street'}}; // STOP wins over a separate active waypoint.
    const texts=[],draw=g.fillText;g.fillText=function(s,...args){texts.push(s);return draw.call(this,s,...args);};
    let active;try{active=drawNavigationCompass(0);}finally{g.fillText=draw;}
    job=null;me=null;mode='walk';clearMapWaypoint();const cleared=drawNavigationCompass(0);
    return{empty,active,cleared,ahead,right,behind,texts};
  });
  assert.equal(r.empty,0);assert.equal(r.cleared,0);assert.ok(r.active>0);assert.ok(Math.abs(r.ahead)<1e-8&&Math.abs(r.right-Math.PI/2)<1e-8&&Math.abs(r.behind)>3);
  assert.ok(r.texts.some(t=>/STOP.*DROP OFF.*0 m/.test(t)),r.texts.join(' '));
}));

test('navigation text stays in its top strip on desktop and narrow phones, with an outside label indoors',()=>fixture(async page=>{
  await page.evaluate(()=>setMapWaypoint({id:'test',name:'A very long destination name which must fit',x:px+20,y:py+10}));
  for(const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]){
    await page.setViewportSize({width,height});
    const r=await page.evaluate(()=>{
      resize();env(0);render(0);const text=g.fillText,rect=g.fillRect,out=[],boxes=[];
      g.fillText=function(s,x,y){out.push({s,x,y,w:g.measureText(s).width});return text.call(this,s,x,y);};
      g.fillRect=function(x,y,w,h){boxes.push({x,y,w,h});return rect.call(this,x,y,w,h);};
      let h;try{h=drawNavigationCompass(0);}finally{g.fillText=text;g.fillRect=rect;}
      return{h,out,box:boxes[0],W:cv.width,bar:TOUCH?touchBarBox():null};
    });
    assert.ok(r.box.x>=0&&r.box.x+r.box.w<=r.W);
    if(r.bar&&r.bar.left>r.W*.55)assert.ok(r.box.x+r.box.w<r.bar.left,'landscape compass clears the touch toolbar');
    for(const t of r.out.filter(t=>t.s.length>1))assert.ok(t.x>=r.box.x&&t.x+t.w<=r.box.x+r.box.w&&t.y<r.h,JSON.stringify(t));
  }
  const indoors=await page.evaluate(()=>{
    enterRoom('home',{ret:[px,py,a]},ROOM_DEFS.home.entry);const out=[],draw=g.fillText;g.fillText=s=>out.push(s);
    try{drawNavigationCompass(0);}finally{g.fillText=draw;}return out;
  });
  assert.equal(indoors.length,1);assert.match(indoors[0],/^OUTSIDE/);
},true));

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
