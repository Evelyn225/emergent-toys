// The button's consequence. Nothing says what it does: a beat of quiet, two distant
// detonations, then a blast front that runs the length of the tunnel. The sequence has its own
// clock that only runs while playing, so pausing can never skip ahead.
const fuseBooms = [3,7], frontStart = 10;
const fire = new THREE.Mesh(new THREE.CapsuleGeometry(1,8,8,24),blastMaterial);
fire.visible = false; scene.add(fire);
const yAxis = new THREE.Vector3(0,1,0), frontDirection = new THREE.Vector3(), frontSegment = new THREE.Line3();
const eye = new THREE.Vector3(), nearest = new THREE.Vector3();
const frontAt = t => 7*t+.55*t*t, frontRadius = s => 5+6*sstep(mouthS-2,mouthS+6,s);
const dustCount = 400, dustPositions = new Float32Array(dustCount*3).fill(-1000);
const dustSpeed = new Float32Array(dustCount), dustFloor = new Float32Array(dustCount).fill(1000);
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
const dust = new THREE.Points(dustGeometry,new THREE.PointsMaterial({ color: 0xbfc5bb,size: 2,sizeAttenuation: false }));
dust.frustumCulled = false; scene.add(dust);
let dustNext = 0;
function shed(count) {
  for (let n = 0; n < count; n++) {
    const i = dustNext; dustNext = (dustNext+1)%dustCount;
    dustPositions.set([player.x+(Math.random()-.5)*9,player.y+2.2+Math.random()*2.5,player.z+(Math.random()-.5)*9],i*3);
    dustSpeed[i] = .2+Math.random()*.5; dustFloor[i] = player.y;
  }
}
function updateDust(dt) {
  for (let i = 0; i < dustCount; i++) {
    if (dustPositions[i*3+1] < dustFloor[i]) continue;
    dustSpeed[i] += dt*1.1; dustPositions[i*3+1] -= dustSpeed[i]*dt;
  }
  dustGeometry.attributes.position.needsUpdate = true;
}
function lightsAt(f) {
  // The press browns the lamps out twice. Each rumble sets them flickering; the second leaves them dim.
  if (f < .5) return f > .12 && f < .3 ? .15 : f > .42 ? .35 : 1;
  let level = f >= fuseBooms[1] ? .55 : 1;
  for (const b of fuseBooms) if (f >= b && f < b+.7 && Math.sin((f-b)*60) > 0) level *= .3;
  return level;
}
function rumble(i) {
  shake = Math.max(shake,[.35,.6][i]); shed([90,160][i]); boom([.45,.75][i],pathPoint(0,0,2),['explosion1','explosion2'][i]);
  if (i === 1) { powerCut = true; audioZone = null; }
}
function updateBlast(dt) {
  if (!detonated || ended || !playing) return;
  fuse += dt;
  tunnelPower.value = lightsAt(fuse);
  while (booms < fuseBooms.length && fuse >= fuseBooms[booms]) rumble(booms++);
  updateDust(dt);
  shake *= Math.exp(-dt*2.5);
  if (fuse < frontStart) return;
  frontS = frontAt(fuse-frontStart);
  const r = frontRadius(frontS), { tx,tz } = pathAt(frontS), centre = pathPoint(frontS,0,2);
  frontDirection.set(tx,0,tz);
  fire.visible = true; fire.scale.setScalar(r);
  fire.quaternion.setFromUnitVectors(yAxis,frontDirection);
  fire.position.copy(centre).addScaledVector(frontDirection,-4*r);
  frontSegment.start.copy(centre).addScaledVector(frontDirection,-8*r); frontSegment.end.copy(centre);
  eye.set(player.x,player.y+eyeHeight,player.z);
  const gap = frontSegment.closestPointToPoint(eye,true,nearest).distanceTo(eye)-r;
  blastLight.value.set(centre.x+tx*(r+1.5),centre.y,centre.z+tz*(r+1.5),.3+.9*sstep(0,1.2,fuse-frontStart));
  // Only the last few metres wash the whole view out.
  flash.value = .75*(1-sstep(0,7,gap))**2;
  shake = Math.max(shake,.9*(1-sstep(0,60,gap)));
  updateRoar(gap,nearest);
  if (gap <= 0) endExperience();
}
function endExperience() {
  ended = true; playing = false; resetInput();
  try { localStorage.setItem(collapseKey,'1'); } catch {}
  endScreen.hidden = false; reticle.hidden = true; prompt.textContent = '';
  document.body.classList.remove('playing');
  endSound();
  if (document.pointerLockElement) document.exitPointerLock();
}
