'use strict';
// Four fixes: a cast lure catches people and reels them in; the soccer ball keeps to the ground on the islands' hills;
// overlapping blood pools run together; and the chase camera's ground detail no longer draws in below the car.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';tod=13;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('a cast through somebody hooks them; Q reels them in to your feet, and they let you have it',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  const v=people.find(q=>!q.hidden&&!q.inside&&!q.dead&&free(q.x+.6,q.y)&&free(q.x+.3,q.y)&&!map[idx(Math.floor(q.x+.6),Math.floor(q.y))]);for(const q of people)if(q!==v)q.hidden=true;
  px=v.x+.6;py=v.y;a=Math.PI;clearInventory();carryItem({id:'rod',uses:0});held=0;
  fishing={st:'wind',t:0,power:.225,rod:heldItem().id};castLine();
  for(let k=0;k<120&&fishing&&fishing.st==='fly';k++){T+=1/60;stepFishing(1/60);}
  const hooked=fishing?.st==='hooked'&&fishing.who===v&&!!v.hooked,x0=v.x;
  for(let k=0;k<30;k++){T+=1/60;stepFishing(1/60);stepPeople(1/60);} // (held: they don't walk off with it)
  const stayed=Math.abs(v.x-x0)<1e-9;rodUse({});
  let k=0;for(;k<600&&fishing;k++){T+=1/60;stepFishing(1/60);}
  return{hooked,stayed,done:!fishing,d:Math.hypot(v.x-px,v.y-py),free:!v.hooked,said:msgText};});
 assert.ok(r.hooked,'hooked');assert.ok(r.stayed,'held on the line');assert.ok(r.done&&r.free,'unhooked at the end');
 assert.ok(r.d<.11,'reeled in to your feet: '+r.d);assert.match(r.said,/"/);
}));

test('the ball keeps to the ground over the island hills, and rolls down them',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  let spot=null;for(let k=0;k<N*N&&!spot;k+=7){const x=k%N+.5,y=(k/N|0)+.5;if(!onIsland(x,y)||isWater(x,y))continue;const g=outdoorGroundHeight(x,y),gx=outdoorGroundHeight(x+.05,y)-outdoorGroundHeight(x-.05,y);if(g>.05&&Math.abs(gx)>.004&&!isWater(x+.3,y)&&!isWater(x-.3,y))spot=[x,y,gx];}
  const[x,y,gx]=spot;ball={x,y,vx:0,vy:0,z:0,vz:0};for(let k=0;k<120&&ball;k++)stepBall(1/60);
  const rolled=ball?Math.sign(ball.x-x)===-Math.sign(gx)&&Math.abs(ball.x-x)>.05:false;
  ball={x,y,vx:1.8,vy:.6,z:.02,vz:.6};let under=0;for(let k=0;k<300&&ball;k++){stepBall(1/60);if(ball&&ball.z<0)under++;}
  return{rolled,under};});
 assert.ok(r.rolled,'downhill');assert.equal(r.under,0,'never under the ground it is over');
}));

test('overlapping blood pools run together: neither cuts the other out',()=>city(async p=>{
 const r=await p.evaluate(()=>{
  for(const q of people)q.hidden=true;let x=0,y=0;for(let k=0;k<N*N;k++){const X=k%N,Y=k/N|0;if(ROAD[k]===1&&!map[k]&&free(X+.5,Y+.5)){x=X+.5;y=Y+.5;break;}}
  px=x;py=y;a=0;pitch=-.75;
  const cells=list=>{pools.length=0;for(const q of list)pools.push({x:x+q[0],y:y+q[1],z:outdoorGroundHeight(x+q[0],y+q[1]),t:T-40});render(0);const s=new Set();for(let i=0;i<BG.length;i++){const b=BG[i]>>4;if((b===RED||b===BRICK)&&FL[i]!==undefined)s.add(i);}return s;};
  const A=cells([[.25,0]]),B=cells([[.33,.05]]),AB=cells([[.25,0],[.33,.05]]);
  let lost=0;for(const i of A)if(!AB.has(i))lost++;for(const i of B)if(!AB.has(i))lost++;
  return{a:A.size,b:B.size,ab:AB.size,lost};});
 assert.ok(r.a>50&&r.b>50);assert.ok(r.lost<(r.a+r.b)*.03,'every cell of either pool is still blood with both down: '+JSON.stringify(r));
}));

test('chase camera: the ground behind the car is filtered as it is at the car, not sharper',()=>city(async p=>{
 const r=await p.evaluate(()=>{const near=homeBalconyPavingFootprint(.2,.28);groundFootprintNear=.9;const clamped=homeBalconyPavingFootprint(.2,.28),atCar=homeBalconyPavingFootprint(.9,.28),far=homeBalconyPavingFootprint(3,.28);
  groundFootprintNear=0;return{near,clamped,atCar,far,back:homeBalconyPavingFootprint(3,.28)};});
 assert.ok(r.clamped>r.near*5&&Math.abs(r.clamped-r.atCar)<1e-9,'no finer than at the car');assert.equal(r.far,r.back,'further off, unchanged');
}));
