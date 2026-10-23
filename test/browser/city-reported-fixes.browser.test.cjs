'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function fixture(run){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
  await page.addInitScript(()=>requestAnimationFrame=()=>0);
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  await page.evaluate(()=>{paused=false;clearWanted();mode='walk';room=me=null;T=10;body.z=body.vz=0;[px,py]=citySourcePoint(41,73);env(0);});
  await run(page);assert.deepEqual(errors,[]);
}finally{await page.close();}}

test('cooking keeps a pending action visible during heat changes and keeps results through heat presses',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const cases=[];
    for(const hot of [false,true]){
      const g=GAMES.cook(()=>.5,'',{recipe:'panfish'});let pending=false;
      for(let n=0;n<3000;n++) {g.step(1/60,{act:hot?1:0,downP:1});if(g.state().moves.some(m=>m.state==='now'&&m.key==='up')){pending=true;break;}}
      if(!pending)throw Error('flip never became due');
      for(let n=0;n<30;n++) {
        const text=[];g.draw(()=>{},(x,y,s)=>text.push({y,s}),()=>{},()=>{});
        cases.push({hot,text});g.step(1/60,{act:hot?1:0});
      }
    }
    return cases;
  });
  for(const q of r){assert.ok(q.text.some(t=>/FLIP IT/.test(t.s)),JSON.stringify(q));assert.ok(q.text.some(t=>/TOO (HOT|COOL)/.test(t.s)&&t.y!==2));}
  await page.evaluate(()=>{
    startGame('cook','cook','',{recipe:'panfish'});window.cookFinishes=0;game.onDone=()=>cookFinishes++;
    for(let n=0;n<5000&&!game.g.over;n++)game.g.step(1/60,{act:1});stepGame(1/60);
  });
  for(const code of ['Space','Enter','Space'])await page.keyboard.press(code);
  assert.deepEqual(await page.evaluate(()=>{T+=60;stepGame(1/60);return{over:game?.g.over,finishes:cookFinishes};}),{over:true,finishes:1});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>game),null);
}));

test('a flip charged before the first board frame survives stepping onto the skateboard',()=>fixture(async page=>{
  await page.evaluate(()=>{clearInventory();carryItem({id:'skateboard',uses:0});held=0;fx.skating=true;SK.lastT=-9;});
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('Space');
  assert.equal(await page.evaluate(()=>{T+=1/60;stepSkate(1/60);return SK.charge>=0;}),true);
  await page.keyboard.up('Space');await page.keyboard.up('ArrowLeft');
  assert.equal(await page.evaluate(()=>body.trick?.name),'kickflip');
  assert.ok(await page.evaluate(()=>body.vz)>0);
}));

test('airport approach posts stand beside the road and their glow and spatial indexes follow them',()=>fixture(async page=>{
  const r=await page.evaluate(()=>{
    const inApproach=o=>Math.abs(o.x-CAUSEWAY.x)<CAUSEWAY.hw&&o.y>=CAUSEWAY.y1-2&&o.y<=CAUSEWAY.y1+3;
    const near=lamps.filter(l=>Math.abs(l.x-CAUSEWAY.x)<3&&Math.abs(l.y-CAUSEWAY.y1)<4);
    return {blocked:[...lamps,...lights].filter(inApproach).map(p=>[p.x,p.y]),count:near.length,
      indexed:near.every(l=>lampsB[bi(Math.floor(l.x/8),Math.floor(l.y/8))].includes(l)&&lampGlowCells[idx(l.gx,l.gy)]?.includes(l)),
      stale:lampGlowCells.some(cell=>cell?.some(l=>!lamps.includes(l))),
      duplicate:near.some(l=>near.some(q=>q!==l&&near2(l,q))),
      road:onCauseway(CAUSEWAY.x,CAUSEWAY.y1-.1)&&!!ROAD[idx(CAUSEWAY.x,CAUSEWAY.y1+.1)]};
    function near2(l,q){return Math.hypot(l.x-q.x,l.y-q.y)<.01;}
  });
  assert.deepEqual(r.blocked,[]);assert.ok(r.count>0&&r.indexed&&r.road,JSON.stringify(r));assert.equal(r.stale,false);assert.equal(r.duplicate,false);
}));
