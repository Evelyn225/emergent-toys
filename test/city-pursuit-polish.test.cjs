'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadCity}=require('./helpers/load-city.cjs');

test('foot officers reach a car window without walking through its rotated hull',()=>{
 const {ev}=loadCity();
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  mode='drive';px=41;py=73;cars.length=0;footCops.length=0;
  me={x:px,y:py,ex:px,ey:py,hx:1,hy:0,v:0,kind:'car'};cars.push(me);
  const c={x:px-.7,y:py,chase:true,ph:0};let overlaps=0;
  for(let n=0;n<150;n++){T+=.02;chaseStep(c,px,py,.02);if(carPersonOverlap(me,c)>.0001)overlaps++;}
  return {overlaps,window:Math.hypot(c.x-px,c.y-(py+.2))<.06};
 })())`));
 assert.deepEqual(result,{overlaps:0,window:true});
});

test('stopping in a police blockade leads to arrest and homicide at four stars draws fire',()=>{
 const {ev}=loadCity();
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  mode='drive';px=41;py=73;cars.length=0;footCops.length=0;people.length=0;
  me={x:px,y:py,ex:px,ey:py,hx:1,hy:0,v:0,player:true,kind:'car'};cars.push(me);
  footCops.push({x:px,y:py+.2,chase:true,ph:0});Object.assign(wanted,{stars:4,killed:1,fired:false,lastX:px,lastY:py,searchX:px,searchY:py});
  copsShoot(.01);const aimed=!!footCops[0].fireT;
  footCops[0].fireT=T-.01;copsShoot(.01);const shots=gun.copShots.length;
  let result;for(let n=0;n<40&&!wanted.busted;n++){T+=.05;result=stepCrime(.05);}
  return {aimed,shots,busted:wanted.busted,result};
 })())`));
 assert.equal(result.aimed,true);assert.ok(result.shots>0);assert.equal(result.busted,true);assert.equal(result.result,'busted');
});

test('paying a heist fine confiscates stolen valuables and preserves ordinary purchases',()=>{
 const {ev}=loadCity();
 ev(`money=5000;carryItem({id:'hotelmasterpiece',uses:0});carryItem({id:'diamond',uses:0});carryItem({id:'water',uses:3});wanted.stars=3;wanted.killed=0;`);
 assert.equal(ev('payFine()'),true);assert.equal(ev("inv.some(it=>it.id==='hotelmasterpiece'||it.id==='diamond')"),false);assert.equal(ev("inv.some(it=>it.id==='water')"),true);assert.equal(ev('wanted.stars'),0);
});

test('the helicopter sees over low walls, respects tall buildings and cannot see an indoor player',()=>{
 const {ev}=loadCity();
 const result=JSON.parse(ev(`JSON.stringify((()=>{
  mode='walk';px=41;py=73;wanted.stars=5;wanted.searchX=px;wanted.searchY=py;
  heli={x:35,y:73,z:4,h:0,sx:px,sy:py,sweep:0,leaving:false};
  for(let x=35;x<=41;x++)map[idx(x,73)]=0;
  map[idx(38,73)]=.5;const low=heliLineOfSight(px,py);map[idx(38,73)]=7;const tall=heliLineOfSight(px,py);
  map[idx(38,73)]=0;heli.sx=heli.x;heli.sy=heli.y;const sight=stepHeli(.05);
  mode='room';room={ret:[px,py,0]};const inside=stepHeli(.05);
  return {low,tall,sight,inside};
 })())`));assert.deepEqual(result,{low:true,tall:false,sight:true,inside:false});
});

test('permanent deaths are prone from the first frame, and the telescope can be raised and lowered',()=>{
 const {ev}=loadCity();
 for(const t of [0,.1,2,10000])assert.equal(ev(`downPose({t:${t},dur:Infinity})`),'dead');
 ev("mode='walk';carryItem({id:'telescope',uses:0});held=inv.length-1;");
 assert.match(ev('useHeld(heldItem())[0]'),/raise/);assert.equal(ev('fx.telescope'),true);
 assert.match(ev('useHeld(heldItem())[0]'),/lower/);assert.equal(ev('fx.telescope'),false);
});

test('a cruiser blocked by traffic promptly backs out for a fresh approach without overlapping it',()=>{
 const {ev}=loadCity();
 const r=JSON.parse(ev(`JSON.stringify((()=>{
  mode='drive';px=46;py=73.4;cars.length=0;wanted.seen=true;
  me={x:px,y:py,ex:px,ey:py,hx:1,hy:0,v:1,kind:'car'};
  const cop={id:0,x:42.8,y:73.4,ex:42.8,ey:73.4,hx:1,hy:0,v:.5,kind:'police',pursuit:true,dest:[px,py]},obstacle={x:43.4,y:73.4,ex:43.4,ey:73.4,hx:1,hy:0,v:0,kind:'car'};
  cars.push(me,cop,obstacle);let recovery=false,overlap=false;
  for(let n=0;n<80;n++){T+=.05;stepPursuitCar(cop,.05);recovery||=cop.backout>0;overlap||=!!carContact(cop,obstacle);}
  return {recovery,overlap,goal:!!cop.detourGoal||cop.x>43.7};
 })())`));assert.equal(r.recovery,true);assert.equal(r.overlap,false);assert.equal(r.goal,true);
});
