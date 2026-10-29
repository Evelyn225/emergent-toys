// Prepared wheeled beds replace the painted mattress/base pairs. Their seated
// edge is on the clear long side, away from the raised head-side safety rails.
function HOSPITAL_BED(x,y) {
  const parts=[],steel=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const tyre=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const cloth=(i,t,L)=>{BG[i]=C(WHITE,3.2+L*.30*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const paint=(i,t,L)=>{BG[i]=C(CYAN,1.8+L*.24*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  const wheelShape={x:0,y:0,profile:[[-.018,0],[-.018,.065],[.018,.065],[.018,0]]};
  for(const u of [-.65,.65])for(const v of [-.28,.28]){
    const b={...boxAt(u,v,1,0,.065,.018,0,.13),centerZ:.065,clockShape:wheelShape};
    parts.push({role:'wheel',box:b,view:{...b},shade:tyre,ray:homeClockRay});
    for(const e of [-1,1])box('fork',u,v+e*.026,.026,.006,.065,.155,.003,steel);
    box('fork-cap',u,v,.034,.032,.155,.17,.004,steel);
    hotelLobbyTube(parts,'axle',u,v-.034,.065,u,v+.034,.065,.006,steel);
    hotelLobbyTurned(parts,'leg',u,v,[[.17,0],[.17,.018],[.36,.018],[.36,0]],steel);
  }
  for(const v of [-.28,.28])box('frame',0,v,.85,.025,.36,.43,0,steel);
  for(const u of [-.875,.875])box('frame',u,0,.025,.305,.36,.43,0,steel);
  box('platform',0,0,.92,.37,.43,.45,.015,steel);
  box('mattress',0,0,.89,.42,.45,.60,.035,cloth);
  box('sheet',0,0,.89,.42,.60,.62,.035,cloth);
  const pillow=box('pillow',.68,0,.18,.32,.62,.74,0,cloth);pillow.ray=homeRayEllipsoid;
  for(const u of [-.925,.925])box('end-board',u,0,.025,.37,.45,.88,.018,paint);
  for(const v of [-.405,.405]){
    for(const u of [.12,.78]){
      hotelLobbyTube(parts,'rail-bracket',u,Math.sign(v)*.28,.405,u,v,.405,.01,steel);
      hotelLobbyTube(parts,'rail-post',u,v,.405,u,v,.82,.01,steel);
    }
    for(const z of [.70,.82])hotelLobbyTube(parts,'safety-rail',.12,v,z,.78,v,z,.01,steel);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.95,.42,0,.89),radius:1.05,hospitalBed:{parts,seat:[x-.3,y-.37,0,-1,.62]}};
}
const HOSPITAL_BED_PROPS=ROOM_DEFS.hospital.props;
ROOM_DEFS.hospital.props=r=>{
  const ys=[2.2,4.4],old=HOSPITAL_BED_PROPS(r),props=old.filter(p=>!(p.box&&p.box.x===11.6&&ys.includes(p.box.y)&&[.45,.62].includes(p.box.z1)));
  for(const p of props)if(p.x===11.3&&ys.includes(p.y)&&(p.seat||p.fig&&p.seatZ===.62)){
    p.y-=.37;if(p.seat){p.fx=0;p.fy=-1;}else p.face=[0,-1];
  }
  return [...props,...ys.map(y=>HOSPITAL_BED(11.6,y))];
};
