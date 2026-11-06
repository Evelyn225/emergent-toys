// Roller shutters: a shop shut for the night (or for good) pulls a slatted steel curtain down over its windows and
// door. It runs in guide rails set 8 cm back in the reveal, from the housing box it rolls up into at the head of the
// opening: ribbed slats, each lip catching the light and the crease under it in shadow, a heavier bottom bar with the
// padlock in the middle. Most are galvanised; some are painted green, blue or red. Further off the slats blur into
// an even ribbed texture. Shared by every facade family (through architectureShutter, or directly).
// a: across the opening (the caller's along-the-wall coordinate), a0..a1 its sides; z0..z1 its sill and head;
// sa: how far a ray drifts along a per unit of depth (WH.sl when a runs with the wall's u, as every facade's along does)
const SHOP_SHUTTER = { dep: .008, slat: .009, housing: .022, rail: .004, bar: .012, lock: .006 };
const SHUTTER_PAINT = [GRAY, GRAY, GRAY, GRAY, GREEN, BLUE, BRICK], SHUTTER_PAINT_OF = new WeakMap();
function shutterPaint(sh) { // one colour for all of a shop's shutters: from its name and its building
  let p = SHUTTER_PAINT_OF.get(sh);
  if (p === undefined) {
    let h = Math.floor((sh.architecture?.seed ?? 0) * 1e3);
    for (const ch of sh.word) h = (h * 31 + ch.charCodeAt(0)) | 0;
    SHUTTER_PAINT_OF.set(sh, p = SHUTTER_PAINT[(hash(h & 0xffff, (h >>> 16) & 0xffff, 1501) * SHUTTER_PAINT.length) | 0]);
  }
  return p;
}
const ABANDONED_SHUTTER_STYLES = new WeakMap();
function abandonedShutterStyle(sh) {
  let style=ABANDONED_SHUTTER_STYLES.get(sh);
  if(style)return style;
  let seed=Math.floor((sh.architecture?.seed??0)*1e3);
  for(const ch of sh.word)seed=(seed*31+ch.charCodeAt(0))|0;
  const q=hash(seed&0xffff,(seed>>>16)&0xffff,1517),kind=Math.floor(q*3);
  const texture=new Uint8Array(64*64),totals=new Uint16Array(4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const v=y/64,patch=hash(x>>3,Math.floor(y/5),seed)+hash(Math.floor(x/3),y>>1,seed+1)*.35;
    const foot=.08+hash(x>>2,1,seed+2)*.16;
    let material=0;
    if(kind===0){if(v<foot||patch>.96)material=1;if(v>=foot&&patch>1.19)material=2;}
    else if(kind===1){if(patch>.75)material=2;if(v<foot||patch>.65&&patch<.74)material=1;}
    else {if(patch>1.04)material=2;if(v<foot)material=1;}
    if(v<.055&&hash(x>>1,0,seed+3)>.4)material=3;
    const run=v>.15&&v<.8&&hash(x>>1,2,seed+4)>.9;
    texture[y*64+x]=material+(run?4:0);totals[material]++;
  }
  const maps=[texture];
  for(let size=32;size>=1;size>>=1){
    const prior=maps.at(-1),next=new Uint8Array(size*size),stride=size*2;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*2*stride+x*2,a=prior[i],b=prior[i+1],c=prior[i+stride],d=prior[i+stride+1];
      next[y*size+x]=b===c||b===d?b:c===d?c:a;
    }
    maps.push(next);
  }
  let dominant=0;for(let j=1;j<4;j++)if(totals[j]>totals[dominant])dominant=j;
  maps.at(-1)[0]=dominant;
  style={kind,paint:[BLUE,GREEN,GRAY][Math.floor(q*7)%3],maps,dent:.35+q*.3};
  ABANDONED_SHUTTER_STYLES.set(sh,style);return style;
}
// A cached stepped flake/rust map follows the shutter's steel, with smaller
// fragments disappearing into its mip levels at distance. Broad stains at the
// foot survive; existing rails, lock, recess and openings retain their depth.
function abandonedShutterTint(sh,a,z,a0,a1,z0,z1,L,d,col) {
  const s=abandonedShutterStyle(sh),u=fract((a-a0)/(a1-a0)+fract(a0*.83)),v=clamp((z-z0)/(z1-z0),0,.9999);
  let footprint=d/projY*64/Math.min(a1-a0,z1-z0),lod=0;
  while(footprint>2&&lod<6){footprint*=.5;lod++;}
  const size=64>>lod,mark=s.maps[lod][Math.floor(v*size)*size+Math.floor(u*size)],material=mark&3;
  const base=material===1?BRICK:material===3?GREEN:material===2?(s.kind===0?ORANGE:GRAY):s.kind===0?GRAY:s.paint;
  let level=(col&15)+(material===1?.5:material===2?1:material===3?-1:0);
  if(mark&4)level-=1;
  // Older heavy curtains have wider courses; deposits catch the rolled lips.
  const course=SHOP_SHUTTER.slat*2;
  if(course*projY/d>1.5){const q=fract((z1-z)/course);if(q<.25)level+=1;else if(q>.8)level-=1;}
  if(lod<2){const dx=u-s.dent,dy=(v-.53)*1.7;if(dx*dx+dy*dy<.008)level+=dx<0?1:-1;}
  return C(base,level);
}
function shopShutter(i, a, z, a0, a1, z0, z1, sh, L, d, sa = WH.sl) {
  const w = SHOP_SHUTTER, paint = shutterPaint(sh), top = z1 - w.housing;
  if (z > top) { // the housing, its lower lip
    BG[i] = C(GRAY, 1.5 + L * .12 + day * .3);
    if (z - top < .004) BG[i] = C(GRAY, 1 + L * .1); // its lower lip, in shadow
    return set(i, ' ', 0), true;
  }
  let ca = a, cz = z;
  if (d < SHOP_WINDOW.near) { // up close: set back in the reveal, the rails and the head either side of it
    const sz = (z - eye) / WH.dn;
    let q = w.dep, s = 'back';
    if (sa > 1e-6 && (a1 - a) / sa < q) { q = (a1 - a) / sa; s = 'side'; }
    if (sa < -1e-6 && (a0 - a) / sa < q) { q = (a0 - a) / sa; s = 'side'; }
    if (sz > 1e-6 && (top - z) / sz < q) { q = (top - z) / sz; s = 'ceil'; }
    if (sz < -1e-6 && (z0 - z) / sz < q) { q = (z0 - z) / sz; s = 'floor'; }
    if (s === 'side') { BG[i] = C(GRAY, .9 + L * .1); return set(i, ' ', 0), true; } // the guide rail's channel
    if (s === 'ceil') { BG[i] = C(GRAY, .5); return set(i, ' ', 0), true; } // under the housing
    if (s === 'floor') { BG[i] = C(GRAY, 1 + L * .1); return set(i, ' ', 0), true; } // the sill
    ca = a + sa * q; cz = z + sz * q;
  }
  const fine = w.slat * projY / d; // (rows a slat spans on screen)
  if (ca - a0 < w.rail || a1 - ca < w.rail) { BG[i] = C(GRAY, 1.2 + L * .12); return set(i, ' ', 0), true; } // its edges in the rails
  if (cz - z0 < w.bar) { // the bottom bar, the padlock through it
    const lock = fine > 1 && Math.abs(ca - (a0 + a1) / 2) < w.lock && cz - z0 > .002 && cz - z0 < w.bar - .002;
    BG[i] = lock ? C(YEL, 1.4 + L * .08) : C(paint, 1.8 + L * .15);
    if (!lock && cz - z0 < .002) BG[i] = C(paint, 1.2 + L * .1); // its foot, in shadow
    if(!lock&&sh.kind===SHOP_SHUT)BG[i]=abandonedShutterTint(sh,ca,cz,a0,a1,z0,top,L,d,BG[i]);
    return set(i, ' ', 0), true;
  }
  if (fine < 2) {
    BG[i] = C(paint, 1.2 + L * .12 + day * .4);
    if(sh.kind===SHOP_SHUT)BG[i]=abandonedShutterTint(sh,ca,cz,a0,a1,z0,top,L,d,BG[i]);
    return set(i, ' ', 0), true;
  } // too far to make out each slat: their ribs as one even panel
  const q = fract((top - cz) / w.slat), lip = q < .22, crease = q > .84;
  BG[i] = C(paint, (crease ? .7 : lip ? 1.9 : 1.3) + L * .12 + day * .4);
  if(sh.kind===SHOP_SHUT)BG[i]=abandonedShutterTint(sh,ca,cz,a0,a1,z0,top,L,d,BG[i]);
  return set(i, ' ', 0), true;
}
