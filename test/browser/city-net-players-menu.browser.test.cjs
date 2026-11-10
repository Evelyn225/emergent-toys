'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {chromium} = require('playwright'), {pathToFileURL} = require('node:url'), path = require('node:path');
let browser;
test.before(async () => browser = await chromium.launch());
test.after(async () => browser?.close());
async function menu(run) {
  const page = await browser.newPage({viewport:{width:1170,height:800}}), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(() => requestAnimationFrame = () => 0);
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(() => {
      paused = false; mode = 'walk'; room = me = null; lockMouse = () => {}; netBackgroundTick = () => {};
      net.on = true; net.code = 'test-city'; net.tx = {send(){},leave(){}}; netTeleportReset();net.invites=new Map();net.gifts=new Map();
      for(let i=0;i<7;i++) net.peers.set('peer'+i,{id:'peer'+i,name:i===6?'A very long player name': 'Player '+(i+1),hello:{look:netCheckLook({top:i})},snaps:[],view:{rk:'out',x:px+.5+i,y:py,peaceful:true}});
    });
    await run(page); assert.deepEqual(errors,[]);
  } finally {await page.close();}
}
test('Tab previews close on release; mouse and keyboard interactions pin the menu and keep focus inside', () => menu(async p => {
  await p.keyboard.down('Tab'); assert.equal(await p.evaluate(() => netPlayersOpen()),true);
  await p.keyboard.down('Tab'); assert.equal(await p.evaluate(() => netPlayersPinned),false,'holding Tab does not accidentally pin the preview');
  await p.keyboard.up('Tab'); assert.equal(await p.evaluate(() => netPlayersOpen()),false);
  await p.keyboard.down('Tab'); await p.locator('[data-peer="peer1"] .np-player').click(); await p.keyboard.up('Tab');
  assert.equal(await p.evaluate(() => netPlayersOpen()),true);
  assert.equal(await p.locator('.np-player[aria-expanded="true"]').count(),1);
  await p.locator('[data-peer="peer1"] [data-np-act="whisper"]').click();
  await p.locator('[data-np="input"]').fill('Keep this draft');
  await p.evaluate(() => {net.peers.set('new',{id:'new',name:'New arrival',hello:{look:netCheckLook({})},snaps:[]});netPlayersShow();});
  assert.equal(await p.locator('[data-np="input"]').inputValue(),'Keep this draft');
  assert.equal(await p.locator('[data-np="input"]').evaluate(el => el===document.activeElement),true);
  await p.locator('[data-np-act="done"]').focus(); await p.keyboard.press('Tab');
  assert.equal(await p.locator('.np-player').first().evaluate(el => el===document.activeElement),true);
  await p.keyboard.press('Shift+Tab'); assert.equal(await p.locator('[data-np-act="done"]').evaluate(el => el===document.activeElement),true);
  await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => netPlayersOpen()),false);
  await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => netPlayersOpen()),false);
  await p.keyboard.down('Tab'); await p.keyboard.press('ArrowDown'); await p.keyboard.up('Tab');
  assert.equal(await p.evaluate(() => netPlayersOpen() && netPlayersPinned),true,'keyboard navigation pins the preview');
}));
test('busy room controls fit phones, landscape and scaled desktop; live updates preserve scroll and selected controls', () => menu(async p => {
  await p.evaluate(() => openNetPlayers());
  for (const [width,height,scale] of [[1170,800,1],[390,844,1],[320,568,1],[844,390,1],[2560,1440,2]]) {
    await p.setViewportSize({width,height}); await p.evaluate(scale => {settings.uiScale=scale;applySettings();},scale);
    const fit = await p.locator('#netplayers .panel').evaluate(el => {const r=el.getBoundingClientRect(),body=el.querySelector('.np-body'),done=el.querySelector('[data-np-act="done"]').getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,horizontal:body.scrollWidth<=body.clientWidth+1,closeVisible:done.top>=r.top&&done.bottom<=r.bottom+1};});
    assert.deepEqual(fit,{fits:true,horizontal:true,closeVisible:true},JSON.stringify({width,height,scale}));
  }
  await p.setViewportSize({width:390,height:844});await p.evaluate(() => {settings.uiScale=1;applySettings();});
  await p.locator('[data-peer="peer6"] .np-player').click();
  const stable = await p.evaluate(() => {const button=netPlayersEl.querySelector('[data-peer="peer6"] [data-np-act="cash"]'),body=netPlayersEl.querySelector('.np-body');button.focus();const y=body.scrollTop;net.peers.get('peer0').view.x+=1;netPlayersShow();return {focus:document.activeElement===button,scroll:body.scrollTop===y};});
  assert.deepEqual(stable,{focus:true,scroll:true});
  await p.locator('[data-peer="peer6"] [data-np-act="cash"]').click();await p.locator('[data-np="input"]').fill('5.25');
  assert.equal(await p.locator('[data-np="input"]').evaluate(el => el.getBoundingClientRect().width>100),true);
  await p.evaluate(() => {net.peers.delete('peer6');netPlayersShow();});
  assert.equal(await p.locator('[data-np="input"]').count(),0,'departed player closes their form');
  assert.equal(await p.evaluate(() => netPlayersEl.contains(document.activeElement)),true,'focus recovers when the recipient leaves');
  await p.evaluate(() => {net.peers.clear();netPlayersShow();});assert.match(await p.locator('[data-np="list"]').textContent(),/Nobody else/);
  assert.equal(await p.locator('[data-np-act="cash"]').count(),0);
}));
