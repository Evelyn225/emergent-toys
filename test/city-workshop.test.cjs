'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
function fixture() {
  const {ev}=loadCity();
  ev(`globalThis.home={cell:0,kind:'home_studio'}; money=500;
    globalThis.w=workshopState(home);`);
  return {ev,json:expr=>JSON.parse(ev('JSON.stringify('+expr+')'))};
}
test('starter crates contain the three separate pieces and supplies; orders respect money and capacity',()=>{
  const {ev,json}=fixture();
  assert.equal(ev('buyWorkshopKit(home)[0]'),true);
  assert.equal(ev('money'),380);
  assert.deepEqual(json('w.owned'),{bench:1,processor:1,packer:1,fan:0,growrack:0});
  assert.equal(ev('w.supplies'),3);assert.equal(ev('w.parts.length'),0);
  ev('money=0');assert.equal(ev('buyWorkshopKit(home)[0]'),false);assert.equal(ev('w.owned.bench'),1);
  ev('money=1000;buyWorkshopKit(home);buyWorkshopKit(home)');
  assert.equal(ev('buyWorkshopKit(home)[0]'),false);
});
test('equipment, power, supplies and bag space are required; finished batches preserve quality and use one refill',()=>{
  const {ev,json}=fixture();
  ev(`buyWorkshopKit(home); globalThis.b={id:'bench',key:1,x:3,y:11,a:0};w.parts.push(b);`);
  assert.match(ev('workshopCanRun(home,b)'),/processor/);
  ev("w.parts.push({id:'processor',key:2,bench:1},{id:'packer',key:3,bench:1})");
  assert.match(ev('workshopCanRun(home,b)'),/Plug/);
  ev('w.powered=true');assert.equal(ev('workshopCanRun(home,b)'),'');
  assert.equal(ev("finishWorkshopBatch(home,b,'perfect')[0]"),true);
  assert.deepEqual(json('inv[0]'),{id:'neon',uses:6,q:'perfect'});assert.equal(ev('w.supplies'),2);
  ev("while(inv.length<INV_SIZE) carryItem({id:'book',uses:0},false)");
  assert.equal(ev("finishWorkshopBatch(home,b,'fine')[0]"),false);assert.equal(ev('w.supplies'),2);
});
test('the active batch rewards balanced power and timed moves, while neglected batches give a weak result',()=>{
  const {ev}=fixture();
  ev(`globalThis.g=GAMES.workshop(Math.random);for(let n=0;n<1100&&!g.over;n++) {
    const s=g.state(),m=s.current;g.step(1/30,{act:s.heat<.55,upP:m?.key==='up',downP:m?.key==='down'});
  }`);
  assert.equal(ev('g.over'),true);assert.equal(ev('g.result'),'perfect');
  ev('globalThis.bad=GAMES.workshop(Math.random);for(let n=0;n<1100;n++) bad.step(1/30,{})');
  assert.equal(ev('bad.result'),'burnt');
});
test('selling only removes carried drugs and pays their quality; stored batches and held gear stay intact',()=>{
  const {ev,json}=fixture();
  ev("carryItem({id:'book',uses:0});carryItem({id:'neon',uses:6,q:'perfect'},false);carryItem({id:'neon',uses:2,q:'burnt'},false);closet.push({id:'neon',uses:4,q:'fine'});money=0");
  assert.equal(ev('drugCount()'),8);assert.equal(ev('drugValue()'),124);
  assert.equal(ev('sellDrugBatch()[0]'),true);assert.equal(ev('money'),124);
  assert.deepEqual(json('inv'),[{id:'book',uses:0}]);assert.equal(ev('heldItem().id'),'book');
  assert.equal(ev('closet.length'),1);assert.equal(ev('sellDrugBatch()[0]'),false);
});
test('saved workshop data is bounded and ignores unknown, duplicated or orphaned equipment',()=>{
  const {json}=fixture();
  const w=json(`restoreWorkshop({owned:{bench:99,processor:1,packer:1},supplies:999,powered:true,parts:[
    {id:'bench',key:1,x:3,y:11,a:99},{id:'bench',key:1,x:3,y:11,a:0},
    {id:'processor',key:2,bench:999,x:3,y:11,a:0},{id:'fake',key:3,x:3,y:11,a:0},
    {id:'packer',key:4,bench:1,x:3.4,y:11,a:0}]})`);
  assert.equal(w.owned.bench,3);assert.equal(w.supplies,300);assert.equal(w.powered,true);
  assert.deepEqual(w.parts.map(p=>p.id),['bench','packer']);
});

test('carried stock guarantees interest; closet stock gets periodic chances and a buyer waits for pickup',()=>{
  const {ev}=fixture();
  ev("closet.push({id:'neon',uses:4,q:'fine'})");
  assert.equal(ev('drugBuyerInterested(10,()=>.9)'),false);
  assert.equal(ev('drugBuyerInterested(20,()=>0)'),false,'a failed roll cannot be retried every frame');
  assert.equal(ev('drugBuyerInterested(30,()=>0)'),true);
  assert.equal(ev('drugBuyerInterested(80,()=>.9)'),true,'the visitor waits while stock is collected');
  ev('closet.length=0');assert.equal(ev('drugBuyerInterested(81,()=>0)'),false);
  ev("carryItem({id:'neon',uses:1,q:'fine'})");assert.equal(ev('drugBuyerInterested(82,()=>.9)'),true);
});
