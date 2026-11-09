// Post-processing on the WebGL presenter (render.js glPresent). Only the GL path gets it: the canvas fallback is
// already the slow path. Each effect has its own setting (pause menu, "view"); all are kept subtle.
//
// Kept cheap: nothing is drawn at full size twice. The per-pixel effects (eye adjustment, colour grade, vignette,
// grain) run inside the grid shader itself as it paints the screen (postFxGrid sets them up). The glows are built
// from a 1/4-size picture of the frame drawn straight from the cell grid (each cell its background, mixed with its
// glyph's colour by how much of the cell the glyph covers), and added over the screen by the GPU's blending.
//
// Bloom: the bright parts of the 1/4 picture (judged by the brightest channel, so a pure red neon glows as much as
// a white lamp; and only lights: see the glow weights below) are blurred, taken down to 1/8 for a wider halo,
// blurred, and screen-blended over the frame. Screen blending, not adding, so a lit sky can't clip to white, and
// damped over what's already bright, so a big lit surface keeps its colour and only its edges glow.
// Rain streaks: in rain, and on wet streets after it, the same bright parts are also smeared up and down, the way
// lights run on a wet lens and stretch over wet tarmac.
// Colour grade: cool shadows and warm lights at night, warm at dusk, a touch of contrast by day, flatter in fog.
// Vignette: the corners a little darker. Grain: a fine moving noise, mostly in the dark, that hides banding.
// Eye adjustment: the frame's average brightness is followed slowly, so stepping from the dark street into a lit
// shop starts a little over-exposed and settles in about a second (the other way, a little dark, more slowly).
// Fog light rays: in fog, each light throws soft rays outward. The bright parts are gathered along the direction
// towards the nearest light (the slope of the wide bloom), so anything in the way of a light, a window's bars,
// a lamp's frame, leaves a darker shaft between brighter ones.
// Minigames get only the vignette and grain: grading or smearing them would just muddy their colours.
const POSTFX_VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
// the frame at 1/4 size, from the cells: as the grid shader (render.js), with a glyph's average cover for its shape
const POSTFX_LOW = `precision highp float;
uniform sampler2D cells, pal, cover; uniform vec2 grid, cell, canvas, size; uniform vec3 fog;
vec3 palette(float k) { return k > 254.5 ? vec3(0.0) : texture2D(pal, vec2((k + 0.5) / 256.0, 0.5)).rgb; }
void main() {
  vec2 uv = gl_FragCoord.xy / size, p = vec2(uv.x * canvas.x, canvas.y - uv.y * canvas.y), c = floor(p / cell);
  if (c.x >= grid.x || c.y >= grid.y) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec4 d = floor(texture2D(cells, (c + 0.5) / grid) * 255.0 + 0.5);
  float fs = floor(d.a / 16.0), fb = d.a - fs * 16.0;
  vec3 col = mix(palette(d.b), fog, fb / 8.0);
  if (d.r < 254.5 && fs < 7.5) col = mix(col, mix(palette(d.g), fog, fs / 8.0), texture2D(cover, vec2((d.r + 0.5) / 128.0, 0.5)).r);
  gl_FragColor = vec4(col, 1.0);
}`;
// keep only what's bright (soft knee, so nothing pops in or out), weighted per cell by the glow mask
const POSTFX_BRIGHT = `precision highp float;
uniform sampler2D src, mask; uniform vec2 size, canvas, cell, grid; uniform float threshold, knee;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 c = texture2D(src, uv).rgb;
  float b = max(c.r, max(c.g, c.b)); c *= smoothstep(threshold, threshold + knee, b);
  vec2 px = uv * canvas; c *= texture2D(mask, vec2(px.x, canvas.y - px.y) / cell / grid).r; // (per cell: how much it may glow)
  gl_FragColor = vec4(c, 1.0);
}`;
// halve a texture's size (one bilinear tap at the corner between four texels is their average)
const POSTFX_HALF = `precision highp float;
uniform sampler2D src; uniform vec2 size;
void main() { gl_FragColor = vec4(texture2D(src, gl_FragCoord.xy / size).rgb, 1.0); }`;
// one direction of a 9-tap gaussian, in 5 linear samples (dir longer than 1 spreads the taps for a longer smear)
const POSTFX_BLUR = `precision highp float;
uniform sampler2D src; uniform vec2 size, dir;
void main() {
  vec2 uv = gl_FragCoord.xy / size, o1 = dir * 1.3846153846 / size, o2 = dir * 3.2307692308 / size;
  vec3 c = texture2D(src, uv).rgb * 0.2270270270
    + (texture2D(src, uv + o1).rgb + texture2D(src, uv - o1).rgb) * 0.3162162162
    + (texture2D(src, uv + o2).rgb + texture2D(src, uv - o2).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const POSTFX_RAYS = `precision highp float;
uniform sampler2D src, guide; uniform vec2 size, guideSize; uniform float len;
float lum(vec2 uv) { vec3 c = texture2D(guide, uv).rgb; return max(c.r, max(c.g, c.b)); }
void main() {
  vec2 uv = gl_FragCoord.xy / size, t = 1.0 / guideSize;
  vec2 g = vec2(lum(uv + vec2(t.x, 0.0)) - lum(uv - vec2(t.x, 0.0)), lum(uv + vec2(0.0, t.y)) - lum(uv - vec2(0.0, t.y)));
  if (dot(g, g) < 1e-8) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 step = normalize(g) * len / 16.0 / size; // (towards the light, a sixteenth of the ray at a time)
  vec3 sum = vec3(0.0); float tot = 0.0;
  for (int i = 1; i <= 16; i++) { float w = 1.0 - float(i) / 17.0; sum += texture2D(src, uv + step * float(i)).rgb * w; tot += w; }
  gl_FragColor = vec4(sum / tot, 1.0);
}`;
// the glows added up at 1/4 size, damped over what's already bright, ready to be blended over the screen
const POSTFX_GLOW = `precision highp float;
uniform sampler2D low, near, wide, streak, rayTex; uniform vec2 size; uniform float bloom, streaks, rays;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 b = vec3(0.0);
  // (mostly the tight 1/4 halo; the wide 1/8 one only a little, or a light you're close to hazes a whole wall)
  if (bloom > 0.0) b += (texture2D(near, uv).rgb * 1.1 + texture2D(wide, uv).rgb * 0.6) * bloom;
  if (streaks > 0.0) b += texture2D(streak, uv).rgb * 0.7 * streaks;
  if (rays > 0.0) b += texture2D(rayTex, uv).rgb * 0.8 * rays;
  vec3 s = texture2D(low, uv).rgb;
  b *= 1.0 - 0.75 * max(s.r, max(s.g, s.b)); // (a halo round a light, not a white-out over a lit wall)
  gl_FragColor = vec4(min(b, vec3(0.45)), 1.0); // (a glow never more than about half way to white)
}`;
// over the screen, blended as src + dst * (1 - src): a screen blend. Vignetted like the frame under it.
const POSTFX_OVER = `precision highp float;
uniform sampler2D glow; uniform vec2 size; uniform float vignette;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 b = texture2D(glow, uv).rgb;
  if (vignette > 0.0) b *= 1.0 - vignette * smoothstep(0.35, 1.0, length((uv - 0.5) * vec2(size.x / size.y, 1.0)));
  gl_FragColor = vec4(b, 1.0);
}`;
const POSTFX_UNIT = 3; // texture units 0-2 are the grid shader's
// How much each cell may feed the bloom: puddles (FL 2) mirror the lamps and signs above them, and blooming the
// reflection as well as the light doubled every glow into a big smear across the road; they keep a little.
const POSTFX_PUDDLE_GLOW = 0.25;
// Only lights should glow. People and animals (NOGLOW, set by drawFigure) are bright when lit, not lights: they keep
// very little. And by the palette base of a cell's brighter colour: materials that are only ever lit surfaces (skin,
// brick, stone, concrete grey) keep little; the colours lamps, neon, windows and signs are drawn in keep it all.
const POSTFX_FIGURE_GLOW = 0.12;
const POSTFX_BASE_GLOW = (() => {
  const w = new Float32Array(16).fill(1);
  w[GRAY] = 0.35; w[SKIN] = 0.15; w[BRICK] = 0.2; w[STONE] = 0.3; w[BLACK] = 0; w[BLUE] = 0.8; w[WET] = 0.3;
  return w;
})();
let postFxPalLumGlow = null; // (palette luminance, to tell which of a cell's colours is the bright one)

// how much of the night look: outdoors the sky's; a room is lit by its own lamps, so it reads as evening at least
const postFxNight = () => typeof night === 'number' ? (mode === 'room' ? Math.max(night, 0.6) : night) : 1;
function postFxBloom() {
  const k = clamp(Number(settings.bloom) || 0, 0, 1);
  return k && k * (0.6 + 0.15 * postFxNight());
}
// what counts as bright (brightest channel, 0-1). The night city is almost all under a quarter, its lights well
// above; by day a third of the frame is sky and walls at 0.4-0.6, so only what's brighter than that glows.
const postFxThreshold = () => 0.62 - 0.24 * postFxNight();
// rain smears lights; wet streets after it still do, a little. Outdoors only.
function postFxStreaks() {
  if (!settings.rainStreaks || mode === 'room') return 0;
  return clamp(Math.max(rain || 0, (wet || 0) * 0.2), 0, 1) * (0.5 + 0.5 * postFxNight());
}
// fog light rays: how foggy, outdoors only, stronger at night when there are lights to see
function postFxRays() {
  if (!settings.fogRays || mode === 'room') return 0;
  return clamp(fogAmt || 0, 0, 1) * (0.35 + 0.65 * postFxNight());
}
// Eye adjustment. The frame's brightness is worked out from the grid itself (cells' palette colours with their
// fog, a glyph counting for a quarter of its cell), so there's no pixel readback.
let postFxPalLum = null;
function postFxSceneLum() {
  if (!postFxPalLum) { postFxPalLum = new Float32Array(256); for (let k = 0; k < 256; k++) { const c = PALRGB[k]; postFxPalLum[k] = c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0; } }
  const P = postFxPalLum, fl = (0.2126 * fogRGB[0] + 0.7152 * fogRGB[1] + 0.0722 * fogRGB[2]) / 255;
  let sum = 0, n = 0;
  for (let i = 0, N = cols * rows; i < N; i += 2) {
    const fb = FOGB[i] / 8, fs = Math.min(1, FOGS[i] / 8);
    let l = (BG[i] === NONE ? 0 : P[BG[i]]) * (1 - fb) + fl * fb;
    if (CH[i] && CH[i] !== ' ' && fs < 1) l = l * 0.75 + (P[COL[i]] * (1 - fs) + fl * fs) * 0.25;
    sum += Math.log(l + 0.02); n++;
  }
  return n ? Math.exp(sum / n) : 0.1;
}
// how exposed this frame is: the brightness now against what the eye has got used to, which follows it, quickly
// towards brighter and more slowly towards dark. 1 once settled; a pause or a jump of more than half a second resets.
function postFxExposure(fx) {
  if (!settings.eyeAdapt) { fx.adapt = null; return 1; }
  // (the brightness itself is measured every third frame: it changes slowly, and the scan is the costly part)
  if (!fx.lumN-- || fx.lum == null) { fx.lum = postFxSceneLum(); fx.lumN = 2; }
  const now = performance.now() / 1000, cur = fx.lum, dt = now - (fx.adaptT || 0);
  fx.adaptT = now;
  if (fx.adapt == null || dt > 0.5 || dt < 0) { fx.adapt = cur; return 1; }
  const tau = cur > fx.adapt ? 0.45 : 1.1;
  fx.adapt += (cur - fx.adapt) * (1 - Math.exp(-dt / tau));
  return clamp(Math.pow(cur / Math.max(fx.adapt, 1e-4), 0.35), 0.7, 1.45);
}
// the grade's tints for now: night, dusk and day mixed by the sky, then flattened by fog
function postFxGrade() {
  const n = mode === 'room' ? 0.3 : postFxNight(), dk = mode === 'room' ? 0 : (dusk || 0) * (1 - n * 0.5), d = Math.max(0, 1 - n - dk);
  const tot = n + dk + d, mix3 = (a, b, c) => [0, 1, 2].map(k => (a[k] * n + b[k] * dk + c[k] * d) / tot);
  let shadow = mix3([0.9, 0.96, 1.1], [0.98, 0.93, 1.02], [0.99, 1.0, 1.02]);
  const light = mix3([1.04, 1.0, 0.94], [1.1, 1.0, 0.88], [1.04, 1.02, 0.98]);
  let sat = (n * 0.94 + dk * 1.08 + d * 1.05) / tot;
  const f = mode === 'room' ? 0 : clamp(fogAmt || 0, 0, 1);
  if (f) { sat *= 1 - 0.15 * f; shadow = shadow.map(x => x + (1 - x) * f * 0.5); }
  return { shadow, light, sat };
}

function postFxInit(st) {
  const { gl } = st;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const vs = sh(gl.VERTEX_SHADER, POSTFX_VS);
  const program = src => {
    const fs = sh(gl.FRAGMENT_SHADER, src); if (!vs || !fs) return null;
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); // (the grid shader's triangle, at location 0 too)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    const loc = {}; return { p, U: n => loc[n] ??= gl.getUniformLocation(p, n) };
  };
  const P = { low: POSTFX_LOW, bright: POSTFX_BRIGHT, half: POSTFX_HALF, blur: POSTFX_BLUR, rays: POSTFX_RAYS, glow: POSTFX_GLOW, over: POSTFX_OVER };
  const fx = { key: '' };
  for (const k in P) if (!(fx[k] = program(P[k]))) return null;
  // texture units: 0-2 are the grid shader's (cells, palette, glyphs), which the 1/4 picture reads too; 3-7 here
  const U = POSTFX_UNIT, set = (prog, names) => { gl.useProgram(prog.p); for (const n in names) gl.uniform1i(prog.U(n), names[n]); };
  set(fx.low, { cells: 0, pal: 1, cover: U });
  set(fx.bright, { src: U, mask: U + 1 });
  set(fx.half, { src: U }); set(fx.blur, { src: U }); set(fx.over, { glow: U });
  set(fx.rays, { src: U, guide: U + 1 });
  set(fx.glow, { low: U, near: U + 1, wide: U + 2, streak: U + 3, rayTex: U + 4 });
  gl.useProgram(st.prog);
  const tex = () => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + U); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t; };
  fx.mask = tex(); fx.cover = tex();
  gl.activeTexture(gl.TEXTURE0);
  return fx;
}

// a colour texture and a framebuffer drawing into it
function postFxTarget(gl, w, h) {
  const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT); gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? { tex, fb, w, h } : null;
}
// l4: the frame at 1/4; p4: its bright parts; a4/b4 bloom; s4 rain streaks; r4 fog rays; g4 the glows summed; a8/b8 wide bloom
const POSTFX_TARGETS = ['l4', 'p4', 'a4', 'b4', 's4', 'r4', 'g4', 'a8', 'b8'];
function postFxSize(st, fx) {
  const { gl } = st, W = cv.width, H = cv.height;
  if (fx.maskKey !== cols + 'x' + rows) { // the per-cell glow mask
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // (one byte a cell, rows of any width)
    fx.maskData = new Uint8Array(cols * rows); fx.maskKey = cols + 'x' + rows;
    gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT + 1); gl.bindTexture(gl.TEXTURE_2D, fx.mask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, fx.maskData);
  }
  if (fx.coverKey !== st.key && st.atlas2d) { // each glyph's average cover of its cell, from the grid shader's atlas
    const { canvas: at, slotW } = st.atlas2d, A = at.getContext('2d').getImageData(0, 0, at.width, at.height).data, C = new Uint8Array(128), w = Math.max(1, Math.round(cw));
    for (let k = 0; k * slotW < at.width && k < 128; k++) {
      let sum = 0; for (let y = 0; y < at.height; y++) for (let x = 0; x < w; x++) sum += A[(y * at.width + k * slotW + x) * 4 + 3];
      C[k] = Math.round(sum / (w * at.height));
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT); gl.bindTexture(gl.TEXTURE_2D, fx.cover);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 128, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, C);
    fx.coverKey = st.key;
  }
  const key = W + 'x' + H;
  if (fx.key === key) return true;
  for (const n of POSTFX_TARGETS) if (fx[n]) { gl.deleteTexture(fx[n].tex); gl.deleteFramebuffer(fx[n].fb); }
  const q = n => [Math.max(1, Math.ceil(W / n)), Math.max(1, Math.ceil(H / n))];
  for (const n of POSTFX_TARGETS) fx[n] = postFxTarget(gl, ...q(n.endsWith('8') ? 8 : 4));
  fx.key = key;
  return POSTFX_TARGETS.every(n => fx[n]);
}

// Before the grid shader draws: the per-pixel effects for this frame, as the uniforms of its PF program (render.js).
// Returns whether any is on, and so which program draws. world: false for a minigame's screen (vignette and grain only).
let POSTFX_OFF = false;
function postFxGrid(st, world = true) {
  const { gl } = st, U = st.pf.U, vignette = settings.vignette ? 0.22 : 0, grain = settings.grain ? 1 : 0;
  const exposure = world && settings.eyeAdapt ? postFxExposure(st.fxState ||= {}) : 1;
  if (!world || !settings.eyeAdapt) { if (st.fxState) st.fxState.adapt = null; }
  const grade = world && settings.colorGrade ? postFxGrade() : null;
  const on = vignette || grain || grade || Math.abs(exposure - 1) > 0.001;
  if (!on) return false;
  gl.useProgram(st.pf.prog);
  gl.uniform1f(U('exposure'), exposure); gl.uniform1f(U('grade'), grade ? 1 : 0);
  if (grade) { gl.uniform3fv(U('shadowTint'), grade.shadow); gl.uniform3fv(U('lightTint'), grade.light); gl.uniform1f(U('sat'), grade.sat); }
  gl.uniform1f(U('vignette'), vignette); gl.uniform1f(U('grain'), grain); gl.uniform1f(U('seed'), (T * 60 % 997) | 0);
  return true;
}

// After it: the glows, from the cells at 1/4 size, blended over the screen. Nothing to do when none is on.
// A GPU that can't build the passes just doesn't get them (POSTFX_OFF).
function postFxGlow(st, world = true) {
  const bloom = world ? postFxBloom() : 0, streaks = world ? postFxStreaks() : 0, rays = world ? postFxRays() : 0;
  if (POSTFX_OFF || !(bloom || streaks || rays)) return;
  const { gl } = st;
  if (!st.fx) { try { st.fx = postFxInit(st); } catch (e) { st.fx = null; } if (!st.fx) { POSTFX_OFF = true; gl.useProgram(st.prog); return; } }
  const fx = st.fx;
  if (!postFxSize(st, fx)) { POSTFX_OFF = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(st.prog); gl.activeTexture(gl.TEXTURE0); return; }
  const UN = POSTFX_UNIT, bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex || t); };
  const into = t => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); t ? gl.viewport(0, 0, t.w, t.h) : gl.viewport(0, 0, cv.width, cv.height); };
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
  // the frame at 1/4, from the cells (the grid shader's own textures, units 0-1)
  into(fx.l4); gl.useProgram(fx.low.p); bind(UN, fx.cover); let U = fx.low.U;
  gl.uniform2f(U('grid'), cols, rows); gl.uniform2f(U('cell'), cw, FS); gl.uniform2f(U('canvas'), cv.width, cv.height);
  gl.uniform2f(U('size'), fx.l4.w, fx.l4.h); gl.uniform3f(U('fog'), fogRGB[0] / 255, fogRGB[1] / 255, fogRGB[2] / 255); draw();
  // its bright parts, each cell weighted by how much it may glow
  const M = fx.maskData, BW = POSTFX_BASE_GLOW;
  const P = postFxPalLumGlow ||= Float32Array.from({ length: 256 }, (_, k) => { const c = PALRGB[k]; return c ? Math.max(c[0], c[1], c[2]) : 0; });
  for (let i = 0, n = M.length; i < n; i++) {
    const glyph = CH[i] && CH[i] !== ' ' && FOGS[i] < 8, b = BG[i];
    // the colour that would make this cell bright: its glyph's, if that outshines the background
    const k = glyph && (b === NONE || P[COL[i]] > P[b]) ? COL[i] : b;
    let w = k === NONE ? 1 : BW[k >> 4];
    if (NOGLOW[i]) w *= POSTFX_FIGURE_GLOW;
    if (FL[i] === 2) w *= POSTFX_PUDDLE_GLOW;
    M[i] = w * 255 + 0.5 | 0;
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  bind(UN + 1, fx.mask); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, M);
  into(fx.p4); gl.useProgram(fx.bright.p); bind(UN, fx.l4); U = fx.bright.U;
  gl.uniform2f(U('size'), fx.p4.w, fx.p4.h); gl.uniform2f(U('canvas'), cv.width, cv.height); gl.uniform2f(U('cell'), cw, FS); gl.uniform2f(U('grid'), cols, rows);
  // (fog scatters light: in fog, dimmer lights count as bright too, and fog dims the distant ones)
  gl.uniform1f(U('threshold'), postFxThreshold() - 0.04 * rays); gl.uniform1f(U('knee'), 0.25); draw();
  // blurs
  gl.useProgram(fx.blur.p);
  const pass = (src, dst, x, y) => { into(dst); bind(UN, src); gl.uniform2f(fx.blur.U('size'), src.w, src.h); gl.uniform2f(fx.blur.U('dir'), x, y); draw(); };
  if (streaks) { pass(fx.p4, fx.s4, 0, 1); pass(fx.s4, fx.b4, 0, 2.2); pass(fx.b4, fx.s4, 0, 1); } // (tall and thin: up and down only)
  pass(fx.p4, fx.b4, 1, 0); pass(fx.b4, fx.a4, 0, 1);
  if (bloom || rays) {
    into(fx.a8); gl.useProgram(fx.half.p); bind(UN, fx.a4); gl.uniform2f(fx.half.U('size'), fx.a8.w, fx.a8.h); draw();
    gl.useProgram(fx.blur.p); for (let k = 0; k < 2; k++) { pass(fx.a8, fx.b8, 1, 0); pass(fx.b8, fx.a8, 0, 1); }
  }
  if (rays) {
    into(fx.r4); gl.useProgram(fx.rays.p); bind(UN, fx.p4); bind(UN + 1, fx.a8); U = fx.rays.U;
    gl.uniform2f(U('size'), fx.r4.w, fx.r4.h); gl.uniform2f(U('guideSize'), fx.a8.w, fx.a8.h); gl.uniform1f(U('len'), fx.r4.h * 0.14); draw();
    gl.useProgram(fx.blur.p); pass(fx.r4, fx.b4, 0.5, 0); pass(fx.b4, fx.r4, 0, 0.5); // (just enough to hide the 1/4 size)
  }
  // summed, damped, and blended over the screen
  into(fx.g4); gl.useProgram(fx.glow.p); U = fx.glow.U;
  bind(UN, fx.l4); bind(UN + 1, fx.a4); bind(UN + 2, fx.a8); bind(UN + 3, fx.s4); bind(UN + 4, fx.r4);
  gl.uniform2f(U('size'), fx.g4.w, fx.g4.h); gl.uniform1f(U('bloom'), bloom); gl.uniform1f(U('streaks'), streaks); gl.uniform1f(U('rays'), rays); draw();
  into(null); gl.useProgram(fx.over.p); bind(UN, fx.g4); U = fx.over.U;
  gl.uniform2f(U('size'), cv.width, cv.height); gl.uniform1f(U('vignette'), settings.vignette ? 0.22 : 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR); draw(); gl.disable(gl.BLEND);
  gl.useProgram(st.prog); gl.activeTexture(gl.TEXTURE0);
}
