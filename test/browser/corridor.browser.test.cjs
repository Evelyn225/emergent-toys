'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const libraryURL = 'https://unpkg.com/three@0.155.0/build/three.module.js';
const libraryCache = path.join(os.tmpdir(), 'corridor-three-0.155.0.module.js');
let browser, library, server, pageURL;

before(async () => {
  // Use the game's exact dependency. Cache it so repeated runs need no CDN.
  if (fs.existsSync(libraryCache)) library = fs.readFileSync(libraryCache, 'utf8');
  else {
    const response = await fetch(libraryURL);
    assert.ok(response.ok, 'Three.js download must succeed');
    library = await response.text();
    fs.writeFileSync(libraryCache, library);
  }
  browser = await chromium.launch();
  // Serve the page, its bundle, and its sounds from the repo, as the site does.
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.png': 'image/png' };
  server = http.createServer((req,res) => {
    const rel = decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
    const file = path.join(root,rel), type = types[path.extname(rel)];
    if (type && (rel === 'corridor.html' || rel === 'corridor.bundle.js' || rel === 'ISOCPEUR.ttf' || rel.startsWith('audio/corridor/') || rel.startsWith('images/corridor/')) && fs.existsSync(file)) {
      res.writeHead(200,{ 'content-type': type });
      res.end(fs.readFileSync(file));
    } else res.writeHead(204).end();
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  pageURL = 'http://127.0.0.1:' + server.address().port + '/corridor.html?test=1';
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function open(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
  t.after(() => context.close());
  await context.route('https://**/*', route => {
    if (route.request().url() === libraryURL) {
      return route.fulfill({ body: library, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
    }
    if (route.request().url().endsWith('/go-home.png')) {
      return route.fulfill({ body: fs.readFileSync(path.join(root,'images/go-home.png')), contentType: 'image/png' });
    }
    return route.fulfill({ status: 204 });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pageURL);
  await page.waitForFunction(() => !!window.corridorTest);
  t.after(() => assert.deepEqual(errors, [], 'no runtime or shader errors'));
  return page;
}

test('the curved tunnel, bridge, ramps, and balcony form a continuous route in both directions', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    const route = game.tunnelFrames.filter(f => f.center.z <= 3).map(f => [f.center.x,f.center.z]);
    route.push([12,-29],[12,-55],[12,-59],[5,-59],[5,-60],[5,-79],[19,-79],[19,-60],[12,-60],[12,-55.6]);
    function follow(points) {
      for (const [x,z] of points) {
        for (let n = 0; n < 2000; n++) {
          const dx = x-game.player.x, dz = z-game.player.z, distance = Math.hypot(dx,dz);
          if (distance < .025) break;
          game.move(dx/distance*Math.min(distance,.05),dz/distance*Math.min(distance,.05));
          if (n === 1999) return { target: [x,z], stuck: game.getState() };
        }
      }
      return null;
    }
    const forwardError = follow(route), balcony = game.getState();
    if (forwardError) return { forwardError };
    game.render();
    const backError = follow([...route].reverse().concat([[0,3]]));
    return { forwardError, backError, balcony, returned: game.getState() };
  });
  assert.equal(result.forwardError, null, JSON.stringify(result));
  assert.equal(result.backError, null, JSON.stringify(result));
  assert.ok(Math.abs(result.balcony.y-8.5) < .01);
  assert.ok(Math.abs(result.returned.y) < .01);
  assert.ok(Math.hypot(result.returned.x,result.returned.z-3) < .03);
});

test('walls, bridge rails, ramp rails, ceilings, and unsupported edges prevent escape', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    const states = {};
    game.setPosition(0,0,3); game.move(20,0); states.tunnel = game.getState();
    game.setPosition(12,0,-42); game.move(20,0); states.bridge = game.getState();
    game.setPosition(5,1.5,-69.5); game.move(10,0); states.ramp = game.getState();
    game.setPosition(12,8.5,-55.6); game.move(0,10); states.balcony = game.getState();
    game.setPosition(12,0,-60); game.move(0,-40); states.backWall = game.getState();
    return {
      states,
      ceiling: game.blocked(5,-69.5,0),
      noWaterFloor: game.floorHeight(8,-42,0),
    };
  });
  assert.ok(result.states.tunnel.x < 1.8);
  assert.ok(result.states.bridge.x < 13.1);
  assert.ok(result.states.ramp.x < 6);
  assert.ok(result.states.balcony.z < -54.8);
  assert.ok(result.states.backWall.z > -81.9);
  assert.equal(result.ceiling, true, 'cannot walk through the underside of a ramp');
  assert.equal(result.noWaterFloor, null);
});

test('walking is camera-relative, can stop and turn around, and pauses without stuck keys', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  const start = await page.evaluate(() => corridorTest.getState());
  await page.waitForTimeout(180);
  assert.equal((await page.evaluate(() => corridorTest.getState())).z,start.z,'standing still causes no drift');
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  const walked = await page.evaluate(() => corridorTest.getState());
  assert.ok(walked.z < start.z-.1,'W walks forward');
  await page.evaluate(() => corridorTest.setLook(Math.PI));
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  assert.ok((await page.evaluate(() => corridorTest.getState())).z > walked.z+.1,'can face and walk backward');
  await page.keyboard.down('w');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !corridorTest.getState().playing);
  assert.equal(await page.locator('#veil').isVisible(),true);
  const stopped = await page.evaluate(() => corridorTest.getState().z);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => corridorTest.getState().z),stopped);
  assert.equal(await page.evaluate(() => corridorTest.keys.size),0);
});

test('walking speed is independent of update frequency and diagonal input is normalized', async t => {
  const page = await open(t);
  const distances = await page.evaluate(() => {
    const game = corridorTest, result = [];
    for (const hz of [30,60,144]) {
      game.setPosition(12,0,-63); game.setLook(0); game.setPlaying(true); game.keys.add('KeyW');
      for (let i = 0; i < hz; i++) game.update(1/hz);
      result.push(-63-game.player.z); game.keys.clear();
    }
    game.setPosition(12,0,-63); game.keys.add('KeyW'); game.keys.add('KeyD');
    for (let i = 0; i < 60; i++) game.update(1/60);
    result.push(Math.hypot(game.player.x-12,game.player.z+63)); game.pause();
    return result;
  });
  for (const distance of distances) assert.ok(Math.abs(distance-2.8)<.001,JSON.stringify(distances));
});

test('pump and overlook button respond to real E input; optional audio initializes', async t => {
  const page = await open(t);
  await page.click('#sound');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await page.evaluate(() => { corridorTest.setPosition(15.3,0,-36.95); corridorTest.setLook(0,-.4); });
  await page.keyboard.press('e');
  assert.equal(await page.evaluate(() => corridorTest.getState().pumpOn),true);
  const drained = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) corridorTest.update(1/60);
    return corridorTest.getState();
  });
  assert.ok(drained.waterY < -3.2,'pump visibly drains below the reservoir floor');
  assert.ok(Math.abs(drained.pumpRotation)>10,'pump mechanism moves');
  const stopped = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) corridorTest.update(1/60);
    const finished = corridorTest.getState();
    for (let i = 0; i < 120; i++) corridorTest.update(1/60);
    return { finished, later: corridorTest.getState() };
  });
  assert.ok(Math.abs(stopped.finished.waterY+3.3)<.00001,'draining reaches its final level');
  assert.equal(stopped.later.pumpRotation,stopped.finished.pumpRotation,'lower wheel stops after draining');
  await page.keyboard.press('e');
  assert.equal(await page.evaluate(() => corridorTest.getState().pumpOn),false);
  const refilled = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) corridorTest.update(1/60);
    return corridorTest.getState();
  });
  assert.ok(refilled.waterY>-1.85,'pump refills the reservoir when switched back');
  assert.ok(refilled.pumpRotation<stopped.later.pumpRotation,'lower wheel restarts while refilling');
  const refillStopped = await page.evaluate(() => {
    for (let i = 0; i < 240; i++) corridorTest.update(1/60);
    const finished = corridorTest.getState();
    for (let i = 0; i < 120; i++) corridorTest.update(1/60);
    return { finished, later: corridorTest.getState() };
  });
  assert.equal(refillStopped.finished.waterY,-1.7,'refilling reaches its final level');
  assert.equal(refillStopped.later.pumpRotation,refillStopped.finished.pumpRotation,'lower wheel stops after refilling');
  await page.evaluate(() => { corridorTest.setPosition(12,8.5,-56.5); corridorTest.setLook(Math.PI,-.2); });
  await page.keyboard.press('e');
  const pressed = await page.evaluate(() => corridorTest.getState());
  assert.equal(pressed.descentReleased,true);
  assert.ok(Math.abs(pressed.descentCapY-9.53)<1e-6 && !pressed.descentCapLit,'the button sinks and its lamp goes out');
});

test('decks have one top surface and ramp elevations meet their landings without steps', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    const deckPoints = [[12,0,-29],[12,0,-30.05],[12,0,-53.95],[12,0,-55],
      [5,3,-78.4],[5.6,3,-79],[18.5,5.5,-79],[19,8.5,-60],[12,8.5,-58.7],[12,8.5,-57.7]];
    const layers = deckPoints.map(([x,y,z]) => game.floorLayersAt(x,y,z).length);
    const seams = [];
    for (const flight of game.rampJoins) {
      for (const p of [flight.a,flight.b]) seams.push(Math.abs(game.floorHeight(p[0],p[2],p[1])-p[1]));
    }
    return { layers,seams };
  });
  assert.deepEqual(result.layers,Array(10).fill(1),'no overlapping deck faces');
  for (const error of result.seams) assert.ok(error<.00001,'ramp ends match landing elevations');
  assert.equal(await page.locator('#place').count(),0,'no bottom-left area display');
});

test('the overlook button opens the descent independently; bridge pump reveals the route into the lower works', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  const closed = await page.evaluate(() => {
    corridorTest.setPosition(1.5,0,-33); corridorTest.move(0,-3); return corridorTest.getState();
  });
  assert.ok(closed.z>-33.75,'descent gate starts closed');
  await page.evaluate(() => { corridorTest.setPosition(12,8.5,-56.5); corridorTest.setLook(Math.PI,-.2); });
  await page.keyboard.press('e');
  const opened = await page.evaluate(() => {
    for (let i = 0; i < 30; i++) corridorTest.update(1/60);
    return corridorTest.getState();
  });
  assert.equal(opened.descentReleased,true);
  assert.equal(opened.pumpOn,false,'the descent button does not run the pump');
  assert.equal(opened.waterY,-1.7,'the descent button does not change the water level');
  assert.ok(opened.gateAngle>0,'gate visibly moves');
  const wet = await page.evaluate(() => {
    corridorTest.setPosition(1.5,0,-33); corridorTest.move(0,-17); return corridorTest.getState();
  });
  assert.ok(wet.y>-1.8,'high water prevents reaching the submerged floor');
  const bay = await page.evaluate(() => {
    corridorTest.setPosition(12,0,-36.95); corridorTest.move(3.3,0); corridorTest.setLook(0,-.4);
    return corridorTest.getState();
  });
  assert.ok(bay.x>15.25,'pump bay is reachable directly from the main bridge');
  await page.keyboard.press('e');
  const lower = await page.evaluate(() => {
    for (let i = 0; i < 420; i++) corridorTest.update(1/60);
    corridorTest.setPosition(1.5,0,-33); corridorTest.move(0,-17); corridorTest.move(-21.5,0);
    corridorTest.update(.01);
    return corridorTest.getState();
  });
  assert.ok(lower.waterY<-3.2);
  assert.ok(lower.x < -19.9 && Math.abs(lower.y+1.5)<.001,'walk through the drained hallway up into the hub');
  assert.equal(lower.zone,'lowerWorks');
  const returned = await page.evaluate(() => {
    corridorTest.move(21.5,0); corridorTest.move(0,17); return corridorTest.getState();
  });
  assert.ok(Math.abs(returned.y)<.001 && returned.z>-33.05,'can climb back out');
});

test('rendered basin walls enclose both ends and the intake arch has no shoulder gaps', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    const ends = [];
    for (const x of [1.5,6,12,18,22.5]) {
      for (const y of [-2.7,-1.5,-.5]) {
        ends.push(game.renderedHits([x,y,-28],[0,0,1],2).length>0);
        ends.push(game.renderedHits([x,y,-56],[0,0,-1],2).length>0);
      }
    }
    const arch = [];
    const samples = [[10.1,2.3],[10.4,2.8],[10.8,3.05],[11.4,3.25],[12,3.25],
      [12.6,3.25],[13.2,3.05],[13.6,2.8],[13.9,2.3]];
    for (const [x,y] of samples) {
      arch.push(game.renderedHits([x,y,-28],[0,0,1],2).length>0);
      arch.push(game.renderedHits([x,y,-26],[0,0,-1],2).length>0);
    }
    const clearOpening = game.renderedHits([12,1.3,-28],[0,0,1],2).length===0
      && game.renderedHits([12,1.3,-26],[0,0,-1],2).length===0;
    return { ends,arch,clearOpening };
  });
  assert.ok(result.ends.every(Boolean),'all lower end-wall samples must hit visible geometry');
  assert.ok(result.arch.every(Boolean),'arch shoulders and crown are sealed from both sides');
  assert.equal(result.clearOpening,true,'arch opening remains clear');
});

test('ascent opening follows the reservoir curve across its full width', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const sealed = [], clear = [], curveError = [];
    for (const x of [4.7,5,6,6.5,8,10,12,14,16,17.5,18,19,19.3]) {
      const roofY = corridorTest.renderedHits([x,14,-42],[0,-1,0],4)[0].point[1];
      const expectedY = 6+7*Math.sqrt(1-((x-12)/12)**2);
      curveError.push(Math.abs(roofY-expectedY));
      for (const [z,direction] of [[-58,1],[-56,-1]]) {
        sealed.push(corridorTest.renderedHits([x,roofY+.01,z],[0,0,direction],2).length>0);
        clear.push(corridorTest.renderedHits([x,roofY-.01,z],[0,0,direction],2).length===0);
      }
      clear.push(corridorTest.renderedHits([x,10.3,-58],[0,0,1],2).length===0);
    }
    for (const x of [4.4,19.6]) sealed.push(corridorTest.renderedHits([x,9.5,-58],[0,0,1],2).length>0);
    return { sealed, clear, curveError };
  });
  assert.ok(result.sealed.every(Boolean),'wall follows the roof from either side, with closed side piers');
  assert.ok(result.clear.every(Boolean),'opening follows the full curve, including its crown');
  assert.ok(result.curveError.every(error=>error<.001),'rendered roof follows the ellipse within one millimetre');
});

test('arch piers have closed side faces and adjoining end-wall panels stay flush', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const sideContacts = [], outerContacts = [], faceContacts = [], thresholdContacts = [];
    for (const [originX,directionX,edgeX] of [[6,-1,4.6],[18,1,19.4]]) {
      for (const y of [8.6,9.5,10.8]) {
        for (const z of [-56.88,-57,-57.12]) {
          const hit = corridorTest.renderedHits([originX,y,z],[directionX,0,0],2)[0];
          sideContacts.push(hit && Math.abs(hit.point[0]-edgeX)<.00001);
        }
      }
    }
    for (const [originX,directionX,edgeX] of [[3.5,-1,3],[20.5,1,21]]) {
      for (const y of [11,13.5,14.5]) {
        const hit = corridorTest.renderedHits([originX,y,-56.95],[directionX,0,0],1)[0];
        outerContacts.push(hit && Math.abs(hit.point[0]-edgeX)<.00001);
      }
    }
    for (const x of [1,2,2.9,3.1,4,20,20.9,21.1,22,23]) {
      const hit = corridorTest.renderedHits([x,7.5,-55],[0,0,-1],3)[0];
      faceContacts.push(hit && Math.abs(hit.point[2]+56.85)<.00001);
    }
    for (const x of [4.7,4.9,19.1,19.3]) {
      for (const z of [-56.9,-57,-57.1]) {
        const hit = corridorTest.renderedHits([x,8.9,z],[0,-1,0],1)[0];
        thresholdContacts.push(hit && Math.abs(hit.point[1]-8.5)<.00001);
      }
    }
    return { sideContacts,outerContacts,faceContacts,thresholdContacts };
  });
  assert.ok(result.sideContacts.every(Boolean),'both jambs have visible faces across their depth');
  assert.ok(result.outerContacts.every(Boolean),'outer arch edges are closed above the vault');
  assert.ok(result.faceContacts.every(Boolean),'outer wall panels meet adjoining piers without a recess');
  assert.ok(result.thresholdContacts.every(Boolean),'threshold reaches both jambs at balcony height');
});

test('overlook deck has no coplanar wall tops and descent ends on a clear landing before the doorway', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    const deckLayers = [];
    for (const x of [5.5,8,10,12,14,16,18.5]) {
      for (const z of [-57.12,-57,-56.88]) {
        const contacts = game.renderedHits([x,8.9,z],[0,-1,0],1)
          .filter(hit => Math.abs(hit.point[1]-8.5)<.00001);
        deckLayers.push(new Set(contacts.map(hit => hit.objectId)).size);
      }
    }
    const descent = game.rampJoins.find(flight => flight.a[0]===1.5);
    const landing = [-46.5,-47,-48,-49,-50].map(z => {
      const contacts = game.renderedHits([1.5,-2.5,z],[0,-1,0],1)
        .filter(hit => Math.abs(hit.normal[1])>.5);
      return contacts[0]?.point[1];
    });
    return { deckLayers, endZ: descent.b[2],landing };
  });
  assert.ok(result.deckLayers.every(count=>count===1),'rendered wall faces must not overlap the overlook deck');
  assert.ok(result.endZ>=-46.5,'ramp stops before the doorway beginning at z=-48');
  for (const y of result.landing) assert.ok(Math.abs(y+3)<.00001,'flat, unobstructed floor between ramp and lower works');
});

test('touch controls work on a narrow screen and release input when paused', async t => {
  const page = await open(t,{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.tap('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  assert.equal(await page.locator('#mobile').isVisible(),true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  const result = await page.evaluate(() => {
    const game = corridorTest, button = document.querySelector('[data-key=KeyW]');
    button.dispatchEvent(new PointerEvent('pointerdown',{ pointerId: 1, bubbles: true }));
    const pressed = game.keys.has('KeyW');
    button.dispatchEvent(new PointerEvent('pointercancel',{ pointerId: 1, bubbles: true }));
    const released = game.keys.size === 0;
    game.pause();
    return { pressed,released,playing: game.getState().playing };
  });
  assert.deepEqual(result,{ pressed:true,released:true,playing:false });
});

// Shared walking helpers for the lower works tests.
async function installFollow(page) {
  await page.evaluate(() => {
    window.follow = points => {
      const game = corridorTest;
      for (const [x,z] of points) {
        for (let n = 0; n < 3000; n++) {
          const dx = x-game.player.x, dz = z-game.player.z, distance = Math.hypot(dx,dz);
          if (distance < .025) break;
          game.move(dx/distance*Math.min(distance,.05),dz/distance*Math.min(distance,.05));
          if (n === 2999) return { target: [x,z], stuck: game.getState() };
        }
      }
      return null;
    };
    window.run = seconds => { for (let i = 0; i < seconds*60; i++) corridorTest.update(1/60); return corridorTest.getState(); };
  });
}
async function drainReservoir(page) {
  await page.evaluate(() => { corridorTest.setPosition(15.3,0,-36.95); corridorTest.setLook(0,-.4); });
  await page.keyboard.press('e');
  return page.evaluate(() => run(8));
}

test('reservoir water floods the lower works hallway until drained, and stops short of the hub', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const probe = () => page.evaluate(() => {
    const surfaceY = (x,from) => corridorTest.renderedHits([x,from,-49.3],[0,-1,0],8)[0].point[1];
    return { doorway: surfaceY(-.15,-.5), hallway: surfaceY(-4,-.5), shore: surfaceY(-8.5,-.5), hub: surfaceY(-20,4) };
  });
  const rampAt = x => -3+1.5*(-2-x)/7;
  const flooded = await probe();
  assert.ok(Math.abs(flooded.doorway+1.7)<1e-5 && Math.abs(flooded.hallway+1.7)<1e-5,'water runs through the doorway and along the hallway');
  assert.ok(Math.abs(flooded.shore-rampAt(-8.5))<1e-5,'the ramp rises out of the water before the hub');
  assert.ok(Math.abs(flooded.hub+1.5)<1e-5,'the hub floor stays dry');
  const wading = await page.evaluate(() => {
    corridorTest.setPosition(-12,-1.5,-50); corridorTest.move(12,0); return corridorTest.getState();
  });
  assert.ok(wading.x<-8.2 && wading.y>-1.66,'walkers stop at the hallway waterline: ' + JSON.stringify(wading));
  const drained = await drainReservoir(page);
  assert.ok(drained.waterY<-3.2);
  const dry = await probe();
  assert.ok(Math.abs(dry.doorway+3)<1e-5,'drained doorway shows the floor');
  assert.ok(Math.abs(dry.hallway-rampAt(-4))<1e-5,'drained hallway shows the ramp');
  assert.ok(Math.abs(dry.hub+1.5)<1e-5);
});

test('lower works hallway ceiling meets both doorway soffits without doubled faces', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  await drainReservoir(page);
  const result = await page.evaluate(() => {
    const game = corridorTest, soffits = [], gaps = [], walls = [];
    for (const [x,y] of [[-.05,0],[-.15,0],[-.25,0],[-12.9,1.5],[-13,1.5],[-13.1,1.5]]) {
      for (const z of [-48.3,-49.3,-51.6]) {
        soffits.push(game.renderedHits([x,y-1,z],[0,1,0],2).filter(hit => Math.abs(hit.point[1]-y)<1e-4).length);
      }
    }
    for (const x of [-1,-3,-5.5,-8,-11]) {
      const floorY = game.renderedHits([x,-.1,-49.3],[0,-1,0],6)[0].point[1];
      gaps.push(game.renderedHits([x,floorY+.1,-49.3],[0,1,0],5)[0].point[1]-floorY);
      for (const [direction,face] of [[1,-48],[-1,-52]]) {
        const hit = game.renderedHits([x,floorY+1.5,-50],[0,0,direction],3)[0];
        walls.push(hit && Math.abs(hit.point[2]-face)<1e-5);
      }
    }
    return { soffits,gaps,walls };
  });
  assert.ok(result.soffits.every(count=>count===1),'one surface at each doorway soffit: ' + result.soffits);
  for (const gap of result.gaps) assert.ok(Math.abs(gap-3)<1e-5,'ceiling stays 3 m above the floor: ' + result.gaps);
  assert.ok(result.walls.every(Boolean),'hallway walls are continuous on both sides');
});

test('lift: call it up, ride down with real E input, walk the sump causeway, and ride back', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const arrival = await page.evaluate(() => {
    corridorTest.setPosition(-20,-1.5,-50); corridorTest.move(-13,0); return corridorTest.getState();
  });
  assert.equal(arrival.liftPos,1,'the car starts at the bottom');
  assert.ok(arrival.x>-30.6 && arrival.x<-30.4,'closed gate stops walkers at the empty shaft: ' + arrival.x);
  await page.evaluate(() => { corridorTest.setPosition(-29.6,-1.5,-49.3); corridorTest.lookAt(-30.35,-.32,-48.13); });
  assert.equal(await page.locator('#prompt').textContent(),'E / CALL THE LIFT');
  await page.keyboard.press('e');
  const called = await page.evaluate(() => run(14));
  assert.equal(called.liftPos,0);
  assert.equal(called.liftY,-1.5);
  assert.equal(called.liftGates[0],1,'top gate opens when the car arrives');
  assert.equal(called.liftGates[1],0);
  const boarded = await page.evaluate(() => {
    const error = follow([[-31.8,-50],[-33,-50.2]]);
    corridorTest.lookAt(-32.4,-.32,-48.3);
    return { error,state: corridorTest.getState() };
  });
  assert.equal(boarded.error,null,JSON.stringify(boarded));
  assert.ok(Math.abs(boarded.state.y+1.5)<1e-6);
  assert.equal(await page.locator('#prompt').textContent(),'E / LOWER THE LIFT');
  await page.keyboard.press('e');
  const ride = await page.evaluate(() => {
    const game = corridorTest;
    let drift = 0, escape = null, departed = false;
    for (let i = 0; i < 60*14; i++) {
      game.update(1/60);
      const state = game.getState();
      if (state.liftPos>0) departed = true;
      drift = Math.max(drift,Math.abs(state.y-state.liftY));
      if (i === 400) {
        game.move(4,0); const east = game.player.x;
        game.move(-8,0); const west = game.player.x;
        game.move(4,3); const north = game.player.z;
        escape = { east,west,north,y: game.player.y,liftY: game.getState().liftY };
        follow([[-33,-50.2]]);
      }
    }
    return { departed,drift,escape,state: game.getState() };
  });
  assert.equal(ride.departed,true);
  assert.ok(ride.drift<1e-9,'walker is carried with the car: ' + ride.drift);
  assert.ok(ride.escape.east<-31.15 && ride.escape.west>-34.85 && ride.escape.north<-48.4,'cannot step off mid-ride: ' + JSON.stringify(ride.escape));
  assert.ok(Math.abs(ride.escape.y-ride.escape.liftY)<1e-9);
  assert.equal(ride.state.y,-21,'arrives exactly at the sump landing');
  assert.equal(ride.state.zone,'shaft');
  assert.equal(ride.state.altitude,'LEVEL -21.0 M');
  assert.deepEqual(ride.state.liftGates,[0,1]);
  const sump = await page.evaluate(() => {
    const error = follow([[-60.4,-50]]); corridorTest.update(.001); const end = corridorTest.getState();
    corridorTest.setPosition(-50,-21,-50); corridorTest.move(0,4); const north = corridorTest.getState().z;
    corridorTest.setPosition(-50,-21,-50); corridorTest.move(0,-4); const south = corridorTest.getState().z;
    corridorTest.move(-15,0); const bulkhead = corridorTest.getState().x;
    return { error,end,north,south,bulkhead };
  });
  assert.equal(sump.error,null,JSON.stringify(sump));
  assert.ok(Math.abs(sump.end.y+21)<1e-6);
  assert.equal(sump.end.zone,'sump');
  assert.ok(sump.north<-48.4 && sump.south>-51.6,'causeway rails keep walkers out of the water');
  assert.ok(sump.bulkhead>-60.8,'sealed bulkhead ends the causeway');
  const back = await page.evaluate(() => {
    const error = follow([[-33,-50.2]]);
    corridorTest.lookAt(-32.4,-21+1.18,-48.3);
    return error;
  });
  assert.equal(back,null);
  assert.equal(await page.locator('#prompt').textContent(),'E / RAISE THE LIFT');
  await page.keyboard.press('e');
  const up = await page.evaluate(() => {
    const state = run(14), error = follow([[-31.8,-50],[-20,-50]]); corridorTest.update(.001);
    return { state,error,hub: corridorTest.getState() };
  });
  assert.equal(up.state.y,-1.5);
  assert.equal(up.error,null,JSON.stringify(up));
  assert.ok(Math.abs(up.hub.y+1.5)<1e-6);
  assert.equal(up.hub.zone,'lowerWorks');
});

test('lift gates hold for a walker in the doorway; an empty car can be sent and called back', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  await page.evaluate(() => { corridorTest.setPosition(-33,-21,-50.2); corridorTest.lookAt(-32.4,-21+1.18,-48.3); });
  await page.keyboard.press('e');
  const held = await page.evaluate(() => { corridorTest.setPosition(-35.4,-21,-50); return run(3); });
  assert.equal(held.liftPos,1,'car waits while someone stands in the gateway');
  assert.ok(held.liftGates[1]>.9);
  const sent = await page.evaluate(() => {
    corridorTest.setPosition(-37,-21,-50); const state = run(14);
    corridorTest.move(4,0);
    return { state,x: corridorTest.getState().x };
  });
  assert.equal(sent.state.liftPos,0,'the empty car goes up');
  assert.equal(sent.state.y,-21,'the walker stays on the landing');
  assert.ok(sent.x<-35.45,'closed gate guards the empty shaft: ' + sent.x);
  await page.evaluate(() => { corridorTest.setPosition(-36.4,-21,-49.4); corridorTest.lookAt(-35.65,-21+1.18,-48.13); });
  assert.equal(await page.locator('#prompt').textContent(),'E / CALL THE LIFT');
  await page.keyboard.press('e');
  const returned = await page.evaluate(() => run(14));
  assert.equal(returned.liftPos,1);
  assert.deepEqual(returned.liftGates,[0,1]);
});

test('lift landings join flush, the shaft is closed, hub stubs are sealed, and the HUD signs depth', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const joins = level => page.evaluate(([x0,y]) => [-.03,.03].map(dx => ({
    layers: corridorTest.floorLayersAt(x0+dx,y,-50).length,
    height: corridorTest.floorHeight(x0+dx,-50,y),
  })),level);
  const bottom = await joins([-35,-21]);
  await page.evaluate(() => { corridorTest.setPosition(-29.6,-1.5,-49.3); corridorTest.lookAt(-30.35,-.32,-48.13); });
  await page.keyboard.press('e');
  await page.evaluate(() => run(14));
  const top = await joins([-31,-1.5]);
  for (const [join,y] of [[bottom,-21],[top,-1.5]]) {
    for (const side of join) {
      assert.equal(side.layers,1,'one deck surface on each side of the landing join');
      assert.ok(Math.abs(side.height-y)<1e-6,'landing and car decks meet at one height: ' + side.height);
    }
  }
  const result = await page.evaluate(() => {
    const game = corridorTest, shaft = [], stubs = [], hud = [];
    for (const y of [-14,-10,-6,-3,3,5,7]) {
      for (const [direction,axis,face] of [[[-1,0,0],0,-35.05],[[1,0,0],0,-30.95],[[0,0,-1],2,-52],[[0,0,1],2,-47.5]]) {
        const hit = game.renderedHits([-33.5,y,-50.4],direction,4)[0];
        shaft.push(hit && Math.abs(hit.point[axis]-face)<1e-4 ? true : [y,direction,hit?.point]);
      }
    }
    const opening = game.renderedHits([-33.5,0,-50.4],[1,0,0],40)[0];
    for (const x of [-21.2,-20,-18.8]) for (const y of [-1.2,0,1.2]) {
      const north = game.renderedHits([x,y,-45],[0,0,1],6)[0], south = game.renderedHits([x,y,-55],[0,0,-1],6)[0];
      stubs.push(north && north.point[2]>-41 && north.point[2]<-40.8 && south && south.point[2]<-59 && south.point[2]>-59.2);
    }
    for (const [x,y,z] of [[-50,-21,-50],[12,8.5,-56.5],[0,0,3],[-20,-1.5,-50]]) {
      game.setPosition(x,y,z); hud.push(game.getState().altitude);
    }
    return { shaft,openingX: opening?.point[0],stubs,hud };
  });
  assert.ok(result.shaft.every(hit => hit === true),'shaft walls close every side: ' + JSON.stringify(result.shaft.filter(hit => hit !== true)));
  assert.ok(result.openingX>-27,'the top landing opening is clear through to the hub: ' + result.openingX);
  assert.ok(result.stubs.every(Boolean),'north and south stub doorways are sealed');
  assert.deepEqual(result.hud,['LEVEL -21.0 M','LEVEL +08.5 M','LEVEL +00.0 M','LEVEL -01.5 M']);
});

test('bulkhead wheel spins, then the hatch swings into the control room through a true round opening', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const angles = [-15,15,45,75,90,105,135,165,195].map(degrees => degrees*Math.PI/180);
  const closed = await page.evaluate(angles => {
    const game = corridorTest;
    game.setPosition(-58,-21,-50); game.move(-6,0);
    const door = angles.map(a => game.renderedHits([-59.5,-20+1.27*Math.sin(a),-50+1.27*Math.cos(a)],[-1,0,0],3)[0]?.point[0]);
    const reveal = angles.map(a => game.renderedHits([-61.15,-20,-50],[0,Math.sin(a),Math.cos(a)],2)[0]?.distance);
    const threshold = [-60.95,-61.15,-61.35].map(x => ({ layers: game.floorLayersAt(x,-21,-50).length,height: game.floorHeight(x,-50,-21) }));
    return { state: game.getState(),door,reveal,threshold };
  },angles);
  assert.ok(closed.state.x>-61.1,'closed hatch blocks the opening: ' + closed.state.x);
  assert.ok(closed.door.every(x => Math.abs(x+61.3)<1e-4),'closed hatch fills the opening: ' + closed.door);
  assert.ok(closed.reveal.every(d => Math.abs(d-1.3)<.002),'reveal follows the circle: ' + closed.reveal);
  for (const side of closed.threshold) {
    assert.equal(side.layers,1);
    assert.ok(Math.abs(side.height+21)<1e-6,'threshold is flush with the causeway and room');
  }
  await page.evaluate(() => { corridorTest.setPosition(-59.6,-21,-50); corridorTest.lookAt(-61.22,-20,-50); });
  assert.equal(await page.locator('#prompt').textContent(),'E / TURN THE WHEEL');
  await page.keyboard.press('e');
  const turning = await page.evaluate(() => run(.7));
  assert.ok(turning.wheelAngle>0 && turning.hatchAngle===0,'the wheel turns before the hatch moves');
  const opened = await page.evaluate(() => run(3));
  assert.ok(Math.abs(opened.hatchAngle-Math.PI/2)<1e-9 && opened.hatchOpen);
  assert.ok(Math.abs(opened.wheelAngle-Math.PI*4)<1e-9,'two full turns');
  const through = await page.evaluate(angles => {
    const game = corridorTest;
    const wall = angles.map(a => game.renderedHits([-62,-20+1.33*Math.sin(a),-50+1.33*Math.cos(a)],[1,0,0],3)[0]?.point[0]);
    const clear = angles.map(a => game.renderedHits([-62,-20+1.27*Math.sin(a),-50+1.27*Math.cos(a)],[1,0,0],3)[0]?.point[0] ?? 0);
    const error = follow([[-61.15,-50],[-66,-50.6]]); game.update(.001);
    const room = game.getState();
    game.setPosition(-63,-21,-49.5); game.move(0,3);
    return { wall,clear,error,room,doorSide: game.getState().z };
  },angles);
  assert.ok(through.wall.every(x => Math.abs(x+61.3)<1e-4),'wall face follows the circle from the room side: ' + through.wall);
  assert.ok(through.clear.every(x => x>-61),'open hatch clears the opening');
  assert.equal(through.error,null,JSON.stringify(through));
  assert.equal(through.room.zone,'control');
  assert.ok(Math.abs(through.room.y+21)<1e-6);
  assert.ok(through.doorSide<-48.85,'the open hatch is solid: ' + through.doorSide);
  await page.evaluate(() => { corridorTest.setPosition(-59.6,-21,-50); corridorTest.lookAt(-61.22,-20,-50); });
  assert.equal(await page.locator('#prompt').textContent(),'','the wheel is spent once the hatch is open');
});

test('control room button opens the north shutter; the key from the store room unlocks the south keyhole; the map follows', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const map = () => page.evaluate(() => ({
    north: corridorTest.mapPixel(-20,-41),key: corridorTest.mapPixel(-20,-38.6),south: corridorTest.mapPixel(-20,-59),
    service: corridorTest.mapPixel(-20,-75),
  }));
  const shutters = () => page.evaluate(() => {
    const game = corridorTest;
    game.setPosition(-20,-1.5,-45); game.move(0,6); const north = game.getState().z;
    game.setPosition(-20,-1.5,-55); game.move(0,-6); const south = game.getState().z;
    return { north,south };
  });
  const keyhole = () => page.evaluate(() => { corridorTest.setPosition(-17.6,-1.5,-57.5); corridorTest.lookAt(-17.6,-.25,-58.87); });
  const prompt = () => page.locator('#prompt').textContent();
  // Messages hold the prompt line for three seconds; let each one expire before the next check.
  const settle = () => page.evaluate(() => run(3.2));

  let plan = await map();
  assert.ok(plan.north>150 && plan.key<60 && plan.south>150 && plan.service<30,'map starts with both doors shut and no store room: ' + JSON.stringify(plan));
  let blocked = await shutters();
  assert.ok(blocked.north<-41.1 && blocked.south>-58.9,'both shutters block: ' + JSON.stringify(blocked));
  await keyhole();
  assert.equal(await prompt(),'LOCKED / NEEDS A KEY');
  await page.keyboard.press('e');
  assert.equal(await prompt(),'IT NEEDS A KEY');
  assert.equal((await page.evaluate(() => corridorTest.getState())).southUnlocked,false);
  await settle();

  await page.evaluate(() => { corridorTest.setPosition(-68.6,-21,-49.5); corridorTest.lookAt(-69.45,-20,-49.5); });
  assert.equal(await prompt(),'E / RELEASE THE NORTH SHUTTER');
  await page.keyboard.press('e');
  const released = await page.evaluate(() => run(3.2));
  assert.equal(released.northOpen,1);
  assert.equal(released.southOpen,0);
  plan = await map();
  assert.ok(plan.north<60 && plan.key>150 && plan.south>150,'map shows the opening and the key: ' + JSON.stringify(plan));
  blocked = await shutters();
  assert.ok(blocked.north>-40.6 && blocked.south>-58.9,'only the north shutter opens: ' + JSON.stringify(blocked));

  const store = await page.evaluate(() => {
    corridorTest.setPosition(-20,-1.5,-45);
    const error = follow([[-20,-35.9]]);
    corridorTest.lookAt(-20,-.25,-34.81);
    return { error,state: corridorTest.getState() };
  });
  assert.equal(store.error,null,JSON.stringify(store));
  assert.ok(Math.abs(store.state.y+1.5)<1e-6);
  assert.equal(await prompt(),'E / TAKE THE KEY');
  assert.equal(await page.locator('#carry').isVisible(),false);
  await page.keyboard.press('e');
  const taken = await page.evaluate(() => corridorTest.getState());
  assert.ok(taken.keyTaken && taken.hasKey && taken.carrying);
  assert.equal(await page.locator('#carry').textContent(),'CARRYING KEY');
  assert.equal(await page.locator('#carry').isVisible(),true);
  assert.ok((await map()).key<60,'the key leaves the map');
  await settle();

  await keyhole();
  assert.equal(await prompt(),'E / UNLOCK');
  await page.keyboard.press('e');
  const unlocked = await page.evaluate(() => corridorTest.getState());
  assert.ok(unlocked.southUnlocked && !unlocked.hasKey && !unlocked.carrying);
  assert.equal(await page.locator('#carry').isVisible(),false);
  assert.ok((await map()).south<60,'map shows the south door unlocked');
  const service = (await map()).service;
  assert.ok(service>30 && service<50,'map draws the service run once unlocked: ' + service);
  assert.equal((await page.evaluate(() => run(3))).southOpen,1,'the unlocked shutter rolls up');
  const through = (await shutters()).south;
  assert.ok(through<-60.5,'the service tunnel is open: ' + through);
  await settle();
  await keyhole();
  assert.equal(await prompt(),'','the lock is spent once turned');
});

test('store room is closed on every side and its doorway has one soffit and one floor', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  await page.evaluate(() => { corridorTest.setPosition(-68.6,-21,-49.5); corridorTest.lookAt(-69.45,-20,-49.5); });
  await page.keyboard.press('e');
  const result = await page.evaluate(() => {
    run(3);
    const game = corridorTest, walls = [], soffits = [], floors = [];
    for (const [origin,direction,axis,face] of [
      [[-20,.6,-37.7],[-1,0,0],0,-24],[[-20,.6,-37.7],[1,0,0],0,-16],[[-20,.6,-37.7],[0,0,1],2,-34.7],
      [[-23,.6,-37.7],[0,0,-1],2,-40.7],[[-17,.6,-37.7],[0,0,-1],2,-40.7],[[-22,0,-37.7],[0,1,0],1,1.5],
    ]) {
      const hit = game.renderedHits(origin,direction,6)[0];
      walls.push(hit && Math.abs(hit.point[axis]-face)<1e-4 ? true : [origin,direction,hit?.point]);
    }
    for (const x of [-21.2,-20.3,-19.1]) for (const z of [-40.75,-40.85,-40.95]) {
      soffits.push(game.renderedHits([x,.5,z],[0,1,0],2).filter(hit => Math.abs(hit.point[1]-1.5)<1e-4).length);
    }
    for (const z of [-41.1,-40.85,-40.6,-37.7]) floors.push(game.floorLayersAt(-20.3,-1.5,z).length);
    return { walls,soffits,floors };
  });
  assert.ok(result.walls.every(hit => hit === true),'store room walls and ceiling: ' + JSON.stringify(result.walls.filter(hit => hit !== true)));
  assert.ok(result.soffits.every(count => count === 1),'raised shutter leaves one soffit surface: ' + result.soffits);
  assert.deepEqual(result.floors,[1,1,1,1],'one floor surface across the threshold');
});

test('the key door opens onto a lined service run that turns to rock and ends in a closed, domed chamber', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const result = await page.evaluate(() => {
    const game = corridorTest, S = game.service, hub = -1.5;
    game.unlockSouth(); run(3);
    // The doorway: one floor across the threshold and one soffit on each side of the wall face.
    const threshold = [-59.1,-59.25,-59.35,-59.6].map(z => ({ layers: game.floorLayersAt(-20.3,hub,z).length,height: game.floorHeight(-20.3,z,hub) }));
    const soffits = [];
    for (const x of [-21.2,-20.1,-18.8]) for (const z of [-59.2,-59.4,-60]) {
      soffits.push(game.renderedHits([x,hub+2,z],[0,1,0],2).filter(hit => Math.abs(hit.point[1]-(hub+3))<1e-4).length);
    }
    // Where the lining ends the concrete floor hands over to the rock floor at one height.
    const handover = [S.liningEnd-.03,S.liningEnd+.03].map(s => {
      const [x,y,z] = S.point(s,.3,0);
      return { layers: game.floorLayersAt(x,y,z).length,height: game.floorHeight(x,z,y)-y };
    });
    // Walk the centreline from the hub to the pedestal.
    game.setPosition(-20,hub,-55);
    const route = [], zones = {};
    for (let s = 0; s <= S.roomS-1.2; s += 1) { const [x,,z] = S.point(s,0,0); route.push([x,z]); }
    let error = null;
    for (let i = 0; i < route.length && !error; i++) {
      error = follow([route[i]]); game.update(.001);
      zones[game.getState().zone] = true;
    }
    const arrived = game.getState();
    // Push sideways at points along the way; the walker always ends against rock, a boulder, or concrete.
    const pinned = [];
    for (const s of [5,20,29,40,50,65,78,S.roomS-4,S.roomS+4]) {
      for (const side of [-1,1]) {
        const start = S.point(s,0,0), wall = S.point(s,side*20,0);
        game.setPosition(...start);
        const dx = wall[0]-start[0], dz = wall[2]-start[2], length = Math.hypot(dx,dz);
        game.move(dx,dz);
        // Whatever stopped the walker is visible within reach, ahead or glancing off to one side.
        const p = game.getState(), base = Math.atan2(dz,dx);
        let nearest = Infinity;
        for (const height of [.4,1.2]) for (const turn of [-60,-30,0,30,60]) {
          const a = base+turn*Math.PI/180, hit = game.renderedHits([p.x,p.y+height,p.z],[Math.cos(a),0,Math.sin(a)],3)[0];
          if (hit) nearest = Math.min(nearest,hit.distance);
        }
        if (nearest>.9 || Math.hypot(p.x-start[0],p.z-start[2])>11) pinned.push([s,side,nearest,p.x,p.z]);
      }
    }
    // The rock shell is closed: rays from inside in every direction meet a surface.
    const leaks = [];
    for (let s = S.liningEnd+.5; s < S.roomS+8; s += 3.5) {
      const origin = S.point(s,0,1.6);
      for (let a = 0; a < 12; a++) for (const e of [-.6,0,.5,1.2]) {
        const dir = [Math.cos(a*Math.PI/6)*Math.cos(e),Math.sin(e),Math.sin(a*Math.PI/6)*Math.cos(e)];
        if (!game.renderedHits(origin,dir,60).length) leaks.push([s,a,e]);
      }
    }
    return { threshold,soffits,handover,error,arrived,zones,pinned,leaks,roomFloor: S.point(S.roomS,0,0)[1] };
  });
  for (const side of result.threshold) {
    assert.equal(side.layers,1,'one floor surface across the south threshold');
    assert.ok(Math.abs(side.height+1.5)<1e-6);
  }
  assert.ok(result.soffits.every(count => count === 1),'lintel and lining ceiling meet without doubled faces: ' + result.soffits);
  for (const side of result.handover) {
    assert.equal(side.layers,1,'one floor surface either side of the lining end');
    assert.ok(Math.abs(side.height)<1e-4,'the lining and rock floors meet at one height: ' + side.height);
  }
  assert.equal(result.error,null,JSON.stringify(result.error));
  assert.ok(result.zones.service && result.zones.cave,'the walk passes through the service run and the cave');
  assert.equal(result.arrived.zone,'cave');
  assert.ok(Math.abs(result.arrived.y-result.roomFloor)<1e-4,'the walk ends on the chamber floor: ' + result.arrived.y);
  assert.deepEqual(result.pinned,[],'walls stop the walker everywhere');
  assert.deepEqual(result.leaks,[],'no holes in the rock shell');
});

test('the red button sequence pauses, then restarts through a loading screen at the remembered refresh spawn', { timeout: 60000 }, async t => {
  const page = await open(t);
  let releaseRestart;
  const holdRestart = new Promise(resolve => { releaseRestart = resolve; });
  t.after(releaseRestart);
  await page.route('**/corridor.html?*', async route => {
    if (new URL(route.request().url()).searchParams.has('restart')) await holdRestart;
    await route.continue();
  });
  await page.addInitScript(() => {
    window.restartMilestones = [];
    new MutationObserver(records => {
      for (const record of records) if (record.target.id === 'restart-progress') restartMilestones.push(record.target.value);
    }).observe(document,{ subtree: true,attributes: true,attributeFilter: ['value'] });
  });
  await page.click('#sound');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const state = () => page.evaluate(() => corridorTest.getState());
  await page.evaluate(() => {
    const S = corridorTest.service;
    corridorTest.setPosition(...S.point(S.roomS+1,0,0)); corridorTest.lookAt(...S.point(S.roomS,0,1.19));
  });
  assert.equal(await page.locator('#prompt').textContent(),'E / PRESS');
  const ready = await state();
  assert.ok(ready.buttonMaterial && ready.buttonPaint[0]>.6 && ready.buttonPaint[1]<.2 && ready.buttonPaint[2]<.2,'the button is red');
  await page.keyboard.press('e');
  const pressed = await page.evaluate(() => run(2.5));
  assert.ok(pressed.detonated && pressed.frontS === null && !pressed.ended,'nothing visible happens at first');
  assert.equal(await page.locator('#prompt').textContent(),'','the button cannot be pressed again');

  const held = await page.evaluate(() => { corridorTest.pause(); return corridorTest.getState().fuse; });
  const paused = await page.evaluate(() => run(6));
  assert.equal(paused.fuse,held,'pausing freezes the sequence');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  const timeline = await page.evaluate(() => {
    const samples = [];
    for (let i = 0; i < 60*30 && !corridorTest.getState().ended; i++) {
      corridorTest.update(1/60);
      const st = corridorTest.getState();
      if (st.frontS !== null) samples.push(st.frontS);
    }
    const end = corridorTest.getState();
    corridorTest.pause();
    document.dispatchEvent(new KeyboardEvent('keydown',{ code: 'KeyE' }));
    const after = run(2);
    return { samples,end,after,loading: {
      visible: !document.getElementById('end').hidden,label: document.getElementById('restart-label').textContent,
      progress: document.getElementById('restart-progress').value,credits: !!document.getElementById('credits'),
      remembered: localStorage.getItem('corridor-crawler-collapsed'),
    } };
  });
  assert.ok(timeline.samples.length>60,'the front travels for a while before it arrives');
  assert.ok(timeline.samples.every((s,i) => !i || s>timeline.samples[i-1]),'the front only advances');
  assert.ok(timeline.end.fuse>16 && timeline.end.fuse<19,'the front reaches the pedestal about eighteen seconds after the press: ' + timeline.end.fuse);
  assert.ok(timeline.end.ended && timeline.end.ending && !timeline.end.playing && !timeline.end.veil,'black, with no pause card');
  assert.ok(timeline.end.roaring && !timeline.end.music,'the roar played, then the old runtime is silenced');
  assert.deepEqual(timeline.loading,{ visible: true,label: 'RESTARTING GAME',progress: 0,credits: false,remembered: '1' });
  const after = timeline.after;
  assert.ok(!after.veil && after.ending && after.fuse === timeline.end.fuse,'nothing resumes after the end');
  const navigation = page.waitForNavigation();
  releaseRestart(); await navigation;
  await page.waitForFunction(() => window.corridorTest && corridorTest.getState().playing && !corridorTest.getState().ending);
  const restarted = await state();
  assert.ok(restarted.collapsed && restarted.powerCut && !restarted.ended && !restarted.veil,'the remembered game resumes automatically');
  assert.deepEqual([restarted.x,restarted.y,restarted.z],[0,0,3]);
  assert.equal(new URL(page.url()).searchParams.has('restart'),false,'the one-shot restart marker is cleared');
  assert.deepEqual(await page.evaluate(() => restartMilestones),[20,45,75,85,100],'progress follows completed loading stages');
  await page.click('canvas');
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w');
  assert.ok((await state()).z < restarted.z-.1,'mouse capture and movement work after the automatic restart');
  await page.reload(); await page.waitForFunction(() => !!window.corridorTest);
  const refreshed = await state();
  assert.deepEqual([refreshed.x,refreshed.y,refreshed.z],[restarted.x,restarted.y,restarted.z],'restart and refresh use the same spawn');
  assert.ok(refreshed.collapsed && !refreshed.playing,'ordinary refresh retains its usual entry card');
});

test('the blast front fills the tunnel in view of the pedestal before it arrives', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  const result = await page.evaluate(() => {
    const game = corridorTest, S = game.service;
    game.setPosition(...S.point(S.roomS+1,0,0)); game.lookAt(...S.point(S.roomS,0,1.19));
    document.dispatchEvent(new KeyboardEvent('keydown',{ code: 'KeyE' }));
    document.dispatchEvent(new KeyboardEvent('keyup',{ code: 'KeyE' }));
    while (game.getState().frontS === null || game.getState().frontS < 62) game.update(1/60);
    const eye = S.point(S.roomS+1,0,1.65), far = S.point(60,0,1.65);
    const dir = [far[0]-eye[0],far[1]-eye[1],far[2]-eye[2]];
    const first = game.renderedHits(eye,dir,40)[0];
    return { fire: first?.objectId === S.fireId,ended: game.getState().ended,flash: game.getState().flash };
  });
  assert.ok(result.fire,'the first thing down the tunnel is the front');
  assert.ok(!result.ended && result.flash<.05,'the view is not washed out while it is still far off');
});

test('a rider standing at the end of the car, or pushing against its ends in transit, can always walk off at the next landing', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const result = await page.evaluate(() => {
    const game = corridorTest, out = {};
    const press = () => {
      document.dispatchEvent(new KeyboardEvent('keydown',{ code: 'KeyE' }));
      document.dispatchEvent(new KeyboardEvent('keyup',{ code: 'KeyE' }));
    };
    const ride = (push,start) => {
      // Once the gates are shut, lean on one end of the car for the whole trip.
      follow([[start,-49.3]]);
      for (let i = 0; i < 60*20 && (game.getState().liftPos !== game.getState().liftTarget || i < 90); i++) {
        game.update(1/60);
        if (game.getState().liftGates.every(open => open === 0)) game.move(push*.05,0);
      }
      return game.getState();
    };
    // From the bottom: press, then step to the west end of the deck, beside the open gate.
    let y = game.getState().liftY;
    game.setPosition(-33,y,-49.3); game.lookAt(-32.4,y+1.18,-48.3); press();
    follow([[-34.85,-49.3]]); out.heldBottom = run(3);
    out.up = ride(-1,-34.5);
    run(1.2); out.offTop = follow([[-33,-50],[-29,-50]]);
    // From the top: back on, press, then step to the east end beside the hub gate.
    follow([[-33,-49.3]]); y = game.getState().y;
    game.lookAt(-32.4,y+1.18,-48.3); press();
    follow([[-31.15,-49.3]]); out.heldTop = run(3);
    out.down = ride(1,-31.5);
    run(1.2); out.offBottom = follow([[-33,-50],[-37,-50]]);
    return out;
  });
  assert.ok(result.heldBottom.liftPos === 1 && result.heldBottom.liftGates[1] === 1,'the car waits while a rider stands at its west end: ' + JSON.stringify(result.heldBottom));
  assert.ok(Math.abs(result.up.y+1.5)<1e-6 && result.up.liftPos === 0,'the rider arrives at the hub: ' + JSON.stringify(result.up));
  assert.equal(result.offTop,null,'and walks off: ' + JSON.stringify(result.offTop));
  assert.ok(result.heldTop.liftPos === 0 && result.heldTop.liftGates[0] === 1,'the car waits while a rider stands at its east end: ' + JSON.stringify(result.heldTop));
  assert.ok(Math.abs(result.down.y+21)<1e-6 && result.down.liftPos === 1,'the rider arrives at the sump: ' + JSON.stringify(result.down));
  assert.equal(result.offBottom,null,'and walks off: ' + JSON.stringify(result.offBottom));
});

test('the intake is lit from both walls, and nothing lights the world before the button', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const game = corridorTest, sides = [];
    for (const i of [15,35,55,75,95]) {
      const f = game.tunnelFrames[i];
      for (const side of [-1,1]) sides.push(game.materialHit([f.center.x,1.4,f.center.z],[f.right.x*side,0,f.right.z*side],3));
    }
    return { sides,blastLight: game.getState().blastLight };
  });
  assert.deepEqual(result.sides,Array(10).fill('lit'),'a lamp on each wall at every bay');
  assert.equal(result.blastLight[3],0,'the blast light is dark until the front exists');
});

test('the service cable tray starts inside the doorway with a closed end', async t => {
  const page = await open(t);
  const hits = await page.evaluate(() => {
    const game = corridorTest, S = game.service;
    game.unlockSouth(); for (let i = 0; i < 240; i++) game.update(1/60);
    return [[1.3,2.4],[1.45,2.38],[1.25,2.45]].map(([u,v]) => {
      const o = S.point(-1,u,v), d = S.point(1,u,v), dir = [d[0]-o[0],d[1]-o[1],d[2]-o[2]];
      return { material: game.materialHit(o,dir,3),distance: game.renderedHits(o,dir,3)[0]?.distance };
    });
  });
  for (const hit of hits) assert.ok(hit.material === 'steel' && Math.abs(hit.distance-1.3)<.01,'a ray along the tray meets its end plate: ' + JSON.stringify(hit));
});

test('sound: recorded steps follow the floor, reverb follows the zone, and water and the lift motor run with them', async t => {
  const page = await open(t);
  await page.click('#sound');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  await page.waitForFunction(() => corridorTest.getState().samples.length === 22,null,{ timeout: 20000 });
  assert.deepEqual(await page.evaluate(() => corridorTest.getState().samples),['birds','button','concrete','ending','explosion1','explosion2','grass','hatch','hum',
    'key','liftLoop','liftStart','liftStop','lock','metal','rubble','shutter','stone','ventilation','water','wheel','wind']);
  const places = await page.evaluate(() => {
    const game = corridorTest, S = game.service, at = (x,y,z) => {
      game.setPosition(x,y,z); game.move(0,-.05); game.update(1/60);
      const st = game.getState(); return [st.stepSurface,st.room];
    };
    return { intake: at(0,0,3),bridge: at(12,0,-40),store: at(-20,-1.5,-37),cave: at(...S.point(S.roomS-3,0,0)),control: at(-66,-21,-50) };
  });
  assert.deepEqual(places,{ intake: ['concrete','bend'],bridge: ['metal','reservoir'],store: ['concrete','store'],cave: ['stone','cave'],control: ['concrete','control'] });
  const walked = await page.evaluate(() => {
    const game = corridorTest;
    game.setPosition(12,0,-40); game.setLook(0); game.keys.add('KeyW'); run(1.5); game.keys.delete('KeyW');
    const st = game.getState(), eye = [st.x,st.y+1.65,st.z];
    return { step: st.lastStep,listener: st.listener.map((v,i) => Math.abs(v-eye[i])) };
  });
  assert.equal(walked.step,'metal','walking the bridge plays a recorded metal step');
  assert.ok(walked.listener.every(d => d<1e-4),'the listener is at the eye: ' + walked.listener);
  await page.evaluate(() => { corridorTest.setPosition(15.3,0,-36.95); corridorTest.setLook(0,-.4); });
  await page.keyboard.press('e');
  const pouring = await page.evaluate(() => run(1));
  assert.equal(pouring.waterLevel,10,'water runs at full level while the level falls fast');
  const easing = await page.evaluate(() => run(1.6));
  assert.ok(easing.waterLevel>0 && easing.waterLevel<10,'and fades as it slows: ' + easing.waterLevel);
  const settled = await page.evaluate(() => run(4));
  assert.equal(settled.waterLevel,0,'and is silent once the water has all but settled');
  await page.evaluate(() => { corridorTest.setPosition(-29.6,-1.5,-49.3); corridorTest.lookAt(-30.35,-.32,-48.13); });
  await page.keyboard.press('e');
  const travelling = await page.evaluate(() => run(2));
  assert.ok(travelling.motorLevel>0 && travelling.liftTrip === 'running','the lift runs while the car travels');
  const stopping = await page.evaluate(() => { while (Math.abs(corridorTest.getState().liftTarget-corridorTest.getState().liftPos)*10 > 1.2) corridorTest.update(1/60); return corridorTest.getState(); });
  assert.equal(stopping.liftTrip,'stopping','the stop starts just before the car docks');
  const docked = await page.evaluate(() => run(3));
  assert.ok(docked.motorLevel === 0 && docked.liftTrip === null && docked.liftPos === 0,'and the trip ends when it docks');
  assert.deepEqual(docked.beds,['ventilation','wind'],'the ventilation and cave-air beds are running');
});

test('after the ending, a later visit finds the intake fallen in; forgetting restores it', async t => {
  const page = await open(t);
  await page.evaluate(() => localStorage.setItem('corridor-crawler-collapsed','1'));
  await page.reload();
  await page.waitForFunction(() => !!window.corridorTest);
  assert.ok(await page.locator('#forget').isVisible(),'the card offers to forget');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await installFollow(page);
  const fallen = await page.evaluate(() => {
    const game = corridorTest, f = game.tunnelFrames, beyond = f[45].center;
    const stuck = follow(f.slice(0,46).filter(frame => frame.center.z <= 3).map(frame => [frame.center.x,frame.center.z]));
    const reached = f.reduce((best,frame,i) => Math.hypot(frame.center.x-game.player.x,frame.center.z-game.player.z) < Math.hypot(f[best].center.x-game.player.x,f[best].center.z-game.player.z) ? i : best,0);
    return { stuck: !!stuck,reached,state: game.getState(),beyond: [beyond.x,beyond.z] };
  });
  assert.ok(fallen.state.collapsed && fallen.state.powerCut,'collapsed, with the power gone');
  assert.ok(fallen.stuck && fallen.reached >= 20 && fallen.reached <= 26,'a few metres in, the rubble stops the walk at frame ' + fallen.reached);
  await page.evaluate(() => corridorTest.pause());
  await Promise.all([page.waitForNavigation(),page.click('#forget')]);
  await page.waitForFunction(() => !!window.corridorTest);
  const whole = await page.evaluate(() => ({ state: corridorTest.getState(),stored: localStorage.getItem('corridor-crawler-collapsed') }));
  assert.ok(!whole.state.collapsed && !whole.state.powerCut && whole.stored === null,'forgotten: the intake is whole again');
  assert.ok(!(await page.locator('#forget').isVisible()));
});

test('the pause card sets look speed, inverted look, and volume, and remembers them', async t => {
  const page = await open(t);
  assert.equal(await page.locator('#description').count(),0,'the card has no description');
  const setRange = (id,value) => page.evaluate(([id,value]) => {
    const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('input'));
  },[id,value]);
  const turn = () => page.evaluate(() => {
    corridorTest.setLook(0,0); corridorTest.look(100,50); const { yaw,pitch } = corridorTest.getState(); return { yaw,pitch };
  });
  const base = await turn();
  await setRange('look-speed','2');
  await page.click('label[for=invert-look]');
  await setRange('volume','40');
  const fast = await turn();
  assert.ok(Math.abs(fast.yaw-2*base.yaw)<1e-9 && Math.abs(fast.pitch+2*base.pitch)<1e-9,'twice as fast, vertical inverted: ' + JSON.stringify({ base,fast }));
  assert.equal(await page.locator('#look-speed-value').textContent(),'2.00×');
  assert.equal(await page.locator('#volume-value').textContent(),'40%');
  await page.reload();
  await page.waitForFunction(() => !!window.corridorTest);
  const kept = await page.evaluate(() => ({ ...corridorTest.settings }));
  assert.deepEqual(kept,{ lookSpeed: 2,invertLook: true,volume: .4 },'remembered across visits');
  assert.ok(await page.locator('#invert-look').isChecked());
  await page.evaluate(() => localStorage.setItem('corridor-crawler-settings','{"lookSpeed":99,"volume":"loud","invertLook":"yes"}'));
  await page.reload();
  await page.waitForFunction(() => !!window.corridorTest);
  assert.deepEqual(await page.evaluate(() => ({ ...corridorTest.settings })),{ lookSpeed: 3,invertLook: false,volume: .8 },'stored values are clamped');
});

// A visit after the ending: the remembered collapse opens the way out.
async function openCollapsed(t) {
  const page = await open(t);
  await page.evaluate(() => localStorage.setItem('corridor-crawler-collapsed','1'));
  await page.reload();
  await page.waitForFunction(() => !!window.corridorTest);
  return page;
}

test('before the ending the intake ends at a shut door, with no sign, that will not open', async t => {
  const page = await open(t);
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  const result = await page.evaluate(() => {
    const game = corridorTest;
    game.setPosition(0,0,5.5); game.move(0,3);
    const stopped = game.getState().z;
    game.lookAt(.38,1.02,7.01); game.update(1/60);
    const first = game.renderedHitObjects([0,1.7,5],[0,0,1],3)[0];
    return { stopped,prompt: document.getElementById('prompt').textContent,behind: game.floorHeight(0,10,0),
      door: first.object.material.map ? 'a sign' : first.point.z,outdoors: game.wayOut.outdoors() };
  });
  assert.ok(result.stopped < 6.9,'the door stops the walk at ' + result.stopped);
  assert.ok(typeof result.door === 'number' && result.door > 7.05 && result.door < 7.16,'the door fills the opening, no sign: ' + result.door);
  assert.equal(result.prompt,'E / TRY THE DOOR');
  assert.equal(result.behind,null,'nothing is built behind it');
  assert.equal(result.outdoors,false);
  await page.keyboard.press('e');
  assert.equal(await page.locator('#prompt').textContent(),'IT WILL NOT OPEN');
});

test('after the ending the door stands open, and sprinting up the stair to the surface takes 25 to 30 seconds', async t => {
  const page = await openCollapsed(t);
  await page.click('#sound');
  await page.click('#enter');
  await page.waitForFunction(() => corridorTest.getState().playing);
  await page.waitForFunction(() => ['birds','hum'].every(name => corridorTest.getState().samples.includes(name)),null,{ timeout: 20000 });
  const climb = await page.evaluate(() => {
    const game = corridorTest, W = game.wayOut, marks = {};
    game.setPosition(0,0,5); game.setLook(Math.PI,0); game.update(1/60);
    marks.underground = { outdoors: W.outdoors(),far: W.far() };
    game.keys.add('KeyW'); game.keys.add('ShiftLeft');
    let t = 0, eye = game.getState().eyeY;
    marks.eyeJump = 0;
    while (t < 80 && game.player.z < W.bunkerFront+5) {
      game.update(1/60); t += 1/60;
      const eyeY = game.getState().eyeY;
      if (game.player.z > W.stairBase && game.player.z < W.hatchZ-2) marks.eyeJump = Math.max(marks.eyeJump,Math.abs(eyeY-eye));
      eye = eyeY;
      const { zone,room } = game.getState();
      if (marks.reception === undefined && zone === 'reception') marks.reception = t;
      if (marks.stairs === undefined && zone === 'stairs') marks.stairs = t;
      if (marks.stairStart === undefined && game.player.z >= W.stairBase) marks.stairStart = t;
      if (marks.top === undefined && game.player.y >= W.surfaceY-.001) marks.top = t;
      if (zone === 'stairs') marks.stairRoom = room;
    }
    game.keys.clear();
    for (let i = 0; i < 90; i++) game.update(1/60);
    const state = game.getState();
    return { ...marks,end: t,state,outdoors: W.outdoors(),far: W.far(),surfaceY: W.surfaceY,ground: W.ground(state.x,state.z) };
  });
  assert.deepEqual(climb.underground,{ outdoors: false,far: 110 },'nothing of the surface is drawn from the intake');
  assert.ok(climb.reception > 0 && climb.stairs > climb.reception,'through the door, the reception, and onto the stair');
  assert.equal(climb.stairRoom,'stairs','the stair has its own reverb');
  assert.ok(climb.eyeJump < .08,'the eye eases up each riser rather than snapping 0.17 m: ' + climb.eyeJump);
  const seconds = climb.top-climb.stairStart;
  assert.ok(seconds >= 25 && seconds <= 30,'a sprint up the stair takes ' + seconds.toFixed(1) + ' s');
  assert.equal(climb.state.zone,'outside');
  assert.ok(Math.abs(climb.state.y-climb.ground) < 1e-9 && Math.abs(climb.state.y-climb.surfaceY) < .3,'out through the hatch onto the ground: ' + climb.state.y);
  assert.ok(climb.outdoors && climb.far === 9000,'the surface is drawn, out to the mountains');
  assert.equal(climb.state.stepSurface,'grass');
  assert.equal(climb.state.lastStep,'grass','steps outside are in grass');
  assert.equal(climb.state.room,'outside');
  assert.ok(climb.state.beds.includes('birds'),'birdsong outside: ' + climb.state.beds);
});

test('the way out joins cleanly: one floor at each threshold, every tread at its height, headroom and walls up the stair', async t => {
  const page = await openCollapsed(t);
  const result = await page.evaluate(() => {
    const game = corridorTest, W = game.wayOut, G = W.surfaceY;
    const layers = [[0,0,7.075],[0,0,22.95],[0,0,24],[0,G,W.hatchZ-.3],[0,G,W.hatchZ+.3]].map(p => game.floorLayersAt(...p).length);
    const treads = [], headroom = [], walls = [];
    for (let z = W.stairBase+.05; z < W.hatchZ-.05; z += .1) {
      if (Math.abs((z-W.stairBase)%.3) < .03) continue;
      const y = W.stairFloor(z);
      for (const x of [-.9,0,.9]) {
        const found = game.floorHeight(x,z,y);
        if (found === null || Math.abs(found-y) > 1e-4) treads.push([x,z,y,found]);
        // Short of the hatch wall, which a walker cannot stand within a body's width of.
        if (z < W.hatchZ-.3 && game.blocked(x,z,y)) headroom.push([x,z,y]);
      }
    }
    for (let z = W.stairBase+3; z < W.hatchZ; z += 9.7) {
      const y = W.stairFloor(z);
      for (const side of [-1,1]) for (const h of [.3,1.2,2.2]) {
        const hit = game.renderedHits([0,y+h,z],[side,0,0],1.6)[0];
        if (!hit || Math.abs(Math.abs(hit.point[0])-1.2) > .1) walls.push([side,z,h,hit && hit.point]);
      }
      const up = game.renderedHits([0,y+.1,z],[0,1,0],4)[0];
      if (!up || up.point[1]-y < 2.6) walls.push(['ceiling',z,up && up.point]);
    }
    const opening = game.renderedHits([0,G+1,W.hatchZ-.4],[0,0,1],1.2).length;
    // Nothing of the bunker's outside cuts across the stair under the ceiling where its roof breaks the ground.
    const underRoof = [-1,0,1].map(x => game.renderedHits([x,W.stairFloor(W.bunkerBack-.5)+2.3,W.bunkerBack-.5],[0,0,1],1).length);
    // The round opening stays inside the stair's walls at every height, so the wall face beside
    // it is whole all the way up.
    const beside = [-1.18,1.18].flatMap(x => [.3,.9,1.5].map(h => game.renderedHits([x,G+h,W.hatchZ-.4],[0,0,1],1)[0]?.point[2]));
    return { layers,treads,headroom,walls,opening,underRoof,beside,hatchZ: W.hatchZ,G,
      ground: W.ground(0,W.bunkerFront+2),inside: W.ground(0,W.hatchZ-1) };
  });
  assert.deepEqual(result.layers,[1,1,1,1,1],'one floor at the door, the stair mouth, the bottom landing, and either side of the hatch wall');
  assert.deepEqual(result.treads,[],'every tread and landing at its height');
  assert.deepEqual(result.headroom,[],'nothing overhead blocks the climb');
  assert.deepEqual(result.walls,[],'walls close both sides and the ceiling clears the treads');
  assert.equal(result.opening,0,'the hatch opening is clear');
  assert.deepEqual(result.underRoof,[0,0,0],'no face crosses the stair below the bunker roof');
  assert.ok(result.beside.every(z => Math.abs(z-result.hatchZ) < .01),'the hatch wall stands either side of it: ' + result.beside);
  assert.ok(Math.abs(result.ground-result.G) < 1e-9 && result.inside === null,'level ground outside the hatch; the bunker floor inside it');
});

test('the way out flickers: working lamps stutter and drop out, dead ones stay dark', async t => {
  const page = await openCollapsed(t);
  const seen = await page.evaluate(() => {
    const game = corridorTest, levels = [];
    game.setPosition(0,0,12);
    for (let i = 0; i < 1200; i++) { game.update(1/60); levels.push(game.wayOut.lamps().map(lamp => lamp.level)); }
    return game.wayOut.lamps().map((lamp,k) => ({ mode: lamp.mode,on: levels.filter(l => l[k] > 0).length/levels.length }));
  });
  assert.ok(seen.filter(l => l.mode === 'dead').every(l => l.on === 0),'dead lamps stay dark');
  const flickering = seen.filter(l => l.on > 0 && l.on < 1);
  assert.ok(flickering.length >= 8,'many lamps flicker within twenty seconds: ' + flickering.length);
  assert.ok(seen.filter(l => l.mode === 'steady').every(l => l.on > .7),'steady lamps are mostly on: ' + JSON.stringify(seen));
  assert.ok(seen.filter(l => l.mode === 'dying').every(l => l.on < .5),'dying lamps are mostly off: ' + JSON.stringify(seen));
});

test('the surface: the ground carries a walker over the meadow, and trees and the forest edge stop them', async t => {
  const page = await openCollapsed(t);
  const result = await page.evaluate(() => {
    const game = corridorTest, W = game.wayOut, G = W.surfaceY;
    game.setPosition(0,G,W.bunkerFront+1);
    game.move(0,30);
    const meadow = game.getState(), onGround = Math.abs(meadow.y-W.ground(meadow.x,meadow.z)) < 1e-9;
    game.move(-200,-60); const west = game.getState();
    // South, beside the bunker rather than back down its hatch.
    game.setPosition(10,W.ground(10,meadow.z),meadow.z); game.move(0,-150); const south = game.getState();
    // Behind the bunker, over the buried stair, the ground is open: the stair's own walls stay below it.
    const z = W.bunkerBack-3; game.setPosition(-5,W.ground(-5,z),z); game.move(10,0); const behind = game.getState();
    return { meadow,onGround,west,south,behind,centre: W.meadow };
  });
  assert.ok(result.meadow.z > 170 && result.onGround,'thirty metres across the meadow, on the ground: ' + JSON.stringify(result.meadow));
  assert.ok(result.behind.x > 4.9,'nothing invisible stops a walk across behind the bunker: ' + result.behind.x);
  for (const end of [result.west,result.south]) {
    const d = Math.hypot(end.x-result.centre.x,end.z-result.centre.z);
    assert.ok(d < 135,'stopped at the trees or the forest edge, ' + d.toFixed(1) + ' m from the meadow centre: ' + JSON.stringify([end.x,end.z]));
  }
});

test('the surface title fades in after exiting the bunker and stays fixed in the sky toward the city', async t => {
  const page = await openCollapsed(t);
  const result = await page.evaluate(() => {
    const game = corridorTest, W = game.wayOut;
    game.setPosition(0,W.surfaceY,W.hatchZ-1.5); game.setPlaying(true); game.update(1);
    const inside = W.title();
    game.setPosition(0,W.ground(0,W.bunkerFront+2),W.bunkerFront+2); game.update(.5);
    const starting = W.title();
    game.pause(); game.update(10); const paused = W.title();
    game.setPlaying(true); game.update(2.5); const full = W.title();
    const origin = [game.player.x,game.player.y+1.65,game.player.z], direction = full.position.map((v,i) => v-origin[i]);
    const titleHit = game.renderedHitObjects(origin,direction,400).some(hit => hit.object.name === 'sky-title');
    game.move(5,0); game.setLook(Math.PI); game.update(.5); const turned = W.title();
    return { inside,starting,paused,full,turned,titleHit,meadow: W.meadow,city: W.cityAt,surfaceY: W.surfaceY };
  });
  assert.ok(!result.inside.reached && result.inside.opacity === 0,'no title while still in the bunker');
  assert.ok(result.starting.reached && result.starting.opacity > 0 && result.starting.opacity < 1,'a gradual fade when outside');
  assert.equal(result.paused.opacity,result.starting.opacity,'pausing holds the fade');
  assert.equal(result.full.opacity,1);
  assert.deepEqual(result.turned.position,result.full.position,'walking and turning do not move the title');
  assert.ok(result.titleHit && result.full.size[0] >= 100,'the large title is actual world geometry');
  const [x,y,z] = result.full.position, M = result.meadow, C = result.city;
  assert.ok(y > result.surfaceY+60,'above the skyline');
  assert.ok(Math.abs((x-M.x)*(C.z-M.z)-(z-M.z)*(C.x-M.x)) < .00001,'in the direction of the city');
  assert.equal(await page.locator('#credits').count(),0,'no screen-space credits');
});

test('the cityward walking boundary follows the baked grass edge even down in the valley', async t => {
  const page = await openCollapsed(t);
  const result = await page.evaluate(() => {
    const game = corridorTest, W = game.wayOut, edge = W.grassBounds.z1;
    const centreX = W.meadow.x+(edge-W.meadow.z)*W.valley.x/W.valley.z;
    const walks = [-20,0,20].map(offset => {
      const x = centreX+offset, z = edge-3, y = W.ground(x,z);
      game.setPosition(x,y,z); game.move(0,20);
      const stopped = game.getState();
      game.move(7,7); const diagonal = game.getState();
      return { y,stopped,diagonal,inside: game.blocked(x,edge-.8,W.ground(x,edge-.8)),
        beyond: game.blocked(x,edge+.5,W.ground(x,edge+.5)) };
    });
    const lowerZ = edge+100, lowerX = W.meadow.x+(lowerZ-W.meadow.z)*W.valley.x/W.valley.z;
    const lowerY = W.ground(lowerX,lowerZ);
    return { edge,walks,surfaceY: W.surfaceY,lowerY,lowerBlocked: game.blocked(lowerX,lowerZ,lowerY) };
  });
  assert.ok(result.lowerY < result.surfaceY-12 && result.lowerBlocked,'the lower valley beyond the boundary stays blocked');
  for (const walk of result.walks) {
    assert.ok(!walk.inside && walk.beyond,'walkable just inside the grass, blocked beyond it');
    assert.ok(walk.stopped.z < result.edge-.24 && walk.stopped.z > result.edge-.4,'stops at the grass edge');
    assert.ok(walk.diagonal.z < result.edge-.24,'diagonal motion cannot cross the edge');
    assert.ok(walk.diagonal.x > walk.stopped.x+6.9,'can still walk along the boundary');
  }
});

test('flower stems and leaves stay rooted while the rendered blooms sway in the meadow wind', async t => {
  const page = await openCollapsed(t);
  await page.click('#enter'); await page.waitForFunction(() => corridorTest.getState().playing);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const game = corridorTest, parts = game.wayOut.flowers(), heads = parts.find(p => p.name === 'flower-heads');
    const stems = parts.find(p => p.name === 'flower-stems'), leaves = parts.find(p => p.name === 'flower-leaves');
    const counts = parts.map(p => p.count), pose = heads.geometry.attributes.flowerPose, phase = heads.geometry.attributes.flowerPhase;
    let chosen = 0, score = -Infinity;
    for (let i = 0; i < heads.count; i++) {
      const colours = heads.instanceColor.array;
      if (colours[i*3] < colours[i*3+1]*3) continue;
      const value = pose.getW(i)-.002*Math.hypot(pose.getX(i)-4,pose.getZ(i)-182);
      if (value > score) { score = value; chosen = i; }
    }
    const root = [pose.getX(chosen),pose.getY(chosen),pose.getZ(chosen)], height = pose.getW(chosen);
    // Isolate one actual plant so its GPU-rendered motion can be measured without swaying grass.
    for (const child of heads.parent.children) child.visible = parts.includes(child) || child.isLight;
    for (const part of parts) {
      const matrix = part.matrix.clone(); part.getMatrixAt(chosen,matrix); part.setMatrixAt(0,matrix);
      part.count = 1; part.instanceMatrix.needsUpdate = true;
    }
    heads.instanceColor.array.set(heads.instanceColor.array.slice(chosen*3,chosen*3+3),0); heads.instanceColor.needsUpdate = true;
    pose.array.set([...root,height],0); phase.array[0] = phase.getX(chosen); pose.needsUpdate = phase.needsUpdate = true;
    game.setPosition(root[0]-.85,game.wayOut.ground(root[0]-.85,root[2]),root[2]);
    game.lookAt(root[0],root[1]+height*.5,root[2]);
    const screen = document.querySelector('canvas'), pixels = document.createElement('canvas');
    pixels.width = screen.width; pixels.height = screen.height;
    const context = pixels.getContext('2d'), frames = [];
    for (const dt of [0,1.2,1.2,1.2]) {
      game.update(dt); game.render(); context.drawImage(screen,0,0);
      const data = context.getImageData(0,0,pixels.width,pixels.height).data, red = [], green = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], point = [i/4%pixels.width,Math.floor(i/4/pixels.width)];
        if (r > 70 && r > g*1.6 && r > b*1.5) red.push(point);
        if (g > 45 && g > r*1.1 && g > b*1.5) green.push(point);
      }
      const bottom = green.reduce((max,p) => Math.max(max,p[1]),0), roots = green.filter(p => p[1] >= bottom-1);
      frames.push({ headPixels: red.length,greenPixels: green.length,
        headX: red.reduce((sum,p) => sum+p[0],0)/red.length,
        rootX: roots.reduce((sum,p) => sum+p[0],0)/roots.length,rootY: bottom });
    }
    return { counts,leafVertices: leaves.geometry.attributes.position.count,
      stemSegments: stems.geometry.parameters.heightSegments,frames };
  });
  assert.deepEqual(result.counts,[9000,9000,9000],'each bloom has a stem and leaves');
  assert.ok(result.leafVertices >= 15 && result.stemSegments > 1,'folded leaves and a segmented stem that can curve');
  assert.ok(result.frames.every(f => f.headPixels > 50 && f.greenPixels > 50),'blooms and brighter greenery actually render');
  const range = name => Math.max(...result.frames.map(f => f[name]))-Math.min(...result.frames.map(f => f[name]));
  assert.ok(range('headX') > 4,'the rendered blooms sway: ' + JSON.stringify(result.frames));
  assert.ok(range('rootX') < 1.5 && range('rootY') < 1.5,'the roots stay planted: ' + JSON.stringify(result.frames));
});

test('the approved personal belongings sit on their supports and leave the controls usable', async t => {
  const page = await open(t);
  await page.waitForFunction(() => corridorTest.remnants().find(p => p.name === 'control-family-photo')
    .getObjectByName('photo-print').material.uniforms.photoMap.value.image?.complete);
  const result = await page.evaluate(() => {
    const game = corridorTest, props = game.remnants(), mug = props.find(p => p.name === 'control-coffee-mug');
    const photo = props.find(p => p.name === 'control-family-photo'), gloves = props.find(p => p.name === 'pump-work-gloves');
    const root = mug.position.toArray(), coffee = game.renderedHitObjects([root[0],root[1]+.2,root[2]],[0,-1,0],.4)[0];
    const counter = game.renderedHitObjects([-69.7,root[1]+.2,-50.3],[0,-1,0],.5)[0];
    const print = photo.getObjectByName('photo-print'), image = print.material.uniforms.photoMap.value.image;
    const photoHit = game.renderedHitObjects([photo.position.x+.1,photo.position.y,photo.position.z],[-1,0,0],.2)[0];
    let railIntersections = 0, vertices = 0;
    gloves.updateMatrixWorld(true);
    gloves.traverse(part => {
      if (!part.isMesh) return;
      const p = part.geometry.attributes.position, point = game.player.clone(); vertices += p.count;
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p,i).applyMatrix4(part.matrixWorld);
        if (Math.abs(point.y-.9) < .029 && Math.abs(point.z+36.6) < .029) railIntersections++;
      }
    });
    game.setPosition(15.3,0,-36.95); game.lookAt(15.3,1.15,-37.52); game.setPlaying(true); game.update(0);
    const pumpPrompt = document.getElementById('prompt').textContent;
    game.setPosition(-68.3,-21,-49.5); game.lookAt(-69.45,-20,-49.5); game.update(0);
    const shutterPrompt = document.getElementById('prompt').textContent;
    return { names: props.map(p => p.name).sort(),root,counterY: counter.point.y,coffeeY: coffee.point.y,
      coffeeName: coffee.object.name,image: { complete: image.complete,width: image.naturalWidth,height: image.naturalHeight },
      photoName: photoHit.object.name,railIntersections,vertices,pumpPrompt,shutterPrompt };
  });
  assert.deepEqual(result.names,['control-coffee-mug','control-family-photo','control-work-jacket','pump-work-gloves']);
  assert.ok(Math.abs(result.root[1]-result.counterY) < .00001,'the cup rests directly on the counter');
  assert.equal(result.coffeeName,'mug-coffee-residue','the cup is open, with residue visible through the rim');
  assert.ok(result.coffeeY-result.root[1] < .03,'the coffee sits down inside the hollow cup');
  assert.ok(result.image.complete && result.image.width >= 1024 && result.image.height >= 768,'the real photograph loads');
  assert.equal(result.photoName,'photo-print','the photograph sits in front of its paper and the wall');
  assert.ok(result.vertices > 1000 && result.railIntersections === 0,'detailed glove shells stay outside the rail: ' + result.railIntersections);
  assert.equal(result.pumpPrompt,'E / DRAIN THE RESERVOIR');
  assert.equal(result.shutterPrompt,'E / RELEASE THE NORTH SHUTTER');
});

test('both jacket sleeves share continuous fabric with the torso at their armholes', async t => {
  const page = await open(t);
  const result = await page.evaluate(() => {
    const jacket = corridorTest.remnants().find(p => p.name === 'control-work-jacket');
    const geometry = jacket.getObjectByName('jacket-cloth').geometry, p = geometry.attributes.position;
    const parent = Array.from({ length: p.count },(_,i) => i), coincident = new Map();
    function root(i) {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    }
    function join(a,b) { parent[root(a)] = root(b); }
    for (let i = 0; i < p.count; i++) {
      const key = [p.getX(i),p.getY(i),p.getZ(i)].map(v => Math.round(v*1e6)).join(',');
      if (coincident.has(key)) join(i,coincident.get(key));
      else coincident.set(key,i);
    }
    const count = geometry.index ? geometry.index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0,1,2].map(j => geometry.index ? geometry.index.getX(i+j) : i+j);
      join(triangle[0],triangle[1]); join(triangle[1],triangle[2]);
    }
    function nearest(x,y,z) {
      let index = 0, distance = Infinity;
      for (let i = 0; i < p.count; i++) {
        const d = (p.getX(i)-x)**2+(p.getY(i)-y)**2+(p.getZ(i)-z)**2;
        if (d < distance) { distance = d; index = i; }
      }
      return { component: root(index),distance: Math.sqrt(distance) };
    }
    return { torso: nearest(-.14,-.15,.084),left: nearest(-.30,-.50,.13),right: nearest(.33,-.45,.13) };
  });
  for (const sample of Object.values(result)) assert.ok(sample.distance < .035,'probe lands on the intended fabric');
  assert.equal(result.left.component,result.torso.component,'the left sleeve is sewn into the body');
  assert.equal(result.right.component,result.torso.component,'the right sleeve is sewn into the body');
});
