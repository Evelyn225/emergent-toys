'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');

function street() {
  const { ev } = loadCity();
  ev(`cars.length=0;people.length=0;footCops.length=0;evTimer=1000;T=10;
    px=41;py=73;mode='drive';
    for(let y=68;y<83;y++)for(let x=32;x<66;x++){map[idx(x,y)]=0;SHOP[idx(x,y)]=null;}
    me=addCar({x:px,y:py,hx:1,hy:0,player:true,v:0});
    wanted.stars=1;wanted.seen=true;wanted.lastX=px;wanted.lastY=py;
    var cop=addCar({x:36,y:73,hx:1,hy:0,kind:'police',patrol:true,pursuit:true,dest:[px,py],cruise:COP_CAR_SPEED});`);
  return ev;
}

test('cruisers accelerate progressively and cap both dispatch and close pursuit at 72km/h', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    cop.dest=[62,73];wanted.seen=false;let maxAccel=0,maxSpeed=0;
    for(let k=0;k<130;k++){const old=cop.v;stepTraffic(.05,T+=.05,true);maxAccel=Math.max(maxAccel,(cop.v-old)/.05);maxSpeed=Math.max(maxSpeed,cop.v);}
    return {maxAccel,maxSpeed};
  })())`));
  assert.ok(result.maxAccel<=.450001,JSON.stringify(result));
  assert.ok(result.maxSpeed>1.8 && result.maxSpeed<=2.000001,JSON.stringify(result));
});

test('ramming separates both bodies, slows the driver, and never pushes them through a wall', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    // A head-on interception, including a coarse frame that would otherwise tunnel through a car.
    me.v=1;cop.x=42;cop.ex=cop.x;cop.hx=-1;cop.v=2;cop.travelA=Math.PI;
    let hit=false,clear=true,overlap=false;
    for(let k=0;k<35;k++){
      const old=me.v;cop.dest=[me.x,me.y];stepTraffic(.1,T+=.1,true);
      hit ||= me.v<old;overlap ||= !!carContact(cop,me);
      clear &&= carBodyClear(me.x,me.y,me.hx,me.hy)&&carBodyClear(cop.x,cop.y,cop.hx,cop.hy);
    }
    return {hit,clear,overlap,driverSpeed:me.v};
  })())`));
  assert.equal(result.hit,true,JSON.stringify(result));
  assert.equal(result.overlap,false,JSON.stringify(result));
  assert.equal(result.clear,true,JSON.stringify(result));
  assert.ok(result.driverSpeed<1,JSON.stringify(result));
  ev('map[idx(41,72)]=3;me.y=me.ey=73.11;me.v=1;cop.x=cop.ex=41;cop.y=cop.ey=73.6;cop.hx=0;cop.hy=-1;cop.travelA=-Math.PI/2;cop.v=1.4;cop.dest=[me.x,me.y]');
  ev('for(let k=0;k<30;k++){stepTraffic(.05,T+=.05,true);if(!carBodyClear(me.x,me.y,me.hx,me.hy)||carContact(cop,me))throw Error("invalid contact against wall");}');
});

test('a rear-quarter side impact performs a PIT, and contact wraps across the world seam', () => {
  const ev=street();
  ev('me.v=1.5;cop.x=cop.ex=40.8;cop.y=cop.ey=73.5;cop.hx=0;cop.hy=-1;cop.travelA=-Math.PI/2;cop.v=1.3;cop.dest=[40.8,73];wanted.lastX=me.x;wanted.lastY=me.y');
  ev('for(let k=0;k<20&&!wanted.pitPending;k++)steerCruiser(cop,40.8,73,2,.05,false)');
  assert.ok(ev('me.spunT>T && wanted.pitPending'),'physical side impact at the rear quarter spins the driver');
  assert.equal(ev('stepCrime(.05)'),'pit');
  assert.equal(ev('!!carContact({...cop,ex:N-.1,ey:73,hx:1,hy:0},{...me,ex:.1,ey:73,hx:1,hy:0})'),true);
});

test('interceptions at varied angles keep both oriented bodies separate', () => {
  const ev=street();
  ev(`for(let k=0;k<24;k++){
    const angle=k*Math.PI/12,heading=angle*.7;
    me.x=me.ex=45;me.y=me.ey=75;me.hx=Math.cos(heading);me.hy=Math.sin(heading);me.v=.9;
    cop.x=cop.ex=45+Math.cos(angle)*1.5;cop.y=cop.ey=75+Math.sin(angle)*1.5;
    cop.hx=-Math.cos(angle);cop.hy=-Math.sin(angle);cop.travelA=angle+Math.PI;cop.v=1.7;cop.dest=[45,75];
    for(let j=0;j<60;j++){
      cop.dest=[me.x,me.y];stepTraffic(.1,T+=.1,true);
      if(carContact(cop,me)||!carBodyClear(me.x,me.y,me.hx,me.hy)||!carBodyClear(cop.x,cop.y,cop.hx,cop.hy))throw Error('invalid impact at angle '+angle);
    }
  }`);
});

test('returning sideways cruisers choose enough space to straighten beside a parked car', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    me.x=me.ex=41.4;me.hx=0;me.hy=1;me.player=false;me.parked=true;mode='walk';px=42;py=74;
    cop.x=cop.ex=41.4;cop.y=cop.ey=73.36;cop.hx=1;cop.hy=0;cop.pursuit=false;cop.returning=true;
    const lane=policeReturnLane(cop),available=!carContact(cop,me,lane.x,lane.y,lane.hx,lane.hy);
    cop.merging=lane;let clear=true;
    for(let k=0;k<400&&cop.merging;k++){stepTraffic(.05,T+=.05,true);clear &&= !carContact(cop,me)&&carBodyClear(cop.x,cop.y,cop.hx,cop.hy);}
    return {available,clear,merged:!cop.merging};
  })())`));
  assert.deepEqual(result,{available:true,clear:true,merged:true});
});

test('a stationary suspect is boxed in without the cruiser orbiting or overlapping them', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    let overlap=false;
    for(let k=0;k<240;k++){cop.dest=[me.x,me.y];stepTraffic(.05,T+=.05,true);overlap ||= !!carContact(cop,me);}
    const start=[cop.x,cop.y];
    for(let k=0;k<100;k++)stepTraffic(.05,T+=.05,true);
    return {overlap,gap:near(cop.x,cop.y,me.x,me.y),wander:near(cop.x,cop.y,...start),speed:cop.v};
  })())`));
  assert.equal(result.overlap,false,JSON.stringify(result));
  assert.ok(result.gap<.65 && result.wander<.01 && result.speed<.01,JSON.stringify(result));
});

test('paying a driving fine clears pursuit steering and returns to a lane beside the parked car', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    cop.x=cop.ex=41.5;cop.y=cop.ey=73;cop.hx=-1;cop.hy=0;cop.v=1.5;cop.travelA=Math.PI;
    cop.route=[[40,73]];cop.routeT=1;cop.pursuitDrive=true;money=200;payFine();
    const reset=!cop.route&&!cop.travelA&&!cop.pursuitDrive&&cop.v===0;
    me.player=false;me.parked=true;me.owned=true;mode='walk';px=42;py=74;
    let quiet=true,overlap=false,merged=false;
    for(let k=0;k<600&&cars.includes(cop);k++){
      T+=.05;stepCrime(.05);stepTraffic(.05,T,true);quiet &&= !code(cop)&&!lightsOn_(cop);
      overlap ||= !!carContact(cop,me);merged ||= !cop.waitingCrew&&!cop.merging;
    }
    return {reset,quiet,overlap,merged,moved:near(cop.x,cop.y,41.5,73)>.6,money};
  })())`));
  assert.deepEqual(result,{reset:true,quiet:true,overlap:false,merged:true,moved:true,money:150});
});

test('losing sight preserves the last travel direction and searches round a blind corner', () => {
  const ev=street();
  const result=JSON.parse(ev(`JSON.stringify((()=>{
    me.v=1.5;me.travelA=0;stepCrime(.05);
    // All observers are out of sight. The hidden driver moves elsewhere; that position is not a radio tip.
    cop.x=cop.ex=32;cop.y=cop.ey=82;px=60;py=80;
    for(let y=70;y<78;y++)map[idx(44,y)]=3;
    for(let k=0;k<30;k++){T+=.05;stepCrime(.05);}
    wanted.searchT=0;stepCrime(0);
    const first=[...cop.dest],last=[wanted.lastX,wanted.lastY],velocity=[wanted.lastVX,wanted.lastVY];
    px=58;py=69;wanted.searchT=0;stepCrime(0);
    return {first,same:near(...first,...cop.dest)<.00001,last,velocity,seen:wanted.seen};
  })())`));
  assert.deepEqual(result.last,[41,73]);
  assert.deepEqual(result.velocity,[1.5,0]);
  assert.equal(result.seen,false);
  assert.equal(result.same,true,'unseen movement cannot change the predicted target');
  assert.ok(result.first[0]>43 && result.first[0]<44 && Math.abs(result.first[1]-73)>.5,JSON.stringify(result));
});
