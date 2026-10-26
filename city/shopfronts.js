// Fascia boards and awnings for the shops still drawn by the generic facade (city-render.js): the Docks' warehouses
// and workshops, and the plain brick and stucco shops of midtown and the brownstones (styles 2, 8 and 15). They used
// to paint their name over and over round every wall and an awning on the wall below it. Now each street face carries
// one board with the name on it, built like the architecture families' (architectureShopfront), and the open shops
// an awning. Faces come from the same face finder; SHOPFRONT_FACES indexes them by direction and cell like ARCH_FACES.
const SHOPFRONT_FACES = Array.from({ length: 4 }, () => new Array(N * N));
const SHOPFRONT_SPEC = { zc: .36, band: .08, cmax: .1, margin: .3, edge: .008 }; // (the band the generic facade paints its name in)
const SHOPFRONT_AWNING = { top: .31, out: .1, drop: .04, valance: .015, thick: .005, keep: .7 };
const SHOPFRONT_STYLES = { 2: 'painted', 8: 'board', 15: 'box' };
{
  const lots = new Map();
  for (let k = 0; k < map.length; k++) {
    const sh = SHOP[k], sty = STY[k];
    if (!sh || !map[k] || !(sty in SHOPFRONT_STYLES) || sh.architecture || sh.base || sh.aqua || sh.gas || sh.courier || sh.wilderness || MERCHANT_BY_SHOP.get(sh)) continue;
    if (!lots.has(sh)) lots.set(sh, []);
    lots.get(sh).push(k);
  }
  for (const [sh, cells] of lots) {
    if (sh.kind === SHOP_APTS || sh.kind === SHOP_SHUT) continue; // (flats have no shop name; a shop closed for good shows FOR LEASE)
    const refX = cells[0] % N, refY = Math.floor(cells[0] / N), xs = cells.map(k => refX + rel(k % N - refX)), ys = cells.map(k => refY + rel(Math.floor(k / N) - refY));
    const sty = STY[cells[0]], b = { x0: Math.min(...xs), y0: Math.min(...ys), x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: (Math.min(...ys) + Math.max(...ys) + 1) / 2,
      sh, region: districtAt(refX, refY), material: 0, seed: SEED[cells[0]] };
    for (const f of architectureFaces(b, cells, SHOPFRONT_FACES)) {
      const mid = (f.start + f.end) / 2; // (world-bootstrap.js moves a face with the cell behind its middle)
      f.ownerCell = idx(Math.floor((f.side ? mid : f.line) - f.nx * .1), Math.floor((f.side ? f.line : mid) - f.ny * .1));
      if (f.low || !architectureSignedFace(f, sh)) continue;
      const width = f.end - f.start, g = { ...SHOPFRONT_SPEC, width, cwid: Math.min(SHOPFRONT_SPEC.cmax, (width - SHOPFRONT_SPEC.margin) / sh.word.length) };
      if (g.cwid < .03 || g.zc + g.band / 2 + g.edge > f.height - .05) continue;
      const center = (f.start + f.end) / 2, outSign = f.ny * (f.side ? 1 : 0) - f.nx * (f.side ? 0 : 1);
      architectureDetail(b, f, center, ARCH_FASCIA.depth / 2, sh.word.length * g.cwid / 2 + g.edge * 2.5, ARCH_FASCIA.depth / 2, g.zc - g.band / 2 - g.edge, g.zc + g.band / 2 + g.edge,
        'fascia', { word: sh.word, zc: g.zc, cwid: g.cwid, band: g.band, edge: g.edge, style: SHOPFRONT_STYLES[sty], width, cmax: g.cmax, margin: g.margin, outSign, detailDistance: ARCH_FASCIA_VIS });
      f.fascia = g;
      const a = SHOPFRONT_AWNING, half = Math.min(.42, width / 2 - .14);
      if (sty === 8 || half < .15 || hash(Math.floor(b.x * 7), Math.floor(b.y * 7) + f.dir, 1481) > a.keep) continue; // (no awnings over a warehouse's loading doors)
      const hw = a.out / 2, slope = a.drop / a.out, z1 = a.top, front = z1 - a.drop;
      architectureDetail(b, f, center, hw, half, hw, front - a.thick, z1, 'awning', { outSign, slope, part: 'canopy', detailDistance: 14,
        planes: [[1, 0, 0, half, 1], [-1, 0, 0, half, 2], [0, 1, 0, hw, 3], [0, -1, 0, hw, 4],
          [0, slope * outSign, 1, z1 - slope * hw, 5], [0, -slope * outSign, -1, -(z1 - slope * hw - a.thick), 6]] });
      architectureDetail(b, f, center, a.out - .002, half, .002, front - a.valance, front + .002, 'awning', { outSign, part: 'valance', detailDistance: 14 });
      f.awning = true;
    }
  }
  // (world-bootstrap.js rebuckets ARCH_DETAILS, these with them)
}
// the face of a generic shop the ray hit (side, cell, its height), if it carries a board
function shopfrontFace(side, mx, my, h) {
  const k = idx(mx, my), dir = side ? (rel(py - my) < 0 ? 0 : 1) : (rel(px - mx) < 0 ? 2 : 3), f = SHOPFRONT_FACES[dir][k];
  return f && f.height === h ? f : null;
}
