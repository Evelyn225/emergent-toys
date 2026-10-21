'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');
const PAGE = pathToFileURL(path.resolve(__dirname, '../../ascii-city.html')).href;
let browser;
test.before(async () => { browser = await (process.env.CITY_TEST_BROWSER === 'firefox' ? firefox : chromium).launch(); });
test.after(async () => { await browser?.close(); });
async function fixture(run) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(PAGE);
    await page.evaluate(() => {
      paused = false; mode = 'walk'; room = me = null; freecam = null;
      [px,py] = citySourcePoint(132,238.1); a = -Math.PI / 2; pitch = .08; T = 10; tod = 12;
      body.z = body.vz = body.crouch = 0; env(0); render(0);
    });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('rendered terrain pixels lie on the collision triangles, including slopes above the horizon', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const sprites = CITY.sprites; CITY.sprites = () => {};
    let count = 0, error = 0, above = 0;
    for (const [x,y,yaw] of [[132,238.1,-Math.PI/2],[129,234,0],[132,230,Math.PI/2],[134,233,Math.PI]]) {
      [px,py]=citySourcePoint(x,y);a=yaw;render(0);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
        const i=r*cols+c,t=ZB[i],cx=2*c/cols-1;
        if(FL[i]!==1||t<=0||t>vis)continue;
        const wx=px+(dx-dy*tf*cx)*t,wy=py+(dy+dx*tf*cx)*t,h=terrainHeight(wx,wy);
        if(h<.002)continue;
        count++;if(r<hor)above++;
        error=Math.max(error,Math.abs(eye+(hor-r-.5)*t/projY-h));
      }
    }
    CITY.sprites=sprites;
    return {count,error,above};
  });
  assert.ok(result.count > 300, JSON.stringify(result));
  assert.ok(result.above > 5, JSON.stringify(result));
  assert.ok(result.error < 1e-4, JSON.stringify(result));
}));

test('walking follows a hill without jumps and airborne movement preserves world height', () => fixture(async page => {
  const result = await page.evaluate(() => {
    [px,py]=citySourcePoint(131,231.5);body.groundMode=null;stepBody(0);
    let high=0,low=1,blocked=0;
    for(let n=0;n<160;n++) {
      const before=py;move(0,.025);stepBody(1/60);
      if(py===before)blocked++;
      const h=walkGround(px,py);high=Math.max(high,h);low=Math.min(low,h);
    }
    render(0);
    const eyeError=Math.abs(eye-walkGround(px,py)-.17);
    body.z=1;body.vz=0;stepBody(0);
    const feet=walkGround(px,py)+body.z/10;
    move(0,-.05);stepBody(0);
    return {range:high-low,blocked,eyeError,airError:Math.abs(feet-walkGround(px,py)-body.z/10)};
  });
  assert.equal(result.blocked, 0, JSON.stringify(result));
  assert.ok(result.range > .1, JSON.stringify(result));
  assert.ok(result.eyeError < 1e-6, JSON.stringify(result));
  assert.ok(result.airError < 1e-6, JSON.stringify(result));
}));

test('raised ground occludes objects behind it and vehicles are drawn at terrain height', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const saved=eye,calls=[],box=drawBox;
    drawBox=(b,shade)=>{calls.push({z0:b.z0,z1:b.z1,eye});};
    const [vehicleX,vehicleY]=citySourcePoint(131.5,231.5);
    drawVehicle({kind:'car',body:WHITE,id:1,v:0},vehicleX-px,vehicleY-py,1,0);
    drawBox=box;
    // The rigid chassis now rests on the plane through its four tyre contacts,
    // rather than keeping a horizontal body at the centre terrain sample.
    const [hl,hw]=VEHICLES.car;
    const support=[-1,1].flatMap(front=>[-1,1].map(side=>roadGroundHeight(vehicleX+front*hl*.62,vehicleY+side*hw*.88)));
    const chassisHeight=support.reduce((sum,z)=>sum+z,0)/4;
    const vehicleError=Math.max(...calls.map(b=>Math.abs(saved-b.eye-chassisHeight)));
    const eyeRestored=eye===saved;
    const sprites=CITY.sprites;CITY.sprites=()=>{};
    [px,py]=citySourcePoint(132,238.1);a=-Math.PI/2;pitch=.08;render(0);
    let occluded=0,drawn=0;
    drawShape(0,-5,.01,.4,.08,(i,u,z)=>{drawn++;return true;});
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(ZB[r*cols+c]<5&&FL[r*cols+c]===1)occluded++;
    const terrain=drawTerrainColumn;drawTerrainColumn=()=>false;render(0);
    let flatDrawn=0;
    drawShape(0,-5,.01,.4,.08,()=>{flatDrawn++;return true;});
    drawTerrainColumn=terrain;
    CITY.sprites=sprites;
    return {vehicleError,vehicleParts:calls.length,occluded,drawn,flatDrawn,eyeRestored};
  });
  assert.ok(result.vehicleParts>1,JSON.stringify(result));
  assert.ok(result.vehicleError < 1e-8, JSON.stringify(result));
  assert.ok(result.occluded > 100, JSON.stringify(result));
  assert.equal(result.drawn, 0, JSON.stringify(result));
  assert.ok(result.flatDrawn>0, JSON.stringify(result));
  assert.equal(result.eyeRestored,true);
}));

test('an item can be put down and picked up on a hill and ground effects meet the surface', () => fixture(async page => {
  const result = await page.evaluate(() => {
    [px,py]=citySourcePoint(131.5,231.5);a=0;inv.length=0;dropped.length=0;
    carryItem({id:'yoyo',uses:0});held=0;dropHere();
    const item=dropped.at(-1),height=terrainHeight(item.x,item.y);
    const visible=drawArt,calls=[];
    drawArt=(x,y,z)=>calls.push(z);drawDropped(item,0,1,.007);drawArt=visible;
    const nearby=droppedHere()===item,ground=peeGround(px,py).z;
    pickUpDropped(item);
    return {height,z:item.z,renderZ:calls[0],nearby,picked:inv.some(it=>it.id==='yoyo'),ground,error:Math.abs(ground-outdoorGroundHeight(px,py))};
  });
  assert.ok(result.height>.1,JSON.stringify(result));
  assert.equal(result.z,result.height);
  assert.equal(result.renderZ,result.z);
  assert.equal(result.nearby,true);
  assert.equal(result.picked,true);
  assert.equal(result.error,0);
}));
