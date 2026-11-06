'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;
test.before(async()=>browser=await chromium.launch());
test.after(async()=>browser?.close());
async function fixture(width,height,run){
 const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>{requestAnimationFrame=()=>0;HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{
   tod=14;env(0);render(0);paused=false;mode='walk';room=null;freecam=null;money=1000;
   clearInventory();carryItem({id:'f_recordplayer',uses:0});carryItem({id:'water',uses:3});held=0;
   openInventory();showTouch();
  });
  await p.evaluate(()=>document.fonts.ready);
  await run(p);assert.deepEqual(errors,[]);
 }finally{await p.close();}
}
async function targets(p,selector){
 return p.locator(selector).evaluateAll(els=>els.map(el=>{
  const r=el.getBoundingClientRect(),panel=el.closest('.panel').getBoundingClientRect();
  return {name:el.getAttribute('aria-label')||el.textContent.trim(),width:r.width,height:r.height,
   inside:r.left>=panel.left&&r.right<=panel.right&&r.left>=0&&r.right<=innerWidth};
 }));
}
for(const [width,height] of [[390,844],[320,568],[844,390]]){
 test(`phone ${width}×${height}: long inventory names and independent slot/drop controls fit, have thumb targets and work by touch`,()=>fixture(width,height,async p=>{
  const controls=await targets(p,'#inventory .carry-row button, #inventory .carry-row select');
  for(const c of controls){assert.ok(c.height>=44&&c.width>=44,JSON.stringify(c));assert.ok(c.inside,JSON.stringify(c));}
  const name=await p.locator('#inventory [data-slot="0"] span').nth(1).evaluate(el=>{
   const name=el.getBoundingClientRect(),row=el.closest('.carry-row').getBoundingClientRect();
   return {text:el.textContent,height:name.height,width:name.width,rowWidth:row.width,unclipped:el.scrollWidth<=el.clientWidth+1};
  });
  assert.match(name.text,/record player with cabinet and record flatpack/);
  assert.ok(name.width>name.rowWidth*.65&&name.height<100&&name.unclipped,JSON.stringify(name));
  await p.locator('#inventory [data-quick-item="0"]').selectOption({value:'3'});
  assert.equal(await p.evaluate(()=>quickSlots[3]),0);
  await p.locator('#inventory [data-slot="1"]').tap();assert.equal(await p.evaluate(()=>held),1);
  await p.locator('#inventory [data-drop="0"]').tap();
  assert.deepEqual(await p.evaluate(()=>({ids:inv.map(it=>it.id),held:heldItem()?.id,dropped:dropped.at(-1)?.id})),{ids:['water'],held:'water',dropped:'f_recordplayer'});
  await p.evaluate(()=>showTouch());await p.locator('#touch .pad [data-key="KeyE"]').tap();
  assert.equal(await p.evaluate(()=>paused),false);
  await p.evaluate(()=>{openShop('RECORDS',['f_recordplayer','vinyl']);showTouch();});
  for(const c of await targets(p,'#shop [data-buy]')){assert.ok(c.height>=44&&c.width>=44,JSON.stringify(c));assert.ok(c.inside,JSON.stringify(c));}
  const before=await p.evaluate(()=>money);
  await p.locator('#shop [data-buy="f_recordplayer"]').tap();
  assert.deepEqual(await p.evaluate(before=>({bought:inv.some(it=>it.id==='f_recordplayer'),paid:before-money}),before),{bought:true,paid:180});
  await p.locator('#touch .pad [data-key="KeyE"]').tap();assert.equal(await p.evaluate(()=>paused),false);
 }));
}
test('desktop inventory keeps its compact single-row layout',async()=>{
 const p=await browser.newPage({viewport:{width:1170,height:800}});
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{tod=14;env(0);render(0);clearInventory();carryItem({id:'water',uses:3});openInventory();const row=invEl.querySelector('.carry-row');return {display:getComputedStyle(row).display,selectHeight:row.querySelector('select').getBoundingClientRect().height};});
  assert.equal(r.display,'flex');assert.ok(r.selectHeight<44);
 }finally{await p.close();}
});
