// The desk keeps its native footprint and .8m worktop; the guard's existing
// monitor and coffee stay supported while the steel frame is open underneath.
function JAIL_GUARD_DESK(x,y) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const timber=(i,t,L)=>coveTimber(i,HIT.u,HIT.v,L,t,HIT.nx,HIT.ny,HIT.nz,4);
  const box=(role,u,v,hl,hw,z0,z1,round,shade=metal)=>{const p=hotelLobbyRound(parts,role,hl,hw,z0,z1,round,shade);p.box.x=u;p.box.y=v;return p;};
  for(const u of [-.42,.42])for(const v of [-.8,.8]){
    box('foot',u,v,.04,.04,0,.025,.005);
    box('leg',u,v,.025,.025,.025,.76,.003);
  }
  for(const u of [-.42,.42])box('long-apron',u,0,.025,.8,.68,.76,0);
  for(const v of [-.825,.825])box('end-apron',0,v,.445,.025,.68,.76,0);
  box('worktop',0,0,.5,.9,.76,.8,.012,timber);
  box('cabinet',.21,.45,.2,.3,.35,.76,.006);
  for(const [lo,hi] of [[.36,.55],[.565,.755]]){
    box('drawer',-.005,.45,.015,.285,lo,hi,.003);
    const z=(lo+hi)/2;
    for(const v of [.31,.59])hotelLobbyTube(parts,'handle-post',-.02,v,z,-.05,v,z,.007,metal);
    hotelLobbyTube(parts,'handle',-.05,.31,z,-.05,.59,z,.007,metal);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,.5,.9,0,.8),radius:1.04,jailDesk:{parts}};
}
const JAIL_DESK_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>{
  const props=JAIL_DESK_PROPS(r).filter(p=>!(p.box&&p.box.x===19.6&&p.box.y===7.5&&p.box.hl===.5&&p.box.hw===.9&&p.box.z1===.8));
  const guard=props.find(p=>p.fig&&p.tick&&p.y===7.5);
  if(guard)guard.tick=s=>{s.x=Math.min(18.75,11+8.5*Math.sin(T*.09));};
  return [...props,JAIL_GUARD_DESK(19.6,7.5)];
};
