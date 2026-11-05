'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { skateSim } = require('./helpers/skate-sim.cjs');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../city/skate-gestures.js'), 'utf8'), ctx);
const make = vm.runInContext('createSkateGesture', ctx), stick = vm.runInContext('skateStick', ctx);
const paths = {
  '': [[0, 1], [0, .4], [0, -.4], [0, -1]],
  A: [[0, 1], [-.2, .4], [-.4, -.4], [-.7, -.8]],
  D: [[0, 1], [.2, .4], [.4, -.4], [.7, -.8]]
};
for (const [key, turn] of [['S', Math.PI], ['AS', Math.PI * 1.5], ['360S', -Math.PI * 1.5]])
  paths[key] = Array.from({ length: 15 }, (_, i) => [Math.cos(Math.PI / 2 + turn * i / 14), Math.sin(Math.PI / 2 + turn * i / 14)]).concat([[0, 0]]);
let seed = 1;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

for (const [key, path] of Object.entries(paths)) test(`gesture ${key || 'ollie'}: at least 95/100 noisy paths recognised`, () => {
  let correct = 0;
  for (let run = 0; run < 100; run++) {
    const g = make(), events = []; let t = 0;
    const interval = .008 + random() * .002;
    for (const [x, y] of path) {
      const event = g.sample(x + (random() - .5) * .08, y + (random() - .5) * .08, t += interval);
      if (event) events.push(event);
    }
    if (events.length === 1 && events[0].key === key) correct++;
  }
  assert.ok(correct >= 95, `${correct}/100`);
});

test('radial dead zone preserves direction and scales smoothly', () => {
  assert.deepEqual(Array.from(stick(.1, .1)), [0, 0]);
  const [x, y] = stick(.3, .4);
  assert.ok(Math.abs(y / x - 4 / 3) < 1e-12);
  assert.ok(Math.abs(Math.hypot(x, y) - (.5 - .15) / .85) < 1e-12);
  assert.equal(Math.hypot(...stick(2, 0)), 1);
});

test('nollies, weak pops, timeout, re-arm, and bounded history', () => {
  const g = make(); g.sample(0, -1, 0);
  assert.equal(g.sample(0, 1, .1).nollie, true);
  assert.equal(g.sample(0, -1, .11), null, 'one pop until centred again');
  g.sample(0, 0, .12); g.sample(0, 1, .2);
  assert.equal(g.sample(0, -1, .5), null, '180 ms deadline');
  g.reset(); g.sample(0, .65, 0); const weak = g.sample(0, -.65, .17);
  assert.ok(weak.strength >= .7 && weak.strength < 1.15);
  for (let i = 0; i < 1000; i++) g.sample(.1, 0, 1 + i / 1000);
  assert.ok(g.samples.length <= 128);
  assert.ok(g.samples.at(-1).t - g.samples[0].t <= .4);
});

test('scripted gamepad input drives the production adapter; steering never pops', () => {
  const t = skateSim([
    { frames: 42, buttons: { push: true }, sticks: { left: [-.5, 0] } },
    { sticks: { right: [0, 1] } },
    { sticks: { right: [0, .3] } },
    { sticks: { right: [-.7, -.8] } }
  ]);
  assert.ok(t[42].speed > 0 && t[42].yaw < 0);
  assert.ok(t.slice(0, 43).every(p => p.z === 0 && p.trick === null));
  assert.equal(t.at(-1).trick, 'kickflip');
  assert.ok(t.at(-1).vz > 0);
});

test('human-speed scoops recognise at 30, 60 and 120 Hz without duplicate rebound pops',()=>{
 for(const hz of [30,60,120])for(const key of ['S','AS','360S']){
  const g=make(),turn=key==='S'?Math.PI:key==='AS'?Math.PI*1.5:-Math.PI*1.5;
  const events=[],count=Math.round(hz*.32);let t=0;
  for(let i=0;i<=count;i++){
   const angle=Math.PI/2+turn*i/count,ev=g.sample(Math.cos(angle),Math.sin(angle),t+=1/hz);if(ev)events.push(ev);
  }
  const ev=g.sample(0,0,t+=1/hz);if(ev)events.push(ev);
  assert.equal(events.length,1,`${hz}/${key}`);assert.equal(events[0].key,key);
  for(const [x,y]of [[0,-.3],[0,.7],[0,-.7],[0,0]]){const bounce=g.sample(x,y,t+=.008);assert.equal(bounce,null);}
 }
});

for(const hz of [30,60,120])test(`at ${hz} Hz, human-speed partial-stick gestures remain at least 95% correct`,()=>{
 for(const key of Object.keys(paths)){
  let correct=0;
  for(let run=0;run<100;run++){
   const g=make(),events=[],scoop=['S','AS','360S'].includes(key),count=Math.round(hz*(scoop?.32:.14)),depth=.85+random()*.15;let t=0;
   for(let i=0;i<=count;i++){
    let x,y;
    if(scoop){const turn=key==='S'?Math.PI:key==='AS'?Math.PI*1.5:-Math.PI*1.5,angle=Math.PI/2+turn*i/count;x=Math.cos(angle);y=Math.sin(angle);}
    else {const path=paths[key],at=i/count*(path.length-1),j=Math.min(path.length-2,Math.floor(at)),f=at-j;x=path[j][0]+(path[j+1][0]-path[j][0])*f;y=path[j][1]+(path[j+1][1]-path[j][1])*f;}
    const event=g.sample(x*depth+(random()-.5)*.04,y*depth+(random()-.5)*.04,t+=1/hz);if(event)events.push(event);
   }
   const event=g.sample(0,0,t+1/hz);if(event)events.push(event);
   if(events.length===1&&events[0].key===key)correct++;
  }
  assert.ok(correct>=95,`${hz}/${key}: ${correct}/100`);
 }
});

test('partial diagonal flips and every combined flip have playable controller gestures',()=>{
 const circle=(turn,count)=>Array.from({length:count+1},(_,i)=>[Math.cos(Math.PI/2+turn*i/count),Math.sin(Math.PI/2+turn*i/count)]);
 const combinations={WA:[...circle(Math.PI/2,7),[.7,-.7]],WD:[...circle(-Math.PI/2,7),[-.7,-.7]],DS:[...circle(-Math.PI,14),[.7,-.7],[0,0]]};
 for(const [key,path]of Object.entries(combinations)){
  let correct=0;
  for(let run=0;run<100;run++){
   const g=make(),events=[];let t=0;
   for(const [x,y]of path){const [sx,sy]=stick(x*.9+(random()-.5)*.03,y*.9+(random()-.5)*.03);const e=g.sample(sx,sy,t+=1/60);if(e)events.push(e);}
   if(events.length===1&&events[0].key===key)correct++;
  }
  assert.ok(correct>=95,`${key}: ${correct}/100`);
  const script=path.map(right=>({sticks:{right:right.map(v=>v*.9)}}));
  const actual=skateSim(script,{speed:.4}).at(-1);
  assert.equal(actual.trick,{WA:'hardflip',WD:'inward heelflip',DS:'varial heelflip'}[key]);
 }
 for(const [sign,key]of [[-1,'A'],[1,'D']]){
  const g=make();g.sample(0,.8,0);const [x,y]=stick(sign*.6,-.6),event=g.sample(x,y,.12);assert.equal(event.key,key);
 }
});
