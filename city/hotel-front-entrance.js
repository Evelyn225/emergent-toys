// Paired glass leaves frame the native exit cells; they add no walking collider.
// Only the unobstructed glass carries the existing lightweight neighbourhood ray.
function HOTEL_FRONT_ENTRANCE(x,y,frameColor=GRAY) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,frameColor);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.3+L*.06);set(i,' ',0);return true;};
  const sign=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.08);if(HIT.face===4&&hotelFittingText(i,-HIT.u,HIT.w,t,'EXIT',0,2.515,.19,.24,C(GREEN,12),BG[i],-1))return true;set(i,' ',0);return true;};
  const box=(role,u,v,a,b,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=-v;};
  box('threshold',0,.055,1,.055,0,.025,.006,metal);
  for(const e of [-1,1])box('jamb',e*.93,.055,.07,.055,.025,2.20,.008,metal);
  box('head',0,.055,1,.055,2.20,2.32,.008,metal);
  box('gasket',0,.026,.006,.012,.025,2.20,0,dark);
  for(const e of [-1,1]){
    for(const z of [[.025,.125],[2.12,2.20]])box('rail',e*.4305,.042,.4245,.018,z[0],z[1],.004,metal);
    for(const u of [e*.038,e*.822]){
      box('stile',u,.042,.032,.018,.125,2.12,.004,metal);
      hotelLobbyTube(parts,'bar-post',u,-.060,1.05,u,-.125,1.05,.009,metal);
    }
    hotelLobbyTube(parts,'push-bar',e*.038,-.125,1.05,e*.822,-.125,1.05,.013,metal);
  }
  box('sign',0,.012,.40,.012,2.38,2.65,0,sign);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.16,hotelEntrance:{parts,half:1,top:2.32}};
}
function hotelEntranceExterior(r) {
  const e=homeExterior(r),ret=r.ret||[e.x0-.1,(e.y0+e.y1)/2];
  const candidates=[{x:e.x0-.01,y:clamp(ret[1],e.y0,e.y1),nx:-1,ny:0},{x:e.x1+.01,y:clamp(ret[1],e.y0,e.y1),nx:1,ny:0},{x:clamp(ret[0],e.x0,e.x1),y:e.y0-.01,nx:0,ny:-1},{x:clamp(ret[0],e.x0,e.x1),y:e.y1+.01,nx:0,ny:1}];
  candidates.sort((a,b)=>Math.hypot(a.x-ret[0],a.y-ret[1])-Math.hypot(b.x-ret[0],b.y-ret[1]));
  const v=candidates[0];v.up=outdoorGroundHeight(v.x,v.y);return v;
}
function hotelLobbyCityView(i,u,z) {
  const e=room.hotelEntranceExterior,offset=(Math.abs(u)-room.W/2)/10;
  homeCityView(i,e.x+e.ny*offset,e.y-e.nx*offset,e.up+z/10,e.nx+e.ny*WH.sl,e.ny-e.nx*WH.sl,(z-eye)/WH.dn);
}
function hotelEntranceGlass(i,u,z,mx,my) {
  if(my===room.H-1&&roomAt(mx,my)==='D'&&z>.025&&z<2.20){hotelLobbyCityView(i,u,z);return true;}
  return false;
}
function hotelEntranceWall(i,u,uStep,z,d,mx,my,L) {
  if(hotelEntranceGlass(i,u,z,mx,my))return true;
  return hotelLobbyWallFinish(i,u,uStep,z,d,mx,my,L);
}
const HOTEL_ENTRANCE_PROPS=ROOM_DEFS.hotel.props;
ROOM_DEFS.hotel.props=r=>{r.hotelEntranceExterior=hotelEntranceExterior(r);return [...HOTEL_ENTRANCE_PROPS(r),HOTEL_FRONT_ENTRANCE(7,r.H-1)];};
ROOM_DEFS.hotel.doorWall=true;
ROOM_DEFS.hotel.wall=hotelEntranceWall;
