// Polished stone replaces the coarse checkerboard. The inset border is an
// actual world-space band, integrated across the native floor pixel footprint.
function bankFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,1,.004,footprint),coveGroove(wy,1,.004,footprint));
  const inset=Math.min(wx-1,room.W-1-wx,wy-1,room.H-1-wy),lo=inset-.42-footprint/2,hi=inset-.42+footprint/2;
  const border=clamp((Math.min(hi,.06)-Math.max(lo,-.06))/Math.max(footprint,.001),0,1);
  const vein=coveGroove(wx+.1*Math.sin(wy*2.2),2.3,.006,footprint);
  BG[i]=C(WHITE,3+L*.42-4*border-8*joint-.7*vein);set(i,' ',0);return true;
}
ROOM_FLOORS.bankHall=(i,f,wx,wy,r,x,L)=>bankFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
ROOM_CEILS.bankHall=i=>{BG[i]=C(WHITE,3.4+room.def.light);set(i,' ',0);};
const BANK_SURFACE_PROPS=ROOM_DEFS.bank.props;
ROOM_DEFS.bank.props=r=>{
  const lights=[];
  for(const x of [4,10])for(const y of [2.7,6.1]){
    const o=HOTEL_CEILING_LIGHT(x,y,r.def.height||3,2);
    o.bankCeilingLight=o.hotelCeilingLight;delete o.hotelCeilingLight;lights.push(o);
  }
  return [...BANK_SURFACE_PROPS(r),...lights];
};
ROOM_DEFS.bank.footstepFloor=ROOM_DEFS.bank.floor;
ROOM_DEFS.bank.floor=ROOM_DEFS.bank.ceil='bankHall';
