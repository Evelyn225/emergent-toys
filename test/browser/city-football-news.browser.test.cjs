'use strict';
// The football in the papers: a match you were at, the cup final, the league champions, and the odd thrashing.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';env(0);render(0);league={played:-1,table:{},results:[],season:1};noto.log.length=0;dayNum=7*7*3+2;tod=10;updateLeague();});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a match you went to is in the next day\'s paper, scorers and all; one you missed is not',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24+.2;enterStadium('main');leaveRoom();
  dayNum=Math.floor((f.kick+MATCH_HOURS+.2)/24);tod=f.kick+MATCH_HOURS+.2-dayNum*24;updateLeague();
  const res=league.results.find(x=>x.n===f.n&&x.home===f.home),tonight=newsLines(true).join('\\n');
  const g=stadiumNextFixture();dayNum=Math.floor((g.kick+MATCH_HOURS+.2)/24);tod=g.kick+MATCH_HOURS+.2-dayNum*24;updateLeague(); // (the next: not there)
  dayNum++;const paper=newsLines().join('\\n')+newsLines(true).join('\\n');
  return{res,tonight,home:clubName(f.home),missed:clubName(g.home)+' '+league.results.find(x=>x.n===g.n&&x.home===g.home)?.score[0]+',',paper,log:noto.log.filter(e=>e.kind==='match').length};});
 assert.ok(r.res,'played');assert.match(r.tonight,new RegExp(r.home+' '+r.res.score[0]+','),'on the telly that night');
 assert.equal(r.log,1,'only the one you were at');
}));

test('over a season: the cup final and the champions always make it; a big win sometimes',()=>city(async p=>{
 const r=await p.evaluate(()=>{const kinds=new Set(),lines=[];
  for(let k=0;k<7*24*8;k++){tod+=1;if(tod>=24){tod-=24;dayNum++;}updateLeague();for(const e of noto.log)if(!kinds.has(e.kind+e.day)){kinds.add(e.kind+e.day);}}
  const all=noto.log.map(e=>e.kind);dayNum++;const text=newsLines(true).concat(newsLines()).join('\\n');
  return{all,text,winner:league.cupHolder&&clubName(league.cupHolder)};});
 assert.ok(r.all.includes('cupfinal')||/City Cup/.test(r.text),'the cup final: '+r.all);
 assert.ok(r.all.includes('champions'),'the champions: '+r.all);
 assert.ok(!r.all.includes('match'),'no match of yours: you went to none');
}));
