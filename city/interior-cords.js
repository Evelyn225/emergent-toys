// A cord and everything it supports share their exact sampled joins. Parts
// prepare once; only the selected cached noodle-pulling frame changes.
function interiorCordSegment(a,b,r,role) {
  return {...boxAt((a[0]+b[0])/2,(a[1]+b[1])/2,1,0,Math.abs(b[0]-a[0])/2+r,Math.abs(b[1]-a[1])/2+r,Math.min(a[2],b[2])-r,Math.max(a[2],b[2])+r),ax:a[0],ay:a[1],az:a[2],bx:b[0],by:b[1],bz:b[2],r,cordRole:role};
}
function interiorCordDraw(box,vx,vy,shade) {
  drawBox({...box,x:vx+box.x,y:vy+box.y,ax:vx+box.ax,ay:vy+box.ay,bx:vx+box.bx,by:vy+box.by},shade,coveRayCapsule);
}
// Closed thin paper with real diamond cut-outs, including the inside edges.
function picadoRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,P=b.paper;
  let best=Infinity,nx=0,ny=0,nz=0;
  const inBody=(u,v,z)=>Math.abs(u)<=b.hl+1e-8&&Math.abs(v)<=b.hw+1e-8&&z<=P.top+P.slope*u+1e-8&&z>=P.top+P.slope*u-.3-1e-8;
  const inHole=(u,z,h)=>Math.abs(u-h.x)+Math.abs(z-P.slope*u-P.top-h.z)<=h.r+1e-8;
  for(const plane of P.planes){
    const den=plane[0]*rx+plane[1]*ry+plane[2]*rz;if(Math.abs(den)<1e-12)continue;
    const t=(plane[3]-plane[0]*x-plane[1]*y-plane[2]*oz)/den;if(t<=.01||t>=best)continue;
    const u=x+rx*t,v=y+ry*t,z=oz+rz*t;if(!inBody(u,v,z)||P.holes.some(h=>inHole(u,z,h)))continue;
    best=t;nx=plane[0];ny=plane[1];nz=plane[2];
  }
  for(const h of P.holes)for(const plane of h.planes){
    const den=plane[0]*rx+plane[2]*rz;if(Math.abs(den)<1e-12)continue;
    const t=(plane[3]-plane[0]*x-plane[2]*oz)/den;if(t<=.01||t>=best)continue;
    const u=x+rx*t,v=y+ry*t,z=oz+rz*t;if(!inBody(u,v,z)||!inHole(u,z,h))continue;
    best=t;nx=-plane[0];ny=0;nz=-plane[2];
  }
  if(!Number.isFinite(best))return -1;
  const norm=Math.hypot(nx,ny,nz);HIT.nx=nx/norm;HIT.ny=ny/norm;HIT.nz=nz/norm;HIT.face=0;
  HIT.u=x+rx*best;HIT.v=y+ry*best;HIT.w=oz+rz*best;return best;
}
function PAPEL_PICADO(y,x0,x1,z) {
  const half=(x1-x0)/2,cord=[],flags=[],xs=[-half,half],top=x=>z-(1-(x/half)**2)*.12;
  const dark=(i,t,L)=>{BG[i]=C(GRAY,.7+L*.14*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  for(let x=-half+.15,k=0;x+.13<=half;x+=.32,k++){
    const left=x-.13,right=x+.13,a=top(left),b=top(right),slope=(b-a)/.26,mid=(a+b)/2;
    xs.push(left,right);
    const planes=[[1,0,0,.13],[-1,0,0,.13],[0,1,0,.001],[0,-1,0,.001],[-slope,0,1,mid],[slope,0,-1,.3-mid]],holes=[];
    for(const u of [-.08,0,.08])for(const w of [-.075,-.15,-.225]){
      const r=.025,cut=[];
      for(const sx of [-1,1])for(const sz of [-1,1])cut.push([sx-sz*slope,0,sz,sx*u+sz*(mid+w)+r]);
      holes.push({x:u,z:w,r,planes:cut});
    }
    const colour=PICADO[k%PICADO.length],shade=(i,t,L)=>{BG[i]=C(colour,4.5+L*.22*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
    flags.push({box:{...boxAt(x,0,1,0,.13,.001,Math.min(a,b)-.3,Math.max(a,b)),paper:{top:mid,slope,planes,holes}},shade,left:[left,0,a],right:[right,0,b]});
  }
  xs.sort((a,b)=>a-b);for(let k=1;k<xs.length;k++)cord.push(interiorCordSegment([xs[k-1],0,top(xs[k-1])],[xs[k],0,top(xs[k])],.004,'flag-cord'));
  const mounts=[-1,1].map(e=>boxAt(e*(half-.008),0,1,0,.008,.025,z-.025,z+.025));
  return {...ROOM_MODEL((x0+x1)/2,y,(vx,vy)=>{
    for(const q of flags)drawBox({...q.box,x:vx+q.box.x,y:vy},q.shade,picadoRay);
    for(const q of cord)interiorCordDraw(q,vx,vy,dark);
    for(const q of mounts)drawBox({...q,x:vx+q.x,y:vy},dark);
  }),box:boxAt((x0+x1)/2,y,1,0,half+.004,.025,z-.424,z+.025),radius:Math.hypot(half+.004,.025),walk:true,overhead:true,picado:{flags,cord,mounts,x0,x1,z}};
}
// A small set of real figure poses keeps both hands and the stretched dough
// in the same frame, while retaining the normal worker's look/interactions.
FIG_POSES.noodlepull=f=>{const q=f/7;return {...FIG_STAND,arms:[[1.3,.15+q*.6,1.5,.08+q*.9],[1.3,.15+q*.6,1.5,.08+q*.9]]};};
const noodlePullFrame=()=>Math.round((.5-.5*Math.cos(T*1.6))*7);
function NOODLE_COOK(x,y) {
  const worker={...standing(x,y,WHITE),face:[0,-1],pose:()=> 'noodlepull'+noodlePullFrame()},source=worker.fig,frames=[],role=()=>FR.MIC;
  const unit=worker.h/FIG_TALL;
  for(let f=0;f<8;f++){
    const key='noodlepull'+f,body=figBody(source,key),grips=body.parts.filter(p=>p.k===0&&p.r.every(r=>Math.abs(r-.95)<1e-8)&&p.role({})===FR.SKIN).map(p=>p.c);
    grips.sort((a,b)=>a[0]-b[0]);
    const strands=[],sag=(.08+f/7*.04)/unit;
    for(let k=0;k<5;k++){
      const a=grips[0],b=grips[1],points=[];
      for(let j=0;j<=8;j++){const t=j/8,spread=(k-2)*.015/unit;points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t-4*t*(1-t)*sag+spread]);}
      const parts=[];for(let j=1;j<points.length;j++){const part=figCap(points[j-1],points[j],.006/unit,role);parts.push(part);body.parts.push(part);}
      strands.push({points,parts});
    }
    body.face=null; // close views refine the held strands as well as the head
    frames.push({key,grips,strands,body});
  }
  // The figure is projected into a cached view sprite. Including its held
  // dough in that same body keeps the visible hand/strand joins exact even
  // in close oblique views; a separate world mesh has different perspective.
  const base=source.base.slice(),lvl=source.lvl.slice();base[FR.MIC]=WHITE;lvl[FR.MIC]=13;
  worker.fig={...source,shape:source.shape+'|noodle-cook',base,lvl};
  worker.pose=()=>{
    const frame=frames[noodlePullFrame()],id=worker.fig.shape+'|'+frame.key;
    // Prime the normal human figure cache with this prepared held-object body.
    // Reinstall after eviction without rebuilding it or changing shared helpers.
    if(figCache.get(id)!==frame.body)figCache.set(id,frame.body);
    return frame.key;
  };
  worker.noodleCook=true;worker.noodleStretch={frames,unit,source};return [worker];
}
