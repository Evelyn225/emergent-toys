// ===== peeing, just for fun: P lets it go wherever you're standing. Like Postal 2, it comes up from the bottom of
// the screen and you aim it with your eyes: look up and it arcs out further, down and it lands at your feet, gravity
// bending it down either way. A yellow puddle spreads where it lands, then
// dries up over a few minutes (quicker in the rain, slower indoors). How long you go is down to the bladder
// (needs.js), which nothing shows and nothing ever makes you empty. P again cuts it off.
// Stand by a toilet (bars, diners, home, the cell) and it goes in the bowl, and you flush. Anywhere in a bar's or a
// diner's bathroom is your own business; anywhere else indoors the staff throw you out; outside, a cop who sees it nicks you for public urination, and passers-by have a word.
let pee = null; // { left: seconds of stream, t, at, loo: [x, y] or null, seen: when we last looked round, caught }
const peeDrops = []; // { at, s, x, y, z, vx, vy, vz, t0 }: the stream, in flight, oldest first
const puddles = []; // { at, s, x, y, z, area, life, seed }: area in square metres
const peeMarks = []; // splats on vertical walls and static objects, stored in the surface plane
let peeN = 0; // drops so far (for the ripples running down the stream)
const PEE_DRY = 240; // seconds for a puddle to dry outside
const PEE_RATE = 60, PEE_DROP = 0.0022; // drops a second, and the puddle each one makes (m²): a full bladder's ~1.3m²
const peeScale = () => mode === 'room' ? 1 : 0.1; // world units a metre
const LOO_TOP = 0.42, LOO_R = 0.2, LOO_REACH = 1.4, COP_PEE = 4, CIV_PEE = 1.5; // the bowl; how near to use it; how near a cop / anyone notices (cells)
const loos = () => mode === 'room' && room.props ? room.props.filter(s => s.loo).map(s => s.loo) : [];
function looNear() {
  let best = null, bd = LOO_REACH;
  for (const l of loos()) { const d = Math.hypot(l[0] - px, l[1] - py); if (d < bd) { best = l; bd = d; } }
  return best;
}
// standing at a portapotty's door (props.js puts them on the building sites)
const pottyNear = () => mode === 'walk' ? potties.find(o => Math.hypot(rel(o.x - o.hl - 0.06 - px), rel(o.y - py)) < 0.1) : null;
const enterPotty = o => enterRoom('potty', { word: 'PORTAPOTTY', ret: [px, py, a] }, [2, 2.5, -Math.PI / 2]);
const PEE_SEEN = ['"Ugh, seriously?"', '"There are kids around!"', '"Oh, come ON."', '"Gross."', '"Not on my street, pal."', '"Classy."'];
// how high the ground is at (x, y), and whether something's standing up out of it there (a wall: the stream stops)
function peeGround(x, y) {
  if (mode === 'room') { const h = ROOMW.cell(Math.floor(x), Math.floor(y)); return h ? { wall: h } : { z: stairRise(x, y) }; }
  const h = map[idx(Math.floor(x), Math.floor(y))] || 0;
  return h > (mode === 'roof' ? roofH + 1e-6 : 0) ? { wall: h } : { z: h }; // (off a roof's edge it falls to whatever's below)
}

// A drop moves only a few centimetres per frame, so test its short segment against the grid wall it entered.
function peeWallHit(ox, oy, oz, x, y, z, height) {
  if (!height || z >= height) return null;
  const dx = x - ox, dy = y - oy, dz = z - oz, hits = [];
  if (Math.floor(ox) !== Math.floor(x) && Math.abs(dx) > 1e-9) {
    const edge = dx > 0 ? Math.floor(x) : Math.floor(ox), t = (edge - ox) / dx, hy = oy + dy * t;
    const hz = oz + dz * t;
    if (t >= 0 && t <= 1 && hz >= 0 && hz <= height && hy >= Math.floor(y) && hy <= Math.floor(y) + 1)
      hits.push({ t, x: edge, y: hy, z: hz, nx: -Math.sign(dx), ny: 0, nz: 0, face: 'wall' });
  }
  if (Math.floor(oy) !== Math.floor(y) && Math.abs(dy) > 1e-9) {
    const edge = dy > 0 ? Math.floor(y) : Math.floor(oy), t = (edge - oy) / dy, hx = ox + dx * t;
    const hz = oz + dz * t;
    if (t >= 0 && t <= 1 && hz >= 0 && hz <= height && hx >= Math.floor(x) && hx <= Math.floor(x) + 1)
      hits.push({ t, x: hx, y: edge, z: hz, nx: 0, ny: -Math.sign(dy), nz: 0, face: 'wall' });
  }
  if (!hits.length && oz > height && z <= height && Math.abs(dz) > 1e-9) {
    const t = (height - oz) / dz;
    hits.push({ t, x: ox + dx * t, y: oy + dy * t, z: height, nx: 0, ny: 0, nz: 1, face: 'wall' });
  }
  return hits.sort((a, b) => a.t - b.t)[0] || null;
}

function peeBoxHit(ox, oy, oz, x, y, z, box) {
  const local = (wx, wy) => {
    const qx = wx - box.x, qy = wy - box.y;
    return [qx * box.c + qy * box.s, -qx * box.s + qy * box.c];
  };
  const [u0, v0] = local(ox, oy), [u1, v1] = local(x, y), du = u1 - u0, dv = v1 - v0, dz = z - oz;
  let enter = 0, leave = 1, face = 0;
  for (const [origin, delta, lo, hi, lowFace, highFace] of [[u0, du, -box.hl, box.hl, 2, 1], [v0, dv, -box.hw, box.hw, 4, 3], [oz, dz, box.z0, box.z1, 6, 5]]) {
    if (Math.abs(delta) < 1e-9) { if (origin < lo || origin > hi) return null; continue; }
    let near = (lo - origin) / delta, far = (hi - origin) / delta, nearFace = lowFace;
    if (near > far) { [near, far] = [far, near]; nearFace = highFace; }
    if (near > enter) { enter = near; face = nearFace; }
    leave = Math.min(leave, far);
    if (enter > leave) return null;
  }
  if (!face || enter < 0 || enter > 1) return null;
  const hx = ox + (x - ox) * enter, hy = oy + (y - oy) * enter, hz = oz + dz * enter;
  let nx = 0, ny = 0, nz = 0, ux, uy, uz, vx, vy, vz;
  if (face === 1 || face === 2) {
    const sign = face === 1 ? 1 : -1; nx = box.c * sign; ny = box.s * sign;
    [ux, uy, uz] = [-box.s, box.c, 0]; [vx, vy, vz] = [0, 0, 1];
  } else if (face === 3 || face === 4) {
    const sign = face === 3 ? 1 : -1; nx = -box.s * sign; ny = box.c * sign;
    [ux, uy, uz] = [box.c, box.s, 0]; [vx, vy, vz] = [0, 0, 1];
  } else {
    nz = face === 5 ? 1 : -1;
    [ux, uy, uz] = [box.c, box.s, 0]; [vx, vy, vz] = [-box.s, box.c, 0];
  }
  return { t: enter, x: hx, y: hy, z: hz, nx, ny, nz, ux, uy, uz, vx, vy, vz, face };
}

function peeObjectHit(ox, oy, oz, x, y, z) {
  let best = null;
  const offer = box => {
    const hit = peeBoxHit(ox, oy, oz, x, y, z, box);
    if (hit && box.gap && box.gap((hit.x - box.x) * box.c + (hit.y - box.y) * box.s, hit.z)) return; // through the gaps (cell bars)
    if (hit && (!best || hit.t < best.t)) best = hit;
  };
  if (mode === 'room') {
    for (const p of room.props) {
      if (p.tick) continue;
      if (p.box) offer(p.box);
      if (p.bench) {
        const c = -p.fy, s = p.fx;
        offer({ x: p.x, y: p.y, c, s, hl: 0.75, hw: 0.2, z0: 0.4, z1: 0.48 });
        offer({ x: p.x - p.fx * 0.19, y: p.y - p.fy * 0.19, c, s, hl: 0.75, hw: 0.04, z0: 0.48, z1: 0.85 });
      }
      if (p.vm) offer({ x: p.x, y: p.y, c: p.vm.c, s: p.vm.s, hl: 0.45, hw: 0.35, z0: 0, z1: 1.9 });
    }
    return best;
  }

  const mx = (ox + x) / 2, my = (oy + y) / 2, bx = Math.floor(mx / 8), by = Math.floor(my / 8);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    for (const o of solidsB[bi(bx + i, by + j)]) {
      offer({ ...o, x: mx + rel(o.x - mx), y: my + rel(o.y - my) });
    }
    for (const b of benchesB[bi(bx + i, by + j)]) {
      const c = -b.fy, s = b.fx, x0 = mx + rel(b.x - mx), y0 = my + rel(b.y - my);
      offer({ x: x0, y: y0, c, s, hl: 0.075, hw: 0.02, z0: 0.04, z1: 0.048 });
      offer({ x: x0 - b.fx * 0.019, y: y0 - b.fy * 0.019, c, s, hl: 0.075, hw: 0.004, z0: 0.048, z1: 0.085 });
    }
    for (const m of machinesB[bi(bx + i, by + j)]) {
      offer({ x: mx + rel(m.x - mx), y: my + rel(m.y - my), c: m.c, s: m.s, hl: VM_HL, hw: VM_HW, z0: 0, z1: VM_H });
    }
  }
  return best;
}

function peeMarkHit(hit, p) {
  if (hit.face === 'wall') {
    if (hit.nz) { [hit.ux, hit.uy, hit.uz] = [1, 0, 0]; [hit.vx, hit.vy, hit.vz] = [0, 1, 0]; }
    else if (hit.nx) { [hit.ux, hit.uy, hit.uz] = [0, 1, 0]; [hit.vx, hit.vy, hit.vz] = [0, 0, 1]; }
    else { [hit.ux, hit.uy, hit.uz] = [1, 0, 0]; [hit.vx, hit.vy, hit.vz] = [0, 0, 1]; }
  }
  const s = p.s, x = p.at === '' ? mod(hit.x, N) : hit.x, y = p.at === '' ? mod(hit.y, N) : hit.y;
  let best = null, bd = Infinity;
  for (const q of peeMarks) {
    if (q.at !== p.at || q.s !== s || q.nx * hit.nx + q.ny * hit.ny + q.nz * hit.nz < 0.95) continue;
    const dx = p.at === '' ? rel(x - q.x) : x - q.x, dy = p.at === '' ? rel(y - q.y) : y - q.y, dz = hit.z - q.z;
    const u = dx * q.ux + dy * q.uy + dz * q.uz, v = dx * q.vx + dy * q.vy + dz * q.vz, d = Math.hypot(u, v) / s;
    if (d < Math.sqrt(q.area / Math.PI) + 0.12 && d < bd) { best = q; bd = d; }
  }
  if (best) {
    const dx = p.at === '' ? rel(x - best.x) : x - best.x, dy = p.at === '' ? rel(y - best.y) : y - best.y, dz = hit.z - best.z;
    const u = dx * best.ux + dy * best.uy + dz * best.uz, v = dx * best.vx + dy * best.vy + dz * best.vz, w = PEE_DROP / (best.area + PEE_DROP);
    const mx = (best.ux * u + best.vx * v) * w, my = (best.uy * u + best.vy * v) * w, mz = (best.uz * u + best.vz * v) * w;
    best.x = best.at === '' ? mod(best.x + mx, N) : best.x + mx;
    best.y = best.at === '' ? mod(best.y + my, N) : best.y + my;
    best.z += mz;
    best.area = Math.min(best.area + PEE_DROP, 0.5); best.life = 1;
    return;
  }
  peeMarks.push({ at: p.at, s, x, y, z: hit.z, nx: hit.nx, ny: hit.ny, nz: hit.nz,
    ux: hit.ux, uy: hit.uy, uz: hit.uz, vx: hit.vx, vy: hit.vy, vz: hit.vz,
    area: PEE_DROP * 4, life: 1, seed: Math.random() * 100 });
  const mark = peeMarks[peeMarks.length - 1], nudge = 0.002 * s;
  mark.x += mark.nx * nudge; mark.y += mark.ny * nudge; mark.z += mark.nz * nudge;
  while (peeMarks.length > 80) peeMarks.shift();
}

function peeSplash(hit, p) {
  if (p.splash || Math.random() >= 0.35) return;
  const speed = (0.3 + Math.random() * 0.5) * p.s;
  peeDrops.push({ at: p.at, s: p.s, x: hit.x + hit.nx * 0.004 * p.s, y: hit.y + hit.ny * 0.004 * p.s,
    z: hit.z + hit.nz * 0.004 * p.s, vx: (hit.nx * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5) * p.s,
    vy: (hit.ny * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.5) * p.s,
    vz: (0.8 + Math.random() * 0.8) * p.s, t0: T, splash: true });
}

function startPee() {
  if (pee) { pee = null; setPeeAudio(false); say('You stop.', 1.2); return; }
  const at = placeKey();
  if (at === null || !onFootMode()) return say('Not here.');
  if (body.seat) return say('Stand up first.');
  pee = { left: 1.5 + needs.bladder / 100 * 11, t: 0, at, loo: looNear(), seen: 0, caught: false }; // (a short one even with nothing in you)
  setPeeAudio(true);
  say(pee.loo ? 'You use the toilet.' : mode === 'room' && inWc(px, py) ? 'Not quite the toilet, but close enough.' : needs.bladder > 80 ? 'Ahh. That\'s better.' : needs.bladder < 15 ? 'You squeeze out what you can.' : 'You relieve yourself.', 2);
}

function stepPee(dt) {
  if (pee) {
    if (!onFootMode() || placeKey() !== pee.at || sleep || game) { pee = null; setPeeAudio(false); }
    else {
      pee.t += dt; pee.left -= dt;
      needs.bladder = Math.max(0, needs.bladder - dt * 100 / 12.5);
      const flow = Math.min(1, 0.35 + pee.t * 1.6) * Math.min(1, Math.max(0, pee.left) / 1.4); // starts up, dribbles out
      for (let n = Math.round(PEE_RATE * dt + Math.random() * 0.5); n > 0; n--) peeSpray(flow);
      if ((pee.seen -= dt) <= 0) { pee.seen = 0.4; peeWitness(); if (!pee) setPeeAudio(false); }
      if (pee && pee.left <= 0) { if (pee.loo) { flushT = T; say('You flush. Very civilised.', 2); } pee = null; setPeeAudio(false); }
    }
  }
  // the stream in the air
  const bowls = loos();
  for (let k = peeDrops.length - 1; k >= 0; k--) {
    const p = peeDrops[k], ox = p.x, oy = p.y, oz = p.z;
    p.vz -= 9.8 * p.s * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (T - p.t0 > 3) { peeDrops.splice(k, 1); continue; }
    if (p.at !== (placeKey() ?? '-')) continue; // (left behind somewhere: frozen till it times out)
    if (oz > LOO_TOP && p.z <= LOO_TOP && bowls.length) { // coming down past the rim: where, exactly?
      const f = (oz - LOO_TOP) / (oz - p.z), cx = ox + (p.x - ox) * f, cy = oy + (p.y - oy) * f;
      if (bowls.some(l => Math.hypot(cx - l[0], cy - l[1]) < LOO_R)) { peeDrops.splice(k, 1); continue; } // in the bowl
    }
    const g = peeGround(p.x, p.y);
    const wall = g.wall && p.z < g.wall ? peeWallHit(ox, oy, oz, p.x, p.y, p.z, g.wall) : null;
    const object = peeObjectHit(ox, oy, oz, p.x, p.y, p.z), hit = wall && (!object || wall.t < object.t) ? wall : object;
    if (hit) { if (!p.splash) { peeMarkHit(hit, p); peeSplash(hit, p); } peeDrops.splice(k, 1); continue; }
    if (g.wall && p.z < g.wall) { // splashes against a wall and runs down to its foot
      const g0 = peeGround(ox, oy);
      peeLand(p, ox, oy, g0.z ?? p.z); peeDrops.splice(k, 1);
    } else if (!g.wall && p.z <= g.z) { peeLand(p, p.x, p.y, g.z); peeDrops.splice(k, 1); }
  }
  // puddles drying
  for (let k = puddles.length - 1; k >= 0; k--) {
    const q = puddles[k];
    if ((q.life -= dt / PEE_DRY * (q.at === '' ? 1 + wet * 3 : 0.5)) <= 0) puddles.splice(k, 1);
  }
  for (let k = peeMarks.length - 1; k >= 0; k--) {
    const q = peeMarks[k];
    if ((q.life -= dt / PEE_DRY * (q.at === '' ? 1 + wet * 3 : 0.5)) <= 0) peeMarks.splice(k, 1);
  }
}
// who sees: the staff indoors (you're out), a cop outside (you're nicked), anyone else outside (they say so)
function peeWitness() {
  if (pee.loo || pee.t < 0.8) return;
  if (mode === 'room') {
    const k = room.def.keeper, kind = room.kind;
    if (kind === 'jail') { if (!pee.caught) { pee.caught = true; say('The guard bangs on the bars. "Use the toilet, animal."', 3); } return; }
    if (kind === 'aviary') return; // the keeper lets it go when you pee on the aviary floor
    if (inWc(px, py)) return; // in the bathroom: nobody's watching, and it's the right room at least
    if (!k || room.burgled || kind === 'home' || kind === 'loft' || kind === 'hotelroom') return; // (your own place, or nobody here: your own business)
    const there = loos().length ? ' The toilet\'s RIGHT THERE.' : '';
    pee = null; leaveRoom();
    return say(`"Hey! HEY! Not in here!"${there} You're thrown out onto the street.`, 4);
  }
  if (mode !== 'walk' || pee.caught) return; // (up on a roof nobody's looking)
  const cop = cars.some(c => c.patrol && !c.player && near(c.x, c.y, px, py) < COP_PEE && lineOfSight(c.x, c.y, px, py))
    || footCops.some(c => near(c.x, c.y, px, py) < COP_PEE && lineOfSight(c.x, c.y, px, py));
  if (cop) { pee.caught = true; addWanted('urination', px, py, true); return say('A cop saw that. Public urination!', 3); }
  if (pee.t > 1.5 && !pee.heard && people.some(p => !p.hidden && near(p.x, p.y, px, py) < CIV_PEE && lineOfSight(p.x, p.y, px, py))) {
    pee.heard = true; say(`Someone walking past: ${pick(PEE_SEEN)}`, 3);
  }
}
// one drop, out in front of you at about hip height
function peeSpray(flow) {
  // aimed where you look: well above the middle of the screen, so the arc comes down about where your eyes are
  const s = peeScale(), wob = Math.sin(T * 6) * 0.05 + Math.sin(T * 1.7) * 0.09;
  const look = Math.atan(pitch * rows / projY), el = clamp(look + 0.55, -1.3, 1.3) + Math.sin(T * 2.9) * 0.03;
  let ang = a + wob, sp = 1.5 + flow * 4.5, up = Math.sin(el) * sp;
  const ground = eye - eyeLift() * s - (mode === 'room' ? 1.7 : 0.17); // (eye height less the 1.7m you stand)
  const hip = Math.max(ground + 0.3 * s, eye - 0.8 * s); // (crouched, it's not coming out of the floor)
  const x = px + Math.cos(a) * 0.25 * s, y = py + Math.sin(a) * 0.25 * s;
  sp *= Math.cos(el);
  if (pee.loo) { // at a toilet you get some help: whatever lands it in the bowl (gravity still has the say on the way down)
    const [lx, ly] = pee.loo, d = Math.hypot(lx - x, ly - y), fall = Math.max(0.05, hip - LOO_TOP);
    up = 0.4 + flow * 0.7; ang = Math.atan2(ly - y, lx - x) + wob * 0.15;
    sp = d * 9.8 / (up + Math.sqrt(up * up + 2 * 9.8 * fall)) * (0.96 + Math.random() * 0.08);
  }
  peeDrops.push({ at: pee.at, s, x, y, z: hip, vx: Math.cos(ang) * sp * s, vy: Math.sin(ang) * sp * s,
    vz: (up + (Math.random() - 0.5) * 0.15) * s, t0: T, n: peeN++ });
  while (peeDrops.length > 400) peeDrops.shift();
}
// where a drop comes down: onto a puddle that's already there (it spreads), or the start of a new one
function peeLand(p, x, y, z) {
  const room_ = p.at !== '';
  if (p.splash) return;
  if (Math.random() < 0.35) { // a splash: a droplet or two bouncing off
    const ang = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 0.5) * p.s;
    peeDrops.push({ at: p.at, s: p.s, x, y, z: z + 0.01 * p.s, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vz: (0.8 + Math.random() * 0.8) * p.s, t0: T, splash: true });
  }
  if (!room_) { x = mod(x, N); y = mod(y, N); }
  let best = null, bd = Infinity;
  for (const q of puddles) {
    if (q.at !== p.at || Math.abs(q.z - z) > 0.05 * p.s) continue;
    const d = Math.hypot(room_ ? x - q.x : rel(x - q.x), room_ ? y - q.y : rel(y - q.y)) / p.s, rr = Math.sqrt(q.area / Math.PI);
    if (d < rr + 0.12 && d < bd) { best = q; bd = d; }
  }
  if (best) { // spreads, creeping a little toward where it's landing
    const w = PEE_DROP / (best.area + PEE_DROP);
    best.x += (room_ ? x - best.x : rel(x - best.x)) * w; best.y += (room_ ? y - best.y : rel(y - best.y)) * w;
    best.area = Math.min(best.area + PEE_DROP, 2.5); best.life = 1;
  } else {
    puddles.push({ at: p.at, s: p.s, x, y, z, area: PEE_DROP * 4, life: 1, seed: Math.random() * 100 });
    while (puddles.length > 40) puddles.shift();
  }
}

// the puddles, drawn on the ground before the sprites (so anyone standing in one stands in front of it)
function drawPuddles() {
  const at = placeKey();
  if (at === null || !puddles.length) return;
  const room_ = mode === 'room', lit = Math.max(0.45, amb);
  for (const q of puddles) {
    if (q.at !== at) continue;
    const rx_ = room_ ? q.x - px : rel(q.x - px), ry_ = room_ ? q.y - py : rel(q.y - py);
    const R = Math.sqrt(q.area / Math.PI) * q.s * (0.35 + 0.65 * Math.sqrt(q.life)), k = (eye - q.z) * projY;
    if (k <= 0 || Math.hypot(rx_, ry_) - R > vis) continue;
    let c0 = cols, c1 = -1, r0 = rows, r1 = -1, behind = 0;
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const X = rx_ + su * R, Y = ry_ + sv * R, depth = dx * X + dy * Y;
      if (depth < 0.01 * q.s) { behind++; continue; }
      const col = cols / 2 + (-dy * X + dx * Y) * projX / depth, row = hor + k / depth;
      c0 = Math.min(c0, col); c1 = Math.max(c1, col); r0 = Math.min(r0, row); r1 = Math.max(r1, row);
    }
    if (behind === 4) continue;
    if (behind) { c0 = 0; c1 = cols; r1 = rows; r0 = Math.min(r0, rows); }
    c0 = Math.max(0, Math.floor(c0)); c1 = Math.min(cols, Math.ceil(c1) + 1);
    r0 = Math.max(0, Math.floor(r0), Math.ceil(hor)); r1 = Math.min(rows, Math.ceil(r1) + 1);
    for (let c = c0; c < c1; c++) {
      const cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
      for (let r = r0; r < r1; r++) {
        const i = r * cols + c, d = k / (r - hor + 0.5);
        if (d <= 0 || ZB[i] >= 0 && ZB[i] < d * 0.97) continue; // something's standing in front of it
        const ex = (rx * d - rx_) / R, ey = (ry * d - ry_) / R, e = Math.hypot(ex, ey) + (noise(ex * 1.7 + q.seed, ey * 1.7, 995) - 0.5) * 0.5;
        if (e >= 1) continue;
        const fresh = q.life, L = Math.max(0, 1 - d / vis) * lit * (7 + fresh * 6);
        const shine = noise(ex * 3 + T * 0.4, ey * 3 + q.seed, 996);
        set(i, e > 0.8 ? '.' : shine > 0.62 ? '~' : shine > 0.45 ? '-' : ' ', C(YEL, L * (e > 0.8 ? 0.8 : 1.2)));
        BG[i] = C(YEL, (1 + fresh * 1.6) * lit * (1 - e * 0.4)); FL[i] = 0;
      }
    }
  }
}
function drawPeeMarks() {
  const at = placeKey();
  if (at === null || !peeMarks.length) return;
  const room_ = mode === 'room', lit = Math.max(0.45, amb);
  for (const q of peeMarks) {
    if (q.at !== at) continue;
    const rx_ = room_ ? q.x - px : rel(q.x - px), ry_ = room_ ? q.y - py : rel(q.y - py), rz_ = q.z - eye;
    const centerDepth = dx * rx_ + dy * ry_;
    // never smaller than about a character cell: out in the street a fresh splash is a few cm across, so from more than
    // a couple of metres off it fell between the cells and vanished
    const radius = Math.max(Math.max(0.05, Math.sqrt(q.area / Math.PI)) * q.s * (0.35 + 0.65 * Math.sqrt(q.life)), centerDepth * 0.7 / Math.min(projX, projY));
    const depthRadius = radius * Math.hypot(dx * q.ux + dy * q.uy, dx * q.vx + dy * q.vy);
    if (centerDepth + depthRadius <= 0.05 || centerDepth - depthRadius > vis || q.nx * -rx_ + q.ny * -ry_ + q.nz * -rz_ <= 0) continue;
    const points = [];
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const X = rx_ + su * radius * q.ux + sv * radius * q.vx;
      const Y = ry_ + su * radius * q.uy + sv * radius * q.vy;
      const Z = rz_ + su * radius * q.uz + sv * radius * q.vz, depth = dx * X + dy * Y;
      if (depth > 0.02) points.push([cols / 2 + (-dy * X + dx * Y) * projX / depth, hor - Z * projY / depth]);
    }
    if (!points.length) continue;
    const c0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[0])))), c1 = Math.min(cols, Math.ceil(Math.max(...points.map(p => p[0]))) + 1);
    const r0 = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])))), r1 = Math.min(rows, Math.ceil(Math.max(...points.map(p => p[1]))) + 1);
    for (let c = c0; c < c1; c++) for (let r = r0; r < r1; r++) {
      const i = r * cols + c, cx = 2 * (c + 0.5) / cols - 1, rx = dx - dy * tf * cx, ry = dy + dx * tf * cx;
      const rz = (hor - r - 0.5) / projY, denom = q.nx * rx + q.ny * ry + q.nz * rz;
      if (Math.abs(denom) < 1e-9) continue;
      const depth = (q.nx * rx_ + q.ny * ry_ + q.nz * rz_) / denom;
      if (depth <= 0 || depth > vis || ZB[i] < 0 || ZB[i] < depth * 0.98) continue;
      const ux = (rx * depth - rx_) * q.ux + (ry * depth - ry_) * q.uy + (rz * depth - rz_) * q.uz;
      const vx = (rx * depth - rx_) * q.vx + (ry * depth - ry_) * q.vy + (rz * depth - rz_) * q.vz;
      const ex = ux / radius, ey = vx / radius, edge = Math.hypot(ex, ey) + (noise(ex * 1.7 + q.seed, ey * 1.7, 998) - 0.5) * 0.3;
      if (edge >= 1) continue;
      const fresh = q.life, L = Math.max(0, 1 - depth / vis) * lit * (7 + fresh * 6), shine = noise(ex * 3 + T * 0.4, ey * 3 + q.seed, 999);
      set(i, edge > 0.8 ? '.' : shine > 0.62 ? '~' : shine > 0.45 ? '-' : ' ', C(YEL, L * (edge > 0.8 ? 0.8 : 1.2)));
      BG[i] = C(YEL, (1 + fresh * 1.6) * lit * (1 - edge * 0.4)); FL[i] = 0; FOGS[i] = 0;
    }
  }
}
// the stream, over everything: each drop joined to the one just after it while it's still coming, so it reads as one arc
function drawStream() {
  const at = placeKey();
  if (at === null || !peeDrops.length) return;
  const room_ = mode === 'room', lit = Math.max(0.45, amb);
  let prev = null;
  for (const p of peeDrops) {
    if (p.at !== at) { prev = null; continue; }
    const rx_ = room_ ? p.x - px : rel(p.x - px), ry_ = room_ ? p.y - py : rel(p.y - py), depth = dx * rx_ + dy * ry_;
    const cur = depth > 0.02 * p.s ? { c: cols / 2 + (-dy * rx_ + dx * ry_) * projX / depth, r: hor - (p.z - eye) * projY / depth, depth, t0: p.t0 } : null;
    if (p.splash) { if (cur) peeDot(cur.c, cur.r, cur.depth, p.vz > 0 ? '\'' : '.', lit); continue; }
    if (cur && prev && cur.t0 - prev.t0 < 0.06) peeLine(prev, cur, lit, (p.n >> 2) % 3 ? 1 : 1.5); // brighter bands that ride down it, speeding up as they fall
    else if (cur) peeDot(cur.c, cur.r, cur.depth, '.', lit);
    prev = cur;
  }
}
function peeDot(c, r, depth, ch, lit) {
  c = Math.floor(c); r = Math.floor(r);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return;
  const i = r * cols + c;
  if (ZB[i] >= 0 && depth >= ZB[i]) return;
  set(i, ch, C(YEL, Math.max(8, (1 - depth / vis) * 12) * lit)); FOGS[i] = 0;
}
function peeLine(p0, p1, lit, bright) {
  let t0 = 0, t1 = 1; // clip to the screen first (the stream comes up from below it, from way off the bottom)
  const dc = p1.c - p0.c, dr = p1.r - p0.r;
  for (const [o, d, lo, hi] of [[p0.c, dc, -1, cols], [p0.r, dr, -1, rows]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; }
    let a_ = (lo - o) / d, b_ = (hi - o) / d;
    if (a_ > b_) [a_, b_] = [b_, a_];
    t0 = Math.max(t0, a_); t1 = Math.min(t1, b_);
    if (t0 > t1) return;
  }
  const n = Math.min(200, Math.ceil(Math.max(Math.abs(dc), Math.abs(dr)) * (t1 - t0)) + 1);
  const ch = Math.abs(dr) > Math.abs(dc) * 2 ? '|' : Math.abs(dc) > Math.abs(dr) * 2 ? '-' : (dc > 0) === (dr > 0) ? '\\' : '/';
  for (let k = 0; k <= n; k++) { const f = t0 + (t1 - t0) * k / n; peeDot(p0.c + dc * f, p0.r + dr * f, p0.depth + (p1.depth - p0.depth) * f, ch, lit * bright); }
}
