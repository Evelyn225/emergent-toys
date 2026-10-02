// City: 1 unit ~ 10m, eye ~1.7m. Interiors: 1 unit = 1m.
const FS = 12, MAXD = 40, FOV = 1.1, RAMP = '.:-=+*#%@', NONE = 255;

const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fract = v => v - Math.floor(v), mod = (v, m) => ((v % m) + m) % m, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function noise(x, y, s) { // smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const h = (a, b) => hash(a, b, s);
  return (h(xi, yi) * (1 - su) + h(xi + 1, yi) * su) * (1 - sv) + (h(xi, yi + 1) * (1 - su) + h(xi + 1, yi + 1) * su) * sv;
}
const pick = a => a[Math.random() * a.length | 0];
const NB = 32, N = NB * 8; // the world is NB x NB blocks of 8x8 cells (2.56km), repeating forever
const rel = v => mod(v + N / 2, N) - N / 2; // nearest copy in the repeating world

// ---- colors: palette index = base*16 + brightness(0..15); NONE = no background
const BASES = [[200,200,230],[255,210,90],[230,50,50],[60,110,255],[240,240,240],[255,200,0],[60,200,90],
               [230,170,130],[255,170,60],[40,230,255],[255,60,220],[170,80,55],[255,120,30]];
const [GRAY, YEL, RED, BLUE, WHITE, TAXI, GREEN, SKIN, WARM, CYAN, MAG, BRICK, ORANGE] = BASES.keys();
const PAL = [], PALRGB = [];
for (const [r, gg, b] of BASES) for (let i = 0; i < 16; i++) {
  const f = 0.1 + i / 15 * 0.9, c = [r * f | 0, gg * f | 0, b * f | 0];
  PALRGB.push(c); PAL.push(`rgb(${c})`);
}
const C = (b, l) => b << 4 | clamp(l | 0, 0, 15);
const NEON = [MAG, CYAN, RED, GREEN], ITEM_COL = [RED, YEL, GREEN, BLUE, MAG, ORANGE, CYAN, WHITE];

