// The native floor owns the surface. Timber joints and fabric are material
// detail, filtered by both screen axes instead of painted character strokes.
const HOME_FLOOR_TIMBER=[
  {width:.24,length:1.5,tone:0,seed:137},
  {width:.30,length:2.1,tone:-.35,seed:271},
  {width:.12,length:.72,tone:.3,seed:409},
];
function homeFloorWood(i,x,y,L,footprint,tier) {
  const p=HOME_FLOOR_TIMBER[tier],parquet=tier===2,bx=parquet?Math.floor(x/p.length):0,by=parquet?Math.floor(y/p.length):0,turn=parquet&&((bx+by)&1);
  const u=turn?y:x,v=turn?x:y,board=Math.floor(v/p.width),shift=parquet?0:(board&1)*p.length/2;
  const detail=1-smooth(clamp((footprint/p.width-.25)/.75,0,1)),fine=1-smooth(clamp((footprint-.004)/.02,0,1));
  const joint=Math.max(coveGroove(u+shift,p.length,.006,footprint),coveGroove(v,p.width,.006,footprint));
  const variation=detail?(hash(parquet?bx:Math.floor((u+shift)/p.length),parquet?by:board,p.seed+(parquet?mod(board,6):0))-.5)*1.6*detail:0;
  const blockDetail=parquet?1-smooth(clamp((footprint/p.length-.25)/.75,0,1)):0,blockTone=blockDetail?(hash(bx,by,p.seed)-.5)*.8*blockDetail:0;
  const grain=fine?Math.sin(u*5+p.seed+Math.sin(v*110)*.8)*.09*fine:0;
  BG[i]=C(BRICK,1.3+p.tone+L*.47+variation+blockTone+grain-joint*2.5);set(i,' ',0);return true;
}
function homeFloorFinish(i,x,y,L,footprint) {
  const {tier,home}=room.def,[sx,sy]=home.sofa;
  if(tier&&Math.abs(x-sx)<2.3&&y>sy-2.5&&y<sy+.9) {
    const edge=Math.min(2.3-Math.abs(x-sx),y-(sy-2.5),sy+.9-y),filter=Math.max(.006,footprint);
    const border=1-smooth(clamp((edge-.12)/filter+.5,0,1)),fine=1-smooth(clamp((footprint-.003)/.015,0,1));
    const weave=fine?(Math.sin(x*180)*Math.sin(y*180))*.08*fine:0;
    BG[i]=C(tier===2?GREEN:BLUE,1.1+L*.35+border*.8+weave);set(i,' ',0);return true;
  }
  return homeFloorWood(i,x,y,L,footprint,tier);
}
