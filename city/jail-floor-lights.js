// Painted concrete with saw cuts and worn patches replaces the speck glyphs.
// The yellow line is a real world-space band. It runs along x, often nearly
// along the view, so its coverage uses the pixel's extent across the line
// (lineFootprint), not the larger along-the-view extent the joints filter by.
const JAIL_LINE_Y=JAIL_BARS_NEAR+.45,JAIL_LINE_HALF=.05;
function jailFloorFinish(i,wx,wy,L,footprint,lineFootprint) {
  const lo=wy-JAIL_LINE_Y-lineFootprint/2,hi=wy-JAIL_LINE_Y+lineFootprint/2;
  const line=clamp((Math.min(hi,JAIL_LINE_HALF)-Math.max(lo,-JAIL_LINE_HALF))/Math.max(lineFootprint,.001),0,1);
  set(i,' ',0);
  if(line>.12){BG[i]=C(YEL,1.5+(3.5+L*.45)*Math.sqrt(line));return true;}
  const joint=Math.max(coveGroove(wx,3,.008,footprint),coveGroove(wy,3,.008,footprint));
  const fine=1-smooth(clamp(footprint/.2,0,1)),worn=(Math.sin(wx*1.7+Math.sin(wy*2.3)*1.4)+Math.sin(wy*3.1+wx*.6))*.25*fine;
  BG[i]=C(GRAY,1.6+L*.2+worn-6*joint);return true;
}
ROOM_FLOORS.jail=(i,f,wx,wy,r,x,L)=>{
  const d=eye*projY/(r-hor+.5),ry=dy+dx*tf*(2*x/cols-1);
  return jailFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(d,eye),Math.abs(ry)*d*d/(eye*projY)+Math.abs(dx)*tf*2/cols*d);
};
// Bare board-marked concrete overhead; the lamps are fittings now, not paint.
function jailCeilingFinish(i,wy,footprint) {
  BG[i]=C(GRAY,2.2-2*coveGroove(wy,1.2,.012,footprint));set(i,' ',0);return true;
}
ROOM_CEILS.jail=(i,r,x,wx,wy)=>{
  const h=(room.def.height||3)-eye;
  return jailCeilingFinish(i,wy,homeBalconyPavingFootprint(h*projY/(hor-r-.5),h));
};
// A vandal-proof bulkhead: steel plate on the ceiling, a lit glass dome, and a
// wire cage of two crossed hoops and a ring, buried in the plate at the top.
const JAIL_LAMPS=[[4,3],[11,3],[18,3],[4,10.5],[11,10.5],[18,10.5],[2.5,7.5],[8.5,7.5],[14.5,7.5],[20,7.5]];
const JAIL_LAMP_DROP=.195,JAIL_CAGE_WIRE=.006,JAIL_CAGE_RIB=[[.11,.02],[.105,.10],[.06,.18],[0,JAIL_LAMP_DROP]];
function JAIL_CAGED_LIGHT(x,y,height) {
  const parts=[],metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  const glass=(i,t,L)=>{BG[i]=C(STONE,HIT.nz<-.05?12+2*coveLight(HIT.nx,HIT.ny,HIT.nz):5+L*.2);set(i,' ',0);return true;};
  const wire=(ax,ay,az,bx,by,bz)=>{hotelLobbyTube(parts,'cage',ax,ay,az,bx,by,bz,JAIL_CAGE_WIRE,metal);parts.at(-1).ray=hotelCurtainRodRay;};
  hotelLobbyTurned(parts,'dome',0,0,[[height-.16,0],[height-.155,.04],[height-.135,.07],[height-.10,.085],[height-.03,.085],[height-.03,0]],glass);
  hotelLobbyTurned(parts,'plate',0,0,[[height-.03,0],[height-.03,.13],[height,.13],[height,0]],metal);
  for(const [c,s]of [[1,0],[0,1],[-1,0],[0,-1]])for(let k=1;k<JAIL_CAGE_RIB.length;k++) {
    const [ra,da]=JAIL_CAGE_RIB[k-1],[rb,db]=JAIL_CAGE_RIB[k];
    wire(c*ra,s*ra,height-da,c*rb,s*rb,height-db);
  }
  for(let k=0;k<8;k++) {
    const a=k*TAU/8,b=(k+1)*TAU/8,r=JAIL_CAGE_RIB[1][0],z=height-JAIL_CAGE_RIB[1][1];
    wire(Math.cos(a)*r,Math.sin(a)*r,z,Math.cos(b)*r,Math.sin(b)*r,z);
  }
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,overhead:true,
    box:boxAt(x,y,1,0,.13,.13,height-JAIL_LAMP_DROP-JAIL_CAGE_WIRE,height),radius:.14,jailCeilingLight:{height,parts}};
}
const JAIL_LIGHT_PROPS=ROOM_DEFS.jail.props;
ROOM_DEFS.jail.props=r=>[...JAIL_LIGHT_PROPS(r),...JAIL_LAMPS.map(([x,y])=>JAIL_CAGED_LIGHT(x,y,r.def.height||3))];
