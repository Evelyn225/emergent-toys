// ===== the police helicopter on screen (crime.js flies it, at 5 stars): aircraft-render.js's helicopter, half as big
// again as the Hornet, in police colours (white, a dark belly, yellow and blue squares down the side), its red and blue
// lights flashing; and its searchlight, a beam slanting down to a pool of light on the street (or the roof it's on).
// The rotor thuds, louder the nearer it is.
function drawChopper() {
  if (!heli) return;
  const vx = rel(heli.x - px), vy = rel(heli.y - py), z = heli.z, hx = Math.cos(heli.h), hy = Math.sin(heli.h);
  if (Math.hypot(vx, vy) > vis + 4) return;
  const lx = rel(heli.sx - px), ly = rel(heli.sy - py), ground = map[idx(Math.floor(heli.sx), Math.floor(heli.sy))] || 0;
  const strength = 0.35 + 0.65 * Math.max(night, overcast * 0.6); // (much plainer by night)
  // the pool of light: brightest in the middle, fading to its edge
  drawBox(boxAt(lx, ly, 1, 0, SPOT_R, SPOT_R, ground + 0.0003, ground + 0.0008), (i, t, L) => {
    const r = Math.hypot(HIT.u, HIT.v) / SPOT_R, k = (1 - r * r) * strength;
    BG[i] = C(WHITE, 3 + k * 9); set(i, k > 0.55 ? ' ' : '.', C(YEL, 6 + k * 8)); FOGS[i] = 0; return true;
  }, rayCopperDrum);
  // the beam: specks of light down the line from the helicopter's belly to the pool, in front of whatever's behind
  const bx = vx + hx * 0.17 * CHOPPER_SIZE, by = vy + hy * 0.17 * CHOPPER_SIZE, bz = z - 0.07 * CHOPPER_SIZE; // (from the lamp under its nose)
  // A widening volume: rings grow from the lamp to the existing circular ground pool.
  for(let k=1;k<24;k++)for(let j=0;j<12;j++){
    const f=k/24,theta=j/12*TAU,radius=SPOT_R*f;
    const x=bx+(lx-bx)*f+Math.cos(theta)*radius,y=by+(ly-by)*f+Math.sin(theta)*radius,wz=bz+(ground-bz)*f;
    const depth=dx*x+dy*y;if(depth<.2||depth>vis)continue;
    const c=Math.floor(cols/2+(-dy*x+dx*y)*projX/depth),r=Math.floor(hor-(wz-eye)*projY/depth);
    if(c<0||r<0||c>=cols||r>=rows)continue;
    const i=r*cols+c;if(depth>=ZB[i]||hash(j,k,Math.floor(T*8))>.68)continue;
    set(i,':',C(WHITE,3+strength*8));FOGS[i]=0;
  }
  // the machine itself: a big one, white with a dark belly and the yellow and blue squares down its side, lit up
  drawHeliModel([vx, vy, z], craftFrame(heli.h, -0.12, 0), CHOPPER_SIZE, { body: WHITE, belly: GRAY, checker: true, stripe: BLUE, bright: 1.5, rotor: 0.5, ang: T * 27, police: true, id: 7 });
}
const CHOPPER_SIZE = 2; // (against the Hornet's 1: a big twin-engined thing, and you need to see it from the street)

// the rotor's thud-thud-thud: one low pulse every tenth of a second or so, louder close by, panned to its side
let chopperBeat = 0;
function stepChopperSound(dt) {
  if (gameplayBuffers.rotor) return; // The shared recorded loop follows position/height in audioTick.
  if (!heli || !actx || paused || (chopperBeat -= dt) > 0) return;
  chopperBeat = 0.105;
  const vx = rel(heli.x - px), vy = rel(heli.y - py), d = Math.hypot(vx, vy, heli.z), loud = clamp(1 - d / 40, 0, 1);
  if (loud <= 0) return;
  const pan = clamp((-dy * vx + dx * vy) / Math.max(1, d), -1, 1), at = actx.currentTime;
  tone(at, 48 + Math.random() * 6, 0.08, 0.05 * loud * loud, 'sawtooth', pan);
  tone(at, 95, 0.03, 0.025 * loud, 'square', pan);
}
