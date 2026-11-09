// ===== the skateboard, played the way the old skateboarding games played it: you see your skater from behind, the
// camera trailing a little above. W kicks (small bursts taper to the push cap;
// Shift chooses mongo), S drags a foot to slow you, A and D carve. Space crouches to load an
// ollie and pops it as you let go (held longer, higher). Hold an arrow as you pop, or tap one in the air, for a flip
// trick: left kickflip, right heelflip, down pop shuvit, down-left 360 flip, down-right varial heelflip, up-left
// hardflip, up-right inward heelflip (or flick for one with the right mouse button). In the air A and D spin you:
// come down rolling straight, or backwards (and ride away switch), and it counts; come down sideways, or mid-flip, or
// hit a wall going fast, and you bail. Pop again soon after landing and the tricks chain into a combo, worth its points
// times how many; a bail loses it. The mouse looks round (the camera swings back behind you); V: your own eyes.
// Units: cells (10m), seconds, radians, as everywhere outdoors.
const SK_TOP = 1.2, SK_SPIN = 7.5, SK_LAND = 0.6, SK_CHARGE = 0.6;
const SK_STILL = 0.12; // (slower than this, a messy landing is only a hop: nothing to fall off)
const SK_SLOPPY = 0.45; // (slower than this, coming down sideways is a sloppy landing you ride out, not a bail: half points)
const SK_CAM_BACK = 0.55, SK_CAM_UP = 0.2, SK_CAM_SIDE = 0.25, SK_COMBO_GAP = 1.2, SK_BAIL_T = 2.4;
// v: speed; dir: the way you're rolling (in the air, the way you left the ground: a spins, dir doesn't); spin: how
// far round you've turned since the pop; stance: which side you face (+1 right of where you're going, regular);
// kick: the push in progress (0..1), charge: when Space went down (-1: it isn't), combo: { names, pts, t }
const SK = { v: 0, dir: 0, spin: 0, stance: 1, steer: 0, kick: 0, kicking: false, charge: -1, popT: -9, bail: 0, bailAt: null,
  trickKeyT: -1, look: 0, lookT: -9, camYaw: null, camBase:null,camFollowTravel:false,camTravelYaw:null, camZ: null, camBack: 0, camSide: 1, lastT: -9, combo: null, score: 0, best: 0, dragT: 0, scrapeT: -9 };
let skateView = null; // while the frame's drawn from behind you: { x, y, a } (where you really are) and the camera's eye
const skateCamOn = () => skatingNow() && third && !freecam;
const skateAir = () => SK.renderContact!=null?SK.renderContact==='air':!SK.transition && !SK.grind && (body.z > 0 || body.vz > 0);
const skateGround = (x, y) => mode === 'roof' ? roofH : walkGround(x, y); // (the street, or the roof you're rolling across)
// the arrows held down, as a TRICKS key (moves.js)
function arrowTrick() {
  const l = K.ArrowLeft, r = K.ArrowRight;
  if (K.ArrowUp) return l ? 'WA' : r ? 'WD' : '';
  return (l ? 'A' : r ? 'D' : '') + (K.ArrowDown ? 'S' : '');
}
const SK_POINTS = { '360 shuvit': 200, ollie: 50, kickflip: 100, heelflip: 100, 'pop shuvit': 100, '360 flip': 300, 'varial heelflip': 250, hardflip: 250, 'inward heelflip': 250 };

// Clear constraints at the inventory boundary, before walking can move away.
function skateDismount() {
  if(typeof skateFixedReset==='function')skateFixedReset();
  Object.assign(SK,{kick:0,kicking:false,mongo:false,lipPop:null,pushCruise:false,pushFakie:null,airRoute:null,slide:0,sliding:false,transition:null,grind:null,manual:null,combo:null,bail:0,bailAt:null,bailData:null,lastT:-9,camYaw:null,camBase:null,camFollowTravel:false,camTravelYaw:null,camZ:null,camTransition:0,camRampUp:0,camRampH:0,airPose:null,airSource:null,airNormal:null,airForward:null,airSpinV:0,lateTrick:null,airArrow:null,pivot:null,reversing:false});
  skateInputReset();SKB.contact='ground';SKB.v=[0,0,0];SKB.surf=null;
}

// every frame on the board, in place of walking
function stepSkate(dt,readInput=true) {
  if (T - SK.lastT > 0.25) { // just stepped on: rolling off at whatever pace you were walking
    Object.assign(SK, { v: Math.min(SK_TOP, Math.hypot(body.mx || 0, body.my || 0)), dir: a, spin: 0, stance: 1, kick: 0, charge: K.Space ? SK.charge : -1, bail: 0, bailAt: null, combo: null, transition:null, grind:null, manual:null, leftTransition:null, pivot:null,reversing:false, camTransition:0, camRampUp:0, camRampH:0, look: 0, camYaw: null, camBase:null,camFollowTravel:false,camTravelYaw:null, camZ: null });
    if (third) pitch = -0.12;
  }
  SK.lastT = T;
  if(readInput)skatePollInput(dt);
  if (SK.bail > 0) return stepSkateBail(dt);
  if (SK.grind) { stepGrind(dt); skateBoardSync(); return; }
  const air = skateAir(), f = (K.KeyW || SK_INPUT.push ? 1 : 0) - (K.KeyS || SK_INPUT.brake || SK_INPUT.back ? 1 : 0), s = clamp((K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + SK_INPUT.steer, -1, 1);
  SK.steer = s; SK.kicking = false;
  const backHeld=!!(K.KeyS||SK_INPUT.back)&&!K.KeyW&&!SK_INPUT.push;
  if(!backHeld)SK.reversing=false;
  const reversePush=backHeld&&SK.reversing&&!SK.pivot&&Math.abs(s)<.35;
  if (stepSkateTransition(dt, f > 0||reversePush, f < 0&&!reversePush, s)) return;
  if (SK.charge >= 0 && !K.Space) SK.charge = -1; // (let go somewhere it couldn't pop: the menu, say)
  if (air) {
    skateAirTrickStep();
    skateAirSpinStep(dt,s); // continuous angular velocity, including pre-wind
  }
  else skateGroundVelocity(dt, f > 0, f < 0, s, f<0&&!!(K.KeyS||SK_INPUT.back));
  // arrows tapped in the air: a flip trick, once the rest of the chord's had a moment to come down
  if (SK.trickKeyT >= 0 && T - SK.trickKeyT > 0.07) {
    const key=SK.airArrow??arrowTrick();SK.airArrow=null;SK.trickKeyT = -1;
    if(air)skateAirTrick(key);
  }
  if (!air) skateManualStep(dt);
  const want = SK.v * dt, x0 = px, y0 = py;
  move(Math.cos(SK.dir) * want, Math.sin(SK.dir) * want);
  const mx = rel(px - x0), my = rel(py - y0), got = Math.hypot(mx, my);
  if (dt > 0) { body.mx = mx / dt; body.my = my / dt; }
  if(air)skateTransitionAirStep();
  skateSurfaceExit(x0, y0, dt);
  if (want > 1e-6 && got < want * 0.98) { // something in the way: scrape along it, or stop dead
    const lost = SK.v * (1 - got / want);
    SK.v *= got / want;
    if (actx && lost > 0.03 && T > SK.scrapeT) { SK.scrapeT = T + 0.15; sfxSkate('scrape', clamp(lost * 3, 0.3, 1)); }
    if (got > 1e-6) { SK.dir = Math.atan2(my, mx); if (!air) a = SK.dir; }
    if (lost > 0.45) return skateBail('BAIL! Straight into it.');
  }
  if ((!air && SK.v > .1) || air && body.vz <= 0) grindCatch();
  if (air && body.trick) say(`${skateTrickName(body.trick).toUpperCase()} · ${body.trick.grab || (body.trick.caughtAt != null ? 'CAUGHT' : 'ROTATING')}`, .5);
  skateBoardSync();
  if (SK.combo && !air && !SK.manual && (T - SK.combo.t > SK_COMBO_GAP || SK.v < SK_STILL)) bankCombo(); // (a combo is tricks back to back on the move: too long between them, or rolling to a stop, and it's banked)
}
// Space on the board: down crouches, up pops (or a tap off the touch button, or a flick: straight away)
function skateSpace(down) {
  if (SK.grind) { if (down) grindPop(); return; } // (off the rail with an ollie: straight away, no wind-up)
  if (SK.bail > 0) { if (!down) SK.charge = -1; return; }
  if(skateAir()&&!skateCanLipPop()){
    if(down)SK.charge=T;
    else{if(SK.charge>=0)skateAirTrick(arrowTrick());SK.charge=-1;}
    return;
  }
  if (down) { if (SK.charge < 0) SK.charge = T; return; }
  if (SK.charge >= 0) skatePop();
}
function skatePop(trick, gesture) {
  if (SK.transition) return skateTransitionPop(trick, gesture);
  if (SK.grind) return grindPop(trick, gesture); // (the touch Ollie button, or a flick, on a rail)
  if(SK.bail>0)return;
  if(skateAir())return skateCanLipPop()?skateLipPop(trick,gesture):skateAirTrick(trick??arrowTrick(),gesture);
  const load = SK.charge >= 0 ? clamp((T - SK.charge) / SK_CHARGE, 0, 1) : 0, key = trick ?? arrowTrick(), [name, flip, turn] = TRICKS[key] || ['ollie', 0, 0];
  skateAirBegin();
  skateManualEnd();
  SK.charge = -1; SK.spin = 0; SK.popT = T; SK.trickKeyT = -1;
  SK.preWind = clamp((K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + (SK_INPUT.steerTarget??SK_INPUT.steer), -1, 1);
  body.vz = POP_V * (gesture ? gesture.strength : 1 + (3.4 / POP_V - 1) * load);
  body.trick = skateTrick(name, flip, turn, skateAirTime(body.vz), !!gesture?.nollie);
  controllerRumble('pop');
  if (actx) sfxUse('ollie');
}
// how long you'll be in the air from a pop at vz (m/s), given the slope ahead: uphill the ground comes up to meet you
// sooner, downhill it falls away, so a flip times itself to finish as you touch down
function skateAirTime(vz) {
  const ahead = .25, x = px + Math.cos(SK.dir) * ahead, y = py + Math.sin(SK.dir) * ahead;
  const slope = (skateGround(worldCoord(x), worldCoord(y)) - skateGround(px, py)) / ahead, rise = slope * SK.v * 10; // (metres a second)
  return 2 * clamp(vz - rise, vz * .45, vz * 1.6) / GRAV; // (z = vz t - g t^2 / 2 meets ground rising at rise m/s)
}
function skateArrow() { if(skateAir()){if(SK.trickKeyT<0)SK.trickKeyT=T;SK.airArrow=arrowTrick();} }
// back on the ground (stepBody): rolling away clean, or not
function skateLand() {
  if (SK.bail > 0) return; // (already down: hit a wall on the way up)
  SK.lateTrick=null;
  const tr = body.trick, d = mod(a - SK.dir + Math.PI, Math.PI * 2) - Math.PI, st0 = SK.stance;
  skateAirPose();
  const surf = skateSurface(px, py), returnHit=SK.airRoute&&!SK.airRoute.out?skateTransitionAt(px,py,surf.h):null, axes = skateBoardAxes(SKB.yaw, SKB.pitch, SKB.roll);
  const vx = Math.cos(SK.dir) * SK.v, vy = Math.sin(SK.dir) * SK.v;
  const quality = skateLandingQuality({ ...axes, normal: surf.n,
    velocity: [vx, vy, -(vx * surf.n[0] + vy * surf.n[1]) / Math.max(.05, surf.n[2])],
    catchLead: tr&&(tr.flip||tr.turn) ? tr.t - (tr.caughtAt ?? Infinity) : Infinity, grab: !!tr?.grab });
  const flubbed = quality === 'bail', sideways = quality === 'sloppy';
  const standing = SK.v < SK_STILL; // (barely moving: nothing to fall off, and nothing to carry a combo)
  if (flubbed) return skateBail('BAIL! Your feet never found the board.');
  controllerRumble('land',body.impactV||0);
  const sloppy = sideways; // slow enough to ride it out: the board scrubs round to whichever end's nearer the way you're going
  SK.landedAt = T; SK.reverted = false;
  if(returnHit&&surf.ref===returnHit.o)SKB.fakie=Math.abs(d)>Math.PI/2;
  SK.v *= Math.max(.5, 1 - Math.max(0, (body.impactV || 0) - 4.5) * surf.n[2] * .04);
  if (sloppy && standing) SK.dir = a; // (stood still, you just turn the board under you)
  else if (sloppy) { SK.v *= 0.7; SK.dir = Math.abs(d) > Math.PI / 2 ? a + Math.PI : a; if (actx) sfxSkate('scrape', 0.6); }
  else if ((Math.abs(d) > Math.PI / 2) !== SKB.fakie) SK.stance = -SK.stance;
  if (sloppy && !standing && (Math.abs(d) > Math.PI / 2) !== SKB.fakie) SK.stance = -SK.stance;
  a = SK.dir + (SKB.fakie ? Math.PI : 0);
  // Touchdown dissipates impact; it must not become forward speed next tick.
  const landedVx=Math.cos(SK.dir)*SK.v,landedVy=Math.sin(SK.dir)*SK.v;
  SKB.v=[landedVx,landedVy,-(landedVx*surf.n[0]+landedVy*surf.n[1])/Math.max(.001,surf.n[2])];
  SKB.surf=surf;SK.slide=0;SK.sliding=false;SK.airRoute=null;SK.lipPop=null;SK.pushFakie=null;SK.airSpinV=0;
  // A frame can cross the wall surface between transition proximity checks.
  // Re-enter with the real falling velocity instead of flattening it to hv.
  if(returnHit&&surf.ref===returnHit.o){
    body.z=.001;body.vz=-(body.impactV||0)*(sloppy?.7:1);
    enterSkateTransition(returnHit);skateTransitionPlace(SK.transition);
  }
  if (!tr && SK.offGrind) { SK.offGrind = false; SK.spin = 0; return; } // (rolled off the end of a grind: that was the trick)
  SK.offGrind = false;
  const deg = Math.round(Math.abs(SK.spin) / Math.PI) * 180, name = tr ? tr.name : 'ollie',displayName=skateTrickName(tr);
  const side = deg ? (Math.sign(SK.spin) === -st0 ? 'FS ' : 'BS ') + deg : ''; // frontside: turning chest first
  const label = (SKB.fakie ? 'FAKIE ' : '') + (sloppy ? 'SLOPPY ' : '') + (side + (displayName !== 'ollie' || !side ? ' ' + displayName : '')).trim().toUpperCase() + (tr?.lastGrab ? ' + ' + tr.lastGrab.toUpperCase() : '');
  const pts = Math.round(((SK_POINTS[name.replace(/^late /, '')] || 50) + (tr?.grabPoints || 0) + deg / 180 * 150 + Math.max(0, T - SK.popT) * 60) * (sloppy ? 0.5 : 1));
  if (standing) { // the one trick, scored by itself: a combo needs you moving
    if (SK.combo) bankCombo();
    SK.score += pts; SK.best = Math.max(SK.best, pts); SK.spin = 0;
    return say(`${label}!  ${pts}`, 2);
  }
  const c = SK.combo ||= { names: [], pts: 0, t: T };
  c.names.push(label); c.pts += pts; c.t = T;
  say(c.names.length > 1 ? `${c.names.join(' + ')}  ${c.pts} x ${c.names.length}` : `${label}!  ${pts}`, 2);
  SK.spin = 0;
}
// how long is left to land the next trick and keep the combo going, 0..1 (full while you're in the air: the clock
// only runs on the ground). null: no combo running
const comboLeft = () => SK.combo || SK.grind || SK.manual ? (SK.grind || SK.manual || SK.transition || skateAir() ? 1 : clamp(1 - (T - SK.combo.t) / SK_COMBO_GAP, 0, 1)) : null;
// ---- grinds (skatepark.js GRINDS: the park's bars, ledges and pad, and every bench). Come down onto an edge going
// more or less along it and you lock on: the grind is named by how your board sits on it (along it a 50-50, or a
// nosegrind holding up, a 5-0 holding down; at an angle a crooked grind; across it a boardslide on a bar, a lipslide
// on a ledge). You slide on, slowing, balancing with A and D against a wobble that grows the longer you stay on;
// lose it and you bail. Space pops you off (arrows: a flip trick off it); run off the end and you drop. The grind
// scores by how long you held it and joins the combo; while you're on, the combo clock doesn't run
const GRIND_CATCH = .08, GRIND_POINTS = { '50-50': 100, nosegrind: 150, '5-0': 150, 'crooked grind': 200, boardslide: 175, lipslide: 200, smith: 250, feeble: 250, overcrook: 275, noseslide: 200, tailslide: 200 };
const skateGrinding = () => !!SK.grind;
function grindCatch() { return skatePathCatch(); }
function startGrind(g, t, dir, top) {
  const path = GRIND_PATHS.find(p => p.legacy === g) || addGrindPath([[g.ax,g.ay,top],[g.bx,g.by,top]], {...g,legacy:g});
  return startPathGrind(path, t * path.length, dir);
}
function stepGrind(dt) { return stepPathGrind(dt); }
const grindPoints = G => Math.round((GRIND_POINTS[G.name] || 100) + (T - G.t0) * 140);
function endGrind() { // into the combo; off you go, and down
  const G = SK.grind, c = SK.combo ||= { names: [], pts: 0, t: T };
  SK.grind = null; c.names.push(G.name.toUpperCase()); c.pts += grindPoints(G); c.t = T; SK.offGrind = true; SK.leftGrind = G.g; SK.leftGrindT = T;
  skateAirBegin();
  body.z = Math.max(body.z, .02); body.vz = (G.exitVelocity?.[2] || 0) * 10;
  say(`${c.names.join(' + ')}  ${c.pts} x ${c.names.length}`, 2);
}
function grindPop(trick, gesture) { // Space on the rail: an ollie off it, with whatever flip the arrows (or a flick) ask for
  const key = trick ?? arrowTrick(), [name, flip, turn] = TRICKS[key] || ['ollie', 0, 0];
  endGrind(); SK.offGrind = false;
  body.vz = POP_V * (gesture?.strength ?? 1); body.trick = skateTrick(name, flip, turn, skateAirTime(body.vz), !!gesture?.nollie); SK.popT = T;
  controllerRumble('pop');
  if (actx) sfxUse('ollie');
}
function bankCombo() {
  const c = SK.combo, total = c.pts * c.names.length;
  SK.combo = null; SK.score += total; SK.best = Math.max(SK.best, total);
  if (c.names.length > 1) say(`${c.names.length}-TRICK COMBO!  ${total}`, 2);
}
function skateBail(msg) {
  SK.airRoute=null;SK.lipPop=null;SK.pivot=null;SK.reversing=false;
  skateBailStart();controllerRumble('bail',SK.bailData.speed);
  SK.manual = null; SK.grind = null; SK.transition = null; SK.bail = SK_BAIL_T; SK.bailAt = [px, py, SK.dir, a]; SK.v = 0; SK.spin = 0; SK.combo = null; SK.charge = -1; body.trick = null;
  say(msg, 2);
  if (actx) playClip('ground-impact', clamp(SK.bailData.speed * .6, .15, .6));
}

// ---- the camera: behind you, a little above and round to the side you face, swinging after you (not while you spin).
// A wall in the way: first it gives up the side, then it comes in closer, and lower, to keep you in the picture.
// Returns [x, y, yaw, eye]
// (on a narrow screen, a phone held upright, it comes in closer: the view's as wide as ever, so you'd be a speck)
const skateCamBack = () => SK_CAM_BACK * (1 + .6 * (SK.camTransition || 0)) * clamp(cv.width / cv.height / 1.6, 0.4, 1);
function skateClear(yaw, ahead = 0) { // how far back from you the camera can go that way
  const bx = Math.cos(yaw), by = Math.sin(yaw), most = skateCamBack();
  const clearanceZ=skateGround(px,py)+body.z/10+SK_CAM_UP-.025;
  let back = 0;
  for (let step = 0.02; step <= most + 1e-9; step += 0.02) {
    const x = px + SKB.v[0] * ahead - bx * step, y = py + SKB.v[1] * ahead - by * step;
    const blocked = mode === 'roof'
      ? roofHeightAt(x,y)>Math.max(roofH+ROOF_STEP,clearanceZ)
      : [-.03,.03].some(ox=>[-.03,.03].some(oy=>map[idx(Math.floor(x+ox),Math.floor(y+oy))]>Math.max(.28,clearanceZ)))
        || architectureBlocked(x,y,.03,clearanceZ) || landmarkBlocked(x,y,.03);
    if(blocked)break;
    back = step;
  }
  return back;
}
function skateCam(dt) {
  const fresh = SK.camYaw == null, air = skateAir(), ease = k => fresh ? 1 : 1 - Math.exp(-k * dt);
  SK.camTransition = fresh ? (SK.transition ? 1 : 0) : (SK.camTransition || 0) + ((SK.transition ? 1 : 0) - (SK.camTransition || 0)) * ease(3);
  if (SK.transition) { SK.camRampH=SK.transition.o.z0+SK.transition.o.profile.height; SK.camRampUp=.12*Math.min(1,Math.abs(SK.transition.u)/SK.transition.o.profile.limit); }
  if (T - SK.lookT > 1) {
    const look=Math.atan2(Math.sin(SK.look),Math.cos(SK.look)),turns=SK.look-look;
    if(!fresh)SK.camYaw-=turns;
    SK.look=look*Math.exp(-dt*2.5);
  }
  if(fresh){SK.camFollowTravel=!!(SK.transition||SK.airRoute);SK.camTravelYaw=a;}
  if(SK.transition||SK.mongo&&SK.v>.025)SK.camFollowTravel=true;
  if(SK.camFollowTravel&&SK.v>.025)SK.camTravelYaw=SK.dir;
  if(!air&&!SK.transition&&SK.v<.025)SK.camFollowTravel=false;
  const riding=SK.camFollowTravel?(SK.camTravelYaw??a):a;
  const follow=SK.bail>0?SK.bailAt[2]:SK.pivot?a:air?(SK.v>.025?SK.dir:SK.camTravelYaw??SK.camBase??SK.dir):riding;
  if(fresh||SK.camBase==null)SK.camBase=follow;
  else SK.camBase+=Math.atan2(Math.sin(follow-SK.camBase),Math.cos(follow-SK.camBase));
  const base=SK.camBase+SK.look,side=base-SK.stance*SK_CAM_SIDE;
  SK.camSide = (fresh ? 1 : SK.camSide ?? 1) + ((skateClear(side) > skateCamBack() * 0.9 ? 1 : 0) - (SK.camSide ?? 1)) * ease(3);
  const target = base - SK.stance * SK_CAM_SIDE * SK.camSide * (air ? 0 : 1);
  if (fresh) SK.camYaw = target;
  SK.camYaw += (target-SK.camYaw)*ease(5.56);
  const room_ = Math.min(skateClear(SK.camYaw), skateClear(SK.camYaw, .15)); // (in at once, back out gently)
  SK.camBack = fresh || room_ < SK.camBack ? room_ : SK.camBack + (room_ - SK.camBack) * ease(2);
  const riderZ=skateGround(px,py)+body.z/10;
  let want = riderZ + (SK.grind ? .09 : SK_CAM_UP) + (SK.camRampUp || 0) * SK.camTransition;
  // Keep the eye above the bowl surface along the complete camera boom.
  // The old clearance test checked buildings but ignored the bowl itself.
  if(SK.transition?.o.bowl || SK.camTransition>.05){
    for(let i=1;i<=8;i++){
      const d=SK.camBack*i/8,x=worldCoord(px-Math.cos(SK.camYaw)*d),y=worldCoord(py-Math.sin(SK.camYaw)*d);
      want=Math.max(want,skateGround(x,y)+.1);
    }
  }
  SK.camZ = fresh || SK.camZ == null ? want : SK.camZ + (want - SK.camZ) * ease(6);
  if (T - SK.lookT > 1) {
    const aheadX = worldCoord(px + Math.cos(SK.dir) * .15), aheadY = worldCoord(py + Math.sin(SK.dir) * .15);
    const flatTarget = air ? riderZ+.08 : skateGround(aheadX,aheadY)+.08;
    const rampTarget = SK.transition?.o.bowl ? SKB.p[2]+.08 : Math.max(SKB.p[2]+.08,(SK.camRampH||0)+.02);
    const targetZ = flatTarget + (rampTarget-flatTarget)*SK.camTransition;
    const targetPitch = clamp(Math.atan2(targetZ - SK.camZ, SK.camBack + .15), -.6, .2);
    pitch += (targetPitch - pitch) * ease(5.56);
  }
  return [worldCoord(px - Math.cos(SK.camYaw) * SK.camBack), worldCoord(py - Math.sin(SK.camYaw) * SK.camBack), SK.camYaw, SK.camZ];
}

// ---- you and the board, drawn into the city (citySprites) while the camera's behind you
// the board, a bit bigger than life (as the old games drew it: real size, it's lost under a grown-up seen from behind).
// k: how much bigger. The deck: half length, width, thickness; its middle this high; the kicktails; trucks this far
// along from the middle; your height on it
const SB_K = 1.55, SB = { k: SB_K, hl: 0.04 * SB_K, hw: 0.0105 * SB_K, ht: 0.0012 * SB_K, up: 0.0085 * SB_K, tail: 0.006 * SB_K, truck: 0.027 * SB_K, rider: 0.165 };
let skaterLookMemo = null, skaterLookKey = '';
// the ink each tattoo is done in (the newest one shows): the rest is blackwork
const TATTOO_INK = { tattoo_swallow: [BLUE, 6], tattoo_anchor: [BLUE, 5], tattoo_rose: [RED, 7], tattoo_dagger: [RED, 6], tattoo_panther: [GRAY, 2], tattoo_koi: [ORANGE, 9] };
// whoever you are: a beanie, short hair under it, a long-sleeved tee, jeans and white sneakers. Got some ink? Then
// a short-sleeved tee, to show it off: the more hours you've sat for, the more of your arms it covers
function skaterLook() {
  const key = tattoos.join(',')+'|'+JSON.stringify(playerAppearance);
  if (skaterLookMemo && key === skaterLookKey) return skaterLookMemo;
  const hours = tattoos.reduce((s, id) => s + ITEMS[id].hours, 0);
  skaterLookKey = key;
  if(playerAppearance){const options=netAppearanceOptions(playerAppearance);options.ink=hours?Math.round(clamp(hours/10,.2,1)*10)/10:0;options.col.ink=hours?TATTOO_INK[tattoos[tattoos.length-1]]:undefined;return skaterLookMemo=figLook(options);}
  return skaterLookMemo = figLook({ hair: 'short', hat: 'beanie', top: hours ? 'tee' : 'long', bot: 'pants', bw: 1, ink: hours ? Math.round(clamp(hours / 10, 0.2, 1) * 10) / 10 : 0,
    col: { hair: [BRICK, 4], skin: [SKIN, 11], hat: [ORANGE, 11], hatD: [ORANGE, 7], top: [GREEN, 7], bot: [BLUE, 5], shoe: [WHITE, 13], belt: [GRAY, 2],
           ink: hours ? TATTOO_INK[tattoos[tattoos.length - 1]] : undefined } });
}
function drawSkateBoard(vx, vy, z, yaw, nose, roll) {
  const F = craftFrame(yaw, nose, roll), normal = SK.transition ? F.u : [0,0,1], o = [vx + normal[0] * SB.up, vy + normal[1] * SB.up, z + normal[2] * SB.up + Math.abs(Math.sin(roll)) * SB.hw * 0.9]; // (on its edge mid-flip it stands taller)
  const deck = (i, t, L) => {
    if (HIT.face === 5) { // black grip tape, the maple showing round its edge (so it reads on dark asphalt)
      if (Math.abs(HIT.v) > SB.hw * 0.7) { BG[i] = C(YEL, 3 + L * 0.45); return set(i, '=', C(BRICK, L)), true; }
      BG[i] = C(GRAY, 0.3 + L * 0.05); return set(i, fract(HIT.u * 300) < 0.5 ? ':' : '.', C(GRAY, L * 0.3)), true;
    }
    if (HIT.face === 6) { const stripe = Math.floor((HIT.u / SB.hl + 1) * 3) & 1; BG[i] = C(stripe ? RED : YEL, 2.5 + L * 0.6); return set(i, ' ', 0), true; } // its graphic
    BG[i] = C(YEL, 3 + L * 0.45); return set(i, '=', C(BRICK, L)), true; // the ply
  };
  const box = (Fr, c, ef, er, eu, shade) => drawOBox(c[0], c[1], c[2], [Fr.f, Fr.r, Fr.u], [ef, er, eu], shade);
  box(F, o, SB.hl, SB.hw, SB.ht, deck);
  for (const e of [1, -1]) { // the kicktails, turned up at each end
    const Ft = craftFrame(yaw, nose + e * 0.45, roll), end = at(o, F, e * SB.hl, 0, 0);
    box(Ft, at(end, Ft, e * SB.tail * 0.9, 0, 0), SB.tail, SB.hw * 0.85, SB.ht, deck);
  }
  const metal = (i, t, L) => { BG[i] = C(GRAY, 2 + L * 0.5); return set(i, '-', C(WHITE, L * 0.7)), true; };
  const wheel = (i, t, L) => { BG[i] = C(WHITE, 5 + L * 0.7); return set(i, 'o', C(GRAY, L * 0.4)), true; };
  for (const e of [1, -1]) {
    const k = SB.k;
    box(F, at(o, F, e * SB.truck, 0, -SB.ht - 0.0015 * k), 0.0035 * k, 0.0085 * k, 0.0015 * k, metal); // the trucks
    for (const sd of [1, -1]) box(F, at(o, F, e * SB.truck, sd * 0.0095 * k, -SB.ht - 0.0045 * k), 0.0028 * k, 0.0016 * k, 0.0028 * k, wheel);
  }
}
// ---- you, in true perspective. Anyone else is a cut-out stood at one depth and seen as if from eye level: fine for
// passers-by, but from behind and above, on a board, its feet don't land where they stand (the front foot belongs
// further off, higher up the screen, over the front truck), and from a little to the side you'd seem to stand on the
// end of the deck. So each pixel of your sprite goes where its bit of you really is: the sprite for this angle (one
// of SK_VIEWS round you) remembers how near each pixel's surface is, toward whoever's looking.
const SK_VIEWS = 32;
function skaterSprite(look, key, view) {
  const id = look.shape + '|' + key + '|sk' + view;
  let s = figCache.get(id);
  if (!s) {
    const bid = look.shape + '|' + key;
    let fb = figCache.get(bid);
    if (!fb) figCache.set(bid, fb = figBody(look, key));
    const near = new Float32Array(FIG_W * FIG_H);
    figCache.set(id, s = { role: figRasterAt(fb, view / SK_VIEWS * Math.PI * 2, near), near });
  }
  return s;
}
// as drawFigure: (rx, ry) from the camera, standing on z0, h tall, facing (fx, fy), a figPose key, least brightness
function drawSkaterFigure(rx, ry, z0, h, fx, fy, look, key, light = 5, normal = [0,0,1], footAnchor = null, forward = null) {
  // A full tangent facing avoids projecting horizontal yaw through a vert pole.
  const U=normal,raw=forward||[fx,fy,0],d=raw.reduce((sum,v,i)=>sum+v*U[i],0);
  const f=raw.map((v,i)=>v-d*U[i]),len=Math.hypot(...f)||1,F=f.map(v=>v/len);
  const right=[U[1]*F[2]-U[2]*F[1],U[2]*F[0]-U[0]*F[2],U[0]*F[1]-U[1]*F[0]];
  const towards=[-rx,-ry,eye-z0-h*.5],dot=v=>towards.reduce((sum,n,i)=>sum+n*v[i],0);
  const view=mod(Math.round(Math.atan2(dot(right),dot(F))/(Math.PI*2)*SK_VIEWS),SK_VIEWS);
  const {role,near}=skaterSprite(look,key,view),th=view/SK_VIEWS*Math.PI*2,unit=h/FIG_TALL;
  if(footAnchor){
    rx-=(right[0]*footAnchor[0]+F[0]*footAnchor[1]+U[0]*footAnchor[2])*unit;
    ry-=(right[1]*footAnchor[0]+F[1]*footAnchor[1]+U[1]*footAnchor[2])*unit;
    z0-=(right[2]*footAnchor[0]+F[2]*footAnchor[1]+U[2]*footAnchor[2])*unit;
  }
  const across = right.map((v,i)=>-Math.cos(th)*v+Math.sin(th)*F[i]);
  const nearAxis = right.map((v,i)=>Math.sin(th)*v+Math.cos(th)*F[i]);
  for (let r = 0; r < FIG_H; r++) for (let c = 0; c < FIG_W; c++) {
    const k = role[r * FIG_W + c];
    if (!k) continue;
    const u = c - (FIG_W - 1) / 2, n = near[r * FIG_W + c], height = (FIG_H - r - .5) * unit;
    const X = rx + (across[0] * u + nearAxis[0] * n) * unit + U[0] * height, Y = ry + (across[1] * u + nearAxis[1] * n) * unit + U[1] * height, Z = z0 + (across[2] * u + nearAxis[2] * n) * unit + U[2] * height;
    const depth = dx * X + dy * Y;
    if (depth < 0.05 || depth > vis) continue;
    const col = cols / 2 + (-dy * X + dx * Y) * projX / depth, row = hor - (Z - eye) * projY / depth;
    const hu = unit * projX / depth * 0.55, hz = unit * projY / depth * 0.55; // (half a pixel and a touch more: no gaps)
    let c0 = Math.ceil(col - hu - 0.5), c1 = Math.floor(col + hu - 0.5), r0 = Math.ceil(row - hz - 0.5), r1 = Math.floor(row + hz - 0.5);
    if (c1 < c0) c0 = c1 = Math.floor(col); // (smaller than a cell: the cell it's in)
    if (r1 < r0) r0 = r1 = Math.floor(row);
    const ro = hu < 0.5 || hz < 0.5 ? FIG_COARSE[k] || k : k, L = (1 - depth / vis) * 15 * amb, lit = clamp(0.32 + Math.max(light, L) / 15 * 0.78, 0.32, 1);
    for (let rr = Math.max(0, r0); rr <= Math.min(rows - 1, r1); rr++) for (let cc = Math.max(0, c0); cc <= Math.min(cols - 1, c1); cc++) {
      const i = rr * cols + cc;
      if (depth >= ZB[i]) continue;
      BG[i] = C(look.base[ro], look.lvl[ro] * lit); set(i, ' ', 0); ZB[i] = ZBG[i] = depth; FL[i] = 0;
    }
  }
}
// your shadow on the ground, under the board: how high you are, in the air
function drawSkateShadow(vx, vy, g, yaw, up) {
  const k = 1 / (1 + up * 8), F = craftFrame(yaw, 0, 0), ru = (SB.hl + 0.006) * k, rv = SB.hw * 1.6 * k;
  drawOBox(vx, vy, g + 0.0004, [F.f, F.r, F.u], [ru, rv, 0.0003], (i, t, L) => {
    if ((HIT.u / ru) ** 2 + (HIT.v / rv) ** 2 > 1) return false;
    BG[i] = C(GRAY, 0.55); return set(i, ' ', 0), true;
  });
}
function skaterFootAnchor(key, look) {
  const pose=figPose(key),feet=pose.legs.map(([tp,ta,sp,sa],i)=>{
    const sg=i===0?1:-1,thigh=fLimb(tp,ta,sg),shin=fLimb(sp,sa,sg);
    const z=13+thigh[2]*6.2+shin[2]*6;
    return [sg*1.6*(look.bw||1)+thigh[0]*6.2+shin[0]*6,
      thigh[1]*6.2+shin[1]*6+Math.cos(sp)*(FIG_SOLE[0]+FIG_SOLE[1])/2-Math.sin(sp)*(FIG_SHOE_HI-FIG_SHOE_LO)/2,
      Math.min(...FIG_SOLE.map(a=>z+a*Math.sin(sp)-FIG_SHOE_LO*Math.cos(sp)))];
  });
  const low=Math.min(feet[0][2],feet[1][2]);
  const planted=key.startsWith('push')?[feet[1]]:key.startsWith('mongo')?[feet[0]]:feet;
  return [0,1,2].map(i=>planted.reduce((sum,f)=>sum+f[i],0)/planted.length-(i===2?low:0));
}
function drawSkater() {
  if (!skateView) return;
  const tr = body.trick, p = tr ? clamp(tr.t / (tr.duration ?? tr.air), 0, 1) : 0, e = p * p * (3 - 2 * p), look = skaterLook();
  if (SK.bailAt) return skateBailDraw();
  const { x, y } = skateView, [vx, vy] = R(x, y), g = skateGround(x, y), z = g + body.z / 10;
  if (!SK.transition || SKB.surf.n[2] > .5) drawSkateShadow(vx, vy, g, skateView.a, body.z / 10);
  const roll = skateAir() ? SKB.roll : 0, yaw = SKB.yaw, nose = skateAir() ? SKB.pitch : 0;
  drawSkateBoard(vx, vy, z, yaw, nose + (!skateAir() ? SKB.pitch : 0), roll + (!skateAir() ? SKB.roll : 0));
  const air = skateAir(), pushing = SK.kicking && !air, ang = pushing ? skatePushYaw(SKB.yaw) : (air?skateView.a:SKB.yaw) + SK.stance * Math.PI / 2;
  const pose = air ? 'skateair' : SK.charge >= 0 || skateGestureLoaded() ? 'crouch' : pushing ? (SK.mongo ? 'mongo' : 'push') + (Math.floor(SK.kick * 8) & 7) : 'ride' + Math.round(1 + SK.steer * SK.stance);
  const contactNormal = SK.transition ? SKB.surf.n : air ? SK.airNormal || [0,0,1] : SKB.surf?.n || [0,0,1], footOffset = SB.up + SB.ht + (tr && (tr.flip || tr.turn) ? Math.sin(p * Math.PI) * 0.02 : 0); // (up off the deck while it flips under you)
  const f=air?SK.airForward:SK.transition?skateBoardAxes(SKB.yaw,SKB.pitch,SKB.roll).axis:null,u=contactNormal;
  const facing=f?(pushing?f.map(v=>v*(SK.pushFakie?-1:1)):[u[1]*f[2]-u[2]*f[1],u[2]*f[0]-u[0]*f[2],u[0]*f[1]-u[1]*f[0]].map(v=>v*SK.stance)):null;
  drawSkaterFigure(vx + u[0] * footOffset, vy + u[1] * footOffset, z + u[2] * footOffset, SB.rider, Math.cos(ang), Math.sin(ang), look, pose, 5, u, skaterFootAnchor(pose,look),facing);
}
