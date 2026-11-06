'use strict';
// The Yards ground on the street (world.js STADIUM_SITE, stadium.js, league.js): the turnstiles open before a fixture,
// a ticket buys a seat in a section, the match waits for kick-off and the city clock keeps pace with it; results go
// into the league table, which is saved.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;dayNum+=mod(5-mod(dayNum,7),7);tod=14;weather='clear';money=500;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}
const atGates=p=>p.evaluate(()=>{const b=stadiumBounds();px=(b.x0+b.x1)/2;py=b.y1+.25;a=-Math.PI/2;pitch=.05;env(0);render(0);return promptText();});

test('a two-block ground in the Yards, the street between the blocks gone, on the map',()=>city(async p=>{
 const r=await p.evaluate(()=>{const b=stadiumBounds();let ring=0,pitch_=0,road=0;
  for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++){const i=idx(x,y);if(STY[i]!==26)continue;if(map[i]>1)ring++;else pitch_++;if(ROAD[i])road++;}
  return{w:b.x1-b.x0,h:b.y1-b.y0,ring,pitch:pitch_,road,district:districtName(Math.floor(b.x0/8),Math.floor(b.y0/8)),onMap:mapDirectory().some(q=>q.id==='stadium')};});
 assert.deepEqual([r.w,r.h],[14,6]);assert.ok(r.ring>=36&&r.pitch>=40,JSON.stringify(r));assert.equal(r.road,0,'no street through it');
 assert.equal(r.district,'yards');assert.ok(r.onMap);
}));

test('on match day the turnstiles sell tickets; a seat in the main stand, and the match waits for kick-off',()=>city(async p=>{
 assert.match(await atGates(p),/E: tickets for .+ v? .*15:00/);
 await p.evaluate(()=>interact());
 const panel=await p.evaluate(()=>({open:ticketEl?.style.display==='flex',sections:[...ticketEl.querySelectorAll('[data-sec]')].map(b=>b.dataset.sec),table:ticketEl.querySelectorAll('.tbl').length}));
 assert.ok(panel.open);assert.deepEqual(panel.sections,['main','south','terrace']);assert.equal(panel.table,9,'the league table, all eight clubs');
 await p.locator('#tickets [data-sec="main"]').click();
 const r=await p.evaluate(()=>{const m=stadiumMatch,t0=m.t;for(let k=0;k<20;k++){T+=.1;render(0);}
  return{room:room?.kind,money,seated:!!body.seat,y:py,rise:stairRise(px,py),waited:m.t===t0,teams:m.teams.map(t=>t.club.id),fixture:[stadiumNextFixture().home,stadiumNextFixture().away]};});
 assert.equal(r.room,'stadium');assert.equal(r.money,460);assert.ok(r.seated&&r.y<18&&r.rise>2,'in the main stand');
 assert.ok(r.waited,'nobody kicks off before 15:00');assert.deepEqual(r.teams,r.fixture,'the fixture on the poster is the one played');
 // kick-off: the match starts, and the city clock goes at its pace (two hours over the match)
 const k=await p.evaluate(()=>{const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24;const t0=stadiumMatch.t;for(let j=0;j<600;j++){T+=.1;render(0);}
  const hrs=nowHour()-f.kick,frac=stadiumMatch.t/stadiumPlaySeconds(stadiumMatch);return{played:stadiumMatch.t-t0,hrs,frac};});
 assert.ok(k.played>50,'it kicked off');assert.ok(Math.abs(k.hrs-k.frac*1.95)<.02,`the clock keeps pace: ${k.hrs.toFixed(3)}h at ${(k.frac*100).toFixed(0)}%`);
}));

test('no match on: the gates are shut, and they tell you the next fixture',()=>city(async p=>{
 await p.evaluate(()=>{dayNum+=2;tod=10;});
 const prompt=await atGates(p);assert.doesNotMatch(prompt,/E: tickets/);assert.match(prompt,/v .*(WED|SAT|TODAY)/);
 await p.evaluate(()=>interact());assert.equal(await p.evaluate(()=>mode),'walk','not let in');
}));

test('results come in as the week goes by, the match you watched among them; the table is saved',()=>city(async p=>{
 await p.evaluate(()=>{updateLeague();const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24+.5;enterStadium('south');for(let k=0;k<5;k++){T+=.1;render(0);}window.__watched=[stadiumMatch.slot,stadiumMatch.teams[0].club.id];leaveRoom();
  dayNum+=10;updateLeague();saveGame();});
 const r=await p.evaluate(()=>({played:league.played,results:league.results.length,watched:league.results.find(x=>x.n===window.__watched[0]&&x.home===window.__watched[1]),league:league.results.filter(x=>!x.cup).length,games:leagueTable().reduce((s,t)=>s+t.p,0)}));
 assert.ok(r.results>=8,'two rounds and more');assert.ok(r.watched,'the match you were at is on the record');assert.equal(r.games,r.league*2,'every league result in the table (the cup ties are kept apart)');
 await p.reload();await p.waitForFunction(()=>typeof leagueTable==='function'&&worldReady);
 assert.equal(await p.evaluate(()=>league.results.length),r.results,'kept in the save');
}));
