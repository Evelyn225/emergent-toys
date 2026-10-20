'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,firefox}=require('playwright');
const PAGE=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href;
let browser;
test.before(async()=>{browser=await(process.env.CITY_TEST_BROWSER==='firefox'?firefox:chromium).launch();});
test.after(async()=>{await browser?.close();});
async function fixture(fn,mobile=false) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});await page.goto(PAGE);
    await page.evaluate(()=>{
      paused=false;mode='walk';room=me=null;px=41;py=73;T=10;tod=12;money=5000;env(0);render(0);
      buy('home_studio');const home=owned.homes[0];home.door=buyerDoor(home);
      for(const p of people)p.hidden=true;for(const c of cars)c.patrol=false;footCops.length=0;clearInventory();
    });
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}
async function approachBuyer(page) {
  await page.evaluate(()=>{updateDrugBuyer();px=drugBuyer.x-.15;py=drugBuyer.y;a=0;env(0);render(0);});
  await page.keyboard.press('KeyE');
}

test('a typed price cannot trigger the numeric shortcut; a counter sells only the chosen quantity and remembers Kit',()=>fixture(async page=>{
  await page.evaluate(()=>{carryItem({id:'weed',uses:6,q:'fine'});carryItem({id:'neon',uses:4,q:'perfect'});closet.push({id:'weed',uses:8,q:'fine'});});
  await approachBuyer(page);assert.equal(await page.locator('#drug-sale h1').innerText(),'Kit');
  await page.locator('[data-deal-count]').fill('2');
  await page.locator('[data-deal-price]').fill('');await page.locator('[data-deal-price]').pressSequentially('11');
  const money=await page.evaluate(()=>money);assert.equal(await page.evaluate(()=>drugContacts.buyers.kit?.deals||0),0);
  assert.equal(await page.locator('#drug-sale').isVisible(),true);
  await page.locator('[data-drug-sell]').click();assert.equal(await page.locator('[data-drug-counter]').isVisible(),true);
  assert.equal(await page.evaluate(()=>inv[0].uses),6);
  await page.locator('[data-drug-counter]').click();assert.equal(await page.evaluate(()=>money),money+18);
  assert.equal(await page.evaluate(()=>inv[0].uses),4);assert.equal(await page.evaluate(()=>inv[1].uses),4);assert.equal(await page.evaluate(()=>closet[0].uses),8);
  assert.equal(await page.evaluate(()=>drugBuyer),null);
  await page.reload();assert.equal(await page.evaluate(()=>drugContacts.buyers.kit.deals),1);
  assert.equal(await page.evaluate(()=>drugContacts.buyers.kit.spent),18);
}));

test('Juno wants small weed orders, refuses excessive asks, and leaves without taking anything',()=>fixture(async page=>{
  await page.evaluate(()=>{drugContacts.visits=1;carryItem({id:'weed',uses:6,q:'fine'});carryItem({id:'neon',uses:4,q:'perfect'});});
  await approachBuyer(page);assert.equal(await page.locator('#drug-sale h1').innerText(),'Juno');
  assert.equal(await page.locator('[data-deal-stock] option').count(),1);
  assert.equal(await page.locator('[data-deal-count]').getAttribute('max'),'3');
  const money=await page.evaluate(()=>money);
  for(let n=0;n<3;n++){await page.locator('[data-deal-price]').fill('999');await page.locator('[data-drug-sell]').click();}
  assert.equal(await page.locator('#drug-sale').isVisible(),false);assert.equal(await page.evaluate(()=>money),money);
  assert.equal(await page.evaluate(()=>inv[0].uses),6);assert.equal(await page.evaluate(()=>drugBuyer),null);
  await page.evaluate(()=>{updateDrugBuyer();});assert.equal(await page.evaluate(()=>drugBuyer),null);
  await page.evaluate(()=>{T+=41;updateDrugBuyer();});assert.equal(await page.evaluate(()=>drugBuyer.visit.id),'dex');
}));

test('Mara visits the building, supplies the correct cupboard, and keeps order history after reload',()=>fixture(async page=>{
  await page.evaluate(()=>{
    const h=owned.homes[0],def=ROOM_DEFS.home;
    enterRoom('home',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[...h.door,0]},def.entry);openWorkshop();
  });
  await page.locator('[data-call-supplier]').click();assert.equal(await page.evaluate(()=>!!supplierVisit),true);
  await page.evaluate(()=>{leaveRoom();px=supplierVisit.x-.15;py=supplierVisit.y;a=0;env(0);render(0);});
  assert.match(await page.evaluate(()=>promptText()),/Mara/);await page.keyboard.press('KeyE');
  assert.equal(await page.locator('#workshop-supplier h1').innerText(),'Mara');
  const money=await page.evaluate(()=>money);await page.locator('[data-supplier-order="refill"]').click();
  assert.equal(await page.evaluate(()=>owned.homes[0].workshop.supplies),5);assert.equal(await page.evaluate(()=>money),money-30);
  assert.equal(await page.evaluate(()=>drugContacts.supplierOrders),1);await page.locator('[data-supplier-dismiss]').click();
  assert.equal(await page.evaluate(()=>supplierVisit),null);await page.reload();
  assert.equal(await page.evaluate(()=>drugContacts.supplierOrders),1);assert.equal(await page.evaluate(()=>owned.homes[0].workshop.supplies),5);
}));

test('phone negotiation fits and the smoking joint exposes a Drag action with empty hands',()=>fixture(async page=>{
  await page.evaluate(()=>carryItem({id:'weed',uses:2,q:'fine'}));await approachBuyer(page);
  const fit=await page.locator('#drug-sale .panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1);assert.equal(fit,true);
  await page.keyboard.press('Escape');await page.keyboard.press('KeyQ');await page.keyboard.press('KeyQ');
  await page.evaluate(()=>{showTouch();});
  assert.ok((await page.locator('#touch .pad button').allTextContents()).includes('Drag'));
  const before=await page.evaluate(()=>drugEffects.weed);await page.evaluate(()=>{stepDrugEffects(2);T+=2;});
  await page.locator('#touch .pad button').filter({hasText:/^Drag$/}).tap();
  assert.ok(await page.evaluate(()=>drugEffects.weed)>before);
},true));
