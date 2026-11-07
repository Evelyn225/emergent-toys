// Windows have complete bays, corner margins and a fitted top floor; geometry carries the balconies and escapes.
const MIDTOWN_MATERIALS = [STONE, GRAY, SKIN, WHITE, STONE];
function housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, wall, trim) {
  const width = f.end - f.start, center = width / 2, open = openAt(sh, tod);
  const g = architectureSignSpec(b, f, sh);
  if (z > .28 && architectureSignedFace(f, sh) && (!f.fascia || archFasciaPainted(g, d)) && wallText(i, u, uStep, z, d, sh.word, (Math.sign(u * wc) || 1) * (f.start + center), g.zc,
    g.cwid, g.band, C(trim, open ? Math.max(L, night * 10) : L * .5), C(wall, 2))) return; // (up close, the fascia board carries it)
  if (ghostSign(i, u, uStep, z, d, b, f, sh, (Math.sign(u * wc) || 1) * (f.start + center), wall, L)) return; // (shut for good: the old sign's shadow)
  const doorHalf = Math.min(.23, width * .17), door = Math.abs(along - center);
  if (f.front && sh.kind !== SHOP_APTS && shopDoor(i, along - center, z, sh, L, trim, d)) return; // (the shop's door, to the pavement)
  const fp = Math.max(uStep, d / projY);
  if (sh.kind !== SHOP_APTS && sh.kind !== SHOP_NEON && along > .14 && along < width - .14 && z < .325) { // a shop's front: its own style (shopfront-kit.js)
    const w0 = .14 + Math.floor((along - .14) / .48) * .48, w1 = Math.min(w0 + .48, width - .14);
    if (architectureShutter(i, z, sh, L, d, along, w0, w1, .045, .31)) return;
    if (d < SHOP_WINDOW.near * (shopSceneFor(sh) ? 1.6 : 1) && z > .07 && z < .27) { // up close, the display behind the glass (shop-windows.js), or a restaurant's room
      const sg = Math.sign(u * wc) || 1, ua = sg * (f.start + w0 + .03), ub = sg * (f.start + w1 - .03);
      if (shopWindow(i, u, z, Math.min(ua, ub), Math.max(ua, ub), .07, .27, sh, open, L, sk0(b.seed) + Math.floor(w0 * 9))) return;
    }
    return shopfrontBay(i, along - w0, w1 - w0, z, 0, .325, sh, L, fp, open && (night > .3 || overcast > .6), d);
  }
  if (z > .325 || z < .045 && !(f.front && sh.kind === SHOP_APTS && door < doorHalf)) { BG[i] = C(trim, 1.6 + L * .25); return set(i, ' ', 0); } // the head and the stallriser
  if (f.front && sh.kind === SHOP_APTS) {
    if (door < doorHalf && z < .30) { // (the lobby doors, to the pavement)
      const frame = Math.max(facadeLine(door, .018, fp), door > doorHalf - .015 ? 1 : 0, facadeLine(Math.abs(z - .16), .024, fp));
      BG[i] = frame > .5 ? C(trim, 1.5 + L * .25) : C(WARM, (1 + night * 3 + day * .5) * (1 - frame * .4)); return set(i, ' ', 0);
    }
    if (z > .08 && z < .26 && door > doorHalf + .06 && door < width * .36) {
      BG[i] = C(CYAN, 1 + night + day * .5);
      return set(i, ' ', 0);
    }
    return set(i, ' ', 0);
  }
  if (along > .14 && along < width - .14 && z < .31) {
    const w0 = .14 + Math.floor((along - .14) / .48) * .48;
    if (architectureShutter(i, z, sh, L, d, along, w0, Math.min(w0 + .48, width - .14), .045, .31)) return;
    const mullion = Math.abs(fract((along - .14) / .48) - .5) > .47;
    if (!mullion && d < SHOP_WINDOW.near * (shopSceneFor(sh) ? 1.6 : 1) && (sh.kind !== SHOP_NEON || shopSceneFor(sh))) { // up close, the display behind the glass (shop-windows.js), or a restaurant's room (shop-scenes.js)
      const a0 = .14 + Math.floor((along - .14) / .48) * .48, a1 = Math.min(a0 + .48, width - .14), sg = Math.sign(u * wc) || 1, ua = sg * (f.start + a0), ub = sg * (f.start + a1);
      if (shopWindow(i, u, z, Math.min(ua, ub), Math.max(ua, ub), .045, .31, sh, open, L, sk0(b.seed) + Math.floor(a0 * 9))) return;
    }
    const bar = facadeLine((.5 - Math.abs(fract((along - .14) / .48) - .5)) * .48, .028, fp);
    BG[i] = bar > .5 ? C(trim, 1.5 + L * .25) : C(sh.kind === SHOP_NEON ? sh.neon : CYAN, (1 + night * 2 + day * .5) * (1 - bar * .5));
    return set(i, ' ', 0);
  }
  return set(i, ' ', 0);
}
function residentialFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  const p = b.profile, r = f.residential, width = f.end - f.start, modern = b.sty === 16;
  const grain = hash(Math.floor(wc * 15), Math.floor(z * 24), sk0(b.seed));
  const patch = !modern && !p.brick && hash(Math.floor(wc * 2.6), Math.floor(z * 4), sk0(b.seed)) > .88;
  const wall = patch ? p.accent : p.wall;
  BG[i] = C(wall, 2.1 + L * (modern ? .34 : .27) + grain * .6);
  if (Math.min(along, width - along) < r.margin * .65)
    { BG[i] = C(p.trim, 2 + L * .3 - (!modern ? coveGroove(z, 1 / 13, .01, Math.max(uStep, d / projY)) * 1.1 : 0)); return set(i, ' ', 0); } // the corner quoins
  if (z < .44) return housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, wall, p.trim);
  const fpW = Math.max(uStep, d / projY);
  if (z > f.height - .095 || z < r.base) { BG[i] = C(p.trim, 2 + L * .3); return set(i, ' ', 0); } // the cornice and base course
  const unit = clamp(Math.floor((along - r.margin) / r.spacing), 0, r.units - 1);
  const local = along - r.margin - (unit + .5) * r.spacing;
  const fl = Math.floor((z - r.base) / r.fh), floor0 = r.base + fl * r.fh;
  if (fl < 0 || fl >= r.floors) return set(i, ' ', C(wall, L));
  if (modern) {
    if (unit === r.core) {
      BG[i] = C(p.accent, 1.8 + L * .25);
      if (Math.abs(local) < .05 && z > floor0 + r.fh * .25 && z < floor0 + r.fh * .7)
        return brownstoneWindow(i, local, z, .045, floor0 + r.fh * .25, floor0 + r.fh * .7, false, L, p.trim);
      BG[i] = C(p.accent, 1.8 + L * .25 - coveGroove(z, 1 / 18, .004, fpW)); return set(i, ' ', 0);
    }
    if (brownstoneWindow(i, local, z, r.spacing * .39, floor0 + r.fh * .13, floor0 + r.fh * .89,
      hash(unit, fl, sk0(b.seed)) > litT - .06, L, p.trim)) return;
    if (facadeLine(r.spacing / 2 - Math.abs(local), r.spacing * .08, fpW) > .5) BG[i] = C(p.trim, 1.8 + L * .3); // the panel joints between bays
    return set(i, ' ', 0);
  }
  const gap = r.spacing * .46, window = local < 0 ? 0 : 1, du = local - (window ? 1 : -1) * gap / 2;
  if (brownstoneWindow(i, du, z, Math.min(.12, gap * .30), floor0 + r.fh * .2, floor0 + r.fh * .83,
    hash(unit * 2 + window, fl, sk0(b.seed)) > litT - .1, L, p.trim)) return;
  if (Math.abs(z - floor0 - r.fh * .9) < .012 && Math.abs(local) < r.spacing * .4)
    { BG[i] = C(p.trim, 1.9 + L * .3); return set(i, ' ', 0); } // a sill course
  if (p.brick || patch) BG[i] = C(wall, (BG[i] & 15) - Math.max(coveGroove(z, 1 / 26, .004, fpW), coveGroove(wc + (Math.floor(z * 26) & 1) / 28, 1 / 14, .004, fpW)) * 1.1); // brick, its joints filtered
  return set(i, ' ', 0);
}
function midtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L) {
  if (b.sty === 14) return downtownFacade(i, u, uStep, z, d, wc, along, b, f, sh, L);
  const brick = b.sty === 2, glass = b.sty === 1;
  const base = brick ? [BRICK, SKIN, STONE, BRICK, GRAY][b.material] : MIDTOWN_MATERIALS[b.material];
  const width = f.end - f.start, margin = .12, corner = Math.min(along, width - along);
  BG[i] = C(base, 2 + L * .29);
  const fpW = Math.max(uStep, d / projY);
  if (corner < margin * .6 || z > f.height - .07) { BG[i] = C(base, 2.6 + L * .32); return set(i, ' ', 0); } // the corner piers and parapet
  if (z < .44) return housingGroundFacade(i, u, uStep, z, d, wc, along, b, f, sh, L, base, STONE);
  const bays = Math.max(1, Math.round((width - margin * 2) / (glass ? .68 : .74))), spacing = (width - margin * 2) / bays;
  const bay = clamp(Math.floor((along - margin) / spacing), 0, bays - 1), du = along - margin - (bay + .5) * spacing;
  const floors = Math.max(1, Math.floor((f.height - .58) / .36)), fh = (f.height - .58) / floors;
  const fl = Math.floor((z - .48) / fh), floor0 = .48 + fl * fh;
  if (fl >= 0 && fl < floors && brownstoneWindow(i, du, z, spacing * (glass ? .44 : .32), floor0 + fh * .18, floor0 + fh * .82,
    hash(bay, fl, sk0(b.seed)) > litT + (glass ? .05 : -.06), L, glass ? GRAY : STONE)) return;
  if (glass && Math.abs(du) > spacing * .44) { BG[i] = C(GRAY, 1.8 + L * .3); return set(i, ' ', 0); } // the curtain wall's mullions
  if (facadeLine(Math.abs(z - floor0), .032, fpW) > .5) { BG[i] = C(STONE, 1.6 + L * .25); return set(i, ' ', 0); } // floor bands
  if (brick) BG[i] = C(base, (BG[i] & 15) - coveGroove(z, 1 / 24, .004, fpW) * 1.1); // brick courses
  else if (facadeLine(spacing / 2 - Math.abs(du), spacing * .12, fpW) > .5) BG[i] = C(base, (BG[i] & 15) + .8); // the piers between bays
  return set(i, ' ', 0);
}
function residentialDetailShade(o, i, t, L) {
  const z = HIT.w, p = o.profile, rail = o.kind === 'balcony-rail' || o.kind === 'escape-rail' || o.kind === 'escape-flight-rail';
  if (o.kind === 'escape-drop') {
    if (Math.abs(HIT.u) < .016 && fract(z * 40) > .15) return false;
    BG[i] = C(GRAY, (1.2 + L * .15) * (Math.abs(HIT.u) < .016 ? 1.2 : 1)); set(i, ' ', 0); return true; // the drop ladder: rails and rungs in black iron
  }
  if (rail) {
    const top = o.kind === 'escape-flight-rail' ? o.mid + o.slope * HIT.u + o.railHeight : o.z1;
    const bottom = o.kind === 'escape-flight-rail' ? top - o.railHeight : o.z0;
    if (z < bottom || z > top + .006) return false;
    const bar = Math.abs(z - top) < .01 || Math.abs(z - bottom) < .008 || Math.abs(fract(HIT.u * (o.kind === 'balcony-rail' ? 5 : 16)) - .5) < .09;
    if (bar) { BG[i] = C(o.kind === 'balcony-rail' ? p.trim : GRAY, (1.3 + L * .18) * (Math.abs(z - top) < .01 ? 1.25 : 1)); set(i, ' ', 0); return true; } // rails and balusters, the handrail catching the light
    if (o.kind !== 'balcony-rail' || !p.glass || Math.abs(fract(HIT.u * 7 + z * 3) - .5) > .045) return false;
    BG[i] = C(CYAN, 1.2 + day * .8); set(i, ' ', 0); return true; // a glass panel's sheen
  }
  if (o.kind === 'escape-stair') {
    if (HIT.face >= 7 && fract((HIT.u + o.hl) * 55) < .28) return false;
    BG[i] = C(GRAY, (1.1 + L * .16) * (HIT.face >= 7 ? 1.2 : 1)); set(i, ' ', 0); return true; // the stair's treads lit, its stringers in shadow
  }
  if (o.kind === 'planter' || o.kind === 'planter-bracket') {
    const top = HIT.face === 5, fp = t / projY;
    const rim = top && (Math.abs(HIT.u) > o.hl - .007 || Math.abs(HIT.v) > o.hw - .007);
    const lip = !top && z > o.z1 - .009;
    const base = o.kind === 'planter-bracket' ? GRAY : top && !rim ? BRICK : o.windowBox ? GREEN : BRICK;
    const soil = top && !rim && o.kind === 'planter';
    BG[i] = C(base, soil ? .7 + L * .08 : (1.5 + L * .3) * shadeFace(HIT.face) + (rim || lip ? 1 : 0)
      - (!top && o.kind === 'planter' ? coveGroove(HIT.u, .035, .003, fp) * .7 : 0));
    set(i, ' ', 0);
    if (top) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * .7, 1, 0, z);
    return true;
  }
  if (o.kind === 'leaves') {
    const sn = seasonIdx(), h = (z - o.z0) / (o.z1 - o.z0), u = HIT.u / o.hl;
    const base = sn === 2 ? ORANGE : GREEN;
    const fine = clamp(1 - t / projY / .015, 0, 1);
    const clump = leafClump(u * 2 + o.seed * 7, h * 3) * fine;
    BG[i] = C(base, (1.2 + L * .23) * (.7 + h * .65 - u * .12 + clump) * (sn === 3 ? .7 : 1));
    set(i, ' ', 0);
    if (HIT.nz > .5) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * .7, HIT.nz, 0, z);
    return true;
  }
  if (o.kind === 'service-spine' && HIT.face < 5) {
    const fl = Math.floor((z - .48) / o.fh), floor0 = .48 + fl * o.fh;
    if (fl >= 0 && fl < o.floors && brownstoneWindow(i, HIT.u, z, Math.min(.12, o.hl * .55), floor0 + o.fh * .25, floor0 + o.fh * .76,
      hash(fl, 7, sk0(o.seed)) > litT, L, p.trim, t / projY)) return true;
  }
  let base = p.trim;
  if (o.kind === 'planter') base = BRICK;
  else if (o.kind === 'escape-platform') base = GRAY;
  else if (o.kind === 'service-spine') base = p.accent;
  BG[i] = C(base, (1.8 + L * .33) * shadeFace(HIT.face));
  if (o.kind === 'service-spine' && HIT.face < 5) BG[i] = C(base, (BG[i] & 15) - coveGroove(z, 1 / 18, .004, t / projY) * .6);
  set(i, ' ', 0);
  if (HIT.face === 5) paintSettledSnow(i, o.x + HIT.u * o.c - HIT.v * o.s, o.y + HIT.u * o.s + HIT.v * o.c, L * .7,1,0,HIT.w);
  return true;
}
