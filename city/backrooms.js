// ===== the backrooms. Down one of the industrial district's back lanes, low on a blank stretch of wall, there's a seam
// in the shape of a doorframe. Nothing says so; walk into it and you're through: mono-yellow wallpaper, damp carpet,
// strip lights humming in a dropped ceiling, room after empty room, corridor after corridor, 73m each way and winding.
// The only way out is the seam you came in by.

// the seam: on the west face of a building cell (x, cy) that backs onto a lane, its middle at y; null if no lane fits
const BACKROOMS_SEAM = (() => {
  for (const pass of ['industrial', null]) for (const [bx, by, o] of removed) {
    if (o !== 'v' || blockKind(bx - 1, by) || blockKind(bx, by) || pass && districtAt(bx * 8 + 1, by * 8 + 4) !== pass) continue;
    for (const y of [by * 8 + 4, by * 8 + 5, by * 8 + 3, by * 8 + 6]) {
      const lane = idx(bx * 8 + 1, y), wall = idx(bx * 8 + 2, y), s = STY[wall], sh = SHOP[wall];
      if (map[lane] || !map[wall] || s >= 18 || s >= 3 && s <= 6 || !sh || sh.gas || sh.courier || sh.base) continue;
      return { x: bx * 8 + 2, cy: y, y: y + 0.5 };
    }
  }
  return null;
})();
const SEAM_HW = 0.055, SEAM_H = 0.215; // (a door's half width and its height, in cells)
// is the camera on the lane side of the seam's wall, looking at that face (the wall cell, from the west)?
const seamSide = () => BACKROOMS_SEAM && rel(BACKROOMS_SEAM.x - px) > 0 && rel(BACKROOMS_SEAM.x - px) < 1.2;
// the wall cell lookHit is on is the seam's, seen from the lane (no shop to go into from this side)
const seamWall = h => seamSide() && mod(h.mx, N) === BACKROOMS_SEAM.x && mod(h.my, N) === BACKROOMS_SEAM.cy;
// the seam's face from the lane: blank, grimy concrete on the ground floor (no shopfront this side), the doorframe's
// outline cut into it, a hairline darker than the wall. True if it drew this cell.
function backroomsSeamFace(i, uStep, z, d, side, mx, my, fog, wc) {
  const S = BACKROOMS_SEAM;
  if (!S || side || mod(mx, N) !== S.x || mod(my, N) !== S.cy || z >= 0.4 || !seamSide()) return false;
  const e = rel(wc - S.y), dz = d / projY, L = fog * amb * 15, wall = day * 2.6 * (0.45 + 0.55 * fog);
  const edge = Math.abs(Math.abs(e) - SEAM_HW) < Math.max(uStep * 0.55, 0.002) && z < SEAM_H || Math.abs(z - SEAM_H) < Math.max(dz * 0.55, 0.002) && Math.abs(e) < SEAM_HW;
  if (edge) { BG[i] = bgAt(GRAY, wall * 0.55, d); return set(i, Math.abs(z - SEAM_H) < dz * 0.55 ? '-' : '|', C(GRAY, L * 0.25)), true; }
  const g = hash(Math.floor(wc * 40), Math.floor(z * 40), 153);
  BG[i] = bgAt(GRAY, wall * (0.85 + noise(wc * 6, z * 6, 154) * 0.25), d); return set(i, z > 0.38 ? '=' : g > 0.93 ? '.' : g > 0.9 ? ',' : ' ', C(GRAY, L * 0.4)), true;
}
// walking into it from the lane (a step's look ahead at x, y)
const backroomsSeamAt = (x, y) => { const S = BACKROOMS_SEAM; return !!S && Math.floor(mod(x, N)) === S.x && Math.floor(mod(y, N)) === S.cy && Math.abs(rel(y - S.y)) < SEAM_HW && rel(x - S.x) < 0.12; };
function enterBackrooms() {
  enterRoom('backrooms', { word: '', neon: YEL, ret: [px, py, a], line: '', cell: [BACKROOMS_SEAM.x, BACKROOMS_SEAM.cy] }, [BACKROOMS_ENTRY, BACKROOMS.length - 1.6, -Math.PI / 2]);
  say('The wall gives like a curtain. You stumble through, and the hum of the lights closes round you.', 4);
}

// ---- the place: a maze on a 4m grid (3m rooms, 1m walls), every room reachable from every other (a random spanning
// tree, knocked through), then more walls knocked through or opened up for loops, a few big halls where only the
// pillars are left, and the way back out (the seam, from this side) in the south wall
const BACKROOMS_ENTRY = 2.5;
const BACKROOMS = (() => {
  const C = 4, NC = 18, S = NC * C + 1;
  let seed = 1977; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const g = Array.from({ length: S }, (_, y) => Array.from({ length: S }, (_, x) => x === 0 || y === 0 || x === S - 1 || y === S - 1 || x % C === 0 || y % C === 0 ? '#' : '.'));
  // open the wall between coarse cell (i, j) and its neighbour east (dir 0) or south (dir 1): all of it, or a doorway
  const open = (i, j, dir, full) => {
    const cells = [1, 2, 3].map(k => dir ? [i * C + k, (j + 1) * C] : [(i + 1) * C, j * C + k]);
    const w = full ? 3 : 1 + (rnd() < 0.4), at = full ? 0 : Math.floor(rnd() * (4 - w));
    for (let k = at; k < at + w; k++) { const [x, y] = cells[k]; g[y][x] = '.'; }
  };
  const seen = new Set([0]), stack = [[0, 0]];
  while (stack.length) { // the spanning tree: every room joined to the last, one wall at a time
    const [i, j] = stack[stack.length - 1], next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj]).filter(([a, b]) => a >= 0 && b >= 0 && a < NC && b < NC && !seen.has(b * NC + a));
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(rnd() * next.length)];
    seen.add(b * NC + a); stack.push([a, b]);
    if (a !== i) open(Math.min(a, i), j, 0, rnd() < 0.4); else open(i, Math.min(b, j), 1, rnd() < 0.4);
  }
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) for (const dir of [0, 1]) { // loops, so it doesn't feel like a maze
    if (dir ? j === NC - 1 : i === NC - 1) continue;
    const r = rnd(); if (r < 0.22) open(i, j, dir, false); else if (r < 0.32) open(i, j, dir, true);
  }
  for (let n = 0; n < 6; n++) { // the halls: three rooms by three, only the pillars left standing
    const i0 = Math.floor(rnd() * (NC - 3)), j0 = Math.floor(rnd() * (NC - 3));
    for (let j = j0; j < j0 + 3; j++) for (let i = i0; i < i0 + 3; i++) { if (i < i0 + 2) open(i, j, 0, true); if (j < j0 + 2) open(i, j, 1, true); }
  }
  for (let y = C; y < S - 1; y += C) for (let x = C; x < S - 1; x += C) { // a post with nothing to hold up comes away, now and then
    const bare = g[y - 1][x] === '.' && g[y + 1][x] === '.' && g[y][x - 1] === '.' && g[y][x + 1] === '.';
    if (bare && rnd() < 0.55) g[y][x] = '.';
  }
  g[S - 1][Math.floor(BACKROOMS_ENTRY)] = 'D';
  return g.map(r => r.join(''));
})();

// the wallpaper: mono-yellow, a faint stripe in it, water stains, a brown skirting board; the seam from this side
function backroomsWall(i, u, uStep, z, d, mx, my, L) {
  if (roomAt(mx, my) === 'D') { // the way back: the same doorframe, cut in the wallpaper
    const e = Math.abs(fract(-u) - 0.5), dz = d / projY;
    if (Math.abs(e - 0.45) < Math.max(uStep * 0.55, 0.01) && z < 2.1 || Math.abs(z - 2.1) < Math.max(dz * 0.55, 0.01) && e < 0.45) { BG[i] = C(YEL, 1.6 + L * 0.1); return set(i, Math.abs(z - 2.1) < dz * 0.55 ? '-' : '|', C(BRICK, L * 0.5)), true; }
  }
  if (z < 0.1) { BG[i] = C(BRICK, 1.5 + L * 0.12); return set(i, z > 0.085 ? '_' : ' ', C(WARM, L * 0.4)), true; }
  const s = noise(u * 0.9 + mx * 3.1, z * 0.8 + my * 1.7, 155), stain = s > 0.76 ? (s - 0.76) * 2 : 0;
  BG[i] = C(YEL, (3.2 + L * 0.22) * (1 - stain * 0.35)); return set(i, fract(u * 2.5) < 0.1 ? ':' : stain > 0.3 && hash(Math.floor(u * 20), Math.floor(z * 20), 156) > 0.8 ? '.' : ' ', C(ORANGE, 3 + L * 0.12)), true;
}
// the carpet: old, yellow-brown, damp in patches
ROOM_FLOORS.backrooms = (i, f, wx, wy, r, x, L) => {
  const damp = noise(wx * 0.35, wy * 0.35, 157) > 0.7, h = hash(Math.floor(wx * 14), Math.floor(wy * 14), 158);
  BG[i] = C(YEL, (damp ? 1.6 : 2.4) * (0.5 + f * 0.9) + h * 0.25); return set(i, h > 0.92 ? ',' : h > 0.88 ? '.' : ' ', C(ORANGE, L * 0.35));
};
// the dropped ceiling: 60cm tiles, a strip light every 2.4m, one in a while flickering, one in a while dead
ROOM_CEILS.backrooms = (i, r, x, wx, wy) => {
  const lx = Math.floor(wx / 2.4), ly = Math.floor(wy / 2.4), fx_ = fract(wx / 2.4), fy_ = fract(wy / 2.4), k = hash(lx, ly, 159);
  if (fx_ > 0.25 && fx_ < 0.75 && fy_ > 0.38 && fy_ < 0.62) { // the light
    const on = k > 0.12 && (k > 0.2 || hash(lx, Math.floor(T * 9), ly) > 0.35);
    BG[i] = on ? C(WHITE, 12) : C(GRAY, 2); return set(i, on ? (fract(wx * 4) < 0.15 ? '=' : ' ') : '-', C(WHITE, on ? 15 : 4));
  }
  BG[i] = C(YEL, 6.6 + hash(Math.floor(wx / 0.6), Math.floor(wy / 0.6), 160) * 0.6); return set(i, fract(wx / 0.6) < 0.05 || fract(wy / 0.6) < 0.05 ? '+' : ' ', C(BRICK, 5)); // (off-white, yellowed)
};
ROOM_DEFS.backrooms = { grid: BACKROOMS, light: 1.05, height: 2.6, floor: 'backrooms', ceil: 'backrooms', sign: false, doorWall: true, wall: backroomsWall, props: r => [] };
