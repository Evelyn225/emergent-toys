// Clinical tile stays on the native floor plane; only the fine grout filters
// with distance. Real closed fluorescent fittings replace ceiling glyphs.
function hospitalFloorFinish(i,wx,wy,L,footprint) {
  const joint=Math.max(coveGroove(wx,.6,.004,footprint),coveGroove(wy,.6,.004,footprint));
  BG[i]=C(GRAY,2.8+L*.4-8*joint);set(i,' ',0);return true;
}
ROOM_FLOORS.hospitalClinical=(i,f,wx,wy,r,x,L)=>hospitalFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
ROOM_CEILS.hospitalClinical=i=>{BG[i]=C(WHITE,3.4+room.def.light);set(i,' ',0);};
const HOSPITAL_SURFACE_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>{
  const lights=[];
  for(const x of [3,7,11])for(const y of [2.7,6.9]){
    const o=CEILING_BATTEN(x,y,1.4,r.def.height||3);
    o.hospitalCeilingLight=o.ceilingBatten;delete o.ceilingBatten;lights.push(o);
  }
  return [...HOSPITAL_SURFACE_PROPS(r),...lights];
};
ROOM_DEFS.hospital.footstepFloor=ROOM_DEFS.hospital.floor;
ROOM_DEFS.hospital.floor=ROOM_DEFS.hospital.ceil='hospitalClinical';
