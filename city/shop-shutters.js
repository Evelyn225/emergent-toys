// Roller shutters: a shop shut for the night (or for good) pulls a slatted steel curtain down over its windows and
// door. It runs in guide rails set 8 cm back in the reveal, from the housing box it rolls up into at the head of the
// opening: ribbed slats, each lip catching the light and the crease under it in shadow, a heavier bottom bar with the
// padlock in the middle. Most are galvanised; some are painted green, blue or red. Further off the slats blur into
// an even ribbed texture. Shared by every facade family (through architectureShutter, or directly).
// a: across the opening (the caller's along-the-wall coordinate), a0..a1 its sides; z0..z1 its sill and head;
// sa: how far a ray drifts along a per unit of depth (WH.sl when a runs with the wall's u, as every facade's along does)
const SHOP_SHUTTER = { dep: .008, slat: .009, housing: .022, rail: .004, bar: .012, lock: .006 };
const SHUTTER_PAINT = [GRAY, GRAY, GRAY, GRAY, GREEN, BLUE, BRICK], SHUTTER_PAINT_OF = new WeakMap();
function shutterPaint(sh) { // one colour for all of a shop's shutters: from its name and its building
  let p = SHUTTER_PAINT_OF.get(sh);
  if (p === undefined) {
    let h = Math.floor((sh.architecture?.seed ?? 0) * 1e3);
    for (const ch of sh.word) h = (h * 31 + ch.charCodeAt(0)) | 0;
    SHUTTER_PAINT_OF.set(sh, p = SHUTTER_PAINT[(hash(h & 0xffff, (h >>> 16) & 0xffff, 1501) * SHUTTER_PAINT.length) | 0]);
  }
  return p;
}
function shopShutter(i, a, z, a0, a1, z0, z1, sh, L, d, sa = WH.sl) {
  const w = SHOP_SHUTTER, paint = shutterPaint(sh), top = z1 - w.housing;
  if (z > top) { // the housing, its lower lip
    BG[i] = C(GRAY, 1.5 + L * .12 + day * .3);
    return set(i, z - top < .004 ? '_' : ' ', C(GRAY, L * .6)), true;
  }
  let ca = a, cz = z;
  if (d < SHOP_WINDOW.near) { // up close: set back in the reveal, the rails and the head either side of it
    const sz = (z - eye) / WH.dn;
    let q = w.dep, s = 'back';
    if (sa > 1e-6 && (a1 - a) / sa < q) { q = (a1 - a) / sa; s = 'side'; }
    if (sa < -1e-6 && (a0 - a) / sa < q) { q = (a0 - a) / sa; s = 'side'; }
    if (sz > 1e-6 && (top - z) / sz < q) { q = (top - z) / sz; s = 'ceil'; }
    if (sz < -1e-6 && (z0 - z) / sz < q) { q = (z0 - z) / sz; s = 'floor'; }
    if (s === 'side') { BG[i] = C(GRAY, .9 + L * .1); return set(i, '|', C(GRAY, L * .5)), true; } // the guide rail's channel
    if (s === 'ceil') { BG[i] = C(GRAY, .5); return set(i, ' ', 0), true; } // under the housing
    if (s === 'floor') { BG[i] = C(GRAY, 1 + L * .1); return set(i, '_', C(GRAY, L * .5)), true; } // the sill
    ca = a + sa * q; cz = z + sz * q;
  }
  const fine = w.slat * projY / d; // (rows a slat spans on screen)
  if (ca - a0 < w.rail || a1 - ca < w.rail) { BG[i] = C(GRAY, 1.2 + L * .12); return set(i, '|', C(GRAY, L * .7)), true; } // its edges in the rails
  if (cz - z0 < w.bar) { // the bottom bar, the padlock through it
    const lock = fine > 1 && Math.abs(ca - (a0 + a1) / 2) < w.lock && cz - z0 > .002 && cz - z0 < w.bar - .002;
    BG[i] = lock ? C(YEL, 1.4 + L * .08) : C(paint, 1.8 + L * .15);
    return set(i, lock ? 'o' : cz - z0 < .002 ? '_' : '=', C(lock ? GRAY : paint, L * .8)), true;
  }
  if (fine < 2) { BG[i] = C(paint, 1.2 + L * .12 + day * .4); return set(i, '=', C(paint, L * .6)), true; } // too far to make out each slat: their ribs as one texture
  const q = fract((top - cz) / w.slat), lip = q < .22, crease = q > .84;
  BG[i] = C(paint, (crease ? .7 : lip ? 1.9 : 1.3) + L * .12 + day * .4);
  return set(i, crease ? '_' : lip ? '-' : ' ', C(paint, L * .5)), true;
}
