// ---- crime and the police. Pure (no DOM), so the node tests can run it; crime-ui.js draws it and asks what you do
// when they catch you.
//
// A crime only counts if somebody sees it. A cop who sees it (in their line of sight, within COP_SIGHT) puts you
// straight on the wanted list; a passer-by who sees it calls it in a few seconds later, and then only if there's a
// police unit within DISPATCH_R to send. Wanted is 1-3 stars: more stars, more units after you. They chase where
// they last saw you; stay out of every cop's sight for ESCAPE_T seconds and they give up. Caught: a fine, or jail.
//
// Police: patrol cars cruising in the traffic (cars with patrol: true; in pursuit they run lights and siren and steer
// for you), and officers on foot walking beats round the police stations (footCops), who chase you on foot.
const COP_SIGHT = 13, CIV_SIGHT = 8, DISPATCH_R = 45, REPORT_DELAY = 5;
const ESCAPE_T = [0, 25, 40, 60];            // seconds out of sight to lose them, by stars
const UNITS = [0, 2, 3, 5];                  // patrol cars after you, by stars
const FINE = [0, 60, 150, 300];              // what they'll take instead of a cell
const CRIMES = { steal: { stars: 1, name: 'car theft' }, hit: { stars: 2, name: 'hitting someone with a car' },
                 crash: { stars: 1, name: 'reckless driving' }, redlight: { stars: 1, name: 'running a red light' },
                 pickpocket: { stars: 1, name: 'pickpocketing' }, shoplift: { stars: 1, name: 'shoplifting' },
                 burglary: { stars: 2, name: 'breaking and entering' }, graffiti: { stars: 1, name: 'vandalism' },
                 alarm: { stars: 2, name: 'burglary' }, bankjob: { stars: 3, name: 'robbing a bank' } };
const wanted = { stars: 0, lastX: 0, lastY: 0, seen: false, hideT: 0, bustT: 0, busted: false, crime: '' };
const reports = []; // a passer-by on the phone: { t (when it comes in), x, y, kind }
const jammed = new Map(); // shop -> T until its lock can be tried again

// can you see (bx, by) from (ax, ay)? Nothing built in the way (cells taller than eye height block it)
function lineOfSight(ax, ay, bx, by) {
  const dx = rel(bx - ax), dy = rel(by - ay), n = Math.ceil(Math.hypot(dx, dy) * 3);
  for (let k = 1; k < n; k++) if (map[idx(Math.floor(ax + dx * k / n), Math.floor(ay + dy * k / n))] > 0.15) return false;
  return true;
}
const near = (ax, ay, bx, by) => Math.hypot(rel(ax - bx), rel(ay - by));
// where the police think you are: out on the street, or (indoors) the door you went in by
const crimePos = () => mode === 'room' && room && room.ret ? [room.ret[0], room.ret[1]] : [px, py];

// ---- the police on foot: three on the beat round each police station, corner to corner along the sidewalks. A
// corner is an intersection (ix, iy) and which of its four corners (qx, qy).
const footCops = [];
const cornerXY = c => [c.ix * 8 + (c.qx ? 1.88 : 0.12), c.iy * 8 + (c.qy ? 1.88 : 0.12)];
function stepCorner(c, dir) { // the corner one step along the sidewalk in dir (0 E, 1 S, 2 W, 3 N), or null if there's no sidewalk
  let { ix, iy, qx, qy } = c;
  if (dir === 0) { if (!qx) qx = 1; else { if (!hseg(ix, iy)) return null; ix++; qx = 0; } }
  else if (dir === 2) { if (qx) qx = 0; else { if (!hseg(ix - 1, iy)) return null; ix--; qx = 1; } }
  else if (dir === 1) { if (!qy) qy = 1; else { if (!vseg(ix, iy)) return null; iy++; qy = 0; } }
  else { if (qy) qy = 0; else { if (!vseg(ix, iy - 1)) return null; iy--; qy = 1; } }
  return degree(ix & (NB - 1), iy & (NB - 1)) ? { ix, iy, qx, qy } : null;
}
for (const b of SERVICES) if (b.kind === 'police') for (let k = 0; k < 3; k++) {
  const corner = { ix: b.bx + (k === 1 ? 1 : 0), iy: b.by, qx: k & 1, qy: 1 };
  const [x, y] = cornerXY(corner);
  footCops.push({ x, y, corner, dir: k % 2 ? 2 : 0, goal: null, chase: false, ph: Math.random() * 9, base: b });
}
function patrolStep(c, dt) { // walk to the next corner; there, carry on or turn (never straight back)
  if (!c.goal) {
    const opts = [0, 1, 2, 3].filter(d => d !== (c.dir + 2) % 4).map(d => [d, stepCorner(c.corner, d)]).filter(o => o[1]);
    const [d, next] = opts.length ? pick(opts) : [(c.dir + 2) % 4, stepCorner(c.corner, (c.dir + 2) % 4)];
    if (!next) return;
    c.dir = d; c.goal = next;
  }
  const [gx, gy] = cornerXY(c.goal), dx = rel(gx - c.x), dy = rel(gy - c.y), d = Math.hypot(dx, dy), s = 0.42 * dt;
  if (d <= s) { c.x = mod(gx, N); c.y = mod(gy, N); c.corner = c.goal; c.goal = null; }
  else { c.x = mod(c.x + dx / d * s, N); c.y = mod(c.y + dy / d * s, N); c.ph += dt * 4; }
}
function chaseStep(c, tx, ty, dt) { // run straight for (tx, ty), sliding along walls
  const dx = rel(tx - c.x), dy = rel(ty - c.y), d = Math.hypot(dx, dy) || 1, s = 0.78 * dt;
  const nx = c.x + dx / d * s, ny = c.y + dy / d * s;
  if (!map[idx(Math.floor(nx), Math.floor(c.y))]) c.x = mod(nx, N);
  if (!map[idx(Math.floor(c.x), Math.floor(ny))]) c.y = mod(ny, N);
  c.ph += dt * 7;
}
function backToBeat(c) { // the chase is off: pick up the beat from the nearest corner
  const ix = Math.round((c.x - 1) / 8), iy = Math.round((c.y - 1) / 8);
  c.corner = { ix, iy, qx: mod(c.x, 8) > 1 ? 1 : 0, qy: mod(c.y, 8) > 1 ? 1 : 0 }; c.goal = c.corner; c.chase = false;
}

// ---- the patrol cars: a couple of dozen of the city's cars are police, cruising like the rest
const PATROLS = 24;
for (let n = 0; n < PATROLS; n++) {
  const c = cars.find(o => !o.patrol && !o.ev && o.body !== TAXI && Math.random() < 0.1);
  if (c) Object.assign(c, { kind: 'police', body: BLUE, patrol: true });
}

// ---- a crime, here and now: who saw it, and what follows
// returns 'cop' (wanted now), 'reported' (somebody will call it in), or '' (nobody saw)
// can any cop, in a car or on foot, see (x, y)?
const copSees = (x, y) => cars.some(c => c.patrol && !c.player && near(c.x, c.y, x, y) < COP_SIGHT && lineOfSight(c.x, c.y, x, y))
  || footCops.some(c => near(c.x, c.y, x, y) < COP_SIGHT && lineOfSight(c.x, c.y, x, y));
function crime(kind, x = crimePos()[0], y = crimePos()[1]) {
  const copSees_ = copSees(x, y);
  if (copSees_) { addWanted(kind, x, y, true); return 'cop'; }
  const civSees = people.some(p => !p.hidden && near(p.x, p.y, x, y) < CIV_SIGHT && lineOfSight(p.x, p.y, x, y)) || kind === 'steal' || kind === 'shoplift';
  if (civSees) { reports.push({ t: T + REPORT_DELAY, x, y, kind }); return 'reported'; } // (a carjacked driver, or a clerk, always calls it in)
  return '';
}
// a red light only counts with a cop right there
function redLightCrime(x, y) {
  const cop = cars.some(c => c.patrol && !c.player && near(c.x, c.y, x, y) < 2.5) || footCops.some(c => near(c.x, c.y, x, y) < 2.5);
  if (cop) addWanted('redlight', x, y, true);
  return cop;
}
function addWanted(kind, x, y, seen) {
  wanted.stars = Math.min(3, Math.max(wanted.stars, 0) + CRIMES[kind].stars);
  wanted.crime = CRIMES[kind].name; wanted.lastX = x; wanted.lastY = y; wanted.hideT = 0; wanted.seen = seen;
  callUnits();
}
// enough patrol cars on the case for the stars: the nearest free ones first, then more from a few blocks off
function callUnits() {
  const on = cars.filter(c => c.pursuit).length, need = UNITS[wanted.stars] - on;
  const free = cars.filter(c => c.patrol && !c.pursuit && !c.player).sort((a_, b) => near(a_.x, a_.y, wanted.lastX, wanted.lastY) - near(b.x, b.y, wanted.lastX, wanted.lastY));
  for (let k = 0; k < need; k++) {
    let c = free[k];
    if (!c || near(c.x, c.y, wanted.lastX, wanted.lastY) > DISPATCH_R) { // nobody close: one drives in
      const p = randomLane(30, wanted.lastX, wanted.lastY);
      c = addCar({ ...p, kind: 'police', body: BLUE, patrol: true, extra: true });
    }
    Object.assign(c, { pursuit: true, cruise: 2.5, dest: [wanted.lastX, wanted.lastY] }); // (faster than you drive, unless you floor it)
  }
}
function clearWanted() {
  wanted.stars = 0; wanted.seen = false; wanted.hideT = 0; wanted.bustT = 0; wanted.busted = false;
  for (const c of cars) if (c.pursuit) { c.pursuit = false; c.dest = null; c.cruise = 1 + Math.random() * 0.5; c.dropped = false; }
  for (const c of footCops) if (c.chase) backToBeat(c);
  reports.length = 0;
}
// is a cop near enough a police unit to be sent to (x, y)?
const policeNear = (x, y) => cars.some(c => c.patrol && near(c.x, c.y, x, y) < DISPATCH_R) || footCops.some(c => near(c.x, c.y, x, y) < DISPATCH_R);

// ---- every frame
function stepCrime(dt) {
  for (let k = reports.length - 1; k >= 0; k--) { // calls coming in
    const r = reports[k];
    if (T < r.t) continue;
    reports.splice(k, 1);
    if (policeNear(r.x, r.y)) addWanted(r.kind, r.x, r.y, false); // they come to where it happened
  }
  for (const c of footCops) if (!c.chase) patrolStep(c, dt);
  // a cab you've paid to step on it, seen by a cop: pulled over, and the driver's arrested
  if (mode === 'taxi' && me && me.rush && Math.abs(me.v) > 1.5 && copSees(me.x, me.y)) return 'cab';
  if (!wanted.stars) return;
  const [wx, wy] = crimePos(), inside = mode === 'room';
  const sees = c => !inside && near(c.x, c.y, wx, wy) < COP_SIGHT && lineOfSight(c.x, c.y, wx, wy);
  wanted.seen = cars.some(c => c.pursuit && sees(c)) || footCops.some(sees);
  if (wanted.seen) { wanted.lastX = wx; wanted.lastY = wy; wanted.hideT = 0; wanted.tipT = 0; }
  else if ((wanted.hideT += dt) > ESCAPE_T[wanted.stars]) { clearWanted(); return 'lost'; }
  else if (wanted.hideT < ESCAPE_T[wanted.stars] * 0.75 && (wanted.tipT = (wanted.tipT || 0) - dt) <= 0) { // a tip on the radio: roughly where you are
    const off = inside ? 0 : 3; // (ducked into a building: somebody saw which door)
    wanted.tipT = 4; wanted.lastX = mod(wx + (Math.random() - 0.5) * off, N); wanted.lastY = mod(wy + (Math.random() - 0.5) * off, N);
  }
  for (const c of cars) if (c.pursuit) c.dest = [wanted.lastX, wanted.lastY]; // steering for you, or where you were
  const onFoot = mode === 'walk';
  for (const c of footCops) { // officers within a few blocks join the chase on foot
    if (!c.chase && near(c.x, c.y, wanted.lastX, wanted.lastY) < 20) c.chase = true;
    if (c.chase) chaseStep(c, wanted.lastX, wanted.lastY, dt);
  }
  if (onFoot || inside) for (const c of cars) if (c.pursuit && !c.dropped && near(c.x, c.y, wx, wy) < 1.4) { // pulls up, an officer jumps out
    c.dropped = true;
    footCops.push({ x: c.x, y: c.y, corner: null, dir: 0, goal: null, chase: true, ph: 0, extra: true });
  }
  // in a car with a cruiser on your bumper: told to pull over, and if you don't, a PIT manoeuvre spins you out
  let told = false;
  if (mode === 'drive' && me) {
    const tail = cars.some(c => c.pursuit && c !== me && near(c.x, c.y, me.x, me.y) < 1.3);
    wanted.tailT = tail ? (wanted.tailT || 0) + dt : Math.max(0, (wanted.tailT || 0) - dt * 0.5);
    if (tail && T > (wanted.toldT || 0)) { wanted.toldT = T + 8; told = true; }
    if (wanted.tailT > 4 && Math.abs(me.v) > 0.5) { wanted.tailT = 0; me.spunT = T + 2.5; return 'pit'; }
  }
  // caught: a hand on your shoulder, or boxed in and stopped
  const grabbed = onFoot && footCops.some(c => c.chase && near(c.x, c.y, px, py) < 0.22)
    || inside && footCops.some(c => c.chase && near(c.x, c.y, wx, wy) < 0.35); // inside: they come in through the door after you
  const boxed = me && Math.abs(me.v) < 0.3 && (cars.some(c => c.pursuit && c !== me && near(c.x, c.y, me.x, me.y) < 1.4) || footCops.some(c => c.chase && near(c.x, c.y, me.x, me.y) < 0.5));
  wanted.bustT = boxed ? wanted.bustT + dt : 0;
  if (grabbed || wanted.bustT > 2.5) { wanted.busted = true; return 'busted'; }
  return told ? 'pullover' : wanted.seen ? 'seen' : 'hiding';
}
// after the chase, extra units go home (out of sight) and officers who jumped out of cars walk off
function tidyPolice() {
  for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.extra && !c.pursuit && near(c.x, c.y, px, py) > 30) cars.splice(k, 1); }
  for (let k = footCops.length - 1; k >= 0; k--) { const c = footCops[k]; if (c.extra && !c.chase && near(c.x, c.y, px, py) > 25) footCops.splice(k, 1); }
}
// what being caught costs. Paying it settles everything, and the car goes back
const fineFor = stars => FINE[stars];
function payFine() {
  const f = fineFor(wanted.stars);
  if (!pay(f)) return false;
  clearWanted(); return true;
}
// jail: everything you're carrying is taken (not your money), and you do your time
const JAIL_T = 60;
function goToJail() {
  inv.length = 0; held = -1; fx.skating = false; fx.boombox = false;
  clearWanted();
}
