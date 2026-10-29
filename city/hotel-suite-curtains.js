// A thin closed folded shell, not a stack of opaque cylinders. Cross-section
// edges and their normals prepare once; exposed ends have actual cloth caps.
function hotelCurtainRay(ox,oy,oz,rx,ry,rz,b) {
  if(rayBox(ox,oy,oz,rx,ry,rz,b)<0)return -1;
  const u=ox-b.x,v=oy-b.y;let best=Infinity,nx=0,ny=0,nz=0;
  for(const e of b.edges){
    const den=rx*e.dv-ry*e.du;if(Math.abs(den)<1e-12)continue;
    const qx=e.u-u,qy=e.v-v,t=(qx*e.dv-qy*e.du)/den,s=(qx*ry-qy*rx)/den,z=oz+rz*t;
    if(t>.01&&t<best&&s>=-1e-8&&s<=1+1e-8&&z>=b.z0&&z<=b.z1){best=t;nx=e.nx;ny=e.ny;nz=0;}
  }
  if(Math.abs(rz)>1e-12)for(const z of [b.z0,b.z1]){
    const t=(z-oz)/rz,x=u+rx*t,y=v+ry*t;if(t<=.01||t>=best||x<-b.hl||x>b.hl)continue;
    const k=Math.min(b.front.length-2,Math.floor((x+b.hl)/b.step)),a=b.front[k],c=b.front[k+1],front=a[1]+(c[1]-a[1])*(x-a[0])/b.step;
    if(y>=front-b.thickness-1e-9&&y<=front+1e-9){best=t;nx=ny=0;nz=z===b.z0?-1:1;}
  }
  if(!Number.isFinite(best))return -1;
  HIT.u=u+rx*best;HIT.v=v+ry*best;HIT.w=oz+rz*best;HIT.nx=nx;HIT.ny=ny;HIT.nz=nz;HIT.face=nz>0?5:nz<0?6:ny>0?3:4;return best;
}
// Keep a distant thin rod continuous between cell centres; nearby rays retain
// the exact capsule. The existing rod ray supplies only subpixel coverage.
function hotelCurtainRodRay(ox,oy,oz,rx,ry,rz,b) {
  const exact=coveRayCapsule(ox,oy,oz,rx,ry,rz,b);if(exact>0)return exact;
  const t=rayRod(ox,oy,oz,rx,ry,rz,b);if(t<0||b.r*2*projX/t>=1.5)return -1;
  const nx=ox+rx*t-HIT.u,ny=oy+ry*t-HIT.v,nz=oz+rz*t-HIT.w,n=Math.hypot(nx,ny,nz);
  HIT.nx=n>1e-12?nx/n:0;HIT.ny=n>1e-12?ny/n:1;HIT.nz=n>1e-12?nz/n:0;return t;
}
function hotelSuiteCurtains(r) {
  if(r.def.tier!==2)return [];
  return r.hotelWindows.map(w=>{
    const side=w.center<r.W/2?-1:1,x=w.center+side*(w.half+.25),parts=[],half=.19,step=half*2/24,thickness=.006;
    let lo=Math.floor(w.center),hi=lo+1;while(lo>1&&r.grid[1][lo-1]==='.')lo--;while(hi<r.W-1&&r.grid[1][hi]==='.')hi++;
    const left=Math.max(lo+.04,w.center-w.half-.45),right=Math.min(hi-.04,w.center+w.half+.45),rodZ=3.31;
    const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL);
    const fabric=(i,t,L)=>{const fine=coveDetail(t,.08),weave=fine?Math.sin(HIT.u*700)*Math.sin(HIT.w*700)*fine*.08:0,hem=HIT.w<.16||HIT.w>3.19;
      BG[i]=C(GREEN,2.2+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz)+(hem?-.20:0)+weave);set(i,' ',0);return true;};
    const front=Array.from({length:25},(_,k)=>[-half+k*step,-.03*Math.cos(k/24*TAU*3)]),polygon=[...front,...front.map(([u,v])=>[u,v-thickness]).reverse()],edges=polygon.map(([u,v],k)=>{const q=polygon[(k+1)%polygon.length],du=q[0]-u,dv=q[1]-v,n=Math.hypot(du,dv);return{u,v,du,dv,nx:-dv/n,ny:du/n};});
    const box={...boxAt(0,.10,1,0,half,.036,.12,3.25),front,edges,step,thickness};parts.push({role:'cloth',box,view:{...box},shade:fabric,ray:hotelCurtainRay});
    hotelLobbyTube(parts,'rod',left-x,.13,rodZ,right-x,.13,rodZ,.015,metal);
    parts.at(-1).ray=hotelCurtainRodRay;
    for(const end of [left,right])hotelLobbyTube(parts,'finial',end-x,.13,rodZ,end-x,.13,rodZ,.025,metal);
    for(const at of [left+.12,right-.12]){
      const p=hotelLobbyRound(parts,'mount',.035,.012,rodZ-.04,rodZ+.04,.005,metal);p.box.x=at-x;p.box.y=.012;
      hotelLobbyTube(parts,'bracket',at-x,.024,rodZ,at-x,.13,rodZ,.009,metal);
    }
    for(const u of [-half*2/3,0,half*2/3])hotelLobbyTube(parts,'clip',u,.13,3.247,u,.13,rodZ,.004,metal);
    return {...ROOM_MODEL(x,1,hotelLobbyDraw(parts)),box:boxAt(x,1.06,1,0,half,.05,.12,3.25),radius:Math.max(x-left,right-x)+.04,hotelCurtain:{parts,left,right,rodZ}};
  });
}
