// Hotel-only bedside fittings sit on the existing cabinet's measured top.
// Closed lathe shells leave actual openings around the supported light bulb.
function HOTEL_BEDSIDE_LAMP(x,y,tier,baseZ=.65) {
  const scale=tier===2?1.15:1,radial=tier===2?1.25:1,parts=[],spokes=[],metalBase=tier?YEL:GRAY;
  const add=(role,z,profile)=>{
    const part=homeLampPart(role,baseZ,profile.map(([h,r])=>[(z+h)*scale,r*radial]));
    part.view={...part.box};parts.push(part);return part;
  };
  add('bulb',.395,HOME_LAMP_BULB);
  add('socket',.35,[[0,0],[0,.026],[.045,.026],[.045,0]]);
  add('stem',tier===2?.30:.035,[[0,0],[0,.013],[(tier===2?.05:.315),.013],[(tier===2?.05:.315),0]]);
  add('base',0,[[0,0],[0,.095],[.008,.11],[.025,.11],[.035,.09],[.035,0]]);
  if(tier===2)add('ceramic',.035,[[0,0],[0,.025],[.028,.07],[.12,.09],[.21,.04],[.265,.017],[.265,0]]);
  const shade=add('shade',.33,[[0,.164],[0,.17],[.012,.17],[.245,.105],[.255,.10],[.255,.094],[.245,.099],[.012,.164],[0,.164]]);
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,metalBase);
  const bulb=(i,t,L)=>{BG[i]=C(STONE,12+3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const ceramic=(i,t,L)=>{BG[i]=C(GREEN,1.8+L*.28*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const lining=(i,t,L)=>{
    const inside=HIT.part>=6,fine=tier?coveDetail(t,.06):0,weave=fine?Math.sin(Math.atan2(HIT.v,HIT.u)*90)*Math.sin(HIT.w*400)*fine*.1:0;
    BG[i]=C(STONE,2.7+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)+(inside?4.5:0)+weave);set(i,' ',0);return true;
  };
  for(let k=0;k<3;k++){
    const a=k*TAU/3,c=Math.cos(a),s=Math.sin(a),ax=c*.023*radial,ay=s*.023*radial,bx=c*.098*radial,by=s*.098*radial,az=baseZ+.35*scale,bz=baseZ+.575*scale,r=.003*radial;
    const box={...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,az-r,bz+r),ax,ay,az,bx,by,bz,r};
    spokes.push({box,view:{...box}});
  }
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const p of parts){p.view.x=vx;p.view.y=vy;drawBox(p.view,p.role==='bulb'?bulb:p.role==='shade'?lining:p.role==='ceramic'?ceramic:metal,coveRayLathe);}
    for(const p of spokes){const b=p.box,v=p.view;v.x=vx+b.x;v.y=vy+b.y;v.ax=vx+b.ax;v.ay=vy+b.ay;v.bx=vx+b.bx;v.by=vy+b.by;drawBox(v,metal,coveRayCapsule);}
  }),radius:.17*radial+.02,box:boxAt(x,y,1,0,.17*radial,.17*radial,baseZ,shade.box.z1),hotelLamp:{tier,baseZ,parts,spokes}};
}
