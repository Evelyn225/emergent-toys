'use strict';
// The extras at the Yards ground (stadium-extras.js): a bet at the window paid at full time, a season ticket that lets
// you walk in, a club scarf in its colours and a programme with both line-ups (both kept in the save), and the kiosk.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function gates(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;dayNum+=mod(5-mod(dayNum,7),7);tod=14;money=1000;clearInventory();env(0);render(0);updateLeague();
  const b=stadiumBounds();px=(b.x0+b.x1)/2;py=b.y1+.25;a=-Math.PI/2;env(0);render(0);openStadiumTickets();});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a bet at the window, settled at full time at the odds shown',()=>gates(async p=>{
 const odds=await p.evaluate(()=>{const f=stadiumNextFixture(),o=matchOdds(f.home,f.away);return{o,f};});
 assert.ok(odds.o.home>1&&odds.o.draw>1&&odds.o.away>1);
 const sum=1/odds.o.home+1/odds.o.draw+1/odds.o.away;assert.ok(sum>1.05&&sum<1.15,'the house keeps a little: '+sum.toFixed(3));
 await p.locator('#tickets [data-x="bet:home:50"]').click();
 const r=await p.evaluate(()=>{const before=money,f=stadiumNextFixture(),bet=league.bets.find(b=>b.n===f.n);
  dayNum=Math.floor((f.kick+3)/24);tod=f.kick+3-dayNum*24;updateLeague();
  const res=league.results.find(x=>x.n===f.n&&x.home===f.home);return{before,after:money,bet,res,left:league.bets.length};});
 assert.equal(r.bet.stake,50);assert.equal(r.bet.odds,odds.o.home);assert.ok(r.res,'the result in');
 const won=r.res.score[0]>r.res.score[1];assert.equal(+(r.after-r.before).toFixed(2),won?+(50*odds.o.home).toFixed(2):0,'paid at the odds if it came in');
 assert.equal(r.left,0,'settled');
}));

test('a season ticket: the sections are free for the season',()=>gates(async p=>{
 await p.locator('#tickets [data-x="season"]').click();
 const before=await p.evaluate(()=>money);assert.equal(before,700);
 assert.match(await p.locator('#tickets [data-sec="main"]').innerText(),/season ticket/);
 await p.locator('#tickets [data-sec="main"]').click();
 assert.deepEqual(await p.evaluate(()=>[room?.kind,money]),['stadium',700],'in, without paying');
}));

test('a scarf in its club colours and a programme with the line-ups, both kept in the save; the kiosk inside',()=>gates(async p=>{
 const f=await p.evaluate(()=>stadiumNextFixture());
 await p.locator(`#tickets [data-x="scarf:${f.home}"]`).click();await p.locator('#tickets [data-x="programme"]').click();
 const r=await p.evaluate(()=>{const scarf=inv.find(i=>i.id==='scarf'),prog=inv.find(i=>i.id==='programme');
  const pic=DENSE.scarf(scarf),cols=new Set();for(const row of pic.cols||[])for(const c of row||[])cols.add(c>>4);
  return{scarfName:itemName(scarf),progName:itemName(prog),read:readProgramme(prog)[0],held:useScarf(scarf)[0]};});
 assert.match(r.scarfName,new RegExp(f.home==='yards'?'Yards Athletic scarf':'scarf'));assert.match(r.progName,/programme: .+ v .+/);
 assert.ok(r.read.split(',').length>=20,'both elevens named: '+r.read.slice(0,80));assert.match(r.held,/not match day|Nobody joins/);
 await p.evaluate(()=>saveGame());await p.reload();await p.waitForFunction(()=>typeof itemName==='function'&&worldReady);
 const after=await p.evaluate(()=>inv.filter(i=>i.id==='scarf'||i.id==='programme').map(i=>[i.id,i.of,i.uses]));
 assert.equal(after.length,2);assert.equal(after.find(x=>x[0]==='scarf')[1],f.home,'the scarf still its club');assert.equal(after.find(x=>x[0]==='programme')[2],f.n,'the programme still its match');
 // inside, the kiosk by the gate
 const k=await p.evaluate(()=>{paused=false;enterStadium('main');body.seat=null;px=KIOSK.x;py=KIOSK.y+1.1;a=-Math.PI/2;env(0);render(0);const pr=promptText();interact();return{pr,shop:shopCtx?.title,stock:shopCtx?.stock};});
 assert.match(k.pr,/kiosk/);assert.equal(k.shop,'PIES & PINTS');assert.ok(k.stock.includes('hotdog')&&k.stock.includes('beer'));
}));
