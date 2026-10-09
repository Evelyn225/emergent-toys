// The service tunnel behind the south shutter: one centreline, one floor profile, and one
// rock cross-section that the shell, floor, collision, cable, and lamps all sample.
const lerp = (a,b,t) => a+(b-a)*t, sstep = (a,b,x) => { const t = Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
const smax = (a,b,k) => { const h = Math.max(k-Math.abs(a-b),0)/k; return Math.max(a,b)+h*h*k/4; };
const serviceStraight = 34, serviceBend = 14, liningEnd = 28, bendEnd = serviceStraight+serviceBend*Math.PI/2;
const roomRadius = 10, roomS = bendEnd+36, mouthS = roomS-roomRadius, roomFloor = -6, rockSegments = 32;
function pathAt(s) {
  if (s <= serviceStraight) return { x: -20, z: -59.3-s, tx: 0, tz: -1 };
  if (s <= bendEnd) {
    const a = (s-serviceStraight)/serviceBend;
    return { x: -20-serviceBend+serviceBend*Math.cos(a), z: -59.3-serviceStraight-serviceBend*Math.sin(a), tx: -Math.sin(a), tz: -Math.cos(a) };
  }
  return { x: -20-serviceBend-(s-bendEnd), z: -59.3-serviceStraight-serviceBend, tx: -1, tz: 0 };
}
// Flat at the door, then an eased descent that levels out into the cave floor.
const pathFloor = s => hubFloor+(roomFloor-hubFloor)*sstep(3,mouthS,s);
// A point at lateral offset u (positive is the walker's right) and height v above the floor.
function pathPoint(s,u,v) {
  const { x,z,tx,tz } = pathAt(s);
  return new THREE.Vector3(x-tz*u,pathFloor(s)+v,z+tx*u);
}
function hash3(x,y,z) { const h = Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return h-Math.floor(h); }
function noise3(x,y,z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = sstep(0,1,x-xi), v = sstep(0,1,y-yi), w = sstep(0,1,z-zi), h = (a,b,c) => hash3(xi+a,yi+b,zi+c);
  return lerp(lerp(lerp(h(0,0,0),h(1,0,0),u),lerp(h(0,1,0),h(1,1,0),u),v),
    lerp(lerp(h(0,0,1),h(1,0,1),u),lerp(h(0,1,1),h(1,1,1),u),v),w)*2-1;
}
const rockNoise = (x,y,z) => .5*noise3(x*.45,y*.45,z*.45)+.3*noise3(x*1.1+7,y*1.1,z*1.1)+.2*noise3(x*2.6-3,y*2.6,z*2.6);
function rockShape(s) {
  // Hewn where the lining ends, natural by the end of the bend, then a domed chamber.
  const wild = sstep(liningEnd+2,bendEnd,s), d = (s-roomS)/roomRadius, dome = Math.sqrt(Math.max(0,1-d*d));
  let hw = lerp(2,2.7,wild)+wild*(.35*Math.sin(s*.29)+.2*Math.sin(s*.71+1));
  let h = lerp(3.4,4.1,wild)+wild*(.4*Math.sin(s*.23+2)+.25*Math.sin(s*.61));
  if (s >= roomS) { hw = roomRadius*dome; h = 8.5*dome; }
  else { hw = smax(hw,roomRadius*dome,2.5); h = smax(h,8.5*dome,2.5); }
  const amp = (lerp(.15,.6,wild)+.45*sstep(mouthS-4,roomS,s))*Math.min(1,hw/2);
  // Broad lobes make the chamber irregular in plan and section, not just rough.
  const lobe = (.35*wild+1.6*sstep(mouthS,roomS-3,s))*Math.min(1,hw/4);
  return { hw,h,n: lerp(5,2,wild),amp,lobe };
}
function rockRing(s) {
  const { x,z,tx,tz } = pathAt(s), y = pathFloor(s), { hw,h,n,amp,lobe } = rockShape(s), ring = [];
  for (let j = 0; j <= rockSegments; j++) {
    const theta = Math.PI*(1-j/rockSegments), c = Math.cos(theta), base = j === 0 || j === rockSegments;
    let u = base ? (j ? hw : -hw) : Math.sign(c)*Math.abs(c)**(2/n)*hw, v = base ? 0 : Math.abs(Math.sin(theta))**(2/n)*h;
    const px = x-tz*u, py = y+v, pz = z+tx*u, bump = amp*rockNoise(px,py,pz)+lobe*noise3(px*.17+11,py*.17,pz*.17);
    if (base) u += Math.sign(u)*bump;
    else {
      const dv = v-.3*h, length = Math.hypot(u,dv) || 1;
      u += u/length*bump; v = Math.max(.1,v+dv/length*bump);
    }
    ring.push({ x: x-tz*u,y: y+v,z: z+tx*u,u,v });
  }
  return ring;
}
// Where the right-hand wall of a ring passes a height, pulled in from the rock by an inset.
function wallPoint(ring,height,inset) {
  for (let j = rockSegments; j > rockSegments/2; j--) {
    const a = ring[j], b = ring[j-1];
    if (b.v >= height) return { u: lerp(a.u,b.u,(height-a.v)/(b.v-a.v))-inset,v: height };
  }
  return { u: ring[rockSegments/2].u-inset,v: height };
}
// The intake: a vaulted passage swept along a curve. Wall lamps stand in pairs midway between alternate ribs.
const tunnelCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,0,7),new THREE.Vector3(0,0,-4),new THREE.Vector3(4,0,-12),
  new THREE.Vector3(11,0,-18),new THREE.Vector3(12,0,-23),new THREE.Vector3(12,0,-26.85),
]);
const lengthSegments = 100, archSegments = 16, intakeLength = tunnelCurve.getLength(), intakeBays = [15,35,55,75,95];
function intakeFrame(i) {
  const t = i/lengthSegments, center = tunnelCurve.getPointAt(t), tangent = tunnelCurve.getTangentAt(t);
  if (i === lengthSegments) tangent.set(0,0,-1);
  return { t,center,tangent,right: new THREE.Vector3(-tangent.z,0,tangent.x).normalize(),halfWidth: 2+.15*Math.sin(t*Math.PI*2) };
}
// A point on one wall (side -1 is the walker's left) at a height, pulled in from the face by an inset.
function intakeWall(i,side,y,inset = 0) {
  const { center,right,halfWidth } = intakeFrame(i);
  return center.clone().addScaledVector(right,side*(halfWidth-inset)).setY(y);
}
const intakeLamps = intakeBays.flatMap(i => [-1,1].map(side => [intakeWall(i,side,1.5,.5),collapsed ? 0 : .3,6.5]));
// The service branch's lamps: caged lamps in the lining, work lights on the cable, tripods in the cave.
// Tripods stand clear of the sightline from the pedestal back down the tunnel.
const liningLamps = [5,13,21], cableLamps = [34,43,52,64,76], tripodAngles = [0,118,242].map(a => a*Math.PI/180);
const cableLamp = s => { const w = wallPoint(rockRing(s),2.45,.15); return pathPoint(s,w.u-.05,w.v-.62); };
const tripodAt = a => [roomS+Math.cos(a)*5.5,Math.sin(a)*5.5];
// The way out, open only after the ending: a ruined reception behind the intake door, then one
// straight stair to a bunker at the surface. Each flight is sixteen risers ending on a landing.
// The stair ceiling runs parallel to the average pitch, from the first riser to the hatch.
const receptionEnd = 22.85, stairBase = 24.65, flights = 20, risers = 16, rise = .17, going = .3, landingDepth = 1.5;
const flightRun = (risers-1)*going+landingDepth, flightRise = risers*rise, surfaceY = flights*flightRise;
// The bunker's front wall: its inner face ends the last landing, its outer face meets the meadow.
const hatchZ = stairBase+flights*flightRun+.75, bunkerFront = hatchZ+.6, hatchRadius = 1.15, hatchCentre = surfaceY+.9;
const stairCeiling = z => 3.3+Math.max(0,z-stairBase)*flightRise/flightRun;
// The walking height of the stair at z: risers, treads, and landings.
function stairFloor(z) {
  if (z < stairBase) return 0;
  const k = Math.min(flights-1,Math.floor((z-stairBase)/flightRun)), local = z-stairBase-k*flightRun;
  return k*flightRise+Math.min(risers,Math.floor(local/going)+1)*rise;
}
// Fluorescent fittings in the reception's ceiling grid, one hanging from a single chain, then a
// bulkhead lamp on each landing's rib. The power is failing, so most of them flicker. The blast
// came up the stair, so the highest lamps are dead and daylight stands in for them at the top.
const landingMid = k => stairBase+k*flightRun+(risers-1)*going+landingDepth/2;
const wayOutLamps = collapsed ? [
  { at: [-3,4.17,11.4],mode: 'steady' },{ at: [3,4.17,11.4],mode: 'stutter' },
  { at: [-3,3.05,17.4],mode: 'stutter',hanging: true },{ at: [.6,4.17,21],mode: 'dying' },
  ...Array.from({ length: flights-1 },(_,k) => ({ at: [0,stairCeiling(landingMid(k))-.36,landingMid(k)],stair: true,
    mode: k >= 16 || k === 9 ? 'dead' : k === 5 || k === 13 || k === 15 ? 'dying' : k%3 === 1 ? 'stutter' : 'steady' })),
] : [];
// Every lamp the shader can sum: the intake's, then the service branch's, which share its power,
// then the way out's and the daylight that falls down the last flights.
const lampSources = [
  ...intakeLamps.map(([position,strength,reach]) => ({ position,strength,reach,service: false })),
  ...[
    ...liningLamps.map(s => [pathPoint(s,0,2.75),.5,9]),
    ...cableLamps.map(s => [cableLamp(s),.5,8]),
    ...tripodAngles.map(a => { const [s,u] = tripodAt(a); return [pathPoint(s,u,2.25),.6,7]; }),
  ].map(([position,strength,reach]) => ({ position,strength,reach,service: true })),
  ...wayOutLamps.map(lamp => {
    const [x,y,z] = lamp.at;
    return lamp.source = { position: new THREE.Vector3(x,y-.3,z),strength: 0,reach: lamp.stair ? 7.5 : 8.5,service: false };
  }),
  // Daylight stands in the hatch opening, so it lights what faces the opening and not the wall
  // around it; a fainter fill carries it down the last flight.
  ...(collapsed ? [[0,hatchCentre,bunkerFront+.3,.75,12],[0,stairCeiling(hatchZ-7)-.8,hatchZ-7,.25,9]].map(([x,y,z,strength,reach]) =>
    ({ position: new THREE.Vector3(x,y,z),strength,reach,service: false })) : []),
];
const tunnelLamps = { value: lampSources.map(() => new THREE.Vector4()) }, tunnelReach = { value: lampSources.map(() => 0) };
const lampCount = { value: 0 }, flash = { value: 0 }, tunnelPower = { value: 1 }, blastLight = { value: new THREE.Vector4(0,0,0,0) };
// Fog hides everything past 64 m, so a lamp further than that plus its reach lights nothing in view.
// Each frame only the others go to the shader, at their current strength.
function packLamps() {
  let count = 0;
  for (const lamp of lampSources) {
    const strength = lamp.strength*(lamp.service ? tunnelPower.value : 1);
    if (strength <= 0 || lamp.position.distanceTo(camera.position) > lamp.reach+64) continue;
    tunnelLamps.value[count].set(lamp.position.x,lamp.position.y,lamp.position.z,strength);
    tunnelReach.value[count++] = lamp.reach;
  }
  lampCount.value = count;
}
