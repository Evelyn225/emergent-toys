const SK_BOWL_STAIRS=[];
// Sweep the quarter profile around a circular floor. Tangential speed and
// radial arc speed form a tangent-plane velocity; angular momentum carries a
// carve around a corner without dropping the skater back to a heightfield.
function addSkateBowl(x, y, options = {}) {
  const o = addSkateTransition(x, y, { flat: .5, ...options });
  // A 2 mm concrete skin keeps the flat bottom above the street floor's
  // coplanar depth, so the park/path paint cannot punch through it.
  // The shared transition constructor supplies the concrete skin.
  o.bowl = true; o.hw = o.hl; o.ray = typeof rayBowlProfile === 'function' ? rayBowlProfile : null;
  o.profile.radialPoints = [[0, 0], ...o.profile.points.filter(v => v[0] >= o.profile.flat / 2 - 1e-9)];
  GRINDS.splice(-2, 2);
  const points = Array.from({ length: 33 }, (_, i) => {
    const angle = i / 32 * Math.PI * 2;
    return [x + Math.cos(angle) * o.profile.tip, y + Math.sin(angle) * o.profile.tip, o.z0 + o.profile.height + .003];
  });
  GRINDS.push({ points, ax: points[0][0], ay: points[0][1], bx: points.at(-1)[0], by: points.at(-1)[1],
    z: o.profile.height + .003, kind: 'coping', material: 'metal', feature: o });
  if(typeof parks!=='undefined')addBowlAccess(o);
  return o;
}
function skateBowlHit(o, x, y, zHint) {
  const dx = rel(x - o.x), dy = rel(y - o.y), radius = Math.hypot(dx, dy), p = o.profile;
  if (radius > p.tip + .002 || radius < p.flat / 2 - .005) return null;
  const axis = Math.atan2(dy, dx), u = skateProfileU(p, radius, zHint - o.z0), at = skateProfilePoint(p, u);
  return { o, u, axis, at, n: [-Math.cos(axis) * at.tz, -Math.sin(axis) * at.tz, at.tx] };
}
function enterSkateBowl(hit) {
  const { o, axis, u, at } = hit, vx = Math.cos(SK.dir) * SK.v, vy = Math.sin(SK.dir) * SK.v;
  const vertical = skateAir() ? body.vz / 10 : -(vx * hit.n[0] + vy * hit.n[1]) / Math.max(.05, hit.n[2]);
  SK.transition = { o, u, axis, vs: (vx * Math.cos(axis) + vy * Math.sin(axis)) * at.tx + vertical * at.tz,
    va: -vx * Math.sin(axis) + vy * Math.cos(axis), yawOff: Math.cos(a - SK.dir) < 0 ? Math.PI : 0 };
  skateManualEnd(); body.trick = null; body.vz = 0;
}
function skateBowlPlace(C) {
  const p = skateProfilePoint(C.o.profile, C.u), c = Math.cos(C.axis), s = Math.sin(C.axis);
  px = worldCoord(C.o.x + c * p.x); py = worldCoord(C.o.y + s * p.x);
  const z = C.o.z0 + p.z;
  SKB.v = [c * p.tx * C.vs - s * C.va, s * p.tx * C.vs + c * C.va, p.tz * C.vs];
  SK.v = Math.hypot(SKB.v[0], SKB.v[1]);
  if (SK.v > 1e-7) SK.dir = Math.atan2(SKB.v[1], SKB.v[0]);
  a = SK.dir + C.yawOff;
  SKB.yaw = a; SKB.riderYaw = a; SKB.pitch = Math.atan2(SKB.v[2] * (C.yawOff ? -1 : 1), SK.v || 1e-9);
  const normal = [-c * p.tz, -s * p.tz, p.tx], axes = skateBoardAxes(a, SKB.pitch, 0);
  const right = [-Math.sin(a), Math.cos(a), 0];
  const dot = (x, y) => x.reduce((v, n, i) => v + n * y[i], 0);
  SKB.roll = Math.atan2(dot(normal, right), dot(normal, axes.up));
  SKB.p = [px, py, z]; SKB.contact = 'transition'; SKB.fakie = !!C.yawOff;
  SKB.surf = { h: z, n: normal, kind: 'transition', material: 'concrete', ref: C.o };
  body.z = Math.max(.001, (z - skateGround(px, py)) * 10); body.vz = 0;
  body.ground = skateGround(px, py); body.groundMode = mode;
}
function stepSkateBowl(C, dt, push, brake, steer) {
  const p = C.o.profile, at = skateProfilePoint(p, C.u), radius = Math.max(.03, at.x);
  // Project centripetal acceleration into the radial profile; preserve angular
  // momentum when the radius changes. The gravity term pulls a slow carve down.
  C.vs += (C.va * C.va * at.tx / radius - .98 * at.tz) * dt;
  const speed = Math.hypot(C.vs, C.va), loss = (brake ? .25 : .98 * SK_PHYS.concrete) * dt;
  const keep = speed ? Math.max(0, speed - loss) / speed : 0;
  C.vs *= keep; C.va *= keep;
  const turn = steer * 1.5 * dt, c = Math.cos(turn), s = Math.sin(turn), radial = C.vs * c - C.va * s;
  C.va = C.vs * s + C.va * c; C.vs = radial;
  if (push) { C.vs += Math.sign(C.vs || 1) * .06 * Math.sin(at.theta * 2) * dt; }
  const momentum = radius * C.va;
  C.u += C.vs * dt;
  const next = skateProfilePoint(p, clamp(C.u, 0, p.limit));
  C.va = momentum / Math.max(.03, next.x);
  C.axis += C.va / Math.max(.03, next.x) * dt;
  const coping = C.u > p.limit;
  C.u = Math.min(p.limit, C.u);
  skateBowlPlace(C);
  if (coping) skateTransitionRelease(C, true);
  else if (C.u < p.flat / 2 - .006) {
    // Across the flat, ordinary Cartesian integration avoids the polar
    // coordinate singularity at the centre of the bowl.
    SK.transition = null; body.z = body.vz = 0; SKB.contact = 'ground';
  }
  return true;
}

// A walkable approach from the path to the raised deck, with ordinary 18 cm
// risers. These are real depth-tested steps, not a teleport onto the coping.
function addBowlAccess(o){
  const rise=o.profile.height,count=Math.ceil(rise/.018),run=rise*2,width=.14;
  const start=o.x-o.hl-run,base=o.z0,steps=[];
  for(let i=0;i<count;i++){
    const step={x:start+(i+.5)*run/count,y:o.y,c:1,s:0,hl:run/count/2+.00001,hw:width/2,
      z0:base,z1:base+rise*(i+1)/count,kind:'skateledge',material:'concrete',low:true,walkStep:true};
    steps.push(step);solids.push(step);
  }
  SK_BOWL_STAIRS.push({bowl:o,steps,start,end:o.x-o.hl,y:o.y,base,rise,width});
  // Keep vegetation clear of the access corridor as well as the bowl itself.
  for(let i=trees.length-1;i>=0;i--)if(trees[i].x>start-.1&&trees[i].x<o.x-o.hl+.1&&Math.abs(trees[i].y-o.y)<width/2+.1)trees.splice(i,1);
}
function skateBowlAccessHeight(x,y){
  for(const a of SK_BOWL_STAIRS)if(x>=a.start&&x<=a.end&&Math.abs(y-a.y)<=a.width/2){
    const i=Math.min(a.steps.length-1,Math.floor((x-a.start)/(a.end-a.start)*a.steps.length));return a.steps[i].z1;
  }
  return 0;
}
