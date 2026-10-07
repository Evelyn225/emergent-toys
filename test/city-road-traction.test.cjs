'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();

test('road grip follows lingering wetness and settled snow, with a moderate lower bound', () => {
  const r = JSON.parse(ev(`JSON.stringify((()=>{
    const point=cars.find(c=>snowExposed(c.x,c.y)),x=point.x,y=point.y;
    wet=rain=snowCover=snow=0;const dry=roadTraction(x,y);
    rain=1;const raining=roadTraction(x,y);
    rain=0;wet=1;const wetRoad=roadTraction(x,y);
    wet=0;snow=1;const fallingSnow=roadTraction(x,y);
    snowCover=.5;const dusting=roadTraction(x,y);
    snowCover=1;const snowy=roadTraction(x,y);
    wet=rain=1;const slush=roadTraction(x,y);
    wet=rain=snowCover=0;return {dry,raining,wetRoad,fallingSnow,dusting,snowy,slush,dried:roadTraction(x,y)};
  })())`));
  assert.equal(r.dry,1);
  assert.equal(r.fallingSnow,1,'flakes in the air alone do not make the road snowy');
  assert.ok(r.raining<1 && r.raining>r.wetRoad);
  assert.equal(r.wetRoad,.8);
  assert.equal(r.dusting,.8);
  assert.equal(r.snowy,.6);
  assert.equal(r.slush,.55);
  assert.equal(r.dried,1);
});

test('snow does not reduce grip beneath the elevated train or a covered shopping street', () => {
  const r = JSON.parse(ev(`JSON.stringify((()=>{
    wet=rain=0;snowCover=1;
    const canopy=ROAD.findIndex((road,cell)=>road>0&&arcadeAt(cell%N+.5,Math.floor(cell/N)+.5));
    return {el:roadTraction(41,EL_Y+1),wrapped:roadTraction(41+N,EL_Y+1-N),
      arcade:roadTraction(canopy%N+.5,Math.floor(canopy/N)+.5)};
  })())`));
  assert.equal(r.el,1);
  assert.equal(r.wrapped,1);
  assert.equal(r.arcade,1);
});

test('pursuing cruisers retain solid car contact when braking and steering on wet roads or snow', () => {
  const { ev: run } = loadCity();
  run(`cars.length=people.length=footCops.length=0;evTimer=1000;T=10;mode='drive';
    for(let y=68;y<82;y++)for(let x=32;x<66;x++)map[idx(x,y)]=0;
    wanted.stars=1;wanted.seen=true;wanted.lastX=41;wanted.lastY=73;`);
  const results=JSON.parse(run(`JSON.stringify(['rain','snow'].map(surface=>{
    cars.length=0;wet=rain=surface==='rain'?1:0;snowCover=surface==='snow'?1:0;
    me=addCar({x:41,y:73,hx:1,hy:0,v:1,player:true});px=me.x;py=me.y;
    const cop=addCar({x:42.5,y:73,hx:-1,hy:0,v:2,kind:'police',pursuit:true,travelA:Math.PI,dest:[41,73]});
    let overlap=false,clear=true;
    for(let k=0;k<70;k++){
      stepTraffic(.05,T+=.05,true);overlap ||= !!carContact(cop,me);
      clear &&= carBodyClear(cop.x,cop.y,cop.hx,cop.hy)&&carBodyClear(me.x,me.y,me.hx,me.hy);
    }
    return {surface,overlap,clear,contact:me.v<1};
  }))`));
  for(const r of results)assert.ok(!r.overlap&&r.clear&&r.contact,JSON.stringify(r));
});
