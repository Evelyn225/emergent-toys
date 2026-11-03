// Merchant facades use complete bays fitted to actual faces, with a single shop name and entrance per frontage.
function merchantFacade(i, u, uStep, z, h, d, side, mx, my, fog, wc) {
  const k = idx(mx,my), sh = SHOP[k], b = MERCHANT_BY_SHOP.get(sh);
  if (!b) return false;
  const dir = side ? (rel(py - my) < 0 ? 0 : 1) : (rel(px - mx) < 0 ? 2 : 3), f = MERCHANT_FACES[dir][k];
  if (!f || f.height !== h) return false;
  const p = b.profile, width = f.end - f.start, along = rel(wc - f.start), local = along - width / 2;
  const L = fog * amb * (side ? 11 : 15), japan = b.region === 'shotengai', open = openAt(sh,tod), sk = sk0(b.seed);
  const grain = hash(Math.floor(wc * 18),Math.floor(z * 30),sk);
  BG[i] = C(p.wall,2.2 + L * .28 + grain * .45);
  const fpM = Math.max(uStep, d / projY);
  if (Math.min(along,width - along) < .08 || h - z < .07) { BG[i] = C(p.trim, 2 + L * .3); set(i,' ',0); return true; } // the corner piers and cornice
  if (z > .28 && z < .49 && architectureSignedFace(f, sh)) {
    const sg = Math.sign(u * wc) || 1, zc = f.front ? .4275 : .365;
    if (wallText(i,u,uStep,z,d,sh.word,sg * (f.start + width / 2),zc,
      Math.min(.095,(width - .35) / Math.max(1,sh.word.length)),.055,C(japan ? WHITE : YEL,Math.max(L,open ? night * 13 : 0)),C(p.trim,2))) return true;
  }
  if (z < .43) {
    const door = local + width * .15, doorHalf = Math.min(.14,width * .12);
    if (f.front && Math.abs(door) < doorHalf + .012 && z < .27) { // the way in: down to the pavement, under the awning
      if (sh.kind !== SHOP_APTS && architectureShutter(i,z,sh,L,d,door,-doorHalf - .012,doorHalf + .012,0,.27)) return true;
      if (Math.abs(door) > doorHalf || z > .255) { BG[i] = C(p.trim,1.4 + L * .25); set(i,' ',0); return true; } // the door frame
    }
    if (f.front && Math.abs(local) < width / 2 - .15 && (z > .03 || Math.abs(door) < doorHalf) && z < .32) {
      if (sh.kind !== SHOP_APTS && architectureShutter(i,z,sh,L,d,local,.15 - width / 2,width / 2 - .15,.03,.32)) return true;
      if (Math.abs(door) < doorHalf && z < .255) {
        if (japan && z > .225) { // a noren over the door: split in the middle
          BG[i] = Math.abs(door) < .012 ? C(WARM, 2 + night * 3) : C(p.trim,2 + L * .22); set(i,' ',0);
        } else doorGlass(i,door,z,open,L,p.trim,fpM);
        return true;
      }
      set(i,' ',0);
      const mullion = Math.max(facadeLine(Math.abs(local - width * .12), .028, fpM), facadeLine(Math.abs(local + width * .35), .028, fpM));
      if (z < .075) { BG[i] = C(p.trim, 1.6 + L * .25); return true; } // the stallriser
      if (shopSceneFor(sh)) { // a restaurant, café, bar...: its room behind the glass, between the mullions
        if (mullion > .5) { BG[i] = C(p.trim, 1.5 + L * .25); return true; }
        const sg = Math.sign(u * wc) || 1, ua = u + sg * (.15 - width / 2 - local), ub = u + sg * (width / 2 - .15 - local);
        shopWindow(i, u, z, Math.min(ua, ub), Math.max(ua, ub), .075, .32, sh, open, L, sk); return true;
      }
      const shelf = Math.max(facadeLine(Math.abs(z - .14), .014, fpM), facadeLine(Math.abs(z - .23), .014, fpM));
      if (mullion > .5 || shelf > .5) { BG[i] = C(p.trim, 1.5 + L * .25); return true; }
      // the window: goods on its shelves up close (each a block of its own colour), glass tinted by the shop's light far off
      const fine = clamp(1 - fpM / .03, 0, 1), goods = fine > .3 && grain > .74;
      BG[i] = goods ? C(ITEM_COL[Math.floor(grain * 97) & 7], 1.6 + L * .14 + night * 2) : C(japan ? CYAN : GREEN,(1 + day * .8 + night * 1.7) * (1 - (mullion + shelf) * .3));
      return true;
    }
  } else {
    const floor = Math.floor((z - .45) / f.fh), bottom = .45 + floor * f.fh, fz = (z - bottom) / f.fh;
    const bay = clamp(Math.floor((along - .08) / f.spacing),0,f.units - 1), center = .08 + (bay + .5) * f.spacing;
    const du = along - center, half = f.spacing * (japan && p.timber ? .34 : .25);
    if (floor < f.floors) {
      if (fz < .08 || japan && p.timber && Math.abs(du) > f.spacing * .46) { // floor bands; a timber front's posts
        BG[i] = C(japan && p.timber ? BRICK : p.trim, 1.8 + L * .28); set(i,' ',0); return true;
      }
      if (brownstoneWindow(i,du,z,half,bottom + f.fh * .22,bottom + f.fh * .78,hash(bay,floor,sk) > litT - .08,L,p.trim,fpM)) {
        if (!japan && Math.abs(du) < half && fz > .22 && fz < .78) { // a fretwork grille over the top and bottom of the glass
          const fret = facadeLine(Math.abs(fract((du + half) / (2 * half) * 3) - .5) * (2 * half) / 3, (2 * half) / 3 * .14, fpM) > .5 && (fz < .36 || fz > .65);
          if (fret) BG[i] = C(p.trim, 1.6 + L * .25);
        }
        return true;
      }
      if (!japan && Math.abs(du) > half + .03 && Math.abs(du) < half + .08 && fz > .22 && fz < .78) { // louvred shutters beside it
        BG[i] = C(p.trim,1.3 + L * .22 - coveGroove(z, 1 / 40, .005, fpM) * .8); set(i,' ',0); return true;
      }
    }
  }
  const tile = japan && !p.timber, cz = tile ? 1 / 20 : 1 / 24; // tile or brick, the joints filtered so it settles to its colour
  const j = Math.max(coveGroove(z, cz, cz * .05, fpM), coveGroove(wc + (Math.floor(z / cz) & 1) * (tile ? .05 : 1 / 24), tile ? .1 : 1 / 12, .003, fpM));
  BG[i] = C(p.wall, (BG[i] & 15) - j * 1.1); set(i,' ',0);
  return true;
}
function pavilionGlassShade(o, i, t, L) {
  const z = HIT.w, roof = !!o.planes, u = HIT.u, v = HIT.v;
  const nx = roof ? o.planes[HIT.face][0] : HIT.face <= 2 ? 1 : 0;
  const ny = roof ? o.planes[HIT.face][1] : HIT.face <= 2 ? 0 : 1;
  const wall = roof ? !o.planes[HIT.face][2] : HIT.face < 5;
  const along = Math.abs(nx) > Math.abs(ny) ? v : u;
  // glazing bars as colour, filtered by the cell's footprint so they thin to a tint far off rather than flicker
  const fp = t / projY, mu = Math.abs(fract((along + (Math.abs(nx) > Math.abs(ny) ? o.hw : o.hl)) * 3) - .5) / 3;
  const tq = wall ? fract(z * 5) / 5 : fract((Math.abs(nx) > Math.abs(ny) ? u : v) * 5) / 5;
  const bar = Math.max(roadLine(mu, .0233, fp), roadLine(tq - (wall ? .0055 : .0065), wall ? .011 : .013, fp));
  if (bar > .5) {
    BG[i] = C(WHITE,2 + L * .22 + (wall && tq > .006 ? -.5 : 0)); // the bars, a transom's underside in shadow
    set(i,' ',0);
  } else {
    // Stable foliage beneath the glazing, sky reflection above it. World coordinates prevent sliding textures.
    const leaf = noise((o.x + u) * 3,(o.y + v) * 3 + z * .6,879) > .56 && z < 1.7;
    const lv = leaf ? noise((o.x + u) * 9,(o.y + v) * 9 + z * 2,880) : 0, streak = !leaf && fract((u + v) * 9) < .08;
    BG[i] = C(leaf ? GREEN : CYAN,leaf ? 1.2 + L * .16 + (lv > .5 ? .7 : 0) : 1 + day * 2.2 + (streak ? .8 + day : 0) + bar * .6); // leaves in clumps; the sky sliding across the panes
    set(i,' ',0);
  }
  if (roof && o.planes[HIT.face][2] > 0) paintSettledSnow(i,o.x + u,o.y + v,L,.35,0,HIT.w);
  return true;
}
function pavilionDetailShade(o, i, t, L) {
  if (o.gh) {
    if (o.kind === 'glazing' || o.kind === 'clerestory') return pavilionGlassShade(o,i,t,L);
    BG[i] = C(o.kind === 'crest' ? WHITE : GREEN,(2 + L * .3) * shadeFace(HIT.face)); set(i,' ',0); return true; // posts green, the cresting white
  }
  const p = o.b.profile, z = HIT.w, face = HIT.face, top = o.planes ? o.planes[face][2] > 0 : face === 5;
  const base = o.kind === 'tiles' ? p.roof : o.kind === 'balcony' ? STONE : p.trim;
  if (o.kind === 'lattice') {
    const along = HIT.u, band = (z - o.z0) / (o.z1 - o.z0);
    const on = band > .87 || band < .1 || Math.abs(Math.sin(along * 40 + band * Math.PI * 2)) < .22;
    if (!on) return false;
    BG[i] = C(p.trim,(band > .87 ? 1.8 : 1.4) + L * .2); set(i,' ',0); return true; // the lattice's rail and its crossed slats
  }
  BG[i] = C(base,1.8 + L * (top ? .3 : .22));
  if (o.kind === 'shopboard' && face <= 4) {
    const along = face === 3 || face === 2 ? HIT.u : -HIT.u;
    if (face <= 2) { BG[i] = C(YEL, 2.4 + L * .25); set(i,' ',0); return true; } // the board's gilt ends
    const word = o.b.sh.word, letterW = Math.min(.1,(o.hl * 2 - .12) / word.length), zc = (o.z0 + o.z1) / 2;
    const hz = (zc + .025 - z) / .05, normal = face === 3 ? 1 : -1;
    const [vx, vy] = R(o.x - o.s * o.hw * normal,o.y + o.c * o.hw * normal);
    const ch = signLine(word,along / letterW + word.length / 2,hz,i,zc,midDepth(vx,vy),t,letterW,.05,farDepth(vx,vy,o.hl),...faceDir(o.c,o.s));
    set(i,ch ?? ' ',C(o.b.region === 'chinatown' ? YEL : WHITE,Math.max(L,openAt(o.b.sh,tod) ? night * 13 : 0))); return true;
  }
  if (o.kind === 'blade') {
    let across = face <= 2 ? HIT.v : HIT.u;
    if (face === 2 || face === 4) across = -across;
    const word = o.b.sh.word, letterW = .06;
    const letterH = Math.min(.075,(o.z1 - o.z0 - .055) / word.length), q = (o.z1 - .0275 - z) / letterH;
    const letter = Math.floor(q);
    const edge = Math.abs(across) > (face <= 2 ? o.hw : o.hl) - .008;
    let ch = ' ';
    if (edge) { BG[i] = C(YEL, 2.4 + L * .25); set(i,' ',0); return true; } // the blade's gilt edge
    if (face <= 2 && letter >= 0 && letter < word.length)
      ch = signGlyph(word[letter],across / letterW + .5,fract(q),t,letterW,letterH,farDepth(...R(o.x,o.y),o.hw)) ?? ' ';
    set(i,ch,C(WHITE,Math.max(L,openAt(o.b.sh,tod) ? night * 14 : 0))); return true;
  }
  const fpP = t / projY;
  if (o.kind === 'tiles') { // a tiled roof: rows of round tiles, their ridges filtered; plain brick on the gable ends
    const end = o.planes && !o.planes[face][2];
    BG[i] = end ? C(BRICK, 1.6 + L * .2) : C(p.roof, 1.6 + L * .22 - Math.max(coveGroove(HIT.v, 1 / 15, .009, fpP), coveGroove(z, 1 / 35, .004, fpP)) * 1.1);
  } else if (o.kind === 'awning') { // striped canvas, its valance a little darker
    BG[i] = C(fract(HIT.u * 6) < .5 ? p.trim : STONE,(2 + L * .25) * (top ? 1 : .85));
  } else if (o.kind === 'ac') BG[i] = C(GRAY, 1.5 + L * .2 - coveGroove(z, .01, .002, fpP) * .8); // an air-conditioner, its grille
  else BG[i] = C(base, (1.6 + L * .25) * (top || o.kind === 'eave' ? 1.1 : 1));
  set(i,' ',0);
  if (top) paintSettledSnow(i,o.x + HIT.u * o.c - HIT.v * o.s,o.y + HIT.u * o.s + HIT.v * o.c,L,.65,0,HIT.w);
  return true;
}
function drawPavilions() {
  forNear(pavilionSolidsB,o => {
    const vx = rel(o.x - px), vy = rel(o.y - py), distance = Math.hypot(vx,vy);
    if (distance > (o.gh || o.walkRoof ? vis + 3 : 12)) return;
    let intersect = rayBox;
    if (o.planes) intersect = rayMansard;
    drawBox({ ...o,x: vx,y: vy },(i,t,L) => pavilionDetailShade(o,i,t,L),intersect);
  });
}
