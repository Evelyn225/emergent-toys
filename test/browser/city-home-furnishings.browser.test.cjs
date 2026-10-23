'use strict';const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await p.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=26;tod=12;money=30000;body.z=body.vz=0;[px,py]=FERN_HOUSE.door;buyProperty('home_island',px,py);interact();px=18;py=19;a=0;pitch=0;env(0);render(0);});await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
test('IDEA has a real open store, sells furniture and shark, and furniture can be placed, switched, moved and packed with real controls',()=>fixture(async p=>{
 assert.ok(await p.evaluate(()=>{const place=Array.from(CITY_PLACES.values()).find(p=>p.shop.word==='IDEA');return place&&place.shop.kind!==SHOP_SHUT&&openAt(place.shop,12)&&STOCK_WORD.IDEA.includes('sharkplush');}));
 await p.evaluate(()=>{const ret=room.ret;enterRoom('idea',{word:'IDEA',ret},[9,3.8,-Math.PI/2]);render(0);});await p.keyboard.press('e');await p.locator('[data-buy="f_lamp"]').click();await p.keyboard.press('e');
 await p.evaluate(()=>{[px,py]=FERN_HOUSE.door;mode='walk';room=null;interact();px=18;py=19;a=0;pitch=0;held=inv.findIndex(i=>i.id==='f_lamp');render(0);});
 await p.keyboard.press('q');assert.ok(await p.evaluate(()=>furnishingPlacement&&furnishingCandidate().ok));await p.keyboard.press('q');await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts.length),1);
 await p.evaluate(()=>{const part=homeFurnishings(homeRecord()).parts[0];px=part.x;py=part.y+1.1;a=-Math.PI/2;pitch=0;render(0);});assert.match(await p.evaluate(()=>promptText()),/lamp off/);await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].on),false);
 await p.keyboard.press('f');await p.locator('[data-move="1"]').click();await p.evaluate(()=>{px=18;py=20;a=0;render(0);});await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].y),20);
 await p.evaluate(()=>refreshWorkshopRoom());assert.ok(await p.evaluate(()=>room.props.some(q=>q.furnishingKey===1)),'workshop refresh keeps placed furnishings');
 await p.keyboard.press('f');await p.locator('[data-pack="1"]').click();assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts.length),0);assert.ok(await p.evaluate(()=>inv.some(i=>i.id==='f_lamp'&&i.furnishing.on===false)));await p.keyboard.press('e');
 await p.reload();assert.ok(await p.evaluate(()=>inv.some(i=>i.id==='f_lamp'&&i.furnishing.on===false)),'packed switch state survives reload');
}));
test('camera photographs can be hung in a real frame, selected with E, and survive saving and re-entering Fern House',()=>fixture(async p=>{
 await p.evaluate(()=>{buy('camera');render(0);});await p.keyboard.press('q');assert.equal(await p.evaluate(()=>homePhotos.photos.length),1);
 await p.evaluate(()=>{buy('f_frame');px=22.2;py=20;a=0;pitch=0;render(0);});await p.keyboard.press('q');assert.ok(await p.evaluate(()=>furnishingCandidate().ok));await p.keyboard.press('e');
 await p.evaluate(()=>{px=21.7;py=20;a=0;pitch=0;render(0);});assert.match(await p.evaluate(()=>promptText()),/photograph/);await p.keyboard.press('e');await p.locator('[data-photo="1"]').click();assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].photo),1);
 await p.reload();assert.equal(await p.evaluate(()=>homePhotos.photos.length),1);await p.evaluate(()=>{paused=false;mode='walk';room=null;[px,py]=FERN_HOUSE.door;interact();env(0);render(0);});assert.equal(await p.evaluate(()=>homeFurnishings(homeRecord()).parts[0].photo),1);
 assert.ok(await p.evaluate(()=>JSON.stringify(homePhotos).length<25000));
}));
test('fixed lamps switch independently and record player music fades with distance and stops at the switch',()=>fixture(async p=>{
 await p.evaluate(()=>{const [x,y]=room.def.lamps[0];px=x;py=y+1.5;a=-Math.PI/2;pitch=((room.def.height-.65-eye)/1.5)*projY/rows;render(0);});assert.match(await p.evaluate(()=>promptText()),/lamp off/);await p.keyboard.press('e');
 assert.ok(await p.evaluate(()=>homeRecord().lights.fixed0===false&&homeRecord().lights.fixed1!==false));
 await p.evaluate(()=>{buy('f_recordplayer');px=18;py=20;a=0;pitch=0;render(0);useHeldItem();confirmFurnishingPlacement();const q=homeFurnishings(homeRecord()).parts[0];px=q.x;py=q.y+1.2;a=-Math.PI/2;pitch=-.45;render(0);});assert.match(await p.evaluate(()=>promptText()),/play record/);await p.keyboard.press('e');
 const gain=await p.evaluate(()=>{const near=homeRecordAudio().gain;px-=6;const far=homeRecordAudio().gain;return {near,far};});assert.ok(gain.near>gain.far*2);
 await p.evaluate(()=>{const q=homeFurnishings(homeRecord()).parts[0];px=q.x;py=q.y+1.2;a=-Math.PI/2;pitch=-.45;render(0);});await p.keyboard.press('e');assert.equal(await p.evaluate(()=>homeRecordAudio()),null);
}));
