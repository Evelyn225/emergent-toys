'use strict';
// The atmosphere at the ground (stadium-atmosphere.js): the referee's whistles, the crowd's ooh, roar and groan, the
// chants, the commentary and the PA on every kind of event, the score up top, and a crowd that rises with danger.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('a whole match at the ground: heard, told and on the scoreboard line',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24-.2;
   enterStadium('main');const m=stadiumMatch;const sounds=[],said=[];const real=sfxStadium,realSay=say;
   sfxStadium=(k)=>sounds.push(k);
   const before=stadiumScoreLine(),pre=stadiumCrowdLevel();
   dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24;
   let lastMsg='';
   for(let k=0;k<20000&&m.phase!=='ft';k++){MatchEngine.tick(m);stadiumAtmosphere();if(msgText!==lastMsg){said.push(msgText);lastMsg=msgText;}}
   sfxStadium=real;
   const goals=m.events.filter(e=>e.kind==='goal'),homeGoals=goals.filter(e=>e.side===0).length,awayGoals=goals.length-homeGoals;
   const count=k=>sounds.filter(s=>s===k).length;
   const quiet=audioMix({stadium:.55,mode:'room',room:{kind:'stadium',word:'',def:{}},day:1,night:0,rain:0,tod:15,district:'yards'}).crowd,loud=audioMix({stadium:1,mode:'room',room:{kind:'stadium',word:'',def:{}},day:1,night:0,rain:0,tod:15,district:'yards'}).crowd;
   return{before,pre,after:stadiumScoreLine(),homeGoals,awayGoals,roars:count('roar'),awaygoals:count('awaygoal'),whistle:count('whistle'),ht:count('whistle2'),ft:count('whistle3'),
    oohs:count('ooh'),shots:m.events.filter(e=>e.kind==='shot').length,peeps:count('peep'),fouls:m.events.filter(e=>e.kind==='foul').length,
    welcome:said.some(s=>/^Welcome to the Yards Ground/.test(s)),goalLines:said.filter(s=>/GOAL!/.test(s)).length,htLine:said.some(s=>/^Half time at the Yards/.test(s)),ftLine:said.some(s=>/^Full time:/.test(s)),quiet,loud};});
  assert.match(r.before,/kick-off \d\d:\d\d/);assert.match(r.after,/full time/);assert.match(r.after,new RegExp(`${r.homeGoals}-${r.awayGoals}`));
  assert.equal(r.roars,r.homeGoals,'a roar for every home goal');assert.equal(r.awaygoals,r.awayGoals,'a groan for every away one');
  assert.ok(r.whistle>=2,'the kick-offs');assert.equal(r.ht,1,'two blasts at half time');assert.equal(r.ft,1,'three at full time');
  assert.equal(r.oohs,r.shots,'an ooh at every shot');assert.ok(r.peeps>=r.fouls,'a peep for every foul');
  assert.ok(r.welcome,'the PA welcome at kick-off');assert.equal(r.goalLines,r.homeGoals+r.awayGoals,'every goal called');assert.ok(r.htLine&&r.ftLine);
  assert.ok(r.loud>r.quiet,'the crowd rises with the danger');assert.ok(r.pre<.55,'quieter before kick-off');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
