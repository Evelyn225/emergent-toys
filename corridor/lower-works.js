function lowerWorks() {
  const hub = hubFloor, bottom = liftLevels[1], pit = bottom-1.5, head = 9;
  // The entry hallway keeps a flat approach at each doorway and ramps up to the hub
  // between them. Its ceiling runs parallel to the floor, from wall face to wall face,
  // so it never doubles the doorway soffits at either end.
  const rampStart = -2, rampEnd = -9, hallEnd = -12.85;
  slab(-1,-50,2,4,-3,pale);
  surface([[rampStart,-3,-48],[rampEnd,hub,-48],[rampEnd,hub,-52],[rampStart,-3,-52]],pale,true);
  slab(-11,-50,4,4,hub,pale,hub+3.22);
  for (const z of [-47.85,-52.15]) box((-.3+hallEnd)/2,-.9,z,-.3-hallEnd,4.8,.3,concrete,true);
  const hallCeiling = [[-.3,0],[rampStart,0],[rampEnd,hub+3],[hallEnd,hub+3]];
  for (let i = 0; i < hallCeiling.length-1; i++) {
    const [x0,y0] = hallCeiling[i], [x1,y1] = hallCeiling[i+1];
    surface([[x0,y0,-48],[x1,y1,-48],[x1,y1,-52],[x0,y0,-52]],steel,false,true);
  }
  // Reservoir water fills the hallway through the doorway and laps up the ramp.
  water.add(surface([[.15,-1.7,-48],[rampEnd,-1.7,-48],[rampEnd,-1.7,-52],[.15,-1.7,-52]],waterMaterial));

  // The hub: doorways east and west, sealed shutters north and south for later branches.
  slab(-20,-50,14,18,hub);
  for (const x of [-13,-27.15]) {
    for (const z of [-44.5,-55.5]) box(x,hub+3.5,z,.3,7,7,concrete,true);
    box(x,hub+5,-50,.3,4,4,concrete,true);
  }
  // Roller shutters rise into their lintels when released.
  function shutter(x,z,face,text) {
    const start = scene.children.length;
    box(x,hub+1.5,z,3,3,.08,steel);
    for (let i = 0; i < 10; i++) box(x,hub+.2+i*.3,z+face*.06,2.9,.06,.04,pale);
    const group = new THREE.Group();
    for (const obj of scene.children.slice(start)) group.add(obj);
    scene.add(group);
    const door = { group,open: 0,released: false,at: new THREE.Vector3(x,hub+1.5,z),sign: label(text,x,hub+4,z+face*.18,face < 0 ? Math.PI : 0,1.3) };
    barriers.push({ box: new THREE.Box3(new THREE.Vector3(x-1.5,hub,z-.08),new THREE.Vector3(x+1.5,hub+3,z+.08)),
      enabled: () => door.open < 1 });
    return door;
  }
  for (const z of [-40.85,-59.15]) {
    for (const x of [-24.25,-15.75]) box(x,hub+3.5,z,5.5,7,.3,concrete,true);
    box(-20,hub+5,z,3,4,.3,concrete,true);
  }
  northShutter = shutter(-20,-40.85,-1,'SEALED');
  southShutter = shutter(-20,-59.15,1,'LOCKED');
  storeRoom(); keyhole();
  surface([[-13.15,hub+7,-41],[-27,hub+7,-41],[-27,hub+7,-59],[-13.15,hub+7,-59]],steel,false,true);
  box(-20,hub+6.9,-50,4.2,.2,6.2,steel);
  box(-20,hub+6.79,-50,4,.02,6,lit);
  for (const x of [-24.5,-15.5]) for (const z of [-44,-56]) {
    box(x,hub+3.5,z,.5,7,.5,steel,true);
    box(x,hub+.1,z,.9,.2,.9,steel);
  }
  // Fixed treatment vessels are bolted to the floor and piped into the wall.
  for (const z of [-44.5,-55.5]) {
    const tank = mesh(new THREE.CylinderGeometry(1.3,1.3,3,20),steel);
    tank.position.set(-23,hub+1.5,z);
    const footing = mesh(new THREE.CylinderGeometry(1.4,1.4,.16,20),pale);
    footing.position.set(-23,hub+.08,z);
    barriers.push({ box: new THREE.Box3(
      new THREE.Vector3(-24.4,hub,z-1.4),new THREE.Vector3(-21.6,hub+3,z+1.4),
    ) });
    beam([-23,hub+3,z],[-27,hub+3,z],.16);
  }
  label('LOWER WORKS',-26.97,hub+4.1,-50,Math.PI/2,2.8);

  // Vestibule between the hub and the top landing.
  slab(-29,-50,4,4,hub,pale);
  for (const z of [-47.85,-52.15]) box(-28.975,hub+1.5,z,3.35,3,.3,concrete,true);
  surface([[-27.3,hub+3,-48],[-30.65,hub+3,-48],[-30.65,hub+3,-52],[-27.3,hub+3,-52]],steel,false,true);
  box(-29.4,hub+2.97,-50,.9,.06,.3,lit);

  // The shaft is 4.1 x 4.5 m inside: the car leaves 5 cm at the landing walls and
  // the south wall, and the north side holds the counterweight. Each landing slab
  // stops exactly at the car's edge, with a 5 cm sill over the gap.
  box(-33,(pit+head)/2,-47.35,4.7,head-pit,.3,concrete,true);
  box(-33,(pit+head)/2,-52.15,4.7,head-pit,.3,concrete,true);
  for (const [x,level] of [[-30.8,hub],[-35.2,bottom]]) {
    box(x,(pit+level-.22)/2,-49.75,.3,level-.22-pit,4.5,concrete,true);
    box(x,level+1.39,-47.75,.3,3.22,.5,concrete,true);
    box(x,(level+3+head)/2,-49.75,.3,head-level-3,4.5,concrete,true);
  }
  surface([[-30.65,pit,-47.5],[-35.35,pit,-47.5],[-35.35,pit,-52],[-30.65,pit,-52]],steel);
  surface([[-30.95,head,-47.5],[-35.05,head,-47.5],[-35.05,head,-52],[-30.95,head,-52]],concrete,false,true);
  for (const x of [-32.25,-33.75]) beam([x,pit,-47.6],[x,sheaveY,-47.6],.08);
  beam([-30.95,sheaveY,-48.875],[-35.05,sheaveY,-48.875],.14);
  liftSheave = new THREE.Group();
  liftSheave.position.set(-33,sheaveY,-48.875); scene.add(liftSheave);
  const sheave = new THREE.Mesh(new THREE.TorusGeometry(sheaveRadius,.07,8,48),pale);
  sheave.rotation.y = Math.PI/2; liftSheave.add(sheave);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.06,sheaveRadius*2,.06),steel);
    spoke.rotation.x = i*Math.PI/4; liftSheave.add(spoke);
  }
  liftCounterweight = box(-33,0,-47.75,1.2,1.6,.26,steel);
  carCable = beam([-33,0,-50],[-33,1,-50],.04);
  weightCable = beam([-33,0,-47.75],[-33,1,-47.75],.04);
  for (const obj of [liftCounterweight,carCable,weightCable]) obj.userData.dynamic = true;

  // Bar gates lift into the lintel. Each is open only while the car is docked at it.
  for (const [x,level] of [[-30.8,hub],[-35.2,bottom]]) {
    const start = scene.children.length;
    for (const y of [.08,1.12]) box(x,level+y,-50,.04,.06,3.96,steel);
    for (let i = 0; i < 16; i++) box(x,level+.6,-48.12-i*.25,.03,1.1,.03,steel);
    const group = new THREE.Group();
    for (const obj of scene.children.slice(start)) group.add(obj);
    scene.add(group);
    const gate = { group,x,level,open: level === liftLevels[liftPos] ? 1 : 0 };
    barriers.push({ a:[x,-48],b:[x,-52],bottom:[level,level],top:[level+1.2,level+1.2],thickness:.03,enabled: () => gate.open < 1 });
    liftGates.push(gate);
  }

  // The car: deck, side rails, a crosshead for the cable, a lamp, and its control.
  liftCar = new THREE.Group();
  liftCar.position.set(-33,bottom,-50); scene.add(liftCar);
  const carStart = scene.children.length;
  metal(slab(-33,-50,4,3.9,bottom,pale));
  for (const z of [-48.7,-51.3]) beam([-31.1,bottom-.32,z],[-34.9,bottom-.32,z],.2);
  for (const z of [-48.15,-51.85]) {
    beam([-31.1,bottom+.9,z],[-34.9,bottom+.9,z],.065);
    beam([-31.1,bottom+.4,z],[-34.9,bottom+.4,z],.045);
    for (const x of [-31.1,-34.9]) beam([x,bottom,z],[x,bottom+.94,z],.065);
    beam([-33,bottom,z],[-33,bottom+3.2,z],.08);
    const rail = { a:[-31.1,z],b:[-34.9,z],bottom:[bottom,bottom],top:[bottom+1,bottom+1],thickness:.033 };
    barriers.push(rail); liftRails.push(rail);
  }
  // While travelling, the open ends hold riders clear of the shaft walls, which stand 5 cm
  // off the deck. They engage only once both gates are shut, and a gate cannot shut on a
  // rider standing near the end, so they never close on someone.
  for (const x of [-31,-35]) {
    const end = { a:[x,-48.05],b:[x,-51.95],bottom:[bottom,bottom],top:[bottom+1,bottom+1],thickness:.03,
      enabled: () => liftPos !== liftTarget && liftGates.every(gate => gate.open === 0) };
    barriers.push(end); liftRails.push(end);
  }
  beam([-33,bottom+3.2,-48.11],[-33,bottom+3.2,-51.89],.2);
  box(-33,bottom+3.08,-50,.3,.04,3.4,lit);
  box(-32.4,bottom+1.1,-48.24,.32,.42,.1,steel);
  box(-32.4,bottom+1.18,-48.3,.1,.1,.03,lit);
  for (const obj of scene.children.slice(carStart)) liftCar.attach(obj);
  interactables.push({ position: liftControl, available: () => liftPos === liftTarget,
    text: () => liftPos === 0 ? 'E / LOWER THE LIFT' : 'E / RAISE THE LIFT',
    use() { liftTarget = 1-liftPos; press(liftControl); } });
  // Call buttons beside each landing bring the car to that level.
  for (const [level,x] of [[0,-30.35],[1,-35.65]]) {
    const y = liftLevels[level];
    box(x,y+1.15,-48.05,.24,.34,.1,steel);
    box(x,y+1.18,-48.115,.08,.08,.03,lit);
    label('CALL',x,y+1.5,-48.03,Math.PI,.42);
    interactables.push({ position: new THREE.Vector3(x,y+1.18,-48.13),
      available: () => liftPos === liftTarget && liftPos !== level,
      text: () => 'E / CALL THE LIFT',
      use() { liftTarget = level; message('THE LIFT IS ON ITS WAY'); press(this.position); } });
  }

  // Bottom landing passage into the sump.
  slab(-37.15,-50,4.3,4,bottom,pale);
  for (const z of [-47.85,-52.15]) box(-37.175,bottom+1.5,z,3.65,3,.3,concrete,true);
  surface([[-35.35,bottom+3,-48],[-39,bottom+3,-48],[-39,bottom+3,-52],[-35.35,bottom+3,-52]],steel,false,true);
  box(-37.2,bottom+2.97,-50,.9,.06,.3,lit);

  // The sump holds what the pump drained: a causeway over still water to a sealed bulkhead.
  const sumpFloor = -25, sumpWater = -22.2, sumpRoof = -12;
  const hallY = (sumpFloor+sumpRoof)/2, hallH = sumpRoof-sumpFloor;
  for (const z of [-44,-56]) box(-39.15,hallY,z,.3,hallH,8,concrete,true);
  box(-39.15,(bottom+3+sumpRoof)/2,-50,.3,sumpRoof-bottom-3,4,concrete,true);
  box(-39.15,(sumpFloor+bottom-.22)/2,-50,.3,bottom-.22-sumpFloor,4,concrete,true);
  for (const z of [-39.85,-60.15]) box(-50.15,hallY,z,22.3,hallH,.3,concrete,true);
  surface([[-39.3,sumpFloor,-40],[-61,sumpFloor,-40],[-61,sumpFloor,-60],[-39.3,sumpFloor,-60]],steel);
  surface([[-39.3,sumpWater,-40],[-61,sumpWater,-40],[-61,sumpWater,-60],[-39.3,sumpWater,-60]],waterMaterial);
  surface([[-39.3,sumpRoof,-40],[-61,sumpRoof,-40],[-61,sumpRoof,-60],[-39.3,sumpRoof,-60]],concrete,false,true);
  slab(-50.15,-50,21.7,4,bottom,concrete,bottom-sumpFloor);
  for (const z of [-48.12,-51.88]) rail([-39.45,bottom,z],[-60.85,bottom,z]);
  for (const x of [-44,-50,-56]) {
    for (const z of [-44,-56]) box(x,hallY,z,.7,hallH,.7,concrete);
    box(x,sumpRoof-.225,-50,.5,.45,20,concrete);
  }
  for (const z of [-44,-56]) box(-50.15,sumpRoof-.3,z,21.7,.6,.5,concrete);
  for (const x of [-46,-55]) {
    box(x,-15.2,-50,1.6,.12,.5,lit);
    for (const dx of [-.6,.6]) suspension(x+dx,-50,-15.14,sumpRoof);
  }
  // The bulkhead: one sampled circle shapes the wall opening, its reveal, the trim, and
  // the hatch. A flat threshold cuts each circle at causeway level.
  const hatchCentre = bottom+1, hatchRadius = 1.3, doorRadius = 1.42;
  function circleAbove(r,segments = 64) {
    const a = Math.asin((hatchCentre-bottom)/r), points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI+a-i/segments*(Math.PI+2*a);
      points.push([-50+r*Math.cos(angle),hatchCentre+r*Math.sin(angle)]);
    }
    return points;
  }
  function wallFace(outline,x) {
    const indices = THREE.ShapeUtils.triangulateShape(outline.map(([z,y]) => new THREE.Vector2(z,y)),[]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(outline.flatMap(([z,y]) => [x,y,z]),3));
    geom.setIndex(indices.flat()); geom.computeVertexNormals();
    return mesh(geom);
  }
  const opening = circleAbove(hatchRadius);
  const panel = [[-51.5,bottom],...opening,[-48.5,bottom],[-48.5,sumpRoof],[-51.5,sumpRoof]];
  for (const x of [-61,-61.3]) wallFace(panel,x);
  for (let i = 0; i < opening.length-1; i++) {
    const [z0,y0] = opening[i], [z1,y1] = opening[i+1];
    surface([[-61,y0,z0],[-61,y1,z1],[-61.3,y1,z1],[-61.3,y0,z0]]);
  }
  for (const z of [-44.25,-55.75]) box(-61.15,hallY,z,.3,hallH,8.5,concrete,true);
  slab(-61.15,-50,.3,3,bottom,concrete,bottom-sumpFloor);
  // Jamb collision uses the opening's width at ankle height, its narrowest walkable point.
  const jamb = Math.sqrt(hatchRadius**2-(hatchCentre-bottom-.08)**2);
  for (const [z0,z1] of [[-51.5,-50-jamb],[-50+jamb,-48.5]]) {
    barriers.push({ box: new THREE.Box3(new THREE.Vector3(-61.3,bottom,z0),new THREE.Vector3(-61,sumpRoof,z1)) });
  }
  const trimRadius = 1.37, trimStart = Math.asin((hatchCentre-bottom)/trimRadius);
  const trim = mesh(new THREE.TorusGeometry(trimRadius,.06,8,64,Math.PI+2*trimStart),steel);
  trim.rotation.set(0,Math.PI/2,-trimStart); trim.position.set(-60.97,hatchCentre,-50);
  bulkheadSign = label('SEALED',-60.97,hatchCentre+hatchRadius+.75,-50,Math.PI/2,1.3);

  // The hatch sits against the control room face, larger than the opening, and swings
  // into the room on a hinge at its north edge. The wheel faces the causeway.
  const hinge = [-61.36,-50+doorRadius];
  const pivot = new THREE.Group();
  pivot.position.set(hinge[0],hatchCentre,hinge[1]); scene.add(pivot);
  const doorShape = new THREE.Shape(circleAbove(doorRadius).map(([z,y]) => new THREE.Vector2(z+50,y-hatchCentre)));
  const door = new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape,{ depth: .12,bevelEnabled: false }),steel);
  door.rotation.y = -Math.PI/2; door.position.set(-61.3-hinge[0],0,-50-hinge[1]); pivot.add(door);
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.8,12),steel); pivot.add(knuckle);
  box(-61.33,hatchCentre,hinge[1],.06,.9,.14,steel);
  const wheel = new THREE.Group();
  wheel.position.set(-61.22-hinge[0],0,-50-hinge[1]); pivot.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.42,.04,8,32),pale); rim.rotation.y = Math.PI/2; wheel.add(rim);
  // Half-spokes run from a small hub ring to the rim, so no spoke faces overlap at the centre.
  const boss = new THREE.Mesh(new THREE.TorusGeometry(.07,.025,8,20),pale); boss.rotation.y = Math.PI/2; wheel.add(boss);
  for (let i = 0; i < 6; i++) {
    const angle = i*Math.PI/3, spoke = new THREE.Mesh(new THREE.BoxGeometry(.04,.33,.04),pale);
    spoke.rotation.x = angle; spoke.position.set(0,.255*Math.cos(angle),.255*Math.sin(angle)); wheel.add(spoke);
  }
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(.045,.05,.05),steel); shaft.position.x = -.0575; wheel.add(shaft);
  const reach = doorRadius*2;
  const doorBarrier = { a: hinge,b: [hinge[0],hinge[1]-reach],bottom: [bottom,bottom],top: [bottom+2.42,bottom+2.42],thickness: .07 };
  barriers.push(doorBarrier);
  hatch = { pivot,wheel,barrier: doorBarrier,hinge,reach };
  interactables.push({ position: new THREE.Vector3(-61.22,hatchCentre,-50),available: () => hatchTime === null,
    text: () => 'E / TURN THE WHEEL',
    use() { hatchTime = time.value; message('THE WHEEL TURNS'); crank(this.position); } });

  // Control room: the plan board and the north shutter release.
  const { x0: cx0,x1: cx1,z0: cz0,z1: cz1 } = controlPlan;
  slab((cx0+cx1)/2,(cz0+cz1)/2,cx1-cx0,cz1-cz0,bottom);
  for (const z of [cz1+.15,cz0-.15]) box((cx0+cx1)/2-.15,bottom+2,z,cx1-cx0+.3,4,.3,concrete,true);
  box(cx0-.15,bottom+2,(cz0+cz1)/2,.3,4,cz1-cz0,concrete,true);
  surface([[cx1,bottom+4,cz0],[cx0,bottom+4,cz0],[cx0,bottom+4,cz1],[cx1,bottom+4,cz1]],steel,false,true);
  box(-66,bottom+3.97,-50,1.2,.06,.4,lit);
  box(cx0+.03,bottom+2.1,-50,.06,2.6,3.4,steel);
  const board = mesh(new THREE.PlaneGeometry(3.2,2.4),new THREE.MeshBasicMaterial({ map: mapTexture, toneMapped: false }));
  board.position.set(cx0+.09,bottom+2.1,-50); board.rotation.y = Math.PI/2;
  box(-69.6,bottom+.45,-50,.8,.9,2.6,steel,true);
  box(-69.6,bottom+.915,-50,.84,.03,2.64,pale);
  const base = mesh(new THREE.CylinderGeometry(.09,.09,.05,20),steel); base.position.set(-69.45,bottom+.955,-49.5);
  buttonCap = mesh(new THREE.CylinderGeometry(.065,.065,.04,20),lit);
  buttonCap.position.set(-69.45,bottom+1,-49.5); buttonCap.userData.dynamic = true;
  label('NORTH SHUTTER',-69.17,bottom+.6,-49.5,Math.PI/2,.7);
  interactables.push({ position: new THREE.Vector3(-69.45,bottom+1,-49.5),available: () => !northShutter.released,
    text: () => 'E / RELEASE THE NORTH SHUTTER',
    use() {
      northShutter.released = true; buttonCap.material = steel;
      changeLabel(northShutter.sign,'STORE'); drawMap();
      message('THE NORTH SHUTTER ROLLS UP'); press(this.position);
    } });
}
function storeRoom() {
  // Behind the north shutter: racks, crates, and the key on a lit hook.
  const hub = hubFloor, { x0,x1,z0,z1 } = storePlan, midX = (x0+x1)/2, midZ = (z0+z1)/2;
  slab(midX,midZ,x1-x0,z1-z0,hub);
  slab(-20,-40.85,3,.3,hub);
  box(midX,hub+1.5,z1+.15,x1-x0+.6,3,.3,concrete,true);
  for (const x of [x0-.15,x1+.15]) box(x,hub+1.5,midZ,.3,3,z1-z0,concrete,true);
  surface([[x1,hub+3,z0],[x0,hub+3,z0],[x0,hub+3,z1],[x1,hub+3,z1]],steel,false,true);
  box(midX,hub+2.97,midZ,1,.06,.3,lit);
  for (const x of [x0+.35,x1-.35]) {
    for (const y of [.35,1.05,1.75]) box(x,hub+y,midZ,.6,.05,4.6,steel);
    for (const dx of [-.27,.27]) for (const dz of [-2.27,2.27]) box(x+dx,hub+1,midZ+dz,.05,2,.05,steel);
    barriers.push({ box: new THREE.Box3(new THREE.Vector3(x-.3,hub,midZ-2.3),new THREE.Vector3(x+.3,hub+2,midZ+2.3)) });
  }
  for (const [x,y,z,size,mat] of [[x0+.35,.375,-36.5,.4,pale],[x0+.35,.375,-38.7,.45,steel],[x0+.35,1.075,-37.6,.3,steel],
    [x1-.35,1.075,-36.8,.35,pale],[x1-.35,.375,-39,.5,steel],[x1-.35,1.775,-38.2,.25,pale]]) {
    box(x,hub+y+size/2,z,size,size,size,mat);
  }
  box(-22.4,hub+.3,-35.4,.6,.6,.6,steel,true);
  box(-22.4,hub+.8,-35.4,.4,.4,.4,pale);
  box(-20,hub+1.3,z1-.03,.42,.5,.06,steel);
  box(-20,hub+1.62,z1-.06,.16,.05,.12,lit);
  beam([-20,hub+1.42,z1-.06],[-20,hub+1.42,z1-.13],.025);
  keyGroup = new THREE.Group();
  keyGroup.position.set(-20,hub+1.36,z1-.11); scene.add(keyGroup);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.045,.012,8,20),pale); keyGroup.add(ring);
  for (const [x,y,w,h,d] of [[0,-.12,.02,.15,.02],[.022,-.17,.045,.018,.016],[.015,-.135,.03,.018,.016]]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),pale); part.position.set(x,y,0); keyGroup.add(part);
  }
  interactables.push({ position: new THREE.Vector3(-20,hub+1.25,z1-.11),available: () => !keyTaken && northShutter.open === 1,
    text: () => 'E / TAKE THE KEY',
    use() {
      keyTaken = hasKey = true; keyGroup.visible = false; carry.hidden = false; drawMap();
      message('YOU TAKE THE KEY'); keyPickedUp(this.position);
    } });
}
function keyhole() {
  // A lock plate beside the south shutter. The key turns it and the shutter rolls up.
  const hub = hubFloor, canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cdd4c8'; ctx.fillRect(0,0,128,192);
  ctx.fillStyle = '#19211d'; ctx.beginPath(); ctx.arc(64,74,22,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(53,86); ctx.lineTo(75,86); ctx.lineTo(84,140); ctx.lineTo(44,140); ctx.closePath(); ctx.fill();
  box(-17.6,hub+1.25,-58.95,.28,.4,.1,steel);
  const plate = mesh(new THREE.PlaneGeometry(.2,.3),new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), toneMapped: false }));
  plate.position.set(-17.6,hub+1.25,-58.87);
  lockLamp = box(-17.6,hub+1.6,-58.96,.08,.08,.08,steel); lockLamp.userData.dynamic = true;
  interactables.push({ position: new THREE.Vector3(-17.6,hub+1.25,-58.87),available: () => !southUnlocked,
    text: () => hasKey ? 'E / UNLOCK' : 'LOCKED / NEEDS A KEY',
    use() {
      if (!hasKey) { message('IT NEEDS A KEY'); return; }
      hasKey = false; southUnlocked = southShutter.released = true; carry.hidden = true; lockLamp.material = lit;
      changeLabel(southShutter.sign,'SERVICE'); drawMap();
      message('THE LOCK TURNS'); lockTurned(this.position);
    } });
}
