function updatePlace() {
  zone = 'bend';
  if (player.z < -56.8) zone = 'ascent';
  else if (player.z < -27) zone = 'reservoir';
  if (player.y > 8) zone = 'overlook';
  if (player.x < 0) {
    zone = player.z < -59.3 && player.y > -10 ? (player.z > -59.3-liningEnd ? 'service' : 'cave')
      : player.x < -61.3 ? 'control' : player.x < -35.05 ? 'sump' : player.x < -30.95 ? 'shaft'
      : player.z > storePlan.z0 ? 'store' : 'lowerWorks';
  }
  const level = Math.round(player.y*10)/10;
  altitude.firstChild.textContent = 'LEVEL ' + (level < 0 ? '-' : '+') + Math.abs(level).toFixed(1).padStart(4,'0') + ' M';
  if (audio && (audioZone !== zone || audioPump !== pumpOn)) {
    if (audioZone !== zone) setRoom(zone);
    audioZone = zone;
    audioPump = pumpOn;
    audio.noiseGain.gain.setTargetAtTime({ reservoir: .15, sump: .1, cave: .08 }[zone] ?? .04,audio.ctx.currentTime,.4);
    // The facility's hum dies with its power.
    audio.humGain.gain.setTargetAtTime(pumpOn && !powerCut ? .2 : 0,audio.ctx.currentTime,.4);
    if (audio.bedsReady) updateBeds();
  }
}
const viewDirection = new THREE.Vector3(), targetDirection = new THREE.Vector3();
function updateInteraction() {
  active = null; camera.getWorldDirection(viewDirection);
  for (const item of interactables) {
    if (item.available && !item.available()) continue;
    targetDirection.copy(item.position).sub(camera.position);
    if (targetDirection.length() < 2.4 && targetDirection.normalize().dot(viewDirection) > .65) { active = item; break; }
  }
  if (time.value > messageUntil) prompt.textContent = playing && active ? active.text() : '';
}
function updateCamera() {
  camera.position.set(player.x,player.y+eyeHeight,player.z);
  camera.rotation.set(pitch,yaw,0,'YXZ');
  if (shake > .002) {
    const t = time.value, amount = shake*.045;
    camera.position.x += Math.sin(t*37.3)*amount; camera.position.y += Math.sin(t*43.1+1.3)*amount; camera.position.z += Math.sin(t*31.7+2.1)*amount;
    camera.rotation.z = Math.sin(t*27.9)*shake*.01;
  }
  camera.updateMatrixWorld();
  packLamps();
}
const ease = t => t*t*(3-2*t);
function liftHeight() { return liftLevels[0]+(liftLevels[1]-liftLevels[0])*ease(liftPos); }
function updateLift(dt) {
  const docked = liftPos === liftTarget;
  for (const gate of liftGates) {
    // Like a door sensor, a closing gate reopens for anyone standing in it, or on the end of the car beside it.
    const inDoorway = Math.abs(player.x-gate.x) < radius+.26 && Math.abs(player.y-gate.level) < .5;
    const opening = (docked && liftLevels[liftPos] === gate.level) || (gate.open > 0 && inDoorway);
    gate.open = Math.max(0,Math.min(1,gate.open+(opening ? dt : -dt)/.9));
    gate.group.position.y = 3*ease(gate.open);
  }
  const fromY = liftHeight();
  // The car departs only once both gates are shut, and stops exactly at its landing.
  if (!docked && liftGates.every(gate => gate.open === 0)) {
    const step = dt/liftTravel;
    if (Math.abs(liftTarget-liftPos) <= step) liftPos = liftTarget;
    else liftPos += Math.sign(liftTarget-liftPos)*step;
  }
  const y = liftHeight();
  const onCar = player.x < -31 && player.x > -35 && player.z < -48 && player.z > -52 && Math.abs(player.y-fromY) < .01;
  if (onCar && y !== fromY) player.y = y;
  liftCar.position.y = y; liftCar.updateMatrixWorld(true);
  for (const rail of liftRails) { rail.bottom.fill(y); rail.top.fill(y+1); }
  liftControl.set(-32.4,y+1.18,-48.3);
  carLamp.value.set(-33,y+2.9,-50);
  const weightY = -22-y;
  liftCounterweight.position.y = weightY;
  carCable.position.y = (y+3.3+sheaveY)/2; carCable.scale.y = sheaveY-y-3.3;
  weightCable.position.y = (weightY+.8+sheaveY)/2; weightCable.scale.y = sheaveY-weightY-.8;
  liftSheave.rotation.x = (y-liftLevels[0])/sheaveRadius;
}
function updateDoors(dt) {
  for (const door of [northShutter,southShutter]) {
    if (door.released && door.open === 0) shutterRolls(door.at);
    if (door.released) door.open = Math.min(1,door.open+dt/2.4);
    // Rise past the soffit so the raised plate never shares the lintel's underside.
    door.group.position.y = 3.1*ease(door.open);
  }
  if (hatchTime === null) return;
  // The wheel spins two turns, then the hatch swings into the control room.
  const age = time.value-hatchTime, spin = Math.min(1,age/1.4), swing = Math.min(1,Math.max(0,(age-1.4)/1.6));
  const angle = ease(swing)*Math.PI/2;
  hatch.wheel.rotation.x = ease(spin)*Math.PI*4;
  hatch.pivot.rotation.y = angle;
  hatch.barrier.b = [hatch.hinge[0]-Math.sin(angle)*hatch.reach,hatch.hinge[1]-Math.cos(angle)*hatch.reach];
  if (swing > 0 && !hatch.heard) { hatch.heard = true; hatchSwings(hatch.wheel.getWorldPosition(soundAt)); }
  if (swing === 1 && !hatchOpen) { hatchOpen = true; changeLabel(bulkheadSign,'CONTROL'); }
}
function update(dt) {
  time.value += dt;
  if (playing) {
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp'))-Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const side = Number(keys.has('KeyD') || keys.has('ArrowRight'))-Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    if (forward || side) {
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.6 : 2.8;
      const scale = speed*dt/Math.hypot(forward,side);
      const dx = (side*Math.cos(yaw)-forward*Math.sin(yaw))*scale;
      const dz = (-forward*Math.cos(yaw)-side*Math.sin(yaw))*scale;
      const oldX = player.x, oldZ = player.z;
      move(dx,dz);
      walked += Math.hypot(player.x-oldX,player.z-oldZ);
      if (walked > 1.65) {
        walked %= 1.65;
        footstep();
      }
    }
  }
  const waterTarget = pumpOn ? -1.6 : 0;
  water.position.y += (waterTarget-water.position.y)*Math.min(1,dt*.8);
  const waterMoving = Math.abs(waterTarget-water.position.y) > .01;
  if (waterMoving) pumpRotor.rotation.z -= dt*5;
  else water.position.y = waterTarget;
  pumpWheel.rotation.z += ((pumpOn ? -Math.PI*1.2 : 0)-pumpWheel.rotation.z)*Math.min(1,dt*3);
  descentGate.rotation.y += ((descentReleased ? Math.PI/2 : 0)-descentGate.rotation.y)*Math.min(1,dt*3);
  updateLift(dt);
  updateDoors(dt);
  updateBlast(dt);
  updateCollapse(dt);
  updateCamera();
  updatePlace();
  updateInteraction();
  const liftTravelling = liftPos !== liftTarget && liftGates.every(gate => gate.open === 0);
  updateSound(Math.abs(waterTarget-water.position.y),liftTravelling ? Math.abs(liftTarget-liftPos)*liftTravel : null,liftHeight());
}
updateCamera(); updatePlace(); enter.disabled = false; enterLabel.textContent = 'ENTER THE SUBSTRUCTURE';
window.addEventListener('resize',() => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
