// ===== neon on the street: after dark, an open shop's sign throws its colour onto the pavement in front of it, a soft
// pool fading over several metres, brighter where the ground is wet and brightest in a puddle (which mirrors the sign as
// well: city-render.js reflect). Only the ground near you, in front of the sign: the wall behind it and the shop
// next door stay their own colour. Apartment lobbies' plain white lettering throws none.

const NEON_SPILL_REACH = 0.8; // (cells: 8m out from the wall: the pavement and the near side of the road)

// The signs run the length of a shop's ground floor (city-render.js facade), so the light comes from the building
// itself: from a patch of ground, the nearest building face along each of the four street directions, if that
// building's shop is open and has a sign (not a shut one, not an apartment lobby's plain white lettering).
const NEON_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function neonFaceAt(x, y) {
  let best = 0, col = 0;
  for (const [ux, uy] of NEON_DIRS) for (let t = 0.04; t < NEON_SPILL_REACH; t += 0.08) {
    const cell = idx(Math.floor(x + ux * t), Math.floor(y + uy * t));
    if (!map[cell]) continue;
    const sh = SHOP[cell];
    if (sh && sh.kind !== SHOP_APTS && sh.kind !== SHOP_SHUT && openAt(sh, tod)) {
      const k = (1 - t / NEON_SPILL_REACH) ** 2;
      if (k > best) { best = k; col = sh.neon; }
    }
    break; // (the first building face that way; what's behind it can't shine through)
  }
  return [best, col];
}

// in the scene, after the puddles' reflections and before the fog (render.js)
function drawNeonSpill() {
  if (!settings.neonSpill || mode === 'room') return;
  const strength = clamp((night - 0.25) / 0.5, 0, 1) * (1 - 0.5 * clamp(fogAmt || 0, 0, 1)); // (from dusk; fog eats it)
  if (strength <= 0) return;
  const wetBoost = 1 + 0.8 * (wet || 0);
  for (let r = Math.max(0, hor + 1); r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, f = FL[i];
    if ((f !== 1 && f !== 2) || !(ZB[i] > 0.05 && ZB[i] < 6) || BG[i] === NONE) continue; // (the ground near you, and puddles in it)
    const [x, y] = cellPoint(i), [k, col] = neonFaceAt(x, y);
    if (k < 0.03) continue;
    // (soft: a tint, never a coat of paint; dithered so its edge fades rather than steps in the palette's eighths)
    const a = Math.min(0.5, k * strength * wetBoost * (f === 2 ? 0.45 : 0.28)) + (BAYER[(r & 3) * 4 + (c & 3)] / 16 - 0.47) * 0.1;
    if (a > 0.04) BG[i] = hazeTint(BG[i], C(col, 4 + 4 * k), a);
  }
}
