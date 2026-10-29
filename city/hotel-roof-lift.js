// The native E cells retain collision and roof travel. Fitted closed doors and
// hardware replace the painted lift; all bounds/materials prepare once.
function HOTEL_ROOF_LIFT(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.3+L*.06);set(i,' ',0);return true;};
  const leaf=(i,t,L)=>{const fine=coveDetail(t,.4),grain=fine?Math.sin(HIT.u*180+HIT.w*6)*.06*fine:0;BG[i]=C(GRAY,2.5+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)+grain);set(i,' ',0);return true;};
  const sign=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.08);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'ROOF',0,2.515,.13,.20,C(GREEN,12),BG[i]))return true;set(i,' ',0);return true;};
  const box=(role,u,v,a,b,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=v;};
  box('reveal',0,.012,.86,.012,.025,2.18,0,dark);
  box('threshold',0,.055,1,.055,0,.025,.006,metal);
  for(const e of [-1,1])box('jamb',e*.93,.055,.07,.055,.025,2.18,.008,metal);
  box('head',0,.055,1,.055,2.18,2.3,.008,metal);
  for(const e of [-1,1])box('leaf',e*.43,.046,.427,.013,.025,2.18,.008,leaf);
  box('panel',.93,.125,.045,.015,1.05,1.30,.008,metal);
  for(const z of [1.12,1.22])hotelLobbyTube(parts,'button',.93,.14,z,.93,.154,z,.008,z>1.2?(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GREEN):metal);
  box('sign',0,.012,.48,.012,2.38,2.65,0,sign);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.15,hotelLift:{parts,half:1,top:2.3}};
}
const HOTEL_LIFT_PROPS=ROOM_DEFS.hotel.props;
ROOM_DEFS.hotel.props=r=>[...HOTEL_LIFT_PROPS(r),HOTEL_ROOF_LIFT(r.def.ex,1)];
ROOM_DEFS.hotel.liftWall=hotelLobbyWallFinish;
