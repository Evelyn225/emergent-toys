// Authored apartment and walk-up families. Balconies and escapes use the same exposed faces as the windows.
const RESIDENTIAL_PROFILES = {
  modern: [
    { name: 'concrete loggias', wall: STONE, trim: WHITE, accent: GRAY, spacing: .82, rise: .40, form: 'terrace', glass: true },
    { name: 'brick and glass', wall: BRICK, trim: STONE, accent: BRICK, spacing: .98, rise: .38, form: 'split', glass: false },
    { name: 'corner terraces', wall: WHITE, trim: GRAY, accent: SKIN, spacing: 1.12, rise: .43, form: 'corner', glass: true },
    { name: 'garden galleries', wall: GRAY, trim: WHITE, accent: SKIN, spacing: .88, rise: .42, form: 'wing', glass: false },
  ],
  tenement: [
    { name: 'red brick walkup', wall: BRICK, trim: STONE, accent: BRICK, spacing: .82, rise: .35, form: 'rear-wing', brick: true },
    { name: 'buff cornerhouse', wall: SKIN, trim: WHITE, accent: BRICK, spacing: 1.04, rise: .38, form: 'corner', brick: true },
    { name: 'patched plaster', wall: STONE, trim: GRAY, accent: BRICK, spacing: .90, rise: .37, form: 'rear-wing', brick: false },
    { name: 'stone lintel block', wall: GRAY, trim: STONE, accent: STONE, spacing: .78, rise: .34, form: 'wing', brick: true },
  ]
};
function residentialComposition(b) {
  const { x0, y0, x1, y1, h } = b, lower = Math.max(.8, h - b.profile.rise * (b.sty === 16 ? 2 : 1));
  const tiers = [architectureTier(x0, y0, x1, y1, lower)];
  if (b.form === 'terrace') tiers.push(architectureTier(x0, y0 + 1, x1, y1, h));
  else if (b.form === 'split') {
    tiers.push(architectureTier(x0 + 1, y0, x1 - 1, y1, h));
    tiers.push(architectureTier(x0, y0 + 1, x1, y1, h - b.profile.rise));
  } else if (b.form === 'corner') {
    tiers.push(architectureTier(x0, y0, x1 - 1, y1, h));
    tiers.push(architectureTier(x0, y0, x1, y1 - 1, h));
  } else if (b.form === 'rear-wing') tiers.push(architectureTier(x0, y0, x1, y1 - 1, h));
  else tiers.push(architectureTier(x0, y0, x1 - 1, y1, h));
  return tiers;
}
function residentialFaceLayout(b, f) {
  const width = f.end - f.start, margin = Math.min(.15, width * .16);
  const units = Math.max(1, Math.round((width - margin * 2) / b.profile.spacing));
  const floors = Math.max(1, Math.floor((f.height - .58) / b.profile.rise));
  return { margin, units, spacing: (width - margin * 2) / units, floors, fh: (f.height - .58) / floors, base: .48,
    core: b.sty === 16 && units > 1 ? (b.profile.form === 'split' ? Math.floor(units / 2) : Math.floor(fract(b.seed * 53) * units)) : -1 };
}
function residentialSideRail(b, f, along, depth, z, height, kind) {
  const rail = architectureDetail(b, f, along, depth, .01, depth, z, z + height, kind, { profile: b.profile });
  rail.c = f.side ? 0 : 1; rail.s = f.side ? 1 : 0; rail.hl = depth; rail.hw = .008;
}
function modernApartmentDetails(b, f) {
  if (!f.front && f.end - f.start < 1.7) return;
  const r = f.residential, p = b.profile;
  for (let fl = 0; fl < r.floors; fl++) {
    const z = r.base + fl * r.fh + r.fh * .1;
    if (z < f.low + .06) continue;
    // One or two broad loggias, broken by an actual service spine rather than dozens of tiny repeated boxes.
    const groups = r.core < 0 ? [[0, r.units]] : [[0, r.core], [r.core + 1, r.units]];
    for (const [first, end] of groups) {
      if (first === end || p.form === 'corner' && !f.front && fl % 2) continue;
      const half = (end - first) * r.spacing / 2 - .035, along = f.start + r.margin + (first + end) * r.spacing / 2;
      const depth = p.form === 'terrace' ? .115 : .095, height = r.fh * .32;
      const extra = { profile: p, spacing: r.spacing, detailDistance: 18 };
      architectureDetail(b, f, along, depth, half + .02, depth + .01, z - .025, z, 'balcony-slab', extra);
      architectureDetail(b, f, along, depth * 2, half, .008, z, z + height, 'balcony-rail', extra);
      for (const sign of [-1, 1]) residentialSideRail(b, f, along + sign * half, depth, z, height, 'balcony-rail');
      if ((fl + first) % 3 === 1) {
        architectureDetail(b, f, along - half * .65, depth, .045, .038, z, z + .07, 'planter', { profile: p });
        architectureDetail(b, f, along - half * .65, depth, .052, .044, z + .07, z + .15, 'leaves', { profile: p });
      }
    }
  }
  if (r.core >= 0) {
    const along = f.start + r.margin + (r.core + .5) * r.spacing;
    architectureDetail(b, f, along, .012, r.spacing * .38, .025, .44, f.height - .08, 'service-spine', { profile: p, fh: r.fh, floors: r.floors, detailDistance: 18 });
  }
}
function tenementEscapeDetails(b, f) {
  if (!f.front || f.low || f.end - f.start < 1.3) return;
  const r = f.residential, half = Math.min(.27, r.spacing * .36);
  const unit = Math.max(0, r.units - 2), along = f.start + r.margin + (unit + .5) * r.spacing;
  const depth = .10, height = .105;
  for (let fl = 0; fl < r.floors; fl++) {
    const z = r.base + fl * r.fh + .015;
    const extra = { profile: b.profile, detailDistance: 15 };
    architectureDetail(b, f, along, depth, half + .035, depth + .025, z - .018, z, 'escape-platform', extra);
    architectureDetail(b, f, along, depth * 2 + .02, half + .035, .007, z, z + height, 'escape-rail', extra);
    for (const sign of [-1, 1]) residentialSideRail(b, f, along + sign * (half + .035), depth, z, height, 'escape-rail');
    if (fl + 1 < r.floors) {
      const slope = (fl % 2 ? -1 : 1) * r.fh / (half * 2), mid = z + r.fh / 2;
      const flight = architectureDetail(b, f, along, depth, half, .038, z - .012, z + r.fh + .012, 'escape-stair', { ...extra, slope, mid });
      flight.planes = [[1,0,0,half,1],[-1,0,0,half,2],[0,1,0,.038,3],[0,-1,0,.038,4],
        [-slope,0,1,mid+.012,7],[slope,0,-1,-mid+.012,8]];
      architectureDetail(b, f, along, depth * 2 + .02, half, .007, z, z + r.fh + height, 'escape-flight-rail', { ...extra, slope, mid, railHeight: height });
    }
  }
  architectureDetail(b, f, along + half * .8, depth * 2 + .02, .025, .009, .30, r.base + .015, 'escape-drop', { profile: b.profile });
}
function residentialDetails(b) {
  for (const f of b.faces) {
    f.residential = residentialFaceLayout(b, f);
    const center = (f.start + f.end) / 2, half = (f.end - f.start) / 2, extra = { profile: b.profile };
    architectureDetail(b, f, center, .014, half, b.sty === 7 ? .055 : .03, f.height - .06, f.height + .025, 'residential-cornice', { ...extra, detailDistance: 18 });
    if (f.front && !f.low) architectureDetail(b, f, center, .08, Math.min(.38, half - .12), .09, .305, .325, 'entrance-canopy', extra);
    if (b.sty === 16) modernApartmentDetails(b, f); else tenementEscapeDetails(b, f);
  }
}
