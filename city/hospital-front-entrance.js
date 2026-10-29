// Recovery and old saves can lack a shop cell or return to the ambulance.
// Match leaveRoom's canonical hospital, then view from its actual front wall.
function hospitalEntranceExterior(r) {
  const [rx,ry]=r.ret||[px,py];
  const site=SERVICES.filter(b=>b.kind==='amb').reduce((best,b)=>near(...b.door,rx,ry)<near(...best.door,rx,ry)?b:best);
  const x=site.door[0],y=site.door[1]+.11;
  return {x,y,nx:0,ny:-1,up:outdoorGroundHeight(x,y)};
}
const HOSPITAL_ENTRY_PROPS=ROOM_DEFS.hospital.props,HOSPITAL_ENTRY_WALL=ROOM_DEFS.hospital.wall;
ROOM_DEFS.hospital.props=r=>{
  r.hotelEntranceExterior=hospitalEntranceExterior(r);
  const entry=HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1);
  entry.hospitalEntrance=entry.hotelEntrance;delete entry.hotelEntrance;
  return [...HOSPITAL_ENTRY_PROPS(r),entry];
};
ROOM_DEFS.hospital.doorWall=true;
ROOM_DEFS.hospital.wall=(...args)=>hotelEntranceGlass(args[0],args[1],args[3],args[5],args[6])||HOSPITAL_ENTRY_WALL(...args);
