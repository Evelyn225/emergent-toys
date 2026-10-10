// Small belongings, left where somebody last used them. Their geometry uses the facility's
// lighting and dither, and stays in local groups so the architecture batch cannot flatten it.
const remnantProps = [], remnantAssets = [];
const familyPhotoPath = 'images/corridor/family-photo.png';
function remnantMaterial(tone,grain = 700) {
  const mat = material(tone,0,0,1);
  mat.fragmentShader = mat.fragmentShader.replace('(rough > .5 ? 9. : 22.)',grain.toFixed(1));
  return mat;
}
function remnantPart(group,geometry,mat,name = '') {
  const part = new THREE.Mesh(geometry,mat); part.name = name; group.add(part); return part;
}
function remnantStroke(group,points,radius,mat,closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)),closed,'centripetal');
  const segments = Math.max(2,Math.min(256,Math.ceil(curve.getLength()/.004)));
  return remnantPart(group,new THREE.TubeGeometry(curve,segments,radius,5,closed),mat);
}
function warpRemnantShell(source,warp) {
  // Subdivide before bending: large cap triangles would otherwise cut straight through the rail.
  const input = source.attributes.position, positions = [], indices = [], vertices = new Map();
  function vertex(point) {
    const key = point.map(v => Math.round(v*1e7)).join(',');
    if (vertices.has(key)) return vertices.get(key);
    const index = positions.length/3; warp(...point).toArray(positions,positions.length); vertices.set(key,index); return index;
  }
  function triangle(a,b,c,depth = 0) {
    const points = [a,b,c], lengths = points.map((p,i) => p.reduce((sum,v,j) => sum+(v-points[(i+1)%3][j])**2,0));
    const edge = lengths.indexOf(Math.max(...lengths));
    if (lengths[edge] > .009**2 && depth < 12) {
      const p = points[edge], q = points[(edge+1)%3], r = points[(edge+2)%3], middle = p.map((v,i) => (v+q[i])/2);
      triangle(p,middle,r,depth+1); triangle(middle,q,r,depth+1);
    } else indices.push(vertex(a),vertex(b),vertex(c));
  }
  for (let i = 0; i < input.count; i += 3) {
    const points = [0,1,2].map(j => [input.getX(i+j),input.getY(i+j),input.getZ(i+j)]);
    if (points.every(p => p[1] <= .0005)) continue;
    triangle(...points);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function coffeeMug(x,y,z) {
  const mug = new THREE.Group(); mug.name = 'control-coffee-mug'; mug.position.set(x,y,z); mug.rotation.y = -.4;
  const glaze = remnantMaterial(1.3), exposedClay = remnantMaterial(.87), coffee = remnantMaterial(.22);
  const profile = [[0,0],[.034,0],[.04,.002],[.041,.007],[.045,.018],[.047,.052],[.049,.098],
    [.048,.113],[.046,.12],[.043,.119],[.041,.112],[.039,.096],[.038,.052],[.036,.022],[.03,.018],[0,.018]];
  const body = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)),64), positions = body.attributes.position;
  // Lower both sides of a small section of the lip; the cup remains a hollow, connected shell.
  for (let i = 0; i < positions.count; i++) {
    const angle = Math.atan2(positions.getX(i),positions.getZ(i));
    const gap = Math.abs(Math.atan2(Math.sin(angle-1.8),Math.cos(angle-1.8)));
    const chip = Math.max(0,1-gap/.18), height = positions.getY(i);
    if (height > .098) positions.setY(i,height-.012*chip*(height-.098)/.022);
  }
  body.computeVertexNormals(); remnantPart(mug,body,glaze,'mug-shell');
  // A flattened oval handle with smoothly blended roots rather than a complete torus.
  const handleCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(.044,.096,0),new THREE.Vector3(.071,.103,0),
    new THREE.Vector3(.087,.087,0),new THREE.Vector3(.087,.061,0),new THREE.Vector3(.072,.038,0),new THREE.Vector3(.042,.035,0)]);
  const handle = new THREE.TubeGeometry(handleCurve,36,.008,10,false), hp = handle.attributes.position;
  for (let i = 0; i < hp.count; i++) hp.setZ(i,hp.getZ(i)*.82);
  handle.computeVertexNormals(); remnantPart(mug,handle,glaze,'mug-handle');
  for (const [xx,yy] of [[.045,.096],[.043,.035]]) {
    const root = remnantPart(mug,new THREE.SphereGeometry(.012,12,8),glaze);
    root.position.set(xx,yy,0); root.scale.set(.8,1,.8);
  }
  // The raised foot and the dried residue inside are visible from different approach angles.
  const foot = remnantPart(mug,new THREE.TorusGeometry(.036,.0025,6,48),exposedClay); foot.rotation.x = Math.PI/2; foot.position.y = .0025;
  const residue = remnantPart(mug,new THREE.CircleGeometry(.031,48),coffee,'mug-coffee-residue');
  residue.rotation.x = -Math.PI/2; residue.position.y = .0184;
  const stain = remnantPart(mug,new THREE.TorusGeometry(.0384,.0013,5,56),coffee); stain.rotation.x = Math.PI/2; stain.position.y = .055;
  const crack = [[.044,.111,.008],[.0465,.102,.009],[.048,.095,.01],[.0465,.087,.012]];
  remnantStroke(mug,crack,.00045,exposedClay);
  scene.add(mug); remnantProps.push(mug); return mug;
}

function familyPhotograph(x,y,z) {
  const photo = new THREE.Group(); photo.name = 'control-family-photo'; photo.position.set(x,y,z);
  // Sized up a touch in its own plane; the depth off the wall stays as built.
  photo.rotation.set(0,Math.PI/2,-.055); photo.scale.set(1.2,1.2,1);
  const width = .265, height = .19;
  function paperDepth(u,v) {
    return .003*((u/width)**2)+.013*Math.max(0,u/width+.5)**5*Math.max(0,.5-v/height)**3;
  }
  function paperGeometry(w,h,offset) {
    const geometry = new THREE.PlaneGeometry(w,h,20,14), p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i,paperDepth(p.getX(i),p.getY(i))+offset);
    geometry.computeVertexNormals(); return geometry;
  }
  const paper = remnantMaterial(1.08), edge = remnantMaterial(.66);
  remnantPart(photo,paperGeometry(width,height,0),paper,'photo-paper');
  remnantPart(photo,paperGeometry(width,height,-.0006),edge);
  // The actual generated photograph is loaded before the first frame and follows the paper's curl.
  let texture;
  remnantAssets.push(new Promise((resolve,reject) => {
    texture = new THREE.TextureLoader().load(familyPhotoPath,loaded => resolve(loaded),undefined,reject);
  }));
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const print = remnantMaterial(.7);
  print.uniforms.photoMap = { value: texture };
  print.vertexShader = 'varying vec2 vPhotoUV;\n'+print.vertexShader.replace('vWorld = world.xyz;','vWorld = world.xyz; vPhotoUV = uv;');
  print.fragmentShader = 'uniform sampler2D photoMap;\nvarying vec2 vPhotoUV;\n'+print.fragmentShader.replace('float ink = step(',
    'float image = pow(dot(texture2D(photoMap,vPhotoUV).rgb,vec3(.2126,.7152,.0722)),1./2.2);\n      lum = (lum*.3+.8)*mix(.07,.93,image);\n      float ink = step(');
  remnantPart(photo,paperGeometry(.249,.166,.0007),print,'photo-print');
  // A small punched hole, the tack's metal stem, and its worn head hold the top edge to the wall.
  const pin = remnantPart(photo,new THREE.CylinderGeometry(.002,.002,.012,10),steel); pin.rotation.x = Math.PI/2; pin.position.set(0,.08,-.001);
  const pinHead = remnantPart(photo,new THREE.SphereGeometry(.0045,12,8),pale); pinHead.position.set(0,.08,.005); pinHead.scale.z = .55;
  const hole = remnantPart(photo,new THREE.CircleGeometry(.003,12),edge); hole.position.set(0,.08,.001);
  // A dog-eared corner has a visible fold, but does not cover anyone's face.
  const corner = new THREE.BufferGeometry();
  const points = [[width/2-.025,-height/2],[width/2,-height/2+.022],[width/2-.022,-height/2+.023]];
  corner.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(([u,v]) => [u,v,paperDepth(u,v)+.0015]),3));
  corner.computeVertexNormals(); remnantPart(photo,corner,paper);
  scene.add(photo); remnantProps.push(photo); return photo;
}

// Merge the dozens of tiny stitches and panels by material, keeping the posed glove's local shape.
function batchRemnant(group) {
  const parts = group.children.filter(part => part.isMesh), materials = [...new Set(parts.map(part => part.material))];
  for (const mat of materials) {
    const positions = [], normals = [];
    for (const part of parts.filter(part => part.material === mat)) {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone(); geometry.applyMatrix4(part.matrix);
      for (const value of geometry.attributes.position.array) positions.push(value);
      for (const value of geometry.attributes.normal.array) normals.push(value);
      geometry.dispose(); part.geometry.dispose(); group.remove(part);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    remnantPart(group,geometry,mat);
  }
}

function workGloves(x,y,z) {
  const pair = new THREE.Group(); pair.name = 'pump-work-gloves'; pair.position.set(x,y,z); pair.rotation.y = Math.PI;
  const leather = remnantMaterial(.84,460), cuff = remnantMaterial(.66,1100), seam = remnantMaterial(.49,700), scuff = remnantMaterial(1.06,650);
  const fold = new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.068,-.05),new THREE.Vector3(0,.011,-.052),
    new THREE.Vector3(0,.042,-.042),new THREE.Vector3(0,.05,-.013),new THREE.Vector3(0,.05,.013),
    new THREE.Vector3(0,.042,.042),new THREE.Vector3(0,.011,.052),new THREE.Vector3(0,-.115,.069)],false,'centripetal');
  const length = .31;
  function drape(u,v,depth,hand) {
    const t = Math.max(0,Math.min(1,v/length)), p = fold.getPointAt(t), tangent = fold.getTangentAt(t);
    const wrinkle = .0014*Math.sin(v*230+u*70)*Math.sin(Math.PI*t);
    // The second glove overlaps the first without repeating its exact silhouette.
    p.x = u*hand+.005*Math.sin(t*5)+.002*Math.sin(u*70)*Math.sin(Math.PI*t);
    p.y += tangent.z*(depth+wrinkle); p.z -= tangent.y*(depth+wrinkle);
    return p;
  }
  const outline = new THREE.Shape();
  outline.moveTo(-.062,0); outline.lineTo(.06,0); outline.lineTo(.052,.081); outline.quadraticCurveTo(.055,.145,.05,.184);
  // Four rounded fingers with distinct lengths, narrow webbing, and a separate angled thumb.
  for (const [right,left,tip] of [[.05,.027,.247],[.023,.002,.279],[-.002,-.024,.298],[-.028,-.049,.279]]) {
    outline.lineTo(right,.19); outline.lineTo(right,tip-.012); outline.quadraticCurveTo((right+left)/2,tip+.006,left,tip-.012);
    outline.lineTo(left,.184);
  }
  outline.quadraticCurveTo(-.055,.171,-.066,.182); outline.lineTo(-.083,.207);
  outline.quadraticCurveTo(-.108,.221,-.11,.197); outline.lineTo(-.088,.149);
  outline.quadraticCurveTo(-.06,.116,-.057,.084); outline.lineTo(-.062,0);
  for (const [hand,offset,turn] of [[1,-.043,-.075],[-1,.041,.14]]) {
    const glove = new THREE.Group(); glove.position.set(offset,hand === 1 ? 0 : .015,hand === 1 ? 0 : .007); glove.rotation.z = turn; pair.add(glove);
    glove.name = hand === 1 ? 'left-work-glove' : 'right-work-glove';
    const shell = new THREE.ExtrudeGeometry(outline,{ depth: .018,steps: 1,bevelEnabled: true,bevelThickness: .003,bevelSize: .003,bevelSegments: 3,curveSegments: 8 });
    // Leave the cuff open and bend a finely tessellated shell, including its palm and finger faces.
    const body = warpRemnantShell(shell,(u,v,d) => drape(u,v,d-.009,hand));
    shell.dispose();
    remnantPart(glove,body,leather,'glove-shell');
    function panel(u0,u1,v0,v1,depth,mat) {
      const g = new THREE.PlaneGeometry(u1-u0,v1-v0,10,12), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const point = drape(p.getX(i)+(u0+u1)/2,p.getY(i)+(v0+v1)/2,depth,hand); p.setXYZ(i,point.x,point.y,point.z);
      }
      g.computeVertexNormals(); remnantPart(glove,g,mat);
    }
    for (const depth of [-.014,.014]) panel(-.06,.058,.002,.073,depth,cuff);
    panel(-.036,.037,.105,.17,.014,scuff); // Worn reinforcement across the back of the knuckles.
    const border = outline.getPoints(8).map(p => drape(p.x,p.y,.013,hand));
    remnantStroke(glove,border.map(p => p.toArray()),.0008,seam,true);
    function stitchRow(u0,u1,v,depth) {
      const count = Math.ceil((u1-u0)/.006);
      for (let i = 0; i < count; i++) {
        const u = u0+(u1-u0)*i/count, a = drape(u,v,depth,hand), b = drape(u+.003,v+.001,depth,hand);
        remnantStroke(glove,[a.toArray(),b.toArray()],.0006,scuff);
      }
    }
    for (const v of [.012,.067,.108,.168]) stitchRow(-.041,.039,v,.016);
    // Short flex creases and wear at the finger joints, positioned on the curved shell.
    for (const [u,width,tip] of [[.038,.013,.247],[.012,.014,.279],[-.013,.015,.298],[-.038,.014,.279]]) {
      for (const v of [tip-.046,tip-.025]) {
        const line = [-1,0,1].map(k => drape(u+k*width*.45,v+Math.abs(k)*.003,.013,hand).toArray());
        remnantStroke(glove,line,.0007,seam);
      }
    }
    batchRemnant(glove);
  }
  scene.add(pair); remnantProps.push(pair); return pair;
}

function workJacket(x,y,z) {
  const jacket = new THREE.Group(); jacket.name = 'control-work-jacket';
  jacket.position.set(x,y,z); jacket.rotation.y = Math.PI;
  const canvas = remnantMaterial(.81,950), lining = remnantMaterial(.42,1200);
  const worn = remnantMaterial(.94,1000), thread = remnantMaterial(.59,1300);
  function cloth(name,point,mat = canvas,columns = 32,rows = 40) {
    const positions = [], indices = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      point(i/columns,j/rows).toArray(positions,positions.length);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j*(columns+1)+i, b = a+columns+1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return remnantPart(jacket,geometry,mat,name);
  }
  function seam(point,mat = thread,radius = .0015,steps = 40) {
    const points = [];
    for (let i = 0; i <= steps; i++) points.push(point(i/steps).toArray());
    return remnantStroke(jacket,points,radius,mat);
  }
  function width(t) { return .205+.036*Math.sin(Math.PI*t)-.017*t; }
  function hem(side,u) { return -.81+.018*Math.sin(u*5+side)+.014*side; }
  function front(side,u,t) {
    const gap = .021+.017*t, xx = side*(gap+(width(t)-gap)*u);
    const top = -.065-.11*Math.pow(u,1.15), yy = top+(hem(side,u)-top)*t;
    // Broad gravity folds and narrower creases radiating from the collar, with a sagging hem.
    const folds = .013*Math.sin(u*12+t*3+side)*Math.sin(Math.PI*t)
      -.012*Math.exp(-(((u-.28-.22*t)/.07)**2))*Math.sin(Math.PI*t);
    const zz = .091+.038*Math.sin(Math.PI*t)-.024*u*u+folds;
    return new THREE.Vector3(xx,yy,zz);
  }
  function back(u,t) {
    const across = u*2-1, top = -.065-.11*Math.pow(Math.abs(across),1.15);
    const bottom = -.81+.018*Math.sin(Math.abs(across)*5+across)+.014*across;
    return new THREE.Vector3(across*width(t),top+(bottom-top)*t,
      .031+.016*Math.sin(Math.PI*t)+.006*Math.sin(u*15+t*4)*Math.sin(Math.PI*t));
  }
  cloth('jacket-back',back,canvas,48,48);
  for (const side of [-1,1]) {
    cloth('jacket-front', (u,t) => front(side,u,t),canvas,36,48);
    // Close the side of the garment, leaving the neck, open front, and hem genuinely hollow.
    const armholeEnd = .25;
    cloth('jacket-side',(u,v) => {
      const t = armholeEnd+(1-armholeEnd)*v;
      return front(side,1,t).lerp(back(side < 0 ? 0 : 1,t),u);
    },canvas,8,36);
    cloth('jacket-shoulder',(u,v) => front(side,u,0).lerp(back((1+side*u)/2,0),v),canvas,32,8);
    seam(u => front(side,u,0),thread,.0018);
    seam(v => front(side,.99,armholeEnd+(1-armholeEnd)*v));
    seam(u => front(side,u,.982),worn,.002);
    for (const u of [.34,.68,.86]) {
      const edge = front(side,u,1);
      remnantStroke(jacket,[edge.toArray(),[edge.x+side*.002,edge.y-.006,edge.z+.002],
        [edge.x-side*.002,edge.y-.009,edge.z+.003]],.00065,worn);
    }
    seam(t => front(side,.025,t),worn,.0025);
    // A folded placket exposes the darker interior along the partly open front.
    cloth('jacket-placket',(u,t) => {
      const p = front(side,u*.095,t);
      p.z += .006*Math.sin(u*Math.PI); return p;
    },worn,6,48);
    cloth('jacket-inner-edge',(u,t) => {
      const p = front(side,0,t); p.x -= side*u*.015; p.z -= .006+u*.012; return p;
    },lining,4,40);

    function pocket(u0,u1,t0,t1) {
      function face(u,v) {
        const p = front(side,u0+(u1-u0)*u,t0+(t1-t0)*v);
        const belly = Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
        p.y -= .009*Math.sin(Math.PI*u)*v;
        p.z += .003+.018*belly+.008*(1-v)*Math.sin(Math.PI*u); return p;
      }
      cloth('jacket-pocket',face,canvas,20,20);
      for (const u of [.035,.965]) seam(v => face(u,v),thread,.0012,24);
      seam(u => face(u,.965),thread,.0012,24);
      seam(u => face(u,0),lining,.0025,24);
      cloth('jacket-pocket-flap',(u,v) => {
        const p = face(u,0); p.y += .012-v*.036;
        p.z += .005+.01*Math.sin(v*Math.PI); return p;
      },worn,20,8);
    }
    pocket(.27,.89,.55,.84);
    if (side === -1) pocket(.25,.82,.23,.40);

    // The collar turns out from an actual neck opening, rather than sitting as a flat decal.
    cloth('jacket-collar',(u,v) => {
      const angle = Math.PI/2+side*u*Math.PI*.7;
      const radius = .058+v*.033;
      return new THREE.Vector3(Math.cos(angle)*radius,-.054-v*.04-.016*Math.sin(u*Math.PI),
        .063+Math.sin(angle)*(.025+v*.033));
    },worn,24,10);
    cloth('jacket-lapel',(u,v) => {
      const p = front(side,.02+u*.30,v*.20);
      p.x += side*.026*(1-v)*Math.sin(u*Math.PI);
      p.z += .013+.025*Math.sin(u*Math.PI)*(1-v); return p;
    },worn,16,18);

    // Each sleeve starts on the body's armhole boundary, then rolls into its flattened elbow pose.
    function armhole(u) {
      let t, depth;
      if (u <= .375) { t = armholeEnd*u/.375; depth = 0; }
      else if (u <= .5) { t = armholeEnd; depth = (u-.375)/.125; }
      else if (u <= .875) { t = armholeEnd*(.875-u)/.375; depth = 1; }
      else { t = 0; depth = (1-u)/.125; }
      return front(side,1,t).lerp(back(side < 0 ? 0 : 1,t),depth);
    }
    const points = side < 0
      ? [[-.205,-.24,.066],[-.28,-.34,.085],[-.303,-.51,.105],[-.29,-.72,.11],[-.272,-.91,.12]]
      : [[.205,-.24,.066],[.29,-.32,.08],[.331,-.43,.095],[.289,-.58,.13],[.31,-.755,.145]];
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)),false,'centripetal');
    function sleeve(u,t,inside = false) {
      const p = path.getPointAt(t), tangent = path.getTangentAt(t);
      const across = new THREE.Vector3(-tangent.y,tangent.x,0).normalize().multiplyScalar(side);
      const angle = (u-.9375)*Math.PI*2;
      const elbow = Math.exp(-(((t-.51)/.15)**2));
      const fold = .004*Math.sin(t*34+Math.cos(angle)*2)*elbow
        +.003*Math.sin(t*20+angle*3)*Math.sin(Math.PI*t);
      const radius = .09-.035*t+(inside ? -.006 : 0)+fold;
      p.addScaledVector(across,Math.cos(angle)*radius);
      p.z += Math.sin(angle)*(radius*.48)+.003*Math.sin(angle*4+t*8)*Math.sin(Math.PI*t);
      const blend = Math.min(1,t/.16), eased = blend*blend*(3-2*blend);
      const root = armhole(u);
      if (inside) root.z -= .003;
      return root.lerp(p,eased);
    }
    cloth('jacket-sleeve',sleeve,canvas,32,64);
    cloth('jacket-cuff',(u,v) => sleeve(u,.91+v*.09),worn,36,10);
    cloth('jacket-cuff-lining',(u,v) => sleeve(u,.90+v*.10,true),lining,36,8);
    cloth('jacket-cuff-edge',(u,v) => sleeve(u,1).lerp(sleeve(u,1,true),v),worn,36,2);
    seam(u => armhole(u),thread,.0011,64);
    seam(t => sleeve(.6875,t),thread,.0015,64);
    for (const t of [.925,.982]) seam(u => sleeve(u,t),thread,.0015,48);
  }
  // Small, dull buttons and sewn buttonholes are separated by the open front.
  for (const t of [.24,.40,.56,.73]) {
    const p = front(1,.065,t), button = remnantPart(jacket,new THREE.CylinderGeometry(.007,.007,.003,12),steel);
    button.rotation.x = Math.PI/2; button.position.copy(p); button.position.z += .004;
    const hole = front(-1,.065,t);
    seam(u => new THREE.Vector3(hole.x,hole.y+(u-.5)*.018,hole.z+.003),lining,.0013,4);
  }
  // Wall plate, bent metal hook and the fabric hanging loop share a visible attachment point.
  const plate = remnantPart(jacket,new THREE.BoxGeometry(.045,.065,.008),steel); plate.position.set(0,.003,.005);
  for (const yy of [-.016,.025]) {
    const screw = remnantPart(jacket,new THREE.SphereGeometry(.003,8,6),pale); screw.position.set(0,yy,.011); screw.scale.z = .35;
  }
  remnantStroke(jacket,[[0,.014,.01],[0,.005,.032],[0,-.028,.057],[0,-.012,.078],[0,.004,.075]],.006,steel);
  remnantStroke(jacket,[[-.022,-.066,.046],[-.016,-.017,.06],[0,-.005,.071],[.016,-.017,.06],[.022,-.066,.046]],.0035,thread);
  batchRemnant(jacket);
  // Weld shared cloth boundaries so lighting follows the fabric continuously over both shoulders.
  const shell = jacket.children.find(part => part.material === canvas), source = shell.geometry.attributes.position;
  shell.name = 'jacket-cloth';
  const positions = [], indices = [], vertices = new Map();
  for (let i = 0; i < source.count; i++) {
    const point = [source.getX(i),source.getY(i),source.getZ(i)];
    const key = point.map(value => Math.round(value*1e6)).join(',');
    if (!vertices.has(key)) {
      vertices.set(key,positions.length/3); positions.push(...point);
    }
    indices.push(vertices.get(key));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  shell.geometry.dispose(); shell.geometry = geometry;
  scene.add(jacket); remnantProps.push(jacket); return jacket;
}
