// Small shop fittings shared between rooms: a stack of binders or books lying
// flat, and a rug on the floor.
// A stack lying flat at z: each [hl, hw, thickness, colour], bottom first,
// each resting on the one beneath, the spines along u (c, s).
function BOOK_STACK(x,y,z,books,c=1,s=0) {
  const tops=[];let h=z;for(const b of books){tops.push(h);h+=b[2];}
  const cover=col=>(i,t,L)=>{const edge=HIT.face!==5&&HIT.face!==6&&Math.abs(HIT.nz)<.5&&(HIT.face===1||HIT.face===2);
    BG[i]=C(edge?WHITE:col,(edge?3.2:2.2)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const hl=Math.max(...books.map(b=>b[0])),hw=Math.max(...books.map(b=>b[1]));
  return {...ROOM_MODEL(x,y,(vx,vy)=>books.forEach((b,k)=>coveRound(vx,vy,c,s,b[0],b[1],tops[k],tops[k]+b[2],.004,cover(b[3])))),
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
// Coils of garden hose lying on the floor, turn on turn: each turn a ring.
function HOSE_COILS(x,y,R=.34,turns=6,r=.022,col=GREEN) {
  // (an octagon of tube section: a finer one costs more than it shows at this size)
  const ring=k=>{const zc=r+k*2*r,pts=[];for(let j=0;j<=8;j++){const a=Math.PI/2-j*Math.PI/4;pts.push([zc+r*Math.sin(a),R+r*Math.cos(a)]);}return pts;};
  const rings=Array.from({length:turns},(_,k)=>ring(k));
  const shade=(i,t,L)=>{BG[i]=C(col,2.2+L*.35*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(let k=turns-1;k>=0;k--)coveLathe(vx,vy,0,rings[k],shade);}),
    box:boxAt(x,y,1,0,R+r,R+r,0,turns*2*r),radius:R+r,hose:{R,r,turns}};
}
// Bags of compost lying flat, one on another: plump rounded slabs with a printed band.
function COMPOST_BAGS(x,y,n=4,hl=.4,hw=.28,h=.16) {
  const shade=k=>(i,t,L)=>{const band=Math.abs(HIT.nz)<.6&&Math.abs(HIT.u)<.15&&HIT.face!==5;
    BG[i]=C(band?YEL:k&1?GREEN:BRICK,(band?3:1.8)+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{for(let k=n-1;k>=0;k--)coveRound(vx,vy,1,0,hl-k*.01,hw-k*.008,k*h,(k+1)*h,.05,shade(k));}),
    box:boxAt(x,y,1,0,hl,hw,0,n*h),radius:Math.hypot(hl,hw),bags:{n,h}};
}
// A plain bulkhead hanging from the ceiling over an opening.
function BULKHEAD(x,y,hl,hw,z0,z1,c=1,s=0) {
  const shade=gondolaFlat(c,s,(i,t,L)=>{BG[i]=C(GRAY,1.8+L*.25*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;});
  return {...ROOM_MODEL(x,y,(vx,vy)=>drawBox(boxAt(vx,vy,c,s,hl,hw,z0,z1),shade)),box:{...boxAt(x,y,c,s,hl,hw,z0,z1)},overhead:true};
}
// The blood-pressure machine facing (fx,fy): a white cabinet, the cuff's
// ring on the front at arm height, the readout above it.
function BP_MACHINE(x,y,fx,fy) {
  const c=fy,s=-fx,ring=[[-.03,.06],[-.03,.09],[.03,.09],[.03,.06],[-.03,.06]];
  const white=(i,t,L)=>{BG[i]=C(WHITE,2.6+L*.3*coveLight(HIT.nx,HIT.ny,HIT.nz));set(i,' ',0);return true;};
  const readout=(i,t,L)=>{BG[i]=C(CYAN,3);return set(i,HIT.face===3&&coveDetail(t,.1)>.3?(HIT.w>1.08?'1':'2'):' ',C(WHITE,14)),true;};
  return {...ROOM_MODEL(x,y,(vx,vy)=>{const part=GAS_PART(vx,vy,c,s);
    part(0,0,.3,.28,0,1.3,white,.03); // the cabinet
    part(0,.282,.12,.003,.95,1.18,readout); // the readout
    shopDisc(vx-s*.3,vy+c*.3,c,s,.75,ring,(i,t,L)=>coveMetal(i,L,HIT.nx,HIT.ny,HIT.nz,GRAY)); // the cuff's ring, standing proud
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
