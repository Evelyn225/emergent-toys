// ===== the Botanical Gardens (world.js lays them out, props.js plants the trees and puts up the railings): lawns,
// winding gravel paths, flower beds, a lake with ducks and swan boats you can rent, flamingos in the shallows, a
// tortoise pen and a sleeping bear, the glass conservatory (a jungle room with a waterfall, a desert room) and the
// aviary. Free in by day; the gates are locked 8pm to 8am (you can always let yourself out). Sit on the grass for a
// picnic, feed the ducks, work a shift with the gardeners.
const BOAT_FARE = 4;
const gardenLawn = (x, y) => { // grass you could sit down on
  if (!inGardens(x, y)) return false;
  const [gx, gy] = gardenLocal(x, y);
  return gardenPathDist(gx, gy) > 0.3 && gardenLakeEdge(gx, gy) < -0.2 && inBed(gx, gy) < 0 && !inPen(gx, gy, 0.1) && !gardenBuilt(gx, gy, 0.1);
};
const BED_PAL = [[MAG, WHITE, RED], [YEL, ORANGE, RED], [BLUE, MAG, WHITE], [RED, YEL, WHITE], [CYAN, BLUE, WHITE], [ORANGE, YEL, MAG], [MAG, RED, YEL]];

// ---- the ground
// sat down on the lawn: a picnic blanket under you, red and white check with a fringe, squared up with the way you
// face, from under you out in front (2.4m wide, 4m long: the near end's under you, out of sight); a wicker basket on it
const PICNIC_HALF = 0.12, PICNIC_LONG = 0.2, PICNIC_AHEAD = 0.18;
const picnicLocal = (wx, wy) => { // where (wx, wy) is on the blanket: [along, across], or null off it
  const s = body.seat;
  if (!s || !s.grass) return null;
  const dx = rel(wx - s.x), dy = rel(wy - s.y), along = dx * s.fx + dy * s.fy - PICNIC_AHEAD, across = -dx * s.fy + dy * s.fx;
  return Math.abs(along) < PICNIC_LONG && Math.abs(across) < PICNIC_HALF ? [along, across] : null;
};
function gardenFloor(i, r, x, wx, wy, L) { // true if it painted the cell itself; else [ch, base, k]
  const pic = picnicLocal(wx, wy);
  if (pic) {
    const [al, ac] = pic, edge = Math.min(PICNIC_LONG - Math.abs(al), PICNIC_HALF - Math.abs(ac));
    if (edge < 0.006) return set(i, (r + x) & 1 ? '|' : '\'', C(WHITE, L * 1.3)), true; // the fringe
    const red = (Math.floor((al + PICNIC_LONG) / 0.04) + Math.floor((ac + PICNIC_HALF) / 0.04)) & 1, stripe = Math.abs(fract((al + PICNIC_LONG) / 0.04) - 0.5) < 0.12 || Math.abs(fract((ac + PICNIC_HALF) / 0.04) - 0.5) < 0.12;
    BG[i] = red ? C(RED, 2 + L * 0.35) : C(WHITE, 2 + L * 0.3);
    return set(i, stripe ? '+' : red ? '#' : ':', red ? C(RED, L * 1.4) : C(WHITE, L * 1.2)), true;
  }
  const [gx, gy] = gardenLocal(wx, wy), e = gardenLakeEdge(gx, gy);
  if (onJetty(gx, gy)) return [Math.abs(gy - JETTY.gy) > JETTY.hw * 0.8 ? '|' : fract(gx * 6) < 0.2 ? '=' : '-', BRICK, 1.3];
  if (e > 0) { // the lake: ripples, lily pads near the edge, the sky in it
    const n = noise(wx * 3 + T * 0.2, wy * 3 - T * 0.1, 811), lily = e < 0.7 && hash(Math.floor(wx * 8), Math.floor(wy * 8), 812) > 0.88;
    set(i, lily ? 'o' : n > 0.62 ? '~' : n > 0.48 ? '-' : ' ', lily ? C(GREEN, L * 1.6) : C(n > 0.62 ? CYAN : BLUE, L * 1.5));
    BG[i] = C(BLUE, 1 + day * 2.5); FL[i] = 3;
    return true;
  }
  if (e > -0.18) return [(r + x) % 3 ? '|' : ',', GREEN, 0.9]; // reeds round the edge
  const pen = inPen(gx, gy);
  if (pen) { // the bear's: rough grass and boulders; the tortoises': sand
    if (pen.kind === 'tortoise') return [(r * 5 + x) % 4 ? '.' : ':', YEL, 0.9];
    const h = noise(wx * 4, wy * 4, 813);
    return h > 0.62 ? ['%', GRAY, 1.2] : h > 0.55 ? [':', BRICK, 1] : [(r * 3 + x) % 5 ? '"' : ',', GREEN, 0.85];
  }
  if (gardenPathDist(gx, gy) < 0.25) return [(r * 7 + x * 3) % 5 ? ':' : '.', WARM, 1.1]; // gravel
  const bed = inBed(gx, gy);
  if (bed >= 0) { // a flower bed: blooms in three colours, set out in rows
    const pal = BED_PAL[(bed + mod(dayNum, 7)) % BED_PAL.length], h = hash(Math.floor(wx * 14), Math.floor(wy * 14), 814 + bed);
    if (h > 0.35) { set(i, h > 0.8 ? '@' : '*', C(pal[h * 3 | 0], L * 1.7)); BG[i] = C(BRICK, 1 + day); return true; }
    return [',', GREEN, 0.9];
  }
  return [(r * 3 + x) % 4 ? '"' : ',', GREEN, 1.35]; // the lawns, greener than the park's
}

// ---- the glass houses from outside (STY 18 conservatory: iron and glass, palms pressing against it; 19 aviary: mesh)
function glassFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc, sty) {
  const L = fog * amb * (side ? 10 : 15), gh = GLASSHOUSES.find(g => g.sty === sty), glow = Math.max(night, overcast * 0.5);
  const [dgx, dgy] = gh.door, dx = GARDEN.x0 + dgx, dy = GARDEN.y0 + dgy, sgn = Math.sign(u * wc) || 1;
  const onDoorFace = side && Math.abs(rel((my + (rel(py - my) < 0 ? 0 : 1)) - dy)) < 0.01;
  if (onDoorFace && Math.abs(rel(wc - dx)) < 0.13 && z < 0.27) { // the doors
    if (Math.abs(rel(wc - dx)) > 0.12 || z > 0.26 || Math.abs(rel(wc - dx)) < 0.005) return set(i, '|', C(WHITE, L));
    BG[i] = C(sty === 18 ? GREEN : CYAN, 1 + glow * 2); return set(i, ':', C(WHITE, L * 0.5));
  }
  if (onDoorFace && Math.abs(z - 0.32) < 0.035 && wallText(i, u, uStep, z, d, gh.word, sgn * dx, 0.32, 0.045, 0.05, C(sty === 18 ? GREEN : CYAN, Math.max(L * 1.2, glow * 15)), C(WHITE, 2))) return;
  if (z > h - 0.03) return set(i, '^', C(WHITE, L)); // the crest along the ridge
  if (sty === 19 && (fract(u * 4) < 0.05 || fract(z * 4) < 0.04)) return set(i, '|', C(GRAY, L * 1.1)); // the aviary's frame
  if (sty === 18 && (fract(u * 8) < 0.07 || fract(z * 6) < 0.06)) { BG[i] = C(WHITE, 1 + L * 0.12); return set(i, fract(z * 6) < 0.06 ? '-' : '|', C(WHITE, L * 1.1)); } // glazing bars
  if (sty === 19 && ((Math.floor(u * 40) + Math.floor(z * 40)) & 1) && d < 1.5) return set(i, 'x', C(GRAY, L * 0.5)); // the mesh, close up
  return glassDepth(i, u, z, h, gh, side, L, glow, sty === 19);
}
// what's inside a glasshouse, in depth: three rows of plants one behind the other (palms and ferns, or the aviary's
// trees with birds among them), then the far glass, the soil, the roof. Each row sits at its own depth, so as you walk
// past they slide across each other
function glassDepth(i, u, z, h, gh, side, L, glow, aviary) {
  const sg = Math.sign(u * WH.wc) || 1, a0 = side ? GARDEN.x0 + gh.gx0 : GARDEN.y0 + gh.gy0, a1 = side ? GARDEN.x0 + gh.gx1 + 1 : GARDEN.y0 + gh.gy1 + 1;
  const u0 = Math.min(sg * a0, sg * a1), u1 = Math.max(sg * a0, sg * a1), dep = side ? gh.gy1 - gh.gy0 + 1 : gh.gx1 - gh.gx0 + 1;
  const b = boxBehind(u, z, u0, u1, 0, h, dep), [su, sz] = glassSlopes(u, z);
  for (let k = 0; k < 3; k++) {
    const q = dep * (0.12 + k * 0.28);
    if (q > b.q) break;
    const lu = u + su * q, lz = z + sz * q, fade = 1 - k * 0.25, seed = 870 + k * 3 + gh.sty;
    const slot = Math.floor(lu * 3), c = (slot + 0.3 + hash(slot, k, seed) * 0.4) / 3, tall = (0.35 + hash(slot, k, seed + 1) * 0.5) * h; // a plant every third of a cell, its trunk at c
    const trunk = Math.abs(lu - c) < 0.012 && lz < tall, crown = Math.hypot((lu - c) * 2.2, lz - tall) < 0.12 + 0.06 * noise(lu * 30, lz * 30, seed);
    const fern = lz < 0.12 + 0.08 * noise(lu * 12, k, seed + 2);
    if (aviary && Math.hypot((lu - c - 0.08 * Math.sin(T * 0.7 + slot)) * 3, lz - tall * 0.8 - 0.05 * Math.sin(T * 1.3 + slot)) < 0.02 && hash(slot, k, seed + 3) > 0.4)
      return set(i, fract(T * 4 + slot) < 0.5 ? 'v' : '^', C(BIRD_COL[slot & 7], 13)); // a bird darting between the trees
    if (crown || fern) { BG[i] = C(GREEN, (1.5 + glow * 2) * fade); return set(i, noise(lu * 40, lz * 40, seed + 4) > 0.5 ? '%' : aviary ? '@' : '"', C(GREEN, Math.max(L, glow * 10) * fade)); }
    if (trunk) return set(i, '|', C(BRICK, Math.max(L, glow * 8) * fade));
  }
  const sky = day > 0.3 ? C(CYAN, 1.5 + day * 2) : dusk > 0.3 ? C(ORANGE, 2) : C(BLUE, 1 + glow);
  if (b.s === 'floor') { BG[i] = C(aviary ? GREEN : BRICK, 1 + glow * 1.5); return set(i, (Math.floor(b.u * 30) + Math.floor(b.q * 30)) % 4 ? ' ' : ',', C(GREEN, L * 0.6)); }
  if (b.s === 'ceil') { BG[i] = sky; return set(i, fract(b.u * 2) < 0.06 || fract(b.q * 2) < 0.06 ? '=' : ' ', C(WHITE, L * 0.6)); }
  BG[i] = sky; // the far glass, the sky through it
  return set(i, fract(b.u * 2) < 0.04 || fract(b.z * 2) < 0.04 ? (aviary ? '+' : '|') : ' ', C(aviary ? GRAY : WHITE, L * 0.5));
}

// ---- solids: the railings (black iron, spear-topped), the gardeners' shed
SOLID_SHADE.railing = o => (i, t, L) => {
  const w = HIT.w, u = HIT.u;
  if (HIT.face === 5 || w > o.z1 - 0.02) return set(i, '^', C(GRAY, L * 1.2)), true;
  if (Math.abs(w - o.z1 * 0.85) < 0.008 || w < 0.01) return set(i, '=', C(GRAY, L)), true;
  return Math.abs(fract(u * 12) - 0.5) < 0.15 ? (set(i, '|', C(GRAY, L)), true) : false; // see-through between the bars
};
SOLID_SHADE.shed = () => (i, t, L) => {
  const f = HIT.face, w = HIT.w;
  BG[i] = C(f === 5 ? GREEN : BRICK, (1.5 + L * 0.3) * shadeFace(f));
  if (f === 5) return set(i, '=', C(GREEN, L)), true;
  if (f === 3 && Math.abs(HIT.u) < 0.08 && w < 0.2) { BG[i] = C(BRICK, 1); return set(i, w > 0.19 ? '-' : Math.abs(HIT.u) > 0.07 ? '|' : ' ', C(GRAY, L)), true; } // the door
  if (f === 3 && Math.abs(HIT.u - 0.22) < 0.06 && Math.abs(w - 0.15) < 0.04) return set(i, '#', C(YEL, Math.max(L, night * 12))), true; // the window
  return set(i, fract(HIT.u * 20 + HIT.v * 20) < 0.15 ? '|' : ' ', C(BRICK, L * 0.7)), true; // boards
};

// ---- animals, ducks and boats
const ANIMAL_ART = {
  flamingo: pad(['  _', ' (o>', '  )', ' //', ' |', '/|']),
  duck: pad(['  _', '<(o)__', ' (___/']),
  tortoise: pad(['  ____', ' /####\\_', '/_/  \\_\\o']),
  bear: pad(['   _    _', '  ( `--` )___', ' (  -  -     )', '  `----^-----`']),
  peacock: pad([' \\|||/', '-(*@*)-', '  /o>', '  ||']),
  swan: pad(['   __', '  (o >', '   \\\\', ' __||____', '(________)']),
};
const gw = (gx, gy) => [GARDEN.x0 + gx, GARDEN.y0 + gy];
const lakeSpot = (lo, hi, seed) => { // somewhere on the lake lo..hi cells in from the shore
  for (let k = 0; k < 400; k++) { const gx = LAKE.x + (hash(seed, k, 831) - 0.5) * LAKE.rx * 2, gy = LAKE.y + (hash(seed, k, 832) - 0.5) * LAKE.ry * 2, e = gardenLakeEdge(gx, gy); if (e > lo && e < hi && !onJetty(gx, gy)) return [gx, gy]; }
  return [LAKE.x, LAKE.y];
};
const flamingos = Array.from({ length: 5 }, (_, k) => { const [gx, gy] = lakeSpot(0.05, 0.45, 40 + k * 3); return { gx, gy, k }; }).filter(f => f.gy > LAKE.y - 0.5);
const ducks = Array.from({ length: 9 }, (_, k) => ({ k, gx: LAKE.x, gy: LAKE.y, ph: k * 0.7, r: 0.8 + (k % 3) * 0.8 }));
const tortoises = [0, 1, 2].map(k => ({ k, ph: k * 2.1 }));
const BOATS_PARKED = [[10.3, JETTY.gy - 0.36], [10.9, JETTY.gy - 0.36], [10.6, JETTY.gy + 0.36]];
let duckFeed = null, boat = null; // { gx, gy, t0 } while the ducks have something to swim over for; your swan boat
function stepGardens(dt) {
  for (const d of ducks) { // round the lake in little loops, or (fed) over to where the crumbs are landing
    const hx = LAKE.x + Math.cos(T * 0.05 + d.ph) * LAKE.rx * 0.45 + Math.cos(T * 0.3 + d.k) * 0.3 * d.r, hy = LAKE.y + Math.sin(T * 0.05 + d.ph) * LAKE.ry * 0.45 + Math.sin(T * 0.27 + d.k) * 0.3 * d.r;
    const fed = duckFeed && T - duckFeed.t0 < 18, tx = fed ? duckFeed.gx + Math.cos(d.k * 2.3) * 0.25 : hx, ty = fed ? duckFeed.gy + Math.sin(d.k * 2.3) * 0.25 : hy;
    const nx = d.gx + (tx - d.gx) * Math.min(1, dt * (fed ? 0.6 : 0.3)), ny = d.gy + (ty - d.gy) * Math.min(1, dt * (fed ? 0.6 : 0.3));
    if (gardenLakeEdge(nx, ny) > 0.08) { d.dir = nx > d.gx ? 1 : -1; d.gx = nx; d.gy = ny; }
  }
  // the bell at closing time
  const inside = inGardens(px, py) && mode === 'walk';
  if (inside && !gardensOpen(tod) && !stepGardens.rang) { stepGardens.rang = true; say('A bell rings: the Gardens are closing. You can still let yourself out.', 4); }
  if (gardensOpen(tod)) stepGardens.rang = false;
}
function gardenSprites() {
  const [cx, cy] = gw(GARDEN.w / 2, GARDEN.h / 2);
  if (Math.hypot(rel(cx - px), rel(cy - py)) > vis + 14) return;
  const art = (gx, gy, z, w, h, a, col) => { const [x, y] = gw(gx, gy); drawArt(rel(x - px), rel(y - py), z, w, h, a, col); };
  for (const f of flamingos) art(f.gx, f.gy, 0, 0.04, 0.13, Math.sin(T * 0.4 + f.k * 2) > 0.85 ? ANIMAL_ART.flamingo.map(l => l.replace('o>', 'o_')) : ANIMAL_ART.flamingo, (c, row, L) => row === 1 && c === '>' ? C(ORANGE, L) : C(MAG, Math.max(L, 6)));
  for (const d of ducks) art(d.gx, d.gy, 0, 0.035, 0.035, d.dir < 0 ? ANIMAL_ART.duck : ANIMAL_ART.duck.map(l => [...l].reverse().join('').replace(/</g, '>').replace(/\(/g, '#').replace(/\)/g, '(').replace(/#/g, ')').replace(/\//g, '\\')),
    (c, row, L) => row < 2 && c !== '<' && c !== '>' ? C(GREEN, L) : c === '<' || c === '>' ? C(YEL, L) : C(BRICK, L));
  const tp = GARDEN_PENS.find(p => p.kind === 'tortoise'), bp = GARDEN_PENS.find(p => p.kind === 'bear');
  for (const t of tortoises) art(tp.gx0 + 0.5 + (tp.gx1 - tp.gx0 - 1) * (0.5 + 0.45 * Math.sin(T * 0.015 + t.ph)), tp.gy0 + 0.6 + (tp.gy1 - tp.gy0 - 1.2) * (0.5 + 0.45 * Math.cos(T * 0.011 + t.ph * 1.7)), 0, 0.05, 0.035, ANIMAL_ART.tortoise, (c, row, L) => c === '#' ? C(BRICK, L) : C(GREEN, L));
  art((bp.gx0 + bp.gx1) / 2, (bp.gy0 + bp.gy1) / 2, 0, 0.22, 0.13, ANIMAL_ART.bear, (c, row, L) => C(BRICK, Math.max(L, 4)));
  art((bp.gx0 + bp.gx1) / 2 + 0.1, (bp.gy0 + bp.gy1) / 2, 0.14 + fract(T * 0.3) * 0.08, 0.025, 0.025, ['z'], () => C(WHITE, 12 * (1 - fract(T * 0.3)))); // zzz
  const pk = T * 0.02, pgx = 12 + Math.cos(pk) * 1.4, pgy = 6.2 + Math.sin(pk * 2) * 0.5; // the peacock, strutting about the middle lawn
  art(pgx, pgy, 0, 0.05, 0.1, ANIMAL_ART.peacock, (c, row, L) => row === 0 || c === '-' ? C(GREEN, L) : c === '*' || c === '@' ? C(CYAN, Math.max(L, 8)) : row === 1 ? C(BLUE, L) : C(BLUE, L));
  for (const [bx, by] of BOATS_PARKED) art(bx, by, 0, 0.1, 0.11, ANIMAL_ART.swan, (c, row, L) => c === '>' ? C(ORANGE, L) : C(WHITE, Math.max(L, 5)));
  for (let k = 0; k < (gardensOpen(tod) ? 2 : 0); k++) { // two boats out on the lake, being paddled round (by day)
    const th = T * 0.03 + k * 3, bgx = LAKE.x + Math.cos(th) * LAKE.rx * 0.55, bgy = LAKE.y + Math.sin(th) * LAKE.ry * 0.55;
    art(bgx, bgy, 0, 0.1, 0.11, ANIMAL_ART.swan, (c, row, L) => c === '>' ? C(ORANGE, L) : C(WHITE, Math.max(L, 5)));
    art(bgx, bgy, 0.06, 0.03, 0.06, ART.walkB.slice(0, 3), (c, row, L) => C(row < 2 ? SKIN : [RED, BLUE][k], L));
  }
  // the gates: iron, open by day, shut at night, and the name over the main one
  for (const [ggx, ggy, o] of GARDEN_GATES) {
    const [x, y] = gw(ggx, ggy), vx = rel(x - px), vy = rel(y - py), along = o === 'h';
    if (Math.hypot(vx, vy) > vis) continue;
    const iron = (i, t, L) => { BG[i] = C(GRAY, 1 + L * 0.1); return set(i, '|', C(GRAY, L * 1.2)), true; };
    for (const s of [-0.62, 0.62]) drawBox(boxAt(vx + (along ? s : 0), vy + (along ? 0 : s), 1, 0, 0.025, 0.025, 0, 0.26), iron);
    const shut = !gardensOpen(tod);
    for (const s of [-1, 1]) { // the two leaves: across the way, or swung back against the railings
      const lx = shut ? s * 0.3 : s * 0.62, ly = shut ? 0 : 0.3, gxo = along ? lx : ly * (ggx === 0 ? 1 : -1), gyo = along ? ly * (ggy === 0 ? 1 : -1) : lx;
      drawBox(boxAt(vx + gxo, vy + gyo, along === shut ? 1 : 0, along === shut ? 0 : 1, 0.3, 0.008, 0, 0.2), SOLID_SHADE.railing({ z1: 0.2 }));
    }
    if (ggy === 0) drawBox(boxAt(vx, vy, 1, 0, 0.66, 0.01, 0.24, 0.3), (i, t, L) => { // BOTANICAL GARDENS in iron letters over the north gate
      BG[i] = C(GREEN, 1 + L * 0.1);
      if (HIT.face !== 3 && HIT.face !== 4) return set(i, '=', C(GRAY, L)), true;
      const word = 'BOTANICAL GARDENS', n = word.length + 2, q = ((HIT.face === 3 ? HIT.u : -HIT.u) / 0.66 + 1) / 2 * n - 1;
      return set(i, signGlyph(word, q, (0.295 - HIT.w) / 0.05, t, 1.32 / n, 0.05, farDepth(vx, vy, 0.66)) || ' ', C(WHITE, Math.max(L * 1.2, night * 12))), true;
    });
  }
  // picnickers on the grass: a checked blanket, two people, a basket
  for (const [pgx2, pgy2, k] of [[16.5, 12.4, 1], [6.2, 8.6, 2], [18.6, 9.8, 3]]) {
    if (!gardensOpen(tod) || day < 0.3) continue;
    art(pgx2, pgy2, 0, 0.08, 0.012, ['########'], (c, row, L) => C((Math.floor(T * 0) + k) & 1 ? RED : WHITE, L));
    art(pgx2 - 0.04, pgy2 - 0.01, 0, 0.05, 0.1, ART.sitter, (c, row, L) => C(row < 3 ? SKIN : [YEL, BLUE, GREEN][k - 1], L));
    art(pgx2 + 0.05, pgy2 + 0.01, 0, 0.05, 0.1, ART.sitter, (c, row, L) => C(row < 3 ? SKIN : [MAG, RED, WHITE][k - 1], L));
  }
  if (body.seat && body.seat.grass) { // the picnic basket, on the blanket's far left corner
    const s = body.seat, al = PICNIC_AHEAD + PICNIC_LONG * 0.55, ac = -PICNIC_HALF * 0.55, bx = s.x + s.fx * al - s.fy * ac, by = s.y + s.fy * al + s.fx * ac;
    drawArt(rel(bx - px), rel(by - py), 0, 0.045, 0.04, PICNIC_BASKET, (c, row, L) => c === '#' ? C(RED, Math.max(L, 6)) : C(WARM, Math.max(L, 6)));
  }
  if (boat) return;
}
const PICNIC_BASKET = pad(['  .--.  ', ' /    \\ ', '|######|', '|%%%%%%|', '|%%%%%%|', "'------'"]);

// ---- out on the lake in a swan boat (mode 'boat')
const nearJettyFoot = () => mode === 'walk' && (() => { const [gx, gy] = gardenLocal(px, py); return inGardens(px, py) && Math.abs(gx - JETTY.gx0 - 0.25) < 0.45 && Math.abs(gy - JETTY.gy) < 0.45; })();
const nearShore = () => { if (mode !== 'walk' || !inGardens(px, py)) return false; const [gx, gy] = gardenLocal(px, py), e = gardenLakeEdge(gx + Math.cos(a) * 0.4, gy + Math.sin(a) * 0.4); return e > -0.2; };
const nearShed = () => mode === 'walk' && inGardens(px, py) && (() => { const [gx, gy] = gardenLocal(px, py); return Math.hypot(gx - GARDEN_SHED.gx, gy - GARDEN_SHED.gy + 0.45) < 0.5; })();
const gateShutHere = (x, y) => { // a closed gate, approached from outside: just the gate itself, across the gap
  if (gardensOpen(tod) || inGardens(px, py)) return false;
  const [gx, gy] = gardenLocal(x, y);
  return GARDEN_GATES.some(([ggx, ggy, run]) => run === 'h' ? Math.abs(gx - ggx) < 0.75 && Math.abs(gy - ggy) < 0.15 : Math.abs(gy - ggy) < 0.75 && Math.abs(gx - ggx) < 0.15);
};
function gardensPrompt() {
  if (mode === 'boat') { const [gx, gy] = [boat.gx, boat.gy]; return Math.hypot(gx - JETTY.gx1, gy - JETTY.gy) < 0.7 ? 'E: back to the jetty' : `W/S paddle, A/D steer${TOUCH ? '' : ''}   (back to the jetty to get out)`; }
  if (!inGardens(px, py) && mode === 'walk') {
    const [gx, gy] = gardenLocal(px + Math.cos(a) * 0.5, py + Math.sin(a) * 0.5);
    if (!gardensOpen(tod) && GARDEN_GATES.some(([ggx, ggy]) => Math.abs(gx - ggx) < 0.8 && Math.abs(gy - ggy) < 0.8)) return 'The gates are locked. The Gardens open at 8.';
    return '';
  }
  if (nearJettyFoot()) return gardensOpen(tod) ? `E: rent a swan boat (${fmt$(BOAT_FARE)})` : 'The boats are chained up for the night';
  if (nearShed()) return gardensOpen(tod) ? 'E: work a shift with the gardeners' : '';
  if (nearShore()) { const it = heldItem(); return it && ITEMS[it.id].kind === 'food' ? `E: feed the ducks (a bit of your ${ITEMS[it.id].name})` : 'The ducks paddle over, hopeful. (Hold some food to feed them)'; }
  return '';
}
function useGardens() { // true if E did something
  if (mode === 'boat') {
    if (Math.hypot(boat.gx - JETTY.gx1, boat.gy - JETTY.gy) < 0.7) { [px, py] = gw(JETTY.gx1 - 0.3, JETTY.gy); a = Math.PI; mode = 'walk'; boat = null; say('You tie the swan up and climb back onto the jetty.', 3); }
    else say('Paddle back to the end of the jetty to get out.', 2);
    return true;
  }
  if (nearJettyFoot()) {
    if (!gardensOpen(tod)) { say('Chained up till morning.'); return true; }
    if (!pay(BOAT_FARE)) { say(`A swan boat's ${fmt$(BOAT_FARE)}.`); return true; }
    boat = { gx: JETTY.gx1 + 0.3, gy: JETTY.gy, v: 0 }; mode = 'boat'; a = 0; pitch = 0;
    say('You step down into a swan boat. Pedal with W, steer with A and D.', 4);
    return true;
  }
  if (nearShed() && gardensOpen(tod)) { startGame('garden', 'shift'); say('"Grab a can. Water the dry ones, pull the weeds. Don\'t let anything die."', 4); return true; }
  if (nearShore()) {
    const it = heldItem();
    if (!it || ITEMS[it.id].kind !== 'food') { say('You wave at the ducks. They wanted bread.', 2); return true; }
    const [gx, gy] = gardenLocal(px + Math.cos(a) * 0.6, py + Math.sin(a) * 0.6);
    duckFeed = { gx, gy, t0: T };
    if (--it.uses <= 0) removeHeld();
    say(pick(['You throw some crumbs. The ducks race over, quacking.', 'A duck snatches the crumb right out of the air.', 'The ducks paddle over in a hurry. One climbs right out to get closer.']), 3);
    return true;
  }
  return false;
}
function stepBoat(dt) { // pedal and steer; the shore and the jetty stop you
  const f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), s = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  boat.v += (f * 0.25 - boat.v) * Math.min(1, dt * 1.5);
  a += s * dt * 0.9;
  const ngx = boat.gx + Math.cos(a) * boat.v * dt, ngy = boat.gy + Math.sin(a) * boat.v * dt;
  if (gardenLakeEdge(ngx, ngy) > 0.15 && !(Math.abs(ngy - JETTY.gy) < JETTY.hw + 0.12 && ngx < JETTY.gx1 + 0.05)) { boat.gx = ngx; boat.gy = ngy; } else boat.v = 0;
  [px, py] = gw(boat.gx, boat.gy);
}
function boatFrame() { // your swan's neck and head in front of you, its white sides at the bottom of the view
  const mid = cols >> 1, art = ['   __', '  (o >', '   \\ \\', '    \\ \\', '     ) )', '    / /'];
  art.forEach((l, k) => putText(rows - 10 + k, mid - 3, l, C(k === 1 && l.includes('>') ? WHITE : WHITE, 15)));
  putText(rows - 9, mid + 2, '>', C(ORANGE, 15));
  for (let r = rows - 3; r < rows; r++) for (let x = 0; x < cols; x++) { const i = r * cols + x; set(i, r === rows - 3 ? '_' : ' ', C(WHITE, 12)); BG[i] = C(WHITE, r === rows - 3 ? 0 : 5); FOGS[i] = FOGB[i] = 0; }
}

// ---- inside the conservatory: the tropical house (a waterfall into a pool, palms, butterflies, steam) and, through a
// glass door, the desert house (cacti, sand, rocks, a lizard on a warm stone)
const CONS_W = 26, CONS_H = 16;
const CONS_GRID = Array.from({ length: CONS_H }, (_, y) => Array.from({ length: CONS_W }, (_, x) => {
  if (y === CONS_H - 1 && (x === 6 || x === 7)) return 'D';
  if (x === 0 || y === 0 || x === CONS_W - 1 || y === CONS_H - 1) return '#';
  if (x === 13 && !(y >= 7 && y <= 8)) return 'G'; // the glass wall between the houses
  return '.';
}).join(''));
const CONS_POOL = { x: 6.5, y: 3.4, rx: 2.6, ry: 1.5 };
const inConsPool = (x, y) => Math.hypot((x - CONS_POOL.x) / CONS_POOL.rx, (y - CONS_POOL.y) / CONS_POOL.ry) < 1;
const PLANT_ART = {
  palm: pad(['  __ _ __', ' /  \\|/  \\', '/  .-+-.  \\', '    /|\\', '     |', '     |', '     |', '     |', '    /|\\']),
  fern: pad(['\\ | /', ' \\|/ ', '--+--', ' /|\\ ']),
  banana: pad([' \\\\ //', '  \\|/', '  (|)', '   |', '   |']),
  saguaro: pad(['    _', '   | |', ' _ | |', '| || | _', '|_|| || |', '   | ||_|', '   | |', '   | |']),
  barrel: pad([' .*. ', '(:::)', " `-' "]),
  agave: pad(['\\ | /', ' \\|/', '--+--']),
  butterfly: ['}{'], lizard: ['~=<'],
};
function conservatoryWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), c = roomAt(mx, my), jungle = mx < 13 || mx === 13 && false;
  if (c === 'G') { // the glass door wall: frame, panes, the other house through it, its name over the door
    const word = px < 13 ? 'DESERT HOUSE' : 'TROPICAL HOUSE', u0 = u < 7.5 ? 4 : 11;
    if (Math.abs(z - 3.3) < 0.2 && wallText(i, su, uStep, z, d, word, u0 * Math.sign(su), 3.3, 0.18, 0.3, C(WHITE, 14), C(px < 13 ? BRICK : GREEN, 3))) return true;
    if (fract(u / 1.2) < 0.05 || fract(z / 1.5) < 0.03 || z > 3.92) { BG[i] = C(WHITE, 2 + L * 0.15); return set(i, fract(z / 1.5) < 0.03 ? '-' : '|', C(WHITE, L * 1.2)), true; }
    // through the glass, the other house, in depth: rows of cacti on sand, or of palms in the green
    const streak = fract((u + z) * 0.35) < 0.025 && hash(Math.floor((u + z) * 0.35), 7, 866) > 0.5;
    if (streak) return set(i, '/', C(WHITE, 8)), true;
    const [gsu, gsz] = glassSlopes(su, z), desert = px < 13;
    for (const q of [1.5, 4, 7.5]) {
      const lu = u + gsu * q, lz = z + gsz * q, slot = Math.floor(lu / 1.8), c = (slot + 0.3 + hash(slot, q, 867) * 0.4) * 1.8, fade = 1 - q / 14;
      if (lz < 0) { BG[i] = desert ? C(YEL, 3 + day * 2) : C(GREEN, 1.5); return set(i, desert ? (Math.floor(lu * 4) + Math.floor(q)) % 7 ? ' ' : '.' : ',', C(desert ? WARM : GREEN, 6 * fade)), true; } // the ground
      if (hash(slot, q, 868) < 0.35) continue;
      if (desert) { // a saguaro: a trunk, and an arm or two
        const tall = 1.6 + hash(slot, q, 869) * 2, dx_ = lu - c, arm = Math.abs(dx_) > 0.1 && Math.abs(dx_) < 0.45 && (Math.abs(lz - tall * 0.55) < 0.08 && Math.sign(dx_) === (slot & 1 ? 1 : -1) || Math.abs(Math.abs(dx_) - 0.4) < 0.07 && lz > tall * 0.55 && lz < tall * 0.8 && Math.sign(dx_) === (slot & 1 ? 1 : -1));
        if (Math.abs(dx_) < 0.13 && lz < tall || arm) { BG[i] = C(GREEN, 2 * fade); return set(i, Math.abs(dx_) < 0.04 ? ':' : '|', C(GREEN, 9 * fade)), true; }
      } else { // a palm: a leaning trunk, a crown of fronds
        const tall = 3 + hash(slot, q, 869) * 3, lean = (lz / tall) * 0.4 * (slot & 1 ? 1 : -1);
        if (Math.hypot((lu - c - lean) * 0.8, lz - tall) < 0.9 + 0.4 * noise(lu * 3, lz * 3, 870)) { BG[i] = C(GREEN, 2.5 * fade); return set(i, noise(lu * 9, lz * 9, 871) > 0.5 ? '%' : '"', C(GREEN, 10 * fade)), true; }
        if (Math.abs(lu - c - lean) < 0.1 && lz < tall) return set(i, '|', C(BRICK, 9 * fade)), true;
      }
    }
    BG[i] = desert ? C(CYAN, 2 + day * 3) : C(GREEN, 1.2);
    return set(i, ' ', 0), true;
  }
  if (z < 0.8) { BG[i] = C(BRICK, 1 + L * 0.12); return set(i, fract(z / 0.2) < 0.15 ? '_' : fract(u * 2 + (Math.floor(z * 5) & 1) * 0.5) < 0.08 ? '|' : ' ', C(BRICK, L)), true; } // the brick plinth
  const left = mx < 13 || mx === 0;
  if (my === 0 && left && Math.abs(u - CONS_POOL.x) < 1.1) { // the waterfall, pouring down the rocks into the pool
    if (Math.abs(u - CONS_POOL.x) > 0.85) return set(i, '%', C(GRAY, L)), true;
    const n = fract(z * 3 + T * 2.5 + Math.sin(u * 7) * 0.3);
    BG[i] = C(CYAN, 2 + n * 3); return set(i, n < 0.3 ? '|' : n < 0.5 ? ':' : ' ', C(WHITE, 15)), true;
  }
  // glass all round: white bars, sky beyond, leaves pressed against it on the tropical side
  if (fract(u / 1.2) < 0.04 || fract(z / 1.5) < 0.03) { BG[i] = C(WHITE, 2 + L * 0.15); return set(i, fract(z / 1.5) < 0.03 ? '-' : '|', C(WHITE, L * 1.2)), true; }
  const leaf = left && noise(u * 1.5, z * 1.2, 841) > 0.5 - 0.35 * (1 - z / 9);
  if (!left) { // the city's towers beyond the glass, far off: they stay put against the sky as you walk about
    const [gsu, gsz] = glassSlopes(su, z), ang = Math.atan2(gsu, 1) + (mx === 0 || mx === CONS_W - 1 ? 1.6 * Math.sign(mx - 1) : my === 0 ? 0 : 3.1), col = Math.floor(ang * 14);
    if (gsz < 0.08 + 0.35 * hash(col, 1, 864) * hash(col >> 1, 2, 864)) { BG[i] = C(GRAY, 1.5 + day * 2); return set(i, night > 0.4 && hash(Math.floor(ang * 60), Math.floor(gsz * 60), 865) > 0.8 ? '.' : ' ', C(YEL, 12)), true; }
  }
  BG[i] = leaf ? C(GREEN, 1 + L * 0.1) : day > 0.3 ? C(CYAN, 2 + day * 4) : dusk > 0.3 ? C(ORANGE, 3) : C(BLUE, 1);
  return set(i, leaf ? (noise(u * 6, z * 6, 842) > 0.5 ? '%' : '"') : ' ', C(GREEN, L * 1.3)), true;
}
function conservatoryFloor(i, f, wx, wy) {
  if (wx > 13) { // sand, rippled by the wind that never blows in here
    BG[i] = C(YEL, 1 + f * 1.5);
    return set(i, fract(wy * 3 + Math.sin(wx * 2) * 0.3) < 0.2 ? '~' : hash(Math.floor(wx * 6), Math.floor(wy * 6), 843) > 0.92 ? '.' : ' ', C(WARM, 4 + f * 6));
  }
  if (inConsPool(wx, wy)) { const n = noise(wx * 3 + T * 0.5, wy * 3, 844); BG[i] = C(BLUE, 1 + f * 2); FL[i] = 3; return set(i, n > 0.6 ? '~' : n > 0.45 ? '-' : ' ', C(CYAN, 6 + f * 6)); }
  if (Math.abs(wx - 6.5) < 0.6 && wy > 5) { BG[i] = C(BRICK, 1 + f); return set(i, fract(wy * 2) < 0.15 ? '=' : '|', C(WARM, 5 + f * 6)); } // a boardwalk up from the door
  BG[i] = C(GREEN, f * 1.2); // moss and soil, steaming
  const mist = noise(wx * 0.8 + T * 0.1, wy * 0.8, 845) > 0.62;
  return set(i, mist ? '~' : hash(Math.floor(wx * 5), Math.floor(wy * 5), 846) > 0.6 ? '"' : '.', C(mist ? WHITE : GREEN, mist ? 5 : 3 + f * 5));
}
function glassCeil(i, wx, wy) { // the glass roof: ribs, the sky through it, vines hanging on the tropical side
  if (fract(wx / 2) < 0.05 || fract(wy / 2) < 0.05) { BG[i] = C(WHITE, 2 + day * 2); return set(i, '=', C(WHITE, 9)); }
  if (wx < 13 && noise(wx * 1.2, wy * 1.2, 847) > 0.6) { BG[i] = C(GREEN, 1); return set(i, '(', C(GREEN, 7)); }
  BG[i] = day > 0.3 ? C(CYAN, 2 + day * 5) : dusk > 0.3 ? C(ORANGE, 3) : C(BLUE, 0.5);
  return set(i, night > 0.5 && hash(Math.floor(wx * 5), Math.floor(wy * 5), 848) > 0.97 ? '.' : ' ', C(WHITE, 10));
}
// the aviary: a mesh dome, trees inside, a pond, birds everywhere; a keeper with cups of seed
const AV_W = 14, AV_H = 12;
let seedT = -99;
function aviaryWall(i, su, uStep, z, d, mx, my, L) {
  const u = Math.abs(su), m = (Math.floor(u * 25) + Math.floor(z * 25)) & 1;
  if (fract(u / 2) < 0.03 || fract(z / 1.75) < 0.03) return set(i, '|', C(GRAY, L)), true;
  const leaf = noise(u * 1.3, z * 1.3, 851) > 0.48 - 0.3 * (1 - z / 7);
  BG[i] = leaf ? C(GREEN, 1 + L * 0.1) : day > 0.3 ? C(CYAN, 2 + day * 4) : C(BLUE, 1);
  return set(i, m ? 'x' : ' ', C(GRAY, L * 0.45)), true;
}
const BIRD_COL = [RED, GREEN, BLUE, YEL, CYAN, ORANGE, MAG, WHITE];
function aviaryProps(r) {
  const p = [];
  for (const [x, y, s] of [[3, 3, 1.2], [10.5, 3.5, 1.4], [4, 8.5, 1], [11, 8, 1.1]]) p.push(SP(x, y, 1.2 * s, 4 * s, ART.tree, (c, row, L) => row > 4 ? C(BRICK, L) : C(GREEN, c === '%' ? L * 0.45 : L)));
  for (let k = 0; k < 16; k++) { // birds: loops round the dome, or (seed out) a flurry round you
    const big = k < 6, col = BIRD_COL[k & 7];
    p.push({ ...SP(7, 6, big ? 0.26 : 0.14, big ? 0.26 : 0.12, big ? ['  _', ' (o>', '//\\', 'V_/'] : ['v'], (c, row, L) => c === '>' ? C(YEL, 15) : C(col, Math.max(L, 10)), 3),
      tick: s => {
        const fed = T - seedT < 12, th = T * (0.4 + (k % 5) * 0.12) + k * 1.7;
        const tx = fed ? px + Math.cos(th * 2) * (1.4 + (k % 3) * 0.4) : 7 + Math.cos(th) * (2 + (k % 4) * 0.8), ty = fed ? py + Math.sin(th * 2) * (1.4 + (k % 3) * 0.4) : 6 + Math.sin(th) * (1.5 + (k % 3) * 0.6);
        s.x += (tx - s.x) * 0.05; s.y += (ty - s.y) * 0.05; s.z = fed ? 1.2 + Math.sin(th * 3) * 0.4 : 2 + Math.sin(th * 1.3) * 1.5;
        s.art = big ? (fract(T * 3 + k / 7) < 0.5 ? ['  _', ' (o>', '//\\', 'V_/'] : ['  _', ' (o>', '\\\\/', 'V_/']) : [fract(T * 6 + k / 5) < 0.5 ? 'v' : '^'];
      } });
  }
  p.push(...counterBox(11.5, 10, 0.8, 0.9), standing(11.5, 9.4, GREEN)); // the keeper with the seed
  if (chance(0.6)) p.push(standing(5.5, 6.5, shirt())); if (chance(0.5)) p.push(SP(8.5, 9, 0.4, 1.15, ART.keeper, (c, row, L) => C(row < 3 ? SKIN : row < 6 ? YEL : BLUE, L)));
  return p;
}
function aviaryFloor(i, f, wx, wy) {
  if (Math.hypot((wx - 7) / 2, (wy - 6) / 1.2) < 1) { BG[i] = C(BLUE, 1 + f * 2); FL[i] = 3; return set(i, noise(wx * 3 + T * 0.3, wy * 3, 852) > 0.6 ? '~' : ' ', C(CYAN, 5 + f * 6)); } // the pond
  if (Math.abs(wx - 7) < 0.5 && wy > 7.2) return set(i, ':', C(WARM, 4 + f * 6)); // the path in
  BG[i] = C(GREEN, f * 1.1); return set(i, (Math.floor(wx * 6) + Math.floor(wy * 6)) % 3 ? '"' : ',', C(GREEN, 4 + f * 5));
}
function conservatoryProps(r) {
  const p = [], plant = (k, x, y, w, h, col) => p.push(SP(x, y, w, h, PLANT_ART[k], col));
  const green = (c, row, L) => C(GREEN, L), palmCol = (c, row, L) => row < 4 ? C(GREEN, L) : C(BRICK, L);
  for (const [x, y, s] of [[2, 2, 1.3], [11, 2.2, 1.5], [2.2, 7, 1.2], [10.8, 6.5, 1.4], [3, 12, 1.1], [11, 12.4, 1.3], [8.8, 9.8, 1]]) plant('palm', x, y, 1.6 * s, 5 * s, palmCol);
  for (const [x, y] of [[4.6, 6], [9, 5.4], [1.6, 9.6], [10.5, 9.6], [4.2, 10.8], [8.6, 13.2], [2, 4.6], [11.6, 4.4]]) plant('fern', x, y, 0.8, 0.8, green);
  for (const [x, y] of [[5, 8.6], [8, 11.6], [12, 10.6]]) plant('banana', x, y, 0.8, 2.2, (c, row, L) => c === '(' || c === ')' ? C(YEL, L) : C(GREEN, L));
  for (const [x, y, s] of [[16, 3, 1], [20.5, 2.5, 1.3], [23.5, 5, 0.9], [18, 9, 1.2], [22.5, 11.5, 1], [16.5, 12.5, 0.8]]) plant('saguaro', x, y, 0.9 * s, 3.4 * s, (c, row, L) => C(GREEN, Math.max(L * 1.4, 7)));
  for (const [x, y] of [[15.2, 6], [19.4, 6.4], [24, 8.6], [17.6, 11.4], [21, 13.4], [14.8, 9.6]]) plant('barrel', x, y, 0.5, 0.5, (c, row, L) => c === '*' ? C(MAG, 15) : C(GREEN, L));
  for (const [x, y] of [[21.8, 7.6], [15.6, 13], [24, 2.4]]) plant('agave', x, y, 0.8, 0.7, (c, row, L) => C(CYAN, L * 0.9));
  for (const [x, y, w] of [[19.5, 4.4, 0.6], [23, 9.6, 0.8], [16.4, 7.4, 0.5]]) p.push(BX(x, y, w, w * 0.7, 0, w * 0.6, solid(BRICK, { top: '.', bright: 1.2 }))); // rocks
  p.push({ ...SP(19.5, 4.4, 0.25, 0.08, PLANT_ART.lizard, (c, row, L) => C(GREEN, 12), 0.42), tick: s => { s.x = 19.5 + Math.sin(T * 0.2) * 0.25; } }); // a lizard basking on a warm rock
  for (let k = 0; k < 10; k++) { const col = [YEL, ORANGE, BLUE, MAG, WHITE][k % 5]; // butterflies
    p.push({ ...SP(6, 8, 0.18, 0.1, ['}{'], (c, row, L) => C(col, 15), 1.2), tick: s => {
      const th = T * (0.5 + (k % 3) * 0.2) + k * 2.3;
      s.x = 6.5 + Math.cos(th) * (2 + k % 4) + Math.sin(th * 2.7) * 0.6; s.y = 7.5 + Math.sin(th * 0.8) * (2.5 + k % 3); s.z = 1 + Math.sin(th * 3.1) * 0.6 + (k % 3) * 0.5;
      s.art = [fract(T * 5 + k / 3) < 0.5 ? '}{' : '||']; } }); }
  p.push(BENCHP(4, 13.2, 0, -1), BENCHP(19, 13.2, 0, -1));
  if (chance(0.7)) p.push(standing(8.2, 8.4, shirt())); if (chance(0.6)) p.push(standing(18.5, 6.6, shirt()));
  return p;
}
Object.assign(ROOM_DEFS, {
  conservatory: { grid: CONS_GRID, spawn: [7, CONS_H - 1.6], light: 0.85, height: 9, floor: 'conservatory', ceil: 'glass', wall: conservatoryWall, block: (x, y) => inConsPool(x, y), props: conservatoryProps },
  aviary: { grid: boxRoom(AV_W, AV_H), spawn: [7, AV_H - 1.6], light: 0.85, height: 7, floor: 'aviary', ceil: 'glass', wall: aviaryWall, keeper: [11.5, 9.4], block: (x, y) => Math.hypot((x - 7) / 2, (y - 6) / 1.2) < 1, props: aviaryProps },
});
Object.assign(ROOM_FOR, { CONSERVATORY: 'conservatory', AVIARY: 'aviary' });
const aviaryKeeper = () => mode === 'room' && room.kind === 'aviary' && nearKeeper();
