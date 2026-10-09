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
    vec3 n;
    float lamp(vec3 pos, float radius) {
      vec3 delta = pos - vWorld;
      float d = length(delta);
      return max(dot(n, delta), 0.0) / max(d, 1e-4) * max(0.0, 1.0 - d / radius);
    }
    void main() {
      n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
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
      float lum = light * tone + (grain - .5) * .065 - joints + emission;
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
