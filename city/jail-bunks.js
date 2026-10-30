// Simple institutional beds: an open welded frame, supported bedding and a
// shaped pillow. Seat markers use the clear long edge rather than its centre.
function JAIL_BUNK(x,y,fy) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const cloth=base=>(i,t,L)=>{BG[i]=C(base,2.2+L*.30*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const box=(role,u,v,hl,hw,z0,z1,round,shade)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  for(const u of [-.82,.82])for(const v of [-.37,.37]){
    box('foot',u,v,.04,.04,0,.025,.005,metal);
    box('leg',u,v,.025,.025,.025,.34,.003,metal);
  }
  for(const v of [-.395,.395])box('long-rail',0,v,.9,.025,.34,.42,0,metal);
  for(const u of [-.925,.925])box('end-rail',u,0,.025,.42,.34,.42,0,metal);
  box('platform',0,0,.95,.42,.42,.44,0,metal);
  box('mattress',0,0,.93,.415,.44,.56,.025,cloth(WHITE));
  box('blanket',0,0,.9,.4,.56,.58,.009,cloth(BLUE));
  box('pillow',-.65,0,.18,.30,.58,.69,0,cloth(WHITE)).ray=homeRayEllipsoid;
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.95,.42,0,.69),radius:1.05,jailBunk:{parts,fy}};
}
const JAIL_BUNK_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>{
  const oldFar=JAIL_D-2.55,far=JAIL_D-1.55,props=JAIL_BUNK_PROPS(r).filter(p=>!(p.box&&[2.9,9.9,16.9].some(x=>Math.abs(p.box.x-x)<1e-8)&&[1.55,oldFar].includes(p.box.y)&&p.box.hl===.95&&p.box.hw===.42&&[.42,.58].includes(p.box.z1)));
  for(const p of props){
    if(p.seat&&[1.55,oldFar].includes(p.y))p.y=(p.y===1.55?1.55:far)+p.fy*.35;
    if(p.fig&&p.x===10.2&&p.y===oldFar&&p.pose==='sit'){p.y=far-.35;p.seatZ=.58;p.face=[0,-1];}
    if(p.cabbie){p.y=1.9;p.seatZ=.58;p.face=[0,1];}
  }
  return [...props,...[4,11,18].flatMap(x=>[JAIL_BUNK(x-1.1,1.55,1),JAIL_BUNK(x-1.1,far,-1)])];
};
