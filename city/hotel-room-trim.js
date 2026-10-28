// Reuse the fitted wall-run builder unchanged, after the room's actual
// casings/fixtures exist. Native entry cells need explicit lower opening gaps.
function hotelRoomTrim(r) {
  const tier=r.def.tier,h=r.def.height,doors=[];
  const entry=r.props.find(p=>p.hotelEntry);
  if(!entry)for(let y=0;y<r.H;y++)for(let x=0;x<r.W;x++)if(r.grid[y][x]==='D')
    doors.push({box:boxAt(x+.5,y+.5,1,0,.51,.51,0,2.3)});
  // Supply the fitter's existing entry-parts contract only while preparing
  // hotel trim; the real model retains hotel-only metadata and behavior.
  const props=r.props.map(p=>p===entry?{...p,homeEntry:p.hotelEntry}:p);
  const fitted={...r,props:[...props,...doors]},base=[.10,.12,.15][tier],depth=[.018,.023,.028][tier],drop=[.06,.09,.15][tier];
  return [
    ...homeWallMoulding(fitted,[[0,base-.018,depth],[base-.018,base,depth+.004]],false,'hotelSkirting'),
    ...homeWallMoulding(fitted,[[.775,.79,.012],[.79,.815,.023]],false,'hotelChairRail'),
    ...homeWallMoulding(fitted,[[h-drop,h-drop*.6,.012],[h-drop*.6,h-drop*.2,.027],[h-drop*.2,h,tier===2?.065:.04]],true,'hotelCornice')
  ];
}
