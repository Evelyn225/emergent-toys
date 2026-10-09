// The surface, reached only on a visit after the ending. The stair comes up inside a concrete
// bunker at the edge of a meadow, its hatch blown off by the blast. Forest rings the meadow; to the
// north-east the ground falls away down a valley to a city, with mountains beyond. It is the one
// place in full colour, built from rounded, organic forms to answer the blocky substructure, and lit
// by a sun in a clouded sky. Everything here hangs off one group, shown only from the upper stair,
// with its own lights, fog, and far plane. The walker's ground out here is a height function, not a
// raycast mesh, and the trees and stones keep their own collision.
const outdoors = new THREE.Group();
outdoors.visible = false; scene.add(outdoors);
const sunDirection = new THREE.Vector3(-.42,.62,.66).normalize();
const meadow = { x: 4,z: 182 }, valley = { x: .34/Math.hypot(.34,.94),z: .94/Math.hypot(.34,.94) };
const cityAt = { x: meadow.x+valley.x*1580,z: meadow.z+valley.z*1580 };
// The bunker is a concrete wedge over the stair's top: its roof follows the stair ceiling half a
// metre up, from where it breaks the ground to the hatch wall.
const bunkerHalf = 1.85, bunkerBack = stairBase+(surfaceY-.05-3.3)*flightRun/flightRise;
const roofTop = z => stairCeiling(z)+.5;
const horizon = [.78,.86,.95], fogDensity = .00032;
const outdoorTime = { value: 0 };
const grassFieldSize = 330, grassFieldRes = 331;
const grassBounds = { x0: meadow.x-grassFieldSize/2,x1: meadow.x+grassFieldSize/2,
  z0: meadow.z-grassFieldSize/2-12,z1: meadow.z+grassFieldSize/2-12 };
const obstacles = new Map(), obstacleCell = 4;
let terrainFloor = null;
let skyTitle = null, titleFade = 0, titleReached = false;

function fbm(x,z,octaves) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += amp*noise3(x,i*13.7,z); norm += amp; amp *= .5; x *= 2.03; z *= 2.03; }
  return sum/norm;
}
const valleyAlong = (x,z) => (x-meadow.x)*valley.x+(z-meadow.z)*valley.z;
const valleyAcross = (x,z) => (z-meadow.z)*valley.x-(x-meadow.x)*valley.z;
// The meadow's rim wanders: a periodic function of the bearing from its centre.
function meadowEdge(x,z) {
  const a = Math.atan2(z-meadow.z,x-meadow.x), c = Math.cos(a), s = Math.sin(a);
  return 74+11*noise3(c*1.7+5,0,s*1.7)+6*noise3(c*4.1,3,s*4.1);
}
// 1 on open grass, 0 under the forest: the meadow, and a grassy run down toward the valley.
function openGround(x,z) {
  const d = Math.hypot(x-meadow.x,z-meadow.z), edge = meadowEdge(x,z), a = valleyAlong(x,z), width = 38+.3*Math.max(0,a);
  const run = sstep(-10,50,a)*(1-sstep(560,760,a))*Math.exp(-1.6*(valleyAcross(x,z)/width)**2);
  return Math.max(1-sstep(edge-6,edge+6,d),Math.min(1,run*1.6));
}
function heightAt(x,z) {
  const d = Math.hypot(x-meadow.x,z-meadow.z), a = valleyAlong(x,z);
  let h = 1.3*fbm(x*.017,z*.017,3);
  const rim = sstep(60,330,d), hills = sstep(380,1500,d), range = sstep(1900,2900,d);
  if (rim > 0) h += rim*(11+9*fbm(x*.005+4,z*.005,3));
  if (hills > 0) h += hills*(40+60*fbm(x*.0013-7,z*.0013,4));
  if (range > 0) { const r = 1-Math.abs(fbm(x*.0011+2,z*.0011-5,5)); h += range*(110+300*r*r); }
  const v = sstep(20,240,a)*(1-sstep(2200,2800,a))*Math.exp(-((valleyAcross(x,z)/(80+.42*Math.max(0,a)))**2));
  if (v > 0) h += (-130*sstep(60,1000,a)+1.5*fbm(x*.008,z*.008,2)-h)*v;
  // Level ground around the bunker, with earth banked up its sides.
  const bx = Math.max(Math.abs(x)-bunkerHalf,0), bz = Math.max(bunkerBack-z,z-bunkerFront,0);
  h *= sstep(2.5,16,Math.hypot(bx,bz));
  if (z > bunkerBack-4 && z < bunkerFront && Math.abs(x) < bunkerHalf+6) {
    const bank = roofTop(Math.min(Math.max(z,bunkerBack),bunkerFront))-surfaceY-1.4;
    if (bank > 0) h += bank*(1-sstep(0,5.5,bx))*(1-sstep(bunkerFront-3.2,bunkerFront,z))*sstep(bunkerBack-4,bunkerBack,z);
  }
  return surfaceY+h;
}
// Where the blast scorched the ground: a ragged fan out of the hatch.
function scorchAt(x,z) {
  const ahead = z-bunkerFront;
  if (ahead < -1) return 0;
  return Math.exp(-((x/(1.4+ahead*.42))**2))*(1-sstep(0,8+4*noise3(x*.3,1,z*.3),ahead))*(.65+.35*noise3(x*.5,2,z*.5));
}
const inBunker = (x,z) => Math.abs(x) < bunkerHalf && z > bunkerBack && z < bunkerFront;
// The ground under a walker on the surface, or null anywhere else.
function groundHeight(x,z) {
  if (!collapsed || inBunker(x,z)) return null;
  return heightAt(x,z);
}
// Trees, stones, the hatch, and the edge of where a walker may go.
function outsideBlocked(x,z,y) {
  if (!collapsed || (y < surfaceY-12 && z < bunkerFront)) return false;
  // The cityward walk ends at the same baked field edge where grass stops growing.
  // Keep checking down the valley, even when its ground is below the bunker's elevation.
  if (valleyAlong(x,z) > 0 && (x-radius <= grassBounds.x0 || x+radius >= grassBounds.x1 ||
      z-radius <= grassBounds.z0 || z+radius >= grassBounds.z1)) return true;
  const d = Math.hypot(x-meadow.x,z-meadow.z);
  if (openGround(x,z) < .02 && d > meadowEdge(x,z)+38) return true;
  const cx = Math.floor(x/obstacleCell), cz = Math.floor(z/obstacleCell);
  for (let i = cx-1; i <= cx+1; i++) for (let j = cz-1; j <= cz+1; j++) {
    for (const o of obstacles.get(i+','+j) ?? []) if ((x-o.x)**2+(z-o.z)**2 < (radius+o.r)**2) return true;
  }
  return false;
}
function addObstacle(x,z,r) {
  const key = Math.floor(x/obstacleCell)+','+Math.floor(z/obstacleCell);
  if (!obstacles.has(key)) obstacles.set(key,[]);
  obstacles.get(key).push({ x,z,r });
}
const srgb = (r,g,b) => new THREE.Color().setRGB(r,g,b,THREE.SRGBColorSpace);
const mixRGB = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
// Shared GLSL for outdoor materials: a world position and normal, and a smooth value noise.
const outdoorNoise = `
  float outdoorHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float outdoorNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(outdoorHash(i),outdoorHash(i+vec2(1,0)),f.x),mix(outdoorHash(i+vec2(0,1)),outdoorHash(i+vec2(1,1)),f.x),f.y);
  }
`;
// The blades and flowers feel the same rolling gust, with a little individual nodding.
const meadowWindGLSL = `
  vec2 meadowWind(vec2 xz, float windTime, float phase) {
    float gust = .5+.5*sin(dot(xz,vec2(.09,.06))-windTime*1.3);
    return vec2(.8,.6)*(.12+.38*gust)+.06*vec2(sin(windTime*2.1+phase),cos(windTime*1.7+phase));
  }
`;
function withWorld(material,key,fragmentHead,fragmentBody,uniforms = {}) {
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader = 'varying vec3 vOutdoorWorld;\nvarying vec3 vOutdoorNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvOutdoorWorld = (modelMatrix*vec4(transformed,1.)).xyz;\nvOutdoorNormal = normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = 'varying vec3 vOutdoorWorld;\nvarying vec3 vOutdoorNormal;\n'+outdoorNoise+fragmentHead+'\n'+
      shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+fragmentBody);
  };
  return material;
}
function canvasTexture(size,draw) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

function buildSurface() {
  const G = surfaceY, W = bunkerHalf;
  scene.fog = new THREE.FogExp2(srgb(...horizon),fogDensity);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const sun = new THREE.DirectionalLight(srgb(1,.95,.86),2.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{ left: -60,right: 60,top: 60,bottom: -60,near: 1,far: 420 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  outdoors.add(sun,sun.target,new THREE.HemisphereLight(srgb(.76,.86,1),srgb(.34,.38,.2),1.15));

  // The sky: a dome that follows the eye, drawn first and behind everything. Blue overhead, pale at
  // the horizon to meet the fog, a glow around the sun and its disc, and drifting cumulus.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000,48,24),new THREE.ShaderMaterial({
    uniforms: { sunDirection: { value: sunDirection },time: outdoorTime,horizon: { value: new THREE.Vector3(...horizon) } },
    vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: outdoorNoise+`
      uniform vec3 sunDirection; uniform vec3 horizon; uniform float time; varying vec3 vDir;
      float clouds(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a*outdoorNoise(p); p = p*2.03+vec2(1.7,9.2); a *= .5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y, sd = max(dot(d,sunDirection),0.);
        vec3 col = mix(horizon,vec3(.47,.68,.93),smoothstep(0.,.28,h));
        col = mix(col,vec3(.2,.43,.8),smoothstep(.22,.95,h));
        col = mix(col,vec3(.66,.73,.74),smoothstep(0.,-.25,h));
        col += vec3(1.,.84,.6)*(.16*pow(sd,5.)+.3*pow(sd,40.));
        col = mix(col,vec3(1.,.99,.95),smoothstep(.99955,.9998,sd));
        if (h > 0.) {
          vec2 uv = d.xz/(h+.1)*1.4+vec2(time*.006,time*.002);
          float c = clouds(uv), lit = clouds(uv+sunDirection.xz*.05);
          float cover = smoothstep(.5,.75,c)*smoothstep(.0,.2,h);
          vec3 cloud = mix(vec3(.74,.79,.86),vec3(1.,.98,.95),clamp(.55+(c-lit)*5.,0.,1.))+vec3(1.,.85,.6)*.22*pow(sd,4.);
          col = mix(col,cloud,cover*.95);
        }
        gl_FragColor = vec4(col,1.);
      }`,
    side: THREE.BackSide,depthWrite: false,fog: false,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; outdoors.add(sky);

  // The ground: one grid, finest around the bunker and stretching out to the mountains. Colours are
  // baked per vertex; a fragment noise breaks up the grass close to, and the bunker's footprint is
  // cut out so its floor is the only surface inside it.
  const n = 256, spread = u => 240*u+2760*u*Math.abs(u)**3, rows = n+1;
  const positions = new Float32Array(rows*rows*3), colours = new Float32Array(rows*rows*3), indices = [];
  const tint = new THREE.Color();
  for (let j = 0; j < rows; j++) for (let i = 0; i < rows; i++) {
    const x = spread(i/n*2-1), z = 166+spread(j/n*2-1), y = heightAt(x,z), k = (j*rows+i)*3;
    positions.set([x,y,z],k);
    const open = openGround(x,z), rel = y-G, m = noise3(x*.011,2,z*.011), fine = noise3(x*.06,7,z*.06);
    let c = mixRGB([.27,.4,.12],[.5,.5,.2],sstep(-.1,.7,m)*.7);
    c = mixRGB(c,[.16,.29,.08],sstep(-.1,.7,fine)*.55);
    const canopy = mixRGB([.13,.25,.1],[.22,.35,.14],.5+.5*noise3(x*.03,4,z*.03));
    c = mixRGB(canopy,c,open);
    const lowland = sstep(-20,-50,rel);
    c = mixRGB(c,mixRGB([.48,.56,.27],[.6,.6,.38],.5+.5*noise3(x*.004,1,z*.004)),lowland*(1-open)*.7);
    c = mixRGB(c,[.55,.55,.52],sstep(700,300,Math.hypot(x-cityAt.x,z-cityAt.z))*.8);
    c = mixRGB(c,[.4,.43,.46],sstep(150,260,rel+40*noise3(x*.003,5,z*.003)));
    c = mixRGB(c,[.94,.95,.97],sstep(340,390,rel+30*noise3(x*.006,6,z*.006)));
    c = mixRGB(c,[.2,.15,.09],Math.min(1,scorchAt(x,z)*1.15));
    tint.setRGB(...c,THREE.SRGBColorSpace); colours.set([tint.r,tint.g,tint.b],k);
    if (i < n && j < n) { const a = j*rows+i; indices.push(a,a+rows,a+1,a+1,a+rows,a+rows+1); }
  }
  const terrainGeom = new THREE.BufferGeometry();
  terrainGeom.setAttribute('position',new THREE.BufferAttribute(positions,3));
  terrainGeom.setAttribute('color',new THREE.BufferAttribute(colours,3));
  terrainGeom.setIndex(indices); terrainGeom.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeom,withWorld(new THREE.MeshLambertMaterial({ vertexColors: true }),'terrain','uniform vec4 footprint;',`
    if (abs(vOutdoorWorld.x) < footprint.x && vOutdoorWorld.z > footprint.y && vOutdoorWorld.z < footprint.z) discard;
    float near = 1.-smoothstep(25.,140.,distance(cameraPosition,vOutdoorWorld));
    diffuseColor.rgb *= 1.+near*(.32*outdoorNoise(vOutdoorWorld.xz*2.3)+.2*outdoorNoise(vOutdoorWorld.xz*9.)-.26);`,
    { footprint: { value: new THREE.Vector4(W-.01,bunkerBack+.01,bunkerFront-.01,0) } }));
  terrain.receiveShadow = true; terrain.userData.surface = 'grass'; terrainFloor = terrain;
  outdoors.add(terrain);

  // The bunker, outside: weathered concrete mapped in world space, mossy where it faces the sky and
  // along the ground. The hatch wall's opening, reveal, and trim share the stair's sampled circle.
  const concreteMap = canvasTexture(512,ctx => {
    ctx.fillStyle = '#a19d93'; ctx.fillRect(0,0,512,512);
    for (let i = 0; i < 1400; i++) {
      const v = 120+hash3(i,1,77)*70|0, r = 2+hash3(i,2,77)**2*30;
      ctx.fillStyle = `rgba(${v},${v-4},${v-12},${.05+hash3(i,3,77)*.09})`;
      ctx.beginPath(); ctx.arc(hash3(i,4,77)*512,hash3(i,5,77)*512,r,0,7); ctx.fill();
    }
    for (let i = 0; i < 60; i++) {
      const x = hash3(i,6,77)*512, w = 2+hash3(i,7,77)*9, gradient = ctx.createLinearGradient(0,0,0,512);
      gradient.addColorStop(0,'rgba(60,58,50,.22)'); gradient.addColorStop(1,'rgba(60,58,50,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x,hash3(i,8,77)*200,w,200+hash3(i,9,77)*312);
    }
    ctx.fillStyle = 'rgba(70,68,62,.35)';
    for (let y = 0; y < 512; y += 128) ctx.fillRect(0,y,512,2);
  });
  const bunkerConcrete = withWorld(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),'bunker',
    'uniform sampler2D concreteMap; uniform float groundLine;',`
    vec3 tw = pow(abs(normalize(vOutdoorNormal)),vec3(4.)); tw /= tw.x+tw.y+tw.z;
    vec3 tex = texture2D(concreteMap,vOutdoorWorld.zy*.3).rgb*tw.x+texture2D(concreteMap,vOutdoorWorld.xz*.3).rgb*tw.y+texture2D(concreteMap,vOutdoorWorld.xy*.3).rgb*tw.z;
    diffuseColor.rgb *= tex;
    float moss = smoothstep(.5,.9,vOutdoorNormal.y)*smoothstep(.35,.6,outdoorNoise(vOutdoorWorld.xz*1.4));
    moss = max(moss,(1.-smoothstep(0.,.7,vOutdoorWorld.y-groundLine))*smoothstep(.3,.65,outdoorNoise(vec2(vOutdoorWorld.x+vOutdoorWorld.z,vOutdoorWorld.y)*2.2)));
    diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.2,.29,.08),moss*.8);`,
    { concreteMap: { value: concreteMap },groundLine: { value: G } });
  const solid = obj => { obj.castShadow = obj.receiveShadow = true; outdoors.add(obj); return obj; };
  const quad = (points,mat = bunkerConcrete) => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(k => points[k]),3));
    geom.computeVertexNormals();
    return solid(new THREE.Mesh(geom,mat));
  };
  for (const s of [-1,1]) quad([[s*W,G-1,bunkerBack],[s*W,G-1,bunkerFront],[s*W,roofTop(bunkerFront),bunkerFront],[s*W,roofTop(bunkerBack),bunkerBack]]);
  quad([[-W,roofTop(bunkerBack),bunkerBack],[W,roofTop(bunkerBack),bunkerBack],[W,roofTop(bunkerFront),bunkerFront],[-W,roofTop(bunkerFront),bunkerFront]]);
  // The back face starts at the stair ceiling, which it meets; any lower and it would cut across the stair.
  quad([[-W,stairCeiling(bunkerBack),bunkerBack],[W,stairCeiling(bunkerBack),bunkerBack],[W,roofTop(bunkerBack),bunkerBack],[-W,roofTop(bunkerBack),bunkerBack]]);
  const arc = hatchArc(hatchRadius);
  solid(wallOutline([[-W,G-1],[W,G-1],[W,roofTop(bunkerFront)],[-W,roofTop(bunkerFront)]],bunkerFront,bunkerConcrete,[arc]));
  for (let i = 0; i < arc.length-1; i++) {
    const [x0,y0] = arc[i], [x1,y1] = arc[i+1];
    quad([[x0,y0,hatchZ],[x1,y1,hatchZ],[x1,y1,bunkerFront],[x0,y0,bunkerFront]]);
  }
  const foot = arc[0][0];
  floors.push(quad([[foot,G,hatchZ],[-foot,G,hatchZ],[-foot,G,bunkerFront],[foot,G,bunkerFront]]));
  // Collision: the side walls, the low back, and the hatch wall either side of the opening.
  const jamb = Math.sqrt(hatchRadius**2-(hatchCentre-G-.08)**2);
  for (const [x0,x1,z0,z1] of [[-W,-1.2,bunkerBack,bunkerFront],[1.2,W,bunkerBack,bunkerFront],[-W,W,bunkerBack,bunkerBack+.3],
    [-1.2,-jamb,hatchZ,bunkerFront],[jamb,1.2,hatchZ,bunkerFront]]) {
    barriers.push({ box: new THREE.Box3(new THREE.Vector3(x0,G-.6,z0),new THREE.Vector3(x1,G+5,z1)) });
  }
  // A lip over the opening, a torn steel trim, the hinge brackets the hatch ripped away from, a
  // hazard band, and a ventilator on the roof.
  const steelPaint = new THREE.MeshLambertMaterial({ color: srgb(.36,.39,.36) });
  solid(new THREE.Mesh(new THREE.BoxGeometry(2.7,.16,.34),bunkerConcrete)).position.set(0,G+2.72,bunkerFront+.17);
  const trimRadius = hatchRadius+.07, trimStart = Math.asin((hatchCentre-G)/trimRadius);
  const trim = solid(new THREE.Mesh(new THREE.TorusGeometry(trimRadius,.06,8,64,Math.PI*.78),steelPaint));
  trim.rotation.z = -trimStart; trim.position.set(0,hatchCentre,bunkerFront);
  for (const [y,bend] of [[G+1.7,.5],[G+.4,-.3]]) {
    const bracket = solid(new THREE.Mesh(new THREE.BoxGeometry(.14,.32,.2),steelPaint));
    bracket.position.set(hatchRadius+.12,y,bunkerFront+.1); bracket.rotation.set(bend,.6,0);
  }
  const hazard = canvasTexture(256,ctx => {
    ctx.fillStyle = '#d9a72a'; ctx.fillRect(0,0,256,256); ctx.fillStyle = '#25231f';
    for (let x = -256; x < 512; x += 64) { ctx.beginPath(); ctx.moveTo(x,256); ctx.lineTo(x+32,256); ctx.lineTo(x+288,0); ctx.lineTo(x+256,0); ctx.fill(); }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(150,140,120,${hash3(i,1,55)*.5})`;
      ctx.fillRect(hash3(i,2,55)*256,hash3(i,3,55)*256,1+hash3(i,4,55)*7,1+hash3(i,5,55)*4);
    }
  });
  hazard.repeat.set(6,.5);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(2*W-.3,.34),new THREE.MeshLambertMaterial({ map: hazard }));
  band.position.set(0,G+3.7,bunkerFront+.004); band.receiveShadow = true; outdoors.add(band);
  const ventZ = 140.6, ventY = roofTop(ventZ);
  solid(new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,1.3,14),steelPaint)).position.set(-.9,ventY+.55,ventZ);
  solid(new THREE.Mesh(new THREE.CylinderGeometry(.34,.3,.14,18),steelPaint)).position.set(-.9,ventY+1.26,ventZ);
  // Soot from the blast, fading out from the opening.
  const soot = canvasTexture(256,ctx => {
    const gradient = ctx.createRadialGradient(128,128,60,128,128,128);
    gradient.addColorStop(0,'rgba(18,15,12,.92)'); gradient.addColorStop(.5,'rgba(18,15,12,.5)'); gradient.addColorStop(1,'rgba(18,15,12,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,256,256);
  });
  soot.wrapS = soot.wrapT = THREE.ClampToEdgeWrapping;
  const scorch = new THREE.Mesh(new THREE.RingGeometry(hatchRadius,hatchRadius+1.45,64,1,-trimStart,Math.PI+2*trimStart),
    new THREE.MeshLambertMaterial({ map: soot,transparent: true,depthWrite: false }));
  scorch.position.set(0,hatchCentre,bunkerFront+.006); outdoors.add(scorch);

  // The hatch itself, blown off and lying in the grass, its wheel still on it.
  const doorRadius = hatchRadius+.12, cut = Math.asin((hatchCentre-G)/doorRadius), outline = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI+cut-i/48*(Math.PI+2*cut);
    outline.push(new THREE.Vector2(doorRadius*Math.cos(a),doorRadius*Math.sin(a)));
  }
  const door = new THREE.Group();
  door.position.set(-3.3,G,153.2); door.rotation.set(-Math.PI/2+.1,0,.75); outdoors.add(door);
  const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(outline),{ depth: .14,bevelEnabled: false }),steelPaint);
  leaf.position.z = .06; door.add(leaf);
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: srgb(.62,.63,.6) });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.42,.04,8,32),wheelMaterial); rim.position.z = .3; door.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.84,.04,.04),wheelMaterial); spoke.position.z = .3; spoke.rotation.z = i*Math.PI/3; door.add(spoke);
  }
  door.traverse(obj => { if (obj.isMesh) obj.castShadow = obj.receiveShadow = true; });
  for (let k = 0; k < 6; k++) addObstacle(-3.3+Math.cos(k)*.6,153.2+Math.sin(k)*.5,.75);
  // Broken concrete thrown out across the grass.
  for (let k = 0; k < 26; k++) {
    const ahead = 1.5+hash3(k,1,41)**1.5*16, x = (hash3(k,2,41)-.5)*(1.5+ahead*.7), z = bunkerFront+ahead;
    const lane = Math.abs(x) < 1.5, r = lane ? .05+hash3(k,3,41)*.07 : .07+hash3(k,3,41)**2*.42, piece = solid(new THREE.Mesh(stone(r,k*5.1),bunkerConcrete));
    piece.position.set(x,heightAt(x,z)+r*.15,z); piece.rotation.set(hash3(k,4,41)*3,hash3(k,5,41)*6,0);
    if (r > .26) addObstacle(x,z,r*.9);
  }

  // Grass: a tile of blades that wraps around the walker, so it is always thick underfoot and thins
  // away to nothing at its edge. Ground height and how much grass grows come from a baked field.
  const fieldRes = grassFieldRes, fieldStep = grassFieldSize/(fieldRes-1), field = new Float32Array(fieldRes*fieldRes*2);
  const fieldX0 = grassBounds.x0, fieldZ0 = grassBounds.z0;
  for (let j = 0; j < fieldRes; j++) for (let i = 0; i < fieldRes; i++) {
    const x = fieldX0+i*fieldStep, z = fieldZ0+j*fieldStep, k = (j*fieldRes+i)*2;
    const edge = i === 0 || j === 0 || i === fieldRes-1 || j === fieldRes-1;
    const bx = Math.max(Math.abs(x)-bunkerHalf-.35,0), bz = Math.max(bunkerBack-.35-z,z-bunkerFront,0), ahead = z-bunkerFront;
    const fan = scorchAt(x,z);
    field[k] = heightAt(x,z);
    field[k+1] = edge ? 0 : sstep(.25,.7,openGround(x,z))*sstep(0,.4,Math.hypot(bx,bz))*(1-Math.min(1,fan*1.6))*(.75+.25*noise3(x*.08,9,z*.08));
  }
  const fieldTexture = new THREE.DataTexture(field,fieldRes,fieldRes,THREE.RGFormat,THREE.FloatType);
  fieldTexture.needsUpdate = true;
  // Two layers share one shader: a dense tile of shaped blades close to, and a wide tile of single
  // triangles, fewer and broader, that takes over as the first fades and carries the meadow out to
  // 125 m. Each wraps around the walker and thins out across its own band of distance.
  function grassBlades(tile,blades,shape,index,width,seed) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(shape,3)); geometry.setIndex(index);
    const place = new Float32Array(blades*4), look = new Float32Array(blades*4);
    for (let i = 0; i < blades; i++) {
      place.set([hash3(i,1,seed)*tile,hash3(i,2,seed)*tile,hash3(i,3,seed)*Math.PI*2,(hash3(i,4,seed)-.5)*.5],i*4);
      look.set([.32+hash3(i,5,seed)**1.6*.55,width[0]+hash3(i,6,seed)*(width[1]-width[0]),hash3(i,7,seed),hash3(i,8,seed)*6.28],i*4);
    }
    geometry.setAttribute('place',new THREE.InstancedBufferAttribute(place,4));
    geometry.setAttribute('look',new THREE.InstancedBufferAttribute(look,4));
    geometry.instanceCount = blades;
    return geometry;
  }
  const grassUniforms = {
    field: { value: fieldTexture },fieldBounds: { value: new THREE.Vector4(fieldX0,fieldZ0,fieldStep,fieldRes) },
    focus: { value: new THREE.Vector3() },time: outdoorTime,sunDirection: { value: sunDirection },
    fogTint: { value: new THREE.Vector3(...horizon) },fogDensity: { value: fogDensity },
    shadowMap: { value: null },shadowMatrix: { value: sun.shadow.matrix },shadowOn: { value: 0 },
  };
  const grassMaterial = (tile,band,thin) => new THREE.ShaderMaterial({
    uniforms: { ...grassUniforms,tile: { value: tile },band: { value: new THREE.Vector4(...band) },thin: { value: new THREE.Vector4(...thin) } },side: THREE.DoubleSide,
    vertexShader: `
      uniform sampler2D field; uniform vec4 fieldBounds, band, thin; uniform vec3 focus; uniform float tile, time; uniform mat4 shadowMatrix;
      attribute vec4 place; attribute vec4 look;
      varying float vT, vTint; varying vec3 vWorld; varying vec4 vShadow;
      ${meadowWindGLSL}
      vec2 fieldAt(vec2 xz) {
        vec2 g = clamp((xz-fieldBounds.xy)/fieldBounds.z,vec2(0.),vec2(fieldBounds.w-1.001));
        ivec2 i = ivec2(floor(g)); vec2 f = fract(g);
        vec2 a = texelFetch(field,i,0).rg, b = texelFetch(field,i+ivec2(1,0),0).rg;
        vec2 c = texelFetch(field,i+ivec2(0,1),0).rg, d = texelFetch(field,i+ivec2(1,1),0).rg;
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      void main() {
        vec2 rel = mod(place.xy-focus.xz+tile*.5,tile)-tile*.5, xz = focus.xz+rel;
        vec2 ground = fieldAt(xz);
        float t = position.y, reach = length(rel);
        // Fewer, wider blades with distance; grown in and gone again across the layer's band.
        float far = smoothstep(thin.x,thin.y,reach), keep = mix(1.,thin.z,far);
        float h = look.x*ground.y*step(fract(look.w*7.31),keep)*smoothstep(band.x,band.y,reach)*(1.-smoothstep(band.z,band.w,reach));
        float c = cos(place.z), s = sin(place.z), width = look.y*mix(1.,thin.w,far);
        vec3 p = vec3(position.x*width*c,t*h,position.x*width*s);
        // Gusts roll across the meadow; each blade also nods on its own.
        vec2 bend = meadowWind(xz,time,look.w)+vec2(c,s)*place.w;
        p.xz += bend*t*t*h; p.y -= .35*dot(bend,bend)*t*t*h;
        vec4 world = vec4(xz.x+p.x,ground.x+p.y-.02,xz.y+p.z,1.);
        vT = t; vTint = look.z; vWorld = world.xyz; vShadow = shadowMatrix*world;
        gl_Position = projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader: `
      #include <packing>
      uniform sampler2D shadowMap; uniform float shadowOn, fogDensity; uniform vec3 fogTint, sunDirection;
      varying float vT, vTint; varying vec3 vWorld; varying vec4 vShadow;
      float sunlit() {
        vec3 c = vShadow.xyz/vShadow.w;
        if (shadowOn < .5 || any(lessThan(c,vec3(0.))) || any(greaterThan(c,vec3(1.)))) return 1.;
        float lit = 0.;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
          lit += step(c.z-.002,unpackRGBAToDepth(textureLod(shadowMap,c.xy+vec2(i,j)/2048.,0.)));
        return lit/9.;
      }
      void main() {
        vec3 root = mix(vec3(.09,.17,.04),vec3(.17,.26,.06),vTint), tip = mix(vec3(.36,.52,.16),vec3(.6,.62,.28),vTint*vTint*vTint);
        vec3 col = mix(root,tip,smoothstep(0.,1.,vT));
        float lit = sunlit();
        col *= (.5+.55*lit)*(.85+.3*fract(vTint*13.7));
        col += vec3(.3,.26,.08)*pow(max(dot(normalize(vWorld-cameraPosition),sunDirection),0.),3.)*vT*lit;
        float fog = 1.-exp(-pow(fogDensity*distance(cameraPosition,vWorld),2.));
        gl_FragColor = vec4(mix(col,fogTint,fog),1.);
      }`,
  });
  const nearGrass = new THREE.Mesh(grassBlades(76,150000,[-.5,0,0,.5,0,0,-.4,.45,0,.4,.45,0,0,1,0],[0,1,2,1,3,2,2,3,4],[.05,.1],61),
    grassMaterial(76,[-1,0,28,37],[9,34,.3,1.9]));
  const farGrass = new THREE.Mesh(grassBlades(260,140000,[-.5,0,0,.5,0,0,0,1,0],[0,1,2],[.14,.24],62),
    grassMaterial(260,[27,37,105,125],[37,125,.35,2.2]));
  for (const layer of [nearGrass,farGrass]) { layer.frustumCulled = false; outdoors.add(layer); }

  // Wildflowers in drifts across the meadow: daisies, buttercups, cornflowers, poppies, and clover.
  const palette = [[.97,.96,.9],[.98,.82,.18],[.36,.45,.92],[.86,.18,.12],[.82,.5,.78]];
  function flowerMaterial(material) {
    material.customProgramCacheKey = () => 'meadow-flower-wind';
    material.onBeforeCompile = shader => {
      shader.uniforms.flowerTime = outdoorTime;
      shader.vertexShader = 'attribute vec4 flowerPose;\nattribute float flowerPhase;\nuniform float flowerTime;\n'+meadowWindGLSL+shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 flowerPoint = (instanceMatrix*vec4(transformed,1.)).xyz;
        float stemT = clamp((flowerPoint.y-flowerPose.y)/flowerPose.w,0.,1.);
        vec2 bend = .55*meadowWind(flowerPose.xz,flowerTime,flowerPhase)+.12*vec2(cos(flowerPhase),sin(flowerPhase));
        vec3 offset = vec3(bend.x,-.35*dot(bend,bend),bend.y)*stemT*stemT*flowerPose.w;
        // Convert the shared bend back through each part's rotation and scale.
        // Roots stay planted, and the bloom and leaves follow the stem at their own height.
        vec3 sx = instanceMatrix[0].xyz, sy = instanceMatrix[1].xyz, sz = instanceMatrix[2].xyz;
        transformed += vec3(dot(sx,offset),dot(sy,offset),dot(sz,offset))/vec3(dot(sx,sx),dot(sy,sy),dot(sz,sz));`);
    };
    return material;
  }
  function greenFlowerPart(geometry) {
    const positions = geometry.attributes.position, colours = [];
    const root = srgb(.38,.57,.18), tip = srgb(.61,.76,.32), colour = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      colour.copy(root).lerp(tip,positions.getY(i)); colours.push(colour.r,colour.g,colour.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
    return geometry;
  }
  const leafPositions = [], leafIndices = [];
  for (const [height,angle,length] of [[.28,0,.09],[.48,Math.PI,.1],[.68,1.1,.07]]) {
    const c = Math.cos(angle), s = Math.sin(angle), width = length*.24, start = leafPositions.length/3;
    // A pointed leaf with a raised central vein and two folded sides.
    leafPositions.push(0,height,0, c*length*.52-s*width,height+.06,s*length*.52+c*width,
      c*length*.52,height+.085,s*length*.52, c*length*.52+s*width,height+.06,s*length*.52-c*width,
      c*length,height+.15,s*length);
    leafIndices.push(start,start+1,start+2,start,start+2,start+3,start+1,start+4,start+2,start+2,start+4,start+3);
  }
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
  leafGeometry.setIndex(leafIndices); leafGeometry.computeVertexNormals();
  const green = flowerMaterial(new THREE.MeshLambertMaterial({ vertexColors: true,side: THREE.DoubleSide,
    emissive: srgb(.2,.29,.06),emissiveIntensity: .25 }));
  const flowerCount = 9000, heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.06,0).scale(1,.5,1),flowerMaterial(new THREE.MeshLambertMaterial()),flowerCount);
  const stems = new THREE.InstancedMesh(greenFlowerPart(new THREE.CylinderGeometry(.006,.012,1,5,5).translate(0,.5,0)),green,flowerCount);
  const leaves = new THREE.InstancedMesh(greenFlowerPart(leafGeometry),green,flowerCount);
  heads.name = 'flower-heads'; stems.name = 'flower-stems'; leaves.name = 'flower-leaves';
  const flowerPoses = new Float32Array(flowerCount*4), flowerPhases = new Float32Array(flowerCount);
  const placed = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0,1,0), scale = new THREE.Vector3();
  let flowers = 0;
  for (let k = 0; k < flowerCount*4 && flowers < flowerCount; k++) {
    const patch = Math.floor(hash3(k,1,71)*60), a = hash3(patch,2,71)*Math.PI*2, r = Math.sqrt(hash3(patch,3,71))*95;
    const spreadOut = 3+hash3(patch,4,71)*7, x = meadow.x+Math.cos(a)*r+(hash3(k,5,71)-.5)*2*spreadOut, z = meadow.z+Math.sin(a)*r+(hash3(k,6,71)-.5)*2*spreadOut;
    if (openGround(x,z) < .6 || Math.hypot(x,z-bunkerFront) < 6 || inBunker(x,z)) continue;
    const y = heightAt(x,z), tall = .2+hash3(k,7,71)*.3;
    heads.setMatrixAt(flowers,placed.compose(new THREE.Vector3(x,y+tall,z),q.setFromAxisAngle(up,hash3(k,8,71)*6),scale.set(1,1,1)));
    heads.setColorAt(flowers,srgb(...palette[patch%palette.length]).multiplyScalar(.85+hash3(k,9,71)*.3));
    // Sink the root slightly into the terrain and meet the centre of the bloom.
    stems.setMatrixAt(flowers,placed.compose(new THREE.Vector3(x,y-.025,z),q,scale.set(1,tall+.025,1)));
    leaves.setMatrixAt(flowers,placed);
    flowerPoses.set([x,y-.025,z,tall+.025],flowers*4); flowerPhases[flowers] = hash3(k,10,71)*Math.PI*2;
    flowers++;
  }
  const flowerPose = new THREE.InstancedBufferAttribute(flowerPoses,4), flowerPhase = new THREE.InstancedBufferAttribute(flowerPhases,1);
  for (const part of [heads,stems,leaves]) {
    part.count = flowers; part.geometry.setAttribute('flowerPose',flowerPose); part.geometry.setAttribute('flowerPhase',flowerPhase);
    outdoors.add(part);
  }

  // Trees: broadleaf, birch, and spruce near the meadow, simpler shapes further out. Canopies are
  // lumpy blobs shaded as one soft mass, and they sway.
  function part(geometry,colour,shade = null) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry, p = g.attributes.position, c = [];
    for (let i = 0; i < p.count; i++) {
      const k = shade ? shade(p.getY(i)) : 1;
      const col = srgb(colour[0]*k,colour[1]*k,colour[2]*k); c.push(col.r,col.g,col.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    return g;
  }
  function merge(parts) {
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position','normal','color']) {
      const arrays = parts.map(p => p.attributes[name].array), out = new Float32Array(arrays.reduce((s,a) => s+a.length,0));
      let o = 0; for (const a of arrays) { out.set(a,o); o += a.length; }
      geometry.setAttribute(name,new THREE.BufferAttribute(out,3));
    }
    return geometry;
  }
  function canopy(blobs,colour,detail,low,high) {
    const centre = new THREE.Vector3(), v = new THREE.Vector3(), radial = new THREE.Vector3();
    for (const [, x,y,z] of blobs) centre.add(v.set(x,y,z)); centre.divideScalar(blobs.length);
    return blobs.map(([r,x,y,z],b) => {
      const g = new THREE.IcosahedronGeometry(r,detail), p = g.attributes.position, nrm = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p,i); v.multiplyScalar(1+.2*noise3(v.x*1.4/r+b*3,v.y*1.4/r,v.z*1.4/r)); v.y *= .86; v.add(radial.set(x,y,z));
        p.setXYZ(i,v.x,v.y,v.z);
        radial.copy(v).sub(centre).normalize().multiplyScalar(.6).add(v.sub(new THREE.Vector3(x,y,z)).normalize().multiplyScalar(.4)).normalize();
        nrm.setXYZ(i,radial.x,radial.y,radial.z);
      }
      return part(g,colour,y => .72+.38*sstep(low,high,y));
    });
  }
  const trunk = (r0,r1,h,colour,sides = 10) => part(new THREE.CylinderGeometry(r1,r0,h,sides,1,true).translate(0,h/2,0),colour);
  // Limbs fork from the trunk's top into the canopy, so the crown sits on wood rather than air.
  const limb = (from,to,r,colour) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), g = new THREE.CylinderGeometry(r*.6,r,a.distanceTo(b),7,1,true);
    g.translate(0,a.distanceTo(b)/2,0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())).translate(...from);
    return part(g,colour);
  };
  // A spruce tier: a cone whose rim is ragged and droops, so tiers read as boughs, not lampshades.
  const tier = (r,h,y,segments,seed) => {
    const g = new THREE.ConeGeometry(r,h,segments,2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p,i);
      const rim = (.5-v.y/h)*2, angle = Math.atan2(v.z,v.x), jag = 1+.18*rim*noise3(Math.cos(angle)*2.3+seed,seed,Math.sin(angle)*2.3);
      p.setXYZ(i,v.x*jag,v.y-rim*rim*.25*r*(jag-.82),v.z*jag);
    }
    g.computeVertexNormals();
    return part(g.translate(0,y,0),[.15,.31,.17],yy => .7+.4*sstep(1.5,9,yy));
  };
  const bark = [.33,.25,.17], birchBark = [.86,.84,.78];
  const oakCrown = [[2.2,0,5.1,0],[1.8,1.3,4.5,.7],[1.7,-1.2,4.7,-.5],[1.5,.3,6.2,-.4],[1.3,-.5,5.6,1.2],[1.25,.9,5.5,-1.3]];
  const birchCrown = [[1.25,0,6.5,0],[1.05,.6,5.7,.4],[1,-.65,5.9,-.3],[.85,.15,7.3,.2]];
  const spruceTiers = detail => [[2.4,3.4,2.9],[2,3,4.2],[1.6,2.7,5.4],[1.2,2.4,6.5],[.85,2,7.5],[.5,1.6,8.4]]
    .map(([r,h,y],k) => tier(r,h,y,detail,k*1.7));
  const shapes = {
    // Close: the meadow's edge, where a walker can stand under them.
    oakClose: merge([trunk(.34,.2,4,bark),limb([0,3.3,0],[1.2,4.6,.6],.15,bark),limb([0,3.5,0],[-1.1,4.8,-.5],.14,bark),limb([0,3.7,0],[.2,5.6,-.3],.13,bark),
      ...canopy(oakCrown,[.3,.47,.16],2,3,7.4)]),
    birchClose: merge([trunk(.15,.08,7,birchBark),limb([0,5,0],[.6,5.8,.4],.06,birchBark),limb([0,5.2,0],[-.6,6,-.3],.06,birchBark),
      ...canopy(birchCrown,[.46,.62,.22],2,4.6,8)]),
    spruceClose: merge([trunk(.26,.1,8.6,bark),...spruceTiers(16)]),
    oak: merge([trunk(.32,.2,3.6,bark,8),...canopy(oakCrown.slice(0,4),[.3,.47,.16],1,3,7)]),
    birch: merge([trunk(.15,.09,6.4,birchBark,8),...canopy(birchCrown.slice(0,3),[.46,.62,.22],1,4.6,7.6)]),
    spruce: merge([trunk(.24,.12,2,bark,8),...spruceTiers(10).slice(0,5)]),
    oakFar: merge(canopy([[2.6,0,4.8,0]],[.3,.46,.17],1,2.5,7)),
    spruceFar: merge([part(new THREE.ConeGeometry(2.1,7.2,8).translate(0,4.4,0),[.15,.3,.17])]),
  };
  const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  treeMaterial.customProgramCacheKey = () => 'tree';
  treeMaterial.onBeforeCompile = shader => {
    shader.uniforms.windTime = outdoorTime;
    shader.vertexShader = 'uniform float windTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 root = vec3(instanceMatrix[3]);
      float bend = max(position.y-2.,0.)*.016;
      transformed.x += bend*sin(windTime*1.1+root.x*.05+root.z*.03);
      transformed.z += bend*.6*sin(windTime*.83+root.z*.05);`);
  };
  const placements = { oakClose: [],birchClose: [],spruceClose: [],oak: [],birch: [],spruce: [],oakFar: [],spruceFar: [] };
  const cityClear = (x,z) => Math.hypot(x-cityAt.x,z-cityAt.z) > 650;
  for (const [step,from,to,far] of [[5.5,0,200,false],[11,200,1000,true]]) {
    for (let gx = -to; gx < to; gx += step) for (let gz = -to; gz < to; gz += step) {
      const jx = hash3(gx,gz,11), jz = hash3(gx,gz,12), x = meadow.x+gx+jx*step, z = meadow.z+gz+jz*step;
      const d = Math.hypot(x-meadow.x,z-meadow.z);
      if (d < from || d >= to) continue;
      const open = openGround(x,z), roll = hash3(gx,gz,13);
      if (roll < open*1.6+.12 || !cityClear(x,z) || Math.hypot(x,z-(bunkerBack+bunkerFront)/2) < 14) continue;
      const y = heightAt(x,z);
      if (y-surfaceY > 230 || (y-surfaceY < -40 && roll < .6)) continue;
      const pick = hash3(gx,gz,14), close = !far && (d < meadowEdge(x,z)+45 || open > .005) ? 'Close' : '';
      const kind = far ? (pick < .45 ? 'spruceFar' : 'oakFar') : (pick < .38 ? 'spruce' : pick < .55 ? 'birch' : 'oak')+close;
      const size = .7+hash3(gx,gz,15)**1.5*.95, hue = hash3(gx,gz,16);
      placements[kind].push({ x,y,z,size,turn: hash3(gx,gz,17)*6.28,colour: [.86+hue*.22,.9+hash3(gx,gz,18)*.2,.82+(1-hue)*.2] });
      if (d < meadowEdge(x,z)+60 || open > .005) addObstacle(x,z,(kind.startsWith('birch') ? .14 : kind.startsWith('spruce') ? .22 : .3)*size+.05);
    }
  }
  for (const [kind,list] of Object.entries(placements)) {
    const trees = new THREE.InstancedMesh(shapes[kind],treeMaterial,list.length);
    list.forEach((t,i) => {
      trees.setMatrixAt(i,placed.compose(new THREE.Vector3(t.x,t.y-.15,t.z),q.setFromAxisAngle(up,t.turn),scale.setScalar(t.size)));
      trees.setColorAt(i,new THREE.Color(...t.colour));
    });
    trees.castShadow = !kind.endsWith('Far'); trees.receiveShadow = true;
    outdoors.add(trees);
  }

  // A few boulders out in the grass, mossy on top.
  for (let k = 0; k < 7; k++) {
    const a = 1.1+k*.83+hash3(k,1,91)*.5, r = 18+hash3(k,2,91)*48, x = meadow.x+Math.cos(a)*r, z = meadow.z+Math.sin(a)*r;
    if (openGround(x,z) < .8 || Math.hypot(x,z-bunkerFront) < 10) continue;
    const size = .5+hash3(k,3,91)*1.1, g = stone(size,k*7.7+3), p = g.attributes.position, nrm = g.attributes.normal, c = [], v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      // Weathered round: shaded from the boulder's centre rather than facet by facet.
      v.fromBufferAttribute(p,i).multiply(scale.set(1,1.4,1)).normalize(); nrm.setXYZ(i,v.x,v.y,v.z);
      const moss = sstep(.1,.6,v.y+.25*noise3(p.getX(i)*3,p.getY(i)*3,p.getZ(i)*3));
      const col = srgb(...mixRGB([.52,.51,.47],[.3,.4,.15],moss)); c.push(col.r,col.g,col.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    const boulder = solid(new THREE.Mesh(g,new THREE.MeshLambertMaterial({ vertexColors: true })));
    boulder.position.set(x,heightAt(x,z)+size*.15,z); boulder.rotation.y = hash3(k,4,91)*6;
    addObstacle(x,z,size*.95);
  }

  // The city down the valley, on a street grid turned to the valley. Towers stand on podiums in a
  // dense core, with setbacks, crowns, and plant on their roofs; blocks lower and split into more
  // lots toward the edges. Facades are drawn in the shader, as floor bands and window grids in stone
  // or glass. Each grid fades to its average tone as it shrinks below a pixel, so from the meadow the
  // city reads as built rather than as boxes, and nothing shimmers.
  const cityTurn = .33, cityCos = Math.cos(cityTurn), citySin = Math.sin(cityTurn), boxes = [];
  const cityPoint = (u,v) => [cityAt.x+u*cityCos+v*citySin,cityAt.z-u*citySin+v*cityCos];
  const cityPalette = { stone: [[.76,.74,.69],[.82,.77,.67],[.68,.63,.57],[.86,.86,.84],[.62,.6,.58]],glass: [[.42,.52,.62],[.33,.42,.5],[.5,.6,.64],[.56,.58,.62]] };
  // A box: centre of its footprint in grid space, size, base height above the ground, style, colour.
  const addBox = (u,v,w,d,h,lift,style,colour,seed) => boxes.push({ u,v,w,d,h,lift,style,colour,seed });
  const block = 88, street = 20, lot = block-street;
  for (let i = -7; i <= 7; i++) for (let j = -5; j <= 5; j++) {
    const u0 = i*block, v0 = j*block, edge = (u0/640)**2+(v0/430)**2+.25*noise3(i*.7,3,j*.7);
    if (edge > 1) continue;
    const core = Math.exp(-((Math.hypot(u0*.8,v0*1.15)/330)**2)), split = core > .45 ? 1 : hash3(i,j,40) < .5 ? 2 : 4;
    const lots = split === 1 ? [[0,0,lot,lot]] : split === 2 ? [[-lot/4,0,lot/2-4,lot],[lot/4,0,lot/2-4,lot]]
      : [[-lot/4,-lot/4],[lot/4,-lot/4],[-lot/4,lot/4],[lot/4,lot/4]].map(([du,dv]) => [du,dv,lot/2-4,lot/2-4]);
    lots.forEach(([du,dv,w,d],k) => {
      const seed = hash3(i*7+k,j,41), u = u0+du, v = v0+dv, glass = hash3(i,j*5+k,42) < .25+.5*core;
      const style = glass ? 1 : 0, colour = (glass ? cityPalette.glass : cityPalette.stone)[Math.floor(hash3(i,j+k,43)*(glass ? 4 : 5))];
      const h = 12+seed**2*36+core*(45+hash3(i+k,j,44)**.9*250)*(1-.3*Math.min(1,edge));
      if (h < 60) {
        addBox(u,v,w*.9,d*.9,h,0,style,colour,seed);
        if (hash3(k,i,j) < .6) addBox(u+(seed-.5)*w*.4,v,w*.3,d*.25,2.5+seed*3,h,0,[.6,.6,.58],seed);
        return;
      }
      // A tower: a podium, the shaft, a setback or two, and plant or a mast on top.
      const podium = 10+seed*12, shaftW = w*(.5+.2*hash3(i,k,45)), shaftD = d*(.5+.2*hash3(j,k,46));
      addBox(u,v,w*.95,d*.95,podium,0,0,cityPalette.stone[k%5],seed);
      const first = h*(.62+.2*hash3(i,j,47));
      addBox(u,v,shaftW,shaftD,first-podium,podium,style,colour,seed);
      addBox(u,v,shaftW*.8,shaftD*.8,(h-first)*.7,first,style,colour,seed+.3);
      addBox(u,v,shaftW*.6,shaftD*.6,(h-first)*.3,first+(h-first)*.7,style,colour,seed+.6);
      addBox(u,v,shaftW*.35,shaftD*.3,5,h,0,[.55,.55,.55],seed);
      if (hash3(i,j,48) < .25) addBox(u,v,1.6,1.6,25+seed*30,h+5,0,[.7,.7,.72],seed);
    });
  }
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),new THREE.MeshLambertMaterial(),boxes.length);
  const facade = new Float32Array(boxes.length*2);
  boxes.forEach((box,i) => {
    const [x,z] = cityPoint(box.u,box.v), base = heightAt(x,z)-4+box.lift+(box.lift ? 4 : 0);
    buildings.setMatrixAt(i,placed.compose(new THREE.Vector3(x,base,z),q.setFromAxisAngle(up,cityTurn),scale.set(box.w,box.h+(box.lift ? 0 : 4),box.d)));
    buildings.setColorAt(i,srgb(...box.colour));
    facade.set([box.style,box.seed],i*2);
  });
  buildings.geometry.setAttribute('facade',new THREE.InstancedBufferAttribute(facade,2));
  buildings.material.customProgramCacheKey = () => 'city';
  buildings.material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec2 facade;\nvarying vec2 vFacade;\nvarying vec3 vBox;\nvarying vec3 vBoxNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvFacade = facade; vBoxNormal = normal;\nvBox = position*vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));');
    shader.fragmentShader = 'varying vec2 vFacade;\nvarying vec3 vBox;\nvarying vec3 vBoxNormal;\n'+outdoorNoise+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 side = abs(vBoxNormal);
      if (side.y < .5) {
        bool glass = vFacade.x > .5;
        vec2 period = glass ? vec2(1.6,3.8) : vec2(3.3,3.6), margin = glass ? vec2(.06,.12) : vec2(.24,.3);
        vec2 cell = vec2(side.x > .5 ? vBox.z : vBox.x,vBox.y)/period, f = fract(cell), w = fwidth(cell);
        vec2 open = smoothstep(margin-w,margin+w,f)-smoothstep(1.-margin-w,1.-margin+w,f);
        float pane = mix(open.x*open.y,(1.-2.*margin.x)*(1.-2.*margin.y),smoothstep(.3,.65,max(w.x,w.y)));
        // Glass catches more sky the higher it is; panes vary, a few with blinds drawn.
        float n = outdoorHash(floor(cell)+vFacade.y*37.);
        vec3 tint = mix(vec3(.13,.17,.22),vec3(.5,.6,.72),clamp(vBox.y/180.,0.,1.)*.5+.25*n);
        tint = mix(tint,vec3(.7,.68,.6),step(.93,n)*.6);
        diffuseColor.rgb = mix(diffuseColor.rgb,glass ? mix(tint,diffuseColor.rgb,.35) : tint,pane);
        // Darker shopfronts at street level on stone buildings.
        diffuseColor.rgb *= 1.-.35*(1.-step(5.,vBox.y))*step(.5,1.-step(.5,vFacade.x));
      } else diffuseColor.rgb *= .78;`);
  };
  outdoors.add(buildings);
  // Three landmark towers: tapering stages banded with floors, and a spire.
  const landmark = new THREE.MeshLambertMaterial({ color: srgb(.5,.6,.7) }), trimMaterial = new THREE.MeshLambertMaterial({ color: srgb(.8,.81,.82) });
  for (const [du,dv,h] of [[30,-20,340],[-110,50,290],[140,70,255]]) {
    const [x,z] = cityPoint(du,dv), base = heightAt(x,z)-4;
    let y = base, r = 21;
    for (const share of [.5,.3,.2]) {
      const stage = new THREE.Mesh(new THREE.CylinderGeometry(r*.92,r,h*share,24).translate(0,h*share/2,0),landmark);
      stage.position.set(x,y,z); outdoors.add(stage);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r*.97,r*.97,2.5,24),trimMaterial);
      ring.position.set(x,y+h*share,z); outdoors.add(ring);
      y += h*share; r *= .78;
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.5,70,8).translate(0,35,0),trimMaterial);
    spire.position.set(x,y,z); outdoors.add(spire);
  }

  // The title is a fixed plane over the valley, facing the meadow, rather than following the eye.
  const titleCanvas = document.createElement('canvas'); titleCanvas.width = 2048; titleCanvas.height = 320;
  const titleContext = titleCanvas.getContext('2d'), titleText = 'SUBSTRUCTURE', tracking = 14;
  titleContext.font = '240px ISOCPEUR'; titleContext.textBaseline = 'middle'; titleContext.fillStyle = '#f1f3e9';
  const titleWidth = [...titleText].reduce((sum,letter) => sum+titleContext.measureText(letter).width,0)+tracking*(titleText.length-1);
  let titleX = (titleCanvas.width-titleWidth)/2;
  for (const letter of titleText) {
    titleContext.fillText(letter,titleX,titleCanvas.height/2);
    titleX += titleContext.measureText(letter).width+tracking;
  }
  const titleTexture = new THREE.CanvasTexture(titleCanvas); titleTexture.colorSpace = THREE.SRGBColorSpace;
  skyTitle = new THREE.Mesh(new THREE.PlaneGeometry(150,150*titleCanvas.height/titleCanvas.width),
    new THREE.MeshBasicMaterial({ map: titleTexture,transparent: true,opacity: 0,depthWrite: false,
      fog: false,toneMapped: false,side: THREE.DoubleSide }));
  skyTitle.name = 'sky-title';
  skyTitle.position.set(meadow.x+valley.x*230,G+90,meadow.z+valley.z*230);
  skyTitle.lookAt(meadow.x,skyTitle.position.y,meadow.z); outdoors.add(skyTitle);

  // Birds wheeling high over the meadow, and pollen drifting in the sunlight around the walker.
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.14,0,0,.14,.62,0,.04],3)); wing.computeVertexNormals();
  const birdMaterial = new THREE.MeshBasicMaterial({ color: srgb(.18,.18,.2),side: THREE.DoubleSide });
  const flock = Array.from({ length: 9 },(_,i) => {
    const group = new THREE.Group(), left = new THREE.Mesh(wing,birdMaterial), right = new THREE.Mesh(wing,birdMaterial);
    right.scale.x = -1; group.add(left,right); outdoors.add(group);
    return { group,left,right,phase: hash3(i,1,51)*6.28,radius: 45+hash3(i,2,51)*40,height: 38+hash3(i,3,51)*30,speed: .09+hash3(i,4,51)*.06,offset: i*.31 };
  });
  const motes = 260, motePositions = new Float32Array(motes*3), moteBase = Array.from({ length: motes*3 },(_,i) => hash3(i,1,81)*16);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position',new THREE.BufferAttribute(motePositions,3));
  const moteSprite = canvasTexture(32,ctx => {
    const gradient = ctx.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,'rgba(255,255,255,1)'); gradient.addColorStop(.4,'rgba(255,255,255,.5)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,32,32);
  });
  const pollen = new THREE.Points(moteGeometry,new THREE.PointsMaterial({ color: srgb(1,.95,.78),map: moteSprite,size: .035,transparent: true,opacity: .9,depthWrite: false }));
  pollen.frustumCulled = false; outdoors.add(pollen);

  updateSurface = dt => {
    // Shown from the foot of the stair, where the hatch is a speck of daylight at the top.
    const show = player.z > receptionEnd;
    if (show !== outdoors.visible) {
      outdoors.visible = show;
      camera.far = show ? 9000 : 110; camera.updateProjectionMatrix();
    }
    if (!show) return;
    if (playing && !inBunker(player.x,player.z) && player.z > bunkerFront && player.y > G-2) titleReached = true;
    if (titleReached && playing) {
      titleFade = Math.min(1,titleFade+dt/3);
      skyTitle.material.opacity = titleFade*titleFade*(3-2*titleFade);
    }
    outdoorTime.value = time.value;
    sky.position.copy(camera.position);
    sun.target.position.set(player.x,player.y,player.z); sun.position.copy(sun.target.position).addScaledVector(sunDirection,200);
    grassUniforms.focus.value.copy(camera.position);
    if (sun.shadow.map) { grassUniforms.shadowMap.value = sun.shadow.map.texture; grassUniforms.shadowOn.value = 1; }
    const t = time.value;
    for (const bird of flock) {
      const a = t*bird.speed+bird.offset, glide = Math.sin(t*.45+bird.phase) > .2;
      bird.group.position.set(meadow.x+Math.cos(a)*bird.radius,surfaceY+bird.height+Math.sin(t*.3+bird.phase)*3,meadow.z+Math.sin(a)*bird.radius);
      bird.group.rotation.set(0,-a,.25);
      const flap = glide ? .12 : Math.sin(t*8+bird.phase)*.7;
      bird.left.rotation.z = flap; bird.right.rotation.z = -flap;
    }
    for (let i = 0; i < motes; i++) {
      for (let c = 0; c < 3; c++) {
        const drift = moteBase[i*3+c]+Math.sin(t*(.21+c*.07)+i*1.7)*.6+(c === 0 ? t*.25 : c === 2 ? t*.18 : 0);
        // A 16 m box around the eye, but only a few metres deep, so the motes hang over the grass.
        const centre = c === 1 ? camera.position.y-.6 : c === 0 ? camera.position.x : camera.position.z, span = c === 1 ? 3.6 : 16;
        motePositions[i*3+c] = centre+((drift-centre+span/2)%span+span)%span-span/2;
      }
    }
    moteGeometry.attributes.position.needsUpdate = true;
  };
}
let updateSurface = () => {};
if (collapsed) buildSurface();
