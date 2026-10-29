// Quiet flush tile and plaster replace the remaining floor/ceiling glyph fields.
// Existing filters and prepared flush light geometry are reused unchanged.
function apartmentLobbyFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,.5,.004,footprint),coveGroove(wy,.5,.004,footprint));
  BG[i]=C(GRAY,2+L*.4-6*joint);set(i,' ',0);return true;
}
ROOM_FLOORS.apartmentLobby=(i,f,wx,wy,r,x,L)=>apartmentLobbyFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
ROOM_CEILS.apartmentLobby=(i)=>{BG[i]=C(WHITE,3.4+room.def.light);set(i,' ',0);};
const APTS_SURFACE_PROPS=ROOM_DEFS.apts.props;
ROOM_DEFS.apts.props=r=>{
  const lights=[2.25,4.75].map(y=>HOTEL_CEILING_LIGHT(r.W/2,y,r.def.height||3,0));
  for(const o of lights){o.apartmentCeilingLight=o.hotelCeilingLight;delete o.hotelCeilingLight;}
  return [...APTS_SURFACE_PROPS(r),...lights];
};
ROOM_DEFS.apts.footstepFloor=ROOM_DEFS.apts.floor;
ROOM_DEFS.apts.floor=ROOM_DEFS.apts.ceil='apartmentLobby';
