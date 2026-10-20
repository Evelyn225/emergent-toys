'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('the recurring cast keeps distinct outfits and visits match available stock and quality',()=>{
  const {ev}=loadCity();
  ev(`carryItem({id:'weed',uses:10,q:'perfect'});carryItem({id:'neon',uses:8,q:'perfect'});
    globalThis.ids=Array.from({length:4},()=>newDrugVisit().id);`);
  assert.equal(ev('ids.join(",")'),'kit,juno,dex,vale');
  assert.equal(ev('JSON.stringify(figLook(DRUG_BUYERS[1].look).col)===JSON.stringify(figLook(DRUG_BUYERS[1].look).col)'),true);
  assert.equal(ev('new Set(DRUG_BUYERS.map(b=>JSON.stringify(figLook(b.look).col))).size'),4);
  ev('clearInventory();carryItem({id:"neon",uses:4,q:"fine"});drugContacts.visits=1');
  assert.equal(ev('newDrugVisit().id'),'kit','premium-only and weed buyers do not arrive for standard Neon');
});

test('negotiation counters without consuming stock and settles only the exact agreed partial order',()=>{
  const {ev}=loadCity();
  ev(`money=0;carryItem({id:'book',uses:0});carryItem({id:'weed',uses:6,q:'fine'},false);carryItem({id:'neon',uses:3,q:'perfect'},false);
    closet.push({id:'weed',uses:8,q:'fine'});globalThis.it=inv[1];globalThis.v={id:'juno',remaining:3,attempts:0,counter:null};`);
  const fair=ev('buyerUnitPrice(v,it)');
  assert.equal(ev(`negotiateDrugOrder(v,it,2,${fair+2}).status`),'counter');
  assert.equal(ev('it.uses'),6);assert.equal(ev('money'),0);
  assert.equal(ev('tradeDrugOrder(v,it,1,v.counter.price+1)[0]'),false);
  const price=ev('v.counter.price');assert.equal(ev('tradeDrugOrder(v,it,2,v.counter.price)[0]'),true);
  assert.equal(ev('money'),price*2);assert.equal(ev('it.uses'),4);assert.equal(ev('inv[2].uses'),3);assert.equal(ev('closet[0].uses'),8);
  assert.equal(ev('v.remaining'),1);assert.equal(ev('drugRelationship("juno").deals'),1);
});

test('invalid orders are rejected, repeated unreasonable asks end a visit, and regulars get bounded better prices',()=>{
  const {ev}=loadCity();
  ev(`carryItem({id:'weed',uses:4,q:'fine'});globalThis.it=inv[0];globalThis.v={id:'juno',remaining:3,attempts:0,counter:null};`);
  assert.equal(ev('negotiateDrugOrder(v,it,4,10).status'),'invalid');assert.equal(ev('v.attempts'),0);
  assert.equal(ev('negotiateDrugOrder(v,it,2.5,10).status'),'invalid');
  assert.equal(ev('negotiateDrugOrder(v,it,2,999).status'),'refused');
  ev('negotiateDrugOrder(v,it,2,999)');assert.equal(ev('negotiateDrugOrder(v,it,2,999).status'),'leave');
  assert.equal(ev('it.uses'),4);
  const fresh=ev('buyerUnitPrice(v,it)');
  ev('drugRelationship("juno").deals=6');assert.ok(ev('buyerUnitPrice(v,it)')>fresh);
  const regular=ev('buyerUnitPrice(v,it)');ev('drugRelationship("juno").deals=1000');assert.equal(ev('buyerUnitPrice(v,it)'),regular);
});

test('contact history restores safely and Mara counts successful cupboard orders with the same prices and caps',()=>{
  const {ev}=loadCity();
  ev(`money=500;globalThis.h={cell:0,kind:'home_studio'};orderWorkshopSupply(h,'kit');orderWorkshopSupply(h,'seeds');`);
  assert.equal(ev('drugContacts.supplierOrders'),2);assert.equal(ev('money'),362);
  ev('money=0');assert.equal(ev('orderWorkshopSupply(h,"rack")[0]'),false);assert.equal(ev('drugContacts.supplierOrders'),2);
  ev(`loadDrugContacts({buyers:{kit:{deals:4,trust:99,spent:100},fake:{deals:5}},supplierOrders:3,visits:2,last:'kit'})`);
  assert.equal(ev('drugContacts.buyers.kit.deals'),4);assert.equal(ev('drugContacts.buyers.kit.trust'),10);
  assert.equal(ev('drugContacts.buyers.fake'),undefined);assert.equal(ev('drugContacts.supplierOrders'),3);
});

test('preparing a joint respects bag capacity and last-pack slots; smoking uses one joint and drags add bounded effects',()=>{
  const {ev}=loadCity();
  ev(`carryItem({id:'weed',uses:2,q:'perfect'});while(inv.length<INV_SIZE)carryItem({id:'book',uses:0},false);held=0;`);
  assert.match(ev('useHeld({})[0]'),/room/);assert.equal(ev('inv[0].uses'),2);
  ev('inv[0].uses=1;useHeld({})');assert.equal(ev('inv[0].id'),'joint');assert.equal(ev('quickSlots[0]'),0);
  assert.equal(ev('drugEffects.weed'),0);ev('useHeld({})');assert.equal(ev('inv.length'),ev('INV_SIZE-1'));
  assert.equal(ev('held'),-1);assert.equal(ev('fx.smokeKind'),'joint');assert.equal(ev('fx.smoke'),55);
  const first=ev('drugEffects.weed');ev('useHeld({})');assert.equal(ev('drugEffects.weed'),first,'drag cooldown');
  ev('stepDrugEffects(2);useHeld({})');assert.ok(ev('drugEffects.weed')>first);
  ev('stepGoods(56)');assert.equal(ev('fx.smoke'),0);assert.match(ev('useHeld({})[0]'),/empty/);
});
