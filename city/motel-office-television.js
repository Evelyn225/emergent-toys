// Reuse the fitted television unchanged, preparing only its wall-mounted
// parts once. The office set stays on, as the former painted screen did.
function MOTEL_OFFICE_TELEVISION(r) {
  const scale=.75,lift=.925,parts=[],draw=drawBox,model=TELEVISION(0,0,r,scale,Math.PI/2);
  drawBox=(b,shade,ray=rayBox)=>{
    if(b.tvRole==='foot-pad'||b.tvRole==='leg')return;
    const box={...b,z0:b.z0+lift,z1:b.z1+lift};
    if(b.planes)box.planes=b.planes.map(p=>[p[0],p[1],p[2],p[3]+p[2]*lift,p[4]]);
    const material=(i,t,L)=>{const z=HIT.w;HIT.w-=lift;try{return shade(i,t,L);}finally{HIT.w=z;}};
    parts.push({role:b.tvRole,box,view:{...box},shade:material,ray});
  };
  try{model.draw(0,0);}finally{drawBox=draw;}
  return {...ROOM_MODEL(9-.07*scale,6,hotelLobbyDraw(parts)),walk:true,radius:.76,motelTV:{parts,scale,lift}};
}
const MOTEL_TV_PROPS=ROOM_DEFS.motel.props,MOTEL_TV_WALL=ROOM_DEFS.motel.wall;
ROOM_DEFS.motel.props=r=>{r.tv=true;return [...MOTEL_TV_PROPS(r),MOTEL_OFFICE_TELEVISION(r)];};
ROOM_DEFS.motel.wall=(i,u,uStep,z,d,mx,my,L)=>{
  if(mx===room.W-1&&Math.abs(u-6)<.55&&z>1.45&&z<2.15){BG[i]=C(YEL,3.6+L*.15);set(i,' ',0);return true;}
  return MOTEL_TV_WALL(i,u,uStep,z,d,mx,my,L);
};
