// GLSL for the dithered surface material and the blast front. `dither` is prepended to both fragment
// shaders; `blastNoise` to both blast stages.
const glsl = {
  surfaceVertex: `
    // Tile joints follow a surface's own (along, across) coordinates where it has them (z = 1),
    // otherwise the world grid.
    attribute vec3 tile;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vTile;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vTile = tile;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
`,
  dither: `
    precision highp float;
    float bayer(vec2 p) {
      vec2 q = mod(floor(p), 4.0);
      float low = 2.0 * mod(q.x, 2.0) + mod(q.y, 2.0);
      if (low == 3.0) low = 1.0; else if (low == 1.0) low = 3.0;
      vec2 h = floor(q / 2.0);
      float high = 2.0 * h.x + h.y;
      if (high == 3.0) high = 1.0; else if (high == 1.0) high = 3.0;
      return (4.0 * low + high + .5) / 16.0;
    }
    const vec3 shadow = vec3(.065, .078, .073);
`,
  surfaceFragment: `
    uniform float tone;
    uniform float emission;
    uniform float time;
    uniform float water;
    uniform float powered;
    uniform float rough;
    uniform float flash;
    uniform float surfaceKind;
    uniform float basinWaterline;
    uniform int lampCount;
    uniform vec3 paint;
    uniform vec3 carLamp;
    uniform vec4 blastLight;
    uniform vec4 tunnelLamps[TUNNEL_LAMPS];
    uniform float tunnelReach[TUNNEL_LAMPS];
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vTile;
    // The fragment's normal, facing the viewer, worked out once rather than once per lamp. The lamp
    // falloff is branchless: an early return costs more than it saves when neighbours disagree.
    vec3 n, viewDirection;
    float gloss, glossPower;
    float finishHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float finishNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(finishHash(i),finishHash(i+vec2(1.,0.)),f.x),
        mix(finishHash(i+vec2(0.,1.)),finishHash(i+vec2(1.,1.)),f.x),f.y);
    }
    vec2 finishPlane(vec3 p) {
      vec3 a = abs(n);
      if (a.y > a.x && a.y > a.z) return p.xz;
      if (a.x > a.z) return p.zy;
      return p.xy;
    }
    float dampness(vec3 p) {
      // Moisture stays on the basin's drained surfaces; the sump holds a separate, fixed level.
      float basin = step(0.,p.x)*step(p.x,24.)*step(-57.2,p.z)*step(p.z,-26.8);
      float hall = step(-9.,p.x)*step(p.x,0.)*step(-52.,p.z)*step(p.z,-48.);
      float sump = step(-61.3,p.x)*step(p.x,-39.3)*step(-60.2,p.z)*step(p.z,-39.8);
      float damp = 1.-smoothstep(-1.85,-1.58,p.y);
      float submerged = 1.-smoothstep(basinWaterline-.05,basinWaterline+.08,p.y);
      float residual = damp*(.45+.35*finishNoise(p.xz*2.1));
      return clamp(max((basin+hall)*max(submerged,residual),sump*(1.-smoothstep(-22.3,-22.,p.y))),0.,1.);
    }
    float lamp(vec3 pos, float radius) {
      vec3 delta = pos - vWorld;
      float d = length(delta);
      vec3 direction = delta/max(d,1e-4);
      float diffuse = max(dot(n,direction),0.);
      float sheen = gloss*pow(max(dot(n,normalize(direction+viewDirection)),0.),glossPower);
      return (diffuse+sheen)*max(0.,1.-d/radius);
    }
    void main() {
      n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      viewDirection = normalize(cameraPosition-vWorld);
      float wet = surfaceKind > .5 ? dampness(vWorld) : 0.;
      gloss = surfaceKind > 1.5 ? .16 : 0.;
      gloss += wet*.26;
      glossPower = mix(42.,68.,wet);
      float light = .14 + .17 * max(dot(n, normalize(vec3(.3, 1., .2))), 0.0);
      light += .9 * lamp(vec3(12., 9., -41.), 24.);
      light += .55 * powered * lamp(vec3(3., 3., -43.), 16.);
      light += .9 * lamp(vec3(12., 13., -70.), 25.);
      light += .9 * lamp(vec3(-20., 4.5, -50.), 17.);
      light += .3 * lamp(vec3(-30.5, 1.2, -50.), 9.);
      light += .4 * lamp(vec3(-36.5, -18.3, -50.), 10.);
      light += .9 * lamp(vec3(-51., -15., -50.), 22.);
      light += .35 * lamp(carLamp, 7.);
      light += .5 * lamp(vec3(-66., -17.6, -50.), 9.);
      light += .6 * lamp(vec3(-20., 1., -37.7), 8.);
      // Only the lamps that can light something in view are packed in, each at its current strength.
      for (int i = 0; i < TUNNEL_LAMPS; i++) {
        if (i >= lampCount) break;
        light += tunnelLamps[i].w * lamp(tunnelLamps[i].xyz, tunnelReach[i]);
      }
      light += blastLight.w * lamp(blastLight.xyz, 30.);
      light += .45 * lamp(cameraPosition + vec3(0., .2, 0.), 8.);
      float grain = fract(sin(dot(floor(vWorld * (rough > .5 ? 9. : 22.)), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float joints = 0.0;
      if (rough < .5 && abs(n.y) > .85) {
        vec2 tile = abs(fract((vTile.z > .5 ? vTile.xy : vWorld.xz) / 1.5) - .5);
        joints = step(.488, max(tile.x, tile.y)) * .055;
      }
      float lum = light * tone;
      // Compress strong reflected light before adding surface detail. Otherwise overlapping lamps
      // clip pale decks to solid white and erase their grain, joints, and brushed-metal finish.
      float highlight = max(0.,lum-.6);
      lum = min(lum,.6)+.3*highlight/(highlight+.3);
      lum += (grain - .5) * .065 - joints;
      vec2 face = finishPlane(vWorld);
      if (surfaceKind > .5 && surfaceKind < 1.5) {
        // One continuous world field avoids a material seam where a curved vault changes direction.
        vec2 concretePoint = vWorld.xz+vWorld.y*vec2(.61,.37);
        float mottling = finishNoise(concretePoint*.65)*.7+finishNoise(concretePoint*2.7)*.3;
        float pores = smoothstep(.80,.96,finishHash(floor(concretePoint*95.)));
        lum *= .91+.18*mottling;
        lum -= pores*.035;
      } else if (surfaceKind > 1.5) {
        float brushing = finishNoise(face*vec2(210.,2.5));
        float scratches = smoothstep(.87,.99,finishNoise(face*vec2(87.,.85)));
        lum += (brushing-.5)*.055+scratches*.045;
      }
      lum = lum*(1.-wet*.20)+emission;
      if (water > .5) {
        float ripple = sin(vWorld.x * 3. + time * .7 + sin(vWorld.z)) * sin(vWorld.z * 2. - time * .6);
        lum = .12 + .1 * ripple + .19 * pow(max(0.0, sin(vWorld.z * .7 + vWorld.x * .2 + time * .3)), 10.);
      }
      lum = mix(lum, .055, smoothstep(14., 64., distance(cameraPosition, vWorld))) + flash;
      float ink = step(bayer(gl_FragCoord.xy), clamp(lum, .015, .97));
      gl_FragColor = vec4(mix(shadow, paint, ink), 1.);
    }
`,
  blastNoise: `
    float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float noise(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(mix(hash(i), hash(i + vec3(1., 0., 0.)), f.x), mix(hash(i + vec3(0., 1., 0.)), hash(i + vec3(1., 1., 0.)), f.x), f.y),
        mix(mix(hash(i + vec3(0., 0., 1.)), hash(i + vec3(1., 0., 1.)), f.x), mix(hash(i + vec3(0., 1., 1.)), hash(i + vec3(1., 1., 1.)), f.x), f.y), f.z);
    }
`,
  blastVertex: `
    uniform float time;
    varying vec3 vWorld;
    varying vec3 vNormal;
    void main() {
      // Billow the surface so the front has a rolling, lumpy edge where it is not hidden by rock.
      vec3 p = position * 1.3 + vec3(time * .9, -time * 1.4, time * .6);
      vec3 billowed = position + normal * (noise(p) * .5 + noise(p * 2.2) * .25 - .3);
      vec4 world = modelMatrix * vec4(billowed, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
`,
  blastFragment: `
    uniform float time;
    varying vec3 vWorld;
    varying vec3 vNormal;
    void main() {
      // White heat at the core of the front, breaking into dark rolling smoke toward its edges.
      vec3 view = normalize(cameraPosition - vWorld), n = normalize(vNormal);
      float facing = abs(dot(n, view));
      vec3 p = vWorld * .38 + vec3(time * .7, -time * 1.5, time * .9);
      float churn = noise(p) * .6 + noise(p * 2.6 + vec3(0., time * 2., 0.)) * .4;
      float smoke = smoothstep(.5, .8, noise(p * .55 + vec3(5., time * .4, 0.)));
      float lum = .2 + .9 * facing + (churn - .5) * 1.6 - .9 * smoke;
      float ink = step(bayer(gl_FragCoord.xy), clamp(lum, .015, .97));
      gl_FragColor = vec4(mix(shadow, vec3(.87, .90, .84), ink), 1.);
    }
`,
};
