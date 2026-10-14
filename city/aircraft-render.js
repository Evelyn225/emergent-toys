// ===== aircraft on screen (aircraft.js says where they are). They pitch and bank, so their parts are boxes and rods
// in the aircraft's own frame: forward along the fuselage, right along the right wing, up through the roof.
// A plane: the fuselage (a rod, tapering to the tail), the cockpit glass, wings (swept on the jets), the tailplane and
// fin, the engines, a spinning propeller on the light plane, wheels while it's low, and its lights: red on the left
// wingtip, green on the right, a white strobe, a red beacon on top, landing lights coming in. A helicopter: the cabin,
// its glass, the tail boom and fin, skids, the main rotor a blur with two blades, the tail rotor.
// ---- an oriented box: centre (px, py, pz) (px, py camera-relative), unit axes A[0..2], half extents E[0..2]
function rayOBox(ox, oy, oz, rx, ry, rz, b) {
  const qx = ox - b.px, qy = oy - b.py, qz = oz - b.pz;
  let t0 = -Infinity, t1 = Infinity, face = 0;
  for (let k = 0; k < 3; k++) {
    const A = b.A[k], e = b.E[k], o = qx * A[0] + qy * A[1] + qz * A[2], d = rx * A[0] + ry * A[1] + rz * A[2];
    if (Math.abs(d) < 1e-12) { if (Math.abs(o) > e) return -1; continue; }
    let ta = (-e - o) / d, tb = (e - o) / d, plus = false;
    if (ta > tb) { const s = ta; ta = tb; tb = s; plus = true; }
    if (ta > t0) { t0 = ta; face = k * 2 + (plus ? 1 : 2); }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  if (t0 < 0.01) return -1;
  const hx = qx + rx * t0, hy = qy + ry * t0, hz = qz + rz * t0, A = b.A;
  HIT.u = hx * A[0][0] + hy * A[0][1] + hz * A[0][2]; HIT.v = hx * A[1][0] + hy * A[1][1] + hz * A[1][2]; HIT.w = hx * A[2][0] + hy * A[2][1] + hz * A[2][2];
  HIT.face = face;
  return t0;
}
function drawOBox(px_, py_, pz, A, E, shade) {
  const hx = Math.abs(A[0][0]) * E[0] + Math.abs(A[1][0]) * E[1] + Math.abs(A[2][0]) * E[2];
  const hy = Math.abs(A[0][1]) * E[0] + Math.abs(A[1][1]) * E[1] + Math.abs(A[2][1]) * E[2];
  const hz = Math.abs(A[0][2]) * E[0] + Math.abs(A[1][2]) * E[1] + Math.abs(A[2][2]) * E[2];
  drawBox({ x: px_, y: py_, c: 1, s: 0, hl: hx, hw: hy, z0: pz - hz, z1: pz + hz, px: px_, py: py_, pz, A, E }, shade, rayOBox);
}
// how lit a face is that points along n (the light comes from up over your left shoulder, as everywhere)
const faceLit = n => 0.55 + 0.45 * Math.max(0, -n[0] * 0.45 + n[1] * 0.3 + n[2] * 0.84);
// the frame of an aircraft heading yaw, nose up pitch, banked roll (right wing down)
function craftFrame(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const f = [cy * cp, sy * cp, sp], r0 = [-sy, cy, 0], u0 = [f[1] * r0[2] - f[2] * r0[1], f[2] * r0[0] - f[0] * r0[2], f[0] * r0[1] - f[1] * r0[0]];
  const r = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr], u = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr];
  return { f, r, u };
}
// a point on the aircraft: its position (camera-relative x, y; world z) plus a along f, b along r, c along u
const at = (o, F, a_, b_, c_) => [o[0] + F.f[0] * a_ + F.r[0] * b_ + F.u[0] * c_, o[1] + F.f[1] * a_ + F.r[1] * b_ + F.u[1] * c_, o[2] + F.f[2] * a_ + F.r[2] * b_ + F.u[2] * c_];
// a panel in the aircraft's frame (centre a, b, c; half extents along f, r, u), in one colour
function craftPanel(o, F, a_, b_, c_, ef, er, eu, col, k = 1, ch = ' ') {
  const p = at(o, F, a_, b_, c_), axes = [F.f, F.r, F.u];
  drawOBox(p[0], p[1], p[2], axes, [ef, er, eu], (i, t, L) => {
    const n = axes[(HIT.face - 1) >> 1].map(v => HIT.face & 1 ? v : -v);
    BG[i] = C(col, (1.4 + L * 0.35) * faceLit(n) * k); return set(i, ch, C(GRAY, L * 0.4)), true;
  });
}
const craftLight = (p, col, r = 0.03) => dot(p[0], p[1], p[2], r, (i, t, L) => { BG[i] = C(col, 12); return set(i, '*', C(WHITE, 15)), true; });
function drawAircraft() {
  for (const a of aircraft) {
    if (a === me && !chaseOn) continue; // (you're in it, looking out)
    const vx = rel(a.x - px), vy = rel(a.y - py), T_ = PLANE_TYPES[a.type];
    if (Math.hypot(vx, vy) > vis + 4 || !inView(vx, vy, (T_.span || 1) / 2 + 0.3)) continue;
    if (T_.heli) drawHeliCraft(a, T_, vx, vy); else drawPlaneCraft(a, T_, vx, vy);
  }
}
function drawPlaneCraft(a, T_, vx, vy) {
  const F = craftFrame(a.yaw, a.pitch, a.roll), gear = a.z < 0.6, h = T_.r + (gear ? T_.r * 0.9 + 0.02 : 0), o = [vx, vy, a.z + h], L2 = T_.len / 2;
  const depth = dx * vx + dy * vy, far = depth > 22, wreck = a.wrecked, body = wreck ? GRAY : T_.body, burnt = wreck ? 0.3 : 1;
  const nightLit = Math.max(night, overcast * 0.6);
  // the fuselage, its livery: a stripe along the lower half, a row of windows, the cockpit glass at the nose
  const fus = (p0, p1, r) => drawRod(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], r, (i, t, L) => {
    const s = ((HIT.u - o[0]) * F.f[0] + (HIT.v - o[1]) * F.f[1] + (HIT.w - o[2]) * F.f[2]) / L2; // -1 tail .. 1 nose
    const row = Math.floor(i / cols), ad = Math.max(0.05, dx * HIT.u + dy * HIT.v), axisRow = hor - (HIT.w - eye) * projY / ad, below = row > axisRow + 0.3;
    if (s > 0.8 && !below && !wreck) { BG[i] = C(CYAN, 1.5 + L * 0.2); return set(i, ' ', 0), true; } // the cockpit glass
    const win = !far && !wreck && Math.abs(row - axisRow + 0.6) < 0.5 && s > -0.6 && s < 0.7;
    BG[i] = C(below ? T_.stripe : body, (1.6 + L * 0.35) * burnt); return set(i, win ? (nightLit > 0.3 ? 'o' : '.') : ' ', win ? C(nightLit > 0.3 ? WARM : GRAY, nightLit > 0.3 ? 14 : 4) : 0), true;
  });
  fus(at(o, F, L2 - T_.r, 0, 0), at(o, F, -L2 * 0.35, 0, 0), T_.r);
  fus(at(o, F, -L2 * 0.35, 0, 0), at(o, F, -L2 + T_.r * 0.6, 0, T_.r * 0.4), T_.r * 0.62);
  // wings: the jets' swept back in two pieces each side, the Skylark's straight and up on top of the cabin
  const sweep = T_.engines ? T_.span * 0.12 : 0, chord = T_.len * (T_.engines ? 0.13 : 0.12), wz = T_.prop ? T_.r * 0.9 : -T_.r * 0.4;
  for (const e of [-1, 1]) {
    craftPanel(o, F, -T_.len * 0.02, e * T_.span * 0.14, wz, chord, T_.span * 0.14, 0.012, body, burnt);
    craftPanel(o, F, -T_.len * 0.02 - sweep, e * T_.span * 0.37, wz + (T_.prop ? 0 : 0.02), chord * 0.75, T_.span * 0.13, 0.01, body, burnt);
    if (!far) craftLight(at(o, F, -sweep - chord * 0.3, e * T_.span * 0.5, wz), e < 0 ? RED : GREEN, Math.max(0.02, T_.r * 0.25)); // nav lights
  }
  // the tail: tailplane and fin (the fin in the stripe colour)
  craftPanel(o, F, -L2 + chord * 0.5, 0, T_.r * 0.4, chord * 0.55, T_.span * 0.17, 0.008, body, burnt);
  craftPanel(o, F, -L2 + chord * 0.6, 0, T_.r * 0.4 + T_.tail / 2, chord * 0.65, 0.012, T_.tail / 2, wreck ? GRAY : T_.stripe, burnt);
  if (far) return;
  // engines
  if (T_.engines === 'wing') for (const e of [-1, 1]) { const p0 = at(o, F, T_.len * 0.1, e * T_.span * 0.2, -T_.r * 1.3), p1 = at(o, F, -T_.len * 0.04, e * T_.span * 0.2, -T_.r * 1.3); rod(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], T_.r * 0.38, GRAY, 1.2); }
  if (T_.engines === 'tail') for (const e of [-1, 1]) { const p0 = at(o, F, -L2 * 0.45, e * T_.r * 1.6, T_.r * 0.5), p1 = at(o, F, -L2 * 0.8, e * T_.r * 1.6, T_.r * 0.5); rod(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], T_.r * 0.5, GRAY, 1.2); }
  // the Skylark's propeller: the spinner and a blur of a disc
  if (T_.prop) {
    const sp = at(o, F, L2 + 0.01, 0, 0);
    dot(sp[0], sp[1], sp[2], 0.02, (i, t, L) => { BG[i] = C(T_.stripe, 9); return set(i, ' ', 0), true; });
    if (a.v > 0.05 || a.engine) drawOBox(...at(o, F, L2 + 0.015, 0, 0), [F.f, F.r, F.u], [0.004, 0.13, 0.13], (i, t, L) => {
      if (Math.hypot(HIT.v, HIT.w) > 0.13 || hash(i, Math.floor(T * 40), 3) > 0.35) return false;
      return set(i, ':', C(GRAY, 8)), true;
    });
  }
  // the wheels, while it's down low
  if (gear) for (const [fa, fb] of [[L2 * 0.7, 0], [-0.05, -T_.span * 0.12], [-0.05, T_.span * 0.12]]) {
    const top = at(o, F, fa, fb, -T_.r * 0.7), foot = [top[0], top[1], Math.max(0.02, a.z + 0.02)];
    rod(top[0], top[1], top[2], foot[0], foot[1], foot[2], 0.008, GRAY, 1);
    dot(foot[0], foot[1], foot[2], Math.max(0.018, T_.r * 0.18), (i, t, L) => { BG[i] = C(GRAY, 0.8); return set(i, 'o', C(GRAY, 4)), true; });
  }
  // the lights: the beacon on top, the strobe on the tail, landing lights when it's low and moving
  if (wreck) return;
  if (fract(T * 1.1 + a.id * 0.3) < 0.15) craftLight(at(o, F, 0, 0, T_.r * 1.1), RED, Math.max(0.02, T_.r * 0.22));
  if (fract(T * 0.9 + a.id * 0.17) < 0.06) craftLight(at(o, F, -L2, 0, T_.r * 0.4 + T_.tail), WHITE, Math.max(0.02, T_.r * 0.25));
  if (a.z > 0.05 && a.z < 3 && nightLit > 0.3) craftLight(at(o, F, L2 * 0.6, 0, -T_.r), WHITE, T_.r * 0.4);
}
function drawHeliCraft(a, T_, vx, vy) {
  const F = craftFrame(a.yaw, a.pitch, a.roll), o = [vx, vy, a.z + 0.16], wreck = a.wrecked, body = wreck ? GRAY : T_.body, burnt = wreck ? 0.3 : 1;
  const glass = (i, t, L) => { BG[i] = C(CYAN, 1.5 + L * 0.2); return set(i, ' ', 0), true; };
  craftPanel(o, F, 0, 0, 0, 0.17, 0.075, 0.075, body, burnt); // the cabin
  if (!wreck) { const n = at(o, F, 0.16, 0, 0.01); dot(n[0], n[1], n[2], 0.072, glass); } // the bubble at the front
  const t0 = at(o, F, -0.15, 0, 0.03), t1 = at(o, F, -0.5, 0, 0.06);
  rod(t0[0], t0[1], t0[2], t1[0], t1[1], t1[2], 0.022, body, burnt); // the tail boom
  craftPanel(o, F, -0.5, 0, 0.12, 0.04, 0.008, 0.07, wreck ? GRAY : T_.stripe, burnt); // the fin
  for (const e of [-1, 1]) { // skids on struts
    const s0 = at(o, F, 0.19, e * 0.08, -0.15), s1 = at(o, F, -0.17, e * 0.08, -0.15);
    rod(s0[0], s0[1], s0[2], s1[0], s1[1], s1[2], 0.008, GRAY, 1.1);
    for (const f of [-0.1, 0.1]) { const p0 = at(o, F, f, e * 0.05, -0.07), p1 = at(o, F, f, e * 0.08, -0.15); rod(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.006, GRAY, 1.1); }
  }
  const m0 = at(o, F, 0, 0, 0.075), m1 = at(o, F, 0, 0, 0.12);
  rod(m0[0], m0[1], m0[2], m1[0], m1[1], m1[2], 0.012, GRAY, 1); // the mast
  if (wreck) return;
  const spin = a.rotor || 0; // 0 stopped .. 1 flying
  drawOBox(...at(o, F, 0, 0, 0.125), [F.f, F.r, F.u], [T_.rotor, T_.rotor, 0.004], (i, t, L) => { // the rotor: two blades round and round, a blur between them when it's going
    const ang = Math.atan2(HIT.v, HIT.u), r = Math.hypot(HIT.u, HIT.v);
    if (r > T_.rotor) return false;
    const phase = (a.rotorA || 0) / Math.PI, blade = Math.abs(fract(ang / Math.PI - phase) - 0.5) > 0.47;
    if (!blade && (spin < 0.3 || hash(i, Math.floor(T * 30), 7) > 0.22 * spin)) return false;
    return set(i, blade ? '=' : '-', C(GRAY, L * (blade ? 0.8 : 0.4))), true;
  });
  const tr = at(o, F, -0.5, 0.012, 0.08); // the tail rotor
  drawOBox(tr[0], tr[1], tr[2], [F.r, F.f, F.u], [0.003, 0.07, 0.07], (i, t, L) => {
    if (Math.hypot(HIT.v, HIT.w) > 0.07 || spin > 0.3 && hash(i, Math.floor(T * 40), 9) > 0.4) return false;
    return set(i, ':', C(GRAY, 8)), true;
  });
  if (fract(T * 1.2 + a.id * 0.3) < 0.2) craftLight(at(o, F, -0.5, 0, 0.0), RED, 0.022);
}
