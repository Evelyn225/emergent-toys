// The Grand lobby uses the same fitted glass-door geometry, in brass, at its
// own native D cells. Its existing room finish and leaving behavior remain.
const GRAND_ENTRY_PROPS=ROOM_DEFS.grandhotel.props,GRAND_ENTRY_WALL=ROOM_DEFS.grandhotel.wall;
ROOM_DEFS.grandhotel.props=r=>{r.hotelEntranceExterior=hotelEntranceExterior(r);return [...GRAND_ENTRY_PROPS(r),HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1,YEL)];};
ROOM_DEFS.grandhotel.doorWall=true;
ROOM_DEFS.grandhotel.wall=(i,u,uStep,z,d,mx,my,L)=>hotelEntranceGlass(i,u,z,mx,my)||GRAND_ENTRY_WALL(i,u,uStep,z,d,mx,my,L);
