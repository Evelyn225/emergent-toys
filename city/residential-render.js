// Windows have complete bays, corner margins and a fitted top floor; geometry carries the balconies and escapes.
const MIDTOWN_MATERIALS = [STONE, GRAY, SKIN, WHITE, STONE];
function housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, wall, trim) {
  const width = f.end - f.start, center = width / 2, open = openAt(sh, tod);
  if (f.front && z > .335 && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + center), .38,
    Math.min(.067, (width - .3) / sh.word.length), .043, C(trim, open ? Math.max(L, night * 10) : L * .5), C(wall, 2))) return;
  if (architectureLeaseSign(i, u, uStep, z, d, wc, f, sh, L)) return;
  if (z > .325 || z < .045) return set(i, z > .325 ? '=' : '_', C(trim, L * .75));
  const doorHalf = Math.min(.23, width * .17), door = Math.abs(along - center);
  if (f.front && sh.kind === SHOP_APTS) {
    if (door < doorHalf && z < .30) {
      BG[i] = C(WARM, 1 + night * 3);
      return set(i, door < .009 || door > doorHalf - .015 ? '|' : Math.abs(z - .16) < .012 ? '-' : ':', C(WHITE, Math.max(L * .7, night * 12)));
    }
    if (z > .08 && z < .26 && door > doorHalf + .06 && door < width * .36) {
      BG[i] = C(CYAN, 1 + night);
      return set(i, '|', C(GRAY, L * .5));
    }
    return set(i, ' ', C(wall, L));
  }
  if (along > .14 && along < width - .14 && z < .31) {
    if (architectureShutter(i, z, sh, L)) return;
    const mullion = Math.abs(fract((along - .14) / .48) - .5) > .47;
    BG[i] = C(sh.kind === SHOP_NEON ? sh.neon : CYAN, 1 + night * 2);
    return set(i, mullion ? '|' : ':', C(mullion ? trim : WARM, Math.max(L * .65, night * 11)));
  }
  return set(i, ' ', C(wall, L));
}
function residentialFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const p = b.profile, r = f.residential, width = f.end - f.start, modern = b.sty === 16;
  const grain = hash(Math.floor(wc * 15), Math.floor(z * 24), sk0(b.seed));
  const patch = !modern && !p.brick && hash(Math.floor(wc * 2.6), Math.floor(z * 4), sk0(b.seed)) > .88;
  const wall = patch ? p.accent : p.wall;
  BG[i] = C(wall, 2.1 + L * (modern ? .34 : .27) + grain * .6);
  if (Math.min(along, width - along) < r.margin * .65)
    return set(i, !modern && fract(z * 13) < .14 ? '=' : '|', C(p.trim, L * .75));
  if (z < .44) return housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, wall, p.trim);
  if (z > f.height - .095 || z < r.base) return set(i, '=', C(p.trim, L * .8));
  const unit = clamp(Math.floor((along - r.margin) / r.spacing), 0, r.units - 1);
  const local = along - r.margin - (unit + .5) * r.spacing;
  const fl = Math.floor((z - r.base) / r.fh), floor0 = r.base + fl * r.fh;
  if (fl < 0 || fl >= r.floors) return set(i, ' ', C(wall, L));
  if (modern) {
    if (unit === r.core) {
      BG[i] = C(p.accent, 1.8 + L * .25);
      if (Math.abs(local) < .05 && z > floor0 + r.fh * .25 && z < floor0 + r.fh * .7)
        return brownstoneWindow(i, local, z, .045, floor0 + r.fh * .25, floor0 + r.fh * .7, false, L, p.trim);
      return set(i, fract(z * 18) < .08 ? '_' : ' ', C(p.accent, L * .7));
    }
    if (brownstoneWindow(i, local, z, r.spacing * .39, floor0 + r.fh * .13, floor0 + r.fh * .89,
      hash(unit, fl, sk0(b.seed)) > litT - .06, L, p.trim)) return;
    return set(i, Math.abs(local) > r.spacing * .46 ? '|' : ' ', C(p.trim, L * .7));
  }
  const gap = r.spacing * .46, window = local < 0 ? 0 : 1, du = local - (window ? 1 : -1) * gap / 2;
  if (brownstoneWindow(i, du, z, Math.min(.12, gap * .30), floor0 + r.fh * .2, floor0 + r.fh * .83,
    hash(unit * 2 + window, fl, sk0(b.seed)) > litT - .1, L, p.trim)) return;
  if (Math.abs(z - floor0 - r.fh * .9) < .012 && Math.abs(local) < r.spacing * .4)
    return set(i, '-', C(p.trim, L));
  return set(i, p.brick || patch ? (fract(z * 26) < .07 ? '_' : fract(wc * 14 + (Math.floor(z * 26) & 1) * .5) < .06 ? '|' : ' ') : grain > .94 ? '.' : ' ', C(wall, L * .65));
}
function midtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  if (b.sty === 14) return downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  const brick = b.sty === 2, glass = b.sty === 1;
  const base = brick ? [BRICK, SKIN, STONE, BRICK, GRAY][b.material] : MIDTOWN_MATERIALS[b.material];
  const width = f.end - f.start, margin = .12, corner = Math.min(along, width - along);
  BG[i] = C(base, 2 + L * .29);
  if (corner < margin * .6 || z > f.height - .07) return set(i, z > f.height - .07 ? '=' : '|', C(base, L));
  if (z < .44) return housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, base, STONE);
  const bays = Math.max(1, Math.round((width - margin * 2) / (glass ? .68 : .74))), spacing = (width - margin * 2) / bays;
  const bay = clamp(Math.floor((along - margin) / spacing), 0, bays - 1), du = along - margin - (bay + .5) * spacing;
  const floors = Math.max(1, Math.floor((f.height - .58) / .36)), fh = (f.height - .58) / floors;
  const fl = Math.floor((z - .48) / fh), floor0 = .48 + fl * fh;
  if (fl >= 0 && fl < floors && brownstoneWindow(i, du, z, spacing * (glass ? .44 : .32), floor0 + fh * .18, floor0 + fh * .82,
    hash(bay, fl, sk0(b.seed)) > litT + (glass ? .05 : -.06), L, glass ? GRAY : STONE)) return;
  if (glass && Math.abs(du) > spacing * .44) return set(i, '|', C(GRAY, L));
  if (Math.abs(z - floor0) < .016) return set(i, '-', C(STONE, L * .65));
  return set(i, brick && fract(z * 24) < .075 ? '_' : !brick && Math.abs(du) > spacing * .44 ? '|' : ' ', C(base, L * .75));
}
function residentialDetailShade(o, i, t, L) {
  const z = HIT.w, p = o.profile, rail = o.kind === 'balcony-rail' || o.kind === 'escape-rail' || o.kind === 'escape-flight-rail';
  if (o.kind === 'escape-drop') {
    if (Math.abs(HIT.u) < .016 && fract(z * 40) > .15) return false;
    BG[i] = C(GRAY, 1); set(i, Math.abs(HIT.u) < .016 ? '-' : '|', C(GRAY, L * .85)); return true;
  }
  if (rail) {
    const top = o.kind === 'escape-flight-rail' ? o.mid + o.slope * HIT.u + o.railHeight : o.z1;
    const bottom = o.kind === 'escape-flight-rail' ? top - o.railHeight : o.z0;
    if (z < bottom || z > top + .006) return false;
    const bar = Math.abs(z - top) < .01 || Math.abs(z - bottom) < .008 || Math.abs(fract(HIT.u * (o.kind === 'balcony-rail' ? 5 : 16)) - .5) < .09;
    if (bar) { BG[i] = C(GRAY, 1); set(i, Math.abs(z - top) < .01 ? '-' : '|', C(o.kind === 'balcony-rail' ? p.trim : GRAY, L * .8)); return true; }
    if (o.kind !== 'balcony-rail' || !p.glass || Math.abs(fract(HIT.u * 7 + z * 3) - .5) > .045) return false;
    set(i, ':', C(CYAN, L * .48)); return true;
  }
  if (o.kind === 'escape-stair') {
    if (HIT.face >= 7 && fract((HIT.u + o.hl) * 55) < .28) return false;
    BG[i] = C(GRAY, 1 + L * .16);
    set(i, HIT.face >= 7 ? '=' : '|', C(GRAY, L * .8)); return true;
  }
  if (o.kind === 'leaves') {
    if (Math.abs(HIT.u / o.hl) + Math.abs((z - (o.z0 + o.z1) / 2) / (o.z1 - o.z0)) > 1.15) return false;
    BG[i] = C(GREEN, 1 + L * .16); set(i, '%', C(GREEN, L * .9)); return true;
  }
  if (o.kind === 'service-spine' && HIT.face < 5) {
    const fl = Math.floor((z - .48) / o.fh), floor0 = .48 + fl * o.fh;
    if (fl >= 0 && fl < o.floors && brownstoneWindow(i, HIT.u, z, Math.min(.12, o.hl * .55), floor0 + o.fh * .25, floor0 + o.fh * .76,
      hash(fl, 7, sk0(o.seed)) > litT, L, p.trim)) return true;
  }
  let base = p.trim;
  if (o.kind === 'planter') base = BRICK;
  else if (o.kind === 'escape-platform') base = GRAY;
  else if (o.kind === 'service-spine') base = p.accent;
  BG[i] = C(base, (1.8 + L * .33) * shadeFace(HIT.face));
  set(i, HIT.face === 5 || o.kind === 'residential-cornice' || o.kind === 'balcony-slab' ? '=' :
    o.kind === 'service-spine' && fract(z * 18) < .08 ? '_' : ' ', C(base, L * .88));
  if (HIT.face === 5) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * .7,1,0,HIT.w);
  return true;
}
