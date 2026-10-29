// Keep the counter's original collider. Small desktop fittings are separate
// decorative geometry, prepared once, with real supported layers and contacts.
function HOTEL_RECEPTION_DESK(x,y,hl,hw,h) {
  const counter=SHOP_COUNTER(x,y,hl,hw,h,1,0,BRICK),parts=[];
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  const timber=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,647);
  const paper=(i,t,L)=>{
    const fp=homeBalconyPavingFootprint(t,eye-HIT.w),fine=coveDetail(t,.12);
    const lines=HIT.nz>.8&&Math.abs(HIT.u)<.15&&HIT.v>-.06&&HIT.v<.085?coveGroove(HIT.v+.04,.025,.0018,fp)*fine:0;
    BG[i]=C(WHITE,4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-lines*4);set(i,' ',0);return true;
  };
  const box=(role,u,v,a,b,z0,z1,round,shade)=>{
    const p=hotelLobbyRound(parts,role,a,b,z0,z1,round,shade);p.box.x=u;p.box.y=v;
  };
  box('board',-.62,.05,.21,.135,h,h+.012,.004,timber);
  box('paper',-.62,.05,.19,.115,h+.012,h+.014,.0006,paper);
  box('clip',-.62,-.045,.055,.014,h+.014,h+.031,.003,metal);
  hotelLobbyTurned(parts,'bell-foot',.58,.06,[[h,0],[h,.055],[h+.004,.060],[h+.010,.060],[h+.010,0]],metal);
  hotelLobbyTurned(parts,'bell-body',.58,.06,[[h+.010,0],[h+.010,.057],[h+.014,.061],[h+.028,.056],[h+.043,.030],[h+.049,.015],[h+.051,.008],[h+.051,0]],metal);
  hotelLobbyTurned(parts,'bell-post',.58,.06,[[h+.051,0],[h+.051,.005],[h+.060,.005],[h+.060,0]],metal);
  hotelLobbyTurned(parts,'bell-button',.58,.06,[[h+.060,0],[h+.060,.012],[h+.064,.015],[h+.069,.015],[h+.071,.012],[h+.071,0]],metal);
  const fittings={...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.9,hotelReceptionAccessories:{parts,height:h}};
  counter.hotelReception={height:h,fittings};
  return [counter,fittings];
}
