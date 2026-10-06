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
  if (Math.min(along,width - along) < .08 || h - z < .07) {
    set(i,h - z < .07 ? '=' : '|',C(p.trim,L)); return true;
  }
  if (z < .43) {
    if (z > .33 && f.front) {
      const sg = Math.sign(u * wc) || 1;
      set(i,' ',0);
      wallText(i,u,uStep,z,d,sh.word,sg * (f.start + width / 2),.365,
        Math.min(.095,(width - .35) / Math.max(1,sh.word.length)),.055,C(japan ? WHITE : YEL,Math.max(L,open ? night * 13 : 0)),C(p.trim,2));
      return true;
    }
    if (architectureLeaseSign(i,u,uStep,z,d,wc,f,sh,L)) return true;
    if (f.front && Math.abs(local) < width / 2 - .15 && z > .03 && z < .32) {
      if (sh.kind !== SHOP_APTS && architectureShutter(i,z,sh,L)) return true;
      const door = local + width * .15, doorHalf = Math.min(.14,width * .12);
      if (Math.abs(door) < doorHalf) {
        if (japan && z > .225) {
          BG[i] = C(p.trim,2 + L * .22);
          set(i,Math.abs(door) < .012 ? ' ' : Math.abs(z - .267) < .016 ? 'o' : ' ',C(WHITE,L));
        } else {
          BG[i] = C(WARM,1.5 + night * 3);
          set(i,z > .295 ? '=' : ':',C(WARM,Math.max(L * .6,night * 11)));
        }
        return true;
      }
      const mullion = Math.abs(local - width * .12) < .014 || Math.abs(local + width * .35) < .014;
      if (z < .075) { set(i,'_',C(p.trim,L)); return true; }
      BG[i] = C(japan ? CYAN : GREEN,1 + day * .8 + night * 1.7);
      const shelf = Math.abs(z - .14) < .007 || Math.abs(z - .23) < .007;
      const glyphs = sh.glyphs || '#';
      set(i,mullion ? '|' : shelf ? '-' : grain > .74 ? glyphs[Math.floor(grain * glyphs.length)] : ' ',
        C(mullion || shelf ? p.trim : WARM,Math.max(L * .65,night * 10)));
      return true;
    }
  } else {
    const floor = Math.floor((z - .45) / f.fh), bottom = .45 + floor * f.fh, fz = (z - bottom) / f.fh;
    const bay = clamp(Math.floor((along - .08) / f.spacing),0,f.units - 1), center = .08 + (bay + .5) * f.spacing;
    const du = along - center, half = f.spacing * (japan && p.timber ? .34 : .25);
    if (floor < f.floors) {
      if (fz < .08 || japan && p.timber && Math.abs(du) > f.spacing * .46) {
        set(i,fz < .08 ? '=' : '|',C(japan && p.timber ? BRICK : p.trim,L * .75)); return true;
      }
      if (brownstoneWindow(i,du,z,half,bottom + f.fh * .22,bottom + f.fh * .78,hash(bay,floor,sk) > litT - .08,L,p.trim)) {
        if (!japan && Math.abs(du) < half && fz > .22 && fz < .78) {
          const fret = Math.abs(fract((du + half) / (2 * half) * 3) - .5) < .07 && (fz < .36 || fz > .65);
          if (fret) set(i,'+',C(p.trim,L));
        }
        return true;
      }
      if (!japan && Math.abs(du) > half + .03 && Math.abs(du) < half + .08 && fz > .22 && fz < .78) {
        BG[i] = C(p.trim,1 + L * .2); set(i,fract(z * 40) < .2 ? '-' : ' ',C(p.trim,L)); return true;
      }
    }
  }
  const tile = japan && !p.timber, joint = fract(wc * (tile ? 10 : 12) + (Math.floor(z * 20) & 1) * .5);
  set(i,fract(z * (tile ? 20 : 24)) < .055 ? '_' : joint < .025 ? '|' : grain > .985 ? '.' : ' ',C(p.wall,L * .65));
  return true;
}
function pavilionGlassShade(o, i, t, L) {
  const z = HIT.w, roof = !!o.planes, u = HIT.u, v = HIT.v;
  const nx = roof ? o.planes[HIT.face][0] : HIT.face <= 2 ? 1 : 0;
  const ny = roof ? o.planes[HIT.face][1] : HIT.face <= 2 ? 0 : 1;
  const wall = roof ? !o.planes[HIT.face][2] : HIT.face < 5;
  const along = Math.abs(nx) > Math.abs(ny) ? v : u;
  const bar = Math.abs(fract((along + (Math.abs(nx) > Math.abs(ny) ? o.hw : o.hl)) * 3) - .5) < .035 ||
    (wall ? fract(z * 5) < .055 : fract((Math.abs(nx) > Math.abs(ny) ? u : v) * 5) < .065);
  if (bar) {
    BG[i] = C(WHITE,2 + L * .22);
    set(i,wall ? '|' : Math.abs(nx) > Math.abs(ny) ? '/' : '-',C(WHITE,L));
  } else {
    // Stable foliage beneath the glazing, sky reflection above it. World coordinates prevent sliding textures.
    const leaf = noise((o.x + u) * 3,(o.y + v) * 3 + z * .6,879) > .56 && z < 1.7;
    BG[i] = C(leaf ? GREEN : CYAN,leaf ? 1.2 + L * .16 : 1 + day * 2.2);
    set(i,leaf ? '%' : fract((u + v) * 9) < .035 ? '/' : ' ',C(leaf ? GREEN : WHITE,L * (leaf ? .75 : .35)));
  }
  if (roof && o.planes[HIT.face][2] > 0) paintSettledSnow(i,o.x + u,o.y + v,L,.35,0,HIT.w);
  return true;
}
function pavilionDetailShade(o, i, t, L) {
  if (o.gh) {
    if (o.kind === 'glazing' || o.kind === 'clerestory') return pavilionGlassShade(o,i,t,L);
    BG[i] = C(GREEN,2 + L * .3); set(i,o.kind === 'crest' ? '^' : '|',C(WHITE,L)); return true;
  }
  const p = o.b.profile, z = HIT.w, face = HIT.face, top = o.planes ? o.planes[face][2] > 0 : face === 5;
  const base = o.kind === 'tiles' ? p.roof : o.kind === 'balcony' ? STONE : p.trim;
  if (o.kind === 'lattice') {
    const along = HIT.u, band = (z - o.z0) / (o.z1 - o.z0);
    const on = band > .87 || band < .1 || Math.abs(Math.sin(along * 40 + band * Math.PI * 2)) < .22;
    if (!on) return false;
    BG[i] = C(p.trim,1 + L * .17); set(i,band > .87 ? '=' : 'x',C(p.trim,L)); return true;
  }
  BG[i] = C(base,1.8 + L * (top ? .3 : .22));
  if (o.kind === 'shopboard' && face <= 4) {
    const along = face === 3 || face === 2 ? HIT.u : -HIT.u;
    if (face <= 2) { set(i,'|',C(YEL,L)); return true; }
    const word = o.b.sh.word, letterW = Math.min(.1,(o.hl * 2 - .12) / word.length), hz = (.39 - z) / .05;
    const ch = signGlyph(word,along / letterW + word.length / 2,hz,t,letterW,.05,farDepth(...R(o.x,o.y),o.hl));
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
    if (edge) ch = '|';
    else if (face <= 2 && letter >= 0 && letter < word.length)
      ch = signGlyph(word[letter],across / letterW + .5,fract(q),t,letterW,letterH,farDepth(...R(o.x,o.y),o.hw)) ?? ' ';
    set(i,ch,C(edge ? YEL : WHITE,Math.max(L,openAt(o.b.sh,tod) ? night * 14 : 0))); return true;
  }
  if (o.kind === 'tiles') {
    const end = o.planes && !o.planes[face][2];
    set(i,end ? '|' : fract(HIT.v * 15) < .14 ? ')' : fract(z * 35) < .15 ? '=' : ' ',C(end ? BRICK : p.roof,L * .85));
  } else if (o.kind === 'awning') {
    BG[i] = C(fract(HIT.u * 6) < .5 ? p.trim : STONE,2 + L * .25);
    set(i,top ? '/' : 'v',C(WHITE,L * .6));
  } else set(i,o.kind === 'ac' ? '#' : top || o.kind === 'eave' ? '=' : '|',C(o.kind === 'ac' ? GRAY : base,L));
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
