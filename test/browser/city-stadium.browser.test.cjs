'use strict';
// The Yards ground (city/stadium.js): the match engine played out by real figures on a marked pitch, four stands of
// supporters you can climb and sit in, the TV view on V, and E to leave whenever you like.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
let browser;test.before(async()=>browser=await chromium.launch());test.after(async()=>browser?.close());
async function ground(run){const p=await browser.newPage({viewport:{width:1200,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
 await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;weather='clear';env(0);render(0);const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24+.3;enterStadium('main');body.seat=null;env(0);render(0);});
 await run(p);assert.deepEqual(errors,[]);}finally{await p.close();}}

test('inside, the match plays on as you watch, and the scoreboard keeps up',()=>ground(async p=>{
 const r=await p.evaluate(()=>{const m0=MatchEngine.minute(stadiumMatch);for(let k=0;k<200;k++){T+=.1;render(0);}
  const f=stadiumNextFixture();return{room:room.kind,before:m0,after:MatchEngine.minute(stadiumMatch),home:stadiumMatch.teams[0].club.id,away:stadiumMatch.teams[1].club.id,fh:f.home,fa:f.away};});
 assert.equal(r.room,'stadium');assert.equal(r.home,r.fh);assert.equal(r.away,r.fa);
 assert.ok(r.after-r.before>2.4,`20 s of play is ${(r.after-r.before).toFixed(1)} match minutes`);
}));

test('the stands rise row by row: you can sit high in the main stand and see the pitch over the heads in front',()=>ground(async p=>{
 const r=await p.evaluate(()=>{px=75;py=6.5;a=Math.PI/2;const s=nearSeat();if(!s)return{none:true};sitDown();pitch=-.3;env(0);render(0);
  let white=0,green=0;for(let i=0;i<BG.length;i++){const b=BG[i]>>4;if(b===GREEN)green++;if(b===WHITE&&(BG[i]&15)>=9)white++;}
  return{eye,rise:stairRise(px,py),seated:!!body.seat,green:green/BG.length,white};});
 assert.ok(!r.none,'a seat');assert.ok(r.seated);assert.ok(r.rise>5,'up the stand');assert.ok(r.eye>r.rise,'sitting on it');
 assert.ok(r.green>.12,'the pitch in view');assert.ok(r.white>20,'its markings');
}));

test('V puts the match on TV from the gantry, players and ball large; V again and you are back in your seat; E leaves',()=>ground(async p=>{
 await p.evaluate(()=>{px=75;py=6.5;a=Math.PI/2;sitDown();MatchEngine.step(stadiumMatch,40);});
 await p.keyboard.press('KeyV');
 const tv=await p.evaluate(()=>{
  const shot=()=>{const saved=[px,py,a,pitch],baseFOV=FOV,cam=stadiumCam(1);FOV=cam.fov;stadiumView={eye:cam.z};px=cam.x;py=cam.y;a=cam.a;pitch=cam.pitch;render(0);[px,py,a,pitch]=saved;stadiumView=null;FOV=baseFOV;return BG.slice();};
  const withPlayers=shot(),draw=drawFigure;drawFigure=()=>{};let without;try{without=shot();}finally{drawFigure=draw;}
  let changed=0;for(let i=0;i<withPlayers.length;i++)if(withPlayers[i]!==without[i])changed++;
  return{on:stadiumTVOn(),changed,prompt:promptText()};});
 assert.equal(tv.on,true);assert.ok(tv.changed>60,'the players, close enough to see: '+tv.changed+' cells');assert.match(tv.prompt,/V: back to your seat/);
 await p.keyboard.press('KeyV');assert.equal(await p.evaluate(()=>stadiumTVOn()),false);
 assert.match(await p.evaluate(()=>promptText()),/E: leave the ground/);
 await p.evaluate(()=>interact());
 assert.equal(await p.evaluate(()=>mode==='room'&&room?.kind==='stadium'),false,'out of the ground');
}));

test('the boards keep you off the pitch, and the pitch is marked where the engine plays',()=>ground(async p=>{
 const r=await p.evaluate(()=>{const P=MatchEngine.PITCH;px=STADIUM.cx;py=STADIUM.cy-P.hw-4.5;const blocked=!free(px,STADIUM.cy-P.hw-STADIUM.board);
  px=STADIUM.cx;py=STADIUM.cy;a=Math.PI/2;pitch=-.7;env(0);render(0);let white=0;for(let i=0;i<BG.length;i++)if((BG[i]>>4)===WHITE)white++;
  return{blocked,white,mark:pitchMarkDist(0,P.hw,0,P.hw),grass:pitchMarkDist(20,20,20,20)};});
 assert.ok(r.blocked,'the advertising boards are in the way');assert.ok(r.white>30,'the halfway line and centre circle round you');
 assert.ok(r.mark<.01);assert.ok(r.grass>1);
}));

test('the TV picture is just the match: no hand, no quick slots, and the ball big enough to follow',()=>ground(async p=>{
 const r=await p.evaluate(()=>{clearInventory();carryItem({id:'soda',uses:1});held=0;
  let hand=0;const big=drawHeldBig;drawHeldBig=()=>{hand++;};
  try{stadiumTV=false;hud();const seat={hand,slots:hotbarUp()};hand=0;stadiumTV=true;hud();const tv={hand,slots:hotbarUp()};
   const cam=stadiumCam(1),d=Math.hypot(pitchX(stadiumMatch.ball.p[0])-cam.x,pitchY(stadiumMatch.ball.p[1])-cam.y);
   return{seat,tv,ballCells:2*Math.max(.32,d*1.8/projY)*projY/d};}finally{drawHeldBig=big;stadiumTV=false;}});
 assert.deepEqual(r.seat,{hand:1,slots:true},'in your seat, your soda in your hand');
 assert.deepEqual(r.tv,{hand:0,slots:false},'on the TV, neither');
 assert.ok(r.ballCells>=3,'the ball three cells or more across on TV');
}));

test('up close the crowd are people on seats; further off the rows stand in for them, and nobody is drawn twice',()=>ground(async p=>{
 const r=await p.evaluate(()=>{px=75;py=12.5;a=Math.PI/2;sitDown();a=Math.PI/2;pitch=-.25;env(0);
  const draw=drawFigure;let figs=0,poses=new Set();drawFigure=(...g)=>{figs++;poses.add(g[7]);return draw(...g);};
  try{render(0);}finally{drawFigure=draw;}
  const s=STANDS.find(x=>x.id==='north'),near=crowdNear(s,3,0),far=crowdNear(s,3,40);
  return{figs,poses:[...poses],near,far};});
 assert.ok(r.figs>15,'supporters round you drawn as people: '+r.figs);
 assert.ok(r.poses.some(p=>/^sit/.test(p)),'sat down');
 assert.equal(r.near,true);assert.equal(r.far,false);
}));
