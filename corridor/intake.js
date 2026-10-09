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
box(0,1.7,7.05,4.1,3.4,.2,concrete,true);
label('INTAKE',0,1.7,6.93,Math.PI,2.2);
label('RESERVOIR →',10,1.65,-24,Math.PI/2,1.4);
