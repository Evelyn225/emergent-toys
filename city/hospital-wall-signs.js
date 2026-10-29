// Mounted wayfinding replaces ink on the wall. The cross moves to the clear
// treatment aisle so the tall privacy curtains do not conceal its lower half.
function HOSPITAL_EMERGENCY_SIGN(x,y) {
  const parts=[],face=(i,t,L)=>{BG[i]=C(WHITE,3.4+L*.20);
    if(HIT.face===3&&hotelFittingText(i,HIT.u,HIT.w,t,'EMERGENCY',0,2.55,.28,.32,C(RED,13),BG[i]))return true;
    set(i,' ',0);return true;};
  hotelLobbyRound(parts,'housing',1.4,.025,2.32,2.78,.008,face);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:1.45,hospitalEmergencySign:{parts}};
}
function HOSPITAL_CROSS_SIGN(x,y) {
  const parts=[],white=(i,t,L)=>{BG[i]=C(WHITE,3.4+L*.20*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const red=(i,t,L)=>{BG[i]=C(RED,3+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const back=hotelLobbyRound(parts,'backplate',.4,.02,2.05,2.85,.008,white);back.box.y=.02;
  const add=(role,u,half,z0,z1)=>{const p=hotelLobbyRound(parts,role,half,.01,z0,z1,0,red);p.box.x=u;p.box.y=.048;};
  add('cross-stem',0,.11,2.10,2.80);
  for(const e of [-1,1])add('cross-arm',e*.23,.12,2.34,2.56);
  const screw={x:0,y:0,profile:[[-.002,0],[-.002,.008],[.002,.008],[.002,0]]};
  for(const u of [-.34,.34])for(const z of [2.12,2.78]){
    const b={...boxAt(u,.041,1,0,.008,.002,z-.008,z+.008),centerZ:z,clockShape:screw};
    parts.push({role:'screw',box:b,view:{...b},shade:metal,ray:homeClockRay});
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.45,hospitalCross:{parts}};
}
const HOSPITAL_SIGN_PROPS=ROOM_DEFS.hospital.props,HOSPITAL_SIGN_WALL=ROOM_DEFS.hospital.wall;
ROOM_DEFS.hospital.props=r=>[...HOSPITAL_SIGN_PROPS(r),HOSPITAL_EMERGENCY_SIGN(6,1.025),HOSPITAL_CROSS_SIGN(9.2,1)];
ROOM_DEFS.hospital.wall=(i,u,uStep,z,d,mx,my,L)=>{
  if(my===0&&(Math.abs(u-6)<1.45&&z>2.30&&z<2.80||Math.abs(u-12.55)<.42&&z>2.03&&z<2.88)){
    BG[i]=C(GREEN,2+L*.08);set(i,' ',0);return true;
  }
  return HOSPITAL_SIGN_WALL(i,u,uStep,z,d,mx,my,L);
};
