// Cabin Cove is the close-up material/geometry prototype. All sizes below are
// metres indoors; exterior attachments use the same profiles at 1/10 scale.
const COVE_CABIN=ISLAND_CABINS.find(c=>c.id==='cabin-cove');
const COVE_WINDOWS=[
  {face:'west',center:4.5,half:1.2},{face:'east',center:4.5,half:1.2},
  {face:'north',center:6,half:1.2},
  {face:'south',center:3,half:.85},{face:'south',center:9,half:.85}
].map(w=>({...w,bottom:1.05,top:2.15}));
const COVE_VIEW={active:false,marks:new Map(),cache:new Map(),passes:0};

function coveDetail(t,size=1) {
  // Fine material relief fades with its projected footprint, without a model swap.
  return 1-smooth(clamp((t/projX/size-.012)/.065,0,1));
}
function coveGroove(u,period,width,footprint) {
  if(footprint>period*.5)return width/period;
  const f=fract(u/period),distance=Math.min(f,1-f)*period,filter=Math.max(width*.3,footprint);
  return (1-smooth(clamp((distance-width*.5)/filter+.5,0,1)))*Math.min(1,width/filter);
}
const coveLight=(nx,ny,nz)=>.32+.68*Math.max(0,-nx*.45+ny*.3+nz*.84);
function coveTimber(i,u,v,L,t,nx=0,ny=0,nz=1,seed=0,size=1) {
  const fine=coveDetail(t,size),grain=fine?Math.sin(v*240/size+Math.sin(u*4/size+seed)*2):0;
  const streak=Math.sin(u*8/size+seed)*.15+grain*.24*fine;
  const light=coveLight(nx,ny,nz);
  BG[i]=C(BRICK,2.5+(2.2+L*.28)*light+streak);
  set(i,' ',C(WARM,L*.6));return true;
}
function coveMetal(i,L,nx=0,ny=0,nz=1,base=GRAY) {
  const light=coveLight(nx,ny,nz),glint=Math.pow(Math.max(0,nx*.2+ny*.65+nz*.73),12);
  BG[i]=C(base,1.4+(2+L*.28)*light+glint*3);
  set(i,' ',0);return true;
}
// A rounded solid with a continuous normal, tightly clipped before marching.
// One surface serves the top, edges and ends; no decorative slabs overlap it.
function coveRayRounded(ox,oy,oz,rx,ry,rz,b) {
  const qx=ox-b.x,qy=oy-b.y,u0=qx*b.c+qy*b.s,v0=-qx*b.s+qy*b.c;
  const du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c,zc=(b.z0+b.z1)/2,hh=(b.z1-b.z0)/2;
  let enter=.01,leave=Infinity;
  for(const [o,d,h]of [[u0,du,b.hl],[v0,dv,b.hw],[oz-zc,rz,hh]]) {
    if(Math.abs(d)<1e-10){if(Math.abs(o)>h)return -1;continue;}
    const a=(-h-o)/d,z=(h-o)/d;enter=Math.max(enter,Math.min(a,z));leave=Math.min(leave,Math.max(a,z));
  }
  if(enter>leave)return -1;
  const radius=b.round,speed=Math.hypot(rx,ry,rz);
  for(let t=enter,n=0;n<32&&t<=leave+.00001;n++) {
    const u=u0+du*t,v=v0+dv*t,w=oz+rz*t;
    const x=Math.abs(u)-b.hl+radius,y=Math.abs(v)-b.hw+radius,z=Math.abs(w-zc)-hh+radius;
    const ax=Math.max(x,0),ay=Math.max(y,0),az=Math.max(z,0),len=Math.hypot(ax,ay,az);
    const dist=len+Math.min(Math.max(x,y,z),0)-radius;
    if(dist<Math.max(.00015,b.round*.015,t/projX*.12)) {
      let nx=0,ny=0,nz=0;
      if(len>1e-9){nx=Math.sign(u)*ax/len;ny=Math.sign(v)*ay/len;nz=Math.sign(w-zc)*az/len;}
      else if(x>=y&&x>=z)nx=Math.sign(u);else if(y>=z)ny=Math.sign(v);else nz=Math.sign(w-zc);
      HIT.u=u;HIT.v=v;HIT.w=w;HIT.nx=b.c*nx-b.s*ny;HIT.ny=b.s*nx+b.c*ny;HIT.nz=nz;
      HIT.face=Math.abs(nz)>.7?(nz>0?5:6):Math.abs(nx)>Math.abs(ny)?(nx>0?1:2):(ny>0?3:4);
      return t;
    }
    t+=Math.max(.00002,dist)/speed;
  }
  return -1;
}
function coveRound(x,y,c,s,hl,hw,z0,z1,r,material='wood',seed=0) {
  const b={...boxAt(x,y,c,s,hl,hw,z0,z1),round:Math.min(r,hl*.98,hw*.98,(z1-z0)*.49)};
  drawBox(b,(i,t,L)=>material==='wood'?coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,seed):coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,material),coveRayRounded);
}
// Analytic surfaces of revolution: the profile includes the lip and inside of
// a vessel, so handles and rims enclose actual space rather than a painted top.
function coveRayLathe(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y;let best=Infinity,segment=-1,hitNx=0,hitNy=0,hitNz=0;
  for(let k=1;k<b.profile.length;k++) {
    const [za,ra]=b.profile[k-1],[zb,rb]=b.profile[k],dz=zb-za;
    if(Math.abs(dz)<1e-9) {
      if(Math.abs(rz)<1e-10)continue;
      const t=(za-oz)/rz,r=Math.hypot(x+rx*t,y+ry*t);
      if(t>.01&&t<best&&r>=Math.min(ra,rb)-1e-8&&r<=Math.max(ra,rb)+1e-8){best=t;segment=k;hitNx=hitNy=0;hitNz=ra>rb?1:-1;}
      continue;
    }
    const slope=(rb-ra)/dz,r0=ra+slope*(oz-za),a=rx*rx+ry*ry-(slope*rz)**2;
    const q=2*(x*rx+y*ry-r0*slope*rz),cc=x*x+y*y-r0*r0,disc=q*q-4*a*cc;
    if(disc<0)continue;
    const roots=Math.abs(a)<1e-10?(Math.abs(q)>1e-10?[-cc/q]:[]):[(-q-Math.sqrt(disc))/(2*a),(-q+Math.sqrt(disc))/(2*a)];
    for(const t of roots) {
      const z=oz+rz*t;
      if(t<=.01||t>=best||z<Math.min(za,zb)-1e-8||z>Math.max(za,zb)+1e-8)continue;
      const u=x+rx*t,v=y+ry*t,r=Math.hypot(u,v)||1,n=Math.hypot(1,slope),sign=Math.sign(dz);
      best=t;segment=k;hitNx=u/r/n*sign;hitNy=v/r/n*sign;hitNz=-slope/n*sign;
    }
  }
  if(segment<0)return -1;
  HIT.u=x+rx*best;HIT.v=y+ry*best;HIT.w=oz+rz*best;HIT.part=segment;
  HIT.nx=hitNx;HIT.ny=hitNy;HIT.nz=hitNz;HIT.face=hitNz>.9?5:hitNz<-.9?6:0;
  return best;
}
function coveLathe(x,y,z,profile,shade) {
  const points=profile.map(([h,r])=>[h+z,r]),r=Math.max(...points.map(p=>p[1]));
  drawBox({...boxAt(x,y,1,0,r,r,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),profile:points},shade,coveRayLathe);
}
function coveRayCapsule(ox,oy,oz,rx,ry,rz,b) {
  const bx=b.bx-b.ax,by=b.by-b.ay,bz=b.bz-b.az,x=ox-b.ax,y=oy-b.ay,z=oz-b.az;
  const len=bx*bx+by*by+bz*bz,rr=rx*rx+ry*ry+rz*rz,br=bx*rx+by*ry+bz*rz,bo=bx*x+by*y+bz*z,ro=rx*x+ry*y+rz*z,oo=x*x+y*y+z*z;
  const a=len*rr-br*br,q=len*ro-bo*br,c=len*oo-bo*bo-b.r*b.r*len,h=q*q-a*c;
  let t=Infinity,along=0;
  if(h>=0&&Math.abs(a)>1e-12){const s=(-q-Math.sqrt(h))/a,k=bo+s*br;if(s>.01&&k>=0&&k<=len){t=s;along=k/len;}}
  for(const end of [0,1]) {
    const ex=x-bx*end,ey=y-by*end,ez=z-bz*end,d=ex*rx+ey*ry+ez*rz,disc=d*d-rr*(ex*ex+ey*ey+ez*ez-b.r*b.r);
    if(disc<0)continue;const s=(-d-Math.sqrt(disc))/rr;
    if(s>.01&&s<t){t=s;along=end;}
  }
  if(!Number.isFinite(t))return -1;
  HIT.u=ox+rx*t;HIT.v=oy+ry*t;HIT.w=oz+rz*t;
  HIT.nx=(x+rx*t-bx*along)/b.r;HIT.ny=(y+ry*t-by*along)/b.r;HIT.nz=(z+rz*t-bz*along)/b.r;HIT.face=0;
  return t;
}
function coveTube(ax,ay,az,bx,by,bz,r,base=GRAY) {
  const depth=Math.max(.02,dx*(ax+bx)/2+dy*(ay+by)/2);
  if(r*2*projX/depth<1.5){rod(ax,ay,az,bx,by,bz,r,base,1.1);return;}
  drawBox({...boxAt((ax+bx)/2,(ay+by)/2,1,0,Math.abs(bx-ax)/2+r,Math.abs(by-ay)/2+r,Math.min(az,bz)-r,Math.max(az,bz)+r),ax,ay,az,bx,by,bz,r},
    (i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,base),coveRayCapsule);
}
function coveArc(x,y,z,r,a0,a1,thick,base=GRAY,n=12) {
  for(let k=0;k<n;k++) {
    const a=a0+(a1-a0)*k/n,b=a0+(a1-a0)*(k+1)/n;
    coveTube(x+Math.cos(a)*r,y,z+Math.sin(a)*r,x+Math.cos(b)*r,y,z+Math.sin(b)*r,thick,base);
  }
}

function coveBench(x,y,fx) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const v of [-.12,.12])coveRound(vx+v,vy,0,1,1.16,.112,.39,.45,.025,'wood',4);
    for(const u of [-.9,.9])for(const v of [-.18,.18])coveRound(vx+v,vy+u,1,0,.035,.045,0,.39,.018,'wood');
    for(const u of [-.96,.96])coveRound(vx-fx*.25,vy+u,1,0,.035,.035,.18,1.02,.016,'wood');
    for(const z of [.64,.84,1])coveRound(vx-fx*.25,vy,0,1,1.16,.032,z-.06,z+.02,.018,'wood',3);
    coveRound(vx,vy,0,1,.95,.025,.14,.21,.012,'wood');
  },[.29,1.2,1.02]),bench:true,fx,fy:0,h:.45,radius:1.3};
}
function coveTable(vx,vy) {
  for(const x of [-.91,.91])for(const y of [-.38,.38])coveRound(vx+x,vy+y,1,0,.055,.055,0,.74,.018,'wood',2);
  for(const y of [-.42,.42])coveRound(vx,vy+y,1,0,1.02,.035,.59,.74,.015,'wood');
  // Three edge-rounded boards meet across a narrow, real joint.
  for(let k=-1;k<=1;k++)coveRound(vx,vy+k*.36,1,0,1.15,.177,.74,.81,.025,'wood',k+5);
}
function coveLogbook(vx,vy) {
  coveRound(vx,vy,1,0,.29,.215,.81,.828,.008,GREEN);
  for(const side of [-1,1]) {
    const b={...boxAt(vx+side*.14,vy,1,0,.135,.195,.828,.855),round:.007};
    drawBox(b,(i,t,L)=>{
      const edge=Math.abs(HIT.u)>.119||Math.abs(HIT.v)>.18;
      BG[i]=C(WHITE,4.5+L*.25);
      const line=Math.floor((HIT.v+.17)*29),ink=HIT.face===5&&!edge&&fract((HIT.v+.17)*29)<.13&&Math.abs(HIT.u)<.11-(line%3)*.015;
      set(i,ink?'~':' ',C(BLACK,12));return true;
    },coveRayRounded);
  }
  rod(vx+.04,vy+.2,.867,vx+.24,vy-.12,.867,.008,YEL,1.3);
}
const COVE_CUP_PROFILE=[[0,0],[0,.066],[.015,.082],[.17,.087],[.19,.082],[.19,.068],[.035,.061],[.035,0]];
function coveCup(vx,vy,z) {
  coveLathe(vx,vy,z,COVE_CUP_PROFILE,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,STONE));
  drum(vx,vy,.069,z+.125,z+.128,(i,t,L)=>{BG[i]=C(BRICK,1.1);set(i,' ',0);return true;});
  coveArc(vx+.09,vy,z+.1,.06,-Math.PI*.6,Math.PI*.6,.012,STONE);
}
function coveGear(vx,vy) {
  for(const x of [-.94,.94])coveRound(vx+x,vy-.38,1,0,.045,.055,0,2.38,.018,'wood');
  for(const z of [.17,1.13,2.28])coveRound(vx,vy-.35,1,0,1.04,.065,z-.04,z+.04,.015,'wood');
  for(let k=0;k<4;k++) {
    const x=vx-.72+k*.48,y=vy+.02;
    rod(x,y,.12,x+.06,y,1.55,.014,[GREEN,BRICK,GRAY,GREEN][k],1.3);
    rod(x+.06,y,1.55,x+.12,y-.04,2.24,.007,GRAY,1.2);
    coveLathe(x,y+.035,.43,[[0,0],[0,.057],[.014,.065],[.045,.065],[.057,.05],[.057,0]],(i,t,L)=>{
      if(HIT.face===5){const spoke=Math.abs(Math.sin(Math.atan2(HIT.v,HIT.u)*4))<.16;BG[i]=C(spoke?GRAY:BRICK,spoke?5:2);set(i,' ',0);return true;}
      return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);
    });
    rod(x+.12,y-.04,2.24,x+.18,y+.04,1.15,.0025,STONE,.7);
  }
}
function coveChest(vx,vy) {
  for(const x of [-.31,.31])for(const y of [-.23,.23])coveRound(vx+x,vy+y,1,0,.055,.045,0,.08,.015,'wood');
  coveRound(vx,vy,1,0,.43,.31,.08,.37,.045,'wood',7);
  coveRound(vx,vy,1,0,.44,.32,.37,.53,.075,'wood',7);
  for(const x of [-.28,.28])coveRound(vx+x,vy+.315,1,0,.018,.014,.12,.46,.008,GRAY);
  coveRound(vx,vy+.33,1,0,.045,.016,.29,.43,.012,YEL);
  for(const x of [-.24,.24])rod(vx+x,vy-.31,.375,vx+x,vy-.31,.42,.017,GRAY,1.2);
}
function coveLantern(vx,vy) {
  rod(vx,vy,2.42,vx,vy,2.7,.012,GRAY,1.2);
  coveArc(vx,vy,2.31,.115,0,Math.PI,.012,GRAY);
  coveLathe(vx,vy,2.04,[[0,0],[0,.075],[.02,.115],[.055,.12],[.07,.085],[.07,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  coveLathe(vx,vy,2.11,[[0,0],[0,.085],[.03,.108],[.12,.1],[.16,.074],[.16,0]],(i,t,L)=>{
    BG[i]=C(WARM,6+3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;
  });
  coveLathe(vx,vy,2.27,[[0,0],[0,.105],[.025,.12],[.045,.08],[.07,.045],[.07,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  for(const x of [-.105,.105])rod(vx+x,vy,2.085,vx+x,vy,2.28,.009,GRAY,1.2);
}
function coveBucket(vx,vy) {
  coveLathe(vx,vy,0,[[0,0],[0,.125],[.025,.14],[.3,.19],[.32,.192],[.33,.18],[.33,.171],[.04,.118],[.04,0]],(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz));
  coveArc(vx,vy,.31,.18,0,Math.PI,.009,GRAY);
}

function coveWindowFrame(win,inside) {
  const west=win.face==='west',east=win.face==='east',north=win.face==='north';
  const def=ROOM_DEFS.islandshelter,W=def.grid[0].length,H=def.grid.length;
  let x=west?1:east?W-1:win.center,y=north?1:win.face==='south'?H-1:win.center;
  let c=west||east?0:1,s=west||east?1:0;
  const inward=west?1:east?-1:north?1:-1;
  if(inside){if(west||east)x+=inward*.045;else y+=inward*.045;}
  return {x,y,c,s,inward};
}
function coveRoomFrame(win,vx,vy) {
  const {c,s}=coveWindowFrame(win,true),mid=(win.bottom+win.top)/2;
  for(const side of [-1,1])coveRound(vx+c*side*win.half,vy+s*side*win.half,c,s,.055,.065,win.bottom-.055,win.top+.055,.018,'wood',2);
  for(const z of [win.bottom,win.top])coveRound(vx,vy,c,s,win.half-.055,.065,z-.055,z+.055,.018,'wood',2);
  coveRound(vx,vy,c,s,.025,.05,win.bottom+.055,win.top-.055,.012,'wood');
  coveRound(vx,vy,c,s,win.half-.055,.05,mid-.022,mid+.022,.012,'wood');
  coveRound(vx,vy,c,s,win.half+.1,.15,win.bottom-.12,win.bottom-.055,.025,'wood',3);
}
function coveInteriorProps() {
  const props=[coveBench(1.7,6,1),coveBench(10.2,6,-1),
    {...ROOM_MODEL(4,3.4,(vx,vy)=>{coveTable(vx,vy);coveLogbook(vx,vy);coveCup(vx+.7,vy+.13,.81);},[1.15,.55,.87]),radius:1.5},
    ROOM_MODEL(8.6,1.6,coveGear,[1.05,.25,2.38]),ROPE_COIL(2,1.7),
    ROOM_MODEL(9.8,3.4,coveChest,[.44,.34,.53]),ROOM_MODEL(6,5,coveLantern),
    ROOM_MODEL(1.45,2.9,coveBucket,[.2,.2,.5])];
  for(const win of COVE_WINDOWS) {
    const p=coveWindowFrame(win,true);
    props.push({...ROOM_MODEL(p.x,p.y,(vx,vy)=>coveRoomFrame(win,vx,vy)),radius:win.half+.3});
  }
  props.push({...ROOM_MODEL(6,5,(vx,vy)=>{
    for(const y of [-2,1,3])coveRound(vx,vy+y,1,0,5,.075,2.48,2.7,.025,'wood',3);
    for(const x of [-4.95,4.95])coveRound(vx+x,vy,0,1,3.95,.05,.03,.16,.016,'wood');
  }),radius:7});
  return props;
}
ROOM_DEFS.islandshelter.props=coveInteriorProps;
ROOM_DEFS.islandshelter.wall=coveInteriorWall;
ROOM_DEFS.islandshelter.floor='cove';ROOM_DEFS.islandshelter.ceil='cove';
ROOM_DEFS.islandshelter.light=.9;

ROOM_FLOORS.cove=(i,f,x,y,r,column,L)=>{
  const row=Math.floor(y/.28),u=x+((row&1)?1.3:0),depth=Math.max(.1,(eye*projY)/Math.max(1,r-hor));
  const footprint=depth/projX,fine=coveDetail(depth),seam=Math.max(coveGroove(y,.28,.008,footprint),coveGroove(u,2.6,.008,footprint));
  const grain=Math.sin(x*18+Math.sin(y*9))*fine;
  BG[i]=C(BRICK,3.6+f*2.3+(row%3)*.14+grain*.12-seam*1.8);
  set(i,' ',C(WARM,L*.7));
};
ROOM_CEILS.cove=(i,r,column,x,y)=>{
  const depth=Math.max(.1,(room.def.height-eye)*projY/Math.max(1,hor-r)),seam=coveGroove(x,.3,.008,depth/projX);
  BG[i]=C(BRICK,4.8+Math.sin(y*9+x)*.12*coveDetail(depth)-seam*1.4);set(i,' ',0);
};
function coveInteriorWall(i,u,uStep,z,d,mx,my,L) {
  const along=Math.abs(u),face=mx===0?'west':mx===room.W-1?'east':my===0?'north':'south';
  if(room.grid[my]?.[mx]==='D') {
    BG[i]=C(GREEN,2.2+L*.16);
    if(wallText(i,u,uStep,z,d,'EXIT',6,2.25,.13,.17,C(STONE,Math.max(8,L))))return true;
    const panel=Math.abs(along-6)>.04&&Math.abs(along-6)<.78&&z>.25&&z<1.9;
    set(i,panel&&Math.abs(z-1.1)<.025?'=':' ',C(YEL,L));return true;
  }
  const win=COVE_WINDOWS.find(w=>w.face===face&&Math.abs(along-w.center)<w.half&&z>w.bottom&&z<w.top);
  if(win) {
    const du=Math.abs(along-win.center),mid=(win.bottom+win.top)/2;
    if(du>win.half-.045||du<.025||z<win.bottom+.045||z>win.top-.045||Math.abs(z-mid)<.022) {
      return coveTimber(i,along,z,L,d,face==='west'?1:face==='east'?-1:0,face==='north'?1:face==='south'?-1:0,0,2);
    }
    const group=COVE_VIEW.marks.get(face)||[];if(!COVE_VIEW.marks.has(face))COVE_VIEW.marks.set(face,group);
    group.push([i,d]);BG[i]=C(CYAN,4);set(i,' ',0);return true;
  }
  const board=Math.floor(z/.22),joint=coveGroove(z,.22,.008,d/projY);
  const relief=1-smooth(clamp((d/projY/.22-.2)/.65,0,1));
  BG[i]=C(BRICK,4.8+L*.2-joint*1.8+Math.cos(z/.22*Math.PI*2)*.42*relief+Math.sin(along*9+board)*.12*coveDetail(d));set(i,' ',0);
  return true;
}

function coveExteriorWindow(win) {
  const c=COVE_CABIN,side=win.face==='west'||win.face==='east';
  return {x:win.face==='west'?c.x0:win.face==='east'?c.x1:(c.x0+c.x1)/2+(win.center-6)/10,
    y:win.face==='north'?c.y0:win.face==='south'?c.y1:(c.y0+c.y1)/2+(win.center-5)/10,
    c:side?0:1,s:side?1:0,half:win.half/10,bottom:win.bottom/10,top:win.top/10,face:win.face};
}
function coveFacade(cabin,i,z,h,d,side,wc,fog) {
  const face=side?(py>cabin.y1?'south':'north'):(px<cabin.x0?'west':'east');
  const light=fog*amb*(side?13:10),board=Math.floor(z/.025),joint=coveGroove(z,.025,.001,d/projY),fine=coveDetail(d,.1);
  const nx=face==='west'?-1:face==='east'?1:0,ny=face==='north'?-1:face==='south'?1:0;
  if(z<.025) {
    const stone=Math.floor(wc*13)+Math.floor(z*75)*3,grout=fract(wc*13+Math.floor(z*75)*.5)<.05;
    BG[i]=C(grout?GRAY:STONE,(grout?1.4:3)+light*.18+(stone%3)*.15);set(i,' ',0);return;
  }
  if(face==='south'&&Math.abs(wc-492)<.1&&z<.25) {
    BG[i]=C(GREEN,2.3+light*.18);
    const panel=Math.abs(wc-492)<.074&&z>.035&&z<.22;
    if(panel){const edge=Math.min(.074-Math.abs(wc-492),z-.035,.22-z);BG[i]=C(GREEN,(edge<.006?1.6:3)+light*.14);}
    set(i,' ',0);return;
  }
  for(const win of COVE_WINDOWS)if(win.face===face) {
    const w=coveExteriorWindow(win),du=wc-(side?w.x:w.y);
    if(Math.abs(du)<w.half&&z>w.bottom&&z<w.top) {
      const mullion=Math.abs(du)<.003||Math.abs(z-(w.bottom+w.top)/2)<.0025;
      BG[i]=C(mullion?BRICK:night>.35?WARM:CYAN,mullion?3+light*.2:2.3+day*1.2+night*3);
      set(i,' ',0);return;
    }
  }
  const grain=fine?Math.sin(z*3400+Math.sin(wc*17+board)*2)*fine*.3:0;
  const relief=1-smooth(clamp((d/projY/.025-.2)/.65,0,1));
  BG[i]=C(BRICK,3.3+light*.31*coveLight(nx,ny,.1)+grain-joint*1.5+(board%3)*.08+Math.cos(z/.025*Math.PI*2)*.6*relief);
  set(i,' ',0);
}
function coveRoofShade(roof,i,t,L) {
  if(HIT.face===2||HIT.face===3) {
    const row=Math.floor(HIT.w/.025),groove=coveGroove(HIT.w,.025,.001,t/projY);
    BG[i]=C(BRICK,3.4+L*.24+(row%3)*.1-groove*1.6);set(i,' ',0);return true;
  }
  const far=coveDetail(t,.1),course=Math.floor(HIT.u/.055),q=fract(HIT.u/.055),seam=fract(HIT.v/.13+(course&1)*.5);
  const edge=q<.06||seam<.035,light=coveLight(Math.sign(HIT.u)*.16,0,.985);
  BG[i]=C(GREEN,2+(L*.27+1.8)*light-(edge?.8:0)*far+Math.sin(course*8+Math.floor(HIT.v/.13))*far*.15);
  set(i,' ',0);paintSettledSnow(i,roof.x+HIT.u,roof.y+HIT.v,L,.7,0,HIT.w);return true;
}
function drawCoveExterior() {
  const c=COVE_CABIN,cx=(c.x0+c.x1)/2,cy=(c.y0+c.y1)/2;
  if(!worldReady||!inView(cx-px,cy-py,1.7))return;
  const part=(x,y,ca,sa,hl,hw,z0,z1,r=.002,mat='wood')=>coveRound(x-px,y-py,ca,sa,hl,hw,z0,z1,r,mat);
  for(const win of COVE_WINDOWS) {
    const w=coveExteriorWindow(win),nx=win.face==='west'?-1:win.face==='east'?1:0,ny=win.face==='north'?-1:win.face==='south'?1:0;
    const x=w.x+nx*.004,y=w.y+ny*.004;
    for(const side of [-1,1])part(x+w.c*w.half*side,y+w.s*w.half*side,w.c,w.s,.006,.006,w.bottom-.006,w.top+.006);
    for(const z of [w.bottom,w.top])part(x,y,w.c,w.s,w.half-.006,.006,z-.006,z+.006);
    part(x,y,w.c,w.s,.003,.005,w.bottom+.006,w.top-.006,.001);
    const mid=(w.bottom+w.top)/2;part(x,y,w.c,w.s,w.half-.006,.005,mid-.0025,mid+.0025,.001);
    part(x+nx*.007,y+ny*.007,w.c,w.s,w.half+.012,.015,w.bottom-.014,w.bottom-.006,.002);
  }
  for(const side of [-1,1])part(492+side*.107,c.y1+.005,1,0,.007,.01,0,.26);
  part(492,c.y1+.005,1,0,.1,.01,.25,.263);
  const sign=boxAt(492-px,c.y1+.016-py,1,0,.31,.006,.263,.291);
  drawBox(sign,(i,t,L)=>{
    const word=HIT.face===3?'FISHING SHELTER':'';
    BG[i]=C(STONE,6+L*.24);set(i,word?worldText(word,HIT.u,HIT.w,t,i,sign.x,sign.y+sign.hw,.277,1,0,.036,.02):' ',C(BLACK,15));return true;
  });
  // Brass handle is seated on the door plane and stays out of the entrance path.
  coveTube(492.066-px,c.y1+.006-py,.105,492.085-px,c.y1+.006-py,.105,.003,YEL);
  const roof=ISLAND_ROOFS.find(r=>r.cabin===c),slope=(roof.z1-roof.z0)/roof.hl;
  for(const y of [cy-roof.hw,cy+roof.hw])for(const side of [-1,1])
    coveTube(cx-px,y-py,roof.z1,cx+side*roof.hl-px,y-py,roof.z1-slope*roof.hl,.006,STONE);
  for(const side of [-1,1]) {
    const x=cx+side*roof.hl;
    coveTube(x-px,cy-roof.hw-py,roof.z0,x-px,cy+roof.hw-py,roof.z0,.007,GREEN);
    coveTube(x-px,c.y1+.08-py,roof.z0,x-px,c.y1+.08-py,.02,.0055,GREEN);
  }
}

// Render the actual island through visible glass. An offscreen scene pass is
// shared by all panes on one wall, cached while the camera/time stay unchanged.
// Its buffers and camera are isolated; the interior keeps its collision/depth.
function coveWindowBegin(){COVE_VIEW.marks.clear();}
function coveViewBuffers(){const n=cols*rows;return {CH:new Array(n),COL:new Uint8Array(n),BG:new Uint8Array(n),ZB:new Float32Array(n),ZBG:new Float32Array(n),FL:new Uint8Array(n),FOGS:new Uint8Array(n),FOGB:new Uint8Array(n),BASE:new Int32Array(cols),LAMPL:new Uint8Array(n)};}
function coveWindowMask(visible) {
  const mask={cells:new Uint8Array(cols*rows),columns:new Uint8Array(cols)};
  for(const [i]of visible){
    const column=i%cols,row=Math.floor(i/cols);mask.cells[i]=1;mask.columns[column]=1;
    // Sea reflections sample the sky above the horizon, including a row of
    // ripple displacement. Those source cells must exist outside the glass.
    if(row>hor)for(let ripple=-1;ripple<=1;ripple++) {
      const source=2*clamp(hor,0,rows)-row-1+ripple;
      if(source>=0&&source<rows)mask.cells[source*cols+column]=1;
    }
  }
  return mask;
}
function coveWindowScene(face,visible) {
  const key=[cols,rows,px,py,a,pitch,eye,tf,projY,Math.floor(T*24),Math.floor(tod*120),weather,Math.floor(snowCover*32)].join('|');
  let cached=COVE_VIEW.cache.get(face);
  if(cached?.key===key)return cached.buffers;
  const buffers=cached?.buffers.CH.length===cols*rows?cached.buffers:coveViewBuffers();
  const savedBuffers={CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL};
  const saved=[mode,room,px,py,freecam,amb,vis,eye,dx,dy,tf,projX,projY,hor,lookHit,figFineT,figFineN];
  const wh={...WH},hit={...HIT},cell=CITY.cell,c=COVE_CABIN;
  try {
    [CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL]=[buffers.CH,buffers.COL,buffers.BG,buffers.ZB,buffers.ZBG,buffers.FL,buffers.FOGS,buffers.FOGB,buffers.BASE,buffers.LAMPL];
    const mask=coveWindowMask(visible);
    ZB.fill(0);FL.fill(0);FOGS.fill(0);FOGB.fill(0);
    const x=(c.x0+c.x1)/2+(px-room.W/2)/10,y=(c.y0+c.y1)/2+(py-room.H/2)/10,z=eye/10;
    px=face==='west'?c.x0+(saved[2]-1)/10:face==='east'?c.x1+(saved[2]-(room.W-1))/10:x;
    py=face==='north'?c.y0+(saved[3]-1)/10:face==='south'?c.y1+(saved[3]-(room.H-1))/10:y;
    mode='walk';room=null;freecam={z};COVE_VIEW.active=true;
    amb=.35+.65*day*(1-.35*overcast)*(1-.3*storm)+flash()*.9;
    vis=MAXD*(1-.72*fogAmt-.25*rain-.3*snow);
    CITY.cell=(x,y)=>x>=c.x0&&x<c.x1&&y>=c.y0&&y<c.y1?0:cell(x,y);
    render(0,true,mask);COVE_VIEW.passes++;
  } finally {
    CITY.cell=cell;COVE_VIEW.active=false;
    [mode,room,px,py,freecam,amb,vis,eye,dx,dy,tf,projX,projY,hor,lookHit,figFineT,figFineN]=saved;
    [CH,COL,BG,ZB,ZBG,FL,FOGS,FOGB,BASE,LAMPL]=[savedBuffers.CH,savedBuffers.COL,savedBuffers.BG,savedBuffers.ZB,savedBuffers.ZBG,savedBuffers.FL,savedBuffers.FOGS,savedBuffers.FOGB,savedBuffers.BASE,savedBuffers.LAMPL];
    Object.assign(WH,wh);Object.assign(HIT,hit);
  }
  COVE_VIEW.cache.set(face,{key,buffers});return buffers;
}
function coveWindowComposite() {
  for(const [face,marks]of COVE_VIEW.marks) {
    const visible=marks.filter(([i,d])=>Math.abs(ZB[i]-d)<.0001);
    if(!visible.length)continue;
    const view=coveWindowScene(face,visible);
    for(const [i]of visible){CH[i]=view.CH[i];COL[i]=view.COL[i];BG[i]=view.BG[i];FOGS[i]=view.FOGS[i];FOGB[i]=view.FOGB[i];}
  }
}
