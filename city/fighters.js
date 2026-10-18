// ===== the interceptors: steal an aircraft and get it up, and before long the air force scrambles two fighters to
// shoot it down. They come in fast from far off, get on your tail and open up with their cannon in short bursts. A
// straight, level target is easy meat; one banked hard over and turning isn't, and the fighters, much faster, overshoot
// a tight turn and have to come round again. They won't fire down among the rooftops (below LOW_PASS over whatever's
// under you), so dragging them down low over the city is the other way to live. Land and stop, or get out, and they
// circle once and go home; after FIGHTER_FUEL seconds of it they have to go home anyway.
// Pure: stepFighters(target, dt, rnd) flies them against the aircraft you're in (or null) and returns what happened;
// aircraft-render.js draws them and their tracers, flight.js tells you about it.
const FIGHTER_T = { name: 'interceptor', fighter: true, len: 1.25, span: 0.85, r: 0.075, tail: 0.3, body: GRAY, stripe: GRAY, engines: 'jet', vr: 4, top: 13.5 };
const SCRAMBLE_T = 20; // seconds airborne in something stolen before they're on their way
const TRAIL = 3, FIGHTER_FUEL = 150, FIGHTER_TURN = 1.3, FIGHTER_FLOOR = 3, LOW_PASS = 1.6, GUN_RANGE = 12, GUN_CONE = 0.18, ROUND_DMG = 7, BREAK_T = 6;
const fighters = []; // { id, x, y, z, yaw, pitch, roll, v, wing (-1, 1: which side of the pair), cool, sixed }
const tracers = []; // { x, y, z, vx, vy, vz, t }
let scramble = 0, fighterHunt = 0, fighterCalm = 0; // seconds airborne stolen; seconds they've been on you; seconds with nothing to chase
const hunted = c => !!c && c.stolen && !c.owned && !c.wrecked && !c.ditched;
// how high a fighter has to stay over (x, y): its floor, and a cell clear of whatever's built there
const fighterFloor = (x, y) => Math.max(FIGHTER_FLOOR, (map[idx(Math.floor(x), Math.floor(y))] || 0) + 1.2, builtHeight(x, y) + 1.2);
function stepFighters(c, dt, rnd = Math.random) {
  const ev = [];
  if (hunted(c) && !c.ground && c.z > 0.8) scramble += dt; else if (!fighters.length) scramble = Math.max(0, scramble - dt * 0.5);
  if (!fighters.length && scramble > SCRAMBLE_T && hunted(c)) { // two of them, in from far off, side by side
    const k = rnd() * TAU;
    for (const wing of [-1, 1]) fighters.push({ id: 900 + fighters.length, x: mod(c.x + Math.cos(k) * 45 - Math.sin(k) * wing * 1.5, N), y: mod(c.y + Math.sin(k) * 45 + Math.cos(k) * wing * 1.5, N),
      z: Math.max(c.z, 6), yaw: k + Math.PI, pitch: 0, roll: 0, v: FIGHTER_T.top, wing, cool: 2 + rnd() * 2, sixed: false });
    fighterHunt = 0; fighterCalm = 0; ev.push('scramble');
  }
  for (let k = tracers.length - 1; k >= 0; k--) { const r = tracers[k]; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; if ((r.t -= dt) <= 0) tracers.splice(k, 1); }
  if (!fighters.length) return ev;
  // still a target? on the ground and stopped, or got out, or it's down: they hang about a few seconds, then go home
  const live = hunted(c) && !(c.ground && Math.abs(c.v) < 0.5) && !c.falling;
  fighterCalm = live ? 0 : fighterCalm + dt;
  if (live) fighterHunt += dt;
  const leaving = fighterCalm > BREAK_T || fighterHunt > FIGHTER_FUEL;
  if (leaving && !fighters.leaving) { fighters.leaving = true; ev.push(fighterHunt > FIGHTER_FUEL ? 'bingo' : 'breakoff'); }
  for (let k = fighters.length - 1; k >= 0; k--) {
    const f = fighters[k], fx = Math.cos(f.yaw), fy = Math.sin(f.yaw);
    let want = f.yaw, wantZ = f.z, wantV = FIGHTER_T.top;
    if (fighters.leaving) { wantZ = 9; const o = c || { x: px, y: py }; if (Math.hypot(rel(f.x - o.x), rel(f.y - o.y)) > 70) { fighters.splice(k, 1); continue; } }
    else if (c) { // the pursuit: at where it's going to be, a little to its own side of the pair; down to its height, never below the floor
      const cx = Math.cos(c.yaw), cy = Math.sin(c.yaw), cv = c.v || 0;
      const sit = TRAIL + f.wing * 0.6 + 0.6; // (a spot a few lengths behind it, one a little further back than the other)
      const tx = rel(c.x - cx * sit - cy * f.wing * 0.7 - f.x), ty = rel(c.y - cy * sit + cx * f.wing * 0.7 - f.y), d = Math.hypot(tx, ty);
      const onTo = (tx * fx + ty * fy) / (d || 1); // (heading for the spot, or past it and having to come round)
      want = Math.atan2(ty, tx); wantZ = c.z;
      wantV = onTo < 0.3 ? clamp(cv + 1.5, 6, FIGHTER_T.top) : clamp(cv + d * 0.6, 5, FIGHTER_T.top); // (closing fast, easing off to sit in behind; slower to come round)
      // the guns: close, nose on, and not down among the rooftops
      const rx = rel(c.x - f.x), ry = rel(c.y - f.y), rz = c.z - f.z, dist = Math.hypot(rx, ry, rz), off = Math.acos(clamp((rx * fx + ry * fy) / (Math.hypot(rx, ry) || 1), -1, 1));
      const low = c.z - builtHeight(c.x, c.y) - (map[idx(Math.floor(c.x), Math.floor(c.y))] || 0) < LOW_PASS;
      const behind = (rx * cx + ry * cy) / (Math.hypot(rx, ry) || 1) > 0.6; // (it's ahead of the fighter, going away: the fighter's on its six)
      if (dist < GUN_RANGE + 3 && behind && !f.sixed && live) { f.sixed = true; ev.push('six'); } else if (dist > GUN_RANGE + 6) f.sixed = false;
      if ((f.cool -= dt) <= 0 && live && dist < GUN_RANGE && off < GUN_CONE && Math.abs(rz) < 2.5) {
        f.cool = 1.6 + rnd() * 0.9;
        if (low) { ev.push('toolow'); f.cool += 2; }
        else {
          // a burst of six: each round's chance by the range, and how hard you're banked over and turning
          const p = clamp(0.5 - dist * 0.03 - Math.abs(c.roll || 0) * 0.55 - (PLANE_TYPES[c.type].heli ? 0.1 : 0), 0.02, 0.6);
          let hits = 0;
          for (let n = 0; n < 6; n++) {
            const hit = rnd() < p, sp = hit ? 0.04 : 0.25, s = 40, ax = rx / dist + (rnd() - 0.5) * sp, ay = ry / dist + (rnd() - 0.5) * sp, az = rz / dist + (rnd() - 0.5) * sp;
            tracers.push({ x: f.x + fx * 0.7, y: f.y + fy * 0.7, z: f.z, vx: ax * s, vy: ay * s, vz: az * s, t: Math.min(0.6, dist / s + 0.1) + n * 0.03 });
            if (hit) hits++;
          }
          if (hits) { damageCraft(c, hits * ROUND_DMG); ev.push('hit'); } else ev.push('miss');
          ev.push('guns');
        }
      }
    }
    // fly: turn toward it at its best rate (banking into the turn), climb or dive for the height, never under the floor
    const turn = clamp(mod(want - f.yaw + Math.PI, TAU) - Math.PI, -FIGHTER_TURN * dt, FIGHTER_TURN * dt);
    f.yaw += turn; f.roll += (clamp(turn / dt / FIGHTER_TURN, -1, 1) * 1.1 - f.roll) * Math.min(1, 3 * dt);
    f.v += clamp(wantV - f.v, -6 * dt, 3 * dt);
    const ahead = fighterFloor(f.x + Math.cos(f.yaw) * f.v * 0.8, f.y + Math.sin(f.yaw) * f.v * 0.8), floor = Math.max(fighterFloor(f.x, f.y), ahead);
    const vz = clamp((Math.max(wantZ, floor) - f.z) * 1.5, -3, 4);
    f.pitch += (Math.atan2(vz, f.v) - f.pitch) * Math.min(1, 3 * dt);
    f.x = mod(f.x + Math.cos(f.yaw) * f.v * dt, N); f.y = mod(f.y + Math.sin(f.yaw) * f.v * dt, N); f.z = Math.max(floor, f.z + vz * dt);
  }
  if (!fighters.length) { delete fighters.leaving; scramble = 0; ev.push('gone'); }
  return ev;
}
