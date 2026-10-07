// Belle Époque's stone cornices, iron balconies and sloping copper roofs are geometry, depth-tested
// against the street scene. Their positions follow complete facade bays, with room at every corner.
function mansardPlanes(hl, hw, z0, z1) {
  const slope = (z1 - z0) / 0.65;
  return [[1, 0, 0, hl], [-1, 0, 0, hl], [0, 1, 0, hw], [0, -1, 0, hw], [0, 0, 1, z1], [0, 0, -1, -z0],
    [slope, 0, 1, z0 + slope * hl], [-slope, 0, 1, z0 + slope * hl], [0, slope, 1, z0 + slope * hw], [0, -slope, 1, z0 + slope * hw]];
}
const ROOF_PLANE_DATA = new WeakMap();
// Match each inclined face to its compass-facing light, so folds remain visible in the copper.
const BELLE_ROOF_LIGHT = [.13, .29, .22, .09, .32, .09, .13, .29, .22, .09];
function roofPlaneData(planes) {
  let packed = ROOF_PLANE_DATA.get(planes);
  if (!packed) { packed = Float64Array.from(planes.flat()); ROOF_PLANE_DATA.set(planes,packed); }
  return packed;
}
function belleRoofFootprint(b) {
  const width = b.x1 - b.x0, height = b.y1 - b.y0, cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    cells[y * width + x] = SHOP[idx(b.x0 + x, b.y0 + y)] === b.sh ? 1 : 0;
  return { width, height, cells };
}
function belleRoofRects(b) {
  const { width, height, cells } = belleRoofFootprint(b), rects = [];
  // Maximal overlapping rectangles give a continuous hipped roof, including slopes into its courtyards.
  // Overlap hides internal edges; a partition into small boxes would leave extra valleys across the roof.
  const filled = (y, x0, x1) => {
    if (y < 0 || y >= height) return false;
    for (let x = x0; x < x1; x++) if (!cells[y * width + x]) return false;
    return true;
  };
  for (let y0 = 0; y0 < height; y0++) {
    const columns = new Uint8Array(width).fill(1);
    for (let y1 = y0 + 1; y1 <= height; y1++) {
      for (let x = 0; x < width; x++) columns[x] &= cells[(y1 - 1) * width + x];
      for (let x0 = 0; x0 < width;) {
        if (!columns[x0]) { x0++; continue; }
        let x1 = x0 + 1;
        while (x1 < width && columns[x1]) x1++;
        if (!filled(y0 - 1, x0, x1) && !filled(y1, x0, x1))
          rects.push({ x0: b.x0 + x0, x1: b.x0 + x1, y0: b.y0 + y0, y1: b.y0 + y1 });
        x0 = x1;
      }
    }
  }
  return rects;
}
const BELLE_FACES = Array.from({ length: 4 }, () => new Array(N * N));
function belleSign(sh, f) {
  const letterW = Math.min(0.05, (f.end - f.start - 0.32) / (sh.word.length + 2));
  if (!f.low && letterW >= 0.025) return { center: (f.start + f.end) / 2, letterW, bandH: 0.06 * letterW / 0.05 };
  return null;
}
function belleFaceAt(mx, my, dir) {
  const k = idx(mx, my), cached = BELLE_FACES[dir][k];
  if (cached) return cached;
  // A removed neighbor can reveal a face absent from the initial geometry. Resolve it once against the current map.
  const x = mod(mx, N), y = mod(my, N), sh = SHOP[k], height = map[k], [nx, ny] = ARCH_DIRECTIONS[dir];
  const side = ny ? 1 : 0, low = map[idx(x + nx, y + ny)];
  const same = step => {
    const xx = x + side * step, yy = y + (1 - side) * step, at = idx(xx, yy);
    return SHOP[at] === sh && map[at] === height && map[idx(xx + nx, yy + ny)] === low;
  };
  let start = side ? x : y, end = start + 1;
  for (let n = 1; n < 9 && same(-n); n++) start--;
  for (let n = 1; n < 9 && same(n); n++) end++;
  const f = { dir, nx, ny, side, start, end, line: side ? y + (ny > 0) : x + (nx > 0), height, low };
  f.sign = belleSign(sh, f);
  BELLE_FACES[dir][k] = f;
  return f;
}
const belleBuildingsB = bucketed(BELLE_BUILDINGS.map(b => {
  const rects = b.access ? [] : belleRoofRects(b);
  b.sh.belle.roofRects = rects;
  const roofParts = rects.map(rect => {
    const hl = (rect.x1 - rect.x0) / 2, hw = (rect.y1 - rect.y0) / 2;
    const planes = mansardPlanes(hl, hw, b.h, b.h + 0.45);
    return { ...rect, x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2, hl, hw, h: b.h, planes, planeData: roofPlaneData(planes) };
  });
  return { ...b, roofParts };
})), belleDetails = [];
for (const b of BELLE_BUILDINGS) {
  const cells = [];
  for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
    const k = idx(x, y);
    if (SHOP[k] === b.sh) cells.push(k);
  }
  // Each direction needs its own exposed span: an uninterrupted row of masonry can still have a recessed street face.
  b.faces = architectureFaces(b, cells, BELLE_FACES);
  for (const f of b.faces) {
    f.sign = belleSign(b.sh, f);
    const spacing = (f.end - f.start) / Math.max(1, Math.floor((f.end - f.start) / 0.85));
    const floors = Math.max(1, Math.floor((b.h - 0.55) / 0.42)), fh = (b.h - 0.55) / floors;
    for (let bay = 0; bay < (f.end - f.start) / spacing - 0.01; bay++) {
      const along = f.start + (bay + 0.5) * spacing;
      const x = f.side ? along : f.line, y = f.side ? f.line : along;
      const add = (depth, hl, hw, z0, z1, kind) => belleDetails.push({ x: x + f.nx * depth, y: y + f.ny * depth, c: f.side ? 1 : 0, s: f.side ? 0 : 1, hl, hw, z0, z1, kind, material: b.material });
      if (b.balconies && bay % 2 === 0) for (let fl = 1; fl < floors; fl += 2) {
        const z = 0.45 + fl * fh + fh * 0.2, half = Math.min(0.36, spacing * 0.4);
        add(0.1, half, 0.12, z - 0.025, z, 'slab');
        add(0.21, half, 0.008, z, z + 0.11, 'iron');
        for (const sign of [-1, 1]) belleDetails.push({ x: x + f.nx * 0.1 + (f.side ? sign * half : 0), y: y + f.ny * 0.1 + (f.side ? 0 : sign * half), c: f.side ? 0 : 1, s: f.side ? 1 : 0, hl: 0.11, hw: 0.008, z0: z, z1: z + 0.11, kind: 'iron' });
        add(0.075, half * 0.65, 0.05, z - 0.1, z - 0.025, 'bracket');
      }
      add(0.025, spacing * 0.47, 0.045, b.h - 0.08, b.h + 0.035, 'cornice');
    }
  }
}
const belleDetailsB = bucketed(belleDetails);

// Shared by the renderer and fixture clearance, with the crossbar fixed along the curb rather than facing the camera.
function belleLampParts(x, y, ax, ay) {
  const c = -ay, s = ax;
  const part = (u, hl, hw, z0, z1, kind) => ({ x: x + c * u, y: y + s * u, c, s, hl, hw, z0, z1, kind });
  const parts = [part(0, .035, .035, 0, .035, 'base'), part(0, .024, .024, .035, .07, 'base'),
    part(0, .011, .011, .07, .58, 'pole'), part(0, .018, .018, .38, .4, 'cap'),
    part(0, .018, .018, .475, .495, 'cap'), part(0, .009, .009, .58, .62, 'finial'),
    part(0, .11, .008, .48, .495, 'arm')];
  for (const side of [-1, 1]) {
    parts.push(part(side * .075, .028, .007, .46, .48, 'arm'),
      part(side * .105, .01, .01, .48, .507, 'pole'), part(side * .11, .022, .022, .497, .508, 'cap'),
      part(side * .11, .045, .045, .505, .605, 'globe'));
  }
  return parts;
}
