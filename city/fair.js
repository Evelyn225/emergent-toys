// ===== the Sunset Pier (world.js lays it out, props.js puts up the booths, city-sprites.js draws the rides):
// riding the Ferris wheel and the carousel, and what E does at the booths. The rides run 9am till 2am.
const WHEEL_FARE = 5, CAROUSEL_FARE = 3;
const fairOpen = () => tod >= 9 || tod < 2;
let fairRide = null, fairEye = 0.17; // {kind: 'wheel' | 'carousel', end, ...} while you're on one; your eye height
const onFair = (x, y) => mod(x - FAIR.x0, N) < FAIR.x1 - FAIR.x0 && mod(y - FAIR.y0, N) < FAIR.y1 - FAIR.y0;
// what's within reach on the pier: a booth's counter, the wheel's platform, the carousel's rail
function fairSpot() {
  if (mode !== 'walk' || !onFair(px, py)) return null;
  const near = (x, y, r) => Math.hypot(rel(x - px), rel(y - py)) < r;
  const b = BOOTHS.find(o => near(o.at[0], o.at[1], 0.3));
  if (b) return { kind: 'booth', b };
  if (near(WHEEL_BOARD.x, WHEEL_BOARD.y, 0.35)) return { kind: 'wheel' };
  if (near(CAROUSEL.x, CAROUSEL.y, CAROUSEL.r + 0.3)) return { kind: 'carousel' };
  return null;
}
function fairPrompt(sp) {
  if (sp.kind === 'booth') {
    const b = sp.b;
    if (!fairOpen()) return `${b.word}: shuttered till morning`;
    return b.game ? `E: play ${GAMES[b.game]().title} (${fmt$(CREDIT)} a go)` : b.prizes ? `E: prize stall (${tickets} tickets)` : 'E: buy fair food';
  }
  const name = sp.kind === 'wheel' ? 'Ferris wheel' : 'carousel';
  if (!fairOpen()) return `The ${name}'s shut for the night. It opens at 9.`;
  return `E: ride the ${name} (${fmt$(sp.kind === 'wheel' ? WHEEL_FARE : CAROUSEL_FARE)})`;
}
function useFair(sp) {
  if (!fairOpen()) return say(sp.kind === 'booth' ? 'Shuttered. Come back in the morning.' : 'Chained up for the night. The rides start again at 9.', 2);
  if (sp.kind === 'booth') {
    const b = sp.b;
    if (b.game) return pay(CREDIT) ? startGame(b.game, 'arcade') : say(`It's ${fmt$(CREDIT)} a go.`);
    if (b.prizes) return openPrizes();
    return openShop(b.word, stockFor('', b.word));
  }
  const fare = sp.kind === 'wheel' ? WHEEL_FARE : CAROUSEL_FARE;
  if (!pay(fare)) return say(`The ride's ${fmt$(fare)}. You're short.`);
  if (sp.kind === 'wheel') { // into the car that's at the bottom, round once until it's back there
    let k = 0, bd = Infinity;
    for (let j = 0; j < WHEEL.n; j++) { const d = Math.abs(mod(wheelAngle(j, T) + Math.PI / 2 + Math.PI, TAU) - Math.PI); if (d < bd) { bd = d; k = j; } }
    const left = mod(-Math.PI / 2 - wheelAngle(k, T), TAU) / TAU * WHEEL.rev;
    fairRide = { kind: 'wheel', k, end: T + (left < WHEEL.rev / 2 ? left + WHEEL.rev : left) };
    a = -Math.PI / 2; pitch = 0; // facing the city
    say('The bar clicks shut and up you go.', 3);
  } else { // onto the nearest horse, three times round
    fairRide = { kind: 'carousel', ps0: Math.atan2(rel(py - CAROUSEL.y), rel(px - CAROUSEL.x)), t0: T, end: T + CAROUSEL.rev * 3 };
    look = 0; pitch = 0;
    say(pick(['You climb onto a painted horse called Buttercup.', 'You get the one with the gold mane.', 'The organ wheezes into a waltz.']), 3);
  }
  mode = 'fair';
  stepFair(0);
}
function stepFair(dt) {
  const f = fairRide, turn = ((K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0)) * 2 * dt;
  if (f.kind === 'wheel') {
    const ph = wheelAngle(f.k, T);
    px = WHEEL.x + WHEEL.R * Math.cos(ph); py = WHEEL.y - 0.12; fairEye = WHEEL.hub + WHEEL.R * Math.sin(ph) - 0.12;
    a += turn;
  } else {
    const ps = f.ps0 + TAU * (T - f.t0) / CAROUSEL.rev;
    px = CAROUSEL.x + 0.38 * Math.cos(ps); py = CAROUSEL.y + 0.38 * Math.sin(ps); fairEye = 0.155 + 0.012 * Math.sin(T * 4);
    a = ps + Math.PI; look = 0; // facing the middle the whole way round (the horses and the drum stay put; the world wheels past behind them)
  }
  if (T >= f.end) endFairRide();
}
function endFairRide() {
  const f = fairRide;
  fairRide = null; mode = 'walk'; fairEye = 0.17; look = 0;
  if (f.kind === 'wheel') { px = WHEEL_BOARD.x; py = WHEEL_BOARD.y - 0.1; a = -Math.PI / 2; say('Round and back down. Your ears pop.', 3); }
  else {
    const ps = Math.atan2(rel(py - CAROUSEL.y), rel(px - CAROUSEL.x));
    px = CAROUSEL.x + (CAROUSEL.r + 0.15) * Math.cos(ps); py = CAROUSEL.y + (CAROUSEL.r + 0.15) * Math.sin(ps); a = ps;
    say('The music winds down. You climb off, a little dizzy.', 3);
  }
}
function fairRidePrompt() {
  const left = Math.ceil(fairRide.end - T), look_ = TOUCH ? 'drag' : 'mouse';
  if (fairRide.kind === 'carousel') return `Round and round: ${left}s`;
  return fairEye > WHEEL.hub + WHEEL.R * 0.8 ? `The top. The whole city. (${left}s)` : `Going round: ${left}s   ${look_}: look about`;
}
// what's round you on a ride: the car you're sitting in, or the pole and the horse's neck
function fairFrame() {
  if (fairRide.kind === 'wheel') {
    const col = [RED, YEL, CYAN, MAG, GREEN, ORANGE][fairRide.k % 6];
    for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
      const i = r * cols + x, top = r < 2, bot = r >= rows - 4, post = x < 2 || x >= cols - 2;
      if (!top && !bot && !post) continue;
      FOGS[i] = FOGB[i] = 0; BG[i] = C(col, top || bot ? 2 : 3);
      set(i, top ? (r === 1 ? '_' : ' ') : bot ? (r === rows - 4 ? '=' : r === rows - 3 ? '-' : ' ') : '|', C(col, 8));
    }
    return;
  }
  const mid = cols >> 1;
  for (let r = 0; r < rows - 3; r++) { const i = r * cols + mid; FOGS[i] = FOGB[i] = 0; set(i, (r + Math.floor(T * 6)) % 4 ? '|' : '/', C(YEL, 14)); BG[i] = C(YEL, 3); }
  ['   ,/\\_/\\,', '  (  o    >', "  /`---.__/", " /  ~~~~ \\"].forEach((l, k) => putText(rows - 4 + k, mid - 6, l, C(WHITE, 13)));
}
