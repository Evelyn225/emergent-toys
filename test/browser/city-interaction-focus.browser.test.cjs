'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.addInitScript(()=>requestAnimationFrame=()=>0);await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);await page.evaluate(()=>{paused=false;mode='walk';room=me=freecam=null;T=26;tod=12;body.z=body.vz=0;env(0);render(0);});await run(page);assert.deepEqual(errors,[]);}finally{await page.close();}}
test('aimed person beats the nearby shelter door, while looking down selects a dropped item at that same entrance',()=>fixture(async page=>{
 await page.evaluate(()=>{people.forEach(p=>p.hidden=true);const p=people[0];Object.assign(p,{x:492.25,y:392.3,hidden:false,dead:false,flee:0,down:false,talk:0});px=492;py=392.3;a=0;pitch=0;render(0);});
 assert.equal(await page.evaluate(()=>promptText()),'E: talk');await page.keyboard.press('e');assert.equal(await page.evaluate(()=>mode),'walk');assert.ok(await page.evaluate(()=>people[0].talk>0));
 await page.evaluate(()=>{people[0].hidden=true;dropped.push({id:'water',uses:4,x:492,y:392.22,at:'',z:0});px=492;py=392.45;a=-Math.PI/2;pitch=-.75;render(0);});
 assert.match(await page.evaluate(()=>promptText()),/pick up/);const count=await page.evaluate(()=>inv.length);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>mode),'walk');assert.equal(await page.evaluate(()=>inv.length),count+1);
}));
test('room customers are selectable beside the clerk; walls and furniture block sight and dropped items can beat the clerk',()=>fixture(async page=>{
 await page.evaluate(()=>{enterRoom('store',{word:'TEST',ret:[492,392.2,0],line:'keeper sentinel'},[5,5,Math.PI/2]);room.def={...room.def,keeper:[6,4]};room.props=[standing(6,4,WHITE),standing(5,5.9,BLUE)];pitch=0;render(0);});
 assert.equal(await page.evaluate(()=>promptText()),'E: talk');await page.keyboard.press('e');assert.ok(await page.evaluate(()=>!panelOpen()&&msgT>0));
 const occlusion=await page.evaluate(()=>{const open=interactionFocus()?.kind;room.props.push(BX(5,5.45,.6,.04,0,2.2,solid(BRICK)));const blocked=interactionFocus()?.kind;room.props.pop();room.grid=room.grid.map((row,y)=>y===5?row.slice(0,5)+'#'+row.slice(6):row);const wall=interactionFocus()?.kind;return{open,blocked,wall};});
 assert.equal(occlusion.open,'room-person');assert.notEqual(occlusion.blocked,'room-person');assert.notEqual(occlusion.wall,'room-person');
 await page.evaluate(()=>{room.grid=room.def.grid;room.props=[];dropped.push({id:'water',uses:4,x:5,y:5.7,at:placeKey(),z:0});pitch=-1.1;render(0);});
 assert.match(await page.evaluate(()=>promptText()),/pick up/);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>dropped.length),0);
}));
