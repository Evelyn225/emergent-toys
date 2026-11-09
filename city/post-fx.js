// Post-processing on the WebGL presenter (render.js glPresent). Only the GL path gets it: the canvas fallback is
// already the slow path. With every effect off the grid shader draws straight to the screen as before, at no cost.
// Each effect has its own setting (pause menu, "view"); all are kept subtle.
//
// Bloom: the grid is drawn into a full-size texture; its bright parts (judged by the brightest channel, so a pure
// red neon glows as much as a white lamp) are box-filtered down to 1/4 size, blurred, taken down again to 1/8 for a
// wider halo, blurred, and screen-blended back over the frame. Screen blending, not adding, so a lit sky can't clip
// to white, and damped over what's already bright, so a big lit surface keeps its colour and only its edges
// glow. Tuned so it mostly shows at night: signs, lamps, windows, headlights.
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
// box-filter a texture down; threshold > 0 keeps only what's bright (soft knee, so nothing pops in or out)
const POSTFX_DOWN = `precision highp float;
uniform sampler2D src, mask; uniform vec2 srcSize, dstSize, canvas, cell, grid; uniform float spread, threshold, knee;
vec3 tap(vec2 uv) { return texture2D(src, uv).rgb; }
void main() {
  vec2 uv = gl_FragCoord.xy / dstSize, t = spread / srcSize;
  vec3 c = (tap(uv + vec2(-t.x, -t.y)) + tap(uv + vec2(t.x, -t.y)) + tap(uv + vec2(-t.x, t.y)) + tap(uv + t)) * 0.25;
  if (threshold > 0.0) {
    float b = max(c.r, max(c.g, c.b)); c *= smoothstep(threshold, threshold + knee, b);
    vec2 px = uv * canvas; c *= texture2D(mask, vec2(px.x, canvas.y - px.y) / cell / grid).r; // (per cell: how much it may glow)
  }
  gl_FragColor = vec4(c, 1.0);
}`;
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
const POSTFX_COMPOSE = `precision highp float;
uniform sampler2D scene, near, wide, streak, rayTex; uniform vec2 size;
uniform float bloom, streaks, rays, exposure, grade, sat, vignette, grain, seed; uniform vec3 shadowTint, lightTint;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 s = texture2D(scene, uv).rgb;
  if (abs(exposure - 1.0) > 0.001) s = 1.0 - pow(1.0 - clamp(s, 0.0, 1.0), vec3(exposure)); // (no hard clip either way)
  if (bloom > 0.0 || streaks > 0.0 || rays > 0.0) {
    vec3 b = (texture2D(near, uv).rgb * 1.0 + texture2D(wide, uv).rgb * 1.8) * bloom + texture2D(streak, uv).rgb * 0.7 * streaks
      + texture2D(rayTex, uv).rgb * 0.8 * rays;
    b *= 1.0 - 0.75 * max(s.r, max(s.g, s.b)); // (a halo round a light, not a white-out over a lit wall)
    s = 1.0 - (1.0 - s) * (1.0 - clamp(b, 0.0, 1.0));
  }
  if (grade > 0.0) {
    float l = dot(s, vec3(0.299, 0.587, 0.114));
    vec3 g = mix(vec3(l), s, sat) * mix(shadowTint, lightTint, smoothstep(0.05, 0.6, l));
    s = mix(s, clamp(g, 0.0, 1.0), grade);
  }
  if (vignette > 0.0) {
    vec2 d = (uv - 0.5) * vec2(size.x / size.y, 1.0);
    s *= 1.0 - vignette * smoothstep(0.35, 1.0, length(d));
  }
  if (grain > 0.0) {
    float l = max(s.r, max(s.g, s.b));
    float n = hash(gl_FragCoord.xy + seed) + hash(gl_FragCoord.xy * 1.37 + seed * 0.71) - 1.0; // (triangular: no visible bias)
    s += n * grain * (0.0125 * (1.0 - l) + 0.003);
  }
  gl_FragColor = vec4(s, 1.0);
}`;
const POSTFX_UNIT = 3; // texture units 0-2 are the grid shader's
// How much each cell may feed the bloom: puddles (FL 2) mirror the lamps and signs above them, and blooming the
// reflection as well as the light doubled every glow into a big smear across the road; they keep a little.
const POSTFX_PUDDLE_GLOW = 0.25;

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
  const now = performance.now() / 1000, cur = postFxSceneLum(), dt = now - (fx.adaptT || 0);
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
// is any effect on for this frame? (minigames: only the ones that suit a flat screen of text)
function postFxWanted(world) {
  if (POSTFX_OFF) return false;
  if (settings.vignette || settings.grain) return true;
  return world && (postFxBloom() > 0 || postFxStreaks() > 0 || postFxRays() > 0 || !!settings.colorGrade || !!settings.eyeAdapt);
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
  const down = program(POSTFX_DOWN), blur = program(POSTFX_BLUR), compose = program(POSTFX_COMPOSE), rays = program(POSTFX_RAYS);
  if (!down || !blur || !compose || !rays) return null;
  // (units 3-7: WebGL only promises 8. The mask and the rays' guide borrow unit 4 for their own passes.)
  gl.useProgram(compose.p);
  ['scene', 'near', 'wide', 'streak', 'rayTex'].forEach((n, k) => gl.uniform1i(compose.U(n), POSTFX_UNIT + k));
  gl.useProgram(rays.p); gl.uniform1i(rays.U('src'), POSTFX_UNIT); gl.uniform1i(rays.U('guide'), POSTFX_UNIT + 1);
  gl.useProgram(down.p); gl.uniform1i(down.U('src'), POSTFX_UNIT); gl.uniform1i(down.U('mask'), POSTFX_UNIT + 1);
  gl.useProgram(blur.p); gl.uniform1i(blur.U('src'), POSTFX_UNIT);
  gl.useProgram(st.prog);
  const mask = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT + 1); gl.bindTexture(gl.TEXTURE_2D, mask);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.activeTexture(gl.TEXTURE0);
  return { down, blur, compose, rays, mask, key: '' };
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
const POSTFX_TARGETS = ['scene', 'p4', 'a4', 'b4', 's4', 'r4', 'a8', 'b8'];
function postFxSize(st, fx) {
  const { gl } = st, W = cv.width, H = cv.height, key = W + 'x' + H;
  if (fx.key === key && fx.maskKey === cols + 'x' + rows) return true;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // (the mask's rows are one byte a cell, any width)
  fx.maskData = new Uint8Array(cols * rows); fx.maskKey = cols + 'x' + rows;
  gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT + 1); gl.bindTexture(gl.TEXTURE_2D, fx.mask);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, fx.maskData);
  if (fx.key === key) return true;
  for (const n of POSTFX_TARGETS) if (fx[n]) { gl.deleteTexture(fx[n].tex); gl.deleteFramebuffer(fx[n].fb); }
  const q = n => [Math.max(1, Math.ceil(W / n)), Math.max(1, Math.ceil(H / n))];
  fx.scene = postFxTarget(gl, W, H);
  for (const n of ['p4', 'a4', 'b4', 's4', 'r4']) fx[n] = postFxTarget(gl, ...q(4)); // (p4: the bright parts, unblurred)
  fx.a8 = postFxTarget(gl, ...q(8)); fx.b8 = postFxTarget(gl, ...q(8));
  fx.key = key;
  return POSTFX_TARGETS.every(n => fx[n]);
}

// Before the grid shader draws: point it at the scene texture if any effect is on. Returns whether post runs.
// A GPU that can't build the passes just doesn't get them (POSTFX_OFF), and the frame goes straight to the screen.
// world: false for a minigame's screen.
let POSTFX_OFF = false;
function postFxBegin(st, world = true) {
  const { gl } = st;
  if (!postFxWanted(world)) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
  if (!st.fx) { try { st.fx = postFxInit(st); } catch (e) { st.fx = null; } if (!st.fx) { POSTFX_OFF = true; return false; } }
  if (!postFxSize(st, st.fx)) { POSTFX_OFF = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
  st.fx.world = world;
  gl.bindFramebuffer(gl.FRAMEBUFFER, st.fx.scene.fb); gl.viewport(0, 0, cv.width, cv.height);
  return true;
}
// After it: the bloom and streak passes, and the frame composited to the screen with the grade, vignette and grain
function postFxEnd(st) {
  const { gl } = st, fx = st.fx, world = fx.world, bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); };
  const into = t => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); t ? gl.viewport(0, 0, t.w, t.h) : gl.viewport(0, 0, cv.width, cv.height); };
  const down = (src, dst, spread, threshold) => {
    into(dst); bind(POSTFX_UNIT, src); gl.useProgram(fx.down.p); const U = fx.down.U;
    if (threshold > 0) {
      const M = fx.maskData, puddle = POSTFX_PUDDLE_GLOW * 255 | 0;
      for (let i = 0, n = M.length; i < n; i++) M[i] = FL[i] === 2 ? puddle : 255;
      gl.activeTexture(gl.TEXTURE0 + POSTFX_UNIT + 1); gl.bindTexture(gl.TEXTURE_2D, fx.mask);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.LUMINANCE, gl.UNSIGNED_BYTE, M);
      gl.uniform2f(U('canvas'), cv.width, cv.height); gl.uniform2f(U('cell'), cw, FS); gl.uniform2f(U('grid'), cols, rows);
    }
    gl.uniform2f(U('srcSize'), src.w, src.h); gl.uniform2f(U('dstSize'), dst.w, dst.h);
    gl.uniform1f(U('spread'), spread); gl.uniform1f(U('threshold'), threshold); gl.uniform1f(U('knee'), 0.25);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const pass = (src, dst, x, y) => { into(dst); bind(POSTFX_UNIT, src); gl.uniform2f(fx.blur.U('size'), src.w, src.h); gl.uniform2f(fx.blur.U('dir'), x, y); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const bloom = world ? postFxBloom() : 0, streaks = world ? postFxStreaks() : 0, rays = world ? postFxRays() : 0;
  const exposure = world ? postFxExposure(fx) : 1;
  if (bloom || streaks || rays) {
    // (fog scatters light: in fog, dimmer lights count as bright too, and fog dims the distant ones)
    down(fx.scene, fx.p4, 1, postFxThreshold() - 0.04 * rays); // (spread 1 at 1/4: four bilinear taps cover each 4x4 block exactly)
    gl.useProgram(fx.blur.p);
    if (streaks) { pass(fx.p4, fx.s4, 0, 1); pass(fx.s4, fx.b4, 0, 2.2); pass(fx.b4, fx.s4, 0, 1); } // (tall and thin: up and down only)
    pass(fx.p4, fx.b4, 1, 0); pass(fx.b4, fx.a4, 0, 1);
    if (bloom || rays) { down(fx.a4, fx.a8, 0.5, 0); gl.useProgram(fx.blur.p); for (let k = 0; k < 2; k++) { pass(fx.a8, fx.b8, 1, 0); pass(fx.b8, fx.a8, 0, 1); } }
    if (rays) {
      into(fx.r4); gl.useProgram(fx.rays.p); bind(POSTFX_UNIT, fx.p4); bind(POSTFX_UNIT + 1, fx.a8); const R = fx.rays.U;
      gl.uniform2f(R('size'), fx.r4.w, fx.r4.h); gl.uniform2f(R('guideSize'), fx.a8.w, fx.a8.h); gl.uniform1f(R('len'), fx.r4.h * 0.14);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(fx.blur.p); pass(fx.r4, fx.b4, 0.5, 0); pass(fx.b4, fx.r4, 0, 0.5); // (just enough to hide the 1/4 size)
    }
  }
  into(null); gl.useProgram(fx.compose.p); const U = fx.compose.U;
  bind(POSTFX_UNIT, fx.scene); bind(POSTFX_UNIT + 1, fx.a4); bind(POSTFX_UNIT + 2, fx.a8); bind(POSTFX_UNIT + 3, fx.s4); bind(POSTFX_UNIT + 4, fx.r4);
  gl.uniform2f(U('size'), cv.width, cv.height);
  gl.uniform1f(U('bloom'), bloom); gl.uniform1f(U('streaks'), streaks); gl.uniform1f(U('rays'), rays); gl.uniform1f(U('exposure'), exposure);
  const grade = world && settings.colorGrade ? postFxGrade() : null;
  gl.uniform1f(U('grade'), grade ? 1 : 0);
  if (grade) { gl.uniform3fv(U('shadowTint'), grade.shadow); gl.uniform3fv(U('lightTint'), grade.light); gl.uniform1f(U('sat'), grade.sat); }
  gl.uniform1f(U('vignette'), settings.vignette ? 0.22 : 0);
  gl.uniform1f(U('grain'), settings.grain ? 1 : 0); gl.uniform1f(U('seed'), (T * 60 % 997) | 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(st.prog); gl.activeTexture(gl.TEXTURE0);
}
