// Sweep the vaulted shell along the intake curve. The very same edges define the walls. Floor
// and vault tiles run along the curve, not the world grid.
const tunnelFrames = [], shellVertices = [], shellTiles = [], shellIndices = [], intakeFixtures = [];
function tiled(obj,coords) {
  obj.geometry.setAttribute('tile',new THREE.Float32BufferAttribute(coords.flatMap(([a,b]) => [a,b,1]),3));
  return obj;
}
for (let i = 0; i <= lengthSegments; i++) {
  const { t,center,right,halfWidth } = intakeFrame(i), along = t*intakeLength, ring = [];
  for (let j = 0; j <= archSegments; j++) {
    const angle = j/archSegments*Math.PI;
    const p = center.clone().addScaledVector(right,-Math.cos(angle)*halfWidth);
    p.y = 1.6+Math.sin(angle)*1.5;
    ring.push([p.x,p.y,p.z]); shellVertices.push(p.x,p.y,p.z); shellTiles.push(along,-Math.cos(angle)*halfWidth,1);
    if (i < lengthSegments && j < archSegments) {
      const k = i*(archSegments+1)+j;
      shellIndices.push(k,k+1,k+archSegments+1,k+1,k+archSegments+2,k+archSegments+1);
    }
  }
  const left = center.clone().addScaledVector(right,-halfWidth), edge = center.clone().addScaledVector(right,halfWidth);
  tunnelFrames.push({ center,right,left,edge,ring,along,halfWidth });
  if (i > 0) {
    const prev = tunnelFrames[i-1];
    tiled(surface([[prev.left.x,0,prev.left.z],[prev.edge.x,0,prev.edge.z],[edge.x,0,edge.z],[left.x,0,left.z]],concrete,true),
      [[prev.along,-prev.halfWidth],[prev.along,prev.halfWidth],[along,halfWidth],[along,-halfWidth]]);
    for (const key of ['left','edge']) {
      const a = prev[key], b = tunnelFrames[i][key];
      surface([[a.x,0,a.z],[b.x,0,b.z],[b.x,1.6,b.z],[a.x,1.6,a.z]]);
      barrier([a.x,a.z],[b.x,b.z],[0,0],[3.2,3.2]);
    }
  }
  if (i%10 === 0) {
    for (let j = 0; j < archSegments; j++) beam(ring[j],ring[j+1],.13);
    for (const p of [left,edge]) beam([p.x,0,p.z],[p.x,1.6,p.z],.13);
  }
  if (intakeBays.includes(i)) {
    for (const side of [-1,1]) {
      const p = intakeWall(i,side,1.4,.06), q = intakeWall(i,side,1.4,.02), heading = Math.atan2(-right.z,right.x);
      const fixture = box(p.x,p.y,p.z,.1,.42,.16,collapsed ? steel : lit);
      fixture.rotation.y = heading; intakeFixtures.push(fixture);
      box(q.x,q.y,q.z,.04,.54,.26,steel).rotation.y = heading;
    }
  }
}
const shellGeom = new THREE.BufferGeometry();
shellGeom.setAttribute('position',new THREE.Float32BufferAttribute(shellVertices,3));
shellGeom.setAttribute('tile',new THREE.Float32BufferAttribute(shellTiles,3));
shellGeom.setIndex(shellIndices); shellGeom.computeVertexNormals(); ceilings.push(mesh(shellGeom));
// The intake's end wall is the reception's front wall, with a steel door in it. The door stays shut
// until the ending; a later visit finds it standing open into the reception.
for (const x of [-3.5,3.5]) box(x,2.4,7.05,5.6,4.8,.2,concrete,true);
box(0,3.52,7.05,1.4,2.56,.2,concrete,true);
// A frame lines the opening and stands proud of both faces. The door hangs on its west jamb and
// closes against the reception side, so the intake sees it set back in the reveal.
for (const x of [-.67,.67]) box(x,1.1,7.05,.14,2.2,.26,steel,true);
box(0,2.24,7.05,1.48,.08,.26,steel);
floor(0,7.075,1.2,.15);
const doorHinge = new THREE.Group();
doorHinge.position.set(-.6,0,7.12); scene.add(doorHinge);
for (const [x,y,z,w,h,d] of [[.6,1.1,0,1.2,2.18,.06],[.6,1.62,-.04,.9,.82,.02],[.6,.56,-.04,.9,.82,.02],
  [.6,1.62,.04,.9,.82,.02],[.6,.56,.04,.9,.82,.02],[1.04,1.02,-.07,.05,.05,.08],[.94,1.02,-.11,.24,.035,.035]]) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),steel);
  part.position.set(x,y,z); doorHinge.add(part);
}
if (collapsed) {
  doorHinge.rotation.y = -1.75;
  const reach = new THREE.Vector3(1.2,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),-1.75);
  barrier([-.6,7.12],[-.6+reach.x,7.12+reach.z],[0,0],[2.2,2.2],.05);
} else {
  barriers.push({ box: new THREE.Box3(new THREE.Vector3(-.6,0,7.05),new THREE.Vector3(.6,2.2,7.18)) });
  interactables.push({ position: new THREE.Vector3(.38,1.02,7.01),text: () => 'E / TRY THE DOOR',
    use() { message('IT WILL NOT OPEN'); press(this.position,.6); } });
}
label('RESERVOIR →',10,1.65,-24,Math.PI/2,1.4);
