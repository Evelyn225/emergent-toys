'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

test('wet and snowy driving adds mild slip and braking distance, keeps parking easy, and regains grip', async () => {
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../../ascii-city.html')).href);
    await page.waitForFunction(()=>typeof drive==='function'&&Number.isFinite(eye));
    const results=await page.evaluate(()=>{
      paused=true;clearWanted();cars.length=people.length=footCops.length=0;mode='drive';
      for(let y=68;y<82;y++)for(let x=36;x<52;x++)map[idx(x,y)]=0;
      lampsB.forEach(b=>b.length=0);solidsB.forEach(b=>b.length=0);
      function reset(surface,speed=2){
        for(const key of Object.keys(K))K[key]=false;
        wet=surface==='rain'?1:0;rain=wet;snowCover=surface==='snow'?1:0;snow=0;
        cars.length=0;me=addCar({x:41,y:73,hx:1,hy:0,player:true,v:speed,travelA:0});
        px=me.x;py=me.y;a=camYaw=look=pitch=0;
      }
      return ['dry','rain','snow'].map(surface=>{
        reset(surface);K.KeyD=true;
        for(let k=0;k<12;k++)drive(.05);
        const slip=Math.abs(a-me.travelA),speed=me.v;
        K.KeyD=false;for(let k=0;k<20;k++)drive(.05);
        const recovery=Math.abs(a-me.travelA);
        reset(surface);K.KeyS=true;let distance=0;
        for(let k=0;k<100 && me.v>.01;k++){const before=me.x;drive(.02);distance+=Math.abs(rel(me.x-before));}
        const stopped=me.v<=.01;
        reset(surface,.4);K.KeyD=true;for(let k=0;k<5;k++)drive(.05);
        const parkingSlip=Math.abs(a-me.travelA);
        reset(surface);wet=rain=snowCover=0;K.KeyD=true;
        for(let k=0;k<12;k++)drive(.05);
        const driedSlip=Math.abs(a-me.travelA);
        return {surface,slip,speed,recovery,distance,stopped,parkingSlip,driedSlip};
      });
    });
    const [dry,rain,snow]=results;
    assert.ok(dry.slip<rain.slip && rain.slip<snow.slip,JSON.stringify(results));
    assert.ok(rain.slip-dry.slip<.1 && snow.slip-dry.slip<.2,'extra slip stays below about 6 degrees in rain and 12 in snow');
    assert.ok(dry.distance<rain.distance && rain.distance<snow.distance && snow.distance/dry.distance<1.3,JSON.stringify(results));
    for(const r of results){
      assert.ok(r.speed>1 && r.stopped && r.parkingSlip===0 && r.recovery<.001,JSON.stringify(r));
      assert.ok(Math.abs(r.driedSlip-dry.slip)<1e-9,'dry roads immediately regain normal handling');
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('weather-assisted slides still collide with walls at the full rotated footprint', async () => {
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname,'../../ascii-city.html')).href);
    await page.waitForFunction(()=>typeof drive==='function'&&Number.isFinite(eye));
    const result=await page.evaluate(()=>{
      paused=true;mode='drive';cars.length=people.length=footCops.length=0;
      for(let y=70;y<76;y++)for(let x=38;x<47;x++)map[idx(x,y)]=0;
      map[idx(42,72)]=3;
      return ['rain','snow'].map(surface=>{
        wet=rain=surface==='rain'?1:0;snowCover=surface==='snow'?1:0;
        const c=addCar({x:42.4,y:73.245,hx:0,hy:1,player:true,v:2});
        me=c;a=Math.PI/2;px=c.x;py=c.y;c.travelA=-Math.PI/2;
        K.Space=K.KeyD=true;drive(.05);K.Space=K.KeyD=false;
        const safe=c.v===0&&c.y===73.245&&carBodyClear(c.x,c.y,c.hx,c.hy);
        cars.length=0;return safe;
      });
    });
    assert.deepEqual(result,[true,true]);
  } finally {await browser.close();}
});
