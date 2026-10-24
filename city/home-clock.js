// A wall-mounted clock: turned oak rim, recessed dial, raised indices and
// hands under separate glass. All depths share the wall placement envelope.
const HOME_CLOCK_RIM=[[-.03,.225],[-.03,.241],[-.022,.25],[.026,.25],[.04,.239],[.04,.227],[.033,.222],[-.018,.222],[-.018,.225],[-.03,.225]];
function homeClockRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,c=b.c,s=b.s;
  const t=coveRayLathe(x*c+y*s,oz-b.centerZ,-x*s+y*c,rx*c+ry*s,rz,-rx*s+ry*c,b.clockShape);
  if(t<0)return t;
  const u=HIT.u,z=HIT.v,v=HIT.w,nx=HIT.nx,nz=HIT.ny,nv=HIT.nz;
  HIT.u=u;HIT.v=v;HIT.w=b.centerZ+z;
  HIT.nx=nx*c-nv*s;HIT.ny=nx*s+nv*c;HIT.nz=nz;HIT.face=nv>.9?3:nv<-.9?4:0;
  return t;
}
function homeClockRayHand(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,c=b.c,s=b.s,q=b.handRatio;
  const t=coveRayCapsule(x*c+y*s,(-x*s+y*c)/q,oz,rx*c+ry*s,(-rx*s+ry*c)/q,rz,b.handShape);
  if(t<0)return t;
  const nx=HIT.nx,nv=HIT.ny/q,nz=HIT.nz,n=Math.hypot(nx,nv,nz);
  HIT.nx=(nx*c-nv*s)/n;HIT.ny=(nx*s+nv*c)/n;HIT.nz=nz/n;HIT.w=oz+rz*t;
  return t;
}
function HOME_WALL_CLOCK(p) {
  const c=Math.cos(p.a),s=Math.sin(p.a),wood=furnitureTimber(BRICK),parts=[];
  const plain=(base,level)=>(i,t,L)=>{BG[i]=C(base,level+L*.24*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const dark=plain(GRAY,.5),paper=plain(STONE,4.7),metal=kitchenSteel;
  const shape=(role,profile,shade)=>{
    const radius=Math.max(...profile.map(q=>q[1])),lo=Math.min(...profile.map(q=>q[0])),hi=Math.max(...profile.map(q=>q[0]));
    const center=(lo+hi)/2;
    parts.push({role,radius,lo,hi,center,shape:{x:0,y:0,profile:profile.map(([v,r])=>[v-center,r])},shade});
  };
  shape('rim',HOME_CLOCK_RIM,wood);
  shape('back',[[-.03,0],[-.03,.225],[-.018,.225],[-.018,0]],dark);
  shape('dial',[[-.018,0],[-.018,.223],[.009,.223],[.009,0]],paper);
  shape('glass',[[.033,0],[.033,.222],[.034,.222],[.034,0]],(i,t,L)=>{
    const glint=coveGroove(HIT.u+(HIT.w-p.z)*.65,.8,.002,t/projX)*coveDetail(t,.25);
    if(glint<.65)return false;BG[i]=C(CYAN,2+L*.15);set(i,' ',0);return true;
  });
  shape('pivot',[[.009,0],[.009,.008],[.032,.008],[.032,0]],metal);
  const indices=Array.from({length:12},(_,k)=>{
    const a=k*TAU/12,r=k%3===0?.182:.19;
    return {ax:Math.sin(a)*r,az:Math.cos(a)*r,bx:Math.sin(a)*.204,bz:Math.cos(a)*.204,r:k%3===0?.012:.008};
  });
  let lastTime,handPoints;
  const hands=()=>{
    if(lastTime!==tod){lastTime=tod;handPoints=[{role:'hour-hand',angle:tod*TAU/12,length:.115,r:.013,v:.015},{role:'minute-hand',angle:fract(tod)*TAU,length:.17,r:.009,v:.024}].map(q=>{
      const x=Math.sin(q.angle),z=Math.cos(q.angle),ax=-x*.025,az=-z*.025,bx=x*q.length,bz=z*q.length,u=(ax+bx)/2;
      return {...q,u,lo:p.z+Math.min(az,bz)-q.r,hi:p.z+Math.max(az,bz)+q.r,half:Math.abs(bx-ax)/2+q.r,shape:{ax:ax-u,ay:0,az:p.z+az,bx:bx-u,by:0,bz:p.z+bz,r:q.r}};
    });}return handPoints;
  };
  return {...ROOM_MODEL(p.x,p.y,(vx,vy)=>{
    const at=(u,v)=>[vx+c*u-s*v,vy+s*u+c*v];
    const tube=(role,u,v,z,uu,vv,zz,r,shade)=>{
      const[ax,ay]=at(u,v),[bx,by]=at(uu,vv);
      drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,p.z+Math.min(z,zz)-r,p.z+Math.max(z,zz)+r),ax,ay,az:p.z+z,bx,by,bz:p.z+zz,r,clockRole:role},shade,coveRayCapsule);
    };
    // Draw nearer detail first so the dial cannot hide the actual hands.
    const glass=parts.find(q=>q.role==='glass');
    const lathe=q=>drawBox({...boxAt(vx-s*q.center,vy+c*q.center,c,s,q.radius,(q.hi-q.lo)/2,p.z-q.radius,p.z+q.radius),centerZ:p.z,clockShape:q.shape,clockRole:q.role},q.shade,homeClockRay);
    lathe(glass);
    lathe(parts.find(q=>q.role==='pivot'));
    for(const q of hands()){
      const[x,y]=at(q.u,q.v);
      drawBox({...boxAt(x,y,c,s,q.half,.002,q.lo,q.hi),handRatio:.002/q.r,handShape:q.shape,clockRole:q.role},dark,homeClockRayHand);
    }
    for(const q of indices)tube('index',q.ax,.012,q.az,q.bx,.012,q.bz,q.r,dark);
    for(const q of parts)if(q!==glass&&q.role!=='pivot')lathe(q);
    for(const u of [-.13,.13])tube('wall-pad',u,-.035,-.10,u,-.035,-.085,.005,dark);
  }),box:furnishingBox(p),walk:true,radius:Math.hypot(.25,.04),furnishingKey:p.key};
}
