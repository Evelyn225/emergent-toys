// ---- doors: every shop, lobby and front door, as a point on the sidewalk outside it.
// {x, y: on the walking line (0.12 / 1.88 into a street), nx, ny: one step inside, sh: the shop, use: what it's for}
const NIGHTLIFE = new Set(['BAR', 'KARAOKE', 'MAHJONG', 'ARCADE', 'LIQUOR']);
const doors = [];
{
  const seen = new Set();
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    if (blockKind(bx, by)) continue;
    const dist = districtOf(bx, by);
    for (let ly = 2; ly < 8; ly++) for (let lx = 2; lx < 8; lx++) {
      const sh = SHOP[idx(bx * 8 + lx, by * 8 + ly)];
      if (!sh || seen.has(sh) || sh.kind === SHOP_SHUT) continue;
      const X = bx * 8 + lx + 0.5, Y = by * 8 + ly + 0.5;
      const face = ly === 2 && hseg(bx, by) ? [X, by * 8 + 1.88, 0, 1] : ly === 7 && hseg(bx, by + 1) ? [X, by * 8 + 8.12, 0, -1]
                 : lx === 2 && vseg(bx, by) ? [bx * 8 + 1.88, Y, 1, 0] : lx === 7 && vseg(bx + 1, by) ? [bx * 8 + 8.12, Y, -1, 0] : null;
      if (!face) continue;
      seen.add(sh);
      // half of downtown's lobbies are offices; everywhere else a numbered door is somebody's home
      const use = sh.kind === SHOP_APTS ? (dist === 'downtown' && fract(sh.word.length * 0.37 + bx * 0.13 + by * 0.71) < 0.5 ? 'work' : 'home')
                : NIGHTLIFE.has(sh.word) ? 'bar' : 'shop';
      doors.push({ x: mod(face[0], N), y: mod(face[1], N), nx: face[2] * 0.1, ny: face[3] * 0.1, sh, use, dist });
    }
  }
}
const doorsB = bucketed(doors);
// nearest door within r blocks that passes `ok`
function nearestDoor(x, y, ok, r = 2) {
  const cx = Math.floor(x / 8), cy = Math.floor(y / 8);
  let best = null, bd = Infinity;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) for (const d of doorsB[bi(cx + i, cy + j)]) {
    const dd = Math.hypot(rel(d.x - x), rel(d.y - y));
    if (dd < bd && ok(d)) { bd = dd; best = d; }
  }
  return best;
}
// a pub is a better night out than a liquor store
const barOK = t => d => d.use === 'bar' && d.sh.word !== 'LIQUOR' && openAt(d.sh, t);
// which doors suit each part of the routine
const USES = { home: d => d.use === 'home', lobby: d => d.use === 'home' || d.use === 'work' && d.sh.kind === SHOP_APTS, work: d => d.use === 'work' || d.use === 'shop' && openAt(d.sh, tod),
               bar: d => barOK(tod)(d), shop: d => d.use === 'shop' && openAt(d.sh, tod) };

// ---- routines: what someone wants to be doing at game hour t. `jit` staggers people by up to an hour or so.
// worker: home, work 7-17, a drink or errands, an evening stroll, home. owl: bars till 3:30, sleeps till noon, out
// again at night. errands: shops in the morning and afternoon. dogwalker: walks the dog first thing, at lunch and before
// dinner (only in daylight hours), errands in between. Everyone's in by 4am bar a few stragglers.
function activity(p, t) {
  const h = mod(t - p.jit, 24);
  if (p.role === 'worker') return h < 7 ? 'home' : h < 17 ? 'work' : h < 19.5 ? (p.social ? 'bar' : 'shop') : h < 21.5 ? 'wander' : 'home';
  if (p.role === 'dogwalker') return h < 7.5 ? 'home' : h < 9 ? 'wander' : h < 12 ? 'shop' : h < 12.5 ? 'home' : h < 14 ? 'wander' : h < 17 ? 'shop' : h < 19.5 ? 'wander' : 'home';
  if (p.role === 'owl') return h < 3.5 ? 'bar' : h < 12 ? 'home' : h < 17 ? 'wander' : h < 19 ? 'shop' : 'bar';
  return h < 8 ? 'home' : h < 12 ? 'shop' : h < 15 ? 'wander' : h < 18.5 ? 'shop' : h < 21 ? 'wander' : 'home';
}
// where that activity happens: their own home / workplace, or the nearest open bar / shop
function placeFor(p, act, t) {
  if (act === 'home') { // a walk home across town would take all night: one nearby will do (see planPerson)
    if (Math.hypot(rel(p.home.x - p.x), rel(p.home.y - p.y)) > 16) p.home = nearestDoor(p.x, p.y, USES.home, 2) || p.home;
    return p.home;
  }
  if (act === 'work') return p.work;
  if (act === 'bar') return nearestDoor(p.x, p.y, barOK(t));
  if (act === 'shop') return nearestDoor(p.x, p.y, d => d.use === 'shop' && openAt(d.sh, t) && Math.random() < 0.5)
                          || nearestDoor(p.x, p.y, d => d.use === 'shop' && openAt(d.sh, t));
  return null;
}

// ---- pedestrians: walk a graph of sidewalk corners (offsets 0.12 / 1.88 from each street base) toward wherever their
// routine sends them. Short legs (1.76) cross a street and wait for the walk signal; long legs (6.24) run along a block,
// going in at their door when they pass it, or detouring through a park (bench rest) when they're just out walking.
const people = [];
// where people live: brownstones have the most front doors, but everywhere has residents
const HOME_WEIGHT = { brownstones: 3, midtown: 3, chinatown: 2, downtown: 1.5, industrial: 0.5 };
const homesIn = {}, jobs = doors.filter(d => d.use === 'work' || d.use === 'shop');
for (const d of doors) if (d.use === 'home') (homesIn[d.dist] || (homesIn[d.dist] = [])).push(d);
function pickHome() {
  const ds = Object.keys(homesIn), w = ds.map(d => HOME_WEIGHT[d] || 1);
  let r = Math.random() * w.reduce((s, v) => s + v), k = 0;
  while ((r -= w[k]) > 0) k++;
  return pick(homesIn[ds[k]]);
}
function spawnPerson() {
  const home = pickHome();
  const work = nearestDoor(home.x + (Math.random() - 0.5) * 24, home.y + (Math.random() - 0.5) * 24, d => d.use === 'work' || d.use === 'shop', 2) || pick(jobs);
  const r = Math.random(), role = r < 0.5 ? 'worker' : r < 0.72 ? 'owl' : r < 0.93 ? 'errands' : 'dogwalker';
  const p = { x: home.x, y: home.y, path: [], last: [0, 0], wait: 0, hidden: false, sp: 0.1 + Math.random() * 0.06, legs: 0,
              shirt: pick([RED, BLUE, GREEN, MAG, ORANGE, WHITE, YEL]), pants: pick([BLUE, GRAY]), ph: Math.random() * 9,
              home, work, role, social: Math.random() < 0.6, jit: Math.random() * 1.5 - 0.5, act: '', goal: null };
  people.push(p);
  // start the day where the routine has them: indoors somewhere, or out on the street near home
  const act = activity(p, tod), place = placeFor(p, act, tod);
  if (place) { p.x = place.x; p.y = place.y; p.act = act; p.inside = place; p.hidden = true; p.wait = Math.random() * 20; }
  else { p.act = act; p.x = home.x; p.y = home.y; }
  snapToCorner(p);
}
// start walking from wherever they are on a sidewalk line to the corner ahead
function snapToCorner(p) {
  const lx = mod(p.x, 8), ly = mod(p.y, 8), alongX = Math.abs(ly - 1.88) < 0.01 || Math.abs(ly - 0.12) < 0.01 || Math.abs(ly - 8.12) < 0.01;
  if (alongX && !(lx < 2)) { const dir = pick([-1, 1]); p.path = [{ x: p.x - lx + (dir > 0 ? 8.12 : 1.88), y: p.y }]; p.last = [dir, 0]; }
  else { const dir = pick([-1, 1]); p.path = [{ x: p.x, y: p.y - ly + (dir > 0 ? 8.12 : 1.88) }]; p.last = [0, dir]; }
}
for (let n = 0; n < 1100; n++) spawnPerson();
// a dog walker's dog is out with them while they're walking it, in daylight: on its lead a step behind and to one side,
// stopping to sniff now and then
const DOG_COLS = [BRICK, WARM, GRAY, WHITE, ORANGE, YEL];
const walkingDog = p => p.role === 'dogwalker' && !p.hidden && p.act === 'wander' && tod >= 7 && tod < 20;
function dogOf(p) {
  const mx = p.last[0], my = p.last[1], side = (p.ph * 7 | 0) % 2 ? 1 : -1, sniff = Math.sin(T * 0.7 + p.ph) > 0.7;
  const back = 0.09 + (sniff ? 0.04 : 0) + Math.sin(T * 1.9 + p.ph) * 0.01, off = 0.035 * side + Math.sin(T * 1.3 + p.ph) * 0.012;
  return { x: mod(p.x - mx * back - my * off, N), y: mod(p.y - my * back + mx * off, N), mx, my, sniff, col: DOG_COLS[(p.ph * 13 | 0) % DOG_COLS.length], small: (p.ph * 5 | 0) % 3 === 0 };
}
const nearWalkedDog = () => mode === 'walk' && people.find(p => walkingDog(p) && (() => { const d = dogOf(p); return Math.hypot(rel(d.x - px), rel(d.y - py)) < 0.15; })());

// how far along the stretch from corner (x, y) heading (mx, my) a door is, if it's on that stretch (0 if not)
function passesAt(x, y, mx, my, d) {
  const along = rel(d.x - x) * mx + rel(d.y - y) * my, across = rel(d.x - x) * my - rel(d.y - y) * mx;
  return along > 0 && along < 6.24 && Math.abs(across) < 0.02 ? along : 0;
}
// shortest number of street stretches from every intersection to either end of a door's stretch, by breadth-first
// search over the street network; worked out the first time someone heads for that door, then kept
const routeCache = new Map();
function routeTo(d) {
  let f = routeCache.get(d);
  if (f) return f;
  f = new Int16Array(NB * NB).fill(9999);
  const bx = Math.floor(mod(d.x, N) / 8), by = Math.floor(mod(d.y, N) / 8);
  const queue = d.ny ? [bi(bx, by), bi(bx + 1, by)] : [bi(bx, by), bi(bx, by + 1)]; // its stretch's two intersections
  for (const k of queue) f[k] = 0;
  for (let h = 0; h < queue.length; h++) {
    const k = queue[h], x = k % NB, y = k / NB | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (exitOK(x, y, dx, dy)) {
      const m = bi(x + dx, y + dy); if (f[m] > f[k] + 1) { f[m] = f[k] + 1; queue.push(m); }
    }
  }
  routeCache.set(d, f);
  return f;
}
// corner (qx, qy in {0, 1}: west/east, north/south) of intersection (ix, iy) is sidewalk if a street runs past it
const cornerOK = (ix, iy, qx, qy) => !!(hseg(qx ? ix : ix - 1, iy) || vseg(ix, qy ? iy : iy - 1));

function planPerson(p, t) {
  const lx = mod(p.x, 8), ly = mod(p.y, 8), ix = Math.floor(p.x / 8), iy = Math.floor(p.y / 8), bx = p.x - lx, by = p.y - ly;
  const qx = lx > 1 ? 1 : 0, qy = ly > 1 ? 1 : 0, opts = [];
  p.x = mod(bx + (qx ? 1.88 : 0.12), N); p.y = mod(by + (qy ? 1.88 : 0.12), N); // exactly on the corner: no drift over many legs
  for (const [mx, my] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (mx === -p.last[0] && my === -p.last[1]) continue;
    const hi = mx ? (mx > 0) === !!qx : (my > 0) === !!qy; // moving away from the intersection: along the block
    if (hi) { if (exitOK(ix, iy, mx, my)) opts.push({ mx, my, along: true }); continue; }
    // across the intersection to the next corner; a crossing if there's a road in between, else round the sidewalk
    const nqx = mx ? 1 - qx : qx, nqy = my ? 1 - qy : qy;
    if (!cornerOK(ix, iy, nqx, nqy)) continue;
    const road = mx ? vseg(ix, qy ? iy : iy - 1) : hseg(qx ? ix : ix - 1, iy);
    opts.push({ mx, my, road });
  }
  if (!opts.length) { p.last = [-p.last[0], -p.last[1]]; return; } // turn back (only at the odd awkward corner)
  const passes = (o, d) => o.along ? passesAt(p.x, p.y, o.mx, o.my, d) : 0;
  // Head for the goal along the shortest route through the streets (routeTo): the stretch past its door if we're on
  // it; else the stretch toward the nearest end of the door's; else cross to the corner that has that stretch.
  const goal = p.goal, f = goal && routeTo(goal);
  for (const q of opts) {
    if (!goal) { q.score = Math.random() * 3 + (q.along ? 0.5 : 0); continue; }
    let cost;
    if (q.along) cost = passes(q, goal) ? -1 : 1 + f[bi(ix + q.mx, iy + q.my)];
    else { // a crossing is worth whatever the best stretch from the corner it takes us to is worth
      const nqx = q.mx ? 1 - qx : qx, nqy = q.my ? 1 - qy : qy, cx_ = bx + (nqx ? 1.88 : 0.12), cy_ = by + (nqy ? 1.88 : 0.12);
      cost = 9999;
      for (const [mx, my] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!(mx ? (mx > 0) === !!nqx : (my > 0) === !!nqy) || !exitOK(ix, iy, mx, my)) continue;
        cost = Math.min(cost, passesAt(cx_, cy_, mx, my, goal) ? 0 : 1 + f[bi(ix + mx, iy + my)]);
      }
      cost += 0.3;
    }
    q.score = -cost + Math.random() * 0.2;
  }
  const o = opts.reduce((b, q) => q.score > b.score ? q : b);
  p.last = [o.mx, o.my]; p.legs++;
  if (!o.along) {
    p.path.push({ x: p.x + o.mx * 1.76, y: p.y + o.my * 1.76, fast: o.road, gate: o.road ? t => walkSig(bx, by, o.my !== 0, t) : null });
    return;
  }
  const nrm = o.mx ? [0, qy ? 1 : -1] : [qx ? 1 : -1, 0]; // toward the block we're walking beside
  const end = { x: p.x + o.mx * 6.24, y: p.y + o.my * 6.24 };
  const cx = p.x + o.mx * 3.12 + nrm[0] * 3.12, cy = p.y + o.my * 3.12 + nrm[1] * 3.12; // block centre
  // how far along this stretch a door is, if it's on it
  const onLeg = d => passes(o, d);
  // Go in at our door if it's on this stretch. A walk across town would take game hours (a block is a minute on
  // foot, an hour is 20 seconds), so any door here that suits the routine will do: it becomes their home, their work.
  let door = goal && onLeg(goal) ? goal : null;
  if (!door && p.act && p.act !== 'wander') {
    const want = USES[p.act === 'home' && p.legs > 1 ? 'lobby' : p.act];
    // doors are bucketed by their sidewalk point, which is in the same block as this stretch's midpoint
    const mid = [mod(p.x + o.mx * 3.12, N), mod(p.y + o.my * 3.12, N)];
    door = doorsB[bi(Math.floor(mid[0] / 8), Math.floor(mid[1] / 8))].find(d => want(d) && onLeg(d) && (p.legs > 3 || Math.random() < 0.85)) || null;
    if (door && (p.act === 'home' || p.act === 'work')) p[p.act] = door;
  }
  if (door) {
    const along = onLeg(door), at = { x: p.x + o.mx * along, y: p.y + o.my * along };
    p.path.push(at, { x: at.x + door.nx, y: at.y + door.ny, enter: door }, { ...at }, end);
    return;
  }
  if (!goal && blockKind(Math.floor(mod(cx, N) / 8), Math.floor(mod(cy, N) / 8)) === 'park' && Math.random() < 0.6) {
    const [bx_, by_] = pick(BENCH), mid = { x: p.x + o.mx * 3.12, y: p.y + o.my * 3.12 };
    p.path.push(mid, { x: cx, y: cy }, { x: cx + bx_, y: cy + by_, stay: 6 + Math.random() * 12 }, { x: cx, y: cy }, { ...mid });
  }
  p.path.push(end);
}

// pick (or keep) a goal for the routine; called when someone comes out or finishes a leg
function rethink(p, t) {
  const act = activity(p, t);
  if (act !== p.act || !p.goal && act !== 'wander' || p.legs > 30) {
    p.act = act; p.goal = placeFor(p, act, t); p.legs = 0;
  }
}

// straight to wherever the routine has them right now: indoors at the place, or out from their front door
function settle(p) {
  const act = activity(p, tod), place = placeFor(p, act, tod);
  p.act = act; p.goal = null; p.loiter = false; p.legs = 0;
  if (place) { p.x = place.x; p.y = place.y; p.inside = place; p.hidden = true; p.wait = 3 + Math.random() * 15; }
  else { p.x = p.home.x; p.y = p.home.y; p.inside = null; p.hidden = false; p.wait = 0; }
  snapToCorner(p);
}
// A block takes a minute to walk but a game hour lasts 20 seconds, so a routine walked out in full would run hours
// behind the clock. Only people you can see walk: out of sight they settle instantly, and anyone coming back into
// the simulated area after a while frozen catches up the same way.
const SEEN_R = 28, VIS_R = MAXD + 4; // beyond SEEN_R, anyone a building hides from you; beyond VIS_R, anyone at all
function stepPeople(dt, t, everywhere = false) {
  for (const p of people) {
    if (!everywhere && !p.follow && !simulated(p.x, p.y)) continue;
    if (!everywhere && !p.follow && !(p.talk > 0)) {
      if (p.simT !== undefined && T - p.simT > 2) settle(p);
      else if (p.goal && !p.hidden) { const d = Math.hypot(rel(p.x - px), rel(p.y - py)); if (d > VIS_R || d > SEEN_R && !lineOfSight(px, py, p.x, p.y)) settle(p); } // (never vanishing in plain view)
      p.simT = T;
    }
    if (p.talk > 0) { p.talk -= dt; continue; } // stopped to chat with you
    if (p.follow) { followYou(p, dt); continue; }
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait <= 0 && p.loiter) { p.loiter = false; p.hidden = true; p.wait = 10 + Math.random() * 20; continue; } // in they go
      if (p.wait <= 0) {
        // indoors: stay put while the routine still has them here, else come back out
        if (p.hidden && p.inside && activity(p, tod) === p.act && (p.act !== 'shop' || Math.random() < 0.3)) { p.wait = 8 + Math.random() * 12; continue; }
        p.hidden = false; p.inside = null;
        if (p.act === 'shop') p.act = ''; // errand done: find the next one
        rethink(p, tod); // and know where they're off to as they step out
      }
      continue;
    }
    if (!p.path.length) { rethink(p, tod); planPerson(p, t); }
    const w = p.path[0];
    if (!w) continue;
    if (w.gate && !w.go) { if (!w.gate(t)) continue; w.go = true; }
    const ex = rel(w.x - p.x), ey = rel(w.y - p.y), dist = Math.hypot(ex, ey), step = p.sp * (w.fast ? 2.2 : 1) * dt;
    if (dist <= step) {
      p.x = mod(w.x, N); p.y = mod(w.y, N); p.path.shift();
      if (w.stay) p.wait = w.stay;
      if (w.enter) { // the rest of the path walks back out to the line and on to the corner
        p.goal = null; p.inside = w.enter;
        // a crowd hangs about outside the bars at night: some stand by the door a while before going in
        if (w.enter.use === 'bar' && Math.random() < 0.4) {
          p.x = mod(p.x - w.enter.nx + (Math.random() - 0.5) * 0.5 * (w.enter.ny ? 1 : 0), N);
          p.y = mod(p.y - w.enter.ny + (Math.random() - 0.5) * 0.5 * (w.enter.nx ? 1 : 0), N);
          p.wait = 20 + Math.random() * 40; p.loiter = true;
        } else { p.hidden = true; p.wait = 6 + Math.random() * 14; }
      }
    } else { p.x = mod(p.x + ex / dist * step, N); p.y = mod(p.y + ey / dist * step, N); p.ph += dt * 4; }
  }
}
