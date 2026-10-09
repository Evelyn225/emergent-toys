// The way out, built only on a visit after the ending. Behind the intake door is the facility's
// reception, wrecked: the ceiling grid has shed its tiles, one corner has come down in a heap of
// rubble through a hole in the slab, and what lamps still work flicker. Opposite the door, one
// straight stair of twenty flights climbs to a bunker at the surface (paths.js holds its layout).
// The front face of the bunker's hatch wall is here; its outside belongs to the surface.
let hangingLamp = null;
// The hatch's round opening, cut flat at the top landing, as [x,y] points from its west foot over
// the crown to its east foot. The wall faces, the reveal, and the trim all sample it.
function hatchArc(r,segments = 64) {
  const a = Math.asin((hatchCentre-surfaceY)/r), points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI+a-i/segments*(Math.PI+2*a);
    points.push([r*Math.cos(angle),hatchCentre+r*Math.sin(angle)]);
  }
  return points;
}
// A wall face in the plane z, from an outline of [x,y] points, with optional holes.
function wallOutline(outline,z,mat,holes = []) {
  const flat = [...outline,...holes.flat()], vertices = [];
  const triangles = THREE.ShapeUtils.triangulateShape(outline.map(([x,y]) => new THREE.Vector2(x,y)),holes.map(h => h.map(([x,y]) => new THREE.Vector2(x,y))));
  for (const triangle of triangles) for (const k of triangle) vertices.push(flat[k][0],flat[k][1],z);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geom.computeVertexNormals();
  return new THREE.Mesh(geom,mat);
}
// Mostly on, stuttering, or dying: each lamp keeps its own rhythm from a seed. Slow segments choose
// a mood; fast ones are the tube catching and dropping out.
function flickerLevel(mode,seed,t) {
  if (mode === 'dead') return 0;
  const slow = hash3(Math.floor(t*.55+seed*7.3),seed,1), fast = hash3(Math.floor(t*13+seed),seed,2);
  if (mode === 'steady') return slow < .12 && fast < .5 ? 0 : 1;
  if (mode === 'stutter') return slow < .5 && fast < .45 ? 0 : 1;
  return slow < .22 ? (fast < .65 ? 1 : 0) : fast < .025 ? 1 : 0;
}
function wayOut() {
  const top = surfaceY, angle = Math.atan(flightRise/flightRun);

  // Reception: a 12 x 15.7 m room under a 4.8 m slab, with a suspended ceiling grid at 4.2 m.
  // The front wall and its door are the intake's end wall; the back wall opens onto the stair.
  floor(0,15,12,15.7,0);
  floor(0,(receptionEnd+stairBase)/2,2.4,stairBase-receptionEnd,0);
  for (const x of [-6.15,6.15]) box(x,2.4,15,.3,4.8,15.7,concrete,true);
  for (const x of [-3.75,3.75]) box(x,2.4,23,5.1,4.8,.3,concrete,true);
  box(0,4.05,23,2.4,1.5,.3,concrete,true);
  // The slab is holed above the north-east corner, where the rubble came through.
  const hole = { x0: 3.4,x1: 5.4,z0: 18.4,z1: 21.4 };
  for (const [x0,x1,z0,z1] of [[-6,6,7.15,hole.z0],[-6,6,hole.z1,receptionEnd],[-6,hole.x0,hole.z0,hole.z1],[hole.x1,6,hole.z0,hole.z1]]) {
    surface([[x0,4.8,z0],[x1,4.8,z0],[x1,4.8,z1],[x0,4.8,z1]],concrete,false,true);
  }
  const holeCorners = [[hole.x0,hole.z0],[hole.x1,hole.z0],[hole.x1,hole.z1],[hole.x0,hole.z1]];
  for (let i = 0; i < 4; i++) {
    const [ax,az] = holeCorners[i], [bx,bz] = holeCorners[(i+1)%4];
    surface([[ax,4.8,az],[bx,4.8,bz],[bx,5.3,bz],[ax,5.3,az]]);
    // Above the slab, broken ground: a rough cavity the rubble fell out of.
    surface([[ax,5.3,az],[bx,5.3,bz],[bx,6.7,bz],[ax,6.7,az]],rock);
  }
  surface(holeCorners.map(([x,z]) => [x,6.7,z]),rock);
  for (let k = 0; k < 9; k++) {
    const edge = k%4, t = hash3(k,2,9), [ax,az] = holeCorners[edge], [bx,bz] = holeCorners[(edge+1)%4];
    const x = lerp(ax,bx,t), z = lerp(az,bz,t), drop = .5+hash3(k,3,9)*1.1;
    beam([x,4.95,z],[x+(hash3(k,4,9)-.5)*.8,4.95-drop,z+(hash3(k,5,9)-.5)*.8],.025);
  }

  // The ceiling grid. Tiles are missing all over and every one above the rubble is gone; a few
  // hang from one edge. Grid bars stop short of the hole, a couple of them bent down.
  const fixtureCells = new Set(['2,3','7,3','2,8','5,11']), hangingCells = { '5,4': 1,'1,10': -1,'8,1': 1,'0,6': -1 };
  const overRubble = (i,j) => i >= 7 && j >= 8;
  for (let i = 0; i < 10; i++) for (let j = 0; j < 13; j++) {
    const x0 = -6+i*1.2, z0 = 7.2+j*1.2, key = i+','+j;
    if (overRubble(i,j) || key === '2,8' || (!fixtureCells.has(key) && hash3(i,j,4) < .2)) continue;
    if (hangingCells[key]) {
      const pivot = new THREE.Vector3(x0+.6,4.2,z0+(hangingCells[key] > 0 ? 0 : 1.2)), tile = box(0,0,0,1.17,.02,1.17,pale);
      tile.rotation.x = hangingCells[key]*(1+hash3(i,j,5)*.35);
      tile.position.copy(pivot).add(new THREE.Vector3(0,0,.585*hangingCells[key]).applyEuler(tile.rotation));
      continue;
    }
    surface([[x0+.015,4.2,z0+.015],[x0+1.185,4.2,z0+.015],[x0+1.185,4.2,z0+1.185],[x0+.015,4.2,z0+1.185]],pale);
  }
  for (let i = 1; i < 10; i++) {
    const x = -6+i*1.2, end = x > 3 ? 16.8 : 22.8;
    box(x,4.185,(7.2+end)/2,.03,.03,end-7.2,steel);
  }
  for (let j = 1; j < 13; j++) {
    const z = 7.2+j*1.2, end = z > 16.7 ? 2.4 : 5.985;
    box((-5.985+end)/2,4.185,z,end+5.985,.03,.03,steel);
  }
  box(0,4.185,7.18,11.97,.03,.06,steel);
  box(-1.8,4.185,receptionEnd-.03,8.37,.03,.06,steel);
  box(-5.97,4.185,15,.06,.03,15.67,steel);
  box(5.97,4.185,(7.15+16.8)/2,.06,.03,16.8-7.15,steel);
  beam([3.6,4.185,16.8],[3.75,3.3,17.5],.03); beam([2.4,4.185,18],[3.1,3.6,18.3],.03);
  // A supply duct runs above the grid; one length has broken and hangs through it.
  box(-1.8,4.5,15,.8,.4,15.8,steel);
  const duct = box(-1.75,3.55,15.35,.74,.38,1.9,steel);
  duct.rotation.x = -1.05;

  // Lamps: fittings in the grid, one hanging by a single chain, and the stair's bulkheads.
  for (const lamp of wayOutLamps) {
    lamp.seed = 1+wayOutLamps.indexOf(lamp)*3.7;
    const [x,y,z] = lamp.at;
    if (lamp.stair) {
      const yc = stairCeiling(z), along = d => [0,yc-d*Math.cos(angle),z+d*Math.sin(angle)];
      const plate = box(...along(.3),.6,.04,.32,steel), fixture = box(...along(.35),.5,.07,.22,lit);
      plate.rotation.x = fixture.rotation.x = -angle;
      lamp.fixture = fixture;
    } else if (lamp.hanging) {
      // It hangs from one chain at its south end, swinging a little; the other chain dangles.
      hangingLamp = new THREE.Group();
      hangingLamp.position.set(x,4.18,z-.55); scene.add(hangingLamp);
      const chain = new THREE.Mesh(new THREE.BoxGeometry(.015,.12,.015),steel), body = new THREE.Group();
      chain.position.y = -.06; body.position.y = -.12; body.rotation.x = 1.2;
      const housing = new THREE.Mesh(new THREE.BoxGeometry(.36,.04,1.16),steel), tube = new THREE.Mesh(new THREE.BoxGeometry(.3,.06,1.1),lit);
      housing.position.set(0,.03,.58); tube.position.set(0,-.02,.58);
      body.add(housing,tube); hangingLamp.add(chain,body);
      lamp.fixture = tube;
      lamp.source.position.set(x,3.3,z-.3);
      beam([x,4.2,z+.5],[x+.05,3.78,z+.47],.012);
    } else {
      box(x,4.19,z,.36,.02,1.16,steel);
      lamp.fixture = box(x,4.15,z,.3,.06,1.1,lit);
    }
    lamp.fixture.userData.dynamic = true;
  }

  // Columns. The north-east one snapped: its stump stands out of the rubble, a stub still hangs
  // from the slab, and the shaft lies down the rubble's slope to the floor.
  for (const [x,z] of [[-3,13.4],[3,13.4],[-3,19.4]]) box(x,2.4,z,.6,4.8,.6,concrete,true);
  box(3,1.3,19.4,.6,2.6,.6,concrete,true);
  box(3,4.5,19.4,.6,.6,.6);
  beam([3.1,2.35,19.05],[1.95,.28,16.55],.56,concrete);
  barrier([1.95,16.55],[2.55,17.6],[0,0],[1.2,1.2],.3);
  for (let k = 0; k < 6; k++) {
    const dx = (hash3(k,1,6)-.5)*.4, dz = (hash3(k,2,6)-.5)*.4;
    beam([3+dx,2.55,19.4+dz],[3+dx*2.5+(hash3(k,3,6)-.5)*.3,2.95+hash3(k,4,6)*.4,19.4+dz*2.5],.022);
    beam([3+dx,4.25,19.4+dz],[3+dx*2,3.7-hash3(k,5,6)*.5,19.4+dz*2],.022);
  }

  // The rubble: one heightfield rising from the floor under the hole into the corner, cut by the
  // walls, with broken stone heaped on it and a slab of ceiling leaning on it. Triangles left flat
  // on the floor are dropped, so the floor stays the only surface there.
  const rubbleAt = (x,z) => {
    const d = Math.hypot((x-4.4)/3.3,(z-20.1)/4.7), m = 4.2*Math.max(0,1-sstep(0,1,d))**1.25;
    return m > 0 ? Math.max(0,m+.35*rockNoise(x*1.3,0,z*1.3)*Math.min(1,m)) : 0;
  };
  const heap = [];
  for (let x = .9; x < 6; x += .25) for (let z = 15; z < receptionEnd; z += .25) {
    const x1 = Math.min(6,x+.25), z1 = Math.min(receptionEnd,z+.25);
    const p = [[x,z],[x1,z],[x1,z1],[x,z1]].map(([px,pz]) => [px,rubbleAt(px,pz),pz]);
    for (const [a,b,c] of [[0,1,2],[0,2,3]]) {
      if (p[a][1]+p[b][1]+p[c][1] < .01) continue;
      heap.push(...p[a],...p[b],...p[c]);
    }
  }
  const heapGeom = new THREE.BufferGeometry();
  heapGeom.setAttribute('position',new THREE.Float32BufferAttribute(heap,3));
  heapGeom.computeVertexNormals(); mesh(heapGeom,rock);
  // Walkers stop at the toe, where the heap rises past a step.
  const toe = [];
  for (let k = 0; k <= 40; k++) {
    const a = k/40*Math.PI*2, dx = Math.cos(a), dz = Math.sin(a);
    let r = .2;
    while (r < 6 && rubbleAt(4.4+dx*r,20.1+dz*r) > .2) r += .05;
    toe.push([4.4+dx*r,20.1+dz*r]);
  }
  for (let k = 0; k < toe.length-1; k++) barrier(toe[k],toe[k+1],[0,0],[4.2,4.2],.05);
  for (let k = 0; k < 44; k++) {
    const x = 1.6+hash3(k,1,7)*4.3, z = 15.4+hash3(k,2,7)*7.3, h = rubbleAt(x,z);
    if (h < .05 && hash3(k,3,7) < .6) continue;
    const r = .1+hash3(k,4,7)*(h > 0 ? .42 : .16), piece = mesh(stone(r,k*2.3),rock);
    piece.position.set(x,h+r*.25,z); piece.rotation.set(hash3(k,5,7)*3,hash3(k,6,7)*6,0);
  }
  const slab = box(4.3,2.75,19.7,2.4,.28,1.9);
  slab.rotation.set(.48,.2,.42);

  // The front desk faces the door; its return was knocked askew. A monitor still stands on it,
  // another lies on the floor behind with a toppled chair.
  box(-3.9,.5,15,3.4,1,.6,concrete,true);
  box(-3.9,1.03,15.05,3.5,.06,.75,pale);
  box(-3.9,.5,14.68,3.42,.86,.04,steel);
  const desk = new THREE.Group();
  desk.position.set(-2.5,0,15.3); desk.rotation.y = -.28; scene.add(desk);
  for (const [x,y,z,w,h,d,mat] of [[0,.5,1.1,.6,1,2.2,concrete],[.04,1.03,1.12,.75,.06,2.3,pale]]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); part.position.set(x,y,z); desk.add(part);
  }
  const deskEnd = new THREE.Vector3(0,0,2.2).applyAxisAngle(new THREE.Vector3(0,1,0),-.28);
  barrier([-2.5,15.3],[-2.5+deskEnd.x,15.3+deskEnd.z],[0,0],[1.1,1.1],.32);
  box(-4.7,1.07,15.15,.18,.02,.14,steel);
  const monitor = box(-4.7,1.3,15.15,.52,.36,.05,steel); monitor.rotation.y = .25;
  box(-3.6,1.07,14.95,.45,.02,.16,steel);
  const fallen = box(-3.4,.06,16.2,.52,.05,.36,steel); fallen.rotation.y = .7;
  const chair = new THREE.Group();
  chair.position.set(-4.6,.22,16.6); chair.rotation.set(0,.9,Math.PI/2); scene.add(chair);
  for (const [x,y,z,w,h,d] of [[0,.24,0,.46,.06,.46],[0,.55,-.21,.44,.5,.05],[0,0,0,.05,.45,.05],[0,-.2,0,.6,.04,.06],[0,-.2,0,.06,.04,.6]]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),steel); part.position.set(x,y,z); chair.add(part);
  }
  label('SUBSTRUCTURE',-5.985,3.05,16,Math.PI/2,3.2);
  label('RECEPTION',-5.985,2.25,16,Math.PI/2,1.5);
  // Hung from one chain now, readable from either side.
  for (const [z,turn,tilt] of [[14.395,Math.PI,-.32],[14.405,0,.32]]) label('ALL VISITORS REPORT HERE',-4.4,2.55,z,turn,1.7).rotation.z = tilt;
  beam([-3.6,4.2,14.4],[-3.63,2.94,14.4],.012);
  label('SURFACE ↑',0,3.95,receptionEnd-.02,Math.PI,1.4);
  // A clock on the east wall, stopped.
  const clock = mesh(new THREE.CylinderGeometry(.24,.24,.05,28),pale);
  clock.rotation.z = Math.PI/2; clock.position.set(5.975,3.1,11.4);
  beam([5.94,3.1,11.4],[5.94,3.24,11.43],.022); beam([5.94,3.1,11.4],[5.94,3.04,11.52],.026);

  // Waiting benches: one still standing, one thrown on its back; a low table and a dead plant.
  for (const z of [8.9,11.1]) for (const x of [4.5,4.9]) beam([x,0,z],[x,.43,z],.04);
  box(4.7,.45,10,.5,.05,2.8,steel);
  box(4.96,.78,10,.04,.56,2.8,steel);
  barriers.push({ box: new THREE.Box3(new THREE.Vector3(4.4,0,8.6),new THREE.Vector3(5.02,1.06,11.4)) });
  // Thrown on its back: the backrest flat on the floor, the seat on edge, its legs in the air.
  const bench = new THREE.Group();
  bench.position.set(3.1,0,9.6); bench.rotation.y = .32; scene.add(bench);
  for (const [x,y,z,w,h,d] of [[0,.025,0,.56,.05,2.8],[.3,.3,0,.04,.5,2.8],
    ...[-1.1,1.1].flatMap(z => [[.535,.1,z,.43,.04,.04],[.535,.5,z,.43,.04,.04]])]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),steel); part.position.set(x,y,z); bench.add(part);
  }
  const benchAxis = new THREE.Vector3(0,0,1.4).applyAxisAngle(new THREE.Vector3(0,1,0),.32);
  barrier([3.1-benchAxis.x,9.6-benchAxis.z],[3.1+benchAxis.x,9.6+benchAxis.z],[0,0],[.6,.6],.3);
  box(4.6,.36,12.1,.9,.04,.5,pale);
  for (const [x,z] of [[4.2,11.9],[5,11.9],[4.2,12.3],[5,12.3]]) beam([x,0,z],[x,.34,z],.03);
  barriers.push({ box: new THREE.Box3(new THREE.Vector3(4.15,0,11.85),new THREE.Vector3(5.05,.4,12.35)) });
  const pot = mesh(new THREE.CylinderGeometry(.26,.2,.55,16)); pot.position.set(5.5,.275,7.75);
  barrier([5.5,7.75],[5.5,7.751],[0,0],[.6,.6],.26);
  for (let k = 0; k < 7; k++) {
    const a = k*2.4, lean = .25+hash3(k,1,8)*.5;
    beam([5.5,.5,7.75],[5.5+Math.cos(a)*lean,.9+hash3(k,2,8)*.6,7.75+Math.sin(a)*lean],.018);
  }

  // Litter: papers spilled from the desk and drifted across the floor, tiles down from the grid,
  // and broken concrete, heaviest under the hole and along the rubble's foot.
  for (let k = 0; k < 46; k++) {
    const x = -5.6+hash3(k,1,3)*(k < 24 ? 5 : 10.5), z = 7.6+hash3(k,2,3)*(k < 24 ? 10 : 14);
    if (rubbleAt(x,z) > 0) continue;
    const a = hash3(k,3,3)*Math.PI, c = Math.cos(a), s = Math.sin(a), w = .105, d = .148;
    surface([[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v]) => [x+u*c-v*s,.004,z+u*s+v*c]),pale);
  }
  for (const [x,z,rx,rz] of [[1.8,12.6,.08,-.05],[-1.9,9.4,-.06,.1],[1.2,17.8,.12,.04],[-4.4,19.6,.05,.09],[4.4,14.2,-.1,-.03]]) {
    const tile = box(x,.04+.6*Math.abs(Math.sin(rx))+.6*Math.abs(Math.sin(rz)),z,1.17,.02,1.17,pale);
    tile.rotation.set(rx,hash3(x,z,1)*3,rz);
  }
  for (let k = 0; k < 34; k++) {
    const x = -5.5+hash3(k,7,2)*11, z = 7.8+hash3(k,8,2)*14.6;
    if (rubbleAt(x,z) > 0) continue;
    const big = Math.abs(x) > 1.4 && hash3(k,9,2) < .3, r = big ? .16+hash3(k,10,2)*.12 : .04+hash3(k,11,2)*.08;
    const piece = mesh(stone(r,k*1.7+40),rock);
    piece.position.set(x,r*.22,z); piece.rotation.set(0,hash3(k,12,2)*6,0);
  }

  // The stair. Its walls, ceiling, and handrails run straight from the reception to the hatch;
  // each flight is one mesh of risers and treads, ending on its landing.
  const yAt = z => (z-stairBase)*flightRise/flightRun;
  for (const side of [-1,1]) {
    const x = side*1.2;
    surface([[x,-.5,23.15],[x,-.5,stairBase],[x,3.3,stairBase],[x,3.3,23.15]],steel);
    surface([[x,-1.2,stairBase],[x,yAt(hatchZ)-1.2,hatchZ],[x,stairCeiling(hatchZ),hatchZ],[x,3.3,stairBase]],steel);
    // Collision runs up to the ceiling and no higher, so it never reaches the ground above the stair.
    barrier([x,receptionEnd],[x,stairBase],[-1,-1],[3.3,3.3],.05);
    barrier([x,stairBase],[x,hatchZ],[-3,stairCeiling(hatchZ)-6.3],[3.3,stairCeiling(hatchZ)],.05);
  }
  // Constant tile coordinates: the world grid's joints would otherwise run straight up the middle.
  const plain = [[.75,.75],[.75,.75],[.75,.75],[.75,.75]];
  tiled(surface([[-1.2,3.3,23.15],[1.2,3.3,23.15],[1.2,3.3,stairBase],[-1.2,3.3,stairBase]],steel,false,true),plain);
  tiled(surface([[-1.2,3.3,stairBase],[1.2,3.3,stairBase],[1.2,stairCeiling(hatchZ),hatchZ],[-1.2,stairCeiling(hatchZ),hatchZ]],steel,false,true),plain);
  for (let k = 0; k < flights; k++) {
    const zs = stairBase+k*flightRun, y0 = k*flightRise, end = k === flights-1 ? hatchZ : zs+flightRun, profile = [];
    for (let i = 0; i < risers; i++) profile.push([zs+i*going,y0+i*rise],[zs+i*going,y0+(i+1)*rise]);
    profile.push([end,y0+flightRise]);
    const positions = [];
    for (let i = 0; i < profile.length-1; i++) {
      const [za,ya] = profile[i], [zb,yb] = profile[i+1], q = [[-1.2,ya,za],[1.2,ya,za],[1.2,yb,zb],[-1.2,yb,zb]];
      for (const j of [0,1,2,0,2,3]) positions.push(...q[j]);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    // Constant tile coordinates keep the floor joints off the treads.
    geom.setAttribute('tile',new THREE.Float32BufferAttribute(positions.flatMap((_,n) => n%3 ? [] : [.75,.75,1]),3));
    geom.computeVertexNormals();
    floors.push(mesh(geom));
    // Steel nosings on every riser, sunk into the walls at their ends.
    for (let i = 0; i < risers; i++) box(0,y0+(i+1)*rise-.0085,zs+i*going+.019,2.44,.025,.05,steel);
    // Each landing but the last has a rib: pilasters and a beam under the sloping ceiling, and a
    // stencilled number on the west wall.
    if (k < flights-1) {
      const z = landingMid(k), yc = stairCeiling(z), y = (k+1)*flightRise;
      for (const side of [-1,1]) box(side*1.16,(y-.05+yc+.1)/2,z,.2,yc+.15-y,.3);
      const rib = box(0,yc-.13*Math.cos(angle),z+.13*Math.sin(angle),2.6,.3,.3);
      rib.rotation.x = -angle;
      label(String(k+1).padStart(2,'0'),-1.195,y+1.55,z-.55,Math.PI/2,.34);
    }
  }
  // Handrails on both walls follow the nosings up each flight and run level across its landing.
  const railPoints = [[23.4,.9]];
  for (let k = 0; k < flights; k++) {
    const zs = stairBase+k*flightRun, y0 = k*flightRise;
    railPoints.push([zs-.3,y0+.9],[zs+(risers-1)*going,y0+flightRise+.9]);
  }
  railPoints.push([hatchZ-.25,top+.9]);
  for (const side of [-1,1]) {
    for (let i = 0; i < railPoints.length-1; i++) {
      const [za,ya] = railPoints[i], [zb,yb] = railPoints[i+1];
      beam([side*1.12,ya,za],[side*1.12,yb,zb],.05);
      for (const t of i%2 ? [.2,.5,.8] : [.5]) {
        const z = lerp(za,zb,t), y = lerp(ya,yb,t);
        beam([side*1.12,y-.02,z],[side*1.2,y-.1,z],.03);
      }
    }
  }
  // Conduits run up the ceiling.
  for (const [x,width] of [[.72,.07],[.88,.05]]) {
    beam([x,3.3-.07,23.15],[x,3.3-.07,stairBase],width);
    beam([x,3.3-.07,stairBase],[x,stairCeiling(hatchZ-.05)-.07,hatchZ-.05],width);
  }
  // The blast came up the stair: its last flights are strewn with broken concrete, and a length of
  // coping has come down and leans on the east wall of one landing.
  for (let k = 0; k < 70; k++) {
    const flight = 14+Math.floor(hash3(k,1,5)*6), tread = Math.floor(hash3(k,2,5)*risers);
    const z = stairBase+flight*flightRun+tread*going+.06+hash3(k,3,5)*.18, x = (hash3(k,4,5)-.5)*2.1;
    const r = .04+hash3(k,5,5)*hash3(k,6,5)*.16, piece = mesh(stone(r,k*1.3+90),rock);
    piece.position.set(x,stairFloor(z)+r*.22,z); piece.rotation.y = hash3(k,7,5)*6;
  }
  {
    const z = landingMid(17), y = 18*flightRise;
    beam([1.02,y,z-.55],[.9,y+1.7,z+.25],.24,concrete);
  }

  // The hatch wall, seen from the top landing: one face with the round opening cut from it.
  scene.add(wallOutline([[-1.2,top],...hatchArc(hatchRadius),[1.2,top],[1.2,stairCeiling(hatchZ)],[-1.2,stairCeiling(hatchZ)]],hatchZ,concrete));
}
if (collapsed) wayOut();
// Per frame: each lamp follows its rhythm, its fitting goes dark with it, and the hanging lamp sways.
// The nearest working lamp is where the tube hum comes from.
function updateWayOut() {
  if (!collapsed) return;
  const t = time.value;
  let nearest = null, distance = Infinity;
  for (const lamp of wayOutLamps) {
    const level = flickerLevel(lamp.mode,lamp.seed,t);
    lamp.level = level;
    lamp.source.strength = level*(lamp.stair ? .62 : .72);
    lamp.fixture.material = level > 0 ? lit : steel;
    const d = lamp.mode === 'dead' ? Infinity : lamp.source.position.distanceTo(camera.position);
    if (d < distance) { nearest = lamp; distance = d; }
  }
  hangingLamp.rotation.x = .06*Math.sin(t*.8)+.02*Math.sin(t*2.3);
  if (audio) updateHum(nearest,distance);
}
