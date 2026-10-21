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
async function atHome(fn,mobile=false) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});await page.goto(PAGE);
    await page.evaluate(()=>{
      paused=false;mode='walk';room=me=null;[px,py]=citySourcePoint(41,73);T=10;tod=12;env(0);render(0);money=5000;
      const purchase=buy('home_studio');if(!purchase[0])throw new Error(purchase[1]);
      const h=owned.homes[0],def=ROOM_DEFS.home;
      enterRoom('home',{cell:[h.cell%N,Math.floor(h.cell/N)],ret:[...citySourcePoint(41,73),0]},def.entry);env(0);render(0);
      px=def.spots.workshop[0];py=def.spots.workshop[1];a=Math.PI;clearInventory();
    });
    await fn(page);assert.deepEqual(errors,[]);
  } finally {await page.close();}
}
async function setUp(page) {
  await page.keyboard.press('KeyE');
  await page.locator('#workshop [data-kit]').click();
  await page.locator('#workshop [data-place="bench"]').click();
  const p=await page.evaluate(()=>{px=3.75;py=13;a=-Math.PI/2;return workshopCandidate();});
  assert.equal(p.ok,true,JSON.stringify(p));await page.keyboard.press('KeyE');
  for(const id of ['processor','packer']) {
    await page.evaluate(()=>{openWorkshop();});await page.locator(`[data-place="${id}"]`).click();await page.keyboard.press('KeyE');
  }
  await page.evaluate(()=>openWorkshop());await page.locator('[data-power]').click();
  assert.equal(await page.evaluate(()=>workshopCanRun(homeRecord(),workshopState(homeRecord()).parts[0])), '');
}
test('the starter crate is unpacked into real collision furniture and runs a playable batch; sales use carried stock and witnesses',()=>atHome(async page=>{
  await setUp(page);
  const layout=await page.evaluate(()=>({size:[room.W,room.H],parts:workshopState(homeRecord()).parts.map(p=>p.id),blocked:roomOpen(3.75,11.25),aisle:roomOpen(7,12),stock:workshopState(homeRecord()).supplies}));
  assert.deepEqual(layout.size,[14,15]);assert.deepEqual(layout.parts,['bench','processor','packer']);assert.equal(layout.blocked,false);assert.equal(layout.aisle,true);assert.equal(layout.stock,3);
  await page.locator('[data-run]').click();
  const r=await page.evaluate(()=>{
    const w=workshopState(homeRecord());drawGame();
    for(let n=0;n<1100&&!game.g.over;n++){
      const s=game.g.state(),m=s.current;game.g.step(1/30,{act:s.heat<.55,upP:m?.key==='up',downP:m?.key==='down'});
    }
    stepGame(0);const packets=drugCount();stepGame(0);return {packets,afterRepeatedFinish:drugCount(),supplies:w.supplies,quality:inv.at(-1).q,buyer:!!drugBuyer};
  });
  assert.equal(r.packets,6);assert.equal(r.afterRepeatedFinish,6);assert.equal(r.supplies,2);assert.equal(r.quality,'perfect');assert.equal(r.buyer,true);
  await page.keyboard.press('Space');
  await page.evaluate(()=>{leaveRoom();updateDrugBuyer();px=drugBuyer.x-.15;py=drugBuyer.y;a=0;for(const p of people)p.hidden=true;for(const c of cars)c.patrol=false;footCops.length=0;});
  assert.match(await page.evaluate(()=>promptText()),/Kit.*weed or Neon/);
  await page.keyboard.press('KeyE');
  assert.equal(await page.locator('[data-drug-sell]').count(),1,JSON.stringify(await page.evaluate(()=>({paused,game:!!game,sleep,stairs:elStairGround(px,py),tread:EL_TREAD,placement:workshopPlacement,workshop:workshopEl?.style.display,buyer:!!drugBuyer,prompt:promptText(),message:msgText}))));
  const before=await page.evaluate(()=>money);await page.locator('[data-drug-sell]').click();
  assert.equal((await page.evaluate(()=>money))-before,108);
  assert.equal(await page.evaluate(()=>wanted.stars),0);assert.equal(await page.evaluate(()=>drugBuyer),null);
  await page.evaluate(()=>{
    T+=21;carryItem({id:'neon',uses:4,q:'fine'});updateDrugBuyer();px=drugBuyer.x-.15;py=drugBuyer.y;a=0;
    footCops.push({x:px,y:py});
  });
  await page.keyboard.press('KeyE');await page.locator('[data-drug-sell]').click();
  assert.equal(await page.evaluate(()=>wanted.stars),1);assert.equal(await page.evaluate(()=>wanted.crime),'drug dealing');
}));

test('the buyer stands on open pavement with one small head marker',()=>atHome(async page=>{
  const result=await page.evaluate(()=>{
    const home=homeRecord();home.door=buyerDoor({...home,door:null});
    carryItem({id:'neon',uses:4,q:'fine'});leaveRoom();updateDrugBuyer();
    px=drugBuyer.x-.42;py=drugBuyer.y;a=0;env(0);render(0);
    CH.fill(' ');ZB.fill(Infinity);drawDrugBuyer();
    return {markers:CH.reduce((n,ch)=>n+(ch==='$'),0),blocked:!!map[idx(Math.floor(drugBuyer.x),Math.floor(drugBuyer.y))]};
  });
  assert.deepEqual(result,{markers:1,blocked:false});
}));
test('placement rejects the door aisle, can rotate/cancel, and packing up a bench returns all pieces',()=>atHome(async page=>{
  await setUp(page);
  await page.locator('[data-pack]').click();
  assert.deepEqual(await page.evaluate(()=>workshopState(homeRecord()).parts),[]);
  await page.locator('[data-place="bench"]').click();
  const bad=await page.evaluate(()=>{px=7;py=13;a=-Math.PI/2;return workshopCandidate();});assert.equal(bad.ok,false);assert.match(bad.reason,/aisle/);
  await page.keyboard.press('KeyQ');assert.ok(await page.evaluate(()=>workshopPlacement.a>1));
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>workshopPlacement),null);
  assert.equal(await page.evaluate(()=>workshopState(homeRecord()).parts.length),0);
}));
test('workshop, product quality and expanded bulk storage survive a reload; stored stock can attract a waiting buyer',()=>atHome(async page=>{
  await setUp(page);
  await page.evaluate(()=>{
    hidePanel(workshopEl);closet.length=0;for(let n=0;n<100;n++)closet.push({id:'book',uses:0});
    carryItem({id:'neon',uses:4,q:'perfect'});openStorage(closet,'your closet','Your closet','120 spaces',null,HOME_STORE_SIZE);
  });
  await page.locator('[data-store-all]').click();
  assert.equal(await page.evaluate(()=>closet.length),101);assert.equal(await page.evaluate(()=>drugCount()),0);
  await page.evaluate(()=>{drugDemand.next=T+20;drugDemand.until=0;updateDrugBuyer();saveGame();});assert.equal(await page.evaluate(()=>drugBuyer),null);
  const expected=await page.evaluate(()=>owned.homes[0].workshop);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>owned.homes[0].workshop),expected);
  assert.equal(await page.evaluate(()=>closet.length),101);assert.deepEqual(await page.evaluate(()=>closet.at(-1)),{id:'neon',uses:4,q:'perfect'});
  const waiting=await page.evaluate(()=>{
    const random=Math.random;Math.random=()=>0;
    try{drugDemand.next=T;updateDrugBuyer();}finally{Math.random=random;}
    return {buyer:!!drugBuyer,carried:drugCount()};
  });
  assert.deepEqual(waiting,{buyer:true,carried:0});
  await page.evaluate(()=>{px=drugBuyer.x-.15;py=drugBuyer.y;a=0;interact();});
  assert.match(await page.locator('#drug-sale .panel').innerText(),/closet/);assert.equal(await page.evaluate(()=>closet.length),101);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{retrieveSlot(closet.length-1,closet,'your closet');updateDrugBuyer();});assert.equal(await page.evaluate(()=>!!drugBuyer),true);
}));
test('touch has placement and batch controls and can stop a batch without using supplies',()=>atHome(async page=>{
  await setUp(page);
  await page.locator('[data-run]').click();
  await page.evaluate(()=>showTouch());
  assert.deepEqual(await page.locator('#touch .pad button').allTextContents(),['Stop','Vent','Seal','Power (hold)']);
  await page.locator('#touch .pad [data-key="KeyE"]').dispatchEvent('touchstart');
  await page.locator('#touch .pad [data-key="KeyE"]').dispatchEvent('touchend');
  assert.equal(await page.evaluate(()=>game),null);assert.equal(await page.evaluate(()=>workshopState(homeRecord()).supplies),3);
},true));

test('each apartment has a usable workshop bay and a clear entrance; rotated equipment survives restoration',()=>atHome(async page=>{
  const results=await page.evaluate(()=>{
    const home=homeRecord(), results=[];
    for(const id of ['home_studio','home_loft','home_belle']){
      home.kind=id;home.workshop=undefined;
      const kind=homeRoomKind(id),def=ROOM_DEFS[kind];enterRoom(kind,{cell:[home.cell%N,Math.floor(home.cell/N)],ret:[...citySourcePoint(41,73),0]},def.entry);
      buyWorkshopKit(home);px=3.75;py=room.H-2;a=-Math.PI/2;
      beginWorkshopPlacement('bench');const fits=workshopCandidate().ok;placeWorkshopPart();
      for(const part of ['processor','packer']){beginWorkshopPlacement(part);if(part==='processor')workshopKey({code:'KeyQ'});placeWorkshopPart();}
      const w=workshopState(home),restored=restoreWorkshop(w,id);
      env(0);render(0);
      results.push({id,fits,parts:restored.parts.length,rotation:restored.parts.find(p=>p.id==='processor')?.a,aisle:roomOpen(def.entry[0],room.H-2)});
    }
    return results;
  });
  for(const r of results){assert.equal(r.fits,true,r.id);assert.equal(r.parts,3,r.id);assert.equal(r.rotation,Math.PI/2,r.id);assert.equal(r.aisle,true,r.id);}
}));
