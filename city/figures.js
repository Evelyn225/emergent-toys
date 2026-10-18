// ===== people, drawn in solid blocks of colour. Each is a little 3D body - box torso, capsule limbs, ellipsoid head,
// posed by joint angles - ray-cast from the side you're seeing it into a small pixel sprite (cached per view and pose)
// and painted as cell backgrounds. So someone's back really is their back: hair over the head, back pockets, a
// backpack; their front has a face, whose eyes are stamped one pixel each and so never smear into two pairs.
// Units: sprite pixels; a standing adult's head is FIG_TALL high. Body frame: x their right, y ahead of them, z up.
const FIG_W = 29, FIG_H = 34, FIG_TALL = 26.45, FIG_VIEWS = 16;
const FR = Object.fromEntries(['HAIR', 'HAIR_D', 'SKIN', 'SKIN_D', 'EYE', 'TOP', 'TOP_D', 'INNER', 'BOT', 'BOT_D', 'POCKET', 'BELT',
  'BUCKLE', 'SHOE', 'HAT', 'HAT_D', 'BADGE', 'CAPBADGE', 'PACK', 'PACK_D', 'STRAP', 'SHADES', 'TIE', 'MIC', 'TIGHTS', 'INK'].map((k, i) => [k, i + 1]));
const FIG_ROLES = Object.keys(FR).length + 1;
// a detail one pixel across, and what it reads as once a pixel is smaller than a screen cell (or it would flicker)
const FIG_COARSE = new Uint8Array(FIG_ROLES);
for (const [d, c] of [['EYE', 'SKIN'], ['POCKET', 'BOT'], ['BUCKLE', 'BELT'], ['BADGE', 'TOP'], ['CAPBADGE', 'HAT'], ['STRAP', 'TOP'], ['TIE', 'INNER']]) FIG_COARSE[FR[d]] = FR[c];
// lit side / shadow side: which roles have a darker shade for the faces turned away from the light
const FIG_DARK = new Uint8Array(FIG_ROLES);
for (const k of ['HAIR', 'SKIN', 'TOP', 'BOT', 'HAT', 'PACK']) FIG_DARK[FR[k]] = FR[k + '_D'];

const fAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], fMul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const fSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], fDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fNorm = a => fMul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
// a limb's direction from how far it swings forward (pitch: 0 hangs straight down, pi points straight up) and out to
// its own side (abd); sg = +1 for the right-hand limb, -1 the left
const fLimb = (pitch, abd, sg) => [sg * Math.sin(abd), Math.sin(pitch) * Math.cos(abd), -Math.cos(pitch) * Math.cos(abd)];

// ---- poses: legs and arms [pitch, abd, lower pitch, lower abd], right then left; lean forward, roll to their right
const FIG_STAND = { legs: [[0, 0.04, 0, 0.04], [0, 0.04, 0, 0.04]], arms: [[0.05, 0.1, 0.2, 0.08], [0.05, 0.1, 0.2, 0.08]] };
const FIG_DANCE = [
  { legs: [[1.0, 0.2, -0.55, 0.2], [0, 0.05, 0, 0.05]], arms: [[2.9, 0.25, 3.0, 0.1], [1.4, 1.15, 1.4, 1.3]], lean: -0.08, roll: 0.1 }, // a hand high on the pole, a knee hooked round it
  { legs: [[0.75, 0.1, -0.5, 0.1], [0.75, 0.1, -0.5, 0.1]], arms: [[2.8, 0.2, 3.0, 0.15], [2.8, 0.2, 3.0, 0.15]], lean: 0.1, lift: 3 }, // off the floor, spinning
  { legs: [[1.25, 0.1, 1.25, 0.1], [0, 0.05, 0, 0.05]], arms: [[2.95, 0.2, 3.0, 0.2], [-0.5, 0.7, -0.2, 0.8]], lean: -0.35 }, // arched back, a leg out
  { legs: [[0.3, 0.12, -0.3, 0.1], [0, 0.05, 0, 0.05]], arms: [[2.4, 0.5, 4.2, -0.4], [-0.15, 0.55, 0.9, -0.8]], roll: 0.15 }]; // a hand in her hair, one on her hip
const FIG_POSES = {
  stand: () => FIG_STAND,
  fold: () => ({ ...FIG_STAND, arms: [[0.3, 0.14, 1.57, -1.15], [0.3, 0.14, 1.57, -1.15]] }), // arms folded
  ease: () => ({ ...FIG_STAND, arms: [[-0.35, 0.12, -0.9, -0.6], [-0.35, 0.12, -0.9, -0.6]] }), // hands behind the back
  wave: () => ({ ...FIG_STAND, arms: [[2.7, 0.5, 3.1, 0.5], FIG_STAND.arms[1]] }), // hailing a cab
  grass: () => ({ seat: 0, legs: [[1.95, 0.22, 0.8, 0.1], [1.95, 0.22, 0.8, 0.1]], arms: [[0.75, 0.2, 1.7, -0.5], [0.75, 0.2, 1.7, -0.5]], lean: -0.1 }), // on the lawn, hugging her knees
  reach: () => ({ ...FIG_STAND, arms: [[1.0, 0.15, 1.3, 0.05], [1.0, 0.15, 1.3, 0.05]], lean: 0.35 }), // hands in the touch pool
  sing: () => ({ ...FIG_STAND, arms: [[0.9, 0.25, 2.7, -0.6], [0.5, 0.7, 0.9, 0.5]] }), // the mic up to her mouth
  gasp: () => ({ ...FIG_STAND, arms: [[0.9, 0.25, 2.7, -0.6], [0.9, 0.25, 2.7, -0.6]] }), // hands to their face (someone's just been hit)
  sitfold: seat => ({ ...FIG_POSES.sit(seat), arms: FIG_POSES.fold().arms }),
  sit: seat => { // thighs angled down just enough that the feet reach the floor
    const t = clamp(Math.acos(clamp((seat + 1.3 - 6.76) / 6.2, -1, 1)), 0.95, 1.5);
    return { seat, legs: [[t, 0.08, 0.12, 0.05], [t, 0.08, 0.12, 0.05]], arms: [[0.45, 0.12, 1.3, -0.15], [0.45, 0.12, 1.3, -0.15]], lean: -0.05 };
  },
  walk: f => { // eight frames a stride
    const w = f / 8 * Math.PI * 2, s = Math.sin(w), c = Math.cos(w), p = 0.45 * s;
    return { legs: [[p, 0.03, p - 0.12 - 0.55 * Math.max(0, c), 0.03], [-p, 0.03, -p - 0.12 - 0.55 * Math.max(0, -c), 0.03]],
             arms: [[-0.8 * p, 0.1, -0.8 * p + 0.3, 0.1], [0.8 * p, 0.1, 0.8 * p + 0.3, 0.1]] };
  },
  run: f => {
    const w = f / 8 * Math.PI * 2, s = Math.sin(w), c = Math.cos(w), p = 0.8 * s;
    return { legs: [[p, 0.04, p - 0.3 - 1.2 * Math.max(0, c), 0.04], [-p, 0.04, -p - 0.3 - 1.2 * Math.max(0, -c), 0.04]],
             arms: [[-p, 0.15, -p + 1.6, 0.1], [p, 0.15, p + 1.6, 0.1]], lean: 0.22 };
  },
  dance: f => FIG_DANCE[f],
  // on a skateboard (skate.js), side on to it, feet apart along it: riding (0 leaning back, 1 upright, 2 leaning in),
  // crouched to pop or tucked in the air, pushing (facing ahead, eight frames a kick), or sprawled after a bail
  ride: f => ({ legs: [[0.45, 0.42, 0.05, 0.3], [0.45, 0.42, 0.05, 0.3]], arms: [[0.25, 0.5, 0.45, 0.3], [0.25, 0.5, 0.45, 0.3]], lean: [-0.08, 0.12, 0.32][f] ?? 0.12 }),
  crouch: () => ({ legs: [[1.15, 0.42, -0.45, 0.3], [1.15, 0.42, -0.45, 0.3]], arms: [[0.7, 0.75, 0.9, 0.45], [0.7, 0.75, 0.9, 0.45]], lean: 0.38 }),
  push: f => {
    const w = f / 8 * Math.PI * 2, p = 0.15 + 0.5 * Math.cos(w); // the kicking leg: reaching ahead, down, raking back
    return { legs: [[p, 0.12, p - 0.25 - 0.4 * Math.max(0, Math.sin(w)), 0.1], [0.3, 0.04, 0.05, 0.04]],
             arms: [[0.5 * p, 0.25, 0.5 * p + 0.4, 0.15], [-0.5 * p, 0.25, -0.5 * p + 0.4, 0.15]], lean: 0.18 };
  },
  sprawl: () => ({ seat: 0, legs: [[1.45, 0.3, 1.5, 0.25], [1.3, 0.2, 1.7, 0.15]], arms: [[-0.7, 0.35, -0.5, 0.3], [-0.6, 0.4, -0.4, 0.3]], lean: -0.45 }),
  // flat on their back (knocked down by a car: people.js), arms flung out, one knee up
  down: () => ({ seat: -1.2, legs: [[1.55, 0.2, 1.55, 0.15], [1.1, 0.35, 2.0, 0.25]], arms: [[-1.5, 0.9, -1.4, 0.8], [-1.4, 0.75, -1.5, 0.9]], lean: -1.5 }),
};
// a pose key: 'stand', 'walk3', 'sit7' (seat height in pixels), 'dance2'
function figPose(key) {
  const m = /^([a-z]+)(\d*)$/.exec(key), make = FIG_POSES[m[1]];
  return make(+m[2] || 0);
}

// ---- the body, as parts in the body frame. A part is an ellipsoid (k 0), box (1) or capsule (2); role(hit) says what
// it is where the ray met it (0: nothing - look further, for a hard hat's dome or a skirt's waist).
const figEll = (c, ax, r, role, shade = true) => ({ k: 0, c, ax, r, role, shade });
const figBox = (c, ax, h, role, shade = true) => ({ k: 1, c, ax, h, role, shade });
const figCap = (a, b, r, role, shade = true) => ({ k: 2, a, b, r, role, shade });
const figHair = { // which of the head (its unit-sphere point l: x right, y ahead, z up) the hair covers
  short: l => l[2] > 0.3 || l[1] < -0.05 && l[2] > -0.5 || Math.abs(l[0]) > 0.8 && l[2] > 0.15 && l[1] < 0.1,
  buzz: l => l[2] > 0.55 || l[1] < -0.2 && l[2] > -0.3,
  long: l => l[2] > 0.42 || l[1] < 0.2 && l[2] > -1.1 || Math.abs(l[0]) > 0.7 && l[1] < 0.55,
  bob: l => l[2] > 0.38 || l[1] < 0.2 && l[2] > -0.75 || Math.abs(l[0]) > 0.7 && l[1] < 0.55 && l[2] > -0.6,
  bun: l => l[2] > 0.42 || l[1] < -0.05 && l[2] > -0.45 || Math.abs(l[0]) > 0.8 && l[2] > 0.15 && l[1] < 0.1,
  pony: l => l[2] > 0.42 || l[1] < -0.05 && l[2] > -0.45 || Math.abs(l[0]) > 0.8 && l[2] > 0.15 && l[1] < 0.1,
  afro: l => l[2] > 0.3 || l[1] < 0.1,
  bald: () => false,
};
// a shoe: a block from the heel to the toe along the sole (how far behind and ahead of the ankle), a little wider than
// the shin so it reads from the front too, from the sole (this far below the ankle) up to just over the ankle
const FIG_SOLE = [-1.2, 2.1], FIG_SHOE_LO = 0.8, FIG_SHOE_HI = 0.85;
const FIG_SLEEVELESS = new Set(['tank', 'bikini']), FIG_LONG = new Set(['long', 'jacket', 'suit', 'uniform']);
function figBody(look, key) {
  const P = figPose(key), bw = look.bw || 1, bd = 0.9 + 0.1 * bw, hs = look.kid ? 1.2 : 1, R = FR;
  const parts = [], decals = [], legR = 1.15 * (0.85 + 0.15 * bw), shinR = 1.1 * (0.85 + 0.15 * bw);
  // the legs, from the hips down; then down to the floor unless they're up a pole
  let hipZ = P.seat != null ? P.seat + 1.3 : 13;
  const legs = [1, -1].map((sg, k) => {
    const [tp, ta, sp, sa] = P.legs[k], hip = [sg * 1.6 * bw, 0, hipZ];
    const knee = fAdd(hip, fMul(fLimb(tp, ta, sg), 6.2)), ankle = fAdd(knee, fMul(fLimb(sp, sa, sg), 6.0));
    // the foot's frame: ahead along the sole, up along the shin
    const fy = [0, Math.cos(sp), Math.sin(sp)], fz = [0, -Math.sin(sp), Math.cos(sp)];
    return { sg, hip, knee, ankle, fy, fz, sole: Math.min(...FIG_SOLE.map(a => ankle[2] + a * fy[2] - FIG_SHOE_LO * fz[2])) };
  });
  if (P.seat == null) {
    const low = Math.min(...legs.map(l => l.sole)) - (P.lift || 0);
    hipZ -= low; for (const l of legs) for (const j of ['hip', 'knee', 'ankle']) l[j] = [l[j][0], l[j][1], l[j][2] - low];
  }
  // the upper body leans and rolls about the middle of the hips
  const ln = P.lean || 0, rl = P.roll || 0, ey = [0, Math.cos(ln), -Math.sin(ln)], ez0 = [0, Math.sin(ln), Math.cos(ln)];
  const ex = fSub(fMul([1, 0, 0], Math.cos(rl)), fMul(ez0, Math.sin(rl))), ez = fAdd(fMul(ez0, Math.cos(rl)), fMul([1, 0, 0], Math.sin(rl))), ax = [ex, ey, ez];
  const U = (x, y, z) => fAdd([0, 0, hipZ], fAdd(fMul(ex, x), fAdd(fMul(ey, y), fMul(ez, z))));
  const top = look.top, bot = look.bot, legSkin = look.tights ? R.TIGHTS : R.SKIN;
  const bikini = top === 'bikini', open = top === 'jacket' || top === 'suit', belted = !open && !bikini && top !== 'dress' && (bot === 'pants' || bot === 'shorts');
  // the torso: a chest box over a narrower waist; what's on its front depends what they're wearing
  const faceOf = l => { const a = l.map(Math.abs), m = Math.max(...a); return a[1] === m ? (l[1] > 0 ? 'front' : 'back') : a[2] === m ? (l[2] > 0 ? 'top' : 'bottom') : 'side'; };
  const chest = figBox(U(0, 0, 4.9), ax, [3.3 * bw, 2.0 * bd, 2.1], h => {
    const l = h.l, f = faceOf(l), x = Math.abs(l[0]);
    if (bikini) return l[2] > -0.15 && l[2] < 0.55 ? R.TOP : R.SKIN;
    if (top === 'tank' && l[2] > 0.55 && x > 0.4 && f !== 'side') return R.SKIN;
    if (f === 'front') {
      if (look.pack && x > 0.42 && x < 0.68) return R.STRAP;
      if (top === 'suit' && x < 0.1 && l[2] < 0.85) return R.TIE;
      if (open && x < 0.32) return R.INNER;
      if (l[2] > 0.78 && x < 0.27) return top === 'tee' || top === 'dress' ? R.SKIN : R.INNER;
    }
    return R.TOP;
  });
  const waist = figBox(U(0, 0, 1.5), ax, [2.8 * bw, 1.8 * bd, 1.5], h => {
    const l = h.l;
    if (bikini) return l[2] < -0.35 ? R.TOP : R.SKIN;
    if (belted && l[2] < -0.58) return R.BELT;
    if (open && faceOf(l) === 'front' && Math.abs(l[0]) < 0.32) return R.INNER;
    return R.TOP;
  });
  const pelvis = figBox([0, 0, hipZ - 0.6], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [2.6 * bw, 1.7 * bd, 1.0],
    () => bikini ? R.TOP : top === 'dress' ? R.TOP : bot === 'skirt' ? R.BOT : bot === 'pants' || bot === 'shorts' ? R.BOT : legSkin);
  parts.push(chest, waist, pelvis);
  for (const sg of [1, -1]) parts.push(figEll(U(sg * 3.05 * bw, 0, 6.35), ax, [1.15, 1.4, 1.0], () => FIG_SLEEVELESS.has(top) ? R.SKIN : R.TOP));
  parts.push(figCap(U(0, 0.1, 6.9), U(0, 0.2, 8.2), 0.95, () => R.SKIN_D, false)); // the neck, in the shadow of the chin
  // the head, and what's on it
  const H = U(0, 0.2, 10.45 + (hs - 1) * 3), hr = [3.1 * hs, 3.0 * hs, 3.0 * hs], hat = look.hat, hair = figHair[look.hair] || figHair.short;
  const head = figEll(H, ax, hr, h => {
    const l = h.l;
    if (hat === 'cap' && l[2] > 0.28) return R.HAT;
    if (hat === 'beanie' && l[2] > 0.12) return l[2] < 0.34 ? R.HAT_D : R.HAT;
    if (look.shades && l[1] > 0.35 && Math.abs(l[0]) < 0.8 && l[2] > -0.05 && l[2] < 0.32) return R.SHADES;
    return hair(l) ? R.HAIR : R.SKIN;
  });
  if (look.form) parts.push(figEll(U(0, 0.1, 8.6), ax, [1.2, 1.2, 0.8], () => R.SKIN)); // a dress form: the knob on its neck, no head
  else parts.push(head);
  const HU = (x, y, z) => fAdd(H, fAdd(fMul(ex, x), fAdd(fMul(ey, y), fMul(ez, z))));
  if (look.hair === 'long') parts.push(figBox(U(0, -1.4, 8.1), ax, [2.9, 1.1, 2.9], () => R.HAIR)); // down over the shoulders
  if (look.hair === 'bun') parts.push(figEll(HU(0, -2.2, 2.2), ax, [1.4, 1.4, 1.4], () => R.HAIR));
  if (look.hair === 'pony') parts.push(figCap(HU(0, -2.8, 1.0), U(0, -2.9, 5.0), 0.85, () => R.HAIR));
  if (look.hair === 'afro') parts.push(figEll(HU(0, -0.5, 0.8), ax, [3.9, 3.6, 3.4], h => h.l[1] > 0.3 && h.l[2] < 0.45 ? 0 : R.HAIR));
  if (hat === 'cap') parts.push(figBox(HU(0, 2.75 * hs, 0.85 * hs), ax, [2.2, 1.3, 0.22], () => R.HAT_D, false));
  if (hat === 'copcap') { // a peaked cap: flat crown wider than the head, a black band, a shiny peak, the badge
    parts.push(figBox(HU(0, 0.25, 2.75), ax, [3.4, 3.2, 0.7], () => R.HAT), figBox(HU(0, 0.2, 1.7), ax, [3.15, 3.0, 0.45], () => R.HAT_D, false),
               figBox(HU(0, 3.2, 1.2), ax, [2.2, 0.75, 0.16], () => R.HAT_D, false));
    decals.push({ p: HU(0, 3.46, 2.65), n: ey, role: R.CAPBADGE, part: parts.length - 3 });
  }
  if (hat === 'hardhat') parts.push(figEll(HU(0, 0.1, 0.8), ax, [3.45, 3.35, 2.6], h => h.l[2] < 0.25 ? 0 : R.HAT), figBox(HU(0, 0.5, 1.4), ax, [3.7, 3.8, 0.17], () => R.HAT_D, false));
  if (!look.shades && !look.form) for (const sg of [1, -1]) { // the eyes
    const n = fNorm([sg * 0.33, 0.93, 0.1]);
    decals.push({ p: HU(n[0] * hr[0], n[1] * hr[1], n[2] * hr[2]), n: fNorm(fAdd(fMul(ex, n[0]), fAdd(fMul(ey, n[1]), fMul(ez, n[2])))), role: R.EYE, part: parts.indexOf(head) });
  }
  // the arms
  // tattoos (look.ink: how much of the bare arm they cover, 0..1): bold shapes wrapping round, more of the arm the more there is
  const inked = h => look.ink > 0 && fract(h.s * 3.2 + Math.atan2(h.n[1], h.n[0]) * 0.32 + (h.n[2] > 0 ? 0.13 : 0)) < 0.25 + look.ink * 0.55 && h.s > 1 - look.ink * 1.6;
  const bare = h => inked(h) ? R.INK : R.SKIN;
  const sleeve = FIG_SLEEVELESS.has(top) ? bare : top === 'tee' || top === 'dress' ? h => h.s < 0.55 ? R.TOP_D : bare(h) : () => R.TOP_D;
  const fore = FIG_LONG.has(top) ? () => R.TOP_D : bare;
  for (const [k, sg] of look.form ? [] : [[0, 1], [1, -1]]) {
    const [up, ua, fp, fa] = P.arms[k], toU = d => fAdd(fMul(ex, d[0]), fAdd(fMul(ey, d[1]), fMul(ez, d[2])));
    const sh = U(sg * 4.05 * bw, 0, 6.35), du = toU(fLimb(up, ua, sg)), df = toU(fLimb(fp, fa, sg));
    const elbow = fAdd(sh, fMul(du, 4.3)), wrist = fAdd(elbow, fMul(df, 3.9)), hand = fAdd(wrist, fMul(df, 0.55));
    parts.push(figCap(sh, elbow, 0.95 * (0.9 + 0.1 * bw), sleeve, false), figCap(elbow, wrist, 0.85 * (0.9 + 0.1 * bw), fore, false), figEll(hand, ax, [0.95, 0.95, 0.95], () => R.SKIN));
    if (look.mic && sg === 1) parts.push(figEll(fAdd(hand, fMul(df, 0.9)), ax, [0.7, 0.7, 0.7], () => R.MIC, false));
  }
  // the legs, the feet
  const thigh = bot === 'pants' ? () => R.BOT : bot === 'shorts' ? h => h.s < 0.7 ? R.BOT : legSkin : () => legSkin;
  const shin = bot === 'pants' ? () => R.BOT : () => legSkin;
  if (look.form) parts.push(figCap([0, 0, hipZ - 1], [0, 0, 0.6], 0.35, () => R.SHOE, false), figEll([0, 0, 0.3], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [2.6, 2.6, 0.35], () => R.SHOE)); // on its pole and foot
  else for (const l of legs) parts.push(figCap(l.hip, l.knee, legR, thigh), figCap(l.knee, fAdd(l.ankle, fMul(l.fz, shinR - FIG_SHOE_LO)), shinR, shin), // (its round end down to the sole, no further)
    figBox(fAdd(l.ankle, fAdd(fMul(l.fy, (FIG_SOLE[0] + FIG_SOLE[1]) / 2), fMul(l.fz, (FIG_SHOE_HI - FIG_SHOE_LO) / 2))), [[1, 0, 0], l.fy, l.fz],
           [shinR * 1.1, (FIG_SOLE[1] - FIG_SOLE[0]) / 2, (FIG_SHOE_HI + FIG_SHOE_LO) / 2], () => R.SHOE, false));
  if (bot === 'skirt' || top === 'dress') parts.push(figEll([0, 0, hipZ - 2.4], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [3.4 * bw, 2.8 * bd, 4.2], h => h.l[2] > 0.35 ? 0 : top === 'dress' ? R.TOP : R.BOT));
  // what's on the back and the belt
  if (look.pack) parts.push(figBox(U(0, -(2.0 * bd + 1.2), 4.5), ax, [2.4, 1.2, 2.4], h => h.l[2] > 0.55 ? R.PACK_D : R.PACK));
  if (look.holster) parts.push(figBox(U(3.2 * bw, -0.4, 0.8), ax, [0.6, 0.9, 1.2], () => R.BELT, false));
  if (look.badge) decals.push({ p: U(-1.45 * bw, 2.0 * bd + 0.01, 5.6), n: ey, role: R.BADGE, part: parts.indexOf(chest) });
  if (belted) decals.push({ p: U(0, 1.8 * bd + 0.01, 0.3), n: ey, role: R.BUCKLE, part: parts.indexOf(waist) });
  if (bot === 'pants' || bot === 'shorts') for (const sg of [1, -1]) decals.push({ p: [sg * 1.35 * bw, -1.7 * bd - 0.01, hipZ - 0.75], n: [0, -1, 0], role: R.POCKET, part: parts.indexOf(pelvis) });
  return { parts, decals };
}

// ---- ray casting the parts: a ray along -V through (u, z) on the view plane. Fills FIG_HIT; returns t or -1.
const FIG_HIT = { t: 0, l: [0, 0, 0], s: 0, n: [0, 0, 0] };
function figHitPart(P, o, d) {
  if (P.k === 2) { // capsule (Inigo Quilez's), and how far along it
    const ba = fSub(P.b, P.a), oa = fSub(o, P.a), baba = fDot(ba, ba), bard = fDot(ba, d), baoa = fDot(ba, oa), rdoa = fDot(d, oa), oaoa = fDot(oa, oa);
    const A = baba - bard * bard, B = baba * rdoa - baoa * bard, Cc = baba * oaoa - baoa * baoa - P.r * P.r * baba;
    let h = B * B - A * Cc, t = -1;
    if (h >= 0 && A > 1e-9) { const t1 = (-B - Math.sqrt(h)) / A, y = baoa + t1 * bard; if (y > 0 && y < baba) t = t1; }
    if (t < 0) for (const end of [P.a, P.b]) {
      const oc = fSub(o, end), b2 = fDot(d, oc), c2 = fDot(oc, oc) - P.r * P.r, h2 = b2 * b2 - c2;
      if (h2 > 0) { const t2 = -b2 - Math.sqrt(h2); if (t2 > 0 && (t < 0 || t2 < t)) t = t2; }
    }
    if (t < 0) return -1;
    const p = fAdd(o, fMul(d, t)), s = clamp(fDot(fSub(p, P.a), ba) / baba, 0, 1);
    FIG_HIT.t = t; FIG_HIT.s = s; FIG_HIT.n = fNorm(fSub(p, fAdd(P.a, fMul(ba, s))));
    return t;
  }
  const q = fSub(o, P.c), A = P.ax;
  if (P.k === 0) { // ellipsoid: into unit-sphere space
    const lo = [fDot(q, A[0]) / P.r[0], fDot(q, A[1]) / P.r[1], fDot(q, A[2]) / P.r[2]], ld = [fDot(d, A[0]) / P.r[0], fDot(d, A[1]) / P.r[1], fDot(d, A[2]) / P.r[2]];
    const a = fDot(ld, ld), b = fDot(lo, ld), c = fDot(lo, lo) - 1, h = b * b - a * c;
    if (h < 0) return -1;
    const t = (-b - Math.sqrt(h)) / a;
    if (t < 0) return -1;
    const l = fAdd(lo, fMul(ld, t));
    FIG_HIT.t = t; FIG_HIT.l = l;
    FIG_HIT.n = fNorm(fAdd(fMul(A[0], l[0] / P.r[0]), fAdd(fMul(A[1], l[1] / P.r[1]), fMul(A[2], l[2] / P.r[2]))));
    return t;
  }
  let tmin = -Infinity, tmax = Infinity, axis = 0, sgn = 1; // box: slabs in its own frame
  for (let k = 0; k < 3; k++) {
    const ok = fDot(q, A[k]), dk = fDot(d, A[k]), hk = P.h[k];
    if (Math.abs(dk) < 1e-9) { if (Math.abs(ok) > hk) return -1; continue; }
    let t1 = (-hk - ok) / dk, t2 = (hk - ok) / dk, s1 = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s1 = 1; }
    if (t1 > tmin) { tmin = t1; axis = k; sgn = s1; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (tmin < 0) return -1;
  const p = fAdd(q, fMul(d, tmin));
  FIG_HIT.t = tmin; FIG_HIT.l = [fDot(p, A[0]) / P.h[0], fDot(p, A[1]) / P.h[1], fDot(p, A[2]) / P.h[2]];
  FIG_HIT.n = fMul(A[axis], sgn);
  return tmin;
}
// the sprite for a view (0..FIG_VIEWS-1: 0 = from in front of them, going round to their right): a role per pixel.
// figRasterAt takes the angle itself, and (near) gets how far toward you each pixel's surface is from the middle
const figRaster = (body, view) => figRasterAt(body, view / FIG_VIEWS * Math.PI * 2);
function figRasterAt(body, th, near) {
  const V = [Math.sin(th), Math.cos(th), 0], Rv = [-V[1], V[0], 0], d = fMul(V, -1);
  const light = fNorm(fAdd(V, fAdd([0, 0, 0.7], fMul(Rv, -0.6)))); // from over your left shoulder
  const spr = new Uint8Array(FIG_W * FIG_H), owner = new Int16Array(FIG_W * FIG_H).fill(-1);
  // each part's extent on the view plane (a bounding sphere's), so a pixel only tries the parts that could cover it
  const box = body.parts.map(P => {
    const [a, b, r] = P.k === 2 ? [P.a, P.b, P.r] : [P.c, P.c, P.k === 0 ? Math.max(...P.r) : Math.hypot(...P.h)];
    const ua = fDot(a, Rv), ub = fDot(b, Rv);
    return [Math.min(ua, ub) - r, Math.max(ua, ub) + r, Math.min(a[2], b[2]) - r, Math.max(a[2], b[2]) + r];
  });
  for (let r = 0; r < FIG_H; r++) for (let c = 0; c < FIG_W; c++) {
    const u = c - (FIG_W - 1) / 2, z = FIG_H - r - 0.5, o = fAdd(fMul(Rv, u), fAdd([0, 0, z], fMul(V, 60)));
    let best = Infinity, role = 0, who = -1;
    body.parts.forEach((P, k) => {
      const e = box[k];
      if (u < e[0] || u > e[1] || z < e[2] || z > e[3]) return;
      const t = figHitPart(P, o, d);
      if (t < 0 || t >= best) return;
      let ro = P.role(FIG_HIT);
      if (!ro) return;
      if (P.shade && FIG_DARK[ro]) {
        const n = P.k === 2 ? fNorm([FIG_HIT.n[0], FIG_HIT.n[1], 0]) : FIG_HIT.n;
        if (fDot(n, light) < (P.k === 0 ? -0.12 : 0.08)) ro = FIG_DARK[ro];
      }
      best = t; role = ro; who = k;
    });
    spr[r * FIG_W + c] = role; owner[r * FIG_W + c] = who;
    if (near) near[r * FIG_W + c] = 60 - best;
  }
  for (const dc of body.decals) { // one pixel each, only where its part is what you see and it's turned toward you
    if (fDot(dc.n, V) < 0.25) continue;
    const c = Math.floor(fDot(dc.p, Rv) + FIG_W / 2), r = FIG_H - 1 - Math.floor(dc.p[2]);
    if (c >= 0 && c < FIG_W && r >= 0 && r < FIG_H && owner[r * FIG_W + c] === dc.part) spr[r * FIG_W + c] = dc.role;
  }
  return spr;
}
const figCache = new Map();
function figSprite(look, view, key) {
  const id = look.shape + '|' + key + '|' + view;
  let s = figCache.get(id);
  if (s) { figCache.delete(id); figCache.set(id, s); return s; } // (most recently used last)
  const bid = look.shape + '|' + key;
  let body = figCache.get(bid);
  if (!body) figCache.set(bid, body = look.build ? look.build(key) : figBody(look, key)); // (an animal brings its own)
  figCache.set(id, s = figRaster(body, view));
  if (figCache.size > 8000) for (const old of [...figCache.keys()].slice(0, 1000)) figCache.delete(old); // the least recently used go
  return s;
}

// ---- looks: shape (what's drawn) and colours, each colour a [palette base, brightness]
const FIG_SKINS = [[STONE, 14], [SKIN, 14], [SKIN, 12], [SKIN, 10], [BRICK, 9], [BRICK, 7], [BRICK, 5]];
const FIG_HAIRS = [[GRAY, 2], [GRAY, 2], [BRICK, 4], [BRICK, 6], [ORANGE, 7], [YEL, 11], [STONE, 11], [GRAY, 8]];
const FIG_SHOES = [[GRAY, 1], [GRAY, 1], [WHITE, 12], [BRICK, 4], [GRAY, 6]];
// look: { hair, hat, top, bot, pack, shades, holster, badge, mic, tights, kid, bw (build), sparkle,
//         col: { hair, skin, top, inner, bot, belt, shoe, hat, hatD, pack, tie, tights } }
function figLook(o) {
  const col = { hair: [GRAY, 1], skin: [SKIN, 13], top: [GRAY, 8], inner: [WHITE, 12], bot: [BLUE, 5], belt: [GRAY, 1], shoe: [GRAY, 1],
                hat: [GRAY, 3], hatD: [GRAY, 1], pack: [GRAY, 4], tie: [GRAY, 1], tights: [GRAY, 2], ...o.col };
  const look = { hair: 'short', top: 'tee', bot: 'pants', bw: 1, ...o, col };
  look.shape = ['hair', 'hat', 'top', 'bot', 'pack', 'shades', 'holster', 'badge', 'mic', 'tights', 'kid', 'bw', 'form', 'ink'].map(k => look[k] ?? '').join(',');
  // per role: palette base and brightness (shadow roles darker)
  const B = new Uint8Array(FIG_ROLES), Lv = new Float32Array(FIG_ROLES), put = (role, [b, l], k = 1) => { B[FR[role]] = b; Lv[FR[role]] = l * k; };
  put('HAIR', col.hair); put('HAIR_D', col.hair, 0.65); put('SKIN', col.skin); put('SKIN_D', col.skin, 0.72); put('EYE', [GRAY, 0]);
  put('TOP', col.top); put('TOP_D', col.top, 0.68); put('INNER', col.inner); put('BOT', col.bot); put('BOT_D', col.bot, 0.68);
  put('POCKET', col.bot, 0.45); put('BELT', col.belt); put('BUCKLE', [YEL, 12]); put('SHOE', col.shoe); put('HAT', col.hat); put('HAT_D', col.hatD);
  put('BADGE', [YEL, 15]); put('CAPBADGE', [YEL, 15]); put('PACK', col.pack); put('PACK_D', col.pack, 0.65); put('STRAP', col.pack, 0.65);
  put('SHADES', [GRAY, 0]); put('TIE', col.tie); put('MIC', [GRAY, 5]); put('TIGHTS', col.tights); put('INK', col.ink || [GREEN, 5]);
  look.base = B; look.lvl = Lv;
  return look;
}
// someone on the street, from a seed: dressed for the season, in their own shirt and trousers colours
function figStreetLook(seed, shirt, pants, si = seasonIdx(), extra) {
  const h = k => hash(seed, k, 9071), of = (a, k) => a[Math.floor(h(k) * a.length)];
  const warm = si === 1, cold = si === 3;
  const top = of(warm ? ['tee', 'tee', 'tee', 'tank', 'dress', 'long'] : cold ? ['jacket', 'jacket', 'long', 'long', 'jacket'] : ['tee', 'long', 'jacket', 'tee', 'long', 'dress'], 1);
  const bot = top === 'dress' ? 'pants' : of(warm ? ['pants', 'shorts', 'shorts', 'skirt'] : cold ? ['pants', 'pants', 'pants', 'skirt'] : ['pants', 'pants', 'skirt', 'shorts'], 2);
  const hair = of(['short', 'short', 'long', 'long', 'bob', 'bun', 'pony', 'buzz', 'afro', 'bald'], 3);
  const hat = cold && h(4) < 0.35 ? 'beanie' : h(4) < 0.1 ? 'cap' : null;
  const topLvl = [8, 11, 13][Math.floor(h(5) * 3)], jeans = pants === BLUE;
  const botCol = top === 'dress' ? [shirt, topLvl] : bot === 'skirt' ? of([[GRAY, 2], [shirt, 6], [BRICK, 5], [BLUE, 4]], 6) : jeans ? [BLUE, 5 + Math.floor(h(6) * 3)] : of([[GRAY, 2], [GRAY, 5], [STONE, 8], [GRAY, 9]], 6);
  return figLook({ hair, hat, top, bot, pack: h(7) < 0.22, shades: warm && h(8) < 0.15, tights: (bot === 'skirt' || top === 'dress') && cold, bw: [0.9, 1, 1, 1.12][Math.floor(h(9) * 4)],
    col: { hair: of(FIG_HAIRS, 10), skin: of(FIG_SKINS, 11), top: [shirt, topLvl], inner: of([[WHITE, 12], [GRAY, 3], [STONE, 11]], 12), bot: botCol,
           shoe: of(FIG_SHOES, 13), hat: of([[RED, 7], [GRAY, 3], [BLUE, 6], [GREEN, 6], [YEL, 10]], 14), hatD: [GRAY, 2], pack: of([[GRAY, 3], [RED, 6], [BLUE, 5], [GREEN, 5], [BRICK, 5]], 15),
           tights: [GRAY, 2] }, ...extra });
}
// someone in a room or at a stall: a new face each time, in the shirt colour the room asks for
const figAnyone = (shirt, extra) => figStreetLook(Math.random() * 1e9 | 0, shirt, Math.random() < 0.6 ? BLUE : GRAY, seasonIdx(), extra);
// the police: navy uniform, peaked cap with a badge, a badge on the chest, a duty belt with a holster
const figCopLook = seed => figLook({ hair: hash(seed, 1, 9072) < 0.3 ? 'bun' : 'short', hat: 'copcap', top: 'uniform', bot: 'pants', badge: true, holster: true,
  col: { hair: FIG_HAIRS[Math.floor(hash(seed, 2, 9072) * 4)], skin: FIG_SKINS[Math.floor(hash(seed, 3, 9072) * FIG_SKINS.length)], top: [BLUE, 5], inner: [BLUE, 7],
         bot: [BLUE, 3], belt: [GRAY, 1], shoe: [GRAY, 1], hat: [BLUE, 4], hatD: [GRAY, 1] } });
// security guards: charcoal blazer and tie, a black cap, a brass badge
const figGuardLook = seed => figLook({ hair: 'short', hat: 'copcap', top: 'suit', bot: 'pants', badge: true,
  col: { hair: [GRAY, 1], skin: FIG_SKINS[Math.floor(hash(seed, 3, 9073) * FIG_SKINS.length)], top: [GRAY, 3], inner: [WHITE, 12], tie: [RED, 5],
         bot: [GRAY, 3], belt: [GRAY, 1], shoe: [GRAY, 1], hat: [GRAY, 2], hatD: [GRAY, 1] } });

// the Velvet Rope's dancers: long hair (sometimes dyed), a sequinned two-piece and heels in her colour, all a-glitter
const figDancerLook = (seed, col) => figLook({ hair: 'long', top: 'bikini', bot: 'bikini', bw: 0.92, sparkle: true,
  col: { hair: [[GRAY, 2], [YEL, 12], [MAG, 9], [BRICK, 5], [CYAN, 9]][Math.floor(hash(seed, 1, 9075) * 5)], skin: FIG_SKINS[Math.floor(hash(seed, 2, 9075) * FIG_SKINS.length)],
         top: [col, 13], bot: [col, 13], shoe: [col, 10] } });
// the doorman: shaved head, shades, black suit, built like the door he's minding
const figBouncerLook = () => figLook({ hair: 'bald', shades: true, top: 'suit', bot: 'pants', bw: 1.35,
  col: { skin: [BRICK, 8], top: [GRAY, 2], inner: [WHITE, 12], tie: [GRAY, 1], bot: [GRAY, 2], shoe: [GRAY, 1] } });
// someone off a building site: hard hat, hi-vis, jeans
const figWorkerLook = seed => figLook({ hair: 'short', hat: 'hardhat', top: 'long', bot: 'pants',
  col: { skin: FIG_SKINS[Math.floor(hash(seed, 1, 9076) * FIG_SKINS.length)], hat: [YEL, 13], hatD: [YEL, 9], top: [ORANGE, 13], bot: [BLUE, 6], shoe: [BRICK, 4] } });

// ---- people among a room's props (rooms.js draws them): { fig: look, x, y, z (floor), h (height), pose (key, or a
// function of the prop), seatZ (seat height, sitting), face: [fx, fy] or null (turns to you), dir (heading, radians: a
// guard), chat: false (not someone you can talk to), still: true (not a person at all: a mannequin, a cut-out, the shop
// cat; still there when you break in at night), light (least brightness) }
const figProp = (x, y, fig, o) => ({ fig, x, y, z: 0, h: 1.75, pose: 'stand', face: null, ...o });
const isRoomPerson = s => !!s.fig && s.chat !== false; // someone you could talk to
// where something drawn as a figure is heading, from how it's moved since it was last drawn
function figMotion(o) {
  const ex = rel(o.x - (o._mx ?? o.x)), ey = rel(o.y - (o._my ?? o.y)), d = Math.hypot(ex, ey);
  o._moving = d > 1e-5 && d < 0.5;
  if (o._moving) { o._fx = ex / d; o._fy = ey / d; o._dist = (o._dist || 0) + d; }
  o._mx = o.x; o._my = o.y;
  return o;
}
function drawFigProp(s, rx, ry) {
  figMotion(s);
  const unit = s.h / FIG_TALL;
  let key = typeof s.pose === 'function' ? s.pose(s) : s.pose;
  if (key === 'sit' || key === 'sitfold') key += Math.round((s.seatZ ?? 0.45) / unit);
  else if (key === 'stand' && s._moving) key = 'walk' + Math.floor(s._dist / (s.h * 0.85) * 8) % 8; // a stride every 1.5m or so
  const [fx, fy] = s.dir != null ? [Math.cos(s.dir), Math.sin(s.dir)] : s.face || (s._fx != null && s._moving ? [s._fx, s._fy] : [0, 0]);
  drawFigure(rx, ry, s.z, s.h, fx, fy, s.fig, key, s.light && { light: s.light });
}

// ---- drawing one. (rx, ry) from you, standing on z0, h tall (standing height, world units), facing (fx, fy) - or
// at you, if both are 0. pose: a figPose key. opts.light: least brightness (0-15) whatever the light.
function figView(rx, ry, fx, fy) {
  if (!fx && !fy) return 0;
  const d = Math.hypot(rx, ry) || 1, vx = -rx / d, vy = -ry / d, bx = vx * -fy + vy * fx, by = vx * fx + vy * fy;
  return mod(Math.round(Math.atan2(bx, by) / (Math.PI * 2) * FIG_VIEWS), FIG_VIEWS);
}
const figCount = new Uint16Array(FIG_ROLES);
function figSample(spr, pu, pz, su, sz) {
  if (su <= 1.25 && sz <= 1.25) { // a pixel to a cell or bigger: just that pixel (its details too, once nothing can be skipped)
    const c = Math.floor(pu), r = FIG_H - 1 - Math.floor(pz);
    if (c < 0 || c >= FIG_W || r < 0 || r >= FIG_H) return 0;
    const k = spr[r * FIG_W + c];
    return su <= 1 && sz <= 1 ? k : FIG_COARSE[k] || k;
  }
  // smaller: the commonest thing under the cell, or nothing if it's mostly see-through (no flicker as it walks)
  const a0 = Math.floor(pu - su / 2), a1 = Math.floor(pu + su / 2), b0 = Math.floor(pz - sz / 2), b1 = Math.floor(pz + sz / 2);
  let n = 0, best = 0, bn = 0;
  for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
    const r = FIG_H - 1 - b;
    if (a < 0 || a >= FIG_W || r < 0 || r >= FIG_H) continue;
    const k0 = spr[r * FIG_W + a];
    if (!k0) continue;
    const k = FIG_COARSE[k0] || k0; n++;
    if (++figCount[k] > bn) { bn = figCount[k]; best = k; }
  }
  figCount.fill(0);
  return n * 2.2 >= (a1 - a0 + 1) * (b1 - b0 + 1) ? best : 0;
}
function drawFigure(rx, ry, z0, h, fx, fy, look, pose = 'stand', opts) {
  const spr = figSprite(look, figView(rx, ry, fx, fy), pose), unit = h / FIG_TALL, floor = opts?.light || 0, sparkle = look.sparkle;
  drawShape(rx, ry, z0, FIG_W / 2 * unit, FIG_H * unit, (i, u, z, du, dz, L) => {
    const role = figSample(spr, u / unit + FIG_W / 2, z / unit, du / unit, dz / unit);
    if (!role) return false;
    const lit = Math.max(floor, L), k = clamp(0.32 + lit / 15 * 0.78, 0.32, 1);
    BG[i] = sparkle && role === FR.TOP && hash(i, Math.floor(T * 7), 9074) > 0.8 ? C(WHITE, 15) : C(look.base[role], look.lvl[role] * k);
    return set(i, ' ', 0), true;
  });
}

// ---- animals: built and drawn just like people (parts, cast from the side you see into a cached sprite, painted as
// solid colour), so they read as clearly at any size. They borrow the people's colour roles: BODY is a top, HEAD is
// skin (so the one-pixel eye melts into the head far off, as ours do), BEAK a hat, LEG a shoe, WING trousers, MARK a
// pack, PALE a shirt's inner. Body frame as for people: x their right, y ahead, z up, in sprite pixels.
const AR = { BODY: FR.TOP, HEAD: FR.SKIN, BEAK: FR.HAT, LEG: FR.SHOE, WING: FR.BOT, MARK: FR.PACK, PALE: FR.INNER, EYE: FR.SHADES, PUPIL: FR.HAIR, TONGUE: FR.MIC }; // (eyes and tongue on roles that don't melt into their neighbours far off, as people's one-pixel details do)
// Close-up animals are built small and scaled up to fill the sprite (more pixels, more detail); drawn at h / scale.
const ANIMAL_SCALE = { cat: () => 2.5, dog: f => f >= 5 ? 2 : 1.4 };
const scaleBody = ({ parts, decals }, k) => k === 1 ? { parts, decals } : {
  parts: parts.map(P => P.k === 2 ? { ...P, a: fMul(P.a, k), b: fMul(P.b, k), r: P.r * k } : P.k === 0 ? { ...P, c: fMul(P.c, k), r: fMul(P.r, k) } : { ...P, c: fMul(P.c, k), h: fMul(P.h, k) }),
  decals: decals.map(d => ({ ...d, p: fMul(d.p, k) })) };
// an animal drawn by drawFigure; h: how big, as for one built at scale 1
const drawAnimal = (rx, ry, z0, h, fx, fy, look, frame = 0, opts) => drawFigure(rx, ry, z0, h / look.scale(frame), fx, fy, look, 'f' + frame, opts);
const AN_I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// col: { body, head, beak, leg, wing, mark, pale, eye }, each [palette base, brightness]. key for drawFigure: 'f' + frame
function animalLook(kind, col) {
  const c = { body: [GRAY, 8], beak: [ORANGE, 12], leg: [GRAY, 4], mark: [GRAY, 6], pale: [WHITE, 13], ...col };
  c.head ||= c.body; c.wing ||= c.body;
  const B = new Uint8Array(FIG_ROLES), Lv = new Float32Array(FIG_ROLES), put = (r, [b, l], k = 1) => { B[r] = b; Lv[r] = l * k; };
  put(FR.TOP, c.body); put(FR.TOP_D, c.body, 0.68); put(FR.SKIN, c.head); put(FR.SKIN_D, c.head, 0.7); put(FR.HAT, c.beak); put(FR.HAT_D, c.beak, 0.75);
  put(FR.SHOE, c.leg); put(FR.BOT, c.wing); put(FR.BOT_D, c.wing, 0.68); put(FR.PACK, c.mark); put(FR.PACK_D, c.mark, 0.65); put(FR.INNER, c.pale); put(FR.EYE, c.eye || [GRAY, 0]);
  put(FR.HAIR, c.pupil || [GRAY, 0]); put(FR.MIC, c.tongue || [MAG, 11]); put(FR.SHADES, c.eye || [GRAY, 0]);
  const scale = f => ANIMAL_SCALE[kind]?.(f) ?? 1;
  return { shape: 'animal:' + kind, base: B, lvl: Lv, scale, build: key => { const f = +key.slice(1) || 0; return scaleBody(ANIMAL_BODIES[kind](f), scale(f)); } };
}
// both eyes, a pixel each, on the sides of a head part (its centre c, radius r across), a little forward and up
const animalEyes = (c, r, part, fwd = 0.45, up = 0.35) => [1, -1].map(sg => ({ p: [c[0] + sg * r * 0.92, c[1] + r * fwd, c[2] + r * up], n: [sg, 0.3, 0], role: FR.EYE, part }));
const ANIMAL_BODIES = {
  flamingo: f => { // on one leg; frame 1: head down, feeding
    const R = AR, parts = [figEll([0, 0, 19], AN_I, [2.6, 4.2, 2.6], () => R.BODY), figEll([0, -4.2, 19.6], AN_I, [1.6, 2, 1.1], () => R.WING)];
    parts.push(figCap([0.9, 0, 17], [0.9, 0.3, 0.6], 0.45, () => R.LEG, false), figCap([-0.9, 0, 17], [-0.9, 1.8, 12.5], 0.45, () => R.LEG, false),
               figCap([-0.9, 1.8, 12.5], [-0.9, -0.6, 14.2], 0.4, () => R.LEG, false), figBox([0.9, 0.9, 0.3], AN_I, [0.6, 1.2, 0.3], () => R.LEG, false));
    const neck = f ? [[0, 3.4, 20.5], [0, 6, 18], [0, 7.4, 12], [0, 7.8, 5.5]] : [[0, 3.4, 20.5], [0, 4.8, 24], [0, 3.6, 27.5], [0, 4.4, 30.2]];
    for (let k = 1; k < neck.length; k++) parts.push(figCap(neck[k - 1], neck[k], 0.75, () => R.BODY));
    const hc = f ? [0, 7.9, 4.4] : [0, 4.8, 31.2], head = parts.length;
    parts.push(figEll(hc, AN_I, [1.3, 1.6, 1.3], () => R.HEAD));
    parts.push(f ? figCap([0, 8.6, 3.6], [0, 8.9, 1.2], 0.5, h => h.s > 0.55 ? R.BEAK : R.PALE) : figCap([0, 6, 31.1], [0, 7.7, 29.5], 0.55, h => h.s > 0.55 ? R.BEAK : R.PALE));
    return { parts, decals: animalEyes(hc, 1.3, head) };
  },
  duck: () => { // a mallard drake on the water: brown chest, grey wings, a white collar, a green head, a yellow bill
    const R = AR, hc = [0, 4, 7];
    const parts = [figEll([0, 0, 3], AN_I, [3, 5, 2.4], () => R.BODY), figEll([0, -0.6, 4.2], AN_I, [3.1, 3.8, 1.6], () => R.WING),
      figEll([0, -4.8, 4], AN_I, [1.4, 1.6, 1], () => R.WING), figCap([0, 3.3, 4.4], [0, 3.8, 6], 1.15, () => R.PALE),
      figEll(hc, AN_I, [1.7, 2, 1.8], () => R.HEAD), figBox([0, 6.2, 6.5], AN_I, [0.8, 1.1, 0.35], () => R.BEAK)];
    return { parts, decals: animalEyes(hc, 1.7, 4) };
  },
  tortoise: f => { // a domed shell in plates, a pale rim, stumpy legs (frame: which pair is stepping)
    const R = AR, step = f ? 0.7 : -0.7, hc = [0, 6, 2.6];
    const parts = [figEll([0, 0, 1.2], AN_I, [4, 5, 3.6], h => h.l[2] < 0.05 ? R.PALE
      : (Math.floor((Math.atan2(h.l[1], h.l[0]) / Math.PI + 1) * 3) + Math.floor(h.l[2] * 2.5)) & 1 ? R.MARK : R.BODY)];
    for (const [sx, sy, k] of [[1, 1, 0], [-1, 1, 1], [1, -1, 1], [-1, -1, 0]]) {
      const y = sy * 3 + (k ? step : -step);
      parts.push(figCap([sx * 2.9, y, 1.6], [sx * 3.2, y, 0.5], 0.85, () => R.HEAD));
    }
    parts.push(figCap([0, 3.8, 1.8], [0, 5.2, 2.4], 0.85, () => R.HEAD), figEll(hc, AN_I, [1.15, 1.5, 1.05], () => R.HEAD));
    return { parts, decals: animalEyes(hc, 1.15, parts.length - 1) };
  },
  bear: () => { // asleep on its front, chin on its paws
    const R = AR, hc = [0, 8.5, 4];
    const parts = [figEll([0, -1, 5], AN_I, [6, 9, 5], () => R.BODY), figEll(hc, AN_I, [3.5, 3.5, 3.2], () => R.HEAD),
      figEll([0, 11.6, 3.2], AN_I, [1.7, 1.9, 1.4], h => h.l[1] > 0.75 && h.l[2] > -0.2 ? R.BEAK : R.PALE)];
    for (const sg of [1, -1]) parts.push(figEll([sg * 2.4, 7.6, 7.2], AN_I, [1.1, 0.7, 1.1], () => R.HEAD), figCap([sg * 3.2, 5, 1.1], [sg * 3.2, 10.6, 1.1], 1.3, () => R.BODY),
      figEll([sg * 4.4, -7.4, 2.5], AN_I, [2, 3, 2.5], () => R.BODY));
    return { parts, decals: animalEyes(hc, 3.4, 1, 0.55, 0.25) };
  },
  dog: f => { // on all fours, frames 0-3 a trotting stride, 4 nose down sniffing, 5-6 sitting up wagging; floppy ears, a collar
    if (f >= 5) return dogSitting(f & 1 ? 1 : -1);
    const R = AR, sniff = f === 4, w = f / 4 * Math.PI * 2, hc = sniff ? [0, 6.2, 4.6] : [0, 5.2, 8.6], wag = (f & 1 ? 1 : -1) * 1.2;
    const parts = [figEll([0, 0, 6], AN_I, [2.2, 4.6, 2.2], () => R.BODY), figEll(hc, AN_I, [1.8, 2.1, 1.8], () => R.HEAD)];
    for (const [sx, sy, ph] of [[1, 3.2, 0], [-1, 3.2, Math.PI], [1, -3.2, Math.PI], [-1, -3.2, 0]]) { // legs: diagonal pairs together
      const sw = sniff ? 0 : Math.sin(w + ph) * 1.3;
      parts.push(figCap([sx * 1.3, sy, 5.2], [sx * 1.3, sy + sw, 0.6], 0.75, () => R.LEG, false));
    }
    parts.push(figCap(sniff ? [0, 3.4, 6.2] : [0, 3.6, 7], sniff ? [0, 5.4, 5.2] : [0, 4.8, 8], 1.2, () => R.BODY)); // the neck
    parts.push(figCap(fAdd(hc, [0, 1.6, -0.4]), fAdd(hc, [0, 3, -0.85]), 0.9, () => R.PALE), figEll(fAdd(hc, [0, 3.85, -0.6]), AN_I, [0.5, 0.3, 0.38], () => R.BEAK)); // the muzzle, its nose
    for (const sg of [1, -1]) parts.push(figEll(fAdd(hc, [sg * 1.5, -0.4, 0.2]), AN_I, [0.55, 0.9, 1.4], () => R.WING)); // the ears
    parts.push(figCap([wag * 0.4, -4.3, 7], [wag, -6.3, 9.4], 0.5, () => R.BODY)); // the tail
    parts.push(figCap(sniff ? [0, 4.6, 5.7] : [0, 4.2, 7.6], sniff ? [0, 4.8, 5.4] : [0, 4.3, 7.4], 1.3, () => R.MARK, false)); // the collar
    return { parts, decals: dogEyes(hc, 1) };
  },
  cat: f => { // sitting up, tail curled round its front paws: a tabby with a white bib, muzzle and paws, green eyes
    // with slit pupils (frame 1: a slow blink), pink noses and ear insides
    const R = AR, hc = [0, 1.5, 8.7];
    const stripe = h => fract(h.l[2] * 2.4 + Math.abs(h.l[0]) * 0.9) < 0.28 ? R.MARK : R.BODY;
    const parts = [
      figEll([0, -1, 2.8], AN_I, [3.4, 3.1, 2.8], stripe), // haunches
      figEll([0, 0.9, 5], AN_I, [2.7, 2.1, 3.1], h => h.l[1] > 0.7 && Math.abs(h.l[0]) < 0.5 && h.l[2] < 0.55 ? R.PALE : stripe(h)), // chest, its bib
      figEll(hc, AN_I, [2.75, 2.2, 2.3], h => h.l[2] > 0.45 && Math.abs(h.l[0]) < 0.5 && fract(h.l[0] * 4 + 0.5) < 0.35 ? R.MARK : R.BODY), // head, an M on the brow
    ];
    for (const sg of [1, -1]) {
      parts.push(figEll(fAdd(hc, [sg * 0.55, 1.85, -0.6]), AN_I, [0.75, 0.55, 0.6], () => R.PALE)); // the muzzle's cheeks
      parts.push(figEll(fAdd(hc, [sg * 1.05, 1.95, 0.4]), AN_I, [0.95, 0.32, 0.75], h => f === 1 ? R.BODY : Math.abs(h.l[0]) < 0.16 && Math.abs(h.l[2]) < 0.8 ? R.PUPIL : R.EYE)); // an eye: green, a slit pupil
      parts.push(figEll(fAdd(hc, [sg * 1.6, 0.1, 2.05]), [[Math.cos(0.35), 0, sg * Math.sin(0.35)], [0, 1, 0], [-sg * Math.sin(0.35), 0, Math.cos(0.35)]], [0.75, 0.32, 1.25],
        h => h.l[1] > 0.4 && Math.abs(h.l[0]) < 0.6 && h.l[2] < 0.6 ? R.BEAK : R.BODY)); // an ear, pink inside
      parts.push(figCap([sg * 1.1, 1.7, 4.2], [sg * 1.1, 2, 0.55], 0.7, () => R.PALE), figEll([sg * 1.1, 2.4, 0.4], AN_I, [0.75, 0.9, 0.45], () => R.PALE)); // a front leg, its paw
    }
    parts.push(figEll(fAdd(hc, [0, 2.3, -0.15]), AN_I, [0.4, 0.25, 0.28], () => R.BEAK), figEll(fAdd(hc, [0, 1.85, -1.1]), AN_I, [0.6, 0.45, 0.35], () => R.PALE)); // the nose, the chin
    parts.push(figCap([-1.9, -3, 0.9], [-2.9, 0.3, 0.6], 0.6, stripe), figCap([-2.9, 0.3, 0.6], [-1.3, 2.9, 0.55], 0.55, h => h.s > 0.75 ? R.MARK : stripe(h))); // the tail round its paws
    return { parts, decals: [] };
  },
  peacock: f => { // strutting, its train fanned out behind: green with eyes in rings of cyan (frame: a stride of four)
    const R = AR, w = f / 4 * Math.PI * 2, hc = [0, 3.3, 13.3];
    const parts = [figEll([0, 0, 7], AN_I, [2.2, 3.5, 2.6], () => R.BODY), figCap([0, 2.2, 8.4], [0, 3, 12.5], 1, () => R.BODY), figEll(hc, AN_I, [1, 1.25, 1], () => R.BODY),
      figBox([0, 4.6, 13.2], AN_I, [0.3, 0.55, 0.25], () => R.BEAK)];
    for (const [sg, ph] of [[1, 0], [-1, Math.PI]]) { const sw = Math.sin(w + ph) * 0.9; parts.push(figCap([sg * 0.9, 0, 5], [sg * 0.9, sw, 0.3], 0.4, () => R.LEG, false)); }
    for (const dxc of [-0.7, 0, 0.7]) parts.push(figCap([dxc * 0.5, 3.2, 14.1], [dxc, 3, 15.6], 0.22, () => R.MARK, false));
    const fan = [0, -3.6, 5], ax = [[1, 0, 0], [0, Math.cos(0.3), -Math.sin(0.3)], [0, Math.sin(0.3), Math.cos(0.3)]];
    parts.push(figEll(fan, ax, [12, 0.6, 15], h => {
      if (h.l[2] < -0.05) return 0; // (the half above its tail)
      const rr = Math.hypot(h.l[0], h.l[2]), ang = Math.atan2(h.l[0], h.l[2]), ring = fract(rr * 3.4), spoke = fract(ang * 8 / Math.PI);
      return ring > 0.3 && ring < 0.7 && spoke > 0.25 && spoke < 0.75 ? (ring > 0.42 && ring < 0.58 ? R.PALE : R.MARK) : R.WING;
    }, false));
    return { parts, decals: animalEyes(hc, 1, 2) };
  },
};

// a dog's look in its coat colour (one per colour, made the first time it's seen): darker ears, a paler muzzle, a red
// collar, a black nose
const DOG_LOOKS = new Map();
const dogLook = col => DOG_LOOKS.get(col) || DOG_LOOKS.set(col, animalLook('dog', { body: [col, 9], wing: [col, 6], pale: [col, 12], leg: [col, 8], mark: [RED, 10], beak: [GRAY, 1], pupil: [GRAY, 0], tongue: [MAG, 11] })).get(col);
// a dog (vx, vy) from you, facing (fx, fy); s: how big (1 a mid-sized dog); frame: see ANIMAL_BODIES.dog
const drawDog = (vx, vy, fx, fy, col, s = 1, frame = 0) => drawAnimal(vx, vy, 0, 0.13 * s, fx, fy, dogLook(col), frame);
// a dog's eyes: on the front of its head, either side above the muzzle (clear of the ears)
const dogEyes = (hc, part) => [1, -1].map(sg => ({ p: fAdd(hc, [sg * 1, 1.55, 0.55]), n: [sg * 0.4, 1, 0.2], role: FR.EYE, part }));
// a dog sitting up: haunches down, front legs straight, head up, tongue out, tail sweeping the floor (wag: -1 / 1)
function dogSitting(wag) {
  const R = AR, hc = [0, 2.6, 11.2], tilt = [[1, 0, 0], [0, Math.cos(0.5), Math.sin(0.5)], [0, -Math.sin(0.5), Math.cos(0.5)]];
  const parts = [figEll([0, -1.8, 3], AN_I, [2.3, 2.6, 2.4], () => R.BODY), figEll([0, 0.6, 6.4], tilt, [2.1, 2.2, 3.4], h => h.l[1] > 0.6 && Math.abs(h.l[0]) < 0.45 ? R.PALE : R.BODY),
    figEll(hc, AN_I, [1.8, 2.1, 1.8], () => R.HEAD), figCap([0, 1.6, 8.6], [0, 2.2, 10.2], 1.2, () => R.BODY)];
  for (const sg of [1, -1]) parts.push(figCap([sg * 1.2, 1.8, 5.2], [sg * 1.2, 2.3, 0.6], 0.75, () => R.LEG, false), figEll([sg * 1.2, 2.8, 0.45], AN_I, [0.75, 0.9, 0.45], () => R.LEG, false), // front legs, paws
    figEll([sg * 2.1, -1.4, 1.5], AN_I, [1, 2.6, 1.4], () => R.BODY), // the hind legs folded under
    figEll(fAdd(hc, [sg * 1.55, -0.3, -0.1]), [[1, 0, 0], [0, 1, 0], [sg * 0.25, 0, 1]], [0.55, 0.9, 1.5], () => R.WING), // the ears, hanging
    figEll(fAdd(hc, [sg * 1.0, 1.7, 0.5]), AN_I, [0.3, 0.22, 0.34], h => h.l[1] > 0.5 && h.l[0] * sg > 0.1 && h.l[2] > 0.2 ? R.PALE : R.PUPIL)); // the eyes, a glint in each
  parts.push(figCap(fAdd(hc, [0, 1.6, -0.4]), fAdd(hc, [0, 3, -0.85]), 0.95, () => R.PALE), figEll(fAdd(hc, [0, 3.85, -0.6]), AN_I, [0.55, 0.3, 0.4], () => R.BEAK)); // muzzle, nose
  parts.push(figEll(fAdd(hc, [0, 3.1, -1.75]), [[1, 0, 0], [0, Math.cos(0.4), -Math.sin(0.4)], [0, Math.sin(0.4), Math.cos(0.4)]], [0.45, 0.3, 0.75], () => R.TONGUE, false)); // the tongue, out
  parts.push(figCap([0, -4, 1.2], [wag * 2.2, -5.8, 0.7], 0.5, () => R.BODY), figCap([0, 2.1, 9.4], [0, 2.3, 9.2], 1.05, () => R.MARK, false)); // tail, collar
  return { parts, decals: [] };
}
const CAT_LOOK = animalLook('cat', { body: [ORANGE, 10], mark: [ORANGE, 6], pale: [WHITE, 14], beak: [MAG, 11], eye: [GREEN, 13], pupil: [GRAY, 0] });
const KITTEN_LOOK = animalLook('cat', { body: [GRAY, 9], mark: [GRAY, 5], pale: [WHITE, 14], beak: [MAG, 11], eye: [CYAN, 12], pupil: [GRAY, 0] });
