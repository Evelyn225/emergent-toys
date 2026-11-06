'use strict';
// Start over (the pause menu) wipes the game: the money, what you carry, your homes. Leaving the page as it reloads
// used to save the old game straight back.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('start over really starts over',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.waitForFunction(()=>typeof saveGame==='function'&&worldReady);
  const fresh=await p.evaluate(()=>({money,inv:inv.length,homes:owned.homes.length}));
  await p.evaluate(()=>{money=98765;clearInventory();carryItem({id:'vhs',uses:1});const r=buy('home_studio');saveGame();return r;});
  const before=await p.evaluate(()=>({money,inv:inv.length,homes:owned.homes.length}));
  assert.ok(before.money!==fresh.money&&before.inv>0&&before.homes>0,'something to lose '+JSON.stringify(before));
  await Promise.all([p.waitForEvent('load'),p.evaluate(()=>newGame())]);
  await p.waitForFunction(()=>typeof saveGame==='function'&&worldReady);
  const after=await p.evaluate(()=>({money,inv:inv.length,homes:owned.homes.length}));
  assert.deepEqual(after,fresh,'back to a fresh start');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
