// Draw the ground triangles inside an existing DDA interval. No per-pixel
// marching: a sloped triangle is one plane, with an analytic ray intersection.
function drawTerrainColumn(column, rx, ry, mx, my, start, end) {
  if (!terrainCells[idx(mx, my)]) return false;
  end = Math.min(end, vis);
  let from = Math.max(.015, start), painted = false;
  while (from < end - 1e-8) {
    const gx = Math.floor((px + rx * (from + 1e-8)) * TERRAIN_SCALE);
    const gy = Math.floor((py + ry * (from + 1e-8)) * TERRAIN_SCALE);
    const x0 = gx * TERRAIN_STEP, y0 = gy * TERRAIN_STEP;
    const tx = Math.abs(rx) < 1e-10 ? Infinity : (x0 + (rx > 0 ? TERRAIN_STEP : 0) - px) / rx;
    const ty = Math.abs(ry) < 1e-10 ? Infinity : (y0 + (ry > 0 ? TERRAIN_STEP : 0) - py) / ry;
    const to = Math.min(end, tx, ty);
    if (to <= from + 1e-9) break;
    const patch = terrainPatch(gx, gy);
    if (patch >= 0 && terrainPatchData[patch + 7]) {
      const diagonal = Math.abs(rx - ry) < 1e-10 ? Infinity : ((py - y0) - (px - x0)) / (rx - ry);
      const cut = diagonal > from && diagonal < to ? diagonal : to;
      plane(from, cut);
      if (cut < to) plane(cut, to);
    }
    from = to;

    function plane(t0, t1) {
      const middle = (t0 + t1) / 2, lower = px + rx * middle - x0 >= py + ry * middle - y0;
      const sx = terrainPatchData[patch + (lower ? 1 : 3)], sy = terrainPatchData[patch + (lower ? 2 : 4)];
      const light = terrainPatchData[patch + (lower ? 5 : 6)];
      const base = terrainPatchData[patch] + sx * (px - x0) + sy * (py - y0), along = sx * rx + sy * ry;
      const project = t => hor - ((base - eye) / t + along) * projY;
      const r0 = Math.max(0, Math.floor(Math.min(project(t0), project(t1))));
      const r1 = Math.min(rows, Math.ceil(Math.max(project(t0), project(t1))));
      for (let r = r0; r < r1; r++) {
        const i = r * cols + column;
        // DDA visits near triangles first. A nearer surface already owns this cell,
        // so no intersection or shading is needed for the triangle behind it.
        if (ZB[i] >= 0 && ZB[i] <= t0 - 1e-7) continue;
        const t = (base - eye) / ((hor - r - .5) / projY - along);
        if (!Number.isFinite(t) || t < t0 - 1e-7 || t > t1 + 1e-7 || (ZB[i] >= 0 && ZB[i] <= t)) continue;
        const x = px + rx * t, y = py + ry * t;
        terrainCell(i, x, y, t, sx, sy, light);
        ZB[i] = t; FL[i] = 1; painted = true;
      }
    }
  }
  return painted;
}

function terrainCell(i, x, y, depth, sx, sy, light) {
  const island = onIsland(x, y), coast = coastalGround(worldCoord(x), worldCoord(y));
  let surface = islandSurface(x,y);
  if(!surface&&worldReady&&naturalCoastAt(x,y))surface=islandShoreSurface(x,y,coast.depth,coast.beach);
  const rock = !surface && (island ? isleEdge(x, y) < .9 : !coast.beach);
  const grain = hash(Math.floor(x * 12), Math.floor(y * 12), 1374);
  let base = YEL, background = WARM, ch = grain > .8 ? ':' : '.';
  if (rock) { base = background = GRAY; ch = grain > .7 ? '%' : ':'; }
  else if (island) { base = background = GREEN; ch = grain > .65 ? '"' : ','; }
  if (surface) { base = surface.base; background = surface.background; ch = surface.ch; }
  const fog = Math.max(0, 1 - depth / vis * 1.5), L = fog * 6 * (.6 + amb) * light;
  const tone=surface?.tone??1;
  const brightness=day*2.6*tone+day*(surface?.lift||0);
  BG[i] = bgAt(background, brightness * fog * light, depth);
  set(i, ch, C(base, L * (rock ? 1.15 : .9) * tone));
  if (snowCover > 0) paintSettledSnow(i, x, y, L, 1, 0);
}
