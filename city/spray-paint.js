'use strict';
// ---- freehand spray paint. Hold the can, face a wall, hold Q: paint goes where you're looking, a soft round dot with
// overspray round it, so moving your view draws lines. Closer to the wall the line is finer; Shift is the fat cap; R
// changes colour. Hold still too long and it runs. The can empties with how much you sprayStroke. Police still call it
// vandalism.
//
// The paint is plain data: dots [cell, face, u, z, r, colour, seed] on the faces of buildings (u: along the wall, in
// world coordinates; z: height, cells). Everything that paints goes through paintDots(), and every dot added goes out
// to PAINT_LISTENERS, so another player's spray can be applied with paintDots(theirDots, false) and yours sent on.

const SPRAY_COLOURS = [MAG, CYAN, GREEN, ORANGE, RED, YEL, WHITE, BLUE, BLACK];
const SPRAY_NAMES = ['magenta', 'cyan', 'green', 'orange', 'red', 'yellow', 'white', 'blue', 'black'];
const SPRAY_REACH = .4; // you can paint a wall up to 4m away
const PAINT_MAX = 12000; // dots kept citywide; past it the oldest go (the council scrubs them)
const PAINT_BUCKET = .05;
const sprayDots = []; // every dot, oldest first
let paintIndex = new Map(); // cell*4+face -> Map(bucket key -> dots)
const PAINT_LISTENERS = []; // fn(dots): called with each batch of dots you spray (for sending to other players)
const paintBucketKey = (u, z) => Math.floor(u / PAINT_BUCKET) * 4096 + Math.floor(z / PAINT_BUCKET);
function paintIndexDot(d) {
  const fk = d[0] * 4 + d[1];
  let face = paintIndex.get(fk);
  if (!face) paintIndex.set(fk, face = new Map());
  const bk = paintBucketKey(d[2], d[3]);
  let list = face.get(bk);
  if (!list) face.set(bk, list = []);
  list.push(d);
}
function reindexPaint() { paintIndex = new Map(); for (const d of sprayDots) paintIndexDot(d); }
// add dots (yours, or another player's with announce false); trims the oldest past the cap
function paintDots(dots, announce = true) {
  for (const d of dots) { sprayDots.push(d); paintIndexDot(d); }
  if (sprayDots.length > PAINT_MAX) { sprayDots.splice(0, sprayDots.length - PAINT_MAX + 500); reindexPaint(); }
  if (announce) for (const fn of PAINT_LISTENERS) try { fn(dots); } catch (e) { /* (a listener's problem, not the can's) */ }
}
const paintSave = () => sprayDots.map(d => [d[0], d[1], +d[2].toFixed(4), +d[3].toFixed(4), +d[4].toFixed(4), d[5], d[6]]);
function paintLoad(list) { sprayDots.length = 0; for (const d of list || []) if (Array.isArray(d) && d.length >= 7) sprayDots.push(d); if (sprayDots.length > PAINT_MAX) sprayDots.splice(0, sprayDots.length - PAINT_MAX); reindexPaint(); }

// the facade asks: paint on this cell of this face? (true if it painted the screen cell)
function paintCell(i, k, face, wc, z, uStep, d, L) {
  const faceDots = paintIndex.get(k * 4 + PAINT_FACE[face]);
  if (!faceDots) return false;
  const fp = Math.max(uStep, d / projY), bu = Math.floor(wc / PAINT_BUCKET), bz = Math.floor(z / PAINT_BUCKET);
  let hit = null;
  for (let du = -1; du <= 1; du++) for (let dz = -1; dz <= 1; dz++) {
    const list = faceDots.get((bu + du) * 4096 + bz + dz);
    if (list) for (const dot of list) {
      const r = dot[4], dist = Math.hypot(rel(wc - dot[2]), z - dot[3]);
      if (dist > r * 1.6 + fp * .5) continue;
      // the core is solid; the overspray round it is speckle, thinning outward (far off, averaged into a soft edge)
      let on = dist < r * .8;
      if (!on) {
        const t = (dist - r * .8) / (r * .8);
        on = fp > r * .5 ? t < .35 : hash(Math.floor(wc * 900), Math.floor(z * 900), dot[6]) > .35 + t * .65;
      }
      if (on) hit = dot; // (the last one sprayed is on top)
    }
  }
  if (!hit) return false;
  const lit = Math.max(L * 1.05, 4), col = SPRAY_COLOURS[hit[5]] ?? MAG;
  BG[i] = C(col, col === BLACK ? 1 + L * .05 : lit * (.62 + hash(Math.floor(wc * 300), Math.floor(z * 300), 4411) * .08));
  return set(i, ' ', 0), true;
}

// where the crosshair meets a wall you could paint: the cell, face, u along it and z up it, and how far off
function sprayAim() {
  if (mode !== 'walk' || !lookHit || lookHit.d > SPRAY_REACH) return null;
  const k = idx(lookHit.mx, lookHit.my);
  if (!map[k] || STY[k] >= 3 && STY[k] <= 6) return null; // (not the landmarks)
  const d = lookHit.d, hx = px + Math.cos(a) * d, hy = py + Math.sin(a) * d, fx_ = fract(hx), fy = fract(hy);
  const side = Math.min(fy, 1 - fy) < Math.min(fx_, 1 - fx_), face = faceOf(side, lookHit.mx, lookHit.my);
  const z = eye + (hor - (rows >> 1) - .5) * d / projY;
  if (z < .005 || z > map[k] - .005) return null; // (below the pavement, above the roofline)
  return { cell: k, face, faceIdx: PAINT_FACE[face], u: worldCoord(side ? hx : hy), z, d };
}
let sprayStroke = null; // the stroke in progress: { last: [u, z], cell, face, still, born, dist, hiss }
function sprayColourOf(it) { return it.col ?? (it.uses & 3); }
function sprayCycleColour() {
  const it = heldItem();
  if (it?.id !== 'spraypaint') return false;
  it.col = (sprayColourOf(it) + 1) % SPRAY_COLOURS.length;
  say(`The ${SPRAY_NAMES[it.col]} can.`, 1.2);
  return true;
}
function stepSprayPaint(dt) {
  const it = heldItem();
  if (it?.id !== 'spraypaint' || !K.KeyQ || wanted.busted) { sprayStroke = null; return; }
  const aim = sprayAim();
  if (!aim) { if (sprayStroke) sprayStroke.last = null; return; }
  const fat = K.ShiftLeft || K.ShiftRight, r = (.0025 + aim.d * .013) * (fat ? 2.3 : 1), col = sprayColourOf(it);
  if (!sprayStroke) { // a new stroke: is anyone watching?
    sprayStroke = { last: null, still: 0, born: T, dist: 0, hiss: 0, crimeT: T };
    const w = crime('graffiti', px, py);
    if (w === 'cop') say('"HEY! You! Drop the can!"', 3);
    else if (w === 'reported') say('Somebody across the street gets their phone out.', 3);
  }
  if (T - sprayStroke.crimeT > 6) { sprayStroke.crimeT = T; crime('graffiti', px, py); } // (a long session gets noticed again)
  const dots = [], seed = () => Math.floor(Math.random() * 1e6);
  const last = sprayStroke.last && sprayStroke.last.cell === aim.cell && sprayStroke.last.face === aim.face ? sprayStroke.last : null;
  const step = Math.max(.003, r * .35);
  if (last) {
    const du = rel(aim.u - last.u), dz = aim.z - last.z, len = Math.hypot(du, dz);
    if (len >= step) { // the line from the last dot to here, filled in so a quick sweep is still a line
      const n = Math.min(40, Math.ceil(len / step));
      for (let s = 1; s <= n; s++) dots.push([aim.cell, aim.faceIdx, worldCoord(last.u + du * s / n), last.z + dz * s / n, r, col, seed()]);
      sprayStroke.dist += len; sprayStroke.still = 0;
    } else sprayStroke.still += dt;
  } else dots.push([aim.cell, aim.faceIdx, aim.u, aim.z, r, col, seed()]);
  // held in one place, the paint pools and runs
  if (sprayStroke.still > .7 && (sprayStroke.drip = (sprayStroke.drip || 0) + dt) > .12) {
    sprayStroke.drip = 0;
    const run = Math.min(.09, (sprayStroke.still - .7) * .05);
    dots.push([aim.cell, aim.faceIdx, worldCoord(aim.u + (hash(Math.floor(aim.u * 99), 1, 4412) - .5) * r * .6), aim.z - r * .6 - run, r * .28, col, seed()]);
  }
  if (dots.length) {
    paintDots(dots);
    sprayStroke.last = { cell: aim.cell, face: aim.face, u: aim.u, z: aim.z };
  }
  if (actx && (sprayStroke.hiss -= dt) <= 0) { sprayStroke.hiss = .11; burst(actx.currentTime, .14, [filt('highpass', 3800, .7)], .06); } // psssss
  // the can empties: a can's worth is about 3 cells (30m) of line, fat cap faster
  it.paint = (it.paint ?? 1) - (dots.length ? (last ? Math.hypot(rel(aim.u - last.u), aim.z - last.z) : r) : 0) * (fat ? 2.2 : 1) / .5;
  while (it.paint <= 0 && it.uses > 0) { it.uses--; it.paint += 1; }
  if (it.uses <= 0) { removeHeld(); sprayStroke = null; say('The can sputters and rattles empty.', 2); }
}
