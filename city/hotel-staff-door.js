// A fitted closed service door at the existing gallery interaction point.
// The native wall remains solid; opening hours and E travel stay in grand-hotel.
function HOTEL_STAFF_DOOR(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const frame=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,7);
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.3+L*.06);set(i,' ',0);return true;};
  const paint=(i,t,L)=>{BG[i]=C(GREEN,2.3+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const sign=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.08);if(HIT.face===3&&(wallText(i,HIT.u,t/projX,HIT.w,t,'STAFF',0,1.88,.10,.12,C(WHITE,13),BG[i])||wallText(i,HIT.u,t/projX,HIT.w,t,'ONLY',0,1.70,.10,.12,C(WHITE,13),BG[i])))return true;set(i,' ',0);return true;};
  const box=(role,u,v,a,b,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=v;};
  box('reveal',0,.012,.56,.012,.025,2.20,0,dark);
  box('threshold',0,.055,.68,.055,0,.025,.006,metal);
  for(const e of [-1,1])box('jamb',e*.62,.055,.06,.055,.025,2.20,.008,frame);
  box('head',0,.055,.68,.055,2.20,2.32,.008,frame);
  box('leaf',0,.046,.557,.012,.025,2.20,.006,paint);
  box('kickplate',0,.062,.48,.004,.10,.28,.002,metal);
  box('escutcheon',.33,.068,.03,.010,.96,1.12,.004,metal);
  hotelLobbyTube(parts,'spindle',.33,.078,1.04,.33,.115,1.04,.009,metal);
  hotelLobbyTube(parts,'lever',.33,.115,1.04,.12,.115,1.04,.012,metal);
  box('sign',0,.064,.32,.006,1.56,2.02,.003,sign);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.72,hotelStaffDoor:{parts,half:.68}};
}
