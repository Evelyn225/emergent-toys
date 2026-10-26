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
// A video store's returns box facing (fx,fy): a steel drop box on its foot,
// a hooded slot with its flap, RETURNS over it.
function RETURNS_BOX(x,y,fx,fy) {
  const c=fy,s=-fx,blue=(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,BLUE);
  const label=(i,t,L)=>{BG[i]=C(WHITE,4);if(HIT.face===3&&wallText(i,HIT.u,t/projX,HIT.w,t,'RETURNS',0,.8,.018,.03,C(BLUE,3),BG[i]))return true;set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.25,.2,.06,.9,blue,.03); // the box
    part(0,0,.22,.17,0,.06,GRAY,.01); // its foot
    part(0,.205,.14,.005,.66,.7,(i,t,L)=>{BG[i]=C(GRAY,.4);set(i,' ',0);return true;}); // the slot's flap, dark
    part(0,.22,.16,.02,.7,.72,blue,.006); // the hood over it
    part(0,.202,.12,.002,.76,.84,label); // the label
  }),box:boxAt(x,y,c,s,.25,.24,0,.9),radius:.35,returnsBox:{fx,fy}};
}
// The queue-ticket screen on its pole, facing (fx,fy), the number blinking.
function QUEUE_SCREEN(x,y,fx,fy) {
  const c=fy,s=-fx,screen=(i,t,L)=>{if(HIT.face!==3){BG[i]=C(GRAY,1.6);set(i,' ',0);return true;}BG[i]=C(CYAN,4);return set(i,fract(T)<.5&&coveDetail(t,.1)>.3?'#':' ',C(WHITE,13)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.12,.12,0,.02,GRAY,.006); // the foot
    part(0,0,.018,.018,.02,1.22,GRAY,.008); // the pole
    part(0,0,.18,.03,1.2,1.5,screen); // the screen
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
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s),up=fract(T*6)<.5?.01:0;
    part(0,0,.2,.1,z,z+.04,body,.01); // the bed
    part(-.15,0,.04,.06,z+.04,z+.2,body,.015); // the pillar
    part(-.01,0,.18,.045,z+.16,z+.22,body,.02); // the arm across
    part(.14,0,.04,.05,z+.09,z+.22,body,.015); // the head
    part(.14,.02,.003,.003,z+.05+up,z+.09,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz),.002); // the needle, going
  }),box:boxAt(x,y,c,s,.2,.1,z,z+.22),radius:.25,sewing:{z}};
}
// A slatted crate of LPs, their top edges each a colour.
function RECORD_CRATE(x,y,hl,hw,seed) {
  const depth=.32,slats=grocerSlats(),sleeve=RECORD_BIN.sleeve,pitch=RECORD_BIN.pitch,len=hl*2-.04;
  const edges=gondolaFlat(1,0,(i,t,L)=>{const j=Math.floor((HIT.u+len/2)/pitch),col=RECORD_COLS[Math.floor(hash(j,seed,72)*RECORD_COLS.length)];
    BG[i]=C(col,1.8+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz)-coveGroove(HIT.u+len/2,pitch,.0015,t/projX)*coveDetail(t,.15)*1.2);set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,(vx,vy)=>{
    drawBox(boxAt(vx,vy,1,0,len/2,Math.min(hw-.02,sleeve/2),.012,.012+sleeve),edges); // the LPs, on edge
    foodTray(vx,vy,0,hl,hw,depth,slats);
  }),box:boxAt(x,y,1,0,hl,hw,0,.012+sleeve),radius:Math.hypot(hl,hw),recordCrate:{hl,hw,depth}};
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
