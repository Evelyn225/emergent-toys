// What any room's walls fall back to where its own painter leaves them alone:
// a panelled timber dado and rail under plaster, with posters as plain printed
// sheets. Also the plain glass door and the ceilings many rooms share. No glyphs.
function sharedWallFinish(i,u,uStep,z,d,mx,my,L,posters,neon) {
  const footprint=Math.max(uStep,d/projY);set(i,' ',0);
  if(neon!==undefined&&z>2.75&&z<2.85){BG[i]=C(neon,12);return;}
  if(z<.9){BG[i]=C(BRICK,1.6+L*.16-2.5*coveGroove(u,.6,.025,footprint));return;}
  if(z<.95){BG[i]=C(BRICK,2.8+L*.2);return;}
  if(posters) {
    const fu=fract(u/1.2),fz=fract(z);
    if(hash(Math.floor(u/1.2),Math.floor(z),mx+my*10)>.8&&fu>.15&&fu<.85&&fz>.2&&fz<.8){BG[i]=C(ITEM_COL[hash(Math.floor(u/1.2),5)*8|0],2.4+L*.2);return;}
  }
  BG[i]=C(WHITE,2.6+L*.2);
}
function sharedGlassDoor(i,u,z,L) {
  set(i,' ',0);
  BG[i]=z>2.3||fract(u)<.08?C(GRAY,1.4+L*.2):C(day>.3?CYAN:WARM,2+day*4);
}
function sharedPendantCeil(i,on){BG[i]=on?C(WARM,14):C(BRICK,2);set(i,' ',0);}
// Coloured spots sweeping over a dark ceiling: they're big enough to read, and
// their hue changes as a whole so nothing flickers cell by cell.
function sharedDiscoCeil(i,wx,wy) {
  const on=hash(Math.floor(wx),Math.floor(wy),9)>.72;
  BG[i]=on?C(NEON[Math.floor(wx+wy*2+T*1.5)&3],4):C(GRAY,.5);set(i,' ',0);
}
function sharedDarkCeil(i){BG[i]=C(GRAY,.4);set(i,' ',0);}
