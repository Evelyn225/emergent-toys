// The recognizer is platform independent: normalized x/right, y/tail samples,
// timestamped in seconds. Mouse and gamepad share the same state machine.
function skateStick(x = 0, y = 0, dead = .15) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const r = Math.hypot(x, y);
  if (r <= dead) return [0, 0];
  const scale = Math.min(1, (r - dead) / (1 - dead)) / r;
  return [x * scale, y * scale];
}
function createSkateGesture() {
  let samples = [], load = null, armed = true, lastTime = -Infinity, firedAt=-Infinity, centred=false;
  const reset = () => { samples = []; load = null; armed = true; lastTime = -Infinity; firedAt=-Infinity;centred=false; };
  function sample(x, y, t) {
    if (![x, y, t].every(Number.isFinite)) return null;
    if (t < lastTime) reset();
    lastTime = t;
    samples.push({ x, y, t });
    samples = samples.filter(p => t - p.t <= .4).slice(-128);
    const radius = Math.hypot(x, y);
    if(!armed){
      if(radius<.25)centred=true;
      if(!centred||t-firedAt<.09)return null;
      armed=true;
    }
    if (!load) {
      if (Math.abs(y) > .6 && Math.abs(x) < .45) load = { side: Math.sign(y), t, arc: 0, angle: Math.atan2(y, x), left: false, fastest: 0, maxArc:0, finish:[x,y] };
      return null;
    }
    if (radius > .45) {
      for (const p of samples) if (t - p.t <= .12 && t > p.t)
        load.fastest = Math.max(load.fastest, Math.hypot(x - p.x, y - p.y) / .12);
    }
    if (!load.left && y * load.side > .6 && Math.abs(x) < .45) { load.t = t; load.angle = Math.atan2(y, x); return null; }
    load.left = true;
    if (t - load.t > (Math.abs(load.arc)>.45 ? .5 : .24)+1e-6) { load = null; return null; }
    let acrossCentre=false;
    if (radius > .45) {
      load.finish=[x,y];
      const angle = Math.atan2(y, x), delta = Math.atan2(Math.sin(angle - load.angle), Math.cos(angle - load.angle));
      // A straight flick crosses the centre and jumps angle by pi. Only a
      // series of small angular steps is a scoop, never that single jump.
      if (Math.abs(delta) < 1.2) load.arc += delta;else acrossCentre=true;
      load.angle = angle;
    }
    const arc = Math.abs(load.arc), curled = arc > 1.3;
    load.maxArc=Math.max(load.maxArc,arc);
    const forward = radius>.6&&y*load.side<-.35&&-y*load.side/radius>.45;
    const quarterFlip=acrossCentre&&arc>.8&&arc<2.3&&forward&&x*Math.sign(load.arc)>.3;
    const released = radius < .25;
    const heelScoop=load.maxArc>2.3&&arc>1.6&&arc<3.9&&load.arc<0&&load.finish[0]>.35&&load.finish[1]*load.side<-.25;
    if (quarterFlip || (!curled && forward) || (curled && released && (arc > 2.3||heelScoop))) {
      const key = quarterFlip ? load.arc>0?'WA':'WD' : arc > 3.9 ? (load.arc > 0 ? 'AS' : '360S') : heelScoop?'DS':arc > 2.3 ? 'S' : x < -.3 ? 'A' : x > .3 ? 'D' : '';
      const result = { key, nollie: load.side < 0, strength: .7 + .45 * Math.min(1, load.fastest / (2 / .12)) };
      load = null; armed = false;firedAt=t;centred=false; return result;
    }
    // Passing through centre is part of a straight flick; retain the load
    // until the 180 ms deadline instead of cancelling at that midpoint.
    return null;
  }
  return { sample, reset, get loaded() { return !!load; }, get samples() { return samples.slice(); } };
}
// A natural ramp air needs no second pop load: a quick out-and-return flick
// can choose a trick directly. Loaded/scooped gestures always take priority.
function createSkateAirFlick(min=.6,window=.2){
  let peak=null,blocked=false;
  const reset=()=>{peak=null;blocked=false;};
  const consume=()=>{peak=null;blocked=true;};
  function sample(x,y,t){
    const r=Math.hypot(x,y);
    if(r<.25){
      const p=peak;reset();
      if(p&&t-p.t<=window){const key=flickTrick(p.x,p.y,min);return key?{key,strength:1,nollie:false}:null;}
    }else if(!blocked){
      if(!peak&&r>min)peak={x,y,t,r};
      else if(peak&&r>peak.r){peak.x=x;peak.y=y;peak.r=r;}
    }
    return null;
  }
  return {sample,reset,consume};
}
function skateGestureSample(recognizer,airFlick,x,y,t){
  const gesture=recognizer.sample(x,y,t);
  if(gesture){airFlick.consume();return gesture;}
  if(!skateAir()){airFlick.reset();return null;}
  if(recognizer.loaded){airFlick.consume();return null;}
  return airFlick.sample(x,y,t);
}
const skateGestureLoaded = () => SK_INPUT.padGesture.loaded || SK_INPUT.mouseHeld && SK_INPUT.mouseGesture.loaded;

const SK_INPUT = { steer: 0, steerTarget: 0, padActive: false, push: false, mongo: false, brake: false, back: false, forward: false, airOut: false, grabL: 0, grabR: 0,
  right: [0, 0], manualDepth:0, mouse: [0, 0], mouseHeld: false, mouseT: -9, fired: false,
  padGesture: createSkateGesture(), mouseGesture: createSkateGesture(),padAirFlick:createSkateAirFlick(),mouseAirFlick:createSkateAirFlick(1/3,.4) };
function skateInputReset() {
  Object.assign(SK_INPUT, { steer: 0, steerTarget: 0, padActive: false, push: false, mongo: false, brake: false, back: false, forward: false, airOut: false, grabL: 0, grabR: 0,
    right: [0, 0], manualDepth:0, mouse: [0, 0], mouseHeld: false, fired: false });
  SK_INPUT.padGesture.reset(); SK_INPUT.mouseGesture.reset();SK_INPUT.padAirFlick.reset();SK_INPUT.mouseAirFlick.reset();
}
// A flip in an existing flight changes the board, never its trajectory.
function skateAirTrick(key,gesture) {
  if(!skateAir()||SK.bail>0)return false;
  const [name,flip,turn]=TRICKS[key]||['ollie',0,0];
  if(!flip&&!turn)return false;
  const tr=body.trick,remaining=tr&&(tr.flip||tr.turn)?(tr.duration??tr.air)-tr.t:0;
  if(remaining>0){
    if(remaining>.18)return false;
    SK.lateTrick={key,gesture,until:T+.18};SK.trickKeyT=-1;SK.airArrow=null;return true;
  }
  SK.lateTrick=null;SK.trickKeyT=-1;SK.airArrow=null;
  body.trick=skateTrick('late '+name,flip,turn,.32,!!gesture?.nollie);
  body.trick.duration=Math.abs(turn)>=1?.32:.24; // a late flick has a shorter wind-up
  return true;
}
function skateAirTrickStep(){
  const pending=SK.lateTrick;
  if(!pending)return;
  if(!skateAir()||SK.bail>0||T>pending.until+1e-6){SK.lateTrick=null;return;}
  const tr=body.trick;
  if(!tr||!(tr.flip||tr.turn)||tr.t>=(tr.duration??tr.air))skateAirTrick(pending.key,pending.gesture);
}
function skateGesturePlay(gesture) {
  if (!gesture || SK.bail > 0) return false;
  if (skateAir()) {
    if(skateCanLipPop())return skateLipPop(gesture.key,gesture);
    return skateAirTrick(gesture.key,gesture);
  } else skatePop(gesture.key, gesture);
  return true;
}
function skateMouseBegin() {
  SK_INPUT.mouse = [0, 0]; SK_INPUT.mouseHeld = true; SK_INPUT.mouseT = T;
  SK_INPUT.fired = false; SK_INPUT.mouseGesture.reset();SK_INPUT.mouseAirFlick.reset();
  if(SK.manual)SK.manual.mouseDepth=SK.manual.nose?-.35:.35;
}
function skateMouseMove(x, y) {
  // Balance gets a larger physical mouse range; tricks retain the original
  // virtual-stick samples, including loads, curls and deliberate flip-outs.
  if(SK.manual&&SK_INPUT.mouseHeld)SK.manual.mouseDepth=clamp((SK.manual.mouseDepth??(SK.manual.nose?-.35:.35))+y/180,-1,1);
  const m = SK_INPUT.mouse, r = Math.hypot(m[0] + x / 60, m[1] + y / 60);
  SK_INPUT.mouse = SK.manual?[clamp(m[0]+x/60,-1,1),clamp(m[1]+y/60,-1,1)]:[(m[0] + x / 60) / Math.max(1, r), (m[1] + y / 60) / Math.max(1, r)];
  SK_INPUT.mouseT = T;
  if (skateGesturePlay(skateGestureSample(SK_INPUT.mouseGesture,SK_INPUT.mouseAirFlick,...SK_INPUT.mouse,T))) SK_INPUT.fired = true;
}
function skateMouseEnd() {
  if (skateGesturePlay(skateGestureSample(SK_INPUT.mouseGesture,SK_INPUT.mouseAirFlick,0,0,T))) SK_INPUT.fired = true;
  SK_INPUT.mouseHeld = false; SK_INPUT.mouse = [0, 0];
  return SK_INPUT.fired;
}
function skatePollInput(dt,framePad,fixedSteer=false) {
  if (typeof paused !== 'undefined' && paused || typeof document !== 'undefined' && document.hidden) { skateInputReset(); return; }
  // Exactly one Gamepad API read per simulation frame. No synthetic key presses,
  // so disconnecting a pad cannot leave the keyboard stuck down.
  let pads = [];
  try { pads = framePad!==undefined ? framePad?[framePad]:[] : typeof controllerSkatePad==='function'&&CONTROLLER.sampleT===T ? [controllerSkatePad()] : typeof navigator !== 'undefined' ? navigator.getGamepads?.() || [] : []; } catch (_) { /* browser policy may deny gamepads */ }
  const pad = Array.from(pads).find(p => p?.connected && (p.mapping === 'standard' || !p.mapping));
  const button = i => pad?.buttons[i]?.value || (pad?.buttons[i]?.pressed ? 1 : 0);
  const dead=typeof settings==='undefined' ? .15 : clamp(Number(settings.controllerDeadzone)||.15,.05,.35);
  const left=pad?skateStick(pad.axes[0],pad.axes[1],dead):[0,0];
  SK_INPUT.steerTarget=pad?controllerStick(pad.axes[0],pad.axes[1],dead)[0]:0;
  SK_INPUT.padActive=!!pad;if(!fixedSteer)skateSteerStep(dt);
  SK_INPUT.back=left[1]>(SK_INPUT.back ? .3 : .55)&&Math.abs(left[0])<left[1]*.7;
  SK_INPUT.forward=left[1]<-(SK_INPUT.forward ? .3 : .55)&&Math.abs(left[0])<-left[1]*.7;
  SK_INPUT.push = button(0) > .5 || button(2) > .5 || SK_INPUT.forward; SK_INPUT.mongo = button(2) > .5;
  SK_INPUT.brake = button(1) > .5; SK_INPUT.airOut=button(7)>.55;
  SK_INPUT.grabL = button(6);
  // RT chooses an exit while riding a transition. That same held trigger
  // cannot become an accidental grab (and landing bail) during its flight.
  SK_INPUT.grabR = (SK.transition||SK.airRoute?.out||skateCanLipPop()) ? 0 : button(7);
  // Capture a stopped push before a render-only frame can move the chase
  // camera. This keeps the initial direction identical above 120 render Hz.
  if(typeof skatePushFromRest==='function')skatePushFromRest(!!K.KeyW||SK_INPUT.push,Math.max(SK.v,Math.hypot(...SKB.v)));
  SK_INPUT.right = pad ? skateStick(pad.axes[2], pad.axes[3],dead) : [0, 0];
  SK_INPUT.manualDepth=pad?skateStick(0,pad.axes[3],dead)[1]:0;
  if (!pad) {SK_INPUT.padGesture.reset();SK_INPUT.padAirFlick.reset();}
  else if(typeof controllerSkateLook==='function'&&controllerSkateLook()||skateAir()&&(SK_INPUT.grabL>.25||SK_INPUT.grabR>.25)){SK_INPUT.padGesture.reset();SK_INPUT.padAirFlick.consume();}
  else skateGesturePlay(skateGestureSample(SK_INPUT.padGesture,SK_INPUT.padAirFlick,...SK_INPUT.right,T));
  if (SK_INPUT.mouseHeld) {
    const relax = Math.exp(-dt / .15);
    if (T - SK_INPUT.mouseT > .015) SK_INPUT.mouse = SK_INPUT.mouse.map((v,i) => SK.manual&&i===1?v:v*relax);
    if (skateGesturePlay(skateGestureSample(SK_INPUT.mouseGesture,SK_INPUT.mouseAirFlick,...SK_INPUT.mouse,T))) SK_INPUT.fired = true;
  }
}

function skateSteerStep(dt){
  const response=typeof settings==='undefined'?1:clamp(Number(settings.controllerSteering)||1,.5,2);
  SK_INPUT.steer=SK_INPUT.padActive?controllerEase(SK_INPUT.steer,SK_INPUT.steerTarget,dt*response):0;
}
