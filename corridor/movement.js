// Floors are raycast directly. Walls use footprints, including sloped rails.
const down = new THREE.Vector3(0,-1,0), up = new THREE.Vector3(0,1,0);
const ray = new THREE.Raycaster(), rayOrigin = new THREE.Vector3(), hits = [], ceilingHits = [];
const overheadSurfaces = [...ceilings,...floors];
// The floor last stood on, for footsteps.
let ground = null, floorHit = null;
function floorHeight(x,z,currentY) {
  rayOrigin.set(x,currentY+stepHeight+.02,z);
  ray.set(rayOrigin,down);
  ray.far = stepHeight+.42;
  hits.length = 0;
  ray.intersectObjects(floors,false,hits);
  let y = hits.length ? hits[0].point.y : -Infinity, hit = hits.length ? hits[0].object : null;
  // On the surface the ground is a height function rather than a mesh.
  const ground = groundHeight(x,z);
  if (ground !== null && ground <= rayOrigin.y && ground > y) { y = ground; hit = terrainFloor; }
  if (y < currentY-.3 || y > currentY+stepHeight+.005) return null;
  floorHit = hit;
  return y;
}
function blocked(x,z,y) {
  if (outsideBlocked(x,z,y)) return true;
  for (const wall of barriers) {
    if (wall.enabled && !wall.enabled()) continue;
    if (wall.box) {
      const b = wall.box;
      if (y+.08 >= b.max.y || y+eyeHeight <= b.min.y) continue;
      const nx = Math.max(b.min.x,Math.min(x,b.max.x)), nz = Math.max(b.min.z,Math.min(z,b.max.z));
      if ((x-nx)**2+(z-nz)**2 < radius**2) return true;
    } else {
      const dx = wall.b[0]-wall.a[0], dz = wall.b[1]-wall.a[1];
      const t = Math.max(0,Math.min(1,((x-wall.a[0])*dx+(z-wall.a[1])*dz)/(dx*dx+dz*dz)));
      const bottom = wall.bottom[0]+(wall.bottom[1]-wall.bottom[0])*t, top = wall.top[0]+(wall.top[1]-wall.top[0])*t;
      if (y+.08 >= top || y+eyeHeight <= bottom) continue;
      const nx = wall.a[0]+dx*t, nz = wall.a[1]+dz*t;
      if ((x-nx)**2+(z-nz)**2 < (radius+wall.thickness)**2) return true;
    }
  }
  rayOrigin.set(x,y+.05,z);
  ray.set(rayOrigin,up);
  ray.far = eyeHeight+.08;
  ceilingHits.length = 0;
  ray.intersectObjects(overheadSurfaces,false,ceilingHits);
  return ceilingHits.length > 0;
}
let stepEase = 0;
// A small hop changes the eye height while the feet keep following the existing route and rails.
let jumpOffset = 0, jumpVelocity = 0;
function jump() {
  if (!playing || ended || jumpOffset > 0 || jumpVelocity > 0) return;
  jumpVelocity = 2.4;
}
function updateJump(dt) {
  if (!playing || dt <= 0 || jumpOffset === 0 && jumpVelocity === 0) return;
  jumpOffset += jumpVelocity*dt-6*dt*dt;
  jumpVelocity -= 12*dt;
  rayOrigin.set(player.x,player.y+.05,player.z); ray.set(rayOrigin,up); ray.far = eyeHeight+stepEase+Math.max(0,jumpOffset)+.08;
  ceilingHits.length = 0; ray.intersectObjects(overheadSurfaces,false,ceilingHits);
  if (ceilingHits.length) {
    const clearance = Math.max(0,ceilingHits[0].distance+.05-eyeHeight-stepEase-.08);
    if (jumpOffset > clearance) { jumpOffset = clearance; jumpVelocity = Math.min(0,jumpVelocity); }
  }
  if (jumpOffset <= 0) { jumpOffset = 0; jumpVelocity = 0; footstep(); }
}
function tryMove(x,z) {
  const y = floorHeight(x,z,player.y);
  if (y === null || blocked(x,z,y)) return false;
  // Stop a descent at the waterline, but always allow a walker to climb out.
  // The flooded hallway west of the basin shares the reservoir's level.
  const inReservoir = x >= -9 && x <= 24 && z < -27 && z > -57;
  if (inReservoir && y < -1.7+water.position.y+.05 && y < player.y-.001) return false;
  // A step up or down eases the eye through it rather than snapping it; slopes are left alone.
  if (Math.abs(y-player.y) > .05) stepEase = Math.max(-.45,Math.min(.45,stepEase-(y-player.y)));
  player.set(x,y,z); ground = floorHit;
  return true;
}
function move(dx,dz) {
  const steps = Math.max(1,Math.ceil(Math.hypot(dx,dz)/.07));
  const sx = dx/steps, sz = dz/steps;
  for (let i = 0; i < steps; i++) {
    if (!tryMove(player.x+sx,player.z+sz)) {
      tryMove(player.x+sx,player.z);
      tryMove(player.x,player.z+sz);
    }
  }
}
