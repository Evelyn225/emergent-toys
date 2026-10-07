'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

test('nearby foot officers do not pin an innocent driver; real contact still stops the car and reports a hit',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../../ascii-city.html')).href);
    await page.waitForFunction(()=>typeof drive==='function'&&Number.isFinite(eye));
    const r=await page.evaluate(()=>{
      paused=true;mode='drive';room=null;people.length=0;body.z=body.vz=0;
      lampsB.forEach(b=>b.length=0);solidsB.forEach(b=>b.length=0);
      for(let y=68;y<79;y++)for(let x=35;x<49;x++)map[idx(x,y)]=0;
      wet=rain=snowCover=0;
      function scenario(ox,oy,{reverse=false,speed=0,stars=0,yaw=0}={}) {
        clearWanted();cars.length=footCops.length=0;
        for(const k of Object.keys(K))K[k]=false;
        K[reverse?'KeyS':'KeyW']=true;
        a=yaw;const hx=Math.cos(a),hy=Math.sin(a);
        me=addCar({x:41,y:73,hx,hy,player:true,v:speed,travelA:a});px=41;py=73;
        const officer={x:41+hx*ox-hy*oy,y:73+hy*ox+hx*oy,chase:!!stars,ph:0};
        footCops.push(officer);wanted.stars=stars;
        const start=carPersonOverlap(me,officer);
        for(let k=0;k<30;k++)drive(.05);
        return {along:(me.x-41)*hx+(me.y-73)*hy,speed:me.v,stars:wanted.stars,start};
      }
      const beside=[0,Math.PI/2,Math.PI/4].map(yaw=>scenario(.22,.147,{yaw}));
      const reverseBeside=scenario(-.22,.147,{reverse:true});
      const overlap=scenario(.22,.03),reverseOverlap=scenario(-.22,.03,{reverse:true});
      const approaching=scenario(.3,0),backingAway=scenario(.3,0,{reverse:true});
      const hit=scenario(.32,0,{speed:1}),wantedHit=scenario(.32,0,{speed:1,stars:1});
      return {beside,reverseBeside,overlap,reverseOverlap,approaching,backingAway,hit,wantedHit};
    });
    for(const s of r.beside){assert.ok(s.along>1,JSON.stringify(r));assert.equal(s.stars,0);}
    assert.ok(r.reverseBeside.along<-.4);assert.equal(r.reverseBeside.stars,0);
    assert.ok(r.overlap.start>0&&r.overlap.along>1);assert.equal(r.overlap.stars,0);
    assert.ok(r.reverseOverlap.start>0&&r.reverseOverlap.along<-.4);assert.equal(r.reverseOverlap.stars,0);
    assert.ok(r.approaching.along>0&&r.approaching.along<.04);assert.equal(r.approaching.speed,0);assert.equal(r.approaching.stars,0);
    assert.ok(r.backingAway.along<-.4);assert.equal(r.backingAway.stars,0);
    assert.equal(r.hit.speed,0);assert.ok(r.hit.stars>0);assert.ok(r.wantedHit.stars>1);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
