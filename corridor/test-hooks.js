// Opt-in gameplay inspection; normal visits do not expose these hooks.
if (new URLSearchParams(location.search).has('test')) window.corridorTest = {
  player,tunnelFrames,move,blocked,floorHeight,update,keys,pause,rampJoins,look,settings,
  setPosition(x,y,z) { player.set(x,y,z); stepEase = 0; updateCamera(); updatePlace(); },
  setLook(y,p = 0) { yaw = y; pitch = p; updateCamera(); updateInteraction(); },
  lookAt(x,y,z) {
    const dx = x-player.x, dy = y-player.y-eyeHeight, dz = z-player.z;
    this.setLook(Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));
  },
  setPlaying(value) { playing = value; },
  remnants: () => remnantProps,
  floorLayersAt(x,y,z) {
    rayOrigin.set(x,y+.4,z); ray.set(rayOrigin,down); ray.far = .8;
    hits.length = 0; ray.intersectObjects(floors,false,hits);
    return [...new Set(hits.map(hit => hit.object.id))];
  },
  renderedHits(origin,direction,far) {
    scene.updateMatrixWorld(true);
    const probe = new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize(),0,far);
    return probe.intersectObjects(scene.children,true).map(hit => ({
      objectId: hit.object.id, distance: hit.distance,
      point: hit.point.toArray(), normal: hit.face.normal.toArray(),
    }));
  },
  getState() { return {
    x:player.x,y:player.y,z:player.z,eyeY: camera.position.y,yaw,pitch,playing,zone,pumpOn,descentReleased,
    waterY: -1.7+water.position.y, pumpRotation: pumpRotor.rotation.z, descentCapY: descentCap.position.y, descentCapLit: descentCap.material === lit,
    gateAngle: descentGate.rotation.y,
    liftPos,liftTarget,liftY: liftHeight(),liftGates: liftGates.map(gate => gate.open),
    altitude: altitude.firstChild.textContent,
    hatchAngle: hatch.pivot.rotation.y,wheelAngle: hatch.wheel.rotation.x,hatchOpen,
    northOpen: northShutter.open,southOpen: southShutter.open,keyTaken,hasKey,southUnlocked,carrying: !carry.hidden,
    detonated,fuse,frontS,ended,ending: !endScreen.hidden,veil: !veil.hidden,tunnelPower: tunnelPower.value,flash: flash.value,
    buttonPaint: red.uniforms.paint.value.toArray(),buttonMaterial: redButton.material === red,
    audio: audio ? audio.ctx.state : null,roaring: !!roar,collapsed,stepSurface: stepSurface(),
    room: audio ? audioZone : null,samples: audio ? Object.keys(audio.samples).sort() : [],
    waterLevel: audio && audio.water ? audio.waterLevel : 0,motorLevel: audio ? audio.motorLevel : 0,lastStep: audio ? audio.lastStep : null,
    liftTrip: audio ? audio.liftTrip : null,music: !!(audio && audio.music),beds: audio ? Object.keys(audio.beds).sort() : [],
    powerCut,blastLight: blastLight.value.toArray(),
    listener: audio && audio.ctx.listener.positionX ? [audio.ctx.listener.positionX.value,audio.ctx.listener.positionY.value,audio.ctx.listener.positionZ.value] : null,
    meshes:scene.children.length,floors:floors.length,
  }; },
  // The material of the first rendered surface along a ray.
  materialHit(origin,direction,far) {
    const hit = this.renderedHitObjects(origin,direction,far)[0];
    if (!hit) return null;
    return Object.entries({ concrete,steel,pale,lit,rock,red }).find(([,mat]) => mat === hit.object.material)?.[0] ?? 'other';
  },
  renderedHitObjects(origin,direction,far) {
    scene.updateMatrixWorld(true);
    return new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize(),0,far).intersectObjects(scene.children,true);
  },
  render() { updateCamera(); renderer.render(scene,camera); },
  service: { roomS,mouthS,liningEnd,bendEnd,point: (s,u,v) => pathPoint(s,u,v).toArray(),fireId: fire.id },
  wayOut: { receptionEnd,stairBase,flights,flightRun,flightRise,hatchZ,bunkerFront,bunkerBack,surfaceY,meadow,stairFloor,stairCeiling,
    ground: groundHeight,outdoors: () => outdoors.visible,far: () => camera.far,lamps: () => wayOutLamps.map(lamp => ({ mode: lamp.mode,level: lamp.level })),
    grassBounds,cityAt,valley,
    flowers: () => outdoors.children.filter(part => part.name.startsWith('flower-')),
    title: () => skyTitle ? { position: skyTitle.position.toArray(),opacity: skyTitle.material.opacity,
      reached: titleReached,size: [skyTitle.geometry.parameters.width,skyTitle.geometry.parameters.height] } : null },
  unlockSouth() { southUnlocked = southShutter.released = true; drawMap(); },
  mapPixel(x,z) { const [px,py] = toMap(x,z); return mapContext.getImageData(Math.round(px),Math.round(py),1,1).data[0]; },
};
// Play-testing: ?test=1&spawn=button opens the key door and stands in the chamber beyond the pedestal,
// facing the red button and the tunnel behind it.
// ?test=1&spawn=surface stands on the stair's top landing, facing out through the hatch.
if (window.corridorTest && spawn === 'surface') {
  corridorTest.setPosition(0,surfaceY,hatchZ-1.5);
  corridorTest.lookAt(0,surfaceY+1.65,hatchZ+20);
}
if (window.corridorTest && spawn === 'button') {
  corridorTest.unlockSouth(); southShutter.open = 1; updateDoors(0);
  corridorTest.setPosition(...pathPoint(roomS+1.3,0,0).toArray());
  corridorTest.lookAt(...pathPoint(roomS,0,1.19).toArray());
}
