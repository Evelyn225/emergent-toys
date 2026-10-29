// Apartment lobbies retain their native plan, neighbours and roof/exit actions.
// Reuse the prepared public-door fittings without changing hotel/home helpers.
const APTS_ENTRANCE_PROPS=ROOM_DEFS.apts.props,APTS_ENTRANCE_WALL=ROOM_DEFS.apts.wall;
ROOM_DEFS.apts.props=r=>{
  r.hotelEntranceExterior=hotelEntranceExterior(r);
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1),lift=HOTEL_ROOF_LIFT(r.def.ex,1);
  entry.apartmentEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  lift.apartmentLift=lift.hotelLift;delete lift.hotelLift;
  return [...APTS_ENTRANCE_PROPS(r),entry,lift];
};
ROOM_DEFS.apts.doorWall=true;
ROOM_DEFS.apts.wall=(...args)=>hotelEntranceGlass(args[0],args[1],args[3],args[5],args[6])||APTS_ENTRANCE_WALL(...args);
ROOM_DEFS.apts.liftWall=(i,u,uStep,z,d,mx,my,L)=>{
  BG[i]=C(GRAY,2.6+L*.2);set(i,' ',0);return true;
};
