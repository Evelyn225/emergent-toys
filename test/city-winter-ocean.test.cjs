'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');
const {ev}=loadCity();
const read=code=>JSON.parse(ev(`JSON.stringify(${code})`));
test.beforeEach(()=>ev("setSeason(3);mode='walk';money=10000;body.mx=body.my=0;a=0;fx.iceSkating=false;inv.length=0;for(const key of Object.keys(K))K[key]=0;"));

test('only winter ocean freezes; geography, piers and inland lakes retain their identity',()=>{
  const result=read(`(()=>{
    const b=fleet[0],liquid=isWater(b.x,b.y),winter=oceanIceAt(b.x,b.y),pier=oceanIceAt(MARINA.x,MARINA.fingers[0]);
    const lake=oceanIceAt(GARDEN.x0+LAKE.x,GARDEN.y0+LAKE.y);
    setSeason(0);weather='snow';snowCover=1;
    return {liquid,winter,pier,lake,spring:oceanIceAt(b.x,b.y),shops:winterSkateShops().length};
  })()`);
  assert.deepEqual(result,{liquid:true,winter:true,pier:false,lake:false,spring:false,shops:0});
});
test('winter prevents paying for, boarding or hotwiring boats and stops an existing voyage',()=>{
  const result=read(`(()=>{
    const b=fleet.find(b=>b.deal==='rent');px=b.x;py=b.y;tod=12;
    const before=money,deal=b.deal;useMarina();stealBoat();boardBoat(b);
    const blocked=mode==='walk'&&money===before&&b.deal===deal&&!b.hired;
    setSeason(0);boardBoat(b);b.v=2;setSeason(3);K.KeyW=K.KeyD=1;
    const x=b.x,y=b.y,hx=b.hx;stepSea(.5);
    return {blocked,stopped:b.v===0&&b.x===x&&b.y===y&&b.hx===hx,exit:!!landingSpot(b)};
  })()`);
  assert.deepEqual(result,{blocked:true,stopped:true,exit:true});
});
test('walking slips, skates accelerate faster and coast, carve, brake and cap diagonal speed',()=>{
  const result=read(`(()=>{
    const push=(f,s,run,seconds)=>{for(let t=0;t<seconds-1e-6;t+=.02)stepIceMotion(f,s,run,.02);};
    push(1,0,false,2);const walk=body.mx;push(0,0,false,.4);const slip=body.mx;
    inv.push({id:'iceskates'});fx.iceSkating=true;body.mx=body.my=0;push(1,0,true,4);const fast=body.mx;
    push(0,0,false,1);const coast=body.mx;
    a=Math.PI/2;push(1,0,true,.2);const carve=body.my>0&&body.mx>0;
    const moving=Math.hypot(body.mx,body.my);K.KeyC=1;push(0,0,false,.5);const brake=Math.hypot(body.mx,body.my);
    K.KeyC=0;a=0;body.mx=body.my=0;push(Math.SQRT1_2,Math.SQRT1_2,true,8);
    return {walk,slip,fast,coast,carve,moving,brake,diagonal:Math.hypot(body.mx,body.my)};
  })()`);
  assert.ok(result.walk<=.501&&result.slip>0&&result.slip<result.walk);
  assert.ok(result.fast>result.walk*3&&result.fast<=2.801);
  assert.ok(result.coast>1&&result.coast<result.fast);
  assert.ok(result.carve&&result.brake<result.moving*.1);
  assert.ok(result.diagonal<=2.801);
});
test('skates can be bought, equipped and used without occupying the held slot',()=>{
  const result=read(`(()=>{
    inv.length=0;held=-1;const paid=buy('iceskates')[0];held=inv.findIndex(it=>it.id==='iceskates');
    useHeld({indoors:false});held=-1;const equipped=iceSkatesOn();
    inv.length=0;stepWinterOcean();return {paid,equipped,removed:!iceSkatesOn()};
  })()`);
  assert.deepEqual(result,{paid:true,equipped:true,removed:true});
});
