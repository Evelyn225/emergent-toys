'use strict';
// Dev tools > Other > Watch a simulated match: the engine (match-engine.js) drawn top-down, its scoreboard, the
// commentary and stats keeping up with it, speed controls, and the game paused underneath.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('the simulated match opens from dev tools, plays, and its board keeps up',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);openDev();devTab='other';renderDev(false);});
  await p.locator('#dev button',{hasText:'Watch a simulated match'}).click();
  const r=await p.evaluate(()=>{const m=matchDebug.m;MatchEngine.step(m,200);drawMatchDebug(m);
   const cv=matchDebugEl.querySelector('canvas'),box=cv.getBoundingClientRect(),px=cv.getContext('2d').getImageData(cv.width/2,8,1,1).data;
   return{open:matchDebugOpen(),paused,score:matchDebugEl.querySelector('.score').textContent,log:matchDebugEl.querySelector('.log').textContent.split('\n').length,
    stats:matchDebugEl.querySelector('.stats').textContent.includes('possession'),grass:px[1]>px[0]&&px[1]>px[2],inPanel:getComputedStyle(cv).position!=='fixed'&&box.top>0,
    min:MatchEngine.minute(m),names:m.teams.map(t=>t.name)};});
  assert.equal(r.open,true);assert.equal(r.paused,true,'the game waits underneath');
  assert.ok(r.score.includes(r.names[0])&&r.score.includes(r.names[1])&&/\d+'|HT|FT/.test(r.score),r.score);
  assert.ok(r.min>20,'it played on');assert.ok(r.log>=3,'commentary');assert.ok(r.stats);assert.ok(r.grass,'the pitch is drawn');assert.ok(r.inPanel,'inside its panel, not over the screen');
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>matchDebugOpen()||paused),false,'Esc closes it and the game carries on');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
