'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const URL=pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href+'?net=local';
let browser;
test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function open(ctx){const p=await ctx.newPage();await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(URL);return p;}
test('customization has a real preview, saves across reloads and matches the local skater and hands',async()=>{
 const ctx=await browser.newContext({viewport:{width:1100,height:800}}),p=await open(ctx),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.evaluate(()=>openPause());await p.locator('[data-act="appearance"]').click();
  const preview=()=>p.locator('#appearance canvas').evaluate(c=>c.toDataURL());const before=await preview();
  for(const [key,value]of [['skin','6'],['headwear','2'],['hairStyle','6'],['hairColour','4'],['shirtStyle','1'],['top','5'],['bot','2'],['shoes','3']])await p.locator(`[data-look="${key}"]`).selectOption(value);
  assert.notEqual(await preview(),before);assert.ok(await p.locator('[data-look="hat"]').isDisabled());
  const front=await preview();await p.getByRole('button',{name:'Turn character right'}).click();assert.notEqual(await preview(),front);
  const result=await p.evaluate(()=>({saved:JSON.parse(localStorage.getItem(PLAYER_APPEARANCE_KEY)),shirt:skaterLook().col.top,skin:skaterLook().col.skin,hand:playerSkinColour(),hat:skaterLook().hat}));
  assert.equal(result.saved.skin,6);assert.equal(result.saved.top,5);assert.equal(result.hat,null);
  assert.deepEqual(result.shirt,await p.evaluate(()=>[NET_COLOURS[5],7]));assert.equal(result.hand,await p.evaluate(()=>C(...FIG_SKINS[6])));
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>appearanceOpen()),false);assert.equal(await p.evaluate(()=>paused),true);
  await p.reload();assert.deepEqual(await p.evaluate(()=>playerAppearance),result.saved);
  await p.evaluate(()=>openAppearance());
  await p.locator('[data-appearance-random]').click();assert.equal(await p.evaluate(()=>playerAppearance.skin),6);assert.equal(await p.evaluate(()=>playerAppearance.hairStyle),6);
  await p.setViewportSize({width:390,height:844});
  assert.ok(await p.locator('[data-look="skin"]').isVisible());assert.equal(await p.locator('#appearance .panel').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await p.evaluate(()=>controllerMenuBack(appearanceEl));assert.equal(await p.evaluate(()=>appearanceOpen()),false);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
test('two players see saved outfits on join and live changes without reconnecting',async()=>{
 const ctx=await browser.newContext(),a=await open(ctx),b=await open(ctx),errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
 try{
  await a.evaluate(()=>setPlayerAppearance({...appearanceDefault(),top:4,skin:5,headwear:1,hairStyle:4,shirtStyle:3}));
  const code='appearance-'+Date.now();await a.evaluate(code=>netJoin(code,'Ann'),code);await b.evaluate(code=>netJoin(code,'Bob'),code);
  await b.waitForFunction(()=>[...net.peers.values()].some(p=>p.name==='Ann'&&p.hello.look.custom===1),null,{polling:100});
  const first=await b.evaluate(()=>{const p=[...net.peers.values()].find(p=>p.name==='Ann');window.oldLook=netFigLook(p);return {look:p.hello.look,hat:oldLook.hat,shirt:oldLook.top};});
  assert.equal(first.look.top,4);assert.equal(first.hat,'cap');assert.equal(first.shirt,'jacket');
  await a.evaluate(()=>openAppearance('multiplayer'));await a.locator('[data-look="top"]').selectOption('6');await a.locator('[data-look="headwear"]').selectOption('2');
  await b.waitForFunction(()=>[...net.peers.values()].some(p=>p.name==='Ann'&&p.hello.look.top===6&&p.hello.look.headwear===2),null,{polling:100});
  assert.equal(await b.evaluate(()=>netFigLook([...net.peers.values()].find(p=>p.name==='Ann'))===oldLook),false);
  assert.equal(await b.evaluate(()=>netFigLook([...net.peers.values()].find(p=>p.name==='Ann')).hat),null);
  await a.evaluate(()=>netLeave());await a.evaluate(code=>netJoin(code,'Different name'),code);
  await b.waitForFunction(()=>[...net.peers.values()].some(p=>p.name==='Different name'&&p.hello.look.top===6),null,{polling:100});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
