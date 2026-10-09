function reservoir() {
  surface([[0,-3,-27],[24,-3,-27],[24,-3,-57],[0,-3,-57]],steel,true);
  const water = surface([[.15,-1.7,-27.1],[23.85,-1.7,-27.1],[23.85,-1.7,-56.9],[.15,-1.7,-56.9]],waterMaterial);
  // Each deck ends at the next deck's edge; there are no stacked top faces.
  metal(slab(12,-42,2.8,24,0,pale,.35));
  slab(12,-28.575,24,2.85); slab(12,-55.5,24,3);
  slab(1.5,-32,3,4); slab(22.5,-42,3,24);
  ramp([1.5,0,-34],[1.5,-3,-46],2.4,0);
  for (const z of [-30,-54]) box(12,-1.675,z,2.8,2.65,.5,steel);
  rail([10.7,0,-30],[10.7,0,-54]);
  rail([13.3,0,-30],[13.3,0,-36.5]); rail([13.3,0,-39.5],[13.3,0,-54]);
  metal(slab(14.8,-38,2.8,3,0,pale));
  rail([13.3,0,-36.6],[16.1,0,-36.6]);
  rail([13.3,0,-39.4],[16.1,0,-39.4]);
  rail([16.1,0,-36.6],[16.1,0,-39.4]);
  workGloves(14.25,.9,-36.6);
  for (const z of [-36.7,-39.3]) {
    beam([13.4,-.22,z],[16.2,-.22,z],.16);
    beam([13.4,-.22,z],[13.4,-1.2,z],.16);
    beam([13.4,-1.2,z],[16.2,-.22,z],.14);
  }
  rail([2.9,0,-30],[2.9,0,-34]); rail([21.1,0,-30],[21.1,0,-54]);
  for (const z of [-30,-54]) { rail([3,0,z],[10.6,0,z]); rail([13.4,0,z],[21,0,z]); }
  // A lower doorway replaces part of the west wall, below the gallery.
  box(-.15,2.8,-37.5,.3,11.6,21,concrete,true);
  box(-.15,2.8,-54.5,.3,11.6,5,concrete,true);
  box(-.15,4.3,-50,.3,8.6,4,concrete,true);
  box(24.15,2.8,-42,.3,11.6,30,concrete,true);
  // End walls enclose the drained basin below both upper platforms.
  for (const z of [-27,-57]) box(12,-1.5,z,24,3,.3,concrete,true);
  // The portal uses the tunnel's actual arch profile, including its reveal.
  for (const x of [5,19]) box(x,3,-27,10,6,.3,concrete,true);
  slab(12,-27,4,.3);
  const mouth = tunnelFrames[tunnelFrames.length-1].ring;
  for (let i = 0; i < mouth.length-1; i++) {
    const a = mouth[i], b = mouth[i+1];
    for (const z of [-26.85,-27.15]) {
      surface([[a[0],a[1],z],[b[0],b[1],z],[b[0],6,z],[a[0],6,z]]);
    }
    surface([[a[0],a[1],-26.85],[b[0],b[1],-26.85],
      [b[0],b[1],-27.15],[a[0],a[1],-27.15]],concrete,false,true);
  }
  // A barrel vault with deep structural ribs frames the entire reservoir.
  const deckUnderside = 8.5-.22;
  for (let j = 0; j < reservoirArch.length-1; j++) {
    const a = reservoirArch[j], b = reservoirArch[j+1];
    const left = a.x, right = b.x, leftY = a.y, rightY = b.y;
    const middle = (left+right)/2;
    const roof = surface([[left,leftY,-27],[right,rightY,-27],
      [right,rightY,-57.15],[left,leftY,-57.15]],concrete,false,true);
    roof.geometry.setAttribute('normal',new THREE.Float32BufferAttribute([
      ...a.normal,...b.normal,...b.normal,...a.normal,
    ],3));
    surface([[left,leftY,-27],[right,rightY,-27],[right,6,-27],[left,6,-27]]);
    if (middle < 3 || middle > 21) {
      for (const z of [-56.85,-57.15]) {
        surface([[left,6,z],[right,6,z],[right,rightY,z],[left,leftY,z]]);
      }
      barrier([left,-57],[right,-57],[6,6],[leftY,rightY],.15);
      continue;
    }
    // The wall opening shares the vault's curve across its entire width.
    for (const z of [-56.85,-57.15]) {
      surface([[left,leftY,z],[right,rightY,z],[right,15,z],[left,15,z]]);
      if (middle < 4.6 || middle > 19.4) {
        surface([[left,deckUnderside,z],[right,deckUnderside,z],[right,rightY,z],[left,leftY,z]]);
      }
    }
    barrier([left,-57],[right,-57],[leftY,rightY],[15,15],.15);
    if (middle < 4.6 || middle > 19.4) {
      barrier([left,-57],[right,-57],[deckUnderside,deckUnderside],[leftY,rightY],.15);
    }
  }
  // Close the exposed jambs and outer edges across the facade's thickness.
  for (const x of [3,4.6,19.4,21]) {
    const roofY = reservoirArch.find(point => Math.abs(point.x-x)<.000001).y;
    const outer = x === 3 || x === 21;
    const bottom = outer ? roofY : deckUnderside, top = outer ? 15 : roofY;
    surface([[x,bottom,-56.85],[x,top,-56.85],[x,top,-57.15],[x,bottom,-57.15]]);
  }
  for (const x of [1.5,22.5]) box(x,1.5,-57,3,9,.3,concrete,true);
  for (const z of [-31,-38,-46,-53]) {
    for (const x of [4.2,19.8]) {
      const top = reservoirRoofY(x)-.11;
      box(x,(top-3)/2,z,.65,top+3,.65,steel,true);
      box(x,-2.7,z,1.1,.6,1.1,concrete,true);
    }
    for (let j = 0; j < reservoirArch.length-1; j++) {
      const a = reservoirArch[j], b = reservoirArch[j+1];
      beam([12+(a.x-12)*11.9/12,6+(a.y-6)*6.9/7,z],
        [12+(b.x-12)*11.9/12,6+(b.y-6)*6.9/7,z],.22);
    }
  }
  for (const x of [6.5,17.5]) {
    beam([x,-2.825,-28],[x,-2.825,-56],.35);
    for (const z of [-31,-38,-46,-53]) {
      beam([x,-2.825,z],[x,5.8,z],.2);
      const supportX = x < 12 ? 4.2 : 19.8;
      beam([x,5.8,z],[supportX,5.8,z],.12);
    }
  }
  box(12,9.7,-42,1.8,.12,9,lit);
  for (const z of [-38,-46]) {
    for (const x of [11.35,12.65]) suspension(x,z,9.76,reservoirRoofY(x));
  }
  label('RESERVOIR',12,3.8,-27.16,Math.PI,3.5);
  beam([9.8,3.8,-57],[14.2,3.8,-57],.15);
  for (const x of [11,13]) beam([x,3.8,-57],[x,3.23,-57],.06);
  box(12,2.8,-57,2.9,.95,.4,steel);
  ascentSign = label('ASCENT ↑',12,2.8,-56.77,0,2.8);
  returnSign = label('ASCENT ↑',12,2.8,-57.23,Math.PI,2.8);
  // The pump occupies a bay outside the main bridge's walking lane.
  box(15.3,.75,-38,.65,1.5,.65,steel,true);
  box(15.3,.04,-38,.8,.08,.8,steel);
  beam([15.3,1.15,-37.67],[15.3,1.15,-37.52],.065,pale);
  pumpWheel = new THREE.Group();
  pumpWheel.position.set(15.3,1.15,-37.52); scene.add(pumpWheel);
  pumpWheel.add(new THREE.Mesh(new THREE.TorusGeometry(.24,.035,8,32),pale));
  for (const angle of [0,Math.PI/3,2*Math.PI/3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.46,.035,.035),pale);
    spoke.rotation.z = angle; pumpWheel.add(spoke);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.12,10),steel);
  grip.rotation.x = Math.PI/2; grip.position.set(.2,.02,.06); pumpWheel.add(grip);
  pumpRotor = new THREE.Group();
  pumpRotor.position.set(15.3,.45,-37.65);
  pumpRotor.userData.dynamic = true;
  scene.add(pumpRotor);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.17,.025,6,24),pale);
  pumpRotor.add(wheel);
  for (const angle of [0,Math.PI/2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.34,.035,.035),pale);
    spoke.rotation.z = angle; pumpRotor.add(spoke);
  }
  pumpIndicator = box(15.3,1.4,-37.65,.17,.1,.05,steel);
  pumpIndicator.userData.dynamic = true;
  label('PUMP',15.3,.8,-37.65,0,.58);
  interactables.push({ position: new THREE.Vector3(15.3,1.15,-37.52), text: () => pumpOn ? 'E / FILL THE RESERVOIR' : 'E / DRAIN THE RESERVOIR', use() {
    pumpOn = !pumpOn; powered.value = pumpOn ? 1 : 0;
    pumpIndicator.material = pumpOn ? lit : steel;
    message(pumpOn ? 'DRAINING THE RESERVOIR' : 'REFILLING THE RESERVOIR'); crank(this.position);
  }});
  descentGate = new THREE.Group();
  descentGate.position.set(.3,0,-34); scene.add(descentGate);
  for (const x of [.3,2.7]) box(x,.65,-34,.12,1.3,.12,steel,true);
  for (const y of [.4,1.05]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4,.09,.1),steel);
    bar.position.set(1.2,y,0); descentGate.add(bar);
  }
  for (const x of [.1,1.2,2.3]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.08,1.1,.1),steel);
    post.position.set(x,.55,0); descentGate.add(post);
  }
  barriers.push({
    a:[0,-34],b:[3,-34],bottom:[0,0],top:[1.2,1.2],thickness:.05,
    enabled: () => !descentReleased,
  });
  label('LOWER WORKS',.03,.5,-50,Math.PI/2,1.8);
  return water;
}
const water = reservoir();
function tower() {
  floor(12,-69.5,18,25);
  box(2.85,7.5,-69.5,.3,15,25,concrete,true); box(21.15,7.5,-69.5,.3,15,25,concrete,true);
  box(12,7.5,-82.15,18,15,.3,concrete,true);
  const deckUnderside = 8.5-.22;
  for (const x of [6.4,17.6]) box(x,deckUnderside/2,-57,6.8,deckUnderside,.3,concrete,true);
  box(12,(4+deckUnderside)/2,-57,4.4,deckUnderside-4,.3,concrete,true);
  surface([[3,15,-57],[21,15,-57],[21,15,-82],[3,15,-82]],steel,false,true);
  for (const x of [3.275,20.725]) for (const z of [-58,-70,-81]) box(x,7.5,z,.55,15,.55,steel,true);
  for (const y of [3.5,8.5,13.5]) {
    box(3.2,y,-69.5,.4,.25,25,steel); box(20.8,y,-69.5,.4,.25,25,steel); box(12,y,-81.8,18,.25,.4,steel);
  }
  // Ramps stop at landing edges, with exactly the landing's elevation.
  ramp([5,0,-60],[5,3,-77.8]);
  metal(slab(5,-79,2.4,2.4,3,pale));
  ramp([6.2,3,-79],[17.8,5.5,-79]);
  metal(slab(19,-79,2.4,2.4,5.5,pale));
  ramp([19,5.5,-77.8],[19,8.5,-61.2]);
  slab(19,-60,2.4,2.4,8.5,pale);
  slab(11.4,-60,12.8,2.4,8.5,pale);
  slab(12,-56.7,14,4.2,8.5,pale);
  // Carry the threshold to both jambs without overlapping the balcony slab.
  for (const x of [4.8,19.2]) slab(x,-57,.4,.3,8.5,pale);
  rail([5.1,8.5,-61.1],[17.9,8.5,-61.1]);
  rail([5.1,8.5,-54.7],[18.9,8.5,-54.7]);
  rail([5.1,8.5,-61.1],[5.1,8.5,-54.7]);
  rail([18.9,8.5,-58.9],[18.9,8.5,-54.7]);
  rail([3.9,3,-80.1],[6.2,3,-80.1]);
  rail([3.9,3,-80.1],[3.9,3,-77.8]);
  rail([17.8,5.5,-80.1],[20.1,5.5,-80.1]);
  rail([20.1,5.5,-80.1],[20.1,5.5,-77.8]);
  rail([20.1,8.5,-61.2],[20.1,8.5,-58.9]);
  rail([20.1,8.5,-58.9],[18.9,8.5,-58.9]);
  // Landings have wall-mounted crossmembers and diagonal braces.
  for (const [x,y,z,anchorX] of [[5,3,-79,3],[19,5.5,-79,21],[19,8.5,-60,21]]) {
    beam([anchorX,y-.22,z],[x,y-.22,z],.2);
    beam([anchorX,y-1.2,z],[x,y-.22,z],.16);
  }
  for (const x of [6,12,18]) {
    beam([x,8.28,-57],[x,8.28,-54.6],.18);
    beam([x,7,-57],[x,8.28,-54.6],.14);
  }
  const spindle = mesh(new THREE.CylinderGeometry(.7,.7,10,12),steel); spindle.position.set(12,8,-70);
  beam([12,13,-70],[12,15,-70],.22);
  for (const y of [3,5,7,9,11,13]) {
    const ring = mesh(new THREE.TorusGeometry(1.5,.08,6,40),pale); ring.rotation.x = Math.PI/2; ring.position.set(12,y,-70);
  }
  box(12,13.8,-70,5,.15,8,lit);
  for (const x of [10,14]) for (const z of [-73,-67]) suspension(x,z,13.875,15);
  label('ASCENT',12,2.6,-81.97,0,3.2); label('↑',3.04,1.7,-61,Math.PI/2,.8);
  // A button post on the overlook deck releases the descent gate far below.
  box(12,8.53,-55.1,.5,.06,.5,steel);
  box(12,9,-55.1,.3,.9,.3,steel,true);
  box(12,9.465,-55.1,.4,.03,.4,pale);
  const housing = mesh(new THREE.CylinderGeometry(.09,.09,.05,20),steel); housing.position.set(12,9.505,-55.1);
  descentCap = mesh(new THREE.CylinderGeometry(.065,.065,.04,20),lit);
  descentCap.position.set(12,9.55,-55.1); descentCap.userData.dynamic = true;
  label('DESCENT GATE',12,9.15,-55.255,Math.PI,.62);
  interactables.push({ position: new THREE.Vector3(12,9.55,-55.1),available: () => !descentReleased,
    text: () => 'E / RELEASE THE DESCENT GATE', use() {
      descentReleased = true; descentCap.material = steel; descentCap.position.y -= .02;
      changeLabel(ascentSign,'DESCENT ↓');
      changeLabel(returnSign,'DESCENT ↓');
      message(pumpOn ? 'THE DESCENT GATE OPENS' : 'GATE OPEN / USE THE BRIDGE PUMP TO DRAIN THE WATER');
      press(this.position);
    } });
}
tower();
