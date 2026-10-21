// ===== the revolver: a .38 the pawnbroker keeps under the counter, brought up after nine at night for anybody with
// the money and no police behind them. Pure (no DOM), so the node tests can run it; gun-ui.js draws it, the shots,
// the blood and the crosshair, and makes the noise.
//
// Six in the cylinder. Q fires where the crosshair is; R reloads from the boxes of rounds in your bag. A shot stops at
// the first thing in its way (a wall, the road, a car, somebody) and whoever it reaches is dead: down for good, a pool
// spreading under them, till an ambulance comes and takes them away (and somewhere across town somebody new steps out
// of their front door). Everyone in earshot runs for it, screaming, and the traffic puts its foot down.
// The law: a shot a cop sees, or a passer-by hears and phones in, is 2 stars; a killing somebody sees, 4 (and one more
// for every one after); a dead officer, 5. The police only shoot once you have: then, while they're after you, any
// officer with a clear look at you opens fire, and enough of it puts you in hospital. Caught, they take the gun.
ITEMS.revolver = { name: '.38 revolver', price: 600, kind: 'gun' }; // (uses: rounds in the cylinder)
ITEMS.ammo = { name: 'box of .38 rounds', price: 40, kind: 'ammo', uses: 24 };
const CYLINDER = 6, SHOT_RANGE = 14, RELOAD_T = 1.6, FIRE_GAP = 0.3;
const UNDER_COUNTER = ['revolver', 'ammo'];
const underCounter = t => t >= 21 || t < 2; // (after nine, till the pawnbroker shuts at two)
const HEAR_R = 9, PANIC_T = [5, 9], SPEED_OFF_T = 8; // how far a shot carries, how long people run, how long the traffic does
const BODY_CALL = 4, BODY_LOAD = 7, BODY_MAX = 150, POOL_T = 240; // seconds: till the call goes in; at the scene; at most; the blood
const COP_FIRE_R = 8, COP_FIRE_GAP = [1.1, 2.3], COP_HURT = [10, 18], COP_GUNS = 3, CALM_T = 30; // (the nearest three take aim)
const CAR_HIT = { amb: [0.25, 0.1, 0.15], fire: [0.37, 0.1, 0.17] }, CAR_DEFAULT = [0.21, 0.09, 0.14]; // [half length, half width, height]
const gun = { cool: 0, reload: 0, kick: 0, spin: 0, aimHeld: false, aim: 0, lastShotT: -Infinity, shots: [], copShots: [], hurtT: -Infinity };
const bodies = []; // { who, cop, x, y, t, amb, atT }
const pools = []; // { x, y, t }: blood, spreading, then dried and gone
const heldGun = () => { const it = heldItem(); return it && ITEMS[it.id].kind === 'gun' ? it : null; };
const canAimGun = () => !wanted.busted && !!heldGun() && (mode === 'walk' || mode === 'room' || mode === 'roof' || mode === 'elplat') && !freecam && !gun.reload;
const gunAim = () => canAimGun() ? gun.aim : 0;
const ammoLeft = () => inv.reduce((n, it) => n + (it.id === 'ammo' ? it.uses : 0), 0);
// what the pawnbroker says, handing it over
const GUN_SOLD = 'The pawnbroker looks at the door, then at you, and brings a bundle up from under the counter in a rag. "You didn\'t get it here." Left click or Q to fire, hold right click to aim, R to reload.';
// R: thumb the rounds in. Done when the time's up (stepGun)
function reloadGun() {
  const g = heldGun();
  if (wanted.busted || !g || gun.reload > 0) return null;
  if (g.uses >= CYLINDER) return ['All six are in.', null];
  if (!ammoLeft()) return ['No rounds. The pawnbroker sells them by the box, after nine.', 'click'];
  gun.reload = RELOAD_T;
  return ['', 'reload'];
}
function finishReload() {
  const g = heldGun();
  if (!g) return;
  while (g.uses < CYLINDER) {
    const k = inv.findIndex(it => it.id === 'ammo' && it.uses > 0);
    if (k < 0) break;
    const n = Math.min(CYLINDER - g.uses, inv[k].uses);
    g.uses += n; inv[k].uses -= n;
    if (inv[k].uses <= 0) { const keep = inv.indexOf(g); removeInventoryAt(k); held = inv.indexOf(g) >= 0 ? inv.indexOf(g) : keep; } // (an empty box goes in the bin)
  }
}

// ---- where a shot goes: along the crosshair from (x, y, z) heading (hx, hy), climbing `slope` per unit, to the first
// thing in its way. { d, x, y, z, what: 'air' | 'ground' | 'wall' | 'person' | 'cop' | 'car', who }
function traceShot(x, y, z, hx, hy, slope) {
  let end = SHOT_RANGE, what = 'air';
  for (let d = 0.02; d < SHOT_RANGE; d += 0.02) { // the road, or the first building, along the way
    const zz = z + slope * d;
    if (zz <= Math.max(terrainHeight(x + hx * d, y + hy * d),roadBridgeBuiltHeight(x+hx*d,y+hy*d,zz))) {
      let lo = Math.max(0, d - .02), hi = d;
      for (let n = 0; n < 10; n++) {
        const mid = (lo + hi) / 2;
        if (z + slope * mid <= Math.max(terrainHeight(x + hx * mid, y + hy * mid),roadBridgeBuiltHeight(x+hx*mid,y+hy*mid,z+slope*mid))) hi = mid; else lo = mid;
      }
      end = hi; what = 'ground'; break;
    }
    if (Math.max(map[idx(Math.floor(x + hx * d), Math.floor(y + hy * d))],islandRoofHeight(x+hx*d,y+hy*d),islandSightHeight(x+hx*d,y+hy*d),streetSceneHeight(x+hx*d,y+hy*d)) > zz) { end = d; what = 'wall'; break; }
  }
  let best = null;
  const closer = d => d > 0 && d < (best ? best.d : end);
  const figure = (o, kind, spot = null) => { // somebody standing (a body 3cm either side of the line, up to head height), or lying flat
    const tx=spot?.x??o.x,ty=spot?.y??o.y;
    const ox = rel(tx - x), oy = rel(ty - y), along = ox * hx + oy * hy, across = Math.abs(oy * hx - ox * hy), zz = z + slope * along - (spot?.z??outdoorGroundHeight(tx,ty));
    if (!closer(along)) return;
    if (zz >= 0 && (o.down ? across < 0.08 && zz < 0.04 : across < 0.032 && zz < (spot?.h??(kind === 'cop' ? 0.185 : 0.175)))) best = { d: along, what: kind, who: o, anchor:spot };
  };
  for (const p of people) if (!p.hidden && !p.dead && near(p.x, p.y, x, y) < SHOT_RANGE) figure(p, 'person');
  for (const c of footCops) if (!c.dead && near(c.x, c.y, x, y) < SHOT_RANGE) figure(c, 'cop');
  for(const c of roofCops)if(!c.dead)figure(c,'cop',{x:c.x,y:c.y,z:policeRoofHeight(c.x,c.y),h:.18});
  if(typeof gunSceneFigures==='function')for(const target of gunSceneFigures())figure(target.who,'person',target);
  for (const c of cars) { // a car: where the line goes into its box, if that's below its roof
    if (c.player || near(c.x, c.y, x, y) > SHOT_RANGE + 0.4) continue;
    const [hl, hw, h] = CAR_HIT[c.kind] || CAR_DEFAULT, ox = rel(x - c.x), oy = rel(y - c.y);
    const ux = ox * c.hx + oy * c.hy, uy = -ox * c.hy + oy * c.hx, vx = hx * c.hx + hy * c.hy, vy = -hx * c.hy + hy * c.hx;
    let t0 = 0, t1 = Infinity;
    for (const [o, v, half] of [[ux, vx, hl], [uy, vy, hw]]) {
      if (Math.abs(v) < 1e-9) { if (Math.abs(o) > half) { t0 = Infinity; break; } continue; }
      const a_ = (-half - o) / v, b_ = (half - o) / v;
      t0 = Math.max(t0, Math.min(a_, b_)); t1 = Math.min(t1, Math.max(a_, b_));
    }
    const localZ = z + slope * t0 - roadGroundHeight(c.x, c.y);
    if (t0 <= t1 && closer(t0) && localZ >= 0 && localZ < h) best = { d: t0, what: 'car', who: c };
  }
  const r = best || { d: end, what };
  return { ...r, x: worldCoord(x + hx * r.d), y: worldCoord(y + hy * r.d), z: Math.max(0, z + slope * r.d) };
}

// ---- Q: pull the trigger. From (x, y, z), turned to yaw, looking up `slope`; indoors, the room's own coordinates.
// What happened, for gun-ui.js: null (not ready), { empty }, or the shot and what it hit
function fireGun(x, y, z, yaw, slope, indoors = false) {
  const g = heldGun();
  if (wanted.busted || !g || gun.cool > 0 || gun.reload > 0) return null;
  if (g.uses <= 0) { gun.cool = 0.25; return { empty: true }; }
  g.uses--; gun.cool = FIRE_GAP; gun.kick = 1; gun.spin++; gun.lastShotT = T;
  wanted.fired = true; // (and now they'll shoot back)
  if (indoors) {
    const hx=Math.cos(yaw),hy=Math.sin(yaw),hit=typeof traceRoomShot==='function'?traceRoomShot(x,y,z,hx,hy,slope):{d:3,x:x+hx*3,y:y+hy*3,z:z+slope*3,what:'wall'};
    const [rx,ry]=crimePos();
    if(hit.what==='person'||hit.what==='cop')killRoomFigure(hit.who,hx,hy);
    if(hit.what==='cop')addWanted('copkill',rx,ry,true);
    const witnesses=typeof room!=='undefined'&&room?.props.some(p=>p.fig&&!p.fig.build&&!p.still&&!p.dead&&!p.hidden);
    if(witnesses)reports.push({t:T+reportDelay(),x:rx,y:ry,kind:hit.what==='person'?'murder':'gunfire'});
    else gunCrime('gunfire',rx,ry);
    const shot={x0:x,y0:y,z0:z,...hit,indoors:true,t:T};gun.shots.push(shot);return shot;
  }
  const hx = Math.cos(yaw), hy = Math.sin(yaw), hit = traceShot(x, y, z, hx, hy, slope);
  const shot = { x0: x, y0: y, z0: z, ...hit, t: T };
  gun.shots.push(shot);
  if (hit.what === 'person' || hit.what === 'cop') {
    if (!hit.who.dead) {
      killFigure(hit.who, hx, hy, hit.what === 'cop',hit.anchor);
      if (gunCrime(hit.what === 'cop' ? 'copkill' : 'murder', x, y) === '') gunCrime('gunfire', x, y); // (nobody saw it: they heard it)
    } else gunCrime('gunfire', x, y);
  } else {
    if (hit.what === 'car') { damageCar(hit.who, 12); if (!hit.who.patrol && !hit.who.parked) speedOff(hit.who); }
    // The driver calls it in; an unattended car's alarm does too. Don't depend on a pedestrian being outside.
    if (gunCrime('gunfire', x, y) === '' && hit.what === 'car') {
      reports.push({ t: T + reportDelay(), x, y, kind: 'gunfire' });
    }
  }
  panicAt(x, y);
  return shot;
}
// who saw it, or heard it: a cop who can see you puts you on the list straight away; a shot is heard by anybody in
// earshot, a killing has to be seen. 'cop', 'reported' or ''
function gunCrime(kind, x, y) {
  if (copSees(x, y)) { addWanted(kind, x, y, true); return 'cop'; }
  const heard = kind === 'gunfire', r = heard ? HEAR_R : CIV_SIGHT;
  if (people.some(p => !p.hidden && !p.dead && near(p.x, p.y, x, y) < r && (heard || lineOfSight(p.x, p.y, x, y)))) {
    reports.push({ t: T + reportDelay(), x, y, kind }); return 'reported';
  }
  return '';
}
// somebody shot: down where they stood, falling away from the shot, and staying there
function killFigure(o, hx, hy, cop = false, anchor = null) {
  o.down = { t: 0, dur: Infinity, fx: hx, fy: hy }; o.dead = true; o.looted=false;
  for (const k of ['talk', 'flee', 'gawk', 'help', 'hailing', 'follow', 'chase', 'goal']) delete o[k];
  if (o.path) o.path.length = 0;
  bodies.push({ who: o, cop, x: anchor?.x??o.x, y: anchor?.y??o.y, t: T, amb: null, atT: 0 });
  pools.push({ x: anchor?.x??o.x, y: anchor?.y??o.y, t: T });
  if (pools.length > 24) pools.shift();
  for (const p of people) if (p.help === o || p.gawk === o) { delete p.help; delete p.gawk; }
}
// everyone in earshot runs; the cars nearby put their foot down
function panicAt(x, y) {
  for (const p of people) {
    if (p.hidden || p.dead || p.follow || near(p.x, p.y, x, y) > HEAR_R) continue;
    const dx = rel(p.x - x), dy = rel(p.y - y), d = Math.hypot(dx, dy) || 1, k = Math.random() * 0.8 - 0.4; // (away, give or take)
    p.flee = { x: dx / d * Math.cos(k) - dy / d * Math.sin(k), y: dy / d * Math.cos(k) + dx / d * Math.sin(k), t: PANIC_T[0] + Math.random() * (PANIC_T[1] - PANIC_T[0]), scream: Math.random() < 0.4 };
    for (const k_ of ['talk', 'gawk', 'help', 'hailing', 'wait']) delete p[k_];
    p.loiter = false; // (the crowd outside the bar too)
  }
  for (const c of cars) if (near(c.x, c.y, x, y) < HEAR_R * 0.7) speedOff(c);
}
function speedOff(c) {
  if (c.player || c.rider || c.patrol || c.ev || c.parked || c.rush && !c.panicT) return;
  c.rush = true; c.panicT = T + SPEED_OFF_T;
}
// an ambulance for whoever's lying there: the nearest that's in, lights and siren, to the nearest bit of street
function ambulanceFor(b) {
  let best = null, bd = Infinity;
  for (let k = 0; k < 40; k++) { const l = randomLane(3, b.x, b.y); if (!l) break; const d = near(l.x, l.y, b.x, b.y); if (d < bd) { bd = d; best = l; } }
  if (!best || bd > 3) return null; // (not near a street: the gardens, the pier)
  const c = spawnEmergency('amb', [best.x, best.y]);
  if (c) c.corpse = true;
  return c;
}
function removeBody(k) {
  const b = bodies[k], o = b.who;
  bodies.splice(k, 1);
  if (b.cop) { // the department sends somebody else out on that beat
    const at = footCops.indexOf(o);
    if (at >= 0) footCops.splice(at, 1);
    for(const group of [roofCops,roomCops]){const i=group.indexOf(o);if(i>=0)group.splice(i,1);}
    if (o.base) { const corner = { ix: o.base.bx, iy: o.base.by, qx: 0, qy: 1 }, [x, y] = cornerXY(corner); footCops.push({ x, y, corner, dir: 0, goal: null, chase: false, ph: Math.random() * 9, base: o.base }); }
  } else if(people.includes(o))respawnPerson(o);else o.hidden=true;
}
// every frame: the reload, the bodies and their ambulances, the panic dying down, and the police shooting back.
// Returns 'down' when they've put you on the ground
function stepGun(dt) {
  gun.aim += ((gun.aimHeld && canAimGun() ? 1 : 0) - gun.aim) * (1 - Math.exp(-14 * dt));
  gun.cool = Math.max(0, gun.cool - dt); gun.kick = Math.max(0, gun.kick - dt * 5);
  if (gun.reload > 0) { if (!heldGun()) gun.reload = 0; else if ((gun.reload -= dt) <= 0) { gun.reload = 0; finishReload(); } }
  while (gun.shots.length && T - gun.shots[0].t > 1) gun.shots.shift();
  while (gun.copShots.length && T - gun.copShots[0].t > 1) gun.copShots.shift();
  while (pools.length && T - pools[0].t > POOL_T) pools.shift();
  for (let k = bodies.length - 1; k >= 0; k--) {
    const b = bodies[k];
    if (T - b.t > BODY_MAX || !simulated(b.x, b.y)) { removeBody(k); continue; }
    if (!b.amb && T - b.t > BODY_CALL && fract((T - b.t) / 5) < dt / 5 + 1e-9) b.amb = ambulanceFor(b);
    if (b.amb && !cars.includes(b.amb)) b.amb = null; // (gone back without them)
    if (b.amb && b.amb.state === 'out' && near(b.amb.x, b.amb.y, b.x, b.y) < 1.6) evArrive(b.amb); // (close enough: it pulls in here)
    if (b.amb && b.amb.state === 'scene' && near(b.amb.x, b.amb.y, b.x, b.y) < 3.5) {
      b.atT ||= T;
      if (T - b.atT > BODY_LOAD) { b.amb.until = Math.min(b.amb.until, T + 3); removeBody(k); }
    }
  }
  for (const c of cars) if (c.panicT && T > c.panicT) { c.rush = false; delete c.panicT; }
  if (!wanted.stars && T - gun.lastShotT > CALM_T) wanted.fired = false;
  return copsShoot(dt);
}
// an officer shooting at (dx, dy) away stands bladed to it, turned a little off square (and so you see the arms out)
const aimAt = (dx, dy) => { const an = Math.atan2(dy, dx) - 0.45; return [Math.cos(an), Math.sin(an)]; };
// a body under a sheet: the paramedics are there
const sheeted = o => bodies.some(b => b.who === o && b.atT && T - b.atT > 2.5);

// ---- the police, shooting back. Only after you've fired, only while they're after you, only with a clear look at you
function copsShoot(dt) {
  if (!wanted.fired || !wanted.stars || wanted.busted) return null;
  const inside = mode === 'room', [wx, wy] = crimePos(), driving = !!me && (mode === 'drive' || mode === 'taxi');
  const moving = driving ? Math.abs(me.v) : Math.hypot(body.mx || 0, body.my || 0);
  const shooters = inside ? roomCops.filter(c => !c.dead && c.sees).map(c => [c, Math.hypot(c.x - px, c.y - py) / 10]) // (a room's in metres)
    : mode === 'roof' ? roofCops.filter(c => !c.dead && c.sees).map(c => [c, near(c.x, c.y, px, py)])
    : [...footCops.filter(c => c.chase && !c.down), ...cars.filter(c => c.pursuit && !c.player && !c.wrecked)]
      .map(c => [c, near(c.x, c.y, wx, wy)]).filter(([c, d]) => d < COP_FIRE_R && lineOfSight(c.x, c.y, wx, wy)).sort((p, q) => p[1] - q[1]).slice(0, COP_GUNS);
  const live = new Set(shooters.map(s => s[0]));
  for (const c of [...footCops, ...cars, ...roomCops, ...roofCops]) if (c.fireT && !live.has(c)) delete c.fireT; // (lost sight: they'll take a moment to aim again)
  for (const [c, d] of shooters) {
    c.aimT = T + 1.2; // (drawn aiming at you: city-sprites.js)
    if (!c.fireT) { c.fireT = T + 0.7 + Math.random() * 0.8; continue; }
    if (T < c.fireT) continue;
    c.fireT = T + COP_FIRE_GAP[0] + Math.random() * (COP_FIRE_GAP[1] - COP_FIRE_GAP[0]);
    const odds = clamp(0.5 - d / COP_FIRE_R * 0.3 - Math.min(0.2, moving * 0.12) - body.crouch * 0.1 - (driving ? 0.15 : 0), 0.06, 0.5);
    const hit = Math.random() < odds;
    gun.copShots.push({ x: c.x, y: c.y, hit, t: T, room: inside, side: Math.random() < 0.5 ? -1 : 1 });
    if (!inside) panicAt(c.x, c.y);
    if (!hit) continue;
    if (driving) { damageCar(me, 7); if (Math.random() < 0.3) hurt(8); }
    else hurt(COP_HURT[0] + Math.random() * (COP_HURT[1] - COP_HURT[0]));
    gun.hurtT = T;
    if (needs.health <= 0) return 'down';
  }
  return null;
}
// taken off you: busted (the fine; jail takes everything anyway) or carried off to hospital
function confiscateGun() {
  let took = false;
  for (let k = inv.length - 1; k >= 0; k--) if (ITEMS[inv[k].id].kind === 'gun' || inv[k].id === 'ammo') { removeInventoryAt(k); took = true; }
  gun.reload = 0;
  return took;
}
