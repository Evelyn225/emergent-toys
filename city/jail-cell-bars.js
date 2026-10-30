// Closed round steel uprights replace the flat glyph-mask fronts. Their pitch,
// cell boundaries and physical/pee-through policy stay with the native jail.
function JAIL_CELL_BARS(x,y,height) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  for(let k=-12;k<=12;k++){
    // Caps bury in the sill and meet the ceiling. Existing subcell coverage
    // keeps distant uprights continuous; close views use the exact round ray.
    hotelLobbyTube(parts,'upright',k*.25,0,.06,k*.25,0,height-.0225,.0225,metal);
    parts.at(-1).ray=hotelCurtainRodRay;
  }
  hotelLobbyRound(parts,'sill',3,.03,0,.06,0,metal);
  hotelLobbyRound(parts,'band',3,.03,2.265,2.335,0,metal);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),box:boxAt(x,y,1,0,3,.03,0,height),radius:3.03,peeThrough:true,jailBars:{parts,height}};
}
const JAIL_BAR_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>[
  ...JAIL_BAR_PROPS(r).filter(p=>!(p.peeThrough&&p.box&&p.box.hl===3&&p.box.hw===.03&&p.box.z0===0&&p.box.z1===3)),
  ...[4,11,18].flatMap(x=>[JAIL_BARS_NEAR,JAIL_BARS_FAR].map(y=>JAIL_CELL_BARS(x,y,r.def.height||3)))
];
