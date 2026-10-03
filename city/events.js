// ===== the calendar: which day of the week it is, and what's on. Days tick over at midnight (and when you sleep
// through one). Starting simple: every Saturday night, fireworks over the bay off the pleasure pier.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekday = () => WEEKDAYS[mod(dayNum, 7)];
// what's on: [weekday, from hour, to hour, what, a line for the newspaper and the gossip]
const EVENTS = [['Sat', 21, 24, 'fireworks', 'Fireworks over the bay, Saturday at 9']];
const eventNow = kind => EVENTS.some(([d, h0, h1, k]) => k === kind && d === weekday() && tod >= h0 && tod < h1);
const eventToday = kind => EVENTS.find(([d, , , k]) => k === kind && d === weekday()) || null;
let toldEvent = '';
function stepEvents(dt) {
  const fw = eventToday('fireworks'), key = dayNum + ':fw';
  if (fw && tod >= 20 && tod < 21 && toldEvent !== key + ':soon') { toldEvent = key + ':soon'; say('Fireworks over the bay at 9 tonight. Head down to the waterfront.', 5); }
  if (fw && tod >= 21 && tod < 21.1 && toldEvent !== key + ':go') { toldEvent = key + ':go'; say(weather === 'storm' ? 'The fireworks are off: too much wind.' : 'BOOM. The fireworks have started over the bay.', 4); }
  stepFireworks(dt);
}

// ---- the fireworks: shells launched from barges out in the bay south of the pier, a few a second, a finale at the end.
// Each climbs on a trail of sparks, bursts into a shell of stars that fall and fade. Drawn into the sky as points in
// the world (so buildings hide them and they're bigger close up), with a flash on the sky round each burst.
const FW_COLS = [RED, YEL, CYAN, MAG, GREEN, WHITE, ORANGE, BLUE];
const shells = [];
const fwBase = () => ({ x: FAIR.cx, y: FAIR.y1 + 18 }); // the barges
function stepFireworks(dt) {
  for (let k = shells.length - 1; k >= 0; k--) if (T - shells[k].t0 > shells[k].rise + 3.5) shells.splice(k, 1);
  if (!eventNow('fireworks') || weather === 'storm' || mode === 'room') return;
  const finale = tod > 23.6, rate = finale ? 6 : 1.4;
  if (Math.random() < dt * rate) {
    const b = fwBase(), kind = pick(['peony', 'peony', 'willow', 'ring', 'crackle']);
    shells.push({ x: b.x + (Math.random() - 0.5) * 30, y: b.y + (Math.random() - 0.5) * 8, h: 18 + Math.random() * 14, t0: T, rise: 1.6 + Math.random() * 0.8,
      col: pick(FW_COLS), col2: pick(FW_COLS), kind, n: kind === 'ring' ? 28 : 46, seed: Math.random() * 1e4, boomed: false });
  }
  for (const s of shells) if (!s.boomed && T - s.t0 > s.rise) { s.boomed = true; fwBoom(s); }
}
// where star k of shell s is, t seconds after the burst
function starAt(s, k, t) {
  const g = s.kind === 'willow' ? 3 : 1.6, sp = s.kind === 'willow' ? 3.2 : 4.5;
  let dxs, dys, dzs;
  if (s.kind === 'ring') { const th = k / s.n * TAU; dxs = Math.cos(th); dys = 0.3 * Math.sin(th); dzs = Math.sin(th); }
  else { // spread evenly over a sphere (a Fibonacci spiral)
    const zz = 1 - 2 * (k + 0.5) / s.n, rr = Math.sqrt(1 - zz * zz), th = k * 2.39996 + s.seed;
    dxs = rr * Math.cos(th); dys = rr * Math.sin(th); dzs = zz;
  }
  const d = sp * (1 - Math.exp(-t * 1.6)); // fast out, then hanging
  return [s.x + dxs * d, s.y + dys * d, s.h + dzs * d - g * t * t * 0.5];
}
function drawFireworks() {
  if (!shells.length) return;
  const put = (wx, wy, wz, ch, col, glow) => {
    const vx = rel(wx - px), vy = rel(wy - py), depth = dx * vx + dy * vy;
    if (depth < 1) return;
    const c = Math.round(cols / 2 + (-dy * vx + dx * vy) * projX / depth), r = Math.round(hor - (wz - eye) * projY / depth);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    const i = r * cols + c;
    if (ZB[i] < depth) return; // behind a building
    set(i, ch, col); FOGS[i] = 0;
    if (glow && ZB[i] === Infinity) { BG[i] = glow; FOGB[i] = 0; } // a glow on the sky behind it
  };
  for (const s of shells) {
    const t = T - s.t0;
    if (t < s.rise) { // climbing: a bright head, a trail of sparks behind it
      const f = t / s.rise, z = s.h * (1 - (1 - f) ** 2);
      put(s.x, s.y, z, '^', C(YEL, 15));
      for (let k = 1; k < 5; k++) put(s.x + Math.sin(k * 3 + s.seed) * 0.05, s.y, Math.max(0, z - k * 0.5), '.', C(ORANGE, 12 - k * 2));
      continue;
    }
    const bt = t - s.rise, life = s.kind === 'willow' ? 3.4 : 2.4;
    if (bt > life) continue;
    const fade = 1 - bt / life, ch = bt < 0.25 ? '@' : fade > 0.6 ? '*' : fade > 0.3 ? '+' : s.kind === 'willow' ? '|' : '.';
    if (bt < 0.15) put(s.x, s.y, s.h, '#', C(WHITE, 15), C(s.col, 4)); // the burst's flash
    for (let k = 0; k < s.n; k++) {
      if (s.kind === 'crackle' && bt > 1.2 && hash(k, Math.floor(T * 12), s.seed) > 0.5) continue; // crackling: twinkling on and off
      const [x, y, z] = starAt(s, k, bt);
      put(x, y, z, ch, C(k & 1 && s.col2 !== s.col ? s.col2 : s.col, 5 + fade * 10), bt < 0.5 && k % 12 === 0 ? C(s.col, 1 + fade * 3) : 0);
    }
  }
}
// the boom: as far off as it is, it arrives that much later (sound does 34 cells a second)
function fwBoom(s) {
  if (!actx) return;
  const dist = Math.hypot(rel(s.x - px), rel(s.y - py), s.h), at = actx.currentTime + dist / 34, loud = clamp(1.6 - dist / 120, 0.15, 1);
  burst(at, 1.4, [filt('lowpass', 180 + Math.random() * 60, 0.7)], 0.5 * loud);
  if (s.kind === 'crackle') for (let k = 0; k < 14; k++) burst(at + 1.2 + k * 0.07 + Math.random() * 0.05, 0.05, [filt('highpass', 2500, 1)], 0.08 * loud);
}
