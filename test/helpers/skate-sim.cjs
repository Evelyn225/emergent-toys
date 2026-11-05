'use strict';
// Fixed-step harness for the production riding/body code. The world adapter is an
// empty, unbounded surface: no renderer, audio, collision, ramps or grind edges.
// Use the browser skatepark tests for integration with actual city geometry.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function skateSim(script, { dt = 1 / 60, speed = 0, yaw = 0, ground = () => 0, physics = {}, transition = null, bowl = null, position = [0, 0] } = {}) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > .05) throw new RangeError('dt must be in (0, .05] seconds');
  for (const frame of script) {
    if (!Number.isInteger(frame.frames ?? 1) || (frame.frames ?? 1) < 1) throw new RangeError('frames must be a positive integer');
  }
  let pad = null;
  const ctx = vm.createContext({ ground, navigator: { getGamepads: () => pad ? [pad] : [] } });
  vm.runInContext(`
    let T=100, px=0, py=0, a=0, mode='walk', roofH=0, third=false, pitch=0, sleep=false;
    const K={}, body={z:0,vz:0,crouch:0,seat:null,trick:null}, fx={skating:true,caffeine:0};
    const actx=null, BLUE=0, RED=0, GRAY=0, ORANGE=0;
    const SKATE_FEATURES=[], solids=[], GRINDS=[];const terrainHeight=()=>0;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mod=(v,m)=>((v%m)+m)%m;
    const rel=v=>v, worldCoord=v=>v;
    const outdoorGroundHeight=(x,y)=>{
      for(const o of SKATE_FEATURES)if(o.profile&&Math.abs(x-o.x)<=o.hl&&Math.abs(y-o.y)<=o.hw){if(o.pool){const h=skatePoolSample(o,x,y);if(h)return h.h;continue;}return skateProfileHeight(o,o.bowl?Math.hypot(x-o.x,y-o.y):x-o.x);}
      return ground(x,y);
    }, fallHurt=()=>0;
    const grindsB=[[]], bi=()=>0;
    let msgText='';
    function say(text) { msgText=text; }
    function move(x,y) { px+=x; py+=y; }
  `, ctx);
  for (const file of ['controller-core.js', 'moves.js', 'skate-paths.js', 'skate-gestures.js', 'skate-physics.js', 'skate-air.js', 'skate-transitions.js', 'skate-bowl.js', 'skate-pool-render.js', 'skate-pool.js', 'skate-bails.js', 'skate.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../city', file), 'utf8'), ctx, { filename: file });
  }
  Object.assign(ctx, { initialSpeed: speed, initialYaw: yaw, dt, physics, transition, bowl, position });
  vm.runInContext('Object.assign(SK_PHYS,physics); if(transition)addSkateTransition(0,0,transition); if(bowl){if(bowl.pool)addSkatePool(0,0,bowl,bowl.pool);else addSkateBowl(0,0,bowl);} [px,py]=position; a=SK.dir=initialYaw; SK.v=initialSpeed; SK.lastT=T;', ctx);
  const trajectory = [];
  const snapshot = () => JSON.parse(vm.runInContext(`JSON.stringify({
    t:T-100, x:px, y:py, z:body.z, worldZ:SKB.p[2], contact:SKB.contact, velocity:SKB.v, vz:body.vz, speed:SK.v, yaw:a,
    heading:SK.dir, spin:SK.spin, stance:SK.stance, bail:SK.bail,
    board:skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll), normal:SKB.surf?.n,
    trick:body.trick?.name??null, manual:!!SK.manual, fakie:SKB.fakie, vx:SKB.v[0], vy:SKB.v[1], score:SK.score, combo:SK.combo?.pts??0, comboNames:SK.combo?.names??[]
  })`, ctx));
  trajectory.push(snapshot());
  let space = false;
  for (const frame of script) {
    ctx.keys = frame.keys ?? {};
    pad = frame.sticks || frame.buttons ? {
      connected: true, mapping: 'standard',
      axes: [...(frame.sticks?.left || [0, 0]), ...(frame.sticks?.right || [0, 0])],
      buttons: Array.from({ length: 8 }, (_, i) => ({ value: Number(!!frame.buttons?.[(['push', 'brake', 'mongo'][i] || {6:'grabL',7:'grabR'}[i])]) }))
    } : null;
    for (let i = 0; i < (frame.frames ?? 1); i++) {
      ctx.spaceChanged = !!ctx.keys.Space !== space;
      space = !!ctx.keys.Space;
      vm.runInContext(`
        for (const key in K) delete K[key];
        Object.assign(K,keys);
        if (spaceChanged) skateSpace(!!K.Space);
        T+=dt; stepSkate(dt); stepBody(dt);
      `, ctx);
      trajectory.push(snapshot());
    }
  }
  return trajectory;
}

module.exports = { skateSim };
