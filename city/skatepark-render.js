// ===== the skatepark drawn (skatepark.js builds it): steel flat bars on posts, granite ledges with steel coping, a
// concrete manual pad, and the park's smooth concrete with its saw-cut joints. Fine detail fades with distance
const SK_STEEL = (L, top) => C(GRAY, (top ? 4.2 : 2.6) + L * .35);
// a flat bar: the round bar along the top, square posts 30 cm in from each end, nothing in between
SOLID_SHADE.skaterail = o => (i, t, L) => {
  const w = HIT.w, bar = w > o.z1 - .005, post = Math.abs(Math.abs(HIT.u) - (o.hl - .03)) < .004;
  if (!bar && !post) return false; // (see-through under the bar)
  BG[i] = SK_STEEL(L, bar && HIT.face === 5); return set(i, ' ', 0), true;
};
// granite: a speckled pale grey block, darker low down where boards scuff it; steel coping along the top edges
SOLID_SHADE.skateledge = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .006 : o.z1 - HIT.w < .006;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const fine = coveDetail(t, .05), fleck = hash(Math.floor((o.x + HIT.u) * 160), Math.floor(HIT.w * 160 + HIT.v * 160), 2101) * fine;
  const scuff = !top && HIT.w < o.z1 * .45 ? .5 : 0;
  BG[i] = C(STONE, (top ? 4.2 : 3.2 - scuff) * shadeFace(f) + L * .25 + (fleck - .5) * .8); return set(i, ' ', 0), true;
};
// the manual pad: poured concrete, steel angle on its long edges, a joint across the middle
SOLID_SHADE.manualpad = o => (i, t, L) => {
  const f = HIT.face, top = f === 5, edge = top ? o.hw - Math.abs(HIT.v) < .005 : o.z1 - HIT.w < .005;
  if (edge) { BG[i] = SK_STEEL(L, top); return set(i, ' ', 0), true; }
  const joint = top ? coveGroove(HIT.u, o.hl, .004, t / projX) : 0;
  BG[i] = C(GRAY, (top ? 4.4 : 3) * shadeFace(f) * (1 - joint * .5) + L * .25); return set(i, ' ', 0), true;
};
// the park's concrete (floorBaseCell): smooth, pale, saw-cut every 3 m, a few dark scuffs and wax marks
function skateparkFloor(wx, wy, r, x, d) {
  const foot = d / projY, joint = Math.max(coveGroove(wx, .3, .004, foot), coveGroove(wy, .3, .004, foot));
  const scuff = noise(wx * 9, wy * 9, 2102) > .78 ? .8 : 1;
  return [' ', GRAY, (2.3 - joint * .7) * scuff];
}
