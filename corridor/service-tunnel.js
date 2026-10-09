function serviceTunnel() {
  // The lined service run: tiled to the twenty-metre mark, bare concrete to the end of the lining.
  const line = (u,v,from = 0,to = liningEnd) => Array.from({ length: to-from+1 },(_,i) => pathPoint(from+i,u,v));
  slab(-20,-59.15,3,.3,hubFloor);
  strip(line(-1.5,0,0,20),line(1.5,0,0,20),pale,true);
  strip(line(-1.5,0,20),line(1.5,0,20),concrete,true);
  for (const u of [-1.5,1.5]) {
    strip(line(u,0),line(u,3));
    barrier([-20+u,-59.3],[-20+u,-59.3-liningEnd],[pathFloor(0)-1,pathFloor(liningEnd)-1],[pathFloor(0)+4,pathFloor(liningEnd)+4]);
  }
  strip(line(-1.5,3),line(1.5,3),steel,false,true);
  const slope = s => Math.atan((pathFloor(s+.01)-pathFloor(s-.01))/.02);
  for (const s of liningLamps) {
    const fixture = box(...pathPoint(s,0,2.97).toArray(),.3,.06,.9,lit), housing = box(...pathPoint(s,0,2.94).toArray(),.42,.03,1.02,steel);
    fixture.rotation.x = housing.rotation.x = slope(s);
  }
  // Ceiling pipes run on past the lining and stop, capped, in the rock.
  for (const [u,r] of [[-.55,.07],[-.85,.05]]) {
    // Each pipe drops out of the ceiling just inside the doorway, clear of the shutter.
    const points = [pathPoint(.3,u,3.1),...Array.from({ length: 31 },(_,i) => pathPoint(1+i,u,2.78)),pathPoint(30.8,u,2.78)];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),124,r,8),steel);
    const cap = mesh(new THREE.CylinderGeometry(r+.03,r+.03,.06,10),steel);
    cap.position.copy(points[points.length-1]); cap.rotation.x = Math.PI/2+slope(30.8);
  }
  for (let s = 2; s < liningEnd; s += 4) beam(pathPoint(s,-.7,2.68).toArray(),pathPoint(s,-.7,3).toArray(),.05);
  // A cable tray on the right wall carries the power cable out of the lining. It starts clear
  // of the shutter with a closed end, where the cable drops into it from the ceiling.
  const tray = (u,v) => [pathPoint(.3,u,v),...line(u,v,1)];
  strip(tray(1.2,2.35),tray(1.5,2.35),steel);
  strip(tray(1.2,2.35),tray(1.2,2.47),steel);
  surface([[1.2,2.35],[1.5,2.35],[1.5,2.47],[1.2,2.47]].map(([u,v]) => pathPoint(.3,u,v).toArray()),steel);
  for (let s = 1.5; s < liningEnd; s += 3) beam(pathPoint(s,1.22,2.34).toArray(),pathPoint(s,1.5,2.1).toArray(),.04);

  // Beyond the lining, one rock shell that widens into the domed chamber and closes behind it.
  const samples = [];
  for (let s = liningEnd; s < roomS; s += .5) samples.push(s);
  for (let i = 0; i <= 24; i++) samples.push(roomS+roomRadius*Math.sin(i/24*Math.PI/2));
  const rings = samples.map(rockRing), shell = [], at = p => new THREE.Vector3(p.x,p.y,p.z);
  for (let i = 0; i < rings.length-1; i++) {
    const r0 = rings[i], r1 = rings[i+1];
    for (let j = 0; j < rockSegments; j++) {
      for (const p of [r0[j],r0[j+1],r1[j+1],r0[j],r1[j+1],r1[j]]) shell.push(p.x,p.y,p.z);
    }
  }
  const shellGeom = new THREE.BufferGeometry();
  shellGeom.setAttribute('position',new THREE.Float32BufferAttribute(shell,3));
  shellGeom.computeVertexNormals(); ceilings.push(mesh(shellGeom,rock));
  strip(rings.map(r => at(r[0])),rings.map(r => at(r[rockSegments])),rock,true);
  // Collision follows the innermost rock below head height on each side.
  const innermost = (ring,from,to) => ring.slice(from,to+1).filter(p => p.v < 1.95).reduce((a,b) => Math.abs(b.u) < Math.abs(a.u) ? b : a);
  for (let i = 0; i < rings.length-1; i++) {
    const y0 = pathFloor(samples[i]), y1 = pathFloor(samples[i+1]);
    for (const [from,to] of [[0,rockSegments/2],[rockSegments/2,rockSegments]]) {
      const a = innermost(rings[i],from,to), b = innermost(rings[i+1],from,to);
      barrier([a.x,a.z],[b.x,b.z],[y0-1,y1-1],[y0+4,y1+4]);
    }
  }
  // The lining's end face closes the step from the concrete box out to the rock.
  const face = [...rings[0].map(p => new THREE.Vector2(p.u,p.v)),
    new THREE.Vector2(1.5,0),new THREE.Vector2(1.5,3),new THREE.Vector2(-1.5,3),new THREE.Vector2(-1.5,0)];
  const faceVertices = [];
  for (const triangle of THREE.ShapeUtils.triangulateShape(face,[])) {
    for (const k of triangle) faceVertices.push(...pathPoint(liningEnd,face[k].x,face[k].y).toArray());
  }
  const faceGeom = new THREE.BufferGeometry();
  faceGeom.setAttribute('position',new THREE.Float32BufferAttribute(faceVertices,3));
  faceGeom.computeVertexNormals(); mesh(faceGeom);
  for (const p of [rings[0][0],rings[0][rockSegments]]) {
    const q = pathPoint(liningEnd,Math.sign(p.u)*1.5,0);
    barrier([q.x,q.z],[p.x,p.z],[q.y-1,q.y-1],[q.y+4,q.y+4]);
  }

  // The power cable leaves the tray, hangs from hooks along the outer wall, and runs to the pedestal.
  const cable = [pathPoint(.42,1.34,3.05),pathPoint(.5,1.34,2.6),pathPoint(.9,1.32,2.43),...line(1.32,2.42,2,liningEnd-1)], hookSpacing = 3;
  samples.forEach((s,i) => {
    if (s > mouthS) return;
    const along = (s-liningEnd)%hookSpacing, w = wallPoint(rings[i],2.45-.22*Math.sin(Math.PI*along/hookSpacing),.15);
    cable.push(pathPoint(s,w.u,w.v));
    if (along === 0 && s > liningEnd) box(...pathPoint(s,wallPoint(rings[i],2.45,.05).u,2.45).toArray(),.08,.06,.08,steel);
  });
  const drop = samples.filter(s => s <= mouthS).pop(), dropRing = rings[samples.indexOf(drop)];
  for (const v of [2,1.5,1,.5]) { const w = wallPoint(dropRing,v,.15); cable.push(pathPoint(drop,w.u,w.v)); }
  // At the foot of the wall it turns along the floor and crosses the chamber with a little slack,
  // then climbs the plinth into a gland on the pedestal's column.
  const footU = dropRing[rockSegments].u-.25, from = drop+.4, run = roomS-.75-from;
  cable.push(pathPoint(drop+.1,footU+.07,.15));
  for (let k = 0; k <= 16; k++) {
    const t = k/16;
    cable.push(pathPoint(from+run*t,footU*(1-sstep(0,1,t))+.22*Math.sin(t*Math.PI*2.5)*Math.sin(t*Math.PI),.035));
  }
  cable.push(pathPoint(roomS-.52,0,.06),pathPoint(roomS-.45,0,.16),pathPoint(roomS-.34,0,.18),pathPoint(roomS-.28,0,.3),pathPoint(roomS-.28,0,.42));
  box(...pathPoint(roomS-.285,0,.44).toArray(),.07,.14,.16,steel);
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cable),cable.length*4,.032,6),steel);
  for (const s of cableLamps) {
    const lamp = cableLamp(s), top = pathPoint(s,wallPoint(rockRing(s),2.45,.15).u,2.45);
    beam(top.toArray(),[lamp.x,lamp.y+.1,lamp.z],.015);
    box(lamp.x,lamp.y+.12,lamp.z,.2,.05,.2,steel);
    box(lamp.x,lamp.y,lamp.z,.14,.18,.14,lit);
  }

  // Fallen rock along the natural tunnel and the chamber walls, and stalactites in the dome.
  for (const [s,u,r] of [[47,-1.6,.35],[60,-1.9,.45],[67,2,.35],[71,-2.1,.5],[roomS+6.5,-2.5,.9],[roomS+4.5,5.4,1.1],
    [roomS+1.5,-7,.8],[roomS-2.5,7.1,.7],[roomS-5,-5.4,1],[roomS-1,7.6,.5]]) {
    const centre = pathPoint(s,u,r*.3), boulder = mesh(stone(r,s),rock);
    boulder.position.copy(centre); boulder.rotation.y = s;
    // A round footprint: a box's corners would stop walkers short of the visible rock.
    barrier([centre.x-.001,centre.z],[centre.x+.001,centre.z],[centre.y-1,centre.y-1],[centre.y+r*.7,centre.y+r*.7],r*.85);
  }
  for (let k = 0; k < 18; k++) {
    const s = roomS-6+13*hash3(k,1,0), i = samples.findIndex(sample => sample >= s), j = 9+Math.floor(14*hash3(k,2,0));
    const tip = rings[i][j], length = .6+1.4*hash3(k,3,0);
    if (tip.v < 5) continue;
    const spike = mesh(new THREE.ConeGeometry(.18+.25*hash3(k,4,0),length+.2,6),rock);
    spike.position.set(tip.x,tip.y-length/2+.1,tip.z); spike.rotation.x = Math.PI;
  }

  // The chamber: three work lights on tripods aimed at a pedestal with the only red thing in the place.
  const centre = pathPoint(roomS,0,0);
  for (const a of tripodAngles) {
    const [s,u] = tripodAt(a), foot = pathPoint(s,u,0), head = pathPoint(s,u,2.25), hub = pathPoint(s,u,1.3);
    for (let k = 0; k < 3; k++) {
      const leg = k*Math.PI*2/3+a;
      beam([foot.x+Math.cos(leg)*.5,foot.y,foot.z+Math.sin(leg)*.5],hub.toArray(),.04);
    }
    beam(hub.toArray(),[head.x,head.y-.12,head.z],.05);
    const facing = Math.atan2(centre.x-head.x,centre.z-head.z);
    const body = box(head.x,head.y,head.z,.42,.3,.22,steel), lens = box(head.x,head.y,head.z,.34,.22,.02,lit);
    body.rotation.y = lens.rotation.y = facing;
    lens.position.x += Math.sin(facing)*.12; lens.position.z += Math.cos(facing)*.12;
    barriers.push({ box: new THREE.Box3(new THREE.Vector3(foot.x-.55,foot.y,foot.z-.55),new THREE.Vector3(foot.x+.55,foot.y+2.4,foot.z+.55)) });
  }
  box(centre.x,centre.y+.06,centre.z,.9,.12,.9,steel);
  box(centre.x,centre.y+.57,centre.z,.5,.9,.5);
  box(centre.x,centre.y+1.05,centre.z,.64,.06,.64,pale);
  const housing = mesh(new THREE.CylinderGeometry(.14,.14,.04,24),steel);
  housing.position.set(centre.x,centre.y+1.1,centre.z);
  redButton = mesh(new THREE.CylinderGeometry(.09,.09,.07,24),red);
  redButton.position.set(centre.x,centre.y+1.155,centre.z); redButton.userData.dynamic = true;
  barriers.push({ box: new THREE.Box3(new THREE.Vector3(centre.x-.45,centre.y,centre.z-.45),new THREE.Vector3(centre.x+.45,centre.y+1.2,centre.z+.45)) });
  interactables.push({ position: new THREE.Vector3(centre.x,centre.y+1.19,centre.z),available: () => !detonated,
    text: () => 'E / PRESS',
    use() { detonated = true; redButton.position.y -= .035; press(this.position,.85); } });
}
