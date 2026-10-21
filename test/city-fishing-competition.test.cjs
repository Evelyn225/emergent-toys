'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();
const js=code=>JSON.parse(ev(`JSON.stringify(${code})`));
function reset(day=4){ev(`dayNum=${day};tod=12;paused=false;money=100;loadFishingCompetition(null);clearInventory();carryItem({id:'rod',uses:0});fishing=null;`);}

test('entry spans all Friday, starts only on joining, and permits one round each week',()=>{
  for(const hour of [0,4.99,12,19.99,23.999]){
    reset();ev(`tod=${hour};stepFishingCompetition(600)`);assert.equal(ev('fishCompetition.round'),null);
    assert.equal(js('joinFishingCompetition()')[0],true);assert.equal(ev('fishCompetition.round.left'),300);
  }
  for(const day of [0,3,5,6]){reset(day);assert.equal(js('joinFishingCompetition()')[0],false);}
  reset();ev('joinFishingCompetition();stepFishingCompetition(300);claimFishingCompetition()');
  assert.equal(js('joinFishingCompetition()')[0],false);
  ev('dayNum=11');assert.equal(js('joinFishingCompetition()')[0],true);
});
test('a late start survives midnight, pauses in menus, and saves remaining active time independently of the city clock',()=>{
  reset();ev('tod=23.99;joinFishingCompetition();stepFishingCompetition(30);dayNum=5;tod=1;paused=true;stepFishingCompetition(90)');
  assert.equal(ev('fishCompetition.round.left'),270);
  const snapshot=js('fishCompetition');ev(`loadFishingCompetition(${JSON.stringify(snapshot)});paused=false;stepFishingCompetition(20)`);
  assert.equal(ev('fishCompetition.round.left'),250);
  ev('T+=10000;tod=18');assert.equal(ev('fishCompetition.round.left'),250);
  assert.equal(ev('stepFishingCompetition(NaN)'), '');assert.equal(ev('fishCompetition.round.left'),250);
  assert.match(ev('stepFishingCompetition(250)'),/Time!/);assert.equal(ev('stepFishingCompetition(5)'),'');
});
test('only fresh landed fish count, largest fish beats total weight, and catch-and-release with a full bag is weighed once',()=>{
  reset();ev('joinFishingCompetition()');
  const score=(id,kg,day=4)=>ev(`recordFishingCompetitionCatch({competitionDay:${day},catch:{id:'${id}',kg:${kg}}})`);
  score('cod',5,3);score('oldboot',9);score('cod',NaN);assert.equal(ev('fishCompetition.round.count'),0);
  score('cod',3);score('cod',2);score('cod',2);
  assert.equal(ev('fishCompetition.round.best.kg'),3);assert.equal(ev('fishCompetition.round.count'),3);
  ev("while(inv.length<INV_SIZE)carryItem({id:'book',uses:0},false);var landed={competitionDay:4,catch:{id:'conger',kg:12}};landCatch(landed);landCatch(landed)");
  assert.equal(ev('fishCompetition.round.best.kg'),12);assert.equal(ev('fishCompetition.round.count'),4);assert.equal(ev("inv.some(it=>it.id==='conger')"),false);
  ev('stepFishingCompetition(300)');score('conger',14);assert.equal(ev('fishCompetition.round.best.kg'),12);
});
test('the local field is reproducible, ties reward the earlier catch, and prizes can be paid only once across reloads',()=>{
  reset();assert.deepEqual(js('fishingCompetitionField(4)'),js('fishingCompetitionField(4)'));
  assert.notDeepEqual(js('fishingCompetitionField(4)'),js('fishingCompetitionField(11)'));
  ev('joinFishingCompetition()');assert.equal(js('fishingCompetitionBoard()').at(-1).you,true);
  ev("recordFishingCompetitionCatch({competitionDay:4,catch:{id:'conger',kg:14}});stepFishingCompetition(300)");
  assert.equal(ev('fishingCompetitionPrize()'),250);assert.equal(js('claimFishingCompetition()')[0],true);
  assert.equal(ev('money'),350);assert.equal(ev('fishCompetition.wins'),1);
  const save=js('fishCompetition');ev(`loadFishingCompetition(${JSON.stringify(save)})`);
  assert.equal(js('claimFishingCompetition()')[0],false);assert.equal(ev('money'),350);
  ev("var leader=fishingCompetitionBoard().find(p=>!p.you);fishCompetition.round.best={id:leader.best.id,kg:leader.best.kg};fishCompetition.round.bestAt=leader.at-.1");
  assert.equal(ev('fishingCompetitionBoard()[0].you'),true,'earlier equal-weight catch wins');
  ev('fishCompetition.round.bestAt=leader.at+.1');assert.equal(ev('fishingCompetitionBoard()[0].you'),false,'later equal-weight catch loses');
});
test('missing and malformed competition saves remain safe and cannot create an already paid live round',()=>{
  reset();ev("loadFishingCompetition({enteredDay:999,wins:-5,round:{day:4,left:Infinity},best:{id:'book',kg:100}})");
  assert.deepEqual(js('fishCompetition'),{enteredDay:-1,round:null,wins:0,best:null});
  ev("loadFishingCompetition({round:{day:4,left:200,claimed:true,best:{id:'cod',kg:999},count:-9}})");
  assert.equal(ev('fishCompetition.round.claimed'),false);assert.equal(ev('fishCompetition.round.best'),null);assert.equal(ev('fishCompetition.round.count'),0);
});
