'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('grow racks use paid seed pods, pause without power, reward tending, and keep a ready harvest when the bag is full',()=>{
  const {ev}=loadCity();
  ev(`money=1000;globalThis.h={cell:0,kind:'home_studio'};owned.homes.push(h);globalThis.w=workshopState(h);
    buyWeedEquipment(h);globalThis.rack={id:'growrack',key:1,x:3,y:11,a:0};w.parts.push(rack);`);
  assert.equal(ev('money'),910);assert.equal(ev('w.seeds'),3);
  assert.equal(ev('plantWeed(h,rack)[0]'),false);
  ev('w.powered=true');assert.equal(ev('plantWeed(h,rack)[0]'),true);
  assert.equal(ev('w.seeds'),2);assert.equal(ev('plantWeed(h,rack)[0]'),false);
  assert.equal(ev('tendWeed(rack)[0]'),false);
  ev('stepWorkshop(25)');assert.equal(ev('rack.crop.left'),50);
  assert.equal(ev('tendWeed(rack)[0]'),true);assert.equal(ev('tendWeed(rack)[0]'),false);
  ev('w.powered=false;stepWorkshop(100)');assert.equal(ev('rack.crop.left'),50);
  ev('w.powered=true;buyWorkshopUpgrade(h,"lamp");stepWorkshop(34)');assert.equal(ev('rack.crop.left'),0);
  ev('while(inv.length<INV_SIZE) carryItem({id:"book",uses:0},false)');
  assert.equal(ev('harvestWeed(h,rack)[0]'),false);assert.ok(ev('rack.crop'));
  ev('clearInventory()');assert.equal(ev('harvestWeed(h,rack)[0]'),true);
  assert.equal(ev('JSON.stringify(inv[0])'),'{"id":"weed","uses":6,"q":"perfect"}');
  assert.equal(ev('rack.crop'),undefined);assert.equal(ev('harvestWeed(h,rack)[0]'),false);
});

test('workshop upgrades charge once, improve Neon output, and restored racks retain bounded growth and purchases',()=>{
  const {ev}=loadCity();
  ev(`money=1000;globalThis.h={cell:0,kind:'home_studio'};globalThis.w=workshopState(h);buyWorkshopKit(h);
    globalThis.b={id:'bench',key:1,x:3,y:11,a:0};w.parts.push(b,{id:'processor',key:2,x:3,y:11,bench:1,a:0},{id:'packer',key:3,x:3,y:11,bench:1,a:0});w.powered=true;`);
  assert.equal(ev('buyWorkshopUpgrade(h,"press")[0]'),true);
  const money=ev('money');assert.equal(ev('buyWorkshopUpgrade(h,"press")[0]'),false);assert.equal(ev('money'),money);
  ev('finishWorkshopBatch(h,b,"perfect")');assert.equal(ev('inv[0].uses'),8);
  ev('globalThis.g=GAMES.workshop(Math.random,"",{fan:true,controller:true})');
  assert.ok(ev('g.state().band[0] < .3 && g.state().band[1] > .78'));
  ev(`buyWeedEquipment(h);buyWorkshopUpgrade(h,'lamp');w.parts.push({id:'growrack',key:4,x:10,y:11,a:Math.PI/2,crop:{left:40,tended:true}});
    globalThis.restored=restoreWorkshop(JSON.parse(JSON.stringify(w)));`);
  assert.equal(ev('restored.upgrades.lamp'),true);assert.equal(ev('restored.upgrades.press'),true);
  assert.equal(ev('restored.parts.find(p=>p.id==="growrack").crop.left'),40);
  assert.equal(ev('restored.parts.find(p=>p.id==="growrack").crop.tended'),true);
  assert.equal(ev('restored.seeds'),3);
});

test('using one pack keeps inventory slots correct, limits repeated use, blends effects and fades fully away',()=>{
  const {ev}=loadCity();
  ev(`carryItem({id:'weed',uses:1,q:'perfect'});carryItem({id:'book',uses:0},false);held=0;useHeld({});`);
  assert.equal(ev('inv[0].id'),'joint');assert.equal(ev('drugEffects.weed'),0);
  ev('useHeld({})');
  assert.equal(ev('inv.length'),1);assert.equal(ev('inv[0].id'),'book');assert.equal(ev('quickSlots[1]'),0);
  assert.ok(ev('drugEffects.weed>60'));assert.equal(ev('drugVisualStrength("weed")'),0);
  ev('carryItem({id:"neon",uses:3,q:"fine"});useHeld({})');assert.equal(ev('inv[1].uses'),3);
  ev('stepDrugEffects(3);useHeld({})');assert.equal(ev('inv[1].uses'),2);assert.equal(ev('drugEffects.neon'),65);
  ev('stepDrugEffects(3)');assert.equal(ev('drugVisualStrength("weed")'),1);assert.equal(ev('drugVisualStrength("neon")'),1);
  ev('inv[1].uses=20;for(let i=0;i<10;i++){stepDrugEffects(1.3);consumeDrug(inv[1]);}');
  assert.ok(ev('drugEffects.neon<=120'));
  ev('clearDrugEffects(30)');assert.ok(ev('drugEffects.weed<60'));
  ev('stepDrugEffects(200)');assert.equal(ev('drugEffectTags().length'),0);assert.equal(ev('drugVisualStrength("weed")'),0);
});

test('weed and Neon both attract buyers and mixed sales pay each quality without touching the closet',()=>{
  const {ev}=loadCity();
  ev(`carryItem({id:'weed',uses:4,q:'perfect'});carryItem({id:'neon',uses:2,q:'fine'});closet.push({id:'weed',uses:3,q:'fine'});money=0;`);
  assert.equal(ev('drugStockLabel()'),'mixed');assert.equal(ev('drugValue()'),76);
  assert.equal(ev('drugBuyerInterested(0,()=>.99)'),true);
  ev('sellDrugBatch()');assert.equal(ev('money'),76);assert.equal(ev('closet[0].uses'),3);
  assert.equal(ev('drugBuyerInterested(0,()=>0)'),true);
});
