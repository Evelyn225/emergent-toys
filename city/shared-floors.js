// The four floors most shops, restaurants and leisure rooms share, without their
// glyph fields. Style names stay, so footsteps and room definitions don't change.
function sharedTileFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,.6,.004,footprint),coveGroove(wy,.6,.004,footprint));
  const check=footprint>.3?.5:(Math.floor(wx/.6)+Math.floor(wy/.6))&1; // (its average once a pixel spans most of a tile)
  BG[i]=C(GRAY,2.6+check*1+L*.28-7*joint);set(i,' ',0);return true;
}
function sharedConcreteFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,4,.008,footprint),coveGroove(wy,4,.008,footprint));
  BG[i]=C(GRAY,1.9+L*.22-6*joint);set(i,' ',0);return true;
}
// Loud loop-pile with a repeat of coloured flecks. They go before they can shimmer.
function sharedCarpetFinish(i,wx,wy,L,footprint) {
  set(i,' ',0);
  const pile=1.3+L*.14;
  if(footprint<.12) {
    const h=hash(Math.floor(wx*4),Math.floor(wy*4),77);
    if(h>.72){BG[i]=C(NEON[h*40&3],pile+.6);return true;}
  }
  BG[i]=C(GRAY,pile);return true;
}
const sharedFloorDepth=r=>homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye);
Object.assign(ROOM_FLOORS,{
  tile:(i,f,wx,wy,r,x,L)=>sharedTileFinish(i,wx,wy,L,sharedFloorDepth(r)),
  concrete:(i,f,wx,wy,r,x,L)=>sharedConcreteFinish(i,wx,wy,L,sharedFloorDepth(r)),
  carpet:(i,f,wx,wy,r,x,L)=>sharedCarpetFinish(i,wx,wy,L,sharedFloorDepth(r)),
  // The loft's boards, with the fitted floors' filtering and light response.
  wood:(i,f,wx,wy,r,x,L)=>{homeFloorWood(i,wx,wy,L,sharedFloorDepth(r),1);return true;},
});
