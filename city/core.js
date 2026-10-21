// City: 1 unit ~ 10m, eye ~1.7m. Interiors: 1 unit = 1m.
let FS = 12, FOV = 1.1; // character size (px) and field of view (radians): both settings, see pause.js
const MAXD = 40, RAMP = '.:-=+*#%@', NONE = 255;
// (BG_UNSET: never a real colour (palette indices stop at 239): what drawBox and drawShape leave in a cell while it's
// shaded, to tell a background the shader painted from one it left alone, even when they're the same colour)
const BG_UNSET = 254;

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fract = v => v - Math.floor(v), mod = (v, m) => ((v % m) + m) % m, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function noise(x, y, s) { // smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (hash(xi, yi, s) * (1 - su) + hash(xi + 1, yi, s) * su) * (1 - sv)
    + (hash(xi, yi + 1, s) * (1 - su) + hash(xi + 1, yi + 1, s) * su) * sv;
}
const pick = a => a[Math.random() * a.length | 0];
const CITY_SOURCE_N = 256, CITY_SOURCE_NB = 32;
const OCEAN_SIZE = 16384, OCEAN_MIN = 256 - OCEAN_SIZE / 2;
let NB = CITY_SOURCE_NB, N = CITY_SOURCE_N, worldReady = false;
const rel = v => { const size = worldReady ? OCEAN_SIZE : N; return worldReady && Math.abs(v) < size / 2 ? v : mod(v + size / 2, size) - size / 2; };
function worldCoord(value) {
  if (!worldReady) return mod(value,N);
  return value>=OCEAN_MIN&&value<OCEAN_MIN+OCEAN_SIZE ? value : mod(value-OCEAN_MIN,OCEAN_SIZE)+OCEAN_MIN;
}
function inWorldGrid(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
function worldBlock(value) { return worldReady ? value : value & (NB - 1); }

// ---- colors: palette index = base*16 + brightness(0..15); NONE = no background
const BASES = [[200,200,230],[255,210,90],[230,50,50],[60,110,255],[240,240,240],[255,200,0],[60,200,90],
               [230,170,130],[255,170,60],[40,230,255],[255,60,220],[170,80,55],[255,120,30],[0,0,0],[240,222,190]];
const [GRAY, YEL, RED, BLUE, WHITE, TAXI, GREEN, SKIN, WARM, CYAN, MAG, BRICK, ORANGE, BLACK, STONE] = BASES.keys();
const PAL = [], PALRGB = [];
for (const [r, gg, b] of BASES) for (let i = 0; i < 16; i++) {
  const f = 0.1 + i / 15 * 0.9, c = [r * f | 0, gg * f | 0, b * f | 0];
  PALRGB.push(c); PAL.push(`rgb(${c})`);
}
const C = (b, l) => b << 4 | clamp(l | 0, 0, 15);
const NEON = [MAG, CYAN, RED, GREEN], ITEM_COL = [RED, YEL, GREEN, BLUE, MAG, ORANGE, CYAN, WHITE];


// ---- ray vs oriented box, for things drawn as real 3D boxes (cars, benches, counters, trains).
// Box: centre (x, y), heading cos c / sin s, half length hl (along the heading), half width hw, from z0 up to z1.
// Ray from (ox, oy, oz) along (rx, ry, rz) per unit t. Returns the entry t (or -1), with the hit left in HIT:
// face 1 front (+heading), 2 back, 3 left side (+across), 4 right side, 5 top, 6 bottom; u along, v across, w height.
const HIT = { face: 0, u: 0, v: 0, w: 0 };
function rayBox(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.x, qy = oy - b.y;
  const lu = qx * b.c + qy * b.s, lv = -qx * b.s + qy * b.c, du = rx * b.c + ry * b.s, dv = -rx * b.s + ry * b.c;
  let tmin = -Infinity, tmax = Infinity, face = 0;
  // one slab per axis: [origin, direction, low, high, face entered from below, face entered from above]
  const slab = (o, d, lo, hi, fLo, fHi) => {
    if (Math.abs(d) < 1e-12) return o >= lo && o <= hi;
    let t1 = (lo - o) / d, t2 = (hi - o) / d, f1 = fLo, f2 = fHi;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; f1 = fHi; f2 = fLo; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(lu, du, -b.hl, b.hl, 2, 1) || !slab(lv, dv, -b.hw, b.hw, 4, 3) || !slab(oz, rz, b.z0, b.z1, 6, 5)) return -1;
  if (tmin < 0.01) return -1; // behind us, or we're inside it
  HIT.face = face; HIT.u = lu + du * tmin; HIT.v = lv + dv * tmin; HIT.w = oz + rz * tmin;
  return tmin;
}
