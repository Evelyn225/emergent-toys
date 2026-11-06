'use strict';
// Replays and celebrations at the ground (stadium.js, phase 6): every goal's build-up played back slowed down on the big
// screen and, with the TV view on, from behind that goal; the scorer arms aloft, mobbed; the other lot, hands on heads.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
test('after a goal: celebrations, then the replay on the big screen and the TV',async()=>{
 const browser=await chromium.launch(),p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.addInitScript(()=>requestAnimationFrame=()=>0);await p.goto(pathToFileURL(path.resolve(__dirname,'../../ascii-city.html')).href);
  const r=await p.evaluate(()=>{paused=false;mode='walk';room=me=null;T=10;env(0);render(0);const f=stadiumNextFixture();dayNum=Math.floor(f.kick/24);tod=f.kick-dayNum*24+.01;enterStadium('main');
   const m=stadiumMatch;let k=0;while(!m.events.some(e=>e.kind==='goal')&&k++<40000){MatchEngine.tick(m);stadiumAtmosphere();}
   const goal=m.events.find(e=>e.kind==='goal');if(!goal)return{noGoal:true};
   for(let j=0;j<90;j++){MatchEngine.tick(m);T+=.05;stadiumAtmosphere();} // (four and a half seconds of celebrating)
   // the poses drawn: who's cheering, who's dejected
   const poses={};const draw=drawFigure;drawFigure=(rx,ry,z,h,fx,fy,look,pose)=>{poses[pose]=(poses[pose]||0)+1;};
   try{px=STADIUM.cx;py=6.5;a=Math.PI/2;env(0);render(0);}finally{drawFigure=draw;}
   const queued=!!(stadiumReplayPending||stadiumReplay),phase=m.phase;
   for(let j=0;j<30;j++){T+=.1;tickStadiumReplay();}
   const on=!!stadiumReplay,frames=stadiumReplay?.frames.length,end=stadiumReplay?.end,lastBall=stadiumReplay?.frames.at(-1).b[0];
   stadiumTV=true;const cam=stadiumCam(.1),f0=stadiumReplayFrame();
   // the big screen during it
   let screen=0;const sb=room.props.find(q=>q.draw&&q.radius===12);const realBox=drawBox;
   for(let j=0;j<3;j++){T+=.5;tickStadiumReplay();}
   const f1=stadiumReplayFrame(),moved=f0&&f1?Math.hypot(f1.b[0]-f0.b[0],f1.b[1]-f0.b[1]):0;
   for(let j=0;j<200&&stadiumReplay;j++){T+=.1;tickStadiumReplay();}
   stadiumTV=false;
   return{goalSide:goal.side,phase,queued,on,frames,end,lastBall,cam:{x:cam.x,behind:Math.abs(cam.x-STADIUM.cx)>MatchEngine.PITCH.hl},moved,over:!stadiumReplay,poses};});
  assert.ok(!r.noGoal,'a goal to replay');assert.equal(r.phase,'goal');assert.ok(r.queued,'a replay queued');
  assert.ok(r.on,'and played a few seconds later');assert.ok(r.frames>=40,'five seconds of build-up');assert.equal(Math.sign(r.lastBall),r.end,'at the end it went in');
  assert.ok(r.cam.behind,'the TV watches it from behind that goal');assert.ok(r.moved>.3,'the replay moves on');assert.ok(r.over,'and finishes');
  assert.ok((r.poses.cheer||0)>=2,'the scorer and those mobbing them, arms up '+JSON.stringify(r.poses));assert.ok((r.poses.dejected||0)>=1,'the other side, hands on heads');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
