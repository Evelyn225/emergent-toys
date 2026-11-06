'use strict';
// The City Cup (league.js): the eight clubs drawn into a knockout each season, quarter-finals and semis on Thursday
// nights, the final on a Sunday afternoon, one tie a round at the Yards ground; level at full time, penalties.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';env(0);render(0);league={played:-1,table:{},results:[],season:1};dayNum=7*7*3+2;tod=10;updateLeague();});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a season: the three cup rounds come to the ground between the league matches, and somebody lifts the cup',()=>city(async p=>{
 const r=await p.evaluate(()=>{const cup=[];let lg=0,html=null,next=null;
  for(let k=0;k<7*24*7;k++){const f=stadiumNextFixture();if(f.cup&&!cup.some(c=>c.n===f.n))cup.push({n:f.n,cup:f.cup,day:Math.floor(f.kick/24)%7,when:f.when});if(!f.cup)lg++;
   tod+=1;if(tod>=24){tod-=24;dayNum++;}updateLeague();if(!html&&league.cup?.winner)html=cupBracketHtml();}next=cupBracketHtml();
  return{cup,rounds:league.cup.rounds.map(r=>r.length),winner:league.cup.winner,league:lg,html,next};});
 assert.deepEqual(r.cup.map(c=>c.cup),['Cup quarter-final','Cup semi-final','Cup final']);
 assert.deepEqual(r.cup.map(c=>c.day),[3,3,6],'Thursday, Thursday, Sunday');
 assert.deepEqual(r.rounds,[4,2,1]);assert.ok(r.winner);assert.ok(r.league>0,'the league carries on');
 assert.match(r.html,/Winners: <b>/);assert.match(r.next,/Holders: /,'next season: the draw, and who holds it');
}));

test('at the ground for a cup tie: level at the end, it goes to penalties, on the scoreboard and the PA, into the cup',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const S=seasonOfHour(nowHour()),kick=cupKick(S,0);dayNum=Math.floor(kick/24);tod=kick-dayNum*24-.5;updateLeague();
  const f=stadiumNextFixture();enterStadium('main');tod=kick-dayNum*24+.01;env(0);render(0);
  const m=stadiumLiveMatch(),lines=[];let last=null;const heard=()=>{if(msgText!==last){last=msgText;lines.push(msgText);}};
  {while(m.phase!=='ft'&&!(m.period===2&&MatchEngine.minute(m)>=88)){MatchEngine.tick(m);}
   m.teams[1].score=m.teams[0].score; // (level, whatever it was)
   let sawPens=null,board=null;for(let k=0;k<20000&&m.phase!=='ft';k++){T+=MatchEngine.DT;MatchEngine.tick(m);stadiumAtmosphere();heard();if(m.phase==='pens'&&!sawPens){sawPens=stadiumScoreLine();}}
   const res=MatchEngine.result(m);dayNum=Math.floor((kick+MATCH_HOURS+.1)/24);tod=kick+MATCH_HOURS+.1-dayNum*24;updateLeague();
   const tie=league.cup.rounds[0][cupGroundTie(S,0)];
   return{cup:f.cup,n:f.n,knock:m.knockout,sawPens,end:stadiumScoreLine(),pens:res.pens,tie,lines:lines.filter(l=>/penalt|SCORES|SAVED|MISSES|wide|over the bar|tucks|wrong way|steps up/i.test(l)).length};}});
 assert.equal(r.cup,'Cup quarter-final');assert.ok(r.n<0);assert.equal(r.knock,true);
 assert.match(r.sawPens,/^Cup quarter-final: .*penalties \d-\d/);assert.match(r.end,/on pens/);
 assert.ok(r.pens&&r.pens[0]!==r.pens[1]);assert.deepEqual(r.tie.pens,r.pens,'the shootout you saw is the one in the cup');
 assert.equal(r.tie.winner,r.pens[0]>r.pens[1]?r.tie.home:r.tie.away);
 assert.ok(r.lines>=6,'the PA through the kicks: '+r.lines);
}));
