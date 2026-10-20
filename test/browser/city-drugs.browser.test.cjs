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
      buy('home_studio');const h=owned.homes[0],def=ROOM_DEFS.home;
      enterRoom('home',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},def.entry);clearInventory();
    });
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}

test('weed can be bought, placed, tended, saved, harvested and sold through the real apartment controls',()=>fixture(async page=>{
  await page.evaluate(()=>openWorkshop());await page.locator('[data-rack]').click();
  await page.locator('[data-upgrade="lamp"]').click();
  await page.locator('[data-place="growrack"]').click();
  const valid=await page.evaluate(()=>{px=3.75;py=13;a=-Math.PI/2;return workshopCandidate().ok;});assert.equal(valid,true);
  await page.keyboard.press('KeyQ');await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>roomOpen(3.75,11.25)),false);
  await page.evaluate(()=>openWorkshop());await page.locator('[data-power]').click();await page.locator('[data-plant]').click();
  assert.equal(await page.locator('[data-pack]').isDisabled(),true);
  await page.evaluate(()=>{stepWorkshop(20);openWorkshop();});await page.locator('[data-tend]').click();
  await page.evaluate(()=>saveGame());
  const before=await page.evaluate(()=>owned.homes[0].workshop);await page.reload();
  assert.deepEqual(await page.evaluate(()=>owned.homes[0].workshop),before);
  await page.evaluate(()=>{
    paused=false;const h=owned.homes[0],def=ROOM_DEFS.home;
    enterRoom('home',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[41,73,0]},def.entry);
    stepWorkshop(31);px=3.75;py=12.7;a=-Math.PI/2;env(0);render(0);
  });
  assert.match(await page.evaluate(()=>promptText()),/harvest weed/);await page.keyboard.press('KeyE');
  assert.deepEqual(await page.evaluate(()=>inv.at(-1)),{id:'weed',uses:6,q:'perfect'});
  assert.equal(await page.evaluate(()=>workshopState(homeRecord()).parts[0].crop),undefined);
  await page.evaluate(()=>{
    leaveRoom();updateDrugBuyer();px=drugBuyer.x-.15;py=drugBuyer.y;a=0;
    for(const p of people)p.hidden=true;for(const c of cars)c.patrol=false;footCops.length=0;
  });
  assert.match(await page.evaluate(()=>promptText()),/Kit.*weed or Neon/);
  const money=await page.evaluate(()=>money);await page.keyboard.press('KeyE');await page.locator('[data-drug-sell]').click();
  assert.equal(await page.evaluate(()=>money),money+72);
}));

test('weed gives a joint, Q and left click light it and take drags, and sleep clears smoke and effects',()=>fixture(async page=>{
  await page.evaluate(()=>{carryItem({id:'weed',uses:2,q:'fine'});carryItem({id:'book',uses:0},false);});
  await page.keyboard.press('KeyQ');
  assert.equal(await page.evaluate(()=>inv[0].uses),1);assert.equal(await page.evaluate(()=>heldItem().id),'joint');
  assert.equal(await page.evaluate(()=>drugEffects.weed),0);
  // The game's captured-mouse route, without requesting a browser pointer lock in a headless test.
  await page.evaluate(()=>{desktopMouseCaptured=true;});await page.mouse.click(900,500);
  assert.equal(await page.evaluate(()=>inv.some(it=>it.id==='joint')),false);assert.equal(await page.evaluate(()=>quickSlots[1]),1);
  assert.equal(await page.evaluate(()=>held),-1);assert.equal(await page.evaluate(()=>fx.smokeKind),'joint');
  const initial=await page.evaluate(()=>drugEffects.weed);
  await page.evaluate(()=>{stepDrugEffects(3);T+=3;});await page.keyboard.press('KeyQ');
  assert.ok(await page.evaluate(()=>drugEffects.weed)>initial);
  await page.evaluate(()=>{sleep={t:1.4,home:true};stepSleep(.2);});
  assert.equal(await page.evaluate(()=>drugEffects.weed),0);
  assert.equal(await page.evaluate(()=>fx.smoke),0);
}));

test('growth and drug timers keep running during a batch and both freeze in Pause',()=>fixture(async page=>{
  const state=await page.evaluate(()=>{
    const w=workshopState(homeRecord());w.powered=true;
    const rack={id:'growrack',key:1,x:3,y:11,a:0,crop:{left:50,tended:false}};w.parts.push(rack);
    drugEffects.neon=50;drugEffects.neonIn=3;startGame('workshop','workshop','');
    loop(t0+50);
    const running={growth:rack.crop.left,drug:drugEffects.neon};
    paused=true;loop(t0+50);
    return {running,paused:{growth:rack.crop.left,drug:drugEffects.neon}};
  });
  assert.ok(state.running.growth<50);assert.ok(state.running.drug<50);
  assert.deepEqual(state.paused,state.running);
}));

test('both presenters show distinct effects, combine them, and restore the untouched image at zero strength',()=>fixture(async page=>{
  const results=await page.evaluate(()=>{
    const results=[];
    for(const webgl of [false,true]) {
      GLP_OFF=!webgl;GLP_SOFT=true;
      for(let i=0;i<CH.length;i++){CH[i]='#';COL[i]=C(i%cols<cols/2?MAG:CYAN,13);BG[i]=C(GRAY,1);FOGS[i]=FOGB[i]=0;}
      clearDrugEffects();present();const sober=frameCanvas().toDataURL();
      settings.tripVisuals=1;drugEffects.weed=60;drugEffects.weedIn=3;present();drawDrugVision();const weed=frameCanvas().toDataURL();
      clearDrugEffects();drugEffects.neon=60;drugEffects.neonIn=3;T=15;present();drawDrugVision();const neon=frameCanvas().toDataURL();
      drugEffects.weed=60;drugEffects.weedIn=3;present();drawDrugVision();const mixed=frameCanvas().toDataURL();
      settings.tripVisuals=0;present();drawDrugVision();const off=frameCanvas().toDataURL();
      results.push({webgl:!!GLP,sober:!!sober,weed:weed!==sober,neon:neon!==sober,distinct:weed!==neon,mixed:mixed!==neon,restored:off===sober});
    }
    return results;
  });
  for(const r of results) assert.deepEqual({...r,webgl:false},{webgl:false,sober:true,weed:true,neon:true,distinct:true,mixed:true,restored:true});
  if(process.env.CITY_TEST_BROWSER!=='firefox')assert.equal(results[1].webgl,true,'exercise the actual WebGL presenter');
}));

test('phone workshop and drug-visual settings fit and persist',()=>fixture(async page=>{
  await page.evaluate(()=>openWorkshop());await page.locator('[data-rack]').click();
  const fit=await page.locator('#workshop .panel').evaluate(el=>({right:el.getBoundingClientRect().right,width:innerWidth,scroll:el.scrollWidth<=el.clientWidth+1}));
  assert.ok(fit.right<=fit.width);assert.equal(fit.scroll,true);
  await page.evaluate(()=>{hidePanel(workshopEl);openPause();});
  await page.locator('[data-set="tripVisuals"]').fill('0.35');
  await page.reload();assert.equal(await page.evaluate(()=>settings.tripVisuals),.35);
},true));
