'use strict';
// The Grand Hotel's lobby furnished as a grand hotel's, and the car dealership as a real showroom.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function city(run){const p=await browser.newPage({viewport:{width:1000,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';tod=14;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('the Grand Hotel lobby: rugs, two sitting areas with armchairs and lamps, a colonnade, chandeliers, a concierge, guests, lifts',()=>city(async p=>{
 const r=await p.evaluate(()=>{enterRoom('grandhotel',{word:'GRAND HOTEL',ret:[100,100,0]},[12,15.4,-Math.PI/2]);
  const P=room.props,seats=P.filter(q=>q.seat).length,guests=P.filter(q=>q.fig).length,cols=P.filter(q=>q.hotelColumn).length,lamps=P.filter(q=>q.hotelChandelier).length,concierge=P.some(q=>q.concierge);
  const rugs=P.filter(q=>q.walk&&q.box&&q.box.z1<=.02).length;
  // the right-hand wall has the lift doors in brass
  let brass=0;for(const y of [GRAND_LIFTS[0],GRAND_LIFTS[1]])for(const z of [.5,1.2,2]){room.def.wall(0,y+.2,.01,z,3,room.W-1,8,8);if((BG[0]>>4)===YEL)brass++;}
  // from the doors you see the warm walls and gilt, not bare grey
  px=12;py=15.4;a=-Math.PI/2;pitch=-.05;render(0);let grey=0,warm=0;for(let i=0;i<BG.length;i++){const b=BG[i]>>4;if(b===GRAY)grey++;if(b===BRICK||b===YEL||b===STONE||b===RED)warm++;}
  return{seats,guests,cols,lamps,concierge,rugs,brass,warm:warm/BG.length};});
 assert.ok(r.seats>=10,'seats: '+r.seats);assert.ok(r.guests>=6,'guests: '+r.guests);assert.ok(r.cols>=6&&r.lamps>=3);assert.ok(r.concierge);
 assert.ok(r.rugs>=3,'rugs');assert.equal(r.brass,6,'lift doors');assert.ok(r.warm>.35,'warm finishes: '+r.warm.toFixed(2));
}));

test('the car showroom: three full-size cars (one turning), a price on each, the dealer\'s wall, room to walk round them',()=>city(async p=>{
 const r=await p.evaluate(()=>{enterRoom('showroom',{word:'CARS',neon:RED,ret:[100,100,0]},[9,11.4,-Math.PI/2]);
  const cars=room.props.filter(q=>q.showroomCar),prices=room.props.filter(q=>q.showroomPrice).length;
  px=9;py=11.4;a=-Math.PI/2;pitch=-.1;render(0);const one=Int16Array.from(BG);T+=5;render(0);let turned=0;for(let i=0;i<BG.length;i++)if(BG[i]!==one[i])turned++;
  return{W:room.W,H:room.H,cars:cars.length,prices,turned,route:roomPath(9,11.4,14.5,3.4).length>0};});
 assert.ok(r.W>=18&&r.H>=13);assert.equal(r.cars,3);assert.equal(r.prices,3);assert.ok(r.turned>50,'the turntable turns: '+r.turned);assert.ok(r.route,'a way through to the desk');
}));
