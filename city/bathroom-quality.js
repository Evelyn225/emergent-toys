// Hollow elliptical profiles share their outer lip, inner wall and floor. The
// ray parameter stays in world units; normals use the inverse ellipse scale.
function bathroomRayOval(ox,oy,oz,rx,ry,rz,b) {
  const t=coveRayLathe((ox-b.x)/b.sx,(oy-b.y)/b.sy,oz,rx/b.sx,ry/b.sy,rz,b.lathe);
  if(t<0)return t;
  HIT.u*=b.sx;HIT.v*=b.sy;
  const nx=HIT.nx/b.sx,ny=HIT.ny/b.sy,nz=HIT.nz,n=Math.hypot(nx,ny,nz);
  HIT.nx=nx/n;HIT.ny=ny/n;HIT.nz=nz/n;HIT.face=HIT.nz>.9?5:HIT.nz<-.9?6:0;
  return t;
}
function bathroomOval(x,y,sx,sy,base,profile,shade) {
  const points=profile.map(([z,r])=>[base+z,r]),r=Math.max(...points.map(p=>p[1]));
  drawBox({...boxAt(x,y,1,0,sx*r,sy*r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),sx,sy,lathe:{x:0,y:0,profile:points}},shade,bathroomRayOval);
}
function bathroomEnamel(i,t,L) {
  BG[i]=C(WHITE,3.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
}
function bathroomPipe(ax,ay,az,bx,by,bz,r,base=GRAY) {
  // Bathroom fixtures are viewed from within arm's reach: keep the plumbing a
  // solid curved surface instead of changing it into line glyphs nearby.
  drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r},
    (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,base),coveRayCapsule);
}
function bathroomTap(x,y,fx,fy,z) {
  const at=(u,v,h)=>[x-fy*u+fx*v,y+fx*u+fy*v,z+h];
  const tube=(u,v,h,uu,vv,hh,r=.012)=>bathroomPipe(...at(u,v,h),...at(uu,vv,hh),r,GRAY);
  tube(0,-.19,0,0,-.19,.16);
  for(let k=0;k<6;k++) {
    const a=k*Math.PI/12,b=(k+1)*Math.PI/12;
    tube(0,-.14-.05*Math.cos(a),.16+.05*Math.sin(a),0,-.14-.05*Math.cos(b),.16+.05*Math.sin(b));
  }
  tube(0,-.14,.21,0,-.06,.21);tube(0,-.06,.21,0,-.06,.18);
  for(const side of [-1,1]) {
    tube(0,-.19,.075,side*.045,-.19,.075,.01);
    const [x0,y0,z0]=at(side*.045,-.19,.075);
    coveLathe(x0,y0,z0-.015,[[0,0],[0,.018],[.03,.018],[.03,0]],
      (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
  }
}
function bathroomMirrorMount(x,y,fx,fy) {
  for(let d=.2;d<=1;d+=.02) {
    const wx=x-fx*d,wy=y-fy*d,cx=Math.floor(wx),cy=Math.floor(wy),cell=room?.grid[cy]?.[cx];
    if(!cell||!'#W'.includes(cell))continue;
    const plane=fx>0?cx+1:fx<0?cx:fy>0?cy+1:cy;
    return {x:fx?plane+fx*.025:x,y:fy?plane+fy*.025:y,wall:true};
  }
  return {x:x-fx*.2,y:y-fy*.2,wall:false};
}
function BATHROOM_SINK(x,y,fx,fy) {
  let mirror;
  return furnitureModel(x,y,1,0,.24,.24,.86,(vx,vy)=>{
    coveLathe(vx,vy,0,[[0,0],[0,.09],[.025,.09],[.07,.07],[.59,.055],[.72,.095],[.735,0]],bathroomEnamel);
    bathroomOval(vx,vy,.22,.22,0,[[.72,0],[.72,.42],[.75,.72],[.82,.96],[.845,1],[.86,.96],[.86,.77],[.835,.74],[.775,.38],[.765,0]],bathroomEnamel);
    coveLathe(vx,vy,.765,[[0,0],[0,.023],[.002,.023],[.002,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
    bathroomTap(vx,vy,fx,fy,.86);
    mirror||=bathroomMirrorMount(x,y,fx,fy);
    const mx=vx+mirror.x-x,my=vy+mirror.y-y,c=-fy,s=fx;
    if(!mirror.wall)for(const side of [-1,1])bathroomPipe(mx+c*side*.16,my+s*side*.16,.84,mx+c*side*.16,my+s*side*.16,1.2,.012,GRAY);
    coveRound(mx,my,c,s,.25,.025,1.15,1.75,.018,GRAY);
    coveRound(mx+fx*.026,my+fy*.026,c,s,.222,.002,1.18,1.72,.001,(i,t,L)=>{
      const sheen=Math.exp(-(((HIT.u+.08*Math.sin(a))/.13+(HIT.w-1.45)*.8)**2));
      BG[i]=C(CYAN,2.3+L*.12+sheen*.8);set(i,' ',0);return true;
    });
  });
}
function BATHROOM_TOILET(x,y,back=-1,mat=steel) {
  const metal=mat===steel,finish=metal?(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY):bathroomEnamel;
  const cy=y+back*.3,by=y+back*.04;
  const cistern={...furnitureModel(x,cy,1,0,.24,.09,.82,(vx,vy)=>{
    coveRound(vx,vy,1,0,.23,.085,.48,.8,.025,finish);
    coveRound(vx,vy,1,0,.24,.09,.79,.82,.012,finish);
    bathroomPipe(vx,vy,.48,vx,vy,.31,.018,metal?GRAY:WHITE);
    bathroomPipe(vx,vy,.31,vx,vy-back*.16,.31,.018,metal?GRAY:WHITE);
    bathroomPipe(vx+.13,vy-back*.095,.7,vx+.19,vy-back*.095,.7,.012,GRAY);
  }),box:boxAt(x,cy,1,0,.24,.09,.3,.82)};
  const pedestal=furnitureModel(x,y+back*.02,1,0,.11,.13,.31,(vx,vy)=>{
    bathroomOval(vx,vy,.11,.13,0,[[0,0],[0,.9],[.025,1],[.11,.68],[.26,.58],[.31,.78],[.31,0]],finish);
  });
  const bowl={...furnitureModel(x,by,1,0,.21,.26,.42,(vx,vy)=>{
    bathroomOval(vx,vy,.21,.26,0,[[.28,0],[.28,.55],[.32,.72],[.37,.94],[.405,1],[.42,.97],[.42,.72],[.395,.68],[.32,.35],[.31,0]],finish);
    bathroomOval(vx,vy,.21,.26,.327,[[0,0],[0,.36],[.001,.36],[.001,0]],(i,t,L)=>{
      const swirl=T-flushT<2.5;
      BG[i]=C(BLUE,1.7+L*.13);
      const ripple=Math.sin(Math.atan2(HIT.v,HIT.u)*3-T*10)*Math.hypot(HIT.u,HIT.v);
      set(i,swirl&&ripple>.045?'~':' ',C(CYAN,L));return true;
    });
  }),box:boxAt(x,by,1,0,.21,.26,.28,.42),loo:[x,by]};
  return [cistern,pedestal,bowl];
}
function BATHROOM_TUB(x,y) {
  return {...furnitureModel(x,y,1,0,.42,1.04,.62,(vx,vy)=>{
    for(const u of [-.2,.2])for(const v of [-.5,.5])coveRound(vx+u,vy+v,1,0,.035,.045,0,.105,.015,GRAY);
    bathroomOval(vx,vy,.42,1.04,0,[[.08,0],[.08,.68],[.14,.82],[.3,.96],[.56,1],[.605,1],[.62,.985],[.62,.9],[.56,.87],[.24,.68],[.19,.57],[.18,0]],bathroomEnamel);
    coveLathe(vx,vy-.48,.187,[[0,0],[0,.025],[.003,.025],[.003,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY));
    bathroomTap(vx,vy-.8,0,1,.62);
  }),bath:true};
}
