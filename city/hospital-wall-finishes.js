// Quiet plaster over washable tile. Filter fine grout in both screen axes;
// the guide rail is actual fitted geometry, not a stripe painted on the wall.
function hospitalWallFinish(i,u,uStep,z,d,mx,my,L) {
  const footprint=Math.max(uStep,d/projY),joint=z<1.15?Math.max(coveGroove(u,.3,.003,footprint),coveGroove(z,.15,.002,footprint)):0;
  BG[i]=z<1.15?C(GREEN,2.6+L*.22-12*joint):C(WHITE,3.4+L*.15);
  set(i,' ',0);return true;
}
const HOSPITAL_FINISH_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>{
  const props=HOSPITAL_FINISH_PROPS(r);
  // Only the fitter sees this proxy. Keep the native room's doors, materials
  // and interactions intact, with the entrance cut out below its header.
  const layout={...r,grid:r.grid.map(row=>row.replace(/E/g,'D')),
    def:{...r.def,tier:1,height:r.def.height||3,builtSkirting:true,builtCornices:true},
    props:[...props,{box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)}]};
  const trim=[...homeSkirting(layout),...homeCornices(layout),
    ...homeWallMoulding(layout,[[.91,.93,.025],[.93,.97,.035],[.97,.99,.025]],false,'homeChairRail')];
  for(const o of trim)for(const[a,b]of [['homeSkirting','hospitalSkirting'],['homeCornice','hospitalCornice'],['homeChairRail','hospitalWallGuard']])if(o[a]){o[b]=o[a];delete o[a];}
  return [...props,...trim];
};
ROOM_DEFS.hospital.wall=hospitalWallFinish;
