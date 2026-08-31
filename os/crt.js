// ── CRT effect ────────────────────────────────────────────────────
// Two halves, and neither of them warps the live DOM.
//
//   Curvature   A canvas of bowed scanlines laid over everything. The content
//               itself is never distorted: an SVG displacement filter over the
//               OS would leave clicks landing where the element used to be
//               (filters do not warp hit testing, and the miss is worst at the
//               corners, exactly where window controls live) and would resample
//               11px W95font into mush. Bowing the scanlines is the cue the eye
//               actually reads as curved glass, and it costs the content layer
//               nothing.
//
//   Halation    An SVG filter graph on the desktop surfaces. A graph, not a
//               chain: the source forks, one branch is thresholded down to the
//               brights, blurred, tinted warm and screened back over the
//               UNTOUCHED original. That is what keeps the font sharp - the
//               crisp copy is still in the composite, it just picks up a halo.
//
// There is deliberately no tube rim or vignette. Those were built and cut: the
// dark edge that sells curvature on a real set covers the taskbar and the left
// icon column here, because sleepOS draws to all four edges while a tube was
// framing a 4:3 picture that did not.
//
// Everything keys off `body.crt-on`, which os.css turns into both the overlay's
// visibility and the filter on each surface. settings.js and regedit toggle
// that one class.

const CRT = {
  // ── Curvature ──
  // How far the raster bulges past the glass. A horizontal line is unmoved at
  // the centre column and pulled back toward the middle at the left and right
  // edges, so it bows outward.
  warpY: 0.22,
  pitch: 3,            // scanline pitch in CSS px
  // A flat alpha wash. Modelling the beam properly - brighter beam, fatter beam,
  // so the gaps close up on bright content - was tried with
  // mix-blend-mode: soft-light, whose (1 - 2*ink) * Cb * (1 - Cb) response is
  // exactly that curve, and cut: soft-light works per channel, so on a
  // saturated backdrop each channel gets a different factor and the lines shift
  // hue instead of only darkening. On the teal desktop that reads as coloured
  // banding. The correct response curve is not worth artefacts on the largest
  // flat colour on screen.
  lineAlpha: 0.16,

  // ── Halation ──
  // Only light above `threshold` scatters at all.
  threshold: 0.6,
  radius: 5,           // how far the scatter carries
  // The gate radius, and the one parameter here that is not cosmetic. The glow
  // is scaled by how dark the NEIGHBOURHOOD is, not how dark the pixel is.
  // Gating per-pixel is worse than not gating: on a white page the letters are
  // the darkest thing, so they collect every bit of scatter from the white
  // around them and the text washes out. Asking "is this region dark?" instead
  // means a white window emits nothing anywhere, and a terminal still blooms.
  surround: 14,
  strength: 1.7,
  warmth: 0.6,         // halation is warm - it is the glass, not the phosphor
  diffuse: 0.35,       // scattering in the glass: softens everything, gently
  // Beam misconvergence, in CSS px, each way. Uniform rather than radial: real
  // convergence error is zero at the centre of the tube and worst at the
  // corners, but at this strength the split reads as fringing on an edge, not
  // as displacement, and radial would mean generating a displacement map on a
  // canvas and feeding it through feImage - rebuilt on every resize - to buy a
  // difference nobody can pick out. Past ~0.5 the channels visibly separate on
  // title-bar text and it stops looking like a tube.
  aberration: 0.3,

  maxBackingPx: 6.5e6
};

let crtCanvas = null;
let crtBuildTimer = 0;
let crtBuiltKey = '';

// Cap the backing store rather than trusting devicePixelRatio: a full-screen
// canvas at dpr 2 on a 4K panel is 130MB, and nothing here needs that.
function crtBackingScale(cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cap = Math.sqrt(CRT.maxBackingPx / Math.max(1, cssW * cssH));
  return Math.max(0.75, Math.min(dpr, cap));
}

function crtBuildLines(canvas, cssW, cssH, scale) {
  canvas.width = Math.max(1, Math.round(cssW * scale));
  canvas.height = Math.max(1, Math.round(cssH * scale));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const cx = cssW / 2;
  const cy = cssH / 2;
  const dv = (2 * CRT.pitch) / cssH;          // one scanline, in raster units
  // The bow pulls a line toward the middle by (1 + warpY) at the left and right
  // edges, so a loop that stops at the raster's own extent leaves the corners
  // blank. Solve for the line whose edge lands past the bottom of the canvas.
  const margin = CRT.warpY + dv;

  ctx.strokeStyle = 'rgba(0,8,0,' + CRT.lineAlpha + ')';
  ctx.lineWidth = CRT.pitch * 0.5;
  ctx.beginPath();
  for (let vs = -1 - margin; vs <= 1 + margin; vs += dv) {
    // Each line is one quadratic: the curve is a parabola to within a fraction
    // of a pixel, and beziers bake far faster than sampled polylines.
    const yEdge = cy + cy * vs / (1 + CRT.warpY);
    const yApex = cy + cy * vs;
    ctx.moveTo(-2, yEdge);
    ctx.quadraticCurveTo(cx, 2 * yApex - yEdge, cssW + 2, yEdge);
  }
  ctx.stroke();
}

// The filter is static, so this runs once. Built in JS rather than parked in
// sleep-os.html only to keep the whole effect in one file.
function crtBuildFilter() {
  if (document.getElementById('crt-defs')) return;
  // slope/intercept put the knee at `threshold`: anything darker clamps to zero
  // and contributes no glow at all, so shadows stay shadows.
  const slope = 1 / Math.max(0.05, 1 - CRT.threshold);
  const inter = -CRT.threshold * slope;
  const r = CRT.strength;
  const g = CRT.strength * (1 - CRT.warmth * 0.42);
  const b = CRT.strength * (1 - CRT.warmth * 0.62);
  const host = document.createElement('div');
  host.id = 'crt-defs';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const a = CRT.aberration;
  // Split the beams before anything else looks at the image, so the halation
  // downstream blooms the already-misconverged picture rather than a clean one.
  // Every channel copy has to keep its alpha: a layer with alpha 0 and non-zero
  // RGB is not a valid premultiplied colour and gets clamped away to nothing.
  // Summing three of them therefore over-counts alpha, which is harmless only
  // because every filtered surface is an opaque rectangle - revisit this if the
  // filter is ever pointed at something with real transparency.
  const split = a > 0
    ? '<feColorMatrix in="pre" result="rOnly" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>' +
      '<feColorMatrix in="pre" result="gOnly" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>' +
      '<feColorMatrix in="pre" result="bOnly" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>' +
      '<feOffset in="rOnly" dx="' + (-a) + '" dy="0" result="rShift"/>' +
      '<feOffset in="bOnly" dx="' + a + '" dy="0" result="bShift"/>' +
      '<feComposite in="rShift" in2="gOnly" operator="arithmetic" k2="1" k3="1" result="rg"/>' +
      '<feComposite in="rg" in2="bShift" operator="arithmetic" k2="1" k3="1" result="src"/>'
    : '<feOffset in="pre" dx="0" dy="0" result="src"/>';
  host.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<filter id="crt-halation" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="' + CRT.diffuse + '" result="pre"/>' +
      split +
      '<feComponentTransfer in="src" result="bright">' +
        '<feFuncR type="linear" slope="' + slope + '" intercept="' + inter + '"/>' +
        '<feFuncG type="linear" slope="' + slope + '" intercept="' + inter + '"/>' +
        '<feFuncB type="linear" slope="' + slope + '" intercept="' + inter + '"/>' +
      '</feComponentTransfer>' +
      '<feGaussianBlur in="bright" stdDeviation="' + CRT.radius + '" result="glow"/>' +
      // Gate on the neighbourhood's darkness. Multiplying through feComposite's
      // k1 product term also keeps alpha at 1 (k1*a1*a2 = 1); the obvious
      // "blur(bright) - bright" formulation drives alpha to 0 across every
      // interior and premultiplication then takes the colour down with it.
      '<feGaussianBlur in="src" stdDeviation="' + CRT.surround + '" result="around"/>' +
      '<feColorMatrix in="around" type="matrix" result="shadow" ' +
        'values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 0 1"/>' +
      '<feComposite in="glow" in2="shadow" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="gated"/>' +
      // Alpha passes straight through (0 0 0 1 0). Forcing it to 1 here, which
      // is the obvious defensive thing to write, makes `warm` opaque across the
      // WHOLE filter region - so everywhere outside the element, where there is
      // no glow, warm is opaque black, and screening the transparent source
      // against it paints an opaque black halo. A full-screen surface hides
      // that because its overflow lands outside the viewport; the start menu
      // wore a thick black outline. `gated` already carries sensible alpha from
      // the composite above, so there is nothing to defend against.
      '<feColorMatrix in="gated" type="matrix" result="warm" ' +
        'values="' + r + ' 0 0 0 0  0 ' + g + ' 0 0 0  0 0 ' + b + ' 0 0  0 0 0 1 0"/>' +
      '<feBlend in="src" in2="warm" mode="screen"/>' +
    '</filter></svg>';
  document.body.appendChild(host);
}

function crtRebuild() {
  if (!crtCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 2 || h < 2) return;
  const scale = crtBackingScale(w, h);
  const key = w + 'x' + h + '@' + scale.toFixed(3);
  if (key === crtBuiltKey) return;
  crtBuiltKey = key;
  crtBuildLines(crtCanvas, w, h, scale);
}

function crtScheduleRebuild() {
  clearTimeout(crtBuildTimer);
  crtBuildTimer = setTimeout(crtRebuild, 150);
}

// The single entry point. os.css hangs both the overlay and the per-surface
// filter off this class, so there is one switch rather than a list of elements
// that callers have to remember to keep in step.
function crtApply(on) {
  document.body.classList.toggle('crt-on', !!on);
}

function crtInit() {
  const host = document.getElementById('crt');
  if (!host || crtCanvas) return;
  crtBuildFilter();
  crtCanvas = document.createElement('canvas');
  crtCanvas.className = 'crt-lines';
  host.appendChild(crtCanvas);
  crtRebuild();
  window.addEventListener('resize', crtScheduleRebuild);
  // Settle the toggle here rather than waiting for startDesktop's applySettings:
  // the BIOS screen is on-screen for the whole boot and belongs behind the same
  // glass as everything else.
  crtApply(osSettings.crtEffect);
}

crtInit();
