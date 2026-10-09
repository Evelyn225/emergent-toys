function mesh(geometry, mat = concrete) {
  const obj = new THREE.Mesh(geometry, mat); scene.add(obj); return obj;
}
function box(x, y, z, w, h, d, mat = concrete, solid = false) {
  const obj = mesh(new THREE.BoxGeometry(w, h, d), mat);
  obj.position.set(x, y, z);
  if (solid) barriers.push({ box: new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2), new THREE.Vector3(x+w/2,y+h/2,z+d/2)) });
  return obj;
}
function surface(points, mat = concrete, walkable = false, overhead = false) {
  const vertices = [], indices = [];
  for (const p of points) vertices.push(...p);
  for (let i = 1; i < points.length-1; i++) indices.push(0,i,i+1);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geom.setIndex(indices); geom.computeVertexNormals();
  const obj = mesh(geom,mat);
  if (walkable) floors.push(obj);
  if (overhead) ceilings.push(obj);
  return obj;
}
function floor(x,z,w,d,y = 0,mat = concrete) {
  return surface([[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],[x-w/2,y,z-d/2]],mat,true);
}
// Decks, treads, and the lift car ring as metal underfoot; other floors go by their material.
function metal(obj) { obj.userData.surface = 'metal'; return obj; }
// A rough stone: a lumpy, flattened icosahedron. The seed varies the lumps.
function stone(r,seed) {
  const geom = new THREE.IcosahedronGeometry(r,1), position = geom.attributes.position, p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position,i);
    p.multiplyScalar(1+.3*rockNoise(p.x*3/r+seed,p.y*3/r,p.z*3/r)); p.y *= .7;
    position.setXYZ(i,p.x,p.y,p.z);
  }
  geom.computeVertexNormals();
  return geom;
}
function slab(x,z,w,d,y = 0,mat = concrete,depth = .22) {
  const obj = box(x,y-depth/2,z,w,depth,d,mat);
  floors.push(obj);
  return obj;
}
function reservoirRoofY(x) {
  return 6+7*Math.sqrt(Math.max(0,1-((x-12)/12)**2));
}
const reservoirArchAngles = [
  ...Array.from({ length: 129 },(_,i) => i/128*Math.PI),
  ...[3,4.6,19.4,21].map(x => Math.acos((12-x)/12)),
].sort((a,b) => a-b);
const reservoirArch = reservoirArchAngles.map(angle => ({
  x: 12-12*Math.cos(angle), y: 6+7*Math.sin(angle),
  normal: new THREE.Vector3(-Math.cos(angle)/12,Math.sin(angle)/7,0).normalize().toArray(),
}));
function suspension(x,z,bottom,top) {
  beam([x,bottom,z],[x,top,z],.07);
  box(x,top-.035,z,.22,.07,.22,steel);
}
function beam(a,b,width = .08,mat = steel) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const obj = mesh(new THREE.BoxGeometry(width,start.distanceTo(end),width),mat);
  obj.position.copy(start).add(end).multiplyScalar(.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
  return obj;
}
function barrier(a,b,bottom,top,thickness = .05) { barriers.push({ a,b,bottom,top,thickness }); }
function rail(a,b,width = .065) {
  beam([a[0],a[1]+.9,a[2]],[b[0],b[1]+.9,b[2]],width);
  beam([a[0],a[1]+.4,a[2]],[b[0],b[1]+.4,b[2]],width*.7);
  const count = Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2.6);
  for (let i = 0; i <= count; i++) {
    const t = i/count, x = a[0]+(b[0]-a[0])*t, y = a[1]+(b[1]-a[1])*t, z = a[2]+(b[2]-a[2])*t;
    beam([x,y,z],[x,y+.94,z],width);
  }
  barrier([a[0],a[2]],[b[0],b[2]],[a[1],b[1]],[a[1]+1,b[1]+1],width/2);
}
function label(text,x,y,z,rotation = 0,width = 1.5) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdd4c8'; ctx.fillRect(0,0,512,160); ctx.fillStyle = '#19211d';
  // Long text shrinks to fit the plate rather than running off it.
  ctx.font = 'bold 54px ISOCPEUR, monospace';
  ctx.font = 'bold ' + Math.min(54,Math.floor(54*472/ctx.measureText(text).width)) + 'px ISOCPEUR, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,256,82);
  const obj = mesh(new THREE.PlaneGeometry(width,width*160/512),new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide }));
  obj.position.set(x,y,z); obj.rotation.y = rotation; return obj;
}
function changeLabel(obj,text) {
  const canvas = obj.material.map.image, ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdd4c8'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#19211d'; ctx.fillText(text,256,82);
  obj.material.map.needsUpdate = true;
}
function ramp(a,b,width = 2.4,anchorWall = null) {
  const dx = b[0]-a[0], dz = b[2]-a[2], length = Math.hypot(dx,dz);
  const ox = -dz/length*width/2, oz = dx/length*width/2;
  metal(surface([[a[0]+ox,a[1],a[2]+oz],[a[0]-ox,a[1],a[2]-oz],
    [b[0]-ox,b[1],b[2]-oz],[b[0]+ox,b[1],b[2]+oz]],pale,true));
  for (const side of [-1,1]) {
    const p = [a[0]+ox*side,a[1],a[2]+oz*side], q = [b[0]+ox*side,b[1],b[2]+oz*side];
    const railOffset = (width/2-.1)/(width/2);
    const railStart = [a[0]+ox*side*railOffset,a[1],a[2]+oz*side*railOffset];
    const railEnd = [b[0]+ox*side*railOffset,b[1],b[2]+oz*side*railOffset];
    if (anchorWall !== null && side === -1) {
      beam([railEnd[0],railEnd[1]+.9,railEnd[2]],[anchorWall,railEnd[1]+.9,railEnd[2]],.065);
    }
    rail(railStart,railEnd);
    surface([p,q,[q[0],q[1]-.22,q[2]],[p[0],p[1]-.22,p[2]]],steel);
  }
  const corners = [[a[0]+ox,a[1],a[2]+oz],[a[0]-ox,a[1],a[2]-oz],
    [b[0]-ox,b[1],b[2]-oz],[b[0]+ox,b[1],b[2]+oz]];
  surface(corners.map(p => [p[0],p[1]-.22,p[2]]),steel,false,true);
  for (const [i,j] of [[0,1],[2,3]]) {
    const p = corners[i], q = corners[j];
    surface([p,q,[q[0],q[1]-.22,q[2]],[p[0],p[1]-.22,p[2]]],steel);
  }
  rampJoins.push({ a,b,width });
  // Brackets carry each ramp back to the nearest chamber wall.
  for (let i = 1; i < 4; i++) {
    const t = i/4, x = a[0]+dx*t, y = a[1]+(b[1]-a[1])*t-.22, z = a[2]+dz*t;
    let anchor;
    if (anchorWall !== null) anchor = [anchorWall,y,z];
    else if (Math.abs(dx) > Math.abs(dz)) anchor = [x,y,-82];
    else anchor = [x < 12 ? 3 : 21,y,z];
    beam([x,y,z],anchor,.16);
    beam([x,y,z],[anchor[0],y-.7,anchor[2]],.12);
  }
  // Transverse strips articulate the slope without introducing tiny collision steps.
  for (let i = 1; i < length/.8; i++) {
    const t = i/(length/.8), x = a[0]+dx*t, y = a[1]+(b[1]-a[1])*t+.008, z = a[2]+dz*t;
    beam([x+ox,y,z+oz],[x-ox,y,z-oz],.025);
  }
}
// Quads between two matching polylines, as one mesh.
function strip(a,b,mat = concrete,walkable = false,overhead = false) {
  const vertices = [], indices = [], k = a.length;
  for (const p of [...a,...b]) vertices.push(p.x,p.y,p.z);
  for (let i = 0; i < k-1; i++) indices.push(i,i+1,k+i+1,i,k+i+1,k+i);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geom.setIndex(indices); geom.computeVertexNormals();
  const obj = mesh(geom,mat);
  if (walkable) floors.push(obj);
  if (overhead) ceilings.push(obj);
  return obj;
}
