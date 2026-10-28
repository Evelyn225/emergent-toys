// The native floor retains its walking plane and depth. Reuse the filtered
// timber material unchanged; rugs keep their authored sitting-area footprints.
function hotelFloorFinish(i,f,wx,wy,r,x,L) {
  const tier=room.def.tier,sofa=room.def.hotelAmenities.sofa,half=tier===2?2.6:1.65;
  const footprint=homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye);
  if(Math.abs(wx-sofa[0])<half&&wy>sofa[1]-2.1&&wy<sofa[1]+.6){
    const edge=Math.min(half-Math.abs(wx-sofa[0]),wy-sofa[1]+2.1,sofa[1]+.6-wy),filter=Math.max(.006,footprint);
    const border=1-smooth(clamp((edge-.15)/filter+.5,0,1)),fine=1-smooth(clamp((footprint-.003)/.015,0,1));
    const weave=fine?Math.sin(wx*180)*Math.sin(wy*180)*.08*fine:0;
    BG[i]=C(tier===2?GREEN:BLUE,1.1+L*.35+border*.8+weave);set(i,' ',0);return true;
  }
  return homeFloorWood(i,wx,wy,L,footprint,tier);
}
