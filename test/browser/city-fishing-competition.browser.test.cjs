'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch();});
test.after(async()=>{await browser?.close();});
async function fixture(run,phone=false){
  const page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1280,height:720},hasTouch:phone}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
    await page.evaluate(()=>{
      lockMouse=()=>{};paused=false;mode='walk';room=me=null;body.z=body.vz=0;body.seat=null;
      dayNum=4;tod=23.99;T=10;weather='clear';rain=wet=snowCover=0;money=100;clearWanted();
      px=FISH_HUT.x+FISH_HUT.hatch;py=FISH_HUT.y-FISH_HUT.hw-.2;a=Math.PI/2;
      clearInventory();carryItem({id:'rod',uses:0});env(0);render(0);
    });
    await run(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
}
async function join(page){await page.keyboard.press('KeyE');await page.locator('[data-fish-join]').click();}

test('Friday entry opens at a closed tackle hatch, is searchable and reachable, and a late entrant gets the full round',()=>fixture(async page=>{
  const place=await page.evaluate(()=>{
    const p=mapDirectory().find(p=>p.id==='friday-fish-off');return {free:free(p.x,p.y),water:isWater(p.x,p.y),status:p.status,description:p.description,event:eventNow('fishing-competition'),started:fishCompetition.round};
  });
  assert.equal(place.free,true);assert.equal(place.water,false);assert.equal(place.event,true);assert.equal(place.started,null);assert.match(place.description,/Join any time Friday/);
  assert.match(await page.evaluate(()=>promptText()),/E: Friday Fish-off/);
  await join(page);
  assert.deepEqual(await page.evaluate(()=>({left:fishCompetition.round.left,paused,panel:panelOpen(),money})),{left:300,paused:false,panel:false,money:100});
  await page.evaluate(()=>{loop(t0+50);});
  const r=await page.evaluate(()=>({day:dayNum,left:fishCompetition.round.left,status:fishingCompetitionStatus()}));
  assert.ok(r.left<300&&r.left>299);assert.match(r.status,/FISH-OFF/);
  await page.evaluate(()=>{dayNum=5;tod=1;stepFishingCompetition(20);});
  assert.ok(await page.evaluate(()=>fishCompetition.round.left)>279);
}));

test('fresh casts score through real fishing controls and automatic weighing still works when the bag is full',()=>fixture(async page=>{
  await join(page);
  await page.evaluate(()=>{
    const o=ANGLERS.find(o=>free(o.x,o.y)&&[.7,1,1.3,1.6,1.9].every(d=>waterKind(o.x+Math.cos(o.a)*d,o.y+Math.sin(o.a)*d)==='sea'));
    if(!o)throw new Error('No clear bay fishing spot');px=o.x;py=o.y;a=o.a;pitch=0;body.z=outdoorGroundHeight(px,py);
    while(inv.length<INV_SIZE)carryItem({id:'book',uses:0},false);
  });
  await page.keyboard.down('KeyQ');await page.evaluate(()=>{stepFishing(.7);});await page.keyboard.up('KeyQ');
  await page.evaluate(()=>{stepFishing(.01);stepFishing(2);fishing.next=0;stepFishing(.01);stepFishing(3);});
  assert.equal(await page.evaluate(()=>fishing.st),'bite');await page.keyboard.press('KeyQ');
  const r=await page.evaluate(()=>{
    fishing.catch={id:'conger',kg:9};stepFishing(4);
    return {best:fishCompetition.round.best,count:fishCompetition.round.count,carried:inv.some(it=>it.id==='conger'),line:msgText,castDay:fishing.competitionDay};
  });
  assert.deepEqual(r.best,{id:'conger',kg:9});assert.equal(r.count,1);assert.equal(r.carried,false);assert.equal(r.castDay,4);assert.match(r.line,/competition best/);
}));

test('menus freeze the round, saves resume remaining time, and a prize is collected only once after midnight',()=>fixture(async page=>{
  await join(page);
  await page.evaluate(()=>{stepFishingCompetition(100);openFishingCompetition();loop(t0+50);});
  assert.equal(await page.evaluate(()=>fishCompetition.round.left),200);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{recordFishingCompetitionCatch({competitionDay:4,catch:{id:'conger',kg:14}});saveGame();});
  await page.reload();
  assert.equal(await page.evaluate(()=>fishCompetition.round.left),200);assert.equal(await page.evaluate(()=>fishCompetition.round.best.kg),14);
  const r=await page.evaluate(()=>{
    lockMouse=()=>{};paused=false;dayNum=5;tod=2;const line=stepFishingCompetition(200);
    px=FISH_HUT.x+FISH_HUT.hatch;py=FISH_HUT.y-FISH_HUT.hw-.2;a=Math.PI/2;mode='walk';
    return {line,prize:fishingCompetitionPrize(),prompt:promptText()};
  });
  assert.equal(r.prize,250);assert.match(r.prompt,/Friday Fish-off/);assert.match(r.line,/Time!/);
  await page.keyboard.press('KeyE');await page.locator('[data-fish-claim]').click();
  assert.equal(await page.evaluate(()=>money),350);assert.equal(await page.evaluate(()=>fishCompetition.wins),1);
  assert.equal(await page.locator('[data-fish-claim]').count(),0);
  await page.reload();assert.equal(await page.evaluate(()=>money),350);assert.equal(await page.evaluate(()=>fishCompetition.round.claimed),true);
  assert.equal(await page.evaluate(()=>claimFishingCompetition()[0]),false);
  assert.match(await page.evaluate(()=>{px=FISH_HUT.x+FISH_HUT.hatch;py=FISH_HUT.y-FISH_HUT.hw-.2;mode='walk';return promptText();}),/Friday Fish-off/);
}));

test('the normal tackle counter keeps rod number shortcuts and refreshes its competition link after buying',()=>fixture(async page=>{
  await page.evaluate(()=>{tod=11;clearInventory();});await page.keyboard.press('KeyE');
  assert.equal(await page.locator('[data-buy="rod"]').count(),1);assert.equal(await page.locator('[data-fish-competition]').count(),1);
  await page.keyboard.press('Digit1');assert.equal(await page.evaluate(()=>heldItem().id),'rod');
  assert.equal(await page.locator('[data-fish-competition]').count(),1);await page.keyboard.press('KeyF');
  assert.equal(await page.locator('#fishing-competition').isVisible(),true);assert.equal(await page.locator('#shop').isVisible(),false);
  await page.locator('[data-fish-join]').click();assert.equal(await page.evaluate(()=>fishCompetition.round.left),300);
}));

test('the hut keeps its tackle sign and displays a readable Friday competition notice',()=>fixture(async page=>{
  const text=await page.evaluate(()=>{
    px=FISH_HUT.x;py=FISH_HUT.y-1.6;a=Math.PI/2;pitch=.015;tod=18;env(0);render(0);
    return CH.join('');
  });
  assert.ok(text.includes('FRIDAY FISH-OFF'));assert.ok(text.includes('BAIT & TACKLE'));
}));

test('phone entry and result menus fit without horizontal scrolling and touch closes and resumes the round',()=>fixture(async page=>{
  await page.evaluate(()=>showTouch());assert.ok((await page.locator('#touch .pad button').allTextContents()).includes('Fish-off'));
  await page.locator('#touch .pad [data-key="KeyE"]').dispatchEvent('touchstart');await page.locator('#touch .pad [data-key="KeyE"]').dispatchEvent('touchend');
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    const fit=await page.locator('#fishing-competition .panel').evaluate(el=>({right:el.getBoundingClientRect().right,width:innerWidth,scroll:el.scrollWidth<=el.clientWidth+1}));
    assert.ok(fit.right<=fit.width);assert.equal(fit.scroll,true);
  }
  await page.locator('[data-fish-join]').click();await page.evaluate(()=>{stepFishingCompetition(300);openFishingCompetition();});
  assert.equal(await page.locator('[data-fish-claim]').count(),1);await page.locator('[data-fish-claim]').click();
  await page.locator('[data-fish-close]').click();assert.equal(await page.evaluate(()=>paused),false);
},true));
