// Kerb fixtures: fire hydrants, litter bins, mailboxes and bollards on the
// sidewalk's kerb line, where the lamps stand (CURB), clear of the walking line
// (0.12) and of everything already on the street. Placed on the finished
// city, so they're laid out on the assembled streets. Sizes in the models are
// metres; outdoors is 1/10 scale. {x, y, kind, c, s: along the kerb, fx, fy:
// the way it faces, hl, hw, h: its box, col, seed}
const KERB_KINDS = {
  hydrant: { hl: .024, hw: .024, h: .077 },
  bin: { hl: .027, hw: .027, h: .09 },
  mailbox: { hl: .023, hw: .029, h: .127 },
  bollard: { hl: .011, hw: .011, h: .091 },
  cabinet: { hl: .043, hw: .029, h: .141 },
};
const kerbs = [];
// Anything already standing on the sidewalk, with how far a fixture keeps from it.
function kerbCrowded(x, y, r) {
  const near = (list, gap) => list.some(o => Math.abs(rel(o.x - x)) < gap && Math.abs(rel(o.y - y)) < gap);
  const bx = Math.floor(x / 8), by = Math.floor(y / 8), around = b => { const out = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push(...b[bi(bx + i, by + j)]); return out; };
  return near(around(lampsB), r + .045) || near(around(treesB), r + .06) || near(around(benchesB), r + .2) || near(around(machinesB), r + .07)
    || near(around(lightsB), r + .05) || near(around(elPillarsB), r + .06) || near(around(kerbsB), r + .03)
    || near(vendors, r + .32) || near(stations, r + .3) || elStairLocal(x, y);
}
function kerbClear(o) {
  const cell = idx(Math.floor(o.x), Math.floor(o.y));
  if (!ROAD[cell] || isWater(o.x, o.y) || seaAt(o.x, o.y) || GAS_CELL[cell] || GAS_CELL[idx(Math.floor(o.x - o.fx * .4), Math.floor(o.y - o.fy * .4))]) return false;
  const box = { x: o.x, y: o.y, c: o.c, s: o.s, hl: o.hl, hw: o.hw, z0: 0, z1: o.h };
  return !streetGeometryCollision(box, true) && !kerbCrowded(o.x, o.y, Math.max(o.hl, o.hw));
}
const kerbsB = bucketed([]);
const KERB_REPORT = { tried: 0, placed: 0, moved: 0 };
function addKerb(x, y, kind, ax, ay, extra) {
  const k = KERB_KINDS[kind], c = Math.abs(ay), s = Math.abs(ax); // (the box runs along the kerb)
  const o = { x: worldCoord(x), y: worldCoord(y), kind, c, s, fx: ax, fy: ay, hl: k.hl, hw: k.hw, h: k.h, seed: hash(Math.floor(x * 10), Math.floor(y * 10), 1407), ...extra };
  KERB_REPORT.tried++;
  for (const along of [0, -.15, .15, -.3, .3]) {
    const sx = o.x, sy = o.y;
    o.x = worldCoord(x + c * along); o.y = worldCoord(y + s * along);
    if (kerbClear(o)) { kerbs.push(o); kerbsB[bi(Math.floor(o.x / 8), Math.floor(o.y / 8))].push(o); KERB_REPORT.placed++; if (along) KERB_REPORT.moved++; return o; }
    o.x = sx; o.y = sy;
  }
  return null;
}
// Down each side of each street: a hydrant near the corner, a bin beside the
// first lamp, now and then a mailbox beside the second, and a row of bollards
// in front of a landmark. (ax, ay) points from the buildings into the road;
// hydrant outlets face the road, mailboxes face the people walking past.
for (const o of [CURB, 2 - CURB]) {
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) for (const ori of ['h', 'v']) {
    if (!(ori === 'h' ? hseg(bx, by) : vseg(bx, by))) continue;
    const ax = ori === 'v' ? (o < 1 ? 1 : -1) : 0, ay = ori === 'h' ? (o < 1 ? 1 : -1) : 0;
    const at = s => ori === 'h' ? [bx * 8 + s, by * 8 + o] : [bx * 8 + o, by * 8 + s];
    const [lx, ly] = at(5), lot = [lx - ax * .6, ly - ay * .6], dist = districtAt(...lot), r = n => hash(bx * 2 + (o < 1 ? 0 : 1), by * 2 + (ori === 'h' ? 0 : 1), n);
    if (blockKind(Math.floor(lot[0] / 8), Math.floor(lot[1] / 8)) === 'park' && r(1400) < .7) continue;
    if (r(1401) < (dist === 'industrial' ? .6 : .4)) addKerb(...at(2.6), 'hydrant', ax, ay, { col: dist === 'industrial' ? YEL : RED });
    if (dist !== 'industrial' && r(1402) < ({ downtown: .75, chinatown: .75, shotengai: .8 }[dist] || .55))
      addKerb(...at(3.85), 'bin', ax, ay, { col: ['chinatown', 'downtown'].includes(dist) ? GREEN : GRAY });
    if (!['industrial', 'belle'].includes(dist) && r(1403) < .22) addKerb(...at(6.85), 'mailbox', -ax, -ay, { col: dist === 'shotengai' ? RED : BLUE });
    if (dist !== 'belle' && r(1405) < .12) addKerb(...at(6.2), 'cabinet', -ax, -ay, { col: GREEN, telecom: true }); // a telecom cabinet
    if (landmarkOf.has(bi(Math.floor(lot[0] / 8), Math.floor(lot[1] / 8))) || dist === 'downtown' && r(1404) < .12)
      for (let k = 0; k < 5; k++) addKerb(...at(4.6 + k * .2), 'bollard', ax, ay, {});
  }
}
// on foot, they're solid; a kicked ball stops at them too
function kerbAt(x, y, pad) {
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const o of kerbsB[bi(Math.floor(x / 8) + i, Math.floor(y / 8) + j)]) {
    const qx = rel(x - o.x), qy = rel(y - o.y);
    if (Math.abs(qx * o.c + qy * o.s) < o.hl + pad && Math.abs(-qx * o.s + qy * o.c) < o.hw + pad) return o;
  }
  return null;
}
// A signal controller cabinet at most junctions: on the kerb beside the first
// signal pole, half a cell back from the corner, its doors to the pavement.
{
  const done = new Set();
  for (const l of lights) {
    const ix = Math.floor(l.bx / 8), iy = Math.floor(l.by / 8), key = bi(ix, iy);
    if (done.has(key) || hash(ix, iy, 1406) > .6) continue;
    const e = l.vert ? mod(l.x, 8) : mod(l.y, 8), ax = l.vert ? (e < 1 ? 1 : -1) : 0, ay = l.vert ? 0 : (e < 1 ? 1 : -1);
    const away = Math.sign(l.vert ? l.y - (l.by + 1) : l.x - (l.bx + 1)) || 1;
    if (addKerb(l.vert ? l.x : l.x + away * .5, l.vert ? l.y + away * .5 : l.y, 'cabinet', -ax, -ay, { col: GRAY, signal: true })) done.add(key);
  }
}
