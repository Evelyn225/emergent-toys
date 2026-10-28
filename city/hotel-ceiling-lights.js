// Flush fittings keep headroom above hotel sleeping, living and washroom zones.
// The closed frosted bowl meets its housing; the mount meets the real ceiling.
function HOTEL_CEILING_LIGHT(x,y,height,tier) {
  const parts=[],radius=[.23,.30,.36][tier];
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,tier?YEL:GRAY);
  const frost=(i,t,L)=>{BG[i]=C(STONE,HIT.nz<-.05?11.5+1.5*coveLight(HIT.nx,HIT.ny,HIT.nz):4+L*.18);set(i,' ',0);return true;};
  hotelLobbyTurned(parts,'diffuser',0,0,[[height-.20,0],[height-.192,radius*.55],[height-.175,radius*.88],[height-.145,radius-.016],[height-.125,radius-.016],[height-.125,0]],frost);
  hotelLobbyTurned(parts,'housing',0,0,[[height-.125,0],[height-.125,radius-.02],[height-.111,radius],[height-.055,radius],[height-.04,radius-.015],[height-.04,0]],metal);
  hotelLobbyTurned(parts,'mount',0,0,[[height-.04,0],[height-.04,.11],[height,.11],[height,0]],metal);
  return {...ROOM_MODEL(x,y,hotelLobbyDraw(parts)),walk:true,overhead:true,
    box:boxAt(x,y,1,0,radius,radius,height-.20,height),radius,
    hotelCeilingLight:{height,tier,parts}};
}
function hotelCeilingLights(tier,w,height) {
  const points=tier===2?[[3.9,4.6],[4,9],[12.8,8.4]]:tier===1?[[3.25,4.4],[4.3,8.5]]:[[2.9,4.4]];
  points.push([w-2.5,3.5]);
  return points.map(([x,y])=>HOTEL_CEILING_LIGHT(x,y,height,tier));
}
