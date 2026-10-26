// Shop/restaurant ceiling fixtures. Existing home and feature-lamp builders
// are reused unchanged; their authored positions remain clear of new shades.
const INTERIOR_HANGING_ROOMS=new Set([...INTERIOR_BATTEN_ROOMS,'skate']);
function CEILING_TRACK(x,y,length,ceiling,spots) {
  const parts=[],half=length/2;
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.8+L*.16*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const lens=(i,t,L)=>{BG[i]=C(WHITE,HIT.nz<-.7?12:3.5);set(i,' ',0);return true;};
  parts.push({role:'track',box:{...ceilingBattenPrism(half,.04,ceiling-.045,ceiling,.004),c:1,s:0},shade:dark,ray:homeRayWorktop});
  for(const sx of spots){
    const add=(p,shade)=>parts.push({...p,box:{...p.box,x:sx-x},shade,ray:coveRayLathe});
    add(homeLampCylinder('stem',ceiling-.125,ceiling-.045,.013),dark);
    add(homeLampPart('head',ceiling-.24,[[0,.06],[0,.075],[.10,.075],[.12,.064],[.12,0],[.11,0],[.11,.06],[0,.06]]),dark);
    add(homeLampCylinder('lens',ceiling-.241,ceiling-.232,.06),lens);
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const p of parts)drawBox({...p.box,x:vx+p.box.x,y:vy},p.shade,p.ray);}),
    box:boxAt(x,y,1,0,half,.075,ceiling-.241,ceiling),walk:true,overhead:true,radius:Math.hypot(half,.075),ceilingTrack:{ceiling,length,spots:spots.slice(),parts}};
}
function prepareInteriorHanging() {
  const R=room,style=R?.def.ceil;
  if(!R||!INTERIOR_HANGING_ROOMS.has(R.kind)||(style!=='pendant'&&style!=='tin'&&style!=='spots'))return false;
  if(R.interiorHanging)return true;
  const ceiling=R.def.height||3,runs=[],spots=[];
  const spec={...(style==='spots'?CEIL_SPOTS:CEIL_PENDANT),onFitting:(x0,y0,x1,y1,value)=>{
    const q={x:(x0+x1)/2,y:(y0+y1)/2,length:x1-x0};(value===2?runs:spots).push(q);
  }};
  const mask=ceilMask('physical-'+style,spec),fixtures=[];
  if(style==='spots'){
    for(const q of runs)fixtures.push(CEILING_TRACK(q.x,q.y,q.length,ceiling,spots.filter(p=>Math.abs(p.y-q.y)<1e-8&&Math.abs(p.x-q.x)<q.length/2).map(p=>p.x)));
  }else{
    const feature=R.props.filter(p=>p.tiffanyLamp||p.heatLamp||p.roundLantern||p.paperLantern);
    const tall=R.props.filter(p=>p.box&&p.box.z1>ceiling-.72&&p.box.z0<ceiling);
    for(const q of spots){
      if(feature.some(p=>Math.hypot(p.x-q.x,p.y-q.y)<.7)||tall.some(p=>inBox(p.box,q.x,q.y,.28)))continue;
      fixtures.push({...homeLampModel(q.x,q.y,'pendant',ceiling,()=>true),overhead:true,ceilingPendant:{ceiling}});
    }
  }
  R.interiorHanging={mask,fixtures};R.props.push(...fixtures);return true;
}
