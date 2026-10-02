// ===== city sprites: everything drawn over the raycast scene, nearest-first order doesn't matter (drawArt depth-tests)
// visit the props in the blocks within draw distance
function forNear(b, fn) {
  const r = Math.ceil(vis / 8) + 1, cx = Math.floor(px / 8), cy = Math.floor(py / 8);
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) for (const it of b[bi(cx + i, cy + j)]) fn(it);
}
const R = (x, y) => [rel(x - px), rel(y - py)];
// how much a world direction (ax, ay) lies across our view of a point at (vx, vy): +1 = pointing right on screen
const across = (ax, ay, vx, vy) => { const n = Math.hypot(vx, vy) || 1; return (ax * -vy + ay * vx) / n; };
const FERRY = pad(['   _|_ _|_', ' _|o_o_o_o|___', '|o o o o o o o|', '\\_____________/']);
const PILLAR = pad(['[=]', '|#|', '|#|', '|#|', '|#|', '|#|', '|#|', '/#\\']);
const EL_STAIRS = pad(['[ EL ]', '    _|', '   _| ', '  _|  ', ' _|   ', '_|    ']);
const DOG = pad(['  __', '(o_ \\_', ' /\\ /\\']);
let siren = null; // the emergency vehicle in sight, if any: floorCell washes its lights over the street

function citySprites() {
  forNear(treesB, t => drawArt(...R(t.x, t.y), 0, 0.45 * t.s, 0.6 * t.s, ART.tree,
    (c, row, L) => row > 4 ? C(BRICK, L) : C(GREEN, c === '%' ? L * 0.45 : c === '@' ? L * 0.8 : L)));
  forNear(benchesB, b => drawArt(...R(b.x, b.y), 0, 0.15, 0.05, ART.bench, (c, row, L) => C(BRICK, L)));
  for (const b of boats) {
    const x = b.x0 + T * b.sp, y = b.y + Math.sin(T * 0.05 + b.ph) * 2, [vx, vy] = R(x, y);
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    const lit = (c, L) => C(YEL, Math.max(L, night * 15));
    if (b.kind === 'sail') drawArt(vx, vy, 0, 0.6, 0.9, ART.sail, (c, row, L) => C(row < 4 ? WHITE : BRICK, L));
    else if (b.kind === 'tug') drawArt(vx, vy, 0, 0.7, 0.45, ART.tug, (c, row, L) => c === 'o' ? lit(c, L) : C(row === 0 ? GRAY : RED, L));
    else drawArt(vx, vy, 0, 1.6, 0.6, FERRY, (c, row, L) => c === 'o' ? lit(c, L) : C(row < 2 ? WHITE : row === 2 ? BLUE : GRAY, L));
  }
  forNear(extrasB, o => drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, o.col));
  for (const v of vendors) {
    const t = v.type, frame = t.art[(T * 2 | 0) & 1];
    drawArt(...R(v.x, v.y), 0, t.w, 0.22, frame, (c, row, L) =>
      c === '~' ? C(WHITE, L * 0.6) : row < 3 && /[A-Z]/.test(c) ? C(WHITE, Math.max(L, night * 15)) :
      row < 3 ? C(t.color, Math.max(L, night * 12)) : c === 'O' ? C(GRAY, L * 0.5) : C(t.color, L));
    drawArt(...R(v.x + v.ox, v.y + v.oy), 0, 0.06, 0.18, ART.walkB, (c, row, L) => C(row < 2 ? SKIN : row === 2 ? v.shirt : GRAY, L));
  }
  for (const s of stations)
    drawArt(...R(s.x, s.y), 0, s.w, 0.45, s.art, (c, row, L) => row === 0 ? C(GREEN, c === 'M' ? 15 : L) : row === 1 ? C(WHITE, Math.max(L, 12)) : C(GRAY, L));
  forNear(roofsB, o => {
    const blink = fract(T * 0.8 + o.x) < 0.5;
    drawArt(...R(o.x, o.y), o.z, o.w, o.h, o.art, (c, row, L) =>
      o.kind === 'antenna' ? (c === '*' ? C(RED, blink ? 15 : 3) : C(GRAY, L)) :
      o.kind === 'tank' ? C(c === '=' ? GRAY : BRICK, L) :
      row === 1 && c !== '|' ? C(o.neon, Math.max(L, night * 15)) : C(GRAY, L));
  });
  for (const k of cranes) {
    const [vx, vy] = R(k.x, k.y);
    if (Math.abs(vx) > vis + 5 || Math.abs(vy) > vis + 5) continue;
    // the jib slews slowly; p = how much of it faces sideways to us (+ = reaching right on screen)
    const th = k.slew + T * 0.03, p = across(Math.cos(th), Math.sin(th), vx, vy);
    drawShape(vx, vy, 0, 5, k.H + 0.8, (i, u, z, du, dz, L) => craneCell(i, u, z, du, dz, L, k, p));
  }
  for (const s of stacks) {
    const [vx, vy] = R(s.x, s.y);
    if (Math.abs(vx) < vis && Math.abs(vy) < vis) drawShape(vx, vy, s.z, 1.6, s.H + 2.2, (i, u, z, du, dz, L) => stackCell(i, u, z, du, dz, L, s));
  }
  forNear(lampsB, ({ x, y, ax, ay }) => {
    const [vx, vy] = R(x, y), depth = dx * vx + dy * vy;
    if (depth < 0.05 || depth > vis) return;
    const s = across(ax, ay, vx, vy); // arm across our view: +1 reaching right
    drawShape(vx, vy, 0, REACH + 0.08, LAMP_TOP + NECK + 0.03, (i, u, z, du, dz, L) => lampCell(i, u, z, du, dz, L, s));
  });
  forNear(lanternsB, l => {
    const [vx, vy] = R(l.x, l.y), s = Math.abs(across(l.ax, l.ay, vx, vy));
    drawShape(vx, vy, 0.3, 0.95 * s + 0.04, 0.22, (i, u, z, du, dz, L) => lanternCell(i, u, z, du, dz, L, 0.95 * s + 0.04));
  });
  const LC = { G: GREEN, Y: YEL, R: RED };
  forNear(lightsB, s => {
    const col = C(LC[light(s.bx, s.by, s.vert, T)], 15);
    drawArt(...R(s.x, s.y), 0, 0.05, 0.4, ART.signal, (c, row, L) => c === 'O' ? col : C(GRAY, L));
  });
  bridgeSprites();
  elSprites();
  siren = null;
  for (const m of cars) {
    if ((m.player || m.rider) && !chaseOn) continue; // first person: you're inside it
    const [vx, vy] = R(m.ex, m.ey), hx = m.hx, hy = m.hy;
    if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
    const dot = (hx * vx + hy * vy) / Math.hypot(vx, vy), arts = VEHICLE_ART[m.kind], big = m.kind === 'fire' ? 1.3 : 1;
    let art = arts[0], w = 0.2 * big;
    if (dot < -0.75) art = arts[1];
    else if (dot <= 0.75) { art = hx * -vy + hy * vx > 0 ? arts[2] : arts[3]; w = (0.2 + 0.25 * Math.sqrt(1 - dot * dot)) * big; }
    const lights_ = night > 0.4 || overcast > 0.5 ? 15 : 9, taxi = m.kind === 'taxi';
    if (m.ev && Math.hypot(vx, vy) < vis) siren = m;
    drawArt(vx, vy, 0, w, 0.15 * big, art, (c, row, L) =>
      c === '*' ? C(fract(T * 2.5) < 0.5 === (row & 1 ? true : false) ? RED : BLUE, 15) : // the light bar
      row === 0 && taxi && c !== '_' ? C(c === '[' || c === ']' ? GRAY : YEL, 15) :
      c === 'O' ? C(WHITE, lights_) : c === ']' || c === '[' ? C(RED, m.brake || m.v < 0.05 ? 15 : 8) :
      c === '+' ? C(RED, Math.max(L, 10)) : c === '#' ? C(CYAN, L * 0.5) : c === '@' ? C(GRAY, L * 0.4) : C(m.body, L));
  }
  for (const m of people) if (!m.hidden)
    drawArt(...R(m.x, m.y), 0, 0.06, 0.18, (m.ph | 0) % 2 ? ART.walkA : ART.walkB,
            (c, row, L) => C(row < 2 ? SKIN : row === 2 ? m.shirt : m.pants, L));
  if (task && task.kind === 'dog') drawArt(...R(task.dog.x, task.dog.y), 0, 0.07, 0.05, DOG, (c, row, L) => C(BRICK, L * 1.2));
}

// a classic street lamp: a tall fluted pole, a swan neck curving out over the street, a lantern hanging from its end.
// Drawn from measurements, so the curve stays one character thick at any distance; s squashes the neck sideways
// when the arm points toward or away from you, so it turns smoothly as you walk round it.
const LAMP_TOP = 0.95, NECK = REACH / 2; // pole height; the neck is a half circle of radius NECK
function lampCell(i, u, z, du, dz, L, s) {
  const lit = lampsOn > 0.3, steel = C(GRAY, L * 1.1), hx = 2 * NECK * s, lu = u - hx, lz = z - (LAMP_TOP - 0.09);
  // the lantern: a cap, a glass body glowing after dark, a finial underneath
  if (Math.abs(lu) < Math.max(0.03, du * 0.75) && z < LAMP_TOP - 0.03 && z > LAMP_TOP - 0.14) {
    if (z > LAMP_TOP - 0.055) return set(i, Math.abs(lu) < Math.max(0.015, du / 2) ? '^' : '_', steel), true;
    if (z < LAMP_TOP - 0.125) return set(i, 'v', steel), true;
    if (lit) BG[i] = C(WARM, 4 + lampsOn * 4);
    return set(i, lit ? '#' : ':', lit ? C(WARM, 15) : C(GRAY, L * 0.7)), true;
  }
  if (z <= LAMP_TOP && z > LAMP_TOP - 0.03 && onLine(lu, du, 0, 0)) return set(i, '|', steel), true; // the drop
  const halo = Math.hypot(lu / 0.075, lz / 0.065);
  if (lit && halo < 1) { BG[i] = C(WARM, 1 + lampsOn * 2 * (1 - halo)); return set(i, " ", 0), true; } // a soft glow round it
  // the pole: a flared base, a collar, a finial on top
  if (z < LAMP_TOP + 0.02 && Math.abs(u) < Math.max(du / 2, z < 0.06 ? 0.03 : 0.012)) {
    if (z < 0.06) return set(i, z < 0.025 ? '#' : 'A', steel), true;
    return set(i, Math.abs(z - 0.42) < Math.max(0.012, dz / 2) ? '=' : '|', steel), true;
  }
  // the swan neck: the upper half of an ellipse from the pole top out to the lantern
  const w = NECK * Math.abs(s);
  if (w > du * 0.3 && z > LAMP_TOP - dz) {
    const ex = (u - NECK * s) / w, ez = (z - LAMP_TOP) / NECK, rho = Math.hypot(ex, ez), tol = Math.max(du / w, dz / NECK) / 2;
    if (Math.abs(rho - 1) < tol && ez > -tol) {
      const ang = Math.atan2(ez, ex), tu = -w * Math.sin(ang) / du, tz = NECK * Math.cos(ang) / dz; // tangent, in cells
      const sl = Math.abs(tz) / (Math.abs(tu) + 1e-9);
      return set(i, sl > 2.5 ? '|' : sl < 0.4 ? '-' : tu * tz > 0 ? '/' : '\\', steel), true; // rising to the right: '/'
    }
  }
  return false;
}

// chinatown lanterns: a string sagging across the street, red paper lanterns hanging off it, glowing after dark.
// hw = how wide the string looks from here
function lanternCell(i, u, z, du, dz, L, hw) {
  const t = u / hw, sag = 0.2 - 0.06 * (1 - t * t); // z is measured up from the shape base (0.3)
  if (Math.abs(t) > 1) return false;
  for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) if (Math.abs(u - k * hw) < Math.max(du, 0.035) && z < sag && z > sag - 0.05)
    return set(i, z > sag - 0.025 ? 'O' : 'o', C(k === 0 ? YEL : RED, Math.max(L, night * 15))), true;
  if (onLine(z - sag, dz, du, 0.12 * Math.abs(t) / hw)) return set(i, '-', C(GRAY, L * 0.7)), true;
  return false;
}

// a factory smokestack: banded brick, red and white at the top, smoke curling off downwind
function stackCell(i, u, z, du, dz, L, s) {
  const H = s.H, w = 0.16 - z / H * 0.05;
  if (z < H && Math.abs(u) < Math.max(w, du / 2)) {
    BG[i] = bgAt(BRICK, day * 2);
    if (z > H - 0.5) return set(i, '=', C(fract(z * 4) < 0.5 ? RED : WHITE, L)), true;
    return set(i, fract(z * 6) < 0.15 ? '=' : '#', C(BRICK, L * 0.9)), true;
  }
  const sz = z - H, cu = u - sz * 0.6 - Math.sin(T * 0.3 + s.x) * 0.1 * sz; // drifts downwind as it rises
  if (sz > 0 && sz < 2 && Math.abs(cu) < 0.15 + sz * 0.25) {
    const n = noise(cu * 4 + T * 0.2, sz * 3 - T * 0.6, 57 + s.x);
    if (n > 0.45 + sz * 0.15) { BG[i] = C(GRAY, (2 + n * 6) * (0.4 + 0.6 * amb) * (1 - sz / 2.2)); return set(i, ' ', 0), true; }
  }
  return false;
}

// the suspension bridges: towers (drawn across the deck, foreshortened when seen from the side), cables as a chain of
// points that light up at night, and the hangers down to the deck
function bridgeSprites() {
  for (const t of towers) {
    const [vx, vy] = R(t.x, t.y);
    if (Math.abs(vx) > vis + 2 || Math.abs(vy) > vis + 2) continue;
    const hw = 0.95 * Math.abs(across(1, 0, vx, vy)) + 0.12;
    drawShape(vx, vy, 0, hw + 0.15, TOWER_H + 0.5, (i, u, z, du, dz, L) => towerCell(i, u, z, du, dz, L, hw));
  }
  forNear(bridgeB, b => {
    const [vx, vy] = R(b.x, b.y);
    if (b.kind === 'hanger') return drawArt(vx, vy, b.z, 0.02, b.h, ['|'], (c, row, L) => C(GRAY, L * 0.7));
    drawArt(vx, vy, b.z - 0.03, 0.06, 0.06, [night > 0.4 ? '*' : '.'], (c, row, L) => night > 0.4 ? C(WARM, 13) : C(GRAY, L * 1.2));
  });
}
function towerCell(i, u, z, du, dz, L, hw) {
  const leg = Math.abs(Math.abs(u) - hw) < Math.max(0.1, du / 2);
  if (z > TOWER_H + 0.35 && Math.abs(Math.abs(u) - hw) < du && night > 0.3) return set(i, '*', C(RED, fract(T * 0.7) < 0.5 ? 15 : 4)), true;
  if (leg && z < TOWER_H + 0.4) { BG[i] = bgAt(GRAY, day * 3); return set(i, fract(z * 3) < 0.1 ? '=' : '|', C(GRAY, L * 1.1)), true; }
  if (Math.abs(u) < hw && [1.2, 4, TOWER_H].some(b => Math.abs(z - b) < Math.max(0.12, dz / 2)))
    return set(i, Math.abs(z - TOWER_H) < 0.12 ? '#' : '=', C(GRAY, L)), true;
  return false;
}

// the el: pillars, stairs at the stations, and the trains (cars drawn one by one, so they foreshorten properly)
function elSprites() {
  forNear(elPillarsB, p => drawArt(...R(p.x, p.y), 0, 0.09, EL_BOT, PILLAR, (c, row, L) => C(GRAY, L * 0.9)));
  for (const s of EL_STATIONS) for (const y of [EL_Y + 0.14, EL_Y + 1.86])
    drawArt(...R(s.x, y), 0, 0.22, EL_BOT - 0.02, EL_STAIRS, (c, row, L) => row === 0 ? C(GREEN, Math.max(L, 12)) : C(GRAY, L));
  for (const t of elTrains(T)) {
    if (mode === 'el' && ride && ride.tr === t.tr && ride.k === t.k) continue; // the one you're on
    for (let j = 0; j < EL_CARS; j++) {
      const [vx, vy] = R(t.x - t.dir * (j - 1) * EL_CAR_LEN, EL_TRACK[t.tr]);
      if (Math.abs(vx) > vis || Math.abs(vy) > vis) continue;
      const s = Math.abs(across(1, 0, vx, vy)), side = s > 0.3;
      drawArt(vx, vy, EL_TOP, side ? EL_CAR_LEN * s + 0.18 : 0.2, 0.3, side ? ART.elSide : ART.elEnd, (c, row, L) =>
        c === '#' ? C(WARM, Math.max(L * 0.8, night * 14)) : c === 'o' ? C(WHITE, 14) : row === 2 ? C(RED, L) : C(GRAY, L * 1.1));
    }
  }
}
