// ===== the taxi job: J at an idle taxi and you drive it yourself. Now and then someone on the sidewalk nearby flags
// you down (marked on the map, and with a ! over their head); pull up beside them and stop to pick them up, drive
// them where they're going (the dash says which way and how far, the map marks it), and stop there to let them out.
// Each trip pays the meter plus a tip for getting there quickly and smoothly (taxiPay); hit anything on the way and
// there's no tip. E (stopped) ends the shift.
const DROP_R = 2, STOP_V = 5 / 36; // drop-off: within 20m, rolling at 5 km/h or less (1 unit/s = 36 km/h)
let job = null; // { trips, earned, next: seconds till someone hails, hail: the person waving, ride: the trip under way }

function startTaxiShift(c) {
  me = c; mode = 'drive'; c.player = true; c.v = 0; c.hail = false; a = Math.atan2(c.hy, c.hx); px = c.x; py = c.y;
  job = { trips: 0, earned: 0, next: 3, hail: null, ride: null };
  say('You take the taxi out, light on. Watch for people waving you down.', 4);
}
function endTaxiShift() { // leaving the car
  if (!job) return;
  if (job.ride) { dropOff(job.ride.p); say('Your fare climbs out mid-trip, unimpressed. No pay for that one.', 4); }
  else say(`Shift over: ${job.trips} trip${job.trips === 1 ? '' : 's'}, ${fmt$(job.earned)}.`, 4);
  if (job.hail) { job.hail.hailing = false; job.hail.talk = 0; }
  job = null;
}
// somewhere on a street 12-40 cells away, for a trip
function tripDest(c) {
  for (let k = 0; k < 300; k++) {
    const bx = (Math.floor(c.x / 8) + (Math.random() * 11 | 0) - 5) & (NB - 1), by = clamp(Math.floor(c.y / 8) + (Math.random() * 11 | 0) - 5, 1, SHORE_S - 1);
    const p = vseg(bx, by) ? [bx * 8 + 1, by * 8 + 5] : hseg(bx, by) ? [bx * 8 + 5, by * 8 + 1] : null;
    const d = p && Math.hypot(rel(p[0] - c.x), rel(p[1] - c.y));
    if (p && d > 12 && d < 40) return p;
  }
  return [mod(c.x + 16, N), c.y];
}
function pickUp(p) {
  p.hailing = false; p.hidden = true; p.talk = 1e9; // in the back seat: stepPeople leaves them be
  const dest = tripDest(me), route = Math.abs(rel(dest[0] - me.x)) + Math.abs(rel(dest[1] - me.y)); // blocks, not as the crow flies
  job.ride = { p, dest, route, took: 0, odo: 0, harsh: 0, crashed: false, v0: me.v, name: streetName(dest[0], dest[1]) || 'just up here' };
  job.hail = null;
  say(`"${job.ride.name}, please."`, 4);
}
function dropOff(p) { // out onto the sidewalk on the passenger side, and off they walk
  const [x, y] = curbOf(me);
  Object.assign(p, { x, y, hidden: false, inside: null, path: [], wait: 0, talk: 0, hailing: false });
  snapToCorner(p);
}
function taxiCrash() {
  if (job && job.ride && !job.ride.crashed) { job.ride.crashed = true; say('Your fare yelps. There goes the tip.', 3); }
}
function stepTaxiJob(dt) {
  if (!job || mode !== 'drive' || !me) return;
  const c = me;
  if (job.ride) {
    const r = job.ride, acc = (c.v - r.v0) / Math.max(dt, 1e-3);
    r.v0 = c.v; r.took += dt; r.odo += Math.abs(c.v) * dt; r.p.x = c.x; r.p.y = c.y;
    const swerve = (K.KeyA || K.KeyD || K.ArrowLeft || K.ArrowRight) && Math.abs(c.v) > 1.9;
    if (Math.abs(acc) > 1.6 || swerve) r.harsh += dt; // slamming the brakes, flooring it, flinging it round corners
    if (Math.hypot(rel(r.dest[0] - c.x), rel(r.dest[1] - c.y)) < DROP_R && Math.abs(c.v) < STOP_V) { // pulled up near enough
      const p = taxiPay(r.odo, r.took, r.harsh, r.crashed, r.route), paid = Math.round((p.fare + p.tip) * 100) / 100;
      earn(paid); job.trips++; job.earned += paid;
      dropOff(r.p); job.ride = null; job.next = 4 + Math.random() * 8;
      say(`${'*'.repeat(p.stars)}${'.'.repeat(5 - p.stars)}  Fare ${fmt$(p.fare)}${p.tip ? `, tip ${fmt$(p.tip)}` : r.crashed ? ', no tip: you hit something' : ', no tip'}.`, 5);
    }
    return;
  }
  if (job.hail) {
    const p = job.hail, d = Math.hypot(rel(p.x - c.x), rel(p.y - c.y));
    if (p.hidden || d > 45) { p.hailing = false; p.talk = 0; job.hail = null; job.next = 3; return; } // gave up on you
    p.talk = 5; // still standing there waving
    if (d < 1.2 && Math.abs(c.v) < STOP_V) pickUp(p);
    return;
  }
  if ((job.next -= dt) > 0) return;
  const near = people.filter(p => { if (p.hidden || p.follow || p.talk > 0) return false; const d = Math.hypot(rel(p.x - c.x), rel(p.y - c.y)); return d > 4 && d < 16; });
  if (!near.length) { job.next = 2; return; }
  job.hail = pick(near); job.hail.hailing = true; job.hail.talk = 5;
  say("Someone's waving you down. (on the map)", 3);
}
// where to go next, for the dash and the map
const jobTarget = () => job && (job.ride ? { x: job.ride.dest[0], y: job.ride.dest[1], what: `to ${job.ride.name}` } : job.hail ? { x: job.hail.x, y: job.hail.y, what: 'pick up' } : null);
function jobLine() {
  const t = jobTarget();
  if (!t) return 'Cruising for fares...';
  const ex = rel(t.x - me.x), ey = rel(t.y - me.y), d = Math.hypot(ex, ey) * 10;
  const ang = mod(Math.atan2(ey, ex) - Math.atan2(me.hy, me.hx) + Math.PI, Math.PI * 2) - Math.PI; // + = to the right
  const way = Math.abs(ang) < 0.4 ? 'ahead' : Math.abs(ang) > 2.7 ? 'behind you' : (Math.abs(ang) < 1.2 ? 'ahead, ' : Math.abs(ang) > 1.9 ? 'behind, ' : '') + (ang > 0 ? 'right' : 'left');
  return `${t.what}: ${d < DROP_R * 10 ? 'right here, stop' : `${Math.round(d / 10) * 10}m ${way}`}`;
}
// the arrow at the top of the screen, in characters: a shaft and a two-stroke head drawn at whatever angle the fare
// (or their stop) is from where the car's pointing, how far, and what to do there. Close enough: a blinking [ STOP ].
function jobArrow(t=jobTarget(),courier=null) {
  if (!t || !courier&&!me) return;
  const ex = rel(t.x - (courier?px:me.x)), ey = rel(t.y - (courier?py:me.y)), d = Math.hypot(ex, ey),radius=courier?courier.radius:DROP_R;
  const ang = mod(Math.atan2(ey, ex) - (chaseOn ? camYaw : a) + Math.PI, Math.PI * 2) - Math.PI; // 0 = dead ahead, + = right
  const u = Math.max(14, cv.height / 36), s = Math.round(u * 0.95), x = cv.width / 2, y = 70 + s * 3.2; // below the message line
  g.font = s + 'px monospace';
  const w = g.measureText('M').width, col = PAL[C(YEL, 15)];
  if (d < radius) {
    const stop=`[ ${courier?courier.stop:'STOP'} ]`;
    if (fract(T * 2) < 0.7) artText([stop], x - stop.length*w/2, y - s / 2, s, () => C(YEL, 15));
  } else {
    const L = s * 2.6, ux = Math.sin(ang), uy = -Math.cos(ang), tip = [x + ux * L, y + uy * L];
    charLine(x - ux * L, y - uy * L, tip[0], tip[1], w, s, col); // the shaft
    for (const side of [-1, 1]) { // the head: two strokes back from the tip
      const h = ang + Math.PI + side * 0.55;
      charLine(tip[0], tip[1], tip[0] + Math.sin(h) * L * 0.5, tip[1] - Math.cos(h) * L * 0.5, w, s, col);
    }
  }
  const label = courier?`${courier.label}  ${Math.round(d*10)}m`:d < DROP_R ? (job.ride ? 'let them out' : 'pick them up') : `${job.ride ? 'DROP OFF' : 'PICK UP'}  ${Math.round(d) * 10}m`;
  g.font = FS + 'px monospace';
  const lw = g.measureText(label).width;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - lw / 2 - 6, y + s * 3.1, lw + 12, FS + 6);
  g.fillStyle = col; g.fillText(label, x - lw / 2, y + s * 3.1 + 3);
}
