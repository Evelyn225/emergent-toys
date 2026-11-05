'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { skateSim } = require('./helpers/skate-sim.cjs');

const run = [
  { frames: 42, keys: { KeyW: 1 } }, { frames: 12 },
  { frames: 42, keys: { KeyW: 1 } }, { frames: 12 },
  { frames: 42, keys: { KeyW: 1 } },
  { frames: 20, keys: { KeyA: 1 } },
  { frames: 20, keys: { Space: 1 } }, { frames: 60 }
];
const near = (got, want) => assert.ok(Math.abs(got - want) < 1e-8, `${got} != ${want}`);

test('three pushes, carve left, ollie: recorded riding and tuned pop curves', () => {
  const calibration={physics:{pushBurst:.06,pushCap:.6}};
  const t = skateSim(run,calibration);
  // Phase 1 intentionally replaces continuous 9 m/s pushing with .6 m/s
  // bursts tapering toward a 6 m/s cap, and lower rolling resistance. These
  // checkpoints preserve that deliberate change; e823d73 has the legacy curve.
  // Phase 7 also tunes normal/strong pop to 2.9/3.4 m/s, shortening the air.
  const golden = [
    [42, .049343654056, .032712892383, 0, 0],
    [54, .045797429611, .042197404066, 0, 0],
    [96, .088824808243, .103115616548, 0, 0],
    [150, .124110804193, .206578714018, 0, 0],
    [170, .115722583688, .242427989957, -.015148656855, 0],
    [190, .109672749311, .269327876577, -.041297633958, 0],
    [210, .109672749311, .295541275260, -.066779286413, .487592592593],
    [230, .109068755932, .321743846433, -.092250413608, 0],
    [250, .103038328256, .347055828042, -.116855812020, 0]
  ];
  for (const [i, speed, x, y, z] of golden) {
    for (const [key, want] of Object.entries({ speed, x, y, z })) near(t[i][key], want);
  }
  assert.equal(t[210].trick, 'ollie');
  assert.equal(t.at(-1).bail, 0);
  assert.equal(t.at(-1).score, 88);
  assert.deepEqual(t, skateSim(run,calibration), 'fresh simulation state on every run');
});

test('flat coasting only loses speed; foot braking stops sooner', () => {
  const coast = skateSim([{ frames: 240 }], { speed: .8 });
  const brake = skateSim([{ frames: 240, buttons: { brake: true } }], { speed: .8 });
  for (let i = 1; i < coast.length; i++) assert.ok(coast[i].speed <= coast[i - 1].speed);
  assert.equal(brake.at(-1).speed, 0);
  assert.ok(brake.at(-1).x < coast.at(-1).x / 2);
});

test('Space release pops once, arrow mode kickflips, and landing banks when stopped', () => {
  const t = skateSim([
    { frames: 20, keys: { Space: 1 } },
    { keys: { ArrowLeft: 1 } }, { frames: 240, keys: { KeyS: 1 } }
  ], { speed: .7 });
  assert.equal(t[20].z, 0);
  assert.equal(t[21].trick, 'kickflip');
  assert.ok(t[21].vz > 0);
  assert.equal(t.at(-1).z, 0);
  assert.equal(t.at(-1).bail, 0);
  assert.ok(t.at(-1).score >= 100);
});

test('invalid timestep and frame counts fail explicitly', () => {
  for (const dt of [0, -1, NaN, Infinity, .1]) assert.throws(() => skateSim([], { dt }), /dt/);
  assert.throws(() => skateSim([{ frames: 1.5 }]), /frames/);

});

test('hill gravity stalls at the energy-predicted height and rolls back fakie', () => {
  const slope = .2, initial = .35;
  const t = skateSim([{ frames: 1600 }], {
    dt: 1 / 240, speed: initial, ground: x => x * slope,
    physics: { asphalt: 0, drag: 0 }
  });
  const peak = Math.max(...t.map(p => p.x * slope));
  const expected = initial * initial * (1 + slope * slope) / (2 * .98);
  assert.ok(Math.abs(peak / expected - 1) < .02, `${peak} vs ${expected}`);
  const initialEnergy = .5 * initial * initial * (1 + slope * slope);
  // Before the downhill cap, kinetic + potential energy is conserved.
  for (const p of t.slice(0, 800)) {
    const energy = .5 * p.speed * p.speed * (1 + slope * slope) + .98 * p.x * slope;
    assert.ok(Math.abs(energy / initialEnergy - 1) < .02, `energy at ${p.t}: ${energy}`);
  }
  assert.ok(t.at(-1).vx < 0);
  assert.equal(t.at(-1).fakie, true);
  near(t.at(-1).yaw, 0); // board doesn't turn around when its velocity reverses
  assert.equal(t.at(-1).stance, 1);
});

test('hills accelerate from rest, downhill runs exceed the push cap, hard slides scrub speed', () => {
  const hill = skateSim([{ frames: 300 }], { ground: x => -.2 * x });
  assert.ok(hill.at(-1).speed > .6);
  assert.ok(hill.at(-1).x > 0);
  const brake = skateSim([{ frames: 30, keys: { KeyS: 1 } }], { speed: .8 });
  const slide = skateSim([{ frames: 30, keys: { KeyS: 1, KeyD: 1 } }], { speed: .8 });
  assert.ok(slide.at(-1).speed < brake.at(-1).speed - .2);
});

test('push bursts taper below the push cap and cannot accelerate a downhill run', () => {
  const fast = skateSim([{ frames: 42, keys: { KeyW: 1 } }], { speed: 1.3 });
  const coast = skateSim([{ frames: 42 }], { speed: 1.3 });
  // Held-input intent differs, while the physical downhill trajectories match.
  const motion=run=>run.map(({coasting,pushFakie,...p})=>p);
  assert.deepEqual(motion(fast), motion(coast));
  const push = skateSim([{ frames: 3600, keys: { KeyW: 1 } }]);
  assert.ok(push.at(-1).speed > .25 && push.at(-1).speed <= 1.2);
});


test('holding back stops, pivots once, pushes the opposite way, then coasts on release',()=>{
 for(const yaw of [0,Math.PI/2,-1.1]){
  const run=skateSim([{frames:240,keys:{KeyS:1}},{frames:60}],{speed:.8,yaw,fixed:true,dt:1/120});
  const along=p=>p.vx*Math.cos(yaw)+p.vy*Math.sin(yaw),reversed=run.findIndex(p=>along(p)<-.001),pivot=run.findIndex(p=>p.pivot);
  assert.ok(pivot>0&&reversed>pivot&&reversed<240);assert.ok(run[pivot].t<1.5,'responsive foot braking');
  assert.ok(run.slice(pivot,reversed).every(p=>p.speed<.02),'turn only after stopping');
  assert.ok(run.every(p=>!p.bail&&p.stance===1));
  assert.ok(Math.abs(run.at(-1).yaw-yaw-Math.PI)<1e-8);assert.equal(run.at(-1).fakie,false);
  assert.ok(along(run.at(-1))<0&&run.at(-1).speed<run[240].speed);
 }
});
test('controller back pivots and pushes, button B only stops, W keeps the new direction',()=>{
 const pad=skateSim([{frames:180,sticks:{left:[0,1]}},{frames:30}],{});
 assert.ok(pad[180].vx<-.1&&!pad.at(-1).fakie);near(pad.at(-1).yaw,Math.PI);
 const stopped=skateSim([{frames:180,buttons:{brake:true}}],{speed:.3});assert.equal(stopped.at(-1).speed,0);near(stopped.at(-1).yaw,0);
 const forward=skateSim([{frames:180,keys:{KeyS:1}},{frames:240,keys:{KeyW:1}}]);
 assert.ok(forward.at(-1).vx<-.2);assert.equal(forward.at(-1).fakie,false);
});
test('separate repeated fakie kicks reinforce natural tail-first travel without turning the board',()=>{
 for(const yaw of [0,Math.PI/2,-1.1])for(const mongo of [false,true]){
  const keys={KeyW:1,...mongo?{ShiftLeft:1}:{}};
  const run=skateSim([{frames:42,keys},{frames:12},{frames:42,keys}],{yaw,fakie:true,speed:.3,fixed:true});
  const along=p=>p.vx*Math.cos(yaw)+p.vy*Math.sin(yaw);
  assert.ok(along(run[42])<-.38);assert.ok(along(run.at(-1))<along(run[54])-.08);
  assert.ok(run.slice(1).every(p=>p.fakie&&Math.abs(p.yaw-yaw)<1e-8&&p.stance===1&&!p.bail));
 }
});
test('a continuously held push updates its direction when a hill reverses momentum',()=>{
 const run=skateSim([{frames:600,keys:{KeyW:1}}],{speed:.16,ground:x=>x*.35,physics:{pushBurst:.015},fixed:true});
 assert.ok(run.some(p=>p.kicking&&p.fakie&&p.speed>.03));
 for(const p of run.filter(p=>p.kicking&&p.speed>.03))assert.ok(Math.cos(p.heading-p.yaw-(p.pushFakie?Math.PI:0))>0,'kick must reinforce live momentum');
});

test('held push coasts near cruising speed and resumes only after speed falls',()=>{
 const run=skateSim([{frames:600,keys:{KeyW:1}}],{speed:1.15,fixed:true});
 assert.ok(!run[1].kicking&&run[1].coasting);
 const resumed=run.findIndex(p=>p.kicking);assert.ok(resumed>60,'coast before another kick');
 assert.ok(run[resumed-1].speed<1.2*.84+.002);
 assert.ok(run.slice(1,resumed).every(p=>!p.kicking));
 assert.ok(run.slice(resumed).some(p=>p.coasting&&!p.kicking),'returns to coasting after speeding up');
});

test('held back can pivot on a transition flat bottom, not only street ground',()=>{
 const mini=skateSim([{frames:120,keys:{KeyS:1}}],{transition:{},speed:.2,fixed:true,dt:1/120});
 const pool=skateSim([{frames:120,keys:{KeyS:1}}],{bowl:{},position:[.115,0],fixed:true,dt:1/120});
 for(const run of [mini,pool]){assert.ok(run.some(p=>p.pivot));assert.ok(Math.abs(run.at(-1).yaw-Math.PI)<1e-8);assert.ok(run.at(-1).vx<0&&!run.at(-1).bail);}
});
