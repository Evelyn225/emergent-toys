// Replace only the office's old decorative bell. The original desk, clerk,
// bell position and collision stay intact; the measured countertop owns support.
function MOTEL_SERVICE_BELL(x,y,height) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
  hotelReceptionBellParts(parts,0,0,height,metal);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,radius:.065,motelBell:{parts,height}};
}
const MOTEL_BELL_PROPS=ROOM_DEFS.motel.props;
ROOM_DEFS.motel.props=r=>[...MOTEL_BELL_PROPS(r).filter(p=>!(p.draw&&!p.box&&p.x===3.6&&p.y===2.35)),MOTEL_SERVICE_BELL(3.6,2.35,1.1)];
