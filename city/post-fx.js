// Post-processing on the WebGL presenter (render.js glPresent). Only the GL path gets it: the canvas fallback is
// already the slow path. With every effect off the grid shader draws straight to the screen as before, at no cost.
//
// Bloom: the grid is drawn into a full-size texture; its bright parts (judged by the brightest channel, so a pure
// red neon glows as much as a white lamp) are box-filtered down to 1/4 size, blurred, taken down again to 1/8 for a
// wider halo, blurred, and screen-blended back over the frame. Screen blending, not adding, so a lit sky can't clip
// to white, and damped over what's already bright, so a big lit surface keeps its colour and only its edges
// glow. Tuned so it mostly shows at night: signs, lamps, windows, headlights.
const POSTFX_VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
// box-filter a texture down; threshold > 0 keeps only what's bright (soft knee, so nothing pops in or out)
const POSTFX_DOWN = `precision highp float;
uniform sampler2D src; uniform vec2 srcSize, dstSize; uniform float spread, threshold, knee;
vec3 tap(vec2 uv) { return texture2D(src, uv).rgb; }
void main() {
  vec2 uv = gl_FragCoord.xy / dstSize, t = spread / srcSize;
  vec3 c = (tap(uv + vec2(-t.x, -t.y)) + tap(uv + vec2(t.x, -t.y)) + tap(uv + vec2(-t.x, t.y)) + tap(uv + t)) * 0.25;
  if (threshold > 0.0) { float b = max(c.r, max(c.g, c.b)); c *= smoothstep(threshold, threshold + knee, b); }
  gl_FragColor = vec4(c, 1.0);
}`;
// one direction of a 9-tap gaussian, in 5 linear samples
const POSTFX_BLUR = `precision highp float;
uniform sampler2D src; uniform vec2 size, dir;
void main() {
  vec2 uv = gl_FragCoord.xy / size, o1 = dir * 1.3846153846 / size, o2 = dir * 3.2307692308 / size;
  vec3 c = texture2D(src, uv).rgb * 0.2270270270
    + (texture2D(src, uv + o1).rgb + texture2D(src, uv - o1).rgb) * 0.3162162162
    + (texture2D(src, uv + o2).rgb + texture2D(src, uv - o2).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const POSTFX_COMPOSE = `precision highp float;
uniform sampler2D scene, near, wide; uniform vec2 size; uniform float bloom;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec3 s = texture2D(scene, uv).rgb, b = (texture2D(near, uv).rgb * 1.0 + texture2D(wide, uv).rgb * 1.8) * bloom;
  b *= 1.0 - 0.75 * max(s.r, max(s.g, s.b)); // (a halo round a light, not a white-out over a lit wall)
  gl_FragColor = vec4(1.0 - (1.0 - s) * (1.0 - clamp(b, 0.0, 1.0)), 1.0);
}`;
const POSTFX_UNIT = 3; // texture units 0-2 are the grid shader's

// how strong the bloom is this frame: the setting, fuller at night (a daylit sky would only haze over)
const postFxNight = () => typeof night === 'number' ? (mode === 'room' ? Math.max(night, 0.6) : night) : 1;
function postFxBloom() {
  const k = clamp(Number(settings.bloom) || 0, 0, 1);
  return k && k * (0.6 + 0.4 * postFxNight());
}
// what counts as bright (brightest channel, 0-1). The night city is almost all under a quarter, its lights well
// above; by day a third of the frame is sky and walls at 0.4-0.6, so only what's brighter than that glows.
const postFxThreshold = () => 0.62 - 0.3 * postFxNight();

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
  const down = program(POSTFX_DOWN), blur = program(POSTFX_BLUR), compose = program(POSTFX_COMPOSE);
  if (!down || !blur || !compose) return null;
  gl.useProgram(compose.p);
  gl.uniform1i(compose.U('scene'), POSTFX_UNIT); gl.uniform1i(compose.U('near'), POSTFX_UNIT + 1); gl.uniform1i(compose.U('wide'), POSTFX_UNIT + 2);
  gl.useProgram(down.p); gl.uniform1i(down.U('src'), POSTFX_UNIT);
  gl.useProgram(blur.p); gl.uniform1i(blur.U('src'), POSTFX_UNIT);
  gl.useProgram(st.prog);
  return { down, blur, compose, key: '' };
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
function postFxSize(st, fx) {
  const { gl } = st, W = cv.width, H = cv.height, key = W + 'x' + H;
  if (fx.key === key) return true;
  for (const t of [fx.scene, fx.a4, fx.b4, fx.a8, fx.b8]) if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
  const q = (n) => [Math.max(1, Math.ceil(W / n)), Math.max(1, Math.ceil(H / n))];
  fx.scene = postFxTarget(gl, W, H);
  fx.a4 = postFxTarget(gl, ...q(4)); fx.b4 = postFxTarget(gl, ...q(4));
  fx.a8 = postFxTarget(gl, ...q(8)); fx.b8 = postFxTarget(gl, ...q(8));
  fx.key = key;
  return !!(fx.scene && fx.a4 && fx.b4 && fx.a8 && fx.b8);
}

// Before the grid shader draws: point it at the scene texture if any effect is on. Returns whether post runs.
// A GPU that can't build the passes just doesn't get them (POSTFX_OFF), and the frame goes straight to the screen.
let POSTFX_OFF = false;
function postFxBegin(st) {
  const { gl } = st;
  if (POSTFX_OFF || !postFxBloom()) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
  if (!st.fx) { try { st.fx = postFxInit(st); } catch (e) { st.fx = null; } if (!st.fx) { POSTFX_OFF = true; return false; } }
  if (!postFxSize(st, st.fx)) { POSTFX_OFF = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, st.fx.scene.fb); gl.viewport(0, 0, cv.width, cv.height);
  return true;
}
// After it: the bloom passes, and the frame composited to the screen
function postFxEnd(st) {
  const { gl } = st, fx = st.fx, bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); };
  const into = t => { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); t ? gl.viewport(0, 0, t.w, t.h) : gl.viewport(0, 0, cv.width, cv.height); };
  const down = (src, dst, spread, threshold) => {
    into(dst); bind(POSTFX_UNIT, src); gl.useProgram(fx.down.p); const U = fx.down.U;
    gl.uniform2f(U('srcSize'), src.w, src.h); gl.uniform2f(U('dstSize'), dst.w, dst.h);
    gl.uniform1f(U('spread'), spread); gl.uniform1f(U('threshold'), threshold); gl.uniform1f(U('knee'), 0.25);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const blur = (a, b) => { // a -> b across, b -> a down: the result ends up back in a
    gl.useProgram(fx.blur.p); const U = fx.blur.U;
    into(b); bind(POSTFX_UNIT, a); gl.uniform2f(U('size'), a.w, a.h); gl.uniform2f(U('dir'), 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    into(a); bind(POSTFX_UNIT, b); gl.uniform2f(U('dir'), 0, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  down(fx.scene, fx.a4, 1, postFxThreshold()); blur(fx.a4, fx.b4); // (spread 1 at 1/4: four bilinear taps cover each 4x4 block exactly)
  down(fx.a4, fx.a8, 0.5, 0); blur(fx.a8, fx.b8); blur(fx.a8, fx.b8);
  into(null); gl.useProgram(fx.compose.p);
  bind(POSTFX_UNIT, fx.scene); bind(POSTFX_UNIT + 1, fx.a4); bind(POSTFX_UNIT + 2, fx.a8);
  gl.uniform2f(fx.compose.U('size'), cv.width, cv.height); gl.uniform1f(fx.compose.U('bloom'), postFxBloom());
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(st.prog); gl.activeTexture(gl.TEXTURE0);
}
