'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

test('taxi passenger cameras follow the steering body through a pass and keep mouse look', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname,'../../ascii-city.html')).href);
    await page.waitForFunction(()=>typeof stepTaxiCamera==='function' && Number.isFinite(eye));
    const r=await page.evaluate(()=>{
      paused=true;clearWanted();cars.length=people.length=0;evTimer=1000;T=10;
      for(let y=70;y<76;y++)for(let x=32;x<50;x++){map[idx(x,y)]=0;ROAD[idx(x,y)]=1;}
      me=addCar({x:34,y:72.6,hx:1,hy:0,body:TAXI,cruise:1.2,v:1.2,rider:true,fare:0,dest:[60,72.6]});
      me.nh=[1,0];me.B=40;me.left=8;
      addCar({x:36,y:72.6,hx:1,hy:0,parked:true});
      mode='taxi';a=camYaw=look=pitch=0;px=me.ex;py=me.ey;
      let positionError=0,headingChange=0,chaseError=0,renderHeadingError=0;
      const original=drawVehicle;
      drawVehicle=(c,x,y,hx,hy)=>{if(c===me)renderHeadingError=Math.max(renderHeadingError,Math.abs(Math.atan2(hy,hx)-carYaw(c)));original(c,x,y,hx,hy);};
      for(let k=0;k<85;k++){
        stepTraffic(.05,T+=.05,true);stepTaxiCamera(.05);
        positionError=Math.max(positionError,Math.hypot(rel(px-me.ex),rel(py-me.ey)));
        headingChange=Math.max(headingChange,Math.abs(a));
        const [cx,cy,yaw]=chaseCam(.05), back=Math.hypot(rel(cx-me.ex),rel(cy-me.ey));
        chaseError=Math.max(chaseError,Math.abs(rel(cx-me.ex)+Math.cos(yaw)*back),Math.abs(rel(cy-me.ey)+Math.sin(yaw)*back));
        if(k%10===0){const saved=[px,py,a];chaseOn=true;px=cx;py=cy;a=yaw;env(0);render(0);[px,py,a]=saved;}
      }
      drawVehicle=original;
      look=.7;for(let k=0;k<30;k++){stepTaxiCamera(.05);chaseCam(.05);}
      const firstLook=Math.abs(mod(a-carYaw(me)-look+Math.PI,Math.PI*2)-Math.PI);
      const chaseLook=Math.abs(mod(camYaw-carYaw(me)-look+Math.PI,Math.PI*2)-Math.PI);
      return {positionError,headingChange,chaseError,renderHeadingError,firstLook,chaseLook};
    });
    assert.ok(r.positionError<1e-9 && r.chaseError<1e-9,JSON.stringify(r));
    assert.ok(r.headingChange>.15 && r.renderHeadingError<1e-9,JSON.stringify(r));
    assert.ok(r.firstLook<.001 && r.chaseLook<.002,JSON.stringify(r));
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
