// The office's original plan/collision and services stay intact. Fitted window,
// door and wall builders are reused through local props and layout proxies.
function MOTEL_OFFICE_SIGN(x,y,label,blink=false) {
  const parts=[],z0=blink?1.78:2.28,z1=blink?2.12:2.72,half=blink?.8:.74,facing=blink?-1:1;
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const face=(i,t,L)=>{
    BG[i]=blink?C(GRAY,.7+L*.08):C(STONE,4+L*.15);
    const color=C(RED,blink?(fract(T*.5)<.9?15:5):13);
    if(HIT.face===(facing>0?3:4)&&hotelFittingText(i,HIT.u*facing,HIT.w,t,label,0,(z0+z1)/2,blink?.20:.26,blink?.28:.30,color,BG[i],facing))return true;
    set(i,' ',0);return true;
  };
  hotelLobbyRound(parts,'housing',half,.015,z0,z1,.006,face);
  if(blink)for(const u of [-.55,.55]){hotelLobbyTube(parts,'hanger',u,.005,z1,u,.005,2.26,.003,metal);parts.at(-1).ray=hotelCurtainRodRay;}
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:half+.04,motelOfficeSign:{parts,label,blink,facing}};
}
function MOTEL_ROOF_DOOR(x,y) {
  const door=HOTEL_STAFF_DOOR(x,y),data=door.hotelStaffDoor;
  const steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const paint=(i,t,L)=>{BG[i]=C(GRAY,2.3+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const sign=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.08);if(HIT.face===3&&(hotelFittingText(i,HIT.u,HIT.w,t,'ROOF',0,1.88,.10,.12,C(WHITE,13),BG[i])||hotelFittingText(i,HIT.u,HIT.w,t,'STAIRS',0,1.70,.10,.12,C(WHITE,13),BG[i])))return true;set(i,' ',0);return true;};
  for(const p of data.parts)if(p.role==='leaf')p.shade=paint;else if(p.role==='sign')p.shade=sign;else if(p.role!=='reveal')p.shade=steel;
  door.motelRoofDoor=data;delete door.hotelStaffDoor;return door;
}
function motelOfficeWall(i,u,uStep,z,d,mx,my,L) {
  if(hotelEntranceGlass(i,u,z,mx,my))return true;
  if(my===room.H-1&&room.motelWindows.some(w=>Math.abs(Math.abs(u)-w.center)<=w.half&&z>=w.bottom&&z<=w.top)){hotelLobbyCityView(i,u,z);return true;}
  BG[i]=C(z<.945?BRICK:YEL,(z<.945?2.6:3.6)+L*(z<.945?.3:.15));set(i,' ',0);return true;
}
const MOTEL_ARCH_PROPS=ROOM_DEFS.motel.props;
ROOM_DEFS.motel.props=r=>{
  r.hotelEntranceExterior=hotelEntranceExterior(r);
  r.motelWindows=[2.5,7.5].map(center=>({face:'south',center,half:1.3,bottom:1,top:2.35}));
  const props=[...MOTEL_ARCH_PROPS(r),...r.motelWindows.map(w=>HOME_WINDOW_CASING(w,r.W,r.H,0)),
    HOTEL_FRONT_ENTRANCE(r.W/2,r.H-1),MOTEL_ROOF_DOOR(r.def.ex,1),
    MOTEL_OFFICE_SIGN(3,1.015,r.word||'MOTEL'),MOTEL_OFFICE_SIGN(2.6,r.H-1-.08,'VACANCY',true)];
  // Cut lower trim at the real frame extents, rather than the wider E cells.
  // Neither the native grid nor its definition/physics is changed.
  const proxy={...r,grid:r.grid.map(row=>row.replace(/[DE]/g,'#')),props:[...props,
    {box:boxAt(r.W/2,r.H-.5,1,0,1,.51,0,2.32)},
    {box:boxAt(r.def.ex,.5,1,0,.68,.51,0,2.32)}]};
  const structure=hotelLobbyPanelling(proxy);
  for(const o of structure)for(const [a,b]of [['hotelLobbySkirting','motelSkirting'],['hotelLobbyPanelling','motelPanelling'],['hotelLobbyChairRail','motelChairRail'],['hotelLobbyCornice','motelCornice']])if(o[a]){o[b]=o[a];delete o[a];}
  return [...props,...structure];
};
ROOM_DEFS.motel.doorWall=true;
ROOM_DEFS.motel.wall=ROOM_DEFS.motel.liftWall=motelOfficeWall;
