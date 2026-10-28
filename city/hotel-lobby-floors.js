// Lobby materials stay on the native floor plane, without extra slabs.
// Filter joints and fine detail by both screen axes.
function hotelLobbyFloorFinish(i,wx,wy,L,footprint) {
  if(room.kind==='hotel')return homeFloorWood(i,wx,wy,L,footprint,1);
  const grand=room.kind==='grandhotel',size=grand?1.2:.5;
  const joint=Math.max(coveGroove(wx,size,grand?.006:.003,footprint),coveGroove(wy,size,grand?.006:.003,footprint));
  let texture=0;
  if(grand){
    const fine=1-smooth(clamp((footprint-.015)/.10,0,1));
    if(fine)texture=-coveGroove(wx*.6+wy*.4+.12*Math.sin(wx*1.2-wy*2.3),.65,.018,footprint*1.5)*3*fine;
  }else{
    const fine=1-smooth(clamp((footprint-.002)/.010,0,1));
    if(fine)texture=(hash(Math.floor(wx*95),Math.floor(wy*95),641)-.5)*.35*fine;
  }
  BG[i]=C(grand?STONE:GRAY,(grand?2.5:1.8)+L*(grand?.45:.4)+texture-joint*(grand?6:1.0));set(i,' ',0);return true;
}
ROOM_FLOORS.hotelLobby=(i,f,wx,wy,r,x,L)=>hotelLobbyFloorFinish(i,wx,wy,L,homeBalconyPavingFootprint(eye*projY/(r-hor+.5),eye));
for(const kind of ['hotel','motel','grandhotel']){
  const def=ROOM_DEFS[kind];def.footstepFloor=def.floor;def.floor='hotelLobby';
}
