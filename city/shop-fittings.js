// Small shop fittings shared between rooms: a stack of binders or books lying
// flat, and a rug on the floor.
// A stack lying flat at z: each [hl, hw, thickness, colour], bottom first,
// each resting on the one beneath, the spines along u (c, s).
function BOOK_STACK(x,y,z,books,c=1,s=0) {
  const tops=[];let h=z;for(const b of books){tops.push(h);h+=b[2];}
  const cover=col=>(i,t,L)=>{const edge=HIT.face!==5&&HIT.face!==6&&Math.abs(HIT.nz)<.5&&(HIT.face===1||HIT.face===2);
    BG[i]=C(edge?WHITE:col,(edge?3.2:2.2)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const shades=books.map(b=>cover(b[3])),hl=Math.max(...books.map(b=>b[0])),hw=Math.max(...books.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>books.forEach((b,k)=>coveRound(vx,vy,c,s,b[0],b[1],tops[k],tops[k]+b[2],.004,shades[k]))),
    box:boxAt(x,y,c,s,hl,hw,z,h),radius:Math.hypot(hl,hw),bookStack:{z,top:h,tops}};
}
// A rug on the floor, a border round it: (u, v) from its centre to shade(e, u, v) by e, the distance in from its edge.
function FLOOR_RUG(x,y,hl,hw,field,border,c=1,s=0) {
  const shade=(i,t,L)=>{const e=Math.min(hl-Math.abs(HIT.u),hw-Math.abs(HIT.v));
    BG[i]=C(e<.12?border:field,e<.12?3:1.6+L*.2);return set(i,e>.12&&fract((HIT.u+HIT.v)*3)<.15?'+':' ',C(border,7)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,0,.012),gondolaFlat(c,s,shade))),rug:true};
}
// A disc standing on edge, its axis along v (facing fx,fy): a side-on lathe.
function shopDisc(vx,vy,c,s,z,profile,shade) {
  const r=Math.max(...profile.map(p=>p[1])),d=Math.max(...profile.map(p=>Math.abs(p[0])));
  drawBox({...boxAt(vx,vy,c,s,r,d,z-r,z+r),centerZ:z,clockShape:{x:0,y:0,profile}},shade,homeClockRay);
}
// The key cutter on a counter top at z: a cast base, the vice carriage, the
// motor housing, and the cutting wheel on edge turning, to the customer (fx,fy).
function KEY_CUTTER(x,y,z,fx,fy) {
  const c=fy,s=-fx,wheel=[[-.006,0],[-.006,.055],[.006,.055],[.006,0]];
  const spin=(i,t,L)=>{const a=Math.atan2(HIT.w-(z+.17),HIT.u)+T*25,tooth=fract(a/TAU*24)<.5&&Math.hypot(HIT.u,HIT.w-(z+.17))>.045;
    BG[i]=C(GRAY,(tooth?3.6:2.4)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.18,.15,z,z+.05,GRAY,.012); // the base
    part(.06,-.05,.08,.07,z+.05,z+.25,GRAY,.02); // the motor housing
    part(0,.037,.008,.017,z+.162,z+.178,GRAY,.004); // the spindle out to the wheel
    part(-.07,.05,.06,.05,z+.05,z+.1,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE),.008); // the vice carriage
    shopDisc(vx-s*.06-c*.0,vy+c*.06,c,s,z+.17,wheel,spin); // the wheel, turning
  }),box:boxAt(x,y,c,s,.18,.15,z,z+.25),radius:.25,keyCutter:{z}};
}
// Boards stood on end against a wall: [u, height] along u (c,s) from (x, y).
function LUMBER(x,y,boards,c=0,s=1,t=.05,w=.12) {
  const shade=(i,tt,L)=>coveTimber(i,HIT.u,HIT.w,L,tt,HIT.nx,HIT.ny,HIT.nz,7);
  const span=Math.max(...boards.map(b=>Math.abs(b[0])))+w,h=Math.max(...boards.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(const [u,bh] of boards)coveRound(vx+c*u,vy+s*u,c,s,w,t,0,bh,.006,shade);}),
    box:boxAt(x,y,c,s,span,t,0,h),radius:span,lumber:{boards,t,w}};
}
// Distance to the nearest turn is enough for the whole coil. A single clipped
// surface avoids testing every profile segment of every turn for each cell.
function shopHoseRay(ox,oy,oz,rx,ry,rz,b) {
  const x=ox-b.x,y=oy-b.y,{R,r,turns}=b.hoseShape,speed=Math.hypot(rx,ry,rz);
  let enter=.01,leave=Infinity;
  for(const [o,d,lo,hi] of [[x,rx,-b.hl,b.hl],[y,ry,-b.hw,b.hw],[oz,rz,b.z0,b.z1]]){
    if(Math.abs(d)<1e-10){if(o<lo||o>hi)return -1;continue;}
    const a=(lo-o)/d,z=(hi-o)/d;enter=Math.max(enter,Math.min(a,z));leave=Math.min(leave,Math.max(a,z));
  }
  if(enter>leave)return -1;
  for(let t=enter,k=0;k<64&&t<=leave+.00001;k++){
    const u=x+rx*t,v=y+ry*t,w=oz+rz*t,rho=Math.hypot(u,v),dr=rho-R;
    const zc=r+clamp(Math.round((w-r)/(2*r)),0,turns-1)*2*r,dz=w-zc,len=Math.hypot(dr,dz),dist=len-r;
    if(dist<Math.max(.00008,t/projX*.1)){
      const radial=rho>1e-10?dr/(rho*len):0;
      HIT.u=u;HIT.v=v;HIT.w=w;HIT.nx=u*radial;HIT.ny=v*radial;HIT.nz=dz/len;
      HIT.face=Math.abs(HIT.nz)>.7?(HIT.nz>0?5:6):Math.abs(HIT.nx)>Math.abs(HIT.ny)?(HIT.nx>0?1:2):(HIT.ny>0?3:4);
      return t;
    }
    t+=Math.max(.00002,dist)/speed;
  }
  return -1;
}
// Six continuous, round turns of hose, each touching its neighbours.
function HOSE_COILS(x,y,R=.34,turns=6,r=.022,col=GREEN) {
  const shape={R,r,turns},box={...boxAt(0,0,1,0,R+r,R+r,0,turns*2*r),hoseShape:shape};
  const shade=(i,t,L)=>{BG[i]=C(col,2.2+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox({...box,x:vx,y:vy},shade,shopHoseRay)),
    box:boxAt(x,y,1,0,R+r,R+r,0,turns*2*r),radius:R+r,hose:shape};
}
// Bags of compost lying flat, one on another: plump rounded slabs with a printed band.
function COMPOST_BAGS(x,y,n=4,hl=.4,hw=.28,h=.16) {
  const shade=k=>(i,t,L)=>{const band=Math.abs(HIT.nz)<.6&&Math.abs(HIT.u)<.15&&HIT.face!==5;
    BG[i]=C(band?YEL:k&1?GREEN:BRICK,(band?3:1.8)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const shades=Array.from({length:n},(_,k)=>shade(k));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(let k=n-1;k>=0;k--)coveRound(vx,vy,1,0,hl-k*.01,hw-k*.008,k*h,(k+1)*h,.05,shades[k]);}),
    box:boxAt(x,y,1,0,hl,hw,0,n*h),radius:Math.hypot(hl,hw),bags:{n,h}};
}
// A plain bulkhead hanging from the ceiling over an opening.
function BULKHEAD(x,y,hl,hw,z0,z1,c=1,s=0) {
  const shade=gondolaFlat(c,s,(i,t,L)=>{BG[i]=C(GRAY,1.8+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,z0,z1),shade)),box:{...boxAt(x,y,c,s,hl,hw,z0,z1)},overhead:true};
}
// A rounded cabinet with a real circular arm recess behind the cuff. Only
// rays through the opening need the cylinder intersection; the surrounding
// housing keeps its usual rounded surface. The recess ends inside the cabinet.
function bpCabinetRay(ox,oy,oz,rx,ry,rz,b) {
  HIT.bpInner=false;
  const outer=coveRayRounded(ox,oy,oz,rx,ry,rz,b);
  if(outer<0||HIT.face!==3||HIT.u*HIT.u+(HIT.w-.75)**2>=.06**2)return outer;
  const u0=(ox-b.x)*b.c+(oy-b.y)*b.s,v0=-(ox-b.x)*b.s+(oy-b.y)*b.c;
  const du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c,w0=oz-.75;
  let best=Infinity,nu=0,nv=0,nz=0;
  if(dv<0){const t=-v0/dv;if(t>=outer&&(u0+du*t)**2+(w0+rz*t)**2<=.06**2){best=t;nv=1;}}
  const a=du*du+rz*rz,q=2*(u0*du+w0*rz),d=q*q-4*a*(u0*u0+w0*w0-.06**2);
  if(a>1e-12&&d>=0)for(const t of [(-q-Math.sqrt(d))/(2*a),(-q+Math.sqrt(d))/(2*a)]){
    const v=v0+dv*t;
    if(t>=outer&&t<best&&v>=0&&v<=b.hw){best=t;nu=-(u0+du*t)/.06;nv=0;nz=-(w0+rz*t)/.06;}
  }
  if(!Number.isFinite(best))return -1;
  HIT.u=u0+du*best;HIT.v=v0+dv*best;HIT.w=oz+rz*best;
  HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;HIT.bpInner=true;
  HIT.face=Math.abs(nz)>.7?(nz>0?5:6):Math.abs(nu)>.7?(nu>0?1:2):3;
  return best;
}
// The blood-pressure machine facing (fx,fy): a white cabinet, the cuff's
// ring on the front at arm height, the readout above it.
function BP_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,ring=[[-.02,.06],[-.02,.09],[.03,.09],[.03,.06],[-.02,.06]];
  const white=(i,t,L)=>{BG[i]=C(WHITE,(HIT.bpInner?1.7:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const readout=(i,t,L)=>{BG[i]=C(CYAN,2.4);
    if(HIT.face===3&&(wallText(i,HIT.u,t/projX,HIT.w,t,'READY',0,1.115,.036,.045,C(WHITE,6),BG[i])||
      wallText(i,HIT.u,t/projX,HIT.w,t,'--',0,1.015,.04,.04,C(WHITE,6),BG[i])))return true;
    set(i,' ',0);return true;};
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    drawBox({...boxAt(vx,vy,c,s,.3,.28,0,1.3),round:.03},white,bpCabinetRay); // the cabinet and arm recess
    part(0,.282,.12,.003,.95,1.18,readout); // the readout
    shopDisc(vx-s*.3,vy+c*.3,c,s,.75,ring,metal); // the cuff's ring, standing proud
  }),box:boxAt(x,y,c,s,.3,.33,0,1.3),radius:.45,bpMachine:{fx,fy}};
}
// A small desk: a top on two side panels and a modesty panel; (fx,fy) is the
// way its sitter faces, the modesty panel on the far side.
function SMALL_DESK(x,y,hl,hw,h,fx,fy,col=WHITE) {
  const c=fy,s=-fx,lam=(i,t,L)=>{BG[i]=C(col,2.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,hw,h-.03,h,lam,.008); // the top
    for(const e of [-1,1])part(e*(hl-.015),0,.015,hw-.02,0,h-.03,lam,.004); // the side panels
    part(0,hw-.03,hl-.03,.008,.3,h-.03,lam,.003); // the modesty panel
  }),box:boxAt(x,y,c,s,hl,hw,0,h),radius:Math.hypot(hl,hw),desk:{h}};
}
// A flat monitor on a desk top at z, its screen to (fx,fy).
function DESK_MONITOR(x,y,z,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(GRAY,1.1);set(i,' ',0);return true;}BG[i]=C(CYAN,3.2);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.08,.06,z,z+.012,GRAY,.004); // the foot
    part(0,-.02,.012,.01,z+.012,z+.1,GRAY,.004); // the neck
    part(0,0,.15,.012,z+.08,z+.27,screen); // the screen
  }),box:boxAt(x,y,c,s,.15,.06,z,z+.27),radius:.2,monitor:{z}};
}
// A rubber mat on the floor with rounded edges.
function FLOOR_MAT(x,y,hl,hw,h=.03,col=GRAY,c=1,s=0) {
  const shade=(i,t,L)=>{BG[i]=C(col,1+L*.15*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveRound(vx,vy,c,s,hl,hw,0,h,Math.min(.012,h*.45),shade)),box:boxAt(x,y,c,s,hl,hw,0,h),mat:true};
}
// The housing owns the lip and the recessed inner walls of the return slot.
function shopReturnsRay(ox,oy,oz,rx,ry,rz,b) {
  HIT.slotInner=false;const outer=coveRayRounded(ox,oy,oz,rx,ry,rz,b);
  if(outer<0||HIT.face!==3||Math.abs(HIT.u)>=.14||HIT.w<=.66||HIT.w>=.7)return outer;
  const u=(ox-b.x)*b.c+(oy-b.y)*b.s,v=-(ox-b.x)*b.s+(oy-b.y)*b.c,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
  let best=Infinity,nu=0,nv=0,nz=0;
  const take=(t,x,y,z)=>{const uu=u+du*t,vv=v+dv*t,zz=oz+rz*t;
    if(t<outer||t>=best||Math.abs(uu)>.14+1e-8||vv<.12-1e-8||vv>.2+1e-8||zz<.66-1e-8||zz>.7+1e-8)return;
    best=t;nu=x;nv=y;nz=z;};
  if(Math.abs(dv)>1e-10)take((.12-v)/dv,0,1,0);
  if(Math.abs(du)>1e-10)for(const side of [-1,1])take((side*.14-u)/du,-side,0,0);
  if(Math.abs(rz)>1e-10){take((.66-oz)/rz,0,0,1);take((.7-oz)/rz,0,0,-1);}
  if(!Number.isFinite(best))return -1;
  HIT.u=u+du*best;HIT.v=v+dv*best;HIT.w=oz+rz*best;HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;HIT.slotInner=true;HIT.face=nv?3:nz?(nz>0?5:6):(nu>0?1:2);return best;
}
// A steel returns box: closed foot and housing, a recessed slot under its
// rain hood, and a label seated against the front face.
function RETURNS_BOX(x,y,fx,fy) {
  const c=fy,s=-fx,blue=(i,t,L)=>{if(HIT.slotInner){BG[i]=C(BLUE,.8+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE);};
  const hood=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE);
  const label=(i,t,L)=>{BG[i]=C(WHITE,4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'RETURNS',0,.8,.018,.03,C(BLUE,3),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    drawBox({...boxAt(vx,vy,c,s,.25,.2,.06,.9),round:.03},blue,shopReturnsRay);
    part(0,0,.22,.17,0,.06,GRAY,.01);
    part(0,.22,.16,.02,.7,.72,hood,.006);
    part(0,.202,.12,.002,.76,.84,label);
  }),box:boxAt(x,y,c,s,.25,.24,0,.9),radius:.35,returnsBox:{fx,fy}};
}
// One steady, scaled service number, with its heading above it.
function QUEUE_SCREEN(x,y,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{BG[i]=C(HIT.face===3?CYAN:GRAY,HIT.face===3?2.8:1.6);
    if(HIT.face===3&&(wallText(i,HIT.u,t/projX,HIT.w,t,'NOW SERVING',0,1.455,.028,.035,C(WHITE,6),BG[i])||
      wallText(i,HIT.u,t/projX,HIT.w,t,'01',0,1.335,.08,.1,C(WHITE,7),BG[i])))return true;
    set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.12,.12,0,.02,GRAY,.006);
    part(0,0,.018,.018,.02,1.22,GRAY,.008);
    part(0,0,.18,.03,1.2,1.5,screen);
  }),box:boxAt(x,y,c,s,.18,.12,0,1.5),radius:.25};
}
// A chest of drawers against a wall, its fronts to (fx,fy): a plinth, the
// carcass, three rows of drawers each with two knobs, a top.
function DRESSER(x,y,hl,hw,h,fx,fy) {
  const c=fy,s=-fx,wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,11),rows=3,rh=(h-.14)/rows;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,-.01,hl-.03,hw-.04,0,.08,wood,.006); // the plinth
    part(0,-.01,hl-.01,hw-.02,.07,h-.03,wood,.01); // the carcass
    for(let k=0;k<rows;k++){const z=.09+k*rh;
      part(0,hw-.02,hl-.04,.012,z+.01,z+rh-.01,wood,.006); // a drawer front
      for(const u of [-hl*.45,hl*.45])part(u,hw-.002,.012,.012,z+rh/2-.012,z+rh/2+.012,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,YEL),.008);} // its knobs
    part(0,0,hl,hw,h-.035,h,wood,.012); // the top
  }),box:boxAt(x,y,c,s,hl,hw+.01,0,h),radius:Math.hypot(hl,hw)};
}
// A sewing machine on a table top at z, its needle end along +u: the bed, the
// pillar, the arm across, the head with the needle going.
function SEWING_MACHINE(x,y,z,c=1,s=0) {
  const body=(i,t,L)=>{BG[i]=C(GRAY,1.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),cloth=(i,t,L)=>{BG[i]=C(BLUE,2.4+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const thread=(i,t,L)=>{BG[i]=C(STONE,3.5+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz)-coveGroove(HIT.w-z,.003,.001,t/projX)*coveDetail(t,.03)*.4);set(i,' ',0);return true;};
  const spool=homeLampPart('spool',z+.22,[[0,0],[0,.018],[.002,.018],[.002,.013],[.028,.013],[.028,.018],[.03,.018],[.03,.003],[.04,.003],[.04,0]]).box;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s),up=.006*(1+Math.sin(T*TAU*3));
    part(0,0,.2,.1,z,z+.04,body,.01);
    part(-.15,0,.04,.06,z+.04,z+.2,body,.015);
    part(-.01,0,.18,.045,z+.16,z+.22,body,.02);
    part(.14,0,.04,.05,z+.09,z+.22,body,.015);
    part(.09,.02,.092,.057,z+.04,z+.041,metal,.0004); // needle plate on the bed
    part(.09,.02,.09,.055,z+.041,z+.043,cloth,.0005);
    part(.14,.02,.003,.003,z+.043+up,z+.09,metal,.002);
    part(.12,.02,.002,.003,z+.046,z+.09,metal,.001); // presser-foot stem
    part(.12,.02,.003,.015,z+.046,z+.049,metal,.001);
    for(const e of [-1,1])part(.14,.02+e*.012,.02,.003,z+.043,z+.046,metal,.001);
    drawBox({...spool,x:vx-c*.15+s*.015,y:vy-s*.15-c*.015},thread,coveRayLathe);
    const line=(u,v,h,uu,vv,hh)=>coveTube(vx+c*u-s*v,vy+s*u+c*v,z+h,vx+c*uu-s*vv,vy+s*uu+c*vv,z+hh,.0008,STONE);
    part(.03,.02,.002,.002,z+.22,z+.237,metal,.001);
    line(-.137,-.015,.235,.03,.02,.235);line(.03,.02,.235,.14,.05,.205);line(.14,.05,.205,.14,.05,.11);line(.14,.05,.11,.14,.02,.09);
  }),box:boxAt(x,y,c,s,.2,.1,z,z+.26),radius:.25,sewing:{z}};
}
// A slatted crate of LPs, their top edges each a colour.
function RECORD_CRATE(x,y,hl,hw,seed) {
  const depth=.26,floor=.008,slats=grocerSlats(),sleeve=RECORD_BIN.sleeve,pitch=RECORD_BIN.pitch,len=hl*2-.04;
  const edges=gondolaFlat(1,0,(i,t,L)=>{const j=Math.floor((HIT.u+len/2)/pitch),col=RECORD_COLS[Math.floor(hash(j,seed,72)*RECORD_COLS.length)];
    BG[i]=C(col,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-coveGroove(HIT.u+len/2,pitch,.0015,t/projX)*coveDetail(t,.15)*1.2);set(i,' ',0);return true;});
  const tray={...boxAt(0,0,1,0,hl,hw,0,depth),...kitchenTopProfile(hl,hw,0,depth,.002)};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,len/2,Math.min(hw-.02,sleeve/2),floor,floor+sleeve),edges); // the LPs, on edge
    drawBox({...tray,x:vx,y:vy},slats,foodRayTray);
  }),box:boxAt(x,y,1,0,hl,hw,0,floor+sleeve),radius:Math.hypot(hl,hw),recordCrate:{hl,hw,depth}};
}
// A low tea table: a top with an apron on four short legs.
function TEA_TABLE(x,y,hl,hw,h) {
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,5);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,h-.04,h,.01,wood); // the top
    coveRound(vx,vy,1,0,hl-.04,hw-.04,h-.09,h-.04,.006,wood); // the apron
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.07),vy+f*(hw-.07),1,0,.03,.03,0,h-.09,.008,wood); // the legs
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),teaTable:{h}};
}
// A floor cushion, plump, its piping a darker band.
function FLOOR_CUSHION(x,y,hl,hw,h,col) {
  const shade=(i,t,L)=>{const piping=Math.abs(HIT.w-h/2)<.008&&Math.abs(HIT.nz)<.6;BG[i]=C(col,(piping?1.4:2.6)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>coveRound(vx,vy,1,0,hl,hw,0,h,Math.min(.045,h*.45),shade)),box:boxAt(x,y,1,0,hl,hw,0,h),cushion:true};
}
const paintShade=(col,base,spread=.3)=>(i,t,L)=>{BG[i]=C(col,base+L*spread*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
// The motel's ice machine facing (fx,fy): a white cabinet, the bin door
// below with its handle, the snowflake panel above.
function ICE_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,white=paintShade(WHITE,2.8),flake=(i,t,L)=>{const u=HIT.u,w=HIT.w-1.275,arm=Math.min(Math.abs(u),Math.abs(u*.5+w*.866),Math.abs(u*.5-w*.866))<.004&&Math.hypot(u,w)<.065;
    BG[i]=C(HIT.face===3&&arm?WHITE:BLUE,4.5+L*.15);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.4,.35,.05,1.5,white,.03); part(0,0,.37,.32,0,.06,GRAY,.01); // cabinet and foot
    part(0,.352,.3,.004,.25,.8,white);
    for(const u of [-.15,.15])part(u,.366,.008,.01,.682,.708,GRAY,.004);
    part(0,.382,.18,.006,.68,.71,GRAY,.005); // the bin door, its handle
    part(0,.352,.2,.003,1.15,1.4,flake); // the panel
  }),box:boxAt(x,y,c,s,.4,.39,0,1.5),radius:.55};
}
// A wall rack of brochures facing (fx,fy): a back board and four tiers of
// pockets, a fan of leaflets standing in each.
function BROCHURE_RACK(x,y,hl,fx,fy) {
  const c=fy,s=-fx,board=paintShade(BRICK,1.6),cols=[YEL,CYAN,MAG,GREEN],n=Math.max(2,Math.floor(hl*2/.22)),papers=cols.map(col=>paintShade(col,3.2,.25));
  const clear=(i,t,L)=>{const glint=coveGroove(HIT.u+HIT.w*.65,.6,.002,t/projX)*coveDetail(t,.2);if(glint<.65)return false;BG[i]=C(CYAN,1.8+L*.1);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,-.12,hl,.02,0,1.4,board,.006); // the back board
    for(const e of [-1,1])part(e*(hl-.008),-.052,.008,.052,.49,1.365,board,.003);
    for(let row=0;row<4;row++){const z=.5+row*.22;
      for(let k=0;k<n;k++){const u=-hl+hl/n*(2*k+1);
        part(u,-.064,hl/n-.02,.036,z+.005,z+.2,papers[(k+row)&3]); // the leaflets, against the board
        part(u,-.02,hl/n-.012,.008,z+.005,z+.1,clear,.003);} // the clear pocket front
      part(0,-.06,hl,.045,z-.01,z+.005,board,.003);} // its shelf
  }),box:boxAt(x,y,c,s,hl,.15,0,1.4),radius:hl+.1,brochures:true};
}
// A steel workbench: a thick top, four angle legs, a shelf low down.
function WORKBENCH(x,y,hl,hw,h,col=GRAY) {
  const top=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,col);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx,vy,1,0,hl,hw,h-.05,h,.008,top); // the top
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.05),vy+f*(hw-.05),1,0,.025,.025,0,h-.05,.004,top); // the legs
    coveRound(vx,vy,1,0,hl-.05,hw-.05,.15,.18,.004,top); // the shelf
  }),box:boxAt(x,y,1,0,hl,hw,0,h),radius:Math.hypot(hl,hw),bench:{h}};
}
// A bench vice and a grinder on a bench top at z: the vice's jaws and screw,
// the grinder's motor and two wheels on edge.
function VICE_AND_GRINDER(x,y,z) {
  const blue=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE),wheel=[[-.012,0],[-.012,.09],[.012,.09],[.012,0]];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    coveRound(vx-.2,vy,1,0,.08,.07,z,z+.06,.01,blue); // the vice's body
    for(const e of [-1,1])coveRound(vx-.2,vy+e*.03,1,0,.06,.012,z+.06,z+.14,.004,blue); // its jaws
    coveTube(vx-.2,vy-.07,z+.08,vx-.2,vy-.18,z+.08,.008); // the screw handle
    coveRound(vx+.2,vy,1,0,.07,.06,z,z+.16,.02,GRAY); // the grinder's motor
    coveTube(vx+.2,vy-.09,z+.12,vx+.2,vy+.09,z+.12,.008);
    for(const e of [-1,1])shopDisc(vx+.2,vy+e*.09,1,0,z+.12,wheel,(i,t,L)=>{BG[i]=C(GRAY,1.6+L*.2);set(i,' ',0);return true;});
  }),box:boxAt(x,y,1,0,.3,.2,z,z+.21),radius:.4,vice:{z}};
}
// A cantilever rack of steel stock against a wall, facing (fx,fy): uprights,
// arms out from them, bars lying across the arms.
function STEEL_RACK(x,y,hl,fx,fy,h=1.8) {
  const c=fy,s=-fx,ups=[-hl+.05,0,hl-.05],arms=[.35,.75,1.15,1.55];
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    for(const u of ups){part(u,-.2,.04,.06,0,h,GRAY,.008);for(const z of arms)part(u,0,.02,.26,z-.03,z,GRAY,.004);} // uprights and arms
    for(const [k,z] of arms.entries())for(let j=0;j<4;j++){const v=-.1+j*.105,r=.012+((k+j)%3)*.006;
      const [ax,ay]=[vx+c*(-hl)-s*v,vy+s*(-hl)+c*v],[bx,by]=[vx+c*hl-s*v,vy+s*hl+c*v];coveTube(ax,ay,z+r,bx,by,z+r,r);} // the bars, resting on the arms
  }),box:boxAt(x,y,c,s,hl,.3,0,h),radius:hl+.1,steelRack:{arms}};
}
// A gate half made, stood against a wall: a frame of tube, bars across it,
// a scroll along the middle.
function GATE_FRAME(x,y,hl,h,c=0,s=1) {
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const P=(u,z)=>[vx+c*u,vy+s*u,z],tube=(a,b)=>coveTube(...P(...a),...P(...b),.015);
    tube([-hl,.015],[hl,.015]);tube([-hl,h-.015],[hl,h-.015]);tube([-hl,.015],[-hl,h-.015]);tube([hl,.015],[hl,h-.015]); // the frame
    for(let u=-hl+.4;u<hl-.1;u+=.4)tube([u,.015],[u,h-.015]); // bars
    for(let k=0;k<12;k++){const u0=-hl+k*hl/6,u1=u0+hl/6;tube([u0,.8+Math.sin(u0*6)*.25],[u1,.8+Math.sin(u1*6)*.25]);} // the scroll
  }),box:boxAt(x,y,c,s,hl,.03,0,h),radius:hl,gate:{h}};
}
// Closed rectangular recesses in a rounded cabinet. Each opening lists its
// half width, floor, ceiling and back plane in the cabinet's local axes.
function shopCabinetRay(ox,oy,oz,rx,ry,rz,b) {
  HIT.cabinetInner=false;const outer=coveRayRounded(ox,oy,oz,rx,ry,rz,b);
  if(outer<0||HIT.face!==3)return outer;
  const hole=b.recesses.find(q=>Math.abs(HIT.u)<q[0]&&HIT.w>q[1]&&HIT.w<q[2]);if(!hole)return outer;
  const [half,lo,hi,back]=hole,u=(ox-b.x)*b.c+(oy-b.y)*b.s,v=-(ox-b.x)*b.s+(oy-b.y)*b.c,du=rx*b.c+ry*b.s,dv=-rx*b.s+ry*b.c;
  let best=Infinity,nu=0,nv=0,nz=0;
  const take=(t,x,y,z)=>{const uu=u+du*t,vv=v+dv*t,w=oz+rz*t;
    if(t<outer||t>=best||Math.abs(uu)>half+1e-8||vv<back-1e-8||vv>b.hw+1e-8||w<lo-1e-8||w>hi+1e-8)return;
    best=t;nu=x;nv=y;nz=z;};
  if(Math.abs(dv)>1e-10)take((back-v)/dv,0,1,0);
  if(Math.abs(du)>1e-10)for(const e of [-1,1])take((e*half-u)/du,-e,0,0);
  if(Math.abs(rz)>1e-10){take((lo-oz)/rz,0,0,1);take((hi-oz)/rz,0,0,-1);}
  if(!Number.isFinite(best))return -1;
  HIT.u=u+du*best;HIT.v=v+dv*best;HIT.w=oz+rz*best;HIT.nx=b.c*nu-b.s*nv;HIT.ny=b.s*nu+b.c*nv;HIT.nz=nz;HIT.cabinetInner=true;HIT.face=nv?3:nz?(nz>0?5:6):(nu>0?1:2);return best;
}
const shopCabinetShade=(i,t,L)=>{if(HIT.cabinetInner){BG[i]=C(GRAY,.7+L*.12*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;}return coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz);};
function COFFEE_VENDING(x,y,fx,fy) {
  const c=fy,s=-fx,recesses=[[.08,.38,.56,.13]],cup=homeLampPart('cup',.38,[[0,0],[0,.025],[.09,.03],[.09,.027],[.002,.022],[.002,0]]).box;
  const porcelain=paintShade(WHITE,3,.25),panel=(i,t,L)=>{BG[i]=C(BRICK,3);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'COFFEE',0,.98,.02,.035,C(WHITE,6),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    drawBox({...boxAt(vx,vy,c,s,.25,.25,0,1.1),round:.02,recesses},shopCabinetShade,shopCabinetRay);
    part(0,.252,.18,.003,.82,1.06,panel);
    part(.15,.258,.04,.008,.7,.74,GRAY,.004);
    part(0,.2,.012,.012,.54,.56,GRAY,.004); // nozzle inside the bay ceiling
    drawBox({...cup,x:vx-s*.2,y:vy+c*.2},porcelain,coveRayLathe);
  }),box:boxAt(x,y,c,s,.25,.29,0,1.1),radius:.4};
}
function CHANGE_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,recesses=[[.08,1.05,1.07,.14]],cup=homeLampPart('coin-cup',.55,[[0,0],[0,.07],[.06,.075],[.06,.065],[.01,.06],[.01,0]]).box;
  const metal=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),sign=(i,t,L)=>{BG[i]=C(YEL,4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'CHANGE',0,1.25,.02,.035,C(GRAY,1),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    drawBox({...boxAt(vx,vy,c,s,.3,.2,0,1.4),round:.02,recesses},shopCabinetShade,shopCabinetRay);
    part(0,.202,.2,.003,1.18,1.32,sign);
    part(0,.2145,.04,.0145,.56,.58,GRAY,.004); // bracket to the back of the cup
    drawBox({...cup,x:vx-s*.3,y:vy+c*.3},metal,coveRayLathe);
  }),box:boxAt(x,y,c,s,.3,.38,0,1.4),radius:.5};
}
// A meat slicer on a counter top at z, its blade on edge to (fx,fy) turning.
function MEAT_SLICER(x,y,z,fx,fy) {
  const c=fy,s=-fx,blade=[[-.004,0],[-.004,.12],[.004,.12],[.004,0]];
  const spin=(i,t,L)=>{const a=Math.atan2(HIT.w-(z+.17),HIT.u)+T*30,glint=fract(a/TAU*3)<.1;BG[i]=C(GRAY,(glint?5:3)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.22,.17,z,z+.05,GRAY,.015); // the base
    part(-.04,-.04,.1,.06,z+.05,z+.22,GRAY,.02); // the motor housing behind the blade
    part(0,.03,.008,.012,z+.162,z+.178,GRAY,.004); // blade spindle, joined to the housing
    shopDisc(vx-s*.04,vy+c*.04,c,s,z+.17,blade,spin); // the blade
    part(.09,.09,.08,.05,z+.05,z+.08,GRAY,.008); // the carriage
  }),box:boxAt(x,y,c,s,.22,.17,z,z+.29),radius:.3,slicer:{z}};
}
// A take-a-number dispenser on its pole, the tickets to (fx,fy).
function TICKET_DISPENSER(x,y,fx,fy) {
  const c=fy,s=-fx,red=paintShade(RED,4,.2);
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.12,.12,0,.02,GRAY,.006); part(0,0,.016,.016,.02,1.16,GRAY,.006); // foot and pole
    part(0,0,.1,.08,1.15,1.35,red,.03); // the dispenser
    part(0,.084,.025,.004,1.2,1.25,(i,t,L)=>{BG[i]=C(WHITE,5);set(i,' ',0);return true;}); // the ticket sticking out
  }),box:boxAt(x,y,c,s,.12,.12,0,1.35),radius:.2};
}
// An upholstered armchair facing (fx,fy), its seat at h: four feet, a base,
// one seat cushion, a back cushion, two arms joined to base and back.
function ARMCHAIR(x,y,fx,fy,col=BRICK,h=.42) {
  const c=-fy,s=fx,cloth=furnitureCloth(col),at=(u,v)=>[x+c*u+fx*v,y+s*u+fy*v],hl=.38;
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    const part=(u,v,a,b,z0,z1,r,mat='wood')=>coveRound(vx+c*u+fx*v,vy+s*u+fy*v,c,s,a,b,z0,z1,r,mat);
    for(const u of [-hl+.1,hl-.1])for(const v of [-.27,.27])part(u,v,.035,.035,0,.12,.012); // the feet
    part(0,0,hl-.04,.36,.1,h-.15,.03); // the base
    part(0,.04,hl-.16,.32,h-.15,h,.06,cloth); // the seat cushion
    part(0,-.31,hl-.16,.08,h-.15,.95,.06,cloth); // the back
    for(const e of [-1,1])part(e*(hl-.08),0,.08,.38,h-.18,h+.22,.06,cloth); // the arms
  }),box:boxAt(x,y,c,s,hl,.4,0,.95),radius:.55,armchair:{fx,fy,h}};
}
// Old suitcases lying one on another: [x, y, z0, z1, colour] each, a handle
// on the front and two straps round each.
function SUITCASE_PILE(cases) {
  const x=cases[0][0],y=cases[0][1],top=Math.max(...cases.map(q=>q[3]));
  const shades=cases.map(q=>paintShade(q[4],2.2,.3)),leather=paintShade(BRICK,1.2,.2);
  const x0=Math.min(...cases.map(q=>q[0]-.4)),x1=Math.max(...cases.map(q=>q[0]+.4)),y0=Math.min(...cases.map(q=>q[1]-.285)),y1=Math.max(...cases.map(q=>q[1]+.35));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{cases.forEach(([cx,cy,z0,z1],k)=>{const px=vx+cx-x,py=vy+cy-y,h=z1-z0;
    coveRound(px,py,1,0,.4,.28,z0,z1-.004,.03,shades[k]);
    for(const e of [-.22,.22])coveRound(px+e,py,1,0,.025,.285,z0+.005,z1,.004,leather);
    for(const e of [-1,1])coveTube(px+e*.07,py+.28,z0+h*.55,px+e*.07,py+.34,z0+h*.55,.01,BRICK);
    coveTube(px-.07,py+.34,z0+h*.55,px+.07,py+.34,z0+h*.55,.01,BRICK);
  });}),box:boxAt((x0+x1)/2,(y0+y1)/2,1,0,(x1-x0)/2,(y1-y0)/2,0,top),radius:Math.max(...cases.map(q=>Math.hypot(q[0]-x,q[1]-y)+.55)),suitcases:{cases}};
}
// The tailor's cutting table: a top on four legs, a length of cloth laid on
// it with the pattern chalked, a rule along the front edge.
function CUTTING_TABLE(x,y,hl,hw,h,col=BLUE) {
  const wood=(i,t,L)=>coveTimber(i,HIT.u,HIT.v+HIT.w,L,t,HIT.nx,HIT.ny,HIT.nz,13);
  const cloth=(i,t,L)=>{const u=HIT.u,v=HIT.v,chalk=Math.abs(Math.abs(u-.2)-.5)<.012||Math.abs(v-Math.sin(u*3)*.1)<.012;
    BG[i]=C(chalk&&coveDetail(t,.1)>.3?WHITE:col,chalk?4+L*.2:2.2+L*.2);set(i,' ',0);return true;};
  const rule=(i,t,L)=>{const tick=coveGroove(HIT.u,.1,.003,t/projX)*coveDetail(t,.1);BG[i]=C(tick>.5?GRAY:YEL,tick>.5?2:4);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,.9,.4,h,h+.004),gondolaFlat(1,0,cloth)); // the cloth, flat on the top
    drawBox(boxAt(vx,vy+hw-.025,1,0,hl-.05,.02,h,h+.003),gondolaFlat(1,0,rule)); // the rule
    coveRound(vx,vy,1,0,hl,hw,h-.04,h,.01,wood);
    for(const e of [-1,1])for(const f of [-1,1])coveRound(vx+e*(hl-.08),vy+f*(hw-.08),1,0,.035,.035,0,h-.04,.01,wood);
    coveRound(vx,vy,1,0,hl-.1,hw-.1,.12,.15,.006,wood); // the shelf low down
  }),box:boxAt(x,y,1,0,hl,hw,0,h+.004),radius:Math.hypot(hl,hw),cuttingTable:{h}};
}
// A fitting mirror standing on its feet, the glass to (fx,fy).
function FITTING_MIRROR(x,y,hl,h,fx,fy) {
  const c=fy,s=-fx,glass=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(BRICK,1.8);set(i,' ',0);return true;}BG[i]=C(CYAN,1.4+(HIT.w*.6));if(coveGroove(HIT.u+HIT.w,.5,.002,t/projX)*coveDetail(t,.2)>.65)BG[i]=C(WHITE,4);set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,hl,.02,.08,h,glass); // the glass in its frame
    for(const e of [-1,1]){part(e*(hl+.015),0,.015,.03,0,h,'wood',.006);part(e*hl,0,.04,.15,0,.04,'wood',.01);} // the frame's sides, the feet
    part(0,0,hl+.03,.03,h,h+.03,'wood',.008); // its head
  }),box:boxAt(x,y,c,s,hl+.04,.15,0,h+.03),radius:hl+.1,mirror:{fx,fy}};
}
// A curtain drawn back on its rail: the folds bunched as soft columns, along u (c,s).
function CURTAIN_DRAWN(x,y,hl,z0,z1,col,c=1,s=0,railTo=hl+.05) {
  const n=Math.max(3,Math.round(hl*2/.12)),shades=Array.from({length:n},(_,k)=>paintShade(col,1.6+(k&1)*.6,.25));
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(let k=0;k<n;k++){const u=-hl+hl/n*(2*k+1),v=(k&1)?.012:-.012;
      coveRound(vx+c*u-s*v,vy+s*u+c*v,c,s,hl/n+.004,.03,z0,z1,.028,shades[k]);
      coveTube(vx+c*u-s*v,vy+s*u+c*v,z1-.006,vx+c*u-s*v,vy+s*u+c*v,z1+.03,.003);
    }
    coveTube(vx-c*(hl+.05),vy-s*(hl+.05),z1+.03,vx+c*(railTo-.012),vy+s*(railTo-.012),z1+.03,.012);
    coveRound(vx+c*(railTo-.012),vy+s*(railTo-.012),c,s,.012,.04,z1-.01,z1+.07,.004,GRAY);
  }),box:boxAt(x,y,c,s,hl,.045,0,z1+.07),radius:Math.max(hl+.1,Math.abs(railTo)+.05),curtain:true};
}
// A hot-dog roller on a counter at z: a steel tray, the rollers turning, the
// sausages resting between them.
function HOTDOG_ROLLER_AT(x,y,z) {
  const n=6,pitch=.04,r=.012,sr=.021,roll=(i,t,L)=>{const ridge=fract(HIT.u*20+T*2)<.5;BG[i]=C(GRAY,(ridge?3.2:2.4)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const sz=z+.03+r+Math.sqrt((r+sr)**2-(pitch/2)**2); // a sausage's centre, touching both rollers under it
  const sausage=kitchenFoodShade(BRICK),dogs=[0,2,4].map(k=>{const v=(-n/2+k+1)*pitch;return{...boxAt(0,v,1,0,.14+sr,sr,sz-sr,sz+sr),ax:-.14,ay:v,az:sz,bx:.14,by:v,bz:sz,r:sr};});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    for(const b of dogs)drawBox({...b,x:vx,y:vy+b.y,ax:vx+b.ax,ay:vy+b.ay,bx:vx+b.bx,by:vy+b.by},sausage,coveRayCapsule);
    for(let k=0;k<n;k++){const v=(-n/2+k+.5)*pitch;drawBox({...boxAt(vx,vy+v,1,0,.18,r,z+.03,z+.03+2*r),ax:vx-.18,ay:vy+v,az:z+.03+r,bx:vx+.18,by:vy+v,bz:z+.03+r,r},roll,coveRayCapsule);}
    coveRound(vx,vy,1,0,.22,.14,z,z+.03,.008,GRAY); // the tray
  }),box:boxAt(x,y,1,0,.22,.14,z,sz+sr),radius:.3,roller:{z}};
}
