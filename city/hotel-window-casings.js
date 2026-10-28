// The original north-wall window spans sometimes cross a room partition.
// Fit separate openings to its actual floor-side faces before adding casings.
function hotelWindowCasings(r) {
  const half=r.def.tier===2?2.65:1.6,left=r.W/2-half,right=r.W/2+half,runs=[];
  // Washroom walls use their own opaque finish, including the motel's short
  // remaining segment. It must not receive a casing around an absent view.
  for(let x=Math.floor(left);x<Math.ceil(right);x++)if(r.grid[1][x]==='.'&&!inWc(x+.5,1.5,r.def.wc)){
    const a=Math.max(left,x),b=Math.min(right,x+1),last=runs.at(-1);
    if(last&&Math.abs(last[1]-a)<1e-8)last[1]=b;else runs.push([a,b]);
  }
  r.hotelWindows=runs.map(([a,b])=>{
    // The existing sill extends 55mm past its jambs; leave it room at a cut.
    if(a>left+1e-8)a+=.055;if(b<right-1e-8)b-=.055;
    return {face:'north',center:(a+b)/2,half:(b-a)/2,bottom:.9,top:2.3};
  }).filter(w=>w.half>.11);
  return r.hotelWindows.map(w=>HOME_WINDOW_CASING(w,r.W,r.H,r.def.tier));
}
function hotelWindowWall(i,u,uStep,z,d,mx,my,L) {
  if(my!==0)return false;
  const win=room.hotelWindows.find(w=>Math.abs(u-w.center)<=w.half&&z>=w.bottom&&z<=w.top);
  if(!win)return false;
  if(room.exterior)homeView(i,u,z,'north');else viewOut(i,u,z,room.suite?22:14,18);
  return true;
}
